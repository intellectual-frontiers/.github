/**
 * The comments of the SQL language core (commons lang-sql 0001-sql-lang): every comment of every kind a dialect has is kept with its kind, marker, span, text and place; nesting, hints, conditional comments and
 * the space after `--` follow the dialect; a comment's place is given for the attachment to come; what looks like a comment in a string, a quoted name or another comment is not one; and a position is found
 * from an offset.
 *
 * Spec: 0001-sql-lang FR-009, FR-010, FR-011, FR-012, FR-013, FR-014
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  allComments,
  ansi,
  type Comment,
  type Dialect,
  defineDialect,
  kindAt,
  lex,
  lineIndex,
  positionAt,
  Tok,
} from "@intellectual-frontiers/lang-sql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { textsOf, wholeness } from "./fixture.ts";

const must = (r: ReturnType<typeof defineDialect>): Dialect => {
  assert(r.kind === "ok", JSON.stringify(r));
  return r.value;
};

/** A dialect with MySQL's comments: `--` needs a space after it, `#`, hints and conditional comments, no nesting. */
const mysqlish = must(
  defineDialect({
    name: "mysqlish",
    extends: ansi,
    lexical: (b) => ({
      ...b,
      comments: [
        { kind: "line", marker: "--", spaceAfter: true },
        { kind: "line", marker: "#" },
        { kind: "block", open: "/*", close: "*/", nested: false, hints: true, conditional: true },
      ],
    }),
  }),
);
/** A dialect with Snowflake's `//` and ClickHouse's `#!`. */
const slashy = must(
  defineDialect({
    name: "slashy",
    extends: ansi,
    lexical: (b) => ({
      ...b,
      comments: [
        { kind: "line", marker: "--" },
        { kind: "line", marker: "//" },
        { kind: "line", marker: "#!" },
        { kind: "line", marker: "#" },
        { kind: "block", open: "/*", close: "*/", nested: false },
      ],
    }),
  }),
);

const commentsOf = (d: Dialect, text: string): readonly Comment[] => {
  const l = lex(text, d.compiled);
  assertEquals(wholeness(l), undefined, `${d.name} ${JSON.stringify(text)}`);
  return allComments(l.comments, l.text);
};

proves(
  ["0001-sql-lang FR-009"],
  "every comment of every kind the dialect has is kept, with its kind, marker, span and text, and nesting follows the dialect",
  () => {
    const m = commentsOf(mysqlish, "select 1 -- a\n# b\n/* c */ // d");
    assertEquals(
      m.map((c) => [c.style, c.marker, c.text]),
      [
        ["line", "--", " a"],
        ["line", "#", " b"],
        ["block", "/*", " c "],
      ],
    );
    assertEquals(
      m.map((c) => [c.span.start, c.span.end]),
      [
        [9, 13],
        [14, 17],
        [18, 25],
      ],
    );
    const s = commentsOf(slashy, "a // b\n#! c\n# d\n-- e");
    assertEquals(
      s.map((c) => [c.marker, c.text]),
      [
        ["//", " b"],
        ["#!", " c"],
        ["#", " d"],
        ["--", " e"],
      ],
    );
    assertEquals(commentsOf(ansi, "a // b").length, 0, "ansi has no //");
    assertEquals(commentsOf(ansi, "a # b").length, 0, "ansi has no #");
    const pg = commentsOf(postgres, "/* a /* b */ c */ x");
    assertEquals(
      pg.map((c) => c.text),
      [" a /* b */ c "],
      "PostgreSQL nests",
    );
    const lite = commentsOf(sqlite, "/* a /* b */ c */ x");
    assertEquals(
      lite.map((c) => c.text),
      [" a /* b "],
      "SQLite does not",
    );
    assertEquals(textsOf(sqlite, "/* a /* b */ c */ x"), ["c", "*", "/", "x"]);
    assertEquals(commentsOf(ansi, "--x\r\ny")[0]?.text, "x", "a line comment ends before \\r\\n");
    assertEquals(commentsOf(ansi, "/**/")[0]?.text, "", "an empty block comment");
    assertEquals(commentsOf(ansi, "/*/")[0]?.terminated, false, "/*/ is not closed");
  },
);

proves(
  ["0001-sql-lang FR-010"],
  "a block comment that begins /*+ is a hint where the dialect has hints, one that begins /*! is a conditional comment where it has those, and elsewhere both are plain block comments",
  () => {
    assertEquals(
      commentsOf(mysqlish, "/*+ INDEX(t i) */ /*!50110 x */ /* y */").map((c) => c.style),
      ["hint", "conditional", "block"],
    );
    assertEquals(
      commentsOf(ansi, "/*+ a */ /*! b */").map((c) => c.style),
      ["block", "block"],
    );
    assertEquals(commentsOf(mysqlish, "/*+ INDEX(t i) */")[0]?.text, "+ INDEX(t i) ", "the + is part of the text");
  },
);

proves(
  ["0001-sql-lang FR-011"],
  "a line comment whose marker needs a space after it is a comment only before white space, a control character or the end of the text",
  () => {
    assertEquals(commentsOf(mysqlish, "-- a").length, 1);
    assertEquals(commentsOf(mysqlish, "--\ta").length, 1);
    assertEquals(commentsOf(mysqlish, "--").length, 1, "the end of the text");
    assertEquals(commentsOf(mysqlish, "--\nx").length, 1);
    assertEquals(commentsOf(mysqlish, "a--b").length, 0);
    const l = lex("a--b", mysqlish.compiled);
    assertEquals(l.tokens.kind.slice(0, -1), [Tok.Word, Tok.Op, Tok.Op, Tok.Word], "the operators they are");
    assertEquals(commentsOf(ansi, "a--b").length, 1, "elsewhere there is no condition");
  },
);

proves(
  ["0001-sql-lang FR-012"],
  "a comment's place is given: how many tokens precede it, whether it is on a line of its own, whether a blank line follows, and whether it is closed",
  () => {
    const text = "-- one\nselect 1 -- two\n\n/* three */ x\n/* four */\n\n-- five";
    const l = lex(text, ansi.compiled);
    const c = allComments(l.comments, text);
    assertEquals(
      c.map((x) => x.text.trim()),
      ["one", "two", "three", "four", "five"],
    );
    assertEquals(
      c.map((x) => x.before),
      [0, 2, 2, 3, 3],
    );
    assertEquals(
      c.map((x) => x.ownLine),
      [true, false, true, true, true],
    );
    assertEquals(
      c.map((x) => x.blankAfter),
      [false, true, false, true, true],
    );
    assertEquals(
      c.map((x) => x.index),
      [0, 1, 2, 3, 4],
    );
    assertEquals(kindAt(l.tokens, 2), Tok.Word, "the token after the third comment is x");
    assertEquals(text.slice(l.tokens.start[2], l.tokens.end[2]), "x");
    const two = commentsOf(ansi, "/* a */ /* b */ x");
    assertEquals(
      two.map((x) => x.ownLine),
      [true, false],
      "the second shares the first's line",
    );
    const open = commentsOf(ansi, "select 1 /* never");
    assertEquals(open[0]?.terminated, false);
    assertEquals(commentsOf(ansi, "-- a")[0]?.terminated, true);
    assertEquals(commentsOf(ansi, "x /* a */\r\n\r\ny")[0]?.blankAfter, true, "CRLF blank line");
  },
);

proves(["0001-sql-lang FR-013"], "what looks like a comment inside a string, a quoted identifier or another comment is not one", () => {
  assertEquals(
    commentsOf(ansi, "'-- no' \"/* no */\" -- yes /* no */").map((c) => c.text),
    [" yes /* no */"],
  );
  assertEquals(
    commentsOf(ansi, "/* a -- b */ c").map((c) => c.text),
    [" a -- b "],
  );
  assertEquals(
    commentsOf(postgres, "$$ -- no /* no */ $$ x -- yes").map((c) => c.text),
    [" yes"],
  );
  assertEquals(
    commentsOf(sqlite, "[a -- b] x -- yes").map((c) => c.text),
    [" yes"],
  );
  assertEquals(
    commentsOf(mysqlish, "'# no' # yes").map((c) => c.text),
    [" yes"],
  );
});

proves(
  ["0001-sql-lang FR-014"],
  "a position is found from an offset: lines end at \\n, \\r\\n or a lone \\r, line and column count from 1 in UTF-16 units, and an offset outside the text is placed at its nearest end",
  () => {
    const text = "a\nbc\r\nd\re😀f";
    const index = lineIndex(text);
    assertEquals(index.starts, [0, 2, 6, 8]);
    assertEquals(positionAt(index, 0), { line: 1, column: 1, offset: 0 });
    assertEquals(positionAt(index, 1), { line: 1, column: 2, offset: 1 });
    assertEquals(positionAt(index, 2), { line: 2, column: 1, offset: 2 });
    assertEquals(positionAt(index, 4), { line: 2, column: 3, offset: 4 });
    assertEquals(positionAt(index, 6), { line: 3, column: 1, offset: 6 });
    assertEquals(positionAt(index, 8), { line: 4, column: 1, offset: 8 });
    assertEquals(positionAt(index, 11), { line: 4, column: 4, offset: 11 }, "the emoji is two units");
    assertEquals(positionAt(index, -5), { line: 1, column: 1, offset: 0 });
    assertEquals(positionAt(index, 999), { line: 4, column: 5, offset: text.length });
    assertEquals(lineIndex("").starts, [0]);
    const l = lex("select 1\n-- note", ansi.compiled);
    const c = allComments(l.comments, l.text)[0];
    assert(c !== undefined);
    assertEquals(positionAt(lineIndex(l.text), c.span.start), { line: 2, column: 1, offset: 9 });
  },
);
