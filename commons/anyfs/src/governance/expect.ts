// Spec: 0002-anyfs-governance FR-004
/**
 * What a write or a delete expects of the object it changes: any state, no object, or the object at one revision. The expectation is part of every change, so that two writers who do not know of
 * each other cannot silently overwrite one another. Whether a store accepts a revision is in its type: `ExpectFor` names the expectations a store of some capabilities takes.
 *
 * @example
 * ```ts
 * import { expectAbsent, expectAny } from "./expect.ts";
 * expectAny.kind; // "any"
 * expectAbsent.kind; // "absent"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Capability } from "./capability.ts";
import type { Revision } from "./revision.ts";

/** What a change expects of the object: any state, no object, or one revision. */
export type Expect = { readonly kind: "any" } | { readonly kind: "absent" } | { readonly kind: "rev"; readonly rev: Revision };

/** Expect nothing: make or replace. */
export const expectAny = { kind: "any" } as const satisfies Expect;
/** Expect no object: make it only where it is absent. */
export const expectAbsent = { kind: "absent" } as const satisfies Expect;
/** Expect the object at a revision. */
export const expectRev = (rev: Revision): Expect => ({ kind: "rev", rev });

/** The expectations a store of capabilities `C` takes: a revision only where `C` has `cas`. */
export type ExpectFor<C extends Capability> = "cas" extends C ? Expect : Exclude<Expect, { readonly kind: "rev" }>;

/** An expectation in a few words. */
export function describeExpect(expect: Expect): string {
  switch (expect.kind) {
    case "any":
      return "any state";
    case "absent":
      return "no object";
    case "rev":
      return `revision ${expect.rev}`;
    default:
      return absurd(expect);
  }
}
