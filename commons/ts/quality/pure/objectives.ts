/**
 * Quality objectives (commons 0021-ifqs FR-032 to FR-034): a success criterion of a specification (`SC-nnn`) read as an objective with a
 * metric named as OpenTelemetry names one (0006-signals FR-013), a target, a unit, an error budget and the window it is spent in; its measure
 * is computed from the evidence and never typed in; WHEN the budget is spent within the window the system opens a nonconformance, and WHILE
 * budget remains the remainder is shown with the objective. The quality system's own objectives (FR-034) are the suggested set here.
 *
 * - A **measure** is one of a few computations over the evidence (the share of requirements at a grade, the review debt, the count of
 *   `not_run` cases, the age of the oldest open nonconformance, the number of stale proofs, the number of figures shown with no grade).
 * - An **error budget** is the share of the window's samples that may miss the target (0 to 1): the objective is `spent` when more of the
 *   window's samples missed than the budget allows, `at-risk` when some missed within the budget, and `met` when none did.
 * - The objectives are emitted as OpenTelemetry metrics (FR-002): gauges through `kernel/otel.ts` and `otlp.ts`.
 *
 * @example
 * ```ts
 * import { evaluate, SUGGESTED_OBJECTIVES } from "./objectives.ts";
 * // evaluate(SUGGESTED_OBJECTIVES[0], [{ day: "2026-11-16", value: 0.9 }], "2026-11-17").state === "met"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Attributes, type Metric, type Resource } from "@intellectual-frontiers/telemetry/otel";
import { encodeMetrics, type MetricBatch } from "@intellectual-frontiers/telemetry/otlp";
import { TEST_SCOPE } from "@intellectual-frontiers/test/record";
import { type Grade } from "./names.ts";
import { type Summary, shareAtOrAbove } from "./ladder.ts";
import { daysBetween } from "./ledger.ts";

/** What an objective measures: each is computed from the evidence (FR-032). */
export type Measure =
  | { readonly kind: "share-at-grade"; readonly grade: Grade }
  | { readonly kind: "review-debt" }
  | { readonly kind: "not-run" }
  | { readonly kind: "oldest-open-nonconformance" }
  | { readonly kind: "stale-proofs" }
  | { readonly kind: "ungraded-figures" };

/** Whether a measure should be at least, or at most, its target. */
export type Comparator = "at-least" | "at-most";

/** A quality objective (`ifqs:QualityObjective`). */
export type Objective = {
  /** Its identifier, stable. */
  readonly id: string;
  /** The OpenTelemetry metric that carries it (lower case, dotted, as 0006-signals FR-013 names metrics). */
  readonly metric: string;
  readonly title: string;
  readonly measure: Measure;
  readonly comparator: Comparator;
  readonly target: number;
  /** The unit of the metric, in UCUM as OpenTelemetry takes it. */
  readonly unit: string;
  /** The share of the window's samples allowed to miss the target, from 0 to 1. */
  readonly budget: number;
  /** The window, in days, the budget is spent in. */
  readonly windowDays: number;
  /** The success criterion it reads, `NNNN-slug SC-nnn`, where it reads one. */
  readonly criterion?: string;
};

/** What a measure is computed from. */
export type MeasureFacts = {
  readonly summary: Summary;
  /** Cases that did not run in the newest run of each requirement. */
  readonly notRun: number;
  readonly oldestOpenDays: number;
  /** Requirements the index lists with no grade (none, by construction: the check that holds it). */
  readonly ungraded: number;
};

/** A measure's value from the facts (FR-032). */
export function measureOf(m: Measure, f: MeasureFacts): number {
  switch (m.kind) {
    case "share-at-grade":
      return shareAtOrAbove(f.summary, m.grade);
    case "review-debt":
      return f.summary.reviewDebt;
    case "not-run":
      return f.notRun;
    case "oldest-open-nonconformance":
      return f.oldestOpenDays;
    case "stale-proofs":
      return f.summary.stale;
    case "ungraded-figures":
      return f.ungraded;
    default:
      return absurd(m);
  }
}

/** The metric names of OpenTelemetry's convention: lower case words and digits with `_`, in dotted namespaces of at least two names. */
export function isMetricName(name: string): boolean {
  return /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(name);
}

/** What is wrong with an objective, or nothing (FR-032: a metric named as OpenTelemetry names it, a target, a unit, a budget and a window). */
export function objectiveProblem(o: Objective): string | undefined {
  if (!isMetricName(o.metric)) return `${o.id}: ${JSON.stringify(o.metric)} is not a metric name`;
  if (!Number.isFinite(o.target)) return `${o.id}: the target is not a number`;
  if (o.unit.trim() === "") return `${o.id}: no unit`;
  if (!(o.budget >= 0 && o.budget <= 1)) return `${o.id}: the error budget is a share from 0 to 1`;
  if (!Number.isInteger(o.windowDays) || o.windowDays < 1) return `${o.id}: the window is a number of days, at least 1`;
  return undefined;
}

/** The quality system's own objectives, suggested to a harness (FR-034): the share at `E3` or above, the review debt, `not_run`, the age of the oldest open nonconformance and the stale proofs. */
export const SUGGESTED_OBJECTIVES: readonly Objective[] = [
  {
    id: "share-tested",
    metric: "ifc.quality.requirements.share_tested",
    title: "The share of requirements with evidence at E3 or above",
    measure: { kind: "share-at-grade", grade: "E3" },
    comparator: "at-least",
    target: 0.8,
    unit: "1",
    budget: 0.1,
    windowDays: 30,
    criterion: "0021-ifqs SC-001",
  },
  {
    id: "review-debt",
    metric: "ifc.quality.review_debt",
    title: "The review debt: requirements held at E1 or E2",
    measure: { kind: "review-debt" },
    comparator: "at-most",
    target: 10,
    unit: "{requirement}",
    budget: 0.1,
    windowDays: 30,
  },
  {
    id: "not-run",
    metric: "ifc.quality.cases.not_run",
    title: "The cases planned and not run",
    measure: { kind: "not-run" },
    comparator: "at-most",
    target: 0,
    unit: "{case}",
    budget: 0.05,
    windowDays: 30,
  },
  {
    id: "oldest-nonconformance",
    metric: "ifc.quality.nonconformance.oldest_open_age",
    title: "The age of the oldest open nonconformance",
    measure: { kind: "oldest-open-nonconformance" },
    comparator: "at-most",
    target: 14,
    unit: "d",
    budget: 0,
    windowDays: 30,
    criterion: "0021-ifqs SC-002",
  },
  {
    id: "stale-proofs",
    metric: "ifc.quality.proofs.stale",
    title: "The proofs that are stale",
    measure: { kind: "stale-proofs" },
    comparator: "at-most",
    target: 0,
    unit: "{proof}",
    budget: 0.05,
    windowDays: 30,
  },
  {
    id: "ungraded-figures",
    metric: "ifc.quality.figures.ungraded",
    title: "The figures of proof shown with no grade",
    measure: { kind: "ungraded-figures" },
    comparator: "at-most",
    target: 0,
    unit: "{figure}",
    budget: 0,
    windowDays: 30,
    criterion: "0021-ifqs SC-003",
  },
];

/** A measure on a day. */
export type Sample = { readonly day: string; readonly value: number };

/** How an objective stands: `met` (no sample of its window missed), `at-risk` (some missed, within the budget) or `spent` (more missed than the budget allows). */
export type ObjectiveState = "met" | "at-risk" | "spent";

/** An objective evaluated (FR-032, FR-033). */
export type Evaluation = {
  readonly objective: Objective;
  /** The newest measure. */
  readonly value: number;
  readonly state: ObjectiveState;
  /** Samples in the window, and how many of them missed the target. */
  readonly samples: number;
  readonly missed: number;
  /** The budget that remains, as a share of the window's samples (negative where it is overspent); shown with the objective. */
  readonly remaining: number;
};

const misses = (o: Objective, v: number): boolean => (o.comparator === "at-least" ? v < o.target : v > o.target);

/** An objective evaluated against its samples at `today`: those of the window ending that day, the newest being the value (FR-032, FR-033). */
export function evaluate(o: Objective, samples: readonly Sample[], today: string): Evaluation {
  const inWindow = samples
    .filter((s) => {
      const age = daysBetween(s.day, today);
      return age >= 0 && age < o.windowDays;
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const missed = inWindow.filter((s) => misses(o, s.value)).length;
  const value = inWindow[inWindow.length - 1]?.value ?? 0;
  const spent = inWindow.length === 0 ? 0 : missed / inWindow.length;
  const state: ObjectiveState = spent > o.budget ? "spent" : missed > 0 ? "at-risk" : "met";
  return { objective: o, value, state, samples: inWindow.length, missed, remaining: o.budget - spent };
}

/** The objective an evaluation shows: its value against its target and the budget that remains (FR-033). */
export function showEvaluation(e: Evaluation): string {
  const o = e.objective;
  const percent = (n: number): string => `${Math.round(n * 1000) / 10}%`;
  const unit = o.unit === "1" ? "" : ` ${o.unit}`;
  const number = (n: number): string => String(Math.round(n * 1000) / 1000);
  return `${o.id}: ${number(e.value)}${unit} (${o.comparator === "at-least" ? "at least" : "at most"} ${number(o.target)}), ${e.state}; error budget ${percent(o.budget)} of ${o.windowDays} days, ${percent(e.remaining)} remaining`;
}

/** The requirement the nonconformance of a spent budget names. */
export function objectiveSubject(o: Objective): string {
  return `objective:${o.id}`;
}

// ---------------------------------------------------------------------------------------------------------------------------- success criteria

/** A success criterion of a specification, and the objective that reads it where one is declared. */
export type Criterion = { readonly spec: string; readonly id: string; readonly text: string; readonly objective?: Objective };

/** The success criteria of a specification's text (`- **SC-001**: ...`), in order. */
export function criteriaOf(spec: string, text: string): readonly { readonly spec: string; readonly id: string; readonly text: string }[] {
  const out: { readonly spec: string; readonly id: string; readonly text: string }[] = [];
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    const m = /^\s*-\s*\*\*(SC-\d{3}[a-z]?)\*\*:\s*(.*)$/.exec(line);
    if (m?.[1] !== undefined) out.push({ spec, id: m[1], text: (m[2] ?? "").trim() });
  }
  return out;
}

/**
 * The success criteria of the specifications read as quality objectives (FR-032): each criterion with the objective declared for it (an
 * objective whose `criterion` is `NNNN-slug SC-nnn`); a criterion with none is listed with no objective, so that it is seen.
 */
export function criteriaWithObjectives(
  specs: readonly { readonly slug: string; readonly text: string }[],
  declared: readonly Objective[],
): readonly Criterion[] {
  return specs.flatMap((s) =>
    criteriaOf(s.slug, s.text).map((c): Criterion => {
      const o = declared.find((d) => d.criterion === `${c.spec} ${c.id}`);
      return o === undefined ? c : { ...c, objective: o };
    }),
  );
}

// ---------------------------------------------------------------------------------------------------------------------------- OpenTelemetry (FR-002)

/** The metric batches of evaluations (FR-002): each objective's value as a gauge named by its metric, and its target and remaining budget, at `time`. */
export function objectiveMetrics(evals: readonly Evaluation[], resource: Resource, time: bigint): readonly MetricBatch[] {
  const attrs = (e: Evaluation): Attributes => ({ "ifc.objective.id": e.objective.id, "ifc.objective.state": e.state });
  const point = (e: Evaluation, value: number): { attributes: Attributes; startTime: bigint; time: bigint; value: number } => ({
    attributes: attrs(e),
    startTime: time,
    time,
    value,
  });
  const metrics: Metric[] = [
    ...evals.map((e): Metric => ({
      name: e.objective.metric,
      description: e.objective.title,
      unit: e.objective.unit,
      data: { kind: "gauge", points: [point(e, e.value)] },
    })),
    {
      name: "ifc.quality.objective.target",
      description: "The target of each quality objective",
      unit: "1",
      data: { kind: "gauge", points: evals.map((e) => point(e, e.objective.target)) },
    },
    {
      name: "ifc.quality.objective.budget.remaining",
      description: "The error budget each quality objective has left, as a share of its window",
      unit: "1",
      data: { kind: "gauge", points: evals.map((e) => point(e, e.remaining)) },
    },
  ];
  return [{ resource, scope: TEST_SCOPE, metrics }];
}

/** The metrics as an OTLP/JSON `ExportMetricsServiceRequest` (FR-002), or why an objective cannot be emitted. */
export function objectiveMetricsJson(evals: readonly Evaluation[], resource: Resource, time: bigint): Result<string, string> {
  for (const e of evals) {
    const problem = objectiveProblem(e.objective);
    if (problem !== undefined) return err(problem);
  }
  return ok(`${JSON.stringify(encodeMetrics(objectiveMetrics(evals, resource, time)), null, 2)}\n`);
}
