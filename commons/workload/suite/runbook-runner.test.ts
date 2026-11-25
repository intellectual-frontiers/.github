/**
 * Tests of the executor of the runbook form with fakes (commons workload 0008-form-runbook FR-017 to FR-022): ask and gate park the run as events and a person answers, a store is attached by capability and detached at the end,
 * a failure runs the compensations, the actor is held to the autonomy, every fact is a planning event, and what a run finished with is said in the three words every form shares. It uses no machine.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { err } from "@intellectual-frontiers/core";
import { authored, verbId } from "@intellectual-frontiers/workload/governance";
import { decodeRunEvent, foldRun, makeRunEvent, outcomeOf, RESTORE_DRILL, type Step } from "@intellectual-frontiers/workload/forms/runbook";
import { meets } from "@intellectual-frontiers/workload/logical";
import { runRunbook } from "@intellectual-frontiers/workload/physical";
import { AGENT, effect, ITEM, must, PERSON, runbook, sid, store, verb } from "./kit.ts";
import { LATER, NOW, world } from "./world.ts";

proves(["0008-form-runbook FR-017"], "a gate parks the run as an event naming the approver and the deadline, an agent's answer is refused, and a person's lets the run go on and finish", async () => {
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

proves(["0008-form-runbook FR-018"], "a store is attached only where it offers the capabilities it is attached for, and every store is detached when the run ends, failed or parked past its deadline", async () => {
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

proves(["0008-form-runbook FR-019"], "a failure runs the compensations of the steps that succeeded in the reverse order and records each", async () => {
  const release = authored(verbId("work.release"));
  const e = effect("synthetic-vault-01", "durable", "append");
  const undo = (id: string, of: string): Step => ({ id: sid(id), title: id, spec: [{ spec: "0008-form-runbook", requirement: "FR-019" }], kind: "undo", compensates: sid(of), verb: release, inputs: { order: { kind: "literal", value: id } }, effect: e });
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

proves(["0008-form-runbook FR-020"], "an agent never applies a step that is a person's and waits for a person on a proposal, and a person may apply it", async () => {
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

proves(["0008-form-runbook FR-021"], "every fact of a run is a planning event on the work order made by the actor, and the state the runner gives is the fold of them", async () => {
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

proves(["0008-form-runbook FR-022"], "what a run finished with is said as completes, parks or fails, and a drill is met where it completes as expected", async () => {
  const done = world({ actor: PERSON });
  const parked = await runRunbook(RESTORE_DRILL, done.deps);
  assert(parked.kind === "ok");
  assertEquals(outcomeOf(parked.value), undefined);
  done.events.push(must(makeRunEvent({ id: done.deps.source.nextEventId(), item: ITEM, at: NOW, actor: PERSON }, { kind: "answered", step: "approve-record", answer: "approved" })));
  const finished = await runRunbook(RESTORE_DRILL, done.deps);
  assert(finished.kind === "ok");
  assertEquals(outcomeOf(finished.value), "completes");
  assertEquals(meets(RESTORE_DRILL.expect, "completes"), true);
  assertEquals(meets(RESTORE_DRILL.expect, "fails"), false);
  assertEquals(meets(undefined, "fails"), true);
  const late = world();
  await runRunbook(RESTORE_DRILL, late.deps);
  late.clock.now = LATER;
  const expired = await runRunbook(RESTORE_DRILL, late.deps);
  assert(expired.kind === "ok");
  assertEquals(outcomeOf(expired.value), "parks");
  const broken = runbook([verb("one", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } })]);
  const failing = world({ rb: broken, bindings: { "work.claim": async () => err("refused") } });
  const f = await runRunbook(broken, failing.deps);
  assert(f.kind === "ok");
  assertEquals(outcomeOf(f.value), "fails");
});
