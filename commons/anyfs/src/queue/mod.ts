// Spec: 0011-anyfs-queue FR-001
/**
 * A durable queue of segments over a store (0011-anyfs-queue): `openQueue(store, prefix, policy, now)` gives one writer and one reader an ordered, capped, restartable queue whose segments are objects named
 * `<prefix>/<sequence of 20 digits>-<instant>-<signal>.seg`, so that the order of a listing is the order of the queue and the pure rule `evictions` and the pure fold `statsOf` need no object read.
 * The shape of what it gives is the port `SegmentQueue` of telemetry, which this module does not import.
 *
 * @example
 * ```ts
 * import { openQueue } from "@intellectual-frontiers/anyfs/queue";
 * // const q = openQueue(memoryStore(), "queue", { maxBytes: 1 << 20, maxAgeMs: 86_400_000, onFull: "drop-oldest" }, Date.now);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { expectAbsent, expectAny, parsePath, parsePrefix, type Cursor, type Path, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";

/** The signal a segment carries. */
export type Signal = "traces" | "logs" | "metrics";

/** What a segment is, beside its bytes. */
export type SegmentMeta = { readonly signal: Signal; readonly at: number; readonly count: number };

/** A segment as the queue holds it. */
export type Segment = { readonly id: string; readonly bytes: Uint8Array; readonly meta: SegmentMeta };

/** Why the queue refused or failed. */
export type QueueProblem = { readonly kind: "full" | "store"; readonly message: string };

/** The count, the bytes and the age of the oldest in milliseconds. */
export type QueueStats = { readonly count: number; readonly bytes: number; readonly oldestAgeMs: number | undefined };

/** What was dropped since the last `takeDropped`, by signal. */
export type Dropped = Readonly<Record<Signal, number>>;

/** What to do when the queue is full. */
export type OnFull = "drop-oldest" | "refuse-new";

/** The cap of a queue. */
export type QueuePolicy = { readonly maxBytes: number; readonly maxAgeMs: number; readonly onFull: OnFull };

/** One segment of a listing, as the pure rule reads it. */
export type Listed = { readonly id: string; readonly bytes: number; readonly at: number; readonly signal: Signal };

/** A segment to remove and why. */
export type Eviction = { readonly id: string; readonly signal: Signal; readonly reason: "age" | "full" };

/** What the rule decided: the segments to remove and whether the new segment is refused. */
export type Evicted = { readonly remove: readonly Eviction[]; readonly refuse: boolean };

/** The queue over a store. */
export interface Queue {
  enqueue(bytes: Uint8Array, meta: SegmentMeta): Promise<Result<string, QueueProblem>>;
  peek(limit: number): Promise<Result<readonly Segment[], QueueProblem>>;
  ack(id: string): Promise<Result<undefined, QueueProblem>>;
  stats(): Promise<Result<QueueStats, QueueProblem>>;
  takeDropped(): Promise<Result<Dropped, QueueProblem>>;
}

/** The capabilities a queue needs of its store (FR-001). */
export type QueueStore = Store<"read" | "write" | "list" | "delete" | "cas">;

/**
 * The segments to remove before a segment of `incoming` bytes is added (FR-005): those older than `maxAgeMs`, then under `drop-oldest` the oldest until it fits; under `refuse-new` nothing more and the new
 * segment is refused where it does not fit. A segment larger than `maxBytes` is always refused. The listing is in order, oldest first.
 */
export function evictions(listing: readonly Listed[], policy: QueuePolicy, now: number, incoming: number): Evicted {
  const remove: Eviction[] = [];
  let kept = listing.filter((s) => {
    if (now - s.at > policy.maxAgeMs) {
      remove.push({ id: s.id, signal: s.signal, reason: "age" });
      return false;
    }
    return true;
  });
  let total = kept.reduce((n, s) => n + s.bytes, 0);
  if (incoming > policy.maxBytes) return { remove, refuse: true };
  if (total + incoming <= policy.maxBytes) return { remove, refuse: false };
  if (policy.onFull === "refuse-new") return { remove, refuse: true };
  while (total + incoming > policy.maxBytes && kept.length > 0) {
    const [oldest, ...rest] = kept;
    if (oldest === undefined) break;
    remove.push({ id: oldest.id, signal: oldest.signal, reason: "full" });
    total -= oldest.bytes;
    kept = rest;
  }
  return { remove, refuse: false };
}

/** The statistics of a listing: a pure fold that reads no object (FR-006). */
export function statsOf(listing: readonly Listed[], now: number): QueueStats {
  const oldest = listing[0];
  return { count: listing.length, bytes: listing.reduce((n, s) => n + s.bytes, 0), oldestAgeMs: oldest === undefined ? undefined : Math.max(0, now - oldest.at) };
}

const LETTER: Readonly<Record<Signal, string>> = { traces: "t", logs: "l", metrics: "m" };
const SIGNAL_OF: Readonly<Record<string, Signal>> = { t: "traces", l: "logs", m: "metrics" };
const NAME = /^(\d{20})-(\d{13})-([tlm])\.seg$/;

/** The name of a segment: the sequence, the instant and the signal, so that a listing says all the pure rule needs. */
export function segmentName(sequence: number, at: number, signal: Signal): string {
  return `${String(sequence).padStart(20, "0")}-${String(Math.trunc(at)).padStart(13, "0")}-${LETTER[signal]}.seg`;
}

/** What a name says, or `undefined` where it is not a segment's. */
export function parseSegmentName(name: string): { readonly sequence: number; readonly at: number; readonly signal: Signal } | undefined {
  const m = NAME.exec(name);
  const signal = m?.[3] === undefined ? undefined : SIGNAL_OF[m[3]];
  if (m?.[1] === undefined || m[2] === undefined || signal === undefined) return undefined;
  return { sequence: Number(m[1]), at: Number(m[2]), signal };
}

/** The empty count of drops. */
export const NO_DROPS: Dropped = { traces: 0, logs: 0, metrics: 0 };

const utf8 = new TextEncoder();
const utf8d = new TextDecoder();

const store = (message: string): QueueProblem => ({ kind: "store", message });

/** A segment object: one line of the meta, then the bytes. */
function pack(bytes: Uint8Array, meta: SegmentMeta): Uint8Array {
  const head = utf8.encode(`${JSON.stringify({ count: meta.count })}\n`);
  const out = new Uint8Array(head.length + bytes.length);
  out.set(head, 0);
  out.set(bytes, head.length);
  return out;
}

function unpack(object: Uint8Array): { readonly count: number; readonly bytes: Uint8Array } | undefined {
  const nl = object.indexOf(10);
  if (nl < 0) return undefined;
  try {
    const head = JSON.parse(utf8d.decode(object.subarray(0, nl))) as { count?: unknown };
    return { count: typeof head.count === "number" ? head.count : 0, bytes: object.subarray(nl + 1) };
  } catch {
    return undefined;
  }
}

/**
 * The queue over a store at a prefix. A store of `eventual-listing` or `eventual-merge` consistency, or with the capability `merge`, is refused because the order of a queue cannot be kept on it (FR-003, FR-007).
 * `now` is the clock.
 */
export function openQueue(base: QueueStore, prefixText: string, policy: QueuePolicy, now: () => number): Result<Queue, QueueProblem> {
  if (base.consistency === "eventual-listing" || base.consistency === "eventual-merge" || base.capabilities.has("merge")) {
    return err(store(`the store ${base.id} is ${base.consistency}: the order of a queue cannot be kept on it`));
  }
  const pre = parsePrefix(prefixText);
  if (pre.kind === "err") return err(store(pre.error));
  const prefix: Prefix = pre.value;
  let dropped: Dropped = NO_DROPS;
  const path = (name: string): Result<Path, QueueProblem> => {
    const p = parsePath(prefix === "" ? name : `${prefix}/${name}`);
    return p.kind === "ok" ? ok(p.value) : err(store(p.error));
  };

  const listAll = async (): Promise<Result<readonly (Listed & { readonly sequence: number; readonly path: Path })[], QueueProblem>> => {
    const out: (Listed & { readonly sequence: number; readonly path: Path })[] = [];
    let after: Cursor | undefined;
    for (;;) {
      const page = await base.list(prefix, after === undefined ? { limit: 500 } : { limit: 500, after });
      if (page.kind === "err") return err(store(JSON.stringify(page.error)));
      for (const e of page.value.entries) {
        const name = e.path.slice(e.path.lastIndexOf("/") + 1);
        const parsed = parseSegmentName(name);
        if (parsed === undefined) continue;
        out.push({ id: name, bytes: e.size, at: parsed.at, signal: parsed.signal, sequence: parsed.sequence, path: e.path });
      }
      if (page.value.next === undefined) break;
      after = page.value.next;
    }
    out.sort((a, b) => a.sequence - b.sequence);
    return ok(out);
  };

  const remove = async (id: string): Promise<Result<undefined, QueueProblem>> => {
    const p = path(id);
    if (p.kind === "err") return p;
    const d = await base.delete(p.value, expectAny);
    return d.kind === "ok" ? ok(undefined) : err(store(JSON.stringify(d.error)));
  };

  const queue: Queue = {
    async enqueue(bytes, meta) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const listing = await listAll();
        if (listing.kind === "err") return listing;
        const e = evictions(listing.value, policy, now(), bytes.length + 24);
        for (const r of e.remove) {
          const gone = await remove(r.id);
          if (gone.kind === "err") return gone;
          dropped = { ...dropped, [r.signal]: dropped[r.signal] + 1 };
        }
        if (e.refuse) {
          dropped = { ...dropped, [meta.signal]: dropped[meta.signal] + 1 };
          return err({ kind: "full", message: "the queue is full and the new segment was refused" });
        }
        const last = listing.value.at(-1)?.sequence ?? 0;
        const name = segmentName(last + 1, meta.at, meta.signal);
        const p = path(name);
        if (p.kind === "err") return p;
        const w = await base.write(p.value, pack(bytes, meta), expectAbsent);
        if (w.kind === "ok") return ok(name);
        if (w.error.kind !== "conflict") return err(store(JSON.stringify(w.error)));
      }
      return err(store("the sequence number was taken eight times; there is more than one writer"));
    },
    async peek(limit) {
      const listing = await listAll();
      if (listing.kind === "err") return listing;
      const out: Segment[] = [];
      for (const item of listing.value.slice(0, Math.max(0, limit))) {
        const r = await base.read(item.path);
        if (r.kind === "err") return err(store(JSON.stringify(r.error)));
        const u = unpack(r.value.bytes);
        if (u === undefined) return err(store(`the segment ${item.id} is not a segment`));
        out.push({ id: item.id, bytes: u.bytes, meta: { signal: item.signal, at: item.at, count: u.count } });
      }
      return ok(out);
    },
    ack: (id) => remove(id),
    async stats() {
      const listing = await listAll();
      return listing.kind === "err" ? listing : ok(statsOf(listing.value, now()));
    },
    takeDropped() {
      const d = dropped;
      dropped = NO_DROPS;
      return Promise.resolve(ok(d));
    },
  };
  return ok(queue);
}

