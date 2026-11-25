// Spec: 0013-form-graph FR-011, FR-012
/**
 * What a graph asks of a runner, and how it lowers to a plan of calls with jobs. The needs are derived from the nodes and never declared: a verb or a check needs `calls`, an `each` `fan-out`, a gate `approval`, a destroy of a durable,
 * git or external store `destroy` (or `approval` where a gate guards it) and any other node that is `human-only` once the gates are applied and that no gate guards `interactive`. The plan of a graph is its jobs with their edges:
 * each node that is a job becomes one job with the permissions it asks for (least privilege: `contents: read` only, where it asks for none), the gate that guards it as the environment a person approves, the credentials it reads by
 * name and its one call or loop, and the same calls are in the plan in the order of the graph for a runner that has no jobs. A gate guards a job and never becomes one; two gates on one job, and a value passed between nodes, are refused with
 * `E-WL-RUNNER-EMIT-UNSUPPORTED`. The derived autonomy of each node is carried in the plan unchanged. Pure.
 *
 * @example
 * ```ts
 * import { callsOf, runnerNeedsOf } from "./runner.ts";
 * // runnerNeedsOf(graph).map((n) => n.capability); callsOf(graph, { fleet })
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Call, type CallArg, type CallPlan, type Finding, finding, isSafeText, type PlanJob, type PlanStep, type RunnerNeed, VERBS, type VerbRegistry } from "@intellectual-frontiers/workload/governance";
import { destroyNeed, distinctNeeds, personNeed } from "@intellectual-frontiers/workload/logical";
import { levelsOf } from "./autonomy.ts";
import { check } from "./check.ts";
import type { BodyNode, Graph, JobNode } from "./node.ts";
import { orderOf } from "./order.ts";
import { type FanOut } from "./terms.ts";

/** What a graph needs of a runner, from its nodes, in the order they are written, once each. */
export function runnerNeedsOf(graph: Graph): readonly RunnerNeed[] {
  const level = new Map(levelsOf(graph).map((l) => [String(l.id), l.autonomy]));
  const guarded = new Set(graph.nodes.flatMap((n) => (n.kind === "gate" ? n.guards.map(String) : [])));
  const out: RunnerNeed[] = [];
  const need = (capability: RunnerNeed["capability"], node: string, why: string): void => void out.push({ capability, node, why });
  const verb = (id: string, v: string, effect: Extract<BodyNode, { readonly kind: "verb" }>["effect"], gate: boolean): void => {
    need("calls", id, `${id} calls ${v}`);
    const d = destroyNeed(id, effect, gate);
    if (d !== undefined) out.push(d);
    const p = d === undefined && !gate ? personNeed(id, level.get(id) ?? "human-only") : undefined;
    if (p !== undefined) out.push(p);
  };
  for (const n of graph.nodes) {
    const id = String(n.id);
    switch (n.kind) {
      case "verb":
        verb(id, n.verb, n.effect, guarded.has(id));
        break;
      case "check":
        need("calls", id, `${id} calls ${n.using}`);
        break;
      case "each":
        need("fan-out", id, `${id} fans out over ${n.over}`);
        for (const b of n.body) {
          if (b.kind === "verb") verb(id, b.verb, b.effect, guarded.has(id));
          else need("calls", id, `${id} calls ${b.using}`);
        }
        break;
      case "gate":
        need("approval", id, `${id} is the approval of ${n.approver}`);
        break;
      default:
        return absurd(n);
    }
  }
  return distinctNeeds(out);
}

/** What lowering to a plan of calls is given: the fixed list of members for a source of an `each`, or none where the caller has none. */
export type GraphCallsInput = { readonly fleet: (over: FanOut, source: string) => readonly string[] | undefined; readonly registry?: VerbRegistry };

const text = (v: string | number | boolean): string => String(v);
const CREDENTIAL = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/** The plan of calls of a graph, with its jobs, or the findings that refuse it: those of the static check, then those of the emit. */
export function callsOf(graph: Graph, input: GraphCallsInput): Result<CallPlan, readonly Finding[]> {
  const found = check(graph, input.registry ?? VERBS);
  if (found.length > 0) return err(found);
  const level = new Map(levelsOf(graph).map((l) => [String(l.id), l.autonomy]));
  const out: Finding[] = [];
  const unsafe = (node: string, what: string, value: string): void => void out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", node, `${what} of ${node} is not printable ASCII: ${JSON.stringify(value.slice(0, 40))}`));
  const used = new Set<string>();
  const call = (id: string, s: BodyNode, autonomy: Call["autonomy"]): Call => {
    const args: CallArg[] = [];
    for (const [name, v] of Object.entries(s.inputs).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!isSafeText(name)) unsafe(id, `the input ${name}`, name);
      switch (v.kind) {
        case "literal":
          if (!isSafeText(text(v.value))) unsafe(id, `the input ${name}`, text(v.value));
          args.push({ name, value: { kind: "literal", text: text(v.value) } });
          break;
        case "store":
          args.push({ name, value: { kind: "literal", text: v.store } });
          break;
        case "input":
          if (!/^[a-z][a-z0-9-]*$/u.test(v.name)) unsafe(id, `the name of the input ${v.name}`, v.name);
          used.add(v.name);
          args.push({ name, value: { kind: "input", name: v.name } });
          break;
        case "output":
          out.push(finding("E-WL-RUNNER-EMIT-UNSUPPORTED", id, `${id} reads the output of ${v.step}: the edges of a graph carry no value`, { node: id }));
          break;
        default:
          return absurd(v);
      }
    }
    return { kind: "call", step: s.id, as: s.kind, verb: s.kind === "verb" ? s.verb : s.using, args, autonomy };
  };
  const gates = graph.nodes.flatMap((n) => (n.kind === "gate" ? [n] : []));
  const stepOf = (n: JobNode): PlanStep | undefined => {
    const autonomy = level.get(n.id) ?? "human-only";
    switch (n.kind) {
      case "verb":
      case "check":
        return call(n.id, n, autonomy);
      case "each": {
        if (n.source.kind !== "literal") {
          out.push(finding("E-WL-RUNNER-EACH-UNLISTED", n.id, `${n.id} fans out over a source that is no literal: the members would be found at run time`, { node: n.id }));
          return undefined;
        }
        const members = input.fleet(n.over, text(n.source.value));
        if (members === undefined) {
          out.push(finding("E-WL-RUNNER-EACH-UNLISTED", n.id, `${n.id} names the list ${text(n.source.value)} and the caller gave none`, { node: n.id }));
          return undefined;
        }
        for (const m of members) if (!isSafeText(m)) unsafe(n.id, "a member", m);
        return { kind: "each", step: n.id, over: n.over, members: [...members], body: n.body.map((b) => call(n.id, b, level.get(n.id) ?? "human-only")), autonomy };
      }
      default:
        return absurd(n);
    }
  };
  const workloadCredentials = graph.needs.flatMap((n) => (n.kind === "credential" ? [n.name] : []));
  const credentialsOf = (n: JobNode): readonly string[] => [...new Set([...workloadCredentials, ...(n.needs ?? []).flatMap((r) => (r.kind === "credential" ? [r.name] : []))])].sort();
  const jobs: PlanJob[] = [];
  for (const n of orderOf(graph)) {
    const step = stepOf(n);
    if (step === undefined) continue;
    const guards = gates.filter((g) => g.guards.includes(n.id));
    if (guards.length > 1) {
      out.push(finding("E-WL-RUNNER-EMIT-UNSUPPORTED", n.id, `${n.id} is guarded by ${guards.map((g) => g.id).join(" and ")}: a job has one environment, so one gate`, { node: n.id }));
      continue;
    }
    const credentials = credentialsOf(n);
    for (const c of credentials) if (!CREDENTIAL.test(c)) unsafe(n.id, "the name of a credential", c);
    const permissions = { contents: "read" as "read" | "write", ...Object.fromEntries(Object.entries(n.permissions ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) };
    jobs.push({
      id: n.id,
      title: n.title,
      needs: [...n.after],
      step,
      permissions: Object.fromEntries(Object.entries(permissions).sort(([a], [b]) => (a < b ? -1 : 1))),
      ...(guards[0] === undefined ? {} : { environment: guards[0].id }),
      credentials,
      ...(n.timeoutMinutes === undefined ? {} : { timeoutMinutes: n.timeoutMinutes }),
    });
  }
  for (const v of [graph.id, graph.version]) if (!isSafeText(v)) unsafe("", "the id or the version of the graph", v);
  if (out.length > 0) return err(out);
  const credentials = [...new Set([...workloadCredentials, ...graph.nodes.flatMap((n) => (n.needs ?? []).flatMap((r) => (r.kind === "credential" ? [r.name] : [])))])].sort();
  return ok({ workload: graph.id, version: graph.version, form: "graph", inputs: [...used].sort(), credentials, steps: jobs.map((j) => j.step), jobs });
}
