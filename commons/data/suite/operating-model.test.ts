// Spec: 0063-operating-model FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016
/**
 * The operating model (commons data 0063-operating-model), on SQLite, DuckDB and PostgreSQL, with synthetic fixtures from two domains: a hospital's nightly patient extract (waiting on a feed, a certificate that expires, a
 * decision replaced) and a batch extract for analytics (freshness of a source, a release promoted through four environments, a recorded workload replayed after a change).
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { allModules, defineArca, schemaOf } from "@intellectual-frontiers/data/sql/cli";
import { catalog, copyFindings, decisionsInForce, freshness, hashOf, limitsDue, parity, promote, realDataOutsideProduction, replayWorkload, resolveWait, sample, supersede, waitingOn } from "@intellectual-frontiers/data/sql/operations";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { insertInto, type Runner } from "@intellectual-frontiers/data/sql/typed";
import { flow, operations } from "@intellectual-frontiers/data/sql/typed/models";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const must = <T, E>(r: { kind: "ok"; value: T } | { kind: "err"; error: E }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error).slice(0, 400));
  return r.value;
};
async function world(name: Engine["name"]): Promise<{ e: Engine; on: Runner }> {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  const schema = must(schemaOf(defineArca({ models: ["operations", "flow"] } as never) as never)).schema;
  await load(e, must(bind(schema, { dialect })), ["setup", "table", "data"]);
  return { e, on: { driver: driverOf(e), dialect } };
}
const each = async (f: (w: { e: Engine; on: Runner }, name: string) => Promise<void>): Promise<void> => {
  for (const { name } of DIALECTS) {
    const w = await world(name);
    try {
      await f(w, name);
    } finally {
      await w.e.close();
    }
  }
};
const D = (d: string) => `${d}T00:00:00.000Z`;

proves(["0063-operating-model FR-001", "0063-operating-model FR-002", "0063-operating-model FR-003", "0063-operating-model FR-004", "0063-operating-model FR-005", "0063-operating-model FR-006", "0063-operating-model FR-007"], "the operations model has the waiting-on ledger, decision records that can replace one another, limits, the copy inventory, environments with releases and a promotion log that is only added to, workloads with their recorded statements, the signal catalog and the freshness rules, with closed code lists and every concept defined", () => {
  const m = allModules().find((x) => x.name === "operations");
  assert(m !== undefined, "the operations module is one of the models");
  same(m.concepts.map((c) => c.name), ["waiting", "decision", "limit", "dataCopy", "runtimeEnvironment", "release", "promotion", "workload", "workloadStatement", "signal", "freshnessRule"]);
  same(m.codeLists.map((l) => l.name), ["waitingStatus", "decisionStatus", "limitKind", "environmentKind", "signalKind"]);
  assert(m.concepts.find((c) => c.name === "promotion")!.annotations.some((a) => a.kind === "quality.appendOnly"), "the promotion log is only added to");
  assert(m.concepts.every((c) => c.definition.length > 30), "every concept is defined");
});

proves(["0063-operating-model FR-008"], "the waiting-on ledger lists what is open, the oldest first, as overdue once its date has passed, and drops what has come", async () => {
  await each(async ({ on }) => {
    const w = (id: string, what: string, who: string, since: string, by: string | null) => ({ waitingId: id, what, onWhom: who, since: D(since), neededBy: by === null ? null : D(by), status: "open", resolvedAt: null });
    await insertInto(operations.waiting).values([w("w1", "the lab feed's new layout", "lab vendor", "2025-02-01", "2025-02-20"), w("w2", "a read replica", "platform", "2025-02-10", null), w("w3", "signed data-sharing agreement", "legal", "2025-01-15", "2025-03-15")] as never).run(on);
    same((await waitingOn(on, D("2025-03-01"))).map((x) => [x.waitingId, x.status, x.daysWaiting]), [["w3", "waiting", 45], ["w1", "overdue", 28], ["w2", "waiting", 19]]);
    await resolveWait(on, "w1", D("2025-03-02"));
    same((await waitingOn(on, D("2025-03-03"))).map((x) => x.waitingId), ["w3", "w2"]);
  });
});

proves(["0063-operating-model FR-009"], "a decision that replaces another is accepted and says what it replaced, the replaced one is marked, and only accepted decisions are in force", async () => {
  await each(async ({ on }) => {
    const d = (id: string, status: string) => ({ decisionId: id, title: `decision ${id}`, context: "why", outcome: "what", consequences: null, status, decidedBy: null, decidedAt: null, supersedesDecisionId: null });
    await insertInto(operations.decision).values([d("d1", "accepted"), d("d2", "proposed"), d("d3", "proposed")] as never).run(on);
    await supersede(on, "d2", "d1");
    same(await decisionsInForce(on), ["d2"]);
  });
});

proves(["0063-operating-model FR-010"], "limits are found when the time to act has come: expired ones and ones within the days of notice their owner needs, the soonest first, and not those further off", async () => {
  await each(async ({ on }) => {
    const l = (id: string, kind: string, at: string | null, lead: number) => ({ limitId: id, name: id, kind, expiresAt: at === null ? null : D(at), owner: "platform", renewalLeadDays: lead });
    await insertInto(operations.limit).values([l("tls-cert", "certificate", "2025-03-20", 30), l("api-key", "credential", "2025-02-01", 14), l("warehouse-quota", "quota", "2025-12-01", 30), l("licence", "license", "2025-03-25", 7), l("no-end", "agreement", null, 30)] as never).run(on);
    same((await limitsDue(on, D("2025-03-01"))).map((x) => [x.limitId, x.status, x.daysLeft]), [["api-key", "expired", -28], ["tls-cert", "act-now", 19]]);
  });
});

proves(["0063-operating-model FR-011"], "copies of data with no owner, never refreshed or not refreshed within the days given are found, and a copy that is owned and fresh is not", async () => {
  await each(async ({ on }) => {
    const c = (id: string, owner: string | null, at: string | null) => ({ dataCopyId: id, dataset: "patients", location: `s3://${id}`, purpose: "analytics", owner, classification: "restricted", refreshedAt: at === null ? null : D(at) });
    await insertInto(operations.dataCopy).values([c("c1", "analytics", "2025-02-28"), c("c2", null, "2025-02-28"), c("c3", "analytics", null), c("c4", "analytics", "2024-11-01")] as never).run(on);
    same((await copyFindings(on, 30, D("2025-03-01"))).map((x) => [x.dataCopyId, x.why]), [["c2", "no owner"], ["c3", "never refreshed"], ["c4", "stale"]]);
  });
});

proves(["0063-operating-model FR-012", "0063-operating-model FR-013"], "a release is promoted only in the order of the environments and to production only with evidence, a refused promotion writes nothing, parity says which environments are behind, and real data outside production is found", async () => {
  await each(async ({ on }) => {
    const env = (id: string, kind: string, real: boolean) => ({ runtimeEnvironmentId: id, name: id, kind, holdsRealData: real, owner: "platform" });
    await insertInto(operations.runtimeEnvironment).values([env("dev", "development", false), env("test", "test", true), env("stage", "staging", false), env("prod", "production", true)] as never).run(on);
    const r = (id: string, v: string, ev: string | null) => ({ releaseId: id, artifact: "claims-extract", version: v, cutAt: D("2025-03-01"), evidenceRef: ev });
    await insertInto(operations.release).values([r("r1", "1.0.0", "run-41"), r("r2", "1.1.0", null)] as never).run(on);
    const p = (n: string, rel: string, e: string, at: string, ev?: string) => ({ promotionId: n, releaseId: rel, environmentId: e, by: "release-bot", at: D(at), ...(ev === undefined ? {} : { evidenceRef: ev }) });
    same((await promote(on, p("p1", "r1", "dev", "2025-03-01"))).kind, "promoted");
    same(await promote(on, p("p2", "r1", "stage", "2025-03-02")), { kind: "refused", why: "the release has not been in test" });
    same((await promote(on, p("p3", "r1", "test", "2025-03-02"))).kind, "promoted");
    same((await promote(on, p("p4", "r1", "stage", "2025-03-03"))).kind, "promoted");
    same((await promote(on, p("p5", "r1", "prod", "2025-03-04"))).kind, "promoted");
    await promote(on, p("q1", "r2", "dev", "2025-03-10"));
    await promote(on, p("q2", "r2", "test", "2025-03-11"));
    await promote(on, p("q3", "r2", "stage", "2025-03-12"));
    same(await promote(on, p("q4", "r2", "prod", "2025-03-13")), { kind: "refused", why: "a release goes to production with evidence" });
    same(await parity(on, "claims-extract"), { artifact: "claims-extract", versions: { dev: "1.1.0", prod: "1.0.0", stage: "1.1.0", test: "1.1.0" }, behind: ["dev", "stage", "test"] });
    same(await realDataOutsideProduction(on), ["test"]);
  });
});

proves(["0063-operating-model FR-014"], "a signal is made only as the catalog defines it: an unknown name, other attributes or a counter that goes down are refused, and a sample carries its kind and unit", async () => {
  await each(async ({ on }) => {
    await insertInto(operations.signal).values([
      { signalId: "load.rows", kind: "counter", unit: "rows", attributeNames: "source,outcome", meaning: "Rows a load handled", owner: "platform" },
      { signalId: "load.lag", kind: "gauge", unit: "s", attributeNames: "", meaning: "Seconds behind", owner: "platform" },
    ] as never).run(on);
    const defs = await catalog(on);
    same(sample(defs, "load.rows", 12, { source: "claims", outcome: "passed" }, D("2025-03-01")), { name: "load.rows", kind: "counter", unit: "rows", value: 12, attributes: { source: "claims", outcome: "passed" }, at: D("2025-03-01") });
    same(sample(defs, "load.lag", -3).value, -3);
    for (const bad of [() => sample(defs, "nope", 1), () => sample(defs, "load.rows", 1, { source: "claims" }), () => sample(defs, "load.rows", -1, { source: "a", outcome: "b" })]) {
      let refused = false;
      try {
        bad();
      } catch {
        refused = true;
      }
      assert(refused, "refused");
    }
  });
});

proves(["0063-operating-model FR-015"], "freshness is computed from the latest load of a source that was not undone: fresh within the hours, stale past them, never loaded where there is none", async () => {
  await each(async ({ on }) => {
    await insertInto(operations.freshnessRule).values([{ freshnessRuleId: "f1", source: "claims", maxAgeHours: 26, owner: "analytics" }, { freshnessRuleId: "f2", source: "labs", maxAgeHours: 6, owner: "analytics" }, { freshnessRuleId: "f3", source: "pharmacy", maxAgeHours: 24, owner: "analytics" }] as never).run(on);
    const l = (id: string, source: string, at: string, undone: string | null) => ({ loadId: id, loadType: "incremental", source, startedAt: at, tenant: null, rolledBackAt: undone });
    await insertInto(flow.load).values([l("l1", "claims", "2025-03-01T02:00:00.000Z", null), l("l2", "labs", "2025-03-01T01:00:00.000Z", null), l("l3", "labs", "2025-03-01T09:00:00.000Z", "2025-03-01T10:00:00.000Z")] as never).run(on);
    same((await freshness(on, "2025-03-02T01:00:00.000Z")).map((x) => [x.source, x.status, x.ageHours]), [["claims", "fresh", 23], ["labs", "stale", 24], ["pharmacy", "never-loaded", null]]);
  });
});

proves(["0063-operating-model FR-016"], "the recorded statements of a workload are replayed and compared with the rows and hash recorded: the same after no change, different after one, and anything but a single select is refused and not run", async () => {
  await each(async ({ on }) => {
    await insertInto(operations.workload).values([{ workloadId: "w1", name: "nightly-claims-mart", owner: "analytics", schedule: "0 2 * * *", criticality: 1 }] as never).run(on);
    const sql = "SELECT limit_id AS id FROM \"limit\" ORDER BY limit_id";
    const lim = (id: string) => ({ limitId: id, name: id, kind: "quota", expiresAt: null, owner: "platform", renewalLeadDays: 1 });
    await insertInto(operations.limit).values([lim("a"), lim("b")] as never).run(on);
    const base = await on.driver.query(sql);
    await insertInto(operations.workloadStatement).values([{ workloadStatementId: "s1", statement: sql, baselineRows: base.length, baselineHash: await hashOf(base), workloadId: "w1" }] as never).run(on);
    same((await replayWorkload(on, "w1")).map((r) => [r.rows, r.same]), [[2, true]]);
    await insertInto(operations.limit).values([lim("c")] as never).run(on);
    same((await replayWorkload(on, "w1")).map((r) => [r.rows, r.baselineRows, r.same]), [[3, 2, false]]);
    await insertInto(operations.workloadStatement).values([{ workloadStatementId: "s2", statement: "DELETE FROM \"limit\"", baselineRows: 0, baselineHash: "x", workloadId: "w1" }] as never).run(on);
    let refused = false;
    try {
      await replayWorkload(on, "w1");
    } catch {
      refused = true;
    }
    assert(refused, "a statement that is not a select is refused");
    same((await on.driver.query("SELECT count(*) AS n FROM \"limit\"")).map((r) => Number(r["n"])), [3]);
  });
});
