/**
 * Durable and ephemeral targets: ISLM refused for an ephemeral one at compile time; the `.auto.sql` of an ephemeral build, the same
 * bytes every time; databases made from it through drivers in SQLite, DuckDB and PGlite, and with PostgreSQL's own client; staleness
 * found; lint of size; and the command line's build and check (commons 0009-sql-aide FR-051 to FR-055).
 *
 * @module
 */
import type { Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { fs, path, proc } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../../runtime/test.ts";
import {
  apply,
  buildSql,
  cli,
  clientCommand,
  context,
  dataOf,
  duckdb,
  duckdbDriver,
  fk,
  inspect,
  integer,
  naturalKey,
  pgliteDriver,
  pk,
  plan,
  postgres,
  sizeFindings,
  sqlite,
  sqliteDriver,
  table,
  teardown,
  text,
} from "../../sql-aide/mod.ts";
import { materialize, staleFiles } from "../../sql-aide/runtime/build.ts";
import { golden, postgresUrl } from "../helpers.ts";

const ephemeral = {
  sqlite: context({ dialect: sqlite(), durability: "ephemeral" }),
  duckdb: context({ dialect: duckdb(), durability: "ephemeral" }),
  postgres: context({ dialect: postgres(), durability: "ephemeral" }),
};

const kind = table("kind", { code: pk.text(), label: text() });
const item = table("item", { item_id: pk.text(), kind_code: fk(kind.c.code), n: integer() });
const entities = [item, kind] as const;

/** 120 items, keyed from their natural key, written in an order that is not the key's. */
const items = await Promise.all(
  Array.from({ length: 120 }, async (_, i) => ({
    item_id: await naturalKey("item", 119 - i),
    kind_code: i % 2 === 0 ? "even" : "odd",
    n: 119 - i,
  })),
);
const data = [
  dataOf(kind, [
    { code: "odd", label: "Odd" },
    { code: "even", label: "Even" },
  ]),
  dataOf(item, items),
];
const build = { module: "suite/sql-aide/target.test.ts", entities, data, chunk: 50 } as const;

proves(
  ["0009-sql-aide FR-051", "0009-sql-aide FR-052"],
  "an ephemeral context is not one ISLM takes, and a context is durable unless it says",
  () => {
    const durable = context({ dialect: sqlite() });
    expectType<Equal<typeof durable.durability, "durable">>();
    expectType<Equal<typeof ephemeral.sqlite.durability, "ephemeral">>();
    assertEquals([durable.durability, ephemeral.postgres.durability], ["durable", "ephemeral"]);
    const runner = { query: () => Promise.resolve([]), exec: () => Promise.resolve() };
    const p = { dialect: "sqlite", changes: [], unplanned: [] };
    const catalog = { defaultSchema: "main", tables: new Map(), views: new Set<string>(), indexes: new Map(), applied: new Map() };
    // the controls: a durable context is taken
    const durableApply = (): unknown => apply(p, runner, durable, { actor: "t" });
    const durablePlan = (): unknown => plan({ entities }, catalog, durable);
    // @ts-expect-error an ephemeral database is made from empty, so ISLM does not apply to it
    const applyEphemeral = (): unknown => apply(p, runner, ephemeral.sqlite, { actor: "t" });
    // @ts-expect-error nor plans for it
    const planEphemeral = (): unknown => plan({ entities }, catalog, ephemeral.duckdb);
    // @ts-expect-error nor tears it down
    const teardownEphemeral = (): unknown => teardown(entities, ephemeral.postgres);
    // @ts-expect-error a durable database is not built from empty: its structure changes through ISLM
    const buildDurable = (): unknown => buildSql(build, durable);
    assertEquals(
      [durableApply, durablePlan, applyEphemeral, planEphemeral, teardownEphemeral, buildDurable].map((f) => typeof f),
      Array.from({ length: 6 }, () => "function"),
    );
    void inspect;
  },
);

proves(
  ["0009-sql-aide FR-053", "0009-sql-aide FR-015"],
  "an ephemeral build is the same bytes every time, its rows in the order of their key, a fixed number to a statement",
  async () => {
    for (const [dialect, ctx] of Object.entries(ephemeral)) {
      const text0 = await buildSql(build, ctx);
      assertEquals(await buildSql(build, ctx), text0, `${dialect}: twice the same`);
      // the rows given in another order make the same text
      assertEquals(
        await buildSql({ ...build, data: [data[1] ?? data[0], data[0]].flatMap((d) => (d === undefined ? [] : [d])) }, ctx),
        text0,
      );
      assertEquals(
        await buildSql(
          {
            ...build,
            data: [
              dataOf(
                kind,
                [
                  { code: "odd", label: "Odd" },
                  { code: "even", label: "Even" },
                ].reverse(),
              ),
              dataOf(item, [...items].reverse()),
            ],
          },
          ctx,
        ),
        text0,
      );
      await golden(new URL(`./golden/target.${dialect}.auto.sql`, import.meta.url), text0);
      assertStringIncludes(text0, `for ${dialect} (ephemeral) from suite/sql-aide/target.test.ts.`);
      assertEquals(text0.split(`INSERT INTO "item"`).length - 1, 3, "120 rows at 50 a statement");
      // the kinds come before the items that point at them, and "even" before "odd"
      assert(
        text0.indexOf(`INSERT INTO "kind"`) < text0.indexOf(`INSERT INTO "item"`) &&
          text0.indexOf("('even', 'Even')") < text0.indexOf("('odd', 'Odd')"),
      );
    }
    assertEquals(await naturalKey("item", 7), await naturalKey("item", 7));
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(await naturalKey("item", 7)));
    assert((await naturalKey("item", 7)) !== (await naturalKey("item", 8)));
  },
);

const count = (rows: readonly Readonly<Record<string, unknown>>[]): number => Number(rows[0]?.["n"]);

proves(
  ["0009-sql-aide FR-054", "0009-sql-aide FR-042"],
  "an ephemeral database is made through a driver in SQLite, DuckDB and PGlite, renamed over the old one",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "ifcsql-target-" });
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const liteDb = path.join(dir, "model.auto.sqlite.db");
      const liteSql = await buildSql(build, ephemeral.sqlite);
      const openLite = (p: string) => {
        const db = new DatabaseSync(p);
        const d = sqliteDriver(db, ephemeral.sqlite);
        return Promise.resolve({ exec: d.runner.exec, close: () => Promise.resolve(db.close()) });
      };
      assertEquals(await materialize(liteSql, liteDb, openLite), { kind: "ok", value: undefined });
      assertEquals(await materialize(liteSql, liteDb, openLite), { kind: "ok", value: undefined }, "made again over the old one");
      // a build that fails leaves the old database as it was
      const failed = await materialize(`${liteSql}\nINSERT INTO "nowhere" VALUES (1);`, liteDb, openLite);
      assertEquals(failed.kind, "err");
      assertEquals(await fs.exists(`${liteDb}.building`), false);
      const reopened = sqliteDriver(new DatabaseSync(liteDb, { readOnly: true }));
      assertEquals(count(await reopened.runner.query(`SELECT count(*) AS n FROM "item"`)), 120);

      const { DuckDBInstance } = await import("@duckdb/node-api");
      const duckDb = path.join(dir, "model.auto.duckdb");
      const openDuck = async (p: string) => {
        const instance = await DuckDBInstance.create(p);
        const connection = await instance.connect();
        const d = duckdbDriver(connection, ephemeral.duckdb);
        return {
          exec: d.runner.exec,
          close: () => {
            connection.closeSync();
            instance.closeSync();
            return Promise.resolve();
          },
        };
      };
      assertEquals((await materialize(await buildSql(build, ephemeral.duckdb), duckDb, openDuck)).kind, "ok");
      const duck = await openDuck(duckDb);
      const instance = await DuckDBInstance.create(duckDb);
      const connection = await instance.connect();
      await duck.close();
      assertEquals(count(await duckdbDriver(connection).runner.query(`SELECT count(*) AS n FROM "item" WHERE "kind_code" = 'even'`)), 60);
      connection.closeSync();
      instance.closeSync();

      const { PGlite } = await import("@electric-sql/pglite");
      const pgDir = path.join(dir, "model.auto.pglite");
      const openPglite = async (p: string) => {
        const db = new PGlite(p);
        const d = pgliteDriver(db, ephemeral.postgres);
        return { exec: d.runner.exec, close: () => db.close() };
      };
      const pgSql = await buildSql(build, ephemeral.postgres);
      assertEquals((await materialize(pgSql, pgDir, openPglite)).kind, "ok");
      assertEquals((await materialize(pgSql, pgDir, openPglite)).kind, "ok", "a folder made again over the old one");
      const pg = new PGlite(pgDir);
      try {
        assertEquals(count((await pg.query<Record<string, unknown>>(`SELECT count(*)::int AS n FROM "item"`)).rows), 120);
      } finally {
        await pg.close();
      }
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(
  ["0009-sql-aide FR-054"],
  "the command for the engine's own client makes the database: sqlite3 and duckdb, where they are installed",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "ifcsql-client-" });
    try {
      for (const [dialect, tool, ctx, file] of [
        ["sqlite", "sqlite3", ephemeral.sqlite, "model.auto.sqlite.db"],
        ["duckdb", "duckdb", ephemeral.duckdb, "model.auto.duckdb"],
      ] as const) {
        const client = proc.which(tool);
        if (client === undefined) {
          console.log(`# SKIP ${tool} is not on this computer's PATH: its command is not run`);
          continue;
        }
        const sqlPath = path.join(dir, `${dialect}.auto.sql`);
        const database = path.join(dir, file);
        await fs.writeTextFile(sqlPath, await buildSql(build, ctx));
        const [, ...rest] = clientCommand(dialect, sqlPath, database);
        const made = await proc.run([client, ...rest]);
        assert(made.success, `${tool}: ${made.stderr}`);
        // the client itself reads back what it made
        const asked = await proc.run([
          client,
          database,
          ...(dialect === "duckdb" ? ["-noheader", "-csv", "-c"] : []),
          `SELECT count(*) FROM "item"`,
        ]);
        assert(asked.success, `${tool}: ${asked.stderr}`);
        assertEquals(asked.stdout.trim(), "120", tool);
        // made again on a new file, the database's rows are the same
        const again = path.join(dir, `again-${file}`);
        const remade = await proc.run([client, ...clientCommand(dialect, sqlPath, again).slice(1)]);
        assert(remade.success, `${tool}: ${remade.stderr}`);
      }
    } finally {
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(["0009-sql-aide FR-054"], "the command for the engine's own client makes the database: psql on a PostgreSQL server", async () => {
  assertEquals(clientCommand("sqlite", "m.auto.sql", "m.auto.sqlite.db"), ["sqlite3", "-bail", "m.auto.sqlite.db", ".read m.auto.sql"]);
  assertEquals(clientCommand("duckdb", "m.auto.sql", "m.auto.duckdb"), ["duckdb", "-bail", "m.auto.duckdb", "-f", "m.auto.sql"]);
  const url = postgresUrl();
  const psql = proc.which("psql");
  if (url === undefined || psql === undefined) {
    console.log("# SKIP psql: IFCSQL_PG_URL is not set or psql is not on the PATH");
    return;
  }
  const pg = (await import("pg")).default;
  const database = `ifcsql_psql_${Date.now().toString(36)}`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);
  const dir = await fs.makeTempDir({ prefix: "ifcsql-psql-" });
  try {
    const target = new URL(url);
    target.pathname = `/${database}`;
    const sqlPath = path.join(dir, "model.auto.sql");
    await fs.writeTextFile(sqlPath, await buildSql(build, ephemeral.postgres));
    const [, ...rest] = clientCommand("postgres", sqlPath, target.toString());
    const out = await proc.run([psql, ...rest]);
    assert(out.success, out.stderr);
    const client = new pg.Client({ connectionString: target.toString() });
    await client.connect();
    assertEquals(count((await client.query(`SELECT count(*)::int AS n FROM "item"`)).rows), 120);
    await client.end();
  } finally {
    await fs.remove(dir, { recursive: true });
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});

proves(
  ["0009-sql-aide FR-055", "0009-sql-aide FR-046"],
  "a committed build that is stale is found, lint reports a build too big, and the command line builds and checks",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "ifcsql-check-" });
    try {
      const file = path.join(dir, "model.auto.sql");
      const text0 = await buildSql(build, ephemeral.sqlite);
      assertEquals(await staleFiles([{ path: file, text: text0 }]), [file], "not there yet");
      await fs.writeTextFile(file, text0);
      assertEquals(await staleFiles([{ path: file, text: text0 }]), []);
      await fs.writeTextFile(file, text0.replace("'Odd'", "'Odd!'"));
      assertEquals(await staleFiles([{ path: file, text: text0 }]), [file]);
    } finally {
      await fs.remove(dir, { recursive: true });
    }
    assertEquals(sizeFindings(data, 100), [
      { rule: "ephemeral-size", table: "item", message: "has 120 rows written in TypeScript, more than 100" },
    ]);
    assertEquals(sizeFindings(data), []);
    const files = new Map<string, string>();
    let made = 0;
    const project = {
      name: "model",
      entities,
      builds: [
        {
          name: "model",
          files: async () => [{ path: "model.auto.sql", text: await buildSql(build, ephemeral.sqlite) }],
          materialize: () => {
            made++;
            return Promise.resolve({ kind: "ok" as const, value: undefined });
          },
        },
      ],
    };
    const io = {
      out: () => undefined,
      err: () => undefined,
      read: (p: string) => Promise.resolve(files.get(p)),
      write: (p: string, t: string) => Promise.resolve(void files.set(p, t)),
    };
    assertEquals(await cli(project, ["check"], io), 1, "nothing is built yet");
    assertEquals(await cli(project, ["build"], io), 0);
    assertEquals([files.size, made], [1, 1]);
    assertEquals(await cli(project, ["check"], io), 0);
    files.set("model.auto.sql", "stale");
    assertEquals(await cli(project, ["check"], io), 1);
  },
);
