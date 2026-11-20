// Spec: 0059-sql-federate FR-001, FR-005, FR-008
/**
 * Running one query on many targets and merging the answers (commons data 0059-sql-federate): `fanOut` asks every target (a database, a machine asked through osquery) at once with a timeout, a concurrency limit and a limit
 * on rows, and gives every target's answer as a value, partial by default; `mergeInto` loads the rows, tagged with their target, into an engine (DuckDB, meant for it) where the merge is SQL, with `countBy` and
 * `differences` given; and an audit of the run is optional, kept where the caller says.
 *
 * @example
 * ```ts
 * const result = await fanOut({ sql: "SELECT name, version FROM programs", targets, timeoutMs: 10_000, concurrency: 8 });
 * const merged = await mergeInto(result, { driver: duckdbDriver(conn), dialect: duckdb });
 * await countBy(merged, "version");      // how many rows and hosts have each version
 * await differences(merged, "majority"); // the hosts that differ from what most have
 * ```
 *
 * @module
 */
export { auditOf, auditTable, type AuditRecord, type AuditSink, type AuditTarget } from "./audit.ts";
export { failures, fanOut, type FanOut, type FanOutError, type Outcome, type Plan, type Row, type Target, type Value } from "./fanout.ts";
export { columnsOf, type ColumnType, countBy, type Difference, differences, type Merged, type MergedColumn, mergeInto, tablesOf, type TargetRow } from "./merge.ts";
