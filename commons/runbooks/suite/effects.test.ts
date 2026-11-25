/**
 * Tests of the effects of a step and the autonomy derived from them (commons runbooks 0003-runbooks-effects FR-001 to FR-008): the classes and modes, the idempotency key of a system of record, the workshop that owns nothing
 * durable and is disposable by computation, the table that derives autonomy, the gate that can only raise the control, the actions that are a person's, the effect within the verb's and the autonomy of each kind of step.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { agentMay } from "@intellectual-frontiers/workbench/governance";
import { AUTONOMY_TABLE, authored, decodeRunbook, defineRunbook, GATE_ACTIONS, MODES, RESTORE_DRILL, STORE_CLASSES, type Step, type Runbook, verbId } from "@intellectual-frontiers/runbooks/governance";
import { agentCanGate, check, derivedAutonomy, disposable, GATE_PERSON_ONLY, lessAutonomous, levelsOf, mayPassGate } from "@intellectual-frontiers/runbooks/logical";
import { AGENT, effect, PERSON, plain, runbook, sid, verb } from "./kit.ts";

const gate = (id: string, guards: string[], demands: Extract<Step, { kind: "gate" }>["demands"] = "human-only"): Step => ({ id: sid(id), title: id, spec: [], kind: "gate", action: "approve", approver: "synthetic-approver-01", demands, guards: guards.map(sid) });

proves(["0003-runbooks-effects FR-001"], "an effect has a store, one of five classes, one of four modes and whether it is reversible, and anything else is refused", () => {
  assertEquals(STORE_CLASSES, ["ephemeral", "transactional", "durable", "git", "external"]);
  assertEquals(MODES, ["read", "append", "mutate", "destroy"]);
  for (const c of STORE_CLASSES) for (const m of MODES) assert(AUTONOMY_TABLE[c][m] !== undefined, `${c} ${m}`);
  const bad = decodeRunbook({ ...plain, steps: [{ ...plain.steps[0], effect: { store: "synthetic-db-01", class: "cloud", mode: "read", reversible: true } }] });
  assertEquals(bad.kind, "err");
  const badMode = decodeRunbook({ ...plain, steps: [{ ...plain.steps[0], effect: { store: "synthetic-db-01", class: "transactional", mode: "erase", reversible: true } }] });
  assertEquals(badMode.kind, "err");
});

proves(["0003-runbooks-effects FR-002"], "a change to a system of record must name the input that is its idempotency key, and a read need not", () => {
  const ext = (mode: "read" | "mutate", key?: string): Runbook => runbook([verb("apply", "external.apply", { ...effect("synthetic-ledger-01", "external", mode), ...(key === undefined ? {} : { idempotencyKey: key }) }, { key: { kind: "literal", value: "k" }, store: { kind: "store", store: effect("synthetic-ledger-01", "external", mode).store } })]);
  const none = defineRunbook(ext("mutate"));
  assert(none.kind === "err" && none.error[0]?.code === "E-RB-EXTERNAL-NO-KEY");
  assertEquals(defineRunbook(ext("mutate", "key")).kind, "ok");
  assertEquals(defineRunbook(ext("mutate", "absent")).kind, "err");
  assertEquals(defineRunbook(ext("read")).kind, "ok");
});

proves(["0003-runbooks-effects FR-003"], "a workshop is disposable by what is attached and no runbook declares it", () => {
  assertEquals(disposable([]), true);
  assertEquals(disposable([{ class: "ephemeral" }]), true);
  assertEquals(disposable([{ class: "ephemeral" }, { class: "durable" }]), false);
  assertEquals(disposable([{ class: "transactional" }]), false);
  assertEquals(Object.keys(RESTORE_DRILL).filter((k) => /dispos/iu.test(k)), []);
  assertEquals(RESTORE_DRILL.stores.every((s) => s.needs.length > 0), true);
});

proves(["0003-runbooks-effects FR-004"], "autonomy follows from the effect by one table: read is autonomous, an append to git is reviewed, a mutation of a transactional store is proposed, a destroy of a durable store and a rewrite of git are a person's", () => {
  assertEquals(AUTONOMY_TABLE.durable.read, "agent-autonomous");
  assertEquals(AUTONOMY_TABLE.git.append, "agent-acts-human-reviews");
  assertEquals(AUTONOMY_TABLE.transactional.mutate, "agent-proposes");
  assertEquals(AUTONOMY_TABLE.durable.destroy, "human-only");
  assertEquals(AUTONOMY_TABLE.git.mutate, "human-only");
  assertEquals(AUTONOMY_TABLE.external.append, "agent-proposes");
  assertEquals(AUTONOMY_TABLE.ephemeral.destroy, "agent-autonomous");
  for (const c of STORE_CLASSES) assertEquals(AUTONOMY_TABLE[c].read, "agent-autonomous");
  const destroy = verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false));
  assertEquals(derivedAutonomy(destroy), "human-only");
  const declared = decodeRunbook({ ...plain, steps: [{ ...plain.steps[0], autonomy: "agent-autonomous", effect: { store: "synthetic-db-01", class: "transactional", mode: "mutate", reversible: true } }] });
  assert(declared.kind === "ok");
  assertEquals(levelsOf(declared.value)[0]?.autonomy, "agent-proposes");
});

proves(["0003-runbooks-effects FR-005"], "a gate only raises the control: the less autonomous of the derived level and the demand, never more autonomous than the effect makes it", () => {
  const read = verb("look", "store.digests", effect("synthetic-db-01", "transactional", "read"));
  const raised = levelsOf(runbook([gate("g", ["look"], "human-only"), read])).find((l) => l.id === "look");
  assertEquals(raised?.autonomy, "human-only");
  assertEquals(raised?.raisedBy, "g");
  const destroy = verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false));
  const stays = levelsOf(runbook([gate("g", ["wipe"], "agent-autonomous"), destroy])).find((l) => l.id === "wipe");
  assertEquals(stays?.autonomy, "human-only");
  assertEquals(stays?.raisedBy, undefined);
  assertEquals(lessAutonomous("agent-autonomous", "agent-proposes"), "agent-proposes");
  assertEquals(lessAutonomous("human-only", "agent-autonomous"), "human-only");
});

proves(["0003-runbooks-effects FR-006"], "approve, tag and a pentest scope are a person's, a gate is passed by a person alone, and a gate named deploy is refused", () => {
  for (const a of GATE_ACTIONS) assertEquals(agentCanGate(a), false);
  for (const level of ["agent-autonomous", "agent-acts-human-reviews", "agent-proposes", "human-only"] as const) {
    assertEquals(agentMay(level, "approve"), false);
    assertEquals(agentMay(level, "tag"), false);
  }
  assertEquals(GATE_PERSON_ONLY, ["approve", "tag", "pentest-scope"]);
  assertEquals(mayPassGate(PERSON), true);
  assertEquals(mayPassGate(AGENT), false);
  const deploy = decodeRunbook({ ...plain, steps: [{ kind: "gate", id: "g", title: "g", spec: [], action: "deploy", approver: "a", demands: "human-only", guards: [] }] });
  assertEquals(deploy.kind, "err");
});

proves(["0003-runbooks-effects FR-007"], "an effect may be less than its verb's and never more, and the class must be one the verb acts on", () => {
  const less = check(runbook([verb("look", "store.backup", effect("synthetic-vault-01", "durable", "append"), { store: { kind: "store", store: effect("synthetic-db-01", "durable", "read").store }, target: { kind: "store", store: effect("synthetic-vault-01", "durable", "read").store } })], { needs: [{ id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "s", name: "sqlite3" }] }));
  assertEquals(less.filter((f) => f.code === "E-RB-EFFECT-EXCEEDS-VERB"), []);
  const more = check(runbook([verb("wipe", "store.backup", effect("synthetic-vault-01", "durable", "destroy"))]));
  assert(more.some((f) => f.code === "E-RB-EFFECT-EXCEEDS-VERB"));
  const wrongClass = check(runbook([verb("wipe", "store.backup", effect("synthetic-scratch-01", "ephemeral", "append"))]));
  assert(wrongClass.some((f) => f.code === "E-RB-EFFECT-EXCEEDS-VERB"));
});

proves(["0003-runbooks-effects FR-008"], "a check is autonomous, a judge proposes, an ask and a gate are a person's, an undo has its compensation's level and a branch or an each the least of what it holds", () => {
  const steps = new Map(RESTORE_DRILL.steps.map((s) => [s.id as string, s]));
  assertEquals(derivedAutonomy(steps.get("verify-digests") as Step), "agent-autonomous");
  assertEquals(derivedAutonomy(steps.get("summarize-drill") as Step), "agent-proposes");
  assertEquals(derivedAutonomy(steps.get("approve-record") as Step), "human-only");
  const ask: Step = { id: sid("a"), title: "a", spec: [], kind: "ask", question: "ok?", approver: "synthetic-approver-01", deadlineHours: 24 };
  assertEquals(derivedAutonomy(ask), "human-only");
  const undo: Step = { id: sid("u"), title: "u", spec: [], kind: "undo", compensates: sid("x"), verb: authored(verbId("work.release")), inputs: {}, effect: effect("synthetic-db-01", "transactional", "mutate") };
  assertEquals(derivedAutonomy(undo), "agent-proposes");
  const each: Step = { id: sid("e"), title: "e", spec: [], kind: "each", over: "hosts", source: { kind: "input", name: "hosts" }, body: [verb("a", "work.claim", effect("synthetic-vault-01", "durable", "append")), verb("b", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false))] };
  assertEquals(derivedAutonomy(each), "human-only");
  const branch: Step = { id: sid("b"), title: "b", spec: [], kind: "branch", on: sid("a"), output: "x", equals: true, then: [verb("c", "work.claim", effect("synthetic-vault-01", "durable", "append"))], otherwise: [] };
  assertEquals(derivedAutonomy(branch), "agent-acts-human-reviews");
  assertEquals(derivedAutonomy({ ...branch, then: [] }), "agent-autonomous");
});

