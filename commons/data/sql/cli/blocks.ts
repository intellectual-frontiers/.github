// Spec: 0047-arcactl-init FR-002
/**
 * Managed blocks (commons data 0047-arcactl-init FR-002): the one way `arcactl` changes a file that a person also edits. A block is a run of lines between two marker lines that name it; `arcactl`
 * writes only inside its markers, so the rest of the file is the person's and is never touched. Putting a block in twice is the same as once, taking it out leaves the file as it was, and a file
 * whose markers do not make sense (one is missing, or the block is there twice) is an error value and is not changed.
 *
 * @remarks
 * The line ending of the file is kept. Taking a block out restores the file exactly where the file ended with a line ending (or was empty) when the block was put in.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** The comment mark of the file the block is in: `#` for most, `--` for `psql`'s. */
export type Style = "#" | "--";

/** What is wrong with a file's blocks. */
export type BlockError =
  | { readonly kind: "unbalanced"; readonly name: string; readonly why: string }
  | { readonly kind: "duplicate"; readonly name: string }
  | { readonly kind: "name"; readonly name: string };

const NAME = /^[a-z][a-z0-9-]*$/;

/** The two marker lines of a block. */
export const markers = (name: string, style: Style): { readonly open: string; readonly close: string } => ({
  open: `${style} >>> arcactl:${name} >>>`,
  close: `${style} <<< arcactl:${name} <<<`,
});

const eolOf = (text: string): string => (text.includes("\r\n") ? "\r\n" : "\n");

interface Found {
  /** Index of the first character of the open marker line. */
  readonly start: number;
  /** Index after the close marker line, and its line ending. */
  readonly end: number;
  readonly body: string;
}

/** Where a block is, or that it is not. */
function find(text: string, name: string, style: Style): Result<Found | undefined, BlockError> {
  if (!NAME.test(name)) return err({ kind: "name", name });
  const m = markers(name, style);
  const lines: { readonly at: number; readonly line: string; readonly next: number }[] = [];
  let at = 0;
  while (at <= text.length) {
    const nl = text.indexOf("\n", at);
    const stop = nl === -1 ? text.length : nl;
    lines.push({ at, line: text.slice(at, stop).replace(/\r$/, ""), next: nl === -1 ? text.length : nl + 1 });
    if (nl === -1) break;
    at = nl + 1;
  }
  const opens = lines.filter((l) => l.line.trimEnd() === m.open);
  const closes = lines.filter((l) => l.line.trimEnd() === m.close);
  if (opens.length === 0 && closes.length === 0) return ok(undefined);
  if (opens.length > 1 || closes.length > 1) return err({ kind: "duplicate", name });
  const open = opens[0];
  const close = closes[0];
  if (open === undefined) return err({ kind: "unbalanced", name, why: "there is a closing marker and no opening one" });
  if (close === undefined) return err({ kind: "unbalanced", name, why: "there is an opening marker and no closing one" });
  if (close.at < open.at) return err({ kind: "unbalanced", name, why: "the closing marker is before the opening one" });
  return ok({ start: open.at, end: close.next, body: text.slice(open.next, close.at) });
}

/** The body of a block, or none where it is not there. */
export function blockOf(text: string, name: string, style: Style): Result<string | undefined, BlockError> {
  const f = find(text, name, style);
  return f.kind === "err" ? f : ok(f.value === undefined ? undefined : f.value.body.replace(/\r?\n$/, ""));
}

/**
 * The text with the block put in: replaced where it is there, added at the end where it is not.
 *
 * @param text - the file's text
 * @param name - the block's name
 * @param style - the file's comment mark
 * @param body - what is inside the markers, as lines
 * @returns the new text, or what is wrong with the markers
 */
export function withBlock(text: string, name: string, style: Style, body: string): Result<string, BlockError> {
  const f = find(text, name, style);
  if (f.kind === "err") return f;
  const eol = eolOf(text);
  const m = markers(name, style);
  const inside = body === "" ? "" : `${body.replace(/\r?\n/g, eol)}${eol}`;
  const block = `${m.open}${eol}${inside}${m.close}${eol}`;
  if (f.value !== undefined) return ok(text.slice(0, f.value.start) + block + text.slice(f.value.end));
  if (text === "") return ok(block);
  return ok(`${text}${text.endsWith("\n") ? "" : eol}${eol}${block}`);
}

/**
 * The text with the block taken out, and the blank line that was put before it where there is one.
 *
 * @param text - the file's text
 * @param name - the block's name
 * @param style - the file's comment mark
 * @returns the new text, or what is wrong with the markers
 */
export function withoutBlock(text: string, name: string, style: Style): Result<string, BlockError> {
  const f = find(text, name, style);
  if (f.kind === "err") return f;
  if (f.value === undefined) return ok(text);
  const eol = eolOf(text);
  let before = text.slice(0, f.value.start);
  const after = text.slice(f.value.end);
  if (before.endsWith(`${eol}${eol}`)) before = before.slice(0, -eol.length);
  return ok(before + after);
}
