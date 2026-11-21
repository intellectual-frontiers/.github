// Spec: 0003-anyfs-cli-logical FR-005
/**
 * How the verbs write what they find (commons anyfs-cli 0003-anyfs-cli-logical FR-005): sizes for a person, the mode of a name as `ls -l` writes it, a table with its columns aligned, and a tree with its branches drawn.
 * Pure functions of their arguments, so the same facts are the same text everywhere.
 *
 * @example
 * ```ts
 * import { humanSize, modeText } from "./format.ts";
 * humanSize(1536); // "1.5K"
 * modeText("file", 0o644); // "-rw-r--r--"
 * ```
 *
 * @module
 */

/** A size in bytes as `ls -h` writes it: bytes below 1024, then K, M, G, T with one decimal where it is not whole. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes);
  const units = ["K", "M", "G", "T"] as const;
  let n = bytes;
  let unit = "";
  for (const u of units) {
    n /= 1024;
    unit = u;
    if (n < 1024) break;
  }
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}${unit}`;
}

/** The nine permission characters of a mode, with the leading type character. */
export function modeText(type: "file" | "dir", mode: number): string {
  const bits = "rwxrwxrwx";
  let out = type === "dir" ? "d" : "-";
  for (let i = 0; i < 9; i++) out += (mode & (1 << (8 - i))) !== 0 ? bits.charAt(i) : "-";
  return out;
}

/** A table: each row's cells padded to the width of the widest of their column, the last column left as it is. */
export function table(rows: readonly (readonly string[])[]): string {
  const widths: number[] = [];
  for (const row of rows) row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length)));
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

/** A node of a tree to draw. */
export type TreeNode = { readonly name: string; readonly children: readonly TreeNode[] };

/** The lines of a tree drawn with branches, its root first. */
export function drawTree(root: TreeNode): readonly string[] {
  const lines: string[] = [root.name];
  const walk = (nodes: readonly TreeNode[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const last = i === nodes.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${node.name}`);
      walk(node.children, `${prefix}${last ? "    " : "│   "}`);
    });
  };
  walk(root.children, "");
  return lines;
}

/** `1 file` or `2 files`. */
export function counted(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
