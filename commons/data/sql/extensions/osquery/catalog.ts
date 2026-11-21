// Spec: 0058-sql-osquery FR-008
/**
 * The catalog of osquery for the SQL language library (commons data 0058-sql-osquery FR-008): the tables of the published schema, the columns of each with the type osquery gives it, made into a `Catalog` of `@intellectual-frontiers/lang-sql/aide/catalog`,
 * so that a host that asks one machine a question (a probe, a check) can bind a SELECT to the tables that machine has before it is sent. A table that the platform does not have is left out.
 *
 * @module
 */
import { type Catalog, catalogFromTables } from "@intellectual-frontiers/lang-sql/aide/catalog";
import type { OsquerySchema, Platform } from "./schema.ts";

/** The catalog of the tables of a schema for a platform (every platform where none is given); osquery's types are `text`, the whole numbers `int`, `double` `float`, and a blob `unknown`. */
export function osqueryCatalog(schema: OsquerySchema, platform?: Platform): Catalog {
  const tables = schema.tables.filter((t) => platform === undefined || t.platforms.includes(platform));
  return catalogFromTables(
    tables.map((t) => ({ name: t.name, columns: t.columns.filter((c) => !c.hidden).map((c) => ({ name: c.name, type: c.type })) })),
    { text: "text", integer: "int", bigint: "int", unsigned_bigint: "int", double: "float", blob: "unknown" },
  );
}
