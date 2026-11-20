/**
 * The program lens (commons 0011-documentation FR-030): given the models of a program (one for each tier, with the same element ids), it makes a page set for each tier and never merges two, lists a verb a tier cannot
 * see with the reason, shows a verb's action, options and what it is drawn as, adds the JSON of each model, and makes the same pages from the same models.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import type { LayeredModel } from "../layered.ts";
import { programLens } from "../lens/program.ts";
import { markdownOf } from "../emit/markdown.ts";
import { brokenLinks } from "../site.ts";
import { freshBuild } from "./helpers.ts";

const layers = [
  { id: "governance", title: "Governance", summary: "What an action is and may do.", kinds: ["action", "problem-code", "outcome"] },
  { id: "logical", title: "Logical", summary: "The program's tree.", kinds: ["program", "verb", "option", "operand"] },
  { id: "physical", title: "Surfaces", summary: "What each surface draws.", kinds: ["cli-command", "mcp-tool", "rest-route"] },
];
const tierModel = (tier: "user" | "admin"): LayeredModel => {
  const seeAdd = tier === "admin";
  return {
    name: `tool-${tier}`,
    library: "headless",
    title: `tool for ${tier}`,
    summary: `The program tool, as the ${tier} tier sees it.`,
    layers,
    elements: [
      { id: "headless:tool", layer: "logical", kind: "program", name: "tool", definition: "A small tool.", properties: {}, source: { file: "tool", line: 1 } },
      { id: "action:tool/repos list", layer: "governance", kind: "action", name: "repos list", definition: "Lists repositories.", properties: { effect: "read", idempotent: true }, source: { file: "tool", line: 1 } },
      { id: "verb:tool/repos list", layer: "logical", kind: "verb", name: "repos list", definition: "Lists repositories.", parent: "headless:tool", properties: { effect: "read", origin: "tool", path: ["repos", "list"], examples: ["tool repos list  # all of them"], notProjected: [] }, source: { file: "tool", line: 1 } },
      { id: "option:verb:tool/repos list#--json", layer: "logical", kind: "option", name: "--json", definition: "Print JSON.", parent: "verb:tool/repos list", properties: { type: "boolean" } },
      { id: "cli:tool/repos list", layer: "physical", kind: "cli-command", name: "tool repos list", definition: "Lists repositories.", properties: { usage: "tool repos list" } },
      { id: "verb:tool/repos add", layer: "logical", kind: "verb", name: "repos add", definition: "Adds a repository.", parent: "headless:tool", properties: { effect: "write", origin: "tool", path: ["repos", "add"], examples: [], notProjected: seeAdd ? [] : ["cli: the user tier cannot see it", "mcp: the user tier cannot see it", "rest: the user tier cannot see it"] }, source: { file: "tool", line: 1 } },
      ...(seeAdd ? [{ id: "cli:tool/repos add", layer: "physical", kind: "cli-command", name: "tool repos add", definition: "Adds a repository.", properties: { usage: "tool repos add" } }] : []),
      { id: "problem-code:tool/E-NOREPO", layer: "governance", kind: "problem-code", name: "E-NOREPO", definition: "There is no such repository.", properties: {} },
      { id: "outcome:tool/denied", layer: "governance", kind: "outcome", name: "denied", definition: "The tier may not do it.", properties: {} },
    ],
    trace: [
      { from: "action:tool/repos list", to: "verb:tool/repos list", how: "projects to" },
      { from: "verb:tool/repos list", to: "cli:tool/repos list", how: "projects to" },
      ...(seeAdd ? [{ from: "verb:tool/repos add", to: "cli:tool/repos add", how: "projects to" }] : []),
    ],
    findings: seeAdd ? [] : [{ rule: "describe/tier-hidden", element: "verb:tool/repos add", message: "the user tier cannot see it" }],
  };
};
const models = [tierModel("user"), tierModel("admin")];
const lens = programLens({ name: "programs", source: () => models });
const twin = (pages: readonly { path: string }[], path: string): string => markdownOf(pages.find((p) => p.path === path) as never);

proves(["0011-documentation FR-030"], "the lens makes a page set for each tier with the same element ids and never merges them: a verb a tier cannot see is listed there with the reason and without a command, and the other tier draws it; links resolve", async () => {
  const b = freshBuild();
  const make = await lens.read(b, [], []);
  assert(make(b, 300) > 300);
  assertEquals(b.pages.map((p) => p.path).sort(), [
    "programs/index.html", "programs/tool-admin/index.html", "programs/tool-admin/verb-repos-add.html", "programs/tool-admin/verb-repos-list.html",
    "programs/tool-user/index.html", "programs/tool-user/verb-repos-add.html", "programs/tool-user/verb-repos-list.html",
  ]);
  assertEquals(brokenLinks(b.pages).map((f) => f.problem), []);
  const user = twin(b.pages, "programs/tool-user/index.html");
  assertStringIncludes(user, "the user tier cannot see it");
  assertStringIncludes(user, "describe/tier-hidden");
  assertStringIncludes(user, "E-NOREPO");
  assertStringIncludes(user, "denied");
  assertStringIncludes(twin(b.pages, "programs/tool-user/verb-repos-add.html"), "Not drawn by any surface for this tier.");
  assertStringIncludes(twin(b.pages, "programs/tool-admin/verb-repos-add.html"), "tool repos add");
  const list = twin(b.pages, "programs/tool-admin/verb-repos-list.html");
  assertStringIncludes(list, "--json");
  assertStringIncludes(list, "tool repos list  # all of them");
  assertStringIncludes(list, "Governance: the action");
  assertEquals(b.found, []);
});

proves(["0011-documentation FR-030"], "the JSON of each model and of the list is added to the site, and the same models give the same pages", async () => {
  const run = async () => {
    const b = freshBuild();
    const make = await lens.read(b, [], []);
    make(b, 300);
    return { pages: b.pages.map((p) => markdownOf(p)), files: lens.files?.(b) ?? [] };
  };
  const one = await run();
  assertEquals(one, await run());
  assertEquals(one.files.map((f) => f.path), ["programs/tool-user.json", "programs/tool-admin.json", "programs/index.json"]);
  assertEquals(JSON.parse(one.files[2]?.text ?? "[]").map((m: { name: string; findings: number }) => [m.name, m.findings]), [["tool-user", 1], ["tool-admin", 0]]);
});
