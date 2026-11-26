# Feature Specification: ISO/IEC 27001 catalog package

**Spec ID:** 0002-iso27001-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** ISO/IEC 27001:2022 and the themes of ISO/IEC 27002:2022 as data for the catalog package loader of grc (commons grc 0008-grc-catalogs): the clauses 4 to 10 of the management system, the 93 controls of Annex A in their four themes, and the themes and attribute values of ISO/IEC 27002. All of it is in the words of Intellectual Frontiers, because the standards are licensed works and a table of them is not carried. Neither standard was read: the publisher's page refused the fetch and the text is sold, so every title and statement is our understanding of what each clause and control asks, from what is widely published about their structure, and the package says so in its manifest.

## Requirements

- **FR-001**: The package MUST hold two `grc.framework` documents. `iso-27001` (version `2022`) MUST have the sub-clauses of the clauses 4 to 10 (`C4.1` to `C10.2`, 7 groups) and the 93 controls of Annex A (`A.5.1` to `A.8.34`) in four groups as family: `organizational` (37), `people` (8), `physical` (14) and `technological` (34). `iso-27002` (version `2022`) MUST have the 4 themes and the values of the five attributes (control type, information security property, cybersecurity concept, operational capability and security domain). Each control MUST have an identifier, a title, a statement and a group as its family, and no framework may hold an identifier twice.
- **FR-002**: The manifest MUST record, for each of the two standards, the publisher, the edition, the address and that it was **unread**; the SHA-256 of each source file of the package; the licence wording; that the content may be redistributed; and a notice that the standards were not read, that every row is our understanding and that a person who holds the standards checks every row before the package is relied on for a certification. The package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from the files of `src/governance/` and never edited by hand; `--check` MUST find any file of the package that differs from what the sources give, including a source whose digest is not the one recorded.
- **FR-004**: The conversion MUST be a pure function of the entries: the same entries give the same documents, byte for byte, with no clock and no network, and the conversion MUST say which identifier a source repeats; the package MUST NOT be made from a source that repeats one.
- **FR-005**: Every identifier MUST be a token that OSCAL accepts as an identifier (it starts with a letter and holds letters, digits, dots, hyphens and underscores), so that the package can be written as an OSCAL catalog (commons catalog-crosswalks 0002-crosswalks FR-007).
- **FR-006**: The package MUST NOT carry text of the standards: the titles and statements are our own reading, the licence wording MUST say so, no statement may be long enough to be a transcription of a passage, and no table of a standard is carried.
- **FR-007**: The package MUST NOT claim what was not read: it MUST NOT give the attribute values of a control (they are in the text of ISO/IEC 27002, which was not read), and its references MUST say `unread`.

## Acceptance scenarios

1. **Given** the entries, **When** the package is made, **Then** `iso-27001` has 93 controls of Annex A in the groups of 37, 8, 14 and 34 and 30 sub-clauses of the clauses 4 to 10, and the identifiers `A.5.1`, `A.8.34`, `C6.1.3` and `C10.2` are among them, per FR-001.
2. **Given** a source file that is edited, **When** `--check` runs, **Then** it reports that the data differs, per FR-003.
3. **Given** the manifest, **When** the references are read, **Then** both say `unread` and the notice says a person who holds the standards checks every row, per FR-002 and FR-007.

## Out of scope

- The text of the standards and the attribute values of each control.
- The crosswalks of the package to other frameworks (commons catalog-crosswalks).

## Edge cases

- An entry list that repeats an identifier is refused, per FR-004.
- A statement that is long enough to be a passage of the standard is a failure of the test, per FR-006.

## Assumptions

- The numbering of Annex A (5.1 to 5.37, 6.1 to 6.8, 7.1 to 7.14 and 8.1 to 8.34) and of the clauses 4 to 10 is the one the two standards are known by.

## Open questions

- Whether to read the standards from a licensed copy and mark the rows as read: a decision of the owner, who holds the licence.

## Key entities

- **Clause**, **Control of Annex A**, **Theme**, **Attribute value**, **Package**.

## Success criteria

- **SC-001**: A report, a reading or a crosswalk can name a clause or a control of ISO/IEC 27001:2022 by its identifier and read what it asks, from framework data, without the standard's text.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
