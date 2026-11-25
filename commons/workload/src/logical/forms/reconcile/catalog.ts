// Spec: 0009-form-reconcile FR-011
/**
 * The catalog of what can go wrong with a reconcile that no other form shares, `E-RC-<CONCEPT>-<KIND>`: a loop that is not well formed, an apply that no approval of its plan guards, a loop that applies and never verifies, and
 * a plan whose changes do more than the effect of its apply may do. What every form shares is a code of the core, `E-WL-...`.
 *
 * @example
 * ```ts
 * import { reconcileFinding } from "./catalog.ts";
 * reconcileFinding("E-RC-APPLY-UNAPPROVED", "apply-changes", "no approval").safety; // true
 * ```
 *
 * @module
 */
import { type Catalog, type CatalogEntry, entry, type Finding, makeFinding } from "@intellectual-frontiers/workload/governance";

/** The concepts of a problem of a reconcile. */
export const RECONCILE_CONCEPTS = ["loop", "apply", "verify"] as const;

/** The codes of the catalog of the reconcile form. */
export type ReconcileCode = "E-RC-LOOP-MALFORMED" | "E-RC-APPLY-UNAPPROVED" | "E-RC-APPLY-EXCEEDS-PLAN" | "E-RC-VERIFY-MISSING";

/** The entries: one for each code, held by the compiler. */
export const RECONCILE_ENTRIES: Readonly<Record<ReconcileCode, CatalogEntry<ReconcileCode>>> = {
  "E-RC-LOOP-MALFORMED": entry("E-RC-LOOP-MALFORMED", "loop", "malformed", "The loop is not well formed", "A value is not of the type the loop declares, an id is used twice, a node names a node that is not where it must be, or the loop lacks the observation of the actual or the desired state.", "agent", "correct the loop where the message says: {node}"),
  "E-RC-APPLY-UNAPPROVED": entry("E-RC-APPLY-UNAPPROVED", "apply", "unapproved", "An apply that needs a person has no approval of its plan", "The effect of the apply is not autonomous and no approve node of the same plan, before it, guards it, so a plan could be applied that no person approved by its hash.", "person", "decide who may apply {node}: add an approve node of its plan before it that guards it", true),
  "E-RC-APPLY-EXCEEDS-PLAN": entry("E-RC-APPLY-EXCEEDS-PLAN", "apply", "exceeds-plan", "The plan does more than the effect of its apply is declared to do", "A change of the plan needs a mode above the mode the apply declares (a create appends, an update mutates, a delete destroys), so it would do what its autonomy was not derived for.", "agent", "declare an effect of {node} that covers every change of the plan, or narrow the plan", true),
  "E-RC-VERIFY-MISSING": entry("E-RC-VERIFY-MISSING", "verify", "missing", "A loop applies and never verifies", "An apply is not followed by a verify node, so nothing says the state converged.", "agent", "add a verify node after {node}"),
};

/** The catalog of the reconcile form. */
export const RECONCILE_CATALOG: Catalog<ReconcileCode> = { owner: "the reconcile form", prefix: "E-RC-", concepts: RECONCILE_CONCEPTS, entries: RECONCILE_ENTRIES };

/** A finding of the catalog of the reconcile form. */
export const reconcileFinding = (code: ReconcileCode, node: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding => makeFinding(RECONCILE_ENTRIES[code], node, message, vars);
