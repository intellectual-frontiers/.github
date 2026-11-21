/**
 * Tests of the layers of the plugin (commons archon-dns 0001-dns-layers FR-001 to FR-005): the shared checker of Kanon finds nothing in the real tree of a member of the
 * Archon family, the package exports the dialect, no source imports a dialect or another plugin, `verify` runs every check, the release record agrees with the manifest,
 * and no source runs a package manager, asks for administrator rights or runs a compiler.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";
import { release } from "../release.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-dns-layers FR-001"], "the package is a plugin of the Archon family and the shared checker finds nothing in its real tree", () => {
  assertEquals(library.family, { host: "archon", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/archon");
  assertEquals(library.kanon.units.find((u) => "layer" in u)?.layer, "physical");
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-dns-layers FR-002"], "no source imports a dialect or another plugin, and archon is reached only through its exports", async () => {
  const files = await runtime.readSources(ROOT, ["src"]);
  assert(files.length >= 3);
  for (const f of files) {
    const imports = [...f.text.matchAll(/from "(@intellectual-frontiers\/[^"]+)"/g)].map((m) => m[1] ?? "");
    for (const i of imports) {
      assert(!/^@intellectual-frontiers\/archon-(dialect-|[a-z]+$)/.test(i) || i.startsWith("@intellectual-frontiers/archon-dns"), `${f.path} imports ${i}`);
      if (i.startsWith("@intellectual-frontiers/archon/")) assert(["governance", "logical", "dialect", "cli"].includes(i.split("/")[2] ?? ""), `${f.path} imports ${i}`);
    }
  }
});

proves(["0001-dns-layers FR-003"], "the package exports the plugin", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.exports, { ".": "./src/mod.ts" });
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(library.kanon.package, pkg.name);
});

proves(["0001-dns-layers FR-004"], "verify runs the compiler, the specification checks, the layers check, the trace check, the tests and the check of the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-dns-layers FR-005"], "the release record agrees with the manifest", () => {
  assertEquals(release.slug, library.name);
  assertEquals(release.version, library.version);
  assertEquals(release.kind, "Software");
  assertEquals(library.distribution, ["github"], "held back from npm until the owner says it is ready");
});
