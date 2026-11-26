// Spec: 0019-grc-access-decision FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The access decision (commons 0047-zero-trust FR-010): the record of one decision about one request, with the subject, the posture signals it used, the resource and the action, the access policy by hash, the outcome and the reasons, and the time it was
 * decided; and the pure computations over decisions that the evidence plane of zero trust needs: the digest that a signature covers, the signals that had aged, the replay of recorded decisions against a candidate policy, and the time from a revocation to each refusal.
 *
 * @remarks
 * A decision is evidence, so it is a document of the envelope and is signed by the signers `grc` already has; no second record and no second signature are made. The policy that decided is named by id and hash and is not evaluated here: the evaluation is the policy library's
 * (commons 0047-zero-trust FR-013), and replay takes the candidate's verdicts as a function. Nothing here reads a clock.
 *
 * @module
 */
import { array, type Decoded, literal, object, string } from "@intellectual-frontiers/core";
import { defineKind, instant, instantMs } from "@intellectual-frontiers/grc/governance";
import { digestOf } from "./canonical.ts";

/** The kinds of subject that ask for access (commons 0047-zero-trust FR-010). */
export const SUBJECT_KINDS = ["person", "service", "device", "agent"] as const;
/** A kind of subject. */
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/** The outcomes of a decision. */
export const OUTCOMES = ["permit", "deny", "step-up", "revoke"] as const;
/** An outcome. */
export type Outcome = (typeof OUTCOMES)[number];

const signal = object({ name: string, source: string, observedAt: instant, digest: string });
/** A posture signal that a decision used: what it said, where it came from, when it was observed and the digest of the value used (commons 0047-zero-trust FR-011). */
export type PostureSignal = Decoded<typeof signal>;

/** What is wrong with a decision as a whole, or nothing (FR-002, FR-003). */
function problem(d: {
  readonly subject: { readonly kind: SubjectKind };
  readonly outcome: Outcome;
  readonly reasons: readonly string[];
  readonly signals: readonly PostureSignal[];
  readonly decidedAt: string;
  readonly expiresAt?: string | undefined;
  readonly revokes?: string | undefined;
  readonly actingFor?: unknown;
}): string | undefined {
  const at = instantMs(d.decidedAt);
  if (d.outcome === "permit" || d.outcome === "step-up") {
    const end = d.expiresAt === undefined ? undefined : instantMs(d.expiresAt);
    if (end === undefined || at === undefined || end <= at) return "a permit or a step-up that expires after it was decided";
  }
  if ((d.outcome === "deny" || d.outcome === "step-up") && d.reasons.every((r) => r.trim() === "")) return "a refusal or a step-up with at least one reason";
  if (d.outcome === "revoke" && (d.revokes === undefined || d.revokes === "")) return "a revocation that names the decision it ends";
  if (d.subject.kind === "agent" && d.actingFor === undefined) return "an agent that names the person and the plan it acts for";
  for (const s of d.signals) {
    const seen = instantMs(s.observedAt);
    if (seen === undefined || (at !== undefined && seen > at)) return "signals observed no later than the decision";
  }
  return undefined;
}

/** The record of one decision about one request. */
export const accessDecision = defineKind(
  "grc.access-decision",
  "1",
  {
    subject: object({ kind: literal(...SUBJECT_KINDS), id: string }),
    resource: string,
    action: string,
    policy: object({ id: string, hash: string }),
    outcome: literal(...OUTCOMES),
    reasons: array(string),
    signals: array(signal),
    channel: string,
    decidedAt: instant,
    decidedBy: string,
  },
  {
    actingFor: object({ person: string, plan: string }),
    expiresAt: instant,
    enforcedAt: string,
    revokes: string,
    evidence: string,
    signature: string,
    signer: string,
  },
  (value) => problem(value),
);
/** An access decision. */
export type AccessDecision = Decoded<typeof accessDecision.decode>;

/** The digest a signature of a decision covers: the SHA-256 of its canonical form without its signature and its signer, so the same decision has the same digest signed or not (FR-004). */
export function decisionDigest(decision: AccessDecision) {
  const { signature: _signature, signer: _signer, ...unsigned } = decision;
  return digestOf(unsigned);
}

/** The signals of a decision that were older than `maxAgeMs` when it was decided (FR-005): a decision that permitted on one is a finding. */
export function agedSignals(decision: AccessDecision, maxAgeMs: number): readonly PostureSignal[] {
  const at = instantMs(decision.decidedAt) ?? 0;
  return decision.signals.filter((s) => at - (instantMs(s.observedAt) ?? at) > maxAgeMs);
}

/** What a candidate policy says of a recorded request. */
export type Verdict = { readonly outcome: Outcome; readonly reasons: readonly string[] };

/** What replay found (FR-006): the decisions whose outcome would change, and how many would not. */
export type Replay = {
  readonly permitsBecomeDenials: readonly { readonly decision: AccessDecision; readonly verdict: Verdict }[];
  readonly denialsBecomePermits: readonly { readonly decision: AccessDecision; readonly verdict: Verdict }[];
  readonly unchanged: number;
};

const permits = (o: Outcome): boolean => o === "permit";

/** Evaluates the recorded decisions against a candidate policy given as a function of the decision, in the order they are given, and reports what would change; it writes nothing and enforces nothing (commons 0047-zero-trust FR-043). */
export function replayAgainst(decisions: readonly AccessDecision[], candidate: (decision: AccessDecision) => Verdict): Replay {
  const permitsBecomeDenials: { decision: AccessDecision; verdict: Verdict }[] = [];
  const denialsBecomePermits: { decision: AccessDecision; verdict: Verdict }[] = [];
  let unchanged = 0;
  for (const decision of decisions) {
    const verdict = candidate(decision);
    if (permits(decision.outcome) && !permits(verdict.outcome)) permitsBecomeDenials.push({ decision, verdict });
    else if (!permits(decision.outcome) && permits(verdict.outcome)) denialsBecomePermits.push({ decision, verdict });
    else unchanged += 1;
  }
  return { permitsBecomeDenials, denialsBecomePermits, unchanged };
}

/** One refusal at one enforcement point. */
export type Refusal = { readonly point: string; readonly at: string };

/** The time from a revocation to the first refusal at each named enforcement point (FR-007): `undefined` for a point that has not refused at or after the revocation. */
export function timeToRefusal(revokedAt: string, refusals: readonly Refusal[], points: readonly string[]): readonly { readonly point: string; readonly ms: number | undefined }[] {
  const from = instantMs(revokedAt);
  return points.map((point) => {
    const times = refusals
      .filter((r) => r.point === point)
      .map((r) => instantMs(r.at))
      .filter((t): t is number => t !== undefined && from !== undefined && t >= from);
    return { point, ms: times.length === 0 || from === undefined ? undefined : Math.min(...times) - from };
  });
}
