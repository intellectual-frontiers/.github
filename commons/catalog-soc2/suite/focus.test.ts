/**
 * Tests of the matters to show of SOC 2 (commons catalog-soc2 0003-soc2-focus FR-001 to FR-005): the real package loaded through the catalog loader of grc with the second framework, every criterion with at least two matters and none for a criterion the first framework lacks,
 * the manifest's second source digest and its notice, the generator's check, and that every statement is short and every identifier a token of OSCAL.
 *
 * @module
 */
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { readCatalogPackage } from "@intellectual-frontiers/grc/physical";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { CRITERIA, FOCUS, FOCUS_FRAMEWORK, SOURCE_FILES } from "../src/governance/mod.ts";
import { digestOf, PACKAGE_DIR } from "../src/physical/mod.ts";

type Fw = { id: string; version: string; controls: { id: string; title: string; statement: string; family: string }[] };

proves(["0003-soc2-focus FR-001"], "the real package loads with the second framework: 122 matters under the 61 criteria, at least two under each, none under a criterion the first framework lacks", async () => {
  const r = await readCatalogPackage(PACKAGE_DIR, standardKinds());
  assert(r.kind === "ok", r.kind === "err" ? JSON.stringify(r.error) : "");
  const fws = r.value.documents.filter((d) => d.kind === "grc.framework") as unknown as Fw[];
  const focus = fws.find((f) => f.id === FOCUS_FRAMEWORK.id);
  const tsc = fws.find((f) => f.id === "soc2-tsc");
  assert(focus !== undefined && tsc !== undefined);
  assertEquals(focus.controls.length, 122);
  const criteria = new Set(tsc.controls.map((c) => c.id));
  for (const c of focus.controls) assert(criteria.has(c.family) && c.id.startsWith(`${c.family}-`), c.id);
  for (const id of criteria) assert(focus.controls.filter((c) => c.family === id).length >= 2, `${id} has two matters`);
  for (const id of ["CC6.1-1", "CC6.1-2", "P6.6-2", "A1.3-2"]) assert(focus.controls.some((c) => c.id === id), id);
  assertEquals(CRITERIA.length, 61);
});

proves(["0003-soc2-focus FR-002", "0003-soc2-focus FR-003"], "the manifest records the digest of both source files and the notice", async () => {
  const m = JSON.parse(await fs.readTextFile(path.join(PACKAGE_DIR, "manifest.json"))) as { sources: { url: string; sha256: string }[]; notice: string; holds: { id: string }[] };
  assertEquals(m.sources.map((s) => s.url), [...SOURCE_FILES]);
  for (const s of m.sources) assertEquals(s.sha256, await digestOf(await fs.readFile(path.join(PACKAGE_DIR, "..", s.url))));
  assertEquals(m.holds.map((h) => h.id), ["soc2-tsc", "soc2-focus"]);
  assert(/not carried and were not read/.test(m.notice) && /our own list/.test(m.notice) && /decides which of its points of focus a matter answers/.test(m.notice));
});

proves(["0003-soc2-focus FR-004", "0003-soc2-focus FR-005"], "every matter is a short sentence of ours, no identifier repeats and every identifier is a token of OSCAL", () => {
  const seen = new Set<string>();
  for (const f of FOCUS) {
    assert(!seen.has(f.id), `${f.id} repeats`);
    seen.add(f.id);
    assert(f.statement.length < 200 && f.statement.endsWith("."), `${f.id} stays a short sentence`);
    assert(/^[A-Za-z_][A-Za-z0-9._-]*$/.test(f.id), f.id);
    assert(!/points? of focus/i.test(f.statement), f.id);
  }
});
