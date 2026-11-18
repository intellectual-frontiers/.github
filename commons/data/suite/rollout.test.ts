// Spec: 0020-sql-parallel-versions FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Parallel versions (commons data 0020-sql-parallel-versions), on real engines: two versions of an application use one database at once through schemas of views with their own names; the
 * expand is renames and additions only; retiring the older version drops its schema and the contract quarantines what only it used.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { expandSchema, retireStatements, schemaOf, settingsOf, versionViews } from "@intellectual-frontiers/data/sql/extensions/rollout";
import { safety } from "@intellectual-frontiers/data/sql/extensions/safety";
import { emptyState, execute, plan, type Plan, snapshotOf, stateHash, type StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, naming, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { DIALECTS, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const s = safety();
const transforms: readonly StepTransform[] = [...s.transforms, idempotency()];
const v2 = libraryAt(2);
const v3 = libraryAt(3);
const versions = [{ label: "v2", schema: v2 }, { label: "v3", schema: v3 }];
const stateOf = (schema: LogicalSchema, d: Dialect) => must(snapshotOf(schema, { dialect: d }));
const emptyOf = (d: Dialect): string => stateHash(emptyState(d.name, { names: "snake", codes: "snake" }));
const planTo = (d: Dialect, from: ReturnType<typeof stateOf> | undefined, schema: LogicalSchema, live: typeof versions): Plan =>
  must(plan(from, schema, { dialect: d, sources: [versionViews(live)] }, { transforms }));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};

proves(
  ["0020-sql-parallel-versions FR-001"],
  "the expanded schema is the latest with what older versions still use kept as optional and what only the latest has made optional, a renamed column being the same column",
  () => {
    const during = expandSchema(v3, [v2]);
    const author = during.tables.find((t) => t.name.join(".") === "author");
    same(author?.columns.map((c) => c.name.join(".")).sort(), ["born", "full.name", "id"], "born is kept, name is full_name");
    assert(author?.columns.find((c) => c.name.join(".") === "born")?.nullable === true);
    same(expandSchema(v3, []), v3, "one live version: nothing is kept");
    // a column only the latest has is made optional; a table only an older version has is kept
    const strict = libraryAt(3, true, false, false, { requiredPages: true });
    const book = expandSchema(strict, [libraryAt(1)]).tables.find((t) => t.name.join(".") === "book");
    assert(book?.columns.find((c) => c.name.join(".") === "pages")?.nullable === true, "pages is optional while version 1 lives");
    assert(strict.tables.find((t) => t.name.join(".") === "book")?.columns.find((c) => c.name.join(".") === "pages")?.nullable === false);
    const kept = expandSchema(libraryAt(1), [libraryAt(1, true, true)]);
    assert(kept.tables.some((t) => t.name.join(".") === "scratch" && t.foreignKeys.length === 0), "a table the latest lacks is kept");
  },
);

proves(
  ["0020-sql-parallel-versions FR-002", "0020-sql-parallel-versions FR-003", "0020-sql-parallel-versions FR-004", "0020-sql-parallel-versions FR-005", "0020-sql-parallel-versions FR-006", "0020-sql-parallel-versions FR-008"],
  "on PostgreSQL two versions use one database at once under their own names, the expand destroys nothing, retiring the older drops its schema, and the contract quarantines what only it used",
  async () => {
    await withEngine("postgres", async (e) => {
      const d = driverOf(e);
      const r1 = await execute(planTo(postgres, undefined, v2, [versions[0]!]), d, postgres, { empty: emptyOf(postgres) });
      assert(r1.kind === "ok", JSON.stringify(r1));
      await e.run(`INSERT INTO "api_v2"."author" ("id", "name", "born") VALUES ('a1', 'Ann', '1990-01-02')`);
      // the expand
      const during = expandSchema(v3, [v2]);
      const expand = planTo(postgres, stateOf(v2, postgres), during, versions);
      assert(expand.steps.length > 0 && expand.steps.every((x) => !["dropColumn", "dropTable", "removeRows"].includes(x.kind)), "nothing that destroys");
      same(expand.steps.filter((x) => x.kind === "renameColumn").map((x) => x.name), ["rename column author.name to full_name"]);
      const r2 = await execute(expand, d, postgres, { empty: emptyOf(postgres) });
      assert(r2.kind === "ok", JSON.stringify(r2));
      const cols = async (schema: string, table: string): Promise<string[]> =>
        (await e.rows(`SELECT column_name c FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY column_name`)).map((r) => String(r["c"]));
      same(await cols("api_v2", "author"), ["born", "id", "name"], "the older version sees its own names");
      same(await cols("api_v3", "author"), ["full_name", "id"], "the newer sees its own, and not what is kept for the older");
      same(await cols("api_v3", "book"), ["author_id", "genre_code", "id", "pages", "title"]);
      same((await e.rows(`SELECT "name" FROM "api_v2"."author"`)).map((r) => r["name"]), ["Ann"], "what was written before is read under the old name");
      same((await e.rows(`SELECT "full_name" FROM "api_v3"."author"`)).map((r) => r["full_name"]), ["Ann"], "and under the new");
      // a row written through either is read through the other, with nothing copied
      await e.run(`INSERT INTO "api_v3"."author" ("id", "full_name") VALUES ('a2', 'Bo')`);
      await e.run(`INSERT INTO "api_v2"."author" ("id", "name") VALUES ('a3', 'Cy')`);
      same((await e.rows(`SELECT "name" FROM "api_v2"."author" ORDER BY "id"`)).map((r) => r["name"]), ["Ann", "Bo", "Cy"], "version 2 reads what version 3 wrote");
      same((await e.rows(`SELECT "full_name" FROM "api_v3"."author" ORDER BY "id"`)).map((r) => r["full_name"]), ["Ann", "Bo", "Cy"], "version 3 reads what version 2 wrote, and born was not refused");
      await e.run(`UPDATE "api_v2"."author" SET "name" = 'Anne' WHERE "id" = 'a1'`);
      same((await e.rows(`SELECT "full_name" FROM "api_v3"."author" WHERE "id" = 'a1'`))[0]?.["full_name"], "Anne");
      // retiring the older version, then the contract
      for (const sql of retireStatements(versions[0]!, postgres, naming())) await e.run(sql);
      const contract = planTo(postgres, stateOf(during, postgres), v3, [versions[1]!]);
      const drop = contract.steps.find((x) => x.kind === "dropColumn");
      assert(drop?.class === "data-dependent" && drop.reversibility === "quarantine", "what only the older used is quarantined");
      const r3 = await execute(contract, d, postgres, { empty: emptyOf(postgres) });
      assert(r3.kind === "ok", JSON.stringify(r3));
      for (const sql of retireStatements(versions[0]!, postgres, naming())) await e.run(sql);
      const schemas = (await e.rows(`SELECT schema_name n FROM information_schema.schemata WHERE schema_name LIKE 'api_%'`)).map((r) => String(r["n"]));
      same(schemas, ["api_v3"], "the older version's schema is gone, twice without harm");
      same((await e.rows(`SELECT "id", "born" FROM "author_born_quarantine" ORDER BY "id"`)).length, 3, "its born column is in quarantine");
      same((await e.rows(`SELECT "full_name" FROM "api_v3"."author" ORDER BY "id"`)).length, 3, "and the latest alone still works");
    });
  },
);

proves(
  ["0020-sql-parallel-versions FR-003", "0020-sql-parallel-versions FR-007", "0020-sql-parallel-versions FR-008"],
  "the schema's pattern and the primary version are settings, DuckDB's views read, and SQLite's views carry the version's label in their names",
  async () => {
    same(settingsOf(), { pattern: "api_{label}", primary: undefined, grants: true });
    same(schemaOf("v2", settingsOf({ pattern: "app_{label}_x" })), "app_v2_x");
    const during = expandSchema(v3, [v2]);
    const b = bind(during, { dialect: postgres, sources: [versionViews(versions, { pattern: "ver_{label}", primary: "v3" })] });
    assert(b.kind === "ok");
    if (b.kind === "ok") {
      const sql = b.value.statements.map((x) => x.sql).join("\n");
      assert(sql.includes('CREATE VIEW "ver_v2"."author"') && !sql.includes('"ver_v3"'), "the primary version's views are the protection layer's");
      assert(sql.includes('"full_name" AS "name"'));
    }
    for (const [name, d] of [["duckdb", duckdb], ["sqlite", sqlite]] as const) {
      await withEngine(name, async (e) => {
        const dr = driverOf(e);
        // DuckDB cannot alter a table other tables reference, so it is given the expanded schema whole; SQLite expands in place
        if (name === "duckdb") {
          const r = await execute(planTo(d, undefined, during, versions), dr, d, { empty: emptyOf(d) });
          assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
          await e.run(`INSERT INTO "author" ("id", "full_name", "born") VALUES ('a1', 'Ann', NULL)`);
        } else {
          assert((await execute(planTo(d, undefined, v2, []), dr, d, { empty: emptyOf(d) })).kind === "ok");
          await e.run(`INSERT INTO "author" ("id", "name", "born") VALUES ('a1', 'Ann', NULL)`);
          const r = await execute(planTo(d, stateOf(v2, d), during, versions), dr, d, { empty: emptyOf(d) });
          assert(r.kind === "ok", `${name}: ${JSON.stringify(r)}`);
        }
        const a = await e.rows(name === "duckdb" ? `SELECT "name" FROM "api_v2"."author"` : `SELECT "name" FROM "v2_author"`);
        const c = await e.rows(name === "duckdb" ? `SELECT "full_name" FROM "api_v3"."author"` : `SELECT "full_name" FROM "v3_author"`);
        same([a[0]?.["name"], c[0]?.["full_name"]], ["Ann", "Ann"], `${name}: both versions read`);
      });
    }
    same([...retireStatements(versions[0]!, sqlite, naming())].sort(), ['DROP VIEW IF EXISTS "v2_author";', 'DROP VIEW IF EXISTS "v2_book";', 'DROP VIEW IF EXISTS "v2_genre";', 'DROP VIEW IF EXISTS "v2_publisher";']);
    void DIALECTS;
  },
);
