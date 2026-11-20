/**
 * The lenses (commons 0011-documentation FR-013, FR-014, FR-026): the fixture schema shown as a schema (its diagram, its tables with their
 * columns and personal data, its SQL for three dialects, its governance), IFRFS shown as a layout, and each lens a value of `Lens`.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { readApi } from "../extract/api.ts";
import { fileAide, layoutPages, layoutTree, readLayouts } from "../lens/file-aide.ts";
import { modelPages, readModels, sqlAide } from "../lens/sql-aide.ts";
import type { Block, Page } from "../model.ts";
import type { Area } from "../sources.ts";
import { fixtureArea, FIXTURE_PACKAGE, freshBuild, ROOT } from "./helpers.ts";

const kinds = (p: Page | undefined): string[] => (p?.blocks ?? []).map((b) => b.kind);
const find = (p: Page | undefined, kind: Block["kind"]): Block[] => (p?.blocks ?? []).filter((b) => b.kind === kind);

proves(["0011-documentation FR-013"], "a module that exports tables is a schema: diagram, tables, columns, SQL of three dialects, governance", async () => {
  const area = fixtureArea("model", "model.ts", "Library");
  const apis = await readApi(ROOT, [{ slug: "model", entryPoints: ["commons/docs/suite/fixture/model.ts"] }]);
  const b = freshBuild();
  const models = await readModels(b, [area], apis);
  assertEquals(models[0]?.tables.map((t) => t.name), ["shelf", "book"]);
  assertEquals(models[0]?.docs.length, 1, "the documentation map is read");
  modelPages(b, models);
  const model = b.pages.find((p) => p.path === "models/model/index.html");
  assert(kinds(model).includes("diagram"));
  const sql = find(model, "tabs")[0];
  assertEquals(sql?.kind === "tabs" ? sql.tabs.map((t) => t.label) : [], ["PostgreSQL", "SQLite", "DuckDB"]);
  const bookPage = b.pages.find((p) => p.path === "models/model/book.html");
  const borrower = find(bookPage, "entry").find((e) => e.kind === "entry" && e.name === "borrower");
  assertEquals(borrower?.kind === "entry" ? borrower.badges.map((x) => x.text) : [], ["text", "nullable", "PersonalData: Name"]);
  const gov = b.pages.find((p) => p.path === "models/governance.html");
  const tables = find(gov, "table");
  assert(tables[0]?.kind === "table" && tables[0].rows.length === 1, "one column of personal data");
  assertEquals(b.found, []);
});

proves(["0011-documentation FR-013", "0011-documentation FR-018"], "a table with no description is a finding", async () => {
  const b = freshBuild();
  const area = fixtureArea("model", "model.ts", "Library");
  const apis = await readApi(ROOT, [{ slug: "model", entryPoints: ["commons/docs/suite/fixture/model.ts"] }]);
  const models = await readModels(b, [area], apis);
  modelPages(b, models.map((m) => ({ ...m, docs: [] })));
  assertEquals(b.found.map((f) => f.problem), [{ kind: "undescribed", entity: "table shelf" }, { kind: "undescribed", entity: "table book" }], "neither table has a description of its own once the map is taken away");
});

proves(["0011-documentation FR-014"], "a module that exports entries is a layout: its tree, patterns and segments", async () => {
  const area: Area = { title: "IFRFS", slug: "ifrfs", entryPoints: ["ifrfs/mod.ts"], pkg: { ...FIXTURE_PACKAGE, dir: "commons/ts/data" }, dir: "commons/ts/data/ifrfs" };
  const apis = await readApi(ROOT, [{ slug: "ifrfs", entryPoints: ["commons/ts/data/ifrfs/mod.ts"] }]);
  const b = freshBuild();
  const layouts = await readLayouts(b, [area], apis);
  assertEquals(layouts[0]?.entries.map((e) => e.name), ["readme", "rendition", "issue"]);
  const tree = layoutTree(layouts[0]?.entries ?? []);
  assertEquals(tree.map((n) => n.label), ["README.md", "${kind}"]);
  layoutPages(b, layouts, 100);
  const page = b.pages[0];
  const entries = find(page, "entry");
  assertEquals(entries.length, 3);
  const issue = entries[2];
  assertStringIncludes(issue?.kind === "entry" ? JSON.stringify(issue.blocks) : "", "issues.d");
});

proves(["0011-documentation FR-026"], "each lens is a value of Lens: it reads what is its library's, and makes its pages after the order it is given", async () => {
  assertEquals([sqlAide.name, fileAide.name], ["sql-aide", "file-aide"]);
  const area = fixtureArea("model", "model.ts", "Library");
  const apis = await readApi(ROOT, [{ slug: "model", entryPoints: ["commons/docs/suite/fixture/model.ts"] }]);
  const b = freshBuild();
  const make = await sqlAide.read(b, [area], apis);
  assertEquals(make(b, 300), 400, "one model takes one group");
  assertEquals(b.pages.find((p) => p.path === "models/model/index.html")?.order, 300);
  const none = await fileAide.read(b, [area], apis);
  assertEquals(none(b, 400), 400, "no layout, no page");
});
