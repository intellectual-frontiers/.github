// Spec: 0002-libraries-ci-findings FR-005
/**
 * The inventory of the build policy (commons 0038-build-policy FR-003): every step of every workflow of the model is classified as a red cause, a step whose output is read into findings, a gate or plumbing, by an ordered list of
 * rules written as data with the reason of each; `classify` gives each step its policy, `inventory` gives the table of them (the table the documentation shows) with the counts, and `policyFindings` is the validation of the model against
 * the policy: a step with no policy, a step of findings that is not wrapped or has no time limit below its job's, a matrix that fails fast, a job after a matrix that does not run with `always()`, plumbing in a cell that can fail it.
 *
 * @remarks
 * A step is placed by its workflow's file, its job's id and its position, and named by its `name` or its action or the first line of its script. The rules look at the job's id, the step's kind and its words; the first that matches decides. A step that
 * no rule matches has no policy and is a finding of the model, so that a new step must be classified before the generator writes the workflow.
 *
 * @example
 * ```ts
 * import { inventory } from "./inventory.ts";
 * inventory([]).counts; // { "red-cause": 0, finding: 0, gate: 0, plumbing: 0 }
 * ```
 *
 * @module
 */
import type { Job, Step, Workflow } from "../workflows/model.ts";
import { finding, gate, plumbing, redCause, type StepPolicy } from "./policy.ts";

/** Where a step is. */
export type Place = { readonly file: string; readonly jobId: string; readonly job: Job; readonly index: number; readonly step: Step };

/** The name a step is known by in the table: its name, else its action, else the first line of its script. */
export const stepName = (s: Step): string => s.name ?? (s.kind === "uses" ? s.uses : (s.run.split("\n")[0] ?? "").slice(0, 80));

/** The module the findings of a step in a job are of: the library of a matrix cell, `repository` otherwise. */
function moduleOf(file: string, jobId: string, job: Job): string {
  if (job.strategy === undefined || file === "tests") return "repository";
  if (file === "evidence" && jobId === "mutation") return "${{ matrix.library }}";
  if (file === "evidence" && jobId === "repository") return "repository";
  if (file === "release" && jobId === "build") return "${{ matrix.slug }}";
  if (file === "conformance" && jobId === "compile") return "system";
  return "${{ matrix.name }}";
}

/** A rule of the inventory: why, which steps, and what they are. */
export type Rule = { readonly why: string; readonly match: (p: Place) => boolean; readonly policy: (p: Place) => StepPolicy };

const text = (p: Place): string => (p.step.kind === "run" ? p.step.run : p.step.uses);
const named = (p: Place, re: RegExp): boolean => re.test(`${p.step.name ?? ""}\n${text(p)}`);
const minutes = (p: Place, share: number): number => Math.max(1, Math.floor(p.job.timeoutMinutes * share));
const find = (tool: Parameters<typeof finding>[0], share: number, o: { errexit?: boolean; perFile?: boolean } = {}) => (p: Place): StepPolicy => finding(tool, minutes(p, share), { module: moduleOf(p.file, p.jobId, p.job), ...o });

/** The rules, in order: the first that matches a step is its policy. */
export const RULES: readonly Rule[] = [
  { why: "the job that plans the matrix: if it cannot, no cell can run and no report can be made", match: (p) => p.jobId === "plan", policy: () => redCause("plan-unavailable") },
  { why: "the job that gathers the findings of a workflow: it exists to keep what the cells made, and a step of it that cannot do so loses it", match: (p) => p.jobId === "findings" && p.step.kind === "run" && named(p, /ci\/collect\.ts/), policy: () => redCause("reports-not-produced") },
  { why: "the job that keeps a run's findings on the history branch: it says nothing of a module, and a history that could not be kept is said and is never a red run", match: (p) => p.jobId === "keep-findings", policy: () => plumbing },
  { why: "the check of the workflow files: the pipeline's own configuration", match: (p) => named(p, /generate-workflows\.ts --check/) && p.jobId === "workflows", policy: () => redCause("workflow-invalid") },
  { why: "the decision of the release: a gate whose own outcome may stop the run, by the policy of a date, and the publication it guards, whose result is the release's own", match: (p) => p.file === "release" && p.jobId === "publish" && p.step.kind === "run" && named(p, /releasing\.ts publish|release-gate\.ts/), policy: () => gate("release") },
  { why: "the publication of the site: an explicit action whose own result is the publication's", match: (p) => p.step.kind === "uses" && /deploy-pages|upload-pages-artifact/.test(p.step.uses), policy: () => gate("pages") },
  { why: "the housekeeping of the release: an explicit action by hand whose own result is the registry's or the tag's, and which says nothing of a module", match: (p) => p.file === "maintenance" && p.step.kind === "run", policy: () => gate("maintenance") },
  { why: "an action that fetches, keeps or hands on what other steps made: it says nothing about a module", match: (p) => p.step.kind === "uses", policy: () => plumbing },
  { why: "the packages of a cell: a cell that cannot install them has a finding of its own and no other cell is touched", match: (p) => p.step.kind === "run" && named(p, /bun install --frozen-lockfile/), policy: find("install", 0.3) },
  { why: "a library's own `verify`: type check, spec checks, tests", match: (p) => p.step.kind === "run" && named(p, /matrix\.verify|bun run verify|\bverify\b/) && !named(p, /Why there is a report/), policy: find("verify", 0.8) },
  { why: "the mutation run of a small library: it makes the suite run once for each change, so it takes most of its job's time (a library at 33 of 40 minutes is not a finding of a timeout)", match: (p) => p.step.kind === "run" && named(p, /mutation\.ts/), policy: find("exit-status", 0.92) },
  { why: "the tests of the repository's root, each file run by itself with its own time limit, so that one that hangs or fails hides no other and each is a module of its own (0038-build-policy FR-014)", match: (p) => p.step.kind === "run" && p.file === "tests" && named(p, /tests\/\*\.test\.ts/) && named(p, /bun test/), policy: find("bun-test", 0.8, { perFile: true }) },
  { why: "the tests of a library on Node, the tests of the repository, the tests kept as a report", match: (p) => p.step.kind === "run" && named(p, /bun test|node --test|evidence\.ts|matrix\.node|mutation\.ts/), policy: find("bun-test", 0.8) },
  { why: "the type checker on the repository's own files", match: (p) => p.step.kind === "run" && named(p, /tsc -p/), policy: find("tsc", 0.6, { errexit: false }) },
  { why: "the formatter", match: (p) => p.step.kind === "run" && named(p, /bun fmt --check/), policy: find("format", 0.6) },
  { why: "the linter", match: (p) => p.step.kind === "run" && named(p, /\blint\b/), policy: find("lint", 0.6) },
  { why: "the checks of the repository's generated files and specifications, each independent of the others", match: (p) => p.step.kind === "run" && named(p, /--check|mizan-check|libraries\/src\/check\.ts|versions\.ts/), policy: find("checks", 0.8, { errexit: false }) },
  { why: "a script that moves or reports what the other steps made (the history, the summary, the reason for a report, the site's own pages)", match: (p) => p.step.kind === "run" && p.step.continueOnError === true && named(p, /_evidence|GITHUB_STEP_SUMMARY|gh run|gh api|status-site|history\.ts/), policy: find("exit-status", 0.5) },
  { why: "any other command of a step: its failure is a finding of the module it runs for", match: (p) => p.step.kind === "run", policy: find("exit-status", 0.8) },
];

/** The policy of a step by the first rule that matches it. */
export function policyOf(p: Place): { readonly policy: StepPolicy; readonly why: string } | undefined {
  for (const r of RULES) if (r.match(p)) return { policy: r.policy(p), why: r.why };
  return undefined;
}

const withPolicy = (s: Step, policy: StepPolicy, inCell: boolean): Step => ({ ...s, policy, ...(policy.kind === "plumbing" || (policy.kind === "gate" && policy.gate === "pages" && inCell) ? { continueOnError: true } : {}) });

/** The workflow with a policy on every step that has none. */
export function classify(w: Workflow): Workflow {
  const jobs: Record<string, Job> = {};
  for (const [jobId, job] of Object.entries(w.jobs)) {
    const steps = job.steps.map((step, index) => (step.policy !== undefined ? step : withPolicy(step, policyOf({ file: w.file, jobId, job, index, step })?.policy ?? undefinedPolicy, job.strategy !== undefined))) as unknown as Job["steps"];
    jobs[jobId] = { ...job, steps };
  }
  return { ...w, jobs };
}

/** What a step with no rule gets: nothing a validation could take for a policy. */
const undefinedPolicy = undefined as unknown as StepPolicy;

/** One row of the table. */
export type Row = { readonly file: string; readonly job: string; readonly step: string; readonly policy: StepPolicy["kind"]; readonly detail: string; readonly why: string };

/** The table of every step of the workflows, with the counts of each policy. */
export function inventory(ws: readonly Workflow[]): { readonly rows: readonly Row[]; readonly counts: Readonly<Record<StepPolicy["kind"], number>> } {
  const rows: Row[] = [];
  const counts: Record<StepPolicy["kind"], number> = { "red-cause": 0, finding: 0, gate: 0, plumbing: 0 };
  for (const w of ws) {
    for (const [jobId, job] of Object.entries(w.jobs)) {
      job.steps.forEach((step, index) => {
        const p = step.policy ?? policyOf({ file: w.file, jobId, job, index, step })?.policy;
        if (p === undefined) return;
        counts[p.kind] += 1;
        const why = policyOf({ file: w.file, jobId, job, index, step })?.why ?? "";
        const detail = p.kind === "red-cause" ? p.cause : p.kind === "finding" ? `${p.tool}, ${p.timeoutMinutes} min` : p.kind === "gate" ? p.gate : "";
        rows.push({ file: w.file, job: jobId, step: stepName(step), policy: p.kind, detail, why });
      });
    }
  }
  return { rows, counts };
}

const WRAPPER = "ci/step.ts";

/** Whether a step of findings is run through the wrapper. */
export const isWrapped = (s: Step): boolean => s.kind === "run" && s.env?.["IFC_STEP_SCRIPT"] !== undefined && s.run.includes(WRAPPER);

/** What is wrong with a workflow under the policy, one sentence each (0038-build-policy FR-003, FR-004, FR-005). */
export function policyFindings(w: Workflow): readonly string[] {
  const out: string[] = [];
  const cellJobs = new Set(Object.entries(w.jobs).filter(([, j]) => j.strategy !== undefined).map(([id]) => id));
  for (const [jobId, job] of Object.entries(w.jobs)) {
    const here = `${w.file}: job ${jobId}`;
    if (job.strategy !== undefined && job.strategy.failFast !== false) out.push(`${here}: the matrix fails fast, so one cell's words would stop the others (FR-004)`);
    const needsCell = (job.needs ?? []).some((n) => cellJobs.has(n));
    if (needsCell && !(job.when ?? "").includes("always()")) out.push(`${here}: needs a job of a matrix and does not run with always(), so a cell that failed would skip it (FR-004)`);
    job.steps.forEach((step, i) => {
      const where = `${here}, step ${i + 1} (${stepName(step)})`;
      const p = step.policy;
      if (p === undefined) {
        out.push(`${where}: has no policy (FR-003)`);
        return;
      }
      if (p.kind === "finding") {
        if (step.kind !== "run") out.push(`${where}: a step of findings runs a script, not an action`);
        else if (!isWrapped(step)) out.push(`${where}: a step of findings is not run through the wrapper (FR-003)`);
        if (p.timeoutMinutes >= job.timeoutMinutes) out.push(`${where}: its time limit of ${p.timeoutMinutes} minutes is not below the job's ${job.timeoutMinutes}, so the job would be stopped before the step is (FR-004)`);
      }
      if (p.kind === "plumbing" && step.continueOnError !== true) out.push(`${where}: plumbing can fail its job and is not continueOnError: it says nothing of a module and is never a reason to end red (FR-001, FR-003)`);
    });
  }
  return out;
}
