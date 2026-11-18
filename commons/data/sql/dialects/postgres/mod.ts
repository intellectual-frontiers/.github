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
  cascade: true,
  advisory: { acquire: (k) => `SELECT pg_advisory_lock(${k});`, release: (k) => `SELECT pg_advisory_unlock(${k});` },
  catalog: {
    compares: ["tables", "columns (type, nullability)", "primary keys", "indexes", "foreign keys, uniques and checks (by name)"],
    read: async (query, schema) => {
      const s = schema === undefined ? "current_schema()" : standardLiteral(schema);
      const tables = await query(
        `SELECT table_name n FROM information_schema.tables WHERE table_schema = ${s} AND table_type = 'BASE TABLE' ORDER BY table_name`,
      );
      const cols = await query(
        `SELECT table_name t, column_name c, data_type d, character_maximum_length l, numeric_precision p, numeric_scale sc, udt_name u, is_nullable n FROM information_schema.columns WHERE table_schema = ${s} ORDER BY table_name, ordinal_position`,
      );
      const pks = await query(
        `SELECT tc.table_name t, kcu.column_name c FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ${s} ORDER BY kcu.ordinal_position`,
      );
      const cons = await query(
        `SELECT r.relname t, c.conname n, c.contype k FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = r.relnamespace WHERE ns.nspname = ${s} AND c.contype IN ('f', 'u', 'c')`,
      );
      const idx = await query(
        `SELECT tablename t, indexname n FROM pg_indexes WHERE schemaname = ${s} AND indexname NOT IN (SELECT conname FROM pg_constraint)`,
      );
      const typeOf = (r: Record<string, unknown>): string => {
        const d = String(r["d"]);
        if (d === "character varying") return r["l"] === null || r["l"] === undefined ? d : `${d}(${r["l"]})`;
        if (d === "numeric") return r["p"] === null || r["p"] === undefined ? d : `numeric(${r["p"]},${r["sc"]})`;
        return d === "USER-DEFINED" ? String(r["u"]) : d;
      };
      return tables.map((t) => {
        const name = String(t["n"]);
        return {
          name,
          columns: cols.filter((c) => c["t"] === name).map((c) => ({ name: String(c["c"]), type: typeOf(c), nullable: c["n"] === "YES" })),
          primaryKey: pks.filter((k) => k["t"] === name).map((k) => String(k["c"])),
          indexes: idx.filter((i) => i["t"] === name).map((i) => String(i["n"])),
          constraints: cons
            .filter((c) => c["t"] === name)
            .map((c) => ({
              name: String(c["n"]),
              kind: c["k"] === "f" ? ("foreignKey" as const) : c["k"] === "u" ? ("unique" as const) : ("check" as const),
            })),
        };
      });
    },
  },
  locks: {
    timeouts: (lockMs, statementMs) => [
      `SELECT set_config('lock_timeout', '${lockMs}', true);`,
      `SELECT set_config('statement_timeout', '${statementMs}', true);`,
    ],
    timedOut: (message) => message.includes("lock timeout") || message.includes("lock_not_available"),
  },
  deferredValidation: true,
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
    validConstraint: (t, n, s) =>
      `SELECT 1 FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace s ON s.oid = r.relnamespace WHERE s.nspname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND r.relname = ${standardLiteral(t)} AND c.conname = ${standardLiteral(n)} AND c.convalidated`,
    index: (n, s) =>
      `SELECT 1 FROM pg_indexes WHERE schemaname = ${s === undefined ? "current_schema()" : standardLiteral(s)} AND indexname = ${standardLiteral(n)}`,
  },
  setup: (types) => (types.some((t) => t.kind === "vector") ? ["CREATE EXTENSION IF NOT EXISTS vector;"] : []),
  pattern: (column, pattern) => `${column} ~ ${standardLiteral(pattern)}`,
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
