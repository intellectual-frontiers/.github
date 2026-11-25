// Spec: 0010-workload-runners FR-011, FR-012, FR-016
/**
 * What every emitter of an integration runner shares: the contract of an emitter (it renders the plan of calls it is given, with the plan hash, and nothing else), its registration (an emitter belongs to a registered
 * runner of the kind `integration`, once), and the check of a plan before any emitter renders it: every text an artifact would hold is printable ASCII, and the shapes an artifact quotes (an id, a name of an input or of a
 * credential, the command) are the plain words they must be. A plan that passes this can be quoted by an emitter so that no value changes how the script is read. Pure.
 *
 * @example
 * ```ts
 * import { inputVariable } from "./emit.ts";
 * inputVariable("order"); // "WORKLOAD_INPUT_ORDER"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Call, type CallPlan, type Finding, finding, isSafeText, type Runner, type RunnerRegistry, RUNNERS } from "@intellectual-frontiers/workload/governance";

/** What an emitter is given besides the plan: the name of the pinned verb command the artifact calls. */
export type EmitOptions = { readonly cli: string };

/** The name of the verb command where none is given: the program of this library. */
export const DEFAULT_CLI = "workload";

/** An emitter: the runner it belongs to, the extension of its artifact and the function that renders a plan of calls (already checked) and its hash as the text of the artifact. */
export type EmitterImpl = { readonly runner: Runner; readonly extension: string; render(plan: CallPlan, hash: string, options: EmitOptions): string };

/** An emitter registered: the list with one more, or why not (an id twice, or a runner that is not an integration runner of the registry). */
export function registerEmitter(impls: readonly EmitterImpl[], impl: EmitterImpl, registry: RunnerRegistry = RUNNERS): Result<readonly EmitterImpl[], string> {
  if (impls.some((i) => i.runner.id === impl.runner.id)) return err(`the runner ${impl.runner.id} has an emitter already`);
  const known = registry.get(impl.runner.id);
  if (known === undefined) return err(`the runner ${impl.runner.id} is not in the registry of runners`);
  if (known.kind !== "integration") return err(`the runner ${impl.runner.id} is not an integration runner: only an integration runner has an emitter`);
  return ok([...impls, impl]);
}

/** The name of the environment variable an input of the run is read from: `WORKLOAD_INPUT_` and the name in upper case with its hyphens as underscores. */
export const inputVariable = (name: string): string => `WORKLOAD_INPUT_${name.toUpperCase().replaceAll("-", "_")}`;

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const VERB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const ARG = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const CREDENTIAL = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const COMMAND = /^[A-Za-z][A-Za-z0-9._-]*$/u;

/** The findings that keep a plan from being written into an artifact: a text that is not printable ASCII (`E-WL-RUNNER-VALUE-UNSAFE`). An empty list is a plan an emitter may render. */
export function planProblems(plan: CallPlan, options: EmitOptions): readonly Finding[] {
  const out: Finding[] = [];
  const bad = (node: string, what: string, value: string): void => void out.push(finding("E-WL-RUNNER-VALUE-UNSAFE", node, `${what} is not what an artifact may hold: ${JSON.stringify(value.slice(0, 40))}`));
  const text = (node: string, what: string, value: string, pattern?: RegExp): void => {
    if (!isSafeText(value) || (pattern !== undefined && !pattern.test(value))) bad(node, what, value);
  };
  text("", "the command", options.cli, COMMAND);
  text("", "the id of the workload", plan.workload, ID);
  text("", "the version of the workload", plan.version);
  for (const i of plan.inputs) text("", "the name of an input", i, ID);
  for (const c of plan.credentials) text("", "the name of a credential", c, CREDENTIAL);
  const call = (c: Call): void => {
    text(c.step, "the id of a step", c.step, ID);
    text(c.step, "the id of a verb", c.verb, VERB);
    for (const a of c.args) {
      text(c.step, "the name of an argument", a.name, ARG);
      if (a.value.kind === "literal") text(c.step, `the value of ${a.name}`, a.value.text);
      else text(c.step, `the input ${a.value.name}`, a.value.name, ID);
    }
  };
  for (const s of plan.steps) {
    if (s.kind === "call") call(s);
    else {
      text(s.step, "the id of a step", s.step, ID);
      text(s.step, "what a loop fans out over", s.over, ID);
      for (const m of s.members) text(s.step, "a member of the list", m);
      for (const c of s.body) call(c);
    }
  }
  return out;
}
