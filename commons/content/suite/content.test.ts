/**
 * Proves: 0001-content-collector FR-001, FR-002, FR-003, FR-004
 * A synthetic public chapter supplies all content in this suite.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { assembleContent, collectChapter, contentBundle, contentGateDecision, verifyContentBundle } from "../src/mod.ts";

const publicBlock = { line: 4, text: "Measured in a controlled example. {{data}}", disclosure: "public" as const };
const chapter = { id: "pilot/chapter", file: "fixture.adoc", audience: "reader", sourceNotes: "data | test measurement | https://example.org/measurement" };

proves(["0001-content-collector FR-001", "0001-content-collector FR-002"], "the collector mints a located claim and withholds restricted content", () => {
  const result = collectChapter({ ...chapter, blocks: [
    publicBlock,
    { ...publicBlock, line: 8, disclosure: "restricted", text: "Restricted text {{data}}" },
    { ...publicBlock, line: 12, text: "Unresolved {{missing}}" },
    { ...publicBlock, line: 14, marker: "// CLAIM: invalid" },
    { ...publicBlock, line: 16, marker: "// CLAIM: volatility=volatile asof=2026-01-01 reverify=2026-04-01" },
    { ...publicBlock, line: 18, marker: "// CLAIM: id=explicit" },
    { ...publicBlock, line: 20, marker: "// CLAIM: id=explicit" },
  ] }, "2026-11-22");
  assertEquals(result.claims.map((c) => [c.line, c.audit]), [[4, "not-audited"], [16, "not-audited"], [18, "not-audited"]]);
  assertEquals(result.claims[0]?.id, "claim:pilot/chapter/m1");
  assertEquals(result.findings.map((f) => f.code), ["evidence", "evidence", "claim-marker", "review-due", "claim-id"]);
});

proves(["0001-content-collector FR-003"], "observed evidence drives each matrix cell and the deterministic bundle verifies", async () => {
  const { claims } = collectChapter({ ...chapter, blocks: [publicBlock] }, "2026-11-22");
  const claim = claims[0];
  assert(claim !== undefined);
  const output = assembleContent("pilot", claims, [
    { name: "web", observations: [{ claim: claim.id, evidence: claim.evidence.map((e) => e.url), audit: claim.audit }] },
    { name: "markdown", observations: [{ claim: claim.id, evidence: [], audit: claim.audit }] },
  ]);
  assert(output.kind === "ok");
  assertEquals(output.value.findings.map((f) => f.rule), ["kanon/dropped"]);
  const evidence = output.value.matrix.rows.find((row) => row.annotation === "evidence");
  assertEquals(evidence?.cells.map((cell) => [cell.instance, cell.cell.outcome]), [["web", "expressed"], ["markdown", "dropped"]]);
  const bundle = await contentBundle(output.value.model);
  assertEquals(await contentBundle(output.value.model), bundle);
  const files = new Map([...bundle.files].map(([path, text]) => [path, new TextEncoder().encode(text)]));
  const verified = await verifyContentBundle({ files, manifest: bundle.manifest });
  assert(verified.kind === "ok");
  assertEquals(verified.value.findings.map((f) => f.rule), ["kanon/dropped"]);
  files.set("elements.json", new Uint8Array());
  assertEquals((await verifyContentBundle({ files, manifest: bundle.manifest })).kind, "err");
});

proves(["0001-content-collector FR-004"], "only a dated owner decision escalates findings", () => {
  assertEquals(contentGateDecision("2027-01-31"), { mode: "warn", reviewDue: false });
  assertEquals(contentGateDecision("2027-02-01"), { mode: "warn", reviewDue: true });
  assertEquals(contentGateDecision("2027-02-10", { until: "2027-01-31", decision: { by: "shah", on: "2027-02-10", mode: "fail-build" } }), { mode: "fail-build", reviewDue: false });
});
