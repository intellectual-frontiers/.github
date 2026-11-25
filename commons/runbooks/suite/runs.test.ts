/**
 * Tests of the runs (commons runbooks 0008-runbooks-runs FR-001 to FR-007): a work order is a planning task and no kind is added, a run event is a planning comment decoded at the boundary, a gate is passed by a person alone, the
 * state is a fold that does not depend on arrival, a dry run says what would happen with no effect, a run is not finished with a store attached, and a runbook contributes to the workbench lazily.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ITEM_KINDS, parseItemId } from "@intellectual-frontiers/planning/governance";
import { compose } from "@intellectual-frontiers/workbench/logical";
import { defineContract } from "@intellectual-frontiers/workbench/governance";
import { RESTORE_DRILL, type Step } from "@intellectual-frontiers/runbooks/governance";
import { canFinish, decodeRunEvent, encodeRunEvent, foldRun, makeRunEvent, openWorkOrder, plan, readingSteps, RUN_EVENT_PREFIX, type RunEvent, runbookContribution, selectSteps } from "@intellectual-frontiers/runbooks/logical";
import { AGENT, CONTRACT, effect, ev, eventId, facts, ITEM, must, PERSON, runbook, sid, store, verb } from "./kit.ts";

const ALL: readonly RunEvent[] = [
  { kind: "started", runbook: "restore-drill", version: "0.1.0" },
  { kind: "step-started", step: "claim-order" },
  { kind: "step-succeeded", step: "claim-order", digests: ["a".repeat(64)] },
  { kind: "step-failed", step: "claim-order", reason: "a reason" },
  { kind: "parked", step: "approve-record", approver: "synthetic-approver-01", deadline: "2026-11-27T10:00:00Z" },
  { kind: "answered", step: "approve-record", answer: "approved" },
  { kind: "proposed", step: "summarize-drill", output: { summary: "same", attention: ["none"], outcome: "restored", count: 2, ok: true } },
  { kind: "attached", store: "synthetic-db-01", class: "transactional" },
  { kind: "detached", store: "synthetic-db-01" },
  { kind: "compensated", step: "undo-x", for: "claim-order" },
  { kind: "expired", step: "approve-record" },
  { kind: "finished", outcome: "succeeded" },
];

proves(["0008-runbooks-runs FR-001"], "a work order is a planning item of the kind task, the library adds no kind, and the run is the work order's id", () => {
  const opened = must(openWorkOrder({ id: eventId(1), item: ITEM, at: ev(1, AGENT, ALL[0] as RunEvent).at, actor: AGENT }, RESTORE_DRILL));
  assert(opened.data.type === "opened" && opened.data.kind === "task");
  assertEquals(opened.data.labels, ["runbook:restore-drill"]);
  assertEquals(opened.item, ITEM);
  assertEquals([...ITEM_KINDS], ["issue", "task", "todo", "finding"]);
  assertEquals(foldRun(ITEM, [opened]).run, ITEM);
});

proves(["0008-runbooks-runs FR-002"], "every run event is a planning comment with a canonical body, decoded into the closed union or refused", () => {
  for (const e of ALL) {
    const body = encodeRunEvent(e);
    assert(body.startsWith(RUN_EVENT_PREFIX));
    assertEquals(decodeRunEvent(body), { kind: "ok", value: e });
    assertEquals(encodeRunEvent(e), body);
    const event = ev(1, AGENT, e);
    assert(event.data.type === "commented" && event.data.body === body);
  }
  assertEquals(encodeRunEvent({ kind: "attached", class: "durable", store: "synthetic-vault-01" } as RunEvent), `${RUN_EVENT_PREFIX}{"class":"durable","kind":"attached","store":"synthetic-vault-01"}`);
  assertEquals(decodeRunEvent("a comment").kind, "err");
  assertEquals(decodeRunEvent(`${RUN_EVENT_PREFIX}{"kind":"teleport"}`).kind, "err");
  assertEquals(decodeRunEvent(`${RUN_EVENT_PREFIX}not json`).kind, "err");
  assertEquals(decodeRunEvent(`${RUN_EVENT_PREFIX}{"kind":"attached","store":"s","class":"cloud"}`).kind, "err");
});

proves(["0008-runbooks-runs FR-003"], "an agent acts for a person, and a gate is passed only by the answer of a person", () => {
  const parked = ev(1, AGENT, ALL[4] as RunEvent);
  const byAgent = foldRun(ITEM, [parked, ev(2, AGENT, ALL[5] as RunEvent)]);
  assertEquals(byAgent.steps["approve-record"]?.passed, false);
  assertEquals(byAgent.steps["approve-record"]?.status, "parked");
  assertEquals(byAgent.refused.length, 1);
  assert(byAgent.refused[0]?.reason.includes("only a person answers a gate"));
  const byPerson = foldRun(ITEM, [parked, ev(2, PERSON, ALL[5] as RunEvent)]);
  assertEquals(byPerson.steps["approve-record"]?.passed, true);
  assertEquals(byPerson.parked, []);
  const declined = foldRun(ITEM, [parked, ev(2, PERSON, { kind: "answered", step: "approve-record", answer: "declined" })]);
  assertEquals(declined.steps["approve-record"]?.passed, false);
  assertEquals(AGENT.principal.id, PERSON.id);
});

proves(["0008-runbooks-runs FR-004"], "the state is the fold of the events in the order of their ids, the same in any arrival order, with what is attached, what is parked and whether the workshop is disposable by computation", () => {
  const events = [
    ev(1, AGENT, { kind: "started", runbook: "restore-drill", version: "0.1.0" }),
    ev(2, AGENT, { kind: "attached", store: "synthetic-db-01", class: "transactional" }),
    ev(3, AGENT, { kind: "attached", store: "synthetic-scratch-01", class: "ephemeral" }),
    ev(4, AGENT, { kind: "step-succeeded", step: "checkpoint-source", digests: ["d1"] }),
    ev(5, AGENT, ALL[4] as RunEvent),
    ev(6, AGENT, { kind: "detached", store: "synthetic-db-01" }),
  ];
  const a = foldRun(ITEM, events);
  const b = foldRun(ITEM, [...events].reverse());
  const c = foldRun(ITEM, [...events, ...events]);
  assertEquals(a, b);
  assertEquals(a, c);
  assertEquals(a.attached, [{ store: "synthetic-scratch-01", class: "ephemeral" }]);
  assertEquals(a.disposable, true);
  assertEquals(foldRun(ITEM, events.slice(0, 3)).disposable, false);
  assertEquals(a.parked, ["approve-record"]);
  assertEquals(a.steps["checkpoint-source"]?.digests, ["d1"]);
  assertEquals(a.runbook, "restore-drill");
  const other = ev(7, AGENT, { kind: "attached", store: "synthetic-x-01", class: "durable" });
  assertEquals(foldRun(ITEM, [...events, { ...other, item: must(parseItemId("018f3a6e-7c00-7000-8123-456789abcd00")) }]).attached.length, 1);
  assertEquals(Object.keys(a).includes("stored"), false);
});

proves(["0008-runbooks-runs FR-005"], "a dry run gives the plan and the workbench's findings with no effect, needs only what the steps that read need, and gives no plan for a runbook with a finding", () => {
  const p = plan(RESTORE_DRILL, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(p.kind === "ok");
  assertEquals(p.value.steps.length, 15);
  assertEquals(p.value.steps.find((s) => s.id === "approve-record")?.stopsForPerson, true);
  assertEquals(p.value.steps.find((s) => s.id === "restore-into-scratch")?.autonomy, "agent-autonomous");
  assertEquals(p.value.preconditions.map((f) => f.code), ["E-WB-WORKSHOP-MISSING-PROGRAM"]);
  assertEquals(plan(RESTORE_DRILL, { contract: CONTRACT, facts: facts({ programs: { sqlite3: "3.45.1" } }), today: "2026-11-25" }).kind === "ok" && true, true);
  const only = runbook([verb("change", "store.delete", effect("synthetic-vault-01", "durable", "destroy"), { store: store("synthetic-vault-01") }, { needs: [{ id: "synthetic-tool", kind: "program", concept: "workshop", task: "run", safety: false, summary: "needed to apply", name: "synthetic-tool" }] }), verb("look", "store.digests", effect("synthetic-db-01", "transactional", "read"), { store: store("synthetic-db-01"), other: store("synthetic-vault-01") }, { needs: [{ id: "reader", kind: "program", concept: "workshop", task: "run", safety: false, summary: "needed to read", name: "reader" }] })]);
  const dry = plan(only, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(dry.kind === "ok");
  assertEquals(dry.value.requirements.map((r) => r.id), ["reader"]);
  assertEquals(dry.value.preconditions.map((f) => f.requirement), ["reader"]);
  const unknown = plan({ ...RESTORE_DRILL, given: ["no-such-requirement"] }, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(unknown.kind === "ok" && unknown.value.unknownGiven[0] === "no-such-requirement");
});

proves(["0008-runbooks-runs FR-006"], "a run is not finished while a store is attached or a step is parked", () => {
  const attached = foldRun(ITEM, [ev(1, AGENT, ALL[7] as RunEvent), ev(2, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(attached.finished, undefined);
  assert(attached.refused[0]?.reason.includes("not finished"));
  const parked = foldRun(ITEM, [ev(1, AGENT, ALL[4] as RunEvent), ev(2, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(parked.finished, undefined);
  const clear = foldRun(ITEM, [ev(1, AGENT, ALL[7] as RunEvent), ev(2, AGENT, ALL[8] as RunEvent), ev(3, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(clear.finished, "succeeded");
  assertEquals(canFinish(clear), true);
  assertEquals(canFinish(attached), false);
  void makeRunEvent;
});

proves(["0008-runbooks-runs FR-007"], "a runbook contributes to the workbench only for the steps selected: a branch not taken and an each with no member need nothing", () => {
  const need = (id: string) => ({ id, kind: "program", concept: "workshop", task: "run", safety: false, summary: id, name: id }) as const;
  const inner = (id: string, n: string): Step => ({ ...verb(id, "work.claim", effect("synthetic-vault-01", "durable", "append")), needs: [need(n)] }) as Step;
  const branch: Step = { id: sid("br"), title: "b", spec: [], kind: "branch", on: sid("first"), output: "x", equals: true, then: [inner("in-then", "then-tool")], otherwise: [inner("in-else", "else-tool")] };
  const each: Step = { id: sid("ea"), title: "e", spec: [], kind: "each", over: "hosts", source: { kind: "input", name: "hosts" }, body: [inner("in-each", "each-tool")] };
  const rb = runbook([{ ...inner("first", "first-tool") }, branch, each], { needs: [need("runbook-tool")] });
  const ids = (m: Parameters<typeof selectSteps>[1]) => runbookContribution(rb, selectSteps(rb, m)).requirements.map((r) => r.id);
  assertEquals(ids({ taken: new Map(), members: new Map() }), ["first-tool", "runbook-tool"]);
  assertEquals(ids({ taken: new Map([[sid("br"), "then"]]), members: new Map([[sid("ea"), 0]]) }), ["first-tool", "runbook-tool", "then-tool"]);
  assertEquals(ids({ taken: new Map([[sid("br"), "otherwise"]]), members: new Map([[sid("ea"), 3]]) }), ["each-tool", "else-tool", "first-tool", "runbook-tool"]);
  assertEquals(readingSteps(RESTORE_DRILL).map(String), ["attach-source", "attach-backups", "attach-scratch", "verify-digests", "detach-scratch", "detach-backups", "detach-source"]);
  const contract = must(defineContract({ ...CONTRACT, contributions: [runbookContribution(rb, selectSteps(rb, { taken: new Map([[sid("br"), "then"]]), members: new Map() }))] }));
  assertEquals(compose(contract, "run", { units: [rb.id] }).map((r) => r.id), ["first-tool", "runbook-tool", "sqlite3", "then-tool"]);
  assertEquals(compose(contract, "run", { units: [] }).map((r) => r.id), ["sqlite3"]);
});

