import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";

import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

/**
 * Boots the whole backend in one process, like four real processes would run:
 * auth-service, reference-data-service, cap-event-package-service (TCP, random
 * ports) and the api-gateway (HTTP), all against one in-memory MongoDB with
 * one database per service. Each project is loaded from its TypeScript
 * sources with its own node_modules (and thus its own @nestjs copy).
 */
const root = path.resolve(__dirname, "../../..");
const requireIn = (project: string) =>
  createRequire(path.join(root, project, "package.json"));

export const REDIRECT_URI = "http://localhost:3000/cap-event/auth/callback";
export const UI_ORIGIN = "http://localhost:3000";
export const DEMO = { email: "demo@example.com", password: "demo-password-1" };

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

export interface Stack {
  http: ReturnType<typeof request>;
  apps: { auth: any; referenceData: any; capEventPackage: any; gateway: any };
  close: () => Promise<void>;
}

export async function bootStack(): Promise<Stack> {
  const mongod = await MongoMemoryServer.create();
  const uri = (db: string) => mongod.getUri() + db;
  const [authPort, refPort, pkgPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const logger = process.env.E2E_LOGS ? undefined : false;

  Object.assign(process.env, {
    PRIVATE_KEY: "e2e-private-key-e2e-private-key-0123456789",
    CLIENT_ID: "cap-event-ui",
    CLIENT_URL: UI_ORIGIN,
    ALLOWED_REDIRECT_URIS: REDIRECT_URI,
    PORT: "0",
    PUBLIC_URL: "http://localhost:4000",
    BCRYPT_ROUNDS: "4",
    SEED_USER_EMAIL: DEMO.email,
    SEED_USER_PASSWORD: DEMO.password,
  });

  // @nestjs/config snapshots process.env when a project's AppModule is first
  // loaded, so the per-service variables are set right before each require.
  const tcp = async (project: string, appModulePath: string, port: number, env: Record<string, string>) => {
    Object.assign(process.env, env);
    const { NestFactory } = requireIn(project)("@nestjs/core");
    const { Transport } = requireIn(project)("@nestjs/microservices");
    const { AppModule } = require(appModulePath);
    const app = await NestFactory.createMicroservice(AppModule, {
      transport: Transport.TCP,
      options: { host: "127.0.0.1", port },
      logger,
    });
    await app.listen();
    return app;
  };

  const auth = await tcp("auth-service", "../../../auth-service/src/app.module", authPort, {
    MONGO_URI: uri("cap_event_auth"),
  });
  const referenceData = await tcp(
    "reference-data-service",
    "../../../reference-data-service/src/app.module",
    refPort,
    { MONGO_URI: uri("cap_event_reference_data") },
  );
  const capEventPackage = await tcp(
    "cap-event-package-service",
    "../../../cap-event-package-service/src/app.module",
    pkgPort,
    {
      MONGO_URI: uri("cap_event_package"),
      REFERENCE_DATA_HOST: "127.0.0.1",
      REFERENCE_DATA_PORT: String(refPort),
    },
  );

  Object.assign(process.env, {
    AUTH_SERVICE_HOST: "127.0.0.1",
    AUTH_SERVICE_PORT: String(authPort),
    REFERENCE_DATA_SERVICE_HOST: "127.0.0.1",
    REFERENCE_DATA_SERVICE_PORT: String(refPort),
    CAP_EVENT_PACKAGE_SERVICE_HOST: "127.0.0.1",
    CAP_EVENT_PACKAGE_SERVICE_PORT: String(pkgPort),
  });
  const { NestFactory: GatewayFactory } = requireIn("api-gateway")("@nestjs/core");
  const { AppModule: GatewayModule } = require("../../../api-gateway/src/app.module");
  const { configureApp } = require("../../../api-gateway/src/app.setup");
  const gateway = await GatewayFactory.create(GatewayModule, { logger });
  configureApp(gateway);
  await gateway.init();

  return {
    http: request(gateway.getHttpServer()),
    apps: { auth, referenceData, capEventPackage, gateway },
    close: async () => {
      await gateway.close();
      await capEventPackage.close();
      await referenceData.close();
      await auth.close();
      await mongod.stop();
    },
  };
}

/** Same PKCE generation as cap-event-ui: verifier = 64 hex chars, challenge = S256. */
const newPkce = () => {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest().toString("base64url");
  return { verifier, challenge };
};

/** Real Authorization Code + PKCE login against the fake OneLogin; returns the access token. */
export async function login(http: Stack["http"]): Promise<string> {
  const { verifier, challenge } = newPkce();
  const params = {
    client_id: "cap-event-ui",
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "custom:capevent",
    state: "state-123",
    resource: "http://localhost:4000",
    code_challenge: challenge,
    code_challenge_method: "S256",
  };
  const submit = await http.post("/oidc/2/auth").type("form").send({ ...params, mode: "login", ...DEMO });
  if (submit.status !== 302) throw new Error(`login form answered ${submit.status}`);
  const code = new URL(submit.headers.location).searchParams.get("code") as string;
  const token = await http
    .post("/oidc/2/token")
    .set("Origin", UI_ORIGIN)
    .type("form")
    .send({
      grant_type: "authorization_code",
      client_id: "cap-event-ui",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });
  if (token.status !== 200) throw new Error(`token endpoint answered ${token.status}`);
  return token.body.access_token as string;
}
