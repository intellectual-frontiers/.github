/**
 * Tests of the runners with fakes (commons runbooks 0005-runbooks-runners FR-001 to FR-008): a verb is called by its registered id with typed inputs, a judge is decoded and applies nothing, ask and gate park the run as events
 * and a person answers, a store is attached by capability and detached at the end, a failure runs the compensations, the actor is held to the autonomy, every fact is a planning event, and the command refuses what it must.
 * It uses no machine: the stores, the workshop, the agent and the verbs are values.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ok, err } from "@intellectual-frontiers/core";
import { type ItemEvent, instantOfMs, msOfInstant, parseInstant } from "@intellectual-frontiers/planning/governance";
import { authored, createVerbRegistry, RESTORE_DRILL, type Runbook, type Step, VERBS, verbId } from "@intellectual-frontiers/runbooks/governance";
import { decodeRunEvent, foldRun, makeRunEvent } from "@intellectual-frontiers/runbooks/logical";
import { type AgentPort, type EventSink, main, runJudge, runRunbook, runVerb, type RunDeps, type StoreCatalog, type VerbBinding, type VerbBindings, type WorkshopPort } from "@intellectual-frontiers/runbooks/physical";
import { AGENT, effect, eventId, ITEM, must, PERSON, runbook, sid, store, verb } from "./kit.ts";

const NOW = must(parseInstant("2026-11-25T10:00:00Z"));
const LATER = must(parseInstant("2026-11-30T10:00:00Z"));

type World = { deps: RunDeps; events: ItemEvent[]; calls: string[]; workshop: string[]; asked: unknown[]; clock: { now: typeof NOW } };

function world(over: { bindings?: Record<string, VerbBinding>; agent?: AgentPort; actor?: RunDeps["actor"]; offers?: Record<string, readonly string[]>; rb?: Runbook; fleet?: RunDeps["fleet"] } = {}): World {
  const events: ItemEvent[] = [];
  const calls: string[] = [];
  const workshop: string[] = [];
  const asked: unknown[] = [];
  const clock = { now: NOW };
  let n = 0;
  const bind = (id: string): VerbBinding => async () => {
    calls.push(id);
    return ok({ digests: [`digest-${id}`], outputs: { digest: "0".repeat(64) }, holds: true });
  };
  const bindings: VerbBindings = new Map([...VERBS.list().map((v) => [v.id as string, bind(v.id)] as const), ...Object.entries(over.bindings ?? {})]);
  const rb = over.rb ?? RESTORE_DRILL;
  const sink: EventSink = {
    append: async (e) => {
      events.push(e);
      return ok(undefined);
    },
    read: async () => [...events],
  };
  const stores: StoreCatalog = { offer: (ref) => { const d = rb.stores.find((s) => s.ref === ref); return d === undefined ? undefined : { ref, class: d.class, capabilities: (over.offers?.[ref] ?? d.needs) as never }; } };
  const port: WorkshopPort = { attach: async (r) => (workshop.push(`attach ${r}`), ok(undefined)), detach: async (r) => (workshop.push(`detach ${r}`), ok(undefined)) };
  const agent: AgentPort = over.agent ?? { propose: async (r) => (asked.push(r), { summary: "same", attention: [], outcome: "restored" }) };
  const deps: RunDeps = {
    bindings,
    agent,
    sink,
    stores,
    workshop: port,
    source: { now: () => clock.now, nextEventId: () => (n += 1, eventId(n)), instantAfterHours: (from, h) => must(instantOfMs(msOfInstant(from) + h * 3600000)) },
    actor: over.actor ?? AGENT,
    item: ITEM,
    inputs: { order: "synthetic-order-01" },
    ...(over.fleet === undefined ? {} : { fleet: over.fleet }),
  };
  return { deps, events, calls, workshop, asked, clock };
}

proves(["0005-runbooks-runners FR-001"], "a verb is called only by a registered id with typed inputs, an unregistered id and an effect above the verb's are refused, and a shell string is just a value", async () => {
  const seen: unknown[] = [];
  const bindings: VerbBindings = new Map([["work.claim", async (i) => (seen.push(i), ok({ digests: [], outputs: {} }))]]);
  const e = effect("synthetic-vault-01", "durable", "append");
  const unknown = await runVerb(VERBS, bindings, "rm.rf", {}, {}, e);
  assert(unknown.kind === "err" && unknown.error.kind === "refused" && unknown.error.finding.code === "E-RB-VERB-UNKNOWN");
  const exceeds = await runVerb(VERBS, bindings, "work.claim", { order: { kind: "literal", value: "o" } }, { order: "o" }, effect("synthetic-vault-01", "durable", "destroy"));
  assert(exceeds.kind === "err" && exceeds.error.kind === "refused" && exceeds.error.finding.code === "E-RB-EFFECT-EXCEEDS-VERB");
  const wrong = await runVerb(VERBS, bindings, "work.claim", { order: { kind: "literal", value: 3 } }, { order: 3 }, e);
  assert(wrong.kind === "err" && wrong.error.kind === "refused" && wrong.error.finding.code === "E-RB-VERB-INPUTS-INVALID");
  assertEquals(seen, []);
  const shell = "x; rm -rf /";
  const good = await runVerb(VERBS, bindings, "work.claim", { order: { kind: "literal", value: shell } }, { order: shell }, e);
  assertEquals(good.kind, "ok");
  assertEquals(seen, [{ order: shell }]);
  const none = await runVerb(VERBS, new Map(), "work.claim", { order: { kind: "literal", value: "o" } }, { order: "o" }, e);
  assert(none.kind === "err" && none.error.kind === "failed");
  const other = must(createVerbRegistry([]));
  assert((await runVerb(other, bindings, "work.claim", {}, {}, e)).kind === "err");
});

proves(["0005-runbooks-runners FR-002"], "the answer of a judge is decoded into its declared type, a wrong one is refused, the agent is given no verb and nothing is applied", async () => {
  const j = RESTORE_DRILL.steps.find((s) => s.id === "summarize-drill") as Extract<Step, { kind: "judge" }>;
  const good = await runJudge(j, { propose: async () => ({ summary: "same", attention: ["none"], outcome: "restored" }) });
  assertEquals(good, { kind: "ok", value: { summary: "same", attention: ["none"], outcome: "restored" } });
  for (const raw of [{ summary: "x" }, { summary: "x", attention: [], outcome: "maybe" }, { summary: "x", attention: [], outcome: "restored", extra: 1 }, "text", null]) {
    assertEquals((await runJudge(j, { propose: async () => raw })).kind, "err");
  }
  assertEquals((await runJudge(j, { propose: async () => { throw new Error("offline"); } })).kind, "err");
  const w = world({ actor: PERSON });
  await runRunbook(RESTORE_DRILL, w.deps);
  assertEquals(Object.keys(w.asked[0] as object).sort(), ["output", "question", "step"]);
  assert(!w.calls.some((c) => c.includes("summar")), "a judge calls no verb");
});

proves(["0005-runbooks-runners FR-003"], "a gate parks the run as an event naming the approver and the deadline, an agent's answer is refused, and a person's lets the run go on and finish", async () => {
  const w = world();
  const first = await runRunbook(RESTORE_DRILL, w.deps);
  assert(first.kind === "ok");
  assertEquals(first.value.parked, ["approve-record"]);
  assertEquals(first.value.steps["approve-record"]?.approver, "synthetic-approver-01");
  assertEquals(first.value.steps["approve-record"]?.deadline, "2026-11-26T10:00:00Z");
  assertEquals(first.value.finished, undefined);
  assert(!w.calls.includes("work.record"), "nothing behind the gate has run");
  w.events.push(must(makeRunEvent({ id: w.deps.source.nextEventId(), item: ITEM, at: NOW, actor: AGENT }, { kind: "answered", step: "approve-record", answer: "approved" })));
  const again = await runRunbook(RESTORE_DRILL, w.deps);
  assert(again.kind === "ok" && again.value.parked.length === 1 && again.value.refused.length === 1);
  w.events.push(must(makeRunEvent({ id: w.deps.source.nextEventId(), item: ITEM, at: NOW, actor: PERSON }, { kind: "answered", step: "approve-record", answer: "approved" })));
  const done = await runRunbook(RESTORE_DRILL, w.deps);
  assert(done.kind === "ok");
  assertEquals(done.value.finished, "succeeded");
  assertEquals(done.value.attached, []);
  assert(w.calls.includes("work.record") && w.calls.indexOf("work.record") > w.calls.indexOf("store.digests"));
});

proves(["0005-runbooks-runners FR-004"], "a store is attached only where it offers the capabilities it is attached for, and every store is detached when the run ends, failed or parked past its deadline", async () => {
  const lacking = world({ offers: { "synthetic-scratch-01": ["read", "write", "list"] } });
  const r = await runRunbook(RESTORE_DRILL, lacking.deps);
  assert(r.kind === "ok");
  assertEquals(r.value.finished, "failed");
  assert(r.value.steps["attach-scratch"]?.status === "failed");
  assertEquals(r.value.attached, []);
  assertEquals(lacking.workshop.filter((x) => x.startsWith("detach")).sort(), ["detach synthetic-backup-01", "detach synthetic-db-01"]);
  const w = world();
  const parked = await runRunbook(RESTORE_DRILL, w.deps);
  assert(parked.kind === "ok" && parked.value.attached.length === 3);
  w.clock.now = LATER;
  const ended = await runRunbook(RESTORE_DRILL, w.deps);
  assert(ended.kind === "ok");
  assertEquals(ended.value.finished, "parked");
  assertEquals(ended.value.attached, []);
  assertEquals(ended.value.steps["approve-record"]?.status, "expired");
  assertEquals(w.workshop.filter((x) => x.startsWith("detach")).length, 3);
});

proves(["0005-runbooks-runners FR-005"], "a failure runs the compensations of the steps that succeeded in the reverse order and records each", async () => {
  const release = authored(verbId("work.release"));
  const e = effect("synthetic-vault-01", "durable", "append");
  const undo = (id: string, of: string): Step => ({ id: sid(id), title: id, spec: [{ spec: "0005-runbooks-runners", requirement: "FR-005" }], kind: "undo", compensates: sid(of), verb: release, inputs: { order: { kind: "literal", value: id } }, effect: e });
  const claim = (id: string) => verb(id, "work.claim", e, { order: { kind: "literal", value: id } });
  const rb = runbook([claim("one"), claim("two"), verb("three", "work.record", e, { order: { kind: "literal", value: "three" } }), undo("undo-one", "one"), undo("undo-two", "two")]);
  const w = world({ rb, bindings: { "work.record": async () => err("the store refused") } });
  const r = await runRunbook(rb, w.deps);
  assert(r.kind === "ok");
  assertEquals(r.value.finished, "failed");
  assertEquals(w.calls, ["work.claim", "work.claim", "work.release", "work.release"]);
  const compensated = w.events.flatMap((ev) => (ev.data.type === "commented" ? [decodeRunEvent(ev.data.body)] : [])).flatMap((d) => (d.kind === "ok" && d.value.kind === "compensated" ? [d.value.for] : []));
  assertEquals(compensated, ["two", "one"]);
});

proves(["0005-runbooks-runners FR-006"], "an agent never applies a step that is a person's and waits for a person on a proposal, and a person may apply it", async () => {
  const e = effect("synthetic-vault-01", "durable", "destroy");
  const rb = runbook([verb("wipe", "store.delete", e, { store: store("synthetic-vault-01") })]);
  const w = world({ rb });
  const r = await runRunbook(rb, w.deps);
  assert(r.kind === "ok");
  assertEquals(r.value.parked, ["wipe"]);
  assertEquals(w.calls, []);
  const person = world({ rb, actor: PERSON });
  const p = await runRunbook(rb, person.deps);
  assert(p.kind === "ok");
  assertEquals(p.value.finished, "succeeded");
  assertEquals(person.calls, ["store.delete"]);
  const mutate = runbook([verb("cp", "store.checkpoint", effect("synthetic-db-01", "transactional", "append"), { store: store("synthetic-db-01") }), verb("change", "store.restore", effect("synthetic-db-01", "transactional", "mutate"), { store: store("synthetic-db-01"), from: store("synthetic-vault-01") })], { needs: [{ id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "s", name: "sqlite3" }] });
  const proposal = world({ rb: mutate });
  const q = await runRunbook(mutate, proposal.deps);
  assert(q.kind === "ok");
  assertEquals(q.value.parked, ["change"]);
  assertEquals(proposal.calls, ["store.checkpoint"]);
});

proves(["0005-runbooks-runners FR-007"], "every fact of a run is a planning event on the work order made by the actor, and the state the runner gives is the fold of them", async () => {
  const w = world({ actor: PERSON });
  const r = await runRunbook(RESTORE_DRILL, w.deps);
  assert(r.kind === "ok");
  assert(w.events.length > 20);
  for (const ev of w.events) {
    assertEquals(ev.item, ITEM);
    assert(ev.data.type === "commented" && decodeRunEvent(ev.data.body).kind === "ok");
    assertEquals(ev.actor.kind, "person");
  }
  assertEquals(r.value, foldRun(ITEM, w.events));
  const agent = world();
  await runRunbook(RESTORE_DRILL, agent.deps);
  assert(agent.events.every((ev) => ev.actor.kind === "agent" && ev.actor.principal.id === PERSON.id));
  const bad = await runRunbook({ ...RESTORE_DRILL, steps: RESTORE_DRILL.steps.slice(0, 1).map((s) => ({ ...s, spec: [] }) as Step) }, w.deps);
  assert(bad.kind === "err" && Array.isArray(bad.error));
});

proves(["0005-runbooks-runners FR-008"], "the command checks, plans, projects and explains, refuses an unknown verb with its code and says a registered one has no binding here", async () => {
  const run = async (...argv: string[]) => {
    const out: string[] = [];
    const errs: string[] = [];
    const code = await main(argv, { out: (t) => void out.push(t), err: (t) => void errs.push(t) });
    return { code, out: out.join("\n"), err: errs.join("\n") };
  };
  assertEquals((await run("check")).code, 0);
  const plan = await run("plan", "restore-drill");
  assertEquals(plan.code, 0);
  assert(plan.out.includes("approve-record: gate, human-only"));
  assertEquals((await run("plan", "nope")).code, 1);
  const project = await run("project", "--dialect", "codex");
  assert(project.out.includes("=== codex AGENTS.md") && !project.out.includes("claude-code"));
  assertEquals((await run("project", "--dialect", "mystery")).code, 1);
  assertEquals((await run("explain", "E-RB-JUDGE-EFFECT")).out.includes("fixer: agent"), true);
  const unknown = await run("verb", "rm.rf");
  assertEquals(unknown.code, 1);
  assert(unknown.err.includes("E-RB-VERB-UNKNOWN") && unknown.err.includes("fix (environment)"));
  const known = await run("verb", "store.backup");
  assertEquals(known.code, 2);
  assert(known.err.includes("holds no binding"));
  assertEquals((await run("bogus")).code, 1);
});
