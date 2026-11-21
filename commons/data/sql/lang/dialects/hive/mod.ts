/**
 * The Apache Hive dialect (commons data 0069-sql-dialects): the common comments, identifiers in backticks, strings in single and double quotes with backslash escapes, the number suffixes `L`, `S`, `Y`, `D`, `F`
 * and `BD` (`1L`, `1.5BD`), and `RLIKE`, `REGEXP` and `<=>`.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002, FR-003, FR-004
 *
 * @module
 */
import { ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** Apache Hive. */
export const dialect = declareDialect({
  name: "hive",
  extends: ansi,
  lexical: (b) => ({
    ...b,
    identifiers: [{ open: "`", close: "`" }],
    strings: [
      { open: "'", close: "'", escape: "backslash" },
      { open: '"', close: '"', escape: "backslash" },
    ],
    prefixes: [],
    params: [],
    operators: [...b.operators, "<=>", "&&"],
    keywords: [...b.keywords, "RLIKE", "REGEXP", "DIV", "OVERWRITE", "EXTERNAL", "PARTITIONED", "STORED", "LOCATION", "TBLPROPERTIES"],
    numberSuffixes: ["L", "S", "Y", "D", "F", "BD"],
  }),
  grammar: (g) => ({
    ...g,
    fromFirst: true,
    likeWords: ["RLIKE", "REGEXP"],
    wordOperators: [{ text: "DIV", prec: Prec.Multiplicative }],
    operators: [...g.operators, { text: "<=>", prec: Prec.Compare }, { text: "&&", prec: Prec.And }],
  }),
});
