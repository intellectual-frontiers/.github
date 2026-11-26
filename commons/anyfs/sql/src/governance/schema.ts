// Spec: 0002-sql-governance FR-003
/**
 * The layout of the tables, as data a reader of the database can use without the library: what each table holds and what each column means. The layout is
 * the same in every dialect (a column is a text, an integer or bytes, and each dialect names the type its own way).
 *
 * @example
 * ```ts
 * import { LAYOUT } from "./schema.ts";
 * LAYOUT.filter((c) => c.table === "versions").map((c) => c.column); // ["id", "sum", "replica", "seq", "path", "parent", "merged", "kind", "blob"]
 * ```
 *
 * @module
 */
import type { TableRole } from "./naming.ts";

/** The name the layout has in the facts of a database: the version rows and the blobs of a store that merges. */
export const LAYOUT_NAME = "anyfs-sql-merge";

/** What a column holds, in the words of every dialect. */
export type ColumnKind = "text" | "integer" | "bytes" | "tsvector";

/** One column of the layout: the table, its name, what it holds and what it means. */
export type Column = { readonly table: TableRole; readonly column: string; readonly kind: ColumnKind; readonly means: string };

/** The columns of every table and view, in order: the documented layout. A catalog reads these and no other. */
export const LAYOUT: readonly Column[] = [
  { table: "versions", column: "id", kind: "text", means: "the id of the version: a UUID of version 7 made by the hybrid clock, with 62 random bits for each id and holding no replica (the replica is its column), so that ids sort in the order they were made; with `sum` it is the primary key" },
  { table: "versions", column: "sum", kind: "text", means: "the SHA-256 of every other field of the row, so that a row is its own checksum" },
  { table: "versions", column: "replica", kind: "text", means: "the replica that made the row: 32 lower case hexadecimal digits" },
  { table: "versions", column: "seq", kind: "integer", means: "the number of the row among the rows of its replica, from 1 with none missing" },
  { table: "versions", column: "path", kind: "text", means: "the path of the file the row is a version of; ordered by the bytes of its UTF-8" },
  { table: "versions", column: "parent", kind: "text", means: "the id of the version the writer replaced, or null for the first of a path" },
  { table: "versions", column: "merged", kind: "text", means: "the ids of the other heads the writer saw and replaced, as a JSON list in order, `[]` where there were none" },
  { table: "versions", column: "kind", kind: "text", means: "`put` (the version holds a blob) or `tombstone` (the path is not there)" },
  { table: "versions", column: "blob", kind: "text", means: "the SHA-256 of the bytes of a put, or null for a tombstone" },
  { table: "blobs", column: "sha", kind: "text", means: "the SHA-256 of the bytes, the primary key" },
  { table: "blobs", column: "bytes", kind: "bytes", means: "the bytes" },
  { table: "meta", column: "key", kind: "text", means: "the name of a fact of this copy of the database: `layout`, `replica`, `fingerprint`, `trust_mode`, `search`; never in a dump" },
  { table: "meta", column: "value", kind: "text", means: "the fact" },
  { table: "trust", column: "replica", kind: "text", means: "a replica whose rows this copy takes where its trust mode is `allowlist`; never in a dump" },
  { table: "epochs", column: "n", kind: "integer", means: "the number of a compaction; never in a dump" },
  { table: "epochs", column: "horizon", kind: "text", means: "the version vector every replica of the roster held, as JSON" },
  { table: "epochs", column: "roster", kind: "text", means: "the replicas that reported, as JSON" },
  { table: "epochs", column: "retained", kind: "text", means: "the keys (`id|sum`) of rows the horizon covers that the epoch keeps, as JSON" },
  { table: "epochs", column: "bound", kind: "text", means: "the greatest id an epoch collected: a parent not above it was collected, not missing" },
  { table: "cache", column: "kind", kind: "text", means: "what a cached row is: `pending` is a delta held back until what it waits for arrives; never in a dump" },
  { table: "cache", column: "key", kind: "text", means: "the identity of the cached thing" },
  { table: "cache", column: "value", kind: "text", means: "the cached text" },
  { table: "search", column: "path", kind: "text", means: "the path of a file whose bytes are text; derived and rebuilt after a merge, never in a dump" },
  { table: "search", column: "text", kind: "text", means: "the words of the text, in the way the engine searches them (an index, not the bytes)" },
  { table: "heads", column: "*", kind: "text", means: "view: the rows of `versions` that no other row replaced, with the same columns" },
  { table: "names", column: "path", kind: "text", means: "view: the paths that are there, each with its winner: the head with the greatest id and then sum, where it is a put" },
  { table: "names", column: "id", kind: "text", means: "view: the id of the winner" },
  { table: "names", column: "sum", kind: "text", means: "view: the sum of the winner" },
  { table: "names", column: "blob", kind: "text", means: "view: the digest of the bytes of the file" },
  { table: "names", column: "replica", kind: "text", means: "view: the replica that made the winner" },
  { table: "siblings", column: "*", kind: "text", means: "view: the heads that are not the winner of their path, with the columns of `versions`" },
  { table: "vector", column: "replica", kind: "text", means: "view: a replica whose rows this copy holds" },
  { table: "vector", column: "n", kind: "integer", means: "view: the number of the last row held of that replica with none missing before it" },
];
