// Spec: 0002-workload-effects FR-004, FR-005, FR-006
/**
 * Autonomy, derived and never declared, the same in every form. The autonomy of an effect is the cell of one table for its store class and mode; a form maps each of its kinds of node to an effect or to a fixed level and
 * calls the functions here, so that the same effect gives the same autonomy in every form. A gate can only raise the control over the nodes it guards: their level is the less autonomous of the derived one and the one the
 * gate demands. Whether a workshop is disposable is computed from what is attached. Pure.
 *
 * @example
 * ```ts
 * import { effectAutonomy, lessAutonomous } from "./autonomy.ts";
 * lessAutonomous("agent-autonomous", "human-only"); // "human-only"
 * ```
 *
 * @module
 */
import { type Autonomy, AUTONOMY, PERSON_ONLY } from "@intellectual-frontiers/workbench/governance";
import type { Actor } from "@intellectual-frontiers/planning/governance";
import { AUTONOMY_TABLE, type Effect, type GateAction, type NodeId, type StoreDecl } from "@intellectual-frontiers/workload/governance";

/** The less autonomous of two levels: the one that leaves more to a person. */
export const lessAutonomous = (a: Autonomy, b: Autonomy): Autonomy => (AUTONOMY.indexOf(a) <= AUTONOMY.indexOf(b) ? a : b);

/** The autonomy an effect gives its node: one table for every form. */
export const effectAutonomy = (e: Effect): Autonomy => AUTONOMY_TABLE[e.class][e.mode];

/** One node with its autonomy: what was derived, what the gates make of it and the gate that raised it. */
export type NodeLevel = { readonly id: NodeId; readonly kind: string; readonly derived: Autonomy; readonly autonomy: Autonomy; readonly raisedBy?: NodeId };

/** What a gate does to the nodes it guards: the level it demands. */
export type GateFloor = { readonly id: NodeId; readonly demands: Autonomy; readonly guards: readonly NodeId[] };

/** The levels of nodes (each with its derived autonomy) once the gates are applied: a gate lowers the autonomy of the nodes it guards to its demand, and never raises it. */
export function applyGates(nodes: readonly { readonly id: NodeId; readonly kind: string; readonly derived: Autonomy }[], gates: readonly GateFloor[]): readonly NodeLevel[] {
  const floors = new Map<string, { level: Autonomy; by: NodeId }>();
  for (const g of gates) {
    for (const id of g.guards) {
      const prior = floors.get(id);
      if (prior === undefined || lessAutonomous(g.demands, prior.level) !== prior.level) floors.set(id, { level: g.demands, by: g.id });
    }
  }
  return nodes.map((n): NodeLevel => {
    const floor = floors.get(n.id);
    const autonomy = floor === undefined ? n.derived : lessAutonomous(n.derived, floor.level);
    return { id: n.id, kind: n.kind, derived: n.derived, autonomy, ...(floor !== undefined && autonomy === floor.level && autonomy !== n.derived ? { raisedBy: floor.by } : {}) };
  });
}

/** The actions of a gate that only a person takes: approve and tag as the workbench says, and the scope of a pentest. */
export const GATE_PERSON_ONLY: readonly GateAction[] = ["approve", "tag", "pentest-scope"];

/** Whether an actor may pass a gate: only a person (an agent acting for a person does not pass it). */
export const mayPassGate = (actor: Actor): boolean => actor.kind === "person";

/** Whether the workbench would let an agent take an action at a level: the actions that are a person's never. */
export const agentCanGate = (action: GateAction): boolean => !PERSON_ONLY.includes(action as never) && !GATE_PERSON_ONLY.includes(action);

/** Whether a workshop with these stores attached is disposable: computed, never declared; it is where nothing but ephemeral stores is attached. */
export const disposable = (attached: readonly Pick<StoreDecl, "class">[]): boolean => attached.every((s) => s.class === "ephemeral");
