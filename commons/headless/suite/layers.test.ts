/**
 * Tests of the layers check (`tools/layers.ts`) and of the check that runs it (`tools/check.ts`): every file is in one unit, imports point one way, units reach
 * each other only through the package's `exports`, each unit imports only what its row allows, and a surface has a row (commons headless 0001-headless-layers
 * FR-001 to FR-008).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { findings as allFindings } from "../tools/check.ts";
import { allowedExternal, externalsOf, layerFindings, MAY_IMPORT, specifiersOf, SURFACES, unitOf, type LayerFinding } from "../tools/layers.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const PKG = "@intellectual-frontiers/headless";
/** A step up, written so that this file does not itself read as an import of a file outside the library. */
const UP = "../";
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./cli": "./src/surfaces/cli/mod.ts",
  "./otel": "./src/otel/mod.ts",
};
const at = (path: string, text: string) => ({ path, text });
const rules = (files: readonly { path: string; text: string }[]): string[] => layerFindings(files, EXPORTS).map((f: LayerFinding) => f.rule);

async function realFiles(): Promise<readonly { path: string; text: string }[]> {
  return [...(await runtime.readSources(ROOT, ["about.ts", "src", "tools"])), ...(await runtime.readSources(ROOT, ["suite"]))];
}

proves(["0001-headless-layers FR-001", "0001-headless-layers FR-002", "0001-headless-layers FR-003", "0001-headless-layers FR-004", "0001-headless-layers FR-005"], "the real tree has no finding of the layers check", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS, "the table's entries are the package's exports");
  const files = await realFiles();
  assert(files.length > 40, "the check read the library");
  assertEquals(layerFindings(files, pkg.exports), []);
});

proves(["0001-headless-layers FR-001"], "every file is in one unit, and a file in none is layers/unclassified", () => {
  const units: readonly [string, string, string][] = [
    ["about.ts", "(root)", "root"],
    ["library.ts", "(root)", "root"],
    ["src/mod.ts", "(entry)", "root"],
    ["src/governance/action.ts", "src/governance/", "governance"],
    ["src/logical/model.ts", "src/logical/", "logical"],
    ["src/surfaces/cli/run.ts", "src/surfaces/cli/", "surface"],
    ["src/otel/mod.ts", "src/otel/", "adapter"],
    ["suite/x.test.ts", "suite/", "suite"],
    ["tools/check.ts", "tools/", "tools"],
  ];
  for (const [file, name, cls] of units) assertEquals([unitOf(file)?.name, unitOf(file)?.class], [name, cls], file);
  for (const none of ["src/stray.ts", "src/surfaces/stray.ts", "src/surfaces/mcp/server.ts", "docs/readme.ts", "spec-kit/specs/x.ts", "README.md"]) assertEquals(unitOf(none), undefined, none);
  assertEquals(rules([at("src/stray.ts", "export const x = 1;\n")]), ["layers/unclassified"]);
  assertEquals(rules([at("src/governance/a.ts", "export const x = 1;\n")]), []);
});

proves(["0001-headless-layers FR-002"], "imports point one way: below may not import above, and a surface may not import another surface", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/cli";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/cli";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/otel";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/logical";\nimport { y } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/otel/a.ts", `import { x } from "${PKG}/cli";\n`)]), []);
  // a surface beside another
  const both = { ...SURFACES };
  assert(Object.keys(both).includes("cli"));
  assertEquals(MAY_IMPORT.surface.includes("surface"), false);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}";\n`)]), ["layers/above"], "the package's entry is above the layers");
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/cli";\n`)]), [], "a unit may always import itself");
  // the specifiers are read in every form
  const text = [`import a from "./a.ts";`, `import type { B } from "../b.ts";`, `export { c } from "@x/c";`, `export * from "@x/d";`, `import "@x/side";`, `const e = await import("@x/dyn");`, `// import z from "@x/comment";`, ` * import y from "@x/doc";`, `import {`, `  f,`, `} from "@x/multi";`].join("\n");
  assertEquals(
    specifiersOf(text).map((s) => s.specifier),
    ["./a.ts", "../b.ts", "@x/c", "@x/d", "@x/side", "@x/dyn", "@x/multi"],
  );
});

proves(["0001-headless-layers FR-003"], "a file of one unit reaches another through the package's exports, never by a relative path, and a name exports does not name is layers/private", () => {
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/action.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${UP}${UP}logical/model.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "./model.ts";\n`)]), [], "inside the unit a relative import is fine");
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance/action";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/nothing";\n`)]), ["layers/private"]);
  for (const own of ["suite/a.test.ts", "tools/a.ts", "src/mod.ts", "about.ts"]) assertEquals(rules([at(own, `import { x } from "../src/logical/model.ts";\n`)]), [], `${own} is the library's own checking: it may import any file`);
});

proves(["0001-headless-layers FR-004"], "each unit imports only what its row allows: governance Core, logical Core and the terminal's args and commands, the command line Core, the terminal and the system, the adapter Core and the telemetry", () => {
  const ok = (file: string, spec: string) => assertEquals(rules([at(file, `import { x } from "${spec}";\n`)]), [], `${file} may import ${spec}`);
  const no = (file: string, spec: string) => assertEquals(rules([at(file, `import { x } from "${spec}";\n`)]), ["layers/external"], `${file} may not import ${spec}`);
  ok("src/governance/a.ts", "@intellectual-frontiers/core");
  no("src/governance/a.ts", "@intellectual-frontiers/terminal/args");
  no("src/governance/a.ts", "@intellectual-frontiers/system");
  no("src/governance/a.ts", "node:fs");
  ok("src/logical/a.ts", "@intellectual-frontiers/terminal/args");
  ok("src/logical/a.ts", "@intellectual-frontiers/terminal/commands");
  no("src/logical/a.ts", "@intellectual-frontiers/terminal/palette");
  no("src/logical/a.ts", "@intellectual-frontiers/terminal");
  no("src/logical/a.ts", "@intellectual-frontiers/system");
  no("src/logical/a.ts", "@intellectual-frontiers/telemetry");
  no("src/logical/a.ts", "fast-check");
  for (const s of ["@intellectual-frontiers/core", "@intellectual-frontiers/terminal/palette", "@intellectual-frontiers/terminal/width", "@intellectual-frontiers/terminal/args", "@intellectual-frontiers/system"]) ok("src/surfaces/cli/a.ts", s);
  no("src/surfaces/cli/a.ts", "node:fs");
  no("src/surfaces/cli/a.ts", "@intellectual-frontiers/net");
  ok("src/otel/a.ts", "@intellectual-frontiers/telemetry/signals");
  ok("src/otel/a.ts", "@intellectual-frontiers/core");
  no("src/otel/a.ts", "@intellectual-frontiers/system");
  assert(allowedExternal([{ name: "@a/b", subpaths: "any" }], "@a/b/c/d"));
  assert(!allowedExternal([{ name: "@a/b", subpaths: ["x"] }], "@a/b/y") && !allowedExternal([{ name: "@a/b", subpaths: [] }], "@a/bc"));
  assertEquals(externalsOf({ name: "src/governance/", class: "governance" }).map((a) => a.name), ["@intellectual-frontiers/core"]);
});

proves(["0001-headless-layers FR-005"], "the command-line surface may not import the telemetry; only the adapter may", () => {
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "@intellectual-frontiers/telemetry/signals";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "@intellectual-frontiers/telemetry";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/otel/a.ts", `import { x } from "@intellectual-frontiers/telemetry";\n`)]), []);
  for (const surface of Object.keys(SURFACES)) assert(!(SURFACES[surface] ?? []).some((a) => a.name.endsWith("/telemetry")), surface);
});

proves(["0001-headless-layers FR-006"], "a surface is one folder with one row of the table; a folder with no row is layers/unclassified, and its row says what it may import", () => {
  assertEquals(Object.keys(SURFACES), ["cli"]);
  assertEquals(rules([at("src/surfaces/mcp/server.ts", `export const x = 1;\n`)]), ["layers/unclassified"]);
  assertEquals(rules([at("src/surfaces/rest/routes.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/unclassified"]);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(
    externalsOf({ name: "src/surfaces/cli/", class: "surface" }).map((a) => a.name),
    ["@intellectual-frontiers/core", "@intellectual-frontiers/terminal", "@intellectual-frontiers/system"],
  );
  assertEquals(externalsOf({ name: "src/surfaces/mcp/", class: "surface" }), [], "a surface without a row may import nothing");
});

proves(["0001-headless-layers FR-007"], "the check holds the findings of the layers and of the trace against the baseline, which only shrinks, and verify runs it", async () => {
  const found = await allFindings(ROOT);
  assertEquals(found.filter((f) => f.key.startsWith("layers/")), []);
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  assertStringIncludesAll(pkg.scripts["verify"] ?? "", ["bun tools/check.ts", "bun tools/pack.ts --check", "bun test suite/"]);
  const baseline = await fs.readTextFile(path.join(ROOT, "trace.baseline.txt"));
  assertEquals(baseline.split("\n").filter((l) => l !== "" && !l.startsWith("#")), [], "nothing is held: the library has no finding to hold");
});

function assertStringIncludesAll(text: string, parts: readonly string[]): void {
  for (const p of parts) assert(text.includes(p), `${p} in ${text}`);
}

proves(["0001-headless-layers FR-008"], "the manifest agrees with the folder: the entries, the name, the level, the version and the distribution", async () => {
  const { library } = await import("../library.ts");
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; private: boolean; exports: Record<string, string>; engines: { node: string } };
  assertEquals([library.name, library.level, library.distribution], ["headless", "L1", ["github", "npm"]]);
  assertEquals(library.version, pkg.version);
  assertEquals(library.exports, Object.keys(pkg.exports));
  assertEquals([pkg.name, pkg.private, pkg.engines.node], ["@intellectual-frontiers/headless", true, ">=26"]);
  for (const target of Object.values(pkg.exports)) assert(await fs.exists(path.join(ROOT, target)), target);
});
