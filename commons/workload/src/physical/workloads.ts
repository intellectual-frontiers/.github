// Spec: 0003-workload-forms FR-001, FR-004
/**
 * The workloads the physical layer knows, one for each form that has code: the starters, the static check, the autonomy of each node, the view the projections are made from, the catalogs and the decoder that reads a
 * workload of any form by the form it names. This is where the forms are put side by side, which no unit of the core or of the logical layer does: a form that is reserved, or none, is refused with its code.
 *
 * @example
 * ```ts
 * import { STARTERS, checkWorkload } from "./workloads.ts";
 * checkWorkload(STARTERS[0]); // []
 * ```
 *
 * @module
 */
import { absurd, err, type Result } from "@intellectual-frontiers/core";
import { type Catalog, CORE_CATALOG, type Finding, finding, isBuiltForm, type VerbRegistry, VERBS } from "@intellectual-frontiers/workload/governance";
import { type NodeLevel, type WorkloadView } from "@intellectual-frontiers/workload/logical";
import { check as checkLoop, decodeReconcile, levelsOf as loopLevels, RECONCILE_CATALOG, type Reconcile, STARTERS as RECONCILE_STARTERS, viewOf as loopView } from "@intellectual-frontiers/workload/forms/reconcile";
import { check, decodeRunbook, levelsOf, RUNBOOK_CATALOG, type Runbook, STARTERS as RUNBOOK_STARTERS, viewOf } from "@intellectual-frontiers/workload/forms/runbook";

/** A workload of a form that has code: a closed sum, one member for each form. */
export type AnyWorkload = Runbook | Reconcile;

/** The starters of every form that has code. */
export const STARTERS: readonly AnyWorkload[] = [...RUNBOOK_STARTERS, ...RECONCILE_STARTERS];

/** The catalogs there are: the core and one for each form that has code. */
export const CATALOGS: readonly Catalog[] = [CORE_CATALOG, RUNBOOK_CATALOG, RECONCILE_CATALOG];

/** The findings of a workload, by the static check of its form. */
export function checkWorkload(w: AnyWorkload, registry: VerbRegistry = VERBS): readonly Finding[] {
  switch (w.form) {
    case "runbook":
      return check(w, registry);
    case "reconcile":
      return checkLoop(w, registry);
    default:
      return absurd(w);
  }
}

/** The autonomy of each node of a workload, by the form's own derivation. */
export function levelsOfWorkload(w: AnyWorkload): readonly NodeLevel[] {
  switch (w.form) {
    case "runbook":
      return levelsOf(w);
    case "reconcile":
      return loopLevels(w);
    default:
      return absurd(w);
  }
}

/** The view of a workload that the projections are made from. */
export function viewOfWorkload(w: AnyWorkload): WorkloadView {
  switch (w.form) {
    case "runbook":
      return viewOf(w);
    case "reconcile":
      return loopView(w);
    default:
      return absurd(w);
  }
}

/** A workload of any form from a value that came from outside, or every reason it is not one: the form it names must have code. */
export function decodeWorkload(input: unknown): Result<AnyWorkload, readonly Finding[]> {
  const form: unknown = typeof input === "object" && input !== null ? Reflect.get(input, "form") : undefined;
  if (typeof form !== "string" || !isBuiltForm(form)) return err([finding("E-WL-WORKLOAD-UNKNOWN-FORM", "", `the form ${typeof form === "string" ? form : "(none)"} is not a form that has code`)]);
  switch (form) {
    case "runbook":
      return decodeRunbook(input);
    case "reconcile":
      return decodeReconcile(input);
    default:
      return absurd(form);
  }
}
