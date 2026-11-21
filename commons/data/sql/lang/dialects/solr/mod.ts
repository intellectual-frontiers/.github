/**
 * The Apache Solr SQL dialect (commons data 0069-sql-dialects): the common comments and strings, identifiers in backticks.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Apache Solr SQL. */
export const dialect = declareDialect({
  name: "solr",
  extends: ansi,
  lexical: (b) => ({ ...b, identifiers: [{ open: "`", close: "`" }], params: [] }),
});
