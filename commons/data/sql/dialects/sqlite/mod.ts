// Spec: 0007-physical FR-004
/**
 * The SQLite dialect (commons data 0007-physical FR-004), an extension that contributes itself through the engine's point `physical.dialect`: SQLite has few types, so text, dates, moments and
 * documents are `TEXT`, a boolean is `INTEGER`, bytes `BLOB`. It has no `COMMENT ON`, no regular expression to check a pattern with (one is a function a program adds) and no way to add a
 * constraint to a table that exists.
 *
 * @module
 */
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, dialectExtension, quoteName, standardLiteral } from "@intellectual-frontiers/data/sql/physical";

const type = (t: LogicalType): string => {
  switch (t.kind) {
    case "text":
    case "date":
    case "timestamp":
    case "json":
      return "TEXT";
    case "integer":
    case "boolean":
      return "INTEGER";
    case "decimal":
      return "NUMERIC";
    case "bytes":
      return "BLOB";
    case "vector":
      return "BLOB"; // refused by `unsupported` before it is written
  }
};

/** SQLite. */
export const dialect: Dialect = {
  name: "sqlite",
  features: ["instead-of-triggers"],
  attach: {
    attach: (file, alias) => `ATTACH DATABASE '${file.replaceAll("'", "''")}' AS "${alias.replaceAll('"', '""')}";`,
    detach: (alias) => `DETACH DATABASE "${alias.replaceAll('"', '""')}";`,
  },
  maxName: 1024,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  catalog: {
    compares: ["tables", "columns (type, nullability)", "primary keys", "indexes"],
    read: async (query) => {
      const tables = await query(`SELECT name n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
      const idx = await query(`SELECT tbl_name t, name n FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL`);
      const out = [];
      for (const t of tables) {
        const name = String(t["n"]);
        const cols = await query(`SELECT name c, type d, "notnull" nn, pk FROM pragma_table_info(${standardLiteral(name)})`);
        out.push({
          name,
          columns: cols.map((c) => ({ name: String(c["c"]), type: String(c["d"]), nullable: Number(c["nn"]) === 0 })),
          primaryKey: cols
            .filter((c) => Number(c["pk"]) > 0)
            .sort((a, b) => Number(a["pk"]) - Number(b["pk"]))
            .map((c) => String(c["c"])),
          indexes: idx.filter((i) => i["t"] === name).map((i) => String(i["n"])),
        });
      }
      return out;
    },
  },
  rebuild: { prelude: ["PRAGMA defer_foreign_keys = ON;"], blockedByParents: false },
  ifExists: ["dropTable", "dropIndex"],
  probes: {
    table: (t) => `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ${standardLiteral(t)}`,
    column: (t, c) => `SELECT 1 FROM pragma_table_info(${standardLiteral(t)}) WHERE name = ${standardLiteral(c)}`,
    constraint: () => undefined,
    index: (n) => `SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ${standardLiteral(n)}`,
  },
  addColumnRefusal: (c) =>
    !c.nullable && c.default === undefined
      ? "SQLite cannot add a required column that has no default to a table"
      : c.default?.kind === "now"
        ? "SQLite cannot add a column whose default is not a constant"
        : undefined,
  unsupported: (t) => (t.kind === "vector" ? "SQLite has no vector type" : undefined),
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
