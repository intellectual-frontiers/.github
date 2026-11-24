// Spec: 0003-anyfs-posix-logical FR-004
/**
 * The mode of a name, made from what the store can do and what the program said about ownership: the bits of write are taken away where the store cannot be written, so that a store given as read-only
 * shows `0444` and `0555`. A mode is a statement of what the view will do, never a thing kept in the store, and `chmod` is refused.
 *
 * @example
 * ```ts
 * import { modeOf } from "./mode.ts";
 * import { DEFAULT_OWNERSHIP } from "@intellectual-frontiers/anyfs-posix/governance";
 * modeOf("file", new Set(["read", "list", "stat"] as const), DEFAULT_OWNERSHIP).toString(8); // "444"
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { FileType, Ownership } from "@intellectual-frontiers/anyfs-posix/governance";

const WRITE_BITS = 0o222;

/** The mode of a file or a directory in a store of capabilities. */
export function modeOf(type: FileType, capabilities: ReadonlySet<Capability>, ownership: Ownership): number {
  const base = type === "file" ? ownership.fileMode : ownership.dirMode;
  return capabilities.has("write") ? base : base & ~WRITE_BITS;
}
