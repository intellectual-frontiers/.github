/**
 * Tests of the order as a workload (commons archon 0006-archon-on-workload FR-001 to FR-008): `reconcileOf` makes a reconcile loop that workload's own check accepts, the states and the plan are workload's
 * diff, the mode of the apply follows the change classes, and the loop is run end to end through workload's native reconcile runner with fixtures for the three verbs and a fake executor. Every name is made up.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { agent, type EventId, type ItemEvent, type ItemId, instantOfMs, msOfInstant, parseEventId, parseInstant, parseItemId, person } from "@intellectual-frontiers/planning/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { check, foldReconcile, makeReconcileEvent, parsePlan, type Reconcile, type Value } from "@intellectual-frontiers/workload/forms/reconcile";
import { runReconcile, type EventSink, type ReconcileDeps, type VerbBinding, type VerbBindings } from "@intellectual-frontiers/workload/physical";
import {
  buildOrder,
  changesInOrder,
  defineRequirement,
  desiredStateOf,
  modeOfOrder,
  observedStateOf,
  parseRequirementId,
  parseSubjectName,
  planHashOf,
  planOf,
  reconcileOf,
  type JsonValue,
  type Observed,
  type Order,
  type RequirementId,
  type RequirementInput,
} from "../src/mod.ts";

const must = <T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const rid = (t: string): RequirementId => must(parseRequirementId(t));
const SUBJECT = { name: must(parseSubjectName("synthetic-host-01.example.test")), class: "machine" as const };

function orderOf(inputs: readonly Partial<RequirementInput>[]): Order {
  const requirements = inputs.map((i, n) => must(defineRequirement({ id: `r.item-${n + 1}`, summary: "a made-up requirement.", why: ["a made-up reason"], subject: { by: "all" }, kind: "package", desired: { name: `pkg-${n + 1}` }, change: "additive", ...i })));
  return must(buildOrder({ subject: SUBJECT, assurance: "solo", layers: [{ layer: "baseline", requirements }] }));
}

const OBSERVED = (entries: readonly (readonly [string, JsonValue])[]): Observed => new Map(entries.map(([k, v]) => [rid(k), v] as const));

proves(["0006-archon-on-workload FR-002"], "reconcileOf is a reconcile workload of the six kinds in order, which workload's own check accepts, and it names no tool", () => {
  const loop = reconcileOf(orderOf([{}, { desired: { name: "other" }, change: "mutating" }]));
  assertEquals(loop.form, "reconcile");
  assertEquals(loop.nodes.map((n) => n.kind), ["observe", "observe", "diff", "plan", "approve", "apply", "verify"]);
  assertEquals(check(loop), []);
  assertEquals(String(loop.id), "archon-synthetic-host-01-example-test");
  assertEquals(loop.stores.map((s) => `${s.ref}:${s.class}`), ["host-synthetic-host-01-example-test:external", "order-synthetic-host-01-example-test:git"]);
  const text = JSON.stringify(loop);
  for (const tool of ["ansible", "tofu", "apt-get", "bash", "brew"]) assert(!text.includes(tool), tool);
});

proves(["0006-archon-on-workload FR-003"], "the desired state has a key for each requirement that must be present and the observed state one for each resource that is there, as canonical text", () => {
  const order = orderOf([{ desired: { b: 1, a: 2 } }, { ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }, { desired: null }]);
  assertEquals(desiredStateOf(order), { "r.item-1": '{"a":2,"b":1}', "r.item-3": "null" });
  const seen = OBSERVED([["r.item-1", { a: 2, b: 1 }], ["r.item-2", { name: "x" }], ["x.not-in-the-order", 1]]);
  assertEquals(observedStateOf(order, seen), { "r.item-1": '{"a":2,"b":1}', "r.item-2": '{"name":"x"}' });
});

proves(["0006-archon-on-workload FR-004"], "the plan is workload's diff: create, update and remove, each entry with the kind, class and tier, and the changes in the order of the sequence", () => {
  const order = orderOf([{ id: "r.b", dependsOn: ["r.a"] }, { id: "r.a" }, { id: "r.c", desired: { name: "new" } }, { id: "r.d", ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }]);
  const plan = planOf(order, OBSERVED([["r.c", { name: "old" }], ["r.d", { name: "there" }]]));
  assertEquals(plan.entries.map((e) => `${e.id}:${e.action}:${e.change}:${e.tier}`), ["r.a:create:additive:operator", "r.b:create:additive:operator", "r.c:update:additive:operator", "r.d:remove:destructive:operator"]);
  assertEquals(plan.changes.map((c) => `${c.key}:${c.action}`), ["r.a:create", "r.b:create", "r.c:update", "r.d:delete"]);
  const inOrder = changesInOrder(order, plan).map((c) => c.key);
  assertEquals(inOrder, ["r.a", "r.b", "r.c", "r.d"]);
  const quiet = planOf(order, OBSERVED([["r.a", { name: "pkg-2" }], ["r.b", { name: "pkg-1" }], ["r.c", { name: "new" }]]));
  assertEquals(quiet.changes.length, 0);
});

proves(["0006-archon-on-workload FR-006"], "the mode of the apply is the greatest change the order can make, and the autonomy is workload's", () => {
  assertEquals(modeOfOrder(orderOf([{}])), "append");
  assertEquals(modeOfOrder(orderOf([{}, { change: "mutating" }])), "mutate");
  assertEquals(modeOfOrder(orderOf([{ change: "mutating" }, { change: "destructive", rollback: "restore-from-backup", ensure: "absent", desired: null }])), "destroy");
  const apply = (o: Order) => reconcileOf(o).nodes.find((n) => n.kind === "apply");
  const a = apply(orderOf([{}]));
  assert(a?.kind === "apply" && a.effect.mode === "append" && a.effect.reversible === true && a.effect.class === "external");
  const r = apply(orderOf([{}, { rollback: "restore-from-backup" }]));
  assert(r?.kind === "apply" && r.effect.reversible === false);
  const approve = (o: Order) => reconcileOf(o).nodes.find((n) => n.kind === "approve");
  const human = approve(orderOf([{ change: "destructive", rollback: "restore-from-backup", ensure: "absent", desired: null }]));
  assert(human?.kind === "approve" && human.demands === "human-only");
  const proposes = approve(orderOf([{}]));
  assert(proposes?.kind === "approve" && proposes.demands === "agent-proposes");
});

// ----- the world: three verbs over a fake host and a fake executor -----

const AT = must(parseInstant("2026-11-25T10:00:00Z"));
const ITEM: ItemId = must(parseItemId("018f3a6e-7c00-7000-8123-456789abcdef"));
const PERSON = must(person("synthetic-person-01", "Synthetic Person"));
const AGENT = must(agent("synthetic-agent-01", "Synthetic Agent", PERSON, "session"));
const eid = (k: number): EventId => must(parseEventId(`018f3a6e-7c00-7000-8123-4567890000${k.toString(16).padStart(2, "0")}`));

type World = { deps: ReconcileDeps; events: ItemEvent[]; host: Record<string, Value>; ran: string[]; loop: Reconcile; order: Order };

function world(order: Order, host: Record<string, Value>): World {
  const events: ItemEvent[] = [];
  const ran: string[] = [];
  const loop = reconcileOf(order);
  const wanted = (): Record<string, Value> => ({ ...desiredStateOf(order) });
  const observe: VerbBinding = async (i) => ok({ digests: [], outputs: String(i["store"]).startsWith("host-") ? { ...host } : wanted() });
  const apply: VerbBinding = async (i) => {
    ran.push(`apply ${String(i["key"])}`);
    for (const c of parsePlan(String(i["changes"])) ?? []) {
      if (c.action === "delete") delete host[c.key];
      else if (typeof c.to === "string") host[c.key] = c.to;
    }
    return ok({ digests: [String(i["key"])], outputs: {} });
  };
  const verify: VerbBinding = async () => {
    const w = wanted();
    const keys = new Set([...Object.keys(host), ...Object.keys(w)]);
    return ok({ digests: [], outputs: {}, holds: [...keys].every((k) => host[k] === w[k]) });
  };
  const bindings: VerbBindings = new Map([["state.observe", observe], ["state.apply", apply], ["state.verify", verify]]);
  const sink: EventSink = { append: async (e) => (events.push(e), ok(undefined)), read: async () => [...events] };
  let n = 0;
  const deps: ReconcileDeps = { bindings, sink, source: { now: () => AT, nextEventId: () => (n += 1, eid(n)), instantAfterHours: (from, h) => must(instantOfMs(msOfInstant(from) + h * 3600000)) }, actor: AGENT, item: ITEM, inputs: {} };
  return { deps, events, host, ran, loop, order };
}

const approveBy = (w: World, hash: string): void => {
  w.events.push(must(makeReconcileEvent({ id: w.deps.source.nextEventId(), item: ITEM, at: AT, actor: PERSON }, { kind: "answered", node: "approve-plan", answer: "approved", evidence: { kind: "digest", digest: hash } })));
};

proves(["0006-archon-on-workload FR-005", "0006-archon-on-workload FR-008"], "an order is run end to end through workload: observe, plan, park, apply once for the approved hash, verify, receipt; a second pass applies nothing", async () => {
  const order = orderOf([{ id: "r.keep" }, { id: "r.new", desired: { name: "new" } }, { id: "r.change", desired: { name: "wanted" }, change: "mutating" }, { id: "r.gone", ensure: "absent", change: "destructive", rollback: "restore-from-backup", desired: null }]);
  const w = world(order, { "r.keep": '{"name":"pkg-1"}', "r.change": '{"name":"old"}', "r.gone": '{"name":"there"}' });
  const first = await runReconcile(w.loop, w.deps);
  assert(first.kind === "ok");
  assertEquals(first.value.parked, ["approve-plan"]);
  assertEquals(first.value.plan?.changes, 3);
  assertEquals(w.ran, [], "nothing is applied before a person approves");
  const hash = first.value.plan?.hash ?? "";
  const expected = await planHashOf(planOf(order, OBSERVED([["r.keep", { name: "pkg-1" }], ["r.change", { name: "old" }], ["r.gone", { name: "there" }]])));
  assertEquals(hash, expected, "the hash of the loop is the hash of the plan of Archon");
  approveBy(w, "f".repeat(64));
  const wrong = await runReconcile(w.loop, w.deps);
  assert(wrong.kind === "ok" && wrong.value.planApproved === false);
  assertEquals(w.ran, []);
  approveBy(w, hash);
  const second = await runReconcile(w.loop, w.deps);
  assert(second.kind === "ok");
  assertEquals(second.value.finished, "converged");
  assertEquals(w.ran, [`apply ${hash}`]);
  assertEquals(w.host, { "r.keep": '{"name":"pkg-1"}', "r.new": '{"name":"new"}', "r.change": '{"name":"wanted"}' });
  const state = foldReconcile(ITEM, w.events);
  assertEquals(state.applied, [hash]);
  const quiet = await runReconcile(w.loop, w.deps);
  assert(quiet.kind === "ok");
  assertEquals(quiet.value.plan?.changes, 0);
  assertEquals(w.ran.length, 1, "a pass with nothing to change applies nothing");
});

proves(["0006-archon-on-workload FR-006"], "an apply whose plan exceeds the mode the order can make is refused by workload", async () => {
  const order = orderOf([{ id: "r.pin", desired: { name: "x", version: "2" } }]);
  const w = world(order, { "r.pin": '{"name":"x","version":"1"}' });
  const first = await runReconcile(w.loop, w.deps);
  assert(first.kind === "ok");
  approveBy(w, first.value.plan?.hash ?? "");
  const second = await runReconcile(w.loop, w.deps);
  assert(second.kind === "ok");
  assertEquals(second.value.finished, "failed", "an update needs mutate and the additive order declares append");
  assertEquals(w.ran, []);
});
