/**
 * The typed model of a GitHub Actions workflow (commons 0030-generated-workflows FR-002, FR-005): the triggers, the jobs, the steps, the strategy, the permissions and the
 * concurrency of a workflow as values the compiler checks, so that a step that is neither `uses` nor `run`, a job with no step, a permission that is neither `read` nor `write` or an
 * expression written as a plain string is a type error, and a mistake the types cannot say (an action with no version, a job that needs a job that is not there) is a finding of `validateWorkflow`.
 * The files GitHub reads are made from these values by `render.ts`; nothing here reads or writes a file.
 *
 * @remarks
 * An expression is made with `expr("matrix.os")`, which gives `${{ matrix.os }}` and a type of its own, so that a string that is meant to be read by the runner is told from one that is not. A step is a
 * `uses` step or a `run` step (`use(...)` and `run(...)`), a job has its steps as a non-empty tuple, and a workflow has its jobs by id, in the order they are written. The condition of a job or a
 * step (`if`) is the text of an expression without its `${{ }}`, as GitHub reads it.
 *
 * @limits
 * It models what this repository's workflows use: push, pull request, manual and reusable triggers, a job's matrix, permissions, environment, concurrency and the steps of a composite action. It
 * does not model every key GitHub knows; the schema GitHub's tools publish is the check of what is written (`tests/commons-workflows-schema.test.ts`), and a key the model lacks is added here,
 * where the compiler then asks every workflow about it.
 *
 * @example
 * ```ts
 * import { expr, job, run, use, validateWorkflow } from "./model.ts";
 * const w = { file: "x", name: "x", on: { push: {} }, jobs: { test: job({ runsOn: "ubuntu-latest", timeoutMinutes: 5, steps: [use("actions/checkout@v4"), run("bun test")] }) } };
 * validateWorkflow(w); // []
 * expr("matrix.os"); // "${{ matrix.os }}"
 * ```
 *
 * @module
 */

declare const expression: unique symbol;
/** A string the runner reads as an expression: `${{ ... }}`. */
export type Expr = string & { readonly [expression]: true };
/** The expression with the text `e` (`expr("matrix.os")` is `${{ matrix.os }}`). */
export const expr = (e: string): Expr => `\${{ ${e} }}` as Expr;

/** The runners the workflows of this repository ask for, or an expression that gives one (`expr("matrix.os")`). */
export type Runner = "ubuntu-latest" | "ubuntu-24.04" | "macos-latest" | "windows-latest" | Expr;

/** A value of a `with` or an `env`: a string, a number, a boolean or an expression. */
export type Scalar = string | number | boolean;

type StepCommon = {
  readonly name?: string;
  readonly id?: string;
  /** The text of the condition, without `${{ }}`. */
  readonly when?: string;
  readonly env?: Readonly<Record<string, Scalar>>;
  readonly workingDirectory?: string;
  readonly timeoutMinutes?: number;
  /** A comment written above the step. */
  readonly comment?: string;
};

/** A step that uses an action: `owner/name@version`, or `./path` for one of this repository's. */
export type UseStep = StepCommon & {
  readonly kind: "uses";
  readonly uses: string;
  readonly with?: Readonly<Record<string, Scalar>>;
};

/** A step that runs a script. */
export type RunStep = StepCommon & {
  readonly kind: "run";
  readonly run: string;
  readonly shell?: "bash" | "pwsh" | "sh";
};

export type Step = UseStep | RunStep;

/** A step that uses an action. */
export const use = (uses: string, o: Omit<UseStep, "kind" | "uses"> = {}): UseStep => ({ kind: "uses", uses, ...o });
/** A step that runs a script; a script of more than one line ends with a newline. */
export const run = (script: string, o: Omit<RunStep, "kind" | "run"> = {}): RunStep => ({ kind: "run", run: script, ...o });

/** The permissions of the token: each scope `read` or `write`. */
export type Permissions = Readonly<
  Partial<
    Record<
      "contents" | "pages" | "id-token" | "actions" | "packages" | "pull-requests" | "issues" | "checks" | "statuses",
      "read" | "write" | "none"
    >
  >
>;

/** The branches and paths a push or a pull request is run for; none is every one. */
export type Filter = { readonly branches?: readonly string[]; readonly paths?: readonly string[] };

export type Triggers = {
  readonly push?: Filter;
  readonly pullRequest?: Filter;
  /** Run by hand from the Actions page. */
  readonly workflowDispatch?: true;
  /** Called by another workflow. */
  readonly workflowCall?: true;
};

export type Strategy = {
  readonly failFast?: boolean;
  readonly matrix: Readonly<Record<string, readonly (string | number)[]>>;
};

export type Job = {
  readonly name?: string;
  readonly runsOn: Runner;
  readonly timeoutMinutes: number;
  readonly needs?: readonly string[];
  /** The text of the condition, without `${{ }}`. */
  readonly when?: string;
  readonly permissions?: Permissions;
  readonly environment?: { readonly name: string; readonly url?: string };
  readonly env?: Readonly<Record<string, Scalar>>;
  readonly strategy?: Strategy;
  readonly steps: readonly [Step, ...Step[]];
  /** A comment written above the job. */
  readonly comment?: string;
};

/** A job, written as a function so that its steps are read as a non-empty tuple. */
export const job = (j: Job): Job => j;

export type Workflow = {
  /** The file's name without its directory and extension: `data` is `.github/workflows/data.auto.yml`. */
  readonly file: string;
  /** The workflow's name, which a check's name begins with. */
  readonly name: string;
  /** A comment written under the name. */
  readonly comment?: string;
  readonly on: Triggers;
  readonly permissions?: Permissions;
  readonly env?: Readonly<Record<string, Scalar>>;
  readonly concurrency?: { readonly group: string; readonly cancelInProgress: boolean | Expr };
  /** The jobs by id, in the order they are written. */
  readonly jobs: Readonly<Record<string, Job>>;
};

/** A composite action, the file `action.yml` of a folder under `.github/actions/` (its name is fixed by GitHub, so it cannot carry `.auto.`). */
export type CompositeAction = {
  /** The folder of the action under `.github/actions/`. */
  readonly folder: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: Readonly<Record<string, { readonly description: string; readonly default?: string }>>;
  readonly steps: readonly [Step, ...Step[]];
};

/** An action's reference is `owner/name@version` or `./path`; a version is a tag (`v4`, `v1.2.3`) or a full commit (FR-005). */
const REFERENCE = /^(?:\.\/[\w./-]+|[\w.-]+\/[\w./-]+@(?:v?\d[\w.-]*|[0-9a-f]{40}))$/;

/** What is wrong with a step, one sentence each: an action with no version, an empty script, a working directory on a step that uses an action. */
export function stepFindings(s: Step, where: string): readonly string[] {
  const found: string[] = [];
  if (s.kind === "uses") {
    if (!REFERENCE.test(s.uses))
      found.push(
        `${where}: the action ${JSON.stringify(s.uses)} is not ./path or owner/name@version, a version of a tag or a commit (FR-005)`,
      );
    if (s.workingDirectory !== undefined) found.push(`${where}: a step that uses an action has no working directory`);
  } else if (s.run.trim() === "") found.push(`${where}: the script is empty`);
  return found;
}

/** What is wrong with a workflow, one sentence each: no trigger, a job that needs a job that is not there or itself, a step that is wrong, and a name that is not a file's. */
export function validateWorkflow(w: Workflow): readonly string[] {
  const found: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(w.file)) found.push(`${w.file}: the file's name is lower-case letters, digits and hyphens`);
  if (Object.keys(w.on).length === 0) found.push(`${w.file}: no trigger`);
  const ids = Object.keys(w.jobs);
  if (ids.length === 0) found.push(`${w.file}: no job`);
  for (const [id, j] of Object.entries(w.jobs)) {
    for (const n of j.needs ?? []) {
      if (n === id) found.push(`${w.file}: job ${id} needs itself`);
      else if (!ids.includes(n)) found.push(`${w.file}: job ${id} needs ${n}, which is no job`);
    }
    j.steps.forEach((s, i) => found.push(...stepFindings(s, `${w.file}: job ${id}, step ${i + 1}`)));
  }
  return found;
}

/** What is wrong with a composite action, as `validateWorkflow` says of a workflow. */
export function validateAction(a: CompositeAction): readonly string[] {
  return a.steps.flatMap((s, i) => [
    ...stepFindings(s, `.github/actions/${a.folder}: step ${i + 1}`),
    ...(s.kind === "run" && s.shell === undefined
      ? [`.github/actions/${a.folder}: step ${i + 1} runs a script and names no shell, which a composite action asks`]
      : []),
  ]);
}
