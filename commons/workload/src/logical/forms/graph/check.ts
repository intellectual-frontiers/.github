// Spec: 0013-form-graph FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * The static check of a graph: the catalogs applied to its nodes. It finds a node that comes after a node that is not there, a cycle and a node no result depends on (`define`), an effect above the limit of the graph
 * (`E-GR-NODE-EFFECT-OVER-LIMIT`), permissions with `write` that no effect of the node needs (`E-GR-PERMISSION-EXCESS`), a gate that guards nothing and, with the checks every form shares, a node that cites nothing, a verb the
 * registry does not hold, inputs that do not fit, an effect above its verb's, a need of a verb nobody declares and a check that does more than read. Every finding is an error, and a graph with a finding is not planned or emitted. Pure.
 *
 * @example
 * ```ts
 * import { check } from "./check.ts";
 * // check(graph): [] where the graph keeps every rule
 * ```
 *
 * @module
 */
import { type Finding, finding, modeRank, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { citationFinding, externalKeyFinding, verbFindings } from "@intellectual-frontiers/workload/logical";
import { graphFinding } from "./catalog.ts";
import { decodeGraph } from "./decode.ts";
import { defineGraph } from "./define.ts";
import { effectsOf, type Graph } from "./node.ts";

/** Every finding of a graph, in the order of its nodes. `registry` is the registry of verbs the graph is held to. */
export function check(graph: Graph, registry: VerbRegistry = VERBS): readonly Finding[] {
  const out: Finding[] = [];
  const defined = defineGraph(graph);
  if (defined.kind === "err") out.push(...defined.error);
  const declared = new Set<string>(graph.needs.map((n) => n.id));
  for (const n of graph.nodes) {
    const cited = citationFinding(n);
    if (cited !== undefined) out.push(cited);
    switch (n.kind) {
      case "verb": {
        out.push(...verbFindings({ head: n, verb: n.verb, inputs: n.inputs, declared, reads: false, effect: n.effect }, registry).findings);
        break;
      }
      case "check":
        out.push(...verbFindings({ head: n, verb: n.using, inputs: n.inputs, declared, reads: true }, registry).findings);
        break;
      case "each":
        for (const b of n.body) {
          const c = citationFinding(b);
          if (c !== undefined) out.push(c);
          out.push(...verbFindings(b.kind === "verb" ? { head: b, verb: b.verb, inputs: b.inputs, declared, reads: false, effect: b.effect } : { head: b, verb: b.using, inputs: b.inputs, declared, reads: true }, registry).findings);
        }
        break;
      case "gate":
        if (n.guards.length === 0) out.push(finding("E-WL-GATE-GUARDS-NOTHING", n.id, `the gate ${n.id} guards no node`));
        break;
      default:
        return n satisfies never;
    }
    if (n.kind === "gate") continue;
    const effects = effectsOf(n);
    for (const e of effects) {
      if (modeRank(e.mode) > modeRank(graph.limit)) out.push(graphFinding("E-GR-NODE-EFFECT-OVER-LIMIT", n.id, `${n.id} declares ${e.mode} of ${e.store} and the limit of the graph is ${graph.limit}`));
      const key = n.kind === "verb" ? externalKeyFinding(n, e, n.inputs) : undefined;
      if (key !== undefined && !out.some((f) => f.code === key.code && f.node === key.node)) out.push(key);
    }
    const writes = Object.entries(n.permissions ?? {}).filter(([, level]) => level === "write").map(([scope]) => scope);
    if (writes.length > 0 && effects.every((e) => e.mode === "read")) out.push(graphFinding("E-GR-PERMISSION-EXCESS", n.id, `${n.id} asks for write on ${writes.join(", ")} and every effect it has only reads`));
  }
  return out;
}

/** The findings of a value that came from outside: the reasons it is not a graph, or the findings of the graph it is. */
export function checkValue(input: unknown, registry: VerbRegistry = VERBS): readonly Finding[] {
  const r = decodeGraph(input);
  return r.kind === "err" ? r.error : check(r.value, registry);
}
