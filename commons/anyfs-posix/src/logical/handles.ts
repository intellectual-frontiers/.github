// Spec: 0003-anyfs-posix-logical FR-006
/**
 * The handles of the view: what an open object holds, and the table that gives each a number. An object is written through a buffer that holds the whole of it (a store puts whole objects), so a handle
 * has the bytes it read at open, the revision they were at (or that there was none), where the next read or write is and whether anything was written. The table is a value a program passes to the
 * view; there is no table in the process.
 *
 * @example
 * ```ts
 * import { newHandleTable, writeAt } from "./handles.ts";
 * writeAt(new Uint8Array([1, 2]), 4, new Uint8Array([9])).length; // 5: the gap is zeros
 * ```
 *
 * @module
 */
import type { Path, Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Fd, OpenFlags, PosixPath } from "@intellectual-frontiers/anyfs-posix/governance";

/** What an open object was when it was read: no object, or the object at a revision. */
export type Base = { readonly kind: "absent" } | { readonly kind: "rev"; readonly rev: Revision };

/** An open object. Its fields change as it is read and written, and only the view changes them. */
export type OpenFile = {
  readonly fd: Fd;
  readonly path: PosixPath;
  readonly storePath: Path;
  readonly flags: OpenFlags;
  base: Base;
  bytes: Uint8Array;
  position: number;
  dirty: boolean;
};

/** The open objects, by number. */
export type HandleTable = {
  /** Opens an object and gives its number. */
  open(file: Omit<OpenFile, "fd">): Fd;
  get(fd: Fd): OpenFile | undefined;
  /** Lets a number go. */
  release(fd: Fd): void;
  /** How many are open. */
  readonly size: number;
};

/** A table with nothing open. Numbers start at 3, as a process's do after its three standard streams. */
export function newHandleTable(): HandleTable {
  const files = new Map<number, OpenFile>();
  let next = 3;
  return {
    open(file) {
      const fd = next++ as Fd;
      files.set(fd, { ...file, fd });
      return fd;
    },
    get: (fd) => files.get(fd),
    release(fd) {
      files.delete(fd);
    },
    get size() {
      return files.size;
    },
  };
}

/** The bytes with some written at an offset: past the end, the gap is zeros. */
export function writeAt(bytes: Uint8Array, offset: number, data: Uint8Array): Uint8Array {
  const length = Math.max(bytes.length, offset + data.length);
  const out = new Uint8Array(length);
  out.set(bytes, 0);
  out.set(data, offset);
  return out;
}

/** The bytes made as long as asked: cut where longer, and padded with zeros where shorter. */
export function resize(bytes: Uint8Array, length: number): Uint8Array {
  if (length === bytes.length) return bytes;
  const out = new Uint8Array(length);
  out.set(bytes.subarray(0, Math.min(length, bytes.length)), 0);
  return out;
}

/** The bytes with others added at the end. */
export function concat(bytes: Uint8Array, more: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length + more.length);
  out.set(bytes, 0);
  out.set(more, bytes.length);
  return out;
}
