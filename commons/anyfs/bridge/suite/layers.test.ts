/**
 * Tests of the structure of the bridge (commons anyfs-bridge 0001-bridge-layers FR-001, FR-002): the manifest names a plugin of the family of AnyFS with the exports the package has, the layers import
 * only what the manifest says, and the logical layer does no input or output of its own.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { library } from "../library.ts";
import * as governance from "../src/governance/mod.ts";
import * as logical from "../src/logical/mod.ts";
import * as conformance from "../src/conformance/mod.ts";

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

proves(["0001-bridge-layers FR-001"], "the manifest is a plugin of the family of AnyFS whose exports are the ones of the package, and the layers are governance, logical, mirror, exchange and conformance", async () => {
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/anyfs");
  const manifest = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals([...library.exports].sort(), Object.keys(manifest.exports).sort());
  assert(Object.keys(governance).includes("parseGlob") && Object.keys(logical).includes("diff") && Object.keys(conformance).includes("runBridgeConformance"));
  assertEquals(library.kanon.units.filter((u) => "layer" in u).map((u) => ("layer" in u ? u.layer : "")), ["governance", "logical", "logical", "logical", "logical"]);
});

proves(["0001-bridge-layers FR-002"], "no source of the library reaches a file, a network or a process: every change is an operation of a store", async () => {
  const forbidden = /from "node:|from "@intellectual-frontiers\/(system|net)|\bBun\.|\bDeno\.|\bfetch\(|\bprocess\.(env|exit)/;
  const files = [...(await sources("src/governance")), ...(await sources("src/logical")), ...(await sources("src/mirror")), ...(await sources("src/exchange")), ...(await sources("src/conformance"))];
  assert(files.length >= 12, "the sources are read");
  for (const f of files) assertEquals(forbidden.test(f.text), false, `${f.file} does input or output`);
});
