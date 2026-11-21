/**
 * What the tests of the exchange share: replicas that merge and trust one another, a medium, and the files of each as a text.
 *
 * @module
 */
import { expectAny, type Path, parsePath, type ReplicaId, replicaIdOfBytes, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { type MergeReplica, memoryMergeStore } from "@intellectual-frontiers/anyfs/memory-merge";
import { memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/memory";
import { type Cursor, memoryCursor } from "../src/exchange/mod.ts";

export const path = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

export function newId(): ReplicaId {
  const r = replicaIdOfBytes(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** A replica and what a program that exchanges keeps of it. */
export type Member = { readonly r: MergeReplica; readonly self: ReplicaId; readonly cursor: Cursor };

/** `n` replicas that take changes from one another (or, where `trusting` is false, from themselves alone), on one clock that ticks at every call. */
export function members(n: number, trusting = true): readonly Member[] {
  const ids = Array.from({ length: n }, newId);
  let now = Date.UTC(2026, 0, 1);
  const clock = (): number => (now += 7);
  return ids.map((id, i) => ({
    r: memoryMergeStore({ name: `r${i}`, replica: id, clock, trust: { kind: "allowlist", replicas: new Set(trusting ? ids : [id]) } }),
    self: id,
    cursor: memoryCursor(),
  }));
}

export const medium = (): MemoryStore => memoryStore({ name: "medium" });

const enc = new TextEncoder();
export async function write(m: Member, file: string, body: string): Promise<void> {
  const w = await m.r.store.write(path(file), enc.encode(body), expectAny);
  if (w.kind === "err") throw new Error(`write ${file}: ${w.error.kind}`);
}
export async function remove(m: Member, file: string): Promise<void> {
  const w = await m.r.store.delete(path(file), expectAny);
  if (w.kind === "err") throw new Error(`delete ${file}: ${w.error.kind}`);
}

export async function listing(store: MemoryStore): Promise<readonly string[]> {
  const out: string[] = [];
  const r = await store.list(ROOT);
  if (r.kind === "err") throw new Error("list");
  for (const e of r.value.entries) out.push(e.path);
  return out;
}
