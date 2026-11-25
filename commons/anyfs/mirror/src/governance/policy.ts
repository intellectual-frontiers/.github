// Spec: 0002-mirror-governance FR-001, FR-002
/**
 * What a mirror does when the primary has taken a change and a secondary has not: `record` answers as the primary did and notes the path as lagging, `report` notes it too and answers that the secondary did not take
 * the change, so that a caller that must know cannot miss it. The primary has taken the change in both cases: a mirror never undoes what its primary holds.
 *
 * @example
 * ```ts
 * import { DEFAULT_POLICY, describeFailurePolicy } from "./policy.ts";
 * describeFailurePolicy(DEFAULT_POLICY.onSecondaryFailure); // "answer as the primary did and record the path as lagging"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** What a mirror does when a secondary cannot take a change the primary took: a closed list. */
export const FAILURE_POLICIES = ["record", "report"] as const;
/** One of the ways to answer a secondary's failure. */
export type FailurePolicy = (typeof FAILURE_POLICIES)[number];

/** How a mirror behaves. */
export type MirrorPolicy = { readonly onSecondaryFailure: FailurePolicy };

/** `record`: the primary decides what the caller is told. */
export const DEFAULT_POLICY: MirrorPolicy = { onSecondaryFailure: "record" };

/** Whether a text names a way to answer a secondary's failure. */
export function isFailurePolicy(text: string): text is FailurePolicy {
  return (FAILURE_POLICIES as readonly string[]).includes(text);
}

/** A way to answer a secondary's failure, in a few words. */
export function describeFailurePolicy(policy: FailurePolicy): string {
  switch (policy) {
    case "record":
      return "answer as the primary did and record the path as lagging";
    case "report":
      return "record the path as lagging and answer that the secondary did not take the change";
    default:
      return absurd(policy);
  }
}
