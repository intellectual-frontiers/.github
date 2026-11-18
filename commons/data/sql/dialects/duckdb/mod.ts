// Spec: 0007-physical FR-004
/**
 * The DuckDB dialect (commons data 0007-physical FR-004), an extension that contributes itself through the engine's point `physical.dialect`: text is `VARCHAR`, with no length, for DuckDB
 * does not enforce one; a moment with a zone is `TIMESTAMPTZ`, a document `JSON`, bytes `BLOB`. It has `COMMENT ON` and a regular expression for a pattern, and it cannot add a foreign key to a
 * table that exists.
 *
 * @module
 */
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, dialectExtension, quoteName, standardLiteral } from "@intellectual-frontiers/data/sql/physical";

const type = (t: LogicalType): string => {
  switch (t.kind) {
    case "text":
      return "VARCHAR";
    case "integer":
      return "INTEGER";
    case "decimal":
      return t.precision === undefined
        ? "DECIMAL"
        : t.scale === undefined
          ? `DECIMAL(${t.precision})`
          : `DECIMAL(${t.precision}, ${t.scale})`;
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return t.zone ? "TIMESTAMPTZ" : "TIMESTAMP";
    case "json":
      return "JSON";
    case "bytes":
      return "BLOB";
    case "vector":
      return `FLOAT[${t.dimensions}]`;
  }
};

/** DuckDB. */
export const dialect: Dialect = {
  name: "duckdb",
  features: ["comment-on", "regex-check", "or-replace-view", "alter-column", "schemas"],
  maxName: 255,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  ifExists: ["addColumn", "dropColumn", "dropTable", "dropIndex"],
  probes: {
    table: (t, s) =>
      `SELECT 1 FROM duckdb_tables() WHERE schema_name = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)}`,
    column: (t, c, s) =>
      `SELECT 1 FROM duckdb_columns() WHERE schema_name = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)} AND column_name = ${standardLiteral(c)}`,
    constraint: () => undefined,
    index: (n, s) =>
      `SELECT 1 FROM duckdb_indexes() WHERE schema_name = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND index_name = ${standardLiteral(n)}`,
  },
  pattern: (column, pattern) => `regexp_matches(${column}, ${standardLiteral(pattern)})`,
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
