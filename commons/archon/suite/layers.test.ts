/**
 * Tests of the layers of Archon over the shared checker of Kanon (commons archon 0001-archon-layers FR-001 to FR-005): the table in the manifest holds every file of the real tree with no
 * finding, the same table finds each way an import can break it, the package exports what the specification says, `verify` runs every check and the release record agrees with the package.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";
import { release } from "../release.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./dialect": "./src/physical/dialect/mod.ts",
  "./cli": "./src/physical/cli/mod.ts",
};
const PKG = "@intellectual-frontiers/archon";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-archon-layers FR-001", "0001-archon-layers FR-002"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(unitOf(table(), "src/governance/ids.ts")?.name, "src/governance/");
  assertEquals(unitOf(table(), "src/physical/dialect/types.ts")?.name, "src/physical/dialect/");
});

proves(["0001-archon-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-archon-layers FR-002"], "below may not import above, a unit reaches another through exports, and each unit imports only what its row allows", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/dialect";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/ids.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/internal";\n`)]), ["layers/private"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/crypto/sha256";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { sha256 } from "@intellectual-frontiers/crypto/sha256";\n`)]), []);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { planOf } from "@intellectual-frontiers/headless/logical";\n`)]), []);
  assertEquals(rules([at("src/physical/dialect/a.ts", `import { run } from "@intellectual-frontiers/headless/cli";\n`)]), ["layers/external"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "../src/logical/mod.ts";\n`)]), []);
});

proves(["0001-archon-layers FR-003"], "the package exports the library, its layers and the dialect port", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(table().package, pkg.name);
});

proves(["0001-archon-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check, the tests and the check of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test ./suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-archon-layers FR-005"], "the release record agrees with the manifest and the package", async () => {
  assertEquals(release.slug, library.name);
  assertEquals(release.version, library.version);
  assertEquals(release.kind, "Software");
  assertEquals(library.distribution, ["github", "npm"]);
});
