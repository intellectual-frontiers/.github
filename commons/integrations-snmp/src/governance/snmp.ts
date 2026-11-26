// Spec: 0002-snmp-connector FR-001, FR-002, FR-003, FR-009
/**
 * The governance of the SNMP connector as data (0002-snmp-connector): what a device must speak to be read (version 3, authentication and privacy, no weak algorithm), the subtrees a walk may enter and how far, the one scope it asks for, its cadence and the
 * posture policies in the vocabulary of GRC, whose control identifiers are the consumer's to attach. Nothing here reaches a network.
 *
 * @example
 * ```ts
 * import { oidAllowed } from "./snmp.ts";
 * oidAllowed("1.3.6.1.2.1.1.5.0"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { cadence, credentialSpec, denylistWith, parseConnectorId, parseCredentialRef, type ConnectorGovernance } from "@intellectual-frontiers/integrations/governance";
import type { PosturePolicy } from "@intellectual-frontiers/integrations/logical";

/** Why a governance cannot be made. */
export type GovernanceError = { readonly kind: "id"; readonly what: string };

/** The versions of SNMP a device may speak: only the third. */
export type SnmpVersion = "1" | "2c" | "3";
/** The authentication protocols that are allowed: the HMAC-SHA-2 family of RFC 7860. */
export const AUTH_PROTOCOLS = ["hmac-sha-224", "hmac-sha-256", "hmac-sha-384", "hmac-sha-512"] as const;
/** One allowed authentication protocol. */
export type AuthProtocol = (typeof AUTH_PROTOCOLS)[number];
/** The privacy protocols that are allowed: AES with a 128 bit key (RFC 3826). */
export const PRIV_PROTOCOLS = ["aes-128"] as const;
/** One allowed privacy protocol. */
export type PrivProtocol = (typeof PRIV_PROTOCOLS)[number];

/** What a device is asked to speak: a version, an authentication and a privacy protocol, each as text a person or a file gave. */
export type SnmpSecurity = { readonly version: string; readonly auth: string; readonly priv: string };

/** What is wrong with a security setting. */
export type SecurityProblem =
  | { readonly kind: "version"; readonly version: string }
  | { readonly kind: "auth"; readonly auth: string }
  | { readonly kind: "priv"; readonly priv: string };

/** The authentication protocol of a text, or `undefined` where it is not allowed (MD5 and SHA-1 are not). */
export const authOf = (text: string): AuthProtocol | undefined => AUTH_PROTOCOLS.find((p) => p === text.toLowerCase());
/** The privacy protocol of a text, or `undefined` where it is not allowed (DES is not). */
export const privOf = (text: string): PrivProtocol | undefined => PRIV_PROTOCOLS.find((p) => p === text.toLowerCase());

/** Every problem of a security setting: a version other than `3`, an authentication protocol that is not HMAC-SHA-2, a privacy protocol that is not AES-128. */
export function securityProblems(s: SnmpSecurity): readonly SecurityProblem[] {
  const out: SecurityProblem[] = [];
  if (s.version !== "3") out.push({ kind: "version", version: s.version });
  if (authOf(s.auth) === undefined) out.push({ kind: "auth", auth: s.auth });
  if (privOf(s.priv) === undefined) out.push({ kind: "priv", priv: s.priv });
  return out;
}

/** The subtrees a walk may enter, as object identifiers: the system group, the interfaces and their extension, the entity table and the LLDP tables. */
export const ALLOWED_SUBTREES: readonly string[] = ["1.3.6.1.2.1.1", "1.3.6.1.2.1.2", "1.3.6.1.2.1.31.1", "1.3.6.1.2.1.47.1.1.1", "1.0.8802.1.1.2"];

const OID = /^[0-2](\.(0|[1-9][0-9]{0,9})){1,127}$/u;
/** Whether a text is an object identifier in dotted form. */
export const isOid = (text: string): boolean => OID.test(text);

/** Whether an object identifier is at or under an allowed subtree. */
export function oidAllowed(oid: string): boolean {
  return isOid(oid) && ALLOWED_SUBTREES.some((s) => oid === s || oid.startsWith(`${s}.`));
}

/** The bounds of a walk: rows, time, and requests each second. */
export type WalkBounds = { readonly maxRows: number; readonly maxMs: number; readonly maxRequestsPerSecond: number };
/** The bounds that are used where a caller gives none. */
export const DEFAULT_BOUNDS: WalkBounds = { maxRows: 2000, maxMs: 30_000, maxRequestsPerSecond: 20 };

/** The names an observation reads, as object identifiers of the system group and the interface, entity and LLDP-free columns. */
export const OIDS = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysObjectID: "1.3.6.1.2.1.1.2.0",
  sysUpTime: "1.3.6.1.2.1.1.3.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  interfaces: "1.3.6.1.2.1.2.2.1",
  entity: "1.3.6.1.2.1.47.1.1.1.1",
} as const;

/** The columns of the interface table that are read: description, physical address, administrative and operational state. */
export const IF_COLUMNS = { descr: "2", mac: "6", admin: "7", oper: "8" } as const;
/** The columns of the entity table that are read: class, firmware, software, serial and model name. */
export const ENTITY_COLUMNS = { class: "5", firmware: "9", software: "10", serial: "11", model: "13" } as const;

/** The governance of the connector of the devices of one site, with the read-only view of a user with authentication and privacy. */
export function snmpGovernance(site: string): Result<ConnectorGovernance, GovernanceError> {
  const id = parseConnectorId("snmp-devices");
  const ref = parseCredentialRef(`vault://snmp/${site.toLowerCase()}-read`);
  const cad = cadence("1h");
  if (id.kind === "err" || ref.kind === "err" || cad.kind === "err") return err({ kind: "id", what: "snmp-devices: its id, its credential reference or its cadence" });
  const spec = credentialSpec(ref.value, [
    { name: "user", secret: false, hint: "The name of a user of the devices whose view is read only." },
    { name: "authPassword", secret: true, hint: "The authentication password of that user (HMAC-SHA-2), of at least eight characters." },
    { name: "privPassword", secret: true, hint: "The privacy password of that user (AES-128), of at least eight characters." },
  ]);
  if (spec.kind === "err") return err({ kind: "id", what: "snmp-devices: the credential spec" });
  return ok({
    id: id.value,
    title: "Network devices that answer SNMPv3: reachability, identity, interfaces and firmware",
    class: "network-device",
    labels: { serviceModels: [], categories: ["network", "snmp"] },
    contract: { writes: "never", tokenEndpoints: [] },
    credential: spec.value,
    scope: { grants: ALLOWED_SUBTREES.map((resource) => ({ resource, access: "read" as const })) },
    cadence: cad.value,
    entities: ["device"],
    denylist: denylistWith([]),
    transport: { kind: "snmp-v3", level: "authPriv" },
  });
}

/** The posture policies of a device. */
export const SNMP_POLICIES: readonly PosturePolicy[] = [
  { id: "snmp-device-answers", title: "The device answers an authenticated request", fact: "device-answers", want: { kind: "equals", value: true }, severity: "high", onMiss: "fail", controls: [], fix: "Check the device is up, the address and the port are right and the user, its passwords and its view are set on the device." },
  { id: "snmp-firmware-known", title: "The firmware of the device is known", fact: "firmware-known", want: { kind: "equals", value: true }, severity: "low", onMiss: "warn", controls: [], fix: "Have the device give its entity table (the firmware revision) to the view of the user." },
  { id: "snmp-interfaces-up", title: "No interface is up by design and down in fact", fact: "interfaces-down-unexpectedly", want: { kind: "every", field: "value", op: "le", value: 0 }, severity: "medium", onMiss: "warn", controls: [], fix: "Find the interfaces that are administratively up and operationally down and repair or disable them." },
];
