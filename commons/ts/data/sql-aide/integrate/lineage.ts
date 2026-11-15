/**
 * Lineage: where the rows of a model's relations came from, as a graph of edges that integrations, loads and transforms say of
 * themselves, and a table to keep it in beside the run ledger (commons 0009-sql-aide FR-028).
 *
 * @module
 */
import { oneOf, text } from "../algebra/column.ts";
import { table } from "../algebra/table.ts";
import { type Integration, type LineageEdge, seed } from "./integration.ts";

/** The table lineage is kept in: one row for each edge, known by what moved the rows and between which nodes. */
export const lineageTable = table(
  "ifcsql_lineage",
  {
    via: text().doc("The integration, load or transform that moved the rows"),
    kind: oneOf(["integration", "load", "transform"]).doc("What kind of thing moved them"),
    from_node: text().doc("Where the rows came from"),
    to_node: text().doc("Where the rows went"),
  },
  { primaryKey: ["via", "from_node", "to_node"], owner: "ifc-sql-aide", doc: "Where the rows of the model's relations came from" },
);

/**
 * The edges of lineage of everything given, each once, in the order first said.
 *
 * @param items - integrations, loads and transforms: anything that says its lineage
 */
export function lineageOf(items: readonly { readonly lineage: () => readonly LineageEdge[] }[]): readonly LineageEdge[] {
  const seen = new Set<string>();
  const out: LineageEdge[] = [];
  for (const item of items) {
    for (const e of item.lineage()) {
      const k = JSON.stringify([e.via, e.from, e.to]);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

/**
 * Every node whose rows reach a node, by any path of the graph, nearest first.
 *
 * @param edges - the lineage
 * @param node - a relation's qualified name (`entityKey`), as the edges name it
 */
export function upstream(edges: readonly LineageEdge[], node: string): readonly string[] {
  const out: string[] = [];
  let frontier = [node];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const n of frontier)
      for (const e of edges)
        if (e.to === n && !out.includes(e.from) && e.from !== node) {
          out.push(e.from);
          next.push(e.from);
        }
    frontier = next;
  }
  return out;
}

/**
 * The integration that keeps edges of lineage in {@link lineageTable}: run twice, the table holds each edge once.
 *
 * @param edges - the lineage to keep
 */
export function recordLineage(edges: readonly LineageEdge[]): Integration<"rows", "upsert"> {
  return seed(
    "ifcsql_lineage_record",
    lineageTable,
    edges.map((e) => ({ via: e.via, kind: e.kind, from_node: e.from, to_node: e.to })),
  );
}
