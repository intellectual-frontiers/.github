// Spec: 0003-anyfs-cli-logical FR-006
/**
 * A line diff in the unified form (commons anyfs-cli 0003-anyfs-cli-logical FR-006): the shortest edit of the lines of one text into the other by the longest common subsequence, written as hunks with three lines of
 * context. It is bounded: two texts whose product of lines is over four million are not compared line by line, and the result says so, so that a diff of two huge files is a sentence and not a stall.
 *
 * @example
 * ```ts
 * import { unifiedDiff } from "./diff.ts";
 * unifiedDiff("a\nb\n", "a\nc\n", "x", "y"); // { kind: "differ", text: "--- x\n+++ y\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n" }
 * ```
 *
 * @module
 */

/** What comparing two texts gave. */
export type DiffResult =
  | { readonly kind: "same" }
  | { readonly kind: "differ"; readonly text: string; readonly added: number; readonly removed: number }
  | { readonly kind: "too-large"; readonly lines: number };

/** The most lines of the one times the lines of the other that are compared. */
export const DIFF_LIMIT = 4_000_000;

const CONTEXT = 3;

type Edit = { readonly kind: "same" | "add" | "del"; readonly line: string };

function linesOf(text: string): readonly string[] {
  if (text === "") return [];
  const parts = text.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** The edit script that turns `a` into `b`, by the table of longest common subsequences. */
function script(a: readonly string[], b: readonly string[]): readonly Edit[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] = a[i] === b[j] ? (table[(i + 1) * width + j + 1] ?? 0) + 1 : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }
  const out: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", line: a[i] ?? "" });
      i++;
      j++;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      out.push({ kind: "del", line: a[i] ?? "" });
      i++;
    } else {
      out.push({ kind: "add", line: b[j] ?? "" });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", line: a[i++] ?? "" });
  while (j < m) out.push({ kind: "add", line: b[j++] ?? "" });
  return out;
}

/** The unified diff of two texts, with the names of the two sides in its header. */
export function unifiedDiff(before: string, after: string, beforeName: string, afterName: string): DiffResult {
  if (before === after) return { kind: "same" };
  const a = linesOf(before);
  const b = linesOf(after);
  if ((a.length + 1) * (b.length + 1) > DIFF_LIMIT) return { kind: "too-large", lines: a.length + b.length };
  const edits = script(a, b);
  const added = edits.filter((e) => e.kind === "add").length;
  const removed = edits.filter((e) => e.kind === "del").length;
  if (added === 0 && removed === 0) return { kind: "same" };
  const changed: number[] = [];
  edits.forEach((e, i) => {
    if (e.kind !== "same") changed.push(i);
  });
  const hunks: { from: number; to: number }[] = [];
  for (const i of changed) {
    const from = Math.max(0, i - CONTEXT);
    const to = Math.min(edits.length - 1, i + CONTEXT);
    const last = hunks[hunks.length - 1];
    if (last !== undefined && from <= last.to + 1) last.to = Math.max(last.to, to);
    else hunks.push({ from, to });
  }
  const text: string[] = [`--- ${beforeName}`, `+++ ${afterName}`];
  for (const h of hunks) {
    let aStart = 1;
    let bStart = 1;
    for (let k = 0; k < h.from; k++) {
      const e = edits[k];
      if (e !== undefined && e.kind !== "add") aStart++;
      if (e !== undefined && e.kind !== "del") bStart++;
    }
    let aCount = 0;
    let bCount = 0;
    const body: string[] = [];
    for (let k = h.from; k <= h.to; k++) {
      const e = edits[k];
      if (e === undefined) continue;
      if (e.kind === "same") {
        body.push(` ${e.line}`);
        aCount++;
        bCount++;
      } else if (e.kind === "del") {
        body.push(`-${e.line}`);
        aCount++;
      } else {
        body.push(`+${e.line}`);
        bCount++;
      }
    }
    text.push(`@@ -${aCount === 0 ? aStart - 1 : aStart},${aCount} +${bCount === 0 ? bStart - 1 : bStart},${bCount} @@`, ...body);
  }
  return { kind: "differ", text: `${text.join("\n")}\n`, added, removed };
}
