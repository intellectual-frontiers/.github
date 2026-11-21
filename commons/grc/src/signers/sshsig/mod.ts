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
import { proc } from "@intellectual-frontiers/system";
import type { Envelope, SignProblem, Signer } from "@intellectual-frontiers/grc/physical";

/** The namespace every signature is made in: a signature made for something else does not verify here. */
export const NAMESPACE = "grc-evidence";

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

/** DSSE's pre-authentication encoding of a payload type and a payload: what is signed. */
export function pae(payloadType: string, payload: Uint8Array): Uint8Array {
  const type = enc.encode(payloadType);
  return concat(enc.encode(`DSSEv1 ${type.length} `), type, enc.encode(` ${payload.length} `), payload);
}

/** The blob of a public key line, or why not. */
function keyBlob(line: string): Result<Uint8Array, string> {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2 || parts[0] !== "ssh-ed25519") return err(`${parts[0] ?? "this"} is not a key type that is verified: only ssh-ed25519`);
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

const ARMOR_BEGIN = "-----BEGIN SSH SIGNATURE-----";
const ARMOR_END = "-----END SSH SIGNATURE-----";

type Parsed = { readonly publicKey: Uint8Array; readonly namespace: string; readonly hash: string; readonly signature: Uint8Array };

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
  const inner = new Wire(sig);
  const type = inner.string();
  const raw = inner.string();
  if (type === undefined || raw === undefined || new TextDecoder().decode(type) !== "ssh-ed25519" || raw.length !== 64) return err("only ssh-ed25519 signatures are verified");
  return ok({ publicKey, namespace: new TextDecoder().decode(namespace), hash: new TextDecoder().decode(hash), signature: raw });
}

async function hashOf(algorithm: string, message: Uint8Array): Promise<Uint8Array | undefined> {
  const name = algorithm === "sha512" ? "SHA-512" : algorithm === "sha256" ? "SHA-256" : undefined;
  return name === undefined ? undefined : new Uint8Array(await crypto.subtle.digest(name, new Uint8Array(message)));
}

async function verifyArmored(armored: string, message: Uint8Array, key: VerifyKey): Promise<Result<void, SignProblem>> {
  const parsed = parseSignature(armored);
  if (parsed.kind === "err") return err({ kind: "signature", message: parsed.error });
  const trusted = keyBlob(key.publicKey);
  if (trusted.kind === "err") return err({ kind: "key", message: trusted.error });
  if (parsed.value.namespace !== NAMESPACE) return err({ kind: "signature", message: `the signature is in the namespace ${parsed.value.namespace}, not ${NAMESPACE}` });
  if (parsed.value.publicKey.length !== trusted.value.length || !parsed.value.publicKey.every((b, i) => b === trusted.value[i])) return err({ kind: "key", message: "the signature is by another key than the one trusted" });
  const digest = await hashOf(parsed.value.hash, message);
  if (digest === undefined) return err({ kind: "signature", message: `the hash ${parsed.value.hash} is not sha256 or sha512` });
  const data = concat(enc.encode("SSHSIG"), str(enc.encode(NAMESPACE)), str(new Uint8Array()), str(enc.encode(parsed.value.hash)), str(digest));
  const raw = new Wire(trusted.value);
  raw.string();
  const pub = raw.string();
  if (pub === undefined || pub.length !== 32) return err({ kind: "key", message: "the public key is not an Ed25519 key" });
  const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(pub), { name: "Ed25519" }, false, ["verify"]);
  const good = await crypto.subtle.verify({ name: "Ed25519" }, cryptoKey, new Uint8Array(parsed.value.signature), new Uint8Array(data));
  return good ? ok(undefined) : err({ kind: "signature", message: "the signature does not verify" });
}

/** The `sshsig` signer. Its custody is `file`: the key is held in a file (or by an agent) the person controls. */
export const sshsigSigner: Signer = {
  id: "sshsig",
  custody: "file",
  async sign(payloadType, payload, keys) {
    const k = keys[0] as SignKey | undefined;
    if (k === undefined || typeof k.keyFile !== "string") return err({ kind: "key", message: "an sshsig key is { keyFile }, and one is needed" });
    const r = await proc.run(["ssh-keygen", "-Y", "sign", "-f", k.keyFile, "-n", NAMESPACE, ...(k.agent === true ? ["-U"] : [])], { input: pae(payloadType, payload) });
    if (!r.success) return err({ kind: "key", message: `ssh-keygen did not sign: ${r.stderr.trim().split("\n").slice(-1)[0] ?? ""}` });
    const parsed = parseSignature(r.stdout);
    if (parsed.kind === "err") return err({ kind: "signature", message: parsed.error });
    const pub = new Wire(parsed.value.publicKey);
    pub.string();
    const fp = await fingerprintOf(`ssh-ed25519 ${b64(parsed.value.publicKey)}`);
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
        const r = await verifyArmored(sig.sig, message, key);
        if (r.kind === "ok") return ok(payload);
        last = r.error;
      }
    }
    return err(last);
  },
};
