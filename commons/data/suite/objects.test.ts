// Spec: 0048-sql-objects FR-001, FR-002, FR-003, FR-004
/**
 * Schemas, sequences, enumerated types, domains and extensions (commons data 0048-sql-objects), on real engines: each is made where the dialect has it and works as what it is, making them again changes
 * nothing, they come before the tables, and what a dialect cannot have is an error value that names it, or nothing where the project carries it.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { codeList } from "@intellectual-frontiers/data/governance";
import { enumOf, enumType, extension, objectsExtension, objectsSource, pgDomain, schema, sequence, statementOf } from "@intellectual-frontiers/data/sql/extensions/objects";
import { bind, type BindOptions, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, refuses, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { libraryAt } from "./lifecycle-fixture.ts";

const [sqlite, duckdb, postgres] = [DIALECTS[0].dialect, DIALECTS[1].dialect, DIALECTS[2].dialect];
const made = (d: Dialect, sources: NonNullable<BindOptions["sources"]>, extra: Partial<BindOptions> = {}) => bind(libraryAt(1), { dialect: d, sources, ...extra });
const ddl = (d: Dialect, sources: NonNullable<BindOptions["sources"]>): string[] => {
  const b = made(d, sources);
  assert(b.kind === "ok", JSON.stringify(b));
  return b.kind === "ok" ? b.value.statements.map((s) => s.sql) : [];
};
const withDb = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const loadAll = async (e: Engine, d: Dialect, sources: NonNullable<BindOptions["sources"]>): Promise<void> => {
  const b = made(d, sources);
  assert(b.kind === "ok", JSON.stringify(b));
  if (b.kind === "ok") await load(e, b.value);
};

proves(
  ["0048-sql-objects FR-001", "0048-sql-objects FR-002"],
  "on PostgreSQL a sequence counts, an enumerated type refuses a value it does not have, a domain refuses what its rule refuses and a null where it is not null, an extension is made, and making them all again changes nothing",
  async () => {
    const objects = [
      schema("billing"),
      sequence("invoice_number", { schema: "billing", start: 1000, increment: 5 }),
      enumType("mood", ["happy", "sad"], { schema: "billing" }),
      enumType("plain_mood", ["ok"]),
      pgDomain("percent", { kind: "integer" }, { schema: "billing", notNull: true, check: "VALUE BETWEEN 0 AND 100" }),
      extension("plpgsql"),
    ];
    await withDb("postgres", async (e) => {
      await loadAll(e, postgres, [objectsSource(objects)]);
      same((await e.rows(`SELECT nextval('billing.invoice_number') AS a, nextval('billing.invoice_number') AS b`)).map((r) => [Number(r["a"]), Number(r["b"])]), [[1000, 1005]]);
      same((await e.rows(`SELECT 'happy'::billing.mood AS m, enum_range(NULL::billing.mood)::text AS r`)).map((r) => [r["m"], r["r"]]), [["happy", "{happy,sad}"]]);
      assert(await refuses(e, `SELECT 'angry'::billing.mood`), "a value the type does not have is refused");
      same((await e.rows(`SELECT 50::billing.percent AS p`)).map((r) => Number(r["p"])), [50]);
      assert(await refuses(e, `SELECT 101::billing.percent`), "the domain's rule");
      assert(await refuses(e, `SELECT NULL::billing.percent`), "and its not null");
      same((await e.rows(`SELECT extname FROM pg_extension WHERE extname = 'plpgsql'`)).length, 1);
      assert((await e.rows(`SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'plain_mood' AND n.nspname = current_schema()`)).length === 1, "a type with no schema is in the current schema");
      // again: nothing changes, and the sequence is not restarted
      await loadAll(e, postgres, [objectsSource(objects)]);
      same((await e.rows(`SELECT nextval('billing.invoice_number') AS a`)).map((r) => Number(r["a"])), [1010], "the sequence goes on");
      same((await e.rows(`SELECT count(*)::int AS n FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname IN ('mood', 'percent') AND n.nspname = 'billing'`))[0]?.["n"], 2);
    });
  },
);

proves(
  ["0048-sql-objects FR-001", "0048-sql-objects FR-003"],
  "on DuckDB a schema, a sequence and an enumerated type are made and made again, and a domain and an extension, which DuckDB does not have, are an error value that names them",
  async () => {
    await withDb("duckdb", async (e) => {
      const objects = [schema("s"), sequence("n", { schema: "s", start: 7 }), enumType("mood", ["happy", "sad"], { schema: "s" })];
      await loadAll(e, duckdb, [objectsSource(objects)]);
      await loadAll(e, duckdb, [objectsSource(objects)]);
      same((await e.rows(`SELECT nextval('s.n') AS a`)).map((r) => Number(r["a"])), [7]);
      same((await e.rows(`SELECT 'sad'::s.mood AS m`)).map((r) => r["m"]), ["sad"]);
      assert(await refuses(e, `SELECT 'angry'::s.mood`));
    });
    for (const [name, d, o] of [["domain", duckdb, pgDomain("p", { kind: "integer" })], ["extension", duckdb, extension("x")]] as const) {
      const r = made(d, [objectsSource([o])]);
      assert(r.kind === "err" && JSON.stringify(r.error).includes(`no ${name === "domain" ? "domains" : "extensions"}`) && JSON.stringify(r.error).includes(o.name), `${name}: ${JSON.stringify(r)}`);
    }
  },
);

proves(
  ["0048-sql-objects FR-003"],
  "SQLite has none of them: each is an error value that names it, and where the project carries them nothing is written",
  () => {
    const objects = [schema("s"), sequence("n"), enumType("e", ["a"]), pgDomain("d", { kind: "text" }), extension("x")];
    const r = made(sqlite, [objectsSource(objects)]);
    assert(r.kind === "err" && r.error.length === 5, JSON.stringify(r));
    same(ddl(sqlite, [objectsSource(objects, { unsupported: "carry" })]).filter((s) => /SEQUENCE|TYPE|DOMAIN|EXTENSION|SCHEMA/.test(s)), []);
    same(ddl(duckdb, [objectsSource([pgDomain("d", { kind: "text" })], { unsupported: "carry" })]).filter((s) => /DOMAIN/.test(s)), []);
  },
);

proves(
  ["0048-sql-objects FR-004"],
  "an enumerated type can be made from a closed code list with its values written as the codes are, objects come before the tables, a name is quoted, and the objects are an extension of the engine",
  () => {
    const mood = codeList("employmentKind", { definition: "How", codes: { employedBy: { label: "Employed by", definition: "x" }, selfEmployed: { label: "Self", definition: "y" } } });
    const sql = ddl(postgres, [objectsSource([enumOf(mood, { schema: "hr" })])]);
    assert(sql.some((s) => s.includes('CREATE TYPE "hr"."employment_kind" AS ENUM (\'employed_by\', \'self_employed\')')), sql.join("\n"));
    const all = ddl(postgres, [objectsSource([sequence("s1")])]);
    const at = all.findIndex((s) => s.includes("CREATE SEQUENCE"));
    assert(at >= 0 && at < all.findIndex((s) => s.startsWith("CREATE TABLE")), "before the tables");
    same(statementOf(sequence("a b"), postgres), 'CREATE SEQUENCE IF NOT EXISTS "a b";');
    same(statementOf(sequence("n", { start: 3, increment: 2, cache: 10, cycle: true }), postgres), 'CREATE SEQUENCE IF NOT EXISTS "n" START WITH 3 INCREMENT BY 2 CACHE 10 CYCLE;');
    same(statementOf(sequence("n", { cache: 10 }), duckdb), 'CREATE SEQUENCE IF NOT EXISTS "n";');
    same(statementOf(enumType("e", ["it's"]), duckdb), `CREATE TYPE IF NOT EXISTS "e" AS ENUM ('it''s');`);
    const ext = objectsExtension([schema("s")]);
    assert(ext.kind === "ok" && String(ext.value.id).includes("sql.features.objects"));
  },
);
