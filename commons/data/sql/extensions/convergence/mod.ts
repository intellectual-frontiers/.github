// Spec: 0019-sql-convergence FR-001
/**
 * The convergence strategy (commons data 0019-sql-convergence): the plan from the state a database is in, read from its own catalog, to the state wanted. Reviewed: a pinned proposal a person
 * approves by its hash. Autonomous: applied on first access where a policy allows every step, held for a person where it does not. A version gate refuses an application whose database is not in
 * the state it expects.
 *
 * @module
 */
export { connect, type ConnectOptions, type ConnectResult, type GateError, versionGate } from "./connect.ts";
export {
  applyProposal,
  type ApplyError,
  desiredState,
  propose,
  type Proposal,
  type ProposalStep,
  type ProposeError,
  type ProposeOptions,
  proposalText,
  renderProposal,
} from "./propose.ts";
export { HOLD, normalDefault, normalizeType, readState, type ReadError, sameType, spell } from "./read.ts";
export { type Convergence, type ConvergenceSettings, defaultPolicy, type Policy, settingsOf } from "./settings.ts";
export type { Held } from "./plan.ts";
