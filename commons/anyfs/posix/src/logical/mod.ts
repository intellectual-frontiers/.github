// Spec: 0001-anyfs-posix-layers FR-001
/**
 * The Logical layer of AnyFS POSIX: the model it reasons with: the plan of each operation for the capabilities of a store, the table from a problem to a code, the directories derived from a list, the
 * mode of a name, the handles of open objects, the contract of the view and the reference model its conformance suite holds it to.
 *
 * @module
 */
export * from "./plan.ts";
export * from "./errno-table.ts";
export * from "./derive.ts";
export * from "./mode.ts";
export * from "./handles.ts";
export type { OpName } from "./store-ops.ts";
export type { Posix, PosixOptions } from "./posix.ts";
