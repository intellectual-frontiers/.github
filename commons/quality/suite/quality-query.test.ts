/**
 * Questions of the runs kept as evidence in SQL (commons quality 0002-quality-query): the runs and the cases made into relations, the questions a lead asks of a history of runs, the questions that are refused, and the command as it runs.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { GENESIS } from "../src/pure/primitives.ts";
import { canonicalize } from "../src/pure/record.ts";
import { type KeptRun, qualityCatalog, qualityRelations, queryRuns } from "../src/query/mod.ts";
import { queryCommand } from "../src/commands.ts";
import { keepRun } from "../src/host/branch.ts";
import { keptRuns } from "../src/host/runs.ts";
import { withTempDir } from "@intellectual-frontiers/system/fs";
import { assembledRun, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

async function kept(n: number, day: string, cases: Parameters<typeof assembledRun>[1]): Promise<KeptRun> {
  const c = await canonicalize({ record: await assembledRun(n, cases, { revision: `rev${n}` }), previous: GENESIS });
  assert(c.kind === "ok", "a run is made canonical");
  return { record: c.value.record, day, grade: "E1" };
}

const history = async (): Promise<readonly KeptRun[]> => [
  await kept(1, "2026-11-15", [{ name: "steady", requirements: ["R FR-001"] }, { name: "flaky", requirements: ["R FR-002"] }]),
  await kept(2, "2026-11-16", [{ name: "steady", requirements: ["R FR-001"] }, { name: "flaky", outcome: "fail", message: "boom", requirements: ["R FR-002"] }, { name: "later", outcome: "skip", reason: "no network" }]),
  await kept(3, "2026-11-17", [{ name: "steady", requirements: ["R FR-001"] }, { name: "flaky", requirements: ["R FR-002"] }]),
];

const rows = async (sql: string, params: readonly (string | number)[] = []) => {
  const r = queryRuns(await history(), sql, { params });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

proves(["0002-quality-query FR-001", "0002-quality-query FR-002"], "the runs, the cases and the requirements of the cases are relations with the columns of the catalog, one row for each run and case, with the duration of a case in milliseconds", async () => {
  const t = qualityRelations(await history());
  assertEquals(t["runs"]?.rows.length, 3);
  assertEquals(t["cases"]?.rows.length, 7);
  assertEquals(t["case_requirements"]?.rows.length, 6);
  for (const [name, table] of Object.entries(t)) assertEquals(table.columns, Object.keys(qualityCatalog().tables[name]?.columns ?? {}), name);
  assertEquals((await rows("SELECT revision, tests FROM runs ORDER BY day")).rows, [["rev1", 2], ["rev2", 3], ["rev3", 2]]);
  assertEquals((await rows("SELECT DISTINCT duration_ms FROM cases")).rows, [[12]]);
});

proves(["0002-quality-query FR-003"], "a lead's questions are one line of SQL each: the flaky tests, the cases that never ran with their reason, the failures of a requirement, a parameter; and a write, two statements and an unknown column are refused as values with the place", async () => {
  const flaky = await rows("SELECT name FROM cases GROUP BY name HAVING count(DISTINCT outcome) > 1 AND sum(CASE WHEN outcome = 'fail' THEN 1 ELSE 0 END) > 0");
  assertEquals(flaky.rows, [["flaky"]]);
  const skipped = (await rows("SELECT name, reason FROM cases WHERE outcome <> 'pass' AND outcome <> 'fail'")).rows;
  assertEquals(skipped, [["later", "no network"]]);
  const byReq = await rows("SELECT r.requirement, count(*) AS n FROM case_requirements r JOIN cases c ON c.trace_id = r.trace_id AND c.name = r.name WHERE c.outcome = 'fail' GROUP BY r.requirement");
  assertEquals(byReq.rows, [["R FR-002", 1]]);
  assertEquals((await rows("SELECT day FROM runs WHERE revision = ?", ["rev2"])).rows, [["2026-11-16"]]);
  const cut = queryRuns(await history(), "SELECT name FROM cases ORDER BY name", { limit: 2 });
  assert(cut.kind === "ok" && cut.value.rows.length === 2 && cut.value.truncated, "cut");
  for (const bad of ["DELETE FROM cases", "SELECT 1; SELECT 2", "SELECT nope FROM cases", "SELECT * FROM nowhere"]) assert(queryRuns([], bad).kind === "err", bad);
  const unknown = queryRuns([], "SELECT outcom FROM cases");
  assert(unknown.kind === "err" && unknown.error.includes("outcome"), unknown.kind === "err" ? unknown.error : "ok");
});

proves(["0002-quality-query FR-004", "0002-quality-query FR-005"], "the runs kept on the quality branch are read back for a question, a repository with no branch has no runs, and the command answers a read with 0 and refuses a write with 1", async () => {
  await withTempDir(async (repo) => {
    const tested = await repositoryWithCommit(repo);
    const none = await keptRuns(repo);
    assert(none.kind === "ok" && none.value.length === 0, "no branch, no runs");
    for (const n of [1, 2]) {
      const k = await keepRun({ repo, record: await assembledRun(n, [{ name: `case ${n}`, requirements: ["R FR-001"] }], { revision: tested }), sign: false });
      assert(k.kind === "ok", "a run is kept");
    }
    const runs = await keptRuns(repo);
    assert(runs.kind === "ok" && runs.value.length === 2, "two runs are read back");
    assertEquals(queryRuns(runs.kind === "ok" ? runs.value : [], "SELECT count(*) AS n FROM cases"), { kind: "ok", value: { columns: ["n"], rows: [[2]], truncated: false } });
    assertEquals(await queryCommand(["--repo", repo, "SELECT name FROM cases"]), 0);
    assertEquals(await queryCommand(["--repo", repo, "DELETE FROM cases"]), 1);
    assertEquals(await queryCommand(["--repo", repo, "--limit", "x", "SELECT 1"]), 2);
  });
}, needsGit);
