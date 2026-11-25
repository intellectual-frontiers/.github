/**
 * Tests of the mirrored store (commons anyfs-mirror 0004-mirror-store FR-001 to FR-011), with a branch of a real Git repository as the primary and a real SQLite file as a secondary: what the primary takes the
 * secondaries hold at the same revision, reads come from the primary, its expectations decide, a secondary that fails is recorded and never stops the primary, and a drift is found and made good.
 *
 * @module
 */
import { type Capability, expectAbsent, expectAny, expectRev, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { mirrorStore } from "../src/mod.ts";
import { bytes, core, flaky, Folders, folder, git, good, gitBranch, memory, p, snapshot, sqliteFile, text } from "./kit.ts";

/** A mirror of a Git branch and a SQLite file, and the two stores to look at them by. */
async function pair(folders: Folders, policy?: "record" | "report") {
  const { ref, dir } = await gitBranch(folders);
  const file = `${await folders.make("sqlite")}/mirror.db`;
  const secondary = await sqliteFile(file);
  const m = good(await mirrorStore({ primary: ref.store, secondaries: [secondary], ...(policy === undefined ? {} : { policy: { onSecondaryFailure: policy } }) }), "mirror");
  return { ref, dir, file, secondary, m, primary: core(ref.store, "primary core") };
}

proves(["0004-mirror-store FR-001", "0004-mirror-store FR-002"], "a mirror needs a secondary, every store has its own id, and a secondary that folds case cannot follow a primary that does not", async () => {
  const folders = new Folders();
  try {
    const { ref } = await gitBranch(folders);
    assertEquals((await mirrorStore({ primary: ref.store, secondaries: [] })).kind, "err");
    const twice = await mirrorStore({ primary: ref.store, secondaries: [memory("a"), memory("a")] });
    assertEquals(twice.kind === "err" && twice.error.includes("a is given twice"), true);
    const self = await mirrorStore({ primary: ref.store, secondaries: [core(ref.store, "self")] });
    assertEquals(self.kind, "err");
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-003"], "a write through the mirror is held by the branch and by the SQLite file at the same revision, and a read through the mirror is the branch's", async () => {
  const folders = new Folders();
  try {
    const { dir, file, m, primary, secondary } = await pair(folders);
    const w = good(await m.store.write(p("fleet/a.txt"), bytes("alpha"), expectAny), "write");
    good(await m.store.write(p("fleet/b.txt"), bytes("beta"), expectAny), "write b");
    assertEquals(w.created, true);
    const onBranch = await snapshot(primary);
    const inFile = await snapshot(secondary);
    assertEquals(inFile, onBranch);
    assertEquals(onBranch.map((r) => r[0]), ["fleet/a.txt", "fleet/b.txt"]);
    assertEquals(onBranch[0]?.[1], w.rev);
    // the file is read again by a connection of its own, and the branch by Git itself
    assertEquals(await snapshot(await sqliteFile(file)), onBranch);
    assertEquals((await git(dir, "show", "mirror:fleet/a.txt")).trim(), "alpha");
    // a read through the mirror is the primary's: an object only the secondary holds is not there
    good(await secondary.write(p("only-secondary"), bytes("x"), expectAny), "secondary alone");
    assertEquals(good(await m.store.read(p("fleet/a.txt")), "read").rev, w.rev);
    const alone = await m.store.read(p("only-secondary"));
    assertEquals(alone.kind === "err" && alone.error.kind, "missing");
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-004"], "the primary decides: a write that does not hold its expectation is refused, and no secondary changes", async () => {
  const folders = new Folders();
  try {
    const { m, secondary } = await pair(folders);
    const first = good(await m.store.write(p("a"), bytes("1"), expectAbsent), "first");
    const before = await snapshot(secondary);
    const again = await m.store.write(p("a"), bytes("2"), expectAbsent);
    assertEquals(again.kind === "err" && again.error.kind, "conflict");
    const stale = await m.store.write(p("a"), bytes("3"), expectRev(first.rev));
    assertEquals(stale.kind, "ok");
    const wrong = await m.store.write(p("a"), bytes("4"), expectRev(first.rev));
    assertEquals(wrong.kind === "err" && wrong.error.kind, "conflict");
    assertEquals((await snapshot(secondary)).map((r) => r[2]), ["3"]);
    assertEquals(before.map((r) => r[2]), ["1"]);
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-003"], "a delete, a batch, a rename and an append through the mirror are followed by the secondary", async () => {
  const folders = new Folders();
  try {
    const { m, primary, secondary } = await pair(folders);
    const store = m.store;
    assert(store.capabilities.has("batch") && store.capabilities.has("rename") && store.capabilities.has("cas") && store.capabilities.has("history"));
    good(await store.batch([{ kind: "put", path: p("d/one"), bytes: bytes("1"), expect: expectAny }, { kind: "put", path: p("d/two"), bytes: bytes("2"), expect: expectAny }, { kind: "put", path: p("gone"), bytes: bytes("x"), expect: expectAny }]), "batch");
    assertEquals(await snapshot(secondary), await snapshot(primary));
    good(await store.rename(p("d/one"), p("d/uno"), expectAny), "rename");
    good(await store.delete(p("gone"), expectAny), "delete");
    assertEquals((await snapshot(secondary)).map((r) => r[0]), ["d/two", "d/uno"]);
    assertEquals(await snapshot(secondary), await snapshot(primary));
    assertEquals(text(good(await secondary.read(p("d/uno")), "moved").bytes), "1");
    // history is the primary's
    assertEquals(good(await store.history(p("d/two")), "history").versions.length, 1);
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-005"], "a secondary that does not take a change is recorded as lagging and never stops the primary, the report policy says so, and the next change it takes clears the lag", async () => {
  const folders = new Folders();
  try {
    for (const policy of ["record", "report"] as const) {
      const { ref } = await gitBranch(folders);
      const down = { value: false };
      const replica = flaky(memory(`replica-${policy}`), down);
      const m = good(await mirrorStore({ primary: ref.store, secondaries: [replica], policy: { onSecondaryFailure: policy } }), "mirror");
      good(await m.store.write(p("a"), bytes("1"), expectAny), "first");
      down.value = true;
      const w = await m.store.write(p("a"), bytes("2"), expectAny);
      if (policy === "record") assertEquals(w.kind, "ok");
      else assertEquals(w.kind === "err" && w.error.kind === "unavailable" && w.error.detail.includes("took the change"), true);
      // the primary has it either way
      assertEquals(text(good(await ref.store.read(p("a")), "primary").bytes), "2");
      assertEquals(m.lag().map((l) => [l.member, l.path]), [[replica.id, p("a")]]);
      down.value = false;
      good(await m.store.write(p("a"), bytes("3"), expectAny), "after");
      assertEquals(m.lag(), []);
      assertEquals(text(good(await replica.read(p("a")), "replica").bytes), "3");
    }
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-006", "0002-mirror-governance FR-005"], "verify finds a secondary that was changed behind the mirror, by revision, and reconcile makes it the same, a lagging path included", async () => {
  const folders = new Folders();
  try {
    const { m, primary, secondary } = await pair(folders);
    for (const n of ["a", "b", "c"]) good(await m.store.write(p(n), bytes(n), expectAny), n);
    assertEquals(good(await m.verify(), "verify").map((d) => d.missing.length + d.different.length + d.extra.length), [0]);
    // behind the mirror's back: a changed, b removed, z added
    good(await secondary.write(p("a"), bytes("changed"), expectAny), "change");
    good(await secondary.delete(p("b"), expectAny), "remove");
    good(await secondary.write(p("z"), bytes("extra"), expectAny), "add");
    const drift = good(await m.verify(), "verify")[0];
    assertEquals([drift?.missing, drift?.different, drift?.extra], [[p("b")], [p("a")], [p("z")]]);
    const done = good(await m.reconcile(), "reconcile")[0];
    assertEquals([done?.copied, done?.removed, done?.failed], [[p("a"), p("b")], [p("z")], []]);
    assertEquals(await snapshot(secondary), await snapshot(primary));
    assertEquals(good(await m.verify(), "verify again").every((d) => d.missing.length + d.different.length + d.extra.length === 0), true);
    // a secondary opened empty on a primary that already has objects is made whole by one reconcile
    const fresh = memory("fresh");
    const m2 = good(await mirrorStore({ primary: m.store, secondaries: [fresh] }), "second mirror");
    assertEquals(good(await m2.verify(), "verify fresh")[0]?.missing.length, 3);
    good(await m2.reconcile(), "reconcile fresh");
    assertEquals(await snapshot(fresh), await snapshot(primary));
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-007"], "the capabilities of a mirror are the primary's, but a merge, a watch and a lock, and the mirror of a store that merges has no merge", async () => {
  const folders = new Folders();
  try {
    const { m } = await pair(folders);
    const caps: readonly Capability[] = [...m.store.capabilities].sort();
    assertEquals(caps, ["batch", "cas", "delete", "history", "list", "read", "rename", "stat", "write"]);
    assertEquals(m.store.id.startsWith("mirror("), true);
    assertEquals(m.store.consistency, "strong");
    const weaker = good(await mirrorStore({ primary: memory("p"), secondaries: [memory("s")] }), "memory mirror");
    assertEquals([...weaker.store.capabilities].sort(), ["delete", "list", "read", "stat", "write"]);
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-008"], "changes are followed in the order the primary took them, whatever the callers do at once", async () => {
  const folders = new Folders();
  try {
    const { m, primary, secondary } = await pair(folders);
    const writes = Array.from({ length: 12 }, (_, i) => m.store.write(p(i % 2 === 0 ? "even" : "odd"), bytes(`v${i}`), expectAny));
    for (const w of await Promise.all(writes)) assertEquals(w.kind, "ok");
    assertEquals(await snapshot(secondary), await snapshot(primary));
    assertEquals(good(await m.verify(), "verify")[0]?.different, []);
    assertEquals(good(await primary.list(ROOT), "list").entries.length, 2);
  } finally {
    await folders.done();
  }
});

proves(["0004-mirror-store FR-009", "0004-mirror-store FR-010"], "an object that one store would refuse for its size is refused before the primary is touched", async () => {
  const folders = new Folders();
  try {
    const { ref } = await gitBranch(folders);
    const small = good(await mirrorStore({ primary: ref.store, secondaries: [memory("s")] }), "mirror");
    assertEquals(small.store.traits.caseSensitive, true);
    const limit = small.store.traits.maxObject;
    if (limit !== undefined && limit < 10_000_000) {
      const w = await small.store.write(p("big"), new Uint8Array(limit + 1), expectAny);
      assertEquals(w.kind === "err" && w.error.kind, "refused");
      assertEquals((await ref.store.read(p("big"))).kind, "err");
    }
    // any backend follows: a folder and memory and a SQLite file at once
    const all = good(await mirrorStore({ primary: ref.store, secondaries: [await folder(folders), memory("m"), await sqliteFile(`${await folders.make("sqlite")}/x.db`)] }), "three secondaries");
    good(await all.store.write(p("k"), bytes("v"), expectAny), "write");
    assertEquals(good(await all.verify(), "verify").map((d) => d.missing.length + d.different.length + d.extra.length), [0, 0, 0]);
  } finally {
    await folders.done();
  }
});
