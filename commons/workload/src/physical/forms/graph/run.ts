// Spec: 0013-form-graph FR-015, FR-016
/**
 * The native runner of the graph form: it runs the nodes of a graph in the order of its edges, one after another (a graph that is carried natively has no parallelism: that is what an integration runner adds), by the verb runner of the
 * host, and records every fact as a planning event on the work order. A node that a gate guards waits: the run parks at it, naming the gate and its approver, and goes on only when an event of a person approves the gate; a gate that
 * a person declined fails the run. A node that is done is not run again, so a run that is resumed goes on where it stopped. The autonomy of every node is the same as under any other runner.
 *
 * @example
 * ```ts
 * import { runGraph } from "./run.ts";
 * // const state = await runGraph(graph, deps)
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Actor, ItemId } from "@intellectual-frontiers/planning/governance";
import { authored, type Effect, type Finding, type Inputs, type NativeRunner, storeRef, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { check, foldGraph, type FanOut, type Graph, type GraphEvent, type GraphState, type JobNode, makeGraphEvent, orderOf } from "@intellectual-frontiers/workload/forms/graph";
import type { EventSink, ResolvedInputs, Source, VerbBindings } from "../../ports.ts";
import { runVerb } from "../../verb-runner.ts";

/** What the native runner of a graph is given: the verbs, the place events are kept, the clock, who runs, the work order, the inputs of the run and the fixed lists of the fan-outs. */
export type GraphDeps = {
  readonly registry?: VerbRegistry;
  readonly bindings: VerbBindings;
  readonly sink: EventSink;
  readonly source: Source;
  /** Who runs: a person, or an agent acting for one. */
  readonly actor: Actor;
  readonly item: ItemId;
  readonly inputs: ResolvedInputs;
  readonly fleet: (over: FanOut, source: string) => readonly string[] | undefined;
};

const READ: Effect = { store: authored(storeRef("check-reads")), class: "ephemeral", mode: "read", reversible: true };

/** Runs, or resumes, the graph on the work order `deps.item`, and gives its state: the fold of its events. */
export async function runGraph(graph: Graph, deps: GraphDeps): Promise<Result<GraphState, readonly Finding[] | string>> {
  const registry = deps.registry ?? VERBS;
  const found = check(graph, registry);
  if (found.length > 0) return err(found);
  const stateOf = async (): Promise<GraphState> => foldGraph(deps.item, await deps.sink.read(deps.item));
  const record = async (e: GraphEvent): Promise<Result<void, string>> => {
    const made = makeGraphEvent({ id: deps.source.nextEventId(), item: deps.item, at: deps.source.now(), actor: deps.actor }, e);
    return made.kind === "err" ? err(`the event is refused: ${made.error.kind}`) : deps.sink.append(made.value);
  };
  const resolve = (inputs: Inputs): Result<ResolvedInputs, string> => {
    const res: Record<string, string | number | boolean> = {};
    for (const [name, v] of Object.entries(inputs)) {
      switch (v.kind) {
        case "literal":
          res[name] = v.value;
          break;
        case "store":
          res[name] = v.store;
          break;
        case "input": {
          const x = deps.inputs[v.name];
          if (x === undefined) return err(`the run has no input ${v.name}`);
          res[name] = x;
          break;
        }
        case "output":
          return err(`${name} reads the output of ${v.step}: the edges of a graph carry no value`);
        default:
          return absurd(v);
      }
    }
    return ok(res);
  };
  const call = async (n: JobNode): Promise<Result<void, string>> => {
    switch (n.kind) {
      case "verb":
      case "check": {
        const resolved = resolve(n.inputs);
        if (resolved.kind === "err") return resolved;
        const r = await runVerb(registry, deps.bindings, n.kind === "verb" ? n.verb : n.using, n.inputs, resolved.value, n.kind === "verb" ? n.effect : READ);
        if (r.kind === "err") return err(r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
        return n.kind === "check" && r.value.holds === false ? err(`the assertion does not hold: ${n.asserts}`) : ok(undefined);
      }
      case "each": {
        const members = n.source.kind === "literal" ? deps.fleet(n.over, String(n.source.value)) : undefined;
        if (members === undefined) return err(`${n.id} has no fixed list to fan out over`);
        for (const m of members) {
          for (const b of n.body) {
            const resolved = resolve(b.inputs);
            if (resolved.kind === "err") return resolved;
            const r = await runVerb(registry, deps.bindings, b.kind === "verb" ? b.verb : b.using, b.inputs, { ...resolved.value, member: m }, b.kind === "verb" ? b.effect : READ);
            if (r.kind === "err") return err(r.error.kind === "refused" ? r.error.finding.message : r.error.reason);
          }
        }
        return ok(undefined);
      }
      default:
        return absurd(n);
    }
  };
  let state = await stateOf();
  if (state.graph === undefined || state.finished === "succeeded" || state.finished === "failed") {
    const r = await record({ kind: "started", graph: graph.id, version: graph.version });
    if (r.kind === "err") return r;
    state = await stateOf();
  }
  const gates = graph.nodes.flatMap((n) => (n.kind === "gate" ? [n] : []));
  for (const n of orderOf(graph)) {
    if (state.done.includes(n.id)) continue;
    const gate = gates.find((g) => g.guards.includes(n.id));
    if (gate !== undefined && !state.approved.includes(gate.id)) {
      if (state.declined.includes(gate.id)) {
        const r = await record({ kind: "failed", node: n.id, reason: `the gate ${gate.id} was declined` });
        if (r.kind === "err") return r;
        await record({ kind: "finished", outcome: "failed" });
      } else {
        if (state.parked[n.id] !== gate.id) {
          const r = await record({ kind: "parked", node: n.id, gate: gate.id, approver: gate.approver });
          if (r.kind === "err") return r;
        }
        await record({ kind: "finished", outcome: "parked" });
      }
      return ok(await stateOf());
    }
    const r = await call(n);
    if (r.kind === "err") {
      const rec = await record({ kind: "failed", node: n.id, reason: r.error });
      if (rec.kind === "err") return rec;
      await record({ kind: "finished", outcome: "failed" });
      return ok(await stateOf());
    }
    const rec = await record({ kind: "done", node: n.id });
    if (rec.kind === "err") return rec;
    state = await stateOf();
  }
  await record({ kind: "finished", outcome: "succeeded" });
  return ok(await stateOf());
}

/** The native runner of the graph form, behind the port of the core. */
export const GRAPH_RUNNER: NativeRunner<Graph, GraphDeps, GraphState> = { form: "graph", run: runGraph };
