// Spec: 0001-docs FR-007, FR-008
/**
 * The presentations and the book (docs 0001-docs FR-007, FR-008; commons 0011-documentation FR-040): the AsciiDoc a page is written as, the volumes the parts select, the file a volume is written to and
 * proved current by, the command line's `--presentation` and `--check`, and the five volumes of commons.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { GENERATED, selection, volumeText } from "../src/book.ts";
import type { Finding } from "../src/check.ts";
import { loadConfig, main, parseArgs } from "../src/cli.ts";
import { DEFAULT_PRESENTATIONS, resolveConfig } from "../src/config.ts";
import { type AdocScope, inlinesAdoc, pageAdoc, textAdoc } from "../src/emit/asciidoc.ts";
import type { Block, Page } from "../src/model.ts";
import { PRESENTATIONS, presentationFiles, staleFiles, writeFiles } from "../src/presentation.ts";
import { buildSite } from "../src/site.ts";
import { CONFIG, ROOT } from "./helpers.ts";

const t = (text: string) => ({ kind: "text" as const, text });
const page = (path: string, over: Partial<Page> = {}): Page => ({ path, title: path, description: "", section: "howto", group: "G", order: 0, blocks: [], ...over });
const scope = (pages: Record<string, string> = {}, anchors: string[] = [], site?: string): AdocScope => ({ pages: new Map(Object.entries(pages)), anchors: new Set(anchors), site });
const at = (anchor = "v-a", level = 2) => ({ anchor, level });

proves(["0001-docs FR-008"], "text that AsciiDoc would read as markup is passed through, a line that would be a list or a title begins safely, and a bracket is an attribute", () => {
  assertEquals(textAdoc("plain words"), "plain words");
  assertEquals(textAdoc("a * b"), "pass:c[a * b]");
  assertEquals(textAdoc("a -- b"), "pass:c[a -- b]");
  assertEquals(textAdoc("see [x] now"), "see {startsb}x{endsb} now");
  assertEquals(textAdoc("[[a, b]]"), "{startsb}{startsb}a, b{endsb}{endsb}");
  assertEquals(inlinesAdoc([{ kind: "code", text: "a+b" }, t(" "), { kind: "code", text: "plain" }, t(" "), { kind: "code", text: "x[0]" }], scope()), "`pass:c[a+b]` `+plain+` `+x+{startsb}+0+{endsb}`");
  const lines = pageAdoc(page("a.html", { blocks: [
    { kind: "paragraph", inlines: [t("- not a list")] },
    { kind: "paragraph", inlines: [t(".gitignore is a file")] },
    { kind: "paragraph", inlines: [t("NOTE: not an admonition")] },
    { kind: "paragraph", inlines: [{ kind: "strong", children: [t("Bold")] }, t(" first")] },
  ] }), scope(), at());
  assertStringIncludes(lines.join("\n"), "{empty}- not a list");
  assertStringIncludes(lines.join("\n"), "{empty}.gitignore");
  assertStringIncludes(lines.join("\n"), "{empty}NOTE:");
  assertStringIncludes(lines.join("\n"), "**Bold** first");
});

proves(["0001-docs FR-008"], "every block is written: headings with anchors, lists, tables, code, callouts, entries, tabs, diagrams, cards and trees", () => {
  const blocks: Block[] = [
    { kind: "heading", level: 2, id: "first", text: [t("First")] },
    { kind: "heading", level: 3, id: "second", text: [t("Second")] },
    { kind: "list", ordered: false, items: [[{ kind: "paragraph", inlines: [t("one")] }, { kind: "list", ordered: true, items: [[{ kind: "paragraph", inlines: [t("inner")] }]] }], [{ kind: "paragraph", inlines: [t("two")] }, { kind: "code", lang: "ts", text: "const a = 1;" }]] },
    { kind: "table", head: [[t("A")], [t("B|C")]], rows: [[[t("1")], [t("2")]]] },
    { kind: "code", lang: "sh", title: "Run it", text: "echo ----\n----\necho" },
    { kind: "callout", tone: "limit", title: "Limit", blocks: [{ kind: "paragraph", inlines: [t("It stops.")] }] },
    { kind: "entry", id: "f", name: "f", badges: [{ text: "function", tone: "neutral" }], signature: "function f(): void", blocks: [{ kind: "paragraph", inlines: [t("Does f.")] }] },
    { kind: "entry", id: "f", name: "f", badges: [], blocks: [] },
    { kind: "tabs", id: "tt", tabs: [{ label: "One", blocks: [{ kind: "paragraph", inlines: [t("in one")] }] }] },
    { kind: "diagram", source: "flowchart LR\n  a --> b", caption: "A flow" },
    { kind: "cards", cards: [{ title: "Card", href: { kind: "page", path: "b.html" }, text: [t("what")], children: [{ title: "Kid", href: { kind: "external", url: "https://example.com/x" }, text: [t("kid")] }] }] },
    { kind: "badges", badges: [{ text: "ok", tone: "good" }] },
    { kind: "tree", nodes: [{ label: "src/", note: [t("code")], children: [{ label: "mod.ts", children: [] }] }] },
    { kind: "meta", inlines: [t("Source: x")] },
  ];
  const text = pageAdoc(page("a.html", { title: "Title", blocks }), scope({ "b.html": "v-b" }), at()).join("\n");
  for (
    const want of [
      "[#v-a]\n== Title",
      "[#v-a--first]\n=== First",
      "[#v-a--second]\n==== Second",
      "* one\n.. inner",
      "* two\n+\n[source,ts]",
      "[%header,cols=\"2*\"]\n|===\n|A\n|pass:c[B\\|C]",
      ".Run it\n[source,sh]\n-----\necho ----\n----\necho\n-----",
      "[IMPORTANT]\n.Limit\n====\nIt stops.\n====",
      "[discrete#v-a--f]\n==== `+f+` (function)",
      "[discrete#v-a--f-2]",
      "[discrete#v-a--tt-0]\n===== One",
      ".A flow\n[source,mermaid]",
      "* xref:v-b[Card]: what\n** link:https://example.com/x[Kid]: kid",
      "`+ok+`",
      "* `+src/+`: code\n** `+mod.ts+`",
      "__Source: x__",
    ]
  ) assertStringIncludes(text, want);
});

proves(["0001-docs FR-008"], "a link to a page of the volume is a cross reference, to another is a link to the site where the book names one and its text where it does not", () => {
  const link = (p: string, anchor?: string) => [{ kind: "link" as const, href: { kind: "page" as const, path: p, ...(anchor === undefined ? {} : { anchor }) }, children: [t("there")] }];
  const s = scope({ "b.html": "v-b" }, ["v-b", "v-b--part"], "https://site.example/");
  assertEquals(inlinesAdoc(link("b.html"), s), "xref:v-b[there]");
  assertEquals(inlinesAdoc(link("b.html", "part"), s), "xref:v-b--part[there]");
  assertEquals(inlinesAdoc(link("b.html", "gone"), s), "xref:v-b[there]");
  assertEquals(inlinesAdoc(link("c.html", "x"), s), "link:https://site.example/c.html#x[there]");
  assertEquals(inlinesAdoc(link("c.html"), scope({ "b.html": "v-b" })), "there");
});

proves(["0001-docs FR-008"], "a volume is its parts' pages in the order of the navigation: a page is a chapter, a page under it a section, a page once, a part of each group, and a part that takes nothing is found", () => {
  const pages = [
    page("how-to/b.html", { title: "B", group: "Jobs", order: 2 }),
    page("how-to/a.html", { title: "A", group: "Jobs", order: 1 }),
    page("how-to/a/kid.html", { title: "Kid", group: "Jobs", order: 3, parent: "how-to/a.html" }),
    page("api/x/one.html", { title: "One", section: "api", group: "X" }),
    page("api/y/two.html", { title: "Two", section: "api", group: "Y", order: 5 }),
    page("specs/matrix.html", { title: "Matrix", section: "specs", group: "Specs" }),
  ];
  const volume = {
    id: "vol",
    title: "Vol",
    about: "A volume.",
    parts: [
      { title: "Jobs", about: "The jobs.", select: [{ section: "howto" as const }] },
      { title: "Again", select: [{ section: "howto" as const }] },
      { title: "API", select: [{ section: "api" as const }], perGroup: true },
      { title: "None", select: [{ section: "models" as const }] },
    ],
  };
  const chosen = selection(volume, pages);
  assertEquals(chosen.map((c) => [c.part.title, c.pages.map((p) => p.path)]), [
    ["Jobs", ["how-to/a.html", "how-to/b.html", "how-to/a/kid.html"]],
    ["Again", []],
    ["X", ["api/x/one.html"]],
    ["Y", ["api/y/two.html"]],
    ["None", []],
  ]);
  const found: Finding[] = [];
  const text = volumeText(volume, pages, undefined, found);
  assertEquals(text.split("\n")[0], GENERATED("vol"));
  assertStringIncludes(text, "[#vol-part-1]\n= Jobs\n\nThe jobs.");
  const order = ["== A", "=== Kid", "== B", "= Again", "= X", "== One", "= Y"].map((x) => text.indexOf(`\n${x}\n`));
  assert(order.every((n) => n >= 0), "each is there");
  assertEquals([...order].sort((a, b) => a - b), order, "in this order");
  assertEquals(found.map((f) => f.problem), [{ kind: "book-part-empty", volume: "vol", part: "Again" }, { kind: "book-part-empty", volume: "vol", part: "None" }]);
  assertEquals(volumeText(volume, pages, undefined, []), text, "the same pages give the same text");
  assert(!text.includes("Matrix"), "a page no part takes is not in the volume");
});

proves(["0001-docs FR-007"], "the presentations are web, markdown, data and book, the site is what is written without a choice, and a book needs its volumes", () => {
  assertEquals(PRESENTATIONS.map((p) => p.id), ["web", "markdown", "data", "book"]);
  assertEquals(DEFAULT_PRESENTATIONS, ["web", "markdown", "data"]);
  assertEquals(CONFIG.presentations, ["web", "markdown", "data"]);
  const base = { name: "N", repository: "https://github.com/example/n", home: { dir: ".", about: { title: "N", summary: "n." } }, packages: [], citations: { prefix: "n", digits: 3 } };
  const bad = resolveConfig({ ...base, presentations: ["web", "paper"] }, "/x/docs.config.ts");
  assert(bad.kind === "err" && bad.error.join().includes("paper"));
  const none = resolveConfig({ ...base, presentations: ["book"] }, "/x/docs.config.ts");
  assert(none.kind === "err" && none.error.join().includes("names no volume"));
  const worse = resolveConfig({ ...base, books: { site: "http://x", volumes: [{ id: "A B", title: "", about: "x", parts: [{ title: "P", select: [{ section: "nowhere" }, {}] }] }, { id: "Dup", about: "x", parts: [] }] } }, "/x/docs.config.ts");
  assert(worse.kind === "err");
  const all = worse.error.join("\n");
  for (const said of ["books.site", "volumes[0].id", "volumes[0].title", "select[0].section", "names neither a section nor a prefix", "volumes[1].title", "volumes[1].parts"]) assertStringIncludes(all, said);
  const good = resolveConfig({ ...base, presentations: ["book"], books: { volumes: [{ id: "one", title: "One", about: "x", parts: [{ title: "P", select: [{ section: "api" }], perGroup: true }] }] } }, "/x/docs.config.ts");
  assert(good.kind === "ok" && good.value.books.volumes[0]?.parts[0]?.perGroup === true);
});

proves(["0001-docs FR-007"], "the command line takes --presentation (one or several, by name) and --check for build, and refuses them for check", () => {
  assertEquals(parseArgs(["build", "--presentation", "book"]), { kind: "ok", value: { kind: "build", out: undefined, config: undefined, presentations: ["book"] } });
  assertEquals(parseArgs(["build", "--presentation", "web,book", "--out", "o", "--check"]), { kind: "ok", value: { kind: "build", out: "o", config: undefined, presentations: ["web", "book"], verify: true } });
  for (const bad of [["build", "--presentation", "paper"], ["build", "--presentation"], ["check", "--presentation", "book"], ["check", "--check"]]) assertEquals(parseArgs(bad).kind, "err", bad.join(" "));
});

proves(["0001-docs FR-007", "0001-docs FR-008"], "the files of a presentation are written, a book into a folder that holds other things leaves them, and a file that is not what a build writes is found", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-book-" });
  try {
    const loaded = await loadConfig(path.join(ROOT, "commons/docs/suite/fixture-repo/docs.config.ts"));
    assert(loaded.kind === "ok");
    const config = { ...loaded.value, books: { site: "https://x.example/", volumes: [{ id: "fixture-guide", title: "Fixture Guide", about: "The fixture.", parts: [{ title: "The API", select: [{ section: "api" as const }], perGroup: true }, { title: "Specifications", select: [{ section: "specs" as const, exclude: ["specs/matrix"] }] }] }] } };
    const built = await buildSite(config);
    const made = presentationFiles(config, built, ["book"]);
    assertEquals(made.found, []);
    assertEquals(made.files.map((f) => f.path), ["fixture-guide/generated/fixture-guide.adoc", "books.json"]);
    const adoc = made.files[0];
    assert(adoc !== undefined && "text" in adoc);
    assertStringIncludes(adoc.text, GENERATED("fixture-guide"));
    assertStringIncludes(adoc.text, "= Specifications");
    assert(!adoc.text.includes("Matrix"), "the matrix is not in the book");
    // every cross reference has its anchor
    const anchors = new Set([...adoc.text.matchAll(/^\[(?:discrete)?#([^\]]+)\]$/gm)].map((m) => m[1]));
    const refs = [...adoc.text.matchAll(/xref:([^[]+)\[/g)].map((m) => m[1] ?? "");
    assert(refs.length > 0, "there are cross references");
    assertEquals(refs.filter((r) => !anchors.has(r)), []);
    await fs.writeTextFile(path.join(dir, "keep.txt"), "mine");
    await writeFiles(dir, made.files);
    assertEquals(await fs.readTextFile(path.join(dir, "keep.txt")), "mine");
    assertEquals(await staleFiles(dir, made.files), []);
    await fs.writeTextFile(path.join(dir, "fixture-guide/generated/fixture-guide.adoc"), `${adoc.text}\nedited by hand\n`);
    assertEquals(await staleFiles(dir, made.files), ["fixture-guide/generated/fixture-guide.adoc"]);
    await fs.remove(path.join(dir, "books.json"));
    assertEquals((await staleFiles(dir, made.files)).sort(), ["books.json", "fixture-guide/generated/fixture-guide.adoc"]);
    const web = presentationFiles(config, built, ["web", "markdown"]).files.map((f) => f.path);
    assert(web.includes("index.html") && web.includes("index.md") && web.includes("llms.txt") && web.includes("assets/site.css") && !web.some((p) => p.endsWith(".adoc")));
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0001-docs FR-007"], "build --presentation book without a volume is refused, and the book is written and checked from the command line", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-cli-" });
  try {
    const fixture = path.join(ROOT, "commons/docs/suite/fixture-repo/docs.config.ts");
    assertEquals(await main(["build", "--presentation", "book", "--out", dir, "--config", fixture]), 2);
    assertEquals(fs.existsSync(path.join(dir, "books.json")), false);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}, { timeout: 60_000 });

proves(["0011-documentation FR-040"], "commons' five volumes of the Commons Manuals have chapters, anchors that resolve, and no matrix or register, and the same pages give the same files", async () => {
  const built = await buildSite(CONFIG);
  const found: Finding[] = [];
  const one = presentationFiles(CONFIG, built, ["book"]);
  const two = presentationFiles(CONFIG, built, ["book"]);
  assertEquals(one, two);
  assertEquals(one.found, []);
  assertEquals(found, []);
  assertEquals(CONFIG.books.volumes.map((v) => v.id), ["commons-guide", "commons-api-reference", "commons-data-models", "commons-specifications", "commons-programs"]);
  for (const v of CONFIG.books.volumes) {
    const f = one.files.find((x) => x.path === `${v.id}/generated/${v.id}.adoc`);
    assert(f !== undefined && "text" in f, v.id);
    assertStringIncludes(f.text, GENERATED(v.id));
    const chapters = [...f.text.matchAll(/^== /gm)].length;
    assert(chapters >= 5, `${v.id} has ${chapters} chapters`);
    const anchors = new Set([...f.text.matchAll(/^\[(?:discrete)?#([^\]]+)\]$/gm)].map((m) => m[1]));
    assertEquals([...f.text.matchAll(/xref:([^[]+)\[/g)].map((m) => m[1] ?? "").filter((r) => !anchors.has(r)), [], `${v.id}: every cross reference has its anchor`);
    assertEquals(anchors.size, [...f.text.matchAll(/^\[(?:discrete)?#([^\]]+)\]$/gm)].length, `${v.id}: no anchor twice`);
  }
  const specs = one.files.find((x) => x.path === "commons-specifications/generated/commons-specifications.adoc");
  assert(specs !== undefined && "text" in specs);
  assert(!/^\[#commons-specifications-specs-(matrix|index)/m.test(specs.text), "the matrix and the register are for the screen");
  const models = one.files.find((x) => x.path === "commons-data-models/generated/commons-data-models.adoc");
  assert(models !== undefined && "text" in models);
  for (const subject of ["Parties and tenancy", "Identity and access", "Pipelines and data flow", "Meaning and contracts", "Operations and proof", "Project and issues"]) assertStringIncludes(models.text, `\n= ${subject}\n`);
}, { timeout: 120_000 });
