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
import { APPROVERS, RED_CAUSES, RELEASE_POLICY, releaseDecision, TOOLS } from "../src/ci/policy.ts";
import { execute, fileOfRun, parseRequest, runCommand } from "../src/ci/step.ts";
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
  const lint = parseOutput("lint", fixture("lint.txt"), ctx);
  assert(lint.some((f) => f.code === "no-var" && f.severity === "warning" && f.line === 2), "a lint warning keeps its severity and line");
  assert(lint.some((f) => f.code === "ifc/module-doc" && f.severity === "error"));
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
  assert(APPROVERS.includes("shah"));
});

proves([`${SPEC} FR-001`, `${SPEC} FR-008`], "the release publishes regardless until 2027-01-31 and, after it, does not proceed and carries the finding owner-review-due", () => {
  assertEquals(RELEASE_POLICY.until, "2027-01-31");
  assertEquals(releaseDecision("2026-11-22").proceed, true);
  assertEquals(releaseDecision("2027-01-31").proceed, true);
  const after = releaseDecision("2027-02-01");
  assertEquals(after.proceed, false);
  assert(!after.proceed && after.finding.code === "owner-review-due" && after.finding.severity === "error");
});
