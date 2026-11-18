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
  features: [
    "comment-on",
    "regex-check",
    "add-constraint",
    "or-replace-view",
    "row-security",
    "grants",
    "routines",
    "partitions",
    "alter-column",
    "schemas",
    "updatable-views",
  ],
  maxName: 63,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  hash: (t) => `md5(${t})`,
  hasRole: (r) => `pg_has_role(current_user, ${standardLiteral(r)}, 'member')`,
  ifExists: ["addColumn", "dropColumn", "dropConstraint", "dropTable", "dropIndex"],
  probes: {
    table: (t, s) =>
      `SELECT 1 FROM information_schema.tables WHERE table_schema = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)}`,
    column: (t, c, s) =>
      `SELECT 1 FROM information_schema.columns WHERE table_schema = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND table_name = ${standardLiteral(t)} AND column_name = ${standardLiteral(c)}`,
    constraint: (t, n, s) =>
      `SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND r.relname = ${standardLiteral(t)} AND c.conname = ${standardLiteral(n)}`,
    index: (n, s) =>
      `SELECT 1 FROM pg_indexes WHERE schemaname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND indexname = ${standardLiteral(n)}`,
  },
  setup: (types) => (types.some((t) => t.kind === "vector") ? ["CREATE EXTENSION IF NOT EXISTS vector;"] : []),
  pattern: (column, pattern) => `${column} ~ ${standardLiteral(pattern)}`,
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
