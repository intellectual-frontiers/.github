/**
 * The lexer of the SQL language core (commons data 0065-sql-lang): for any text it returns parts from which the text can be put back and never throws; its tokens are columns of a closed set of kinds
 * with the keyword found without regard to case; what it cannot read is a value and it goes on; strings, quoted identifiers, numbers, parameters and operators are read as each dialect writes them.
 *
 * Spec: 0065-sql-lang FR-004, FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import {
  ansi,
  compileLexical,
  type Dialect,
  defineDialect,
  describeLexError,
  idAt,
  keywordId,
  kindAt,
  lex,
  operatorId,
  Tok,
  ParamStyleId,
} from "@intellectual-frontiers/data/sql/lang";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/lang/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";
import { CORPUS, DIALECTS, kindsOf, textsOf, wholeness } from "./lang-fixture.ts";

const FRAGMENTS = [
  "select",
  "SELECT",
  "from",
  "where",
  "t",
  "x1",
  "naïve",
  "_a",
  "$",
  "$$",
  "$a$",
  "$1",
  "?",
  "?1",
  ":n",
  "@v",
  "::",
  "->",
  "->>",
  "<=",
  "<>",
  "||",
  "-",
  "--",
  "- -",
  "/*",
  "*/",
  "/**/",
  "/*+",
  "/*!",
  "#",
  "//",
  "#!",
  "'",
  "''",
  "'a'",
  "'it''s'",
  "E'a\\'b'",
  '"',
  '""',
  '"q"',
  "`",
  "[",
  "]",
  "[x y]",
  "(",
  ")",
  "{",
  "}",
  ",",
  ";",
  ".",
  ".5",
  "1",
  "1.5",
  "1e9",
  "1e",
  "1_0",
  "0x1F",
  "0b1",
  " ",
  "  ",
  "\n",
  "\r\n",
  "\r",
  "\t",
  " ",
  "﻿",
  "\\",
  "\u0000",
  "é",
  "\ud800",
  "😀",
  "=",
  "*",
  "%",
  "^",
  "&",
  "|",
  "~",
  "!",
  "<",
  ">",
  "+",
  "@",
  ":",
];

proves(
  ["0065-sql-lang FR-004"],
  "for any text and any dialect the lexer does not throw and ends, and every character is in one token, one comment or white space, in order, so the text can be put back",
  () => {
    for (const d of DIALECTS) {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...FRAGMENTS), { maxLength: 40 }).map((a) => a.join("")),
          (text) => {
            const w = wholeness(lex(text, d.compiled));
            assert(w === undefined, `${d.name} ${JSON.stringify(text)}: ${w}`);
          },
        ),
        { numRuns: 400 },
      );
      fc.assert(
        fc.property(fc.string({ unit: "binary", maxLength: 60 }), (text) => {
          const w = wholeness(lex(text, d.compiled));
          assert(w === undefined, `${d.name} ${JSON.stringify(text)}: ${w}`);
        }),
        { numRuns: 300 },
      );
      assertEquals(wholeness(lex(CORPUS, d.compiled)), undefined, `${d.name}: the corpus`);
      assertEquals(wholeness(lex("", d.compiled)), undefined);
    }
  },
);

proves(
  ["0065-sql-lang FR-005"],
  "tokens are columns of a closed set of kinds that end with the end of the text, a keyword is found without regard to case, and a word with a character outside ASCII is never a keyword",
  () => {
    const l = lex("SeLeCt é, sélect, naïve FROM t", ansi.compiled);
    assertEquals(l.tokens.kind.length, l.tokens.start.length);
    assertEquals(l.tokens.kind.length, l.tokens.id.length);
    assertEquals(kindAt(l.tokens, l.tokens.kind.length - 1), Tok.Eof);
    assertEquals(kindAt(l.tokens, 999), Tok.Eof, "past the last token is the end of the text");
    assertEquals(idAt(l.tokens, 0), keywordId(ansi.compiled, "select"));
    assert(idAt(l.tokens, 0) !== 0);
    assertEquals(idAt(l.tokens, 1), 0, "é");
    assertEquals(idAt(l.tokens, 3), 0, "sélect");
    assertEquals(idAt(l.tokens, 5), 0, "naïve");
    assertEquals(idAt(l.tokens, 6), keywordId(ansi.compiled, "FROM"));
    assertEquals(idAt(l.tokens, 7), 0, "t");
    assertEquals(keywordId(ansi.compiled, "no-such"), undefined);
    assert(textsOf(ansi, "select a.b").join("|") === "select|a|.|b");
  },
);

proves(
  ["0065-sql-lang FR-006"],
  "what the dialect cannot read is an error value with its span and the lexer goes on: an unclosed comment, string or quoted identifier ends at the end of the text, and an unreadable character is a token of the error kind",
  () => {
    const s = lex("select 'abc", ansi.compiled);
    assertEquals(
      s.errors.map((e) => e.kind),
      ["unterminated-string"],
    );
    assertEquals(kindAt(s.tokens, 1), Tok.String);
    assertEquals(s.tokens.end[1], 11);
    const q = lex('select "abc', ansi.compiled);
    assertEquals(
      q.errors.map((e) => e.kind),
      ["unterminated-identifier"],
    );
    const c = lex("select 1 /* never closed", ansi.compiled);
    assertEquals(
      c.errors.map((e) => e.kind),
      ["unterminated-comment"],
    );
    assertEquals(c.comments.end[0], 24);
    const u = lex("select \\ 1", ansi.compiled);
    assertEquals(
      u.errors.map((e) => e.kind),
      ["unexpected-character"],
    );
    assertEquals(kindAt(u.tokens, 1), Tok.Error);
    assertEquals(kindAt(u.tokens, 2), Tok.Number, "it went on");
    const e0 = u.errors[0];
    assert(e0 !== undefined && describeLexError(e0).includes("not part of the language"));
    assertEquals(wholeness(u), undefined);
  },
);

proves(
  ["0065-sql-lang FR-007"],
  "strings and quoted identifiers are read as their dialect writes them: doubled quotes, backslashes, prefixes, long quotes and dollar quotes",
  () => {
    assertEquals(textsOf(ansi, "'it''s' 'x'"), ["'it''s'", "'x'"]);
    assertEquals(textsOf(ansi, "'a\\' b"), ["'a\\'", "b"], "ansi: a backslash is not an escape");
    assertEquals(textsOf(postgres, "E'a\\'b' 'c'"), ["E'a\\'b'", "'c'"], "E'' has backslash escapes");
    assertEquals(textsOf(postgres, "'a\\' b"), ["'a\\'", "b"], "a plain string does not");
    assertEquals(textsOf(postgres, "$$ it's 'ok' $$ x"), ["$$ it's 'ok' $$", "x"]);
    assertEquals(textsOf(postgres, "$tag$ $$ $tag$ x"), ["$tag$ $$ $tag$", "x"]);
    assertEquals(textsOf(postgres, "U&'d\\0061t' x"), ["U&'d\\0061t'", "x"]);
    assertEquals(kindsOf(ansi, "X'ff' N'x' b'1'"), [Tok.String, Tok.String, Tok.String]);
    assertEquals(kindsOf(ansi, "E'x'"), [Tok.Word, Tok.String], "ansi has no E prefix");
    assertEquals(textsOf(ansi, '"a""b" "c"'), ['"a""b"', '"c"']);
    assertEquals(kindsOf(sqlite, '`a` [b c] "d"'), [Tok.QuotedIdent, Tok.QuotedIdent, Tok.QuotedIdent]);
    assertEquals(kindsOf(ansi, "[b]"), [Tok.LBracket, Tok.Word, Tok.RBracket], "ansi has no bracket quotes");
    const triple = defineDialect({
      name: "triple",
      extends: ansi,
      lexical: (b) => ({
        ...b,
        strings: [...b.strings, { open: "'''", close: "'''", escape: "none" }, { open: '"""', close: '"""', escape: "none" }],
      }),
    });
    assert(triple.kind === "ok");
    assertEquals(textsOf(triple.value, "'''a ' b''' 'c' \"\"\"d\"\"\""), ["'''a ' b'''", "'c'", '"""d"""']);
    const raw = defineDialect({
      name: "raw",
      extends: ansi,
      lexical: (b) => ({ ...b, prefixes: [{ prefix: "R", escape: "none" }], strings: [{ open: "'", close: "'", escape: "backslash" }] }),
    });
    assert(raw.kind === "ok");
    assertEquals(textsOf(raw.value, "'a\\'b' r'a\\' x"), ["'a\\'b'", "r'a\\'", "x"]);
    assertEquals(
      lex("$a$ never", postgres.compiled).errors.map((e) => e.kind),
      ["unterminated-string"],
    );
  },
);

proves(
  ["0065-sql-lang FR-008"],
  "numbers have fractions, exponents, an initial point, radix prefixes and underscores where the dialect says; parameters come in the styles of the dialect; an operator is the longest at its place",
  () => {
    assertEquals(textsOf(ansi, "1.5e-3 .5 1. 42 1e 2e+x"), ["1.5e-3", ".5", "1.", "42", "1", "e", "2", "e", "+", "x"]);
    assertEquals(textsOf(ansi, "0x1F"), ["0", "x1F"], "ansi: no radix");
    assertEquals(textsOf(sqlite, "0x1F 0b1"), ["0x1F", "0b1"]);
    assertEquals(textsOf(postgres, "1_000 1__0"), ["1_000", "1", "__0"]);
    assertEquals(
      textsOf(ansi, "t.a t.1"),
      ["t", ".", "a", "t", ".1"],
      "a point before a digit begins a number; a parser decides what t.1 is",
    );
    const p = (d: Dialect, text: string): readonly number[] => {
      const l = lex(text, d.compiled);
      const out: number[] = [];
      for (let i = 0; i < l.tokens.kind.length - 1; i++) out.push(kindAt(l.tokens, i) === Tok.Param ? idAt(l.tokens, i) : -1);
      return out;
    };
    assertEquals(textsOf(sqlite, "? ?12 :name @v $x"), ["?", "?12", ":name", "@v", "$x"]);
    assertEquals(p(sqlite, "? ?12 :name @v $x"), [
      ParamStyleId.Question,
      ParamStyleId.Question,
      ParamStyleId.ColonName,
      ParamStyleId.AtName,
      ParamStyleId.DollarName,
    ]);
    assertEquals(p(postgres, "$1 $12 a$b"), [ParamStyleId.DollarNumber, ParamStyleId.DollarNumber, -1], "PostgreSQL: $ inside a word");
    assertEquals(textsOf(postgres, "a$b $1"), ["a$b", "$1"]);
    assertEquals(p(duckdb, "$1 $name ?"), [ParamStyleId.DollarNumber, ParamStyleId.DollarName, ParamStyleId.Question]);
    assertEquals(textsOf(postgres, "a::int"), ["a", "::", "int"]);
    assertEquals(textsOf(postgres, "a->>'b' a->'b'"), ["a", "->>", "'b'", "a", "->", "'b'"]);
    assertEquals(textsOf(ansi, "a<=b<>c<d"), ["a", "<=", "b", "<>", "c", "<", "d"]);
    assertEquals(textsOf(postgres, "a ? b"), ["a", "?", "b"], "PostgreSQL: ? is an operator");
    assertEquals(textsOf(sqlite, "a:b"), ["a", ":b"], "SQLite: a colon before a name is a parameter");
    assertEquals(textsOf(duckdb, "a::b"), ["a", "::", "b"]);
    const op = operatorId(postgres.compiled, "::");
    assert(op !== undefined && op === idAt(lex("::", postgres.compiled).tokens, 0));
    assertEquals(operatorId(ansi.compiled, "::"), undefined);
    for (const d of DIALECTS) assertEquals(compileLexical(d.lexical).kind, "ok");
  },
);
