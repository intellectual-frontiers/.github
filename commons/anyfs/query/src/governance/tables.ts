// Spec: 0002-query-language FR-002
/**
 * The tables of the language (commons anyfs-query 0002-query-language FR-002): `files`, `content`, `revisions` and `places`, each with its columns and their types, in order. A table is data; the planner reads
 * which columns a filter touches from here, and the catalog the binder resolves names against is made from it.
 *
 * @module
 */

/** The types a column has. */
export type ColumnType = "int" | "text" | "bool" | "timestamp";

/** The tables of the language. */
export const TABLE_NAMES = ["files", "content", "revisions", "places"] as const;
/** One table of the language. */
export type TableName = (typeof TABLE_NAMES)[number];

/** A table's columns, in order, with their types. */
export type Columns = Readonly<Record<string, ColumnType>>;

/** The columns of a listing: what a store says of an object without reading it. */
export const FILE_COLUMNS = {
  place: "text",
  path: "text",
  name: "text",
  ext: "text",
  size: "int",
  media_type: "text",
  mtime: "timestamp",
  rev: "text",
  kind: "text",
  depth: "int",
} as const satisfies Columns;

/** The columns only a read of an object gives. */
export const CONTENT_ONLY_COLUMNS = { text: "text", is_text: "bool", redacted: "bool" } as const satisfies Columns;

/** The columns of every table. */
export const TABLE_COLUMNS: Readonly<Record<TableName, Columns>> = {
  files: FILE_COLUMNS,
  content: { ...FILE_COLUMNS, ...CONTENT_ONLY_COLUMNS },
  revisions: { place: "text", path: "text", rev: "text", size: "int", instant: "timestamp" },
  places: { uri: "text", kind: "text", capabilities: "text", consistency: "text", max_object: "int" },
};

/** The columns of a table in order. */
export const columnNames = (table: TableName): readonly string[] => Object.keys(TABLE_COLUMNS[table]);

/** The columns that need a read of the object: a filter on one of them cannot be answered from a listing. */
export const READ_COLUMNS: ReadonlySet<string> = new Set(Object.keys(CONTENT_ONLY_COLUMNS));

/** Whether a text is the name of a table. */
export const isTableName = (text: string): text is TableName => (TABLE_NAMES as readonly string[]).includes(text);
