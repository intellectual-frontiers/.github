/**
 * Agents that perform reviews, and the person who samples them (commons 0021-ifqs FR-041): an agent MAY perform a `Review` mechanism, which is
 * graded as FR-024 says (no higher than `E2`, below a test run's `E3`), and a person MUST sample the agents' reviews at a rate the harness
 * states. The sample and the person's verdicts are the chained records of FR-038; this file judges them.
 *
 * - A review by an agent is **covered** when it is an item of a sample of the subject `agent-reviews` that a person attested.
 * - The harness's **rate** says how many of the agents' reviews a person has to have sampled: `ceil(rate * reviews)`; fewer is owed.
 * - A sampled review the person judged `fail` is **contradicted**: it no longer stands as evidence, and the finding names it.
 *
 * @remarks
 * Pure: it reads the ledger's events (to know which record is an agent's review and what it reviews) and the samples folded from them.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import type { LedgerEvent } from "../pure/ledger.ts";
import { type Assurance, recordId } from "./rules.ts";

/** An agent's review as the ledger holds it. */
export type AgentReview = { readonly id: string; readonly requirement: string; readonly who: string; readonly day: string };

/** The reviews that agents made, in the order they were kept. */
export function agentReviews(events: readonly LedgerEvent[]): readonly AgentReview[] {
  return events.flatMap((e, i) =>
    e.kind === "review" && e.by === "agent" ? [{ id: recordId(i + 1, e.kind), requirement: e.requirement, who: e.who, day: e.day }] : [],
  );
}

/** What is wrong with the sampling of the agents' reviews. */
export type AgentFinding =
  | {
      readonly kind: "sampling-owed";
      readonly reviews: number;
      readonly sampled: number;
      readonly needed: number;
      readonly ratePermille: number;
    }
  | {
      readonly kind: "contradicted";
      readonly review: string;
      readonly requirement: string;
      readonly person: string;
      readonly sample: string;
    }
  | { readonly kind: "not-attested"; readonly sample: string };

/** A finding as one sentence. */
export function formatAgentFinding(f: AgentFinding): string {
  switch (f.kind) {
    case "sampling-owed":
      return `${f.reviews} reviews were made by agents and ${f.sampled} were sampled by a person: at ${f.ratePermille} in a thousand ${f.needed} are owed`;
    case "contradicted":
      return `${f.person} judged the agent's review ${f.review} of ${f.requirement} not to hold (${f.sample}): it no longer stands as evidence`;
    case "not-attested":
      return `${f.sample} was drawn from the agents' reviews and no person has attested it`;
    default:
      return absurd(f);
  }
}

/** Where the sampling of the agents' reviews stands. */
export type AgentStanding = {
  readonly reviews: number;
  /** How many of them an attested sample holds. */
  readonly sampled: number;
  /** How many a person judged to hold, and not. */
  readonly passed: number;
  readonly failed: number;
  readonly ratePermille: number;
  readonly needed: number;
  readonly findings: readonly AgentFinding[];
  /** The reviews no longer standing as evidence. */
  readonly contradicted: readonly AgentReview[];
};

/** The sampling of the agents' reviews against the rate the harness states (FR-041). */
export function agentStanding(events: readonly LedgerEvent[], a: Assurance, ratePermille: number): AgentStanding {
  const reviews = agentReviews(events);
  const findings: AgentFinding[] = [];
  const verdicts = new Map<string, { readonly verdict: "pass" | "fail"; readonly person: string; readonly sample: string }>();
  for (const s of a.samples) {
    if (s.subject !== "agent-reviews") continue;
    if (s.attested === undefined) {
      findings.push({ kind: "not-attested", sample: s.id });
      continue;
    }
    for (const r of s.attested.results) verdicts.set(r.item, { verdict: r.verdict, person: s.attested.person.name, sample: s.id });
  }
  const known = new Set(reviews.map((r) => r.id));
  const mine = [...verdicts].filter(([item]) => known.has(item));
  const needed = Math.ceil((reviews.length * ratePermille) / 1000);
  const contradicted = reviews.filter((r) => verdicts.get(r.id)?.verdict === "fail");
  for (const r of contradicted) {
    const v = verdicts.get(r.id);
    if (v !== undefined)
      findings.push({ kind: "contradicted", review: r.id, requirement: r.requirement, person: v.person, sample: v.sample });
  }
  if (mine.length < needed) findings.push({ kind: "sampling-owed", reviews: reviews.length, sampled: mine.length, needed, ratePermille });
  return {
    reviews: reviews.length,
    sampled: mine.length,
    passed: mine.filter(([, v]) => v.verdict === "pass").length,
    failed: contradicted.length,
    ratePermille,
    needed,
    findings,
    contradicted,
  };
}
