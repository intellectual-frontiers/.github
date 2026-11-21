/**
 * Tests of the NIST SP 800 package (commons catalog-nist-sp800 0002-sp800-package FR-001 to FR-004): the conversion on a small made-up catalog (withdrawn controls dropped, parameters written out, only the leaf objectives), the real package loaded through the catalog loader of grc with
 * its counts and the link of every objective to its requirement, the manifest's record of the commit, the digests and the licence, and the generator that refuses a source that is not the pinned one. The real package is the data in `data/`.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { FRAMEWORKS, REPOSITORY, SOURCES, urlOf } from "../src/governance/mod.ts";
import { convertCatalog, type Catalog } from "../src/logical/mod.ts";
import { makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

const SMALL: Catalog = {
  catalog: {
    groups: [
      {
        id: "xx",
        title: "Example",
        controls: [
          {
            id: "xx-1",
            title: "First",
            props: [{ name: "label", value: "XX-01", class: "zero-padded" }, { name: "label", value: "XX-1" }],
            params: [{ id: "xx-01_odp.01", label: "frequency" }, { id: "xx-01_odp.02", select: { "how-many": "one-or-more", choice: ["a", "b"] } }],
            parts: [
              { name: "statement", parts: [{ name: "item", props: [{ name: "label", value: "a." }], prose: "Do it {{ insert: param, xx-01_odp.01 }} using {{ insert: param, xx-01_odp.02 }}." }] },
              { name: "assessment-objective", props: [{ name: "label", value: "XX-01" }], parts: [{ name: "assessment-objective", props: [{ name: "label", value: "XX-01a." }], parts: [{ name: "assessment-objective", props: [{ name: "label", value: "XX-01a.[01]" }], prose: "it is done;" }, { name: "assessment-objective", props: [{ name: "label", value: "XX-01a.[02]" }], prose: "it is recorded;" }] }] },
            ],
            controls: [{ id: "xx-1.1", title: "Enhanced", props: [{ name: "label", value: "XX-1(1)" }], parts: [{ name: "statement", prose: "More." }] }, { id: "xx-1.2", title: "Gone", props: [{ name: "label", value: "XX-1(2)" }, { name: "status", value: "withdrawn" }] }],
          },
        ],
      },
    ],
  },
};

proves(["0002-sp800-package FR-001", "0002-sp800-package FR-004"], "the conversion keeps the controls and enhancements that are not withdrawn, writes out the parameters, and makes only the leaf objectives controls of the objectives framework, the same every time", () => {
  const c = convertCatalog(SMALL, "800-53");
  assertEquals(c.requirements.map((r) => r.id), ["XX-1", "XX-1(1)"]);
  assertEquals(c.requirements[0]?.statement, "  a. Do it [Assignment: frequency] using [Selection (one or more): a; b].");
  assertEquals(c.requirements[0]?.family, "XX");
  assertEquals(c.objectives.map((o) => [o.id, o.family]), [["XX-01a.[01]", "XX-1"], ["XX-01a.[02]", "XX-1"]]);
  assertEquals(convertCatalog(structuredClone(SMALL), "800-53"), c);
});

proves(["0002-sp800-package FR-004"], "the same catalogs give the same files, byte for byte", async () => {
  const a = await makePackage({ "800-53": SMALL, "800-171": { catalog: { groups: [] } } });
  const b = await makePackage({ "800-53": structuredClone(SMALL), "800-171": { catalog: { groups: [] } } });
  assertEquals([...a], [...b]);
});

proves(["0002-sp800-package FR-001", "0002-sp800-package FR-002"], "the real package loads through the catalog loader with the counts of the publications, and every objective is of a requirement that is there", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };
  const fws = new Map((r.value.documents as unknown as Fw[]).map((d) => [d.id, d]));
  assertEquals([...fws.keys()], FRAMEWORKS.map((f) => f.id));
  assertEquals([...fws.values()].map((f) => f.controls.length), [1014, 2781, 97, 422]);
  for (const f of fws.values()) {
    assertEquals(new Set(f.controls.map((c) => c.id)).size, f.controls.length, `${f.id} has no control twice`);
    for (const c of f.controls) assert(c.statement.trim() !== "" && c.family !== "", `${f.id} ${c.id}`);
  }
  const ids53 = new Set(fws.get("nist-800-53")?.controls.map((c) => c.id));
  assert(["AC-1", "AC-2", "AC-2(1)", "SC-28", "SI-4", "IA-5(1)"].every((id) => ids53.has(id)));
  assert(fws.get("nist-800-53a")?.controls.every((o) => ids53.has(o.family)), "every objective of SP 800-53A is of a control of SP 800-53");
  const ids171 = new Set(fws.get("nist-800-171")?.controls.map((c) => c.id));
  assert(ids171.has("03.01.01") && ids171.has("03.13.08"));
  assert(fws.get("nist-800-171a")?.controls.every((o) => ids171.has(o.family)), "every objective of SP 800-171A is of a requirement of SP 800-171");
  assertEquals(new Set(fws.get("nist-800-171")?.controls.map((c) => c.family)).size, 17, "the 17 families of SP 800-171 Rev 3");
  assertEquals(new Set(fws.get("nist-800-53")?.controls.map((c) => c.family)).size, 20, "the 20 families of SP 800-53 Rev 5");
});

proves(["0002-sp800-package FR-002", "0002-sp800-package FR-003"], "the manifest records the repository, the commit, the digest of each source, the licence and that the content may be redistributed", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { edition: string }; sources: { url: string; sha256: string }[]; licence: string; redistributable: boolean };
  assertEquals(m.sources, SOURCES.map((s) => ({ url: urlOf(s), sha256: s.sha256 })));
  assert(m.source.edition.includes(REPOSITORY.commit) && m.licence.includes("CC0 1.0") && m.redistributable);
  assert(m.sources.every((s) => s.url.includes(REPOSITORY.commit)), "every source is read at the commit, not at a branch");
});

proves(["0002-sp800-package FR-003"], "the generator refuses a source that is not the pinned one, and the files on disk are those of the pinned sources (checked where they are at hand)", async () => {
  const tool = path.resolve(PACKAGE_DIR, "..", "tools", "generate.ts");
  await fs.withTempDir(async (dir) => {
    for (const s of SOURCES) {
      await fs.mkdir(path.join(dir, path.dirname(s.path)), { recursive: true });
      await fs.writeTextFile(path.join(dir, s.path), "{}");
    }
    const r = await proc.run(["bun", tool, "--source-dir", dir, "--check"], {});
    assert(!r.success && r.stderr.includes("refused"), r.stderr);
  });
  const real = process.env["OSCAL_CONTENT"];
  if (real !== undefined && real !== "") {
    const ok = await proc.run(["bun", tool, "--source-dir", real, "--check"], {});
    assert(ok.success, `the files differ from what the sources give: ${ok.stderr}`);
  }
});
