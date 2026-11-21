/**
 * Tests of the table of failures (commons anyfs-githost 0002-anyfs-githost-store FR-005): every failure of a host's API is a problem of AnyFS by a total table, one sentence each, and never holds a token.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { parsePath, type Path } from "@intellectual-frontiers/anyfs/governance";
import { type ApiProblem, describeApiProblem, problemOf } from "../src/mod.ts";

const path = ((): Path => {
  const r = parsePath("a/b");
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
})();

const ALL: readonly ApiProblem[] = [
  { kind: "not-found", what: "the file" },
  { kind: "conflict", message: "not a fast forward" },
  { kind: "denied", reason: "unauthorized", message: "bad credentials" },
  { kind: "denied", reason: "permission", message: "may not" },
  { kind: "denied", reason: "protected", message: "protected branch" },
  { kind: "rate-limited", message: "slow down" },
  { kind: "rate-limited", message: "slow down", retryAfterSeconds: 12 },
  { kind: "too-large", message: "too big" },
  { kind: "unavailable", message: "connection lost", retryable: true },
  { kind: "unavailable", message: "the repository is empty", retryable: false },
  { kind: "unexpected", status: 418, message: "a teapot" },
  { kind: "unexpected", status: 502, message: "bad gateway" },
];

proves(["0002-anyfs-githost-store FR-005"], "every failure is a problem of AnyFS with a sentence, and the kind and the retry are what the table says", () => {
  for (const f of ALL) {
    assert(describeApiProblem(f).length > 5, JSON.stringify(f));
    for (const subject of [{}, { path }] as const) {
      const q = problemOf(f, subject);
      assert(["missing", "conflict", "refused", "unavailable", "tampered"].includes(q.kind));
    }
  }
  assertEquals(problemOf({ kind: "not-found", what: "x" }, { path }).kind, "missing");
  assertEquals(problemOf({ kind: "not-found", what: "the repository" }).kind, "unavailable", "a repository that is not found is not an object that is missing");
  const retryable = (f: ApiProblem): boolean => {
    const q = problemOf(f);
    return q.kind === "unavailable" && q.retryable;
  };
  assertEquals(retryable({ kind: "rate-limited", message: "m" }), true);
  assertEquals(retryable({ kind: "conflict", message: "m" }), true);
  assertEquals(retryable({ kind: "unavailable", message: "m", retryable: true }), true);
  assertEquals(retryable({ kind: "unavailable", message: "m", retryable: false }), false);
  assertEquals(retryable({ kind: "denied", reason: "unauthorized", message: "m" }), false);
  assertEquals(retryable({ kind: "unexpected", status: 502, message: "m" }), true);
  assertEquals(retryable({ kind: "unexpected", status: 418, message: "m" }), false);
  const protectedPush = problemOf({ kind: "denied", reason: "protected", message: "GH006" }, { path });
  assert(protectedPush.kind === "refused" && protectedPush.reason === "read-only");
  const big = problemOf({ kind: "too-large", message: "100 MB" }, { path });
  assert(big.kind === "refused" && big.reason === "too-large");
  assertStringIncludes(describeApiProblem({ kind: "rate-limited", message: "m", retryAfterSeconds: 12 }), "12 s");
});
