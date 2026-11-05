import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { after, before, describe, it } from "node:test";
import path from "node:path";

import { expect } from "expect";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

// Plain Node (not jest's VM sandbox, which breaks the MongoDB driver handshake).
// Run with: node --no-experimental-strip-types --require ts-node/register/transpile-only --test
// Both projects are loaded from their TypeScript sources. Each keeps its own
// node_modules (and thus its own @nestjs copy), exactly like two processes
// would; the test uses each project's own NestFactory for its own module.
const root = path.resolve(__dirname, "../..");
const authRequire = createRequire(path.join(root, "auth-service/package.json"));
const gatewayRequire = createRequire(
  path.join(root, "api-gateway/package.json"),
);

const REDIRECT_URI = "http://localhost:3000/cap-event/auth/callback";
const DEMO = { email: "demo@example.com", password: "demo-password-1" };

const b64url = (buf: Buffer) => buf.toString("base64url");

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

/** Same PKCE generation as cap-event-ui: verifier = 64 hex chars, challenge = S256. */
const newPkce = () => {
  const verifier = randomBytes(32).toString("hex");
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
};

describe(
  "fake OneLogin flow (auth-service + api-gateway + MongoDB)",
  { timeout: 120000 },
  () => {
    let mongod: MongoMemoryServer;
    let authApp: any;
    let gateway: any;
    let http: ReturnType<typeof request>;

    before(async () => {
      // In-memory MongoDB: never the user's Atlas cluster. Random TCP port: never 4000/4001.
      mongod = await MongoMemoryServer.create();
      const tcpPort = await freePort();
      Object.assign(process.env, {
        MONGO_URI: mongod.getUri() + "cap_event_auth",
        PRIVATE_KEY: "e2e-private-key-e2e-private-key-0123456789",
        CLIENT_ID: "cap-event-ui",
        CLIENT_URL: "http://localhost:3000",
        ALLOWED_REDIRECT_URIS: REDIRECT_URI,
        PORT: "0",
        PUBLIC_URL: "http://localhost:4000",
        BCRYPT_ROUNDS: "4",
        SEED_USER_EMAIL: DEMO.email,
        SEED_USER_PASSWORD: DEMO.password,
        AUTH_SERVICE_HOST: "127.0.0.1",
        AUTH_SERVICE_PORT: String(tcpPort),
      });

      // Required only now: both AppModules validate process.env when first loaded.
      const { NestFactory: AuthFactory } = authRequire("@nestjs/core");
      const { Transport } = authRequire("@nestjs/microservices");
      const {
        AppModule: AuthModule,
      } = require("../../auth-service/src/app.module");
      const { NestFactory: GatewayFactory } = gatewayRequire("@nestjs/core");
      const {
        AppModule: GatewayModule,
      } = require("../../api-gateway/src/app.module");
      const { configureApp } = require("../../api-gateway/src/app.setup");

      const logger = process.env.E2E_LOGS ? undefined : false;
      authApp = await AuthFactory.createMicroservice(AuthModule, {
        transport: Transport.TCP,
        options: { host: "127.0.0.1", port: tcpPort },
        logger,
      });
      await authApp.listen();

      gateway = await GatewayFactory.create(GatewayModule, { logger });
      configureApp(gateway);
      await gateway.init();
      http = request(gateway.getHttpServer());
    });

    after(async () => {
      await gateway?.close();
      await authApp?.close();
      await mongod?.stop();
    });

    const authQuery = (
      challenge: string,
      extra: Record<string, string> = {},
    ) => ({
      client_id: "cap-event-ui",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid profile email cap-event",
      state: "state-123",
      resource: "http://localhost:4000/api",
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...extra,
    });

    /** Steps 1+2: render the form, post credentials, return the code from the redirect. */
    const obtainCode = async (challenge: string) => {
      const form = await http.get("/oidc/2/auth").query(authQuery(challenge));
      expect(form.status).toBe(200);
      expect(form.headers["content-type"]).toContain("text/html");
      expect(form.text).toContain('name="email"');

      const submit = await http
        .post("/oidc/2/auth")
        .type("form")
        .send({ ...authQuery(challenge), mode: "login", ...DEMO });
      expect(submit.status).toBe(302);

      const location = new URL(submit.headers.location);
      expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
      expect(location.searchParams.get("state")).toBe("state-123");
      const code = location.searchParams.get("code");
      expect(code).toBeTruthy();
      return code as string;
    };

    const tokenRequest = (body: Record<string, string>) =>
      http
        .post("/oidc/2/token")
        .set("Origin", "http://localhost:3000")
        .type("form")
        .send({ client_id: "cap-event-ui", ...body });

    it("walks authorize -> code -> token (PKCE) -> me -> refresh rotation -> logout", async () => {
      // --- discovery
      const discovery = await http.get(
        "/oidc/2/.well-known/openid-configuration",
      );
      expect(discovery.status).toBe(200);
      expect(discovery.body.token_endpoint).toBe(
        "http://localhost:4000/oidc/2/token",
      );

      const { verifier, challenge } = newPkce();

      // --- a wrong verifier fails AND burns the code
      const burned = await obtainCode(challenge);
      const wrong = await tokenRequest({
        grant_type: "authorization_code",
        code: burned,
        redirect_uri: REDIRECT_URI,
        code_verifier: newPkce().verifier,
      });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error).toBe("invalid_grant");
      const retry = await tokenRequest({
        grant_type: "authorization_code",
        code: burned,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      });
      expect(retry.status).toBe(400);

      // --- authorization_code grant with the right verifier
      const code = await obtainCode(challenge);
      const exchange = await tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      });
      expect(exchange.status).toBe(200);
      expect(exchange.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
      expect(exchange.headers["cache-control"]).toBe("no-store");
      const tokens = exchange.body;
      expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600 });
      expect(Object.keys(tokens).sort()).toEqual([
        "access_token",
        "expires_in",
        "id_token",
        "refresh_token",
        "token_type",
      ]);

      const claims = (jwt: string) =>
        JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      expect(claims(tokens.access_token)).toMatchObject({
        email: DEMO.email,
        name: "Demo User",
        token_use: "access",
      });
      expect(claims(tokens.id_token)).toMatchObject({
        sub: claims(tokens.access_token).sub,
        aud: "cap-event-ui",
        iss: "http://localhost:4000/oidc/2",
        token_use: "id",
      });

      // --- the code is single use
      const replay = await tokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      });
      expect(replay.status).toBe(400);
      expect(replay.body.error).toBe("invalid_grant");

      // --- GET /api/v1/auth/me: gateway verifies the JWT itself
      const me = await http
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tokens.access_token}`);
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ email: DEMO.email, name: "Demo User" });
      expect((await http.get("/api/v1/auth/me")).status).toBe(401);
      expect(
        (
          await http
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${tokens.id_token}`)
        ).status,
      ).toBe(401);

      // --- refresh: rotation, old token rejected
      const refreshed = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.refresh_token).not.toBe(tokens.refresh_token);
      const reuse = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      });
      expect(reuse.status).toBe(400);
      expect(reuse.body.error).toBe("invalid_grant");
      expect(
        (
          await http
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${refreshed.body.access_token}`)
        ).status,
      ).toBe(200);

      // --- storage: hashed tokens in the explicit collections
      const { getConnectionToken } = authRequire("@nestjs/mongoose");
      const conn = authApp.get(getConnectionToken());
      const collections = (await conn.db.listCollections().toArray()).map(
        (c: { name: string }) => c.name,
      );
      expect(collections).toEqual(
        expect.arrayContaining(["users", "auth_codes", "refresh_tokens"]),
      );
      const stored = await conn.db
        .collection("refresh_tokens")
        .find()
        .toArray();
      expect(stored.length).toBeGreaterThan(0);
      expect(JSON.stringify(stored)).not.toContain(
        refreshed.body.refresh_token,
      );
      const user = await conn.db
        .collection("users")
        .findOne({ email: DEMO.email });
      expect(user?.password).toMatch(/^\$2[aby]\$/);

      // --- logout: revokes refresh tokens, redirects to the UI
      const target = "http://localhost:3000/cap-event/login?prompt_login=true";
      const logout = await http
        .get("/oidc/2/logout")
        .query({
          id_token_hint: refreshed.body.id_token,
          post_logout_redirect_uri: target,
        });
      expect(logout.status).toBe(302);
      expect(logout.headers.location).toBe(target);

      const afterLogout = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: refreshed.body.refresh_token,
      });
      expect(afterLogout.status).toBe(400);
      expect(afterLogout.body.error).toBe("invalid_grant");

      const evil = await http.get("/oidc/2/logout").query({
        id_token_hint: refreshed.body.id_token,
        post_logout_redirect_uri: "https://evil.example/",
      });
      expect(evil.status).toBe(400);
    });

    it("rejects bad credentials, unknown clients and foreign redirect URIs", async () => {
      const { challenge } = newPkce();

      const bad = await http
        .post("/oidc/2/auth")
        .type("form")
        .send({
          ...authQuery(challenge),
          mode: "login",
          email: DEMO.email,
          password: "wrong-password",
        });
      expect(bad.status).toBe(401);
      expect(bad.text).toContain("Invalid email or password");
      expect(bad.headers.location).toBeUndefined();

      const foreign = await http
        .get("/oidc/2/auth")
        .query(
          authQuery(challenge, { redirect_uri: "http://evil.example/cb" }),
        );
      expect(foreign.status).toBe(400);
      expect(foreign.headers.location).toBeUndefined();

      const client = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: "x",
      }).send({
        client_id: "someone-else",
      });
      expect(client.status).toBe(401);
      expect(client.body.error).toBe("invalid_client");
    });

    it("registers a new user through the form and through the JSON API", async () => {
      const { verifier, challenge } = newPkce();

      const register = await http
        .post("/oidc/2/auth")
        .type("form")
        .send({
          ...authQuery(challenge),
          mode: "register",
          name: "New Person",
          email: "new.person@example.com",
          password: "another-password",
        });
      expect(register.status).toBe(302);
      const code = new URL(register.headers.location).searchParams.get("code");
      const exchange = await tokenRequest({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      });
      expect(exchange.status).toBe(200);

      const duplicate = await http
        .post("/api/v1/auth/registration")
        .send({
          email: "new.person@example.com",
          password: "another-password",
          name: "Dup",
        });
      expect(duplicate.status).toBe(409);

      const json = await http
        .post("/api/v1/auth/registration")
        .send({
          email: "json.user@example.com",
          password: "json-password-1",
          name: "Json User",
        });
      expect(json.status).toBe(201);
      expect(json.body.user.email).toBe("json.user@example.com");

      const login = await http
        .post("/api/v1/auth/login")
        .send({ email: "json.user@example.com", password: "json-password-1" });
      expect(login.status).toBe(200);
      const me = await http
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${login.body.access_token}`);
      expect(me.body.name).toBe("Json User");

      const invalid = await http
        .post("/api/v1/auth/registration")
        .send({ email: "nope", password: "x", name: "" });
      expect(invalid.status).toBe(400);
    });
  },
);
