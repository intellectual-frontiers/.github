// Spec: 0042-identity-agent-operations FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The operations of agents and delegation (commons data 0042-identity-agent-operations), written once against typed row operations: delegation that can only attenuate, revocation that reaches
 * everything below, a tool call that is decided, budgeted and approved in one transaction, approval that only a person who may do the thing can give, once, and the kill switch.
 *
 * @module
 */
import type { Implementation, Outcome } from "../runtime.ts";
import type { Context, Tx } from "../tx.ts";
import { decide } from "./decide.ts";
import { matches } from "./decide.ts";

const RISK = ["low", "medium", "high", "critical"];
const iso = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const isTrue = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
const ms = (s: string): number => new Date(s).getTime();
const hex = async (s: string): Promise<string> => {
  const { sha256Hex } = await import("@intellectual-frontiers/data/sql/lifecycle");
  return sha256Hex(s);
};

async function keysOf(tx: Tx, delegation: string): Promise<string[]> {
  const out: string[] = [];
  for (const p of await tx.select("delegation permission", { where: { delegation }, columns: ["permission"] })) {
    const k = (await tx.select("permission", { where: { permissionId: String(p["permission"]) }, columns: ["permissionKey"] }))[0];
    if (k !== undefined) out.push(String(k["permissionKey"]));
  }
  return out;
}

/** Whether a limit on a resource (exact, or a prefix ending `*`) is no wider than the limit above it. */
const narrower = (childType: unknown, childId: unknown, parentType: unknown, parentId: unknown): boolean => {
  if (parentType === null || parentType === undefined) return true;
  if (childType !== parentType) return false;
  if (parentId === null || parentId === undefined) return true;
  if (childId === null || childId === undefined) return false;
  return matches(String(parentId), String(childId).endsWith("*") ? String(childId).slice(0, -1) : String(childId)) && (!String(childId).endsWith("*") || String(parentId).endsWith("*"));
};

export const delegateImpl: Implementation = async (tx, input, ctx): Promise<Outcome> => {
  const now = ctx.now();
  const delegator = String(input["delegator"]);
  const delegate = String(input["delegate"]);
  const tenant = String(input["tenant"]);
  const permissions = input["permissions"] as string[];
  if (delegator === delegate) return { status: "self" };
  if (ms(String(input["expiresAt"])) <= ms(now)) return { status: "already-expired" };
  for (const who of [delegator, delegate]) {
    const p = (await tx.select("principal", { where: { principalId: who }, columns: ["status"] }))[0];
    if (p === undefined || p["status"] !== "active") return { status: "principal-not-active", principal: who };
  }
  const parentId = input["parent"] as string | undefined;
  let depth = 0;
  let root: string | undefined;
  let parent: Record<string, unknown> | undefined;
  if (parentId !== undefined) {
    parent = (await tx.select("delegation", { where: { delegationId: parentId }, columns: ["delegationId", "status", "delegate", "depth", "redelegable", "maxDepth", "expiresAt", "root", "resourceType", "resourceId", "tenant"] }))[0];
    if (parent === undefined || parent["status"] !== "active" || ms(iso(parent["expiresAt"]) as string) <= ms(now)) return { status: "parent-not-active" };
    if (String(parent["delegate"]) !== delegator) return { status: "not-the-delegate-of-the-parent" };
    if (!isTrue(parent["redelegable"]) || Number(parent["maxDepth"]) < 1) return { status: "not-redelegable" };
    if (Number(input["maxDepth"]) >= Number(parent["maxDepth"])) return { status: "max-depth-not-less" };
    if (ms(String(input["expiresAt"])) > ms(iso(parent["expiresAt"]) as string)) return { status: "outlives-the-parent" };
    if (!narrower(input["resourceType"], input["resourceId"], parent["resourceType"], parent["resourceId"])) return { status: "wider-resource-than-the-parent" };
    const up = await keysOf(tx, String(parent["delegationId"]));
    const extra = permissions.filter((p) => !up.includes(p));
    if (extra.length > 0) return { status: "exceeds-the-parent", permissions: extra };
    depth = Number(parent["depth"]) + 1;
    root = parent["root"] === null || parent["root"] === undefined ? String(parent["delegationId"]) : String(parent["root"]);
  } else {
    // the first of a chain: the delegator must be able to do each thing now
    for (const p of permissions) {
      const d = await decide(tx, { principal: delegator, action: p, tenant, now, ...(input["resourceType"] === undefined || input["resourceId"] === undefined ? {} : { resource: { type: String(input["resourceType"]), id: String(input["resourceId"]) } }) });
      if (d.effect !== "allow") return { status: "exceeds-the-delegator", permissions: [p] };
    }
  }
  const registry = new Map<string, string>();
  for (const p of permissions) {
    const row = (await tx.select("permission", { where: { permissionKey: p }, columns: ["permissionId"] }))[0];
    if (row === undefined) return { status: "unknown-permission", permission: p };
    registry.set(p, String(row["permissionId"]));
  }
  const id = ctx.newId();
  await tx.insert("delegation", {
    delegationId: id,
    depth,
    purpose: String(input["purpose"]),
    ...(input["resourceType"] === undefined ? {} : { resourceType: String(input["resourceType"]) }),
    ...(input["resourceId"] === undefined ? {} : { resourceId: String(input["resourceId"]) }),
    ...(input["expression"] === undefined ? {} : { expression: String(input["expression"]), expressionLanguage: "expr" }),
    redelegable: input["redelegable"] as boolean,
    maxDepth: Number(input["maxDepth"]),
    validFrom: now,
    expiresAt: String(input["expiresAt"]),
    status: "active",
    tenant,
    delegator,
    delegate,
    ...(parentId === undefined ? {} : { parent: parentId }),
    ...(root === undefined ? {} : { root }),
  });
  for (const permissionId of registry.values()) await tx.insert("delegation permission", { delegation: id, permission: permissionId });
  await tx.audit({ action: "delegation.created", outcome: "success", actorKind: "user", actor: delegator, tenant, targetConcept: "delegation", targetKey: id, ...({ onBehalfOf: delegator, delegationKey: id } as object) });
  return { status: "delegated", delegation: id, depth };
};

export const revokeDelegationImpl: Implementation = async (tx, input, ctx): Promise<Outcome> => {
  const id = String(input["delegation"]);
  const start = (await tx.select("delegation", { where: { delegationId: id }, columns: ["status"] }))[0];
  if (start === undefined) return { status: "not-found" };
  const all = [id];
  for (let i = 0; i < all.length; i++) for (const c of await tx.select("delegation", { where: { parent: all[i] as string }, columns: ["delegationId"] })) all.push(String(c["delegationId"]));
  let n = 0;
  for (const d of all) n += await tx.update("delegation", { status: "revoked", revokedAt: ctx.now(), revokedBy: String(input["revokedBy"]), revokeReason: String(input["reason"]) }, { delegationId: d, status: "active" });
  if (n === 0) return { status: "already-ended", revoked: 0 };
  await tx.audit({ action: "delegation.revoked", outcome: "success", actorKind: "user", actor: String(input["revokedBy"]), targetConcept: "delegation", targetKey: id, reason: String(input["reason"]), ...({ delegationKey: id } as object) });
  return { status: "revoked", revoked: n };
};

/** The budgets that apply to a call: the run's, and the agent's that are not for one run. */
async function budgetsFor(tx: Tx, run: string, agent: string, meter: string): Promise<Record<string, unknown>[]> {
  const mine = await tx.select("agent budget", { where: { run, meter, status: "active" }, columns: ["budgetId", "limitValue", "used", "version", "run"] });
  const wider = await tx.select("agent budget", { where: { agent, meter, status: "active" }, columns: ["budgetId", "limitValue", "used", "version", "run"] });
  return [...mine, ...wider.filter((x) => x["run"] === null || x["run"] === undefined)];
}

/** Whether every budget has room, changing nothing. */
const hasRoom = async (tx: Tx, run: string, agent: string, meter: string, amount: number): Promise<boolean> =>
  (await budgetsFor(tx, run, agent, meter)).every((b) => Number(b["used"]) + amount <= Number(b["limitValue"]));

/**
 * Takes one unit of every budget, or none: each by one conditional update, so that two calls cannot both take the last unit, and if one fails those already taken are given back.
 */
async function spend(tx: Tx, run: string, agent: string, meter: string, amount: number): Promise<"ok" | "exceeded"> {
  const taken: { id: string; used: number; version: number }[] = [];
  for (const b of await budgetsFor(tx, run, agent, meter)) {
    const used = Number(b["used"]);
    const version = Number(b["version"]);
    const n = used + amount <= Number(b["limitValue"]) ? await tx.update("agent budget", { used: used + amount, version: version + 1 }, { budgetId: String(b["budgetId"]), version, used }) : 0;
    if (n !== 1) {
      for (const g of taken) await tx.update("agent budget", { used: g.used, version: g.version + 2 }, { budgetId: g.id, version: g.version + 1 });
      return "exceeded";
    }
    taken.push({ id: String(b["budgetId"]), used, version });
  }
  return "ok";
}

export const recordToolCallImpl: Implementation = async (tx, input, ctx: Context): Promise<Outcome> => {
  const now = ctx.now();
  const runId = String(input["run"]);
  const run = (await tx.select("agent run", { where: { runId }, columns: ["runId", "status", "agent", "version", "tenant", "delegation"] }))[0];
  if (run === undefined) return { status: "run-not-found" };
  if (run["status"] !== "running") return { status: "run-not-running", runStatus: String(run["status"]) };
  const agentId = String(run["agent"]);
  const tenant = String(run["tenant"]);
  const version = (await tx.select("agent version", { where: { agentVersionId: String(run["version"]) }, columns: ["status"] }))[0];
  if (version === undefined || !["approved", "active"].includes(String(version["status"]))) return { status: "version-not-allowed", versionStatus: String(version?.["status"]) };
  const agent = (await tx.select("agent", { where: { principal: agentId }, columns: ["approvalThreshold", "autonomy"] }))[0];
  const tool = (await tx.select("agent tool", { where: { agentToolId: String(input["tool"]) }, columns: ["agentToolId", "riskLevel", "status", "permission"] }))[0];
  if (agent === undefined || tool === undefined || tool["status"] !== "active") return { status: "tool-not-found" };
  const perm = (await tx.select("permission", { where: { permissionId: String(tool["permission"]) }, columns: ["permissionKey"] }))[0];
  const action = String(perm?.["permissionKey"]);
  const grant = (await tx.select("tool grant", { where: { agent: agentId, tool: String(tool["agentToolId"]), status: "active" }, columns: ["approval", "maxCallsPerRun", "validTo"] }))[0];
  const record = async (decision: string, extra: Record<string, string | number | null> = {}): Promise<string> => {
    const id = ctx.newId();
    await tx.insert("tool call", {
      toolCallId: id,
      callIndex: Number(input["callIndex"]),
      decision,
      status: decision === "allowed" ? "requested" : "failed",
      argsHash: String(input["argsHash"]),
      ...(input["argsSummary"] === undefined ? {} : { argsSummary: String(input["argsSummary"]) }),
      ...(input["resourceType"] === undefined ? {} : { resourceType: String(input["resourceType"]) }),
      ...(input["resourceId"] === undefined ? {} : { resourceId: String(input["resourceId"]) }),
      requestedAt: now,
      callKey: await hex(`${runId}:${String(input["callIndex"])}`),
      run: runId,
      tool: String(tool["agentToolId"]),
      ...extra,
    });
    return id;
  };
  const deny = async (reason: string, decision = "denied"): Promise<Outcome> => {
    await record(tx.code(decision), { denyReason: reason });
    await tx.audit({ action: "tool.called", outcome: "denied", actorKind: "agent", actor: agentId, tenant, targetConcept: "agentTool", targetKey: String(tool["agentToolId"]), reason, ...({ decision: "deny", runKey: runId } as object) });
    return { status: decision === "approvalRequired" ? "approval-required" : "denied", reason };
  };
  if (grant === undefined || (grant["validTo"] !== null && grant["validTo"] !== undefined && ms(iso(grant["validTo"]) as string) <= ms(now))) return deny("the agent has not been granted the tool");
  if (grant["maxCallsPerRun"] !== null && grant["maxCallsPerRun"] !== undefined && (await tx.count("tool call", { run: runId })) >= Number(grant["maxCallsPerRun"])) return deny("the run has made all the calls its grant allows", "budgetExceeded");
  const resource = input["resourceType"] === undefined || input["resourceId"] === undefined ? undefined : { type: String(input["resourceType"]), id: String(input["resourceId"]) };
  const d = await decide(tx, { principal: agentId, action, tenant, now, ...(resource === undefined ? {} : { resource }), ...(run["delegation"] === null || run["delegation"] === undefined ? {} : { delegation: String(run["delegation"]) }) });
  if (d.effect !== "allow") return deny(d.reasons.join("; "));
  // a person approves what is risky
  const risky = grant["approval"] === "always" || RISK.indexOf(String(tool["riskLevel"])) >= RISK.indexOf(String(agent["approvalThreshold"])) || d.obligations.includes("approval");
  if (risky) {
    const wanted = input["approval"] as string | undefined;
    if (wanted === undefined) {
      const id = ctx.newId();
      await tx.insert("approval request", {
        approvalRequestId: id,
        actionKey: action,
        ...(resource === undefined ? {} : { resourceType: resource.type, resourceId: resource.id }),
        argsHash: String(input["argsHash"]),
        summary: String(input["argsSummary"] ?? action),
        riskLevel: String(tool["riskLevel"]),
        approverRule: run["delegation"] === null || run["delegation"] === undefined ? "owner" : "delegator",
        status: "pending",
        requestedAt: now,
        expiresAt: new Date(ms(now) + 3600_000).toISOString(),
        run: runId,
        agent: agentId,
      });
      await record(tx.code("approvalRequired"), { denyReason: `waiting for approval ${id}` });
      await tx.audit({ action: "tool.called", outcome: "denied", actorKind: "agent", actor: agentId, tenant, targetConcept: "approvalRequest", targetKey: id, reason: "approval required", ...({ decision: "allow", runKey: runId } as object) });
      return { status: "approval-required", approvalRequest: id };
    }
    // the budget is looked at before the approval is used, so that a refused call uses nothing up
    if (!(await hasRoom(tx, runId, agentId, "tool_calls", 1))) return deny("the budget for calls is spent", "budgetExceeded");
    // one conditional update uses an approval once, and only for exactly these arguments
    const used = await tx.update("approval request", { status: "consumed", consumedAt: now }, { approvalRequestId: wanted, status: "approved", argsHash: String(input["argsHash"]), actionKey: action, expiresAt: { gt: now } });
    if (used !== 1) return deny("the approval is not for this call, or has been used, or has run out");
    if ((await spend(tx, runId, agentId, "tool_calls", 1)) === "exceeded") {
      await tx.update("approval request", { status: "approved", consumedAt: null }, { approvalRequestId: wanted, status: "consumed" });
      return deny("the budget for calls is spent", "budgetExceeded");
    }
  } else if ((await spend(tx, runId, agentId, "tool_calls", 1)) === "exceeded") return deny("the budget for calls is spent", "budgetExceeded");
  const id = await record("allowed");
  await tx.audit({ action: "tool.called", outcome: "success", actorKind: "agent", actor: agentId, tenant, targetConcept: "agentTool", targetKey: String(tool["agentToolId"]), ...({ decision: "allow", runKey: runId, policyRefs: d.refs } as object) });
  return { status: "allowed", toolCall: id, obligations: d.obligations };
};

export const decideApprovalImpl: Implementation = async (tx, input, ctx): Promise<Outcome> => {
  const now = ctx.now();
  const req = (await tx.select("approval request", { where: { approvalRequestId: String(input["approvalRequest"]) }, columns: ["approvalRequestId", "status", "expiresAt", "approverRule", "run", "agent", "actionKey", "resourceType", "resourceId"] }))[0];
  if (req === undefined) return { status: "not-found" };
  const who = String(input["decidedBy"]);
  const person = (await tx.select("principal", { where: { principalId: who }, columns: ["kind", "status", "tenant"] }))[0];
  // only a person decides: an agent can never approve, even for another agent
  if (person === undefined || person["kind"] !== "user" || person["status"] !== "active") return { status: "not-a-person" };
  if (req["status"] !== "pending") return { status: "not-pending", approvalStatus: String(req["status"]) };
  if (ms(iso(req["expiresAt"]) as string) <= ms(now)) return { status: "expired" };
  const run = (await tx.select("agent run", { where: { runId: String(req["run"]) }, columns: ["tenant", "delegation"] }))[0];
  const tenant = String(run?.["tenant"]);
  const agent = (await tx.select("principal", { where: { principalId: String(req["agent"]) }, columns: ["owner"] }))[0];
  let authority = false;
  if (req["approverRule"] === "owner") authority = String(agent?.["owner"]) === who;
  else if (req["approverRule"] === "delegator" && run?.["delegation"] !== null && run?.["delegation"] !== undefined) {
    let at: string | undefined = String(run["delegation"]);
    let top: string | undefined;
    for (let i = 0; at !== undefined && i < 8; i++) {
      const rows: Record<string, unknown>[] = await tx.select("delegation", { where: { delegationId: at }, columns: ["delegator", "parent"] });
      const d = rows[0];
      if (d === undefined) break;
      top = String(d["delegator"]);
      at = d["parent"] === null || d["parent"] === undefined ? undefined : String(d["parent"]);
    }
    authority = top === who;
  }
  if (!authority) return { status: "not-the-approver" };
  // the approver must be able to do the thing themselves: approval never launders authority
  const resource = req["resourceType"] === null || req["resourceType"] === undefined ? undefined : { type: String(req["resourceType"]), id: String(req["resourceId"]) };
  const can = await decide(tx, { principal: who, action: String(req["actionKey"]), tenant, now, ...(resource === undefined ? {} : { resource }) });
  if (can.effect !== "allow") return { status: "approver-lacks-authority", reasons: can.reasons };
  const approve = input["approve"] === true;
  const n = await tx.update("approval request", { status: approve ? "approved" : "denied", decidedAt: now, decidedBy: who, ...(input["reason"] === undefined ? {} : { decisionReason: String(input["reason"]) }) }, { approvalRequestId: String(req["approvalRequestId"]), status: "pending" });
  if (n !== 1) return { status: "not-pending" };
  await tx.audit({ action: "approval.decided", outcome: "success", actorKind: "user", actor: who, tenant, targetConcept: "approvalRequest", targetKey: String(req["approvalRequestId"]), ...({ decision: approve ? "allow" : "deny", runKey: String(req["run"]) } as object) });
  return { status: approve ? "approved" : "denied" };
};

export const killAgentImpl: Implementation = async (tx, input, ctx): Promise<Outcome> => {
  const now = ctx.now();
  const id = String(input["agent"]);
  const p = (await tx.select("principal", { where: { principalId: id }, columns: ["kind", "status", "tenant"] }))[0];
  if (p === undefined || p["kind"] !== "agent") return { status: "not-an-agent" };
  const reason = String(input["reason"]);
  const disabled = await tx.update("principal", { status: "disabled", statusReason: reason, statusChangedAt: now }, { principalId: id, status: { ne: "disabled" } });
  let runs = 0;
  for (const r of await tx.select("agent run", { where: { agent: id, status: "running" }, columns: ["runId"] })) runs += await tx.update("agent run", { status: "killed", endedAt: now }, { runId: String(r["runId"]), status: "running" });
  let delegations = 0;
  for (const d of await tx.select("delegation", { where: { delegate: id, status: "active" }, columns: ["delegationId"] })) {
    const all = [String(d["delegationId"])];
    for (let i = 0; i < all.length; i++) for (const c of await tx.select("delegation", { where: { parent: all[i] as string }, columns: ["delegationId"] })) all.push(String(c["delegationId"]));
    for (const x of all) delegations += await tx.update("delegation", { status: "revoked", revokedAt: now, revokedBy: String(input["by"]), revokeReason: reason }, { delegationId: x, status: "active" });
  }
  const credentials = await tx.update("credential", { status: "revoked", revokedAt: now }, { principal: id, status: "active" });
  let approvals = 0;
  for (const a of await tx.select("approval request", { where: { agent: id, status: "pending" }, columns: ["approvalRequestId"] })) approvals += await tx.update("approval request", { status: "cancelled" }, { approvalRequestId: String(a["approvalRequestId"]), status: "pending" });
  if (disabled + runs + delegations + credentials + approvals === 0) return { status: "already-off" };
  await tx.audit({ action: "agent.killed", outcome: "success", actorKind: "user", actor: String(input["by"]), targetConcept: "principal", targetKey: id, reason });
  return { status: "killed", disabled, runs, delegations, credentials, approvals };
};

export const agentImplementations = { delegate: delegateImpl, revokeDelegation: revokeDelegationImpl, recordToolCall: recordToolCallImpl, decideApproval: decideApprovalImpl, killAgent: killAgentImpl } as const;
