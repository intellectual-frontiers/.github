// Spec: 0005-grc-runners FR-001, FR-002, FR-003
/**
 * The runner port (0005-grc-runners): a runner answers the question of a check, given the check's input, and says what it observed. The registry holds runners by their kind, which is their id; a
 * runner is made by the unit that owns it from whatever it needs (a connection, a reader, a client), given as a small interface, so that this layer depends on none of them. `runCheck` makes the
 * `grc.result` of a check on a subject: applicability, the runner, the judgement of what it observed, and never an exception.
 *
 * @example
 * ```ts
 * import { createRunners, runCheck } from "./runner.ts";
 * const runners = createRunners();
 * // runners.register(sqlRunner(connection)); runCheck(runners, check, { id: "host-1", platform: "linux" }, clock)
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, createRegistry, type Json, type Registry } from "@intellectual-frontiers/grc/governance";
import { evaluate, type Result as Outcome, type Status } from "@intellectual-frontiers/grc/logical";

/** What a check is run on. */
export type Subject = { readonly id: string; readonly platform: string; readonly attributes?: Readonly<Record<string, string>> };

/** What a runner is told besides the check. */
export type RunContext = {
  readonly subject: Subject;
  /** The clock: an ISO 8601 instant. */
  readonly now: () => string;
  /** How long a run may take. */
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
};

/** What a runner observed; a runner that decides for itself (a person who has not answered) says so in `decided`. */
export type Observation = {
  readonly value: Json;
  readonly observedAt: string;
  /** How it was observed, in words. */
  readonly via: string;
  readonly tookMs: number;
  readonly decided?: { readonly status: Status; readonly reason: string };
};

/** Why a runner gave no observation. */
export type RunnerProblem = { readonly kind: "refused" | "failed" | "unavailable" | "timeout"; readonly message: string };

/** A runner: its id is the kind a check names. A runner reads and never writes. */
export type Runner = {
  readonly id: string;
  run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>>;
};

/** A registry of runners. */
export type Runners = Registry<Runner>;

/** A registry of runners, empty. */
export function createRunners(): Runners {
  return createRegistry<Runner>("runner");
}

/** Whether a check applies to a platform: it names none, or `any`, or the platform. */
export function applies(check: Check, platform: string): boolean {
  return check.platforms.length === 0 || check.platforms.includes("any") || check.platforms.includes(platform);
}

function resultOf(check: Check, ctx: RunContext, status: Status, reason: string, at: string, extra: { readonly value?: Json; readonly via?: string } = {}): Outcome {
  return {
    kind: "grc.result",
    schema: "1",
    id: `result:${check.id}:${ctx.subject.id}:${at}`,
    createdAt: at,
    provenance: { producer: { name: "@intellectual-frontiers/grc", version: "0.2.0" }, inputs: [check.id] },
    check: check.id,
    controls: check.controls,
    subject: ctx.subject.id,
    status,
    severity: check.severity ?? "medium",
    reason,
    observedAt: at,
    ...(extra.value === undefined ? {} : { value: extra.value }),
    ...(extra.via === undefined ? {} : { via: extra.via }),
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<Result<T, RunnerProblem>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(err({ kind: "timeout", message: `the run took longer than ${ms} ms` })), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(ok(v));
      },
      (e: unknown) => {
        clearTimeout(timer);
        resolve(err({ kind: "failed", message: e instanceof Error ? e.message : String(e) }));
      },
    );
  });
}

/** The result of one check on one subject: `not-applicable` where the platform is not one it applies to, `error` where there is no runner, the runner fails or throws, else the judgement of what was observed. */
export async function runCheck(runners: Runners, check: Check, ctx: RunContext): Promise<Outcome> {
  const at = ctx.now();
  if (!applies(check, ctx.subject.platform)) return resultOf(check, ctx, "not-applicable", `the check applies to ${check.platforms.join(", ")}, not ${ctx.subject.platform}`, at);
  const runner = runners.get(check.runner.kind);
  if (runner === undefined) return resultOf(check, ctx, "error", `no runner of the kind ${check.runner.kind} is registered`, at);
  const ran = await withTimeout(Promise.resolve().then(() => runner.run(check, ctx)), ctx.timeoutMs);
  const got = ran.kind === "err" ? ran : ran.value;
  if (got.kind === "err") return resultOf(check, ctx, "error", `${got.error.kind}: ${got.error.message}`, at);
  const o = got.value;
  if (o.decided !== undefined) return resultOf(check, ctx, o.decided.status, o.decided.reason, o.observedAt, { value: o.value, via: o.via });
  const j = evaluate(check.expect, o.value);
  return resultOf(check, ctx, j.status, j.reason, o.observedAt, { value: o.value, via: o.via });
}

/** The results of every check on every subject, in the order of the checks and then the subjects; one that fails does not stop the others. */
export async function runChecks(
  runners: Runners,
  checks: readonly Check[],
  subjects: readonly Subject[],
  options: { readonly now: () => string; readonly timeoutMs: number; readonly signal?: AbortSignal },
): Promise<readonly Outcome[]> {
  const out: Outcome[] = [];
  for (const check of checks) {
    for (const subject of subjects) {
      out.push(await runCheck(runners, check, { subject, ...options }));
    }
  }
  return out;
}
