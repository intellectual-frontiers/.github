// What a person sees, as a rendering of signals (009-machine-bootstrap FR-061 to FR-066; commons 0006-signals FR-021 to FR-026): every line goes through
// commons' console (runtime/console.ts), which colours and marks only at a terminal and never with NO_COLOR or TERM=dumb, so a log or a pipe stays plain.
// Three consoles, so that each line keeps the stream it has always had: what the setup says on standard output; its warnings and stops on standard error;
// and, on standard error too, the steps in progress (one live line each, nested, with the elapsed time and how far a counting step has come, at a terminal),
// the step that failed and the network's retries. The messages are log records of a pipeline of their own, which no exporter sees: what the screen says
// (a user name, a GitHub login, a path) is never sent anywhere. The steps are the spans of the setup's telemetry (signals.ts), which this console renders.
// The log keeps every message and every step's output, one timestamped line each, without colour (FR-066).
import { SEVERITY } from "../../commons/ts/kernel/otel.ts";
import { mark } from "../../commons/ts/kernel/palette.ts";
import { type Declarations, defineSignals, type Processor, type Registry, type Telemetry } from "../../commons/ts/kernel/signals.ts";
import { plain } from "../../commons/ts/kernel/text.ts";
import { consoleProcessor } from "../../commons/ts/runtime/console.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { createPipeline, type Pipeline } from "../../commons/ts/runtime/otel.ts";
import * as proc from "../../commons/ts/runtime/proc.ts";
import * as tty from "../../commons/ts/runtime/tty.ts";
import { SETUP_SIGNALS } from "./signals.ts";

export type Look = tty.Look;

/** How the screen looks: colour and emoji only at a terminal, as commons' runtime/tty decides from the environment. */
export function lookOf(env: Readonly<Record<string, string>>): Look {
  const size = tty.consoleSize();
  return tty.lookOf({ env, terminal: tty.isTerminal("stderr"), os: proc.build.os, ...(size === undefined ? {} : { columns: size.columns }) });
}

/** The lines a person reads, as log records: what is said on standard output and on standard error, a warning, and a retry beside the steps. */
export const DISPLAY_SIGNALS = defineSignals({
  "setup.say": { signal: "log", role: "result", severity: SEVERITY.INFO, attributes: {}, description: "A line on standard output." },
  "setup.attention": {
    signal: "log",
    role: "warning",
    severity: SEVERITY.WARN,
    attributes: {},
    description: "A group of steps that needs attention, on standard output.",
  },
  "setup.tell": { signal: "log", role: "result", severity: SEVERITY.INFO, attributes: {}, description: "A line on standard error." },
  "setup.warn": { signal: "log", role: "warning", severity: SEVERITY.WARN, attributes: {}, description: "A warning, on standard error." },
  "setup.retry": { signal: "log", role: "result", severity: SEVERITY.INFO, attributes: {}, description: "A retry of the network, beside the steps." },
});
type DisplayKinds = (typeof DISPLAY_SIGNALS)["kinds"];

/** The emoji of each role, or plain words where the terminal has none. */
export type Marks = Readonly<
  Record<
    | "tick"
    | "cross"
    | "warn"
    | "rocket"
    | "pkg"
    | "dl"
    | "list"
    | "rust"
    | "ok"
    | "stop"
    | "what"
    | "why"
    | "log"
    | "pack"
    | "help"
    | "key"
    | "dir"
    | "sync"
    | "next"
    | "retry"
    | "one"
    | "two"
    | "three"
    | "wait"
    | "radio",
    string
  >
>;
export const marksOf = (emoji: boolean): Marks =>
  emoji
    ? {
      tick: mark("done", { emoji }),
      cross: mark("failed", { emoji }),
      warn: `${mark("warning", { emoji })} `,
      rocket: "🚀 ",
      pkg: "📦 ",
      dl: "📥 ",
      list: "📋 ",
      rust: "🦀 ",
      ok: "✅ ",
      stop: "🛑 ",
      what: "❓ ",
      why: "💬 ",
      log: "📄 ",
      pack: "🎁 ",
      help: "🤝 ",
      key: "🔐 ",
      dir: "📂 ",
      sync: "🔄 ",
      next: `${mark("hint", { emoji })} `,
      retry: "🔁 ",
      one: "1️⃣ ",
      two: "2️⃣ ",
      three: "3️⃣ ",
      wait: "⏳ ",
      radio: "📡 ",
    }
    : {
      tick: "ok",
      cross: "x",
      warn: "!",
      rocket: "",
      pkg: "",
      dl: "",
      list: "",
      rust: "",
      ok: "",
      stop: "",
      what: "",
      why: "",
      log: "",
      pack: "",
      help: "",
      key: "",
      dir: "",
      sync: "",
      next: "-> ",
      retry: "~ ",
      one: "",
      two: "",
      three: "",
      wait: "",
      radio: "",
    };

/** At most n characters, the end shown as ... where it is cut, so that a line of a program's output never wraps. */
export const clip = (n: number, s: string): string => s.length > n ? `${s.slice(0, n - 1)}...` : s;

/** The log: every message and every step's output, one timestamped line each, without colour (FR-066). */
export class Log {
  #lines = 0;
  readonly path: string | null;
  readonly supportPath: string | null;
  constructor(path: string | null, supportPath: string | null) {
    this.path = path;
    this.supportPath = supportPath;
  }
  get lines(): number {
    return this.#lines;
  }
  /** One timestamped line. */
  line(text: string): void {
    this.raw(`${new Date().toTimeString().slice(0, 8)} ${plain(text)}\n`);
  }
  /** Text as it is (a step's output). */
  raw(text: string): void {
    if (this.path === null || text === "") return;
    try {
      fs.writeTextFileSync(this.path, plain(text), { append: true });
      this.#lines += (text.match(/\n/g) ?? []).length;
    } catch { /* a log that cannot be written changes nothing else */ }
  }
}

/** A processor that hands on only the log records and spans of the kinds named. */
function only(kinds: readonly string[], p: Processor): Processor {
  const k = new Set(kinds);
  return {
    onStart: (span, source) => k.has(span.name) && p.onStart?.(span, source),
    onEvent: (span, event, source) => k.has(span.name) && p.onEvent?.(span, event, source),
    onEnd: (span, source) => k.has(span.name) && p.onEnd?.(span, source),
    onLog: (record, source) => record.eventName !== undefined && k.has(record.eventName) && p.onLog?.(record, source),
    forceFlush: (ms) => p.forceFlush(ms),
    shutdown: (ms) => p.shutdown(ms),
  };
}

const QUIETLY_DONE = "bootstrap.step.done";

/**
 * The calm screen (FR-062): away from a terminal a step that worked leaves no line behind unless BOOTSTRAP_VERBOSE=1 (its span ends under a name the console
 * does not show), and a step that shows its own output (the sign-in, ./ergactl doctor) is not drawn at all. At a terminal the console's live region must see
 * every span end, so there a step that worked leaves its tick.
 */
function calm(hideDone: boolean, p: Processor): Processor {
  const attended = (a: Readonly<Record<string, unknown>>): boolean => a["attended"] === true;
  return {
    onStart: (span, source) => !attended(span.attributes) && p.onStart?.(span, source),
    onEvent: (span, event, source) => !attended(span.attributes) && p.onEvent?.(span, event, source),
    onEnd: (span, source) => {
      if (attended(span.attributes)) return;
      const quiet = hideDone && span.status.kind !== "error" && (span.name === "bootstrap.step" || span.name === "bootstrap.pool");
      p.onEnd?.(quiet ? { ...span, name: QUIETLY_DONE } : span, source);
    },
    onLog: (record, source) => p.onLog?.(record, source),
    forceFlush: (ms) => p.forceFlush(ms),
    shutdown: (ms) => p.shutdown(ms),
  };
}

/** What a step's line says: its label (or the pool's title), not the kind and every attribute. */
function stepText(name: string, attributes: Readonly<Record<string, unknown>>): string {
  const label = attributes["step"] ?? attributes["title"];
  return typeof label === "string" ? label : name;
}

/** The screen: messages, groups of steps (one line each when done), headings, and what a dry run would do. */
export class Ui {
  readonly e: Marks;
  /** The console of the steps, to be handed every span of the setup's telemetry. */
  readonly live: Processor;
  readonly #display: Telemetry<DisplayKinds>;
  readonly #pipeline: Pipeline;
  readonly look: Look;
  readonly log: Log;
  readonly dry: boolean;
  #phase = "";
  #phaseBad = false;
  constructor(look: Look, log: Log, dry: boolean, verbose = false) {
    this.look = look;
    this.log = log;
    this.dry = dry;
    this.e = marksOf(look.emoji);
    const registry: Registry<Declarations> = { kinds: { ...SETUP_SIGNALS.kinds, ...DISPLAY_SIGNALS.kinds } };
    // the quiet mode writes every line a person must read, coloured at a terminal and never cut to its width; the live one is the terminal's own
    const out = consoleProcessor({ registry, mode: "quiet", stream: "stdout", look });
    const err = consoleProcessor({ registry, mode: "quiet", stream: "stderr", look });
    const live = consoleProcessor({ registry, mode: look.tty ? "attended" : "plain", stream: "stderr", look, text: stepText });
    this.live = calm(!verbose && !look.tty, only(["bootstrap.step", "bootstrap.pool", "setup.retry"], live));
    this.#pipeline = createPipeline({
      resource: { attributes: { "service.name": "erga-bootstrap" } },
      processors: [only(["setup.say", "setup.attention"], out), only(["setup.tell", "setup.warn"], err), this.live],
    });
    this.#display = this.#pipeline.telemetry(DISPLAY_SIGNALS, { name: "erga-bootstrap.screen" });
  }
  /** A line on standard output, and in the log; a text of many lines is as many lines. */
  say(text = ""): void {
    for (const l of text.split("\n")) this.#display.log("setup.say", {}, l);
    this.log.line(text);
  }
  /** To standard error, as the stops are. */
  sayErr(text = ""): void {
    for (const l of text.split("\n")) this.#display.log("setup.tell", {}, l);
    this.log.line(text);
  }
  warn(text: string): void {
    this.#display.log("setup.warn", {}, text);
    this.log.line(`WARNING: ${text}`);
  }
  /** A retry of the network, said beside the steps (FR-033). */
  retry(line: string): void {
    this.#display.log("setup.retry", {}, `  ${this.e.retry}${line}`);
    this.log.line(`retry: ${line}`);
  }
  /** What a dry run would do. */
  would(text: string): void {
    this.#display.log("setup.say", {}, `  would ${text}`);
  }
  /** A step of a dry run's plan. */
  plan(label: string): void {
    this.#display.log("setup.say", {}, `  - ${label}`);
  }
  /** A step starting, where no terminal shows it in progress (FR-061). */
  starting(label: string): void {
    if (!this.look.tty) this.#display.log("setup.tell", {}, `${label}...`);
  }
  /** A group of steps, shown as one line when it is done (a tick, or a warning where something needs attention, FR-062). */
  phase(title: string): void {
    this.phaseClose();
    this.#phase = title;
    if (this.dry) {
      this.#display.log("setup.say", {}, "");
      this.#display.log("setup.say", {}, title);
    }
  }
  get currentPhase(): string {
    return this.#phase;
  }
  markBad(): void {
    this.#phaseBad = true;
  }
  phaseClose(): void {
    if (this.#phase === "") return;
    if (!this.dry) {
      if (this.#phaseBad) this.#display.log("setup.attention", {}, `${this.#phase} (something needs attention, see below)`);
      else this.#display.log("setup.say", {}, `${this.e.tick} ${this.#phase}`);
    }
    this.#phase = "";
    this.#phaseBad = false;
  }
  phaseDrop(): void {
    this.#phase = "";
    this.#phaseBad = false;
  }
  heading(text: string): void {
    this.phaseClose();
    this.#display.log("setup.say", {}, "");
    this.#display.log("setup.say", {}, text);
    this.log.line(text);
  }
  /** The screen finished: what is still in progress is said to have stopped, and every line is written (a second or so at most). */
  async close(): Promise<void> {
    await this.#pipeline.shutdown(1000);
  }
}

/** A path in the home folder as a person reads it: ~/... */
export function shortPath(home: string, p: string): string {
  return p.startsWith(`${home}/`) ? `~/${p.slice(home.length + 1)}` : p;
}

/** What may never be written to a support file or sent: tokens and the values of settings that look secret. */
export function redact(text: string): string {
  return text
    .replace(/(gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "$1[removed]")
    .replace(/(ph[cx]_)[A-Za-z0-9_]+/g, "$1[removed]")
    .replace(/(token|password|secret|key)=[^ \n]+/gi, "$1=[removed]");
}
