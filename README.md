# cap-event — Microservices

Node.js backend for [cap-event-ui](../cap-event-ui), replacing the old Java + OpenAPI backend. Four independent [NestJS](https://nestjs.com) 11 projects talking over TCP, plus a shared contracts package:

- **api-gateway** (the only public HTTP surface: Swagger, JWT verification, validation, error translation),
- **auth-service** (users, authorization codes, refresh tokens; signs JWTs) - a **fake OneLogin (OIDC)**, so the UI keeps its Authorization Code + PKCE flow,
- **reference-data-service** (sponsors, fund groups, entities, chart of accounts, investments, allocation bases, journal entries, ...: seeded, read-only),
- **cap-event-package-service** (capital events: draft -> submitted lifecycle in MongoDB, plus a **simulated** allocation / management-fee engine).

The API of the two business services is **contract-first**: the OpenAPI specs the UI's API clients were generated from are copied into `contracts/openapi/` and are the source of truth; TypeScript types are generated from them and a contract test validates every operation through the real gateway. Unit tests: Jest. E2E: `node:test` + supertest + mongodb-memory-server.

This is a local-development backend, not a hardened identity provider and not the real business engine; see [Known limitations](#known-limitations). Not deployed anywhere.

## Architecture

```
 Browser (cap-event-ui, :3000)
        |  HTTP, Bearer JWT + Session-Id header (the only public surface)
        v
 +--------------------------------------+
 | api-gateway                    :4000 |
 |  /oidc/2/*                fake OneLogin
 |  /api/v1/auth/*           JSON auth API
 |  /api/v1/reference-data/*      (JwtGuard)
 |  /api/v1/cap-event-package/*   (JwtGuard)
 |  Swagger /docs, ErrorResponse filter |
 +---+----------------+-----------------+----------------+
     | TCP auth.*     | TCP reference-data.*             | TCP cap-events.*
     v                v                                  v
 +--------------+  +-----------------------+   +--------------------------------+
 | auth-service |  | reference-data-service|<--| cap-event-package-service      |
 |        :4001 |  |                 :4002 |TCP|                          :4003 |
 | users, codes,|  | seeded read-only data |   | cap events (draft/submitted),  |
 | refresh, JWT |  | + journal entries     |   | SIMULATED allocation + mgmt fee|
 +------+-------+  +----------+------------+   +---------------+----------------+
        | Mongoose            | Mongoose                       | Mongoose
        v                     v                                v
   cap_event_auth    cap_event_reference_data           cap_event_package
        (one MongoDB Atlas cluster / three databases, one per service)
```

`PRIVATE_KEY` is shared by the gateway (verifies) and auth-service (signs).

| Folder | What it is |
| --- | --- |
| `api-gateway/` | The only public HTTP surface. No database. Swagger, class-validator DTOs, `ClientsModule` to the three services, `JwtGuard`, `ErrorResponse`-shaped errors on the spec routes. |
| `auth-service/` | Pure TCP microservice. Owns `cap_event_auth`. The only place that signs tokens. |
| `reference-data-service/` | Pure TCP microservice. Owns `cap_event_reference_data`; seeds it idempotently on startup. |
| `cap-event-package-service/` | Pure TCP microservice. Owns `cap_event_package`; calls reference-data-service over TCP for management-fee journal entries and allocation bases. |
| `contracts/` | Shared package `@cap-event/contracts`: message patterns, payload types, token claims, the OpenAPI specs (`openapi/`) and the types generated from them (`src/generated/`). Linked via `file:../contracts`. |
| `e2e/` | End-to-end tests: boot all four processes in-process against `mongodb-memory-server`. |

Each of `api-gateway`, the three services and `e2e` has its own `package.json` / `node_modules`. Shared types live in `contracts/` instead of being copy-pasted. Conventions are taken from `spotify-clone/microservices`: `toHttpException` util, `RpcException({ status, message })`, `@MessagePattern('domain.action')`, per-service Mongoose DB, `ConfigModule` env validation, class-validator DTOs with custom messages.

### Ports

| Process | Default | Public? |
| --- | --- | --- |
| api-gateway | `4000` | yes |
| auth-service | `4001` | no (TCP, 127.0.0.1) |
| reference-data-service | `4002` | no (TCP, 127.0.0.1) |
| cap-event-package-service | `4003` | no (TCP, 127.0.0.1) |

### Message patterns

Defined once in `contracts/src` (`AuthPattern`, `ReferenceDataPattern`, `CapEventPackagePattern`).

- auth-service: `auth.register`, `auth.login`, `auth.validate-credentials`, `auth.code.issue`, `auth.token.exchange`, `auth.token.refresh`, `auth.me`, `auth.logout`.
- reference-data-service: `reference-data.{fund-groups.search, entities.by-fund-group, accounts.list, accounts.mapped, queries.list, queries.execute, investments.list, sponsors.list, journal-entries.mgmt-fee, journal-entries.mgmt-fee-line-items, journal-entries.total-amount, journal-entries.list, allocation-bases.list, investor-attributes.get}`.
- cap-event-package-service: `cap-events.{types, list, get, create-draft, update, submit, delete, process, line-items.allocate, line-items.mgmt-fees, journal-entries.mgmt-fee, journal-entries.mgmt-fee-allocate, fund-group.allocate, investors.document}`.

### Contract-first workflow

`contracts/openapi/{referenceData,capEventPackage,common}.json` are copies of `cap-event-ui/src/api/openapi/*` (see `contracts/openapi/README.md`). When the UI repo changes a spec: copy it over, `npm run generate:contracts` (openapi-typescript -> `contracts/src/generated/*.ts`), fix the compile errors in the gateway DTOs (they `implements` the generated types) and services, and run `npm run test:e2e`. The contract test (`e2e/test/contract.e2e.test.ts`) fails if an operation is missing, returns an undocumented status or a body that does not match the spec schema.

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
npm run install:all                                       # contracts first, then every project
for p in auth-service reference-data-service cap-event-package-service api-gateway; do
  cp $p/.env.example $p/.env                              # then fill in MONGO_URI / PRIVATE_KEY (see below)
done
npm run start:auth                                        # terminal 1: auth-service,             TCP :4001
npm run start:reference-data                              # terminal 2: reference-data-service,   TCP :4002 (seeds on startup)
npm run start:cap-event-package                           # terminal 3: cap-event-package-service, TCP :4003
npm run start:gateway                                     # terminal 4: api-gateway, http://localhost:4000 (docs at /docs)
```

Requires Node.js 24, npm and a MongoDB database (see [MongoDB](#mongodb)). Start the three services first (cap-event-package-service needs reference-data-service for management-fee data); every process exits at startup if its required env vars are missing. There is no Docker setup: the database is MongoDB Atlas and everything runs natively.

## MongoDB

One MongoDB Atlas cluster, **one database per service** (the database name is the path of that service's `MONGO_URI`; the variable is called `MONGO_URI` in each service's own `.env`):

| Service | Database | Collections |
| --- | --- | --- |
| auth-service | `cap_event_auth` | `users`, `auth_codes`, `refresh_tokens` |
| reference-data-service | `cap_event_reference_data` | `sponsors`, `fund_groups`, `entities`, `accounts`, `mapped_accounts`, `queries`, `investments`, `allocation_bases`, `journal_entries`, `investor_attributes` |
| cap-event-package-service | `cap_event_package` | `cap_events` |

- Atlas **Network Access** must allow your current IP, otherwise a service hangs or fails on connect.
- **Never commit `MONGO_URI`** (it contains the password) or paste it into chats or issues. `.env` files are gitignored; only `.env.example` files with placeholders are tracked. If it leaks, rotate the database user's password in Atlas.
- The e2e tests do not need Atlas: they use an in-memory MongoDB.

## Environment variables

Copy each `.env.example` to `.env` (gitignored) and fill it in.

**Shared**

| Key | Notes |
| --- | --- |
| `PRIVATE_KEY` | Required in **both** auth-service and api-gateway, at least 32 chars, **identical**. HS256 signing key (auth-service) and verification key (gateway). A mismatch makes every Bearer call return 401. The two new services do not need it. |

Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**auth-service**

| Key | Default | Notes |
| --- | --- | --- |
| `MONGO_URI` | required | Connection string, database `cap_event_auth`. |
| `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `4001` | TCP listener. Keep it local: there is no auth on this socket. |
| `ACCESS_TOKEN_TTL_SECONDS` | `3600` | Access and id token lifetime. |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | Refresh token lifetime (30 d). |
| `AUTH_CODE_TTL_SECONDS` | `120` | Authorization code lifetime. |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost. |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` | unset / unset / `Demo User` | Demo user created on startup if missing (seeding is skipped unless email and password are both set). Password min 8 chars. |

**reference-data-service**

| Key | Default | Notes |
| --- | --- | --- |
| `MONGO_URI` | required | Connection string, database `cap_event_reference_data`. |
| `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `4002` | TCP listener (gateway and cap-event-package-service connect here). |

**cap-event-package-service**

| Key | Default | Notes |
| --- | --- | --- |
| `MONGO_URI` | required | Connection string, database `cap_event_package`. |
| `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `4003` | TCP listener (only the gateway connects). |
| `REFERENCE_DATA_HOST` / `REFERENCE_DATA_PORT` | `127.0.0.1` / `4002` | Where reference-data-service listens. |

**api-gateway**

| Key | Default | Notes |
| --- | --- | --- |
| `CLIENT_ID` | required | The one accepted `client_id`; must equal the UI's `NEXT_PUBLIC_ONELOGIN_CLIENT_ID`. Also the JWT audience. |
| `PRIVATE_KEY` | required | See Shared. |
| `PORT` | `4000` | Public HTTP port. |
| `PUBLIC_URL` | `http://localhost:<PORT>` | OIDC `issuer` (`<PUBLIC_URL>/oidc/2`) and discovery. Changing it invalidates existing tokens. |
| `CLIENT_URL` | `http://localhost:3000` | CORS origin(s), comma separated. Must match the browser's `Origin` exactly. Allowed request headers: `Content-Type`, `Authorization`, `Session-Id`, `Accept`. |
| `ALLOWED_REDIRECT_URIS` | `http://localhost:3000/cap-event/auth/callback` | Exact-match redirect URIs, comma separated. |
| `AUTH_SERVICE_HOST` / `AUTH_SERVICE_PORT` | `127.0.0.1` / `4001` | auth-service. |
| `REFERENCE_DATA_SERVICE_HOST` / `REFERENCE_DATA_SERVICE_PORT` | `127.0.0.1` / `4002` | reference-data-service. |
| `CAP_EVENT_PACKAGE_SERVICE_HOST` / `CAP_EVENT_PACKAGE_SERVICE_PORT` | `127.0.0.1` / `4003` | cap-event-package-service. |

## Login with the UI

[cap-event-ui](../cap-event-ui) already supports a local provider through `NEXT_PUBLIC_ONELOGIN_BASE_URL` (it overrides `https://<subdomain>.onelogin.com`). Use these values in the UI's `.env`:

```bash
NEXT_PUBLIC_HOSTNAME=http://localhost:4000
NEXT_PUBLIC_BASE_URL=/api/v1
NEXT_PUBLIC_CAP_EVENT_PACKAGE_API=/cap-event-package
NEXT_PUBLIC_REFERENCE_DATA_API=/reference-data
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
npm run start:auth | start:reference-data | start:cap-event-package | start:gateway   # dev servers with watch
npm run build                           # build the four Nest projects
npm run lint                            # ESLint, check only (inside a project, `npm run lint` auto-fixes)
npm run test                            # unit tests of the four projects (Jest)
npm run test:e2e                        # end-to-end tests (see Tests)
npm run generate:contracts              # regenerate contracts/src/generated from contracts/openapi
npm run openapi:export                  # write api-gateway/openapi/*.json (no database or running service needed)
```

Inside each Nest project there are also `start:prod` (`node dist/main`, after `build`), `test:cov` and `format`.

### Verifying with curl

```bash
curl http://localhost:4000/oidc/2/.well-known/openid-configuration     # discovery document
curl -i -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cap-event.local","password":"Demo12345!"}'         # JSON login (needs the seed user)
TOKEN=<access_token from the login response>
curl http://localhost:4000/api/v1/reference-data/sponsors -H "Authorization: Bearer $TOKEN"
curl "http://localhost:4000/api/v1/cap-event-package/cap-events?statuses=DRAFT&statuses=SUBMITTED" -H "Authorization: Bearer $TOKEN"
```

The PKCE walk-through for the OIDC flow is unchanged (see the login flow above; `e2e/test/helpers/stack.ts` contains a scripted version).

## API docs

Swagger UI: <http://localhost:4000/docs>, raw OpenAPI JSON: <http://localhost:4000/docs-json>. It lives only on the gateway; the services have no HTTP (their API is the TCP patterns above).

`npm run openapi:export` writes `api-gateway/openapi/gateway.json` (everything), `auth.json`, `reference-data.json` and `cap-event-package.json` without a database or running service. Commit them when the API changes. The reference-data / cap-event-package routes are derived from the specs in `contracts/openapi`; the gateway's DTOs `implements` the generated types, so drift fails the build.

## Tests

- **Unit** (`npm test`): Jest in the four Nest projects, specs under `src/**/__tests__` (controllers, services, seed data, simulation, DTO validation, filters).
- **E2E** (`npm run test:e2e`): plain Node `node:test` + ts-node, not Jest, because the MongoDB driver cannot handshake inside Jest's VM sandbox. Both files boot the real apps in-process against `mongodb-memory-server` (the first run downloads a `mongod` binary into `e2e/node_modules/.cache`; random ports, never 4000-4003).
  - `e2e/test/oidc-flow.e2e.test.ts`: the OIDC flow (auth-service + gateway).
  - `e2e/test/contract.e2e.test.ts`: all four processes. Logs in through the real Authorization Code + PKCE flow, then calls **every one of the 28 operations** of `referenceData.json` and `capEventPackage.json` through the gateway with UI-shaped requests (repeated query keys, `Session-Id`, `investment: null`, ...) and validates status and body with Ajv against the spec's response schema. Also: documented error responses (401/400/404) against `ErrorResponse`, CORS preflight for `Authorization` + `Session-Id`, seed idempotency, per-service databases, and a self-check that the validator rejects bad bodies. Spec quirks handled by the validator (`e2e/test/helpers/openapi-validator.ts`): siblings of `$ref` are ignored (OpenAPI 3.0), `required` names that are not declared properties are dropped, `format: binary` is accepted.

## Reference data and cap-event routes

All routes need `Authorization: Bearer <access token>` (`JwtGuard`) and accept (and ignore) the `Session-Id` header. Base paths match the UI (`NEXT_PUBLIC_HOSTNAME` + `/api/v1` + `/reference-data` | `/cap-event-package`). Errors use the specs' `ErrorResponse` shape (`reason`, `message`, `details`, `timestamp`, `requestId`).

**`/api/v1/reference-data`** (referenceData.json, 14 operations)

| Method and path | Operation | UI use |
| --- | --- | --- |
| `GET /sponsors` | getSponsors | new cap event: sponsor dropdown |
| `GET /fund-groups/search?sponsorId` | searchFundGroupsBySponsor | fund group dropdown after picking a sponsor |
| `GET /fund-groups/{fundGroupId}/entities?statuses&typesToExclude` | getEntitiesByFundGroup | entities of the fund group (UI sends ACTIVE, excludes ADMIN/ELIMINATION) |
| `GET /accounts?sponsorId&fsGroupings&capitalCategories` | getAccounts | line item tables (Capital accounts; all accounts for "Other") |
| `GET /accounts/mapped/{id}` | getMappedAccount | - (not called by the UI today) |
| `GET /queries`, `GET /queries/{queryId}/filters?<args>` | getAllQueries, executeQuery | - |
| `GET /investments` | getInvestments | investment dropdown |
| `GET /allocation-bases` | getAllocationBases | allocation basis dropdowns (UI keeps the Active ones) |
| `GET /journal-entries/mgmt-fee`, `/journal-entries/mgmt-fee/line-items`, `/journal-entries/entities/total-amount`, `/journal-entries` | journal entry operations | - (the UI reads management fees through cap-event-package) |
| `GET /investor-attributes?investorId&entityId` | getInvestorAttributes | - |

**`/api/v1/cap-event-package/cap-events`** (capEventPackage.json, 14 operations)

| Method and path | Operation | UI use |
| --- | --- | --- |
| `GET /types` | getCapEventTypes | event type dropdown |
| `GET /?sponsorId&statuses` | getCapEventList | main page table |
| `POST /draft` | createDraft | "Save Draft" button |
| `POST /` | submit | "Save" on the preview screen (expects `status: SUBMITTED`) |
| `GET /{id}`, `POST /{id}`, `DELETE /{id}` | get / update / delete | - (DRAFT only for update/delete) |
| `POST /process` | process | preview screen: aggregated investor rows |
| `POST /line-items/allocate` | allocateLineItem | preview screen and allocation modal |
| `POST /fund-group/allocate` | allocateEntities | "Apply" of fund group line items |
| `GET /journal-entries/mgmt-fee?entityIds` | getMgmtFeeJournalEntries | management fee dropdown per entity |
| `GET /line-items/mgmt-fees?batchNo&entityId` | getMgmtFeeLineItems | selecting a management fee batch |
| `GET /journal-entries/mgmt-fee/allocate?...` | getAllocatedMgmtFeeJournalEntries | allocation of management fee lines |
| `POST /investors/document` | investorDocumentContent | notice preview modal (placeholder PDF) |

## Data and behaviour

**Seed data** (reference-data-service, upserted by natural key on every startup, deterministic): 5 sponsors (`1` "Golden Dev Test" ... `5` "Harborview Credit Advisors", one in ONBOARDING_TRANSITION), 10 fund groups (`FG001`..`FG010`, two per sponsor), 40 entities (`73301-01`...; per fund group three FUND entities, every second group also an ADMIN and an ELIMINATION entity, one INACTIVE feeder in every third group, so the entity filters of the UI do something), 19 accounts per sponsor (the capital categories the UI knows, inside/outside commitment variants, plus asset, liability, income and expense accounts) with mappings to a receivable account, 6 allocation bases (the five ids the UI hard-codes plus an Inactive one), 10 investments, 4 saved queries, 4 quarterly management fee batches per active fund entity (two called, two uncalled; each a header entry plus two GL lines that add up to it) and investor attributes for 8 demo investors per entity. Cap events are **not** seeded: the list starts empty and fills as you save from the UI.

**Cap event lifecycle** (cap-event-package-service): `createDraft` -> status `DRAFT`; `update` and `delete` only while `DRAFT`; `submit` creates a `SUBMITTED` event or promotes the `DRAFT` with the same id (needs at least one entity line item) and stores the aggregated line items (computed if the client sent none); `SUBMITTED` is immutable. `POSTED` exists in the spec but no operation reaches it. `createdBy` / `modifiedBy` are the e-mail of the JWT. `null` values from the UI are stored as absent.

**The allocation and management fee logic is a simulation, a stand-in for the real business rules.** Each entity gets a deterministic roster of 6 demo investors (commitment, invested capital, unfunded derived from a hash of the entity id). An amount is split across them proportionally to a weight chosen by the allocation basis (`DS-CMNT` commitment, `DS-UNFNDCMNT` unfunded, `DS-CNTRAll` invested capital, `DS-CNTRDeal` invested capital x a deal factor, `DS-NONDMNT` commitment without the largest investor, anything else equal), cent-exact (largest remainder), so allocate, process and the management fee preview always agree. Fund-group allocation splits across entities by their investors' total weight. The investor document is a one-page placeholder PDF. None of this reflects real fees, rounding, opt-outs or transfer rules.

## Known limitations

- No SSO session cookie, so `prompt=login` is a no-op and the form is always shown.
- No rate limiting or lockout on the login form or token endpoint.
- HS256 with a key shared between gateway and auth-service; no JWKS and no asymmetric signing, so any holder of `PRIVATE_KEY` can mint tokens.
- Logout revokes refresh tokens only; issued access tokens live until expiry.
- The allocation / management fee engine and the investor document are simulations (see above); `POSTED` is never reached; `Session-Id` is ignored, so "resolve the sponsor from the session" is not implemented (fund groups without `sponsorId` return all groups).
- Services have no authentication on their TCP sockets (they bind to 127.0.0.1); the investor document travels base64-encoded over TCP.
- No CI. Dev tooling currently reports `npm audit` advisories in `@nestjs/cli` / jest transitive dependencies (no runtime dependency is affected).

## Roadmap

Not built, because the UI does not call them: `template-library` and `box-connector` (the UI's `.env` has `NEXT_PUBLIC_*_API` entries for them). Also planned: asymmetric signing with JWKS if this ever outgrows local development, and CI.

