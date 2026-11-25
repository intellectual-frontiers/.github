/**
 * Tests of the split between the probabilistic and the deterministic and of the checks every form shares (commons workload 0006-workload-split FR-001 to FR-006): a judge has no effect and only proposes, the catalogs are
 * closed with one unknown code, each shared check finds what it is for, the verb runner calls a verb only by its registered id, the agent runner decodes the answer of a judge, and a workload with a finding is not planned.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ok } from "@intellectual-frontiers/core";
import { authored, CATALOG, catalogProblems, CORE_CATALOG, createVerbRegistry, explain, explainIn, finding, FIXERS, isCatalogCode, PROBLEM_CONCEPTS, VERBS, verbId } from "@intellectual-frontiers/workload/governance";
import { RECONCILE_CATALOG } from "@intellectual-frontiers/workload/forms/reconcile";
import { check, checkValue, plan, RESTORE_DRILL, RUNBOOK_CATALOG, type Runbook, type Step } from "@intellectual-frontiers/workload/forms/runbook";
import { runJudge, runRunbook, runVerb, type VerbBindings } from "@intellectual-frontiers/workload/physical";
import { CONTRACT, effect, facts, must, PERSON, plain, runbook, sid, store, verb } from "./kit.ts";
import { world } from "./world.ts";

const SQLITE = { id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "sqlite3 runs", name: "sqlite3" } as const;
const codes = (r: Runbook): readonly string[] => check(r).map((f) => f.code);

proves(["0006-workload-split FR-001"], "a judge has no effect and only proposes: its data cannot carry one, the starter has none, and the only nodes with an effect are verbs", () => {
  const r = checkValue({ ...plain, steps: [{ kind: "judge", id: "j", title: "j", spec: ["0006-workload-split FR-001"], question: "q", output: { a: { kind: "text" } }, effect: { store: "synthetic-db-01", class: "transactional", mode: "mutate", reversible: true } }] });
  assertEquals(r.map((f) => f.code), ["E-WL-JUDGE-EFFECT"]);
  assertEquals(finding("E-WL-JUDGE-EFFECT", "j", "m").safety, true);
  assertEquals(CATALOG["E-WL-JUDGE-APPLIED"].fixer, "person");
  assertEquals(RESTORE_DRILL.steps.filter((s) => "effect" in s).every((s) => s.kind === "verb"), true);
});

proves(["0006-workload-split FR-002"], "the catalogs are closed: the core has E-WL codes, each form its own prefix, each code has a concept, a fixer and a fix, and what no entry names is E-WL-UNKNOWN", () => {
  assertEquals(catalogProblems(CORE_CATALOG), []);
  assertEquals(catalogProblems(RUNBOOK_CATALOG), []);
  assertEquals(catalogProblems(RECONCILE_CATALOG), []);
  const entries = Object.values(CATALOG);
  assert(entries.length >= 14);
  for (const e of entries) {
    assert(PROBLEM_CONCEPTS.includes(e.concept as never) , e.code);
    assert(FIXERS.includes(e.fixer), e.code);
  }
  const all = [...Object.keys(CATALOG), ...Object.keys(RUNBOOK_CATALOG.entries), ...Object.keys(RECONCILE_CATALOG.entries)];
  assertEquals(new Set(all).size, all.length);
  assertEquals(isCatalogCode("E-WL-VERB-UNKNOWN"), true);
  assertEquals(isCatalogCode("E-RB-STORE-NO-CHECKPOINT"), false);
  const unknown = explain("E-SOMETHING-NEW");
  assertEquals(unknown.code, "E-WL-UNKNOWN");
  assert(unknown.fix.includes("add an entry, a check and a test"));
  assertEquals(explainIn([CORE_CATALOG, RUNBOOK_CATALOG, RECONCILE_CATALOG], "E-RB-STORE-NO-CHECKPOINT").code, "E-RB-STORE-NO-CHECKPOINT");
  assertEquals(explainIn([CORE_CATALOG, RUNBOOK_CATALOG, RECONCILE_CATALOG], "E-RC-APPLY-UNAPPROVED").code, "E-RC-APPLY-UNAPPROVED");
  assertEquals(explainIn([CORE_CATALOG], "E-RC-APPLY-UNAPPROVED").code, "E-WL-UNKNOWN");
  const bad = { ...CORE_CATALOG, prefix: "E-XX-" };
  assert(catalogProblems(bad).length > 0);
});

proves(["0006-workload-split FR-003"], "the checks every form shares find a verb that is not registered, inputs that do not fit, an effect above its verb's, a system of record with no key, a node that cites nothing, a need nobody declares, a check that does more than read, a need that names an installer and a gate that guards nothing", () => {
  const unknown = runbook([{ ...verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append")), kind: "verb", verb: authored(verbId("rm.rf")) } as Step]);
  assert(codes(unknown).includes("E-WL-VERB-UNKNOWN"));
  assertEquals(check(unknown).find((f) => f.code === "E-WL-VERB-UNKNOWN")?.fixer, "environment");
  const cites = runbook([{ ...verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append")), spec: [] } as Step]);
  assert(codes(cites).includes("E-WL-CITATION-MISSING"));
  const inputs = runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: 3 }, extra: { kind: "literal", value: "y" } })]);
  const bad = check(inputs).find((f) => f.code === "E-WL-VERB-INPUTS-INVALID");
  assert(bad !== undefined && bad.message.includes("order is not of the type text") && bad.message.includes("extra is not an input"));
  assert(codes(runbook([verb("w", "work.claim", effect("synthetic-vault-01", "durable", "destroy", false))])).includes("E-WL-EFFECT-EXCEEDS-VERB"));
  assert(codes(runbook([verb("wipe", "store.backup", effect("synthetic-scratch-01", "ephemeral", "append"))])).includes("E-WL-EFFECT-EXCEEDS-VERB"));
  const key = runbook([verb("apply", "external.apply", effect("synthetic-ledger-01", "external", "mutate"), { key: { kind: "literal", value: "k" }, store: store("synthetic-ledger-01") })]);
  assert(codes(key).includes("E-WL-EXTERNAL-NO-KEY"));
  const restore = verb("r", "store.checkpoint", effect("synthetic-db-01", "transactional", "append"), { store: store("synthetic-db-01") });
  assert(check(runbook([restore])).some((f) => f.code === "E-WL-NEED-MISSING" && f.fix.includes("store.checkpoint")));
  assertEquals(codes(runbook([restore], { needs: [SQLITE] })).includes("E-WL-NEED-MISSING"), false);
  assertEquals(codes(runbook([{ ...restore, needs: [SQLITE] } as Step])).includes("E-WL-NEED-MISSING"), false);
  const notRead: Step = { id: sid("c"), title: "c", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "check", asserts: "x", using: authored(verbId("store.restore")), inputs: { store: store("synthetic-scratch-01"), from: store("synthetic-vault-01") }, evidence: "digest" };
  assert(codes(runbook([notRead], { needs: [SQLITE] })).includes("E-WL-CHECK-NOT-READ"));
  assert(codes(runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"))], { needs: [{ ...SQLITE, install: ["apt-get", "install", "-y", "sqlite3"] }] })).includes("E-WL-NEED-INSTALLER"));
  const nothing: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "human-only", guards: [] };
  assert(codes(runbook([nothing])).includes("E-WL-GATE-GUARDS-NOTHING"));
});

proves(["0006-workload-split FR-004"], "a verb is called only by a registered id with typed inputs, an unregistered id and an effect above the verb's are refused, and a shell string is just a value", async () => {
  const seen: unknown[] = [];
  const bindings: VerbBindings = new Map([["work.claim", async (i) => (seen.push(i), ok({ digests: [], outputs: {} }))]]);
  const e = effect("synthetic-vault-01", "durable", "append");
  const unknown = await runVerb(VERBS, bindings, "rm.rf", {}, {}, e);
  assert(unknown.kind === "err" && unknown.error.kind === "refused" && unknown.error.finding.code === "E-WL-VERB-UNKNOWN");
  const exceeds = await runVerb(VERBS, bindings, "work.claim", { order: { kind: "literal", value: "o" } }, { order: "o" }, effect("synthetic-vault-01", "durable", "destroy"));
  assert(exceeds.kind === "err" && exceeds.error.kind === "refused" && exceeds.error.finding.code === "E-WL-EFFECT-EXCEEDS-VERB");
  const wrong = await runVerb(VERBS, bindings, "work.claim", { order: { kind: "literal", value: 3 } }, { order: 3 }, e);
  assert(wrong.kind === "err" && wrong.error.kind === "refused" && wrong.error.finding.code === "E-WL-VERB-INPUTS-INVALID");
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

proves(["0006-workload-split FR-005"], "the answer of a judge is decoded into its declared type, a wrong one is refused, the agent is given no verb and nothing is applied", async () => {
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

proves(["0006-workload-split FR-006"], "the findings come in the order of the nodes, each with its code, node, fixer and fix, and a workload with a finding is neither planned nor run", async () => {
  const bad = runbook([{ ...verb("b", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } }), spec: [] } as Step, { ...verb("a", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } }), spec: [] } as Step]);
  const found = check(bad);
  assertEquals(found.map((f) => f.node), ["b", "a"]);
  for (const f of found) assert(f.code.startsWith("E-") && f.fixer.length > 0 && f.fix.length > 0);
  const refused = plan(bad, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(refused.kind === "err" && refused.error.length === 2);
  const run = await runRunbook(bad, world({ rb: bad }).deps);
  assert(run.kind === "err" && Array.isArray(run.error) && run.error.length === 2);
  assertEquals(check(bad).length, check(bad).length);
});
