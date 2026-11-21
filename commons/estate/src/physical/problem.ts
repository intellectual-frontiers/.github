// Spec: 0006-estate-fleet-store FR-008
/**
 * What a fleet store reports (commons estate 0006-estate-fleet-store): a closed union of the ways it does not do what it was asked, each with the facts a person needs, and the sentence for each. A
 * problem of a document or of the store below it is carried as it is; the rules of the estate and the identity of the store are the fleet's own.
 *
 * @example
 * ```ts
 * import { describeFleetProblem } from "./problem.ts";
 * describeFleetProblem({ kind: "no-manifest" }); // "the store holds no manifest: open it with create to make a fleet store of it"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { describeDocProblem, type DocProblem } from "@intellectual-frontiers/anyfs/docs";
import type { MirrorProblem } from "@intellectual-frontiers/anyfs-bridge/mirror";

/** Why a fleet store could not be opened or did not do what it was asked. */
export type FleetProblem =
  /** A document or the store below it said no (a conflict, a refusal, an outage, a document that cannot be read). */
  | { readonly kind: "documents"; readonly problem: DocProblem }
  /** The store holds no manifest and was not opened to make one. */
  | { readonly kind: "no-manifest" }
  /** The store is kept at a newer schema than this code reads. */
  | { readonly kind: "newer-schema"; readonly found: number; readonly reads: number }
  /** The store is kept in a layout this code does not name. */
  | { readonly kind: "other-layout"; readonly found: number; readonly names: number }
  /** The store is another fleet's than the one asked for. */
  | { readonly kind: "other-fleet"; readonly asked: string; readonly found: string }
  /** What was given is not what the estate accepts: each reason is a sentence. */
  | { readonly kind: "refused"; readonly reasons: readonly string[] }
  /** An observation of that asset at that instant is kept and says something else. */
  | { readonly kind: "exists"; readonly path: string }
  /** The mirror said no. */
  | { readonly kind: "mirror"; readonly problem: MirrorProblem }
  /** The fleet store was opened with no replicas, so it has no mirror to ask. */
  | { readonly kind: "no-mirror" }
  /** The replica asked about is not one of this store's, or it keeps no history. */
  | { readonly kind: "no-history"; readonly replica: string };

/** A problem of a document, as a fleet problem. */
export const documentsProblem = (problem: DocProblem): FleetProblem => ({ kind: "documents", problem });

/** A problem as one sentence. */
export function describeFleetProblem(problem: FleetProblem): string {
  switch (problem.kind) {
    case "documents":
      return describeDocProblem(problem.problem);
    case "no-manifest":
      return "the store holds no manifest: open it with create to make a fleet store of it";
    case "newer-schema":
      return `the store is kept at schema ${problem.found}, and this code reads up to ${problem.reads}`;
    case "other-layout":
      return `the store is kept in layout ${problem.found}, and this code names layout ${problem.names}`;
    case "other-fleet":
      return `the store is the fleet ${problem.found}, and ${problem.asked} was asked for`;
    case "refused":
      return `refused: ${problem.reasons.join("; ")}`;
    case "exists":
      return `${problem.path} is kept and says something else: an observation is written once`;
    case "mirror":
      return `the mirror said no: ${problem.problem.kind}`;
    case "no-mirror":
      return "this fleet store has no replicas, so there is no mirror to ask";
    case "no-history":
      return `the replica ${problem.replica} is not one of this store's, or it keeps no history`;
    default:
      return absurd(problem);
  }
}
