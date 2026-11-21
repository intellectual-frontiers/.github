/**
 * Tests of the SOC 2 package (commons catalog-soc2 0002-soc2-package FR-001 to FR-005): the conversion and its refusal of a repeated identifier, the real package loaded through the catalog loader of grc with the 61 criteria in 20 series, the manifest's record of the reference, the source digest and the licence,
 * the generator's check, and that no statement is a sentence of the publication's own (the points of focus are not here, and the wording says it is a reading).
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CATEGORY_OF, COMMON_FAMILIES, CRITERIA, LICENCE, REFERENCE, SOURCE_FILE } from "../src/governance/mod.ts";
import { convert } from "../src/logical/mod.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };

proves(["0002-soc2-package FR-001", "0002-soc2-package FR-004"], "the conversion keeps each criterion with its series as family, the same every time, and says which identifier a source repeats", () => {
  const one = { id: "CC1.1", title: "t", statement: "s", family: "CC1" };
  assertEquals(convert([one]).controls, [one]);
  assertEquals(convert([one, one]).repeated, ["CC1.1"]);
  assertEquals(convert(structuredClone(CRITERIA)), convert(CRITERIA));
});

proves(["0002-soc2-package FR-004"], "the same criteria give the same files, byte for byte", async () => {
  const a = await makePackage("0".repeat(64));
  const b = await makePackage("0".repeat(64));
  assertEquals([...a], [...b]);
});

proves(["0002-soc2-package FR-001", "0002-soc2-package FR-002"], "the real package loads through the catalog loader with the 61 criteria in the 20 series, and every series is of a category", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fws = r.value.documents as unknown as Fw[];
  assertEquals(fws.map((f) => [f.id, f.version]), [["soc2-tsc", "2017"]]);
  const cs = fws[0]?.controls ?? [];
  assertEquals(cs.length, 61);
  assertEquals(new Set(cs.map((c) => c.id)).size, 61);
  assertEquals(new Set(cs.map((c) => c.family)).size, 20);
  assertEquals(cs.filter((c) => c.family.startsWith("CC")).length, 33);
  assertEquals(cs.filter((c) => c.family.startsWith("P") && !c.family.startsWith("PI")).length, 18);
  for (const id of ["CC6.1", "CC9.2", "A1.2", "C1.2", "PI1.3", "P6.7", "P8.1"]) assert(cs.some((c) => c.id === id), id);
  for (const c of cs) {
    assert(/^(CC|A|C|PI|P)\d+\.\d+$/.test(c.id) && c.id.startsWith(c.family), c.id);
    assert(c.title.trim() !== "" && c.statement.trim() !== "" && CATEGORY_OF[c.family] !== undefined, c.id);
  }
  assertEquals(COMMON_FAMILIES.length, 9);
});

proves(["0002-soc2-package FR-002"], "the manifest records the reference, the digest of the source file on disk, the licence and that the content may be redistributed", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { url: string; edition: string }; sources: { url: string; sha256: string }[]; licence: string; redistributable: boolean };
  assertEquals(m.source.url, REFERENCE.url);
  assert(m.source.edition.includes("2022") && m.redistributable && m.licence === LICENCE);
  assertEquals(m.sources, [{ url: SOURCE_FILE, sha256: await digestOf(await fs.readFile(path.join(PACKAGE_DIR, "..", SOURCE_FILE))) }]);
});

proves(["0002-soc2-package FR-003"], "the generator finds no difference between the package on disk and the source, and reports a file that was edited", async () => {
  const tool = path.resolve(PACKAGE_DIR, "..", "tools", "generate.ts");
  const ok = await proc.run(["bun", tool, "--check"], {});
  assert(ok.success, ok.stderr);
  const file = path.join(PACKAGE_DIR, "frameworks", "soc2-tsc-2017.json");
  const was = await fs.readTextFile(file);
  try {
    await fs.writeTextFile(file, was.replace("CC1.1", "CC1.9"));
    const bad = await proc.run(["bun", tool, "--check"], {});
    assert(!bad.success && bad.stderr.includes("differs: data/frameworks/soc2-tsc-2017.json"), bad.stderr);
  } finally {
    await fs.writeTextFile(file, was);
  }
});

proves(["0002-soc2-package FR-005"], "the licence says the content is our own reading and the AICPA's text is not carried, and no statement is long enough to be a transcription of a criterion with its points of focus", () => {
  assert(/own words/i.test(LICENCE) && /not carried/.test(LICENCE) && /not a quotation/.test(LICENCE));
  assert(CRITERIA.every((c) => c.statement.length < 260 && !/points? of focus/i.test(c.statement)), "a statement stays a short reading");
});
