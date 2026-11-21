// Spec: 0004-query-safety FR-001, FR-002
/**
 * What a query is allowed and what it may cost (commons anyfs-query 0004-query-safety FR-001, FR-002): the consent a place is given, the budget of a run, the way a run ends short of its end, the statistics a
 * run reports, and every way a query can fail as one value of one closed type with the span of what was wrong.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Capability, Problem } from "@intellectual-frontiers/anyfs/governance";
import type { TableName } from "./tables.ts";

/** What a query may do at a place: nothing, read what a listing says, or read the objects too. */
export type Consent = "none" | "metadata" | "content";

const RANK: Readonly<Record<Consent, number>> = { none: 0, metadata: 1, content: 2 };

/** Whether a consent given covers a consent needed. */
export const covers = (given: Consent, needed: Consent): boolean => RANK[given] >= RANK[needed];

/** The consent a table needs: `content` reads objects; the others need only what a listing says. */
export const consentFor = (table: TableName): Consent => (table === "content" ? "content" : "metadata");

/** The limits of a run: objects listed, objects read, bytes read, rows given, and the time in milliseconds. */
export type Budget = {
  readonly maxListed: number;
  readonly maxRead: number;
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly deadlineMs: number;
};

/** The budget of a run that was given none. */
export const DEFAULT_BUDGET: Budget = { maxListed: 100_000, maxRead: 1_000, maxBytes: 64 * 1024 * 1024, maxRows: 10_000, deadlineMs: 30_000 };

/** A budget of what is given over the default, or why it is not one: every limit is a whole number of at least 1. */
export function parseBudget(given: Partial<Budget>): Result<Budget, string> {
  const merged = { ...DEFAULT_BUDGET, ...given };
  for (const [name, value] of Object.entries(merged)) {
    if (!Number.isSafeInteger(value) || value < 1) return err(`the budget ${name} is ${String(value)}: a limit is a whole number of at least 1`);
  }
  return ok(merged);
}

/** The limit a run ended at, short of its end. */
export type Truncation = "listed" | "read" | "bytes" | "rows" | "deadline";

/** What a run did. */
export type Stats = { readonly listCalls: number; readonly listed: number; readonly statCalls: number; readonly read: number; readonly bytes: number };

/** Something wrong with the text of a query, with the half-open range of what it was in the text. */
export type Diagnostic = { readonly start: number; readonly end: number; readonly message: string; readonly suggestion?: string };

/** Every way a query fails. */
export type QueryProblem =
  | { readonly kind: "syntax"; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "profile"; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "names"; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "plan"; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "run"; readonly diagnostics: readonly Diagnostic[] }
  | { readonly kind: "place"; readonly place: string; readonly reason: string }
  | { readonly kind: "consent"; readonly place: string; readonly needed: Consent; readonly granted: Consent }
  | { readonly kind: "capability"; readonly place: string; readonly table: TableName; readonly needed: Capability }
  | { readonly kind: "path-needed"; readonly table: TableName; readonly why: string }
  | { readonly kind: "budget"; readonly why: string }
  | { readonly kind: "store"; readonly place: string; readonly problem: Problem };

/** The line a person reads for the position in a text: its line and column, from one. */
export function positionOf(text: string, offset: number): { readonly line: number; readonly column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < Math.min(offset, text.length); i++) {
    if (text.charAt(i) === "\n") {
      line += 1;
      column = 1;
    } else column += 1;
  }
  return { line, column };
}

/** A problem as the sentences a person reads, one to a line. */
export function describeQueryProblem(text: string, p: QueryProblem): string {
  const at = (d: Diagnostic): string => {
    const pos = positionOf(text, d.start);
    return `${pos.line}:${pos.column}: ${d.message}${d.suggestion === undefined ? "" : ` (did you mean ${d.suggestion}?)`}`;
  };
  switch (p.kind) {
    case "syntax":
    case "profile":
    case "names":
    case "plan":
    case "run":
      return p.diagnostics.map(at).join("\n");
    case "place":
      return `the place ${p.place} cannot be reached: ${p.reason}`;
    case "consent":
      return `the place ${p.place} is open to ${p.granted} and this query needs ${p.needed}`;
    case "capability":
      return `the place ${p.place} cannot answer ${p.table}: its store does not have ${p.needed}`;
    case "path-needed":
      return `${p.table} needs a path: ${p.why}`;
    case "budget":
      return p.why;
    case "store":
      return `the place ${p.place} failed: ${p.problem.kind}`;
  }
}
