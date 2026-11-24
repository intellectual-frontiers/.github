/**
 * Tests of the exchange (commons anyfs-bridge 0007-bridge-exchange FR-001 to FR-011): replicas that publish their rows as delta files written once and take the files of the others through a medium that only reads, writes
 * and lists end with the same files whatever the order and however often; a file that is not what its name says, or is not from the directory's replica, is put aside; a file that waits is kept by the replica; a replica
 * that is away comes back; the vectors and the pruning; and the checks that hold all this are held by tests that break them.
 *
 * @module
 */
import fc from "fast-check";
import { err } from "@intellectual-frontiers/core";
import { expectAny, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, type OpCapability } from "@intellectual-frontiers/anyfs/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { deltaPath, memoryCursor, type Mergeable, parseDeltaPath, publishOwn, publishVector, pruneDeltas, readVectors, syncThrough, type ExchangeOptions } from "../src/exchange/mod.ts";
import { encodeDelta, deltaId } from "@intellectual-frontiers/anyfs/merge";
import { memoryMergeStore } from "@intellectual-frontiers/anyfs/memory-merge";
import { listing, medium, members, type Member, path, remove, write } from "./exchange.ts";

const options = (m: Member, store: ReturnType<typeof medium>, more: Partial<ExchangeOptions> = {}): ExchangeOptions => ({ self: m.self, replica: m.r.store as Mergeable, medium: store, cursor: m.cursor, ...more });
const sync = async (m: Member, store: ReturnType<typeof medium>, more: Partial<ExchangeOptions> = {}) => {
  const r = await syncThrough(options(m, store, more));
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0007-bridge-exchange FR-001", "0007-bridge-exchange FR-002", "0007-bridge-exchange FR-003"], "a replica publishes its rows as delta files named by whose, which rows and what they are, written once; nothing else is written; a second publication writes nothing", async () => {
  const [a] = members(1);
  const m = medium();
  await write(a as Member, "x.txt", "one");
  await write(a as Member, "y.txt", "two");
  const first = await sync(a as Member, m);
  assertEquals(first.published.length, 1);
  assertEquals(first.published[0]?.versions, 2);
  const files = await listing(m);
  assertEquals(files.length, 1);
  const name = parseDeltaPath(files[0] as string);
  assert(name.kind === "ok" && name.value.replica === (a as Member).self && name.value.from === 1 && name.value.to === 2);
  const again = await sync(a as Member, m);
  assertEquals([again.published.length, again.pulled.applied], [0, 0]);
  assertEquals((await listing(m)).length, 1);
});

proves(["0007-bridge-exchange FR-003"], "rows are split into files of at most the rows allowed, in the order of their numbers, and a file that is already there is the same file and not an error", async () => {
  const [a] = members(1);
  const m = medium();
  for (let i = 0; i < 5; i++) await write(a as Member, `f${i}.txt`, `v${i}`);
  const r = await sync(a as Member, m, { maxRows: 2 });
  assertEquals(r.published.map((p) => p.versions), [2, 2, 1]);
  const names = (await listing(m)).map((f) => parseDeltaPath(f));
  assertEquals(names.map((n) => (n.kind === "ok" ? [n.value.from, n.value.to] : [])), [[1, 2], [3, 4], [5, 5]]);
  // a cursor that is lost publishes the same files again: they are there already
  const lost = { ...(a as Member), cursor: memoryCursor() };
  const again = await sync(lost, m, { maxRows: 2 });
  assertEquals(again.published.map((p) => p.alreadyThere), [true, true, true]);
  assertEquals((await listing(m)).length, 3);
});

proves(["0007-bridge-exchange FR-004", "0007-bridge-exchange FR-007"], "the cursor is the replica's own and never on the medium; a lost cursor costs time and changes nothing", async () => {
  const [a, b] = members(2) as [Member, Member];
  const m = medium();
  await write(a, "x.txt", "one");
  await sync(a, m);
  await sync(b, m);
  const files = await listing(m);
  assert(files.every((f) => f.startsWith("deltas/")), "only deltas are on the medium");
  const before = b.r.viewText();
  const fresh = { ...b, cursor: memoryCursor() };
  const r = await sync(fresh, m);
  assertEquals([r.pulled.applied, r.pulled.duplicates], [0, 1]);
  assertEquals(b.r.viewText(), before);
});

proves(["0007-bridge-exchange FR-005"], "a file that is not what its name says, one that is in the directory of another replica and one with a row of another replica are put aside, and nothing of them is taken", async () => {
  const [a, b, c] = members(3) as [Member, Member, Member];
  const m = medium();
  await write(a, "x.txt", "one");
  const made = await publishOwn(options(a, m), { published: 0, applied: [], quarantined: [] });
  assert(made.kind === "ok");
  const [file] = await listing(m);
  const name = parseDeltaPath(file as string);
  assert(name.kind === "ok");
  const delta = await a.r.store.deltaSince({});
  assert(delta.kind === "ok");
  const text = new TextEncoder().encode(encodeDelta(delta.value));
  // 1: the name is not the identity of the text
  const wrongId = deltaPath({ replica: a.self, from: 1, to: 1, id: "0".repeat(64) });
  assert(wrongId.kind === "ok");
  await m.write(wrongId.value, text, expectAny);
  // 2: the directory is another replica's
  const id = await deltaId(delta.value);
  const elsewhere = deltaPath({ replica: c.self, from: 1, to: 1, id });
  assert(elsewhere.kind === "ok");
  await m.write(elsewhere.value, text, expectAny);
  const r = await sync(b, m);
  assertEquals(r.pulled.aside.map((x) => x.kind), ["quarantined", "quarantined"]);
  assertEquals(r.pulled.applied, 1);
  assertEquals(b.r.viewText(), a.r.viewText());
  const second = await sync(b, m);
  assertEquals(second.pulled.aside.length, 0, "what was put aside is not tried again");
});

proves(["0007-bridge-exchange FR-006"], "a file that waits for rows is kept by the replica and counted as deferred, then taken when the rows come; a trust that may change is refused and tried again; a file that is not a delta is put aside for good", async () => {
  const [a, b, c] = members(3) as [Member, Member, Member];
  const m = medium();
  await write(a, "p.txt", "one");
  await sync(b, m, { pull: false });
  await sync(a, m, { pull: false });
  await sync(b, m); // b takes a's rows and writes a child
  await write(b, "p.txt", "two");
  await sync(b, m);
  // c takes only what b published at first: remove a's file for c to see its child alone
  const aFiles = (await listing(m)).filter((f) => f.includes(`/${a.self}/`));
  const saved: [string, Uint8Array][] = [];
  for (const f of aFiles) {
    const r = await m.read(path(f));
    assert(r.kind === "ok");
    saved.push([f, r.value.bytes]);
    await m.delete(path(f), expectAny);
  }
  const first = await sync(c, m);
  assertEquals(first.pulled.deferred, 1);
  for (const [f, bytes] of saved) await m.write(path(f), bytes, expectAny);
  const second = await sync(c, m);
  assertEquals(second.pulled.applied >= 1, true);
  assertEquals(c.r.viewText(), b.r.viewText());
  assertEquals(c.r.pending(), 0);
  // a replica that trusts itself alone refuses and tries again
  const [x, y] = members(2, false) as [Member, Member];
  const m2 = medium();
  await write(x, "q.txt", "one");
  await sync(x, m2);
  const r1 = await sync(y, m2);
  const r2 = await sync(y, m2);
  assertEquals([r1.pulled.aside.map((s) => s.kind), r2.pulled.aside.map((s) => s.kind)], [["refused"], ["refused"]]);
  // a file that is not a delta
  const junk = deltaPath({ replica: x.self, from: 1, to: 1, id: "a".repeat(64) });
  assert(junk.kind === "ok");
  await m2.write(junk.value, new TextEncoder().encode("not json"), expectAny);
  const r3 = await sync(y, m2);
  assert(r3.pulled.aside.some((s) => s.kind === "quarantined"));
  const r4 = await sync(y, m2);
  assertEquals(r4.pulled.aside.filter((s) => s.kind === "quarantined").length, 0);
});

proves(["0007-bridge-exchange FR-008"], "replicas that exchange through a medium in any order, with repeats and an absent replica, end with the files of the merge of all of them", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 4 }),
      fc.array(fc.record({ who: fc.nat(3), op: fc.constantFrom("put", "remove"), file: fc.constantFrom("a", "b", "c", "d/e"), body: fc.string({ maxLength: 6 }) }), { minLength: 1, maxLength: 24 }),
      fc.array(fc.nat(3), { maxLength: 30 }),
      async (n, ops, schedule) => {
        const ms = members(n);
        const m = medium();
        let i = 0;
        for (const o of ops) {
          const who = ms[o.who % n] as Member;
          if (o.op === "put") await write(who, o.file, o.body);
          else await remove(who, o.file).catch(() => undefined);
          const s = schedule[i++];
          if (s !== undefined) await sync(ms[s % n] as Member, m);
        }
        for (let round = 0; round < 3; round++) for (const who of ms) await sync(who, m);
        const merged = members(1)[0] as Member;
        void merged;
        const texts = new Set(ms.map((x) => x.r.viewText()));
        assertEquals(texts.size, 1, "every replica holds the same files");
        const hist = new Set(ms.map((x) => x.r.stateText()));
        assertEquals(hist.size, 1, "every replica holds the same rows");
      },
    ),
    { numRuns: 40 },
  );
});

proves(["0007-bridge-exchange FR-009"], "a replica publishes its vector and the vectors can be read; pruning needs every replica of the roster to have published and removes only the files within the horizon", async () => {
  const [a, b] = members(2) as [Member, Member];
  const m = medium();
  await write(a, "x.txt", "one");
  await write(b, "y.txt", "two");
  await sync(a, m);
  await sync(b, m);
  await sync(a, m);
  await publishVector(options(a, m));
  const some = await readVectors(m);
  assert(some.kind === "ok" && Object.keys(some.value).length === 1);
  const refused = await pruneDeltas(m, [a.self, b.self]);
  assert(refused.kind === "err" && refused.error.kind === "roster");
  assertEquals((await listing(m)).filter((f) => f.startsWith("deltas/")).length, 2);
  await publishVector(options(b, m));
  const pruned = await pruneDeltas(m, [a.self, b.self]);
  assert(pruned.kind === "ok");
  assertEquals(pruned.kind === "ok" ? pruned.value.removed.length : -1, 2);
  // rows made after the horizon are kept
  await write(a, "z.txt", "three");
  await sync(a, m);
  const again = await pruneDeltas(m, [a.self, b.self]);
  assert(again.kind === "ok" && again.value.removed.length === 0);
  assertEquals((await listing(m)).filter((f) => f.startsWith("deltas/")).length, 1);
});

proves(["0007-bridge-exchange FR-010"], "a synchronization that is interrupted in the middle of publishing leaves complete files only, and the next one finishes; a file that is not complete is put aside", async () => {
  const [a, b] = members(2) as [Member, Member];
  const m = medium();
  for (let i = 0; i < 6; i++) await write(a, `f${i}.txt`, `v${i}`);
  let writes = 0;
  const caps = [...m.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
  const breaking = makeStore({
    id: "breaking",
    place: m.place,
    consistency: m.consistency,
    traits: m.traits,
    capabilities: caps,
    handle: async (op) => (op.op === "write" && ++writes === 3 ? err(unavailable("the medium went away", true)) : m.handle(op)),
  });
  const first = await syncThrough({ self: a.self, replica: a.r.store as Mergeable, medium: breaking as never, cursor: a.cursor, maxRows: 2 });
  assert(first.kind === "err" && first.error.kind === "medium");
  assertEquals((await listing(m)).length, 2, "two complete files and no half of a third");
  const second = await sync(a, m, { maxRows: 2 });
  assertEquals((await listing(m)).length, 3);
  assertEquals(second.published.length, 3);
  await sync(b, m);
  assertEquals(b.r.viewText(), a.r.viewText());
  // a file a medium shows half written is not taken
  const [file] = await listing(m);
  const r = await m.read(path(file as string));
  assert(r.kind === "ok");
  const half = deltaPath({ replica: a.self, from: 99, to: 99, id: "b".repeat(64) });
  assert(half.kind === "ok");
  await m.write(half.value, r.value.bytes.slice(0, 40), expectAny);
  const taken = await sync(b, m);
  assert(taken.pulled.aside.some((s) => s.kind === "quarantined"));
});

proves(["0007-bridge-exchange FR-011"], "the suite fails, with a sentence, for an exchange that does not check a file's name and origin and for a replica that trusts everyone", async () => {
  const mislabelled = async (checks: "all" | "none"): Promise<void> => {
    const [a, b] = members(2) as [Member, Member];
    const m = medium();
    await write(a, "x.txt", "one");
    const delta = await a.r.store.deltaSince({});
    assert(delta.kind === "ok");
    const wrong = deltaPath({ replica: a.self, from: 1, to: 1, id: "0".repeat(64) });
    assert(wrong.kind === "ok");
    await m.write(wrong.value, new TextEncoder().encode(encodeDelta(delta.value)), expectAny);
    await sync(b, m, { checks });
    assertEquals(b.r.viewText(), "", "a file that is not what its name says is not taken");
  };
  await mislabelled("all");
  let failed = "";
  try {
    await mislabelled("none");
  } catch (e) {
    failed = e instanceof Error ? e.message : String(e);
  }
  assert(failed.length > 0, "the check of the name is held by a test that fails without it");
  const untrusted = async (takesAnyone: boolean): Promise<void> => {
    const [a, b0] = members(2, false) as [Member, Member];
    const b = takesAnyone ? { ...b0, r: memoryMergeStore({ name: "open", replica: b0.self, trust: { kind: "open" } }) } : b0;
    const m = medium();
    await write(a, "x.txt", "one");
    await sync(a, m);
    await sync(b, m);
    assertEquals(b.r.viewText(), "", "a replica takes changes only from whom it trusts");
  };
  await untrusted(false);
  let taken = "";
  try {
    await untrusted(true);
  } catch (e) {
    taken = e instanceof Error ? e.message : String(e);
  }
  assert(taken.length > 0, "the trust of a replica is held by a test that fails for one that takes anyone");
});
