// Spec: 0003-actor-retention FR-001, FR-002
/**
 * The retention of the digests of agent sessions (commons 0048-actors FR-062): a typed policy keyed by the regime of a boundary, data with the source of each rule and whether it was read, a default of six years, an
 * override per boundary that never goes under a rule that was read, and the record of an expiry. Nothing here reads a clock: the instant is an argument.
 *
 * @module
 */

/** A retention rule of one regime. */
export interface RetentionRule {
  /** The id of the regime, as the boundary names it (`hipaa`, `gdpr`). */
  readonly regime: string;
  /** The years the digests are kept, or `undefined` where the regime states no fixed period (it says `no longer than necessary`) or the period was not read. */
  readonly years: number | undefined;
  /** What the rule rests on, said in our own words. */
  readonly basis: string;
  /** Where it is written. */
  readonly source: string;
  /** Whether a person read the source (`read`) or not (`unread`): an unread rule never lowers a floor and never sets one. */
  readonly status: "read" | "unread";
}

/** The years kept where no regime of the boundary sets a period: the period of the Security Rule documentation, the longest fixed period read so far. */
export const DEFAULT_RETENTION_YEARS = 6;

/** The rules, as data. Only `hipaa` was read at its source (the eCFR, 2026-11-26); the others say what is known and are `unread`. */
export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    regime: "hipaa",
    years: 6,
    basis: "documentation of the policies, procedures and actions of the Security Rule is kept six years from its creation or from when it was last in effect, whichever is later",
    source: "45 CFR 164.316(b)(2)(i)",
    status: "read",
  },
  {
    regime: "gdpr",
    years: undefined,
    basis: "personal data is kept no longer than is necessary for the purpose; the regulation fixes no number of years",
    source: "Regulation (EU) 2016/679, Article 5(1)(e)",
    status: "unread",
  },
  {
    regime: "pci-dss",
    years: undefined,
    basis: "the period of the audit trail history is in the licensed standard",
    source: "PCI DSS v4.0.1, requirement 10",
    status: "unread",
  },
  {
    regime: "cmmc",
    years: undefined,
    basis: "the period of audit records is set by the contract and the organization",
    source: "NIST SP 800-171, 3.3.1; 32 CFR 170",
    status: "unread",
  },
  {
    regime: "soc2",
    years: undefined,
    basis: "the criteria fix no number of years; the period is the one the system description states",
    source: "AICPA Trust Services Criteria",
    status: "unread",
  },
];

/** What a boundary says about the retention of digests: the regimes it answers to and, where its owner decided so, a period of its own. */
export interface RetentionInput {
  readonly regimes: readonly string[];
  readonly overrideYears?: number;
}

/** How long digests are kept, and why. */
export interface Retention {
  readonly years: number;
  /** The regime or `default` or `override` that set the number. */
  readonly setBy: string;
  /** The longest period of a rule that was read for the regimes (0 where none was): an override never goes below it. */
  readonly floor: number;
  /** The regimes named that have no rule in the table or whose rule is unread: each is a question for a person. */
  readonly unresolved: readonly string[];
}

/** Why a retention is refused. */
export type RetentionError = { readonly kind: "below-floor"; readonly years: number; readonly floor: number; readonly regime: string } | { readonly kind: "not-a-period"; readonly years: number };

/** The record of an expiry of digests: an act, never a silent deletion (commons 0048-actors FR-062). */
export interface ExpiryRecord {
  readonly kind: "digest-expired";
  /** The SHA-256 digests that were dropped, sorted. */
  readonly digests: readonly string[];
  /** When they were created (ISO 8601 UTC). */
  readonly createdAt: string;
  /** When they were dropped (ISO 8601 UTC). */
  readonly expiredAt: string;
  readonly retentionYears: number;
  readonly setBy: string;
  /** The person or the system that did it. */
  readonly by: { readonly kind: "person" | "system"; readonly id: string };
}
