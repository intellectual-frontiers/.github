/**
 * Declarations as Markdown (commons data 0068-sql-docs FR-007): one section for each declaration that has documentation or members that have it, in the order of the text, always the same text for the same
 * declarations.
 *
 * @example
 * ```ts
 * toMarkdown(documentScript(parse("-- The people.\nCREATE TABLE person (id INT -- the key\n)")));
 * ```
 *
 * Spec: 0068-sql-docs FR-007
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Declaration } from "./declarations.ts";
import type { DocTag } from "./doc.ts";

const tagLines = (t: DocTag): string[] => {
  switch (t.kind) {
    case "param":
      return [`- **${t.name}**${t.type === undefined ? "" : ` (\`${t.type}\`)`}${t.text === "" ? "" : `: ${t.text}`}`];
    case "returns":
      return [`**Returns**: ${t.text}`];
    case "example":
      return ["**Example**", "", "```sql", t.code, "```"];
    case "deprecated":
      return [`**Deprecated**${t.text === "" ? "" : `: ${t.text}`}`];
    case "since":
      return [`**Since**: ${t.text}`];
    case "see":
      return [`**See**: ${t.text}`];
    case "custom":
      return [`**@${t.tag}**${t.text === "" ? "" : `: ${t.text}`}`];
    default:
      return absurd(t);
  }
};

const worth = (d: Declaration): boolean => d.doc !== undefined || d.members.some(worth);

function section(d: Declaration, level: number, out: string[]): void {
  out.push(`${"#".repeat(level)} ${d.kind} \`${d.name}\``, "");
  if (d.doc !== undefined) {
    if (d.doc.summary !== "") out.push(d.doc.summary, "");
    if (d.doc.description !== "") out.push(d.doc.description, "");
    const params = d.doc.tags.filter((t) => t.kind === "param");
    if (params.length > 0) out.push("**Parameters**", "", ...params.flatMap(tagLines), "");
    for (const t of d.doc.tags) if (t.kind !== "param") out.push(...tagLines(t), "");
  }
  const members = d.members.filter(worth);
  if (members.length > 0) {
    out.push(`**${members.some((m) => m.kind === "cte") ? "Common table expressions" : "Members"}**`, "");
    for (const m of members)
      out.push(`- \`${m.name}\` (${m.kind})${m.doc === undefined || m.doc.summary === "" ? "" : `: ${m.doc.summary}`}`);
    out.push("");
  }
}

/**
 * Writes declarations as Markdown.
 *
 * @param declarations - what `documentScript` gave
 * @param level - the heading level of each declaration's section (2 by default)
 * @returns the text, ending with a new line
 */
export function toMarkdown(declarations: readonly Declaration[], level = 2): string {
  const out: string[] = [];
  for (const d of declarations) if (worth(d)) section(d, level, out);
  return out.length === 0 ? "" : `${out.join("\n").trimEnd()}\n`;
}
