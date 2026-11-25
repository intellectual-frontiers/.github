// Spec: 0010-workload-runners FR-011, FR-012, FR-016; 0014-runner-github-actions FR-002, FR-003, FR-009; 0015-schedule-realization FR-004, FR-005
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
import { type Call, type CallPlan, type Finding, finding, isSafeText, type PlanStep, type Runner, type RunnerRegistry, RUNNERS, type Trigger } from "@intellectual-frontiers/workload/governance";

/** What the emitter of GitHub Actions is given besides the plan: where the jobs run, how long they may take, the pinned actions that every job starts with, and the table of pinned commands by verb id. */
export type GithubOptions = {
  /** The runner of every job; `ubuntu-24.04` where none is given. */
  readonly runsOn?: "ubuntu-latest" | "ubuntu-24.04";
  /** The time a job may take where its node says none; 15 minutes where none is given. */
  readonly timeoutMinutes?: number;
  /** The action that checks the repository out, pinned: `actions/checkout@v4` where none is given. */
  readonly checkout?: string;
  /** The actions that every job runs after the checkout (the setup of the pinned verb command), each pinned to a tag or a full commit. */
  readonly setup?: readonly { readonly uses: string; readonly with?: Readonly<Record<string, string | number | boolean>> }[];
  /** The pinned command of a verb by its id, as the words of one command (`["bun", "tools/check.ts"]`): the call is those words and its arguments, where the table has the verb, and `<cli> verb <id>` where it has not. */
  readonly commands?: Readonly<Record<string, readonly string[]>>;
  /** Whether the workflow carries the plan hash (a comment, the first line says that the workload generated it, and the environment variable `WORKLOAD_PLAN`): true where none is given. Without it the file is only what the plan says. */
  readonly provenance?: boolean;
};

/** Where and how a scheduled workload is installed on a host: the target system (`linux`; `windows` is refused), the absolute path the artifact has on the host and the file of the environment of the unit, which holds the inputs and the names of the credentials a host gives (never a value here). */
export type ScheduleOptions = { readonly target?: "linux" | "windows"; readonly path?: string; readonly environmentFile?: string };

/** What an emitter is given besides the plan: the name of the pinned verb command the artifact calls, and, where it is known, the trigger of the workload, the options of GitHub Actions and those of a schedule. */
export type EmitOptions = { readonly cli: string; readonly trigger?: Trigger; readonly github?: GithubOptions; readonly schedule?: ScheduleOptions };

/** A file of a schedule: its name and its text. */
export type ScheduleFile = { readonly path: string; readonly text: string };

/** The name of the verb command where none is given: the program of this library. */
export const DEFAULT_CLI = "workload";

/** The trigger of kind `schedule`. */
export type ScheduleTrigger = Extract<Trigger, { readonly kind: "schedule" }>;

/**
 * An emitter: the runner it belongs to, the extension of its artifact and the function that renders a plan of calls (already checked) and its hash as the text of the artifact. It may also say what else keeps a plan from being rendered
 * for its platform (`problems`), and render the files that start the artifact on a schedule (`schedule`); a runner that carries the schedule inside its artifact, as GitHub does, has none.
 */
export type EmitterImpl = {
  readonly runner: Runner;
  readonly extension: string;
  render(plan: CallPlan, hash: string, options: EmitOptions): string;
  problems?(plan: CallPlan, options: EmitOptions): readonly Finding[];
  schedule?(plan: CallPlan, hash: string, trigger: ScheduleTrigger, options: EmitOptions): Result<readonly ScheduleFile[], readonly Finding[]>;
};

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
  const step = (s: PlanStep): void => {
    if (s.kind === "call") call(s);
    else {
      text(s.step, "the id of a step", s.step, ID);
      text(s.step, "what a loop fans out over", s.over, ID);
      for (const m of s.members) text(s.step, "a member of the list", m);
      for (const c of s.body) call(c);
    }
  };
  for (const s of plan.steps) step(s);
  for (const j of plan.jobs ?? []) {
    text(j.id, "the id of a job", j.id, ID);
    text(j.id, "the title of a job", j.title);
    for (const n of j.needs) text(j.id, "a job it needs", n, ID);
    for (const [scope, level] of Object.entries(j.permissions)) {
      text(j.id, "a scope of permissions", scope, ID);
      text(j.id, "a level of permissions", level, /^(?:read|write)$/u);
    }
    if (j.environment !== undefined) text(j.id, "the environment of a gate", j.environment, ID);
    for (const c of j.credentials) text(j.id, "the name of a credential", c, CREDENTIAL);
  }
  return out;
}
