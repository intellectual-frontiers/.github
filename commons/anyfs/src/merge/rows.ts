// Spec: 0007-anyfs-merge-governance FR-007, FR-008
/**
 * The version row as text and as checksum. The canonical text of a row is its fields in a fixed order; its `sum` is the SHA-256 of that text, so a row whose sum is not the hash of its fields has been changed. A row is
 * made by `makeVersion`, which sorts and checks what a row must hold, and read back by `verifyVersion`.
 *
 * @example
 * ```ts
 * import { versionKey } from "./rows.ts";
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { parseReplicaId, parseVersionId, type ReplicaId, type Version, type VersionId, type VersionKind } from "@intellectual-frontiers/anyfs/governance";
import { compareText } from "./limits.ts";

/** What a row is made from: everything but its sum. */
export type VersionFields = {
  readonly id: VersionId;
  readonly replica: ReplicaId;
  readonly seq: number;
  readonly path: string;
  readonly parent: VersionId | null;
  readonly merged: readonly VersionId[];
  readonly kind: VersionKind;
  readonly blob: string | null;
};

/** The canonical text of a row's fields: a list in a fixed order. */
export function fieldsText(f: VersionFields): string {
  return JSON.stringify([f.id, f.replica, f.seq, f.path, f.parent, f.merged, f.kind, f.blob]);
}

/** The SHA-256 of a row's fields. */
export async function sumOf(f: VersionFields): Promise<string> {
  return sha256(fieldsText(f));
}

/** The digest a blob is named by: the SHA-256 of its bytes. */
export async function blobSha(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}

const SHA = /^[0-9a-f]{64}$/u;

/** Whether a text is the digest of a blob. */
export const isSha = (text: string): boolean => SHA.test(text);

/** A row from its fields, or why the fields are not a row: a put names a blob and a tombstone does not, the rows merged with are sorted and each once, and the parent is not among them. */
export async function makeVersion(f: VersionFields): Promise<Result<Version, string>> {
  const bad = fieldsProblem(f);
  if (bad !== undefined) return err(bad);
  return ok({ ...f, sum: await sumOf(f) });
}

function fieldsProblem(f: VersionFields): string | undefined {
  if (!Number.isSafeInteger(f.seq) || f.seq < 1) return "the number of a row is a whole number from 1";
  if (f.path.length === 0) return "a row has a path";
  if (f.kind === "put" && (f.blob === null || !SHA.test(f.blob))) return "a put names its blob by the SHA-256 of its bytes";
  if (f.kind === "tombstone" && f.blob !== null) return "a tombstone has no blob";
  for (let i = 0; i < f.merged.length; i++) {
    const m = f.merged[i] as VersionId;
    if (i > 0 && compareText(f.merged[i - 1] as VersionId, m) >= 0) return "the rows merged with are in order and each once";
    if (m === f.parent) return "a row does not merge with its parent";
  }
  return undefined;
}

/** Whether a row is what its sum says: the fields are a row, and the sum is their hash. Why not, as a sentence. */
export async function verifyVersion(v: Version): Promise<string | undefined> {
  if (parseVersionId(v.id).kind === "err") return `${JSON.stringify(String(v.id).slice(0, 50))} is not a version id`;
  if (parseReplicaId(v.replica).kind === "err") return "the replica of a row is not a replica id";
  const bad = fieldsProblem(v);
  if (bad !== undefined) return bad;
  return (await sumOf(v)) === v.sum ? undefined : `the sum of row ${v.id} is not the hash of its fields`;
}

/** The key of a row: its id and its sum, which is its primary key. */
export const versionKey = (v: Pick<Version, "id" | "sum">): string => `${v.id}|${v.sum}`;

/** The order of two rows: by id and then by sum. The winner among the heads of a path is the greatest. */
export function compareVersions(a: Version, b: Version): number {
  return compareText(a.id, b.id) || compareText(a.sum, b.sum);
}
