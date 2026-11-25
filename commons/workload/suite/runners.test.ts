/**
 * Tests of the runner axis (commons workload 0010-workload-runners FR-001 to FR-010 and FR-015, with 0005-workload-runs FR-007, 0008-form-runbook FR-023 and 0009-form-reconcile FR-015): the registry of runners and their
 * capabilities, the native runner as the renamed port, the needs a form derives, the policy and its order, the refusal that names what a runner lacks, the autonomy that no runner changes, the two events of a hand-off and their
 * fold, and the closed catalog. Every name is synthetic.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Actor, agent, makeEvent, type ItemEvent, parseInstant } from "@intellectual-frontiers/planning/governance";
import {
  authored, catalogProblems, CORE_CATALOG, createRunnerRegistry, DEFAULT_RUNNER_POLICY, decodeRunnerEvent, decodeRunnerPolicy, encodeRunnerEvent, explain, isRunnerPayload, makeRunnerEvent, NATIVE_ONLY, NATIVE_RUNNER, RUNNER_CAPABILITIES, RUNNER_EVENT_KINDS, RUNNER_KINDS, RUNNERS,
  type Runner, runnerId, type RunnerPolicy, type RunnerEvent, verbId,
} from "@intellectual-frontiers/workload/governance";
import { chooseRunner, foldHandoff, forcesNative, lacksOf, resolveRunner, suitableRunner } from "@intellectual-frontiers/workload/logical";
import { CONVERGE_SETTINGS, foldReconcile, runnerNeedsOf as loopNeeds } from "@intellectual-frontiers/workload/forms/reconcile";
import { bootstrapFleet, callsOf, foldRun, levelsOf, makeRunEvent, plan, runnerNeedsOf, RESTORE_DRILL, type RunEvent, type Runbook, type Step, SYNTHETIC_BOOTSTRAP_01, viewOf } from "@intellectual-frontiers/workload/forms/runbook";
import * as physical from "@intellectual-frontiers/workload/physical";
import { callsOfWorkload, levelsOfWorkload, runnerNeedsOfWorkload, STARTERS, viewOfWorkload } from "@intellectual-frontiers/workload/physical";
import { AGENT, CONTRACT, cite, effect, eventId, facts, ITEM, must, PERSON, runbook, sid, store, verb } from "./kit.ts";

const r = (t: string) => authored(runnerId(t));
const POLICY: RunnerPolicy = { default: r("bash"), perWorkload: { "synthetic-bootstrap-01": r("pwsh") }, perForm: { reconcile: r("native") }, perOperator: { "synthetic-person-01": r("native") } };
const AT = must(parseInstant("2026-11-25T10:00:00Z"));
const A = "a".repeat(64);
const B = "b".repeat(64);
const L = "c".repeat(64);

const head = (id: string) => ({ id: sid(id), title: id, spec: [cite] });
const ask: Step = { ...head("ask-person"), kind: "ask", question: "May it go on?", approver: "synthetic-approver-01", deadlineHours: 24 };
const judge: Step = { ...head("think"), kind: "judge", question: "What now?", output: { answer: { kind: "text" } } };
const branch: Step = { ...head("choose"), kind: "branch", on: sid("think"), output: "answer", equals: "yes", then: [], otherwise: [] };
const undo: Step = { ...head("take-back"), kind: "undo", compensates: sid("claim"), verb: authored(verbId("work.release")), inputs: {}, effect: effect("synthetic-vault-01", "durable", "append") };
const claim = verb("claim", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } });
const wipe = (id: string) => verb(id, "store.delete", effect("synthetic-vault-01", "durable", "destroy", false), { store: store("synthetic-vault-01") });
const gate = (guards: string[], demands: "agent-proposes" | "human-only" = "agent-proposes"): Step => ({ ...head("approve"), kind: "gate", action: "approve", approver: "synthetic-approver-01", demands, guards: guards.map(sid) });
const caps = (steps: readonly Step[]) => runnerNeedsOf(runbook(steps)).map((n) => `${n.capability}:${n.node}`);

proves(["0010-workload-runners FR-001"], "the runners are a registry typed in the core with an id, a kind and the capabilities each declares, and a runner added later is one entry that changes no workload", () => {
  assertEquals(RUNNERS.list().map((x) => x.id), ["bash", "github-actions", "native", "pwsh"]);
  assertEquals([...RUNNER_KINDS], ["native", "integration"]);
  assertEquals([...RUNNER_CAPABILITIES], ["calls", "fan-out", "interactive", "judge", "approval", "logic", "compensate", "destroy"]);
  assertEquals(RUNNERS.list().map((x) => `${x.id}:${x.kind}`), ["bash:integration", "github-actions:integration", "native:native", "pwsh:integration"]);
  assertEquals(createRunnerRegistry([...RUNNERS.list(), RUNNERS.list()[0] as Runner]).kind, "err");
  const before = JSON.stringify([SYNTHETIC_BOOTSTRAP_01, RESTORE_DRILL, CONVERGE_SETTINGS]);
  const mine: Runner = { id: r("minimal-runner"), kind: "integration", title: "A minimal runner", capabilities: ["calls"] };
  const more = must(createRunnerRegistry([...RUNNERS.list(), mine]));
  assertEquals(more.list().length, 5);
  assertEquals(decodeRunnerPolicy({ default: "minimal-runner" }, more).kind, "ok");
  assertEquals(decodeRunnerPolicy({ default: "minimal-runner" }).kind, "err");
  assertEquals(JSON.stringify([SYNTHETIC_BOOTSTRAP_01, RESTORE_DRILL, CONVERGE_SETTINGS]), before);
});

proves(["0010-workload-runners FR-002"], "the native runner is the former executor under its new name: the port of each form, every capability, and the default of every policy", () => {
  assertEquals(Object.keys(physical.RUNBOOK_RUNNER).sort(), ["form", "run"]);
  assertEquals(Object.keys(physical.RECONCILE_RUNNER).sort(), ["form", "run"]);
  assertEquals(physical.RUNBOOK_RUNNER.form, "runbook");
  assertEquals(physical.RECONCILE_RUNNER.form, "reconcile");
  assertEquals(Object.keys(physical).filter((k) => /EXECUTOR/u.test(k)), []);
  assertEquals(RUNNERS.get("native")?.capabilities, RUNNER_CAPABILITIES);
  assertEquals(RUNNERS.get("native")?.kind, "native");
  assertEquals(DEFAULT_RUNNER_POLICY.default, NATIVE_RUNNER);
  assertEquals(must(decodeRunnerPolicy({})), DEFAULT_RUNNER_POLICY);
});

proves(["0010-workload-runners FR-003"], "an integration runner declares only what its artifact can carry, and every capability that only the native runner has is one no integration runner declares", () => {
  for (const x of RUNNERS.list().filter((y) => y.kind === "integration")) {
    assertEquals(x.capabilities, x.id === "github-actions" ? ["calls", "fan-out", "approval"] : ["calls", "fan-out"], x.id);
    for (const c of NATIVE_ONLY) assertEquals(x.capabilities.includes(c), false, `${x.id} ${c}`);
  }
  assertEquals(forcesNative(runnerNeedsOf(RESTORE_DRILL)), true);
  assertEquals(forcesNative(runnerNeedsOf(SYNTHETIC_BOOTSTRAP_01)), false);
});

proves(["0010-workload-runners FR-004", "0008-form-runbook FR-023", "0009-form-reconcile FR-015"], "a form derives what its workload needs of a runner from its nodes, and an ask, a judge, typed logic, an undo and an ungated destroy of a durable store force the native runner", () => {
  assertEquals(caps([claim]), ["calls:claim"]);
  assertEquals(caps([ask]), ["interactive:ask-person"]);
  assertEquals(caps([judge]), ["judge:think"]);
  assertEquals(caps([judge, branch]), ["judge:think", "logic:choose"]);
  assertEquals(caps([claim, undo]), ["calls:claim", "compensate:take-back"]);
  assertEquals(caps([wipe("wipe")]), ["calls:wipe", "destroy:wipe"]);
  assertEquals(caps([gate(["wipe"]), wipe("wipe")]), ["approval:approve", "calls:wipe", "approval:wipe"]);
  assertEquals(caps([verb("rewrite", "git.rewrite", effect("synthetic-repo-01", "git", "mutate", false), { ref: { kind: "literal", value: "main" } })]), ["calls:rewrite", "interactive:rewrite"]);
  assertEquals(caps([verb("fan", "work.claim", effect("synthetic-vault-01", "durable", "append"), {})]), ["calls:fan"]);
  assertEquals(runnerNeedsOf(SYNTHETIC_BOOTSTRAP_01).map((n) => n.capability), ["calls", "calls", "fan-out", "calls"]);
  const drill = new Set(runnerNeedsOf(RESTORE_DRILL).map((n) => n.capability));
  assert(drill.has("judge") && drill.has("approval") && drill.has("calls"));
  for (const x of [RESTORE_DRILL, SYNTHETIC_BOOTSTRAP_01, CONVERGE_SETTINGS]) assertEquals(runnerNeedsOfWorkload(x), x.form === "runbook" ? runnerNeedsOf(x as Runbook) : loopNeeds(CONVERGE_SETTINGS));
  const loop = new Set(loopNeeds(CONVERGE_SETTINGS).map((n) => n.capability));
  assert(loop.has("logic") && loop.has("approval") && loop.has("interactive") && loop.has("calls"));
  assertEquals(forcesNative(loopNeeds(CONVERGE_SETTINGS)), true);
  const lowered = callsOf(SYNTHETIC_BOOTSTRAP_01, { fleet: bootstrapFleet });
  assert(lowered.kind === "ok" && lowered.value.steps.length === 3);
  assertEquals(callsOf(RESTORE_DRILL, { fleet: bootstrapFleet }).kind, "err");
  const refused = callsOfWorkload(CONVERGE_SETTINGS, { fleet: bootstrapFleet });
  assert(refused.kind === "err" && refused.error[0]?.code === "E-WL-RUNNER-EMIT-UNSUPPORTED");
});

proves(["0010-workload-runners FR-005"], "a runner policy is typed data decoded at the boundary into the type or every reason it is not one, with native as the default, and no workload names a runner", () => {
  const ok = decodeRunnerPolicy({ default: "bash", perWorkload: { "synthetic-bootstrap-01": "pwsh" }, perForm: { runbook: "native" }, perOperator: {} });
  assert(ok.kind === "ok" && ok.value.default === "bash" && ok.value.perWorkload["synthetic-bootstrap-01"] === "pwsh" && ok.value.perForm["runbook"] === "native");
  assertEquals(must(decodeRunnerPolicy({ perForm: { reconcile: "native" } })).default, "native");
  const unknown = decodeRunnerPolicy({ default: "native", perOperator: { "synthetic-person-01": "mystery" } });
  assert(unknown.kind === "err" && unknown.error[0]?.includes("mystery is not registered"));
  assertEquals(decodeRunnerPolicy("bash").kind, "err");
  assertEquals(decodeRunnerPolicy({ default: 3 }).kind, "err");
  assertEquals(decodeRunnerPolicy({ perWorkload: { a: 3 } }).kind, "err");
  assertEquals(decodeRunnerPolicy({ perForm: { campaign: "bash" } }).kind, "err");
  assertEquals(decodeRunnerPolicy({ perForm: { graph: "github-actions" } }).kind, "ok");
  for (const w of [...STARTERS, SYNTHETIC_BOOTSTRAP_01]) {
    const text = JSON.stringify(w);
    for (const x of RUNNERS.list()) if (x.id !== "native") assert(!text.includes(`"${x.id}"`), `${w.id} names ${x.id}`);
    assertEquals(Object.keys(w).filter((k) => /runner/iu.test(k)), []);
  }
});

proves(["0010-workload-runners FR-006"], "the choice is the explicit one, then the operator's, the workload's, the form's and the default of the policy", () => {
  const req = { workload: "synthetic-bootstrap-01", form: "runbook", operator: "synthetic-person-01" } as const;
  assertEquals(resolveRunner(POLICY, { ...req, explicit: r("pwsh") }), { runner: "pwsh", from: "explicit" });
  assertEquals(resolveRunner(POLICY, req), { runner: "native", from: "operator" });
  assertEquals(resolveRunner(POLICY, { workload: "synthetic-bootstrap-01", form: "runbook" }), { runner: "pwsh", from: "workload" });
  assertEquals(resolveRunner(POLICY, { workload: "another-workload", form: "reconcile" }), { runner: "native", from: "form" });
  assertEquals(resolveRunner(POLICY, { workload: "another-workload", form: "runbook" }), { runner: "bash", from: "default" });
  assertEquals(resolveRunner(DEFAULT_RUNNER_POLICY, { workload: "restore-drill", form: "runbook" }), { runner: "native", from: "default" });
});

proves(["0010-workload-runners FR-007"], "a runner that lacks what the workload needs is refused with the code, a person to fix it and what it lacks and where, and the run is never moved", () => {
  const needs = runnerNeedsOf(RESTORE_DRILL);
  const refused = suitableRunner("restore-drill", needs, r("bash"));
  assert(refused.kind === "err");
  assertEquals(refused.error.code, "E-WL-RUNNER-UNSUITABLE");
  assertEquals(refused.error.fixer, "person");
  assert(refused.error.message.includes("bash") && refused.error.message.includes("judge (summarize-drill") && refused.error.message.includes("approval (approve-record"), refused.error.message);
  assert(refused.error.fix.includes("native runner") && refused.error.fix.includes("bash"));
  assertEquals(lacksOf(needs, RUNNERS.get("pwsh") as Runner).map((n) => n.capability).sort(), ["approval", "judge"]);
  assertEquals(suitableRunner("restore-drill", needs, NATIVE_RUNNER).kind, "ok");
  assertEquals(suitableRunner("synthetic-bootstrap-01", runnerNeedsOf(SYNTHETIC_BOOTSTRAP_01), r("bash")).kind, "ok");
  assertEquals(suitableRunner("synthetic-bootstrap-01", runnerNeedsOf(SYNTHETIC_BOOTSTRAP_01), r("pwsh")).kind, "ok");
  const unregistered = suitableRunner("x", [], r("mystery"));
  assert(unregistered.kind === "err" && unregistered.error.message.includes("not registered"));
  const byOperator: RunnerPolicy = { ...DEFAULT_RUNNER_POLICY, perOperator: { "synthetic-person-01": r("bash") } };
  const chosen = chooseRunner(byOperator, { workload: "restore-drill", form: "runbook", operator: "synthetic-person-01" }, needs);
  assert(chosen.kind === "err" && chosen.error.code === "E-WL-RUNNER-UNSUITABLE", "the operator's choice is refused, not replaced by the default");
  const loop = chooseRunner({ ...DEFAULT_RUNNER_POLICY, default: r("pwsh") }, { workload: "converge-settings", form: "reconcile" }, loopNeeds(CONVERGE_SETTINGS));
  assert(loop.kind === "err" && loop.error.message.includes("logic") && loop.error.message.includes("approve-plan"));
  const fine = chooseRunner(POLICY, { workload: "synthetic-bootstrap-01", form: "runbook" }, runnerNeedsOf(SYNTHETIC_BOOTSTRAP_01));
  assert(fine.kind === "ok" && fine.value.runner.id === "pwsh" && fine.value.from === "workload");
});

proves(["0010-workload-runners FR-008"], "the autonomy derived for each node is the same under every runner and for both forms, and choosing a runner changes no node, effect or autonomy", () => {
  const all = [...STARTERS, SYNTHETIC_BOOTSTRAP_01];
  const before = JSON.stringify(all);
  assert(all.some((w) => w.form === "runbook") && all.some((w) => w.form === "reconcile"));
  for (const w of all) {
    const reference = levelsOfWorkload(w).map((l) => `${l.id}|${l.kind}|${l.derived}|${l.autonomy}`);
    assert(reference.length > 0);
    for (const x of RUNNERS.list()) {
      const needs = runnerNeedsOfWorkload(w);
      const chosen = chooseRunner({ ...DEFAULT_RUNNER_POLICY, default: x.id }, { workload: w.id, form: w.form }, needs);
      assertEquals(chosen.kind === "ok", lacksOf(needs, x).length === 0, `${w.id} under ${x.id}`);
      assertEquals(levelsOfWorkload(w).map((l) => `${l.id}|${l.kind}|${l.derived}|${l.autonomy}`), reference, `${w.id} under ${x.id}`);
      assertEquals(viewOfWorkload(w).nodes.map((n) => `${n.id}|${n.kind}|${n.derived}|${n.autonomy}`), reference, `${w.id} view under ${x.id}`);
    }
  }
  const dry = plan(RESTORE_DRILL, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(dry.kind === "ok");
  assertEquals(dry.value.nodes.map((n) => `${n.id}|${n.autonomy}`), levelsOf(RESTORE_DRILL).map((l) => `${l.id}|${l.autonomy}`));
  assertEquals(viewOf(SYNTHETIC_BOOTSTRAP_01).nodes.map((n) => n.autonomy), levelsOf(SYNTHETIC_BOOTSTRAP_01).map((l) => l.autonomy));
  assertEquals(JSON.stringify(all), before);
  const gated = [gate(["wipe"], "human-only"), wipe("wipe")];
  assertEquals(caps(gated), ["approval:approve", "calls:wipe", "approval:wipe"]);
  assertEquals(forcesNative(runnerNeedsOf(runbook(gated))), false, "github-actions declares approval");
  assertEquals(RUNNERS.list().filter((x) => x.kind === "integration" && lacksOf(runnerNeedsOf(runbook(gated)), x).length === 0).map((x) => x.id), ["github-actions"]);
});

const handoff = (k: number, over: Partial<Extract<RunnerEvent, { kind: "handoff" }>> = {}, form: "runbook" | "reconcile" = "runbook"): ItemEvent => must(makeRunnerEvent({ id: eventId(k), item: ITEM, at: AT, actor: PERSON }, form, { kind: "handoff", runner: "bash", plan: A, ...over }));
const receipt = (k: number, actor: Actor = PERSON, over: Partial<Extract<RunnerEvent, { kind: "receipt" }>> = {}): ItemEvent => must(makeRunnerEvent({ id: eventId(k), item: ITEM, at: AT, actor }, "runbook", { kind: "receipt", plan: A, ref: "synthetic-run-01", status: 0, log: L, ...over }));

proves(["0010-workload-runners FR-009", "0005-workload-runs FR-007"], "a hand-off and a receipt are events of the envelope of the form, decoded at the boundary, and the fold of a form is the same with and without them", () => {
  const h: RunnerEvent = { kind: "handoff", runner: "bash", plan: A };
  const rc: RunnerEvent = { kind: "receipt", plan: A, ref: "synthetic-run-01", status: 2, log: L, approvals: ["approve-record"] };
  for (const e of [h, rc]) {
    const body = encodeRunnerEvent("runbook", e);
    assertEquals(body, encodeRunnerEvent("runbook", { ...e }));
    const back = decodeRunnerEvent(body);
    assert(back.kind === "ok" && back.value.form === "runbook");
    assertEquals(back.value.event, e);
  }
  assertEquals(encodeRunnerEvent("runbook", h), `workload.event/1 {"form":"runbook","kind":"handoff","plan":"${A}","runner":"bash"}`);
  assertEquals([...RUNNER_EVENT_KINDS], ["handoff", "receipt"]);
  for (const bad of [{ kind: "handoff", runner: "bash", plan: "short" }, { kind: "receipt", plan: A, ref: "r", status: 300, log: L }, { kind: "receipt", plan: A, ref: "", status: 0, log: L }, { kind: "receipt", plan: A, ref: "r", status: 0, log: "x" }, { kind: "handoff", runner: 3, plan: A }]) {
    assertEquals(decodeRunnerEvent(`workload.event/1 ${JSON.stringify({ form: "runbook", ...bad })}`).kind, "err", JSON.stringify(bad));
  }
  assertEquals(decodeRunnerEvent("a comment").kind, "err");
  assert(isRunnerPayload({ kind: "handoff" }) && isRunnerPayload({ kind: "receipt" }) && !isRunnerPayload({ kind: "finished" }));
  const run = [ev(1, { kind: "started", runbook: "restore-drill", version: "0.1.0" }), ev(2, { kind: "step-started", step: "claim-order" })];
  const withHandoff = [...run, handoff(3), receipt(4, AGENT)];
  assertEquals(foldRun(ITEM, withHandoff), foldRun(ITEM, run));
  assertEquals(foldRun(ITEM, withHandoff).refused, []);
  const loopRun = [must(makeEvent({ id: eventId(5), item: ITEM, at: AT, actor: PERSON }, { type: "commented", body: 'workload.event/1 {"form":"reconcile","kind":"pass-started","loop":"converge-settings","version":"0.1.0"}' }))];
  assertEquals(foldReconcile(ITEM, [...loopRun, handoff(6, {}, "reconcile")]), foldReconcile(ITEM, loopRun));
});

function ev(k: number, e: RunEvent, actor: Actor = PERSON): ItemEvent {
  return must(makeRunEvent({ id: eventId(k), item: ITEM, at: AT, actor }, e));
}

proves(["0010-workload-runners FR-010"], "the state of a hand-off is a fold: the same in any order and with a repeat, an unmatched receipt is refused, the outcome is one of the three words and an agent never approves", () => {
  const events = [handoff(1), receipt(2)];
  const state = foldHandoff("runbook", ITEM, events);
  assertEquals(state.state, "received");
  assertEquals(state.outcome, "completes");
  assertEquals(state.handoffs.map((x) => x.runner), ["bash"]);
  assertEquals(state.receipts.map((x) => x.ref), ["synthetic-run-01"]);
  assertEquals(foldHandoff("runbook", ITEM, [...events].reverse()), state);
  assertEquals(foldHandoff("runbook", ITEM, [...events, events[0] as ItemEvent, events[1] as ItemEvent]), state);
  assertEquals(foldHandoff("runbook", ITEM, [receipt(1), handoff(2)]).state, "received", "a receipt that comes first waits for its hand-off");
  assertEquals(foldHandoff("runbook", ITEM, []).state, "none");
  assertEquals(foldHandoff("runbook", ITEM, []).outcome, undefined);
  assertEquals(foldHandoff("runbook", ITEM, [handoff(1)]).state, "handed-off");
  assertEquals(foldHandoff("runbook", ITEM, [handoff(1)]).outcome, undefined);
  const failed = foldHandoff("runbook", ITEM, [handoff(1), receipt(2, PERSON, { status: 7 })]);
  assertEquals(failed.outcome, "fails");
  const unmatched = foldHandoff("runbook", ITEM, [handoff(1, { plan: B }), receipt(2)]);
  assertEquals(unmatched.receipts, []);
  assertEquals(unmatched.refused.length, 1);
  assert(unmatched.refused[0]?.reason.startsWith("E-WL-RUNNER-RECEIPT-UNMATCHED") && unmatched.refused[0]?.reason.includes("no hand-off"), unmatched.refused[0]?.reason);
  assertEquals(unmatched.state, "handed-off");
  const byPerson = foldHandoff("runbook", ITEM, [handoff(1), receipt(2, PERSON, { approvals: ["approve-record"] })]);
  assertEquals(byPerson.approved, ["approve-record"]);
  const byAgent = foldHandoff("runbook", ITEM, [handoff(1), receipt(2, AGENT, { approvals: ["approve-record"] })]);
  assertEquals(byAgent.approved, []);
  assertEquals(byAgent.state, "received");
  assertEquals(byAgent.refused.length, 1);
  assert(byAgent.refused[0]?.reason.startsWith("E-WL-RUNNER-APPROVAL-NOT-PERSON") && byAgent.refused[0]?.reason.includes("only a person approves"));
  assertEquals(foldHandoff("reconcile", ITEM, events).state, "none", "an event of another form is left out");
  const agentOnly = must(agent("synthetic-agent-02", "Synthetic Agent Two", PERSON, "session"));
  assertEquals(foldHandoff("runbook", ITEM, [handoff(1), receipt(2, agentOnly)]).outcome, "completes");
});

proves(["0010-workload-runners FR-015"], "the catalog holds the codes of the concept runner, closed, each with its fixer and its fix, and the approval of an agent is a safety rule", () => {
  assertEquals(catalogProblems(CORE_CATALOG), []);
  const codes = Object.keys(CORE_CATALOG.entries).filter((c) => c.startsWith("E-WL-RUNNER-")).sort();
  assertEquals(codes, ["E-WL-RUNNER-ACTION-UNPINNED", "E-WL-RUNNER-APPROVAL-NOT-PERSON", "E-WL-RUNNER-DRIFT", "E-WL-RUNNER-EACH-UNLISTED", "E-WL-RUNNER-EMIT-UNSUPPORTED", "E-WL-RUNNER-RECEIPT-INVALID", "E-WL-RUNNER-RECEIPT-UNMATCHED", "E-WL-RUNNER-SCHEDULE-NEEDS-INPUT", "E-WL-RUNNER-UNSUITABLE", "E-WL-RUNNER-VALUE-UNSAFE"]);
  for (const c of codes) assertEquals(explain(c).concept, "runner");
  assertEquals(explain("E-WL-RUNNER-UNSUITABLE").fixer, "person");
  assertEquals(explain("E-WL-RUNNER-APPROVAL-NOT-PERSON").safety, true);
  assertEquals(explain("E-WL-RUNNER-DRIFT").fixer, "ci");
  assert(CORE_CATALOG.concepts.includes("runner"));
});

proves(["0010-workload-runners FR-016"], "the core imports nothing from a form and the fold of a hand-off is the shared logical layer's, so that no form owns a runner", async () => {
  const { fs, path } = await import("@intellectual-frontiers/system");
  const root = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src");
  for (const file of ["governance/runner.ts", "governance/runner-events.ts", "logical/runner.ts", "logical/handoff.ts"]) {
    const text = await fs.readTextFile(path.join(root, file));
    assert(!/forms\/(runbook|reconcile)/u.test(text), `${file} names a form`);
  }
});
