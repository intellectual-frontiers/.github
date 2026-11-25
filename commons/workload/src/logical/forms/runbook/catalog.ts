// Spec: 0008-form-runbook FR-013
/**
 * The catalog of what can go wrong with a runbook that no other form shares, `E-RB-<CONCEPT>-<KIND>`: a runbook that is not well formed, a step that cannot be taken back with no gate or undo, a transactional store changed
 * with no checkpoint, a store attached and never detached, a workshop disposed of while a store that is not ephemeral is attached. What every form shares (a verb that is not registered, an effect above its verb's, a judge
 * with an effect) is in the catalog of the core, `E-WL-...`.
 *
 * @example
 * ```ts
 * import { RUNBOOK_CATALOG, runbookFinding } from "./catalog.ts";
 * runbookFinding("E-RB-STORE-NO-CHECKPOINT", "restore", "no checkpoint", { store: "synthetic-db-01" }).fixer; // "agent"
 * ```
 *
 * @module
 */
import { type Catalog, type CatalogEntry, entry, type Finding, makeFinding } from "@intellectual-frontiers/workload/governance";

/** The concepts of a problem of a runbook. */
export const RUNBOOK_CONCEPTS = ["runbook", "step", "store", "workshop"] as const;

/** The codes of the catalog of the runbook form. */
export type RunbookCode = "E-RB-RUNBOOK-MALFORMED" | "E-RB-STEP-IRREVERSIBLE-UNGUARDED" | "E-RB-STORE-NO-CHECKPOINT" | "E-RB-STORE-NOT-DETACHED" | "E-RB-WORKSHOP-NOT-DISPOSABLE";

/** The entries: one for each code, held by the compiler. */
export const RUNBOOK_ENTRIES: Readonly<Record<RunbookCode, CatalogEntry<RunbookCode>>> = {
  "E-RB-RUNBOOK-MALFORMED": entry("E-RB-RUNBOOK-MALFORMED", "runbook", "malformed", "The runbook is not well formed", "A value is not of the type the runbook declares, an id is used twice, or a step names a step that is not where it must be.", "agent", "correct the runbook where the message says: {node}"),
  "E-RB-STEP-IRREVERSIBLE-UNGUARDED": entry("E-RB-STEP-IRREVERSIBLE-UNGUARDED", "step", "irreversible-unguarded", "A step that cannot be taken back has no gate and no undo", "The effect of the step is not reversible and no gate guards it and no undo compensates it.", "person", "decide who may do {node}: add a gate that guards it, or an undo that compensates it", true),
  "E-RB-STORE-NO-CHECKPOINT": entry("E-RB-STORE-NO-CHECKPOINT", "store", "no-checkpoint", "A transactional store is changed with no checkpoint before", "A step mutates a transactional store and no checkpoint step of that store comes before it.", "agent", "add a store.checkpoint step of {store} before {node}", true),
  "E-RB-STORE-NOT-DETACHED": entry("E-RB-STORE-NOT-DETACHED", "store", "not-detached", "A store is attached and never detached", "A store is attached to the workshop and no later step detaches it or disposes of the workshop.", "agent", "add a workshop.detach step of {store} after {node}"),
  "E-RB-WORKSHOP-NOT-DISPOSABLE": entry("E-RB-WORKSHOP-NOT-DISPOSABLE", "workshop", "not-disposable", "The workshop is disposed of while a store that is not ephemeral is attached", "Whether a workshop is disposable is computed from what is attached; a store that is not ephemeral is still attached at the disposal.", "agent", "detach {store} before {node}"),
};

/** The catalog of the runbook form. */
export const RUNBOOK_CATALOG: Catalog<RunbookCode> = { owner: "the runbook form", prefix: "E-RB-", concepts: RUNBOOK_CONCEPTS, entries: RUNBOOK_ENTRIES };

/** A finding of the catalog of the runbook form. */
export const runbookFinding = (code: RunbookCode, node: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding => makeFinding(RUNBOOK_ENTRIES[code], node, message, vars);
