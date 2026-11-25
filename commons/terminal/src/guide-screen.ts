// Spec: 0002-guide FR-008
/**
 * The full screen of the guide (commons terminal 0002-guide FR-008): a stable layout, drawn whole each time, from a state and a size, with no
 * line feed so that the screen never scrolls.
 *
 * ```text
 *  Guide                                  step 2 of 4      <- row 0: the title and the count
 *  [x] Check the host   | [ask] Which folder?               <- the left column: every step of the plan (done, current, pending);
 *  [>] Choose a folder  |   you are asked for:                  the right pane: the current step and what came of it
 *  [ ] Install          |                                  
 *  [ ] Finish           |   > _                            <- the cursor sits where the person types
 *  waiting for you...                                      <- the status line
 *  Enter send   Ctrl+C stop                                <- the keys that do something
 * ```
 *
 * `drawScreen` is pure: it gives exactly `rows` lines of exactly `columns` columns (the emulator of `vt` shows what a person would see),
 * `frameOf` makes the bytes that put them on a terminal (cursor addressing by row, never a line feed), and `ENTER` and `LEAVE` are the
 * sequences that open and close the alternate screen.
 *
 * @module
 */
import type { GuideCaps } from "./guide-caps.ts";
import { paint, type Role } from "./palette.ts";
import { cutToWidth, displayWidth, RESET } from "./width.ts";

const ESC = String.fromCharCode(0x1b);

/** Opens the alternate screen, hides the cursor, turns the automatic wrap of the last column off and clears. */
export const ENTER = `${ESC}[?1049h${ESC}[?25l${ESC}[?7l${ESC}[2J`;

/** Leaves the alternate screen as it was found: styles reset, wrap on, cursor shown. */
export const LEAVE = `${RESET}${ESC}[?7h${ESC}[?25h${ESC}[?1049l`;

/** One step of the caller's plan: the id of a step and the words the left column shows. */
export type PlanItem = { readonly id: string; readonly title: string };

/** What is drawn. */
export type ScreenState = {
  /** The title of the guide. */
  readonly title: string;
  /** Every step of the plan, in order; may be empty (no left column). */
  readonly plan: readonly PlanItem[];
  /** The ids of the steps that are done. */
  readonly done: ReadonlySet<string>;
  /** The id of the current step. */
  readonly current: string | undefined;
  /** The lines of the right pane, already wrapped to the pane's width (`layoutOf`); the oldest are dropped where they do not fit. */
  readonly pane: readonly string[];
  /** The status line: what is going on now. */
  readonly status: string;
  /** The keys that do something now. */
  readonly keys: string;
  /** Whether the person is being asked to type (the cursor goes to the end of the last line of the pane). */
  readonly typing: boolean;
};

/** Where things go in a screen of a size. */
export type Layout = {
  /** The width of the left column; 0 where there is no plan. */
  readonly left: number;
  /** The first column of the pane. */
  readonly paneAt: number;
  /** The width of the pane. */
  readonly pane: number;
  /** The number of rows of the body, between the title and the status. */
  readonly body: number;
};

/** The layout for a screen of `columns` by `rows` and a plan whose titles are given: the left column is a third of the width at most. */
export function layoutOf(columns: number, rows: number, plan: readonly PlanItem[]): Layout {
  const longest = plan.reduce((w, p) => Math.max(w, displayWidth(p.title)), 0);
  const left = plan.length === 0 ? 0 : Math.max(16, Math.min(longest + 5, Math.floor(columns / 3)));
  const paneAt = left === 0 ? 0 : left + 3;
  return { left, paneAt, pane: Math.max(1, columns - paneAt), body: Math.max(1, rows - 3) };
}

const pad = (text: string, width: number): string => {
  const cut = displayWidth(text) > width ? cutToWidth(text, width) : text;
  return cut + " ".repeat(Math.max(0, width - displayWidth(cut)));
};

/** The marks of the left column: ASCII, so that a column is a column in every terminal. */
export const PLAN_MARKS = { done: "[x]", current: "[>]", pending: "[ ]" } as const;

/** The result of drawing: every row, and where the cursor goes (where the person types) or undefined. */
export type Drawn = { readonly lines: readonly string[]; readonly cursor: { readonly row: number; readonly col: number } | undefined };

/**
 * The screen as `rows` lines of exactly `columns` columns. Colour only where `caps.colour`; the content is the same without it. The pane shows
 * the last lines that fit.
 */
export function drawScreen(state: ScreenState, size: { readonly columns: number; readonly rows: number }, caps: Pick<GuideCaps, "colour">): Drawn {
  const { columns, rows } = size;
  const lay = layoutOf(columns, rows, state.plan);
  const role = (r: Role, t: string): string => paint(r, t, caps);
  const lines: string[] = [];
  const doneCount = state.plan.filter((p) => state.done.has(p.id)).length;
  const count = state.plan.length === 0 ? "" : `step ${Math.min(state.plan.length, doneCount + (state.current !== undefined && !state.done.has(state.current) ? 1 : 0))} of ${state.plan.length}`;
  const gap = Math.max(1, columns - displayWidth(state.title) - displayWidth(count) - 2);
  lines.push(role("accent", pad(` ${state.title}${" ".repeat(gap)}${count}`, columns)));
  const shown = state.pane.slice(Math.max(0, state.pane.length - lay.body));
  let cursor: Drawn["cursor"];
  for (let i = 0; i < lay.body; i++) {
    const item = state.plan[i];
    let l = "";
    if (lay.left > 0) {
      if (item === undefined) l = pad("", lay.left) + " | ";
      else {
        const isDone = state.done.has(item.id);
        const isCurrent = item.id === state.current && !isDone;
        const mark = isDone ? PLAN_MARKS.done : isCurrent ? PLAN_MARKS.current : PLAN_MARKS.pending;
        const text = pad(`${mark} ${item.title}`, lay.left);
        l = role(isDone ? "success" : isCurrent ? "accent" : "dim", text) + " | ";
      }
    }
    const paneLine = shown[i] ?? "";
    l += pad(paneLine, lay.pane);
    // Padded to the width: the colour sequences of the left column take no column, so the width is exact.
    lines.push(displayWidth(l) === columns ? l : pad(l, columns));
    if (state.typing && i === shown.length - 1) {
      cursor = { row: 1 + i, col: Math.min(columns - 1, lay.paneAt + displayWidth(paneLine)) };
    }
  }
  lines.push(role("hint", pad(` ${state.status}`, columns)));
  lines.push(role("dim", pad(` ${state.keys}`, columns)));
  return { lines: lines.slice(0, rows), cursor };
}

/**
 * The bytes that put a drawn screen on a terminal: each row at its place by cursor addressing, the colour reset at the end of each, and the
 * cursor shown where the person types and hidden elsewhere. No line feed: the screen never scrolls.
 */
export function frameOf(drawn: Drawn): string {
  let out = "";
  for (const [i, line] of drawn.lines.entries()) out += `${ESC}[${i + 1};1H${line}${RESET}`;
  out += drawn.cursor === undefined ? `${ESC}[?25l` : `${ESC}[${drawn.cursor.row + 1};${drawn.cursor.col + 1}H${ESC}[?25h`;
  return out;
}
