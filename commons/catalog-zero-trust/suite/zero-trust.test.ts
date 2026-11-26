/**
 * Tests of the zero trust package (commons catalog-zero-trust 0002-zero-trust-package FR-001 to FR-007): the conversion and its refusal of a repeated identifier, the real package loaded through the catalog loader of grc with the three frameworks and the crosswalk, the manifest's record of
 * the references, the source digests and the licence, the generator's check, the crosswalk (every row undecided, from a tenet, a function or a capability, to a control that exists in the catalog of SP 800-53 or SP 800-171), and that nothing of the Department of Defense model is written.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CROSSWALK, FRAMEWORKS, FUNCTIONS, GOALS, INPUTS, LICENCE, PILLARS, PILLAR_STAGES, PROPOSALS, REFERENCES, SOURCE_FILES, STAGES, STARTS, TARGETS, TENETS, THEMES, THEME_STAGES } from "../src/governance/mod.ts";
import { convert, mappingsOf } from "../src/logical/mod.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };
type Cw = { id: string; mappings: { from: string; to: string; relationship: string; strength: number; note: string }[] };

const ROOT = path.resolve(PACKAGE_DIR, "..");
const sourceDigests = async (): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const f of SOURCE_FILES) out[f] = await digestOf(await fs.readFile(path.join(ROOT, f)));
  return out;
};
const zeros = Object.fromEntries(SOURCE_FILES.map((f) => [f, "0".repeat(64)]));

proves(["0002-zero-trust-package FR-001", "0002-zero-trust-package FR-004"], "the conversion keeps each entry with its group as family, the same every time, and says which identifier a source repeats", () => {
  const one = { id: "T1", title: "t", statement: "s", family: "tenet" };
  assertEquals(convert([one]).controls, [one]);
  assertEquals(convert([one, one]).repeated, ["T1"]);
  assertEquals(convert(structuredClone(TENETS)), convert(TENETS));
  for (const set of [TENETS, INPUTS, STAGES, PILLARS, THEMES, FUNCTIONS, PILLAR_STAGES, THEME_STAGES, GOALS]) assertEquals(convert(set).repeated, []);
});

proves(["0002-zero-trust-package FR-004"], "the same entries give the same files, byte for byte", async () => {
  const a = await makePackage(zeros);
  const b = await makePackage(zeros);
  assertEquals([...a], [...b]);
});

proves(["0002-zero-trust-package FR-001", "0002-zero-trust-package FR-002"], "the real package loads through the catalog loader with the three frameworks and their entries", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fws = r.value.documents.filter((d) => d.kind === "grc.framework") as unknown as Fw[];
  assertEquals(fws.map((f) => [f.id, f.version]), [
    [FRAMEWORKS.sp800207.id, "2020"],
    [FRAMEWORKS.ztmm.id, "2.0"],
    [FRAMEWORKS.m2209.id, "2022"],
  ]);
  const by = (id: string): Fw["controls"] => fws.find((f) => f.id === id)?.controls ?? [];
  assertEquals(by("nist-sp800-207").length, 15);
  assertEquals(by("cisa-ztmm").length, 66);
  assertEquals(by("omb-m-22-09").length, 5);
  assertEquals(new Set(by("cisa-ztmm").map((c) => c.family)).size, 11);
  assertEquals(by("nist-sp800-207").filter((c) => c.family === "tenet").map((c) => c.id), ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]);
  assertEquals(by("nist-sp800-207").filter((c) => c.family === "input").length, 8);
  assertEquals(by("cisa-ztmm").filter((c) => c.family === "pillar").map((c) => c.id), ["ID", "DV", "NW", "AW", "DT"]);
  assertEquals(by("cisa-ztmm").filter((c) => c.family === "theme").map((c) => c.id), ["VA", "AO", "GV"]);
  assertEquals(by("cisa-ztmm").filter((c) => c.family === "stage").map((c) => c.id), ["ALL@traditional", "ALL@initial", "ALL@advanced", "ALL@optimal"]);
  assertEquals(FUNCTIONS.length, 22);
  assertEquals(PILLAR_STAGES.length, 20);
  assertEquals(THEME_STAGES.length, 12);
  for (const id of ["ID.AU", "ID.AM", "DT.EN", "NW@advanced", "GV@optimal", "AW.DW"]) assert(by("cisa-ztmm").some((c) => c.id === id), id);
  for (const fw of fws) for (const c of fw.controls) assert(c.title.trim() !== "" && c.statement.trim() !== "" && c.family.trim() !== "", `${fw.id} ${c.id}`);
});

proves(["0002-zero-trust-package FR-002"], "the manifest records the three references with the date read, the digest of each source file on disk, the licence, that the content may be redistributed and the notice", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as {
    source: { url: string; edition: string };
    sources: { url: string; sha256: string }[];
    licence: string;
    redistributable: boolean;
    notice: string;
  };
  for (const ref of [REFERENCES.sp800207, REFERENCES.ztmm, REFERENCES.m2209]) assert(m.source.edition.includes(ref.edition) && m.source.edition.includes(ref.url) && m.source.edition.includes(ref.readOn), ref.edition);
  assertEquals(m.source.url, REFERENCES.ztmm.url);
  assert(m.redistributable && m.licence === LICENCE);
  const d = await sourceDigests();
  assertEquals(m.sources, SOURCE_FILES.map((url) => ({ url, sha256: d[url] ?? "" })));
});

proves(["0002-zero-trust-package FR-003"], "the generator finds no difference between the package on disk and the sources, and reports a file that was edited", async () => {
  const tool = path.resolve(ROOT, "tools", "generate.ts");
  const ok = await proc.run(["bun", tool, "--check"], {});
  assert(ok.success, ok.stderr);
  const file = path.join(PACKAGE_DIR, "frameworks", "cisa-ztmm-2.0.json");
  const was = await fs.readTextFile(file);
  try {
    await fs.writeTextFile(file, was.replace("ID.AU", "ID.XX"));
    const bad = await proc.run(["bun", tool, "--check"], {});
    assert(!bad.success && bad.stderr.includes("differs: data/frameworks/cisa-ztmm-2.0.json"), bad.stderr);
  } finally {
    await fs.writeTextFile(file, was);
  }
});

proves(["0002-zero-trust-package FR-005"], "every mapping of the crosswalk is undecided with a reason, starts from a tenet, a function or a capability of the package and reaches a control that the catalog of SP 800-53 or SP 800-171 has", async () => {
  const cw = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "crosswalks", `${CROSSWALK.id}.json`))) as Cw;
  const targets = async (file: string): Promise<Set<string>> => new Set(((JSON.parse(await fs.readTextFile(path.join(ROOT, "..", "catalog-nist-sp800", "data", "frameworks", file))) as Fw).controls).map((c) => c.id));
  const known = { [`${TARGETS.sp80053.framework}:${TARGETS.sp80053.version}`]: await targets("nist-800-53-5.2.0.json"), [`${TARGETS.sp800171.framework}:${TARGETS.sp800171.version}`]: await targets("nist-800-171-3.json") };
  const ours = new Set<string>();
  for (const [fw, controls] of [[FRAMEWORKS.sp800207, [...TENETS, ...INPUTS]], [FRAMEWORKS.ztmm, [...STAGES, ...PILLARS, ...THEMES, ...FUNCTIONS, ...PILLAR_STAGES, ...THEME_STAGES]]] as const) for (const c of controls) ours.add(`urn:grc:${fw.id}:${fw.version}:${c.id}`);
  assert(cw.mappings.length > 0);
  for (const m of cw.mappings) {
    assertEquals(m.relationship, "intersects-with");
    assertEquals(m.strength, 1);
    assert(m.note.startsWith(`${CROSSWALK.pending}: `) && m.note.length > CROSSWALK.pending.length + 20, m.from);
    assert(ours.has(m.from), `${m.from} is a control of the package`);
    const t = /^urn:grc:([a-z0-9-]+):([^:]+):(.+)$/.exec(m.to);
    assert(t !== null, m.to);
    assert(known[`${t?.[1]}:${t?.[2]}`]?.has(t?.[3] ?? "") === true, `${m.to} is a control of the catalog`);
  }
  const from = new Set(cw.mappings.map((m) => m.from));
  for (const id of ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]) assert(from.has(`urn:grc:nist-sp800-207:2020:${id}`), id);
  for (const f of FUNCTIONS) assert(from.has(`urn:grc:cisa-ztmm:2.0:${f.id}`), f.id);
  for (const id of ["VA", "AO", "GV"]) assert(from.has(`urn:grc:cisa-ztmm:2.0:${id}`), id);
  assertEquals(PROPOSALS.length, 32);
});

proves(["0002-zero-trust-package FR-005"], "a proposal that starts from a framework the package does not hold is refused, and the mappings are in a fixed order", () => {
  const made = mappingsOf([{ from: "nothing:X1", basis: "b", sp80053: ["AC-1"], sp800171: [] }], STARTS, CROSSWALK.pending, TARGETS);
  assertEquals(made.mappings, []);
  assertEquals(made.unknown, ["nothing:X1"]);
  const two = mappingsOf([{ from: "cisa-ztmm:B", basis: "b", sp80053: ["AC-2", "AC-1"], sp800171: [] }], STARTS, CROSSWALK.pending, TARGETS);
  assertEquals(two.mappings.map((m) => m.to), ["urn:grc:nist-800-53:5.2.0:AC-1", "urn:grc:nist-800-53:5.2.0:AC-2"]);
});

proves(["0002-zero-trust-package FR-006"], "the licence says the content is our own reading and no statement is long enough to be a transcription of a passage", () => {
  assert(/own words/i.test(LICENCE) && /not a quotation/.test(LICENCE) && /works of the United States government/.test(LICENCE));
  for (const set of [TENETS, INPUTS, STAGES, PILLARS, THEMES, FUNCTIONS, PILLAR_STAGES, THEME_STAGES, GOALS]) for (const e of set) assert(e.statement.length < 450, `${e.id} stays a short reading`);
});

proves(["0002-zero-trust-package FR-007"], "nothing of the Department of Defense model is written, the five pillars are the model's five, and the notice says the model was not read", async () => {
  assertEquals(PILLARS.map((p) => p.id), ["ID", "DV", "NW", "AW", "DT"]);
  const files = await makePackage(await sourceDigests());
  for (const [name, text] of files) {
    if (name === "manifest.json") continue;
    assert(!/Department of Defense|\bDoD\b/.test(text), `${name} writes nothing of the DoD model`);
  }
  const m = JSON.parse(files.get("manifest.json") ?? "{}") as { notice: string };
  assert(/Department of Defense/.test(m.notice) && /not been read/.test(m.notice));
});
