// Spec: 0003-grc-logical FR-002, FR-009
/**
 * Making the documents that come out of a run: the findings of a set of results and the assessment that holds them. Pure: the time and the id are given.
 *
 * @example
 * ```ts
 * import { findingsOf } from "./assemble.ts";
 * findingsOf([]); // []
 * ```
 *
 * @module
 */
import { type Check, type EvidencePolicy, type Exception, type Framework, type Policy, provenanceOf } from "@intellectual-frontiers/grc/governance";
import { applyExceptions, newestResults } from "./compute.ts";
import type { Assessment, Attestation, Evidence, Finding, Result, Risk } from "./kinds.ts";

/** Whether a status needs attention. */
function needsAttention(status: Result["status"]): boolean {
  return status === "fail" || status === "error" || status === "gap" || status === "warn" || status === "pending";
}

/** A finding for each result that needs attention, in the order of the results; the evidence of its subject is named. */
export function findingsOf(results: readonly Result[], evidence: readonly Evidence[] = []): readonly Finding[] {
  return results
    .filter((r) => needsAttention(r.status))
    .map((r) => ({
      kind: "grc.finding",
      schema: "1",
      id: `finding:${r.id}`,
      createdAt: r.observedAt,
      provenance: provenanceOf([r.id]),
      result: r.id,
      check: r.check,
      controls: r.controls,
      subject: r.subject,
      status: r.status,
      severity: r.severity,
      title: `${r.check} on ${r.subject}: ${r.status}`,
      detail: r.reason,
      evidence: evidence.filter((e) => e.subject === r.subject).map((e) => e.id),
    }));
}

/** What an assessment is made from. */
export type AssessmentInput = {
  readonly id: string;
  readonly title: string;
  readonly at: string;
  readonly frameworks: readonly Framework[];
  readonly results: readonly Result[];
  readonly evidence?: readonly Evidence[];
  readonly attestations?: readonly Attestation[];
  readonly exceptions?: readonly Exception[];
  readonly risks?: readonly Risk[];
  readonly checks?: readonly Check[];
  readonly policies?: readonly Policy[];
  readonly evidencePolicy?: EvidencePolicy;
};

/** The assessment: the newest result of each check on each subject with the exceptions that apply at `at` applied, and a finding for each that needs attention. */
export function assess(input: AssessmentInput): Assessment {
  const results = applyExceptions(newestResults(input.results), input.exceptions ?? [], input.at);
  const evidence = input.evidence ?? [];
  return {
    kind: "grc.assessment",
    schema: "1",
    id: input.id,
    createdAt: input.at,
    provenance: provenanceOf(results.map((r) => r.id)),
    title: input.title,
    frameworks: input.frameworks,
    results,
    findings: findingsOf(results, evidence),
    evidence,
    attestations: input.attestations ?? [],
    exceptions: input.exceptions ?? [],
    risks: input.risks ?? [],
    ...(input.policies === undefined ? {} : { policies: input.policies }),
    ...(input.checks === undefined ? {} : { checks: input.checks }),
  };
}
