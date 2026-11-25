// Spec: 0013-form-graph FR-003
/**
 * The autonomy of each kind of node of the graph form, derived and never declared, and the same as in every form: a verb has the autonomy of its effect (the one table of the core), a check is autonomous, an each the least of the calls
 * of its body, a gate is a person's. A gate can only raise the control over the nodes it guards. The runner that carries the graph changes none of it. Pure.
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
import { applyGates, effectAutonomy, lessAutonomous, type NodeLevel } from "@intellectual-frontiers/workload/logical";
import type { BodyNode, Graph, GraphNode } from "./node.ts";

/** The autonomy of a node before any gate: derived from what it is and what it does. */
export function derivedAutonomy(node: GraphNode | BodyNode): Autonomy {
  switch (node.kind) {
    case "verb":
      return effectAutonomy(node.effect);
    case "check":
      return "agent-autonomous";
    case "gate":
      return "human-only";
    case "each":
      return node.body.map(derivedAutonomy).reduce(lessAutonomous, "agent-autonomous");
    default:
      return absurd(node);
  }
}

/** The autonomy of every node of a graph in the order they are written: a gate lowers the autonomy of the nodes it guards to its demand, never raises it. */
export function levelsOf(graph: Graph): readonly NodeLevel[] {
  return applyGates(
    graph.nodes.map((n) => ({ id: n.id, kind: n.kind, derived: derivedAutonomy(n) })),
    graph.nodes.flatMap((n) => (n.kind === "gate" ? [{ id: n.id, demands: n.demands, guards: n.guards }] : [])),
  );
}

/** The autonomy of one node of a graph, gates included. */
export const autonomyOf = (graph: Graph, id: NodeId): Autonomy | undefined => levelsOf(graph).find((l) => l.id === id)?.autonomy;
