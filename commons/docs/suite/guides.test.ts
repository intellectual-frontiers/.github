/**
 * The guides lens and the library map (commons 0011-documentation FR-032, FR-033): the guides are pages of the sections Start here, Concepts and How-to, their citations and links are resolved and a guide that cannot be read is a
 * finding; and the library map says what each library imports and what imports it.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { SECTIONS } from "../src/emit/html.ts";
import { buildSite } from "../src/site.ts";
import { guidesLens } from "../src/lens/guides.ts";
import { freshBuild } from "./helpers.ts";
import { CONFIG } from "./helpers.ts";

proves(["0011-documentation FR-032", "0011-documentation FR-039"], "a guide that cannot be read is a finding, and the sections are in the order of a newcomer's path", async () => {
  const lens = guidesLens({ name: "g", guides: [{ file: "nowhere/none.md", path: "start/index.html", section: "start", group: "Start here", order: 0 }] });
  const b = freshBuild();
  const make = await lens.read(b, [], []);
  make(b, 10);
  assertEquals(b.pages.length, 0);
  assertEquals(b.found.map((f) => f.problem.kind), ["undescribed"]);
  assertEquals(SECTIONS.map((s) => s.section), ["start", "concepts", "overview", "howto", "specs", "api", "models", "programs"]);
});

proves(["0011-documentation FR-032", "0011-documentation FR-033"], "commons' site has the guides of every section with their citations and links resolved to pages, and a library map that names what each library imports", async () => {
  const built = await buildSite(CONFIG);
  assertEquals(built.found, []);
  const bySection = (s: string) => built.pages.filter((p) => p.section === s).map((p) => p.path);
  assert(bySection("start").length >= 5 && bySection("concepts").length >= 10 && bySection("howto").length >= 5, "the guides are there");
  const kanon = built.pages.find((p) => p.path === "concepts/kanon.html");
  const text = JSON.stringify(kanon?.blocks);
  assertStringIncludes(text, "specs/0033-kanon.html");
  assertStringIncludes(text, "overview/kanon.html");
  const map = built.pages.find((p) => p.path === "overview/map.html");
  assertStringIncludes(JSON.stringify(map?.blocks), "flowchart LR");
  const headless = built.pages.find((p) => p.path === "overview/headless.html");
  assertStringIncludes(JSON.stringify(headless?.blocks), "Imports");
});

proves(["0011-documentation FR-037"], "a Mermaid fence in Markdown is a diagram block with its source, a diagram of a type the renderer draws is drawable, and one it does not draw is a finding that says so", async () => {
  const { markdown, plainContext } = await import("../src/markdown.ts");
  const { diagramSources, drawable } = await import("../src/emit/html.ts");
  const { message } = await import("../src/check.ts");
  const blocks = markdown("Text.\n\n```mermaid\nflowchart LR\n  a[A] --> b[B]\n```\n\n```ts\nconst a = 1;\n```\n", plainContext);
  assertEquals(blocks.map((b) => b.kind), ["paragraph", "diagram", "code"]);
  assertEquals(diagramSources(blocks), ["flowchart LR\n  a[A] --> b[B]"]);
  assert(drawable("flowchart LR\n  a --> b") && drawable("erDiagram\n  a ||--o{ b : has"), "flowchart and entity-relationship diagrams are drawn");
  assert(!drawable('pie title Pets\n  "Dogs" : 3'), "a pie chart is not drawn");
  assertStringIncludes(message({ kind: "diagram-undrawable", first: "pie title Pets" }), "cannot be drawn");
});
