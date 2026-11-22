/**
 * The findings of a run and the step wrapper (commons 0038-build-policy FR-002, FR-004, FR-006, FR-007, FR-008, FR-010, FR-013): the parsers read the real output of the tools, which is kept in `suite/fixtures/ci/` as the tools
 * printed it; the wrapper runs real processes (a command that fails, one that prints a failing test, one that does not end, one that does not exist) and is never red for what a command says; the status of a finding is derived from
 * the runs and the acceptances; the release policy decides on a day.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { mkdtempSync, readFileSync as readSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptanceProblems, countsOf, decodeFindingsFile, deriveRows, type FindingsFile, findingId, type Acceptance } from "../src/ci/findings.ts";
import { parseOutput, type ParseContext } from "../src/ci/parsers.ts";
import { APPROVERS, heldLibraries, RED_CAUSES, RELEASE_POLICY, releaseDecision, TOOLS } from "../src/ci/policy.ts";
import { gateReport } from "../src/ci/release-gate.ts";
import { execute, fileOfRun, parseRequest, runCommand, sectionsOf } from "../src/ci/step.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0002-libraries-ci-findings";
const fixture = (name: string): string => readFileSync(new URL(`./fixtures/ci/${name}`, import.meta.url), "utf8");
const ctx: ParseContext = { module: "core", run: "100", commit: "abc123", step: "verify", at: "2026-11-22T10:00:00Z" };

proves([`${SPEC} FR-001`], "the red causes are a closed list of four, each with its justification, and the tools of the parsers are a closed table", () => {
  assertEquals([...RED_CAUSES], ["workflow-invalid", "wrapper-misused", "plan-unavailable", "reports-not-produced"]);
  assert(TOOLS.includes("tsc") && TOOLS.includes("bun-test") && TOOLS.includes("policy"));
});

proves([`${SPEC} FR-003`], "each parser reads the real output of its tool into findings with the file, the line, the code and a key that is not a line", () => {
  const tsc = parseOutput("tsc", fixture("tsc.txt"), ctx);
  assertEquals(tsc.map((f) => [f.code, f.file, f.line]), [["TS2322", "src/ci/_tmp.ts", 1], ["TS6133", "src/ci/_tmp.ts", 1], ["TS2322", "src/ci/_tmp.ts", 2]]);
  const test = parseOutput("bun-test", fixture("bun-test.txt"), ctx);
  assertEquals(test.map((f) => f.key), ["a failing one for the capture", "another failing one"]);
  assertEquals(test[0]?.file, "suite/_fail.test.ts");
  assertEquals(parseOutput("bun-test", "::group::suite/demo-failing.test.ts:\n(fail) a demonstration: this test fails on purpose [0.4ms]\n", ctx)[0]?.file, "suite/demo-failing.test.ts", "a GitHub log's group marker is not part of the file (seen in a real run)");
  const lint = parseOutput("lint", fixture("lint.txt"), ctx);
  assert(lint.some((f) => f.code === "no-var" && f.severity === "warning" && f.line === 2), "a lint warning keeps its severity and line");
  assert(lint.some((f) => f.code === "ifc/module-doc" && f.severity === "error"));
  const lintCi = parseOutput("lint", fixture("lint-ci.txt"), ctx);
  assert(lintCi.length >= 3 && lintCi.every((f) => f.code === "@typescript-eslint/no-unnecessary-type-assertion" && f.file === "tests/commons-anyfs-merge-medium.test.ts" && f.severity === "error"), "the linter's report as a pipeline's log holds it (kept from a real run of this repository's CI)");
  const fmt = parseOutput("format", fixture("format.txt"), ctx);
  assertEquals(fmt.map((f) => f.file), ["tests/_tmp.ts", "tests/commons-kanon.test.ts"]);
  const rc = parseOutput("repoctl-check", fixture("repoctl-check.txt"), ctx);
  assertEquals(rc.map((f) => [f.code, f.file]), [["E-SPEC-KIT", "specs/0038-build-policy"], ["E-SPEC-KIT", "registry.tsv"]]);
  const mz = parseOutput("mizan-check", fixture("mizan-check.txt"), ctx);
  assertEquals(mz.length, 2);
  assert(mz.every((f) => f.code === "spec-format"));
  const gen = parseOutput("generated-files", fixture("generated-files.txt"), ctx);
  assert(gen.length >= 4 && gen.every((f) => f.code === "stale-generated" && f.file?.startsWith(".github/") === true));
  assertEquals(parseOutput("kanon-check", "tools/pack.ts:1: trace/unknown-spec: its Spec: line names 0001-x, which is no specification\nkanon-check: FAILED: 1 new", ctx).map((f) => [f.code, f.file, f.line]), [["trace/unknown-spec", "tools/pack.ts", 1]]);
  assertEquals(parseOutput("tsc", "all good\n", ctx).length, 0, "a parser says nothing where there is nothing");
  // seen in a real run: the tests of a library print what tsc prints for a broken fixture, after the library's own type check has passed
  const noisy = "$ tsc -p tsconfig.json && bun test suite/\nbun test v1.4.4 (abc)\n\nsuite/a.test.ts:\na.ts(3,1): error TS2322: no\n(fail) a real failure [1ms]\n";
  assertEquals(parseOutput("verify", noisy, ctx).map((f) => f.code), ["test-failed"], "a line of a test's own output is not a type error");
  assertEquals(parseOutput("verify", "src/x.ts(1,1): error TS2322: real\nbun test v1.4.4 (abc)\n", ctx).map((f) => f.code), ["TS2322"], "what precedes the runner is the type check's");
});

proves([`${SPEC} FR-002`], "the id of a finding is the same when the line, the run, the time or the message changes, and differs when the file or the key does", () => {
  const a = parseOutput("tsc", "a.ts(10,1): error TS2322: Type 'x' is not assignable", ctx)[0];
  const b = parseOutput("tsc", "a.ts(99,5): error TS2322: Type 'x' is not assignable", { ...ctx, run: "200", at: "2026-12-01T00:00:00Z" })[0];
  const c = parseOutput("tsc", "b.ts(10,1): error TS2322: Type 'x' is not assignable", ctx)[0];
  assertEquals(a?.id, b?.id);
  assert(a?.id !== c?.id);
  assertEquals(a?.id, findingId({ tool: "tsc", code: "TS2322", module: "core", file: "a.ts", key: "TS2322:Type 'x' is not assignable" }));
  assertEquals(decodeFindingsFile({ nope: 1 }).kind, "err");
});

proves([`${SPEC} FR-004`], "the wrapper runs a failing test command and exits as a green step with the failure as a finding, runs a command that prints nothing as no-output, one that does not exist as tool-error, and one that does not end as timeout", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ci-step-"));
  try {
    const req = (command: readonly string[], timeoutMinutes = 1) => ({ id: "s", job: "verify", module: "core", tool: "bun-test" as const, timeoutMinutes, out: dir, command });
    const quiet = () => undefined;
    const failing = await execute(req(["bash", "-c", `cat ${JSON.stringify(new URL("./fixtures/ci/bun-test.txt", import.meta.url).pathname)}; exit 1`]), {}, quiet);
    assertEquals(failing.steps[0]?.outcome, "findings");
    assertEquals(failing.findings.length, 2);
    const silent = await execute(req(["bash", "-c", "exit 3"]), {}, quiet);
    assertEquals([silent.steps[0]?.outcome, silent.findings[0]?.code], ["no-output", "no-output"]);
    const missing = await execute(req(["this-program-does-not-exist-anywhere"]), {}, quiet);
    assertEquals([missing.steps[0]?.outcome, missing.findings[0]?.code], ["tool-error", "tool-error"]);
    const ok = await execute(req(["bash", "-c", "echo fine"]), {}, quiet);
    assertEquals([ok.steps[0]?.outcome, ok.findings.length], ["ok", 0]);
    const wrote = decodeFindingsFile(JSON.parse(readSync(join(dir, "verify.core.s.json"), "utf8")));
    assertEquals(wrote.kind, "ok");
    // the time limit stops the command's whole process group (a fraction of a minute, so the test is short)
    const ran = await runCommand(["bash", "-c", "sleep 30 & sleep 30"], 0.02, quiet);
    assert(ran.timedOut && ran.durationMs < 10_000, "the command was stopped");
    const stopped = fileOfRun(req(["x"], 0.02), ran, { id: "1", workflow: "w", commit: "c", at: "2026-11-22T00:00:00Z" });
    assertEquals([stopped.steps[0]?.outcome, stopped.findings[0]?.code], ["timeout", "timeout"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

proves([`${SPEC} FR-004`], "the wrapper called wrongly is the one thing that is not green: no command, an unknown tool, a bad id, a timeout that is not a number", () => {
  assertEquals(parseRequest(["--id", "s"]).kind, "err");
  assertEquals(parseRequest(["--id", "s", "--job", "j", "--module", "m", "--tool", "tsc", "--timeout", "5", "--out", "o", "--"]).kind, "err");
  assertEquals(parseRequest(["--id", "s", "--job", "j", "--module", "m", "--tool", "nope", "--timeout", "5", "--out", "o", "--", "x"]).kind, "err");
  assertEquals(parseRequest(["--id", "bad id", "--job", "j", "--module", "m", "--tool", "tsc", "--timeout", "5", "--out", "o", "--", "x"]).kind, "err");
  assertEquals(parseRequest(["--id", "s", "--job", "j", "--module", "m", "--tool", "tsc", "--timeout", "zero", "--out", "o", "--", "x"]).kind, "err");
  assertEquals(parseRequest(["--id", "s", "--job", "j", "--module", "m", "--tool", "tsc", "--timeout", "5", "--out", "o", "--", "x", "y"]).kind, "ok");
});

const run = (id: string, at: string, steps: readonly string[], found: readonly (readonly [string, string])[]): FindingsFile => ({
  schema: "build-findings/1",
  run: { id, workflow: "ci", commit: id, at },
  steps: steps.map((module) => ({ id: "verify", job: "verify", module, tool: "tsc" as const, outcome: "ok" as const, findings: 0, durationMs: 1 })),
  findings: found.map(([module, key]) => parseOutput("tsc", `${key}.ts(1,1): error TS1: boom`, { ...ctx, module, run: id, at })[0]).filter((f) => f !== undefined),
});

proves([`${SPEC} FR-002`], "a finding is open where the latest run of its module has it, fixed where that run does not, and keeps its status where its module did not run", () => {
  const r1 = run("1", "2026-11-20T00:00:00Z", ["core", "net"], [["core", "a"], ["core", "b"], ["net", "n"]]);
  const r2 = run("2", "2026-11-21T00:00:00Z", ["core"], [["core", "a"]]);
  const rows = deriveRows([r1, r2], [], "2026-11-22");
  const by = (file: string) => rows.find((r) => r.finding.file === `${file}.ts`);
  assertEquals([by("a")?.status, by("a")?.runsSeen], ["open", 2]);
  assertEquals(by("b")?.status, "fixed", "core ran in the latest run without b");
  assertEquals(by("n")?.status, "open", "net did not run in the latest run: a cell that did not run is not clean");
  const c = countsOf(rows, [r1, r2]);
  assertEquals([c.open, c.fixed, c.fresh], [2, 1, 0]);
});

proves([`${SPEC} FR-002`], "an acceptance makes a finding accepted until its day, an acceptance that ended leaves it open with the note, and an acceptance that breaks the rules is not counted", () => {
  const r1 = run("1", "2026-11-20T00:00:00Z", ["core"], [["core", "a"]]);
  const id = r1.findings[0]?.id ?? "";
  const live: Acceptance = { id, owner: "core team", reason: "waiting on the release of the compiler", from: "2026-11-01", until: "2026-12-01", by: "shah" };
  assertEquals(deriveRows([r1], [live], "2026-11-22")[0]?.status, "accepted");
  const ended = deriveRows([r1], [live], "2026-12-02")[0];
  assertEquals(ended?.status, "open");
  assert(ended?.note?.includes("ended on 2026-12-01") === true);
  const byAgent: Acceptance = { ...live, by: "claude" };
  assert(acceptanceProblems(byAgent).some((p) => p.includes("not an approver")));
  assertEquals(deriveRows([r1], [byAgent], "2026-11-22")[0]?.status, "open", "an acceptance by an agent is not counted");
  assert(acceptanceProblems({ ...live, until: "2028-01-01" }).some((p) => p.includes("at most 366")));
  assert(acceptanceProblems({ ...live, reason: "ok" }).length > 0);
  assertEquals([...APPROVERS], ["shah"], "the approvers are the owner only (decided on 2026-11-22), as typed data");
});

proves([`${SPEC} FR-001`, `${SPEC} FR-008`], "the release publishes regardless until 2027-01-31 and, from 2027-02-01, holds per library for an open error and carries owner-review-due until the owner has reviewed", () => {
  assertEquals(RELEASE_POLICY.until, "2027-01-31");
  assertEquals(RELEASE_POLICY.then, { mode: "hold-critical", from: "2027-02-01" });
  assertEquals(releaseDecision("2026-11-22").proceed, true);
  const until = releaseDecision("2027-01-31");
  assertEquals(until.proceed && until.mode, "publish-regardless");
  const after = releaseDecision("2027-02-01");
  assertEquals(after.proceed, true, "nothing is held by the date itself: the libraries are");
  assert(after.mode === "hold-critical" && after.ownerReview?.code === "owner-review-due" && after.ownerReview.severity === "error" && after.ownerReview.module === "repository");
  const reviewed = releaseDecision("2027-02-01", { ...RELEASE_POLICY, reviewedOn: "2027-01-20" });
  assert(reviewed.mode === "hold-critical" && reviewed.ownerReview === undefined, "the finding stays until the owner has reviewed");
});

proves([`${SPEC} FR-010`], "from the day after the policy a library with an open error that is not accepted is held and the others go on; a warning, an accepted finding and a finding of the repository hold nothing; the single package is held while a library is", () => {
  const r1 = run("1", "2027-02-01T00:00:00Z", ["core", "net", "repository"], [["core", "a"], ["repository", "r"]]);
  const net = run("2", "2027-02-01T01:00:00Z", ["net"], []);
  const day = "2027-02-02";
  const gate = gateReport(day, [r1, net]);
  assertEquals(gate.held, ["core"], "core has an open error, net has none, and the repository holds no library");
  assertEquals(gate.proceed, false, "in single mode the one package is held while a library is");
  assert(gate.lines.some((l) => l.startsWith("held: core")) && gate.lines.some((l) => l.includes("owner-review-due")) && gate.lines.some((l) => l.includes("the distribution is single")));
  assertEquals(gateReport(day, [r1, net], "per-library").proceed, true, "per library the others are released and core is named held");
  assertEquals(heldLibraries([{ module: "core", severity: "warning" }, { module: "net", severity: "note" }, { module: "repository", severity: "error" }]), []);
  const before = gateReport("2027-01-31", [r1, net]);
  assertEquals([before.proceed, before.held], [true, []], "until the day of the policy nothing is held");
  assert(before.lines[0]?.includes("publish-regardless") === true);
});

proves([`${SPEC} FR-014`], "the root tests are read per file: the findings are of one module for each file, each file that ran is a step, and a file that stops failing is fixed while another keeps failing", () => {
  const out = ["tests/a.test.ts:", "(fail) a one [1.00ms]", "", "tests/b.test.ts:", "(pass) b one [1.00ms]", ""].join("\n");
  const ran = { output: out, exitStatus: 1, timedOut: false, durationMs: 5 };
  const req = { id: "root", job: "tests", module: "repository", tool: "bun-test" as const, timeoutMinutes: 10, out: "x", command: ["bun", "test"], perFile: true };
  const file = fileOfRun(req, ran, { id: "1", workflow: "tests", commit: "c", at: "2026-11-22T00:00:00Z" });
  assertEquals(file.findings.map((f) => [f.module, f.file]), [["repository/tests/a.test.ts", "tests/a.test.ts"]]);
  assertEquals(file.steps.map((s) => s.module), ["repository", "repository/tests/a.test.ts", "repository/tests/b.test.ts"]);
  const next = fileOfRun(req, { ...ran, output: ["tests/a.test.ts:", "(pass) a one [1.00ms]", "", "tests/b.test.ts:", "(fail) b one [1.00ms]"].join("\n") }, { id: "2", workflow: "tests", commit: "d", at: "2026-11-23T00:00:00Z" });
  const rows = deriveRows([file, next], [], "2026-11-23");
  assertEquals(rows.map((r) => [r.finding.module, r.status]).sort(), [["repository/tests/a.test.ts", "fixed"], ["repository/tests/b.test.ts", "open"]]);
  assertEquals(sectionsOf("noise\ntests/x.test.ts:\nline").map((s) => s.file), ["tests/x.test.ts"]);
});
