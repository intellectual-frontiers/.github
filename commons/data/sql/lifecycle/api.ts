// Spec: 0011-sql-lifecycle FR-001
/**
 * The lifecycle of a physical schema (commons data 0011-sql-lifecycle): the state of a database as a hashed value, what differs between two states, the plan that moves one to the other with
 * each step classified, the ledger that records what was applied, and the run that applies it. This is the public surface of the unit; the strategies and features are extensions that use it.
 *
 * @module
 */
export { applyChange, applyChanges, type Change, type ChangeKind, diff, type TableRef } from "./change.ts";
export { canonical, hashOf, sha256Hex } from "./hash.ts";
export { chainOf, type ChainBreak, type EntryKind, GENESIS, type LedgerEntry, nextEntry, verifyChain } from "./ledger.ts";
export {
  type Desired,
  dueRepeatables,
  type ManualStep,
  plan,
  type Plan,
  type PlanContext,
  type PlanError,
  type PlanOptions,
  type Repeatable,
  type Reversibility,
  type Step,
  type StepClass,
  type StepDraft,
  type StepTransform,
} from "./plan.ts";
export { type Applied, type Driver, execute, ledgerDdl, readLedger, type RunError, type RunOptions } from "./run.ts";
export {
  canonicalState,
  emptyState,
  type State,
  type StateColumn,
  type StateConstraint,
  type StateOptions,
  type StateRow,
  type StateTable,
  snapshotOf,
  stateHash,
} from "./state.ts";
