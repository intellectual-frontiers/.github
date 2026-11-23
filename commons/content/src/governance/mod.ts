// Spec: 0001-content-collector FR-001, FR-002
/** The typed inputs and vocabulary of the collector. @module */

/** Labels a claim can carry. */
export const CLAIM_LABELS = ["evidence", "vendor-documentation", "inference", "hypothesis", "opinion", "illustration"] as const;
/** Whether a fact can change. */
export const VOLATILITY = ["static", "dated", "volatile"] as const;
/** Recorded audit states. */
export const AUDIT_STATES = ["not-audited", "audited"] as const;

/** A source block as identified by a structural document parser. */
export type SourceBlock = {
  readonly text: string;
  readonly line: number;
  readonly disclosure: "public" | "restricted";
  readonly marker?: string;
};

/** A chapter eligible for collection, with source locations and its chapter-local source notes. */
export type ChapterInput = {
  readonly id: string;
  readonly file: string;
  readonly audience: string;
  readonly blocks: readonly SourceBlock[];
  readonly sourceNotes: string;
  readonly audit?: (typeof AUDIT_STATES)[number];
};

/** A public evidence source named by a key in its chapter. */
export type EvidenceSource = { readonly key: string; readonly description: string; readonly url: string };

/** A collected public claim and its source provenance. */
export type Claim = {
  readonly id: string;
  readonly minted: boolean;
  readonly text: string;
  readonly file: string;
  readonly line: number;
  readonly label: (typeof CLAIM_LABELS)[number];
  readonly audience: string;
  readonly evidence: readonly EvidenceSource[];
  readonly asOf?: string;
  readonly reverifyBy?: string;
  readonly volatility: (typeof VOLATILITY)[number];
  readonly audit: (typeof AUDIT_STATES)[number];
};
