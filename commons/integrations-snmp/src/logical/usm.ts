// Spec: 0002-snmp-connector FR-005
/**
 * The user-based security model of SNMPv3 (RFC 3414) with the HMAC-SHA-2 authentication of RFC 7860 and the AES-128 privacy of RFC 3826, as pure functions over a port of the primitives (a hash, an HMAC and AES in cipher feedback mode)
 * that the physical layer gives: the password to a key, the key to the key of one engine, a request sealed (enciphered, then authenticated) and an answer opened (authenticated, then deciphered). An answer whose digest is wrong is refused before
 * it is deciphered, and no password or key appears in a failure.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { AuthProtocol } from "@intellectual-frontiers/integrations-snmp/governance";
import { decode, encode, join, sameBytes } from "./ber.ts";
import { decodeMessage, encodeMessage, scopedBer, scopedOf, type Flags, type Message, type Scoped, type Usm } from "./message.ts";

/** What the physical layer gives: a hash, an HMAC and AES-128 in cipher feedback mode (128 bit feedback). */
export type Primitives = {
  readonly hash: (protocol: AuthProtocol, data: Uint8Array) => Uint8Array;
  readonly hmac: (protocol: AuthProtocol, key: Uint8Array, data: Uint8Array) => Uint8Array;
  readonly aesCfb128: (mode: "encrypt" | "decrypt", key: Uint8Array, iv: Uint8Array, data: Uint8Array) => Uint8Array;
};

/** The length of the digest that is kept in a message for each protocol (RFC 7860, section 4.2.2). */
export const MAC_LENGTH: Readonly<Record<AuthProtocol, number>> = { "hmac-sha-224": 16, "hmac-sha-256": 24, "hmac-sha-384": 32, "hmac-sha-512": 48 };

/** The keys of one user at one engine. */
export type Keys = { readonly protocol: AuthProtocol; readonly auth: Uint8Array; readonly priv: Uint8Array };

/** Why a message cannot be sealed or opened. */
export type UsmError =
  | { readonly kind: "password-short" }
  | { readonly kind: "message"; readonly what: string }
  | { readonly kind: "not-canonical" }
  | { readonly kind: "digest" }
  | { readonly kind: "flags"; readonly what: string }
  | { readonly kind: "decrypt" };

const MIN_PASSWORD = 8;
const EXPANSION = 1_048_576;

/** The key of a password (RFC 3414, A.2.1): the password repeated to one mebibyte and hashed. */
export function passwordToKey(prims: Primitives, protocol: AuthProtocol, password: string): Uint8Array {
  const p = new TextEncoder().encode(password);
  const buf = new Uint8Array(EXPANSION);
  for (let i = 0; i < EXPANSION; i += 1) buf[i] = p[i % p.length] ?? 0;
  return prims.hash(protocol, buf);
}

/** The key of one engine (RFC 3414, A.2.2): the hash of the key, the engine id and the key. */
export const localize = (prims: Primitives, protocol: AuthProtocol, key: Uint8Array, engineId: Uint8Array): Uint8Array => prims.hash(protocol, join([key, engineId, key]));

/** The keys of a user at an engine from the two passwords, each of at least eight characters; the privacy key is the first sixteen octets of the localized key (RFC 3826, section 3.1.2.1). */
export function keysFor(prims: Primitives, protocol: AuthProtocol, authPassword: string, privPassword: string, engineId: Uint8Array): Result<Keys, UsmError> {
  if (authPassword.length < MIN_PASSWORD || privPassword.length < MIN_PASSWORD) return err({ kind: "password-short" });
  return ok({ protocol, auth: localize(prims, protocol, passwordToKey(prims, protocol, authPassword), engineId), priv: localize(prims, protocol, passwordToKey(prims, protocol, privPassword), engineId).slice(0, 16) });
}

const be32 = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const ivOf = (boots: number, time: number, salt: Uint8Array): Uint8Array => join([be32(boots), be32(time), salt]);

/** What a request is made of. */
export type Request = { readonly msgId: number; readonly maxSize: number; readonly user: string; readonly engine: { readonly id: Uint8Array; readonly boots: number; readonly time: number }; readonly scoped: Scoped; readonly salt: Uint8Array };

/** A request with authentication and privacy: the scoped PDU is enciphered (RFC 3826) and the whole message is authenticated with the digest in place of zeros (RFC 3414, section 6.3.1). */
export function sealRequest(prims: Primitives, keys: Keys, r: Request): Result<Uint8Array, UsmError> {
  if (r.salt.length !== 8) return err({ kind: "message", what: "the salt is eight octets" });
  const flags: Flags = { auth: true, priv: true, reportable: true };
  const cipher = prims.aesCfb128("encrypt", keys.priv, ivOf(r.engine.boots, r.engine.time, r.salt), encode(scopedBer(r.scoped)));
  const mac = MAC_LENGTH[keys.protocol];
  const usm = (authParams: Uint8Array): Usm => ({ engineId: r.engine.id, boots: r.engine.boots, time: r.engine.time, user: r.user, authParams, privParams: r.salt });
  const message = (authParams: Uint8Array): Message => ({ msgId: r.msgId, maxSize: r.maxSize, flags, usm: usm(authParams), data: { kind: "encrypted", bytes: cipher } });
  const digest = prims.hmac(keys.protocol, keys.auth, encodeMessage(message(new Uint8Array(mac)))).slice(0, mac);
  return ok(encodeMessage(message(digest)));
}

/** A request with no authentication and no privacy that asks an engine to say who it is (RFC 3414, section 4). */
export function discoveryRequest(msgId: number, maxSize: number, requestId: number): Uint8Array {
  const scoped: Scoped = { contextEngineId: new Uint8Array(), contextName: new Uint8Array(), pdu: { type: "get", requestId, errorStatus: 0, errorIndex: 0, varbinds: [] } };
  return encodeMessage({ msgId, maxSize, flags: { auth: false, priv: false, reportable: true }, usm: { engineId: new Uint8Array(), boots: 0, time: 0, user: "", authParams: new Uint8Array(), privParams: new Uint8Array() }, data: { kind: "plain", scoped } });
}

/** An answer opened: its message and its scoped PDU. */
export type Opened = { readonly message: Message; readonly scoped: Scoped };

/** A message with no authentication and no privacy (a report of discovery). */
export function openPlain(bytes: Uint8Array): Result<Opened, UsmError> {
  const m = decodeMessage(bytes);
  if (m.kind === "err") return err({ kind: "message", what: m.error.kind });
  if (m.value.flags.auth || m.value.flags.priv || m.value.data.kind !== "plain") return err({ kind: "flags", what: "a plain message was expected" });
  return ok({ message: m.value, scoped: m.value.data.scoped });
}

/** An answer with authentication and privacy: the form of the bytes is the one `encode` makes, the digest is checked in constant time and only then the data are deciphered. */
export function openAnswer(prims: Primitives, keys: Keys, bytes: Uint8Array): Result<Opened, UsmError> {
  const m = decodeMessage(bytes);
  if (m.kind === "err") return err({ kind: "message", what: m.error.kind });
  const msg = m.value;
  if (!msg.flags.auth || !msg.flags.priv || msg.data.kind !== "encrypted") return err({ kind: "flags", what: "an answer with authentication and privacy was expected" });
  if (!sameBytes(encodeMessage(msg), bytes)) return err({ kind: "not-canonical" });
  const mac = MAC_LENGTH[keys.protocol];
  if (msg.usm.authParams.length !== mac) return err({ kind: "digest" });
  const zeroed = encodeMessage({ ...msg, usm: { ...msg.usm, authParams: new Uint8Array(mac) } });
  const expected = prims.hmac(keys.protocol, keys.auth, zeroed).slice(0, mac);
  if (!sameBytes(expected, msg.usm.authParams)) return err({ kind: "digest" });
  if (msg.usm.privParams.length !== 8) return err({ kind: "decrypt" });
  const plain = prims.aesCfb128("decrypt", keys.priv, ivOf(msg.usm.boots, msg.usm.time, msg.usm.privParams), msg.data.bytes);
  const ber = decode(plain);
  if (ber.kind === "err") return err({ kind: "decrypt" });
  const scoped = scopedOf(ber.value);
  if (scoped.kind === "err") return err({ kind: "message", what: scoped.error.kind });
  return ok({ message: msg, scoped: scoped.value });
}

/** Seals an answer as an agent does, for the tests of a session that has no device: the same primitives and the same form. */
export function sealAnswer(prims: Primitives, keys: Keys, r: Omit<Request, "user"> & { readonly user: string }): Result<Uint8Array, UsmError> {
  const sealed = sealRequest(prims, keys, r);
  if (sealed.kind === "err") return sealed;
  const m = decodeMessage(sealed.value);
  if (m.kind === "err") return err({ kind: "message", what: m.error.kind });
  const flags: Flags = { auth: true, priv: true, reportable: false };
  const mac = MAC_LENGTH[keys.protocol];
  const base: Message = { ...m.value, flags, usm: { ...m.value.usm, authParams: new Uint8Array(mac) } };
  const digest = prims.hmac(keys.protocol, keys.auth, encodeMessage(base)).slice(0, mac);
  return ok(encodeMessage({ ...base, usm: { ...base.usm, authParams: digest } }));
}

