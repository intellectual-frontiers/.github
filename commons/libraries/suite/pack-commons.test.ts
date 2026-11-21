/**
 * The one package of commons (commons 0036-distribution FR-019 to FR-026): the mode, the keys of the `exports`, the rewriting of specifiers, the union of dependencies, the commands, what runs when a file is loaded, and the packer on a small repository
 * of real files (real folders, the real compiler, a real tarball) with each check that matters broken in a copy and named. The proof on the whole of commons, installed with npm and Bun, is `tests/release/commons-package.test.ts`.
 *
 * @module
 */
import { mkdirSync, readTextFileSync, symlinkSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { importSpecifiers } from "../src/scan.ts";
import { activeMode, DISTRIBUTION, DISTRIBUTION_MODES, parseMode } from "../src/distribution.ts";
import {
  type Command,
  commandsOf,
  exportKey,
  exportsMap,
  type Facts,
  inspectCommons,
  launcherOf,
  oldSpecifiers,
  packCommons,
  rewriteSpecifiers,
  runsWhenLoaded,
  unionDependencies,
} from "../src/pack-commons.ts";

const DIST = "0036-distribution";
const LIBRARIES = resolve(dirname(fromFileUrl(import.meta.url)), "..");
const REPO = resolve(LIBRARIES, "..", "..");

const facts = (name: string, extra: Partial<Facts> = {}): Facts => ({
  name,
  version: "0.1.0",
  summary: `${name}.`,
  exports: { ".": "./src/mod.ts" },
  roots: ["src"],
  bin: {},
  dependencies: {},
  drivers: {},
  held: false,
  ...extra,
});

proves([`${DIST} FR-019`], "the mode is one of two, the repository is in single mode, the environment names the other for one run and a value that is no mode is refused", () => {
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

proves([`${DIST} FR-022`], "each library is mapped to ./<library> and ./<library>/<subpath>, so that the subpaths of two libraries do not collide, each entry naming its types, its source and its compiled file", () => {
  assertEquals(exportKey("core", "."), "./core");
  assertEquals(exportKey("anyfs", "./governance"), "./anyfs/governance");
  const map = exportsMap([facts("a", { exports: { ".": "./src/mod.ts", "./governance": "./src/governance/mod.ts" } }), facts("b", { exports: { "./governance": "./src/governance/mod.ts" } })]);
  assertEquals(Object.keys(map), ["./a", "./a/governance", "./b/governance"]);
  assertEquals(map["./b/governance"], { types: "./b/dist/src/governance/mod.d.ts", bun: "./b/src/governance/mod.ts", default: "./b/dist/src/governance/mod.js" });
});

proves([`${DIST} FR-022`], "an import of a library is written as an import of the package, in code and in the example of a comment; a string that is no import, a name that is no library and the examples of a Markdown fence are left or found", () => {
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

proves([`${DIST} FR-023`], "the dependencies are the union of the libraries' and the drivers', each exact; two versions of one package and a version that is not exact are findings", () => {
  const u = unionDependencies([facts("a", { dependencies: { shiki: "4.5.0" } }), facts("b", { dependencies: { shiki: "4.5.0" }, drivers: { pg: "8.23.1" } })]);
  assertEquals(u.problems, []);
  assertEquals(u.dependencies, { pg: "8.23.1", shiki: "4.5.0" });
  const two = unionDependencies([facts("a", { dependencies: { pg: "8.13.1" } }), facts("b", { drivers: { pg: "8.23.1" } })]);
  assertStringIncludes(two.problems.join("\n"), "pg is 8.13.1 in a and 8.23.1 in b");
  assertStringIncludes(unionDependencies([facts("a", { dependencies: { shiki: "^4.5.0" } })]).problems.join("\n"), "not an exact version");
  assertEquals(unionDependencies([facts("a", { dependencies: { typescript: "7.1.0-beta" } })]).problems, []);
});

proves([`${DIST} FR-024`], "a command is a launcher of the compiled module and a name that two libraries declare is a finding", async () => {
  await withTempDir((dir) => {
    for (const lib of ["a", "b"]) {
      mkdirSync(join(dir, "commons", lib, "bin"), { recursive: true });
      writeTextFileSync(join(dir, "commons", lib, "bin", "tool.mjs"), 'import { main } from "../src/tool.ts";\nprocess.exit(await main(process.argv.slice(2)));\n');
    }
    const one = commandsOf(dir, [facts("a", { bin: { tool: "./bin/tool.mjs" } })]);
    assertEquals(one.problems, []);
    assertEquals(one.commands, [{ name: "tool", library: "a", module: "src/tool.ts", form: "main" }]);
    assertStringIncludes(launcherOf(one.commands[0] as Command), 'import { main } from "../a/dist/src/tool.js";');
    const clash = commandsOf(dir, [facts("a", { bin: { tool: "./bin/tool.mjs" } }), facts("b", { bin: { tool: "./bin/tool.mjs" } })]);
    assertStringIncludes(clash.problems.join("\n"), "the command tool is declared by a and by b");
    assertStringIncludes(commandsOf(dir, [facts("a", { bin: { other: "./bin/none.mjs" } })]).problems.join("\n"), "which is not there");
    return Promise.resolve();
  });
});

proves([`${DIST} FR-025`], "a file that does something when it is loaded is found, and a declaration, a guard for the program and the end of a template are not", () => {
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
  w("commons/alpha/src/util.ts", 'import { alpha } from "./mod.ts";\n\n/** The name twice. */\nexport const twice = (): string => `${alpha()}${alpha()}`;\n');
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

const OPTIONS = { tsc: join(LIBRARIES, "node_modules", "typescript", "bin", "tsc"), toolsFolder: LIBRARIES, parallel: 2 };

proves([`${DIST} FR-021`, `${DIST} FR-022`, `${DIST} FR-023`, `${DIST} FR-024`, `${DIST} FR-025`, `${DIST} FR-026`], "the packer builds the real files of a small repository into one tarball that passes its own inspection, and each check that matters is shown on a copy made to fail", async () => {
  await withTempDir(async (dir) => {
    make(dir);
    const packed = await packCommons(dir, OPTIONS);
    assertEquals(packed.findings, []);
    assert(packed.tarball?.endsWith("intellectual-frontiers-commons-0.2.0.tgz") === true);
    const m = packed.manifest as Record<string, unknown>;
    assertEquals(Object.keys(m["exports"] as object), ["./alpha", "./alpha/util", "./beta", "./beta/util"]);
    assertEquals(m["bin"], { beta: "./bin/beta.mjs" });
    assertEquals(packed.counts.libraries, 2);
    assertEquals(m["sideEffects"], ["./beta/dist/src/mod.js", "./beta/src/mod.ts"], "the module that logs when it is loaded is named, and no other");
    const stage = packed.stage;
    assertStringIncludes(readTextFileSync(join(stage, "beta/dist/src/cli.js")), 'from "@intellectual-frontiers/commons/alpha/util"');
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
    const cli = join(stage, "beta/dist/src/cli.js");
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
    assertStringIncludes(inspectCommons(stage, ["alpha", "beta"]).join("\n"), "beta/dist/src/mod.js does something when it is loaded, and sideEffects does not name it");
    keep(without);
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
