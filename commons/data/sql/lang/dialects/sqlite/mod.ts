/**
 * The SQLite dialect's lexical layer (commons data 0065-sql-lang FR-017): `--` and `/* *\/` comments that do not nest, identifiers in `"`, `` ` `` and `[ ]`, strings in `'` (and `X'..'`), the
 * parameters `?`, `?NNN`, `:name` and `@name`, and its operators including the JSON arrows. SQLite has no `#` comment and no dollar quotes.
 *
 * Spec: 0065-sql-lang FR-017
 *
 * @module
 */
import { ANSI_LEXICAL, ansi } from "../../ansi.ts";
import { declareDialect } from "../../dialect.ts";
import { Prec } from "../../grammar.ts";

/** SQLite. */
export const dialect = declareDialect({
  name: "sqlite",
  extends: ansi,
  grammar: (g) => ({
    ...g,
    operators: [
      ...g.operators,
      { text: "->", prec: Prec.Other },
      { text: "->>", prec: Prec.Other },
      { text: "<<", prec: Prec.Other },
      { text: ">>", prec: Prec.Other },
      { text: "==", prec: Prec.Compare },
    ],
    likeWords: ["GLOB", "REGEXP", "MATCH"],
  }),
  lexical: (base) => ({
    ...base,
    comments: [
      { kind: "line", marker: "--" },
      { kind: "block", open: "/*", close: "*/", nested: false },
    ],
    identifiers: [...ANSI_LEXICAL.identifiers, { open: "`", close: "`" }, { open: "[", close: "]" }],
    prefixes: [{ prefix: "X" }],
    params: ["question", "colon-name", "at-name", "dollar-name"],
    operators: [...base.operators, "->", "->>", "<<", ">>"],
    keywords: [
      ...base.keywords,
      "PRAGMA",
      "VACUUM",
      "REINDEX",
      "ATTACH",
      "DETACH",
      "GLOB",
      "REGEXP",
      "MATCH",
      "ROWID",
      "WITHOUT",
      "AUTOINCREMENT",
      "IGNORE",
      "ABORT",
      "FAIL",
      "CONFLICT",
      "DO",
      "NOTHING",
      "VIRTUAL",
      "STRICT",
      "INDEXED",
      "BEGIN",
      "TRANSACTION",
      "DEFERRED",
      "IMMEDIATE",
      "EXCLUSIVE",
    ],
    numbers: { radix: true, underscores: false },
  }),
});
