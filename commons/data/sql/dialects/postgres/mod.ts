// Spec: 0007-physical FR-004
/**
 * The PostgreSQL dialect (commons data 0007-physical FR-004), an extension that contributes itself through the engine's point `physical.dialect`: text of a length is `VARCHAR(n)`, a
 * moment with a zone `TIMESTAMPTZ`, a document `JSONB`, bytes `BYTEA`; it has `COMMENT ON`, a regular expression for a pattern, `ALTER TABLE ... ADD CONSTRAINT`, and names of at most 63 bytes.
 *
 * @module
 */
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, dialectExtension, quoteName, standardLiteral } from "@intellectual-frontiers/data/sql/physical";

const type = (t: LogicalType): string => {
  switch (t.kind) {
    case "text":
      return t.max === undefined ? "TEXT" : `VARCHAR(${t.max})`;
    case "integer":
      return "INTEGER";
    case "decimal":
      return t.precision === undefined
        ? "NUMERIC"
        : t.scale === undefined
          ? `NUMERIC(${t.precision})`
          : `NUMERIC(${t.precision}, ${t.scale})`;
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "timestamp":
      return t.zone ? "TIMESTAMPTZ" : "TIMESTAMP";
    case "json":
      return "JSONB";
    case "bytes":
      return "BYTEA";
    case "vector":
      return `VECTOR(${t.dimensions})`;
  }
};

/** PostgreSQL. */
export const dialect: Dialect = {
  name: "postgres",
  features: ["comment-on", "regex-check", "add-constraint", "or-replace-view", "row-security", "grants", "routines", "partitions"],
  maxName: 63,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  setup: (types) => (types.some((t) => t.kind === "vector") ? ["CREATE EXTENSION IF NOT EXISTS vector;"] : []),
  pattern: (column, pattern) => `${column} ~ ${standardLiteral(pattern)}`,
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
