/**
 * The Exasol dialect (commons lang-sql 0005-sql-dialects): the common comments and strings, identifiers in double quotes and square brackets.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Exasol. */
export const dialect = declareDialect({
  name: "exasol",
  extends: ansi,
  lexical: (b) => ({ ...b, identifiers: [...b.identifiers, { open: "[", close: "]" }], keywords: [...b.keywords, "MINUS", "OPEN"] }),
});
