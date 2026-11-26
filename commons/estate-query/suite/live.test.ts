/**
 * Tests of the live fleet (commons estate-query 0005-estate-query-live): the list of tables with no column that can hold a secret, the text sent to a machine made from the list alone, the tables a question names found in its code and not its strings, machines asked a few at a time within a time, one that does not
 * answer said in the status and never read as no rows, a value that looks like a secret replaced, and a join of the estate with the live relations. Every name is made up.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { CAPABILITIES, defineAsset } from "@intellectual-frontiers/estate/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { canaryText } from "@intellectual-frontiers/test/canaries";
import { LIVE_STATUS, OSQUERY_TABLES, osqueryRelation, osquerySelect, osqueryTablesNamed } from "../src/governance/mod.ts";
import { openEstateQuery, type EstateData } from "../src/logical/mod.ts";
import { gatherLive } from "../src/physical/mod.ts";

const asset = (id: string) => {
  const r = defineAsset({ id, kind: "server", state: "managed", owners: Object.fromEntries(CAPABILITIES.map((c) => [c, "synth"])) });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
};
const DATA: EstateData = { assets: [asset("synthetic-server-01"), asset("synthetic-server-02"), asset("synthetic-server-03")], fleets: { "synthetic-server-01": "synthetic-fleet-01", "synthetic-server-02": "synthetic-fleet-01", "synthetic-server-03": "synthetic-fleet-01" }, now: "2026-12-01T00:00:00Z" };

proves(["0005-estate-query-live FR-001"], "the tables are a list with no column that can hold a secret, the SELECT is made from the list alone, and the tables a question names are found in its code and not in its strings", () => {
  const columns = OSQUERY_TABLES.flatMap((t) => t.columns.map(([c]) => c));
  for (const banned of ["cmdline", "environment", "env", "command", "key", "password", "secret", "token"]) assert(!columns.includes(banned), banned);
  assert(OSQUERY_TABLES.every((t) => /^[a-z_]+$/.test(t.table) && t.columns.every(([c]) => /^[a-z_]+$/.test(c))), "names a SELECT can be made from");
  assert(!OSQUERY_TABLES.some((t) => ["curl", "carves", "file_events", "yara", "docker_container_processes"].includes(t.table)), "nothing that makes a request or writes");
  assertEquals(osqueryRelation("processes")?.columns.slice(0, 3).map((c) => c.name), ["asset", "observed_at", "pid"]);
  assertEquals(osqueryRelation("nonesuch"), undefined);
  assertEquals(osquerySelect("listening_ports", 50), "SELECT pid, port, protocol, family, address FROM listening_ports LIMIT 50");
  for (const bad of [["curl", 10], ["processes; drop table x", 10], ["processes", 0], ["processes", 1.5], ["processes", 100_001]] as const) assertEquals(osquerySelect(bad[0], bad[1]), undefined);
  assertEquals(osqueryTablesNamed("select * from osquery_processes p join osquery_users u on u.uid = p.uid where p.name = 'osquery_groups' -- osquery_mounts\n"), ["processes", "users"]);
  assertEquals(osqueryTablesNamed("select * from osquery_curl"), []);
});

const fetcher = (answers: Record<string, "down" | "slow" | "throws" | readonly Record<string, string>[]>, log: { active: number; max: number } = { active: 0, max: 0 }) => async (asset: string, select: string, signal: AbortSignal) => {
  log.active++;
  log.max = Math.max(log.max, log.active);
  try {
    assert(select.startsWith("SELECT ") && select.includes(" LIMIT "), "the text is the one made from the list");
    const a = answers[asset];
    if (a === "slow") await new Promise<void>((done) => signal.addEventListener("abort", () => done()));
    if (a === "throws") throw new Error("the way broke");
    if (a === "down" || a === "slow" || a === undefined) return err(a === "down" ? "unreachable: no route to host" : "no answer");
    await new Promise((r) => setTimeout(r, 5));
    return ok(a);
  } finally {
    log.active--;
  }
};

proves(["0005-estate-query-live FR-002", "0005-estate-query-live FR-003"], "machines are asked a few at a time within a time, each value is of the type of its column, one that does not answer is said in the status and is not a machine with no rows, and a value that looks like a secret is replaced", async () => {
  const log = { active: 0, max: 0 };
  const rows = { "synthetic-server-01": [{ pid: "1", name: "systemd", path: "/usr/lib/systemd/systemd", state: "S", uid: "0", gid: "0", parent: "0" }, { pid: "x", name: canaryText("github-token"), path: "", state: "R", uid: "1000", gid: "1000", parent: "1" }], "synthetic-server-02": [] as Record<string, string>[], "synthetic-server-03": "down" as const };
  const got = await gatherLive({ assets: ["synthetic-server-01", "synthetic-server-02", "synthetic-server-03", "x1", "x2", "x3"], tables: ["processes"], fetch: fetcher({ ...rows, x1: [], x2: [], x3: [] }, log), now: () => "2026-12-01T00:00:00Z", concurrency: 2 });
  assert(got.kind === "ok");
  assert(log.max <= 2 && log.max >= 1, `at most two at once (${log.max})`);
  const t = got.value.tables["osquery_processes"];
  assertEquals(t?.rows.length, 2);
  assertEquals(t?.rows[0], ["synthetic-server-01", "2026-12-01T00:00:00Z", 1, "systemd", "/usr/lib/systemd/systemd", "S", 0, 0, 0]);
  assertEquals(t?.rows[1]?.[2], null, "a text that is not a number is not one");
  assertEquals(t?.rows[1]?.[3], "[redacted: looks like a secret]");
  const status = Object.fromEntries(got.value.status.rows.map((r) => [r[0], [r[2], r[3], r[4]]]));
  assertEquals(status["synthetic-server-01"], [true, 2, ""]);
  assertEquals(status["synthetic-server-02"], [true, 0, ""], "a machine that answered with nothing");
  assertEquals(status["synthetic-server-03"], [false, 0, "unreachable: no route to host"], "a machine that did not answer");
  const slow = await gatherLive({ assets: ["a", "b"], tables: ["users"], fetch: fetcher({ a: "slow", b: "throws" }), now: () => "t", timeoutMs: 30 });
  assert(slow.kind === "ok");
  const s = Object.fromEntries(slow.value.status.rows.map((r) => [r[0], String(r[4])]));
  assert(s["a"]?.includes("did not answer within 30 ms") === true && s["b"] === "the way broke", JSON.stringify(s));
  assertEquals((await gatherLive({ assets: ["a"], tables: ["curl"], fetch: fetcher({}), now: () => "t" })).kind, "err");
  const limited = await gatherLive({ assets: ["synthetic-server-01"], tables: ["processes"], fetch: async (_a, select) => (assert(select.endsWith("LIMIT 7")), ok([])), now: () => "t", rowLimit: 7 });
  assertEquals(limited.kind, "ok");
});

proves(["0005-estate-query-live FR-004"], "a question joins the estate with the live relations and the status, an unknown live column is found with the nearest, and a table not asked for is not there", async () => {
  const got = await gatherLive({ assets: ["synthetic-server-01", "synthetic-server-02", "synthetic-server-03"], tables: ["listening_ports"], fetch: fetcher({ "synthetic-server-01": [{ pid: "10", port: "22", protocol: "6", family: "2", address: "0.0.0.0" }, { pid: "11", port: "5432", protocol: "6", family: "2", address: "0.0.0.0" }], "synthetic-server-02": [{ pid: "12", port: "22", protocol: "6", family: "2", address: "0.0.0.0" }], "synthetic-server-03": "down" }), now: () => "2026-12-01T00:00:00Z" });
  assert(got.kind === "ok");
  const q = openEstateQuery(DATA, {}, got.value);
  const ok1 = q.query("select a.id, a.fleet, count(*) as ports from asset a join osquery_listening_ports p on p.asset = a.id group by a.id, a.fleet order by a.id");
  assert(ok1.kind === "ok");
  assertEquals(ok1.value.rows, [["synthetic-server-01", "synthetic-fleet-01", 2], ["synthetic-server-02", "synthetic-fleet-01", 1]]);
  const who = q.query("select asset, message from live_status where not answered");
  assert(who.kind === "ok");
  assertEquals(who.value.rows, [["synthetic-server-03", "unreachable: no route to host"]]);
  const near = q.query("select portt from osquery_listening_ports");
  assert(near.kind === "err" && near.error.kind === "refused" && near.error.reasons.join(" ").includes("port"), JSON.stringify(near));
  const absent = openEstateQuery(DATA).query("select * from osquery_processes");
  assert(absent.kind === "err", "a live table that was not asked for is not a relation");
  assertEquals(LIVE_STATUS.columns.length, 6);
});
