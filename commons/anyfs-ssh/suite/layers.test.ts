/**
 * Tests of the layers of AnyFS SSH over the shared checker of Kanon (commons anyfs-ssh 0001-anyfs-ssh-layers FR-001, FR-002): the table in the manifest holds every file of the real tree with no finding, and `verify` runs every check.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-anyfs-ssh-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-anyfs-ssh-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tools/helper.ts --check", "tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-anyfs-ssh-layers FR-004"], "the manifest holds the library from the registries and names the reason", () => {
  assertEquals(library.held.kind, "unfinished");
  assert(library.held.reason.length > 10);
  assertEquals(library.distribution, ["github"]);
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
});

proves(["0001-anyfs-ssh-layers FR-005"], "the packer is the library's own and verify runs it", async () => {
  assert(await fs.exists(path.join(ROOT, "tools/pack.ts")));
});
