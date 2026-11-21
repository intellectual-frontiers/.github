// Spec: 0003-estate-logical FR-001, FR-002
/**
 * The life of an asset: a move between states (a discovered asset is adopted, and an adopted asset is released back; a managed asset is installed and retired, never moved), and the move of one capability from one system to another, which is made only when
 * the acceptance test of that capability on that asset has passed. A move down a state gives up the capabilities the lower state does not offer; a move up needs an owner for each new one.
 *
 * @example
 * ```ts
 * import { moveState } from "./lifecycle.ts";
 * // moveState(asset, "managed", { converge: "archon", ... }) is a Result of the asset in its new state
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { defineAsset, mayMove, ownerOf, parseSystemId, OFFERED, type Asset, type AssetState, type Capability, type SystemId } from "@intellectual-frontiers/estate/governance";

/** The owners an asset names, by capability. */
function ownersOf(asset: Asset): Partial<Record<Capability, string>> {
  const owners: Partial<Record<Capability, string>> = {};
  for (const line of asset.capabilities) if (line.offered) owners[line.capability] = line.owner;
  return owners;
}

/** The asset in another state: the owners it had are kept for what the new state still offers (what it does not offer is given up), and `owners` names the owners of what is new; refused where the move is not allowed or an owner is missing. */
export function moveState(asset: Asset, to: AssetState, owners: Readonly<Partial<Record<Capability, string>>> = {}): Result<Asset, readonly string[]> {
  if (asset.state === to) return err([`${asset.id} is already ${to}`]);
  if (!mayMove(asset.state, to)) return err([`${asset.id} cannot move from ${asset.state} to ${to}: a discovered asset is adopted and an adopted asset is released, and a managed asset is installed and retired, never moved`]);
  const kept = ownersOf(asset);
  const next: Partial<Record<Capability, string>> = {};
  for (const capability of OFFERED[to]) {
    const given = owners[capability] ?? kept[capability];
    if (given !== undefined) next[capability] = given;
  }
  return defineAsset({ id: asset.id, kind: asset.kind, state: to, ...(asset.joined === undefined || asset.joined === "managed" ? {} : { joined: asset.joined }), owners: next });
}

/** A test of a capability of an asset that passed, by the system that is to own it. */
export type AcceptanceRecord = { readonly asset: string; readonly capability: Capability; readonly system: string; readonly test: string; readonly passedAt: string };

/** The asset with one capability owned by another system, or why not: it is made only with a passed acceptance test for this asset, this capability and the system that takes it. */
export function moveCapability(asset: Asset, capability: Capability, to: string, acceptance: AcceptanceRecord | undefined): Result<Asset, readonly string[]> {
  const system = parseSystemId(to);
  if (system.kind === "err") return err([system.error]);
  const current: SystemId | undefined = ownerOf(asset, capability);
  if (current === undefined) return err([`${asset.id}: ${capability} is not offered by a ${asset.state} asset, so no system owns it`]);
  if (current === system.value) return err([`${asset.id}: ${capability} is already owned by ${current}`]);
  if (acceptance === undefined) return err([`${asset.id}: ${capability} moves from ${current} to ${system.value} only when its acceptance test has passed, and none was given`]);
  if (acceptance.asset !== asset.id || acceptance.capability !== capability || acceptance.system !== system.value) {
    return err([`${asset.id}: the acceptance record is for ${acceptance.asset} ${acceptance.capability} by ${acceptance.system}, not for ${asset.id} ${capability} by ${system.value}`]);
  }
  const owners = { ...ownersOf(asset), [capability]: system.value };
  return defineAsset({ id: asset.id, kind: asset.kind, state: asset.state, ...(asset.joined === undefined ? {} : { joined: asset.joined }), owners });
}

