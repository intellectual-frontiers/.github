// Spec: 0013-form-graph FR-002, FR-003
/**
 * The nodes of a graph: a closed sum of four kinds and the graph they make. A `verb` is a deterministic call, a `check` asserts and yields evidence by a verb that only reads, an `each` is the calls of its body once for each member
 * of a fixed list, and a `gate` is a person's authority over the nodes it guards (on GitHub, the environment a person approves). Every node but a gate has edges (`after`), the permissions it asks for (a scope, `read` or `write`) and
 * the time it may take; it also has what every node of every form has (its id, requirements, controls and needs). The effect of a node is the declared mark of the verb it calls, as in every form, and autonomy is derived from it.
 *
 * @example
 * ```ts
 * import type { Graph } from "./node.ts";
 * const nodesOf = (g: Graph): number => g.nodes.length;
 * ```
 *
 * @module
 */
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { Effect, EvidenceKind, GateAction, Inputs, InputValue, Mode, NodeHead, NodeId, VerbId, WorkloadHead } from "@intellectual-frontiers/workload/governance";
import type { FanOut, PermissionScope } from "./terms.ts";

/** The permissions of the token of a job, by scope; a scope not named is none. */
export type GraphPermissions = Readonly<Partial<Record<PermissionScope, "read" | "write">>>;

/** What the nodes that are jobs have besides: the nodes they come after, the permissions they ask for and the minutes they may take. */
export type Edges = { readonly after: readonly NodeId[]; readonly permissions?: GraphPermissions; readonly timeoutMinutes?: number };

/** A deterministic call of a registered verb. */
export type VerbNode = NodeHead & Edges & { readonly kind: "verb"; readonly verb: VerbId; readonly inputs: Inputs; readonly effect: Effect };
/** An assertion that yields evidence, by a verb that only reads. */
export type CheckNode = NodeHead & Edges & { readonly kind: "check"; readonly asserts: string; readonly using: VerbId; readonly inputs: Inputs; readonly evidence: EvidenceKind };

/** A call in the body of an each: a verb or a check with no edges of its own. */
export type BodyNode =
  | (NodeHead & { readonly kind: "verb"; readonly verb: VerbId; readonly inputs: Inputs; readonly effect: Effect })
  | (NodeHead & { readonly kind: "check"; readonly asserts: string; readonly using: VerbId; readonly inputs: Inputs; readonly evidence: EvidenceKind });

/** A fan out of the calls of its body over the tenants, hosts or fleets a literal names. */
export type EachNode = NodeHead & Edges & { readonly kind: "each"; readonly over: FanOut; readonly source: InputValue; readonly body: readonly BodyNode[] };
/** A person's authority over the nodes it guards; it can only raise the control over them. */
export type GateNode = NodeHead & { readonly kind: "gate"; readonly action: GateAction; readonly approver: string; readonly demands: Autonomy; readonly guards: readonly NodeId[] };

/** One node: a closed sum. */
export type GraphNode = VerbNode | CheckNode | EachNode | GateNode;

/** A node that is a job: any node but a gate. */
export type JobNode = Exclude<GraphNode, GateNode>;

/** A graph: a workload of the form `graph`, typed data that a program loads by import. `limit` is the greatest mode any effect may have, and `results` are the nodes whose outcome decides the run. */
export type Graph = WorkloadHead & { readonly form: "graph"; readonly limit: Mode; readonly results: readonly NodeId[]; readonly nodes: readonly GraphNode[] };

/** Whether a node is a job (it has edges and becomes a job of the platform): every node but a gate. */
export const isJob = (n: GraphNode): n is JobNode => n.kind !== "gate";

/** The effects of a job node: its own, or those of the calls of its body; a check has none. */
export function effectsOf(n: JobNode): readonly Effect[] {
  switch (n.kind) {
    case "verb":
      return [n.effect];
    case "check":
      return [];
    case "each":
      return n.body.flatMap((b) => (b.kind === "verb" ? [b.effect] : []));
    default:
      return n satisfies never;
  }
}
