/**
 * The one package of commons (commons 0001-libraries FR-028 to FR-031): the mode, the keys of the `exports`, the rewriting of specifiers, the union of dependencies, the commands, what runs when a file is loaded, and the packer on a small repository
 * of real files (real folders, the real compiler, a real tarball) with each check that matters broken in a copy and named. The proof on the whole of commons, installed with npm and Bun, is `tests/release/commons-package.test.ts`.
 *
 * @module
 */
import { existsSync as existsSyncOf, mkdirSync, readTextFileSync, removeSync, symlinkSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { importSpecifiers } from "../src/scan.ts";
import { filesUnder } from "../src/pack-library.ts";
import { activeMode, DISTRIBUTION, DISTRIBUTION_MODES, parseMode, SINGLE_PEERS } from "../src/distribution.ts";
import {
  type Command,
  commandsOf,
  exportKey,
  exportsMap,
  type Facts,
  inspectCommons,
  kindOf,
  launcherOf,
  oldSpecifiers,
  packCommons,
  peersOf,
  rewriteSpecifiers,
  NOT_RUNTIME,
  runsWhenLoaded,
  staticSpecifiers,
  toolsFindingsOf,
  toolsOfLibraries,
  unionDependencies,
  packableLibraries,
  factsOf,
} from "../src/pack-commons.ts";
import { devDependenciesOf, importedPackages, linkTools, readLock, toolFindings, toolsOf, typesPackageOf, writeTools } from "../src/pack-tools.ts";

const SPEC = "0001-libraries";
const LIBRARIES = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const REPO = resolve(LIBRARIES, "..", "..");

const facts = (name: string, extra: Partial<Facts> = {}): Facts => ({
  name,
  dir: name,
  version: "0.1.0",
  summary: `${name}.`,
  exports: { ".": "./src/mod.ts" },
  roots: ["src"],
  folders: [],
  bin: {},
  dependencies: {},
  peers: {},
  devDependencies: {},
  held: false,
  ...extra,
});

proves([`${SPEC} FR-028`], "the mode is one of two, the repository is in single mode, the environment names the other for one run and a value that is no mode is refused", () => {
  assertEquals([...DISTRIBUTION_MODES], ["per-library", "single"]);
  assertEquals(DISTRIBUTION, "single");
  assertEquals(parseMode("single").kind, "ok");
  assertEquals(parseMode("both").kind, "err");
  assertEquals(activeMode(undefined), { kind: "ok", value: "single" });
  assertEquals(activeMode("per-library"), { kind: "ok", value: "per-library" });
  const bad = activeMode("Single");
  assert(bad.kind === "err");
  assertStringIncludes(bad.error, "IFC_DISTRIBUTION");
});

proves([`${SPEC} FR-029`], "each library is mapped to ./<library> and ./<library>/<subpath>, so that the subpaths of two libraries do not collide, each entry naming its types, its source and its compiled file", () => {
  assertEquals(exportKey("core", "."), "./core");
  assertEquals(exportKey("anyfs", "./governance"), "./anyfs/governance");
  const map = exportsMap([facts("a", { exports: { ".": "./src/mod.ts", "./governance": "./src/governance/mod.ts" } }), facts("b", { exports: { "./governance": "./src/governance/mod.ts" } })]);
  assertEquals(Object.keys(map), ["./a", "./a/governance", "./b/governance"]);
  assertEquals(map["./b/governance"], { types: "./b/dist/src/governance/mod.d.ts", bun: "./b/src/governance/mod.ts", default: "./b/src/governance/mod.js" });
});

proves([`${SPEC} FR-029`], "an import of a library is written as an import of the package, in code and in the example of a comment; a string that is no import, a name that is no library and the examples of a Markdown fence are left or found", () => {
  const names = new Set(["core", "anyfs-sql"]);
  const source = [
    "/**",
    ' * import { ok } from "@intellectual-frontiers/core";',
    " */",
    'import { err } from "@intellectual-frontiers/core";',
    'import type { X } from "@intellectual-frontiers/anyfs-sql/pglite";',
    'export * from "@intellectual-frontiers/core/sub";',
    'const t = await import("@intellectual-frontiers/core");',
    'const names = ["@intellectual-frontiers/core"];',
    'const generated = `import { z } from "@intellectual-frontiers/core";`;',
    'const quoted = \'import { z } from "@intellectual-frontiers/core"\';',
  ].join("\n");
  const r = rewriteSpecifiers(source, names);
  assertEquals(r.unknown, []);
  assertStringIncludes(r.text, ' * import { ok } from "@intellectual-frontiers/commons/core";');
  assertStringIncludes(r.text, 'import { err } from "@intellectual-frontiers/commons/core";');
  assertStringIncludes(r.text, '"@intellectual-frontiers/commons/anyfs-sql/pglite"');
  assertStringIncludes(r.text, 'export * from "@intellectual-frontiers/commons/core/sub";');
  assertStringIncludes(r.text, 'import("@intellectual-frontiers/commons/core")');
  assertStringIncludes(r.text, 'const names = ["@intellectual-frontiers/core"];');
  assertStringIncludes(r.text, 'const generated = `import { z } from "@intellectual-frontiers/core";`;');
  assertStringIncludes(r.text, "const quoted = 'import { z } from \"@intellectual-frontiers/core\"';");
  assertEquals(oldSpecifiers(r.text), []);
  assertEquals(oldSpecifiers(source).length, 4);
  assertEquals(rewriteSpecifiers('import "@intellectual-frontiers/nowhere/x";', names).unknown, ["@intellectual-frontiers/nowhere/x"]);
  assertEquals(rewriteSpecifiers('import "@intellectual-frontiers/commons";', names).unknown, ["@intellectual-frontiers/commons"]);
  assertEquals(importSpecifiers('import a from "./a.ts";\nconst s = "import b from \\"./b.ts\\"";'), ["./a.ts"]);
});

proves(["0001-libraries FR-029"], "package rewriting recognizes literal templates and TypeScript import assignments", () => {
  const input = [
    'import x = require("@intellectual-frontiers/core");',
    'const lazy = () => import(`@intellectual-frontiers/core`);',
    "const example = 'import(\"@intellectual-frontiers/core\")';",
  ].join("\n");
  const output = rewriteSpecifiers(input, new Set(["core"]));
  assertEquals(output.unknown, []);
  assertStringIncludes(output.text, 'require("@intellectual-frontiers/commons/core")');
  assertStringIncludes(output.text, 'import(`@intellectual-frontiers/commons/core`)');
  assertStringIncludes(output.text, input.split("\n").at(-1) ?? "");
});

proves([`${SPEC} FR-029`], "the dependencies are the union of what the libraries need at run time and the package installs, each exact; two versions of one package and a version that is not exact are findings; what the package asks of the consumer is a peer and never installed", () => {
  const u = unionDependencies([facts("a", { dependencies: { left: "1.0.0" } }), facts("b", { dependencies: { left: "1.0.0", right: "2.0.0" }, peers: { pg: "8.23.1" } })]);
  assertEquals(u.problems, []);
  assertEquals(u.dependencies, { left: "1.0.0", right: "2.0.0" }, "a peer is not installed by the package");
  const two = unionDependencies([facts("a", { dependencies: { left: "1.1.0" } }), facts("b", { dependencies: { left: "1.0.0" } })]);
  assertStringIncludes(two.problems.join("\n"), "left is 1.1.0 in a and 1.0.0 in b");
  assertStringIncludes(unionDependencies([facts("a", { dependencies: { left: "^1.0.0" } })]).problems.join("\n"), "not an exact version");
});

proves([`${SPEC} FR-029`], "the packages the package asks of the consumer are optional peers with the range of SINGLE_PEERS, and two versions of one of them are a finding", () => {
  const asked = peersOf([facts("a", { peers: { pg: "8.23.1", typescript: "7.1.0-beta" } }), facts("b", { peers: { pg: "8.23.1", shiki: "4.5.0" } })]);
  assertEquals(asked.problems, []);
  assertEquals(asked.peerDependencies, { pg: ">=8.23.1 <9.0.0", shiki: ">=4.5.0 <5.0.0", typescript: ">=7.1.0-0" });
  assertEquals(asked.peerDependenciesMeta, { pg: { optional: true }, shiki: { optional: true }, typescript: { optional: true } });
  assertStringIncludes(peersOf([facts("a", { peers: { pg: "8.23.1" } }), facts("b", { peers: { pg: "8.13.1" } })]).problems.join("\n"), "pg is 8.23.1 in a and 8.13.1 in b");
  assertEquals([...SINGLE_PEERS.keys()].sort(), ["@duckdb/node-api", "@electric-sql/pglite", "beautiful-mermaid", "pg", "shiki", "typescript"]);
});

proves([`${SPEC} FR-033`], "a static import of a package is found and a dynamic one, a statement of types only and a name in a string are not", () => {
  assertEquals(staticSpecifiers('import a from "shiki/core";\nimport "x";\nexport { b } from "y";\nexport * from "z";'), ["shiki/core", "x", "y", "z"]);
  assertEquals(staticSpecifiers('const m = await import("shiki");\nimport type { T } from "pg";\nexport type { U } from "pg";\nconst s = "import q from \\"shiki\\"";'), []);
  assertEquals(staticSpecifiers('import {\n  a,\n  b,\n} from "typescript/async";'), ["typescript/async"]);
});

proves([`${SPEC} FR-032`], "a staged package is reported by kind and by library, and a compiled file is the one beside a source of the same name", () => {
  const files = new Set(["package.json", "bin/x.mjs", "a/src/m.ts", "a/src/m.js", "a/dist/src/m.d.ts", "a/data/x.json", "a/guides/g.md", "a/src/site.js"]);
  assertEquals([...files].map((f) => kindOf(f, files)), ["package", "package", "source", "compiled", "declaration", "data", "documentation", "data"]);
});

proves([`${SPEC} FR-029`], "a command is a launcher of the compiled module and a name that two libraries declare is a finding", async () => {
  await withTempDir((dir) => {
    for (const lib of ["a", "b"]) {
      mkdirSync(join(dir, "commons", lib, "bin"), { recursive: true });
      writeTextFileSync(join(dir, "commons", lib, "bin", "tool.mjs"), 'import { main } from "../src/tool.ts";\nprocess.exit(await main(process.argv.slice(2)));\n');
    }
    const one = commandsOf(dir, [facts("a", { bin: { tool: "./bin/tool.mjs" } })]);
    assertEquals(one.problems, []);
    assertEquals(one.commands, [{ name: "tool", library: "a", module: "src/tool.ts", form: "main" }]);
    assertStringIncludes(launcherOf(one.commands[0] as Command), 'import { main } from "../a/src/tool.js";');
    const clash = commandsOf(dir, [facts("a", { bin: { tool: "./bin/tool.mjs" } }), facts("b", { bin: { tool: "./bin/tool.mjs" } })]);
    assertStringIncludes(clash.problems.join("\n"), "the command tool is declared by a and by b");
    assertStringIncludes(commandsOf(dir, [facts("a", { bin: { other: "./bin/none.mjs" } })]).problems.join("\n"), "which is not there");
    return Promise.resolve();
  });
});

proves([`${SPEC} FR-029`], "a file that does something when it is loaded is found, and a declaration, a guard for the program and the end of a template are not", () => {
  assertEquals(runsWhenLoaded("export const a = 1;\nexport function f() {\n    return 2;\n}\n"), false);
  assertEquals(runsWhenLoaded('import { x } from "./x.js";\nexport function install(p) {\n    x(p);\n}\nsetProcessTracer(traceProcess);\n'), true);
  assertEquals(runsWhenLoaded("export const a = 1;\nif (import.meta.main) {\n    run();\n}\n"), false);
  assertEquals(runsWhenLoaded("export const t = `a\nb`;\nexport const u = f(\n() => 1);\n"), false);
  assertEquals(runsWhenLoaded('export const s = "x(1);";\n// y();\n/* z(); */\n'), false);
  assertEquals(runsWhenLoaded("const table = new Uint32Array(8);\n{\n    table[0] = 1;\n}\n"), true);
  assertEquals(runsWhenLoaded("for (const x of [1]) {\n    use(x);\n}\n"), true);
});

/** A small repository of real files: two libraries (one imports the other by its package name, one has a command and a source that does something when it is loaded), the base configuration of commons and the folder of the package. */
function make(dir: string): void {
  const w = (file: string, text: string): void => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeTextFileSync(join(dir, file), text);
  };
  const manifest = (name: string, extra: Record<string, unknown>): string =>
    `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", distribution: ["github", "npm"], ...extra })};\n`;
  w("commons/tsconfig.base.json", readTextFileSync(join(REPO, "commons", "tsconfig.base.json")));
  w("commons/alpha/library.ts", manifest("alpha", { exports: [".", "./util"] }));
  w("commons/alpha/package.json", JSON.stringify({ name: "@intellectual-frontiers/alpha", version: "0.1.0", type: "module", exports: { ".": "./src/mod.ts", "./util": "./src/util.ts" } }));
  w("commons/alpha/src/mod.ts", 'export const alpha = (): string => "a";\n');
  w(
    "commons/alpha/src/util.ts",
    'import { readFileSync } from "node:fs";\nimport { dirname, join } from "node:path";\nimport { fileURLToPath } from "node:url";\nimport { alpha } from "./mod.ts";\n\n/** The name twice. */\nexport const twice = (): string => `${alpha()}${alpha()}`;\n\n/** The text of the data folder, which is beside the sources and, from the compiled module, beside `dist`. */\nexport const data = (): string => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "x.txt"), "utf8");\n',
  );
  w("commons/alpha/data/x.txt", "the data of alpha\n");
  w("commons/alpha/data/sub/y.txt", "deeper\n");
  w("commons/alpha/suite/a.test.ts", "export {};\n");
  w("commons/alpha/spec-kit/spec.md", "# spec\n");
  w("commons/alpha/tools/pack.ts", "export {};\n");
  w("commons/alpha/acceptance/kit.md", "# kit\n");
  w("commons/beta/library.ts", manifest("beta", { exports: [".", "./util"] }));
  w("commons/beta/package.json", JSON.stringify({ name: "@intellectual-frontiers/beta", version: "0.1.0", type: "module", exports: { ".": "./src/mod.ts", "./util": "./src/util.ts" }, bin: { beta: "./bin/beta.mjs" } }));
  w("commons/beta/bin/beta.mjs", 'import { main } from "../src/cli.ts";\nprocess.exit(await main(process.argv.slice(2)));\n');
  w("commons/beta/src/cli.ts", 'import { twice } from "@intellectual-frontiers/alpha/util";\n\n/** The command. */\nexport function main(argv: readonly string[]): number {\n  console.log(twice(), argv.length);\n  return 0;\n}\n');
  w("commons/beta/src/mod.ts", '/**\n * @example\n * ```ts\n * import { alpha } from "@intellectual-frontiers/alpha";\n * ```\n */\nimport { alpha } from "@intellectual-frontiers/alpha";\n\nexport const beta = (): string => `b${alpha()}`;\nconsole.log("beta loaded");\n');
  w("commons/beta/src/util.ts", 'export type Beta = { readonly kind: "beta" };\n');
  w("commons/commons/library.ts", manifest("commons", { bundle: "commons", exports: ["."] }));
  w("commons/commons/package.json", JSON.stringify({ name: "@intellectual-frontiers/commons", private: true, version: "0.2.0" }));
  w("commons/commons/LICENSE", "PolyForm Noncommercial License 1.0.0\n");
  mkdirSync(join(dir, "commons", "node_modules", "@intellectual-frontiers"), { recursive: true });
  for (const l of ["alpha", "beta"]) symlinkSync(join(dir, "commons", l), join(dir, "commons", "node_modules", "@intellectual-frontiers", l));
}

/** The files of an unpacked package, by path (a helper of the tests below). */
function readLibraryFiles(folder: string): readonly string[] {
  return filesUnder(folder);
}

const OPTIONS = { tsc: join(LIBRARIES, "node_modules", "typescript", "bin", "tsc"), toolsFolder: LIBRARIES, parallel: 2 };

proves([`${SPEC} FR-029`, `${SPEC} FR-030`], "the packer builds the real files of a small repository into one tarball that passes its own inspection, and each check that matters is shown on a copy made to fail", async () => {
  await withTempDir(async (dir) => {
    make(dir);
    const packed = await packCommons(dir, OPTIONS);
    assertEquals(packed.findings, []);
    assert(packed.tarball?.endsWith("intellectual-frontiers-commons-0.2.0.tgz") === true);
    const m = packed.manifest as Record<string, unknown>;
    assertEquals(Object.keys(m["exports"] as object), ["./alpha", "./alpha/util", "./beta", "./beta/util"]);
    assertEquals(m["bin"], { beta: "./bin/beta.mjs" });
    assertEquals(packed.counts.libraries, 2);
    assertEquals(m["sideEffects"], ["./beta/src/mod.js", "./beta/src/mod.ts"], "the module that logs when it is loaded is named, and no other");
    const stage = packed.stage;
    assertStringIncludes(readTextFileSync(join(stage, "beta/src/cli.js")), 'from "@intellectual-frontiers/commons/alpha/util"');
    assertStringIncludes(readTextFileSync(join(stage, "beta/src/mod.ts")), 'import { alpha } from "@intellectual-frontiers/commons/alpha";');
    assertStringIncludes(readTextFileSync(join(stage, "beta/src/mod.ts")), ' * import { alpha } from "@intellectual-frontiers/commons/alpha";');
    assertEquals(inspectCommons(stage, ["alpha", "beta"]), []);
    // the tarball is installed beside nothing and its entry is imported by Node by the package's own name
    const tar = packed.tarball ?? "";
    const into = join(dir, "consumer", "node_modules", "@intellectual-frontiers", "commons");
    mkdirSync(into, { recursive: true });
    assertEquals((await proc.run(["tar", "-xzf", tar, "-C", into, "--strip-components=1"])).code, 0);
    writeTextFileSync(join(dir, "consumer", "package.json"), '{ "type": "module" }\n');
    writeTextFileSync(join(dir, "consumer", "use.mjs"), 'import { beta } from "@intellectual-frontiers/commons/beta";\nimport { twice } from "@intellectual-frontiers/commons/alpha/util";\nconsole.log(beta(), twice());\n');
    const ran = await proc.run(["node", "use.mjs"], { cwd: join(dir, "consumer") });
    assertEquals(ran.stdout.trim().split("\n"), ["beta loaded", "ba aa"]);
    // the data folder of a library is read from the installed package by Node (from the compiled module) and by Bun (from the source), and what only develops the library is not in the package
    writeTextFileSync(join(dir, "consumer", "data.mjs"), 'import { data } from "@intellectual-frontiers/commons/alpha/util";\nprocess.stdout.write(data());\n');
    for (const runtime of ["node", proc.which("bun") ?? "bun"]) assertEquals((await proc.run([runtime, "data.mjs"], { cwd: join(dir, "consumer") })).stdout, "the data of alpha\n", `${runtime} reads the data folder`);
    const shipped = new Set(readLibraryFiles(into));
    for (const f of ["alpha/data/x.txt", "alpha/data/sub/y.txt"]) assert(shipped.has(f), `${f} is in the package`);
    for (const f of shipped) if (f.startsWith("alpha/dist/")) assert(f.endsWith(".d.ts"), `${f}: dist/ holds declarations only, a file a module reads is shipped once`);
    assertEquals(inspectCommons(into, ["alpha", "beta"]), [], "the inspection of the installed package");
    for (const f of shipped) for (const dev of ["suite", "spec-kit", "tools", "acceptance"]) assert(!f.startsWith(`alpha/${dev}/`) && !f.startsWith(`alpha/dist/${dev}/`), `${f} only develops the library and is not in the package`);
    // a missing library
    const without = JSON.parse(readTextFileSync(join(stage, "package.json"))) as Record<string, unknown>;
    const keep = (m2: Record<string, unknown>): void => writeTextFileSync(join(stage, "package.json"), JSON.stringify(m2));
    const original = JSON.stringify(without);
    keep({ ...without, exports: Object.fromEntries(Object.entries(without["exports"] as object).filter(([k]) => !k.startsWith("./beta"))) });
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "the library beta has no entry in the exports");
    // a dependency that is declared but not exact, and an import of a package that is not declared
    keep({ ...without, dependencies: { shiki: "^4.5.0" } });
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "shiki is ^4.5.0, which is not an exact version");
    writeTextFileSync(join(stage, "package.json"), original);
    const cli = join(stage, "beta/src/cli.js");
    const cliText = readTextFileSync(cli);
    writeTextFileSync(cli, `import "left-pad";\n${cliText}`);
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "imports left-pad, which is not a dependency of @intellectual-frontiers/commons");
    // a specifier that still names a library by its own package, and one that names an entry that is no key
    writeTextFileSync(cli, `import "@intellectual-frontiers/alpha";\n${cliText}`);
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "names a library by its own package");
    writeTextFileSync(cli, `import "@intellectual-frontiers/commons/alpha/none";\n${cliText}`);
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "is no key of the exports");
    writeTextFileSync(cli, cliText);
    // an entry whose file is gone
    const util = join(stage, "alpha/dist/src/util.d.ts");
    const utilText = readTextFileSync(util);
    writeTextFileSync(util, `import "./missing.js";\n${utilText}`);
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "which is not in the package");
    writeTextFileSync(util, utilText);
    // a file that does something when it is loaded, marked free of effects
    keep({ ...without, sideEffects: false });
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "beta/src/mod.js does something when it is loaded, and sideEffects does not name it");
    keep(without);
    assertEquals(inspectCommons(stage, ["alpha", "beta"]), []);
    // a static import of an optional peer, a file in dist/ that is no declaration, an internal file, a file shipped twice and a package over its budget
    // the GitHub package registry drops peerDependenciesMeta, so an optional peer is not a peerDependencies entry there (FR-023): listing it is a finding, naming it in ifcOptionalPeers is how it is asked for
    keep({ ...without, peerDependencies: { shiki: ">=4.5.0 <5.0.0" }, peerDependenciesMeta: { shiki: { optional: true } } });
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "shiki is an optional peer listed in peerDependencies: the registry drops peerDependenciesMeta");
    keep({ ...without, ifcOptionalPeers: { shiki: ">=4.5.0 <5.0.0" } });
    writeTextFileSync(cli, `import "shiki/core";\n${cliText}`);
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "imports the optional peer shiki statically");
    writeTextFileSync(cli, `const shiki = await import("shiki/core");\n${cliText}`);
    assertEquals(inspectCommons(stage, ["alpha", "beta"]).filter((f) => f.includes("optional peer")), [], "a dynamic import is how an optional peer is loaded");
    writeTextFileSync(cli, cliText);
    keep(without);
    writeTextFileSync(join(stage, "alpha/dist/x.txt"), "twice\n");
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "alpha/dist/x.txt is in dist/, which holds declarations only");
    writeTextFileSync(join(stage, "alpha/data/x2.txt"), "the data of alpha\n");
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "are the same file shipped twice");
    mkdirSync(join(stage, "alpha/suite"), { recursive: true });
    writeTextFileSync(join(stage, "alpha/suite/a.test.ts"), "export {};\n");
    writeTextFileSync(join(stage, "alpha/src/util.js.map"), "{}");
    const internal = inspectCommons(stage, ["alpha", "beta"]).join("\n");
    assertStringIncludes(internal, "alpha/suite/a.test.ts is internal to commons");
    assertStringIncludes(internal, "alpha/src/util.js.map is internal to commons");
    for (const f of ["alpha/dist/x.txt", "alpha/data/x2.txt", "alpha/suite", "alpha/src/util.js.map"]) removeSync(join(stage, f), { recursive: true });
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"], { apparentBytes: 100, files: 3 }).join("\n"), "the budget is 3");
    assertEquals(inspectCommons(stage, ["alpha", "beta"]), []);
    // a command that two libraries declare stops the packer
    writeTextFileSync(join(dir, "commons/alpha/package.json"), JSON.stringify({ name: "@intellectual-frontiers/alpha", version: "0.1.0", type: "module", exports: { ".": "./src/mod.ts", "./util": "./src/util.ts" }, bin: { beta: "./bin/beta.mjs" } }));
    mkdirSync(join(dir, "commons/alpha/bin"), { recursive: true });
    writeTextFileSync(join(dir, "commons/alpha/bin/beta.mjs"), 'import { main } from "../src/util.ts";\n');
    const clash = await packCommons(dir, OPTIONS);
    assertEquals(clash.tarball, undefined);
    assertStringIncludes(clash.findings.join("\n"), "the command beta is declared by alpha and by beta");
  });
});


proves([`${SPEC} FR-029`], "every folder of a library that is not one that only develops it is shipped, and the folders that are not shipped are the closed set NOT_RUNTIME; in the real repository the data of the catalogs, the guides of Docs are among them", () => {
  assertEquals([...NOT_RUNTIME].sort(), ["aat", "acceptance", "bin", "dist", "node_modules", "oat", "spec-kit", "suite", "tools", "uat"]);
  const byName = new Map(packableLibraries(REPO).libraries.map((l) => [l.name, factsOf(REPO, l).facts.folders] as const));
  assertEquals(byName.get("catalog-nist-sp800"), ["data"]);
  assertEquals(byName.get("catalog-nist-csf-2"), ["data"]);
  assertEquals(byName.get("docs"), ["guides"]);
  for (const [name, folders] of byName) for (const f of folders) assert(!NOT_RUNTIME.has(f), `${name}/${f} is a development folder`);
});

proves([`${SPEC} FR-031`], "the tools of the package are the union of the dependencies and the drivers, the compiler, the types of Node and of a package, and what the packed sources import, each at one version; a package no manifest versions and two versions of one are findings", () => {
  assertEquals(typesPackageOf("pg"), "@types/pg");
  assertEquals(typesPackageOf("@duckdb/node-api"), "@types/duckdb__node-api");
  const lib = (name: string, dependencies: Record<string, string>, devDependencies: Record<string, string>) => ({ name, roots: ["src"], dependencies, devDependencies });
  const made = toolsOf(
    [lib("docs", { shiki: "4.5.0", typescript: "7.1.0-beta" }, { "@types/node": "26.6.6" }), lib("data", {}, { pg: "8.23.1", "@types/pg": "8.23.1", typescript: "7.0.2", "@types/node": "26.6.6", "left-pad": "1.3.0" })],
    { shiki: "4.5.0", typescript: "7.1.0-beta", pg: "8.23.1" },
    new Map([["left-pad", "data/src/a.ts"]]),
  );
  assertEquals(made.problems, []);
  assertEquals(made.tools, { "@types/node": "26.6.6", "@types/pg": "8.23.1", "left-pad": "1.3.0", pg: "8.23.1", shiki: "4.5.0", typescript: "7.1.0-beta" });
  assertStringIncludes(toolsOf([lib("a", {}, {})], {}, new Map([["zod", "a/src/x.ts"]])).problems.join("\n"), "zod is needed (a/src/x.ts imports it) and no library names a version of it");
  assertStringIncludes(toolsOf([lib("a", {}, { zod: "4.1.12" }), lib("b", {}, { zod: "3.0.0" })], {}, new Map([["zod", "a/src/x.ts"]])).problems.join("\n"), "the libraries name 3.0.0 and 4.1.12");
  assertEquals([...importedPackages([{ file: "a.ts", text: 'import { x } from "zod/v4";\nimport "node:fs";\nimport { y } from "./y.ts";\nimport { z } from "@intellectual-frontiers/core";\nimport s from "@scope/pkg/sub";\n' }]).keys()], ["zod", "@scope/pkg"]);
});

proves([`${SPEC} FR-031`], "a package the libraries need that the manifest or the lockfile of the folder lacks, or holds at another version, is a finding that names it, and the writing form makes the manifest what the tools say", () => {
  const tools = { pg: "8.23.1", shiki: "4.5.0" };
  const manifest = JSON.stringify({ name: "x", devDependencies: { "@intellectual-frontiers/system": "link:../system", shiki: "4.5.0" } });
  const lock = (workspace: Record<string, string>, packages: Record<string, string>): string =>
    `${JSON.stringify({ workspaces: { "": { devDependencies: workspace } }, packages: Object.fromEntries(Object.entries(packages).map(([k, v]) => [k, [`${k}@${v}`, "", {}, "sha"]])) }, null, 2)}\n`;
  const complete = lock({ pg: "8.23.1", shiki: "4.5.0" }, { pg: "8.23.1", shiki: "4.5.0" });
  assertEquals(readLock(complete)?.versions.get("pg"), "8.23.1");
  const written = writeTools(manifest, tools);
  assertEquals(written.changed, true);
  assertEquals(JSON.parse(written.text).devDependencies, { "@intellectual-frontiers/system": "link:../system", pg: "8.23.1", shiki: "4.5.0" });
  assertEquals(writeTools(written.text, tools).changed, false);
  assertEquals(devDependenciesOf({ a: "1.0.0", "b": "link:../b" }, tools), { b: "link:../b", pg: "8.23.1", shiki: "4.5.0" });
  assertEquals(toolFindings("commons/commons", written.text, complete, tools), []);
  assertStringIncludes(toolFindings("commons/commons", manifest, complete, tools).join("\n"), "commons/commons/package.json has no devDependency pg@8.23.1");
  assertStringIncludes(toolFindings("commons/commons", written.text, lock({ shiki: "4.5.0" }, { shiki: "4.5.0" }), tools).join("\n"), "commons/commons/bun.lock does not hold pg@8.23.1");
  assertStringIncludes(toolFindings("commons/commons", written.text, lock({ pg: "8.0.0", shiki: "4.5.0" }, { pg: "8.0.0", shiki: "4.5.0" }), tools).join("\n"), "bun.lock holds pg@8.0.0");
  assertStringIncludes(toolFindings("commons/commons", written.text, undefined, tools).join("\n"), "bun.lock is missing");
});

proves([`${SPEC} FR-031`], "in the real repository the manifest and the lockfile of commons/commons hold every package that compiling the libraries needs, so that a library that starts to need another is found here", () => {
  const listed = packableLibraries(REPO);
  const facts = listed.libraries.map((l) => factsOf(REPO, l).facts);
  const union = unionDependencies(facts);
  assertEquals(union.problems, []);
  const needed = toolsOfLibraries(REPO, facts, union.dependencies);
  assertEquals(needed.problems, []);
  for (const must of ["typescript", "@types/node", "beautiful-mermaid", "shiki", "@duckdb/node-api", "@electric-sql/pglite", "pg", "@types/pg"]) assert(must in needed.tools, `${must} is a tool`);
  assertEquals(toolsFindingsOf(REPO, needed.tools), []);
  // a library that starts to need a package the folder lacks: shown on a tool that is not there
  assertStringIncludes(toolsFindingsOf(REPO, { ...needed.tools, "left-pad": "1.3.0" }).join("\n"), "no devDependency left-pad@1.3.0");
});

proves([`${SPEC} FR-031`], "the third-party packages of the folder of the package are linked where the sources of a library are resolved from, those that are already there are left, and the libraries are not touched", async () => {
  await withTempDir((dir) => {
    const tools = join(dir, "tools");
    for (const p of ["shiki", "@types/pg", "@intellectual-frontiers/system", "already"]) {
      mkdirSync(join(tools, "node_modules", p), { recursive: true });
      writeTextFileSync(join(tools, "node_modules", p, "package.json"), "{}\n");
    }
    mkdirSync(join(dir, "commons", "node_modules", "already"), { recursive: true });
    const first = linkTools(dir, tools);
    assertEquals("made" in first ? first.made : -1, 2);
    assertEquals(readTextFileSync(join(dir, "commons", "node_modules", "shiki", "package.json")), "{}\n");
    assertEquals(readTextFileSync(join(dir, "commons", "node_modules", "@types", "pg", "package.json")), "{}\n");
    assert(!existsSyncOf(join(dir, "commons", "node_modules", "@intellectual-frontiers")), "the libraries of commons are linked by link.ts, not here");
    const again = linkTools(dir, tools);
    assertEquals("made" in again ? again.made : -1, 0);
    return Promise.resolve();
  });
});
