// Spec: 0002-enrollment-protocol FR-018, FR-019, FR-020, FR-021
/**
 * The pairing handshake, pure. A short code a person types cannot be a secret (it is guessed offline at once), so it is a SHORT AUTHENTICATION STRING in the manner of a numeric comparison: each side commits to what it saw
 * before it learns what the other saw, both reveal, each checks the other's commitment, and both derive the string from the controller host key as the device saw it, the device key and both nonces. A man in the middle that holds one
 * host key toward the device and another toward the controller makes the two strings differ, and the person's typing catches it. Three wrong codes, or the end of its time, burn the session (`E-SSH-PAIRING-BURNED`).
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Result } from "@intellectual-frontiers/core";
import { LETTERS, TERMINAL } from "@intellectual-frontiers/ssh-server/governance";
import type { AuditEvent, EnrollmentSession, Fingerprint, InstallPlan, PairingConfig, PairingState } from "@intellectual-frontiers/ssh-server/governance";
import { constantTimeEqual } from "./tokens.ts";
import type { Effect } from "./dialogue.ts";

/** What the handshake needs of the world: a hash, randomness and the fingerprint of a public key line. The physical layer supplies it. */
export type CryptoPort = {
  readonly sha256Hex: (text: string) => string;
  readonly randomHex: (bytes: number) => string;
  readonly fingerprintOfLine: (line: string) => Fingerprint | undefined;
};

/** The domain tags: a commitment and a string are never made of the same text. */
export const COMMIT_TAG = "ifc-enroll-commit-v1";
/** The domain tag of the short authentication string: it is hashed in front of the transcript so that a string is never made of the same text as a commitment. */
export const SAS_TAG = "ifc-enroll-sas-v1";
/** The code of an error where a pairing is burned. */
export const BURNED = "E-SSH-PAIRING-BURNED";

/** `commit(nonce, material) = sha256(tag || nonce || material)`, each part on its own line. */
export function commit(port: CryptoPort, nonce: string, material: string): string {
  return port.sha256Hex(`${COMMIT_TAG}\n${nonce}\n${material}`);
}

/** What the device commits to: its public key and the controller host key it observed. */
export function deviceMaterial(devicePub: string, observedHostKey: string): string {
  return `${devicePub}\n${observedHostKey}`;
}

/** The code from a hash in hex: digits, or letters of the alphabet without look-alikes. Only the first 8 hex characters are used. */
export function codeOf(hashHex: string, cfg: PairingConfig): string {
  let n = parseInt(hashHex.slice(0, 8), 16);
  if (cfg.kind === "digits") return String(n % 10 ** cfg.length).padStart(cfg.length, "0");
  let out = "";
  for (let i = 0; i < cfg.length; i++) {
    out += LETTERS[n % LETTERS.length];
    n = Math.floor(n / LETTERS.length);
  }
  return out;
}

/** The short authentication string: `sha256(tag || controller_host_key_as_seen || device_pub || Nc || Nd)`, as a code. */
export function sasOf(port: CryptoPort, cfg: PairingConfig, v: { readonly controllerHostKey: string; readonly devicePub: string; readonly nc: string; readonly nd: string }): string {
  return codeOf(port.sha256Hex(`${SAS_TAG}\n${v.controllerHostKey}\n${v.devicePub}\n${v.nc}\n${v.nd}`), cfg);
}

/** Whether a configuration of codes is one this library makes: digits 4 to 9, letters 3 to 6. */
export function checkPairingConfig(cfg: PairingConfig): Result<PairingConfig, string> {
  if (cfg.kind === "digits" && Number.isInteger(cfg.length) && cfg.length >= 4 && cfg.length <= 9) return ok(cfg);
  if (cfg.kind === "letters" && Number.isInteger(cfg.length) && cfg.length >= 3 && cfg.length <= 6) return ok(cfg);
  return err("a code is 4 to 9 digits or 3 to 6 letters");
}

/** What a person typed, made comparable: spaces and hyphens removed, letters in capitals. */
export function normaliseCode(typed: string, cfg: PairingConfig): string {
  const t = typed.replace(/[\s-]/g, "");
  return cfg.kind === "letters" ? t.toUpperCase() : t;
}

function audit(session: EnrollmentSession, at: number, outcome: AuditEvent["outcome"], detail: string): Effect {
  return { kind: "audit", event: { at, kind: "pairing", sourceIp: session.sourceIp, session: session.id, outcome, detail } };
}

function burn(session: EnrollmentSession, p: PairingState, reason: string, now: number): PairOutcome {
  const interception = reason.startsWith("interception");
  const detail = `${BURNED}: ${reason}${interception ? "; possible interception" : ""}`;
  const s: EnrollmentSession = { ...session, state: "refused", updatedAt: now, pairing: { ...p, burned: reason }, decision: { outcome: "refuse", by: "policy", at: now, explanation: detail } };
  return { kind: "burned", session: s, detail, effects: [{ kind: "put-session", session: s }, audit(s, now, "refused", detail)] };
}

/** What a step of the pairing gives. */
export type PairOutcome =
  | { readonly kind: "ok"; readonly session: EnrollmentSession; readonly out: Readonly<Record<string, string>>; readonly effects: readonly Effect[] }
  | { readonly kind: "burned"; readonly session: EnrollmentSession; readonly detail: string; readonly effects: readonly Effect[] };

/** The device's first message: its commitment `Cd`. The controller answers with `Cc = commit(Nc, controller_host_key)`. The key that proved itself on this connection becomes the key of the session. */
export function pairCommit(session: EnrollmentSession, cd: unknown, provenKey: Fingerprint, port: CryptoPort, controllerHostKey: string, now: number, ttlMs: number): Result<PairOutcome, string> {
  if (TERMINAL.includes(session.state)) return err(`a pairing is not begun in the state ${session.state}`);
  if (session.pairing?.cd !== undefined) return err("replayed: this session already has a commitment");
  if (typeof cd !== "string" || !/^[0-9a-f]{64}$/.test(cd)) return err("a commitment is 64 lowercase hex characters");
  const nc = port.randomHex(16);
  const cc = commit(port, nc, controllerHostKey);
  const pairing: PairingState = { cd, cc, nc, controllerHostKey, attempts: 0, startedAt: now, expiresAt: now + ttlMs };
  const s: EnrollmentSession = { ...session, deviceKey: provenKey, pairing, updatedAt: now };
  return ok({ kind: "ok", session: s, out: { cc }, effects: [{ kind: "put-session", session: s }, audit(s, now, "ok", "commitment of the device taken")] });
}

/** What the device reveals. */
export type Reveal = { readonly nonce: unknown; readonly devicePub: unknown; readonly hostKey: unknown };

/** The device's reveal. The commitment is checked, the key must be the one that proved itself, the host key the device saw must be the controller's own, and the nonce must be fresh. Any failure burns the session. */
export function pairReveal(session: EnrollmentSession, reveal: Reveal, provenKey: Fingerprint, nonceFresh: boolean, port: CryptoPort, cfg: PairingConfig, now: number): Result<PairOutcome, string> {
  const p = session.pairing;
  if (p === undefined || p.cd === undefined || p.nc === undefined) return err("no commitment yet: commit first");
  if (p.burned !== undefined || TERMINAL.includes(session.state)) return err("this pairing is over");
  if (p.nd !== undefined) return err("replayed: this session already has a reveal");
  if (now >= p.expiresAt) return ok(burn(session, p, "its time ended", now));
  const { nonce, devicePub, hostKey } = reveal;
  if (typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) return err("a nonce is 32 lowercase hex characters");
  if (typeof devicePub !== "string" || typeof hostKey !== "string" || devicePub.length > 600 || hostKey.length > 600) return err("a reveal holds the device key and the host key as seen");
  if (!nonceFresh) return ok(burn(session, p, "a nonce was used before", now));
  if (!constantTimeEqual(commit(port, nonce, deviceMaterial(devicePub, hostKey)), p.cd)) return ok(burn(session, p, "the reveal does not match the commitment", now));
  if (port.fingerprintOfLine(devicePub) !== provenKey) return ok(burn(session, p, "the key of the reveal is not the key that proved itself", now));
  if (!constantTimeEqual(hostKey, p.controllerHostKey)) return ok(burn(session, p, "interception: the device saw another host key than the controller's", now));
  const sas = sasOf(port, cfg, { controllerHostKey: p.controllerHostKey, devicePub, nc: p.nc, nd: nonce });
  const next: PairingState = { ...p, nd: nonce, devicePub, sas };
  const s: EnrollmentSession = { ...session, pairing: next, updatedAt: now };
  return ok({ kind: "ok", session: s, out: { nc: p.nc, controllerHostKey: p.controllerHostKey }, effects: [{ kind: "put-session", session: s }, audit(s, now, "ok", "reveal of the device taken; the code is made")] });
}

/** A pairing for a client that cannot do the handshake (a bare `ssh ... knock`): the controller makes the code, prints it into the output, and a person confirms it. This is trust on first use, and is documented as the weaker tier. */
export function tofuPairing(session: EnrollmentSession, port: CryptoPort, cfg: PairingConfig, controllerHostKey: string, now: number, ttlMs: number): EnrollmentSession {
  const sas = codeOf(port.sha256Hex(`${SAS_TAG}-tofu\n${port.randomHex(16)}`), cfg);
  return { ...session, pairing: { controllerHostKey, sas, tofu: true, attempts: 0, startedAt: now, expiresAt: now + ttlMs } };
}

/** What confirming a code gives. */
export type ConfirmOutcome =
  | { readonly kind: "approved"; readonly session: EnrollmentSession; readonly effects: readonly Effect[] }
  | { readonly kind: "wrong"; readonly session: EnrollmentSession; readonly left: number; readonly effects: readonly Effect[] }
  | { readonly kind: "burned"; readonly session: EnrollmentSession; readonly detail: string; readonly effects: readonly Effect[] };

/** The person types the code the device printed: `confirmPairing(session, typed)`. Equal (in constant time): the session is approved with the plan. Wrong: a try is spent; at `maxAttempts` the session burns. After its time it burns too. */
export function confirmPairing(session: EnrollmentSession, typed: string, by: string, plan: InstallPlan, cfg: PairingConfig, maxAttempts: number, now: number): Result<ConfirmOutcome, string> {
  const p = session.pairing;
  if (by.trim() === "") return err("a person's name is needed to confirm");
  if (p === undefined || p.sas === undefined) return err("this session has no code to confirm");
  if (p.burned !== undefined) return err(`${BURNED}: this pairing is over`);
  if (session.state !== "pending" && session.state !== "interrogated") return err(`a session in the state ${session.state} is not confirmed`);
  if (now >= p.expiresAt) {
    const b = burn(session, p, "its time ended", now);
    return ok({ kind: "burned", session: b.session, detail: b.kind === "burned" ? b.detail : "", effects: b.effects });
  }
  if (constantTimeEqual(normaliseCode(typed, cfg), p.sas)) {
    const s: EnrollmentSession = { ...session, state: "approved", updatedAt: now, plan, pairing: { ...p, confirmed: true }, decision: { outcome: "approve", by, at: now, explanation: `${by} typed the code the device showed` } };
    return ok({ kind: "approved", session: s, effects: [{ kind: "put-session", session: s }, audit(s, now, "ok", `the code was confirmed by ${by}`)] });
  }
  const attempts = p.attempts + 1;
  if (attempts >= maxAttempts) {
    const b = burn(session, { ...p, attempts }, "too many wrong codes", now);
    return ok({ kind: "burned", session: b.session, detail: b.kind === "burned" ? b.detail : "", effects: b.effects });
  }
  const s: EnrollmentSession = { ...session, updatedAt: now, pairing: { ...p, attempts } };
  return ok({ kind: "wrong", session: s, left: maxAttempts - attempts, effects: [{ kind: "put-session", session: s }, audit(s, now, "refused", `a wrong code (${attempts} of ${maxAttempts})`)] });
}
