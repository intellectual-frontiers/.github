// Spec: 0002-ui FR-020
/**
 * The widgets of the ui (commons terminal 0002-ui FR-020 to FR-022): `select` (a list to choose from, with type-to-filter), `table`, `statusBar`,
 * `log` and `home` (a header, a body and a footer of key hints). Each is a pure render from a state and a size to lines of exactly the
 * width, with no line feed; the input-driven ones also have a step function from a key to the next state. At `plain` no colour is
 * used, and `selectByLine` chooses from a numbered list by reading lines where raw keys are not available.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { UiCaps } from "./ui-caps.ts";
import type { LineRead, UiIn, UiOut } from "./ui-driver.ts";
import type { Key } from "./ui-keys.ts";
import { ELLIPSIS, type Drawn } from "./ui-screen.ts";
import { wrap } from "./ui-render.ts";
import { paint, type Role } from "./palette.ts";
import { type Dress, iconOf, type IconName, type ThemeName, tint } from "./ui-theme.ts";
import { cutToWidth, displayWidth } from "./width.ts";

type Size = { readonly columns: number; readonly rows: number };

/** A text cut to `width` columns with `~` where it was shortened, and padded with spaces to exactly `width`. */
export function fit(text: string, width: number): string {
  const w = Math.max(0, width);
  const cut = displayWidth(text) > w ? (w === 0 ? "" : `${cutToWidth(text, w - 1)}${ELLIPSIS}`) : text;
  return cut + " ".repeat(Math.max(0, w - displayWidth(cut)));
}

/* ---------------------------------------------------------------- select */

/** One choice: an id the caller keeps, the label shown, an optional badge and a dim description. */
export type SelectItem = { readonly id: string; readonly label: string; readonly badge?: string | undefined; readonly description?: string | undefined; readonly icon?: IconName | undefined };

/** The state of a select: the items, what was typed to filter, the index in the filtered list, and whether the filter line is open. */
export type SelectState = { readonly items: readonly SelectItem[]; readonly filter: string; readonly index: number; readonly searching: boolean };

/** What a key did to a select: the next state, and where it ended, the id chosen or the abort. */
export type SelectStep = {
  readonly state: SelectState;
  readonly outcome?: { readonly kind: "chosen"; readonly id: string } | { readonly kind: "abort" } | undefined;
};

/** A select at its start: the first item chosen, no filter. */
export function selectStart(items: readonly SelectItem[], index = 0): SelectState {
  return { items, filter: "", index: Math.max(0, Math.min(items.length - 1, index)), searching: false };
}

/** The items whose label, id, badge or description contains the filter (case does not matter); all where it is empty. */
export function selectFiltered(state: SelectState): readonly SelectItem[] {
  const f = state.filter.trim().toLowerCase();
  if (f === "") return state.items;
  return state.items.filter((i) => `${i.label} ${i.id} ${i.badge ?? ""} ${i.description ?? ""}`.toLowerCase().includes(f));
}

/**
 * One key applied to a select: up and down (Tab too) move and wrap around; Enter chooses the item at the index; printable characters filter
 * (`/` opens the filter line first); Backspace removes one; Esc clears the filter, or aborts where there is none; Ctrl+C aborts.
 */
export function selectKey(state: SelectState, key: Key): SelectStep {
  const shown = selectFiltered(state);
  const move = (d: number): SelectStep => ({ state: { ...state, index: shown.length === 0 ? 0 : (state.index + d + shown.length) % shown.length } });
  switch (key.name) {
    case "ctrl-c":
    case "ctrl-d":
      return { state, outcome: { kind: "abort" } };
    case "escape":
      return state.filter !== "" || state.searching ? { state: { ...state, filter: "", index: 0, searching: false } } : { state, outcome: { kind: "abort" } };
    case "up":
      return move(-1);
    case "down":
    case "tab":
      return move(1);
    case "shift-tab":
      return move(-1);
    case "home":
      return { state: { ...state, index: 0 } };
    case "end":
      return { state: { ...state, index: Math.max(0, shown.length - 1) } };
    case "enter": {
      const item = shown[state.index];
      return item === undefined ? { state } : { state, outcome: { kind: "chosen", id: item.id } };
    }
    case "backspace":
      return state.filter === "" ? { state: { ...state, searching: false } } : { state: { ...state, filter: [...state.filter].slice(0, -1).join(""), index: 0 } };
    case "char":
      if (key.text === "/" && state.filter === "" && !state.searching) return { state: { ...state, searching: true } };
      return { state: { ...state, filter: state.filter + key.text, index: 0, searching: true } };
    default:
      return { state };
  }
}

/** The first row to show so that `index` stays in a viewport of `height` rows over `count` items. */
export function viewportStart(count: number, height: number, index: number): number {
  if (count <= height) return 0;
  return Math.max(0, Math.min(count - height, index - Math.floor(height / 2)));
}

/**
 * A select as exactly `size.rows` lines of exactly `size.columns` columns: the filter line where a filter is open, then the items from the
 * first that keeps the selected one in view (`> ` marks it, in the accent colour), each with its badge and its dim description, cut with `~`.
 */
export function renderSelect(state: SelectState, size: Size, caps: Dress): Drawn {
  const shown = selectFiltered(state);
  const lines: string[] = [];
  const role = (r: Role, t: string): string => paint(r, t, caps);
  const filterLine = state.searching || state.filter !== "";
  const height = Math.max(1, size.rows - (filterLine ? 1 : 0));
  if (filterLine) lines.push(role("hint", fit(`  / ${state.filter}`, size.columns)));
  if (shown.length === 0) lines.push(role("dim", fit("  (nothing matches)", size.columns)));
  const at = Math.min(state.index, Math.max(0, shown.length - 1));
  const first = viewportStart(shown.length, height, at);
  for (const [n, item] of shown.slice(first, first + height).entries()) {
    const selected = first + n === at;
    const badge = item.badge === undefined || item.badge === "" ? "" : ` [${item.badge}]`;
    const head = `${selected ? "> " : "  "}${item.icon === undefined ? "" : `${iconOf(item.icon, caps)} `}${item.label}${badge}`;
    const desc = item.description === undefined || item.description === "" ? "" : `  ${item.description}`;
    if (selected) lines.push(tint("selection", fit(head + desc, size.columns), caps));
    else if (desc === "") lines.push(fit(head, size.columns));
    else {
      const room = size.columns - displayWidth(head);
      lines.push(room >= 4 ? `${head}${role("dim", fit(desc, room))}` : fit(head, size.columns));
    }
  }
  while (lines.length < size.rows) lines.push(" ".repeat(size.columns));
  const cursor = filterLine ? { row: 0, col: Math.min(size.columns - 1, 4 + displayWidth(state.filter)) } : undefined;
  return { lines: lines.slice(0, size.rows), cursor };
}

/** The plain fallback: the items as a numbered list, `1. Label [badge] - description`, each line cut to the columns. */
export function renderSelectPlain(items: readonly SelectItem[], columns: number): readonly string[] {
  return items.flatMap((i, n) => {
    const text = `${n + 1}. ${i.label}${i.badge === undefined || i.badge === "" ? "" : ` [${i.badge}]`}${i.description === undefined || i.description === "" ? "" : ` - ${i.description}`}`;
    return wrap(text, columns, 3, 0);
  });
}

/** How a select ended without a choice. */
export type SelectEnd = { readonly kind: "aborted" } | { readonly kind: "end" };

/**
 * Chooses from a numbered list by reading lines, where raw keys are not available: the list is written, then a line is read; a number
 * chooses, the label or id typed whole chooses, `q` aborts, anything else is said once and asked again. The end of the input is `end`.
 */
export async function selectByLine(o: {
  readonly items: readonly SelectItem[];
  readonly title?: string;
  readonly out: Pick<UiOut, "write">;
  readonly in: Pick<UiIn, "readLine">;
  readonly caps: Pick<UiCaps, "columns">;
  readonly signal?: AbortSignal | undefined;
}): Promise<Result<string, SelectEnd>> {
  if (o.title !== undefined) o.out.write(`${o.title}\n`);
  for (const l of renderSelectPlain(o.items, o.caps.columns)) o.out.write(`${l}\n`);
  for (;;) {
    o.out.write(`Choose 1-${o.items.length} (q quits): `);
    const got: LineRead = await o.in.readLine(o.signal);
    if (got.kind === "aborted") return err({ kind: "aborted" });
    if (got.kind === "end") return err({ kind: "end" });
    const t = got.text.trim();
    if (t.toLowerCase() === "q") return err({ kind: "aborted" });
    const n = /^\d+$/.test(t) ? Number(t) : 0;
    const byNumber = o.items[n - 1];
    const byName = o.items.find((i) => i.id === t || i.label.toLowerCase() === t.toLowerCase());
    const found = byNumber ?? byName;
    if (found !== undefined) return ok(found.id);
    o.out.write(`"${t}" is not a choice.\n`);
  }
}

/* ----------------------------------------------------------------- table */

/** A column of a table: the key of the cell in a row, its header and, where given, its width in columns. */
export type TableColumn = { readonly key: string; readonly title: string; readonly width?: number | undefined; readonly align?: "left" | "right" };

/** A table to draw: the columns, the rows (a cell is text), the selected row where there is one, and the first row shown. */
export type TableSpec = {
  readonly columns: readonly TableColumn[];
  readonly rows: readonly Readonly<Record<string, string>>[];
  readonly selected?: number | undefined;
};

/** The widths of the columns: the given ones, else the widest cell; the widest column is cut where the whole is wider than `columns`. */
export function columnWidths(spec: TableSpec, columns: number): readonly number[] {
  const w = spec.columns.map((c) => c.width ?? Math.max(displayWidth(c.title), ...spec.rows.map((r) => displayWidth(r[c.key] ?? ""))));
  const gaps = 2 * Math.max(0, w.length - 1) + 2;
  for (;;) {
    const total = w.reduce((a, b) => a + b, 0) + gaps;
    if (total <= columns) return w;
    const widest = w.indexOf(Math.max(...w));
    if ((w[widest] ?? 0) <= 3) return w;
    w[widest] = (w[widest] ?? 0) - Math.min(total - columns, (w[widest] ?? 0) - 3);
  }
}

/**
 * A table as exactly `size.rows` lines of `size.columns` columns: a header, then the rows (the selected one marked `> ` and in the accent
 * colour), a cell longer than its column cut with `~`; the header stays and the viewport keeps the selected row in view.
 */
export function renderTable(spec: TableSpec, size: Size, caps: Dress): readonly string[] {
  const widths = columnWidths(spec, size.columns);
  const cells = (get: (c: TableColumn) => string): string =>
    "  " +
    spec.columns
      .map((c, i) => {
        const w = widths[i] ?? 1;
        const t = fit(get(c), w);
        if (c.align !== "right") return t;
        const raw = get(c);
        return displayWidth(raw) >= w ? t : " ".repeat(w - displayWidth(raw)) + raw;
      })
      .join("  ");
  const lines = [tint("dim", fit(cells((c) => c.title), size.columns), caps)];
  const height = Math.max(0, size.rows - 1);
  const at = spec.selected ?? 0;
  const first = viewportStart(spec.rows.length, height, at);
  for (const [n, row] of spec.rows.slice(first, first + height).entries()) {
    const line = fit(cells((c) => row[c.key] ?? ""), size.columns);
    if (spec.selected !== undefined && first + n === spec.selected) lines.push(tint("selection", `>${line.slice(1)}`, caps));
    else lines.push(line);
  }
  while (lines.length < size.rows) lines.push(" ".repeat(size.columns));
  return lines.slice(0, size.rows);
}

/* ------------------------------------------------------------ status bar */

/** One chip of a status bar: a short text and the role that colours it. */
export type Chip = { readonly text: string; readonly role?: ThemeName; readonly icon?: IconName | undefined };

/** The chips on one line of exactly `columns` columns, separated by two spaces, cut with `~` where they do not fit. */
export function statusBar(chips: readonly Chip[], columns: number, caps: Dress): string {
  const shown = (c: Chip): string => (c.icon === undefined ? c.text : `${iconOf(c.icon, caps)} ${c.text}`);
  const text = chips.map(shown).join("  ");
  if (displayWidth(text) > columns) return fit(text, columns);
  const painted = chips.map((c) => (c.role === undefined ? shown(c) : tint(c.role, shown(c), caps))).join("  ");
  return painted + " ".repeat(columns - displayWidth(text));
}

/* ------------------------------------------------------------------- log */

/** The tail of a log: lines wrapped to the width, the last `rows` of them, or those `offset` lines further up (the scroll), padded to size. */
export function renderLog(lines: readonly string[], size: Size, offset: number, caps: Dress): readonly string[] {
  const wrapped = lines.flatMap((l) => wrap(l, size.columns, 2, 0));
  const max = Math.max(0, wrapped.length - size.rows);
  const up = Math.max(0, Math.min(max, offset));
  const end = wrapped.length - up;
  const shown = wrapped.slice(Math.max(0, end - size.rows), end).map((l) => paint(up > 0 ? "dim" : "plain", fit(l, size.columns), caps));
  while (shown.length < size.rows) shown.push(" ".repeat(size.columns));
  return shown;
}

/** A log scrolled by a key: up and Page Up go back, down and Page Down forward, Home to the oldest, End to the newest. */
export function logKey(offset: number, total: number, rows: number, key: Key): number {
  const max = Math.max(0, total - rows);
  const next =
    key.name === "up" ? offset + 1 : key.name === "down" ? offset - 1 : key.name === "pageup" ? offset + rows : key.name === "pagedown" ? offset - rows : key.name === "home" ? max : key.name === "end" ? 0 : offset;
  return Math.max(0, Math.min(max, next));
}

/* ------------------------------------------------------------------ home */

/** What `home` composes: a title and status chips for the header, a body drawn for the rows it is given, and the key hints of the footer. */
export type HomeSpec = {
  readonly title: string;
  readonly chips: readonly Chip[];
  /** The body, drawn for the rows left; it keeps its own selected row in view (`renderSelect` and `renderTable` do). */
  readonly body: (size: Size) => Drawn;
  readonly footer: string;
};

/**
 * The home screen as exactly `rows` lines of exactly `columns`: the header (title left, chips right, one line), a blank line, the body, and the
 * footer on the last row. The footer and the header are protected: the body gets the rows between and is clipped to them, so a small screen
 * loses blank lines first and body rows last, never the footer. The cursor is the body's, moved down by its start.
 */
export function renderHome(spec: HomeSpec, size: Size, caps: Dress): Drawn {
  const { columns, rows } = size;
  const chipText = spec.chips.map((c) => (c.icon === undefined ? c.text : `${iconOf(c.icon, caps)} ${c.text}`)).join("  ");
  const t = displayWidth(spec.title) + 1 > columns - 1 ? fit(` ${spec.title}`, Math.max(1, columns - 1)) : ` ${spec.title}`;
  const chipsW = Math.min(displayWidth(chipText), Math.max(0, columns - displayWidth(t) - 2));
  const chipLine = chipsW >= displayWidth(chipText) ? statusBar(spec.chips, chipsW, caps) : fit(chipText, chipsW);
  const gap = Math.max(0, columns - displayWidth(t) - chipsW - 1);
  const lines: string[] = [tint("accent", t, caps) + " ".repeat(gap) + chipLine + " "];
  const spacer = rows >= 6 ? 1 : 0;
  const bodyRows = Math.max(0, rows - 2 - spacer);
  if (spacer === 1) lines.push(" ".repeat(columns));
  const b: Drawn = bodyRows === 0 ? { lines: [], cursor: undefined } : spec.body({ columns, rows: bodyRows });
  const bLines = b.lines;
  const cursor = b.cursor;
  for (const l of bLines.slice(0, bodyRows)) lines.push(l);
  while (lines.length < rows - 1) lines.push(" ".repeat(columns));
  lines.push(tint("dim", fit(` ${spec.footer}`, columns), caps));
  return { lines: lines.slice(0, rows), cursor: cursor === undefined ? undefined : { row: cursor.row + 1 + spacer, col: cursor.col } };
}

/** Lines with no cursor, as a `Drawn` (for a table or a log as the body of `home`). */
export function drawnOf(lines: readonly string[]): Drawn {
  return { lines, cursor: undefined };
}
