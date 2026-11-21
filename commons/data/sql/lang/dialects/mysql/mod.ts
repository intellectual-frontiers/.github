/**
 * The MySQL dialect (commons data 0069-sql-dialects): `--` comments (with a space after them), `#` comments and block comments that do not nest, with hints and conditional comments; identifiers in backticks;
 * strings in single and double quotes that write a quote twice or after a backslash; the prefixes `X`, `B` and `N`; the parameters `?` and `@name`; and the operators `<=>`, `->`, `->>`, `<<`, `>>` and `&&`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002, FR-004
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** MySQL. */
export const dialect = declareDialect({
  name: "mysql",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--", spaceAfter: true },
      { kind: "line", marker: "#" },
      { kind: "block", open: "/*", close: "*/", nested: false, hints: true, conditional: true },
    ],
    identifiers: [{ open: "`", close: "`" }],
    strings: [
      { open: "'", close: "'", escape: "both" },
      { open: '"', close: '"', escape: "both" },
    ],
    prefixes: [{ prefix: "X" }, { prefix: "B" }, { prefix: "N" }],
    params: ["question", "at-name"],
    operators: [...b.operators, "<=>", "->", "->>", "<<", ">>", "&&", ":="],
    keywords: [
      ...b.keywords,
      "REGEXP",
      "RLIKE",
      "DIV",
      "MOD",
      "XOR",
      "STRAIGHT_JOIN",
      "DUPLICATE",
      "IGNORE",
      "UNSIGNED",
      "ZEROFILL",
      "AUTO_INCREMENT",
      "ENGINE",
      "SHOW",
      "DESCRIBE",
      "EXPLAIN",
    ],
    wordChars: "$",
    numbers: { radix: true, underscores: false },
  }),
  grammar: (g) => ({
    ...g,
    tableIndexes: true,
    likeWords: ["REGEXP", "RLIKE"],
    wordOperators: [
      { text: "DIV", prec: Prec.Multiplicative },
      { text: "MOD", prec: Prec.Multiplicative },
      { text: "XOR", prec: 15 },
    ],
    operators: [
      ...g.operators,
      { text: "<=>", prec: Prec.Compare },
      { text: "->", prec: Prec.Other },
      { text: "->>", prec: Prec.Other },
      { text: "<<", prec: Prec.Other },
      { text: ">>", prec: Prec.Other },
      { text: "&&", prec: Prec.And },
    ],
  }),
});
