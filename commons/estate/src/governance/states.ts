// Spec: 0002-estate-governance FR-002, FR-003
/**
 * What each state of an asset offers, as data, and the reason a state does not offer a capability; and the moves between states that are allowed. A discovered asset is only observed, an adopted
 * asset is observed, verified and reached but not changed, and a managed asset offers every capability.
 *
 * @example
 * ```ts
 * import { offers, reasonNotOffered } from "./states.ts";
 * offers("adopted", "converge"); // false
 * reasonNotOffered("adopted", "converge"); // "an adopted asset is observed and verified, never changed"
 * ```
 *
 * @module
 */
import { CAPABILITIES, type AssetState, type Capability } from "./ids.ts";

/** The capabilities each state offers. */
export const OFFERED: Readonly<Record<AssetState, readonly Capability[]>> = {
  discovered: ["observe"],
  adopted: ["observe", "verify", "access"],
  managed: [...CAPABILITIES],
};

/** The reason a state does not offer a capability. */
const REASON: Readonly<Record<AssetState, string>> = {
  discovered: "a discovered asset is only observed: nobody has adopted it",
  adopted: "an adopted asset is observed and verified, never changed",
  managed: "a managed asset offers every capability",
};

/** Whether a state offers a capability. */
export function offers(state: AssetState, capability: Capability): boolean {
  return OFFERED[state].includes(capability);
}

/** The reason a state does not offer a capability; nothing where it does. */
export function reasonNotOffered(state: AssetState, capability: Capability): string | undefined {
  return offers(state, capability) ? undefined : REASON[state];
}

/** The moves between states that are allowed: an asset is adopted, then managed, and released back the same way. */
export const TRANSITIONS: readonly (readonly [AssetState, AssetState])[] = [
  ["discovered", "adopted"],
  ["adopted", "managed"],
  ["managed", "adopted"],
  ["adopted", "discovered"],
];

/** Whether an asset may move from one state to another. */
export function mayMove(from: AssetState, to: AssetState): boolean {
  return TRANSITIONS.some(([a, b]) => a === from && b === to);
}
