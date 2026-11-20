// Spec: 0004-headless-cli FR-003, FR-004, FR-011, FR-012
// Spec: 0008-exit-style-consent FR-001, FR-002, FR-003, FR-004
// Spec: 0010-audience-tiers FR-003, FR-004, FR-006
// Spec: 0011-credential-prompt FR-005, FR-006
/**
 * The run boundary of the command line (commons headless 0004-headless-cli FR-011): `run(program, argv, io)` gives `{ code, out, err }` and touches no
 * process global, so a test, a REPL and a tool that embeds the program all call it the same way. It resolves the words to a command, parses the
 * options (the model's standard ones included), decides whether to proceed, preview, ask or refuse (the governance's `decide`), runs the command, draws the
 * closing block, and ends with the status of the one table of exits.
 *
 * @remarks
 * The result of a command (its report text, or the one JSON document) goes to `out`; what narrates the run (the phases, the closing block) goes to `err`,
 * so that a report can be piped and a document is never mixed with prose. A failure before the command runs (an unknown word, a wrong option, a refusal) is a
 * sentence on `err` and the status 2, in every mode: the one JSON document is the document of a run that ran.
 *
 * @example
 * ```ts
 * import { run } from "./run.ts";
 * import { programOf } from "@intellectual-frontiers/headless/logical";
 * const io = { env: () => undefined, os: "linux", terminal: { stdin: false, stdout: false, stderr: false }, columns: undefined, now: () => 0, pid: 1, readLine: async () => undefined } as const;
 * (await run(programOf({ name: "tool", summary: "A tool.", version: "1.2.3", children: [] }), ["--version"], io)).out; // "tool 1.2.3\n"
 * ```
 *
 * @module
 */
import { isErr } from "@intellectual-frontiers/core";
import { formatUsageError, parseArgs, type Args, type Spec } from "@intellectual-frontiers/terminal/args";
import { formatCommandError, resolveCommand } from "@intellectual-frontiers/terminal/commands";
import { tty } from "@intellectual-frontiers/system";
import {
  decide,
  tierMessage,
  exitCodeOf,
  countsOf,
  exitOfNamed,
  modeOf,
  problem,
  redactor,
  withCode,
  type Counts,
  type Decision,
  type Problem,
} from "@intellectual-frontiers/headless/governance";
import {
  closingOf,
  credentialSession,
  distinctHints,
  envelopeOf,
  explainText,
  hiddenVerb,
  isNested,
  jsonText,
  mergeOutcomes,
  outcomeOf,
  placedCommands,
  redactEvent,
  redactOutcome,
  sarifText,
  standardOptions,
  STANDARD_KEYS,
  summaryOf,
  encodeSummary,
  translator,
  treeOf,
  verbosityOf,
  visibleProgram,
  type Context,
  type Outcome,
  type Placed,
  type Program,
  type ProgressEvent,
  type Verbosity,
} from "@intellectual-frontiers/headless/logical";
import { completions, helpFor, isShell, manPage, SHELLS } from "./help.ts";
import type { Io, RunEnd, RunEvents, RunResult } from "./io.ts";
import { promptOf } from "./prompts.ts";
import { forwardedArgs, runEntry, runOn } from "./remote-run.ts";
import { renderClosing } from "./render.ts";
import { Reporter } from "./reporter.ts";
import { guarded } from "./signals.ts";
import { dueHints, hintsFileOf, logDirOf, logName, pruneLogs, RunLog, stateDirOf } from "./state.ts";
import type { Look } from "./style.ts";

/** The variables the look of the terminal depends on. */
const LOOK_VARS = ["NO_COLOR", "FORCE_COLOR", "TERM", "LC_ALL", "LC_CTYPE", "LANG", "WT_SESSION", "TERM_PROGRAM", "ConEmuANSI"] as const;

/**
 * The look of the error stream, where the narration goes (0008-exit-style-consent FR-002). The style of the marks is an explicit decision, `Io.marks`: `plain` (the ASCII marks), `emoji`,
 * or `auto`, the default, which is plain unless the stream is a terminal that shows emoji and nothing asks for plain: not `NO_COLOR`, not `--no-color`, not the program's `<PREFIX>_PLAIN`.
 * The program's `<PREFIX>_EMOJI` turns emoji on where nothing asks for plain. So a run in CI, in a pipe or with colour off is the same plain text everywhere.
 */
export function lookOfRun(program: Program, io: Io, colour: boolean): Look {
  const vars: Record<string, string | undefined> = Object.fromEntries(LOOK_VARS.map((n) => [n, io.env(n)]));
  const base = tty.lookOf({ env: vars, terminal: io.terminal.stderr, os: io.os, ...(io.columns === undefined ? {} : { columns: io.columns }) });
  const set = (n: string): boolean => (io.env(`${program.envPrefix}_${n}`) ?? "") !== "";
  const asksPlain = set("PLAIN") || !colour || (io.env("NO_COLOR") ?? "") !== "";
  const style = io.marks ?? "auto";
  const emoji = style === "plain" ? false : style === "emoji" ? true : asksPlain ? false : set("EMOJI") ? true : base.tty && base.emoji;
  return { tty: base.tty, colour: base.colour && colour, emoji, columns: base.columns };
}

/** The standard options out of the parsed values of an options spec that holds them with the command's own. */
function splitOptions(options: Readonly<Record<string, unknown>>): { readonly own: Record<string, unknown>; readonly standard: Readonly<Record<string, unknown>> } {
  const own: Record<string, unknown> = {};
  const standard: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(options)) ((STANDARD_KEYS as readonly string[]).includes(k) ? standard : own)[k] = v;
  return { own, standard };
}

const given = (own: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.entries(own)
    .filter(([, v]) => v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0))
    .map(([k]) => k);

const asText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** What the body of a run gives back besides the status. */
type Ended = RunEnd & { readonly out: string; readonly err: string };

/** Runs a program's command line. */
export async function run(whole: Program, argv: readonly string[], io: Io): Promise<RunResult> {
  // the caller's tier (0010-audience-tiers): what is drawn and what is resolved is the tree this caller may see, one tree for the help, the completions, the man page and the words
  const held = io.tier ?? whole.tiers.default;
  const program = visibleProgram(whole, held);
  const out: string[] = [];
  const err: string[] = [];
  const writeOut = (t: string): void => {
    if (t === "") return;
    out.push(t);
    io.sink?.out(t);
  };
  const writeErr = (t: string): void => {
    if (t === "") return;
    err.push(t);
    io.sink?.err(t);
  };
  const end = (code: number): RunResult => ({ code, out: out.join(""), err: err.join("") });
  const usage = (message: string): RunResult => {
    writeErr(`${message}\n`);
    return end(exitCodeOf("usage"));
  };

  // the words the surface answers itself
  const first = argv[0];
  if (first === "--version" || first === "-V") {
    writeOut(`${program.name} ${program.version}\n`);
    return end(exitCodeOf("ok"));
  }
  if (first === "help") {
    const text = helpFor(program, argv.slice(1));
    if (text === undefined) return usage(`${argv.slice(1).join(" ")} is not a command of ${program.name}. Run ${program.name} help to see them.`);
    writeOut(`${text}\n`);
    return end(exitCodeOf("ok"));
  }
  if (first === "explain") {
    const code = argv[1];
    const text = explainText(program.catalogue, { program: program.name, ...(program.guide === undefined ? {} : { guide: program.guide }) }, code);
    if (code !== undefined && program.catalogue[code.toUpperCase()] === undefined) return usage(text);
    writeOut(`${text}\n`);
    return end(exitCodeOf("ok"));
  }
  if (first === "completions") {
    const shell = argv[1];
    if (shell === undefined || !isShell(shell)) return usage(`${program.name} completions takes a shell: ${SHELLS.join(", ")}`);
    writeOut(completions(program, shell));
    return end(exitCodeOf("ok"));
  }
  if (first === "run") return await runEntry(program, argv.slice(1), io, (words) => run(program, words, io));
  if (first === "man") {
    writeOut(manPage(program));
    return end(exitCodeOf("ok"));
  }

  const words = argv.length === 0 && program.defaultCommand.length > 0 ? program.defaultCommand : argv;
  const everything = resolveCommand(treeOf(whole), words);
  if (!isErr(everything) && everything.value.kind !== "help") {
    const hidden = hiddenVerb(whole, everything.value.path.slice(1), held);
    if (hidden !== undefined) return usage(`${tierMessage(hidden.id, hidden.decision)} [${hidden.decision.reason}]`);
  }
  const resolved = resolveCommand(treeOf(program), words);
  if (isErr(resolved)) return usage(formatCommandError(resolved.error));
  const r = resolved.value;
  const below = r.path.slice(1);
  if (r.kind === "help") {
    writeOut(`${helpFor(program, below) ?? ""}\n`);
    return end(exitCodeOf("ok"));
  }
  const placed: Placed | undefined = placedCommands(program.children).find((p) => p.path.length === below.length && p.path.every((w, i) => w === below[i]));
  if (placed === undefined) return usage(`${below.join(" ")} is not a command of ${program.name}`);

  const spec: Spec = { ...placed.command.options, ...standardOptions(placed.facts, placed.reach) };
  const parsed = parseArgs<Spec>(r.args, spec as never, placed.command.operands);
  if (isErr(parsed)) return usage(formatUsageError(parsed.error, [program.name, ...below].join(" ")));
  if (parsed.value.kind === "help") {
    writeOut(`${helpFor(program, below) ?? ""}\n`);
    return end(exitCodeOf("ok"));
  }
  const args = parsed.value;
  const { own, standard } = splitOptions(args.options);
  const flag = (k: string): boolean => standard[k] === true;
  const ownArgs: Args<Spec> = { kind: "args", options: own as Args<Spec>["options"], positionals: args.positionals, rest: args.rest };

  if (flag("sarif") && flag("json")) return usage("--json and --sarif each write one document: give one of them");
  const verbosity = verbosityOf({ json: flag("json") || flag("sarif"), quiet: flag("quiet"), verbose: flag("verbose") });
  if (isErr(verbosity)) return usage(verbosity.error);
  const mode = modeOf({ dryRun: flag("dryRun"), check: flag("check") });
  if (isErr(mode)) return usage(mode.error);

  const interactive = io.terminal.stdin && io.terminal.stderr && !flag("nonInteractive");
  const look = lookOfRun(program, io, standard["color"] !== false && verbosity.value !== "json");
  const decision: Decision = decide(placed.facts, { audience: "human", interactive, flagConfirms: true }, { mode: mode.value, confirmed: flag("yes"), given: given(own), ...(typeof standard["consent"] === "string" ? { consent: standard["consent"] } : {}) }, placed.reach);
  if (decision.kind === "refuse") return usage(decision.message);
  const prompt = promptOf({ interactive, readLine: io.readLine, write: writeErr });
  if (decision.kind === "ask") {
    const yes = await prompt.confirm(placed.reach?.confirmation === "consent" ? `${placed.id} changes something. Go on?` : `${placed.id} destroys something and it cannot be undone. Go on?`);
    if (yes !== true) return usage("Not confirmed: nothing was changed.");
  }

  const onTargets = standard["on"];
  if (typeof onTargets === "string") {
    const forwarded = forwardedArgs(r.args);
    const withYes = placed.facts.effect === "destructive" && !forwarded.includes("--yes") && decision.kind !== "preview" ? ["--yes", ...forwarded] : forwarded;
    const done = await runOn({ program, io, placed, selector: onTargets, args: withYes, verbosity: verbosity.value, look, sarif: flag("sarif"), below });
    writeOut(done.out);
    writeErr(done.err);
    return end(done.code);
  }

  const info = { program: program.name, version: program.version, command: placed.id };
  const body = async (events: RunEvents | undefined): Promise<Ended> =>
    await execute({ program, io, placed, ownArgs, mode: mode.value, verbosity: verbosity.value, interactive, look, sarif: flag("sarif"), prompt, ...(typeof standard["consent"] === "string" && decision.kind === "proceed" && placed.reach?.confirmation === "consent" ? { consent: standard["consent"] } : {}), ...(events === undefined ? {} : { events }) });
  const ended = io.observer === undefined ? await body(undefined) : await io.observer.observe(info, (events) => body(events));
  writeOut(ended.out);
  writeErr(ended.err);
  return end(ended.code);
}

type Execution = {
  readonly program: Program;
  readonly io: Io;
  readonly placed: Placed;
  readonly ownArgs: Args<Spec>;
  readonly mode: Context["mode"];
  readonly verbosity: Verbosity;
  readonly interactive: boolean;
  readonly look: Look;
  readonly sarif: boolean;
  readonly prompt: Context["prompt"];
  /** The identifier of the consent the run went on by, which the run log records. */
  readonly consent?: string;
  readonly events?: RunEvents;
};

/** The clock of the process, for a surface that is not given one. */
const processClock = {
  after: (ms: number, fn: () => void): (() => void) => {
    const h = setTimeout(fn, ms);
    return () => clearTimeout(h);
  },
};

/** Runs the command and everything around it: the log, the reporter, the signals, the redaction, the closing block, and the end of its credentials. */
async function execute(x: Execution): Promise<Ended> {
  const controller = new AbortController();
  const held: { log: RunLog | undefined } = { log: undefined };
  const credentials = credentialSession({
    interactive: x.interactive,
    clock: x.io.clock ?? processClock,
    signal: controller.signal,
    onEvent: (e) => {
      if (e.kind === "asked") held.log?.write("credential", `${e.id} (${e.credential}) asked`);
      else if (e.kind === "given") held.log?.write("credential", `${e.id} given`);
      else held.log?.write("credential", `${e.id} refused: ${e.refusal}`);
    },
    ...(x.io.credentials === undefined ? {} : { port: x.io.credentials }),
    ...(x.io.credentialTimeoutMs === undefined ? {} : { timeoutMs: x.io.credentialTimeoutMs }),
  });
  try {
    return await executeWith(x, credentials, controller, held);
  } finally {
    credentials.close();
  }
}

async function executeWith(x: Execution, credentials: Context["credentials"], controller: AbortController, held: { log: RunLog | undefined }): Promise<Ended> {
  const { program, io, placed } = x;
  const screen: string[] = [];
  const nested = isNested(program.nested, io.env);
  // the redaction is made at each use: it holds the values the program holds and every credential this command was given
  const redact = (text: string): string => redactor([...program.secrets(), ...credentials.values()], { keys: program.secretKeys })(text);
  const stateDir = stateDirOf(program.stateApp, io.env, io.os);
  const inherited = io.env(`${program.envPrefix}_LOG`);
  let log: RunLog | undefined;
  if (io.state !== undefined && inherited !== undefined && inherited !== "") log = new RunLog(io.state, inherited, io.now);
  else if (io.state !== undefined && stateDir !== undefined) {
    const dir = logDirOf(stateDir, io.os);
    pruneLogs(io.state, dir, io.os, io.now());
    log = new RunLog(io.state, `${dir}${io.os === "windows" ? "\\" : "/"}${logName(io.now(), io.pid)}`, io.now);
  }
  const from = program.origins[placed.id];
  held.log = log;
  log?.write("run", `${program.name} ${placed.id} (${program.version}) mode ${x.mode}, ${x.verbosity}${from === undefined ? "" : `, from ${from}`}`);
  if (x.consent !== undefined) log?.write("consent", `${placed.id} went on by the consent ${redact(x.consent)}`);
  const reporter = new Reporter({
    look: x.look,
    verbosity: x.verbosity,
    write: (t) => {
      if (!nested) screen.push(t);
    },
    now: io.now,
    ...(log === undefined ? {} : { log }),
    ...(io.timer === undefined ? {} : { timer: io.timer }),
    ...(x.events === undefined ? {} : { events: x.events }),
  });
  const progress = (event: ProgressEvent): void => reporter.handle(redactEvent(event, redact));
  const ctx: Context = {
    program: program.name,
    command: placed.id,
    facts: placed.facts,
    mode: x.mode,
    verbosity: x.verbosity,
    interactive: x.interactive,
    progress,
    prompt: x.prompt,
    credentials,
    env: io.env,
    signal: controller.signal,
  };
  const work = (async (): Promise<Outcome> => {
    try {
      return await placed.command.run(x.ownArgs, ctx);
    } catch (e) {
      return outcomeOf(null, { problems: [problem("fail", asText(e), { raw: e instanceof Error ? (e.stack ?? e.message) : String(e) })] });
    }
  })();
  const g = await guarded(io.signals, controller, work);
  // the lines a command returned as its outcome are told as the ones it told while it ran, so that each is shown once and in order
  const finished = g.kind === "done" ? g.value : outcomeOf(null, { cancelled: true });
  for (const text of finished.outcomes) progress({ kind: "outcome", text });
  reporter.close();

  const returned = { ...finished, outcomes: [] };
  const translate = translator(program.catalogue, program.patterns);
  const coded = (p: Problem): Problem => {
    if (p.code !== undefined) return p;
    const t = translate(p.raw ?? p.message);
    return t === undefined ? withCode(p, program.generic) : { ...p, code: t.code, ...(p.fix === undefined && t.fix !== "" ? { fix: t.fix } : {}) };
  };
  const merged = mergeOutcomes(returned, outcomeOf(null, { problems: reporter.problems, outcomes: reporter.outcomes, hints: reporter.hints }));
  const outcome = redactOutcome({ ...merged, problems: merged.problems.map(coded), cancelled: merged.cancelled || g.kind === "stopped" }, redact);
  const counts: Counts = countsOf(outcome.problems);
  const code = g.kind === "stopped" ? g.code : exitOfNamed(counts, outcome.exit, { pending: x.mode === "check" ? "pending" : "ok" });
  log?.write("run", `finished with ${code}: ${counts.fail} failure(s), ${counts.warn} warning(s), ${counts.pending} pending, ${counts.action} for you`);

  let out = "";
  if (x.verbosity === "json") {
    out = x.sarif ? sarifText({ program: program.name, version: program.version, outcome }) : jsonText(envelopeOf({ program: program.name, version: program.version, command: placed.id, outcome, code }));
  } else if (outcome.text !== undefined) {
    out = outcome.text.endsWith("\n") ? outcome.text : `${outcome.text}\n`;
  }
  if (nested) {
    const file = io.env(program.nested.summary);
    if (file !== undefined && file !== "" && io.state !== undefined) io.state.writeText(file, encodeSummary(summaryOf(outcome)));
  } else if (x.verbosity !== "json") {
    const hintsFile = stateDir === undefined ? undefined : hintsFileOf(stateDir, io.os);
    const shownHints = x.verbosity === "quiet" ? [] : x.verbosity === "verbose" ? distinctHints(outcome.hints) : dueHints(io.state, hintsFile, outcome.hints, io.now());
    const closing = closingOf(outcome, { fix: program.fix, shownHints });
    const clean = placed.facts.kind === "report" && outcome.text !== undefined && closing.lines.length === 0 && closing.verdict.level === "ok";
    if (!clean) screen.push(renderClosing(closing, { look: x.look, verbosity: x.verbosity, ...(log === undefined ? {} : { logPath: log.path }) }));
  }
  return { code, counts, out, err: screen.join("") };
}
