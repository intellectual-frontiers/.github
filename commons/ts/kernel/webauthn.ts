/**
 * WebAuthn (Web Authentication Level 3) for a relying party, pure and with no outside package (commons 0014-webauthn): the options a
 * browser's `navigator.credentials.create()` and `.get()` take, and the verification of what they answer, in the JSON shapes of the
 * Level 3 `toJSON()` methods (every binary field as base64url). Registration checks the client data (`webauthn.create`, the challenge,
 * the origin), the attestation object (CBOR: `fmt` `none`, or `packed` with no more than self-attestation's trust), the authenticator
 * data (the SHA-256 of the RP ID, user presence and user verification, the attested credential) and the credential's COSE key (ES256 or
 * EdDSA). Authentication checks the client data (`webauthn.get`), the authenticator data, the signature over the authenticator data and
 * the SHA-256 of the client data by the stored key, and that the signature counter went up. Every refusal is a plain sentence, never an
 * exception: what a browser sends is input from outside.
 *
 * The kernel has no randomness and no store: the caller makes each challenge (16 or more random bytes, base64url), keeps it until the
 * answer comes, and keeps the credential (`credentialId`, `publicKey`, `alg`, `signCount`) that registration gives back.
 *
 * @example
 * ```ts
 * import { registrationOptions, verifyRegistration } from "./webauthn.ts";
 * const options = registrationOptions({
 *   rpId: "example.com",
 *   rpName: "Example",
 *   user: { id: "dXNlci0x", name: "ada", displayName: "Ada" },
 *   challenge: "q83vEjRWeJq83vEjRWeJqw",
 * });
 * // send `options` to the browser; then, with what it answers:
 * // const r = await verifyRegistration({ response, expectedChallenge: options.challenge, expectedOrigin: "https://example.com", rpId: "example.com" });
 * ```
 *
 * @limits
 * Attestation is not judged: commons asks for `none`, accepts `none`, and accepts `packed` with self-attestation (its signature checked) or
 * with a certificate chain that is not checked, so that every credential has the trust of `none`; any other format is refused. Only ES256
 * and EdDSA keys (see `cose.ts`). Extensions are read past, not interpreted; `topOrigin` is not checked, and a `crossOrigin` ceremony is
 * refused.
 *
 * @module
 */
import { fromBase64Url, toBase64Url } from "./base64.ts";
import { type CborKey, type CborValue, decodeCbor, decodeCborItem, formatCborError, isMap } from "./cbor.ts";
import { ALGORITHMS, type CoseKey, EDDSA, ES256, parseCoseKey, verifyCose } from "./cose.ts";
import {
  array,
  boolean,
  formatDecodeError,
  integer,
  json,
  literal,
  nullable,
  object,
  record,
  string,
  unknownValue,
  err,
  ok,
  type Result,
} from "@intellectual-frontiers/core";

/** A relying party as the options name it. */
export type PublicKeyCredentialRpEntity = { readonly id?: string; readonly name: string };

/** A user account as the options name it (`id` base64url, at most 64 bytes). */
export type PublicKeyCredentialUserEntityJSON = { readonly id: string; readonly name: string; readonly displayName: string };

/** An algorithm offered for a new credential. */
export type PublicKeyCredentialParameters = { readonly type: "public-key"; readonly alg: number };

/** A credential named by its id (base64url). */
export type PublicKeyCredentialDescriptorJSON = {
  readonly type: "public-key";
  readonly id: string;
  readonly transports?: readonly string[];
};

/** What kind of authenticator is wanted. */
export type AuthenticatorSelectionCriteria = {
  readonly authenticatorAttachment?: "platform" | "cross-platform";
  readonly residentKey?: "discouraged" | "preferred" | "required";
  readonly requireResidentKey?: boolean;
  readonly userVerification?: "required" | "preferred" | "discouraged";
};

/** The options of `navigator.credentials.create({ publicKey })` as JSON (`PublicKeyCredential.parseCreationOptionsFromJSON` takes it). */
export type PublicKeyCredentialCreationOptionsJSON = {
  readonly rp: PublicKeyCredentialRpEntity;
  readonly user: PublicKeyCredentialUserEntityJSON;
  readonly challenge: string;
  readonly pubKeyCredParams: readonly PublicKeyCredentialParameters[];
  readonly timeout?: number;
  readonly excludeCredentials?: readonly PublicKeyCredentialDescriptorJSON[];
  readonly authenticatorSelection?: AuthenticatorSelectionCriteria;
  readonly hints?: readonly string[];
  readonly attestation?: "none" | "indirect" | "direct" | "enterprise";
  readonly attestationFormats?: readonly string[];
  readonly extensions?: Readonly<Record<string, unknown>>;
};

/** The options of `navigator.credentials.get({ publicKey })` as JSON (`PublicKeyCredential.parseRequestOptionsFromJSON` takes it). */
export type PublicKeyCredentialRequestOptionsJSON = {
  readonly challenge: string;
  readonly timeout?: number;
  readonly rpId?: string;
  readonly allowCredentials?: readonly PublicKeyCredentialDescriptorJSON[];
  readonly userVerification?: "required" | "preferred" | "discouraged";
  readonly hints?: readonly string[];
  readonly extensions?: Readonly<Record<string, unknown>>;
};

/** An authenticator's answer to `create()`, as `AuthenticatorAttestationResponse.toJSON()` gives it. */
export type AuthenticatorAttestationResponseJSON = {
  readonly clientDataJSON: string;
  readonly attestationObject: string;
  readonly authenticatorData?: string;
  readonly transports?: readonly string[];
  readonly publicKey?: string;
  readonly publicKeyAlgorithm?: number;
};

/** A new credential, as `PublicKeyCredential.toJSON()` gives it after `create()`. */
export type RegistrationResponseJSON = {
  readonly id: string;
  readonly rawId: string;
  readonly response: AuthenticatorAttestationResponseJSON;
  readonly authenticatorAttachment?: string | null;
  readonly clientExtensionResults: Readonly<Record<string, unknown>>;
  readonly type: "public-key";
};

/** An authenticator's answer to `get()`, as `AuthenticatorAssertionResponse.toJSON()` gives it. */
export type AuthenticatorAssertionResponseJSON = {
  readonly clientDataJSON: string;
  readonly authenticatorData: string;
  readonly signature: string;
  readonly userHandle?: string | null;
};

/** An assertion, as `PublicKeyCredential.toJSON()` gives it after `get()`. */
export type AuthenticationResponseJSON = {
  readonly id: string;
  readonly rawId: string;
  readonly response: AuthenticatorAssertionResponseJSON;
  readonly authenticatorAttachment?: string | null;
  readonly clientExtensionResults: Readonly<Record<string, unknown>>;
  readonly type: "public-key";
};

/** A credential as the relying party keeps it: its id and COSE public key (base64url), its algorithm and its last signature counter. */
export type StoredCredential = { readonly id: string; readonly publicKey: string; readonly alg: number; readonly signCount: number };

/** What a verified registration gives the relying party to keep. */
export type VerifiedRegistration = {
  /** The credential's id, base64url. */
  readonly credentialId: string;
  /** The credential's public key as its CBOR `COSE_Key`, base64url. */
  readonly publicKey: string;
  /** Its COSE algorithm: -7 (ES256) or -8 (EdDSA). */
  readonly alg: number;
  readonly signCount: number;
  readonly userVerified: boolean;
  /** Whether the credential is backed up (synced, a passkey): the BS flag. */
  readonly backedUp: boolean;
  /** Whether it may be backed up: the BE flag. */
  readonly backupEligible: boolean;
  /** The authenticator's AAGUID, as a UUID (all zeros under attestation `none`). */
  readonly aaguid: string;
  /** The attestation format the authenticator used (`none` or `packed`). */
  readonly fmt: string;
  readonly transports?: string[];
};

/** What a verified authentication gives: the counter to keep, and the flags. */
export type VerifiedAuthentication = {
  readonly signCount: number;
  readonly userVerified: boolean;
  readonly backedUp: boolean;
};

/** The default time a ceremony may take: five minutes, within what Level 3 recommends where user verification is required. */
export const DEFAULT_TIMEOUT_MS = 300_000;

function bytesOfB64u(text: unknown, what: string): Result<Uint8Array, string> {
  if (typeof text !== "string") return err(`${what} is not a string`);
  const r = fromBase64Url(text);
  return r.kind === "ok" ? r : err(`${what} is not base64url`);
}

function checkedChallenge(challenge: string): void {
  const r = fromBase64Url(challenge);
  if (r.kind === "err" || r.value.length < 16) throw new RangeError("WebAuthn: a challenge is at least 16 random bytes, as base64url");
}

function descriptors(ids: readonly string[]): readonly PublicKeyCredentialDescriptorJSON[] {
  return ids.map((id) => {
    if (fromBase64Url(id).kind === "err") throw new RangeError(`WebAuthn: the credential id ${id} is not base64url`);
    return { type: "public-key", id };
  });
}

/**
 * The options for registering a credential: ES256 and EdDSA offered, a discoverable credential preferred, user verification required, no
 * attestation asked for, and the credentials the user already has excluded. A challenge shorter than 16 bytes or a user id longer than 64
 * is a programming error and throws a `RangeError`.
 */
export function registrationOptions(o: {
  readonly rpId: string;
  readonly rpName: string;
  readonly user: { readonly id: string; readonly name: string; readonly displayName: string };
  readonly challenge: string;
  readonly excludeCredentials?: readonly string[];
  readonly timeoutMs?: number;
}): PublicKeyCredentialCreationOptionsJSON {
  checkedChallenge(o.challenge);
  const uid = fromBase64Url(o.user.id);
  if (uid.kind === "err" || uid.value.length === 0 || uid.value.length > 64)
    throw new RangeError("WebAuthn: a user id is 1 to 64 bytes, as base64url");
  return {
    rp: { id: o.rpId, name: o.rpName },
    user: { id: o.user.id, name: o.user.name, displayName: o.user.displayName },
    challenge: o.challenge,
    pubKeyCredParams: ALGORITHMS.map((alg) => ({ type: "public-key", alg })),
    timeout: o.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    excludeCredentials: descriptors(o.excludeCredentials ?? []),
    authenticatorSelection: { residentKey: "preferred", requireResidentKey: false, userVerification: "required" },
    attestation: "none",
  };
}

/** The options for authenticating: user verification required, and the credentials allowed where the user is known (none for a passkey's discoverable sign-in). */
export function authenticationOptions(o: {
  readonly rpId: string;
  readonly challenge: string;
  readonly allowCredentials?: readonly string[];
  readonly timeoutMs?: number;
}): PublicKeyCredentialRequestOptionsJSON {
  checkedChallenge(o.challenge);
  const base = { challenge: o.challenge, timeout: o.timeoutMs ?? DEFAULT_TIMEOUT_MS, rpId: o.rpId, userVerification: "required" } as const;
  return o.allowCredentials === undefined ? base : { ...base, allowCredentials: descriptors(o.allowCredentials) };
}

/** The flags of authenticator data (WebAuthn §6.1). */
export const FLAGS = { up: 0x01, uv: 0x04, be: 0x08, bs: 0x10, at: 0x40, ed: 0x80 } as const;

/** Authenticator data as read (WebAuthn §6.1). */
export type AuthenticatorData = {
  readonly rpIdHash: Uint8Array;
  readonly flags: number;
  readonly userPresent: boolean;
  readonly userVerified: boolean;
  readonly backupEligible: boolean;
  readonly backedUp: boolean;
  readonly signCount: number;
  /** The attested credential data, where the AT flag says it is there. */
  readonly attested?: { readonly aaguid: Uint8Array; readonly credentialId: Uint8Array; readonly publicKey: Uint8Array };
  /** The extension outputs, where the ED flag says they are there. */
  readonly extensions?: ReadonlyMap<CborKey, CborValue>;
};

/** Authenticator data read: the RP ID hash, the flags, the counter, the attested credential (its COSE key's bytes as given) and extensions; every byte accounted for. */
export function parseAuthenticatorData(bytes: Uint8Array): Result<AuthenticatorData, string> {
  if (bytes.length < 37) return err(`the authenticator data is ${bytes.length} bytes, fewer than 37`);
  const flags = bytes[32] ?? 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signCount = view.getUint32(33);
  let at = 37;
  let attested: AuthenticatorData["attested"];
  if (flags & FLAGS.at) {
    if (bytes.length < at + 18) return err("the authenticator data ends inside its attested credential data");
    const aaguid = bytes.slice(at, at + 16);
    const idLength = view.getUint16(at + 16);
    at += 18;
    if (idLength > 1023) return err(`a credential id of ${idLength} bytes (at most 1023)`);
    if (bytes.length < at + idLength) return err("the authenticator data ends inside the credential id");
    const credentialId = bytes.slice(at, at + idLength);
    at += idLength;
    const key = decodeCborItem(bytes, at);
    if (key.kind === "err") return err(`the credential public key is not CBOR (${formatCborError(key.error)})`);
    const publicKey = bytes.slice(at, key.value.end);
    at = key.value.end;
    attested = { aaguid, credentialId, publicKey };
  }
  let extensions: ReadonlyMap<CborKey, CborValue> | undefined;
  if (flags & FLAGS.ed) {
    const ext = decodeCborItem(bytes, at);
    if (ext.kind === "err") return err(`the extensions are not CBOR (${formatCborError(ext.error)})`);
    if (!isMap(ext.value.value)) return err("the extensions are not a CBOR map");
    extensions = ext.value.value;
    at = ext.value.end;
  }
  if (at !== bytes.length) return err(`${bytes.length - at} bytes after the authenticator data that its flags do not account for`);
  return ok({
    rpIdHash: bytes.slice(0, 32),
    flags,
    userPresent: (flags & FLAGS.up) !== 0,
    userVerified: (flags & FLAGS.uv) !== 0,
    backupEligible: (flags & FLAGS.be) !== 0,
    backedUp: (flags & FLAGS.bs) !== 0,
    signCount,
    ...(attested === undefined ? {} : { attested }),
    ...(extensions === undefined ? {} : { extensions }),
  });
}

/** Client data as read (WebAuthn §5.8.1). */
export type ClientData = {
  readonly type: string;
  readonly challenge: string;
  readonly origin: string;
  readonly crossOrigin?: boolean;
  readonly topOrigin?: string;
};

const clientData = object({ type: string, challenge: string, origin: string }, { crossOrigin: boolean, topOrigin: string });

/** Client data JSON (its bytes, UTF-8) read. */
export function parseClientData(bytes: Uint8Array): Result<ClientData, string> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return err("the client data is not UTF-8");
  }
  const r = json(text, clientData);
  return r.kind === "ok" ? r : err(`the client data is not WebAuthn's (${formatDecodeError(r.error)})`);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return d === 0;
}

async function digest(b: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(b)));
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

type Ceremony = {
  readonly clientDataJSON: unknown;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string | readonly string[];
};

/** The client data checked for its type, challenge, origin and cross-origin flag; its bytes, to hash. */
function checkClientData(type: "webauthn.create" | "webauthn.get", c: Ceremony): Result<Uint8Array, string> {
  const raw = bytesOfB64u(c.clientDataJSON, "clientDataJSON");
  if (raw.kind === "err") return raw;
  const cd = parseClientData(raw.value);
  if (cd.kind === "err") return cd;
  if (cd.value.type !== type) return err(`the client data's type is ${cd.value.type}, not ${type}`);
  const got = fromBase64Url(cd.value.challenge);
  const want = fromBase64Url(c.expectedChallenge);
  if (got.kind === "err" || want.kind === "err" || !sameBytes(got.value, want.value))
    return err("the challenge is not the one this ceremony issued");
  const origins: readonly string[] = typeof c.expectedOrigin === "string" ? [c.expectedOrigin] : c.expectedOrigin;
  if (!origins.includes(cd.value.origin)) return err(`the origin ${cd.value.origin} is not one expected`);
  if (cd.value.crossOrigin === true) return err("the ceremony ran in a cross-origin frame");
  return ok(raw.value);
}

/** The authenticator data checked for the RP ID's hash, user presence and user verification, and the backup flags' consistency. */
async function checkAuthenticatorData(data: AuthenticatorData, rpId: string): Promise<Result<void, string>> {
  if (!sameBytes(data.rpIdHash, await digest(new TextEncoder().encode(rpId))))
    return err(`the authenticator data is not for the RP ID ${rpId}`);
  if (!data.userPresent) return err("the user was not present (the UP flag is not set)");
  if (!data.userVerified) return err("the user was not verified (the UV flag is not set)");
  if (data.backedUp && !data.backupEligible) return err("the credential says it is backed up but not eligible to be (BS without BE)");
  return ok(undefined);
}

function uuidOf(b: Uint8Array): string {
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function algOfCose(key: CoseKey): number {
  return key.kty === "EC2" ? ES256 : EDDSA;
}

/** The attestation statement checked: `none` empty; `packed` with self-attestation verified by the credential's own key, or with `x5c` taken at the trust of `none`. */
async function checkAttestation(
  fmt: string,
  stmt: CborValue,
  key: CoseKey,
  authData: Uint8Array,
  clientDataHash: Uint8Array,
): Promise<Result<void, string>> {
  if (!isMap(stmt)) return err("the attestation statement is not a CBOR map");
  if (fmt === "none") return stmt.size === 0 ? ok(undefined) : err("an attestation of format none with a statement");
  if (fmt !== "packed") return err(`the attestation format ${fmt} is not accepted (commons asks for none, and accepts none and packed)`);
  const alg = stmt.get("alg");
  const sig = stmt.get("sig");
  if (typeof alg !== "number" || !(sig instanceof Uint8Array)) return err("a packed attestation statement without alg and sig");
  if (stmt.has("x5c")) return ok(undefined); // a certificate chain: not judged, the credential has the trust of none
  if (alg !== algOfCose(key)) return err("a packed self-attestation whose algorithm is not the credential's");
  const v = await verifyCose(key, sig, concatBytes(authData, clientDataHash));
  if (v.kind === "err") return err(`the packed self-attestation cannot be checked (${v.error})`);
  return v.value ? ok(undefined) : err("the packed self-attestation's signature does not verify");
}

/**
 * A registration verified (WebAuthn §7.1): the client data, the attestation object, the authenticator data and the credential's key; what
 * to keep, or why it is refused.
 */
export async function verifyRegistration(o: {
  readonly response: RegistrationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string | readonly string[];
  readonly rpId: string;
}): Promise<Result<VerifiedRegistration, string>> {
  const r = o.response;
  if (r.type !== "public-key") return err("the credential is not of type public-key");
  const rawId = bytesOfB64u(r.rawId, "rawId");
  if (rawId.kind === "err") return rawId;
  if (r.id !== r.rawId) return err("the credential's id and rawId differ");
  const clientDataJSON = checkClientData("webauthn.create", {
    clientDataJSON: r.response.clientDataJSON,
    expectedChallenge: o.expectedChallenge,
    expectedOrigin: o.expectedOrigin,
  });
  if (clientDataJSON.kind === "err") return clientDataJSON;
  const attObjBytes = bytesOfB64u(r.response.attestationObject, "attestationObject");
  if (attObjBytes.kind === "err") return attObjBytes;
  const attObj = decodeCbor(attObjBytes.value);
  if (attObj.kind === "err") return err(`the attestation object is not CBOR (${formatCborError(attObj.error)})`);
  if (!isMap(attObj.value)) return err("the attestation object is not a CBOR map");
  const fmt = attObj.value.get("fmt");
  const authBytes = attObj.value.get("authData");
  const stmt = attObj.value.get("attStmt");
  if (typeof fmt !== "string" || !(authBytes instanceof Uint8Array) || stmt === undefined)
    return err("the attestation object lacks fmt, attStmt or authData");
  const data = parseAuthenticatorData(authBytes);
  if (data.kind === "err") return data;
  const checked = await checkAuthenticatorData(data.value, o.rpId);
  if (checked.kind === "err") return checked;
  const attested = data.value.attested;
  if (attested === undefined) return err("the authenticator data holds no attested credential (the AT flag is not set)");
  if (!sameBytes(attested.credentialId, rawId.value))
    return err("the credential id in the authenticator data is not the credential's rawId");
  const key = parseCoseKey(attested.publicKey);
  if (key.kind === "err") return key;
  const clientDataHash = await digest(clientDataJSON.value);
  const att = await checkAttestation(fmt, stmt, key.value, authBytes, clientDataHash);
  if (att.kind === "err") return att;
  const transports = Array.isArray(r.response.transports)
    ? r.response.transports.filter((t): t is string => typeof t === "string")
    : undefined;
  return ok({
    credentialId: toBase64Url(rawId.value),
    publicKey: toBase64Url(attested.publicKey),
    alg: algOfCose(key.value),
    signCount: data.value.signCount,
    userVerified: data.value.userVerified,
    backedUp: data.value.backedUp,
    backupEligible: data.value.backupEligible,
    aaguid: uuidOf(attested.aaguid),
    fmt,
    ...(transports === undefined ? {} : { transports }),
  });
}

/**
 * An authentication verified (WebAuthn §7.2) against the credential kept at registration: the client data, the authenticator data, the
 * signature and the counter; the counter and flags to keep, or why it is refused.
 */
export async function verifyAuthentication(o: {
  readonly response: AuthenticationResponseJSON;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string | readonly string[];
  readonly rpId: string;
  readonly credential: StoredCredential;
}): Promise<Result<VerifiedAuthentication, string>> {
  const r = o.response;
  if (r.type !== "public-key") return err("the credential is not of type public-key");
  const rawId = bytesOfB64u(r.rawId, "rawId");
  if (rawId.kind === "err") return rawId;
  if (r.id !== r.rawId) return err("the credential's id and rawId differ");
  const storedId = bytesOfB64u(o.credential.id, "the stored credential's id");
  if (storedId.kind === "err") return storedId;
  if (!sameBytes(rawId.value, storedId.value)) return err("the assertion is by another credential than the one given");
  const clientDataJSON = checkClientData("webauthn.get", {
    clientDataJSON: r.response.clientDataJSON,
    expectedChallenge: o.expectedChallenge,
    expectedOrigin: o.expectedOrigin,
  });
  if (clientDataJSON.kind === "err") return clientDataJSON;
  const authBytes = bytesOfB64u(r.response.authenticatorData, "authenticatorData");
  if (authBytes.kind === "err") return authBytes;
  const data = parseAuthenticatorData(authBytes.value);
  if (data.kind === "err") return data;
  const checked = await checkAuthenticatorData(data.value, o.rpId);
  if (checked.kind === "err") return checked;
  const keyBytes = bytesOfB64u(o.credential.publicKey, "the stored public key");
  if (keyBytes.kind === "err") return keyBytes;
  const key = parseCoseKey(keyBytes.value);
  if (key.kind === "err") return err(`the stored public key cannot be used (${key.error})`);
  if (algOfCose(key.value) !== o.credential.alg) return err("the stored algorithm is not the stored key's");
  const signature = bytesOfB64u(r.response.signature, "signature");
  if (signature.kind === "err") return signature;
  const signed = concatBytes(authBytes.value, await digest(clientDataJSON.value));
  const v = await verifyCose(key.value, signature.value, signed);
  if (v.kind === "err") return v;
  if (!v.value) return err("the signature does not verify");
  const now = data.value.signCount;
  const before = o.credential.signCount;
  if ((now !== 0 || before !== 0) && now <= before)
    return err(`the signature counter went from ${before} to ${now}, not up: the authenticator may be cloned`);
  return ok({ signCount: now, userVerified: data.value.userVerified, backedUp: data.value.backedUp });
}

const kind = literal("public-key");
const extensionResults = record(unknownValue);

/** JSON from a browser read as a `RegistrationResponseJSON`, or why it is not one: the boundary before `verifyRegistration`. */
export function parseRegistrationResponse(input: unknown): Result<RegistrationResponseJSON, string> {
  const d = object(
    {
      id: string,
      rawId: string,
      type: kind,
      response: object(
        { clientDataJSON: string, attestationObject: string },
        { authenticatorData: string, transports: array(string), publicKey: string, publicKeyAlgorithm: integer },
      ),
    },
    { authenticatorAttachment: nullable(string), clientExtensionResults: extensionResults },
  )(input);
  if (d.kind === "err") return err(`not a registration response (${formatDecodeError(d.error)})`);
  return ok({ ...d.value, clientExtensionResults: d.value.clientExtensionResults ?? {} });
}

/** JSON from a browser read as an `AuthenticationResponseJSON`, or why it is not one: the boundary before `verifyAuthentication`. */
export function parseAuthenticationResponse(input: unknown): Result<AuthenticationResponseJSON, string> {
  const d = object(
    {
      id: string,
      rawId: string,
      type: kind,
      response: object({ clientDataJSON: string, authenticatorData: string, signature: string }, { userHandle: nullable(string) }),
    },
    { authenticatorAttachment: nullable(string), clientExtensionResults: extensionResults },
  )(input);
  if (d.kind === "err") return err(`not an authentication response (${formatDecodeError(d.error)})`);
  return ok({ ...d.value, clientExtensionResults: d.value.clientExtensionResults ?? {} });
}
