/**
 * Tests of the content checks of Kanon (commons kanon 0002-kanon-content-checks): the relations and the vocabulary of a model and their findings, the membership of an extension of another scope and the manifest of a consumer,
 * and the bundle (made the same every time, loaded whole or refused whole with each fault named). The model is a body of content in the three layers: claims in Governance, a collected page in Logical, three renditions in Physical.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  buildMatrix,
  BUNDLE_MANIFEST,
  classify,
  decodeTable,
  type Disposition,
  droppedFindings,
  type ElementId,
  extensionFindings,
  type ExportsMap,
  importFindings,
  type InstanceName,
  type LayeredModel,
  makeBundle,
  type ModelElement,
  modelFindings,
  parseElementId,
  parseInstanceName,
  parsePackageName,
  type Relation,
  type Table,
  verifyBundle,
} from "../src/mod.ts";
import { readTableOf, type Files } from "../src/host.ts";

function id(text: string): ElementId {
  const r = parseElementId(text);
  assert(r.kind === "ok", text);
  return r.value;
}
function inst(text: string): InstanceName {
  const r = parseInstanceName(text);
  assert(r.kind === "ok", text);
  return r.value;
}
function table(form: unknown): Table {
  const r = decodeTable(form);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

const HOST = "@intellectual-frontiers/content";
const WEB = "@consumer/content-rendition-web";
const FEED = "@consumer/content-rendition-feed";
const hostForm = (scope: "own" | "any" | undefined) => ({
  package: HOST,
  family: { dialect: "{host}-rendition-{name}", plugin: "{host}-{name}", ...(scope === undefined ? {} : { scope }) },
  units: [
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/physical/rendition/", layer: "physical" },
  ],
});
const HOST_TABLE = table(hostForm("any"));
const HOST_OWN = table(hostForm("own"));
const HOST_EXPORTS: ExportsMap = { ".": "./src/governance/mod.ts", "./governance": "./src/governance/mod.ts", "./logical": "./src/logical/mod.ts", "./rendition": "./src/physical/rendition/mod.ts" };
const consumerForm = (name: string, role: unknown) => ({ package: name, extends: HOST, ...(role === undefined ? {} : { role }), units: [{ folder: "src/", layer: "physical" }] });
const WEB_TABLE = table(consumerForm(WEB, { kind: "dialect", name: "web", instanceOf: "src/physical/rendition/" }));
const EXT_EXPORTS: ExportsMap = { ".": "./src/mod.ts" };

const el = (text: string, layer: ModelElement["layer"], kind: string, properties: ModelElement["properties"] = {}): ModelElement => ({
  id: id(text),
  layer,
  kind,
  name: text,
  definition: `${text}.`,
  source: { file: `src/${layer}/x.ts`, line: 1 },
  properties,
});

const CLAIM = id("claim:fast");
const PAGE = id("page:home");
const COLLECTED = id("collected:home");
const WEB_EL = id("web:home");
const LLMS_EL = id("llms:home");
const web = inst("web");
const llms = inst("llms");
const feed = inst("feed");

function contentModel(dispositions: readonly Disposition[], extra: Partial<LayeredModel> = {}): LayeredModel {
  return {
    name: "site",
    library: "content",
    title: "A site",
    summary: "A body of content.",
    layers: [
      { id: "governance", title: "Governance", summary: "Claims and pages.", kinds: ["page", "claim"] },
      { id: "logical", title: "Logical", summary: "The collected model.", kinds: ["collected"] },
      { id: "physical", title: "Physical", summary: "One instance for each rendition.", kinds: ["web-page", "llms-entry"] },
    ],
    elements: [
      el("claim:fast", "governance", "claim", { evidence: ["benchmark-7"], audience: "buyer" }),
      el("page:home", "governance", "page", { audience: "buyer" }),
      el("collected:home", "logical", "collected"),
      { ...el("web:home", "physical", "web-page"), instance: web },
      { ...el("llms:home", "physical", "llms-entry"), instance: llms },
    ],
    trace: [
      { from: CLAIM, to: COLLECTED, how: "collects evidence" },
      { from: PAGE, to: COLLECTED, how: "projects to" },
      { from: COLLECTED, to: WEB_EL, how: "written as" },
      { from: COLLECTED, to: LLMS_EL, how: "written as" },
    ],
    findings: [],
    dispositions,
    instances: [web, llms, feed],
    ...extra,
  };
}

const ALL: readonly Disposition[] = [
  { element: CLAIM, annotation: "evidence", instance: web, outcome: "expressed", target: WEB_EL },
  { element: CLAIM, annotation: "evidence", instance: llms, outcome: "carried", target: LLMS_EL },
  { element: CLAIM, annotation: "audience", outcome: "unexpressed", reason: "the audience is a note for editors and no rendition shows it" },
  { element: PAGE, annotation: "audience", outcome: "unexpressed", reason: "the audience is a note for editors and no rendition shows it" },
];

proves(["0002-kanon-content-checks FR-002", "0002-kanon-content-checks FR-003"], "a duplicate id, a dangling relation and a relation between layers are found, and a cycle is not", () => {
  const dup = contentModel(ALL, { elements: [...contentModel(ALL).elements, el("page:home", "governance", "page")] });
  assertEquals(modelFindings(dup).map((f) => f.rule), ["kanon/duplicate-id"]);
  assertStringIncludes(modelFindings(dup)[0]?.message ?? "", "page:home");
  const rel = (from: ElementId, to: ElementId, kind: string): Relation => ({ from, to, kind });
  const found = modelFindings(contentModel(ALL, { relations: [rel(PAGE, id("page:ghost"), "links"), rel(PAGE, COLLECTED, "links")] }));
  assertEquals(found.map((f) => f.rule), ["kanon/dangling", "kanon/relation-layer"]);
  const cycle = modelFindings(contentModel(ALL, { elements: [...contentModel(ALL).elements, el("page:about", "governance", "page", { audience: "buyer" })], relations: [rel(PAGE, id("page:about"), "links"), rel(id("page:about"), PAGE, "links")] }));
  assertEquals(cycle, [], "a relation may be cyclic");
  assertEquals(modelFindings(contentModel(ALL)), [], "a model with none of these is clean");
});

proves(["0002-kanon-content-checks FR-001", "0002-kanon-content-checks FR-002"], "with a vocabulary an element kind, a relation kind and an annotation name that it does not list are found; with none they are not", () => {
  const relations: readonly Relation[] = [{ from: PAGE, to: id("page:home"), kind: "cites" }];
  const without = contentModel(ALL, { relations });
  assertEquals(modelFindings(without), []);
  const vocabulary = {
    kinds: [
      { layer: "governance" as const, kinds: ["page"] },
      { layer: "logical" as const, kinds: ["collected"] },
      { layer: "physical" as const, kinds: ["web-page", "llms-entry"] },
    ],
    relationKinds: ["links"],
    annotations: ["evidence"],
  };
  const found = modelFindings(contentModel(ALL, { relations, vocabulary }));
  assertEquals(
    found.map((f) => [f.rule, f.key.split(" ").slice(2).join(" ")]),
    [
      ["kanon/kind", "claim:fast claim"],
      ["kanon/annotation", "claim:fast audience"],
      ["kanon/annotation", "page:home audience"],
      ["kanon/kind", "page:home cites page:home"],
    ],
  );
});

proves(["0033-kanon FR-022", "0033-kanon FR-023", "0033-kanon FR-030"], "a claim whose evidence no instance expresses, carries or declares unexpressed fails with kanon/dropped for that instance, and the matrix shows the cell as dropped", () => {
  const complete = contentModel([...ALL, { element: CLAIM, annotation: "evidence", instance: feed, outcome: "unexpressed", reason: "a feed carries no citations by design" }]);
  assertEquals(droppedFindings(complete), []);
  const m = contentModel(ALL);
  const dropped = droppedFindings(m);
  assertEquals(dropped.map((f) => f.rule), ["kanon/dropped"]);
  assertStringIncludes(dropped[0]?.key ?? "", "@feed");
  const row = buildMatrix(m).rows.find((r) => r.element === CLAIM && r.annotation === "evidence");
  assertEquals(row?.cells.map((c) => [c.instance, c.cell.outcome]), [[web, "expressed"], [llms, "carried"], [feed, "dropped"]]);
});

proves(["0033-kanon FR-025"], "a governance unit of data modules that imports a logical unit is layers/above", () => {
  const t = table({ package: HOST, units: [{ folder: "src/governance/", layer: "governance" }, { folder: "src/logical/", layer: "logical" }] });
  const files = [
    { path: "src/governance/claims.ts", text: `import { project } from "${HOST}/logical";\nexport const claims = [{ id: "fast", project }];\n` },
    { path: "src/logical/mod.ts", text: "export const project = 1;\n" },
  ];
  const exports: ExportsMap = { ".": "./src/governance/claims.ts", "./logical": "./src/logical/mod.ts" };
  assertEquals(importFindings(t, files, exports).map((f) => f.rule), ["layers/above"]);
});

proves(["0002-kanon-content-checks FR-004", "0002-kanon-content-checks FR-005", "0002-kanon-content-checks FR-006", "0033-kanon FR-027"], "a package of another scope is a member where the host's family takes any scope and is not where it takes its own, and its role must be the one its name bears out", () => {
  assertEquals(classify(HOST_TABLE.family ?? never(), HOST_TABLE.package, WEB), { kind: "dialect", name: web });
  assertEquals(classify(HOST_OWN.family ?? never(), HOST_OWN.package, WEB), undefined);
  assertEquals(classify(HOST_TABLE.family ?? never(), HOST_TABLE.package, HOST)?.kind, "host");
  const good = [{ path: "src/mod.ts", text: `import { g } from "${HOST}/governance";\nimport { l } from "${HOST}/logical";\nimport { r } from "${HOST}/rendition";\nexport const w = [g, l, r];\n` }];
  assertEquals(extensionFindings(HOST_TABLE, HOST_EXPORTS, WEB_TABLE, good, EXT_EXPORTS), [], "a member of another scope is judged as any member");
  assertEquals(extensionFindings(HOST_OWN, HOST_EXPORTS, WEB_TABLE, good, EXT_EXPORTS).map((f) => f.rule), ["family/name"], "scope own refuses it");
  const sibling = [{ path: "src/mod.ts", text: `import { f } from "${FEED}";\nexport const x = f;\n` }];
  assertEquals(extensionFindings(HOST_TABLE, HOST_EXPORTS, WEB_TABLE, sibling, EXT_EXPORTS).map((f) => f.rule), ["instances/sibling"]);
  const wrongName = table(consumerForm(WEB, { kind: "dialect", name: "feed", instanceOf: "src/physical/rendition/" }));
  assertEquals(extensionFindings(HOST_TABLE, HOST_EXPORTS, wrongName, good, EXT_EXPORTS).map((f) => f.rule), ["family/name"]);
  const noRole = table(consumerForm(WEB, undefined));
  assertEquals(extensionFindings(HOST_TABLE, HOST_EXPORTS, noRole, good, EXT_EXPORTS).map((f) => f.rule), ["family/name"]);
  const noUnit = table(consumerForm(WEB, { kind: "dialect", name: "web", instanceOf: "src/governance/nothing/" }));
  assertEquals(extensionFindings(HOST_TABLE, HOST_EXPORTS, noUnit, good, EXT_EXPORTS).map((f) => f.rule), ["family/name"]);
  assertEquals(decodeTable({ package: HOST, role: { kind: "plugin", noun: "x" }, units: [] }).kind, "err", "a role with no extends is refused");
  assertEquals(decodeTable({ ...hostForm("any"), role: { kind: "plugin", noun: "x" }, extends: HOST }).kind, "err", "a host has no role");
});

function never(): never {
  throw new Error("the table has a family");
}

proves(["0002-kanon-content-checks FR-007"], "the table of a package with no library.ts is read from its kanon.ts, and library.ts wins where both are there", () => {
  const form = JSON.stringify(consumerForm(WEB, { kind: "dialect", name: "web", instanceOf: "src/physical/rendition/" }));
  const files = (present: Readonly<Record<string, string>>): Files => ({
    exists: (p) => p in present,
    readDir: () => [],
    readText: (p) => present[p] ?? "",
  });
  const consumer = readTableOf("/c", files({ "/c/kanon.ts": `export const kanon = ${form};\n` }));
  assert(consumer.kind === "ok");
  assertEquals([consumer.value.manifest, consumer.value.table.package], ["kanon.ts", parsePackageNameOrThrow(WEB)]);
  assertEquals(readTableOf("/c", files({})).kind, "err");
  const lib = readTableOf("/c", files({ "/c/library.ts": `export const library = { kanon: ${JSON.stringify(hostForm("any"))} };\n`, "/c/kanon.ts": `export const kanon = ${form};\n` }));
  assert(lib.kind === "ok");
  assertEquals(lib.value.manifest, "library.ts");
});

function parsePackageNameOrThrow(text: string): string {
  const r = parsePackageName(text);
  assert(r.kind === "ok");
  return r.value;
}

const bytesOf = (files: ReadonlyMap<string, string>): Map<string, Uint8Array> => new Map([...files].map(([k, v]) => [k, new TextEncoder().encode(v)]));

proves(["0002-kanon-content-checks FR-008", "0002-kanon-content-checks FR-009", "0002-kanon-content-checks FR-010"], "a model made into a bundle is the same bytes twice and loads whole, equal to the model", async () => {
  const model = contentModel([...ALL, { element: CLAIM, annotation: "evidence", instance: feed, outcome: "unexpressed", reason: "a feed carries no citations by design" }], {
    relations: [{ from: PAGE, to: id("page:home"), kind: "links" }],
    vocabulary: { kinds: [{ layer: "governance", kinds: ["page", "claim"] }], relationKinds: ["links"], annotations: ["evidence", "audience"] },
  });
  const a = await makeBundle(model);
  const b = await makeBundle(model);
  assertEquals(a, b, "the same model gives the same bytes");
  assertEquals([...a.files.keys()], ["model.json", "elements.json", "trace.json", "relations.json", "dispositions.json"]);
  assert(a.manifest.endsWith("\n") && !a.manifest.includes(BUNDLE_MANIFEST), "the manifest does not list itself");
  const verified = await verifyBundle({ manifest: a.manifest, files: bytesOf(a.files) });
  assert(verified.kind === "ok", verified.kind === "err" ? JSON.stringify(verified.error) : "");
  assertEquals(verified.value.model, model, "the loaded model equals the model, ids, trace edges, relations and dispositions");
  const empty = await makeBundle({ name: "e", library: "e", title: "E", summary: "E.", layers: [], elements: [], trace: [], findings: [], dispositions: [], instances: [] });
  const loadedEmpty = await verifyBundle({ manifest: empty.manifest, files: bytesOf(empty.files) });
  assert(loadedEmpty.kind === "ok");
});

proves(["0002-kanon-content-checks FR-009"], "a bundle with one file changed, one missing and one extra is refused whole, each fault named by its path, and none of it is returned", async () => {
  const bundle = await makeBundle(contentModel(ALL));
  const files = bytesOf(bundle.files);
  files.set("trace.json", new TextEncoder().encode("[]\n"));
  files.delete("relations.json");
  files.set("notes.txt", new TextEncoder().encode("extra"));
  const r = await verifyBundle({ manifest: bundle.manifest, files });
  assert(r.kind === "err");
  assertEquals(r.error.map((f) => [f.kind, f.path]), [["missing", "relations.json"], ["extra", "notes.txt"], ["changed", "trace.json"]].sort((x, y) => ((x[1] ?? "") < (y[1] ?? "") ? -1 : 1)));
  const manifest = JSON.parse(bundle.manifest) as { schema: string; files: { path: string; sha256: string; size: number }[] };
  const bad = { ...manifest, files: [...manifest.files, { path: "../x", sha256: "A".repeat(64), size: 1 }, { path: "model.json", sha256: "0".repeat(64), size: 1 }] };
  const m = await verifyBundle({ manifest: JSON.stringify(bad), files: bytesOf(bundle.files) });
  assert(m.kind === "err");
  assertEquals(m.error.filter((f) => f.kind === "manifest").map((f) => f.path), ["../x", "model.json"]);
  const notJson = await verifyBundle({ manifest: "{", files: new Map() });
  assert(notJson.kind === "err" && notJson.error[0]?.kind === "manifest");
  const upper = await verifyBundle({ manifest: JSON.stringify({ ...manifest, files: [{ ...manifest.files[0], sha256: (manifest.files[0]?.sha256 ?? "").toUpperCase() }] }), files: new Map() });
  assert(upper.kind === "err" && upper.error.some((f) => f.kind === "manifest"), "two spellings of one digest never exist");
});

proves(["0002-kanon-content-checks FR-010"], "a file whose digest holds but whose content is not of the form is the fault form, and no file is returned", async () => {
  const bundle = await makeBundle(contentModel(ALL));
  const files = bytesOf(bundle.files);
  const broken = new TextEncoder().encode(`[{ "id": "no scheme", "layer": "governance", "kind": "x", "name": "n", "definition": "d", "source": { "file": "f", "line": 1 }, "properties": {} }]\n`);
  files.set("elements.json", broken);
  const manifest = JSON.parse(bundle.manifest) as { schema: string; files: { path: string; sha256: string; size: number }[] };
  const fixed = { ...manifest, files: await Promise.all(manifest.files.map(async (f) => (f.path === "elements.json" ? { path: f.path, sha256: await sha256(broken), size: broken.length } : f))) };
  const r = await verifyBundle({ manifest: JSON.stringify(fixed), files });
  assert(r.kind === "err");
  assertEquals(r.error.map((f) => [f.kind, f.path]), [["form", "elements.json"]]);
});

proves(["0002-kanon-content-checks FR-002"], "trace validation rejects an orphan, a reverse edge and a self-targeted disposition", () => {
  const model = contentModel([
    { element: CLAIM, annotation: "evidence", instance: web, outcome: "expressed", target: CLAIM },
    ...ALL,
  ], { trace: [{ from: WEB_EL, to: COLLECTED, how: "reversed" }] });
  const rules = modelFindings(model).map((f) => f.rule);
  assertEquals(rules.includes("kanon/trace-invalid"), true);
  assertEquals(rules.includes("kanon/trace-missing"), true);
  assertEquals(rules.includes("kanon/disposition-duplicate"), true);
  assertEquals(droppedFindings(model).some((f) => f.message.includes("no valid trace")), true);
});
