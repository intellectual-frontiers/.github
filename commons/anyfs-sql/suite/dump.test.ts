/**
 * Tests of the dump of a database that merges and the union of dumps (commons anyfs-sql 0008-sql-dump FR-001 to FR-006), with the REAL `sqlite3` command: the data of the mergeable tables is dumped from files, replayed
 * into a new database, and the files are merged. The shapes proved: a property over two to five databases, a replay that is idempotent, in any order and overlapping, a round trip, a dump that is tampered or comes from a
 * replica the database does not trust, a stale dump that brings back nothing that was deleted, local tables that are never written, ten thousand files with the time it takes, a folder of dumps that two replicas share,
 * and a Git merge of dumps with the `union` driver.
 *
 * @module
 */
import { expectAny, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { fs, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { dumpArgv, dumpText, importDumps, parseDump } from "../src/physical/dump.ts";
import type { SqlPort, SqlStore } from "../src/mod.ts";
import { bytes, monotone, osPath, p, replicaOf, sqliteFile, storeOn, text, withTemp } from "./kit.ts";

type Replica = { readonly file: string; readonly port: SqlPort; readonly store: SqlStore };

const open = async (dir: string, name: string, n: number, clock: () => number, trust: "open" | "self" = "open"): Promise<Replica> => {
  const file = osPath.join(dir, `${name}.db`);
  const port = await sqliteFile(file);
  const store = await storeOn(port, { replica: replicaOf(n), clock, ...(trust === "open" ? { trust: { kind: "open" as const } } : {}) });
  return { file, port, store };
};

/** The dump of a file by the real `sqlite3`: the data of the two mergeable tables. */
const realDump = async (r: Replica): Promise<string> => {
  await r.port.query("PRAGMA wal_checkpoint(TRUNCATE)", []);
  return proc.must(dumpArgv(r.file, r.store.facts.naming) as string[]);
};

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

const exchange = async (a: SqlStore, b: SqlStore): Promise<void> => {
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const since = await to.store.versionVector();
    assert(since.kind === "ok");
    const delta = await from.store.deltaSince(since.value);
    assert(delta.kind === "ok");
    assert((await to.store.applyDelta(delta.value)).kind === "ok");
  }
};

/** A fresh database that takes rows from any replica. */
const fresh = (dir: string, name: string, clock: () => number): Promise<Replica> => open(dir, name, 99, clock, "open");

const entriesOf = async (dir: string): Promise<readonly { readonly name: string }[]> => {
  const all: { readonly name: string }[] = [];
  for await (const e of fs.readDir(dir)) all.push(e);
  return all;
};

const PATHS = ["a.txt", "b.txt", "dir/c.txt", "dir/deep/d.txt", "e.md"] as const;
const opArb = fc.record({ db: fc.nat(4), path: fc.constantFrom(...PATHS), del: fc.boolean(), body: fc.string({ maxLength: 12 }) });

proves(["0008-sql-dump FR-001", "0008-sql-dump FR-002"], "the dumps of two to five databases made by the real sqlite3 and replayed into a new database give the union: the state the databases reach by exchanging deltas, whatever the order of the dumps", async () => {
  let runs = 0;
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 2, max: 5 }), fc.array(opArb, { minLength: 1, maxLength: 24 }), fc.nat(1000), async (count, ops, seed) => {
      runs++;
      await withTemp(async (dir) => {
        const clock = monotone();
        const rs: Replica[] = [];
        for (let i = 0; i < count; i++) rs.push(await open(dir, `r${i}`, i, clock));
        for (const o of ops) {
          const r = rs[o.db % count];
          if (r === undefined) continue;
          if (o.del) await r.store.store.delete(p(o.path), expectAny);
          else await r.store.store.write(p(o.path), bytes(`${o.body}@${o.db}`), expectAny);
        }
        const dumps = await Promise.all(rs.map(realDump));
        // the reference: the databases exchange deltas until they agree
        const ref = await fresh(dir, "ref", clock);
        for (const r of rs) await exchange(ref.store, r.store);
        for (const r of rs) await exchange(ref.store, r.store);
        // the union: the dumps replayed, in the order given and in another
        const one = await fresh(dir, "one", clock);
        assert((await importDumps(one.store, dumps)).kind === "ok");
        const order = [...dumps].sort((x, y) => ((x.length * 31 + seed) % 7) - ((y.length * 17 + seed) % 7)).reverse();
        const two = await fresh(dir, "two", clock);
        const done = await importDumps(two.store, order);
        assert(done.kind === "ok" && done.value.findings.length === 0, "the rows and blobs of the union are in order");
        assertEquals(await state(one.store), await state(ref.store), "the union is what exchanging deltas gives");
        assertEquals(await state(two.store), await state(one.store), "in any order");
        for (const r of [...rs, ref, one, two]) await r.port.close();
      });
    }),
    { numRuns: 20, seed: 20260721 },
  );
  assertEquals(runs >= 20, true);
}, { timeout: 300_000 });

proves(["0008-sql-dump FR-002"], "replaying a dump twice, and dumps that overlap, change nothing the second time: the counts of new rows are zero and the state is the same", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 1, clock);
    const b = await open(dir, "b", 2, clock);
    for (let i = 0; i < 20; i++) await a.store.store.write(p(`f/${i}.txt`), bytes(`a ${i}`), expectAny);
    await exchange(a.store, b.store); // b holds the rows of a: the dumps overlap
    for (let i = 0; i < 20; i += 2) await b.store.store.write(p(`f/${i}.txt`), bytes(`b ${i}`), expectAny);
    const da = await realDump(a);
    const db = await realDump(b);
    const target = await fresh(dir, "t", clock);
    const first = await importDumps(target.store, [da, db]);
    assert(first.kind === "ok" && first.value.versions === (da.match(/INSERT INTO anyfs_versions/g) ?? []).length + 10, `the rows of a and the ten new ones of b: ${JSON.stringify(first)}`);
    const before = await state(target.store);
    const again = await importDumps(target.store, [db, da, db]);
    assert(again.kind === "ok");
    assertEquals([again.value.versions, again.value.blobs, again.value.findings.length], [0, 0, 0]);
    assertEquals(await state(target.store), before);
    for (const r of [a, b, target]) await r.port.close();
  });
});

proves(["0008-sql-dump FR-003"], "the real sqlite3 reads the dump back into a database made by the library, and its text is the text the library writes: a round trip in both ways", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 1, clock);
    await a.store.store.write(p("é/漢字.txt"), bytes("it's a \"quote\"\nsecond line"), expectAny);
    await a.store.store.write(p("bin.dat"), new Uint8Array([0, 1, 2, 253, 254, 255]), expectAny);
    await a.store.store.write(p("empty"), new Uint8Array(0), expectAny);
    const real = await realDump(a);
    const own = await dumpText(a.port, a.store.facts.naming);
    const lines = (t: string): readonly string[] => t.split("\n").filter((l) => l.startsWith("INSERT")).sort();
    assertEquals(lines(own), lines(real), "the same inserts the real command writes, but for order");
    // the real command replays the dump into a database of the library: no import code is involved
    const target = await open(dir, "t", 9, clock);
    await target.port.close();
    const script = osPath.join(dir, "a.sql");
    await fs.writeTextFile(script, `.bail on\nBEGIN;\n${real}COMMIT;\n`);
    const done = await proc.run(["sqlite3", target.file, `.read ${script}`]);
    assert(done.success, done.stderr);
    const again = await sqliteFile(target.file);
    const reopened = await storeOn(again, { replica: replicaOf(9), trust: { kind: "open" } });
    await reopened.reindex();
    assertEquals(await state(reopened), await state(a.store));
    assertEquals((await reopened.verify()).length, 0);
    const parsed = parseDump(own, a.store.facts.naming);
    assert(parsed.kind === "ok" && parsed.value.versions.length === 3 && parsed.value.blobs.length === 3);
    await again.close();
    await a.port.close();
  });
});

proves(["0008-sql-dump FR-004"], "a dump that is tampered with, comes from a replica the database does not trust, or is not a dump of inserts, is refused with a sentence and changes nothing", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 1, clock);
    await a.store.store.write(p("x.txt"), bytes("from a"), expectAny);
    const dump = await realDump(a);
    // trust: a database that takes itself alone refuses the rows of a, through the real sqlite3 as well as through the library
    const closed = await open(dir, "closed", 2, clock, "self");
    const via = await importDumps(closed.store, [dump]);
    assert(via.kind === "err" && /does not take rows from|not one this database takes/i.test(via.error), via.kind === "err" ? via.error : "taken");
    await closed.port.close();
    const script = osPath.join(dir, "a.sql");
    await fs.writeTextFile(script, `.bail on\nBEGIN;\n${dump}COMMIT;\n`);
    const cli = await proc.run(["sqlite3", closed.file, `.read ${script}`]);
    assert(!cli.success && /not one this database takes rows from/.test(cli.stderr), cli.stderr);
    const check = await sqliteFile(closed.file);
    const again = await storeOn(check, { replica: replicaOf(2) });
    const left = await again.store.list(ROOT, { limit: 10 });
    assert(left.kind === "ok" && left.value.entries.length === 0, "nothing was taken");
    await check.close();
    // tamper: a path changed in a row, so that the sum of its fields is not the sum it carries
    const target = await fresh(dir, "t", clock);
    const tampered = dump.replace("'x.txt'", "'y.txt'");
    const found = await importDumps(target.store, [tampered]);
    assert(found.kind === "ok" && found.value.findings.some((f) => f.kind === "bad-sum" || f.kind === "bad-id"), `verify finds it: ${JSON.stringify(found)}`);
    // not a dump: statements that are not plain inserts change nothing
    for (const bad of ["DROP TABLE anyfs_versions;", "INSERT INTO anyfs_meta VALUES ('replica','x');", "INSERT INTO anyfs_versions VALUES (1+1);", "DELETE FROM anyfs_versions;"]) {
      const r = await importDumps(target.store, [bad]);
      assert(r.kind === "err", bad);
    }
    const meta = await target.port.query("SELECT value FROM anyfs_meta WHERE key = 'replica'", []);
    assertEquals(String(meta[0]?.["value"]), replicaOf(99));
    for (const r of [a, target]) await r.port.close();
  });
});

proves(["0008-sql-dump FR-005"], "a dump made before a delete and replayed after it brings nothing back, and the local tables of a database are never written by a replay", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 1, clock);
    await a.store.store.write(p("gone.txt"), bytes("secret"), expectAny);
    await a.store.store.write(p("stays.txt"), bytes("kept"), expectAny);
    const stale = await realDump(a);
    assert((await a.store.store.delete(p("gone.txt"), expectAny)).kind === "ok");
    const target = await fresh(dir, "t", clock);
    assert((await importDumps(target.store, [await realDump(a)])).kind === "ok");
    assert((await importDumps(target.store, [stale])).kind === "ok", "the stale dump is taken as rows");
    assert((await target.store.store.read(p("gone.txt"))).kind === "err", "what was deleted stays deleted");
    assertEquals(await state(target.store), "stays.txt=kept@0");
    // the local tables are what they were
    const before = JSON.stringify(await target.port.query("SELECT key, value FROM anyfs_meta ORDER BY key", []));
    assert((await importDumps(target.store, [stale, await realDump(a)])).kind === "ok");
    assertEquals(JSON.stringify(await target.port.query("SELECT key, value FROM anyfs_meta ORDER BY key", [])), before);
    for (const r of [a, target]) await r.port.close();
  });
});

proves(["0008-sql-dump FR-006"], "ten thousand files are dumped by the real sqlite3 from each of two databases and merged into a new one, and the time of each step is in the report", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const a = await open(dir, "a", 1, clock);
    const b = await open(dir, "b", 2, clock);
    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) await a.store.store.write(p(`tree/${i % 50}/a-${i}.txt`), bytes(`file ${i} of a`), expectAny);
    for (let i = 0; i < 5000; i++) await b.store.store.write(p(`tree/${i % 50}/b-${i}.txt`), bytes(`file ${i} of b`), expectAny);
    const t1 = performance.now();
    const da = await realDump(a);
    const db = await realDump(b);
    const t2 = performance.now();
    const target = await fresh(dir, "t", clock);
    const done = await importDumps(target.store, [da, db]);
    const t3 = performance.now();
    assert(done.kind === "ok" && done.value.versions === 10000 && done.value.findings.length === 0, JSON.stringify(done));
    const listing = await target.store.store.list(ROOT, { limit: 20000 });
    assert(listing.kind === "ok" && listing.value.entries.length === 10000);
    // the same union by the real sqlite3 alone, in one transaction
    const cli = await open(dir, "cli", 98, clock);
    await cli.port.close();
    const script = osPath.join(dir, "all.sql");
    await fs.writeTextFile(script, `.bail on\nBEGIN;\n${da}${db}COMMIT;\n`);
    const t4 = performance.now();
    const ran = await proc.run(["sqlite3", cli.file, `.read ${script}`]);
    const t5 = performance.now();
    assert(ran.success, ran.stderr);
    const ms = (x: number, y: number): string => `${Math.round(y - x)} ms`;
    console.log(`[anyfs-sql dump scale] 10,000 files: write ${ms(t0, t1)}, real sqlite3 dump of two files ${ms(t1, t2)} (${Math.round((da.length + db.length) / 1024)} KiB), replay by the library with verify ${ms(t2, t3)}, replay by the real sqlite3 alone ${ms(t4, t5)}`);
    for (const r of [a, b, target]) await r.port.close();
  });
}, { timeout: 600_000 });

proves(["0008-sql-dump FR-006"], "two replicas that each write a dump to a shared folder, named by their identity, and take the dumps of the others, agree", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const shared = osPath.join(dir, "shared");
    await fs.mkdir(shared, { recursive: true });
    const rs = [await open(dir, "r0", 10, clock), await open(dir, "r1", 11, clock), await open(dir, "r2", 12, clock)];
    for (const [i, r] of rs.entries()) {
      await r.store.store.write(p(`own/${i}.txt`), bytes(`mine ${i}`), expectAny);
      await r.store.store.write(p("shared.txt"), bytes(`writer ${i}`), expectAny);
    }
    const round = async (): Promise<void> => {
      for (const r of rs) await fs.writeTextFile(osPath.join(shared, `${r.store.replica}.sql`), await realDump(r));
      for (const r of rs) {
        const others = (await entriesOf(shared)).filter((e) => !e.name.startsWith(r.store.replica));
        const texts: string[] = [];
        for (const e of others) texts.push(await fs.readTextFile(osPath.join(shared, e.name)));
        assert((await importDumps(r.store, texts)).kind === "ok");
      }
    };
    await round();
    const states = await Promise.all(rs.map((r) => state(r.store)));
    assertEquals([states[1], states[2]], [states[0], states[0]]);
    assert(states[0]?.includes("shared.txt=writer 2@2"), `the last writer wins and two siblings are kept: ${states[0]}`);
    await round(); // a second round changes nothing
    assertEquals(await state(rs[0]!.store), states[0]);
    for (const r of rs) await r.port.close();
  });
});

proves(["0008-sql-dump FR-006"], "two branches of Git that each add rows to a sorted dump merge with the union driver into the dump of the union, and the real git and the real sqlite3 do it", async () => {
  await withTemp(async (dir) => {
    const clock = monotone();
    const repo = osPath.join(dir, "repo");
    await fs.mkdir(repo, { recursive: true });
    const run = (args: readonly string[]): Promise<string> => proc.must(["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args]);
    await run(["init", "-q", "-b", "main"]);
    await fs.writeTextFile(osPath.join(repo, ".gitattributes"), "*.sql merge=union\n");
    const base = await open(dir, "base", 1, clock);
    await base.store.store.write(p("base.txt"), bytes("base"), expectAny);
    const sorted = async (r: Replica): Promise<string> => `${(await realDump(r)).split("\n").filter((l) => l !== "").sort().join("\n")}\n`;
    await fs.writeTextFile(osPath.join(repo, "fleet.sql"), await sorted(base));
    await run(["add", "."]);
    await run(["commit", "-q", "-m", "base"]);
    const a = await open(dir, "a", 2, clock);
    const b = await open(dir, "b", 3, clock);
    for (const r of [a, b]) assert((await importDumps(r.store, [await fs.readTextFile(osPath.join(repo, "fleet.sql"))])).kind === "ok");
    await a.store.store.write(p("from-a.txt"), bytes("a"), expectAny);
    await b.store.store.write(p("from-b.txt"), bytes("b"), expectAny);
    await run(["checkout", "-q", "-b", "a"]);
    await fs.writeTextFile(osPath.join(repo, "fleet.sql"), await sorted(a));
    await run(["commit", "-q", "-am", "a"]);
    await run(["checkout", "-q", "main"]);
    await run(["checkout", "-q", "-b", "b"]);
    await fs.writeTextFile(osPath.join(repo, "fleet.sql"), await sorted(b));
    await run(["commit", "-q", "-am", "b"]);
    await run(["merge", "-q", "--no-edit", "a"]);
    const merged = await fs.readTextFile(osPath.join(repo, "fleet.sql"));
    const target = await fresh(dir, "t", clock);
    const done = await importDumps(target.store, [merged]);
    assert(done.kind === "ok" && done.value.findings.length === 0, JSON.stringify(done));
    assertEquals(await state(target.store), "base.txt=base@0\nfrom-a.txt=a@0\nfrom-b.txt=b@0");
    for (const r of [base, a, b, target]) await r.port.close();
  });
});
