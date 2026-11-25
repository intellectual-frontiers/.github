// Spec: 0005-workload-runs FR-006
/**
 * A runbook is a unit of the workbench. `runbookContribution` makes what it contributes for the steps selected for a run, with the composition of the core, and `selectSteps` says which steps a run reaches from what is
 * known of its branches and its fan outs: a step behind a branch not taken, or an each with no member, is not reached, and an arm of a branch that has not been decided yet is not reached either. A dry run needs only
 * the needs of the steps that read.
 *
 * @example
 * ```ts
 * import { runbookContribution, selectSteps } from "./contribution.ts";
 * // runbookContribution(runbook, selectSteps(runbook, { taken: new Map(), members: new Map() }))
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Contribution } from "@intellectual-frontiers/workbench/governance";
import { workloadContribution } from "@intellectual-frontiers/workload/logical";
import { flatten, type Runbook, type Step, type StepId } from "./step.ts";

/** What is decided of a run so far: which arm each branch took and how many members each fan out has. */
export type Decisions = { readonly taken: ReadonlyMap<StepId, "then" | "otherwise">; readonly members: ReadonlyMap<StepId, number> };

/** The steps a run reaches, in order: the top level always, a branch's arm where it is decided, an each's body where it has members. */
export function selectSteps(runbook: Runbook, decisions: Decisions): readonly StepId[] {
  const out: StepId[] = [];
  const walk = (steps: readonly Step[]): void => {
    for (const s of steps) {
      out.push(s.id);
      switch (s.kind) {
        case "branch": {
          const arm = decisions.taken.get(s.id);
          if (arm !== undefined) walk(arm === "then" ? s.then : s.otherwise);
          break;
        }
        case "each":
          if ((decisions.members.get(s.id) ?? 0) > 0) walk(s.body);
          break;
        case "verb":
        case "check":
        case "ask":
        case "judge":
        case "gate":
        case "undo":
          break;
        default:
          return absurd(s);
      }
    }
  };
  walk(runbook.steps);
  return out;
}

/** Whether a step only reads: a check, a verb whose effect is a read. */
export const isReading = (s: Step): boolean => s.kind === "check" || (s.kind === "verb" && s.effect.mode === "read");

/** The steps of a runbook that read, the only ones a dry run needs. */
export const readingSteps = (runbook: Runbook): readonly StepId[] => flatten(runbook.steps).filter(isReading).map((s) => s.id);

/** What the runbook contributes to the workbench for the selected steps: its own needs and theirs, each requirement once, in the order of their ids. */
export const runbookContribution = (runbook: Runbook, selected: readonly StepId[]): Contribution => workloadContribution(runbook, flatten(runbook.steps), selected);
