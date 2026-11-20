// Spec: 0005-grc-runners FR-008
/**
 * The `manual` runner (0005-grc-runners FR-008): a person answers. It gives `pending` until an attestation for the check and the subject exists that was made by a role the evidence policy lets
 * attest and is not older than the policy's longest age for attestations (or the check's own freshness), and then `pass` or `fail` by what the attestation claims. It never answers by itself.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Check, type EvidencePolicy, instantMs, parseDuration } from "@intellectual-frontiers/grc/governance";
import type { Attestation } from "@intellectual-frontiers/grc/logical";
import { mayAttest, type Observation, type RunContext, type Runner, type RunnerProblem } from "@intellectual-frontiers/grc/physical";

/** The `manual` runner over the attestations that exist (read when it runs) and the evidence policy. */
export function manualRunner(attestations: () => readonly Attestation[], policy: EvidencePolicy): Runner {
  return {
    id: "manual",
    run(check: Check, ctx: RunContext): Promise<Result<Observation, RunnerProblem>> {
      const now = ctx.now();
      const t = instantMs(now);
      const entry = policy.counts.find((c) => c.kinds.includes("attestation"));
      const age = parseDuration(entry?.maxAge ?? check.freshness);
      if (t === undefined || age.kind === "err") return Promise.resolve(err({ kind: "failed", message: "the clock or the longest age is not valid" }));
      const mine = attestations().filter((a) => a.check === check.id && a.subject === ctx.subject.id);
      const pending = (reason: string): Result<Observation, RunnerProblem> => ok({ value: null, observedAt: now, via: "manual", tookMs: 0, decided: { status: "pending", reason } });
      if (mine.length === 0) return Promise.resolve(pending("no one has attested yet"));
      const allowed = mine.filter((a) => mayAttest(policy, a.role));
      if (allowed.length === 0) return Promise.resolve(pending(`the roles ${[...new Set(mine.map((a) => a.role))].sort().join(", ")} may not attest: ${policy.attesters.join(", ")} may`));
      const fresh = allowed.filter((a) => t - (instantMs(a.createdAt) ?? 0) <= age.value);
      const newest = [...fresh].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0];
      if (newest === undefined) return Promise.resolve(pending("the attestations are older than the longest age"));
      return Promise.resolve(ok({ value: newest.claim, observedAt: newest.createdAt, via: `manual: ${newest.attester} (${newest.role})`, tookMs: 0, decided: { status: newest.claim, reason: newest.statement } }));
    },
  };
}
