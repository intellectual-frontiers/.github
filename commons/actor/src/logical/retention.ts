// Spec: 0003-actor-retention FR-001, FR-002, FR-003
/**
 * How long the digests of agent sessions are kept (commons 0048-actors FR-062): the period a boundary's regimes set, the default of six years where none does, an override that never goes under a rule that was read, and
 * the record of an expiry. Pure: the instant is an argument.
 *
 * @example
 * ```ts
 * import { retentionOf } from "./retention.ts";
 * retentionOf({ regimes: ["hipaa"] }); // { kind: "ok", value: { years: 6, setBy: "hipaa", floor: 6, unresolved: [] } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { DEFAULT_RETENTION_YEARS, type ExpiryRecord, RETENTION_RULES, type Retention, type RetentionError, type RetentionInput } from "@intellectual-frontiers/actor/governance";

/** How long the digests of a boundary are kept: the longest fixed period of a rule that was read for its regimes, else the default; an override of the owner replaces it and is refused under the floor of a rule that was read. */
export function retentionOf(input: RetentionInput): Result<Retention, RetentionError> {
  const rules = input.regimes.map((r) => ({ regime: r, rule: RETENTION_RULES.find((x) => x.regime === r) }));
  const unresolved = rules.filter((r) => r.rule === undefined || r.rule.status === "unread" || r.rule.years === undefined).map((r) => r.regime).sort();
  const fixed = rules.flatMap((r) => (r.rule !== undefined && r.rule.status === "read" && r.rule.years !== undefined ? [{ regime: r.regime, years: r.rule.years }] : []));
  const top = fixed.reduce<{ regime: string; years: number } | undefined>((a, b) => (a === undefined || b.years > a.years ? b : a), undefined);
  const floor = top?.years ?? 0;
  if (input.overrideYears !== undefined) {
    const y = input.overrideYears;
    if (!Number.isInteger(y) || y < 1) return err({ kind: "not-a-period", years: y });
    if (y < floor && top !== undefined) return err({ kind: "below-floor", years: y, floor, regime: top.regime });
    return ok({ years: y, setBy: "override", floor, unresolved });
  }
  return ok({ years: top?.years ?? DEFAULT_RETENTION_YEARS, setBy: top?.regime ?? "default", floor, unresolved });
}

/** The instant a digest created at `createdAt` may be dropped: `years` calendar years later, as an ISO 8601 UTC instant. */
export function expiryOf(createdAt: string, years: number): string {
  const d = new Date(createdAt);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString();
}

/** Whether a digest created at `createdAt` is past its period at `now`. */
export function isExpired(createdAt: string, now: string, years: number): boolean {
  return Date.parse(now) >= Date.parse(expiryOf(createdAt, years));
}

/** The record of dropping digests: refused where any is not past its period (an expiry is an act, and it is never early). */
export function expire(input: {
  readonly digests: readonly string[];
  readonly createdAt: string;
  readonly now: string;
  readonly retention: Pick<Retention, "years" | "setBy">;
  readonly by: ExpiryRecord["by"];
}): Result<ExpiryRecord, string> {
  if (input.digests.length === 0) return err("there are no digests to expire");
  if (!isExpired(input.createdAt, input.now, input.retention.years)) {
    return err(`not yet: digests created ${input.createdAt} are kept until ${expiryOf(input.createdAt, input.retention.years)}`);
  }
  return ok({ kind: "digest-expired", digests: [...input.digests].sort(), createdAt: input.createdAt, expiredAt: input.now, retentionYears: input.retention.years, setBy: input.retention.setBy, by: input.by });
}
