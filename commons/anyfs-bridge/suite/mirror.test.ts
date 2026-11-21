/**
 * Tests of the mirrored store (commons anyfs-bridge 0006-bridge-mirrored FR-001 to FR-010): the store has the capabilities of its primary and hides its ledgers; a write goes to the primary and waits for the
 * replicas, which a settlement brings up by the plans of the bridge, again and again to the same result; a replica that fails is behind and never fails a write; a replica that was changed by someone else is
 * diverged and is left as it is; a read says where it was answered; the ledgers are the primary's and outlive the process; a replica becomes the primary only as the bridge allows and only where it has every
 * capability; the events say what happened; and any run of changes ends in replicas equal to the primary.
 *
 * @module
 */
import fc from "fast-check";
import { expectAbsent, expectAny, expectRev, ROOT } from "@intellectual-frontiers/anyfs/governance";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { only, type Store } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { allowDeletes, forbidDeletes } from "../src/governance/mod.ts";
import type { Dest } from "../src/logical/mod.ts";
import { type CoreOf, type Member, type Mirror, type MirrorEvent, type MirrorPolicy, openMirror, parseReplicaName, type ReplicaName } from "../src/mirror/mod.ts";
import { flaky, get, names, p, put } from "./kit.ts";

const name = (text: string): ReplicaName => {
  const r = parseReplicaName(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const policy = (more: Partial<MirrorPolicy> = {}): MirrorPolicy => ({ deletes: allowDeletes(100), fallback: "never", auto: "manual", ...more });
const opened = async <C extends Capability>(primary: Member<Store<C>> & CoreOf<C>, replicas: readonly Member<Dest>[], how: MirrorPolicy): Promise<Mirror<C>> => {
  const r = await openMirror(primary, replicas, how);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const settled = async <C extends Capability>(m: Mirror<C>) => {
  const r = await m.settle();
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0006-bridge-mirrored FR-001"], "the store has the capabilities of its primary and no other, and the type says so", async () => {
  const full = memoryStore({ name: "p" });
  const m = await opened({ name: name("primary"), store: full }, [{ name: name("copy"), store: memoryStore({ name: "r" }) }], policy());
  assertEquals([...m.store.capabilities].sort(), [...full.capabilities].sort());
  assert("batch" in m.store && "rename" in m.store && "history" in m.store);
  const plain = only(memoryStore({ name: "q" }), ["read", "write", "list", "stat", "delete"]);
  const small = await opened({ name: name("primary"), store: plain }, [{ name: name("copy"), store: memoryStore({ name: "r" }) }], policy());
  assertEquals([...small.store.capabilities].sort(), ["delete", "list", "read", "stat", "write"]);
  // @ts-expect-error a store of a primary without batch has no batch
  void small.store.batch;
  // @ts-expect-error nor a revision to expect
  void small.store.write(p("a"), new Uint8Array(), expectRev("sha256:00" as never));
});

proves(["0006-bridge-mirrored FR-002"], "a write goes to the primary and waits; a settlement brings the replica up, and a second one changes nothing", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  const w = await m.store.write(p("fleet/a.json"), new TextEncoder().encode("1"), expectAbsent);
  assert(w.kind === "ok");
  assertEquals(await get(replica, "fleet/a.json"), undefined, "the replica is not written by the write");
  assertEquals((await m.status()).map((s) => s.state.kind), ["behind"]);
  const first = await settled(m);
  assertEquals(first.map((s) => [s.state.kind, s.applied, s.failed]), [["in-sync", 1, 0]]);
  assertEquals(await get(replica, "fleet/a.json"), "1");
  const second = await settled(m);
  assertEquals(second.map((s) => [s.state.kind, s.applied]), [["in-sync", 0]]);
  assertEquals((await m.status()).map((s) => s.state.kind), ["in-sync"]);
  await m.store.delete(p("fleet/a.json"), expectAny);
  assertEquals((await settled(m)).map((s) => s.state.kind), ["in-sync"]);
  assertEquals(await get(replica, "fleet/a.json"), undefined, "a delete reaches the replica where the policy allows it");
});

proves(["0006-bridge-mirrored FR-003"], "a replica that fails never fails a write: it is behind, and it catches up once it is back", async () => {
  const primary = memoryStore({ name: "p" });
  const inner = memoryStore({ name: "r" });
  let down = true;
  const replica = flaky(inner, () => down);
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  for (const f of ["a", "b"]) assert((await m.store.write(p(f), new TextEncoder().encode(f), expectAny)).kind === "ok");
  const s = await settled(m);
  assertEquals(s.map((x) => [x.state.kind, x.reachable]), [["behind", false]]);
  const status = await m.status();
  assertEquals(status.map((x) => [x.state.kind, x.reachable]), [["behind", false]]);
  down = false;
  assertEquals((await settled(m)).map((x) => [x.state.kind, x.applied]), [["in-sync", 2]]);
  assertEquals(await names(inner), ["a", "b"]);
});

proves(["0006-bridge-mirrored FR-004"], "a replica changed by someone else is diverged and is left as it is, whatever the primary does to the path", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  await m.store.write(p("x"), new TextEncoder().encode("one"), expectAny);
  await m.store.write(p("y"), new TextEncoder().encode("y"), expectAny);
  await settled(m);
  await put(replica, "x", "someone else");
  await m.store.write(p("x"), new TextEncoder().encode("two"), expectAny);
  await m.store.write(p("z"), new TextEncoder().encode("z"), expectAny);
  const s = await settled(m);
  assertEquals(s.map((x) => x.state.kind), ["diverged"]);
  const state = s[0]?.state;
  assert(state?.kind === "diverged");
  assertEquals(state.paths, [p("x")]);
  assertEquals(await get(replica, "x"), "someone else", "a diverged path is never overwritten");
  assertEquals(await get(replica, "z"), "z", "what is not diverged is still brought up");
  await m.store.delete(p("x"), expectAny);
  await settled(m);
  assertEquals(await get(replica, "x"), "someone else", "and never deleted");
  assertEquals((await m.status()).map((x) => x.state.kind), ["diverged"]);
});

proves(["0006-bridge-mirrored FR-005"], "a read of the store is the primary's alone; a read of the mirror may be answered by a replica only where the policy says so, and says that it was, by which and what it holds", async () => {
  const inner = memoryStore({ name: "p" });
  let down = false;
  const primary = flaky(inner, (op) => down && (op.op === "read" || op.op === "stat" || op.op === "list"));
  const replica = memoryStore({ name: "r" });
  const never = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ fallback: "never" }));
  await never.store.write(p("a"), new TextEncoder().encode("A"), expectAny);
  await settled(never);
  down = true;
  const a = await never.store.read(p("a"));
  assert(a.kind === "err" && a.error.kind === "unavailable", "the store gives the primary's answer");
  const refused = await never.read(p("a"));
  assert(refused.kind === "err" && refused.error.kind === "unavailable", "fallback never");
  down = false;
  const events: MirrorEvent[] = [];
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ fallback: "unavailable" }));
  m.subscribe((e) => events.push(e));
  const fresh = await m.read(p("a"));
  assert(fresh.kind === "ok" && fresh.value.from === "primary" && !fresh.value.degraded);
  down = true;
  const degraded = await m.read(p("a"));
  assert(degraded.kind === "ok" && degraded.value.degraded);
  assertEquals(degraded.value.degraded && [degraded.value.from, degraded.value.standing], ["copy", "converged"]);
  await put(replica, "a", "changed there");
  const changed = await m.read(p("a"));
  assert(changed.kind === "ok" && changed.value.degraded && changed.value.standing === "diverged");
  down = false;
  await m.store.write(p("b"), new TextEncoder().encode("B"), expectAny);
  await put(replica, "b", "B");
  down = true;
  const unknown = await m.read(p("b"));
  assert(unknown.kind === "ok" && unknown.value.degraded && unknown.value.standing === "unknown");
  const missing = await m.read(p("nothing"));
  assert(missing.kind === "err");
  assert(events.some((e) => e.kind === "degraded-read"));
});

proves(["0006-bridge-mirrored FR-006"], "the ledgers are kept on the primary below a prefix that the store neither lists nor lets be touched, and they outlive the process", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const first = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  await first.store.write(p("a"), new TextEncoder().encode("A"), expectAny);
  await settled(first);
  const raw = await names(primary);
  assert(raw.some((n) => n.startsWith("_mirror-ledger/")), raw.join(","));
  const listed = await first.store.list(ROOT);
  assert(listed.kind === "ok" && listed.value.entries.every((e) => !e.path.startsWith("_mirror-ledger")));
  const touch = await first.store.write(p("_mirror-ledger/copy.json"), new TextEncoder().encode("{}"), expectAny);
  assert(touch.kind === "err" && touch.error.kind === "refused" && touch.error.reason === "outside-scope");
  const read = await first.store.read(p("_mirror-ledger/copy.json"));
  assert(read.kind === "err" && read.error.kind === "refused");
  assertEquals(await names(replica), ["a"], "a ledger is never copied to a replica");
  // a new mirror over the same stores knows what was done
  const second = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  assertEquals((await second.status()).map((s) => s.state.kind), ["in-sync"]);
  assertEquals((await settled(second)).map((s) => s.applied), [0]);
  // a ledger that cannot be read is a problem, never an empty ledger
  await put(primary, "_mirror-ledger/copy.json", "not json");
  const broken = await openMirror({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  assert(broken.kind === "err" && broken.error.kind === "ledger");
});

proves(["0006-bridge-mirrored FR-007"], "the events say what happened, in order, to a listener and to an iterable that ends when the mirror is closed, and a listener that throws is dropped", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ now: () => 7 }));
  const seen: MirrorEvent[] = [];
  const streamed: MirrorEvent[] = [];
  const reading = (async () => {
    for await (const e of m.events()) streamed.push(e);
  })();
  let calls = 0;
  m.subscribe(() => {
    calls++;
    throw new Error("a listener that fails");
  });
  m.subscribe((e) => seen.push(e));
  await m.store.write(p("a"), new TextEncoder().encode("A"), expectAny);
  await settled(m);
  assertEquals(seen.map((e) => e.kind), ["written", "queued", "converged"]);
  assert(seen.every((e) => e.at === 7));
  await m.store.write(p("b"), new TextEncoder().encode("B"), expectAny);
  assertEquals(calls, 1, "a listener that throws is dropped");
  await m.close();
  await reading;
  assertEquals(streamed.map((e) => e.kind), ["written", "queued", "converged", "written", "queued"]);
});

proves(["0006-bridge-mirrored FR-008"], "a replica becomes the primary only as the bridge allows: not behind, not diverged, unless a person accepts the loss; the old primary becomes a replica, and it can be promoted back", async () => {
  const a = memoryStore({ name: "a" });
  const b = memoryStore({ name: "b" });
  const m = await opened({ name: name("ssh"), store: a }, [{ name: name("git"), store: b }], policy());
  await m.store.write(p("x"), new TextEncoder().encode("1"), expectAny);
  const behind = await m.promote(name("git"));
  assert(behind.kind === "err" && behind.error.kind === "refused" && behind.error.refusal.kind === "behind");
  await settled(m);
  const events: MirrorEvent[] = [];
  m.subscribe((e) => events.push(e));
  const done = await m.promote(name("git"));
  assert(done.kind === "ok");
  assertEquals(done.value, { from: name("ssh"), to: name("git"), lost: 0, ledgers: "saved" });
  assertEquals(m.roles(), { primary: name("git"), replicas: [name("ssh")] });
  assert(events.some((e) => e.kind === "promoted"));
  // writes go to the new primary, and the old one is a replica of it
  await m.store.write(p("y"), new TextEncoder().encode("2"), expectAny);
  assertEquals(await get(a, "y"), undefined);
  assertEquals(await get(b, "y"), "2");
  assertEquals((await settled(m)).map((s) => s.state.kind), ["in-sync"]);
  assertEquals(await get(a, "y"), "2");
  assert((await names(b)).some((n) => n.startsWith("_mirror-ledger/")), "the ledgers moved to the new primary");
  assert(!(await names(a)).some((n) => n.startsWith("_mirror-ledger/")), "and are gone from the old one");
  // and back
  const back = await m.promote(name("ssh"));
  assert(back.kind === "ok", JSON.stringify(back));
  assertEquals(m.roles().primary, name("ssh"));
  // a replica that changed on its own is promoted only where the divergence is accepted
  await put(b, "x", "changed on the replica");
  const diverged = await m.promote(name("git"));
  assert(diverged.kind === "err" && diverged.error.kind === "refused" && diverged.error.refusal.kind === "diverged");
  const accepted = await m.promote(name("git"), { acceptDivergence: true });
  assert(accepted.kind === "ok" && accepted.value.lost >= 1);
});

proves(["0006-bridge-mirrored FR-008"], "a replica that lacks a capability of the store is not promoted, and a name that is not a replica is not one", async () => {
  const full = memoryStore({ name: "a" });
  const poor = only(memoryStore({ name: "b" }), ["read", "write", "list", "stat", "delete"]);
  const m = await opened({ name: name("primary"), store: full }, [{ name: name("poor"), store: poor }], policy());
  await settled(m);
  const r = await m.promote(name("poor"));
  assert(r.kind === "err" && r.error.kind === "capability" && r.error.missing.includes("cas"));
  const nobody = await m.promote(name("nobody"));
  assert(nobody.kind === "err" && nobody.error.kind === "unknown-replica");
  assert((await m.settle(name("nobody"))).kind === "err");
});

proves(["0006-bridge-mirrored FR-009"], "after each write a settlement is started and never waited for, many writes make few, and drain waits for them", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ auto: "after-write" }));
  let settlements = 0;
  m.subscribe((e) => {
    if (e.kind === "converged") settlements++;
  });
  for (let i = 0; i < 20; i++) await m.store.write(p(`f${i}`), new TextEncoder().encode(String(i)), expectAny);
  await m.drain();
  assertEquals((await names(replica)).length, 20);
  assert(settlements >= 1 && settlements <= 20, String(settlements));
  assertEquals((await m.status()).map((s) => s.state.kind), ["in-sync"]);
  await m.close();
});

proves(["0006-bridge-mirrored FR-010"], "writers at once through the store keep the revisions of the primary: of two that expect the same revision one conflicts, and a settlement among writes ends in equal stores", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ auto: "after-write" }));
  const first = await m.store.write(p("c"), new TextEncoder().encode("0"), expectAbsent);
  assert(first.kind === "ok");
  const [x, y] = await Promise.all([m.store.write(p("c"), new TextEncoder().encode("x"), expectRev(first.value.rev)), m.store.write(p("c"), new TextEncoder().encode("y"), expectRev(first.value.rev))]);
  assertEquals([x.kind, y.kind].sort(), ["err", "ok"]);
  const lost = x.kind === "err" ? x : y;
  assert(lost.kind === "err" && lost.error.kind === "conflict");
  await Promise.all(Array.from({ length: 30 }, (_, i) => m.store.write(p(`w/${i % 7}`), new TextEncoder().encode(String(i)), expectAny)));
  await m.drain();
  await settled(m);
  const listed = async (s: typeof primary) => Promise.all((await names(s)).filter((n) => !n.startsWith("_mirror")).map(async (n) => [n, await get(s, n)]));
  assertEquals(await listed(replica), await listed(primary));
  await m.close();
});

proves(["0006-bridge-mirrored FR-011"], "the mirror works over a folder and a store in memory alike, and a replica that is a folder holds exactly the files of the primary", async () => {
  const dir = await fs.makeTempDir({ prefix: "anyfs-mirror-" });
  try {
    const root = await fs.realPath(dir);
    const replicaDir = path.join(root, "replica");
    await fs.mkdir(path.join(root, "primary"));
    await fs.mkdir(replicaDir);
    const primary = await localStore(path.join(root, "primary"));
    const replica = await localStore(replicaDir);
    if (primary.kind === "err" || replica.kind === "err") throw new Error("a folder store was not made");
    const m = await opened({ name: name("primary"), store: primary.value }, [{ name: name("copy"), store: replica.value }], policy());
    await m.store.write(p("a/b.txt"), new TextEncoder().encode("hello"), expectAny);
    await settled(m);
    assertEquals(await fs.readTextFile(path.join(replicaDir, "a/b.txt")), "hello");
    assertEquals(fs.readDirSync(path.join(root, "primary")).map((e) => e.name).filter((n) => !n.startsWith(".anyfs-")).sort(), ["_mirror-ledger", "a"]);
    assertEquals(fs.readDirSync(replicaDir).map((e) => e.name).filter((n) => !n.startsWith(".anyfs-")), ["a"]);
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0006-bridge-mirrored FR-012"], "a mirror is refused where the primary lacks a core capability, a name is used twice or the prefix of the ledgers is the root", async () => {
  const mem = memoryStore({ name: "p" });
  const dup = await openMirror({ name: name("a"), store: mem }, [{ name: name("a"), store: memoryStore({ name: "r" }) }], policy());
  assert(dup.kind === "err" && dup.error.kind === "duplicate-name");
  const root = await openMirror({ name: name("a"), store: mem }, [{ name: name("b"), store: memoryStore({ name: "r" }) }], policy({ ledgerPrefix: ROOT }));
  assert(root.kind === "err" && root.error.kind === "bad-prefix");
  const bad = parseReplicaName("has space");
  assertEquals(bad.kind, "err");
});

const OPS = fc.array(
  fc.record({
    side: fc.constantFrom("primary", "settle", "replica"),
    kind: fc.constantFrom("put", "delete"),
    file: fc.constantFrom("a", "b", "c/d", "c/e", "f"),
    body: fc.string({ maxLength: 8 }),
  }),
  { maxLength: 40 },
);

proves(["0006-bridge-mirrored FR-013"], "property: after any run of changes and settlements the replica equals the primary at every path it has not diverged at, a second settlement changes nothing, and a diverged path keeps what the replica had", async () => {
  await fc.assert(
    fc.asyncProperty(OPS, async (ops) => {
      const primary = memoryStore({ name: "p" });
      const replica = memoryStore({ name: "r" });
      const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ deletes: allowDeletes(1000) }));
      const touchedOnReplica = new Map<string, string | undefined>();
      for (const op of ops) {
        const target = p(op.file);
        if (op.side === "settle") await m.settle();
        else if (op.side === "primary") {
          if (op.kind === "put") await m.store.write(target, new TextEncoder().encode(op.body), expectAny);
          else await m.store.delete(target, expectAny);
        } else if (op.kind === "put") {
          await replica.write(target, new TextEncoder().encode(`r:${op.body}`), expectAny);
          touchedOnReplica.set(op.file, `r:${op.body}`);
        } else {
          await replica.delete(target, expectAny);
          touchedOnReplica.set(op.file, undefined);
        }
      }
      await m.settle();
      const status = (await m.status())[0];
      assert(status !== undefined);
      const divergedAt = new Set<string>(status.state.kind === "diverged" ? status.state.paths : []);
      const again = await m.settle();
      assert(again.kind === "ok" && again.value.every((s) => s.applied === 0), "a second settlement changes nothing");
      for (const file of ["a", "b", "c/d", "c/e", "f"]) {
        const there = await get(replica, file);
        const here = await get(primary, file);
        if (!divergedAt.has(file)) assertEquals(there, here, `${file}`);
      }
    }),
    { numRuns: 60 },
  );
});

proves(["0006-bridge-mirrored FR-014"], "a delete is made at a replica only within the allowance, and the plain policy never deletes", async () => {
  const primary = memoryStore({ name: "p" });
  const replica = memoryStore({ name: "r" });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy({ deletes: forbidDeletes }));
  await m.store.write(p("a"), new TextEncoder().encode("A"), expectAny);
  await settled(m);
  await m.store.delete(p("a"), expectAny);
  await settled(m);
  assertEquals(await get(replica, "a"), "A", "a replica of a policy that forbids deletes keeps the file");
  const capped = await opened({ name: name("primary"), store: memoryStore({ name: "p2" }) }, [{ name: name("copy"), store: replica }], policy({ deletes: allowDeletes(0) }));
  const r = await capped.settle();
  assert(r.kind === "ok");
});

proves(["0006-bridge-mirrored FR-003"], "a replica that fails in the middle of a settlement keeps what was done, is behind for the rest, and a later settlement finishes without doing again what was done", async () => {
  const primary = memoryStore({ name: "p" });
  // a replica with no batch: its changes are made one after the other, so that it can fail in the middle
  const inner = only(memoryStore({ name: "r" }), ["read", "write", "list", "stat", "delete"]);
  let dying = false;
  let writes = 0;
  const replica = flaky(inner, (op) => {
    if (!dying || op.op !== "write") return false;
    writes++;
    return writes > 3;
  });
  const m = await opened({ name: name("primary"), store: primary }, [{ name: name("copy"), store: replica }], policy());
  for (let i = 0; i < 8; i++) await m.store.write(p(`f${i}`), new TextEncoder().encode(String(i)), expectAny);
  dying = true;
  const first = await settled(m);
  assertEquals(first.map((s) => [s.state.kind, s.applied, s.failed]), [["behind", 3, 5]]);
  assertEquals((await names(inner)).length, 3);
  dying = false;
  const second = await settled(m);
  assertEquals(second.map((s) => [s.state.kind, s.applied, s.failed]), [["in-sync", 5, 0]]);
  assertEquals((await names(inner)).length, 8);
});
