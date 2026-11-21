/**
 * The guard of a query that only reads (commons lang-sql 0012-sql-guard FR-001 to FR-007): one statement that reads is allowed, anything that writes, defines, locks, sleeps or reaches out is refused with its span, a word of a write in a string or a comment
 * is not a violation, and a catalog binds a plain SELECT.
 *
 * Spec: 0012-sql-guard FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Dialect } from "@intellectual-frontiers/lang-sql";
import { catalogFromTables } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { DENIED_FUNCTIONS, guard, refusal } from "@intellectual-frontiers/lang-sql/aide/guard";
import { dialect as duckdb } from "@intellectual-frontiers/lang-sql/dialects/duckdb";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { ALL_DIALECTS } from "./fixture.ts";

const allowed = (sql: string, d: Dialect = postgres, o = {}): boolean => guard(sql, d, o).kind === "ok";
const why = (sql: string, d: Dialect = postgres, o = {}): string | undefined => refusal(sql, d, o);

proves(["0012-sql-guard FR-001"], "a statement that only reads is allowed, anything that writes, defines, takes locks or makes a table is refused, and a word of a write in a string, an identifier or a comment is not a violation", () => {
  for (const q of [
    "SELECT 1",
    "SELECT a, b FROM t WHERE c IN (SELECT c FROM u) ORDER BY a LIMIT 5",
    "WITH x AS (SELECT 1 AS a) SELECT * FROM x",
    "SELECT 1 UNION ALL SELECT 2",
    "VALUES (1), (2)",
    "SELECT 'DELETE FROM t; DROP TABLE t'",
    'SELECT "insert", "update" FROM "delete"',
    "SELECT 1 -- ; DROP TABLE t",
    "SELECT /* INSERT INTO t */ 1",
    "SELECT $$ UPDATE t SET a = 1 $$",
    "SELECT count(*) FILTER (WHERE a > 1) OVER () FROM t",
    "SELECT * FROM generate_series(1, 3)",
  ]) assert(allowed(q), `${q}: ${why(q)}`);
  for (const [q, part] of [
    ["INSERT INTO t VALUES (1)", "insert is not in the language read-only"],
    ["UPDATE t SET a = 1", "update is not"],
    ["DELETE FROM t", "delete is not"],
    ["DROP TABLE t", "drop is not"],
    ["CREATE TABLE t (a int)", "create-table is not"],
    ["CREATE INDEX i ON t (a)", "create-index is not"],
    ["ALTER TABLE t ADD COLUMN a int", "alter-table is not"],
    ["CREATE VIEW v AS SELECT 1", "create-view is not"],
    ["CREATE FUNCTION f() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql", "create-routine is not"],
    ["WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x", "delete is not"],
    ["WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x", "insert is not"],
    ["SELECT * INTO new_t FROM t", "SELECT ... INTO makes a table"],
    ["SELECT * FROM t FOR UPDATE", "a locking clause takes locks"],
    ["SELECT * FROM t FOR SHARE NOWAIT", "a locking clause takes locks"],
    ["INSERT INTO t VALUES (1) ON CONFLICT DO NOTHING", "insert is not"],
    ["GRANT SELECT ON t TO u", "GRANT is not a read"],
    ["SET search_path = x", "SET is not a read"],
    ["COPY t TO '/tmp/x'", "COPY is not a read"],
    ["EXPLAIN ANALYZE DELETE FROM t", "EXPLAIN is not a read"],
    ["BEGIN", "BEGIN is not a read"],
  ] as const) {
    const r = why(q);
    assert(r !== undefined && r.includes(part), `${q}: ${r}`);
  }
  const bad = guard("SELECT 1 FROM t WHERE (", postgres);
  assert(bad.kind === "err" && bad.error[0]?.message.startsWith("expected"));
  const w = guard("WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x", postgres);
  assert(w.kind === "err");
  assertEquals("WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x".slice(w.error[0]?.start, w.error[0]?.end), "DELETE FROM t RETURNING *");
  const ok = guard("SELECT 1", postgres);
  assert(ok.kind === "ok" && ok.value.statement.kind === "select" && ok.value.parsed.text === "SELECT 1");
});

proves(["0012-sql-guard FR-002"], "more than one statement, none and one that could not be read are each a violation, and a trailing semicolon is not", () => {
  assert(allowed("SELECT 1;"));
  assert(allowed("  SELECT 1 ;  "));
  assertEquals(why("SELECT 1; SELECT 2"), "the text has 2 statements, and the language read-only allows 1 (line 1, column 1)");
  assert(why("SELECT 1; DROP TABLE t")?.includes("2 statements"));
  assertEquals(why(""), "the text holds no statement (line 1, column 1)");
  assertEquals(why("  -- nothing\n"), "the text holds no statement (line 1, column 1)");
  assert(why("SELEC 1") !== undefined);
  assert(why(";") !== undefined);
});

proves(["0012-sql-guard FR-003"], "the denied functions are refused without regard to case or schema, and the list can be replaced", () => {
  for (const f of ["pg_sleep(1)", "PG_SLEEP(1)", "pg_catalog.pg_sleep(1)", "pg_read_file('/etc/passwd')", "lo_import('/x')", "nextval('s')", "setval('s', 1)", "set_config('a', 'b', false)", "dblink('x', 'y')", "pg_advisory_lock(1)", "pg_terminate_backend(1)"]) {
    assert(why(`SELECT ${f}`)?.includes("is denied in the language read-only"), f);
  }
  assert(why("SELECT * FROM t WHERE a = (SELECT pg_sleep(1))") !== undefined);
  assert(why("SELECT 1 FROM pg_read_file('/x')") !== undefined);
  assert(why("SELECT load_extension('x.so')", sqlite) !== undefined);
  assert(why("SELECT sleep(10)", mysql) !== undefined);
  assert(why("SELECT benchmark(1000000, md5('a'))", mysql) !== undefined);
  assert(allowed("SELECT lower(a), upper(b), count(*), now() FROM t"));
  assert(allowed("SELECT pg_sleep(1)", postgres, { deniedFunctions: [] }));
  assert(!allowed("SELECT my_secret(1)", postgres, { deniedFunctions: ["my_secret"] }));
  assert(allowed("SELECT nextval('s')", postgres, { deniedFunctions: ["my_secret"] }));
  assert(DENIED_FUNCTIONS.length >= 24);
});

proves(["0012-sql-guard FR-004"], "a PRAGMA that reads is allowed only where it is asked for, and a PRAGMA that sets never is", () => {
  assertEquals(why("PRAGMA foreign_keys", sqlite), "PRAGMA is not a read (line 1, column 1)");
  assert(allowed("PRAGMA foreign_keys", sqlite, { allowPragma: true }));
  assert(allowed("PRAGMA main.user_version", sqlite, { allowPragma: true }));
  assertEquals(why("PRAGMA foreign_keys = ON", sqlite, { allowPragma: true }), "a PRAGMA that sets is not a read (line 1, column 1)");
  assert(why("PRAGMA journal_mode(wal)", sqlite, { allowPragma: true }) !== undefined);
  assert(why("PRAGMA x; SELECT 1", sqlite, { allowPragma: true }) !== undefined);
  assert(why("VACUUM", sqlite, { allowPragma: true }) !== undefined);
  assert(why("ATTACH DATABASE 'x' AS y", sqlite, { allowPragma: true }) !== undefined);
});

proves(["0012-sql-guard FR-005"], "a plain SELECT is bound to a catalog, the tables can be restricted, and the size of the statement can be limited", () => {
  const catalog = catalogFromTables([{ name: "processes", columns: [{ name: "pid", type: "BIGINT" }, { name: "name", type: "TEXT" }] }, { name: "users", columns: [{ name: "uid", type: "BIGINT" }, { name: "username", type: "TEXT" }] }], { bigint: "int", text: "text" });
  assert(allowed("SELECT pid, name FROM processes WHERE pid > 1", sqlite, { catalog }));
  assertEquals(why("SELECT pid, nme FROM processes", sqlite, { catalog }), "there is no column nme; did you mean name? (line 1, column 13)");
  assertEquals(why("SELECT * FROM proceses", sqlite, { catalog }), "there is no table proceses; did you mean processes? (line 1, column 15)");
  assert(allowed("SELECT 1 UNION SELECT 2", sqlite, { catalog }), "only a plain SELECT is bound");
  assert(allowed("SELECT * FROM processes", sqlite, { tables: ["processes"] }));
  assert(why("SELECT * FROM users", sqlite, { tables: ["processes"] })?.includes("the table users is not in the language read-only"));
  assert(why("SELECT 1 + 2 + 3 + 4 + 5", sqlite, { maxNodes: 5 })?.includes("the statement has"));
  assert(allowed("SELECT 1", sqlite, { maxNodes: 5 }));
});

proves(["0012-sql-guard FR-006"], "refusal gives the sentence and the place of the first violation, and nothing throws for any text in any dialect", () => {
  assertEquals(why("SELECT 1\nFROM t\nWHERE a = 1;\nDELETE FROM t"), "the text has 2 statements, and the language read-only allows 1 (line 1, column 1)");
  assertEquals(why("\n\n  DELETE FROM t"), "delete is not in the language read-only (line 3, column 3)");
  assertEquals(why("SELECT 1"), undefined);
  for (const d of [...ALL_DIALECTS, postgres, duckdb]) {
    for (const t of ["", "\0", "SELECT", "(((", "'unclosed", "SELECT 1; DELETE FROM t", "WITH RECURSIVE r AS (SELECT 1) SELECT * FROM r", "SELECT * FROM t FOR UPDATE", "x'zz'", "\ud800", "SELECT " + "(".repeat(300) + "1" + ")".repeat(300)]) {
      assert(typeof (why(t, d) ?? "") === "string");
    }
  }
});

proves(["0012-sql-guard FR-007"], "a catalog is made from tables described in the types of another system, with a map of types and unknown for the rest", () => {
  const c = catalogFromTables([{ name: "t", columns: [{ name: "a", type: "INTEGER" }, { name: "b", type: "weird" }, { name: "c", type: "text" }, { name: "d", type: "Timestamp" }] }], { integer: "int" });
  assertEquals(c.tables["t"]?.columns, { a: "int", b: "unknown", c: "text", d: "timestamp" });
  assertEquals(c.functions, []);
  assertEquals(catalogFromTables([]).tables, {});
});

proves(["0012-sql-guard FR-004"], "a PRAGMA that lists a table is a read where PRAGMA is allowed, and a call that sets is not", () => {
  assert(allowed("PRAGMA table_info(users)", sqlite, { allowPragma: true }));
  assert(allowed("PRAGMA main.index_list('users')", sqlite, { allowPragma: true }));
  assertEquals(why("PRAGMA journal_mode(wal)", sqlite, { allowPragma: true }), "a PRAGMA that sets is not a read (line 1, column 1)");
});

proves(["0012-sql-guard FR-005"], "a common table expression's own name is not a table of the allow-list, while the tables its body reads are still checked, and a name does not shadow a table inside its own definition", () => {
  const o = { tables: ["asset"] };
  assert(allowed("WITH t AS (SELECT id FROM asset) SELECT id FROM t", postgres, o));
  assert(allowed("WITH a AS (SELECT id FROM asset), b AS (SELECT id FROM a) SELECT id FROM b", postgres, o));
  assert(allowed("WITH RECURSIVE r AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT n FROM r", postgres, { tables: [] }));
  assertEquals(why("WITH t AS (SELECT id FROM secrets) SELECT id FROM t", postgres, o), "the table secrets is not in the language read-only (line 1, column 27)");
  assert(why("WITH asset AS (SELECT id FROM users) SELECT id FROM asset", postgres, o) !== undefined, "a name does not hide the table its own body reads");
  assert(why("SELECT id FROM t", postgres, o) !== undefined, "outside the WITH it is a table");
});
