// Spec: 0014-runner-github-actions FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-009, FR-012; 0015-schedule-realization FR-004
/**
 * The emitter of the runner `github-actions`: it renders a plan of calls (and, for a graph, its jobs) as a workflow of GitHub Actions and nothing else, and GitHub is the external executor that runs it and is then handed off to
 * (the plan hash, the run, the receipt). The workflow is made as a typed value of the model of `commons/libraries` (`validateWorkflow`, `renderWorkflow`), so that the bytes are the bytes that model writes. The thin emit rule holds:
 * each step is one call to the pinned command of a verb by its id (the pin table, or `<cli> verb <id>`), a job has only what GitHub requires to wire it (`needs`, a matrix over a fixed list, `permissions` and an `environment` that a
 * person approves, `concurrency`, and the outputs of nothing), an input of the run is read from `WORKLOAD_INPUT_<NAME>` which the job sets from `inputs`, a credential is a reference `secrets.<NAME>` to its name and never a value, and
 * every action is pinned to a tag or a full commit. The permissions are the least that the plan asks for (`contents: read` and what the node names). The schedule of a workload (`on.schedule`, in UTC) is in the workflow itself. Pure.
 *
 * @example
 * ```ts
 * import { emitter } from "@intellectual-frontiers/workload/runners/github-actions";
 * // emitter.render(plan, hash, { cli: "workload" })
 * ```
 *
 * @module
 */
import { expr, type Job, job as makeJob, run, type Step, stepFindings, use, validateWorkflow, type Workflow } from "@intellectual-frontiers/libraries/workflows/model";
import { renderWorkflow } from "@intellectual-frontiers/libraries/workflows/render";
import { type Call, type CallPlan, type Finding, finding, type PlanJob, type PlanStep, RUNNERS } from "@intellectual-frontiers/workload/governance";
import { type EmitOptions, type EmitterImpl, type GithubOptions, inputVariable, scheduleOf } from "@intellectual-frontiers/workload/logical";

export { BLOCKER_KINDS, type Blocker, type BlockerKind, thinBlockers } from "./thin.ts";
export { type GithubRun, type RunConclusion, receiptFromRun, planOfWorkflow, type RunApproval, type RunReceipt } from "./ingest.ts";

const runner = RUNNERS.get("github-actions");
if (runner === undefined) throw new Error("the runner github-actions is registered by the core");

const DEFAULT_CHECKOUT = "actions/checkout@v4";
const DEFAULT_RUNS_ON = "ubuntu-24.04";
const DEFAULT_TIMEOUT = 15;
const WORD = /^[A-Za-z0-9._/@=:+-]+$/u;

/** A text as one single-quoted word of Bash: a single quote inside it ends the quote, is written escaped and opens the quote again. */
const q = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`;

/** The jobs of a plan: those of a graph, or, for a plan with no jobs, one job for each step, each after the one before it. */
function jobsOf(plan: CallPlan): readonly PlanJob[] {
  if (plan.jobs !== undefined) return plan.jobs;
  return plan.steps.map((step, i): PlanJob => ({ id: step.step, title: step.step, needs: i === 0 ? [] : [plan.steps[i - 1]?.step ?? ""], step, permissions: { contents: "read" }, credentials: plan.credentials }));
}

const callScript = (c: Call, member: boolean, options: EmitOptions): string => {
  const pinned = options.github?.commands?.[c.verb];
  const base = pinned === undefined ? `${options.cli} verb ${c.verb}` : pinned.join(" ");
  const args = c.args.map((a) => ` --in ${a.value.kind === "literal" ? q(`${a.name}=${a.value.text}`) : `"${a.name}=\${${inputVariable(a.value.name)}}"`}`).join("");
  return `${base}${args}${member ? ' --member "$MEMBER"' : ""}`;
};

const inputsOf = (s: PlanStep): readonly string[] => [...new Set((s.kind === "call" ? [s] : s.body).flatMap((c) => c.args.flatMap((a) => (a.value.kind === "input" ? [a.value.name] : []))))].sort();

/** The workflow of a plan as a typed value of the model of workflows, before any text. */
export function workflowOf(plan: CallPlan, hash: string, options: EmitOptions): Workflow {
  const gh: GithubOptions = options.github ?? {};
  const provenance = gh.provenance !== false;
  const checkout = use(gh.checkout ?? DEFAULT_CHECKOUT);
  const setup = (gh.setup ?? []).map((s) => use(s.uses, s.with === undefined ? {} : { with: s.with }));
  const jobs: Record<string, Job> = {};
  for (const j of jobsOf(plan)) {
    const s = j.step;
    const calls = s.kind === "call" ? [s] : s.body;
    const member = s.kind === "each";
    const steps: readonly [Step, ...Step[]] = [checkout, ...setup, ...calls.map((c) => run(callScript(c, member, options), { name: c.step, shell: "bash", ...(member ? { env: { MEMBER: expr("matrix.member") } } : {}) }))];
    const env: Record<string, string> = {
      ...Object.fromEntries(inputsOf(s).map((i) => [inputVariable(i), expr(`inputs.${i}`)])),
      ...Object.fromEntries(j.credentials.map((c) => [c, expr(`secrets.${c}`)])),
    };
    jobs[j.id] = makeJob({
      name: j.title,
      comment: `${s.kind === "call" ? `step ${s.step}: ${s.as}, ${s.autonomy}` : `step ${s.step}: each over ${s.over}, ${s.autonomy}`}`,
      runsOn: gh.runsOn ?? DEFAULT_RUNS_ON,
      timeoutMinutes: j.timeoutMinutes ?? gh.timeoutMinutes ?? DEFAULT_TIMEOUT,
      ...(j.needs.length === 0 ? {} : { needs: j.needs }),
      permissions: j.permissions,
      ...(j.environment === undefined ? {} : { environment: { name: j.environment } }),
      ...(Object.keys(env).length === 0 ? {} : { env }),
      ...(s.kind === "each" ? { strategy: { failFast: false, matrix: { member: s.members } } } : {}),
      steps,
    });
  }
  const trigger = options.trigger;
  const schedule = trigger?.kind === "schedule" ? scheduleOf(trigger, plan.workload) : undefined;
  const dispatch = plan.inputs.length === 0 ? (true as const) : { inputs: Object.fromEntries(plan.inputs.map((i) => [i, { description: i, type: "string" as const, default: "" }])) };
  return {
    file: plan.workload,
    name: plan.workload,
    on: { workflowDispatch: dispatch, ...(schedule?.kind === "ok" ? { schedule: [schedule.value.cron] } : {}) },
    permissions: { contents: "read" },
    ...(provenance ? { env: { WORKLOAD_PLAN: hash } } : {}),
    concurrency: { group: plan.workload, cancelInProgress: false },
    jobs,
  };
}

/** The text of the workflow of a plan. */
const render = (plan: CallPlan, hash: string, options: EmitOptions): string => {
  const text = renderWorkflow(workflowOf(plan, hash, options));
  if (options.github?.provenance === false) return text;
  const [, ...rest] = text.split("\n");
  return [`# Generated by commons/workload from the plan of ${plan.workload} ${plan.version} (the form ${plan.form}); do not edit it: regenerate it.`, `# plan: ${hash}`, ...rest].join("\n");
};

/** What keeps a plan from being a workflow GitHub accepts under the thin emit rule: an action or a command of the pin table that is not pinned, a time that is not minutes of an hour, a runner that is not one asked for. */
const problems = (plan: CallPlan, options: EmitOptions): readonly Finding[] => {
  const out: Finding[] = [];
  const gh = options.github ?? {};
  for (const [verb, words] of Object.entries(gh.commands ?? {})) {
    if (words.length === 0 || !words.every((w) => WORD.test(w))) out.push(finding("E-WL-RUNNER-ACTION-UNPINNED", verb, `the command of ${verb} in the pin table is not a list of plain words`, { node: verb }));
  }
  if (gh.timeoutMinutes !== undefined && !(Number.isInteger(gh.timeoutMinutes) && gh.timeoutMinutes >= 1 && gh.timeoutMinutes <= 360)) out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", "", `the time a job may take is not whole minutes from 1 to 360: ${String(gh.timeoutMinutes)}`));
  if (gh.runsOn !== undefined && gh.runsOn !== "ubuntu-latest" && gh.runsOn !== "ubuntu-24.04") out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", "", `the runner of the jobs is not one the emitter asks for: ${JSON.stringify(String(gh.runsOn).slice(0, 40))}`));
  const steps = [use(gh.checkout ?? DEFAULT_CHECKOUT), ...(gh.setup ?? []).map((s) => use(s.uses))];
  for (const [i, s] of steps.entries()) for (const f of stepFindings(s, i === 0 ? "the checkout" : `the setup action ${i}`)) out.push(finding("E-WL-RUNNER-ACTION-UNPINNED", "", f, { node: i === 0 ? "the checkout" : `the setup action ${i}` }));
  if (options.trigger?.kind === "schedule") {
    const resolved = scheduleOf(options.trigger, plan.workload);
    if (resolved.kind === "err") out.push(resolved.error);
  }
  if (out.length === 0) for (const f of validateWorkflow(workflowOf(plan, "0".repeat(64), options))) out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", "", f));
  return out;
};

/** The emitter. The schedule is inside the workflow (`on.schedule`), so it has no files of its own. */
export const emitter: EmitterImpl = { runner, extension: "yml", render, problems };
