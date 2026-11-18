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
  features: [],
  maxName: 1024,
  now: "CURRENT_TIMESTAMP",
  quote: quoteName,
  literal: standardLiteral,
  type,
  unsupported: (t) => (t.kind === "vector" ? "SQLite has no vector type" : undefined),
};

/** The extension that contributes the dialect, or why its identifier is not one. */
export const extension = dialectExtension(dialect);
