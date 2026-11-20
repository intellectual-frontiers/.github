/**
 * The HTML of the site (commons 0011-documentation FR-017, FR-019): links relative to the page, nothing asked of another host, the text
 * people read on white, every case of the page model written, and the fixture's pages what is committed under `golden/`.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertMatch, assertStringIncludes, proves } from "../../ts/runtime/test.ts";
import { block, document, relative } from "../emit/html.ts";
import { readApi } from "../extract/api.ts";
import type { Block, Page } from "../model.ts";
import { apiPages, registerApi } from "../pages/api.ts";
import { fixtureArea, freshBuild, golden, ROOT } from "./helpers.ts";

const every: readonly Block[] = [
  { kind: "heading", level: 2, id: "h", text: [{ kind: "text", text: "H" }] },
  { kind: "paragraph", inlines: [{ kind: "strong", children: [{ kind: "text", text: "<b>" }] }] },
  { kind: "meta", inlines: [{ kind: "emphasis", children: [{ kind: "code", text: "x" }] }] },
  { kind: "list", ordered: true, items: [[{ kind: "paragraph", inlines: [{ kind: "text", text: "i" }] }]] },
  { kind: "code", lang: "sql", text: "SELECT 1", title: "q.sql" },
  { kind: "table", head: [[{ kind: "text", text: "A" }]], rows: [[[{ kind: "link", href: { kind: "page", path: "b/c.html", anchor: "d" }, children: [{ kind: "text", text: "e" }] }]]] },
  { kind: "callout", tone: "limit", title: "T", blocks: [] },
  { kind: "entry", id: "e", name: "e", badges: [{ text: "const", tone: "neutral" }], signature: "const e: 1", blocks: [] },
  { kind: "tabs", id: "t", tabs: [{ label: "One", blocks: [] }, { label: "Two", blocks: [] }] },
  { kind: "diagram", source: "erDiagram", caption: "C" },
  { kind: "cards", cards: [{ title: "Card", href: { kind: "external", url: "https://example.com" }, text: [] }] },
  { kind: "badges", badges: [{ text: "b", tone: "good" }] },
  { kind: "tree", nodes: [{ label: "a", children: [{ label: "b", children: [] }] }] },
];

proves(["0011-documentation FR-017"], "every case of the page model is written, text escaped and links relative to the page", () => {
  const html = every.map((b) => block(b, "a/x.html")).join("\n");
  for (const tag of ["<h2", "<p>", 'class="meta"', "<ol>", "tk-keyword", "<table>", "callout-limit", 'class="entry"', 'role="tablist"', 'class="mermaid"', 'class="cards"', "badge-good", 'class="tree"']) {
    assertStringIncludes(html, tag);
  }
  assertStringIncludes(html, "&lt;b&gt;");
  assertStringIncludes(html, 'href="../b/c.html#d"');
  assertEquals([relative("index.html", "specs/a.html"), relative("api/k/x.html", "index.html"), relative("specs/a.html", "specs/b.html")], ["specs/a.html", "../../index.html", "b.html"]);
});

const page = (blocks: readonly Block[]): Page => ({ path: "api/k/x.html", title: "X", description: "D", section: "api", group: "G", order: 1, blocks });

proves(["0011-documentation FR-017"], "a page asks nothing of another host, loads Mermaid only where it has a diagram, and reads on white", async () => {
  const site = { name: "N", repository: "https://github.com/x/y", pages: [page([])] };
  const plain = document(page([]), site);
  const withDiagram = document(page([{ kind: "diagram", source: "erDiagram", caption: "C" }]), site);
  for (const html of [plain, withDiagram]) {
    for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = m[1] ?? "";
      assert(!/^(https?:)?\/\//.test(url) || url === site.repository, `a page asks ${url} of another host`);
    }
  }
  assert(!plain.includes("mermaid.min.js") && withDiagram.includes('src="../../assets/mermaid.min.js"'));
  const css = await fs.readTextFile(path.join(ROOT, "commons/docs/theme/site.css"));
  assertMatch(css, /--page: #ffffff;/);
  assertMatch(css, /\.content \{ background: var\(--page\)/);
  assert(!/prefers-color-scheme: dark/.test(css), "the site is light only");
});

proves(["0011-documentation FR-019"], "the fixture's pages are what is committed", async () => {
  const b = freshBuild();
  const area = fixtureArea("fixture", "mod.ts");
  const api = await readApi(ROOT, [{ slug: "fixture", entryPoints: ["commons/docs/suite/fixture/mod.ts"] }]);
  apiPages(b, [area], api, registerApi(b, [area], api));
  const site = { name: "IF Commons", repository: "https://github.com/intellectual-frontiers/.github", pages: b.pages };
  for (const p of b.pages) await golden(p.path.replace(/\//g, "_"), document(p, site));
});
