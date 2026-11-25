/**
 * Tests of the structure of the mirrored store (commons anyfs-mirror 0001-mirror-layers FR-001, FR-002): the manifest names a plugin of the family of AnyFS with the exports the package has, the governance and logical
 * layers do no input or output, and no source of the library names a backend, so that any backend that is added later works with it.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { library } from "../library.ts";
import * as governance from "../src/governance/mod.ts";
import * as logical from "../src/logical/mod.ts";
import * as physical from "../src/physical/mod.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

async function sources(folder: string): Promise<readonly { readonly file: string; readonly text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for await (const e of fs.readDir(path.join(ROOT, folder))) {
    const full = path.join(folder, e.name);
    if (e.isDirectory) out.push(...(await sources(full)));
    else if (e.name.endsWith(".ts")) out.push({ file: full, text: await fs.readTextFile(path.join(ROOT, full)) });
  }
  return out;
}

proves(["0001-mirror-layers FR-001"], "the manifest is a plugin of the family of AnyFS whose exports are the ones of the package, and the layers are governance, logical and physical", async () => {
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/anyfs");
  const manifest = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals([...library.exports].sort(), Object.keys(manifest.exports).sort());
  assert(Object.keys(governance).includes("DEFAULT_POLICY") && Object.keys(logical).includes("driftOf") && Object.keys(physical).includes("mirrorStore"));
  assertEquals(library.kanon.units.filter((u) => "layer" in u).map((u) => ("layer" in u ? u.layer : "")), ["governance", "logical", "physical"]);
});

proves(["0001-mirror-layers FR-002"], "no source of the governance or logical layer reaches a file, a network or a process, and no source of the library imports a backend", async () => {
  const forbidden = /from "node:|from "@intellectual-frontiers\/(system|net)|\bBun\.|\bDeno\.|\bfetch\(|\bprocess\.(env|exit)/;
  for (const layer of ["src/governance", "src/logical"]) {
    const files = await sources(layer);
    assert(files.length >= 2, "the sources are read");
    for (const f of files) assertEquals(forbidden.test(f.text), false, `${f.file} does input or output`);
  }
  const backends = /from "@intellectual-frontiers\/anyfs-(?!mirror)[a-z]+|from "@intellectual-frontiers\/anyfs\/(memory|local|memory-merge)"/;
  for (const f of await sources("src")) assertEquals(backends.test(f.text), false, `${f.file} imports a backend`);
});
