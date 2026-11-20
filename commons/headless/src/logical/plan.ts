// Spec: 0012-executor-check-mode FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * Plan versus apply (commons headless 0012-executor-check-mode): what an `Executor` is asked to do is a plan of steps, and a plan is run in one of two modes, `check` (change nothing; say what
 * would change) or `apply` (do it). A step names the argument vector of each mode (the real tool's own check mode: `ansible --check`, `tofu plan`), so a tool without a check mode has none and is
 * reported as unsupported, never run as an apply. The plan has a canonical form and a SHA-256 hash that a signer can sign and a verifier recompute (`planHash`); an apply names the hash it was
 * approved for and is refused where the plan is not that one. A run streams typed events (`started`, `line`, `progress`, `finished`) to a surface as it goes, and ends in a typed result.
 *
 * @remarks
 * Pure but for the executor it is given: `planOf`, `canonicalOf`, `planHash`, `describePlan`, `progressOf` and `overallOf` touch nothing; `runPlan` calls `executor.exec` and the clock and the
 * terminal are not its business. No signing is done here and no key is held. A plan holds no secret: its argument vectors are hashed, written and shown, so a credential is given to a step through the
 * run's environment (`RunOptions.env`) or the askpass helper, never in `argv`.
 *
 * @example
 * ```ts
 * import { parseStepId, planOf, planHash } from "./plan.ts";
 * const id = parseStepId("keys");
 * const plan = id.kind === "ok" ? planOf("host-1", [{ id: id.value, summary: "Keys.", effect: "mutate", apply: ["ansible-playbook", "keys.yml"], check: ["ansible-playbook", "--check", "keys.yml"] }]) : undefined;
 * plan?.kind === "ok" && planHash(plan.value).startsWith("sha256:"); // true
 * ```
 *
 * @module
 */
import { absurd, err, ok, refine, string, type Brand, type Result } from "@intellectual-frontiers/core";
import { problem, type Effect } from "@intellectual-frontiers/headless/governance";
import type { Executor, RunOptions } from "./executor.ts";
import type { ProgressEvent } from "./model.ts";
import { sha256Hex } from "./sha256.ts";

/** What a run does: look and change nothing (`check`), or do it (`apply`). */
export type ExecMode = "check" | "apply";

/** The identity of a step in a plan, stable across runs: made only by `parseStepId`. */
export type StepId = Brand<string, "step id">;

const stepDecoder = refine(string, "step id", (t) => /^[a-z0-9][a-z0-9._:-]{0,99}$/.test(t));

/** A step id from text, or why the text is not one: the one way a `StepId` is made. */
export function parseStepId(text: string): Result<StepId, string> {
  const r = stepDecoder(text, "step");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a step id: 1 to 100 of a-z, 0-9, dot, colon, underscore and hyphen, starting with a letter or digit`);
}

/** One step of a plan: what it is, what it does to the world, and the argument vector of each mode. */
export type ExecStep = {
  readonly id: StepId;
  readonly summary: string;
  readonly effect: Effect;
  /** The argument vector that does it. */
  readonly apply: readonly string[];
  /** The argument vector that looks and changes nothing; none where the tool has no check mode. */
  readonly check: readonly string[] | undefined;
  /** The exit status of the check vector that means something would change (`tofu plan -detailed-exitcode` gives 2); where it is not given a check that succeeds means nothing would. */
  readonly changedExit?: number;
};

/** A plan: the target it is for and its steps in order. */
export type ExecutionPlan = {
  readonly format: "headless-plan/1";
  readonly target: string;
  readonly steps: readonly ExecStep[];
};

/** What is wrong with a plan. */
export type PlanProblem =
  | { readonly rule: "plan/target"; readonly message: string }
  | { readonly rule: "plan/empty"; readonly message: string }
  | { readonly rule: "plan/duplicate-step"; readonly id: string; readonly message: string }
  | { readonly rule: "plan/argv"; readonly id: string; readonly message: string }
  | { readonly rule: "plan/destructive-no-check"; readonly id: string; readonly message: string }
  | { readonly rule: "plan/changed-exit"; readonly id: string; readonly message: string };

/** A plan from its steps, or everything wrong with it. */
export function planOf(target: string, steps: readonly ExecStep[]): Result<ExecutionPlan, readonly PlanProblem[]> {
  const problems: PlanProblem[] = [];
  if (target.trim() === "") problems.push({ rule: "plan/target", message: "a plan is for a target" });
  if (steps.length === 0) problems.push({ rule: "plan/empty", message: "a plan has at least one step" });
  const seen = new Set<string>();
  for (const s of steps) {
    if (seen.has(s.id)) problems.push({ rule: "plan/duplicate-step", id: s.id, message: `${s.id} is a step twice` });
    seen.add(s.id);
    for (const [name, argv] of [["apply", s.apply], ["check", s.check]] as const) {
      if (argv !== undefined && (argv.length === 0 || argv[0] === "" || argv.some((w) => w.includes("\u0000")))) problems.push({ rule: "plan/argv", id: s.id, message: `${s.id} has an empty or malformed ${name} vector` });
    }
    if (s.effect === "destructive" && s.check === undefined) problems.push({ rule: "plan/destructive-no-check", id: s.id, message: `${s.id} destroys something, so it must be able to check first` });
    if (s.changedExit !== undefined && (!Number.isInteger(s.changedExit) || s.changedExit < 1 || s.changedExit > 255)) problems.push({ rule: "plan/changed-exit", id: s.id, message: `${s.id} names ${String(s.changedExit)} as the exit that means a change: 1 to 255` });
  }
  return problems.length > 0 ? err(problems) : ok({ format: "headless-plan/1", target, steps });
}

/** The canonical form of a plan: JSON with the keys of every object in order, no space, the steps and vectors in their order: the same plan is the same text on every runtime. */
export function canonicalOf(plan: ExecutionPlan): string {
  const words = (v: readonly string[] | undefined): string => (v === undefined ? "null" : `[${v.map((w) => JSON.stringify(w)).join(",")}]`);
  const step = (s: ExecStep): string =>
    `{"apply":${words(s.apply)},"changedExit":${s.changedExit === undefined ? "null" : String(s.changedExit)},"check":${words(s.check)},"effect":${JSON.stringify(s.effect)},"id":${JSON.stringify(s.id)},"summary":${JSON.stringify(s.summary)}}`;
  return `{"format":${JSON.stringify(plan.format)},"steps":[${plan.steps.map(step).join(",")}],"target":${JSON.stringify(plan.target)}}`;
}

/** The hash of a plan, `sha256:` and 64 hexadecimal digits: made only by `planHash` or `parsePlanHash`. */
export type PlanHash = Brand<string, "plan hash">;

const hashDecoder = refine(string, "plan hash", (t) => /^sha256:[0-9a-f]{64}$/.test(t));

/** A plan hash from text (as a signature carries it), or why the text is not one. */
export function parsePlanHash(text: string): Result<PlanHash, string> {
  const r = hashDecoder(text, "hash");
  return r.kind === "ok" ? ok(r.value) : err(`${JSON.stringify(text)} is not a plan hash: sha256: and 64 lower-case hexadecimal digits`);
}

/** The hash of a plan: SHA-256 of its canonical form. */
export function planHash(plan: ExecutionPlan): PlanHash {
  const r = parsePlanHash(`sha256:${sha256Hex(canonicalOf(plan))}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** What one step ended as. */
export type StepOutcome = "unchanged" | "changed" | "applied" | "failed" | "unsupported" | "skipped";

/** One step's result. */
export type StepResult = {
  readonly id: StepId;
  readonly mode: ExecMode;
  readonly outcome: StepOutcome;
  /** Its exit status; none where it did not run or could not. */
  readonly code: number | undefined;
};

/** What a run is told to a surface while it goes. */
export type ExecEvent =
  | { readonly kind: "started"; readonly step: StepId; readonly summary: string; readonly mode: ExecMode; readonly index: number; readonly total: number }
  | { readonly kind: "line"; readonly step: StepId; readonly stream: "stdout" | "stderr"; readonly text: string }
  | { readonly kind: "progress"; readonly done: number; readonly total: number }
  | { readonly kind: "finished"; readonly result: StepResult };

/** What a whole run ended as: nothing would change, something would (check), it was applied, a step failed, or it is incomplete (a step is unsupported or was skipped). */
export type ExecOutcome = "unchanged" | "changed" | "applied" | "failed" | "incomplete";

/** The result of a run. */
export type ExecutionResult = { readonly mode: ExecMode; readonly planHash: PlanHash; readonly steps: readonly StepResult[]; readonly outcome: ExecOutcome };

/** What approves an apply: the hash of the plan that a person (or a policy) approved, or an explicit statement that nothing was signed. */
export type Approval = { readonly kind: "hash"; readonly hash: PlanHash } | { readonly kind: "unsigned" };

/** What a run is asked: a check, or an apply with its approval. */
export type RunRequest = { readonly mode: "check" } | { readonly mode: "apply"; readonly approval: Approval };

/** Why a run did not start. */
export type ExecError = { readonly kind: "plan-changed"; readonly approved: PlanHash; readonly actual: PlanHash };

/** What a run is given besides the plan. */
export type RunPlanOptions = {
  /** What each step runs with (the working folder, the environment); never part of the plan or its hash. */
  readonly run?: RunOptions;
  /** Told as it goes. */
  readonly onEvent?: (event: ExecEvent) => void;
  /** Whether a failed step stops the rest, which are then skipped; true by default. */
  readonly stopOnFailure?: boolean;
  readonly signal?: AbortSignal;
};

/** The argument vector of a step in a mode; none where the tool has no check mode. */
export function argvOf(step: ExecStep, mode: ExecMode): readonly string[] | undefined {
  switch (mode) {
    case "check":
      return step.check;
    case "apply":
      return step.apply;
    default:
      return absurd(mode);
  }
}

/** What a run ended as, from its steps. */
export function overallOf(steps: readonly StepResult[]): ExecOutcome {
  if (steps.some((s) => s.outcome === "failed")) return "failed";
  if (steps.some((s) => s.outcome === "unsupported" || s.outcome === "skipped")) return "incomplete";
  if (steps.some((s) => s.outcome === "applied")) return "applied";
  return steps.some((s) => s.outcome === "changed") ? "changed" : "unchanged";
}

/** The lines of a stream's text, without the line ends and without a last empty line. */
function linesOf(text: string): readonly string[] {
  const parts = text.split(/\r?\n/);
  return parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts;
}

/**
 * Runs a plan on an executor in a mode. `check` runs each step's check vector and never an apply vector (a step with none is `unsupported`); `apply` runs each step's apply vector, and where it was
 * approved by a hash that is not the plan's gives `plan-changed` and runs nothing. Each step is a started event, its lines as they come (or, from an executor that does not stream, from its output at the
 * end), a finished event, and a progress event; the result is the steps' results and the run's outcome. An executor that throws makes that step `failed`, never the run.
 */
export async function runPlan(executor: Executor, plan: ExecutionPlan, request: RunRequest, o: RunPlanOptions = {}): Promise<Result<ExecutionResult, ExecError>> {
  const hash = planHash(plan);
  if (request.mode === "apply" && request.approval.kind === "hash" && request.approval.hash !== hash) {
    return err({ kind: "plan-changed", approved: request.approval.hash, actual: hash });
  }
  const mode: ExecMode = request.mode;
  const tell = (e: ExecEvent): void => o.onEvent?.(e);
  const total = plan.steps.length;
  const results: StepResult[] = [];
  let stop = false;
  for (const [index, step] of plan.steps.entries()) {
    tell({ kind: "started", step: step.id, summary: step.summary, mode, index, total });
    const argv = argvOf(step, mode);
    let result: StepResult;
    if (stop || o.signal?.aborted === true) result = { id: step.id, mode, outcome: "skipped", code: undefined };
    else if (argv === undefined) result = { id: step.id, mode, outcome: "unsupported", code: undefined };
    else {
      let streamed = false;
      try {
        const out = await executor.exec(argv, {
          ...o.run,
          stdout: "piped",
          stderr: "piped",
          ...(o.signal === undefined ? {} : { signal: o.signal }),
          onLine: (stream, text) => {
            streamed = true;
            tell({ kind: "line", step: step.id, stream, text });
            o.run?.onLine?.(stream, text);
          },
        });
        if (!streamed) {
          const decoder = new TextDecoder();
          for (const text of linesOf(decoder.decode(out.stdout))) tell({ kind: "line", step: step.id, stream: "stdout", text });
          for (const text of linesOf(decoder.decode(out.stderr))) tell({ kind: "line", step: step.id, stream: "stderr", text });
        }
        if (mode === "check") {
          const outcome: StepOutcome = out.code === 0 ? "unchanged" : out.code === step.changedExit ? "changed" : "failed";
          result = { id: step.id, mode, outcome, code: out.code };
        } else result = { id: step.id, mode, outcome: out.success ? "applied" : "failed", code: out.code };
      } catch {
        result = { id: step.id, mode, outcome: "failed", code: undefined };
      }
      if (result.outcome === "failed" && o.stopOnFailure !== false) stop = true;
    }
    results.push(result);
    tell({ kind: "finished", result });
    tell({ kind: "progress", done: index + 1, total });
  }
  return ok({ mode, planHash: hash, steps: results, outcome: overallOf(results) });
}

/** What a surface shows of a plan: its target, its hash, and a line for each step with what it does and whether it can be checked. Pure text, no colour. */
export function describePlan(plan: ExecutionPlan): readonly string[] {
  const out = [`plan for ${plan.target}`, `hash ${planHash(plan)}`];
  for (const [i, s] of plan.steps.entries()) out.push(`${String(i + 1).padStart(2, " ")}. ${s.id}  ${s.summary} [${s.effect}${s.check === undefined ? ", cannot be checked" : ""}]`);
  return out;
}

/** The progress event a command forwards for an execution event, or none where the event adds nothing the surface does not already show. */
export function progressOf(event: ExecEvent): ProgressEvent | undefined {
  switch (event.kind) {
    case "started":
      return { kind: "step", n: event.index + 1, total: event.total, label: event.summary };
    case "line":
      return { kind: "live", message: event.text };
    case "progress":
      return undefined;
    case "finished": {
      const r = event.result;
      switch (r.outcome) {
        case "unchanged":
          return { kind: "item", item: "ok", message: `${r.id}: nothing would change` };
        case "changed":
          return { kind: "item", item: "change", message: `${r.id}: would change` };
        case "applied":
          return { kind: "item", item: "change", message: `${r.id}: applied` };
        case "failed":
          return { kind: "problem", problem: problem("fail", `${r.id} failed${r.code === undefined ? "" : ` with status ${r.code}`}`, { code: "E1-EXEC-STEP" }) };
        case "unsupported":
          return { kind: "item", item: "note", message: `${r.id}: the tool has no check mode, so it was not run` };
        case "skipped":
          return { kind: "item", item: "skip", message: `${r.id}: skipped` };
        default:
          return absurd(r.outcome);
      }
    }
    default:
      return absurd(event);
  }
}
