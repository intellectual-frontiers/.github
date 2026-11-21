// Spec: 0002-policy-gate FR-001, FR-002, FR-003
/**
 * The vocabulary of a policy gate (0002-policy-gate FR-001 to FR-003): the subjects of a change (an asset, a cloud resource, an endpoint, a file) with their attributes as plain values; a rule, which is a function from a subject to the problems it has, with an id, a title, a severity and what it
 * applies to; a waiver, which a person grants for a rule and a subject, for a reason and until an instant; and the verdict.
 *
 * @example
 * ```ts
 * import { SEVERITIES } from "./model.ts";
 * SEVERITIES; // ["block", "warn"]
 * ```
 *
 * @module
 */

/** An attribute value: a plain value or a list of text. */
export type Value = string | number | boolean | readonly string[];

/** A thing a change touches. */
export type Subject = { readonly id: string; readonly kind: string; readonly attributes: Readonly<Record<string, Value>> };

/** A change: the subjects as they were and as they will be (a subject only in `after` is added, only in `before` removed). */
export type Change = { readonly before: readonly Subject[]; readonly after: readonly Subject[] };

/** Whether a rule stops a change or only says so. */
export const SEVERITIES = ["block", "warn"] as const;
/** A severity. */
export type Severity = (typeof SEVERITIES)[number];

/** One problem a rule finds in a subject. */
export type Problem = { readonly message: string; readonly attribute?: string };

/** A rule of a policy. */
export type Rule = {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  /** The kinds of subject it applies to (every kind where absent). */
  readonly kinds?: readonly string[];
  /** The controls (of any framework, by their identifiers) the rule gives evidence for. */
  readonly controls?: readonly string[];
  readonly check: (subject: Subject) => readonly Problem[];
};

/** A waiver: a person lets a subject break a rule, for a reason, until an instant. */
export type Waiver = { readonly rule: string; readonly subject: string; readonly reason: string; readonly by: string; readonly until: string };

/** A violation: a rule broken by a subject. */
export type Violation = { readonly rule: string; readonly title: string; readonly severity: Severity; readonly subject: string; readonly message: string; readonly controls: readonly string[]; readonly waived?: Waiver };

/** The verdict of a gate. */
export type Verdict = {
  /** Whether the change may go on: no violation that blocks and is not waived. */
  readonly pass: boolean;
  readonly blocking: readonly Violation[];
  readonly warnings: readonly Violation[];
  readonly waived: readonly Violation[];
  /** Waivers that were not used because they have expired, or that no violation needed. */
  readonly unusedWaivers: readonly Waiver[];
  readonly checked: number;
};
