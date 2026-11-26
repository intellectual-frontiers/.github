/**
 * The access decision (commons grc 0019-grc-access-decision): the kind and its invariants, the digest a signature covers, the aged signals, the replay of recorded decisions against a candidate and the time from a revocation to each refusal. Pure functions;
 * no clock, no file and no network are used.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { accessDecision, agedSignals, decisionDigest, replayAgainst, timeToRefusal, type AccessDecision, type Verdict } from "@intellectual-frontiers/grc/logical";
import { AT, must } from "./fixtures.ts";

const provenance = { producer: { name: "test", version: "1" }, inputs: [] };
const base = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: "grc.access-decision",
  schema: "1",
  id: "d-1",
  createdAt: AT,
  provenance,
  subject: { kind: "person", id: "synthetic-person-01" },
  resource: "synthetic-host-01",
  action: "apply",
  policy: { id: "synthetic-policy-01", hash: "a".repeat(64) },
  outcome: "permit",
  reasons: ["plan-approved"],
  signals: [],
  channel: "local",
  decidedAt: "2026-06-01T12:00:00Z",
  decidedBy: "synthetic-controller-01",
  expiresAt: "2026-06-01T13:00:00Z",
  ...over,
});
const make = (over: Record<string, unknown> = {}): AccessDecision => must(accessDecision.decode, base(over));
const refused = (over: Record<string, unknown>): string => {
  const r = accessDecision.decode(base(over));
  assert(r.kind === "err", "refused");
  return r.error.expected;
};

proves(["0019-grc-access-decision FR-001"], "the kind reads a decision with its fields and refuses another kind or schema", () => {
  const d = make({ actingFor: undefined, enforcedAt: "synthetic-point-01", evidence: "e-1", signals: [{ name: "key", source: "ssh", observedAt: "2026-06-01T11:59:00Z", digest: "b".repeat(64) }] });
  assertEquals(d.subject.kind, "person");
  assertEquals(d.signals.length, 1);
  assertEquals(accessDecision.decode(base({ kind: "grc.result" })).kind, "err");
  assertEquals(accessDecision.decode(base({ schema: "2" })).kind, "err");
  assertEquals(accessDecision.decode(base({ subject: { kind: "robot", id: "x" } })).kind, "err");
});

proves(["0019-grc-access-decision FR-002"], "a permit needs an expiry after the decision, a refusal a reason and a revocation the decision it ends", () => {
  assert(refused({ expiresAt: undefined }).includes("expires"));
  assert(refused({ expiresAt: "2026-06-01T11:00:00Z" }).includes("expires"));
  assert(refused({ outcome: "deny", reasons: [], expiresAt: undefined }).includes("reason"));
  assert(refused({ outcome: "deny", reasons: [" "], expiresAt: undefined }).includes("reason"));
  assertEquals(make({ outcome: "deny", reasons: ["E-APPLY-NOT-PERSON"], expiresAt: undefined }).outcome, "deny");
  assert(refused({ outcome: "revoke", reasons: ["drill"], expiresAt: undefined }).includes("revocation"));
  assertEquals(make({ outcome: "revoke", reasons: ["drill"], expiresAt: undefined, revokes: "d-0" }).revokes, "d-0");
});

proves(["0019-grc-access-decision FR-003"], "an agent names the person and the plan it acts for, and no signal is from after the decision", () => {
  assert(refused({ subject: { kind: "agent", id: "synthetic-agent-01" } }).includes("agent"));
  const d = make({ subject: { kind: "agent", id: "synthetic-agent-01" }, actingFor: { person: "synthetic-person-01", plan: "c".repeat(64) } });
  assertEquals(d.actingFor?.person, "synthetic-person-01");
  assert(refused({ signals: [{ name: "key", source: "ssh", observedAt: "2026-06-01T12:00:01Z", digest: "b".repeat(64) }] }).includes("signals"));
});

proves(["0019-grc-access-decision FR-004"], "the digest is the same signed and unsigned and changes with any other field", async () => {
  const unsigned = make();
  const signed = make({ signature: "sig", signer: "synthetic-signer-01" });
  assertEquals(await decisionDigest(signed), await decisionDigest(unsigned));
  assert((await decisionDigest(make({ outcome: "step-up", reasons: ["mfa"] }))) !== (await decisionDigest(unsigned)));
  assert((await decisionDigest(make({ resource: "synthetic-host-02" }))) !== (await decisionDigest(unsigned)));
});

proves(["0019-grc-access-decision FR-005"], "the aged signals are those older than the limit when the decision was made, in order", () => {
  const d = make({
    signals: [
      { name: "inventory", source: "mdm", observedAt: "2026-05-30T12:00:00Z", digest: "1".repeat(64) },
      { name: "key", source: "ssh", observedAt: "2026-06-01T11:59:00Z", digest: "2".repeat(64) },
      { name: "patch", source: "scan", observedAt: "2026-05-29T12:00:00Z", digest: "3".repeat(64) },
    ],
  });
  assertEquals(agedSignals(d, 24 * 3600_000).map((s) => s.name), ["inventory", "patch"]);
  assertEquals(agedSignals(d, 10 * 24 * 3600_000), []);
  assertEquals(agedSignals(make(), 1), []);
});

proves(["0019-grc-access-decision FR-006"], "replay lists the permits that would become denials and the denials that would become permits, and changes nothing", () => {
  const permitRoot = make({ id: "d-1", action: "apply-root" });
  const permitPlain = make({ id: "d-2", action: "apply" });
  const denied = make({ id: "d-3", outcome: "deny", reasons: ["E-APPLY-HASH"], expiresAt: undefined });
  const before = JSON.stringify([permitRoot, permitPlain, denied]);
  const candidate = (d: AccessDecision): Verdict =>
    d.action === "apply-root" ? { outcome: "deny", reasons: ["root"] } : d.id === "d-3" ? { outcome: "permit", reasons: [] } : { outcome: d.outcome, reasons: [...d.reasons] };
  const r = replayAgainst([permitRoot, permitPlain, denied], candidate);
  assertEquals(r.permitsBecomeDenials.map((x) => x.decision.id), ["d-1"]);
  assertEquals(r.denialsBecomePermits.map((x) => x.decision.id), ["d-3"]);
  assertEquals(r.unchanged, 1);
  assertEquals(JSON.stringify([permitRoot, permitPlain, denied]), before);
  const stepUp = replayAgainst([permitPlain], () => ({ outcome: "step-up", reasons: ["mfa"] }));
  assertEquals(stepUp.permitsBecomeDenials.length, 1);
});

proves(["0019-grc-access-decision FR-007"], "the time to refusal is given for each point in order, undefined where none refused, and a refusal before the revocation does not count", () => {
  const out = timeToRefusal(
    "2026-06-01T12:00:00Z",
    [
      { point: "ssh", at: "2026-06-01T11:59:59Z" },
      { point: "ssh", at: "2026-06-01T12:00:03Z" },
      { point: "ssh", at: "2026-06-01T12:00:02Z" },
      { point: "relay", at: "2026-06-01T12:01:00Z" },
    ],
    ["ssh", "relay", "forward"],
  );
  assertEquals(out, [
    { point: "ssh", ms: 2000 },
    { point: "relay", ms: 60000 },
    { point: "forward", ms: undefined },
  ]);
});
