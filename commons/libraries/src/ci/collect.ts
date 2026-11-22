// Spec: 0002-libraries-ci-findings FR-006
/**
 * The gathering of the findings of a workflow (commons 0038-build-policy FR-005, FR-011, FR-012): `bun commons/libraries/src/ci/collect.ts --dir DIR --out DIR --workflow NAME [--expect JOB:MODULES ...] [--policy-review] [--check-run] [--history REMOTE]` merges the files that the
 * steps wrote, makes sure that every cell that ran left its file (the red cause `reports-not-produced`: the only way it ends red), writes the merged file and a summary, gives the commit the neutral check `findings` and, on the default branch, adds the run to the history
 * branch. A finding is never a reason to end red.
 *
 * @remarks
 * It imports no package. The check run is made with `gh`, the history with `git`; where either cannot be done the run says so and is not red for it (the pipeline is sound where its findings were kept, and the artifact keeps them).
 *
 * @example
 * ```ts
 * import { mergeFiles } from "./collect.ts";
 * mergeFiles([], { id: "1", workflow: "ci", commit: "c", at: "2026-11-22T00:00:00Z" }).findings.length; // 0
 * ```
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeFindingsFile, type Finding, type FindingsFile, type RunInfo, type StepRecord } from "./findings.ts";
import { keepRun } from "./history.ts";
import { releaseDecision } from "./policy.ts";
import { makeFinding, sha256Of } from "./findings.ts";

/** The files of a folder (and the folders under it) that are findings files, with the sentences for the ones that are not. */
export function readFiles(dir: string): { readonly files: readonly FindingsFile[]; readonly problems: readonly string[] } {
  const files: FindingsFile[] = [];
  const problems: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) {
        try {
          const r = decodeFindingsFile(JSON.parse(readFileSync(p, "utf8")));
          if (r.kind === "ok") files.push(r.value);
          else problems.push(`${p}: ${r.error}`);
        } catch (e2) {
          problems.push(`${p}: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return { files, problems };
}

/** The files of the steps as one file of the run, the findings once each (the same finding read by two steps is one). */
export function mergeFiles(files: readonly FindingsFile[], run: RunInfo): FindingsFile {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  const steps: StepRecord[] = [];
  for (const f of files) {
    steps.push(...f.steps);
    for (const x of f.findings) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      findings.push(x);
    }
  }
  steps.sort((a, b) => (`${a.job}/${a.module}/${a.id}` < `${b.job}/${b.module}/${b.id}` ? -1 : 1));
  findings.sort((a, b) => (a.id < b.id ? -1 : 1));
  return { schema: "build-findings/1", run, steps, findings };
}

/** What is missing against what was expected (`job:count` pairs: how many modules of the job ran): the reasons the pipeline is not sound (empty where it is). */
export function expectationProblems(merged: FindingsFile, expect: readonly { readonly job: string; readonly modules: number }[]): readonly string[] {
  const out: string[] = [];
  for (const e of expect) {
    const got = new Set(merged.steps.filter((s) => s.job === e.job).map((s) => s.module));
    if (got.size < e.modules) out.push(`${e.job}: ${e.modules} cells ran and ${got.size} left a findings file`);
  }
  return out;
}

/** The counts of a merged file by severity, for the summary of a check. */
export function summaryText(f: FindingsFile): string {
  const by = (s: string): number => f.findings.filter((x) => x.severity === s).length;
  const modules = new Set(f.findings.map((x) => x.module)).size;
  return `${f.findings.length} findings (${by("error")} errors, ${by("warning")} warnings, ${by("note")} notes) in ${modules} modules, from ${f.steps.length} steps. They are findings and never a failed run.`;
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dir = arg(argv, "--dir") ?? "_findings";
  const out = arg(argv, "--out") ?? "_findings-out";
  const workflow = arg(argv, "--workflow") ?? process.env["WORKFLOW"] ?? "local";
  const expect = argv.flatMap((a, i) => (argv[i - 1] === "--expect" ? [a] : [])).map((e) => ({ job: e.split(":")[0] ?? "", modules: Number(e.split(":")[1] ?? "0") }));
  const run: RunInfo = {
    id: process.env["GITHUB_RUN_ID"] ?? "local",
    workflow,
    commit: process.env["GITHUB_SHA"] ?? "local",
    at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    ...(process.env["GITHUB_SERVER_URL"] !== undefined && process.env["GITHUB_REPOSITORY"] !== undefined && process.env["GITHUB_RUN_ID"] !== undefined ? { url: `${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}/actions/runs/${process.env["GITHUB_RUN_ID"]}` } : {}),
  };
  const read = readFiles(dir);
  let merged = mergeFiles(read.files, run);
  if (argv.includes("--policy-review")) {
    const d = releaseDecision(run.at.slice(0, 10));
    if (!d.proceed) {
      const f = makeFinding({ tool: "policy", code: d.finding.code, module: d.finding.module, severity: d.finding.severity, message: d.finding.message, key: "release-policy", evidence: { run: run.id, commit: run.commit, step: "policy", logSha256: sha256Of(d.finding.message) }, at: run.at });
      merged = { ...merged, findings: [...merged.findings, f], steps: [...merged.steps, { id: "policy", job: "findings", module: "repository", tool: "policy", outcome: "findings", findings: 1, durationMs: 0 }] };
    }
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "findings.json"), `${JSON.stringify(merged, null, 2)}\n`);
  const summary = summaryText(merged);
  process.stdout.write(`${summary}\n`);
  for (const p of read.problems) process.stderr.write(`not a findings file: ${p}\n`);
  if (process.env["GITHUB_STEP_SUMMARY"] !== undefined) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], `### Findings of ${workflow}\n\n${summary}\n`);
  if (argv.includes("--check-run") && process.env["GITHUB_REPOSITORY"] !== undefined && process.env["GITHUB_SHA"] !== undefined) {
    const conclusion = merged.findings.length > 0 ? "neutral" : "success";
    const r = spawnSync("gh", ["api", `repos/${process.env["GITHUB_REPOSITORY"]}/check-runs`, "-f", `name=findings (${workflow})`, "-f", `head_sha=${process.env["GITHUB_SHA"]}`, "-f", "status=completed", "-f", `conclusion=${conclusion}`, "-f", "output[title]=Findings", "-f", `output[summary]=${summary}`], { encoding: "utf8" });
    process.stdout.write(r.status === 0 ? `the check run is ${conclusion}\n` : `the check run could not be made (${(r.stderr ?? "").trim().split("\n")[0] ?? "no reason"}); the findings are kept all the same\n`);
  }
  const history = arg(argv, "--history");
  if (history !== undefined) {
    try {
      const kept = keepRun(".", history, merged);
      process.stdout.write(`history: ${kept.kind}${kept.kind === "failed" ? ` (${kept.error.split("\n")[0]})` : ` ${kept.path}`}\n`);
    } catch (e) {
      process.stdout.write(`history: could not be kept (${e instanceof Error ? e.message.split("\n")[0] : String(e)})\n`);
    }
  }
  const bad = expectationProblems(merged, expect);
  if (bad.length > 0) {
    process.stderr.write(`the pipeline is not sound (the red cause reports-not-produced):\n${bad.map((b) => `  ${b}`).join("\n")}\n`);
    process.exitCode = 2;
  }
}
