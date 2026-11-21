// Spec: 0010-anyfs-merge-signing FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The signature of what replicas exchange: a delta, an epoch and a dump are each named by a digest, and a replica that signs says in its own key that it made what the digest names. The key is Ed25519 (the algorithm
 * of the keys the commons already signs with, and the one both runtimes hold); a signature is the text `ed25519:<key id>:<base64>`, where the key id is the first 16 hexadecimal digits of the SHA-256 of the 32 bytes of
 * the public key; and what is signed is the digest with the domain it is for and the replica that made it (`anyfs-delta/1`, `anyfs-epoch/1`, `anyfs-dump/1`), so that a signature of one thing is never a signature of another. A
 * roster says which keys speak for which replica and when: each entry has a window (not before, not after, in milliseconds), so that a key can be replaced and a delta signed under the old key still holds for the time it was made in.
 *
 * @example
 * ```ts
 * import { generateSigningKey, makeSigner, rosterTrust, signDelta } from "./signing.ts";
 * const key = await generateSigningKey(replica);
 * const signed = await signDelta(delta, await makeSigner(key));
 * const trust = rosterTrust([key.entry]);
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Delta, ReplicaId, SignatureVerdict, Trust } from "@intellectual-frontiers/anyfs/governance";
import { parseReplicaId } from "@intellectual-frontiers/anyfs/governance";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { deltaId } from "./delta.ts";
import { fromBase64, toBase64 } from "./limits.ts";

/** What a signature is for: the domain written before the digest. */
export const SIGNED_DOMAINS = ["anyfs-delta/1", "anyfs-epoch/1", "anyfs-dump/1"] as const;
/** One domain of a signature. */
export type SignedDomain = (typeof SIGNED_DOMAINS)[number];

/** The prefix of a signature's text. */
export const SIGNATURE_ALGORITHM = "ed25519";

/** One key that speaks for a replica, and when: the 32 bytes of the public key in base64, with the window in milliseconds it speaks in. */
export type KeyEntry = {
  readonly replica: ReplicaId;
  readonly keyId: string;
  readonly publicKey: string;
  readonly notBefore?: number;
  readonly notAfter?: number;
};

/** The keys a replica knows. */
export type KeyRoster = readonly KeyEntry[];

/** Whoever signs: the replica and key they speak with, and the signing of a text. */
export type Signer = {
  readonly replica: ReplicaId;
  readonly keyId: string;
  sign(domain: SignedDomain, text: string): Promise<string>;
};

/** A key pair made for a replica: the private key as a JWK (to be kept as a secret), the roster entry to give to others, and the signer. */
export type SigningKey = { readonly privateJwk: JsonWebKey; readonly entry: KeyEntry };


/** The id of a key: the first 16 hexadecimal digits of the SHA-256 of its 32 bytes. */
export async function keyIdOf(publicRaw: Uint8Array): Promise<string> {
  return (await sha256(publicRaw)).slice(0, 16);
}

/** A new key pair for a replica. */
export async function generateSigningKey(replica: ReplicaId, window: { readonly notBefore?: number; readonly notAfter?: number } = {}): Promise<SigningKey> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { privateJwk, entry: { replica, keyId: await keyIdOf(raw), publicKey: toBase64(raw), ...(window.notBefore === undefined ? {} : { notBefore: window.notBefore }), ...(window.notAfter === undefined ? {} : { notAfter: window.notAfter }) } };
}

/** The message that is signed: the domain, the replica that made the thing, and its digest, each on a line. */
export const messageOf = (domain: SignedDomain, replica: ReplicaId, digest: string): string => `${domain}\n${replica}\n${digest}`;

/** A signer from a private key (a JWK) and the entry it belongs to. */
export async function makeSigner(key: SigningKey): Promise<Signer> {
  const priv = await crypto.subtle.importKey("jwk", key.privateJwk, { name: "Ed25519" }, false, ["sign"]);
  return {
    replica: key.entry.replica,
    keyId: key.entry.keyId,
    async sign(domain, digestText) {
      const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", priv, new TextEncoder().encode(messageOf(domain, key.entry.replica, digestText))));
      return `${SIGNATURE_ALGORITHM}:${key.entry.keyId}:${toBase64(sig)}`;
    },
  };
}

/** A delta with the signature of the replica that made it: the signature is over the identity of the delta, which is made without it. */
export async function signDelta(delta: Delta, signer: Signer): Promise<Delta> {
  return { ...delta, signature: await signer.sign("anyfs-delta/1", await deltaId(delta)) };
}

/** The parts of a signature's text, or why it is not one. */
export function parseSignature(signature: string): Result<{ readonly keyId: string; readonly bytes: Uint8Array }, string> {
  const parts = signature.split(":");
  if (parts.length !== 3 || parts[0] !== SIGNATURE_ALGORITHM) return err(`a signature is ${SIGNATURE_ALGORITHM}:<key id>:<base64>`);
  const [, keyId, body] = parts as [string, string, string];
  if (!/^[0-9a-f]{16}$/u.test(keyId)) return err("the key id of a signature is 16 hexadecimal digits");
  const bytes = fromBase64(body);
  if (bytes === undefined || bytes.length !== 64) return err("the signature of Ed25519 is 64 bytes in base64");
  return ok({ keyId, bytes });
}

/** Whether a signature holds for a thing a replica made at a time: the verdict, and the reason where it is not `ok`. */
export async function verifySigned(roster: KeyRoster, domain: SignedDomain, digest: string, signature: string, replica: ReplicaId, at: number): Promise<SignatureVerdict> {
  const parsed = parseSignature(signature);
  if (parsed.kind === "err") return "bad-signature";
  const entries = roster.filter((e) => e.replica === replica && e.keyId === parsed.value.keyId && (e.notBefore === undefined || at >= e.notBefore) && (e.notAfter === undefined || at <= e.notAfter));
  if (entries.length === 0) return "unknown-key";
  for (const e of entries) {
    const raw = fromBase64(e.publicKey);
    if (raw === undefined || raw.length !== 32) continue;
    const key = await crypto.subtle.importKey("raw", new Uint8Array(raw), { name: "Ed25519" }, false, ["verify"]);
    if (await crypto.subtle.verify("Ed25519", key, new Uint8Array(parsed.value.bytes), new TextEncoder().encode(messageOf(domain, replica, digest)))) return "ok";
  }
  return "bad-signature";
}

/** The trust that takes deltas signed by a key of the roster, from the replicas the roster names alone unless `replicas` narrows them (a replica must be on both). */
export function rosterTrust(roster: KeyRoster, replicas?: ReadonlySet<ReplicaId>): Trust {
  return {
    kind: "signed",
    ...(replicas === undefined ? {} : { replicas }),
    signers: new Set(roster.map((e) => e.replica)),
    verify: (id, signature, origin, at, domain) => verifySigned(roster, domain, id, signature, origin, at),
  };
}

/** A roster read from text: a JSON list of entries, each checked, or why the text is not a roster. */
export function parseRoster(source: string): Result<KeyRoster, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return err("a roster of keys is JSON");
  }
  if (!Array.isArray(raw)) return err("a roster of keys is a list");
  const out: KeyEntry[] = [];
  for (const [i, e] of (raw as unknown[]).entries()) {
    if (typeof e !== "object" || e === null) return err(`entry ${i} of the roster is not an object`);
    const o = e as Record<string, unknown>;
    const replica = typeof o["replica"] === "string" ? parseReplicaId(o["replica"]) : err("a replica");
    if (replica.kind === "err") return err(`entry ${i} of the roster: ${replica.error}`);
    if (typeof o["keyId"] !== "string" || !/^[0-9a-f]{16}$/u.test(o["keyId"])) return err(`entry ${i} of the roster has no key id of 16 hexadecimal digits`);
    if (typeof o["publicKey"] !== "string" || fromBase64(o["publicKey"])?.length !== 32) return err(`entry ${i} of the roster has no public key of 32 bytes in base64`);
    for (const w of ["notBefore", "notAfter"] as const) if (o[w] !== undefined && (typeof o[w] !== "number" || !Number.isFinite(o[w]))) return err(`entry ${i} of the roster: ${w} is a number of milliseconds`);
    out.push({ replica: replica.value, keyId: o["keyId"], publicKey: o["publicKey"], ...(typeof o["notBefore"] === "number" ? { notBefore: o["notBefore"] } : {}), ...(typeof o["notAfter"] === "number" ? { notAfter: o["notAfter"] } : {}) });
  }
  return ok(out);
}

/** The text of a roster: what `parseRoster` reads. */
export const rosterText = (roster: KeyRoster): string => `${JSON.stringify(roster, null, 2)}\n`;



/** A signing key as it is kept in a file: the replica it speaks for, the roster entry others add to their roster, and the private key. The file is a secret and is never written to a command line. */
export const signingKeyText = (key: SigningKey): string => `${JSON.stringify({ format: 1, entry: key.entry, privateJwk: key.privateJwk }, null, 2)}\n`;

/** A signing key read from a file's text, or why the text is not one. */
export function parseSigningKey(source: string): Result<SigningKey, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return err("a signing key is JSON");
  }
  if (typeof raw !== "object" || raw === null) return err("a signing key is an object");
  const o = raw as Record<string, unknown>;
  const entry = parseRoster(JSON.stringify([o["entry"]]));
  if (entry.kind === "err") return err(`the entry of the signing key: ${entry.error}`);
  const jwk = o["privateJwk"];
  if (o["format"] !== 1 || typeof jwk !== "object" || jwk === null || (jwk as { kty?: unknown }).kty !== "OKP" || typeof (jwk as { d?: unknown }).d !== "string") return err("a signing key is format 1 with an Ed25519 private key (JWK)");
  return ok({ privateJwk: jwk as JsonWebKey, entry: entry.value[0] as KeyEntry });
}

/** A delta signed by the signer of its origin among several, as it is signed where more than one replica's key is in hand; a delta whose origin has no signer here is returned as it is, unsigned. */
export async function signDeltaBy(delta: Delta, signers: readonly Signer[]): Promise<Delta> {
  const signer = signers.find((s) => s.replica === delta.origin);
  return signer === undefined ? delta : signDelta(delta, signer);
}
