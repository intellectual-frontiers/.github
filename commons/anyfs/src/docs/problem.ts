// Spec: 0006-anyfs-documents FR-006
/**
 * What a collection reports when it does not do what it was asked: a closed union, each a value with one sentence. A problem of the store is carried as it was, so that a conflict of a put is the conflict
 * of the store and a caller reads one kind of conflict. What a listing finds wrong with an object is a finding, listed beside the good documents, never a failure of the listing.
 *
 * @example
 * ```ts
 * import { describeDocProblem } from "./problem.ts";
 * describeDocProblem({ kind: "bad-key", detail: "x is not an identifier" }); // "the key has no path: x is not an identifier"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { describeProblem, type Path, type Problem } from "@intellectual-frontiers/anyfs/governance";
import type { CodecReason } from "./codec.ts";

/** What a collection reports: a closed union of six kinds. */
export type DocProblem =
  | { readonly kind: "store"; readonly problem: Problem }
  | { readonly kind: "undecodable"; readonly path: Path; readonly reason: CodecReason; readonly detail: string }
  | { readonly kind: "unencodable"; readonly detail: string }
  | { readonly kind: "bad-key"; readonly detail: string }
  | { readonly kind: "exhausted"; readonly path: Path; readonly attempts: number }
  | { readonly kind: "refused"; readonly detail: string };

/** A problem of the store. */
export const storeProblem = (problem: Problem): DocProblem => ({ kind: "store", problem });

/** What a listing found about an object that is not a good document of the collection. */
export type Finding =
  | { readonly kind: "foreign"; readonly path: Path; readonly detail: string }
  | { readonly kind: "undecodable"; readonly path: Path; readonly reason: CodecReason; readonly detail: string }
  | { readonly kind: "unreadable"; readonly path: Path; readonly problem: Problem };

/** A problem as one sentence. */
export function describeDocProblem(problem: DocProblem): string {
  switch (problem.kind) {
    case "store":
      return describeProblem(problem.problem);
    case "undecodable":
      return `${problem.path} cannot be read as a document (${problem.reason}): ${problem.detail}`;
    case "unencodable":
      return `the value cannot be written as a document: ${problem.detail}`;
    case "bad-key":
      return `the key has no path: ${problem.detail}`;
    case "exhausted":
      return `${problem.path} changed under every one of ${problem.attempts} attempts to update it`;
    case "refused":
      return `refused: ${problem.detail}`;
    default:
      return absurd(problem);
  }
}

/** A finding as one sentence. */
export function describeFinding(finding: Finding): string {
  switch (finding.kind) {
    case "foreign":
      return `${finding.path} is not a document of the collection: ${finding.detail}`;
    case "undecodable":
      return `${finding.path} cannot be read as a document (${finding.reason}): ${finding.detail}`;
    case "unreadable":
      return `${finding.path} could not be read: ${describeProblem(finding.problem)}`;
    default:
      return absurd(finding);
  }
}
