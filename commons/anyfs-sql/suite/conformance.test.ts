/**
 * Tests of the conformance of the SQL stores (commons anyfs-sql 0006-sql-conformance FR-001 to FR-004): the store passes the laws of AnyFS on each real engine and on the fakes of the clients that need a server (named
 * as fakes here), the laws of the bridge hold between it and the stores of memory and of a folder, a sync from a folder into a database and back gives the folder again, and two processes writing one file are safe.
 *
 * @module
 */
import { casesFor, runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { expectAny, ROOT } from "@intellectual-frontiers/anyfs/governance";
import type { CoreCapability } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { apply, type Dest, prepare } from "@intellectual-frontiers/anyfs-bridge/logical";
import { type MakePair, runBridgeConformance } from "@intellectual-frontiers/anyfs-bridge/conformance";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { openSqliteFile } from "../src/physical/adapters/sqlite.ts";
import { openSqlStore } from "../src/mod.ts";
import { ENGINES, asCore, bytes, libsqlFake, osPath, p, pgFake, sqliteFile, storeOn, text, withTemp } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

proves(["0006-sql-conformance FR-001"], "the store passes every case of the suite its capabilities name, on SQLite, on PostgreSQL in PGlite and on DuckDB, each a real engine", async () => {
  for (const e of ENGINES) {
    const sample = asCore(await storeOn(await e.make()));
    assertEquals([...sample.capabilities].sort(), ["batch", "cas", "delete", "history", "list", "read", "rename", "stat", "write"], e.name);
    const reports = await runConformance(async () => asCore(await storeOn(await e.make())));
    assertEquals(failures(reports), [], e.name);
    assertEquals(reports.length, casesFor(sample.capabilities).length, e.name);
    assert(reports.length >= 18, `${e.name}: the cases that need cas, batch, rename and history are run`);
  }
});

proves(["0006-sql-conformance FR-001"], "the store passes the same cases on the other SQLite module where the runtime has one (node:sqlite under Bun and Node 26 alike)", async () => {
  const bun = typeof Reflect.get(globalThis, "Bun") !== "undefined";
  const other = bun ? "node:sqlite" : "bun:sqlite";
  let module: unknown;
  try {
    module = await import(other);
  } catch {
    return; // this runtime has only its own module: the engine is the same one and the other module is held by the run under the other runtime
  }
  const Database = Reflect.get(module as object, bun ? "DatabaseSync" : "Database") as (new (file: string) => unknown) | undefined;
  if (Database === undefined) return;
  const { sqlitePort } = await import("../src/physical/adapters/sqlite.ts");
  const make = async (): Promise<Store<CoreCapability>> => asCore(await storeOn(sqlitePort(new Database(":memory:") as never)));
  assertEquals(failures(await runConformance(make)), []);
});

proves(["0006-sql-conformance FR-002"], "the port of a libSQL client passes the same cases through a FAKE of the client's shape over a real SQLite, and the port of a `pg` pool through a FAKE of the pool's shape over a real PostgreSQL in PGlite", async () => {
  for (const [name, make] of [["libSQL client (FAKE over SQLite)", libsqlFake], ["pg pool (FAKE over PGlite)", pgFake]] as const) {
    const reports = await runConformance(async () => asCore(await storeOn(await make())));
    assertEquals(failures(reports), [], name);
    assert(reports.length >= 18, name);
  }
});

proves(["0006-sql-conformance FR-003"], "every law of the bridge holds between a store in memory or in a folder and the store of a database, in both directions, and between two databases", async () => {
  const folders: string[] = [];
  try {
    const sqlStore = async (): Promise<Dest> => (await storeOn(await (await import("./kit.ts")).sqliteMemory())).store as unknown as Dest;
    const folder = async (): Promise<Dest> => {
      const dir = await (await import("@intellectual-frontiers/system")).fs.makeTempDir({ prefix: "anyfs-sql-bridge-" });
      folders.push(dir);
      const r = await localStore(dir, { create: true });
      if (r.kind === "err") throw new Error(r.error);
      return r.value as unknown as Dest;
    };
    const pairs: readonly [string, MakePair][] = [
      ["memory to a database", async () => ({ source: memoryStore({ name: "s" }) as unknown as Dest, dest: await sqlStore() })],
      ["a database to memory", async () => ({ source: await sqlStore(), dest: memoryStore({ name: "d" }) as unknown as Dest })],
      ["a folder to a database", async () => ({ source: await folder(), dest: await sqlStore() })],
      ["a database to a folder", async () => ({ source: await sqlStore(), dest: await folder() })],
      ["a database to a database", async () => ({ source: await sqlStore(), dest: await sqlStore() })],
    ];
    for (const [name, make] of pairs) assertEquals(failures(await runBridgeConformance(make)), [], name);
  } finally {
    const { fs } = await import("@intellectual-frontiers/system");
    for (const d of folders) await fs.remove(d, { recursive: true }).catch(() => undefined);
  }
});

proves(["0006-sql-conformance FR-003"], "a sync from a folder into a database and back gives the folder again, and a sync applied atomically into a database is one transaction", async () => {
  await withTemp(async (dir) => {
    const src = osPath.join(dir, "src");
    const back = osPath.join(dir, "back");
    const a = await localStore(src, { create: true });
    const b = await localStore(back, { create: true });
    assert(a.kind === "ok" && b.kind === "ok");
    for (let i = 0; i < 12; i++) assert((await a.value.write(p(`tree/${i % 3}/file-${i}.txt`), bytes(`content ${i} é 漢`), expectAny)).kind === "ok");
    assert((await a.value.write(p("tree/binary.bin"), new Uint8Array([0, 1, 2, 253, 254, 255]), expectAny)).kind === "ok");
    const port = await sqliteFile(osPath.join(dir, "fleet.db"));
    const db = (await storeOn(port)).store;
    const into = await prepare({ kind: "sync", deletes: forbidDeletes }, { store: a.value as unknown as Dest, prefix: ROOT }, { store: db as unknown as Dest, prefix: ROOT });
    if (into.kind === "err") throw new Error(JSON.stringify(into.error));
    const done = await apply(into.value, { atomic: true });
    assert(done.kind === "ok", "the sync into the database");
    const out = await prepare({ kind: "sync", deletes: forbidDeletes }, { store: db as unknown as Dest, prefix: ROOT }, { store: b.value as unknown as Dest, prefix: ROOT });
    if (out.kind === "err") throw new Error(JSON.stringify(out.error));
    assert((await apply(out.value)).kind === "ok", "the sync back out");
    const left = await a.value.list(ROOT, { limit: 100 });
    const right = await b.value.list(ROOT, { limit: 100 });
    assert(left.kind === "ok" && right.kind === "ok");
    assertEquals(right.value.entries.map((s) => [s.path, s.rev, s.size]), left.value.entries.map((s) => [s.path, s.rev, s.size]));
    for (const s of left.value.entries) {
      const x = await a.value.read(s.path);
      const y = await b.value.read(s.path);
      assert(x.kind === "ok" && y.kind === "ok" && x.value.bytes.length === y.value.bytes.length && x.value.bytes.every((v, i) => v === y.value.bytes[i]), s.path);
    }
    // a second sync changes nothing
    const again = await prepare({ kind: "sync", deletes: forbidDeletes }, { store: a.value as unknown as Dest, prefix: ROOT }, { store: db as unknown as Dest, prefix: ROOT });
    if (again.kind === "err") throw new Error(JSON.stringify(again.error));
    assertEquals(again.value.plan.actions.length, 0);
    await port.close();
  });
});

proves(["0006-sql-conformance FR-004"], "two processes writing one SQLite file are safe: of two that write no object at one path exactly one wins, and every write of each ends", async () => {
  await withTemp(async (dir) => {
    const file = osPath.join(dir, "shared.db");
    // the file is made first, so that the two start on a database that is there
    const first = await openSqliteFile(file);
    assert(first.kind === "ok");
    assert((await openSqlStore(first.value)).kind === "ok");
    await first.value.close();
    const script = osPath.join(osPath.dirname(osPath.fromFileUrl(import.meta.url)), "child-writer.ts");
    const count = 30;
    const run = (id: string): Promise<{ readonly out: string; readonly ok: boolean; readonly err: string }> =>
      proc.run([proc.execPath(), script, file, id, String(count)]).then((o) => ({ out: o.stdout.trim(), ok: o.success, err: o.stderr }));
    const [a, b] = await Promise.all([run("a"), run("b")]);
    assert(a.ok && b.ok, `${a.err}${b.err}`);
    const ra = JSON.parse(a.out.split("\n").at(-1) ?? "{}") as { wrote: number; failed: number; won: boolean };
    const rb = JSON.parse(b.out.split("\n").at(-1) ?? "{}") as { wrote: number; failed: number; won: boolean };
    assertEquals([ra.wrote, ra.failed, rb.wrote, rb.failed], [count, 0, count, 0], "every write of each ended");
    assertEquals([ra.won, rb.won].filter(Boolean).length, 1, "exactly one wins the race for one path");
    const check = await openSqliteFile(file);
    assert(check.kind === "ok");
    const opened = await openSqlStore(check.value);
    assert(opened.kind === "ok");
    const all = await opened.value.store.list(ROOT, { limit: 1000 });
    assert(all.kind === "ok" && all.value.entries.length === 2 * count + 1, "every object is there");
    const race = await opened.value.store.read(p("race"));
    assert(race.kind === "ok" && [text(race.value.bytes)].every((t) => t === "a" || t === "b"));
    await check.value.close();
  });
});
