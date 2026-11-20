/**
 * Tests of `webauthn.ts` and `kernel/cose.ts`: an authenticator played by the test with Web Crypto (an ES256 and an Ed25519 key,
 * the authenticator data, the attestation object in CBOR, the client data JSON, the signatures), whose registrations and authentications
 * are verified; the options a browser is given; COSE keys read, written and refused; and every refusal the relying party must make (the
 * wrong challenge, origin or RP ID, no user verification or presence, a bad signature, a counter that goes back, malformed CBOR, an
 * attestation format not accepted, another credential).
 *
 * @module
 */
import { fromBase64Url, toBase64Url } from "@intellectual-frontiers/formats/base64";
import { type CborKey, type CborValue, encodeCbor } from "@intellectual-frontiers/formats/cbor";
import { coseKeyFromJwk, ecdsaDerToRaw, EDDSA, encodeCoseKey, ES256, jwkOfCoseKey, parseCoseKey, verifyCose } from "../src/cose.ts";
import * as der from "@intellectual-frontiers/formats/der";
import type { Result } from "@intellectual-frontiers/core";
import {
  authenticationOptions,
  type AuthenticationResponseJSON,
  FLAGS,
  parseAuthenticationResponse,
  parseAuthenticatorData,
  parseRegistrationResponse,
  registrationOptions,
  type RegistrationResponseJSON,
  verifyAuthentication,
  verifyRegistration,
} from "../src/webauthn.ts";
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const COSE = "0014-webauthn FR-002";
const OPTIONS = "0014-webauthn FR-003";
const REGISTER = "0014-webauthn FR-004";
const REFUSE_REGISTER = "0014-webauthn FR-005";
const AUTHENTICATE = "0014-webauthn FR-006";
const REFUSE_AUTHENTICATE = "0014-webauthn FR-007";
const BOUNDARY = "0014-webauthn FR-008";

const RP_ID = "erga.fyi";
const ORIGIN = "https://erga.fyi";
const CHALLENGE = toBase64Url(Uint8Array.from({ length: 32 }, (_, i) => i));
const OTHER_CHALLENGE = toBase64Url(Uint8Array.from({ length: 32 }, (_, i) => 255 - i));

const utf8 = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);
const own = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b);
const sha = async (b: Uint8Array): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest("SHA-256", own(b)));
const cat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const u16 = (n: number): Uint8Array => Uint8Array.of(n >> 8, n & 0xff);
const u32 = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const okOf = <T>(r: Result<T, string>): T => {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

type Alg = "ES256" | "Ed25519";

/** An authenticator of one credential, played with Web Crypto. */
type Authenticator = {
  readonly alg: Alg;
  readonly id: Uint8Array;
  readonly cose: Uint8Array;
  sign(data: Uint8Array): Promise<Uint8Array>;
};

async function authenticator(alg: Alg): Promise<Authenticator> {
  const pair: CryptoKeyPair =
    alg === "ES256"
      ? await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
      : await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const cose = okOf(coseKeyFromJwk(await crypto.subtle.exportKey("jwk", pair.publicKey)));
  return {
    alg,
    id: crypto.getRandomValues(new Uint8Array(alg === "ES256" ? 32 : 16)),
    cose,
    async sign(data) {
      if (alg === "Ed25519") return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, own(data)));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, own(data)));
      return der.sequence(der.integer(raw.subarray(0, 32)), der.integer(raw.subarray(32)));
    },
  };
}

type Ceremony = {
  readonly rpId?: string;
  readonly flags?: number;
  readonly counter?: number;
  readonly type?: string;
  readonly challenge?: string;
  readonly origin?: string;
  readonly crossOrigin?: boolean;
};

async function authData(a: Authenticator, c: Ceremony, attested: boolean): Promise<Uint8Array> {
  const flags = c.flags ?? FLAGS.up | FLAGS.uv | FLAGS.be | FLAGS.bs | (attested ? FLAGS.at : 0);
  const head = cat(await sha(utf8(c.rpId ?? RP_ID)), Uint8Array.of(flags), u32(c.counter ?? 0));
  return attested ? cat(head, new Uint8Array(16), u16(a.id.length), a.id, a.cose) : head;
}

function clientData(c: Ceremony, type: string): Uint8Array {
  return utf8(
    JSON.stringify({
      type: c.type ?? type,
      challenge: c.challenge ?? CHALLENGE,
      origin: c.origin ?? ORIGIN,
      crossOrigin: c.crossOrigin ?? false,
    }),
  );
}

const map = (...pairs: readonly (readonly [CborKey, CborValue])[]): ReadonlyMap<CborKey, CborValue> => new Map(pairs);

async function register(
  a: Authenticator,
  c: Ceremony = {},
  attestation: (ad: Uint8Array, cd: Uint8Array) => Promise<Uint8Array> = (ad) =>
    Promise.resolve(encodeCbor(map(["fmt", "none"], ["attStmt", map()], ["authData", ad]))),
): Promise<RegistrationResponseJSON> {
  const ad = await authData(a, c, true);
  const cd = clientData(c, "webauthn.create");
  const id = toBase64Url(a.id);
  return {
    id,
    rawId: id,
    type: "public-key",
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
    response: {
      clientDataJSON: toBase64Url(cd),
      attestationObject: toBase64Url(await attestation(ad, cd)),
      transports: ["internal", "hybrid"],
    },
  };
}

async function authenticate(a: Authenticator, c: Ceremony = {}): Promise<AuthenticationResponseJSON> {
  const ad = await authData(a, { counter: 1, ...c }, false);
  const cd = clientData(c, "webauthn.get");
  const id = toBase64Url(a.id);
  return {
    id,
    rawId: id,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: toBase64Url(cd),
      authenticatorData: toBase64Url(ad),
      signature: toBase64Url(await a.sign(cat(ad, await sha(cd)))),
      userHandle: toBase64Url(utf8("user-1")),
    },
  };
}

const expect = { expectedChallenge: CHALLENGE, expectedOrigin: ORIGIN, rpId: RP_ID } as const;

function refused<T>(r: Result<T, string>, says: string): void {
  assert(r.kind === "err", `refused (${says})`);
  assertStringIncludes(r.error, says);
}

proves(
  [OPTIONS],
  "registration options offer EdDSA and ES256, prefer a passkey, require user verification and ask for no attestation",
  () => {
    const o = registrationOptions({
      rpId: RP_ID,
      rpName: "Erga",
      user: { id: toBase64Url(utf8("user-1")), name: "ada@erga.fyi", displayName: "Ada" },
      challenge: CHALLENGE,
      excludeCredentials: ["AAEC"],
    });
    assertEquals(o, {
      rp: { id: RP_ID, name: "Erga" },
      user: { id: "dXNlci0x", name: "ada@erga.fyi", displayName: "Ada" },
      challenge: CHALLENGE,
      pubKeyCredParams: [
        { type: "public-key", alg: -8 },
        { type: "public-key", alg: -7 },
      ],
      timeout: 300000,
      excludeCredentials: [{ type: "public-key", id: "AAEC" }],
      authenticatorSelection: { residentKey: "preferred", requireResidentKey: false, userVerification: "required" },
      attestation: "none",
    });
    assertEquals(JSON.parse(JSON.stringify(o)), o, "the options are plain JSON, as parseCreationOptionsFromJSON takes them");
  },
);

proves([OPTIONS], "authentication options require user verification; allowed credentials only where given", () => {
  assertEquals(authenticationOptions({ rpId: RP_ID, challenge: CHALLENGE, timeoutMs: 60000 }), {
    challenge: CHALLENGE,
    timeout: 60000,
    rpId: RP_ID,
    userVerification: "required",
  });
  assertEquals(authenticationOptions({ rpId: RP_ID, challenge: CHALLENGE, allowCredentials: ["AAEC"] }).allowCredentials, [
    { type: "public-key", id: "AAEC" },
  ]);
});

proves([OPTIONS], "a challenge under 16 bytes, a user id over 64 bytes or a credential id not base64url is a programming error", () => {
  const user = { id: "dXNlci0x", name: "a", displayName: "A" };
  assertThrows(() => registrationOptions({ rpId: RP_ID, rpName: "E", user, challenge: "AAEC" }), RangeError);
  assertThrows(
    () => registrationOptions({ rpId: RP_ID, rpName: "E", user: { ...user, id: toBase64Url(new Uint8Array(65)) }, challenge: CHALLENGE }),
    RangeError,
  );
  assertThrows(() => authenticationOptions({ rpId: RP_ID, challenge: CHALLENGE, allowCredentials: ["not base64url!"] }), RangeError);
});

proves([COSE], "COSE keys of ES256 and EdDSA read, written from a JWK and back, and their signatures verified", async () => {
  for (const alg of ["ES256", "Ed25519"] as const) {
    const a = await authenticator(alg);
    const key = okOf(parseCoseKey(a.cose));
    assertEquals(key.alg, alg === "ES256" ? ES256 : EDDSA);
    assertEquals(encodeCoseKey(key), a.cose, "the COSE key is written deterministically, the same bytes");
    assertEquals(okOf(coseKeyFromJwk(jwkOfCoseKey(key))), a.cose);
    const data = utf8("signed");
    assertEquals(await verifyCose(key, await a.sign(data), data), { kind: "ok", value: true });
    assertEquals(await verifyCose(key, await a.sign(data), utf8("other")), { kind: "ok", value: false });
  }
});

proves([COSE], "COSE keys of other algorithms, curves or sizes, and malformed ECDSA signatures, are refused", () => {
  const x = new Uint8Array(32).fill(1);
  refused(
    parseCoseKey(encodeCbor(map([1, 3], [3, -257], [-1, new Uint8Array(256)], [-2, Uint8Array.of(1, 0, 1)]))),
    "-257 is not accepted",
  );
  refused(parseCoseKey(encodeCbor(map([1, 2], [3, -7], [-1, 2], [-2, x], [-3, x]))), "curve is not P-256");
  refused(parseCoseKey(encodeCbor(map([1, 1], [3, -8], [-1, 6], [-2, x.subarray(0, 31)]))), "31 bytes, not 32");
  refused(parseCoseKey(encodeCbor(map([1, 2], [3, -8], [-1, 6], [-2, x]))), "kty is not OKP");
  refused(parseCoseKey(Uint8Array.of(0xa1)), "not CBOR");
  refused(coseKeyFromJwk({ kty: "RSA", n: "AQAB", e: "AQAB" }), "only EC on P-256 and OKP on Ed25519");
  // r with a leading zero (its top bit set), s short: both fixed at 32 bytes
  const r = Uint8Array.from({ length: 32 }, () => 0x80);
  const raw = okOf(ecdsaDerToRaw(der.sequence(der.integer(r), der.integer(Uint8Array.of(5)))));
  assertEquals(raw.subarray(0, 32), r);
  assertEquals(raw[63], 5);
  refused(ecdsaDerToRaw(Uint8Array.of(0x30, 0x03, 0x02, 0x01, 0x01)), "not two integers");
  refused(ecdsaDerToRaw(der.sequence(der.integer(-1), der.integer(1))), "do not fit");
  refused(ecdsaDerToRaw(der.sequence(der.integer(new Uint8Array(33).fill(1)), der.integer(1))), "do not fit");
});

proves([REGISTER], "a registration by an ES256 and by an Ed25519 authenticator is verified, and what to keep given back", async () => {
  for (const alg of ["ES256", "Ed25519"] as const) {
    const a = await authenticator(alg);
    const r = okOf(await verifyRegistration({ response: await register(a, { counter: 0 }), ...expect }));
    assertEquals(r, {
      credentialId: toBase64Url(a.id),
      publicKey: toBase64Url(a.cose),
      alg: alg === "ES256" ? -7 : -8,
      signCount: 0,
      userVerified: true,
      backedUp: true,
      backupEligible: true,
      aaguid: "00000000-0000-0000-0000-000000000000",
      fmt: "none",
      transports: ["internal", "hybrid"],
    });
  }
});

proves(
  [REGISTER],
  "several origins may be expected; packed self-attestation is checked, a packed chain taken at the trust of none",
  async () => {
    const a = await authenticator("ES256");
    const other = await register(a, { origin: "https://app.erga.fyi" });
    assertEquals((await verifyRegistration({ response: other, ...expect, expectedOrigin: [ORIGIN, "https://app.erga.fyi"] })).kind, "ok");
    const packed =
      (sigOf: (ad: Uint8Array, cd: Uint8Array) => Promise<Uint8Array>, x5c = false) =>
      async (ad: Uint8Array, cd: Uint8Array) => {
        const stmt = map(["alg", -7], ["sig", await sigOf(ad, cd)], ...(x5c ? [["x5c", [Uint8Array.of(0x30, 0)]] as const] : []));
        return encodeCbor(map(["fmt", "packed"], ["attStmt", stmt], ["authData", ad]));
      };
    const self = await register(
      a,
      {},
      packed(async (ad, cd) => a.sign(cat(ad, await sha(cd)))),
    );
    assertEquals(okOf(await verifyRegistration({ response: self, ...expect })).fmt, "packed");
    const forged = await register(
      a,
      {},
      packed(async (ad) => a.sign(ad)),
    );
    refused(await verifyRegistration({ response: forged, ...expect }), "self-attestation's signature does not verify");
    const chained = await register(
      a,
      {},
      packed(() => Promise.resolve(Uint8Array.of(1)), true),
    );
    assertEquals((await verifyRegistration({ response: chained, ...expect })).kind, "ok");
  },
);

proves(
  [REFUSE_REGISTER],
  "a registration is refused for the wrong challenge, origin, RP ID or type, and without user presence or verification",
  async () => {
    const a = await authenticator("ES256");
    refused(
      await verifyRegistration({ response: await register(a, { challenge: OTHER_CHALLENGE }), ...expect }),
      "challenge is not the one",
    );
    refused(
      await verifyRegistration({ response: await register(a, { origin: "https://evil.example" }), ...expect }),
      "origin https://evil.example",
    );
    refused(await verifyRegistration({ response: await register(a, { rpId: "evil.example" }), ...expect }), "not for the RP ID erga.fyi");
    refused(await verifyRegistration({ response: await register(a, { type: "webauthn.get" }), ...expect }), "not webauthn.create");
    refused(await verifyRegistration({ response: await register(a, { crossOrigin: true }), ...expect }), "cross-origin");
    refused(await verifyRegistration({ response: await register(a, { flags: FLAGS.up | FLAGS.at }), ...expect }), "UV flag is not set");
    refused(await verifyRegistration({ response: await register(a, { flags: FLAGS.uv | FLAGS.at }), ...expect }), "UP flag is not set");
    refused(
      await verifyRegistration({ response: await register(a, { flags: FLAGS.up | FLAGS.uv }), ...expect }),
      "bytes after the authenticator data",
    );
    refused(
      await verifyRegistration({ response: await register(a, { flags: FLAGS.up | FLAGS.uv | FLAGS.bs | FLAGS.at }), ...expect }),
      "BS without BE",
    );
  },
);

proves(
  [REFUSE_REGISTER],
  "a registration is refused for malformed CBOR, a format not accepted, another credential id or a key not accepted",
  async () => {
    const a = await authenticator("Ed25519");
    const good = await register(a);
    const withAttestation = (bytes: Uint8Array): RegistrationResponseJSON => ({
      ...good,
      response: { ...good.response, attestationObject: toBase64Url(bytes) },
    });
    refused(
      await verifyRegistration({ response: withAttestation(Uint8Array.of(0xa3, 0x63)), ...expect }),
      "attestation object is not CBOR",
    );
    refused(await verifyRegistration({ response: withAttestation(encodeCbor([1, 2])), ...expect }), "not a CBOR map");
    refused(
      await verifyRegistration({ response: withAttestation(encodeCbor(map(["fmt", "none"]))), ...expect }),
      "lacks fmt, attStmt or authData",
    );
    const ad = await authData(a, {}, true);
    refused(
      await verifyRegistration({
        response: withAttestation(encodeCbor(map(["fmt", "tpm"], ["attStmt", map()], ["authData", ad]))),
        ...expect,
      }),
      "format tpm is not accepted",
    );
    refused(
      await verifyRegistration({
        response: withAttestation(encodeCbor(map(["fmt", "none"], ["attStmt", map(["x", 1])], ["authData", ad]))),
        ...expect,
      }),
      "none with a statement",
    );
    refused(
      await verifyRegistration({
        response: withAttestation(encodeCbor(map(["fmt", "none"], ["attStmt", map()], ["authData", ad.subarray(0, 60)]))),
        ...expect,
      }),
      "ends inside",
    );
    const otherId = toBase64Url(Uint8Array.of(9, 9, 9));
    refused(await verifyRegistration({ response: { ...good, id: otherId, rawId: otherId }, ...expect }), "not the credential's rawId");
    refused(await verifyRegistration({ response: { ...good, id: "x" }, ...expect }), "id and rawId differ");
    refused(
      await verifyRegistration({ response: { ...good, response: { ...good.response, clientDataJSON: "%%" } }, ...expect }),
      "not base64url",
    );
    refused(
      await verifyRegistration({
        response: { ...good, response: { ...good.response, clientDataJSON: toBase64Url(utf8("{")) } },
        ...expect,
      }),
      "client data",
    );
    const rsa: Authenticator = { ...a, cose: encodeCbor(map([1, 3], [3, -257], [-1, new Uint8Array(256)], [-2, Uint8Array.of(1, 0, 1)])) };
    refused(await verifyRegistration({ response: await register(rsa), ...expect }), "-257 is not accepted");
  },
);

proves(
  [AUTHENTICATE],
  "an authentication by an ES256 and by an Ed25519 credential is verified, and the counter to keep given back",
  async () => {
    for (const alg of ["ES256", "Ed25519"] as const) {
      const a = await authenticator(alg);
      const reg = okOf(await verifyRegistration({ response: await register(a), ...expect }));
      const credential = { id: reg.credentialId, publicKey: reg.publicKey, alg: reg.alg, signCount: reg.signCount };
      const r = await verifyAuthentication({ response: await authenticate(a, { counter: 7 }), ...expect, credential });
      assertEquals(r, { kind: "ok", value: { signCount: 7, userVerified: true, backedUp: true } });
    }
  },
);

proves([AUTHENTICATE], "an authenticator that keeps no counter (0 before and after) is accepted", async () => {
  const a = await authenticator("ES256");
  const credential = { id: toBase64Url(a.id), publicKey: toBase64Url(a.cose), alg: -7, signCount: 0 };
  assertEquals(await verifyAuthentication({ response: await authenticate(a, { counter: 0 }), ...expect, credential }), {
    kind: "ok",
    value: { signCount: 0, userVerified: true, backedUp: true },
  });
});

proves(
  [REFUSE_AUTHENTICATE],
  "an authentication is refused for a bad signature, a counter that goes back, and the wrong challenge, origin, RP ID or credential",
  async () => {
    const a = await authenticator("Ed25519");
    const credential = { id: toBase64Url(a.id), publicKey: toBase64Url(a.cose), alg: -8, signCount: 5 };
    const good = await authenticate(a, { counter: 6 });
    assertEquals((await verifyAuthentication({ response: good, ...expect, credential })).kind, "ok");
    const sig = okOf(fromBase64Url(good.response.signature));
    const flipped = Uint8Array.from(sig, (b, i) => (i === 0 ? b ^ 1 : b));
    refused(
      await verifyAuthentication({
        response: { ...good, response: { ...good.response, signature: toBase64Url(flipped) } },
        ...expect,
        credential,
      }),
      "does not verify",
    );
    refused(
      await verifyAuthentication({ response: { ...good, response: { ...good.response, signature: "AAEC" } }, ...expect, credential }),
      "3 bytes, not 64",
    );
    refused(await verifyAuthentication({ response: await authenticate(a, { counter: 5 }), ...expect, credential }), "went from 5 to 5");
    refused(await verifyAuthentication({ response: await authenticate(a, { counter: 0 }), ...expect, credential }), "went from 5 to 0");
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9, challenge: OTHER_CHALLENGE }), ...expect, credential }),
      "challenge",
    );
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9, origin: "http://erga.fyi" }), ...expect, credential }),
      "origin",
    );
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9, rpId: "erga.fy" }), ...expect, credential }),
      "RP ID",
    );
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9, type: "webauthn.create" }), ...expect, credential }),
      "not webauthn.get",
    );
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9, flags: FLAGS.up }), ...expect, credential }),
      "UV flag",
    );
    const b = await authenticator("Ed25519");
    refused(await verifyAuthentication({ response: await authenticate(b, { counter: 9 }), ...expect, credential }), "another credential");
    refused(
      await verifyAuthentication({
        response: await authenticate(a, { counter: 9 }),
        ...expect,
        credential: { ...credential, publicKey: toBase64Url(b.cose) },
      }),
      "does not verify",
    );
    refused(
      await verifyAuthentication({ response: await authenticate(a, { counter: 9 }), ...expect, credential: { ...credential, alg: -7 } }),
      "stored algorithm",
    );
    const es = await authenticator("ES256");
    const esCredential = { id: toBase64Url(es.id), publicKey: toBase64Url(es.cose), alg: -7, signCount: 0 };
    const esGood = await authenticate(es, { counter: 1 });
    refused(
      await verifyAuthentication({
        response: { ...esGood, response: { ...esGood.response, signature: toBase64Url(new Uint8Array(64)) } },
        ...expect,
        credential: esCredential,
      }),
      "not a DER sequence",
    );
  },
);

proves([REFUSE_AUTHENTICATE], "authenticator data is read to its last byte, with its extensions", async () => {
  const a = await authenticator("ES256");
  const ad = await authData(a, { flags: FLAGS.up | FLAGS.uv | FLAGS.ed, counter: 3 }, false);
  const withExt = cat(ad, encodeCbor(map(["credProtect", 2])));
  const read = okOf(parseAuthenticatorData(withExt));
  assertEquals(read.signCount, 3);
  assertEquals(read.extensions, map(["credProtect", 2]));
  refused(parseAuthenticatorData(withExt.subarray(0, 36)), "fewer than 37");
  refused(parseAuthenticatorData(cat(ad, Uint8Array.of(0x1c))), "extensions are not CBOR");
  refused(parseAuthenticatorData(cat(ad, Uint8Array.of(1))), "extensions are not a CBOR map");
});

proves([BOUNDARY], "JSON from a browser is read into the response types, or refused saying where", async () => {
  const a = await authenticator("ES256");
  const reg = await register(a);
  const parsed = okOf(parseRegistrationResponse(JSON.parse(JSON.stringify(reg))));
  assertEquals(parsed.response.transports, ["internal", "hybrid"]);
  assertEquals((await verifyRegistration({ response: parsed, ...expect })).kind, "ok");
  const auth = await authenticate(a);
  assertEquals(
    okOf(parseAuthenticationResponse(JSON.parse(JSON.stringify({ ...auth, clientExtensionResults: undefined })))).clientExtensionResults,
    {},
  );
  refused(parseRegistrationResponse({ ...reg, type: "password" }), "$.type");
  refused(parseRegistrationResponse({ ...reg, response: { clientDataJSON: "x" } }), "$.response.attestationObject");
  refused(parseAuthenticationResponse({ ...auth, response: { ...auth.response, signature: 1 } }), "$.response.signature");
  refused(parseAuthenticationResponse(null), "not an authentication response");
});
