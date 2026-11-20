/**
 * The findings of the `versions` tool (commons 0026-works-versioning FR-007, FR-013, FR-020, FR-022, FR-027, FR-028): the rule each belongs to and the shape every one has.
 *
 * @remarks
 * Pure data. A finding names the file it is about (a record, or `refs/tags/<tag>` for a tag), the rule, a sentence, and the work. The rules that read only a folder (a record that does not
 * decode, a version that does not match its scheme, a controlled document with no approval) are those of the rule plugin (`plugin.ts`); the others need Git and are the command's.
 *
 * @limits
 * It does not judge: `judge.ts` and `ledger.ts` do.
 *
 * @example
 * ```ts
 * import { VERSIONS_RULES } from "./rules.ts";
 * VERSIONS_RULES.includes("versions/not-grown"); // true
 * ```
 *
 * @module
 */

/** The ids of the rules of the tool. */
export type VersionsRule =
  | "versions/record-invalid"
  | "versions/scheme-mismatch"
  | "versions/approval-missing"
  | "versions/identity-changed"
  | "versions/not-grown"
  | "versions/ledger-order"
  | "versions/tag-moved"
  | "versions/tag-removed"
  | "versions/retention-early";

/** Every rule, in the order a report lists them. */
export const VERSIONS_RULES: readonly VersionsRule[] = [
  "versions/record-invalid",
  "versions/scheme-mismatch",
  "versions/approval-missing",
  "versions/identity-changed",
  "versions/not-grown",
  "versions/ledger-order",
  "versions/tag-moved",
  "versions/tag-removed",
  "versions/retention-early",
];

/** A finding: the rule, the file (or tag) it is about, the work's slug where it is known and a sentence. */
export type VersionsFinding = {
  readonly rule: VersionsRule;
  readonly file: string;
  readonly work: string;
  readonly message: string;
};

/** A finding as one line: `file: rule: message`. */
export function formatFinding(f: VersionsFinding): string {
  return `${f.file}: ${f.rule}: ${f.message}`;
}

/** Findings in a stable order: by file, then rule, then message. */
export function sortFindings(findings: readonly VersionsFinding[]): readonly VersionsFinding[] {
  return [...findings].sort((a, b) => cmp(a.file, b.file) || cmp(a.rule, b.rule) || cmp(a.message, b.message));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
