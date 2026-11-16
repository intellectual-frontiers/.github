/**
 * COSE keys and signatures (RFC 9052, RFC 9053) as WebAuthn uses them (commons 0014-webauthn FR-002): a credential's public key read from
 * its CBOR `COSE_Key`, checked for one of the two algorithms commons accepts (ES256, `-7`: ECDSA on P-256 with SHA-256; EdDSA, `-8`: Ed25519),
 * imported into Web Crypto, and a signature verified with it, an ECDSA signature turned from the DER `Ecdsa-Sig-Value` an authenticator
 * gives into the raw `r || s` Web Crypto takes. A `COSE_Key` can also be made from a public JSON Web Key, which is how a test (or a
 * migration from stored JWKs) writes one.
 *
 * @example
 * ```ts
 * import { coseKeyFromJwk, parseCoseKey, verifyCose } from "./cose.ts";
 * const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
 * const cose = coseKeyFromJwk(await crypto.subtle.exportKey("jwk", pair.publicKey));
 * const data = new TextEncoder().encode("signed");
 * const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, data));
 * if (cose.kind === "ok") {
 *   const key = parseCoseKey(cose.value);
 *   if (key.kind === "ok") await verifyCose(key.value, sig, data); // { kind: "ok", value: true }
 * }
 * ```
 *
 * @limits
 * Only ES256 on P-256 and EdDSA on Ed25519: RS256 and the other algorithms an authenticator may offer are refused, as commons never offers
 * them.
 *
 * @module
 */
import { fromBase64Url, toBase64Url } from "./base64.ts";
import { type CborKey, type CborValue, decodeCbor, encodeCbor, formatCborError, isMap } from "./cbor.ts";
import { children, readTlv, TAG } from "./der.ts";
import { err, ok, type Result } from "./result.ts";

/** COSE's identifier of ES256: ECDSA on P-256 with SHA-256. */
export const ES256 = -7;
/** COSE's identifier of EdDSA (here always Ed25519). */
export const EDDSA = -8;
/** The algorithms commons accepts, in order of preference. */
export const ALGORITHMS: readonly number[] = [EDDSA, ES256];

/** A public key read from a `COSE_Key`: an EC2 key on P-256 for ES256, or an OKP key on Ed25519 for EdDSA. */
export type CoseKey =
  | { readonly kty: "EC2"; readonly alg: typeof ES256; readonly crv: "P-256"; readonly x: Uint8Array; readonly y: Uint8Array }
  | { readonly kty: "OKP"; readonly alg: typeof EDDSA; readonly crv: "Ed25519"; readonly x: Uint8Array };

function bytesAt(m: ReadonlyMap<CborKey, CborValue>, label: number, name: string, size: number): Result<Uint8Array, string> {
  const v = m.get(label);
  if (!(v instanceof Uint8Array)) return err(`the COSE key has no ${name} as bytes`);
  if (v.length !== size) return err(`the COSE key's ${name} is ${v.length} bytes, not ${size}`);
  return ok(v);
}

/** A `COSE_Key` read from its CBOR: a map with `kty` (1), `alg` (3), `crv` (-1), `x` (-2) and, for EC2, `y` (-3); anything else refused. */
export function parseCoseKey(bytes: Uint8Array): Result<CoseKey, string> {
  const d = decodeCbor(bytes);
  if (d.kind === "err") return err(`the COSE key is not CBOR (${formatCborError(d.error)})`);
  const m = d.value;
  if (!isMap(m)) return err("the COSE key is not a CBOR map");
  const kty = m.get(1);
  const alg = m.get(3);
  const crv = m.get(-1);
  if (alg === ES256) {
    if (kty !== 2) return err("an ES256 COSE key whose kty is not EC2 (2)");
    if (crv !== 1) return err("an ES256 COSE key whose curve is not P-256 (1)");
    const x = bytesAt(m, -2, "x", 32);
    if (x.kind === "err") return x;
    const y = bytesAt(m, -3, "y", 32);
    if (y.kind === "err") return y;
    return ok({ kty: "EC2", alg: ES256, crv: "P-256", x: x.value, y: y.value });
  }
  if (alg === EDDSA) {
    if (kty !== 1) return err("an EdDSA COSE key whose kty is not OKP (1)");
    if (crv !== 6) return err("an EdDSA COSE key whose curve is not Ed25519 (6)");
    const x = bytesAt(m, -2, "x", 32);
    if (x.kind === "err") return x;
    return ok({ kty: "OKP", alg: EDDSA, crv: "Ed25519", x: x.value });
  }
  return err(
    `the COSE key's algorithm ${typeof alg === "number" || typeof alg === "bigint" ? String(alg) : "(none)"} is not accepted (only ES256, -7, and EdDSA, -8)`,
  );
}

/** The CBOR `COSE_Key` of a key (deterministic: its labels sorted). */
export function encodeCoseKey(key: CoseKey): Uint8Array {
  const m = new Map<CborKey, CborValue>(
    key.kty === "EC2"
      ? [
          [1, 2],
          [3, ES256],
          [-1, 1],
          [-2, key.x],
          [-3, key.y],
        ]
      : [
          [1, 1],
          [3, EDDSA],
          [-1, 6],
          [-2, key.x],
        ],
  );
  return encodeCbor(m);
}

/** The `COSE_Key` of a public JSON Web Key: EC on P-256 (as ES256) or OKP on Ed25519 (as EdDSA); any other key refused. */
export function coseKeyFromJwk(jwk: JsonWebKey): Result<Uint8Array, string> {
  const b = (v: string | undefined, name: string): Result<Uint8Array, string> => {
    if (v === undefined) return err(`the JWK has no ${name}`);
    const r = fromBase64Url(v);
    return r.kind === "ok" && r.value.length === 32 ? r : err(`the JWK's ${name} is not 32 bytes of base64url`);
  };
  if (jwk.kty === "EC" && jwk.crv === "P-256") {
    const x = b(jwk.x, "x");
    if (x.kind === "err") return x;
    const y = b(jwk.y, "y");
    if (y.kind === "err") return y;
    return ok(encodeCoseKey({ kty: "EC2", alg: ES256, crv: "P-256", x: x.value, y: y.value }));
  }
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") {
    const x = b(jwk.x, "x");
    if (x.kind === "err") return x;
    return ok(encodeCoseKey({ kty: "OKP", alg: EDDSA, crv: "Ed25519", x: x.value }));
  }
  return err(`a JWK of type ${String(jwk.kty)} on ${String(jwk.crv)} (only EC on P-256 and OKP on Ed25519)`);
}

/** The public JSON Web Key of a COSE key. */
export function jwkOfCoseKey(key: CoseKey): JsonWebKey {
  return key.kty === "EC2"
    ? { kty: "EC", crv: "P-256", x: toBase64Url(key.x), y: toBase64Url(key.y) }
    : { kty: "OKP", crv: "Ed25519", x: toBase64Url(key.x) };
}

/** Bytes Web Crypto takes as a `BufferSource` (a copy on its own `ArrayBuffer`). */
function own(b: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(b);
}

/** The key imported into Web Crypto for verifying; a point not on its curve is refused. */
export async function importCoseKey(key: CoseKey): Promise<Result<CryptoKey, string>> {
  try {
    if (key.kty === "EC2") {
      const raw = new Uint8Array(65);
      raw[0] = 4;
      raw.set(key.x, 1);
      raw.set(key.y, 33);
      return ok(await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]));
    }
    return ok(await crypto.subtle.importKey("raw", own(key.x), { name: "Ed25519" }, false, ["verify"]));
  } catch (e) {
    return err(`the public key cannot be used (${e instanceof Error ? e.message : String(e)})`);
  }
}

/** An integer of a DER signature as exactly `size` unsigned big-endian bytes, or undefined where it does not fit or is negative. */
function fixed(content: Uint8Array, size: number): Uint8Array | undefined {
  if (content.length === 0 || ((content[0] ?? 0) & 0x80) !== 0) return undefined;
  let start = 0;
  while (start < content.length - 1 && content[start] === 0) start++;
  const magnitude = content.subarray(start);
  if (magnitude.length > size) return undefined;
  const out = new Uint8Array(size);
  out.set(magnitude, size - magnitude.length);
  return out;
}

/** An ECDSA signature as DER (`Ecdsa-Sig-Value ::= SEQUENCE { r INTEGER, s INTEGER }`) turned into raw `r || s` of `size` bytes each. */
export function ecdsaDerToRaw(der: Uint8Array, size = 32): Result<Uint8Array, string> {
  const seq = readTlv(der);
  if (seq.kind === "err" || seq.value.tag !== TAG.sequence || seq.value.raw.length !== der.length)
    return err("the ECDSA signature is not a DER sequence");
  const parts = children(seq.value.content);
  if (parts.kind === "err" || parts.value.length !== 2) return err("the ECDSA signature is not two integers");
  const [r, s] = parts.value;
  if (r === undefined || s === undefined || r.tag !== TAG.integer || s.tag !== TAG.integer)
    return err("the ECDSA signature is not two integers");
  const rr = fixed(r.content, size);
  const ss = fixed(s.content, size);
  if (rr === undefined || ss === undefined) return err(`the ECDSA signature's integers do not fit ${size} bytes`);
  const out = new Uint8Array(size * 2);
  out.set(rr, 0);
  out.set(ss, size);
  return ok(out);
}

/** Whether `signature` is the key's signature of `data` (ES256: DER as WebAuthn gives it; EdDSA: 64 raw bytes); an unusable key or a malformed signature is an error. */
export async function verifyCose(key: CoseKey, signature: Uint8Array, data: Uint8Array): Promise<Result<boolean, string>> {
  const k = await importCoseKey(key);
  if (k.kind === "err") return k;
  try {
    if (key.kty === "EC2") {
      const raw = ecdsaDerToRaw(signature);
      if (raw.kind === "err") return raw;
      return ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.value, own(raw.value), own(data)));
    }
    if (signature.length !== 64) return err(`the Ed25519 signature is ${signature.length} bytes, not 64`);
    return ok(await crypto.subtle.verify({ name: "Ed25519" }, k.value, own(signature), own(data)));
  } catch (e) {
    return err(`the signature cannot be checked (${e instanceof Error ? e.message : String(e)})`);
  }
}
