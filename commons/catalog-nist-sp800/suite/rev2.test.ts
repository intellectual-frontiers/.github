/**
 * Tests of the SP 800-171 Revision 2 frameworks (commons catalog-nist-sp800 0003-sp800-171-r2 FR-001 to FR-004): the reading of the printed text on a made-up extract (families, wrapped statements, page furniture and watermark, footnote marks, lettered and single objectives, the worked example read over), the real package loaded
 * through the catalog loader of grc with the 110 requirements and the 320 objectives of the publications, and the manifest's record of the two PDFs.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { PRINTED_SOURCES } from "../src/governance/mod.ts";
import { readObjectives, readRequirements } from "../src/logical/mod.ts";
import { PACKAGE_DIR } from "../src/physical/mod.ts";

const MARK = "This\npublication\nis\navailable\nfree\nof\ncharge\nfrom:\nhttps://doi.org/10.6028/NIST.SP.800-171r2";
const TEXT = [
  "3.1 ACCESS CONTROL............ 10", "front matter", "3.1 ACCESS CONTROL", "Basic Security Requirements",
  "3.1.1 Limit system access to authorized users, processes acting on behalf of", "authorized users.", "DISCUSSION", "Access control policies.",
  "3.1.2 Limit system access to the types of transactions and functions that", "CHAPTER THREE PAGE 10", "SP 800-171, REVISION 2 PROTECTING CONTROLLED UNCLASSIFIED INFORMATION", MARK, "authorized users are permitted to execute.23 24",
  "3.2 AWARENESS AND TRAINING", "3.2.1 Ensure that managers are aware.", "APPENDIX A", "3.9.9 not in a chapter.",
].join("\n");
const REQS = readRequirements(TEXT).requirements;

const A = [
  "3.1.1 SECURITY REQUIREMENT", "Limit access.", "ASSESSMENT OBJECTIVE", "Determine if:", "3.1.1[a] authorized users are identified.", "3.1.1[b] devices are", "identified.", "POTENTIAL ASSESSMENT METHODS AND OBJECTS", "Examine: x",
  "3.1.2 SECURITY REQUIREMENT", "Limit transactions.", "ASSESSMENT OBJECTIVE", "Determine if the types of transactions are limited.", "POTENTIAL ASSESSMENT METHODS AND OBJECTS",
  "3.2.1 SECURITY REQUIREMENT", "Example, before the requirements.", "ASSESSMENT OBJECTIVE", "Determine if:", "3.2.1[a] the worked example.", "POTENTIAL ASSESSMENT METHODS AND OBJECTS",
  "3.2.1 SECURITY REQUIREMENT", "Ensure.", "ASSESSMENT OBJECTIVE", "Determine if:", "3.2.1[a] managers are aware.", "POTENTIAL ASSESSMENT METHODS AND OBJECTS",
].join("\n");

proves(["0003-sp800-171-r2 FR-001", "0003-sp800-171-r2 FR-004"], "the requirements are read from the chapter's text with the family of each, statements wrapped over lines and pages, without the page furniture, the watermark or the footnote marks, and the same every time", () => {
  assertEquals(REQS.map((r) => [r.id, r.family, r.title]), [["3.1.1", "3.1", "Access Control"], ["3.1.2", "3.1", "Access Control"], ["3.2.1", "3.2", "Awareness and Training"]]);
  assertEquals(REQS[0]?.statement, "Limit system access to authorized users, processes acting on behalf of authorized users.");
  assertEquals(REQS[1]?.statement, "Limit system access to the types of transactions and functions that authorized users are permitted to execute.");
  assertEquals(readRequirements(TEXT), readRequirements(`${TEXT}`));
});

proves(["0003-sp800-171-r2 FR-001"], "the objectives are the lettered ones of a requirement or its single one under its number, a statement wrapped over lines is one statement, and the worked example of the guide is read over by the requirement's own block", () => {
  const o = readObjectives(A, REQS);
  assertEquals(o.map((x) => [x.id, x.family]), [["3.1.1[a]", "3.1.1"], ["3.1.1[b]", "3.1.1"], ["3.1.2", "3.1.2"], ["3.2.1[a]", "3.2.1"]].filter((x) => x[0] !== "3.1.2" || REQS.some((r) => r.id === "3.1.2")));
  assertEquals(o[1]?.statement, "devices are identified.");
  assertEquals(o[2]?.statement, "the types of transactions are limited.");
  assertEquals(o[3]?.statement, "managers are aware.");
});

proves(["0003-sp800-171-r2 FR-001", "0003-sp800-171-r2 FR-002"], "the real package holds the 110 requirements and the 320 objectives of Revision 2, in the 14 families, every objective of a requirement that is there, with no page furniture left in any statement", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };
  const fws = new Map((r.value.documents as unknown as Fw[]).map((d) => [d.id, d]));
  const req = fws.get("nist-800-171-r2");
  const obj = fws.get("nist-800-171a-r2");
  assert(req !== undefined && obj !== undefined);
  assertEquals([req.version, obj.version], ["2", "1"]);
  assertEquals([req.controls.length, obj.controls.length], [110, 320]);
  assertEquals(new Set(req.controls.map((c) => c.family)).size, 14);
  const ids = new Set(req.controls.map((c) => c.id));
  assert(["3.1.1", "3.5.3", "3.13.11", "3.14.7"].every((id) => ids.has(id)));
  assert(obj.controls.every((c) => ids.has(c.family)), "every objective of SP 800-171A is of a requirement of Revision 2");
  assertEquals(new Set(obj.controls.map((c) => c.family)).size, 110, "every requirement has an objective");
  for (const c of [...req.controls, ...obj.controls]) assert(/[.]$/.test(c.statement) && !/publication|PAGE|doi\.org|\d$/.test(c.statement), `${c.id}: ${c.statement}`);
});

proves(["0003-sp800-171-r2 FR-002"], "the manifest records the address and the SHA-256 of each PDF and the edition", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { edition: string }; sources: { url: string; sha256: string }[] };
  for (const s of PRINTED_SOURCES) {
    assert(m.sources.some((x) => x.url === s.url && x.sha256 === s.sha256), s.url);
    assert(m.source.edition.includes(s.edition), s.edition);
    assert(/^[0-9a-f]{64}$/.test(s.sha256));
  }
});

proves(["0003-sp800-171-r2 FR-003"], "the generator refuses a PDF that is not the pinned one, before it reads anything else", async () => {
  const tool = path.resolve(PACKAGE_DIR, "..", "tools", "generate.ts");
  await fs.withTempDir(async (dir) => {
    for (const s of PRINTED_SOURCES) await fs.writeTextFile(path.join(dir, s.url.slice(s.url.lastIndexOf("/") + 1)), "not the publication");
    const r = await proc.run(["bun", tool, "--source-dir", dir, "--pdf-dir", dir, "--check"], {});
    assert(!r.success && r.stderr.includes("refused") && r.stderr.includes(".pdf"), r.stderr);
  });
});
