// Spec: 0003-workload-forms FR-001
/**
 * The logic of the reconcile form, as the contract of a form wants it: its id, its closed sum of node kinds, `validate` (the static check), `plan` (the dry run) and `fold` (the events of a pass to a state). Its executor, behind
 * a port, is in the physical layer. What a pass finished with is said in the three words every form shares.
 *
 * @example
 * ```ts
 * import { RECONCILE_FORM } from "./form.ts";
 * RECONCILE_FORM.id; // "reconcile"
 * ```
 *
 * @module
 */
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import type { FormLogic, Outcome } from "@intellectual-frontiers/workload/governance";
import { check } from "./check.ts";
import { foldReconcile, type ReconcileState } from "./events.ts";
import type { Reconcile } from "./node.ts";
import { plan } from "./plan.ts";
import { RECONCILE_KINDS } from "./terms.ts";

/** The logic of the reconcile form. */
export const RECONCILE_FORM: FormLogic<Reconcile, ReconcileState, Facts> = {
  id: "reconcile",
  nodeKinds: RECONCILE_KINDS,
  validate: check,
  plan,
  fold: foldReconcile,
};

/** What a pass finished with, in the words every form shares; nothing while it is not finished. */
export const outcomeOf = (state: ReconcileState): Outcome | undefined => (state.finished === undefined ? undefined : state.finished === "converged" ? "completes" : state.finished === "parked" ? "parks" : "fails");
