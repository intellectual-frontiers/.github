// Spec: 0002-hipaa-package FR-002, FR-006
/**
 * Where the content of the package came from (0002-hipaa-package FR-002, FR-006): our own reading of Subpart C of 45 CFR Part 164, the Security Rule, which is a regulation of the United States government and in the public domain. It was read at the source from the Electronic Code of Federal
 * Regulations on 2026-11-26: the sections 164.308, 164.310, 164.312, 164.314 and 164.316 and the table of Appendix A. The statements are ours and short; they are not the text of the regulation, which stays the authority.
 *
 * @example
 * ```ts
 * import { FRAMEWORK } from "./source.ts";
 * FRAMEWORK.id; // "hipaa-security"
 * ```
 *
 * @module
 */

/** The file the package is made from, relative to the library: its SHA-256 is in the manifest. */
export const SOURCE_FILE = "src/governance/security-rule.ts";

/** The regulation the entries are a reading of, with the date it was read. */
export const REFERENCE = {
  publisher: "United States Department of Health and Human Services, in the Code of Federal Regulations",
  edition: "45 CFR Part 164, Subpart C (Security Standards for the Protection of Electronic Protected Health Information), sections 164.308, 164.310, 164.312, 164.314 and 164.316 and Appendix A, as published in the eCFR",
  url: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C",
  readOn: "2026-11-26",
} as const;

/** What the content is, in words, and what it is not. */
export const LICENCE =
  "Own words of Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0. The identifiers and the names of the standards and implementation specifications refer to 45 CFR Part 164 Subpart C, a regulation of the United States government that is in the public domain; the statements are a reading of each, not a quotation and not a substitute for the regulation, which stays the authority. Whether an addressable specification is met, met another way or not needed is a decision to be documented by the covered entity or business associate under 164.306(d).";

/** The framework's identifier and version: the version is the year of the publication read. */
export const FRAMEWORK = { id: "hipaa-security", version: "2026", title: "HIPAA Security Rule, 45 CFR 164 Subpart C: the standards and implementation specifications, in our own words" } as const;

/** The words a statement starts with, by what the entry is: a standard, or an implementation specification that is required or addressable. */
export const KINDS = { standard: "Standard.", required: "Required specification.", addressable: "Addressable specification." } as const;

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-26T00:00:00Z";
