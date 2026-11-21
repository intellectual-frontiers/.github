// Spec: 0002-anyfs-governance FR-005, FR-006
/**
 * What a store can do, as a closed union: five core capabilities every store has and nine optional ones a store says it has, each with one sentence. The capabilities of a store are in its type, so
 * that code which needs one cannot be given a store without it. A store also declares how consistent it is and two traits that code cannot discover any other way.
 *
 * @example
 * ```ts
 * import { isCapability } from "./capability.ts";
 * isCapability("cas"); // true
 * isCapability("chmod"); // false
 * ```
 *
 * @module
 */

/** The capabilities every store has. */
export const CORE_CAPABILITIES = ["read", "write", "list", "stat", "delete"] as const;
/** The capabilities a store may have. */
export const OPTIONAL_CAPABILITIES = ["cas", "batch", "rename", "watch", "lock", "history", "rangeRead", "append", "search", "merge"] as const;
/** Every capability, the core ones first. */
export const CAPABILITIES = [...CORE_CAPABILITIES, ...OPTIONAL_CAPABILITIES] as const;

/** One of the core capabilities. */
export type CoreCapability = (typeof CORE_CAPABILITIES)[number];
/** One capability of a store: a closed union. */
export type Capability = (typeof CAPABILITIES)[number];

/** What each capability adds, in a sentence: a registry with one entry for each capability, which the compiler holds. */
export const CAPABILITY_SUMMARY: Readonly<Record<Capability, string>> = {
  read: "read the bytes of an object with its revision",
  write: "make or replace an object, or make it only where it is absent",
  list: "list the objects below a prefix, in the order of their paths, in pages",
  stat: "learn the size and the revision of an object without its bytes",
  delete: "remove an object, and succeed where it is already gone",
  cas: "write or delete an object only where its revision is the one expected",
  batch: "make several changes as one, all or none",
  rename: "move an object to a path where there is none, as one change",
  watch: "be told when an object below a prefix changes",
  lock: "hold an object so that no other writer changes it",
  history: "list the earlier revisions of an object",
  rangeRead: "read a part of an object",
  append: "add bytes to the end of an object",
  search: "find objects by what they hold",
  merge: "take the changes of another replica and give one's own, so that any two replicas converge to the same state in any order",
};

/** Whether a text is the name of a capability. */
export function isCapability(text: string): text is Capability {
  return (CAPABILITIES as readonly string[]).includes(text);
}

/** How consistent a store is: `strong` (every read sees the last write and a list sees every object), `read-your-writes` (a writer sees its own writes) `eventual-listing` (a list may lag behind the objects) or `eventual-merge` (a replica holds what it has made and taken, and every two replicas that have taken each other's changes hold the same). */
export const CONSISTENCIES = ["strong", "read-your-writes", "eventual-listing", "eventual-merge"] as const;
/** One way a store is consistent. */
export type Consistency = (typeof CONSISTENCIES)[number];

/** What a caller cannot discover any other way: whether the store tells paths apart by case, and the largest object it holds where it has a limit (in bytes). */
export type Traits = { readonly caseSensitive: boolean; readonly maxObject?: number };
