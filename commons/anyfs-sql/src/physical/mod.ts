// Spec: 0001-sql-layers FR-001
/**
 * Layer 3 of the SQL stores of AnyFS: the statements, the migrations of the layout and the store of a table. The drivers' adapters are the entries `./sqlite`, `./libsql`, `./pg`, `./pglite` and `./duckdb`.
 *
 * @module
 */
export { migrate, hasSearch, layoutVersion, type MigrateOptions, type Migrated } from "./schema.ts";
export { openSqlStore, SQL_CAPABILITIES, type SearchableSqlStore, type SqlFacts, type SqlOptions, type SqlSibling, type SqlStore, type SqlStoreOf } from "./store.ts";
export { type Compacted, type CompactInput, type EpochProposal, type Retired, type AdoptedFromMedium, adoptEpoch, adoptPublished, compactDatabase, decodeEpoch, encodeEpoch, epochId, epochPath, epochsOf, publishEpoch, retireReplica, retiredOf } from "./compact.ts";
export { type Ctx, type EpochRow, type Judged, type Taken, deltaOfDatabase, judgeDelta, stateOf, takeDelta, vectorOfDatabase, verifyDatabase } from "./merge.ts";
export { type Dump, type DumpedVersion, type Imported, dumpArgv, dumpTables, dumpText, importDumps, parseDump, redump, redumpText } from "./dump.ts";
export { type Layout, layoutOf } from "./layout.ts";
export { sqlFor, type Query, type Sql, type Statement } from "./sql.ts";
