/**
 * The highlighter (commons 0011-documentation FR-017): code is coloured when the site is built, for each language it shows.
 *
 * @module
 */
import { assertEquals, proves } from "../../ts/runtime/test.ts";
import { tokens } from "../highlight.ts";

const classes = (code: string, lang: Parameters<typeof tokens>[1]): string[] => tokens(code, lang).filter((t) => t.cls !== "plain" && t.cls !== "punct").map((t) => `${t.cls}:${t.text}`);

proves(["0011-documentation FR-017"], "TypeScript, SQL, shell and Turtle are cut into their tokens; text is left whole", () => {
  assertEquals(classes('const n: Count = f("x"); // c', "ts"), ["keyword:const", "type:Count", "function:f", 'string:"x"', "comment:// c"]);
  assertEquals(classes("SELECT 1 FROM t -- c", "sql"), ["keyword:SELECT", "number:1", "keyword:FROM", "comment:-- c"]);
  assertEquals(classes('echo "$HOME" # c', "sh"), ["keyword:echo", 'string:"$HOME"', "comment:# c"]);
  assertEquals(classes('pm:x a pm:Y ; rdfs:label "y"@en .', "turtle"), ["keyword:a", 'string:"y"']);
  assertEquals(tokens("<b>", "text"), [{ cls: "plain", text: "<b>" }]);
  assertEquals(tokens("a  b", "ts").map((t) => t.text).join(""), "a  b", "nothing is lost");
});
