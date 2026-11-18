// Spec: 0013-sql-qualified-names FR-002
/**
 * A name that carries a schema (commons data 0013-sql-qualified-names FR-002): `"schema"."name"` where there is a schema, `"name"` where there is none.
 *
 * @module
 */
import type { Dialect } from "./dialect.ts";

/**
 * A name as a statement refers to it.
 *
 * @param dialect - the dialect, which quotes
 * @param schema - the schema the name is in, or none
 * @param name - the name as written
 * @returns the quoted, qualified name
 */
export const qualified = (dialect: Dialect, schema: string | undefined, name: string): string =>
  schema === undefined ? dialect.quote(name) : `${dialect.quote(schema)}.${dialect.quote(name)}`;
