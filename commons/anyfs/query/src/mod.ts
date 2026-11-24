// Spec: 0001-query-layers FR-001
/**
 * The query language of AnyFS: read-only SQL over the files, places, revisions and content of any store, planned so that a query lists only what its filter can match and reads only what its metadata leaves,
 * within budgets it reports and the consent it was given. This module re-exports the two layers.
 *
 * @example
 * ```ts
 * import { mountTable, query } from "@intellectual-frontiers/anyfs-query";
 * const ctx = { ...mountTable({ fleet: { store, consent: "content" } }), clock: { now: () => Date.now() } };
 * const r = await query(ctx, "SELECT path, size FROM files('fleet:/machines') WHERE ext = 'json' AND size > 1 KB ORDER BY size DESC LIMIT 5");
 * ```
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
