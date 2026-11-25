/**
 * Tests of the collection of contributions from manifests (commons workbench 0003-workbench-contract FR-007): the manifests of a folder of libraries and of the extensions inside one are read, each unit is named by its manifest,
 * a manifest with no workbench field contributes nothing and every invalid contribution is named with its unit. The manifests are made up in a temporary folder.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { readManifestContributions, readManifests } from "@intellectual-frontiers/workbench/physical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

async function withTree<T>(files: Readonly<Record<string, string>>, use: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.makeTempDir({ prefix: "workbench-collect-" });
  try {
    for (const [file, text] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeTextFile(path.join(root, file), text);
    }
    return await use(root);
  } finally {
    await fs.remove(root, { recursive: true }).catch(() => undefined);
  }
}

const manifest = (name: string, workbench?: string): string => `export const library = { name: ${JSON.stringify(name)}, version: "0.1.0"${workbench === undefined ? "" : `, workbench: ${workbench}`} };\n`;
const SQLITE = `{ requirements: [{ kind: "program", id: "sqlite3", name: "sqlite3", task: "test", summary: "needs sqlite3" }], tests: [{ glob: "suite/*.test.ts", needs: ["sqlite3"] }] }`;

proves(["0003-workbench-contract FR-007"], "manifests of libraries and of the extensions inside one are read, each unit is named by its manifest, and one with no workbench field contributes nothing", async () => {
  await withTree({ "commons/alpha/library.ts": manifest("alpha", SQLITE), "commons/alpha/beta/library.ts": manifest("alpha-beta"), "commons/gamma/library.ts": manifest("gamma", `{ requirements: [] }`), "commons/node_modules/x/library.ts": manifest("never") }, async (root) => {
    assertEquals((await readManifests(root)).map((m) => [m.unit, m.folder]), [["alpha", "commons/alpha"], ["alpha-beta", "commons/alpha/beta"], ["gamma", "commons/gamma"]]);
    const r = await readManifestContributions(root);
    assert(r.kind === "ok");
    assertEquals(r.value.map((c) => [c.unit, c.requirements.length]), [["alpha", 1], ["gamma", 0]]);
  });
});

proves(["0003-workbench-contract FR-007"], "every invalid contribution is named with its unit, all at once", async () => {
  await withTree({ "commons/one/library.ts": manifest("one", `{ requirements: [{ kind: "tool", id: "x" }] }`), "commons/two/library.ts": manifest("two", `"nope"`) }, async (root) => {
    const r = await readManifestContributions(root);
    assert(r.kind === "err");
    assertEquals(r.error.map((p) => p.split(":")[0]), ["one", "two"]);
  });
});
