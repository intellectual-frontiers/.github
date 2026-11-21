// Spec: 0004-anyfs-middleware FR-006
/**
 * The cached layer: a read goes through a cache that is itself a store. A read asks the origin for the revision of the path, which is cheap, and gives the cached bytes where the revision is the one cached; it
 * fetches and keeps the bytes otherwise. A write or a delete goes to the origin and drops the cached copy, whatever it ends with, because a failed write leaves the object in an unknown state. The cache is never
 * trusted over the origin: the revision the origin gives decides.
 *
 * @remarks
 * The cache keeps two objects for each path, the bytes under `d/<path>` and the revision they were read at under `r/<path>`. A batch, a rename, an append, a ranged read and a search are not carried: the cache
 * could not keep them in step.
 *
 * @example
 * ```ts
 * import { cached } from "./cached.ts";
 * // const store = cached(origin, memoryStore)
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { expectAny, type Capability, type Path, parsePath, parseRevision, refused, type Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Handler } from "../ops.ts";
import { capabilitiesWithout, makeStore, type Store } from "../store.ts";

/** The capabilities a cache cannot keep in step. */
export const UNCACHEABLE = ["batch", "rename", "append", "rangeRead", "search"] as const;

const dataPath = (path: Path): Path | undefined => {
  const p = parsePath(`d/${path}`);
  return p.kind === "ok" ? p.value : undefined;
};
const revPath = (path: Path): Path | undefined => {
  const p = parsePath(`r/${path}`);
  return p.kind === "ok" ? p.value : undefined;
};
const text = new TextEncoder();
const decoder = new TextDecoder();

/** A store that reads through a cache and keeps the capabilities of its origin but those a cache cannot keep. */
export function cached<C extends Capability>(origin: Store<C> & NoInfer<Store<"read" | "stat">>, cache: Store<"read" | "write" | "delete">): Store<Exclude<C, (typeof UNCACHEABLE)[number] | "watch" | "lock">> {
  const forget = async (path: Path): Promise<void> => {
    const d = dataPath(path);
    const r = revPath(path);
    if (d !== undefined) await cache.delete(d, expectAny);
    if (r !== undefined) await cache.delete(r, expectAny);
  };
  const remember = async (path: Path, rev: Revision, bytes: Uint8Array): Promise<void> => {
    const d = dataPath(path);
    const r = revPath(path);
    if (d === undefined || r === undefined) return;
    await cache.write(d, bytes, expectAny);
    await cache.write(r, text.encode(rev), expectAny);
  };
  const handle: Handler = async (op) => {
    switch (op.op) {
      case "read": {
        const here = await origin.stat(op.path);
        if (here.kind === "err") {
          if (here.error.kind === "missing") await forget(op.path);
          return here;
        }
        const d = dataPath(op.path);
        const r = revPath(op.path);
        if (d !== undefined && r !== undefined) {
          const had = await cache.read(r);
          if (had.kind === "ok" && decoder.decode(had.value.bytes) === here.value.rev) {
            const bytes = await cache.read(d);
            if (bytes.kind === "ok") return ok({ op: "read", value: { bytes: bytes.value.bytes, rev: here.value.rev, ...(here.value.modified === undefined ? {} : { modified: here.value.modified }) } });
          }
        }
        const fetched = await origin.read(op.path);
        if (fetched.kind === "err") return fetched;
        const rev = parseRevision(fetched.value.rev);
        if (rev.kind === "ok") await remember(op.path, rev.value, fetched.value.bytes);
        return ok({ op: "read", value: fetched.value });
      }
      case "write":
      case "delete": {
        const done = await origin.handle(op);
        await forget(op.path);
        return done;
      }
      case "stat":
      case "list":
      case "history":
        return origin.handle(op);
      case "batch":
      case "rename":
      case "append":
      case "rangeRead":
      case "search":
        return err(refused("capability-absent", `a cached store does not carry ${op.op}`));
      default:
        return err(refused("capability-absent", "an operation of no known kind"));
    }
  };
  return makeStore({
    id: `${origin.id}#cached`,
    place: origin.place,
    consistency: origin.consistency,
    traits: origin.traits,
    capabilities: capabilitiesWithout<C, (typeof UNCACHEABLE)[number]>(origin, UNCACHEABLE),
    handle,
  });
}
