// Spec: 0009-form-reconcile FR-005
/**
 * The autonomy of each kind of node of the reconcile form, derived and never declared. An apply has the autonomy of its effect (the one table of the core, the same in every form); an observe, a diff, a plan and a verify only
 * read or compute and are autonomous; an approve is a person's. An approve can only raise the control over the applies it guards. Pure.
 *
 * @example
 * ```ts
 * import { derivedAutonomy } from "./autonomy.ts";
 * // derivedAutonomy(node)
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { NodeId } from "@intellectual-frontiers/workload/governance";
import { applyGates, effectAutonomy, type NodeLevel } from "@intellectual-frontiers/workload/logical";
import type { Reconcile, ReconcileNode } from "./node.ts";

/** The autonomy of a node before any approval: derived from what it is and what it does. */
export function derivedAutonomy(node: ReconcileNode): Autonomy {
  switch (node.kind) {
    case "observe":
    case "diff":
    case "plan":
    case "verify":
      return "agent-autonomous";
    case "approve":
      return "human-only";
    case "apply":
      return effectAutonomy(node.effect);
    default:
      return absurd(node);
  }
}

/** The autonomy of every node of a loop in the order they are read: an approve lowers the autonomy of the applies it guards to its demand, never raises it. */
export function levelsOf(loop: Reconcile): readonly NodeLevel[] {
  return applyGates(
    loop.nodes.map((n) => ({ id: n.id, kind: n.kind, derived: derivedAutonomy(n) })),
    loop.nodes.flatMap((n) => (n.kind === "approve" ? [{ id: n.id, demands: n.demands, guards: n.guards }] : [])),
  );
}

/** The autonomy of one node of a loop, approvals included. */
export const autonomyOf = (loop: Reconcile, id: NodeId): Autonomy | undefined => levelsOf(loop).find((l) => l.id === id)?.autonomy;
