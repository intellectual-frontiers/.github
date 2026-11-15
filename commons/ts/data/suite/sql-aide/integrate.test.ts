/**
 * Integrations: typed sources, contracts and landings, loads by four strategies that run in every engine, files through DuckDB, attached
 * databases, the source-adapter hook, lineage and rows made into code (commons 0009-sql-aide FR-028, FR-032, FR-033, FR-034).
 *
 * @module
 */
import type { Equal } from "../../../kernel/mod.ts";
import { err, expectType, ok } from "../../../kernel/mod.ts";
import { fs, path } from "../../../runtime/mod.ts";
import { assert, assertEquals, assertRejects, assertStringIncludes, assertThrows, proves } from "../../../runtime/test.ts";
import {
  context,
  csvModule,
  duckdb,
  fk,
  fromAdapter,
  fromAttached,
  fromCsv,
  integer,
  type LandingRow,
  lineageOf,
  lineageTable,
  pk,
  postgres,
  type Sql,
  readAdapter,
  recordLineage,
  render,
  seed,
  sqlite,
  table,
  text,
  upstream,
} from "../../sql-aide/mod.ts";
import { duckdbEngine, eachEngine, golden, sqliteEngine } from "../helpers.ts";
import { kinds } from "./golden/kinds.auto.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

const kind = table("kind", { code: pk.text(), label: text(), rank: integer().default(0) });
const thing = table("thing", { id: pk.text(), kind_code: fk(kind.c.code), name: text(), note: text().nullable() });
const eventLog = table("event_log", { what: text(), seen: integer() });

const twoKinds = [
  { code: "a", label: "A", rank: 1 },
  { code: "b", label: "B's", rank: 2 },
] as const;

proves(
  ["0009-sql-aide FR-032", "0009-sql-aide FR-034", "0009-sql-aide FR-010"],
  "a source is held to its target's insert row, and a load renders only where the dialect can run it",
  () => {
    expectType<Equal<LandingRow<typeof thing>["kind_code"], string>>();
    expectType<Equal<LandingRow<typeof thing>["note"], string | null | undefined>>();
    // the controls: each of these compiles
    const good = seed("kinds", kind, [{ code: "a", label: "A" }]);
    const file = fromCsv("kinds_file", kind, { path: "kinds.csv", columns: ["code", "label"] });
    const db = fromAttached("kinds_db", kind, { file: "old.db", relation: "kind", columns: ["code", "label", "rank"] });
    assert(render(good.load, pg).includes("ON CONFLICT") && render(file.load, duck).includes("read_csv"));
    assert(render(db.load, duck).includes("ATTACH") && render(db.load, lite).includes("ATTACH DATABASE"));
    // @ts-expect-error a kind must be given its label
    const noLabel = (): unknown => seed("k", kind, [{ code: "a" }]);
    // @ts-expect-error a kind has no colour
    const extra = (): unknown => seed("k", kind, [{ code: "a", label: "A", colour: "red" }]);
    // @ts-expect-error a label is text
    const wrongType = (): unknown => seed("k", kind, [{ code: "a", label: 1 }]);
    // @ts-expect-error a file that does not give the label cannot load kinds
    const short = (): unknown => fromCsv("k", kind, { path: "k.csv", columns: ["code"] });
    // @ts-expect-error a key must be a column the file gives
    const badKey = (): unknown => fromCsv("k", kind, { path: "k.csv", columns: ["code", "label"] }, { key: ["rank"] });
    // @ts-expect-error PostgreSQL does not read files: the load needs read-files
    const pgFile = (): unknown => render(file.load, pg);
    // @ts-expect-error nor does SQLite
    const liteFile = (): unknown => render(file.load, lite);
    // @ts-expect-error PostgreSQL does not attach databases
    const pgAttach = (): unknown => render(db.load, pg);
    assertEquals(
      [noLabel, extra, wrongType, short, badKey, pgFile, liteFile, pgAttach].map((f) => typeof f),
      Array.from({ length: 8 }, () => "function"),
    );
    assertThrows(
      () =>
        seed("k", kind, [
          { code: "a", label: "A" },
          { code: "b", label: "B", rank: 2 },
        ]),
      Error,
      "the same columns",
    );
    assertThrows(() => seed("k", eventLog, [{ what: "x", seen: 1 }]), Error, "needs a key");
  },
);

proves(["0009-sql-aide FR-032", "0009-sql-aide FR-033", "0009-sql-aide FR-015"], "what loads render is what is committed", async () => {
  const upsert = seed("kinds", kind, twoKinds);
  const snapshot = seed("kinds_snapshot", kind, twoKinds, { strategy: "snapshot" });
  const replace = seed("events", eventLog, [{ what: "start", seen: 1 }], { strategy: "replace" });
  const file = fromCsv("kinds_file", kind, { path: "data/kinds.csv", columns: ["code", "label", "rank"] });
  const db = fromAttached("kinds_db", kind, { file: "data/old.db", relation: "kind", columns: ["code", "label"] });
  for (const [dialect, ctx] of Object.entries(contexts)) {
    const parts = [render(upsert.load, ctx), render(snapshot.load, ctx), render(replace.load, ctx)];
    if (dialect === "duckdb") parts.push(render(file.load, duck), render(db.load, duck));
    if (dialect === "sqlite") parts.push(render(db.load, lite));
    await golden(new URL(`./golden/integrations.${dialect}.sql`, import.meta.url), `${parts.join("\n\n")}\n`);
  }
});

/** The rows of a table, as JSON, in the order of their first column. */
async function rowsOf(engine: { readonly query: (t: string) => Promise<readonly Readonly<Record<string, unknown>>[]> }, t: string) {
  const got = await engine.query(`SELECT * FROM "${t}" ORDER BY 1, 2`);
  return JSON.stringify(got.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]))));
}

proves(
  ["0009-sql-aide FR-033"],
  "each strategy loads in every engine; upsert, replace and snapshot run twice leave the rows of once, and append adds them again",
  async () => {
    const seen: string[] = [];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      const run = (i: { readonly load: Sql<"fragment", unknown, "upsert"> }): Promise<void> =>
        engine.exec(
          engine.dialect === "sqlite" ? render(i.load, lite) : engine.dialect === "duckdb" ? render(i.load, duck) : render(i.load, pg),
        );
      for (const t of [kind, thing, eventLog]) await engine.exec(render(t.ddl, ctx));
      const upsert = seed("kinds", kind, twoKinds);
      await run(upsert);
      const once = await rowsOf(engine, "kind");
      await run(upsert);
      assertEquals(await rowsOf(engine, "kind"), once, `${engine.name}: upsert twice`);
      await run(seed("kinds_relabel", kind, [{ code: "a", label: "Alpha" }]));
      assertStringIncludes(await rowsOf(engine, "kind"), `"label":"Alpha","rank":1`);

      const append = seed("events", eventLog, [{ what: "start", seen: 1 }], { strategy: "append" });
      await run(append);
      await run(append);
      assertEquals(
        (await engine.query(`SELECT count(*) AS n FROM "event_log"`)).map((r) => Number(r["n"])),
        [2],
        engine.name,
      );
      const replace = seed("events_replace", eventLog, [{ what: "only", seen: 3 }], { strategy: "replace" });
      await run(replace);
      await run(replace);
      assertEquals(await rowsOf(engine, "event_log"), `[{"what":"only","seen":3}]`, engine.name);

      await run(
        seed(
          "things",
          thing,
          [
            { id: "t1", kind_code: "a", name: "one" },
            { id: "t2", kind_code: "b", name: "two" },
          ].map((r) => ({ ...r, note: null })),
        ),
      );
      const snapshot = seed("things_snapshot", thing, [{ id: "t1", kind_code: "b", name: "one", note: "moved" }], { strategy: "snapshot" });
      await run(snapshot);
      const after = await rowsOf(engine, "thing");
      await run(snapshot);
      assertEquals(await rowsOf(engine, "thing"), after, `${engine.name}: snapshot twice`);
      assertEquals(after, `[{"id":"t1","kind_code":"b","name":"one","note":"moved"}]`, engine.name);
      // a load that breaks a constraint of its target fails, as an insert would
      await assertRejects(() => run(seed("orphans", thing, [{ id: "t9", kind_code: "zz", name: "x" }])));
      seen.push(JSON.stringify([await rowsOf(engine, "kind"), await rowsOf(engine, "event_log"), await rowsOf(engine, "thing")]));
    });
    assertEquals(new Set(seen).size, 1, "every engine holds the same rows");
  },
);

proves(
  ["0009-sql-aide FR-033"],
  "a CSV file is read by DuckDB's read_csv, its fields cast to their columns, and loaded twice to the same rows",
  async () => {
    const dir = await fs.makeTempDir({ prefix: "ifcsql-csv-" });
    const engine = await duckdbEngine();
    try {
      const file = path.join(dir, "kinds.csv");
      await fs.writeTextFile(file, `code,rank,label,ignored\nx,10,"Ex, with a comma",1\ny,20,Why's,2\n`);
      await engine.exec(render(kind.ddl, duck));
      const load = fromCsv("kinds_file", kind, { path: file, columns: ["code", "label", "rank"] });
      await engine.exec(render(load.load, duck));
      await engine.exec(render(load.load, duck));
      assertEquals(
        await rowsOf(engine, "kind"),
        `[{"code":"x","label":"Ex, with a comma","rank":10},{"code":"y","label":"Why's","rank":20}]`,
      );
      await fs.writeTextFile(file, `code,label,rank\nx,Ex,not a number\n`);
      await assertRejects(() => engine.exec(render(load.load, duck)));
    } finally {
      await engine.close();
      await fs.remove(dir, { recursive: true });
    }
  },
);

proves(["0009-sql-aide FR-033"], "a table of another database file is attached, landed and loaded, in DuckDB and in SQLite", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifcsql-attach-" });
  try {
    const liteFile = path.join(dir, "old.sqlite");
    const { DatabaseSync } = await import("node:sqlite");
    const old = new DatabaseSync(liteFile);
    old.exec(`CREATE TABLE "kind" ("code" TEXT, "label" TEXT, "rank" INTEGER); INSERT INTO "kind" VALUES ('p', 'P', 5), ('q', 'Q', 6);`);
    old.close();
    const duckFile = path.join(dir, "old.duckdb");
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const instance = await DuckDBInstance.create(duckFile);
    const connection = await instance.connect();
    await connection.run(
      `CREATE TABLE "kind" ("code" VARCHAR, "label" VARCHAR, "rank" INTEGER); INSERT INTO "kind" VALUES ('p', 'P', 5), ('q', 'Q', 6);`,
    );
    connection.closeSync();
    instance.closeSync();
    const want = `[{"code":"p","label":"P","rank":5},{"code":"q","label":"Q","rank":6}]`;
    for (const [engine, file] of [
      [await sqliteEngine(), liteFile],
      [await duckdbEngine(), duckFile],
    ] as const) {
      try {
        const load = fromAttached("kinds_db", kind, { file, relation: "kind", columns: ["code", "label", "rank"] });
        const text = engine.dialect === "sqlite" ? render(load.load, lite) : render(load.load, duck);
        await engine.exec(engine.dialect === "sqlite" ? render(kind.ddl, lite) : render(kind.ddl, duck));
        await engine.exec(text);
        await engine.exec(text);
        assertEquals(await rowsOf(engine, "kind"), want, engine.name);
      } finally {
        await engine.close();
      }
    }
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(
  ["0009-sql-aide FR-034", "0009-sql-aide FR-024"],
  "a source that is not SQL comes through an adapter, whose failure is a value",
  async () => {
    const fromApi = fromAdapter("kinds_api", kind, { name: "kinds-api", read: () => Promise.resolve(ok([{ code: "z", label: "Zed" }])) }, [
      "code",
      "label",
    ]);
    // @ts-expect-error the adapter's rows have not been read, so the load does not render
    const unread = (): unknown => render(fromApi.load, lite);
    assertThrows(() => render(fromApi.load, lite as never), Error, "have not been read");
    assertEquals(typeof unread, "function");
    const read = await readAdapter(fromApi);
    assert(read.kind === "ok");
    const engine = await sqliteEngine();
    try {
      await engine.exec(render(kind.ddl, lite));
      await engine.exec(render(read.value.load, lite));
      await engine.exec(render(read.value.load, lite));
      assertEquals(await rowsOf(engine, "kind"), `[{"code":"z","label":"Zed","rank":0}]`);
    } finally {
      await engine.close();
    }
    const down = fromAdapter("kinds_down", kind, { name: "down", read: () => Promise.resolve(err("the service is down")) }, [
      "code",
      "label",
    ]);
    assertEquals(
      await readAdapter(down),
      err({ kind: "adapter" as const, adapter: "down", integration: "kinds_down", message: "the service is down" }),
    );
    const throws = fromAdapter("kinds_throw", kind, { name: "throws", read: () => Promise.reject(new Error("boom")) }, ["code", "label"]);
    assertEquals((await readAdapter(throws)).kind, "err");
    const wrongRows = (): unknown =>
      // @ts-expect-error an adapter for kinds gives rows with a label
      fromAdapter("k", kind, { name: "x", read: () => Promise.resolve(ok([{ code: 1 }])) }, ["code", "label"]);
    assertEquals(typeof wrongRows, "function");
  },
);

proves(
  ["0009-sql-aide FR-028"],
  "the lineage of integrations is computed from them, followed through the graph and kept in a table",
  async () => {
    const file = fromCsv("kinds_file", kind, { path: "kinds.csv", columns: ["code", "label"] });
    const kinds0 = seed("kinds", kind, twoKinds);
    const edges = lineageOf([file, kinds0, file]);
    assertEquals(edges, [
      { via: "kinds_file", kind: "integration", from: "csv:kinds.csv", to: ".kinds_file_landing" },
      { via: "kinds_file", kind: "load", from: ".kinds_file_landing", to: ".kind" },
      { via: "kinds", kind: "integration", from: "rows:typescript", to: ".kinds_landing" },
      { via: "kinds", kind: "load", from: ".kinds_landing", to: ".kind" },
    ]);
    assertEquals(upstream(edges, ".kind"), [".kinds_file_landing", ".kinds_landing", "csv:kinds.csv", "rows:typescript"]);
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(lineageTable.ddl, ctx));
      const record = recordLineage(edges);
      await engine.exec(render(record.load, ctx));
      await engine.exec(render(record.load, ctx));
      const stored = await engine.query(`SELECT "via", "kind", "from_node", "to_node" FROM "ifcsql_lineage" ORDER BY 1, 3`);
      assertEquals(stored.length, 4, engine.name);
    });
  },
);

proves(["0009-sql-aide FR-032"], "CSV text is made into a module of typed rows, which seed the table it was made for", async () => {
  const csvText = `code,label,rank\nperson,Person,1\norganization,"Organization, any body",2\n`;
  const made = csvModule(csvText, { exportName: "kinds", source: "kinds.csv", table: kind.spec });
  assert(made.kind === "ok");
  await golden(new URL("./golden/kinds.auto.ts", import.meta.url), made.value);
  // the module the text makes is committed, compiled and used: its rows are rows a kind takes
  const fromModule = seed("kinds_module", kind, kinds);
  assertStringIncludes(render(fromModule.load, pg), `('organization', 'Organization, any body', 2)`);
  assertEquals(
    csvModule("code,colour\na,red\n", { exportName: "k", source: "x", table: kind.spec }),
    err({ kind: "header", message: "kind has no column colour" }),
  );
  assertEquals(
    csvModule("code,label,rank\na,A,1.5\n", { exportName: "k", source: "x", table: kind.spec }),
    err({ kind: "value", line: 2, column: "rank", message: `"1.5" is not an integer` }),
  );
  assertEquals(csvModule(`a\n"x`, { exportName: "k", source: "x" }).kind, "err");
});
