// Spec: 0001-ergonex FR-007
/**
 * How a command of `ergonex` is declared and run on Headless (commons 0001-ergonex FR-007, FR-010, FR-022, FR-023; commons headless 0003-headless-output, 0004-headless-cli): a command is declared once with its action's facts (what it
 * may change, whether repeating it is safe, whether it can preview itself, where it may be reached from), its options and operands, and a body that returns a `Report` or a `Failure`. Headless parses the words, decides whether the run
 * proceeds, previews, asks or is refused, draws the output (the report on standard output, the problems and the verdict on standard error), writes the run log and keeps the hints, and ends with the status of its one table; this module
 * is what turns the body's report into Headless' typed outcome and writes the run's evidence record.
 *
 * @remarks
 * A finding of severity `Error` or `Warning` is a failure of the run (a status of 1, as the specifications say), and one that is `Informational` is a warning, which never changes the status; where a report says its own status is `Ok` (a Git
 * hook lets Git go on with a warning) a warning stays a warning. A body that cannot do what it is asked returns a `Failure`: a command line that does not fit (`usage`) or a host that cannot do it (`environment`), which the program
 * ends with the statuses 2 and 3 (the outcome names its exit, `withExit`).
 *
 * @module
 */
import type { Example } from "@intellectual-frontiers/terminal/commands";
import { absurd } from "@intellectual-frontiers/core";
import { type Problem, problem } from "@intellectual-frontiers/headless/governance";
import {
  type ActionTraits,
  type Command as HeadlessCommand,
  command,
  type Context as HeadlessContext,
  type Finding as HeadlessFinding,
  type Outcome as HeadlessOutcome,
  outcomeOf,
  withExit,
} from "@intellectual-frontiers/headless/logical";
import { type Args, type Operand, type Spec, type SpecCheck } from "../platform/k-args.ts";
import { existsSync } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { run as runProgram, runtimeName, runtimeVersion } from "../platform/r-proc.ts";
import type { Finding } from "../findings.ts";
import { exitStatusOf } from "../findings.ts";
import { writeEvidence } from "../host/evidence.ts";
import { AREA, loopbackAllowed, loopbackFinding, readManifest } from "../host/workspace.ts";
import { type BaseContext, type Context, type ExitStatus, globalsOf, type Outcome, type Report } from "../modules/types.ts";
import { writeRunEvidence } from "../setup/host/evidence.ts";
import type { RunFacts } from "../setup/evidence.ts";
import { codeOfRule } from "./catalogue.ts";

/** What the program holds for every run of its commands: the facts of the host, which a test of the program gives its own. */
export type Host = Omit<BaseContext, "interact" | "note"> & {
  /** The whole command line, for the words the evidence record names. */
  readonly argv: readonly string[];
  /** The time in milliseconds since the Unix epoch. */
  readonly now: () => number;
};

/** A command, once it is given the host it runs on. */
export type Make = (host: Host) => HeadlessCommand;

/** What a command is declared with. */
export type CommandDefinition<S extends Spec> = {
  readonly name: string;
  readonly summary: string;
  /** Its own options: `--home` and the ones of the command; the options every command takes by its effect are Headless'. */
  readonly options: S & SpecCheck<S>;
  readonly operands?: readonly Operand[];
  readonly examples?: readonly Example[];
  /** What it is as an action: its kind, effect, whether it is safe to repeat, whether it previews and checks, and its reach policy. */
  readonly action: ActionTraits;
  readonly run: (ctx: Context, args: Args<S>) => Promise<Outcome>;
};

/** The severity of a finding as the level of the problem it makes in a run. */
function levelOf(f: Finding, lenient: boolean): Problem["level"] {
  switch (f.severity) {
    case "Error":
      return "fail";
    case "Warning":
      return lenient ? "warn" : "fail";
    case "Informational":
      return "warn";
    default:
      return absurd(f.severity);
  }
}

/** A finding as a problem of the run: its message names its subject, and its code is the code of its rule. */
export function problemOfFinding(f: Finding, lenient: boolean): Problem {
  const message = f.subject === "" || f.message.includes(f.subject) ? f.message : `${f.subject}: ${f.message}`;
  return problem(levelOf(f, lenient), message, { code: codeOfRule(f.ruleId) });
}

/** A finding as the finding a SARIF reader sees. */
function sarifOfFinding(f: Finding): HeadlessFinding {
  return {
    ruleId: f.ruleId,
    level: f.severity === "Error" ? "error" : f.severity === "Warning" ? "warning" : "note",
    message: f.subject === "" || f.message.includes(f.subject) ? f.message : `${f.subject}: ${f.message}`,
  };
}

/** What a report is as the typed outcome of a run. */
export function outcomeOfReport(r: Report, extra: readonly Finding[] = []): HeadlessOutcome {
  const findings = [...r.findings, ...extra];
  const lenient = r.status === "Ok";
  const problems = findings.map((f) => problemOfFinding(f, lenient));
  return outcomeOf(r.data, {
    ...(r.text === "" ? {} : { text: r.text }),
    ...(r.next === undefined ? {} : { next: r.next.map((n) => `next: ${n}`) }),
    ...(r.title === undefined ? {} : { title: r.title }),
    problems,
    findings: findings.map(sarifOfFinding),
  });
}

/** What a failure is as the typed outcome of a run: one failure, with the code of its kind. */
export function outcomeOfFailure(message: string, kind: "usage" | "environment"): HeadlessOutcome {
  return withExit(outcomeOf(null, { problems: [problem("fail", message, { code: kind === "usage" ? "E-USAGE" : "E-ENVIRONMENT" })] }), kind);
}

/** The words of the command line after the words of the command. */
function wordsAfter(argv: readonly string[], id: string): readonly string[] {
  return argv.slice(id.split(" ").length);
}

/** The evidence record of a run (the report it ended in, or why it did not run), where the workspace has a place for it: the problem it ends in, if it cannot be written. */
export async function recordEvidence(
  ctx: Pick<Context, "home" | "places" | "env" | "today">,
  host: Pick<Host, "argv" | "now">,
  id: string,
  start: bigint,
  done: { readonly status: ExitStatus; readonly findings: readonly Finding[]; readonly notRun?: string; readonly report?: Report },
): Promise<string | undefined> {
  const home = ctx.home;
  const places = ctx.places;
  if (home === undefined || places === undefined || !existsSync(join(home, AREA))) return undefined;
  if (done.report?.noEvidence === true) return undefined;
  const policy = await readManifest(home, ctx.today, loopbackAllowed(ctx.env));
  const regulated = policy.kind === "ok" && policy.value.policy.regulatedDomain.length > 0;
  const tools = [...(done.report?.facts?.tools ?? []), { name: runtimeName(), version: runtimeVersion() }];
  if (regulated && !tools.some((t) => t.name === "git")) {
    const g = await runProgram(["git", "--version"]).catch(() => undefined);
    const v = g?.success === true ? /(\d+\.\d+(?:\.\d+)?)/.exec(g.stdout)?.[1] : undefined;
    if (v !== undefined) tools.push({ name: "git", version: v });
  }
  const end = BigInt(host.now()) * 1_000_000n;
  const runFacts: RunFacts | undefined = done.report?.runFacts;
  // the evidence of `setup` and `tools` is made by the setup module's writer from the facts of the run; every other run's by this one's
  if (runFacts !== undefined) {
    const w = await writeRunEvidence({ home, places, start, end, env: ctx.env }, { ...runFacts, exit: done.status });
    return w.kind === "err" ? w.error : undefined;
  }
  const w = await writeEvidence(
    { home, places },
    {
      command: id,
      words: wordsAfter(host.argv, id),
      status: done.status,
      findings: done.findings,
      ...(done.notRun === undefined ? {} : { notRun: done.notRun }),
      facts: { ...done.report?.facts, tools },
      start,
      end,
    },
    regulated,
  );
  return w.kind === "err" ? w.error.reason : undefined;
}

/**
 * A command from its declaration: Headless parses its words and options once at the boundary; the body runs on what decoded, and its report is the run's outcome. The run's evidence record is written after the body, for every run that
 * ran (a command line Headless refuses runs nothing and records nothing).
 */
export function defineCommand<S extends Spec>(d: CommandDefinition<S>): Make {
  return (host) =>
    command({
      name: d.name,
      summary: d.summary,
      options: d.options,
      ...(d.operands === undefined ? {} : { operands: d.operands }),
      ...(d.examples === undefined ? {} : { examples: d.examples }),
      action: d.action,
      run: async (args: Args<S>, h: HeadlessContext): Promise<HeadlessOutcome> => {
        const start = BigInt(host.now()) * 1_000_000n;
        const globals = globalsOf(args.options);
        const ctx: Context = {
          ...host,
          interact: { terminal: h.interactive, confirm: (q) => h.prompt.confirm(q) },
          note: (text) => h.progress({ kind: "outcome", text }),
          globals,
          home: host.homeFor(globals.home),
          mode: h.mode,
        };
        const outcome = await d.run(ctx, args);
        const id = h.command;
        if (outcome.kind === "err") {
          const f = outcome.error;
          const status: ExitStatus = f.kind === "usage" ? "Usage" : "Environment";
          const reason = f.noEvidence === true ? undefined : await recordEvidence(ctx, host, id, start, { status, findings: [], notRun: f.message.split("\n")[0] ?? "" });
          const o = outcomeOfFailure(f.message, f.kind);
          return reason === undefined ? o : { ...o, problems: [...o.problems, problem("fail", `the evidence record could not be written (${reason})`, { code: "E-EVIDENCE" })] };
        }
        const r = outcome.value;
        const loopback = loopbackAllowed(ctx.env);
        const extra = loopback ? [loopbackFinding(ctx.today)] : [];
        const findings = [...r.findings, ...extra];
        const status: ExitStatus = r.status ?? exitStatusOf(findings);
        const reason = await recordEvidence(ctx, host, id, start, { status, findings, report: r });
        const o = outcomeOfReport(r, extra);
        if (reason === undefined) return o;
        return withExit({ ...o, problems: [...o.problems, problem("fail", `the evidence record could not be written (${reason}); the run is reported as a failure of the host`, { code: "E-EVIDENCE" })] }, "environment");
      },
    });
}
