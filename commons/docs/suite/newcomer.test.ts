/**
 * The newcomer questions (commons 0011-documentation FR-036): five questions a person or an agent with no context asks of a repository, each answered from the site alone, by its search (the same words-all-present rule the script
 * uses) and by the text of the page it finds; and the site names no retired library and no history in the pages people write.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { markdownOf } from "../emit/markdown.ts";
import { searchIndex } from "../emit/search.ts";
import { buildSite, wordFindings } from "../site.ts";
import { CONFIG } from "./helpers.ts";

const find = (rows: ReturnType<typeof searchIndex>, query: string): string[] => {
  const words = query.toLowerCase().split(/\s+/);
  return rows
    .filter(([title, , where]) => words.every((w) => `${title} ${where}`.toLowerCase().includes(w)))
    .sort((a, b) => (a[0].toLowerCase() === query.toLowerCase() ? -1 : 0) - (b[0].toLowerCase() === query.toLowerCase() ? -1 : 0) || a[0].length - b[0].length)
    .map((r) => r[1]);
};

proves(["0011-documentation FR-036"], "five questions a newcomer asks are answered from the site alone: the front door, what a library imports, where a requirement is proved, where a command is described, and how a release is made", async () => {
  const built = await buildSite(CONFIG);
  const rows = searchIndex(built.pages);
  const text = (path: string): string => {
    const p = built.pages.find((x) => x.path === path.split("#")[0]);
    assert(p !== undefined, `the page ${path} exists`);
    return markdownOf(p);
  };
  // 1. what do I run first? the front door, ergonex
  assertEquals(find(rows, "start here")[0]?.startsWith("start/"), true);
  assertStringIncludes(text("start/new-developer.html"), "ergonex");
  assertStringIncludes(text("start/new-developer.html"), "front door");
  // 2. which libraries does headless import?
  assertStringIncludes(text("overview/headless.html"), "Imports");
  assertStringIncludes(text("overview/map.html"), "headless");
  // 3. where is a requirement proved? the spec page says which test names it
  assertStringIncludes(text("specs/0060-flow-ledger.html"), "suite/flow.test.ts");
  // 4. where is a command of ergonex described, with the tools and routes it is drawn as?
  assert(find(rows, "ergonex administrator").length > 0, "the programs are found by search");
  assertStringIncludes(text("programs/ergonex-administrator/verb-doctor.html"), "Governance: the action");
  // the license is on the page of every library, and the licensing page is in the site
  assertStringIncludes(text("overview/core.html"), "PolyForm-Noncommercial-1.0.0");
  assertStringIncludes(text("start/licensing.html"), "PolyForm Noncommercial License");
  // 5. how is a release made?
  assertStringIncludes(text("how-to/cut-a-release.html"), "bun run release apply");
  assertStringIncludes(text("concepts/release-loop.html"), "dev:check");
});

proves(["0011-documentation FR-036"], "a page that names a retired library, or a page people write that uses a word of history, is a finding, and commons' site has neither", async () => {
  const page = { path: "start/x.html", title: "X", description: "d", section: "start" as const, group: "g", order: 0, blocks: [{ kind: "paragraph" as const, inlines: [{ kind: "text" as const, text: "It was formerly the SQL Aide." }] }] };
  const found = wordFindings([page, { ...page, path: "specs/y.html", section: "specs" as const }], ["SQL Aide"], ["formerly"]);
  assertEquals(found.map((f) => `${f.where} ${f.problem.kind}`), ["start/x.html retired-name", "start/x.html forbidden-word", "specs/y.html retired-name"]);
  const built = await buildSite(CONFIG);
  assertEquals(wordFindings(built.pages, CONFIG.retired, CONFIG.forbiddenInGuides), []);
  assert(CONFIG.retired.length > 0 && CONFIG.forbiddenInGuides.length > 0, "commons' configuration names them");
});
