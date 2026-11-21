/**
 * The SingleStore dialect (commons data 0069-sql-dialects): MySQL's, with the prefix `E`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as mysql } from "../mysql/mod.ts";

/** SingleStore. */
export const dialect = declareDialect({
  name: "singlestore",
  extends: mysql,
  lexical: (b) => ({ ...b, prefixes: [...b.prefixes, { prefix: "E" }] }),
});
