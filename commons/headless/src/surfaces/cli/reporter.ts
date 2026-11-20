// Spec: 0004-headless-cli FR-003, FR-004, FR-005, FR-007
/**
 * The calm reporter (commons headless 0004-headless-cli FR-003, FR-005, FR-007): what a command tells while it runs, drawn as a person wants to read
 * it. Quiet on success and loud on a problem: a line for a phase only when it has something to see (a green step line is for `--verbose`), every item only with `--verbose`, the problems kept for the closing
 * block, and the whole run, every item and every problem, in the run's log whatever the mode. On a terminal a phase in progress is one line redrawn
 * in place (a spinner, a progress bar, what it is doing now); anywhere else there are only the final lines, with no control character in them.
 *
 * @example
 * ```ts
 * import { Reporter } from "./reporter.ts";
 * const written: string[] = [];
 * const r = new Reporter({ look: { tty: false, colour: false, emoji: false, columns: 80 }, verbosity: "calm", write: (t) => written.push(t), now: () => 0 });
 * r.progress({ kind: "phase", name: "Packages" });
 * r.progress({ kind: "done", result: "86 installed" });
 * r.close();
 * written.join(""); // "": a phase that went well is no line in calm
 * ```
 *
 * @module
 */
import type { Problem, ProblemLevel } from "@intellectual-frontiers/headless/governance";
import { shows, type Hint, type LineKind, type Progress, type ProgressEvent, type Verbosity } from "@intellectual-frontiers/headless/logical";
import type { RunEvents, TimerPort } from "./io.ts";
import type { RunLog } from "./state.ts";
import { dim, fit, fmtDuration, line, mark, paint, progressBar, spinnerFrame, type Look, type Tone } from "./style.ts";

/** What a reporter is made from. */
export type ReporterOptions = {
  readonly look: Look;
  readonly verbosity: Verbosity;
  /** Where the screen text goes (the error stream). */
  readonly write: (text: string) => void;
  readonly now: () => number;
  readonly log?: RunLog;
  /** Redraws the line in progress; used only on a terminal. */
  readonly timer?: TimerPort;
  /** What watches the run. */
  readonly events?: RunEvents;
};

/** How wide the name of a phase is written, so that the details of several phases line up. */
const NAME_WIDTH = 18;

const SEVERITY: Readonly<Record<ProblemLevel, number>> = { fail: 4, warn: 3, action: 2, pending: 1 };

type Phase = {
  readonly name: string;
  readonly started: number;
  items: { ok: number; change: number; skip: number; note: number };
  worst: ProblemLevel | undefined;
  result: string | undefined;
};

/** The reporter of one run. */
export class Reporter {
  /** Every problem told, in order. */
  readonly problems: Problem[] = [];
  /** Every line the run wanted seen. */
  readonly outcomes: string[] = [];
  /** Every hint told. */
  readonly hints: Hint[] = [];
  /** The `Progress` to give the command. */
  readonly progress: Progress = (event) => this.handle(event);

  readonly #o: ReporterOptions;
  #phase: Phase | undefined;
  #live: string | undefined;
  #liveShown = false;
  #step = 0;
  #stopTimer: (() => void) | undefined;
  #closed = false;

  constructor(options: ReporterOptions) {
    this.#o = options;
  }

  #shows(kind: LineKind): boolean {
    return shows(this.#o.verbosity, kind);
  }

  /** Whether the line in progress is drawn: a terminal, and a mode that shows it. */
  get #drawsLive(): boolean {
    return this.#o.look.tty && this.#shows("live");
  }

  #log(kind: string, text: string): number | undefined {
    return this.#o.log?.write(kind, text);
  }

  #clearLive(): void {
    if (!this.#liveShown) return;
    this.#o.write("\r\u001b[K");
    this.#liveShown = false;
  }

  #redraw(): void {
    if (!this.#drawsLive || this.#phase === undefined) return;
    const text = fit(`${spinnerFrame(this.#step, this.#o.look)} ${this.#phase.name}${this.#live === undefined ? "" : `  ${this.#live}`}`, this.#o.look);
    this.#o.write(`\r${text}\u001b[K`);
    this.#liveShown = true;
  }

  /** Writes a line that stays, above the line in progress. */
  #print(text: string): void {
    this.#clearLive();
    this.#o.write(`${text}\n`);
    this.#redraw();
  }

  #endPhase(): void {
    const p = this.#phase;
    if (p === undefined) return;
    this.#phase = undefined;
    this.#live = undefined;
    this.#stopTimer?.();
    this.#stopTimer = undefined;
    this.#clearLive();
    const tone: Tone = p.worst ?? "ok";
    const counts = [
      p.items.change > 0 ? `${p.items.change} changed` : undefined,
      p.items.ok > 0 ? `${p.items.ok} ok` : undefined,
      p.items.skip > 0 ? `${p.items.skip} skipped` : undefined,
    ].filter((x): x is string => x !== undefined);
    const detail = p.result ?? counts.join(", ");
    const took = this.#o.now() - p.started;
    const text = `${p.name.padEnd(NAME_WIDTH)} ${detail}${took >= 1000 ? ` ${dim(`(${fmtDuration(took)})`, this.#o.look)}` : ""}`.trimEnd();
    this.#log("phase", `end ${p.name}: ${detail} (${took}ms)`);
    if (this.#shows(p.worst === undefined ? "step" : "phase")) this.#o.write(`${line(tone, text, this.#o.look)}\n`);
  }

  /** Tells the reporter what the command is doing. */
  handle(event: ProgressEvent): void {
    switch (event.kind) {
      case "header": {
        this.#log("header", event.subtitle === "" ? event.title : `${event.title}: ${event.subtitle}`);
        if (this.#shows("header")) {
          this.#print(`${paint("accent", event.title, this.#o.look)}${event.subtitle === "" ? "" : dim(`  ${event.subtitle}`, this.#o.look)}`);
        }
        return;
      }
      case "phase": {
        this.#endPhase();
        this.#phase = { name: event.name, started: this.#o.now(), items: { ok: 0, change: 0, skip: 0, note: 0 }, worst: undefined, result: undefined };
        this.#log("phase", `start ${event.name}`);
        this.#o.events?.phase(event.name);
        if (this.#drawsLive && this.#o.timer !== undefined) {
          this.#stopTimer = this.#o.timer.every(100, () => {
            this.#step += 1;
            this.#redraw();
          });
        }
        this.#redraw();
        return;
      }
      case "step": {
        this.#live = `${progressBar(event.n, event.total, 20, this.#o.look)} ${event.n}/${event.total}${event.label === "" ? "" : `  ${event.label}`}`;
        this.#redraw();
        return;
      }
      case "live": {
        this.#live = event.message;
        this.#redraw();
        return;
      }
      case "done": {
        if (this.#phase !== undefined) this.#phase.result = event.result;
        return;
      }
      case "item": {
        if (this.#phase !== undefined) this.#phase.items[event.item] += 1;
        this.#log("item", `${event.item} ${event.message}`);
        if (this.#shows("item")) {
          const prefix = event.item === "ok" || event.item === "change" ? `${mark("ok", this.#o.look)} ` : event.item === "skip" ? `${mark("skip", this.#o.look)} ` : "";
          this.#print(`   ${prefix}${dim(event.message, this.#o.look)}`);
        }
        return;
      }
      case "problem": {
        const logLine = this.#log("problem", `${event.problem.level} ${event.problem.code ?? ""} ${event.problem.message}${event.problem.raw === undefined ? "" : ` | ${event.problem.raw}`}`.replace(/\s+/g, " "));
        const p: Problem = logLine === undefined || event.problem.logLine !== undefined ? event.problem : { ...event.problem, logLine };
        this.problems.push(p);
        this.#o.events?.problem(p);
        if (this.#phase !== undefined && (this.#phase.worst === undefined || SEVERITY[p.level] > SEVERITY[this.#phase.worst])) this.#phase.worst = p.level;
        return;
      }
      case "outcome": {
        this.outcomes.push(event.text);
        this.#log("outcome", event.text);
        if (this.#shows("outcome")) this.#print(`   ${event.text}`);
        return;
      }
      case "hint": {
        this.hints.push(event.hint);
        this.#log("hint", `${event.hint.id} ${event.hint.message}`);
        return;
      }
    }
  }

  /** Ends the phase in progress and the line drawn for it; nothing is drawn after this. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#endPhase();
    this.#stopTimer?.();
    this.#clearLive();
  }
}
