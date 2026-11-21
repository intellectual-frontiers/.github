/**
 * Tests of the layers of a store (commons anyfs 0004-anyfs-middleware FR-001 to FR-006): layers compose and recompute the capabilities, the traced layer makes one span for each operation and holds no bytes, the
 * audited layer records every operation and never hides a gap, the retrying layer repeats only what is safe, the rate limit waits on a clock the test holds, and the cache is trusted only by the revision of the origin.
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  type AuditRecord,
  audited,
  cached,
  type Clock,
  makeStore,
  type Op,
  pipe,
  rateLimited,
  readOnly,
  retrying,
  type Span,
  type Store,
  traced,
  type Tracer,
} from "../src/logical/mod.ts";
import { expectAbsent, expectAny, expectRev, parsePath, parsePrefix, ROOT, unavailable, type Path, type Problem } from "../src/governance/mod.ts";
import { memoryStore } from "../src/physical/memory/mod.ts";

const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

/** A clock the test holds: time moves only when something sleeps. */
function fakeClock(): Clock & { readonly slept: number[]; at: number } {
  const c = {
    at: 0,
    slept: [] as number[],
    now: () => c.at,
    sleep: async (ms: number): Promise<void> => {
      c.slept.push(ms);
      c.at += ms;
    },
  };
  return c;
}

proves(["0004-anyfs-middleware FR-001"], "layers compose in the order given and the result has the capabilities the layers keep, in the type and in the set", async () => {
  const base = memoryStore();
  const order: string[] = [];
  const recorder = (name: string) => <C extends "read" | "write" | "list" | "stat" | "delete" | "cas" | "batch" | "rename" | "history">(s: Store<C>): Store<C> =>
    makeStore({ ...s, capabilities: [...s.capabilities].filter((c): c is C => c !== "watch" && c !== "lock") as never, handle: async (op: Op) => { order.push(name); return s.handle(op); } }) as unknown as Store<C>;
  const both = pipe(base, recorder("first"), recorder("second"));
  await both.read(p("x"));
  assertEquals(order, ["second", "first"], "the last layer is the outermost");
  const ro = pipe(base, (s) => readOnly(s), (s) => traced(s, { start: () => ({ end: () => undefined }) }));
  assert(!("write" in ro) && "read" in ro && ro.capabilities.has("list") && !ro.capabilities.has("write"));
  const cachedRo = cached(base, memoryStore());
  assert(!cachedRo.capabilities.has("batch") && !cachedRo.capabilities.has("rename") && cachedRo.capabilities.has("cas") && cachedRo.capabilities.has("history"));
});

proves(["0004-anyfs-middleware FR-002"], "the traced layer makes one span for each operation, with the path and outcome and the number of bytes, and holds no bytes", async () => {
  const spans: { name: string; start: Record<string, string | number>; end: Record<string, string | number> | undefined }[] = [];
  const tracer: Tracer = {
    start(name, attributes) {
      const s = { name, start: attributes, end: undefined as Record<string, string | number> | undefined };
      spans.push(s);
      const span: Span = { end: (a) => { s.end = a; } };
      return span;
    },
  };
  const s = traced(memoryStore({ name: "t" }), tracer);
  await s.write(p("a/secret.txt"), bytes("the secret text"), expectAny);
  await s.read(p("a/secret.txt"));
  await s.read(p("nothing"));
  assertEquals(spans.map((x) => x.name), ["anyfs.write", "anyfs.read", "anyfs.read"]);
  assertEquals(spans[0]?.start["anyfs.path"], "a/secret.txt");
  assertEquals(spans[0]?.end?.["anyfs.outcome"], "ok");
  assertEquals(spans[0]?.end?.["anyfs.bytes"], 15);
  assertEquals(spans[2]?.end?.["anyfs.outcome"], "missing");
  assert(!JSON.stringify(spans).includes("the secret text"), "a span holds no bytes");
  const throwing = traced(memoryStore(), { start: () => { throw new Error("tracer down"); } });
  assertEquals((await throwing.write(p("a"), bytes("x"), expectAny)).kind, "ok", "a tracer that throws fails no operation");
  assert([...s.capabilities].length === 9);
});

proves(["0004-anyfs-middleware FR-003"], "the audited layer records every operation including refused ones, and a failing sink makes the answer unavailable while the operation stands", async () => {
  const records: AuditRecord[] = [];
  const clock = fakeClock();
  clock.at = Date.parse("2026-11-21T10:00:00Z");
  const s = audited(memoryStore({ name: "a" }), async (r) => { records.push(r); }, clock);
  await s.write(p("x"), bytes("12345"), expectAny);
  await s.write(p("x"), bytes("6"), expectAbsent);
  await s.read(p("none"));
  assertEquals(records.map((r) => [r.op, r.outcome]), [["write", "ok"], ["write", "conflict"], ["read", "missing"]]);
  assertEquals(records[0], { at: "2026-11-21T10:00:00.000Z", store: "memory:a", op: "write", path: "x", outcome: "ok", size: 5 });
  assert(!JSON.stringify(records).includes("12345"));
  const inner = memoryStore();
  const failing = audited(inner, async () => { throw new Error("disk full"); }, clock);
  const r = await failing.write(p("y"), bytes("kept"), expectAny);
  assert(r.kind === "err" && r.error.kind === "unavailable" && r.error.detail.includes("audit sink") && r.error.detail.includes("done"));
  const there = await inner.read(p("y"));
  assert(there.kind === "ok" && text(there.value.bytes) === "kept", "the operation's effect stands");
});

/** A store that fails its first `failures` operations as unavailable, then answers as its argument does. */
function flaky<C extends "read" | "write" | "list" | "stat" | "delete" | "cas" | "batch" | "rename" | "history">(inner: Store<C>, failures: number, retryable = true): Store<C> & { readonly calls: () => number } {
  let n = 0;
  const wrapped = makeStore({
    id: inner.id,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: [...inner.capabilities].filter((c): c is C => c !== "watch" && c !== "lock") as never,
    handle: async (op: Op) => {
      n++;
      return n <= failures ? err(unavailable("not now", retryable)) : inner.handle(op);
    },
  });
  return Object.assign(wrapped as unknown as Store<C>, { calls: () => n });
}

proves(["0004-anyfs-middleware FR-004"], "the retrying layer repeats only what is safe, only an unavailable that may succeed, with a doubling wait and a bounded number of attempts", async () => {
  const clock = fakeClock();
  const policy = { attempts: 3, baseMs: 100, maxMs: 150 };
  const base = memoryStore();
  await base.write(p("a"), bytes("x"), expectAny);
  const twice = flaky(base, 2);
  const r = await retrying(twice, policy, clock).read(p("a"));
  assertEquals(r.kind, "ok");
  assertEquals(clock.slept, [100, 150], "the wait doubles up to its limit");
  assertEquals(twice.calls(), 3);
  const never = flaky(base, 10);
  const lost = await retrying(never, policy, fakeClock()).read(p("a"));
  assert(lost.kind === "err" && lost.error.kind === "unavailable");
  assertEquals(never.calls(), 3, "the attempts are bounded");
  const permanent = flaky(base, 5, false);
  await retrying(permanent, policy, fakeClock()).read(p("a"));
  assertEquals(permanent.calls(), 1, "an unavailable with no retry possible is not repeated");
  const guarded = flaky(base, 1);
  const w = await retrying(guarded, policy, fakeClock()).write(p("b"), bytes("1"), expectAbsent);
  assert(w.kind === "err" && w.error.kind === "unavailable");
  assertEquals(guarded.calls(), 1, "a write that expects no object is not repeated");
  const any = flaky(base, 1);
  assertEquals((await retrying(any, policy, fakeClock()).write(p("b"), bytes("1"), expectAny)).kind, "ok");
  const conflicting = memoryStore();
  await conflicting.write(p("c"), bytes("1"), expectAny);
  const c = await retrying(conflicting, policy, fakeClock()).write(p("c"), bytes("2"), expectAbsent);
  assert(c.kind === "err" && c.error.kind === "conflict", "a conflict is the answer and is not repeated");
});

proves(["0004-anyfs-middleware FR-005"], "the rate limit allows its operations in each interval and waits for the next, never failing one", async () => {
  const clock = fakeClock();
  const s = rateLimited(memoryStore(), { operations: 2, intervalMs: 1000 }, clock);
  await Promise.all([s.write(p("a"), bytes("1"), expectAny), s.write(p("b"), bytes("1"), expectAny)]);
  assertEquals(clock.slept, [], "two operations fit in the first interval");
  const third = await s.write(p("c"), bytes("1"), expectAny);
  assertEquals(third.kind, "ok");
  assertEquals(clock.slept.length > 0 && clock.slept.reduce((x, y) => x + y, 0) >= 499, true, "the third waited for a token");
  const fast = fakeClock();
  const t = rateLimited(memoryStore(), { operations: 5, intervalMs: 1000 }, fast);
  for (let i = 0; i < 5; i++) await t.stat(p("none")).catch(() => undefined);
  assertEquals(fast.slept, []);
  for (let i = 0; i < 10; i++) assertEquals((await t.write(p(`k${i}`), bytes("1"), expectAny)).kind, "ok");
  assert(fast.at >= 1000, "ten more operations took at least a second of the clock");
});

proves(["0004-anyfs-middleware FR-006"], "the cache gives the cached bytes only at the origin's revision, and a write or a delete through it drops the copy", async () => {
  const origin = memoryStore({ name: "origin" });
  const reads: string[] = [];
  const watching = makeStore({
    id: origin.id,
    place: origin.place,
    consistency: origin.consistency,
    traits: origin.traits,
    capabilities: ["read", "write", "list", "stat", "delete", "cas", "history"],
    handle: async (op: Op) => {
      reads.push(op.op);
      return origin.handle(op);
    },
  });
  const cache = memoryStore({ name: "cache" });
  const s = cached(watching, cache);
  await origin.write(p("a"), bytes("one"), expectAny);
  assertEquals(text((await s.read(p("a")) as { value: { bytes: Uint8Array } }).value.bytes), "one");
  assertEquals(reads, ["stat", "read"], "a miss asks for the revision and fetches");
  reads.length = 0;
  assertEquals(text((await s.read(p("a")) as { value: { bytes: Uint8Array } }).value.bytes), "one");
  assertEquals(reads, ["stat"], "a hit asks for the revision alone");
  await origin.write(p("a"), bytes("two"), expectAny);
  reads.length = 0;
  assertEquals(text((await s.read(p("a")) as { value: { bytes: Uint8Array } }).value.bytes), "two", "a changed revision is fetched again");
  assertEquals(reads, ["stat", "read"]);
  const w = await s.write(p("a"), bytes("three"), expectAny);
  assertEquals(w.kind, "ok");
  const l = await cache.list(ROOT);
  assert(l.kind === "ok" && l.value.entries.length === 0, "a write drops the cached copy");
  await s.read(p("a"));
  const d = await s.delete(p("a"), expectAny);
  assertEquals(d.kind, "ok");
  const gone = await s.read(p("a"));
  assert(gone.kind === "err" && gone.error.kind === "missing");
  const none = await cache.list(ROOT);
  assert(none.kind === "ok" && none.value.entries.length === 0, "a delete drops the cached copy");
  const m: Problem | undefined = gone.kind === "err" ? gone.error : undefined;
  assertEquals(m?.kind, "missing");
  assert(parsePrefix("x").kind === "ok" && expectRev !== undefined);
});
