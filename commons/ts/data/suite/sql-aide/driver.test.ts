/**
 * Drivers: adapters typed by the shape of the client passed in, for node:sqlite, pg, PGlite and DuckDB, that run the query builder's
 * statements with bound values, decode what they read by domain, call routines typed, and return failures as values
 * (commons 0009-sql-aide FR-042).
 *
 * @module
 */
import type { Brand, Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, proves } from "../../../runtime/test.ts";
import {
  apply,
  arrayOf,
  bigint,
  boolean,
  bytes,
  date,
  decode,
  definitions,
  type Driver,
  duckdbDriver,
  eq,
  fn,
  from,
  gte,
  inspect,
  insertInto,
  integer,
  json,
  numeric,
  oneOf,
  pgliteDriver,
  pk,
  plan,
  postgresDriver,
  real,
  type RowOf,
  scalar,
  select,
  setOf,
  SQL,
  sqliteDriver,
  table,
  text,
  timestamptz,
  update,
  valueAs,
} from "../../sql-aide/mod.ts";
import { postgresUrl } from "../helpers.ts";

/** A row of every domain the three dialects hold. */
const sample = table("sample", {
  id: pk.text(),
  label: text(),
  count: integer(),
  big: bigint(),
  ratio: real(),
  price: numeric(10, 2),
  active: boolean(),
  born: date(),
  at: timestamptz(),
  doc: json<{ readonly tags: readonly string[] }>(),
  blob: bytes(),
  kind: oneOf(["a", "b"]),
  note: text().nullable(),
});
/** The same with an array, which SQLite lacks. */
const tagged = table("tagged", { id: pk.text(), tags: arrayOf(text()) });

const at = new Date("2026-03-04T05:06:07.000Z");
const row = {
  id: sample.key("s1"),
  label: "it's",
  count: 7,
  big: 9007199254740993n,
  ratio: 0.5,
  price: "12.50",
  active: true,
  born: "1815-12-10",
  at,
  doc: { tags: ["x", "y"] },
  blob: new Uint8Array([0, 1, 255]),
  kind: "b" as const,
  note: null,
};

/** The initials of a name. */
const initials = fn("initials", {
  args: { given: text(), family: text() },
  returns: scalar(text()),
  volatility: "immutable",
  body: ({ given, family }) => valueAs<string>()(SQL`upper(substr(${given}, 1, 1) || substr(${family}, 1, 1))`),
});
/** The samples counted at least so many times. */
const atLeast = fn("at_least", {
  args: { n: integer() },
  returns: setOf(sample),
  volatility: "stable",
  body: ({ n }) => select(sample).where(gte(sample.c.count, n)),
});

/** A value as JSON can say it, the same whatever the driver: what the drivers' rows are compared by. */
const plainly = (v: unknown): unknown =>
  typeof v === "bigint"
    ? `${v}n`
    : v instanceof Date
      ? v.toISOString()
      : v instanceof Uint8Array
        ? [...v]
        : Array.isArray(v)
          ? v.map(plainly)
          : typeof v === "object" && v !== null
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plainly(x)]))
            : v;

/** Runs the same scenario through a driver and gives what it read, plainly. */
async function scenario<D extends Driver<import("../../sql-aide/mod.ts").Dialect>>(d: D): Promise<string> {
  const ok = <T>(
    r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: { readonly message: string } },
  ): T => {
    if (r.kind === "err") throw new Error(r.error.message);
    return r.value;
  };
  // the drivers below are each of one dialect; the scenario uses what all three have
  const any = d as unknown as Driver<import("../../sql-aide/mod.ts").Sqlite>;
  ok(await any.run(sample.ddl));
  ok(await any.run(insertInto(sample, [row])));
  const read = ok(await any.rows(from(sample)));
  expectType<Equal<(typeof read)[number]["big"], bigint>>();
  expectType<Equal<(typeof read)[number]["id"], Brand<string, "sample">>>();
  const first = read[0];
  assert(first !== undefined);
  assertEquals(plainly(first), plainly(row), d.ctx.dialect.name);
  const changed = ok(
    await any.rows(
      update(sample, { active: false, at: new Date("2027-01-01T00:00:00.000Z") })
        .where((c) => eq(c.id, sample.key("s1")))
        .returning((c) => ({ active: c.active, at: c.at, big: c.big })),
    ),
  );
  assertEquals(plainly(changed), [{ active: false, at: "2027-01-01T00:00:00.000Z", big: "9007199254740993n" }], d.ctx.dialect.name);
  // a failure is a value: the same key twice
  const twice = await any.run(insertInto(sample, [row]));
  assert(twice.kind === "err" && twice.error.kind === "driver" && twice.error.statement.startsWith("INSERT INTO"), d.ctx.dialect.name);
  return JSON.stringify(plainly([read, changed]));
}

proves(
  ["0009-sql-aide FR-042", "0009-sql-aide FR-002"],
  "an adapter is typed by the shape of the client it is given, and imports none",
  async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const { PGlite } = await import("@electric-sql/pglite");
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const pg = (await import("pg")).default;
    // the controls: each real client fits the shape its adapter asks for
    const lite = sqliteDriver(new DatabaseSync(":memory:"));
    const pglite = new PGlite();
    const p = pgliteDriver(pglite);
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    const duck = duckdbDriver(connection);
    // anything of a client's shape is one: here, a server that refuses every statement
    const server = postgresDriver({ query: () => Promise.reject(new Error("connection refused")) });
    const typed: typeof server = postgresDriver(new pg.Client());
    // @ts-expect-error a PostgreSQL client is not a SQLite client
    const wrongClient = (): unknown => sqliteDriver(new pg.Client());
    // @ts-expect-error SQLite has no arrays: a driver of it does not run a statement that needs them
    const noArrays = (): unknown => lite.run(tagged.ddl);
    // @ts-expect-error SQLite stores no functions
    const noFunctions = (): unknown => lite.run(initials.ddl);
    assertEquals([typeof wrongClient, typeof noArrays, typeof noFunctions], ["function", "function", "function"]);
    assertEquals(
      [lite.ctx.dialect.name, p.ctx.dialect.name, duck.ctx.dialect.name, server.ctx.dialect.name],
      ["sqlite", "postgres", "duckdb", "postgres"],
    );
    // a server that is not there is a failure, not a throw
    const refused = await server.run(sample.ddl);
    assert(refused.kind === "err" && refused.error.dialect === "postgres" && refused.error.message === "connection refused");
    assertEquals(typed.ctx.dialect.name, "postgres");
    await pglite.close();
    connection.closeSync();
    instance.closeSync();
  },
);

proves(
  ["0009-sql-aide FR-042", "0009-sql-aide FR-041"],
  "every adapter binds what it writes and decodes what it reads by domain, giving the same typed rows in every engine",
  async () => {
    const seen: string[] = [];
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    try {
      seen.push(await scenario(sqliteDriver(db)));
    } finally {
      db.close();
    }
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    try {
      seen.push(await scenario(duckdbDriver(connection)));
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const pglite = new PGlite();
    try {
      seen.push(await scenario(pgliteDriver(pglite)));
    } finally {
      await pglite.close();
    }
    const url = postgresUrl();
    if (url === undefined) console.log("# SKIP the PostgreSQL server driver: IFCSQL_PG_URL is not set");
    else {
      const pg = (await import("pg")).default;
      const database = `ifcsql_driver_${Date.now().toString(36)}`;
      const admin = new pg.Client({ connectionString: url });
      await admin.connect();
      await admin.query(`CREATE DATABASE ${database}`);
      const target = new URL(url);
      target.pathname = `/${database}`;
      const client = new pg.Client({ connectionString: target.toString() });
      await client.connect();
      try {
        seen.push(await scenario(postgresDriver(client)));
      } finally {
        await client.end();
        await admin.query(`DROP DATABASE ${database}`);
        await admin.end();
      }
    }
    assertEquals(new Set(seen).size, 1, seen.join("\n"));
  },
);

proves(["0009-sql-aide FR-042", "0009-sql-aide FR-020"], "routines are called through a driver, typed by what they return", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite();
  const d = pgliteDriver(pglite);
  try {
    assert((await d.run(definitions([sample, initials, atLeast]))).kind === "ok");
    assert((await d.run(insertInto(sample, [row]))).kind === "ok");
    const value = await d.value(initials.call({ given: "ada", family: "lovelace" }));
    expectType<Equal<typeof value, import("../../sql-aide/mod.ts").Result<string, import("../../sql-aide/mod.ts").DriverError>>>();
    assertEquals(value, { kind: "ok", value: "AL" });
    const many = await d.rows(select(atLeast.call({ n: 5 })));
    assert(many.kind === "ok");
    expectType<Equal<(typeof many.value)[number], RowOf<typeof sample>>>();
    assertEquals(
      many.value.map((r) => r.id),
      ["s1"],
    );
    // and in DuckDB, where the function is a macro
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(":memory:");
    const connection = await instance.connect();
    const duck = duckdbDriver(connection);
    try {
      assert((await duck.run(initials.ddl)).kind === "ok");
      assertEquals(await duck.value(initials.call({ given: "grace", family: "hopper" })), { kind: "ok", value: "GH" });
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  } finally {
    await pglite.close();
  }
});

proves(
  ["0009-sql-aide FR-042", "0009-sql-aide FR-040"],
  "a driver's runner serves ISLM and decodes values the same way as its rows",
  async () => {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    try {
      const d = sqliteDriver(db);
      const catalog = await inspect(d.runner, d.ctx);
      assert(catalog.kind === "ok");
      const applied = await apply(await plan({ entities: [sample] }, catalog.value, d.ctx), d.runner, d.ctx, { actor: "driver" });
      assert(applied.kind === "ok");
      assertEquals(applied.value.ran, ["table:main.sample"]);
    } finally {
      db.close();
    }
    assertEquals(decode(1, { kind: "boolean" }, "text"), true);
    assertEquals(decode("2026-01-02 03:04:05+00", { kind: "timestamp", zone: true }, "text"), new Date("2026-01-02T03:04:05Z"));
    assertEquals(decode(new Date(2026, 0, 2), { kind: "date" }, "local"), "2026-01-02");
    assertEquals(decode(`["a"]`, { kind: "array", of: { kind: "text" } }, "text"), ["a"]);
  },
);
