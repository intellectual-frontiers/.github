// Spec: 0003-bridge-transfer FR-002
/**
 * How two files are compared: a ladder of comparators, each of which may decide or pass the pair to the next. The revisions decide where both stores name a file by the SHA-256 of its bytes; the size and
 * the time decide only where the caller allows a weak answer; and the bytes, hashed, decide anything. What decided is kept with the action it led to, so that a plan says how it knows. The digest of a
 * file is kept in a cache where the caller gives one, keyed by the store, the path and the revision, so that a file that has not changed is read once.
 *
 * @example
 * ```ts
 * import { memoryDigestCache } from "./compare.ts";
 * const cache = memoryDigestCache();
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Problem, type Revision, schemeOf } from "@intellectual-frontiers/anyfs/governance";
import type { Stat, Store } from "@intellectual-frontiers/anyfs/logical";
import type { Comparator, Decider } from "@intellectual-frontiers/anyfs-bridge/governance";

/** A place to keep the digest of a file by the store, the path and the revision it was read at. */
export type DigestCache = { get(key: string): Promise<string | undefined>; set(key: string, digest: string): Promise<void> };

/** A cache in memory. */
export function memoryDigestCache(): DigestCache {
  const kept = new Map<string, string>();
  return { get: async (key) => kept.get(key), set: async (key, digest) => void kept.set(key, digest) };
}

/** One file with the store it is in: what a comparison needs. */
export type Side = { readonly store: Store<"read">; readonly stat: Stat };

/** The verdict of a comparison: whether the files are the same, and what decided. */
export type Verdict = { readonly same: boolean; readonly by: Decider };

const SHA256 = "sha256";

/** Whether the revision of a file is the SHA-256 of its bytes. */
export const isContentHash = (rev: Revision): boolean => schemeOf(rev) === SHA256;

/** The SHA-256 of a file in hex: from its revision where that is the hash, from the cache, or from its bytes. */
export async function digestOf(side: Side, cache?: DigestCache): Promise<Result<string, Problem>> {
  if (isContentHash(side.stat.rev)) return ok(side.stat.rev.slice(SHA256.length + 1));
  const key = `${side.store.id}|${side.stat.path}|${side.stat.rev}`;
  const kept = await cache?.get(key);
  if (kept !== undefined) return ok(kept);
  const read = await side.store.read(side.stat.path);
  if (read.kind === "err") return err(read.error);
  const digest = await sha256(read.value.bytes);
  await cache?.set(key, digest);
  return ok(digest);
}

/** Compares two files by the comparators in order; the first that can decide decides. Where none can, the files are taken to differ, so that they are copied again. */
export async function compare(src: Side, dst: Side, comparators: readonly Comparator[], cache?: DigestCache): Promise<Result<Verdict, Problem>> {
  for (const comparator of comparators) {
    switch (comparator) {
      case "native-digest":
        if (isContentHash(src.stat.rev) && isContentHash(dst.stat.rev)) return ok({ same: src.stat.rev === dst.stat.rev, by: "native-digest" });
        break;
      case "size-mtime":
        if (src.stat.size !== dst.stat.size) return ok({ same: false, by: "size" });
        if (src.stat.modified !== undefined && dst.stat.modified !== undefined && src.stat.modified === dst.stat.modified) return ok({ same: true, by: "size-mtime" });
        break;
      case "content-hash": {
        const a = await digestOf(src, cache);
        if (a.kind === "err") return a;
        const b = await digestOf(dst, cache);
        if (b.kind === "err") return b;
        return ok({ same: a.value === b.value, by: "content-hash" });
      }
      default: {
        const never: never = comparator;
        return never;
      }
    }
  }
  return ok({ same: false, by: "undecided" });
}

