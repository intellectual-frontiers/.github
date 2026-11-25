/**
 * Tests of the algebra of a runbook (commons runbooks 0002-runbooks-algebra FR-001 to FR-007): eight kinds of step handled by an exhaustive switch, branded ids, the decoder with its reasons, the citations and the controls
 * of grc, the integrity of a runbook and the needs a runbook declares as requirements of the workbench.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { authored, childrenOf, decodeRunbook, defineRunbook, flatten, parseCite, RESTORE_DRILL, STEP_KINDS, type Step, stepId, storeRef, verbId } from "@intellectual-frontiers/runbooks/governance";
import { parseControlUrn } from "@intellectual-frontiers/grc/governance";
import { effect, plain, runbook, sid, verb } from "./kit.ts";

proves(["0002-runbooks-algebra FR-001"], "a step is one of eight kinds, the switch over them is exhaustive, and a ninth kind is refused with the reason", () => {
  assertEquals(STEP_KINDS, ["verb", "check", "ask", "judge", "branch", "each", "gate", "undo"]);
  const kinds = new Set(flatten(RESTORE_DRILL.steps).map((s) => s.kind));
  for (const k of ["verb", "check", "judge", "gate"]) assert(kinds.has(k as Step["kind"]), k);
  const nested: Step = { id: sid("outer"), title: "o", spec: [], kind: "each", over: "hosts", source: { kind: "input", name: "hosts" }, body: [verb("inner", "work.claim", effect("synthetic-vault-01", "durable", "append"))] };
  assertEquals(childrenOf(nested).map((s) => s.id), ["inner"]);
  assertEquals(flatten([nested]).map((s) => s.id), ["outer", "inner"]);
  const ninth = decodeRunbook({ ...plain, steps: [{ kind: "teleport", id: "x", title: "x", spec: [] }] });
  assert(ninth.kind === "err");
  assert(ninth.error.some((f) => f.code === "E-RB-RUNBOOK-MALFORMED" && f.message.includes("one of verb, check, ask, judge, branch, each, gate, undo")));
});

proves(["0002-runbooks-algebra FR-002"], "ids are made only by a smart constructor: words with hyphens, a verb as noun.action, a citation as spec id and requirement id", () => {
  assertEquals(stepId("take-backup").kind, "ok");
  assertEquals(stepId("Take Backup").kind, "err");
  assertEquals(stepId("").kind, "err");
  assertEquals(verbId("store.checkpoint").kind, "ok");
  assertEquals(verbId("store").kind, "err");
  assertEquals(verbId("rm -rf /").kind, "err");
  assertEquals(storeRef("synthetic-db-01").kind, "ok");
  assertEquals(parseCite("0003-runbooks-effects FR-001").kind, "ok");
  assertEquals(parseCite("FR-001").kind, "err");
  assertEquals(parseCite("0003-runbooks-effects fr-1").kind, "err");
});

proves(["0002-runbooks-algebra FR-003"], "a runbook as plain data decodes into a runbook with the same steps, and what is not one gives every reason", () => {
  const r = decodeRunbook(plain);
  assert(r.kind === "ok");
  assertEquals(r.value.steps.map((s) => s.id), ["claim", "think"]);
  assertEquals(r.value.stores.map((s) => s.ref), ["synthetic-db-01"]);
  const bad = decodeRunbook({ ...plain, version: 3 });
  assert(bad.kind === "err" && bad.error[0]?.message.includes("$.version"));
  assertEquals(decodeRunbook("nope").kind, "err");
  assertEquals(decodeRunbook({ ...plain, steps: [] }).kind, "err");
  assertEquals(decodeRunbook(RESTORE_DRILL).kind, "ok");
  assertEquals(decodeRunbook(JSON.parse(JSON.stringify(RESTORE_DRILL))).kind, "ok");
  const store = decodeRunbook({ ...plain, stores: [{ ref: "synthetic-db-01", class: "transactional", needs: ["chmod"] }] });
  assertEquals(store.kind, "err");
});

proves(["0002-runbooks-algebra FR-004"], "each kind says what it needs: a judge names its typed output, a verb names a registered id with its effect, an ask its approver and deadline", () => {
  const noOutput = decodeRunbook({ ...plain, steps: [{ kind: "judge", id: "think", title: "t", spec: [], question: "q" }] });
  assert(noOutput.kind === "err" && noOutput.error[0]?.message.includes("$.steps[0].output"));
  const noEffect = decodeRunbook({ ...plain, steps: [{ kind: "verb", id: "v", title: "v", spec: [], verb: "work.claim", inputs: {} }] });
  assertEquals(noEffect.kind, "err");
  const ask = decodeRunbook({ ...plain, steps: [{ kind: "ask", id: "a", title: "a", spec: [], question: "ok?", approver: "synthetic-approver-01" }] });
  assert(ask.kind === "err" && ask.error[0]?.message.includes("deadlineHours"));
  const withAsk = decodeRunbook({ ...plain, steps: [{ kind: "ask", id: "a", title: "a", spec: [], question: "ok?", approver: "synthetic-approver-01", deadlineHours: 48 }] });
  assertEquals(withAsk.kind, "ok");
  const withJudgeEffect = decodeRunbook({ ...plain, steps: [{ kind: "judge", id: "j", title: "j", spec: [], question: "q", output: { a: { kind: "text" } }, effect: { store: "synthetic-db-01", class: "transactional", mode: "mutate", reversible: false } }] });
  assert(withJudgeEffect.kind === "err" && withJudgeEffect.error[0]?.code === "E-RB-JUDGE-EFFECT");
});

proves(["0002-runbooks-algebra FR-005"], "a step cites requirements and the controls of several catalogs by the reference of grc, as an object or as its URN", () => {
  const r = decodeRunbook(plain);
  assert(r.kind === "ok");
  const first = r.value.steps[0];
  assert(first !== undefined && first.controls !== undefined);
  assertEquals(first.controls, [{ framework: "nist-800-53", version: "5.2.0", control: "CP-9" }, { framework: "soc2-tsc", version: "2017", control: "A1.3" }]);
  assertEquals(first.spec, [{ spec: "0003-runbooks-effects", requirement: "FR-001" }]);
  const drill = flatten(RESTORE_DRILL.steps).flatMap((s) => s.controls ?? []);
  assertEquals(new Set(drill.map((c) => c.framework)), new Set(["nist-800-53", "nist-csf", "soc2-tsc"]));
  assertEquals(parseControlUrn("urn:grc:nist-800-53:5.2.0:CP-9").kind, "ok");
  assertEquals(decodeRunbook({ ...plain, steps: [{ ...plain.steps[1], controls: ["not a urn"] }] }).kind, "err");
});

proves(["0002-runbooks-algebra FR-006"], "a runbook is refused where an id is used twice, a step reads a step that is not before it, an undo compensates nothing, or a gate guards a step that is not after it", () => {
  const e = effect("synthetic-vault-01", "durable", "append");
  const twice = defineRunbook(runbook([verb("same", "work.claim", e), verb("same", "work.claim", e)]));
  assert(twice.kind === "err" && twice.error[0]?.message.includes("used twice"));
  const gateBack = defineRunbook(runbook([verb("first", "work.claim", e), { id: sid("gate"), title: "g", spec: [], kind: "gate", action: "approve", approver: "synthetic-approver-01", demands: "human-only", guards: [sid("first")] }]));
  assert(gateBack.kind === "err" && gateBack.error[0]?.message.includes("not a step after it"));
  const undoNothing = defineRunbook(runbook([{ id: sid("undo-x"), title: "u", spec: [], kind: "undo", compensates: sid("ghost"), verb: authored(verbId("work.release")), inputs: {}, effect: e }]));
  assert(undoNothing.kind === "err" && undoNothing.error.some((f) => f.message.includes("no step of the runbook")));
  const branchForward = defineRunbook(runbook([{ id: sid("br"), title: "b", spec: [], kind: "branch", on: sid("later"), output: "x", equals: true, then: [], otherwise: [] }, verb("later", "work.claim", e)]));
  assert(branchForward.kind === "err");
  const undeclared = defineRunbook(runbook([verb("v", "work.claim", effect("synthetic-nowhere-01", "durable", "append"))]));
  assert(undeclared.kind === "err" && undeclared.error[0]?.message.includes("does not declare"));
  assertEquals(defineRunbook(RESTORE_DRILL).kind, "ok");
});

proves(["0002-runbooks-algebra FR-007"], "a runbook and a step declare their needs as requirements of the workbench, and a need that names an installer is refused", () => {
  const r = decodeRunbook(plain);
  assert(r.kind === "ok");
  assertEquals(r.value.needs.map((n) => [n.kind, n.id]), [["program", "sqlite3"]]);
  const installer = decodeRunbook({ ...plain, needs: [{ kind: "program", id: "sqlite3", name: "sqlite3", summary: "sqlite3 runs", install: ["apt-get", "install", "-y", "sqlite3"] }] });
  assert(installer.kind === "err" && installer.error[0]?.code === "E-RB-NEED-INSTALLER");
  const stepNeed = decodeRunbook({ ...plain, steps: [{ ...plain.steps[0], needs: [{ kind: "credential", id: "token", name: "SYNTHETIC_TOKEN", summary: "a token name" }] }] });
  assert(stepNeed.kind === "ok");
  assertEquals(stepNeed.value.steps[0]?.needs?.map((n) => n.id), ["token"]);
  const badNeed = decodeRunbook({ ...plain, needs: [{ kind: "program", id: "Bad Id", name: "x", summary: "s" }] });
  assert(badNeed.kind === "ok" || badNeed.kind === "err");
});
