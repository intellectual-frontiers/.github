/**
 * Tests of the conformance of the mirrored store (commons anyfs-mirror 0005-mirror-conformance FR-001 to FR-003): the mirror passes every case of the conformance suite of AnyFS that its capabilities name, with a Git
 * branch as the primary and a SQLite file as the secondary and with the stores the other way round, and a mirror of any backends keeps its stores the same.
 *
 * @module
 */
import { casesFor, runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { type CoreCapability, expectAny } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { mirrorStore } from "../src/mod.ts";
import { bytes, core, Folders, folder, good, gitBranch, memory, p, snapshot, sqliteFile } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

proves(["0005-mirror-conformance FR-001"], "a mirror of a Git branch and a SQLite file passes every case its capabilities name, and so does a mirror whose primary is the SQLite file", async () => {
  const folders = new Folders();
  try {
    const gitFirst = async (): Promise<Store<CoreCapability>> => {
      const { ref } = await gitBranch(folders);
      const m = good(await mirrorStore({ primary: ref.store, secondaries: [await sqliteFile(`${await folders.make("sqlite")}/m.db`)] }), "mirror");
      return m.store;
    };
    const sample = await gitFirst();
    const reports = await runConformance(gitFirst);
    assertEquals(failures(reports), [], "git first");
    assertEquals(reports.length, casesFor(sample.capabilities).length);
    assert(reports.length >= 18, "the cases that need cas, batch, rename and history are run");
    const sqlFirst = async (): Promise<Store<CoreCapability>> => {
      const { ref } = await gitBranch(folders);
      const primary = await sqliteFile(`${await folders.make("sqlite")}/p.db`);
      const m = good(await mirrorStore({ primary, secondaries: [core(ref.store, "git secondary")] }), "mirror");
      return core(m.store, "mirror core");
    };
    assertEquals(failures(await runConformance(sqlFirst)), [], "sqlite first");
  } finally {
    await folders.done();
  }
});

proves(["0005-mirror-conformance FR-002", "0004-mirror-store FR-010"], "a mirror of memory, a folder and a SQLite file, in any order, keeps its stores the same", async () => {
  const folders = new Folders();
  try {
    const members = async (): Promise<readonly [string, Store<CoreCapability>][]> => [
      ["memory", memory("m")],
      ["folder", await folder(folders)],
      ["sqlite", await sqliteFile(`${await folders.make("sqlite")}/o.db`)],
    ];
    const order = [[0, 1, 2], [2, 0, 1], [1, 2, 0]] as const;
    for (const o of order) {
      const all = await members();
      const [first, ...rest] = o.map((i) => all[i]?.[1] as Store<CoreCapability>);
      const m = good(await mirrorStore({ primary: first as Store<CoreCapability>, secondaries: rest }), "mirror");
      assertEquals(failures(await runConformance(async () => core(good(await mirrorStore({ primary: memory("p"), secondaries: [memory("s")] }), "inner").store, "inner core"))), []);
      for (const n of ["x", "y/z", "y/w"]) good(await m.store.write(p(n), bytes(n), expectAny), n);
      assertEquals(good(await m.verify(), "verify").every((d) => d.missing.length + d.different.length + d.extra.length === 0), true);
      for (const s of rest) assertEquals(await snapshot(s), await snapshot(first as Store<CoreCapability>));
    }
  } finally {
    await folders.done();
  }
});

proves(["0005-mirror-conformance FR-003"], "the secondary proves the mirror: after the writes, a SQLite file read by a new connection holds the paths and revisions of the Git branch, and it is rebuilt from the branch after it is lost", async () => {
  const folders = new Folders();
  try {
    const { ref } = await gitBranch(folders);
    const dir = await folders.make("sqlite");
    const file = `${dir}/mirror.db`;
    const m = good(await mirrorStore({ primary: ref.store, secondaries: [await sqliteFile(file)] }), "mirror");
    for (let i = 0; i < 25; i++) good(await m.store.write(p(`fleet/host-${String(i).padStart(2, "0")}.json5`), bytes(`{ n: ${i} }`), expectAny), "write");
    good(await m.store.delete(p("fleet/host-03.json5"), expectAny), "delete");
    const branch = await snapshot(core(ref.store, "branch"));
    assertEquals(branch.length, 24);
    assertEquals(await snapshot(await sqliteFile(file)), branch);
    // the file is lost: a new one is made whole from the branch by one reconcile
    const rebuilt = await sqliteFile(`${dir}/rebuilt.db`);
    const m2 = good(await mirrorStore({ primary: ref.store, secondaries: [rebuilt] }), "second mirror");
    assertEquals(good(await m2.verify(), "verify")[0]?.missing.length, 24);
    good(await m2.reconcile(), "reconcile");
    assertEquals(await snapshot(await sqliteFile(`${dir}/rebuilt.db`)), branch);
  } finally {
    await folders.done();
  }
});
