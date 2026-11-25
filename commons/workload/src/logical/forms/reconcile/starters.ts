// Spec: 0009-form-reconcile FR-014
/**
 * The starter reconcile of the library, as typed data a program loads by import. `converge-settings` is a loop toward a desired state of the settings of a system of record: it reads the settings now and the settings that
 * are wanted, diffs them, plans the changes, has a person approve the plan by its hash, applies it once by that hash and verifies that the state converged. It uses only registered verbs, cites the controls of a catalog by
 * its own ids, and every name in it is synthetic. It is the shape a converge of a fleet takes; nothing in it names a real system.
 *
 * @example
 * ```ts
 * import { CONVERGE_SETTINGS } from "./starters.ts";
 * CONVERGE_SETTINGS.id; // "converge-settings"
 * ```
 *
 * @module
 */
import type { ControlRef } from "@intellectual-frontiers/grc/governance";
import { authored, type Effect, type InputValue, type NodeHead as Common, nodeId, parseCite, type SpecCite, storeRef, verbId, workloadId } from "@intellectual-frontiers/workload/governance";
import type { Reconcile, ReconcileNode } from "./node.ts";

const nid = (t: string) => authored(nodeId(t));
const cite = (t: string): SpecCite => authored(parseCite(t));
const store = (t: string): InputValue => ({ kind: "store", store: authored(storeRef(t)) });
const control = (framework: string, version: string, id: string): ControlRef => ({ framework, version, control: id });

const BASELINE = control("nist-800-53", "5.2.0", "CM-2");
const CHANGE = control("nist-800-53", "5.2.0", "CM-3");

const LIVE = "synthetic-live-01";
const DESIRED = "synthetic-desired-01";

const head = (id: string, title: string, spec: string, controls: readonly ControlRef[] = []): Common => ({ id: nid(id), title, spec: [cite(spec)], ...(controls.length === 0 ? {} : { controls }) });
const out = (step: string, name: string): InputValue => ({ kind: "output", step: nid(step), name });

/** A loop toward the desired settings of a system of record. */
export const CONVERGE_SETTINGS: Reconcile = {
  id: authored(workloadId("converge-settings")),
  form: "reconcile",
  title: "Converge settings",
  version: "0.1.0",
  summary: "Bring the settings of a system of record to the settings that are wanted: observe both, diff them, plan the changes, have a person approve the plan by its hash, apply it once and verify.",
  given: [],
  needs: [],
  trigger: { kind: "schedule", cadence: "daily" },
  inputs: [],
  stores: [
    { ref: authored(storeRef(LIVE)), class: "external", needs: ["read"] },
    { ref: authored(storeRef(DESIRED)), class: "git", needs: ["read"] },
  ],
  nodes: [
    { ...head("observe-actual", "Read the settings as they are", "0009-form-reconcile FR-001", [BASELINE]), kind: "observe", of: "actual", using: authored(verbId("state.observe")), inputs: { store: store(LIVE) }, evidence: "digest" },
    { ...head("observe-desired", "Read the settings as they are wanted", "0009-form-reconcile FR-001", [BASELINE]), kind: "observe", of: "desired", using: authored(verbId("state.observe")), inputs: { store: store(DESIRED) }, evidence: "digest" },
    { ...head("diff-settings", "Compare the settings with the wanted ones", "0009-form-reconcile FR-006"), kind: "diff", actual: nid("observe-actual"), desired: nid("observe-desired") },
    { ...head("plan-changes", "Plan the changes and hash the plan", "0009-form-reconcile FR-006", [CHANGE]), kind: "plan", from: nid("diff-settings") },
    { ...head("approve-plan", "A person approves the plan by its hash", "0009-form-reconcile FR-008", [CHANGE]), kind: "approve", plan: nid("plan-changes"), approver: "synthetic-approver-01", demands: "agent-proposes", guards: [nid("apply-changes")] },
    {
      ...head("apply-changes", "Apply the approved plan once", "0009-form-reconcile FR-009", [CHANGE]),
      kind: "apply",
      plan: nid("plan-changes"),
      verb: authored(verbId("state.apply")),
      inputs: { store: store(LIVE), key: out("plan-changes", "hash"), changes: out("plan-changes", "changes") },
      effect: { store: authored(storeRef(LIVE)), class: "external", mode: "destroy", reversible: false, idempotencyKey: "key" } satisfies Effect,
    },
    { ...head("verify-converged", "The settings are the wanted ones", "0009-form-reconcile FR-007", [BASELINE]), kind: "verify", asserts: "the settings of the system are the settings that are wanted", using: authored(verbId("state.verify")), inputs: { store: store(LIVE), desired: store(DESIRED) }, evidence: "digest" },
  ] satisfies readonly ReconcileNode[],
};

/** The starter reconciles by id. */
export const STARTERS: readonly Reconcile[] = [CONVERGE_SETTINGS];
