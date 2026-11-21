/**
 * The Oracle dialect (commons data 0069-sql-dialects): `--` and block comments that do not nest, with hints, identifiers in double quotes, strings in single quotes, alternative quoting (`q'[..]'`), the
 * parameters `:name`, and words that hold `$` and `#`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002, FR-003
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Oracle. */
export const dialect = declareDialect({
  name: "oracle",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "block", open: "/*", close: "*/", nested: false, hints: true },
    ],
    prefixes: [{ prefix: "N" }],
    params: ["colon-name"],
    operators: [...b.operators, "^=", "~="],
    keywords: [
      ...b.keywords,
      "CONNECT",
      "PRIOR",
      "START",
      "MINUS",
      "ROWNUM",
      "ROWID",
      "DUAL",
      "SYSDATE",
      "VARCHAR2",
      "NUMBER",
      "SEQUENCE",
      "SYNONYM",
    ],
    wordChars: "$#",
    qQuoting: true,
  }),
});
