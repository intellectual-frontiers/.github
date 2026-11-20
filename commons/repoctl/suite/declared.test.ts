/**
 * Tests of the packages a library imports and does not declare (commons repoctl 0003-repoctl-sync FR-010): what a source, a test or a tool imports by name, and the `node:` built-ins, against the library's manifest;; the real repository's own report is in `check.test.ts`.
 *
 * @module
 */
import { assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { declaredNames, importedPackages, undeclaredFindings } from "@intellectual-frontiers/repoctl/logical";

const lib = (manifest: string, ...sources: readonly (readonly [string, string])[]) => ({ name: "a", folder: "commons/a", manifest, sources: sources.map(([path, text]) => ({ path: `commons/a/${path}`, text })) });

proves(["0003-repoctl-sync FR-010"], "a package or a node: import that the manifest does not declare is found with its file and line; the library itself, relative and bun: imports and block comments are not", () => {
  const text = [
    "/** @example",
    " * import { z } from \"in-a-comment\";",
    " */",
    "import { a } from \"left-pad\";",
    "import { b } from \"@scope/pkg/sub\";",
    "import { c } from \"./local.ts\";",
    "import { d } from \"@intellectual-frontiers/a\";",
    "import { test } from \"bun:test\";",
    "import { e } from \"node:fs\";",
    "export { f } from \"declared\";",
    "import \"side-effect\";",
    "import {",
    "  g,",
    "} from \"multi-line\";",
    "",
  ].join("\n");
  assertEquals([...importedPackages({ path: "x.ts", text })], [["left-pad", 4], ["@scope/pkg", 5], ["@intellectual-frontiers/a", 7], ["@types/node", 9], ["declared", 10], ["side-effect", 11], ["multi-line", 14]]);
  const manifest = JSON.stringify({ dependencies: { declared: "1.0.0" }, devDependencies: { "side-effect": "1.0.0" } });
  assertEquals([...declaredNames(manifest)].sort(), ["declared", "side-effect"]);
  const found = undeclaredFindings([lib(manifest, ["suite/x.test.ts", text])]);
  assertEquals(found.map((f) => `${f.level} ${f.code}`), ["fail E-UNDECLARED-DEPENDENCY", "fail E-UNDECLARED-DEPENDENCY", "fail E-UNDECLARED-DEPENDENCY", "fail E-UNDECLARED-DEPENDENCY"]);
  assertEquals(found.map((f) => f.message.split(" imports ")[1]?.split(",")[0]), ["@scope/pkg", "@types/node", "left-pad", "multi-line"]);
  assertStringIncludes(found[1]?.message ?? "", "commons/a/suite/x.test.ts:9 imports @types/node");
  assertStringIncludes(found[1]?.fix ?? "", "@types/node (exact version)");
  assertEquals(undeclaredFindings([lib(JSON.stringify({ devDependencies: { "left-pad": "1", "@scope/pkg": "1", "@types/node": "1", "multi-line": "1", "@intellectual-frontiers/a": "link:." } }), ["src/x.ts", text.replace("declared", "left-pad").replace("side-effect", "left-pad")])]), []);
  assertEquals(undeclaredFindings([lib("not json", ["src/x.ts", 'import { a } from "left-pad";'])]).length, 1);
});
