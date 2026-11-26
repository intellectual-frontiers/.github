/**
 * Tests of the HIPAA Security Rule package (commons catalog-hipaa 0002-hipaa-package FR-001 to FR-006): the conversion and its refusal of a repeated identifier, the real package loaded through the catalog loader of grc with the 65 entries in the five sections, the manifest's record of the regulation,
 * the source digest and the licence, the generator's check, what each statement starts with, that every identifier is a token OSCAL accepts and that no statement is long enough to be a paragraph.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ENTRIES, FRAMEWORK, KINDS, LICENCE, REFERENCE, SECTIONS, SOURCE_FILE } from "../src/governance/mod.ts";
import { convert } from "../src/logical/mod.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };

proves(["0002-hipaa-package FR-001", "0002-hipaa-package FR-004"], "the conversion keeps each entry with its section as family, the same every time, and says which identifier a source repeats", () => {
  const one = { id: "164.308.a.1", title: "t", statement: "s", family: "164.308" };
  assertEquals(convert([one]).controls, [one]);
  assertEquals(convert([one, one]).repeated, ["164.308.a.1"]);
  assertEquals(convert(structuredClone(ENTRIES)), convert(ENTRIES));
  assertEquals(convert(ENTRIES).repeated, []);
});

proves(["0002-hipaa-package FR-004"], "the same entries give the same files, byte for byte", async () => {
  const a = await makePackage("0".repeat(64));
  const b = await makePackage("0".repeat(64));
  assertEquals([...a], [...b]);
});

proves(["0002-hipaa-package FR-001", "0002-hipaa-package FR-002", "0002-hipaa-package FR-005"], "the real package loads through the catalog loader with the 65 entries in the five sections, each starting with what it is", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fws = r.value.documents.filter((d) => d.kind === "grc.framework") as unknown as Fw[];
  assertEquals(fws.map((f) => [f.id, f.version]), [[FRAMEWORK.id, "2026"]]);
  const cs = fws[0]?.controls ?? [];
  assertEquals(cs.length, 65);
  assertEquals(SECTIONS.map((s) => [s[0], cs.filter((c) => c.family === s[0]).length]), [["164.308", 30], ["164.310", 12], ["164.312", 12], ["164.314", 6], ["164.316", 5]]);
  const count = (k: string): number => cs.filter((c) => c.statement.startsWith(k)).length;
  assertEquals([count(KINDS.standard), count(KINDS.required), count(KINDS.addressable)], [22, 21, 22]);
  for (const id of ["164.308.a.1.ii.A", "164.312.a.2.iv", "164.314.a.2.iii", "164.316.b.2.i"]) assert(cs.some((c) => c.id === id), id);
  assert(cs.find((c) => c.id === "164.312.a.2.iv")?.statement.startsWith(KINDS.addressable) === true);
  assert(cs.find((c) => c.id === "164.308.a.3.ii.B")?.statement.startsWith(KINDS.addressable) === true, "the paragraph says addressable where the table leaves the mark off");
  for (const c of cs) assert(c.title.trim() !== "" && c.statement.trim() !== "" && c.id.startsWith(c.family), c.id);
});

proves(["0002-hipaa-package FR-002"], "the manifest records the regulation with the date read, the digest of the source file on disk, the licence and that the content may be redistributed", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { url: string; edition: string }; sources: { url: string; sha256: string }[]; licence: string; redistributable: boolean; notice: string };
  assert(m.source.edition.includes(REFERENCE.edition) && m.source.edition.includes(REFERENCE.readOn));
  assertEquals(m.source.url, REFERENCE.url);
  assert(m.redistributable && m.licence === LICENCE && /in force are not here|not in force/.test(m.notice));
  assertEquals(m.sources, [{ url: SOURCE_FILE, sha256: await digestOf(await fs.readFile(path.join(PACKAGE_DIR, "..", SOURCE_FILE))) }]);
});

proves(["0002-hipaa-package FR-003"], "the generator finds no difference between the package on disk and the source, and reports a file that was edited", async () => {
  const tool = path.resolve(PACKAGE_DIR, "..", "tools", "generate.ts");
  const ok = await proc.run(["bun", tool, "--check"], {});
  assert(ok.success, ok.stderr);
  const file = path.join(PACKAGE_DIR, "frameworks", "hipaa-security-2026.json");
  const was = await fs.readTextFile(file);
  try {
    await fs.writeTextFile(file, was.replace("164.308.a.1", "164.308.a.9"));
    const bad = await proc.run(["bun", tool, "--check"], {});
    assert(!bad.success && bad.stderr.includes("differs: data/frameworks/hipaa-security-2026.json"), bad.stderr);
  } finally {
    await fs.writeTextFile(file, was);
  }
});

proves(["0002-hipaa-package FR-005", "0002-hipaa-package FR-006"], "every identifier is the section and the paragraphs joined by dots, the licence says the regulation stays the authority and no statement is long enough to be a paragraph", () => {
  for (const e of ENTRIES) {
    assert(/^164\.[0-9]{3}(\.[A-Za-z0-9]+)+$/.test(e.id), e.id);
    assert(e.statement.length < 400, `${e.id} stays a short reading`);
  }
  assert(/own words/i.test(LICENCE) && /not a quotation/.test(LICENCE) && /stays the authority/.test(LICENCE) && /164\.306\(d\)/.test(LICENCE));
});
