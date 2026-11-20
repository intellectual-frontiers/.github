// Spec: 0002-estate-governance FR-002, FR-003
/**
 * What each state of an asset offers, as data, and the reason a state does not offer a capability; and the moves between states that are allowed. A discovered asset is only listed and offers nothing, an adopted
 * asset is observed and checked but never changed, and a managed asset offers every capability.
 *
 * @example
 * ```ts
 * import { offers, reasonNotOffered } from "./states.ts";
 * offers("adopted", "converge"); // false
 * reasonNotOffered("adopted", "converge"); // "an adopted asset is observed and checked, never changed"
 * ```
 *
 * @module
 */
import { CAPABILITIES, type AssetState, type Capability } from "./ids.ts";

/** The capabilities each state offers. */
export const OFFERED: Readonly<Record<AssetState, readonly Capability[]>> = {
  discovered: [],
  adopted: ["observe", "verify"],
  managed: [...CAPABILITIES],
};

/** The reason a state does not offer a capability. */
const REASON: Readonly<Record<AssetState, string>> = {
  discovered: "a discovered asset is only listed: nothing is scanned or recorded of it until it is adopted",
  adopted: "an adopted asset is observed and checked, never changed",
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

/** The moves between states that are allowed (Stolos 067-adopt): a discovered asset is adopted and an adopted asset is released back to discovered. A managed asset is installed as managed and leaves by being retired: it is never moved. */
export const TRANSITIONS: readonly (readonly [AssetState, AssetState])[] = [
  ["discovered", "adopted"],
  ["adopted", "discovered"],
];

/** Whether an asset may move from one state to another. */
export function mayMove(from: AssetState, to: AssetState): boolean {
  return TRANSITIONS.some(([a, b]) => a === from && b === to);
}
