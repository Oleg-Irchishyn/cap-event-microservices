# OpenAPI specs (source of truth)

`referenceData.json`, `capEventPackage.json` and `common.json` are copies of
`cap-event-ui/src/api/openapi/*` - the specs the UI's API clients were generated
from. They are the contract of this backend. Keep them in sync: when the UI repo
changes a spec, copy it here, run `npm run generate` (writes `src/generated/*.ts`
with openapi-typescript) and fix the services until the contract test
(`npm run test:e2e`, `e2e/test/contract.e2e.test.ts`) is green again.
