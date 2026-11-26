# Feature Specification: HIPAA Security Rule catalog package

**Spec ID:** 0002-hipaa-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Security Rule of HIPAA, Subpart C of 45 CFR Part 164, as data for the catalog package loader of grc (commons grc 0008-grc-catalogs): the standards and implementation specifications of the sections 164.308, 164.310, 164.312, 164.314 and 164.316, each marked as a standard, a required specification or an addressable specification, in the words of Intellectual Frontiers. The regulation is a work of the United States government and in the public domain, and it was read at the source (the eCFR) on 2026-11-26 together with the table of its Appendix A; the statements are ours and short, and the regulation stays the authority.

## Requirements

- **FR-001**: The package MUST hold one `grc.framework`, `hipaa-security` (version `2026`), whose 65 controls are the 22 standards, the 21 required implementation specifications and the 22 addressable ones of the five sections: `164.308` (30), `164.310` (12), `164.312` (12), `164.314` (6) and `164.316` (5); each with its identifier, a title, a statement and its section as its family, and no identifier twice.
- **FR-002**: The manifest MUST record the regulation (publisher, edition, address, and the date it was read), the SHA-256 of the source file the package was made from, the licence wording, that the content may be redistributed and a notice; the package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from `src/governance/security-rule.ts` and never edited by hand; `--check` MUST find any file of the package that differs from what the source gives, including a source whose digest is not the one recorded.
- **FR-004**: The conversion MUST be a pure function of the entries: the same entries give the same documents, byte for byte, with no clock and no network; the conversion MUST say which identifier a source repeats, and the package MUST NOT be made from a source that repeats one.
- **FR-005**: Every statement MUST start with what its entry is, `Standard.`, `Required specification.` or `Addressable specification.`, as the regulation marks it (the paragraph's own words and the table of Appendix A), and every identifier MUST be the section and the paragraphs in lower case joined by dots (letters, digits and dots only). Because an OSCAL identifier cannot start with a digit, the OSCAL projection of the framework (commons catalog-crosswalks 0002-crosswalks FR-007) writes each identifier with one underscore in front.
- **FR-006**: The package MUST NOT carry the text of the regulation: the titles and statements are our own reading, the licence wording MUST say so and that the regulation stays the authority, no statement may be long enough to be a transcription of a paragraph, and whether an addressable specification is met, met another way or not needed MUST be left to the decision that 164.306(d) asks the entity to document.

## Acceptance scenarios

1. **Given** the entries, **When** the package is made, **Then** `hipaa-security` has 65 controls in 5 sections and the identifiers `164.308.a.1.ii.A`, `164.312.a.2.iv`, `164.314.a.2.iii` and `164.316.b.2.i` are among them, per FR-001.
2. **Given** a source file that is edited, **When** `--check` runs, **Then** it reports that the data differs, per FR-003.
3. **Given** the encryption and decryption specification of 164.312(a)(2)(iv), **When** its statement is read, **Then** it starts with `Addressable specification.`, per FR-005.

## Out of scope

- The privacy rule and the breach notification rule (Subparts D and E of Part 164) and the rest of the Security Rule: the general rules of 164.306 and the compliance dates.
- Proposals to change the rule that are not in force.
- The crosswalk to NIST SP 800-53: commons catalog-crosswalks.

## Edge cases

- An entry list that repeats an identifier is refused, per FR-004.
- The table of Appendix A leaves the mark off the workforce clearance procedure; the paragraph of the regulation says addressable, and the package follows the paragraph, per FR-005.

## Assumptions

- The text of the regulation is as published in the eCFR on 2026-11-26.

## Open questions

- None.

## Key entities

- **Standard**, **Implementation specification** (required or addressable), **Section**, **Package**.

## Success criteria

- **SC-001**: A report, a reading or a crosswalk can name a standard or an implementation specification of the Security Rule by its identifier and read whether it is required or addressable, from framework data, without the regulation's text.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
