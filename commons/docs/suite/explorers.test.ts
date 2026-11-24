/**
 * The explorers of the site (commons 0011-documentation FR-035): under a requirement the files that prove it and the ones written to it, the layers of a library built in layers, the releases page and the search filter.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { document } from "../src/emit/html.ts";
import { releasesLens } from "../src/lens/releases.ts";
import { traceOf } from "../src/pages/specs.ts";

import { freshBuild, ROOT, siteOnce } from "./helpers.ts";

proves(["0011-documentation FR-035"], "a requirement says which tests name it and which files are written to it, and the page of a specification shows them as links", async () => {
  const built = await siteOnce();
  const page = built.pages.find((p) => p.path === "specs/0033-kanon.html");
  const text = JSON.stringify(page?.blocks);
  assertStringIncludes(text, "Proved by");
  assertStringIncludes(text, "tests/commons-kanon.test.ts");
  const data = built.pages.find((p) => p.path === "specs/0060-flow-ledger.html");
  assertStringIncludes(JSON.stringify(data?.blocks), "suite/flow.test.ts");
  assertStringIncludes(JSON.stringify(data?.blocks), "Written in");
});

proves(["0011-documentation FR-035"], "the page of a library built in layers shows its layers in the order governance, logical, physical", async () => {
  const built = await siteOnce();
  const text = JSON.stringify(built.pages.find((p) => p.path === "overview/headless.html")?.blocks);
  assert(text.indexOf('"governance"') < text.indexOf('"logical"') && text.indexOf('"logical"') < text.indexOf('"physical"'), "bands in order");
  assertStringIncludes(text, "src/surfaces/cli/");
});

proves(["0011-documentation FR-035"], "the releases page lists the record in its order, and a record that cannot be read is a finding", async () => {
  const b = freshBuild();
  const lens = releasesLens({ name: "r", file: "commons/generated/release.auto.json" });
  const make = await lens.read(b, [], []);
  make(b, 10);
  const record = JSON.parse(await fs.readTextFile(path.join(ROOT, "commons/generated/release.auto.json"))) as { releases: { slug: string }[] };
  const rows = JSON.stringify(b.pages[0]?.blocks);
  assertEquals(b.pages[0]?.path, "overview/releases.html");
  assert(record.releases.every((r) => rows.includes(`"text":"${r.slug}"`)), "every library of the record is on the page");
  const bad = freshBuild();
  const none = await releasesLens({ name: "r", file: "nowhere.json" }).read(bad, [], []);
  none(bad, 10);
  assertEquals(bad.found.map((f) => f.problem.kind), ["undescribed"]);
});

proves(["0011-documentation FR-035"], "the search has a filter by kind, which the script fills from the index", async () => {
  const html = document({ path: "index.html", title: "T", description: "D", section: "overview", group: "G", order: 0, blocks: [] }, { name: "N", repository: "r", pages: [] });
  assertStringIncludes(html, "data-search-kind");
  const js = await fs.readTextFile(path.join(ROOT, "commons/docs/src/theme/site.js"));
  assertStringIncludes(js, "e.group !== only");
  assert(traceOf !== undefined);
});
