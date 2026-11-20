// Spec: 0003-grc-logical FR-001, FR-002
/**
 * The documents of the logical layer (0003-grc-logical): result, finding, evidence, attestation, assessment, risk, a ledger entry and an evidence manifest, each a kind of the envelope; the
 * statuses a result may have and the order in which they join.
 *
 * @remarks
 * The status `gap` (a control that nothing shows) and `pending` (a question a person has not yet answered) are `unaligned`: no outside standard defines them.
 *
 * @module
 */
import { array, type Decoded, integer, literal, object, string } from "@intellectual-frontiers/core";
import {
  check,
  defineKind,
  exception,
  framework,
  instant,
  jsonData,
  LEVELS,
  policy,
  SEVERITIES,
} from "@intellectual-frontiers/grc/governance";

/** A status, from the one that says least to the one that says most (the order of `join`). */
export const STATUSES = ["not-applicable", "pass", "accepted", "pending", "warn", "gap", "fail", "error"] as const;
/** A status. */
export type Status = (typeof STATUSES)[number];
const status = literal(...STATUSES);
const severity = literal(...SEVERITIES);

/** What a check run on a subject gave. */
export const result = defineKind(
  "grc.result",
  "1",
  {
    check: string,
    controls: array(string),
    subject: string,
    status,
    severity,
    reason: string,
    observedAt: instant,
  },
  { value: jsonData, via: string, policy: string, exception: string, was: status },
);
/** A result. */
export type Result = Decoded<typeof result.decode>;

/** A result that needs attention. */
export const finding = defineKind(
  "grc.finding",
  "1",
  {
    result: string,
    check: string,
    controls: array(string),
    subject: string,
    status,
    severity,
    title: string,
    detail: string,
    evidence: array(string),
  },
  { remediation: string, exception: string },
);
/** A finding. */
export type Finding = Decoded<typeof finding.decode>;

/** What was observed, kept by digest. */
export const evidence = defineKind(
  "grc.evidence",
  "1",
  { subject: string, type: string, digest: string, mediaType: string, size: integer, observedAt: instant },
  { store: string, producer: string },
);
/** An item of evidence. */
export type Evidence = Decoded<typeof evidence.decode>;

/** A person or key states something about a subject. */
export const attestation = defineKind(
  "grc.attestation",
  "1",
  { subject: string, check: string, claim: literal("pass", "fail"), statement: string, attester: string, role: string, evidence: array(string) },
  { signature: string, signer: string },
);
/** An attestation. */
export type Attestation = Decoded<typeof attestation.decode>;

/** A risk. */
export const risk = defineKind(
  "grc.risk",
  "1",
  {
    title: string,
    description: string,
    likelihood: literal(...LEVELS),
    impact: literal(...LEVELS),
    level: literal(...LEVELS),
    treatment: literal("accept", "mitigate", "transfer", "avoid"),
    owner: string,
    reviewBy: instant,
    controls: array(string),
  },
  {},
);
/** A risk. */
export type Risk = Decoded<typeof risk.decode>;

/** An assessment: what was judged, with what, and what it gave, self-contained so that a serializer needs nothing else. */
export const assessment = defineKind(
  "grc.assessment",
  "1",
  {
    title: string,
    frameworks: array(framework.decode),
    results: array(result.decode),
    findings: array(finding.decode),
    evidence: array(evidence.decode),
    attestations: array(attestation.decode),
    exceptions: array(exception.decode),
    risks: array(risk.decode),
  },
  { policies: array(policy.decode), checks: array(check.decode) },
);
/** An assessment. */
export type Assessment = Decoded<typeof assessment.decode>;

/** An entry of a hash-chained ledger. */
export const ledgerEntry = defineKind("grc.ledger-entry", "1", {
  seq: integer,
  previous: string,
  type: string,
  subject: string,
  evidence: string,
  digest: string,
});
/** A ledger entry. */
export type LedgerEntry = Decoded<typeof ledgerEntry.decode>;

/** The manifest of an evidence bundle: what it holds by digest, and where the ledger stood. */
export const evidenceManifest = defineKind("grc.evidence-manifest", "1", {
  items: array(object({ digest: string, size: integer, mediaType: string })),
  ledgerHead: string,
});
/** An evidence manifest. */
export type EvidenceManifest = Decoded<typeof evidenceManifest.decode>;
