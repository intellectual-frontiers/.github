// Spec: 0007-workload-harness FR-004
/**
 * What a graph asks of the dialect that receives it, and the choice of a dialect for it: its needs, those of its nodes, and an authority for each gate, which stops for a person. The same rule every form follows.
 *
 * @example
 * ```ts
 * import { requirementsOf } from "./harness.ts";
 * // requirementsOf(graph).map((r) => r.id)
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import { type DialectId, type DialectInfo, type DialectRegistry, DIALECTS, type Finding, type HarnessPolicy } from "@intellectual-frontiers/workload/governance";
import { type ChoiceSource, chooseDialect as choose, type DialectRequest, suitable as suitableFor } from "@intellectual-frontiers/workload/logical";
import type { Graph } from "./node.ts";

/** Every requirement a graph has of its dialect: its needs, those of its nodes, and an authority for each gate. */
export function requirementsOf(graph: Graph): readonly Requirement[] {
  const out = new Map<string, Requirement>();
  for (const n of graph.needs) out.set(n.id, n);
  for (const n of graph.nodes) {
    for (const need of n.needs ?? []) out.set(need.id, need);
    if (n.kind === "gate") out.set(`person-${n.id}`, { id: `person-${n.id}`, kind: "authority", concept: "workstation", task: "run", safety: false, summary: `A gate stops for a person: ${n.title}`, gate: n.id });
  }
  return [...out.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Whether a dialect may carry a graph, or the finding that says what it lacks. */
export const suitable = (graph: Graph, dialect: DialectId, registry: DialectRegistry = DIALECTS): Result<DialectInfo, Finding> => suitableFor(graph.id, requirementsOf(graph), dialect, registry);

/** The dialect a request gets for a graph: the one the policy resolves, if it may carry it, and otherwise the finding. */
export function chooseDialect(policy: HarnessPolicy, request: Omit<DialectRequest, "workload" | "form">, graph: Graph, registry: DialectRegistry = DIALECTS): Result<{ readonly dialect: DialectId; readonly from: ChoiceSource }, Finding> {
  const r = choose(policy, { ...request, workload: graph.id, form: "graph" }, requirementsOf(graph), registry);
  return r.kind === "ok" ? ok(r.value) : err(r.error);
}
