// Spec: 0001-runbooks-layers FR-004
/**
 * The starter runbooks of the library, as typed data a program loads by import. `restore-drill` is the drill of a restore on a transactional store: it takes a restore point, backs the store up, restores the backup into a
 * disposable workshop, checks that the digests are the same, has a person approve the record and disposes of the workshop. It uses only registered verbs, cites the controls of three catalogs by their own ids, and
 * every name in it is synthetic.
 *
 * @example
 * ```ts
 * import { RESTORE_DRILL } from "./starters.ts";
 * RESTORE_DRILL.id; // "restore-drill"
 * ```
 *
 * @module
 */
import type { ControlRef } from "@intellectual-frontiers/grc/governance";
import type { Effect } from "./effect.ts";
import { authored, parseCite, runbookId, type SpecCite, type StepId, stepId, storeRef, verbId } from "./ids.ts";
import type { Common, InputValue, Runbook, Step } from "./step.ts";

const sid = (t: string): StepId => authored(stepId(t));
const cite = (t: string): SpecCite => authored(parseCite(t));
const store = (t: string): InputValue => ({ kind: "store", store: authored(storeRef(t)) });
const effect = (t: string, class_: Effect["class"], mode: Effect["mode"], reversible: boolean): Effect => ({ store: authored(storeRef(t)), class: class_, mode, reversible });
const control = (framework: string, version: string, id: string): ControlRef => ({ framework, version, control: id });

const BACKUP: ControlRef = control("nist-800-53", "5.2.0", "CP-9");
const RECOVER: ControlRef = control("nist-800-53", "5.2.0", "CP-10");
const CSF: ControlRef = control("nist-csf", "2.0", "PR.DS-11");
const SOC2: ControlRef = control("soc2-tsc", "2017", "A1.3");

const DB = "synthetic-db-01";
const BACKUPS = "synthetic-backup-01";
const SCRATCH = "synthetic-scratch-01";
const PLAN = "synthetic-plan-01";

const head = (id: string, title: string, spec: string, controls: readonly ControlRef[] = []): Common => ({ id: sid(id), title, spec: [cite(spec)], ...(controls.length === 0 ? {} : { controls }) });
const verb = (id: string, title: string, spec: string, v: string, inputs: Record<string, InputValue>, e: Effect, controls: readonly ControlRef[] = []): Step => ({ ...head(id, title, spec, controls), kind: "verb", verb: authored(verbId(v)), inputs, effect: e });
const attach = (id: string, which: string, class_: Effect["class"]): Step => verb(id, `Attach ${which}`, "0003-runbooks-effects FR-003", "workshop.attach", { store: store(which) }, effect(which, class_, "read", true));
const detach = (id: string, which: string, class_: Effect["class"]): Step => verb(id, `Detach ${which}`, "0003-runbooks-effects FR-003", "workshop.detach", { store: store(which) }, effect(which, class_, "read", true));

/** The drill of a restore on a transactional store. */
export const RESTORE_DRILL: Runbook = {
  id: authored(runbookId("restore-drill")),
  title: "Restore drill",
  version: "0.1.0",
  summary: "Prove that a backup of a transactional store restores to the same digests, in a disposable workshop, and keep the evidence for the audit.",
  given: ["sqlite3"],
  needs: [],
  inputs: [{ name: "order", type: "text", required: true }],
  stores: [
    { ref: authored(storeRef(DB)), class: "transactional", needs: ["read", "stat", "list"] },
    { ref: authored(storeRef(BACKUPS)), class: "durable", needs: ["read", "write", "append", "history"] },
    { ref: authored(storeRef(SCRATCH)), class: "ephemeral", needs: ["read", "write", "list", "delete"] },
    { ref: authored(storeRef(PLAN)), class: "durable", needs: ["read", "append"] },
  ],
  steps: [
    verb("claim-order", "Claim the work order", "0008-runbooks-runs FR-001", "work.claim", { order: { kind: "input", name: "order" } }, effect(PLAN, "durable", "append", true)),
    attach("attach-source", DB, "transactional"),
    attach("attach-backups", BACKUPS, "durable"),
    attach("attach-scratch", SCRATCH, "ephemeral"),
    verb("checkpoint-source", "Make a restore point of the source", "0003-runbooks-effects FR-004", "store.checkpoint", { store: store(DB) }, effect(DB, "transactional", "append", true), [BACKUP]),
    verb("backup-source", "Back the source up", "0003-runbooks-effects FR-001", "store.backup", { store: store(DB), target: store(BACKUPS) }, effect(BACKUPS, "durable", "append", true), [BACKUP]),
    verb("restore-into-scratch", "Restore the backup into the scratch store of the workshop", "0003-runbooks-effects FR-003", "store.restore", { store: store(SCRATCH), from: store(BACKUPS) }, effect(SCRATCH, "ephemeral", "mutate", true), [RECOVER, SOC2]),
    {
      ...head("verify-digests", "The restored digests are the digests of the source", "0006-runbooks-split FR-003", [RECOVER, CSF, SOC2]),
      kind: "check",
      asserts: "the digests of the restored store are the digests of the source store",
      using: authored(verbId("store.digests")),
      inputs: { store: store(SCRATCH), other: store(DB) },
      evidence: "digest",
    },
    {
      ...head("summarize-drill", "Summarize the drill for the reviewer", "0006-runbooks-split FR-001"),
      kind: "judge",
      question: "Summarize the digests compared and name anything that needs a person's attention.",
      output: { summary: { kind: "text" }, attention: { kind: "texts" }, outcome: { kind: "choice", of: ["restored", "differs"] } },
    },
    {
      ...head("approve-record", "A person approves the drill record", "0003-runbooks-effects FR-006", [SOC2]),
      kind: "gate",
      action: "approve",
      approver: "synthetic-approver-01",
      demands: "agent-proposes",
      guards: [sid("record-evidence")],
    },
    verb("record-evidence", "Record the evidence on the work order", "0008-runbooks-runs FR-002", "work.record", { order: { kind: "input", name: "order" }, digest: { kind: "output", step: sid("verify-digests"), name: "digest" } }, effect(PLAN, "durable", "append", true), [RECOVER]),
    detach("detach-scratch", SCRATCH, "ephemeral"),
    detach("detach-backups", BACKUPS, "durable"),
    detach("detach-source", DB, "transactional"),
    verb("dispose-workshop", "Dispose of the workshop", "0003-runbooks-effects FR-003", "workshop.dispose", { store: store(SCRATCH) }, effect(SCRATCH, "ephemeral", "destroy", true)),
  ],
};

/** The starter runbooks by id. */
export const STARTERS: readonly Runbook[] = [RESTORE_DRILL];
