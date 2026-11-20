// Spec: 0045-issues-model FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The issues model and its synchronisation (commons data 0045-issues-model), on real engines: the model composes alone and binds on every dialect; a sync adds, rewrites, withdraws and brings back
 * records to match the code, in one transaction, with a ledger; and it writes nothing where the records already match. DuckDB is left out of the sync: it cannot update a row that others refer to.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { composeModules, type Issue, issue, issueSet, type IssueSet, type IssueSpec } from "@intellectual-frontiers/data/governance";
import { issuesModule } from "@intellectual-frontiers/data/models/issues";
import { syncIssues } from "@intellectual-frontiers/data/sql/extensions/issues";
import { projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";

const domain = (() => {
  const r = composeModules("issuesapp", {}, [issuesModule]);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
})();
const schema = (() => {
  const p = projectDomain(domain);
  if (p.kind === "err") throw new Error(JSON.stringify(p.error));
  return p.value.schema;
})();
const SYNCING = DIALECTS.filter((d) => d.name !== "duckdb");
const dbWith = async (name: Engine["name"]): Promise<Engine> => {
  const e = await openEngine(name);
  const b = bind(schema, { dialect: DIALECTS.find((x) => x.name === name)!.dialect });
  assert(b.kind === "ok");
  if (b.kind === "ok") await load(e, b.value);
  return e;
};
const base: IssueSpec = { id: 1, slug: "first", title: "First", summary: "s", severity: "high", priority: "P1", goals: ["G1", "G2"], appliesTo: { engines: ["postgres"] }, status: { kind: "open" }, size: "m", raised: "2026-11-19" };
const mk = (over: Partial<IssueSpec> = {}): Issue => issue({ ...base, ...over });
const set = (...issues: Issue[]): IssueSet => issueSet("lib", issues);
const second = (over: Partial<IssueSpec> = {}): Issue =>
  mk({ id: 2, slug: "second", severity: "low", priority: "P3", goals: ["G5"], appliesTo: { engines: "all" }, status: { kind: "fixed", proof: [{ kind: "commit", sha: "abcdef1" }] }, evidence: [{ kind: "test", file: "a.test.ts", name: "t" }], links: [{ kind: "relates", to: 1 }], ...over });
let tick = 0;
const clock = { now: () => `2026-11-19T00:00:${String(++tick).padStart(2, "0")}.000Z`, newId: () => `run${++tick}` };
const sync = async (e: Engine, d: (typeof DIALECTS)[number], ...sets: IssueSet[]) => {
  const r = await syncIssues(driverOf(e), schema, d.dialect, sets, clock);
  if (r.kind === "err") throw new Error(`${d.name}: ${JSON.stringify(r.error)}`);
  return r.value;
};
const rows = (e: Engine, sql: string) => e.rows(sql);

proves(["0045-issues-model FR-001"], "the issues model composes alone and binds on every dialect", () => {
  same(issuesModule.requires, []);
  assert(schema.tables.length === 6);
  for (const d of DIALECTS) assert(bind(schema, { dialect: d.dialect }).kind === "ok", d.name);
});

proves(["0045-issues-model FR-002", "0045-issues-model FR-003"], "a sync adds what is new, rewrites what changed with its goals, engines, evidence and links, and records the run in a ledger", async () => {
  for (const d of SYNCING) {
    const e = await dbWith(d.name);
    const r1 = await sync(e, d, set(mk(), second()));
    same([r1[0]?.outcome, r1[0]?.inserted, r1[0]?.updated], ["synced", 2, 0], d.name);
    same((await rows(e, `SELECT "issue_id", "status_kind", "presence", "applies_to_all", "status_proof" FROM "issue" ORDER BY "number"`)).map((r) => [r["issue_id"], r["status_kind"], r["presence"], Boolean(r["applies_to_all"]), r["status_proof"]]), [
      ["lib#1", "open", "present", false, null],
      ["lib#2", "fixed", "present", true, "abcdef1"],
    ], d.name);
    same((await rows(e, `SELECT "goal" FROM "issue_goal" WHERE "issue_id" = 'lib#1' ORDER BY "goal"`)).map((r) => r["goal"]), ["g_1", "g_2"], d.name);
    same((await rows(e, `SELECT "engine" FROM "issue_engine"`)).map((r) => r["engine"]), ["postgres"], d.name);
    same((await rows(e, `SELECT "kind", "reference" FROM "issue_evidence"`)).map((r) => [r["kind"], r["reference"]]), [["test", "a.test.ts::t"]], d.name);
    same((await rows(e, `SELECT "kind", "target_issue_id" FROM "issue_link"`)).map((r) => [r["kind"], r["target_issue_id"]]), [["relates", "lib#1"]], d.name);
    // the first issue moves, its goals change: it is rewritten, the second is left alone
    const r2 = await sync(e, d, set(mk({ status: { kind: "in-progress" }, goals: ["G3"], severity: "critical" }), second()));
    same([r2[0]?.inserted, r2[0]?.updated, r2[0]?.unchanged], [0, 1, 1], d.name);
    same((await rows(e, `SELECT "status_kind", "severity" FROM "issue" WHERE "number" = 1`)).map((r) => [r["status_kind"], r["severity"]]), [["in_progress", "critical"]], d.name);
    same((await rows(e, `SELECT "goal" FROM "issue_goal" WHERE "issue_id" = 'lib#1'`)).map((r) => r["goal"]), ["g_3"], d.name);
    same((await rows(e, `SELECT "outcome", "inserted", "updated" FROM "issue_sync" ORDER BY "ran_at"`)).map((r) => [r["outcome"], Number(r["inserted"]), Number(r["updated"])]), [["synced", 2, 0], ["synced", 0, 1]], d.name);
  }
});

proves(["0045-issues-model FR-004"], "an issue the code no longer has is withdrawn and never deleted, and comes back, rewritten where it changed, when the code has it again", async () => {
  for (const d of SYNCING) {
    const e = await dbWith(d.name);
    await sync(e, d, set(mk(), second()));
    const gone = await sync(e, d, set(mk()));
    same([gone[0]?.withdrawn, gone[0]?.unchanged], [1, 1], d.name);
    same((await rows(e, `SELECT "number", "presence" FROM "issue" ORDER BY "number"`)).map((r) => [Number(r["number"]), r["presence"]]), [[1, "present"], [2, "withdrawn"]], d.name);
    assert(Number((await rows(e, `SELECT COUNT(*) AS n FROM "issue_evidence"`))[0]?.["n"]) === 1, "its evidence is kept");
    const back = await sync(e, d, set(mk(), second({ title: "Second, reworded" })));
    same([back[0]?.reopened, back[0]?.updated], [1, 1], d.name);
    same((await rows(e, `SELECT "presence", "title" FROM "issue" WHERE "number" = 2`)).map((r) => [r["presence"], r["title"]]), [["present", "Second, reworded"]], d.name);
    // withdrawing twice is one withdrawal
    await sync(e, d, set(mk()));
    same((await sync(e, d, set(mk())))[0]?.outcome, "unchanged", d.name);
  }
});

proves(["0045-issues-model FR-005"], "a sync of records that already match writes nothing, and a failure rolls back everything it did and is a value", async () => {
  for (const d of SYNCING) {
    const e = await dbWith(d.name);
    await sync(e, d, set(mk(), second()));
    const again = await sync(e, d, set(mk(), second()));
    same([again[0]?.outcome, again[0]?.unchanged], ["unchanged", 2], d.name);
    same(Number((await rows(e, `SELECT COUNT(*) AS n FROM "issue_sync"`))[0]?.["n"]), 1, "nothing was recorded");
    const recorded = await syncIssues(driverOf(e), schema, d.dialect, [set(mk(), second())], { ...clock, recordUnchanged: true });
    assert(recorded.kind === "ok");
    same(Number((await rows(e, `SELECT COUNT(*) AS n FROM "issue_sync"`))[0]?.["n"]), 2, "it was told to record it");
    // an issue whose link points at one that is not there fails the foreign key, and the whole run is undone
    const before = (await rows(e, `SELECT "content_hash" FROM "issue" ORDER BY "number"`)).map((r) => r["content_hash"]);
    const failed = await syncIssues(driverOf(e), schema, d.dialect, [set(mk({ title: "Changed" }), second({ links: [{ kind: "blocks", to: 9 }] }))], clock);
    assert(failed.kind === "err" && failed.error.kind === "database", d.name);
    same((await rows(e, `SELECT "content_hash" FROM "issue" ORDER BY "number"`)).map((r) => r["content_hash"]), before, "nothing of the failed run is left");
    same(Number((await rows(e, `SELECT COUNT(*) AS n FROM "issue_sync"`))[0]?.["n"]), 2);
  }
});
