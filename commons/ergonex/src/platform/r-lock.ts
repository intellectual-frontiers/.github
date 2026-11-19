// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `lock`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { lock } from "@intellectual-frontiers/commons/ts/runtime";
/** `lock.acquireLock`. */
export const acquireLock = lock.acquireLock;
/** `lock.describeHolder`. */
export const describeHolder = lock.describeHolder;
/** `lock.readHolder`. */
export const readHolder = lock.readHolder;
