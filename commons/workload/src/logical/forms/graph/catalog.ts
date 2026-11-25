// Spec: 0013-form-graph FR-009
/**
 * The catalog of what can go wrong with a graph that no other form shares, `E-GR-<CONCEPT>-<KIND>`: a graph that is not well formed, a node that comes after a node that is not there, a cycle, a node that no result depends on, an
 * effect above the limit of the graph and permissions above what the effects of the node need. What every form shares (a verb that is not registered, an effect above its verb's, a gate that guards nothing) is in the catalog of the core, `E-WL-...`.
 *
 * @example
 * ```ts
 * import { graphFinding } from "./catalog.ts";
 * graphFinding("E-GR-EDGE-CYCLE", "build", "build -> test -> build").fixer; // "agent"
 * ```
 *
 * @module
 */
import { type Catalog, type CatalogEntry, entry, type Finding, makeFinding } from "@intellectual-frontiers/workload/governance";

/** The concepts of a problem of a graph. */
export const GRAPH_CONCEPTS = ["graph", "needs", "edge", "node", "permission"] as const;

/** The codes of the catalog of the graph form. */
export type GraphCode = "E-GR-GRAPH-MALFORMED" | "E-GR-NEEDS-UNKNOWN" | "E-GR-EDGE-CYCLE" | "E-GR-NODE-UNREACHABLE" | "E-GR-NODE-EFFECT-OVER-LIMIT" | "E-GR-PERMISSION-EXCESS";

/** The entries: one for each code, held by the compiler. */
export const GRAPH_ENTRIES: Readonly<Record<GraphCode, CatalogEntry<GraphCode>>> = {
  "E-GR-GRAPH-MALFORMED": entry("E-GR-GRAPH-MALFORMED", "graph", "malformed", "The graph is not well formed", "A value is not of the type the graph declares, an id is used twice, a gate guards a node that is no job, or a result names no job.", "agent", "correct the graph where the message says: {node}"),
  "E-GR-NEEDS-UNKNOWN": entry("E-GR-NEEDS-UNKNOWN", "needs", "unknown", "A node comes after a node that is not there", "The `after` of a node names an id that is no job of the graph (a gate is not one), or the node itself.", "agent", "name a job of the graph in the `after` of {node}"),
  "E-GR-EDGE-CYCLE": entry("E-GR-EDGE-CYCLE", "edge", "cycle", "The edges make a cycle", "The nodes come after each other in a circle, so none of them can be first and the graph is no directed acyclic graph.", "agent", "break the cycle {node} by removing one of its edges"),
  "E-GR-NODE-UNREACHABLE": entry("E-GR-NODE-UNREACHABLE", "node", "unreachable", "No result depends on the node", "The node is none of the results of the graph and no result comes after it, so its work is done and nothing is decided by it.", "agent", "make {node} an ancestor of a result, or a result, or remove it"),
  "E-GR-NODE-EFFECT-OVER-LIMIT": entry("E-GR-NODE-EFFECT-OVER-LIMIT", "node", "effect-over-limit", "An effect is above the limit of the graph", "The node declares a mode of effect greater than the limit the graph gives itself.", "person", "lower the effect of {node} to the limit, or have a person raise the limit of the graph", true),
  "E-GR-PERMISSION-EXCESS": entry("E-GR-PERMISSION-EXCESS", "permission", "excess", "A node asks for write access its effects do not need", "The node asks for a scope with `write` and every effect it declares only reads (a check has none), so the token it is given has more than the work needs.", "agent", "ask for `read` in the permissions of {node}", true),
};

/** The catalog of the graph form. */
export const GRAPH_CATALOG: Catalog<GraphCode> = { owner: "the graph form", prefix: "E-GR-", concepts: GRAPH_CONCEPTS, entries: GRAPH_ENTRIES };

/** A finding of the catalog of the graph form. */
export const graphFinding = (code: GraphCode, node: string, message: string, vars: Readonly<Record<string, string>> = {}): Finding => makeFinding(GRAPH_ENTRIES[code], node, message, vars);
