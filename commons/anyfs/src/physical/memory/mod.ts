// Spec: 0005-anyfs-conformance FR-003
/**
 * The store in memory: every capability a store can keep without help, held in a map, and the reference every other backend is compared with. Its revision is `sha256:` and the digest of the bytes, so the same
 * bytes are the same revision wherever they are; a batch is applied to a copy of the state and committed whole, so it is all or nothing; a history keeps every revision an object has had until it is deleted.
 *
 * @example
 * ```ts
 * import { memoryStore } from "./mod.ts";
 * const store = memoryStore({ name: "scratch" });
 * store.id; // "memory:scratch"
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
  missing,
  parseCursor,
  type Path,
  type Place,
  type Problem,
  refused,
  type Revision,
  parseRevision,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";

/** The capabilities of the store in memory. */
export const MEMORY_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history"] as const;
/** The type of the store in memory. */
export type MemoryStore = Store<(typeof MEMORY_CAPABILITIES)[number]>;

/** What the store in memory is made with: its name and the clock that dates a change, in milliseconds. */
export type MemoryOptions = { readonly name?: string; readonly clock?: () => number };

type Version = { readonly rev: Revision; readonly size: number; readonly modified: string };
type Entry = { readonly bytes: Uint8Array; readonly rev: Revision; readonly modified: string; readonly versions: readonly Version[] };

const PAGE = 1000;
const MAX_PAGE = 10000;

/** The revision of some bytes: `sha256:` and their digest. */
export async function revisionOfBytes(bytes: Uint8Array): Promise<Revision> {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The conflict of an expectation against what is there, or nothing where it holds. */
function check(path: Path, expect: Expect, entry: Entry | undefined): Problem | undefined {
  switch (expect.kind) {
    case "any":
      return undefined;
    case "absent":
      return entry === undefined ? undefined : conflict(path, expect, { kind: "rev", rev: entry.rev });
    case "rev":
      if (entry === undefined) return conflict(path, expect, { kind: "absent" });
      return entry.rev === expect.rev ? undefined : conflict(path, expect, { kind: "rev", rev: entry.rev });
    default:
      return unavailable("an expectation of no known kind", false);
  }
}

/** A store in memory. */
export function memoryStore(options: MemoryOptions = {}): MemoryStore {
  const name = options.name ?? "memory";
  const clock = options.clock ?? ((): number => Date.now());
  const place: Place = { kind: "memory", name };
  let state = new Map<Path, Entry>();
  const instant = (): string => new Date(clock()).toISOString();

  const put = (map: Map<Path, Entry>, path: Path, bytes: Uint8Array, rev: Revision, expect: Expect): Result<{ readonly created: boolean }, Problem> => {
    const had = map.get(path);
    const problem = check(path, expect, had);
    if (problem !== undefined) return err(problem);
    if (had !== undefined && had.rev === rev) return ok({ created: false });
    const modified = instant();
    const versions = [{ rev, size: bytes.length, modified }, ...(had?.versions ?? [])];
    map.set(path, { bytes: bytes.slice(), rev, modified, versions });
    return ok({ created: had === undefined });
  };

  const remove = (map: Map<Path, Entry>, path: Path, expect: Expect): Result<{ readonly existed: boolean }, Problem> => {
    const had = map.get(path);
    const problem = check(path, expect, had);
    if (problem !== undefined) return err(problem);
    map.delete(path);
    return ok({ existed: had !== undefined });
  };

  const statOf = (path: Path, e: Entry): Stat => ({ path, size: e.bytes.length, rev: e.rev, modified: e.modified });

  const handle: Handler = async (op: Op) => {
    switch (op.op) {
      case "read": {
        const e = state.get(op.path);
        return e === undefined ? err(missing(op.path)) : ok({ op: "read", value: { bytes: e.bytes.slice(), rev: e.rev, modified: e.modified } });
      }
      case "stat": {
        const e = state.get(op.path);
        return e === undefined ? err(missing(op.path)) : ok({ op: "stat", value: statOf(op.path, e) });
      }
      case "write": {
        const rev = await revisionOfBytes(op.bytes);
        const done = put(state, op.path, op.bytes, rev, op.expect);
        if (done.kind === "err") return done;
        return ok({ op: "write", value: { rev, created: done.value.created } });
      }
      case "delete": {
        const done = remove(state, op.path, op.expect);
        if (done.kind === "err") return done;
        return ok({ op: "delete", value: { existed: done.value.existed } });
      }
      case "list": {
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
        const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
        const paths = [...state.keys()].filter((p) => isUnder(op.prefix, p) && (after === undefined || comparePaths(p, after) > 0)).sort(comparePaths);
        const page = paths.slice(0, limit);
        const entries = page.flatMap((p) => {
          const e = state.get(p);
          return e === undefined ? [] : [statOf(p, e)];
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
      case "batch": {
        // the digests are made first, and the copy of the state after them, so that a write made while they were made is in the copy and is not lost when it is committed
        const prepared = await Promise.all(op.changes.map(async (c) => (c.kind === "put" ? { change: c, rev: await revisionOfBytes(c.bytes) } : { change: c, rev: undefined })));
        const next = new Map(state);
        const applyChange = (change: Change, rev: Revision | undefined): Result<ChangeResult, Problem> => {
          if (change.kind === "put") {
            if (rev === undefined) return err(unavailable("a put with no digest", false));
            const r = put(next, change.path, change.bytes, rev, change.expect);
            return r.kind === "err" ? r : ok({ kind: "put", path: change.path, rev, created: r.value.created });
          }
          const r = remove(next, change.path, change.expect);
          return r.kind === "err" ? r : ok({ kind: "delete", path: change.path, existed: r.value.existed });
        };
        const results: ChangeResult[] = [];
        for (const { change, rev } of prepared) {
          const done = applyChange(change, rev);
          if (done.kind === "err") return done;
          results.push(done.value);
        }
        state = next;
        return ok({ op: "batch", value: { results } });
      }
      case "rename": {
        const e = state.get(op.from);
        if (e === undefined) return err(missing(op.from));
        const bad = check(op.from, op.expect, e);
        if (bad !== undefined) return err(bad);
        const there = state.get(op.to);
        if (there !== undefined) return err(conflict(op.to, { kind: "absent" }, { kind: "rev", rev: there.rev }));
        if (op.from === op.to) return err(refused("outside-scope", "a rename to the same path moves nothing", op.from));
        state.delete(op.from);
        state.set(op.to, e);
        return ok({ op: "rename", value: { rev: e.rev, created: true } });
      }
      case "history": {
        const e = state.get(op.path);
        if (e === undefined) return err(missing(op.path));
        const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
        const value: Versions = { versions: e.versions.slice(0, limit) };
        return ok({ op: "history", value });
      }
      case "rangeRead":
      case "append":
      case "search":
        return err(refused("capability-absent", `the store in memory does not have ${op.op}`));
      default:
        return err(unavailable("an operation of no known kind", false));
    }
  };

  return makeStore({ id: `memory:${name}`, place, consistency: "strong", traits: { caseSensitive: true }, capabilities: MEMORY_CAPABILITIES, handle });
}
