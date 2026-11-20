// Spec: 0023-sql-transforms FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Transforms (commons data 0023-sql-transforms), on real engines: models whose SQL asks for names by their words, built in order, each in one transaction with its tests; a model whose tests find
 * rows that are wrong is not published and what was there is still there.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import {
  build,
  type BuildReport,
  type ModelSpec,
  type Project,
  settingsOf,
  type TransformOptions,
  transformer,
} from "@intellectual-frontiers/data/sql/extensions/transforms";
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
  await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann'), ('a2', 'Bo'), ('a3', 'Cy')`);
  return e;
};
const project = (d: Dialect, models: readonly ModelSpec[], more: Partial<TransformOptions> = {}): Project => {
  const r = transformer(schema, models, { dialect: d, ...more });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const count = async (e: Engine, rel: string): Promise<number> => Number((await e.rows(`SELECT count(*) n FROM ${rel}`))[0]?.["n"]);
const outcomes = (r: BuildReport): string[] => r.models.map((m) => `${m.name}:${m.outcome}`);

const names: ModelSpec = { name: "author names", materialization: "table", select: (r) => `SELECT ${r.column("author", "id")} AS id, ${r.column("author", "name")} AS name FROM ${r.table("author")}`, tests: [{ kind: "unique", columns: ["id"] }, { kind: "not-null", column: "name" }] };
const shout: ModelSpec = { name: "shouting", select: (r) => `SELECT id, UPPER(name) AS name FROM ${r.table("author names")}` };

proves(
  ["0023-sql-transforms FR-001", "0023-sql-transforms FR-002", "0023-sql-transforms FR-003"],
  "a project is made in the order of what each model reads, with lineage, and a name that is not there, a cycle, a duplicate, a missing key and a test of an ephemeral model are errors as values",
  () => {
    const d = DIALECTS[2].dialect;
    const p = project(d, [shout, names]);
    same(p.models.map((m) => m.name), ["author names", "shouting"], "a model after what it reads");
    same(p.lineage, [
      { via: "author names", kind: "transform", from: "author", to: "author.names" },
      { via: "shouting", kind: "transform", from: "author.names", to: "shouting" },
    ]);
    same(p.models[0]?.ref, '"author_names"');
    same(project(d, [names], { schema: "data" }).models[0]?.ref, '"data"."author_names"', "in the tables' schema");
    same(project(d, [names], { schema: "data", settings: { schema: "analytics" } }).models[0]?.ref, '"analytics"."author_names"', "or where the setting says");
    same(project(DIALECTS[0].dialect, [names], { settings: { schema: "analytics" } }).models[0]?.ref, '"analytics_author_names"', "its words first where there are no schemas");
    const bad = (models: ModelSpec[]) => {
      const r = transformer(schema, models, { dialect: d });
      return r.kind === "err" ? r.error.map((e) => e.kind) : ["ok"];
    };
    same(bad([{ name: "m", select: (r) => `SELECT * FROM ${r.table("nope")}` }]), ["unknown-table"]);
    same(bad([{ name: "m", select: (r) => `SELECT ${r.column("author", "shoe")} FROM ${r.table("author")}` }]), ["unknown-column"]);
    same(bad([{ name: "a", select: (r) => `SELECT * FROM ${r.table("b")}` }, { name: "b", select: (r) => `SELECT * FROM ${r.table("a")}` }]), ["cycle"]);
    same(bad([names, names]), ["duplicate"]);
    same(bad([{ name: "i", materialization: "incremental", select: () => "SELECT 1 AS x" }]), ["no-key"]);
    same(bad([{ name: "e", materialization: "ephemeral", select: () => "SELECT 1 AS x", tests: [{ kind: "not-null", column: "x" }] }]), ["ephemeral-test"]);
    same(settingsOf(), { schema: undefined, ledger: "transform_run", sample: 5 });
  },
);

proves(
  ["0023-sql-transforms FR-004", "0023-sql-transforms FR-007"],
  "on three engines a view, a table, an ephemeral and an incremental model are made as they say, a table is made again under the views that read it, and each build is in the ledger",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const eph: ModelSpec = { name: "named", materialization: "ephemeral", select: (r) => `SELECT id, name FROM ${r.table("author")} WHERE name <> 'Bo'` };
        const fromEph: ModelSpec = { name: "not bo", materialization: "table", select: (r) => `SELECT id FROM ${r.table("named")} AS n` };
        const log: ModelSpec = { name: "author log", materialization: "incremental", key: ["id"], select: (r) => `SELECT ${r.column("author", "id")} AS id, ${r.column("author", "name")} AS name FROM ${r.table("author")}` };
        const p = project(dialect, [shout, names, eph, fromEph, log]);
        const first = await build(driverOf(e), p);
        assert(first.ok, `${name}: ${JSON.stringify(first)}`);
        same(outcomes(first), ["author names:built", "shouting:built", "named:ephemeral", "not bo:built", "author log:built"]);
        same((await e.rows(`SELECT "name" FROM "shouting" ORDER BY "id"`)).map((r) => r["name"]), ["ANN", "BO", "CY"], `${name}: a view over a table model`);
        same(await count(e, "not_bo"), 2, `${name}: an ephemeral model written in`);
        // new rows and a changed row: the table is made again, the incremental adds and never changes
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a4', 'Di')`);
        await e.run(`UPDATE "author" SET "name" = 'Ann Two' WHERE "id" = 'a1'`);
        const second = await build(driverOf(e), p);
        assert(second.ok, `${name}: ${JSON.stringify(second)}`);
        same(await count(e, "author_names"), 4, `${name}: the table is made again, under its view`);
        same(await count(e, "shouting"), 4, `${name}: and the view still reads it`);
        same((await e.rows(`SELECT "id", "name" FROM "author_log" ORDER BY "id"`)).map((r) => r["name"]), ["Ann", "Bo", "Cy", "Di"], `${name}: incremental adds, never changes`);
        const ledger = await e.rows(`SELECT "name", "seq", "row_count" FROM "transform_run" WHERE "name" IN ('author names', 'author log') ORDER BY "name", "seq"`);
        same(ledger.map((r) => [r["name"], Number(r["seq"]), Number(r["row_count"])]), [["author log", 1, 3], ["author log", 2, 4], ["author names", 1, 3], ["author names", 2, 4]]);
        // some models: and what reads them
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a5', 'Ed')`);
        const some = await build(driverOf(e), p, ["author names"]);
        same(outcomes(some), ["author names:built", "shouting:built"], `${name}: and what reads it`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0023-sql-transforms FR-005", "0023-sql-transforms FR-006"],
  "a model whose test of severity error finds a row is rolled back, what was published stays, what reads it is blocked, and a warning is reported and does not stop the build",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const uniqueNames: ModelSpec = {
          name: "unique names",
          materialization: "table",
          select: (r) => `SELECT ${r.column("author", "name")} AS name FROM ${r.table("author")}`,
          tests: [
            { kind: "unique", columns: ["name"] },
            { kind: "accepted-values", column: "name", values: ["Ann", "Bo", "Cy"], severity: "warn" },
          ],
        };
        const reader: ModelSpec = { name: "name view", select: (r) => `SELECT * FROM ${r.table("unique names")}` };
        const p = project(dialect, [uniqueNames, reader]);
        const ok1 = await build(driverOf(e), p);
        assert(ok1.ok && ok1.models[0]?.rows === 3, `${name}: ${JSON.stringify(ok1)}`);
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a4', 'Ann'), ('a5', 'Zed')`);
        const bad = await build(driverOf(e), p);
        assert(!bad.ok, `${name}: a duplicate`);
        same(outcomes(bad), ["unique names:failed", "name view:blocked"]);
        const f = bad.models[0]?.findings ?? [];
        assert(f.length === 2, `${name}: ${JSON.stringify(f)}`);
        const dup = f.find((x) => x.kind === "unique");
        assert(dup !== undefined && dup.severity === "error" && dup.failing === 1 && dup.sample[0]?.["name"] === "Ann", `${name}: ${JSON.stringify(dup)}`);
        const warn = f.find((x) => x.kind === "accepted-values");
        assert(warn !== undefined && warn.severity === "warn" && warn.failing === 1 && warn.sample[0]?.["name"] === "Zed", `${name}: ${JSON.stringify(warn)}`);
        same(bad.models[1]?.blockedBy, "unique names");
        same(await count(e, "unique_names"), 3, `${name}: what was published is still there`);
        same(await count(e, "name_view"), 3, `${name}: and its view reads it`);
        same(Number((await e.rows(`SELECT count(*) n FROM "transform_run" WHERE "name" = 'unique names'`))[0]?.["n"]), 1, `${name}: the failed build is not in the ledger`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0023-sql-transforms FR-005"],
  "a relationship, a not-null and a test of one's own find the rows that are wrong, by the names of the schema",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const m: ModelSpec = {
          name: "checked",
          materialization: "table",
          select: (r) => `SELECT ${r.column("author", "id")} AS id, 'zz' AS ghost, NULL AS missing FROM ${r.table("author")}`,
          tests: [
            { kind: "relationship", column: "ghost", to: "author", toColumn: "id", severity: "warn" },
            { kind: "not-null", column: "missing", severity: "warn" },
            { kind: "custom", name: "no author called Cy", severity: "warn", failing: (r) => `SELECT * FROM ${r.table("author")} WHERE ${r.column("author", "name")} = 'Cy'` },
          ],
        };
        const r = await build(driverOf(e), project(dialect, [m]));
        assert(r.ok, `${name}: ${JSON.stringify(r)}`);
        same(r.models[0]?.findings.map((f) => [f.kind, f.failing]), [["relationship", 3], ["not-null", 3], ["custom", 1]], name);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0023-sql-transforms FR-008"],
  "models can be written in a schema of their own, and in prefixed names where the dialect has no schemas",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        if (dialect.features.includes("schemas")) await e.run(`CREATE SCHEMA "analytics"`);
        const r = await build(driverOf(e), project(dialect, [names], { settings: { schema: "analytics", ledger: "runs" } }));
        assert(r.ok, `${name}: ${JSON.stringify(r)}`);
        const ref = dialect.features.includes("schemas") ? `"analytics"."author_names"` : `"analytics_author_names"`;
        same(await count(e, ref), 3);
        same(await count(e, dialect.features.includes("schemas") ? `"analytics"."runs"` : `"analytics_runs"`), 1, `${name}: the ledger is there too`);
      } finally {
        await e.close();
      }
    }
  },
);
