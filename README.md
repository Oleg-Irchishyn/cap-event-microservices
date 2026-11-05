# cap-event — Microservices

Node.js backend for [cap-event-ui](../cap-event-ui), replacing the old Java + OpenAPI backend. Two independent [NestJS](https://nestjs.com) 11 projects talking over TCP: an **api-gateway** (the only public HTTP surface, Swagger/OpenAPI, JWT verification) and an **auth-service** (users, authorization codes and refresh tokens in MongoDB via Mongoose, signs JWTs). First slice: a **fake OneLogin (OIDC)**, so the UI keeps its existing Authorization Code + PKCE flow and only needs a different base URL. The gateway's OpenAPI document (`/docs`, `/docs-json`, `api-gateway/openapi/auth.json`) is the contract for the UI. More services are planned (see [Roadmap](#roadmap)) because the UI's `.env` already expects `/api/v1/<name>` routes for each. Unit tests: Jest. E2E: `node:test` + supertest + mongodb-memory-server.

This is a local-development backend, not a hardened identity provider; see [Known limitations](#known-limitations). Not deployed anywhere.

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
                                                                     MongoDB (Atlas)  db `cap_event_auth`
                                                                     users / auth_codes / refresh_tokens
```

| Folder          | What it is                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `api-gateway/`  | The only public HTTP surface. No database. Swagger, class-validator DTOs, `ClientsModule` to auth-service, `JwtGuard`.  |
| `auth-service/` | Pure TCP microservice (no HTTP listener). Owns MongoDB. The only place that signs tokens.                               |
| `contracts/`    | Shared package `@cap-event/contracts` (message patterns, payload types, token claims). Linked via `file:../contracts`. |
| `e2e/`          | One end-to-end test: boots both services in-process against `mongodb-memory-server`.                                    |

Each of `api-gateway`, `auth-service`, `e2e` has its own `package.json` / `node_modules`. Shared types live in `contracts/` instead of being copy-pasted. Conventions are taken from `spotify-clone/microservices`: `toHttpException` util, `RpcException({ status, message })`, `@MessagePattern('domain.action')`, `JwtGuard` verifying with the shared `PRIVATE_KEY`, per-service Mongoose DB, `ConfigModule`, class-validator DTOs with custom messages.

### Ports

| Service      | Default | Public?                                  |
| ------------ | ------- | ---------------------------------------- |
| api-gateway  | `4000`  | yes                                      |
| auth-service | `4001`  | no (TCP, bound to 127.0.0.1 by default)  |

### Message patterns (auth-service)

`auth.register`, `auth.login`, `auth.validate-credentials`, `auth.code.issue`, `auth.token.exchange`, `auth.token.refresh`, `auth.me`, `auth.logout`. Defined once in `contracts/src/index.ts` (`AuthPattern`).

## The login flow

| # | Step | Gateway endpoint | TCP pattern(s) |
| --- | --- | --- | --- |
| 1 | Show the form | `GET /oidc/2/auth` | none (validates `client_id` / `redirect_uri` locally) |
| 2 | Submit the form, get a code | `POST /oidc/2/auth` | `auth.validate-credentials` (or `auth.register`), then `auth.code.issue` |
| 3 | Exchange the code for tokens | `POST /oidc/2/token` (`authorization_code`) | `auth.token.exchange` |
| 4 | Call the API with the Bearer JWT | e.g. `GET /api/v1/auth/me` | none for verification; `auth.me` for the user lookup |
| 5 | Refresh | `POST /oidc/2/token` (`refresh_token`) | `auth.token.refresh` |
| 6 | Logout | `GET /oidc/2/logout` | `auth.logout` |

1. UI redirects the browser to `GET /oidc/2/auth?client_id&redirect_uri&response_type=code&scope&state&resource&code_challenge&code_challenge_method=S256[&nonce][&prompt=login]`. The gateway checks `client_id` and the **exact** `redirect_uri` allow-list; an unknown client or URI renders an error page and never redirects. Other request errors (wrong `response_type`, missing or malformed PKCE challenge) redirect back to the `redirect_uri` with `error=...`. Otherwise it renders a minimal HTML form (sign in; `mode=register` shows "create account"). All reflected values are HTML-escaped and the page is sent with a strict CSP. There is no SSO session, so the form is always shown (`prompt=login` is accepted and is a no-op).
2. `POST /oidc/2/auth` verifies the credentials (or registers) via auth-service, which stores a one-time **authorization code** (hashed, bound to client, redirect_uri, PKCE challenge, nonce and user; TTL 2 min). The gateway answers `302 redirect_uri?code=...&state=...`. Bad credentials re-render the form with an error (401; 400 for invalid input, 409 for a duplicate email).
3. The UI calls `POST /oidc/2/token` (form-urlencoded; CORS allowed for `CLIENT_URL`) with `grant_type=authorization_code`, `client_id`, `code`, `redirect_uri`, `code_verifier`. auth-service atomically deletes the code first (single use, even on failure), then checks expiry, client, redirect_uri and PKCE S256. Response: `{ access_token, token_type: "Bearer", expires_in, refresh_token, id_token }`. Errors are RFC 6749 shaped: `{ error, error_description }` (`400`, or `401 invalid_client` for an unknown `client_id`).
4. API calls send `Authorization: Bearer <access_token>`. The gateway's `JwtGuard` verifies the HS256 JWT itself with the shared **`PRIVATE_KEY`** (signature, issuer, audience = `CLIENT_ID`, `token_use=access`; id tokens are rejected) with no round-trip to auth-service.
5. `POST /oidc/2/token` with `grant_type=refresh_token`, `client_id`, `refresh_token`: the token is consumed and a new one issued (**rotation**); reusing the old one gives `invalid_grant`.
6. `GET /oidc/2/logout?id_token_hint&post_logout_redirect_uri[&state]` verifies the id token hint (expired is fine, forged is not), revokes all of that user's refresh tokens and redirects to the post-logout URI, which must be on an allowed origin (origins of `ALLOWED_REDIRECT_URIS` and `CLIENT_URL`). An invalid hint is ignored (nothing to revoke) and the redirect still happens. Access tokens already issued stay valid until they expire (no revocation list).

Also: `GET /oidc/2/.well-known/openid-configuration` (discovery) and the JSON endpoints `POST /api/v1/auth/registration` (register + login, `201`), `POST /api/v1/auth/login` (`auth.login`), `GET /api/v1/auth/me` (Bearer).

Tokens: access token (1h by default) and id token are HS256 JWTs with `sub`, `email`, `name`, `iss`, `aud`, `token_use`. The issuer is `<PUBLIC_URL>/oidc/2`. Refresh tokens and auth codes are opaque random values; only their SHA-256 is stored.

## Local setup

```bash
git clone https://github.com/Oleg-Irchishyn/cap-event-microservices.git
cd cap-event-microservices
npm run install:all                          # contracts first, then auth-service, api-gateway, e2e
cp auth-service/.env.example auth-service/.env   # fill in MONGO_URI and PRIVATE_KEY (+ optional SEED_USER_*)
cp api-gateway/.env.example api-gateway/.env     # same PRIVATE_KEY; CLIENT_ID=cap-event-ui
npm run start:auth                           # terminal 1: auth-service, TCP :4001
npm run start:gateway                        # terminal 2: api-gateway, http://localhost:4000 (docs at /docs)
```

Requires Node.js 24 (what the project is developed and typed against; there is no `.nvmrc` / `engines` pin), npm, and a MongoDB database (see [MongoDB](#mongodb)). Start auth-service first; both processes exit at startup if their required env vars are missing. There is no Docker setup: the database is MongoDB Atlas and both services run natively.

## MongoDB

auth-service uses one MongoDB Atlas database, **`cap_event_auth`**, with collections `users`, `auth_codes` and `refresh_tokens` (created on first use). Put the database name in the path of `MONGO_URI` (`...mongodb.net/cap_event_auth?appName=...`).

- Atlas **Network Access** must allow your current IP, otherwise auth-service hangs or fails on connect.
- **Never commit `MONGO_URI`** (it contains the password) or paste it into chats or issues. `.env` files are gitignored; only `.env.example` files with placeholders are tracked. If it leaks, rotate the database user's password in Atlas.
- The e2e test does not need Atlas: it uses an in-memory MongoDB.

## Environment variables

Copy each `.env.example` to `.env` (gitignored) and fill it in.

**Shared**

| Key | Notes |
| --- | --- |
| `PRIVATE_KEY` | Required in **both** projects, at least 32 chars, **identical** in both. HS256 signing key (auth-service) and verification key (gateway). A mismatch makes every Bearer call return 401. |

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**auth-service**

| Key | Default | Notes |
| --- | --- | --- |
| `MONGO_URI` | required | Connection string, database `cap_event_auth`. Startup fails without it. |
| `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `4001` | TCP listener. Keep it local: there is no auth on this socket. |
| `ACCESS_TOKEN_TTL_SECONDS` | `3600` | Access and id token lifetime. |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | Refresh token lifetime (30 d). |
| `AUTH_CODE_TTL_SECONDS` | `120` | Authorization code lifetime. |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost. |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` | unset / unset / `Demo User` | Demo user created on startup if missing (idempotent; seeding is skipped unless email and password are both set). Password min 8 chars. |

**api-gateway**

| Key | Default | Notes |
| --- | --- | --- |
| `CLIENT_ID` | required | The one accepted `client_id`; must equal the UI's `NEXT_PUBLIC_ONELOGIN_CLIENT_ID`. Also the JWT audience. |
| `PORT` | `4000` | Public HTTP port. |
| `PUBLIC_URL` | `http://localhost:<PORT>` | Used for the OIDC `issuer` (`<PUBLIC_URL>/oidc/2`) and discovery. Tokens carry it as `iss`, so changing it invalidates existing tokens. |
| `CLIENT_URL` | `http://localhost:3000` | CORS origin(s), comma separated. Must match the browser's `Origin` exactly (no path, no trailing slash). |
| `ALLOWED_REDIRECT_URIS` | `http://localhost:3000/cap-event/auth/callback` | Exact-match redirect URIs, comma separated. |
| `AUTH_SERVICE_HOST` / `AUTH_SERVICE_PORT` | `127.0.0.1` / `4001` | Where auth-service listens. |

## Login with the UI

[cap-event-ui](../cap-event-ui) already supports a local provider through `NEXT_PUBLIC_ONELOGIN_BASE_URL` (it overrides `https://<subdomain>.onelogin.com`). Use these values in the UI's `.env`:

```bash
NEXT_PUBLIC_HOSTNAME=http://localhost:4000
NEXT_PUBLIC_ONELOGIN_BASE_URL=http://localhost:4000
NEXT_PUBLIC_ONELOGIN_CLIENT_ID=cap-event-ui
NEXT_PUBLIC_ONELOGIN_SUBDOMAIN=local          # any non-empty value when BASE_URL is set
NEXT_PUBLIC_ONELOGIN_REDIRECT_URI=http://localhost:3000/cap-event/auth/callback
NEXT_PUBLIC_ONELOGIN_RESOURCE=http://localhost:4000
NEXT_PUBLIC_ONELOGIN_SCOPE=custom:capevent
```

`SCOPE` and `RESOURCE` are accepted and echoed but not enforced by this provider. Gateway side must agree: `CLIENT_ID=cap-event-ui`, `CLIENT_URL=http://localhost:3000`, `ALLOWED_REDIRECT_URIS=http://localhost:3000/cap-event/auth/callback` (these match the defaults in `api-gateway/.env.example`).

**Demo credentials (local use only).** Add these to `auth-service/.env` (never to a tracked file) and the user is created at startup:

```bash
SEED_USER_EMAIL=demo@cap-event.local
SEED_USER_PASSWORD=Demo12345!
SEED_USER_NAME=Demo User
```

Then sign in on the form with `demo@cap-event.local` / `Demo12345!`. These are throwaway local-dev credentials; the real `.env` files are gitignored. You can also click "create account" on the form, or `POST /api/v1/auth/registration`.

## Commands

```bash
npm run install:all                     # install contracts + every project
npm run start:auth / start:gateway      # dev servers with watch (auth-service :4001 / api-gateway :4000)
npm run build                           # build both services
npm run lint                            # ESLint, check only (inside a project, `npm run lint` auto-fixes)
npm run test                            # unit tests of both services (Jest)
npm run test:e2e                        # end-to-end test (see Tests)
npm run openapi:export                  # write api-gateway/openapi/auth.json (no database or running service needed)
```

Inside `api-gateway/` and `auth-service/` there are also `start:prod` (`node dist/main`, after `build`), `test:cov` and `format`.

### Verifying with curl

```bash
curl http://localhost:4000/oidc/2/.well-known/openid-configuration     # discovery document
curl -i -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cap-event.local","password":"Demo12345!"}'         # JSON login (needs the seed user)
curl http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer <access_token>"
```

PKCE walk-through (bash; mirrors what the UI does, not run as part of the test suite):

```bash
REDIRECT=http://localhost:3000/cap-event/auth/callback
VERIFIER=$(openssl rand -hex 32)                                        # 64 chars, valid RFC 7636 verifier
CHALLENGE=$(printf %s "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')

# 1-2. submit the form; the 302 Location carries the code
LOCATION=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST http://localhost:4000/oidc/2/auth \
  --data-urlencode "mode=login" --data-urlencode "email=demo@cap-event.local" --data-urlencode "password=Demo12345!" \
  --data-urlencode "client_id=cap-event-ui" --data-urlencode "redirect_uri=$REDIRECT" \
  --data-urlencode "response_type=code" --data-urlencode "state=xyz" \
  --data-urlencode "code_challenge=$CHALLENGE" --data-urlencode "code_challenge_method=S256")
CODE=$(printf %s "$LOCATION" | sed -E 's/.*[?&]code=([^&]+).*/\1/')

# 3. exchange the code (single use)
curl -X POST http://localhost:4000/oidc/2/token \
  --data-urlencode "grant_type=authorization_code" --data-urlencode "client_id=cap-event-ui" \
  --data-urlencode "code=$CODE" --data-urlencode "redirect_uri=$REDIRECT" --data-urlencode "code_verifier=$VERIFIER"
```

## API docs

Swagger UI: <http://localhost:4000/docs>, raw OpenAPI JSON: <http://localhost:4000/docs-json>. It lives only on the gateway; auth-service has no HTTP, so there is nothing for Swagger to describe there (its API is the `auth.*` TCP patterns).

`npm run openapi:export` writes `api-gateway/openapi/auth.json` without a database or running service. Commit it when the API changes. The plan is to feed this file into cap-event-ui's API client generation (the same way its existing generated clients are produced), so the UI's auth client is generated from the gateway's contract instead of hand-written. Not wired up yet.

## Tests

- **Unit** (`npm test`): Jest in `auth-service` and `api-gateway`, specs under `src/**/__tests__`.
- **E2E** (`npm run test:e2e`): plain Node `node:test` + ts-node, not Jest, because the MongoDB driver cannot handshake inside Jest's VM sandbox. Boots both services in-process against `mongodb-memory-server`; the first run downloads a `mongod` binary into `e2e/node_modules/.cache`; binds random ports, never 4000/4001. The spec is `e2e/test/oidc-flow.e2e.test.ts`.

## Known limitations

- No SSO session cookie, so `prompt=login` is a no-op and the form is always shown.
- No rate limiting or lockout on the login form or token endpoint.
- HS256 with a key shared between gateway and auth-service; no JWKS and no asymmetric signing, so any holder of `PRIVATE_KEY` can mint tokens.
- Logout revokes refresh tokens only; issued access tokens live until expiry.
- No CI. Dev tooling currently reports `npm audit` advisories in `@nestjs/cli` / jest transitive dependencies (no runtime dependency is affected).

## Roadmap

The UI's `.env` expects `/api/v1/<name>` routes for four more services, to be added behind the same gateway (each owning its own data, verified by the same `JwtGuard`):

- `cap-event-package` (`NEXT_PUBLIC_CAP_EVENT_PACKAGE_API=/cap-event-package`)
- `reference-data` (`/reference-data`)
- `template-library` (`/template-library`)
- `box-connector` (`/box-connector`)

Also planned: generating the UI's auth client from `api-gateway/openapi/auth.json`, and asymmetric signing with JWKS if this ever outgrows local development.
