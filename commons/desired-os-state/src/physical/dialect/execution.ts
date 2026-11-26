// Spec: 0004-desired-os-state-dialects FR-005
/**
 * The plan of steps for the executor of headless, made from the plan of Desired OS State and the steps of a dialect. A step that destroys something must be able to check first, and every step names the
 * digest of what was rendered in its argument vector, so that the hash of the execution plan, the one a person approves, covers what is rendered.
 *
 * @example
 * ```ts
 * import { executionPlanOf } from "./execution.ts";
 * // executionPlanOf(plan, rendered, dialect.steps(plan, rendered)) is a Result of an ExecutionPlan, or nothing to do
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseStepId, planOf, type ExecStep, type ExecutionPlan } from "@intellectual-frontiers/headless/logical";
import type { RequirementId } from "@intellectual-frontiers/desired-os-state/governance";
import type { Plan, PlanEntry } from "@intellectual-frontiers/desired-os-state/logical";
import type { DialectStep, Rendered } from "./types.ts";

/** Why a plan of steps could not be made. */
export type ExecutionProblem =
  | { readonly kind: "unknown-entry"; readonly step: number; readonly id: RequirementId }
  | { readonly kind: "digest-not-named"; readonly step: number }
  | { readonly kind: "executor"; readonly message: string };

function isDestructive(e: PlanEntry): boolean {
  return e.change === "destructive" || e.action === "remove";
}

/** The plan of steps for a plan and the steps of a dialect, or why it cannot be made; nothing where the plan changes nothing. A destructive step with no check is refused by the plan of headless, and the problem says so. */
export function executionPlanOf(plan: Plan, rendered: Rendered, steps: readonly DialectStep[]): Result<ExecutionPlan | undefined, readonly ExecutionProblem[]> {
  if (plan.entries.every((e) => e.action === "none")) return ok(undefined);
  const problems: ExecutionProblem[] = [];
  const out: ExecStep[] = [];
  steps.forEach((s, index) => {
    const n = index + 1;
    const covered = s.covers.map((id) => ({ id, entry: plan.entries.find((e) => e.id === id) }));
    for (const c of covered) if (c.entry === undefined) problems.push({ kind: "unknown-entry", step: n, id: c.id });
    if (![...s.apply, ...(s.check ?? [])].some((arg) => arg.includes(rendered.digest))) problems.push({ kind: "digest-not-named", step: n });
    const id = parseStepId(`step-${n}`);
    if (id.kind === "err") return;
    const destructive = covered.some((c) => c.entry !== undefined && isDestructive(c.entry));
    const base = { id: id.value, summary: s.summary, effect: destructive ? ("destructive" as const) : ("mutate" as const), apply: s.apply, check: s.check };
    out.push(s.changedExit === undefined ? base : { ...base, changedExit: s.changedExit });
  });
  if (problems.length > 0) return err(problems);
  const made = planOf(plan.subject.name, out);
  if (made.kind === "err") return err(made.error.map((p): ExecutionProblem => ({ kind: "executor", message: p.message })));
  return ok(made.value);
}
