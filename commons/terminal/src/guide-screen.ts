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
export type PlanItem = {
  readonly id: string;
  readonly title: string;
  /** A shorter title for a narrow left column (FR-017); where the title does not fit the column and this does, this is shown. */
  readonly short?: string;
};

/** What is drawn. */
export type ScreenState = {
  /** The title of the guide. */
  readonly title: string;
  /** Every step of the plan, in order; may be empty (no left column). */
  readonly plan: readonly PlanItem[];
  /** The ids of the steps that are done. */
  readonly done: ReadonlySet<string>;
  /** The ids of the steps that were skipped, not done (drawn `[-]`, FR-011); none where omitted. */
  readonly skipped?: ReadonlySet<string> | undefined;
  /** The ids of the steps that failed (drawn `[!]`); none where omitted. */
  readonly failed?: ReadonlySet<string> | undefined;
  /**
   * The 1-based position of the current step in `plan` for the count of the title (FR-011); where omitted, it is the number of steps done
   * plus one for the current one.
   */
  readonly position?: number | undefined;
  /** How many of the first lines of `pane` stay at the top whatever the height (the step's summary, FR-013); 0 where omitted. */
  readonly pinned?: number | undefined;
  /** How many of the last lines of `pane` stay at the bottom (the prompt and what the person typed); 0 where omitted. */
  readonly keep?: number | undefined;
  /** The indexes into `pane` of the lines that hold what the person must type or run: always shown, wherever they are (FR-016). */
  readonly protect?: readonly number[] | undefined;
  /** The last line of output of the work in progress, dimmed in a row under the keys (FR-018); none where omitted. */
  readonly progress?: string | undefined;
  /** The id of the current step. */
  readonly current: string | undefined;
  /** The lines of the right pane, already wrapped to the pane's width (`layoutOf`); where they do not fit, see `fitPane`. */
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
export function layoutOf(columns: number, rows: number, plan: readonly PlanItem[], extra = 0): Layout {
  const longest = plan.reduce((w, p) => Math.max(w, displayWidth(p.title)), 0);
  const left = plan.length === 0 ? 0 : Math.max(16, Math.min(longest + 5, Math.floor(columns / 3)));
  const paneAt = left === 0 ? 0 : left + 3;
  return { left, paneAt, pane: Math.max(1, columns - paneAt), body: Math.max(1, rows - 3 - extra) };
}

const pad = (text: string, width: number): string => {
  const cut = displayWidth(text) > width ? cutToWidth(text, width) : text;
  return cut + " ".repeat(Math.max(0, width - displayWidth(cut)));
};

/** The marks of the left column: ASCII, so that a column is a column in every terminal. `skipped` is a step passed over, not done. */
export const PLAN_MARKS = { done: "[x]", current: "[>]", pending: "[ ]", failed: "[!]", skipped: "[-]" } as const;

/** The sign that a label was shortened: one column of ASCII. */
export const ELLIPSIS = "~";

/**
 * A label that fits `width` columns (FR-017): as it is where it fits, else the caller's `short` where that fits, else the words that fit
 * (a word boundary) and `~`; a first word wider than the width is cut between graphemes and ends in `~`.
 */
export function labelOf(item: PlanItem, width: number): string {
  if (displayWidth(item.title) <= width) return item.title;
  const base = item.short !== undefined && item.short.trim() !== "" ? item.short : item.title;
  if (displayWidth(base) <= width) return base;
  const words = base.split(" ").filter((w) => w !== "");
  for (let n = words.length - 1; n >= 1; n--) {
    const t = `${words.slice(0, n).join(" ")}${ELLIPSIS}`;
    if (displayWidth(t) <= width) return t;
  }
  return `${cutToWidth(words[0] ?? base, Math.max(0, width - 1))}${ELLIPSIS}`;
}

/** The marker line that tells that lines of the pane are hidden. */
export const MORE_MARK = "  (more: make the window taller)";

/**
 * The lines of the pane that fit `rows` rows (FR-013, FR-016). Where all fit, all. Otherwise they are kept in this order of need, until the
 * rows are used, and shown in their own order with a line that says `(more` where the first hidden ones were: the last line (the prompt), the
 * `protect`ed lines (the command), the first `pinned` lines (the summary), the last `keep` lines (what came of it), then the rest from its
 * start, so that the evidence and the details at the end of a step go first. With none of `pinned`, `keep` and `protect` it is the last
 * `rows` lines, as before.
 */
export function fitPane(pane: readonly string[], rows: number, pinned = 0, keep = 0, protect: readonly number[] = []): readonly string[] {
  if (pane.length <= rows) return pane;
  if (pinned === 0 && keep === 0 && protect.length === 0) return pane.slice(pane.length - rows);
  const n = pane.length;
  if (rows <= 1) return [pane[n - 1] ?? ""];
  const order: number[] = [n - 1];
  for (const i of protect) if (i >= 0 && i < n) order.push(i);
  for (let i = 0; i < Math.min(pinned, n); i++) order.push(i);
  for (let i = Math.max(0, n - keep); i < n; i++) order.push(i);
  for (let i = 0; i < n; i++) order.push(i);
  const room = Math.max(1, rows - 1);
  const chosen = new Set<number>();
  for (const i of order) {
    if (chosen.size >= room) break;
    chosen.add(i);
  }
  const kept = [...chosen].sort((x, y) => x - y);
  const out: string[] = [];
  let marked = false;
  let next = 0;
  for (const i of kept) {
    if (!marked && i > next) {
      out.push(MORE_MARK);
      marked = true;
    }
    out.push(pane[i] ?? "");
    next = i + 1;
  }
  if (!marked) out.splice(Math.max(0, out.length - 1), 0, MORE_MARK);
  return out.slice(0, rows);
}

/** The result of drawing: every row, and where the cursor goes (where the person types) or undefined. */
export type Drawn = { readonly lines: readonly string[]; readonly cursor: { readonly row: number; readonly col: number } | undefined };

/**
 * The screen as `rows` lines of exactly `columns` columns. Colour only where `caps.colour`; the content is the same without it. The pane shows
 * the last lines that fit.
 */
export function drawScreen(state: ScreenState, size: { readonly columns: number; readonly rows: number }, caps: Pick<GuideCaps, "colour">): Drawn {
  const { columns, rows } = size;
  const progress = state.progress === undefined || state.progress === "" ? undefined : state.progress;
  const lay = layoutOf(columns, rows, state.plan, progress === undefined ? 0 : 1);
  const role = (r: Role, t: string): string => paint(r, t, caps);
  const lines: string[] = [];
  const doneCount = state.plan.filter((p) => state.done.has(p.id) || state.skipped?.has(p.id) === true).length;
  const fallback = doneCount + (state.current !== undefined && !state.done.has(state.current) ? 1 : 0);
  const count = state.plan.length === 0 ? "" : `step ${Math.max(1, Math.min(state.plan.length, state.position ?? fallback))} of ${state.plan.length}`;
  const gap = Math.max(1, columns - displayWidth(state.title) - displayWidth(count) - 2);
  lines.push(role("accent", pad(` ${state.title}${" ".repeat(gap)}${count}`, columns)));
  const shown = fitPane(state.pane, lay.body, state.pinned ?? 0, state.keep ?? 0, state.protect ?? []);
  let cursor: Drawn["cursor"];
  // A plan longer than the body scrolls so that the current step stays in view.
  const at = state.plan.findIndex((p) => p.id === state.current);
  const first = state.plan.length <= lay.body ? 0 : Math.max(0, Math.min(state.plan.length - lay.body, (at < 0 ? 0 : at) - Math.floor(lay.body / 2)));
  for (let i = 0; i < lay.body; i++) {
    const item = state.plan[first + i];
    let l = "";
    if (lay.left > 0) {
      if (item === undefined) l = pad("", lay.left) + " | ";
      else {
        const isFailed = state.failed?.has(item.id) === true;
        const isDone = state.done.has(item.id) && !isFailed;
        const isCurrent = item.id === state.current && !isDone;
        const isSkipped = !isDone && !isCurrent && state.skipped?.has(item.id) === true;
        const mark = isFailed
          ? PLAN_MARKS.failed
          : isDone
            ? PLAN_MARKS.done
            : isCurrent
              ? PLAN_MARKS.current
              : isSkipped
                ? PLAN_MARKS.skipped
                : PLAN_MARKS.pending;
        const text = pad(`${mark} ${labelOf(item, Math.max(1, lay.left - 4))}`, lay.left);
        l = role(isFailed ? "failure" : isDone ? "success" : isCurrent ? "accent" : "dim", text) + " | ";
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
  if (progress !== undefined) lines.push(role("dim", pad(`  | ${progress}`, columns)));
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
