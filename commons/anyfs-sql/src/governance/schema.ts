// Spec: 0002-sql-governance FR-003
/**
 * The layout of the tables, as data a reader of the database can use without the library: what each table holds and what each column means, and the versions of the layout in order. The layout is
 * the same in every dialect (a column is a text, an integer or bytes, and each dialect names the type its own way); a newer layout only adds, and a database of a newer layout than the library
 * knows is refused and never changed.
 *
 * @example
 * ```ts
 * import { LAYOUT, SCHEMA_VERSION } from "./schema.ts";
 * SCHEMA_VERSION; // 2
 * LAYOUT.filter((c) => c.table === "objects").map((c) => c.column); // ["path", "rev", "size", "media_type", "modified", "body"]
 * ```
 *
 * @module
 */
import type { TableRole } from "./naming.ts";

/** The version of the layout this library writes. */
export const SCHEMA_VERSION = 2;

/** What a column holds, in the words of every dialect. */
export type ColumnKind = "text" | "integer" | "bytes" | "tsvector";

/** One column of the layout: the table, its name, what it holds and what it means. */
export type Column = { readonly table: TableRole; readonly column: string; readonly kind: ColumnKind; readonly since: number; readonly means: string };

/** The columns of every table, in order: the documented layout. A catalog reads these tables and no other. */
export const LAYOUT: readonly Column[] = [
  { table: "meta", column: "key", kind: "text", since: 1, means: "the name of a fact of the layout: `schema_version`, `layout`, `search`" },
  { table: "meta", column: "value", kind: "text", since: 1, means: "the fact" },
  { table: "objects", column: "path", kind: "text", since: 1, means: "the path of the object in the store, the primary key; ordered by the bytes of its UTF-8, which is the order of a list" },
  { table: "objects", column: "rev", kind: "text", since: 1, means: "the revision: `sha256:` and the digest of the bytes" },
  { table: "objects", column: "size", kind: "integer", since: 1, means: "the size of the bytes" },
  { table: "objects", column: "media_type", kind: "text", since: 1, means: "the media type the path's name says, or null" },
  { table: "objects", column: "modified", kind: "text", since: 1, means: "the instant of the last change, as an ISO 8601 text in UTC" },
  { table: "objects", column: "body", kind: "bytes", since: 1, means: "the bytes" },
  { table: "revisions", column: "path", kind: "text", since: 1, means: "the path of the object the revision is of" },
  { table: "revisions", column: "seq", kind: "integer", since: 1, means: "the number of the revision of this path, from 1" },
  { table: "revisions", column: "rev", kind: "text", since: 1, means: "the revision" },
  { table: "revisions", column: "size", kind: "integer", since: 1, means: "the size of its bytes" },
  { table: "revisions", column: "modified", kind: "text", since: 1, means: "the instant it was made" },
  { table: "search", column: "path", kind: "text", since: 2, means: "the path of an object whose bytes are text" },
  { table: "search", column: "text", kind: "text", since: 2, means: "the words of the text, in the way the engine searches them (an index, not the bytes)" },
];

/** What a version of the layout adds, in order: the plan of the migrations, which only add. */
export const MIGRATION_PLAN: readonly { readonly version: number; readonly name: string; readonly destructive: boolean }[] = [
  { version: 1, name: "tables of the objects, their revisions and the facts of the layout", destructive: false },
  { version: 2, name: "indexes of the instant and the media type, and the index of search where the engine has one", destructive: false },
];
