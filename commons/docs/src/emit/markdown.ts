// Spec: 0001-docs FR-001
/**
 * The Markdown twin of a page (commons 0011-documentation FR-028): every page of the site is also written as Markdown beside its HTML, from the same page model, so that a reader that is a program (an agent) reads
 * the words and the structure and not the markup. Every case of a block and an inline is matched with a `switch` that ends in `absurd`, so that a case added to the model and left out here does not compile. Links
 * to pages of the site point at the Markdown twin of the page.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Block, Card, Href, Inline, Page, TreeNode } from "../model.ts";
import { sparkText } from "./html.ts";

/** The path of the Markdown twin of a page: its own with `.md` for `.html`. */
export const twinOf = (path: string): string => path.replace(/\.html$/, ".md");

const href = (h: Href, from: string): string => {
  if (h.kind === "external") return h.url;
  const target = twinOf(h.path);
  const up = from.split("/").length - 1;
  return `${"../".repeat(up)}${target}${h.anchor === undefined ? "" : `#${h.anchor}`}`;
};

/** Inlines as Markdown. */
export function inlinesMd(xs: readonly Inline[], from: string): string {
  return xs
    .map((i): string => {
      switch (i.kind) {
        case "text":
          return i.text;
        case "code":
          return `\`${i.text}\``;
        case "emphasis":
          return `*${inlinesMd(i.children, from)}*`;
        case "strong":
          return `**${inlinesMd(i.children, from)}**`;
        case "link":
          return `[${inlinesMd(i.children, from)}](${href(i.href, from)})`;
        default:
          return absurd(i);
      }
    })
    .join("");
}

const cell = (xs: readonly Inline[], from: string): string => inlinesMd(xs, from).replaceAll("|", "\\|").replaceAll("\n", " ");

function cards(cs: readonly Card[], from: string, depth: number): string[] {
  return cs.flatMap((c) => [
    `${"  ".repeat(depth)}- [${c.title}](${href(c.href, from)})${c.badges === undefined || c.badges.length === 0 ? "" : ` (${c.badges.map((b) => b.text).join(", ")})`}: ${inlinesMd(c.text, from)}`,
    ...cards(c.children ?? [], from, depth + 1),
  ]);
}

const tree = (ns: readonly TreeNode[], from: string, depth: number): string[] =>
  ns.flatMap((n) => [`${"  ".repeat(depth)}- \`${n.label}\`${n.note === undefined ? "" : `: ${inlinesMd(n.note, from)}`}`, ...tree(n.children, from, depth + 1)]);

function block(b: Block, from: string, level: number): string[] {
  switch (b.kind) {
    case "heading":
      return ["", `${"#".repeat(Math.min(6, b.level + level))} ${inlinesMd(b.text, from)}`, ""];
    case "paragraph":
      return [inlinesMd(b.inlines, from), ""];
    case "meta":
      return [`*${inlinesMd(b.inlines, from)}*`, ""];
    case "list":
      return [...b.items.flatMap((item, i) => {
        const lines = item.flatMap((x) => block(x, from, level)).filter((l, j, a) => !(l === "" && (j === a.length - 1 || j === 0)));
        return lines.map((l, j) => `${j === 0 ? (b.ordered ? `${i + 1}. ` : "- ") : "   "}${l}`);
      }), ""];
    case "code":
      return [...(b.title === undefined ? [] : [`*${b.title}*`, ""]), `\`\`\`${b.lang === "text" ? "" : b.lang}`, b.text, "```", ""];
    case "table":
      return b.head.length === 0 ? [] : [`| ${b.head.map((h) => cell(h, from)).join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`, ...b.rows.map((r) => `| ${r.map((c) => cell(c, from)).join(" | ")} |`), ""];
    case "callout":
      return [`> **${b.title}**`, ...b.blocks.flatMap((x) => block(x, from, level)).filter((l) => l !== "").map((l) => `> ${l}`), ""];
    case "entry":
      return ["", `${"#".repeat(Math.min(6, 3 + level))} ${b.name}${b.badges.length === 0 ? "" : ` (${b.badges.map((x) => x.text).join(", ")})`}`, "", ...(b.signature === undefined ? [] : ["```ts", b.signature, "```", ""]), ...b.blocks.flatMap((x) => block(x, from, level + 1))];
    case "tabs":
      return b.tabs.flatMap((t) => ["", `${"#".repeat(Math.min(6, 4 + level))} ${t.label}`, "", ...t.blocks.flatMap((x) => block(x, from, level + 1))]);
    case "diagram":
      return [...(b.caption === "" ? [] : [`*${b.caption}*`, ""]), "```mermaid", b.source, "```", ""];
    case "cards":
      return [...cards(b.cards, from, 0), ""];
    case "badges":
      return [b.badges.map((x) => `\`${x.text}\``).join(" "), ""];
    case "stats":
      return [b.items.map((x) => `**${x.value}** ${x.label}`).join(" · "), ""];
    case "trend":
      return [`*${b.label}: ${sparkText(b.values)} (${b.values.length === 0 ? "no runs" : `${Math.min(...b.values)} to ${Math.max(...b.values)}${b.unit === undefined ? "" : ` ${b.unit}`}, latest ${b.values[b.values.length - 1]}`})*`, ""];
    case "tree":
      return [...tree(b.nodes, from, 0), ""];
    default:
      return absurd(b);
  }
}

/**
 * A page as Markdown: its title, its description and its blocks.
 *
 * @param page - the page
 */
export function markdownOf(page: Page): string {
  const first = page.blocks[0];
  // a page whose first paragraph is its description says it once
  const repeated = first?.kind === "paragraph" && inlinesMd(first.inlines, page.path).trim() === page.description.trim();
  const lines = [`# ${page.title}`, "", ...(page.description === "" || repeated ? [] : [page.description, ""]), ...page.blocks.flatMap((b) => block(b, page.path, 0))];
  const out: string[] = [];
  for (const l of lines) if (!(l === "" && out[out.length - 1] === "")) out.push(l);
  return `${out.join("\n").trim()}\n`;
}

/**
 * The index of the site for a program, `llms.txt`: the name, what the site is, and every page as a link to its Markdown twin with its description, by section.
 *
 * @param name - the site's name
 * @param pages - the pages
 * @param extras - other files an agent is told of (the JSON of a model), by path and what they are
 */
export function llmsIndex(name: string, pages: readonly Page[], extras: readonly (readonly [path: string, what: string])[] = []): string {
  const bySection = new Map<string, Page[]>();
  for (const p of [...pages].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) bySection.set(p.section, [...(bySection.get(p.section) ?? []), p]);
  const out = [`# ${name}`, "", `> Every page of this site is also written as Markdown beside its HTML (the same path with \`.md\`), and the models as JSON. This file lists them for a program.`, ""];
  for (const [section, ps] of [...bySection].sort(([a], [b]) => (a < b ? -1 : 1))) {
    out.push(`## ${section}`, "");
    for (const p of ps) out.push(`- [${p.title}](${twinOf(p.path)})${p.description === "" ? "" : `: ${p.description.replace(/\s+/g, " ")}`}`);
    out.push("");
  }
  if (extras.length > 0) {
    out.push("## Data", "");
    for (const [path, what] of extras) out.push(`- [${path}](${path}): ${what}`);
    out.push("");
  }
  return `${out.join("\n").trimEnd()}\n`;
}
