/**
 * Tests of `cms.ts`: certificates built at run time with the kernel's own DER (no key or certificate is kept in this public
 * repository), read for what encryption needs; content encrypted to one or more recipients and opened by each of them (property-tested);
 * a changed message, a wrong key, a certificate it was not encrypted to and an EC certificate refused; PEM both ways.
 *
 * @module
 */
import fc from "fast-check";
import {
  authEnveloped,
  type Certificate,
  certificateProblem,
  cmsKeys,
  isOaepSha256,
  OID,
  oaepSha256,
  openAuthEnveloped,
  readCertificate,
  readPem,
  toPem,
} from "../src/cms.ts";
import {
  algorithm,
  bitString,
  boolean,
  children,
  derNull,
  explicit,
  integer,
  octetString,
  oid,
  readOid,
  readTlv,
  sequence,
  setOf,
  TAG,
  tlv,
  utf8String,
} from "@intellectual-frontiers/formats/der";
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-crypto FR-005";

const name = (cn: string): Uint8Array => sequence(setOf(sequence(oid(OID.commonName), utf8String(cn))));
const utc = (s: string): Uint8Array => tlv(TAG.utcTime, new TextEncoder().encode(s));

/** A certificate for a public key, built with the kernel's DER; its signature is not real (nothing here checks it). */
function certificate(
  spki: Uint8Array,
  o: { readonly serial: number; readonly cn: string; readonly email?: string; readonly keyUsage?: number; readonly until?: string },
): Uint8Array {
  const extensions: Uint8Array[] = [];
  if (o.keyUsage !== undefined)
    extensions.push(sequence(oid(OID.keyUsage), boolean(true), octetString(tlv(TAG.bitString, Uint8Array.of(5, o.keyUsage)))));
  if (o.email !== undefined)
    extensions.push(sequence(oid(OID.subjectAltName), octetString(sequence(tlv(0x81, new TextEncoder().encode(o.email))))));
  const sigAlg = algorithm("1.2.840.113549.1.1.11", derNull());
  const tbs = sequence(
    explicit(0, integer(2)),
    integer(o.serial),
    sigAlg,
    name("Test CA"),
    sequence(utc("260101000000Z"), utc(o.until ?? "361231235959Z")),
    name(o.cn),
    spki,
    ...(extensions.length > 0 ? [explicit(3, sequence(...extensions))] : []),
  );
  return sequence(tbs, sigAlg, bitString(new Uint8Array(16)));
}

type Party = { readonly cert: Certificate; readonly der: Uint8Array; readonly key: CryptoKey };

async function party(serial: number, cn: string, email?: string): Promise<Party> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const der = certificate(spki, { serial, cn, ...(email === undefined ? {} : { email }), keyUsage: 0xa0 });
  const cert = readCertificate(der);
  if (cert.kind === "err") throw new Error(cert.error.message);
  return { cert: cert.value, der, key: pair.privateKey };
}

const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const alice = party(1001, "Alice", "Alice@Example.org");
const bob = party(1002, "Bob");

proves([FR], "a certificate is read for its issuer, serial, key, addresses, validity and key usage; PEM both ways", async () => {
  const a = await alice;
  assertEquals(
    [a.cert.serialHex, a.cert.commonName, a.cert.emails, a.cert.keyAlgorithm, a.cert.keyEncipherment],
    ["03e9", "Alice", ["alice@example.org"], OID.rsaEncryption, true],
  );
  assertEquals([a.cert.notBefore?.toISOString(), a.cert.notAfter?.toISOString()], ["2026-01-01T00:00:00.000Z", "2036-12-31T23:59:59.000Z"]);
  const issuer = readTlv(a.cert.issuer);
  assert(issuer.kind === "ok" && issuer.value.tag === TAG.sequence);
  const pem = toPem(a.der, "CERTIFICATE");
  assert(pem.startsWith("-----BEGIN CERTIFICATE-----\n") && pem.split("\n").every((l) => l.length <= 64));
  assertEquals(readPem(`junk\n${pem}${pem}`, "CERTIFICATE"), { kind: "ok", value: [a.der, a.der] });
  assertEquals(readPem("nothing here", "CERTIFICATE").kind, "err");
  assertEquals(readPem("-----BEGIN CERTIFICATE-----\n!!\n-----END CERTIFICATE-----", "CERTIFICATE").kind, "err");
  assertEquals(readCertificate(Uint8Array.of(1, 2, 3)).kind, "err");
  assertEquals(readCertificate(sequence(sequence(integer(1)))).kind, "err");
});

proves([FR], "a certificate that cannot encrypt to an address now is named with why", async () => {
  const a = await alice;
  const now = new Date("2030-06-01T00:00:00Z");
  assertEquals(certificateProblem(a.cert, "alice@example.org", now), undefined);
  assertEquals(certificateProblem(a.cert, "ALICE@example.org", now), undefined);
  assertEquals(certificateProblem(a.cert, "eve@example.org", now), { kind: "other-address", names: ["alice@example.org"] });
  assertEquals(certificateProblem(a.cert, "alice@example.org", new Date("2040-01-01T00:00:00Z"))?.kind, "expired");
  assertEquals(certificateProblem(a.cert, "alice@example.org", new Date("2025-01-01T00:00:00Z"))?.kind, "not-yet-valid");
  const signing = readCertificate(certificate(new Uint8Array((await alice).cert.spki), { serial: 7, cn: "S", keyUsage: 0x80 }));
  assert(signing.kind === "ok");
  assertEquals(certificateProblem(signing.value, "s@example.org", now), { kind: "signing-only" });
  const ec = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const ecCert = readCertificate(certificate(new Uint8Array(await crypto.subtle.exportKey("spki", ec.publicKey)), { serial: 8, cn: "EC" }));
  assert(ecCert.kind === "ok");
  assertEquals(certificateProblem(ecCert.value, "x@example.org", now)?.kind, "not-rsa");
  assertEquals((await authEnveloped(new Uint8Array(1), [ecCert.value], cmsKeys(random))).kind, "err");
});

proves(
  [FR, "0005-typescript-runtime FR-014"],
  "content encrypted to recipients is opened by each of them, and is what was encrypted",
  async () => {
    const [a, b] = [await alice, await bob];
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 5000 }), async (content) => {
        const der = await authEnveloped(content, [a.cert, b.cert], cmsKeys(random));
        assert(der.kind === "ok");
        assertEquals(await openAuthEnveloped(der.value, a.cert, a.key), { kind: "ok", value: content });
        assertEquals(await openAuthEnveloped(der.value, b.cert, b.key), { kind: "ok", value: content });
      }),
      { numRuns: 8 },
    );
  },
);

proves(
  [FR],
  "the structure is RFC 5083's: ContentInfo, version 0, one KeyTransRecipientInfo each, AES-256-GCM with a 16-byte tag",
  async () => {
    const a = await alice;
    const der = await authEnveloped(new TextEncoder().encode("hello"), [a.cert], {
      contentKey: new Uint8Array(32).fill(1),
      nonce: new Uint8Array(12).fill(2),
    });
    assert(der.kind === "ok");
    const ci = readTlv(der.value);
    assert(ci.kind === "ok");
    const top = children(ci.value.content);
    assert(top.kind === "ok");
    assertEquals(readOid(top.value[0]?.content ?? new Uint8Array()), { kind: "ok", value: OID.authEnvelopedData });
    const inner = readTlv(top.value[1]?.content ?? new Uint8Array());
    assert(inner.kind === "ok" && inner.value.tag === TAG.sequence);
    const fields = children(inner.value.content);
    assert(fields.kind === "ok");
    assertEquals(
      fields.value.map((f) => f.tag),
      [TAG.integer, TAG.set, TAG.sequence, TAG.octetString],
    );
    assertEquals(fields.value[3]?.content.length, 16);
    const info = children(fields.value[1]?.content ?? new Uint8Array());
    assert(info.kind === "ok" && info.value.length === 1);
    const ktri = children(info.value[0]?.content ?? new Uint8Array());
    assert(ktri.kind === "ok");
    assertEquals(ktri.value[2]?.raw, oaepSha256());
    const absent = algorithm(
      OID.rsaesOaep,
      sequence(explicit(0, algorithm(OID.sha256)), explicit(1, algorithm(OID.mgf1, algorithm(OID.sha256)))),
    );
    const sha1 = algorithm(
      OID.rsaesOaep,
      sequence(explicit(0, algorithm("1.3.14.3.2.26", derNull())), explicit(1, algorithm(OID.mgf1, algorithm("1.3.14.3.2.26", derNull())))),
    );
    const read = (b: Uint8Array): boolean => {
      const t = readTlv(b);
      return t.kind === "ok" && isOaepSha256(t.value);
    };
    assertEquals([read(oaepSha256()), read(absent), read(sha1), read(algorithm(OID.rsaEncryption, derNull()))], [true, true, false, false]);
    assertEquals(ktri.value[1]?.raw, sequence(a.cert.issuer, a.cert.serial));
    assertEquals((await authEnveloped(new Uint8Array(), [], cmsKeys(random))).kind, "err");
    assertEquals(
      (await authEnveloped(new Uint8Array(), [a.cert], { contentKey: new Uint8Array(16), nonce: new Uint8Array(12) })).kind,
      "err",
    );
  },
);

proves([FR], "a changed message, a wrong key, and a certificate it was not encrypted to are refused", async () => {
  const [a, b] = [await alice, await bob];
  const der = await authEnveloped(new TextEncoder().encode("secret"), [a.cert], cmsKeys(random));
  assert(der.kind === "ok");
  const tampered = new Uint8Array(der.value);
  tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 1;
  const t = await openAuthEnveloped(tampered, a.cert, a.key);
  assertEquals(t.kind === "err" ? t.error.kind : "ok", "decrypt");
  const notFor = await openAuthEnveloped(der.value, b.cert, b.key);
  assertEquals(notFor.kind === "err" ? notFor.error.kind : "ok", "no-recipient");
  const wrongKey = await openAuthEnveloped(der.value, a.cert, b.key);
  assertEquals(wrongKey.kind === "err" ? wrongKey.error.kind : "ok", "decrypt");
  const garbage = await openAuthEnveloped(Uint8Array.of(0x30, 0x03, 2, 1, 0), a.cert, a.key);
  assertEquals(garbage.kind === "err" ? garbage.error.kind : "ok", "structure");
});
