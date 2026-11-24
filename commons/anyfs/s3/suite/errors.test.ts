/**
 * Tests of the table of errors (commons anyfs-s3 0002-anyfs-s3-store FR-004): every failure has a kind, every kind is a problem of AnyFS, a failed condition is a conflict only where the caller says what the object is
 * at, a throttle is worth a retry and a refusal of the keys is not, and no sentence holds more than the service said.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parsePath, type Path, expectAbsent } from "@intellectual-frontiers/anyfs/governance";
import { describeFailure, FAILURE_KINDS, kindOf, problemOf } from "../src/mod.ts";

const path = (t: string): Path => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const f = (status: number, code = "", message = "") => ({ status, code, message });

proves(["0002-anyfs-s3-store FR-004"], "a failure is of the kind its code says where the code is known, and of the kind its status says where there is no code (as a HEAD has none), and every kind is reached", () => {
  const cases: readonly [ReturnType<typeof f>, string][] = [
    [f(404, "NoSuchKey"), "not-found"],
    [f(404), "not-found"],
    [f(404, "NoSuchBucket"), "no-bucket"],
    [f(412, "PreconditionFailed"), "precondition"],
    [f(412), "precondition"],
    [f(304), "precondition"],
    [f(409, "ConditionalRequestConflict"), "in-progress"],
    [f(409), "in-progress"],
    [f(503, "SlowDown"), "throttled"],
    [f(503), "throttled"],
    [f(429), "throttled"],
    [f(500, "InternalError"), "server"],
    [f(502), "server"],
    [f(403, "AccessDenied"), "denied"],
    [f(403), "denied"],
    [f(403, "InvalidAccessKeyId"), "bad-credentials"],
    [f(403, "SignatureDoesNotMatch"), "bad-credentials"],
    [f(401), "bad-credentials"],
    [f(403, "RequestTimeTooSkewed"), "clock-skew"],
    [f(400, "EntityTooLarge"), "too-large"],
    [f(413), "too-large"],
    [f(400, "BadDigest"), "bad-digest"],
    [f(400, "XAmzContentSHA256Mismatch"), "bad-digest"],
    [f(301, "PermanentRedirect"), "redirect"],
    [f(307), "redirect"],
    [f(501, "NotImplemented"), "not-implemented"],
    [f(400, "InvalidArgument"), "invalid"],
    [f(400, "SomethingNew"), "invalid"],
  ];
  for (const [failure, kind] of cases) assertEquals(kindOf(failure), kind, JSON.stringify(failure));
  assertEquals(new Set(cases.map(([, k]) => k)).size, FAILURE_KINDS.length);
});

proves(["0002-anyfs-s3-store FR-004"], "every kind is a problem of AnyFS: a missing object is missing, a failed condition is a conflict where the path, the expectation and what the object is at are known and unavailable where they are not, and a throttle is retryable", () => {
  const p = path("a/b");
  assertEquals(problemOf(f(404, "NoSuchKey"), { path: p }).kind, "missing");
  assertEquals(problemOf(f(404, "NoSuchKey")).kind, "unavailable");
  const c = problemOf(f(412, "PreconditionFailed"), { path: p, expect: expectAbsent, found: { kind: "absent" } });
  assertEquals(c.kind, "conflict");
  assertEquals(problemOf(f(412, "PreconditionFailed"), { path: p }).kind, "unavailable");
  for (const [failure, retryable] of [[f(503, "SlowDown"), true], [f(500, "InternalError"), true], [f(403, "AccessDenied"), false], [f(403, "SignatureDoesNotMatch"), false], [f(403, "RequestTimeTooSkewed"), false], [f(404, "NoSuchBucket"), false]] as const) {
    const pr = problemOf(failure, { path: p, bucket: "b" });
    assert(pr.kind === "unavailable", JSON.stringify(failure));
    assertEquals(pr.retryable, retryable, JSON.stringify(failure));
  }
  assertEquals(problemOf(f(400, "EntityTooLarge"), { path: p }).kind, "refused");
  assertEquals(problemOf(f(400, "BadDigest"), { path: p }).kind, "tampered");
  for (const kind of FAILURE_KINDS) assert(kind.length > 0);
});

proves(["0002-anyfs-s3-store FR-004"], "a sentence says what the service answered, cut short, and the one for a signature that does not match names what it can be", () => {
  const s = describeFailure({ status: 403, code: "SignatureDoesNotMatch", message: "x".repeat(500) });
  assert(s.length < 300);
  assert(s.startsWith("the service answered 403 SignatureDoesNotMatch"));
  const pr = problemOf(f(403, "SignatureDoesNotMatch"), { path: path("a") });
  assert(pr.kind === "unavailable" && /secret key, the region or the endpoint/u.test(pr.detail));
});
