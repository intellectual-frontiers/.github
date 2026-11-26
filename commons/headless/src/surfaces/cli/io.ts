// Spec: 0004-headless-cli FR-011, FR-015, FR-016
// Spec: 0008-exit-style-consent FR-002
/**
 * What a run of the command line is given about its world (commons headless 0004-headless-cli FR-011): the environment, what each stream is, the clock,
 * a line of input, the files of its state, the signals, a timer for the spinner, and an observer. Everything is a value or a function, so that
 * `run(argv, io)` is deterministic and a test gives it the world it wants; nothing in the run reads a process global. The host (`host.ts`) is the
 * one place that binds them to a process.
 *
 * @example
 * ```ts
 * import { type Io } from "./io.ts";
 * const world = (io: Partial<Io>): Io => ({ env: () => undefined, os: "linux", terminal: { stdin: false, stdout: false, stderr: false }, columns: undefined, now: () => 0, pid: 1, readLine: async () => undefined, ...io });
 * world({}).pid; // 1
 * ```
 *
 * @module
 */
import type { dirs } from "@intellectual-frontiers/system";
import type { UiCaps } from "@intellectual-frontiers/terminal/ui";
import type { Counts, Problem, TierName } from "@intellectual-frontiers/headless/governance";
import type { Clock, CredentialPort, ExecutorFor } from "@intellectual-frontiers/headless/logical";
import type { StateStore } from "./state.ts";

/** A signal a run is stopped by. */
export type StopSignal = "SIGINT" | "SIGTERM";

/** Listens for the signals: gives the function that stops listening. */
export type SignalPort = { on(signal: StopSignal, handler: () => void): () => void };

/** Calls a function every so many milliseconds: gives the function that stops it. */
export type TimerPort = { every(ms: number, fn: () => void): () => void };

/** Where the run's output goes as it is written, besides the text `run` gives back. */
export type Sink = { out(text: string): void; err(text: string): void };

/** What an observer is told about a run, at its start. */
export type RunInfo = { readonly program: string; readonly version: string; readonly command: string };

/** What an observer is told while the run goes on. */
export type RunEvents = {
  phase(name: string): void;
  problem(problem: Problem): void;
};

/** How a run ended, for an observer. */
export type RunEnd = { readonly code: number; readonly counts: Counts };

/**
 * A port for what watches runs (an OpenTelemetry adapter, a log shipper): the surface does not know it. It is given the run as a function, and
 * the events of the run; what it returns is what `run` returns, so that it can wrap the run in a span, as `proc.setProcessTracer` wraps a program.
 */
export type RunObserver = {
  observe<T extends RunEnd>(info: RunInfo, run: (events: RunEvents) => Promise<T>): Promise<T>;
};

/** What a run is given about its world. */
export type Io = {
  /** What asks the person for a credential (0011-credential-prompt): none where there is no way to. */
  readonly credentials?: CredentialPort;
  /** The timer the time limit of a credential prompt runs on; the process's where it is not given. */
  readonly clock?: Clock;
  /** How long a credential prompt may wait, held to the longest the library allows. */
  readonly credentialTimeoutMs?: number;
  /** The tier the caller holds (0010-audience-tiers): the program's default tier where the surface does not say. */
  readonly tier?: TierName;
  /** A variable of the environment. */
  readonly env: (name: string) => string | undefined;
  readonly os: dirs.Os;
  /** Whether each standard stream is a terminal. */
  readonly terminal: { readonly stdin: boolean; readonly stdout: boolean; readonly stderr: boolean };
  /** The width of the terminal, where it is one. */
  readonly columns: number | undefined;
  /** What the error stream (where the narration goes) can show, decided once by the host with `capabilitiesOf` (FR-016): decided from `env` and `terminal` where it is not given. */
  readonly caps?: UiCaps;
  /** What the output stream (where a report goes) can show, decided once by the host: plain where it is a pipe. Decided from `env` and `terminal` where it is not given. */
  readonly outCaps?: UiCaps;
  /** Milliseconds since the epoch. */
  readonly now: () => number;
  readonly pid: number;
  /** One line of input without its line ending; `undefined` where the input ends. */
  readonly readLine: () => Promise<string | undefined>;
  /** The files of the program's state; none where there is no place for them (a run then keeps no log). */
  readonly state?: StateStore;
  readonly signals?: SignalPort;
  readonly timer?: TimerPort;
  readonly observer?: RunObserver;
  /** How the marks are written: `plain` (ASCII), `emoji`, or `auto` (the default): plain unless the stream is a terminal that shows emoji and nothing asks for plain (`NO_COLOR`, `--no-color`, the program's `_PLAIN`). */
  readonly marks?: "auto" | "emoji" | "plain";
  /** Where `--on <target>` runs a command: the executor of each target by its id (the ssh executor of `targets/ssh`, given by the program that wires them). */
  readonly executors?: ExecutorFor;
  /** Output as it is written (the host streams it; a test leaves it out and reads the result). */
  readonly sink?: Sink;
};

/** What a run gives back: the status, and what it wrote to each stream. */
export type RunResult = { readonly code: number; readonly out: string; readonly err: string };
