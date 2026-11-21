// Spec: 0002-tenancy FR-005
/**
 * Who answers for a requirement (0002-tenancy FR-005): the client, the operator, both, or a provider that the client inherits it from (a cloud, a hosting service). A matrix of these is what a client hands an assessor beside its plan, and what an operator needs to know which
 * evidence is its own to give.
 *
 * @example
 * ```ts
 * import { WHO } from "./responsibility.ts";
 * WHO; // ["client", "operator", "shared", "inherited"]
 * ```
 *
 * @module
 */

/** Who answers for a requirement. */
export const WHO = ["client", "operator", "shared", "inherited"] as const;
/** A responsibility holder. */
export type Who = (typeof WHO)[number];

/** One statement of responsibility for a requirement of a framework. */
export type Responsibility = {
  readonly framework: string;
  readonly requirement: string;
  readonly who: Who;
  /** For `inherited`: the party that provides it (a provider's id). */
  readonly provider?: string;
  /** For `shared`: what each side does. */
  readonly note?: string;
};
