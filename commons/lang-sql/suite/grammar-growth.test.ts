/**
 * The grammar the corpora asked for (commons lang-sql 0005-sql-dialects FR-010 to FR-015): commands the grammar keeps as nodes of their own, `CREATE TABLE` as a query and with options, arrays and subscripts, `VALUES` as a
 * source, word operators of a dialect, and `COLLATE`.
 *
 * Spec: 0005-sql-dialects FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
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
} from "@intellectual-frontiers/lang-sql";
import { dialect as duckdb } from "@intellectual-frontiers/lang-sql/dialects/duckdb";
import { dialect as spark } from "@intellectual-frontiers/lang-sql/dialects/spark";
import { dialect as databricks } from "@intellectual-frontiers/lang-sql/dialects/databricks";
import { dialect as clickhouse } from "@intellectual-frontiers/lang-sql/dialects/clickhouse";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { dialect as tsql } from "@intellectual-frontiers/lang-sql/dialects/tsql";
import { readOnlyProblem } from "@intellectual-frontiers/lang-sql/extensions/query";
import { firstItem, show } from "./fixture.ts";

const one = (sql: string, d: Dialect = ansi) => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  const s = p.script.statements[0];
  assert(s !== undefined);
  return s;
};

proves(
  ["0005-sql-dialects FR-010"],
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
    assertEquals(c("CREATE EXTENSION IF NOT EXISTS hstore"), "CREATE|EXTENSION|EXTENSION IF NOT EXISTS hstore");
    assertEquals(
      c("CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW EXECUTE FUNCTION f()"),
      "CREATE|TRIGGER|TRIGGER t BEFORE INSERT ON x FOR EACH ROW EXECUTE FUNCTION f()",
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
  ["0005-sql-dialects FR-011"],
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
  ["0005-sql-dialects FR-012"],
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
    assert(sub.kind === "subscript" && sub.arg.kind === "name" && sub.index?.kind === "number");
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

proves(["0005-sql-dialects FR-013"], "VALUES is read as a source, with an alias and a column list", () => {
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
  ["0005-sql-dialects FR-014"],
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

proves(["0005-sql-dialects FR-015"], "COLLATE is read after an expression as a node and after a data type as its collation", () => {
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

proves(
  ["0005-sql-dialects FR-016"],
  "a select is read with DISTINCT ON, GROUP BY ALL, the empty grouping and GROUPING SETS, a WINDOW clause and QUALIFY, and a frame with its EXCLUDE; QUALIFY stays a name where nothing but the end of an item follows it",
  () => {
    const sel = (sql: string, d: Dialect = ansi) => {
      const s = one(sql, d);
      assert(s.kind === "select", sql);
      return s;
    };
    assertEquals(sel("SELECT DISTINCT ON (a, b) a FROM t", postgres).distinctOn.length, 2);
    const g = sel("SELECT a FROM t GROUP BY ALL");
    assertEquals([g.groupAll, g.groupBy.length], [true, 0]);
    const g2 = sel("SELECT a FROM t GROUP BY ALL a, b");
    assertEquals([g2.groupAll, g2.groupBy.length], [true, 2]);
    const g3 = sel("SELECT a FROM t GROUP BY GROUPING SETS ((a), (a, b), ()), ()");
    const sets = g3.groupBy[0];
    assert(sets?.kind === "call" && sets.name.parts[0]?.name === "GROUPING SETS" && sets.args.length === 3);
    assert(g3.groupBy[1]?.kind === "tuple" && g3.groupBy[1].items.length === 0);
    const w = sel(
      "SELECT sum(a) OVER w FROM t WINDOW w AS (PARTITION BY b ORDER BY c ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES), v AS (w)",
      postgres,
    );
    assertEquals(
      w.windows.map((x) => x.name.name),
      ["w", "v"],
    );
    assertEquals(w.windows[0]?.spec.frame?.exclude, "TIES");
    const q = sel("SELECT a FROM t QUALIFY row_number() OVER (ORDER BY a) = 1", postgres);
    assert(q.qualify?.kind === "binary");
    const n = sel("SELECT qualify FROM t");
    assert(n.items[0]?.expr.kind === "name" && n.qualify === undefined);
    assertEquals(sel("SELECT 1 qualify").items[0]?.alias?.name, "qualify");
  },
);

proves(
  ["0005-sql-dialects FR-017"],
  "a call is read with an ORDER BY among its arguments, WITHIN GROUP, and a query as an argument",
  () => {
    const c = (sql: string) => {
      const e = firstItem(parse(`SELECT ${sql}`));
      assert(e.kind === "call", sql);
      return e;
    };
    const a = c("string_agg(x, ',' ORDER BY y DESC, z)");
    assertEquals([a.args.length, a.orderBy.length], [2, 2]);
    const w = c("percentile_cont(0.5) WITHIN GROUP (ORDER BY x) FILTER (WHERE y > 1)");
    assertEquals([w.withinGroup.length, w.filter?.kind], [1, "binary"]);
    const q = c("ANY (SELECT b FROM t)");
    assert(q.args[0]?.kind === "scalar-query");
    const r = firstItem(parse("SELECT a = ALL (SELECT b FROM t)"));
    assert(r.kind === "binary" && r.right.kind === "call");
    assertEquals(parse("SELECT array(SELECT 1)").errors, []);
  },
);

proves(
  ["0005-sql-dialects FR-018"],
  "TRY_CAST, SAFE_CAST and CAST ... FORMAT are casts, and a parenthesized join keeps its alias and may begin with a query",
  () => {
    const t = firstItem(parse("SELECT TRY_CAST(a AS INT), safe_cast(a AS INT), CAST(a AS DATE FORMAT 'YYYY')"));
    assert(t.kind === "cast" && t.try && t.format === undefined);
    const items = one("SELECT TRY_CAST(a AS INT), safe_cast(a AS INT), CAST(a AS DATE FORMAT 'YYYY')");
    assert(items.kind === "select");
    assertEquals(
      items.items.map((i) => (i.expr.kind === "cast" ? [i.expr.try, i.expr.format?.kind] : [])),
      [
        [true, undefined],
        [true, undefined],
        [false, "string"],
      ],
    );
    const j = one("SELECT * FROM (a LEFT JOIN b ON a.x = b.x) AS t");
    assert(j.kind === "select" && j.from[0]?.kind === "join" && j.from[0].alias?.name.name === "t");
    const k = one("SELECT * FROM ((SELECT 1 AS x) AS a INNER JOIN b ON a.x = b.x)");
    assert(k.kind === "select" && k.from[0]?.kind === "join");
    assert(one("SELECT * FROM ((SELECT 1) JOIN t ON TRUE)").kind === "select");
    assert(one("SELECT * FROM ((SELECT 1) UNION (SELECT 2)) AS u").kind === "select");
  },
);

const exprOf = (sql: string, d: Dialect = postgres): Expr => firstItem(parse(`SELECT ${sql}`, d));

proves(
  ["0005-sql-dialects FR-019"],
  "expressions are read with fields of rows, slices, typed literals, interval ranges, keyword arguments, null treatment, SIMILAR TO, NOT NULL, IS, IN with no list or a table, DEFAULT and star modifiers",
  () => {
    const f = exprOf("(r).c", postgres);
    assert(f.kind === "field" && f.field?.name === "c");
    const fs = exprOf("(r).*", postgres);
    assert(fs.kind === "field" && fs.field === undefined);
    const f2 = exprOf("a[1].b[2]", postgres);
    assert(f2.kind === "subscript" && f2.arg.kind === "field");
    const sl = exprOf("a[1:3]", postgres);
    assert(sl.kind === "subscript" && sl.slice && sl.index?.kind === "number" && sl.upper?.kind === "number");
    const sl2 = exprOf("a[:2]", postgres);
    assert(sl2.kind === "subscript" && sl2.slice && sl2.index === undefined && sl2.upper !== undefined);
    const sl3 = exprOf("a[1:]", postgres);
    assert(sl3.kind === "subscript" && sl3.slice && sl3.upper === undefined);
    const t = exprOf("DATE '2020-01-01'");
    assert(t.kind === "typed-string" && t.type === "DATE" && t.value.value === "2020-01-01");
    const t2 = exprOf("timestamp without time zone 'today'", postgres);
    assert(t2.kind === "typed-string" && t2.type === "TIMESTAMP WITHOUT TIME ZONE");
    const iv = exprOf("INTERVAL '1 2' DAY TO SECOND(2)");
    assert(iv.kind === "interval" && iv.unit === "DAY TO SECOND(2)");
    const keyed = (sql: string): string => {
      const c = exprOf(sql, postgres);
      assert(c.kind === "call", sql);
      return c.args.map((a) => (a.kind === "keyword-arg" ? a.keyword : a.kind)).join(" ");
    };
    assertEquals(keyed("TRIM(BOTH FROM ' x ')"), "BOTH FROM");
    assertEquals(keyed("TRIM(LEADING 'x' FROM y)"), "LEADING FROM");
    assertEquals(keyed("SUBSTRING(x FROM 1 FOR 2)"), "name FROM FOR");
    assertEquals(keyed("SUBSTRING('a' SIMILAR 'p' ESCAPE '#')"), "string SIMILAR ESCAPE");
    assertEquals(keyed("OVERLAY(x PLACING y FROM 1)"), "name PLACING FROM");
    assertEquals(keyed("f(VARIADIC arr)"), "VARIADIC");
    const nt = exprOf("first_value(x) IGNORE NULLS OVER (ORDER BY y)");
    assert(nt.kind === "call" && nt.nullTreatment === "ignore" && nt.over !== undefined);
    const st = exprOf("a SIMILAR TO 'x' ESCAPE '#'");
    assert(st.kind === "like" && st.op === "SIMILAR TO" && st.escape !== undefined);
    const nn = exprOf("a NOT NULL");
    assert(nn.kind === "is" && nn.negated && nn.test === "null");
    const is = exprOf("a IS b", sqlite);
    assert(is.kind === "is" && is.test === "distinct-from" && is.negated, "a IS b is NOT DISTINCT FROM");
    const isn = exprOf("a IS NOT b", sqlite);
    assert(isn.kind === "is" && isn.test === "distinct-from" && !isn.negated);
    const e = exprOf("a IN ()", sqlite);
    assert(e.kind === "in" && e.values.length === 0 && !e.bare);
    const bare = exprOf("1 NOT IN t1", sqlite);
    assert(bare.kind === "in" && bare.bare && bare.negated && bare.values[0]?.kind === "name");
    assert(one("INSERT INTO t VALUES (DEFAULT, 1)", postgres).kind === "insert");
    const s = one("SELECT * EXCEPT (a, b) REPLACE (1 AS c), t.* RENAME (x AS y) FROM t");
    assert(s.kind === "select");
    const star = s.items[0]?.expr;
    assert(star?.kind === "star" && star.modifiers.map((m) => m.keyword).join() === "EXCEPT,REPLACE" && star.modifiers[0]?.items.length === 2);
    const star2 = s.items[1]?.expr;
    assert(star2?.kind === "star" && star2.qualifier !== undefined && star2.modifiers[0]?.keyword === "RENAME");
    assert(one("SELECT * FROM t EXCEPT (SELECT * FROM u)").kind === "set-op");
  },
);

proves(
  ["0005-sql-dialects FR-020"],
  "a dialect with operator runs reads the operators it does not list, before and between operands, and a run does not end in a sign",
  () => {
    const e = (sql: string, d: Dialect = postgres): string => show(exprOf(sql, d));
    assertEquals(e("a *= b"), "(a *= b)");
    assertEquals(e("a ~<~ b"), "(a ~<~ b)");
    assertEquals(e("a @> b"), "(a @> b)");
    assertEquals(e("@ x"), "(@ x)");
    assertEquals(e("|/ x + 1"), "((|/ x) + 1)");
    assertEquals(e("a = -1"), "(a = (- 1))");
    assertEquals(e("a=-1"), "(a = (- 1))", "a trailing sign is not part of the run");
    assertEquals(e("a*-1"), "(a * (- 1))");
    assertEquals(e("a <@- b").includes("<@-"), true, "a run with @ may end in a sign");
    assertEquals(parse("SELECT a *= b").errors.length > 0, true, "not in the base dialect");
  },
);

proves(
  ["0005-sql-dialects FR-021"],
  "data changes are read with conflict clauses, aliases, paths for columns, USING, and data changes in WITH",
  () => {
    const i = one("INSERT INTO t AS x (a, b[1], c.d) VALUES (1, 2, 3) ON CONFLICT (a) WHERE a > 0 DO UPDATE SET b[1] = excluded.b[1], (c, d) = (1, 2) WHERE x.a < 5 RETURNING *", postgres);
    assert(i.kind === "insert" && i.alias?.name === "x" && i.columns.length === 3 && i.columns[1]?.kind === "subscript" && i.columns[2]?.kind === "name");
    const oc = i.onConflict;
    assert(oc !== undefined && oc.update && oc.targets.length === 1 && oc.targetWhere !== undefined && oc.assignments.length === 2 && oc.where !== undefined);
    assert(oc.assignments[0]?.target.kind === "subscript" && oc.assignments[1]?.target.kind === "tuple");
    const n = one("INSERT INTO t VALUES (1) ON CONFLICT ON CONSTRAINT pk DO NOTHING", postgres);
    assert(n.kind === "insert" && n.onConflict?.constraint?.name === "pk" && !n.onConflict.update);
    const r = one("INSERT OR REPLACE INTO t (a) VALUES (1)", sqlite);
    assert(r.kind === "insert" && r.conflict === "REPLACE");
    const r2 = one("REPLACE INTO t VALUES (1)", sqlite);
    assert(r2.kind === "insert" && r2.conflict === "REPLACE");
    const u = one("UPDATE t SET a[1] = 1, r.f = 2, (b, c) = (3, 4)", postgres);
    assert(u.kind === "update" && u.assignments.map((a) => a.target.kind).join() === "subscript,name,tuple");
    const d = one("DELETE FROM t USING u, v WHERE t.a = u.a", postgres);
    assert(d.kind === "delete" && d.using.length === 2);
    const w = one("WITH a AS MATERIALIZED (INSERT INTO x VALUES (1) RETURNING *), b AS NOT MATERIALIZED (SELECT 1) DELETE FROM y WHERE EXISTS (SELECT 1 FROM a)", postgres);
    assert(w.kind === "with" && w.body.kind === "delete");
    assertEquals(w.ctes.map((c) => [c.query.kind, c.materialized]), [["insert", "materialized"], ["select", "not-materialized"]]);
    const w2 = one("WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM t) SEARCH DEPTH FIRST BY n SET o CYCLE n SET c USING p SELECT * FROM t", postgres);
    assert(w2.kind === "with" && w2.ctes[0]?.trailer?.startsWith("SEARCH") === true && w2.ctes[0].trailer.endsWith("USING p"));
    assert(w2.kind === "with" && w2.body.kind === "select");
    assertEquals(parse("INSERT INTO t VALUES (1) ON CONFLICT DO").errors.length > 0, true);
  },
);

proves(
  ["0005-sql-dialects FR-022"],
  "definitions are read with no columns, LIKE, column options, constraints with options, index and view options, and alter actions with options",
  () => {
    const t0 = one("CREATE TABLE t () INHERITS (p)", postgres);
    assert(t0.kind === "create-table" && t0.elements.length === 0 && t0.options === "INHERITS (p)");
    const t = one(
      "CREATE TABLE t (LIKE o INCLUDING ALL, a int GENERATED ALWAYS AS IDENTITY (INCREMENT BY 2) NOT NULL, b int GENERATED ALWAYS AS (a * 2) STORED, c INTEGER PRIMARY KEY AUTOINCREMENT, d int CHECK (d > 0) NO INHERIT, CONSTRAINT n NOT NULL a, FOREIGN KEY (a) REFERENCES o (x) MATCH FULL DEFERRABLE INITIALLY DEFERRED)",
      postgres,
    );
    assert(t.kind === "create-table");
    assertEquals(
      t.elements.map((e) => e.kind),
      ["table-like", "column-def", "column-def", "column-def", "column-def", "column-option", "foreign-key"],
    );
    const like = t.elements[0];
    assert(like?.kind === "table-like" && like.options === "INCLUDING ALL");
    const a = t.elements[1];
    assert(a?.kind === "column-def" && a.type.name === "INT" && a.constraints.map((c) => c.kind).join() === "column-option,not-null");
    const gen = a.constraints[0];
    assert(gen?.kind === "column-option" && gen.text.startsWith("GENERATED ALWAYS AS IDENTITY") && gen.expr === undefined);
    const b = t.elements[2];
    assert(b?.kind === "column-def" && b.constraints[0]?.kind === "column-option" && b.constraints[0].expr?.kind === "binary");
    const c = t.elements[3];
    assert(c?.kind === "column-def" && c.constraints.map((x) => x.kind).join() === "primary-key,column-option");
    const d = t.elements[4];
    assert(d?.kind === "column-def" && d.constraints[0]?.kind === "check" && d.constraints[0].options === "NO INHERIT");
    const fk = t.elements[6];
    assert(fk?.kind === "foreign-key" && fk.reference.options === "MATCH FULL DEFERRABLE INITIALLY DEFERRED");
    const ix = one("CREATE INDEX i ON t USING gist (a gist_trgm_ops(siglen=32), b DESC) INCLUDE (c) WITH (fillfactor = 70) WHERE a > 0", postgres);
    assert(ix.kind === "create-index" && ix.method === "gist" && ix.items[0]?.opclass === "gist_trgm_ops(siglen=32)" && ix.items[1]?.direction === "desc");
    assertEquals([ix.options, ix.where?.kind], ["INCLUDE (c) WITH (fillfactor = 70)", "binary"]);
    const v = one("CREATE VIEW v WITH (security_barrier = true) AS SELECT 1 WITH LOCAL CHECK OPTION", postgres);
    assert(v.kind === "create-view" && v.options === "WITH (security_barrier = true)" && v.checkOption === "WITH LOCAL CHECK OPTION");
    const al = one("ALTER TABLE t ADD CONSTRAINT c CHECK (a > 0) NOT VALID, DROP COLUMN x CASCADE, DROP y", postgres);
    assert(al.kind === "alter-table");
    const [add, dropX, dropY] = al.actions;
    assert(add?.kind === "add-constraint" && add.constraint.kind === "check" && add.constraint.options === "NOT VALID");
    const nv = one("ALTER TABLE t ADD CONSTRAINT u UNIQUE (a) NOT VALID", postgres);
    assert(nv.kind === "alter-table" && nv.actions[0]?.kind === "add-constraint" && nv.actions[0].constraint.kind === "unique" && nv.actions[0].constraint.options === "NOT VALID");
    assert(dropX?.kind === "drop-column" && dropX.behavior === "cascade" && dropY?.kind === "drop-column" && dropY.behavior === undefined);
    const typed = one("SELECT * FROM f() AS t (a int, b text, c)", postgres);
    assert(typed.kind === "select" && typed.from[0]?.kind === "table-fn");
    const al2 = typed.from[0].alias;
    assertEquals([al2?.columns.map((x) => x.name), al2?.types.map((x) => x?.name)], [["a", "b", "c"], ["INT", "TEXT", undefined]]);
  },
);

proves(
  ["0005-sql-dialects FR-023"],
  "queries are read with LIMIT offset and count, table hints, WITH ORDINALITY, semi and anti joins, joins that nest on the right, a USING alias, and a select with no items",
  () => {
    const sel = (sql: string, d: Dialect = ansi) => {
      const s = one(sql, d);
      assert(s.kind === "select", sql);
      return s;
    };
    const l = sel("SELECT * FROM t LIMIT 5, 10", sqlite);
    assertEquals([l.limit?.kind === "number" && l.limit.text, l.offset?.kind === "number" && l.offset.text], ["10", "5"]);
    const h = sel("SELECT * FROM t AS x NOT INDEXED, u INDEXED BY s.i", sqlite);
    assert(h.from[0]?.kind === "table" && h.from[0].hint === "NOT INDEXED" && h.from[0].alias?.name.name === "x");
    assert(h.from[1]?.kind === "table" && h.from[1].hint === "INDEXED BY s.i" && h.from[1].alias === undefined);
    const o = sel("SELECT * FROM t CROSS JOIN LATERAL unnest(t.a) WITH ORDINALITY AS r (v, i)", postgres);
    const oj = o.from[0];
    assert(oj?.kind === "join" && oj.right.kind === "table-fn" && oj.right.ordinality && oj.right.lateral);
    const sj = sel("SELECT * FROM a LEFT SEMI JOIN b ON a.x = b.x LEFT ANTI JOIN c ON a.x = c.x");
    const anti = sj.from[0];
    assert(anti?.kind === "join" && anti.type === "anti" && anti.left.kind === "join" && anti.left.type === "semi");
    const nest = sel("SELECT * FROM a JOIN b JOIN c ON b.x = c.x ON a.x = b.x", postgres);
    const outer = nest.from[0];
    assert(outer?.kind === "join" && outer.left.kind === "table" && outer.right.kind === "join" && outer.on !== undefined && outer.right.on !== undefined);
    const flat = sel("SELECT * FROM a CROSS JOIN b JOIN c ON b.x = c.x", postgres);
    const fj = flat.from[0];
    assert(fj?.kind === "join" && fj.left.kind === "join" && fj.right.kind === "table", "a cross join does not nest");
    const ua = sel("SELECT * FROM a JOIN b USING (i) AS x", postgres);
    assert(ua.from[0]?.kind === "join" && ua.from[0].usingAlias?.name === "x");
    const empty = sel("SELECT FROM t", postgres);
    assertEquals(empty.items.length, 0);
    assertEquals(parse("SELECT FROM t").errors.length, 1, "only where the dialect allows it");
    const lock = sel("SELECT a FROM t x FOR UPDATE OF x NOWAIT FOR SHARE SKIP LOCKED", postgres);
    assertEquals([lock.locking, lock.from[0]?.kind === "table" && lock.from[0].alias?.name.name], ["FOR UPDATE OF x NOWAIT FOR SHARE SKIP LOCKED", "x"]);
    const sl = one("SELECT 1 UNION SELECT 2 FOR UPDATE", postgres);
    assert(sl.kind === "set-op" && sl.locking === "FOR UPDATE");
    const tz = exprOf("t AT TIME ZONE 'UTC' + 1");
    assertEquals(show(tz), '((t AT TIME ZONE "UTC") + 1)');
    const ci = one("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS i ON ONLY t (a)", postgres);
    assert(ci.kind === "create-index" && ci.concurrently && ci.only && ci.ifNotExists && ci.unique);
    const di = one("DROP INDEX CONCURRENTLY IF EXISTS i", postgres);
    assert(di.kind === "drop" && di.concurrently && di.ifExists);
    const ph = one("SELECT * INTO TEMP t2 FROM ONLY p* x TABLESAMPLE SYSTEM (50) REPEATABLE (1) WHERE POSITION('a' IN 'abc') = 1 AND b BETWEEN SYMMETRIC 2 AND 1", postgres);
    assert(ph.kind === "select" && ph.into === "INTO TEMP t2" && ph.from[0]?.kind === "table" && ph.from[0].hint === "ONLY * TABLESAMPLE SYSTEM (50) REPEATABLE (1)");
    assertEquals(one("CREATE TABLE t (a int, PRIMARY KEY (a) DEFERRABLE INITIALLY DEFERRED, EXCLUDE USING gist (a WITH &&))", postgres).kind, "create-table");
    assertEquals(firstItem(parse("SELECT 'a'\n'b'", postgres)).kind === "string" && (firstItem(parse("SELECT 'a'\n'b'", postgres)) as { value: string }).value, "ab");
    assertEquals(one("ALTER TABLE t DROP CONSTRAINT c RESTRICT", postgres).kind, "alter-table");
    assertEquals(one("CREATE TABLE t (a int, b int, CONSTRAINT x NOT NULL a NO INHERIT, CHECK (a > 0) NO INHERIT)", postgres).kind, "create-table");
    assertEquals(one("CREATE TABLE t (a int GENERATED BY DEFAULT AS IDENTITY NOT NULL, b int UNIQUE NULLS NOT DISTINCT)", postgres).kind, "create-table");
  },
);


proves(
  ["0005-sql-dialects FR-024"],
  "a dialect's grammar switches on a query that begins with FROM, lambdas, paths, indexes in CREATE TABLE, the tail of a query, parametric calls and TOP, and a dialect that does not switch them on reads as before",
  () => {
    const ff = one("FROM t SELECT a, b WHERE a > 1", duckdb);
    assert(ff.kind === "select" && ff.items.length === 2 && ff.from.length === 1 && ff.where !== undefined);
    const ff2 = one("FROM t", duckdb);
    assert(ff2.kind === "select" && ff2.items.length === 0);
    assertEquals(parse("FROM t").errors.length > 0, true, "not in the base dialect");
    const lam = (sql: string, d: Dialect) => {
      const c = exprOf(sql, d);
      return c.kind === "call" ? c.args[1] ?? c.args[0] : undefined;
    };
    for (const [sql, d, n] of [
      ["list_transform(l, x -> x + 1)", duckdb, 1],
      ["transform(l, (x, y) -> x + y)", spark, 2],
      ["list_transform(l, lambda x: x + 1)", duckdb, 1],
    ] as const) {
      const l = lam(sql, d);
      assert(l?.kind === "lambda" && l.params.length === n, sql);
    }
    assertEquals(parse("SELECT f(a, x -> 1)").errors.length > 0, true, "not in the base dialect");
    const jp = exprOf("v:a.b[0]::int", databricks);
    assert(jp.kind === "cast" && jp.arg.kind === "operator" && jp.arg.op === ":");
    const ti = one("CREATE TABLE t (a Int, INDEX i a TYPE minmax GRANULARITY 1, b Int) ENGINE = MergeTree", clickhouse);
    assert(ti.kind === "create-table" && ti.elements.map((e) => e.kind).join() === "column-def,column-option,column-def");
    const q = one("SELECT a FROM t ORDER BY a LIMIT 5 SETTINGS max_threads = 1 FORMAT JSON", clickhouse);
    assert(q.kind === "select" && q.limit !== undefined && q.settings === "SETTINGS max_threads = 1 FORMAT JSON");
    const pc = exprOf("quantile(0.5)(x)", clickhouse);
    assert(pc.kind === "call" && pc.parameters.length === 1 && pc.args.length === 1);
    assertEquals(parse("SELECT quantile(0.5)(x)").errors.length > 0, true);
    const top = one("SELECT TOP 10 PERCENT WITH TIES a FROM t", tsql);
    assert(top.kind === "select" && top.top?.kind === "number" && top.topOptions === "PERCENT WITH TIES" && top.items.length === 1);
    const top2 = one("SELECT TOP (5) a FROM t", tsql);
    assert(top2.kind === "select" && top2.top !== undefined);
  },
);

proves(
  ["0005-sql-dialects FR-025"],
  "struct literals, types with fields, ORDER BY ALL, BY NAME, upserts of MySQL and Hive, APPLY, table operators and hints, and the arguments of calls are read",
  () => {
    const st = exprOf("{'a': 1, 'b': [1, 2]}", duckdb);
    assert(st.kind === "struct" && st.entries.length === 2 && st.prefix === undefined);
    const mp = exprOf("map{1: 'x'}", duckdb);
    assert(mp.kind === "struct" && mp.prefix === "map");
    const ty = (sql: string, d: Dialect = duckdb): string => {
      const c = exprOf(sql, d);
      assert(c.kind === "cast", sql);
      return `${c.type.name}:${c.type.fields.map((f) => `${f.name?.name ?? "-"}/${f.type.name}`).join(",")}`;
    };
    assertEquals(ty("x::STRUCT(a INT, b TEXT)"), "STRUCT:a/INT,b/TEXT");
    assertEquals(ty("CAST(x AS ARRAY<INT>)", spark), "ARRAY:-/INT");
    assertEquals(ty("CAST(x AS MAP<STRING, ARRAY<ARRAY<INT>>>)", spark), "MAP:-/STRING,-/ARRAY");
    const ct = exprOf("CAST(x, 'Array(Int8)')", clickhouse);
    assert(ct.kind === "cast" && ct.type.name === "Array(Int8)");
    const oa = one("SELECT a FROM t ORDER BY ALL DESC", duckdb);
    assert(oa.kind === "select" && oa.orderBy[0]?.expr.kind === "name" && oa.orderBy[0].direction === "desc");
    const bn = one("SELECT 1 AS a UNION ALL BY NAME SELECT 2 AS a", duckdb);
    assert(bn.kind === "set-op" && bn.byName);
    const ib = one("INSERT INTO t BY NAME SELECT 1 AS a", duckdb);
    assert(ib.kind === "insert" && ib.byName);
    const dk = one("INSERT INTO t (a) VALUES (1) ON DUPLICATE KEY UPDATE a = a + 1", mysql);
    assert(dk.kind === "insert" && dk.onConflict?.duplicateKey === true && dk.onConflict.assignments.length === 1);
    const ow = one("INSERT OVERWRITE TABLE t PARTITION (d = '1') SELECT 1", spark);
    assert(ow.kind === "insert" && ow.conflict === "OVERWRITE" && ow.partition === "PARTITION (d = '1')");
    const ap = one("SELECT * FROM x CROSS APPLY (SELECT 1 AS v) t OUTER APPLY f(x.a) u", tsql);
    assert(ap.kind === "select" && ap.from[0]?.kind === "join" && ap.from[0].type === "outer-apply" && ap.from[0].left.kind === "join" && ap.from[0].left.type === "cross-apply");
    const pv = one("SELECT * FROM (SELECT 1) PIVOT (SUM(c) FOR b IN ('x', 'y')) AS p LATERAL VIEW EXPLODE(a) t AS c", spark);
    assert(pv.kind === "select" && pv.from[0]?.kind === "table-op" && pv.from[0].op === "LATERAL VIEW" && pv.from[0].source.kind === "table-op");
    const piv = pv.from[0]?.kind === "table-op" ? pv.from[0].source : undefined;
    assert(piv?.kind === "table-op" && piv.op === "PIVOT" && piv.alias?.name.name === "p" && piv.text.startsWith("PIVOT ("));
    const tf = one("SELECT * FROM TABLE(generate_series(1, 3)) AS g", mysql);
    assert(tf.kind === "select" && tf.from[0]?.kind === "table-fn");
    const hn = one("SELECT * FROM t WITH (NOLOCK) JOIN u FORCE INDEX (i) ON TRUE", tsql);
    assert(hn.kind === "select" && hn.from[0]?.kind === "join" && hn.from[0].left.kind === "table" && hn.from[0].left.hint === "WITH (NOLOCK)");
    const tm = one("SELECT * FROM t FOR SYSTEM_TIME AS OF '2020-01-01'", tsql);
    assert(tm.kind === "select" && tm.from[0]?.kind === "table" && tm.from[0].hint?.startsWith("FOR SYSTEM_TIME") === true);
    const cs = exprOf("CAST(a AS CHAR CHARACTER SET utf8mb4)", mysql);
    assert(cs.kind === "cast" && cs.type.charset === "utf8mb4");
    const nl = exprOf("lag(x IGNORE NULLS, 1) OVER (ORDER BY y)", spark);
    assert(nl.kind === "call" && nl.args.map((a) => (a.kind === "keyword-arg" ? a.keyword : a.kind)).join() === "name,IGNORE NULLS,number");
    const al = exprOf("struct(1 AS a, 2 AS b)", spark);
    assert(al.kind === "call" && al.args.length === 4 && al.args[1]?.kind === "keyword-arg" && al.args[1].keyword === "AS");
    const iv = exprOf("INTERVAL (a + 1) DAY", mysql);
    assert(iv.kind === "interval" && iv.unit === "DAY");
    assertEquals((exprOf("INTERVAL 1 WEEK", mysql) as { unit?: string }).unit, "WEEK");
  },
);
