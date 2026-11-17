/**
 * The typed contract of a module of `ifws` (commons 0025-ifws FR-007, FR-010, FR-022): a module is `IfwsModule` (its name, its summary and its commands); a command is declared once as data
 * (`defineCommand`: its name, its options with the five every command accepts, its arguments and `run`), parsed once at the boundary into a typed value, and returns a `Result` of a `Report` or a
 * `Failure`; a run ends in one of four statuses. There is no `any`, and a `switch` over a union of statuses or sources is exhaustive.
 *
 * @remarks
 * Pure: a command is given everything the host holds (the environment, the working folder, the day, the platform, where to write and whether to ask) in its `Context`, and does its work through
 * the ports of that context and the host layer it imports, so that the same command is run in a test with a context of the test's making and by the controller with the real one. A module is
 * built in (a value of this type that the compiler checks), registered by the workspace or found on the `PATH`; the last two are programs, which answer `--ifws-manifest` (see `external.ts`).
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { type Args, flag, formatUsageError, helpOf, type Operand, parseArgs, type Spec, type SpecCheck, value } from "../../kernel/args.ts";
import type { Json } from "../../kernel/json5.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import type { Sha256 } from "../../kernel/sha256.ts";
import type { Finding } from "../findings.ts";

/** How a run ends: the keys of the code list `ifws:ExitStatus`. */
export type ExitStatus = "Ok" | "Findings" | "Usage" | "Environment";

/** The statuses, in the order of their numbers. */
export const EXIT_STATUSES: readonly ExitStatus[] = ["Ok", "Findings", "Usage", "Environment"];

/** The number a run exits with (`ifws:exitCode`). */
export function exitCodeOf(status: ExitStatus): 0 | 1 | 2 | 3 {
  switch (status) {
    case "Ok":
      return 0;
    case "Findings":
      return 1;
    case "Usage":
      return 2;
    case "Environment":
      return 3;
    default:
      return absurd(status);
  }
}

/** Where a module was found: the keys of the code list `ifws:ModuleSource`, looked in in this order. */
export type ModuleSource = "BuiltIn" | "Registered" | "Path";

/** The sources, in the order a module is looked for (`ifws:precedence`). */
export const MODULE_SOURCES: readonly ModuleSource[] = ["BuiltIn", "Registered", "Path"];

/** The place of a source in the order: 1 is looked in first (`ifws:precedence`). */
export function precedenceOf(source: ModuleSource): number {
  switch (source) {
    case "BuiltIn":
      return 1;
    case "Registered":
      return 2;
    case "Path":
      return 3;
    default:
      return absurd(source);
  }
}

/** What a run did, for a person and as data. */
export type Report = {
  /** What is written to standard output without `--json`. */
  readonly text: string;
  /** What is written with `--json`, under `data`. */
  readonly data: Json;
  /** What the run found; its worst severity decides the status. */
  readonly findings: readonly Finding[];
  /** The status where it is not the findings' (`render --check` ends in `Findings` where a file would change). */
  readonly status?: ExitStatus;
  /** What the evidence record of the run names besides the findings. */
  readonly facts?: EvidenceFacts;
  /** The run writes no evidence record: `ifws shell <shell>` writes no file (0024-ifws-host FR-017), and a hook only reads (FR-015). */
  readonly noEvidence?: boolean;
};

/** What a run adds to its evidence record (0023-if-workspaces FR-042). */
export type EvidenceFacts = {
  /** The hash of the plan the run made or carried out. */
  readonly planSha256?: Sha256;
  /** The hash of the state record after the run. */
  readonly stateSha256?: Sha256;
  /** The tools probed or installed, with the version of each. */
  readonly tools?: readonly { readonly name: string; readonly version: string }[];
  /** For a setup run: whether it changed anything (`ifws:applied`). */
  readonly applied?: boolean;
};

/** Why a run could not be done: a command line that does not fit, or a host that cannot do it. */
export type Failure = { readonly kind: "usage" | "environment"; readonly message: string };

/** What a command gives back. */
export type Outcome = Result<Report, Failure>;

/** The five options every command accepts (0025-ifws FR-022); `--help` is the parser's own. */
export const GLOBAL_OPTIONS = {
  home: value({ help: "The root of the workspace for this run (else $IFC_WORKSPACES_HOME, else $HOME/workspaces).", valueName: "DIR" }),
  json: flag({ help: "Write the report as JSON." }),
  sarif: flag({ help: "Write the findings as a SARIF 2.1.0 log." }),
  noColor: flag({ help: "Write no colour." }),
};

/** The five options, as they were given. */
export type Globals = { readonly home?: string; readonly json: boolean; readonly sarif: boolean; readonly noColor: boolean };

/** The globals out of the options a command parsed (a decoder at the boundary: the one place that reads them). */
export function globalsOf(options: Readonly<Record<string, unknown>>): Globals {
  const home = options["home"];
  return {
    ...(typeof home === "string" && home !== "" ? { home } : {}),
    json: options["json"] === true,
    sarif: options["sarif"] === true,
    noColor: options["noColor"] === true,
  };
}

/** The computer a run is on. */
export type Platform = { readonly os: string; readonly arch: string; readonly windows: boolean };

/** How a command asks a person a question: only where a terminal is there to answer. */
export type Interact = {
  readonly terminal: boolean;
  /** The line the person typed, or undefined at the end of the input. */
  readonly ask: (question: string) => Promise<string | undefined>;
};

/** What the controller gives every command, besides its words. */
export type BaseContext = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  /** The UTC day of the run, `YYYY-MM-DD`. */
  readonly today: string;
  readonly platform: Platform;
  /** The typed modules the command holds, which `list` and `help` read. */
  readonly builtins: readonly IfwsModule[];
  readonly interact: Interact;
  /** The root of the workspace for a run that says `--home` (or not): that, else `$IFC_WORKSPACES_HOME`, else `$HOME/workspaces`; undefined where none can be found. */
  readonly homeFor: (override: string | undefined) => string | undefined;
  /** Where a run writes what is not its report: a diff or a line of progress, to standard error. */
  readonly note: (text: string) => void;
};

/** What a command is given: the base and the options every command has, decoded. */
export type Context = BaseContext & {
  readonly globals: Globals;
  /** The root of the workspace: `--home`, else `$IFC_WORKSPACES_HOME`, else `$HOME/workspaces`; undefined where none can be found. */
  readonly home: string | undefined;
};

/** What a command did, with the options it was given where they were read. */
export type Executed = { readonly outcome: Outcome; readonly globals?: Globals; readonly command: string };

/** A command of a module: declared once, run on words. */
export type Command = {
  readonly name: string;
  readonly summary: string;
  /** The help, from the declaration. */
  readonly help: (program: string) => string;
  /** Parses the words, and runs the command where they fit; where they do not, the outcome is a usage failure. */
  readonly execute: (words: readonly string[], base: BaseContext) => Promise<Executed>;
};

/** A module of `ifws`: `ifws <name>` runs it. */
export type IfwsModule = {
  readonly name: string;
  readonly summary: string;
  readonly commands: readonly Command[];
};

/** The options every command accepts, and the type of a command's own. */
type GlobalSpec = typeof GLOBAL_OPTIONS;

/** What a command is declared with. */
export type CommandDefinition<S extends Spec & GlobalSpec> = {
  readonly name: string;
  readonly summary: string;
  /** Its options: the five of `GLOBAL_OPTIONS` (spread them in) and its own. */
  readonly options: S & SpecCheck<S>;
  readonly operands?: readonly Operand[];
  readonly run: (ctx: Context, args: Args<S>) => Promise<Outcome>;
};

/**
 * A command from its declaration: the words are parsed against the options once, here; help is answered and runs nothing; a word that does not fit is a usage failure; and the command runs only on
 * what decoded. The type of what `run` is given is inferred from the declaration.
 */
export function defineCommand<S extends Spec & GlobalSpec>(d: CommandDefinition<S>): Command {
  const operands = d.operands ?? [];
  const help = (program: string): string => helpOf(program, d.summary, d.options, operands);
  return {
    name: d.name,
    summary: d.summary,
    help,
    execute: async (words, base) => {
      const program = `ifws ${d.name}`;
      const parsed = parseArgs<S>(words, d.options, operands);
      if (parsed.kind === "err") {
        return {
          command: d.name,
          outcome: err({ kind: "usage", message: `${formatUsageError(parsed.error, program)}\n\n${help(program)}` }),
        };
      }
      if (parsed.value.kind === "help") {
        return { command: d.name, outcome: ok({ text: help(program), data: null, findings: [], noEvidence: true }) };
      }
      const globals = globalsOf(parsed.value.options);
      const ctx: Context = { ...base, globals, home: base.homeFor(globals.home) };
      return { command: d.name, globals, outcome: await d.run(ctx, parsed.value) };
    },
  };
}

/** The module's command a word names, and the words left for it. */
export type Dispatch =
  | { readonly kind: "command"; readonly command: Command; readonly words: readonly string[] }
  | { readonly kind: "help" }
  | { readonly kind: "unknown"; readonly word: string; readonly known: readonly string[] };

/**
 * The command of a module that words name: a module with one command of its own name (`plan`) takes every word; a module of several (`worktree create`) takes its first word as the command's name,
 * asks for its help where there is none or `--help` is first, and says what is unknown.
 */
export function dispatch(m: IfwsModule, words: readonly string[]): Dispatch {
  const only = m.commands.length === 1 ? m.commands[0] : undefined;
  if (only !== undefined && only.name === m.name) return { kind: "command", command: only, words };
  const [first, ...rest] = words;
  if (first === undefined || first === "--help" || first === "-h") return { kind: "help" };
  const command = m.commands.find((c) => c.name === first);
  if (command === undefined) return { kind: "unknown", word: first, known: m.commands.map((c) => c.name) };
  return { kind: "command", command, words: rest };
}
