import { after, before, describe, it } from "node:test";

import { expect } from "expect";

import { type Method, OpenApiValidator, type SpecName } from "./helpers/openapi-validator";
import { UI_ORIGIN, bootStack, login, type Stack } from "./helpers/stack";

/**
 * Contract test: every operation of referenceData.json and capEventPackage.json
 * is called through the real gateway (JWT from the real OIDC flow, requests
 * shaped like the UI's generated clients) and the status code and the body are
 * validated against the spec's response schema.
 */
const BASES: Record<string, string> = {
  referenceData: "/api/v1/reference-data",
  capEventPackage: "/api/v1/cap-event-package",
};

/** Same query serialisation as the generated clients: repeated keys for arrays. */
const withQuery = (url: string, params: Record<string, unknown> = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
};

const sum = (values: Array<number | undefined>) =>
  Math.round(values.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;

describe("OpenAPI contract through the gateway", { timeout: 180000 }, () => {
  let stack: Stack;
  let token: string;
  const validator = new OpenApiValidator();
  const covered = new Set<string>();

  before(async () => {
    stack = await bootStack();
    token = await login(stack.http);
  });

  after(async () => {
    await stack?.close();
  });

  interface CallOptions {
    query?: Record<string, unknown>;
    body?: unknown;
    auth?: boolean;
    /** Skip schema validation of a documented-error body (it is validated against ErrorResponse). */
  }

  /**
   * Calls `specPath` of `spec` through the gateway and validates the answer.
   * `urlPath` differs from `specPath` only where it carries concrete path params.
   */
  const call = async (
    spec: Exclude<SpecName, "common">,
    method: Method,
    specPath: string,
    urlPath: string,
    expectedStatus: number,
    { query, body, auth = true }: CallOptions = {},
  ) => {
    let req = stack.http[method](withQuery(`${BASES[spec]}${urlPath}`, query)).set("Session-Id", "ignored-session");
    if (auth) req = req.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) req = req.send(body as object);
    const res = await req;
    expect(res.status).toBe(expectedStatus);

    const errors = validator.validateResponse(spec, method, specPath, res.status, res.body);
    expect({ operation: `${method.toUpperCase()} ${specPath}`, status: res.status, errors }).toEqual({
      operation: `${method.toUpperCase()} ${specPath}`,
      status: res.status,
      errors: [],
    });
    if (res.status >= 400) {
      expect(validator.validateSchema("common", "ErrorResponse", res.body)).toEqual([]);
    } else {
      covered.add(`${spec} ${method.toUpperCase()} ${specPath}`);
    }
    return res;
  };

  // ------------------------------------------------------------------ reference data

  const ref = {
    sponsor: undefined as any,
    fundGroup: undefined as any,
    entities: [] as any[],
    entityIds: [] as string[],
    allocationBases: [] as any[],
  };

  it("reference data: every operation conforms to referenceData.json", async () => {
    const sponsors = await call("referenceData", "get", "/sponsors", "/sponsors", 200);
    expect(sponsors.body.length).toBeGreaterThanOrEqual(3);
    ref.sponsor = sponsors.body.find((s: any) => s.id === "1");
    expect(ref.sponsor).toMatchObject({ name: "Golden Dev Test", status: "ACTIVE" });

    const groups = await call("referenceData", "get", "/fund-groups/search", "/fund-groups/search", 200, {
      query: { sponsorId: ref.sponsor.id },
    });
    expect(groups.body.map((g: any) => g.id)).toEqual(["FG001", "FG002"]);
    ref.fundGroup = groups.body[0];

    const all = await call("referenceData", "get", "/fund-groups/search", "/fund-groups/search", 200);
    expect(all.body.length).toBe(10);

    const entities = await call(
      "referenceData",
      "get",
      "/fund-groups/{fundGroupId}/entities",
      `/fund-groups/${ref.fundGroup.id}/entities`,
      200,
      { query: { statuses: ["ACTIVE"], typesToExclude: ["ADMIN", "ELIMINATION"] } },
    );
    ref.entities = entities.body;
    ref.entityIds = ref.entities.map((e: any) => e.id);
    expect(ref.entities).toHaveLength(3);
    expect(ref.entities[0]).toMatchObject({ id: "73301-01", allocationBasis: { allocationId: "DS-CMNT" } });
    // Internal filter fields never leak into the API shape.
    expect(Object.keys(ref.entities[0])).not.toEqual(expect.arrayContaining(["status"]));
    const unfiltered = await call(
      "referenceData",
      "get",
      "/fund-groups/{fundGroupId}/entities",
      `/fund-groups/${ref.fundGroup.id}/entities`,
      200,
    );
    expect(unfiltered.body.length).toBeGreaterThan(ref.entities.length);

    const accounts = await call("referenceData", "get", "/accounts", "/accounts", 200, {
      query: { sponsorId: ref.sponsor.id, fsGroupings: ["Capital"], capitalCategories: ["Mgmt Fee"] },
    });
    expect(accounts.body.length).toBeGreaterThan(5);
    expect(accounts.body.every((a: any) => a.capitalCategory !== "Mgmt Fee")).toBe(true);
    const everyAccount = await call("referenceData", "get", "/accounts", "/accounts", 200, {
      query: { sponsorId: ref.sponsor.id },
    });
    expect(everyAccount.body.length).toBeGreaterThan(accounts.body.length);

    const mapped = await call("referenceData", "get", "/accounts/mapped/{id}", "/accounts/mapped/1-3110", 200);
    expect(mapped.body.accountKey).toBe("1-1300");

    const queries = await call("referenceData", "get", "/queries", "/queries", 200);
    expect(queries.body.length).toBeGreaterThanOrEqual(4);
    const results = await call(
      "referenceData",
      "get",
      "/queries/{queryId}/filters",
      `/queries/${queries.body[0].id}/filters`,
      200,
      { query: { ENTITY_ID: "73301-01" } },
    );
    expect(results.body.ENTITY_ID).toBe("73301-01");

    const investments = await call("referenceData", "get", "/investments", "/investments", 200);
    expect(investments.body.length).toBe(10);

    const bases = await call("referenceData", "get", "/allocation-bases", "/allocation-bases", 200);
    ref.allocationBases = bases.body;
    expect(bases.body.map((b: any) => b.allocationId)).toEqual(
      expect.arrayContaining(["DS-CMNT", "DS-UNFNDCMNT", "DS-CNTRAll", "DS-CNTRDeal", "DS-NONDMNT"]),
    );

    const entity = ref.entities[0];
    const mgmt = await call("referenceData", "get", "/journal-entries/mgmt-fee", "/journal-entries/mgmt-fee", 200, {
      query: { entityIds: [entity.id], calledFlag: "N" },
    });
    expect(mgmt.body).toHaveLength(2);
    const batchNo = mgmt.body[0].batchNo;

    const lines = await call(
      "referenceData",
      "get",
      "/journal-entries/mgmt-fee/line-items",
      "/journal-entries/mgmt-fee/line-items",
      200,
      { query: { batchNo, entityId: entity.id, state: "POSTED", calledFlag: "N" } },
    );
    expect(lines.body).toHaveLength(2);
    expect(sum(lines.body.map((l: any) => l.amount))).toBe(mgmt.body[0].amount);

    const total = await call(
      "referenceData",
      "get",
      "/journal-entries/entities/total-amount",
      "/journal-entries/entities/total-amount",
      200,
      { query: { entityIds: ref.entityIds, allocationBasis: entity.allocationBasis.allocationName, toDate: "2026-12-31" } },
    );
    expect(total.body.length).toBeGreaterThan(0);

    const entries = await call("referenceData", "get", "/journal-entries", "/journal-entries", 200, {
      query: {
        batchNo,
        accountKey: lines.body[0].account.accountKey,
        allocationBasis: entity.allocationBasis.allocationName,
        entityId: entity.id,
      },
    });
    expect(entries.body).toHaveLength(1);

    const attribute = await call("referenceData", "get", "/investor-attributes", "/investor-attributes", 200, {
      query: { investorId: "CUST001", entityId: entity.id },
    });
    expect(attribute.body.secondaryInvestorId).toBe(`SEC-001-${entity.id}`);
  });

  it("reference data: documented error responses use the ErrorResponse shape", async () => {
    await call("referenceData", "get", "/accounts", "/accounts", 401, { query: { sponsorId: "1" }, auth: false });
    await call("referenceData", "get", "/accounts", "/accounts", 404, { query: { sponsorId: "999" } });
    const bad = await call("referenceData", "get", "/journal-entries", "/journal-entries", 400, {
      query: { batchNo: "abc" },
    });
    expect(bad.body.reason).toBe("VALIDATION_ERROR");
    expect(bad.body.details.map((d: any) => d.field)).toEqual(
      expect.arrayContaining(["batchNo", "accountKey", "allocationBasis", "entityId"]),
    );
    await call("referenceData", "get", "/accounts/mapped/{id}", "/accounts/mapped/nope", 404);
    await call("referenceData", "get", "/fund-groups/{fundGroupId}/entities", "/fund-groups/nope/entities", 404);
  });

  // ------------------------------------------------------------------ cap event package

  /** What the UI's PreviewScreenStore.buildPayload sends, filled with real reference data. */
  const uiCapEvent = (types: any[], overrides: Record<string, unknown> = {}) => ({
    sponsor: { id: ref.sponsor.id, name: ref.sponsor.name },
    capEventType: types[0],
    fundGroup: { id: ref.fundGroup.id, name: ref.fundGroup.name },
    entities: ref.entities.slice(0, 2).map((e) => ({ id: e.id, name: e.name })),
    noticeDate: "2026-12-01",
    status: "DRAFT",
    comment: "contract test",
    capEventEntityLineItems: ref.entities.slice(0, 2).map((e, i) => ({
      entity: { id: e.id, name: e.name },
      noticeDate: "2026-12-01",
      dueDate: "2026-12-15",
      capEventLineItems: [
        {
          account: { accountNo: "3110", capitalCategory: "Cont - Investments", callDistributionReason: "Investment", insideCommitment: "yes" },
          investment: i === 0 ? { id: "INV-001", name: "Project Atlas" } : null,
          allocationBasis: "Commitment",
          allocationBasisId: "DS-CMNT",
          amount: 100000 + i * 50000,
          prDate: "2026-12-15",
          prFlag: true,
        },
        {
          account: { accountNo: "3120" },
          investment: null,
          allocationBasis: "Unfunded Commitment",
          allocationBasisId: "DS-UNFNDCMNT",
          amount: 25000.55,
          prDate: "2026-12-15",
          prFlag: false,
        },
      ],
    })),
    totalAmount: 0,
    ...overrides,
  });

  it("cap event package: every operation conforms to capEventPackage.json", async () => {
    const types = await call("capEventPackage", "get", "/cap-events/types", "/cap-events/types", 200);
    expect(types.body.map((t: any) => t.abbreviation)).toEqual(expect.arrayContaining(["Call", "Distr"]));

    const draftBody = uiCapEvent(types.body);
    // The spec's investment is a non-nullable object, but the UI's client sends null for
    // "no investment"; the gateway accepts that, the spec check uses the null-free form.
    const withoutNulls = JSON.parse(JSON.stringify(draftBody, (_k, v) => (v === null ? undefined : v)));
    expect(validator.validateRequestBody("capEventPackage", "post", "/cap-events/draft", withoutNulls)).toEqual([]);

    // --- lifecycle: draft -> update -> submit
    const draft = await call("capEventPackage", "post", "/cap-events/draft", "/cap-events/draft", 200, { body: draftBody });
    expect(draft.body).toMatchObject({ status: "DRAFT", createdBy: "demo@example.com", totalAmount: 300001.1 });

    const fetched = await call("capEventPackage", "get", "/cap-events/{id}", `/cap-events/${draft.body.id}`, 200);
    expect(fetched.body).toEqual(draft.body);

    const updated = await call("capEventPackage", "post", "/cap-events/{id}", `/cap-events/${draft.body.id}`, 200, {
      body: { ...draftBody, comment: "edited" },
    });
    expect(updated.body).toMatchObject({ id: draft.body.id, status: "DRAFT", comment: "edited" });

    const processed = await call("capEventPackage", "post", "/cap-events/process", "/cap-events/process", 200, {
      body: draftBody,
    });
    expect(processed.body).toHaveLength(2);
    for (const item of processed.body) {
      const aggregated = item.plInvestorEntries.filter((e: any) => e.isAggregated);
      expect(aggregated).toHaveLength(6);
    }
    expect(sum(processed.body[0].plInvestorEntries.filter((e: any) => e.isAggregated).map((e: any) => e.allocatedAmount))).toBe(125000.55);

    const submitted = await call("capEventPackage", "post", "/cap-events", "/cap-events", 200, {
      body: { ...draftBody, id: draft.body.id, capEventAggregatedLineItems: processed.body },
    });
    expect(submitted.body).toMatchObject({ id: draft.body.id, status: "SUBMITTED" });
    expect(submitted.body.capEventAggregatedLineItems).toHaveLength(2);

    const direct = await call("capEventPackage", "post", "/cap-events", "/cap-events", 200, { body: draftBody });
    expect(direct.body.status).toBe("SUBMITTED");
    expect(direct.body.capEventAggregatedLineItems).toHaveLength(2);

    // --- list filters
    const list = await call("capEventPackage", "get", "/cap-events", "/cap-events", 200, {
      query: { sponsorId: ref.sponsor.id },
    });
    expect(list.body).toHaveLength(2);
    const onlySubmitted = await call("capEventPackage", "get", "/cap-events", "/cap-events", 200, {
      query: { sponsorId: ref.sponsor.id, statuses: ["SUBMITTED", "POSTED"] },
    });
    expect(onlySubmitted.body.every((e: any) => e.status === "SUBMITTED")).toBe(true);
    const otherSponsor = await call("capEventPackage", "get", "/cap-events", "/cap-events", 200, {
      query: { sponsorId: "2" },
    });
    expect(otherSponsor.body).toEqual([]);

    // --- delete (drafts only)
    const toDelete = await call("capEventPackage", "post", "/cap-events/draft", "/cap-events/draft", 200, { body: draftBody });
    const deleted = await call("capEventPackage", "delete", "/cap-events/{id}", `/cap-events/${toDelete.body.id}`, 204);
    expect(deleted.text).toBe("");
    await call("capEventPackage", "get", "/cap-events/{id}", `/cap-events/${toDelete.body.id}`, 404);

    // --- allocation simulation
    const alloc = await call("capEventPackage", "post", "/cap-events/line-items/allocate", "/cap-events/line-items/allocate", 200, {
      body: { entityId: ref.entities[0].id, dueDate: "2026-12-15", allocationBasisId: "DS-CMNT", accountNo: "3110", investmentId: "INV-001", amount: 1000000 },
    });
    expect(alloc.body).toHaveLength(6);
    expect(sum(alloc.body.map((e: any) => e.allocatedAmount))).toBe(1000000);

    const groupAlloc = await call("capEventPackage", "post", "/cap-events/fund-group/allocate", "/cap-events/fund-group/allocate", 200, {
      body: {
        allocationBasis: "Commitment",
        amount: 1000000,
        entityAllocationInput: ref.entities.map((e) => ({ entityId: e.id, dueDate: "2026-12-15" })),
      },
    });
    expect(Object.keys(groupAlloc.body)).toEqual(ref.entityIds);
    expect(sum(Object.values<number>(groupAlloc.body))).toBe(1000000);

    // --- management fee (backed by reference-data-service)
    const entity = ref.entities[0];
    const mfEntries = await call("capEventPackage", "get", "/cap-events/journal-entries/mgmt-fee", "/cap-events/journal-entries/mgmt-fee", 200, {
      query: { entityIds: ref.entityIds },
    });
    expect(Object.keys(mfEntries.body)).toEqual(ref.entityIds);
    expect(mfEntries.body[entity.id]).toHaveLength(2);
    const batchNo = mfEntries.body[entity.id][0].batchNo;

    const mfLines = await call("capEventPackage", "get", "/cap-events/line-items/mgmt-fees", "/cap-events/line-items/mgmt-fees", 200, {
      query: { batchNo, entityId: entity.id },
    });
    expect(mfLines.body).toHaveLength(2);
    expect(mfLines.body[0]).toMatchObject({ isMfLineItem: true, allocationBasisId: "DS-CMNT", batchNo });

    const mfAlloc = await call(
      "capEventPackage",
      "get",
      "/cap-events/journal-entries/mgmt-fee/allocate",
      "/cap-events/journal-entries/mgmt-fee/allocate",
      200,
      {
        query: {
          batchNo,
          accountKey: mfLines.body[0].originAccountKey,
          allocationBasis: mfLines.body[0].allocationBasis,
          allocationBasisId: mfLines.body[0].allocationBasisId,
          entityId: entity.id,
        },
      },
    );
    expect(sum(mfAlloc.body.map((e: any) => e.allocatedAmount))).toBe(mfLines.body[0].amount);

    // --- investor document (binary placeholder)
    const aggregated = processed.body[0].plInvestorEntries.filter((e: any) => e.isAggregated);
    const documentBody = {
      capEvent: submitted.body,
      lineItem: { ...processed.body[0], plInvestorEntries: [aggregated[0]] },
    };
    expect(validator.validateRequestBody("capEventPackage", "post", "/cap-events/investors/document", JSON.parse(JSON.stringify(documentBody, (_k, v) => (v === null ? undefined : v))))).toEqual([]);
    const doc = await stack.http
      .post(`${BASES.capEventPackage}/cap-events/investors/document`)
      .set("Authorization", `Bearer ${token}`)
      .set("Session-Id", "ignored-session")
      .set("Accept", "application/octet-stream, application/json")
      .send(documentBody)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(doc.status).toBe(200);
    expect(doc.headers["content-type"]).toContain("application/octet-stream");
    expect(validator.validateResponse("capEventPackage", "post", "/cap-events/investors/document", 200, "binary", "application/octet-stream")).toEqual([]);
    expect((doc.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    covered.add("capEventPackage POST /cap-events/investors/document");
  });

  it("cap event package: documented error responses use the ErrorResponse shape", async () => {
    const types = (await stack.http.get(`${BASES.capEventPackage}/cap-events/types`).set("Authorization", `Bearer ${token}`)).body;
    const submitted = (await call("capEventPackage", "get", "/cap-events", "/cap-events", 200, { query: { statuses: ["SUBMITTED"] } })).body[0];

    await call("capEventPackage", "get", "/cap-events", "/cap-events", 401, { auth: false });
    await call("capEventPackage", "get", "/cap-events/{id}", "/cap-events/8b5cf1e4-1b7f-4a43-8f3a-0a9e1c2d3e4f", 404);
    await call("capEventPackage", "post", "/cap-events/{id}", `/cap-events/${submitted.id}`, 400, { body: uiCapEvent(types) });
    await call("capEventPackage", "delete", "/cap-events/{id}", `/cap-events/${submitted.id}`, 400);
    await call("capEventPackage", "post", "/cap-events", "/cap-events", 400, {
      body: uiCapEvent(types, { capEventEntityLineItems: [] }),
    });
    const invalid = await call("capEventPackage", "post", "/cap-events/draft", "/cap-events/draft", 400, {
      body: { ...uiCapEvent(types), sponsor: "not-an-object", status: "WEIRD" },
    });
    expect(invalid.body.reason).toBe("VALIDATION_ERROR");
    await call("capEventPackage", "get", "/cap-events/journal-entries/mgmt-fee/allocate", "/cap-events/journal-entries/mgmt-fee/allocate", 400, {
      query: { batchNo: "x" },
    });
    await call("capEventPackage", "post", "/cap-events/investors/document", "/cap-events/investors/document", 400, {
      body: { capEvent: uiCapEvent(types), lineItem: { plInvestorEntries: [] } },
    });
  });

  // ------------------------------------------------------------------ cross-cutting

  it("covers every operation of both specs", () => {
    const missing: string[] = [];
    let total = 0;
    for (const spec of ["referenceData", "capEventPackage"] as const) {
      for (const op of validator.operations(spec)) {
        total++;
        if (!covered.has(`${spec} ${op.method.toUpperCase()} ${op.path}`)) {
          missing.push(`${spec} ${op.method.toUpperCase()} ${op.path} (${op.operationId})`);
        }
      }
    }
    expect(total).toBe(28);
    expect(missing).toEqual([]);
  });

  it("the validator really rejects non-conforming bodies", () => {
    const bad = (spec: SpecName, p: string, body: unknown) =>
      validator.validateResponse(spec, "get", p, 200, body).length;
    expect(bad("referenceData", "/sponsors", [{ id: "1", status: "BOGUS" }])).toBeGreaterThan(0);
    expect(bad("referenceData", "/sponsors", { not: "an array" })).toBeGreaterThan(0);
    expect(bad("referenceData", "/journal-entries/mgmt-fee", [{ amount: "12", batchDate: "31/12/2026" }])).toBeGreaterThan(0);
    expect(bad("capEventPackage", "/cap-events", [{ status: "DRAFT" }])).toBeGreaterThan(0);
    expect(validator.validateResponse("capEventPackage", "get", "/cap-events/{id}", 500, { reason: "NOPE" }).length).toBeGreaterThan(0);
    expect(validator.validateResponse("referenceData", "get", "/sponsors", 418, {}).join()).toContain("not documented");
    // OpenAPI quirk handling: $ref siblings are ignored, so a Sponsor object is valid there.
    expect(
      validator.validateRequestBody("capEventPackage", "post", "/cap-events/draft", {
        sponsor: { id: "1" }, capEventType: {}, fundGroup: {}, entities: [],
        capEventEntityLineItems: [
          { entity: {}, noticeDate: "2026-01-01", dueDate: "2026-01-01", capEventLineItems: [
            { account: {}, allocationBasis: "a", allocationBasisId: "b", amount: 1, prDate: "2026-01-01", prFlag: true },
          ] },
        ],
      }),
    ).toEqual([]);
  });

  it("CORS preflight allows the UI origin with Authorization and Session-Id", async () => {
    for (const url of [`${BASES.referenceData}/sponsors`, `${BASES.capEventPackage}/cap-events`]) {
      const res = await stack.http
        .options(url)
        .set("Origin", UI_ORIGIN)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "authorization,content-type,session-id");
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(UI_ORIGIN);
      const allowed = String(res.headers["access-control-allow-headers"]).toLowerCase();
      expect(allowed).toContain("authorization");
      expect(allowed).toContain("session-id");
      expect(allowed).toContain("content-type");
    }
    const actual = await stack.http
      .get(`${BASES.referenceData}/sponsors`)
      .set("Origin", UI_ORIGIN)
      .set("Authorization", `Bearer ${token}`);
    expect(actual.headers["access-control-allow-origin"]).toBe(UI_ORIGIN);
  });

  it("seeding is idempotent and data is persisted per service database", async () => {
    const { SeedService } = require("../../reference-data-service/src/seed/seed.service");
    const before = (await stack.http.get(`${BASES.referenceData}/fund-groups/FG001/entities`).set("Authorization", `Bearer ${token}`)).body;
    await stack.apps.referenceData.get(SeedService).seed();
    const afterSeed = (await stack.http.get(`${BASES.referenceData}/fund-groups/FG001/entities`).set("Authorization", `Bearer ${token}`)).body;
    expect(afterSeed).toEqual(before);

    const { getConnectionToken } = require("module").createRequire(
      require("node:path").resolve(__dirname, "../../cap-event-package-service/package.json"),
    )("@nestjs/mongoose");
    const conn = stack.apps.capEventPackage.get(getConnectionToken());
    expect(conn.name).toBe("cap_event_package");
    const stored = await conn.db.collection("cap_events").find().toArray();
    expect(stored.map((s: any) => s.status).sort()).toEqual(["SUBMITTED", "SUBMITTED"]);

    const refConn = stack.apps.referenceData.get(
      require("module").createRequire(require("node:path").resolve(__dirname, "../../reference-data-service/package.json"))("@nestjs/mongoose").getConnectionToken(),
    );
    expect(refConn.name).toBe("cap_event_reference_data");
    expect(await refConn.db.collection("sponsors").countDocuments()).toBe(5);
  });
});
