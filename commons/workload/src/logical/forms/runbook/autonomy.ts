// Spec: 0008-form-runbook FR-008
/**
 * The autonomy of each kind of step of the runbook form, derived and never declared. A verb step has the autonomy of its effect (the one table of the core, the same in every form); a check is autonomous, a judge only
 * proposes, an ask and a gate are a person's, an undo has the autonomy of its compensation's effect and a branch or an each the least of the steps it holds. A gate can only raise the control over the steps it guards. Pure.
 *
 * @example
 * ```ts
 * import { derivedAutonomy } from "./autonomy.ts";
 * // derivedAutonomy(step)
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import { applyGates, effectAutonomy, lessAutonomous, type NodeLevel } from "@intellectual-frontiers/workload/logical";
import { flatten, type Runbook, type Step, type StepId } from "./step.ts";

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
export type StepLevel = NodeLevel;

/** The autonomy of every step of a runbook in the order they are read: a gate lowers the autonomy of the steps it guards to its demand, never raises it. */
export function levelsOf(runbook: Runbook): readonly StepLevel[] {
  const flat = flatten(runbook.steps);
  return applyGates(
    flat.map((s) => ({ id: s.id, kind: s.kind, derived: derivedAutonomy(s) })),
    flat.flatMap((s) => (s.kind === "gate" ? [{ id: s.id, demands: s.demands, guards: s.guards }] : [])),
  );
}

/** The autonomy of one step of a runbook, gates included. */
export const autonomyOf = (runbook: Runbook, id: StepId): Autonomy | undefined => levelsOf(runbook).find((l) => l.id === id)?.autonomy;
