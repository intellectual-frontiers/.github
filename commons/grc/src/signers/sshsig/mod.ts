// Spec: 0014-grc-sshsig FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The `sshsig` signer (commons grc 0014-grc-sshsig): a payload signed with an SSH key, in the envelope of DSSE, so that a person signs with the key they already hold (Ed25519, with its passphrase, which only `ssh-keygen` ever sees) and anyone verifies
 * with the public key alone. Signing is by the system's `ssh-keygen -Y sign`; verifying is pure, over the SSHSIG format (PROTOCOL.sshsig of OpenSSH) with Web Crypto, so that a machine with no OpenSSH can verify. What is signed is DSSE's pre-authentication
 * encoding of the payload type and the payload, so a signature is bound to what the payload is for. Only Ed25519 keys are verified; any other key type is refused with that said.
 *
 * @example
 * ```ts
 * import { sshsigSigner, fingerprintOf } from "./mod.ts";
 * // const signed = await sshsigSigner.sign("application/vnd.example+json", bytes, [{ keyFile: "~/.ssh/id_ed25519" }]);
 * // const payload = await sshsigSigner.verify(signed.value, "application/vnd.example+json", [{ publicKey: "ssh-ed25519 AAAA..." }]);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { pae } from "@intellectual-frontiers/crypto/dsse";
import { proc } from "@intellectual-frontiers/system";
import { APPROVAL_NAMESPACE, canonicalize, type PersonKeys, REGISTRY_PAYLOAD_TYPE, type SignatureFacts, type SignedDocument } from "@intellectual-frontiers/grc/logical";
import type { Envelope, SignProblem, Signer } from "@intellectual-frontiers/grc/physical";

/** The namespace of the evidence of grc: a signature made for something else does not verify here. */
export const NAMESPACE = "grc-evidence";

/** The known namespaces, one closed table (0017-grc-sshsig-namespace FR-002). */
export const NAMESPACES = ["grc-evidence", "ifc-telemetry", "ifc-approval"] as const;

/** A namespace, made only by `parseNamespace`. */
export type Namespace = string & { readonly "@grc/namespace": true };

/** A namespace from text: not empty, no space, no comma, no control character, at most 64 characters. */
export function parseNamespace(text: string): Result<Namespace, string> {
  if (text === "" || text.length > 64 || /[\s,\u0000-\u001f\u007f]/.test(text)) return err(`${JSON.stringify(text)} is not a namespace: not empty, at most 64 characters, no space, comma or control character`);
  return ok(text as Namespace);
}

/** A key to sign with: the file of the private key (or of the public key where an agent holds the private one, with `agent`). */
export type SignKey = { readonly keyFile: string; readonly agent?: boolean };

/** A public key to verify with: its line, `ssh-ed25519 AAAA...`. */
export type VerifyKey = { readonly publicKey: string };

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(text: string): Uint8Array | undefined {
  try {
    return Uint8Array.from(atob(text.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const u32 = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const str = (b: Uint8Array): Uint8Array => concat(u32(b.length), b);

/** A reader over the wire format of SSH: strings with a four byte length. */
class Wire {
  at = 0;
  readonly b: Uint8Array;
  constructor(b: Uint8Array) {
    this.b = b;
  }
  u32(): number | undefined {
    if (this.at + 4 > this.b.length) return undefined;
    const v = ((this.b[this.at] ?? 0) * 2 ** 24) + ((this.b[this.at + 1] ?? 0) << 16) + ((this.b[this.at + 2] ?? 0) << 8) + (this.b[this.at + 3] ?? 0);
    this.at += 4;
    return v;
  }
  string(): Uint8Array | undefined {
    const n = this.u32();
    if (n === undefined || this.at + n > this.b.length) return undefined;
    const out = this.b.slice(this.at, this.at + n);
    this.at += n;
    return out;
  }
}

export { pae };

/** The blob of a public key line, or why not. */
function keyBlob(line: string): Result<Uint8Array, string> {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2 || (parts[0] !== "ssh-ed25519" && parts[0] !== SK_ED25519)) return err(`${parts[0] ?? "this"} is not a key type that is verified: only ssh-ed25519 and ${SK_ED25519} (ecdsa-sk and the rest are not verified)`);
  const blob = unb64(parts[1] ?? "");
  return blob === undefined ? err("the public key is not base64") : ok(blob);
}

/** The fingerprint of a public key line, `SHA256:` and the unpadded base64 of the SHA-256 of its blob, as OpenSSH writes it. */
export async function fingerprintOf(publicKey: string): Promise<Result<string, string>> {
  const blob = keyBlob(publicKey);
  if (blob.kind === "err") return blob;
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(blob.value)));
  return ok(`SHA256:${b64(h).replace(/=+$/, "")}`);
}

/** The key type of an Ed25519 key held in a FIDO2 token (PROTOCOL.u2f of OpenSSH): its signature carries the flags and the counter the token wrote. */
export const SK_ED25519 = "sk-ssh-ed25519@openssh.com";

const ARMOR_BEGIN = "-----BEGIN SSH SIGNATURE-----";
const ARMOR_END = "-----END SSH SIGNATURE-----";

type Parsed = { readonly publicKey: Uint8Array; readonly namespace: string; readonly hash: string; readonly signature: Uint8Array; readonly type: string; readonly flags?: number; readonly counter?: number };

function parseSignature(armored: string): Result<Parsed, string> {
  const lines = armored.trim().split("\n").map((l) => l.trim());
  if (lines[0] !== ARMOR_BEGIN || lines.at(-1) !== ARMOR_END) return err("the signature is not an SSH signature");
  const blob = unb64(lines.slice(1, -1).join(""));
  if (blob === undefined) return err("the signature is not base64");
  if (new TextDecoder().decode(blob.slice(0, 6)) !== "SSHSIG") return err("the signature has no SSHSIG magic");
  const w = new Wire(blob);
  w.at = 6;
  const version = w.u32();
  const publicKey = w.string();
  const namespace = w.string();
  const reserved = w.string();
  const hash = w.string();
  const sig = w.string();
  if (version !== 1 || publicKey === undefined || namespace === undefined || reserved === undefined || hash === undefined || sig === undefined) return err("the signature is not of the format of version 1");
  if (w.at !== blob.length) return err("the signature has bytes after its last field");
  const inner = new Wire(sig);
  const type = inner.string();
  const raw = inner.string();
  if (type === undefined || raw === undefined || raw.length !== 64) return err("only ssh-ed25519 and sk-ssh-ed25519 signatures are verified");
  const name = new TextDecoder().decode(type);
  const base = { publicKey, namespace: new TextDecoder().decode(namespace), hash: new TextDecoder().decode(hash), signature: raw, type: name };
  if (name === "ssh-ed25519") return inner.at === sig.length ? ok(base) : err("the signature has bytes after its last field");
  if (name !== SK_ED25519) return err("only ssh-ed25519 and sk-ssh-ed25519 signatures are verified");
  const flags = inner.b[inner.at];
  inner.at += 1;
  const counter = inner.u32();
  if (flags === undefined || counter === undefined) return err("the signature of a token has no flags and counter");
  if (inner.at !== sig.length) return err("the signature has bytes after its last field");
  return ok({ ...base, flags, counter });
}

async function hashOf(algorithm: string, message: Uint8Array): Promise<Uint8Array | undefined> {
  const name = algorithm === "sha512" ? "SHA-512" : algorithm === "sha256" ? "SHA-256" : undefined;
  return name === undefined ? undefined : new Uint8Array(await crypto.subtle.digest(name, new Uint8Array(message)));
}

export type { SignatureFacts };

async function verifyFacts(armored: string, message: Uint8Array, key: VerifyKey, namespace: string): Promise<Result<SignatureFacts, SignProblem>> {
  const parsed = parseSignature(armored);
  if (parsed.kind === "err") return err({ kind: "signature", message: parsed.error });
  const trusted = keyBlob(key.publicKey);
  if (trusted.kind === "err") return err({ kind: "key", message: trusted.error });
  if (parsed.value.namespace !== namespace) return err({ kind: "signature", message: `the signature is in the namespace ${parsed.value.namespace}, not ${namespace}` });
  if (parsed.value.publicKey.length !== trusted.value.length || !parsed.value.publicKey.every((b, i) => b === trusted.value[i])) return err({ kind: "key", message: "the signature is by another key than the one trusted" });
  const digest = await hashOf(parsed.value.hash, message);
  if (digest === undefined) return err({ kind: "signature", message: `the hash ${parsed.value.hash} is not sha256 or sha512` });
  const data = concat(enc.encode("SSHSIG"), str(enc.encode(namespace)), str(new Uint8Array()), str(enc.encode(parsed.value.hash)), str(digest));
  const raw = new Wire(trusted.value);
  const blobType = raw.string();
  const pub = raw.string();
  if (pub === undefined || pub.length !== 32) return err({ kind: "key", message: "the public key is not an Ed25519 key" });
  const isSk = parsed.value.type === SK_ED25519;
  if (isSk !== (blobType !== undefined && new TextDecoder().decode(blobType) === SK_ED25519)) return err({ kind: "key", message: "the kind of the key and the kind of the signature differ" });
  let signed: Uint8Array = data;
  if (isSk) {
    const application = raw.string();
    if (application === undefined) return err({ kind: "key", message: "the public key of a token has no application" });
    const sha = async (b: Uint8Array): Promise<Uint8Array> => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(b)));
    signed = concat(await sha(application), new Uint8Array([parsed.value.flags ?? 0]), u32(parsed.value.counter ?? 0), await sha(data));
  }
  const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(pub), { name: "Ed25519" }, false, ["verify"]);
  const good = await crypto.subtle.verify({ name: "Ed25519" }, cryptoKey, new Uint8Array(parsed.value.signature), new Uint8Array(signed));
  if (!good) return err({ kind: "signature", message: "the signature does not verify" });
  return ok(isSk ? { keyType: SK_ED25519, flags: { userPresent: ((parsed.value.flags ?? 0) & 1) !== 0, userVerified: ((parsed.value.flags ?? 0) & 4) !== 0 }, counter: parsed.value.counter ?? 0 } : { keyType: "ssh-ed25519" });
}

async function verifyArmored(armored: string, message: Uint8Array, key: VerifyKey, namespace: string): Promise<Result<void, SignProblem>> {
  const r = await verifyFacts(armored, message, key, namespace);
  return r.kind === "ok" ? ok(undefined) : r;
}

/** A signature verified, with what it says of itself: the kind of key and, for a token, the flags and counter (spec 0020-grc-approval FR-013). Pure, with Web Crypto. */
export function verifySshsigFacts(armored: string, message: Uint8Array, publicKey: string, namespace: string): Promise<Result<SignatureFacts, SignProblem>> {
  return verifyFacts(armored, message, { publicKey }, namespace);
}

/** The line of the public key that made an armored signature (`ssh-ed25519 AAAA...`), or why the signature cannot be read. */
export function signerLineOf(armored: string): Result<string, string> {
  const parsed = parseSignature(armored);
  if (parsed.kind === "err") return parsed;
  return ok(`${parsed.value.type === SK_ED25519 ? SK_ED25519 : "ssh-ed25519"} ${b64(parsed.value.publicKey)}`);
}

/** A signature verified without a program, for a message that is not the encoding of DSSE (the bytes of a Git object, for instance): the armored signature, the message, the public key line and the namespace it must be in. */
export function verifySshsig(armored: string, message: Uint8Array, publicKey: string, namespace: string): Promise<Result<void, SignProblem>> {
  return verifyArmored(armored, message, { publicKey }, namespace);
}

/** The `sshsig` signer of a namespace (0017-grc-sshsig-namespace FR-001). Its custody is `file`: the key is held in a file (or by an agent) the person controls. Signing is by `ssh-keygen -Y sign`, which it names where it is not installed. */
export function sshsigSignerFor(namespace: Namespace | typeof NAMESPACE): Signer {
  return {
    id: "sshsig",
    custody: "file",
    async sign(payloadType, payload, keys) {
      const k = keys[0] as SignKey | undefined;
      if (k === undefined || typeof k.keyFile !== "string") return err({ kind: "key", message: "an sshsig key is { keyFile }, and one is needed" });
      const r = await proc.run(["ssh-keygen", "-Y", "sign", "-f", k.keyFile, "-n", namespace, ...(k.agent === true ? ["-U"] : [])], { input: pae(payloadType, payload) });
      if (!r.success) return err({ kind: "key", message: `ssh-keygen did not sign: ${r.stderr.trim().split("\n").slice(-1)[0] ?? "is ssh-keygen installed?"}` });
      const parsed = parseSignature(r.stdout);
      if (parsed.kind === "err") return err({ kind: "signature", message: parsed.error });
      const fp = await fingerprintOf(`ssh-ed25519 ${b64(parsed.value.publicKey.slice(0))}`);
      return ok({ payloadType, payload: b64(payload), signatures: [{ ...(fp.kind === "ok" ? { keyid: fp.value } : {}), sig: r.stdout.trim() }] } satisfies Envelope);
    },
    async verify(envelope, payloadType, keys) {
      if (envelope.payloadType !== payloadType) return err({ kind: "payload-type", message: `the payload is for ${envelope.payloadType}, not ${payloadType}` });
      const payload = unb64(envelope.payload);
      if (payload === undefined) return err({ kind: "signature", message: "the payload is not base64" });
      const message = pae(envelope.payloadType, payload);
      let last: SignProblem = { kind: "key", message: "there is no key to verify with" };
      for (const sig of envelope.signatures) {
        for (const key of keys as readonly VerifyKey[]) {
          const r = await verifyArmored(sig.sig, message, key, namespace);
          if (r.kind === "ok") return ok(payload);
          last = r.error;
        }
      }
      return err(last);
    },
  };
}

/** The `sshsig` signer of the evidence of grc, in the namespace `grc-evidence`. */
export const sshsigSigner: Signer = sshsigSignerFor(NAMESPACE);

/** The verifier that the registry of keys and the approvals take as their port (spec 0020-grc-approval FR-013): the fingerprint of a key line, the key line that signed, and the verification with its facts. */
export const approvalVerifier = {
  fingerprint: fingerprintOf,
  signerOf: (armored: string): Promise<Result<string, string>> => Promise.resolve(signerLineOf(armored)),
  async verify(armored: string, message: Uint8Array, publicKey: string, namespace: string): Promise<Result<SignatureFacts, string>> {
    const r = await verifyFacts(armored, message, { publicKey }, namespace);
    return r.kind === "ok" ? r : err(r.error.message);
  },
};

/**
 * The signature of a version of the registry of the keys of persons by the key of a registry administrator (spec 0020-grc-approval FR-029): the envelope of DSSE with the canonical JSON of the version as its payload, in the namespace `ifc-approval`, which
 * `registryOfChain` verifies. It signs with `ssh-keygen -Y sign` and reads no private key itself.
 */
export async function signRegistry(registry: PersonKeys, key: SignKey): Promise<Result<SignedDocument, string>> {
  const r = await sshsigSignerFor(APPROVAL_NAMESPACE as Namespace).sign(REGISTRY_PAYLOAD_TYPE, new TextEncoder().encode(canonicalize(registry)), [key]);
  return r.kind === "ok" ? ok(r.value as SignedDocument) : err(r.error.message);
}
