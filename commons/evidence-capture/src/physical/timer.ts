// Spec: 0005-evidence-capture-views FR-006
/**
 * The one timer that runs the collector (0005-evidence-capture-views FR-006): how often it fires follows from the shortest cadence of the capture policy, in whole steps of the clock, and it is installed and removed with the scheduler code of the commons (systemd, launchd or Task
 * Scheduler). What the timer runs, and where, is the caller's: it gives the argument vector and the folder.
 *
 * @example
 * ```ts
 * import { timerEvery } from "./timer.ts";
 * // timerEvery(policy) is { kind: "minutes", every: 15 } for a cadence of 15 minutes
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { freshnessWindowMs, type CapturePolicy } from "@intellectual-frontiers/estate/governance";
import { parseDuration } from "@intellectual-frontiers/grc/governance";
import { jobName, MINUTE_STEPS, planJob, schedule, type JobPlan, type JobSpec, type SchedulerOs } from "@intellectual-frontiers/system/job-plan";

/**
 * How often the one timer fires: the largest step of the clock (1, 2, 3, 4, 5, 6, 10, 12, 15, 20 or 30 minutes) that is not longer than the shortest cadence of the policy, so that nothing due waits for the next firing; every hour where the shortest
 * cadence is an hour or more. The collector decides, on each firing, which assets are due.
 */
export function timerEvery(policy: CapturePolicy): { readonly kind: "minutes"; readonly every: number } | { readonly kind: "hourly" } {
  const cadences = [policy.cadence.managed, policy.cadence.adopted, ...Object.values(policy.cadence.perRole), ...Object.values(policy.cadence.perAsset)].map((c) => parseDuration(c)).flatMap((r) => (r.kind === "ok" ? [r.value] : []));
  const shortest = Math.min(...cadences);
  const minutes = Math.floor(shortest / 60_000);
  if (minutes >= 60) return { kind: "hourly" };
  return { kind: "minutes", every: [...MINUTE_STEPS].reverse().find((s) => s <= Math.max(1, minutes)) ?? 1 };
}

/** What the timer is made from: the plan, the job and how often it fires, and the freshness window of the policy. */
export type Timer = { readonly job: JobSpec; readonly plan: JobPlan; readonly firesEvery: string; readonly windowMs: number };

/** What the timer runs and where: the name it is known by, the argument vector, the folder, the scheduler, the home folder and the user. */
export type TimerSpec = { readonly name: string; readonly owner: { readonly domain: string; readonly folder: string }; readonly argv: readonly string[]; readonly workdir: string; readonly os: SchedulerOs; readonly home: string; readonly uid?: number };

/** The timer of a collector for a capture policy and a scheduler. */
export function timerFor(policy: CapturePolicy, s: TimerSpec): Result<Timer, string> {
  const every = timerEvery(policy);
  const when = schedule(every.kind === "minutes" ? { kind: "minutes", every: every.every } : { kind: "hourly", minute: 0 });
  if (when.kind === "err") return err(when.error.message);
  const name = jobName(s.name);
  if (name.kind === "err") return err(name.error.message);
  const job: JobSpec = { name: name.value, owner: s.owner, argv: s.argv, workdir: s.workdir, when: when.value };
  const plan = planJob(job, { os: s.os, home: s.home, ...(s.uid === undefined ? {} : { uid: s.uid }) });
  if (plan.kind === "err") return err(`${plan.error.field}: ${plan.error.message}`);
  const cadences = [policy.cadence.managed, policy.cadence.adopted].map((c) => parseDuration(c)).flatMap((r) => (r.kind === "ok" ? [r.value] : []));
  return ok({ job, plan: plan.value, firesEvery: every.kind === "minutes" ? `${every.every} minutes` : "hour", windowMs: freshnessWindowMs(Math.min(...cadences)) });
}

