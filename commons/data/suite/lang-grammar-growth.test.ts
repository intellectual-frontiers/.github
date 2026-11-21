/**
 * The grammar the corpora asked for (commons data 0069-sql-dialects FR-010 to FR-015): commands the grammar keeps as nodes of their own, `CREATE TABLE` as a query and with options, arrays and subscripts, `VALUES` as a
 * source, word operators of a dialect, and `COLLATE`.
 *
 * Spec: 0069-sql-dialects FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ansi,
  children,
  declareDialect,
  defineDialect,
  describeDialectError,
  type Dialect,
  type Expr,
  parse,
  Prec,
} from "@intellectual-frontiers/data/sql/lang";
import { dialect as clickhouse } from "@intellectual-frontiers/data/sql/lang/dialects/clickhouse";
import { dialect as mysql } from "@intellectual-frontiers/data/sql/lang/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";
import { dialect as tsql } from "@intellectual-frontiers/data/sql/lang/dialects/tsql";
import { readOnlyProblem } from "@intellectual-frontiers/data/sql/lang/extensions/query";
import { firstItem, show } from "./lang-fixture.ts";

const one = (sql: string, d: Dialect = ansi) => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  const s = p.script.statements[0];
  assert(s !== undefined);
  return s;
};

proves(
  ["0069-sql-dialects FR-010"],
  "a statement that begins with a command word, and a CREATE, ALTER or DROP of an object the grammar does not read, is a command node with its keyword, object and text, and never an error",
  () => {
    const c = (sql: string, d: Dialect = ansi): string => {
      const s = one(sql, d);
      assert(s.kind === "command", `${sql}: ${s.kind}`);
      assertEquals(children(s), []);
      return `${s.keyword}|${s.object ?? "-"}|${s.text}`;
    };
    assertEquals(c("SET search_path = a, b"), "SET|-|search_path = a, b");
    assertEquals(c("show tables"), "SHOW|-|tables");
    assertEquals(c("EXPLAIN ANALYZE SELECT 1"), "EXPLAIN|-|ANALYZE SELECT 1");
    assertEquals(c("GRANT SELECT ON t TO u"), "GRANT|-|SELECT ON t TO u");
    assertEquals(c("PRAGMA foreign_keys = ON", sqlite), "PRAGMA|-|foreign_keys = ON");
    assertEquals(c("BEGIN"), "BEGIN|-|");
    assertEquals(c("COMMIT;"), "COMMIT|-|");
    assertEquals(c("TRUNCATE TABLE t"), "TRUNCATE|-|TABLE t");
    assertEquals(c("IF EXISTS (SELECT 1) DROP VIEW v", tsql), "IF|-|EXISTS (SELECT 1) DROP VIEW v");
    assertEquals(c("CREATE SEQUENCE s START 1"), "CREATE|SEQUENCE|SEQUENCE s START 1");
    assertEquals(
      c("CREATE OR REPLACE FUNCTION f(a int) RETURNS int AS $$ select 1 $$ LANGUAGE sql", postgres),
      "CREATE|FUNCTION|OR REPLACE FUNCTION f(a int) RETURNS int AS $$ select 1 $$ LANGUAGE sql",
    );
    assertEquals(c("CREATE MATERIALIZED VIEW m AS SELECT 1"), "CREATE|VIEW|MATERIALIZED VIEW m AS SELECT 1");
    assertEquals(c("DROP SEQUENCE s"), "DROP|SEQUENCE|SEQUENCE s");
    assertEquals(c("ALTER SEQUENCE s RESTART"), "ALTER|SEQUENCE|SEQUENCE s RESTART");
    assertEquals(c("ALTER TABLE t ENABLE TRIGGER x"), "ALTER|TABLE|TABLE t ENABLE TRIGGER x");
    const p = parse("SET a = 1; SELECT 1; GRANT x");
    assertEquals(
      p.script.statements.map((s) => s.kind),
      ["command", "select", "command"],
    );
    assertEquals(p.errors, []);
    assertEquals(readOnlyProblem(parse("SET a = 1").script), "it holds a SET command");
    assertEquals(readOnlyProblem(parse("CREATE SEQUENCE s").script), "it holds a CREATE SEQUENCE command");
    const t = one("CREATE TEMP TABLE t (a INT)");
    assert(t.kind === "create-table" && t.temporary);
    const u = one("CREATE TABLE t (a INT)");
    assert(u.kind === "create-table" && !u.temporary);
    const tx = parse("SET a = 1 -- note\n").comments;
    assertEquals(tx.length, 1);
  },
);

proves(
  ["0069-sql-dialects FR-011"],
  "CREATE TABLE is read as a table made from a query, with no column list, and with the text after the columns or the name that the parser does not read kept as options",
  () => {
    const t = (sql: string, d: Dialect = ansi) => {
      const s = one(sql, d);
      assert(s.kind === "create-table", sql);
      return s;
    };
    const a = t("CREATE TABLE s.t AS SELECT 1 AS x");
    assertEquals([a.elements.length, a.query?.kind, a.options], [0, "select", undefined]);
    const b = t("CREATE TABLE IF NOT EXISTS t AS (SELECT 1)");
    assertEquals([b.ifNotExists, b.query?.kind], [true, "select"]);
    const c = t("CREATE TABLE t (a Int, b String) ENGINE = MergeTree ORDER BY a SETTINGS x = 1", clickhouse);
    assertEquals([c.elements.length, c.query, c.options], [2, undefined, "ENGINE = MergeTree ORDER BY a SETTINGS x = 1"]);
    const d = t("CREATE TABLE t ENGINE = Memory AS SELECT number AS x FROM system.numbers LIMIT 10", clickhouse);
    assertEquals([d.options, d.query?.kind], ["ENGINE = Memory", "select"]);
    const e = t("CREATE TABLE t LIKE u");
    assertEquals([e.elements.length, e.options], [0, "LIKE u"]);
    const f = t("CREATE TABLE t (a INT) WITH (fillfactor = 70) AS SELECT 1", postgres);
    assertEquals([f.elements.length, f.options, f.query?.kind], [1, "WITH (fillfactor = 70)", "select"]);
    assertEquals(t("CREATE TABLE t (a INT)").options, undefined);
    assertEquals(parse("CREATE TABLE").errors.length, 1, "a name is still needed");
  },
);

proves(
  ["0069-sql-dialects FR-012"],
  "arrays are read as [a, b] and ARRAY[a, b], a subscript as x[i] that binds as tightly as ::, and [ is a quote where the dialect says so",
  () => {
    const e = (sql: string, d: Dialect = ansi): Expr => firstItem(parse(`SELECT ${sql}`, d));
    const arr = e("[1, 2, 3]");
    assert(arr.kind === "array" && arr.items.length === 3);
    const arr2 = e("ARRAY[1, 2]");
    assert(arr2.kind === "array" && arr2.items.length === 2);
    const empty = e("ARRAY[]");
    assert(empty.kind === "array" && empty.items.length === 0);
    const sub = e("x[1]");
    assert(sub.kind === "subscript" && sub.arg.kind === "name" && sub.index.kind === "number");
    const sub2 = e("x[1][y + 1]");
    assert(sub2.kind === "subscript" && sub2.arg.kind === "subscript");
    const mixed = e("a[1] + b[2] * 3");
    assertEquals(show(mixed), "({subscript} + ({subscript} * 3))");
    const cast = e("a[1]::int", postgres);
    assert(cast.kind === "cast" && cast.arg.kind === "subscript");
    const typ = e("x::int[]", postgres);
    assert(typ.kind === "cast" && typ.type.name === "INT[]", "the array suffix of a type is still the type's");
    const nested = e("[[1], [2, 3]]");
    assert(nested.kind === "array" && nested.items[0]?.kind === "array");
    const q = e("[a]", tsql);
    assert(q.kind === "name" && q.parts[0]?.quoted === true, "[a] is a quoted identifier in T-SQL");
    const q2 = e("[a]", sqlite);
    assert(q2.kind === "name");
    assertEquals(parse("SELECT [1,", ansi).errors.length > 0, true);
    assertEquals(parse("SELECT x[", ansi).errors.length > 0, true);
  },
);

proves(["0069-sql-dialects FR-013"], "VALUES is read as a source, with an alias and a column list", () => {
  const s = one("SELECT x FROM VALUES (1), (2) AS t (x)");
  assert(s.kind === "select");
  const from = s.from[0];
  assert(from?.kind === "subquery" && from.query.kind === "values" && from.query.rows.length === 2);
  assertEquals([from.alias?.name.name, from.alias?.columns.map((c) => c.name)], ["t", ["x"]]);
  const j = one("SELECT 1 FROM VALUES (1) a JOIN VALUES (2) b ON TRUE");
  assert(j.kind === "select" && j.from[0]?.kind === "join");
  const paren = one("SELECT 1 FROM (VALUES (1)) v");
  assert(paren.kind === "select" && paren.from[0]?.kind === "subquery");
});

proves(
  ["0069-sql-dialects FR-014"],
  "a dialect's grammar may name word operators with binding powers, which become operator nodes, and one whose word is not a keyword of its lexical is an error value",
  () => {
    const g = (sql: string): string => show(firstItem(parse(`SELECT ${sql}`, mysql)));
    assertEquals(g("a + b DIV c"), "(a + (b DIV c))");
    assertEquals(g("a DIV b MOD c * d"), "(((a DIV b) MOD c) * d)");
    assertEquals(g("a OR b XOR c AND d"), "(a OR (b XOR (c AND d)))");
    assertEquals(g("a DIV 2 = 3"), "((a DIV 2) = 3)");
    assertEquals(parse("SELECT a DIV b").errors.length, 1, "not in the base dialect");
    const bad = defineDialect({
      name: "x",
      extends: ansi,
      lexical: (l) => l,
      grammar: (gr) => ({ ...gr, wordOperators: [{ text: "DIV", prec: Prec.Multiplicative }] }),
    });
    assert(bad.kind === "err" && describeDialectError(bad.error).includes("DIV"));
    const ok = declareDialect({
      name: "x",
      extends: ansi,
      lexical: (l) => ({ ...l, keywords: [...l.keywords, "DIV"] }),
      grammar: (gr) => ({ ...gr, wordOperators: [{ text: "DIV", prec: Prec.Multiplicative }] }),
    });
    assertEquals(show(firstItem(parse("SELECT a DIV b", ok))), "(a DIV b)");
  },
);

proves(["0069-sql-dialects FR-015"], "COLLATE is read after an expression as a node and after a data type as its collation", () => {
  const e = firstItem(parse('SELECT a COLLATE "C" = b'));
  assert(e.kind === "binary" && e.left.kind === "collate" && e.left.collation.parts[0]?.name === "C");
  const e2 = firstItem(parse("SELECT a || b COLLATE nocase"));
  assert(e2.kind === "binary" && e2.right.kind === "collate", "it binds to the operand next to it");
  const cast = firstItem(parse("SELECT CAST(x AS VARCHAR(2) COLLATE utf8_lcase)"));
  assert(cast.kind === "cast" && cast.type.name === "VARCHAR" && cast.type.collation === "utf8_lcase" && cast.type.args.length === 1);
  const col = one("CREATE TABLE t (name TEXT COLLATE nocase NOT NULL)");
  assert(col.kind === "create-table");
  const def = col.elements[0];
  assert(def?.kind === "column-def" && def.type.collation === "nocase" && def.constraints[0]?.kind === "not-null");
  const q = firstItem(parse("SELECT a COLLATE s.c"));
  assert(q.kind === "collate" && q.collation.parts.length === 2);
});
