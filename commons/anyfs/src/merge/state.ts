// Spec: 0008-anyfs-merge-logical FR-001, FR-002, FR-008, FR-009
/**
 * The state of a replica: a set of version rows and a set of blobs, and nothing derived is part of it. What a path holds is a view of the rows: the heads of a path are its versions that no other version replaced, the
 * winner is the head with the greatest id, and the other heads are its siblings; a winner that is a tombstone means the path is not there. The union of two states is their rows and blobs together, which is the same in any
 * order, however grouped and however often, and the view is a function of the rows alone, so replicas that hold the same rows hold the same files.
 *
 * @example
 * ```ts
 * import { newState } from "./state.ts";
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  defaultTrust,
  DELTA_FORMAT,
  type Delta,
  type IdTime,
  makeVersionId,
  randomCounterSeed,
  type ReplicaId,
  timeOfId,
  type Trust,
  type Version,
  type VersionId,
  type VersionVector,
} from "@intellectual-frontiers/anyfs/governance";
import { DEFAULT_MAX_DRIFT, nextTime, seeTime } from "./id.ts";
import { compareText, DEFAULT_LIMITS, type Limits, toBase64 } from "./limits.ts";
import { compareVersions, makeVersion, versionKey } from "./rows.ts";

/** What a replica is told that is not data: how far ahead of its wall time it takes an id, its limits and whom it takes changes from. */
export type MergeConfig = { readonly maxDrift: number; readonly limits: Limits; readonly trust: Trust };

/** A configuration of a replica that takes changes from itself alone, with the default limits and drift. */
export function defaultConfig(replica: ReplicaId): MergeConfig {
  return { maxDrift: DEFAULT_MAX_DRIFT, limits: DEFAULT_LIMITS, trust: defaultTrust(replica) };
}

/** A replica: its rows and blobs, who it is, the last id time it made or took, and the deltas it holds back until what they wait for arrives. */
export type MergeState = {
  readonly replica: ReplicaId;
  readonly config: MergeConfig;
  /** The rows, by `id|sum`: the primary key of the row. */
  readonly versions: ReadonlyMap<string, Version>;
  /** The blobs, by the SHA-256 of their bytes. */
  readonly blobs: ReadonlyMap<string, Uint8Array>;
  readonly last: IdTime | undefined;
  readonly pending: readonly Delta[];
  /** The rows of each path: an index of the rows, made again from them. */
  readonly byPath: ReadonlyMap<string, readonly Version[]>;
  /** The ids some row replaced: what makes a version no longer a head. */
  readonly replaced: ReadonlySet<VersionId>;
  /** The numbers held of each replica's rows. */
  readonly seqs: ReadonlyMap<string, ReadonlySet<number>>;
  /** The highest number of the rows of this replica. */
  readonly ownSeq: number;
};

/** A replica that holds nothing. */
export function newState(replica: ReplicaId, config: MergeConfig = defaultConfig(replica)): MergeState {
  return { replica, config, versions: new Map(), blobs: new Map(), last: undefined, pending: [], byPath: new Map(), replaced: new Set(), seqs: new Map(), ownSeq: 0 };
}

/** The state with a row added (the same row twice is one row) and the index and the clock kept in step with it. */
export function withVersion(state: MergeState, v: Version): MergeState {
  const key = versionKey(v);
  if (state.versions.has(key)) return state;
  const versions = new Map(state.versions);
  versions.set(key, v);
  const byPath = new Map(state.byPath);
  byPath.set(v.path, [...(byPath.get(v.path) ?? []), v]);
  const replaced = new Set(state.replaced);
  if (v.parent !== null) replaced.add(v.parent);
  for (const m of v.merged) replaced.add(m);
  const seqs = new Map(state.seqs);
  seqs.set(v.replica, new Set([...(seqs.get(v.replica) ?? []), v.seq]));
  return {
    ...state,
    versions,
    byPath,
    replaced,
    seqs,
    last: seeTime(state.last, timeOfId(v.id)),
    ownSeq: v.replica === state.replica ? Math.max(state.ownSeq, v.seq) : state.ownSeq,
  };
}

/** The state with a blob added. */
export function withBlob(state: MergeState, sha: string, bytes: Uint8Array): MergeState {
  if (state.blobs.has(sha)) return state;
  const blobs = new Map(state.blobs);
  blobs.set(sha, bytes);
  return { ...state, blobs };
}

/** The heads of a path: its versions that no other version replaced, the greatest first. */
export function headsOf(state: MergeState, path: string): readonly Version[] {
  return (state.byPath.get(path) ?? []).filter((v) => !state.replaced.has(v.id)).sort((a, b) => compareVersions(b, a));
}

/** What a path holds now: the winner (the greatest head), whether it is there, and the siblings (the other heads). */
export type PathView = { readonly path: string; readonly winner: Version | undefined; readonly present: boolean; readonly siblings: readonly Version[] };

/** The view of a path: a function of the rows alone. */
export function viewOf(state: MergeState, path: string): PathView {
  const heads = headsOf(state, path);
  const winner = heads[0];
  return { path, winner, present: winner !== undefined && winner.kind === "put", siblings: heads.slice(1) };
}

/** The paths that are there, in the order of their texts. */
export function presentPaths(state: MergeState): readonly string[] {
  return [...state.byPath.keys()].sort(compareText).filter((p) => viewOf(state, p).present);
}

/** What a replica holds: for each replica, the number of its last row held with none missing before it. */
export function vectorOf(state: MergeState): VersionVector {
  const out: Record<string, number> = {};
  for (const [replica, seqs] of state.seqs) {
    let n = 0;
    while (seqs.has(n + 1)) n++;
    if (n > 0) out[replica] = n;
  }
  return out;
}

/** The state as one text: its rows and its blobs, each in order. Two replicas hold the same state exactly where their texts are equal. */
export function stateText(state: MergeState): string {
  const rows = [...state.versions.values()].sort(compareVersions).map((v) => `${versionKey(v)}`);
  const blobs = [...state.blobs.keys()].sort(compareText);
  return `${rows.join("\n")}\n--\n${blobs.join("\n")}`;
}

/** The files as one text: for each path, the winner, whether it is there and its siblings. A function of the rows, so equal states have equal views. */
export function viewText(state: MergeState): string {
  return [...state.byPath.keys()]
    .sort(compareText)
    .map((p) => {
      const v = viewOf(state, p);
      return `${JSON.stringify(p)} ${v.winner === undefined ? "-" : `${v.winner.id}:${v.winner.kind}:${v.winner.blob ?? ""}`} [${v.siblings.map((s) => s.id).join(",")}]`;
    })
    .join("\n");
}

/** A change of a replica: put a path with a blob, or remove it. */
export type PathOp = { readonly kind: "put"; readonly path: string; readonly blob: string } | { readonly kind: "remove"; readonly path: string };

/** What a transaction made: the state after it and the delta that carries it, none where it changed nothing. */
export type Made = { readonly state: MergeState; readonly delta: Delta | undefined };

/** The changes of one transaction made to a replica, as one delta: every change is a new row with its own id, after the last, that replaces the heads of its path that the replica sees. The bytes of the blobs named are given. */
export async function transact(state: MergeState, ops: readonly PathOp[], blobs: ReadonlyMap<string, Uint8Array>, wall: number): Promise<Result<Made, string>> {
  let next = state;
  const made: Version[] = [];
  const used = new Set<string>();
  for (const op of ops) {
    if (op.path.length === 0 || op.path.length > state.config.limits.maxPathChars) return err(`a path is 1 to ${state.config.limits.maxPathChars} characters`);
    const heads = headsOf(next, op.path);
    const winner = heads[0];
    if (op.kind === "remove" && (winner === undefined || winner.kind === "tombstone")) continue;
    if (op.kind === "put") {
      const bytes = blobs.get(op.blob);
      if (bytes === undefined && !next.blobs.has(op.blob)) return err(`the blob ${op.blob.slice(0, 12)} of a put is not given`);
      if (bytes !== undefined) {
        if (bytes.length > state.config.limits.maxBlobBytes) return err(`a blob of ${bytes.length} bytes: at most ${state.config.limits.maxBlobBytes}`);
        next = withBlob(next, op.blob, bytes);
      }
      used.add(op.blob);
    }
    const time = nextTime(next.last, wall, randomCounterSeed());
    const v = await makeVersion({
      id: makeVersionId(time),
      replica: state.replica,
      seq: next.ownSeq + 1,
      path: op.path,
      parent: winner === undefined ? null : winner.id,
      merged: heads.slice(1).map((h) => h.id).sort(compareText),
      kind: op.kind === "put" ? "put" : "tombstone",
      blob: op.kind === "put" ? op.blob : null,
    });
    if (v.kind === "err") return v;
    made.push(v.value);
    next = withVersion(next, v.value);
  }
  if (made.length === 0) return ok({ state: next, delta: undefined });
  const wires = [...used].sort(compareText).map((sha) => ({ sha, bytes: toBase64((next.blobs.get(sha) as Uint8Array)) }));
  const delta: Delta = { format: DELTA_FORMAT, origin: state.replica, versions: made, blobs: wires };
  return ok({ state: next, delta });
}
