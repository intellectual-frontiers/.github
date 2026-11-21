/**
 * The Google BigQuery dialect (commons lang-sql 0005-sql-dialects): `--`, `#` and block comments that do not nest, identifiers in backticks, strings in single and double quotes, also tripled, with backslash escapes,
 * the raw (`R`) and byte (`B`) prefixes, the parameters `@name`, and `0x` numbers.
 *
 * Spec: 0005-sql-dialects FR-001, FR-002
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";

/** Google BigQuery. */
export const dialect = declareDialect({
  name: "bigquery",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "line", marker: "#" },
      { kind: "block", open: "/*", close: "*/", nested: false },
    ],
    identifiers: [{ open: "`", close: "`" }],
    strings: [
      { open: "'''", close: "'''", escape: "backslash" },
      { open: '"""', close: '"""', escape: "backslash" },
      { open: "'", close: "'", escape: "backslash" },
      { open: '"', close: '"', escape: "backslash" },
    ],
    prefixes: [{ prefix: "R", escape: "none" }, { prefix: "B" }, { prefix: "RB", escape: "none" }, { prefix: "BR", escape: "none" }],
    params: ["at-name"],
    operators: [...b.operators, "<<", ">>", "=>"],
    keywords: [...b.keywords, "QUALIFY", "STRUCT", "UNNEST", "SAFE_CAST", "PIVOT", "UNPIVOT", "TABLESAMPLE"],
    numbers: { radix: true, underscores: false },
  }),
});
