/**
 * Tests of Estate Query (commons estate-query 0002-estate-query-relations, 0003-estate-query-run): the catalog made from the one list of relations and agreeing with every relation built, the rows of each relation against what the estate library says, a secret never given, the policies judged with the risks accepted, a question refused
 * with every reason (a change, two statements, an unknown name with the nearest, a function that sleeps), joins, grouping, common table expressions and values given apart, the budgets, and the three formats. Every name is made up.
 *
 * @module
 */
import { defineAsset, installOf, CAPABILITIES, type Asset } from "@intellectual-frontiers/estate/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { RELATIONS } from "../src/governance/mod.ts";
import { CATALOG, formatTable, fromSnapshot, openEstateQuery, tablesOf, type EstateData } from "../src/logical/mod.ts";

function asset(id: string, state: "discovered" | "adopted" | "managed", more: { origin?: "provisioned" | "paired" | "integration" | "self" } = {}): Asset {
  const all = Object.fromEntries(CAPABILITIES.map((c) => [c, "opsfolio"]));
  const owners = state === "managed" ? (more.origin === "paired" ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== "provision")) : all) : state === "adopted" ? { observe: "opsfolio", verify: "opsfolio" } : {};
  const r = defineAsset({ id, kind: "server", state, ...(more.origin === undefined ? {} : { origin: more.origin }), owners });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

const NOW = "2026-12-01T00:00:00Z";
const DATA: EstateData = {
  assets: [asset("athens", "managed"), asset("sparta", "managed", { origin: "paired" }), asset("corinth", "adopted", { origin: "paired" }), asset("printer", "discovered")],
  declared: { athens: { platform: { family: "debian", distro: "ubuntu", release: "26.04", arch: "x86_64" }, timezone: "America/New_York", tags: ["db", "prod"], adminPassword: "hunter2" }, sparta: { platform: "not an object" } },
  observations: [{ asset: "athens", observation: { at: "2026-11-30T00:00:00Z", source: "probe", state: { os: { family: "ubuntu", version: "26.04" }, apiToken: "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789ABCD", ports: [22, 5432] } } }],
  results: [{ asset: "athens", id: "ssh-root-login", status: "fail", controls: ["AC-6", "IA-2"] }, { asset: "athens", id: "disk-encryption", status: "pass", controls: ["SC-28"] }],
  acceptances: { athens: [{ policy: "ssh-root-login", reason: "a break-glass account, reviewed quarterly", by: "Ada", until: "2027-01-15" }] },
  truths: [{ asset: "athens", state: "managed", observedAt: "2026-11-30T00:00:00Z", currency: "fresh", difference: null, agrees: true, alignment: "aligned", source: "probe" }],
  violations: [{ invariant: "observed-asset-is-declared" as never, subject: "printer", message: "observed and never declared" }],
  changes: [{ commit: "a1", at: "2026-11-30T10:00:00Z", author: "Ada", subject: "172: take sparta over", refs: "#217", signed: true }, { commit: "b2", at: "2026-11-29T10:00:00Z", author: "Bob", subject: "tweak", refs: "", signed: false }],
  approvals: [{ asset: "sparta", kind: "manage", by: "Ada", planHash: `sha256:${"a".repeat(64)}`, at: "2026-11-30T10:00:00Z" }],
  fleets: { athens: "fcr", sparta: "fcr", corinth: "if" },
  now: NOW,
};

const rows = (sql: string, params: readonly (string | number | boolean | null)[] = [], data: EstateData = DATA) => {
  const r = openEstateQuery(data).query(sql, params);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value.rows;
};

proves(["0002-estate-query-relations FR-001", "0002-estate-query-relations FR-002", "0002-estate-query-relations FR-005"], "the catalog is made from the one list of relations, every relation is built with the columns of its description and rows as wide as the columns, and a relation is built once for a question", () => {
  assertEquals(Object.keys(CATALOG.tables).sort(), RELATIONS.map((r) => r.name).sort());
  const tables = tablesOf(DATA);
  for (const r of RELATIONS) {
    const t = tables[r.name]?.() ?? { columns: [], rows: [] };
    assertEquals([...t.columns], r.columns.map((c) => c.name), r.name);
    assert(t.rows.every((row) => row.length === r.columns.length), `${r.name}: every row is as wide as its columns`);
    assertEquals(Object.keys(CATALOG.tables[r.name]?.columns ?? {}), r.columns.map((c) => c.name));
  }
  let built = 0;
  const counting = { ...DATA, assets: new Proxy([...DATA.assets], { get(target, p, recv) { if (p === Symbol.iterator || p === "map" || p === "flatMap") built++; return Reflect.get(target, p, recv); } }) } as EstateData;
  openEstateQuery(counting).query("select a.id, b.id from asset a join asset b on a.id = b.id");
  assert(built <= 2, `the relation is built once (${built})`);
});

proves(["0002-estate-query-relations FR-002"], "asset and capability say what the estate library says, an inherited asset has no provision and a discovered one has no install, and the platform is read where it is declared", () => {
  assertEquals(rows("select id, fleet, state, origin, install from asset order by id"), [["athens", "fcr", "managed", "provisioned", "provisioned"], ["corinth", "if", "adopted", "paired", "inherited"], ["printer", "", "discovered", "", ""], ["sparta", "fcr", "managed", "paired", "inherited"]]);
  assertEquals(rows("select asset, offered, reason from capability where capability = 'provision' and asset in ('athens','sparta') order by asset").map((r) => [r[0], r[1], String(r[2]).includes("installed by someone else")]), [["athens", true, false], ["sparta", false, true]]);
  assertEquals(rows("select count(*) from capability where asset = 'athens' and offered"), [[10]]);
  assertEquals(rows("select asset, family, distro, release, arch, ansible from platform"), [["athens", "debian", "ubuntu", "26.04", "x86_64", ""]]);
  for (const a of DATA.assets) assertEquals(rows("select install from asset where id = ?", [String(a.id)])[0]?.[0], a.state === "discovered" ? "" : installOf(a));
});

proves(["0002-estate-query-relations FR-004"], "declared and observed are one row for each leaf, with a dotted path, and a value that looks like a secret is replaced, by what it is or by the name of its key", () => {
  const observed = rows("select path, value from observed where asset = 'athens' order by path");
  assertEquals(observed.map((r) => r[0]), ["apiToken", "os.family", "os.version", "ports.0", "ports.1"]);
  assertEquals(Object.fromEntries(observed.map((r) => [r[0], r[1]])), { apiToken: "[redacted: looks like a secret]", "os.family": "ubuntu", "os.version": "26.04", "ports.0": "22", "ports.1": "5432" });
  const declared = Object.fromEntries(rows("select path, value from declared where asset = 'athens'").map((r) => [r[0], r[1]]));
  assertEquals(declared["adminPassword"], "[redacted: looks like a secret]");
  assertEquals(declared["timezone"], "America/New_York");
  assertEquals(declared["tags.1"], "prod");
  const everything = JSON.stringify(RELATIONS.flatMap((r) => tablesOf(DATA)[r.name]?.().rows ?? []));
  assert(!everything.includes("hunter2") && !everything.includes("ghp_abcdef"), "no relation holds a secret");
});

proves(["0002-estate-query-relations FR-003"], "the policies are judged with the risks accepted, the controls and the risks and violations and truths are given, and an estate with nothing observed has no policy rows", () => {
  assertEquals(rows("select policy, status from policy_result order by policy"), [["disk-encryption", "pass"], ["ssh-root-login", "accepted"]]);
  assertEquals(rows("select control from policy_control where policy = 'ssh-root-login' order by control"), [["AC-6"], ["IA-2"]]);
  assertEquals(rows("select asset, policy, accepted_by, until from risk"), [["athens", "ssh-root-login", "Ada", "2027-01-15"]]);
  assertEquals(rows("select subject from violation"), [["printer"]]);
  assertEquals(rows("select commit, signed from change where not signed"), [["b2", false]]);
  assertEquals(rows("select a.asset, a.approved_by, c.refs from approval a join change c on c.at = a.at"), [["sparta", "Ada", "#217"]]);
  assertEquals(rows("select asset, currency, alignment, agrees from truth"), [["athens", "fresh", "aligned", true]]);
  const expired = rows("select status from policy_result where policy = 'ssh-root-login'", [], { ...DATA, now: "2027-02-01T00:00:00Z" });
  assertEquals(expired, [["fail"]], "an acceptance that has ended is a failure again");
  assertEquals(rows("select * from policy_result", [], { assets: DATA.assets, now: NOW }), []);
  assertEquals(rows("select * from observed", [], { assets: DATA.assets, now: NOW }), []);
});

proves(["0003-estate-query-run FR-001"], "a text is answered only where it is one statement that only reads, and every reason is given: a change, two statements, a relation or column that is not there with the nearest, a function that sleeps and a relation outside the list", () => {
  const q = openEstateQuery(DATA);
  const refused = (sql: string): readonly string[] => {
    const r = q.query(sql);
    assert(r.kind === "err" && r.error.kind === "refused", `${sql}: ${JSON.stringify(r)}`);
    return r.error.kind === "refused" ? r.error.reasons : [];
  };
  assert(refused("delete from asset").length > 0);
  assert(refused("drop table asset").length > 0);
  assert(refused("select 1; select 2").length > 0);
  assert(refused("").length > 0);
  assert(refused("select pg_sleep(10)").some((m) => m.includes("pg_sleep")));
  assert(refused("select * from assets").some((m) => m.includes("asset")), "the nearest name is said");
  assert(refused("select idd from asset").some((m) => m.includes("id")), "the nearest column is said");
  assert(refused("select * from sqlite_master").length > 0, "no relation outside the list");
  assertEquals(q.query("select 1 as n").kind, "ok", "a question with no relation reads nothing");
  const outside = q.query("with t as (select * from sqlite_master) select * from t");
  assert(outside.kind === "err", "a relation outside the list is never read, even through a common table expression");
});

proves(["0003-estate-query-run FR-002"], "a question is run with joins, grouping, a common table expression, a subquery and values given apart, and a value is never put into the text", () => {
  assertEquals(rows("select state, count(*) as n from asset group by state order by n desc, state"), [["managed", 2], ["adopted", 1], ["discovered", 1]]);
  assertEquals(rows("select a.id, c.owner from asset a join capability c on c.asset = a.id where c.capability = 'converge' and a.state = 'managed' order by a.id"), [["athens", "opsfolio"], ["sparta", "opsfolio"]]);
  assertEquals(rows("with inherited as (select id from asset where install = 'inherited') select id from inherited order by id"), [["corinth"], ["sparta"]]);
  assertEquals(rows("select id from asset where id not in (select asset from observation) order by id"), [["corinth"], ["printer"], ["sparta"]]);
  assertEquals(rows("select id from asset where state = ? and origin = $2", ["managed", "paired"]), [["sparta"]]);
  assertEquals(rows("select id from asset where id = ?", ["x' or '1'='1"]), [], "a value is a value");
});

proves(["0003-estate-query-run FR-003"], "a statement larger than allowed is refused and an answer with more rows than allowed is a problem, never a part given as the whole", () => {
  const small = openEstateQuery(DATA, { maxRows: 3 });
  const r = small.query("select asset, capability from capability");
  assert(r.kind === "err" && r.error.kind === "budget" && r.error.message.includes("ask for fewer"), JSON.stringify(r));
  assertEquals(small.query("select id from asset limit 3").kind, "ok");
  const tiny = openEstateQuery(DATA, { maxNodes: 5 });
  const t = tiny.query("select id, kind, state, origin from asset where id = 'athens' or id = 'sparta' or id = 'corinth'");
  assert(t.kind === "err" && t.error.kind === "refused");
});

proves(["0003-estate-query-run FR-004"], "a table is given as aligned text with its rows counted, as JSON in the order of its columns and as CSV with quotes where they are needed", () => {
  const t = { columns: ["id", "note"], rows: [["a", "plain"], ["b", 'has, comma and "quote"'], ["c", null]] };
  assertEquals(formatTable(t, "csv"), 'id,note\na,plain\nb,"has, comma and ""quote"""\nc,\n');
  assertEquals(JSON.parse(formatTable(t, "json")), [{ id: "a", note: "plain" }, { id: "b", note: 'has, comma and "quote"' }, { id: "c", note: null }]);
  const text = formatTable(t, "table");
  assert(text.startsWith("id  note") && text.includes("3 rows") && text.split("\n")[1]?.startsWith("--"), text);
  assert(formatTable({ columns: ["n"], rows: [[1]] }, "table").includes("1 row\n"));
});

proves(["0002-estate-query-relations FR-006"], "the estate of a snapshot of a fleet store is asked as the estate of files is, with what was assessed where it is given", () => {
  const snapshot = { assets: DATA.assets, declared: DATA.declared ?? {}, observations: DATA.observations ?? [], results: DATA.results ?? [], acceptances: DATA.acceptances ?? {}, manifest: { store: "x" }, findings: [], stable: true };
  const data = fromSnapshot(snapshot, NOW, { truths: DATA.truths ?? [], violations: DATA.violations ?? [] });
  assertEquals(rows("select policy, status from policy_result order by policy", [], data), rows("select policy, status from policy_result order by policy"));
  assertEquals(rows("select asset, currency from truth", [], data), [["athens", "fresh"]]);
  assertEquals(rows("select count(*) from truth", [], fromSnapshot(snapshot, NOW)), [[0]], "no truth where nothing was assessed");
});

function typed(id: string, kind: string, attributes: Record<string, string | number | boolean | readonly string[]>): Asset {
  const r = defineAsset({ id, kind, state: "discovered", owners: {}, attributes });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

proves(["0002-estate-query-relations FR-007"], "attribute, endpoint, link and service give the typed assets, the links and the services catalog, and a question joins an endpoint to its service and to what exposes it", () => {
  const data: EstateData = {
    assets: [
      asset("athens", "managed"),
      typed("portal", "application", { tier: "web", handles: ["cui", "fci"] }),
      typed("portal-https", "endpoint", { scheme: "https", host: "portal.example.test", exposure: "internet", authentication: "oauth" }),
      typed("db-direct", "endpoint", { scheme: "tcp", host: "10.0.0.5", service: "postgres", exposure: "internet", authentication: "unknown" }),
      typed("legacy-web", "endpoint", { scheme: "http", host: "old.example.test", port: 8080, exposure: "internet" }),
      typed("ftp-box", "endpoint", { scheme: "tcp", host: "10.0.0.9", service: "ftp", exposure: "partner" }),
    ],
    links: [{ from: "athens", to: "portal-https", kind: "exposes" }, { from: "athens", to: "db-direct", kind: "exposes" }, { from: "portal", to: "athens", kind: "runs-on" }],
    now: NOW,
  };
  assertEquals(rows("select asset, name, value from attribute where asset = 'portal' order by value", [], data), [["portal", "handles", "cui"], ["portal", "handles", "fci"], ["portal", "tier", "web"]]);
  assertEquals(rows("select asset, scheme, port, class, cleartext from endpoint order by asset", [], data), [
    ["db-direct", "tcp", 5432, "data", false],
    ["ftp-box", "tcp", 21, "file", true],
    ["legacy-web", "http", 8080, "", true],
    ["portal-https", "https", 443, "", false],
  ]);
  assertEquals(rows("select kind, count(*) from link group by kind order by kind", [], data), [["exposes", 2], ["runs-on", 1]]);
  assertEquals(rows("select name from service where port = 22 order by name", [], data), [["sftp"], ["ssh"]]);
  assertEquals(rows("select today, in_30_days, in_90_days from clock", [], data), [["2026-12-01", "2026-12-31", "2027-03-01"]]);
  // what a pen test scope or a passive check asks: the endpoints open to the internet that carry data or speak in the clear, and what exposes them
  const exposed = rows("select e.asset, l.from_asset from endpoint e left join link l on l.to_asset = e.asset and l.kind = 'exposes' where e.exposure = 'internet' and (e.class = 'data' or e.cleartext) order by e.asset", [], data);
  assertEquals(exposed, [["db-direct", "athens"], ["legacy-web", null]]);
  assertEquals(rows("select count(*) from endpoint", [], { assets: [], now: NOW }), [[0]]);
});
