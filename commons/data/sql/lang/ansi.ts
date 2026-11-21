/**
 * The base dialect, `ansi` (commons data 0065-sql-lang FR-017): `--` and nested `/* *\/` comments, `"` quoted identifiers, `'` strings that write a quote twice, the common operators, numbers with a
 * fraction and an exponent, and the words of standard SQL that a parser asks about. Every dialect of this folder extends it.
 *
 * @example
 * ```ts
 * import { ansi, lex } from "@intellectual-frontiers/data/sql/lang";
 * lex("select 1", ansi.compiled).errors.length; // 0
 * ```
 *
 * Spec: 0065-sql-lang FR-017
 *
 * @module
 */
import { declareDialect } from "./dialect.ts";
import type { Lexical } from "./lexical.ts";

const KEYWORDS =
  "ALL ALTER AND ANY ARRAY AS ASC ASYMMETRIC BETWEEN BIGINT BINARY BOOLEAN BOTH BY CASE CAST CHAR CHARACTER CHECK COLLATE COLUMN COMMIT CONSTRAINT CREATE CROSS CUBE CURRENT CURRENT_DATE " +
  "CURRENT_TIME CURRENT_TIMESTAMP CURRENT_USER DATE DAY DECIMAL DEFAULT DELETE DESC DISTINCT DOUBLE DROP ELSE END ESCAPE EXCEPT EXISTS EXTRACT FALSE FETCH FILTER FIRST FLOAT FOLLOWING FOR " +
  "FOREIGN FROM FULL GRANT GROUP GROUPING HAVING HOUR IF IN INDEX INNER INSERT INT INTEGER INTERSECT INTERVAL INTO IS JOIN KEY LAST LATERAL LEADING LEFT LIKE LIMIT LOCAL MERGE MINUTE MONTH " +
  "NATURAL NO NOT NULL NULLS NUMERIC OFFSET ON ONLY OR ORDER OUTER OVER OVERLAPS PARTITION PRECEDING PRIMARY RANGE RECURSIVE REFERENCES REPLACE RETURNING RIGHT ROLLBACK ROLLUP ROW ROWS " +
  "SECOND SELECT SET SETS SMALLINT SOME TABLE TEXT THEN TIME TIMESTAMP TO TRAILING TRUE UNBOUNDED UNION UNIQUE UPDATE USING VALUES VARCHAR VIEW WHEN WHERE WINDOW WITH WITHIN YEAR ZONE";

/** The lexical of the base dialect. */
export const ANSI_LEXICAL: Lexical = {
  comments: [
    { kind: "line", marker: "--" },
    { kind: "block", open: "/*", close: "*/", nested: true },
  ],
  identifiers: [{ open: '"', close: '"' }],
  strings: [{ open: "'", close: "'", escape: "double" }],
  prefixes: [{ prefix: "N" }, { prefix: "X" }, { prefix: "B" }],
  dollarQuotes: false,
  params: ["question"],
  operators: ["<>", "<=", ">=", "!=", "||", "=="],
  keywords: KEYWORDS.split(" "),
  wordChars: "",
  numbers: { radix: false, underscores: false },
};

/** The base dialect. */
export const ansi = declareDialect({ name: "ansi", lexical: () => ANSI_LEXICAL });
