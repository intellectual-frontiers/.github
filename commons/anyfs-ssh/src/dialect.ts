// Spec: 0002-anyfs-ssh-helper FR-002
/**
 * The dialects of the helper, as a closed union: the language of the shell on the host. The posix dialect is a script for any shell of POSIX; a dialect for the hosts that have PowerShell is a later
 * member of the union, and a function that takes a `HostDialect` states every case, so adding it is a compile error where a case is missing and nowhere else.
 *
 * @example
 * ```ts
 * import { helperOf, POSIX } from "./dialect.ts";
 * helperOf(POSIX).sha256.length; // 64
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { POSIX_HELPER, POSIX_HELPER_SHA256 } from "./helper/posix.ts";

/** The shell language of a host: a closed union with one member today. */
export type HostDialect = { readonly kind: "posix" };

/** The posix dialect. */
export const POSIX: HostDialect = { kind: "posix" };

/** A helper: the script that runs on the host, its SHA-256 in hex and the program that runs it. */
export type Helper = { readonly dialect: HostDialect; readonly text: string; readonly sha256: string; readonly shell: string };

/** The helper of a dialect. */
export function helperOf(dialect: HostDialect): Helper {
  switch (dialect.kind) {
    case "posix":
      return { dialect, text: POSIX_HELPER, sha256: POSIX_HELPER_SHA256, shell: "sh" };
    default:
      return absurd(dialect.kind);
  }
}
