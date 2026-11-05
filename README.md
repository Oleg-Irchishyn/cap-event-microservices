# cap-event-microservices

Backend for [cap-event-ui](../cap-event-ui). First slice: a **fake OneLogin (OIDC) login** so the UI keeps its
existing Authorization Code + PKCE flow, built as two independent NestJS 11 projects talking over TCP.

The original backend was Java + OpenAPI; this one is Node.js and the gateway's OpenAPI document
(`/docs`, `/docs-json`, `api-gateway/openapi/auth.json`) is the contract.

## Architecture

```
 Browser (cap-event-ui, :3000)
        |  HTTP (only public surface)
        v
 +------------------------------+   TCP (@MessagePattern 'auth.*')   +-------------------------------+
 | api-gateway            :4000 | ---------------------------------> | auth-service            :4001 |
 |  - /oidc/2/*  fake OneLogin  |                                    |  - users (bcrypt)             |
 |  - /api/v1/auth/*  JSON API  |                                    |  - auth codes (PKCE, TTL)     |
 |  - Swagger /docs             |                                    |  - refresh tokens (hashed)    |
 |  - verifies JWT (JwtGuard)   |                                    |  - signs JWT (HS256)          |
 +------------------------------+                                    +---------------+---------------+
        shares PRIVATE_KEY  <------------------------------------------>             | Mongoose
                                                                                     v
                                                                     MongoDB  db `cap_event_auth`
                                                                     users / auth_codes / refresh_tokens
```

| Folder          | What it is                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `api-gateway/`  | The only public HTTP surface. No database. Swagger, class-validator DTOs, `ClientsModule` to auth-service, `JwtGuard`. |
| `auth-service/` | Pure TCP microservice. Owns MongoDB. The only place that signs tokens.                                              |
| `contracts/`    | Shared package `@cap-event/contracts` (message patterns, payload types, token claims). Linked via `file:../contracts`. |
| `e2e/`          | One end-to-end test: boots both services in-process against `mongodb-memory-server`.                                 |

Each of `api-gateway`, `auth-service`, `e2e` has its own `package.json` / `node_modules`. Shared types live in
`contracts/` instead of being copy-pasted (a gap of the spotify-clone sandbox this follows).

Conventions taken from `spotify-clone/microservices`: `toHttpException` util, `RpcException({ status, message })`,
`@MessagePattern('domain.action')`, `JwtGuard` verifying with the shared `PRIVATE_KEY`, Mongoose per-service DB,
`ConfigModule`, class-validator DTOs with custom messages.

### Message patterns (auth-service)

`auth.register`, `auth.login`, `auth.validate-credentials`, `auth.code.issue`, `auth.token.exchange`,
`auth.token.refresh`, `auth.me`, `auth.logout`.

## The login flow

1. UI redirects the browser to `GET /oidc/2/auth?client_id&redirect_uri&response_type=code&scope&state&resource&code_challenge&code_challenge_method=S256[&prompt=login]`.
   The gateway checks `client_id` and the exact `redirect_uri` allow-list and renders a minimal HTML form
   (sign in; a link switches to "create account"). All reflected values are HTML-escaped. There is no SSO session, so the
   form is always shown (`prompt=login` is accepted and is a no-op).
2. `POST /oidc/2/auth` verifies the credentials (or registers) via auth-service, which stores a one-time
   **authorization code** (hashed, bound to client, redirect_uri, PKCE challenge and user; TTL 2 min). The gateway
   answers `302 redirect_uri?code=...&state=...`. Bad credentials re-render the form with an error.
3. The UI calls `POST /oidc/2/token` (form-urlencoded, CORS allowed for `CLIENT_URL`):
   - `authorization_code`: auth-service atomically deletes the code first (single use, even on failure), then checks
     expiry, client, redirect_uri and PKCE S256. Returns `{ access_token, token_type: "Bearer", expires_in, refresh_token, id_token }`.
   - `refresh_token`: the token is consumed and a new one is issued (rotation); reuse of the old one gives `invalid_grant`.
   Errors are RFC 6749 shaped: `400 { error, error_description }`.
4. API calls send `Authorization: Bearer <access_token>`; the gateway verifies the HS256 JWT itself (signature, issuer,
   audience, `token_use=access`) with no round-trip to auth-service. Try `GET /api/v1/auth/me`.
5. `GET /oidc/2/logout?id_token_hint&post_logout_redirect_uri` revokes all of that user's refresh tokens and redirects to
   the post-logout URI, which must be on an allowed origin.

Also: `GET /oidc/2/.well-known/openid-configuration`, and spotify-style JSON endpoints
`POST /api/v1/auth/registration`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.

Tokens: access token (1h) and id token are HS256 JWTs with `sub`, `email`, `name`, `iss`, `aud`, `token_use`.
Refresh tokens and auth codes are opaque random values; only their SHA-256 is stored.

## Ports

| Service      | Default | Public? |
| ------------ | ------- | ------- |
| api-gateway  | `4000`  | yes     |
| auth-service | `4001`  | no (TCP, bound to 127.0.0.1 by default) |

## Environment variables

Copy each `.env.example` to `.env` (gitignored) and fill it in. **auth-service will not start without `MONGO_URI`**
(the e2e test does not need one: it uses an in-memory MongoDB).

| Variable | Project | Default | Description |
| --- | --- | --- | --- |
| `PRIVATE_KEY` | both | required | HS256 key, >= 32 chars, **identical in both projects**. |
| `MONGO_URI` | auth-service | required | MongoDB connection string, database `cap_event_auth`. |
| `TCP_HOST` / `TCP_PORT` | auth-service | `127.0.0.1` / `4001` | TCP listener. |
| `ACCESS_TOKEN_TTL_SECONDS` | auth-service | `3600` | Access and id token lifetime. |
| `REFRESH_TOKEN_TTL_SECONDS` | auth-service | `2592000` | Refresh token lifetime (30 d). |
| `AUTH_CODE_TTL_SECONDS` | auth-service | `120` | Authorization code lifetime. |
| `BCRYPT_ROUNDS` | auth-service | `10` | bcrypt cost. |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` | auth-service | unset / unset / `Demo User` | Demo user created on startup if missing (idempotent). Password min 8 chars. |
| `PORT` | api-gateway | `4000` | Public HTTP port. |
| `PUBLIC_URL` | api-gateway | `http://localhost:<PORT>` | Used for the OIDC `issuer` (`<PUBLIC_URL>/oidc/2`). |
| `CLIENT_URL` | api-gateway | `http://localhost:3000` | CORS origin(s), comma separated. |
| `CLIENT_ID` | api-gateway | required | The one accepted `client_id`. |
| `ALLOWED_REDIRECT_URIS` | api-gateway | `http://localhost:3000/cap-event/auth/callback` | Exact-match redirect URIs, comma separated. |
| `AUTH_SERVICE_HOST` / `AUTH_SERVICE_PORT` | api-gateway | `127.0.0.1` / `4001` | Where auth-service listens. |

## Running

Requires Node 24 and npm.

```bash
npm run install:all          # contracts first, then each project (or run npm install in each folder)
# create auth-service/.env and api-gateway/.env from the .env.example files (MONGO_URI is mandatory)
npm run start:auth           # terminal 1  (auth-service :4001)
npm run start:gateway        # terminal 2  (api-gateway :4000)
```

Swagger UI: <http://localhost:4000/docs>, OpenAPI JSON: <http://localhost:4000/docs-json>.

Without the root scripts: `npm run start:dev` inside `auth-service/` and `api-gateway/`.

## Scripts

| Command | What |
| --- | --- |
| `npm run build` | Build both services. |
| `npm run lint` | ESLint (no auto-fix) in both services. Inside a project `npm run lint` auto-fixes. |
| `npm test` | Unit tests of both services. |
| `npm run test:e2e` | End-to-end test (plain Node `node:test` + ts-node, not jest: the MongoDB driver cannot handshake inside jest's VM sandbox. Starts an in-memory MongoDB; first run downloads a `mongod` binary into `e2e/node_modules/.cache`; binds random ports, never 4000/4001). |
| `npm run openapi:export` | Writes `api-gateway/openapi/auth.json` (needs no database or running service). Commit it when the API changes. |

## Pointing cap-event-ui at it

`cap-event-ui/src/utils/oneloginAuth.ts` builds the provider URL as `https://<subdomain>.onelogin.com/oidc/2/...`
(hard-coded scheme and domain). To use this local provider the UI needs a small change: an optional base-URL
override, for example

```ts
const baseUrl = process.env.NEXT_PUBLIC_ONELOGIN_BASE_URL ?? (region === 'eu' ? `https://${config.subdomain}.onelogin.eu` : `https://${config.subdomain}.onelogin.com`);
```

used in `getOneLoginAuthUrl`, `exchangeCodeForToken`, `refreshAccessToken` and `logout.ts`. Then the UI `.env` values are:

```
NEXT_PUBLIC_ONELOGIN_BASE_URL=http://localhost:4000
NEXT_PUBLIC_ONELOGIN_SUBDOMAIN=local
NEXT_PUBLIC_ONELOGIN_REGION=us
NEXT_PUBLIC_ONELOGIN_CLIENT_ID=cap-event-ui
NEXT_PUBLIC_ONELOGIN_REDIRECT_URI=http://localhost:3000/cap-event/auth/callback
NEXT_PUBLIC_ONELOGIN_SCOPE=cap-event
NEXT_PUBLIC_ONELOGIN_RESOURCE=http://localhost:4000
```

(`SUBDOMAIN` is only required to be non-empty by the current UI code; `SCOPE` and `RESOURCE` are accepted and not
enforced by this fake provider.) Gateway side: `CLIENT_ID=cap-event-ui`, `CLIENT_URL=http://localhost:3000`,
`ALLOWED_REDIRECT_URIS=http://localhost:3000/cap-event/auth/callback`.

## Not included (yet)

Rate limiting / lockout on the login form, SSO session cookies (so `prompt=login` is a no-op), JWKS / asymmetric
signing (HS256 with a shared key, as in the sandbox), docker-compose, CI. Dev tooling currently reports `npm audit`
advisories in `@nestjs/cli` / jest transitive dependencies (no runtime dependency is affected).
