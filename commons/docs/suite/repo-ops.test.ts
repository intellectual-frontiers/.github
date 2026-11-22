/**
 * The Repo Ops section (docs 0001-docs FR-029): the lens makes its pages from guides written by people and from the typed facts it is given, a page it cannot read is a finding and the others are made, and the site of commons
 * has the section with every workflow of the repository and every verb of its operations program, read from their own typed definitions and not written twice.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { path } from "@intellectual-frontiers/system";
import { SECTIONS, document } from "../src/emit/html.ts";
import { hrefFor } from "../src/links.ts";
import { repoOpsLens } from "../src/lens/repo-ops.ts";
import { buildSite } from "../src/site.ts";
import { CONFIG, freshBuild, ROOT } from "./helpers.ts";

/** A module of the checkout read by a path built at run time: the library keeps no import of a file outside its folder, and the test needs the definitions the site is made from. */
const viaRoot = async <T>(file: string): Promise<T> => (await import(path.toFileUrl(path.join(ROOT, file)).href)) as T;

const text = (blocks: unknown): string => JSON.stringify(blocks);

proves(["0001-docs FR-029"], "the lens makes its pages from a guide and the facts it is given, and a page that cannot be read is a finding while the others are made", async () => {
  const lens = repoOpsLens({
    name: "ops",
    pages: [
      { file: "commons/docs/guides/ops-ci-cd.md", path: "repo-ops/ci-cd.html", order: 1, generated: "workflows" },
      { file: "commons/docs/guides/ops-release.md", path: "repo-ops/release.html", order: 3, generated: "facts" },
      { file: "commons/docs/guides/ops-repoctl.md", path: "repo-ops/repoctl.html", order: 4, generated: "verbs" },
      { file: "nowhere/none.md", path: "repo-ops/none.html", order: 9 },
    ],
    workflows: () => [{ file: ".github/workflows/x.auto.yml", name: "x", triggers: ["push (paths of commons)"], jobs: [{ id: "one" }, { id: "two" }], purpose: "Does x." }],
    facts: () => [{ label: "Distribution mode", value: "single" }],
    verbs: () => [{ words: "sync", summary: "Make the files.", effect: "mutate", tier: "contributor", idempotent: true, dryRun: true, check: true, options: [{ name: "--only", meaning: "Some generators." }], examples: ["repoctl sync --check  # Write nothing."], page: "programs/p/verb-sync.html" }],
  });
  const b = freshBuild();
  const make = await lens.read(b, [], []);
  make(b, 100);
  assertEquals(b.found.map((f) => `${f.where}: ${f.problem.kind}`), ["nowhere/none.md: undescribed"]);
  assertEquals(b.pages.map((p) => p.path).sort(), ["repo-ops/ci-cd.html", "repo-ops/release.html", "repo-ops/repoctl.html"]);
  assert(b.pages.every((p) => p.section === "repoops" && p.group === "Repo Ops"), "every page is in the section");
  const ci = text(b.pages.find((p) => p.path === "repo-ops/ci-cd.html")?.blocks);
  assertStringIncludes(ci, ".github/workflows/x.auto.yml");
  assertStringIncludes(ci, "one, two");
  assertStringIncludes(text(b.pages.find((p) => p.path === "repo-ops/release.html")?.blocks), "Distribution mode");
  const verbs = text(b.pages.find((p) => p.path === "repo-ops/repoctl.html")?.blocks);
  assertStringIncludes(verbs, "repoctl sync --check  # Write nothing.");
  assertStringIncludes(verbs, "programs/p/verb-sync.html");
  assertStringIncludes(verbs, "--only");
  assert(SECTIONS.some((s) => s.section === "repoops" && s.label === "Repo Ops" && s.home === "repo-ops/index.html"), "the section is in the top bar");
});

proves(["0001-docs FR-029"], "a page with no typed facts given says there are none and makes no row up", async () => {
  const lens = repoOpsLens({ name: "ops", pages: [{ file: "commons/docs/guides/ops-ci-cd.md", path: "repo-ops/ci-cd.html", order: 1, generated: "workflows" }] });
  const b = freshBuild();
  (await lens.read(b, [], []))(b, 100);
  assertStringIncludes(text(b.pages[0]?.blocks), "No workflow was given to this page.");
});

proves(["0001-docs FR-029"], "the site of commons has the section Repo Ops with every workflow and every verb read from their typed definitions, its links to other pages resolve, and the top bar names it", async () => {
  const built = await buildSite(CONFIG);
  assertEquals(built.found, []);
  const ops = built.pages.filter((p) => p.section === "repoops").map((p) => p.path).sort();
  assertEquals(ops, ["repo-ops/ci-cd.html", "repo-ops/dev-loop.html", "repo-ops/index.html", "repo-ops/release.html", "repo-ops/repoctl.html"]);
  const { workflows } = await viaRoot<{ workflows: () => readonly { file: string }[] }>("commons/libraries/src/workflows/definitions.ts");
  const { VERBS } = await viaRoot<{ VERBS: Record<string, { id: string; summary: string }> }>("commons/repoctl/src/governance/verbs.ts");
  const ci = text(built.pages.find((p) => p.path === "repo-ops/ci-cd.html")?.blocks);
  for (const w of workflows()) assertStringIncludes(ci, `.github/workflows/${w.file}.auto.yml`);
  const repoctl = text(built.pages.find((p) => p.path === "repo-ops/repoctl.html")?.blocks);
  for (const v of Object.values(VERBS)) {
    assertStringIncludes(repoctl, `repoctl ${v.id}`);
    assertStringIncludes(repoctl, v.summary.replace(/"/g, '\\"'));
  }
  assertStringIncludes(repoctl, "explain");
  assertStringIncludes(text(built.pages.find((p) => p.path === "repo-ops/release.html")?.blocks), "@intellectual-frontiers/commons");
  const hub = built.pages.find((p) => p.path === "repo-ops/index.html");
  assert(hub !== undefined, "the hub page is there");
  assertStringIncludes(text(hub?.blocks), "quality/index.html");
  const html = document(hub as NonNullable<typeof hub>, { name: "N", repository: "r", pages: built.pages });
  assertStringIncludes(html, "Repo Ops");
});

proves(["0001-docs FR-029"], "a Markdown link written site:<path> goes to that page of the site, with its anchor, and any other destination is resolved as before", () => {
  const b = freshBuild();
  const scope = { page: "repo-ops/index.html", file: "commons/docs/guides/ops-index.md" };
  assertEquals(hrefFor("site:quality/index.html", b.index, scope), { kind: "page", path: "quality/index.html" });
  assertEquals(hrefFor("site:quality/ci.html#dora", b.index, scope), { kind: "page", path: "quality/ci.html", anchor: "dora" });
  assertEquals(hrefFor("https://example.org/x", b.index, scope), { kind: "external", url: "https://example.org/x" });
});
