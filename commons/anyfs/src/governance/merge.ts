// Spec: 0007-anyfs-merge-governance FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * What a merge is made of, as types. The source of truth of a merged store is a set of immutable version rows: each write or delete of a path is a new row, with an identity that is a UUID version 7 made by a
 * hybrid clock (so that ids made by one replica never go backwards, and ids of all replicas sort by time), the replica that made it and its number in that replica's rows, the version it replaced, and a digest of
 * all of it (so that a row is its own checksum). The bytes of a put are in a blob named by their SHA-256. Two stores merge by taking the union of their rows and blobs; what a path holds now is a function of the rows
 * alone. Each identity is made only by its parser, so that a text that is not one cannot be a replica or a version.
 *
 * @example
 * ```ts
 * import { parseReplicaId, parseVersionId } from "./merge.ts";
 * const r = parseReplicaId("0123456789abcdef0123456789abcdef");
 * const v = parseVersionId("018f3a6e-7c00-7000-8123-456789abcdef");
 * r.kind === "ok" && v.kind === "ok"; // true
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** The identity of one copy of a database: 32 lower case hexadecimal digits, random, never reused. Made only by `parseReplicaId`. */
export type ReplicaId = Brand<string, "anyfs replica id">;

const REPLICA = /^[0-9a-f]{32}$/u;

/** A replica identity from text, or why it is not one. */
export function parseReplicaId(text: string): Result<ReplicaId, string> {
  return REPLICA.test(text) ? ok(text as ReplicaId) : err(`${JSON.stringify(text.slice(0, 40))} is not a replica id: 32 lower case hexadecimal digits`);
}

/** A replica identity from 16 random bytes. */
export function replicaIdOfBytes(bytes: Uint8Array): Result<ReplicaId, string> {
  if (bytes.length !== 16) return err(`a replica id is made from 16 bytes, not ${bytes.length}`);
  let text = "";
  for (const b of bytes) text += b.toString(16).padStart(2, "0");
  return ok(text as ReplicaId);
}

/** The identity of one version of a path: a UUID version 7 as 36 lower case characters. Made only by `parseVersionId` or by the hybrid clock. Ids sort as text in the order they were made. */
export type VersionId = Brand<string, "anyfs version id">;

const VERSION = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** A version identity from text, or why it is not one. */
export function parseVersionId(text: string): Result<VersionId, string> {
  return VERSION.test(text) ? ok(text as VersionId) : err(`${JSON.stringify(text.slice(0, 50))} is not a version id: a UUID of version 7 in lower case`);
}

/** The largest time an id holds: 48 bits of milliseconds. */
export const MAX_ID_MS = 2 ** 48 - 1;
/** The largest counter of an id: 12 bits. */
export const MAX_ID_COUNTER = 0xfff;

/** The time of an id: the milliseconds and the counter that orders ids of one millisecond. */
export type IdTime = { readonly ms: number; readonly counter: number };

/** An id from its time and the replica that makes it: 48 bits of milliseconds, the version 7, 12 bits of counter, the variant and 62 bits taken from the replica id, so that two replicas never make one id. */
export function makeVersionId(time: IdTime, replica: ReplicaId): VersionId {
  const ms = time.ms.toString(16).padStart(12, "0");
  const counter = time.counter.toString(16).padStart(3, "0");
  const low = BigInt(`0x${replica.slice(0, 16)}`) & ((1n << 62n) - 1n);
  const lowHex = (low | (2n << 62n)).toString(16).padStart(16, "0");
  return `${ms.slice(0, 8)}-${ms.slice(8, 12)}-7${counter}-${lowHex.slice(0, 4)}-${lowHex.slice(4, 16)}` as VersionId;
}

/** The time of an id. */
export function timeOfId(id: VersionId): IdTime {
  const hex = id.replaceAll("-", "");
  return { ms: Number.parseInt(hex.slice(0, 12), 16), counter: Number.parseInt(hex.slice(13, 16), 16) };
}

/** The order of two times: the milliseconds and then the counter. */
export function compareTime(a: IdTime, b: IdTime): number {
  return a.ms !== b.ms ? (a.ms < b.ms ? -1 : 1) : a.counter === b.counter ? 0 : a.counter < b.counter ? -1 : 1;
}

/** What a replica has: for each replica, the number of the last row it holds with all the rows before it of that replica (the rows of a replica are numbered from 1 with none missing). Keys are replica ids. */
export type VersionVector = { readonly [replica: string]: number };

/** The kinds of a version: a put holds a blob, a tombstone says the path is not there. */
export const VERSION_KINDS = ["put", "tombstone"] as const;
/** One kind of version. */
export type VersionKind = (typeof VERSION_KINDS)[number];

/**
 * A version row: immutable, and its own checksum. `parent` is the version the writer replaced, `null` for the first of a path; `merged` holds the other versions the writer saw at the head of the path and replaced as
 * well, empty where there were none. `sum` is the SHA-256 of the canonical text of every other field. The primary key of the row is `id` with `sum`, so that the same row from two databases is one row, and a row with
 * the same id and another sum is a finding.
 */
export type Version = {
  readonly id: VersionId;
  readonly replica: ReplicaId;
  readonly seq: number;
  readonly path: string;
  readonly parent: VersionId | null;
  readonly merged: readonly VersionId[];
  readonly kind: VersionKind;
  readonly blob: string | null;
  readonly sum: string;
};

/** The format of a delta on the wire: the only one so far. */
export const DELTA_FORMAT = 1 as const;

/** The bytes of a blob on the wire: base64. */
export type BlobWire = { readonly sha: string; readonly bytes: string };

/**
 * A delta: version rows and the blobs they name that a replica holds, that another takes. It is immutable and its identity is the SHA-256 of its canonical text, so that it can be kept in any store and applied twice
 * with the effect of once. A delta is applied whole or not at all: where a row's parent or a put's blob is neither in the delta nor held, the delta waits. A SQL dump of the rows is a delta in another encoding.
 */
export type Delta = {
  readonly format: typeof DELTA_FORMAT;
  readonly origin: ReplicaId;
  readonly versions: readonly Version[];
  readonly blobs: readonly BlobWire[];
  /** What a signing replica says of the identity of the delta, where it signs. */
  readonly signature?: string;
};

/** What a verifier says of a signature: it holds, it does not hold for the key it names, or no key of that replica is known for it at that time. */
export const SIGNATURE_VERDICTS = ["ok", "bad-signature", "unknown-key"] as const;
/** One verdict of a verifier. */
export type SignatureVerdict = (typeof SIGNATURE_VERDICTS)[number];

/**
 * Whom a replica takes changes from: `open` takes any, `allowlist` only the replicas named (the default, and itself alone by default), `signed` only deltas whose signature a verifier accepts and, where `replicas` is
 * given, only from those replicas as well (a replica must be on the list and its signature must hold). `at` is the time of the newest row of the delta in milliseconds, so that a key has a window in which it speaks for a replica.
 */
export type Trust =
  | { readonly kind: "open" }
  | { readonly kind: "allowlist"; readonly replicas: ReadonlySet<ReplicaId> }
  | {
      readonly kind: "signed";
      readonly replicas?: ReadonlySet<ReplicaId>;
      /** The replicas whose keys the verifier knows: a database that cannot check a signature itself (a raw SQL import) still refuses rows of any other replica. */
      readonly signers?: ReadonlySet<ReplicaId>;
      readonly verify: (id: string, signature: string, origin: ReplicaId, at: number, domain: "anyfs-delta/1" | "anyfs-epoch/1" | "anyfs-dump/1") => SignatureVerdict | Promise<SignatureVerdict>;
    };

/** The trust a replica has until it is told otherwise: itself alone. */
export const defaultTrust = (self: ReplicaId): Trust => ({ kind: "allowlist", replicas: new Set([self]) });

/** The reasons a delta is refused: a closed list. */
export const MERGE_REFUSAL_KINDS = ["trust", "unsigned", "bad-signature", "unknown-key", "future-id", "malformed", "too-large", "bad-sum", "bad-blob", "forged"] as const;
/** One reason a delta is refused. */
export type MergeRefusalKind = (typeof MERGE_REFUSAL_KINDS)[number];

/** A delta that was not applied, and why. */
export type MergeRefusal = { readonly kind: MergeRefusalKind; readonly message: string };

/** What applying a delta ended with: a closed union. `deferred` names the versions and blobs the delta waits for. */
export type MergeOutcome =
  | { readonly kind: "applied"; readonly versions: number; readonly blobs: number; readonly findings: readonly MergeFinding[] }
  | { readonly kind: "duplicate" }
  | { readonly kind: "deferred"; readonly missing: readonly string[] }
  | { readonly kind: "refused"; readonly refusal: MergeRefusal };

/** The kinds of finding of a merge: things a person should know that are not conflicts. */
export const FINDING_KINDS = ["duplicate-id", "duplicate-seq", "bad-sum", "bad-blob", "future-id", "untrusted-replica", "dangling-parent", "missing-blob", "bad-id"] as const;
/** One kind of finding. */
export type MergeFindingKind = (typeof FINDING_KINDS)[number];

/** A finding about a row or a blob: its kind, what it is about and one sentence. */
export type MergeFinding = { readonly kind: MergeFindingKind; readonly subject: string; readonly message: string };

/** One sentence for a refusal. */
export function describeMergeRefusal(refusal: MergeRefusal): string {
  return `refused (${refusal.kind}): ${refusal.message}`;
}

/** How a copy of a database is told from the one it was made from: a text the host makes of what it cannot copy, such as the identity of the file system object. */
export type Fingerprint = Brand<string, "anyfs fingerprint">;

/** A fingerprint from text, or why it is not one. */
export function parseFingerprint(text: string): Result<Fingerprint, string> {
  return text.length >= 1 && text.length <= 256 && /^[!-~]+$/u.test(text) ? ok(text as Fingerprint) : err("a fingerprint is 1 to 256 printable characters with no space");
}
