// Spec: 0005-workload-runs FR-006
/**
 * A workload is a unit of the workbench, whatever its form. `workloadContribution` makes what it contributes for the nodes selected for a run: the needs of the workload and of each selected node, and nothing of a node that
 * is not selected, so that the workbench composes them lazily with `compose` for the unit named for the workload. A form says which nodes a run reaches from what it knows of its own branching; this module only composes. Pure.
 *
 * @example
 * ```ts
 * import { workloadContribution } from "./contribution.ts";
 * // workloadContribution(head, nodes, selectedIds)
 * ```
 *
 * @module
 */
import type { Contribution, Requirement } from "@intellectual-frontiers/workbench/governance";
import type { NodeHead, WorkloadHead } from "@intellectual-frontiers/workload/governance";

/** What the workload contributes to the workbench for the selected nodes: its own needs and theirs, each requirement once, in the order of their ids. */
export function workloadContribution(head: Pick<WorkloadHead, "id" | "needs">, nodes: readonly Pick<NodeHead, "id" | "needs">[], selected: readonly string[]): Contribution {
  const chosen = new Set<string>(selected);
  const byId = new Map<string, Requirement>();
  for (const n of head.needs) byId.set(n.id, n);
  for (const s of nodes) if (chosen.has(s.id)) for (const n of s.needs ?? []) byId.set(n.id, n);
  return { unit: head.id, requirements: [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}
