/**
 * Tests of the graph form (commons workload 0013-form-graph FR-001 to FR-016): four kinds of node with edges in a closed sum, the check (an edge to a node that is not there, a cycle, a node no result depends on, an effect above the
 * limit, permissions above what the effects need), the autonomy derived as in every form, the catalog, the dry run, what the graph needs of a runner, its lowering to jobs, its events and their fold, the starters and its native runner, which
 * runs against fake verbs. Every name is synthetic.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { type Actor, instantOfMs, msOfInstant, type ItemEvent } from "@intellectual-frontiers/planning/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, BUILT_FORM_IDS, catalogProblems, FORMS, isBuiltForm, nodeId, storeRef, VERBS, verbId } from "@intellectual-frontiers/workload/governance";
import {
  autonomyOf,
  check,
  checkValue,
  callsOf,
  decodeGraph,
  decodeGraphEvent,
  defineGraph,
  derivedAutonomy,
  encodeGraphEvent,
  foldGraph,
  GRAPH_CATALOG,
  GRAPH_FORM,
  GRAPH_KINDS,
  graphFleet,
  type Graph,
  type GraphEvent,
  levelsOf,
  makeGraphEvent,
  orderOf,
  outcomeOf,
  plan,
  runnerNeedsOf,
  STARTERS,
  SYNTHETIC_GRAPH_01,
  SYNTHETIC_GRAPH_02,
  viewOf,
  cycleOf,
} from "@intellectual-frontiers/workload/forms/graph";
import { GRAPH_RUNNER, runGraph } from "@intellectual-frontiers/workload/physical";
import type { EventSink, GraphDeps, VerbBinding, VerbBindings } from "@intellectual-frontiers/workload/physical";
import { library } from "../library.ts";
import { AGENT, CONTRACT, eventId, facts, ITEM, must, PERSON } from "./kit.ts";
import { NOW } from "./world.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const nid = (t: string) => authored(nodeId(t));
const withNodes = (f: (nodes: Graph["nodes"]) => Graph["nodes"], over: Partial<Graph> = {}): Graph => ({ ...SYNTHETIC_GRAPH_01, ...over, nodes: f(SYNTHETIC_GRAPH_01.nodes) });
const codes = (g: Graph): string[] => check(g).map((f) => f.code);
const second = (over: Partial<Graph["nodes"][number]>): Graph => ({ ...SYNTHETIC_GRAPH_02, nodes: SYNTHETIC_GRAPH_02.nodes.map((n, i) => (i === 1 ? ({ ...n, ...over } as Graph["nodes"][number]) : n)) });

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const e of fs.readDir(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory) yield* walk(p);
    else if (p.endsWith(".ts")) yield p;
  }
}
async function importsOf(folder: string): Promise<readonly { readonly file: string; readonly spec: string }[]> {
  const out: { file: string; spec: string }[] = [];
  for await (const file of walk(path.join(ROOT, folder))) for (const m of (await fs.readTextFile(file)).matchAll(/(?:from|import\()\s*"([^"]+)"/gu)) out.push({ file: path.relative(ROOT, file), spec: m[1] ?? "" });
  return out;
}

proves(["0013-form-graph FR-001"], "the form graph is built: the registry says so, the logic and the native runner have their folders, the package has its two entries and the core imports nothing of it", async () => {
  assertEquals(FORMS["graph"].status, "built");
  assert(isBuiltForm("graph") && BUILT_FORM_IDS.includes("graph"));
  assertEquals(GRAPH_FORM.id, "graph");
  assertEquals(Object.keys(GRAPH_FORM).sort(), ["fold", "id", "nodeKinds", "plan", "validate"]);
  assertEquals(GRAPH_RUNNER.form, "graph");
  assert((await fs.exists(path.join(ROOT, "src", "logical", "forms", "graph"))) && (await fs.exists(path.join(ROOT, "src", "physical", "forms", "graph"))));
  assert(library.exports.includes("./forms/graph") && library.exports.includes("./runners/github-actions"));
  const pkg: { exports: Record<string, string> } = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json")));
  assertEquals(pkg.exports["./forms/graph"], "./src/logical/forms/graph/mod.ts");
  assertEquals(pkg.exports["./runners/github-actions"], "./src/physical/runners/github-actions/mod.ts");
  for (const folder of ["src/governance", "src/logical"]) {
    for (const i of await importsOf(folder)) {
      if (folder === "src/logical" && i.file.includes("/forms/")) continue;
      assert(!/forms\/graph|runners\/github-actions/u.test(i.spec), `${i.file} imports ${i.spec}`);
    }
  }
});

proves(["0013-form-graph FR-002"], "a graph is typed data decoded at the boundary: four kinds of node, edges, permissions and a limit, and a value that is none is refused with every reason", () => {
  assertEquals(GRAPH_KINDS, ["verb", "check", "each", "gate"]);
  for (const g of STARTERS) assertEquals(decodeGraph(JSON.parse(JSON.stringify(g))).kind, "ok", g.id);
  const edit = (f: (g: { nodes: Record<string, unknown>[] } & Record<string, unknown>) => void): unknown => {
    const g = JSON.parse(JSON.stringify(SYNTHETIC_GRAPH_01));
    f(g);
    return g;
  };
  assertEquals(decodeGraph(edit((g) => void (g.nodes[1] = { ...g.nodes[1], after: "observe-state" }))).kind, "err");
  assertEquals(decodeGraph(edit((g) => void (g.nodes[1] = { ...g.nodes[1], permissions: { bogus: "write" } }))).kind, "err");
  assertEquals(decodeGraph(edit((g) => void (g.nodes[1] = { ...g.nodes[1], permissions: { contents: "admin" } }))).kind, "err");
  assertEquals(decodeGraph(edit((g) => void (g.nodes[1] = { ...g.nodes[1], kind: "branch" }))).kind, "err");
  assertEquals(decodeGraph(edit((g) => void (g["limit"] = "everything"))).kind, "err");
  assertEquals(decodeGraph({ ...JSON.parse(JSON.stringify(SYNTHETIC_GRAPH_01)), form: "runbook" }).kind, "err");
  assertEquals(decodeGraph(edit((g) => void (g.nodes[0] = { ...g.nodes[0], after: ["nowhere"] }))).kind, "err", "the structure is checked after the decode");
  assertEquals(checkValue({}).length > 0, true);
  assertEquals(checkValue(JSON.parse(JSON.stringify(SYNTHETIC_GRAPH_01))), []);
});

proves(["0013-form-graph FR-003"], "the nodes and effects are those of the other forms and the autonomy is derived from the effect by the one table, a gate only raising the control, whatever carries the graph", () => {
  const level = (id: string): string | undefined => autonomyOf(SYNTHETIC_GRAPH_01, nid(id));
  assertEquals(level("observe-state"), "agent-autonomous");
  assertEquals(level("record-state"), "agent-acts-human-reviews");
  assertEquals(level("record-hosts"), "agent-acts-human-reviews");
  assertEquals(level("approve-publish"), "human-only");
  assertEquals(derivedAutonomy(SYNTHETIC_GRAPH_01.nodes[4] as Graph["nodes"][number]), "agent-proposes", "the publish, before its gate");
  assertEquals(level("publish-result"), "human-only", "the gate lowered what it guards");
  const levels = levelsOf(SYNTHETIC_GRAPH_01);
  assertEquals(levels.find((l) => l.id === "publish-result")?.raisedBy, "approve-publish");
  const lax = withNodes((ns) => ns.map((n) => (n.kind === "gate" ? { ...n, demands: "agent-autonomous" as const } : n)));
  assertEquals(autonomyOf(lax, nid("publish-result")), "agent-proposes", "a gate never makes a node more autonomous");
  assertEquals(viewOf(SYNTHETIC_GRAPH_01).nodes.map((n) => `${n.id}|${n.autonomy}`), levels.map((l) => `${l.id}|${l.autonomy}`));
});

proves(["0013-form-graph FR-004"], "an edge to a node that is not there is E-GR-NEEDS-UNKNOWN, a cycle is E-GR-EDGE-CYCLE naming it, and the order of the jobs is stable", () => {
  const unknown = second({ after: [nid("nowhere")] });
  assert(codes(unknown).includes("E-GR-NEEDS-UNKNOWN"), codes(unknown).join(","));
  const self = second({ after: [nid("record-order")] });
  assert(codes(self).includes("E-GR-NEEDS-UNKNOWN"));
  const gate = withNodes((ns) => ns.map((n) => (n.id === "record-state" ? { ...n, after: [nid("approve-publish")] } : n)));
  assert(codes(gate).includes("E-GR-NEEDS-UNKNOWN"), "a gate is no job to come after");
  const loop: Graph = { ...SYNTHETIC_GRAPH_02, nodes: SYNTHETIC_GRAPH_02.nodes.map((n) => (n.id === "read-state" ? ({ ...n, after: [nid("record-order")] } as Graph["nodes"][number]) : n)) };
  const found = check(loop).find((f) => f.code === "E-GR-EDGE-CYCLE");
  assert(found !== undefined && found.message.includes("read-state") && found.message.includes("record-order") && found.message.includes("->"), found?.message);
  assertEquals(cycleOf(loop)?.length, 3);
  assertEquals(cycleOf(SYNTHETIC_GRAPH_01), undefined);
  assertEquals(orderOf(SYNTHETIC_GRAPH_01).map((n) => n.id), ["observe-state", "record-state", "record-hosts", "publish-result"]);
  const reversed = withNodes((ns) => [...ns].reverse());
  assertEquals(orderOf(reversed).map((n) => n.id), ["observe-state", "record-hosts", "record-state", "publish-result"], "the one written first goes first");
  assertEquals(orderOf(reversed).map((n) => n.id), orderOf(reversed).map((n) => n.id));
  assertEquals(orderOf(loop).length, 0, "the jobs of a cycle are in no order");
});

proves(["0013-form-graph FR-005"], "a node that no result depends on is E-GR-NODE-UNREACHABLE", () => {
  const dead = withNodes((ns) => [...ns, { ...(ns[0] as Graph["nodes"][number]), id: nid("orphan"), after: [] } as Graph["nodes"][number]]);
  const found = check(dead).filter((f) => f.code === "E-GR-NODE-UNREACHABLE");
  assertEquals(found.map((f) => f.node), ["orphan"]);
  assertEquals(codes(SYNTHETIC_GRAPH_01).includes("E-GR-NODE-UNREACHABLE"), false);
  const none = { ...SYNTHETIC_GRAPH_01, results: [] };
  assert(codes(none).includes("E-GR-GRAPH-MALFORMED"));
});

proves(["0013-form-graph FR-006"], "a graph that is not well formed is E-GR-GRAPH-MALFORMED: an id twice, an undeclared store, a value read from another node, a result that is no job, an empty each", () => {
  const twice = withNodes((ns) => [...ns, ns[0] as Graph["nodes"][number]]);
  assert(codes(twice).includes("E-GR-GRAPH-MALFORMED"));
  const store = second({ effect: { store: authored(storeRef("synthetic-nowhere-01")), class: "durable", mode: "append", reversible: true } });
  assert(codes(store).includes("E-GR-GRAPH-MALFORMED"));
  const output = second({ inputs: { order: { kind: "output", step: nid("read-state"), name: "x" } } });
  assert(check(output).some((f) => f.code === "E-GR-GRAPH-MALFORMED" && f.message.includes("carry no value")));
  assert(codes({ ...SYNTHETIC_GRAPH_01, results: [nid("approve-publish")] }).includes("E-GR-GRAPH-MALFORMED"), "a gate is no result");
  const empty = withNodes((ns) => ns.map((n) => (n.kind === "each" ? { ...n, body: [] } : n)));
  assert(codes(empty).includes("E-GR-GRAPH-MALFORMED"));
  const guards = withNodes((ns) => ns.map((n) => (n.kind === "gate" ? { ...n, guards: [nid("approve-publish")] } : n)));
  assert(codes(guards).includes("E-GR-GRAPH-MALFORMED"), "a gate guards jobs only");
  assert(defineGraph({ ...SYNTHETIC_GRAPH_01, nodes: [] }).kind === "err");
  assertEquals(defineGraph(SYNTHETIC_GRAPH_01).kind, "ok");
});

proves(["0013-form-graph FR-007"], "an effect above the limit is E-GR-NODE-EFFECT-OVER-LIMIT, write permissions that no effect needs are E-GR-PERMISSION-EXCESS and a gate that guards nothing is refused by the core", () => {
  const over = second({ effect: { store: authored(storeRef("synthetic-evidence-01")), class: "durable", mode: "mutate", reversible: true } });
  assert(codes(over).includes("E-GR-NODE-EFFECT-OVER-LIMIT"));
  assertEquals(codes({ ...over, limit: "mutate" }).includes("E-GR-NODE-EFFECT-OVER-LIMIT"), false);
  const read = { ...SYNTHETIC_GRAPH_02, nodes: SYNTHETIC_GRAPH_02.nodes.map((n, i) => (i === 0 ? ({ ...n, permissions: { contents: "read", checks: "write" } } as Graph["nodes"][number]) : n)) } satisfies Graph;
  assert(codes(read).includes("E-GR-PERMISSION-EXCESS"));
  assertEquals(codes(SYNTHETIC_GRAPH_01).includes("E-GR-PERMISSION-EXCESS"), false, "publish writes and may ask for write");
  const idle = withNodes((ns) => ns.map((n) => (n.kind === "gate" ? { ...n, guards: [] } : n)));
  assert(codes(idle).includes("E-WL-GATE-GUARDS-NOTHING"));
  assertEquals(GRAPH_CATALOG.entries["E-GR-NODE-EFFECT-OVER-LIMIT"].safety, true);
});

proves(["0013-form-graph FR-008"], "the checks every form shares apply to the nodes and to the calls in the body of an each", () => {
  const verbOf = (v: string) => authored(verbId(v));
  assert(check(second({ verb: verbOf("work.nope") } as never)).some((f) => f.code === "E-WL-VERB-UNKNOWN"));
  assert(check(withNodes((ns) => ns.map((n) => (n.kind === "check" ? { ...n, using: verbOf("work.claim") } : n)))).some((f) => f.code === "E-WL-CHECK-NOT-READ"));
  assert(check(withNodes((ns) => ns.map((n) => (n.id === "record-state" ? { ...n, spec: [] } : n)))).some((f) => f.code === "E-WL-CITATION-MISSING"));
  const bodyBad = withNodes((ns) => ns.map((n) => (n.kind === "each" ? { ...n, body: n.body.map((b) => ({ ...b, inputs: {} })) } : n)));
  assert(check(bodyBad).some((f) => f.code === "E-WL-VERB-INPUTS-INVALID" && f.node === "record-host"));
  const noKey = withNodes((ns) =>
    ns.map((n) => {
      if (n.id !== "publish-result" || n.kind !== "verb") return n;
      const { idempotencyKey, ...rest } = n.effect;
      void idempotencyKey;
      return { ...n, effect: rest };
    }),
  );
  assert(check(noKey).some((f) => f.code === "E-WL-EXTERNAL-NO-KEY"));
  const installer = { ...SYNTHETIC_GRAPH_01, needs: [{ id: "tool-x", kind: "program" as const, concept: "workbench" as const, task: "run" as const, safety: false, summary: "x", name: "x", install: ["curl", "x"] }] };
  assert(check(installer).some((f) => f.code === "E-WL-NEED-INSTALLER"));
  assertEquals(check(SYNTHETIC_GRAPH_01), []);
  assertEquals(check(SYNTHETIC_GRAPH_02), []);
});

proves(["0013-form-graph FR-009"], "the catalog of the form is closed, every code has its concept, fixer and fix, and the catalogs of the library include it", async () => {
  assertEquals(catalogProblems(GRAPH_CATALOG), []);
  assertEquals(Object.keys(GRAPH_CATALOG.entries).sort(), ["E-GR-EDGE-CYCLE", "E-GR-GRAPH-MALFORMED", "E-GR-NEEDS-UNKNOWN", "E-GR-NODE-EFFECT-OVER-LIMIT", "E-GR-NODE-UNREACHABLE", "E-GR-PERMISSION-EXCESS"]);
  for (const e of Object.values(GRAPH_CATALOG.entries)) assert(e.fix.length > 10 && e.what.length > 20 && GRAPH_CATALOG.concepts.includes(e.concept), e.code);
  const { CATALOGS } = await import("@intellectual-frontiers/workload/physical");
  assert(CATALOGS.some((c) => c.prefix === "E-GR-"));
  const { main } = await import("@intellectual-frontiers/workload/physical");
  let out = "";
  assertEquals(await main(["explain", "E-GR-EDGE-CYCLE"], { out: (t) => void (out += t), err: () => undefined }), 0);
  assert(out.includes("fixer: agent"), out);
});

proves(["0013-form-graph FR-010"], "the dry run refuses a graph with a finding and otherwise gives the nodes with their autonomy and what stops for a person", () => {
  const input = { contract: CONTRACT, facts: facts(), today: "2026-11-25" };
  assertEquals(plan(second({ after: [nid("nowhere")] }), input).kind, "err");
  const dry = plan(SYNTHETIC_GRAPH_01, input);
  assert(dry.kind === "ok");
  assertEquals(dry.value.nodes.map((n) => `${n.id}|${n.autonomy}|${n.stopsForPerson}`), levelsOf(SYNTHETIC_GRAPH_01).map((l) => `${l.id}|${l.autonomy}|${l.kind === "gate" || l.autonomy === "human-only"}`));
  assertEquals(dry.value.form, "graph");
  assertEquals(GRAPH_FORM.plan(SYNTHETIC_GRAPH_02, input).kind, "ok");
});

proves(["0013-form-graph FR-011"], "a graph says what it needs of a runner from its nodes: calls, fan-out and approval, and a destroy of a durable store needs destroy", () => {
  const needs = runnerNeedsOf(SYNTHETIC_GRAPH_01).map((n) => `${n.capability}:${n.node}`);
  assertEquals(needs, ["calls:observe-state", "calls:record-state", "fan-out:record-hosts", "calls:record-hosts", "approval:approve-publish", "calls:publish-result"]);
  const wipe = second({ verb: authored(verbId("store.delete")), effect: { store: authored(storeRef("synthetic-evidence-01")), class: "durable", mode: "destroy", reversible: false }, inputs: { store: { kind: "store", store: authored(storeRef("synthetic-evidence-01")) } } } as never);
  const wiped = runnerNeedsOf({ ...wipe, limit: "destroy" }).map((n) => n.capability);
  assert(wiped.includes("destroy"));
});

proves(["0013-form-graph FR-012"], "a graph lowers to a plan of calls with its jobs: the edges, the least permissions, the environment of the gate, the credentials by name, and the refusals are codes", () => {
  const made = callsOf(SYNTHETIC_GRAPH_01, { fleet: graphFleet });
  assert(made.kind === "ok");
  const p = made.value;
  assertEquals(p.form, "graph");
  assertEquals(p.jobs?.map((j) => j.id), ["observe-state", "record-state", "record-hosts", "publish-result"]);
  assertEquals(p.jobs?.map((j) => j.needs), [[], ["observe-state"], ["observe-state"], ["record-state", "record-hosts"]]);
  assertEquals(p.jobs?.map((j) => j.permissions), [{ contents: "read" }, { contents: "read" }, { contents: "read" }, { contents: "read", "pull-requests": "write" }]);
  assertEquals(p.jobs?.map((j) => j.environment), [undefined, undefined, undefined, "approve-publish"]);
  assertEquals(p.jobs?.[3]?.credentials, ["SYNTHETIC_TOKEN_01"]);
  assertEquals(p.jobs?.[1]?.timeoutMinutes, 10);
  assertEquals(p.steps.map((s) => s.step), ["observe-state", "record-state", "record-hosts", "publish-result"]);
  assertEquals(p.inputs, ["order"]);
  assertEquals(p.credentials, ["SYNTHETIC_TOKEN_01"]);
  const none = callsOf(SYNTHETIC_GRAPH_01, { fleet: () => undefined });
  assert(none.kind === "err" && none.error[0]?.code === "E-WL-RUNNER-EACH-UNLISTED");
  const two = withNodes((ns) => [...ns, { ...(ns[3] as Graph["nodes"][number]), id: nid("approve-again") } as Graph["nodes"][number]]);
  const doubled = callsOf(two, { fleet: graphFleet });
  assert(doubled.kind === "err" && doubled.error.some((f) => f.code === "E-WL-RUNNER-EMIT-UNSUPPORTED" && f.message.includes("one gate")), JSON.stringify(doubled));
  const unsafe = withNodes((ns) => ns.map((n) => (n.id === "record-state" && n.kind === "verb" ? { ...n, inputs: { order: { kind: "literal" as const, value: "bad\u0007value" } } } : n)));
  const bad = callsOf(unsafe, { fleet: graphFleet });
  assert(bad.kind === "err" && bad.error.some((f) => f.code === "E-WL-RUNNER-VALUE-UNSAFE"));
  assertEquals(callsOf(second({ after: [nid("nowhere")] }), { fleet: graphFleet }).kind, "err", "a graph with a finding has no plan");
});

const A = "a".repeat(64);
const L = "b".repeat(64);
const gev = (k: number, e: GraphEvent, actor: Actor = AGENT): ItemEvent => must(makeGraphEvent({ id: eventId(k), item: ITEM, at: NOW, actor }, e));

proves(["0013-form-graph FR-013"], "the events of a run are in the envelope of the core and the state is their fold with the hand-off, the same in any order, an answer by an agent refused and the outcome in the three words", async () => {
  const e: GraphEvent = { kind: "parked", node: "publish-result", gate: "approve-publish", approver: "synthetic-approver-01" };
  assertEquals(must(decodeGraphEvent(encodeGraphEvent(e))), e);
  assert(decodeGraphEvent("workload.event/1 {}").kind === "err");
  const { makeRunnerEvent } = await import("@intellectual-frontiers/workload/governance");
  const runner = (k: number, ev: Parameters<typeof makeRunnerEvent>[2], actor: Actor = PERSON): ItemEvent => must(makeRunnerEvent({ id: eventId(k), item: ITEM, at: NOW, actor }, "graph", ev));
  const events = [
    gev(1, { kind: "started", graph: "synthetic-graph-01", version: "0.1.0" }),
    gev(2, { kind: "done", node: "observe-state" }),
    gev(3, { kind: "parked", node: "publish-result", gate: "approve-publish", approver: "synthetic-approver-01" }),
    gev(4, { kind: "answered", gate: "approve-publish", answer: "approved" }, AGENT),
    gev(5, { kind: "answered", gate: "approve-publish", answer: "approved" }, PERSON),
  ];
  const state = foldGraph(ITEM, events);
  assertEquals(state.done, ["observe-state"]);
  assertEquals(state.approved, ["approve-publish"]);
  assertEquals(state.refused.length, 1);
  assert(state.refused[0]?.reason.includes("only a person approves a gate"));
  assertEquals(foldGraph(ITEM, [...events].reverse()), state, "the same events in another order give the same state");
  assertEquals(foldGraph(ITEM, [...events, ...events]), state, "a repeat is left out");
  assertEquals(outcomeOf(state), undefined);
  const finished = (o: "succeeded" | "failed" | "parked") => outcomeOf(foldGraph(ITEM, [...events, gev(9, { kind: "finished", outcome: o })]));
  assertEquals([finished("succeeded"), finished("parked"), finished("failed")], ["completes", "parks", "fails"]);
  const handed = [runner(10, { kind: "handoff", runner: "github-actions", plan: A }), runner(11, { kind: "receipt", plan: A, ref: "https://github.com/synthetic-org-01/synthetic-repo-01/actions/runs/1", status: 0, log: L })];
  const external = foldGraph(ITEM, handed);
  assertEquals(external.handoff.state, "received");
  assertEquals(outcomeOf(external), "completes");
  assertEquals(external.refused, []);
  assertEquals(outcomeOf(foldGraph(ITEM, [runner(12, { kind: "receipt", plan: A, ref: "synthetic-run-01", status: 0, log: L })])), undefined, "a receipt with no hand-off is refused");
});

proves(["0013-form-graph FR-014"], "the starters and fixtures are synthetic, keep every rule of the check and are the workloads the runners and the schedule are proved with", () => {
  for (const g of STARTERS) {
    assertEquals(check(g), [], g.id);
    assert(g.id.startsWith("synthetic-graph-"), g.id);
    for (const s of g.stores) assert(/^synthetic-/u.test(s.ref), s.ref);
    for (const n of g.nodes) if (n.kind === "gate") assert(n.approver.startsWith("synthetic-"));
  }
  assertEquals(STARTERS.map((g) => g.trigger.kind), ["schedule", "schedule"]);
  assertEquals(SYNTHETIC_GRAPH_01.nodes.some((n) => n.kind === "gate") && SYNTHETIC_GRAPH_01.nodes.some((n) => n.kind === "each"), true);
  assertEquals(SYNTHETIC_GRAPH_02.nodes.some((n) => n.kind === "gate"), false);
  assertEquals(graphFleet("hosts", "synthetic-graph-hosts"), ["synthetic-host-01", "synthetic-host-02"]);
  assertEquals(graphFleet("hosts", "other"), undefined);
});

type GWorld = { deps: GraphDeps; events: ItemEvent[]; calls: string[] };
function gworld(over: { fail?: string; actor?: GraphDeps["actor"] } = {}): GWorld {
  const events: ItemEvent[] = [];
  const calls: string[] = [];
  let n = 100;
  const bind = (id: string): VerbBinding => async (inputs) => {
    calls.push(`${id} ${Object.entries(inputs).map(([k, v]) => `${k}=${String(v)}`).join(" ")}`);
    return over.fail === id ? err("the verb said no") : ok({ digests: [], outputs: {}, holds: true });
  };
  const bindings: VerbBindings = new Map(["state.observe", "work.record", "external.apply", "workbench.ready"].map((id) => [id, bind(id)]));
  const sink: EventSink = { append: async (e) => (events.push(e), ok(undefined)), read: async () => [...events] };
  return {
    events,
    calls,
    deps: { bindings, sink, source: { now: () => NOW, nextEventId: () => (n += 1, eventId(n)), instantAfterHours: (from, h) => must(instantOfMs(msOfInstant(from) + h * 3600000)) }, actor: over.actor ?? AGENT, item: ITEM, inputs: { order: "synthetic-order-01" }, fleet: graphFleet },
  };
}

proves(["0013-form-graph FR-015"], "the native runner runs the nodes in the order of the edges, parks at a gate until a person approves, fails at a declined gate, does not run a done node again and refuses a graph with a finding", async () => {
  const w = gworld();
  const first = await runGraph(SYNTHETIC_GRAPH_01, w.deps);
  assert(first.kind === "ok");
  assertEquals(first.value.finished, "parked");
  assertEquals(first.value.done, ["observe-state", "record-hosts", "record-state"]);
  assertEquals(first.value.parked, { "publish-result": "approve-publish" });
  assertEquals(w.calls, ["state.observe store=synthetic-live-01", "work.record order=synthetic-order-01", "work.record order=synthetic-order-01 member=synthetic-host-01", "work.record order=synthetic-order-01 member=synthetic-host-02"]);
  assertEquals(outcomeOf(first.value), "parks");
  w.events.push(gev(250, { kind: "answered", gate: "approve-publish", answer: "approved" }, PERSON));
  const again = await runGraph(SYNTHETIC_GRAPH_01, w.deps);
  assert(again.kind === "ok");
  assertEquals(again.value.finished, "succeeded");
  assertEquals(again.value.done.length, 4);
  assertEquals(w.calls.length, 5, "the nodes that were done were not run again");
  assertEquals(w.calls[4], "external.apply store=synthetic-result-01 key=synthetic-order-01");
  assertEquals(outcomeOf(again.value), "completes");
  const declined = gworld();
  await runGraph(SYNTHETIC_GRAPH_01, declined.deps);
  declined.events.push(gev(250, { kind: "answered", gate: "approve-publish", answer: "declined" }, PERSON));
  const no = await runGraph(SYNTHETIC_GRAPH_01, declined.deps);
  assert(no.kind === "ok" && no.value.finished === "failed" && no.value.failed["publish-result"]?.includes("declined"));
  assertEquals(declined.calls.some((c) => c.startsWith("external.apply")), false, "a declined gate applies nothing");
  const bad = gworld({ fail: "work.record" });
  const failed = await runGraph(SYNTHETIC_GRAPH_02, bad.deps);
  assert(failed.kind === "ok" && failed.value.finished === "failed" && Object.keys(failed.value.failed).includes("record-order"));
  const loose = await runGraph(second({ after: [nid("nowhere")] }), gworld().deps);
  assert(loose.kind === "err" && Array.isArray(loose.error));
  assertEquals(VERBS.has("external.apply"), true);
});

proves(["0013-form-graph FR-016"], "the graph form is an instance of the unit of the forms: it imports no other form and its native runner imports no other runner of a form", async () => {
  for (const i of await importsOf("src/logical/forms/graph")) assert(!/forms\/(runbook|reconcile)/u.test(i.spec), `${i.file} imports ${i.spec}`);
  for (const i of await importsOf("src/physical/forms/graph")) assert(!/forms\/(runbook|reconcile)/u.test(i.spec) && !/runbook\/run|reconcile\/run/u.test(i.spec), `${i.file} imports ${i.spec}`);
  for (const form of ["runbook", "reconcile"]) for (const i of await importsOf(`src/logical/forms/${form}`)) assert(!i.spec.includes("forms/graph"), `${i.file} imports ${i.spec}`);
  const { decodeTable } = await import("@intellectual-frontiers/kanon");
  const table = decodeTable(library.kanon);
  assert(table.kind === "ok");
  assertEquals(table.value.units.find((u) => u.folder === "src/logical/forms/")?.instances, true);
  assertEquals(table.value.units.find((u) => u.folder === "src/physical/runners/")?.instances, true);
});

