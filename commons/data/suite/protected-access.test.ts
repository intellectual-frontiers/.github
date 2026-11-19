// Spec: 0014-sql-protected-access FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
/**
 * The protection layer (commons data 0014-sql-protected-access), on real engines: tables in a schema of their own and a view of each in another; rows written through the views; on PostgreSQL
 * roles that own nothing seeing only their scope through the views and nothing of the tables, and a guard that refuses a change of a table outside a migration; a column renamed staying in its
 * view; masks; steps that drop and make views again around the change they make; and the plans of a domain's versions run with the layer on three engines.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { compose } from "@intellectual-frontiers/data/engine";
import { annotate, attribute, concept, domain, identifier, integer, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { documentationSources } from "@intellectual-frontiers/data/sql/extensions/documentation";
import { accessSource } from "@intellectual-frontiers/data/sql/extensions/access";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import {
  capabilities,
  defaultSettings,
  protection,
  protectionExtension,
  settingsOf,
} from "@intellectual-frontiers/data/sql/extensions/protected-access";
import {
  applyStatement,
  dueRepeatables,
  emptyState,
  execute,
  plan,
  type Plan,
  type Driver,
  snapshotOf,
  type State,
  type StepTransform,
  stateHash,
  transformsFrom,
} from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect, render, sourcesFrom } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, refuses, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";
import { projected } from "./logical-fixture.ts";

const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const bound = (
  d: Dialect,
  schema = libraryAt(1),
  given: Parameters<typeof protection>[0] = {},
  extra: Parameters<typeof bind>[1]["sources"] = [],
) => {
  const p = protection(given);
  return must(bind(schema, { dialect: d, ...p.bind, sources: [...p.bind.sources, ...extra] }));
};
/** The tables and views of an engine, by schema. */
const objects = async (e: Engine): Promise<Record<string, string[]>> => {
  const rows =
    e.name === "postgres"
      ? await e.rows(
          "SELECT table_schema s, table_name n, table_type t FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')",
        )
      : e.name === "duckdb"
        ? [
            ...(await e.rows("SELECT schema_name s, table_name n, 'BASE TABLE' t FROM duckdb_tables()")),
            ...(await e.rows("SELECT schema_name s, view_name n, 'VIEW' t FROM duckdb_views() WHERE NOT internal")),
          ]
        : (await e.rows("SELECT name n, type t FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'")).map(
            (r) => ({ s: "main", n: r["n"], t: r["t"] === "view" ? "VIEW" : "BASE TABLE" }),
          );
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[`${String(r["s"])}.${String(r["t"]) === "VIEW" ? "view" : "table"}`] ??= []).push(String(r["n"]));
  for (const k of Object.keys(out)) out[k]?.sort();
  return out;
};

proves(["0014-sql-protected-access FR-001"], "the settings are typed, each has a default, and a project can change each", () => {
  same(settingsOf(), defaultSettings);
  same(
    [
      defaultSettings.tablesSchema,
      defaultSettings.viewsSchema,
      defaultSettings.enforcement,
      defaultSettings.guard,
      defaultSettings.masks,
      defaultSettings.migratingSetting,
    ],
    ["data", "api", "auto", true, true, "lifecycle.migrating"],
  );
  const s = settingsOf({
    tablesSchema: "store",
    viewsSchema: "app",
    enforcement: "convention",
    guard: "off",
    masks: "off",
    unmaskedRoles: ["dpo"],
    migratingSetting: "my.flag",
    owner: "migrator",
  });
  same(
    [s.tablesSchema, s.viewsSchema, s.enforcement, s.guard, s.masks, s.unmaskedRoles, s.migratingSetting, s.owner],
    ["store", "app", "convention", false, false, ["dpo"], "my.flag", "migrator"],
  );
  const sql = render(bound(postgres, libraryAt(1), { tablesSchema: "store", viewsSchema: "app" }));
  assert(
    sql.includes('CREATE TABLE IF NOT EXISTS "store"."book"') &&
      sql.includes('CREATE VIEW "app"."book"') &&
      !sql.includes('"api"') &&
      !sql.includes('"data"'),
  );
});

proves(
  ["0014-sql-protected-access FR-002", "0014-sql-protected-access FR-003", "0014-sql-protected-access FR-013"],
  "the tables are in their schema and a view of each is in the other, read through on every engine, with the comment, and no view for a table of an extension",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const b = bound(dialect, libraryAt(2), {}, documentationSources({ documentationTables: "always" }));
        const sql = render(b);
        assert(sql.includes("DROP VIEW IF EXISTS") && sql.includes("CREATE VIEW"), name);
        assert(dialect.features.includes("comment-on") === sql.includes("COMMENT ON VIEW"), `${name}: the comment where there is one`);
        assert(
          dialect.features.includes("updatable-views") === sql.includes("security_barrier"),
          `${name}: a security barrier on PostgreSQL`,
        );
        await load(e, b);
        const o = await objects(e);
        if (name === "sqlite") {
          same(o["main.view"], ["author", "book", "genre", "publisher"]);
          assert(
            (o["main.table"] ?? []).every((t) => t.startsWith("data_")),
            `${name}: ${(o["main.table"] ?? []).join(", ")}`,
          );
          assert(
            !(o["main.view"] ?? []).some((v) => v.startsWith("documentation") || v.startsWith("governance")),
            "no view of an extension's table",
          );
        } else {
          same(o["api.view"], ["author", "book", "genre", "publisher"], `${name}: the views`);
          same(o["api.table"], undefined, `${name}: no table in the views' schema`);
          assert(
            ["author", "book", "documentation", "genre", "governance_annotation", "governance_trace", "publisher"].every((t) =>
              o["data.table"]?.includes(t),
            ),
            `${name}: the tables`,
          );
          same(
            Object.keys(o).filter((k) => !["api.view", "data.table"].includes(k)),
            [],
            `${name}: nowhere else`,
          );
        }
        const sch = name === "sqlite" ? ["", '"data_'] : ['"data".', '"'];
        await e.run(`INSERT INTO ${sch[0]}${sch[1]}author" ("id", "name", "born") VALUES ('a1', 'Ann', NULL)`.replace('""', '"'));
        const rows = await e.rows(`SELECT * FROM ${name === "sqlite" ? '"author"' : '"api"."author"'}`);
        same(
          rows.map((r) => r["name"]),
          ["Ann"],
          `${name}: read through the view`,
        );
        if (name === "postgres")
          same((await e.rows(`SELECT obj_description('"api"."book"'::regclass, 'pg_class') AS c`))[0]?.["c"], "A written work");
      });
    }
  },
);

proves(
  ["0014-sql-protected-access FR-004"],
  "a row is inserted, updated and deleted through the view on PostgreSQL and SQLite, and DuckDB's views are read-only and say so",
  async () => {
    const seed = async (e: Engine, view: string, table: string): Promise<void> => {
      await e.run(`INSERT INTO ${table} ("id", "name") VALUES ('seed', 'Seed')`);
      same((await e.rows(`SELECT "id" FROM ${view}`)).length, 1);
    };
    await withEngine("postgres", async (e) => {
      await load(e, bound(postgres));
      await e.run(`INSERT INTO "api"."author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(`UPDATE "api"."author" SET "name" = 'Anne' WHERE "id" = 'a1'`);
      same(
        (await e.rows(`SELECT "name" FROM "data"."author"`)).map((r) => r["name"]),
        ["Anne"],
        "the table holds what was written through the view",
      );
      await e.run(`DELETE FROM "api"."author" WHERE "id" = 'a1'`);
      same((await e.rows(`SELECT "id" FROM "data"."author"`)).length, 0);
    });
    await withEngine("sqlite", async (e) => {
      const b = bound(sqlite);
      assert(render(b).includes("INSTEAD OF INSERT") && render(b).includes("INSTEAD OF UPDATE") && render(b).includes("INSTEAD OF DELETE"));
      await load(e, b);
      await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
      await e.run(`UPDATE "author" SET "name" = 'Anne' WHERE "id" = 'a1'`);
      same(
        (await e.rows(`SELECT "name" FROM "data_author"`)).map((r) => r["name"]),
        ["Anne"],
      );
      await e.run(`DELETE FROM "author" WHERE "id" = 'a1'`);
      same((await e.rows(`SELECT "id" FROM "data_author"`)).length, 0);
    });
    await withEngine("duckdb", async (e) => {
      const b = bound(duckdb);
      assert(!render(b).includes("TRIGGER"), "no trigger where there are none");
      await load(e, b);
      assert(await refuses(e, `INSERT INTO "api"."author" ("id", "name") VALUES ('a1', 'Ann')`), "a view of DuckDB is read-only");
      await seed(e, '"api"."author"', '"data"."author"');
    });
    assert(capabilities(postgres).writableViews && capabilities(sqlite).writableViews && !capabilities(duckdb).writableViews);
    assert(
      capabilities(duckdb).notes.some((n) => n.includes("read-only views")) &&
        capabilities(duckdb).notes.some((n) => n.includes("convention")),
    );
    same(capabilities(postgres), { enforced: true, writableViews: true, notes: [] });
  },
);

const security2 = vocabularies.security;
const document = concept("document", {
  definition: "A paper kept for a tenant",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    tenant: attribute(text(), { definition: "Whose it is", annotations: [annotate(security2.scope, { name: "tenant" })] }),
    title: attribute(text(), { definition: "What it is called" }),
  },
  identifiedBy: ["id"],
  annotations: [annotate(security2.access, { read: ["reader", "writer"], write: ["writer"] })],
});
const documents = (() => {
  const d = domain("papers", { definition: "Papers", concepts: [document] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
})();

proves(
  ["0014-sql-protected-access FR-005", "0014-sql-protected-access FR-006", "0014-sql-protected-access FR-012"],
  "on PostgreSQL a role that owns nothing sees through the view only the rows of its scope and cannot read the table, a writer writes only in its scope, and the guard refuses a change of a table outside a migration",
  async () => {
    await withEngine("postgres", async (e) => {
      await e.run("CREATE ROLE migrator; CREATE ROLE reader; CREATE ROLE writer; CREATE ROLE stranger;");
      const p = protection({ owner: "migrator" });
      const b = must(
        bind(documents, {
          dialect: postgres,
          ...p.bind,
          sources: [accessSource({ viewsSchema: p.settings.viewsSchema }), ...p.bind.sources],
        }),
      );
      const sql = render(b);
      assert(
        sql.includes('GRANT SELECT ON "api"."document" TO "reader", "writer";') &&
          sql.includes('GRANT INSERT, UPDATE, DELETE ON "api"."document" TO "writer";'),
        "grants on the view",
      );
      assert(
        !sql.includes('ON "data"."document" TO') &&
          sql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA "data" FROM PUBLIC;') &&
          sql.includes('GRANT USAGE ON SCHEMA "api" TO "reader", "writer";'),
      );
      assert(
        sql.includes("FORCE ROW LEVEL SECURITY") &&
          sql.includes('CREATE POLICY "document_tenant_all" ON "data"."document" FOR ALL USING') &&
          !/CREATE POLICY[^;]* TO /.test(sql),
        "one policy that names no role",
      );
      await load(e, b);
      await e.run(`INSERT INTO "data"."document" VALUES ('d1', 'a', 'Alpha'), ('d2', 'b', 'Beta')`);
      // the reader sees its scope through the view and nothing of the table
      await e.run("SET ROLE reader");
      await e.run("SET app.tenant = 'a'");
      same(
        (await e.rows(`SELECT "id" FROM "api"."document"`)).map((r) => r["id"]),
        ["d1"],
      );
      await e.run("SET app.tenant = 'b'");
      same(
        (await e.rows(`SELECT "id" FROM "api"."document"`)).map((r) => r["id"]),
        ["d2"],
      );
      assert(await refuses(e, `SELECT * FROM "data"."document"`), "no right on the table");
      assert(await refuses(e, `INSERT INTO "api"."document" VALUES ('d9', 'b', 'x')`), "a reader may not write");
      await e.run("RESET ROLE");
      // the writer writes in its scope and not outside it
      await e.run("SET ROLE writer");
      await e.run("SET app.tenant = 'a'");
      await e.run(`INSERT INTO "api"."document" VALUES ('d3', 'a', 'Mine')`);
      assert(await refuses(e, `INSERT INTO "api"."document" VALUES ('d4', 'b', 'Theirs')`), "outside its scope");
      same(
        (await e.rows(`SELECT "id" FROM "api"."document" ORDER BY "id"`)).map((r) => r["id"]),
        ["d1", "d3"],
      );
      await e.run("RESET ROLE");
      // a role governance does not name sees nothing
      await e.run("SET ROLE stranger");
      assert(
        (await refuses(e, `SELECT * FROM "api"."document"`)) && (await refuses(e, `SELECT * FROM "data"."document"`)),
        "no right at all",
      );
      await e.run("RESET ROLE");
      // the guard
      await e.run(`CREATE TABLE "public"."free" ("id" INTEGER)`);
      await e.run(`ALTER TABLE "public"."free" ADD COLUMN "v" INTEGER`);
      assert(await refuses(e, `ALTER TABLE "data"."document" ADD COLUMN "x" INTEGER`), "alter refused");
      assert(await refuses(e, `DROP TABLE "data"."document"`), "drop refused");
      assert(await refuses(e, `ALTER TABLE "data"."document" DROP COLUMN "title"`), "dropping a column refused");
      await e.run(`SELECT set_config('lifecycle.migrating', 'on', false)`);
      await e.run(`ALTER TABLE "data"."document" ADD COLUMN "x" INTEGER`);
      await e.run(`ALTER TABLE "data"."document" DROP COLUMN "x"`);
      await e.run(`SELECT set_config('lifecycle.migrating', '', false)`);
      assert(await refuses(e, `ALTER TABLE "data"."document" ADD COLUMN "y" INTEGER`), "refused again outside a migration");
      same(p.session(postgres), ["SELECT set_config('lifecycle.migrating', 'on', true);"]);
    });
  },
);

proves(
  ["0014-sql-protected-access FR-007"],
  "enforcement asked for where the dialect cannot is an error value, and convention makes the schemas and views and nothing else",
  () => {
    for (const d of [sqlite, duckdb]) {
      const p = protection({ enforcement: "enforced" });
      const r = bind(libraryAt(1), { dialect: d, ...p.bind });
      assert(
        r.kind === "err" &&
          r.error.some((e) => e.kind === "unsupported" && e.why.includes("cannot enforce protected access") && e.why.includes(d.name)),
        d.name,
      );
      const auto = bind(libraryAt(1), { dialect: d, ...protection().bind });
      assert(auto.kind === "ok", `${d.name}: auto is a convention where it cannot enforce`);
      same(protection().session(d), [], `${d.name}: no migration flag`);
    }
    const conv = render(bound(postgres, documents, { enforcement: "convention" }));
    assert(
      conv.includes('CREATE VIEW "api"."document"') && !/GRANT|REVOKE|EVENT TRIGGER|OWNER TO|security.access/.test(conv),
      "no rights and no guard",
    );
    const off = render(bound(postgres, documents, { guard: "off" }));
    assert(off.includes("GRANT SELECT ON") && !off.includes("EVENT TRIGGER"), "enforced without the guard");
    same(protection({ enforcement: "convention" }).session(postgres), []);
    same(protection({ guard: "off" }).session(postgres), []);
    // tables that are not in the schema of the tables
    const wrong = bind(libraryAt(1), { dialect: postgres, sources: protection().bind.sources });
    assert(
      wrong.kind === "err" && wrong.error.some((e) => e.kind === "unsupported" && e.why.includes("give bind the schema of the tables")),
    );
  },
);

const SNAKE = { names: "snake", codes: "snake" } as const;
const stateOf = (v: 1 | 2 | 3, d: Dialect, shim = true): State => must(snapshotOf(libraryAt(v, shim), { dialect: d, schema: "data" }));
const emptyOf = (d: Dialect): string => stateHash(emptyState(d.name, SNAKE, d.features.includes("schemas") ? "data" : undefined));
const kit = protection();
/** The plan from a version of the library to another, with the layer and idempotency. */
const planWith = (
  d: Dialect,
  from: State | undefined,
  v: 1 | 2 | 3,
  shim = true,
  transforms: readonly StepTransform[] = [...kit.transforms, idempotency()],
): Plan => must(plan(from, libraryAt(v, shim), { dialect: d, ...kit.desired }, { allow: { destructive: true }, transforms }));
/** Runs the plans from empty to a version, as a project would. */
const upTo = async (e: Engine, d: Dialect, last: 1 | 2 | 3, shim = true): Promise<void> => {
  let from: State | undefined;
  for (const v of [1, 2, 3] as const) {
    if (v > last) break;
    const r = await execute(planWith(d, from, v, v === 3 ? shim : true), driverOf(e), d, { empty: emptyOf(d), before: kit.session(d) });
    assert(r.kind === "ok", `${d.name} v${v}: ${JSON.stringify(r)}`);
    from = stateOf(v, d, v === 3 ? shim : true);
  }
};
const viewOf = (name: Engine["name"], table: string): string => (name === "sqlite" ? `"${table}"` : `"api"."${table}"`);

proves(
  ["0014-sql-protected-access FR-008"],
  "a renamed attribute stays in its view under its old name for as long as governance says so, and leaves it when the annotation is taken out",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        await upTo(e, dialect, 3);
        const base = name === "sqlite" ? '"data_author"' : '"data"."author"';
        await e.run(`INSERT INTO ${base} ("id", "full_name") VALUES ('a1', 'Ann')`);
        const both = await e.rows(`SELECT "name", "full_name" FROM ${viewOf(name, "author")}`);
        same(both, [{ name: "Ann", full_name: "Ann" }], `${name}: both names`);
        assert(render(bound(dialect, libraryAt(3))).includes('"full_name" AS "name"'));
        // the annotation is taken out: no step, and the view is made again without the old name
        const gone = planWith(dialect, stateOf(3, dialect), 3, false);
        same(gone.steps.length, 0, `${name}: nothing changes in the tables`);
        const r = await execute(gone, driverOf(e), dialect, { empty: emptyOf(dialect), before: kit.session(dialect) });
        assert(r.kind === "ok" && r.value.repeatable.length > 0, `${name}: the view is applied again`);
        assert(await refuses(e, `SELECT "name" FROM ${viewOf(name, "author")}`), `${name}: the old name has left the view`);
        same((await e.rows(`SELECT "full_name" FROM ${viewOf(name, "author")}`)).length, 1);
      });
    }
  },
);

proves(
  ["0014-sql-protected-access FR-009", "0014-sql-protected-access FR-010"],
  "a step that changes a table drops its views before and makes them again after, in the same transaction, so a view never blocks the change; the lifecycle gives the transform the states and runs the setting first",
  async () => {
    const p = planWith(postgres, stateOf(2, postgres), 3);
    const drop = p.steps.find((s) => s.kind === "dropColumn");
    assert(drop !== undefined);
    if (drop === undefined) return;
    assert(
      drop.up[0]?.sql === 'DROP VIEW IF EXISTS "api"."author";' &&
        drop.up[1]?.sql.includes("DROP COLUMN IF EXISTS") &&
        drop.up.slice(2).some((u) => u.sql.startsWith('CREATE VIEW "api"."author"')),
      "dropped before, made again after",
    );
    assert(!drop.up.some((u) => u.sql.includes('"born"') && u.sql.startsWith("CREATE VIEW")), "made again from the state after the step");
    const add = planWith(postgres, stateOf(1, postgres), 2).steps.find((s) => s.kind === "addColumn" && s.name.includes("pages"));
    assert(
      add?.down?.[0]?.sql === 'DROP VIEW IF EXISTS "api"."book";' &&
        add.down.some((u) => u.sql.startsWith("CREATE VIEW") && !u.sql.includes('"pages"')) &&
        add.up.some((u) => u.sql.startsWith("CREATE VIEW") && u.sql.includes('"pages"')),
      "done to the state after and undone from the state before",
    );
    assert(
      add.up.filter((u) => u.sql.startsWith("CREATE VIEW")).every((u) => u.guard?.query.includes("EXISTS")),
      "made again only where the columns are there",
    );
    // a step that changes nothing a view shows is left as it is
    const rows = planWith(postgres, stateOf(1, postgres), 2).steps.find((s) => s.kind === "upsertRows");
    assert(rows !== undefined && !rows.up.some((u) => u.sql.includes("VIEW")));
    // without the layer's transform a view blocks the change on PostgreSQL, and with it nothing does
    await withEngine("postgres", async (e) => {
      await upTo(e, postgres, 2);
      const bare = planWith(postgres, stateOf(2, postgres), 3, true, [idempotency()]);
      const step = bare.steps.find((s) => s.kind === "dropColumn");
      assert(step !== undefined && !step.up.some((u) => u.sql.includes("VIEW")));
      await e.run(`SELECT set_config('lifecycle.migrating', 'on', false)`);
      let blocked = false;
      for (const s of step?.up ?? []) {
        try {
          await applyStatement(driverOf(e), s);
        } catch {
          blocked = true;
        }
      }
      assert(blocked, "the view blocks dropping the column it shows");
    });
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        await upTo(e, dialect, 3);
        same(((await e.rows(`SELECT * FROM ${viewOf(name, "author")}`)) as unknown[]).length, 0);
      });
    }
    // the transform is given the states, the units are whole, and the setting is run first in each transaction
    const seen: [number, number][] = [];
    const spy: StepTransform = (draft, context) => {
      seen.push([context.before.tables.length, context.after.tables.length]);
      return draft;
    };
    planWith(postgres, stateOf(1, postgres), 2, true, [spy]);
    assert(seen.length > 0 && seen.some(([a, b]) => b === a + 1), "the table that is made is in the state after and not before");
    const units = planWith(postgres, undefined, 1).repeatable.filter((r) => r.statements.some((s) => s.group === "view"));
    assert(
      units.length === 3 &&
        units.every(
          (u) => u.statements.length >= 3 && u.statements[0]?.sql.startsWith("DROP VIEW") && u.statements[1]?.sql.startsWith("CREATE VIEW"),
        ),
      "a view is one unit",
    );
    const log: string[] = [];
    await withEngine("postgres", async (e) => {
      const inner = driverOf(e);
      const spyDriver: Driver = { exec: (sql) => (log.push(sql), inner.exec(sql)), query: inner.query };
      const r = await execute(planWith(postgres, undefined, 1), spyDriver, postgres, {
        empty: emptyOf(postgres),
        before: kit.session(postgres),
      });
      assert(r.kind === "ok");
    });
    const at = log.indexOf("BEGIN");
    same(log[at + 1], "SELECT set_config('lifecycle.migrating', 'on', true);", "the setting is the first statement of the transaction");
    same(log.filter((x) => x === "BEGIN").length, log.filter((x) => x === "COMMIT").length);
    // an element a step changed makes what is made from it due again, whatever its text
    const v1 = planWith(postgres, undefined, 1);
    const applied = new Map(v1.repeatable.map((r) => [r.key, r.hash]));
    const book = v1.repeatable.find((r) => r.key.includes("book"));
    assert(book !== undefined);
    if (book !== undefined)
      same(
        dueRepeatables(v1.repeatable, applied, new Set(book.of.slice(0, 1))).map((r) => r.key),
        [book.key],
      );
    same(transformsFrom(must(compose([must(protectionExtension())]))).length, 1, "the extension contributes the transform");
    assert(sourcesFrom(must(compose([must(protectionExtension())]))).length === 1);
  },
);

const person = concept("person", {
  definition: "A person",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    email: attribute(text(), { definition: "Where to write", annotations: [annotate(security2.mask, "hash")] }),
    phone: attribute(text(), { definition: "Where to call", annotations: [annotate(security2.mask, "partial")] }),
    note: attribute(text(), { definition: "What is said of them", annotations: [annotate(security2.mask, "redact")] }),
    age: attribute(integer(), { definition: "How old", annotations: [annotate(security2.mask, "redact")] }),
    name: attribute(text(), { definition: "What they are called" }),
  },
  identifiedBy: ["id"],
  annotations: [annotate(security2.access, { read: ["reader", "dpo"], write: [] })],
});
const people = (() => {
  const d = domain("people", { definition: "People", concepts: [person] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
})();
const md5 = (t: string): string => createHash("md5").update(t).digest("hex");

proves(
  ["0014-sql-protected-access FR-011"],
  "what governance says must be hidden is hidden in the view, a role the settings name sees it as it is, and a mask the dialect cannot write is an error value",
  async () => {
    const insert = `("id", "email", "phone", "note", "age", "name") VALUES ('p1', 'ann@example.com', '0123456789', 'a secret', 41, 'Ann')`;
    await withEngine("duckdb", async (e) => {
      await load(e, bound(duckdb, people));
      await e.run(`INSERT INTO "data"."person" ${insert}`);
      const [row] = await e.rows(`SELECT * FROM "api"."person"`);
      same(
        [row?.["email"], row?.["phone"], row?.["note"], row?.["age"], row?.["name"]],
        [md5("ann@example.com"), "01***", "[redacted]", null, "Ann"],
        "hash, partial, redact and what is not hidden",
      );
    });
    await withEngine("postgres", async (e) => {
      await e.run("CREATE ROLE migrator; CREATE ROLE reader; CREATE ROLE dpo;");
      const p = protection({ owner: "migrator", unmaskedRoles: ["dpo"] });
      await load(e, must(bind(people, { dialect: postgres, ...p.bind })));
      await e.run(`INSERT INTO "data"."person" ${insert}`);
      await e.run("SET ROLE reader");
      const [hidden] = await e.rows(`SELECT * FROM "api"."person"`);
      same(
        [hidden?.["email"], hidden?.["phone"], hidden?.["note"], hidden?.["age"], hidden?.["name"]],
        [md5("ann@example.com"), "01***", "[redacted]", null, "Ann"],
        "a reader sees it hidden",
      );
      await e.run("RESET ROLE");
      await e.run("SET ROLE dpo");
      const [shown] = await e.rows(`SELECT * FROM "api"."person"`);
      same(
        [shown?.["email"], shown?.["phone"], shown?.["note"], shown?.["age"]],
        ["ann@example.com", "0123456789", "a secret", 41],
        "the role the settings name sees it as it is",
      );
      await e.run("RESET ROLE");
    });
    const lite = bind(people, { dialect: sqlite, ...protection().bind });
    assert(
      lite.kind === "err" && lite.error.some((x) => x.kind === "unsupported" && x.why.includes("no hash to mask email")),
      "SQLite has no hash",
    );
    const off = render(bound(duckdb, people, { masks: "off" }));
    assert(!off.includes("md5(") && off.includes('SELECT "id", "email", "phone", "note", "age", "name"'), "masks off");
  },
);

proves(
  ["0014-sql-protected-access FR-013"],
  "the plans of a domain's versions run with the layer leave the tables in their schema, a view of each with the last version's columns, the reference rows, and every step safe to run twice",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        await upTo(e, dialect, 3);
        const o = await objects(e);
        const tables =
          name === "sqlite"
            ? ["data_author", "data_book", "data_genre", "data_publisher", "lifecycle_ledger"]
            : ["author", "book", "genre", "publisher"];
        if (name === "sqlite") {
          same(o["main.table"], tables);
          same(o["main.view"], ["author", "book", "genre", "publisher"]);
        } else {
          same(o["data.table"], tables);
          same(o["api.view"], ["author", "book", "genre", "publisher"]);
          same(o["api.table"], undefined);
          same(
            Object.keys(o).filter((k) => !["api.view", "data.table", "main.table", "public.table"].includes(k)),
            [],
            `${name}: nowhere else`,
          );
        }
        const cols = async (v: string): Promise<string[]> =>
          Object.keys((await e.rows(`SELECT * FROM ${viewOf(name, v)} LIMIT 0`))[0] ?? {});
        void cols;
        same(
          (await e.rows(`SELECT "code" FROM ${viewOf(name, "genre")} ORDER BY "code"`)).map((r) => r["code"]),
          ["drama", "fiction", "poetry"],
          `${name}: the reference rows through the view`,
        );
        const names = await e.rows(
          name === "postgres"
            ? `SELECT column_name c FROM information_schema.columns WHERE table_schema = 'api' AND table_name = 'book' ORDER BY ordinal_position`
            : name === "duckdb"
              ? `SELECT column_name c FROM duckdb_columns() WHERE schema_name = 'api' AND table_name = 'book' ORDER BY column_index`
              : `SELECT name c FROM pragma_table_info('book')`,
        );
        same(
          names.map((r) => r["c"]).sort(),
          ["author_id", "genre_code", "id", "pages", "title"],
          `${name}: the view has the last version's columns`,
        );
        // every step of the last plan can be run twice without the ledger
        const again = planWith(dialect, stateOf(2, dialect), 3);
        assert(
          again.steps.every((s) => s.idempotency !== "ledger-only"),
          `${name}: no step relies on the ledger alone`,
        );
        await e.run(name === "postgres" ? `SELECT set_config('lifecycle.migrating', 'on', false)` : "SELECT 1");
        for (const s of again.steps) for (const st of s.up) await applyStatement(driverOf(e), st);
        same(
          (await e.rows(`SELECT "full_name" FROM ${viewOf(name, "author")}`)).length,
          0,
          `${name}: the view still reads after the steps run again`,
        );
      });
    }
  },
);

proves(
  ["0014-sql-protected-access FR-012"],
  "with a secret that seals the flag, a session that sets the flag to on is not a migration, and one that holds the secret is",
  async () => {
    await withEngine("postgres", async (e) => {
      await e.run("CREATE ROLE migrator; CREATE ROLE reader; CREATE ROLE writer;");
      const p = protection({ owner: "migrator", migratingSecret: "the-migrators-secret" });
      const b = must(bind(documents, { dialect: postgres, ...p.bind, sources: [accessSource({ viewsSchema: p.settings.viewsSchema }), ...p.bind.sources] }));
      await load(e, b);
      await e.run(`SELECT set_config('lifecycle.migrating', 'on', false)`);
      assert(await refuses(e, `ALTER TABLE "data"."document" ADD COLUMN "x" INTEGER`), "saying so is not enough");
      await e.run(`SELECT set_config('lifecycle.migrating', 'a-guess', false)`);
      assert(await refuses(e, `ALTER TABLE "data"."document" ADD COLUMN "x" INTEGER`), "nor is a guess");
      for (const s of p.session(postgres)) await e.run(s.replace(", true)", ", false)"));
      await e.run(`ALTER TABLE "data"."document" ADD COLUMN "x" INTEGER`);
      same(p.session(postgres), ["SELECT set_config('lifecycle.migrating', 'the-migrators-secret', true);"]);
    });
  },
);
