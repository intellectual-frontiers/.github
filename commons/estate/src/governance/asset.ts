// Spec: 0002-estate-governance FR-004, FR-005
/**
 * An asset: its identity, kind and state, and for every capability either the system that owns it or the reason it is not offered, so that nothing is silently dropped. An asset is refused where it
 * names an owner for a capability its state does not offer, or leaves a capability it does offer with no owner.
 *
 * @example
 * ```ts
 * import { defineAsset } from "./asset.ts";
 * const a = defineAsset({ id: "athens", kind: "server", state: "adopted", joined: "paired", owners: { observe: "archon", verify: "archon" } });
 * a.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { CAPABILITIES, parseAssetId, parseAssetKind, parseSystemId, WAYS_OF_JOINING, type AssetId, type AssetKind, type AssetState, type Capability, type SystemId, type WayOfJoining } from "./ids.ts";
import { offers, reasonNotOffered } from "./states.ts";

/** What `defineAsset` takes. */
export type AssetInput = {
  readonly id: string;
  readonly kind: string;
  readonly state: AssetState;
  /** How it came to be in the fleet; a managed asset is `managed` (the default) and no other is. */
  readonly joined?: WayOfJoining;
  /** For each capability the state offers, the system that owns it. */
  readonly owners: Readonly<Partial<Record<Capability, string>>>;
};

/** One capability of an asset: offered and owned, or not offered with the reason. */
export type CapabilityLine =
  | { readonly capability: Capability; readonly offered: true; readonly owner: SystemId }
  | { readonly capability: Capability; readonly offered: false; readonly reason: string };

/** An asset. */
export type Asset = {
  readonly id: AssetId;
  readonly kind: AssetKind;
  readonly state: AssetState;
  /** How it came to be in the fleet, where that is known. */
  readonly joined?: WayOfJoining;
  /** Every capability, in the order of the closed list. */
  readonly capabilities: readonly CapabilityLine[];
};

/** The owner of a capability of an asset, or nothing where it is not offered. */
export function ownerOf(asset: Asset, capability: Capability): SystemId | undefined {
  const line = asset.capabilities.find((c) => c.capability === capability);
  return line !== undefined && line.offered ? line.owner : undefined;
}

/** An asset from its input, or every reason it is refused. */
export function defineAsset(input: AssetInput): Result<Asset, readonly string[]> {
  const problems: string[] = [];
  const id = parseAssetId(input.id);
  if (id.kind === "err") problems.push(id.error);
  const kind = parseAssetKind(input.kind);
  if (kind.kind === "err") problems.push(kind.error);
  const lines: CapabilityLine[] = [];
  const joined: WayOfJoining | undefined = input.joined ?? (input.state === "managed" ? "managed" : undefined);
  if (joined !== undefined && !WAYS_OF_JOINING.includes(joined)) problems.push(`${input.id}: ${JSON.stringify(joined)} is not a way of joining`);
  else if (joined === "managed" && input.state !== "managed") problems.push(`${input.id}: only an asset the system installed joined as managed, and this one is ${input.state}`);
  else if (input.state === "managed" && joined !== "managed") problems.push(`${input.id}: a managed asset joined as managed, not ${joined ?? "unknown"}`);
  for (const capability of CAPABILITIES) {
    const owner = input.owners[capability];
    if (!offers(input.state, capability)) {
      if (owner !== undefined) problems.push(`${input.id}: ${capability} is owned by ${owner}, and a ${input.state} asset does not offer it`);
      lines.push({ capability, offered: false, reason: reasonNotOffered(input.state, capability) ?? "" });
      continue;
    }
    if (owner === undefined) {
      problems.push(`${input.id}: ${capability} is offered by a ${input.state} asset and has no owner`);
      continue;
    }
    const system = parseSystemId(owner);
    if (system.kind === "err") problems.push(`${input.id}: ${system.error}`);
    else lines.push({ capability, offered: true, owner: system.value });
  }
  return problems.length > 0 || id.kind === "err" || kind.kind === "err" ? err(problems) : ok({ id: id.value, kind: kind.value, state: input.state, ...(joined === undefined ? {} : { joined }), capabilities: lines });
}
