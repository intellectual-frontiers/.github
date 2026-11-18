// Spec: 0013-sql-qualified-names FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * Names that carry a schema (commons data 0013-sql-qualified-names): with a schema given, tables are made, referred to, indexed, loaded, described and changed there on DuckDB and PostgreSQL, and
 * on SQLite carry the schema's words in their names; every extension writes its references through the physical schema's `written`; and the lifecycle records the schema and writes it.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/commons/ts/kernel";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { annotate, attribute, concept, date, domain, identifier, text, vocabularies } from "@intellectual-frontiers/data/governance";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { accessSource } from "@intellectual-frontiers/data/sql/extensions/access";
import { documentationSources } from "@intellectual-frontiers/data/sql/extensions/documentation";
import { idempotency } from "@intellectual-frontiers/data/sql/extensions/idempotency";
import { partitions } from "@intellectual-frontiers/data/sql/extensions/partitions";
import { column, routinesSource, table } from "@intellectual-frontiers/data/sql/extensions/routines";
import { viewsSource } from "@intellectual-frontiers/data/sql/extensions/views";
import { emptyState, execute, plan, readLedger, snapshotOf, type State, stateHash } from "@intellectual-frontiers/data/sql/lifecycle";
import {
  bind,
  camel,
  type BindContext,
  type Dialect,
  naming,
  render,
  type StatementSource,
} from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";
import { projected } from "./logical-fixture.ts";

const { security } = vocabularies;
const SQL = (
  d: Dialect,
  schema: string | undefined,
  options: Omit<Parameters<typeof bind>[1], "dialect" | "schema"> = {},
  version: 1 | 2 | 3 = 1,
): string => {
  const r = bind(libraryAt(version), { dialect: d, ...(schema === undefined ? {} : { schema }), ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return render(r.value);
};
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
/** The tables of an engine and their columns, by the schema they are in (none for SQLite, which has no schemas). */
const tablesIn = async (e: Engine): Promise<Record<string, string[]>> => {
  const rows =
    e.name === "postgres"
      ? await e.rows(
          "SELECT table_schema s, table_name t, column_name c FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema')",
        )
      : e.name === "duckdb"
        ? await e.rows("SELECT schema_name s, table_name t, column_name c FROM duckdb_columns() WHERE NOT internal")
        : (await e.rows("SELECT name t FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")).map((r) => ({
            s: "main",
            t: r["t"],
            c: "",
          }));
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[`${String(r["s"])}.${String(r["t"])}`] ??= []).push(String(r["c"]));
  return out;
};
const only = (tables: Record<string, string[]>, schema: string): string[] =>
  Object.keys(tables)
    .filter((k) => k.startsWith(`${schema}.`))
    .map((k) => k.slice(schema.length + 1))
    .sort();

proves(["0013-sql-qualified-names FR-001"], "with no schema given the statements make no schema and qualify nothing", () => {
  for (const d of [postgres, duckdb, sqlite]) {
    const sql = SQL(d, undefined);
    assert(!sql.includes("CREATE SCHEMA") && !sql.includes('"."') && sql.includes('CREATE TABLE IF NOT EXISTS "book" ('), d.name);
  }
});

proves(
  ["0013-sql-qualified-names FR-002"],
  "where the dialect has schemas the schema is made first and every reference to a table is qualified",
  () => {
    for (const d of [postgres, duckdb]) {
      const b = bind(libraryAt(1), { dialect: d, schema: "data" });
      assert(b.kind === "ok");
      if (b.kind !== "ok") continue;
      same([b.value.statements[0]?.group, b.value.statements[0]?.sql], ["setup", 'CREATE SCHEMA IF NOT EXISTS "data";']);
      const sql = render(b.value);
      assert(sql.includes('CREATE TABLE IF NOT EXISTS "data"."book" ('), d.name);
      assert(
        sql.includes('REFERENCES "data"."author" ("id")') && sql.includes('REFERENCES "data"."genre" ("code")'),
        `${d.name}: foreign keys`,
      );
      assert(sql.includes('INSERT INTO "data"."genre" ('), `${d.name}: rows`);
      assert(!sql.includes('CREATE TABLE IF NOT EXISTS "book"'), `${d.name}: none unqualified`);
    }
    const cyclic = bind(libraryAt(1), { dialect: postgres, schema: "data" });
    assert(cyclic.kind === "ok");
  },
);

proves(
  ["0013-sql-qualified-names FR-003"],
  "where the dialect has none the schema's words come before each table's name with the case style, the length is checked after they are added, and no schema is made",
  () => {
    const sql = SQL(sqlite, "data");
    assert(
      !sql.includes("CREATE SCHEMA") &&
        sql.includes('CREATE TABLE IF NOT EXISTS "data_book" (') &&
        sql.includes('REFERENCES "data_author" ("id")') &&
        sql.includes('INSERT INTO "data_genre" ('),
    );
    const c = bind(libraryAt(1), { dialect: sqlite, schema: "data", naming: naming(camel) });
    assert(c.kind === "ok");
    if (c.kind === "ok")
      assert(
        render(c.value).includes('CREATE TABLE IF NOT EXISTS "dataBook" (') && render(c.value).includes('REFERENCES "dataAuthor" ("id")'),
      );
    const short: Dialect = { ...sqlite, maxName: 18 };
    const e = bind(libraryAt(1), { dialect: short, schema: "libraries_and_more" });
    assert(
      e.kind === "err" &&
        e.error.every((x) => x.kind === "length") &&
        e.error.some((x) => x.kind === "length" && x.name === "libraries_and_more_book"),
    );
    assert(bind(libraryAt(1), { dialect: short }).kind === "ok", "without the words it fits");
  },
);

proves(
  ["0013-sql-qualified-names FR-004"],
  "a statement source is given the reference to a table, to a table of an extension, and the name an extension's table is written by",
  () => {
    const seen: Record<string, string[]> = {};
    for (const d of [postgres, sqlite]) {
      const source: StatementSource = (context: BindContext) => {
        const t = context.schema.tables.find((x) => x.name.join(".") === "book");
        seen[d.name] = [
          t === undefined ? "" : context.written.ref(t.id),
          context.written.qualify("documentation"),
          context.written.tableName("documentation"),
          context.written.qualifier ?? "-",
          context.schemaName ?? "-",
        ];
        return ok([]);
      };
      const b = bind(libraryAt(1), { dialect: d, schema: "data", sources: [source] });
      assert(b.kind === "ok");
    }
    same(seen["postgres"], ['"data"."book"', '"data"."documentation"', "documentation", "data", "data"]);
    same(seen["sqlite"], ['"data_book"', '"data_documentation"', "data_documentation", "-", "data"]);
  },
);

const document = concept("document", {
  definition: "A paper kept for a tenant",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    tenant: attribute(text(), { definition: "Whose it is", annotations: [annotate(security.scope, { name: "tenant" })] }),
  },
  identifiedBy: ["id"],
});
const event = concept("event", {
  definition: "Something that happened",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    happenedOn: attribute(date(), { definition: "The day" }),
  },
  identifiedBy: ["id", "happenedOn"],
});
const extras = (() => {
  const d = domain("extras", { definition: "Extras", concepts: [document, event] });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
})();

proves(
  ["0013-sql-qualified-names FR-005", "0013-sql-qualified-names FR-008"],
  "the comments, the documentation tables, the governance tables and the views are made in the schema on every engine, and the tables are in none other",
  async () => {
    const personView = {
      name: "authorBooks",
      description: "Each author's books",
      from: "author",
      joins: [
        {
          table: "book",
          on: [
            { table: "book", column: "authorId" },
            { table: "author", column: "id" },
          ] as const,
        },
      ],
      columns: [
        { table: "author", column: "id" },
        { table: "book", column: "title" },
      ],
    };
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const b = bind(libraryAt(2), {
          dialect,
          schema: "data",
          sources: [...documentationSources({ documentationTables: "always" }), viewsSource([personView])],
        });
        assert(b.kind === "ok", `${name}: ${JSON.stringify(b)}`);
        if (b.kind !== "ok") return;
        await load(e, b.value);
        const tables = await tablesIn(e);
        if (name === "sqlite") {
          const names = Object.keys(tables)
            .map((k) => k.slice("main.".length))
            .sort();
          assert(
            names.every((n) => n.startsWith("data_")),
            `${name}: ${names.join(", ")}`,
          );
          assert(
            names.includes("data_documentation") &&
              names.includes("data_governance_annotation") &&
              names.includes("data_governance_trace") &&
              names.includes("data_book"),
          );
          same(((await e.rows('SELECT COUNT(*) AS n FROM "data_documentation"'))[0]?.["n"] as number) > 0, true);
        } else {
          const here = only(tables, "data");
          for (const t of ["author", "book", "genre", "publisher", "documentation", "governance_annotation", "governance_trace"])
            assert(here.includes(t), `${name}: ${t} is in the schema (${here.join(", ")})`);
          const other = Object.keys(tables).filter((k) => !k.startsWith("data."));
          same(
            other.filter((k) => !k.endsWith("author_books")),
            [],
            `${name}: nothing in another schema`,
          );
          same(
            ((await e.rows('SELECT COUNT(*) AS n FROM "data"."documentation"'))[0]?.["n"] as number) > 0,
            true,
            `${name}: the documentation is loaded`,
          );
          const comment =
            name === "postgres"
              ? await e.rows(`SELECT obj_description('"data"."book"'::regclass, 'pg_class') AS c`)
              : await e.rows(`SELECT comment AS c FROM duckdb_tables() WHERE schema_name = 'data' AND table_name = 'book'`);
          same(comment[0]?.["c"], "A written work", `${name}: the comment`);
        }
        await e.run(
          `INSERT INTO ${name === "sqlite" ? '"data_author"' : '"data"."author"'} ("id", "name", "born") VALUES ('a1', 'Ann', NULL)`,
        );
        await e.run(
          `INSERT INTO ${name === "sqlite" ? '"data_book"' : '"data"."book"'} ("id", "title", "genre_code", "author_id", "pages") VALUES ('b1', 'One', 'fiction', 'a1', 10)`,
        );
        same((await e.rows('SELECT * FROM "author_books"')).length, 1, `${name}: the view reads the tables in the schema`);
      });
    }
  },
);

proves(
  ["0013-sql-qualified-names FR-005", "0013-sql-qualified-names FR-008"],
  "policies, routines and partitions refer to the tables in the schema on PostgreSQL",
  async () => {
    await withEngine("postgres", async (e) => {
      const division = {
        table: "event",
        key: ["happenedOn"],
        strategy: "range" as const,
        partitions: [{ name: "y2025", from: ["2025-01-01"], to: ["2026-01-01"] }],
      };
      const { clause, source } = partitions([division]);
      const routine = {
        kind: "function" as const,
        name: "documentCount",
        description: "How many documents",
        returns: { type: { kind: "integer" as const } },
        language: "sql" as const,
        body: ["SELECT count(*)::int FROM ", table("document"), " WHERE ", column("document", "id"), " IS NOT NULL"],
      };
      const b = bind(extras, {
        dialect: postgres,
        schema: "data",
        sources: [accessSource(), source, routinesSource([routine])],
        tableClauses: [clause],
      });
      assert(b.kind === "ok", JSON.stringify(b));
      if (b.kind !== "ok") return;
      await load(e, b.value);
      same(
        (await e.rows("SELECT policyname FROM pg_policies WHERE schemaname = 'data' AND tablename = 'document'")).length,
        1,
        "the policy is on the table in the schema",
      );
      const parts = await e.rows(
        "SELECT c.relname n FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'data' AND c.relkind = 'r'",
      );
      same(
        parts.map((r) => r["n"]),
        ["event_y_2025"],
        "the partition is in the schema",
      );
      await e.run(`INSERT INTO "data"."document" VALUES ('d1', 'a')`);
      same((await e.rows(`SELECT "document_count"() AS n`))[0]?.["n"], 1, "the routine reads the table in the schema");
    });
  },
);

const snap = (v: 1 | 2 | 3, d: Dialect, schema?: string): State => {
  const r = snapshotOf(libraryAt(v), { dialect: d, ...(schema === undefined ? {} : { schema }) });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(
  ["0013-sql-qualified-names FR-006"],
  "a state records the schema where the dialect has schemas, and a plan writes its statements and the probes of its guards qualified by it",
  () => {
    same(snap(1, postgres, "data").qualifier, "data");
    same(snap(1, sqlite, "data").qualifier, undefined, "the words are in the names");
    assert(snap(1, sqlite, "data").tables.some((t) => t.name === "data_book"));
    assert(stateHash(snap(1, postgres, "data")) !== stateHash(snap(1, postgres)), "another schema, another state");
    same(emptyState("postgres", { names: "snake", codes: "snake" }, "data").qualifier, "data");
    const p = plan(snap(1, postgres, "data"), libraryAt(2), { dialect: postgres, schema: "data" }, { transforms: [idempotency()] });
    assert(p.kind === "ok");
    if (p.kind !== "ok") return;
    const add = p.value.steps.find((s) => s.kind === "addColumn");
    assert(add?.up[0]?.sql.startsWith('ALTER TABLE "data"."author" ADD COLUMN IF NOT EXISTS'), add?.up[0]?.sql);
    assert(add?.down?.[0]?.sql.startsWith('ALTER TABLE "data"."author" DROP COLUMN IF EXISTS'));
    const created = p.value.steps.find((s) => s.kind === "createTable");
    assert(created?.up[0]?.sql.startsWith('CREATE TABLE IF NOT EXISTS "data"."publisher"'));
    const lite = plan(snap(1, sqlite, "data"), libraryAt(2), { dialect: sqlite, schema: "data" }, { transforms: [idempotency()] });
    assert(lite.kind === "ok");
    if (lite.kind === "ok")
      assert(lite.value.steps.find((s) => s.kind === "addColumn")?.up[0]?.guard?.query.includes("pragma_table_info('data_author')"));
    const mismatch = plan(snap(1, postgres), libraryAt(2), { dialect: postgres, schema: "data" });
    assert(mismatch.kind === "err" && mismatch.error[0]?.kind === "schema");
    // the probes ask the schema, and an index is dropped by its qualified name
    const withIndex: State = {
      ...snap(1, postgres, "data"),
      tables: snap(1, postgres, "data").tables.map((t) =>
        t.name === "book"
          ? {
              ...t,
              constraints: [
                ...t.constraints,
                { id: "ix", kind: "index" as const, name: "book_title_idx", signature: "ix:title", text: '"title"' },
              ],
            }
          : t,
      ),
    };
    const drop = plan(withIndex, libraryAt(1), { dialect: postgres, schema: "data" }, { transforms: [idempotency()] });
    assert(
      drop.kind === "ok" &&
        drop.value.steps[0]?.up[0]?.sql === 'DROP INDEX IF EXISTS "data"."book_title_idx";' &&
        drop.value.steps[0].down?.[0]?.sql.includes('ON "data"."book"'),
    );
    assert(
      postgres.probes?.table("t", "data").includes("table_schema = 'data'") &&
        postgres.probes.index("i", "data").includes("schemaname = 'data'"),
    );
    assert(duckdb.probes?.column("t", "c", "data").includes("schema_name = 'data'"));
  },
);

proves(
  ["0013-sql-qualified-names FR-007"],
  "the steps from empty and from each version to the next leave the database that bind makes in the same schema, on three engines",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const empty = stateHash(
          emptyState(dialect.name, { names: "snake", codes: "snake" }, dialect.features.includes("schemas") ? "data" : undefined),
        );
        let from: State | undefined;
        for (const v of [1, 2, 3] as const) {
          const p = plan(from, libraryAt(v), { dialect, schema: "data" }, { allow: { destructive: true }, transforms: [idempotency()] });
          assert(p.kind === "ok", `${name} v${v}: ${JSON.stringify(p)}`);
          if (p.kind !== "ok") return;
          const r = await execute(p.value, d, dialect, { empty });
          assert(r.kind === "ok", `${name} v${v}: ${JSON.stringify(r)}`);
          from = snap(v, dialect, "data");
        }
        const ledger = await readLedger(d, dialect);
        same(ledger[ledger.length - 1]?.to, stateHash(snap(3, dialect, "data")));
        await withEngine(name, async (fresh) => {
          const b = bind(libraryAt(3), { dialect, schema: "data" });
          assert(b.kind === "ok");
          if (b.kind === "ok") await load(fresh, b.value);
          const norm = (t: Record<string, string[]>): unknown =>
            Object.fromEntries(
              Object.entries(t)
                .filter(([k]) => !k.endsWith("lifecycle_ledger"))
                .map(([k, v]) => [k, [...v].sort()])
                .sort(([a], [b2]) => ((a as string) < (b2 as string) ? -1 : 1)),
            );
          same(norm(await tablesIn(e)), norm(await tablesIn(fresh)), `${name}: the same tables and columns in the same schema`);
        });
      });
    }
  },
);
