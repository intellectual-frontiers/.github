/**
 * Introspection (commons lang-sql 0008-sql-introspect FR-001 to FR-008): the relations of a parse, the small SQL that answers over them, the diagnostics that are rules written in that SQL, and the fingerprint of a statement.
 *
 * Spec: 0008-sql-introspect FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, createRegistry } from "@intellectual-frontiers/lang-sql";
import { introspect, type Value } from "@intellectual-frontiers/lang-sql/extensions/introspect";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";

const rows = (sql: string, text: string, params: readonly Value[] = []): readonly (readonly Value[])[] => {
  const r = introspect(text, postgres).query(sql, params);
  assert(r.kind === "ok", `${sql}: ${r.kind === "err" ? r.error.message : ""}`);
  return r.value.rows;
};

const SCRIPT = "DELETE FROM t;\nSELECT * FROM u JOIN v;\nWITH x AS (SELECT 1) SELECT a FROM t WHERE b = 1 -- note\n;SELEC";

proves(["0008-sql-introspect FR-001"], "introspect gives an introspection for any text without throwing, and a query gives rows or an error value in one sentence", () => {
  for (const text of ["", "\0", "SELECT", "((((", "'unclosed", "SELECT 1; SELECT 2;; ;", SCRIPT]) {
    const i = introspect(text, postgres);
    assert(i.query("SELECT count(*) FROM node").kind === "ok");
    assert(i.diagnostics().length >= 0);
  }
  const i = introspect("SELECT 1", ansi);
  const bad = i.query("SELEC");
  assert(bad.kind === "err" && bad.error.message.startsWith("the query does not read"));
  const two = i.query("SELECT 1; SELECT 2");
  assert(two.kind === "err" && two.error.message === "a query is one statement");
  const dml = i.query("DELETE FROM node");
  assert(dml.kind === "err" && dml.error.message === "only a query can be asked");
  const none = introspect("", postgres).query("SELECT id FROM node");
  assert(none.kind === "ok" && none.value.rows.length === 0);
});

proves(["0008-sql-introspect FR-002"], "the relations give the statements, the nodes in the order of the text with their fields, attributes, ancestors, tokens, comments, names, calls, parameters, common table expressions and diagnostics", () => {
  const s = rows("SELECT kind, read_only FROM statement ORDER BY id", SCRIPT);
  assertEquals(s, [["delete", false], ["select", true], ["with", true], ["unparsed", false]]);
  const ref = rows("SELECT name, access FROM table_ref ORDER BY node", SCRIPT);
  assertEquals(ref, [["t", "write"], ["u", "read"], ["v", "read"], ["t", "read"]]);
  const ddl = rows("SELECT name, access FROM table_ref", "CREATE TABLE a (x int); CREATE INDEX i ON a (x); ALTER TABLE a ADD COLUMN y int; DROP TABLE a; INSERT INTO b VALUES (1); UPDATE c SET x = 1");
  assertEquals(ddl.map((r) => `${r[1]}:${r[0]}`).sort(), ["alter:a", "alter:a", "create:a", "drop:a", "write:b", "write:c"]);
  const n = rows("SELECT parent, field, depth FROM node WHERE kind = 'delete'", SCRIPT);
  assertEquals(n, [[0, "statements", 0]]);
  const w = rows("SELECT c.kind, c.field FROM node c JOIN node p ON p.id = c.parent WHERE p.kind = 'update' ORDER BY c.start", "UPDATE t SET a = 1 WHERE b = 2");
  assertEquals(w.map((r) => r[1]), ["table", "assignments", "where"]);
  const order = rows("SELECT id FROM node ORDER BY start, depth", "SELECT a, b FROM t");
  assert(order.length > 5);
  assertEquals(rows("SELECT op FROM (SELECT a.value AS op FROM attr a WHERE a.name = 'op')", "SELECT 1 + 2 = 3"), [["="], ["+"]]);
  assertEquals(rows("SELECT distance FROM ancestor WHERE node = 3 ORDER BY distance", "SELECT 1"), [[1], [2]]);
  assertEquals(rows("SELECT kind, text FROM token WHERE kind <> 'eof' ORDER BY id LIMIT 2", "SELECT 1"), [["word", "SELECT"], ["number", "1"]]);
  const c = rows("SELECT style, text, placement FROM comment", "SELECT 1 -- hi\nFROM t");
  assertEquals(c.length, 1);
  assertEquals(c[0]?.[0], "line");
  assertEquals(rows("SELECT name, qualifier FROM column_ref ORDER BY node", "SELECT t.a, b FROM t"), [["a", "t"], ["b", null]]);
  assertEquals(rows("SELECT name, argc, is_distinct FROM function_call", "SELECT count(DISTINCT a), f(1, 2) FROM t"), [["count", 1, true], ["f", 2, false]]);
  assertEquals(rows("SELECT style FROM param", "SELECT $1, $2"), [["dollar-number"], ["dollar-number"]]);
  assertEquals(rows("SELECT name, uses FROM cte", "WITH a AS (SELECT 1), b AS (SELECT 2) SELECT * FROM a"), [["a", 1], ["b", 0]]);
  assertEquals(rows("SELECT code, rule FROM diagnostic WHERE rule = 'parse'", "SELEC 1"), [["parse", "parse"]]);
});

proves(["0008-sql-introspect FR-003"], "the keywords and operators of the dialect and the functions of the registry are relations, and none where none is given", () => {
  const i = introspect("SELECT 1", postgres, { functions: createRegistry().functionsOf("ansi") });
  const k = i.query("SELECT word FROM keyword WHERE word = 'ILIKE'");
  assert(k.kind === "ok" && k.value.rows.length === 1);
  const o = i.query("SELECT text FROM operator WHERE text = '::'");
  assert(o.kind === "ok" && o.value.rows.length === 1);
  const f = i.query("SELECT aggregate, min_args FROM function WHERE name = 'count'");
  assert(f.kind === "ok" && f.value.rows[0]?.[0] === true);
  const none = introspect("SELECT 1", postgres).query("SELECT count(*) FROM function");
  assert(none.kind === "ok" && none.value.rows[0]?.[0] === 0);
});

proves(["0008-sql-introspect FR-004"], "a relation is built only when a query names it, and tables() says every relation and its columns", () => {
  const i = introspect(SCRIPT, postgres);
  assertEquals(i.built(), []);
  i.query("SELECT kind FROM statement");
  assertEquals(i.built(), ["statement"]);
  i.query("SELECT count(*) FROM statement s JOIN node n ON n.stmt = s.id");
  assertEquals(i.built(), ["statement", "node"]);
  const t = i.tables();
  assertEquals(Object.keys(t).length, 15);
  assertEquals(t["node"], ["id", "parent", "stmt", "kind", "field", "ordinal", "depth", "start", "stop"]);
});

proves(["0008-sql-introspect FR-005"], "the query language has the clauses, operators, functions, subqueries, parameters and the logic of SQL that the specification lists", () => {
  const q = (sql: string, params: readonly Value[] = []) => rows(sql, "SELECT 1", params);
  assertEquals(q("SELECT 1 + 2 * 3, 7 % 4, 'a' || 'b', -(2)"), [[7, 3, "ab", -2]]);
  assertEquals(q("SELECT NULL = 1, NULL IS NULL, 1 IS NOT NULL, NULL AND false, NULL OR true, NULL AND true, NOT NULL"), [[null, true, true, false, true, null, null]]);
  assertEquals(q("SELECT 2 BETWEEN 1 AND 3, 5 NOT BETWEEN 1 AND 3, 2 IN (1, 2), 2 NOT IN (1, NULL), 'abc' LIKE 'a%', 'abc' LIKE 'a_c', 'a%' LIKE 'a!%' ESCAPE '!'"), [[true, true, true, null, true, true, true]]);
  assertEquals(q("SELECT CASE WHEN 1 > 2 THEN 'x' WHEN 2 > 1 THEN 'y' ELSE 'z' END, CASE 3 WHEN 3 THEN 'three' END, CAST('12' AS INTEGER), CAST(5 AS TEXT)"), [["y", "three", 12, "5"]]);
  assertEquals(q("SELECT lower('AB'), upper('ab'), length('abc'), substr('abcdef', 2, 3), coalesce(NULL, 4), nullif(1, 1), abs(-3), instr('abc', 'c'), replace('aXb', 'X', '-'), typeof(1), typeof('a'), typeof(NULL)"), [["ab", "AB", 3, "bcd", 4, null, 3, 3, "a-b", "integer", "text", "null"]]);
  assertEquals(q("SELECT ?, ?, $1", [1, "b"]), [[1, "b", 1]]);
  assertEquals(q("SELECT EXISTS (SELECT 1), (SELECT 5), 3 IN (SELECT 3)"), [[true, 5, true]]);
  const t = "SELECT a FROM t1 JOIN t2 ON t1.a = t2.a";
  assertEquals(rows("SELECT n.kind, count(*) c FROM node n GROUP BY n.kind HAVING count(*) > 1 ORDER BY c DESC, n.kind LIMIT 2 OFFSET 1", t).length, 2);
  assertEquals(rows("SELECT DISTINCT kind FROM node WHERE kind IN ('table', 'select') ORDER BY 1", t), [["select"], ["table"]]);
  assertEquals(rows("SELECT x.k FROM (SELECT kind AS k FROM node WHERE kind = 'join') x", t), [["join"]]);
  assertEquals(rows("WITH j AS (SELECT id FROM node WHERE kind = 'join') SELECT count(*) FROM j", t), [[1]]);
  assertEquals(rows("SELECT p.kind, c.kind FROM node p LEFT JOIN node c ON c.parent = p.id AND c.kind = 'on' WHERE p.kind = 'select'", t), [["select", null]]);
  assertEquals(rows("SELECT count(*), min(start), max(stop), sum(1), avg(2), group_concat(kind, '+') FROM node WHERE kind = 'join'", t)[0]?.slice(0, 2), [1, 14]);
  const cross = rows("SELECT count(*) FROM node a, node b WHERE a.kind = 'join' AND b.kind = 'join'", t);
  assertEquals(cross, [[1]]);
  const corr = rows("SELECT n.id FROM node n WHERE n.kind = 'select' AND EXISTS (SELECT 1 FROM node c WHERE c.parent = n.id AND c.field = 'from')", t);
  assertEquals(corr.length, 1);
});

proves(["0008-sql-introspect FR-006"], "what astsql does not have is an error value that names it", () => {
  const i = introspect("SELECT 1", postgres);
  for (const [sql, part] of [
    ["SELECT 1 UNION SELECT 2", "set operations"],
    ["VALUES (1)", "VALUES"],
    ["WITH RECURSIVE r AS (SELECT 1) SELECT * FROM r", "recursive"],
    ["SELECT row_number() OVER () FROM node", "row_number"],
    ["SELECT * FROM nowhere", "no relation nowhere"],
    ["SELECT nope()", "nope"],
    ["SELECT nocolumn FROM node", "no column nocolumn"],
    ["SELECT id FROM node a JOIN node b ON TRUE", "ambiguous"],
    ["SELECT count(*) FROM node WHERE count(*) > 1", "aggregate"],
    ["SELECT 1 FROM node FULL JOIN node b ON TRUE", "full join"],
    ["SELECT ?", "no value"],
  ] as const) {
    const r = i.query(sql);
    assert(r.kind === "err" && r.error.message.includes(part), `${sql}: ${JSON.stringify(r)}`);
  }
});

proves(["0008-sql-introspect FR-007"], "the diagnostics are the errors of the parse and the rows of the rules, and a rule is a query that a consumer can add", () => {
  const i = introspect(SCRIPT, postgres);
  const d = i.diagnostics();
  assertEquals(d.map((x) => x.code), ["delete-without-where", "select-star", "join-without-condition", "unused-cte", "parse"]);
  assertEquals(d[0]?.severity, "warning");
  assertEquals(d[4]?.severity, "error");
  const upd = introspect("UPDATE t SET a = 1", postgres).diagnostics();
  assertEquals(upd.map((x) => x.code), ["update-without-where"]);
  assertEquals(introspect("SELECT count(*) FROM t", postgres).diagnostics(), []);
  const nest = introspect("SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT 1) a) b) c) d", postgres).diagnostics();
  assert(nest.some((x) => x.code === "deep-nesting"));
  const joins = introspect(`SELECT 1 FROM ${Array.from({ length: 9 }, (_, k) => `t${k}`).join(" JOIN ")}`, postgres).diagnostics();
  assert(joins.some((x) => x.code === "too-many-joins"));
  const j = introspect("SELECT 1 FROM a CROSS JOIN b JOIN c ON TRUE", postgres).diagnostics();
  assertEquals(j.map((x) => x.code), []);
  const added = introspect("SELECT a FROM t WHERE a = 1", postgres);
  const ok = added.addRule({ code: "equality", severity: "info", message: "an equality", sql: "SELECT id AS node FROM node WHERE kind = 'binary'" });
  assert(ok.kind === "ok");
  assertEquals(added.diagnostics().map((x) => x.code), ["equality"]);
  const viaSql = added.query("SELECT code, message FROM diagnostic");
  assert(viaSql.kind === "ok" && viaSql.value.rows[0]?.[0] === "equality");
  const a = added.addRule({ code: "bad", severity: "info", message: "m", sql: "SELECT nope FROM node" });
  assert(a.kind === "err" && a.error.message.includes("does not run"));
  const b = added.addRule({ code: "nonode", severity: "info", message: "m", sql: "SELECT id FROM node" });
  assert(b.kind === "err" && b.error.message.includes("no column named node"));
  const c = added.addRule({ code: " ", severity: "info", message: "m", sql: "SELECT id AS node FROM node" });
  assert(c.kind === "err");
});

proves(["0008-sql-introspect FR-008"], "the fingerprint is the same for statements that differ in their literals and layout and different for another shape, and only a query is read only", () => {
  const fp = (text: string): Value => rows("SELECT fingerprint FROM statement", text)[0]?.[0] ?? null;
  assertEquals(fp("SELECT a FROM t WHERE b = 1"), fp("select a  from t\n where b = 22 -- c"));
  assertEquals(fp("SELECT a FROM t WHERE b = 'x'"), fp("SELECT a FROM t WHERE b = $1"));
  assert(fp("SELECT a FROM t WHERE b = 1") !== fp("SELECT a FROM t WHERE c = 1"));
  assert(fp("SELECT a FROM t WHERE b = 1") !== fp("SELECT a FROM t WHERE b > 1"));
  assert(fp("SELECT a FROM t") !== fp("SELECT a FROM t ORDER BY a"));
  const ro = rows("SELECT kind, read_only FROM statement ORDER BY id", "SELECT 1; INSERT INTO t VALUES (1); WITH a AS (SELECT 1) SELECT * FROM a; SELECT 1 UNION SELECT 2; VALUES (1); CREATE TABLE x (a int)");
  assertEquals(ro.map((r) => r[1]), [true, false, true, true, true, false]);
  assertEquals(rows("SELECT text_of(id) FROM node WHERE kind = 'number'", "SELECT 41 + 1"), [["41"], ["1"]]);
  assertEquals(rows("SELECT line_of(start) FROM node WHERE kind = 'table'", "SELECT 1\nFROM\n  t"), [[3]]);
});
