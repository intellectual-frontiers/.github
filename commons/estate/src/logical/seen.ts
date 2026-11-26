// Spec: 0009-estate-sightings FR-014
/**
 * What an observer of devices gives the estate (0009-estate-sightings FR-014): from an observation of the shape every connector of Integrations makes, as a structural type so that estate imports no connector, the identity keys of each record labelled
 * `device` (from the properties `engineId`, `serial`, `mac`, `machineId` and `hostKey`), the sightings of devices no asset holds, and the observation as a stored document. Pure and total: a property that is not a key of its kind is not a key, and a device with no key is not
 * a sighting.
 *
 * @example
 * ```ts
 * import { keysOfProps } from "./seen.ts";
 * keysOfProps({ serial: "SN-0001" }).length; // 1
 * ```
 *
 * @module
 */
import { keyOf, keyText, KEY_KINDS, KEY_ORDER, provenanceOf, SIGHTING_PROTOCOLS, type IdentityKey, type KeyKind, type Sighting, type SightingProtocol } from "@intellectual-frontiers/estate/governance";

/** The record of an observation, as far as the estate reads it. */
export type SeenRecord = { readonly label: string; readonly native_id: string; readonly display_name: string; readonly props: Readonly<Record<string, string | number | boolean>> };
/** An observation, as far as the estate reads it. */
export type SeenObservation = { readonly at: string; readonly provider: string; readonly account: string; readonly posture: Readonly<Record<string, string | number | boolean>>; readonly records?: readonly SeenRecord[] };

/** The property of a record that holds each kind of key. */
export const SEEN_KEY_PROPS: Readonly<Record<KeyKind, string>> = { "machine-id": "machineId", serial: "serial", "snmp-engine-id": "engineId", mac: "mac", "host-key": "hostKey" };

/** The keys of the properties of one record, the strongest first, none twice. */
export function keysOfProps(props: Readonly<Record<string, string | number | boolean>>): readonly IdentityKey[] {
  const out: IdentityKey[] = [];
  for (const kind of KEY_ORDER) {
    const v = props[SEEN_KEY_PROPS[kind]];
    if (typeof v !== "string") continue;
    const k = keyOf(kind, v);
    if (k.kind === "ok" && !out.some((o) => keyText(o) === keyText(k.value))) out.push(k.value);
  }
  return out;
}

const protocolOf = (v: string | number | boolean | undefined, fallback: SightingProtocol): SightingProtocol => SIGHTING_PROTOCOLS.find((p) => p === v) ?? fallback;

/**
 * One sighting for each record labelled `device` that has at least one key and that no asset holds (a record with the property `asset` is held): the relay (or the controller) that read it, the protocol, the keys and the provenance of the strongest key. A record that says
 * its own relay (`relay`) and protocol (`protocol`) in its properties, as a device seen by a site relay does, keeps them; the others have the ones given.
 */
export function sightingsOf(o: SeenObservation, relay: string, protocol: SightingProtocol): readonly Sighting[] {
  const out: Sighting[] = [];
  for (const r of o.records ?? []) {
    if (r.label !== "device" || r.props["asset"] !== undefined) continue;
    const keys = keysOfProps(r.props);
    const first = keys[0];
    if (first === undefined) continue;
    const via = typeof r.props["relay"] === "string" && r.props["relay"] !== "" ? r.props["relay"] : relay;
    const how = protocolOf(r.props["protocol"], protocol);
    out.push({ id: `${how}-${keyText(first)}`, at: o.at, relay: via, protocol: how, keys, ...(r.display_name === "" ? {} : { hostname: r.display_name }), count: 1, provenance: provenanceOf(via, how, first) });
  }
  return out;
}

/** The kinds of key a record may carry, for a connector that wants to name them. */
export const SEEN_KEY_KINDS: readonly KeyKind[] = KEY_KINDS;

/** The observation of one asset as a stored document: its posture as the state, attributed to the provider, with no result of a policy (the policies are the connector's). */
export function storedOf(o: SeenObservation, asset: string): { readonly asset: string; readonly at: string; readonly source: string; readonly state: Readonly<Record<string, string | number | boolean>>; readonly results: readonly [] } {
  return { asset, at: o.at, source: `${o.provider}:${o.account}`, state: { ...o.posture }, results: [] };
}
