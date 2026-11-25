// Spec: 0003-runbooks-effects FR-003, FR-004, FR-005, FR-006, FR-008
/**
 * Autonomy, derived and never declared. The autonomy of a verb step is the cell of one table for its store class and mode; a check is autonomous, a judge only proposes, an ask and a gate are a person's, an undo has the
 * autonomy of its compensation and a branch or an each the least of the steps it holds. A gate can only raise the control over the steps it guards: their level is the less autonomous of the derived one and the one the gate
 * demands. Whether a workshop is disposable is computed from what is attached. Pure.
 *
 * @example
 * ```ts
 * import { effectAutonomy, lessAutonomous } from "./autonomy.ts";
 * lessAutonomous("agent-autonomous", "human-only"); // "human-only"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Actor } from "@intellectual-frontiers/planning/governance";
import { type Autonomy, AUTONOMY, PERSON_ONLY } from "@intellectual-frontiers/workbench/governance";
import { AUTONOMY_TABLE, type Effect, flatten, type GateAction, type Runbook, type StepId, type StoreDecl, type Step } from "@intellectual-frontiers/runbooks/governance";

/** The less autonomous of two levels: the one that leaves more to a person. */
export const lessAutonomous = (a: Autonomy, b: Autonomy): Autonomy => (AUTONOMY.indexOf(a) <= AUTONOMY.indexOf(b) ? a : b);

/** The autonomy an effect gives its step. */
export const effectAutonomy = (e: Effect): Autonomy => AUTONOMY_TABLE[e.class][e.mode];

/** The autonomy of a step before any gate: derived from what it is and what it does. */
export function derivedAutonomy(step: Step): Autonomy {
  switch (step.kind) {
    case "verb":
    case "undo":
      return effectAutonomy(step.effect);
    case "check":
      return "agent-autonomous";
    case "judge":
      return "agent-proposes";
    case "ask":
    case "gate":
      return "human-only";
    case "branch":
      return [...step.then, ...step.otherwise].map(derivedAutonomy).reduce(lessAutonomous, "agent-autonomous");
    case "each":
      return step.body.map(derivedAutonomy).reduce(lessAutonomous, "agent-autonomous");
    default:
      return absurd(step);
  }
}

/** One step with its autonomy: what was derived, what the gates make of it and the gate that raised it. */
export type StepLevel = { readonly id: StepId; readonly kind: Step["kind"]; readonly derived: Autonomy; readonly autonomy: Autonomy; readonly raisedBy?: StepId };

/** The autonomy of every step of a runbook in the order they are read: a gate lowers the autonomy of the steps it guards to its demand, never raises it. */
export function levelsOf(runbook: Runbook): readonly StepLevel[] {
  const flat = flatten(runbook.steps);
  const floors = new Map<string, { level: Autonomy; by: StepId }>();
  for (const s of flat) {
    if (s.kind !== "gate") continue;
    for (const g of s.guards) {
      const prior = floors.get(g);
      if (prior === undefined || lessAutonomous(s.demands, prior.level) !== prior.level) floors.set(g, { level: s.demands, by: s.id });
    }
  }
  return flat.map((s): StepLevel => {
    const derived = derivedAutonomy(s);
    const floor = floors.get(s.id);
    const autonomy = floor === undefined ? derived : lessAutonomous(derived, floor.level);
    return { id: s.id, kind: s.kind, derived, autonomy, ...(floor !== undefined && autonomy === floor.level && autonomy !== derived ? { raisedBy: floor.by } : {}) };
  });
}

/** The autonomy of one step of a runbook, gates included. */
export const autonomyOf = (runbook: Runbook, id: StepId): Autonomy | undefined => levelsOf(runbook).find((l) => l.id === id)?.autonomy;

/** The actions of a gate that only a person takes: approve and tag as the workbench says, and the scope of a pentest. */
export const GATE_PERSON_ONLY: readonly GateAction[] = ["approve", "tag", "pentest-scope"];

/** Whether an actor may pass a gate: only a person (an agent acting for a person does not pass it). */
export const mayPassGate = (actor: Actor): boolean => actor.kind === "person";

/** Whether the workbench would let an agent take an action at a level: the actions that are a person's never. */
export const agentCanGate = (action: GateAction): boolean => !PERSON_ONLY.includes(action as never) && !GATE_PERSON_ONLY.includes(action);

/** Whether a workshop with these stores attached is disposable: computed, never declared; it is where nothing but ephemeral stores is attached. */
export const disposable = (attached: readonly Pick<StoreDecl, "class">[]): boolean => attached.every((s) => s.class === "ephemeral");
