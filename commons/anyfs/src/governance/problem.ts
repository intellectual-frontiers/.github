// Spec: 0002-anyfs-governance FR-008
/**
 * What a store reports when it does not do what it was asked: five kinds of problem, a closed union, each a value with one sentence. A conflict is not an error of the store: it is the answer to a
 * write whose expectation did not hold, and says what was expected and what was found.
 *
 * @example
 * ```ts
 * import { describeProblem, missing } from "./problem.ts";
 * import { parsePath } from "./path.ts";
 * const p = parsePath("a");
 * p.kind === "ok" && describeProblem(missing(p.value)); // "a is not in the store"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { describeExpect, type Expect } from "./expect.ts";
import type { Path } from "./path.ts";
import type { Revision } from "./revision.ts";

/** Why a store refused an operation: a closed list. */
export const REFUSALS = ["read-only", "outside-scope", "unsupported-expectation", "capability-absent", "too-large", "unportable-path", "consent"] as const;
/** One reason for a refusal. */
export type Refusal = (typeof REFUSALS)[number];

/** What a conflict found at the path: no object, or one at a revision. */
export type Found = { readonly kind: "absent" } | { readonly kind: "rev"; readonly rev: Revision };

/** What a store reports: a closed union of five kinds. */
export type Problem =
  | { readonly kind: "missing"; readonly path: Path }
  | { readonly kind: "conflict"; readonly path: Path; readonly expected: Expect; readonly found: Found }
  | { readonly kind: "refused"; readonly reason: Refusal; readonly detail: string; readonly path?: Path }
  | { readonly kind: "unavailable"; readonly detail: string; readonly retryable: boolean; readonly path?: Path }
  | { readonly kind: "tampered"; readonly path: Path; readonly detail: string };

/** There is no object at the path. */
export const missing = (path: Path): Problem => ({ kind: "missing", path });
/** The object was not as the write expected. */
export const conflict = (path: Path, expected: Expect, found: Found): Problem => ({ kind: "conflict", path, expected, found });
/** The store will not do it, and says why. */
export const refused = (reason: Refusal, detail: string, path?: Path): Problem => (path === undefined ? { kind: "refused", reason, detail } : { kind: "refused", reason, detail, path });
/** The store could not do it now; a retry may succeed where `retryable`. */
export const unavailable = (detail: string, retryable: boolean, path?: Path): Problem => (path === undefined ? { kind: "unavailable", detail, retryable } : { kind: "unavailable", detail, retryable, path });
/** The bytes are not what their revision says they are. */
export const tampered = (path: Path, detail: string): Problem => ({ kind: "tampered", path, detail });

const found = (f: Found): string => (f.kind === "absent" ? "no object" : `revision ${f.rev}`);

/** A problem as one sentence. */
export function describeProblem(problem: Problem): string {
  switch (problem.kind) {
    case "missing":
      return `${problem.path} is not in the store`;
    case "conflict":
      return `${problem.path} was expected to be at ${describeExpect(problem.expected)} and is at ${found(problem.found)}`;
    case "refused":
      return `${problem.path === undefined ? "the store" : problem.path} refused it (${problem.reason}): ${problem.detail}`;
    case "unavailable":
      return `${problem.path === undefined ? "the store" : problem.path} is unavailable${problem.retryable ? " now" : ""}: ${problem.detail}`;
    case "tampered":
      return `${problem.path} is not what its revision says: ${problem.detail}`;
    default:
      return absurd(problem);
  }
}
