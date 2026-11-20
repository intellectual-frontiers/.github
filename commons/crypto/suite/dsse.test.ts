/**
 * Tests of `dsse.ts`: PAE against the DSSE specification's example, sign and verify round trips with every algorithm the module
 * uses (random payloads and payload types, property-tested), envelopes refused with the error that says why (a tampered payload or
 * signature, a wrong key or payload type, bad base64, a missing field), and in-toto statements whose subjects carry the SHA-256 of their
 * bytes.
 *
 * @module
 */
import fc from "fast-check";
import { fromBase64, toBase64 } from "@intellectual-frontiers/formats/base64";
import { object, string, unknownValue } from "@intellectual-frontiers/core";
import {
  type DsseEnvelope,
  type DsseKey,
  envelopeDecoder,
  INTOTO_PAYLOAD_TYPE,
  pae,
  parseEnvelope,
  signatureAlgorithm,
  signEnvelope,
  signStatement,
  STATEMENT_TYPE,
  statement,
  statementDecoder,
  subject,
  verifyEnvelope,
  verifyStatement,
} from "../src/dsse.ts";
import { sha256 } from "../src/sha256.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const DSSE = "0001-crypto FR-006";
const LAWS = "0005-typescript-runtime FR-014";

const enc = new TextEncoder();
const dec = new TextDecoder();

const rsa = { modulusLength: 2048, publicExponent: Uint8Array.of(1, 0, 1) };
const ALGORITHMS: readonly { readonly label: string; readonly params: AlgorithmIdentifier | EcKeyGenParams | RsaHashedKeyGenParams }[] = [
  { label: "Ed25519", params: { name: "Ed25519" } },
  { label: "ECDSA P-256", params: { name: "ECDSA", namedCurve: "P-256" } },
  { label: "ECDSA P-384", params: { name: "ECDSA", namedCurve: "P-384" } },
  { label: "ECDSA P-521", params: { name: "ECDSA", namedCurve: "P-521" } },
  { label: "RSA-PSS SHA-256", params: { name: "RSA-PSS", hash: "SHA-256", ...rsa } },
  { label: "RSASSA-PKCS1-v1_5 SHA-256", params: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", ...rsa } },
];

async function pair(params: AlgorithmIdentifier | EcKeyGenParams | RsaHashedKeyGenParams): Promise<CryptoKeyPair> {
  const k = await crypto.subtle.generateKey(params, true, ["sign", "verify"]);
  assert("privateKey" in k, "a key pair");
  return k;
}

function value<T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T {
  if (r.kind === "err") throw new Error(`expected a success, found ${JSON.stringify(r.error)}`);
  return r.value;
}

function errorKind<T, E extends { readonly kind: string }>(
  r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E },
): string {
  return r.kind === "err" ? r.error.kind : "ok";
}

const TYPE = "application/vnd.example+json";

proves([DSSE], "PAE as the DSSE specification's example gives it, the lengths in bytes", () => {
  assertEquals(
    dec.decode(pae("http://example.com/HelloWorld", enc.encode("hello world"))),
    "DSSEv1 29 http://example.com/HelloWorld 11 hello world",
  );
  assertEquals(dec.decode(pae("t", enc.encode("é"))), "DSSEv1 1 t 2 é");
  assertEquals(dec.decode(pae("é", new Uint8Array())), "DSSEv1 2 é 0 ");
});

for (const a of ALGORITHMS) {
  proves([DSSE], `a payload signed with ${a.label} verifies, by the key's id`, async () => {
    const k = await pair(a.params);
    const payload = enc.encode('{"hello":"world"}');
    const env = value(await signEnvelope(TYPE, payload, [{ key: k.privateKey, keyid: "k1" }]));
    assertEquals(env.payloadType, TYPE);
    assertEquals(env.signatures[0]?.keyid, "k1");
    const v = value(await verifyEnvelope(env, TYPE, [{ key: k.publicKey, keyid: "k1" }]));
    assertEquals(dec.decode(v.payload), '{"hello":"world"}');
    assertEquals(v.keys.length, 1);
    // A key of another id is not tried; a key of no id is.
    assertEquals(errorKind(await verifyEnvelope(env, TYPE, [{ key: k.publicKey, keyid: "k2" }])), "no-valid-signature");
    assertEquals(errorKind(await verifyEnvelope(env, TYPE, [{ key: k.publicKey }])), "ok");
  });
}

proves([DSSE], "ECDSA signatures are ASN.1 DER, as sigstore and in-toto write them, and Web Crypto's raw form is refused", async () => {
  const k = await pair({ name: "ECDSA", namedCurve: "P-256" });
  const payload = enc.encode("x");
  const env = value(await signEnvelope(TYPE, payload, [{ key: k.privateKey }]));
  const sig = value(fromBase64(env.signatures[0]?.sig ?? ""));
  assertEquals(sig[0], 0x30);
  const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k.privateKey, pae(TYPE, payload)));
  const rawEnv: DsseEnvelope = { ...env, signatures: [{ sig: toBase64(raw) }] };
  assertEquals(errorKind(await verifyEnvelope(rawEnv, TYPE, [{ key: k.publicKey }])), "no-valid-signature");
});

proves([DSSE], "the algorithm read from a key, and a key of no signature algorithm refused", async () => {
  const ec = await pair({ name: "ECDSA", namedCurve: "P-384" });
  assertEquals(value(signatureAlgorithm(ec.publicKey)), { kind: "ecdsa", curve: "P-384" });
  const hmac = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  assertEquals(signatureAlgorithm(hmac).kind, "err");
  const signed = await signEnvelope(TYPE, enc.encode("x"), [{ key: hmac }]);
  assertEquals(signed.kind === "err" ? signed.error : undefined, {
    kind: "key",
    index: 0,
    reason: "HMAC is not a signature algorithm DSSE is used with here",
  });
  // A public key cannot sign: the error names it.
  const ed = await pair({ name: "Ed25519" });
  assertEquals(errorKind(await signEnvelope(TYPE, enc.encode("x"), [{ key: ed.privateKey }, { key: ed.publicKey }])), "key");
});

proves([DSSE, LAWS], "sign then verify gives the payload back, for any payload and payload type (Ed25519 and ECDSA P-256)", async () => {
  const ed = await pair({ name: "Ed25519" });
  const ec = await pair({ name: "ECDSA", namedCurve: "P-256" });
  await fc.assert(
    fc.asyncProperty(fc.uint8Array({ maxLength: 512 }), fc.string({ unit: "grapheme", maxLength: 40 }), async (payload, type) => {
      const env = value(
        await signEnvelope(type, payload, [
          { key: ed.privateKey, keyid: "ed" },
          { key: ec.privateKey, keyid: "ec" },
        ]),
      );
      const back = value(parseEnvelope(JSON.stringify(env)));
      const v = value(
        await verifyEnvelope(
          back,
          type,
          [
            { key: ed.publicKey, keyid: "ed" },
            { key: ec.publicKey, keyid: "ec" },
          ],
          2,
        ),
      );
      assertEquals(v.payload, payload);
      assertEquals(v.payloadType, type);
      assertEquals(v.keys.length, 2);
    }),
    { numRuns: 40 },
  );
});

proves(
  [DSSE],
  "a tampered payload, a tampered signature, a wrong key and a wrong payload type are refused, each with its kind",
  async () => {
    const k = await pair({ name: "Ed25519" });
    const other = await pair({ name: "Ed25519" });
    const env = value(await signEnvelope(TYPE, enc.encode("the payload"), [{ key: k.privateKey }]));
    const good = [{ key: k.publicKey }];
    const tamperedPayload: DsseEnvelope = { ...env, payload: toBase64(enc.encode("the payloaD")) };
    assertEquals(errorKind(await verifyEnvelope(tamperedPayload, TYPE, good)), "no-valid-signature");
    const sig = value(fromBase64(env.signatures[0]?.sig ?? ""));
    const flipped = Uint8Array.from(sig, (b, i) => (i === 5 ? b ^ 1 : b));
    const tamperedSig: DsseEnvelope = { ...env, signatures: [{ sig: toBase64(flipped) }] };
    assertEquals(errorKind(await verifyEnvelope(tamperedSig, TYPE, good)), "no-valid-signature");
    const wrongKey = await verifyEnvelope(env, TYPE, [{ key: other.publicKey }]);
    assertEquals(wrongKey.kind === "err" ? wrongKey.error : undefined, {
      kind: "no-valid-signature",
      signatures: 1,
      verified: 0,
      threshold: 1,
    });
    const wrongType = await verifyEnvelope(env, "text/plain", good);
    assertEquals(wrongType.kind === "err" ? wrongType.error : undefined, { kind: "payload-type", expected: "text/plain", found: TYPE });
    // The payload type is signed too: changing it in the envelope breaks the signature.
    assertEquals(errorKind(await verifyEnvelope({ ...env, payloadType: "text/plain" }, "text/plain", good)), "no-valid-signature");
    // No signature at all, and a threshold one key cannot meet.
    assertEquals(errorKind(await verifyEnvelope({ ...env, signatures: [] }, TYPE, good)), "no-valid-signature");
    assertEquals(errorKind(await verifyEnvelope(env, TYPE, [...good, ...good], 2)), "ok");
    assertEquals(errorKind(await verifyEnvelope(env, TYPE, [...good, { key: other.publicKey }], 2)), "no-valid-signature");
  },
);

proves([DSSE], "a malformed envelope is refused: not JSON, a missing field, bad base64", async () => {
  assertEquals(errorKind(parseEnvelope("{")), "malformed");
  assertEquals(errorKind(parseEnvelope('{"payloadType":"t","signatures":[]}')), "malformed");
  assertEquals(errorKind(parseEnvelope('{"payload":"","payloadType":"t"}')), "malformed");
  assertEquals(errorKind(parseEnvelope('{"payload":"","payloadType":"t","signatures":[{"keyid":"k"}]}')), "malformed");
  assertEquals(errorKind(parseEnvelope('{"payload":"not base64!","payloadType":"t","signatures":[]}')), "malformed");
  assertEquals(errorKind(parseEnvelope('{"payload":"","payloadType":"t","signatures":[{"sig":"%%"}]}')), "malformed");
  assertEquals(value(parseEnvelope('{"payload":"aGk=","payloadType":"t","signatures":[{"sig":"AA=="}]}')), {
    payload: "aGk=",
    payloadType: "t",
    signatures: [{ sig: "AA==" }],
  });
  assertEquals(envelopeDecoder(null).kind, "err");
  // A hand-built envelope with bad base64 is refused by verification too.
  const k = await pair({ name: "Ed25519" });
  const bad: DsseEnvelope = { payload: "%%", payloadType: TYPE, signatures: [] };
  assertEquals(errorKind(await verifyEnvelope(bad, TYPE, [{ key: k.publicKey }])), "malformed");
  const badSig: DsseEnvelope = { payload: "", payloadType: TYPE, signatures: [{ sig: "%%" }] };
  assertEquals(errorKind(await verifyEnvelope(badSig, TYPE, [{ key: k.publicKey }])), "malformed");
});

proves([DSSE], "a statement's subjects carry the SHA-256 of their bytes, and a signed statement verifies to its predicate", async () => {
  const bytes = enc.encode("abc");
  const s = await subject("a.txt", bytes, { mediaType: "text/plain", annotations: { kind: "note" } });
  assertEquals(s, {
    name: "a.txt",
    digest: { sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" },
    mediaType: "text/plain",
    annotations: { kind: "note" },
  });
  assertEquals(s.digest["sha256"], await sha256(bytes));
  const st = statement([s], "https://example.com/Note/v1", { note: "hi" });
  assertEquals(st._type, STATEMENT_TYPE);
  const k = await pair({ name: "ECDSA", namedCurve: "P-256" });
  const env = value(await signStatement(st, [{ key: k.privateKey, keyid: "me" }]));
  assertEquals(env.payloadType, INTOTO_PAYLOAD_TYPE);
  const keys: readonly DsseKey[] = [{ key: k.publicKey, keyid: "me" }];
  const back = value(await verifyStatement(env, keys, object({ note: string })));
  assertEquals(back, st);
  // A predicate not the one expected, and a payload that is not a statement.
  assertEquals(errorKind(await verifyStatement(env, keys, object({ count: string }))), "statement");
  const notStatement = value(await signEnvelope(INTOTO_PAYLOAD_TYPE, enc.encode('{"_type":"x"}'), [{ key: k.privateKey }]));
  assertEquals(errorKind(await verifyStatement(notStatement, keys, unknownValue)), "statement");
  const notUtf8 = value(await signEnvelope(INTOTO_PAYLOAD_TYPE, Uint8Array.of(0xff), [{ key: k.privateKey }]));
  assertEquals(errorKind(await verifyStatement(notUtf8, keys, unknownValue)), "statement");
  // The statement decoder refuses a digest that is not lower-case hexadecimal.
  const decode = statementDecoder(unknownValue);
  assertEquals(decode({ ...st, subject: [{ name: "a", digest: { sha256: "ABC" } }] }).kind, "err");
  assertEquals(decode(JSON.parse(JSON.stringify(st))).kind, "ok");
});
