/**
 * Tests of the layers of SSH Server over the shared checker of Kanon (commons ssh-server 0001-ssh-server-layers FR-001, FR-002): the table in the manifest holds every file of the real tree with no finding, and `verify` runs every check.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-ssh-server-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-ssh-server-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-ssh-server-layers FR-003", "0001-ssh-server-layers FR-004"], "ssh2 is the one deliberate dependency: exact version, allowed in the physical row only, no client exported, nothing of child_process", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { dependencies: Record<string, string>; exports: Record<string, string> };
  assertEquals(Object.keys(pkg.dependencies), ["ssh2"]);
  assert(/^\d+\.\d+\.\d+$/.test(pkg.dependencies["ssh2"] ?? ""), "an exact version, no range");
  assertEquals(Object.keys(pkg.exports), [".", "./governance", "./logical", "./physical"]);
  const rows = library.kanon.units.filter((u) => "packages" in u) as { folder: string; packages: { name: string }[] }[];
  for (const row of rows) assertEquals(row.packages.some((p) => p.name === "ssh2"), row.folder === "src/physical/", row.folder);
  for (const folder of ["src/governance", "src/logical"]) {
    for await (const f of fs.readDir(path.join(ROOT, folder))) {
      const text = await fs.readTextFile(path.join(ROOT, folder, f.name));
      assert(!/from "(ssh2|node:[a-z/]+)"/.test(text), `${folder}/${f.name} imports nothing external`);
    }
  }
  for await (const f of fs.readDir(path.join(ROOT, "src/physical"))) {
    const text = await fs.readTextFile(path.join(ROOT, "src/physical", f.name));
    assert(!/\bClient\b.*from "ssh2"|new Client\(/.test(text), `${f.name} holds no ssh2 client`);
    assert(!/child_process/.test(text), `${f.name} runs no program`);
  }
});
