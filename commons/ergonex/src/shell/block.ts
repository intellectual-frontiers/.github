// Spec: 0003-host FR-019
/**
 * The one marked block of a start-up file (commons 0003-host FR-019): `ergonex shell install` writes a block between the lines `# >>> ergonex >>>` and `# <<< ergonex <<<`, leaves one block where it is
 * run twice, and `--uninstall` removes exactly that block and nothing else, so that a file that had other text is, after both, as it was.
 *
 * @remarks
 * Pure: these are functions from the file's text to its new text; the host layer reads the file, shows the diff, asks and writes. The block is appended at the end of the file with no blank line of
 * its own, so that removing it removes nothing the person wrote; where the file did not end in a newline, one is added before the block and stays after it is removed. A file that uses CRLF gets
 * a block that uses CRLF. A block with a begin and no end is refused rather than guessed at. A file that does not exist is not made (0003-host FR-026): `installBlock` refuses it as `absent`,
 * and the command says how the person creates it.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** The line that begins the block. */
export const BEGIN = "# >>> ergonex >>>";

/** The line that ends the block. */
export const END = "# <<< ergonex <<<";

/** What is wrong with a file's blocks. */
export type BlockError =
  | { readonly kind: "unterminated"; readonly line: number }
  | { readonly kind: "unopened"; readonly line: number }
  /** The start-up file does not exist: ergonex never creates one (0003-host FR-026). */
  | { readonly kind: "absent" };

/** A refusal as one sentence. */
export function describeBlockError(e: BlockError): string {
  switch (e.kind) {
    case "unterminated":
      return `the block that begins at line ${e.line} has no end line (${END}); fix or remove it by hand`;
    case "unopened":
      return `the end line of a block at line ${e.line} has no begin line (${BEGIN}); fix or remove it by hand`;
    case "absent":
      return "the start-up file does not exist, and ergonex never creates one";
    default:
      return absurd(e);
  }
}

/** The lines of a text with their line endings kept. */
function linesKept(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

type Span = { readonly from: number; readonly to: number };

/** The blocks of a file as spans of line indexes (`to` is exclusive), or the first thing wrong. */
function blocks(lines: readonly string[]): Result<readonly Span[], BlockError> {
  const spans: Span[] = [];
  let open: number | undefined;
  for (const [i, raw] of lines.entries()) {
    const line = raw.replace(/\r?\n$/, "");
    if (line === BEGIN) {
      if (open !== undefined) return err({ kind: "unterminated", line: open + 1 });
      open = i;
    } else if (line === END) {
      if (open === undefined) return err({ kind: "unopened", line: i + 1 });
      spans.push({ from: open, to: i + 1 });
      open = undefined;
    }
  }
  if (open !== undefined) return err({ kind: "unterminated", line: open + 1 });
  return ok(spans);
}

/** The text of a block: the begin line, the snippet and the end line, each ending in `eol`. */
export function blockText(snippet: string, eol: "\n" | "\r\n" = "\n"): string {
  const body = snippet.replace(/\r?\n$/, "").split(/\r?\n/);
  return [BEGIN, ...body, END].map((l) => `${l}${eol}`).join("");
}

/** What a change to a file comes to. */
export type Edit = { readonly text: string; readonly changed: boolean };

/**
 * The file after the block is installed: appended where there is none, replaced where one is there (so that the snippet is the current one), and one only where several are. `existing` is the file's
 * text, or undefined where there is no file, which is refused as `absent`: a start-up file is never created (0003-host FR-026).
 */
export function installBlock(existing: string | undefined, snippet: string): Result<Edit, BlockError> {
  if (existing === undefined) return err({ kind: "absent" });
  const text = existing;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const block = blockText(snippet, eol);
  const lines = linesKept(text);
  const found = blocks(lines);
  if (found.kind === "err") return found;
  const spans = found.value;
  if (spans.length === 0) {
    const lead = text === "" || text.endsWith("\n") ? "" : eol;
    return ok({ text: `${text}${lead}${block}`, changed: true });
  }
  const out: string[] = [];
  let at = 0;
  for (const [i, s] of spans.entries()) {
    out.push(...lines.slice(at, s.from));
    if (i === 0) out.push(block);
    at = s.to;
  }
  out.push(...lines.slice(at));
  const next = out.join("");
  return ok({ text: next, changed: next !== text });
}

/** The file after every block is removed, with exactly the lines of the blocks and nothing else; unchanged where there is none. */
export function removeBlock(existing: string): Result<Edit, BlockError> {
  const lines = linesKept(existing);
  const found = blocks(lines);
  if (found.kind === "err") return found;
  if (found.value.length === 0) return ok({ text: existing, changed: false });
  const drop = new Set(found.value.flatMap((s) => Array.from({ length: s.to - s.from }, (_, k) => s.from + k)));
  return ok({
    text: lines.filter((_, i) => !drop.has(i)).join(""),
    changed: true,
  });
}
