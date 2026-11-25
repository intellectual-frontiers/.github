// Spec: 0009-form-reconcile FR-001, FR-002
/**
 * The nodes of the reconcile form, a closed sum of six kinds. An `observe` reads a state with a verb that only reads (the actual state or the desired state); a `diff` compares them with no effect; a `plan` makes the changes
 * of the diff into an ordered plan with its hash; an `approve` is a person's authority over the nodes it guards and is given by the hash of the plan; an `apply` is a verb with an effect that applies the plan; a `verify` reads
 * again and asserts that the state converged. A reconcile is a workload of the form `reconcile` with these nodes in order.
 *
 * @example
 * ```ts
 * import type { ReconcileNode } from "./node.ts";
 * const kind = (n: ReconcileNode): string => n.kind;
 * ```
 *
 * @module
 */
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { Effect, EvidenceKind, Inputs, NodeHead, NodeId, VerbId, WorkloadHead } from "@intellectual-frontiers/workload/governance";
import type { Observation } from "./terms.ts";

/** A read of a state by a verb that only reads: the actual state or the desired state. */
export type ObserveNode = NodeHead & { readonly kind: "observe"; readonly of: Observation; readonly using: VerbId; readonly inputs: Inputs; readonly evidence: EvidenceKind };
/** The comparison of the actual observation with the desired one: deterministic, no effect. */
export type DiffNode = NodeHead & { readonly kind: "diff"; readonly actual: NodeId; readonly desired: NodeId };
/** The changes of a diff as an ordered plan with its hash: deterministic, no effect. */
export type PlanNode = NodeHead & { readonly kind: "plan"; readonly from: NodeId };
/** A person's authority over the nodes it guards, given by the hash of the plan it approves. */
export type ApproveNode = NodeHead & { readonly kind: "approve"; readonly plan: NodeId; readonly approver: string; readonly demands: Autonomy; readonly guards: readonly NodeId[] };
/** The application of a plan by a verb, with its effect. */
export type ApplyNode = NodeHead & { readonly kind: "apply"; readonly plan: NodeId; readonly verb: VerbId; readonly inputs: Inputs; readonly effect: Effect };
/** A read that asserts the state converged. */
export type VerifyNode = NodeHead & { readonly kind: "verify"; readonly asserts: string; readonly using: VerbId; readonly inputs: Inputs; readonly evidence: EvidenceKind };

/** One node: a closed sum. */
export type ReconcileNode = ObserveNode | DiffNode | PlanNode | ApproveNode | ApplyNode | VerifyNode;

/** A reconcile: a workload of the form `reconcile`, typed data that a program loads by import. */
export type Reconcile = WorkloadHead & { readonly form: "reconcile"; readonly nodes: readonly ReconcileNode[] };
