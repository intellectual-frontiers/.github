// Spec: 0040-identity-agent FR-001, FR-002, FR-003, FR-004
/**
 * AI agents as a module (commons data 0040-identity-agent). An agent is a principal that decides for itself what to do, and so it is accountable to an owner, has a provenance (which model, which
 * prompt, which tools, at which version), has autonomy that is limited by a level, acts in runs under delegations, calls tools it has been granted, spends budgets that cannot be exceeded, and asks a
 * person before anything risky. A version of an agent can be revoked, which pulls a bad model, prompt or tool set from every run that uses it.
 *
 * @module
 */
import { type AnyConcept, codeOf, concept, defineModule, instant, integer, structured, text } from "@intellectual-frontiers/data/governance";
import { tenant } from "@intellectual-frontiers/data/models/arca-tenancy";
import { accessRole, permission, riskLevel, sideEffect } from "@intellectual-frontiers/data/models/identity-access";
import { delegation } from "@intellectual-frontiers/data/models/identity-delegation";
import { citing, confidential, internal, key, keep, list, lookup, maybe, one, opt, principal, req, unique, useStatus } from "@intellectual-frontiers/data/models/identity";

const cites = citing("0040-identity-agent");
export const autonomyLevel = list("autonomyLevel", "How much an agent may do without a person", { observe: "It may only read", suggest: "It may propose, and a person acts", actWithApproval: "It may act, and a person approves what is risky", autonomous: "It may act within its grants and budgets" });
export const versionStatus = list("versionStatus", "Where a version of an agent is", { candidate: "Made, not yet approved", approved: "Approved to run", active: "Running in production", retired: "No longer used", revoked: "Pulled: no run may start on it" });
export const runStatus = list("runStatus", "Where a run of an agent is", { running: "Running", succeeded: "Ended well", failed: "Ended badly", cancelled: "Stopped by its caller", killed: "Stopped by the kill switch", expired: "Ended because its time was up" });
export const toolApproval = list("toolApproval", "Whether a tool grant needs approval", { inherit: "As the risk of the tool and the agent's threshold say", always: "Every call needs approval" });
export const callDecision = list("callDecision", "What was decided about a tool call", { allowed: "It was allowed", denied: "It was refused", approvalRequired: "It waits for a person", budgetExceeded: "It would exceed a budget" });
export const callStatus = list("callStatus", "Where a tool call is", { requested: "Asked for", running: "Running", succeeded: "Ended well", failed: "Ended badly" });
export const meter = list("meter", "What a budget counts", { toolCalls: "Calls of tools", tokens: "Tokens of a model", costMicros: "Cost, in millionths of a currency unit", writes: "Calls that change something" });
export const windowKind = list("windowKind", "How long a budget lasts", { run: "One run", hour: "An hour", day: "A day of 24 hours", month: "A month", lifetime: "For good" });
export const approvalStatus = list("approvalStatus", "Where a request for approval is", { pending: "Waiting for a person", approved: "Approved, and not yet used", denied: "Refused", expired: "Left until it ran out", cancelled: "Withdrawn", consumed: "Approved and used once" });
export const approverRule = list("approverRule", "Who may approve", { owner: "The agent's owner", delegator: "The person the agent acts for", roleHolder: "A holder of a named role" });

/** An agent: a principal that decides for itself what to do, accountable to an owner. Its identity is its principal's. */
export const agent = concept("agent", {
  definition: "A program that decides for itself what to do, accountable to an owner and limited by its level of autonomy",
  attributes: {
    autonomy: req(codeOf(autonomyLevel), "How much it may do without a person"),
    purpose: req(text(), "What it is for"),
    framework: opt(text(), "What it is built with"),
    frameworkVersion: opt(text(), "The version of what it is built with"),
    provider: opt(text(), "Who runs it"),
    cardUrl: opt(text(), "Where its agent card is published"),
    approvalThreshold: req(codeOf(riskLevel), "The risk at or above which its calls need an approval"),
    maxDelegationDepth: req(integer(), "How many delegations deep it may act"),
    maxConcurrentRuns: opt(integer(), "How many runs it may have at once"),
  },
  identifiedBy: ["principal"],
  relationships: { principal: one(principal, "The principal the agent is"), sponsor: maybe(principal, "Who answers for its business use, where that is not its owner") },
  annotations: [confidential, cites("FR-001")],
});

/** A version of an agent: which model, which prompt and which tools, pinned. Revoking it pulls it from every run. */
export const agentVersion = concept("agentVersion", {
  definition: "A version of an agent: which model, which prompt and which tools, pinned, so that a bad one can be pulled from every run",
  attributes: {
    agentVersionId: key("the version"),
    versionLabel: req(text(), "What the version is called, unique for its agent"),
    modelProvider: req(text(), "Who makes the model"),
    modelName: req(text(), "The model"),
    modelVersion: req(text(), "The pinned snapshot of the model, never an alias that moves"),
    promptHash: req(text(), "A hash of the system prompt; the prompt is not kept here"),
    toolManifestHash: req(text(), "A hash of the tools it is given"),
    codeRef: opt(text(), "The commit of its code"),
    status: req(codeOf(versionStatus), "Where the version is"),
    approvedAt: opt(instant(), "When it was approved"),
    createdAt: req(instant(), "When it was made"),
    versionKey: req(text(), "A hash of the agent and the label, unique"),
  },
  identifiedBy: ["agentVersionId"],
  relationships: { agent: one(agent, "The agent"), approvedBy: maybe(principal, "Who approved it") },
  annotations: [internal, cites("FR-002"), unique("versionKey")],
});

/** A tool that agents may be granted: its name, what it needs, how risky it is. */
export const agentTool = concept("agentTool", {
  definition: "A tool that agents may be granted: what it is called, the permission a call needs, how risky it is",
  attributes: {
    agentToolId: key("the tool"),
    name: req(text(), "What the tool is called, unique within its tenant"),
    definition: req(text(), "What it does"),
    serverAudience: opt(text(), "The server or API it is on"),
    riskLevel: req(codeOf(riskLevel), "How much harm it can do"),
    sideEffect: req(codeOf(sideEffect), "What it does"),
    argsSchemaHash: opt(text(), "A hash of the schema of its arguments"),
    status: req(codeOf(useStatus), "Whether it is in use"),
  },
  identifiedBy: ["agentToolId"],
  relationships: { tenant: maybe(tenant, "The tenant it is for; empty for the platform's"), permission: one(permission, "The permission a call needs: one path for tools, APIs and screens") },
  annotations: [internal, cites("FR-003"), unique("name"), lookup("tenant")],
});

/** A tool that an agent has been granted, with a limit on its calls: never more than its owner may do. */
export const toolGrant = concept("toolGrant", {
  definition: "A tool that an agent has been granted, perhaps with a condition on its calls, never more than the agent's owner may do",
  attributes: {
    expression: opt(text(), "A condition on a call, over its arguments"),
    approval: req(codeOf(toolApproval), "Whether a call needs approval"),
    maxCallsPerRun: opt(integer(), "How many calls a run may make"),
    validTo: opt(instant(), "When the grant ends"),
    status: req(codeOf(useStatus), "Whether the grant is applied"),
  },
  identifiedBy: ["agent", "tool"],
  relationships: { agent: one(agent, "The agent"), tool: one(agentTool, "The tool"), grantedBy: one(principal, "Who granted it") },
  annotations: [confidential, cites("FR-003")],
});

/** A run of an agent: one task, in one version, perhaps under a delegation, perhaps started by another run. */
export const agentRun: AnyConcept = concept("agentRun", {
  definition: "One task of an agent, in one version, perhaps under a delegation, perhaps started by another run",
  attributes: {
    runId: key("the run"),
    startedAt: req(instant(), "When it started"),
    endedAt: opt(instant(), "When it ended"),
    status: req(codeOf(runStatus), "Where it is"),
    traceId: opt(text(), "The trace it is part of"),
    purpose: opt(text(), "What it is for"),
    inputHash: opt(text(), "A hash of its input"),
  },
  identifiedBy: ["runId"],
  relationships: {
    agent: one(agent, "The agent"),
    version: one(agentVersion, "The version it runs"),
    tenant: one(tenant, "The tenant it runs in"),
    initiator: maybe(principal, "Who started it"),
    delegation: maybe(delegation, "The delegation it acts under"),
    parentRun: maybe(() => agentRun, "The run that started it, for a sub-agent"),
  },
  annotations: [confidential, keep(365), cites("FR-004"), lookup("agent", "status")],
});

/** A call of a tool in a run: what was decided, and a hash of the arguments, never the arguments. */
export const toolCall: AnyConcept = concept("toolCall", {
  definition: "A call of a tool in a run: what was decided, and a hash of its arguments, never the arguments",
  attributes: {
    toolCallId: key("the call"),
    callIndex: req(integer(), "Which call of the run it is"),
    decision: req(codeOf(callDecision), "What was decided about it"),
    status: req(codeOf(callStatus), "Where it is"),
    argsHash: req(text(), "A hash of its arguments"),
    argsSummary: opt(text(), "What it asked for, redacted by the caller, never the raw arguments"),
    resourceType: opt(text(), "The kind of resource it was about"),
    resourceId: opt(text(), "The resource it was about"),
    resultHash: opt(text(), "A hash of its result"),
    denyReason: opt(text(), "Why it was refused"),
    policyRefs: opt(structured(), "The roles, policies and grants that decided"),
    tokensIn: opt(integer(), "Tokens sent to the model"),
    tokensOut: opt(integer(), "Tokens received from the model"),
    costMicros: opt(integer(), "What it cost, in millionths of a currency unit"),
    requestedAt: req(instant(), "When it was asked for"),
    completedAt: opt(instant(), "When it ended"),
    callKey: req(text(), "A hash of the run and the index, unique"),
  },
  identifiedBy: ["toolCallId"],
  relationships: { run: one(agentRun, "The run"), tool: one(agentTool, "The tool"), approval: maybe(() => approvalRequest, "The approval it was given") },
  annotations: [confidential, keep(365), cites("FR-004"), unique("callKey"), lookup("run")],
});

/** A budget: what an agent, under a delegation or in a run, may spend. A leaf: nothing refers to it, so it is updated in place. */
export const agentBudget = concept("agentBudget", {
  definition: "What an agent, under a delegation or in a run, may spend of a meter in a window; it cannot be exceeded",
  attributes: {
    budgetId: key("the budget"),
    meter: req(codeOf(meter), "What it counts"),
    windowKind: req(codeOf(windowKind), "How long it lasts"),
    limitValue: req(integer(), "How much may be spent"),
    used: req(integer(), "How much has been"),
    windowStart: req(instant(), "When the window began"),
    version: req(integer(), "Which update it has had, so that two updates cannot both win"),
    status: req(codeOf(useStatus), "Whether the budget is applied"),
    budgetKey: req(text(), "A hash of the agent, the delegation, the run, the meter and the window, unique"),
  },
  identifiedBy: ["budgetId"],
  relationships: { agent: one(agent, "The agent"), delegation: maybe(delegation, "The delegation it is for"), run: maybe(agentRun, "The run it is for") },
  annotations: [internal, cites("FR-004"), unique("budgetKey")],
});

/** A request for a person to approve one call, bound to a hash of its arguments, usable once. */
export const approvalRequest = concept("approvalRequest", {
  definition: "A request for a person to approve one action of an agent, bound to a hash of its arguments, usable once",
  attributes: {
    approvalRequestId: key("the request"),
    actionKey: req(text(), "The permission the action needs"),
    resourceType: opt(text(), "The kind of resource it is about"),
    resourceId: opt(text(), "The resource it is about"),
    argsHash: req(text(), "A hash of the arguments, so that an approval is for exactly this call"),
    summary: req(text(), "What will happen, redacted"),
    riskLevel: req(codeOf(riskLevel), "How risky it is"),
    approverRule: req(codeOf(approverRule), "Who may approve"),
    status: req(codeOf(approvalStatus), "Where the request is"),
    requestedAt: req(instant(), "When it was asked for"),
    expiresAt: req(instant(), "When it stops being valid"),
    decidedAt: opt(instant(), "When it was decided"),
    decisionReason: opt(text(), "Why it was decided so"),
    consumedAt: opt(instant(), "When it was used"),
  },
  identifiedBy: ["approvalRequestId"],
  relationships: {
    run: one(agentRun, "The run"),
    agent: one(principal, "The agent that asks"),
    approverRole: maybe(accessRole, "The role whose holders may approve, where the rule says so"),
    decidedBy: maybe(principal, "The person who decided"),
  },
  annotations: [confidential, keep(365), cites("FR-004"), lookup("run", "status")],
});

export const concepts: readonly AnyConcept[] = [agent, agentVersion, agentTool, toolGrant, agentRun, toolCall, agentBudget, approvalRequest];
export const identityAgentModule = defineModule({
  name: "identityAgent",
  definition: "AI agents: provenance, tools, runs, budgets and approvals",
  requires: ["identityDelegation"],
  concepts,
  codeLists: [autonomyLevel, versionStatus, runStatus, toolApproval, callDecision, callStatus, meter, windowKind, approvalStatus, approverRule],
});
