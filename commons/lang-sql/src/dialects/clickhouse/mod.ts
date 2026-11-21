/**
 * The ClickHouse dialect (commons lang-sql 0005-sql-dialects): `--`, `#`, `#!` and block comments, identifiers in double quotes and backticks, strings in single quotes with backslash escapes and `$$` strings, `0x` and
 * `0b` numbers, and the operators `::`, `->`, `<=>`, with `ILIKE` as a like-word.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002, FR-004
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** ClickHouse. */
export const dialect = declareDialect({
  name: "clickhouse",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "line", marker: "#!" },
      { kind: "line", marker: "#" },
      { kind: "block", open: "/*", close: "*/", nested: true },
    ],
    identifiers: [...b.identifiers, { open: "`", close: "`" }],
    strings: [{ open: "'", close: "'", escape: "both" }],
    prefixes: [],
    dollarQuotes: true,
    params: [],
    operators: [...b.operators, "::", "->", "=>", "<=>"],
    keywords: [...b.keywords, "ILIKE", "FINAL", "PREWHERE", "SETTINGS", "FORMAT", "GLOBAL", "SAMPLE", "ENGINE", "MATERIALIZED"],
    numbers: { radix: true, underscores: true },
  }),
  grammar: (g) => ({
    ...g,
    lambdas: true,
    parametric: true,
    tableIndexes: true,
    queryTail: ["SETTINGS",
    "FORMAT"],
    castOperator: "::",
    likeWords: ["ILIKE"],
    operators: [...g.operators, { text: "->", prec: Prec.Other }, { text: "<=>", prec: Prec.Compare }, { text: "==", prec: Prec.Compare }],
  }),
});
