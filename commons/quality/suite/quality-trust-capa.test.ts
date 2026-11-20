/**
 * The CAPA on the Trust page (commons 0001-quality-evidence FR-068): the Public view names a CAPA by its identifier, its nonconformance, its state and its named test, and withholds the text
 * of its corrective action (counted among the redactions); the Assessor and Internal views show it. The view is built from a typed input, with no repository.
 *
 * @module
 */
import { trustViewOf, type TrustInput } from "../src/trust/view.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const INPUT: TrustInput = {
  harness: "demo",
  revision: "0123456789ab",
  generated: "2026-11-17",
  notCovered: [],
  figures: {
    evidenceFiles: 1,
    cases: 1,
    passed: 0,
    failed: 1,
    notRun: 0,
    otherCases: 0,
    ledgerRecords: 2,
    nonconformancesOpen: 1,
    nonconformancesClosed: 0,
    capasOpen: 1,
    capasClosed: 0,
  },
  proof: { count: "0 of 1", proved: 0, requirements: 1, reviewDebt: 0, reviewDebtByAgent: 0, reviewDebtByPerson: 0, byGrade: {} },
  requirements: [],
  failures: [],
  nonconformances: [],
  capas: [
    {
      id: "CAPA-0001",
      nonconformance: "NC-0001",
      state: "CapaOpen",
      openedOn: "2026-11-17",
      action: "Rotate the key held at the Acme Quality Customer site",
      test: "demo: the second requirement",
    },
  ],
  objectives: [],
  people: { plans: 0, samplesDrawn: 0, samplesAttested: 0, mutationRuns: 0, agentReviews: 0, agentReviewsSampled: 0 },
};

proves(
  ["0001-quality-evidence FR-068"],
  "the Public page names a CAPA by its identifier, state and named test and withholds the text of its corrective action, counting it; the Assessor and Internal pages show the action",
  () => {
    const pub = trustViewOf(INPUT, "Public", { terms: [] });
    assert(pub.kind === "ok");
    const capa = pub.value.capas[0];
    assertEquals(
      [capa?.id, capa?.nonconformance, capa?.state, capa?.test],
      ["CAPA-0001", "NC-0001", "CapaOpen", "demo: the second requirement"],
    );
    assertEquals(capa?.action, undefined, "no corrective action text on the public page");
    for (const audience of ["Assessor", "Internal"] as const) {
      const wide = trustViewOf(INPUT, audience, { terms: [] });
      assert(wide.kind === "ok");
      assertEquals(wide.value.capas[0]?.action, "Rotate the key held at the Acme Quality Customer site");
      assert(pub.value.redactions > wide.value.redactions, "the withheld action is counted among the public page's redactions");
    }
  },
);
