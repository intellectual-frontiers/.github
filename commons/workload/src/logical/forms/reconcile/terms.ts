// Spec: 0009-form-reconcile FR-001
/**
 * The terms of the reconcile form and its closed lists. A **reconcile** is a workload that is a loop toward a desired state: it observes the actual state and the desired state, diffs them, plans the changes, has a person
 * approve the plan by its hash, applies it and verifies that the state converged. It is level-triggered: each pass starts from what is observed now, never from a log of what changed.
 *
 * @example
 * ```ts
 * import { RECONCILE_KINDS } from "./terms.ts";
 * RECONCILE_KINDS.length; // 6
 * ```
 *
 * @module
 */

/** The six kinds of node: a closed list. */
export const RECONCILE_KINDS = ["observe", "diff", "plan", "approve", "apply", "verify"] as const;
/** One kind of node. */
export type ReconcileKind = (typeof RECONCILE_KINDS)[number];

/** What an observation is of: the state the world is in, or the state it should be in. */
export const OBSERVATIONS = ["actual", "desired"] as const;
/** One thing observed. */
export type Observation = (typeof OBSERVATIONS)[number];

/** What a change does to one named value: it creates it, updates it or deletes it. */
export const CHANGE_ACTIONS = ["create", "update", "delete"] as const;
/** One action of a change. */
export type ChangeAction = (typeof CHANGE_ACTIONS)[number];

/** The terms of the form. */
export const RECONCILE_TERMS = ["observation", "change", "plan hash", "pass"] as const;
/** One term. */
export type ReconcileTerm = (typeof RECONCILE_TERMS)[number];

/** What each term is. */
export const RECONCILE_DEFINITIONS: Readonly<Record<ReconcileTerm, string>> = {
  observation: "The state of a store read by a verb that only reads, as named values: the actual state or the desired state.",
  change: "One difference between the actual and the desired state: a value to create, update or delete.",
  "plan hash": "The SHA-256 of the canonical text of the changes of a plan: what a person approves, so that a plan that changed is not approved.",
  pass: "One evaluation of the loop from observation to verification; a new pass starts from what is observed now.",
};
