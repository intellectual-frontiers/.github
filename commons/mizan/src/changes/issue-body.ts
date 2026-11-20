/**
 * The body of a capability's change request as the check reads it (commons 0020-ifccm FR-003, FR-004, FR-006): its sections `Why`, `Today`, `Scope` and `Done when` in that order,
 * its checkbox items (`- [ ]`, `- [x]`) and the requirements its `Done when` names (`NNNN-slug FR-nnn`).
 *
 * @remarks
 * A section is a Markdown heading of any level whose text is the section's name (a trailing colon is allowed, case is not significant) and the lines under it up to the next heading of the
 * same or a higher level. Lines inside a fenced code block are not read. The body is the text a Git host gives for an issue, so that a GitHub issue and a GitLab issue read the same.
 *
 * @limits
 * It does not decide that a `Done when` is met: a person ticks it, and the check only reads whether it is ticked.
 *
 * @example
 * ```ts
 * import { parseIssueBody, unticked } from "./issue-body.ts";
 * const body = parseIssueBody("## Why\nx\n## Done when\n- [x] 0020-ifccm FR-005 by the test\n- [ ] 0020-ifccm FR-006\n");
 * unticked(body).length; // 1
 * ```
 *
 * @module
 */

/** The sections of a capability's change request, in order (0020-ifccm FR-003). */
export const SECTIONS = ["Why", "Today", "Scope", "Done when"] as const;

/** The name of one of those sections. */
export type SectionName = (typeof SECTIONS)[number];

/** A section of a body: its heading as written, its level, its line, the line after its last (`end`) and the text under it. */
export type Section = { readonly name: string; readonly level: number; readonly line: number; readonly end: number; readonly text: string };

/** A checkbox item: its text, whether it is ticked, its line and the section it is under (none before the first heading). */
export type CheckItem = { readonly text: string; readonly checked: boolean; readonly line: number; readonly section: string | undefined };

/** A body as the check reads it. */
export type IssueBody = { readonly sections: readonly Section[]; readonly items: readonly CheckItem[] };

/** What is wrong with a capability's sections: one missing, or two out of order. */
export type SectionProblem =
  | { readonly kind: "missing"; readonly name: SectionName }
  | { readonly kind: "order"; readonly name: SectionName; readonly before: SectionName };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ITEM = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;

/** A body read: its sections, and every checkbox item with the section it is under. */
export function parseIssueBody(body: string): IssueBody {
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const heads: { readonly name: string; readonly level: number; readonly line: number }[] = [];
  const items: CheckItem[] = [];
  const inFence: boolean[] = [];
  let fenced = false;
  for (const [i, line] of lines.entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      inFence.push(true);
      continue;
    }
    inFence.push(fenced);
    if (fenced) continue;
    const h = HEADING.exec(line);
    if (h?.[1] !== undefined) {
      heads.push({ name: (h[2] ?? "").replace(/:$/, "").trim(), level: h[1].length, line: i + 1 });
      continue;
    }
    const it = ITEM.exec(line);
    if (it !== null)
      items.push({ text: (it[2] ?? "").trim(), checked: it[1] !== " ", line: i + 1, section: heads[heads.length - 1]?.name });
  }
  const sections: Section[] = heads.map((h, k) => {
    const end = heads.slice(k + 1).find((n) => n.level <= h.level)?.line ?? lines.length + 1;
    return {
      ...h,
      end,
      text: lines
        .slice(h.line, end - 1)
        .join("\n")
        .trim(),
    };
  });
  return { sections, items };
}

/** The section called `name` (case does not matter), or undefined. */
export function sectionOf(body: IssueBody, name: SectionName): Section | undefined {
  return body.sections.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

/** What is wrong with the four sections a capability's change request must have, in order (0020-ifccm FR-003). */
export function sectionProblems(body: IssueBody): readonly SectionProblem[] {
  const out: SectionProblem[] = [];
  let last: { readonly name: SectionName; readonly line: number } | undefined;
  for (const name of SECTIONS) {
    const s = sectionOf(body, name);
    if (s === undefined) {
      out.push({ kind: "missing", name });
      continue;
    }
    if (last !== undefined && s.line < last.line) out.push({ kind: "order", name, before: last.name });
    else last = { name, line: s.line };
  }
  return out;
}

/** The items that are not ticked, in the order of the body. */
export function unticked(body: IssueBody): readonly CheckItem[] {
  return body.items.filter((i) => !i.checked);
}

/** The items under `Done when`, in order. */
export function doneWhenItems(body: IssueBody): readonly CheckItem[] {
  const s = sectionOf(body, "Done when");
  return s === undefined ? [] : body.items.filter((i) => i.line > s.line && i.line < s.end);
}

const SPEC = String.raw`(\d{3,4}-[a-z][a-z0-9-]*)`;
const LIST = String.raw`FR-\d{3}[a-z]?(?:\s*(?:,|and|to)\s*FR-\d{3}[a-z]?)*`;

/** The requirements a text names, `NNNN-slug FR-nnn` each once: `0020-ifccm FR-005, FR-007 to FR-009` gives FR-005, FR-007, FR-008 and FR-009. */
export function requirementsIn(text: string): readonly string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`${SPEC}\\s+(${LIST})`, "g"))) {
    const slug = m[1] ?? "";
    const tokens = [...(m[2] ?? "").matchAll(/(,|and|to)|FR-(\d{3})([a-z]?)/g)];
    let join: string | undefined;
    let prev: number | undefined;
    for (const t of tokens) {
      if (t[1] !== undefined) {
        join = t[1];
        continue;
      }
      const n = Number(t[2]);
      const suffix = t[3] ?? "";
      if (join === "to" && prev !== undefined && suffix === "" && n > prev)
        for (let k = prev + 1; k < n; k++) out.add(`${slug} FR-${String(k).padStart(3, "0")}`);
      out.add(`${slug} FR-${t[2] ?? ""}${suffix}`);
      prev = suffix === "" ? n : undefined;
    }
  }
  return [...out];
}

/** The requirements the `Done when` section names (0020-ifccm FR-003). */
export function doneWhenRequirements(body: IssueBody): readonly string[] {
  const s = sectionOf(body, "Done when");
  return s === undefined ? [] : requirementsIn(s.text);
}
