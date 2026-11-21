// Spec: 0001-anyfs-posix-layers FR-001
/**
 * The Physical layer of AnyFS POSIX: what carries an operation out against a store, through the handler of the store and nothing else.
 *
 * @module
 */
export { posix, type Viewable } from "./posix.ts";
export { ReadCache } from "./cache.ts";
