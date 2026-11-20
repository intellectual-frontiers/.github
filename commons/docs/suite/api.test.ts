/**
 * The API reader (commons 0011-documentation FR-006, FR-010), on the fixture area: each kind of export, an alias followed, a namespace
 * walked into, signatures as the checker prints them, TSDoc read into its parts, and a page for each source file.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { declarationText, functionSignature, readApi } from "../src/extract/api.ts";
import { apiPages, registerApi } from "../src/pages/api.ts";
import { fixtureArea, freshBuild, ROOT } from "./helpers.ts";

const api = await readApi(ROOT, [{ slug: "fixture", entryPoints: ["commons/docs/suite/fixture/mod.ts"] }]);
const exports = api[0]?.exports ?? [];
const byName = new Map(exports.map((e) => [e.name, e]));

proves(["0011-documentation FR-010"], "every export with its kinds, a namespace walked into, in the order the entry point exports them", () => {
  assertEquals(
    exports.map((e) => `${e.name}:${e.kinds.join("+")}`),
    ["shapes:namespace", "shapes.square:const", "Greeting:interface", "Mood:type", "FIRST:const", "greet:function"],
  );
  assertEquals(byName.get("shapes.square")?.file, "commons/docs/suite/fixture/shapes.ts");
});

proves(["0011-documentation FR-010"], "signatures as the checker prints them, and types as their source writes them", () => {
  assertEquals(byName.get("greet")?.signature, "function greet(who: string, mood: Mood): Greeting");
  assertEquals(byName.get("FIRST")?.signature, "const FIRST: Greeting");
  assertStringIncludes(byName.get("Mood")?.signature ?? "", 'type Mood = { readonly kind: "calm" }');
  assertEquals(byName.get("Greeting")?.signature, "interface Greeting");
  assertEquals(byName.get("Greeting")?.members.map((m) => `${m.name}${m.optional ? "?" : ""}: ${m.type}`), ["who: string", "warmth?: number"]);
  assertEquals(functionSignature("f", "<T>(a: T) => (b: T) => T"), "function f<T>(a: T): (b: T) => T");
  assertEquals(declarationText("\n/** doc */\nexport type A = 1;"), "type A = 1;");
});

proves(["0011-documentation FR-006"], "TSDoc read into its summary, parameters, what it returns and examples; a module comment's @limits", () => {
  const d = byName.get("greet")?.doc;
  assertStringIncludes(d?.summary ?? "", "A greeting for someone");
  assertEquals(d?.params.map((p) => `${p.name}=${p.text}`), ["who=who to greet", "mood=how"]);
  assertEquals(d?.returns, "the greeting");
  assertEquals(d?.examples.length, 1);
  assertEquals(byName.get("shapes")?.doc.isModule, true, "a namespace's documentation is its module comment");
});

proves(["0011-documentation FR-010", "0011-documentation FR-006"], "a page for each source file, an anchor for each export, the module's limits", () => {
  const b = freshBuild();
  const area = fixtureArea("fixture", "mod.ts");
  const modules = registerApi(b, [area], api);
  apiPages(b, [area], api, modules);
  assertEquals(b.pages.map((p) => p.path), ["api/fixture/shapes.html", "api/fixture/mod.html"]);
  const mod = b.pages[1];
  assert(mod !== undefined);
  assertEquals(mod.blocks.filter((x) => x.kind === "entry").map((x) => (x.kind === "entry" ? x.id : "")), ["Greeting", "Mood", "FIRST", "greet"]);
  assert(mod.blocks.some((x) => x.kind === "callout" && x.tone === "limit"), "the module's @limits is on its page");
  assertEquals(b.found, []);
});
