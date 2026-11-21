// Spec: 0002-anyfs-posix-governance FR-007
/**
 * What the operations of the view are given and give back: the kind of a name, what a stat says, an entry of a directory, the modes an object is opened in, the number of an open object and what an
 * operation ends with. A result is a `Result` of an outcome (the value, how it was carried out, and what the operation noticed on the way) or of an error with a code, one sentence and how the
 * operation would have been carried out, so that nothing a program reads is a guess.
 *
 * @example
 * ```ts
 * import { openFlags } from "./types.ts";
 * openFlags("a").append; // true
 * ```
 *
 * @module
 */
import { absurd, type Brand, type Result } from "@intellectual-frontiers/core";
import type { Path, Problem, Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Errno } from "./errno.ts";
import type { Fidelity } from "./fidelity.ts";
import type { PosixPath } from "./posix-path.ts";

/** What a name is: a file (an object) or a directory (a prefix). */
export type FileType = "file" | "dir";

/** What a stat says. A file has the size and the revision of its object and the time the store gives; a directory has no size. */
export type PosixStat = {
  readonly type: FileType;
  readonly size: number;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly mtime?: string;
  readonly rev?: Revision;
};

/** One name in a directory. A file has its size, its revision and its time. */
export type DirEntry = { readonly name: string; readonly type: FileType; readonly size?: number; readonly rev?: Revision; readonly mtime?: string };

/** The modes an object is opened in, as a file system names them: read, read and write, make and write, make and read and write, make where none is, add to the end, and add to the end and read. */
export const OPEN_MODES = ["r", "r+", "w", "w+", "wx", "a", "a+"] as const;
/** One mode. */
export type OpenMode = (typeof OPEN_MODES)[number];

/** What a mode means, as flags. */
export type OpenFlags = { readonly read: boolean; readonly write: boolean; readonly create: boolean; readonly exclusive: boolean; readonly truncate: boolean; readonly append: boolean };

/** The flags of a mode. */
export function openFlags(mode: OpenMode): OpenFlags {
  switch (mode) {
    case "r":
      return { read: true, write: false, create: false, exclusive: false, truncate: false, append: false };
    case "r+":
      return { read: true, write: true, create: false, exclusive: false, truncate: false, append: false };
    case "w":
      return { read: false, write: true, create: true, exclusive: false, truncate: true, append: false };
    case "w+":
      return { read: true, write: true, create: true, exclusive: false, truncate: true, append: false };
    case "wx":
      return { read: false, write: true, create: true, exclusive: true, truncate: true, append: false };
    case "a":
      return { read: false, write: true, create: true, exclusive: false, truncate: false, append: true };
    case "a+":
      return { read: true, write: true, create: true, exclusive: false, truncate: false, append: true };
    default:
      return absurd(mode);
  }
}

/** The number of an open object. Made only by the table of handles. */
export type Fd = Brand<number, "anyfs posix fd">;

/** What a walk over many objects did: those it did and those it could not. */
export type PartialReport = { readonly done: readonly PosixPath[]; readonly failed: readonly { readonly path: PosixPath; readonly errno: Errno }[] };

/** What an operation ends with where it did not do what it was asked. */
export type PosixError = {
  readonly errno: Errno;
  readonly message: string;
  readonly path?: PosixPath;
  /** How the operation would have been carried out. */
  readonly fidelity: Fidelity;
  /** What the store said, where it said it. */
  readonly problem?: Problem;
  /** What a walk did before it failed, where it was one. */
  readonly report?: PartialReport;
};

/** What an operation did: its value, how it was carried out, and what it noticed on the way. */
export type Outcome<T> = { readonly value: T; readonly fidelity: Fidelity; readonly notes: readonly string[] };

/** What every operation of the view ends with. */
export type Done<T> = Promise<Result<Outcome<T>, PosixError>>;

/** What a directory that was removed or a walk that was run says it did. */
export type Counted = { readonly count: number };

/** A key and the path it is shown at, for a walk. */
export type Located = { readonly path: Path; readonly shown: PosixPath };
