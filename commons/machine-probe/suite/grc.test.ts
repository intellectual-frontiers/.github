/**
 * Tests of the policies of the probe as evidence for controls (commons machine-probe 0006-machine-probe-grc): the results for the controls a framework has, a gap for every policy of a machine never observed, one check for each policy that is cited, and the same answer every time.
 * Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { POLICIES } from "../src/logical/policies.ts";
import { resultsFor, urnOf, type AssetPolicies } from "../src/logical/grc.ts";

const NOW = "2026-11-21T12:00:00Z";
const FW = { id: "fw", version: "1", controls: ["SC-28", "SC-7", "SI-2", "IA-2", "IA-5"] };
const observed: AssetPolicies = {
  asset: "synthetic-server-02",
  observedAt: "2026-11-21T11:00:00Z",
  rows: [
    { id: "disk-encryption", status: "fail", controls: ["SC-28"], detail: "disk is not encrypted" },
    { id: "firewall", status: "pass", controls: ["SC-7", "NOT-IN-FRAMEWORK"], detail: "on" },
    { id: "observed", status: "pass", controls: ["CM-8"], detail: "outside the framework" },
  ],
};

proves(["0006-machine-probe-grc FR-001"], "each finding becomes a result for the controls the framework has, with the status the probe gave and the time it was observed, and a finding that cites no control of the framework gives none", () => {
  const r = resultsFor([observed], FW, NOW);
  assert(r.kind === "ok");
  assertEquals(r.value.results.map((x) => [x.check, x.subject, x.status, x.controls, x.observedAt]), [
    ["probe:disk-encryption", "synthetic-server-02", "fail", [urnOf(FW, "SC-28")], "2026-11-21T11:00:00Z"],
    ["probe:firewall", "synthetic-server-02", "pass", [urnOf(FW, "SC-7")], "2026-11-21T11:00:00Z"],
  ]);
  assertEquals(urnOf(FW, "SC-28"), "urn:grc:fw:1:SC-28");
});

proves(["0006-machine-probe-grc FR-002"], "a machine never observed is a gap for every policy that cites a control of the framework, and never a pass", () => {
  const r = resultsFor([{ asset: "synthetic-server-03", observedAt: null, rows: [] }], FW, NOW);
  assert(r.kind === "ok");
  const cited = POLICIES.filter((p) => p.controls.some((c) => FW.controls.includes(c)));
  assertEquals(r.value.results.length, cited.length);
  assert(r.value.results.every((x) => x.status === "gap" && x.reason === "not observed yet" && x.observedAt === NOW));
  assert(r.value.results.every((x) => x.status !== ("pass" as string)));
});

proves(["0006-machine-probe-grc FR-003"], "each policy cited is one check that answers for the controls it cites and is fresh for a day, and the same findings give the same evidence", () => {
  const a = resultsFor([observed, { asset: "synthetic-server-03", observedAt: null, rows: [] }], FW, NOW);
  const b = resultsFor([observed, { asset: "synthetic-server-03", observedAt: null, rows: [] }], FW, NOW);
  assert(a.kind === "ok" && b.kind === "ok");
  assertEquals(a.value, b.value);
  const ids = a.value.checks.map((c) => c.id);
  assertEquals(new Set(ids).size, ids.length, "a policy is one check, however many machines");
  const disk = a.value.checks.find((c) => c.id === "probe:disk-encryption");
  assertEquals([disk?.freshness, disk?.controls], ["P1D", [urnOf(FW, "SC-28")]]);
  assert(a.value.checks.every((c) => c.controls.every((u) => u.startsWith("urn:grc:fw:1:"))));
});
