// Spec: 0001-crypto FR-006
/**
 * in-toto Statements v1 and DSSE envelopes (commons 0001-crypto FR-006): a statement says that a predicate of some type holds
 * of its subjects, each named and identified by its digests; DSSE signs a payload of a stated type, by the pre-authentication encoding
 * (PAE) of the two, and carries it in a JSON envelope with its signatures. Signing and verifying use Web Crypto (`crypto.subtle`) on keys
 * the caller has imported as `CryptoKey`s, so the module has no effect beyond the computation: Ed25519, ECDSA on P-256, P-384 and P-521
 * (with SHA-256, SHA-384 and SHA-512, the signature in ASN.1 DER as sigstore and in-toto's own tools write it), and RSA-PSS and
 * RSASSA-PKCS1-v1_5 with the key's hash. Verification returns the payload, or an error that says why it was refused: an envelope that is
 * malformed, a payload type not the one expected, a key not usable, or too few valid signatures.
 *
 * Taken from Stolos's `src/archon/export/intoto.ts`, which built a statement and an envelope for a signature callback but never verified
 * one. What changed: the statement is generic in its predicate; the subject's digest is any map of algorithms; signing takes keys rather
 * than a callback; verification, the envelope's decoder and the ECDSA signature form are new. Stolos's evidence bundle predicate (its
 * predicate type, the manifest's summary and the subject list of a bundle's items) is Stolos's own domain and stays there.
 *
 * @example
 * ```ts
 * import { pae, signStatement, statement, subject, verifyStatement } from "./dsse.ts";
 * import { unknownValue } from "@intellectual-frontiers/core";
 * new TextDecoder().decode(pae("http://example.com/HelloWorld", new TextEncoder().encode("hello world")));
 * // "DSSEv1 29 http://example.com/HelloWorld 11 hello world"
 * const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
 * const s = statement([await subject("a.txt", new TextEncoder().encode("a"))], "https://example.com/Note/v1", { note: "hi" });
 * const signed = await signStatement(s, [{ key: keys.privateKey, keyid: "me" }]);
 * if (signed.kind === "ok") await verifyStatement(signed.value, [{ key: keys.publicKey, keyid: "me" }], unknownValue); // { kind: "ok", ... }
 * ```
 *
 * @module
 */
import {
  absurd,
  array,
  type DecodeError,
  type Decoder,
  describe,
  formatDecodeError,
  json,
  object,
  record,
  string,
  unknownValue,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";
import { fromBase64, toBase64 } from "@intellectual-frontiers/formats/base64";
import { children, integer, readTlv, sequence, TAG } from "@intellectual-frontiers/formats/der";
import { sha256 } from "./sha256.ts";

/** The `_type` of an in-toto Statement v1. */
export const STATEMENT_TYPE = "https://in-toto.io/Statement/v1";

/** The DSSE payload type of an in-toto statement. */
export const INTOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

/** An in-toto ResourceDescriptor as a statement's subject: its name, its digests by algorithm (`sha256`, ...) in lower-case hexadecimal, and what else is known of it. */
export type ResourceDescriptor = {
  readonly name: string;
  readonly digest: Readonly<Record<string, string>>;
  readonly uri?: string;
  readonly mediaType?: string;
  readonly annotations?: Readonly<Record<string, unknown>>;
};

/** An in-toto Statement v1: a predicate of type `predicateType` that holds of the subjects. */
export type Statement<P> = {
  readonly _type: typeof STATEMENT_TYPE;
  readonly subject: readonly ResourceDescriptor[];
  readonly predicateType: string;
  readonly predicate: P;
};

/** A DSSE envelope: the payload in base64, its type, and the signatures (base64) over PAE(payloadType, payload). */
export type DsseEnvelope = {
  readonly payload: string;
  readonly payloadType: string;
  readonly signatures: readonly { readonly keyid?: string; readonly sig: string }[];
};

/** A key to sign with (a private key) or verify with (a public key), and the id that names it in an envelope, if any. */
export type DsseKey = { readonly key: CryptoKey; readonly keyid?: string };

/** A signature algorithm this module signs and verifies with, as read from a key. */
export type DsseAlgorithm =
  | { readonly kind: "ed25519" }
  | { readonly kind: "ecdsa"; readonly curve: "P-256" | "P-384" | "P-521" }
  | { readonly kind: "rsa-pss"; readonly hash: "SHA-256" | "SHA-384" | "SHA-512" }
  | { readonly kind: "rsassa-pkcs1-v1_5"; readonly hash: "SHA-256" | "SHA-384" | "SHA-512" };

/** Why a key cannot sign or verify: its place in the list given, and the reason. */
export type DsseKeyError = { readonly kind: "key"; readonly index: number; readonly reason: string };

/** Why an envelope was refused. */
export type DsseError =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "payload-type"; readonly expected: string; readonly found: string }
  | DsseKeyError
  | { readonly kind: "no-valid-signature"; readonly signatures: number; readonly verified: number; readonly threshold: number };

/** Why a signed statement was refused: the envelope's error, or a payload that is not an in-toto statement with the predicate expected. */
export type StatementError = DsseError | { readonly kind: "statement"; readonly error: DecodeError };

/** What a verified envelope carries: its payload type, its payload, and the keys that verified a signature. */
export type Verified = { readonly payloadType: string; readonly payload: Uint8Array; readonly keys: readonly DsseKey[] };

const utf8 = new TextEncoder();

/** A subject: the name, and the SHA-256 of the bytes; `more` adds a URI, a media type or annotations. */
export async function subject(
  name: string,
  bytes: Uint8Array,
  more: { readonly uri?: string; readonly mediaType?: string; readonly annotations?: Readonly<Record<string, unknown>> } = {},
): Promise<ResourceDescriptor> {
  return { name, digest: { sha256: await sha256(bytes) }, ...more };
}

/** A statement of the predicate about the subjects. */
export function statement<P>(subjects: readonly ResourceDescriptor[], predicateType: string, predicate: P): Statement<P> {
  return { _type: STATEMENT_TYPE, subject: subjects, predicateType, predicate };
}

const lowerHex: Decoder<string> = (input, path = "$") =>
  typeof input === "string" && /^(?:[0-9a-f]{2})+$/.test(input)
    ? ok(input)
    : err({ kind: "decode", path, expected: "lower-case hexadecimal", found: describe(input) });

const statementType: Decoder<typeof STATEMENT_TYPE> = (input, path = "$") =>
  input === STATEMENT_TYPE ? ok(STATEMENT_TYPE) : err({ kind: "decode", path, expected: STATEMENT_TYPE, found: describe(input) });

/** The decoder of a ResourceDescriptor with a name and digests. */
export const resourceDescriptorDecoder: Decoder<ResourceDescriptor> = object(
  { name: string, digest: record(lowerHex) },
  { uri: string, mediaType: string, annotations: record(unknownValue) },
);

/** The decoder of an in-toto Statement v1 whose predicate `predicate` decodes. */
export function statementDecoder<P>(predicate: Decoder<P>): Decoder<Statement<P>> {
  return object({ _type: statementType, subject: array(resourceDescriptorDecoder), predicateType: string, predicate });
}

const base64Text: Decoder<string> = (input, path = "$") =>
  typeof input === "string" && fromBase64(input).kind === "ok"
    ? ok(input)
    : err({ kind: "decode", path, expected: "standard base64", found: describe(input) });

/** The decoder of a DSSE envelope: its fields present, and the payload and signatures in base64. */
export const envelopeDecoder: Decoder<DsseEnvelope> = object({
  payload: base64Text,
  payloadType: string,
  signatures: array(object({ sig: base64Text }, { keyid: string })),
});

/** A DSSE envelope read from JSON text, or why it is not one. */
export function parseEnvelope(text: string): Result<DsseEnvelope, DsseError> {
  const r = json(text, envelopeDecoder);
  return r.kind === "ok" ? r : err({ kind: "malformed", reason: formatDecodeError(r.error) });
}

/** DSSE's pre-authentication encoding: `DSSEv1 <len(type)> <type> <len(payload)> <payload>`, the lengths in bytes as ASCII decimal. */
export function pae(payloadType: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const type = utf8.encode(payloadType);
  const head = utf8.encode(`DSSEv1 ${type.length} ${payloadType} ${payload.length} `);
  const out = new Uint8Array(head.length + payload.length);
  out.set(head);
  out.set(payload, head.length);
  return out;
}

const HASHES = ["SHA-256", "SHA-384", "SHA-512"] as const;
const CURVES = ["P-256", "P-384", "P-521"] as const;

function hashOf(algorithm: KeyAlgorithm): (typeof HASHES)[number] | undefined {
  const hash: unknown = "hash" in algorithm ? algorithm.hash : undefined;
  const name: unknown = typeof hash === "object" && hash !== null && "name" in hash ? hash.name : undefined;
  return HASHES.find((h) => h === name);
}

/** The signature algorithm of a key, or the reason it is not one this module uses. */
export function signatureAlgorithm(key: CryptoKey): Result<DsseAlgorithm, string> {
  const a = key.algorithm;
  switch (a.name) {
    case "Ed25519":
      return ok({ kind: "ed25519" });
    case "ECDSA": {
      const named: unknown = "namedCurve" in a ? a.namedCurve : undefined;
      const curve = CURVES.find((c) => c === named);
      return curve === undefined ? err(`the curve ${String(named)} is not one of ${CURVES.join(", ")}`) : ok({ kind: "ecdsa", curve });
    }
    case "RSA-PSS":
    case "RSASSA-PKCS1-v1_5": {
      const hash = hashOf(a);
      if (hash === undefined) return err(`the key's hash is not one of ${HASHES.join(", ")}`);
      return ok(a.name === "RSA-PSS" ? { kind: "rsa-pss", hash } : { kind: "rsassa-pkcs1-v1_5", hash });
    }
    default:
      return err(`${a.name} is not a signature algorithm DSSE is used with here`);
  }
}

const CURVE_BYTES = { "P-256": 32, "P-384": 48, "P-521": 66 } as const;
const CURVE_HASH = { "P-256": "SHA-256", "P-384": "SHA-384", "P-521": "SHA-512" } as const;
const HASH_BYTES = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 } as const;

function webCryptoParams(a: DsseAlgorithm): AlgorithmIdentifier | EcdsaParams | RsaPssParams {
  switch (a.kind) {
    case "ed25519":
      return { name: "Ed25519" };
    case "ecdsa":
      return { name: "ECDSA", hash: CURVE_HASH[a.curve] };
    case "rsa-pss":
      return { name: "RSA-PSS", saltLength: HASH_BYTES[a.hash] };
    case "rsassa-pkcs1-v1_5":
      return { name: "RSASSA-PKCS1-v1_5" };
    default:
      return absurd(a);
  }
}

/** Web Crypto's ECDSA signature (r and s, each `n` bytes) as an ASN.1 DER SEQUENCE of two INTEGERs. */
function ecdsaToDer(raw: Uint8Array, n: number): Uint8Array {
  return sequence(integer(raw.subarray(0, n)), integer(raw.subarray(n, 2 * n)));
}

/** An ASN.1 DER ECDSA signature as Web Crypto's r and s of `n` bytes each, or undefined where it is not one. */
function ecdsaFromDer(der: Uint8Array, n: number): Uint8Array<ArrayBuffer> | undefined {
  const t = readTlv(der);
  if (t.kind === "err" || t.value.tag !== TAG.sequence || t.value.raw.length !== der.length) return undefined;
  const parts = children(t.value.content);
  if (parts.kind === "err" || parts.value.length !== 2) return undefined;
  const out = new Uint8Array(2 * n);
  for (const [i, part] of parts.value.entries()) {
    if (part.tag !== TAG.integer || ((part.content[0] ?? 0x80) & 0x80) !== 0) return undefined;
    const magnitude = part.content[0] === 0 ? part.content.subarray(1) : part.content;
    if (magnitude.length > n) return undefined;
    out.set(magnitude, (i + 1) * n - magnitude.length);
  }
  return out;
}

/** The payload of the type signed by every key given (private keys), in an envelope; or the first key that cannot sign. */
export async function signEnvelope(
  payloadType: string,
  payload: Uint8Array,
  keys: readonly DsseKey[],
): Promise<Result<DsseEnvelope, DsseKeyError>> {
  const message = pae(payloadType, payload);
  const signatures: { readonly keyid?: string; readonly sig: string }[] = [];
  for (const [index, k] of keys.entries()) {
    const a = signatureAlgorithm(k.key);
    if (a.kind === "err") return err({ kind: "key", index, reason: a.error });
    let raw: Uint8Array;
    try {
      raw = new Uint8Array(await crypto.subtle.sign(webCryptoParams(a.value), k.key, message));
    } catch (e) {
      return err({ kind: "key", index, reason: e instanceof Error ? e.message : String(e) });
    }
    const sig = a.value.kind === "ecdsa" ? ecdsaToDer(raw, CURVE_BYTES[a.value.curve]) : raw;
    signatures.push(k.keyid === undefined ? { sig: toBase64(sig) } : { keyid: k.keyid, sig: toBase64(sig) });
  }
  return ok({ payload: toBase64(payload), payloadType, signatures });
}

/**
 * The payload of an envelope whose type is `payloadType` and which at least `threshold` of the keys given (public keys, 1 by default)
 * each verify a signature of. A signature that names a key id is tried only with the keys of that id or of none.
 */
export async function verifyEnvelope(
  envelope: DsseEnvelope,
  payloadType: string,
  keys: readonly DsseKey[],
  threshold = 1,
): Promise<Result<Verified, DsseError>> {
  if (envelope.payloadType !== payloadType) return err({ kind: "payload-type", expected: payloadType, found: envelope.payloadType });
  const payload = fromBase64(envelope.payload);
  if (payload.kind === "err") return err({ kind: "malformed", reason: `the payload: ${payload.error}` });
  const signatures: Uint8Array[] = [];
  for (const [i, s] of envelope.signatures.entries()) {
    const sig = fromBase64(s.sig);
    if (sig.kind === "err") return err({ kind: "malformed", reason: `signature ${i}: ${sig.error}` });
    signatures.push(sig.value);
  }
  const algorithms: DsseAlgorithm[] = [];
  for (const [index, k] of keys.entries()) {
    const a = signatureAlgorithm(k.key);
    if (a.kind === "err") return err({ kind: "key", index, reason: a.error });
    algorithms.push(a.value);
  }
  const message = pae(envelope.payloadType, payload.value);
  const verifiedBy: DsseKey[] = [];
  for (const [index, k] of keys.entries()) {
    const a = algorithms[index];
    if (a === undefined) continue;
    for (const [i, s] of envelope.signatures.entries()) {
      const bytes = signatures[i];
      if (bytes === undefined || (s.keyid !== undefined && k.keyid !== undefined && s.keyid !== k.keyid)) continue;
      const sig = a.kind === "ecdsa" ? ecdsaFromDer(bytes, CURVE_BYTES[a.curve]) : new Uint8Array(bytes);
      if (sig === undefined) continue;
      let valid: boolean;
      try {
        valid = await crypto.subtle.verify(webCryptoParams(a), k.key, sig, message);
      } catch (e) {
        return err({ kind: "key", index, reason: e instanceof Error ? e.message : String(e) });
      }
      if (valid) {
        verifiedBy.push(k);
        break;
      }
    }
  }
  const needed = Math.max(1, threshold);
  if (verifiedBy.length < needed) {
    return err({ kind: "no-valid-signature", signatures: envelope.signatures.length, verified: verifiedBy.length, threshold: needed });
  }
  return ok({ payloadType: envelope.payloadType, payload: payload.value, keys: verifiedBy });
}

/** A statement as JSON, signed by every key given, in an envelope of type `application/vnd.in-toto+json`. */
export function signStatement<P>(s: Statement<P>, keys: readonly DsseKey[]): Promise<Result<DsseEnvelope, DsseKeyError>> {
  return signEnvelope(INTOTO_PAYLOAD_TYPE, utf8.encode(JSON.stringify(s)), keys);
}

/** The statement an envelope of type `application/vnd.in-toto+json` carries, verified as `verifyEnvelope` does, its predicate decoded by `predicate`. */
export async function verifyStatement<P>(
  envelope: DsseEnvelope,
  keys: readonly DsseKey[],
  predicate: Decoder<P>,
  threshold = 1,
): Promise<Result<Statement<P>, StatementError>> {
  const v = await verifyEnvelope(envelope, INTOTO_PAYLOAD_TYPE, keys, threshold);
  if (v.kind === "err") return v;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(v.value.payload);
  } catch {
    return err({ kind: "statement", error: { kind: "decode", path: "$", expected: "UTF-8 text", found: "bytes that are not" } });
  }
  const s = json(text, statementDecoder(predicate));
  return s.kind === "ok" ? s : err({ kind: "statement", error: s.error });
}
