// Spec: 0024-sql-queries FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Queries (commons data 0024-sql-queries), on real engines: a catalog of read-only queries over the names of a schema, whose values enter only as literals, run in a transaction that is rolled back,
 * verified against a database, and compared between versions of a schema.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { impact, queries, type QuerySpec, readOnly, run, verify } from "@intellectual-frontiers/data/sql/extensions/queries";
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
  await e.run(`INSERT INTO "author" ("id", "name", "born") VALUES ('a1', 'Ann', '1990-01-02'), ('a2', 'Bo', NULL), ('a3', 'O''Neil', '1970-05-05')`);
  return e;
};
const byName: QuerySpec = {
  name: "by name",
  params: { name: "text" },
  sql: (r, p) => `SELECT ${r.column("author", "id")} AS id, ${r.column("author", "name")} AS name FROM ${r.table("author")} WHERE ${r.column("author", "name")} = ${p("name")}`,
};
const born: QuerySpec = {
  name: "born after",
  params: { year: "integer", day: { type: "text", nullable: true } },
  sql: (r, p) => `SELECT ${r.column("author", "id")} AS id FROM ${r.table("author")} WHERE ${r.column("author", "born")} IS NOT NULL AND ${p("day")} IS NULL OR ${r.column("author", "id")} = ${p("year")}`,
};
const made = (d: Dialect, specs: readonly QuerySpec[]) => {
  const r = queries(schema, specs, { dialect: d });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(
  ["0024-sql-queries FR-001", "0024-sql-queries FR-003"],
  "a catalog is made from names by their words, and an unknown name, a duplicate, an undeclared parameter and anything that is not one read-only statement are errors as values",
  () => {
    const d = DIALECTS[2].dialect;
    const c = made(d, [byName]);
    same(c.get("by name")?.reads, ["author"]);
    const bad = (sql: QuerySpec["sql"]): string[] => {
      const r = queries(schema, [{ name: "q", sql }], { dialect: d });
      return r.kind === "err" ? r.error.map((e) => (e.kind === "not-read-only" ? `${e.kind}: ${e.why}` : e.kind)) : ["ok"];
    };
    same(bad((r) => `SELECT * FROM ${r.table("nope")}`), ["unknown-table"]);
    same(bad((r) => `SELECT ${r.column("author", "shoe")} FROM ${r.table("author")}`), ["unknown-column"]);
    same(bad((_r, p) => `SELECT ${p("x")}`), ["unknown-param"]);
    same(bad(() => "DELETE FROM author"), ["not-read-only: it is not a SELECT or WITH"]);
    same(bad(() => "SELECT 1; DROP TABLE author"), ["not-read-only: it holds more than one statement"]);
    same(bad(() => "WITH x AS (DELETE FROM author RETURNING id) SELECT * FROM x"), ["not-read-only: it holds DELETE"]);
    same(bad(() => "SELECT 1 /* ; */ -- DROP\n"), ["ok"], "comments are left out");
    same(bad(() => "SELECT 'delete; drop' AS note, \"insert\" FROM author"), ["ok"], "so are strings and quoted names");
    same(readOnly("select 1"), undefined);
    const dup = queries(schema, [byName, byName], { dialect: d });
    assert(dup.kind === "err" && dup.error[0]?.kind === "duplicate");
  },
);

proves(
  ["0024-sql-queries FR-002"],
  "a value enters a query only as a literal of its type: another type, a missing value, a null and an undeclared parameter are refused, and what looks like SQL is text",
  async () => {
    const d = DIALECTS[2].dialect;
    const q = made(d, [byName, born]);
    const by = q.get("by name")!;
    same(by.render({ name: "Ann" }).kind === "ok" && (by.render({ name: "Ann" }) as { value: string }).value.endsWith(`= 'Ann'`), true);
    same((by.render({ name: "O'Neil" }) as { value: string }).value.endsWith(`= 'O''Neil'`), true, "a quote is doubled");
    const errs = (r: ReturnType<typeof by.render>): string[] => (r.kind === "err" ? r.error.map((e) => `${e.kind}:${e.param}`) : ["ok"]);
    same(errs(by.render({ name: 5 })), ["type:name"]);
    same(errs(by.render({})), ["missing:name"]);
    same(errs(by.render({ name: null })), ["null:name"]);
    same(errs(by.render({ name: "x", extra: 1 })), ["unknown:extra"]);
    const b = q.get("born after")!;
    same(errs(b.render({ year: 1.5, day: null })), ["type:year"]);
    const ok1 = b.render({ year: 3, day: null });
    assert(ok1.kind === "ok" && ok1.value.includes("NULL IS NULL") && ok1.value.includes("= 3"), "a nullable null is NULL, an integer as it is");
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const c = made(dialect, [byName]);
        const evil = await run(driverOf(e), c.get("by name")!, { name: "x' OR '1'='1'; DROP TABLE author; --" });
        assert(evil.kind === "ok" && evil.value.length === 0, `${name}: text is text`);
        same(Number((await e.rows(`SELECT count(*) n FROM "author"`))[0]?.["n"]), 3, `${name}: and the table is there`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0024-sql-queries FR-004", "0024-sql-queries FR-005"],
  "on three engines a query is run in a transaction that is rolled back, and verify finds the queries the engine refuses",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await dbWith(name, dialect);
      try {
        const c = made(dialect, [byName]);
        const r = await run(driverOf(e), c.get("by name")!, { name: "O'Neil" });
        assert(r.kind === "ok" && r.value.length === 1 && r.value[0]?.["id"] === "a3", `${name}: ${JSON.stringify(r)}`);
        const refused = await run(driverOf(e), c.get("by name")!, { name: 7 });
        assert(refused.kind === "err" && refused.error.kind === "params", `${name}: wrong type`);
        same(await verify(driverOf(e), c), [], `${name}: a good catalog verifies`);
        // a catalog of the next version against a database of this one: its queries name a column the database does not have
        const next = queries(libraryAt(3), [{ name: "full names", sql: (r) => `SELECT ${r.column("author", "full name")} FROM ${r.table("author")}` }, { name: "ids", sql: (r) => `SELECT ${r.column("author", "id")} FROM ${r.table("author")}` }], { dialect });
        assert(next.kind === "ok");
        if (next.kind === "ok") {
          const found = await verify(driverOf(e), next.value);
          same(found.map((f) => f.query), ["full names"], `${name}: the engine refuses what the schema it was made from has and the database does not`);
          assert(found[0]!.message.length > 0);
        }
        // nothing is left open: the next statement runs outside a transaction
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('z', 'Zed')`);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0024-sql-queries FR-006"],
  "what a change does to each query is known before it is made: fine, breaks, broken or fixed",
  () => {
    const d = DIALECTS[2].dialect;
    const specs: QuerySpec[] = [
      { name: "ids", sql: (r) => `SELECT ${r.column("author", "id")} FROM ${r.table("author")}` },
      { name: "born", sql: (r) => `SELECT ${r.column("author", "born")} FROM ${r.table("author")}` },
      { name: "full names", sql: (r) => `SELECT ${r.column("author", "full name")} FROM ${r.table("author")}` },
      { name: "nothing", sql: (r) => `SELECT ${r.column("author", "shoe")} FROM ${r.table("author")}` },
    ];
    const opts = { dialect: d };
    same(impact(specs, libraryAt(2), libraryAt(3), opts).map((i) => [i.query, i.status]), [["ids", "fine"], ["born", "breaks"], ["full names", "fixed"], ["nothing", "broken"]]);
    const first = impact(specs, libraryAt(2), libraryAt(3), opts).find((i) => i.query === "born");
    same(first?.errors, [{ kind: "unknown-column", table: "author", column: "born" }]);
  },
);
