// Spec: 0005-workload-runs FR-005
/**
 * The dry run of any form, said with no effect and no event: the nodes in order with the autonomy derived for each and what stops for a person, and the preconditions evaluated with the workbench only (the requirements the
 * workload is given and the needs of the nodes that read, against facts a probe made). A form checks its workload first and refuses one with a finding; this module builds the plan from what the form hands it. Pure.
 *
 * @example
 * ```ts
 * import { buildPlan } from "./plan.ts";
 * // buildPlan({ head, form, nodes, reading, contract, facts, today })
 * ```
 *
 * @module
 */
import type { Contract, Contribution, Requirement } from "@intellectual-frontiers/workbench/governance";
import { evaluate, type Facts } from "@intellectual-frontiers/workbench/logical";
import type { BuiltFormId, Plan, PlannedNode, WorkloadHead } from "@intellectual-frontiers/workload/governance";

/** What a form hands the builder of a plan. */
export type PlanParts = {
  readonly head: Pick<WorkloadHead, "id" | "given">;
  readonly form: BuiltFormId;
  readonly nodes: readonly PlannedNode[];
  /** What the workload contributes for the nodes that read: its own needs and theirs. */
  readonly reading: Contribution;
  readonly contract: Contract;
  readonly facts: Facts;
  readonly today: string;
};

/** The plan of a workload: the requirements the workbench would evaluate and the preconditions against the facts. */
export function buildPlan(p: PlanParts): Plan {
  const all = [...p.contract.base, ...p.contract.contributions.flatMap((c) => c.requirements)];
  const given = p.head.given.map((id) => all.find((r) => r.id === id));
  const requirements = new Map<string, Requirement>();
  for (const r of given) if (r !== undefined) requirements.set(r.id, r);
  for (const r of p.reading.requirements) requirements.set(r.id, r);
  const list = [...requirements.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    workload: p.head.id,
    form: p.form,
    nodes: p.nodes,
    requirements: list,
    unknownGiven: p.head.given.filter((_, i) => given[i] === undefined),
    preconditions: evaluate(list, p.facts, p.today, p.contract.enforceFrom),
  };
}
