/**
 * The site of a repository of libraries (commons 0011-documentation FR-031): a module comment is found after a `//` header line, an area's folder may be named, a kit belongs to the library whose folder holds it, and commons' own
 * site has a page for every library, an API for each, and its specifications under the library that keeps them.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { kitNameOf } from "../src/pages/specs.ts";
import { areasOf } from "../src/sources.ts";
import { moduleComment } from "../src/tsdoc.ts";

import { siteOnce } from "./helpers.ts";

proves(["0011-documentation FR-031"], "a module comment is found after `// Spec:` lines, a kit belongs to the library whose folder holds it, and an area's folder is the one it names", () => {
  assertEquals(moduleComment("// Spec: 0001-core FR-001\n/**\n * What it is.\n *\n * @module\n */\nexport {};\n")?.summary.trim(), "What it is.");
  assertEquals(moduleComment("// Spec: x\n/** No tag. */\nexport {};\n"), undefined);
  assertEquals([kitNameOf("commons/core/spec-kit"), kitNameOf("commons/spec-kit"), kitNameOf("specs")], ["core", "commons", ""]);
  const pkg = { dir: "lib/p", slug: "p", file: "lib/p/about.ts", about: { title: "P", summary: "S", areas: [{ title: "A", slug: "a", entryPoints: ["src/a/mod.ts", "src/b/mod.ts"], folder: "src" }] } };
  assertEquals(areasOf([pkg]).map((a) => a.dir), ["lib/p/src"]);
});

proves(["0011-documentation FR-031"], "commons' site has a page and an API for every library, shows each library's specifications on its page, and groups the specifications by the library that keeps them", async () => {
  const built = await siteOnce();
  assertEquals(built.found, []);
  const paths = new Set(built.pages.map((p) => p.path));
  for (const lib of ["core", "data", "headless", "kanon", "repoctl", "integrations"]) {
    assert(paths.has(`overview/${lib}.html`), `a page for ${lib}`);
    assert(paths.has(`api/${lib}/index.html`), `an API for ${lib}`);
  }
  const data = built.pages.find((p) => p.path === "overview/data.html");
  assertStringIncludes(JSON.stringify(data?.blocks), "Specifications");
  const register = built.pages.find((p) => p.path === "specs/index.html");
  assertStringIncludes(JSON.stringify(register?.blocks), '"text":"Data"');
  assertEquals(built.pages.find((p) => p.path === "specs/0001-core.html")?.group, "Core");
});
