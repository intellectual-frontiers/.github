/**
 * Tests of the ISO/IEC 27001 package (commons catalog-iso27001 0002-iso27001-package FR-001 to FR-007): the conversion and its refusal of a repeated identifier, the real package loaded through the catalog loader of grc with the two frameworks, the manifest's record
 * that both standards are unread, the source digests and the licence, the generator's check, that every identifier is a token OSCAL accepts, and that nothing is long enough to be a passage or claims an attribute value of a control.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ATTRIBUTES, CLAUSE_GROUPS, CLAUSES, CONTROLS, FRAMEWORKS, LICENCE, REFERENCES, SOURCE_FILES, THEMES } from "../src/governance/mod.ts";
import { convert } from "../src/logical/mod.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };

const ROOT = path.resolve(PACKAGE_DIR, "..");
const sourceDigests = async (): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const f of SOURCE_FILES) out[f] = await digestOf(await fs.readFile(path.join(ROOT, f)));
  return out;
};
const zeros = Object.fromEntries(SOURCE_FILES.map((f) => [f, "0".repeat(64)]));

proves(["0002-iso27001-package FR-001", "0002-iso27001-package FR-004"], "the conversion keeps each entry with its group as family, the same every time, and says which identifier a source repeats", () => {
  const one = { id: "A.5.1", title: "t", statement: "s", family: "organizational" };
  assertEquals(convert([one]).controls, [one]);
  assertEquals(convert([one, one]).repeated, ["A.5.1"]);
  assertEquals(convert(structuredClone(CONTROLS)), convert(CONTROLS));
  for (const set of [CLAUSES, CONTROLS, THEMES, ATTRIBUTES]) assertEquals(convert(set).repeated, []);
});

proves(["0002-iso27001-package FR-004"], "the same entries give the same files, byte for byte", async () => {
  const a = await makePackage(zeros);
  const b = await makePackage(zeros);
  assertEquals([...a], [...b]);
});

proves(["0002-iso27001-package FR-001", "0002-iso27001-package FR-002"], "the real package loads through the catalog loader with the two frameworks and their entries", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fws = r.value.documents.filter((d) => d.kind === "grc.framework") as unknown as Fw[];
  assertEquals(fws.map((f) => [f.id, f.version]), [
    [FRAMEWORKS.iso27001.id, "2022"],
    [FRAMEWORKS.iso27002.id, "2022"],
  ]);
  const by = (id: string): Fw["controls"] => fws.find((f) => f.id === id)?.controls ?? [];
  const annex = by("iso-27001").filter((c) => c.id.startsWith("A."));
  assertEquals(annex.length, 93);
  assertEquals(annex.filter((c) => c.family === "organizational").length, 37);
  assertEquals(annex.filter((c) => c.family === "people").length, 8);
  assertEquals(annex.filter((c) => c.family === "physical").length, 14);
  assertEquals(annex.filter((c) => c.family === "technological").length, 34);
  assertEquals(by("iso-27001").filter((c) => c.id.startsWith("C")).length, 30);
  assertEquals(new Set(by("iso-27001").filter((c) => c.id.startsWith("C")).map((c) => c.family)), new Set(CLAUSE_GROUPS.map((g) => g[0])));
  for (const id of ["A.5.1", "A.5.37", "A.6.8", "A.7.14", "A.8.1", "A.8.34", "C4.1", "C6.1.3", "C9.3.3", "C10.2"]) assert(by("iso-27001").some((c) => c.id === id), id);
  assertEquals(by("iso-27002").filter((c) => c.family === "theme").map((c) => c.id), ["organizational", "people", "physical", "technological"]);
  assertEquals(new Set(by("iso-27002").filter((c) => c.family !== "theme").map((c) => c.family)).size, 5);
  for (const fw of fws) for (const c of fw.controls) assert(c.title.trim() !== "" && c.statement.trim() !== "" && c.family.trim() !== "", `${fw.id} ${c.id}`);
});

proves(["0002-iso27001-package FR-002", "0002-iso27001-package FR-007"], "the manifest says both standards are unread and records the digest of each source file, the licence, that the content may be redistributed and the notice", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as {
    source: { url: string; edition: string };
    sources: { url: string; sha256: string }[];
    licence: string;
    redistributable: boolean;
    notice: string;
  };
  for (const ref of [REFERENCES.iso27001, REFERENCES.iso27002]) assert(m.source.edition.includes(ref.edition) && m.source.edition.includes(ref.url) && ref.readOn === "unread" && m.source.edition.includes("unread"), ref.edition);
  assert(m.redistributable && m.licence === LICENCE);
  const d = await sourceDigests();
  assertEquals(m.sources, SOURCE_FILES.map((url) => ({ url, sha256: d[url] ?? "" })));
  assert(/have not been read/.test(m.notice) && /holds the standards/.test(m.notice) && /attributes? of ISO\/IEC 27002 for each control is not in the package/.test(m.notice));
});

proves(["0002-iso27001-package FR-003"], "the generator finds no difference between the package on disk and the sources, and reports a file that was edited", async () => {
  const tool = path.resolve(ROOT, "tools", "generate.ts");
  const ok = await proc.run(["bun", tool, "--check"], {});
  assert(ok.success, ok.stderr);
  const file = path.join(PACKAGE_DIR, "frameworks", "iso-27001-2022.json");
  const was = await fs.readTextFile(file);
  try {
    await fs.writeTextFile(file, was.replace("A.5.1", "A.5.X"));
    const bad = await proc.run(["bun", tool, "--check"], {});
    assert(!bad.success && bad.stderr.includes("differs: data/frameworks/iso-27001-2022.json"), bad.stderr);
  } finally {
    await fs.writeTextFile(file, was);
  }
});

proves(["0002-iso27001-package FR-005"], "every identifier is a token that OSCAL accepts as an identifier", () => {
  const token = /^[A-Za-z_][A-Za-z0-9._-]*$/;
  for (const set of [CLAUSES, CONTROLS, THEMES, ATTRIBUTES]) for (const e of set) assert(token.test(e.id), e.id);
});

proves(["0002-iso27001-package FR-006"], "the licence says the content is our own reading and no statement is long enough to be a transcription of a passage", () => {
  assert(/own words/i.test(LICENCE) && /not a quotation/.test(LICENCE) && /licensed works/.test(LICENCE));
  for (const set of [CLAUSES, CONTROLS, THEMES, ATTRIBUTES]) for (const e of set) assert(e.statement.length < 520, `${e.id} stays a short reading`);
});

proves(["0002-iso27001-package FR-007"], "no control is tied to an attribute value, and both references say unread", async () => {
  assertEquals([REFERENCES.iso27001.readOn, REFERENCES.iso27002.readOn], ["unread", "unread"]);
  const files = await makePackage(await sourceDigests());
  const fw = JSON.parse(files.get("frameworks/iso-27001-2022.json") ?? "{}") as Fw;
  for (const c of fw.controls) assertEquals(Object.keys(c).sort(), ["family", "id", "statement", "title"], `${c.id} carries no attribute value`);
});
