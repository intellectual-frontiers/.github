// Spec: 0042-identity-agent-operations FR-001
/**
 * The contracts of the operations of agents and delegation (commons data 0042-identity-agent-operations): what each takes, reads and writes, what it records, and who it runs as. They hold no SQL.
 * How they are done is `sql/extensions/operations/identity`.
 *
 * @module
 */
import { operation } from "@intellectual-frontiers/data/governance";

const opt = (type: "text" | "integer" | "instant" | "boolean" | "textList") => ({ type, optional: true }) as const;

/** Passes on some of what one principal may do to another, for a time, never more than the delegator holds and never more than the delegation above it passes on. */
export const delegate = operation("delegate", {
  checkedBy: "the caller is the delegator or may act for them, and the root is asked again",
  definition: "Passes on some of what one principal may do to another, for a time, never more than the delegator holds and never more than the delegation above it passes on",
  kind: "command",
  input: { tenant: "text", delegator: "text", delegate: "text", parent: opt("text"), purpose: "text", permissions: "textList", resourceType: opt("text"), resourceId: opt("text"), expression: opt("text"), redelegable: "boolean", maxDepth: "integer", expiresAt: "instant" },
  reads: ["delegation", "delegationPermission", "permission", "principal"],
  writes: ["delegation", "delegationPermission"],
  emits: ["delegation.created"],
  runsAs: "service",
  idempotent: false,
  serves: "0039-identity-delegation FR-001",
});

/** Ends a delegation and every delegation below it, at once. */
export const revokeDelegation = operation("revokeDelegation", {
  checkedBy: "the caller owns the delegation or may revoke it",
  definition: "Ends a delegation and every delegation below it, at once",
  kind: "command",
  input: { delegation: "text", revokedBy: "text", reason: "text" },
  reads: ["delegation"],
  writes: ["delegation"],
  emits: ["delegation.revoked"],
  runsAs: "service",
  idempotent: true,
  serves: "0039-identity-delegation FR-001",
});

/** Decides and records a call of a tool by an agent in a run: allowed only if the agent holds the tool, the delegation allows it, the run's budget has room, and a person has… */
export const recordToolCall = operation("recordToolCall", {
  checkedBy: "the decision engine allows the agent the tool, under its delegation, and its budgets have room",
  definition: "Decides and records a call of a tool by an agent in a run: allowed only if the agent holds the tool, the delegation allows it, the run's budget has room, and a person has approved it where it is risky",
  kind: "command",
  input: { run: "text", tool: "text", callIndex: "integer", argsHash: "text", argsSummary: opt("text"), resourceType: opt("text"), resourceId: opt("text"), approval: opt("text") },
  reads: ["agentRun", "agentVersion", "agent", "agentTool", "toolGrant", "permission", "principal", "delegation", "delegationPermission", "accessRole", "roleAssignment", "roleInheritance", "rolePermission", "groupMember", "accessPolicy", "principalAttribute", "attributeDefinition", "resourceAttribute", "entitlement", "relationTuple", "permissionRelation"],
  writes: ["toolCall", "agentBudget", "approvalRequest"],
  emits: ["tool.called"],
  runsAs: "service",
  idempotent: false,
  serves: "0040-identity-agent FR-004",
});

/** A person approves or refuses one action of an agent; only a person decides, and only one who may do the action themselves. */
export const decideApproval = operation("decideApproval", {
  checkedBy: "the decider answers for the agent and may do the thing themselves",
  definition: "A person approves or refuses one action of an agent; only a person decides, and only one who may do the action themselves",
  kind: "command",
  input: { approvalRequest: "text", decidedBy: "text", approve: "boolean", reason: opt("text") },
  reads: ["approvalRequest", "agentRun", "agent", "principal", "delegation", "roleAssignment"],
  writes: ["approvalRequest"],
  emits: ["approval.decided"],
  runsAs: "service",
  idempotent: false,
  serves: "0040-identity-agent FR-004",
});

/** Switches an agent off: it can do nothing, its runs stop, its delegations end, its credentials are revoked and what waits for approval is cancelled, in one transaction. */
export const killAgent = operation("killAgent", {
  checkedBy: "the caller answers for the agent or may switch it off",
  definition: "Switches an agent off: it can do nothing, its runs stop, its delegations end, its credentials are revoked and what waits for approval is cancelled, in one transaction",
  kind: "command",
  input: { agent: "text", by: "text", reason: "text" },
  reads: ["principal", "agentRun", "delegation", "credential", "approvalRequest"],
  writes: ["principal", "agentRun", "delegation", "credential", "approvalRequest"],
  emits: ["agent.killed"],
  runsAs: "service",
  idempotent: true,
  serves: "0040-identity-agent FR-001",
});

/** The operations of the agent model: delegate, revoke a delegation, record a tool call, decide an approval and kill an agent. */
export const agentOperations = [delegate, revokeDelegation, recordToolCall, decideApproval, killAgent] as const;
