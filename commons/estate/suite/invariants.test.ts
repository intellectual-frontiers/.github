/**
 * Tests of the invariants of the Operational Truth Ontology that an estate checks (commons estate 0003-estate-logical FR-007): an unowned capability, an observation with no source and a policy result with no control are
 * violations, and every invariant of the ontology says whether it is checked. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { invariants } from "@intellectual-frontiers/ontology/oto";
import { defineAsset, type Asset } from "../src/governance/mod.ts";
import { checkInvariants, INVARIANT_COVERAGE } from "../src/logical/mod.ts";

function adopted(): Asset {
  const a = defineAsset({ id: "athens", kind: "server", state: "adopted", owners: { observe: "archon", verify: "archon" } });
  if (a.kind === "err") throw new Error(a.error.join("; "));
  return a.value;
}

proves(["0003-estate-logical FR-007"], "an observation with no source and a policy result with no control are violations, an asset with owners and sources is clean, and an unowned capability is one", () => {
  const asset = adopted();
  const clean = checkInvariants({ assets: [asset], observations: [{ asset: "athens", observation: { at: "2026-12-01T00:00:00Z", source: "probe", state: {} } }], results: [{ asset: "athens", id: "disk-encryption", status: "pass", controls: ["CRY-05"] }] });
  assertEquals(clean, []);
  const bad = checkInvariants({ assets: [asset], observations: [{ asset: "athens", observation: { at: "2026-12-01T00:00:00Z", source: " ", state: {} } }], results: [{ asset: "athens", id: "disk-encryption", status: "pass", controls: [] }] });
  assertEquals(bad.map((v) => v.invariant), ["NoEvidenceWithoutAttribution", "NoComplianceWithoutTraceability"]);
  assertEquals(bad.map((v) => v.subject), ["athens", "athens disk-encryption"]);
  const hand: Asset = { ...asset, capabilities: asset.capabilities.map((c) => (c.offered && c.capability === "observe" ? { ...c, owner: " " as typeof c.owner } : c)) };
  const unowned = checkInvariants({ assets: [hand], observations: [], results: [] });
  assert(unowned.length === 1 && unowned[0]?.invariant === "NoUnownedResponsibilities" && unowned[0].subject === "athens observe");
});

proves(["0003-estate-logical FR-007"], "every invariant of the ontology says whether an estate checks it, and none is missing or invented", () => {
  assertEquals(Object.keys(INVARIANT_COVERAGE).sort(), Object.keys(invariants).sort());
  assertEquals(Object.entries(INVARIANT_COVERAGE).filter(([, v]) => v === "checked").map(([k]) => k).sort(), ["NoAuthorityWithoutScope", "NoComplianceWithoutTraceability", "NoEvidenceWithoutAttribution", "NoUnownedResponsibilities"]);
});
