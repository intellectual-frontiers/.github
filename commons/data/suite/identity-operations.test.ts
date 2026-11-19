// Spec: 0043-sql-invariants FR-001, FR-002, FR-003, FR-004, FR-005; 0041-identity-authorize FR-001, FR-002, FR-003, FR-004, FR-005, FR-006; 0042-identity-agent-operations FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The decision engine and the operations of delegation and agents (commons data 0041, 0042), on SQLite and PostgreSQL (DuckDB cannot update a row another row refers to, so these operations are
 * not run on it): one decision for a person, a machine, a device, an agent or a group; delegation that can only attenuate and is revoked from the top; a tool call that is decided, budgeted and
 * approved in one transaction; approval by a person who may do the thing, once; the kill switch; and an audit trail whose chain shows a change. Not shown: two calls at the same instant, which these
 * in-process engines cannot do; the single conditional statement of each operation is what decides.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { composeModules, lintOperations, moduleOf, operation, type Module } from "@intellectual-frontiers/data/governance";
import { partyDomain } from "@intellectual-frontiers/data/models/arca";
import { tenancyModule } from "@intellectual-frontiers/data/models/arca-tenancy";
import { identityModule } from "@intellectual-frontiers/data/models/identity";
import { identityAbacModule } from "@intellectual-frontiers/data/models/identity-abac";
import { identityAccessModule } from "@intellectual-frontiers/data/models/identity-access";
import { agentOperations, identityAgentModule } from "@intellectual-frontiers/data/models/identity-agent";
import { identityDelegationModule } from "@intellectual-frontiers/data/models/identity-delegation";
import { identityRebacModule } from "@intellectual-frontiers/data/models/identity-rebac";
import { agentImplementations, checkExpr, decide, evaluate, type Expr, identityAuditSink, type Implementation, operations, type Runtime, verifyAuditChain } from "@intellectual-frontiers/data/sql/extensions/operations";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { guardKeyOf, invariants, invariantsOf, unlockStatement } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { bind, type StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const mods: readonly Module[] = [moduleOf(partyDomain.kind === "ok" ? partyDomain.value : (undefined as never)), tenancyModule, identityModule, identityAccessModule, identityAbacModule, identityRebacModule, identityDelegationModule, identityAgentModule];
const domain = (() => {
  const r = composeModules("app", {}, mods);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
})();
const schema = (() => {
  const p = projectDomain(domain);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
})();
const refused = async (e: Engine, sql: string): Promise<boolean> => {
  try {
    await e.run(sql);
    return false;
  } catch {
    return true;
  }
};
const ENGINES = DIALECTS.filter((d) => d.name !== "duckdb");
const NOW = "2026-06-01T00:00:00.000Z";
const AT = "'2026-01-01T00:00:00Z'";
const LATER = "2027-01-01T00:00:00.000Z";
const FIXED = { now: () => NOW, newId: (() => { let n = 0; return () => `gen${++n}`; })() };

const decideOp = operation("decideForTest", { definition: "Decides, for the tests", kind: "query", input: { principal: "text", action: "text", tenant: "text", resourceType: { type: "text", optional: true }, resourceId: { type: "text", optional: true }, delegation: { type: "text", optional: true }, context: { type: "text", optional: true } }, reads: ["principal", "roleAssignment", "accessRole", "rolePermission", "permission", "accessPolicy"], public: true, runsAs: "service", idempotent: true });
const chainOp = operation("verifyChainForTest", { definition: "Verifies the audit chain, for the tests", kind: "query", input: {}, reads: ["auditEvent"], public: true, runsAs: "service", idempotent: true });
const decideImpl: Implementation = async (tx, i) => {
  const d = await decide(tx, {
    principal: String(i["principal"]),
    action: String(i["action"]),
    tenant: String(i["tenant"]),
    now: NOW,
    ...(i["resourceType"] === undefined ? {} : { resource: { type: String(i["resourceType"]), id: String(i["resourceId"]) } }),
    ...(i["delegation"] === undefined ? {} : { delegation: String(i["delegation"]) }),
    ...(i["context"] === undefined ? {} : { context: JSON.parse(String(i["context"])) as Record<string, unknown> }),
  });
  return { status: d.effect, reasons: d.reasons, obligations: d.obligations, refs: d.refs };
};
const chainImpl: Implementation = async (tx) => ({ status: "checked", ...(await verifyAuditChain(tx)) });

const world = async (name: Engine["name"], sources: readonly StatementSource[] = []): Promise<{ e: Engine; rt: Runtime }> => {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  const b = bind(schema, { dialect, sources });
  assert(b.kind === "ok", JSON.stringify(b));
  if (b.kind === "ok") await load(e, b.value);
  const sql = [
    `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t1', 'business', 'acme', 'Acme', '/t1', 'active', 'shared', ${AT})`,
    ...[["u1", "user", "NULL"], ["u2", "user", "NULL"], ["g1", "group", "NULL"], ["a1", "agent", "'u1'"], ["a2", "agent", "'u1'"]].map(
      ([id, kind, owner]) => `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at", "owner_principal_id") VALUES ('${id}', '${kind}', 'active', ${AT}, ${AT}, ${owner})`,
    ),
    `INSERT INTO "agent" ("principal_id", "autonomy", "purpose", "approval_threshold", "max_delegation_depth") VALUES ('a1', 'act_with_approval', 'Pays', 'high', 3), ('a2', 'suggest', 'Helps', 'high', 3)`,
    `INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p-read', 'invoice:read', 'Read', 'billing', 'low', 'read'), ('p-pay', 'invoice:pay', 'Pay', 'billing', 'high', 'irreversible'), ('p-top', 'invoice:audit', 'Audit', 'billing', 'high', 'read')`,
    `INSERT INTO "access_role" ("role_id", "role_key", "name", "kind", "definition", "is_privileged", "status") VALUES ('r-view', 'viewer', 'Viewer', 'system', 'Reads', false, 'active'), ('r-pay', 'payer', 'Payer', 'system', 'Pays', false, 'active'), ('r-root', 'root', 'Root', 'system', 'Audits', true, 'active')`,
    `INSERT INTO "role_inheritance" ("senior_access_role_role_id", "junior_access_role_role_id") VALUES ('r-pay', 'r-view')`,
    `INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r-view', 'p-read'), ('r-pay', 'p-pay'), ('r-root', 'p-top')`,
    ...[["ra1", "u1", "r-pay"], ["ra2", "u2", "r-view"], ["ra3", "g1", "r-root"], ["ra4", "a1", "r-root"]].map(
      ([id, who, role]) => `INSERT INTO "role_assignment" ("role_assignment_id", "valid_from", "status", "via", "assignment_key", "principal_id", "role_access_role_role_id", "tenant_id", "granted_by_principal_id") VALUES ('${id}', ${AT}, 'active', 'direct', 'k-${id}', '${who}', '${role}', 't1', 'u1')`,
    ),
    `INSERT INTO "user_group" ("principal_id", "name", "source", "tenant_id") VALUES ('g1', 'finance', 'local', 't1')`,
    `INSERT INTO "group_member" ("group_user_group_principal_id", "member_principal_id", "added_at") VALUES ('g1', 'u2', ${AT}), ('g1', 'a1', ${AT})`,
    `INSERT INTO "agent_version" ("agent_version_id", "version_label", "model_provider", "model_name", "model_version", "prompt_hash", "tool_manifest_hash", "status", "created_at", "version_key", "agent_principal_id") VALUES ('v1', '1', 'p', 'm', '2026', 'ph', 'th', 'approved', ${AT}, 'vk1', 'a1')`,
    `INSERT INTO "agent_tool" ("agent_tool_id", "name", "definition", "risk_level", "side_effect", "status", "permission_id") VALUES ('tl-read', 'read_invoice', 'Reads', 'low', 'read', 'active', 'p-read'), ('tl-pay', 'pay_invoice', 'Pays', 'high', 'irreversible', 'active', 'p-pay')`,
    `INSERT INTO "tool_grant" ("agent_principal_id", "tool_agent_tool_id", "approval", "status", "granted_by_principal_id") VALUES ('a1', 'tl-read', 'inherit', 'active', 'u1'), ('a1', 'tl-pay', 'inherit', 'active', 'u1')`,
  ];
  for (const s of sql) {
    try {
      await e.run(s);
    } catch (thrown) {
      throw new Error(`${s.slice(0, 160)}: ${String(thrown)}`);
    }
  }
  const contracts = [...agentOperations, decideOp, chainOp];
  const impls = { ...agentImplementations, decideForTest: decideImpl, verifyChainForTest: chainImpl };
  const rt = operations(schema, dialect, driverOf(e), contracts, impls, { context: FIXED, audit: identityAuditSink });
  assert(rt.kind === "ok", JSON.stringify(rt));
  return { e, rt: rt.kind === "ok" ? rt.value : (undefined as never) };
};
const ask = async (rt: Runtime, principal: string, action: string, more: Record<string, unknown> = {}) => {
  const r = await rt.run("decideForTest", { principal, action, tenant: "t1", ...more });
  assert(r.kind === "ok", JSON.stringify(r));
  return r.kind === "ok" ? r.value : (undefined as never);
};
const ACTOR: Readonly<Record<string, string>> = { delegate: "delegator", revokeDelegation: "revokedBy", decideApproval: "decidedBy", killAgent: "by" };
const run = async (rt: Runtime, name: string, input: Record<string, unknown>, caller?: string) => {
  const actor = caller ?? (ACTOR[name] === undefined ? undefined : String(input[ACTOR[name] as string]));
  const r = await rt.run(name, input, actor);
  if (r.kind === "err") throw new Error(`${name}: ${JSON.stringify(r.error)}`);
  return r.value;
};
const delegate = (rt: Runtime, over: Record<string, unknown>) =>
  run(rt, "delegate", { tenant: "t1", delegator: "u1", delegate: "a1", purpose: "pay invoices", permissions: ["invoice:read", "invoice:pay"], redelegable: true, maxDepth: 2, expiresAt: LATER, ...over });

proves(
  ["0041-identity-authorize FR-004"],
  "the policy language is a closed tree that answers true, false or unknown, where unknown never allows, and anything that is not an expression is refused",
  () => {
    const attrs = { "subject.department": "finance", "resource.amount": 90, "subject.roles": ["a", "b"], "environment.ip": "10.0.0.5" };
    const e = (op: string, ...args: Expr[]): Expr => ({ op, args }) as Expr;
    const a = (k: string): Expr => ({ attr: k });
    const l = (v: string | number | boolean): Expr => ({ lit: v });
    same(evaluate(e("eq", a("subject.department"), l("finance")), attrs), true);
    same(evaluate(e("lt", a("resource.amount"), l(100)), attrs), true);
    same(evaluate(e("in", l("a"), a("subject.roles")), attrs), true);
    same(evaluate(e("contains", a("subject.roles"), l("z")), attrs), false);
    same(evaluate(e("startsWith", a("environment.ip"), l("10.")), attrs), true);
    same(evaluate(e("eq", a("subject.shoe"), l(9)), attrs), undefined, "an attribute that is not known is unknown");
    same(evaluate(e("and", e("eq", a("subject.shoe"), l(9)), l(5) as never), attrs), undefined, "a literal that is not a condition is unknown");
    same(evaluate(e("and", e("eq", a("subject.shoe"), l(9)), e("eq", l(1), l(2))), attrs), false, "a false operand makes an and false");
    same(evaluate(e("or", e("eq", a("subject.shoe"), l(9)), e("eq", l(1), l(1))), attrs), true, "a true operand makes an or true");
    same(evaluate(e("not", e("eq", a("subject.shoe"), l(9))), attrs), undefined);
    same(evaluate(e("exists", a("subject.shoe")), attrs), false);
    same(evaluate(e("lt", a("subject.department"), l(5)), attrs), undefined, "a comparison of different types is unknown");
    for (const bad of [null, 5, { op: "system", args: [] }, { op: "eq", args: [{ lit: 1 }] }, { attr: "NOPE" }, { op: "not" }]) assert(checkExpr(bad) !== undefined, JSON.stringify(bad));
    same(evaluate({ op: "eq", args: [{ lit: 1 }] } as unknown as Expr, attrs), undefined, "a malformed expression is unknown");
  },
);

proves(
  ["0041-identity-authorize FR-001", "0041-identity-authorize FR-002", "0041-identity-authorize FR-003"],
  "one decision answers for a person, a group's members and an agent: roles, inheritance and groups permit, a privileged role is never an agent's, entitlements gate, relationships permit, a refusal wins, unknown never allows, and a disabled principal can do nothing",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const d = async (who: string, action: string, more: Record<string, unknown> = {}) => (await ask(rt, who, action, more))["status"];
        same(await d("u1", "invoice:pay"), "allow", `${name}: a role permits`);
        same(await d("u1", "invoice:read"), "allow", `${name}: a role inherits what its junior holds`);
        same(await d("u2", "invoice:read"), "allow");
        same(await d("u2", "invoice:pay"), "deny", `${name}: and not what it does not hold`);
        same(await d("u2", "invoice:audit"), "allow", `${name}: a member of a group holds the group's roles`);
        const agent = await ask(rt, "a1", "invoice:audit");
        same(agent["status"], "deny", `${name}: an agent may not hold a privileged role`);
        assert((agent["reasons"] as string[]).some((r) => r.includes("privileged")), JSON.stringify(agent));
        same(await d("nobody", "invoice:read"), "deny");
        // an entitlement gates a permission that names a feature
        await e.run(`UPDATE "permission" SET "feature_key" = 'payments' WHERE "permission_id" = 'p-pay'`);
        same(await d("u1", "invoice:pay"), "deny", `${name}: no entitlement`);
        await e.run(`INSERT INTO "entitlement" ("entitlement_id", "feature_key", "valid_from", "entitlement_source_code", "tenant_id") VALUES ('en1', 'payments', ${AT}, 'plan', 't1')`);
        same(await d("u1", "invoice:pay"), "allow", `${name}: entitled`);
        // a refusal wins, and an unknown refusal refuses
        const pol = (id: string, effect: string, expr: string, name2: string, extra = "") =>
          `INSERT INTO "access_policy" ("access_policy_id", "name", "definition", "effect", "action_pattern", "expression", "expression_language_code", "obligation", "priority", "status", "version", "policy_key"${extra ? ", " + extra.split("=")[0] : ""}) VALUES ('${id}', '${name2}', 'd', '${effect}', 'invoice:*', '${expr}', 'expr', 'none', 1, 'active', 1, 'pk-${id}'${extra ? ", " + extra.split("=")[1] : ""})`;
        await e.run(pol("pp1", "deny", JSON.stringify({ op: "eq", args: [{ attr: "environment.network" }, { lit: "public" }] }), "no-public-network"));
        same(await d("u1", "invoice:pay", { context: JSON.stringify({ "environment.network": "internal" }) }), "allow", `${name}: a refusal that does not apply`);
        const refused = await ask(rt, "u1", "invoice:pay", { context: JSON.stringify({ "environment.network": "public" }) });
        same(refused["status"], "deny", `${name}: a refusal wins over a role`);
        same(await d("u1", "invoice:pay"), "deny", `${name}: a refusal that cannot be told not to apply refuses`);
        // an allow policy that is unknown allows nothing
        await e.run(`DELETE FROM "access_policy"`);
        await e.run(pol("pp2", "allow", JSON.stringify({ op: "eq", args: [{ attr: "subject.department" }, { lit: "finance" }] }), "finance-reads"));
        same(await d("a2", "invoice:read"), "deny", `${name}: an unknown allow allows nothing`);
        // a value of an attribute, stale, is unknown; fresh, it allows
        await e.run(`INSERT INTO "attribute_definition" ("attribute_definition_id", "attribute_key", "category", "value_type", "source", "sensitivity", "freshness_seconds", "definition", "status") VALUES ('ad1', 'subject.department', 'subject', 'text', 'directory', 'internal', 3600, 'Dept', 'active')`);
        await e.run(`INSERT INTO "principal_attribute" ("principal_id", "definition_attribute_definition_id", "value", "valid_from", "updated_at") VALUES ('a2', 'ad1', '"finance"', ${AT}, '2026-05-31T23:59:00Z')`);
        same(await d("a2", "invoice:read"), "allow", `${name}: a fresh attribute allows`);
        await e.run(`UPDATE "principal_attribute" SET "updated_at" = '2026-05-01T00:00:00Z'`);
        same(await d("a2", "invoice:read"), "deny", `${name}: a stale attribute is unknown`);
        // relationships permit
        await e.run(`DELETE FROM "access_policy"`);
        await e.run(`INSERT INTO "permission_relation" ("object_type", "relation", "permission_id") VALUES ('folder', 'viewer', 'p-read')`);
        await e.run(`INSERT INTO "relation_tuple" ("relation_tuple_id", "tuple_key", "object_type", "object_id", "relation", "subject_type", "subject_id", "created_at", "tenant_id") VALUES ('rt1', 'tk1', 'folder', 'f1', 'viewer', 'agent', 'a2', ${AT}, 't1')`);
        same(await d("a2", "invoice:read", { resourceType: "folder", resourceId: "f1" }), "allow", `${name}: a relationship permits`);
        same(await d("a2", "invoice:read", { resourceType: "folder", resourceId: "f2" }), "deny", `${name}: for that object only`);
        await e.run(`UPDATE "relation_tuple" SET "expires_at" = '2026-05-01T00:00:00Z'`);
        same(await d("a2", "invoice:read", { resourceType: "folder", resourceId: "f1" }), "deny", `${name}: until it expires`);
        // disabled: nothing
        await e.run(`UPDATE "principal" SET "status" = 'disabled' WHERE "principal_id" = 'u1'`);
        same(await d("u1", "invoice:read"), "deny", `${name}: a disabled principal can do nothing`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-001", "0041-identity-authorize FR-005", "0042-identity-agent-operations FR-002"],
  "a delegation can only attenuate, a delegate can do only what every delegation of its chain passes on and what the person at the root can do now, and revoking one revokes everything below it",
  async () => {
    assert(lintOperations(domain, agentOperations).filter((f) => f.severity === "error").length === 0, JSON.stringify(lintOperations(domain, agentOperations)));
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const d = async (who: string, action: string, delegation?: string) => (await ask(rt, who, action, delegation === undefined ? {} : { delegation }))["status"];
        // the first of a chain: the delegator must hold what is passed on
        same((await delegate(rt, { delegator: "u2", delegate: "a1" }))["status"], "exceeds-the-delegator", `${name}: u2 cannot pass on what u2 does not hold`);
        same((await delegate(rt, { delegator: "u1", delegate: "u1" }))["status"], "self");
        const root = await delegate(rt, {});
        same(root["status"], "delegated");
        const dg1 = String(root["delegation"]);
        same(await d("a1", "invoice:pay", dg1), "allow", `${name}: under a delegation`);
        same(await d("a1", "invoice:audit", dg1), "deny", `${name}: not what the delegation does not pass on`);
        same(await d("a2", "invoice:pay", dg1), "deny", `${name}: not by another principal`);
        // attenuation
        const child = (over: Record<string, unknown>) => delegate(rt, { delegator: "a1", delegate: "a2", parent: dg1, permissions: ["invoice:read"], maxDepth: 1, ...over });
        same((await child({ permissions: ["invoice:audit"] }))["status"], "exceeds-the-parent", `${name}: never more than the one above`);
        same((await child({ expiresAt: "2028-01-01T00:00:00.000Z" }))["status"], "outlives-the-parent");
        same((await child({ maxDepth: 2 }))["status"], "max-depth-not-less");
        same((await child({ delegator: "a2", delegate: "a1" }))["status"], "not-the-delegate-of-the-parent");
        const sub = await child({});
        same(sub["status"], "delegated");
        const dg2 = String(sub["delegation"]);
        same([await d("a2", "invoice:read", dg2), await d("a2", "invoice:pay", dg2)], ["allow", "deny"], `${name}: the sub-delegate can do only what its delegation passes on`);
        const third = await delegate(rt, { delegator: "a2", delegate: "a1", parent: dg2, permissions: ["invoice:read"], maxDepth: 0 });
        same(third["status"], "delegated", `${name}: one more, with none left to give`);
        same((await delegate(rt, { delegator: "a1", delegate: "a2", parent: String(third["delegation"]), permissions: ["invoice:read"], maxDepth: 0 }))["status"], "not-redelegable", `${name}: and no further`);
        // derived: the person at the root losing a role ends what was delegated
        await e.run(`UPDATE "role_assignment" SET "status" = 'revoked' WHERE "role_assignment_id" = 'ra1'`);
        same(await d("a1", "invoice:pay", dg1), "deny", `${name}: the root can no longer do it, so no one under them can`);
        await e.run(`UPDATE "role_assignment" SET "status" = 'active' WHERE "role_assignment_id" = 'ra1'`);
        same(await d("a1", "invoice:pay", dg1), "allow");
        // revoking the top ends everything below, at once
        const revoked = await run(rt, "revokeDelegation", { delegation: dg1, revokedBy: "u1", reason: "done" });
        same([revoked["status"], revoked["revoked"]], ["revoked", 3], `${name}: the whole chain`);
        same([await d("a1", "invoice:pay", dg1), await d("a2", "invoice:read", dg2)], ["deny", "deny"], `${name}: nothing below stands`);
        same((await run(rt, "revokeDelegation", { delegation: dg1, revokedBy: "u1", reason: "again" }))["status"], "already-ended");
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-003", "0042-identity-agent-operations FR-004"],
  "a tool call is decided, budgeted and approved in one transaction: a granted tool within a delegation is allowed, a risky one waits for a person who owns the agent and may do it themselves, an approval is for one call and used once, and a budget is never exceeded",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const dg = String((await delegate(rt, {}))["delegation"]);
        await e.run(`INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "initiator_principal_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', 'u1', '${dg}')`);
        await e.run(`INSERT INTO "agent_budget" ("budget_id", "meter", "window_kind", "limit_value", "used", "window_start", "version", "status", "budget_key", "agent_principal_id", "run_agent_run_run_id") VALUES ('b1', 'tool_calls', 'run', 3, 0, ${AT}, 0, 'active', 'bk1', 'a1', 'r1')`);
        const call = (idx: number, tool: string, over: Record<string, unknown> = {}) => run(rt, "recordToolCall", { run: "r1", tool, callIndex: idx, argsHash: `ah${idx}`, ...over });
        same((await call(1, "tl-read"))["status"], "allowed", `${name}: a low-risk tool within the delegation`);
        const waiting = await call(2, "tl-pay", { argsHash: "pay-1", argsSummary: "Pay invoice i1", resourceType: "invoice", resourceId: "i1" });
        same(waiting["status"], "approval-required", `${name}: a risky tool waits for a person`);
        const ap = String(waiting["approvalRequest"]);
        const decideAs = (who: string, approve = true) => run(rt, "decideApproval", { approvalRequest: ap, decidedBy: who, approve });
        same((await decideAs("a2"))["status"], "not-a-person", `${name}: an agent never decides`);
        same((await decideAs("a1"))["status"], "not-a-person");
        same((await decideAs("u2"))["status"], "not-the-approver", `${name}: only the one who answers for the agent`);
        same((await decideAs("u1"))["status"], "approved");
        same((await decideAs("u1"))["status"], "not-pending", `${name}: decided once`);
        // bound to exactly this call
        same((await call(3, "tl-pay", { argsHash: "pay-OTHER", resourceType: "invoice", resourceId: "i1", approval: ap }))["status"], "denied", `${name}: an approval is for one call`);
        const paid = await call(4, "tl-pay", { argsHash: "pay-1", resourceType: "invoice", resourceId: "i1", approval: ap });
        same(paid["status"], "allowed", `${name}: the approved call`);
        same((await call(5, "tl-pay", { argsHash: "pay-1", resourceType: "invoice", resourceId: "i1", approval: ap }))["status"], "denied", `${name}: and used once`);
        const spent = async (): Promise<number> => Number((await e.rows(`SELECT "used" u FROM "agent_budget" WHERE "budget_id" = 'b1'`))[0]?.["u"]);
        same(await spent(), 2, `${name}: the budget counts what was allowed, and not what was refused`);
        same((await call(6, "tl-read"))["status"], "allowed");
        same((await call(7, "tl-read"))["status"], "denied", `${name}: the budget is never exceeded`);
        same(await spent(), 3);
        // every call is a row, by index, with the arguments only as a hash
        const calls = await e.rows(`SELECT "call_index" i, "decision" d FROM "tool_call" ORDER BY "call_index"`);
        same(calls.map((c) => [Number(c["i"]), c["d"]]), [[1, "allowed"], [2, "approval_required"], [3, "denied"], [4, "allowed"], [5, "denied"], [6, "allowed"], [7, "budget_exceeded"]], name);
        // a version that is revoked is pulled from every run
        await e.run(`UPDATE "agent_version" SET "status" = 'revoked' WHERE "agent_version_id" = 'v1'`);
        same((await call(8, "tl-read"))["status"], "version-not-allowed", `${name}: revoking a version pulls it from the run`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-005", "0042-identity-agent-operations FR-006", "0041-identity-authorize FR-006"],
  "the kill switch switches an agent off at once, and the audit trail is a chain in which a change to an event shows",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const dg = String((await delegate(rt, {}))["delegation"]);
        await e.run(`INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', '${dg}')`);
        await e.run(`INSERT INTO "credential" ("credential_id", "credential_kind_code", "status", "created_at", "principal_id") VALUES ('c1', 'key_pair', 'active', ${AT}, 'a1')`);
        const waiting = await run(rt, "recordToolCall", { run: "r1", tool: "tl-pay", callIndex: 1, argsHash: "h", resourceType: "invoice", resourceId: "i1" });
        same(waiting["status"], "approval-required");
        same((await ask(rt, "a1", "invoice:read", { delegation: dg }))["status"], "allow");
        const killed = await run(rt, "killAgent", { agent: "a1", by: "u1", reason: "behaving oddly" });
        same(killed, { status: "killed", disabled: 1, runs: 1, delegations: 1, credentials: 1, approvals: 1 }, name);
        same((await ask(rt, "a1", "invoice:read", { delegation: dg }))["status"], "deny", `${name}: nothing it could do works`);
        same((await run(rt, "recordToolCall", { run: "r1", tool: "tl-read", callIndex: 2, argsHash: "h2" }))["status"], "run-not-running");
        same((await run(rt, "killAgent", { agent: "a1", by: "u1", reason: "again" }))["status"], "already-off");
        same((await run(rt, "killAgent", { agent: "u1", by: "u1", reason: "no" }))["status"], "not-an-agent");
        // the audit trail
        const chain = await run(rt, "verifyChainForTest", {});
        assert(Number(chain["length"]) >= 3 && (chain["problems"] as unknown[]).length === 0, `${name}: ${JSON.stringify(chain)}`);
        const events = await e.rows(`SELECT "action", "outcome" FROM "audit_event" ORDER BY "occurred_at", "audit_event_id"`);
        assert(events.some((x) => x["action"] === "agent.killed" && x["outcome"] === "success") && events.some((x) => x["action"] === "delegation.created"), `${name}: ${JSON.stringify(events)}`);
        await e.run(`UPDATE "audit_event" SET "previous_hash" = 'tampered' WHERE "audit_event_id" = (SELECT "audit_event_id" FROM "audit_event" ORDER BY "occurred_at" DESC, "audit_event_id" DESC LIMIT 1)`);
        const broken = await run(rt, "verifyChainForTest", {});
        assert((broken["problems"] as unknown[]).length > 0, `${name}: a change shows: ${JSON.stringify(broken)}`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-004", "0041-identity-authorize FR-006"],
  "a refused call uses nothing up: an approval is not consumed and no budget is spent when another budget has no room, and an event whose fields were changed shows in the chain though its links are intact",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const dg = String((await delegate(rt, {}))["delegation"]);
        await e.run(`INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "initiator_principal_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', 'u1', '${dg}')`);
        // two budgets for the same meter: the run's has room, the agent's is spent
        const budget = (id: string, key: string, limit: number, used: number, scope: string) =>
          `INSERT INTO "agent_budget" ("budget_id", "meter", "window_kind", "limit_value", "used", "window_start", "version", "status", "budget_key", "agent_principal_id"${scope === "run" ? ', "run_agent_run_run_id"' : ""}) VALUES ('${id}', 'tool_calls', '${scope === "run" ? "run" : "day"}', ${limit}, ${used}, ${AT}, 0, 'active', '${key}', 'a1'${scope === "run" ? ", 'r1'" : ""})`;
        await e.run(budget("b-run", "k1", 5, 0, "run"));
        await e.run(budget("b-agent", "k2", 1, 1, "agent"));
        const call = (idx: number, tool: string, over: Record<string, unknown> = {}) => run(rt, "recordToolCall", { run: "r1", tool, callIndex: idx, argsHash: `ah${idx}`, ...over });
        same((await call(1, "tl-read"))["status"], "denied", `${name}: the agent's budget has no room`);
        same(Number((await e.rows(`SELECT "used" u FROM "agent_budget" WHERE "budget_id" = 'b-run'`))[0]?.["u"]), 0, `${name}: so the run's was not spent either`);
        // an approved call that is refused for the budget does not use its approval up
        const waiting = await call(2, "tl-pay", { argsHash: "pay-1", argsSummary: "Pay", resourceType: "invoice", resourceId: "i1" });
        const ap = String(waiting["approvalRequest"]);
        same((await run(rt, "decideApproval", { approvalRequest: ap, decidedBy: "u1", approve: true }))["status"], "approved");
        same((await call(3, "tl-pay", { argsHash: "pay-1", resourceType: "invoice", resourceId: "i1", approval: ap }))["status"], "denied");
        same((await e.rows(`SELECT "status" s FROM "approval_request" WHERE "approval_request_id" = '${ap}'`))[0]?.["s"], "approved", `${name}: the approval is still there to use`);
        await e.run(`UPDATE "agent_budget" SET "limit_value" = 10 WHERE "budget_id" = 'b-agent'`);
        same((await call(4, "tl-pay", { argsHash: "pay-1", resourceType: "invoice", resourceId: "i1", approval: ap }))["status"], "allowed", `${name}: and it is used when the call can be made`);
        same((await e.rows(`SELECT "status" s FROM "approval_request" WHERE "approval_request_id" = '${ap}'`))[0]?.["s"], "consumed");
        same(Number((await e.rows(`SELECT sum("used") u FROM "agent_budget"`))[0]?.["u"]), 3, `${name}: one unit from each of the two budgets`);
        // a field of an event changed in place, with every link intact, is found by its hash
        const before = await run(rt, "verifyChainForTest", {});
        same(before["problems"], [], name);
        await e.run(`UPDATE "audit_event" SET "action" = 'tool.forged' WHERE "audit_event_id" = (SELECT "audit_event_id" FROM "audit_event" ORDER BY "occurred_at", "audit_event_id" LIMIT 1)`);
        const after = await run(rt, "verifyChainForTest", {});
        assert((after["problems"] as { kind: string }[]).some((p) => p.kind === "hash-mismatch"), `${name}: ${JSON.stringify(after)}`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-007"],
  "the identity of the actor is the caller's and never what an input says: a forged delegator, decider or killer is refused, no caller is refused, and only the one who answers for an agent, or who may, can switch it off or end a delegation",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const forged = await rt.run("delegate", { tenant: "t1", delegator: "u1", delegate: "a1", purpose: "p", permissions: ["invoice:read"], redelegable: false, maxDepth: 0, expiresAt: LATER }, "u2");
        same(forged, { kind: "ok", value: { status: "caller-mismatch", caller: "u2", claimed: "u1" } }, `${name}: u2 cannot delegate as u1`);
        same((await rt.run("delegate", { tenant: "t1", delegator: "u1", delegate: "a1", purpose: "p", permissions: ["invoice:read"], redelegable: false, maxDepth: 0, expiresAt: LATER })) as unknown, { kind: "ok", value: { status: "unauthenticated" } }, `${name}: no caller`);
        same(Number((await e.rows(`SELECT count(*) n FROM "delegation"`))[0]?.["n"]), 0, `${name}: nothing was made`);
        const dg = String((await delegate(rt, {}))["delegation"]);
        same((await run(rt, "revokeDelegation", { delegation: dg, revokedBy: "u2", reason: "x" }))["status"], "not-allowed", `${name}: someone else cannot end it`);
        same((await run(rt, "killAgent", { agent: "a1", by: "u2", reason: "x" }))["status"], "not-allowed", `${name}: someone else cannot switch the agent off`);
        same((await rt.run("killAgent", { agent: "a1", by: "u1", reason: "x" }, "u2")) as unknown, { kind: "ok", value: { status: "caller-mismatch", caller: "u2", claimed: "u1" } });
        same(Number((await e.rows(`SELECT count(*) n FROM "principal" WHERE "status" = 'disabled'`))[0]?.["n"]), 0, `${name}: nothing was switched off`);
        // someone who may revoke, or kill, in the tenant, can
        await e.run(`INSERT INTO "permission" ("permission_id", "permission_key", "definition", "owner_module", "risk_level", "side_effect") VALUES ('p-kill', 'agent:kill', 'Kill', 'ops', 'high', 'write'), ('p-rev', 'delegation:revoke', 'Revoke', 'ops', 'high', 'write')`);
        await e.run(`INSERT INTO "access_role" ("role_id", "role_key", "name", "kind", "definition", "is_privileged", "status") VALUES ('r-ops', 'ops', 'Ops', 'system', 'Operates', false, 'active')`);
        await e.run(`INSERT INTO "role_permission" ("role_access_role_role_id", "permission_id") VALUES ('r-ops', 'p-kill'), ('r-ops', 'p-rev')`);
        await e.run(`INSERT INTO "role_assignment" ("role_assignment_id", "valid_from", "status", "via", "assignment_key", "principal_id", "role_access_role_role_id", "tenant_id", "granted_by_principal_id") VALUES ('ra-ops', ${AT}, 'active', 'direct', 'k-ops', 'u2', 'r-ops', 't1', 'u1')`);
        same((await run(rt, "revokeDelegation", { delegation: dg, revokedBy: "u2", reason: "ops" }))["status"], "revoked", `${name}: one who may revoke in the tenant`);
        await e.run(`UPDATE "principal" SET "tenant_id" = 't1' WHERE "principal_id" = 'a2'`);
        same((await run(rt, "killAgent", { agent: "a2", by: "u2", reason: "ops" }))["status"], "killed", `${name}: one who may switch agents off in the tenant`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0043-sql-invariants FR-001", "0043-sql-invariants FR-002", "0043-sql-invariants FR-003", "0043-sql-invariants FR-004"],
  "with the invariants in the database, a statement typed by hand is refused what governance forbids: the audit trail cannot be changed, removed, forked or truncated, a status moves only along its moves, a budget cannot go above its limit, and the operations still work",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name, [invariants()]);
      try {
        // the operations work through the triggers: delegation, a tool call, an approval, the budget, the kill switch
        const dg = String((await delegate(rt, {}))["delegation"]);
        await e.run(`INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "initiator_principal_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', 'u1', '${dg}')`);
        await e.run(`INSERT INTO "agent_budget" ("budget_id", "meter", "window_kind", "limit_value", "used", "window_start", "version", "status", "budget_key", "agent_principal_id", "run_agent_run_run_id") VALUES ('b1', 'tool_calls', 'run', 2, 0, ${AT}, 0, 'active', 'bk1', 'a1', 'r1')`);
        const call = (idx: number, tool: string, over: Record<string, unknown> = {}) => run(rt, "recordToolCall", { run: "r1", tool, callIndex: idx, argsHash: `ah${idx}`, ...over });
        same((await call(1, "tl-read"))["status"], "allowed", `${name}: through the triggers`);
        const waiting = await call(2, "tl-pay", { argsHash: "p1", argsSummary: "Pay", resourceType: "invoice", resourceId: "i1" });
        const ap = String(waiting["approvalRequest"]);
        same((await run(rt, "decideApproval", { approvalRequest: ap, decidedBy: "u1", approve: true }))["status"], "approved");
        same((await call(3, "tl-pay", { argsHash: "p1", resourceType: "invoice", resourceId: "i1", approval: ap }))["status"], "allowed");
        same((await call(4, "tl-read"))["status"], "denied", `${name}: the budget is spent`);
        same((await run(rt, "killAgent", { agent: "a1", by: "u1", reason: "done" }))["status"], "killed");
        const chain = await run(rt, "verifyChainForTest", {});
        assert(Number(chain["length"]) >= 4 && (chain["problems"] as unknown[]).length === 0, `${name}: ${JSON.stringify(chain)}`);
        // raw statements, never through the application
        assert(await refused(e, `UPDATE "audit_event" SET "action" = 'forged' WHERE "sequence" = 1`), `${name}: an event cannot be changed`);
        assert(await refused(e, `DELETE FROM "audit_event" WHERE "sequence" = (SELECT max("sequence") FROM "audit_event")`), `${name}: the tail cannot be removed`);
        assert(await refused(e, `DELETE FROM "audit_event"`), `${name}: nor can the trail`);
        const next = Number((await e.rows(`SELECT max("sequence") m FROM "audit_event"`))[0]?.["m"]) + 1;
        const head = String((await e.rows(`SELECT "event_hash" h FROM "audit_event" ORDER BY "sequence" DESC LIMIT 1`))[0]?.["h"]);
        const ins = (seq: number, prev: string, hash: string) => `INSERT INTO "audit_event" ("audit_event_id", "sequence", "occurred_at", "actor_kind", "action", "outcome", "previous_hash", "event_hash") VALUES ('raw${hash}', ${seq}, ${AT}, 'system', 'x.y', 'success', '${prev}', '${hash}')`;
        assert(await refused(e, ins(next + 1, head, "gap")), `${name}: no event can be left out`);
        assert(await refused(e, ins(next, "not-the-head", "wrong")), `${name}: an event follows the last by its hash`);
        assert(await refused(e, ins(next - 1, head, "fork")), `${name}: the trail cannot fork`);
        await e.run(ins(next, head, "good"));
        if (name === "postgres") assert(await refused(e, `TRUNCATE "audit_event"`), `${name}: the table cannot be emptied`);
        // a status moves only along its moves
        assert(await refused(e, `UPDATE "principal" SET "status" = 'active' WHERE "principal_id" = 'a1'`) === false, `${name}: a disabled principal may be made active by an administrator`);
        await e.run(`UPDATE "principal" SET "status" = 'deleted' WHERE "principal_id" = 'a2'`);
        assert(await refused(e, `UPDATE "principal" SET "status" = 'active' WHERE "principal_id" = 'a2'`), `${name}: a deleted principal stays deleted`);
        assert(await refused(e, `UPDATE "approval_request" SET "status" = 'approved' WHERE "approval_request_id" = '${ap}'`), `${name}: a used approval is not made usable again`);
        const pend = (id: string) => `INSERT INTO "approval_request" ("approval_request_id", "action_key", "args_hash", "summary", "risk_level", "approver_rule", "status", "requested_at", "expires_at", "run_agent_run_run_id", "agent_principal_id") VALUES ('${id}', 'invoice:pay', 'h', 's', 'high', 'owner', 'pending', ${AT}, '2027-01-01T00:00:00Z', 'r1', 'a1')`;
        await e.run(pend("ap-x"));
        assert(await refused(e, `UPDATE "approval_request" SET "status" = 'consumed' WHERE "approval_request_id" = 'ap-x'`), `${name}: an approval is approved before it is used`);
        await e.run(`UPDATE "approval_request" SET "status" = 'approved' WHERE "approval_request_id" = 'ap-x'`);
        await e.run(`UPDATE "approval_request" SET "status" = 'consumed' WHERE "approval_request_id" = 'ap-x'`);
        // a budget cannot go above its limit, by any statement
        assert(await refused(e, `UPDATE "agent_budget" SET "used" = 99 WHERE "budget_id" = 'b1'`), `${name}: a budget cannot be set above its limit`);
        assert(await refused(e, `INSERT INTO "agent_budget" ("budget_id", "meter", "window_kind", "limit_value", "used", "window_start", "version", "status", "budget_key", "agent_principal_id") VALUES ('b2', 'tokens', 'day', 1, 5, ${AT}, 0, 'active', 'bk2', 'a1')`), `${name}: nor created above it`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0043-sql-invariants FR-005"],
  "a dialect without triggers is an error value naming what it cannot enforce unless the project says to carry it, and the invariants a schema declares can be listed",
  async () => {
    const listed = invariantsOf(schema.tables).map((i) => `${i.table}:${i.kind}`);
    for (const x of ["audit event:append-only", "audit event:chain", "agent budget:at-most", "approval request:transitions", "delegation:transitions", "principal:transitions", "agent run:transitions", "agent version:transitions"]) assert(listed.includes(x), `${x} is declared: ${listed.join(", ")}`);
    const duck = DIALECTS.find((d) => d.name === "duckdb")!.dialect;
    const refusedBind = bind(schema, { dialect: duck, sources: [invariants()] });
    assert(refusedBind.kind === "err" && refusedBind.error.some((x) => x.kind === "unsupported" && x.why.includes("no triggers")), JSON.stringify(refusedBind).slice(0, 300));
    const carried = bind(schema, { dialect: duck, sources: [invariants({ unsupported: "carry" })] });
    assert(carried.kind === "ok", "carried, it binds");
    if (carried.kind === "ok") assert(!carried.value.statements.some((s) => /TRIGGER/i.test(s.sql)), "and makes no trigger");
    const sqlite = bind(schema, { dialect: DIALECTS[0].dialect, sources: [invariants()] });
    assert(sqlite.kind === "ok");
    if (sqlite.kind === "ok") assert(sqlite.value.statements.filter((s) => s.group === "routine" && /CREATE TRIGGER/.test(s.sql)).length > 8, "triggers for SQLite");
  },
);

proves(
  ["0043-sql-invariants FR-007"],
  "on PostgreSQL the owner of a table cannot weaken the invariants: dropping, disabling, renaming or replacing a trigger or its function, or dropping the table, is refused unless the session holds the unlock secret, and with the guard left out it is not",
  async () => {
    const SECRET = "a-long-secret-kept-outside-the-database";
    const attacks = [
      `DROP TRIGGER "inv_audit_event_append_only" ON "audit_event"`,
      `ALTER TABLE "audit_event" DISABLE TRIGGER "inv_audit_event_append_only"`,
      `ALTER TABLE "audit_event" DISABLE TRIGGER ALL`,
      `ALTER TRIGGER "inv_audit_event_append_only" ON "audit_event" RENAME TO "harmless"`,
      `CREATE OR REPLACE FUNCTION "inv_audit_event_append_only"() RETURNS trigger LANGUAGE plpgsql AS $x$ BEGIN RETURN NEW; END $x$`,
      `DROP FUNCTION "inv_audit_event_append_only"() CASCADE`,
      `DROP TABLE "audit_event" CASCADE`,
      `CREATE OR REPLACE FUNCTION "inv_guard_drop"() RETURNS event_trigger LANGUAGE plpgsql AS $x$ BEGIN RETURN; END $x$`,
    ];
    const { e } = await world("postgres", [invariants({ guard: { unlock: guardKeyOf(SECRET) } })]);
    try {
      for (const a of attacks) assert(await refused(e, a), `refused: ${a}`);
      same(Number((await e.rows(`SELECT count(*) n FROM pg_trigger WHERE tgname = 'inv_audit_event_append_only' AND tgenabled = 'O'`))[0]?.["n"]), 1, "and the trigger is still there, enabled");
      await e.run(unlockStatement("a-wrong-secret", false));
      assert(await refused(e, attacks[0] as string), "a wrong secret does not unlock it");
      await e.run(unlockStatement(SECRET, false));
      await e.run(attacks[0] as string);
      await e.run(`ALTER TABLE "audit_event" DISABLE TRIGGER ALL`);
      await e.run(unlockStatement("", false));
      assert(await refused(e, `DROP TRIGGER "inv_audit_event_append_only_t" ON "audit_event"`), "locked again");
    } finally {
      await e.close();
    }
    const open = await world("postgres", [invariants({ guard: false })]);
    try {
      await open.e.run(`DROP TRIGGER "inv_audit_event_append_only" ON "audit_event"`);
    } finally {
      await open.e.close();
    }
    const unlockless = await world("postgres", [invariants()]);
    try {
      assert(await refused(unlockless.e, `DROP TRIGGER "inv_audit_event_append_only" ON "audit_event"`), "with no unlock secret nothing opens it");
    } finally {
      await unlockless.e.close();
    }
  },
);

const T2 = `INSERT INTO "tenant" ("tenant_id", "kind", "slug", "display_name", "ancestry", "status", "isolation", "created_at") VALUES ('t2', 'business', 'beta', 'Beta', '/t2', 'active', 'shared', ${AT})`;
const newPrincipal = (id: string, kind: string) => `INSERT INTO "principal" ("principal_id", "kind", "status", "status_changed_at", "created_at") VALUES ('${id}', '${kind}', 'active', ${AT}, ${AT})`;
const newGroup = (id: string) => `INSERT INTO "user_group" ("principal_id", "name", "source", "tenant_id") VALUES ('${id}', '${id}', 'local', 't1')`;
const member = (group: string, who: string) => `INSERT INTO "group_member" ("group_user_group_principal_id", "member_principal_id", "added_at") VALUES ('${group}', '${who}', ${AT})`;
const RUN = (dg: string) => `INSERT INTO "agent_run" ("run_id", "started_at", "status", "agent_principal_id", "version_agent_version_id", "tenant_id", "initiator_principal_id", "delegation_id") VALUES ('r1', ${AT}, 'running', 'a1', 'v1', 't1', 'u1', '${dg}')`;

proves(
  ["0041-identity-authorize FR-001", "0041-identity-authorize FR-005"],
  "what a group passes on reaches a member three groups down and not one six down, and a delegation made in one tenant gives nothing in another though its root holds the role there",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        // g1 holds the privileged role; each group is a member of the one above, a user is the last
        const chain = ["g2", "g3", "g4", "g5", "g6", "g7"];
        for (const g of chain) await e.run(newPrincipal(g, "group"));
        for (const g of chain) await e.run(newGroup(g));
        await e.run(member("g1", "g2"));
        for (let i = 1; i < chain.length; i++) await e.run(member(chain[i - 1] as string, chain[i] as string));
        await e.run(newPrincipal("deep3", "user"));
        await e.run(newPrincipal("deep7", "user"));
        await e.run(member("g4", "deep3"));
        await e.run(member("g7", "deep7"));
        const status = async (who: string) => (await ask(rt, who, "invoice:audit"))["status"];
        same(await status("deep3"), "allow", `${name}: three groups down`);
        same(await status("deep7"), "deny", `${name}: seven groups down is past the depth the engine follows`);
        // a delegation of tenant t1 asked in t2, where its root holds the role too
        await e.run(T2);
        await e.run(`INSERT INTO "role_assignment" ("role_assignment_id", "valid_from", "status", "via", "assignment_key", "principal_id", "role_access_role_role_id", "tenant_id", "granted_by_principal_id") VALUES ('ra9', ${AT}, 'active', 'direct', 'k9', 'u1', 'r-pay', 't2', 'u1')`);
        const dg = String((await delegate(rt, {}))["delegation"]);
        same((await ask(rt, "a1", "invoice:pay", { delegation: dg }))["status"], "allow", `${name}: in its own tenant`);
        same((await ask(rt, "a1", "invoice:pay", { delegation: dg, tenant: "t2" }))["status"], "deny", `${name}: not in another`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0042-identity-agent-operations FR-003", "0042-identity-agent-operations FR-004"],
  "an approval that has expired cannot be decided or used, an approver who no longer holds the permission cannot approve, and a grant's call limit and end are exact",
  async () => {
    for (const { name } of ENGINES) {
      const { e, rt } = await world(name);
      try {
        const dg = String((await delegate(rt, {}))["delegation"]);
        await e.run(RUN(dg));
        const call = (idx: number, tool: string, over: Record<string, unknown> = {}) => run(rt, "recordToolCall", { run: "r1", tool, callIndex: idx, argsHash: `ah${idx}`, ...over });
        const pay = { resourceType: "invoice", resourceId: "i1", argsSummary: "Pay" };
        // expired before it is decided
        const w1 = String((await call(1, "tl-pay", { ...pay, argsHash: "p1" }))["approvalRequest"]);
        await e.run(`UPDATE "approval_request" SET "expires_at" = '2025-01-01T00:00:00Z' WHERE "approval_request_id" = '${w1}'`);
        same((await run(rt, "decideApproval", { approvalRequest: w1, decidedBy: "u1", approve: true }))["status"], "expired", `${name}: too late to decide`);
        // approved, then expired before it is used
        const w2 = String((await call(2, "tl-pay", { ...pay, argsHash: "p2" }))["approvalRequest"]);
        same((await run(rt, "decideApproval", { approvalRequest: w2, decidedBy: "u1", approve: true }))["status"], "approved");
        await e.run(`UPDATE "approval_request" SET "expires_at" = '2025-01-01T00:00:00Z' WHERE "approval_request_id" = '${w2}'`);
        same((await call(3, "tl-pay", { ...pay, argsHash: "p2", approval: w2 }))["status"], "denied", `${name}: too late to use`);
        // an approver who has lost what they would approve
        const w3 = String((await call(4, "tl-pay", { ...pay, argsHash: "p3" }))["approvalRequest"]);
        await e.run(`UPDATE "role_assignment" SET "status" = 'revoked' WHERE "role_assignment_id" = 'ra1'`);
        same((await run(rt, "decideApproval", { approvalRequest: w3, decidedBy: "u1", approve: true }))["status"], "approver-lacks-authority", `${name}: approval never lends authority`);
        await e.run(`UPDATE "role_assignment" SET "status" = 'active' WHERE "role_assignment_id" = 'ra1'`);
        // the call limit counts the calls the run has made: two more, and the third is refused
        const made = Number((await e.rows(`SELECT count(*) AS n FROM "tool_call" WHERE "run_agent_run_run_id" = 'r1'`))[0]?.["n"]);
        await e.run(`UPDATE "tool_grant" SET "max_calls_per_run" = ${made + 2} WHERE "tool_agent_tool_id" = 'tl-read'`);
        same((await call(5, "tl-read"))["status"], "allowed");
        same((await call(6, "tl-read"))["status"], "allowed");
        same((await call(7, "tl-read"))["status"], "denied", `${name}: the limit is the limit`);
        // a grant that ends at this instant is over
        await e.run(`UPDATE "tool_grant" SET "max_calls_per_run" = NULL, "valid_to" = '${NOW}' WHERE "tool_agent_tool_id" = 'tl-read'`);
        same((await call(8, "tl-read"))["status"], "denied", `${name}: it ends when it ends`);
      } finally {
        await e.close();
      }
    }
  },
);
