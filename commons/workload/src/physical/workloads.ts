// Spec: 0003-workload-forms FR-001, FR-004; 0010-workload-runners FR-004, FR-016; 0013-form-graph FR-001
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
import { type CallPlan, type Catalog, CORE_CATALOG, type Finding, finding, isBuiltForm, type RunnerNeed, type VerbRegistry, VERBS } from "@intellectual-frontiers/workload/governance";
import { type NodeLevel, type WorkloadView } from "@intellectual-frontiers/workload/logical";
import { check as checkLoop, decodeReconcile, levelsOf as loopLevels, RECONCILE_CATALOG, type Reconcile, runnerNeedsOf as loopNeeds, STARTERS as RECONCILE_STARTERS, viewOf as loopView } from "@intellectual-frontiers/workload/forms/reconcile";
import { callsOf as graphCalls, check as checkGraph, decodeGraph, GRAPH_CATALOG, type Graph, levelsOf as graphLevels, runnerNeedsOf as graphNeeds, STARTERS as GRAPH_STARTERS, viewOf as graphView } from "@intellectual-frontiers/workload/forms/graph";
import { callsOf, type CallsInput, check, decodeRunbook, levelsOf, RUNBOOK_CATALOG, type Runbook, runnerNeedsOf, STARTERS as RUNBOOK_STARTERS, viewOf } from "@intellectual-frontiers/workload/forms/runbook";

/** A workload of a form that has code: a closed sum, one member for each form. */
export type AnyWorkload = Runbook | Reconcile | Graph;

/** The starters of every form that has code. */
export const STARTERS: readonly AnyWorkload[] = [...RUNBOOK_STARTERS, ...RECONCILE_STARTERS, ...GRAPH_STARTERS];

/** The catalogs there are: the core and one for each form that has code. */
export const CATALOGS: readonly Catalog[] = [CORE_CATALOG, RUNBOOK_CATALOG, RECONCILE_CATALOG, GRAPH_CATALOG];

/** The findings of a workload, by the static check of its form. */
export function checkWorkload(w: AnyWorkload, registry: VerbRegistry = VERBS): readonly Finding[] {
  switch (w.form) {
    case "runbook":
      return check(w, registry);
    case "reconcile":
      return checkLoop(w, registry);
    case "graph":
      return checkGraph(w, registry);
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
    case "graph":
      return graphLevels(w);
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
    case "graph":
      return graphView(w);
    default:
      return absurd(w);
  }
}

/** What a workload needs of a runner, by the form's own derivation from its nodes. */
export function runnerNeedsOfWorkload(w: AnyWorkload): readonly RunnerNeed[] {
  switch (w.form) {
    case "runbook":
      return runnerNeedsOf(w);
    case "reconcile":
      return loopNeeds(w);
    case "graph":
      return graphNeeds(w);
    default:
      return absurd(w);
  }
}

/** The plan of calls of a workload, or the findings that refuse it: a form that cannot lower to calls is refused with `E-WL-RUNNER-EMIT-UNSUPPORTED`. */
export function callsOfWorkload(w: AnyWorkload, input: CallsInput): Result<CallPlan, readonly Finding[]> {
  switch (w.form) {
    case "runbook":
      return callsOf(w, input);
    case "graph":
      return graphCalls(w, input);
    case "reconcile":
      return err([finding("E-WL-RUNNER-EMIT-UNSUPPORTED", "", `${w.id} is of the form reconcile, which a person approves by the hash of its plan: it has no plan of calls and the native runner runs it`, { node: "the reconcile" })]);
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
    case "graph":
      return decodeGraph(input);
    default:
      return absurd(form);
  }
}
