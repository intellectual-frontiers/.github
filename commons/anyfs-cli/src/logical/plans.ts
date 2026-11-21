// Spec: 0003-anyfs-cli-logical FR-011, FR-012
/**
 * How a plan and a report of the bridge are written for a person and as data (commons anyfs-cli 0003-anyfs-cli-logical FR-011, FR-012): the counts by kind of action, the bytes, what would be lost and the hash that
 * approves the plan, then each action in a line. And the refusals of the bridge as the problems of the catalogue, each with the command that fixes it. Pure functions over the types of the bridge.
 *
 * @example
 * ```ts
 * import { planLines } from "./plans.ts";
 * // planLines(plan).at(-1) // "plan sha256:..."
 * ```
 *
 * @module
 */
import type { Problem } from "@intellectual-frontiers/headless/governance";
import { ACTION_ORDER, describeAction, describeRefusal, type Action, type ActionKind, type Plan, type PlanRefusal } from "@intellectual-frontiers/anyfs-bridge/governance";
import type { ApplyRefusal, Report } from "@intellectual-frontiers/anyfs-bridge/logical";
import { problemOf } from "./outcomes.ts";
import { counted } from "./format.ts";

/** How many actions of each kind a plan has, in the order a plan lists them, leaving out the kinds with none. */
export function countsOf(actions: readonly Action[]): readonly { readonly kind: ActionKind; readonly count: number }[] {
  return ACTION_ORDER.map((kind) => ({ kind, count: actions.filter((a) => a.kind === kind).length })).filter((c) => c.count > 0);
}

/** The lines that say what a plan does: a header, each action, the losses, the bytes and its hash. */
export function planLines(plan: Plan, limit = 200): readonly string[] {
  const lines: string[] = [`${plan.mode} ${plan.source} -> ${plan.dest}`];
  const counts = countsOf(plan.actions);
  lines.push(counts.length === 0 ? "nothing to do" : counts.map((c) => `${c.count} ${c.kind}`).join(", "));
  plan.actions.slice(0, limit).forEach((a) => lines.push(`  ${describeAction(a)}`));
  if (plan.actions.length > limit) lines.push(`  ... and ${counted(plan.actions.length - limit, "more action")}`);
  for (const l of plan.losses) lines.push(`  loses: ${l.target}: ${l.detail}`);
  lines.push(`${plan.unchanged} unchanged, ${plan.bytes} bytes to write`);
  lines.push(`plan ${plan.hash}`);
  return lines;
}

/** The problem a refused plan is. */
export function refusalProblem(refusal: PlanRefusal): Problem {
  return problemOf("E-PLAN-REFUSED", describeRefusal(refusal));
}

/** The problem an apply that did not start is. */
export function applyRefusalProblem(refusal: ApplyRefusal): Problem {
  switch (refusal.kind) {
    case "stale":
      return problemOf("E-PLAN-STALE", `the plan approved is ${refusal.approved} and the plan made now is ${refusal.found}`);
    case "conflicts":
      return problemOf("E-CONFLICTS", `the plan has ${counted(refusal.count, "conflict")}`);
    case "lossy":
      return problemOf("E-PLAN-REFUSED", `the plan would lose ${counted(refusal.losses.length, "thing")}: ${refusal.losses.map((l) => `${l.target} (${l.kind})`).join(", ")}`);
    case "replan":
      return refusalProblem(refusal.refusal);
    case "not-applicable":
      return problemOf("E-PLAN-REFUSED", refusal.detail);
    default:
      return problemOf("E-PLAN-REFUSED", "the plan cannot be applied");
  }
}

/** The lines that say what an apply did. */
export function reportLines(report: Report): readonly string[] {
  const lines = [`${report.done} done, ${report.failed} failed, ${report.skipped} skipped, ${report.bytes} bytes written`];
  if (report.unguarded > 0) lines.push(`${counted(report.unguarded, "write")} expected no revision, because the destination cannot`);
  for (const o of report.outcomes) {
    if (o.status !== "failed") continue;
    const why = o.failure === undefined ? "" : o.failure.kind === "problem" ? `: ${o.failure.problem.kind}` : `: ${o.failure.detail}`;
    lines.push(`  failed: ${describeAction(o.action)}${why}`);
  }
  lines.push(`plan ${report.hash}`);
  return lines;
}
