// Spec: 0056-sql-drivers FR-001, FR-002, FR-003
/**
 * Driver adapters (commons data 0056-sql-drivers), on the real clients: `node:sqlite`, DuckDB's `node-api`, PGlite, `pg` over a socket and, on Bun, `bun:sqlite` and Bun's `SQL`. The same script gives the same
 * rows through each, wide integers are numbers, a refusal is a rejection, and `driverFor` picks the adapter from the shape of the client.
 *
 * @module
 */
import { DuckDBInstance } from "@duckdb/node-api";
import { PGlite } from "@electric-sql/pglite";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { bunSqlDriver, driverFor, duckdbDriver, type DuckdbClient, pgDriver, pgliteDriver, plain, sqliteDriver, type PgClient, type SqliteClient } from "@intellectual-frontiers/data/sql/drivers";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { same } from "./governance-fixture.ts";
import { onBun, pgliteServer } from "./net-fixtures.ts";

const SCRIPT = "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL, big BIGINT); INSERT INTO t VALUES (1, 'a', 9007199254740991), (2, 'b', NULL)";
const check = async (name: string, d: Driver): Promise<void> => {
  await d.exec(SCRIPT);
  const rows = await d.query("SELECT id, name, big FROM t ORDER BY id");
  same(rows.map((r) => [Number(r["id"]), r["name"], r["big"] === null ? null : Number(r["big"])]), [[1, "a", 9007199254740991], [2, "b", null]], name);
  assert(rows.every((r) => typeof r["id"] !== "bigint" && typeof r["big"] !== "bigint"), `${name}: no bigint`);
  assert(Object.getPrototypeOf(rows[0]) === Object.prototype, `${name}: a plain object`);
  same((await d.query("SELECT count(*) AS n FROM t"))[0]?.["n"] !== undefined, true, name);
  let refused = false;
  try {
    await d.exec("INSERT INTO t VALUES (1, 'dup', 0)");
  } catch {
    refused = true;
  }
  assert(refused, `${name}: a refusal is a rejection`);
  let bad = false;
  try {
    await d.query("SELECT * FROM nowhere");
  } catch {
    bad = true;
  }
  assert(bad, `${name}: a query that fails is a rejection`);
};

proves(["0056-sql-drivers FR-001", "0056-sql-drivers FR-002"], "each adapter runs the same script and gives the same rows on the real client: node:sqlite, DuckDB, PGlite and pg over a socket, and bun:sqlite and Bun's SQL on Bun; and driverFor picks the adapter from the shape of the client", async () => {
  const sqlite = new DatabaseSync(":memory:");
  await check("sqlite", sqliteDriver(sqlite));
  same(typeof driverFor(new DatabaseSync(":memory:")).query, "function");
  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  await check("duckdb", duckdbDriver(conn as unknown as DuckdbClient));
  const viaShape = driverFor(await instance.connect() as unknown as DuckdbClient);
  await viaShape.exec("CREATE TABLE s (x INTEGER)");
  same(await viaShape.query("SELECT 1 AS one"), [{ one: 1 }]);
  const lite = new PGlite();
  await lite.waitReady;
  await check("pglite", pgliteDriver(lite));
  const lite2 = new PGlite();
  await lite2.waitReady;
  await check("pglite by shape", driverFor(lite2));
  const server = await pgliteServer();
  try {
    const { Client } = createRequire(import.meta.url)("pg") as { Client: new (o: { host: string; port: number; user: string; database: string }) => PgClient & { connect(): Promise<void>; end(): Promise<void> } };
    const client = new Client({ host: "127.0.0.1", port: server.port, user: "postgres", database: "postgres" });
    await client.connect();
    try {
      await check("pg", pgDriver(client));
    } finally {
      await client.end();
    }
  } finally {
    await server.close();
  }
  if (onBun()) {
    const { Database } = await import("bun:sqlite" as string) as { Database: new (p: string) => unknown };
    await check("bun:sqlite", sqliteDriver(new Database(":memory:") as unknown as SqliteClient));
    const { SQL } = (await import("bun" as string)) as unknown as { SQL: new (url: string) => { unsafe(s: string): PromiseLike<readonly Record<string, unknown>[]>; close(): Promise<void> } };
    const s2 = await pgliteServer();
    try {
      const sql = new SQL(`postgres://postgres@127.0.0.1:${s2.port}/postgres`);
      try {
        await check("bun sql", bunSqlDriver(sql));
        same((await driverFor(sql).query("SELECT 2 AS two"))[0]?.["two"], 2);
      } finally {
        await sql.close();
      }
    } finally {
      await s2.close();
    }
  }
  conn.closeSync();
  instance.closeSync();
});

proves(["0056-sql-drivers FR-003"], "a client of no known shape is refused with a message that says what is looked for, and a row is made plain: a wide integer a number, an object with no prototype an ordinary one", () => {
  let said = "";
  try {
    driverFor({} as never);
  } catch (thrown) {
    said = String(thrown);
  }
  assert(said.includes("no shape") && said.includes("runAndReadAll"), said);
  same(plain({ a: 1n, b: "x", c: null }), { a: 1, b: "x", c: null });
  same(plain(Object.assign(Object.create(null), { z: 2 })), { z: 2 });
});
