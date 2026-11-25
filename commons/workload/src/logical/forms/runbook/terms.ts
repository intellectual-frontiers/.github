// Spec: 0008-form-runbook FR-001
/**
 * The terms of the runbook form and its closed lists. A **runbook** is a workload that is a procedure: its nodes, which this form calls steps, are an algebra of eight kinds. A **step** is one element of it; a
 * **checkpoint** is a step that makes a restore point of a store before it is changed.
 *
 * @example
 * ```ts
 * import { STEP_KINDS } from "./terms.ts";
 * STEP_KINDS.length; // 8
 * ```
 *
 * @module
 */

/** The eight kinds of step: a closed list. */
export const STEP_KINDS = ["verb", "check", "ask", "judge", "branch", "each", "gate", "undo"] as const;
/** One kind of step. */
export type StepKind = (typeof STEP_KINDS)[number];

/** What an `each` fans out over. */
export const EACH_KINDS = ["tenants", "hosts", "fleets"] as const;
/** One thing to fan out over. */
export type EachKind = (typeof EACH_KINDS)[number];

/** The terms of the runbook form. */
export const RUNBOOK_TERMS = ["step", "checkpoint"] as const;
/** One term. */
export type RunbookTerm = (typeof RUNBOOK_TERMS)[number];

/** What each term is. */
export const RUNBOOK_DEFINITIONS: Readonly<Record<RunbookTerm, string>> = {
  step: "One element of a runbook: a verb, a check, an ask, a judge, a branch, an each, a gate or an undo.",
  checkpoint: "A step that makes a restore point of a store before it is changed.",
};
