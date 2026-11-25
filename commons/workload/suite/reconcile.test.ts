/**
 * Tests of the reconcile form (commons workload 0009-form-reconcile FR-001 to FR-013): six kinds of node in a closed sum, the checks of a loop, the autonomy of each node, the diff and the plan, a pass that is level-triggered,
 * the approval of a plan by its hash and nothing else, the apply that covers the plan and is made once for a hash, the events and their fold, the catalog, the dry run and the outcome. It runs a fake native runner and uses no machine.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { authored, catalogProblems, nodeId, VERBS, verbId } from "@intellectual-frontiers/workload/governance";
import { meets } from "@intellectual-frontiers/workload/logical";
import {
  check,
  checkValue,
  CONVERGE_SETTINGS,
  decodeReconcile,
  decodeReconcileEvent,
  defineReconcile,
  derivedAutonomy,
  diffStates,
  encodeReconcileEvent,
  foldReconcile,
  isPlanHash,
  levelsOf,
  makeReconcileEvent,
  modeOf,
  outcomeOf,
  parsePlan,
  plan,
  planText,
  RECONCILE_CATALOG,
  RECONCILE_FORM,
  RECONCILE_KINDS,
  type ReconcileEvent,
  requiredMode,
} from "@intellectual-frontiers/workload/forms/reconcile";
import { runReconcile } from "@intellectual-frontiers/workload/physical";
import { AGENT, CONTRACT, eventId, facts, ITEM, must, PERSON } from "./kit.ts";
import { rworld, withNodes } from "./reconcile-world.ts";
import { NOW } from "./world.ts";

const plainLoop = JSON.parse(JSON.stringify(CONVERGE_SETTINGS)) as Record<string, unknown>;
const codes = (l: Parameters<typeof check>[0]): readonly string[] => check(l).map((f) => f.code);
const answer = (w: ReturnType<typeof rworld>, actor: typeof PERSON | typeof AGENT, plan: string, as: "approved" | "declined" = "approved"): void => {
  w.events.push(must(makeReconcileEvent({ id: w.deps.source.nextEventId(), item: ITEM, at: NOW, actor }, { kind: "answered", node: "approve-plan", answer: as, evidence: { kind: "digest", digest: plan } })));
};
const lastPlan = async (w: ReturnType<typeof rworld>): Promise<string> => {
  const s = foldReconcile(ITEM, w.events);
  return s.plan?.hash ?? "";
};

proves(["0009-form-reconcile FR-001"], "a reconcile is a workload of the form reconcile with a closed sum of six kinds of node, and a value of another form or a seventh kind is refused", () => {
  assertEquals(RECONCILE_KINDS, ["observe", "diff", "plan", "approve", "apply", "verify"]);
  assertEquals(RECONCILE_FORM.nodeKinds, RECONCILE_KINDS);
  assertEquals(new Set(CONVERGE_SETTINGS.nodes.map((n) => n.kind)), new Set(RECONCILE_KINDS));
  for (const n of CONVERGE_SETTINGS.nodes) assert(derivedAutonomy(n).length > 0, n.id);
  assertEquals(decodeReconcile(CONVERGE_SETTINGS).kind, "ok");
  assertEquals(decodeReconcile(plainLoop).kind, "ok");
  const seventh = decodeReconcile({ ...plainLoop, nodes: [{ kind: "teleport", id: "x", title: "x", spec: [] }] });
  assert(seventh.kind === "err" && seventh.error[0]?.code === "E-RC-LOOP-MALFORMED" && seventh.error[0].message.includes("one of observe, diff, plan, approve, apply, verify"));
  assertEquals(decodeReconcile({ ...plainLoop, form: "runbook" }).kind, "err");
  assertEquals(decodeReconcile({ ...plainLoop, trigger: { kind: "manual" } }).kind, "ok");
  assertEquals(decodeReconcile("nope").kind, "err");
});

proves(["0009-form-reconcile FR-002"], "each kind says what it needs: an observe says what it observes and the verb that reads, an apply names its plan, its verb and its effect, an approve names the plan and the nodes it guards", () => {
  const nodes = plainLoop["nodes"] as readonly Record<string, unknown>[];
  const without = (kind: string, field: string) => decodeReconcile({ ...plainLoop, nodes: nodes.map((n) => (n["kind"] === kind ? Object.fromEntries(Object.entries(n).filter(([k]) => k !== field)) : n)) });
  assertEquals(without("observe", "of").kind, "err");
  assertEquals(without("observe", "using").kind, "err");
  assertEquals(without("diff", "desired").kind, "err");
  assertEquals(without("plan", "from").kind, "err");
  assertEquals(without("approve", "guards").kind, "err");
  assertEquals(without("apply", "effect").kind, "err");
  assertEquals(without("apply", "plan").kind, "err");
  assertEquals(without("verify", "asserts").kind, "err");
  assertEquals(decodeReconcile({ ...plainLoop, nodes: nodes.map((n) => (n["kind"] === "observe" ? { ...n, of: "wished" } : n)) }).kind, "err");
});

proves(["0009-form-reconcile FR-003"], "a loop is refused where an id is used twice, a node names a node that is not before it or is not of the kind it must be, an approve guards what is not an apply after it, or the loop observes only one of the states", () => {
  const same = defineReconcile(withNodes((ns) => [...ns, ns[0] as never]));
  assert(same.kind === "err" && same.error[0]?.message.includes("used twice"));
  const forward = defineReconcile(withNodes((ns) => [ns[2] as never, ...ns.filter((n) => n.id !== "diff-settings")]));
  assert(forward.kind === "err");
  const wrongKind = defineReconcile(withNodes((ns) => ns.map((n) => (n.kind === "plan" ? { ...n, from: authored(nodeId("observe-actual")) } : n))));
  assert(wrongKind.kind === "err" && wrongKind.error.some((f) => f.message.includes("must be a diff")));
  const swapped = defineReconcile(withNodes((ns) => ns.map((n) => (n.kind === "diff" ? { ...n, actual: n.desired } : n))));
  assert(swapped.kind === "err" && swapped.error.some((f) => f.message.includes("must observe the actual state")));
  const guardsPlan = defineReconcile(withNodes((ns) => ns.map((n) => (n.kind === "approve" ? { ...n, guards: [authored(nodeId("plan-changes"))] } : n))));
  assert(guardsPlan.kind === "err");
  const noDesired = defineReconcile(withNodes((ns) => ns.filter((n) => n.id !== "observe-desired" && n.id !== "diff-settings" && n.id !== "plan-changes" && n.id !== "approve-plan" && n.id !== "apply-changes" && n.id !== "verify-converged")));
  assert(noDesired.kind === "err" && noDesired.error.some((f) => f.message.includes("observes the desired state")));
  const undeclared = defineReconcile({ ...CONVERGE_SETTINGS, stores: CONVERGE_SETTINGS.stores.slice(1) });
  assert(undeclared.kind === "err" && undeclared.error.some((f) => f.message.includes("does not declare")));
  assertEquals(defineReconcile(CONVERGE_SETTINGS).kind, "ok");
});

proves(["0009-form-reconcile FR-004"], "the check finds an apply that needs a person and no approval of its plan guards, a loop that applies and never verifies, and what every form shares, and the starter passes", () => {
  assertEquals(check(CONVERGE_SETTINGS), []);
  const unapproved = withNodes((ns) => ns.filter((n) => n.kind !== "approve"));
  const f = check(unapproved).find((x) => x.code === "E-RC-APPLY-UNAPPROVED");
  assert(f !== undefined && f.safety === true && f.fixer === "person");
  const wrongPlan = withNodes((ns) => ns.map((n) => (n.kind === "approve" ? { ...n, guards: [] as never } : n)));
  assert(codes(wrongPlan).includes("E-RC-APPLY-UNAPPROVED") && codes(wrongPlan).includes("E-WL-GATE-GUARDS-NOTHING"));
  assert(codes(withNodes((ns) => ns.filter((n) => n.kind !== "verify"))).includes("E-RC-VERIFY-MISSING"));
  const ephemeral = { ...withNodes((ns) => ns.filter((n) => n.kind !== "approve").map((n) => (n.kind === "apply" ? { ...n, effect: { store: n.effect.store, class: "ephemeral" as const, mode: "mutate" as const, reversible: true } } : n))), stores: CONVERGE_SETTINGS.stores.map((s) => (s.ref === "synthetic-live-01" ? { ...s, class: "ephemeral" as const } : s)) };
  assertEquals(codes(ephemeral).includes("E-RC-APPLY-UNAPPROVED"), false, "an effect on an ephemeral store needs no approval");
  assert(codes(withNodes((ns) => ns.map((n) => (n.kind === "apply" ? { ...n, effect: { ...n.effect, idempotencyKey: "absent" } } : n)))).includes("E-WL-EXTERNAL-NO-KEY"));
  assert(codes(withNodes((ns) => ns.map((n) => (n.kind === "observe" ? { ...n, using: authored(verbId("state.apply")) } : n)))).includes("E-WL-CHECK-NOT-READ"));
  assert(codes(withNodes((ns) => ns.map((n) => (n.kind === "verify" ? { ...n, using: authored(verbId("rm.rf")) } : n)))).includes("E-WL-VERB-UNKNOWN"));
  assert(codes(withNodes((ns) => ns.map((n) => (n.kind === "diff" ? { ...n, spec: [] } : n)))).includes("E-WL-CITATION-MISSING"));
  assertEquals(checkValue(plainLoop), []);
  assertEquals(checkValue({ ...plainLoop, nodes: [] })[0]?.code, "E-RC-LOOP-MALFORMED");
});

proves(["0009-form-reconcile FR-005"], "an observe, a diff, a plan and a verify are autonomous, an approve is a person's and an apply has the autonomy of its effect, and the approval can only raise the control", () => {
  const level = new Map(levelsOf(CONVERGE_SETTINGS).map((l) => [String(l.id), l]));
  for (const id of ["observe-actual", "observe-desired", "diff-settings", "plan-changes", "verify-converged"]) assertEquals(level.get(id)?.autonomy, "agent-autonomous", id);
  assertEquals(level.get("approve-plan")?.autonomy, "human-only");
  assertEquals(level.get("apply-changes")?.derived, "human-only");
  assertEquals(level.get("apply-changes")?.autonomy, "human-only");
  const appended = withNodes((ns) => ns.map((n) => (n.kind === "apply" ? { ...n, effect: { ...n.effect, mode: "append" as const } } : n)));
  const raised = levelsOf(appended).find((l) => l.id === "apply-changes");
  assertEquals(raised?.derived, "agent-proposes");
  assertEquals(raised?.autonomy, "agent-proposes");
  const ungated = levelsOf(withNodes((ns) => ns.map((n) => (n.kind === "apply" ? { ...n, effect: { ...n.effect, mode: "append" as const } } : n)).filter((n) => n.kind !== "approve")));
  assertEquals(ungated.find((l) => l.id === "apply-changes")?.autonomy, "agent-proposes");
});

proves(["0009-form-reconcile FR-006"], "the diff of two states is the creates, updates and deletes in the order of their names, the plan is the same bytes for the same changes, and the mode a plan needs follows from its actions", () => {
  const changes = diffStates({ b: 1, a: "on", z: true }, { a: "off", b: 1, c: 2 });
  assertEquals(changes, [{ key: "a", action: "update", from: "on", to: "off" }, { key: "c", action: "create", to: 2 }, { key: "z", action: "delete", from: true }]);
  assertEquals(diffStates({ a: 1 }, { a: 1 }), []);
  assertEquals(planText(changes), planText([...changes].map((c) => ({ ...c }))));
  assertEquals(planText([{ to: 2, key: "c", action: "create" }]), planText([{ action: "create", key: "c", to: 2 }]));
  assertEquals(parsePlan(planText(changes)), changes);
  assertEquals(parsePlan("not json"), undefined);
  assertEquals(parsePlan('[{"key":"a","action":"teleport"}]'), undefined);
  assertEquals(modeOf("create"), "append");
  assertEquals(modeOf("update"), "mutate");
  assertEquals(modeOf("delete"), "destroy");
  assertEquals(requiredMode([]), "read");
  assertEquals(requiredMode(changes.slice(0, 2)), "mutate");
  assertEquals(requiredMode(changes), "destroy");
  assertEquals(isPlanHash("a".repeat(64)), true);
  assertEquals(isPlanHash("A".repeat(64)), false);
});

proves(["0009-form-reconcile FR-007"], "a pass is level-triggered: each run observes what is now, a run with nothing to change applies nothing, a drift after convergence is a new pass, and a parked pass is resumed", async () => {
  const w = rworld({ actor: AGENT });
  const first = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(first.kind === "ok");
  assertEquals(first.value.parked, ["approve-plan"]);
  assertEquals(first.value.passes, 1);
  assertEquals(first.value.finished, undefined);
  assertEquals(first.value.plan?.changes, 3);
  assert(!w.calls.some((c) => c.startsWith("apply")), "nothing is applied before a person approves");
  answer(w, PERSON, await lastPlan(w));
  const second = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(second.kind === "ok");
  assertEquals(second.value.passes, 1, "the parked pass is resumed, not started again");
  assertEquals(second.value.finished, "converged");
  assertEquals(w.live, w.desired);
  const observed = w.calls.filter((c) => c.startsWith("observe")).length;
  assertEquals(observed, 4, "each run observes the actual and the desired state again");
  const quiet = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(quiet.kind === "ok");
  assertEquals(quiet.value.passes, 2);
  assertEquals(quiet.value.finished, "converged");
  assertEquals(quiet.value.plan?.changes, 0);
  assertEquals(w.calls.filter((c) => c.startsWith("apply")).length, 1, "a pass with nothing to change applies nothing");
  w.live["synthetic-setting-b"] = 9;
  const drift = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(drift.kind === "ok");
  assertEquals(drift.value.passes, 3);
  assertEquals(drift.value.parked, ["approve-plan"], "the earlier approval does not carry over to a new pass");
  assertEquals(drift.value.approved, []);
});

proves(["0009-form-reconcile FR-008"], "a plan is approved by its hash alone: an approval of another hash does not count, a plan that changed is parked again, only a person approves, and the hash is the evidence on the approval", async () => {
  const w = rworld({ actor: AGENT });
  const first = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(first.kind === "ok");
  const hash = await lastPlan(w);
  assert(isPlanHash(hash));
  const parked = w.events.flatMap((e) => (e.data.type === "commented" ? [decodeReconcileEvent(e.data.body)] : [])).flatMap((d) => (d.kind === "ok" && d.value.kind === "parked" ? [d.value] : []));
  assertEquals(parked.map((p) => [p.node, p.approver, p.plan]), [["approve-plan", "synthetic-approver-01", hash]]);
  answer(w, AGENT, hash);
  const byAgent = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(byAgent.kind === "ok" && byAgent.value.refused.length === 1 && byAgent.value.refused[0]?.reason.includes("only a person approves a plan"));
  assertEquals(byAgent.value.finished, undefined);
  assertEquals(w.calls.filter((c) => c.startsWith("apply")), []);
  answer(w, PERSON, "f".repeat(64));
  const wrong = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(wrong.kind === "ok");
  assertEquals(wrong.value.planApproved, false);
  assertEquals(wrong.value.parked, ["approve-plan"]);
  assertEquals(w.calls.filter((c) => c.startsWith("apply")), []);
  answer(w, PERSON, hash);
  w.live["synthetic-setting-b"] = 5;
  const changed = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(changed.kind === "ok");
  assert(changed.value.plan !== undefined && changed.value.plan.hash !== hash, "the plan changed with the world");
  assertEquals(changed.value.planApproved, false);
  assertEquals(changed.value.parked, ["approve-plan"]);
  assertEquals(w.calls.filter((c) => c.startsWith("apply")), [], "the approval of the old plan does not apply the new one");
  const second = await lastPlan(w);
  answer(w, PERSON, second);
  const done = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(done.kind === "ok");
  assertEquals(done.value.finished, "converged");
  assertEquals(w.calls.filter((c) => c.startsWith("apply")), [`apply ${second}`]);
  const approvals = w.events.flatMap((e) => (e.data.type === "commented" ? [decodeReconcileEvent(e.data.body)] : [])).flatMap((d) => (d.kind === "ok" && d.value.kind === "answered" ? [d.value] : []));
  for (const a of approvals) assertEquals(a.evidence.kind, "digest");
  assertEquals(approvals.at(-1)?.evidence.digest, second);
  const declined = rworld();
  await runReconcile(CONVERGE_SETTINGS, declined.deps);
  answer(declined, PERSON, await lastPlan(declined), "declined");
  const no = await runReconcile(CONVERGE_SETTINGS, declined.deps);
  assert(no.kind === "ok");
  assertEquals(no.value.finished, "failed");
  assertEquals(declined.calls.filter((c) => c.startsWith("apply")), []);
  const late = rworld();
  await runReconcile(CONVERGE_SETTINGS, late.deps);
  late.clock.now = must((await import("@intellectual-frontiers/planning/governance")).parseInstant("2026-11-30T10:00:00Z"));
  const expired = await runReconcile(CONVERGE_SETTINGS, late.deps);
  assert(expired.kind === "ok");
  assertEquals(expired.value.finished, "parked");
  assertEquals(expired.value.nodes["approve-plan"]?.status, "expired");
});

proves(["0009-form-reconcile FR-009"], "an apply is made once for a plan hash by that hash as its idempotency key, only for changes its effect covers, and never for a plan nobody approved", async () => {
  const w = rworld();
  await runReconcile(CONVERGE_SETTINGS, w.deps);
  const hash = await lastPlan(w);
  answer(w, PERSON, hash);
  await runReconcile(CONVERGE_SETTINGS, w.deps);
  assertEquals(w.calls.filter((c) => c.startsWith("apply")), [`apply ${hash}`]);
  const applied = foldReconcile(ITEM, w.events).applied;
  assertEquals(applied, [hash]);
  const small = withNodes((ns) => ns.map((n) => (n.kind === "apply" ? { ...n, effect: { ...n.effect, mode: "mutate" as const } } : n)));
  const v = rworld();
  await runReconcile(small, v.deps);
  answer(v, PERSON, await lastPlan(v));
  const refused = await runReconcile(small, v.deps);
  assert(refused.kind === "ok");
  assertEquals(refused.value.finished, "failed");
  assertEquals(refused.value.nodes["apply-changes"]?.status, "failed");
  assertEquals(v.calls.filter((c) => c.startsWith("apply")), [], "a delete is not covered by a mutate");
  const ok2 = rworld({ desired: { "synthetic-setting-a": "off", "synthetic-setting-b": 1 }, live: { "synthetic-setting-a": "on", "synthetic-setting-b": 1 } });
  await runReconcile(small, ok2.deps);
  answer(ok2, PERSON, await lastPlan(ok2));
  const done = await runReconcile(small, ok2.deps);
  assert(done.kind === "ok" && done.value.finished === "converged");
  const failing = rworld({ bindings: { "state.verify": async () => ok({ digests: [], outputs: {}, holds: false }) } });
  await runReconcile(CONVERGE_SETTINGS, failing.deps);
  answer(failing, PERSON, await lastPlan(failing));
  const notConverged = await runReconcile(CONVERGE_SETTINGS, failing.deps);
  assert(notConverged.kind === "ok");
  assertEquals(notConverged.value.finished, "failed");
  assertEquals(notConverged.value.nodes["verify-converged"]?.holds, false);
  const broken = rworld({ bindings: { "state.apply": async () => err("the system refused") } });
  await runReconcile(CONVERGE_SETTINGS, broken.deps);
  answer(broken, PERSON, await lastPlan(broken));
  assertEquals(((await runReconcile(CONVERGE_SETTINGS, broken.deps)) as { value: { finished: string } }).value.finished, "failed");
});

proves(["0009-form-reconcile FR-010"], "every event of a pass is a planning comment in the envelope of the core with the form reconcile, decoded into the closed union or refused, and the state is the fold of the events in any arrival order", async () => {
  const hash = "a".repeat(64);
  const all: readonly ReconcileEvent[] = [
    { kind: "pass-started", loop: "converge-settings", version: "0.1.0" },
    { kind: "observed", node: "observe-actual", digest: hash },
    { kind: "diffed", node: "diff-settings", changes: 2 },
    { kind: "planned", node: "plan-changes", hash, changes: 2 },
    { kind: "parked", node: "approve-plan", approver: "synthetic-approver-01", deadline: "2026-11-27T10:00:00Z", plan: hash },
    { kind: "answered", node: "approve-plan", answer: "approved", evidence: { kind: "digest", digest: hash } },
    { kind: "applied", node: "apply-changes", plan: hash, digests: [hash] },
    { kind: "verified", node: "verify-converged", holds: true },
    { kind: "failed", node: "apply-changes", reason: "a reason" },
    { kind: "expired", node: "approve-plan" },
    { kind: "finished", outcome: "converged" },
  ];
  for (const e of all) {
    const body = encodeReconcileEvent(e);
    assert(body.startsWith("workload.event/1 {") && body.includes('"form":"reconcile"'));
    assertEquals(decodeReconcileEvent(body), { kind: "ok", value: e });
    assertEquals(encodeReconcileEvent(e), body);
  }
  assertEquals(decodeReconcileEvent("a comment").kind, "err");
  assertEquals(decodeReconcileEvent('workload.event/1 {"form":"runbook","kind":"started","runbook":"x","version":"1"}').kind, "err");
  assertEquals(decodeReconcileEvent('workload.event/1 {"form":"reconcile","kind":"planned","node":"p","hash":"nope","changes":1}').kind, "err");
  assertEquals(decodeReconcileEvent('workload.event/1 {"form":"reconcile","kind":"teleport"}').kind, "err");
  const events = all.slice(0, 6).map((e, i) => must(makeReconcileEvent({ id: eventId(i + 1), item: ITEM, at: NOW, actor: i === 5 ? PERSON : AGENT }, e)));
  const a = foldReconcile(ITEM, events);
  assertEquals(a, foldReconcile(ITEM, [...events].reverse()));
  assertEquals(a, foldReconcile(ITEM, [...events, ...events]));
  assertEquals(a.planApproved, true);
  assertEquals(a.approved, [hash]);
  assertEquals(a.parked, []);
  assertEquals(a.passes, 1);
  const byAgent = foldReconcile(ITEM, events.map((e, i) => (i === 5 ? must(makeReconcileEvent({ id: e.id, item: ITEM, at: NOW, actor: AGENT }, all[5] as ReconcileEvent)) : e)));
  assertEquals(byAgent.planApproved, false);
  assertEquals(byAgent.refused.length, 1);
  const parked = foldReconcile(ITEM, [events[0] as never, events[4] as never, must(makeReconcileEvent({ id: eventId(9), item: ITEM, at: NOW, actor: AGENT }, { kind: "finished", outcome: "converged" }))]);
  assertEquals(parked.finished, undefined);
  assert(parked.refused[0]?.reason.includes("not finished"));
  const another = foldReconcile(ITEM, [must(makeReconcileEvent({ id: eventId(1), item: ITEM, at: NOW, actor: AGENT }, all[0] as ReconcileEvent)), must((await import("@intellectual-frontiers/workload/governance")).makeWorkloadEvent({ id: eventId(2), item: ITEM, at: NOW, actor: AGENT }, "runbook", { kind: "started", runbook: "x", version: "1" }))]);
  assertEquals(another.passes, 1);
  assertEquals(another.refused, []);
});

proves(["0009-form-reconcile FR-011"], "the catalog of the reconcile form is closed: each code is E-RC-CONCEPT-KIND with its concept, fixer and fix, and the safety rules are the ones that could let an effect happen with no person", () => {
  assertEquals(catalogProblems(RECONCILE_CATALOG), []);
  assertEquals(Object.keys(RECONCILE_CATALOG.entries).sort(), ["E-RC-APPLY-EXCEEDS-PLAN", "E-RC-APPLY-UNAPPROVED", "E-RC-LOOP-MALFORMED", "E-RC-VERIFY-MISSING"]);
  assertEquals(Object.values(RECONCILE_CATALOG.entries).filter((e) => e.safety).map((e) => e.code).sort(), ["E-RC-APPLY-EXCEEDS-PLAN", "E-RC-APPLY-UNAPPROVED"]);
});

proves(["0009-form-reconcile FR-012"], "a dry run gives the nodes with their autonomy and what stops for a person and the workbench's findings, with no effect, and gives no plan for a loop with a finding", () => {
  const p = plan(CONVERGE_SETTINGS, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(p.kind === "ok");
  assertEquals(p.value.form, "reconcile");
  assertEquals(p.value.nodes.length, 7);
  assertEquals(p.value.nodes.find((n) => n.id === "approve-plan")?.stopsForPerson, true);
  assertEquals(p.value.nodes.find((n) => n.id === "observe-actual")?.stopsForPerson, false);
  assertEquals(RECONCILE_FORM.plan(CONVERGE_SETTINGS, { contract: CONTRACT, facts: facts(), today: "2026-11-25" }).kind, "ok");
  const bad = plan(withNodes((ns) => ns.filter((n) => n.kind !== "approve")), { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(bad.kind === "err" && bad.error.some((f) => f.code === "E-RC-APPLY-UNAPPROVED"));
});

proves(["0009-form-reconcile FR-013"], "what a pass finished with is said as completes, parks or fails, and a loop with an expectation is judged against it", async () => {
  const w = rworld();
  const parked = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(parked.kind === "ok");
  assertEquals(outcomeOf(parked.value), undefined);
  answer(w, PERSON, await lastPlan(w));
  const done = await runReconcile(CONVERGE_SETTINGS, w.deps);
  assert(done.kind === "ok");
  assertEquals(outcomeOf(done.value), "completes");
  const expecting = { ...CONVERGE_SETTINGS, expect: { outcome: "completes" as const } };
  assertEquals(decodeReconcile(JSON.parse(JSON.stringify(expecting))).kind, "ok");
  assertEquals(meets(expecting.expect, "completes"), true);
  assertEquals(meets(expecting.expect, "parks"), false);
  const late = rworld();
  await runReconcile(CONVERGE_SETTINGS, late.deps);
  late.clock.now = must((await import("@intellectual-frontiers/planning/governance")).parseInstant("2026-11-30T10:00:00Z"));
  const expired = await runReconcile(CONVERGE_SETTINGS, late.deps);
  assert(expired.kind === "ok");
  assertEquals(outcomeOf(expired.value), "parks");
  const failing = rworld({ bindings: { "state.observe": async () => err("unreachable") } });
  const f = await runReconcile(CONVERGE_SETTINGS, failing.deps);
  assert(f.kind === "ok");
  assertEquals(outcomeOf(f.value), "fails");
  const refusedRun = await runReconcile(withNodes((ns) => ns.filter((n) => n.kind !== "approve")), w.deps);
  assert(refusedRun.kind === "err" && Array.isArray(refusedRun.error));
});

proves(["0009-form-reconcile FR-014"], "the starter loop passes every static check, runs on a schedule, calls only registered verbs and names only synthetic stores", () => {
  assertEquals(check(CONVERGE_SETTINGS), []);
  assertEquals(CONVERGE_SETTINGS.trigger, { kind: "schedule", cadence: "daily" });
  for (const n of CONVERGE_SETTINGS.nodes) {
    const v = n.kind === "apply" ? n.verb : n.kind === "observe" || n.kind === "verify" ? n.using : undefined;
    if (v !== undefined) assert(VERBS.has(v), v);
  }
  for (const s of CONVERGE_SETTINGS.stores) assert(s.ref.startsWith("synthetic-"), s.ref);
  assertEquals(CONVERGE_SETTINGS.nodes.map((n) => n.kind), ["observe", "observe", "diff", "plan", "approve", "apply", "verify"]);
});
