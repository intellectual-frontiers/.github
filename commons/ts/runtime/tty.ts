/**
 * The terminal (commons 0005-typescript-runtime FR-023): whether a stream is one, its size, raw mode, and the choice of colour and emoji the
 * three `ui` modules each made (Stolos's `core/ui.ts`, the setup's `ui.ts`, erga's console). The choice is a pure function of the
 * environment and the facts about the terminal (`lookOf`), so it is tested without one; `currentLook` reads them from the host.
 *
 * Rules: colour only where `NO_COLOR` is unset or empty, and only at a terminal unless `FORCE_COLOR` is set; a terminal whose `TERM` is
 * `dumb` counts as none; emoji where the locale is UTF-8, or on Windows in a terminal that says so (`WT_SESSION`, `TERM_PROGRAM`,
 * `ConEmuANSI=ON`), or on a Mac with `TERM_PROGRAM`.
 *
 * @example
 * ```ts
 * import { lookOf } from "./tty.ts";
 * lookOf({ env: { LANG: "en_US.UTF-8" }, terminal: true, os: "linux", columns: 120 });
 * // { tty: true, colour: true, emoji: true, columns: 120 }
 * ```
 *
 * @module
 */
import { isatty } from "node:tty";
import process from "node:process";
import { NotSupported } from "./errors.ts";
import { build, env, type Os } from "./proc.ts";

/** A standard stream of the process. */
export type StdStream = "stdin" | "stdout" | "stderr";

const FD: Readonly<Record<StdStream, number>> = { stdin: 0, stdout: 1, stderr: 2 };

/** Whether a standard stream is a terminal (`Deno.stdin.isTerminal()`). */
export function isTerminal(stream: StdStream): boolean {
  try {
    return isatty(FD[stream]);
  } catch {
    return false;
  }
}

/** The size of the terminal on standard output or, failing that, standard error; undefined where neither is one. */
export function consoleSize(): { readonly columns: number; readonly rows: number } | undefined {
  for (const s of [process.stdout, process.stderr]) {
    if (s.isTTY === true && typeof s.columns === "number" && typeof s.rows === "number") return { columns: s.columns, rows: s.rows };
  }
  return undefined;
}

/** Raw mode on standard input turned on (every key as it is pressed, no echo) or off; `NotSupported` where standard input is not a terminal. */
export function setRaw(on: boolean): void {
  const stdin = process.stdin;
  if (stdin.isTTY !== true || typeof stdin.setRawMode !== "function") throw new NotSupported("standard input is not a terminal", "ENOTTY");
  stdin.setRawMode(on);
}

/** How output should look. */
export type Look = { readonly tty: boolean; readonly colour: boolean; readonly emoji: boolean; readonly columns: number };

/** What the choice of a look depends on. */
export type LookFacts = {
  /** The environment's variables. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Whether the stream written to is a terminal. */
  readonly terminal: boolean;
  /** The operating system. */
  readonly os: Os;
  /** The terminal's width, where known. */
  readonly columns?: number;
};

const set = (v: string | undefined): boolean => v !== undefined && v !== "";

/** The look the facts call for: see the module's rules. The width is the terminal's where it is at least 40, else 80. */
export function lookOf(facts: LookFacts): Look {
  const e = facts.env;
  const tty = facts.terminal && (e["TERM"] ?? "") !== "dumb";
  const colour = !set(e["NO_COLOR"]) && (tty || set(e["FORCE_COLOR"]));
  const utf8 = /utf-?8/i.test(e["LC_ALL"] || e["LC_CTYPE"] || e["LANG"] || "");
  const emoji =
    utf8 ||
    (facts.os === "windows" && (set(e["WT_SESSION"]) || set(e["TERM_PROGRAM"]) || e["ConEmuANSI"] === "ON")) ||
    (facts.os === "darwin" && set(e["TERM_PROGRAM"]));
  const columns = tty && facts.columns !== undefined && facts.columns >= 40 ? facts.columns : 80;
  return { tty, colour, emoji, columns };
}

/** The look for writing to a standard stream (standard error by default) of this process. */
export function currentLook(stream: StdStream = "stderr"): Look {
  const size = consoleSize();
  return lookOf({
    env: env.toObject(),
    terminal: isTerminal(stream),
    os: build.os,
    ...(size === undefined ? {} : { columns: size.columns }),
  });
}
