// Spec: 0006-archon-on-workload FR-003, FR-004, FR-005
/**
 * The states and the plan of an order, made on workload's reconcile form: a state is the named values workload diffs (a requirement id and the canonical JSON text of the state of its resource), the changes
 * are workload's `diffStates`, and the hash of a plan is workload's (the SHA-256 of `planText` of the changes). Archon adds to each change what only it knows: the kind of the resource, its change class and its tier.
 * Pure: values in, values out.
 *
 * @example
 * ```ts
 * import { planOf } from "./state.ts";
 * // planOf(order, new Map()) gives an entry `create` for each requirement that must be present
 * ```
 *
 * @module
 */
import { sha256, type Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { canonicalJson, type ChangeClass, type JsonValue, type RequirementId, type ResourceKindId } from "@intellectual-frontiers/archon/governance";
import { diffStates, planText, type Change, type State } from "@intellectual-frontiers/workload/forms/reconcile";
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

/** A plan: one entry for each requirement in the order of the sequence, and the changes of workload that its hash is the hash of. */
export type Plan = {
  readonly subject: Subject;
  readonly entries: readonly PlanEntry[];
  readonly changes: readonly Change[];
};

/** The state the order wants: a key for each requirement that must be present, its value the canonical text of what it must be. */
export function desiredStateOf(order: Order): State {
  const out: Record<string, string> = {};
  for (const r of order.requirements) if (r.ensure !== "absent") out[r.id] = canonicalJson(r.desired);
  return out;
}

/** The state that is observed: a key for each requirement of the order whose resource is there, its value the canonical text of its state. */
export function observedStateOf(order: Order, observed: Observed): State {
  const out: Record<string, string> = {};
  for (const r of order.requirements) {
    const v = observed.get(r.id);
    if (v !== undefined) out[r.id] = canonicalJson(v);
  }
  return out;
}

function observation(value: JsonValue | undefined): Observation {
  return value === undefined ? { state: "absent" } : { state: "present", value };
}

/** The plan that brings what is observed to the order: the changes are workload's diff, the entries say them for each requirement in the order of the sequence. */
export function planOf(order: Order, observed: Observed): Plan {
  const changes = diffStates(observedStateOf(order, observed), desiredStateOf(order));
  const actions = new Map<string, PlanAction>(changes.map((c) => [c.key, c.action === "delete" ? "remove" : c.action]));
  const entries = order.requirements.map((r): PlanEntry => {
    const must: Observation = r.ensure === "absent" ? { state: "absent" } : { state: "present", value: r.desired };
    return { id: r.id, kind: r.kind, action: actions.get(r.id) ?? "none", change: r.change, tier: r.tier, observed: observation(observed.get(r.id)), desired: must };
  });
  return { subject: order.subject, entries, changes };
}

/** The entries of a plan that change something. */
export function changesOf(plan: Plan): readonly PlanEntry[] {
  return plan.entries.filter((e) => e.action !== "none");
}

/** The changes of a plan in the order of the sequence of the order, which is the order they must be carried out in (workload's own are in the order of the names). */
export function changesInOrder(order: Order, plan: Plan): readonly Change[] {
  const at = new Map(order.requirements.map((r, i) => [String(r.id), i]));
  return [...plan.changes].sort((a, b) => (at.get(a.key) ?? 0) - (at.get(b.key) ?? 0));
}

/** The hash of a plan: workload's, the SHA-256 of the canonical text of its changes. */
export function planHashOf(plan: Plan): Promise<Sha256> {
  return sha256(planText(plan.changes));
}
