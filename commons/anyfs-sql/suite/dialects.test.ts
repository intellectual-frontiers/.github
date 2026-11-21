/**
 * Tests of the layouts of PostgreSQL and DuckDB (commons anyfs-sql 0010-sql-dialects FR-001 to FR-008): on each engine the store passes the laws of AnyFS and the merge suite, replicas of the three engines merge with
 * one another through the exchange and through the merge of the bridge and are the same files, the dump of the rows of any engine replayed in any order is the union (with the real `pg_dump` and `psql` of a real server,
 * and with the dumps the library writes for the engines that have no dump command of their own), and a dump of one engine written for another gives the same files there. PostgreSQL is the real engine: PGlite (PostgreSQL
 * itself, in the process) and, where the computer can run one, a real server made for the run. Where something could not run the test says so in its name or is skipped with a sentence.
 *
 * @module
 */
import { runConformance, runMergeConformance, type MakeReplicas, type MergeFace } from "@intellectual-frontiers/anyfs/conformance";
import { expectAny, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { applyMerge, memoryCursor, type Mergeable, type Medium, planMerge, syncThrough } from "@intellectual-frontiers/anyfs-bridge/exchange";
import { fs, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { dumpArgv, dumpText, importDumps, parseDump, redumpText } from "../src/physical/dump.ts";
import type { SqlPort, SqlStore } from "../src/mod.ts";
import { withPostgres } from "../tools/postgres-test.ts";
import { asCore, bytes, closePools, duckdbMemory, ENGINES, monotone, osPath, p, pgliteMemory, realPostgres, replicaOf, sqliteFile, sqliteMemory, storeOn, text, withTemp } from "./kit.ts";

const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

/** What a database holds as one text: each path with its bytes and the count of its siblings. */
const state = async (s: SqlStore): Promise<string> => {
  const listing = await s.store.list(ROOT, { limit: 100000 });
  assert(listing.kind === "ok");
  const rows: string[] = [];
  for (const e of listing.value.entries) {
    const r = await s.store.read(e.path);
    assert(r.kind === "ok");
    rows.push(`${e.path}=${text(r.value.bytes)}@${(await s.siblings(e.path)).length}`);
  }
  return rows.join("\n");
};

const open = (port: SqlPort, n: number, clock: () => number): Promise<SqlStore> => storeOn(port, { replica: replicaOf(n), clock, trust: { kind: "open" } });

const PATHS = ["a.txt", "b.txt", "dir/c.txt", "dir/deep/d.txt", "e.md"] as const;
const opArb = fc.record({ db: fc.nat(3), path: fc.constantFrom(...PATHS), del: fc.boolean(), body: fc.string({ maxLength: 12 }) });
type Op = { readonly db: number; readonly path: (typeof PATHS)[number]; readonly del: boolean; readonly body: string };

const play = async (stores: readonly SqlStore[], ops: readonly Op[]): Promise<void> => {
  for (const op of ops) {
    const s = stores[op.db % stores.length];
    if (s === undefined) continue;
    const r = op.del ? await s.store.delete(p(op.path), expectAny) : await s.store.write(p(op.path), bytes(op.body), expectAny);
    assert(r.kind === "ok" || op.del, "a write is taken");
  }
};

/** Every row of every store given to one that holds none, by deltas: the merge the dumps must equal. */
const merged = async (stores: readonly SqlStore[], into: SqlStore): Promise<void> => {
  for (const from of stores) {
    const since = await into.store.versionVector();
    assert(since.kind === "ok");
    const delta = await from.store.deltaSince(since.value);
    assert(delta.kind === "ok");
    assert((await into.store.applyDelta(delta.value)).kind === "ok");
  }
};

/** A function run against a real server, its pools ended before the server stops. */
const withReal = <T,>(fn: Parameters<typeof withPostgres<T>>[0]): ReturnType<typeof withPostgres<T>> =>
  withPostgres(async (server) => {
    try {
      return await fn(server);
    } finally {
      await closePools();
    }
  });

const shuffled = <T>(xs: readonly T[], seed: number): T[] => {
  const out = [...xs];
  let h = seed + 1;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
};

for (const engine of ENGINES) {
  proves(["0010-sql-dialects FR-001"], `on ${engine.name} the store passes every case of the suite its capabilities name, and the merge suite of AnyFS`, async () => {
    const reports = await runConformance(async () => asCore(await storeOn(await engine.make())));
    assertEquals(failures(reports), []);
    assert(reports.length >= 18, "the cases that need cas, batch, rename and history are run");
    const replicas: MakeReplicas = async (count, options) => {
      const clock = monotone();
      const faces: MergeFace[] = [];
      for (let i = 0; i < count; i++) {
        const s = await storeOn(await engine.make(), { replica: replicaOf(i), clock, ...(options.trusting ? { trust: { kind: "open" as const } } : {}) });
        faces.push({ store: s.store as unknown as MergeFace["store"], replica: s.replica });
      }
      return faces;
    };
    const merge = await runMergeConformance(replicas);
    assertEquals(failures(merge), []);
    assertEquals(merge.length, 12);
  });
}

proves(["0010-sql-dialects FR-002"], "the search of PostgreSQL finds the words of a text and no operator can be written by the caller, and DuckDB has no search and says so", async () => {
  const pg = await storeOn(await pgliteMemory());
  assert(pg.searchable !== undefined);
  assert((await pg.store.write(p("note.txt"), bytes("the quick brown fox"), expectAny)).kind === "ok");
  assert((await pg.store.write(p("other.txt"), bytes("a slow green turtle"), expectAny)).kind === "ok");
  const hits = await pg.searchable.search(ROOT, "quick fox");
  assert(hits.kind === "ok");
  assertEquals(hits.value.hits.map((h) => h.path as string), ["note.txt"]);
  const odd = await pg.searchable.search(ROOT, "fox & !turtle | ( ' --");
  assert(odd.kind === "ok", "a text with the operators of the syntax is words");
  const duck = await storeOn(await duckdbMemory());
  assertEquals(duck.searchable, undefined);
});

proves(["0010-sql-dialects FR-003"], "replicas of SQLite, PostgreSQL and DuckDB that edit the same paths exchange rows through a medium and merge pairwise, and all are the same files with the same siblings", async () => {
  const clock = monotone();
  const stores = [await open(await sqliteMemory(), 0, clock), await open(await pgliteMemory(), 1, clock), await open(await duckdbMemory(), 2, clock)];
  const [a, b, c] = stores as [SqlStore, SqlStore, SqlStore];
  assert((await a.store.write(p("shared.txt"), bytes("from sqlite"), expectAny)).kind === "ok");
  assert((await b.store.write(p("shared.txt"), bytes("from postgres"), expectAny)).kind === "ok");
  assert((await c.store.write(p("shared.txt"), bytes("from duckdb"), expectAny)).kind === "ok");
  assert((await a.store.write(p("only/sqlite.bin"), new Uint8Array([0, 1, 2, 255]), expectAny)).kind === "ok");
  assert((await b.store.write(p("only/postgres.txt"), bytes("héllo wörld"), expectAny)).kind === "ok");
  assert((await c.store.write(p("only/duckdb.txt"), bytes("日本語"), expectAny)).kind === "ok");
  const medium = memoryStore({ name: "medium" }) as unknown as Medium;
  const cursors = stores.map(() => memoryCursor());
  for (let round = 0; round < 2; round++) {
    for (const [i, s] of stores.entries()) {
      const done = await syncThrough({ self: s.replica, replica: s.store as unknown as Mergeable, medium, cursor: cursors[i] as ReturnType<typeof memoryCursor> });
      assert(done.kind === "ok", done.kind === "err" ? JSON.stringify(done.error) : "");
    }
  }
  const states = await Promise.all(stores.map(state));
  assertEquals(states[1], states[0]);
  assertEquals(states[2], states[0]);
  assert(states[0]?.includes("shared.txt=from duckdb@2") === true, `the greatest id wins and the other two are siblings: ${states[0]}`);
  // the merge of the bridge between two of them, with its plan hash, leaves them equal and has nothing more to take
  const [x, y] = [await open(await duckdbMemory(), 7, clock), await open(await sqliteMemory(), 8, clock)] as [SqlStore, SqlStore];
  assert((await x.store.write(p("x.txt"), bytes("x"), expectAny)).kind === "ok");
  assert((await y.store.write(p("y.txt"), bytes("y"), expectAny)).kind === "ok");
  const plan = await planMerge(x.store as unknown as Mergeable, y.store as unknown as Mergeable);
  assert(plan.kind === "ok");
  const applied = await applyMerge(x.store as unknown as Mergeable, y.store as unknown as Mergeable, plan.value, { approved: plan.value.plan.hash });
  assert(applied.kind === "ok" && applied.value.vectorsEqual);
  assertEquals(await state(x), await state(y));
});

proves(["0010-sql-dialects FR-004"], "the dumps the library writes for PostgreSQL and for DuckDB, replayed in any order, twice and overlapping, are the union of the rows, the same files as the merge by deltas", async () => {
  for (const make of [pgliteMemory, duckdbMemory]) {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 14 }), fc.integer({ min: 2, max: 4 }), fc.nat(1000), async (ops, count, seed) => {
        const clock = monotone();
        const dbs = await Promise.all(Array.from({ length: count }, (_, i) => make().then((port) => open(port, i, clock))));
        await play(dbs, ops);
        const texts = await Promise.all(dbs.map((s) => dumpText(s.port, s.facts.naming)));
        const expected = await open(await make(), 99, clock);
        await merged(dbs, expected);
        const target = await open(await make(), 98, clock);
        const replay = shuffled([...texts, ...texts.slice(0, 2)], seed);
        const done = await importDumps(target, replay);
        assert(done.kind === "ok", done.kind === "err" ? done.error : "");
        assertEquals(done.value.findings, []);
        assertEquals(await state(target), await state(expected));
        const again = await importDumps(target, texts);
        assert(again.kind === "ok" && again.value.versions === 0 && again.value.blobs === 0, "a second replay adds nothing");
      }),
      { numRuns: 8 },
    );
  }
}, { timeout: 600_000 });

proves(["0010-sql-dialects FR-005"], "the dump of the real sqlite3 written for PostgreSQL and for DuckDB, and the dump the library writes for each, give the same files in the other engine", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const file = osPath.join(dir, "a.db");
    const sqliteSide = await open(await sqliteFile(file), 0, clock);
    const pgSide = await open(await pgliteMemory(), 1, clock);
    await play([sqliteSide, pgSide], [
      { db: 0, path: "a.txt", del: false, body: "one" },
      { db: 1, path: "a.txt", del: false, body: "two" },
      { db: 0, path: "dir/c.txt", del: false, body: "it's \"quoted\"" },
      { db: 1, path: "e.md", del: false, body: "e" },
    ]);
    await sqliteSide.port.query("PRAGMA wal_checkpoint(TRUNCATE)", []);
    const real = await proc.must(dumpArgv(file, sqliteSide.facts.naming) as string[]);
    const expected = await open(await sqliteMemory(), 99, clock);
    await merged([sqliteSide, pgSide], expected);
    for (const [target, make] of [["postgres", pgliteMemory], ["duckdb", duckdbMemory], ["sqlite", sqliteMemory]] as const) {
      const out = redumpText(real, target, sqliteSide.facts.naming);
      assert(out.kind === "ok", out.kind === "err" ? out.error : "");
      const into = await open(await make(), 50, clock);
      const done = await importDumps(into, [out.value, await dumpText(pgSide.port, pgSide.facts.naming)]);
      assert(done.kind === "ok", done.kind === "err" ? done.error : "");
      assertEquals(done.value.findings, []);
      assertEquals(await state(into), await state(expected), `a dump of the real sqlite3 for ${target}`);
    }
    // the redumped text is plain, and the real engine of SQLite replays what was written for it
    const redo = redumpText(real, "postgres", sqliteSide.facts.naming);
    assert(redo.kind === "ok" && /ON CONFLICT DO NOTHING;/.test(redo.value) && /'\\x[0-9a-f]*'/.test(redo.value));
    const none = parseDump("INSERT INTO anyfs_versions VALUES(1); DROP TABLE x;", sqliteSide.facts.naming);
    assert(none.kind === "err");
  });
});

proves(["0010-sql-dialects FR-006"], "a DuckDB database has no trigger, and the import of the library holds what a trigger holds elsewhere: a replica it does not trust refuses the whole replay and a collected row is not written", async () => {
  const clock = monotone();
  const a = await open(await sqliteMemory(), 0, clock);
  assert((await a.store.write(p("a.txt"), bytes("a"), expectAny)).kind === "ok");
  const dump = await dumpText(a.port, a.facts.naming);
  const strict = await storeOn(await duckdbMemory(), { replica: replicaOf(5), clock });
  const refused = await importDumps(strict, [dump]);
  assert(refused.kind === "err" && /not one this database takes rows from/.test(refused.error), refused.kind === "err" ? refused.error : "taken");
  assertEquals(await state(strict), "", "nothing was taken");
  const pgStrict = await storeOn(await pgliteMemory(), { replica: replicaOf(6), clock });
  const pgRefused = await importDumps(pgStrict, [dump]);
  assert(pgRefused.kind === "err" && /not one this database takes rows from/.test(pgRefused.error), "the trigger of PostgreSQL refuses it too");
});

proves(["0010-sql-dialects FR-007"], "on a REAL PostgreSQL server the store passes the laws of AnyFS and the merge suite (skipped with a sentence where no server can be made)", async () => {
  const ran = await withReal(async (server) => {
    let n = 0;
    const make = async (): Promise<SqlPort> => realPostgres(server, `conf_${Date.now()}_${n++}`);
    const reports = await runConformance(async () => asCore(await storeOn(await make())));
    assertEquals(failures(reports), []);
    const replicas: MakeReplicas = async (count, options) => {
      const clock = monotone();
      const faces: MergeFace[] = [];
      for (let i = 0; i < count; i++) {
        const s = await storeOn(await make(), { replica: replicaOf(i), clock, ...(options.trusting ? { trust: { kind: "open" as const } } : {}) });
        faces.push({ store: s.store as unknown as MergeFace["store"], replica: s.replica });
      }
      return faces;
    };
    assertEquals(failures(await runMergeConformance(replicas)), []);
  });
  if (ran.kind === "skipped") console.log(`skipped: ${ran.reason}`);
}, { timeout: 900_000 });

proves(["0010-sql-dialects FR-008"], "the dumps of the real pg_dump (data only, inserts, on conflict do nothing) of several real databases, replayed by the real psql and by the library, in any order, twice and overlapping, are the union (skipped with a sentence where no server can be made)", async () => {
  const ran = await withReal(async (server) => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 12 }), fc.integer({ min: 2, max: 3 }), fc.nat(1000), async (ops, count, seed) => {
        const clock = monotone();
        const tag = `d_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const dbs = await Promise.all(Array.from({ length: count }, async (_, i) => open(await realPostgres(server, `${tag}_${i}`), i, clock)));
        await play(dbs, ops);
        const texts = await Promise.all(
          dbs.map(async (_, i) => {
            const out = await proc.output([server.bin.pgDump, "-h", server.host, "-p", String(server.port), "-U", server.user, "--data-only", "--inserts", "--on-conflict-do-nothing", "-t", "anyfs_versions", "-t", "anyfs_blobs", `${tag}_${i}`]);
            assertEquals(out.code, 0, new TextDecoder().decode(out.stderr));
            return new TextDecoder().decode(out.stdout);
          }),
        );
        const expected = await open(await realPostgres(server, `${tag}_expected`), 98, clock);
        await merged(dbs, expected);
        // (a) by the library: the schema is there, the dumps are read as rows and replayed in one transaction, then checked
        const byLibrary = await open(await realPostgres(server, `${tag}_lib`), 97, clock);
        const done = await importDumps(byLibrary, shuffled([...texts, ...texts.slice(0, 1)], seed));
        assert(done.kind === "ok", done.kind === "err" ? done.error : "");
        assertEquals(done.value.findings, []);
        assertEquals(await state(byLibrary), await state(expected));
        // (b) by the real psql with no library code: the schema is made by the store, the rows come from the files
        const byPsql = await open(await realPostgres(server, `${tag}_psql`), 96, clock);
        await withTemp(async (dir) => {
          for (const [i, t] of shuffled([...texts, ...texts], seed + 1).entries()) {
            const f = osPath.join(dir, `${i}.sql`);
            await fs.writeTextFile(f, t);
            const run = await proc.output([server.bin.psql, "-h", server.host, "-p", String(server.port), "-U", server.user, "-d", `${tag}_psql`, "-v", "ON_ERROR_STOP=1", "-q", "-f", f]);
            assertEquals(run.code, 0, new TextDecoder().decode(run.stderr));
          }
        });
        assertEquals(await state(byPsql), await state(expected));
      }),
      { numRuns: 4 },
    );
  });
  if (ran.kind === "skipped") console.log(`skipped: ${ran.reason}`);
}, { timeout: 900_000 });

proves(["0010-sql-dialects FR-008"], "a dump of the real sqlite3 written for PostgreSQL and replayed by the real psql gives the same files on the real server (skipped with a sentence where no server can be made)", async () => {
  const ran = await withReal(async (server) => {
    await withTemp(async (dir) => {
      const clock = monotone();
      const file = osPath.join(dir, "a.db");
      const a = await open(await sqliteFile(file), 0, clock);
      for (const [path, body] of [["x/1.txt", "one"], ["x/2.txt", "two"], ["blob.bin", "\u0000\u0001"]] as const) assert((await a.store.write(p(path), bytes(body), expectAny)).kind === "ok");
      await a.port.query("PRAGMA wal_checkpoint(TRUNCATE)", []);
      const dump = await proc.must(dumpArgv(file, a.facts.naming) as string[]);
      const written = redumpText(dump, "postgres", a.facts.naming);
      assert(written.kind === "ok");
      const name = `x_${Date.now()}`;
      const into = await open(await realPostgres(server, name), 1, clock);
      const f = osPath.join(dir, "pg.sql");
      await fs.writeTextFile(f, written.value);
      const run = await proc.output([server.bin.psql, "-h", server.host, "-p", String(server.port), "-U", server.user, "-d", name, "-v", "ON_ERROR_STOP=1", "-q", "-f", f]);
      assertEquals(run.code, 0, new TextDecoder().decode(run.stderr));
      assertEquals(await state(into), await state(a));
      assertEquals((await into.verify()).length, 0);
    });
  });
  if (ran.kind === "skipped") console.log(`skipped: ${ran.reason}`);
}, { timeout: 300_000 });
