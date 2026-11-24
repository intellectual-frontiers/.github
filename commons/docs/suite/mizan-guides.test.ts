/**
 * The explanation of Mizan is pages of the documentation (commons 0001-docs FR-045): the group Mizan of the Concepts section holds the overview and the sixteen parts in order, every link between them is
 * resolved by the site build (it reports a broken link as a finding), the diagrams are Mermaid, the explanation keeps the substance of the document it replaced (about ten thousand words), and the root of the
 * repository holds no `MIZAN.html`.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";

import { ROOT, siteOnce } from "./helpers.ts";

const PARTS = [
  "mizan-idea",
  "mizan-why",
  "mizan-languages",
  "mizan-spec-kit",
  "mizan-writing-a-spec",
  "mizan-ladder",
  "mizan-standards-first",
  "mizan-ontology",
  "mizan-integrations",
  "mizan-ifccm",
  "mizan-ifqs",
  "mizan-ai",
  "mizan-controls",
  "mizan-status",
  "mizan-decisions",
  "mizan-glossary",
] as const;

/** The words of a page's blocks (headings, paragraphs, lists, tables, code). */
function words(x: unknown): number {
  const text = JSON.stringify(x, (k, v) => (k === "kind" || k === "id" ? undefined : v));
  return text.replace(/"[a-z]+":/g, " ").split(/[^A-Za-z0-9`'.-]+/).filter((w) => w.length > 0).length;
}

proves(["0001-docs FR-045"], "the group Mizan holds the overview and the sixteen parts in order, with no broken link, and the diagrams are Mermaid", async () => {
  const built = await siteOnce();
  assertEquals(built.found, []);
  const group = built.pages.filter((p) => p.section === "concepts" && p.group === "Mizan");
  assertEquals(group.map((p) => p.path), ["concepts/mizan.html", ...PARTS.map((p) => `concepts/${p}.html`)]);
  const diagrams = group.flatMap((p) => JSON.stringify(p.blocks).match(/"kind":"diagram"/g) ?? []);
  assertEquals(diagrams.length, 4, "the drift diagram, the ladder, and the two of the integrations");
});

proves(["0001-docs FR-045"], "the explanation keeps the substance of the document it replaced, and the root holds no MIZAN.html", async () => {
  let total = 0;
  for (const part of PARTS) total += words(await fs.readTextFile(path.join(ROOT, "commons", "docs", "guides", `${part}.md`)));
  assert(total >= 9000, `the sixteen parts hold ${total} words, which is less than the explanation they replaced`);
  assertEquals(await fs.exists(path.join(ROOT, "MIZAN.html")), false, "MIZAN.html is gone");
});
