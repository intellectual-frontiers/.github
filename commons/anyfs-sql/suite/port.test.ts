/**
 * Tests of the port and its adapters (commons anyfs-sql 0003-sql-port FR-001 to FR-009): the statements the builder makes carry no value in their text, the gate runs one at a time, a driver's values are read as the
 * port's, and each adapter runs a statement and a transaction on its engine (the real engine for SQLite, PostgreSQL in PGlite and DuckDB; a named fake of a client over a real engine for libSQL and `pg`).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type SqlPort, parseNaming } from "../src/mod.ts";
import { sqlFor } from "../src/physical/mod.ts";
import { Gate, rowOf, valueOf } from "../src/physical/adapters/common.ts";
import { duckdbMemory, libsqlFake, pgFake, pgliteMemory, sqliteMemory } from "./kit.ts";

const naming = (() => {
  const n = parseNaming({ prefix: "fleet" });
  if (n.kind === "err") throw new Error(n.error);
  return n.value;
})();

const HOSTILE = `a'; DROP TABLE fleet_objects; -- 100% _x\\y "q"`;

proves(["0003-sql-port FR-001"], "the port has query, exec, transaction and close, and a transaction that throws leaves nothing of its changes, on every engine", async () => {
  for (const [name, make] of [["sqlite", sqliteMemory], ["postgres", pgliteMemory], ["duckdb", duckdbMemory]] as const) {
    const port: SqlPort = await make();
    await port.exec("CREATE TABLE t (id TEXT PRIMARY KEY, n BIGINT)", []);
    await port.transaction(async (tx) => {
      await tx.exec(`INSERT INTO t VALUES (${name === "sqlite" ? "?, ?" : "$1, $2"})`, ["one", 1]);
    });
    let threw = false;
    try {
      await port.transaction(async (tx) => {
        await tx.exec(`INSERT INTO t VALUES (${name === "sqlite" ? "?, ?" : "$1, $2"})`, ["two", 2]);
        throw new Error("stop");
      });
    } catch {
      threw = true;
    }
    assert(threw, name);
    const rows = await port.query("SELECT id FROM t ORDER BY id", []);
    assertEquals(rows.map((r) => r["id"]), ["one"], name);
    await port.close();
  }
});

proves(["0003-sql-port FR-002"], "the builder writes names as the dialect writes them and parameters in the order they were added, and no value is part of the text", () => {
  const sqlite = sqlFor("sqlite", naming);
  const pg = sqlFor("postgres", naming);
  const duck = sqlFor("duckdb", naming);
  const path = HOSTILE;
  const q = (s: typeof sqlite): { readonly text: string; readonly params: readonly unknown[] } => s.query().text("SELECT rev FROM ").table("objects").text(" WHERE path = ").param(path).text(" AND size > ").param(1).done();
  assertEquals(q(sqlite), { text: "SELECT rev FROM fleet_objects WHERE path = ? AND size > ?", params: [path, 1] });
  assertEquals(q(pg), { text: "SELECT rev FROM fleet_objects WHERE path = $1 AND size > $2", params: [path, 1] });
  assertEquals(q(duck).text, "SELECT rev FROM fleet_objects WHERE path = $1 AND size > $2");
  for (const s of [sqlite, pg, duck]) {
    const text = q(s).text;
    for (const bit of ["DROP", "'", "100%", "\\", '"q"']) assert(!text.includes(bit), `${bit} is not in the text`);
  }
  // a keyword as a name is quoted, a schema qualifies the table
  assertEquals(sqlite.name("select"), '"select"');
  assertEquals(pg.name("order"), '"order"');
  const withSchema = sqlFor("postgres", { prefix: naming.prefix, schema: naming.prefix });
  assertEquals(withSchema.table("objects"), "fleet.fleet_objects");
  // bytes are a value for the engines that type them and hex for DuckDB
  const bytes = new Uint8Array([1, 255]);
  const withBytes = (s: typeof sqlite): { readonly text: string; readonly params: readonly unknown[] } => s.query().text("INSERT INTO ").table("objects").text(" (body) VALUES (").bytes(bytes).text(")").done();
  assertEquals(withBytes(pg).params, [bytes]);
  assertEquals(withBytes(duck), { text: "INSERT INTO fleet_objects (body) VALUES (unhex($1))", params: ["01ff"] });
  assertEquals(sqlite.query().text("SELECT ").selectBytes("body").done().text, "SELECT body");
  assertEquals(duck.query().text("SELECT ").selectBytes("body").done().text, "SELECT hex(body) AS body");
  assertEquals(pg.query().text("SELECT 1").forUpdate().done().text, "SELECT 1 FOR UPDATE");
  assertEquals(sqlite.query().text("SELECT 1").forUpdate().done().text, "SELECT 1");
  assertEquals([sqlite, pg, duck].map((s) => s.type("path")), ["TEXT", 'TEXT COLLATE "C"', "TEXT"]);
});

proves(["0003-sql-port FR-003"], "a gate runs what goes through it one at a time in the order it came", async () => {
  const gate = new Gate();
  const log: string[] = [];
  const job = (name: string, ms: number): Promise<string> =>
    gate.run(async () => {
      log.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${name}`);
      return name;
    });
  const done = await Promise.all([job("a", 20), job("b", 1), job("c", 5)]);
  assertEquals(done, ["a", "b", "c"]);
  assertEquals(log, ["start a", "end a", "start b", "end b", "start c", "end c"]);
  // a job that throws does not stop the ones behind it
  const failing = gate.run(async () => {
    throw new Error("x");
  });
  const after = gate.run(async () => "after");
  await failing.catch(() => undefined);
  assertEquals(await after, "after");
});

proves(["0003-sql-port FR-004"], "a driver's values are read as the port's: buffers, array buffers and arrays of bytes into copied bytes, booleans into 1 and 0, dates into text, and rows with no prototype into rows", () => {
  const src = new Uint8Array([1, 2, 3]);
  const copy = valueOf(src);
  assert(copy instanceof Uint8Array && copy !== src);
  assertEquals([...(copy as Uint8Array)], [1, 2, 3]);
  assertEquals([...(valueOf(new Uint8Array([7, 8]).buffer) as Uint8Array)], [7, 8]);
  assertEquals([...(valueOf(Buffer.from([9])) as Uint8Array)], [9]);
  assertEquals(valueOf(true), 1);
  assertEquals(valueOf(false), 0);
  assertEquals(valueOf(null), null);
  assertEquals(valueOf(undefined), null);
  assertEquals(valueOf(new Date(0)), "1970-01-01T00:00:00.000Z");
  assertEquals(valueOf(5n), 5n);
  assertEquals(valueOf("s"), "s");
  const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1, b: new Uint8Array([1]) });
  const row = rowOf(bare);
  assertEquals(Object.keys(row), ["a", "b"]);
  assertEquals(rowOf(null), {});
});

proves(["0003-sql-port FR-005"], "the port of SQLite runs a write as BEGIN IMMEDIATE, so a second connection waits for the first in one process through the shared gate, and a file is opened in write-ahead mode", async () => {
  const { openSqliteFile } = await import("../src/physical/adapters/sqlite.ts");
  const { withTemp, osPath } = await import("./kit.ts");
  await withTemp(async (dir) => {
    const file = osPath.join(dir, "a.db");
    const a = await openSqliteFile(file);
    const b = await openSqliteFile(file);
    assert(a.kind === "ok" && b.kind === "ok");
    await a.value.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER)", []);
    await a.value.exec("INSERT INTO t VALUES (1, 0)", []);
    // two connections to one file in one process write at once, each a transaction that reads and then writes: with the shared gate neither fails
    const bump = (port: SqlPort): Promise<void> =>
      port.transaction(async (tx) => {
        const rows = await tx.query("SELECT n FROM t WHERE id = 1", []);
        await new Promise((r) => setTimeout(r, 2));
        await tx.exec("UPDATE t SET n = ? WHERE id = 1", [Number(rows[0]?.["n"] ?? 0) + 1]);
      });
    await Promise.all(Array.from({ length: 20 }, (_, i) => bump(i % 2 === 0 ? a.value : b.value)));
    assertEquals((await a.value.query("SELECT n FROM t", []))[0]?.["n"], 20);
    const mode = await a.value.query("PRAGMA journal_mode", []);
    assertEquals(String(mode[0]?.["journal_mode"]).toLowerCase(), "wal");
    await a.value.close();
    await b.value.close();
  });
});

proves(["0003-sql-port FR-006"], "the port of a libSQL client (a FAKE of the client's shape over a real SQLite) runs statements and transactions, reads blobs that arrive as array buffers, and rolls back on a throw", async () => {
  const port = await libsqlFake();
  assertEquals(port.dialect, "sqlite");
  await port.exec("CREATE TABLE t (id TEXT PRIMARY KEY, body BLOB)", []);
  await port.transaction(async (tx) => {
    await tx.exec("INSERT INTO t VALUES (?, ?)", ["a", new Uint8Array([1, 2, 3])]);
  });
  const rows = await port.query("SELECT body FROM t", []);
  assert(rows[0]?.["body"] instanceof Uint8Array);
  assertEquals([...(rows[0]?.["body"] as Uint8Array)], [1, 2, 3]);
  let threw = false;
  try {
    await port.transaction(async (tx) => {
      await tx.exec("INSERT INTO t VALUES (?, ?)", ["b", new Uint8Array([4])]);
      throw new Error("stop");
    });
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals((await port.query("SELECT id FROM t", [])).length, 1);
  await port.close();
});

proves(["0003-sql-port FR-007"], "the port of PGlite (PostgreSQL itself) runs a transaction through PGlite's own and undoes it on a throw", async () => {
  const port = await pgliteMemory();
  assertEquals(port.dialect, "postgres");
  await port.exec("CREATE TABLE t (id TEXT PRIMARY KEY, body BYTEA)", []);
  await port.transaction(async (tx) => {
    await tx.exec("INSERT INTO t VALUES ($1, $2)", ["a", new Uint8Array([9, 8])]);
    // a statement outside the transaction waits for it: it is run after, and sees the committed row
  });
  const out = port.query("SELECT body FROM t", []);
  assertEquals([...((await out)[0]?.["body"] as Uint8Array)], [9, 8]);
  let threw = false;
  try {
    await port.transaction(async (tx) => {
      await tx.exec("INSERT INTO t VALUES ($1, $2)", ["b", new Uint8Array([1])]);
      throw new Error("stop");
    });
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals((await port.query("SELECT id FROM t", [])).length, 1);
});

proves(["0003-sql-port FR-008"], "the port of a `pg` pool (a FAKE of the pool's shape over PostgreSQL in PGlite) takes a connection for a transaction, gives it back, undoes a throw, and reads a BIGINT that arrives as text", async () => {
  const port = await pgFake();
  await port.exec("CREATE TABLE t (id TEXT PRIMARY KEY, size BIGINT, body BYTEA)", []);
  await port.transaction(async (tx) => {
    await tx.exec("INSERT INTO t VALUES ($1, $2, $3)", ["a", 42, new Uint8Array([5])]);
  });
  const rows = await port.query("SELECT size, body FROM t", []);
  assertEquals(rows[0]?.["size"], "42", "the fake gives a BIGINT as text, as pg does");
  assert(rows[0]?.["body"] instanceof Uint8Array, "a buffer is read as bytes");
  let threw = false;
  try {
    await port.transaction(async (tx) => {
      await tx.exec("INSERT INTO t VALUES ($1, $2, $3)", ["b", 1, new Uint8Array([1])]);
      throw new Error("stop");
    });
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals((await port.query("SELECT id FROM t", [])).length, 1);
  // the connection was given back: another transaction can run
  await port.transaction(async (tx) => void (await tx.query("SELECT 1", [])));
});

proves(["0003-sql-port FR-009"], "the port of DuckDB runs a transaction as BEGIN and COMMIT, undoes a throw with ROLLBACK and gives a wide integer for a BIGINT", async () => {
  const port = await duckdbMemory();
  assertEquals(port.dialect, "duckdb");
  await port.exec("CREATE TABLE t (id TEXT PRIMARY KEY, n BIGINT)", []);
  await port.transaction(async (tx) => {
    await tx.exec("INSERT INTO t VALUES ($1, $2)", ["a", 7]);
  });
  const rows = await port.query("SELECT n FROM t", []);
  assertEquals(rows[0]?.["n"], 7n);
  let threw = false;
  try {
    await port.transaction(async (tx) => {
      await tx.exec("INSERT INTO t VALUES ($1, $2)", ["b", 1]);
      throw new Error("stop");
    });
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals((await port.query("SELECT id FROM t", [])).length, 1);
  await port.close();
});
