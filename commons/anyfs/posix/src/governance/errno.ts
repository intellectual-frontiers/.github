// Spec: 0002-anyfs-posix-governance FR-001
/**
 * The codes a POSIX operation ends with, as a closed union: the fifteen a store can give cause for, each with the number Linux gives it and one sentence. A program that reads the code of an error
 * (`ENOENT`, `ESTALE`) reads what a local file system would have said, so that what it does about it is the same on every store.
 *
 * @example
 * ```ts
 * import { ERRNO_NUMBER, describeErrno } from "./errno.ts";
 * ERRNO_NUMBER.ENOENT; // 2
 * describeErrno("ESTALE"); // "the object changed since it was read"
 * ```
 *
 * @module
 */

/** The codes, in the order of their names. */
export const ERRNOS = ["EACCES", "EBADF", "EEXIST", "EFBIG", "EINVAL", "EIO", "EISDIR", "ENAMETOOLONG", "ENOENT", "ENOTDIR", "ENOTEMPTY", "ENOTSUP", "EROFS", "ESTALE", "EXDEV"] as const;
/** One code. */
export type Errno = (typeof ERRNOS)[number];

/** The number Linux gives each code: a registry with one entry for each code, which the compiler holds. */
export const ERRNO_NUMBER: Readonly<Record<Errno, number>> = {
  EACCES: 13,
  EBADF: 9,
  EEXIST: 17,
  EFBIG: 27,
  EINVAL: 22,
  EIO: 5,
  EISDIR: 21,
  ENAMETOOLONG: 36,
  ENOENT: 2,
  ENOTDIR: 20,
  ENOTEMPTY: 39,
  ENOTSUP: 95,
  EROFS: 30,
  ESTALE: 116,
  EXDEV: 18,
};

/** What each code says, in a sentence. */
export const ERRNO_SUMMARY: Readonly<Record<Errno, string>> = {
  EACCES: "the store does not allow it",
  EBADF: "the handle is not open, or not open for that",
  EEXIST: "there is already something there",
  EFBIG: "the object is larger than the store holds",
  EINVAL: "the argument is not one the operation takes",
  EIO: "the store could not do it",
  EISDIR: "it is a directory",
  ENAMETOOLONG: "a name or a path is too long for the store",
  ENOENT: "there is nothing there",
  ENOTDIR: "a name on the way is not a directory",
  ENOTEMPTY: "the directory is not empty",
  ENOTSUP: "the store has no way to do it",
  EROFS: "the store is read-only",
  ESTALE: "the object changed since it was read",
  EXDEV: "it would cross from one store to another",
};

/** Whether a text is the name of a code. */
export function isErrno(text: string): text is Errno {
  return (ERRNOS as readonly string[]).includes(text);
}

/** A code in a few words: its name and what it says. */
export function describeErrno(errno: Errno): string {
  return ERRNO_SUMMARY[errno];
}
