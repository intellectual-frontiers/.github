/**
 * Queries over a syntax tree (commons lang-sql 0003-sql-ast-tools): the table of parents, lazy typed selections, the uses of tables with the scope of common table expressions, the calls of functions, and the reason
 * a script is not read-only.
 *
 * Spec: 0003-sql-ast-tools FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parse, type TableRef, walk } from "@intellectual-frontiers/lang-sql";
import {
  ancestors,
  functionsCalled,
  parentIndex,
  parentOf,
  readOnlyProblem,
  select,
  tableUses,
} from "@intellectual-frontiers/lang-sql/extensions/query";
import { CORPUS } from "./fixture.ts";

const uses = (sql: string): readonly string[] => {
  const p = parse(sql);
  assertEquals(p.errors, [], sql);
  return tableUses(p.script).map((u) => `${u.access} ${u.name.join(".")}`);
};

proves(
  ["0003-sql-ast-tools FR-005"],
  "the table of parents gives each node's parent once, the root has none, and ancestors come nearest first",
  () => {
    const p = parse(CORPUS);
    const index = parentIndex(p.script);
    let nodes = 0;
    walk(p.script, {
      enter: (n, parent) => {
        nodes++;
        assert(parentOf(index, n) === parent, `${n.kind}: its parent is not the one the walk found`);
        return undefined;
      },
    });
    assertEquals(index.size, nodes - 1);
    assertEquals(parentOf(index, p.script), undefined);
    const q = parse("SELECT a + 1 FROM t");
    const idx = parentIndex(q.script);
    const num = select(q.script).find("number").first();
    assert(num !== undefined);
    assertEquals(
      [...ancestors(idx, num)].map((n) => n.kind),
      ["binary", "select-item", "select", "script"],
    );
  },
);

proves(
  ["0003-sql-ast-tools FR-006"],
  "a selection is lazy and can be read again, its methods are typed by the kind asked for, and its nodes come in the order of the text",
  () => {
    const p = parse("WITH c AS (SELECT x FROM a) SELECT y, z FROM c JOIN b ON c.id = b.id WHERE y IN (SELECT w FROM d)");
    let calls = 0;
    const lazy = select(p.script)
      .find("table")
      .where((t) => (calls++, t.alias === undefined));
    assertEquals(calls, 0, "nothing is read until asked");
    const first = lazy.toArray();
    assertEquals(calls, 4);
    assertEquals(lazy.toArray().length, first.length, "it can be read again");
    const tables = select(p.script).find("table");
    const named: TableRef | undefined = tables.first();
    assert(named !== undefined && named.name.parts[0]?.name === "a");
    assertEquals(
      tables
        .map((t) => t.name)
        .toArray()
        .map((n) => n.parts[0]?.name),
      ["a", "c", "b", "d"],
      "in the order of the text",
    );
    const starts = tables.toArray().map((t) => t.start);
    assertEquals(
      starts,
      [...starts].sort((x, y) => x - y),
    );
    assertEquals(tables.count(), 4);
    assert(tables.some((t) => t.name.parts[0]?.name === "d") && !tables.every((t) => t.name.parts[0]?.name === "a"));
    const guard = select(p.script)
      .descendants()
      .where((n): n is TableRef => n.kind === "table");
    const g: TableRef | undefined = guard.first();
    assert(g !== undefined);
    assertEquals(
      select(p.script)
        .children()
        .toArray()
        .map((n) => n.kind),
      ["with"],
    );
    assertEquals(select(p.script).ofKind("script").count(), 1);
    assertEquals(select(p.script).ofKind("select").count(), 0, "ofKind keeps only what is of the kind among the nodes it has");
    const inner = select(p.script).find("in-query").find("table").toArray();
    assertEquals(inner.length, 1);
    assertEquals(select(p.script).find("in-query").find("table").closest("select").count(), 1);
    assertEquals(
      select(p.script)
        .find("in-query")
        .find("table")
        .parent()
        .toArray()
        .map((n) => n.kind),
      ["select"],
    );
    assertEquals(select(p.script).find("in-query").find("table").ancestors().first()?.kind, "select", "ancestors come nearest first");
    assertEquals(
      select(p.script)
        .find("in-query")
        .find("table")
        .ancestors()
        .toArray()
        .map((n) => n.kind)
        .slice(-2),
      ["with", "script"],
    );
    const withs = select(p.script).find("table").closest("with").toArray();
    assertEquals(withs.length, 4, "every table is inside the WITH node, which holds the body too");
    assertEquals(select(p.script).find("table").closest("cte").count(), 1, "only a is inside a common table expression");
    assertEquals(
      select(p.script)
        .find("name")
        .flatMap((n) => n.parts)
        .unique()
        .count(),
      select(p.script)
        .find("name")
        .flatMap((n) => n.parts)
        .count(),
    );
  },
);

proves(
  ["0003-sql-ast-tools FR-007"],
  "each use of a table is given by name and access, in the order of the text, and a name of a common table expression in scope is not a table",
  () => {
    assertEquals(uses("SELECT * FROM a JOIN s.b ON TRUE, (SELECT 1 FROM c) x WHERE y IN (SELECT z FROM d)"), [
      "read a",
      "read s.b",
      "read c",
      "read d",
    ]);
    assertEquals(uses("INSERT INTO t (a) SELECT a FROM u"), ["write t", "read u"]);
    assertEquals(uses("UPDATE t SET a = 1 FROM u WHERE t.id = u.id"), ["write t", "read u"]);
    assertEquals(uses("DELETE FROM t WHERE a IN (SELECT a FROM u)"), ["write t", "read u"]);
    assertEquals(uses("CREATE TABLE s.t (a INT REFERENCES o (id))"), ["create s.t"]);
    assertEquals(uses("CREATE VIEW v AS SELECT * FROM a"), ["create v", "read a"]);
    assertEquals(uses("CREATE UNIQUE INDEX i ON t (a)"), ["alter t"]);
    assertEquals(uses("ALTER TABLE t ADD COLUMN c INT"), ["alter t"]);
    assertEquals(uses("DROP TABLE a, s.b"), ["drop a", "drop s.b"]);
    assertEquals(uses("SELECT * FROM generate_series(1, 3) g"), [], "a function is not a table");
    // common table expressions
    assertEquals(uses("WITH a AS (SELECT 1) SELECT * FROM a JOIN t ON TRUE"), ["read t"]);
    assertEquals(
      uses("WITH a AS (SELECT * FROM a) SELECT * FROM a"),
      ["read a"],
      "not recursive: the a inside is a table, the a in the body is not",
    );
    assertEquals(uses("WITH RECURSIVE a AS (SELECT * FROM a) SELECT * FROM a"), [], "recursive: both are the common table expression");
    assertEquals(uses("WITH a AS (SELECT 1), b AS (SELECT * FROM a) SELECT * FROM b"), [], "a is in scope in the ones after it");
    assertEquals(
      uses("WITH b AS (SELECT * FROM a), a AS (SELECT 1) SELECT * FROM b, a"),
      ["read a"],
      "a is not in scope in the ones before it unless recursive",
    );
    assertEquals(uses("WITH RECURSIVE b AS (SELECT * FROM a), a AS (SELECT 1) SELECT * FROM b"), [], "recursive: all are in scope");
    assertEquals(uses("WITH A AS (SELECT 1) SELECT * FROM a"), [], "unquoted names are compared without regard to case");
    assertEquals(uses('WITH "A" AS (SELECT 1) SELECT * FROM a'), ["read a"], "a quoted name as written");
    assertEquals(uses("WITH a AS (SELECT 1) SELECT * FROM s.a"), ["read s.a"], "a qualified name is a table");
    assertEquals(uses("WITH a AS (SELECT 1) SELECT * FROM (SELECT * FROM a) q"), [], "inside a subquery of the body");
    assertEquals(uses("SELECT * FROM t WHERE x IN (WITH a AS (SELECT 1) SELECT * FROM a)"), ["read t"]);
    const p = parse("SELECT * FROM a; DELETE FROM b");
    const u = tableUses(p.script);
    assertEquals(
      u.map((x) => x.node.kind),
      ["table", "delete"],
    );
    assert(
      u.every((x, i) => i === 0 || (u[i - 1]?.node.start ?? 0) <= x.node.start),
      "in the order of the text",
    );
  },
);

proves(
  ["0003-sql-ast-tools FR-008"],
  "every call is given with its name and node, and a script that is not one query says why it is not read-only",
  () => {
    const calls = functionsCalled(parse("SELECT count(*), s.f(a, g(b)) FROM t WHERE lower(x) = 'y'").script);
    assertEquals(
      calls.map((c) => c.name.join(".")),
      ["count", "s.f", "g", "lower"],
    );
    assert(calls.every((c) => c.node.kind === "call"));
    const why = (sql: string): string | undefined => readOnlyProblem(parse(sql).script);
    assertEquals(why("SELECT 1"), undefined);
    assertEquals(why("WITH a AS (SELECT 1) SELECT * FROM a"), undefined);
    assertEquals(why("SELECT 1 UNION SELECT 2"), undefined);
    assertEquals(why("VALUES (1)"), undefined);
    assertEquals(why("SELECT 1; SELECT 2"), "it holds more than one statement");
    assertEquals(why(""), "it holds no statement");
    assertEquals(why("SELECT FROM"), "it holds a statement that could not be read");
    assertEquals(why("INSERT INTO t VALUES (1)"), "it holds an INSERT");
    assertEquals(why("DELETE FROM t"), "it holds a DELETE");
    assertEquals(why("UPDATE t SET a = 1"), "it holds an UPDATE");
    assertEquals(why("CREATE TABLE t (a INT)"), "it holds a CREATE TABLE");
    assertEquals(why("DROP TABLE t"), "it holds a DROP");
    assertEquals(why("ALTER TABLE t DROP COLUMN a"), "it holds an ALTER TABLE");
  },
);
