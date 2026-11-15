/**
 * The search index of the site (commons 0011-documentation FR-017): one row for each page, heading and entry (an export, a requirement, a
 * table or a column), as `[title, address, where, kind]`, which the site's script loads from `search.json` when a reader first searches.
 *
 * @module
 */
import type { Block, Page } from "../model.ts";
import { plain } from "../model.ts";
import { SECTIONS } from "./html.ts";

/** A row of the index: what to show, where it goes from the site's root, where it is, and what kind of thing it is. */
export type SearchRow = readonly [title: string, url: string, where: string, kind: string];

function walk(bs: readonly Block[], page: Page, where: string, out: SearchRow[]): void {
  for (const b of bs) {
    if (b.kind === "heading") out.push([plain(b.text), `${page.path}#${b.id}`, where, "Section"]);
    else if (b.kind === "entry") {
      out.push([b.name, `${page.path}#${b.id}`, where, b.badges[0]?.text ?? "Entry"]);
      walk(b.blocks, page, where, out);
    } else if (b.kind === "tabs") for (const t of b.tabs) walk(t.blocks, page, where, out);
  }
}

/**
 * The index of every page, in the order of the pages.
 *
 * @param pages - the pages of the site
 */
export function searchIndex(pages: readonly Page[]): SearchRow[] {
  const out: SearchRow[] = [];
  for (const p of pages) {
    const section = SECTIONS.find((s) => s.section === p.section)?.label ?? p.section;
    out.push([p.title, p.path, `${section} › ${p.group}`, "Page"]);
    walk(p.blocks, p, `${section} › ${p.title}`, out);
  }
  return out;
}
