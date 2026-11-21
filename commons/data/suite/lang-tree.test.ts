/**
 * The syntax tree of the SQL language core (commons data 0066-sql-ast-parser): a closed union whose child fields have the types of their sorts, whose ranges nest, whose names, literals, expressions, queries,
 * sources, data changes and definitions have the nodes the specification lists, and whose script keeps a statement it could not read.
 *
 * Spec: 0066-sql-ast-parser FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ansi,
  type Expr,
  findAll,
  type Node,
  type Parsed,
  parse,
  type Select,
  type Source,
  walk,
} from "@intellectual-frontiers/data/sql/lang";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/lang/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";
import { CORPUS, firstItem, GOLDEN, GOLDEN_DIALECTS, show } from "./lang-fixture.ts";
import { sources } from "../tools/golden-lang.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ok = (sql: string, d = ansi): Parsed => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  return p;
};
const first = (p: Parsed): Node => {
  const s = p.script.statements[0];
  assert(s !== undefined);
  return s;
};
const select = (sql: string, d = ansi): Select => {
  const s = first(ok(sql, d));
  assert(s.kind === "select", `${sql}: ${s.kind}`);
  return s;
};

/** Every parsed text of the goldens and the corpus. */
function everyTree(): readonly Parsed[] {
  const out = [parse(CORPUS)];
  for (const [dir, name] of sources()) {
    const d = GOLDEN_DIALECTS[dir];
    if (d !== undefined) out.push(parse(readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"), d));
  }
  return out;
}

proves(
  ["0066-sql-ast-parser FR-001"],
  "a tree is a closed union told apart by kind, a child field has the type of its sort so that a wrong sort or a missing case does not compile, and no node holds its parent or the text",
  () => {
    const s = select("SELECT a FROM t");
    const source: Source | undefined = s.from[0];
    assert(source !== undefined && source.kind === "table");
    // @ts-expect-error a select is a Query and not an Expr: it does not fit where an expression goes
    const wrong: Expr = s;
    assertEquals(typeof wrong, "object");
    const count = (e: Expr): number => {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- a switch that leaves kinds out, to show that it does not compile
      switch (e.kind) {
        case "name":
          return 1;
        case "binary":
          return count(e.left) + count(e.right);
        default:
          // @ts-expect-error the other kinds of expression are not handled, so e is not never
          return absurd(e);
      }
    };
    assertEquals(count(firstItem(ok("SELECT a + b"))), 2);
    const kinds = new Set<string>();
    for (const p of everyTree()) {
      walk(p.script, {
        enter: (n) => {
          kinds.add(n.kind);
          assert(!("parent" in n), `${n.kind} holds its parent`);
          for (const v of Object.values(n)) assert(typeof v !== "string" || v !== p.text || p.text.length < 30, `${n.kind} holds the text`);
          assert(Number.isInteger(n.start) && Number.isInteger(n.end), n.kind);
          return undefined;
        },
      });
    }
    assert(kinds.size >= 60, `${kinds.size} kinds of node are in the trees`);
  },
);

proves(
  ["0066-sql-ast-parser FR-002"],
  "every node has a range, the ranges of children are inside their parent's, and a parenthesis at the edge of a node is inside it",
  () => {
    for (const p of everyTree()) {
      assert(p.script.start === 0 && p.script.end === p.text.length, "the script is the whole text");
      walk(p.script, {
        enter: (n, parent) => {
          assert(n.start <= n.end, `${n.kind} ends before it begins`);
          if (parent !== undefined)
            assert(
              parent.start <= n.start && n.end <= parent.end,
              `${n.kind}@${n.start}-${n.end} is outside ${parent.kind}@${parent.start}-${parent.end}`,
            );
          return undefined;
        },
      });
    }
    const p = ok("SELECT (a + b) * c, (SELECT 1), x IN (1, 2)");
    const s = first(p);
    assert(s.kind === "select");
    const slice = (n: Node): string => p.text.slice(n.start, n.end);
    const [m, sub, inn] = s.items.map((i) => i.expr);
    assert(m !== undefined && sub !== undefined && inn !== undefined);
    assertEquals(slice(m), "(a + b) * c");
    assert(m.kind === "binary");
    assertEquals(slice(m.left), "a + b");
    assertEquals(slice(sub), "(SELECT 1)");
    assertEquals(slice(inn), "x IN (1, 2)");
    assertEquals(slice(s), "SELECT (a + b) * c, (SELECT 1), x IN (1, 2)");
  },
);

proves(
  ["0066-sql-ast-parser FR-003"],
  "a name is an identifier with its quotes taken off or a qualified name, and a star keeps its qualifier",
  () => {
    const i = firstItem(ok('SELECT "a""b"'));
    assert(i.kind === "name");
    assertEquals(
      i.parts.map((p) => [p.name, p.quoted]),
      [['a"b', true]],
    );
    const q = firstItem(ok("SELECT s.t.c"));
    assert(q.kind === "name");
    assertEquals(
      q.parts.map((p) => [p.name, p.quoted]),
      [
        ["s", false],
        ["t", false],
        ["c", false],
      ],
    );
    const b = firstItem(ok("SELECT [x y], `z`", sqlite));
    assert(b.kind === "name" && b.parts[0]?.name === "x y");
    const star = firstItem(ok("SELECT t.*"));
    assert(star.kind === "star" && star.qualifier?.parts.map((p) => p.name).join(".") === "t");
    const bare = firstItem(ok("SELECT *"));
    assert(bare.kind === "star" && bare.qualifier === undefined);
    const dot = firstItem(ok("SELECT t.order"));
    assert(dot.kind === "name" && dot.parts[1]?.name === "order");
  },
);

proves(
  ["0066-sql-ast-parser FR-004"],
  "a number keeps its text, a string its value as the dialect reads it and its prefix, and booleans, null and parameters are nodes of their own",
  () => {
    const lit = (sql: string, d = ansi): Expr => firstItem(ok(`SELECT ${sql}`, d));
    const num = lit("1e5");
    assert(num.kind === "number" && num.text === "1e5");
    const hex = lit("0x1F", sqlite);
    assert(hex.kind === "number" && hex.text === "0x1F");
    const str = (e: Expr): string => {
      assert(e.kind === "string");
      return `${e.prefix}|${e.value}`;
    };
    assertEquals(str(lit("'it''s'")), "|it's");
    assertEquals(str(lit("''")), "|");
    assertEquals(str(lit("N'x'")), "N|x");
    assertEquals(str(lit("E'a\\nb\\'c'", postgres)), "E|a\nb'c");
    assertEquals(str(lit("'a\\nb'", postgres)), "|a\\nb", "a plain string has no backslash escapes in PostgreSQL");
    assertEquals(str(lit("$$ a 'b' $$", postgres)), "| a 'b' ");
    assertEquals(str(lit("$t$ $$ $t$", postgres)), "| $$ ");
    assertEquals(str(lit("X'ff'", sqlite)), "X|ff");
    const t = lit("TRUE");
    assert(t.kind === "boolean" && t.value);
    assert(lit("false").kind === "boolean");
    assert(lit("NULL").kind === "null");
    const style = (sql: string, d = ansi): string => {
      const e = lit(sql, d);
      assert(e.kind === "param");
      return `${e.style} ${e.text}`;
    };
    assertEquals(style("?"), "question ?");
    assertEquals(style("?12", sqlite), "question ?12");
    assertEquals(style(":name", sqlite), "colon-name :name");
    assertEquals(style("@v", sqlite), "at-name @v");
    assertEquals(style("$1", postgres), "dollar-number $1");
    assertEquals(style("$name", duckdb), "dollar-name $name");
  },
);

proves(["0066-sql-ast-parser FR-005"], "each kind of expression is a node of its own, with the fields the specification lists", () => {
  const e = (sql: string, d = ansi): Expr => firstItem(ok(`SELECT ${sql}`, d));
  assertEquals(show(e("a IS NOT DISTINCT FROM b")), "(a IS NOT distinct-from b)");
  const is = e("a IS UNKNOWN");
  assert(is.kind === "is" && is.test === "unknown" && !is.negated);
  const bt = e("a NOT BETWEEN 1 AND 2");
  assert(bt.kind === "between" && bt.negated);
  const inList = e("a IN (1, 2)");
  assert(inList.kind === "in" && inList.values.length === 2);
  const inQ = e("a NOT IN (SELECT 1)");
  assert(inQ.kind === "in-query" && inQ.negated && inQ.query.kind === "select");
  const like = e("a NOT LIKE 'x' ESCAPE '!'");
  assert(like.kind === "like" && like.negated && like.op === "LIKE" && like.escape?.kind === "string");
  const c = e("CASE a WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END");
  assert(c.kind === "case" && c.operand?.kind === "name" && c.whens.length === 2 && c.otherwise?.kind === "number");
  const searched = e("CASE WHEN a THEN b END");
  assert(searched.kind === "case" && searched.operand === undefined && searched.otherwise === undefined);
  const cast = e("CAST(a AS TIMESTAMP WITH TIME ZONE)");
  assert(cast.kind === "cast" && cast.type.name === "TIMESTAMP WITH TIME ZONE");
  const dec = e("CAST(a AS DECIMAL(10, 2))");
  assert(dec.kind === "cast" && dec.type.name === "DECIMAL" && dec.type.args.length === 2);
  const ex = e("EXTRACT(year FROM d)");
  assert(ex.kind === "extract" && ex.field === "YEAR");
  const iv = e("INTERVAL '1' day");
  assert(iv.kind === "interval" && iv.unit === "DAY");
  const iv2 = e("INTERVAL '1 day'");
  assert(iv2.kind === "interval" && iv2.unit === undefined);
  const call = e(
    "count(DISTINCT a) FILTER (WHERE a > 0) OVER (PARTITION BY b ORDER BY c DESC NULLS FIRST ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)",
  );
  assert(call.kind === "call" && call.distinct && call.filter?.kind === "binary" && call.over !== undefined);
  assertEquals(call.over.partitionBy.length, 1);
  assertEquals([call.over.orderBy[0]?.direction, call.over.orderBy[0]?.nulls], ["desc", "first"]);
  assertEquals([call.over.frame?.unit, call.over.frame?.from.type, call.over.frame?.to?.type], ["rows", "preceding", "current-row"]);
  const named = e("sum(x) OVER w");
  assert(named.kind === "call" && named.over?.base?.name === "w");
  const star = e("count(*)");
  assert(star.kind === "call" && star.args[0]?.kind === "star");
  const ex2 = e("EXISTS (SELECT 1)");
  assert(ex2.kind === "exists");
  const sq = e("(SELECT 1)");
  assert(sq.kind === "scalar-query");
  const row = e("(1, 2, 3)");
  assert(row.kind === "tuple" && row.items.length === 3);
  const na = e("f(a => 1, b := 2)", duckdb);
  assert(na.kind === "call" && na.args.map((a) => a.kind).join() === "named-arg,named-arg");
  const u = e("-a");
  assert(u.kind === "unary" && u.op === "-");
  const n = e("NOT a");
  assert(n.kind === "unary" && n.op === "NOT");
});

proves(
  ["0066-sql-ast-parser FR-006"],
  "queries, sources, data changes and definitions have the nodes and fields the specification lists",
  () => {
    const s = select(
      "SELECT DISTINCT a AS x, b FROM t AS u (p, q), (SELECT 1) s, LATERAL (SELECT 2) l, f(1) g WHERE a > 1 GROUP BY a HAVING count(*) > 1 ORDER BY a LIMIT 1 OFFSET 2",
    );
    assert(s.distinct && s.items.length === 2 && s.items[0]?.alias?.name === "x");
    assertEquals(
      s.from.map((f) => f.kind),
      ["table", "subquery", "subquery", "table-fn"],
    );
    const t = s.from[0];
    assert(t?.kind === "table" && t.alias?.name.name === "u" && t.alias.columns.length === 2);
    const lat = s.from[2];
    assert(lat?.kind === "subquery" && lat.lateral);
    assert(
      s.where !== undefined &&
        s.groupBy.length === 1 &&
        s.having !== undefined &&
        s.orderBy.length === 1 &&
        s.limit !== undefined &&
        s.offset !== undefined,
    );
    const j = select("SELECT 1 FROM a NATURAL LEFT OUTER JOIN b USING (x, y) CROSS JOIN c");
    const outer = j.from[0];
    assert(outer?.kind === "join" && outer.type === "cross" && outer.left.kind === "join");
    assert(outer.left.kind === "join" && outer.left.type === "left" && outer.left.natural && outer.left.using.length === 2);
    const w = first(ok("WITH RECURSIVE a (x) AS (SELECT 1), b AS (VALUES (1)) SELECT * FROM a"));
    assert(w.kind === "with" && w.recursive && w.ctes.length === 2 && w.ctes[0]?.columns.length === 1 && w.body.kind === "select");
    const v = first(ok("VALUES (1, 2), (3, 4)"));
    assert(v.kind === "values" && v.rows.length === 2);
    const so = first(ok("SELECT 1 EXCEPT DISTINCT SELECT 2"));
    assert(so.kind === "set-op" && so.op === "except" && so.quantifier === "distinct");
    const ins = first(ok("INSERT INTO s.t (a, b) VALUES (1, 2) RETURNING a"));
    assert(ins.kind === "insert" && ins.columns.length === 2 && ins.source?.kind === "values" && ins.returning.length === 1);
    const def = first(ok("INSERT INTO t DEFAULT VALUES"));
    assert(def.kind === "insert" && def.source === undefined);
    const up = first(ok("UPDATE t AS x SET a = 1, b = 2 FROM u WHERE x.id = u.id RETURNING *"));
    assert(
      up.kind === "update" &&
        up.assignments.length === 2 &&
        up.from.length === 1 &&
        up.where !== undefined &&
        up.table.alias?.name.name === "x",
    );
    const del = first(ok("DELETE FROM t WHERE a = 1"));
    assert(del.kind === "delete" && del.where !== undefined);
    const ct = first(
      ok(
        "CREATE TABLE IF NOT EXISTS t (a INT PRIMARY KEY, b TEXT NOT NULL DEFAULT 'x' UNIQUE, c INT REFERENCES u (id) ON DELETE CASCADE, CHECK (a > 0), FOREIGN KEY (c) REFERENCES u)",
      ),
    );
    assert(
      ct.kind === "create-table" &&
        ct.ifNotExists &&
        ct.elements.map((x) => x.kind).join() === "column-def,column-def,column-def,check,foreign-key",
    );
    const colB = ct.elements[1];
    assert(colB?.kind === "column-def" && colB.constraints.map((c) => c.kind).join() === "not-null,default,unique");
    const idx = first(ok("CREATE UNIQUE INDEX IF NOT EXISTS i ON t (a DESC, lower(b)) WHERE a > 0"));
    assert(idx.kind === "create-index" && idx.unique && idx.ifNotExists && idx.items.length === 2 && idx.where !== undefined);
    const view = first(ok("CREATE OR REPLACE VIEW v (a) AS SELECT 1"));
    assert(view.kind === "create-view" && view.orReplace && view.columns.length === 1);
    const alt = first(
      ok(
        "ALTER TABLE t ADD COLUMN c INT, DROP COLUMN d, ADD CONSTRAINT k UNIQUE (c), DROP CONSTRAINT k, RENAME COLUMN a TO b, RENAME TO u",
      ),
    );
    assert(alt.kind === "alter-table");
    assertEquals(
      alt.actions.map((a) => a.kind),
      ["add-column", "drop-column", "add-constraint", "drop-constraint", "rename-column", "rename-table"],
    );
    const drop = first(ok("DROP TABLE IF EXISTS a, b CASCADE"));
    assert(drop.kind === "drop" && drop.object === "table" && drop.ifExists && drop.names.length === 2 && drop.behavior === "cascade");
    assertEquals(
      findAll(parse("SELECT 1 FROM a JOIN b ON TRUE").script, "table").map((x) => x.name.parts[0]?.name),
      ["a", "b"],
    );
  },
);

proves(
  ["0066-sql-ast-parser FR-007"],
  "a script is a node of its statements and a statement the parser could not read is an unparsed node of its range",
  () => {
    const p = parse("SELECT 1;; SELECT 2 ;\nSELECT FROM; DROP TABLE t");
    assertEquals(
      p.script.statements.map((s) => s.kind),
      ["select", "select", "unparsed", "drop"],
    );
    const bad = p.script.statements[2];
    assert(bad !== undefined);
    assertEquals(p.text.slice(bad.start, bad.end), "SELECT FROM");
    assertEquals(parse("").script.statements, []);
    assertEquals(parse(" ; ; ").script.statements, []);
    assertEquals(parse("-- only a comment").script.statements, []);
  },
);
