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
import { CAPABILITIES, type AssetState, type Capability, type Origin } from "./ids.ts";

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

/** The reason an inherited asset does not offer `provision`: someone else installed it. */
const INHERITED_PROVISION = "an inherited asset was installed by someone else: the system never reinstalls or erases it (it is retired, or installed again as a new provisioned asset)";

/** Whether a state offers a capability: a managed asset that was not provisioned (it is inherited) does not offer `provision`. */
export function offers(state: AssetState, capability: Capability, origin?: Origin): boolean {
  if (state === "managed" && capability === "provision" && origin !== undefined && origin !== "provisioned") return false;
  return OFFERED[state].includes(capability);
}

/** The reason a state does not offer a capability; nothing where it does. */
export function reasonNotOffered(state: AssetState, capability: Capability, origin?: Origin): string | undefined {
  if (offers(state, capability, origin)) return undefined;
  return state === "managed" ? INHERITED_PROVISION : REASON[state];
}

/** The moves between states that are allowed (Stolos 067-adopt): a discovered asset is adopted, an adopted asset is released back to discovered or managed (taken over, with an approval), and a managed asset is never moved: it was installed as managed or taken over, and leaves by being retired. */
export const TRANSITIONS: readonly (readonly [AssetState, AssetState])[] = [
  ["discovered", "adopted"],
  ["adopted", "discovered"],
  ["adopted", "managed"],
];

/** Whether an asset may move from one state to another. */
export function mayMove(from: AssetState, to: AssetState): boolean {
  return TRANSITIONS.some(([a, b]) => a === from && b === to);
}
