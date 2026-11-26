// Spec: 0002-package-managers-governance FR-001, FR-002, FR-003
/**
 * What a package manager is to this library, as data: the operations of it that a dialect uses, the command of one operation as a template of words the packaging ontology states, how a manager writes
 * an exact version, and the form a package name and a version must have to be put in a command. None of it runs anything.
 *
 * @example
 * ```ts
 * import { isSafeName } from "./commands.ts";
 * isSafeName("xz-utils"); // true
 * isSafeName("-rf"); // false
 * ```
 *
 * @module
 */

/** The operations of a manager that a dialect uses. */
export const OPERATIONS = ["Install", "QueryInstalled", "QueryVersion", "Refresh"] as const;

/**
 * One operation of a package manager that a dialect uses: install a package, ask whether one is installed, ask its version, or refresh the index.
 *
 * @example
 * ```ts
 * import type { Operation } from "./commands.ts";
 * const op: Operation = "QueryVersion";
 * ```
 */
export type Operation = (typeof OPERATIONS)[number];

/** One command of a manager, as the packaging ontology states it. */
export type CommandSpec = {
  readonly manager: string;
  readonly executable: string;
  /** A `NAME=value` the command runs with, where the manager needs one. */
  readonly environment?: string;
  readonly needsAdministrator: boolean;
  /** The words of the command, with `{packages}` or `{package}` where the names go. */
  readonly template: string;
  /** The form that asks nothing of a person; the template where there is none. */
  readonly nonInteractive?: string;
  /** Whether the ontology carries a date and a place it was tried (`pm:verifiedOn`). */
  readonly verified: boolean;
};

/** How a manager writes an exact version: joined to the name (`pkg=1.2`, `pkg@1.2`), as flags after the name (`--id pkg --exact --version 1.2`), or not at all. */
export type Versioning =
  | { readonly kind: "joined"; readonly joiner: "=" | "@" | "-" }
  | { readonly kind: "flags"; readonly packageFlags: readonly string[]; readonly exactFlags: readonly string[]; readonly versionFlag: string }
  | { readonly kind: "none"; readonly reason: string };

/** A package name safe to put in a command: it starts with a letter or a digit, never a dash, so that it cannot be taken for an option. */
export function isSafeName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9+._@:/-]*$/.test(name) && !name.includes("..") && name.length <= 200;
}

/** A version safe to put in a command. */
export function isSafeVersion(version: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9+._:~-]*$/.test(version) && version.length <= 100;
}
