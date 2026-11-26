/**
 * Tests of the layers of the kit over the shared checker of Kanon (commons package-managers 0001-package-managers-layers FR-001 to FR-006): the table in the manifest holds every file of the real
 * tree with no finding, the same table finds each way an import can break it, the package exports what the specification says, `verify` runs every check, the release record agrees with the
 * package, and governance and logical do no input or output.
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
  "./physical": "./src/physical/mod.ts",
};
const PKG = "@intellectual-frontiers/package-managers";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-package-managers-layers FR-001"], "the shared checker finds nothing in the real tree, and a file in no unit is layers/unclassified", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(unitOf(table(), "src/logical/argv.ts")?.name, "src/logical/");
  assertEquals(unitOf(table(), "src/physical/dialect.ts")?.name, "src/physical/");
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-package-managers-layers FR-002", "0001-package-managers-layers FR-006"], "below may not import above, a unit reaches another through exports, and each unit imports only what its row allows", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/governance";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/commands.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/archon/governance";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "@intellectual-frontiers/system/proc";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/physical/a.ts", `import * as proc from "@intellectual-frontiers/system/proc";\n`)]), []);
  assertEquals(rules([at("src/physical/a.ts", `import { x } from "@intellectual-frontiers/archon-dialect-ansible";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/physical/a.ts", `import { x } from "${PKG}/logical";\n`)]), []);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/physical";\n`)]), ["layers/above"]);
});

proves(["0001-package-managers-layers FR-003"], "the package exports the library and its layers", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assertEquals(pkg.name, PKG);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(table().package, pkg.name);
});

proves(["0001-package-managers-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check, the tests and the check of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-package-managers-layers FR-005"], "the release record agrees with the manifest and the package", () => {
  assertEquals(release.slug, library.name);
  assertEquals(release.version, library.version);
  assertEquals(release.kind, "Software");
  assertEquals(library.distribution, ["github", "npm"]);
});

proves(["0001-package-managers-layers FR-006"], "governance and logical read no file, reach no network and run no program", async () => {
  const files = [...(await runtime.readSources(ROOT, ["src/governance"])), ...(await runtime.readSources(ROOT, ["src/logical"]))];
  assert(files.length >= 5, "the sources are read");
  const io = /from "node:|\bBun\.|\bfetch\(|\bDeno\.|from "@intellectual-frontiers\/(system|net)/;
  for (const f of files) assertEquals(io.test(f.text), false, `${f.path} does input or output`);
});
