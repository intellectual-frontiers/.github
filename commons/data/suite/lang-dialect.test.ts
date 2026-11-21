/**
 * The dialects of the SQL language core (commons data 0065-sql-lang): a lexical that cannot be compiled is an error value that names the field; a dialect is made from its parent's lexical and says only what
 * differs, and can remove and replace as well as add; and SQLite, PostgreSQL and DuckDB are dialects of their own folders that write what their engines document.
 *
 * Spec: 0065-sql-lang FR-015, FR-016, FR-017
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ANSI_LEXICAL,
  ansi,
  compileLexical,
  declareDialect,
  defineDialect,
  describeDialectError,
  describeLexicalError,
  EMPTY_LEXICAL,
  type Lexical,
  lex,
} from "@intellectual-frontiers/data/sql/lang";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/lang/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";
import { textsOf } from "./lang-fixture.ts";

const bad = (l: Lexical): string => {
  const r = compileLexical(l);
  assert(r.kind === "err", "it was compiled");
  assert(describeLexicalError(r.error).length > 0);
  return `${r.error.kind}:${r.error.field}`;
};

proves(
  ["0065-sql-lang FR-015"],
  "a lexical compiles once into tables, and one that cannot be compiled is an error value that names the field and never a thrown error",
  () => {
    assertEquals(compileLexical(ANSI_LEXICAL).kind, "ok");
    assertEquals(compileLexical(EMPTY_LEXICAL).kind, "ok");
    assertEquals(bad({ ...ANSI_LEXICAL, comments: [{ kind: "line", marker: "" }] }), "empty:comments");
    assertEquals(bad({ ...ANSI_LEXICAL, comments: [{ kind: "block", open: "/*", close: "", nested: false }] }), "empty:comments");
    assertEquals(bad({ ...ANSI_LEXICAL, comments: [{ kind: "line", marker: "§" }] }), "not-ascii:comments");
    assertEquals(
      bad({
        ...ANSI_LEXICAL,
        comments: [
          { kind: "line", marker: "--" },
          { kind: "line", marker: "--" },
        ],
      }),
      "duplicate:comments",
    );
    assertEquals(bad({ ...ANSI_LEXICAL, strings: [{ open: "«", close: "»", escape: "none" }] }), "not-ascii:strings");
    assertEquals(
      bad({ ...ANSI_LEXICAL, identifiers: [{ open: "'", close: "'" }] }),
      "duplicate:identifiers",
      "a quote for a string and an identifier",
    );
    assertEquals(bad({ ...ANSI_LEXICAL, strings: [{ open: "'", close: "", escape: "none" }] }), "empty:strings");
    assertEquals(bad({ ...ANSI_LEXICAL, operators: ["a"] }), "invalid:operators");
    assertEquals(bad({ ...ANSI_LEXICAL, operators: ["+a"] }), "invalid:operators");
    assertEquals(bad({ ...ANSI_LEXICAL, keywords: ["1x"] }), "invalid:keywords");
    assertEquals(bad({ ...ANSI_LEXICAL, keywords: [""] }), "empty:keywords");
    assertEquals(bad({ ...ANSI_LEXICAL, wordChars: "a" }), "invalid:wordChars");
    assertEquals(bad({ ...ANSI_LEXICAL, prefixes: [{ prefix: "1" }] }), "invalid:prefixes");
    const bare = defineDialect({ name: "bare", lexical: (l) => l });
    assert(bare.kind === "ok");
    assertEquals(
      lex("a 'b'", bare.value.compiled).errors.map((e) => e.kind),
      ["unexpected-character", "unexpected-character"],
      "a dialect with no strings cannot read one, and the lexer goes on",
    );
  },
);

proves(
  ["0065-sql-lang FR-016"],
  "a dialect is made from a name, its parent and a function from the parent's lexical, and can add, remove and replace what it inherits; a chain is resolved once",
  () => {
    const child = defineDialect({
      name: "child",
      extends: ansi,
      lexical: (b) => ({ ...b, keywords: [...b.keywords, "QUALIFY"], comments: [...b.comments, { kind: "line", marker: "#" }] }),
    });
    assert(child.kind === "ok");
    assert(child.value.parent === ansi);
    assertEquals(child.value.lexical.keywords.includes("QUALIFY"), true);
    assertEquals(ansi.lexical.keywords.includes("QUALIFY"), false, "the parent is untouched");
    const grand = defineDialect({
      name: "grand",
      extends: child.value,
      lexical: (b) => ({ ...b, comments: b.comments.filter((c) => c.kind !== "line" || c.marker !== "--"), operators: ["<=>"] }),
    });
    assert(grand.kind === "ok");
    assert(grand.value.parent === child.value);
    assertEquals(grand.value.lexical.keywords.includes("QUALIFY"), true, "what it does not touch it inherits");
    assertEquals(lex("a -- b\n# c", grand.value.compiled).comments.marker, ["#"], "-- was removed");
    assertEquals(textsOf(grand.value, "a<=>b a<=b"), ["a", "<=>", "b", "a", "<", "=", "b"], "operators were replaced");
    const none = defineDialect({ name: "", lexical: (l) => l });
    assertEquals(none.kind, "err");
    if (none.kind === "err") assertEquals(describeDialectError(none.error), "a dialect needs a name");
    const broken = defineDialect({ name: "broken", extends: ansi, lexical: (b) => ({ ...b, operators: ["x"] }) });
    assert(broken.kind === "err" && describeDialectError(broken.error).startsWith("the lexical of broken:"));
    let thrown = "";
    try {
      declareDialect({ name: "broken", extends: ansi, lexical: (b) => ({ ...b, operators: ["x"] }) });
    } catch (e) {
      thrown = e instanceof Error ? e.message : "";
    }
    assert(thrown.startsWith("the lexical of broken:"), "a module's own bad data is caught when it loads");
  },
);

proves(
  ["0065-sql-lang FR-017"],
  "the base is ansi in the core, and SQLite, PostgreSQL and DuckDB each extend it with what their engines document",
  () => {
    for (const d of [sqlite, postgres, duckdb]) assert(d.parent === ansi, `${d.name} extends ansi`);
    assertEquals(ansi.parent, undefined);
    const blocks = (l: Lexical): readonly boolean[] => l.comments.flatMap((c) => (c.kind === "block" ? [c.nested] : []));
    assertEquals(blocks(ansi.lexical), [true]);
    assertEquals(blocks(sqlite.lexical), [false], "SQLite does not nest");
    assertEquals(blocks(postgres.lexical), [true], "PostgreSQL does");
    assertEquals(blocks(duckdb.lexical), [true]);
    for (const d of [sqlite, postgres, duckdb])
      assertEquals(lex("a # b", d.compiled).comments.start.length, 0, `${d.name}: # is not a comment`);
    assertEquals(
      sqlite.lexical.identifiers.map((i) => i.open),
      ['"', "`", "["],
    );
    assertEquals(
      postgres.lexical.identifiers.map((i) => i.open),
      ['"'],
    );
    assertEquals(postgres.lexical.dollarQuotes && duckdb.lexical.dollarQuotes && !sqlite.lexical.dollarQuotes, true);
    assertEquals(postgres.lexical.prefixes.find((p) => p.prefix === "E")?.escape, "both");
    assertEquals(sqlite.lexical.params.includes("colon-name"), true);
    assertEquals(postgres.lexical.params, ["dollar-number"]);
    assertEquals(duckdb.lexical.params.includes("dollar-name"), true);
    assertEquals(
      postgres.lexical.operators.includes("->>") && sqlite.lexical.operators.includes("->>") && duckdb.lexical.operators.includes("->>"),
      true,
    );
    assertEquals(duckdb.lexical.operators.includes("//"), true);
    assertEquals(textsOf(duckdb, "a // b"), ["a", "//", "b"], "DuckDB's // is integer division, not a comment");
    assertEquals(textsOf(postgres, "a ILIKE b"), ["a", "ILIKE", "b"]);
    assertEquals(postgres.lexical.keywords.includes("ILIKE") && !ansi.lexical.keywords.includes("ILIKE"), true);
  },
);
