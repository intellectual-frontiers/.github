/**
 * Tests of the observation by osQuery (commons archon 0007-archon-observe-osquery FR-001 to FR-007): the pack of queries an order needs on each platform, the strict reading of what osQuery printed, what is
 * observed of each requirement from synthetic rows (Debian, Red Hat, Windows and Homebrew packages, users, groups, services, files, kernel settings), the drift as the plan, and the fallback for a platform with
 * no osQuery. Every row and name is made up; no real osQuery was run (0007 FR-008).
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  buildOrder,
  decodeRows,
  defineRequirement,
  driftOf,
  observedFromFacts,
  observedFromRows,
  parseSubjectName,
  planHashOf,
  planOf,
  quoteName,
  queryPackFor,
  type JsonValue,
  type Order,
  type OsRow,
  type RequirementInput,
} from "../src/mod.ts";

const must = <T, E>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

function orderOf(inputs: readonly (Partial<RequirementInput> & { readonly id: string })[]): Order {
  const requirements = inputs.map((i) => must(defineRequirement({ summary: "a made-up requirement.", why: ["a made-up reason"], subject: { by: "all" }, kind: "package", desired: { name: "synthetic-pkg-01" }, change: "additive", ...i })));
  return must(buildOrder({ subject: { name: must(parseSubjectName("synthetic-host-01.example.test")), class: "machine" }, assurance: "solo", layers: [{ layer: "baseline", requirements }] }));
}

const PKGS = orderOf([{ id: "r.git", desired: { name: "git", version: "2.39.2" } }, { id: "r.curl", desired: { name: "curl" } }, { id: "r.gone", desired: { name: "telnet" }, ensure: "absent", change: "destructive", rollback: "restore-from-backup" }]);
const rows = (...r: readonly OsRow[]): readonly OsRow[] => r;

proves(["0007-archon-observe-osquery FR-001", "0007-archon-observe-osquery FR-002"], "the pack has one query for each table the order needs, in the order of the table names, and maps each kind and platform to its tables", () => {
  const order = orderOf([
    { id: "r.git", desired: { name: "git" } },
    { id: "r.curl", desired: { name: "curl" } },
    { id: "r.user", kind: "user", desired: { name: "synthetic-user-01" } },
    { id: "r.group", kind: "group", desired: { name: "synthetic-group-01" } },
    { id: "r.ssh", kind: "service", desired: { name: "ssh", running: true, enabled: true } },
    { id: "r.file", kind: "file", desired: { path: "/etc/synthetic.conf", mode: "0644" } },
    { id: "r.sysctl", kind: "sysctl", desired: { name: "net.ipv4.ip_forward", value: "0" } },
    { id: "r.dns", kind: "dns-record", subject: { by: "class", class: "cloud-account" }, desired: { name: "www" } },
  ]);
  const tables = (p: Parameters<typeof queryPackFor>[1]) => must(queryPackFor(order, p)).queries.map((q) => q.table);
  assertEquals(tables("debian"), ["deb_packages", "file", "groups", "system_controls", "systemd_units", "users"]);
  assertEquals(tables("redhat"), ["file", "groups", "rpm_packages", "system_controls", "systemd_units", "users"]);
  assertEquals(tables("suse").includes("rpm_packages"), true);
  assertEquals(tables("alpine").includes("apk_packages"), true);
  assertEquals(tables("macos").includes("homebrew_packages") && tables("macos").includes("launchd"), true);
  assertEquals(tables("windows").includes("programs") && tables("windows").includes("services"), true);
  const deb = must(queryPackFor(order, "debian")).queries.find((q) => q.table === "deb_packages");
  assertEquals(deb?.sql, "SELECT name, version, arch FROM deb_packages WHERE name IN ('curl', 'git');");
  assertEquals(must(queryPackFor(order, "debian")).queries.find((q) => q.table === "systemd_units")?.sql, "SELECT id, active_state, sub_state, unit_file_state FROM systemd_units WHERE id IN ('ssh', 'ssh.service');");
  assertEquals(must(queryPackFor(order, "debian")), must(queryPackFor(order, "debian")));
  assertEquals(must(queryPackFor(orderOf([]), "debian")).queries, []);
  const reg = orderOf([{ id: "r.reg", kind: "system-setting", desired: { registry: "HKEY_LOCAL_MACHINE\\SOFTWARE\\Synthetic\\Key", value: "1" } }]);
  assertEquals(must(queryPackFor(reg, "windows")).queries.map((q) => q.table), ["registry"]);
  assertEquals(must(queryPackFor(reg, "debian")).queries, []);
});

proves(["0007-archon-observe-osquery FR-003"], "a name is put in a query only from a closed set of characters, and a requirement cannot inject text", () => {
  assertEquals(quoteName("git"), { kind: "ok", value: "'git'" });
  assertEquals(quoteName("C:\\Program Files\\synthetic").kind, "ok");
  for (const bad of ["it's", "a;b", "x\ny", "", "a\"b", "`x`", "$(x)", "%"]) assertEquals(quoteName(bad).kind, "err", bad);
  const evil = orderOf([{ id: "r.evil", desired: { name: "git'); DROP TABLE users; --" } }]);
  const refused = queryPackFor(evil, "debian");
  assert(refused.kind === "err" && refused.error[0]?.startsWith("r.evil:"));
});

proves(["0007-archon-observe-osquery FR-004"], "the output of osqueryi is read strictly: an array of objects of strings, or the path of what is not", () => {
  assertEquals(decodeRows('[{"name":"git","version":"1:2.39.2-1"}]'), { kind: "ok", value: [{ name: "git", version: "1:2.39.2-1" }] });
  assertEquals(decodeRows("[]"), { kind: "ok", value: [] });
  const number = decodeRows('[{"name":"git","version":2}]');
  assert(number.kind === "err" && number.error.includes("$[0].version"), JSON.stringify(number));
  assertEquals(decodeRows('{"name":"git"}').kind, "err");
  assertEquals(decodeRows('["git"]').kind, "err");
  assertEquals(decodeRows("not json").kind, "err");
});

proves(["0007-archon-observe-osquery FR-005"], "what is observed of a requirement is read from the rows of its table: Debian, Red Hat, Windows and Homebrew packages, and a requirement no row names is unobserved", () => {
  const deb = new Map([["deb_packages", rows({ name: "git", version: "1:2.39.2-1", arch: "amd64" }, { name: "curl", version: "7.88", arch: "amd64" })]]);
  const idOf = (n: string) => PKGS.requirements.find((r) => String(r.id) === n)!.id;
  const seen = observedFromRows(PKGS, deb);
  assertEquals([...seen.keys()].map(String).sort(), ["r.curl", "r.git"]);
  assertEquals(seen.get(idOf("r.git")), { name: "git", version: "2.39.2" }, "the epoch and revision of Debian are not a difference");
  const older = observedFromRows(PKGS, new Map([["deb_packages", rows({ name: "git", version: "2.30.0-1" })]]));
  assertEquals(older.get(idOf("r.git")), { name: "git", version: "2.30.0-1" });
  const rpm = observedFromRows(PKGS, new Map([["rpm_packages", rows({ name: "git", version: "2.39.2", release: "1.el9" })]]));
  assertEquals(rpm.get(idOf("r.git")), { name: "git", version: "2.39.2" });
  const win = orderOf([{ id: "r.tool", desired: { name: "Synthetic Tool", version: "1.2.3" } }]);
  assertEquals([...observedFromRows(win, new Map([["programs", rows({ name: "Synthetic Tool", version: "1.2.3" })]])).values()], [{ name: "Synthetic Tool", version: "1.2.3" }]);
  const brew = observedFromRows(orderOf([{ id: "r.jq", desired: { name: "jq" } }]), new Map([["homebrew_packages", rows({ name: "jq", version: "1.7" })]]));
  assertEquals([...brew.values()], [{ name: "jq" }]);
  assertEquals(observedFromRows(PKGS, new Map([["deb_packages", []]])).size, 0);
  const more = orderOf([
    { id: "r.user", kind: "user", desired: { name: "synthetic-user-01", uid: 1001, shell: "/bin/bash" } },
    { id: "r.group", kind: "group", desired: { name: "synthetic-group-01", gid: 2001 } },
    { id: "r.ssh", kind: "service", desired: { name: "ssh", running: true, enabled: true } },
    { id: "r.file", kind: "file", desired: { path: "/etc/synthetic.conf", mode: "0644" } },
    { id: "r.dir", kind: "directory", desired: { path: "/srv/synthetic" } },
    { id: "r.sysctl", kind: "sysctl", desired: { name: "net.ipv4.ip_forward", value: "0" } },
  ]);
  const all = observedFromRows(more, new Map([
    ["users", rows({ username: "synthetic-user-01", uid: "1002", gid: "1002", shell: "/bin/bash", directory: "/home/synthetic-user-01" })],
    ["groups", rows({ groupname: "synthetic-group-01", gid: "2001" })],
    ["systemd_units", rows({ id: "ssh.service", active_state: "active", sub_state: "running", unit_file_state: "disabled" })],
    ["file", rows({ path: "/etc/synthetic.conf", type: "regular", mode: "0600" }, { path: "/srv/synthetic", type: "directory", mode: "0755" })],
    ["system_controls", rows({ name: "net.ipv4.ip_forward", current_value: "1" })],
  ]));
  const get = (id: string) => [...all.entries()].find(([k]) => String(k) === id)?.[1];
  assertEquals(get("r.user"), { name: "synthetic-user-01", uid: 1002, shell: "/bin/bash" });
  assertEquals(get("r.group"), { name: "synthetic-group-01", gid: 2001 });
  assertEquals(get("r.ssh"), { name: "ssh", running: true, enabled: false });
  assertEquals(get("r.file"), { path: "/etc/synthetic.conf", mode: "0600" });
  assertEquals(get("r.dir"), { path: "/srv/synthetic" });
  assertEquals(get("r.sysctl"), { name: "net.ipv4.ip_forward", value: "1" });
});

proves(["0007-archon-observe-osquery FR-006"], "drift is desired versus rows: it is the plan and has the hash the reconcile loop makes, and a package that must be absent with no row is converged", async () => {
  const rowsOf = new Map([["deb_packages", rows({ name: "git", version: "2.30.0-1" }, { name: "telnet", version: "0.17" })]]);
  const drift = driftOf(PKGS, rowsOf);
  assertEquals(drift.entries.map((e) => `${e.id}:${e.action}`).sort(), ["r.curl:create", "r.git:update", "r.gone:remove"]);
  assertEquals(await planHashOf(drift), await planHashOf(planOf(PKGS, observedFromRows(PKGS, rowsOf))));
  const converged = driftOf(PKGS, new Map([["deb_packages", rows({ name: "git", version: "1:2.39.2-1" }, { name: "curl", version: "7" })]]));
  assertEquals(converged.entries.map((e) => e.action), ["none", "none", "none"]);
  assertEquals(converged.changes, []);
});

proves(["0007-archon-observe-osquery FR-007"], "the fallback gives the same observed state for packages as the rows of osQuery do", () => {
  const facts = [{ name: "git", version: "1:2.39.2-1" }, { name: "curl", version: "7.88" }];
  const viaRows = observedFromRows(PKGS, new Map([["deb_packages", rows(...facts)]]));
  assertEquals(observedFromFacts(PKGS, facts), viaRows);
  const other = orderOf([{ id: "r.user", kind: "user", desired: { name: "synthetic-user-01" } }]);
  assertEquals(observedFromFacts(other, facts).size, 0);
  const json: JsonValue = [...observedFromFacts(PKGS, []).values()];
  assertEquals(json, []);
});

proves(["0007-archon-observe-osquery FR-008", "0007-archon-observe-osquery FR-004", "0007-archon-observe-osquery FR-005"], "a capture of the real output of osqueryi 5.12.1 on Debian decodes strictly and is observed as the order wants it", async () => {
  const capture = JSON.parse(await fs.readTextFile(path.join(path.dirname(path.fromFileUrl(import.meta.url)), "fixtures", "osquery-5.12.1-debian-trixie.json"))) as { queries: Record<string, { sql: string; output: string }> };
  const rowsOf = new Map<string, readonly OsRow[]>();
  for (const [table, q] of Object.entries(capture.queries)) rowsOf.set(table, must(decodeRows(q.output)));
  const order = orderOf([
    { id: "r.bash", desired: { name: "bash", version: "5.2.37-2+b10" } },
    { id: "r.missing", desired: { name: "nonexistent-pkg" } },
    { id: "r.root", kind: "user", desired: { name: "root", uid: 0, shell: "/bin/bash", home: "/root" } },
    { id: "r.group", kind: "group", desired: { name: "root", gid: 0 } },
    { id: "r.passwd", kind: "file", desired: { path: "/etc/passwd", mode: "0644" } },
    { id: "r.etc", kind: "directory", desired: { path: "/etc" } },
  ]);
  const pack = must(queryPackFor(order, "debian"));
  assertEquals(pack.queries.map((q) => q.table), Object.keys(capture.queries).sort(), "the pack asks of the tables the capture was made of");
  for (const q of pack.queries) assert(q.sql.startsWith(capture.queries[q.table]?.sql.split(" WHERE ")[0] ?? "?"), `the pack selects what the capture selected: ${q.table}`);
  const plan = driftOf(order, rowsOf, "debian");
  assertEquals(plan.entries.map((e) => `${e.id}:${e.action}`).sort(), ["r.bash:none", "r.etc:none", "r.group:none", "r.missing:create", "r.passwd:none", "r.root:none"]);
});
