/**
 * Tests of the crosswalks (commons catalog-crosswalks 0002-crosswalks FR-001 to FR-007): the real package loaded through the catalog loader of grc, every source a control of the catalog it names and every target a control of the catalog of SP 800-53 or SOC 2, every row undecided with a reason,
 * the derivation of ISO/IEC 27001 to SOC 2, the generator's check, the coverage in the six standings (no percentage, undecided rows not counted, the worst standing wins), and the OSCAL catalogs and mapping collection (their identifiers, their bytes, and their validity against NIST's schema where it is at hand).
 *
 * @module
 */
import { STANDINGS as ASSESSMENT_STANDINGS } from "@intellectual-frontiers/assessment/governance";
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CROSSWALKS, HIPAA_PROPOSALS, ISO_PROPOSALS, LICENCE, OSCAL_VERSION, PENDING, REFERENCES, SIDES, SOC2_PROPOSALS, SOURCE_FILES, MADE_AT } from "../src/governance/mod.ts";
import { composeThrough, coverageOf, mappingsOf, oscalCatalogOf, oscalMappingOf, STANDINGS, tokenOf, urnOf, type Crosswalk, type Framework, type Row, type Standing } from "../src/logical/mod.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/mod.ts";

const ROOT = path.resolve(PACKAGE_DIR, "..");
const zeros = Object.fromEntries(SOURCE_FILES.map((f) => [f, "0".repeat(64)]));
const sourceDigests = async (): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const f of SOURCE_FILES) out[f] = await digestOf(await fs.readFile(path.join(ROOT, f)));
  return out;
};
const frameworkAt = async (lib: string, file: string): Promise<Framework> => JSON.parse(await fs.readTextFile(path.join(ROOT, "..", lib, "data", "frameworks", file))) as Framework;
const loadFrameworks = async (): Promise<Record<string, Framework>> => ({
  soc2: await frameworkAt("catalog-soc2", "soc2-tsc-2017.json"),
  iso: await frameworkAt("catalog-iso27001", "iso-27001-2022.json"),
  hipaa: await frameworkAt("catalog-hipaa", "hipaa-security-2026.json"),
  sp80053: await frameworkAt("catalog-nist-sp800", "nist-800-53-5.2.0.json"),
});
const crosswalkAt = async (id: string): Promise<Crosswalk> => JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "crosswalks", `${id}.json`))) as Crosswalk;

proves(["0002-crosswalks FR-001", "0002-crosswalks FR-002"], "the real package loads through the catalog loader with the four crosswalks", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const ids = r.value.documents.filter((d) => d.kind === "grc.crosswalk").map((d) => (d as unknown as { id: string }).id);
  assertEquals(ids, Object.values(CROSSWALKS).map((c) => c.id));
});

proves(["0002-crosswalks FR-001"], "every source is a control of the framework it names, every one of its controls is the source of a row, and every target is a control of the catalog it names", async () => {
  const fws = await loadFrameworks();
  const has = (fw: Framework): Set<string> => new Set(fw.controls.map((c) => urnOf(fw.id, fw.version, c.id)));
  const sets = { soc2: has(fws["soc2"] as Framework), iso: has(fws["iso"] as Framework), hipaa: has(fws["hipaa"] as Framework), sp80053: has(fws["sp80053"] as Framework) };
  assertEquals(fws["sp80053"]?.version, SIDES.sp80053.version);
  for (const [key, from, to] of [["soc2", sets.soc2, sets.sp80053], ["iso", sets.iso, sets.sp80053], ["hipaa", sets.hipaa, sets.sp80053], ["isoSoc2", sets.iso, sets.soc2]] as const) {
    const cw = await crosswalkAt(CROSSWALKS[key].id);
    assert(cw.mappings.length > 0);
    for (const m of cw.mappings) {
      assert(from.has(m.from), `${m.from} is a control of its framework`);
      assert(to.has(m.to), `${m.to} is a control of the catalog it names`);
    }
    if (key !== "isoSoc2") {
      const starts = new Set(cw.mappings.map((m) => m.from));
      for (const f of from) {
        if (f.startsWith("urn:grc:iso-27001:2022:C")) continue;
        assert(starts.has(f), `${f} is the source of a row`);
      }
    }
  }
  assertEquals([SOC2_PROPOSALS.length, ISO_PROPOSALS.length, HIPAA_PROPOSALS.length], [61, 93, 65]);
});

proves(["0002-crosswalks FR-002"], "the manifest records the published mappings as unread, the digest of each source file on disk, the licence and the notice", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { source: { edition: string }; sources: { url: string; sha256: string }[]; licence: string; redistributable: boolean; notice: string };
  for (const ref of REFERENCES) assert(ref.status === "unread" && m.source.edition.includes(`${ref.title} (unread)`), ref.title);
  assert(m.redistributable && m.licence === LICENCE);
  const d = await sourceDigests();
  assertEquals(m.sources, SOURCE_FILES.map((url) => ({ url, sha256: d[url] ?? "" })));
  assert(/No published mapping was read/.test(m.notice) && /MUST NOT count a row/.test(m.notice) && /not mapped/.test(m.notice));
});

proves(["0002-crosswalks FR-003"], "every row is intersects-with at strength 1 and undecided with a reason, in a fixed order, and a pair named twice is refused", async () => {
  for (const c of Object.values(CROSSWALKS)) {
    const cw = await crosswalkAt(c.id);
    const keys = cw.mappings.map((m) => `${m.from}\u0000${m.to}`);
    assertEquals(keys, [...keys].sort());
    assertEquals(new Set(keys).size, keys.length);
    for (const m of cw.mappings) {
      assertEquals(m.relationship, "intersects-with");
      assertEquals(m.strength, 1);
      assert(m.note.startsWith(`${PENDING}: `) && m.note.length > PENDING.length + 30, m.from);
    }
  }
  const twice = mappingsOf([{ from: "A", basis: "b", to: ["X-1", "X-1"] }], SIDES.soc2, SIDES.sp80053, PENDING);
  assertEquals(twice.repeated.length, 1);
});

proves(["0002-crosswalks FR-004"], "the same proposals give the same files, byte for byte, and the generator reports a file that was edited", async () => {
  const a = await makePackage(zeros);
  const b = await makePackage(zeros);
  assertEquals([...a], [...b]);
  const tool = path.resolve(ROOT, "tools", "generate.ts");
  const ok = await proc.run(["bun", tool, "--check"], {});
  assert(ok.success, ok.stderr);
  const file = path.join(PACKAGE_DIR, "crosswalks", "soc2-tsc-to-nist-800-53.json");
  const was = await fs.readTextFile(file);
  try {
    await fs.writeTextFile(file, was.replace("CC6.1", "CC6.9"));
    const bad = await proc.run(["bun", tool, "--check"], {});
    assert(!bad.success && bad.stderr.includes("differs: data/crosswalks/soc2-tsc-to-nist-800-53.json"), bad.stderr);
  } finally {
    await fs.writeTextFile(file, was);
  }
});

proves(["0002-crosswalks FR-005"], "the crosswalk of ISO/IEC 27001 to SOC 2 is derived through the shared controls of SP 800-53, the best matches only, and says so", async () => {
  const iso = await crosswalkAt(CROSSWALKS.iso.id);
  const soc2 = await crosswalkAt(CROSSWALKS.soc2.id);
  const derived = await crosswalkAt(CROSSWALKS.isoSoc2.id);
  assertEquals(derived.mappings, composeThrough(iso.mappings as never, soc2.mappings as never, PENDING));
  for (const m of derived.mappings) assert(/derived through the controls of NIST SP 800-53/.test(m.note) && /weaker than a proposal/.test(m.note), m.from);
  const one = composeThrough(
    [{ from: "a:1:A", to: "t:1:X", relationship: "intersects-with", strength: 1, note: "" }, { from: "a:1:A", to: "t:1:Y", relationship: "intersects-with", strength: 1, note: "" }],
    [{ from: "c:1:C1", to: "t:1:X", relationship: "intersects-with", strength: 1, note: "" }, { from: "c:1:C2", to: "t:1:X", relationship: "intersects-with", strength: 1, note: "" }, { from: "c:1:C2", to: "t:1:Y", relationship: "intersects-with", strength: 1, note: "" }],
    PENDING,
  );
  assertEquals(one.map((m) => m.to), ["c:1:C2"]);
  assertEquals(composeThrough([], [], PENDING), []);
});

const row = (from: string, to: string, relationship: string, note = "decided"): Row => ({ from, to, relationship, strength: 5, note });

proves(["0002-crosswalks FR-006"], "the standings are the six of an assessment, and the coverage counts what is decided, never a share, and lets the worst standing win", () => {
  assertEquals([...STANDINGS].sort(), [...ASSESSMENT_STANDINGS].sort());
  const standings = new Map<string, Standing>([["s:1:a", "met"], ["s:1:b", "not-met"], ["s:1:c", "met"], ["s:1:d", "stale"]]);
  const c = coverageOf({
    targets: ["t:1:T1", "t:1:T2", "t:1:T3", "t:1:T4", "t:1:T5", "t:1:T6"],
    mappings: [
      row("s:1:a", "t:1:T1", "equal"),
      row("s:1:a", "t:1:T2", "intersects-with"),
      row("s:1:a", "t:1:T3", "equal"),
      row("s:1:b", "t:1:T3", "intersects-with"),
      row("s:1:c", "t:1:T4", "equal", `${PENDING}: a reason`),
      row("s:1:d", "t:1:T5", "equal"),
    ],
    standings,
    pending: PENDING,
  });
  const by = (id: string): { standing: Standing; undecided: number; counted: number } => {
    const x = c.controls.find((k) => k.control === id);
    return { standing: x?.standing ?? "no-evidence", undecided: x?.undecided ?? -1, counted: x?.counted.length ?? -1 };
  };
  assertEquals(by("t:1:T1"), { standing: "met", undecided: 0, counted: 1 });
  assertEquals(by("t:1:T2").standing, "supported");
  assertEquals(by("t:1:T3").standing, "not-met");
  assertEquals(by("t:1:T4"), { standing: "no-evidence", undecided: 1, counted: 0 });
  assertEquals(by("t:1:T5").standing, "stale");
  assertEquals(by("t:1:T6").standing, "no-evidence");
  assertEquals(c.tally, { met: 1, "not-met": 1, "not-applicable": 0, supported: 1, stale: 1, "no-evidence": 2 });
  assert(Object.values(c.tally).every(Number.isInteger) && !JSON.stringify(c).includes("%"), "a count, never a share");
  assertEquals(coverageOf({ targets: ["t:1:T1"], mappings: [row("s:1:x", "t:1:T1", "equal")], standings: new Map(), pending: PENDING }).controls[0]?.standing, "no-evidence");
});

proves(["0002-crosswalks FR-007"], "an identifier is written as an OSCAL token, and the catalog and the mapping collection are the same bytes every time", async () => {
  assertEquals(tokenOf("164.308.a.1"), "_164.308.a.1");
  assertEquals(tokenOf("A.5.1"), "A.5.1");
  assertEquals(tokenOf("CC6.1-1"), "CC6.1-1");
  assertEquals(tokenOf("ALL@traditional"), "ALL_traditional");
  const o = { madeAt: MADE_AT, oscalVersion: OSCAL_VERSION };
  const hipaa = (await loadFrameworks())["hipaa"] as Framework;
  const a = JSON.stringify(await oscalCatalogOf(hipaa, o));
  assertEquals(a, JSON.stringify(await oscalCatalogOf(hipaa, o)));
  assert(a.includes('"id":"_164.308.a.1"') && a.includes('"class":"family"'));
  const cw = await crosswalkAt(CROSSWALKS.soc2.id);
  const m = JSON.stringify(await oscalMappingOf(cw, "t", o));
  assertEquals(m, JSON.stringify(await oscalMappingOf(cw, "t", o)));
  assert(m.includes('"id-ref":"CC6.1"'));
  assertEquals(OSCAL_VERSION, "1.2.3");
});

proves(["0002-crosswalks FR-007"], "the OSCAL catalogs of the four frameworks and the four mapping collections are valid against NIST's published schema, where the schema (OSCAL_SCHEMA, a file) and a Node with ajv (OSCAL_AJV, the folder that holds it) are at hand", async (t) => {
  const schema = process.env["OSCAL_SCHEMA"];
  const ajv = process.env["OSCAL_AJV"];
  if (schema === undefined || schema === "" || ajv === undefined || ajv === "") return t.skip("OSCAL_SCHEMA and OSCAL_AJV are not set: fetch oscal_complete_schema.json from NIST's OSCAL release and install ajv and ajv-formats in a folder");
  const o = { madeAt: MADE_AT, oscalVersion: OSCAL_VERSION };
  const fws = await loadFrameworks();
  const docs: string[] = [];
  for (const fw of Object.values(fws)) docs.push(JSON.stringify(await oscalCatalogOf(fw, o)));
  for (const c of Object.values(CROSSWALKS)) docs.push(JSON.stringify(await oscalMappingOf(await crosswalkAt(c.id), c.id, o)));
  await fs.withTempDir(async (dir) => {
    const script = path.join(dir, "v.mjs");
    await fs.writeTextFile(script, `import { createRequire } from "node:module";import { readFileSync } from "node:fs";const require = createRequire(${JSON.stringify(`${ajv}/`)});const Ajv = require("ajv");const add = require("ajv-formats");const a = new Ajv({ strict: false, allErrors: true });add(a);const v = a.compile(JSON.parse(readFileSync(${JSON.stringify(schema)}, "utf8")));const bad = [];for (const f of process.argv.slice(2)) { if (!v(JSON.parse(readFileSync(f, "utf8")))) bad.push(f + ": " + JSON.stringify(v.errors.slice(0, 5))); }console.log(bad.join("\\n"));process.exit(bad.length ? 1 : 0);`);
    const files: string[] = [];
    for (const [i, d] of docs.entries()) {
      const f = path.join(dir, `d${i}.json`);
      await fs.writeTextFile(f, d);
      files.push(f);
    }
    const r = await proc.run(["node", script, ...files], {});
    assert(r.success, r.stdout + r.stderr);
  });
});
