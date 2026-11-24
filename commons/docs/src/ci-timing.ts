// Spec: 0001-docs FR-047
/**
 * How long the pipelines take (docs 0001-docs FR-047): from the runs that passed, the median and the 90th percentile of a workflow's wall time, the slowest jobs with their slowest step, and the
 * typed targets the wall times are held against. A target missed is a finding the page names and the pipeline never fails for (commons 0038-build-policy).
 *
 * @module
 */
import type { WorkflowRuns } from "./evidence.ts";

/** What a workflow's median wall time, in seconds, is held to. */
export type BuildTimeTarget = { readonly workflow: string; readonly medianSeconds: number };

/** The targets (the owner's: a typical push is green in under five minutes; the others are what the pipelines have to fit in beside it). */
export const BUILD_TIME_TARGETS: readonly BuildTimeTarget[] = [
  { workflow: "ci", medianSeconds: 300 },
  { workflow: "tests", medianSeconds: 180 },
  { workflow: "site", medianSeconds: 240 },
];

/** The median of numbers, 0 where there are none. */
export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};

/** The 90th percentile of numbers (nearest rank), 0 where there are none. */
export const p90 = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)] ?? 0;
};

/** One job over the timed runs. */
export type JobTime = { readonly name: string; readonly runs: number; readonly medianSeconds: number; readonly p90Seconds: number; readonly slowestStep: string; readonly slowestStepSeconds: number };

/** A workflow's time. */
export type WorkflowTime = { readonly name: string; readonly runs: number; readonly medianSeconds: number; readonly p90Seconds: number; readonly jobs: readonly JobTime[] };

/** The wall time of each run of the workflow that passed, in seconds. */
const wallOf = (w: WorkflowRuns): readonly number[] =>
  w.runs
    .filter((r) => r.conclusion === "success" && r.startedAt !== undefined && r.updatedAt !== undefined)
    .map((r) => Math.max(0, Math.round((Date.parse(r.updatedAt ?? "") - Date.parse(r.startedAt ?? "")) / 1000)))
    .filter((s) => Number.isFinite(s));

/** The time of a workflow: the wall time of its runs that passed, and the slowest `top` jobs of the timed runs, by median. */
export function timeOf(w: WorkflowRuns, top = 10): WorkflowTime {
  const wall = wallOf(w);
  const byJob = new Map<string, { seconds: number[]; step: { name: string; seconds: number } }>();
  for (const t of w.timing)
    for (const j of t.jobs) {
      const at = byJob.get(j.name) ?? { seconds: [], step: { name: "", seconds: 0 } };
      at.seconds.push(j.seconds);
      const s = j.steps[0];
      if (s !== undefined && s.seconds > at.step.seconds) at.step = s;
      byJob.set(j.name, at);
    }
  const jobs = [...byJob.entries()]
    .map(([name, v]): JobTime => ({ name, runs: v.seconds.length, medianSeconds: median(v.seconds), p90Seconds: p90(v.seconds), slowestStep: v.step.name, slowestStepSeconds: v.step.seconds }))
    .sort((a, b) => b.medianSeconds - a.medianSeconds || (a.name < b.name ? -1 : 1))
    .slice(0, top);
  return { name: w.name, runs: wall.length, medianSeconds: median(wall), p90Seconds: p90(wall), jobs };
}

/** The workflows whose median wall time is over their target: each a finding to name, never a failure. */
export function overTarget(times: readonly WorkflowTime[], targets: readonly BuildTimeTarget[] = BUILD_TIME_TARGETS): readonly { readonly workflow: string; readonly medianSeconds: number; readonly targetSeconds: number }[] {
  return targets.flatMap((t) => {
    const w = times.find((x) => x.name === t.workflow);
    return w !== undefined && w.runs > 0 && w.medianSeconds > t.medianSeconds ? [{ workflow: t.workflow, medianSeconds: w.medianSeconds, targetSeconds: t.medianSeconds }] : [];
  });
}
