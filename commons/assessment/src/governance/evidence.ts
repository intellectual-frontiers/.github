// Spec: 0002-objective-evidence FR-001, FR-002
/**
 * The record of evidence against an assessment objective (0002-objective-evidence FR-001, FR-002): which objective of which framework, by which method (examine, interview, test), with what result, by whom (a tool or a person), when, until when it holds, and where it
 * can be looked at. Only a person determines: a tool's record supports an objective and never settles it, as an assessor's methods put it.
 *
 * @example
 * ```ts
 * import { METHODS } from "./evidence.ts";
 * METHODS; // ["examine", "interview", "test"]
 * ```
 *
 * @module
 */

/** The three methods of an assessment of SP 800-53A and SP 800-171A. */
export const METHODS = ["examine", "interview", "test"] as const;
/** A method. */
export type Method = (typeof METHODS)[number];

/** What the evidence shows of the objective. */
export const RESULTS = ["pass", "fail", "not-applicable"] as const;
/** A result. */
export type Result = (typeof RESULTS)[number];

/** Who made the record: a tool (a probe, a scanner) or a person (an assessor, an owner). */
export type By = { readonly kind: "tool" | "person"; readonly name: string };

/** One record of evidence. */
export type Evidence = {
  readonly id: string;
  readonly framework: string;
  readonly objective: string;
  readonly method: Method;
  readonly result: Result;
  readonly by: By;
  /** When the evidence was gathered (an instant, `2026-11-21T12:00:00Z`). */
  readonly at: string;
  /** Until when it holds (an instant); where it is absent the evidence does not expire. */
  readonly validUntil?: string;
  /** Where the evidence can be looked at: a policy, a file and its digest, an address, a ticket. */
  readonly source: string;
  /** A person's word on it; required for `not-applicable`. */
  readonly note?: string;
  /** Whether a person determines the objective from it. A tool never does. */
  readonly determines: boolean;
};

/** An objective of a framework, as the assessment reads it: its identifier, its requirement and what it asks. */
export type Objective = { readonly id: string; readonly requirement: string; readonly statement: string };

/** How one objective stands. */
export const STANDINGS = ["met", "not-met", "not-applicable", "supported", "stale", "no-evidence"] as const;
/** A standing. */
export type Standing = (typeof STANDINGS)[number];

/** How a requirement stands from its objectives. */
export const ROLLUPS = ["met", "not-met", "not-applicable", "partial", "no-evidence"] as const;
/** A roll-up. */
export type Rollup = (typeof ROLLUPS)[number];
