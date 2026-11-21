/**
 * A tree as text (commons lang-sql 0002-sql-ast-parser FR-017): one node to a line, indented, each field in the order the node declares it, the same text for the same tree. It is what the golden files of the
 * parser hold, so that a change of the grammar shows as a difference of text.
 *
 * @example
 * ```ts
 * toSexp(parse("select 1").script);
 * // script
 * //   statements[0]: select distinct=false
 * //     items[0]: select-item
 * //       expr: number text="1"
 * ```
 *
 * Spec: 0002-sql-ast-parser FR-017
 *
 * @module
 */
import type { Node } from "./ast.ts";

/** What {@link toSexp} may be asked. */
export interface SexpOptions {
  /** Write each node's range after its kind. */
  readonly spans?: boolean;
}

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string" && "start" in v;

function lines(node: Node, label: string, indent: number, spans: boolean, out: string[]): void {
  const pad = "  ".repeat(indent);
  const scalars: string[] = [];
  const kids: [string, unknown][] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "kind" || key === "start" || key === "end") continue;
    if (value === undefined) continue;
    if (isNode(value)) kids.push([key, value]);
    else if (Array.isArray(value)) {
      if (value.some(isNode)) kids.push([key, value]);
      else if (value.length > 0) scalars.push(`${key}=${JSON.stringify(value)}`);
    } else scalars.push(`${key}=${JSON.stringify(value)}`);
  }
  out.push(`${pad}${label}${node.kind}${spans ? ` @${node.start}-${node.end}` : ""}${scalars.length === 0 ? "" : ` ${scalars.join(" ")}`}`);
  for (const [key, value] of kids) {
    if (isNode(value)) lines(value, `${key}: `, indent + 1, spans, out);
    else if (Array.isArray(value))
      for (const [i, item] of value.entries()) if (isNode(item)) lines(item, `${key}[${i}]: `, indent + 1, spans, out);
  }
}

/**
 * Writes a tree as text.
 *
 * @param node - the tree
 * @param options - whether to write ranges
 * @returns the text, with no newline at its end
 */
export function toSexp(node: Node, options: SexpOptions = {}): string {
  const out: string[] = [];
  lines(node, "", 0, options.spans === true, out);
  return out.join("\n");
}
