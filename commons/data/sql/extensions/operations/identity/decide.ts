// Spec: 0041-identity-authorize FR-001, FR-002, FR-003, FR-005
/**
 * The decision engine of identity (commons data 0041-identity-authorize): one `decide(principal, action, resource, context)` that answers for a person, a machine, a device, an agent or a group
 * alike. Permits come from roles (direct, through groups, through role inheritance), from relationships and from policies; any refusal wins; what is unknown never allows. A principal acting under a
 * delegation can do only what every delegation of the chain passes on and what the person at its root can do themselves at that moment. Every decision says why.
 *
 * @module
 */
import type { Tx } from "../tx.ts";
import { checkExpr, evaluate, type Expr } from "./expr.ts";

/** What is asked. */
export interface Request {
  readonly principal: string;
  /** The permission, as `resource:action`. */
  readonly action: string;
  readonly tenant: string;
  readonly resource?: { readonly type: string; readonly id: string };
  /** Attributes of the environment and the action, by key, such as `environment.ip`. */
  readonly context?: Readonly<Record<string, unknown>>;
  /** The delegation the principal acts under. */
  readonly delegation?: string;
  /** The time of the decision. */
  readonly now: string;
}

/** What was decided, and why. */
export interface Decision {
  readonly effect: "allow" | "deny";
  readonly reasons: readonly string[];
  /** What must happen before an allowed action is done. */
  readonly obligations: readonly ("stepUp" | "approval")[];
  /** The roles, policies, tuples and delegations that decided. */
  readonly refs: readonly string[];
}

const MAX_DEPTH = 5;
const iso = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const json = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
const before = (a: string | undefined, b: string): boolean => a !== undefined && new Date(a).getTime() <= new Date(b).getTime();

/** Whether a pattern (an exact permission, or a prefix ending `*`) matches an action. */
export const matches = (pattern: string, action: string): boolean => (pattern.endsWith("*") ? action.startsWith(pattern.slice(0, -1)) : pattern === action);

async function groupsOf(tx: Tx, principal: string): Promise<string[]> {
  const seen = new Set<string>([principal]);
  let frontier = [principal];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const m of frontier)
      for (const r of await tx.select("group member", { where: { member: m }, columns: ["group"] })) {
        const g = String(r["group"]);
        if (!seen.has(g)) {
          seen.add(g);
          next.push(g);
        }
      }
    frontier = next;
  }
  return [...seen];
}

async function rolesWithInherited(tx: Tx, roles: readonly string[]): Promise<string[]> {
  const seen = new Set(roles);
  let frontier = [...roles];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const r of frontier)
      for (const j of await tx.select("role inheritance", { where: { senior: r }, columns: ["junior"] })) {
        const id = String(j["junior"]);
        if (!seen.has(id)) {
          seen.add(id);
          next.push(id);
        }
      }
    frontier = next;
  }
  return [...seen];
}

/** The attributes known about a request: the principal's, the resource's, and the context's. */
async function attributesOf(tx: Tx, req: Request, kind: string): Promise<Record<string, unknown>> {
  const attrs: Record<string, unknown> = { "subject.kind": kind, "subject.id": req.principal, "action.key": req.action, ...(req.context ?? {}) };
  for (const r of await tx.select("principal attribute", { where: { principal: req.principal }, columns: ["definition", "value", "validFrom", "validTo", "updatedAt"] })) {
    const def = (await tx.select("attribute definition", { where: { attributeDefinitionId: String(r["definition"]) }, columns: ["attributeKey", "freshnessSeconds"] }))[0];
    if (def === undefined) continue;
    const from = iso(r["validFrom"]);
    const to = iso(r["validTo"]);
    if (!before(from, req.now) || (to !== undefined && before(to, req.now))) continue;
    const fresh = def["freshnessSeconds"];
    const at = iso(r["updatedAt"]);
    // a stored value that is older than its definition allows is unknown, never true
    if (typeof fresh === "number" && at !== undefined && new Date(req.now).getTime() - new Date(at).getTime() > fresh * 1000) continue;
    attrs[String(def["attributeKey"])] = json(r["value"]);
  }
  if (req.resource !== undefined) {
    attrs["resource.type"] = req.resource.type;
    attrs["resource.id"] = req.resource.id;
    for (const r of await tx.select("resource attribute", { where: { resourceType: req.resource.type, resourceId: req.resource.id, tenant: req.tenant }, columns: ["definition", "value"] })) {
      const def = (await tx.select("attribute definition", { where: { attributeDefinitionId: String(r["definition"]) }, columns: ["attributeKey"] }))[0];
      if (def !== undefined) attrs[String(def["attributeKey"])] = json(r["value"]);
    }
  }
  return attrs;
}

const within = (limitType: unknown, limitId: unknown, r: Request["resource"]): boolean => {
  if (limitType === null || limitType === undefined) return true;
  if (r === undefined || r.type !== limitType) return false;
  if (limitId === null || limitId === undefined) return true;
  const id = String(limitId);
  return id.endsWith("*") ? r.id.startsWith(id.slice(0, -1)) : r.id === id;
};

/**
 * Decides.
 *
 * @param tx - a transaction
 * @param req - what is asked
 * @returns the decision, with why
 */
export async function decide(tx: Tx, req: Request): Promise<Decision> {
  const reasons: string[] = [];
  const refs: string[] = [];
  const deny = (why: string): Decision => ({ effect: "deny", reasons: [...reasons, why], obligations: [], refs });
  const subject = (await tx.select("principal", { where: { principalId: req.principal }, columns: ["kind", "status"] }))[0];
  if (subject === undefined) return deny("the principal is not known");
  if (subject["status"] !== "active") return deny(`the principal is ${String(subject["status"])}`);
  const kind = String(subject["kind"]);
  const attrs = await attributesOf(tx, req, kind);

  // a principal acting under a delegation: the chain, then the person at its root
  if (req.delegation !== undefined) {
    const chain: Record<string, unknown>[] = [];
    let at: string | undefined = req.delegation;
    for (let i = 0; at !== undefined && i <= MAX_DEPTH + 1; i++) {
      const rows: Record<string, unknown>[] = await tx.select("delegation", { where: { delegationId: at }, columns: ["delegationId", "status", "validFrom", "expiresAt", "tenant", "delegate", "delegator", "parent", "resourceType", "resourceId", "expression"] });
      const d = rows[0];
      if (d === undefined) return deny(`the delegation ${at} is not there`);
      chain.push(d);
      at = d["parent"] === null || d["parent"] === undefined ? undefined : String(d["parent"]);
    }
    let holder = req.principal;
    for (const d of chain) {
      const id = String(d["delegationId"]);
      refs.push(`delegation:${id}`);
      if (d["status"] !== "active") return deny(`the delegation ${id} is ${String(d["status"])}`);
      if (!before(iso(d["validFrom"]), req.now) || before(iso(d["expiresAt"]), req.now)) return deny(`the delegation ${id} is not in force`);
      if (String(d["tenant"]) !== req.tenant) return deny(`the delegation ${id} is in another tenant`);
      if (String(d["delegate"]) !== holder) return deny(`the delegation ${id} is not to ${holder}`);
      const passes = await tx.select("delegation permission", { where: { delegation: id }, columns: ["permission"] });
      const keys: string[] = [];
      for (const p of passes) {
        const k = (await tx.select("permission", { where: { permissionId: String(p["permission"]) }, columns: ["permissionKey"] }))[0];
        if (k !== undefined) keys.push(String(k["permissionKey"]));
      }
      if (!keys.includes(req.action)) return deny(`the delegation ${id} does not pass on ${req.action}`);
      if (!within(d["resourceType"], d["resourceId"], req.resource)) return deny(`the delegation ${id} is limited to another resource`);
      if (typeof d["expression"] === "string" && d["expression"] !== "") {
        const parsed = json(d["expression"]);
        if (checkExpr(parsed) !== undefined || evaluate(parsed as Expr, attrs) !== true) return deny(`the condition of the delegation ${id} does not hold`);
      }
      holder = String(d["delegator"]);
    }
    // what the delegator can do themselves, now: a delegation never adds
    const root = await decide(tx, { principal: holder, action: req.action, tenant: req.tenant, ...(req.resource === undefined ? {} : { resource: req.resource }), ...(req.context === undefined ? {} : { context: req.context }), now: req.now });
    if (root.effect !== "allow") return { effect: "deny", reasons: [...reasons, `${holder}, at the root of the delegation, cannot do it: ${root.reasons.join("; ")}`], obligations: [], refs: [...refs, ...root.refs] };
    reasons.push(`delegated from ${holder} through ${chain.length} delegation(s)`);
    return { effect: "allow", reasons, obligations: root.obligations, refs: [...refs, ...root.refs] };
  }

  // permits: roles, relationships
  const permitted: string[] = [];
  const principals = await groupsOf(tx, req.principal);
  const direct: string[] = [];
  for (const p of principals)
    for (const a of await tx.select("role assignment", { where: { principal: p, tenant: req.tenant, status: "active" }, columns: ["role", "validFrom", "validTo", "resourceType", "resourceId", "roleAssignmentId"] })) {
      if (!before(iso(a["validFrom"]), req.now) || (iso(a["validTo"]) !== undefined && before(iso(a["validTo"]), req.now))) continue;
      if (!within(a["resourceType"], a["resourceId"], req.resource)) continue;
      direct.push(String(a["role"]));
      refs.push(`assignment:${String(a["roleAssignmentId"])}`);
    }
  for (const role of await rolesWithInherited(tx, direct)) {
    const r = (await tx.select("access role", { where: { roleId: role }, columns: ["isPrivileged", "status", "roleKey"] }))[0];
    if (r === undefined || r["status"] !== "active") continue;
    if (kind === "agent" && (r["isPrivileged"] === true || r["isPrivileged"] === 1)) {
      reasons.push(`the role ${String(r["roleKey"])} is privileged and an agent may not hold it`);
      continue;
    }
    for (const rp of await tx.select("role permission", { where: { role }, columns: ["permission"] })) {
      const p = (await tx.select("permission", { where: { permissionId: String(rp["permission"]) }, columns: ["permissionKey", "featureKey"] }))[0];
      if (p === undefined || p["permissionKey"] !== req.action) continue;
      const feature = p["featureKey"];
      if (typeof feature === "string") {
        const ent = await tx.select("entitlement", { where: { tenant: req.tenant, featureKey: feature }, columns: ["validFrom", "validTo"] });
        if (!ent.some((e) => before(iso(e["validFrom"]), req.now) && (iso(e["validTo"]) === undefined || !before(iso(e["validTo"]), req.now)))) {
          reasons.push(`the tenant is not entitled to ${feature}`);
          continue;
        }
      }
      permitted.push(`role:${String(r["roleKey"])}`);
      refs.push(`role:${role}`);
    }
  }
  if (req.resource !== undefined) {
    const perm = (await tx.select("permission", { where: { permissionKey: req.action }, columns: ["permissionId"] }))[0];
    if (perm !== undefined)
      for (const pr of await tx.select("permission relation", { where: { permission: String(perm["permissionId"]), objectType: req.resource.type }, columns: ["relation"] }))
        for (const p of principals)
          for (const t of await tx.select("relation tuple", { where: { tenant: req.tenant, objectType: req.resource.type, objectId: req.resource.id, relation: String(pr["relation"]), subjectId: p }, columns: ["relationTupleId", "expiresAt"] })) {
            const exp = iso(t["expiresAt"]);
            if (exp !== undefined && before(exp, req.now)) continue;
            permitted.push(`relation:${String(pr["relation"])}`);
            refs.push(`tuple:${String(t["relationTupleId"])}`);
          }
  }

  // policies: a refusal wins; unknown never allows, and an unknown refusal refuses
  const obligations = new Set<"stepUp" | "approval">();
  const policies = await tx.select("access policy", { where: { status: "active" }, columns: ["name", "version", "effect", "actionPattern", "appliesTo", "resourceType", "expression", "expressionLanguage", "obligation", "priority", "validFrom", "validTo", "tenant"], orderBy: [["priority", "asc"]] });
  for (const pol of policies) {
    const tenantOf = pol["tenant"];
    if (tenantOf !== null && tenantOf !== undefined && String(tenantOf) !== req.tenant) continue;
    if (!matches(String(pol["actionPattern"]), req.action)) continue;
    if (pol["appliesTo"] !== null && pol["appliesTo"] !== undefined && pol["appliesTo"] !== kind) continue;
    if (pol["resourceType"] !== null && pol["resourceType"] !== undefined && pol["resourceType"] !== req.resource?.type) continue;
    if (pol["validFrom"] !== null && pol["validFrom"] !== undefined && !before(iso(pol["validFrom"]), req.now)) continue;
    if (pol["validTo"] !== null && pol["validTo"] !== undefined && before(iso(pol["validTo"]), req.now)) continue;
    const id = `policy:${String(pol["name"])}@${String(pol["version"])}`;
    const parsed = json(pol["expression"]);
    const t: boolean | undefined = pol["expressionLanguage"] === "expr" && checkExpr(parsed) === undefined ? evaluate(parsed as Expr, attrs) : undefined;
    if (pol["effect"] === "deny") {
      if (t !== false) {
        refs.push(id);
        return { effect: "deny", reasons: [...reasons, t === true ? `the policy ${String(pol["name"])} refuses it` : `the policy ${String(pol["name"])} cannot be told not to apply, so it refuses`], obligations: [], refs };
      }
    } else if (t === true) {
      permitted.push(id);
      refs.push(id);
      if (pol["obligation"] === "stepUp" || pol["obligation"] === "approval") obligations.add(pol["obligation"]);
    } else if (t === undefined) reasons.push(`the policy ${String(pol["name"])} is unknown and allows nothing`);
  }
  if (permitted.length === 0) return deny(`nothing allows ${req.action}`);
  reasons.push(`allowed by ${permitted.join(", ")}`);
  return { effect: "allow", reasons, obligations: [...obligations], refs };
}

/**
 * The authorizer of the operations runtime, from the engine: it allows a caller who is allowed the permission in the tenant.
 *
 * @param now - the clock
 * @returns the authorizer
 */
export const identityAuthorize =
  (now: () => string) =>
  async (tx: Tx, caller: string, permission: string, tenant: string | undefined): Promise<boolean> =>
    tenant !== undefined && (await decide(tx, { principal: caller, action: permission, tenant, now: now() })).effect === "allow";
