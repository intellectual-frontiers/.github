// Spec: 0004-anyfs-cli-surfaces FR-010
/**
 * What the verbs that move bytes between stores share (commons anyfs-cli 0004-anyfs-cli-surfaces FR-010): the rails of a transfer from the command line and the defaults of the configuration, the plan of a directory
 * transfer through the bridge, the run of an apply with its events told as progress, and the check that the plan applied is the plan a person approved. The bridge does the work; this is what turns its refusals
 * and its report into the endings of a verb.
 *
 * @example
 * ```ts
 * import { PLAN_OPTIONS } from "./transfer.ts";
 * Object.keys(PLAN_OPTIONS).includes("planHash"); // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Context, type Outcome, outcomeOf } from "@intellectual-frontiers/headless/logical";
import { flag, integerText, many, value } from "@intellectual-frontiers/terminal/args";
import { type Glob, type Mode, parseGlob, type Plan, type Rails } from "@intellectual-frontiers/anyfs-bridge/governance";
import { type ApplyEvent, type ApplyOptions, applyStream, type ApplyRefusal, type DiffOptions, prepare, type Prepared, type Report } from "@intellectual-frontiers/anyfs-bridge/logical";
import { applyRefusalProblem, counted, destOf, type Host, movableOf, planLines, problemOf, refusalProblem, reportLines, sourceOf, usage } from "@intellectual-frontiers/anyfs-cli/logical";
import { prefixOfBound, type Bound } from "../bind.ts";

/** The options of every verb that plans a transfer. */
export const PLAN_OPTIONS = {
  include: many({ valueName: "GLOB", help: "Only paths that match a glob (a * is within one name, ** crosses directories); give it again for more." }),
  exclude: many({ valueName: "GLOB", help: "Leave out paths that match a glob; give it again for more." }),
  maxFiles: value({ parse: integerText, valueName: "N", help: "Refuse a plan that writes more than N files." }),
  maxBytes: value({ parse: integerText, valueName: "N", help: "Refuse a plan that writes more than N bytes." }),
  lossless: flag({ help: "Refuse a plan that would lose anything at the destination (a name it cannot keep, a case that folds)." }),
  concurrency: value({ parse: integerText, valueName: "N", help: "At most N actions at once (the configuration's by default)." }),
  planHash: value({ valueName: "HASH", help: "Apply only the plan with this hash, which a --dry-run printed: if the stores changed since, nothing is applied." }),
};

/** What the plan options hold. */
export type PlanFlags = {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly maxFiles: number | undefined;
  readonly maxBytes: number | undefined;
  readonly lossless: boolean;
  readonly concurrency: number | undefined;
  readonly planHash: string | undefined;
};

const globs = (texts: readonly string[]): Result<readonly Glob[], string> => {
  const out: Glob[] = [];
  for (const t of texts) {
    const g = parseGlob(t);
    if (g.kind === "err") return err(`${JSON.stringify(t)}: ${g.error}`);
    out.push(g.value);
  }
  return ok(out);
};

/** The rails a command line and the configuration give. */
export function railsOf(host: Host, f: PlanFlags): Result<Rails, string> {
  const include = globs(f.include);
  if (include.kind === "err") return include;
  const exclude = globs(f.exclude);
  if (exclude.kind === "err") return exclude;
  const max = host.config.defaults.maxObjectBytes;
  return ok({ ...(include.value.length > 0 ? { include: include.value } : {}), ...(exclude.value.length > 0 ? { exclude: exclude.value } : {}), ...(f.maxFiles === undefined ? {} : { maxFiles: f.maxFiles }), ...(f.maxBytes === undefined ? {} : { maxBytes: f.maxBytes }), ...(max === undefined ? {} : { maxObjectBytes: max }) });
}

/** The options of the plan of a transfer. */
export function diffOptionsOf(rails: Rails, f: Pick<PlanFlags, "lossless">): DiffOptions {
  return { rails, strict: f.lossless };
}

/** Plans a transfer of a directory of one store to a directory of another, in a mode. */
export async function planTransfer(mode: Mode, src: Bound, dst: Bound, options: DiffOptions): Promise<Result<Prepared, Outcome>> {
  const from = prefixOfBound(src);
  const to = prefixOfBound(dst);
  if (from.kind === "err") return err(usage(`${src.text}: ${from.error}`));
  if (to.kind === "err") return err(usage(`${dst.text}: ${to.error}`));
  const dest = destOf(dst.store);
  if (mode.kind === "check") {
    const a = sourceOf(src.store);
    const b = sourceOf(dst.store);
    if (a === undefined || b === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", "a check needs both stores to be read and listed")] }));
    const made = await prepare(mode, { store: a, prefix: from.value }, { store: b, prefix: to.value }, options);
    return made.kind === "ok" ? ok(made.value) : err(outcomeOf(null, { problems: [refusalProblem(made.error)] }));
  }
  if (dest === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${dst.text}: the store ${dst.store.id} cannot be written as a destination: it lacks read, write, list, stat or delete`)] }));
  if (mode.kind === "move") {
    const movable = movableOf(src.store);
    if (movable === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${src.text}: the store ${src.store.id} cannot be moved from: it lacks read, list, stat or delete`)] }));
    const made = await prepare(mode, { store: movable, prefix: from.value }, { store: dest, prefix: to.value }, options);
    return made.kind === "ok" ? ok(made.value) : err(outcomeOf(null, { problems: [refusalProblem(made.error)] }));
  }
  const source = sourceOf(src.store);
  if (source === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${src.text}: the store ${src.store.id} cannot be copied from: it lacks read, list or stat`)] }));
  const made = await prepare(mode, { store: source, prefix: from.value }, { store: dest, prefix: to.value }, options);
  return made.kind === "ok" ? ok(made.value) : err(outcomeOf(null, { problems: [refusalProblem(made.error)] }));
}

/** What a plan is as the outcome of a preview: its lines, its data and the command that applies it. */
export function previewOutcome(plan: Plan, command: string): Outcome {
  const next = plan.actions.some((a) => a.kind !== "skip") ? [`next: ${command} --yes --plan-hash ${plan.hash}`] : [];
  return outcomeOf({ plan }, { text: planLines(plan).join("\n"), next });
}

/** The ending of an apply that was approved by a hash that is no longer the plan's. */
export function staleOutcome(approved: string, found: string): Outcome {
  return outcomeOf(null, { problems: [problemOf("E-PLAN-STALE", `the plan approved is ${approved} and the plan made now is ${found}`)] });
}

/** Tells an event of an apply as progress. */
function tell(ctx: Context, e: ApplyEvent): void {
  if (e.kind === "planned") ctx.progress({ kind: "phase", name: `applying ${counted(e.actions, "action")}` });
  else if (e.kind === "outcome") ctx.progress({ kind: "item", item: e.outcome.status === "done" ? "change" : e.outcome.status === "skipped" ? "skip" : "note", message: `${e.outcome.status}: ${e.outcome.action.kind}` });
}

/** Applies a prepared plan, telling the events, and ends with the report or the refusal. */
export async function runApply(prepared: Prepared, options: ApplyOptions, ctx: Context): Promise<Result<Report, ApplyRefusal>> {
  const started = await applyStream(prepared, options);
  if (started.kind === "err") return started;
  let report: Report | undefined;
  for await (const event of started.value) {
    tell(ctx, event);
    if (event.kind === "finished") report = event.report;
  }
  return report === undefined ? err({ kind: "not-applicable", detail: "the apply ended without a report" }) : ok(report);
}

/** The ending of a report: its lines, and a problem where some of it failed or was skipped. */
export function reportOutcome(report: Report): Outcome {
  const base = outcomeOf({ report }, { text: reportLines(report).join("\n") });
  return report.failed > 0 || report.skipped > 0 ? { ...base, problems: [problemOf("E-APPLY-FAILED", `${report.failed} failed and ${report.skipped} skipped of ${report.outcomes.length}`)] } : base;
}

/** The ending of an apply that was refused. */
export function refusedOutcome(refusal: ApplyRefusal): Outcome {
  return outcomeOf(null, { problems: [applyRefusalProblem(refusal)] });
}
