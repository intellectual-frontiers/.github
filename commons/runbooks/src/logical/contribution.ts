// Spec: 0008-runbooks-runs FR-007
/**
 * A runbook is a unit of the workbench. `runbookContribution` makes what it contributes for the steps selected for a run: the needs of the runbook and of each selected step, and nothing of a step that is not selected, so that
 * the workbench composes them lazily with `compose` for the unit named for the runbook. `selectSteps` says which steps a run reaches from what is known of its branches and its fans out: a step behind a branch not taken,
 * or an each with no member, is not reached, and an arm of a branch that has not been decided yet is not reached either. A dry run needs only the needs of the steps that read.
 *
 * @example
 * ```ts
 * import { runbookContribution, selectSteps } from "./contribution.ts";
 * // runbookContribution(runbook, selectSteps(runbook, { taken: new Map(), members: new Map() }))
 * ```
 *
 * @module
 */
import type { Contribution, Requirement } from "@intellectual-frontiers/workbench/governance";
import { absurd } from "@intellectual-frontiers/core";
import { flatten, type Runbook, type Step, type StepId } from "@intellectual-frontiers/runbooks/governance";

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
export function runbookContribution(runbook: Runbook, selected: readonly StepId[]): Contribution {
  const chosen = new Set<string>(selected);
  const byId = new Map<string, Requirement>();
  for (const n of runbook.needs) byId.set(n.id, n);
  for (const s of flatten(runbook.steps)) if (chosen.has(s.id)) for (const n of s.needs ?? []) byId.set(n.id, n);
  return { unit: runbook.id, requirements: [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}
