// Spec: 0003-planning-reconcile FR-013
/**
 * The matrix of what each source can hold (0037-planning FR-015): each field of an item ends, for each source, expressed (the place holds it), carried (it travels in a form the place keeps) or unexpressed with a
 * reason; a field with none is a finding that names the field and the source. A source declares its row; the fields are the one list here, so a field added to an item is a finding until each source says how it ends.
 *
 * @example
 * ```ts
 * import { FIELDS, matrixFindings } from "./matrix.ts";
 * matrixFindings([{ source: "x", cells: {} }]).length === FIELDS.length; // true
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** The fields of an item that a source holds or does not: the core and what a source carries. */
export const FIELDS = [
  "id", "kind", "title", "body", "labels", "assignees", "severity", "origin", "external", "links", "state", "comments", "decisions", "events", "principal",
  "sourceSeverity", "motivation", "blocker", "target", "source", "priority", "size", "goals", "engines", "cites", "evidence", "raised",
] as const;
/** One field. */
export type Field = (typeof FIELDS)[number];

/** How a field ends for a source. */
export type Cell = { readonly outcome: "expressed" } | { readonly outcome: "carried"; readonly how: string } | { readonly outcome: "unexpressed"; readonly reason: string };

/** The row of one source: its cells by field. */
export type SourceRow = { readonly source: string; readonly cells: { readonly [F in Field]?: Cell } };

/** A field that ends in none, for a source. */
export type DroppedFinding = { readonly code: "planning/dropped"; readonly source: string; readonly field: Field };

/** A sentence for a cell. */
export function describeCell(c: Cell | undefined): string {
  if (c === undefined) return "dropped";
  switch (c.outcome) {
    case "expressed":
      return "expressed";
    case "carried":
      return `carried (${c.how})`;
    case "unexpressed":
      return `unexpressed (${c.reason})`;
    default:
      return absurd(c);
  }
}

/** Every field a source gives no cell, or an unexpressed one with no reason: a finding for each. */
export function matrixFindings(rows: readonly SourceRow[]): readonly DroppedFinding[] {
  return rows.flatMap((r) =>
    FIELDS.filter((f) => {
      const c = r.cells[f];
      return c === undefined || (c.outcome === "unexpressed" && c.reason.trim() === "") || (c.outcome === "carried" && c.how.trim() === "");
    }).map((field): DroppedFinding => ({ code: "planning/dropped", source: r.source, field })),
  );
}

/** The matrix as a Markdown table: a row for each field, a column for each source. */
export function matrixMarkdown(rows: readonly SourceRow[]): string {
  const head = `| field | ${rows.map((r) => r.source).join(" | ")} |`;
  const rule = `| --- | ${rows.map(() => "---").join(" | ")} |`;
  const body = FIELDS.map((f) => `| ${f} | ${rows.map((r) => describeCell(r.cells[f])).join(" | ")} |`);
  return `${[head, rule, ...body].join("\n")}\n`;
}
