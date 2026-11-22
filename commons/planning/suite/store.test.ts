/**
 * Tests of the store of events over an AnyFS store (commons planning 0004-planning-sources FR-001): one file for each event, traces and the outbox, loading that is total, the clock after every id, an event never
 * replaced, and two stores merged by the union of their files in any order.
 *
 * @module
 */
import fc from "fast-check";
import { expectAny, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { makePatch, type Capability } from "@intellectual-frontiers/planning/governance";
import { mintEventId, newClock, route } from "@intellectual-frontiers/planning/logical";
import { eventPath } from "@intellectual-frontiers/planning/records";
import { loadStore, mergeInto, outboxPath, tracePath, writeEvents, writeOutbox, writeTraces } from "@intellectual-frontiers/planning/physical";
import { ADA, event, history, itemId, must, OTHER_REPLICA, REPLICA, SAMPLES, stepArb, testClock, WALL } from "./support.ts";
import { emptyWorld, instant, observe, step } from "./world.ts";

const encoder = new TextEncoder();

proves(["0004-planning-sources FR-001"], "events are written one file each at item/event.json5 and never replaced, and load gives the items by fold and the clock after every id", async () => {
  const store = memoryStore({ name: "a", clock: () => 1_700_000_000_000 });
  const events = history(itemId(), "declared", 0, [{ type: 0, actor: 0, a: "alpha", b: "beta", other: 0 }, { type: 9, actor: 1, a: "alpha", b: "beta", other: 0 }]);
  assertEquals(must(await writeEvents(store, events)), events.length);
  assertEquals(must(await writeEvents(store, events)), 0);
  const first = events[0];
  assert(first !== undefined, "an event");
  assert(must(await store.stat(must(parsePath(eventPath(first)))) ) !== undefined, "the file is at item/event.json5");
  const loaded = must(await loadStore(store, { clock: testClock(), wallMs: WALL }));
  assertEquals(loaded.items.map((i) => i.state.kind), ["closed"]);
  assertEquals(loaded.findings, []);
  // the next id is after every id taken
  const last = events.at(-1);
  assert(last !== undefined, "an event");
  const next = must(mintEventId(loaded.clock, WALL));
  assert(next.id > last.id, "the next id is after every id the store holds");
  // an event is never replaced: the same id with other content is refused
  const other = event(first.item, first.id, 9, ADA, SAMPLES.opened);
  assertEquals((await writeEvents(store, [other])).kind, "err");
});

proves(["0004-planning-sources FR-001"], "loading is total: a file that is not of the schema is a finding and is not read, and an id too far ahead of the clock is a finding", async () => {
  const store = memoryStore({ name: "b", clock: () => 1_700_000_000_000 });
  const events = history(itemId(), "declared", 0, []);
  must(await writeEvents(store, events));
  must(await store.write(must(parsePath("junk/x.json5")), encoder.encode("{ not an event"), expectAny));
  must(await store.write(must(parsePath(".traces/s/bad.json5")), encoder.encode("{ schema: 'x' }"), expectAny));
  must(await store.write(must(parsePath(".outbox/bad.json5")), encoder.encode("[]"), expectAny));
  must(await store.write(must(parsePath("readme.txt")), encoder.encode("not json5 at all"), expectAny));
  const loaded = must(await loadStore(store, { clock: testClock(), wallMs: WALL }));
  assertEquals(loaded.items.length, 1);
  assertEquals(loaded.findings.map((f) => f.path).sort(), [".outbox/bad.json5", ".traces/s/bad.json5", "junk/x.json5"]);
  const far = must(await loadStore(store, { clock: newClock(REPLICA, 1000), wallMs: 1_000_000 }));
  assert(far.findings.some((f) => f.message.includes("further ahead")), "an id from the far future is a finding");
});

proves(["0004-planning-sources FR-001"], "traces and the outbox are files of the store that read back as they were written", async () => {
  const store = memoryStore({ name: "c", clock: () => 1_700_000_000_000 });
  const { world } = await step(emptyWorld(), "md", [await observe("md", "fp", "T", { extra: { external: [], at: instant(0) } })]);
  must(await writeEvents(store, world.events));
  assertEquals(must(await writeTraces(store, world.traces)), 1);
  const closed = history(itemId(), "declared", 0, [{ type: 9, actor: 0, a: "alpha", b: "beta", other: 0 }]).at(-1);
  const trace0 = world.traces[0];
  assert(closed !== undefined && trace0 !== undefined, "an event and a trace");
  const patch = must(makePatch("md", "a.md", closed));
  const routed = route(patch, { name: "md", capabilities: new Set<Capability>(["read"]) }, instant(3));
  assert(routed.kind === "outbox", "outbox");
  must(await writeOutbox(store, [routed.entry]));
  const loaded = must(await loadStore(store, { clock: testClock(), wallMs: WALL }));
  assertEquals(loaded.findings, []);
  assertEquals(loaded.traces, world.traces);
  assertEquals(loaded.outbox.map((e) => [e.waiting, e.patch.event.id]), [[routed.entry.waiting, patch.event.id]]);
  assert((await tracePath(trace0)).startsWith(".traces/md/"), "the trace is under .traces");
  assert(outboxPath(routed.entry).startsWith(".outbox/md."), "the outbox entry is under .outbox");
});

proves(["0004-planning-sources FR-001"], "two stores that each made events merge by the union of their files in any order, with the same items, and the next id after a merge is after every id taken", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(stepArb, { maxLength: 6 }), fc.array(stepArb, { maxLength: 6 }), async (a, b) => {
      const item = itemId(5);
      const mk = async (replica: typeof REPLICA, steps: typeof a, offset: number) => {
        const store = memoryStore({ name: `r${offset}`, clock: () => 1_700_000_000_000 });
        // each replica makes its events with its own clock
        let clock = testClock(replica);
        const evs = history(item, "declared", 0, []);
        const opening = evs[0];
        assert(opening !== undefined, "an opening");
        const out = replica === REPLICA ? [opening] : [];
        for (const [i, s] of steps.entries()) {
          const m = must(mintEventId(clock, WALL + 1000 + i + offset * 100_000));
          clock = m.clock;
          out.push(event(item, m.id, i + 1, ADA, { type: "commented", body: `${replica.slice(0, 4)}-${s.a}-${i}` }));
        }
        must(await writeEvents(store, out));
        return store;
      };
      const s1 = await mk(REPLICA, a, 1);
      const s2 = await mk(OTHER_REPLICA, b, 2);
      const x = memoryStore({ name: "x", clock: () => 1_700_000_000_000 });
      const y = memoryStore({ name: "y", clock: () => 1_700_000_000_000 });
      must(await mergeInto(x, s1));
      must(await mergeInto(x, s2));
      must(await mergeInto(y, s2));
      must(await mergeInto(y, s1));
      const lx = must(await loadStore(x, { clock: testClock(), wallMs: WALL + 10_000_000 }));
      const ly = must(await loadStore(y, { clock: testClock(), wallMs: WALL + 10_000_000 }));
      assertEquals(lx.events.map((e) => e.id), ly.events.map((e) => e.id));
      assertEquals(lx.items.map((i) => i.comments.map((c) => c.body)), ly.items.map((i) => i.comments.map((c) => c.body)));
      const top = lx.events.at(-1);
      if (top !== undefined) assert(must(mintEventId(lx.clock, WALL)).id > top.id, "the next id is after every id taken");
    }),
    { numRuns: 25 },
  );
});
