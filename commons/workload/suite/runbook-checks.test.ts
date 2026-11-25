/**
 * Tests of the checks of a runbook that are its form's (commons workload 0008-form-runbook FR-009 to FR-014): a step that cannot be undone with no gate or undo, a mutation with no checkpoint, a store never detached, a disposal
 * of a workshop that is not disposable, a judge that has no effect and whose proposal is not applied without a person, a runbook that is not well formed, the catalog of the form, and the starter drill that passes.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { catalogProblems } from "@intellectual-frontiers/workload/governance";
import { check, checkValue, decodeRunbook, derivedAutonomy, flatten, RESTORE_DRILL, RUNBOOK_CATALOG, type Runbook, type Step } from "@intellectual-frontiers/workload/forms/runbook";
import { effect, plain, runbook, sid, store, verb } from "./kit.ts";

const SQLITE = { id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "sqlite3 runs", name: "sqlite3" } as const;
const codes = (r: Runbook): readonly string[] => check(r).map((f) => f.code);
const judge = (id: string): Step => ({ id: sid(id), title: id, spec: [], controls: [{ framework: "nist-800-53", version: "5.2.0", control: "CP-9" }], kind: "judge", question: "q", output: { a: { kind: "text" } } });
const attach = (id: string, s: string, c: Parameters<typeof effect>[1]): Step => verb(id, "workshop.attach", effect(s, c, "read"), { store: store(s) });
const detach = (id: string, s: string, c: Parameters<typeof effect>[1]): Step => verb(id, "workshop.detach", effect(s, c, "read"), { store: store(s) });

proves(["0008-form-runbook FR-009"], "the check finds a step that cannot be undone with no gate or undo, a mutation with no checkpoint and a store attached and never detached", () => {
  const irreversible = runbook([verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false))]);
  assert(codes(irreversible).includes("E-RB-STEP-IRREVERSIBLE-UNGUARDED"));
  assertEquals(check(irreversible).find((f) => f.code === "E-RB-STEP-IRREVERSIBLE-UNGUARDED")?.safety, true);
  const gate: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "human-only", guards: [sid("wipe")] };
  assertEquals(codes(runbook([gate, verb("wipe", "store.delete", effect("synthetic-vault-01", "durable", "destroy", false))])).includes("E-RB-STEP-IRREVERSIBLE-UNGUARDED"), false);
  const ephemeral = runbook([verb("scrub", "store.restore", effect("synthetic-scratch-01", "ephemeral", "mutate", false), { store: store("synthetic-scratch-01"), from: store("synthetic-vault-01") })], { needs: [SQLITE] });
  assertEquals(codes(ephemeral).includes("E-RB-STEP-IRREVERSIBLE-UNGUARDED"), false);
  const mutate = verb("change", "store.restore", effect("synthetic-db-01", "transactional", "mutate"), { store: store("synthetic-db-01"), from: store("synthetic-vault-01") });
  assert(codes(runbook([mutate], { needs: [SQLITE] })).includes("E-RB-STORE-NO-CHECKPOINT"));
  const cp = verb("cp", "store.checkpoint", effect("synthetic-db-01", "transactional", "append"), { store: store("synthetic-db-01") });
  assertEquals(codes(runbook([cp, mutate], { needs: [SQLITE] })).includes("E-RB-STORE-NO-CHECKPOINT"), false);
  const loose = runbook([attach("a", "synthetic-vault-01", "durable")]);
  assertEquals(check(loose).filter((f) => f.code === "E-RB-STORE-NOT-DETACHED").map((f) => f.node), ["a"]);
  assertEquals(codes(runbook([attach("a", "synthetic-vault-01", "durable"), detach("d", "synthetic-vault-01", "durable")])).includes("E-RB-STORE-NOT-DETACHED"), false);
});

proves(["0008-form-runbook FR-010"], "the check finds a disposal while a store that is not ephemeral is attached, and not once it is detached", () => {
  const dispose = verb("dispose", "workshop.dispose", effect("synthetic-scratch-01", "ephemeral", "destroy"), { store: store("synthetic-scratch-01") });
  const early = check(runbook([attach("a", "synthetic-vault-01", "durable"), dispose]));
  assert(early.some((f) => f.code === "E-RB-WORKSHOP-NOT-DISPOSABLE" && f.fix.includes("synthetic-vault-01")));
  assertEquals(codes(runbook([attach("a", "synthetic-vault-01", "durable"), detach("d", "synthetic-vault-01", "durable"), dispose])).includes("E-RB-WORKSHOP-NOT-DISPOSABLE"), false);
});

proves(["0008-form-runbook FR-011"], "a judge has no effect (its data cannot carry one, its type has none) and its proposal is not applied above the level of a proposal unless a gate or an ask stands between", () => {
  const r = checkValue({ ...plain, steps: [{ kind: "judge", id: "j", title: "j", spec: ["0006-workload-split FR-001"], question: "q", output: { a: { kind: "text" } }, effect: { store: "synthetic-db-01", class: "transactional", mode: "mutate", reversible: true } }] });
  assertEquals(r.map((f) => f.code), ["E-WL-JUDGE-EFFECT"]);
  assertEquals(r[0]?.fixer, "agent");
  assertEquals(r[0]?.safety, true);
  for (const s of flatten(RESTORE_DRILL.steps)) if (s.kind === "judge") {
    assertEquals("effect" in s, false);
    assertEquals(derivedAutonomy(s), "agent-proposes");
  }
  assertEquals(new Set(flatten(RESTORE_DRILL.steps).filter((s) => "effect" in s).map((s) => s.kind)), new Set(["verb"]));
  const apply = verb("apply", "work.record", effect("synthetic-vault-01", "durable", "append"), { order: { kind: "output", step: sid("think"), name: "a" } });
  assert(codes(runbook([judge("think"), apply])).includes("E-WL-JUDGE-APPLIED"));
  assertEquals(check(runbook([judge("think"), apply])).find((f) => f.code === "E-WL-JUDGE-APPLIED")?.fixer, "person");
  const ask: Step = { id: sid("sure"), title: "sure", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "ask", question: "ok?", approver: "synthetic-approver-01", deadlineHours: 24 };
  assertEquals(codes(runbook([judge("think"), ask, apply])).includes("E-WL-JUDGE-APPLIED"), false);
  const gate: Step = { id: sid("g"), title: "g", spec: [], controls: [{ framework: "x", version: "1", control: "y" }], kind: "gate", action: "approve", approver: "a", demands: "agent-proposes", guards: [sid("apply")] };
  assertEquals(codes(runbook([judge("think"), gate, apply])).includes("E-WL-JUDGE-APPLIED"), false);
});

proves(["0008-form-runbook FR-012"], "the check finds a runbook that is not well formed, and a decoded value that is not a runbook gives the reasons", () => {
  const twice = runbook([verb("same", "work.claim", effect("synthetic-vault-01", "durable", "append")), verb("same", "work.claim", effect("synthetic-vault-01", "durable", "append"))]);
  assert(codes(twice).includes("E-RB-RUNBOOK-MALFORMED"));
  assertEquals(check(twice).find((f) => f.code === "E-RB-RUNBOOK-MALFORMED")?.fixer, "agent");
  assertEquals(checkValue({ ...plain, version: 3 })[0]?.code, "E-RB-RUNBOOK-MALFORMED");
  assertEquals(decodeRunbook(plain).kind, "ok");
  assertEquals(decodeRunbook({ ...plain, steps: [] }).kind, "err");
});

proves(["0008-form-runbook FR-013"], "the catalog of the runbook form is closed: each code is E-RB-CONCEPT-KIND with its concept, fixer and fix", () => {
  assertEquals(catalogProblems(RUNBOOK_CATALOG), []);
  assertEquals(Object.keys(RUNBOOK_CATALOG.entries).sort(), ["E-RB-RUNBOOK-MALFORMED", "E-RB-STEP-IRREVERSIBLE-UNGUARDED", "E-RB-STORE-NO-CHECKPOINT", "E-RB-STORE-NOT-DETACHED", "E-RB-WORKSHOP-NOT-DISPOSABLE"]);
});

proves(["0008-form-runbook FR-014"], "the starter drill passes every static check, runs on a monthly schedule and is expected to complete", () => {
  assertEquals(check(RESTORE_DRILL), []);
  assertEquals(decodeRunbook(RESTORE_DRILL).kind, "ok");
  assertEquals(RESTORE_DRILL.trigger, { kind: "schedule", cadence: "monthly" });
  assertEquals(RESTORE_DRILL.expect, { outcome: "completes" });
});
