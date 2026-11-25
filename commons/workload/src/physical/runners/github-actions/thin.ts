// Spec: 0016-ci-on-graph FR-002, FR-003
/**
 * The measure of how far a workflow of the typed model is from what the emitter writes (0016-ci-on-graph): the reasons a job, or the workflow, could not be made from a graph by the emitter without changing its bytes. A job
 * is only what the thin emit rule allows (a checkout and the setup action, then one call of a pinned command for each step, with `needs`, `permissions`, an `environment`, a matrix over a fixed list and the references to inputs
 * and secrets that GitHub requires), so a script of several lines, a shell line with logic, a condition, `continue-on-error`, an action that moves data, a matrix read at run time or an output is a blocker, each named. A
 * workflow moves onto the graph form only where it has none. Pure.
 *
 * @example
 * ```ts
 * import { thinBlockers } from "./thin.ts";
 * // thinBlockers(workflow).filter((b) => b.job === "plan").map((b) => b.kind)
 * ```
 *
 * @module
 */
import type { Job, Step, Workflow } from "@intellectual-frontiers/libraries/workflows/model";

/** The kinds of blocker: a closed list. */
export const BLOCKER_KINDS = ["trigger", "runner", "condition", "continue-on-error", "inline-script", "shell-logic", "expression", "action", "checkout-options", "matrix-from-output", "output", "step-id", "environment-url", "working-directory"] as const;
/** One kind of blocker. */
export type BlockerKind = (typeof BLOCKER_KINDS)[number];

/** One reason a part of a workflow is not what the emitter writes: the job (empty for the workflow), its kind and what it is. */
export type Blocker = { readonly job: string; readonly kind: BlockerKind; readonly why: string };

const THIN_USES = new Set(["actions/checkout@v4", "./.github/actions/bun"]);
const SHELL_LOGIC = /[|;&<>`]|\$\(|\bif\b|\bfor\b|\bthen\b|\bcase\b/u;
const WIRING = /^\$\{\{ (?:inputs\.[a-z0-9-]+|secrets\.[A-Za-z0-9_]+|matrix\.member) \}\}$/u;

function stepBlockers(job: string, s: Step): readonly Blocker[] {
  const out: Blocker[] = [];
  const add = (kind: BlockerKind, why: string): void => void out.push({ job, kind, why });
  if (s.continueOnError === true) add("continue-on-error", "a step that may fail without failing its job");
  if (s.when !== undefined) add("condition", `a condition on a step: ${s.when}`);
  if (s.id !== undefined) add("step-id", `a step with an id (${s.id}), whose outputs another step may read`);
  if (s.workingDirectory !== undefined) add("working-directory", `a working directory (${s.workingDirectory})`);
  for (const [k, v] of Object.entries(s.env ?? {})) if (typeof v === "string" && v.includes("${{") && !WIRING.test(v)) add("expression", `the environment ${k} holds an expression: ${v}`);
  if (s.kind === "uses") {
    if (!THIN_USES.has(s.uses)) add("action", `an action that is not the checkout or the setup: ${s.uses}`);
    else if (s.with !== undefined) add("checkout-options", `${s.uses} with ${Object.keys(s.with).join(", ")}`);
  } else {
    const lines = s.run.split("\n").filter((l) => l.trim() !== "");
    if (lines.length > 1) add("inline-script", `a script of ${lines.length} lines`);
    else if (SHELL_LOGIC.test(lines[0] ?? "")) add("shell-logic", `a line with shell logic: ${(lines[0] ?? "").slice(0, 60)}`);
    else if ((lines[0] ?? "").includes("${{")) add("expression", "an expression in a line that runs");
  }
  return out;
}

function jobBlockers(id: string, j: Job): readonly Blocker[] {
  const out: Blocker[] = [];
  const add = (kind: BlockerKind, why: string): void => void out.push({ job: id, kind, why });
  if (j.runsOn !== "ubuntu-24.04" && j.runsOn !== "ubuntu-latest") add("runner", `a runner other than Linux: ${j.runsOn}`);
  if (j.when !== undefined) add("condition", `a condition on the job: ${j.when}`);
  if (j.outputs !== undefined) add("output", `outputs of the job: ${Object.keys(j.outputs).join(", ")}`);
  if (typeof j.strategy?.matrix === "string") add("matrix-from-output", "a matrix that a job gives at run time, with no fixed list");
  if (j.environment?.url !== undefined) add("environment-url", "an environment with an address read at run time");
  for (const s of j.steps) out.push(...stepBlockers(id, s));
  return out;
}

/** Every reason the workflow, and each job of it, is not what the emitter writes. An empty list is a workflow that a graph can make with the same bytes. */
export function thinBlockers(w: Workflow): readonly Blocker[] {
  const out: Blocker[] = [];
  for (const k of ["push", "pullRequest", "workflowCall", "workflowRun"] as const) if (w.on[k] !== undefined) out.push({ job: "", kind: "trigger", why: `the trigger ${k}, which no trigger of a workload has` });
  if (w.concurrency !== undefined && w.concurrency.group !== w.file) out.push({ job: "", kind: "expression", why: `a concurrency group that is no fixed name: ${w.concurrency.group}` });
  for (const [id, j] of Object.entries(w.jobs)) out.push(...jobBlockers(id, j));
  return out;
}
