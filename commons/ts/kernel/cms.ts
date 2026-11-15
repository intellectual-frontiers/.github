/**
 * CMS (RFC 5652) AuthEnvelopedData (RFC 5083), the S/MIME (RFC 8551) form a message is encrypted in, on Web Crypto and the kernel's DER
 * alone (commons 0005-typescript-runtime FR-044). Content is encrypted once with AES-256-GCM (RFC 5084), and its key is encrypted to each
 * recipient's RSA public key with RSAES-OAEP, SHA-256 and MGF1 with SHA-256 (RFC 8017, RFC 4055), named by the issuer and serial number of
 * the recipient's X.509 certificate (RFC 5280). The holder of a private key opens it again. PEM is read and written, and a certificate is
 * read for what encryption needs (issuer, serial, key, addresses, validity, key usage). The content key and nonce come from the caller
 * (`cmsKeys` with a source of random bytes), so the kernel has no effect. Taken from Stolos's `src/archon/export/smime.ts` (emailed
 * exports); opening, PEM writing and typed errors are new, and the mail headers stay in Stolos.
 *
 * @example
 * ```ts
 * import { authEnveloped, cmsKeys, readCertificate, readPem } from "./cms.ts";
 * const pem = readPem(certificateText, "CERTIFICATE");
 * if (pem.kind === "ok") {
 *   const cert = readCertificate(pem.value[0] ?? new Uint8Array());
 *   if (cert.kind === "ok") {
 *     const der = await authEnveloped(content, [cert.value], cmsKeys((n) => crypto.getRandomValues(new Uint8Array(n))));
 *   }
 * }
 * ```
 *
 * @module
 */
import { fromBase64, toBase64 } from "./base64.ts";
import {
  algorithm,
  children,
  derNull,
  explicit,
  implicit,
  integer,
  octetString,
  oid,
  readInteger,
  readOid,
  readTlv,
  sequence,
  setOf,
  TAG,
  type Tlv,
} from "./der.ts";
import { err, ok, type Result } from "./result.ts";
import { toHex } from "./sha256.ts";

/** The object identifiers used. */
export const OID = {
  data: "1.2.840.113549.1.7.1",
  authEnvelopedData: "1.2.840.113549.1.9.16.1.23",
  aes256gcm: "2.16.840.1.101.3.4.1.46",
  rsaEncryption: "1.2.840.113549.1.1.1",
  rsaesOaep: "1.2.840.113549.1.1.7",
  mgf1: "1.2.840.113549.1.1.8",
  sha256: "2.16.840.1.101.3.4.2.1",
  commonName: "2.5.4.3",
  emailAddress: "1.2.840.113549.1.9.1",
  subjectAltName: "2.5.29.17",
  keyUsage: "2.5.29.15",
} as const;

/** Why CMS or a certificate could not be read, written or opened. */
export type CmsError =
  | { readonly kind: "pem"; readonly message: string }
  | { readonly kind: "certificate"; readonly message: string }
  | { readonly kind: "unsupported"; readonly message: string }
  | { readonly kind: "structure"; readonly message: string }
  | { readonly kind: "no-recipient"; readonly message: string }
  | { readonly kind: "decrypt"; readonly message: string };

/** A CMS error as one sentence. */
export function formatCmsError(e: CmsError): string {
  return `${e.kind}: ${e.message}`;
}

const fail = (kind: CmsError["kind"], message: string): Result<never, CmsError> => err({ kind, message });

/** Every PEM block of a label (`CERTIFICATE`, `PRIVATE KEY`) in a text, as DER; none found, or a block that is not base64, is an error. */
export function readPem(text: string, label: string): Result<readonly Uint8Array[], CmsError> {
  const out: Uint8Array[] = [];
  const re = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`, "g");
  for (const m of text.matchAll(re)) {
    const der = fromBase64(m[1] ?? "");
    if (der.kind === "err") return fail("pem", `a ${label} block that is not base64`);
    out.push(der.value);
  }
  return out.length === 0 ? fail("pem", `no -----BEGIN ${label}----- block`) : ok(out);
}

/** DER as a PEM block of a label, base64 in 64-column lines. */
export function toPem(der: Uint8Array, label: string): string {
  const lines = toBase64(der).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/** What encryption and a person need from a recipient's X.509 certificate. */
export type Certificate = {
  /** The issuer's Name, its DER exactly as in the certificate. */
  readonly issuer: Uint8Array;
  /** The serial number's INTEGER element, exactly as in the certificate. */
  readonly serial: Uint8Array;
  /** The serial number in hexadecimal. */
  readonly serialHex: string;
  /** The SubjectPublicKeyInfo, DER. */
  readonly spki: Uint8Array;
  /** The public key's algorithm, as an OID. */
  readonly keyAlgorithm: string;
  /** The subject's common name, where it has one. */
  readonly commonName: string | undefined;
  /** The addresses it names (subjectAltName rfc822Name and the subject's emailAddress), in lower case. */
  readonly emails: readonly string[];
  /** When it starts being valid, where its time can be read. */
  readonly notBefore: Date | undefined;
  /** When it stops being valid, where its time can be read. */
  readonly notAfter: Date | undefined;
  /** Whether it may encrypt keys: true where it has no keyUsage extension, else its keyEncipherment bit. */
  readonly keyEncipherment: boolean;
};

const text = (t: Tlv): string => new TextDecoder().decode(t.content);

function readTime(t: Tlv): Date | undefined {
  const s = text(t);
  const m =
    t.tag === TAG.utcTime
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
      : t.tag === TAG.generalizedTime
        ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
        : null;
  if (m === null) return undefined;
  let y = Number(m[1]);
  if (t.tag === TAG.utcTime) y += y >= 50 ? 1900 : 2000;
  return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
}

/** The children of an element, or a `structure` error naming what was being read. */
function kids(t: Tlv | undefined, what: string): Result<readonly Tlv[], CmsError> {
  if (t === undefined) return fail("structure", `no ${what}`);
  const c = children(t.content);
  return c.kind === "ok" ? c : fail("structure", `${what}: ${c.error.message} at byte ${c.error.at}`);
}

function oidOf(t: Tlv | undefined): string | undefined {
  if (t === undefined || t.tag !== TAG.oid) return undefined;
  const r = readOid(t.content);
  return r.kind === "ok" ? r.value : undefined;
}

/** The values of an attribute type in a Name (a SEQUENCE OF SET OF AttributeTypeAndValue). */
function nameValues(name: Tlv, type: string): readonly string[] {
  const out: string[] = [];
  const rdns = kids(name, "a name");
  if (rdns.kind === "err") return out;
  for (const rdn of rdns.value) {
    const atvs = kids(rdn, "a relative name");
    if (atvs.kind === "err") continue;
    for (const atv of atvs.value) {
      const pair = kids(atv, "an attribute");
      if (pair.kind === "err") continue;
      const [t, v] = pair.value;
      if (v !== undefined && oidOf(t) === type) out.push(text(v));
    }
  }
  return out;
}

/** An X.509 certificate read for what encryption needs, or why it is not one this reader takes. */
export function readCertificate(der: Uint8Array): Result<Certificate, CmsError> {
  const cert = readTlv(der);
  if (cert.kind === "err" || cert.value.tag !== TAG.sequence) return fail("certificate", "not a DER certificate");
  const top = kids(cert.value, "a certificate");
  if (top.kind === "err") return top;
  const tbs = top.value[0];
  if (tbs?.tag !== TAG.sequence) return fail("certificate", "no TBSCertificate");
  const f = kids(tbs, "the TBSCertificate");
  if (f.kind === "err") return f;
  let i = f.value[0]?.tag === 0xa0 ? 1 : 0;
  const serial = f.value[i++];
  i++;
  const issuer = f.value[i++];
  const validity = f.value[i++];
  const subject = f.value[i++];
  const spki = f.value[i++];
  if (serial?.tag !== TAG.integer || issuer === undefined || validity === undefined || subject === undefined || spki === undefined) {
    return fail("certificate", "its fields are not where RFC 5280 puts them");
  }
  const alg = kids(spki, "the public key");
  if (alg.kind === "err") return alg;
  const algId = kids(alg.value[0], "the key's algorithm");
  if (algId.kind === "err") return algId;
  const keyAlgorithm = oidOf(algId.value[0]);
  if (keyAlgorithm === undefined) return fail("certificate", "no key algorithm");
  const emails = [...nameValues(subject, OID.emailAddress)];
  let keyEncipherment = true;
  const ext = f.value.slice(i).find((x) => x.tag === 0xa3);
  if (ext !== undefined) {
    const list = kids(ext, "the extensions");
    if (list.kind === "err") return list;
    const items = kids(list.value[0], "the extensions");
    if (items.kind === "err") return items;
    for (const e of items.value) {
      const parts = kids(e, "an extension");
      if (parts.kind === "err") return parts;
      const id = oidOf(parts.value[0]);
      const value = parts.value.at(-1);
      if (value === undefined) continue;
      const inner = readTlv(value.content);
      if (inner.kind === "err") continue;
      if (id === OID.subjectAltName) {
        const names = kids(inner.value, "subjectAltName");
        if (names.kind === "ok") for (const gn of names.value) if (gn.tag === 0x81) emails.push(text(gn));
      } else if (id === OID.keyUsage) {
        keyEncipherment = ((inner.value.content[1] ?? 0) & 0x20) !== 0;
      }
    }
  }
  const times = kids(validity, "the validity");
  const [from, to] = times.kind === "ok" ? times.value : [];
  return ok({
    issuer: issuer.raw,
    serial: serial.raw,
    serialHex: toHex(serial.content),
    spki: spki.raw,
    keyAlgorithm,
    commonName: nameValues(subject, OID.commonName)[0],
    emails: [...new Set(emails.map((e) => e.toLowerCase()))],
    notBefore: from === undefined ? undefined : readTime(from),
    notAfter: to === undefined ? undefined : readTime(to),
    keyEncipherment,
  });
}

/** Why a certificate cannot encrypt to an address now. */
export type CertificateProblem =
  | { readonly kind: "not-rsa"; readonly algorithm: string }
  | { readonly kind: "not-yet-valid"; readonly from: Date }
  | { readonly kind: "expired"; readonly on: Date }
  | { readonly kind: "signing-only" }
  | { readonly kind: "other-address"; readonly names: readonly string[] };

/** Why a certificate cannot be used to encrypt to `address` at `now`, or undefined where it can. */
export function certificateProblem(c: Certificate, address: string, now: Date): CertificateProblem | undefined {
  if (c.keyAlgorithm !== OID.rsaEncryption) return { kind: "not-rsa", algorithm: c.keyAlgorithm };
  if (c.notBefore !== undefined && c.notBefore.getTime() > now.getTime()) return { kind: "not-yet-valid", from: c.notBefore };
  if (c.notAfter !== undefined && c.notAfter.getTime() < now.getTime()) return { kind: "expired", on: c.notAfter };
  if (!c.keyEncipherment) return { kind: "signing-only" };
  if (c.emails.length > 0 && !c.emails.includes(address.toLowerCase())) return { kind: "other-address", names: c.emails };
  return undefined;
}

/** RSAES-OAEP with SHA-256 and MGF1 with SHA-256, as an AlgorithmIdentifier (RFC 4055 §4.1). */
export function oaepSha256(): Uint8Array {
  const sha256 = algorithm(OID.sha256, derNull());
  return algorithm(OID.rsaesOaep, sequence(explicit(0, sha256), explicit(1, algorithm(OID.mgf1, sha256))));
}

/** The fresh secrets of one message: a 32-byte AES-256 content key and a 12-byte GCM nonce. */
export type CmsKeys = { readonly contentKey: Uint8Array; readonly nonce: Uint8Array };

/** Fresh secrets from a source of random bytes, such as `(n) => crypto.getRandomValues(new Uint8Array(n))`. */
export function cmsKeys(random: (length: number) => Uint8Array): CmsKeys {
  return { contentKey: random(32), nonce: random(12) };
}

/**
 * A CMS ContentInfo holding AuthEnvelopedData, as DER: `content` encrypted with AES-256-GCM, its key encrypted to every recipient with
 * RSA-OAEP SHA-256. No recipient, a recipient whose key is not RSA, or keys of the wrong size are errors.
 */
export async function authEnveloped(
  content: Uint8Array,
  recipients: readonly Certificate[],
  keys: CmsKeys,
): Promise<Result<Uint8Array, CmsError>> {
  if (recipients.length === 0) return fail("no-recipient", "no recipient to encrypt to");
  if (keys.contentKey.length !== 32 || keys.nonce.length !== 12) return fail("unsupported", "a content key of 32 bytes and a nonce of 12");
  const notRsa = recipients.find((r) => r.keyAlgorithm !== OID.rsaEncryption);
  if (notRsa !== undefined) return fail("unsupported", `the key of certificate ${notRsa.serialHex} is not RSA (${notRsa.keyAlgorithm})`);
  const aes = await crypto.subtle.importKey("raw", new Uint8Array(keys.contentKey), "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(keys.nonce), tagLength: 128 }, aes, new Uint8Array(content)),
  );
  const infos: Uint8Array[] = [];
  for (const r of recipients) {
    const pub = await crypto.subtle.importKey("spki", new Uint8Array(r.spki), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const ek = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, new Uint8Array(keys.contentKey)));
    infos.push(sequence(integer(0), sequence(r.issuer, r.serial), oaepSha256(), octetString(ek)));
  }
  const eci = sequence(
    oid(OID.data),
    algorithm(OID.aes256gcm, sequence(octetString(keys.nonce), integer(16))),
    implicit(0, sealed.subarray(0, sealed.length - 16), false),
  );
  const aed = sequence(integer(0), setOf(...infos), eci, octetString(sealed.subarray(sealed.length - 16)));
  return ok(sequence(oid(OID.authEnvelopedData), explicit(0, aed)));
}

/** Whether an AlgorithmIdentifier names SHA-256, its parameters NULL or absent (both are accepted, RFC 4055 §2.1, RFC 5754 §2). */
function isSha256(t: Tlv | undefined): boolean {
  const parts = t === undefined ? undefined : children(t.content);
  if (parts?.kind !== "ok" || oidOf(parts.value[0]) !== OID.sha256) return false;
  const params = parts.value[1];
  return parts.value.length === 1 || (parts.value.length === 2 && params?.tag === TAG.null && params.content.length === 0);
}

/** Whether an AlgorithmIdentifier is RSAES-OAEP with SHA-256, MGF1 with SHA-256 and the default label, however its NULLs are written. */
export function isOaepSha256(t: Tlv): boolean {
  const parts = children(t.content);
  if (parts.kind === "err" || oidOf(parts.value[0]) !== OID.rsaesOaep) return false;
  const params = kids(parts.value[1], "the OAEP parameters");
  if (params.kind === "err") return false;
  const hash = params.value.find((p) => p.tag === 0xa0);
  const mgf = params.value.find((p) => p.tag === 0xa1);
  if (params.value.some((p) => p.tag !== 0xa0 && p.tag !== 0xa1) || hash === undefined || mgf === undefined) return false;
  const h = readTlv(hash.content);
  const m = readTlv(mgf.content);
  if (h.kind === "err" || m.kind === "err" || !isSha256(h.value)) return false;
  const mgfParts = children(m.value.content);
  return mgfParts.kind === "ok" && oidOf(mgfParts.value[0]) === OID.mgf1 && isSha256(mgfParts.value[1]);
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, k) => x === b[k]);

/**
 * The content of an AuthEnvelopedData, opened by the recipient whose certificate is `cert` with its RSA-OAEP SHA-256 private key; or why
 * it cannot be: not this structure, no RecipientInfo for this certificate, or a key or tag that does not decrypt (the content was changed).
 */
export async function openAuthEnveloped(der: Uint8Array, cert: Certificate, privateKey: CryptoKey): Promise<Result<Uint8Array, CmsError>> {
  const info = readTlv(der);
  if (info.kind === "err") return fail("structure", "not DER");
  const ci = kids(info.value, "the ContentInfo");
  if (ci.kind === "err") return ci;
  if (oidOf(ci.value[0]) !== OID.authEnvelopedData) return fail("structure", "not AuthEnvelopedData");
  const wrapped = kids(ci.value[1], "the content");
  if (wrapped.kind === "err") return wrapped;
  const aed = kids(wrapped.value[0], "the AuthEnvelopedData");
  if (aed.kind === "err") return aed;
  const [version, recipientSet, eci, mac] = aed.value;
  if (version?.tag !== TAG.integer || recipientSet?.tag !== TAG.set || eci === undefined || mac?.tag !== TAG.octetString) {
    return fail("structure", "an AuthEnvelopedData without its four fields (attributes are not read)");
  }
  const v = readInteger(version.content);
  if (v.kind === "err" || v.value !== 0n) return fail("unsupported", "an AuthEnvelopedData of version 0");
  const infos = kids(recipientSet, "the RecipientInfos");
  if (infos.kind === "err") return infos;
  let encryptedKey: Uint8Array | undefined;
  for (const r of infos.value) {
    const parts = kids(r, "a RecipientInfo");
    if (parts.kind === "err") return parts;
    const [, rid, alg, ek] = parts.value;
    const ids = kids(rid, "an IssuerAndSerialNumber");
    if (ids.kind === "err" || ek === undefined || alg === undefined) continue;
    const [issuer, serial] = ids.value;
    if (issuer !== undefined && serial !== undefined && same(issuer.raw, cert.issuer) && same(serial.raw, cert.serial)) {
      if (!isOaepSha256(alg)) return fail("unsupported", "a key encrypted with RSA-OAEP, SHA-256 and MGF1 with SHA-256");
      encryptedKey = ek.content;
    }
  }
  if (encryptedKey === undefined) return fail("no-recipient", `no RecipientInfo for certificate ${cert.serialHex}`);
  const ec = kids(eci, "the EncryptedContentInfo");
  if (ec.kind === "err") return ec;
  const [type, cipher, body] = ec.value;
  const cipherParts = kids(cipher, "the content's algorithm");
  if (cipherParts.kind === "err") return cipherParts;
  if (oidOf(type) !== OID.data || oidOf(cipherParts.value[0]) !== OID.aes256gcm || body?.tag !== 0x80) {
    return fail("unsupported", "id-data content encrypted with AES-256-GCM");
  }
  const params = kids(cipherParts.value[1], "the GCM parameters");
  if (params.kind === "err") return params;
  const nonce = params.value[0];
  if (nonce?.tag !== TAG.octetString) return fail("structure", "no GCM nonce");
  let rawKey: Uint8Array;
  try {
    rawKey = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, new Uint8Array(encryptedKey)));
  } catch {
    return fail("decrypt", "the content key does not decrypt with this private key");
  }
  try {
    const aes = await crypto.subtle.importKey("raw", new Uint8Array(rawKey), "AES-GCM", false, ["decrypt"]);
    const sealed = new Uint8Array(body.content.length + mac.content.length);
    sealed.set(body.content);
    sealed.set(mac.content, body.content.length);
    return ok(
      new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(nonce.content), tagLength: 128 }, aes, sealed)),
    );
  } catch {
    return fail("decrypt", "the content does not decrypt: it was changed, or the key is not its own");
  }
}
