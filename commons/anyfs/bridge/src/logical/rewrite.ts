// Spec: 0002-bridge-plans FR-007
/**
 * The rules that map the path of a file at the source to its path at the destination, as pure functions with a reason where they cannot: put a prefix before every path, take one off, fold the case,
 * and run one rule after another.
 *
 * @example
 * ```ts
 * import { addPrefix } from "./rewrite.ts";
 * // addPrefix("backup") maps "a/b" to "backup/a/b"
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { parsePath, type Prefix, relativeTo } from "@intellectual-frontiers/anyfs/governance";
import type { Rewrite } from "./inventory.ts";

/** Puts a prefix before every path. */
export const addPrefix = (prefix: Prefix): Rewrite => (rel) => (prefix === "" ? ok(rel) : parsePath(`${prefix}/${rel}`));

/** Takes a prefix off every path; a path that is not under it cannot be rewritten. */
export const stripPrefix = (prefix: Prefix): Rewrite => (rel) => {
  const rest = relativeTo(prefix, rel);
  return rest === undefined ? err(`it is not under ${prefix}`) : ok(rest);
};

/** Folds every path to lower case. */
export const lowerCase: Rewrite = (rel) => parsePath(rel.toLowerCase());

/** One rule after another: the first that cannot make a path is the reason. */
export const compose = (...rules: readonly Rewrite[]): Rewrite => (rel) => {
  let current = ok(rel) as ReturnType<Rewrite>;
  for (const rule of rules) {
    if (current.kind === "err") return current;
    current = rule(current.value);
  }
  return current;
};
