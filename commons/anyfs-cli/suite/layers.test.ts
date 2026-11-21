/**
 * Tests of the layers of AnyfsCli over the shared checker of Kanon (commons anyfs-cli 0001-anyfs-cli-layers FR-001 to FR-003): the table in the manifest holds every file of the real tree with no import outside
 * its row, `verify` runs every check, and the version the program says is the version of the manifest and of the package.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";
import { ANYFS_CLI_VERSION } from "../src/governance/mod.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-anyfs-cli-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-anyfs-cli-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-anyfs-cli-layers FR-003"], "the version the program says is the version of the manifest and of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { version: string };
  assertEquals(ANYFS_CLI_VERSION, library.version);
  assertEquals(pkg.version, library.version);
  assertEquals(library.versionConstants.map((c) => c.name), ["ANYFS_CLI_VERSION"]);
});
