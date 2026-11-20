// Spec: 0003-grc-logical FR-003
/**
 * Judging what a runner observed against what a check expects, and joining statuses (0003-grc-logical FR-001, FR-003): pure functions over JSON data.
 *
 * @example
 * ```ts
 * import { evaluate, join } from "./evaluate.ts";
 * evaluate({ kind: "empty" }, []); // { status: "pass", reason: "no rows, as expected" }
 * join("fail", "pass"); // "fail"
 * ```
 *
 * @module
 */
import type { Expectation, Json } from "@intellectual-frontiers/grc/governance";
import { canonicalize } from "./canonical.ts";
import { STATUSES, type Status } from "./kinds.ts";

/** What an expectation says of an observation. */
export type Judgement = { readonly status: "pass" | "fail" | "error"; readonly reason: string };

/** The more serious of two statuses: associative, commutative and idempotent, with `not-applicable` its identity. */
export function join(a: Status, b: Status): Status {
  return STATUSES.indexOf(a) >= STATUSES.indexOf(b) ? a : b;
}

/** The join of statuses; `not-applicable` for none. */
export function joinAll(statuses: readonly Status[]): Status {
  return statuses.reduce(join, "not-applicable");
}

function field(row: Json, name: string): Json | undefined {
  if (row === null || typeof row !== "object" || Array.isArray(row)) return undefined;
  return (row as { readonly [key: string]: Json })[name];
}

function compare(op: "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "in" | "matches", actual: Json | undefined, expected: Json): boolean {
  if (actual === undefined) return false;
  switch (op) {
    case "eq":
      return canonicalize(actual) === canonicalize(expected);
    case "ne":
      return canonicalize(actual) !== canonicalize(expected);
    case "in":
      return Array.isArray(expected) && expected.some((e) => canonicalize(e) === canonicalize(actual));
    case "matches":
      return typeof actual === "string" && typeof expected === "string" && new RegExp(expected).test(actual);
    case "lt":
    case "le":
    case "gt":
    case "ge": {
      const a = typeof actual === "number" || typeof actual === "string" ? actual : undefined;
      const e = typeof expected === "number" || typeof expected === "string" ? expected : undefined;
      if (a === undefined || e === undefined || typeof a !== typeof e) return false;
      return op === "lt" ? a < e : op === "le" ? a <= e : op === "gt" ? a > e : a >= e;
    }
  }
}

/** The judgement of an observed value against an expectation: `error` where the observation is not the shape the expectation needs. */
export function evaluate(expect: Expectation, observed: Json): Judgement {
  const pass = (reason: string): Judgement => ({ status: "pass", reason });
  const fail = (reason: string): Judgement => ({ status: "fail", reason });
  switch (expect.kind) {
    case "equals":
      return canonicalize(observed) === canonicalize(expect.value) ? pass("equals the expected value") : fail("differs from the expected value");
    case "empty":
    case "non-empty":
    case "count":
    case "every": {
      if (!Array.isArray(observed)) return { status: "error", reason: `the expectation ${expect.kind} needs rows, and the observation is not an array` };
      const rows: readonly Json[] = observed;
      if (expect.kind === "empty") return rows.length === 0 ? pass("no rows, as expected") : fail(`${rows.length} rows, none expected`);
      if (expect.kind === "non-empty") return rows.length > 0 ? pass(`${rows.length} rows`) : fail("no rows, some expected");
      if (expect.kind === "count") {
        const lo = expect.min ?? 0;
        const hi = expect.max ?? Number.POSITIVE_INFINITY;
        return rows.length >= lo && rows.length <= hi ? pass(`${rows.length} rows within bounds`) : fail(`${rows.length} rows, outside ${lo} to ${hi === Number.POSITIVE_INFINITY ? "any" : hi}`);
      }
      const bad = rows.findIndex((r) => !compare(expect.op, field(r, expect.field), expect.value));
      return bad < 0 ? pass(`every row has ${expect.field} ${expect.op} the value`) : fail(`row ${bad} does not have ${expect.field} ${expect.op} the value`);
    }
  }
}
