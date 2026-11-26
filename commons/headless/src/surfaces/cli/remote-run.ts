// Spec: 0005-reach-and-targets FR-007, FR-008
/**
 * The two halves of running a command on a target, for the command line (commons headless 0005-reach-and-targets FR-007, FR-008): `<program> <verb> --on <targets>` dispatches the
 * same verb through the executor of each target as `<program> run --json <verb> ...`, and `<program> run [--ssh] [--read-only] --json <verb> ...` is the entry the target
 * runs, which a forced command of `authorized_keys` points at. Neither knows ssh: the first is given executors, the second reads the environment it is given.
 *
 * @module
 */
import { isErr, splitArgs } from "@intellectual-frontiers/core";
import { resolveCommand } from "@intellectual-frontiers/terminal/commands";
import { exitCodeOf, reachDecision, redactor } from "@intellectual-frontiers/headless/governance";
import {
  closingOf,
  envelopeOf,
  exitOfRemote,
  fanOut,
  jsonText,
  outcomeOfRemote,
  placedCommands,
  redactOutcome,
  remoteArgv,
  remoteOfFanned,
  reportOfRemote,
  sarifText,
  selectTargets,
  statusWord,
  treeOf,
  type Placed,
  type Program,
  type Verbosity,
} from "@intellectual-frontiers/headless/logical";
import type { Io, RunResult } from "./io.ts";
import { renderClosing } from "./render.ts";
import type { Look } from "./style.ts";
import { tableLines, toneCell } from "./view.ts";

/** The arguments to forward to a target: those given, without `--on` and its value, and without `--json` and `--sarif`, which the remote run does not take as this run's. */
export function forwardedArgs(args: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const w = args[i];
    if (w === undefined) continue;
    if (w === "--on") {
      i += 1;
      continue;
    }
    if (w === "--json" || w === "--sarif") continue;
    out.push(w);
  }
  return out;
}

/** What a run over targets is given. */
export type OnRun = {
  readonly program: Program;
  readonly io: Io;
  readonly placed: Placed;
  readonly selector: string;
  readonly args: readonly string[];
  readonly verbosity: Verbosity;
  readonly look: Look;
  /** What the output stream, where the table of hosts is written, can show. */
  readonly outLook: Look;
  readonly sarif: boolean;
  readonly below: readonly string[];
};

/**
 * Runs a command on targets: at most `concurrency` at once and each within its time; one report of all of them, a table of the hosts as its text, and the status of
 * `exitOfRemote` (0, 3 where none could be reached, 2 where all refused, else 1).
 */
export async function runOn(x: OnRun): Promise<RunResult> {
  const { program, io, placed } = x;
  const fail = (message: string): RunResult => ({ code: exitCodeOf("usage"), out: "", err: `${message}\n` });
  if (placed.reach === undefined || !placed.reach.channels.includes("ssh")) return fail(`${placed.id} may not be reached through ssh`);
  const executors = io.executors;
  if (executors === undefined || program.targets.length === 0) return fail(`${program.name} has no targets set up for --on`);
  const chosen = selectTargets(program.targets, x.selector);
  if (isErr(chosen)) return fail(chosen.error);
  const fanned = await fanOut(
    chosen.value.map((t) => t.id),
    async (id, signal) => {
      const ex = executors(id);
      if (ex === undefined) throw new Error(`no way to reach ${id}`);
      const out = await ex.exec(remoteArgv({ program: program.name, verb: x.below, args: x.args }), { signal });
      return outcomeOfRemote(id, out, false);
    },
    program.remote,
  );
  const rows = fanned.map(remoteOfFanned);
  const code = exitOfRemote(rows);
  const redact = redactor(program.secrets(), { keys: program.secretKeys });
  const outcome = redactOutcome(reportOfRemote(rows), redact);
  if (x.verbosity === "json") {
    const text = x.sarif
      ? sarifText({ program: program.name, version: program.version, outcome })
      : jsonText(envelopeOf({ program: program.name, version: program.version, command: `${placed.id} --on ${x.selector}`, outcome, code }));
    return { code, out: text, err: "" };
  }
  const closing = closingOf(outcome, { fix: program.fix, shownHints: [] });
  const table = tableLines(
    [
      { key: "target", title: "TARGET" },
      { key: "status", title: "STATUS" },
      { key: "exit", title: "EXIT", align: "right" },
      { key: "problem", title: "FIRST PROBLEM" },
    ],
    rows.map((r) => ({ target: r.target, status: toneCell(r.kind === "ran" && r.code === 0 ? "ok" : r.kind === "ran" ? "fail" : "warn", statusWord(r), x.outLook), exit: String(r.code), problem: r.outcome.problems[0]?.message ?? "" })),
    x.outLook,
  ).join("\n");
  return { code, out: outcome.text === undefined ? "" : `${redact(table)}\n`, err: renderClosing(closing, { look: x.look, verbosity: x.verbosity }) };
}

/**
 * The entry a target runs: with `--ssh` the command is the one the client asked for, found in `SSH_ORIGINAL_COMMAND` (which is all a forced command gets of it), and it must be
 * `<program> run --json ...`; it is refused unless the verb has a reach policy that allows `ssh` and, for `--read-only`, only reads; it never goes on to another target. The verb
 * is run, by `runVerb`, with `--json`.
 */
export async function runEntry(program: Program, rest: readonly string[], io: Io, runVerb: (argv: readonly string[]) => Promise<RunResult>): Promise<RunResult> {
  const refuse = (why: string): RunResult => ({ code: exitCodeOf("usage"), out: "", err: `${program.name}: refused: ${why}\n` });
  let ssh = false;
  let readOnly = false;
  let i = 0;
  for (; i < rest.length; i += 1) {
    const w = rest[i];
    if (w === "--ssh") ssh = true;
    else if (w === "--read-only") readOnly = true;
    else if (w !== "--json") break;
  }
  let words: readonly string[] = rest.slice(i);
  if (ssh) {
    const original = io.env("SSH_ORIGINAL_COMMAND");
    if (original === undefined) return refuse("there is no command to run");
    const tokens = splitArgs(original);
    if (isErr(tokens)) return refuse("the command could not be read");
    const t = tokens.value;
    if (t[0] !== program.name || t[1] !== "run" || t[2] !== "--json") return refuse(`only \`${program.name} run --json <verb>\` is allowed here`);
    words = t.slice(3);
  }
  if (words.includes("--on")) return refuse("a command run here does not go on to another target");
  const resolved = resolveCommand(treeOf(program), words);
  if (isErr(resolved) || resolved.value.kind !== "verb") return refuse("that is not a command");
  const r = resolved.value;
  const below = r.path.slice(1);
  const placed = placedCommands(program.children).find((p) => p.path.length === below.length && p.path.every((w, k) => w === below[k]));
  if (placed === undefined || placed.reach === undefined) return refuse(`${below.join(" ")} has no reach policy`);
  const decision = reachDecision(placed.facts, placed.reach, "ssh", { mayOnlyRead: readOnly });
  if (decision.kind === "refused") return refuse(decision.message);
  return await runVerb([...below, "--json", ...r.args.filter((a) => a !== "--json")]);
}
