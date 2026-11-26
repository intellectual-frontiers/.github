/**
 * The legal name of a company and the site of a network (commons estate 0010-estate-boundaries FR-034, FR-035): each belongs to one kind of boundary, is refused where it is empty or too long, and is part of the plan, so that a change of it is a change a person approves.
 *
 * Proves: 0010-estate-boundaries FR-034 FR-035
 *
 * @module
 */
// Spec: 0010-estate-boundaries FR-034, FR-035
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { BOTTOM, identityProblems, parseBoundaryId, parsePrincipalId, type AnyBoundary } from "../src/governance/boundaries.ts";
import { diff, planOf } from "../src/logical/boundaries.ts";

const person = (() => {
  const p = parsePrincipalId("synthetic-person-01");
  if (p.kind === "err") throw new Error(p.error);
  return p.value;
})();

function boundary(kind: "organizational" | "network-zone", extra: Record<string, unknown>): AnyBoundary {
  const id = parseBoundaryId("synthetic-boundary-01");
  if (id.kind === "err") throw new Error(id.error);
  return {
    id: id.value,
    kind,
    name: "Synthetic boundary",
    owner: person,
    roles: kind === "organizational" ? { owner: [person] } : { "zone-owner": [person] },
    categorization: BOTTOM,
    include: { t: "or", of: [] },
    exclude: { t: "or", of: [] },
    overrides: [],
    decisions: [],
    parents: [],
    constraints: [],
    interconnections: [],
    inheritances: [],
    accepted: [],
    version: 1,
    ...extra,
  } as unknown as AnyBoundary;
}

proves(["0010-estate-boundaries FR-034"], "a legal name belongs to an organizational boundary, is refused where empty or too long, and a change of it changes the plan and shows in the difference", async () => {
  assertEquals(identityProblems("organizational", "Synthetic Company LLC", undefined), []);
  assert(identityProblems("network-zone", "Synthetic Company LLC", undefined).some((p) => p.includes("organizational")));
  assert(identityProblems("organizational", "  ", undefined).length === 1);
  assert(identityProblems("organizational", "x".repeat(201), undefined).length === 1);
  const a = boundary("organizational", { legalName: "Synthetic Company LLC" });
  const b = boundary("organizational", { legalName: "Synthetic Company Inc." });
  assert((await planOf(a)).hash !== (await planOf(b)).hash);
  assertEquals(diff(a, b).map((c) => c.field), ["legalName"]);
});

proves(["0010-estate-boundaries FR-035"], "a site belongs to a network-zone boundary, is a name and an optional address, is refused where empty or too long, and is part of the plan", async () => {
  assertEquals(identityProblems("network-zone", undefined, { name: "Synthetic Site" }), []);
  assertEquals(identityProblems("network-zone", undefined, { name: "Synthetic Site", address: "1 Synthetic Road, Synthetic Town" }), []);
  assert(identityProblems("organizational", undefined, { name: "Synthetic Site" }).some((p) => p.includes("network-zone")));
  assert(identityProblems("network-zone", undefined, { name: "" }).length === 1);
  assert(identityProblems("network-zone", undefined, { name: "Synthetic Site", address: "" }).length === 1);
  assert(identityProblems("network-zone", undefined, { name: "Synthetic Site", address: "y".repeat(401) }).length === 1);
  const a = boundary("network-zone", { site: { name: "Synthetic Site" } });
  const b = boundary("network-zone", { site: { name: "Synthetic Site", address: "1 Synthetic Road" } });
  assert((await planOf(a)).hash !== (await planOf(b)).hash);
  assertEquals(diff(a, b).map((c) => c.field), ["site"]);
});
