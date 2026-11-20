// Spec: 0003-host FR-012
/**
 * A unified diff of two texts (commons 0003-host FR-012, FR-019): what `ergonex render --dry-run` shows of a generated file that would change, and what `ergonex shell install` shows of the one
 * block it would write, so that a person sees the exact change before it is made.
 *
 * @remarks
 * The lines are compared by a longest common subsequence, which is exact and, for the files of a workspace (a few hundred lines), small. The hunks carry three lines of context, as `diff -u` does,
 * and a text with no difference gives no hunk and an empty string. Line endings are LF here; a caller normalizes first.
 *
 * @module
 */

type Op = { readonly kind: " " | "-" | "+"; readonly line: string };

const CONTEXT = 3;

/** The lines of a text, without the empty last element a final newline would make. */
function linesOf(text: string): readonly string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/** The edit script from `a` to `b`. */
function script(a: readonly string[], b: readonly string[]): readonly Op[] {
  const n = a.length;
  const m = b.length;
  // lengths of the common suffixes, row by row
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = table[i];
      const below = table[i + 1];
      if (row === undefined || below === undefined) continue;
      row[j] = a[i] === b[j] ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", line: a[i] ?? "" });
      i++;
      j++;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      ops.push({ kind: "-", line: a[i] ?? "" });
      i++;
    } else {
      ops.push({ kind: "+", line: b[j] ?? "" });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "-", line: a[i++] ?? "" });
  while (j < m) ops.push({ kind: "+", line: b[j++] ?? "" });
  return ops;
}

/** The unified diff from `before` to `after`, headed by `--- a/<name>` and `+++ b/<name>`; an empty string where the texts are equal. */
export function unifiedDiff(name: string, before: string, after: string): string {
  if (before === after) return "";
  const ops = script(linesOf(before), linesOf(after));
  const changed = ops.flatMap((o, i) => (o.kind === " " ? [] : [i]));
  if (changed.length === 0) return "";
  // group the changes whose contexts touch
  const groups: { from: number; to: number }[] = [];
  for (const i of changed) {
    const last = groups.at(-1);
    if (last !== undefined && i - last.to <= 2 * CONTEXT + 1) last.to = i;
    else groups.push({ from: i, to: i });
  }
  const out: string[] = [`--- a/${name}`, `+++ b/${name}`];
  for (const g of groups) {
    const start = Math.max(0, g.from - CONTEXT);
    const end = Math.min(ops.length - 1, g.to + CONTEXT);
    const slice = ops.slice(start, end + 1);
    const before0 = ops.slice(0, start).filter((o) => o.kind !== "+").length;
    const after0 = ops.slice(0, start).filter((o) => o.kind !== "-").length;
    const oldCount = slice.filter((o) => o.kind !== "+").length;
    const newCount = slice.filter((o) => o.kind !== "-").length;
    out.push(`@@ -${oldCount === 0 ? before0 : before0 + 1},${oldCount} +${newCount === 0 ? after0 : after0 + 1},${newCount} @@`);
    for (const o of slice) out.push(`${o.kind}${o.line}`);
  }
  return `${out.join("\n")}\n`;
}
