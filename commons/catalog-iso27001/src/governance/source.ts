// Spec: 0002-iso27001-package FR-002, FR-006
/**
 * Where the content of the package came from (0002-iso27001-package FR-002, FR-006): not a file of the publisher but our own understanding of the structure of two standards that are sold, kept in the files of this folder whose SHA-256 the manifest records, so
 * that a change of a statement is a change of the package. ISO/IEC 27001 and ISO/IEC 27002 were NOT read: the publisher's page refused the download and the text is not free, so every reference says `unread`, and the identifiers, the order and the titles come from
 * what is widely published about them, reworded. A person who holds the standards checks each row before the package is relied on.
 *
 * @example
 * ```ts
 * import { FRAMEWORKS } from "./source.ts";
 * FRAMEWORKS.iso27001.id; // "iso-27001"
 * ```
 *
 * @module
 */

/** The files of this folder the package is made from, relative to the library: each is hashed into the manifest. */
export const SOURCE_FILES = ["src/governance/clauses.ts", "src/governance/annex.ts", "src/governance/themes.ts"] as const;

/** A document the content is a reading of, with whether it was read. */
export type Reference = { readonly publisher: string; readonly edition: string; readonly url: string; readonly readOn: "unread" };

/** The two standards. Neither was read: the publisher's page refused the fetch, and the text is a licensed work. */
export const REFERENCES = {
  iso27001: {
    publisher: "International Organization for Standardization (ISO) and International Electrotechnical Commission (IEC)",
    edition: "ISO/IEC 27001:2022, Information security, cybersecurity and privacy protection: information security management systems, requirements",
    url: "https://www.iso.org/standard/27001",
    readOn: "unread",
  },
  iso27002: {
    publisher: "International Organization for Standardization (ISO) and International Electrotechnical Commission (IEC)",
    edition: "ISO/IEC 27002:2022, Information security, cybersecurity and privacy protection: information security controls",
    url: "https://www.iso.org/standard/75652.html",
    readOn: "unread",
  },
} as const satisfies Readonly<Record<string, Reference>>;

/** What the content is, in words, and what it is not. */
export const LICENCE =
  "Own words of Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0. The identifiers (the numbers of the clauses and of the controls of Annex A) refer to ISO/IEC 27001:2022 and ISO/IEC 27002:2022, which are licensed works of ISO and IEC that were not read; the titles and statements are our understanding of what each asks, written from what is widely published about the structure of the two standards, not a quotation and not a substitute for them. A person who holds the standards MUST check every row before the package is relied on for a certification.";

/** The frameworks the package holds: the identifier is the slug of the standard, the version is the year of the edition whose identifiers it uses. */
export const FRAMEWORKS = {
  iso27001: { id: "iso-27001", version: "2022", title: "ISO/IEC 27001:2022: the clauses of the management system and the controls of Annex A, in our own words" },
  iso27002: { id: "iso-27002", version: "2022", title: "ISO/IEC 27002:2022: the four themes of the controls and the values of the five attributes, in our own words" },
} as const;

/** The time written in every document: fixed, so that the same source gives the same bytes. */
export const MADE_AT = "2026-11-26T00:00:00Z";
