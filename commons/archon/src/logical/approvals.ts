// Spec: 0003-archon-logical FR-006, FR-007
/**
 * What a plan needs before it may be carried out, by the assurance of the fleet: a confirmation typed by a person for each destructive entry, a second approver where the control asks for one,
 * and the digest of the plan named by the approval where the control requires it. `destructiveGate` lets a plan through only when all of it is given.
 *
 * @example
 * ```ts
 * import { approvalsNeeded } from "./approvals.ts";
 * // approvalsNeeded(plan, assurance).typedConfirmations lists the requirement ids a person must type
 * ```
 *
 * @module
 */
import type { Assurance, RequirementId } from "@intellectual-frontiers/archon/governance";
import { changesOf, type Plan, type PlanEntry } from "./plan.ts";

/** What a plan needs. */
export type ApprovalsNeeded = {
  /** The requirement ids a person must type, one for each destructive entry that changes something. */
  readonly typedConfirmations: readonly RequirementId[];
  readonly secondApprover: boolean;
  readonly planDigestRequired: boolean;
};

/** The tiers that need no second approver. */
const ORDINARY_TIERS: readonly string[] = ["public", "operator"];

function isDestructive(e: PlanEntry): boolean {
  return e.change === "destructive" || e.action === "remove";
}

/** What a plan needs before it may be carried out, by the assurance of the fleet. */
export function approvalsNeeded(plan: Plan, assurance: Assurance): ApprovalsNeeded {
  const changes = changesOf(plan);
  const typedConfirmations = changes.filter(isDestructive).map((e) => e.id);
  const asksSecond = assurance.controls.secondApprover === "tier-and-destructive";
  const secondApprover = asksSecond && changes.some((e) => isDestructive(e) || !ORDINARY_TIERS.includes(e.tier));
  const planDigestRequired = assurance.controls.planHash === "required" && changes.length > 0;
  return { typedConfirmations, secondApprover, planDigestRequired };
}

/** What a person has given. */
export type Given = {
  /** The texts a person typed to confirm. */
  readonly confirmations: readonly string[];
  readonly secondApprover: boolean;
  /** The digest the approval names, if it names one. */
  readonly planDigest: string | undefined;
};

/** Something a plan still needs. */
export type Missing =
  | { readonly kind: "confirmation"; readonly id: RequirementId }
  | { readonly kind: "second-approver" }
  | { readonly kind: "plan-digest" }
  | { readonly kind: "plan-changed" };

/** The gate: open, or what is missing. */
export type Gate = { readonly kind: "open" } | { readonly kind: "blocked"; readonly missing: readonly Missing[] };

/** Whether a plan may be carried out: each destructive entry is confirmed by its exact id, a second approver is present where one is needed, and the digest the approval names is the digest of this plan where one is required. `digest` is the digest of the plan as it is now. */
export function destructiveGate(plan: Plan, assurance: Assurance, given: Given, digest: string): Gate {
  const needed = approvalsNeeded(plan, assurance);
  const missing: Missing[] = [];
  for (const id of needed.typedConfirmations) if (!given.confirmations.includes(id)) missing.push({ kind: "confirmation", id });
  if (needed.secondApprover && !given.secondApprover) missing.push({ kind: "second-approver" });
  if (needed.planDigestRequired) {
    if (given.planDigest === undefined) missing.push({ kind: "plan-digest" });
    else if (given.planDigest !== digest) missing.push({ kind: "plan-changed" });
  } else if (given.planDigest !== undefined && given.planDigest !== digest) missing.push({ kind: "plan-changed" });
  return missing.length === 0 ? { kind: "open" } : { kind: "blocked", missing };
}
