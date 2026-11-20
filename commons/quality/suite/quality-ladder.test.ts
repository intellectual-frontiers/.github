/**
 * Tier 1 of the quality system, the part that is pure (commons 0001-quality-evidence FR-014, FR-015, FR-016, FR-026 to FR-030, FR-037 to FR-039, FR-040): the
 * evidence ladder of a requirement from runs, reviews, statements and probes made as the system makes them; the grade a requirement needs to be
 * counted proved; the review debt and the count that is never shown without its grade; freshness by time and by change; the nonconformances the
 * system opens itself; the proof register shown with its evidence; the objectives (the success criteria of the real specification) and their
 * error budgets, emitted as OpenTelemetry metrics and decoded back; and the tier a harness claims, judged against the real register.
 *
 * @module
 */
import { GENESIS } from "@intellectual-frontiers/grc/evidence";
import { decodeMetrics } from "@intellectual-frontiers/telemetry/otlp";
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { DEFAULT_CADENCES, freshnessOf } from "../src/pure/freshness.ts";
import {
  type Evidence,
  evidenceOfLedger,
  evidenceOfRun,
  gradeOfEvidence,
  gradeRequired,
  judgeDebt,
  judgeRequirement,
  nonconformancesFrom,
  parseRegister,
  registerView,
  reviewDebt,
  reviewDebtByAgent,
  reviewDebtByPerson,
  showProofCount,
  summarize,
  superseding,
} from "../src/pure/ladder.ts";
import { attest, emptyLedger, foldLedger, type LedgerEvent, ledgerFile } from "../src/pure/ledger.ts";
import {
  criteriaWithObjectives,
  evaluate,
  isMetricName,
  objectiveMetricsJson,
  objectiveProblem,
  type Objective,
  showEvaluation,
  SUGGESTED_OBJECTIVES,
} from "../src/pure/objectives.ts";
import { completionReport } from "../src/pure/render.ts";
import { judgeTier } from "../src/pure/tier.ts";
import { daysAgo, instant, judge, recordOf, TODAY } from "./quality-tier1-fixtures.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const REQ = "0001-quality-evidence FR-013";

/** The ledger a list of attestations makes. */
function ledgerOf(...inputs: readonly Parameters<typeof attest>[0][]): ReturnType<typeof foldLedger> {
  const events: LedgerEvent[] = [];
  for (const i of inputs) {
    const e = attest(i, "2026-11-15");
    assert(e.kind === "ok", e.kind === "err" ? e.error : "");
    events.push(e.value);
  }
  return foldLedger(events);
}

proves(
  ["0001-quality-evidence FR-026"],
  "a requirement's grade is the highest grade of its fresh evidence: a statement E1, a review E2, a run E3 or E4, a probe E5, and what is stale does not count",
  async () => {
    const q = await recordOf(1, [{ name: "adds", requirements: [REQ] }], { revision: "abc1234" });
    const [run3] = evidenceOfRun(q, "E3");
    const [run4] = evidenceOfRun(q, "E4");
    assert(run3 !== undefined && run4 !== undefined);
    assertEquals([gradeOfEvidence(run3), gradeOfEvidence(run4)], ["E3", "E4"]);
    const led = ledgerOf(
      { kind: "statement", requirement: REQ, by: "person", who: "A. Person" },
      { kind: "review", requirement: REQ, by: "person", who: "A. Person" },
      { kind: "probe", requirement: REQ, outcome: "pass", source: "the health probe" },
    );
    assert(led.kind === "ok");
    const [statement, review, probe] = evidenceOfLedger(led.value);
    assert(statement !== undefined && review !== undefined && probe !== undefined);
    assertEquals([statement, review, probe].map(gradeOfEvidence), ["E1", "E2", "E5"]);
    // each alone gives its grade; with all of them the highest
    assertEquals(judgeRequirement(REQ, [judge(statement)]).grade, "E1");
    assertEquals(judgeRequirement(REQ, [judge(statement), judge(review)]).grade, "E2");
    assertEquals(judgeRequirement(REQ, [judge(statement), judge(review), judge(run4)]).grade, "E4");
    const all = judgeRequirement(REQ, [judge(statement), judge(review), judge(run4), judge(probe)]);
    assertEquals(all.grade, "E5");
    assertEquals(all.freshness, "Fresh");
    // a requirement with no evidence is E0
    assertEquals(judgeRequirement(REQ, []).grade, "E0");
    // the run changed under it: its proof is stale and the requirement falls to the best of what is fresh
    const staleRun = judge(run4, TODAY, ["commons/quality/src/pure/ladder.ts"]);
    assertEquals(staleRun.freshness.state, "Stale");
    assertEquals(judgeRequirement(REQ, [judge(statement), judge(review), staleRun]).grade, "E2");
    assertEquals(judgeRequirement(REQ, [staleRun]).grade, "E0");
  },
);

proves(["0001-quality-evidence FR-016"], "a requirement is counted proved at E3, and at E4 where one of its tests is of high risk", async () => {
  assertEquals([gradeRequired("not-high"), gradeRequired("high")], ["E3", "E4"]);
  const q = await recordOf(
    2,
    [
      { name: "ordinary", requirements: ["0001-quality-evidence FR-013"] },
      { name: "risky", requirements: ["0001-quality-evidence FR-014"], risk: "high" },
    ],
    { revision: "abc1234" },
  );
  const at3 = evidenceOfRun(q, "E3");
  const at4 = evidenceOfRun(q, "E4");
  const judged = (list: readonly Evidence[], requirement: string) =>
    judgeRequirement(
      requirement,
      list.filter((e) => e.requirement === requirement).map((e) => judge(e)),
    );
  assertEquals(judged(at3, "0001-quality-evidence FR-013").proved, true);
  // the risky requirement has only an E3 run: it is not counted proved
  const risky3 = judged(at3, "0001-quality-evidence FR-014");
  assertEquals([risky3.grade, risky3.required, risky3.proved], ["E3", "E4", false]);
  const risky4 = judged(at4, "0001-quality-evidence FR-014");
  assertEquals([risky4.grade, risky4.proved], ["E4", true]);
  // a review is not a proof, whatever its grade is worth next to a statement
  const led = ledgerOf({ kind: "review", requirement: "0001-quality-evidence FR-015", by: "person", who: "A. Person" });
  assert(led.kind === "ok");
  const [review] = evidenceOfLedger(led.value);
  assert(review !== undefined);
  assertEquals(judgeRequirement("0001-quality-evidence FR-015", [judge(review)]).proved, false);
});

proves(
  ["0001-quality-evidence FR-014", "0001-quality-evidence FR-028"],
  "a count of proved requirements is shown with its grade and the review debt beside it, and refused without either; the debt does not grow without a Decision",
  async () => {
    const q = await recordOf(3, [{ name: "adds", requirements: [REQ] }], { revision: "abc1234" });
    const led = ledgerOf(
      { kind: "statement", requirement: "0021-ifqs FR-001", by: "person", who: "A. Person" },
      { kind: "review", requirement: "0001-quality-evidence FR-011", by: "person", who: "A. Person" },
      { kind: "review", requirement: "0001-quality-evidence FR-012", by: "agent", who: "a reviewing agent" },
    );
    assert(led.kind === "ok");
    const evidence = [...evidenceOfRun(q, "E4"), ...evidenceOfLedger(led.value)];
    const requirements = [...new Set(evidence.map((e) => e.requirement))].sort();
    const js = requirements.map((r) =>
      judgeRequirement(
        r,
        evidence.filter((e) => e.requirement === r).map((e) => judge(e)),
      ),
    );
    const s = summarize(js);
    assertEquals([s.proved, s.provedByGrade.E4, s.reviewDebt], [1, 1, 3]);
    assertEquals(reviewDebt(js), 3);
    const shown = showProofCount({ proved: s.proved, provedByGrade: s.provedByGrade, reviewDebt: s.reviewDebt });
    assert(shown.kind === "ok");
    assertEquals(shown.value, "1 proved (E4 1), review debt 3");
    // refused with no grade, or with no review debt, or where the grades do not add up
    const noGrade = showProofCount({ proved: 1, reviewDebt: 3 });
    assert(noGrade.kind === "err");
    assertStringIncludes(noGrade.error, "with its grade");
    const noDebt = showProofCount({ proved: 1, provedByGrade: s.provedByGrade });
    assert(noDebt.kind === "err");
    assertStringIncludes(noDebt.error, "review debt");
    assert(showProofCount({ proved: 2, provedByGrade: s.provedByGrade, reviewDebt: 0 }).kind === "err");
    // the renderings that show a count of proof carry its grade
    assertStringIncludes(completionReport(q, "E4"), "Requirements proved: 1 at grade E4");
    // the debt of a revision higher than its parent's with no Decision fails; a Decision covers it; no growth passes
    const grew = judgeDebt(2, 3, false);
    assertEquals(grew.ok, false);
    assertStringIncludes(grew.message, "grew from 2 to 3 with no Decision");
    assertEquals(judgeDebt(2, 3, true).ok, true);
    assertEquals(judgeDebt(3, 3, false).ok, true);
    assertEquals(judgeDebt(undefined, 9, false).ok, true);
  },
);

proves(
  ["0001-quality-evidence FR-051"],
  "the review debt of agents is counted apart from a person's: the two add up to the total, and the count shows both",
  () => {
    const led = ledgerOf(
      { kind: "statement", requirement: "0021-ifqs FR-001", by: "person", who: "A. Person" },
      { kind: "review", requirement: "0001-quality-evidence FR-011", by: "person", who: "A. Person" },
      { kind: "review", requirement: "0001-quality-evidence FR-012", by: "agent", who: "a reviewing agent" },
      { kind: "statement", requirement: "0021-ifqs FR-004", by: "agent", who: "a reviewing agent" },
    );
    assert(led.kind === "ok");
    const evidence = evidenceOfLedger(led.value);
    const js = [...new Set(evidence.map((e) => e.requirement))].sort().map((r) =>
      judgeRequirement(
        r,
        evidence.filter((e) => e.requirement === r).map((e) => judge(e)),
      ),
    );
    assertEquals([reviewDebt(js), reviewDebtByPerson(js), reviewDebtByAgent(js)], [4, 2, 2]);
    const s = summarize(js);
    assertEquals([s.reviewDebt, s.reviewDebtByPerson, s.reviewDebtByAgent], [4, 2, 2]);
    const shown = showProofCount({
      proved: s.proved,
      provedByGrade: s.provedByGrade,
      reviewDebt: s.reviewDebt,
      reviewDebtByAgent: s.reviewDebtByAgent,
      reviewDebtByPerson: s.reviewDebtByPerson,
    });
    assert(shown.kind === "ok");
    assertStringIncludes(shown.value, "review debt 4 (person 2, agent 2)");
    // parts that do not add up to the total are refused
    const bad = showProofCount({
      proved: 0,
      provedByGrade: s.provedByGrade,
      reviewDebt: 4,
      reviewDebtByAgent: 1,
      reviewDebtByPerson: 1,
    });
    assert(bad.kind === "err");
    // nothing with no evidence: no debt on either side
    assertEquals([reviewDebtByPerson([]), reviewDebtByAgent([])], [0, 0]);
  },
);

proves(["0001-quality-evidence FR-029"], "a review made by an agent is said so in the record and graded no higher than E2", () => {
  const led = ledgerOf({ kind: "review", requirement: REQ, by: "agent", who: "a reviewing agent" });
  assert(led.kind === "ok");
  const [review] = evidenceOfLedger(led.value);
  assert(review !== undefined && review.kind === "review");
  assertEquals(review.by, "agent");
  assertEquals(gradeOfEvidence(review), "E2");
  const j = judgeRequirement(REQ, [judge(review)]);
  assertEquals([j.grade, j.byAgent, j.proved], ["E2", true, false]);
  // the file kept on the branch says it was an agent's
  const e = attest({ kind: "review", requirement: REQ, by: "agent", who: "a reviewing agent" }, "2026-11-10");
  assert(e.kind === "ok");
  const text = ledgerFile({ schema: "ifqs-record/1", seq: 1, previous: GENESIS, event: e.value });
  assert(text.kind === "ok");
  assertStringIncludes(text.value, '"by":"agent"');
  // a person's sample of agents' reviews is a review too, recorded as a sample
  const sample = attest({ kind: "review", requirement: REQ, by: "person", who: "A. Person", sample: true }, "2026-11-10");
  assert(sample.kind === "ok" && sample.value.kind === "review");
  assertEquals(sample.value.sample, true);
});

proves(
  ["0001-quality-evidence FR-030", "0001-quality-evidence FR-047"],
  "a proof is fresh within its cadence, due in its last tenth, stale past it, and stale by change whatever its age",
  async () => {
    const q = await recordOf(4, [{ name: "adds", requirements: [REQ] }], { revision: "abc1234", endsAt: daysAgo(0) });
    const [run] = evidenceOfRun(q, "E3");
    assert(run !== undefined);
    assertEquals(
      [DEFAULT_CADENCES.run.text, DEFAULT_CADENCES.probe.text, DEFAULT_CADENCES.statement.text, DEFAULT_CADENCES.review.text],
      ["P30D", "P7D", "P90D", "P1Y"],
    );
    const at = (day: string, changes: readonly string[] = []) =>
      freshnessOf(run, changes, instant(`${day}T12:00:00.000Z`), DEFAULT_CADENCES);
    assertEquals(at("2026-11-17").state, "Fresh");
    assertEquals(at("2026-12-10").state, "Fresh");
    // the run kind's cadence is 30 days: the last tenth is the last three
    assertEquals(at("2026-12-15").state, "Due");
    assertEquals(at("2026-12-17").state, "Due");
    assertEquals(at("2026-12-18").state, "Stale");
    const byTime = at("2027-02-01");
    assertEquals([byTime.state, byTime.by], ["Stale", "time"]);
    // a file of the chain changed after the run: stale by change on the day it ran
    const byChange = at("2026-11-17", ["commons/quality/src/pure/ladder.ts"]);
    assertEquals([byChange.state, byChange.by], ["Stale", "change"]);
    assertStringIncludes(byChange.why, "ladder.ts changed after the run");
    // a stale proof does not count at its grade
    const j = judgeRequirement(REQ, [{ evidence: run, grade: "E3", freshness: byChange }]);
    assertEquals([j.grade, j.freshness, j.proved], ["E0", "None", false]);
    assert(j.stale !== undefined);
  },
);

proves(
  ["0001-quality-evidence FR-015"],
  "the system opens a nonconformance itself from a failed run and from a stale proof, once for each, with the requirement, the evidence and the reason",
  async () => {
    const failing = await recordOf(
      5,
      [{ name: "breaks", outcome: "fail", message: "expected 1, got 2", requirements: ["0001-quality-evidence FR-013"] }],
      {
        revision: "abc1234",
      },
    );
    const passing = await recordOf(6, [{ name: "adds", requirements: ["0001-quality-evidence FR-014"] }], { revision: "abc1234" });
    const evidence = [...evidenceOfRun(failing, "E3"), ...evidenceOfRun(passing, "E3")];
    const js = [
      judgeRequirement(
        "0001-quality-evidence FR-013",
        evidence.filter((e) => e.requirement === "0001-quality-evidence FR-013").map((e) => judge(e)),
      ),
      judgeRequirement(
        "0001-quality-evidence FR-014",
        evidence.filter((e) => e.requirement === "0001-quality-evidence FR-014").map((e) => judge(e, TODAY, ["tests/quality-ladder.test.ts"])),
      ),
    ];
    const opened = nonconformancesFrom(js, emptyLedger, TODAY);
    assertEquals(opened.length, 2);
    const [failed, stale] = opened;
    assert(failed?.kind === "nonconformance-opened" && stale?.kind === "nonconformance-opened");
    assertEquals([failed.id, failed.requirement, failed.cause, failed.openedBy.kind], ["NC-0001", "0001-quality-evidence FR-013", "failed", "system"]);
    assertStringIncludes(failed.reason, "breaks: expected 1, got 2");
    assertEquals(failed.evidence.traceId, failing.traceId);
    assertEquals([stale.id, stale.requirement, stale.cause], ["NC-0002", "0001-quality-evidence FR-014", "stale"]);
    assertStringIncludes(stale.reason, "stale by change");
    // folded into the ledger, they are open and no more are opened for the same proofs
    const folded = foldLedger(opened);
    assert(folded.kind === "ok");
    assertEquals(
      folded.value.nonconformances.map((n) => n.state),
      ["NonconformanceOpen", "NonconformanceOpen"],
    );
    assertEquals(nonconformancesFrom(js, folded.value, TODAY), []);
    // a run that proved nothing (every case not run) is unproven and is not a failure: no nonconformance
    const none = await recordOf(7, [{ name: "waits", outcome: "skip", reason: "no network", requirements: ["0001-quality-evidence FR-015"] }]);
    const unproven = judgeRequirement(
      "0001-quality-evidence FR-015",
      evidenceOfRun(none, "E3").map((e) => judge(e)),
    );
    assertEquals([unproven.unproven, unproven.grade, nonconformancesFrom([unproven], emptyLedger, TODAY).length], [true, "E0", 0]);
  },
);

proves(
  ["0001-quality-evidence FR-027"],
  "the proof register is shown with the grade and the day of each row's evidence, generated, with the totals and the review debt beside them",
  async () => {
    const register = parseRegister(
      "# a comment\nrequirement\tmechanism\tby\tnote\n0001-quality-evidence FR-013\tcheck\t.github: bun test\tproved\n0001-quality-evidence FR-014\tnone\t-\tPlanned\n0001-quality-evidence FR-015\treview\t0021-ifqs FR-001\treviewed\n",
    );
    assertEquals(register.length, 3);
    const q = await recordOf(8, [{ name: "adds", requirements: ["0001-quality-evidence FR-013"] }], { revision: "abc1234" });
    const led = ledgerOf({ kind: "review", requirement: "0001-quality-evidence FR-015", by: "person", who: "A. Person" });
    assert(led.kind === "ok");
    const evidence = [...evidenceOfRun(q, "E4"), ...evidenceOfLedger(led.value)];
    const by = new Map(
      register.map((r) => [
        r.requirement,
        judgeRequirement(
          r.requirement,
          evidence.filter((e) => e.requirement === r.requirement).map((e) => judge(e)),
        ),
      ]),
    );
    const text = registerView(register, by);
    const lines = text.split("\n");
    assertEquals(lines.slice(2, 6), [
      "requirement\tmechanism\tgrade\tday\tfreshness\tproved",
      "0001-quality-evidence FR-013\tcheck\tE4\t2026-11-17\tFresh\tyes",
      "0001-quality-evidence FR-014\tnone\tE0\t-\tNone\tno",
      "0001-quality-evidence FR-015\treview\tE2\t2026-11-15\tFresh\tno",
    ]);
    assertStringIncludes(text, "# 3 requirements; 1 proved (E4 1), review debt 1");
    assertStringIncludes(text, "never edit it by hand");
    // the same inputs give the same bytes
    assertEquals(registerView(register, by), text);
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- objectives

const BUDGETED: Objective = {
  id: "share",
  metric: "ifc.quality.requirements.share_tested",
  title: "the share tested",
  measure: { kind: "share-at-grade", grade: "E3" },
  comparator: "at-least",
  target: 0.8,
  unit: "1",
  budget: 0.25,
  windowDays: 4,
};

proves(
  ["0001-quality-evidence FR-037", "0001-quality-evidence FR-038"],
  "an objective is a metric with a target, a unit, an error budget and a window, computed from samples; a spent budget is stated and the remaining budget is shown",
  () => {
    const samples = (values: readonly number[]) => values.map((value, i) => ({ day: `2026-11-${String(14 + i).padStart(2, "0")}`, value }));
    const met = evaluate(BUDGETED, samples([0.9, 0.85, 0.9, 0.95]), "2026-11-17");
    assertEquals([met.state, met.samples, met.missed, met.remaining], ["met", 4, 0, 0.25]);
    // one of four samples missed: a quarter of the window, the whole budget, not more than it
    const risk = evaluate(BUDGETED, samples([0.9, 0.5, 0.9, 0.95]), "2026-11-17");
    assertEquals([risk.state, risk.missed, risk.remaining], ["at-risk", 1, 0]);
    // two of four: the budget is spent within its window
    const spent = evaluate(BUDGETED, samples([0.5, 0.5, 0.9, 0.95]), "2026-11-17");
    assertEquals([spent.state, spent.missed, spent.remaining], ["spent", 2, -0.25]);
    // a day older than the window is not in it
    const old = evaluate(BUDGETED, [{ day: "2026-11-10", value: 0.1 }, ...samples([0.9, 0.9, 0.9, 0.9])], "2026-11-17");
    assertEquals([old.samples, old.state], [4, "met"]);
    assertStringIncludes(showEvaluation(spent), "spent; error budget 25% of 4 days, -25% remaining");
    assertStringIncludes(showEvaluation(met), "met; error budget 25% of 4 days, 25% remaining");
    // a zero budget is spent by the first miss
    const none = evaluate({ ...BUDGETED, budget: 0 }, samples([0.9, 0.5, 0.9, 0.9]), "2026-11-17");
    assertEquals(none.state, "spent");
    // what is not an objective is named
    assertStringIncludes(objectiveProblem({ ...BUDGETED, metric: "Not A Metric" }) ?? "", "not a metric name");
    assertStringIncludes(objectiveProblem({ ...BUDGETED, budget: 2 }) ?? "", "error budget");
    assertEquals(objectiveProblem(BUDGETED), undefined);
    assertEquals([isMetricName("ifc.quality.review_debt"), isMetricName("review"), isMetricName("IFC.quality")], [true, false, false]);
  },
);

proves(
  ["0001-quality-evidence FR-037", "0001-quality-evidence FR-039"],
  "the success criteria of the real specification are read as objectives, and commons declares the suggested objectives, each emitted as an OpenTelemetry metric that reads back",
  () => {
    const spec = readTextFileSync(join(ROOT, "spec-kit", "specs", "0001-quality-evidence", "spec.md"));
    const criteria = criteriaWithObjectives([{ slug: "0001-quality-evidence", text: spec }], SUGGESTED_OBJECTIVES);
    assertEquals(
      criteria.map((c) => c.id),
      ["SC-001", "SC-002", "SC-003"],
    );
    // every criterion has an objective, whose problem is none
    for (const c of criteria) {
      assert(c.objective !== undefined, `${c.id} has an objective`);
      assertEquals(objectiveProblem(c.objective), undefined);
    }
    // the objectives FR-039 lists: the share at E3, the review debt, not_run, the oldest open nonconformance and the stale proofs
    assertEquals(SUGGESTED_OBJECTIVES.map((o) => o.measure.kind).sort(), [
      "not-run",
      "oldest-open-nonconformance",
      "review-debt",
      "share-at-grade",
      "stale-proofs",
      "ungraded-figures",
    ]);
    assertEquals(new Set(SUGGESTED_OBJECTIVES.map((o) => o.metric)).size, SUGGESTED_OBJECTIVES.length);
    for (const o of SUGGESTED_OBJECTIVES) assertEquals(objectiveProblem(o), undefined);
    // a criterion with no objective is listed with none, so that it is seen
    assertEquals(
      criteriaWithObjectives([{ slug: "0001-quality-evidence", text: spec }], []).every((c) => c.objective === undefined),
      true,
    );
    // emitted through the OpenTelemetry pipeline and read back
    const evals = SUGGESTED_OBJECTIVES.map((o) => evaluate(o, [{ day: TODAY, value: o.target }], TODAY));
    const json = objectiveMetricsJson(evals, { attributes: { "service.name": "ifc.quality" } }, 1_794_000_000_000_000_000n);
    assert(json.kind === "ok");
    const back = decodeMetrics(JSON.parse(json.value));
    assert(back.kind === "ok");
    const names = back.value.flatMap((b) => b.metrics.map((m) => m.name));
    for (const o of SUGGESTED_OBJECTIVES) assert(names.includes(o.metric), `${o.metric} is emitted`);
    assert(names.includes("ifc.quality.objective.target") && names.includes("ifc.quality.objective.budget.remaining"));
    // an objective whose metric is not named as OpenTelemetry names one is not emitted
    const first = evals[0];
    assert(first !== undefined);
    const bad = objectiveMetricsJson([{ ...first, objective: { ...BUDGETED, metric: "NOT A METRIC" } }], { attributes: {} }, 0n);
    assert(bad.kind === "err");
  },
);

proves(
  ["0001-quality-evidence FR-040"],
  "a tier is claimed only where every requirement of it and of the tiers below is held by a mechanism: judged against the real register",
  () => {
    const real = parseRegister(readTextFileSync(join(ROOT, "spec-kit", "enforcement.tsv")));
    // Tier 1's requirements and those of Tier 0 are held in this repository
    assertEquals(judgeTier("Tier0", real).unmet, []);
    assertEquals(judgeTier("Tier1", real).unmet, []);
    // Tier 2's are the later work (the console, the samples, the plans, mutation): not claimed
    const two = judgeTier("Tier2", real);
    assertEquals(two.claimed, false);
    assertEquals(
      two.unmet.every((r) => /0021-ifqs FR-037|FR-04[1-4]/.test(r)),
      true,
    );
    // a register where a requirement of Tier 0 is held by none refuses Tier 1, though Tier 1's own are held
    const synthetic = real.map((r) => (r.requirement === "0001-quality-evidence FR-021" ? { ...r, mechanism: "none" } : r));
    const refused = judgeTier("Tier1", synthetic);
    assertEquals([refused.claimed, refused.unmet], [false, ["0001-quality-evidence FR-021"]]);
    // an empty register holds nothing
    assertEquals(judgeTier("Tier0", []).unmet.length, 8);
    // the claim is superseded in order: evidence of runs does not stand in for the register
    assertEquals(superseding([]).length, 0);
  },
);
