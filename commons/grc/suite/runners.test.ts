/**
 * Tests of the runners (0005-grc-runners): the port and `runCheck`, and each runner over a stand-in for what the host gives (a connection, a reader, a client, a remote, attestations, an
 * evaluator). The stand-ins are the structural interfaces themselves, so nothing is faked that the library defines; the conformance suite is run on every runner.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { runnerConformance } from "@intellectual-frontiers/grc/conformance";
import { attestation, type Attestation } from "@intellectual-frontiers/grc/logical";
import { createRunners, runCheck, runChecks, type RunContext, type Runner } from "@intellectual-frontiers/grc/physical";
import { apiRunner } from "@intellectual-frontiers/grc/runners/api";
import { createEvaluators, externalRunner } from "@intellectual-frontiers/grc/runners/external";
import { fileRunner, selectPointer } from "@intellectual-frontiers/grc/runners/file";
import { manualRunner } from "@intellectual-frontiers/grc/runners/manual";
import { remoteRunner } from "@intellectual-frontiers/grc/runners/remote";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { refusal, sqlRunner } from "@intellectual-frontiers/grc/runners/sql";
import { standardRunners } from "../src/standard.ts";
import { aCheck, AT, A1, evidencePolicyOf, must } from "./fixtures.ts";

const subject = { id: "host-1", platform: "linux" };
const ctx = (s = subject): RunContext => ({ subject: s, now: () => AT, timeoutMs: 1000 });
const withRunner = (kind: string, input: unknown, extra: Record<string, unknown> = {}) => aCheck(`c-${kind}`, [A1], { runner: { kind, input }, ...extra });

proves(["0005-grc-runners FR-001"], "a runner is registered by kind, a second of one kind is refused, and a runner gives an observation of data", async () => {
  const runners = createRunners();
  const conn = { readOnly: true, query: () => Promise.resolve([{ n: 1 }]) };
  assertEquals(runners.register(sqlRunner(conn)).kind, "ok");
  assertEquals(runners.register(sqlRunner(conn)).kind, "err");
  const o = await sqlRunner(conn).run(withRunner("sql", { query: "select 1" }), ctx());
  assertEquals(o.kind === "ok" ? [o.value.value, o.value.observedAt, o.value.via] : [], [[{ n: 1 }], AT, "sql"]);
});

proves(["0005-grc-runners FR-002", "0005-grc-runners FR-003"], "runCheck makes the result: not-applicable, an unknown kind, a throw and a timeout are results, and one failure does not stop the rest", async () => {
  const runners = createRunners();
  const conn = { readOnly: true, query: (q: string) => (q.includes("boom") ? Promise.reject(new Error("db down")) : q.includes("slow") ? new Promise<never>(() => undefined) : Promise.resolve([])) };
  runners.register(sqlRunner(conn));
  const good = await runCheck(runners, withRunner("sql", { query: "select 1 where 0" }), ctx());
  assertEquals([good.status, good.check, good.subject, good.severity], ["pass", "c-sql", "host-1", "medium"]);
  assertEquals((await runCheck(runners, withRunner("sql", { query: "select 1" }), ctx())).status, "pass");
  const rows = { readOnly: true, query: () => Promise.resolve([{ a: 1 }]) };
  const rowsRunners = createRunners();
  rowsRunners.register(sqlRunner(rows));
  const fail = await runCheck(rowsRunners, withRunner("sql", { query: "select 1" }), ctx());
  assertEquals(fail.status, "fail");
  const na = await runCheck(runners, withRunner("sql", { query: "select 1" }), ctx({ id: "w1", platform: "windows" }));
  assertEquals([na.status, na.reason.startsWith("the check applies to")], ["not-applicable", true]);
  const missing = await runCheck(runners, withRunner("nothing-registered", {}), ctx());
  assertEquals(missing.status, "error");
  assertStringIncludes(missing.reason, "nothing-registered");
  const thrown = await runCheck(runners, withRunner("sql", { query: "select boom" }), ctx());
  assertEquals([thrown.status, thrown.reason.includes("db down")], ["error", true]);
  const slow = await runCheck(runners, withRunner("sql", { query: "select slow" }), { ...ctx(), timeoutMs: 20 });
  assertEquals([slow.status, slow.reason.startsWith("timeout")], ["error", true]);
  const all = await runChecks(runners, [withRunner("sql", { query: "select boom" }), withRunner("sql", { query: "select 1 where 0" })], [subject, { id: "host-2", platform: "darwin" }], { now: () => AT, timeoutMs: 1000 });
  assertEquals(all.map((r) => r.status), ["error", "error", "pass", "pass"]);
});

proves(["0005-grc-runners FR-004"], "the sql runner needs a read-only connection and a single read, and imports no database library", async () => {
  const q = { query: "select 1" };
  const rw = await sqlRunner({ readOnly: false, query: () => Promise.resolve([]) }).run(withRunner("sql", q), ctx());
  assertEquals(rw.kind === "err" ? rw.error.message : "", "the connection is not read-only");
  for (const [text, why] of [
    ["select 1; drop table t", "2 statements"],
    ["delete from t", "delete"],
    ["with x as (select 1) delete from t", "delete"],
    ["select * into t2 from t", "INTO"],
    ["", "empty"],
    ["update t set a = 1", "update"],
  ] as const) assertStringIncludes(refusal(text) ?? "ok", why, text);
  assertStringIncludes(refusal("pragma journal_mode = wal", sqlite) ?? "ok", "sets", "a PRAGMA that sets");
  for (const fine of ["select 1", "SELECT 'a;b' ; ", "with x as (select 1) select * from x", "values (1)", "select 1 -- drop table t"]) assertEquals(refusal(fine), undefined, fine);
  assertEquals(refusal("pragma table_info(t)", sqlite), undefined, "a PRAGMA that reads");
  const viaDialect = await sqlRunner({ readOnly: true, dialect: sqlite, query: () => Promise.resolve([]) }).run(withRunner("sql", { query: "pragma journal_mode = wal" }), ctx());
  assertEquals(viaDialect.kind, "err");
  const bad = await sqlRunner({ readOnly: true, query: () => Promise.resolve([]) }).run(withRunner("sql", { nope: 1 }), ctx());
  assertEquals(bad.kind, "err");
  const unit = await fs.readTextFile(path.join(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src", "runners", "sql", "mod.ts"));
  assert(!/from "(?!@intellectual-frontiers\/(core|grc|lang-sql))/.test(unit), "the sql unit imports a database library");
});

proves(["0005-grc-runners FR-005"], "the file runner reads json, lines or text, selects by a JSON pointer, and a missing file is a problem", async () => {
  const files: Record<string, string> = { "/etc/a.json": '{"a":{"b/c":[10,20]},"t":"x"}', "/etc/l.txt": "one\ntwo\n" };
  const run = fileRunner({ read: (p) => Promise.resolve(files[p]) });
  const value = async (input: unknown) => {
    const r = await run.run(withRunner("file", input), ctx());
    return r.kind === "ok" ? r.value.value : r.error.kind;
  };
  assertEquals(await value({ path: "/etc/a.json", format: "json", select: "/a/b~1c/1" }), 20);
  assertEquals(await value({ path: "/etc/a.json", format: "json" }), { a: { "b/c": [10, 20] }, t: "x" });
  assertEquals(await value({ path: "/etc/l.txt", format: "lines" }), ["one", "two"]);
  assertEquals(await value({ path: "/etc/l.txt", format: "text" }), "one\ntwo\n");
  assertEquals(await value({ path: "/nope", format: "text" }), "unavailable");
  assertEquals(await value({ path: "/etc/a.json", format: "json", select: "/zzz" }), "failed");
  assertEquals(await value({ path: "/etc/l.txt", format: "json" }), "failed");
  assertEquals(await value({ format: "json" }), "refused");
  assertEquals(selectPointer({ a: [1] }, "/a/0"), ok(1));
  assertEquals(selectPointer({ a: 1 }, "a").kind, "err");
});

proves(["0005-grc-runners FR-006"], "the api runner makes a GET or HEAD call by a client and selects from the response", async () => {
  const calls: string[] = [];
  const run = apiRunner({ fetch: (r) => (calls.push(`${r.method} ${r.url}`), Promise.resolve({ status: 200, body: { ok: true, n: [1] } })) });
  const r = await run.run(withRunner("api", { method: "GET", url: "https://example.test/x", select: "/body/n/0" }), ctx());
  assertEquals(r.kind === "ok" ? r.value.value : null, 1);
  const whole = await run.run(withRunner("api", { method: "HEAD", url: "https://example.test/x" }), ctx());
  assertEquals(whole.kind === "ok" ? whole.value.value : null, { status: 200, body: { ok: true, n: [1] } });
  assertEquals((await run.run(withRunner("api", { method: "POST", url: "https://example.test/x" }), ctx())).kind, "err");
  assertEquals(calls, ["GET https://example.test/x", "HEAD https://example.test/x"]);
});

proves(["0005-grc-runners FR-007"], "the remote runner runs argv on a target by a remote and observes the code and the output", async () => {
  const run = remoteRunner({ exec: (t, argv) => Promise.resolve({ code: argv[0] === "false" ? 1 : 0, stdout: `${t}:${argv.join(" ")}`, stderr: "" }) });
  const r = await run.run(withRunner("remote", { target: "alpha", argv: ["uname", "-r"] }), ctx());
  assertEquals(r.kind === "ok" ? r.value.value : null, { code: 0, stdout: "alpha:uname -r", stderr: "" });
  assertEquals((await run.run(withRunner("remote", { target: "alpha", argv: "uname" }), ctx())).kind, "err");
});

function attest(role: string, claim: "pass" | "fail", at: string): Attestation {
  return must(attestation.decode, {
    kind: "grc.attestation", schema: "1", id: `a:${role}:${at}`, createdAt: at, provenance: { producer: { name: "t", version: "1" }, inputs: [] },
    subject: "host-1", check: "c-manual", claim, statement: `${role} says ${claim}`, attester: "someone", role, evidence: [],
  });
}

proves(["0005-grc-runners FR-008"], "the manual runner is pending until a role that may attest has attested within the longest age, and then follows the claim", async () => {
  let list: readonly Attestation[] = [];
  const runners = createRunners();
  runners.register(manualRunner(() => list, evidencePolicyOf));
  const check = withRunner("manual", {}, { expect: { kind: "equals", value: "pass" } });
  const status = async () => (await runCheck(runners, { ...check, id: "c-manual" }, ctx())).status;
  assertEquals(await status(), "pending");
  list = [attest("intern", "pass", "2026-05-30T00:00:00Z")];
  assertEquals(await status(), "pending");
  list = [attest("ciso", "pass", "2026-03-01T00:00:00Z")];
  assertEquals(await status(), "pending");
  list = [attest("ciso", "pass", "2026-05-30T00:00:00Z")];
  assertEquals(await status(), "pass");
  list = [attest("ciso", "pass", "2026-05-20T00:00:00Z"), attest("ciso", "fail", "2026-05-30T00:00:00Z")];
  assertEquals(await status(), "fail");
});

proves(["0005-grc-runners FR-009"], "the external runner delegates to an evaluator found by id and names an unknown one", async () => {
  const evaluators = createEvaluators();
  evaluators.register({ id: "double", evaluate: (policy, data) => Promise.resolve(typeof data === "number" && typeof policy === "number" ? ok(data * policy) : err("not numbers")) });
  const run = externalRunner(evaluators);
  const r = await run.run(withRunner("external", { evaluator: "double", policy: 2, data: 21 }), ctx());
  assertEquals(r.kind === "ok" ? r.value.value : null, 42);
  const bad = await run.run(withRunner("external", { evaluator: "double", policy: "x", data: 1 }), ctx());
  assertEquals(bad.kind === "err" ? bad.error.message : "", "not numbers");
  const unknown = await run.run(withRunner("external", { evaluator: "rego", policy: 1 }), ctx());
  assertStringIncludes(unknown.kind === "err" ? unknown.error.message : "", "rego");
  assertEquals(Object.keys(standardRunners({}).list()).length, 0);
  assertEquals(standardRunners({ evaluators }).list().map((x) => x.id), ["external"]);
});

proves(["0005-grc-runners FR-010"], "the conformance suite passes the runners of the library and fails a runner that is not deterministic or that throws", async () => {
  const conn = { readOnly: true, query: () => Promise.resolve([{ n: 1 }]) };
  assertEquals(await runnerConformance(sqlRunner(conn), [{ name: "rows", check: withRunner("sql", { query: "select 1" }), subject, expect: [{ n: 1 }] }]), []);
  assertEquals(await runnerConformance(fileRunner({ read: () => Promise.resolve("1") }), [{ name: "text", check: withRunner("file", { path: "/x", format: "text" }), subject, expect: "1" }]), []);
  let n = 0;
  const flaky: Runner = { id: "flaky", run: (_c, c) => Promise.resolve(ok({ value: n++, observedAt: c.now(), via: "t", tookMs: 0 })) };
  const f = await runnerConformance(flaky, [{ name: "n", check: withRunner("flaky", {}), subject, expect: 0 }]);
  assertEquals(f.length, 1);
  const boom: Runner = { id: "boom", run: () => Promise.reject(new Error("no")) };
  assertStringIncludes((await runnerConformance(boom, [{ name: "n", check: withRunner("boom", {}), subject, expect: 0 }]))[0]?.message ?? "", "threw");
  assertEquals(standardRunners({ sql: conn, file: { read: () => Promise.resolve("") } }).list().map((x) => x.id), ["file", "sql"]);
});
