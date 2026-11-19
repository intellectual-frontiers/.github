// Spec: 0049-sql-assertions FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Assertions about a database (commons data 0049-sql-assertions), on real engines: the structure a schema's state says is held on each dialect and a difference is a failing line that names it; rows and
 * statements that must fail; the same assertions as pgTAP run by the pgTAP extension in PGlite; and TAP as values, as text and read back.
 *
 * @module
 */
import { PGlite } from "@electric-sql/pglite";
import { pgtap } from "@electric-sql/pglite-pgtap";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { type Assertion, describeAssertion, failed, fails, fromLines, pass, pgTapScript, rows, runAssertions, skipped, structuralTests, tally, tapQuery, tapText } from "@intellectual-frontiers/data/sql/extensions/assertions";
import { snapshotOf } from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const world = async (name: Engine["name"], d: Dialect): Promise<Engine> => {
  const e = await openEngine(name);
  await load(e, must(bind(libraryAt(1), { dialect: d })));
  return e;
};
const status = (nodes: readonly { kind: string; ok?: boolean }[]): boolean[] => nodes.map((n) => n.ok === true);

proves(
  ["0049-sql-assertions FR-001", "0049-sql-assertions FR-002"],
  "the structure a schema's state says is held on each dialect, by a driver and by one query that returns TAP lines, and what a database lacks or has otherwise is a failing line that names it",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await world(name, dialect);
      try {
        const state = must(snapshotOf(libraryAt(1), { dialect }));
        const own = structuralTests(state, dialect);
        assert(own.length > 10 && own.some((a) => a.kind === "has-index") === (state.tables.some((t) => t.constraints.some((k) => k.kind === "index"))), `${name}: ${own.length}`);
        const ran = await runAssertions(own, driverOf(e), dialect);
        same(tally(ran), { passed: own.length, failed: 0, skipped: 0 }, `${name}: every assertion of the state holds: ${JSON.stringify(ran.filter((n) => n.kind === "test" && !n.ok))}`);
        // one query gives the same lines
        const lines = (await e.rows(tapQuery(own, dialect))).map((r) => String(r["tap"]));
        same(lines.length, own.length);
        same(tally(fromLines(lines)), { passed: own.length, failed: 0, skipped: 0 }, name);
        // what is wrong is named
        const table = { name: "author", ...(state.qualifier === undefined ? {} : { schema: state.qualifier }) };
        const wrong: Assertion[] = [
          { kind: "has-table", table: { name: "nothing" } },
          { kind: "has-column", table, column: "shoe_size" },
          { kind: "has-column", table, column: "id", notNull: false },
          { kind: "has-primary-key", table, columns: ["name"] },
          { kind: "has-index", table, index: "no_such_index" },
          { kind: "has-view", view: { name: "author" } },
        ];
        const bad = await runAssertions(wrong, driverOf(e), dialect);
        same(status(bad), [false, false, false, false, false, false], `${name}: each is a failing line`);
        same(bad.map((n) => (n.kind === "test" ? n.description : "")), wrong.map(describeAssertion));
        same(tally(fromLines((await e.rows(tapQuery(wrong, dialect))).map((r) => String(r["tap"])))).failed, 6, `${name}: and the query says so`);
        // a difference made in the database
        const idx = state.tables.flatMap((t) => t.constraints.filter((k) => k.kind === "index").map((k) => ({ table: t.name, index: k.name })))[0];
        if (idx !== undefined) {
          await e.run(`DROP INDEX ${dialect.quote(idx.index)}`);
          const after = await runAssertions(own, driverOf(e), dialect);
          same(after.filter((n) => n.kind === "test" && !n.ok).map((n) => (n.kind === "test" ? n.description : "")), [`index ${idx.index} on ${idx.table} exists`], `${name}: the index that was dropped`);
        }
        const empty = await e.rows(tapQuery([], dialect));
        same(empty[0]?.["tap"], "1..0");
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0049-sql-assertions FR-003"],
  "rows are held in any order and compared as sets, a statement that must fail passes only where it is refused and changes nothing where it is not, and the query that gives TAP says a statement that must fail was skipped",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      const e = await world(name, dialect);
      try {
        await e.run(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann'), ('a2', 'Bo')`);
        const all: Assertion[] = [
          rows("two authors", `SELECT "id", "name" FROM "author"`, [["a2", "Bo"], ["a1", "Ann"]]),
          rows("none called Cy", `SELECT "id" FROM "author" WHERE "name" = 'Cy'`, []),
          rows("a quote in a value", `SELECT 'it''s' AS s`, [["it's"]]),
          rows("a wrong row", `SELECT "id" FROM "author"`, [["a1"]]),
          rows("a missing row", `SELECT "id" FROM "author"`, [["a1"], ["a2"], ["a3"]]),
          rows("not empty", `SELECT "id" FROM "author"`, []),
          fails("a name is required", `INSERT INTO "author" ("id", "name") VALUES ('a3', NULL)`),
          fails("a duplicate key is refused", `INSERT INTO "author" ("id", "name") VALUES ('a1', 'X')`),
          fails("this one is accepted", `INSERT INTO "author" ("id", "name") VALUES ('a9', 'Fine')`),
        ];
        const ran = await runAssertions(all, driverOf(e), dialect);
        same(status(ran), [true, true, true, false, false, false, true, true, false], `${name}: ${JSON.stringify(ran.map((n) => (n.kind === "test" ? [n.ok, n.diagnostics] : n)))}`);
        same(Number((await e.rows(`SELECT count(*) AS n FROM "author"`))[0]?.["n"]), 2, `${name}: the statement that was accepted was rolled back`);
        const lines = (await e.rows(tapQuery(all, dialect))).map((r) => String(r["tap"]));
        assert([6, 7, 8].every((i) => lines[i]?.includes("# SKIP")), lines.join("\n"));
        same(status(fromLines(lines).filter((n) => n.kind === "test" && n.directive === undefined)), [true, true, true, false, false, false], name);
      } finally {
        await e.close();
      }
    }
  },
);

proves(
  ["0049-sql-assertions FR-005"],
  "the assertions are a pgTAP script that the pgTAP extension runs in PostgreSQL, giving the same results as the query and the driver",
  async () => {
    const postgres = DIALECTS[2].dialect;
    const fresh = async (): Promise<PGlite> => {
      const d = await PGlite.create({ extensions: { pgtap } });
      for (const s of must(bind(libraryAt(1), { dialect: postgres })).statements) await d.exec(s.sql);
      await d.exec("CREATE EXTENSION pgtap");
      await d.exec(`INSERT INTO "author" ("id", "name") VALUES ('a1', 'Ann')`);
      return d;
    };
    const db = await fresh();
    const db2 = await fresh();
    try {
      const state = must(snapshotOf(libraryAt(1), { dialect: postgres }));
      const good: Assertion[] = [...structuralTests(state, postgres), rows("one author", `SELECT "id", "name" FROM "author"`, [["a1", "Ann"]]), rows("none", `SELECT 1 FROM "author" WHERE false`, []), fails("a name is required", `INSERT INTO "author" ("id", "name") VALUES ('a2', NULL)`)];
      const taps = async (as: readonly Assertion[], on: PGlite = db): Promise<string[]> => (await on.exec(pgTapScript(as, postgres))).flatMap((r) => r.rows.flatMap((x) => Object.values(x) as string[])).filter((l) => /^(not )?ok /.test(l));
      const ok = await taps(good);
      same(ok.length, good.length);
      assert(ok.every((l) => l.startsWith("ok ")), ok.filter((l) => !l.startsWith("ok ")).join("\n"));
      const bad: Assertion[] = [
        { kind: "has-table", table: { name: "nothing" } },
        { kind: "has-column", table: { name: "author" }, column: "id", notNull: false },
        { kind: "has-primary-key", table: { name: "author" }, columns: ["name"] },
        rows("wrong", `SELECT "id" FROM "author"`, [["zzz"]]),
        fails("accepted", `INSERT INTO "author" ("id", "name") VALUES ('a9', 'Fine')`),
      ];
      const notOk = await taps(bad, db2);
      same(notOk.filter((l) => l.startsWith("not ok")).length, bad.length, notOk.join("\n"));
      assert(pgTapScript([], postgres).startsWith("SELECT plan(0);"));
    } finally {
      await db.close();
      await db2.close();
    }
  },
);

proves(
  ["0049-sql-assertions FR-004"],
  "TAP is values that are written as TAP version 14 and read back, with a skipped test counted apart from a failure",
  () => {
    const nodes = [pass("party exists"), failed("person has 5 columns", { found: 4, among: ["a", "b"], at: { line: 3 } }), skipped("lock timeout", "the engine has none"), pass("with # a hash and \\ a backslash"), { kind: "comment" as const, text: "a note" }];
    const text = tapText(nodes);
    same(text, ["TAP version 14", "ok 1 - party exists", "not ok 2 - person has 5 columns", "  ---", "  found: 4", "  among:", "    - \"a\"", "    - \"b\"", "  at:", "    line: 3", "  ...", "ok 3 - lock timeout # SKIP the engine has none", "ok 4 - with \\# a hash and \\\\ a backslash", "# a note", "1..4", ""].join("\n"));
    same(tally(nodes), { passed: 2, failed: 1, skipped: 1 });
    const back = fromLines(["ok 1 - one", "not ok 2 - two", "ok 3 - three # SKIP why", "ok 4 - four # TODO later", "1..4", "TAP version 14", "a diagnostic"]);
    same(back.map((n) => (n.kind === "test" ? `${n.ok ? "ok" : "not ok"}:${n.description}:${n.directive?.kind ?? ""}` : n.kind === "comment" ? `#${n.text}` : "")), ["ok:one:", "not ok:two:", "ok:three:skip", "ok:four:todo", "#a diagnostic"]);
    same(tapText([]), "TAP version 14\n1..0\n");
  },
);
