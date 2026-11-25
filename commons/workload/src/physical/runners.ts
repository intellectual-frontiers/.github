// Spec: 0010-workload-runners FR-003, FR-011, FR-013, FR-014, FR-015; 0014-runner-github-actions FR-001, FR-010; 0015-schedule-realization FR-004, FR-005, FR-009, FR-010
/**
 * The integration runners the library has today and what is done with them: the emitters registered (an emitter of the folder `runners/` for each integration runner), the plan hash, the emit of a workload into an artifact
 * (the plan of calls, checked, quoted by the emitter of the runner chosen), the hand-off (the artifact and the `handoff` event that names its plan hash and its runner), and the check of an artifact by regenerating it and
 * comparing, which finds a hand-edited artifact, an artifact of a plan that changed and an artifact of another runner as `E-WL-RUNNER-DRIFT`. A workload with a finding is not handed off. The native runner has no
 * artifact: it runs the plan itself. This is where the forms and the emitters are put side by side, as `workloads.ts` puts the forms.
 *
 * @example
 * ```ts
 * import { emitWorkload } from "./runners.ts";
 * // const artifact = await emitWorkload(SYNTHETIC_BOOTSTRAP_01, "bash", { fleet })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { canonicalPlan, type CallPlan, type Finding, finding, type RunnerEvent, type RunnerId, RUNNERS, type RunnerRegistry } from "@intellectual-frontiers/workload/governance";
import { DEFAULT_CLI, type EmitOptions, type EmitterImpl, planProblems, registerEmitter, type ScheduleFile } from "@intellectual-frontiers/workload/logical";
import { emitter as bash } from "@intellectual-frontiers/workload/runners/bash";
import { emitter as github } from "@intellectual-frontiers/workload/runners/github-actions";
import { emitter as pwsh } from "@intellectual-frontiers/workload/runners/pwsh";
import { type AnyWorkload, callsOfWorkload, checkWorkload } from "./workloads.ts";
import type { CallsInput } from "@intellectual-frontiers/workload/forms/runbook";

/** The emitters of the integration runners the library has today, one for each. */
export const EMITTERS: readonly EmitterImpl[] = [bash, pwsh, github];

/** An emitter registered: the list with one more, or why not. */
export const withEmitter = (impl: EmitterImpl, registry: RunnerRegistry = RUNNERS): Result<readonly EmitterImpl[], string> => registerEmitter(EMITTERS, impl, registry);

/** The plan hash: the SHA-256 of the canonical text of the plan of calls, the same for every emitter. */
export const planHash = (plan: CallPlan): Promise<string> => sha256(canonicalPlan(plan));

/** An artifact: what an integration runner made of a plan, with the hash of the plan it carries. */
export type Artifact = { readonly runner: RunnerId; readonly workload: string; readonly path: string; readonly text: string; readonly plan: CallPlan; readonly hash: string };

/** The artifact of a plan of calls for a runner: the plan is checked (every text printable ASCII, and what the platform of the runner asks besides) and then rendered by the emitter of the runner. A plan with a gate (an environment a person approves) is carried only by a runner that has `approval`. */
export async function emitPlan(plan: CallPlan, runner: RunnerId, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<Result<Artifact, readonly Finding[]>> {
  const impl = emitters.find((e) => e.runner.id === runner);
  if (impl === undefined) return err([finding("E-WL-RUNNER-UNSUITABLE", plan.workload, `the runner ${runner} has no emitter: it is the native runner or it is not registered`, { runner, lacks: "an emitter of its own" })]);
  const full: EmitOptions = { ...options, cli: options.cli ?? DEFAULT_CLI };
  const gated = (plan.jobs ?? []).filter((j) => j.environment !== undefined);
  if (gated.length > 0 && !impl.runner.capabilities.includes("approval")) return err([finding("E-WL-RUNNER-UNSUITABLE", plan.workload, `the runner ${runner} cannot carry ${plan.workload}: approval (${gated.map((j) => `${j.id}: guarded by the gate ${j.environment ?? ""}`).join(", ")})`, { runner, lacks: "approval" })]);
  const bad = [...planProblems(plan, full), ...(impl.problems?.(plan, full) ?? [])];
  if (bad.length > 0) return err(bad);
  const hash = await planHash(plan);
  return ok({ runner, workload: plan.workload, path: `${plan.workload}.${impl.extension}`, text: impl.render(plan, hash, full), plan, hash });
}

/** A scheduled workload with an input it requires cannot be started by a schedule, which gives it no input: the finding, where the run has no file of the environment to read it from. */
const scheduledNeedsInput = (w: AnyWorkload, hasEnvironment: boolean): readonly Finding[] =>
  w.trigger.kind === "schedule" && !hasEnvironment ? w.inputs.filter((i) => i.required).map((i) => finding("E-WL-RUNNER-SCHEDULE-NEEDS-INPUT", i.name, `${w.id} is started by a schedule, which gives no input, and requires the input ${i.name}`, { node: i.name })) : [];

/** The artifact of a workload for a runner: its static check first, then what it needs of the runner, then the plan of calls its form gives, and then the emitter. The trigger of the workload goes to the emitter (GitHub carries a schedule in the workflow). */
export async function emitWorkload(w: AnyWorkload, runner: RunnerId, input: CallsInput, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<Result<Artifact, readonly Finding[]>> {
  const found = checkWorkload(w, input.registry);
  if (found.length > 0) return err(found);
  const plan = callsOfWorkload(w, input);
  if (plan.kind === "err") return plan;
  if (runner === "github-actions") {
    const needs = scheduledNeedsInput(w, false);
    if (needs.length > 0) return err(needs);
  }
  return emitPlan(plan.value, runner, { trigger: w.trigger, ...options }, emitters);
}

/** What a schedule made of a workload: where it is (inside the artifact, as GitHub does, or in files of its own), the files, and the hash of the plan the unit starts. */
export type ScheduleArtifacts = { readonly runner: RunnerId; readonly workload: string; readonly where: "none" | "workflow" | "files"; readonly files: readonly ScheduleFile[]; readonly hash: string };

/**
 * The scheduling artifact of a workload for a runner, from its trigger. A trigger of kind `schedule` becomes `on.schedule` inside the workflow of GitHub Actions, and for `bash` and `pwsh` a cron line and a systemd timer with its service
 * (Linux only; Windows is `E-WL-RUNNER-EMIT-UNSUPPORTED`), each only starting the artifact by its path. A manual trigger has none. A trigger of kind `event` or `alert` is not realized: it is `E-WL-RUNNER-EMIT-UNSUPPORTED`, and says so.
 */
export async function emitSchedule(w: AnyWorkload, runner: RunnerId, input: CallsInput, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<Result<ScheduleArtifacts, readonly Finding[]>> {
  const made = await emitWorkload(w, runner, input, options, emitters);
  if (made.kind === "err") return made;
  const base = { runner, workload: w.id, hash: made.value.hash };
  const t = w.trigger;
  switch (t.kind) {
    case "manual":
      return ok({ ...base, where: "none", files: [] });
    case "event":
    case "alert":
      return err([finding("E-WL-RUNNER-EMIT-UNSUPPORTED", w.id, `${w.id} is started by the ${t.kind} ${t.name}, and no runner realizes an ${t.kind} trigger yet: it is a statement of the spec, and a person or a schedule starts the artifact`, { node: `the ${t.kind} trigger` })]);
    case "schedule": {
      const impl = emitters.find((e) => e.runner.id === runner);
      if (impl?.schedule === undefined) return ok({ ...base, where: "workflow", files: [] });
      const needs = scheduledNeedsInput(w, options.schedule?.environmentFile !== undefined);
      if (needs.length > 0) return err(needs);
      const files = impl.schedule(made.value.plan, made.value.hash, t, { cli: options.cli ?? DEFAULT_CLI, ...options });
      return files.kind === "err" ? files : ok({ ...base, where: "files", files: files.value });
    }
    default:
      return t satisfies never;
  }
}

/** Why a schedule file is not what the plan and the trigger make, or nothing where each is: the files are regenerated and compared by path; any difference, a file that is not one of them and a file missing is `E-WL-RUNNER-DRIFT`. */
export async function checkSchedule(files: Readonly<Record<string, string>>, w: AnyWorkload, runner: RunnerId, input: CallsInput, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<readonly Finding[]> {
  const made = await emitSchedule(w, runner, input, options, emitters);
  if (made.kind === "err") return made.error;
  const out: Finding[] = [];
  const drift = (why: string): number => out.push(finding("E-WL-RUNNER-DRIFT", w.id, `the schedule of ${w.id} for ${runner} is not what the plan and the trigger make: ${why}`));
  for (const f of made.value.files) {
    const have = files[f.path];
    if (have === undefined) drift(`${f.path} is missing`);
    else if (have !== f.text) drift(`${f.path} was edited by hand or is of another plan or trigger`);
  }
  const names = new Set(made.value.files.map((f) => f.path));
  for (const p of Object.keys(files)) if (!names.has(p)) drift(`${p} is none of its files`);
  return out;
}

/** The event that records the hand-off of an artifact: the hash of its plan and the id of its runner. */
export const handoffEvent = (a: Pick<Artifact, "runner" | "hash">): Extract<RunnerEvent, { kind: "handoff" }> => ({ kind: "handoff", runner: a.runner, plan: a.hash });

/** Why an artifact is not what the plan makes, or nothing where it is: the artifact is regenerated and compared with the text given; any difference is `E-WL-RUNNER-DRIFT`. */
export async function checkArtifact(text: string, w: AnyWorkload, runner: RunnerId, input: CallsInput, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<readonly Finding[]> {
  const made = await emitWorkload(w, runner, input, options, emitters);
  if (made.kind === "err") return made.error;
  if (text === made.value.text) return [];
  const carried = /^(?:#|\/\/) plan: ([0-9a-f]{64})$/mu.exec(text)?.[1];
  const why = carried === undefined ? "it carries no plan hash" : carried !== made.value.hash ? `it carries the plan hash ${carried} and the plan makes ${made.value.hash}` : "it carries the hash of the plan and its text is not the text the emitter makes: it was edited by hand";
  return [finding("E-WL-RUNNER-DRIFT", w.id, `the artifact of ${w.id} for ${runner} is not what the plan makes: ${why}`)];
}
