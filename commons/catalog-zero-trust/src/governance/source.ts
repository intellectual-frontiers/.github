// Spec: 0002-zero-trust-package FR-002, FR-006
/**
 * Where the content of the package came from (0002-zero-trust-package FR-002, FR-006): not a file of any publisher but our own reading of three public documents, kept in the files of this folder whose SHA-256 the manifest records, so that a change of a
 * statement is a change of the package. Each reference says what was read, when and where; the licence wording says what the content is and what it is not.
 *
 * @example
 * ```ts
 * import { FRAMEWORKS } from "./source.ts";
 * FRAMEWORKS.ztmm.id; // "cisa-ztmm"
 * ```
 *
 * @module
 */

/** The files of this folder the package is made from, relative to the library: each is hashed into the manifest. */
export const SOURCE_FILES = ["src/governance/nist.ts", "src/governance/ztmm.ts", "src/governance/omb.ts", "src/governance/crosswalk.ts"] as const;

/** A public document that was read, with the date it was read on. */
export type Reference = { readonly publisher: string; readonly edition: string; readonly url: string; readonly readOn: string };

/** The three documents the content is a reading of. Nothing else is read into the package: a document that has not been read is not here (0047-zero-trust FR-022). */
export const REFERENCES = {
  sp800207: {
    publisher: "National Institute of Standards and Technology (NIST)",
    edition: "Special Publication 800-207, Zero Trust Architecture (August 2020)",
    url: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf",
    readOn: "2026-11-26",
  },
  ztmm: {
    publisher: "Cybersecurity and Infrastructure Security Agency (CISA)",
    edition: "Zero Trust Maturity Model, Version 2.0 (April 2023)",
    url: "https://www.cisa.gov/sites/default/files/2023-04/zero_trust_maturity_model_v2_508.pdf",
    readOn: "2026-11-26",
  },
  m2209: {
    publisher: "Office of Management and Budget (OMB), Executive Office of the President",
    edition: "Memorandum M-22-09, Moving the U.S. Government Toward Zero Trust Cybersecurity Principles (January 26, 2022)",
    url: "https://www.whitehouse.gov/wp-content/uploads/2022/01/M-22-09.pdf",
    readOn: "2026-11-26",
  },
} as const satisfies Readonly<Record<string, Reference>>;

/** What the content is, in words, and what it is not. */
export const LICENCE =
  "Own words of Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0. The identifiers and the names of the pillars, functions and stages refer to NIST SP 800-207, the CISA Zero Trust Maturity Model and OMB M-22-09, which are works of the United States government; the titles and statements are a reading of each, not a quotation and not a substitute for the publication. The stages of the Department of Defense model and its activities are not in this package: the source has not been read.";

/** The frameworks the package holds: the identifier is the slug of the document, the version is the edition of the publication whose identifiers it uses. */
export const FRAMEWORKS = {
  sp800207: { id: "nist-sp800-207", version: "2020", title: "NIST SP 800-207 Zero Trust Architecture: the tenets and the sources of input, in our own words" },
  ztmm: { id: "cisa-ztmm", version: "2.0", title: "CISA Zero Trust Maturity Model 2.0: the pillars, the cross-cutting capabilities, the functions and the stages, in our own words" },
  m2209: { id: "omb-m-22-09", version: "2022", title: "OMB M-22-09: the goals of the federal zero trust strategy for each pillar, in our own words" },
} as const;

/** The crosswalk document: its slug, and the words every one of its rows starts its note with until a person has decided it. */
export const CROSSWALK = { id: "zero-trust-crosswalk", pending: "person-decision-required" } as const;

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-26T00:00:00Z";
