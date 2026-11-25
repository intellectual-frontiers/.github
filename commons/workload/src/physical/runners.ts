// Spec: 0010-workload-runners FR-003, FR-011, FR-013, FR-014, FR-015
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
import { DEFAULT_CLI, type EmitOptions, type EmitterImpl, planProblems, registerEmitter } from "@intellectual-frontiers/workload/logical";
import { emitter as bash } from "@intellectual-frontiers/workload/runners/bash";
import { emitter as pwsh } from "@intellectual-frontiers/workload/runners/pwsh";
import { type AnyWorkload, callsOfWorkload, checkWorkload } from "./workloads.ts";
import type { CallsInput } from "@intellectual-frontiers/workload/forms/runbook";

/** The emitters of the integration runners the library has today, one for each. */
export const EMITTERS: readonly EmitterImpl[] = [bash, pwsh];

/** An emitter registered: the list with one more, or why not. */
export const withEmitter = (impl: EmitterImpl, registry: RunnerRegistry = RUNNERS): Result<readonly EmitterImpl[], string> => registerEmitter(EMITTERS, impl, registry);

/** The plan hash: the SHA-256 of the canonical text of the plan of calls, the same for every emitter. */
export const planHash = (plan: CallPlan): Promise<string> => sha256(canonicalPlan(plan));

/** An artifact: what an integration runner made of a plan, with the hash of the plan it carries. */
export type Artifact = { readonly runner: RunnerId; readonly workload: string; readonly path: string; readonly text: string; readonly plan: CallPlan; readonly hash: string };

/** The artifact of a plan of calls for a runner: the plan is checked (every text printable ASCII) and then rendered by the emitter of the runner. */
export async function emitPlan(plan: CallPlan, runner: RunnerId, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<Result<Artifact, readonly Finding[]>> {
  const impl = emitters.find((e) => e.runner.id === runner);
  if (impl === undefined) return err([finding("E-WL-RUNNER-UNSUITABLE", plan.workload, `the runner ${runner} has no emitter: it is the native runner or it is not registered`, { runner, lacks: "an emitter of its own" })]);
  const full: EmitOptions = { cli: options.cli ?? DEFAULT_CLI };
  const bad = planProblems(plan, full);
  if (bad.length > 0) return err(bad);
  const hash = await planHash(plan);
  return ok({ runner, workload: plan.workload, path: `${plan.workload}.${impl.extension}`, text: impl.render(plan, hash, full), plan, hash });
}

/** The artifact of a workload for a runner: its static check first, then what it needs of the runner, then the plan of calls its form gives, and then the emitter. */
export async function emitWorkload(w: AnyWorkload, runner: RunnerId, input: CallsInput, options: Partial<EmitOptions> = {}, emitters: readonly EmitterImpl[] = EMITTERS): Promise<Result<Artifact, readonly Finding[]>> {
  const found = checkWorkload(w, input.registry);
  if (found.length > 0) return err(found);
  const plan = callsOfWorkload(w, input);
  return plan.kind === "err" ? plan : emitPlan(plan.value, runner, options, emitters);
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
