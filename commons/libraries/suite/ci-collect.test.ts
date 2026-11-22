/**
 * The gathering of the findings of a workflow (commons 0002-libraries-ci-findings FR-006, 0038-build-policy FR-005, FR-011): the files that the steps wrote are merged with each finding once, the pipeline is not sound where a cell that ran left no file, and the real
 * program ends 2 for that and in no other case (a failing test in a cell is a finding and the program ends 0); the finding `owner-review-due` is added after the day of the release policy.
 *
 * @module
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectationProblems, mergeFiles, summaryText } from "../src/ci/collect.ts";
import { makeFinding, type FindingsFile } from "../src/ci/findings.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0002-libraries-ci-findings";
const RUN = { id: "7", workflow: "ci", commit: "abc", at: "2026-11-22T10:00:00Z" };
const f = (module: string, key: string) => makeFinding({ tool: "bun-test", code: "test-failed", module, severity: "error", message: key, key, evidence: { run: "7", commit: "abc", step: "s", logSha256: "0" }, at: RUN.at });
const step = (module: string, job = "verify") => ({ id: "verify", job, module, tool: "verify" as const, outcome: "findings" as const, findings: 1, durationMs: 1 });
const file = (module: string, keys: readonly string[]): FindingsFile => ({ schema: "build-findings/1", run: RUN, steps: [step(module)], findings: keys.map((k) => f(module, k)) });

proves([`${SPEC} FR-006`], "the files of the steps are merged with each finding once, and the pipeline is not sound only where a cell that ran left no file", () => {
  const merged = mergeFiles([file("core", ["a", "b"]), file("net", ["c"]), file("core", ["a"])], RUN);
  assertEquals(merged.findings.length, 3, "a finding read twice is one");
  assertEquals(merged.steps.length, 3);
  assertEquals(expectationProblems(merged, [{ job: "verify", modules: 2 }]), []);
  assertEquals(expectationProblems(merged, [{ job: "verify", modules: 3 }]).length, 1);
  assert(summaryText(merged).includes("3 findings") && summaryText(merged).includes("never a failed run"));
});

proves([`${SPEC} FR-006`], "the real program ends 0 where cells have failing tests and findings, 2 where a cell that ran left no file, and adds owner-review-due after the day of the release policy", () => {
  const dir = mkdtempSync(join(tmpdir(), "collect-"));
  try {
    const found = join(dir, "found");
    mkdirSync(found);
    writeFileSync(join(found, "verify.core.s.json"), JSON.stringify(file("core", ["a", "b", "c"])));
    writeFileSync(join(found, "verify.net.s.json"), JSON.stringify(file("net", ["z"])));
    const program = new URL("../src/ci/collect.ts", import.meta.url).pathname;
    const run = (args: readonly string[], env: Record<string, string> = {}) => spawnSync("bun", [program, ...args], { encoding: "utf8", env: { ...process.env, GITHUB_RUN_ID: "7", GITHUB_SHA: "abc", GITHUB_STEP_SUMMARY: join(dir, "summary.md"), ...env } });
    const ok = run(["--dir", found, "--out", join(dir, "out"), "--workflow", "ci", "--expect", "verify:2"]);
    assertEquals(ok.status, 0, ok.stderr + ok.stdout);
    assert(ok.stdout.includes("4 findings"), ok.stdout);
    const merged = JSON.parse(readFileSync(join(dir, "out", "findings.json"), "utf8")) as FindingsFile;
    assertEquals(merged.findings.length, 4);
    assert(readFileSync(join(dir, "summary.md"), "utf8").includes("Findings of ci"));
    const lost = run(["--dir", found, "--out", join(dir, "out2"), "--workflow", "ci", "--expect", "verify:3"]);
    assertEquals(lost.status, 2, "a cell that ran and left no file is the one red cause here");
    assert(lost.stderr.includes("reports-not-produced"), lost.stderr);
    const bad = run(["--dir", join(dir, "nothing"), "--out", join(dir, "out3"), "--workflow", "ci", "--expect", "verify:0"]);
    assertEquals(bad.status, 0, "nothing expected and nothing found is sound");
    // the policy review: the program takes the day from the clock, so the finding is shown by the function the program uses
    const outDate = execFileSync("bun", ["-e", `import { releaseDecision } from ${JSON.stringify(new URL("../src/ci/policy.ts", import.meta.url).pathname)}; console.log(JSON.stringify(releaseDecision("2027-02-01")))`], { encoding: "utf8" });
    assert(outDate.includes("owner-review-due"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
