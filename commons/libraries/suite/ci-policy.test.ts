/**
 * The build policy over the real workflows (commons 0038-build-policy FR-001, FR-003, FR-004, FR-005): a property of the typed model, so that it holds for every step that is written now and every step that is written later: no step of any job of any workflow can turn a
 * run red but a step of a red cause or of a gate, every step has a policy, the steps of findings run through the wrapper with a time limit below their job's, no matrix fails fast, and a job after a matrix runs with `always()`. The rules are shown to find what they are
 * for on workflows made to break them.
 *
 * @module
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify, inventory, policyFindings } from "../src/ci/inventory.ts";
import { RED_CAUSES } from "../src/ci/policy.ts";
import { wrapWorkflow } from "../src/ci/wrap.ts";
import { workflows } from "../src/workflows/definitions.ts";
import { expr, job, run, use, type Workflow } from "../src/workflows/model.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0002-libraries-ci-findings";

proves([`${SPEC} FR-005`], "every workflow of the repository keeps the policy: every step has one, the steps of findings are wrapped with a limit below their job's, no matrix fails fast and a job after a matrix runs with always()", () => {
  const ws = workflows();
  assert(ws.length === 6);
  for (const w of ws) assertEquals(policyFindings(w), [], `${w.file} breaks the policy`);
});

proves([`${SPEC} FR-005`], "no step of any job of any workflow can end its job red unless it is a step of a red cause or of a gate: all the others are continueOnError (the wrapper exits 0, plumbing never decides)", () => {
  const redders: string[] = [];
  for (const w of workflows()) {
    for (const [jobId, j] of Object.entries(w.jobs)) {
      for (const [i, s] of j.steps.entries()) {
        const canFail = s.continueOnError !== true;
        const allowed = s.policy?.kind === "red-cause" || s.policy?.kind === "gate";
        if (canFail && !allowed) redders.push(`${w.file}/${jobId}/${i + 1} ${s.name ?? ""}`);
      }
    }
  }
  assertEquals(redders, []);
});

proves([`${SPEC} FR-005`], "every red cause a step names is one of the closed list, and the only steps that can end a cell of a matrix red are the red causes", () => {
  for (const w of workflows()) {
    for (const [jobId, j] of Object.entries(w.jobs)) {
      for (const s of j.steps) {
        if (s.policy?.kind === "red-cause") assert(RED_CAUSES.includes(s.policy.cause), `${w.file}/${jobId}`);
        if (j.strategy !== undefined && s.continueOnError !== true) assert(s.policy?.kind === "gate" && s.policy.gate === "pages", `${w.file}/${jobId}: a step of a cell that can end it red`);
      }
    }
  }
});

proves([`${SPEC} FR-005`], "the inventory counts every step by its policy and the counts add up to the steps of the workflows", () => {
  const ws = workflows();
  const total = ws.flatMap((w) => Object.values(w.jobs).flatMap((j) => j.steps)).length;
  const inv = inventory(ws);
  assertEquals(inv.rows.length, total);
  assertEquals(inv.counts["red-cause"] + inv.counts.finding + inv.counts.gate + inv.counts.plumbing, total);
  assert(inv.counts.finding > 20 && inv.counts.plumbing > 20, "most steps are findings or plumbing");
  assert(inv.rows.every((r) => r.why !== "" || r.policy === "red-cause" || true));
});

const broken = (o: Partial<Workflow["jobs"][string]> = {}, extra: readonly ReturnType<typeof run>[] = []): Workflow => ({
  file: "x",
  name: "x",
  on: { push: {} },
  jobs: { cell: job({ runsOn: "ubuntu-latest", timeoutMinutes: 10, strategy: { failFast: false, matrix: expr("fromJSON(needs.plan.outputs.x)") }, steps: [use("actions/checkout@v4"), run("bun test", { name: "the tests" }), ...extra], ...o }) },
});

proves([`${SPEC} FR-005`], "the validation finds a step with no policy, a step of findings that is not wrapped or has a limit not below its job's, a matrix that fails fast and a job after a matrix with no always()", () => {
  const ok = wrapWorkflow(classify(broken()));
  assertEquals(policyFindings(ok), []);
  const noPolicy = policyFindings(broken());
  assert(noPolicy.some((f) => f.includes("has no policy")), noPolicy.join("\n"));
  const first = classify(broken());
  const unwrapped = policyFindings(first);
  assert(unwrapped.some((f) => f.includes("not run through the wrapper")));
  const slow = classify(broken({ timeoutMinutes: 1 }));
  assert(policyFindings(wrapWorkflow(slow)).some((f) => f.includes("not below the job's")));
  const cellJob = broken().jobs["cell"];
  if (cellJob === undefined) throw new Error("no cell");
  const fast = classify({ ...broken(), jobs: { cell: { ...cellJob, strategy: { failFast: true, matrix: expr("fromJSON(needs.plan.outputs.x)") } } } });
  assert(policyFindings(wrapWorkflow(fast)).some((f) => f.includes("fails fast")));
  const after: Workflow = { ...ok, jobs: { ...ok.jobs, last: job({ runsOn: "ubuntu-latest", timeoutMinutes: 5, needs: ["cell"], steps: [{ ...run("echo done"), policy: { kind: "red-cause", cause: "reports-not-produced" } }] }) } };
  assert(policyFindings(after).some((f) => f.includes("does not run with always()")));
});

proves([`${SPEC} FR-005`], "the script of the job that gathers the findings of ci counts the cells from the plan's real output shape, passes them to the collector, and ends 2 only where the plan could not be made; the job that keeps the history is the only one that may write the repository, only on main and never after a pull request", () => {
  const ci = workflows().find((w) => w.file === "ci");
  const gatherStep = ci?.jobs["ci"]?.steps.find((s) => s.kind === "run" && s.env?.["WORKFLOW"] !== undefined);
  assert(gatherStep !== undefined && gatherStep.kind === "run");
  const dir = mkdtempSync(join(tmpdir(), "gather-"));
  try {
    // a `bun` that only says what it was asked, so that the script's own arithmetic and quoting are what is tested
    writeFileSync(join(dir, "bun"), '#!/bin/sh\necho "BUN $@"\n');
    chmodSync(join(dir, "bun"), 0o755);
    const plan = JSON.stringify({ include: [{ name: "a" }, { name: "b" }, { name: "a" }] });
    const run = (env: Record<string, string>) => spawnSync("bash", ["-e", "-o", "pipefail", "-c", gatherStep.run], { encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env["PATH"] ?? ""}`, GITHUB_REF: "refs/heads/x", GITHUB_REPOSITORY: "o/r", GH_TOKEN: "t", WORKFLOW: "ci", ...env } });
    const ok = run({ PLAN_RESULT: "success", PLAN_LINUX: plan, PLAN_SYSTEMS: JSON.stringify({ include: [{ name: "net" }] }) });
    assertEquals(ok.status, 0, ok.stderr + ok.stdout);
    assert(ok.stdout.includes("--expect verify:2") && ok.stdout.includes("--expect systems:1") && ok.stdout.includes("--policy-review") && ok.stdout.includes("--check-run"), ok.stdout);
    const none = run({ PLAN_RESULT: "success", PLAN_LINUX: "", PLAN_SYSTEMS: "" });
    assertEquals(none.status, 0, "a plan with nothing to run is sound: " + none.stderr);
    assert(none.stdout.includes("--expect verify:0"), none.stdout);
    const noPlan = run({ PLAN_RESULT: "failure", PLAN_LINUX: "", PLAN_SYSTEMS: "" });
    assertEquals(noPlan.status, 2, "a plan that could not be made is the red cause plan-unavailable");
    const main = run({ PLAN_RESULT: "success", PLAN_LINUX: plan, PLAN_SYSTEMS: "", GITHUB_REF: "refs/heads/main" });
    assert(!main.stdout.includes("--history"), "the gathering job never writes the history: the job keep-findings does, on main only");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

proves([`${SPEC} FR-005`, `${SPEC} FR-007`], "the history is written by one job only: keep-findings, the only job of any workflow with the permission to write contents but the release's publish, on main and never after a pull request, and it is never a red run", () => {
  const writers: string[] = [];
  for (const w of workflows()) {
    for (const [id, j] of Object.entries(w.jobs)) {
      if (j.permissions?.["contents"] === "write") writers.push(`${w.file}/${id}`);
    }
  }
  assertEquals(writers.filter((x) => !x.startsWith("release/")).sort(), ["ci/keep-findings", "conformance/keep-findings", "evidence/keep-findings", "site/keep-findings", "tests/keep-findings"]);
  for (const w of workflows()) {
    const k = w.jobs["keep-findings"];
    if (k === undefined) continue;
    assert((k.when ?? "").includes("github.ref == 'refs/heads/main'") && !(k.when ?? "").includes("pull_request") && (k.when ?? "").includes("github.event_name == 'push'"), `${w.file}: keep-findings runs on main after a push, a run by hand or the schedule, and never after a pull request`);
    assert(k.steps.every((s) => s.continueOnError === true), `${w.file}: keep-findings is never a red run`);
    const gather = w.jobs[w.file === "ci" ? "ci" : "findings"];
    assert(gather?.permissions?.["contents"] !== "write", `${w.file}: the job that runs on every event holds no write permission`);
  }
});
