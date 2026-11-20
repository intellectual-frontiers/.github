// Spec: 0001-ergonex FR-007
/**
 * The typed values every command of `ergonex` shares (commons 0001-ergonex FR-007, FR-010, FR-022): what a command's body returns (`Report`, or a `Failure`), the facts of the run it is given (`Context`), and the four statuses of the
 * evidence record. A command is declared once with Headless (`commands/define.ts`), which parses its words, draws its output and gives its exit status; its body returns a `Result` of a `Report` or a `Failure`. There is no `any`, and a
 * `switch` over a union of statuses or sources is exhaustive.
 *
 * @remarks
 * Pure: a command is given everything the host holds (the environment, the working folder, the day, the platform, where to write and whether to ask) in its `Context`, and does its work through the ports of that context and the host layer
 * it imports, so that the same command is run in a test with a context of the test's making and by the program with the real one.
 *
 * @module
 */
import { absurd, type Result } from "@intellectual-frontiers/core";
import type { Json } from "@intellectual-frontiers/formats";
import type { Sha256 } from "@intellectual-frontiers/crypto";
import type { Finding } from "../findings.ts";
import type { Places } from "../places.ts";
import type { RunFacts } from "../setup/evidence.ts";

/** How a run ends: the keys of the code list `ergonex:ExitStatus`. */
export type ExitStatus = "Ok" | "Findings" | "Usage" | "Environment";

/** The statuses, in the order of their numbers. */
export const EXIT_STATUSES: readonly ExitStatus[] = ["Ok", "Findings", "Usage", "Environment"];

/** The number a run exits with (`ergonex:exitCode`). */
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

/** Where a module was found: the keys of the code list `ergonex:ModuleSource`, looked in in this order. */
export type ModuleSource = "BuiltIn" | "Registered" | "Path";

/** The sources, in the order a module is looked for (`ergonex:precedence`). */
export const MODULE_SOURCES: readonly ModuleSource[] = ["BuiltIn", "Registered", "Path"];

/** The place of a source in the order: 1 is looked in first (`ergonex:precedence`). */
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
  /** The facts of a run whose evidence is the setup module's (`setup/host/evidence.ts`): `setup` and `tools`. Where it is given the controller writes the record from it. */
  readonly runFacts?: RunFacts;
  /** The step the run suggests next, as a command (`ergonex plan`): the closing of an action shows it. */
  readonly next?: readonly string[];
  /** What the verdict says where all is well (`Workspace made`); Headless says `Up to date` where there is none. */
  readonly title?: string;
  /** The run writes no evidence record: `ergonex shell print <shell>` writes no file (0003-host FR-017), and a hook only reads (FR-015). */
  readonly noEvidence?: boolean;
};

/** What a run adds to its evidence record (0002-workspace-model FR-042). */
export type EvidenceFacts = {
  /** The hash of the plan the run made or carried out. */
  readonly planSha256?: Sha256;
  /** The hash of the state record after the run. */
  readonly stateSha256?: Sha256;
  /** The tools probed or installed, with the version of each. */
  readonly tools?: readonly {
    readonly name: string;
    readonly version: string;
  }[];
  /** For a setup run: whether it changed anything (`ergonex:applied`). */
  readonly applied?: boolean;
};

/** Why a run could not be done: a command line that does not fit, or a host that cannot do it. */
export type Failure = {
  readonly kind: "usage" | "environment";
  readonly message: string;
  readonly noEvidence?: boolean;
};

/** What a command gives back. */
export type Outcome = Result<Report, Failure>;

/** The options of a command that are its own to all commands: the root of the workspace for the run. */
export type Globals = {
  readonly home?: string;
};

/** The globals out of the options a command parsed (a decoder at the boundary: the one place that reads them). */
export function globalsOf(options: Readonly<Record<string, unknown>>): Globals {
  const home = options["home"];
  return typeof home === "string" && home !== "" ? { home } : {};
}

/** The computer a run is on. */
export type Platform = {
  readonly os: string;
  readonly arch: string;
  readonly windows: boolean;
};

/** A command of the program, as the discovery of modules sees it: the built-in modules are the words of the program's own tree. */
export type ErgonexModule = {
  readonly name: string;
  readonly summary: string;
  /** The words below it, where it is a branch (`worktree create`); none for a command. */
  readonly commands: readonly string[];
};

/** How a command asks a person a question: only where a person can be asked. */
export type Interact = {
  /** Whether a person can be asked now. */
  readonly terminal: boolean;
  /** The yes or no the person gave; undefined where there is no one to ask. */
  readonly confirm: (question: string) => Promise<boolean | undefined>;
};

/** What the controller gives every command, besides its words. */
export type BaseContext = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  /** The UTC day of the run, `YYYY-MM-DD`. */
  readonly today: string;
  readonly platform: Platform;
  /** The folders Ergonex keeps its own files in (0031-install-locations); undefined where no home can be found. */
  readonly places: Places | undefined;
  /** The commands of the program's tree that are built in, which `modules` and the shell snippet read. */
  readonly builtins: readonly ErgonexModule[];
  readonly interact: Interact;
  /** The root of the workspace for a run that says `--home` (or not): that, else `$ERGONEX_HOME`, else `$HOME/workspaces`; undefined where none can be found. */
  readonly homeFor: (override: string | undefined) => string | undefined;
  /** What is on standard input, read once (a Git hook is given its refs there). */
  readonly stdin: () => Promise<string>;
  /** Where a run tells a line that is not its report: a diff or a notice; the run shows it with its closing block. */
  readonly note: (text: string) => void;
};

/** What a command is given: the base and the options every command has, decoded. */
export type Context = BaseContext & {
  readonly globals: Globals;
  /** The root of the workspace: `--home`, else `$ERGONEX_HOME`, else `$HOME/workspaces`; undefined where none can be found. */
  readonly home: string | undefined;
  /** Whether the run is a preview (`--dry-run`), a check (`--check`) or neither. */
  readonly mode: "apply" | "dry-run" | "check";
};
