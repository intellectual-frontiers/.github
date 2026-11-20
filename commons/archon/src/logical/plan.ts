// Spec: 0003-archon-logical FR-004, FR-005
/**
 * The plan: what differs between what is observed of a subject and its order. One entry for each requirement of the order says whether its resource is already as it must be, must be made,
 * must be changed or must be removed. A plan has a canonical text and a digest (the SHA-256 of it), so that a person can approve exactly one plan and any change of any entry changes the digest.
 *
 * @example
 * ```ts
 * import { planOrder } from "./plan.ts";
 * // planOrder(order, new Map()) gives an entry `create` for each requirement that must be present
 * ```
 *
 * @module
 */
import { sha256, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { canonicalJson, sameJson, type ChangeClass, type JsonValue, type RequirementId, type ResourceKindId } from "@intellectual-frontiers/archon/governance";
import type { Order, Subject } from "./order.ts";

/** What is observed of one resource: not there, or there with this state. */
export type Observation = { readonly state: "absent" } | { readonly state: "present"; readonly value: JsonValue };

/** The observed state of the resources of a subject, by requirement; a requirement with no entry is observed absent. */
export type Observed = ReadonlyMap<RequirementId, JsonValue>;

/** What a plan does to a resource. */
export type PlanAction = "none" | "create" | "update" | "remove";

/** One entry of a plan. */
export type PlanEntry = {
  readonly id: RequirementId;
  readonly kind: ResourceKindId;
  readonly action: PlanAction;
  readonly change: ChangeClass;
  readonly tier: string;
  readonly observed: Observation;
  readonly desired: Observation;
};

/** A plan. */
export type Plan = {
  readonly format: "archon-plan/1";
  readonly subject: Subject;
  readonly entries: readonly PlanEntry[];
};

function observation(value: JsonValue | undefined): Observation {
  return value === undefined ? { state: "absent" } : { state: "present", value };
}

function actionOf(observed: Observation, desired: Observation): PlanAction {
  if (desired.state === "absent") return observed.state === "absent" ? "none" : "remove";
  if (observed.state === "absent") return "create";
  return sameJson(observed.value, desired.value) ? "none" : "update";
}

/** The plan that brings what is observed to the order: one entry for each requirement, in the order of the sequence. */
export function planOrder(order: Order, observed: Observed): Plan {
  const entries = order.requirements.map((r): PlanEntry => {
    const was = observation(observed.get(r.id));
    const must: Observation = r.ensure === "absent" ? { state: "absent" } : { state: "present", value: r.desired };
    return { id: r.id, kind: r.kind, action: actionOf(was, must), change: r.change, tier: r.tier, observed: was, desired: must };
  });
  return { format: "archon-plan/1", subject: order.subject, entries };
}

/** The entries of a plan that change something. */
export function changesOf(plan: Plan): readonly PlanEntry[] {
  return plan.entries.filter((e) => e.action !== "none");
}

function plain(o: Observation): JsonValue {
  return o.state === "absent" ? { state: "absent" } : { state: "present", value: o.value };
}

/** The canonical text of a plan: the same plan is the same text on every machine whatever the order its keys were made in. */
export function canonicalPlan(plan: Plan): string {
  return canonicalJson({
    format: plan.format,
    subject: { name: plan.subject.name, class: plan.subject.class },
    entries: plan.entries.map((e) => ({ id: e.id, kind: e.kind, action: e.action, change: e.change, tier: e.tier, observed: plain(e.observed), desired: plain(e.desired) })),
  });
}

/** The digest of a plan: the SHA-256 of its canonical text. */
export function planDigest(plan: Plan): Promise<Sha256> {
  return sha256(canonicalPlan(plan));
}
