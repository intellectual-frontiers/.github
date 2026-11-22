// Spec: 0001-docs FR-036
/**
 * A page of every kind of block, as the sample the stylesheet is made from and checked against (docs 0001-docs FR-036): `tools/fumadocs-css.mjs` reads the classes of the pages it writes, beside those of a built site, so that a block the site's own pages do not
 * happen to use still has its rules, and `suite/look.test.ts` holds that every class of these pages has a rule. Run as a program it writes the pages into a directory:
 *
 *   bun tools/fumadocs-fixture.ts DIRECTORY
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { document } from "../src/emit/html.ts";
import type { Block, Page } from "../src/model.ts";

const blocks: Block[] = [
  { kind: "heading", level: 2, id: "one", text: [{ kind: "text", text: "One" }] },
  { kind: "heading", level: 3, id: "sub", text: [{ kind: "text", text: "Sub" }] },
  { kind: "paragraph", inlines: [{ kind: "text", text: "p " }, { kind: "code", text: "x" }, { kind: "code", text: "y".repeat(60) }, { kind: "strong", children: [{ kind: "text", text: "s" }] }, { kind: "link", href: { kind: "external", url: "https://e.test" }, children: [{ kind: "text", text: "l" }] }] },
  { kind: "meta", inlines: [{ kind: "text", text: "m" }] },
  { kind: "list", ordered: false, items: [[{ kind: "paragraph", inlines: [{ kind: "text", text: "i" }] }]] },
  { kind: "list", ordered: true, items: [[{ kind: "paragraph", inlines: [{ kind: "text", text: "i" }] }]] },
  { kind: "code", lang: "ts", text: "const a = 1;", title: "a.ts" },
  { kind: "code", lang: "sh", text: "echo 1" },
  { kind: "table", head: [[{ kind: "text", text: "h" }]], rows: [[[{ kind: "text", text: "c" }]]], filter: "Filter", compact: true },
  { kind: "callout", tone: "note", title: "Note", blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "n" }] }] },
  { kind: "callout", tone: "limit", title: "Limit", blocks: [] },
  { kind: "callout", tone: "warn", title: "Warn", blocks: [] },
  { kind: "entry", id: "e", name: "e", badges: [{ text: "b", tone: "good" }], signature: "type A = 1", blocks: [{ kind: "paragraph", inlines: [{ kind: "text", text: "d" }] }] },
  { kind: "entry", id: "f", name: "f", badges: [], signature: `type B = ${"x | ".repeat(150)}y`, blocks: [] },
  { kind: "tabs", id: "t", tabs: [{ label: "One", blocks: [] }, { label: "Two", blocks: [] }] },
  { kind: "diagram", source: "flowchart LR\n A --> B", caption: "A diagram" },
  { kind: "cards", cards: [{ title: "C", href: { kind: "page", path: "s/a.html" }, text: [{ kind: "text", text: "t" }], badges: [{ text: "k", tone: "info" }], children: [{ title: "K", href: { kind: "page", path: "s/b.html" }, text: [] }] }] },
  { kind: "badges", badges: [{ text: "n", tone: "neutral" }, { text: "w", tone: "warn" }] },
  { kind: "stats", items: [{ value: "1", label: "a" }, { value: "2", label: "b", href: { kind: "page", path: "s/a.html" } }] },
  { kind: "trend", label: "T", values: [1, 2, 3], unit: "x" },
  { kind: "tree", nodes: [{ label: "d", children: [{ label: "f", children: [], note: [{ kind: "text", text: "n" }] }] }] },
];
/** The pages of the sample: three, the middle one with a block of every kind. */
export const FIXTURE_PAGES: Page[] = ["a", "b", "c"].map((n, i) => ({ path: `s/${n}.html`, title: n.toUpperCase(), description: n, section: "specs", group: "Group", order: i, badges: [{ text: "x", tone: "good" }], blocks: i === 1 ? blocks : [{ kind: "heading", level: 2, id: "one", text: [{ kind: "text", text: "One" }] }, { kind: "heading", level: 2, id: "two", text: [{ kind: "text", text: "Two" }] }] }));
/** What the sample's pages share. */
export const FIXTURE_SITE = { name: "N", repository: "https://example.test/r", pages: FIXTURE_PAGES, release: { version: "1.2.3", source: "registry" as const, date: "2026-11-10", commit: "abc12345", ahead: 2, published: [] } };


/** The sample's pages as HTML. */
export const fixtureHtml = (): readonly string[] => FIXTURE_PAGES.map((p) => document(p, FIXTURE_SITE));

if (import.meta.main) {
  const out = process.argv[2];
  if (out === undefined) throw new Error("usage: bun tools/fumadocs-fixture.ts DIRECTORY");
  await fs.mkdir(out, { recursive: true });
  for (const [i, html] of fixtureHtml().entries()) await fs.writeTextFile(path.join(out, `sample-${i}.html`), html);
}
