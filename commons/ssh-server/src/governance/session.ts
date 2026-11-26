// Spec: 0002-enrollment-protocol FR-004, FR-014
/**
 * The enrollment session and the audit event as data. A session is what the server keeps of one device from its first command to the end: its state, where it came from, which keys it proved, what it said about itself and what was decided.
 *
 * @module
 */
import type { Brand } from "@intellectual-frontiers/core";
import type { Facts } from "./facts.ts";
import type { Fingerprint, OfferedKey } from "./keys.ts";
import type { InstallPlan, StepResult } from "./plan.ts";

/** The identifier of a session: `en-` and 16 characters of base32. It is a capability for the commands `report`, `next` and `done`, and is bound to the source address that opened it. */
export type SessionId = Brand<string, "SessionId">;
/** The state of a session. */
export type SessionState = "pending" | "interrogated" | "approved" | "installing" | "enrolled" | "failed" | "refused" | "expired";
/** The states from which a session does not move. */
export const TERMINAL: readonly SessionState[] = ["enrolled", "failed", "refused", "expired"];
/** The class of a device, guessed from the banner of its client. */
export type DeviceClass = "openssh" | "dropbear" | "libssh" | "cisco" | "routeros" | "junos" | "edgeos" | "unifi" | "putty" | "other";

/** What a presented token or pairing code binds a session to. */
export type Binding = { readonly kind: "token" | "pairing"; readonly id: string; readonly tenant?: string; readonly fleet?: string; readonly labels: readonly string[] };

/** What a person or the policy decided. */
export type Decision = {
  readonly outcome: "approve" | "pending" | "refuse";
  readonly by: string;
  readonly at: number;
  readonly rule?: number;
  readonly explanation: string;
};

/** The state of the pairing handshake of a session: the commitments and nonces, the short authentication string the controller expects, how many wrong tries were made and why it burned. */
export type PairingState = {
  /** The commitment of the device, `Cd`. */
  readonly cd?: string;
  /** The commitment of the controller, `Cc`, and its nonce `Nc`. */
  readonly cc?: string;
  readonly nc?: string;
  readonly nd?: string;
  readonly devicePub?: string;
  readonly controllerHostKey: string;
  /** The code the controller expects a person to type. */
  readonly sas?: string;
  /** `true` where the code was made by the controller and printed to a client that could not do the handshake (the tier of trust on first use). */
  readonly tofu?: boolean;
  readonly attempts: number;
  readonly startedAt: number;
  readonly expiresAt: number;
  readonly confirmed?: boolean;
  /** Why it burned: a possible interception or too many wrong codes or its time. */
  readonly burned?: string;
};

/** What a device reported when it ended the install: the result of every step it ran (an optional step may have failed or been skipped), what a failed install left on the device, and what a person runs there to clean it. The strings are the device's words, shown and never run by the controller. */
export type InstallOutcome = { readonly steps: readonly StepResult[]; readonly left: readonly string[]; readonly cleanup: readonly string[] };

/** A session. */
export type EnrollmentSession = {
  /** The key the device proved when it paired: every later command of the session MUST be proven by the same key. */
  readonly deviceKey?: Fingerprint;
  readonly pairing?: PairingState;
  readonly id: SessionId;
  readonly state: SessionState;
  readonly sourceIp: string;
  readonly clientIdent: string;
  readonly deviceClass: DeviceClass;
  readonly offeredKeys: readonly OfferedKey[];
  readonly neighbourMac?: string;
  readonly reverseDns?: string;
  readonly binding?: Binding;
  readonly facts?: Facts;
  readonly plan?: InstallPlan;
  readonly outcome?: InstallOutcome;
  readonly decision?: Decision;
  readonly assetId?: string;
  readonly consent?: boolean;
  readonly scriptSha256?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly expiresAt: number;
};

/** The kind of an audit event. */
export type AuditEventKind = "pairing" | "connect" | "auth" | "command" | "refused" | "decision" | "state" | "script" | "plan" | "removal-request" | "limit" | "forward" | "close";

/** An audit event: what happened, to whom, from where. It holds no secret: a token is never written, only its id. */
export type AuditEvent = {
  readonly at: number;
  readonly kind: AuditEventKind;
  readonly sourceIp: string;
  readonly session?: string;
  readonly command?: string;
  readonly outcome: "ok" | "refused" | "error";
  readonly detail: string;
  readonly rule?: number;
  readonly scriptSha256?: string;
  readonly fingerprint?: Fingerprint;
  readonly account?: string;
  /** For kind `forward`: where the channel goes, as `host:port`. */
  readonly destination?: string;
  readonly clientIdent?: string;
  /** The SHA-256 of what the client sent and of what the server answered, over the whole conversation (kind `close`). */
  readonly stdinSha256?: string;
  readonly stdoutSha256?: string;
  readonly bytesIn?: number;
  readonly bytesOut?: number;
  /** A capped copy of the conversation, only where the policy asks for one. */
  readonly transcript?: string;
};

/** An audit event in the hash chain: its number, the hash of the event before and its own hash (SHA-256 of the canonical text of the event and `prev`). The log is evidence: any change breaks every hash after it. */
export type ChainedEvent = AuditEvent & { readonly seq: number; readonly prev: string; readonly hash: string };

/** The `prev` of the first event of a chain. */
export const GENESIS = "0".repeat(64);

/** A fact the controller already knows of a device, by which a new session is matched. */
export type KnownAsset = {
  readonly id: string;
  readonly machineId?: string;
  readonly serial?: string;
  readonly macs: readonly string[];
  readonly hostKeys: readonly Fingerprint[];
  /** The keys the device proved when it enrolled: the keys by which it authenticates `checkin` and `leave`. */
  readonly keys: readonly Fingerprint[];
  /** A new key announced by `rekey` with the old one, until the device proves it with `rekey-confirm`. */
  readonly pendingKeys?: readonly Fingerprint[];
  readonly revoked?: boolean;
  /** Set by the controller: the next `checkin` asks the device to rotate its key by itself. */
  readonly rotate?: boolean;
  readonly facts?: Facts;
  readonly pending?: InstallPlan;
  readonly removalRequested?: boolean;
};

/** A single-use, time-limited enrollment token: only its hash is stored. */
export type TokenRecord = { readonly id: string; /** The SHA-256 (hex) of the secret: the secret is shown once and never stored. */ readonly secretHash: string; readonly tenant?: string; readonly fleet?: string; readonly labels: readonly string[]; readonly expiresAt: number; readonly used: boolean };
/** A short human pairing code shown on the controller: single use, short lifetime. */
export type PairingRecord = { readonly code: string; readonly tenant?: string; readonly fleet?: string; readonly labels: readonly string[]; readonly expiresAt: number; readonly used: boolean };
