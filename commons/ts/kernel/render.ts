/**
 * The console as a rendering of OpenTelemetry signals (commons 0006-signals FR-021 to FR-024): a pure reducer from a state, an input (a
 * span that started, recorded an event or ended, a log record, an export that failed, a tick of the clock, the end of the run) and the
 * time, to the next state and the frames to write. The runtime's `console.ts` feeds it and writes what it returns; a test feeds it and
 * reads the frames through `vt.ts`'s screen.
 *
 * Five modes (FR-021):
 * - `attended`: a live region of the spans in progress, nested by parent, each with its elapsed time and its progress (FR-023), redrawn in
 *   place (cursor up, erase in display); a line that is final (a span that ended, a log record) is written above the region and stays.
 *   Every line is cut to the terminal's width by display width, so nothing wraps.
 * - `plain`: the final lines only, appended, with no escape sequence at all (no colour, no cursor movement), for a log or a pipe; a line
 *   is not cut.
 * - `quiet`: the final lines that are warnings, errors (a span that failed, a log record of the role `warning` or `error`, or of severity
 *   WARN or more) or results (the role `result`), appended; coloured where the look allows it.
 * - `silent`: nothing.
 * - `json`: one OTLP JSON document per line, each an `ExportLogsServiceRequest` (`otlp.ts`'s `encodeLogs`) holding one log record: a log
 *   record as it is; a span that ended as a log record whose `eventName` is the span's name, whose time is its end, whose severity is
 *   ERROR where it failed and INFO otherwise, whose body is its line as `plain` writes it (without indentation, with ASCII marks), with
 *   its attributes and its trace and span ids; the export warning as a WARN record named `ifc.console.export`.
 *
 * Only a signal whose kind has a presentation role (`signals.ts`'s `roleOf`) other than `none` is shown; an undeclared kind is not. A span
 * that is not shown still nests: its children are shown at its depth. How a span ended: ⏭️ where it recorded an event named `skipped`,
 * ⏹️ where it recorded one named `cancelled` (and for a span still open at the end of the run), ❌ where its status is an error, ✅
 * otherwise; marks and colours come from `palette.ts`, with its ASCII fallbacks and colour only where the look allows (FR-022).
 *
 * An export that failed is said once, dimmed, at the end of the run, and nowhere else (FR-024). Text from a signal is cleaned of control
 * characters, so a signal never moves the cursor. Time comes only from the `now` given (nanoseconds since the Unix epoch, as signals' times).
 *
 * @example
 * ```ts
 * import { initial, render } from "./render.ts";
 * import { defineSignals } from "./signals.ts";
 * const registry = defineSignals({ "build.step": { signal: "span", role: "step", attributes: { target: "string" } } });
 * let state = initial({ mode: "plain", look: { colour: false, emoji: true, columns: 80 }, registry });
 * // ...for each signal: ({ state, frames } = render(state, { kind: "span-end", span, source }, now)); write(frames);
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import {
  type AnyValue,
  type Attributes,
  type AttributeValue,
  type LogRecord,
  SEVERITY,
  type SeverityNumber,
  severityText,
  type SpanData,
  type SpanEvent,
} from "./otel.ts";
import { encodeLogs } from "./otlp.ts";
import { type Capabilities, label, type MarkKind, mark, paint } from "./palette.ts";
import { type Declarations, type Registry, type Role, roleOf, type Source, type SpanStart } from "./signals.ts";
import { cutToWidth } from "./width.ts";

/** How the console writes: see the module. */
export type Mode = "attended" | "plain" | "quiet" | "silent" | "json";

/** Every mode, in a fixed order. */
export const MODES: readonly Mode[] = ["attended", "plain", "quiet", "silent", "json"];

/** A mode by its name; undefined for another text. */
export function parseMode(text: string): Mode | undefined {
  return MODES.find((m) => m === text.trim().toLowerCase());
}

/** The mode to use: the one asked for where it names one, else `attended` at a terminal and `plain` elsewhere (FR-026). */
export function chooseMode(facts: { readonly requested?: string | undefined; readonly tty: boolean }): Mode {
  const asked = facts.requested === undefined ? undefined : parseMode(facts.requested);
  return asked ?? (facts.tty ? "attended" : "plain");
}

/** What the renderer is given: the processor's signals, a failed export, a tick of the clock (to redraw elapsed times), the end of the run. */
export type Input =
  | { readonly kind: "span-start"; readonly span: SpanStart; readonly source: Source }
  | { readonly kind: "span-event"; readonly span: SpanStart; readonly event: SpanEvent; readonly source: Source }
  | { readonly kind: "span-end"; readonly span: SpanData; readonly source: Source }
  | { readonly kind: "log"; readonly record: LogRecord; readonly source: Source }
  | { readonly kind: "export-warning"; readonly message: string }
  | { readonly kind: "tick" }
  | { readonly kind: "finish" };

/** What a renderer is made with. */
export type RenderConfig = {
  readonly mode: Mode;
  /** What the terminal shows: colour, emoji, its width (a `Look` of `runtime/tty.ts` is one). */
  readonly look: Capabilities;
  /** The registry that gives each kind its presentation role. */
  readonly registry: Registry<Declarations>;
  /** A signal's text from its kind and attributes; `defaultText` where not given (a log record's string body comes first). */
  readonly text?: (name: string, attributes: Attributes) => string;
  /** The most lines the live region takes (10 by default, at least 2); the spans beyond are counted on its last line. */
  readonly maxLive?: number;
};

type Known = { readonly depth: number; readonly shown: boolean; readonly anchor: string | undefined };

type Progress = { readonly done: number; readonly total: number | undefined };

type Live = {
  readonly key: string;
  readonly anchor: string | undefined;
  readonly depth: number;
  readonly text: string;
  readonly start: bigint;
  readonly progress: Progress | undefined;
};

/** The renderer's state: what is open, what the screen shows of the live region, the warnings kept for the end. */
export type State = {
  readonly config: RenderConfig;
  /** Every span started and not ended, shown or not, by trace and span id. */
  readonly spans: ReadonlyMap<string, Known>;
  /** The shown spans in progress, in the order they started. */
  readonly live: readonly Live[];
  /** The lines of the live region on the screen (attended). */
  readonly drawn: number;
  /** The export warnings, each once, said at the end. */
  readonly warnings: readonly string[];
  /** The last source seen, for the records `json` writes of its own. */
  readonly source: Source | undefined;
  /** Whether the run has finished; nothing is written after. */
  readonly finished: boolean;
};

/** A reducer's step: the next state and the frames to write (empty for none). */
export type Step = { readonly state: State; readonly frames: string };

/** The state a renderer starts in. */
export function initial(config: RenderConfig): State {
  return { config, spans: new Map(), live: [], drawn: 0, warnings: [], source: undefined, finished: false };
}

const ESC = String.fromCharCode(0x1b);
const CONTROL = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}-${String.fromCharCode(0x9f)}]`,
  "g",
);
const NS_PER_MS = 1_000_000n;

/** A text with every control character but the line feed replaced (a tab by a space, the rest by `?`), so it never moves the cursor. */
export function clean(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(CONTROL, (c) => (c === "\t" ? " " : "?")))
    .join("\n");
}

function valueText(v: AttributeValue): string {
  if (v instanceof Uint8Array) return `${v.length} bytes`;
  if (Array.isArray(v)) return (v as readonly (string | number | bigint | boolean)[]).map(String).join(",");
  return String(v);
}

/**
 * The text of a signal by default: a span's is its kind and its attributes' values, in their order, separated by spaces (`build site`); a
 * log record's is its attributes' values alone, or its kind where it has none (a log record with a string body shows the body).
 */
export function defaultText(name: string, attributes: Attributes, signal: "span" | "log" = "span"): string {
  const values = Object.values(attributes).map(valueText);
  return signal === "log" && values.length > 0 ? values.join(" ") : [name, ...values].join(" ");
}

/** A duration in nanoseconds as a person reads it: `420ms`, `1.2s`, `3m04s`, `2h05m` (cut, never rounded up; a negative one is `0ms`). */
export function duration(ns: bigint): string {
  const ms = ns < 0n ? 0 : Number(ns / NS_PER_MS);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  const s = Math.floor(ms / 1000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  if (s < 3600) return `${Math.floor(s / 60)}m${pad(s % 60)}s`;
  return `${Math.floor(s / 3600)}h${pad(Math.floor(s / 60) % 60)}m`;
}

/** How far a span has come: `done/total` and the percentage where there is a positive total, else `done`. */
export function progressText(done: number, total?: number): string {
  if (total === undefined || !(total > 0)) return `${done}`;
  const pct = Math.max(0, Math.min(100, Math.floor((done / total) * 100)));
  return `${done}/${total} ${pct}%`;
}

const keyOf = (traceId: string, spanId: string): string => `${traceId}:${spanId}`;

const shownRole = (role: Role | undefined): role is Exclude<Role, "none"> => role !== undefined && role !== "none";

const numberOf = (v: AttributeValue | undefined): number | undefined =>
  typeof v === "number" ? v : typeof v === "bigint" ? Number(v) : undefined;

/** How a span ended, as a mark: a `skipped` or `cancelled` event first, then its status. */
export function outcomeOf(span: SpanData): MarkKind {
  if (span.events.some((e) => e.name === "skipped")) return "skipped";
  if (span.events.some((e) => e.name === "cancelled")) return "cancelled";
  return span.status.kind === "error" ? "failed" : "done";
}

/** A line to write, and whether `quiet` writes it. */
type Line = { readonly text: string; readonly quiet: boolean };

/** What colour and emoji a mode may use: `plain` none of the colour, whatever the look. */
function capsOf(config: RenderConfig): { readonly colour: boolean; readonly emoji: boolean } {
  const colour = (config.mode === "attended" || config.mode === "quiet") && config.look.colour;
  return { colour, emoji: config.look.emoji };
}

const indent = (depth: number): string => "  ".repeat(depth);

/** Lines of a text that may hold line feeds: the first after `head`, the rest under it, two columns further in. */
function block(depth: number, head: (first: string) => string, text: string): readonly string[] {
  const [first = "", ...rest] = clean(text).split("\n");
  return [indent(depth) + head(first), ...rest.map((l) => indent(depth + 1) + l)];
}

function endedLines(
  config: RenderConfig,
  depth: number,
  text: string,
  kind: MarkKind,
  message: string | undefined,
  took: bigint,
): string[] {
  const caps = capsOf(config);
  const after =
    (message === undefined || message === "" ? "" : `: ${paint("failure", clean(message).split("\n")[0] ?? "", caps)}`) +
    ` ${paint("dim", duration(took), caps)}`;
  const lines = [...block(depth, (first) => label(kind, first, caps), text)];
  const last = lines.length - 1;
  lines[last] = `${lines[last] ?? ""}${after}`;
  return lines;
}

function logLines(
  config: RenderConfig,
  depth: number,
  role: Exclude<Role, "none">,
  severity: SeverityNumber,
  text: string,
): readonly string[] {
  const caps = capsOf(config);
  const marked =
    (kind: MarkKind) =>
    (first: string): string =>
      label(kind, first, caps);
  switch (role) {
    case "hint":
      return block(depth, marked("hint"), text);
    case "warning":
      return block(depth, marked("warning"), text);
    case "error":
      return block(depth, marked("failed"), text);
    case "detail":
      return block(depth, (first) => paint("dim", first, caps), text);
    case "step":
    case "progress":
    case "result":
      return severity >= SEVERITY.ERROR
        ? block(depth, marked("failed"), text)
        : severity >= SEVERITY.WARN
          ? block(depth, marked("warning"), text)
          : block(depth, (first) => first, text);
    default:
      return absurd(role);
  }
}

function bodyText(body: AnyValue | undefined): string | undefined {
  return typeof body === "string" ? body : undefined;
}

function textOf(config: RenderConfig, name: string, attributes: Attributes, signal: "span" | "log" = "span"): string {
  return config.text === undefined ? defaultText(name, attributes, signal) : config.text(name, attributes);
}

/** The live region's lines, nested by parent: each span under the nearest shown ancestor still in progress. */
function regionLines(state: State, now: bigint): readonly string[] {
  const { config, live } = state;
  const caps = capsOf(config);
  const liveKeys = new Set(live.map((l) => l.key));
  const ordered: Live[] = [];
  const visit = (l: Live): void => {
    ordered.push(l);
    for (const child of live) if (child.anchor === l.key) visit(child);
  };
  for (const l of live) if (l.anchor === undefined || !liveKeys.has(l.anchor)) visit(l);
  const lineOf = (l: Live): string => {
    const first = clean(l.text).split("\n")[0] ?? "";
    const progress = l.progress === undefined ? "" : ` ${paint("hint", progressText(l.progress.done, l.progress.total), caps)}`;
    return `${indent(l.depth)}${paint("accent", `${first}…`, caps)} ${paint("dim", duration(now - l.start), caps)}${progress}`;
  };
  const max = Math.max(2, config.maxLive ?? 10);
  if (ordered.length <= max) return ordered.map(lineOf);
  const kept = ordered.slice(0, max - 1).map(lineOf);
  return [...kept, paint("dim", `… ${ordered.length - kept.length} more`, caps)];
}

/** The frames that erase the live region, write the final lines above it, and draw it again (attended), with the next state. */
function redraw(state: State, permanent: readonly string[], now: bigint, region = true): Step {
  const cols = Math.max(1, state.config.look.columns);
  const erase = state.drawn > 0 ? `\r${ESC}[${state.drawn}A${ESC}[J` : "";
  const lines = region ? regionLines(state, now) : [];
  const out = [...permanent, ...lines].map((l) => `${cutToWidth(l, cols)}\n`).join("");
  return { state: { ...state, drawn: lines.length }, frames: erase + out };
}

/** The frames of final lines in the state's mode (not `json`). */
function emit(state: State, lines: readonly Line[], now: bigint): Step {
  const mode = state.config.mode;
  switch (mode) {
    case "attended":
      return lines.length === 0
        ? { state, frames: "" }
        : redraw(
            state,
            lines.map((l) => l.text),
            now,
          );
    case "plain":
      return { state, frames: lines.map((l) => `${l.text}\n`).join("") };
    case "quiet":
      return { state, frames: lines.flatMap((l) => (l.quiet ? [`${l.text}\n`] : [])).join("") };
    case "silent":
    case "json":
      return { state, frames: "" };
    default:
      return absurd(mode);
  }
}

function jsonLine(source: Source | undefined, record: LogRecord): string {
  const s = source ?? { resource: { attributes: {} }, scope: { name: "ifc.console" } };
  return `${JSON.stringify(encodeLogs([{ resource: s.resource, scope: s.scope, records: [record] }]))}\n`;
}

const isLoud = (role: Role, severity: SeverityNumber): boolean =>
  role === "result" || role === "warning" || role === "error" || severity >= SEVERITY.WARN;

/** The line `plain` writes for a span still open at the end of the run: cancelled. */
function leftoverLines(state: State, now: bigint): readonly Line[] {
  return state.live
    .flatMap((l) => endedLines(state.config, l.depth, l.text, "cancelled", undefined, now - l.start))
    .map((text) => ({ text, quiet: false }));
}

function warningLines(state: State): readonly Line[] {
  const caps = capsOf(state.config);
  return state.warnings.map((w) => ({
    text: paint("dim", `${mark("warning", caps)} ${clean(w).split("\n").join(" ")}`, caps),
    quiet: true,
  }));
}

/**
 * The next state and the frames to write for an input at the time `now` (nanoseconds since the Unix epoch). Pure: the same state, input
 * and time give the same step. After `finish`, every input gives no frame.
 */
export function render(state: State, input: Input, now: bigint): Step {
  if (state.finished) return { state, frames: "" };
  const { config } = state;
  switch (input.kind) {
    case "span-start": {
      const s = input.span;
      const key = keyOf(s.context.traceId, s.context.spanId);
      const pk = s.parentSpanId === undefined ? undefined : keyOf(s.context.traceId, s.parentSpanId);
      const parent = pk === undefined ? undefined : state.spans.get(pk);
      const shown = shownRole(roleOf(config.registry, s.name));
      const depth = parent === undefined ? 0 : parent.shown ? parent.depth + 1 : parent.depth;
      const anchor = parent === undefined ? undefined : parent.shown ? pk : parent.anchor;
      const spans = new Map(state.spans).set(key, { depth, shown, anchor });
      const live = shown
        ? [...state.live, { key, anchor, depth, text: textOf(config, s.name, s.attributes), start: s.startTime, progress: undefined }]
        : state.live;
      const next: State = { ...state, spans, live, source: input.source };
      return shown && config.mode === "attended" ? redraw(next, [], now) : { state: next, frames: "" };
    }
    case "span-event": {
      if (input.event.name !== "progress") return { state, frames: "" };
      const key = keyOf(input.span.context.traceId, input.span.context.spanId);
      const done = numberOf(input.event.attributes["progress.done"]);
      if (done === undefined || !state.live.some((l) => l.key === key)) return { state, frames: "" };
      const progress: Progress = { done, total: numberOf(input.event.attributes["progress.total"]) };
      const next: State = { ...state, live: state.live.map((l) => (l.key === key ? { ...l, progress } : l)) };
      return config.mode === "attended" ? redraw(next, [], now) : { state: next, frames: "" };
    }
    case "span-end": {
      const s = input.span;
      const key = keyOf(s.context.traceId, s.context.spanId);
      const known = state.spans.get(key);
      const spans = new Map(state.spans);
      spans.delete(key);
      const next: State = { ...state, spans, live: state.live.filter((l) => l.key !== key), source: input.source };
      const role = roleOf(config.registry, s.name);
      if (!shownRole(role)) return { state: next, frames: "" };
      const kind = outcomeOf(s);
      const message = s.status.kind === "error" ? s.status.message : undefined;
      const text = textOf(config, s.name, s.attributes);
      const took = s.endTime - s.startTime;
      if (config.mode === "json") {
        const body = endedLines({ ...config, look: { ...config.look, colour: false, emoji: false } }, 0, text, kind, message, took).join(
          "\n",
        );
        const severity = kind === "failed" ? SEVERITY.ERROR : SEVERITY.INFO;
        const record: LogRecord = {
          time: s.endTime,
          observedTime: s.endTime,
          severityNumber: severity,
          severityText: severityText(severity),
          body,
          attributes: s.attributes,
          droppedAttributesCount: 0,
          eventName: s.name,
          traceId: s.context.traceId,
          spanId: s.context.spanId,
          traceFlags: s.context.traceFlags,
        };
        return { state: next, frames: jsonLine(input.source, record) };
      }
      const quiet = kind === "failed" || role === "result" || role === "warning" || role === "error";
      const lines = endedLines(config, known?.depth ?? 0, text, kind, message, took).map((t) => ({ text: t, quiet }));
      return emit(next, lines, now);
    }
    case "log": {
      const r = input.record;
      const next: State = { ...state, source: input.source };
      const role = r.eventName === undefined ? undefined : roleOf(config.registry, r.eventName);
      if (!shownRole(role)) return { state: next, frames: "" };
      if (config.mode === "json") return { state: next, frames: jsonLine(input.source, r) };
      const known = r.traceId === undefined || r.spanId === undefined ? undefined : state.spans.get(keyOf(r.traceId, r.spanId));
      const depth = known === undefined ? 0 : known.shown ? known.depth + 1 : known.depth;
      const text = bodyText(r.body) ?? textOf(config, r.eventName ?? r.severityText, r.attributes, "log");
      const quiet = isLoud(role, r.severityNumber);
      return emit(
        next,
        logLines(config, depth, role, r.severityNumber, text).map((t) => ({ text: t, quiet })),
        now,
      );
    }
    case "export-warning":
      return {
        state: state.warnings.includes(input.message) ? state : { ...state, warnings: [...state.warnings, input.message] },
        frames: "",
      };
    case "tick":
      return config.mode === "attended" && state.live.length > 0 ? redraw(state, [], now) : { state, frames: "" };
    case "finish": {
      const done: State = { ...state, live: [], spans: new Map(), finished: true };
      switch (config.mode) {
        case "attended":
          return redraw(
            done,
            [...leftoverLines(state, now), ...warningLines(state)].map((l) => l.text),
            now,
            false,
          );
        case "plain":
        case "quiet":
          return emit(done, [...leftoverLines(state, now), ...warningLines(state)], now);
        case "silent":
          return { state: done, frames: "" };
        case "json": {
          const frames = state.warnings
            .map((w) =>
              jsonLine(state.source, {
                time: now,
                observedTime: now,
                severityNumber: SEVERITY.WARN,
                severityText: severityText(SEVERITY.WARN),
                body: w,
                attributes: {},
                droppedAttributesCount: 0,
                eventName: "ifc.console.export",
              }),
            )
            .join("");
          return { state: done, frames };
        }
        default:
          return absurd(config.mode);
      }
    }
    default:
      return absurd(input);
  }
}
