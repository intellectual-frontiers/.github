// Spec: 0002-soc2-package FR-002, FR-005
/**
 * Where the content of the package came from (0002-soc2-package FR-002, FR-005): not a file of the AICPA but our own reading of its criteria, in `criteria.ts`, whose SHA-256 the manifest records so that a change of a statement is a change of the package. The licence wording says what the content is and
 * what it is not.
 *
 * @example
 * ```ts
 * import { FRAMEWORK } from "./source.ts";
 * FRAMEWORK.id; // "soc2-tsc"
 * ```
 *
 * @module
 */

/** The file the package is made from, relative to the library. */
export const SOURCE_FILE = "src/governance/criteria.ts";

/** The files the package is made from, relative to the library: the criteria and what is shown for each (0003-soc2-focus FR-002). */
export const SOURCE_FILES = [SOURCE_FILE, "src/governance/focus.ts"] as const;

/** The publication the criteria are a reading of: its identifiers are used, its text is not. */
export const REFERENCE = {
  publisher: "American Institute of Certified Public Accountants (AICPA), Assurance Services Executive Committee",
  edition: "2017 Trust Services Criteria for Security, Availability, Processing Integrity, Confidentiality, and Privacy (With Revised Points of Focus, 2022)",
  url: "https://www.aicpa-cima.com/resources/landing/2017-trust-services-criteria-with-revised-points-of-focus-2022",
} as const;

/** What the content is, in words, and what it is not. */
export const LICENCE =
  "Own words of Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0. The identifiers (CC6.1) and the series names refer to the AICPA's Trust Services Criteria; the AICPA's text, its points of focus and its illustrative controls are its copyright and are not carried. The titles and statements are a reading of each criterion, not a quotation and not a substitute for the publication.";

/** The framework's identifier and version: the version is the edition of the criteria the identifiers are those of. */
export const FRAMEWORK = { id: "soc2-tsc", version: "2017", title: "SOC 2 Trust Services Criteria (2017, revised points of focus 2022), in our own words" } as const;

/** The framework of the matters shown for each criterion (0003-soc2-focus FR-001): our own list, shaped like the points of focus the AICPA prints under each criterion, which were not read and are not carried. */
export const FOCUS_FRAMEWORK = { id: "soc2-focus", version: "2017", title: "SOC 2: what an organization shows for each criterion, in our own words (shaped like the points of focus, which were not read)" } as const;

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-21T00:00:00Z";
