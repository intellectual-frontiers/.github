// Spec: 0041-identity-authorize FR-001
/**
 * The operations of the identity model (commons data 0041-identity-authorize, 0042-identity-agent-operations): the decision engine, the expression language of policies, the audit trail in a chain,
 * and the operations of delegation and agents.
 *
 * @module
 */
export { agentImplementations } from "./agent.ts";
export { type ChainProblem, GENESIS, type IdentityAuditEvent, identityAuditSink, verifyAuditChain } from "./audit.ts";
export { type Decision, decide, identityAuthorize, matches, type Request } from "./decide.ts";
export { checkExpr, evaluate, type Expr, type Truth } from "./expr.ts";
