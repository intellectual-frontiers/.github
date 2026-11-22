// Spec: 0002-libraries-ci-findings FR-005
/**
 * Putting the wrapper on the steps of findings (commons 0038-build-policy FR-013): a step whose policy is `finding` runs its script through `ci/step.ts`, which keeps what the script prints, reads it into findings with the parser of the step's tool and
 * exits 0; the script itself moves into the environment of the step (`IFC_STEP_SCRIPT`), so that no quoting of it is needed. Each job that has such a step ends by keeping the findings it made as an artifact, and a workflow that has such a job gets
 * the job `findings`, which gathers them and keeps them (`gather`).
 *
 * @example
 * ```ts
 * import { wrapStep } from "./wrap.ts";
 * ```
 *
 * @module
 */
import { type Job, type Step, use, type Workflow, expr, job as makeJob, run } from "../workflows/model.ts";
import { isWrapped } from "./inventory.ts";
import { plumbing, redCause } from "./policy.ts";

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "step";

/** The step run through the wrapper, where its policy asks for it; the step as it was otherwise. */
export function wrapStep(step: Step, jobId: string, index: number): Step {
  const p = step.policy;
  if (p === undefined || p.kind !== "finding" || step.kind !== "run" || isWrapped(step)) return step;
  const id = step.id ?? `${slug(step.name ?? step.run.split("\n")[0] ?? "")}-${index + 1}`;
  const command = [
    'bun "$GITHUB_WORKSPACE/commons/libraries/src/ci/step.ts"',
    `--id ${id}`,
    `--job "${jobId}"`,
    `--module "${p.module}"`,
    `--tool ${p.tool}`,
    `--timeout ${p.timeoutMinutes}`,
    '--out "$RUNNER_TEMP/findings"',
    `-- bash ${p.errexit ? "-e " : ""}-o pipefail -c "$IFC_STEP_SCRIPT"`,
  ].join(" ");
  return { ...step, kind: "run", id, run: `${command}\n`, shell: "bash", continueOnError: true, env: { ...(step.env ?? {}), IFC_STEP_SCRIPT: step.run } };
}

const keepFindings = (workflow: string, jobId: string): Step =>
  use("actions/upload-artifact@v4", {
    name: "The findings of this job, kept for the job that gathers them",
    when: "always()",
    continueOnError: true,
    policy: plumbing,
    with: { name: `findings-${workflow}-${jobId}-\${{ strategy.job-index }}`, path: "${{ runner.temp }}/findings", "if-no-files-found": "ignore", "retention-days": 7 },
  });

/** The workflow with the wrapper on its steps of findings and the upload of the findings at the end of each job that makes some. */
export function wrapWorkflow(w: Workflow): Workflow {
  const jobs: Record<string, Job> = {};
  for (const [jobId, job] of Object.entries(w.jobs)) {
    const steps = job.steps.map((s, i) => wrapStep(s, jobId, i));
    const makes = steps.some((s) => isWrapped(s));
    jobs[jobId] = { ...job, steps: (makes ? [...steps, keepFindings(w.file, jobId)] : steps) as unknown as Job["steps"] };
  }
  return { ...w, jobs };
}

/** The job that gathers the findings of a workflow (0038-build-policy FR-005, FR-011, FR-012): it needs every job that makes findings, runs always, merges what they kept, checks that each cell that ran left its file (the red cause `reports-not-produced`), keeps the merged file, and on the default branch adds it to the history and gives the commit its neutral status. */
export function gatherJob(w: Workflow, makers: readonly string[], expectScript: string): Job {
  return makeJob({
    name: "findings",
    comment: "the findings of this workflow, gathered: it passes if and only if the pipeline is sound (0038-build-policy FR-005); a failing test, a type error or a crashed command in any cell is a finding here and never a red job",
    needs: [...makers],
    when: "always()",
    runsOn: "ubuntu-24.04",
    timeoutMinutes: 10,
    permissions: { contents: "write", checks: "write", actions: "read" },
    steps: [
      { ...use("actions/checkout@v4", { with: { "fetch-depth": 1 } }), policy: redCause("reports-not-produced") },
      { ...use("./.github/actions/bun"), policy: redCause("reports-not-produced") },
      { ...use("actions/download-artifact@v4", { name: "The findings every job kept", with: { pattern: `findings-${w.file}-*`, path: "_findings", "merge-multiple": true } }), policy: plumbing, continueOnError: true },
      {
        ...run(expectScript, {
          name: "The findings, merged; the pipeline is sound where every cell that ran left its file (ci/collect.ts)",
          shell: "bash",
          env: { GH_TOKEN: expr("github.token"), WORKFLOW: w.file },
        }),
        policy: redCause("reports-not-produced"),
      },
      { ...use("actions/upload-artifact@v4", { name: "The merged findings, kept for the site", when: "always()", with: { name: `findings-${w.file}`, path: "_findings-out", "if-no-files-found": "ignore", "retention-days": 7 } }), policy: plumbing, continueOnError: true },
    ],
  });
}
