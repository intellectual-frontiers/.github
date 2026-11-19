// Spec: 0031-operations FR-003
/**
 * Operations (commons data 0031-operations): the runtime that runs the business operations of a model, each in one transaction, with its input checked, its caller authorized, what it writes held to
 * what its contract says, and what it must record in the audit trail recorded with it. The operations of the identity model are in `./identity`.
 *
 * @module
 */
export {
  type Authorize,
  checkInput,
  defaultContext,
  type Implementation,
  type InputError,
  operations,
  type Outcome,
  type RunError,
  type Runtime,
  type RuntimeOptions,
  type SetupError,
} from "./runtime.ts";
export type { AuditEvent, AuditSink, Cell, Context, Row, Test, Tx, TxRefs, Where } from "./tx.ts";
