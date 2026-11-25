/**
 * Tests of the events of a run of a runbook (commons workload 0008-form-runbook FR-015 and FR-016): each event is a planning comment in the envelope of the core, decoded into the closed union of the form or refused, and a run is
 * not finished while a store is attached or a step is parked.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { EVENT_PREFIX } from "@intellectual-frontiers/workload/governance";
import { canFinish, decodeRunEvent, encodeRunEvent, foldRun, type RunEvent } from "@intellectual-frontiers/workload/forms/runbook";
import { AGENT, ev, ITEM } from "./kit.ts";

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

proves(["0008-form-runbook FR-015"], "every run event is a planning comment with a canonical body, decoded into the closed union or refused", () => {
  for (const e of ALL) {
    const body = encodeRunEvent(e);
    assert(body.startsWith(EVENT_PREFIX));
    assertEquals(decodeRunEvent(body), { kind: "ok", value: e });
    assertEquals(encodeRunEvent(e), body);
    const event = ev(1, AGENT, e);
    assert(event.data.type === "commented" && event.data.body === body);
  }
  assertEquals(encodeRunEvent({ kind: "attached", class: "durable", store: "synthetic-vault-01" } as RunEvent), `${EVENT_PREFIX}{"class":"durable","form":"runbook","kind":"attached","store":"synthetic-vault-01"}`);
  assertEquals(decodeRunEvent("a comment").kind, "err");
  assertEquals(decodeRunEvent(`${EVENT_PREFIX}{"form":"runbook","kind":"teleport"}`).kind, "err");
  assertEquals(decodeRunEvent(`${EVENT_PREFIX}not json`).kind, "err");
  assertEquals(decodeRunEvent(`${EVENT_PREFIX}{"form":"reconcile","kind":"started"}`).kind, "err");
  assertEquals(decodeRunEvent(`${EVENT_PREFIX}{"form":"runbook","kind":"attached","store":"s","class":"cloud"}`).kind, "err");
});

proves(["0008-form-runbook FR-016"], "a run is not finished while a store is attached or a step is parked", () => {
  const attached = foldRun(ITEM, [ev(1, AGENT, ALL[7] as RunEvent), ev(2, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(attached.finished, undefined);
  assert(attached.refused[0]?.reason.includes("not finished"));
  const parked = foldRun(ITEM, [ev(1, AGENT, ALL[4] as RunEvent), ev(2, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(parked.finished, undefined);
  const clear = foldRun(ITEM, [ev(1, AGENT, ALL[7] as RunEvent), ev(2, AGENT, ALL[8] as RunEvent), ev(3, AGENT, { kind: "finished", outcome: "succeeded" })]);
  assertEquals(clear.finished, "succeeded");
  assertEquals(canFinish(clear), true);
  assertEquals(canFinish(attached), false);
});
