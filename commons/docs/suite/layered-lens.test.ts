/**
 * The layered-model lens (commons 0011-documentation FR-029): given models in layers it makes the page of the layers, a page for each model, concept and code list, the registers, and the JSON of each model; links
 * resolve, where an element is written is a link to its line, and the same models give the same pages. Commons' own site has the data models in its Models section.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import type { Page } from "../src/model.ts";
import type { LayeredModel } from "../src/layered.ts";
import { layeredLens } from "../src/lens/layered.ts";
import { markdownOf } from "../src/emit/markdown.ts";
import { brokenLinks } from "../src/site.ts";
import { freshBuild, ROOT, siteOnce } from "./helpers.ts";

const model: LayeredModel = {
  name: "shop",
  library: "demo",
  title: "shop",
  summary: "A small shop.",
  layers: [
    { id: "governance", title: "Governance", summary: "What the shop means, written in TypeScript. Edit this layer.", kinds: ["module", "concept", "attribute", "relationship", "codelist", "code"] },
    { id: "logical", title: "Logical", summary: "Tables made from governance. Not written by hand.", kinds: ["table", "column"] },
    { id: "physical", title: "Physical", summary: "SQL made from the logical schema. Generated.", kinds: ["ddl", "typed-table"] },
  ],
  elements: [
    { id: "governance:module/shop", layer: "governance", kind: "module", name: "shop", definition: "A small shop", properties: { requires: ["base"], concepts: ["order"], codeLists: ["status"] }, source: { file: "docs/mod.ts", line: 1 } },
    { id: "governance:concept/order", layer: "governance", kind: "concept", name: "order", definition: "A thing a customer buys", parent: "governance:module/shop", properties: { identifiedBy: ["id"], attributes: ["id", "email"], relationships: ["customer"], annotations: [] }, source: { file: "docs/mod.ts", line: 10 } },
    { id: "governance:attribute/order.id", layer: "governance", kind: "attribute", name: "id", definition: "Its number", parent: "governance:concept/order", properties: { type: "integer", multiplicity: "required", annotations: [] } },
    { id: "governance:attribute/order.email", layer: "governance", kind: "attribute", name: "email", definition: "Where to write", parent: "governance:concept/order", properties: { type: "text", multiplicity: "optional", annotations: ['privacy.personal={"category":"EmailAddress","purposes":["billing"]}'] }, source: { file: "docs/mod.ts", line: 12 } },
    { id: "governance:relationship/order.customer", layer: "governance", kind: "relationship", name: "customer", definition: "", parent: "governance:concept/order", properties: { to: "order", cardinality: "one", annotations: [] } },
    { id: "governance:codelist/status", layer: "governance", kind: "codelist", name: "status", definition: "Where an order is", parent: "governance:module/shop", properties: { codes: ["open"], annotations: [] } },
    { id: "governance:code/status.open", layer: "governance", kind: "code", name: "open", definition: "Not shipped", parent: "governance:codelist/status", properties: { label: "Open" } },
    { id: "logical:table:order", layer: "logical", kind: "table", name: "order", definition: "A thing a customer buys", properties: { role: "concept", primaryKey: ["id"], columns: ["id", "email"] } },
    { id: "logical:column:order/id", layer: "logical", kind: "column", name: "id", definition: "", parent: "logical:table:order", properties: { type: "integer", nullable: false, role: "attribute" } },
    { id: "physical:sqlite/table:order", layer: "physical", kind: "ddl", name: "order (sqlite)", definition: "", parent: "logical:table:order", properties: { dialect: "sqlite", sql: "CREATE TABLE order (id INTEGER);" } },
    { id: "physical:typed/table:order", layer: "physical", kind: "typed-table", name: "order", definition: "", parent: "logical:table:order", source: { file: "docs/mod.ts" }, properties: { export: "order", module: "@x/typed/models", row: "OrderRow", columns: 2 } },
  ],
  trace: [
    { from: "governance:concept/order", to: "logical:table:order", how: "projects to" },
    { from: "governance:attribute/order.id", to: "logical:column:order/id", how: "projects to" },
    { from: "logical:table:order", to: "physical:sqlite/table:order", how: "written as" },
  ],
  findings: [{ rule: "undescribed", element: "governance:relationship/order.customer", message: "relationship order.customer has no definition: say what it means" }],
};

/** The Markdown of the page at a path, or a failure that names it. */
function twin(pages: readonly Page[], path: string): string {
  const p = pages.find((x) => x.path === path);
  if (p === undefined) throw new Error(`no page ${path}`);
  return markdownOf(p);
}

const lens = layeredLens({ name: "demo", exports: ["commons/docs/src/mod.ts"], source: () => [model], regenerate: ["bun tools/generate.ts"] });

proves(["0011-documentation FR-029"], "the lens makes the page of the layers, a page for each model, concept and code list, and the registers; every link resolves and the pages say where an element is written", async () => {
  const b = freshBuild();
  const make = await lens.read(b, [], []);
  const next = make(b, 200);
  assert(next > 200);
  const paths = b.pages.map((p) => p.path).sort();
  assertEquals(paths, ["models/index.html", "models/layers.html", "models/registers.html", "models/shop/index.html", "models/shop/list-status.html", "models/shop/order.html"]);
  assertEquals(brokenLinks(b.pages).map((f) => f.problem), [], "links to pages and anchors resolve");
  const order = twin(b.pages, "models/shop/order.html");
  assertStringIncludes(order, "A thing a customer buys");
  assertStringIncludes(order, "[`docs/mod.ts:10`](" + b.config.repository + "/blob/" + b.config.branch + "/docs/mod.ts#L10)");
  assertStringIncludes(order, "personal data");
  assertStringIncludes(order, "CREATE TABLE order (id INTEGER);");
  assertStringIncludes(order, 'import { order } from "@x/typed/models"');
  const layers = twin(b.pages, "models/layers.html");
  assertStringIncludes(layers, "bun tools/generate.ts");
  assertStringIncludes(layers, "Never edit a generated file");
  assertStringIncludes(layers, "llms.txt");
  const index = twin(b.pages, "models/index.html");
  assertStringIncludes(index, "relationship order.customer has no definition");
  const registers = twin(b.pages, "models/registers.html");
  assertStringIncludes(registers, "privacy.personal");
  assertEquals(b.found, []);
});

proves(["0011-documentation FR-029"], "the JSON of each model and of the list is added to the site, and the same models give the same pages", async () => {
  const run = async () => {
    const b = freshBuild();
    const make = await lens.read(b, [], []);
    make(b, 200);
    return { pages: b.pages.map((p) => markdownOf(p)), files: lens.files?.(b) ?? [] };
  };
  const one = await run();
  const two = await run();
  assertEquals(one, two);
  assertEquals(one.files.map((f) => f.path), ["models/shop.json", "models/index.json"]);
  assertEquals(JSON.parse(one.files[0]?.text ?? "{}").elements.length, model.elements.length);
  assertEquals(JSON.parse(one.files[1]?.text ?? "[]"), [{ name: "shop", library: "demo", title: "shop", summary: "A small shop.", file: "models/shop.json", elements: model.elements.length, findings: 1 }]);
});

proves(["0011-documentation FR-029"], "a file that is told to export models and cannot be read is a finding that names it, and the values of the files that can be read are located by identity", async () => {
  const seen: unknown[] = [];
  const located = layeredLens({ name: "locate", exports: ["commons/docs/nope.ts", "commons/docs/src/lens.ts"], source: (locate) => { seen.push(locate(lens, undefined), locate({}, undefined)); return []; } });
  const b = freshBuild();
  await located.read(b, [], []);
  assertEquals(b.found.map((f) => f.where), ["commons/docs/nope.ts"]);
  assertEquals(seen[1], undefined);
});

proves(["0011-documentation FR-029"], "commons' own site has the data models: the layers, each model, each concept with its SQL and typed table, the registers and the JSON, with no finding", async () => {
  const built = await siteOnce();
  assertEquals(built.found.map((f) => f.problem), []);
  for (const needed of ["models/index.html", "models/layers.html", "models/registers.html", "models/identity-agent/index.html", "models/arca-party/person.html"]) assert(built.pages.some((p) => p.path === needed), `the site has ${needed}`);
  assert(built.files.some((f) => f.path === "models/identity-agent.json") && built.files.some((f) => f.path === "models/index.json"));
  const person = twin(built.pages, "models/arca-party/person.html");
  assertStringIncludes(person, "CREATE TABLE");
  assertStringIncludes(person, "commons/data/models/arca/party.ts");
  assert(ROOT.length > 0);
}, { timeout: 120_000 });
