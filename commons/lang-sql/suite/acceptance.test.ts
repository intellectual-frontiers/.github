/**
 * The language and the two utilities (commons lang-sql 0011-acceptance FR-001 to FR-006): the dialect, profile and catalog both share, sqlfs over a file system given as an interface with a pruned walk, and sqlfind's compilation to `find`.
 *
 * Spec: 0011-acceptance FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parse, print } from "@intellectual-frontiers/lang-sql";
import { analyze, CATALOG, describeDiagnostics, type Entry, entryOf, PROFILE, registry, sqlfs } from "../acceptance/shared/language.ts";
import { command as findCommand } from "../acceptance/sqlfind/main.ts";
import { capabilities, compileFind, escapeGlob, FORBIDDEN, parseFind, shellQuote, toShell } from "../acceptance/sqlfind/mod.ts";
import { command as fsCommand } from "../acceptance/sqlfs/main.ts";
import { boundsOf, search } from "../acceptance/sqlfs/mod.ts";
import { memoryFs, type FileSystem, type WalkOptions } from "../acceptance/shared/walk.ts";

const E = (path: string, kind: Entry["kind"] = "f", size = 1, mtime = 1, mode = 0o644): Entry => entryOf(path, kind, size, mtime, mode, "me");

const TREE: readonly Entry[] = [
  E("a", "d"),
  E("a/x.ts", "f", 5),
  E("a/y.md", "f", 2048),
  E("a/deep", "d"),
  E("a/deep/z.ts", "f", 7),
  E("b", "d"),
  E("b/w.ts", "f", 9),
  E("top.txt", "f", 4),
];

proves(["0011-acceptance FR-001"], "the dialect reads GLOB, ILIKE and the units, the profile is one table with no join, aggregate or subquery, the catalog types its columns, and a library registers the dialect and its functions", () => {
  const s = parse("SELECT 1 FROM files WHERE size > 10 KB AND mtime > now() - 7 D AND name GLOB 'a*' AND name ILIKE 'B%'", sqlfs);
  assertEquals(s.errors, []);
  assertEquals(print(s.script.statements[0] ?? s.script, sqlfs), "SELECT 1 FROM files WHERE size > 10240 AND mtime > now() - 604800 AND name GLOB 'a*' AND name ILIKE 'B%'");
  assertEquals(Object.keys(CATALOG.tables["files"]?.columns ?? {}), ["name", "path", "ext", "kind", "size", "mtime", "mode", "owner", "depth"]);
  assertEquals(CATALOG.tables["files"]?.columns["size"], "int");
  assertEquals(PROFILE.tables, ["files"]);
  for (const [q, part] of [
    ["SELECT count(*) FROM files", "the function count is not in the language sqlfs"],
    ["SELECT 1 FROM files a JOIN files b ON TRUE", "join is not in the language sqlfs"],
    ["SELECT 1 FROM files WHERE size IN (SELECT size FROM files)", "in-query is not in the language sqlfs"],
    ["SELECT 1 FROM other", "the table other is not in the language sqlfs"],
    ["DELETE FROM files", "a delete statement is not in the language sqlfs"],
    ["WITH x AS (SELECT 1) SELECT * FROM x", "with is not in the language sqlfs"],
    ["SELECT 1 FROM files UNION SELECT 2 FROM files", "set-op is not in the language sqlfs"],
    ["SELECT lower(name) OVER () FROM files", "window-spec is not in the language sqlfs"],
  ] as const) {
    const r = analyze(q);
    assert(r.kind === "err" && r.error.some((d) => d.message.includes(part)), `${q}: ${JSON.stringify(r)}`);
  }
  const reg = registry();
  assertEquals(reg.get("SQLFS") === sqlfs, true);
  assertEquals(reg.lookupFunction("sqlfs", "glob")?.returns, "bool");
  assertEquals(reg.lookupFunction("sqlfs", "count")?.aggregate, true, "ansi's functions are inherited");
});

proves(["0011-acceptance FR-002"], "a query is read, conformed, bound, typed and planned, and an error of any step is an error value with a span that each utility prints with the line and a caret", async () => {
  const q = "SELECT path\nFROM files\nWHERE siez > 10";
  const r = analyze(q);
  assert(r.kind === "err");
  assertEquals(describeDiagnostics(q, r.error), ["error: there is no column siez; did you mean size?", "  --> line 3, column 7", "3 | WHERE siez > 10", "  |       ^^^^"].join("\n"));
  const t = analyze("SELECT path FROM files WHERE name > 5");
  assert(t.kind === "err" && t.error[0]?.message === "text cannot be compared with int");
  const syn = analyze("SELECT FROM files");
  assert(syn.kind === "err");
  const grouped = analyze("SELECT ext FROM files GROUP BY ext");
  assert(grouped.kind === "err" && grouped.error[0]?.message === "grouping is not planned");
  const two = analyze("SELECT 1 FROM files; SELECT 2 FROM files");
  assert(two.kind === "err");
  const ok = analyze("SELECT name, size / 1 KB AS kb FROM files WHERE ext IN ('ts', 'js') ORDER BY kb DESC LIMIT 3");
  assert(ok.kind === "ok");
  for (const cmd of [fsCommand, findCommand]) {
    const out = await cmd(["--root", ".", "SELECT path FROM files WHERE siez > 10"]);
    assertEquals(out.code, 1);
    assert(out.err.includes("did you mean size?") && out.err.includes("^^^^") && out.out === "");
  }
});

class Counting implements FileSystem {
  walked: string[] = [];
  readonly inner = memoryFs(TREE);
  async *walk(options?: WalkOptions) {
    for await (const e of this.inner.walk(options)) {
      this.walked.push(e.path);
      yield e;
    }
  }
}

proves(["0011-acceptance FR-003"], "sqlfs runs a query over a file system given as an interface, prunes the walk where the filter allows, gives what the in-memory table gives, and limits the rows", async () => {
  const run = async (q: string, fs: FileSystem = memoryFs(TREE)) => {
    const r = await search(fs, q, { now: 100 });
    assert(r.kind === "ok", q);
    return r.value;
  };
  assertEquals((await run("SELECT path FROM files WHERE ext = 'ts' ORDER BY path")).rows.map((x) => x["path"]), ["a/deep/z.ts", "a/x.ts", "b/w.ts"]);
  assertEquals((await run("SELECT path, size FROM files WHERE size > 1 KB")).rows, [{ path: "a/y.md", size: 2048 }]);
  const depth = new Counting();
  await run("SELECT path FROM files WHERE depth <= 2", depth);
  assertEquals(depth.walked.includes("a/deep/z.ts"), false, "nothing below level 2 is walked");
  assertEquals(depth.walked.includes("a/deep"), true);
  const prefix = new Counting();
  const p = await run("SELECT path FROM files WHERE path GLOB 'a/deep/*'", prefix);
  assertEquals(p.rows.map((x) => x["path"]), ["a/deep/z.ts"]);
  assertEquals(prefix.walked.includes("b/w.ts"), false, "b is not walked");
  assert(p.explained.includes("path prefix 'a/deep/'"));
  const never = new Counting();
  const n = await run("SELECT path FROM files WHERE FALSE", never);
  assertEquals([n.rows.length, never.walked.length], [0, 0]);
  assert(n.explained.includes("nothing"));
  const cut = await search(memoryFs(TREE), "SELECT path FROM files", { maxRows: 3 });
  assert(cut.kind === "ok" && cut.value.rows.length === 3 && cut.value.truncated);
  const deep = await search(memoryFs(TREE), "SELECT path FROM files", { maxDepth: 1 });
  assert(deep.kind === "ok" && deep.value.rows.map((x) => x["path"]).join() === "a,b,top.txt");
  const all = await run("SELECT * FROM files WHERE depth = 1 ORDER BY path");
  assertEquals(all.columns, ["name", "path", "ext", "kind", "size", "mtime", "mode", "owner", "depth"]);
  assertEquals(boundsOf(undefined), { maxDepth: undefined, prefix: undefined, never: false });
  const out = await fsCommand(["--root", "/nonexistent-dir-for-test", "SELECT path FROM files"]);
  assertEquals([out.code, out.err.startsWith("sqlfs: no such directory")], [2, true]);
  assertEquals((await fsCommand(["--bogus"])).code, 2);
  assertEquals((await fsCommand([])).code, 2);
});

const argv = (q: string, flavor: "gnu" | "bsd" = "gnu", root = "/r"): readonly string[] => {
  const c = compileFind(q, root, flavor);
  assert(c.kind === "ok", q);
  return c.value.argv;
};
const tail = (a: readonly string[], flavor: "gnu" | "bsd" = "gnu"): string => a.slice(flavor === "gnu" ? 2 : 2, flavor === "gnu" ? -2 : -1).join(" ");

proves(["0011-acceptance FR-004"], "sqlfind compiles a query to the arguments of find: depth, type, name patterns, path, size in bytes, time, owner and permissions are pushed, and what find cannot say is left to the process", () => {
  assertEquals(tail(argv("SELECT path FROM files WHERE depth >= 2 AND depth < 4")), "-mindepth 2 -maxdepth 3");
  assertEquals(tail(argv("SELECT path FROM files WHERE depth = 2")), "-mindepth 2 -maxdepth 2");
  assertEquals(tail(argv("SELECT path FROM files WHERE kind = 'f' AND ext = 'ts'")), "-mindepth 1 -maxdepth 64 -type f -name *.ts");
  assertEquals(tail(argv("SELECT path FROM files WHERE ext IN ('ts', 'js')")), "-mindepth 1 -maxdepth 64 ( -name *.ts -o -name *.js )");
  assertEquals(tail(argv("SELECT path FROM files WHERE name LIKE 'a%_b'")), "-mindepth 1 -maxdepth 64 -name a*?b");
  assertEquals(tail(argv("SELECT path FROM files WHERE name = 'a[1]*?'")), "-mindepth 1 -maxdepth 64 -name a\\[1\\]\\*\\?");
  assertEquals(tail(argv("SELECT path FROM files WHERE name ILIKE 'A%'")), "-mindepth 1 -maxdepth 64 -iname A*");
  assertEquals(tail(argv("SELECT path FROM files WHERE path GLOB 'src/*'", "gnu", "/r/")), "-mindepth 1 -maxdepth 64 -path /r/src/*");
  assertEquals(tail(argv("SELECT path FROM files WHERE path LIKE 'src/%'", "gnu", "rel")), "-mindepth 1 -maxdepth 64 -path ./rel/src/*");
  assertEquals(tail(argv("SELECT path FROM files WHERE size > 1 KB AND size <= 1 MB")), "-mindepth 1 -maxdepth 64 -size +1024c -size -1048577c");
  assertEquals(tail(argv("SELECT path FROM files WHERE mtime > 1700000000")), "-mindepth 1 -maxdepth 64 -newermt @1700000000.999999999");
  assertEquals(tail(argv("SELECT path FROM files WHERE mtime <= 1700000000")), "-mindepth 1 -maxdepth 64 ! -newermt @1700000000.999999999");
  assertEquals(tail(argv("SELECT path FROM files WHERE mode = 420 AND NOT (kind = 'd')")), "-mindepth 1 -maxdepth 64 -perm 644 ! -type d");
  assertEquals(tail(argv("SELECT path FROM files WHERE NOT (ext = 'ts' OR kind = 'd')")), "-mindepth 1 -maxdepth 64 ! -name *.ts ! -type d");
  // what find cannot say is not in the arguments, and the process does it
  for (const q of ["SELECT path FROM files WHERE lower(name) = 'x'", "SELECT path FROM files WHERE ext = ''", "SELECT path FROM files WHERE name LIKE 'a!%' ESCAPE '!'", "SELECT path FROM files WHERE ext = 'tar.gz'", "SELECT path FROM files WHERE size >= 0", "SELECT path FROM files WHERE name = '-x'", "SELECT path FROM files WHERE owner = 'no-such-user-xyz'", "SELECT path FROM files WHERE mode > 5", "SELECT path FROM files WHERE kind = 'o'", "SELECT path FROM files WHERE name GLOB 'a\\*'", "SELECT path FROM files WHERE ext IN (1, 2, 3, 4, 5, 6, 7, 8, 9)"]) {
    const c = compileFind(q, "/r", "gnu");
    assert(c.kind === "ok", q);
    assertEquals(c.value.argv.slice(2, -2), ["-mindepth", "1", "-maxdepth", "64"], q);
    assertEquals(c.value.split.pushed.predicate, undefined, q);
  }
  const lim = compileFind("SELECT path FROM files ORDER BY size LIMIT 2", "/r", "gnu");
  assert(lim.kind === "ok" && lim.value.split.residual.kind === "limit" && lim.value.split.pushed.sort === undefined);
  assertEquals(escapeGlob("a*b?[c]\\"), "a\\*b\\?\\[c\\]\\\\");
  assertEquals(capabilities("gnu", "/r").canEval(compileFind("SELECT 1 FROM files WHERE kind = 'f'", "/r", "gnu").kind === "ok" ? (analyzeWhere("kind = 'f'")) : analyzeWhere("kind = 'f'")), true);
  const out = Buffer.from(`${["a b.ts", "f", "123", "1700000000", "644", "root", "dir", "d", "4096", "1700000100", "755", "root"].join("\u0000")}\u0000`);
  const c = compileFind("SELECT path FROM files", "/r", "gnu");
  assert(c.kind === "ok");
  assertEquals(parseFind(c.value, out).map((e) => [e.path, e.kind, e.size, e.mtime, e.mode, e.owner, e.depth, e.ext]), [["a b.ts", "f", 123, 1700000000, 0o644, "root", 1, "ts"], ["dir", "d", 4096, 1700000100, 0o755, "root", 1, ""]]);
});

const analyzeWhere = (w: string) => {
  const a = analyze(`SELECT path FROM files WHERE ${w}`);
  assert(a.kind === "ok");
  const p = a.value.select.where;
  assert(p !== undefined);
  return p;
};

proves(["0011-acceptance FR-005"], "the flavors differ in what they read and push, and no argument list holds a flag that writes or runs, whatever the query holds", () => {
  const gnu = argv("SELECT path FROM files WHERE mtime > 1700000000 AND ext = 'ts'", "gnu");
  const bsd = argv("SELECT path FROM files WHERE mtime > 1700000000 AND ext = 'ts'", "bsd");
  assertEquals(gnu.at(-1), "%P\\0%y\\0%s\\0%Ts\\0%m\\0%u\\0");
  assertEquals(gnu.at(-2), "-printf");
  assertEquals(bsd.at(-1), "-print0");
  assert(gnu.includes("-newermt") && !bsd.includes("-newermt"), "BSD leaves the time to the process");
  assert(gnu.includes("-name") && bsd.includes("-name"));
  const hostile = ["-exec", "-delete", "-ok", "-fprint", ";", "'; rm -rf /; echo '", "$(rm -rf /)", "`id`", "(", ")", "!", "-o", "\\", "../../etc", "a\nb", "a\0b", "*", "-printf %s", "x -exec rm {} +", "--version"];
  for (const h of hostile) {
    const lit = `'${h.replace(/'/g, "''")}'`;
    for (const q of [`SELECT path FROM files WHERE name = ${lit}`, `SELECT path FROM files WHERE ext = ${lit}`, `SELECT path FROM files WHERE path = ${lit}`, `SELECT path FROM files WHERE name LIKE ${lit}`, `SELECT path FROM files WHERE name ILIKE ${lit}`, `SELECT path FROM files WHERE path GLOB ${lit}`, `SELECT path FROM files WHERE owner = ${lit}`, `SELECT path FROM files WHERE kind = ${lit}`]) {
      for (const flavor of ["gnu", "bsd"] as const) {
        const c = compileFind(q, "/r", flavor);
        if (c.kind !== "ok") continue;
        for (const f of FORBIDDEN) assert(!c.value.argv.includes(f), `${q} holds ${f}`);
        assertEquals(c.value.argv.filter((a) => a.startsWith("-") && !["-mindepth", "-maxdepth", "-name", "-iname", "-path", "-ipath", "-type", "-user", "-perm", "-size", "-newermt", "-printf", "-print0", "-o"].includes(a)), [], q);
      }
    }
  }
  for (const root of ["-exec", "--version", "-delete", "a b", "", "/", "."]) {
    const c = compileFind("SELECT path FROM files", root, "gnu");
    assert(c.kind === "ok");
    assert(!(c.value.argv[1] ?? "").startsWith("-"), `the root ${root} is not read as a flag`);
  }
  assertEquals(compileFind("SELECT path FROM files WHERE path = 'x'", "/", "gnu").kind === "ok" && (argv("SELECT path FROM files WHERE path = 'x'", "gnu", "/").includes("/x")), true);
});

proves(["0011-acceptance FR-006"], "--explain prints the plan, what is pushed and what is left, and --emit prints the command as JSON or as one line quoted for a shell", async () => {
  const q = "SELECT path FROM files WHERE ext = 'ts' AND lower(name) <> 'x' ORDER BY size LIMIT 2";
  const j = await findCommand(["--root", ".", "--flavor", "gnu", "--emit", "argv", q]);
  assertEquals(j.code, 0);
  const arr = JSON.parse(j.out) as string[];
  assertEquals(arr.slice(0, 2), ["find", "."]);
  assert(arr.includes("*.ts"));
  const s = await findCommand(["--root", ".", "--flavor", "gnu", "--emit", "shell", q]);
  assert(s.out.startsWith("find . -mindepth 1 -maxdepth 64 -name '*.ts' -printf '%P\\0"), s.out);
  const x = await findCommand(["--root", ".", "--flavor", "gnu", "--explain", q]);
  assert(x.out.startsWith("find (gnu): find . "));
  assert(x.out.includes("process:\n  limit 2\n  ") && x.out.includes("filter lower(name) <> 'x'") && x.out.includes("sort size"), x.out);
  const f = await fsCommand(["--root", ".", "--explain", q]);
  assert(f.out.includes("filter ext = 'ts' AND lower(name) <> 'x'") && f.out.includes("walk: all levels"));
  assertEquals(shellQuote("a b"), "'a b'");
  assertEquals(shellQuote("it's"), "'it'\\''s'");
  assertEquals(shellQuote("-name"), "-name");
  assertEquals(toShell(["find", "/a b", "-name", "*.ts"]), "find '/a b' -name '*.ts'");
  assertEquals((await findCommand(["--flavor", "zzz", q])).code, 2);
  assertEquals((await findCommand(["--emit", "x", q])).code, 2);
  assertEquals((await fsCommand(["--emit", "argv", q])).code, 2, "sqlfs has no --emit");
});
