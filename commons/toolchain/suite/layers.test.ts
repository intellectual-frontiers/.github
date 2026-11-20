/**
 * Tests of the layers of Toolchain over the shared checker of Kanon (commons toolchain 0001-toolchain-layers FR-001 to FR-006): the table in the manifest holds every file of the real tree with no
 * finding, the same table finds each way an import can break it, the package exports what the specification says, `verify` runs every check, the release record agrees with the package, and no
 * source does input or output.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { library } from "../library.ts";
import { release } from "../release.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./ontology": "./src/physical/ontology/mod.ts",
};
const PKG = "@intellectual-frontiers/toolchain";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-toolchain-layers FR-001", "0001-toolchain-layers FR-002"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(unitOf(table(), "src/governance/tool.ts")?.name, "src/governance/");
  assertEquals(unitOf(table(), "src/logical/resolve.ts")?.name, "src/logical/");
  assertEquals(unitOf(table(), "src/physical/ontology/ontology.ts")?.name, "src/physical/ontology/");
});

proves(["0001-toolchain-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-toolchain-layers FR-002"], "below may not import above, a unit reaches another through exports, and each unit imports only what its row allows", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/ids.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/internal";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/governance/a.ts", `import { sha256Of } from "@intellectual-frontiers/crypto/sha256";\n`)]), []);
  assertEquals(rules([at("src/governance/a.ts", `import { findSecretLike } from "@intellectual-frontiers/archon/governance";\n`)]), []);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/archon/logical";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { sha256 } from "@intellectual-frontiers/crypto/sha256";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/ontology";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/ontology";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/physical/ontology/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(rules([at("src/physical/ontology/a.ts", `import { downloadOf } from "@intellectual-frontiers/ontology/supply-chain/downloads";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { downloadOf } from "@intellectual-frontiers/ontology/supply-chain/downloads";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/physical/ontology/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "../src/logical/mod.ts";\n`)]), []);
});

proves(["0001-toolchain-layers FR-003"], "the package exports the library and its layers", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(table().package, pkg.name);
});

proves(["0001-toolchain-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check, the tests and the check of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-toolchain-layers FR-005"], "the release record agrees with the manifest and the package", () => {
  assertEquals(release.slug, library.name);
  assertEquals(release.version, library.version);
  assertEquals(release.kind, "Software");
  assertEquals(library.distribution, ["github", "npm"]);
});

proves(["0001-toolchain-layers FR-006"], "no source reads a file, reaches the network or runs a program", async () => {
  const files = await runtime.readSources(ROOT, ["src"]);
  assert(files.length >= 8, "the sources are read");
  const io = /from "node:|\bBun\.|\bfetch\(|\bDeno\.|from "@intellectual-frontiers\/(system|net)/;
  for (const f of files) assertEquals(io.test(f.text), false, `${f.path} does input or output`);
});
