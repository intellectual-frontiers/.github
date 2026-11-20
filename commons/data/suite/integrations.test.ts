// Spec: 0022-sql-integrations FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010
/**
 * Integrations (commons data 0022-sql-integrations), on real engines: rows, CSV text, an attached database and an adapter landed, checked, loaded by each strategy in one transaction, and recorded;
 * what is wrong with them changes nothing and is a value.
 *
 * @module
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DuckDBInstance } from "@duckdb/node-api";
import { err, ok } from "@intellectual-frontiers/core";
import { assert, proves } from "@intellectual-frontiers/test";
import {
  type IntegrationSpec,
  type IntegrationSettings,
  lineageOf,
  load,
  type LoadError,
  type LoadReport,
  loader,
  type Loader,
  parseCsv,
  settingsOf,
  upstream,
} from "@intellectual-frontiers/data/sql/extensions/integrations";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load as loadScript, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const schema = libraryAt(2);
const dbWith = async (name: Engine["name"], d: Dialect): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(schema, { dialect: d });
  assert(b.kind === "ok");
  if (b.kind === "ok") await loadScript(e, b.value);
  return e;
};
const make = (d: Dialect, spec: IntegrationSpec): Loader => {
  const r = loader(schema, spec, { dialect: d });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const run = async (e: Engine, l: Loader, s?: IntegrationSettings): Promise<LoadReport> => {
  const r = await load(driverOf(e), l, s);
  if (r.kind === "err") throw new Error(`${e.name}: ${JSON.stringify(r.error)}`);
  return r.value;
};
const refused = async (e: Engine, l: Loader, s?: IntegrationSettings): Promise<readonly LoadError[]> => {
  const r = await load(driverOf(e), l, s);
  assert(r.kind === "err", `${e.name}: expected a refusal, got ${JSON.stringify(r)}`);
  return r.kind === "err" ? r.error : [];
};
const names = async (e: Engine): Promise<unknown[]> => (await e.rows(`SELECT "id", "name" FROM "author" ORDER BY "id"`)).map((r) => [r["id"], r["name"]]);
const counts = (r: LoadReport): number[] => [r.landed, r.inserted, r.updated, r.deleted];
const people = (...ids: string[]) => ids.map((id) => ({ id, name: `Name ${id}` }));
const spec = (over: Partial<IntegrationSpec> = {}): IntegrationSpec => ({ name: "authors", table: "author", source: { kind: "rows", rows: people("a1", "a2") }, ...over });

proves(
  ["0022-sql-integrations FR-001"],
  "an integration is resolved by the words of its names, and a table or column that is not there, a required column left out and a missing key are errors as values",
  () => {
    const l = make(postgres(), spec());
    same([l.strategy, l.key.map((k) => k.name), l.columns.map((c) => c.name)], ["upsert", ["id"], ["id", "name"]], "upsert by the primary key");
    same(make(postgres(), spec({ table: "Author", source: { kind: "rows", rows: [{ ID: "a", Name: "x" }] } })).columns.map((c) => c.name), ["id", "name"], "any case style");
    const bad = (s: IntegrationSpec) => {
      const r = loader(schema, s, { dialect: postgres() });
      return r.kind === "err" ? r.error[0]?.kind : "ok";
    };
    same(bad(spec({ table: "nope" })), "unknown-table");
    same(bad(spec({ source: { kind: "rows", rows: [{ id: "a", name: "x", shoe: 1 }] } })), "unknown-column");
    same(bad(spec({ source: { kind: "rows", rows: [{ id: "a" }] } })), "missing-required");
    same(bad(spec({ source: { kind: "rows", rows: [{ id: "a", name: "x" }] }, key: ["name", "nope"] })), "no-key");
    same(bad(spec({ source: { kind: "rows", rows: [] } })), "no-columns");
    same(make(postgres(), spec({ strategy: "append" })).strategy, "append");
  },
);

function postgres(): Dialect {
  return DIALECTS[2].dialect;
}

proves(
  ["0022-sql-integrations FR-003", "0022-sql-integrations FR-004", "0022-sql-integrations FR-008"],
  "on three engines each strategy loads as it says, an upsert run twice leaves the rows as after once, a failure rolls back, and the landing is gone",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        same(counts(await run(e, make(dialect, spec()))), [2, 2, 0, 0], `${name}: upsert inserts`);
        same(counts(await run(e, make(dialect, spec({ source: { kind: "rows", rows: [{ id: "a2", name: "Changed" }, { id: "a3", name: "New" }] } })))), [2, 1, 1, 0], `${name}: and updates`);
        same(await names(e), [["a1", "Name a1"], ["a2", "Changed"], ["a3", "New"]]);
        const again = spec({ source: { kind: "rows", rows: [{ id: "a2", name: "Changed" }, { id: "a3", name: "New" }] } });
        await run(e, make(dialect, again));
        same(await names(e), [["a1", "Name a1"], ["a2", "Changed"], ["a3", "New"]], `${name}: twice is as once`);
        same(counts(await run(e, make(dialect, spec({ strategy: "replace", source: { kind: "rows", rows: people("b1") } })))), [1, 1, 0, 3], `${name}: replace`);
        same(await names(e), [["b1", "Name b1"]]);
        const snap = make(dialect, spec({ strategy: "snapshot", source: { kind: "rows", rows: people("b1", "b2") } }));
        same(counts(await run(e, snap)), [2, 1, 1, 0], `${name}: snapshot`);
        same(counts(await run(e, make(dialect, spec({ strategy: "snapshot", source: { kind: "rows", rows: people("b2") } })), { maxDeleteShare: 1 })), [1, 0, 1, 1], `${name}: snapshot deletes what was not landed`);
        same(await names(e), [["b2", "Name b2"]]);
        // a failure rolls back: the second row's key is the first's after an append, so the whole load is refused
        const clash = make(dialect, spec({ name: "clash", strategy: "append", source: { kind: "rows", rows: [{ id: "c1", name: "x" }, { id: "b2", name: "y" }] } }));
        const e1 = await refused(e, clash, { skipUnchanged: "none" });
        same(e1[0]?.kind, "database", `${name}: a database error is a value`);
        same(await names(e), [["b2", "Name b2"]], `${name}: and nothing was loaded`);
        const gone = name === "postgres"
          ? await e.rows(`SELECT count(*) n FROM pg_tables WHERE tablename LIKE '%landing'`)
          : name === "duckdb"
            ? await e.rows(`SELECT count(*) n FROM duckdb_tables() WHERE table_name LIKE '%landing'`)
            : await e.rows(`SELECT count(*) n FROM sqlite_temp_master WHERE name LIKE '%landing'`);
        same(Number(gone[0]?.["n"]), 0, `${name}: the landing is dropped`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0022-sql-integrations FR-005", "0022-sql-integrations FR-006"],
  "duplicate keys, a missing required value, an empty snapshot and a snapshot that would delete most of the target are refused and change nothing",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        await run(e, make(dialect, spec({ source: { kind: "rows", rows: people("a1", "a2", "a3", "a4") } })));
        const before = await names(e);
        const dup = await refused(e, make(dialect, spec({ source: { kind: "rows", rows: [...people("a1"), ...people("a1")] } })));
        assert(dup.some((x) => x.kind === "duplicate-keys" && x.count === 1), `${name}: duplicate keys`);
        const nulls = await refused(e, make(dialect, spec({ source: { kind: "rows", rows: [{ id: "z", name: null }] } })));
        assert(nulls.some((x) => x.kind === "null-required" && x.column === "name" && x.count === 1), `${name}: a null in a required column`);
        const empty = await refused(e, make(dialect, spec({ strategy: "snapshot", source: { kind: "adapter", adapter: { name: "nothing", read: async () => ok([]) } }, columns: ["id", "name"] })));
        same(empty[0]?.kind, "empty-snapshot", `${name}: an empty snapshot`);
        const most = await refused(e, make(dialect, spec({ strategy: "snapshot", source: { kind: "rows", rows: people("a1") } })));
        assert(most[0]?.kind === "delete-share" && most[0].share === 0.75 && most[0].max === 0.5, `${name}: ${JSON.stringify(most)}`);
        same(await names(e), before, `${name}: the target is as it was`);
        same(counts(await run(e, make(dialect, spec({ strategy: "snapshot", source: { kind: "rows", rows: people("a1", "a2", "a3") } })))), [3, 0, 3, 1], `${name}: a smaller share is allowed`);
        await run(e, make(dialect, spec({ source: { kind: "rows", rows: people("a1", "a2", "a3", "a4") } })));
        same(counts(await run(e, make(dialect, spec({ strategy: "snapshot", source: { kind: "rows", rows: people("a1", "a2") } })))), [2, 0, 2, 2], `${name}: exactly half is the most that is allowed`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0022-sql-integrations FR-007", "0022-sql-integrations FR-008", "0022-sql-integrations FR-010"],
  "every load is a row of the ledger with its counts and the hash of what it landed, and an append of rows that have not changed does nothing",
  async () => {
    same(settingsOf(), { ledger: "integration_run", landing: "landing", skipUnchanged: "append", maxDeleteShare: 0.5, delimiter: "," });
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const app = make(dialect, spec({ strategy: "append" }));
        const first = await run(e, app);
        same([first.outcome, first.hash.length], ["loaded", 64]);
        const second = await run(e, app);
        same([second.outcome, second.hash, counts(second)], ["unchanged", first.hash, [2, 0, 0, 0]], `${name}: the same rows again`);
        same(Number((await e.rows(`SELECT count(*) n FROM "author"`))[0]?.["n"]), 2, `${name}: nothing doubled`);
        const ledger = await e.rows(`SELECT "name", "seq", "source", "source_hash", "strategy", "landed", "inserted" FROM "integration_run"`);
        same(ledger.map((r) => [r["name"], Number(r["seq"]), r["source"], r["source_hash"], r["strategy"], Number(r["landed"]), Number(r["inserted"])]), [["authors", 1, "rows:typescript", first.hash, "append", 2, 2]], `${name}: one row for the one load`);
        // other rows are another load, and the setting turns the skip off or on for every strategy
        const next = await run(e, make(dialect, spec({ strategy: "append", source: { kind: "rows", rows: people("a8") } })));
        same([next.outcome, next.hash === first.hash], ["loaded", false]);
        const up = make(dialect, spec({ source: { kind: "rows", rows: people("a8") } }));
        same((await run(e, up)).outcome, "loaded", `${name}: an upsert is made again by default`);
        same((await run(e, up, { skipUnchanged: "all" })).outcome, "unchanged");
        same((await e.rows(`SELECT "seq" FROM "integration_run" WHERE "name" = 'authors' ORDER BY "seq"`)).map((r) => Number(r["seq"])), [1, 2, 3]);
        const named = await run(e, make(dialect, spec({ name: "other" })), { ledger: "load_ledger" });
        same((await e.rows(`SELECT "name" FROM "load_ledger"`))[0]?.["name"], "other");
        void named;
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0022-sql-integrations FR-002"],
  "CSV text is parsed with quotes and read into the target's types, an empty field is null, and a header the contract does not name is refused",
  async () => {
    const csv = 'id,name,born\na1,"Smith, Ann",1990-01-02\na2,"She said ""hi""\nthere",\r\na3,Cy,2001-12-31\n';
    same(parseCsv(csv), [["id", "name", "born"], ["a1", "Smith, Ann", "1990-01-02"], ["a2", 'She said "hi"\nthere', ""], ["a3", "Cy", "2001-12-31"]]);
    same(parseCsv("a;b\n1;2", ";"), [["a", "b"], ["1", "2"]]);
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const r = await run(e, make(dialect, spec({ source: { kind: "csv", text: csv } })));
        same(counts(r), [3, 3, 0, 0], `${name}: three rows`);
        const rows = await e.rows(`SELECT "id", "name", "born" FROM "author" ORDER BY "id"`);
        same(rows.map((x) => x["name"]), ["Smith, Ann", 'She said "hi"\nthere', "Cy"]);
        same(rows.map((x) => (x["born"] === null ? null : x["born"] instanceof Date ? x["born"].toISOString().slice(0, 10) : String(x["born"]).slice(0, 10))), ["1990-01-02", null, "2001-12-31"], `${name}: typed, with an empty field null`);
        const semi = await run(e, make(dialect, spec({ name: "semi", source: { kind: "csv", text: "id;name\nz1;Zed", delimiter: ";" } })));
        same(semi.inserted, 1);
        const stray = await refused(e, make(dialect, spec({ source: { kind: "csv", text: "id,name,born\na1,x,1990-01-01" }, columns: ["id", "name"] })));
        same(stray[0]?.kind, "source", `${name}: a header the contract does not name`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0022-sql-integrations FR-002"],
  "a table of another database file is attached for the load and detached, on the engines that can attach, and refused as a value on the one that cannot; an adapter gives rows, fails, or gives a column the contract does not",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "integrations-"));
    const sqliteFile = join(dir, "old.sqlite");
    const old = new DatabaseSync(sqliteFile);
    old.exec(`CREATE TABLE "author" ("id" TEXT, "name" TEXT, "born" TEXT); INSERT INTO "author" VALUES ('o1', 'Old One', NULL), ('o2', 'Old Two', '1950-05-05');`);
    old.close();
    const duckFile = join(dir, "old.duckdb");
    const inst = await DuckDBInstance.create(duckFile);
    const conn = await inst.connect();
    await conn.run(`CREATE TABLE "author" ("id" VARCHAR, "name" VARCHAR, "born" DATE); INSERT INTO "author" VALUES ('o1', 'Old One', NULL), ('o2', 'Old Two', '1950-05-05');`);
    conn.closeSync();
    inst.closeSync();
    const files = { sqlite: sqliteFile, duckdb: duckFile, postgres: sqliteFile };
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const l = make(dialect, spec({ source: { kind: "attached", file: files[name], relation: "author" }, columns: ["id", "name", "born"] }));
        if (name === "postgres") {
          same((await refused(e, l))[0]?.kind, "unsupported", "PostgreSQL cannot attach");
          continue;
        }
        same(counts(await run(e, l)), [2, 2, 0, 0], `${name}: attached`);
        same(await names(e), [["o1", "Old One"], ["o2", "Old Two"]]);
        same((await run(e, l)).updated, 2, `${name}: and again`);
      } finally {
        await e.close();
      }
    }
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const adapter = (rows: readonly Record<string, unknown>[] | string) => ({ name: "crm", read: async () => (typeof rows === "string" ? err(rows) : ok(rows)) });
        const via = (a: ReturnType<typeof adapter>) => make(dialect, spec({ source: { kind: "adapter", adapter: a }, columns: ["id", "name"] }));
        same(counts(await run(e, via(adapter(people("k1", "k2"))))), [2, 2, 0, 0], `${name}: an adapter's rows`);
        const bad = await refused(e, via(adapter("the CRM is down")));
        same(bad, [{ kind: "adapter", adapter: "crm", message: "the CRM is down" }]);
        const thrown = await refused(e, via({ name: "crm", read: async () => { throw new Error("boom"); } }));
        same(thrown[0], { kind: "adapter", adapter: "crm", message: "boom" });
        same((await refused(e, via(adapter([{ id: "x", name: "y", shoe: 1 }]))))[0]?.kind, "source");
        same(await names(e), [["k1", "Name k1"], ["k2", "Name k2"]], `${name}: only the good load changed anything`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0022-sql-integrations FR-009"],
  "lineage is the edges from the source to the landing and the landing to the target, and what reaches a node is found nearest first",
  () => {
    const l = make(postgres(), spec({ source: { kind: "csv", text: "id,name\na,b", label: "authors.csv" } }));
    const edges = lineageOf(l);
    same(edges, [
      { via: "authors", kind: "integration", from: "csv:authors.csv", to: "landing:authors" },
      { via: "authors", kind: "load", from: "landing:authors", to: "author" },
    ]);
    same(upstream(edges, "author"), ["landing:authors", "csv:authors.csv"]);
    same(upstream(edges, "csv:authors.csv"), []);
  },
);
