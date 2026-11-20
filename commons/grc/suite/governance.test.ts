/**
 * Tests of governance (0002-grc-governance): the URN of a control, crosswalks, policy, check, requirement and the enforcement register, the evidence policy, exceptions, the problems of a set and
 * durations. Nothing runs: governance is data.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  addDuration,
  check,
  crosswalk,
  controlUrn,
  controlUrns,
  evidencePolicy,
  exception,
  exceptionApplies,
  framework,
  fromEnforcementRegister,
  governanceProblems,
  mappedControls,
  parseControlUrn,
  parseDuration,
  reviewDue,
  toEnforcementRegister,
} from "@intellectual-frontiers/grc/governance";
import { A1, A2, aCheck, anException, aRequirement, AT, B1, evidencePolicyOf, ex, other, OTHER1, policyOf, walk } from "./fixtures.ts";

proves(["0002-grc-governance FR-001"], "a control has a stable URN that is written and read back, and a duplicate control is a problem", () => {
  assertEquals(controlUrn("nist-800-53", "5.2.0", "AC-2(1)"), "urn:grc:nist-800-53:5.2.0:AC-2(1)");
  const p = parseControlUrn("urn:grc:nist-800-53:5.2.0:AC-2(1)");
  assertEquals(p.kind === "ok" ? p.value : undefined, { framework: "nist-800-53", version: "5.2.0", control: "AC-2(1)" });
  assertEquals(parseControlUrn("urn:grc:a:1:B:C").kind, "err");
  assertEquals(parseControlUrn("urn:other:a:1:B").kind, "err");
  assertEquals(controlUrns([ex]), [A1, A2, B1]);
  assert(framework.decode(ex).kind === "ok");
  const dup = { ...ex, controls: [...ex.controls, ex.controls[0]] };
  assertEquals(governanceProblems({ frameworks: [dup as typeof ex] }).map((p) => p.rule), ["framework/duplicate-control"]);
});

proves(["0002-grc-governance FR-002"], "a crosswalk maps controls in both directions and the relationship reads the other way for the reverse", () => {
  const forward = mappedControls([walk], B1);
  assertEquals(forward.map((m) => [m.urn, m.relationship, m.strength]), [[OTHER1, "subset-of", 8]]);
  const reverse = mappedControls([walk], OTHER1);
  assertEquals(reverse.map((m) => [m.urn, m.relationship]), [[B1, "superset-of"]]);
  assertEquals(mappedControls([walk], A1), []);
  assertEquals(crosswalk.decode({ ...walk, mappings: [{ from: A1, to: B1, relationship: "equal", strength: 11 }] }).kind, "err");
});

proves(["0002-grc-governance FR-003"], "a policy carries scope, severity, mappings, owner and review, and says when its review falls due", () => {
  assertEquals(policyOf.severity, "high");
  const due = reviewDue(policyOf);
  assertEquals(due, { kind: "ok", value: "2027-01-01T00:00:00.000Z" });
});

proves(["0002-grc-governance FR-004"], "a check names a runner kind and an input of data, and refuses an input that is code", () => {
  const c = aCheck("disk-encrypted", [A1]);
  assertEquals(c.runner.kind, "sql");
  const withFunction = { ...c, runner: { kind: "sql", input: { run: () => 1 } } };
  assertEquals(check.decode(withFunction).kind, "err");
  const undefinedInput = { ...c, runner: { kind: "sql", input: { a: undefined } } };
  assertEquals(check.decode(undefinedInput).kind, "err");
  assertEquals(check.decode({ ...c, expect: { kind: "nonsense" } }).kind, "err");
});

proves(["0002-grc-governance FR-005"], "a requirement's verification is a row of the enforcement register, read and written as its TSV", () => {
  const rows = [aRequirement("0001-x FR-001", "check", "bun test"), aRequirement("0001-x FR-002", "review", "0001-x FR-001")];
  const tsv = toEnforcementRegister(rows);
  const back = fromEnforcementRegister(`# a comment\n${tsv}`);
  assertEquals(back.kind === "ok" ? back.value.map((r) => [r.requirement, r.mechanism, r.by]) : [], [
    ["0001-x FR-001", "check", "bun test"],
    ["0001-x FR-002", "review", "0001-x FR-001"],
  ]);
  assertEquals(fromEnforcementRegister("a\tnope\tb\tc").kind, "err");
});

proves(["0002-grc-governance FR-006"], "an evidence policy says what counts, retention, who may attest and the custody", () => {
  assertEquals(evidencePolicyOf.custody, "file");
  assertEquals(evidencePolicy.decode({ ...evidencePolicyOf, retention: "a year" }).kind, "err");
  assertEquals(evidencePolicy.decode({ ...evidencePolicyOf, custody: "vault" }).kind, "err");
});

proves(["0002-grc-governance FR-007"], "an exception needs an expiry after its grant and does not apply at or after it", () => {
  const e = anException();
  assert(exceptionApplies(e, "host-1", "2026-03-15T00:00:00Z"));
  assert(!exceptionApplies(e, "host-1", "2026-04-01T00:00:00Z"));
  assert(!exceptionApplies(e, "host-1", "2026-03-31T00:00:00Z"));
  assert(!exceptionApplies(e, "host-1", "2026-02-28T00:00:00Z"));
  assert(!exceptionApplies(e, "server-1", "2026-03-15T00:00:00Z"));
  assertEquals(exception.decode({ ...e, expiresAt: e.grantedAt }).kind, "err");
  assertEquals(exception.decode({ ...e, expiresAt: undefined }).kind, "err");
  assertEquals(exception.decode({ ...e, acceptedRisk: { owner: "ciso", level: "moderate", reviewBy: "2026-03-20T00:00:00Z" } }).kind, "ok");
});

proves(["0002-grc-governance FR-008"], "the problems of a set are found as data", () => {
  const c = aCheck("c1", ["urn:grc:ex:1:Z-9"], { runner: { kind: "Not Stable", input: null } });
  const p = { ...policyOf, id: "p1", controls: [], checks: ["missing"] };
  const x = anException({ excuses: { type: "policy", ref: "ghost" } });
  const rules = governanceProblems({ frameworks: [ex], checks: [c, c], policies: [p], exceptions: [x] }).map((q) => q.rule);
  for (const want of ["control/unknown", "policy/unknown-check", "policy/no-control", "id/duplicate", "runner/unstable-kind", "exception/excuses-nothing"]) assert(rules.includes(want as never), want);
  assertEquals(governanceProblems({ frameworks: [ex, other], crosswalks: [walk], policies: [policyOf], checks: [aCheck("disk-encrypted", [A1])] }), []);
  assertEquals(governanceProblems({ frameworks: [ex], checks: [{ ...aCheck("c2", [A1]), freshness: "soon" }] }).map((q) => q.rule), ["duration/invalid"]);
});

proves(["0002-grc-governance FR-009"], "durations are exact: a year is 365 days, a month 30, and they add to an instant", () => {
  assertEquals(parseDuration("P1D"), { kind: "ok", value: 86_400_000 });
  assertEquals(parseDuration("PT1H"), { kind: "ok", value: 3_600_000 });
  assertEquals(parseDuration("P1M"), parseDuration("P30D"));
  assertEquals(parseDuration("P1Y"), { kind: "ok", value: 365 * 86_400_000 });
  assertEquals(parseDuration("P1W"), { kind: "ok", value: 7 * 86_400_000 });
  for (const bad of ["", "P", "PT", "1D", "P1.5D", "P1H"]) assertEquals(parseDuration(bad).kind, "err", bad);
  assertEquals(addDuration(AT, "P1D"), { kind: "ok", value: "2026-06-02T00:00:00.000Z" });
  assertEquals(addDuration("yesterday", "P1D").kind, "err");
});
