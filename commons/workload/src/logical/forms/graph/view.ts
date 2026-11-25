// Spec: 0004-workload-projections FR-010
/**
 * The view of a graph that the projections are made from: the same shape for every form, with the nodes in the order of the graph, the edges said in the title of the line a reader sees, and what the form tells an agent that
 * runs it (the graph is carried by an integration runner, and the agent never approves a gate).
 *
 * @example
 * ```ts
 * import { viewOf } from "./view.ts";
 * // viewOf(graph).nodes.map((n) => n.id)
 * ```
 *
 * @module
 */
import type { ViewNode, WorkloadView } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import type { Graph } from "./node.ts";

/** The view of a graph. */
export function viewOf(graph: Graph): WorkloadView {
  const byId = new Map(graph.nodes.map((n) => [String(n.id), n]));
  const nodes = levelsOf(graph).map((l): ViewNode => {
    const n = byId.get(l.id);
    const who = n === undefined ? "" : n.kind === "gate" || l.autonomy === "human-only" ? "a person acts" : l.autonomy === "agent-proposes" ? "the agent proposes and a person applies" : "the agent acts";
    const keep = n === undefined ? "" : n.kind === "gate" ? `; approver ${n.approver}, never the author` : n.kind === "check" ? `; keep the ${n.evidence} as evidence` : "";
    const verb = n === undefined ? undefined : n.kind === "verb" ? n.verb : n.kind === "check" ? n.using : undefined;
    const evidence = n === undefined ? undefined : n.kind === "check" ? `${n.evidence}: ${n.asserts}` : undefined;
    const after = n === undefined || n.kind === "gate" || n.after.length === 0 ? "" : ` (after ${n.after.join(", ")})`;
    return {
      id: l.id,
      kind: l.kind,
      title: `${n?.title ?? ""}${after}`,
      derived: l.derived,
      autonomy: l.autonomy,
      ...(l.raisedBy === undefined ? {} : { raisedBy: l.raisedBy }),
      who,
      keep,
      ...(verb === undefined ? {} : { verb }),
      controls: n?.controls ?? [],
      spec: n?.spec ?? [],
      ...(evidence === undefined ? {} : { evidence }),
      scenario: n === undefined ? "none" : n.kind === "check" ? "then" : "when",
      says: n === undefined ? "" : n.kind === "check" ? n.asserts : n.title,
    };
  });
  return {
    id: graph.id,
    form: "graph",
    title: graph.title,
    version: graph.version,
    summary: graph.summary,
    trigger: graph.trigger,
    ...(graph.expect === undefined ? {} : { expect: graph.expect }),
    inputs: graph.inputs,
    given: graph.given,
    nodes,
    needsPerson: graph.nodes.some((n) => n.kind === "gate"),
    howToRun: "A graph is carried by an integration runner that a foreign system executes: hand it off by its plan hash and read the receipt. Run its nodes in the order listed, each after the nodes it names; a gate is a person's approval and an agent never approves it.",
  };
}
