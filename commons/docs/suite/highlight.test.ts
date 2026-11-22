/**
 * The highlighter (commons 0011-documentation FR-017, FR-037): code is coloured when the site is built with Shiki, for each language the site shows, in a colour for the light scheme and one for the dark; the same text gives the same
 * runs however many times it is read and whichever grammar was read first; text and diagrams are left whole.
 *
 * @module
 */
import { assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { highlightedHtml, runs } from "../src/highlight.ts";
import type { Lang } from "../src/model.ts";

/** The coloured runs of a text, as `text|light|dark`, those in the theme's own text left out. */
const coloured = (code: string, lang: Lang): string[] => runs(code, lang).flatMap((line) => line.filter((r) => r.light !== undefined).map((r) => `${r.text}|${r.light}|${r.dark}`));

proves(["0011-documentation FR-037"], "each language of the site is cut into its tokens, each with its colour in the light and in the dark scheme", () => {
  assertEquals(coloured('const n: Count = f("x"); // c', "ts"), ["const|#8839EF|#CBA6F7", ":|#179299|#94E2D5", " Count |#DF8E1D|#F9E2AF", "=|#179299|#94E2D5", "f|#1E66F5|#89B4FA", '"x"|#40A02B|#A6E3A1', ";|#7C7F93|#9399B2", "// c|#7C7F93|#9399B2"]);
  assertEquals(coloured("SELECT 1 FROM t -- c", "sql"), ["SELECT|#8839EF|#CBA6F7", "1|#FE640B|#FAB387", "FROM|#8839EF|#CBA6F7", "-- c|#7C7F93|#9399B2"]);
  assertEquals(coloured('echo "$HOME" # c', "sh").at(0), "echo|#D20F39|#F38BA8");
  assertEquals(coloured('echo "$HOME" # c', "sh").at(-1), "# c|#7C7F93|#9399B2");
  assertEquals(coloured('[a]\nb = "x" # c', "toml"), ["[|#7C7F93|#9399B2", "]|#7C7F93|#9399B2", "=|#179299|#94E2D5", '"x"|#40A02B|#A6E3A1', "# c|#7C7F93|#9399B2"]);
  assertEquals(coloured('{"a": [1, true, null]}', "json"), ['{"|#7C7F93|#9399B2', "a|#1E66F5|#89B4FA", '":|#7C7F93|#9399B2', "[|#7C7F93|#9399B2", "1|#FE640B|#FAB387", ",|#7C7F93|#9399B2", "true|#FE640B|#FAB387", ",|#7C7F93|#9399B2", "null|#FE640B|#FAB387", "]}|#7C7F93|#9399B2"]);
  assertEquals(coloured('pm:x a pm:Y ; rdfs:label "y"@en .', "turtle").includes('"y"|#40A02B|#A6E3A1'), true);
  assertEquals(coloured("a: 1\nb: [x, y] # c", "yaml"), ["a|#1E66F5|#89B4FA", ":|#179299|#94E2D5", "1|#FE640B|#FAB387", "b|#1E66F5|#89B4FA", ":|#179299|#94E2D5", "[|#7C7F93|#9399B2", "x|#40A02B|#A6E3A1", ",|#7C7F93|#9399B2", "y|#FE640B|#FAB387", "]|#7C7F93|#9399B2", "# c|#7C7F93|#9399B2"]);
});

proves(["0011-documentation FR-037"], "the same text gives the same runs every time, so that the first reading of a grammar is no different from the next; nothing is lost; text and diagram sources are plain and escaped", () => {
  const code = 'export const x = f("a<b"); // c\n';
  const first = runs(code, "ts");
  assertEquals(runs(code, "ts"), first);
  assertEquals(runs(code, "ts").map((l) => l.map((r) => r.text).join("")).join("\n"), code.replace(/\n$/, "\n"));
  assertEquals(highlightedHtml("<b> & x", "text"), "&lt;b&gt; &amp; x");
  assertEquals(highlightedHtml("a --> b", "mermaid"), "a --&gt; b");
  const html = highlightedHtml('const a = "<";', "ts");
  assertStringIncludes(html, '<span class="t" style="--l:#8839EF;--d:#CBA6F7">const</span>');
  assertStringIncludes(html, "&lt;");
  assertEquals(html.includes("<script"), false);
});

proves(["0001-docs FR-024"], "SQL is coloured by the lexer of the SQL language library: a keyword, a call, a string with a dollar quote, a parameter and a comment each with its colour, a word in a string or a comment is none, nothing is lost, and text the lexer cannot read is left to Shiki", () => {
  assertEquals(coloured("SELECT count(*) FROM t WHERE a = $1 AND b = 'FROM x' -- WHERE c", "sql"), [
    "SELECT|#8839EF|#CBA6F7", "count|#1E66F5|#89B4FA", "FROM|#8839EF|#CBA6F7", "WHERE|#8839EF|#CBA6F7", "$1|#E64553|#EBA0AC", "AND|#8839EF|#CBA6F7", "'FROM x'|#40A02B|#A6E3A1", "-- WHERE c|#7C7F93|#9399B2",
  ]);
  assertEquals(coloured("SELECT $$it's$$;", "sql"), ["SELECT|#8839EF|#CBA6F7", "$$it's$$|#40A02B|#A6E3A1"]);
  const code = "SELECT a,\n       b -- two\n  FROM t;\n";
  assertEquals(runs(code, "sql").map((l) => l.map((r) => r.text).join("")).join("\n"), code);
  assertEquals(runs(code, "sql").length, 4);
  const open = "SELECT 'not closed";
  assertEquals(runs(open, "sql").map((l) => l.map((r) => r.text).join("")).join("\n"), open);
  assertStringIncludes(highlightedHtml("SELECT 1 < 2", "sql"), "&lt;");
});
