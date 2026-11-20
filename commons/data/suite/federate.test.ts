// Spec: 0058-sql-osquery FR-007
// Spec: 0059-sql-federate FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * Running one query on many targets and merging the answers (commons data 0059-sql-federate), on real engines: SQLite, DuckDB and PostgreSQL are three "machines" that hold different packages, a fourth engine (DuckDB)
 * is where the answers are merged. Partial results, a quorum, a timeout, a concurrency limit, a limit on rows, redaction, type agreement, the merge as SQL (counts and differences), the optional audit kept in a table, and
 * machines asked through osquery (answered by the test's own program runner, since osquery is not installed here).
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { auditOf, auditTable, columnsOf, countBy, differences, failures, fanOut, mergeInto, type Target } from "@intellectual-frontiers/data/sql/federate";
import { osqueryTarget, readSchema, redactPersonal, type Ran } from "@intellectual-frontiers/data/sql/extensions/osquery";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DIALECTS, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const SCHEMA = join(import.meta.dirname, "..", "sql", "extensions", "osquery", "schema", "osquery-5.24.1.auto.json");

const PACKAGES: Readonly<Record<Engine["name"], readonly (readonly [string, string, number])[]>> = {
  sqlite: [["openssl", "3.0", 1], ["curl", "8.1", 2], ["bash", "5.2", 3]],
  duckdb: [["openssl", "3.0", 1], ["curl", "8.1", 2], ["bash", "5.1", 3]],
  postgres: [["openssl", "3.0", 1], ["curl", "8.0", 2]],
};

async function machines(): Promise<{ targets: Target[]; engines: Engine[] }> {
  const engines: Engine[] = [];
  const targets: Target[] = [];
  for (const { name } of DIALECTS) {
    const e = await openEngine(name);
    await e.run("CREATE TABLE pkg (name TEXT, version TEXT, size INTEGER)");
    for (const [n, v, s] of PACKAGES[name]) await e.run(`INSERT INTO pkg VALUES ('${n}', '${v}', ${s})`);
    engines.push(e);
    targets.push({ id: `${name}-host`, platform: name === "postgres" ? "linux" : name === "duckdb" ? "linux" : "darwin", driver: driverOf(e) });
  }
  return { targets, engines };
}
const closeAll = async (es: readonly Engine[]): Promise<void> => void (await Promise.all(es.map((e) => e.close())));
const slow = (d: Driver, ms: number): Driver => ({ exec: d.exec, query: (sql) => new Promise((resolve, reject) => setTimeout(() => d.query(sql).then(resolve, reject), ms)) });

proves(["0059-sql-federate FR-001", "0059-sql-federate FR-002"], "one query is asked of every target, each answer is a value in the order of the plan (rows with when they were collected, or a typed error), a target that fails is a line and not the end of the run, and a result is partial by default", async () => {
  const { targets, engines } = await machines();
  const broken = await openEngine("sqlite");
  try {
    const result = await fanOut({ sql: "SELECT name, version FROM pkg ORDER BY name", targets: [...targets, { id: "broken", driver: driverOf(broken) }] });
    same(result.outcomes.map((o) => [o.target, o.status]), [["sqlite-host", "ok"], ["duckdb-host", "ok"], ["postgres-host", "ok"], ["broken", "error"]]);
    same([result.ok, result.failed, result.complete, result.quorumMet, result.quorum], [3, 1, false, true, 0]);
    const first = result.outcomes[0];
    assert(first?.status === "ok" && first.rows.length === 3 && /^\d{4}-\d{2}-\d{2}T/.test(first.collectedAt), "rows and when");
    const bad = failures(result);
    same(bad.map((o) => [o.target, o.error.kind]), [["broken", "failed"]]);
    assert(bad[0]?.error.kind === "failed" && bad[0].error.message.length > 0 && bad[0].error.cause instanceof Error, "the message and what was thrown");
    let dup: unknown;
    await fanOut({ sql: "SELECT 1", targets: [targets[0] as Target, targets[0] as Target] }).catch((x: unknown) => (dup = x));
    assert(String(dup).includes("named once"), "a target is named once");
    same((await fanOut({ sql: "SELECT 1", targets: [] })).quorumMet, true);
  } finally {
    await closeAll([...engines, broken]);
  }
});

proves(["0059-sql-federate FR-003"], "a quorum says how many targets must answer: below it the result says so and still has what answered", async () => {
  const { targets, engines } = await machines();
  const broken = await openEngine("sqlite");
  try {
    const mixed = [...targets, { id: "b1", driver: driverOf(broken) }, { id: "b2", driver: driverOf(broken) }];
    const r = await fanOut({ sql: "SELECT name FROM pkg", targets: mixed, quorum: 0.8 });
    same([r.ok, r.quorumMet], [3, false]);
    same((await fanOut({ sql: "SELECT name FROM pkg", targets: mixed, quorum: 0.5 })).quorumMet, true);
  } finally {
    await closeAll([...engines, broken]);
  }
});

proves(["0059-sql-federate FR-004"], "a target that is too slow is a timeout, no more than the concurrency are asked at once, a target that gives more rows than the plan allows is an error and its rows are not kept, and redaction changes a value before it is kept", async () => {
  const { targets, engines } = await machines();
  try {
    const slowOne = [{ ...(targets[0] as Target), id: "slow", driver: slow((targets[0] as Target).driver, 400) }, targets[1] as Target];
    const t = await fanOut({ sql: "SELECT name FROM pkg", targets: slowOne, timeoutMs: 60 });
    same(t.outcomes.map((o) => (o.status === "error" ? o.error.kind : "ok")), ["timeout", "ok"]);
    let inFlight = 0;
    let most = 0;
    const counted = (d: Driver): Driver => ({ exec: d.exec, query: async (sql) => { inFlight++; most = Math.max(most, inFlight); try { return await slow(d, 30).query(sql); } finally { inFlight--; } } });
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, driver: counted((targets[i % 3] as Target).driver) }));
    const r = await fanOut({ sql: "SELECT name FROM pkg", targets: many, concurrency: 3 });
    same([r.ok, most], [9, 3]);
    const big = await fanOut({ sql: "SELECT name FROM pkg", targets: [targets[0] as Target], maxRows: 2 });
    same(big.outcomes.map((o) => (o.status === "error" ? o.error : "ok")), [{ kind: "too-many-rows", max: 2 }]);
    const hidden = await fanOut({ sql: "SELECT name, version FROM pkg", targets: [targets[1] as Target], redact: (c, v) => (c === "version" ? "[x]" : v) });
    const o = hidden.outcomes[0];
    same(o?.status === "ok" ? o.rows[0] : undefined, { name: "openssl", version: "[x]" });
  } finally {
    await closeAll(engines);
  }
});

proves(["0059-sql-federate FR-005", "0059-sql-federate FR-006"], "the answers are loaded into DuckDB tagged with their target, with a column for each column that every answer agrees the type of (text where they do not), and the merge is SQL over fleet_rows and fleet_targets", async () => {
  const { targets, engines } = await machines();
  const merge = await openEngine("duckdb");
  const on = { driver: driverOf(merge), dialect: DIALECTS[1].dialect };
  try {
    const result = await fanOut({ sql: "SELECT name, version, size FROM pkg", targets });
    same(columnsOf(result), [{ name: "name", type: "text", mixed: false }, { name: "version", type: "text", mixed: false }, { name: "size", type: "integer", mixed: false }]);
    const m = await mergeInto(result, on);
    const rows = await on.driver.query("SELECT target, name, version FROM fleet_rows WHERE name = 'curl' ORDER BY target");
    same(rows.map((r) => `${r["target"]}:${r["version"]}`), ["duckdb-host:8.1", "postgres-host:8.0", "sqlite-host:8.1"]);
    const tg = await on.driver.query("SELECT target, status, rows FROM fleet_targets ORDER BY target");
    same(tg.map((r) => [r["target"], r["status"], Number(r["rows"])]), [["duckdb-host", "ok", 3], ["postgres-host", "ok", 2], ["sqlite-host", "ok", 3]]);
    same(await countBy(m, "version"), [{ value: "3.0", rows: 3, targets: 3 }, { value: "8.1", rows: 2, targets: 2 }, { value: "5.1", rows: 1, targets: 1 }, { value: "5.2", rows: 1, targets: 1 }, { value: "8.0", rows: 1, targets: 1 }].toSorted((a, b) => b.rows - a.rows || (a.value < b.value ? -1 : 1)));
    // a type the answers disagree on is text, and whole and fractional numbers agree as decimals
    const odd: Target[] = [
      { id: "a", driver: { exec: async () => undefined, query: async () => [{ v: 1, w: 1, t: "x" }] } },
      { id: "b", driver: { exec: async () => undefined, query: async () => [{ v: "one", w: 1.5, t: null }] } },
    ];
    same(columnsOf(await fanOut({ sql: "SELECT 1", targets: odd })), [{ name: "v", type: "text", mixed: true }, { name: "w", type: "decimal", mixed: false }, { name: "t", type: "text", mixed: false }]);
    let clash: unknown;
    await mergeInto(await fanOut({ sql: "SELECT 1", targets: [{ id: "c", driver: { exec: async () => undefined, query: async () => [{ target: "x" }] } }] }), on).catch((x: unknown) => (clash = x));
    assert(String(clash).includes("which the merge uses"), "a column the merge uses");
  } finally {
    await closeAll([...engines, merge]);
  }
});

proves(["0059-sql-federate FR-007"], "the targets that differ are found as a query: from what most targets have, or from one target, as the rows they lack and the rows they have besides", async () => {
  const { targets, engines } = await machines();
  const merge = await openEngine("duckdb");
  const on = { driver: driverOf(merge), dialect: DIALECTS[1].dialect };
  try {
    const m = await mergeInto(await fanOut({ sql: "SELECT name, version FROM pkg", targets }), on);
    const diff = await differences(m, "majority");
    const show = diff.map((d) => `${d.target}:${d.kind}:${String(d.row["name"])}@${String(d.row["version"])}`).sort();
    same(show, ["duckdb-host:extra:bash@5.1", "postgres-host:extra:curl@8.0", "postgres-host:missing:curl@8.1", "sqlite-host:extra:bash@5.2"]);
    const vs = await differences(m, { target: "sqlite-host" });
    assert(vs.every((d) => d.target !== "sqlite-host"), "the baseline is not compared with itself");
    assert(vs.some((d) => d.target === "duckdb-host" && d.kind === "missing" && d.row["version"] === "5.2") && vs.some((d) => d.target === "postgres-host" && d.kind === "missing" && d.row["name"] === "bash"), "what differs from sqlite-host");
    const clean = await mergeInto(await fanOut({ sql: "SELECT name, version FROM pkg WHERE name = 'openssl'", targets }), on);
    same(await differences(clean, "majority"), []);
  } finally {
    await closeAll([...engines, merge]);
  }
});

proves(["0059-sql-federate FR-008"], "the audit of a run is optional and the caller's: the record has who, what and what each target answered and no rows, a sink of the caller's gets it, and auditTable keeps it in a table of a database", async () => {
  const { targets, engines } = await machines();
  const store = await openEngine("sqlite");
  try {
    const result = await fanOut({ sql: "SELECT name FROM pkg", targets, now: () => new Date("2026-11-20T12:00:00Z") });
    const record = auditOf(result, "ann");
    same([record.by, record.sql, record.at, record.targets.map((t) => [t.target, t.status, t.rows])], ["ann", "SELECT name FROM pkg", "2026-11-20T12:00:00.000Z", [["sqlite-host", "ok", 3], ["duckdb-host", "ok", 3], ["postgres-host", "ok", 2]]]);
    assert(!JSON.stringify(record).includes("openssl"), "no rows in the record");
    same(record, auditOf(result, "ann"));
    const mine: unknown[] = [];
    await ((r: unknown) => void mine.push(r))(record);
    const sink = auditTable({ driver: driverOf(store), dialect: DIALECTS[0].dialect });
    await sink(record);
    await sink(auditOf(await fanOut({ sql: "SELECT 1 FROM nowhere", targets: [targets[0] as Target] }), "bo"));
    const rows = await store.rows('SELECT "by" AS who, "target", "status", "error", "quorum_met" FROM "fleet_audit" ORDER BY "by", "target"');
    same(rows.length, 4);
    same(rows.filter((r) => r["who"] === "bo").map((r) => [r["status"], r["error"]]), [["error", "failed"]]);
  } finally {
    await closeAll([...engines, store]);
  }
});

proves(["0059-sql-federate FR-009", "0058-sql-osquery FR-007"], "machines asked through osquery are targets: a table that is on one platform and not another is a typed error for the machine that lacks it and rows for the one that has it, the merge has both, and personal columns can be hidden", async () => {
  const schema = (() => {
    const r = readSchema(JSON.parse(readFileSync(SCHEMA, "utf8")));
    if (r.kind === "err") throw new Error(r.error);
    return r.value;
  })();
  const answer = (rows: unknown): Ran => ({ code: 0, stdout: JSON.stringify(rows), stderr: "" });
  const linux = osqueryTarget("web-1", { run: async () => answer([{ uid: "0", username: "root" }, { uid: "1000", username: "ann" }]), schema, platform: "linux" });
  const mac = osqueryTarget("laptop", { run: async () => answer([{ uid: "0", username: "root" }, { uid: "501", username: "bo" }]), schema, platform: "darwin" });
  const both = await fanOut({ sql: "SELECT uid, username FROM users", targets: [linux, mac], redact: redactPersonal() });
  same(both.outcomes.map((o) => (o.status === "ok" ? o.rows.length : o.error.kind)), [2, 2]);
  const first = both.outcomes[0];
  same(first?.status === "ok" ? first.rows[0] : undefined, { uid: "[redacted]", username: "[redacted]" });
  const macOnly = await fanOut({ sql: "SELECT uid FROM account_policy_data", targets: [linux, mac] });
  const bad = failures(macOnly);
  same(bad.map((o) => o.target), ["web-1"]);
  const cause = bad[0]?.error.kind === "failed" ? (bad[0].error.cause as { error?: unknown } | undefined)?.error : undefined;
  same(cause, { kind: "table-unavailable", table: "account_policy_data", platform: "linux", available: ["darwin"] });
  same(macOnly.outcomes[1]?.status, "ok");
  const merge = await openEngine("duckdb");
  try {
    const m = await mergeInto(macOnly, { driver: driverOf(merge), dialect: DIALECTS[1].dialect });
    same((await countBy(m, "uid")).map((r) => Number(r.value)).sort((a, b) => a - b), [0, 501]);
    const t = await merge.rows("SELECT target, status, error FROM fleet_targets ORDER BY target");
    same(t.map((r) => [r["target"], r["status"], r["error"]]), [["laptop", "ok", null], ["web-1", "error", "failed"]]);
  } finally {
    await merge.close();
  }
});
