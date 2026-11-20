/**
 * Tests of the logical model (0003-grc-logical): the join of statuses, the judgement of an observation, freshness, drift, change impact, coverage, roll-up, exceptions and risks. Every
 * computation is shown to be the same for any order of its input.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertAlmostEquals, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  applyExceptions,
  assessment,
  attestation,
  changeImpact,
  coverage,
  drift,
  evaluate,
  evidence,
  finding,
  freshness,
  join,
  joinAll,
  result,
  risk,
  riskLevel,
  risksDue,
  rollup,
  STATUSES,
  uncovered,
  type Risk,
  type Status,
} from "@intellectual-frontiers/grc/logical";
import { crosswalk, LEVELS, type Json } from "@intellectual-frontiers/grc/governance";
import { A1, A2, aCheck, anException, aResult, AT, B1, ex, must, OTHER1, other, walk } from "./fixtures.ts";

const status = fc.constantFrom(...STATUSES);

proves(["0003-grc-logical FR-001"], "statuses join associatively, commutatively and idempotently, with not-applicable as the identity", () => {
  fc.assert(
    fc.property(status, status, status, (a, b, c) => {
      assertEquals(join(join(a, b), c), join(a, join(b, c)));
      assertEquals(join(a, b), join(b, a));
      assertEquals(join(a, a), a);
      assertEquals(join(a, "not-applicable"), a);
    }),
  );
  assertEquals(join("fail", "pass"), "fail");
  assertEquals(join("pass", "not-applicable"), "pass");
  assertEquals(join("accepted", "pass"), "accepted");
  assertEquals(join("error", "fail"), "error");
  assertEquals(joinAll([]), "not-applicable");
});

proves(["0003-grc-logical FR-002"], "results, findings, evidence, attestations, assessments and risks are documents of one kind each, which decode", () => {
  for (const k of [result, finding, evidence, attestation, assessment, risk]) assert(k.id.startsWith("grc.") && k.schema === "1", k.id);
  const r = aResult("c", "host-1", "fail");
  assertEquals(result.decode(r).kind, "ok");
  assertEquals(result.decode({ ...r, status: "maybe" }).kind, "err");
  assertEquals(result.decode({ ...r, severity: "huge" }).kind, "err");
  const a = assessment.decode({ ...r, kind: "grc.assessment" });
  assertEquals(a.kind, "err");
});

proves(["0003-grc-logical FR-003"], "an observation is judged against an expectation, and a shape the expectation cannot read is an error", () => {
  assertEquals(evaluate({ kind: "empty" }, []).status, "pass");
  assertEquals(evaluate({ kind: "empty" }, [1]).status, "fail");
  assertEquals(evaluate({ kind: "non-empty" }, []).status, "fail");
  assertEquals(evaluate({ kind: "count", min: 1, max: 2 }, [1, 2, 3]).status, "fail");
  assertEquals(evaluate({ kind: "count", min: 1, max: 2 }, [1, 2]).status, "pass");
  assertEquals(evaluate({ kind: "equals", value: { b: 1, a: 2 } }, { a: 2, b: 1 }).status, "pass");
  assertEquals(evaluate({ kind: "every", field: "n", op: "ge", value: 3 }, [{ n: 3 }, { n: 4 }]).status, "pass");
  assertEquals(evaluate({ kind: "every", field: "n", op: "ge", value: 3 }, [{ n: 3 }, { n: 2 }]).status, "fail");
  assertEquals(evaluate({ kind: "every", field: "s", op: "matches", value: "^ok" }, [{ s: "ok!" }]).status, "pass");
  assertEquals(evaluate({ kind: "every", field: "s", op: "in", value: ["a", "b"] }, [{ s: "c" }]).status, "fail");
  assertEquals(evaluate({ kind: "every", field: "n", op: "lt", value: 3 }, [{ x: 1 }]).status, "fail");
  assertEquals(evaluate({ kind: "empty" }, "text").status, "error");
  assertEquals(evaluate({ kind: "every", field: "n", op: "eq", value: 1 }, { n: 1 }).status, "error");
});

proves(["0003-grc-logical FR-004"], "freshness is fresh, due within a tenth of the duration of its end, stale after, and stale for none", () => {
  const f = (newest: string | undefined, now: string) => {
    const r = freshness(newest, "P30D", now);
    return r.kind === "ok" ? r.value.state : "error";
  };
  assertEquals(f("2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z"), "fresh");
  assertEquals(f("2026-01-01T00:00:00Z", "2026-01-29T00:00:00Z"), "due");
  assertEquals(f("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"), "stale");
  assertEquals(f("2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z"), "stale");
  assertEquals(f(undefined, "2026-01-31T00:00:00Z"), "stale");
  assertEquals(freshness("2026-01-01T00:00:00Z", "P30D", "2026-01-02T00:00:00Z"), { kind: "ok", value: { state: "fresh", dueAt: "2026-01-31T00:00:00.000Z" } });
  assertEquals(f("2026-01-01T00:00:00Z", "later"), "error");
});

proves(["0003-grc-logical FR-005"], "drift gives what was added, removed and changed, with the path and both values, in key order", () => {
  const d = drift({ b: { x: 1, y: { z: 2 } }, a: 1, gone: 3 }, { a: 1, b: { x: 2, y: { z: 2 } }, new1: true });
  assertEquals(d.added, ["new1"]);
  assertEquals(d.removed, ["gone"]);
  assertEquals(d.changed, [{ key: "b", path: "x", declared: 1, observed: 2 }]);
  assertEquals(drift({ a: 1 }, { a: 1 }), { added: [], removed: [], changed: [] });
  fc.assert(
    fc.property(fc.dictionary(fc.string({ maxLength: 4 }), fc.integer()), (m) => {
      const j: Record<string, Json> = m;
      const d2 = drift(j, j);
      assertEquals(d2.added.length + d2.removed.length + d2.changed.length, 0);
    }),
  );
});

proves(["0003-grc-logical FR-006"], "a change is blocked where a touched path bears on a failing control, unless an exception or an approval covers it", () => {
  const decl = [{ paths: ["infra/**"], controls: [A1, A2] }];
  const newest: Record<string, Status> = { [A1]: "fail", [A2]: "pass" };
  const blocked = changeImpact(decl, ["infra/disk.tf", "docs/a.md"], newest, { at: AT });
  assertEquals(blocked.verdict, "blocked");
  assertEquals(blocked.reasons.map((r) => [r.control, r.path, r.status]), [[A1, "infra/disk.tf", "fail"]]);
  assertEquals(changeImpact(decl, ["docs/a.md"], newest, { at: AT }).verdict, "allowed");
  assertEquals(changeImpact(decl, ["infra/disk.tf"], { [A1]: "pass", [A2]: "pass" }, { at: AT }).verdict, "allowed");
  assertEquals(changeImpact(decl, ["infra/disk.tf"], {}, { at: AT }).verdict, "blocked");
  const approved = changeImpact(decl, ["infra/disk.tf"], newest, { at: AT, approvals: [A1] });
  assertEquals([approved.verdict, approved.reasons[0]?.resolvedBy], ["allowed", "approval"]);
  const ex1 = anException({ excuses: { type: "control", ref: A1 }, subjects: ["infra/**"] });
  const excused = changeImpact(decl, ["infra/disk.tf"], newest, { at: "2026-03-10T00:00:00Z", exceptions: [ex1] });
  assertEquals([excused.verdict, excused.reasons[0]?.resolvedBy, excused.reasons[0]?.exception], ["allowed", "exception", "exc-1"]);
  assertEquals(changeImpact(decl, ["infra/disk.tf"], newest, { at: "2026-05-10T00:00:00Z", exceptions: [ex1] }).verdict, "blocked");
});

proves(["0003-grc-logical FR-007"], "coverage says gap, untested, failing, partial, stale, accepted or covered, through a crosswalk where it counts, and lists the controls with no passing check", () => {
  const c1 = aCheck("c1", [A1]);
  const c2 = aCheck("c2", [OTHER1]);
  const frameworks = [ex, other];
  const results = [aResult("c1", "h1", "pass"), aResult("c1", "h2", "fail")];
  const cov = coverage(frameworks, [walk], [c1, c2], results, AT);
  const by = Object.fromEntries(cov.map((c) => [c.urn, c]));
  assertEquals(by[A1]?.state, "partial");
  assertEquals(by[A2]?.state, "gap");
  assertEquals(by[B1]?.state, "untested");
  assertEquals(by[B1]?.via, ["ex-other"]);
  assertEquals(by[OTHER1]?.state, "untested");
  assertEquals(uncovered(cov), [A1, A2, B1, OTHER1].sort());
  const good = coverage([ex], [], [c1], [aResult("c1", "h1", "pass")], AT);
  assertEquals(good.find((c) => c.urn === A1)?.state, "covered");
  assertEquals(coverage([ex], [], [c1], [aResult("c1", "h1", "pass", { observedAt: "2026-01-01T00:00:00Z" })], AT).find((c) => c.urn === A1)?.state, "stale");
  assertEquals(coverage([ex], [], [c1], [aResult("c1", "h1", "fail")], AT).find((c) => c.urn === A1)?.state, "failing");
  assertEquals(coverage([ex], [], [c1], [aResult("c1", "h1", "accepted")], AT).find((c) => c.urn === A1)?.state, "accepted");
  const weak = must(crosswalk.decode, { ...walk, mappings: [{ from: A2, to: OTHER1, relationship: "intersects-with", strength: 9 }] });
  assertEquals(coverage(frameworks, [weak], [c2], [aResult("c2", "h1", "pass")], AT).find((c) => c.urn === A2)?.state, "gap");
});


proves(["0003-grc-logical FR-008"], "the roll-up is weighted, counts accepted apart, and is the same for any order of the results", () => {
  const rs = [aResult("a", "h", "pass"), aResult("b", "h", "fail", { severity: "low" }), aResult("c", "h", "accepted"), aResult("d", "h", "not-applicable"), aResult("e", "h", "pass", { severity: "info" })];
  const r = rollup(rs);
  assertEquals(r.counts.pass, 2);
  assertEquals(r.worst, "fail");
  assertEquals([r.weightApplicable, r.weightPassing, r.weightAccepted], [8 + 2 + 8 + 1, 8 + 1, 8]);
  assertAlmostEquals(r.share ?? -1, 17 / 19);
  assertEquals(rollup([]).share, undefined);
  assertEquals(rollup([aResult("d", "h", "not-applicable")]).share, undefined);
  fc.assert(
    fc.property(fc.shuffledSubarray(rs, { minLength: rs.length }), (shuffled) => {
      assertEquals(rollup(shuffled), r);
    }),
  );
});

proves(["0003-grc-logical FR-009"], "an applying exception turns fail and warn into accepted and keeps its id, and does not turn error, gap or pending", () => {
  const e = anException();
  const at = "2026-03-15T00:00:00Z";
  const out = applyExceptions([aResult("disk-encrypted", "host-1", "fail"), aResult("disk-encrypted", "host-2", "warn"), aResult("disk-encrypted", "host-3", "error"), aResult("disk-encrypted", "host-4", "gap"), aResult("disk-encrypted", "host-5", "pending"), aResult("other", "host-1", "fail")], [e], at);
  assertEquals(out.map((r) => r.status), ["accepted", "accepted", "error", "gap", "pending", "fail"]);
  assertEquals([out[0]?.exception, out[0]?.was], ["exc-1", "fail"]);
  assertEquals(applyExceptions([aResult("disk-encrypted", "host-1", "fail")], [e], "2026-04-01T00:00:00Z")[0]?.status, "fail");
  assertEquals(applyExceptions([aResult("disk-encrypted", "server-1", "fail")], [e], at)[0]?.status, "fail");
});

proves(["0003-grc-logical FR-010"], "a risk's level is computed from likelihood and impact by the table, and a risk past its review is reported", () => {
  assertEquals(riskLevel("moderate", "very-high"), "high");
  assertEquals(riskLevel("very-high", "very-high"), "very-high");
  assertEquals(riskLevel("very-low", "very-low"), "very-low");
  assertEquals(riskLevel("low", "very-high"), "moderate");
  for (const l of LEVELS) for (const i of LEVELS) assert(LEVELS.includes(riskLevel(l, i)));
  const mk = (id: string, level: string, reviewBy: string): Risk =>
    must(risk.decode, { kind: "grc.risk", schema: "1", id, createdAt: AT, provenance: { producer: { name: "t", version: "1" }, inputs: [] }, title: id, description: id, likelihood: "low", impact: "low", level, treatment: "mitigate", owner: "o", reviewBy, controls: [] });
  const rs = [mk("r1", "low", "2026-05-01T00:00:00Z"), mk("r2", "high", "2026-05-02T00:00:00Z"), mk("r3", "high", "2027-01-01T00:00:00Z")];
  assertEquals(risksDue(rs, AT).map((r) => r.id), ["r2", "r1"]);
});
