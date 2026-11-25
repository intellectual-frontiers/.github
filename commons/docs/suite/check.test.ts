/**
 * What `check` finds, and how it runs (commons 0011-documentation FR-003, FR-005, FR-018): an `about` held to the code, a link that
 * leads nowhere, the command line writing nothing in the checkout, and the same checkout giving the same bytes.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { message, report } from "../src/check.ts";
import { document } from "../src/emit/html.ts";
import { markdownOf } from "../src/emit/markdown.ts";
import { brokenLinks } from "../src/site.ts";
import { checkAbout } from "../src/sources.ts";
import { CONFIG, FIXTURE_PACKAGE, ROOT, siteOnce } from "./helpers.ts";

proves(["0011-documentation FR-005", "0011-documentation FR-018"], "an about that names what is not there is a finding of each kind", () => {
  const found = checkAbout(ROOT, {
    ...FIXTURE_PACKAGE,
    about: {
      title: "Broken",
      summary: "An about that is wrong.",
      folders: [{ path: "nothing/", what: "-", mayImport: [] }],
      commands: [{ run: "bun run nothing", does: "-" }],
      rules: [{ rule: "-", enforcedBy: [{ kind: "test", file: "suite/nothing.test.ts" }, { kind: "lint", rule: "nothing" }, { kind: "compiler", option: "nothing" }] }],
      areas: [{ title: "A", slug: "a", entryPoints: ["nothing.ts"], examples: [{ file: "nothing.ts", what: "-" }] }],
    },
  }, CONFIG.lintRules);
  assertEquals(found.map((f) => f.problem.kind).sort(), ["command-missing", "enforcer-missing", "enforcer-missing", "enforcer-missing", "entry-point-missing", "example-missing", "folder-missing"]);
  for (const f of found) assert(message(f.problem).length > 0);
});

proves(["0011-documentation FR-018"], "a link to a page or an anchor that is not there is a finding", () => {
  const found = brokenLinks([
    { path: "a.html", title: "A", description: "", section: "api", group: "G", order: 0, blocks: [{ kind: "heading", level: 2, id: "here", text: [] }, { kind: "paragraph", inlines: [
      { kind: "link", href: { kind: "page", path: "a.html", anchor: "here" }, children: [] },
      { kind: "link", href: { kind: "page", path: "a.html", anchor: "gone" }, children: [] },
      { kind: "link", href: { kind: "page", path: "b.html" }, children: [] },
    ] }] },
  ]);
  assertEquals(report(found), ["a.html: links to a.html#gone, which is not a page or an anchor of the site", "a.html: links to b.html, which is not a page or an anchor of the site"]);
});

// A build of the whole of commons takes about a minute on four cores and twice that where dev:check runs the suites of other libraries beside it, so the limit is five minutes, not one.
proves(["0011-documentation FR-003", "0011-documentation FR-009", "0011-documentation FR-041", "0001-docs FR-018", "0001-docs FR-019", "0001-docs FR-021"], "the site of commons builds with no finding, the same twice, with its sections, the Quality section and the issues of data", async () => {
  const one = await siteOnce();
  const two = await siteOnce();
  assertEquals(report(one.found), []);
  const html = (b: typeof one): string[] => b.pages.map((p) => document(p, { name: "N", repository: "r", pages: b.pages }));
  assertEquals(html(one), html(two));
  assertEquals([...new Set(one.pages.map((p) => p.section))].sort(), ["api", "concepts", "howto", "models", "overview", "programs", "quality", "repoops", "specs", "start"]);
  for (const needed of ["index.html", "specs/matrix.html", "api/core/index.html", "models/index.html", "models/layers.html", "models/arca-party/person.html", "quality/index.html", "quality/data.html", "quality/issues/index.html", "quality/issues/data-00005.html", "quality/requirements.html", "quality/dependencies.html", "quality/todo.html", "quality/acceptance.html", "quality/ci.html", "quality/findings.html", "quality/hotspots.html", "quality/health.html"]) {
    assert(one.pages.some((p) => p.path === needed), `the site has ${needed}`);
  }
  // what is made of the repository beside the tests: dependencies and the SBOM, the notes in the code, the acceptance kits, the requirements (0001-docs FR-018, FR-019)
  const md = (path: string): string => markdownOf(one.pages.find((p) => p.path === path) as never);
  assertStringIncludes(md("quality/dependencies.html"), "[core](../overview/core.md)");
  assertStringIncludes(md("quality/acceptance.html"), "acceptance/arcactl-pg");
  assertStringIncludes(md("quality/requirements.html"), "[0001-core](../specs/0001-core.md)");
  assertStringIncludes(md("quality/health.html"), "Token-Permissions");
  const bom = JSON.parse(one.files.find((f) => f.path === "sbom.cdx.json")?.text ?? "{}") as { bomFormat: string; specVersion: string; components: { name: string }[]; dependencies: { ref: string }[] };
  assertEquals([bom.bomFormat, bom.specVersion], ["CycloneDX", "1.5"]);
  assert(bom.components.some((c) => c.name === "@intellectual-frontiers/core") && bom.components.length > 60 && bom.dependencies.length > 40, "a component for each library and package");
  assert(one.files.some((f) => f.path === "quality/core.json"), "the quality of a library as JSON, for a program");
}, { timeout: 300_000 });

proves(["0011-documentation FR-003"], "check writes nothing in the checkout and exits 0 on commons", async () => {
  const before = fs.existsSync(path.join(ROOT, "_site")) ? (await fs.stat(path.join(ROOT, "_site"))).mtime?.getTime() : undefined;
  const r = await proc.run([proc.execPath(), "src/main.ts", "check"], { cwd: path.join(ROOT, "commons/docs") });
  assertEquals(r.code, 0, r.stderr);
  const after = fs.existsSync(path.join(ROOT, "_site")) ? (await fs.stat(path.join(ROOT, "_site"))).mtime?.getTime() : undefined;
  assertEquals(after, before);
}, { timeout: 300_000 });
