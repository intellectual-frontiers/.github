// Spec: 0013-form-graph FR-001, FR-002
/**
 * The terms of the graph form and its closed lists. A **graph** is a workload that is a directed acyclic graph: its nodes, which this form calls nodes, have an edge to each node they come after (`after`, the `needs` of the jobs
 * of GitHub Actions) and an integration runner carries it. A **result** is a node whose outcome decides the run; a node no result depends on is dead. A **limit** is the greatest mode of effect any node of the graph may declare.
 *
 * @example
 * ```ts
 * import { GRAPH_KINDS } from "./terms.ts";
 * GRAPH_KINDS.length; // 4
 * ```
 *
 * @module
 */

/** The four kinds of node: a closed list. A verb and a check are a call, an each is a call for each member of a fixed list, a gate is a person's authority over the nodes it guards. */
export const GRAPH_KINDS = ["verb", "check", "each", "gate"] as const;
/** One kind of node. */
export type GraphKind = (typeof GRAPH_KINDS)[number];

/** What an `each` fans out over. */
export const FAN_OUTS = ["tenants", "hosts", "fleets"] as const;
/** One thing to fan out over. */
export type FanOut = (typeof FAN_OUTS)[number];

/** The scopes of the token of a job that a node may ask for, each `read` or `write`: the ones the typed model of workflows has. */
export const PERMISSION_SCOPES = ["contents", "pages", "id-token", "actions", "packages", "pull-requests", "issues", "checks", "statuses"] as const;
/** One scope of permissions. */
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

/** The terms of the graph form. */
export const GRAPH_TERMS = ["edge", "result", "limit"] as const;
/** One term. */
export type GraphTerm = (typeof GRAPH_TERMS)[number];

/** What each term is. */
export const GRAPH_DEFINITIONS: Readonly<Record<GraphTerm, string>> = {
  edge: "The word `after` of a node: the nodes it comes after, which the runner that has jobs writes as `needs`. The edges make a directed acyclic graph.",
  result: "A node whose outcome decides the run. A node that no result comes after is unreachable: dead work.",
  limit: "The greatest mode (read, append, mutate, destroy) that any node of the graph may declare in its effect.",
};
