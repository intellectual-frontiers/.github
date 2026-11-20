// Spec: 0001-system FR-017
/**
 * The operating system's own scheduled job, installed and removed (commons 0005-typescript-runtime FR-046): `installJob` plans the job
 * with the kernel's `planJob`, writes its files under the home folder (making their folders, with their modes) and runs the commands that
 * load it; `removeJob` runs the commands that unload it, removes its files and runs what follows (systemd's `daemon-reload`). Each file and
 * each command is reported as an outcome, and the first failure that matters is a typed error carrying the outcomes until then; a
 * command marked `mayFail` (nothing to unload) never stops the rest. The scheduler, the home folder, the user's id and the program that
 * runs a command are parameters, defaulting to this computer's (`build.os`, `homeDir()`, `uid()`, `run`), so a test plans and installs any
 * scheduler's job in a temporary folder with a fake runner, and no real systemctl, launchctl or schtasks runs. Taken from Stolos's
 * `src/archon/export/schedule.ts` (`installJob`, `uninstallJob`), which took its file and command functions as dependencies and threw;
 * here the files go through `./fs.ts`, the commands through `./proc.ts` or a given runner, and errors are values.
 *
 * @example
 * ```ts
 * import { jobName, schedule } from "./job-plan.ts";
 * import { installJob } from "./schedule.ts";
 * const name = jobName("backup");
 * const when = schedule({ kind: "weekly", day: "sun", hour: 3, minute: 30 });
 * if (name.kind === "ok" && when.kind === "ok") {
 *   const r = await installJob({ name: name.value, owner: { domain: "org.example", folder: "Example" }, argv: ["/usr/bin/backup"], workdir: "/srv", when: when.value });
 *   if (r.kind === "err") console.error(r.error.kind);
 * }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type JobPlan, type JobSpec, planJob, type ScheduleError, type SchedulerOs, type Step } from "./job-plan.ts";
import { NotFound } from "./errors.ts";
import { mkdir, remove, writeTextFile } from "./fs.ts";
import { dirname, join } from "./path.ts";
import { build, homeDir, run, uid } from "./proc.ts";

/** What a command did: its exit status (127 where it could not be started) and what it said (standard error, else standard output, trimmed). */
export type StepResult = { readonly code: number; readonly output: string };

/** Runs one command by its argument vector; the default runs it with `./proc.ts`, a test gives a fake. Never rejects for a failure of the command. */
export type StepRunner = (argv: readonly string[]) => Promise<StepResult>;

/** The default runner: the program run with `run`, never through a shell; one that cannot be started gives status 127 and the reason. */
export const runStep: StepRunner = async (argv) => {
  try {
    const r = await run(argv);
    return { code: r.code, output: r.stderr.trim() === "" ? r.stdout.trim() : r.stderr.trim() };
  } catch (e) {
    return { code: 127, output: e instanceof Error ? e.message : String(e) };
  }
};

/** Where and how to install or remove a job; every field defaults to this computer. */
export type JobOptions = {
  /** The scheduler (`build.os` by default). */
  readonly os?: SchedulerOs;
  /** The user's home folder, under which the files go (`homeDir()` by default). */
  readonly home?: string;
  /** The user's numeric id, for launchctl's `gui/<uid>` domain (`uid()` by default). */
  readonly uid?: number;
  /** What runs each command (`runStep` by default). */
  readonly runner?: StepRunner;
};

/** One thing done: a file written or removed (its absolute path, and whether it was there), or a command run (its status and output). */
export type Outcome =
  | { readonly kind: "wrote"; readonly path: string }
  | { readonly kind: "removed"; readonly path: string; readonly existed: boolean }
  | { readonly kind: "ran"; readonly argv: readonly string[]; readonly code: number; readonly output: string; readonly mayFail: boolean };

/** A job installed or removed: its plan and what was done, in order. */
export type JobReport = { readonly plan: JobPlan; readonly outcomes: readonly Outcome[] };

/** Why installing or removing stopped, with what was done until then. */
export type JobError =
  | { readonly kind: "unsupported"; readonly os: string; readonly outcomes: readonly Outcome[] }
  | { readonly kind: "plan"; readonly error: ScheduleError; readonly outcomes: readonly Outcome[] }
  | { readonly kind: "write"; readonly path: string; readonly message: string; readonly outcomes: readonly Outcome[] }
  | { readonly kind: "remove"; readonly path: string; readonly message: string; readonly outcomes: readonly Outcome[] }
  | {
      readonly kind: "step";
      readonly argv: readonly string[];
      readonly code: number;
      readonly output: string;
      readonly outcomes: readonly Outcome[];
    };

/** A job error as one line. */
export function formatJobError(e: JobError): string {
  switch (e.kind) {
    case "unsupported":
      return `this OS (${e.os}) has no scheduler this module knows: Linux, macOS or Windows`;
    case "plan":
      return `${e.error.field}: ${e.error.message}`;
    case "write":
      return `could not write ${e.path}: ${e.message}`;
    case "remove":
      return `could not remove ${e.path}: ${e.message}`;
    case "step":
      return `${e.argv.join(" ")} failed (${e.code})${e.output === "" ? "" : `: ${e.output}`}`;
    default:
      return absurd(e);
  }
}

const SCHEDULERS: readonly string[] = ["linux", "darwin", "windows"];
const isScheduler = (os: string): os is SchedulerOs => SCHEDULERS.includes(os);

type Prepared = { readonly plan: JobPlan; readonly home: string; readonly runner: StepRunner };

function prepare(job: JobSpec, options: JobOptions): Result<Prepared, JobError> {
  const os = options.os ?? build.os;
  if (!isScheduler(os)) return err({ kind: "unsupported", os, outcomes: [] });
  const home = options.home ?? homeDir();
  const id = options.uid ?? uid();
  const plan = planJob(job, { os, home, ...(id === undefined ? {} : { uid: id }) });
  if (plan.kind === "err") return err({ kind: "plan", error: plan.error, outcomes: [] });
  return ok({ plan: plan.value, home, runner: options.runner ?? runStep });
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The commands run in turn, each an outcome; the first that fails and may not is the error. */
async function runSteps(steps: readonly Step[], runner: StepRunner, outcomes: Outcome[]): Promise<Result<void, JobError>> {
  for (const s of steps) {
    const r = await runner(s.argv);
    outcomes.push({ kind: "ran", argv: s.argv, code: r.code, output: r.output, mayFail: s.mayFail });
    if (r.code !== 0 && !s.mayFail) return err({ kind: "step", argv: s.argv, code: r.code, output: r.output, outcomes: [...outcomes] });
  }
  return ok(undefined);
}

/** A planned file's absolute path on this computer: the home folder and the parts of its relative path. */
const hostPath = (home: string, rel: string): string => join(home, ...rel.split("/"));

/** A job scheduled: planned, its files written (their folders made, their modes set), then the commands that load it run. */
export async function installJob(job: JobSpec, options: JobOptions = {}): Promise<Result<JobReport, JobError>> {
  const p = prepare(job, options);
  if (p.kind === "err") return p;
  const { plan, home, runner } = p.value;
  const outcomes: Outcome[] = [];
  for (const f of plan.files) {
    const path = hostPath(home, f.path);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeTextFile(path, f.content, f.mode === undefined ? {} : { mode: f.mode });
    } catch (e) {
      return err({ kind: "write", path, message: message(e), outcomes });
    }
    outcomes.push({ kind: "wrote", path });
  }
  const steps = await runSteps(plan.install, runner, outcomes);
  return steps.kind === "err" ? steps : ok({ plan, outcomes });
}

/** A job unscheduled: the commands that unload it run, its files removed (one already gone is no error), then what follows run. */
export async function removeJob(job: JobSpec, options: JobOptions = {}): Promise<Result<JobReport, JobError>> {
  const p = prepare(job, options);
  if (p.kind === "err") return p;
  const { plan, home, runner } = p.value;
  const outcomes: Outcome[] = [];
  const before = await runSteps(plan.remove, runner, outcomes);
  if (before.kind === "err") return before;
  for (const f of plan.files) {
    const path = hostPath(home, f.path);
    try {
      await remove(path);
      outcomes.push({ kind: "removed", path, existed: true });
    } catch (e) {
      if (!(e instanceof NotFound)) return err({ kind: "remove", path, message: message(e), outcomes });
      outcomes.push({ kind: "removed", path, existed: false });
    }
  }
  const after = await runSteps(plan.afterRemove, runner, outcomes);
  return after.kind === "err" ? after : ok({ plan, outcomes });
}
