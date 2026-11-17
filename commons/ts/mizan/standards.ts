/**
 * The standards-first rules about terms (commons 0018-standards-first FR-003 to FR-005): a term that rests on a standard names its term, an `unaligned` term carries a
 * justification, and its decision is due within 90 days of the day the term was added: within the 90 days its absence is a finding the baseline may hold, after them it is a
 * finding that fails whatever the baseline holds.
 *
 * @remarks
 * Pure functions over the records of terms and a day (`YYYY-MM-DD`), so that the answer does not depend on the clock. The days are counted between calendar dates in UTC.
 *
 * @limits
 * It reads the records a harness gives it: whether a harness's own decision record exists is that harness's to say (the `decision` field is true where a `Decision` is linked).
 *
 * @example
 * ```ts
 * import { termFindings } from "./standards.ts";
 * termFindings([{ iri: "https://x/T", basis: "unaligned", justification: "none found", addedOn: "2026-01-01", decision: false }], "2026-06-01").map((f) => f.rule);
 * // ["mizan/decision-overdue"]
 * ```
 *
 * @module
 */
import type { MizanFinding, MizanRule } from "./rules.ts";

/** The days a decision may follow the term that needs it (0018-standards-first FR-005). */
export const GRACE_DAYS = 90;

/** How a term relates to a standard (0018-standards-first FR-003). */
export type BasisKind = "adopts" | "specializes" | "maps" | "unaligned";

/** A term of an ontology and what it rests on, as the rules read it. */
export type TermRecord = {
  readonly iri: string;
  readonly basis: BasisKind;
  /** The IRI of the standard's term, for a term that has one. */
  readonly standardTerm?: string;
  /** Why no standard names the term, for an `unaligned` one. */
  readonly justification?: string;
  /** The day (`YYYY-MM-DD`) the term was added, from which its decision is due. */
  readonly addedOn?: string;
  /** Whether a `Decision` is linked to the term. */
  readonly decision: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The whole days from one `YYYY-MM-DD` to another, or `undefined` where either is not a day. */
export function daysBetween(from: string, to: string): number | undefined {
  if (!DAY.test(from) || !DAY.test(to)) return undefined;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isNaN(a) || Number.isNaN(b) ? undefined : Math.round((b - a) / 86_400_000);
}

function found(rule: MizanRule, file: string, iri: string, message: string): MizanFinding {
  return { file, line: 1, rule, message, key: `${rule} ${iri}` };
}

/** The findings of the rules about terms, as of `today`; `file` is where the terms are stated. */
export function termFindings(terms: readonly TermRecord[], today: string, file = "ontology"): readonly MizanFinding[] {
  const out: MizanFinding[] = [];
  for (const t of terms) {
    if (t.basis !== "unaligned") {
      if ((t.standardTerm ?? "") === "")
        out.push(found("mizan/term-standard", file, t.iri, `${t.iri} is ${t.basis} and names no standard term`));
      continue;
    }
    if ((t.justification ?? "") === "")
      out.push(found("mizan/unaligned-justification", file, t.iri, `${t.iri} is unaligned and says why no standard names it`));
    if (t.decision) continue;
    const age = t.addedOn === undefined ? undefined : daysBetween(t.addedOn, today);
    if (age === undefined)
      out.push(
        found(
          "mizan/decision-missing",
          file,
          t.iri,
          `${t.iri} is unaligned, has no decision and no day it was added, from which its decision is due`,
        ),
      );
    else if (age > GRACE_DAYS)
      out.push(found("mizan/decision-overdue", file, t.iri, `${t.iri} is unaligned and its decision was due ${age - GRACE_DAYS} days ago`));
    else
      out.push(found("mizan/decision-missing", file, t.iri, `${t.iri} is unaligned and its decision is due in ${GRACE_DAYS - age} days`));
  }
  return out;
}
