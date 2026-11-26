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

