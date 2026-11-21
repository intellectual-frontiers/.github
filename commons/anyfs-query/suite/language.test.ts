/**
 * Tests of the language (commons anyfs-query 0002-query-language FR-001 to FR-007): the dialect is an instance the language library knows only by registration, the tables and their columns, the forms of a source,
 * the profile that refuses everything but one SELECT, the functions, the units, and the errors that are values with the position of what was wrong.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { TABLE_COLUMNS, TABLE_NAMES, columnNames, describeQueryProblem } from "../src/governance/mod.ts";
import { FUNCTIONS, analyze, jsonGet, query, registry, under } from "../src/mod.ts";
import { FILES, contextOf, seed, timed } from "./kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

async function fleet() {
  const store = timed();
  await seed(store);
  return contextOf(store);
}

const rowsOf = async (text: string): Promise<readonly Record<string, unknown>[]> => {
  const r = await query(await fleet(), text);
  if (r.kind === "err") throw new Error(describeQueryProblem(text, r.error));
  return r.value.rows;
};

proves(["0002-query-language FR-001"], "the dialect is registered with its functions in a registry of the language library, and the language library names nothing of AnyFS", async () => {
  const r = registry();
  assertEquals(r.get("anyfs")?.name, "anyfs");
  for (const f of FUNCTIONS) assert(r.lookupFunction("anyfs", f.name) !== undefined, f.name);
  assert(r.lookupFunction("anyfs", "contains")?.aggregate === false);
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for await (const e of fs.readDir(dir)) {
      const full = path.join(dir, e.name);
      if (e.isDirectory) await walk(full);
      else if (e.name.endsWith(".ts")) files.push(full);
    }
  };
  await walk(path.join(ROOT, "..", "lang-sql", "src"));
  assert(files.length > 20, "the sources of the language library are read");
  for (const f of files) assertEquals(/anyfs/i.test(await fs.readTextFile(f)), false, `${f} names AnyFS`);
});

proves(["0002-query-language FR-002"], "each table has the columns and types it is documented with, and SELECT * gives them in order", async () => {
  assertEquals(TABLE_NAMES, ["files", "content", "revisions", "places"]);
  assertEquals(columnNames("files"), ["place", "path", "name", "ext", "size", "media_type", "mtime", "rev", "kind", "depth"]);
  assertEquals(columnNames("content"), [...columnNames("files"), "text", "is_text", "redacted"]);
  assertEquals(columnNames("revisions"), ["place", "path", "rev", "size", "instant"]);
  assertEquals(columnNames("places"), ["uri", "kind", "capabilities", "consistency", "max_object"]);
  assertEquals(TABLE_COLUMNS.files["size"], "int");
  assertEquals(TABLE_COLUMNS.files["mtime"], "timestamp");
  for (const t of ["files", "content", "places"] as const) {
    const a = analyze(`SELECT * FROM ${t}`);
    assert(a.kind === "ok");
    assertEquals(a.value.columns.map((c) => c.name), columnNames(t));
  }
  const rows = await rowsOf("SELECT * FROM files('fleet:/') WHERE path = 'root.txt'");
  assertEquals(Object.keys(rows[0] ?? {}), columnNames("files"));
  assertEquals(rows[0], { place: "fleet:", path: "root.txt", name: "root.txt", ext: "txt", size: 11, media_type: "text/plain", mtime: rows[0]?.["mtime"], rev: rows[0]?.["rev"], kind: "f", depth: 1 });
});

proves(["0002-query-language FR-003"], "a source is a table or a table function with one place, and anything else is a problem with a position", async () => {
  const ctx = await fleet();
  const ok = async (q: string): Promise<number> => {
    const r = await query({ ...ctx, defaultPlace: "fleet:/machines" }, q);
    if (r.kind === "err") throw new Error(describeQueryProblem(q, r.error));
    return r.value.rows.length;
  };
  assertEquals(await ok("SELECT path FROM files('fleet:/machines')"), 5);
  assertEquals(await ok("SELECT path FROM files"), 5);
  assertEquals(await ok("SELECT path FROM files()"), 5);
  assertEquals(await ok("SELECT f.path FROM files('fleet:/docs') AS f"), 3);
  for (const bad of ["SELECT 1 FROM nothing('fleet:/')", "SELECT 1 FROM files(1)", "SELECT 1 FROM files('a', 'b')", "SELECT 1 FROM unknown_table", "SELECT 1", "SELECT 1 FROM files('fleet:/'), places"]) {
    const r = await query(ctx, bad);
    assert(r.kind === "err", bad);
    assert(describeQueryProblem(bad, r.error).length > 0);
  }
});

proves(["0002-query-language FR-004"], "everything but one SELECT of one source is refused as a value that says what and where", async () => {
  const ctx = await fleet();
  const refused = [
    "DELETE FROM files",
    "UPDATE files SET size = 1",
    "INSERT INTO files VALUES (1)",
    "CREATE TABLE x (a int)",
    "DROP TABLE files",
    "SELECT 1 FROM files('fleet:/'); SELECT 2 FROM files('fleet:/')",
    "SELECT * FROM files('fleet:/') JOIN places ON 1 = 1",
    "SELECT * FROM (SELECT * FROM files('fleet:/')) AS s",
    "WITH w AS (SELECT * FROM files('fleet:/')) SELECT * FROM w",
    "SELECT path FROM files('fleet:/') UNION SELECT path FROM files('fleet:/')",
    "SELECT count(*) FROM files('fleet:/')",
    "SELECT ext FROM files('fleet:/') GROUP BY ext",
    "SELECT path FROM files('fleet:/') WHERE size IN (SELECT size FROM files('fleet:/'))",
    "SELECT regexp(path, '.*') FROM files('fleet:/')",
    "SELECT path FROM files('fleet:/') LIMIT size",
  ];
  for (const q of refused) {
    const r = await query(ctx, q);
    assert(r.kind === "err", q);
    if (r.error.kind === "profile" || r.error.kind === "plan" || r.error.kind === "syntax" || r.error.kind === "names") {
      assert(r.error.diagnostics.length > 0, q);
      for (const d of r.error.diagnostics) assert(d.start >= 0 && d.end <= q.length && d.start <= d.end, `${q}: ${d.start}-${d.end}`);
    } else throw new Error(`${q}: ${r.error.kind}`);
  }
});

proves(["0002-query-language FR-005"], "the scalar functions are total and give no value where a value is not known", async () => {
  const q = async (expr: string): Promise<unknown> => (await rowsOf(`SELECT ${expr} AS v FROM files('fleet:/') WHERE path = 'machines/alpha.json'`))[0]?.["v"];
  assertEquals(await q("glob(path, 'machines/*.json')"), true);
  assertEquals(await q("glob(path, '*.txt')"), false);
  assertEquals(await q("under(path, 'machines')"), true);
  assertEquals(await q("under(path, 'mach')"), false);
  assertEquals(await q("basename(path)"), "alpha.json");
  assertEquals(await q("dirname(path)"), "machines");
  assertEquals(await q("upper(name)"), "ALPHA.JSON");
  assertEquals(await q("lower('AbC')"), "abc");
  assertEquals(await q("length(name)"), 10);
  assertEquals(await q("contains(path, 'pha')"), true);
  assertEquals(await q("contains(NULL, 'x')"), null);
  assertEquals(await q("json_get(NULL, '$.a')"), null);
  assertEquals(await q("coalesce(NULL, 'z')"), "z");
  assertEquals(under("a/b", "a"), true);
  assertEquals(under("ab", "a"), false);
  assertEquals(under("a", "a/"), true);
  assertEquals(under("anything", ""), true);
  const j = (t: string, p: string): unknown => jsonGet(t, p);
  assertEquals(j('{"a":{"b":[10,20,{"c":"x"}]}}', "$.a.b[2].c"), "x");
  assertEquals(j('{"a":{"b":[10,20]}}', "$.a.b[1]"), 20);
  assertEquals(j('{"a":true}', "$.a"), true);
  assertEquals(j('{"a":{"b":1}}', "$.a"), '{"b":1}');
  assertEquals(j('{"a":1}', "$.b"), null);
  assertEquals(j('{"a":1}', "a"), null);
  assertEquals(j('{"a":1}', "$..a"), null);
  assertEquals(j("not json", "$.a"), null);
  assertEquals(j('{"__proto__":1}', "$.constructor"), null);
  assertEquals(j(`${"[".repeat(100)}${"]".repeat(100)}`, "$[0]"), null);
  assertEquals(j(`{"a":"${"x".repeat(1024 * 1024)}"}`, "$.a"), null);
  assertEquals(j('{"a":[1]}', `$.a[${"9".repeat(12)}]`), null);
});

proves(["0002-query-language FR-006"], "a number may be followed by a unit of size or time", async () => {
  const big = await rowsOf("SELECT path FROM files('fleet:/') WHERE size >= 1 KB ORDER BY path");
  assertEquals(big.map((r) => r["path"]), ["docs/big.txt"]);
  const recent = await rowsOf("SELECT path FROM files('fleet:/') WHERE mtime > now() - 1 D");
  assertEquals(recent.length, 0, "the files were written a week and more before the clock");
  const all = await rowsOf("SELECT path FROM files('fleet:/') WHERE mtime > now() - 30 D");
  assertEquals(all.length, Object.keys(FILES).length);
});

proves(["0002-query-language FR-007"], "no text makes a query throw: each is a value, and a problem is described with its line and column", async () => {
  const ctx = await fleet();
  const hostile = [
    "",
    "   ",
    "SELECT",
    "SELECT * FROM",
    "SELECT * FROM files('fleet:/') WHERE",
    "SELECT \u0000 FROM files('fleet:/')",
    "SELECT '\u0000' FROM files('fleet:/')",
    `SELECT ${"(".repeat(5000)}1${")".repeat(5000)} FROM files('fleet:/')`,
    `SELECT ${"-".repeat(5000)}1 FROM files('fleet:/')`,
    `SELECT path FROM files('fleet:/') WHERE ${"a=1 AND ".repeat(3000)}1=1`,
    "SELECT path FROM files('fleet:/') WHERE path = 'x'; DROP TABLE files; --",
    "SELECT path FROM files('fleet:/') WHERE path = '\\'' OR 1=1 --",
    "SELECT /* unterminated FROM files",
    "SELECT \"unterminated FROM files",
    "‮ SELECT path FROM files",
    "SELECT path FROM files('fleet:/' || 'x')",
  ];
  for (const q of hostile) {
    const r = await query(ctx, q);
    if (r.kind === "err") assert(describeQueryProblem(q, r.error).length > 0, q.slice(0, 40));
  }
  const bad = "SELECT path\nFROM files('fleet:/')\nWHERE nope = 1";
  const r = await query(ctx, bad);
  assert(r.kind === "err");
  assert(describeQueryProblem(bad, r.error).startsWith("3:7: "));
});
