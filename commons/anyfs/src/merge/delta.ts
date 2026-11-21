// Spec: 0008-anyfs-merge-logical FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * The delta and what is done with it. A delta is read from text by `parseDelta`, which accepts only what the format says and refuses what is too large, and is then judged by `applyDelta`: whom it is from (the trust), when it
 * is from (an id too far ahead is refused), whether each row is its own checksum and each blob the hash of its bytes, and whether this replica holds what the rows replace and the blobs the puts name (until it does, the delta
 * waits). A delta that is judged is added in one step, so that its rows come all together or not at all, and a delta applied twice has the effect of once. A row that has the id of a row held but another sum is not refused: both
 * are kept, and the finding says so.
 *
 * @example
 * ```ts
 * import { deltaId } from "./delta.ts";
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  type BlobWire,
  DELTA_FORMAT,
  type Delta,
  type MergeFinding,
  type MergeOutcome,
  type MergeRefusal,
  type Trust,
  parseReplicaId,
  parseVersionId,
  type ReplicaId,
  timeOfId,
  type Version,
  type VersionId,
  type VersionVector,
  VERSION_KINDS,
  type VersionKind,
} from "@intellectual-frontiers/anyfs/governance";
import { compareText, fromBase64, type Limits, toBase64 } from "./limits.ts";
import { compareVersions, isSha, verifyVersion, versionKey } from "./rows.ts";
import { type MergeState, vectorOf, withBlob, withVersion } from "./state.ts";

type Obj = { readonly [key: string]: unknown };
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

function versionOf(x: unknown): Result<Version, string> {
  if (!isObj(x)) return err("a row is an object");
  const id = typeof x["id"] === "string" ? parseVersionId(x["id"]) : err("a row has an id");
  if (id.kind === "err") return id;
  const replica = typeof x["replica"] === "string" ? parseReplicaId(x["replica"]) : err("a row has a replica");
  if (replica.kind === "err") return replica;
  const parent = x["parent"] === null ? ok(null) : typeof x["parent"] === "string" ? parseVersionId(x["parent"]) : err("the parent of a row is an id or null");
  if (parent.kind === "err") return parent;
  const mergedIn = x["merged"];
  if (!Array.isArray(mergedIn)) return err("the rows merged with are a list");
  const merged: VersionId[] = [];
  for (const m of mergedIn as unknown[]) {
    const p = typeof m === "string" ? parseVersionId(m) : err("a row merged with is an id");
    if (p.kind === "err") return p;
    merged.push(p.value);
  }
  const kind = VERSION_KINDS.find((k): k is VersionKind => k === x["kind"]);
  if (kind === undefined) return err("the kind of a row is put or tombstone");
  const blob = x["blob"];
  if (blob !== null && typeof blob !== "string") return err("the blob of a row is a digest or null");
  const seq = x["seq"];
  if (typeof seq !== "number" || typeof x["path"] !== "string" || typeof x["sum"] !== "string") return err("a row has a number, a path and a sum");
  return ok({ id: id.value, replica: replica.value, seq, path: x["path"], parent: parent.value, merged, kind, blob, sum: x["sum"] });
}

/** A delta from what was read of its text, or why it is not one: the shape of the format and nothing else, within the limits. */
export function parseDelta(x: unknown, limits: Limits): Result<Delta, string> {
  if (!isObj(x)) return err("a delta is an object");
  if (x["format"] !== DELTA_FORMAT) return err(`a delta of format ${JSON.stringify(x["format"])}: only format ${DELTA_FORMAT} is read`);
  const origin = typeof x["origin"] === "string" ? parseReplicaId(x["origin"]) : err("a delta names its origin");
  if (origin.kind === "err") return origin;
  const rows = x["versions"];
  const blobsIn = x["blobs"];
  if (!Array.isArray(rows) || !Array.isArray(blobsIn)) return err("a delta holds rows and blobs");
  if (rows.length > limits.maxVersions) return err(`a delta of ${rows.length} rows: at most ${limits.maxVersions}`);
  const versions: Version[] = [];
  for (const r of rows as unknown[]) {
    const v = versionOf(r);
    if (v.kind === "err") return v;
    versions.push(v.value);
  }
  const blobs: BlobWire[] = [];
  for (const b of blobsIn as unknown[]) {
    if (!isObj(b) || typeof b["sha"] !== "string" || typeof b["bytes"] !== "string" || !isSha(b["sha"])) return err("a blob is a digest and base64 bytes");
    blobs.push({ sha: b["sha"], bytes: b["bytes"] });
  }
  const signature = x["signature"];
  if (signature !== undefined && typeof signature !== "string") return err("a signature is text");
  return ok({ format: DELTA_FORMAT, origin: origin.value, versions, blobs, ...(signature === undefined ? {} : { signature }) });
}

const sorted = (_k: string, v: unknown): unknown => (v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => compareText(a, b))) : v);

/** The text of a delta with its rows and blobs in order, no space and the signature left out: what its identity is made of. */
export function deltaText(delta: Delta): string {
  const { signature: _signature, ...rest } = delta;
  return JSON.stringify({ ...rest, versions: [...rest.versions].sort(compareVersions), blobs: [...rest.blobs].sort((a, b) => compareText(a.sha, b.sha)) }, sorted);
}

/** The text of a delta as it is kept in a store: the same text, and the signature where it has one. */
export function encodeDelta(delta: Delta): string {
  return JSON.stringify({ ...JSON.parse(deltaText(delta)), ...(delta.signature === undefined ? {} : { signature: delta.signature }) } as unknown, sorted);
}

/** A delta from its text, or why it is not one. */
export function decodeDelta(text: string, limits: Limits): Result<Delta, string> {
  if (text.length > limits.maxDeltaChars) return err(`a delta of ${text.length} characters: at most ${limits.maxDeltaChars}`);
  try {
    return parseDelta(JSON.parse(text) as unknown, limits);
  } catch {
    return err("a delta is JSON");
  }
}

/** The identity of a delta: the SHA-256 of its text without its signature. */
export async function deltaId(delta: Delta): Promise<string> {
  return sha256(deltaText(delta));
}

/** The delta of what a replica holds that a replica holding `since` does not: the rows whose number is past what `since` holds of their replica, and the blobs their puts name. */
export function deltaSince(state: MergeState, since: VersionVector): Delta {
  const versions = [...state.versions.values()].filter((v) => v.seq > (since[v.replica] ?? 0)).sort(compareVersions);
  const shas = [...new Set(versions.flatMap((v) => (v.blob === null ? [] : [v.blob])))].sort(compareText);
  const blobs = shas.flatMap((sha) => {
    const b = state.blobs.get(sha);
    return b === undefined ? [] : [{ sha, bytes: toBase64(b) }];
  });
  return { format: DELTA_FORMAT, origin: state.replica, versions, blobs };
}

const refuse = (kind: MergeRefusal["kind"], message: string): MergeOutcome => ({ kind: "refused", refusal: { kind, message } });

function findingsOf(state: MergeState, added: readonly Version[]): readonly MergeFinding[] {
  const out: MergeFinding[] = [];
  const byId = new Map<string, Version[]>();
  const bySeq = new Map<string, Version[]>();
  for (const v of state.versions.values()) {
    byId.set(v.id, [...(byId.get(v.id) ?? []), v]);
    bySeq.set(`${v.replica}#${v.seq}`, [...(bySeq.get(`${v.replica}#${v.seq}`) ?? []), v]);
  }
  for (const v of added) {
    if ((byId.get(v.id) ?? []).length > 1) out.push({ kind: "duplicate-id", subject: v.id, message: `the id ${v.id} is on more than one row, with different sums` });
    if ((bySeq.get(`${v.replica}#${v.seq}`) ?? []).length > 1) out.push({ kind: "duplicate-seq", subject: `${v.replica}#${v.seq}`, message: `replica ${v.replica} made number ${v.seq} twice, with different rows` });
  }
  return out;
}

/**
 * What a trust says of a delta before anything else is looked at: the replicas it names must be ones that are taken from, and under signed trust the delta must be signed by a key of its origin that was valid when its newest
 * row was made. `undefined` where the trust takes the delta. A bridge holds a trust of its own and asks the same question, so that what a medium offers is judged by the owner of the command as well as by the replica.
 */
export async function trustRefusal(trust: Trust, delta: Delta): Promise<MergeRefusal | undefined> {
  const replicas = new Set<ReplicaId>([delta.origin, ...delta.versions.map((v) => v.replica)]);
  switch (trust.kind) {
    case "open":
      return undefined;
    case "allowlist":
      for (const r of replicas) if (!trust.replicas.has(r)) return { kind: "trust", message: `replica ${r} is not one this replica takes changes from` };
      return undefined;
    case "signed": {
      const who = trust.replicas;
      if (who !== undefined) for (const r of replicas) if (!who.has(r)) return { kind: "trust", message: `replica ${r} is not one this replica takes changes from` };
      const id = await deltaId(delta);
      if (delta.signature === undefined) return { kind: "unsigned", message: `the delta ${id.slice(0, 12)} is not signed, and this replica takes signed deltas only` };
      const at = delta.versions.reduce((m, v) => Math.max(m, timeOfId(v.id).ms), 0);
      const verdict = await trust.verify(id, delta.signature, delta.origin, at, "anyfs-delta/1");
      if (verdict === "bad-signature") return { kind: "bad-signature", message: `the signature of the delta ${id.slice(0, 12)} does not hold` };
      if (verdict === "unknown-key") return { kind: "unknown-key", message: `no key of replica ${delta.origin} that this replica knows made the signature of the delta ${id.slice(0, 12)}` };
      return undefined;
    }
  }
}

type Step = { readonly state: MergeState; readonly outcome: MergeOutcome };

async function judge(state: MergeState, delta: Delta, wall: number): Promise<Step> {
  const { config } = state;
  const keep = (outcome: MergeOutcome): Step => ({ state, outcome });
  if (delta.versions.length > config.limits.maxVersions) return keep(refuse("too-large", `a delta of ${delta.versions.length} rows: at most ${config.limits.maxVersions}`));
  const untrusted = await trustRefusal(config.trust, delta);
  if (untrusted !== undefined) return keep({ kind: "refused", refusal: untrusted });
  const blobs = new Map<string, Uint8Array>();
  for (const b of delta.blobs) {
    const bytes = fromBase64(b.bytes);
    if (bytes === undefined) return keep(refuse("malformed", `the bytes of blob ${b.sha.slice(0, 12)} are not base64`));
    if (bytes.length > config.limits.maxBlobBytes) return keep(refuse("too-large", `a blob of ${bytes.length} bytes: at most ${config.limits.maxBlobBytes}`));
    if ((await sha256(bytes)) !== b.sha) return keep(refuse("bad-blob", `the bytes of blob ${b.sha.slice(0, 12)} are not the bytes it is named by`));
    blobs.set(b.sha, bytes);
  }
  for (const v of delta.versions) {
    const why = await verifyVersion(v);
    if (why !== undefined) return keep(refuse(why.includes("sum") ? "bad-sum" : "malformed", why));
    if (v.path.length > config.limits.maxPathChars) return keep(refuse("too-large", `a path of ${v.path.length} characters: at most ${config.limits.maxPathChars}`));
    if (timeOfId(v.id).ms > wall + config.maxDrift) return keep(refuse("future-id", `the id ${v.id} is more than ${config.maxDrift} ms ahead of the wall time ${wall}`));
  }
  if (delta.versions.every((v) => state.versions.has(versionKey(v))) && delta.blobs.every((b) => state.blobs.has(b.sha))) return keep({ kind: "duplicate" });
  const ids = new Set<string>([...[...state.versions.values()].map((v) => v.id), ...delta.versions.map((v) => v.id)]);
  const missing = new Set<string>();
  for (const v of delta.versions) {
    for (const p of [...(v.parent === null ? [] : [v.parent]), ...v.merged]) if (!ids.has(p)) missing.add(`version ${p}`);
    if (v.blob !== null && !state.blobs.has(v.blob) && !blobs.has(v.blob)) missing.add(`blob ${v.blob}`);
  }
  if (missing.size > 0) return keep({ kind: "deferred", missing: [...missing].sort(compareText) });
  let next = state;
  let newBlobs = 0;
  for (const [sha, bytes] of blobs) {
    if (!next.blobs.has(sha)) newBlobs++;
    next = withBlob(next, sha, bytes);
  }
  const added: Version[] = [];
  for (const v of delta.versions) {
    if (!next.versions.has(versionKey(v))) added.push(v);
    next = withVersion(next, v);
  }
  return { state: next, outcome: { kind: "applied", versions: added.length, blobs: newBlobs, findings: findingsOf(next, added) } };
}

/** What taking a delta made of a replica, and what it ended with. */
export type Applied = Step;

/**
 * Takes a delta into a replica. Where the delta is applied the deltas the replica held back are tried again, for what this one brought may be what they waited for. Where it is not applied the state is the state the
 * replica had, except that a delta that has to wait is kept.
 */
export async function applyDelta(state: MergeState, delta: Delta, wall: number): Promise<Applied> {
  const first = await judge(state, delta, wall);
  if (first.outcome.kind === "deferred") {
    const id = await deltaId(delta);
    const held = await Promise.all(state.pending.map(deltaId));
    return held.includes(id) ? first : { state: { ...state, pending: [...state.pending, delta] }, outcome: first.outcome };
  }
  if (first.outcome.kind !== "applied") return first;
  let current = first.state;
  let versions = first.outcome.versions;
  let blobs = first.outcome.blobs;
  let findings = [...first.outcome.findings];
  for (let progress = true; progress && current.pending.length > 0; ) {
    progress = false;
    for (const held of current.pending) {
      const rest = { ...current, pending: current.pending.filter((p) => p !== held) };
      const again = await judge(rest, held, wall);
      if (again.outcome.kind === "applied") {
        current = again.state;
        versions += again.outcome.versions;
        blobs += again.outcome.blobs;
        findings = [...findings, ...again.outcome.findings];
        progress = true;
        break;
      }
      if (again.outcome.kind !== "deferred") current = rest;
    }
  }
  return { state: current, outcome: { kind: "applied", versions, blobs, findings } };
}

/**
 * What is wrong with the rows and blobs a replica holds, whatever way they came: a row that is not its checksum, an id that is not an id, a row from a replica the trust does not name, an id from the far future, an id
 * on two rows, a number twice, a parent or a blob that is not there, bytes that are not the hash they are named by. This is the check of a replica whose rows were put there by a SQL import, which no trust check of
 * ours stood in front of.
 */
export async function verifyState(state: MergeState, wall: number): Promise<readonly MergeFinding[]> {
  const out: MergeFinding[] = [];
  const ids = new Set([...state.versions.values()].map((v) => v.id));
  for (const v of [...state.versions.values()].sort(compareVersions)) {
    const why = await verifyVersion(v);
    if (why !== undefined) out.push({ kind: why.includes("sum") ? "bad-sum" : "bad-id", subject: v.id, message: why });
    const trust = state.config.trust;
    if (trust.kind === "allowlist" && !trust.replicas.has(v.replica)) out.push({ kind: "untrusted-replica", subject: v.id, message: `the row ${v.id} is from replica ${v.replica}, which this replica does not take changes from` });
    if (timeOfId(v.id).ms > wall + state.config.maxDrift) out.push({ kind: "future-id", subject: v.id, message: `the id ${v.id} is more than ${state.config.maxDrift} ms ahead of the wall time ${wall}` });
    for (const p of [...(v.parent === null ? [] : [v.parent]), ...v.merged]) if (!ids.has(p)) out.push({ kind: "dangling-parent", subject: v.id, message: `the row ${v.id} replaces ${p}, which is not held` });
    if (v.blob !== null && !state.blobs.has(v.blob)) out.push({ kind: "missing-blob", subject: v.id, message: `the row ${v.id} names the blob ${v.blob}, which is not held` });
  }
  out.push(...findingsOf(state, [...state.versions.values()]));
  for (const [sha, bytes] of state.blobs) if ((await sha256(bytes)) !== sha) out.push({ kind: "bad-blob", subject: sha, message: `the bytes of blob ${sha.slice(0, 12)} are not the bytes it is named by` });
  return out;
}

/** The version vector a replica reports. */
export const reportOf = vectorOf;
