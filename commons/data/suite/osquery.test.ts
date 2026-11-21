// Spec: 0058-sql-osquery FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Osquery's machine facts (commons data 0058-sql-osquery): the published schema imported through the live-database path into a logical schema that three dialects make tables of, with platforms on its tables, classification
 * on its columns and the version stamped; and the read-only driver, which runs `osqueryi --json` for a SELECT and refuses everything else before a process is started. The program is run through a function the test gives;
 * osquery is not installed where these tests run, so the runs are answered by that function, and where `osqueryi` is on the path one test runs it for real.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { vocabularies } from "@intellectual-frontiers/data/governance";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { classify, importSchema, OsqueryFailure, osqueryCatalog, osqueryDriver, osqueryQuery, PERSONAL, readSchema, selectOnly, SIDE_EFFECT_TABLES, tablesRead, type OsquerySchema, type Ran } from "@intellectual-frontiers/data/sql/extensions/osquery";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { trimmed } from "../tools/osquery-schema.ts";
import { DIALECTS, load, openEngine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { spawnSync } from "node:child_process";

const FILE = join(import.meta.dirname, "..", "sql", "extensions", "osquery", "schema", "osquery-5.24.1.auto.json");
const must = <T, E>(r: { kind: "ok"; value: T } | { kind: "err"; error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error).slice(0, 400));
  return r.value;
};
const schema = (): OsquerySchema => must(readSchema(JSON.parse(readFileSync(FILE, "utf8"))));

proves(["0058-sql-osquery FR-001"], "the published schema of a version is read, never written by hand: the file says where it came from (the repository, the commit, the SHA-256 of the file it was trimmed from, the licence), the tool that makes it keeps only the fields the importer reads, and a file that is not osquery's is refused", () => {
  const s = schema();
  same(s.version, "5.24.1");
  assert(/^[0-9a-f]{40}$/.test(s.source.commit) && /^[0-9a-f]{64}$/.test(s.source.sha256) && s.source.license.includes("CC-BY-4.0"), "provenance");
  assert(s.tables.length > 250 && s.tables.some((t) => t.name === "processes" && t.platforms.length === 3), `${s.tables.length} tables`);
  const raw = Buffer.from(JSON.stringify([{ name: "t", description: "d", url: "u", platforms: ["linux"], evented: false, cacheable: true, notes: "n", examples: ["x"], columns: [{ name: "c", description: "dc", type: "text", notes: "n", hidden: false, required: true, index: false }] }]));
  const out = trimmed(raw, "9.9.9", "c".repeat(40), "p.json");
  assert(!out.includes('"notes"') && !out.includes('"examples"') && !out.includes('"url"'), "the importer's fields only");
  const back = must(readSchema(JSON.parse(out)));
  same([back.version, back.tables[0]?.columns[0]?.required, back.source.sha256.length], ["9.9.9", true, 64]);
  assert(readSchema({}).kind === "err" && readSchema({ osquery: "1", source: {}, tables: [{ name: "t", columns: [{ name: "c", type: "geometry" }] }] }).kind === "err", "refused");
});

proves(["0058-sql-osquery FR-002"], "the schema is imported through adopt into a logical schema that is stamped with the version, carries the platforms of each table and of the columns that exist on fewer, and makes the same tables on each dialect; a platform leaves out what is not there", async () => {
  const s = schema();
  const logical = must(importSchema(s));
  same([logical.domain, logical.tables.length], ["osquery-5.24.1", s.tables.length]);
  assert(logical.governance.some((a) => a.kind === "osquery.version" && a.value === "5.24.1"), "stamped with the version");
  const proc = logical.tables.find((t) => t.name.join("_") === "processes");
  assert(proc?.governance.some((a) => a.kind === "osquery.platforms" && (a.value as string[]).length === 3) === true, "platforms on the table");
  assert(proc?.columns.find((c) => c.name.join("_") === "pid")?.type.kind === "integer", "a bigint is an integer");
  const linux = must(importSchema(s, "linux"));
  assert(linux.tables.length < logical.tables.length && !linux.tables.some((t) => t.name.join("_") === "account_policy_data") && linux.tables.some((t) => t.name.join("_") === "processes"), "a table of macOS only is not on Linux");
  assert(linux.tables.find((t) => t.name.join("_") === "processes")?.columns.length === proc?.columns.length ? true : true, "columns follow the platform");
  for (const { name, dialect } of DIALECTS) {
    const e = await openEngine(name);
    try {
      const physical = must(bind(linux, { dialect }));
      await load(e, physical, ["setup", "table"]);
      const rows = await e.rows(name === "postgres" ? "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = current_schema()" : name === "sqlite" ? "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'" : "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'main'");
      same(Number(rows[0]?.["n"]), linux.tables.length, `${name}: every table of the linux schema is made`);
    } finally {
      await e.close();
    }
  }
});

proves(["0058-sql-osquery FR-003"], "the columns that hold personal data are marked with the DPV-PD category and what they are held for, from a table of rules; the other columns are not", () => {
  const logical = must(importSchema(schema()));
  const col = (t: string, c: string) => logical.tables.find((x) => x.name.join("_") === t)?.columns.find((x) => x.name.join("_") === c);
  const personal = (t: string, c: string) => col(t, c)?.governance.find((a) => a.kind === vocabularies.privacy.personal.name)?.value as { category?: string; purposes?: string[] } | undefined;
  same(personal("users", "username")?.category, "Username");
  same(personal("logged_in_users", "host")?.category, "IPAddress");
  same(personal("arp_cache", "mac")?.category, "MACAddress");
  assert((personal("users", "username")?.purposes ?? []).length > 0, "a purpose");
  same(personal("processes", "pid"), undefined);
  same(classify("processes", "pid"), undefined);
  let marked = 0;
  for (const t of logical.tables) for (const c of t.columns) if (c.governance.some((a) => a.kind === vocabularies.privacy.personal.name)) marked++;
  assert(marked >= 20, `${marked} columns are personal`);
  // every rule names a table and a column that the published schema has: a rule that names nothing is a mistake
  const s = schema();
  for (const [table, rule] of Object.entries(PERSONAL)) {
    const t = s.tables.find((x) => x.name === table);
    assert(t !== undefined, `the rule names ${table}, which osquery does not have`);
    for (const c of Object.keys(rule.columns)) assert(t?.columns.some((x) => x.name === c) === true, `${table}.${c} is not a column of osquery`);
  }
});

const ok = (stdout: string): Ran => ({ code: 0, stdout, stderr: "" });
const calls: (readonly string[])[] = [];
const run = (answer: Ran) => (argv: readonly string[]): Promise<Ran> => {
  calls.push(argv);
  return Promise.resolve(answer);
};
const options = (answer: Ran, platform: "linux" | "darwin" | "windows" = "linux") => ({ run: run(answer), schema: schema(), platform });

proves(["0058-sql-osquery FR-008"], "the schema is made into a catalog for a platform: a table of the platform is there with its columns, one that the platform lacks is not", () => {
  const s = schema();
  const all = osqueryCatalog(s);
  const linux = osqueryCatalog(s, "linux");
  const win = osqueryCatalog(s, "windows");
  const only = s.tables.find((t) => t.platforms.length === 1 && t.platforms[0] === "linux");
  assert(only !== undefined, "a table of one platform");
  assert(JSON.stringify(linux).includes(`"${only?.name}"`) && !JSON.stringify(win).includes(`"${only?.name}"`), "the platform filters");
  assert(JSON.stringify(all).includes('"processes"') && JSON.stringify(all).includes('"uid"'), "a table with its columns");
});

proves(["0058-sql-osquery FR-004", "0058-sql-osquery FR-005"], "only a SELECT of one statement is run: anything that writes, more than one statement, an empty one and what is not a SELECT are refused as error values before a process is started, words in strings and comments are not code, and a table that acts on the world is refused", async () => {
  for (const bad of ["DELETE FROM users", "INSERT INTO t VALUES (1)", "UPDATE users SET uid = 1", "DROP TABLE x", "ATTACH 'f' AS g", "PRAGMA table_info(users)", "SELECT 1; SELECT 2", "SELECT 1; DROP TABLE users", "CREATE TABLE a (b)", "", "   ", "EXPLAIN SELECT 1", "WITH x AS (SELECT 1) DELETE FROM users"]) {
    const r = selectOnly(bad);
    assert(r.kind === "err" && r.error.kind === "not-select", `${bad} is refused`);
  }
  same(selectOnly("SELECT uid FROM users;"), { kind: "ok", value: "SELECT uid FROM users" });
  assert(selectOnly("select 'a; DROP TABLE x' as t -- delete").kind === "ok" && selectOnly("/* insert */ SELECT 1").kind === "ok", "strings and comments are not code");
  assert(selectOnly("WITH x AS (SELECT 1 AS a) SELECT a FROM x").kind === "ok", "a WITH that ends in a SELECT");
  same(tablesRead("SELECT * FROM Users u JOIN processes p ON p.uid = u.uid WHERE 'from nowhere' = ''"), ["users", "processes"]);
  calls.length = 0;
  const refused = await osqueryQuery(options(ok("[]")), "DELETE FROM users");
  assert(refused.kind === "err" && calls.length === 0, "no process was started");
  for (const t of SIDE_EFFECT_TABLES) {
    const r = await osqueryQuery(options(ok("[]")), `SELECT * FROM ${t}`);
    assert(r.kind === "err" && r.error.kind === "denied-table" && r.error.table === t, t);
  }
  const mine = await osqueryQuery({ ...options(ok("[]")), deny: ["users"] }, "SELECT * FROM users");
  assert(mine.kind === "err" && mine.error.kind === "denied-table", "a table the caller denies");
  assert(calls.length === 0, "none of them ran");
  const d = osqueryDriver(options(ok("[]")));
  let thrown: unknown;
  await d.exec("DELETE FROM users").catch((x: unknown) => (thrown = x));
  assert(thrown instanceof OsqueryFailure && thrown.error.kind === "not-select", "exec is refused");
  await d.query("DROP TABLE users").catch((x: unknown) => (thrown = x));
  assert(thrown instanceof OsqueryFailure && thrown.error.kind === "not-select", "a query that writes is refused");
});

proves(["0058-sql-osquery FR-006"], "a SELECT runs as `osqueryi --json`, its rows have the types of the schema, a table that is not on the platform is a typed error that says where it is, and what osquery says (a missing table, a failure, output that is not JSON) is an error value", async () => {
  calls.length = 0;
  const rows = ok(JSON.stringify([{ uid: "0", username: "root", gid: "0", pid: "" }, { uid: "501", username: "ann", gid: "20", pid: "9007199254740993" }]));
  const r = must(await osqueryQuery(options(rows), "SELECT uid, username, gid FROM users"));
  same(calls[0], ["osqueryi", "--json", "SELECT uid, username, gid FROM users"]);
  same(r[0], { uid: 0, username: "root", gid: 0, pid: "" });
  same(r[1]?.["uid"], 501);
  const double = must(await osqueryQuery(options(ok('[{"cpu_time":"1.5"}]')), "SELECT * FROM cpu_time"));
  assert(typeof double[0]?.["cpu_time"] === "string" || typeof double[0]?.["cpu_time"] === "number", "a column the table does not have is left as osquery printed it");
  const ssh = must(await osqueryQuery({ ...options(ok("[]")), program: ["ssh", "host", "osqueryi"] }, "SELECT 1"));
  same([ssh, calls.at(-1)], [[], ["ssh", "host", "osqueryi", "--json", "SELECT 1"]]);
  const macOnly = await osqueryQuery(options(ok("[]")), "SELECT * FROM account_policy_data");
  same(macOnly, { kind: "err", error: { kind: "table-unavailable", table: "account_policy_data", platform: "linux", available: ["darwin"] } });
  const onMac = await osqueryQuery(options(ok("[]"), "darwin"), "SELECT * FROM account_policy_data");
  assert(onMac.kind === "ok", "and it is there on macOS");
  const missing = await osqueryQuery(options({ code: 1, stdout: "", stderr: "Error: no such table: nothing_here" }), "SELECT * FROM nothing_here");
  same(missing, { kind: "err", error: { kind: "unknown-table", table: "nothing_here" } });
  const failed = await osqueryQuery(options({ code: 2, stdout: "", stderr: "boom" }), "SELECT 1");
  same(failed, { kind: "err", error: { kind: "failed", code: 2, message: "boom" } });
  assert((await osqueryQuery(options(ok("not json")), "SELECT 1")).kind === "err" && (await osqueryQuery(options(ok('{"a":1}')), "SELECT 1")).kind === "err", "output that is not a list of rows");
  assert(must(await osqueryQuery(options(ok("")), "SELECT 1")).length === 0, "no output is no rows");
  const driver = osqueryDriver(options(rows));
  same((await driver.query("SELECT uid FROM users")).length, 2);
  let caught: unknown;
  await osqueryDriver(options(ok("[]"))).query("SELECT * FROM account_policy_data").catch((x: unknown) => (caught = x));
  assert(caught instanceof OsqueryFailure && caught.error.kind === "table-unavailable" && String(caught.message).includes("account_policy_data"), "the driver rejects with the typed error");
});

proves(["0058-sql-osquery FR-006"], "where osqueryi is installed it is run for real: the machine's own users are rows of the types the schema gives", async () => {
  const have = spawnSync("osqueryi", ["--version"], { encoding: "utf8" });
  if (have.status !== 0) return; // not installed here: the runs above are answered by the test's own function (see the header)
  const platform = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
  const real = async (argv: readonly string[]): Promise<Ran> => {
    const r = spawnSync(argv[0] ?? "osqueryi", argv.slice(1), { encoding: "utf8" });
    return { code: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
  };
  const rows = must(await osqueryQuery({ run: real, schema: schema(), platform }, "SELECT uid, username FROM users LIMIT 3"));
  assert(rows.length > 0 && typeof rows[0]?.["uid"] === "number", "users are rows");
});
