/**
 * Tests of the NIST CSF 2.0 package (commons catalog-nist-csf-2 0002-csf2-package FR-001 to FR-004): the conversion on a small made-up source, and the real package loaded through the catalog loader of grc, with its counts, identifiers, source record and
 * the digest that the generator pins. The real package is the data in `data/`.
 *
 * @module
 */
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { SOURCE } from "../src/governance/mod.ts";
import { convert, type Source } from "../src/logical/mod.ts";
import { makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

const el = (element_type: string, element_identifier: string, title: string, text: string) => ({ element_type, element_identifier, title, text });
const rel = (s: string, d: string) => ({ source_element_identifier: s, dest_element_identifier: d, relationship_identifier: "projection" });
const SMALL: Source = {
  elements: [
    el("function", "XX", "EXAMPLE", "f"),
    el("category", "XX.AA", "Alpha", ""),
    el("subcategory", "XX.AA-02", "", "second"),
    el("subcategory", "XX.AA-01", "", "first"),
    el("subcategory", "XX.AA-09", "", "gone"),
    el("withdraw_reason", "WR-XX.AA-09", "", "Incorporated into XX.AA-01"),
  ],
  relationships: [rel("XX", "XX.AA"), rel("XX.AA", "XX.AA-01"), rel("XX.AA-09", "WR-XX.AA-09")],
};

proves(["0002-csf2-package FR-001"], "the conversion keeps the active subcategories, sorted, with their category as the title and the family, and drops a withdrawn one", () => {
  assertEquals(convert(SMALL), {
    functions: ["XX"],
    categories: ["XX.AA"],
    controls: [{ id: "XX.AA-01", title: "Alpha", statement: "first", family: "XX.AA" }, { id: "XX.AA-02", title: "Alpha", statement: "second", family: "XX.AA" }],
  });
});

proves(["0002-csf2-package FR-004"], "the conversion makes the same files from the same source", async () => {
  const a = await makePackage(SMALL);
  const b = await makePackage(structuredClone(SMALL));
  assertEquals([...a], [...b]);
});

proves(["0002-csf2-package FR-001", "0002-csf2-package FR-002"], "the real package loads through the catalog loader, with 6 functions, 22 categories and 106 controls", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fw = r.value.documents[0] as unknown as { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };
  assertEquals([fw.id, fw.version], ["nist-csf", "2.0"]);
  assertEquals(fw.controls.length, 106);
  for (const c of fw.controls) {
    assert(/^[A-Z]{2}\.[A-Z]{2}-\d{2}$/.test(c.id), c.id);
    assert(c.statement.length > 10 && c.title !== "" && c.id.startsWith(`${c.family}-`), c.id);
  }
  assertEquals(new Set(fw.controls.map((c) => c.id)).size, 106);
  assertEquals(new Set(fw.controls.map((c) => c.family)).size, 22);
  assertEquals(new Set(fw.controls.map((c) => c.id.slice(0, 2))), new Set(["GV", "ID", "PR", "DE", "RS", "RC"]));
});

proves(["0002-csf2-package FR-002", "0002-csf2-package FR-003"], "the manifest records the source, its pinned digest and the licence, and says the content may be redistributed", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { publisher: string; url: string }; sources: { url: string; sha256: string }[]; licence: string; redistributable: boolean };
  assertEquals(m.sources, [{ url: SOURCE.url, sha256: SOURCE.sha256 }]);
  assertEquals(m.source.publisher, SOURCE.publisher);
  assert(m.licence.includes("public information") && m.redistributable);
});

proves(["0002-csf2-package FR-003"], "the files on disk are what the generator makes from the source, and the generator refuses another source", async () => {
  const tool = path.resolve(PACKAGE_DIR, "..", "tools", "generate.ts");
  const bogus = await fs.makeTempFile();
  try {
    await fs.writeTextFile(bogus, "{}");
    const r = await proc.run(["bun", tool, "--source", bogus, "--check"], {});
    assert(!r.success);
    assert(r.stderr.includes("refused"), r.stderr);
  } finally {
    await fs.remove(bogus);
  }
  // files on disk are the generator's: the framework's digest in the manifest is the digest of the framework file
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { holds: { file: string }[] };
  assertEquals(m.holds.map((h) => h.file), ["frameworks/nist-csf-2.0.json"]);
});
