/**
 * Tests of the command `workbench` (commons workbench 0005-workbench-resolution FR-004, 0004-workbench-catalog FR-003, 0006-workbench-dialects FR-004), through its `main` with the synthetic contract: `ready` for a task with its
 * units and files, as a table and as JSON, the exit it ends with, `explain`, `project`, and the usage and environment endings.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/system";
import { main } from "@intellectual-frontiers/workbench/physical";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const HERE = path.dirname(path.fromFileUrl(import.meta.url));

async function run(argv: readonly string[], today = "2026-12-01") {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main([...argv, "--contract", "fixture.contract.ts"], { cwd: HERE, env: {}, today, out: (t) => void out.push(t), err: (t) => void err.push(t) });
  return { code, out: out.join(""), err: err.join("") };
}

proves(["0005-workbench-resolution FR-004"], "ready for a task names what that task needs and only that, as JSON too, and ends 0 before the day and 1 after it where an error is found, in CI as well", async () => {
  const sql = await run(["ready", "--for", "test", "--unit", "synthetic-sql", "--json"]);
  assertEquals(sql.code, 0, sql.err + sql.out);
  const doc = JSON.parse(sql.out) as { requirements: string[]; findings: { code: string; severity: string }[] };
  assertEquals(doc.requirements, ["git", "registry-token", "sql-install", "sqlite3"]);
  assert(doc.findings.every((f) => f.severity === "hint"), "before the day, hints only");
  const plain = await run(["ready", "--for", "test", "--unit", "synthetic-plain", "--json"]);
  assertEquals((JSON.parse(plain.out) as { requirements: string[] }).requirements, ["git", "registry-token"]);
  const later = await run(["ready"], "2027-02-01");
  assertEquals(later.code, 1);
  assertStringIncludes(later.out, "E-WB-WORKBENCH-MISSING-CREDENTIAL");
  assertEquals((await run(["ready", "--ci"])).code, 0, "before the day, CI is only told");
  assertEquals((await run(["ready", "--ci"], "2027-02-01")).code, 1, "from the day, CI fails on anything that is not a hint");
});

proves(["0004-workbench-catalog FR-003"], "explain says what a code is and, for a code that is none, says to classify it", async () => {
  const known = await run(["explain", "E-WB-WORKSHOP-MISSING-PROGRAM"]);
  assertEquals(known.code, 0);
  assertStringIncludes(known.out, "who fixes it: agent");
  const unknown = await run(["explain", "E-SOMETHING-NEW"]);
  assertEquals(unknown.code, 0);
  assertStringIncludes(unknown.out, "classify it");
});

proves(["0006-workbench-dialects FR-004"], "project prints the generated files, a matrix that has no finding ends 0, and a usage mistake ends 2 and a contract that is not there ends 3", async () => {
  const setup = await run(["project", "setup"]);
  assertEquals(setup.code, 0);
  assertStringIncludes(setup.out, "command -v git");
  assertEquals((await run(["project", "matrix"])).code, 0);
  assertStringIncludes((await run(["project", "dialect", "claude-code"])).out, ".claude/settings.json");
  assertEquals((await run(["project"])).code, 2);
  assertEquals((await run(["ready", "--for", "nonsense"])).code, 2);
  assertEquals((await run(["nonsense"])).code, 2);
  const missing: string[] = [];
  const code = await main(["ready", "--contract", "no-such.contract.ts"], { cwd: HERE, env: {}, today: "2026-12-01", out: () => undefined, err: (t) => void missing.push(t) });
  assertEquals(code, 3);
  assertStringIncludes(missing.join(""), "is not there");
});
