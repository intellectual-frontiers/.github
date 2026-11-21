/**
 * Tests of tenancy (commons tenancy 0002-tenancy FR-001 to FR-007): the rules of the model, what each role allows, the deny-by-default decision with its reasons and the effect of an engagement ending, the portfolio that lists and counts only readable tenants, the matrix of responsibility and
 * the standing it gives a client.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ACTIONS, type Model, ROLE_ACTIONS, ROLES } from "../src/governance/mod.ts";
import { decide, matrix, portfolio, problemsOf, standingFor, visibleTenants } from "../src/logical/mod.ts";

const NOW = "2026-11-21T12:00:00Z";
const MODEL: Model = {
  parties: [{ id: "msp", kind: "operator", name: "Provider" }, { id: "acme", kind: "client", name: "Acme" }, { id: "beta", kind: "client", name: "Beta" }],
  principals: [{ id: "ann", party: "msp" }, { id: "bob", party: "acme" }, { id: "cy", party: "beta" }],
  engagements: [{ operator: "msp", client: "acme", from: "2026-01-01T00:00:00Z" }, { operator: "msp", client: "beta", from: "2026-01-01T00:00:00Z", until: "2026-12-01T00:00:00Z" }],
  grants: [
    { principal: "ann", tenant: "acme", role: "operator", from: "2026-01-01T00:00:00Z" },
    { principal: "ann", tenant: "beta", role: "operator", from: "2026-01-01T00:00:00Z" },
    { principal: "bob", tenant: "acme", role: "owner", from: "2026-01-01T00:00:00Z" },
    { principal: "cy", tenant: "beta", role: "viewer", from: "2026-01-01T00:00:00Z", until: NOW },
  ],
};

proves(["0002-tenancy FR-001"], "a model is refused where ids repeat, a party is unknown, an engagement is not operator to client, a grant is held by an outsider or something is not a client, or a validity ends before it begins", () => {
  assertEquals(problemsOf(MODEL), []);
  const bad = (o: Partial<Model>): string[] => [...problemsOf({ ...MODEL, ...o })];
  assert(bad({ parties: [...MODEL.parties, { id: "acme", kind: "client", name: "Dup" }] }).some((p) => p.includes("party id")));
  assert(bad({ principals: [...MODEL.principals, { id: "ann", party: "msp" }] }).some((p) => p.includes("principal id")));
  assert(bad({ principals: [...MODEL.principals, { id: "x", party: "ghost" }] }).some((p) => p.includes("unknown party")));
  assert(bad({ engagements: [{ operator: "acme", client: "beta", from: NOW }] }).some((p) => p.includes("not an operator")));
  assert(bad({ engagements: [{ operator: "msp", client: "msp", from: NOW }] }).some((p) => p.includes("not a client")));
  assert(bad({ engagements: [{ operator: "msp", client: "acme", from: NOW, until: "2026-01-01T00:00:00Z" }] }).some((p) => p.includes("before it begins")));
  assert(bad({ grants: [...MODEL.grants, { principal: "cy", tenant: "acme", role: "viewer", from: NOW }] }).some((p) => p.includes("neither the client's own nor an operator engaged")));
  assert(bad({ grants: [...MODEL.grants, { principal: "ghost", tenant: "acme", role: "viewer", from: NOW }] }).some((p) => p.includes("no such principal")));
  assert(bad({ grants: [...MODEL.grants, { principal: "ann", tenant: "msp", role: "viewer", from: NOW }] }).some((p) => p.includes("not a client")));
  assert(bad({ grants: [{ principal: "bob", tenant: "acme", role: "owner", from: NOW, until: NOW }] }).some((p) => p.includes("before it begins")));
});

proves(["0002-tenancy FR-002"], "each role allows what the model says: the owner everything, an operator's staff neither determine, approve nor administer, the auditor reads and determines, the viewer reads", () => {
  assertEquals(ROLE_ACTIONS.owner, [...ACTIONS]);
  assertEquals(ROLES.length, 4);
  for (const a of ["determine", "approve-change", "administer"] as const) assert(!ROLE_ACTIONS.operator.includes(a), a);
  assertEquals(ROLE_ACTIONS.auditor, ["read", "determine", "export"]);
  assertEquals(ROLE_ACTIONS.viewer, ["read"]);
  assert(decide(MODEL, "ann", "acme", "record-evidence", NOW).allow);
  assert(!decide(MODEL, "ann", "acme", "determine", NOW).allow);
});

proves(["0002-tenancy FR-003", "0002-tenancy FR-007"], "a decision denies by default and says why, and an engagement or a grant that is not live gives no access", () => {
  assertEquals(decide(MODEL, "nobody", "acme", "read", NOW), { allow: false, reason: "no such principal" });
  assertEquals(decide(MODEL, "bob", "beta", "read", NOW).reason, "no grant on this tenant");
  assertEquals(decide(MODEL, "cy", "beta", "read", NOW).reason, "the grant is not live", "a grant that ends on the instant is not live");
  assertEquals(decide(MODEL, "cy", "beta", "read", "2026-11-21T11:59:59Z"), { allow: true, reason: "allowed as viewer", role: "viewer" });
  assertEquals(decide(MODEL, "cy", "beta", "administer", "2026-11-21T11:59:59Z").reason, "no role held on this tenant allows administer");
  assert(decide(MODEL, "ann", "beta", "read", NOW).allow);
  assertEquals(decide(MODEL, "ann", "beta", "read", "2026-12-01T00:00:00Z").reason, "the principal's party has no live engagement with this tenant", "the engagement has ended");
  assert(decide(MODEL, "ann", "acme", "read", "2025-06-01T00:00:00Z").reason === "the grant is not live");
  const two: Model = { ...MODEL, grants: [...MODEL.grants, { principal: "ann", tenant: "acme", role: "auditor", from: "2026-01-01T00:00:00Z" }] };
  assert(decide(two, "ann", "acme", "determine", NOW).allow, "either grant allowing is enough");
  assertEquals(decide(MODEL, "ann", "acme", "read", NOW), decide(structuredClone(MODEL), "ann", "acme", "read", NOW));
});

proves(["0002-tenancy FR-004"], "a portfolio lists and totals only the tenants the principal may read, and a tenant whose engagement ended drops out of both", () => {
  const sums = [
    { tenant: "acme", asOf: NOW, rollups: { met: 3, partial: 1 }, findings: { open: 2 } },
    { tenant: "beta", asOf: NOW, rollups: { met: 5, "not-met": 2 }, findings: { open: 7 } },
  ];
  assertEquals(visibleTenants(MODEL, "ann", NOW), ["acme", "beta"]);
  const p = portfolio(MODEL, sums, "ann", NOW);
  assertEquals(p.tenants.map((t) => t.tenant), ["acme", "beta"]);
  assertEquals(p.total, { rollups: { met: 8, partial: 1, "not-met": 2 }, findings: { open: 9 } });
  const after = portfolio(MODEL, sums, "ann", "2026-12-02T00:00:00Z");
  assertEquals(after.tenants.map((t) => t.tenant), ["acme"]);
  assertEquals(after.total, { rollups: { met: 3, partial: 1 }, findings: { open: 2 } });
  const bob = portfolio(MODEL, sums, "bob", NOW);
  assertEquals(bob.tenants.map((t) => t.tenant), ["acme"]);
  assert(!JSON.stringify(bob).includes("beta") && !JSON.stringify(bob.total).includes("7"));
  assertEquals(portfolio(MODEL, sums, "nobody", NOW), { tenants: [], total: { rollups: {}, findings: {} } });
});

proves(["0002-tenancy FR-005"], "the matrix lists who answers for each requirement, the unassigned apart, and refuses what is stated wrongly", () => {
  const reqs = ["3.1.1", "3.1.2", "3.1.3", "3.1.4"];
  const m = matrix("f", reqs, [
    { framework: "f", requirement: "3.1.2", who: "operator" },
    { framework: "f", requirement: "3.1.1", who: "client" },
    { framework: "f", requirement: "3.1.3", who: "inherited", provider: "cloud" },
    { framework: "other", requirement: "9.9", who: "client" },
  ]);
  assertEquals(m.lines.map((l) => l.requirement), ["3.1.1", "3.1.2", "3.1.3"]);
  assertEquals(m.unassigned, ["3.1.4"]);
  assertEquals(m.problems, []);
  const bad = matrix("f", reqs, [
    { framework: "f", requirement: "3.1.1", who: "inherited" },
    { framework: "f", requirement: "3.1.2", who: "shared" },
    { framework: "f", requirement: "3.1.2", who: "client" },
    { framework: "f", requirement: "7.7", who: "client" },
    { framework: "f", requirement: "3.1.3", who: "someone" as never },
  ]);
  assert(bad.problems.some((p) => p.includes("names no provider")));
  assert(bad.problems.some((p) => p.includes("says nothing of what each side does")));
  assert(bad.problems.some((p) => p.includes("stated twice")));
  assert(bad.problems.some((p) => p.includes("7.7 is not a requirement")));
  assert(bad.problems.some((p) => p.includes("not one of")));
});

proves(["0002-tenancy FR-006"], "the standing a client may claim follows from whose the requirement is, and a shared one is the worse of both", () => {
  assertEquals(standingFor({ who: "client" }, { client: "met", operator: "not-met" }), "met");
  assertEquals(standingFor({ who: "operator" }, { client: "met", operator: "not-met" }), "not-met");
  assertEquals(standingFor({ who: "inherited" }, { client: "met" }), "no-evidence", "no word from the provider is no evidence");
  assertEquals(standingFor({ who: "inherited" }, { provider: "met" }), "met");
  assertEquals(standingFor({ who: "shared" }, { client: "met", operator: "met" }), "met");
  assertEquals(standingFor({ who: "shared" }, { client: "met" }), "partial", "a side with no evidence holds the requirement back");
  assertEquals(standingFor({ who: "shared" }, { client: "met", operator: "not-met" }), "not-met");
  assertEquals(standingFor({ who: "shared" }, {}), "no-evidence");
  assertEquals(standingFor({ who: "shared" }, { client: "not-applicable", operator: "not-applicable" }), "not-applicable");
});
