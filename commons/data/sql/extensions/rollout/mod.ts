// Spec: 0020-sql-parallel-versions FR-001
/**
 * Parallel versions (commons data 0020-sql-parallel-versions): two versions of an application meeting one database. `expandSchema` is what the tables hold during the overlap; `versionViews` is
 * a schema of views for each live version; `retireStatements` ends a version. The expand and the contract are the ordinary plans to the expanded schema and to the latest.
 *
 * @example
 * ```ts
 * const during = expandSchema(v3, [v2]);
 * plan(from, during, { dialect, sources: [versionViews([{ label: "v2", schema: v2 }, { label: "v3", schema: v3 }])] });
 * ```
 *
 * @module
 */
export { expandSchema, matchColumn, matchTable } from "./expand.ts";
export { type LiveVersion, type Rollout, type RolloutSettings, retireStatements, schemaOf, settingsOf, versionViews } from "./views.ts";
