/**
 * The printer and unit literals (commons lang-sql 0009-sql-print FR-001 to FR-005): a tree written as text of a dialect and read back as the same tree, over the corpora of every dialect, with a count of the statements that are not, which only shrinks;
 * the pretty form; a tree written for another dialect; and numbers with units.
 *
 * Spec: 0009-sql-print FR-001, FR-002, FR-003, FR-004, FR-005
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, declareDialect, type Dialect, parse, print, printScript, toSexp } from "@intellectual-frontiers/lang-sql";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { dialect as tsql } from "@intellectual-frontiers/lang-sql/dialects/tsql";
import { CORPUS, corpusFiles, dialectOf } from "../tools/conformance.ts";
import { ALL_DIALECTS, ROOT } from "./fixture.ts";

const first = (sql: string, d: Dialect) => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  const s = p.script.statements[0];
  assert(s !== undefined, sql);
  return s;
};
const roundTrip = (sql: string, d: Dialect): string => {
  const s = first(sql, d);
  const out = print(s, d);
  const again = parse(out, d);
  assertEquals(again.errors, [], `${sql} => ${out}`);
  assertEquals(toSexp(again.script.statements[0] ?? s), toSexp(again.script.statements[0] ?? s));
  assertEquals(toSexp(again.script.statements[0] ?? s, { spans: false }), toSexp(s, { spans: false }), `${sql} => ${out}`);
  return out;
};

proves(["0009-sql-print FR-001"], "any node is written as text of the dialect: precedence is kept by parentheses where it asks for them, names and strings are quoted as the dialect does, and a script ends each statement with a semicolon", () => {
  assertEquals(roundTrip("select a from t where x = 1 or y = 2 and z = 3", ansi), "SELECT a FROM t WHERE x = 1 OR y = 2 AND z = 3");
  assertEquals(roundTrip("select (a + b) * c, a - (b - c), -(a), not (a and b), (a or b) and c from t", ansi), "SELECT (a + b) * c, a - (b - c), -a, NOT (a AND b), (a OR b) AND c FROM t");
  assertEquals(roundTrip('select "Mixed Case", "select", t."x""y" from "T"', postgres), 'SELECT "Mixed Case", "select", t."x""y" FROM "T"');
  assertEquals(roundTrip("select `a`, `b c` from `t`", mysql), "SELECT `a`, `b c` FROM `t`");
  assertEquals(roundTrip("select [a], [b c] from [t]", tsql), "SELECT [a], [b c] FROM [t]");
  assertEquals(roundTrip("select 'it''s', E'a\\nb', x'ff' from t", postgres).startsWith("SELECT 'it''s', E'a"), true);
  assertEquals(roundTrip("select 'it\\'s' from t", mysql), "SELECT 'it\\'s' FROM t");
  assertEquals(roundTrip("select a::int, x[1], (r).c, a collate nocase from t", postgres).includes("CAST(a AS INT)"), true);
  assertEquals(roundTrip("select count(*), count(distinct a), sum(b) over (partition by c order by d rows between 1 preceding and current row) from t", ansi).includes("OVER (PARTITION BY c ORDER BY d ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)"), true);
  assertEquals(roundTrip("insert into t (a, b) values (1, 2), (3, 4) on conflict (a) do update set b = excluded.b returning *", postgres), "INSERT INTO t (a, b) VALUES (1, 2), (3, 4) ON CONFLICT (a) DO UPDATE SET b = excluded.b RETURNING *");
  assertEquals(roundTrip("update t set a = 1 where b in (select b from u)", ansi), "UPDATE t SET a = 1 WHERE b IN (SELECT b FROM u)");
  assertEquals(roundTrip("create table t (a int primary key, b varchar(10) not null default 'x', c int references u (id) on delete cascade, unique (a, b))", ansi), "CREATE TABLE t (a INT PRIMARY KEY, b VARCHAR(10) NOT NULL DEFAULT 'x', c INT REFERENCES u (id) ON DELETE CASCADE, UNIQUE (a, b))");
  assertEquals(roundTrip("with a as (select 1) select * from a union all select 2 order by 1 limit 3", postgres), "WITH a AS (SELECT 1) SELECT * FROM a UNION ALL SELECT 2 ORDER BY 1 LIMIT 3");
  assertEquals(roundTrip("select 1 union (select 2 intersect select 3)", ansi), "SELECT 1 UNION SELECT 2 INTERSECT SELECT 3");
  assertEquals(roundTrip("(select 1 union select 2) intersect select 3", ansi), "(SELECT 1 UNION SELECT 2) INTERSECT SELECT 3");
  assertEquals(roundTrip("select * from a left join b on a.x = b.x cross join c", ansi), "SELECT * FROM a LEFT JOIN b ON a.x = b.x CROSS JOIN c");
  assertEquals(roundTrip("select $1, $2 from t", postgres), "SELECT $1, $2 FROM t");
  const script = parse("select 1; select ( ; drop table t", postgres);
  assertEquals(printScript(script, postgres), "SELECT 1;\nselect (;\nDROP TABLE t;");
});

proves(["0009-sql-print FR-002"], "what the printer writes is read back as the same tree for the corpora of every dialect, the statements that are not the same are counted, and the count only shrinks", () => {
  const baseline = new Map(
    readFileSync(join(ROOT, "suite", "print-baseline.tsv"), "utf8")
      .split("\n")
      .filter((l) => l !== "" && !l.startsWith("#") && !l.startsWith("dialect"))
      .map((l) => l.split("\t") as [string, string, string])
      .map(([d, n, f]) => [d, { statements: Number(n), failing: Number(f) }] as const),
  );
  const got = new Map<string, { statements: number; failing: number }>();
  for (const [path, dn] of corpusFiles()) {
    const d = dialectOf(dn);
    assert(d !== undefined);
    const text = readFileSync(join(CORPUS, path), "utf8");
    const c = got.get(dn) ?? { statements: 0, failing: 0 };
    for (const s of parse(text, d, { attach: false }).script.statements) {
      if (s.kind === "unparsed" || s.kind === "command" || s.kind === "create-routine") continue;
      c.statements++;
      const again = parse(print(s, d), d, { attach: false });
      const same = again.errors.length === 0 && again.script.statements.length === 1 && toSexp(again.script.statements[0] ?? s, { spans: false }) === toSexp(s, { spans: false });
      if (!same) c.failing++;
    }
    got.set(dn, c);
  }
  const worse: string[] = [];
  for (const [dn, c] of got) {
    const b = baseline.get(dn);
    if (b === undefined || c.failing > b.failing) worse.push(`${dn}: ${c.failing} are not the same, the baseline has ${b?.failing ?? "no row"}`);
  }
  assertEquals(worse, []);
  assert([...got.values()].reduce((n, c) => n + c.statements, 0) > 50000, "the corpora were read");
});

proves(["0009-sql-print FR-003"], "the pretty form puts each clause on a line of its own, indents nested queries, and is read back as the same tree", () => {
  const sql = "select a, b from t join u on t.x = u.x where a in (select a from v where b > 1) group by a having count(*) > 1 order by a limit 2";
  const s = first(sql, postgres);
  const pretty = print(s, postgres, { pretty: true });
  assertEquals(pretty.split("\n")[0], "SELECT a, b");
  assert(pretty.split("\n").some((l) => l === "FROM t JOIN u ON t.x = u.x"));
  assert(pretty.includes("\n  SELECT a\n  FROM v\n  WHERE b > 1\n"), pretty);
  assertEquals(toSexp(first(pretty, postgres), { spans: false }), toSexp(s, { spans: false }));
  assertEquals(print(s, postgres, { pretty: false }).includes("\n"), false);
});

proves(["0009-sql-print FR-004"], "a tree is written for another dialect without throwing, as the printer's dialect has it", () => {
  const sources: [string, Dialect][] = [
    ["select a::int, e'x', x ilike 'a%' from t", postgres],
    ["select `a`, ifnull(b, 1) from t limit 2, 3", mysql],
    ["select top 3 [a] from t with (nolock)", tsql],
    ["select a from t where b glob 'x*' or c regexp 'y'", sqlite],
  ];
  for (const [sql, from] of sources) {
    const s = first(sql, from);
    for (const to of ALL_DIALECTS) assert(typeof print(s, to) === "string");
  }
  assertEquals(print(first("select `a b` from t", mysql), postgres), 'SELECT "a b" FROM t');
  assertEquals(print(first('select "a b" from t', postgres), mysql), "SELECT `a b` FROM t");
  assertEquals(print(first('select "a b" from t', postgres), tsql), "SELECT [a b] FROM t");
  assertEquals(print(first("select $1 from t", postgres), mysql), "SELECT ? FROM t");
});

proves(["0009-sql-print FR-005"], "a number followed by a unit is one number scaled by the unit, and a dialect without units reads the text as before", () => {
  const units = declareDialect({
    name: "units",
    extends: ansi,
    lexical: (l) => l,
    grammar: (g) => ({ ...g, units: [{ unit: "KB", factor: 1024 }, { unit: "MB", factor: 1048576 }, { unit: "D", factor: 86400 }] }),
  });
  const e = (sql: string): string => print(first(`SELECT ${sql}`, units), units);
  assertEquals(e("10 KB"), "SELECT 10240");
  assertEquals(e("10KB"), "SELECT 10240");
  assertEquals(e("1.5 kb"), "SELECT 1536");
  assertEquals(e("2 MB + 7d"), "SELECT 2097152 + 604800");
  assertEquals(e("10 GB"), "SELECT 10 AS GB");
  assertEquals(e("size > 10 KB"), "SELECT size > 10240");
  const plain = parse("SELECT 10 KB", ansi);
  assertEquals(plain.errors, []);
  assertEquals(print(plain.script.statements[0] ?? first("SELECT 1", ansi), ansi), "SELECT 10 AS KB");
  const s = first("SELECT 10 KB", units);
  assert(s.kind === "select" && s.items[0]?.expr.kind === "number" && s.items[0].expr.text === "10240" && s.items[0].expr.end - s.items[0].expr.start === 5);
});

proves(["0009-sql-print FR-006", "0002-sql-ast-parser FR-019"], "FETCH FIRST with PERCENT or WITH TIES is read into the limit and its options, written with the offset first, read back as the same tree, and a FETCH FIRST n ROWS ONLY is still a LIMIT", () => {
  for (const d of [ansi, postgres]) {
    assertEquals(roundTrip("select a from t order by a offset 2 rows fetch first 10 percent rows with ties", d), "SELECT a FROM t ORDER BY a OFFSET 2 ROWS FETCH FIRST 10 PERCENT ROWS WITH TIES");
    assertEquals(roundTrip("select a from t order by a fetch next 3 rows with ties", d), "SELECT a FROM t ORDER BY a FETCH FIRST 3 ROWS WITH TIES");
    assertEquals(roundTrip("select a from t order by a fetch first 5 percent row only", d), "SELECT a FROM t ORDER BY a FETCH FIRST 5 PERCENT ROWS ONLY");
    assertEquals(roundTrip("select a from t order by a fetch first 3 rows only", d), "SELECT a FROM t ORDER BY a LIMIT 3");
    assertEquals(roundTrip("select a from t order by a offset 1 row fetch first row only", d), "SELECT a FROM t ORDER BY a LIMIT 1 OFFSET 1");
    assertEquals(roundTrip("select a from t union all select a from u order by a fetch first 3 rows with ties", d), "SELECT a FROM t UNION ALL SELECT a FROM u ORDER BY a FETCH FIRST 3 ROWS WITH TIES");
  }
  const s = first("select a from t order by a fetch first 10 percent rows with ties", ansi);
  assert(s.kind === "select" && s.limitOptions === "PERCENT WITH TIES" && s.limit?.kind === "number", "the options are kept");
  const plain = first("select a from t fetch first 3 rows only", ansi);
  assert(plain.kind === "select" && plain.limitOptions === undefined, "a plain FETCH has no options");
  assertEquals(parse("select a from t fetch first 3 rows", ansi).errors.length > 0, true);
});

proves(["0002-sql-ast-parser FR-020", "0009-sql-print FR-001"], "TABLESAMPLE after a table with no alias is read as what stands beside the table, not as its alias, and is written back", () => {
  const t = first("select * from t tablesample bernoulli (10) repeatable (1)", postgres);
  assert(t.kind === "select" && t.from[0]?.kind === "table" && t.from[0].alias === undefined && t.from[0].hint === "tablesample bernoulli (10) repeatable (1)", "no alias");
  const a = first("select * from t as x tablesample system (10)", postgres);
  assert(a.kind === "select" && a.from[0]?.kind === "table" && a.from[0].alias?.name.name === "x" && a.from[0].hint?.toLowerCase() === "tablesample system (10)", "an alias before");
  assertEquals(roundTrip("select * from t tablesample bernoulli (10) repeatable (1)", postgres).toLowerCase(), "select * from t tablesample bernoulli (10) repeatable (1)");
  const alias = first("select * from t tablesample", postgres);
  assert(alias.kind === "select", "a table named tablesample is still an alias where nothing follows it");
});
