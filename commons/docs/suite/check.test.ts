/**
 * What `check` finds, and how it runs (commons 0011-documentation FR-003, FR-005, FR-018): an `about` held to the code, a link that
 * leads nowhere, the command line writing nothing in the checkout, and the same checkout giving the same bytes.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { message, report } from "../check.ts";
import { document } from "../emit/html.ts";
import { brokenLinks, buildSite } from "../site.ts";
import { checkAbout } from "../sources.ts";
import { CONFIG, FIXTURE_PACKAGE, ROOT } from "./helpers.ts";

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

proves(["0011-documentation FR-003", "0011-documentation FR-009"], "the site of commons builds with no finding, the same twice, with its four sections", async () => {
  const one = await buildSite(CONFIG);
  const two = await buildSite(CONFIG);
  assertEquals(report(one.found), []);
  const html = (b: typeof one): string[] => b.pages.map((p) => document(p, { name: "N", repository: "r", pages: b.pages }));
  assertEquals(html(one), html(two));
  // the Models section is the lenses': commons passes none until the governance lens is configured, and a section with no page is left out (FR-009)
  assertEquals([...new Set(one.pages.map((p) => p.section))].sort(), CONFIG.lenses.length === 0 ? ["api", "overview", "specs"] : ["api", "models", "overview", "specs"]);
  for (const needed of ["index.html", "specs/matrix.html", "api/kernel/index.html"]) {
    assert(one.pages.some((p) => p.path === needed), `the site has ${needed}`);
  }
}, { timeout: 60_000 });

proves(["0011-documentation FR-003"], "check writes nothing in the checkout and exits 0 on commons", async () => {
  const before = fs.existsSync(path.join(ROOT, "_site")) ? (await fs.stat(path.join(ROOT, "_site"))).mtime?.getTime() : undefined;
  const r = await proc.run([proc.execPath(), "main.ts", "check"], { cwd: path.join(ROOT, "commons/docs") });
  assertEquals(r.code, 0, r.stderr);
  const after = fs.existsSync(path.join(ROOT, "_site")) ? (await fs.stat(path.join(ROOT, "_site"))).mtime?.getTime() : undefined;
  assertEquals(after, before);
}, { timeout: 60_000 });
