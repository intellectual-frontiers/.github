/**
 * The Presto dialect (commons data 0069-sql-dialects): `--` and block comments that do not nest, identifiers in double quotes, strings in single quotes, the prefixes `X` and `U&`, and the operators `->` and `=>`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Presto. */
export const dialect = declareDialect({
  name: "presto",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "block", open: "/*", close: "*/", nested: false },
    ],
    prefixes: [{ prefix: "X" }, { prefix: "U&" }],
    operators: [...b.operators, "->", "=>"],
  }),
  grammar: (g) => ({ ...g, lambdas: true }),
});
