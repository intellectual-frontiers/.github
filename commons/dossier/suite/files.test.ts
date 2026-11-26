/**
 * Tests of the files of a dossier and the offline verify (commons dossier 0002-dossier-core FR-010, FR-011): files written whole into a folder and none outside it, and a verify that names the rendition that changed and rebuilds from the carried sources.
 *
 * @module
 */
import { build } from "@intellectual-frontiers/dossier/logical";
import { FILES, verifyFolder, writeDossier } from "@intellectual-frontiers/dossier/physical";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { declaration, registry, sources as made } from "./fixtures.ts";

const built = async () => {
  const r = await build(declaration("restricted"), registry, await made());
  if (r.kind === "err") throw new Error(r.error.message);
  return r.value;
};

proves(["0002-dossier-core FR-010"], "a dossier is written whole into its folder, with the hash of each rendition, and nothing outside it", async () => {
  const root = await fs.makeTempDir({ prefix: "dossier-" });
  try {
    const b = await built();
    const html = new TextEncoder().encode("<p>made up</p>\n");
    const m = await writeDossier(root, b, { carrySources: true, renditions: new Map([["dossier.html", html]]) });
    assert(m.kind === "ok" && Object.keys(m.value.renditions).sort().join() === "dossier.adoc,dossier.html");
    for (const f of [FILES.adoc, FILES.manifest, FILES.declaration, "dossier.html", "sources/quality__run-001.json"]) assert((await fs.stat(path.join(root, f))).isFile, f);
    const names: string[] = [];
    for await (const e of fs.readDir(root)) names.push(e.name);
    assert(!names.some((n) => n.endsWith(".part")), "no file is left half written");
    const out = await writeDossier(root, b, { renditions: new Map([["../escape.html", html]]) });
    assert(out.kind === "err" && out.error.includes("outside the folder"));
  } finally {
    await fs.remove(root, { recursive: true });
  }
});

proves(["0002-dossier-core FR-011"], "the verify works from the folder alone, names the rendition that changed, and rebuilds from the carried sources", async () => {
  const root = await fs.makeTempDir({ prefix: "dossier-" });
  try {
    const b = await built();
    await writeDossier(root, b, { carrySources: true });
    const good = await verifyFolder(root, registry);
    assertEquals(good.ok, true);
    assertEquals(good.rebuilt, "same");
    const plain = await verifyFolder(root);
    assertEquals(plain.ok, true);
    assertEquals(plain.rebuilt, "not possible");
    await fs.writeTextFile(path.join(root, FILES.adoc), `${b.adoc}an added line\n`);
    const bad = await verifyFolder(root, registry);
    assertEquals(bad.ok, false);
    assert(bad.reasons.some((r) => r.startsWith("dossier.adoc is not what the manifest holds")), bad.reasons.join("; "));
    await fs.remove(path.join(root, FILES.adoc));
    assert((await verifyFolder(root)).reasons.includes("dossier.adoc is missing"));
    const bare = await fs.makeTempDir({ prefix: "dossier-" });
    try {
      await writeDossier(bare, b);
      const v = await verifyFolder(bare, registry);
      assert(v.reasons.some((r) => r.includes("not carried")) && v.rebuilt === "not possible");
    } finally {
      await fs.remove(bare, { recursive: true });
    }
  } finally {
    await fs.remove(root, { recursive: true });
  }
});
