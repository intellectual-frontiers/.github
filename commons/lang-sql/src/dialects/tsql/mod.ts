/**
 * The Transact-SQL dialect (commons lang-sql 0005-sql-dialects): `--` and nested block comments, identifiers in square brackets and double quotes, strings in single quotes, the parameters `@name` and `@@name`,
 * words that begin with `#` (temporary tables), and `0x` numbers.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002, FR-003
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Transact-SQL. */
export const dialect = declareDialect({
  name: "tsql",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    identifiers: [
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
    prefixes: [{ prefix: "N" }],
    params: ["at-name"],
    operators: [...b.operators, "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "!<", "!>"],
    keywords: [...b.keywords, "TOP", "OUTPUT", "NOLOCK", "APPLY", "PIVOT", "UNPIVOT", "IDENTITY", "GO", "EXEC", "EXECUTE", "DECLARE"],
    wordStartChars: "#",
    wordChars: "$",
    numbers: { radix: true, underscores: false },
  }),
  grammar: (g) => ({ ...g, selectTop: true }),
});
