// Spec: 0002-planning-query-relations FR-005
/**
 * The Physical layer of Planning Query: the store of a repository asked in SQL (0002-planning-query-relations FR-005). The events of the store are read as commons planning reads them (a file that is not of the schema is a
 * finding and is not a row), the items are their fold, and the question is the logical one's.
 *
 * @example
 * ```ts
 * import { queryStore } from "./mod.ts";
 * // const answer = await queryStore(store, "select title from issues", { clock, wallMs });
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import type { Value, Table } from "@intellectual-frontiers/lang-sql/aide/relational";
import type { Clock } from "@intellectual-frontiers/planning/logical";
import { loadStore, type PlanningStoreBackend } from "@intellectual-frontiers/planning/physical";
import { type Budget, openPlanningQuery, type QueryProblem } from "@intellectual-frontiers/planning-query/logical";

/** One statement over the items of a store of events: its answer, or why there is none. */
export async function queryStore(
  store: PlanningStoreBackend,
  sql: string,
  options: { readonly clock: Clock; readonly wallMs: number; readonly params?: readonly Value[]; readonly includeProposed?: boolean } & Budget,
): Promise<Result<Table, QueryProblem>> {
  const loaded = await loadStore(store, { clock: options.clock, wallMs: options.wallMs });
  if (loaded.kind === "err") return err({ kind: "failed", message: loaded.error.message });
  return openPlanningQuery({ items: loaded.value.items, traces: loaded.value.traces }, { ...(options.includeProposed === undefined ? {} : { includeProposed: options.includeProposed }), ...(options.maxRows === undefined ? {} : { maxRows: options.maxRows }), ...(options.maxNodes === undefined ? {} : { maxNodes: options.maxNodes }) }).query(sql, options.params);
}
