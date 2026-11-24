/**
 * The Markdown twin of a page and the index for a program (commons 0011-documentation FR-028): every block and inline of the page model has a form in Markdown, links to pages go to their twins, the same page gives the
 * same text, and a site is written with a `.md` beside each `.html`, `llms.txt` at its root and the files a lens adds.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { llmsIndex, markdownOf, twinOf } from "../src/emit/markdown.ts";
import type { Page } from "../src/model.ts";
import { writeSite } from "../src/site.ts";
import { CONFIG, siteOnce } from "./helpers.ts";

const page: Page = {
  path: "models/arca/person.html",
  title: "person",
  description: "A human being.",
  section: "models",
  group: "Arca",
  order: 1,
  blocks: [
    { kind: "heading", level: 2, id: "columns", text: [{ kind: "text", text: "Columns" }] },
    { kind: "paragraph", inlines: [{ kind: "text", text: "See " }, { kind: "link", href: { kind: "page", path: "models/arca/party.html", anchor: "party" }, children: [{ kind: "code", text: "party" }] }, { kind: "text", text: " and " }, { kind: "strong", children: [{ kind: "text", text: "bold" }] }, { kind: "emphasis", children: [{ kind: "text", text: "em" }] }] },
    { kind: "meta", inlines: [{ kind: "text", text: "owner: if" }] },
    { kind: "list", ordered: false, items: [[{ kind: "paragraph", inlines: [{ kind: "text", text: "one" }] }], [{ kind: "paragraph", inlines: [{ kind: "text", text: "two" }] }]] },
    { kind: "code", lang: "sql", text: "SELECT 1;", title: "SQL" },
    { kind: "table", head: [[{ kind: "text", text: "a" }], [{ kind: "text", text: "b|c" }]], rows: [[[{ kind: "text", text: "1" }], [{ kind: "text", text: "2" }]]] },
    { kind: "callout", tone: "limit", title: "Limit", blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "careful" }] }] },
    { kind: "entry", id: "given", name: "given_name", badges: [{ text: "text", tone: "neutral" }], signature: "given: string", blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "A first name" }] }] },
    { kind: "tabs", id: "t", tabs: [{ label: "PostgreSQL", blocks: [{ kind: "code", lang: "sql", text: "CREATE TABLE p ();" }] }] },
    { kind: "diagram", source: "graph TD; a-->b", caption: "The graph" },
    { kind: "cards", cards: [{ title: "Party", href: { kind: "external", url: "https://example.org" }, text: [{ kind: "text", text: "the party" }], badges: [{ text: "model", tone: "info" }], children: [{ title: "Child", href: { kind: "page", path: "x.html" }, text: [] }] }] },
    { kind: "badges", badges: [{ text: "personal", tone: "warn" }] },
    { kind: "tree", nodes: [{ label: "root", note: [{ kind: "text", text: "n" }], children: [{ label: "leaf", children: [] }] }] },
  ],
};

proves(["0011-documentation FR-028"], "every block and inline has a Markdown form, links to pages go to their twins, and the same page gives the same text", () => {
  const md = markdownOf(page);
  assertEquals(md, markdownOf(page));
  assertStringIncludes(md, "# person\n\nA human being.\n");
  assertStringIncludes(md, "[`party`](../../models/arca/party.md#party) and **bold***em*");
  assertStringIncludes(md, "*owner: if*");
  assertStringIncludes(md, "- one\n- two");
  assertStringIncludes(md, "*SQL*\n\n```sql\nSELECT 1;\n```");
  assertStringIncludes(md, "| a | b\\|c |\n| --- | --- |\n| 1 | 2 |");
  assertStringIncludes(md, "> **Limit**\n> careful");
  assertStringIncludes(md, "### given_name (text)\n\n```ts\ngiven: string\n```");
  assertStringIncludes(md, "#### PostgreSQL\n\n```sql\nCREATE TABLE p ();\n```");
  assertStringIncludes(md, "```mermaid\ngraph TD; a-->b\n```");
  assertStringIncludes(md, "- [Party](https://example.org) (model): the party\n  - [Child](../../x.md): ");
  assertStringIncludes(md, "`personal`");
  assertStringIncludes(md, "- `root`: n\n  - `leaf`");
  assert(!/<[a-z]+[ >]/.test(md.replace(/```[\s\S]*?```/g, "")), "no markup outside code");
  assertEquals(twinOf("api/x/index.html"), "api/x/index.md");
});

proves(["0011-documentation FR-028"], "the index for a program lists every page by section with its description and the files a lens adds", () => {
  const out = llmsIndex("Site", [page, { ...page, path: "api/a.html", title: "a", description: "An API", section: "api" }], [["models/arca.json", "the model as JSON"]]);
  assertStringIncludes(out, "# Site\n");
  assertStringIncludes(out, "## api\n\n- [a](api/a.md): An API");
  assertStringIncludes(out, "## models\n\n- [person](models/arca/person.md): A human being.");
  assertStringIncludes(out, "## Data\n\n- [models/arca.json](models/arca.json): the model as JSON");
});

proves(["0011-documentation FR-028"], "a site is written with a .md beside each .html, llms.txt at the root, and the files a lens adds, the same twice", async () => {
  const built = await siteOnce();
  const withFile = { ...built, files: [{ path: "models/demo.json", text: "{}\n", what: "a model" }] };
  const a = await fs.makeTempDir({ prefix: "ifc-docs-twins-" });
  const b = await fs.makeTempDir({ prefix: "ifc-docs-twins-" });
  try {
    await writeSite(CONFIG, withFile, a);
    await writeSite(CONFIG, withFile, b);
    for (const p of built.pages) assert(fs.existsSync(path.join(a, twinOf(p.path))), `${twinOf(p.path)} is written`);
    assertEquals(await fs.readTextFile(path.join(a, "models/demo.json")), "{}\n");
    const llms = await fs.readTextFile(path.join(a, "llms.txt"));
    assertStringIncludes(llms, "models/demo.json");
    assertEquals(llms, await fs.readTextFile(path.join(b, "llms.txt")));
    assertEquals(await fs.readTextFile(path.join(a, "index.md")), await fs.readTextFile(path.join(b, "index.md")));
  } finally {
    await fs.remove(a, { recursive: true });
    await fs.remove(b, { recursive: true });
  }
}, { timeout: 120_000 });
