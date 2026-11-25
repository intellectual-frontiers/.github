/**
 * Tests of the split between the probabilistic and the deterministic and of the static check that holds it (commons runbooks 0006-runbooks-split FR-001 to FR-009): a judge has no effect and only proposes, the catalog is
 * closed and has an unknown code, each of the checks finds what it is for, a runbook with a finding is not planned, and the starter drill passes.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CATALOG, type CatalogCode, decodeRunbook, explain, FIXERS, flatten, isCatalogCode, PROBLEM_CONCEPTS, RESTORE_DRILL, type Runbook, type Step, authored, verbId } from "@intellectual-frontiers/runbooks/governance";
import { check, checkValue, derivedAutonomy, plan } from "@intellectual-frontiers/runbooks/logical";
import { CONTRACT, effect, facts, plain, runbook, sid, store, verb } from "./kit.ts";

const SQLITE = { id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "sqlite3 runs", name: "sqlite3" } as const;
const codes = (r: Runbook): readonly string[] => check(r).map((f) => f.code);
const judge = (id: string): Step => ({ id: sid(id), title: id, spec: [], controls: [{ framework: "nist-800-53", version: "5.2.0", control: "CP-9" }], kind: "judge", question: "q", output: { a: { kind: "text" } } });
const attach = (id: string, s: string, c: Parameters<typeof effect>[1]): Step => verb(id, "workshop.attach", effect(s, c, "read"), { store: store(s) });
const detach = (id: string, s: string, c: Parameters<typeof effect>[1]): Step => verb(id, "workshop.detach", effect(s, c, "read"), { store: store(s) });

proves(["0006-runbooks-split FR-001"], "a judge has no effect and only proposes: its data cannot carry one, its type has none and its autonomy is a proposal", () => {
  const r = checkValue({ ...plain, steps: [{ kind: "judge", id: "j", title: "j", spec: ["0006-runbooks-split FR-001"], question: "q", output: { a: { kind: "text" } }, effect: { store: "synthetic-db-01", class: "transactional", mode: "mutate", reversible: true } }] });
  assertEquals(r.map((f) => f.code), ["E-RB-JUDGE-EFFECT"]);
  assertEquals(r[0]?.fixer, "agent");
  assertEquals(r[0]?.safety, true);
  for (const s of flatten(RESTORE_DRILL.steps)) if (s.kind === "judge") {
    assertEquals("effect" in s, false);
    assertEquals(derivedAutonomy(s), "agent-proposes");
  }
  const onlyVerbs = flatten(RESTORE_DRILL.steps).filter((s) => "effect" in s).map((s) => s.kind);
  assertEquals(new Set(onlyVerbs), new Set(["verb"]));
});

proves(["0006-runbooks-split FR-002"], "the catalog is closed, every code has a concept, a fixer and a fix, codes are made as E-RB-CONCEPT-KIND, and what no entry names is E-RB-UNKNOWN", () => {
  const entries = Object.values(CATALOG);
  assert(entries.length >= 18);
  for (const e of entries) {
    assert(PROBLEM_CONCEPTS.includes(e.concept), e.code);
    assert(FIXERS.includes(e.fixer), e.code);
    assert(e.fix.length > 10 && e.what.length > 10 && e.title.length > 5, e.code);
    if (e.code !== "E-RB-UNKNOWN") assertEquals(e.code, `E-RB-${e.concept.toUpperCase()}-${e.kind.toUpperCase()}`);
  }
  assertEquals(new Set(Object.keys(CATALOG)).size, entries.length);
  assertEquals(isCatalogCode("E-RB-STORE-NO-CHECKPOINT"), true);
  assertEquals(isCatalogCode("E-RB-NOPE"), false);
  const unknown = explain("E-SOMETHING-NEW");
  assertEquals(unknown.code, "E-RB-UNKNOWN");
  assert(unknown.fix.includes("add an entry, a check and a test"));
});

proves(["0006-runbooks-split FR-003"], "the check finds a step that cannot be undone with no gate or undo, a mutation with no checkpoint, a store never detached, a verb that is not registered and a step that cites nothing", () => {
  const irreversible = runbook([verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false))]);
  assert(codes(irreversible).includes("E-RB-STEP-IRREVERSIBLE-UNGUARDED"));
  const gate: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "human-only", guards: [sid("wipe")] };
  assertEquals(codes(runbook([gate, verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false))])).includes("E-RB-STEP-IRREVERSIBLE-UNGUARDED"), false);
  const mutate = verb("change", "store.restore", effect("synthetic-db-01", "transactional", "mutate"), { store: store("synthetic-db-01"), from: store("synthetic-vault-01") });
  assert(codes(runbook([mutate], { needs: [SQLITE] })).includes("E-RB-STORE-NO-CHECKPOINT"));
  const cp = verb("cp", "store.checkpoint", effect("synthetic-db-01", "transactional", "append"), { store: store("synthetic-db-01") });
  assertEquals(codes(runbook([cp, mutate], { needs: [SQLITE] })).includes("E-RB-STORE-NO-CHECKPOINT"), false);
  const loose = runbook([attach("a", "synthetic-vault-01", "durable")]);
  assertEquals(check(loose).filter((f) => f.code === "E-RB-STORE-NOT-DETACHED").map((f) => f.step), ["a"]);
  assertEquals(codes(runbook([attach("a", "synthetic-vault-01", "durable"), detach("d", "synthetic-vault-01", "durable")])).includes("E-RB-STORE-NOT-DETACHED"), false);
  const unknown = runbook([{ ...verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append")), kind: "verb", verb: authored(verbId("rm.rf")) } as Step]);
  assert(codes(unknown).includes("E-RB-VERB-UNKNOWN"));
  assertEquals(check(unknown).find((f) => f.code === "E-RB-VERB-UNKNOWN")?.fixer, "environment");
  const cites = runbook([{ ...verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append")), spec: [] } as Step]);
  assert(codes(cites).includes("E-RB-CITATION-MISSING"));
});

proves(["0006-runbooks-split FR-004"], "the check finds a disposal while a store that is not ephemeral is attached, a gate that guards nothing and an effect that exceeds its verb", () => {
  const dispose = verb("dispose", "workshop.dispose", effect("synthetic-scratch-01", "ephemeral", "destroy"), { store: store("synthetic-scratch-01") });
  const early = check(runbook([attach("a", "synthetic-vault-01", "durable"), dispose]));
  assert(early.some((f) => f.code === "E-RB-WORKSHOP-NOT-DISPOSABLE" && f.fix.includes("synthetic-vault-01")));
  assertEquals(codes(runbook([attach("a", "synthetic-vault-01", "durable"), detach("d", "synthetic-vault-01", "durable"), dispose])).includes("E-RB-WORKSHOP-NOT-DISPOSABLE"), false);
  const nothing: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "human-only", guards: [] };
  assert(codes(runbook([nothing])).includes("E-RB-GATE-GUARDS-NOTHING"));
  assert(codes(runbook([verb("w", "work.claim", effect("synthetic-vault-01", "durable", "destroy", false))])).includes("E-RB-EFFECT-EXCEEDS-VERB"));
  const key = runbook([verb("apply", "external.apply", effect("synthetic-ledger-01", "external", "mutate"), { key: { kind: "literal", value: "k" }, store: store("synthetic-ledger-01") })]);
  assert(codes(key).includes("E-RB-EXTERNAL-NO-KEY"));
});

proves(["0006-runbooks-split FR-005"], "the proposal of a judge is not applied above the level of a proposal unless a gate or an ask stands between", () => {
  const apply = verb("apply", "work.record", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "output", step: sid("think"), name: "a" } });
  assert(codes(runbook([judge("think"), apply])).includes("E-RB-JUDGE-APPLIED"));
  assertEquals(check(runbook([judge("think"), apply])).find((f) => f.code === "E-RB-JUDGE-APPLIED")?.fixer, "person");
  const ask: Step = { id: sid("sure"), title: "sure", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "ask", question: "ok?", approver: "synthetic-approver-01", deadlineHours: 24 };
  assertEquals(codes(runbook([judge("think"), ask, apply])).includes("E-RB-JUDGE-APPLIED"), false);
  const gate: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "agent-proposes", guards: [sid("apply")] };
  assertEquals(codes(runbook([judge("think"), gate, apply])).includes("E-RB-JUDGE-APPLIED"), false);
});

proves(["0006-runbooks-split FR-006"], "the findings come in the order of the steps, each with its code, step, fixer and fix, and a runbook with a finding is not planned", () => {
  const bad = runbook([{ ...verb("b", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } }), spec: [] } as Step, { ...verb("a", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: "o" } }), spec: [] } as Step]);
  const found = check(bad);
  assertEquals(found.map((f) => f.step), ["b", "a"]);
  for (const f of found) assert(f.code.startsWith("E-RB-") && f.fixer.length > 0 && f.fix.length > 0);
  const refused = plan(bad, { contract: CONTRACT, facts: facts(), today: "2026-11-25" });
  assert(refused.kind === "err" && refused.error.length === 2);
  assertEquals(check(bad).length, check(bad).length);
});

proves(["0006-runbooks-split FR-007"], "the starter drill passes every static check", () => {
  assertEquals(check(RESTORE_DRILL), []);
  assertEquals(decodeRunbook(RESTORE_DRILL).kind, "ok");
});

proves(["0006-runbooks-split FR-008"], "a verb whose program or credential nobody declares is a missing need, and declaring it in the step or in the runbook clears it", () => {
  const restore = verb("r", "store.checkpoint", effect("synthetic-db-01", "transactional", "append"), { store: store("synthetic-db-01") });
  assert(check(runbook([restore])).some((f) => f.code === "E-RB-NEED-MISSING" && f.fix.includes("store.checkpoint")));
  assertEquals(codes(runbook([restore], { needs: [SQLITE] })).includes("E-RB-NEED-MISSING"), false);
  assertEquals(codes(runbook([{ ...restore, needs: [SQLITE] } as Step])).includes("E-RB-NEED-MISSING"), false);
});

proves(["0006-runbooks-split FR-009"], "the check finds a malformed runbook, inputs that do not fit, a check that does more than read and a need that names an installer", () => {
  const twice = runbook([verb("same", "work.claim", effect("synthetic-vault-01", "durable", "append")), verb("same", "work.claim", effect("synthetic-vault-01", "durable", "append"))]);
  assert(codes(twice).includes("E-RB-RUNBOOK-MALFORMED"));
  const inputs = runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "literal", value: 3 }, extra: { kind: "literal", value: "y" } })]);
  const bad = check(inputs).find((f) => f.code === "E-RB-VERB-INPUTS-INVALID");
  assert(bad !== undefined && bad.message.includes("order is not of the type text") && bad.message.includes("extra is not an input"));
  const notRead: Step = { id: sid("c"), title: "c", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "check", asserts: "x", using: authored(verbId("store.restore")), inputs: { store: store("synthetic-scratch-01"), from: store("synthetic-vault-01") }, evidence: "digest" };
  assert(codes(runbook([notRead], { needs: [SQLITE] })).includes("E-RB-CHECK-NOT-READ"));
  assert(codes(runbook([verb("x", "work.claim", effect("synthetic-vault-01", "durable", "append"))], { needs: [{ ...SQLITE, install: ["apt-get", "install", "-y", "sqlite3"] }] })).includes("E-RB-NEED-INSTALLER"));
  assertEquals(isCatalogCode("E-RB-CHECK-NOT-READ" satisfies CatalogCode), true);
});
