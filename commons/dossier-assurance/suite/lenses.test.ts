/**
 * Tests of the lenses of an assurance dossier (commons dossier-assurance 0002-assurance-lenses FR-001 to FR-006): what each says of made-up runs, findings and readings, built through the dossier library.
 *
 * @module
 */
import type { Declaration, Json, Source } from "@intellectual-frontiers/dossier/governance";
import { build, registryOf, sourceOf } from "@intellectual-frontiers/dossier/logical";
import { ASSURANCE_LENSES } from "@intellectual-frontiers/dossier-assurance/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const made = async (id: string, kind: string, observedAt: string, body: Json): Promise<Source> => {
  const r = await sourceOf({ id, kind, observedAt, body });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const registry = registryOf(ASSURANCE_LENSES);

const decl = (lens: string, params: Json): Declaration => ({ id: "synthetic-dossier-02", title: "Assurance", audience: "internal", asOf: "2026-11-26T12:00:00Z", selection: {}, lenses: [{ lens, params }], renditions: ["adoc"], triggers: [] });

const run = (d: Declaration, ss: readonly Source[]) => build(d, registry, ss);

const sources = async () => [
  await made("acceptance/ac-001-run-01", "acceptance-run", "2026-11-25T09:00:00Z", { case: "AC-001", title: "A made-up case", os: "synthetic-os-01", steps: [{ id: "s1", title: "Enroll", result: "pass", by: "tool" }, { id: "s2", title: "Compare the code", result: "not-run", by: "person" }] }),
  await made("findings/set-01", "finding-set", "2026-11-20T09:00:00Z", { findings: [{ id: "F-1", title: "Old", severity: "high", status: "open", control: "AC-2", milestone: "M1", due: "2026-12-01" }, { id: "F-2", title: "Two", severity: "low", status: "open" }] }),
  await made("findings/set-02", "finding-set", "2026-11-24T09:00:00Z", { findings: [{ id: "F-1", title: "Old", severity: "high", status: "fixed" }] }),
  await made("readings/ac-2", "reading", "2026-11-25T09:00:00Z", { requirement: "AC-2", standing: "met" }),
  await made("readings/ac-3", "reading", "2026-09-01T09:00:00Z", { requirement: "AC-3", standing: "met" }),
  await made("readings/ac-4", "reading", "2026-11-25T09:00:00Z", { requirement: "AC-4", standing: "partial" }),
];

proves(["0002-assurance-lenses FR-001", "0002-assurance-lenses FR-006"], "a body of another shape and parameters that are not accepted are refused", async () => {
  const bad = await made("acceptance/bad", "acceptance-run", "2026-11-25T09:00:00Z", { case: "AC-001" });
  const r = await run(decl("acceptance", { title: "Acceptance" }), [bad]);
  assert(r.kind === "err" && r.error.code === "E-DOSSIER-LENS-REFUSED" && r.error.message.includes("acceptance/bad"));
  const p = await run(decl("negative-space", { title: "Gaps" }), []);
  assert(p.kind === "err" && p.error.code === "E-DOSSIER-LENS-PARAMS");
  assertEquals(ASSURANCE_LENSES.length, 4);
});

proves(["0002-assurance-lenses FR-002"], "the acceptance lens counts the steps and says that no person approved and that a person's step is not done", async () => {
  const r = await run(decl("acceptance", { title: "Acceptance" }), await sources());
  assert(r.kind === "ok");
  const adoc = r.value.adoc;
  assert(adoc.includes("1 passed, 0 failed, 1 not run") && adoc.includes("on synthetic-os-01"));
  assert(adoc.includes("No person has approved AC-001") && adoc.includes("only a person can do has not been done"));
  const none = await run(decl("acceptance", { title: "Acceptance" }), []);
  assert(none.kind === "ok" && none.value.adoc.includes("There is no evidence of an acceptance run"));
});

proves(["0002-assurance-lenses FR-003"], "the findings lens takes the latest state, lists what is open by severity and names the open findings with no plan", async () => {
  const r = await run(decl("findings", { title: "Findings" }), await sources());
  assert(r.kind === "ok");
  const adoc = r.value.adoc;
  assert(adoc.includes("2 findings: 1 open, 0 accepted, 1 fixed."), adoc);
  assert(adoc.includes("F-2: Two") && !adoc.includes("F-1: Old"), "F-1 is fixed in the later set");
  assert(adoc.includes("1 open findings have no milestone or no date: F-2."));
});

proves(["0002-assurance-lenses FR-004"], "the posture lens gives a row for each requirement and the counts, and no percentage", async () => {
  const r = await run(decl("posture", { title: "Posture" }), await sources());
  assert(r.kind === "ok");
  assert(r.value.adoc.includes("Of 3 requirements: 2 met, 1 partly met, 0 not met, 0 with no evidence."));
  assert(!/\d\s*%/.test(r.value.adoc), "no percentage");
});

proves(["0002-assurance-lenses FR-005"], "the negative space lists what has no reading, is stale or is not fully met, and hides no gap", async () => {
  const r = await run(decl("negative-space", { title: "Gaps", requirements: ["AC-2", "AC-3", "AC-4", "AC-5", "AC-5"], maxAgeDays: 30 }), await sources());
  assert(r.kind === "ok");
  const adoc = r.value.adoc;
  assert(adoc.includes("3 of 4 requirements show a gap; 1 show none."), adoc);
  assert(adoc.includes("no reading at all") && adoc.includes("only partly met") && adoc.includes("stale: 86 days old"));
  const clean = await run(decl("negative-space", { title: "Gaps", requirements: [], maxAgeDays: 30 }), await sources());
  assert(clean.kind === "ok" && clean.value.adoc.includes("No requirement of the list has a gap."));
});
