// Spec: 0002-guide FR-002
/**
 * What the terminal written to can do, decided in one place (commons terminal 0002-guide FR-002): `capabilitiesOf(env, stream)` gives one of
 * three levels, and the rest of the guide only obeys it.
 *
 * - `plain`: no colour, no cursor movement, no emoji. A stream that is not a TTY, `NO_COLOR` set and not empty, `TERM=dumb`, `CI` set.
 * - `ansi`: colour and simple symbols, a carriage return and the erase of a line for a spinner.
 * - `full`: the alternate screen and cursor control, on a TTY of at least 60 columns by 12 rows.
 *
 * It looks at the stream's `isTTY` and never at the name of the operating system: Windows Terminal and PowerShell 7 give a TTY that
 * understands ANSI sequences, and so they get what any terminal gets. A caller may force a lower level (a flag `--plain`) and never a
 * higher one.
 *
 * @example
 * ```ts
 * import { capabilitiesOf } from "./guide-caps.ts";
 * capabilitiesOf({ TERM: "xterm-256color" }, { isTTY: true, columns: 100, rows: 30 }).level; // "full"
 * capabilitiesOf({ NO_COLOR: "1" }, { isTTY: true, columns: 100, rows: 30 }).level; // "plain"
 * capabilitiesOf({}, { isTTY: false }).level; // "plain"
 * ```
 *
 * @module
 */

/** The three levels, from the least to the most. */
export type GuideLevel = "plain" | "ansi" | "full";

/** Every level, from the least to the most. */
export const GUIDE_LEVELS: readonly GuideLevel[] = ["plain", "ansi", "full"];

/** The least size, in columns, of a terminal that gets the full screen. */
export const FULL_MIN_COLUMNS = 60;

/** The least size, in rows, of a terminal that gets the full screen. */
export const FULL_MIN_ROWS = 12;

/** The columns of a plain output where the stream does not say. */
export const DEFAULT_COLUMNS = 80;

/** What the guide may do on a stream; `colour`, `emoji` and `columns` are the fields of the palette's `Capabilities`, so it is one. */
export type GuideCaps = {
  readonly level: GuideLevel;
  readonly colour: boolean;
  readonly emoji: boolean;
  readonly columns: number;
  readonly rows: number;
};

/** The environment as a record: `process.env` is one. */
export type GuideEnv = Readonly<Record<string, string | undefined>>;

/** The stream written to: `process.stdout` is one. */
export type GuideStream = { readonly isTTY?: boolean | undefined; readonly columns?: number | undefined; readonly rows?: number | undefined };

const set = (v: string | undefined): boolean => v !== undefined && v !== "";

/** Whether `CI` says this is a CI run: set, and not empty, `0` or `false`. */
function inCi(env: GuideEnv): boolean {
  const v = env["CI"];
  return set(v) && v !== "0" && v?.toLowerCase() !== "false";
}

/** Whether the terminal is known to show emoji: Windows Terminal, a named terminal program, or a UTF-8 locale on a terminal that is not the bare Linux console. */
function showsEmoji(env: GuideEnv): boolean {
  if (env["TERM"] === "linux") return false;
  if (set(env["WT_SESSION"]) || set(env["TERM_PROGRAM"])) return true;
  return /utf-?8/i.test(`${env["LC_ALL"] ?? ""}${env["LC_CTYPE"] ?? ""}${env["LANG"] ?? ""}`);
}

const dimension = (v: number | undefined, fallback: number): number => (v !== undefined && Number.isFinite(v) && v >= 1 ? Math.floor(v) : fallback);

/** The level of a terminal: why `plain`, or `ansi`, or `full`, from the environment and the stream only. */
export function levelOf(env: GuideEnv, stream: GuideStream): GuideLevel {
  if (stream.isTTY !== true) return "plain";
  if (set(env["NO_COLOR"]) || env["TERM"] === "dumb" || inCi(env)) return "plain";
  const columns = dimension(stream.columns, DEFAULT_COLUMNS);
  const rows = dimension(stream.rows, 24);
  return columns >= FULL_MIN_COLUMNS && rows >= FULL_MIN_ROWS ? "full" : "ansi";
}

/**
 * The capabilities of a stream in an environment (FR-002). `force` lowers the level and never raises it: asking for `full` of a pipe gives
 * `plain`. Colour is on at `ansi` and `full`; emoji at `full` where the terminal is known to show them.
 */
export function capabilitiesOf(env: GuideEnv, stream: GuideStream, force?: GuideLevel): GuideCaps {
  const decided = levelOf(env, stream);
  const level = force !== undefined && GUIDE_LEVELS.indexOf(force) < GUIDE_LEVELS.indexOf(decided) ? force : decided;
  return {
    level,
    colour: level !== "plain",
    emoji: level === "full" && showsEmoji(env),
    columns: dimension(stream.columns, DEFAULT_COLUMNS),
    rows: dimension(stream.rows, 24),
  };
}

/** The same capabilities at a lower level; a level that is not lower leaves them as they are. */
export function atMost(caps: GuideCaps, level: GuideLevel): GuideCaps {
  if (GUIDE_LEVELS.indexOf(level) >= GUIDE_LEVELS.indexOf(caps.level)) return caps;
  return { ...caps, level, colour: level !== "plain", emoji: level === "full" && caps.emoji };
}
