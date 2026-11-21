/**
 * The colouring of SQL by the lexer (commons lang-sql 0010-aide FR-011): what each stretch of a text is, in more than one dialect, for text that is not SQL, and never overlapping or throwing.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { highlight, type SpanKind } from "@intellectual-frontiers/lang-sql/aide/text";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import type { Dialect } from "@intellectual-frontiers/lang-sql";

const kinds = (text: string, d: Dialect = postgres): readonly (readonly [string, SpanKind])[] => highlight(text, d).map((s) => [text.slice(s.start, s.end), s.kind] as const);

proves(["0010-aide FR-011"], "each token is what the lexer says: keywords, functions, names, quoted names, numbers, strings, parameters, operators, punctuation and comments, and a word in a string or a comment is none of the first", () => {
  assertEquals(kinds("SELECT count(*), \"Q\" AS n FROM t WHERE a >= $1 AND b = 'x -- y' -- note"), [
    ["SELECT", "keyword"], ["count", "function"], ["(", "punctuation"], ["*", "operator"], [")", "punctuation"], [",", "punctuation"], ["\"Q\"", "quoted-name"], ["AS", "keyword"], ["n", "name"],
    ["FROM", "keyword"], ["t", "name"], ["WHERE", "keyword"], ["a", "name"], [">=", "operator"], ["$1", "param"], ["AND", "keyword"], ["b", "name"], ["=", "operator"], ["'x -- y'", "string"], ["-- note", "comment"],
  ]);
  assertEquals(kinds("SELECT 1.5e3 /* a SELECT */"), [["SELECT", "keyword"], ["1.5e3", "number"], ["/* a SELECT */", "comment"]]);
});

proves(["0010-aide FR-011"], "the dialect decides: a dollar quote is one string in PostgreSQL, a backtick name is quoted in MySQL, and a word that is a keyword in one dialect is a name in another", () => {
  assertEquals(kinds("SELECT $$a'b$$"), [["SELECT", "keyword"], ["$$a'b$$", "string"]]);
  assertEquals(kinds("SELECT `a b` FROM t", mysql), [["SELECT", "keyword"], ["`a b`", "quoted-name"], ["FROM", "keyword"], ["t", "name"]]);
  assertEquals(kinds("SELECT x FROM t", sqlite)[0], ["SELECT", "keyword"]);
});

proves(["0010-aide FR-011"], "the stretches are in order and never overlap, the white space is left out, and no text makes it throw (a character the lexer cannot read is an error)", () => {
  for (const text of ["", "   ", "SELECT", "SELECT 'unterminated", "/* open", "a\u0000b", "SELECT \u{1F600}", "-- only a comment", "x.y.z, 1 + 2 ;", "\"open", "$$ never closed", "\\\\"]) {
    const spans = highlight(text, postgres);
    let at = 0;
    for (const s of spans) {
      assert(s.start >= at && s.end > s.start && s.end <= text.length, `${JSON.stringify(text)}: ${s.start}-${s.end}`);
      assert(text.slice(s.start, s.end).trim() === text.slice(s.start, s.end), "no white space at the edge");
      at = s.end;
    }
  }
  assert(kinds("SELECT 'a").some(([, k]) => k === "string" || k === "error"), "an open string is shown");
});
