// Spec: 0002-tenancy FR-001, FR-002, FR-003, FR-004, FR-007
/**
 * Who may do what to which tenant (0002-tenancy FR-001 to FR-004, FR-007): deny by default; a grant counts only while it is live, only for a principal of a party that may hold it (the client itself, or an operator with a live engagement with the client), and only for the actions of its role.
 * A portfolio shows a principal the tenants they may read and totals over those alone, so that what a principal may not see is neither listed nor counted. The decision names its reason, and everything is a pure function of the model and the instant.
 *
 * @example
 * ```ts
 * import { decide } from "./authorize.ts";
 * decide({ parties: [], principals: [], engagements: [], grants: [] }, "x", "t", "read", "2026-11-21T00:00:00Z").allow; // false
 * ```
 *
 * @module
 */
import { type Action, type Model, ROLE_ACTIONS, type Role } from "@intellectual-frontiers/tenancy/governance";

const live = (from: string, until: string | undefined, now: string): boolean => from <= now && (until === undefined || until > now);

/** A decision: whether, and why. */
export type Decision = { readonly allow: boolean; readonly reason: string; readonly role?: Role };

/** The rules the model must keep, as problems (none where it keeps them): grants and engagements name known parties, a grant is held by the client itself or by an operator engaged with it, and a validity ends after it begins. */
export function problemsOf(m: Model): readonly string[] {
  const out: string[] = [];
  const party = new Map(m.parties.map((p) => [p.id, p]));
  const principal = new Map(m.principals.map((p) => [p.id, p]));
  if (party.size !== m.parties.length) out.push("a party id is used twice");
  if (principal.size !== m.principals.length) out.push("a principal id is used twice");
  for (const p of m.principals) if (!party.has(p.party)) out.push(`principal ${p.id} is of an unknown party ${p.party}`);
  for (const e of m.engagements) {
    if (party.get(e.operator)?.kind !== "operator") out.push(`engagement ${e.operator} to ${e.client}: ${e.operator} is not an operator`);
    if (party.get(e.client)?.kind !== "client") out.push(`engagement ${e.operator} to ${e.client}: ${e.client} is not a client`);
    if (e.until !== undefined && e.until <= e.from) out.push(`engagement ${e.operator} to ${e.client} ends before it begins`);
  }
  for (const g of m.grants) {
    const p = principal.get(g.principal);
    if (p === undefined) out.push(`grant to ${g.principal} on ${g.tenant}: no such principal`);
    else if (p.party !== g.tenant && !m.engagements.some((e) => e.operator === p.party && e.client === g.tenant)) out.push(`grant to ${g.principal} on ${g.tenant}: neither the client's own nor an operator engaged with it`);
    if (party.get(g.tenant)?.kind !== "client") out.push(`grant to ${g.principal}: ${g.tenant} is not a client`);
    if (g.until !== undefined && g.until <= g.from) out.push(`grant to ${g.principal} on ${g.tenant} ends before it begins`);
  }
  return out;
}

/** Whether a principal may do an action to a tenant at an instant. */
export function decide(m: Model, principalId: string, tenant: string, action: Action, now: string): Decision {
  const p = m.principals.find((x) => x.id === principalId);
  if (p === undefined) return { allow: false, reason: "no such principal" };
  const mine = m.grants.filter((g) => g.principal === principalId && g.tenant === tenant);
  if (mine.length === 0) return { allow: false, reason: "no grant on this tenant" };
  const current = mine.filter((g) => live(g.from, g.until, now));
  if (current.length === 0) return { allow: false, reason: "the grant is not live" };
  const held = current.filter((g) => p.party === g.tenant || m.engagements.some((e) => e.operator === p.party && e.client === g.tenant && live(e.from, e.until, now)));
  if (held.length === 0) return { allow: false, reason: "the principal's party has no live engagement with this tenant" };
  const role = held.find((g) => ROLE_ACTIONS[g.role].includes(action));
  return role === undefined ? { allow: false, reason: `no role held on this tenant allows ${action}` } : { allow: true, reason: `allowed as ${role.role}`, role: role.role };
}

/** The tenants a principal may read at an instant, in order. */
export function visibleTenants(m: Model, principalId: string, now: string): readonly string[] {
  return [...new Set(m.grants.filter((g) => g.principal === principalId).map((g) => g.tenant))].filter((t) => decide(m, principalId, t, "read", now).allow).sort();
}

/** What a tenant shows of itself to a portfolio: counts only, no evidence and no names of assets. */
export type TenantSummary = { readonly tenant: string; readonly asOf: string; readonly rollups: Readonly<Record<string, number>>; readonly findings: Readonly<Record<string, number>> };
/** A principal's view of a portfolio. */
export type Portfolio = { readonly tenants: readonly TenantSummary[]; readonly total: { readonly rollups: Readonly<Record<string, number>>; readonly findings: Readonly<Record<string, number>> } };

const add = (into: Record<string, number>, from: Readonly<Record<string, number>>): void => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
};

/** The portfolio a principal may see: the summaries of the tenants they may read, and totals over those alone. */
export function portfolio(m: Model, summaries: readonly TenantSummary[], principalId: string, now: string): Portfolio {
  const ok = new Set(visibleTenants(m, principalId, now));
  const tenants = summaries.filter((s) => ok.has(s.tenant)).sort((a, b) => (a.tenant < b.tenant ? -1 : 1));
  const rollups: Record<string, number> = {};
  const findings: Record<string, number> = {};
  for (const t of tenants) {
    add(rollups, t.rollups);
    add(findings, t.findings);
  }
  return { tenants, total: { rollups, findings } };
}
