// Spec: 0002-enrollment-protocol FR-015
/**
 * Keys and fingerprints as data: a fingerprint is `SHA256:` and the base64 of the SHA-256 of the key blob, without padding, as OpenSSH prints it. No I/O: the hash of a blob is made in the physical layer.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Brand, Result } from "@intellectual-frontiers/core";

/** `SHA256:` and 43 characters of base64 without padding. */
export type Fingerprint = Brand<string, "Fingerprint">;

const FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/;
const ALGOS = ["ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "ssh-rsa", "rsa-sha2-256", "rsa-sha2-512", "sk-ssh-ed25519@openssh.com", "sk-ecdsa-sha2-nistp256@openssh.com"] as const;

/** Read a fingerprint, or say what is wrong. */
export function parseFingerprint(text: unknown): Result<Fingerprint, string> {
  if (typeof text !== "string" || !FINGERPRINT.test(text)) return err("a fingerprint is SHA256: and 43 characters of base64 without padding");
  return ok(text as Fingerprint);
}

/** A public key algorithm name that this library knows. */
export function isKeyAlgo(text: unknown): text is string {
  return typeof text === "string" && (ALGOS as readonly string[]).includes(text);
}

/** A host key of the server or of a device: its algorithm, its fingerprint and its public key in the one-line form (`algo base64`). */
export type HostKey = { readonly algo: string; readonly fingerprint: Fingerprint; readonly publicKey: string };

/** A key a client offered: `proven` only where its signature was verified over the session. An unsigned query proves nothing. */
export type OfferedKey = { readonly algo: string; readonly fingerprint: Fingerprint; readonly proven: boolean };

/** Read a public key line (`algo base64 [comment]`) as an algorithm and a blob of base64, or say what is wrong. */
export function parsePublicKeyLine(line: unknown): Result<{ readonly algo: string; readonly base64: string }, string> {
  if (typeof line !== "string" || line.length > 2048) return err("a public key is one line of at most 2048 characters");
  const [algo, base64] = line.trim().split(/\s+/);
  if (!isKeyAlgo(algo)) return err("an unknown or refused key algorithm");
  if (base64 === undefined || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return err("the key is not base64");
  return ok({ algo, base64 });
}
