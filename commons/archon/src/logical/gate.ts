// Spec: 0003-archon-logical FR-006, FR-007; 0006-archon-on-workload FR-007
/**
 * What of the approval of a plan is Archon's and not workload's. Workload approves a plan by its hash, by a person; it has one approver and no typed confirmation. Archon keeps the two controls that say
 * more: a confirmation typed by a person for each destructive entry (the text is the requirement id) and a second approver where the profile asks for one for a destructive entry or a tier above `operator`.
 *
 * @example
 * ```ts
 * import { archonGate } from "./gate.ts";
 * // archonGate(plan, assurance, { confirmations: [], secondApprover: false }) is open, or blocked with what is missing
 * ```
 *
 * @module
 */
import type { Assurance, RequirementId } from "@intellectual-frontiers/archon/governance";
import { changesOf, type PlanEntry, type Plan } from "./state.ts";

/** What a plan needs of a person beyond workload's approval by its hash. */
export type GateNeeded = {
  /** The requirement ids a person must type, one for each destructive entry that changes something. */
  readonly typedConfirmations: readonly RequirementId[];
  readonly secondApprover: boolean;
};

/** The tiers that need no second approver. */
const ORDINARY_TIERS: readonly string[] = ["public", "operator"];

function isDestructive(e: PlanEntry): boolean {
  return e.change === "destructive" || e.action === "remove";
}

/** What a plan needs before it may be carried out, by the assurance of the fleet. */
export function gateNeeded(plan: Plan, assurance: Assurance): GateNeeded {
  const changes = changesOf(plan);
  const typedConfirmations = changes.filter(isDestructive).map((e) => e.id);
  const asksSecond = assurance.controls.secondApprover === "tier-and-destructive";
  return { typedConfirmations, secondApprover: asksSecond && changes.some((e) => isDestructive(e) || !ORDINARY_TIERS.includes(e.tier)) };
}

/** What a person has given. */
export type Given = {
  /** The texts a person typed to confirm. */
  readonly confirmations: readonly string[];
  readonly secondApprover: boolean;
};

/** Something a plan still needs. */
export type Missing = { readonly kind: "confirmation"; readonly id: RequirementId } | { readonly kind: "second-approver" };

/** The gate: open, or what is missing. */
export type Gate = { readonly kind: "open" } | { readonly kind: "blocked"; readonly missing: readonly Missing[] };

/** Whether a plan may be carried out: each destructive entry is confirmed by its exact id and a second approver is present where one is needed. */
export function archonGate(plan: Plan, assurance: Assurance, given: Given): Gate {
  const needed = gateNeeded(plan, assurance);
  const missing: Missing[] = [];
  for (const id of needed.typedConfirmations) if (!given.confirmations.includes(id)) missing.push({ kind: "confirmation", id });
  if (needed.secondApprover && !given.secondApprover) missing.push({ kind: "second-approver" });
  return missing.length === 0 ? { kind: "open" } : { kind: "blocked", missing };
}
