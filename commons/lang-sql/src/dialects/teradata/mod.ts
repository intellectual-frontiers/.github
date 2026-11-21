/**
 * The Teradata dialect (commons lang-sql 0005-sql-dialects): the common comments, identifiers in double quotes, strings in single quotes, the prefix `X`, `0x` numbers, and `**`.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002, FR-004
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** Teradata. */
export const dialect = declareDialect({
  name: "teradata",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    prefixes: [{ prefix: "X" }],
    params: ["colon-name"],
    operators: [...b.operators, "**", "^="],
    keywords: [...b.keywords, "SEL", "QUALIFY", "SAMPLE", "MINUS", "TOP", "VOLATILE", "MULTISET"],
    numbers: { radix: true, underscores: false },
  }),
  grammar: (g) => ({ ...g, operators: [...g.operators, { text: "**", prec: Prec.Exponent }] }),
});
