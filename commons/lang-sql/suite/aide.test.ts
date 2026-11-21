/**
 * Aide, the helpers of the language (commons lang-sql 0010-aide FR-002 to FR-009): profiles, the catalog with names and types, simplifying, planning and splitting, closures and running, and transpile, templates and rendered diagnostics.
 *
 * Spec: 0010-aide FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, type Dialect, type Expr, parse, print, type Select } from "@intellectual-frontiers/lang-sql";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { dialect as tsql } from "@intellectual-frontiers/lang-sql/dialects/tsql";
import { bind, type Catalog, check, closest, typeOf } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { compile, run, type Row, type Value } from "@intellectual-frontiers/lang-sql/aide/exec";
import { conjoin, conjuncts, simplify } from "@intellectual-frontiers/lang-sql/aide/normalize";
import { type Capabilities, explain, plan, split } from "@intellectual-frontiers/lang-sql/aide/plan";
import { conform, defineProfile } from "@intellectual-frontiers/lang-sql/aide/profile";
import { renderDiagnostic, sql, transpile } from "@intellectual-frontiers/lang-sql/aide/text";

const select = (text: string, d: Dialect = ansi): Select => {
  const p = parse(text, d);
  assertEquals(p.errors, [], text);
  const s = p.script.statements[0];
  assert(s !== undefined && s.kind === "select", text);
  return s;
};
const expr = (text: string, d: Dialect = ansi): Expr => {
  const s = select(`SELECT ${text}`, d);
  const e = s.items[0]?.expr;
  assert(e !== undefined);
  return e;
};

const CATALOG: Catalog = {
  tables: {
    files: { columns: { name: "text", path: "text", size: "int", mtime: "timestamp", kind: "text", depth: "int" } },
    owners: { columns: { name: "text", uid: "int" } },
  },
  functions: [
    { name: "lower", params: ["text"], minArgs: 1, maxArgs: 1, result: "text" },
    { name: "length", params: ["text"], minArgs: 1, maxArgs: 1, result: "int" },
    { name: "now", params: [], minArgs: 0, maxArgs: 0, result: "timestamp" },
  ],
};

proves(["0010-aide FR-002"], "a profile restricts statements, nodes, functions, tables and size, and every violation is an error value with its span", () => {
  const files = defineProfile({ name: "files", statements: ["select"], forbidNodes: ["join", "subquery", "scalar-query", "exists", "in-query", "with", "set-op"], tables: ["files"], functions: ["lower", "length"], maxDepth: 12, maxNodes: 60, maxTables: 1 });
  const ok = conform(parse("SELECT lower(name) FROM files WHERE size > 10 ORDER BY name LIMIT 5", ansi), files);
  assert(ok.kind === "ok");
  const text = "DELETE FROM files; SELECT count(*), x FROM other JOIN files ON TRUE WHERE a IN (SELECT 1)";
  const bad = conform(parse(text, ansi), files);
  assert(bad.kind === "err");
  const msgs = bad.error.map((v) => v.message);
  assert(msgs.some((m) => m === "a delete statement is not in the language files"));
  assert(msgs.some((m) => m === "the function count is not in the language files"));
  assert(msgs.some((m) => m === "the table other is not in the language files"));
  assert(msgs.some((m) => m === "join is not in the language files"));
  assert(msgs.some((m) => m === "in-query is not in the language files"));
  assert(msgs.some((m) => m.startsWith("the statement reads 3 tables")));
  const j = bad.error.find((v) => v.message === "join is not in the language files");
  assertEquals(j === undefined ? "" : text.slice(j.start, j.end), "other JOIN files ON TRUE");
  const deep = conform(parse(`SELECT ${"(".repeat(20)}1${")".repeat(20)} FROM files`, ansi), defineProfile({ name: "d", statements: ["select"], maxDepth: 5 }));
  assert(deep.kind === "ok", "parentheses are not nodes");
  const wide = conform(parse("SELECT 1 + 2 + 3 + 4 + 5 + 6", ansi), defineProfile({ name: "w", statements: ["select"], maxNodes: 5 }));
  assert(wide.kind === "err" && wide.error[0]?.message.startsWith("the statement has"));
  const dm = conform(parse("SELECT ((((((a + b) + c) + d) + e) + f) + g) + h FROM t", ansi), defineProfile({ name: "d", statements: ["select"], maxDepth: 4 }));
  assert(dm.kind === "err" && dm.error[0]?.message.includes("nested"));
  const broken = conform(parse("SELECT FROM WHERE", ansi), files);
  assert(broken.kind === "err" && broken.error.length >= 1);
  assert(conform(parse("SELECT 1", ansi), defineProfile({ name: "any", statements: ["select"] })).kind === "ok");
});

proves(["0010-aide FR-003"], "names are resolved against a catalog with aliases and subquery scopes, and unknown and ambiguous names are error values with a suggestion", () => {
  const b = bind(select("SELECT f.name, SIZE, (SELECT max(uid) FROM owners o WHERE o.name = f.name) FROM files f WHERE depth > 1 ORDER BY name"), CATALOG);
  assert(b.kind === "ok");
  assertEquals(b.value.tables, [{ name: "files", alias: "f" }]);
  assertEquals([...b.value.columns.values()].map((c) => `${c.alias}.${c.column}:${c.type}`).slice(0, 3), ["f.name:text", "f.size:int", "o.uid:int"]);
  const e1 = bind(select("SELECT nme FROM files"), CATALOG);
  assert(e1.kind === "err" && e1.error[0]?.message === "there is no column nme; did you mean name?" && e1.error[0].suggestion === "name");
  const e2 = bind(select("SELECT name FROM files f JOIN owners o ON TRUE"), CATALOG);
  assert(e2.kind === "err" && e2.error[0]?.message === "the column name is ambiguous");
  const e3 = bind(select("SELECT 1 FROM fils"), CATALOG);
  assert(e3.kind === "err" && e3.error[0]?.message === "there is no table fils; did you mean files?");
  const e4 = bind(select("SELECT f.nope FROM files f"), CATALOG);
  assert(e4.kind === "err" && e4.error[0]?.message === "there is no column f.nope; did you mean name?");
  const e5 = bind(select("SELECT name FROM files WHERE EXISTS (SELECT 1 FROM owners WHERE uid = missing)"), CATALOG);
  assert(e5.kind === "err" && e5.error[0]?.message.startsWith("there is no column missing"));
  const alias = bind(select("SELECT size AS s FROM files ORDER BY s"), CATALOG);
  assert(alias.kind === "ok");
  assertEquals(closest("lenght", ["length", "lower"]), "length");
  assertEquals(closest("zzzzzz", ["length", "lower"]), undefined);
});

proves(["0010-aide FR-004"], "an expression has a type, and a use that cannot be right is an error value", () => {
  const bound = (t: string) => {
    const s = select(t);
    const b = bind(s, CATALOG);
    assert(b.kind === "ok", t);
    return { s, b: b.value };
  };
  const t = (e: string): string => {
    const { s, b } = bound(`SELECT ${e} FROM files`);
    const x = s.items[0]?.expr;
    assert(x !== undefined);
    return typeOf(x, b);
  };
  assertEquals([t("size"), t("name"), t("size + 1"), t("size + 1.5"), t("mtime - mtime"), t("size > 1"), t("lower(name)"), t("length(name)"), t("now()"), t("NULL"), t("name || 'x'"), t("CAST(size AS TEXT)"), t("size IS NULL")], ["int", "text", "int", "float", "int", "bool", "text", "int", "timestamp", "null", "text", "text", "bool"]);
  const c = (sqlText: string): string[] => check(bound(sqlText).b).map((e) => e.message);
  assertEquals(c("SELECT 1 FROM files WHERE name > 5"), ["text cannot be compared with int"]);
  assertEquals(c("SELECT 1 FROM files WHERE mtime > 5 AND size = 1.5"), []);
  assertEquals(c("SELECT name + 1 FROM files"), ["arithmetic on text"]);
  assertEquals(c("SELECT lower(name, 1) FROM files"), ["lower takes 1 arguments, and 2 are given"]);
  assertEquals(c("SELECT lower(size) FROM files"), ["lower takes text as argument 1, and int is given"]);
  assertEquals(c("SELECT 1 FROM files WHERE size LIKE 'a%'"), ["LIKE needs text, and the left side is int"]);
  assertEquals(c("SELECT 1 FROM files WHERE name = 'a' AND lower(name) = ?"), []);
});

proves(["0010-aide FR-005"], "simplify folds constants, pushes NOT down, expands BETWEEN and a short IN, and flattens AND and OR", () => {
  const s = (text: string): string => print(simplify(expr(text)), ansi);
  assertEquals(s("1 + 2 * 3"), "7");
  assertEquals(s("10 / 5 + 7 % 4"), "5");
  assertEquals(s("'a' || 'b'"), "'ab'");
  assertEquals(s("1 < 2"), "TRUE");
  assertEquals(s("NOT (a = 1 AND b < 2)"), "a <> 1 OR b >= 2");
  assertEquals(s("NOT NOT a"), "a");
  assertEquals(s("NOT (a IS NULL)"), "a IS NOT NULL");
  assertEquals(s("NOT (a LIKE 'x')"), "a NOT LIKE 'x'");
  assertEquals(s("NOT (a BETWEEN 1 AND 2)"), "a < 1 OR a > 2");
  assertEquals(s("a BETWEEN 1 AND 2"), "a >= 1 AND a <= 2");
  assertEquals(s("a IN (1, 2, 3)"), "a = 1 OR a = 2 OR a = 3");
  assertEquals(s("a NOT IN (1, 2)"), "a <> 1 AND a <> 2");
  assertEquals(s("a IN (1, 2, 3, 4, 5, 6, 7, 8, 9)"), "a IN (1, 2, 3, 4, 5, 6, 7, 8, 9)");
  assertEquals(s("a AND TRUE AND (b AND (c AND TRUE))"), "a AND b AND c");
  assertEquals(s("a OR FALSE OR b"), "a OR b");
  assertEquals(s("a AND (1 = 2)"), "FALSE");
  assertEquals(s("a OR (1 = 1)"), "TRUE");
  assertEquals(s("(1 = 2) OR (2 = 2)"), "TRUE");
  assertEquals(s("x / 0"), "x / 0");
  assertEquals(s("1 / 0"), "1 / 0");
  assertEquals(s("NOT TRUE"), "FALSE");
  assertEquals(s("1 - 3"), "1 - 3");
  assertEquals(conjuncts(expr("a AND b AND (c OR d)")).map((e) => print(e, ansi)), ["a", "b", "c OR d"]);
  assertEquals(print(conjoin(conjuncts(expr("a AND b AND c"))) ?? expr("x"), ansi), "a AND b AND c");
  assertEquals(conjoin([]), undefined);
  const e = expr("a > 1 AND b");
  assertEquals((simplify(e).start, simplify(e).end), e.end);
  // the value of an expression does not change: compare closures on rows
  const rows: Row[] = [{ a: 1, b: 2 }, { a: null, b: 2 }, { a: 3, b: null }, { a: 0, b: 0 }];
  for (const t of ["NOT (a > 1 AND b < 2)", "a BETWEEN 1 AND 2", "NOT (a NOT BETWEEN 0 AND 1)", "a IN (1, 3, NULL)", "a NOT IN (1, 2)", "NOT (a = 1 OR NOT (b = 2))", "a + 1 * 2 > b", "(a = 1) AND TRUE OR FALSE"]) {
    const before = compile(expr(t));
    const after = compile(simplify(expr(t)));
    assert(before.kind === "ok" && after.kind === "ok", t);
    for (const r of rows) assertEquals(after.value(r), before.value(r), `${t} on ${JSON.stringify(r)}`);
  }
});

const planOf = (text: string) => {
  const s = select(text);
  const b = bind(s, CATALOG);
  assert(b.kind === "ok", text);
  const p = plan(s, b.value);
  assert(p.kind === "ok", text);
  return p.value;
};

proves(["0010-aide FR-006"], "a query over one table is a plan of scan, filter, sort, project and limit that explain writes, and what is not planned is an error value", () => {
  const p = planOf("SELECT DISTINCT name, size AS s FROM files WHERE NOT (size > 10 AND depth = 1) ORDER BY size DESC LIMIT 5 OFFSET 2");
  assertEquals(explain(p), ["limit 5 offset 2", "  project distinct name, size AS s", "    sort size DESC", "      filter size <= 10 OR depth <> 1", "        scan files"].join("\n"));
  assertEquals(explain(planOf("SELECT name FROM files f")), "project name\n  scan files AS f");
  for (const [text, what] of [
    ["SELECT count(*) FROM files", "an aggregate"],
    ["SELECT name FROM files GROUP BY name", "grouping"],
    ["SELECT 1 FROM files f JOIN owners o ON TRUE", "a query that does not read exactly one table"],
    ["SELECT name FROM files LIMIT size", "a LIMIT that is not a number"],
    ["SELECT row_number() OVER () FROM files", "a window"],
  ] as const) {
    const s = select(text);
    const b = bind(s, CATALOG);
    const r = b.kind === "ok" ? plan(s, b.value) : b;
    assert(r.kind === "err" && r.error.some((e) => e.message.includes(what)), text);
  }
});

const caps = (can: (e: Expr) => boolean, sort: boolean, limit: boolean): Capabilities => ({ canEval: can, sort, limit });
const names = (e: Expr): string[] => {
  const out: string[] = [];
  const go = (x: unknown): void => {
    if (typeof x === "object" && x !== null) {
      if ("kind" in x && x.kind === "name" && "parts" in x && Array.isArray(x.parts)) out.push(String((x.parts[x.parts.length - 1] as { name: string }).name));
      for (const v of Object.values(x)) go(v);
    }
  };
  go(e);
  return out;
};

proves(["0010-aide FR-007"], "a plan is divided between a backend and the process, and the residual run on the pushed rows gives the rows of the whole plan", async () => {
  const text = "SELECT name, size FROM files WHERE size > 10 AND lower(name) <> 'x' AND depth <= 2 ORDER BY size DESC, name LIMIT 3";
  const p = planOf(text);
  const noLower = caps((e) => !names(e).includes("name") || !print(e, ansi).includes("lower"), true, true);
  const s = split(p, noLower);
  assertEquals(s.pushed.predicate === undefined ? "" : print(s.pushed.predicate, ansi), "size > 10 AND depth <= 2");
  assertEquals(explain(s.residual), ["limit 3", "  project name, size", "    sort size DESC, name", "      filter lower(name) <> 'x'", "        scan files (pushed down)"].join("\n").replace("    sort size DESC, name\n      filter", "    filter").replace("        scan", "      scan"));
  assert(s.pushed.limit === undefined, "a residual filter stands between");
  assertEquals(s.pushed.sort?.length, 2, "the sort is pushed: a filter after it keeps its order");
  const all = split(p, caps(() => true, true, true));
  assertEquals(explain(all.residual), "project name, size\n  scan files (pushed down)");
  assertEquals(all.pushed.limit, { limit: 3, offset: undefined });
  const none = split(p, caps(() => false, false, false));
  assertEquals(none.pushed.predicate, undefined);
  assertEquals(explain(none.residual).replace(" (pushed down)", ""), explain(p).replace(/size <= 10 OR/, "size <= 10 OR"));
  const noSort = split(p, caps(() => true, false, true));
  assert(noSort.pushed.limit === undefined && noSort.pushed.sort === undefined, "a limit does not pass an unpushed sort");
  const distinct = split(planOf("SELECT DISTINCT name FROM files LIMIT 2"), caps(() => true, true, true));
  assert(distinct.pushed.limit === undefined, "a limit does not pass DISTINCT");
  // the residual over the pushed rows is the whole plan over the rows
  const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({ name: i % 7 === 0 ? "x" : `n${i % 9}`, size: (i * 7) % 31, depth: i % 4 }));
  const whole = await run(p, rows);
  assert(whole.kind === "ok");
  for (const c of [noLower, caps(() => true, true, true), caps(() => false, false, false), caps(() => true, false, true), caps((e) => !print(e, ansi).includes("depth"), true, false)]) {
    const sp = split(p, c);
    // the backend: filter, sort and limit as it was asked to
    const pushedPlan = (() => {
      const pr = sp.pushed;
      let q: Row[] = rows;
      if (pr.predicate !== undefined) {
        const f = compile(pr.predicate);
        assert(f.kind === "ok");
        q = q.filter((r) => f.value(r) === true);
      }
      return { q, pr };
    })();
    let given = pushedPlan.q;
    if (pushedPlan.pr.sort !== undefined) {
      const sorted = await run({ kind: "sort", input: { kind: "scan", table: "files", alias: "files", pushed: false }, order: pushedPlan.pr.sort }, given);
      assert(sorted.kind === "ok");
      given = [...sorted.value];
    }
    if (pushedPlan.pr.limit !== undefined) given = given.slice(pushedPlan.pr.limit.offset ?? 0, (pushedPlan.pr.limit.offset ?? 0) + (pushedPlan.pr.limit.limit ?? given.length));
    const rest = await run(sp.residual, given);
    assert(rest.kind === "ok");
    assertEquals(rest.value, whole.value);
  }
});

const ROWS: Row[] = [
  { name: "a.ts", size: 10, mtime: 100, kind: "f", path: "src/a.ts" },
  { name: "B.TS", size: 20, mtime: 200, kind: "f", path: "src/B.TS" },
  { name: "c", size: null, mtime: 300, kind: "d", path: "src/c" },
  { name: "d_e", size: 5, mtime: 400, kind: "f", path: "lib/d_e" },
];

proves(["0010-aide FR-008"], "an expression compiles to a closure with the logic of SQL and the like-words, an unknown function is an error at compile time, and a plan runs over rows", async () => {
  const v = (text: string, row: Row = {}, d: Dialect = ansi): Value => {
    const c = compile(expr(text, d), { params: [7, "p"] });
    assert(c.kind === "ok", text);
    return c.value(row);
  };
  assertEquals([v("1 + 2 * 3"), v("7 % 4"), v("'a' || 'b'"), v("-(2)"), v("1 / 0"), v("a + 1", { a: null })], [7, 3, "ab", -2, null, null]);
  assertEquals([v("NULL = 1"), v("NULL AND false"), v("NULL OR true"), v("NULL AND true"), v("NOT NULL"), v("NULL IS NULL"), v("1 IS NOT NULL")], [null, false, true, null, null, true, true]);
  assertEquals([v("2 BETWEEN 1 AND 3"), v("2 IN (1, NULL)"), v("2 NOT IN (1, NULL)"), v("2 IN (2, NULL)")], [true, null, null, true]);
  assertEquals([v("'abc' LIKE 'a%'"), v("'abc' LIKE 'A%'"), v("'abc' NOT LIKE '_bc'"), v("'a%b' LIKE 'a!%b' ESCAPE '!'"), v("'a.b' LIKE 'a.b'"), v("'axb' LIKE 'a.b'")], [true, false, false, true, true, false]);
  assertEquals([v("'abc' ILIKE 'A%'", {}, postgres), v("'src/a.ts' GLOB 'src/*.ts'", {}, sqlite), v("'a1' GLOB 'a[0-9]'", {}, sqlite), v("'ab' GLOB 'a[!0-9]'", {}, sqlite), v("'abc' REGEXP '^a.c$'", {}, sqlite)], [true, true, true, true, true]);
  assertEquals([v("CASE WHEN 1 > 2 THEN 'x' ELSE 'y' END"), v("CASE 3 WHEN 3 THEN 'three' END"), v("CAST('12' AS INTEGER)"), v("CAST(5 AS TEXT)"), v("coalesce(NULL, 4)"), v("lower('AB') || upper('cd')"), v("length(name)", { name: "abc" }), v("substr('abcdef', 2, 3)"), v("basename('a/b/c.ts')"), v("dirname('a/b/c.ts')"), v("regexp('abc', '^a')"), v("glob('abc', 'a*')")], ["y", "three", 12, "5", 4, "abCD", 3, "bcd", "c.ts", "a/b", true, true]);
  assertEquals([v("?"), v("$2", {}, postgres)], [7, "p"]);
  const unknown = compile(expr("nope(1)"));
  assert(unknown.kind === "err" && unknown.error[0]?.message === "the function nope is not known");
  const now = compile(expr("now()"));
  assert(now.kind === "err" && now.error[0]?.message === "now needs a clock in the environment");
  const withNow = compile(expr("now() + 1"), { functions: new Map([["now", () => 100]]) });
  assert(withNow.kind === "ok" && withNow.value({}) === 101);
  const badRe = compile(expr("a REGEXP '('", sqlite));
  assert(badRe.kind === "err");
  assert(compile(expr("(SELECT 1)")).kind === "err");
  const p = planOf("SELECT DISTINCT kind AS k, size + 1 AS s FROM files WHERE size IS NOT NULL OR kind = 'd' ORDER BY size DESC LIMIT 2 OFFSET 1");
  const r = await run(p, ROWS);
  assert(r.kind === "ok");
  assertEquals(r.value, [{ k: "f", s: 11 }, { k: "f", s: 6 }]);
  async function* gen(): AsyncGenerator<Row> {
    for (const x of ROWS) yield x;
  }
  const star = await run(planOf("SELECT * FROM files ORDER BY name"), gen());
  assert(star.kind === "ok" && star.value.map((x) => x["name"]).join() === "B.TS,a.ts,c,d_e");
  const nulls = await run(planOf("SELECT name FROM files ORDER BY size"), ROWS);
  assert(nulls.kind === "ok" && nulls.value[0]?.["name"] === "c", "nulls first");
  const bad = await run({ kind: "filter", input: { kind: "scan", table: "t", alias: "t", pushed: false }, predicate: expr("nope(1)") }, ROWS);
  assert(bad.kind === "err");
});

proves(["0010-aide FR-009"], "transpile writes a text in another dialect and reports what it does not read, the template never puts a value into the text, and a diagnostic is rendered with its line and a caret", () => {
  const t = transpile("select `a b`, ifnull(c, 1) from t limit 2, 3; select 1", mysql, postgres);
  assert(t.kind === "ok");
  assertEquals(t.value.text, 'SELECT "a b", ifnull(c, 1) FROM t LIMIT 3 OFFSET 2;\nSELECT 1;');
  assertEquals(t.value.unsupported, []);
  const u = transpile("select top 3 x from t", tsql, postgres);
  assert(u.kind === "ok");
  assertEquals(u.value.unsupported.map((x) => x.statement), [0]);
  const e = transpile("select (", postgres, mysql);
  assert(e.kind === "err" && e.error.length > 0);
  const tag = sql(postgres);
  const s = tag`SELECT * FROM t WHERE a = ${1} AND b = ${"x'; DROP TABLE t; --"} AND c = ${null}`;
  assert(s.kind === "ok");
  assertEquals(s.value.text, "SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3");
  assertEquals(s.value.values, [1, "x'; DROP TABLE t; --", null]);
  assertEquals(sql(mysql)`SELECT ${1}, ${2}`.kind === "ok" && (sql(mysql)`SELECT ${1}, ${2}` as { value: { text: string } }).value.text, "SELECT ?, ?");
  const none = sql({ ...postgres, lexical: { ...postgres.lexical, params: [] } })`SELECT ${1}`;
  assert(none.kind === "err");
  const text = "SELECT a\nFROM t\nWHERE b = 1 AND\n  c ==== 2";
  const start = text.indexOf("====");
  assertEquals(renderDiagnostic(text, { start, end: start + 4, message: "unexpected operator", severity: "error" }), ["error: unexpected operator", "  --> line 4, column 5", "4 |   c ==== 2", "  |     ^^^^"].join("\n"));
  assertEquals(renderDiagnostic("x", { start: 0, end: 5, message: "m" }).split("\n")[3], "  | ^");
  assertEquals(renderDiagnostic("", { start: 0, end: 0, message: "empty" }).split("\n")[0], "error: empty");
});
