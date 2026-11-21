// Spec: 0002-grc-governance FR-001, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The documents of governance (0002-grc-governance): framework, crosswalk, policy, check, requirement, evidence policy and exception, each a kind of the envelope (0004-grc-documents), so that
 * what varies by organization or by standard is data. Nothing here names a framework, a runner or a store: a check names a kind of runner as a string and gives it an input of JSON data.
 *
 * @remarks
 * The terms `policy`, `check` and `requirement` are `unaligned`: no outside standard defines them as this library uses them (commons 0018-standards-first). The relationships of a crosswalk are
 * those of NIST IR 8477 (Set Theory Relationship Mapping) and a requirement's verification is a row of Mizan's enforcement register.
 *
 * @module
 */
import { array, boolean, type Decoded, type Decoder, err, integer, literal, object, ok, string } from "@intellectual-frontiers/core";
import { defineKind, instant } from "./document.ts";
import { instantMs, parseDuration } from "./time.ts";

/** A JSON value: data a document may carry as the input of a runner, never a function or an object with behaviour. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/** A decoder of JSON data. */
export const jsonData: Decoder<Json> = (input, path = "$") => {
  if (input === null || typeof input === "boolean" || typeof input === "string") return ok(input);
  if (typeof input === "number") return Number.isFinite(input) ? ok(input) : err({ kind: "decode", path, expected: "a finite number", found: String(input) });
  if (Array.isArray(input)) {
    const out: Json[] = [];
    for (const [i, v] of input.entries()) {
      const r = jsonData(v, `${path}[${i}]`);
      if (r.kind === "err") return r;
      out.push(r.value);
    }
    return ok(out);
  }
  if (typeof input === "object" && Object.getPrototypeOf(input) === Object.prototype) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(input)) {
      const r = jsonData(v, `${path}.${k}`);
      if (r.kind === "err") return r;
      out[k] = r.value;
    }
    return ok(out);
  }
  return err({ kind: "decode", path, expected: "JSON data (no function, no undefined, no object with behaviour)", found: typeof input });
};

/** The members of a JSON object, or `undefined` where the value is not one. */
export function objectOf(value: Json): { readonly [key: string]: Json } | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as { readonly [key: string]: Json }) : undefined;
}

/** How serious. */
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
/** How serious. */
export type Severity = (typeof SEVERITIES)[number];
const severity = literal(...SEVERITIES);

/** An ISO 8601 duration. */
export const duration: Decoder<string> = (input, path = "$") => {
  if (typeof input !== "string") return err({ kind: "decode", path, expected: "an ISO 8601 duration", found: typeof input });
  const d = parseDuration(input);
  return d.kind === "ok" ? ok(input) : err({ kind: "decode", path, expected: "an ISO 8601 duration", found: input });
};

/** The relationships of NIST IR 8477's Set Theory Relationship Mapping. */
export const RELATIONSHIPS = ["equal", "subset-of", "superset-of", "intersects-with", "no-relationship"] as const;
/** A relationship. */
export type Relationship = (typeof RELATIONSHIPS)[number];

const strength: Decoder<number> = (input, path = "$") => {
  const r = integer(input, path);
  if (r.kind === "err") return r;
  return r.value >= 1 && r.value <= 10 ? r : err({ kind: "decode", path, expected: "a strength from 1 to 10", found: String(r.value) });
};

/** A framework: its controls, addressed by URN (`controlUrn`). The id of the document is the framework's slug. */
export const framework = defineKind(
  "grc.framework",
  "1",
  { version: string, title: string, controls: array(object({ id: string, title: string, statement: string }, { family: string })) },
  { publisher: string, source: string },
);
/** A framework. */
export type Framework = Decoded<typeof framework.decode>;

/** A crosswalk: mappings between the controls of frameworks, by URN. */
export const crosswalk = defineKind("grc.crosswalk", "1", {
  mappings: array(object({ from: string, to: string, relationship: literal(...RELATIONSHIPS), strength }, { note: string })),
});
/** A crosswalk. */
export type Crosswalk = Decoded<typeof crosswalk.decode>;

/**
 * A catalog package (0008-grc-catalogs): the manifest of a folder of data that holds frameworks and crosswalks and nothing else. It says where the content came from (the publisher, the edition and the address, with the SHA-256 of each source file read),
 * the licence, whether the content may be redistributed (a package whose content may not holds only identifiers and mappings), and the documents it holds, each by its kind, its id, its file and the SHA-256 of that file.
 */
export const catalogPackage = defineKind(
  "grc.catalog-package",
  "1",
  {
    version: string,
    title: string,
    source: object({ publisher: string, edition: string, url: string }),
    licence: string,
    redistributable: boolean,
    holds: array(object({ kind: string, id: string, file: string, digest: string })),
    sources: array(object({ url: string, sha256: string })),
  },
  { notice: string },
);
/** A catalog package. */
export type CatalogPackage = Decoded<typeof catalogPackage.decode>;

/** A policy: what must be true, who owns it, and when it is reviewed. */
export const policy = defineKind(
  "grc.policy",
  "1",
  {
    title: string,
    scope: object({ platforms: array(string), tags: array(string) }),
    severity,
    rationale: string,
    controls: array(string),
    checks: array(string),
    owner: string,
    review: object({ cadence: duration }, { lastReviewed: instant }),
  },
  { exceptions: array(string) },
);
/** A policy. */
export type Policy = Decoded<typeof policy.decode>;

/** What a check expects of what it observes. */
export const expectation = (() => {
  const empty = object({ kind: literal("empty") });
  const nonEmpty = object({ kind: literal("non-empty") });
  const equals = object({ kind: literal("equals"), value: jsonData });
  const count = object({ kind: literal("count") }, { min: integer, max: integer });
  const every = object({ kind: literal("every"), field: string, op: literal("eq", "ne", "lt", "le", "gt", "ge", "in", "matches"), value: jsonData });
  const decoders = { empty, "non-empty": nonEmpty, equals, count, every };
  return (input: unknown, path = "$") => {
    const k: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "kind") : undefined;
    const d = typeof k === "string" && Object.hasOwn(decoders, k) ? decoders[k as keyof typeof decoders] : undefined;
    if (d === undefined) return err({ kind: "decode" as const, path: `${path}.kind`, expected: "one of empty, non-empty, equals, count, every", found: String(k) });
    return d(input, path);
  };
})();
/** An expectation. */
export type Expectation = Decoded<typeof expectation>;

/** A check: the question, what is expected, where it applies, how fresh, and which kind of runner answers with which input. */
export const check = defineKind(
  "grc.check",
  "1",
  {
    ask: string,
    expect: expectation as Decoder<Expectation>,
    platforms: array(string),
    freshness: duration,
    controls: array(string),
    runner: object({ kind: string, input: jsonData }),
  },
  { severity },
);
/** A check. */
export type Check = Decoded<typeof check.decode>;

/** The mechanisms of the enforcement register of Mizan, which a verification is. */
export const MECHANISMS = ["check", "gate", "review", "none"] as const;
/** A mechanism. */
export type Mechanism = (typeof MECHANISMS)[number];

/** A requirement with its verification (a row of the enforcement register) and its validation. */
export const requirement = defineKind(
  "grc.requirement",
  "1",
  {
    statement: string,
    level: literal("MUST", "SHOULD", "MAY"),
    controls: array(string),
    verification: object({ mechanism: literal(...MECHANISMS), by: string }, { note: string }),
  },
  { validation: object({ method: literal("review", "scenario", "stakeholder", "measure"), by: string, at: instant }) },
);
/** A requirement. */
export type Requirement = Decoded<typeof requirement.decode>;

/** The custody of the key an attestation needs, from the weakest. */
export const CUSTODIES = ["none", "file", "managed", "hardware"] as const;
/** A custody. */
export type Custody = (typeof CUSTODIES)[number];

/** The evidence policy: what counts, how long it is kept, who may attest and with what custody of the key. */
export const evidencePolicy = defineKind("grc.evidence-policy", "1", {
  counts: array(object({ kinds: array(string), maxAge: duration }, { producers: array(string) })),
  retention: duration,
  attesters: array(string),
  custody: literal(...CUSTODIES),
});
/** An evidence policy. */
export type EvidencePolicy = Decoded<typeof evidencePolicy.decode>;

/** The five levels of a likelihood, an impact or a risk. */
export const LEVELS = ["very-low", "low", "moderate", "high", "very-high"] as const;
/** A level. */
export type Level = (typeof LEVELS)[number];

/** An exception, with the risk it accepts: it expires. It excuses the entities its subjects name, and the subtenants of an entity (0012-grc-subtenants) only where `inheritable` is true. */
export const exception = defineKind(
  "grc.exception",
  "1",
  {
    excuses: object({ type: literal("control", "check", "policy"), ref: string }),
    subjects: array(string),
    reason: string,
    approvedBy: string,
    grantedAt: instant,
    expiresAt: instant,
  },
  { acceptedRisk: object({ owner: string, level: literal(...LEVELS), reviewBy: instant }), inheritable: boolean },
  (e) => {
    const g = instantMs(e.grantedAt);
    const x = instantMs(e.expiresAt);
    return g === undefined || x === undefined || x <= g ? "an expiry after the grant" : undefined;
  },
);
/** An exception. */
export type Exception = Decoded<typeof exception.decode>;
