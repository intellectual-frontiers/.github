# Feature Specification: NIST SP 800 catalog package

**Spec ID:** 0002-sp800-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** NIST SP 800-53 Rev 5.2.0 and SP 800-171 Rev 3, the catalogs that FedRAMP and CMMC are assessed against, as data for the catalog package loader of grc (commons grc 0008-grc-catalogs), made from NIST's own OSCAL content (a work of the United States government, dedicated to the public domain under CC0 1.0). The assessment objectives of SP 800-53A and SP 800-171A, which assessors determine one by one, are frameworks of their own, so that evidence can be tied to what is determined.

## Requirements

- **FR-001**: The package MUST hold four `grc.framework` documents: `nist-800-53` (version 5.2.0) and `nist-800-171` (version 3), whose controls are the requirements that the source does not withdraw (1014 and 97), each with its identifier as the publication prints it (`AC-2`, `AC-2(1)`, `03.01.01`), its title, its statement as NIST wrote it with the inserted parameters written out in brackets, and its family; and `nist-800-53a` and `nist-800-171a`, whose controls are the assessment objectives that have no objective below them (2781 and 422), each of the requirement named as its family.
- **FR-002**: The manifest MUST record the repository and the commit the sources were read at, the address and the SHA-256 of each source file, the edition, the licence wording and that the content may be redistributed; the package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from the sources and never edited by hand: the tool MUST refuse a source file whose SHA-256 is not the one pinned, and `--check` MUST find any file of the package that differs from what the sources give.
- **FR-004**: The conversion MUST be a pure function of the catalogs: the same catalogs give the same documents, byte for byte, with no clock and no network.

## Acceptance scenarios

1. **Given** the pinned sources, **When** the package is made, **Then** it has 1014, 2781, 97 and 422 controls in its four frameworks and every objective names a requirement that is there, per FR-001.
2. **Given** a source file that is not the pinned one, **When** the generator runs, **Then** it refuses, per FR-003.

## Out of scope

- SP 800-171 Rev 2, which CMMC Level 2 assesses today: NIST publishes no OSCAL content for it; it is read from the printed publications (0003-sp800-171-r2).
- Baselines and profiles (FedRAMP's, NIST's): later packages, with crosswalks.
- The guidance text and the assessment methods and objects of the publications.

## Edge cases

- A control that the source withdraws is not a control of the package, per FR-001.
- A parameter that has only choices is written as a selection, per FR-001.

## Assumptions

- NIST's OSCAL content is faithful to the printed publications; the package carries it as published at the commit.

## Open questions

- None.

## Key entities

- **Source**, **Package**, **Objective**.

## Success criteria

- **SC-001**: The controls and assessment objectives of the two publications are available as framework data from a folder of JSON.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
