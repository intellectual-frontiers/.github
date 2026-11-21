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
  assertEquals(coloured('const n: Count = f("x"); // c', "ts"), ["const|#D73A49|#F97583", "n|#005CC5|#79B8FF", ":|#D73A49|#F97583", "Count|#6F42C1|#B392F0", "=|#D73A49|#F97583", "f|#6F42C1|#B392F0", '"x"|#032F62|#9ECBFF', "// c|#6A737D|#6A737D"]);
  assertEquals(coloured("SELECT 1 FROM t -- c", "sql"), ["SELECT|#D73A49|#F97583", "1|#005CC5|#79B8FF", "FROM|#D73A49|#F97583", "-- c|#6A737D|#6A737D"]);
  assertEquals(coloured('echo "$HOME" # c', "sh").at(0), "echo|#005CC5|#79B8FF");
  assertEquals(coloured('echo "$HOME" # c', "sh").at(-1), "# c|#6A737D|#6A737D");
  assertEquals(coloured('[a]\nb = "x" # c', "toml"), ["a|#6F42C1|#B392F0", '"x"|#032F62|#9ECBFF', "# c|#6A737D|#6A737D"]);
  assertEquals(coloured('{"a": [1, true, null]}', "json"), ['"a"|#005CC5|#79B8FF', "1|#005CC5|#79B8FF", "true|#005CC5|#79B8FF", "null|#005CC5|#79B8FF"]);
  assertEquals(coloured('pm:x a pm:Y ; rdfs:label "y"@en .', "turtle").includes('"y"|#032F62|#9ECBFF'), true);
  assertEquals(coloured("a: 1\nb: [x, y] # c", "yaml"), ["a|#22863A|#85E89D", "1|#005CC5|#79B8FF", "b|#22863A|#85E89D", "x|#032F62|#9ECBFF", "y|#005CC5|#79B8FF", "# c|#6A737D|#6A737D"]);
});

proves(["0011-documentation FR-037"], "the same text gives the same runs every time, so that the first reading of a grammar is no different from the next; nothing is lost; text and diagram sources are plain and escaped", () => {
  const code = 'export const x = f("a<b"); // c\n';
  const first = runs(code, "ts");
  assertEquals(runs(code, "ts"), first);
  assertEquals(runs(code, "ts").map((l) => l.map((r) => r.text).join("")).join("\n"), code.replace(/\n$/, "\n"));
  assertEquals(highlightedHtml("<b> & x", "text"), "&lt;b&gt; &amp; x");
  assertEquals(highlightedHtml("a --> b", "mermaid"), "a --&gt; b");
  const html = highlightedHtml('const a = "<";', "ts");
  assertStringIncludes(html, '<span class="t" style="--l:#D73A49;--d:#F97583">const</span>');
  assertStringIncludes(html, "&lt;");
  assertEquals(html.includes("<script"), false);
});

proves(["0001-docs FR-024"], "SQL is coloured by the lexer of the SQL language library: a keyword, a call, a string with a dollar quote, a parameter and a comment each with its colour, a word in a string or a comment is none, nothing is lost, and text the lexer cannot read is left to Shiki", () => {
  assertEquals(coloured("SELECT count(*) FROM t WHERE a = $1 AND b = 'FROM x' -- WHERE c", "sql"), [
    "SELECT|#D73A49|#F97583", "count|#6F42C1|#B392F0", "FROM|#D73A49|#F97583", "WHERE|#D73A49|#F97583", "$1|#E36209|#FFAB70", "AND|#D73A49|#F97583", "'FROM x'|#032F62|#9ECBFF", "-- WHERE c|#6A737D|#6A737D",
  ]);
  assertEquals(coloured("SELECT $$it's$$;", "sql"), ["SELECT|#D73A49|#F97583", "$$it's$$|#032F62|#9ECBFF"]);
  const code = "SELECT a,\n       b -- two\n  FROM t;\n";
  assertEquals(runs(code, "sql").map((l) => l.map((r) => r.text).join("")).join("\n"), code);
  assertEquals(runs(code, "sql").length, 4);
  const open = "SELECT 'not closed";
  assertEquals(runs(open, "sql").map((l) => l.map((r) => r.text).join("")).join("\n"), open);
  assertStringIncludes(highlightedHtml("SELECT 1 < 2", "sql"), "&lt;");
});
