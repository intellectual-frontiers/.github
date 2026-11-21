/**
 * The Amazon Redshift dialect (commons lang-sql 0005-sql-dialects): PostgreSQL's, with backslash escapes in strings as well as a doubled quote.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as postgres } from "../postgres/mod.ts";

/** Amazon Redshift. */
export const dialect = declareDialect({
  name: "redshift",
  extends: postgres,
  lexical: (b) => ({ ...b, strings: [{ open: "'", close: "'", escape: "both" }] }),
});
