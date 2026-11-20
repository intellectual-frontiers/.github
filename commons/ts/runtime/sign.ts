/**
 * Signing and verifying behind one interface (commons 0007-grc FR-020): a `Signer` turns bytes into a signature and the id of the key that
 * made it, a `Verifier` says whether a signature over bytes holds. Two kinds stand behind it. `sshSigner` and `sshVerifier` run OpenSSH's
 * `ssh-keygen -Y sign` and `ssh-keygen -Y verify` by their argument vector (the message on standard input, the signature an armored
 * SSHSIG), with the namespace given, the private key a file the caller names and the allowed signers a file the caller names; nothing else
 * is read, and the signature's temporary file is removed after use. `webCryptoSigner` and `webCryptoVerifier` sign with Web Crypto keys
 * (Ed25519, ECDSA with DER signatures, RSA-PSS, RSASSA-PKCS1-v1_5) in the same form as `kernel/dsse.ts`, so an envelope signed here
 * verifies there and the other way round. `signEnvelopeWith` and `verifyEnvelopeWith` make and check DSSE envelopes with any of them, and
 * `toSign` and `toVerifySignature` give the shapes `kernel/evidence.ts` takes for manifests and bundles.
 *
 * Failures expected in use (no `ssh-keygen`, a key that cannot sign) are `Result`s; a signature that does not hold is `ok(false)`.
 *
 * @example
 * ```ts
 * import { sshSigner, sshVerifier } from "./sign.ts";
 * const message = new TextEncoder().encode("release 1.2.3");
 * const signed = await sshSigner({ keyFile: "ci_ed25519", namespace: "file" }).sign(message);
 * if (signed.kind === "ok") {
 *   const v = sshVerifier({ allowedSignersFile: "allowed_signers", identity: "ci@example.com", namespace: "file" });
 *   await v.verify(message, signed.value.sig); // { kind: "ok", value: true }
 * }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { fromBase64, toBase64 } from "../kernel/base64.ts";
import { children, integer, readTlv, sequence, TAG } from "../kernel/der.ts";
import { type DsseAlgorithm, type DsseEnvelope, pae, signatureAlgorithm } from "../kernel/dsse.ts";
import type { Sign, VerifySignature } from "../kernel/evidence.ts";
import { fromHex, sha256 } from "../kernel/sha256.ts";
import { NotFound } from "./errors.ts";
import { exists, withTempDir, writeFile } from "./fs.ts";
import { join } from "./path.ts";
import { output } from "./proc.ts";

// ---------------------------------------------------------------------------------------------------------------------------- the interface

/** Why signing or verifying could not be done (as opposed to a signature that does not hold). */
export type SignError =
  | { readonly kind: "missing-program"; readonly program: string }
  | { readonly kind: "key"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };

/** A signature, and the id of the key that made it. */
export type Signature = { readonly keyid: string; readonly sig: Uint8Array };

/** A signer: bytes to a signature with the id of its key. */
export type Signer = {
  /** How it signs. */
  readonly kind: "ssh" | "web-crypto";
  /** The signature over `message`, or why there is none. */
  readonly sign: (message: Uint8Array) => Promise<Result<Signature, SignError>>;
};

/** A verifier: whether a signature over bytes holds (`ok(false)` where it does not), or why it could not be checked. */
export type Verifier = {
  /** How it verifies. */
  readonly kind: "ssh" | "web-crypto";
  /** The id of the key it verifies with, where it has one: an envelope's signature naming another id is not tried with it. */
  readonly keyid?: string;
  /** Whether `sig` is a signature over `message`. */
  readonly verify: (message: Uint8Array, sig: Uint8Array) => Promise<Result<boolean, SignError>>;
};

/** A sign error as one sentence. */
export function formatSignError(e: SignError): string {
  switch (e.kind) {
    case "missing-program":
      return `${e.program} is not installed (or not on PATH)`;
    case "key":
      return `the key cannot be used: ${e.reason}`;
    case "failed":
      return `signing failed: ${e.reason}`;
    default:
      return absurd(e);
  }
}

/** A signer as the `Sign` that `kernel/evidence.ts` takes; that shape has no error, so a failure rejects with an `Error` naming it. */
export function toSign(signer: Signer): Sign {
  return async (message) => {
    const r = await signer.sign(message);
    if (r.kind === "err") throw new Error(formatSignError(r.error));
    return r.value.sig;
  };
}

/** A verifier as the `VerifySignature` that `kernel/evidence.ts` takes; a check that cannot be done rejects, which it reports as a bad signature with the reason. */
export function toVerifySignature(verifier: Verifier): VerifySignature {
  return async (message, signature) => {
    const r = await verifier.verify(message, signature);
    if (r.kind === "err") throw new Error(formatSignError(r.error));
    return r.value;
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- DSSE

/** Why an envelope could not be signed: the place of the signer in the list given, and its error. */
export type EnvelopeSignError = { readonly kind: "signer"; readonly index: number; readonly error: SignError };

/** The payload of the type signed by every signer given, over DSSE's pre-authentication encoding, in an envelope with each key's id. */
export async function signEnvelopeWith(
  payloadType: string,
  payload: Uint8Array,
  signers: readonly Signer[],
): Promise<Result<DsseEnvelope, EnvelopeSignError>> {
  const message = pae(payloadType, payload);
  const signatures: { readonly keyid: string; readonly sig: string }[] = [];
  for (const [index, s] of signers.entries()) {
    const r = await s.sign(message);
    if (r.kind === "err") return err({ kind: "signer", index, error: r.error });
    signatures.push({ keyid: r.value.keyid, sig: toBase64(r.value.sig) });
  }
  return ok({ payload: toBase64(payload), payloadType, signatures });
}

/** Why an envelope was refused. */
export type EnvelopeVerifyError =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "payload-type"; readonly expected: string; readonly found: string }
  | { readonly kind: "verifier"; readonly index: number; readonly error: SignError }
  | { readonly kind: "no-valid-signature"; readonly signatures: number; readonly verified: number; readonly threshold: number };

/** What a verified envelope carries: its payload type, its payload, and the places of the verifiers that held a signature. */
export type VerifiedEnvelope = { readonly payloadType: string; readonly payload: Uint8Array; readonly verifiers: readonly number[] };

/**
 * The payload of an envelope of type `payloadType` of which at least `threshold` (1 by default) of the verifiers given each hold a
 * signature. A signature naming a key id is tried only with verifiers of that id or of none.
 */
export async function verifyEnvelopeWith(
  envelope: DsseEnvelope,
  payloadType: string,
  verifiers: readonly Verifier[],
  threshold = 1,
): Promise<Result<VerifiedEnvelope, EnvelopeVerifyError>> {
  if (envelope.payloadType !== payloadType) return err({ kind: "payload-type", expected: payloadType, found: envelope.payloadType });
  const payload = fromBase64(envelope.payload);
  if (payload.kind === "err") return err({ kind: "malformed", reason: `the payload: ${payload.error}` });
  const sigs: Uint8Array[] = [];
  for (const [i, s] of envelope.signatures.entries()) {
    const b = fromBase64(s.sig);
    if (b.kind === "err") return err({ kind: "malformed", reason: `signature ${i}: ${b.error}` });
    sigs.push(b.value);
  }
  const message = pae(envelope.payloadType, payload.value);
  const held: number[] = [];
  for (const [index, v] of verifiers.entries()) {
    for (const [i, s] of envelope.signatures.entries()) {
      const bytes = sigs[i];
      if (bytes === undefined || (s.keyid !== undefined && v.keyid !== undefined && s.keyid !== v.keyid)) continue;
      const r = await v.verify(message, bytes);
      if (r.kind === "err") return err({ kind: "verifier", index, error: r.error });
      if (r.value) {
        held.push(index);
        break;
      }
    }
  }
  const needed = Math.max(1, threshold);
  if (held.length < needed) {
    return err({ kind: "no-valid-signature", signatures: envelope.signatures.length, verified: held.length, threshold: needed });
  }
  return ok({ payloadType: envelope.payloadType, payload: payload.value, verifiers: held });
}

// ---------------------------------------------------------------------------------------------------------------------------- ssh-keygen -Y

/** How `sshSigner` signs: the private key's file, the namespace (`file`, `git`, or one of the caller's own), and optionally the key id and the program. */
export type SshSignerOptions = {
  /** The private key's file (unencrypted, or held by an agent for its public key); the only key file read. */
  readonly keyFile: string;
  /** The namespace the signature is bound to; a verifier must name the same one. */
  readonly namespace: string;
  /** The id a signature carries; by default the key's SHA-256 fingerprint (`SHA256:...`) as `ssh-keygen -l` shows it, read from the signature. */
  readonly keyid?: string;
  /** The program to run (`ssh-keygen` on PATH by default). */
  readonly program?: string;
};

/** How `sshVerifier` verifies: the allowed signers file, the identity expected in it, the namespace, and optionally the program. */
export type SshVerifierOptions = {
  /** The allowed signers file (`ssh-keygen(1)`'s ALLOWED SIGNERS format); the only key file read. */
  readonly allowedSignersFile: string;
  /** The principal the signature must be by, as the allowed signers file names it. */
  readonly identity: string;
  /** The namespace the signature must be bound to. */
  readonly namespace: string;
  /** The id of the key, where the caller knows it, to match an envelope's signatures by. */
  readonly keyid?: string;
  /** The program to run (`ssh-keygen` on PATH by default). */
  readonly program?: string;
};

const SSHSIG_MAGIC = "SSHSIG";

/** The bytes inside an armored SSH signature (`-----BEGIN SSH SIGNATURE-----`), or undefined where it is not one. */
function sshsigBlob(armored: string): Uint8Array | undefined {
  const m = /-----BEGIN SSH SIGNATURE-----([\s\S]*?)-----END SSH SIGNATURE-----/.exec(armored);
  if (m === null) return undefined;
  const b = fromBase64(m[1] ?? "");
  return b.kind === "ok" ? b.value : undefined;
}

/** The public key blob of an SSHSIG (magic, version, then the key as an SSH string), or undefined where it is not one. */
function sshsigPublicKey(blob: Uint8Array): Uint8Array | undefined {
  const magic = new TextDecoder().decode(blob.subarray(0, SSHSIG_MAGIC.length));
  if (magic !== SSHSIG_MAGIC || blob.length < 14) return undefined;
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const len = view.getUint32(10);
  if (14 + len > blob.length) return undefined;
  return blob.subarray(14, 14 + len);
}

/** The SHA-256 fingerprint of an SSH public key blob, as `ssh-keygen -l` writes it: `SHA256:` and unpadded base64. */
export async function sshFingerprint(publicKeyBlob: Uint8Array): Promise<string> {
  const digest = fromHex(await sha256(publicKeyBlob)) ?? new Uint8Array(0);
  return `SHA256:${toBase64(digest).replace(/=+$/, "")}`;
}

/** What ssh-keygen said, trimmed, or its exit status where it said nothing. */
const said = (stderr: Uint8Array, code: number): string => new TextDecoder().decode(stderr).trim() || `exit status ${code}`;

/** A program run by its argument vector, or `missing-program` where it is not installed. */
async function runProgram(
  argv: readonly [string, ...string[]],
  input: Uint8Array,
): Promise<Result<{ readonly code: number; readonly stdout: Uint8Array; readonly stderr: Uint8Array }, SignError>> {
  try {
    const r = await output(argv, { input, env: { LC_ALL: "C" } });
    return ok(r);
  } catch (e) {
    if (e instanceof NotFound) return err({ kind: "missing-program", program: argv[0] });
    return err({ kind: "failed", reason: e instanceof Error ? e.message : String(e) });
  }
}

/** A signer by `ssh-keygen -Y sign -f KEY -n NAMESPACE`, the message on standard input; its signatures are armored SSHSIG text as bytes. */
export function sshSigner(options: SshSignerOptions): Signer {
  const program = options.program ?? "ssh-keygen";
  return {
    kind: "ssh",
    async sign(message) {
      if (!(await exists(options.keyFile))) return err({ kind: "key", reason: `no key file ${options.keyFile}` });
      const r = await runProgram([program, "-Y", "sign", "-f", options.keyFile, "-n", options.namespace], message);
      if (r.kind === "err") return r;
      if (r.value.code !== 0) return err({ kind: "failed", reason: said(r.value.stderr, r.value.code) });
      const armored = new TextDecoder().decode(r.value.stdout);
      const blob = sshsigBlob(armored);
      const key = blob === undefined ? undefined : sshsigPublicKey(blob);
      if (key === undefined) return err({ kind: "failed", reason: `${program} wrote no SSH signature` });
      return ok({ keyid: options.keyid ?? (await sshFingerprint(key)), sig: r.value.stdout });
    },
  };
}

/**
 * A verifier by `ssh-keygen -Y verify -f ALLOWED -I IDENTITY -n NAMESPACE -s SIGFILE`, the message on standard input; the signature is
 * written to a private temporary folder removed afterwards. A signature that does not hold (or is not by that identity, or not in that
 * namespace) is `ok(false)`; an allowed signers file that is not there is a `key` error.
 */
export function sshVerifier(options: SshVerifierOptions): Verifier {
  const program = options.program ?? "ssh-keygen";
  const verify = async (message: Uint8Array, sig: Uint8Array): Promise<Result<boolean, SignError>> => {
    if (!(await exists(options.allowedSignersFile)))
      return err({ kind: "key", reason: `no allowed signers file ${options.allowedSignersFile}` });
    if (sshsigBlob(new TextDecoder().decode(sig)) === undefined) return ok(false);
    return withTempDir(
      async (dir) => {
        const sigFile = join(dir, "message.sig");
        await writeFile(sigFile, sig);
        const f = options.allowedSignersFile;
        const r = await runProgram(
          [program, "-Y", "verify", "-f", f, "-I", options.identity, "-n", options.namespace, "-s", sigFile],
          message,
        );
        if (r.kind === "err") return r;
        return ok(r.value.code === 0);
      },
      { prefix: "ifc-sshsig-" },
    );
  };
  return options.keyid === undefined ? { kind: "ssh", verify } : { kind: "ssh", keyid: options.keyid, verify };
}

// ---------------------------------------------------------------------------------------------------------------------------- Web Crypto

const CURVE_BYTES = { "P-256": 32, "P-384": 48, "P-521": 66 } as const;
const CURVE_HASH = { "P-256": "SHA-256", "P-384": "SHA-384", "P-521": "SHA-512" } as const;
const HASH_BYTES = { "SHA-256": 32, "SHA-384": 48, "SHA-512": 64 } as const;

/** Web Crypto's parameters for an algorithm, as `kernel/dsse.ts` signs with them. */
function params(a: DsseAlgorithm): AlgorithmIdentifier | EcdsaParams | RsaPssParams {
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

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** A signer with a Web Crypto private key, its signatures in the form `kernel/dsse.ts` writes (ECDSA as DER), each named by `keyid`. */
export function webCryptoSigner(privateKey: CryptoKey, keyid: string): Signer {
  return {
    kind: "web-crypto",
    async sign(message) {
      const a = signatureAlgorithm(privateKey);
      if (a.kind === "err") return err({ kind: "key", reason: a.error });
      let raw: Uint8Array;
      try {
        raw = new Uint8Array(await crypto.subtle.sign(params(a.value), privateKey, new Uint8Array(message)));
      } catch (e) {
        return err({ kind: "key", reason: reason(e) });
      }
      if (a.value.kind !== "ecdsa") return ok({ keyid, sig: raw });
      const n = CURVE_BYTES[a.value.curve];
      return ok({ keyid, sig: sequence(integer(raw.subarray(0, n)), integer(raw.subarray(n, 2 * n))) });
    },
  };
}

/** A verifier with a Web Crypto public key, of signatures in the form `kernel/dsse.ts` writes; with `keyid`, matched by it in envelopes. */
export function webCryptoVerifier(publicKey: CryptoKey, keyid?: string): Verifier {
  const verify = async (message: Uint8Array, sig: Uint8Array): Promise<Result<boolean, SignError>> => {
    const a = signatureAlgorithm(publicKey);
    if (a.kind === "err") return err({ kind: "key", reason: a.error });
    const bytes = a.value.kind === "ecdsa" ? ecdsaFromDer(sig, CURVE_BYTES[a.value.curve]) : new Uint8Array(sig);
    if (bytes === undefined) return ok(false);
    try {
      return ok(await crypto.subtle.verify(params(a.value), publicKey, bytes, new Uint8Array(message)));
    } catch (e) {
      return err({ kind: "key", reason: reason(e) });
    }
  };
  return keyid === undefined ? { kind: "web-crypto", verify } : { kind: "web-crypto", keyid, verify };
}
