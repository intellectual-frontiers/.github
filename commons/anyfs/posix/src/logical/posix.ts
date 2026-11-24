// Spec: 0003-anyfs-posix-logical FR-007
/**
 * The view as a type: what a program that treats a store as a file system holds. Every operation takes text paths (resolved against the working directory the view holds), ends with a `Result` of an
 * outcome or an error, and says how it was carried out. The type is the contract the command line, the servers and a mount are written against; `posix` of the physical layer makes one from a store.
 *
 * @example
 * ```ts
 * import type { Posix } from "./posix.ts";
 * // declare const view: Posix; const r = await view.readFile("/fleet/olympia.json"); r.kind === "ok" && r.value.fidelity.kind // "native"
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { Counted, Done, DirEntry, Fd, OpenMode, PlanOp, PosixError, PosixPath, PosixStat, Policy } from "@intellectual-frontiers/anyfs-posix/governance";
import type { HandleTable } from "./handles.ts";
import type { Plan } from "./plan.ts";

/** What a view is made with: the policy, the working directory and the table of handles; each is a value of its own. */
export type PosixOptions = { readonly policy?: Policy; readonly cwd?: PosixPath; readonly handles?: HandleTable };

/** The view of a store as a file system. */
export type Posix = {
  /** The id of the store. */
  readonly store: string;
  readonly cwd: PosixPath;
  readonly policy: Policy;
  readonly capabilities: ReadonlySet<Capability>;
  /** A view of the same store with another working directory: the text is resolved and nothing is read. */
  withCwd(path: string): Result<Posix, PosixError>;
  /** How an operation would be carried out on this store, without running it. */
  explain(op: PlanOp): Plan;

  stat(path: string): Done<PosixStat>;
  /** A name is never a link here, so this is `stat`. */
  lstat(path: string): Done<PosixStat>;
  readdir(path: string): Done<readonly DirEntry[]>;
  mkdir(path: string, options?: { readonly parents?: boolean }): Done<void>;
  rmdir(path: string): Done<void>;
  unlink(path: string): Done<void>;
  rename(from: string, to: string): Done<void>;
  readFile(path: string): Done<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array, options?: { readonly exclusive?: boolean }): Done<void>;
  open(path: string, mode: OpenMode): Done<Fd>;
  read(fd: Fd, length: number, position?: number): Done<Uint8Array>;
  write(fd: Fd, bytes: Uint8Array, position?: number): Done<number>;
  fsync(fd: Fd): Done<void>;
  close(fd: Fd): Done<void>;
  ftruncate(fd: Fd, length: number): Done<void>;
  truncate(path: string, length: number): Done<void>;
  appendFile(path: string, bytes: Uint8Array): Done<void>;
  touch(path: string): Done<void>;
  /** Removes a directory and everything below it, or an object. */
  removeAll(path: string): Done<Counted>;
  chmod(path: string, mode: number): Done<never>;
  chown(path: string, uid: number, gid: number): Done<never>;
  utimes(path: string, atime: Date, mtime: Date): Done<never>;
  symlink(target: string, path: string): Done<never>;
  link(existing: string, path: string): Done<never>;
  readlink(path: string): Done<never>;
  mmap(fd: Fd): Done<never>;
};
