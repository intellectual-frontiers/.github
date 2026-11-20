// Spec: 0001-telemetry FR-024
/**
 * The console: the one code of IFC TypeScript that writes for a person to standard output or standard error (commons 0001-telemetry FR-024).
 * It is a processor of the signal pipeline (`src/signals.ts`'s `Processor`): every span that starts, records progress or ends and every
 * log record goes through the kernel's pure renderer (`src/render.ts`), and the frames it returns are written. The mode is the one asked
 * for (the option, else `IFC_CONSOLE=attended|plain|quiet|silent|json`), else `attended` at a terminal and `plain` elsewhere
 * (`system/tty`'s look decides what a terminal is, and whether colour and emoji may be used). In `attended` mode a timer, which never
 * keeps the process alive, redraws the live region so elapsed times move. At shutdown it asks the exporting processors it watches to
 * flush, says once, dimmed, where signals were not sent (FR-024), ends the live region and waits, a bounded time, for the writes to drain.
 *
 * `installUncaught` makes an uncaught exception or an unhandled rejection an error log record (`exception.type`, `exception.message`,
 * `exception.stacktrace`) emitted through the telemetry, so it is rendered and exported like any other signal; the telemetry is then shut
 * down (bounded) and the process exits with status 1. Its kind, `exception`, is declared in `uncaughtSignals`, to spread into a registry.
 *
 * It depends only on the kernel's interfaces, so it plugs into any telemetry.
 *
 * @example
 * ```ts
 * import { createTelemetry, defineSignals } from "../signals.ts";
 * import { consoleProcessor, installUncaught, uncaughtSignals } from "./console.ts";
 * const registry = defineSignals({ ...uncaughtSignals, "build.step": { signal: "span", role: "step", attributes: { target: "string" } } });
 * const telemetry = createTelemetry({ registry, processors: [consoleProcessor({ registry })], ...rest });
 * installUncaught(telemetry);
 * ```
 *
 * @module
 */
import process from "node:process";
import { clearInterval, clearTimeout, setInterval, setTimeout } from "node:timers";
import type { AnyValue, Attributes } from "../otel.ts";
import { SEVERITY } from "../otel.ts";
import { chooseMode, initial, type Input, type Mode, parseMode, render, type State } from "../render.ts";
import { type Declarations, describeError, type FlushResult, type Processor, type ProcessorStats, type Registry } from "../signals.ts";
import { env, exit } from "@intellectual-frontiers/system/proc";
import { currentLook, type Look } from "@intellectual-frontiers/system/tty";

/** A processor whose exports the console watches, to say at the end where signals were not sent (an `ExportingProcessor`). */
export type Watched = { stats(): ProcessorStats; forceFlush(timeoutMs: number): Promise<FlushResult> };

/** How a console is made; everything but the registry has a default. */
export type ConsoleOptions = {
  /** The registry that gives each kind its presentation role. */
  readonly registry: Registry<Declarations>;
  /** The mode; by default the one `IFC_CONSOLE` names, else `attended` at a terminal and `plain` elsewhere. */
  readonly mode?: Mode;
  /** The stream written to: standard error by default, standard output in `json` mode. */
  readonly stream?: "stdout" | "stderr";
  /** What the terminal shows; by default `currentLook` of the stream. */
  readonly look?: Look;
  /** The environment the mode is read from; this process's by default. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The exporting processors to ask, at shutdown, whether everything was sent. */
  readonly exporters?: readonly Watched[];
  /** How often the live region is redrawn, in milliseconds (200 by default). */
  readonly tickMs?: number;
  /** The time now, in nanoseconds since the Unix epoch, for elapsed times; the system's clock by default. */
  readonly now?: () => bigint;
  /** A signal's text from its kind and attributes (`render.ts`'s `defaultText` by default). */
  readonly text?: (name: string, attributes: Attributes) => string;
};

/** The console: a processor, with its mode, and a way to add an export warning said at the end. */
export type ConsoleProcessor = Processor & {
  /** The mode it writes in. */
  readonly mode: Mode;
  /** Keeps a warning about an export, said once, dimmed, at the end of the run (FR-024). */
  warn(message: string): void;
};

const systemNow = (): bigint => BigInt(Date.now()) * 1_000_000n;

/** A promise that settles with `promise`, or with `fallback` once `ms` have passed; the timer never keeps the process alive. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), Math.max(0, ms));
    timer.unref();
    void promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function unsent(stats: ProcessorStats): { readonly count: number; readonly lastError: string | undefined } {
  let count = 0;
  let lastError: string | undefined;
  for (const s of [stats.traces, stats.logs, stats.metrics]) {
    count += s.failed + s.dropped + s.rejected;
    lastError = s.lastError ?? lastError;
  }
  return { count, lastError };
}

/** A console processor: renders every signal it is handed and writes the frames for a person (FR-026). */
export function consoleProcessor(options: ConsoleOptions): ConsoleProcessor {
  const vars = options.env ?? env.toObject();
  const requested = options.mode ?? vars["IFC_CONSOLE"];
  const asked = requested === undefined ? undefined : parseMode(requested);
  const streamName = options.stream ?? (asked === "json" ? "stdout" : "stderr");
  const look = options.look ?? currentLook(streamName);
  const mode = options.mode ?? chooseMode({ requested, tty: look.tty });
  const stream = streamName === "stdout" ? process.stdout : process.stderr;
  const now = options.now ?? systemNow;
  let state: State = initial({
    mode,
    look,
    registry: options.registry,
    ...(options.text === undefined ? {} : { text: options.text }),
  });
  let timer: ReturnType<typeof setInterval> | undefined;

  const write = (frames: string): void => {
    if (frames === "") return;
    try {
      stream.write(frames);
    } catch {
      // A closed stream: nothing more can be shown, and the program goes on.
    }
  };
  const feed = (input: Input): void => {
    const step = render(state, input, now());
    state = step.state;
    write(step.frames);
    if (mode === "attended" && timer === undefined && state.live.length > 0 && !state.finished) {
      timer = setInterval(() => feed({ kind: "tick" }), Math.max(20, options.tickMs ?? 200));
      timer.unref();
    }
  };
  const stopTimer = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  const drained = (): Promise<void> =>
    new Promise<void>((resolve) => {
      try {
        stream.write("", () => resolve());
      } catch {
        resolve();
      }
    });

  return {
    mode,
    warn: (message) => feed({ kind: "export-warning", message }),
    onStart: (span, source) => feed({ kind: "span-start", span, source }),
    onEvent: (span, event, source) => feed({ kind: "span-event", span, event, source }),
    onEnd: (span, source) => feed({ kind: "span-end", span, source }),
    onLog: (record, source) => feed({ kind: "log", record, source }),
    forceFlush: async (timeoutMs) => {
      await within(drained(), timeoutMs, undefined);
      return { kind: "done" };
    },
    shutdown: async (timeoutMs) => {
      const started = Date.now();
      const watched = options.exporters ?? [];
      if (watched.length > 0) {
        const flushed = await within(
          Promise.all(watched.map((w) => w.forceFlush(timeoutMs))),
          timeoutMs,
          watched.map((): FlushResult => ({ kind: "timeout" })),
        );
        if (flushed.some((f) => f.kind === "timeout"))
          feed({ kind: "export-warning", message: "the signals were not all sent: no collector answered in time" });
        for (const w of watched) {
          const u = unsent(w.stats());
          if (u.count > 0) {
            feed({
              kind: "export-warning",
              message: `${u.count} signals were not sent${u.lastError === undefined ? "" : `: ${u.lastError}`}`,
            });
          }
        }
      }
      stopTimer();
      feed({ kind: "finish" });
      await within(drained(), Math.max(0, timeoutMs - (Date.now() - started)), undefined);
      return { kind: "done" };
    },
  };
}

/** The kind of log record an uncaught exception or an unhandled rejection becomes, to spread into a registry. */
export const uncaughtSignals = {
  exception: {
    signal: "log",
    role: "error",
    severity: SEVERITY.FATAL,
    description: "An uncaught exception or an unhandled rejection, after which the process exits with status 1.",
    attributes: { "exception.type": "string", "exception.message": "string", "exception.stacktrace?": "string" },
  },
} as const satisfies Declarations;

/** The attributes of an `exception` log record. */
export type ExceptionAttributes = {
  readonly "exception.type": string;
  readonly "exception.message": string;
  readonly "exception.stacktrace"?: string;
};

/** What `installUncaught` needs of a telemetry: a `Telemetry` whose registry declares `uncaughtSignals` is one. */
export type UncaughtTarget = {
  log(kind: "exception", attributes: ExceptionAttributes, body?: AnyValue): void;
  shutdown(timeoutMs: number): Promise<FlushResult>;
};

/** How `installUncaught` ends the process: the most time the telemetry has to shut down, and the exit (`proc.exit` by default). */
export type UncaughtOptions = { readonly timeoutMs?: number; readonly exit?: (code: number) => void };

/** The attributes and the text of the error log record for a thrown value. */
export function exceptionOf(thrown: unknown): { readonly attributes: ExceptionAttributes; readonly text: string } {
  const type = thrown instanceof Error ? thrown.name : typeof thrown;
  const message = describeError(thrown);
  const stack = thrown instanceof Error && thrown.stack !== undefined ? { "exception.stacktrace": thrown.stack } : {};
  return { attributes: { "exception.type": type, "exception.message": message, ...stack }, text: `${type}: ${message}` };
}

/**
 * On an uncaught exception or an unhandled rejection: an `exception` log record through the telemetry (so the console renders it), the
 * telemetry shut down within `timeoutMs` (1000 by default), and exit status 1 (FR-026). A second one while this happens exits at once.
 * Returns what removes the handlers.
 */
export function installUncaught(telemetry: UncaughtTarget, options: UncaughtOptions = {}): () => void {
  const timeoutMs = options.timeoutMs ?? 1000;
  const end = options.exit ?? ((code: number): void => exit(code));
  let handling = false;
  const handle = (thrown: unknown): void => {
    if (handling) return end(1);
    handling = true;
    const e = exceptionOf(thrown);
    try {
      telemetry.log("exception", e.attributes, e.text);
    } catch {
      // A telemetry already shut down: the exit status still says it.
    }
    void within(
      telemetry.shutdown(timeoutMs).then(() => undefined),
      timeoutMs + 100,
      undefined,
    ).then(() => end(1));
  };
  process.on("uncaughtException", handle);
  process.on("unhandledRejection", handle);
  return () => {
    process.off("uncaughtException", handle);
    process.off("unhandledRejection", handle);
  };
}
