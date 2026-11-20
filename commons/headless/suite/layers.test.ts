/**
 * Tests of the layers of Headless, which the shared checker of Kanon holds (commons 0033-kanon FR-014): the table is the `kanon` field of the manifest, every file is in one unit, imports point
 * one way, units reach each other only through the package's `exports`, each unit imports only what its row allows, and a surface has a row (commons headless 0001-headless-layers FR-001 to FR-008).
 *
 * @module
 */
import { readdirSync } from "node:fs";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { findings as traceFindings } from "../tools/check.ts";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const PKG = "@intellectual-frontiers/headless";
/** A step up, written so that this file does not itself read as an import of a file outside the library. */
const UP = "../";

const decoded = decodeTable(library.kanon);
if (decoded.kind === "err") throw new Error(decoded.error);
const TABLE: Table = decoded.value;

async function exportsOfPackage(): Promise<Record<string, string>> {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  return pkg.exports;
}
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./cli": "./src/surfaces/cli/mod.ts",
  "./targets/local": "./src/targets/local/mod.ts",
  "./targets/ssh": "./src/targets/ssh/mod.ts",
  "./ssh-inbound": "./src/surfaces/ssh-inbound/mod.ts",
  "./otel": "./src/otel/mod.ts",
};
const at = (path: string, text: string) => ({ path, text });
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(TABLE, files, EXPORTS).map((f) => f.rule);
const importing = (file: string, spec: string): string[] => rules([at(file, `import { x } from "${spec}";\n`)]);

proves(["0001-headless-layers FR-001", "0001-headless-layers FR-002", "0001-headless-layers FR-003", "0001-headless-layers FR-004", "0001-headless-layers FR-005"], "the real tree has no finding of the layers check", () => {
  const read = readTable(ROOT);
  assertEquals(read.kind, "ok");
  const found = hostFindings(ROOT);
  assertEquals(found.kind === "ok" ? found.value.map((f) => f.key) : found.error, []);
});

proves(["0001-headless-layers FR-001"], "every file is in one unit, and a file in none is layers/unclassified", () => {
  const units: readonly [string, string][] = [
    ["about.ts", "./"],
    ["library.ts", "./"],
    ["src/mod.ts", "src/"],
    ["src/governance/action.ts", "src/governance/"],
    ["src/logical/model.ts", "src/logical/"],
    ["src/surfaces/cli/run.ts", "src/surfaces/cli/"],
    ["src/otel/mod.ts", "src/otel/"],
    ["suite/x.test.ts", "suite/"],
    ["tools/check.ts", "tools/"],
  ];
  for (const [file, name] of units) assertEquals(unitOf(TABLE, file)?.name, name, file);
  assertEquals(rules([at("docs/stray.ts", "export const x = 1;\n")]), ["layers/unclassified"]);
  assertEquals(rules([at("src/governance/a.ts", "export const x = 1;\n")]), []);
});

proves(["0001-headless-layers FR-002"], "imports point one way: below may not import above, and a surface may not import another surface", () => {
  assertEquals(importing("src/governance/a.ts", `${PKG}/logical`), ["layers/above"]);
  assertEquals(importing("src/governance/a.ts", `${PKG}/cli`), ["layers/above"]);
  assertEquals(importing("src/logical/a.ts", `${PKG}/cli`), ["layers/above"]);
  assertEquals(importing("src/logical/a.ts", `${PKG}/governance`), []);
  assertEquals(rules([at("src/surfaces/cli/a.ts", `import { x } from "${PKG}/logical";\nimport { y } from "${PKG}/governance";\n`)]), []);
  assertEquals(importing("src/surfaces/cli/a.ts", `${PKG}/otel`), ["layers/around"]);
  assertEquals(importing("src/surfaces/ssh-inbound/a.ts", `${PKG}/cli`), ["layers/around"], "a surface beside another");
  assertEquals(importing("src/otel/a.ts", `${PKG}/cli`), []);
  assertEquals(importing("src/surfaces/cli/a.ts", `${PKG}/cli`), [], "a unit may always import itself");
});

proves(["0001-headless-layers FR-003"], "a file of one unit reaches another through the package's exports, never by a relative path, and a name exports does not name is layers/private", () => {
  assertEquals(importing("src/logical/a.ts", "../governance/action.ts"), ["layers/relative"]);
  assertEquals(importing("src/surfaces/cli/a.ts", `${UP}${UP}logical/model.ts`), ["layers/relative"]);
  assertEquals(importing("src/logical/a.ts", "./model.ts"), [], "inside the unit a relative import is fine");
  assertEquals(importing("src/logical/a.ts", `${PKG}/governance/action`), ["layers/private"]);
  assertEquals(importing("src/logical/a.ts", `${PKG}/nothing`), ["layers/private"]);
  for (const own of ["suite/a.test.ts", "tools/a.ts", "src/mod.ts", "about.ts"]) assertEquals(importing(own, "../src/logical/model.ts"), [], `${own} is the library's own checking: it may import any file`);
});

proves(["0001-headless-layers FR-004"], "each unit imports only what its row allows: governance Core, logical Core and the terminal's args and commands, the command line Core, the terminal and the system, the adapter Core and the telemetry", () => {
  const ok = (file: string, spec: string) => assertEquals(importing(file, spec), [], `${file} may import ${spec}`);
  const no = (file: string, spec: string) => assertEquals(importing(file, spec), ["layers/external"], `${file} may not import ${spec}`);
  ok("src/governance/a.ts", "@intellectual-frontiers/core");
  no("src/governance/a.ts", "@intellectual-frontiers/terminal/args");
  no("src/governance/a.ts", "@intellectual-frontiers/system");
  no("src/governance/a.ts", "node:fs");
  ok("src/logical/a.ts", "@intellectual-frontiers/terminal/args");
  ok("src/logical/a.ts", "@intellectual-frontiers/terminal/commands");
  no("src/logical/a.ts", "@intellectual-frontiers/terminal/palette");
  no("src/logical/a.ts", "@intellectual-frontiers/system");
  no("src/logical/a.ts", "@intellectual-frontiers/telemetry");
  no("src/logical/a.ts", "fast-check");
  for (const s of ["@intellectual-frontiers/core", "@intellectual-frontiers/terminal/palette", "@intellectual-frontiers/terminal/width", "@intellectual-frontiers/terminal/args", "@intellectual-frontiers/system"]) ok("src/surfaces/cli/a.ts", s);
  no("src/surfaces/cli/a.ts", "node:fs");
  no("src/surfaces/cli/a.ts", "@intellectual-frontiers/net");
  ok("src/otel/a.ts", "@intellectual-frontiers/telemetry/signals");
  ok("src/otel/a.ts", "@intellectual-frontiers/core");
  no("src/otel/a.ts", "@intellectual-frontiers/system");
});

proves(["0001-headless-layers FR-005"], "the command-line surface may not import the telemetry; only the adapter may", () => {
  assertEquals(importing("src/surfaces/cli/a.ts", "@intellectual-frontiers/telemetry/signals"), ["layers/external"]);
  assertEquals(importing("src/logical/a.ts", "@intellectual-frontiers/telemetry"), ["layers/external"]);
  assertEquals(importing("src/otel/a.ts", "@intellectual-frontiers/telemetry"), []);
  for (const u of TABLE.units) {
    if (u.folder.startsWith("src/surfaces/")) assert(!(u.packages ?? []).some((a) => a.name.endsWith("/telemetry")), u.folder);
  }
});

proves(["0001-headless-layers FR-006"], "a surface is one folder with one row of the table; a folder with no row is layers/unclassified, and its row says what it may import", () => {
  assertEquals(
    TABLE.units.filter((u) => u.folder.startsWith("src/surfaces/")).map((u) => u.folder),
    ["src/surfaces/cli/", "src/surfaces/ssh-inbound/"],
  );
  // the folder `src/` is the library's own for its entry, `mod.ts`; so that a surface cannot appear without a row, every folder under `src/surfaces/` and `src/targets/` is held to be a unit of the table
  const rows = new Set(TABLE.units.map((u) => u.folder as string));
  for (const parent of ["src/surfaces", "src/targets"]) {
    for (const e of readdirSync(path.join(ROOT, parent), { withFileTypes: true })) if (e.isDirectory()) assert(rows.has(`${parent}/${e.name}/`), `${parent}/${e.name}/ has no row of the table`);
  }
  assertEquals(importing("src/surfaces/cli/a.ts", `${PKG}/logical`), []);
  assertEquals(importing("src/surfaces/ssh-inbound/a.ts", "@intellectual-frontiers/system"), ["layers/external"], "the inbound surface imports Core alone");
});

proves(["0001-headless-layers FR-007"], "the checker holds the layers against its baseline, the trace is held by tools/check.ts, and verify runs both", async () => {
  const found = await traceFindings(ROOT);
  assertEquals(found.filter((f) => f.key.startsWith("layers/")), []);
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  for (const p of ["bun ../kanon/src/check.ts", "bun tools/check.ts", "bun tools/pack.ts --check", "bun test suite/"]) assert((pkg.scripts["verify"] ?? "").includes(p), p);
  const baseline = await fs.readTextFile(path.join(ROOT, "trace.baseline.txt"));
  assertEquals(baseline.split("\n").filter((l) => l !== "" && !l.startsWith("#")), [], "nothing is held: the library has no finding to hold");
});

proves(["0001-headless-layers FR-008"], "the manifest agrees with the folder: the entries, the name, the level, the version, the distribution and the table", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; private: boolean; exports: Record<string, string>; engines: { node: string } };
  assertEquals([library.name, library.level, library.distribution], ["headless", "L1", ["github", "npm"]]);
  assertEquals(library.version, pkg.version);
  assertEquals(library.exports, Object.keys(pkg.exports));
  assertEquals(Object.keys(await exportsOfPackage()), Object.keys(EXPORTS));
  assertEquals([pkg.name, pkg.private, pkg.engines.node], ["@intellectual-frontiers/headless", true, ">=26"]);
  assertEquals(library.kanon.package, pkg.name);
  for (const target of Object.values(pkg.exports)) assert(await fs.exists(path.join(ROOT, target)), target);
});
