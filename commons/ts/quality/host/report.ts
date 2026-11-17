/**
 * What the quality system says of a repository, from what `gather` read (commons 0021-ifqs FR-007, FR-019, FR-023, FR-032, FR-033): the
 * objectives evaluated over their windows, the nonconformances to open (from failed and stale proofs and from spent error budgets), and the
 * index of the branch.
 *
 * @remarks
 * The samples of an objective are replayed from the branch: for each day that has a run or a record, the requirements are judged as they stood
 * that day (by time: what changed in Git is the present's to judge, FR-025), and the present day carries the real judgement. So the same branch
 * gives the same index, with no clock.
 *
 * @module
 */
import { instantOf } from "../../kernel/grc.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Cadences, DEFAULT_CADENCES, freshnessOf } from "../pure/freshness.ts";
import { buildIndex } from "../pure/index-file.ts";
import { gradeOfEvidence, judgeRequirement, type Judged, nonconformancesFrom, summarize, superseding } from "../pure/ladder.ts";
import { applyEvent, type LedgerEvent, oldestOpenDays, openNonconformance } from "../pure/ledger.ts";
import {
  type Evaluation,
  evaluate,
  type MeasureFacts,
  measureOf,
  type Objective,
  objectiveSubject,
  type Sample,
  showEvaluation,
} from "../pure/objectives.ts";
import type { Gathered } from "./gather.ts";

/** The facts the measures are computed from, as they stood at the end of a day, judged by time (FR-025). */
export function factsAt(g: Gathered, day: string, cadences: Cadences = DEFAULT_CADENCES): MeasureFacts {
  const at = instantOf(`${day}T23:59:59.999Z`);
  const upTo = g.evidence.filter((e) => e.day <= day);
  const requirements = [...new Set([...g.register.map((r) => r.requirement), ...upTo.map((e) => e.requirement)])].sort();
  const judgements = requirements.map((r) => {
    const judged: Judged[] = superseding(upTo.filter((e) => e.requirement === r)).map((e) => ({
      evidence: e,
      grade: gradeOfEvidence(e),
      freshness: at === undefined ? { state: "Fresh", by: "time", why: "no clock" } : freshnessOf(e, [], at, cadences),
    }));
    return judgeRequirement(r, judged, { declaration: g.declaration, today: day });
  });
  const newest = g.runs.filter((r) => r.day <= day).sort((a, b) => (a.day + a.traceId < b.day + b.traceId ? 1 : -1))[0];
  const open = g.ledger.ledger.nonconformances.filter((n) => n.openedOn <= day && (n.closedOn === undefined || n.closedOn > day));
  return {
    summary: summarize(judgements),
    notRun: newest?.notRun ?? 0,
    oldestOpenDays: oldestOpenDays({ ...g.ledger.ledger, nonconformances: open }, day),
    ungraded: 0,
  };
}

/** The days that have a sample: each with a run or a record on the branch, and the day itself. */
function sampleDays(g: Gathered, today: string): readonly string[] {
  const ledger = g.ledger.ledger;
  return [
    ...new Set([
      ...g.runs.map((r) => r.day),
      ...ledger.attestations.map((a) => a.day),
      ...ledger.nonconformances.map((n) => n.openedOn),
      ...ledger.nonconformances.flatMap((n) => (n.closedOn === undefined ? [] : [n.closedOn])),
      today,
    ]),
  ]
    .filter((d) => d <= today)
    .sort();
}

/** Each objective evaluated at `today` over the days of its window (FR-032, FR-033): earlier days replayed from the branch, today as `gather` judged it. */
export function evaluateObjectives(
  g: Gathered,
  objectives: readonly Objective[],
  today: string,
  cadences: Cadences = DEFAULT_CADENCES,
): readonly Evaluation[] {
  const days = sampleDays(g, today);
  const replayed = new Map(days.filter((d) => d !== today).map((d) => [d, factsAt(g, d, cadences)] as const));
  const present: MeasureFacts = {
    summary: summarize(g.judgements),
    notRun: g.runs.filter((r) => r.day <= today).sort((a, b) => (a.day + a.traceId < b.day + b.traceId ? 1 : -1))[0]?.notRun ?? 0,
    oldestOpenDays: oldestOpenDays(g.ledger.ledger, today),
    ungraded: 0,
  };
  return objectives.map((o) => {
    const samples: Sample[] = [...replayed].map(([day, facts]) => ({ day, value: measureOf(o.measure, facts) }));
    samples.push({ day: today, value: measureOf(o.measure, present) });
    return evaluate(o, samples, today);
  });
}

/** The events that open the nonconformances called for (FR-007, FR-033): from failed and stale proofs, and from each objective whose error budget is spent. */
export function openings(g: Gathered, evaluations: readonly Evaluation[], today: string): readonly LedgerEvent[] {
  const events = [...nonconformancesFrom(g.judgements, g.ledger.ledger, today)];
  let l = g.ledger.ledger;
  for (const e of events) {
    const next = applyEvent(l, e);
    if (next.kind === "ok") l = next.value;
  }
  for (const e of evaluations) {
    if (e.state !== "spent") continue;
    const made = openNonconformance(
      l,
      {
        requirement: objectiveSubject(e.objective),
        cause: "budget-spent",
        reason: `the error budget is spent: ${showEvaluation(e)}`,
        evidence: {},
      },
      today,
    );
    if (made.kind === "err") continue;
    events.push(made.value);
    const next = applyEvent(l, made.value);
    if (next.kind === "ok") l = next.value;
  }
  return events;
}

/** The index of the branch (FR-019): objectives evaluated as of the newest day on the branch, with no clock. */
export function indexOf(
  g: Gathered,
  objectives: readonly Objective[],
  cadences: Cadences = DEFAULT_CADENCES,
): Result<{ readonly text: string; readonly evaluations: readonly Evaluation[] }, string> {
  const evaluations = evaluateObjectives(g, objectives, g.asOf, cadences);
  const built = buildIndex({
    ...(g.tip === undefined ? {} : { tip: g.tip }),
    ...(g.head === undefined ? {} : { head: g.head }),
    asOf: g.asOf,
    runs: g.runs.map((r) => ({
      traceId: r.traceId,
      path: r.path,
      day: r.day,
      ...(r.revision === undefined ? {} : { revision: r.revision }),
      grade: r.grade,
      tests: r.tests,
      passed: r.passed,
      failed: r.failed,
      notRun: r.notRun,
    })),
    judgements: g.judgements,
    ledger: g.ledger.ledger,
    objectives: evaluations,
  });
  return built.kind === "ok" ? ok({ text: built.value, evaluations }) : err(built.error);
}
