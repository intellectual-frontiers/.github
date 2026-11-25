// Spec: 0013-form-graph FR-010
/**
 * The dry run of a graph: what would happen, said with no effect and no event. It refuses a graph with a finding, gives the nodes in the order of the graph with the autonomy derived for each and what stops for a person, and
 * evaluates the preconditions with the workbench only: the requirements the graph is given and the needs of the nodes that read, against facts a probe made.
 *
 * @example
 * ```ts
 * import { plan } from "./plan.ts";
 * // plan(graph, { contract, facts, today })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Contract } from "@intellectual-frontiers/workbench/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";
import { type Finding, type Plan, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { buildPlan, workloadContribution } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import type { Graph } from "./node.ts";

/** What a dry run is given. */
export type PlanInput = { readonly contract: Contract; readonly facts: Facts; readonly today: string; readonly registry?: VerbRegistry };

/** The plan of a graph, or the findings that refuse it. */
export function plan(graph: Graph, input: PlanInput): Result<Plan, readonly Finding[]> {
  const found = check(graph, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const reading = graph.nodes.filter((n) => n.kind === "check" || (n.kind === "verb" && n.effect.mode === "read")).map((n) => n.id);
  return ok(
    buildPlan({
      head: graph,
      form: "graph",
      nodes: levelsOf(graph).map((l) => ({ id: l.id, kind: l.kind, autonomy: l.autonomy, stopsForPerson: l.kind === "gate" || l.autonomy === "human-only" })),
      reading: workloadContribution(graph, graph.nodes, reading),
      contract: input.contract,
      facts: input.facts,
      today: input.today,
    }),
  );
}
