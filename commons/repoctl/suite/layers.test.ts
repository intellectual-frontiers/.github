/**
 * Tests of the layers of Repoctl over the shared checker of Kanon (commons repoctl 0001-repoctl-layers FR-001 to FR-006): the table in the manifest holds every file of the real tree with no finding, the same table finds each way an
 * import can break it, the package exports what the specification says, `verify` runs every check, the version of the program is the library's, and no source of Governance or Logical does input or output.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { REPOCTL_VERSION } from "@intellectual-frontiers/repoctl/governance";
import { library } from "../library.ts";
import { release } from "../release.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./physical": "./src/physical/mod.ts",
};
const PKG = "@intellectual-frontiers/repoctl";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-repoctl-layers FR-001", "0001-repoctl-layers FR-002"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(unitOf(table(), "src/governance/verbs.ts")?.name, "src/governance/");
  assertEquals(unitOf(table(), "src/logical/sync.ts")?.name, "src/logical/");
  assertEquals(unitOf(table(), "src/physical/program.ts")?.name, "src/physical/");
});

proves(["0001-repoctl-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-repoctl-layers FR-002"], "below may not import above, a unit reaches another through exports, and each unit imports only what its row allows", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/ids.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/internal";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/headless/governance";\n`)]), []);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/headless/cli";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "@intellectual-frontiers/headless/logical";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "@intellectual-frontiers/system/fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/physical/a.ts", `import { x } from "@intellectual-frontiers/system/fs";\n`)]), []);
  assertEquals(rules([at("src/physical/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/physical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "../src/logical/mod.ts";\n`)]), []);
});

proves(["0001-repoctl-layers FR-003"], "the package exports the library and its layers", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string>; bin: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(pkg.bin, { repoctl: "./bin/repoctl.mjs" });
  assertEquals(table().package, pkg.name);
});

proves(["0001-repoctl-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check and the tests", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-repoctl-layers FR-005"], "the version of the program, the manifest, the package and the record agree, and the manifest names the constant", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { version: string };
  assertEquals(REPOCTL_VERSION, library.version);
  assertEquals(pkg.version, library.version);
  assertEquals(release.version, library.version);
  assertEquals(release.slug, library.name);
  assertEquals(release.kind, "Software");
  assertEquals(library.versionConstants, [{ file: "src/governance/version.ts", name: "REPOCTL_VERSION" }]);
});

proves(["0001-repoctl-layers FR-006"], "no source of Governance or Logical imports a module that does input or output", async () => {
  const files = await runtime.readSources(ROOT, ["src/governance", "src/logical"]);
  assert(files.length >= 20, "the sources are read");
  const io = /from "node:|\bBun\.|\bfetch\(|\bDeno\.|from "@intellectual-frontiers\/(system|net|libraries)/;
  // what a source imports is what it begins with, up to its first declaration: a text it writes out (the files of a scaffold) is not an import
  const head = (text: string): string => text.slice(0, text.search(/^(?:export|const|function|type) /m));
  for (const f of files) assertEquals(io.test(head(f.text)), false, `${f.path} does input or output`);
  assertEquals(io.test(files.map((f) => head(f.text)).join("\n")), false);
});
