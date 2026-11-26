# Feature Specification: SOC 2 Trust Services Criteria catalog package

**Spec ID:** 0002-soc2-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The SOC 2 Trust Services Criteria as data for the catalog package loader of grc (commons grc 0008-grc-catalogs): the 61 criteria of the five categories as controls of the framework `soc2-tsc`, in the words of Intellectual Frontiers, because the AICPA's text is its copyright. The identifiers are the ones the criteria are known by, so that evidence, crosswalks and reports can name `CC6.1` and an assessor can find it.

## Requirements

- **FR-001**: The package MUST hold one `grc.framework` with the id `soc2-tsc` and the version `2017`, whose 61 controls are the criteria: the common criteria `CC1.1` to `CC9.2` (33, the criteria of Security), availability `A1.1` to `A1.3`, confidentiality `C1.1` and `C1.2`, processing integrity `PI1.1` to `PI1.5`, and privacy `P1.1` to `P8.1` (18); each with its identifier, a title, a statement and its series (`CC6`) as its family, and no identifier twice.
- **FR-002**: The manifest MUST record the publication the identifiers refer to (publisher, edition, address), the SHA-256 of the source file the package was made from, the licence wording, and that the content may be redistributed; the package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from `src/governance/criteria.ts` and never edited by hand; `--check` MUST find any file of the package that differs from what the source gives, including a source whose digest is not the one recorded.
- **FR-004**: The conversion MUST be a pure function of the criteria: the same criteria give the same documents, byte for byte, with no clock and no network; the conversion MUST say which identifier a source repeats, and the package MUST NOT be made from a source that repeats one.
- **FR-005**: The package MUST NOT carry text of the AICPA's publication: the titles and statements are our own reading, the licence wording MUST say so, and no statement may be a sentence the publication prints (the points of focus and illustrative controls are not carried at all; commons catalog-soc2 0003-soc2-focus holds our own list of what an organization shows, which is not them).

## Acceptance scenarios

1. **Given** the criteria, **When** the package is made, **Then** it has 61 controls in 20 series, and the identifiers `CC6.1`, `A1.2`, `C1.2`, `PI1.3` and `P6.7` are among them, per FR-001.
2. **Given** a criteria source that is edited, **When** `--check` runs, **Then** it reports that the data differs, per FR-003.

## Out of scope

- The AICPA's points of focus, its illustrative controls and its description criteria (DC 200): not carried.
- Mappings of the criteria to SP 800-53, CMMC or other frameworks: later crosswalk packages.
- Which categories a report covers: the engagement's scope, not the catalog.

## Edge cases

- A criteria list that repeats an identifier is refused, per FR-004.

## Assumptions

- The identifiers follow the 2017 criteria with the revised points of focus of 2022, which changed the points of focus and not the criteria.

## Open questions

- None.

## Key entities

- **Criterion**, **Series**, **Package**.

## Success criteria

- **SC-001**: A report or a piece of evidence can name any SOC 2 criterion by its identifier and read what it asks, from framework data, without the AICPA's text.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
