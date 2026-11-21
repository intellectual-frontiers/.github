/**
 * The Snowflake dialect (commons data 0069-sql-dialects): `--`, `//` and block comments that do not nest, identifiers in double quotes, strings in single quotes with backslash escapes and `$$` strings, the prefix
 * `X`, the parameters `$1`, and the operators `::`, `->`, `->>`, with `ILIKE`, `RLIKE` and `REGEXP` as like-words.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002, FR-004
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** Snowflake. */
export const dialect = declareDialect({
  name: "snowflake",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "line", marker: "//" },
      { kind: "block", open: "/*", close: "*/", nested: false },
    ],
    strings: [{ open: "'", close: "'", escape: "both" }],
    prefixes: [{ prefix: "X" }],
    dollarQuotes: true,
    params: ["dollar-number", "question"],
    operators: [...b.operators, "::", "=>", "->", "->>"],
    keywords: [
      ...b.keywords,
      "QUALIFY",
      "ILIKE",
      "RLIKE",
      "REGEXP",
      "FLATTEN",
      "PIVOT",
      "UNPIVOT",
      "SAMPLE",
      "TABLESAMPLE",
      "VARIANT",
      "COPY",
      "STAGE",
      "WAREHOUSE",
      "MINUS",
    ],
  }),
  grammar: (g) => ({
    ...g,
    colonPaths: true,
    castOperator: "::",
    likeWords: ["ILIKE", "RLIKE", "REGEXP"],
    operators: [...g.operators, { text: "->", prec: Prec.Other }, { text: "->>", prec: Prec.Other }],
  }),
});
