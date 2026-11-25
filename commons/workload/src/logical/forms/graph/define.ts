// Spec: 0013-form-graph FR-004, FR-005, FR-006
/**
 * The validators of a graph that are about the data and not about the world: an id used twice, a store that is not declared, a node that comes after a node that is not there (`E-GR-NEEDS-UNKNOWN`), a cycle (`E-GR-EDGE-CYCLE`),
 * a node that no result depends on (`E-GR-NODE-UNREACHABLE`), a gate that guards what is no job, a value passed from one node to another (the edges order nodes and carry no value) and an effect on a system of record with no idempotency
 * key. `defineGraph` gives the graph back or every finding. Pure.
 *
 * @example
 * ```ts
 * import { defineGraph } from "./define.ts";
 * // defineGraph(graph): a Result of the same graph, or the findings
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Effect, type Finding, finding } from "@intellectual-frontiers/workload/governance";
import { installer, installerFindings } from "@intellectual-frontiers/workload/logical";
import { graphFinding } from "./catalog.ts";
import { type BodyNode, type Graph, isJob } from "./node.ts";
import { cycleOf, jobsOf, upstreamOf } from "./order.ts";

/** The graph, or every reason it is not well formed. */
export function defineGraph(input: Graph): Result<Graph, readonly Finding[]> {
  const out: Finding[] = [];
  const bad = (node: string, message: string): void => void out.push(graphFinding("E-GR-GRAPH-MALFORMED", node, message, { node: message }));
  if (input.nodes.length === 0) bad("", "a graph has at least one node");
  const ids = new Set<string>();
  const add = (id: string): void => {
    if (ids.has(id)) bad(id, `the node id ${id} is used twice`);
    ids.add(id);
  };
  for (const n of input.nodes) {
    add(n.id);
    if (n.kind === "each") for (const b of n.body) add(b.id);
  }
  const stores = new Map(input.stores.map((s) => [String(s.ref), s]));
  if (stores.size !== input.stores.length) bad("", "a store is declared twice");
  const jobs = jobsOf(input);
  const jobIds = new Set(jobs.map((j) => String(j.id)));
  const effect = (id: string, e: Effect, inputs: Readonly<Record<string, unknown>>): void => {
    const decl = stores.get(e.store);
    if (decl === undefined) bad(id, `${id}: its effect names the store ${e.store}, which the graph does not declare`);
    else if (decl.class !== e.class) bad(id, `${id}: its effect says ${e.store} is ${e.class}, and the graph declares it ${decl.class}`);
    if (e.compensation !== undefined) bad(id, `${id}: a graph has no undo: ${e.compensation} compensates nothing`);
    if (e.class === "external" && e.mode !== "read" && (e.idempotencyKey === undefined || !Object.hasOwn(inputs, e.idempotencyKey))) out.push(finding("E-WL-EXTERNAL-NO-KEY", id, `${id} changes a system of record and names no input as its idempotency key`));
  };
  const inputsOf = (id: string, inputs: Readonly<Record<string, { readonly kind: string; readonly store?: string }>>): void => {
    for (const v of Object.values(inputs)) {
      if (v.kind === "store" && v.store !== undefined && !stores.has(v.store)) bad(id, `${id}: it names the store ${v.store}, which the graph does not declare`);
      if (v.kind === "output") bad(id, `${id}: it reads the output of another node: the edges of a graph order nodes and carry no value`);
    }
  };
  const body = (b: BodyNode): void => {
    inputsOf(b.id, b.inputs);
    if (b.kind === "verb") effect(b.id, b.effect, b.inputs);
  };
  for (const n of input.nodes) {
    out.push(...installerFindings(n));
    switch (n.kind) {
      case "verb":
        inputsOf(n.id, n.inputs);
        effect(n.id, n.effect, n.inputs);
        break;
      case "check":
        inputsOf(n.id, n.inputs);
        break;
      case "each":
        if (n.body.length === 0) bad(n.id, `${n.id}: an each has at least one call in its body`);
        for (const b of n.body) body(b);
        break;
      case "gate":
        for (const g of n.guards) if (!jobIds.has(g)) bad(n.id, `${n.id}: it guards ${g}, which is no job of the graph`);
        break;
      default:
        return n satisfies never;
    }
    if (isJob(n)) {
      for (const a of n.after) {
        if (a === n.id) out.push(graphFinding("E-GR-NEEDS-UNKNOWN", n.id, `${n.id} comes after itself`));
        else if (!jobIds.has(a)) out.push(graphFinding("E-GR-NEEDS-UNKNOWN", n.id, `${n.id} comes after ${a}, which is no job of the graph`));
      }
      if (new Set(n.after).size !== n.after.length) bad(n.id, `${n.id}: it names a node twice in its edges`);
    }
  }
  for (const n of input.needs) if (installer(n)) out.push(finding("E-WL-NEED-INSTALLER", "", `the need ${n.id} of the graph names an installer`));
  if (input.results.length === 0) bad("", "a graph has at least one result");
  for (const r of input.results) if (!jobIds.has(r)) bad(r, `the result ${r} is no job of the graph`);
  const cycle = cycleOf(input);
  if (cycle !== undefined) out.push(graphFinding("E-GR-EDGE-CYCLE", cycle[0] ?? "", `the edges make a cycle: ${cycle.join(" -> ")}`, { node: cycle.join(" -> ") }));
  else if (input.results.length > 0 && input.results.every((r) => jobIds.has(r))) {
    const live = upstreamOf(input, input.results);
    for (const j of jobs) if (!live.has(j.id)) out.push(graphFinding("E-GR-NODE-UNREACHABLE", j.id, `no result comes after ${j.id}`));
  }
  return out.length === 0 ? ok(input) : err(out);
}
