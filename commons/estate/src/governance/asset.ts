// Spec: 0002-estate-governance FR-004, FR-005
// Spec: 0008-estate-workstations FR-011
/**
 * An asset: its identity, kind and state, and for every capability either the system that owns it or the reason it is not offered, so that nothing is silently dropped. An asset is refused where it
 * names an owner for a capability its state does not offer, or leaves a capability it does offer with no owner.
 *
 * @example
 * ```ts
 * import { defineAsset } from "./asset.ts";
 * const a = defineAsset({ id: "synthetic-server-02", kind: "server", state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } });
 * a.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { CAPABILITIES, parseAssetId, parseAssetKind, parseSystemId, ORIGINS, type AssetId, type AssetKind, type AssetState, type Capability, type Install, type Origin, type SystemId } from "./ids.ts";
import { checkAttributes, type AttributeValue } from "./kinds.ts";
import { offers, reasonNotOffered } from "./states.ts";
import { checkWorkshopOwners } from "./workshop.ts";

/** What `defineAsset` takes. */
export type AssetInput = {
  readonly id: string;
  readonly kind: string;
  readonly state: AssetState;
  /** Where it came from; a managed asset is `provisioned` by default, and only a managed asset can be. An asset that is not provisioned was installed by someone else. */
  readonly origin?: Origin;
  /** For each capability the state offers, the system that owns it. */
  readonly owners: Readonly<Partial<Record<Capability, string>>>;
  /** The attributes of the asset, checked against the catalog of its kind where the kind has one (`kinds.ts`). */
  readonly attributes?: Readonly<Record<string, AttributeValue>>;
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
  /** Where it came from, where that is known. */
  readonly origin?: Origin;
  /** The attributes it states, checked against the catalog of its kind. */
  readonly attributes?: Readonly<Record<string, AttributeValue>>;
  /** Every capability, in the order of the closed list. */
  readonly capabilities: readonly CapabilityLine[];
};

/** Who installed the asset: the system, where its origin is `provisioned`, or someone else (`inherited`) for every other asset. */
export function installOf(asset: Asset): Install {
  return asset.origin === "provisioned" ? "provisioned" : "inherited";
}

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
  for (const m of checkAttributes(input.kind, input.attributes)) problems.push(`${input.id}: ${m}`);
  const lines: CapabilityLine[] = [];
  const origin: Origin | undefined = input.origin ?? (input.state === "managed" ? "provisioned" : undefined);
  if (origin !== undefined && !ORIGINS.includes(origin)) problems.push(`${input.id}: ${JSON.stringify(origin)} is not an origin (${ORIGINS.join(", ")})`);
  else if (origin === "provisioned" && input.state !== "managed") problems.push(`${input.id}: only a managed asset can be provisioned by the system, and this one is ${input.state}`);
  for (const capability of CAPABILITIES) {
    const owner = input.owners[capability];
    if (!offers(input.state, capability, origin)) {
      if (owner !== undefined) problems.push(`${input.id}: ${capability} is owned by ${owner}, and a ${input.state} asset does not offer it`);
      lines.push({ capability, offered: false, reason: reasonNotOffered(input.state, capability, origin) ?? "" });
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
  if (input.kind === "workshop") for (const m of checkWorkshopOwners(input.owners, input.attributes)) problems.push(`${input.id}: ${m}`);
  return problems.length > 0 || id.kind === "err" || kind.kind === "err" ? err(problems) : ok({ id: id.value, kind: kind.value, state: input.state, ...(origin === undefined ? {} : { origin }), ...(input.attributes === undefined ? {} : { attributes: input.attributes }), capabilities: lines });
}
