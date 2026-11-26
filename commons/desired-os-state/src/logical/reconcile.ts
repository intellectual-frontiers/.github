// Spec: 0006-desired-os-state-on-workload FR-002, FR-006
/**
 * `reconcileOf`: an order becomes a workload of the form reconcile, which workload runs: observe the actual state, observe the desired state, diff, plan, approve by the hash of the plan, apply once, verify. The
 * loop names no tool. Desired OS State supplies the states (`state.ts`) and the hosts bind the three verbs of workload (`state.observe`, `state.apply`, `state.verify`) with what they know of their machines. The mode
 * of the effect of the apply is the greatest change the requirements of the order can make, so that workload derives the autonomy and refuses a plan that would exceed it.
 *
 * @example
 * ```ts
 * import { reconcileOf } from "./reconcile.ts";
 * // reconcileOf(order).form === "reconcile"; reconcileOf(order).nodes.map((n) => n.kind) lists the six kinds
 * ```
 *
 * @module
 */
import { authored, type Effect, type InputValue, type NodeHead, nodeId, parseCite, storeRef, verbId, workloadId, type Mode } from "@intellectual-frontiers/workload/governance";
import type { Reconcile, ReconcileNode } from "@intellectual-frontiers/workload/forms/reconcile";
import type { Order } from "./order.ts";

/** What `reconcileOf` may be told. */
export type ReconcileOptions = {
  /** The name of the approver the plan is parked for; the default is `desired-os-state-approver`. */
  readonly approver?: string;
  /** The version of the workload; the default is `0.1.0`. */
  readonly version?: string;
};

/** The words of a subject name as a workload name: lower case letters and digits joined by hyphens. */
export function slugOf(text: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return /^[a-z]/u.test(s) ? s.slice(0, 60) : `s-${s}`.slice(0, 60);
}

/** The greatest mode of effect the requirements of the order can need: `destroy` for a destructive requirement or one that must be absent, `mutate` for a mutating one, `append` otherwise. */
export function modeOfOrder(order: Order): Mode {
  if (order.requirements.some((r) => r.change === "destructive" || r.ensure === "absent")) return "destroy";
  if (order.requirements.some((r) => r.change === "mutating")) return "mutate";
  return "append";
}

const cite = (text: string) => authored(parseCite(text));
const nid = (t: string) => authored(nodeId(t));
const store = (t: string): InputValue => ({ kind: "store", store: authored(storeRef(t)) });
const out = (step: string, name: string): InputValue => ({ kind: "output", step: nid(step), name });
const head = (id: string, title: string, spec: string): NodeHead => ({ id: nid(id), title, spec: [cite(spec)] });

/** The reconcile workload of an order. */
export function reconcileOf(order: Order, options: ReconcileOptions = {}): Reconcile {
  const slug = slugOf(order.subject.name);
  const live = `host-${slug}`;
  const wanted = `order-${slug}`;
  const mode = modeOfOrder(order);
  const reversible = order.requirements.every((r) => r.rollback === "reversible");
  const effect: Effect = { store: authored(storeRef(live)), class: "external", mode, reversible, idempotencyKey: "key" };
  const nodes: readonly ReconcileNode[] = [
    { ...head("observe-actual", "Read what the subject is", "0007-desired-os-state-observe-osquery FR-005"), kind: "observe", of: "actual", using: authored(verbId("state.observe")), inputs: { store: store(live) }, evidence: "digest" },
    { ...head("observe-desired", "Read what the order wants", "0006-desired-os-state-on-workload FR-003"), kind: "observe", of: "desired", using: authored(verbId("state.observe")), inputs: { store: store(wanted) }, evidence: "digest" },
    { ...head("diff-order", "Compare the subject with the order", "0006-desired-os-state-on-workload FR-004"), kind: "diff", actual: nid("observe-actual"), desired: nid("observe-desired") },
    { ...head("plan-changes", "Plan the changes and hash the plan", "0006-desired-os-state-on-workload FR-004"), kind: "plan", from: nid("diff-order") },
    {
      ...head("approve-plan", "A person approves the plan by its hash", "0006-desired-os-state-on-workload FR-007"),
      kind: "approve",
      plan: nid("plan-changes"),
      approver: options.approver ?? "desired-os-state-approver",
      demands: mode === "destroy" ? "human-only" : "agent-proposes",
      guards: [nid("apply-changes")],
    },
    { ...head("apply-changes", "Apply the approved plan once", "0006-desired-os-state-on-workload FR-006"), kind: "apply", plan: nid("plan-changes"), verb: authored(verbId("state.apply")), inputs: { store: store(live), key: out("plan-changes", "hash"), changes: out("plan-changes", "changes") }, effect },
    { ...head("verify-converged", "The subject is what the order wants", "0006-desired-os-state-on-workload FR-008"), kind: "verify", asserts: `${order.subject.name} is what its order wants`, using: authored(verbId("state.verify")), inputs: { store: store(live), desired: store(wanted) }, evidence: "digest" },
  ];
  return {
    id: authored(workloadId(`desired-os-state-${slug}`.slice(0, 90))),
    form: "reconcile",
    title: `Converge ${order.subject.name}`,
    version: options.version ?? "0.1.0",
    summary: `Bring ${order.subject.name} to its order of ${order.requirements.length} requirement${order.requirements.length === 1 ? "" : "s"}: observe both, diff, plan, have a person approve the plan by its hash, apply once and verify.`,
    given: [],
    needs: [],
    trigger: { kind: "manual" },
    inputs: [],
    stores: [
      { ref: authored(storeRef(live)), class: "external", needs: ["read"] },
      { ref: authored(storeRef(wanted)), class: "git", needs: ["read"] },
    ],
    nodes,
  };
}
