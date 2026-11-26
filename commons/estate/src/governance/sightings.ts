// Spec: 0009-estate-sightings FR-001
/**
 * What a relay saw and how an asset is told apart: the keys of an identity (`IdentityKey`, each made by a smart constructor that normalises it), the sighting that holds only keys and a provenance, the
 * capability tiers 0 to 4 of an asset and the closed table `REACH` of the ways to the controller (commons 0041-telemetry-and-reach FR-001, FR-005, FR-011, FR-012). Types and tables only: the functions are in `logical/sightings.ts`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The kinds of key that identify an asset. */
export const KEY_KINDS = ["machine-id", "serial", "mac", "snmp-engine-id", "host-key"] as const;
/** One kind of key. */
export type KeyKind = (typeof KEY_KINDS)[number];

/** One key of an identity, normalised by its constructor. */
export type IdentityKey = { readonly kind: KeyKind; readonly value: string };

/** How strongly a kind of key identifies one asset: a MAC is weak because a clone repeats it (FR-004). */
export const KEY_STRENGTH: Readonly<Record<KeyKind, "strong" | "weak">> = {
  "machine-id": "strong",
  serial: "strong",
  "snmp-engine-id": "strong",
  "host-key": "strong",
  mac: "weak",
};

/** The order a seen asset's id is derived from: the strongest first, the MAC last (FR-007). */
export const KEY_ORDER: readonly KeyKind[] = ["machine-id", "serial", "snmp-engine-id", "host-key", "mac"];

/** A hardware address: lower case with colons, not broadcast and not multicast. */
export function macKey(text: string): Result<IdentityKey, string> {
  const t = text.trim().toLowerCase().replace(/-/g, ":");
  if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/.test(t)) return err(`${JSON.stringify(text)} is not a hardware address`);
  if (t === "ff:ff:ff:ff:ff:ff" || (parseInt(t.slice(0, 2), 16) & 1) === 1) return err(`${t} is a broadcast or multicast address`);
  return ok({ kind: "mac", value: t });
}

/** A machine id: 32 hexadecimal digits. */
export function machineIdKey(text: string): Result<IdentityKey, string> {
  const t = text.trim().toLowerCase();
  return /^[0-9a-f]{32}$/.test(t) ? ok({ kind: "machine-id", value: t }) : err("a machine id is 32 hexadecimal digits");
}

/** An SNMP engine id: hexadecimal, 5 to 32 octets. */
export function snmpEngineIdKey(text: string): Result<IdentityKey, string> {
  const t = text.trim().toLowerCase().replace(/^0x/, "");
  return /^(?:[0-9a-f]{2}){5,32}$/.test(t) ? ok({ kind: "snmp-engine-id", value: t }) : err("an SNMP engine id is 5 to 32 octets in hexadecimal");
}

/** The fingerprint of an SSH host key: `SHA256:` and 43 characters. */
export function hostKeyKey(text: string): Result<IdentityKey, string> {
  const t = text.trim();
  return /^SHA256:[A-Za-z0-9+/]{43}$/.test(t) ? ok({ kind: "host-key", value: t }) : err("a host key is SHA256: and 43 characters");
}

/** A serial: trimmed and not empty. */
export function serialKey(text: string): Result<IdentityKey, string> {
  const t = text.trim();
  return t === "" ? err("a serial is not empty") : ok({ kind: "serial", value: t });
}

/** The constructor of a kind. */
export function keyOf(kind: KeyKind, text: string): Result<IdentityKey, string> {
  switch (kind) {
    case "mac":
      return macKey(text);
    case "machine-id":
      return machineIdKey(text);
    case "snmp-engine-id":
      return snmpEngineIdKey(text);
    case "host-key":
      return hostKeyKey(text);
    case "serial":
      return serialKey(text);
  }
}

/** The text of a key, `kind:value`, as it is compared and written. */
export const keyText = (k: IdentityKey): string => `${k.kind}:${k.value}`;

/** The protocols by which a relay sees a device. */
export const SIGHTING_PROTOCOLS = ["syslog", "snmp", "netflow", "redfish", "prometheus", "otlp", "neighbor"] as const;
/** One protocol. */
export type SightingProtocol = (typeof SIGHTING_PROTOCOLS)[number];

/** A relay saw a device: only keys, a count and a provenance; no payload (FR-001). */
export type Sighting = {
  readonly id: string;
  readonly at: string;
  readonly relay: string;
  readonly protocol: SightingProtocol;
  readonly keys: readonly IdentityKey[];
  readonly address?: string;
  readonly hostname?: string;
  readonly count: number;
  readonly provenance: string;
};

/** `relay:<relay id>/<protocol>#<key>`, the provenance of a sighting (FR-002). */
export const provenanceOf = (relay: string, protocol: SightingProtocol, key: IdentityKey): string => `relay:${relay}/${protocol}#${keyText(key)}`;

/** The capability tier of an asset (0041 FR-001): what the controller can read of it. */
export type AssetTier = 0 | 1 | 2 | 3 | 4;
/** The five tiers in order. */
export const ASSET_TIERS: readonly AssetTier[] = [0, 1, 2, 3, 4];

/** What an asset offers when its tier is told: identified, an API or a protocol that answers, a login that works (either direction), osQuery that runs behind it, an exporter of ours that reports. */
export type TierFacts = {
  readonly identified: boolean;
  readonly protocol: boolean;
  readonly login: boolean;
  readonly osquery: boolean;
  readonly agent: boolean;
};

/** The three things an enrolled asset has at least (0041 FR-011). */
export type Minimum = "identity" | "facts-and-query" | "telemetry";
/** What an asset has of the three. */
export type EnrollmentMinimum = { readonly identity: boolean; readonly factsAndQuery: boolean; readonly telemetry: boolean };

/** The channels of the matrix of reach. */
export type ReachRow = {
  readonly row: string;
  readonly channel: string;
  readonly openedBy: "asset" | "relay" | "controller" | "device or relay";
  readonly authentication: string;
  readonly carries: string;
  readonly tiers: readonly AssetTier[];
  /** Whether a site relay may use the row as well. */
  readonly relay: boolean;
  readonly status: "required" | "available" | "optional-later";
};

/** The closed table of the ways to the controller (0041 FR-005). A surface renders it and decides nothing. */
export const REACH: readonly ReachRow[] = [
  { row: "R1", channel: "SSH outbound to the controller, account s-device", openedBy: "asset", authentication: "the key the device proved when it enrolled", carries: "the conversations checkin and leave, and the reserved query, jobs and health", tiers: [2, 3, 4], relay: true, status: "available" },
  { row: "R2", channel: "OTLP over HTTPS and TLS with a bearer token", openedBy: "asset", authentication: "a token held as a credential reference", carries: "OTLP JSON, the signed envelope", tiers: [4], relay: true, status: "available" },
  { row: "R3", channel: "OTLP over HTTPS and TLS with mutual TLS", openedBy: "asset", authentication: "a client certificate", carries: "OTLP JSON, the signed envelope", tiers: [4], relay: true, status: "available" },
  { row: "R4", channel: "OTLP over an SSH -L forward to the controller's loopback receiver", openedBy: "asset", authentication: "the device identity, the same key as R1", carries: "OTLP JSON to 127.0.0.1 on one port and nothing else", tiers: [4], relay: true, status: "available" },
  { row: "R5", channel: "Syslog, SNMP, NetFlow, Redfish, Prometheus and OTLP from the site, received by a site relay", openedBy: "device or relay", authentication: "the site network, SNMPv3 authPriv or a token of the device's own", carries: "what the device speaks, translated to OTLP by the relay", tiers: [1], relay: false, status: "available" },
  { row: "R6", channel: "The relay forwards what it translated over its own R4 or R2", openedBy: "relay", authentication: "the relay's device identity", carries: "OTLP", tiers: [], relay: true, status: "available" },
  { row: "R7", channel: "The controller runs the probe over a login on an asset it can reach: a script piped to the login that leaves nothing on the asset, or the probe installed with a restricted key", openedBy: "controller", authentication: "the person's own key by name, or a read-only key", carries: "facts, version and one osQuery SELECT", tiers: [2, 3], relay: false, status: "available" },
  { row: "R8", channel: "SMTP store and forward of the signed envelope", openedBy: "asset", authentication: "the mail system's", carries: "the signed envelope", tiers: [0, 1, 2, 3, 4], relay: true, status: "optional-later" },
  { row: "R9", channel: "The controller reads an API or a protocol of a boundary or a device, directly or through a relay's route", openedBy: "controller", authentication: "the credential of the connection by name", carries: "the read, as JSON or the protocol's own", tiers: [1], relay: false, status: "available" },
];
