/**
 * The ids, instants and days of Planning and the clock that makes ids (commons planning 0002-planning-core FR-003): smart constructors that return a `Result`, ids minted from the real hybrid clock of AnyFS's
 * merge, the sight of an id from another store and the refusal of one from the far future. The tests also state the layout of the id that AnyFS makes, bit by bit against RFC 9562 section 5.7.
 *
 * @module
 */
import fc from "fast-check";
import { makeVersionId, timeOfId } from "@intellectual-frontiers/anyfs/governance";
import { DEFAULT_MAX_DRIFT, nextTime } from "@intellectual-frontiers/anyfs/merge";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  type EventId,
  externalId,
  idTime,
  type ItemId,
  instantOfMs,
  msOfInstant,
  parseDay,
  parseEventId,
  parseInstant,
  parseItemId,
} from "@intellectual-frontiers/planning/governance";
import { mintEventId, mintItemId, newClock, seeId } from "@intellectual-frontiers/planning/logical";
import { eventIds, must, OTHER_REPLICA, REPLICA, WALL } from "./support.ts";

const V7 = "018f3a6e-7c00-7000-8123-456789abcdef";

proves(["0002-planning-core FR-003"], "an item id and an event id are made only by their smart constructors, which accept a UUID version 7 in lower case and refuse everything else", () => {
  assertEquals<unknown>(parseItemId(V7), { kind: "ok", value: V7 });
  assertEquals<unknown>(parseEventId(V7), { kind: "ok", value: V7 });
  for (const bad of [
    "",
    V7.toUpperCase(),
    V7.replace("-7000-", "-4000-"),
    V7.replace("-8123-", "-c123-"),
    V7.slice(1),
    `${V7} `,
    "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "018f3a6e7c0070008123456789abcdef",
  ]) {
    assert(parseItemId(bad).kind === "err" && parseEventId(bad).kind === "err", bad);
  }
  const itemRefusal = parseItemId("nope");
  assert(itemRefusal.kind === "err" && itemRefusal.error.kind === "not-uuid-v7" && itemRefusal.error.what === "item id");
  fc.assert(fc.property(fc.string(), (s) => (parseItemId(s).kind === "ok") === (parseEventId(s).kind === "ok")), { numRuns: 300 });
});

proves(["0002-planning-core FR-003"], "an id is not a plain string, and an item id is not an event id", () => {
  const item: ItemId = must(parseItemId(V7));
  const event: EventId = must(parseEventId(V7));
  // @ts-expect-error a plain string is not an item id
  const plain: ItemId = V7;
  // @ts-expect-error an event id is not an item id
  const mixed: ItemId = event;
  assertEquals([item, plain, mixed], [V7, V7, V7]);
});

proves(["0002-planning-core FR-003"], "an instant is a real time in UTC to the second and a day is a real day", () => {
  assertEquals<unknown>(parseInstant("2026-11-21T10:00:00Z"), { kind: "ok", value: "2026-11-21T10:00:00Z" });
  assert(parseInstant("2028-02-29T23:59:59Z").kind === "ok");
  for (const bad of ["2026-02-30T10:00:00Z", "2027-02-29T10:00:00Z", "2026-11-21T10:00:00.000Z", "2026-11-21T10:00:00+00:00", "2026-11-21 10:00:00Z", "2026-13-01T00:00:00Z", "2026-11-21T24:00:00Z", ""]) {
    assert(parseInstant(bad).kind === "err", bad);
  }
  assertEquals<string>(must(instantOfMs(Date.UTC(2026, 10, 21, 10, 0, 0, 999))), "2026-11-21T10:00:00Z");
  assertEquals(msOfInstant(must(parseInstant("2026-11-21T10:00:00Z"))), Date.UTC(2026, 10, 21, 10));
  assert(instantOfMs(Number.NaN).kind === "err" && instantOfMs(-1).kind === "err");
  assertEquals<unknown>(parseDay("2028-02-29"), { kind: "ok", value: "2028-02-29" });
  for (const bad of ["2027-02-29", "2026-11-31", "2026-11-21T00:00:00Z", "21-11-2026", ""]) assert(parseDay(bad).kind === "err", bad);
  fc.assert(
    fc.property(fc.date({ min: new Date("1971-01-01T00:00:00Z"), max: new Date("2200-01-01T00:00:00Z"), noInvalidDate: true }), (d) => {
      const instant = must(instantOfMs(d.getTime()));
      return msOfInstant(instant) === Math.floor(d.getTime() / 1000) * 1000;
    }),
  );
});

proves(["0002-planning-core FR-003"], "an external id is a source's name and a value, and is refused where either is empty, too long or holds a control character", () => {
  assertEquals(externalId("event-files", "01ARZ3NDEKTSV4RRFFQ69G5FAV"), { kind: "ok", value: { source: "event-files", value: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } });
  for (const [s, x] of [["", "x"], ["x", ""], ["x".repeat(65), "y"], ["x", "y".repeat(257)], ["x", "a\nb"], ["a\u0000", "b"]] as const) assert(externalId(s, x).kind === "err");
});

proves(["0002-planning-core FR-003"], "an id is minted from the hybrid clock of the merge of AnyFS, as that clock makes it, and every id after every id seen or made", () => {
  const made = must(mintEventId(newClock(REPLICA), WALL));
  const time = nextTime(undefined, WALL);
  assertEquals<string>(made.id, makeVersionId(time, REPLICA));
  assertEquals(made.clock.last, time);
  assertEquals(idTime(made.id), time);
  assertEquals(timeOfId(makeVersionId(time, REPLICA)), time);
  const item = must(mintItemId(made.clock, WALL));
  assert(String(item.id) > String(made.id), "the next id is after the last");
  fc.assert(
    fc.property(fc.array(fc.integer({ min: WALL - 5000, max: WALL + 5000 }), { minLength: 1, maxLength: 60 }), (walls) => {
      // The wall clock goes back and forth: the ids still never go back and never repeat.
      let c = newClock(REPLICA);
      const out: string[] = [];
      for (const w of walls) {
        const m = must(mintEventId(c, w));
        c = m.clock;
        out.push(m.id);
      }
      return out.every((id, i) => i === 0 || id > (out[i - 1] ?? "")) && new Set(out).size === out.length;
    }),
    { numRuns: 200 },
  );
});

proves(["0002-planning-core FR-003"], "a full counter moves to the next millisecond and ids stay in order across the overflow", () => {
  const ids = eventIds(4100);
  for (let i = 1; i < ids.length; i++) assert((ids[i] ?? "") > (ids[i - 1] ?? ""));
  assertEquals(new Set(ids).size, 4100);
  assertEquals(idTime(ids[4095] ?? ids[0] as EventId).counter, 4095);
  assertEquals(idTime(ids[4096] ?? ids[0] as EventId), { ms: WALL + 1, counter: 0 });
});

proves(["0002-planning-core FR-003"], "after an id is taken from another store the next id made is after it, and after every id of any order of ids taken", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 0, max: 200 }), { minLength: 1, maxLength: 20 }), fc.integer({ min: 0, max: 50 }), (offsets, local) => {
      const remote = offsets.map((o) => must(mintEventId(newClock(OTHER_REPLICA), WALL + o * 1000)).id);
      let c = newClock(REPLICA);
      for (const id of remote) c = must(seeId(c, id, WALL));
      const next = must(mintEventId(c, WALL + local));
      return remote.every((id) => next.id > id);
    }),
    { numRuns: 200 },
  );
});

proves(["0002-planning-core FR-003"], "an id whose time is further ahead of the wall time than the limit is refused when taken, and one at the limit is taken", () => {
  const far = must(mintEventId(newClock(OTHER_REPLICA), WALL + DEFAULT_MAX_DRIFT + 1)).id;
  const refusal = seeId(newClock(REPLICA), far, WALL);
  assert(refusal.kind === "err" && refusal.error.kind === "future-id" && refusal.error.aheadByMs === DEFAULT_MAX_DRIFT + 1 && refusal.error.limitMs === DEFAULT_MAX_DRIFT);
  const edge = must(mintEventId(newClock(OTHER_REPLICA), WALL + DEFAULT_MAX_DRIFT)).id;
  assert(seeId(newClock(REPLICA), edge, WALL).kind === "ok");
  const tight = newClock(REPLICA, 1000);
  assert(seeId(tight, must(mintEventId(newClock(OTHER_REPLICA), WALL + 1001)).id, WALL).kind === "err");
  assert(seeId(tight, must(mintEventId(newClock(OTHER_REPLICA), WALL + 1000)).id, WALL).kind === "ok");
});

/** The fields of a UUID read as RFC 9562 section 5.7 draws them: 48 bits of `unix_ts_ms`, 4 of version, 12 of `rand_a`, 2 of variant and 62 of `rand_b`. */
function fieldsOf(id: string) {
  const bits = BigInt(`0x${id.replaceAll("-", "")}`);
  return { ms: Number(bits >> 80n), version: Number((bits >> 76n) & 0xfn), randA: Number((bits >> 64n) & 0xfffn), variant: Number((bits >> 62n) & 0x3n), randB: bits & ((1n << 62n) - 1n) };
}

proves(["0002-planning-core FR-003"], "the id that AnyFS makes is a valid UUID version 7 of RFC 9562 section 5.7, and differs from its wording in three stated ways", () => {
  const ids = eventIds(6);
  const f = ids.map(fieldsOf);
  for (const x of f) {
    assertEquals(x.version, 7);
    assertEquals(x.variant, 0b10);
  }
  // unix_ts_ms is the time of the id, and rand_a holds the counter (Method 1 of section 6.2, immediately after the timestamp).
  assertEquals(f.map((x) => x.ms), Array(6).fill(WALL));
  assertEquals(f.map((x) => x.randA), [0, 1, 2, 3, 4, 5]);
  // Difference 1: rand_b is not random for each id (section 5.7): it is the same 62 bits of the replica's id in every id the replica makes.
  assertEquals(new Set(f.map((x) => x.randB)).size, 1);
  assertEquals(f[0]?.randB, BigInt(`0x${REPLICA.slice(0, 16)}`) & ((1n << 62n) - 1n));
  // Two replicas share the time and the counter and differ only in rand_b.
  const other = fieldsOf(eventIds(1, OTHER_REPLICA)[0] ?? "");
  assert(other.ms === f[0]?.ms && other.randA === f[0]?.randA && other.randB !== f[0]?.randB);
  // Difference 2: the counter starts at zero in each new millisecond; section 6.2 (Fixed Bit-Length Dedicated Counter Seeding) has it randomly initialized with each new timestamp tick.
  assertEquals(fieldsOf(must(mintEventId(newClock(REPLICA), WALL + 1)).id).randA, 0);
  // Difference 3: the counter is incremented by 1, which section 6.2 (Monotonic Random) says SHOULD NOT be used by implementations that favor unguessability; and the node's identity is in rand_b of a version 7, where section 6.4 would put it in a version 8.
  assert((f[1]?.randA ?? 0) - (f[0]?.randA ?? 0) === 1);
});
