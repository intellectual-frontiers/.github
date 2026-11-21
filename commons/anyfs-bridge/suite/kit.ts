/**
 * What the tests of the bridge share: stores in memory and in a folder, a way to put and read a text, the two ends of a transfer, a store that fails on command and one that folds the case of a name.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { expectAny, type Path, parsePath, ROOT, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, type OpCapability, type Store } from "@intellectual-frontiers/anyfs/logical";
import { memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/memory";
import type { Dest, Endpoint } from "../src/logical/mod.ts";

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** A store in memory whose clock ticks one second at each write, from a start, so that modification times are known. */
export function timed(name: string, start = Date.UTC(2026, 0, 1)): MemoryStore {
  let now = start;
  return memoryStore({ name, clock: () => (now += 1000) });
}

export const text = new TextEncoder();
export const decode = new TextDecoder();

export async function put(store: Dest, path: string, body: string): Promise<void> {
  const r = await store.write(p(path), text.encode(body), expectAny as never);
  if (r.kind === "err") throw new Error(`put ${path}: ${r.error.kind}`);
}

export async function get(store: Dest, path: string): Promise<string | undefined> {
  const r = await store.read(p(path));
  return r.kind === "ok" ? decode.decode(r.value.bytes) : undefined;
}

export async function names(store: Dest): Promise<readonly string[]> {
  const r = await store.list(ROOT);
  if (r.kind === "err") throw new Error("list");
  return r.value.entries.map((e) => e.path);
}

export const at = <S>(store: S, prefix = ROOT): Endpoint<S> => ({ store, prefix });

/** A store that does what `inner` does, until `fail` says an operation fails. */
export function flaky(inner: Dest, fail: (op: { readonly op: string; readonly path?: string }, count: number) => boolean): Dest {
  let count = 0;
  const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
  return makeStore({
    id: `flaky:${inner.id}`,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: caps,
    handle: async (op) => {
      count++;
      const path = "path" in op ? op.path : "to" in op ? op.to : undefined;
      if (fail({ op: op.op, ...(path === undefined ? {} : { path }) }, count)) return err(unavailable("the store failed on purpose", true));
      return inner.handle(op);
    },
  }) as unknown as Dest;
}

/** The same store with other traits. */
export function withTraits(inner: Dest, traits: Store<"read">["traits"]): Dest {
  const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
  return makeStore({ id: inner.id, place: inner.place, consistency: inner.consistency, traits, capabilities: caps, handle: inner.handle }) as unknown as Dest;
}

/** The same store with revisions that are not hashes: `ver:` and the digest, so that only the bytes can say whether two files are alike. */
export function opaque(inner: Dest): Dest {
  const down = (e: { readonly kind: string; readonly rev?: string }): unknown => (e.kind === "rev" && e.rev !== undefined ? { ...e, rev: e.rev.replace(/^ver:/u, "sha256:") } : e);
  const up = (rev: string): string => rev.replace(/^sha256:/u, "ver:");
  const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
  return makeStore({
    id: `opaque:${inner.id}`,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: caps,
    handle: async (op) => {
      const o = op as unknown as Record<string, unknown>;
      const asked = "expect" in o ? { ...o, expect: down(o["expect"] as { kind: string; rev?: string }) } : o;
      const r = await inner.handle(asked as never);
      if (r.kind === "err") return r;
      const d = r.value as unknown as { op: string; value: Record<string, unknown> };
      const v = d.value;
      switch (d.op) {
        case "read":
        case "stat":
        case "write":
        case "rename":
          return { kind: "ok", value: { op: d.op, value: { ...v, rev: up(String(v["rev"])) } } } as never;
        case "list":
          return { kind: "ok", value: { op: "list", value: { ...v, entries: (v["entries"] as { rev: string }[]).map((e) => ({ ...e, rev: up(e.rev) })) } } } as never;
        default:
          return r;
      }
    },
  }) as unknown as Dest;
}

/** The same store that keeps other bytes than it is given, so that what it reads back is not what was written. */
export function liar(inner: Dest): Dest {
  const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
  return makeStore({
    id: `liar:${inner.id}`,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: caps,
    handle: async (op) => (op.op === "write" ? inner.handle({ ...op, bytes: new TextEncoder().encode("corrupted") }) : inner.handle(op)),
  }) as unknown as Dest;
}
