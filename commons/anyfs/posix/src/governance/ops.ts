// Spec: 0002-anyfs-posix-governance FR-006
/**
 * The operations of the view, by how they are carried out: a closed list whose members are the operations with the cases that carry them out differently (a file is renamed one way, a file over another
 * file a second way and a directory a third). Each has one sentence, and the logical layer gives each its plan.
 *
 * @example
 * ```ts
 * import { OP_SUMMARY, isPlanOp } from "./ops.ts";
 * isPlanOp("rename-over"); // true
 * OP_SUMMARY["rm-r"]; // "remove a directory and everything below it"
 * ```
 *
 * @module
 */

/** The operations, in the order a program meets them. */
export const PLAN_OPS = [
  "stat-file",
  "stat-dir",
  "readdir",
  "mkdir",
  "rmdir",
  "unlink",
  "rename-file",
  "rename-over",
  "rename-dir",
  "read-all",
  "read-range",
  "write-all",
  "open-write",
  "write",
  "fsync",
  "close",
  "truncate",
  "append",
  "touch",
  "rm-r",
  "chmod",
  "chown",
  "utimes",
  "symlink",
  "link",
  "readlink",
  "mmap",
] as const;
/** One operation. */
export type PlanOp = (typeof PLAN_OPS)[number];

/** What each operation does, in a sentence. */
export const OP_SUMMARY: Readonly<Record<PlanOp, string>> = {
  "stat-file": "the size, the mode and the revision of an object",
  "stat-dir": "whether a directory exists, and its mode",
  readdir: "the names below a directory",
  mkdir: "make a directory",
  rmdir: "remove an empty directory",
  unlink: "remove an object",
  "rename-file": "move an object to a name that is free",
  "rename-over": "move an object over another object",
  "rename-dir": "move a directory and everything below it",
  "read-all": "read a whole object",
  "read-range": "read a part of an object",
  "write-all": "make or replace an object with its whole bytes",
  "open-write": "open an object to be written",
  write: "write into an open object",
  fsync: "put what an open object holds in the store",
  close: "put what an open object holds in the store and let it go",
  truncate: "change the length of an object",
  append: "add bytes to the end of an object",
  touch: "make an empty object, or leave the time of one that exists",
  "rm-r": "remove a directory and everything below it",
  chmod: "change the mode of an object",
  chown: "change the owner of an object",
  utimes: "change the times of an object",
  symlink: "make a link that names another path",
  link: "make a second name for an object",
  readlink: "read the path a link names",
  mmap: "map an object into memory",
};

/** Whether a text is the name of an operation. */
export function isPlanOp(text: string): text is PlanOp {
  return (PLAN_OPS as readonly string[]).includes(text);
}
