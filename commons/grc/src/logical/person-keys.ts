// Spec: 0020-grc-approval FR-015, FR-016, FR-017, FR-018, FR-019
/**
 * The registry of the keys of persons (commons grc 0020-grc-approval): which public key belongs to which person, with which roles, held how, and for how long. It is a document that a repository keeps, in a chain: the first version is signed by a root key whose
 * fingerprint is pinned outside the registry, each later version is signed by a registry administrator named in the version before it, a version holds its predecessor's digest, and a version only adds: no key disappears, no revocation is undone, no key changes
 * its person, its roles or its public key, and no validity is lengthened. A key of the registry is what an approval is checked against; a key that is not in it approves nothing.
 *
 * @remarks
 * The checks are pure. Verifying a signature and the fingerprint of a key are ports (`SignatureVerifier`), because the logical layer reads no program and no key file; the physical layer of the signers gives the port. Nothing here reads a clock: the instant is an argument.
 *
 * @example
 * ```ts
 * import { decodeRegistry } from "./person-keys.ts";
 * const r = decodeRegistry({ schema: "1", version: 1, issuedAt: "2026-01-01T00:00:00Z", keys: [] }); // r.kind === "ok"
 * ```
 *
 * @module
 */
import { array, type Decoded, err, integer, literal, object, ok, type Result, string } from "@intellectual-frontiers/core";
import { pae } from "@intellectual-frontiers/crypto/dsse";
import { instant, instantMs } from "@intellectual-frontiers/grc/governance";
import { digestOf } from "./canonical.ts";

/** What a key of a person may be held as: a hardware token (a key of the kind `sk-`), a key an agent or the operating system keeps and releases only on a confirmation, or a file. */
export const KEY_CUSTODIES = ["hardware", "managed", "file"] as const;
/** How a key is held. */
export type KeyCustody = (typeof KEY_CUSTODIES)[number];

/** The role that may issue a new version of the registry. */
export const REGISTRY_ADMIN = "registry-admin";

const keyDecoder = object(
  { keyId: string, publicKey: string, person: string, roles: array(string), custody: literal(...KEY_CUSTODIES), validFrom: instant },
  { validUntil: instant, revokedAt: instant, replaces: string },
);
/** One key of a person. */
export type PersonKey = Decoded<typeof keyDecoder>;

const registryDecoder = object({ schema: literal("1"), version: integer, issuedAt: instant, keys: array(keyDecoder) }, { previous: string });
/** A version of the registry of the keys of persons. */
export type PersonKeys = Decoded<typeof registryDecoder>;

/** The kinds of key whose signature carries proof that a person touched a token. */
export const isHardwareKeyType = (keyType: string): boolean => keyType.startsWith("sk-");

/** The registry of this text or value, or what is wrong with it (FR-015): the keys have distinct ids, each key has a person and a role, a hardware custody is a key of the kind `sk-`, a validity ends after it starts, a replaced key is in the registry and no key replaces itself. */
export function decodeRegistry(input: unknown): Result<PersonKeys, string> {
  const r = registryDecoder(input);
  if (r.kind === "err") return err(`E-APPROVAL-REGISTRY: ${r.error.path} is not ${r.error.expected}`);
  const v = r.value;
  if (v.version < 1) return err("E-APPROVAL-REGISTRY: the version starts at 1");
  const ids = new Set<string>();
  for (const k of v.keys) {
    if (ids.has(k.keyId)) return err(`E-APPROVAL-REGISTRY: the key ${k.keyId} is in the registry twice`);
    ids.add(k.keyId);
    if (k.person.trim() === "") return err(`E-APPROVAL-REGISTRY: the key ${k.keyId} has no person`);
    if (k.roles.length === 0 || k.roles.some((x) => x.trim() === "")) return err(`E-APPROVAL-REGISTRY: the key ${k.keyId} has no role`);
    const from = instantMs(k.validFrom);
    const until = k.validUntil === undefined ? undefined : instantMs(k.validUntil);
    if (from === undefined || (k.validUntil !== undefined && (until === undefined || until <= from))) return err(`E-APPROVAL-REGISTRY: the validity of ${k.keyId} ends after it starts`);
    if (k.custody === "hardware" && !(k.publicKey.startsWith("sk-"))) return err(`E-APPROVAL-REGISTRY: ${k.keyId} is declared hardware but is not a key of the kind sk-`);
    if (k.replaces === k.keyId) return err(`E-APPROVAL-REGISTRY: ${k.keyId} replaces itself`);
  }
  for (const k of v.keys) if (k.replaces !== undefined && !ids.has(k.replaces)) return err(`E-APPROVAL-REGISTRY: ${k.keyId} replaces ${k.replaces}, which is not in the registry`);
  return ok(v);
}

/** The key of the registry with this id. */
export const keyById = (registry: PersonKeys, keyId: string): PersonKey | undefined => registry.keys.find((k) => k.keyId === keyId);

/** The persons of the registry with a role at an instant: the keys that are valid then and not revoked, by person. */
export function personsWithRole(registry: PersonKeys, role: string, at: string): readonly string[] {
  const t = instantMs(at);
  const out = new Set<string>();
  for (const k of registry.keys) if (t !== undefined && k.roles.includes(role) && keyValidAt(k, t) === undefined) out.add(k.person);
  return [...out].sort();
}

/** Why a key is not valid at an instant (milliseconds), or `undefined` where it is (FR-017, FR-018): not yet, ended, or revoked. A revoked key is never valid again, whatever the instant. */
export function keyValidAt(key: PersonKey, at: number): "not-yet-valid" | "expired" | "revoked" | undefined {
  if (key.revokedAt !== undefined) return "revoked";
  const from = instantMs(key.validFrom);
  if (from === undefined || at < from) return "not-yet-valid";
  const until = key.validUntil === undefined ? undefined : instantMs(key.validUntil);
  if (until !== undefined && at >= until) return "expired";
  return undefined;
}

/** What a registry is signed as: a document of the envelope of DSSE, in the namespace `ifc-approval`. */
export const REGISTRY_PAYLOAD_TYPE = "application/vnd.ifc.person-keys+json";

/** A signed document, the envelope of DSSE (the payload is base64). */
export type SignedDocument = { readonly payloadType: string; readonly payload: string; readonly signatures: readonly { readonly keyid?: string; readonly sig: string }[] };

/** What is known of a verified signature (FR-013): the kind of key, and for a hardware key the flags and the counter the token wrote. */
export type SignatureFacts = { readonly keyType: string; readonly flags?: { readonly userPresent: boolean; readonly userVerified: boolean }; readonly counter?: number };

/** The port of verification that the physical layer gives: the fingerprint of a public key line, the public key line that signed an armored signature, and the verification of a signature over a message in a namespace by a public key line. */
export type SignatureVerifier = {
  fingerprint(publicKey: string): Promise<Result<string, string>>;
  signerOf(armored: string): Promise<Result<string, string>>;
  verify(armored: string, message: Uint8Array, publicKey: string, namespace: string): Promise<Result<SignatureFacts, string>>;
};

/** The namespace of the signatures of approvals and of registries. */
export const APPROVAL_NAMESPACE = "ifc-approval";

const text = new TextDecoder();
const unb64 = (s: string): Uint8Array | undefined => {
  try {
    return Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
};

/** The digest of a version of the registry, as the next version names it in `previous`. */
export async function registryDigest(registry: PersonKeys): Promise<string> {
  const { previous: _previous, ...rest } = registry;
  return digestOf({ ...rest, previous: registry.previous ?? null });
}

/** Whether a key signed a signed document: one of its signatures verifies under the key, in the namespace (a registry administrator signs a registry, FR-016). */
async function signedBy(doc: SignedDocument, key: PersonKey, verifier: SignatureVerifier): Promise<boolean> {
  if (doc.payloadType !== REGISTRY_PAYLOAD_TYPE) return false;
  const payload = unb64(doc.payload);
  if (payload === undefined) return false;
  const message = pae(doc.payloadType, payload);
  for (const s of doc.signatures) {
    const r = await verifier.verify(s.sig, message, key.publicKey, APPROVAL_NAMESPACE);
    if (r.kind === "ok") return true;
  }
  return false;
}

/** The changes between a version and the next that a chain forbids (FR-018): a key that disappears, a revocation undone, a key whose person, roles, custody or public key changes, a validity lengthened. */
export function forbiddenChange(before: PersonKeys, after: PersonKeys): string | undefined {
  for (const old of before.keys) {
    const now = keyById(after, old.keyId);
    if (now === undefined) return `the key ${old.keyId} disappears: a registry only adds, a key is revoked instead`;
    if (now.publicKey !== old.publicKey || now.person !== old.person || now.custody !== old.custody || now.validFrom !== old.validFrom || now.roles.join("\n") !== old.roles.join("\n")) return `the key ${old.keyId} changes its public key, person, roles, custody or start: a new key is added instead`;
    if (old.revokedAt !== undefined && now.revokedAt !== old.revokedAt) return `the revocation of ${old.keyId} is changed or undone`;
    const was = old.validUntil === undefined ? Number.POSITIVE_INFINITY : (instantMs(old.validUntil) ?? Number.POSITIVE_INFINITY);
    const is = now.validUntil === undefined ? Number.POSITIVE_INFINITY : (instantMs(now.validUntil) ?? Number.POSITIVE_INFINITY);
    if (is > was) return `the validity of ${old.keyId} is lengthened`;
  }
  return undefined;
}

/**
 * The registry that a chain of signed versions ends in, or why the chain is not good (FR-016): the first version is signed by the key whose fingerprint is the root's and lists that key with the role of registry administrator at version 1; each later
 * version has the next number, names the digest of the version before it in `previous`, is issued no earlier than it, only adds (`forbiddenChange`), and is signed by a registry administrator of the version before it who is valid at the instant it is issued.
 */
export async function registryOfChain(root: { readonly keyId: string }, chain: readonly SignedDocument[], verifier: SignatureVerifier): Promise<Result<PersonKeys, string>> {
  let previous: PersonKeys | undefined;
  for (const [i, doc] of chain.entries()) {
    const payload = unb64(doc.payload);
    if (payload === undefined) return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(i + 1)} is not base64`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.decode(payload));
    } catch {
      return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(i + 1)} is not JSON`);
    }
    const decoded = decodeRegistry(parsed);
    if (decoded.kind === "err") return decoded;
    const next = decoded.value;
    const issued = instantMs(next.issuedAt) ?? 0;
    if (previous === undefined) {
      if (next.version !== 1 || next.previous !== undefined) return err("E-APPROVAL-REGISTRY-CHAIN: the first version is number 1 and names no predecessor");
      const admin = next.keys.find((k) => k.keyId === root.keyId && k.roles.includes(REGISTRY_ADMIN));
      if (admin === undefined) return err(`E-APPROVAL-REGISTRY-CHAIN: the root key ${root.keyId} is not a registry administrator of version 1`);
      if (!(await signedBy(doc, admin, verifier))) return err("E-APPROVAL-REGISTRY-CHAIN: version 1 is not signed by the root key");
    } else {
      if (next.version !== previous.version + 1) return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(next.version)} follows version ${String(previous.version)}`);
      if (next.previous !== (await registryDigest(previous))) return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(next.version)} does not name the digest of version ${String(previous.version)}`);
      if (issued < (instantMs(previous.issuedAt) ?? 0)) return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(next.version)} is issued before version ${String(previous.version)}`);
      const forbidden = forbiddenChange(previous, next);
      if (forbidden !== undefined) return err(`E-APPROVAL-REGISTRY-CHAIN: ${forbidden}`);
      let signed = false;
      for (const admin of previous.keys.filter((k) => k.roles.includes(REGISTRY_ADMIN) && keyValidAt(k, issued) === undefined)) {
        if (await signedBy(doc, admin, verifier)) {
          signed = true;
          break;
        }
      }
      if (!signed) return err(`E-APPROVAL-REGISTRY-CHAIN: version ${String(next.version)} is not signed by a registry administrator of version ${String(previous.version)}`);
    }
    previous = next;
  }
  return previous === undefined ? err("E-APPROVAL-REGISTRY-CHAIN: the chain is empty") : ok(previous);
}
