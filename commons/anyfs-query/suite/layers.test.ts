/**
 * Tests of the structure of the query language (commons anyfs-query 0001-query-layers FR-001, FR-002): the manifest names a plugin of the family of AnyFS with the exports the package has, the layers import only
 * what the manifest says, and no source reaches a file, a network or a process, or an operation that changes a store.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { library } from "../library.ts";
import * as governance from "../src/governance/mod.ts";
import * as logical from "../src/logical/mod.ts";

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

proves(["0001-query-layers FR-001"], "the manifest is a plugin of the family of AnyFS whose exports are the ones of the package, and the layers are governance and logical", async () => {
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
  assertEquals(library.kanon.extends, "@intellectual-frontiers/anyfs");
  const manifest = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals([...library.exports].sort(), Object.keys(manifest.exports).sort());
  assert(Object.keys(governance).includes("parseBudget") && Object.keys(logical).includes("query") && Object.keys(logical).includes("anyfsDialect"));
  assertEquals(library.kanon.units.filter((u) => "layer" in u).map((u) => ("layer" in u ? u.layer : "")), ["governance", "logical"]);
});

proves(["0001-query-layers FR-002"], "no source reaches a file, a network, a process or the clock, and none asks a store for an operation that changes it", async () => {
  const forbidden = /from "node:|from "@intellectual-frontiers\/(system|net)|\bBun\.|\bDeno\.|\bfetch\(|\bprocess\.(env|exit)|\bDate\.now\b|\bnew Date\(\)/;
  const changing = /op:\s*"(write|delete|batch|rename|append)"|\.(write|delete|batch|rename|append)\(/;
  const files = [...(await sources("src/governance")), ...(await sources("src/logical"))];
  assert(files.length >= 10, "the sources are read");
  for (const f of files) {
    assertEquals(forbidden.test(f.text), false, `${f.file} does input or output`);
    assertEquals(changing.test(f.text), false, `${f.file} changes a store`);
  }
});
