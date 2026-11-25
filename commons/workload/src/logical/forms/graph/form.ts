// Spec: 0003-workload-forms FR-001
/**
 * The logic of the graph form, as the contract of a form wants it: its id, its closed sum of node kinds, `validate` (the static check), `plan` (the dry run) and `fold` (the run events and the hand-off to a state). Its native
 * runner, behind a port, is in the physical layer, and the integration runner that carries it (GitHub Actions) is an instance of the runners. The outcome a run finished with is said in the three words every form shares.
 *
 * @example
 * ```ts
 * import { GRAPH_FORM } from "./form.ts";
 * GRAPH_FORM.id; // "graph"
 * ```
 *
 * @module
 */
import type { FormLogic } from "@intellectual-frontiers/workload/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import { check } from "./check.ts";
import { foldGraph, type GraphState } from "./events.ts";
import type { Graph } from "./node.ts";
import { plan } from "./plan.ts";
import { GRAPH_KINDS } from "./terms.ts";

/** The logic of the graph form. */
export const GRAPH_FORM: FormLogic<Graph, GraphState, Facts> = {
  id: "graph",
  nodeKinds: GRAPH_KINDS,
  validate: check,
  plan,
  fold: foldGraph,
};
