// Spec: 0002-crosswalks FR-002, FR-005
/**
 * What the crosswalks are made of and where it came from (0002-crosswalks FR-002, FR-005): our own proposals, held in the files of this folder whose SHA-256 the manifest records. No published mapping was read: NIST's mappings of SP 800-53 to ISO/IEC 27001 and the AICPA's of the
 * Trust Services Criteria to SP 800-53 were not fetched, so every reference below says `unread`, and every row is our reading of what two controls ask, written as `intersects-with` at the lowest strength with the words `person-decision-required`.
 *
 * @example
 * ```ts
 * import { CROSSWALKS } from "./source.ts";
 * CROSSWALKS.soc2.id; // "soc2-tsc-to-nist-800-53"
 * ```
 *
 * @module
 */

/** The files of this folder the package is made from, relative to the library: each is hashed into the manifest. */
export const SOURCE_FILES = ["src/governance/soc2.ts", "src/governance/iso.ts", "src/governance/hipaa.ts"] as const;

/** A framework a crosswalk starts from or reaches, in a catalog package of this repository. */
export type Side = { readonly framework: string; readonly version: string };

/** The frameworks the proposals start from, and the one they reach. */
export const SIDES = {
  soc2: { framework: "soc2-tsc", version: "2017" },
  iso: { framework: "iso-27001", version: "2022" },
  hipaa: { framework: "hipaa-security", version: "2026" },
  sp80053: { framework: "nist-800-53", version: "5.2.0" },
} as const satisfies Readonly<Record<string, Side>>;

/** A published mapping that would be the source of a row, and whether it was read. None was. */
export type Reference = { readonly publisher: string; readonly title: string; readonly status: "unread" };

/** The published mappings that were not read: a row is never taken from one, and a person who reads one may decide a row from it. */
export const REFERENCES: readonly Reference[] = [
  { publisher: "National Institute of Standards and Technology (NIST)", title: "Mapping of SP 800-53 Revision 5 to ISO/IEC 27001 (Online Informative References program)", status: "unread" },
  { publisher: "American Institute of Certified Public Accountants (AICPA)", title: "Mapping of the Trust Services Criteria to NIST SP 800-53", status: "unread" },
  { publisher: "United States Department of Health and Human Services and NIST", title: "Mapping of the HIPAA Security Rule to NIST SP 800-53 (NIST SP 800-66 Revision 2)", status: "unread" },
];

/** What the content is, in words, and what it is not. */
export const LICENCE =
  "Own words of Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0. Every mapping is a proposal of ours that names two controls that exist in the catalogs of this repository and says why they are said to meet; it is not a mapping published by NIST, the AICPA, ISO or the Department of Health and Human Services, none of which was read. A row that still carries the words person-decision-required MUST NOT be counted.";

/** The crosswalk documents: the slug of each, and the words every row starts its note with until a person has decided it. */
export const CROSSWALKS = {
  soc2: { id: "soc2-tsc-to-nist-800-53", from: SIDES.soc2, to: SIDES.sp80053 },
  iso: { id: "iso-27001-to-nist-800-53", from: SIDES.iso, to: SIDES.sp80053 },
  hipaa: { id: "hipaa-security-to-nist-800-53", from: SIDES.hipaa, to: SIDES.sp80053 },
  isoSoc2: { id: "iso-27001-to-soc2-tsc", from: SIDES.iso, to: SIDES.soc2 },
} as const;

/** The words that mark a row as undecided. */
export const PENDING = "person-decision-required";

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-26T00:00:00Z";

/** The version of OSCAL the projections are written as: the one grc writes its documents as. */
export const OSCAL_VERSION = "1.2.3";
