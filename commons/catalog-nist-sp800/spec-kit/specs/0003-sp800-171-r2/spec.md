# Feature Specification: NIST SP 800-171 Revision 2 in the SP 800 package

**Spec ID:** 0003-sp800-171-r2
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** SP 800-171 Revision 2 and its assessment procedures SP 800-171A, the requirements CMMC Level 2 is assessed against today (110 requirements, 320 assessment objectives). NIST publishes OSCAL content for Revision 3 only (0002-sp800-package), so Revision 2 is read from the printed publications, which are works of the United States government and in the public domain. The frameworks sit in the same package as Revision 3 and the loader of grc reads them the same way.

## Requirements

- **FR-001**: The package MUST hold two more `grc.framework` documents: `nist-800-171-r2` (version 2), whose 110 controls are the requirements as the publication prints them, each with its number (`3.1.1`), its statement, its family (`3.1`) and the name of the family as its title; and `nist-800-171a-r2` (version 1), whose 320 controls are the assessment objectives of SP 800-171A, the lettered ones of a requirement as `3.1.1[a]` and the single one of a requirement under its number, each of the requirement named as its family. A statement MUST carry none of the page furniture of the PDF (running heads, page numbers, the watermark of each page) and none of the footnote marks after its closing full stop.
- **FR-002**: The manifest MUST record the address and the SHA-256 of each of the two PDFs and their editions, beside the sources of Revision 3; the package MUST load through `readCatalogPackage` of grc with no problem; `tools/generate.ts` MUST refuse a PDF whose SHA-256 is not the pinned one and `--check` MUST find any file that differs from what the PDFs give.
- **FR-003**: The files of Revision 2 MUST be made by `tools/generate.ts` and never edited by hand; the text is taken from each PDF by `pdftotext -raw`, and the tool MUST stop with the error of `pdftotext` where it fails.
- **FR-004**: The reading MUST be a pure function of that text: the same text gives the same documents, byte for byte, with no clock and no network.

## Acceptance scenarios

1. **Given** the pinned PDFs, **When** the package is made, **Then** it has 110 requirements in 14 families and 320 objectives, every objective of a requirement that is there and every requirement with an objective, per FR-001.
2. **Given** a PDF that is not the pinned one, **When** the generator runs, **Then** it refuses, per FR-002.

## Out of scope

- The discussion text and the assessment methods and objects of the publications.
- A crosswalk of Revision 2 to Revision 3 and to SP 800-53 (the appendices of the publication): a later package.
- CMMC's own scoping, levels and scoring (the SPRS values of the DoD Assessment Methodology): a later package with its own source.

## Edge cases

- The worked example of SP 800-171A, which prints requirement 3.1.3 once before the requirements, is read over by the requirement's own block, per FR-001.
- A statement that a page break cuts in two is one statement, per FR-001.

## Assumptions

- `pdftotext -raw` of the pinned PDFs gives the text the reading expects; the counts and the checks of the tests catch a change of it.

## Open questions

- None.

## Key entities

- **Requirement**, **Objective**, **Printed source**.

## Success criteria

- **SC-001**: The 110 requirements and 320 objectives that CMMC Level 2 is assessed against are available as framework data beside Revision 3.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
