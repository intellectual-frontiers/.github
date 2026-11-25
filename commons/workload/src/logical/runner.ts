// Spec: 0010-workload-runners FR-004, FR-006, FR-007, FR-008
/**
 * Which runner a run uses and whether it may, for every form. The choice resolves in one order, as the choice of a dialect does: the explicit choice made at run time, the operator's preference, the choice for the workload,
 * the choice for its form, the default of the policy (native unless the fleet says another); the first that names a runner decides. It is held to the runners that declare every capability the workload needs: a runner that
 * lacks one is refused with `E-WL-RUNNER-UNSUITABLE`, naming it and the node that needs it, and the run is never moved to another runner by itself. A form says what its workload needs (derived from its nodes, never declared);
 * the rule that turns an effect into a need, and the rest, are here. Autonomy is not an input of any function here: the choice of a runner changes none. Pure.
 *
 * @example
 * ```ts
 * import { resolveRunner } from "./runner.ts";
 * // resolveRunner(policy, { workload: "restore-drill", form: "runbook" }).runner: the native runner by default
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import { type BuiltFormId, type Effect, type Finding, finding, type Runner, type RunnerCapability, type RunnerId, type RunnerNeed, type RunnerPolicy, type RunnerRegistry, RUNNERS } from "@intellectual-frontiers/workload/governance";

/** What a run asks for: an explicit choice, the operator, the workload and its form. */
export type RunnerRequest = { readonly explicit?: RunnerId; readonly operator?: string; readonly workload: string; readonly form?: BuiltFormId };

/** Where the choice came from. */
export type RunnerChoiceSource = "explicit" | "operator" | "workload" | "form" | "default";

/** The runner a policy gives a request and the place it came from. */
export function resolveRunner(policy: RunnerPolicy, request: RunnerRequest): { readonly runner: RunnerId; readonly from: RunnerChoiceSource } {
  if (request.explicit !== undefined) return { runner: request.explicit, from: "explicit" };
  const byOperator = request.operator === undefined ? undefined : policy.perOperator[request.operator];
  if (byOperator !== undefined) return { runner: byOperator, from: "operator" };
  const byWorkload = policy.perWorkload[request.workload];
  if (byWorkload !== undefined) return { runner: byWorkload, from: "workload" };
  const byForm = request.form === undefined ? undefined : policy.perForm[request.form];
  if (byForm !== undefined) return { runner: byForm, from: "form" };
  return { runner: policy.default, from: "default" };
}

/** One need of a node, once for each capability: a list in the order of the nodes with a repeat taken out. */
export function distinctNeeds(needs: readonly RunnerNeed[]): readonly RunnerNeed[] {
  const seen = new Set<string>();
  return needs.filter((n) => !seen.has(`${n.node}|${n.capability}`) && seen.add(`${n.node}|${n.capability}`));
}

/** The need of a destroy: a destroy of a durable, git or external store needs `destroy`, unless a gate or an approval guards it, and then it needs `approval`; any other effect needs none. */
export function destroyNeed(node: string, effect: Pick<Effect, "class" | "mode">, guarded: boolean): RunnerNeed | undefined {
  if (effect.mode !== "destroy" || effect.class === "ephemeral" || effect.class === "transactional") return undefined;
  return guarded ? { capability: "approval", node, why: `a destroy of a ${effect.class} store is guarded by a person's approval` } : { capability: "destroy", node, why: `a destroy of a ${effect.class} store with no gate` };
}

/** The need of a node whose derived autonomy (gates applied) is `human-only`, that no gate guards and that is no ask and no gate: a person must act, so it needs `interactive`. */
export const personNeed = (node: string, autonomy: Autonomy): RunnerNeed | undefined => (autonomy === "human-only" ? { capability: "interactive", node, why: `${node} is human-only: a person must act` } : undefined);

/** What a runner lacks of what a workload needs: the needs whose capability it does not declare. */
export const lacksOf = (needs: readonly RunnerNeed[], runner: Runner): readonly RunnerNeed[] => distinctNeeds(needs).filter((n) => !runner.capabilities.includes(n.capability));

/** The capabilities of the needs, once each. */
export const capabilitiesOf = (needs: readonly RunnerNeed[]): readonly RunnerCapability[] => [...new Set(needs.map((n) => n.capability))];

/** Whether a workload with these needs is run by the native runner and by no other. */
export const forcesNative = (needs: readonly RunnerNeed[], registry: RunnerRegistry = RUNNERS): boolean => registry.list().filter((r) => r.kind === "integration").every((r) => lacksOf(needs, r).length > 0);

/** Whether a runner may carry a workload that has these needs, or the finding that says what it lacks. */
export function suitableRunner(workload: string, needs: readonly RunnerNeed[], runner: RunnerId, registry: RunnerRegistry = RUNNERS): Result<Runner, Finding> {
  const info = registry.get(runner);
  if (info === undefined) return err(finding("E-WL-RUNNER-UNSUITABLE", workload, `the runner ${runner} is not registered`, { runner, lacks: "it is not registered" }));
  const lacking = lacksOf(needs, info);
  if (lacking.length === 0) return ok(info);
  const lacks = lacking.map((n) => `${n.capability} (${n.node}: ${n.why})`).join(", ");
  return err(finding("E-WL-RUNNER-UNSUITABLE", workload, `the runner ${runner} cannot carry ${workload}: ${lacks}`, { runner, lacks }));
}

/** The runner a request gets for a workload: the one the policy resolves, if it may carry it, and otherwise the finding; the run is never moved. */
export function chooseRunner(policy: RunnerPolicy, request: RunnerRequest, needs: readonly RunnerNeed[], registry: RunnerRegistry = RUNNERS): Result<{ readonly runner: Runner; readonly from: RunnerChoiceSource }, Finding> {
  const choice = resolveRunner(policy, request);
  const fit = suitableRunner(request.workload, needs, choice.runner, registry);
  return fit.kind === "ok" ? ok({ runner: fit.value, from: choice.from }) : err(fit.error);
}
