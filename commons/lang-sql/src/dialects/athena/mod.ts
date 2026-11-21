/**
 * The Amazon Athena dialect (commons lang-sql 0005-sql-dialects): Trino's, with identifiers in backticks as well as double quotes, and backslash escapes in strings.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { declareDialect } from "../../dialect.ts";
import { dialect as trino } from "../trino/mod.ts";

/** Amazon Athena. */
export const dialect = declareDialect({
  name: "athena",
  extends: trino,
  lexical: (b) => ({
    ...b,
    identifiers: [...b.identifiers, { open: "`", close: "`" }],
    strings: [{ open: "'", close: "'", escape: "both" }],
  }),
});
