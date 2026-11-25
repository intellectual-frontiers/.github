// Spec: 0003-workload-forms FR-001
/**
 * The logic of the runbook form, as the contract of a form wants it: its id, its closed sum of node kinds, `validate` (the static check), `plan` (the dry run) and `fold` (the run events to a state). Its executor, behind a
 * port, is in the physical layer. The outcome a run finished with is said in the three words every form shares.
 *
 * @example
 * ```ts
 * import { RUNBOOK_FORM } from "./form.ts";
 * RUNBOOK_FORM.id; // "runbook"
 * ```
 *
 * @module
 */
import type { FormLogic, Outcome } from "@intellectual-frontiers/workload/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import { check } from "./check.ts";
import { foldRun, type RunState } from "./events.ts";
import { plan } from "./plan.ts";
import type { Runbook } from "./step.ts";
import { STEP_KINDS } from "./terms.ts";

/** The logic of the runbook form. */
export const RUNBOOK_FORM: FormLogic<Runbook, RunState, Facts> = {
  id: "runbook",
  nodeKinds: STEP_KINDS,
  validate: check,
  plan,
  fold: foldRun,
};

/** What a run of a runbook finished with, in the words every form shares; nothing while it is not finished. */
export const outcomeOf = (state: RunState): Outcome | undefined => (state.finished === undefined ? undefined : state.finished === "succeeded" ? "completes" : state.finished === "parked" ? "parks" : "fails");
