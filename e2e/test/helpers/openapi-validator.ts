import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

/**
 * Validates HTTP responses against the OpenAPI 3.0 specs in contracts/openapi.
 *
 * The specs are loaded as-is (they are the source of truth) and turned into
 * something Ajv understands by a tiny sanitiser that handles the quirks of the
 * hand-written / Java-generated documents:
 *  - OpenAPI 3.0 ignores every sibling of `$ref`; JSON Schema does not
 *    (CapEvent.sponsor is `{ $ref: Sponsor, type: string }`), so siblings are dropped.
 *  - `required` may name properties that are not declared (LineItemBase.entities);
 *    those names are dropped, otherwise no valid response could exist.
 *  - `nullable: true` is handled natively by Ajv; `format: binary` is accepted.
 *  - Examples, `x-*` and `deprecated` are annotations (strict mode off).
 * Cross-file refs (`./common.json#/...`) resolve through the shared base URI.
 */
const SPEC_DIR = path.resolve(__dirname, "../../../contracts/openapi");
const BASE = "http://spec.local/";

export type SpecName = "referenceData" | "capEventPackage" | "common";
export type Method = "get" | "post" | "put" | "delete";

type Json = any;

const sanitize = (node: Json): Json => {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node === null || typeof node !== "object") return node;
  if (typeof node.$ref === "string") return { $ref: node.$ref };
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(node)) {
    // "example(s)" hold arbitrary data, not schemas: leave them untouched.
    out[key] = key === "example" || key === "examples" ? value : sanitize(value);
  }
  if (Array.isArray(out.required) && out.properties && typeof out.properties === "object") {
    out.required = out.required.filter((name: string) => name in out.properties);
  }
  return out;
};

export class OpenApiValidator {
  private readonly specs = new Map<SpecName, Json>();
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
    addFormats(this.ajv);
    this.ajv.addFormat("binary", true);
    for (const name of ["common", "referenceData", "capEventPackage"] as SpecName[]) {
      const raw = JSON.parse(readFileSync(path.join(SPEC_DIR, `${name}.json`), "utf8"));
      this.specs.set(name, raw);
      this.ajv.addSchema({ ...sanitize(raw), $id: `${BASE}${name}.json` });
    }
  }

  spec(name: SpecName): Json {
    return this.specs.get(name);
  }

  /** Every (method, path) the spec defines. */
  operations(name: SpecName): Array<{ method: Method; path: string; operationId: string }> {
    return Object.entries(this.spec(name).paths as Record<string, Json>).flatMap(([p, item]) =>
      (["get", "post", "put", "delete"] as Method[])
        .filter((m) => item[m])
        .map((m) => ({ method: m, path: p, operationId: item[m].operationId as string })),
    );
  }

  /** Status codes the operation documents. */
  documentedStatuses(name: SpecName, method: Method, p: string): string[] {
    return Object.keys(this.spec(name).paths[p][method].responses);
  }

  private pointer(name: SpecName, method: Method, p: string, status: string, mediaType: string): string {
    const esc = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
    return `${BASE}${name}.json#/paths/${esc(p)}/${method}/responses/${status}/content/${esc(mediaType)}/schema`;
  }

  /** Returns Ajv errors (empty when the body conforms). */
  validateResponse(
    name: SpecName,
    method: Method,
    p: string,
    status: number,
    body: unknown,
    mediaType = "application/json",
  ): string[] {
    const response = this.spec(name).paths[p]?.[method]?.responses?.[String(status)];
    if (!response) {
      return [`status ${status} is not documented for ${method.toUpperCase()} ${p}`];
    }
    if (!response.content?.[mediaType]?.schema) {
      return body === undefined || body === "" || (typeof body === "object" && Object.keys(body as object).length === 0)
        ? []
        : [`${method.toUpperCase()} ${p} ${status} documents no body but one was returned`];
    }
    return this.run(this.pointer(name, method, p, String(status), mediaType), body);
  }

  /** Validates against a named component schema, e.g. common.json ErrorResponse. */
  validateSchema(name: SpecName, schema: string, body: unknown): string[] {
    return this.run(`${BASE}${name}.json#/components/schemas/${schema}`, body);
  }

  /** Validates a request body against the operation's JSON request schema. */
  validateRequestBody(name: SpecName, method: Method, p: string, body: unknown): string[] {
    const esc = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
    return this.run(
      `${BASE}${name}.json#/paths/${esc(p)}/${method}/requestBody/content/application~1json/schema`,
      body,
    );
  }

  private run(ref: string, body: unknown): string[] {
    let validate = this.cache.get(ref);
    if (!validate) {
      validate = this.ajv.getSchema(ref);
      if (!validate) throw new Error(`No schema at ${ref}`);
      this.cache.set(ref, validate);
    }
    return validate(body)
      ? []
      : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`);
  }
}
