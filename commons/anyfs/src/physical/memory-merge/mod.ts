// Spec: 0009-anyfs-merge-physical FR-008, FR-009, FR-010
/**
 * The store in memory that merges: a replica whose files are the view of a set of immutable version rows, so that it keeps every capability of the store in memory and one more, `merge`. A write is a new row that replaces
 * the heads of its path, a delete is a tombstone, the winner among the heads is the file and the other heads are its siblings. Its revision is `sha256:` and the digest of the bytes, as everywhere. It is the reference
 * every backend that merges is held to, and the model whose laws a SQL dump of such a database relies on.
 *
 * @example
 * ```ts
 * import { memoryMergeStore } from "./mod.ts";
 * const a = memoryMergeStore({ name: "a" });
 * a.store.id; // "merge-memory:a"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  type Change,
  type ChangeResult,
  type Handler,
  type Listing,
  makeStore,
  type Op,
  type Stat,
  type Store,
  type Versions,
} from "@intellectual-frontiers/anyfs/logical";
import {
  comparePaths,
  conflict,
  type Cursor,
  type Expect,
  isUnder,
  type MergeFinding,
  missing,
  parseCursor,
  parseRevision,
  type Path,
  type Place,
  type Problem,
  refused,
  type ReplicaId,
  type Revision,
  replicaIdOfBytes,
  timeOfId,
  type Trust,
  unavailable,
  type Version,
} from "@intellectual-frontiers/anyfs/governance";
import {
  applyDelta,
  deltaSince,
  defaultConfig,
  type Limits,
  type MergeState,
  newState,
  presentPaths,
  type PathOp,
  stateText,
  transact,
  vectorOf,
  verifyState,
  viewOf,
  viewText,
  withVersion,
  DEFAULT_MAX_DRIFT,
} from "@intellectual-frontiers/anyfs/merge";

/** The capabilities of the store in memory that merges. */
export const MERGE_STORE_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history", "merge"] as const;
/** The type of the store in memory that merges. */
export type MergeStore = Store<(typeof MERGE_STORE_CAPABILITIES)[number]>;

/** What the store is made with: its name, its replica identity, the clock in milliseconds, whom it takes changes from, how far ahead it takes an id and its limits. */
export type MemoryMergeOptions = {
  readonly name?: string;
  readonly replica?: ReplicaId;
  readonly clock?: () => number;
  readonly trust?: Trust;
  readonly maxDrift?: number;
  readonly limits?: Limits;
};

/** A sibling: a head of a path that is not the winner. */
export type Sibling = { readonly id: string; readonly kind: "put" | "tombstone"; readonly rev: Revision | undefined; readonly replica: ReplicaId };

/** A replica: the store, and what a test or a program reads of it that the store's interface does not give. */
export type MergeReplica = {
  readonly store: MergeStore;
  readonly replica: ReplicaId;
  /** The state as it is now: rows and blobs. */
  state(): MergeState;
  /** The heads of a path that are not the winner. */
  siblings(path: Path): readonly Sibling[];
  /** The rows and blobs as one text, and the files as one text. */
  stateText(): string;
  viewText(): string;
  /** What is wrong with the rows held, whatever way they came. */
  verify(): Promise<readonly MergeFinding[]>;
  /** How many deltas the replica holds back. */
  pending(): number;
  /** Rows put in as a SQL import puts them: with no check of ours. */
  importRows(versions: readonly Version[], blobs: ReadonlyMap<string, Uint8Array>): void;
};

const PAGE = 1000;
const MAX_PAGE = 10000;

function randomReplica(): ReplicaId {
  const r = replicaIdOfBytes(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

const revOf = (sha: string): Revision => {
  const r = parseRevision(`sha256:${sha}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** A store in memory that merges. */
export function memoryMergeStore(options: MemoryMergeOptions = {}): MergeReplica {
  const name = options.name ?? "memory";
  const clock = options.clock ?? ((): number => Date.now());
  const replica = options.replica ?? randomReplica();
  const base = defaultConfig(replica);
  let state: MergeState = newState(replica, {
    maxDrift: options.maxDrift ?? DEFAULT_MAX_DRIFT,
    limits: options.limits ?? base.limits,
    trust: options.trust ?? base.trust,
  });
  const place: Place = { kind: "memory", name };
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(f: () => Promise<T>): Promise<T> => {
    const r = chain.then(f);
    chain = r.then(
      () => undefined,
      () => undefined,
    );
    return r;
  };

  type Head = { readonly version: Version; readonly sha: string; readonly bytes: Uint8Array };
  const headOf = (s: MergeState, path: Path): Head | undefined => {
    const v = viewOf(s, path);
    if (!v.present || v.winner === undefined || v.winner.blob === null) return undefined;
    const bytes = s.blobs.get(v.winner.blob);
    return bytes === undefined ? undefined : { version: v.winner, sha: v.winner.blob, bytes };
  };
  const instantOf = (v: Version): string => new Date(timeOfId(v.id).ms).toISOString();
  const statOf = (path: Path, h: Head): Stat => ({ path, size: h.bytes.length, rev: revOf(h.sha), modified: instantOf(h.version) });

  const check = (path: Path, expect: Expect, had: Head | undefined): Problem | undefined => {
    switch (expect.kind) {
      case "any":
        return undefined;
      case "absent":
        return had === undefined ? undefined : conflict(path, expect, { kind: "rev", rev: revOf(had.sha) });
      case "rev":
        if (had === undefined) return conflict(path, expect, { kind: "absent" });
        return revOf(had.sha) === expect.rev ? undefined : conflict(path, expect, { kind: "rev", rev: revOf(had.sha) });
      default:
        return unavailable("an expectation of no known kind", false);
    }
  };

  const apply = async (from: MergeState, ops: readonly PathOp[], blobs: ReadonlyMap<string, Uint8Array>): Promise<Result<MergeState, Problem>> => {
    const made = await transact(from, ops, blobs, clock());
    return made.kind === "err" ? err(refused("too-large", made.error)) : ok(made.value.state);
  };

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const h = headOf(state, op.path);
        return h === undefined ? err(missing(op.path)) : ok({ op: "read", value: { bytes: h.bytes.slice(), rev: revOf(h.sha), modified: instantOf(h.version) } });
      }
      case "stat": {
        const h = headOf(state, op.path);
        return h === undefined ? err(missing(op.path)) : ok({ op: "stat", value: statOf(op.path, h) });
      }
      case "write":
        return exclusive(async () => {
          const sha = await sha256(op.bytes);
          const had = headOf(state, op.path);
          const bad = check(op.path, op.expect, had);
          if (bad !== undefined) return err(bad);
          if (had !== undefined && had.sha === sha) return ok({ op: "write", value: { rev: revOf(sha), created: false } });
          const next = await apply(state, [{ kind: "put", path: op.path, blob: sha }], new Map([[sha, op.bytes.slice()]]));
          if (next.kind === "err") return next;
          state = next.value;
          return ok({ op: "write", value: { rev: revOf(sha), created: had === undefined } });
        });
      case "delete":
        return exclusive(async () => {
          const had = headOf(state, op.path);
          const bad = check(op.path, op.expect, had);
          if (bad !== undefined) return err(bad);
          if (had === undefined) return ok({ op: "delete", value: { existed: false } });
          const next = await apply(state, [{ kind: "remove", path: op.path }], new Map());
          if (next.kind === "err") return next;
          state = next.value;
          return ok({ op: "delete", value: { existed: true } });
        });
      case "list": {
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
        const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
        const paths = (presentPaths(state) as readonly Path[]).filter((p) => isUnder(op.prefix, p) && (after === undefined || comparePaths(p, after) > 0)).sort(comparePaths);
        const page = paths.slice(0, limit);
        const entries = page.flatMap((p) => {
          const h = headOf(state, p);
          return h === undefined ? [] : [statOf(p, h)];
        });
        const last = page[page.length - 1];
        let next: Cursor | undefined;
        if (paths.length > limit && last !== undefined) {
          const c = parseCursor(encodeURIComponent(last));
          if (c.kind === "err") return err(unavailable(c.error, false));
          next = c.value;
        }
        const value: Listing = next === undefined ? { entries } : { entries, next };
        return ok({ op: "list", value });
      }
      case "batch":
        return exclusive(async () => {
          let work = state;
          const results: ChangeResult[] = [];
          const applyChange = async (change: Change): Promise<Result<ChangeResult, Problem>> => {
            const had = headOf(work, change.path);
            const bad = check(change.path, change.expect, had);
            if (bad !== undefined) return err(bad);
            if (change.kind === "put") {
              const sha = await sha256(change.bytes);
              if (had !== undefined && had.sha === sha) return ok({ kind: "put", path: change.path, rev: revOf(sha), created: false });
              const next = await apply(work, [{ kind: "put", path: change.path, blob: sha }], new Map([[sha, change.bytes.slice()]]));
              if (next.kind === "err") return next;
              work = next.value;
              return ok({ kind: "put", path: change.path, rev: revOf(sha), created: had === undefined });
            }
            if (had === undefined) return ok({ kind: "delete", path: change.path, existed: false });
            const next = await apply(work, [{ kind: "remove", path: change.path }], new Map());
            if (next.kind === "err") return next;
            work = next.value;
            return ok({ kind: "delete", path: change.path, existed: true });
          };
          for (const change of op.changes) {
            const r = await applyChange(change);
            if (r.kind === "err") return r;
            results.push(r.value);
          }
          state = work;
          return ok({ op: "batch", value: { results } });
        });
      case "rename":
        return exclusive(async () => {
          const had = headOf(state, op.from);
          if (had === undefined) return err(missing(op.from));
          const bad = check(op.from, op.expect, had);
          if (bad !== undefined) return err(bad);
          const there = headOf(state, op.to);
          if (there !== undefined) return err(conflict(op.to, { kind: "absent" }, { kind: "rev", rev: revOf(there.sha) }));
          if (op.from === op.to) return err(refused("outside-scope", "a rename to the same path moves nothing", op.from));
          const next = await apply(state, [{ kind: "put", path: op.to, blob: had.sha }, { kind: "remove", path: op.from }], new Map());
          if (next.kind === "err") return next;
          state = next.value;
          return ok({ op: "rename", value: { rev: revOf(had.sha), created: true } });
        });
      case "history": {
        if (headOf(state, op.path) === undefined) return err(missing(op.path));
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
        const puts = (state.byPath.get(op.path) ?? []).filter((v) => v.kind === "put" && v.blob !== null).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
        const value: Versions = {
          versions: puts.slice(0, limit).map((v) => ({ rev: revOf(v.blob as string), size: state.blobs.get(v.blob as string)?.length ?? 0, modified: instantOf(v) })),
        };
        return ok({ op: "history", value });
      }
      case "merge":
        return exclusive(async () => {
          switch (op.action.kind) {
            case "vector":
              return ok({ op: "merge", value: { kind: "vector", vector: vectorOf(state) } });
            case "since":
              return ok({ op: "merge", value: { kind: "delta", delta: deltaSince(state, op.action.since) } });
            case "apply": {
              const done = await applyDelta(state, op.action.delta, clock());
              state = done.state;
              return ok({ op: "merge", value: { kind: "outcome", outcome: done.outcome } });
            }
            default:
              return err(unavailable("a merge of no known kind", false));
          }
        });
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `the store in memory that merges does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  const store = makeStore({ id: `merge-memory:${name}`, place, consistency: "eventual-merge", traits: { caseSensitive: true }, capabilities: MERGE_STORE_CAPABILITIES, handle });
  return {
    store,
    replica,
    state: () => state,
    siblings: (path) =>
      viewOf(state, path).siblings.map((v) => ({ id: v.id, kind: v.kind, rev: v.blob === null ? undefined : revOf(v.blob), replica: v.replica })),
    stateText: () => stateText(state),
    viewText: () => viewText(state),
    verify: () => verifyState(state, clock()),
    pending: () => state.pending.length,
    importRows: (versions, blobs) => {
      let s = state;
      for (const [sha, bytes] of blobs) s = { ...s, blobs: new Map(s.blobs).set(sha, bytes) };
      for (const v of versions) s = withVersion(s, v);
      state = s;
    },
  };
}
