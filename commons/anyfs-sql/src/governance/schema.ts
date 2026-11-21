// Spec: 0002-sql-governance FR-003
/**
 * The layout of the tables, as data a reader of the database can use without the library: what each table holds and what each column means, and the versions of the layout in order. The layout is
 * the same in every dialect (a column is a text, an integer or bytes, and each dialect names the type its own way); a newer layout only adds, and a database of a newer layout than the library
 * knows is refused and never changed.
 *
 * @example
 * ```ts
 * import { LAYOUT, SCHEMA_VERSION } from "./schema.ts";
 * SCHEMA_VERSION; // 3
 * LAYOUT.filter((c) => c.table === "versions").map((c) => c.column); // ["id", "sum", "replica", "seq", "path", "parent", "merged", "kind", "blob"]
 * ```
 *
 * @module
 */
import type { TableRole } from "./naming.ts";

/** The version of the layout this library writes. */
export const SCHEMA_VERSION = 3;

/** The name the layout has in the facts of a database: the version rows and the blobs of a store that merges. */
export const LAYOUT_NAME = "anyfs-sql-merge";

/** What a column holds, in the words of every dialect. */
export type ColumnKind = "text" | "integer" | "bytes" | "tsvector";

/** One column of the layout: the table, its name, what it holds and what it means. */
export type Column = { readonly table: TableRole; readonly column: string; readonly kind: ColumnKind; readonly since: number; readonly means: string };

/** The columns of every table and view, in order: the documented layout. A catalog reads these and no other. */
export const LAYOUT: readonly Column[] = [
  { table: "versions", column: "id", kind: "text", since: 3, means: "the id of the version: a UUID of version 7 made by the hybrid clock, with 62 random bits for each id and holding no replica (the replica is its column), so that ids sort in the order they were made; with `sum` it is the primary key" },
  { table: "versions", column: "sum", kind: "text", since: 3, means: "the SHA-256 of every other field of the row, so that a row is its own checksum" },
  { table: "versions", column: "replica", kind: "text", since: 3, means: "the replica that made the row: 32 lower case hexadecimal digits" },
  { table: "versions", column: "seq", kind: "integer", since: 3, means: "the number of the row among the rows of its replica, from 1 with none missing" },
  { table: "versions", column: "path", kind: "text", since: 3, means: "the path of the file the row is a version of; ordered by the bytes of its UTF-8" },
  { table: "versions", column: "parent", kind: "text", since: 3, means: "the id of the version the writer replaced, or null for the first of a path" },
  { table: "versions", column: "merged", kind: "text", since: 3, means: "the ids of the other heads the writer saw and replaced, as a JSON list in order, `[]` where there were none" },
  { table: "versions", column: "kind", kind: "text", since: 3, means: "`put` (the version holds a blob) or `tombstone` (the path is not there)" },
  { table: "versions", column: "blob", kind: "text", since: 3, means: "the SHA-256 of the bytes of a put, or null for a tombstone" },
  { table: "blobs", column: "sha", kind: "text", since: 3, means: "the SHA-256 of the bytes, the primary key" },
  { table: "blobs", column: "bytes", kind: "bytes", since: 3, means: "the bytes" },
  { table: "meta", column: "key", kind: "text", since: 3, means: "the name of a fact of this copy of the database: `schema_version`, `layout`, `replica`, `fingerprint`, `trust_mode`, `search`; never in a dump" },
  { table: "meta", column: "value", kind: "text", since: 3, means: "the fact" },
  { table: "trust", column: "replica", kind: "text", since: 3, means: "a replica whose rows this copy takes where its trust mode is `allowlist`; never in a dump" },
  { table: "epochs", column: "n", kind: "integer", since: 3, means: "the number of a compaction; never in a dump" },
  { table: "epochs", column: "horizon", kind: "text", since: 3, means: "the version vector every replica of the roster held, as JSON" },
  { table: "epochs", column: "roster", kind: "text", since: 3, means: "the replicas that reported, as JSON" },
  { table: "epochs", column: "retained", kind: "text", since: 3, means: "the keys (`id|sum`) of rows the horizon covers that the epoch keeps, as JSON" },
  { table: "epochs", column: "bound", kind: "text", since: 3, means: "the greatest id an epoch collected: a parent not above it was collected, not missing" },
  { table: "cache", column: "kind", kind: "text", since: 3, means: "what a cached row is: `pending` is a delta held back until what it waits for arrives; never in a dump" },
  { table: "cache", column: "key", kind: "text", since: 3, means: "the identity of the cached thing" },
  { table: "cache", column: "value", kind: "text", since: 3, means: "the cached text" },
  { table: "search", column: "path", kind: "text", since: 3, means: "the path of a file whose bytes are text; derived and rebuilt after a merge, never in a dump" },
  { table: "search", column: "text", kind: "text", since: 3, means: "the words of the text, in the way the engine searches them (an index, not the bytes)" },
  { table: "heads", column: "*", kind: "text", since: 3, means: "view: the rows of `versions` that no other row replaced, with the same columns" },
  { table: "names", column: "path", kind: "text", since: 3, means: "view: the paths that are there, each with its winner: the head with the greatest id and then sum, where it is a put" },
  { table: "names", column: "id", kind: "text", since: 3, means: "view: the id of the winner" },
  { table: "names", column: "sum", kind: "text", since: 3, means: "view: the sum of the winner" },
  { table: "names", column: "blob", kind: "text", since: 3, means: "view: the digest of the bytes of the file" },
  { table: "names", column: "replica", kind: "text", since: 3, means: "view: the replica that made the winner" },
  { table: "siblings", column: "*", kind: "text", since: 3, means: "view: the heads that are not the winner of their path, with the columns of `versions`" },
  { table: "vector", column: "replica", kind: "text", since: 3, means: "view: a replica whose rows this copy holds" },
  { table: "vector", column: "n", kind: "integer", since: 3, means: "view: the number of the last row held of that replica with none missing before it" },
];

/** What a version of the layout adds, in order: the plan of the migrations. The version rows are the only layout there is: a database of an earlier layout is not migrated and is refused. */
export const MIGRATION_PLAN: readonly { readonly version: number; readonly name: string; readonly destructive: boolean }[] = [
  { version: 3, name: "version rows, blobs, the facts of a copy, its trust, epochs and caches, and the views of heads, files, siblings and the vector", destructive: false },
];
