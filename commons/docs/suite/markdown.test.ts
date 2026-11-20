/**
 * The Markdown subset (commons 0011-documentation FR-016): every construct read into the page model, and anything else kept as its text.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { inlines, markdown, plainContext } from "../markdown.ts";

proves(["0011-documentation FR-016"], "paragraphs, headings, lists, fences and tables become blocks", () => {
  const bs = markdown(
    "## A title\n\nSome text\non two lines.\n\n- one\n- two\n  - nested\n\n1. first\n\n```ts\nconst a = 1;\n```\n\n| A | B |\n|---|---|\n| `x` | y |\n",
    plainContext,
  );
  assertEquals(bs.map((b) => b.kind), ["heading", "paragraph", "list", "list", "code", "table"]);
  const h = bs[0];
  assertEquals(h?.kind === "heading" ? [h.level, h.id] : [], [2, "a-title"]);
  const l = bs[2];
  assertEquals(l?.kind === "list" ? l.items.map((it) => it.map((b) => b.kind)) : [], [["paragraph"], ["paragraph", "list"]]);
  const c = bs[4];
  assertEquals(c?.kind === "code" ? [c.lang, c.text] : [], ["ts", "const a = 1;"]);
  const ol = bs[3];
  assertEquals(ol?.kind === "list" ? ol.ordered : undefined, true);
});

proves(["0011-documentation FR-016"], "code, strong, emphasis, links, autolinks and {@link} become inlines; the rest stays text", () => {
  const xs = inlines("`a` **b** *c* [d](https://e.example) <https://f.example> {@link g | h} ~~i~~ \\*j", plainContext);
  assertEquals(
    xs.map((i) => i.kind),
    ["code", "text", "strong", "text", "emphasis", "text", "link", "text", "link", "text", "code", "text"],
  );
  const last = xs[xs.length - 1];
  assertEquals(last?.kind === "text" ? last.text : "", " ~~i~~ *j");
  const linked = xs[10];
  assertEquals(linked?.kind === "code" ? linked.text : "", "h");
});

proves(["0011-documentation FR-016"], "a snake_case word is not emphasis, and a pipe inside code does not split a cell", () => {
  assertEquals(inlines("party_role_kind", plainContext), [{ kind: "text", text: "party_role_kind" }]);
  const t = markdown("| A |\n|---|\n| `a \\| b` |\n", plainContext)[0];
  assertEquals(t?.kind === "table" ? t.rows[0]?.[0] : undefined, [{ kind: "code", text: "a | b" }]);
});
