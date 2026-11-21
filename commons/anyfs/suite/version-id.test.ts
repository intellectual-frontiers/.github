/**
 * Tests of the version id as IETF RFC 9562 section 5.7 lays it out (commons anyfs 0007-anyfs-merge-governance FR-002, FR-010, FR-011 and 0008-anyfs-merge-logical FR-003): the version and variant bits, the counter in
 * `rand_a` (section 6.2, method 1), `rand_b` random for each id from the CSPRNG, ids that are strictly ordered for one replica under a clock that goes back and in bursts of one millisecond, no replica read out of an id,
 * and the union of rows in any order with the ids as they are. Each rule is also run against a made-wrong generator (a mutant), which the same check must refuse, so that the check itself is proved to see a fixed tail.
 *
 * @module
 */
import fc from "fast-check";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { compareTime, type Delta, type IdTime, makeVersionId, MAX_COUNTER_SEED, parseVersionId, randomCounterSeed, randomIdBytes, replicaIdOfBytes, type ReplicaId, timeOfId, type VersionId } from "../src/governance/mod.ts";
import { applyDelta, defaultConfig, newState, nextTime, type MergeState, seeTime, stateText, transact } from "../src/merge/mod.ts";

/** A generator of ids under test: what a replica does for each id. */
type Maker = (time: IdTime, replica: number) => VersionId;

/** The real maker: the id is made of its time and the CSPRNG. */
const real: Maker = (time) => makeVersionId(time);

/** Mutants: each breaks one rule of the id. */
const fixedTail = (replica: number): Uint8Array => new Uint8Array(8).fill(replica + 1);
const mutants: ReadonlyArray<{ readonly name: string; readonly make: Maker }> = [
  { name: "a tail fixed for the replica", make: (t, r) => makeVersionId(t, fixedTail(r)) },
  { name: "a tail that is the counter", make: (t) => makeVersionId(t, new Uint8Array(8).fill(t.counter & 0xff)) },
  { name: "a version of 4", make: (t) => makeVersionId(t).replace(/^(.{14})7/u, "$14") as VersionId },
  { name: "a variant of 11", make: (t) => makeVersionId(t).replace(/^(.{19})[89ab]/u, "$1c") as VersionId },
];

const bytesOf = (id: VersionId): Uint8Array => {
  const hex = id.replaceAll("-", "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const tailOf = (id: VersionId): string => id.slice(19).replace("-", "");

/** The problems an id has against RFC 9562 section 5.7: none where it conforms. */
function layoutProblems(id: VersionId, time: IdTime): string[] {
  const b = bytesOf(id);
  const out: string[] = [];
  if (((b[6] ?? 0) >> 4) !== 7) out.push("the version is not 7");
  if (((b[8] ?? 0) >> 6) !== 2) out.push("the variant is not 10");
  const ms = b.slice(0, 6).reduce((n, x) => n * 256 + x, 0);
  if (ms !== time.ms) out.push("unix_ts_ms is not the time");
  if ((((b[6] ?? 0) & 0x0f) << 8 | (b[7] ?? 0)) !== time.counter) out.push("rand_a is not the counter");
  if (parseVersionId(id).kind !== "ok") out.push("the parser refuses it");
  return out;
}

/** The problems a maker has with the randomness of the tail: the tails of many ids, of one replica and of two, must not repeat, and their bits must not stay fixed. */
function tailProblems(make: Maker): string[] {
  const out: string[] = [];
  const time: IdTime = { ms: 1_700_000_000_000, counter: 7 };
  const ofOne = new Set<string>();
  const bitsOr = new Uint8Array(8);
  const bitsAnd = new Uint8Array(8).fill(0xff);
  for (let i = 0; i < 256; i++) {
    const id = make({ ms: time.ms, counter: i }, 1);
    ofOne.add(tailOf(id));
    const hex = tailOf(id);
    for (let k = 0; k < 8; k++) {
      const byte = Number.parseInt(hex.slice(k * 2, k * 2 + 2), 16);
      bitsOr[k] = (bitsOr[k] ?? 0) | byte;
      bitsAnd[k] = (bitsAnd[k] ?? 0xff) & byte;
    }
  }
  if (ofOne.size < 256) out.push(`256 ids of one replica share tails: ${ofOne.size} tails`);
  // Below the two variant bits every bit of the 62 must have been seen both set and clear.
  for (let k = 0; k < 8; k++) {
    const free = k === 0 ? 0x3f : 0xff;
    if ((bitsOr[k] ?? 0) & free ^ free) out.push(`a bit of byte ${k} of the tail was never set`);
    if ((bitsAnd[k] ?? 0) & free) out.push(`a bit of byte ${k} of the tail was never clear`);
  }
  if (make(time, 1) === make(time, 1) && make(time, 1) === make(time, 2)) out.push("one time, two replicas, one id");
  if (tailOf(make(time, 1)) === tailOf(make(time, 1))) out.push("two ids of one time and replica share their tail");
  return out;
}

proves(["0007-anyfs-merge-governance FR-002"], "an id has the layout of RFC 9562 section 5.7: 48 bits of milliseconds, version 7, the counter in rand_a, variant 10 and 62 bits, and it sorts as text and as bytes in the order of its time", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.integer({ min: 0, max: 0xfff }), (ms, counter) => layoutProblems(real({ ms, counter }, 0), { ms, counter }).length === 0),
  );
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 8, maxLength: 8 }), (tail) => {
      const id = makeVersionId({ ms: 5, counter: 9 }, tail);
      const hex = tailOf(id);
      // the variant takes the first two bits, the other 62 are the bytes given
      const low = BigInt(`0x${hex}`) & ((1n << 62n) - 1n);
      let want = 0n;
      for (const x of tail) want = (want << 8n) | BigInt(x);
      return low === (want & ((1n << 62n) - 1n));
    }),
  );
  const pair = fc.tuple(fc.integer({ min: 0, max: 2 ** 48 - 1 }), fc.integer({ min: 0, max: 0xfff }));
  fc.assert(
    fc.property(pair, pair, (a, b) => {
      const ta = { ms: a[0], counter: a[1] };
      const tb = { ms: b[0], counter: b[1] };
      if (compareTime(ta, tb) === 0) return true;
      const ia = real(ta, 0);
      const ib = real(tb, 1);
      const bytewise = compareBytes(bytesOf(ia), bytesOf(ib));
      return Math.sign(compareTime(ta, tb)) === (ia < ib ? -1 : 1) && Math.sign(compareTime(ta, tb)) === bytewise;
    }),
  );
  for (const m of mutants.filter((x) => x.name.startsWith("a version") || x.name.startsWith("a variant"))) {
    assert(layoutProblems(m.make({ ms: 1, counter: 1 }, 0), { ms: 1, counter: 1 }).length > 0, `the layout check missed the mutant ${m.name}`);
  }
  assertEquals(layoutProblems(makeVersionId({ ms: 0x018f3a6e7c00, counter: 0xabc }, new Uint8Array(8)), { ms: 0x018f3a6e7c00, counter: 0xabc }), []);
  assertEquals(makeVersionId({ ms: 0x018f3a6e7c00, counter: 0xabc }, new Uint8Array(8).fill(0xff)), "018f3a6e-7c00-7abc-bfff-ffffffffffff");
  assertEquals(makeVersionId({ ms: 0x018f3a6e7c00, counter: 0xabc }, new Uint8Array(8)), "018f3a6e-7c00-7abc-8000-000000000000");
  assertEquals(timeOfId(makeVersionId({ ms: 2 ** 48 - 1, counter: 0xfff })), { ms: 2 ** 48 - 1, counter: 0xfff });
});

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return (a[i] ?? 0) < (b[i] ?? 0) ? -1 : 1;
  return 0;
}

proves(["0007-anyfs-merge-governance FR-010"], "the 62 bits of rand_b are random for each id, from the CSPRNG: the ids of one replica share no tail, every bit varies, and a fixed tail is found by the check", () => {
  assertEquals(tailProblems(real), []);
  for (const m of mutants.filter((x) => x.name.startsWith("a tail"))) assert(tailProblems(m.make).length > 0, `the tail check missed the mutant ${m.name}`);
  assertEquals(randomIdBytes().length, 8);
  assert(randomIdBytes(16).some((x) => x !== 0), "a CSPRNG gives bytes that are not all zero");
  const seeds = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const s = randomCounterSeed();
    assert(s >= 0 && s <= MAX_COUNTER_SEED, `a seed of ${s}`);
    seeds.add(s);
  }
  assert(seeds.size > 50, "the counter seed is random");
});

proves(["0007-anyfs-merge-governance FR-011"], "an id holds no replica: two replicas that make ids by the same clock make ids no more alike than one replica does, and a transaction's rows carry the replica in the field and not in the id", async () => {
  const r1 = replica(1);
  const r2 = replica(2);
  const tails = new Set<string>();
  let s1: MergeState = open(r1);
  let s2: MergeState = open(r2);
  for (let i = 0; i < 40; i++) {
    const a = await putText(s1, `a${i}`, "x", 1000 + i);
    const b = await putText(s2, `b${i}`, "y", 1000 + i);
    s1 = a.state;
    s2 = b.state;
    for (const d of [a.delta, b.delta]) for (const v of d.versions) tails.add(tailOf(v.id));
    for (const v of a.delta.versions) assertEquals(v.replica, r1);
    for (const v of b.delta.versions) assertEquals(v.replica, r2);
  }
  assertEquals(tails.size, 80, "no two of the 80 ids of two replicas share a tail");
  for (const v of s1.versions.values()) assert(!v.id.includes(r1.slice(0, 8)) && !tailOf(v.id).includes(r1.slice(0, 12)), "the replica is not in the id");
});

proves(["0008-anyfs-merge-logical FR-003"], "ids of one replica are strictly increasing, as text and as bytes, under a clock that goes back, a burst in one millisecond and a counter that fills", async () => {
  // the clock: any wall times, with any seeds, strictly increasing, and a time taken from another replica is passed
  fc.assert(
    fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: MAX_COUNTER_SEED })), { minLength: 1, maxLength: 200 }), (steps) => {
      let last: IdTime | undefined;
      let prev: VersionId | undefined;
      for (const [wall, seed] of steps) {
        const t = nextTime(last, wall, seed);
        if (last !== undefined && compareTime(t, last) <= 0) return false;
        if (t.counter > 0xfff || t.ms < wall) return false;
        const id = makeVersionId(t);
        if (prev !== undefined && !(prev < id && compareBytes(bytesOf(prev), bytesOf(id)) < 0)) return false;
        prev = id;
        last = t;
      }
      return true;
    }),
  );
  // a burst of 10000 ids at one wall time: strictly increasing, the counter seeded at random, rolling into the next millisecond
  let last: IdTime | undefined;
  let prev: VersionId | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) {
    const t = nextTime(last, 42, randomCounterSeed());
    const id = makeVersionId(t);
    assert(prev === undefined || prev < id, `id ${i} is not after the last`);
    seen.add(id);
    prev = id;
    last = t;
  }
  assertEquals(seen.size, 10_000);
  assert((last?.ms ?? 0) > 42, "a counter that fills goes on into the next millisecond");
  // a new millisecond starts the counter at the seed and the seed has its top bit clear
  assertEquals(nextTime({ ms: 5, counter: 9 }, 6, 0x123), { ms: 6, counter: 0x123 });
  assertEquals(nextTime({ ms: 5, counter: 9 }, 6, 99_999), { ms: 6, counter: MAX_COUNTER_SEED });
  assertEquals(nextTime({ ms: 5, counter: 0xfff }, 5, 0x10), { ms: 6, counter: 0x10 });
  assertEquals(nextTime({ ms: 9, counter: 3 }, 2, 0x7ff), { ms: 9, counter: 4 }, "a wall clock set back keeps the millisecond and counts on");
  assertEquals(nextTime(seeTime({ ms: 9, counter: 3 }, { ms: 12, counter: 0x800 }), 1, 0), { ms: 12, counter: 0x801 });
  // a replica through its state: ids of its rows are strictly increasing though the wall clock goes back
  let s: MergeState = open(replica(3));
  const ids: VersionId[] = [];
  for (const wall of [5000, 5000, 5000, 4000, 100, 5000, 5001, 5001, 0]) {
    const made = await putText(s, "f", `t${ids.length}`, wall);
    s = made.state;
    for (const v of made.delta.versions) ids.push(v.id);
  }
  for (let i = 1; i < ids.length; i++) assert((ids[i - 1] as VersionId) < (ids[i] as VersionId), `id ${i} is after id ${i - 1}`);
  // the mutant: a clock that does not count within a millisecond makes ids that are not after the last
  const stuck = (l: IdTime | undefined, wall: number): IdTime => ({ ms: Math.max(wall, l?.ms ?? 0), counter: 0 });
  let t0: IdTime | undefined;
  let broke = false;
  for (let i = 0; i < 3; i++) {
    const t = stuck(t0, 10);
    if (t0 !== undefined && compareTime(t, t0) <= 0) broke = true;
    t0 = t;
  }
  assert(broke, "the order check sees a clock that does not count");
});

proves(["0008-anyfs-merge-logical FR-005", "0008-anyfs-merge-logical FR-006"], "the union of the rows of replicas with random ids is the same in any order and any number of times, and the ids of two replicas that meet at one time never collapse", async () => {
  const a0 = open(replica(1));
  const b0 = open(replica(2));
  const c0 = open(replica(3));
  const a1 = await putText(a0, "p", "from a", 1000);
  const b1 = await putText(b0, "p", "from b", 1000);
  const c1 = await putText(c0, "q", "from c", 1000);
  const ids = [a1, b1, c1].map((m) => (m.delta.versions[0] as { id: VersionId }).id);
  assertEquals(new Set(ids).size, 3);
  const deltas: Delta[] = [a1.delta, b1.delta, c1.delta];
  const orders: ReadonlyArray<readonly number[]> = [[0, 1, 2], [2, 1, 0], [1, 0, 2, 1, 0], [2, 0, 1, 2]];
  const texts: string[] = [];
  for (const order of orders) {
    let s = open(replica(9));
    for (const i of order) s = (await applyDelta(s, deltas[i] as Delta, 2000)).state;
    texts.push(stateText(s));
  }
  for (const t of texts) assertEquals(t, texts[0]);
});

function replica(n: number): ReplicaId {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}
function open(r: ReplicaId): MergeState {
  return newState(r, { ...defaultConfig(r), trust: { kind: "open" } });
}
const enc = new TextEncoder();
async function putText(s: MergeState, path: string, text: string, wall: number): Promise<{ readonly state: MergeState; readonly delta: Delta }> {
  const sha = await sha256(enc.encode(text));
  const made = await transact(s, [{ kind: "put", path, blob: sha }], new Map([[sha, enc.encode(text)]]), wall);
  if (made.kind === "err" || made.value.delta === undefined) throw new Error("no row made");
  return { state: made.value.state, delta: made.value.delta };
}
