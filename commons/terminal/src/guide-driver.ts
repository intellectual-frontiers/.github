// Spec: 0002-guide FR-004
/**
 * The driver of a guided flow (commons terminal 0002-guide FR-004 to FR-008): `runGuide` loops (next step, decode, render, carry out) through
 * the caller's functions and shows each step at the level the capabilities allow. It names no host: the input, the output, the clock and the
 * signal are parameters, so that a test scripts all of them and the real program passes `process.stdin`, `process.stdout` and its own signal.
 *
 * It never answers for the person: a `human` step waits for the person (and where the input is not a TTY ends with `E-GUIDE-NEEDS-PERSON`
 * with the step, never waiting), a field marked `secret` is refused (`E-GUIDE-SECRET-FIELD`) before anything is asked, and the driver has no
 * way to read input without echo. On an abort it leaves the terminal as it found it and ends with `E-GUIDE-ABORTED`, whose status is 130.
 *
 * @example
 * ```ts
 * import { exitCodeOf, lineReader, runGuide } from "./guide-driver.ts";
 * import { capabilitiesOf } from "./guide-caps.ts";
 * const result = await runGuide({
 *   next: async () => machine.step(),
 *   run: async ({ step, answers }) => machine.apply(step, answers),
 *   out: process.stdout,
 *   in: lineReader(process.stdin, process.stdin.isTTY === true),
 *   caps: capabilitiesOf(process.env, process.stdout),
 *   signal: controller.signal,
 * });
 * process.exitCode = exitCodeOf(result);
 * ```
 *
 * @module
 */
import { err, ok, type DecodeError, type Result } from "@intellectual-frontiers/core";
import { atMost, FULL_MIN_COLUMNS, FULL_MIN_ROWS, type GuideCaps } from "./guide-caps.ts";
import { type AskField, decodeStep, type DoneStep, type GuideStep } from "./guide-model.ts";
import { clean, renderPrompt, renderResult, renderStep, renderStepParts, wrap } from "./guide-render.ts";
import { drawScreen, ENTER, frameOf, LEAVE, layoutOf, type PlanItem } from "./guide-screen.ts";
import { paint } from "./palette.ts";

const ESC = String.fromCharCode(0x1b);

/** What reading a line gave: a line (without its end), the end of the input, or the abort of the signal. */
export type LineRead = { readonly kind: "line"; readonly text: string } | { readonly kind: "end" } | { readonly kind: "aborted" };

/** The input of a guide: whether a person is at it, and lines. */
export type GuideIn = {
  /** True where a person types at it (a TTY); false for a pipe or a file. */
  readonly isTTY: boolean;
  /** The next line without its end (`\n`, `\r\n` or `\r`), the end of the input, or the abort of `signal`. */
  readLine(signal?: AbortSignal): Promise<LineRead>;
};

/** The output of a guide: text, the size where it is known, and a way to hear of a resize. */
export type GuideOut = {
  write(text: string): void;
  readonly columns?: number | undefined;
  readonly rows?: number | undefined;
  /** Calls `listener` when the terminal is resized; returns the function that stops it. */
  onResize?(listener: () => void): () => void;
};

/** The clock of a guide: the time in milliseconds, and a sleep that ends early on an abort. */
export type GuideClock = {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};

/** What a verb gave back: a sentence, and optional lines of detail. */
export type GuideRunResult = { readonly summary: string; readonly lines?: readonly string[] };

/** What the driver hands the caller to carry out: the step and the answers the person gave (empty for a `run`). */
export type GuideCall = {
  readonly step: GuideStep;
  readonly answers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal | undefined;
  /**
   * Tells the guide the last line of output of the work in progress (FR-018): scrubbed text, one line (control characters are removed and only
   * the first line is kept). The full screen shows it dimmed under the keys, and `plain` prints it as `  | line` at most every 15 seconds.
   */
  readonly progress: (line: string) => void;
};

/**
 * The typed ends of a guide that did not finish; each has `message`, a sentence for a person, and `reported: true`: the driver has already
 * shown it to the person once (on the screen the person keeps), so the caller prints nothing more about it, only the exit status (FR-015).
 */
export type GuideError = GuideErrorBody & { readonly reported: true };

/** The ends of a guide, before the driver has shown them. */
export type GuideErrorBody =
  | { readonly code: "E-GUIDE-NEEDS-PERSON"; readonly step: GuideStep; readonly reason: "input-not-interactive" | "input-ended"; readonly message: string }
  | { readonly code: "E-GUIDE-SECRET-FIELD"; readonly step: GuideStep; readonly field: string; readonly message: string }
  | { readonly code: "E-GUIDE-ABORTED"; readonly exitCode: 130; readonly message: string }
  | { readonly code: "E-GUIDE-STEP-INVALID"; readonly error: DecodeError; readonly message: string }
  | { readonly code: "E-GUIDE-RUN-FAILED"; readonly step: GuideStep; readonly reason: string; readonly message: string }
  | { readonly code: "E-GUIDE-DECLINED"; readonly step: GuideStep; readonly message: string }
  | { readonly code: "E-GUIDE-ANSWER-INVALID"; readonly step: GuideStep; readonly field: string; readonly reason: string; readonly message: string }
  | { readonly code: "E-GUIDE-WAIT-TIMEOUT"; readonly step: GuideStep; readonly message: string };

/** What a finished guide gives: the last step and how many were shown. */
export type GuideFinished = { readonly step: DoneStep; readonly steps: number };

/** How a `wait` is polled. */
export type GuidePoll = {
  /** The first pause, in milliseconds (default 500). */
  readonly initialMs?: number;
  /** The longest pause (default 5000). */
  readonly maxMs?: number;
  /** The growth of the pause at each poll (default 1.5). */
  readonly factor?: number;
  /** In `plain`, a line that says it is still waiting every so many milliseconds (default 10000). */
  readonly plainEveryMs?: number;
  /** The time between frames of the spinner (default 120). */
  readonly spinnerMs?: number;
  /** Gives up after so many milliseconds of waiting (default: never). */
  readonly maxWaitMs?: number;
};

/** What `runGuide` takes. */
export type GuideOptions = {
  /** The next step (anything: it is decoded by `decodeStep`, and a step that is not one ends the guide). */
  readonly next: (signal?: AbortSignal) => Promise<unknown>;
  /** Carries out a `run` step, and takes the answers of a `question` and the acknowledgement of a `human` step. */
  readonly run: (call: GuideCall) => Promise<Result<GuideRunResult, string>>;
  /** Validates one answer: the value to keep, or why it is refused (the field is asked again). By default, any answer that is not empty. */
  readonly ask?: (field: AskField, answer: string, step: GuideStep) => Result<string, string>;
  /** Asked before a `run` step is carried out; false ends the guide with `E-GUIDE-DECLINED`. Never answered by the driver. */
  readonly confirm?: (step: GuideStep) => Promise<boolean>;
  readonly out: GuideOut;
  readonly in: GuideIn;
  readonly caps: GuideCaps;
  readonly signal?: AbortSignal | undefined;
  /** The steps of the plan, for the left column of the full screen; the count of the title is the position of the current step in it. */
  readonly plan?: readonly PlanItem[];
  /**
   * The ids of the steps of `plan` that were done before this run, for a flow that is resumed in a new process: they are ticked `[x]` from
   * the first frame (FR-011). An id that is not in the plan is ignored; the current step is never ticked until it is done.
   */
  readonly done?: readonly string[];
  /**
   * The ids of the steps of `plan` that were skipped and not done, drawn `[-]` (FR-011) so that a skipped step is not mistaken for one not
   * done yet; an id that is also in `done` is done. An id that is not in the plan is ignored.
   */
  readonly skipped?: readonly string[];
  /**
   * The last line of what the person keeps where the guide ends in a failure or an abort, after the short transcript (FR-015), as a sentence
   * from the caller such as "run it again to retry". Not shown where the guide finishes.
   */
  readonly closing?: string;
  /** The title of the full screen (default "Guide"). */
  readonly title?: string;
  readonly clock?: GuideClock;
  readonly poll?: GuidePoll;
  /** How many times a field is asked again after a refusal (default 5). */
  readonly attempts?: number;
  /** The pace of the sign of life while the caller's `run` works, in milliseconds (default: the footer every 1000, a line in `plain` every 15000). */
  readonly heartbeat?: { readonly footerMs?: number; readonly plainEveryMs?: number };
};

/** The time elapsed as a person reads it: `45s`, `3m10s`, `1h02m05s`. */
export function elapsedOf(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** How many of the last steps the transcript of a guide that ends in a failure or an abort holds (FR-015). */
export const TRANSCRIPT_STEPS = 5;

/** The clock of the host: `Date.now` and the web standard timer; a sleep ends at once on an abort. */
export const systemClock: GuideClock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve) => {
      if (signal?.aborted === true) return resolve();
      const done = (): void => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      signal?.addEventListener("abort", done, { once: true });
    }),
};

const ABORT = Symbol("abort");

function raceAbort<T>(p: Promise<T>, signal: AbortSignal | undefined): Promise<T | typeof ABORT> {
  if (signal === undefined) return p;
  if (signal.aborted) return Promise.resolve(ABORT);
  return new Promise((resolve, reject) => {
    const onAbort = (): void => resolve(ABORT);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/**
 * A line reader over any stream of chunks (`process.stdin` is one): text or bytes decoded as UTF-8. A line ends with `\n`, `\r\n` or `\r`
 * (a `\r` at the end of one chunk and a `\n` at the start of the next are one end); the last line may have none.
 */
export function lineReader(chunks: AsyncIterable<string | Uint8Array>, isTTY: boolean): GuideIn {
  const it = chunks[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let buffer = "";
  let ended = false;
  let pending: Promise<IteratorResult<string | Uint8Array>> | undefined;
  const take = (): LineRead | undefined => {
    const m = /\r\n|\n|\r/.exec(buffer);
    if (m === null) return undefined;
    if (m[0] === "\r" && m.index + 1 === buffer.length && !ended) return undefined;
    const text = buffer.slice(0, m.index);
    buffer = buffer.slice(m.index + m[0].length);
    return { kind: "line", text };
  };
  return {
    isTTY,
    async readLine(signal) {
      for (;;) {
        const got = take();
        if (got !== undefined) return got;
        if (ended) {
          if (buffer === "") return { kind: "end" };
          const text = buffer;
          buffer = "";
          return { kind: "line", text };
        }
        if (signal?.aborted === true) return { kind: "aborted" };
        pending ??= it.next();
        const raced = await raceAbort(pending, signal);
        if (raced === ABORT) return { kind: "aborted" };
        pending = undefined;
        if (raced.done === true) {
          ended = true;
          buffer += decoder.decode();
        } else buffer += typeof raced.value === "string" ? raced.value : decoder.decode(raced.value, { stream: true });
      }
    },
  };
}

const CTRL_C = "\u0003";
const SPIN = ["|", "/", "-", "\\"] as const;

/** The status a program should exit with: 0 for a finished guide, 130 for an abort, 2 where a person or a plain answer is needed, 1 otherwise. */
export function exitCodeOf(result: Result<GuideFinished, GuideError>): number {
  if (result.kind === "ok") return 0;
  switch (result.error.code) {
    case "E-GUIDE-ABORTED":
      return 130;
    case "E-GUIDE-NEEDS-PERSON":
    case "E-GUIDE-SECRET-FIELD":
    case "E-GUIDE-STEP-INVALID":
      return 2;
    case "E-GUIDE-RUN-FAILED":
    case "E-GUIDE-DECLINED":
    case "E-GUIDE-ANSWER-INVALID":
    case "E-GUIDE-WAIT-TIMEOUT":
      return 1;
  }
}

type Block = (caps: GuideCaps) => readonly string[];

/** One block of what the person sees: the step itself, a prompt (and what was typed), or the result of something. */
type Entry = { readonly role: "step" | "prompt" | "result"; readonly block: Block; readonly step?: GuideStep };

/** Runs a guided flow to its end, or to the typed error that ended it (FR-004 to FR-008). */
export async function runGuide(o: GuideOptions): Promise<Result<GuideFinished, GuideError>> {
  const clock = o.clock ?? systemClock;
  const poll = { initialMs: 500, maxMs: 5000, factor: 1.5, plainEveryMs: 10_000, spinnerMs: 120, ...o.poll };
  const attempts = Math.max(1, o.attempts ?? 5);
  const signal = o.signal;
  /** Read each time: the signal may abort at any await. */
  const stopped = (): boolean => signal?.aborted === true;
  const plan = o.plan ?? [];
  const title = o.title ?? "Guide";
  const done = new Set<string>(o.done ?? []);
  const skipped = new Set<string>((o.skipped ?? []).filter((id) => !done.has(id)));
  const failed = new Set<string>();
  /** Everything shown, in order: the transcript the person keeps. The full screen's pane draws only the group of the current step. */
  const entries: Entry[] = [];
  /** Where the group of the current step starts in `entries`. */
  let groupStart = 0;
  /** The last step shown, to see that the same one is asked again. */
  let lastKey = "";
  let position = 0;
  /** The last line of output of the work in progress, shown dimmed under the keys in full. */
  let progressLine = "";
  let status = "";
  let keys = "";
  let typing = false;
  let inAlt = false;
  let shown = 0;
  let current: string | undefined;

  const size = (): { columns: number; rows: number } => ({
    columns: Math.max(20, Math.floor(o.out.columns ?? o.caps.columns)),
    rows: Math.max(4, Math.floor(o.out.rows ?? o.caps.rows)),
  });
  /** The capabilities now: the level asked for, lowered where the terminal is too small or the input is not a person's. */
  const capsNow = (): GuideCaps => {
    const s = size();
    let c: GuideCaps = { ...o.caps, columns: s.columns, rows: s.rows };
    if (c.level === "full" && (s.columns < FULL_MIN_COLUMNS || s.rows < FULL_MIN_ROWS || !o.in.isTTY)) c = atMost(c, "ansi");
    return c;
  };

  const redraw = (): void => {
    const c = capsNow();
    if (c.level !== "full") {
      if (inAlt) {
        inAlt = false;
        o.out.write(LEAVE);
        for (const e of entries) writeLines(e.block(c));
      }
      return;
    }
    if (!inAlt) {
      inAlt = true;
      o.out.write(ENTER);
    }
    const paneCols = Math.max(10, layoutOf(c.columns, c.rows, plan).pane);
    const pc = { ...c, columns: paneCols };
    const group = entries.slice(groupStart);
    const lead = group[0]?.step === undefined ? undefined : renderStepParts(group[0].step, pc);
    const foot = group.slice(lead === undefined ? 0 : 1).flatMap((e) => e.block(pc));
    const pane = [...(lead?.head ?? []), ...(lead?.body ?? []), ...foot];
    const protect = (lead?.command ?? []).map((i) => (lead?.head.length ?? 0) + i);
    o.out.write(
      frameOf(
        drawScreen(
          { title, plan, done, skipped, failed, position, pinned: lead?.head.length ?? 0, keep: foot.length, protect, progress: progressLine, current, pane, status, keys, typing },
          size(),
          c,
        ),
      ),
    );
  };
  const writeLines = (lines: readonly string[]): void => {
    if (lines.length > 0) o.out.write(`${lines.join("\n")}\n`);
  };
  /** Shows a block: printed at `plain` and `ansi`, drawn on the screen at `full`. */
  const show = (b: Block, role: Entry["role"] = "result", step?: GuideStep): void => {
    entries.push(step === undefined ? { role, block: b } : { role, block: b, step });
    const c = capsNow();
    if (c.level === "full") redraw();
    else writeLines(b(c));
  };
  /** Removes the prompts (and what was typed) shown since `from`: the same question asked again is shown once. */
  const dropPrompts = (from: number): void => {
    for (let k = entries.length - 1; k >= from; k--) if (entries[k]?.role === "prompt") entries.splice(k, 1);
  };
  /**
   * Shows a step and makes it the current one. The same step asked for again (the caller's state did not change, so `next` gave it once
   * more) is not shown a second time: what was asked and typed of it is dropped, what came of it stays, and the person is asked again.
   * Returns whether it was shown anew.
   */
  const showStep = (s: GuideStep): boolean => {
    current = s.id;
    done.delete(s.id);
    skipped.delete(s.id);
    failed.delete(s.id);
    const idx = plan.findIndex((p) => p.id === s.id);
    // FR-011: the position of a plan step is its place in the plan; a step that is not in the plan keeps the last known place, which at the
    // first step shown is the step after the last one done or skipped.
    if (idx >= 0) position = Math.max(position, idx + 1);
    else if (position === 0) {
      const last = plan.reduce((m, p, i) => (done.has(p.id) || skipped.has(p.id) ? i + 1 : m), 0);
      position = Math.min(plan.length, last + 1);
    }
    const key = JSON.stringify(s);
    if (key === lastKey && entries.length > groupStart) {
      dropPrompts(groupStart);
      if (capsNow().level === "full") redraw();
      return false;
    }
    lastKey = key;
    groupStart = entries.length;
    show((c) => renderStep(s, c), "step", s);
    return true;
  };
  const setStatus = (s: string, k = keys): void => {
    status = s;
    keys = k;
    if (capsNow().level === "full") redraw();
  };
  const unsubscribe = o.caps.level === "full" ? o.out.onResize?.(redraw) : undefined;

  const restore = (): void => {
    if (inAlt) {
      inAlt = false;
      o.out.write(LEAVE);
    } else if (o.caps.level !== "plain") o.out.write(`${ESC}[0m${ESC}[?25h`);
  };
  const failure = <E extends GuideErrorBody>(e: E): Result<never, GuideError> => {
    if ((e.code === "E-GUIDE-RUN-FAILED" || e.code === "E-GUIDE-ANSWER-INVALID" || e.code === "E-GUIDE-WAIT-TIMEOUT") && plan.some((p) => p.id === e.step.id)) {
      failed.add(e.step.id);
    }
    show((c) => renderResult(false, e.message, [], c));
    return err({ ...e, reported: true } as GuideError);
  };
  const abort = (): Result<never, GuideError> => {
    const message = "Stopped.";
    show((c) => renderResult(false, message, [], c));
    return err({ code: "E-GUIDE-ABORTED", exitCode: 130, message, reported: true });
  };

  const secret = (step: GuideStep): Result<never, GuideError> | undefined => {
    if (step.kind !== "question" && step.kind !== "human") return undefined;
    const bad = (step.ask ?? []).find((f) => f.secret === true);
    if (bad === undefined) return undefined;
    return failure({
      code: "E-GUIDE-SECRET-FIELD",
      step,
      field: bad.field,
      message: `The field ${bad.field} is a secret: this guide never asks for a token or a password. Give it where the program reads it, never here.`,
    });
  };

  /** Asks every field of a step; the answers, or the end of the guide. */
  const askFields = async (
    step: GuideStep,
    fields: readonly AskField[],
    acceptEmpty = false,
  ): Promise<Result<Record<string, string>, GuideError>> => {
    const answers: Record<string, string> = {};
    for (const f of fields) {
      let reason = "";
      const fieldStart = entries.length;
      for (let attempt = 1; ; attempt++) {
        if (stopped()) return abort();
        if (attempt > 1) dropPrompts(fieldStart);
        const prompt = renderPrompt(f, capsNow());
        const last = prompt.at(-1) ?? "  > ";
        // Wrapped again at each drawing, to the width of the pane then (FR-016): a prompt wrapped for the whole screen is cut in the pane.
        if (prompt.length > 1) show((c) => renderPrompt(f, c).slice(0, -1), "prompt");
        entries.push({ role: "prompt", block: () => [last] });
        typing = true;
        if (capsNow().level === "full") {
          if (acceptEmpty) setStatus("press Enter to continue", "Enter continue   Ctrl+C stop");
          else setStatus(`your turn: type ${f.field} and press Enter`, "Enter send   Ctrl+C stop");
        } else o.out.write(last);
        const read = await o.in.readLine(signal);
        typing = false;
        if (read.kind === "aborted" || stopped()) return abort();
        if (read.kind === "end") {
          entries[entries.length - 1] = { role: "prompt", block: () => ["  > (the input ended)"] };
          return failure({
            code: "E-GUIDE-NEEDS-PERSON",
            step,
            reason: "input-ended",
            message: `The input ended before ${f.field} was answered: this step needs a person at a terminal.`,
          });
        }
        if (read.text.includes(CTRL_C)) return abort();
        const text = clean(read.text).trim();
        entries[entries.length - 1] = { role: "prompt", block: () => [`  > ${text}`] };
        if (capsNow().level !== "full") {
          /* the terminal echoed the typed line; the pipe did not */
          if (!o.in.isTTY) o.out.write(`${text}\n`);
        } else redraw();
        const checked: Result<string, string> = acceptEmpty
          ? ok(text)
          : o.ask === undefined
            ? text === ""
              ? err("an answer is needed")
              : ok(text)
            : o.ask(f, text, step);
        if (checked.kind === "ok") {
          answers[f.field] = checked.value;
          break;
        }
        reason = checked.error;
        if (attempt >= attempts) {
          return failure({
            code: "E-GUIDE-ANSWER-INVALID",
            step,
            field: f.field,
            reason,
            message: `${f.field}: ${reason} (given up after ${attempts} tries).`,
          });
        }
        const why = reason;
        show((c) => renderResult(false, `${why}. Try again.`, [], c));
      }
    }
    return ok(answers);
  };

  /**
   * Runs the caller's work with a sign of life (FR-018): in full the footer says `working... 12s` and is drawn every second with the last
   * line of output under the keys; elsewhere a line `still working: VERB, 3m10s elapsed` every 15 seconds and the last line of output as
   * `  | line`, at most as often. The ticker ends with the work, and never keeps the process waiting.
   */
  const withHeartbeat = async <T>(step: GuideStep, work: (progress: (line: string) => void) => Promise<T>): Promise<T> => {
    const label = step.kind === "run" ? step.verb.id : step.id;
    const started = clock.now();
    const footerMs = Math.max(1, o.heartbeat?.footerMs ?? 1000);
    const everyMs = Math.max(1, o.heartbeat?.plainEveryMs ?? 15_000);
    const stop = new AbortController();
    const relay = (): void => stop.abort();
    signal?.addEventListener("abort", relay, { once: true });
    let latest = "";
    let printed = "";
    let lastPrint = started;
    const base = step.kind === "run" ? `working... running ${step.verb.id}` : "working...";
    const progress = (line: string): void => {
      latest = clean(line).split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
    };
    const tick = async (): Promise<void> => {
      while (!stop.signal.aborted) {
        await clock.sleep(footerMs, stop.signal);
        if (stop.signal.aborted) return;
        const now = clock.now();
        if (capsNow().level === "full") {
          progressLine = latest;
          setStatus(`${base} ${elapsedOf(now - started)}`, "Ctrl+C stop");
        } else if (now - lastPrint >= everyMs) {
          lastPrint = now;
          o.out.write(`still working: ${clean(label)}, ${elapsedOf(now - started)} elapsed\n`);
          if (latest !== "" && latest !== printed) {
            printed = latest;
            o.out.write(`  | ${latest}\n`);
          }
        }
      }
    };
    void tick();
    try {
      return await work(progress);
    } finally {
      stop.abort();
      signal?.removeEventListener("abort", relay);
      progressLine = "";
    }
  };

  const carry = async (step: GuideStep, answers: Record<string, string>): Promise<Result<GuideRunResult, GuideError>> => {
    const r = await withHeartbeat(step, (progress) => o.run({ step, answers, signal, progress }));
    if (stopped()) return abort();
    if (r.kind === "err") {
      return failure({ code: "E-GUIDE-RUN-FAILED", step, reason: r.error, message: `${step.summary}: ${r.error}` });
    }
    return ok(r.value);
  };
  const showResult = (r: GuideRunResult): void => {
    if (r.summary.trim() !== "" || (r.lines ?? []).length > 0) show((c) => renderResult(true, r.summary, r.lines ?? [], c));
  };

  /** Fetches and decodes the next step. */
  const fetch = async (): Promise<Result<GuideStep, GuideError>> => {
    const raw = await o.next(signal);
    if (stopped()) return abort();
    const d = decodeStep(raw);
    if (d.kind === "err") {
      return failure({
        code: "E-GUIDE-STEP-INVALID",
        error: d.error,
        message: `The next step is not a step of a guide: ${d.error.path}: expected ${d.error.expected}, found ${d.error.found}.`,
      });
    }
    return ok(d.value);
  };

  /** Waits for something outside: polls `next` with backoff and a visible sign of life until a step that is not a wait. */
  const waitFor = async (first: GuideStep): Promise<Result<GuideStep, GuideError>> => {
    const started = clock.now();
    let lastLine = started;
    let delay = poll.initialMs;
    let frame = 0;
    let step = first;
    while (step.kind === "wait") {
      const waiting = step;
      const label = (): string => `${waiting.summary} (${Math.floor((clock.now() - started) / 1000)}s)`;
      let left = delay;
      while (left > 0) {
        if (stopped()) return abort();
        const c = capsNow();
        const slice = c.level === "plain" ? left : Math.min(left, poll.spinnerMs);
        if (c.level === "full") setStatus(`${SPIN[frame++ % SPIN.length]} ${label()}`, "Ctrl+C stop");
        else if (c.level === "ansi") o.out.write(`\r${ESC}[K${paint("dim", `${SPIN[frame++ % SPIN.length]} ${label()}`, c)}`);
        await clock.sleep(slice, signal);
        left -= slice;
      }
      if (stopped()) return abort();
      if (capsNow().level === "ansi") o.out.write(`\r${ESC}[K`);
      const now = clock.now();
      if (poll.maxWaitMs !== undefined && now - started >= poll.maxWaitMs) {
        return failure({ code: "E-GUIDE-WAIT-TIMEOUT", step: waiting, message: `${waiting.summary}: still waiting after ${Math.floor((now - started) / 1000)}s; gave up.` });
      }
      if (capsNow().level === "plain" && now - lastLine >= poll.plainEveryMs) {
        lastLine = now;
        o.out.write(`[wait] still waiting: ${clean(waiting.summary)} (${Math.floor((now - started) / 1000)}s)\n`);
      }
      const n = await fetch();
      if (n.kind === "err") return n;
      if (n.value.kind === "wait" && n.value.id !== waiting.id) showStep(n.value);
      step = n.value;
      delay = Math.min(poll.maxMs, Math.ceil(delay * poll.factor));
    }
    return ok(step);
  };

  const loop = async (): Promise<Result<GuideFinished, GuideError>> => {
    let step: GuideStep;
    {
      const first = await fetch();
      if (first.kind === "err") return first;
      step = first.value;
    }
    for (;;) {
      if (stopped()) return abort();
      const s = step;
      const refused = secret(s);
      if (refused !== undefined) return refused;
      if (showStep(s)) shown++;
      switch (s.kind) {
        case "done": {
          done.add(s.id);
          setStatus("done", "");
          return ok({ step: s, steps: shown });
        }
        case "wait": {
          setStatus(s.summary, "Ctrl+C stop");
          const w = await waitFor(s);
          if (w.kind === "err") return w;
          done.add(s.id);
          step = w.value;
          continue;
        }
        case "run": {
          if (o.confirm !== undefined) {
            setStatus(`your turn: confirm to run ${s.verb.id}`, "Ctrl+C stop");
            const yes = await o.confirm(s);
            if (stopped()) return abort();
            if (!yes) return failure({ code: "E-GUIDE-DECLINED", step: s, message: `${s.summary}: not run, it was not confirmed.` });
          }
          setStatus(`working... running ${s.verb.id}`, "Ctrl+C stop");
          const r = await carry(s, {});
          if (r.kind === "err") return r;
          showResult(r.value);
          break;
        }
        case "question": {
          const a = await askFields(s, s.ask);
          if (a.kind === "err") return a;
          setStatus("working...", "Ctrl+C stop");
          const r = await carry(s, a.value);
          if (r.kind === "err") return r;
          showResult(r.value);
          break;
        }
        case "human": {
          if (!o.in.isTTY) {
            return failure({
              code: "E-GUIDE-NEEDS-PERSON",
              step: s,
              reason: "input-not-interactive",
              message: `This step is for a person and the input is not a terminal: ${s.summary}. Run the guide at a terminal.`,
            });
          }
          const typed = s.ask !== undefined && s.ask.length > 0;
          const a = await askFields(
            s,
            typed ? (s.ask ?? []) : [{ field: "acknowledged", prompt: "Press Enter when you have done it", hint: "" }],
            !typed,
          );
          if (a.kind === "err") return a;
          setStatus("working...", "Ctrl+C stop");
          const r = await carry(s, typed ? a.value : {});
          if (r.kind === "err") return r;
          showResult(r.value);
          break;
        }
      }
      done.add(s.id);
      const n = await fetch();
      if (n.kind === "err") return n;
      step = n.value;
    }
  };

  let ended: "done" | "stopped" = "stopped";
  try {
    const r = await loop();
    if (r.kind === "ok") ended = "done";
    return r;
  } finally {
    unsubscribe?.();
    const wasFull = inAlt;
    restore();
    // A full screen is gone when it is left: what was shown is written once more, on the screen the person keeps.
    const c = atMost({ ...o.caps, columns: size().columns, rows: size().rows }, "ansi");
    if (wasFull) {
      // Short: the last steps and what came of the last one, not the whole run (FR-015).
      const starts = entries.flatMap((e, i) => (e.role === "step" ? [i] : []));
      const from = starts.length > TRANSCRIPT_STEPS ? (starts[starts.length - TRANSCRIPT_STEPS] ?? 0) : 0;
      if (from > 0) writeLines([`(${starts.length - TRANSCRIPT_STEPS} earlier steps are not shown)`]);
      for (const e of entries.slice(from)) writeLines(e.block(c));
    }
    if (ended !== "done" && o.closing !== undefined && clean(o.closing).trim() !== "") writeLines(wrap(o.closing, c.columns, 0));
  }
}
