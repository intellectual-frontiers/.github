/**
 * The DuckDB dialect's lexical layer (commons data 0065-sql-lang FR-017): `--` comments and `/* *\/` comments that nest, identifiers in `"`, strings in `'` and dollar quotes, the prefix `E`, the parameters
 * `?`, `$1` and `$name`, and its operators (`//`, `**`, `->`, `->>`, `::`, `:=`, `=>`, the list and struct ones). The square brackets and braces are punctuation, for lists and structs.
 *
 * Spec: 0065-sql-lang FR-017
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** DuckDB. */
export const dialect = declareDialect({
  name: "duckdb",
  extends: ansi,
  lexical: (base) => ({
    ...base,
    prefixes: [{ prefix: "E", escape: "both" }, { prefix: "B" }, { prefix: "X" }],
    dollarQuotes: true,
    params: ["question", "dollar-number", "dollar-name"],
    operators: [
      ...base.operators,
      "::",
      "->",
      "->>",
      "<<",
      ">>",
      "&&",
      "@>",
      "<@",
      "~~",
      "~~*",
      "!~~",
      "!~~*",
      "~*",
      "!~",
      "!~*",
      ":=",
      "=>",
      "**",
      "//",
      "^@",
      "<->",
    ],
    keywords: [
      ...base.keywords,
      "QUALIFY",
      "EXCLUDE",
      "PIVOT",
      "UNPIVOT",
      "SAMPLE",
      "STRUCT",
      "MAP",
      "LIST",
      "ILIKE",
      "GLOB",
      "SIMILAR",
      "ASOF",
      "POSITIONAL",
      "ANTI",
      "SEMI",
      "USING",
      "ATTACH",
      "DETACH",
      "COPY",
      "PRAGMA",
      "INSTALL",
      "LOAD",
      "EXPORT",
      "IMPORT",
      "SUMMARIZE",
      "DESCRIBE",
      "MACRO",
      "SEQUENCE",
      "RETURNING",
      "CONFLICT",
      "DO",
      "NOTHING",
      "TEMP",
      "TEMPORARY",
    ],
    numbers: { radix: true, underscores: true },
  }),
});
