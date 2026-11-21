# Feature Specification: NIST CSF 2.0 catalog package

**Spec ID:** 0002-csf2-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The NIST Cybersecurity Framework 2.0 as data for the catalog package loader of grc (commons grc 0008-grc-catalogs): the 106 active subcategories as controls of the framework `nist-csf` at version `2.0`, made from the JSON that NIST publishes, with the source, its digest and the licence wording recorded.

## Requirements

- **FR-001**: The package MUST hold one `grc.framework` with the id `nist-csf` and the version `2.0`, whose controls are exactly the active subcategories of the source (a subcategory that the source does not withdraw), each with its identifier (`GV.OC-01`), NIST's statement as the `statement`, the title of its category as the `title` and the identifier of its category (`GV.OC`) as the `family`; a withdrawn subcategory MUST NOT be a control.
- **FR-002**: The manifest MUST record the publisher (NIST), the edition, the address of the source, the SHA-256 of the source file it was made from and the licence wording, and MUST say that the content may be redistributed; the package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from the source file and never edited by hand: the tool MUST refuse a source whose SHA-256 is not the one pinned, and `--check` MUST find any file of the package that differs from what the source gives.
- **FR-004**: The conversion MUST be a pure function of the source value: the same source gives the same documents, byte for byte, with no clock and no network.

## Acceptance scenarios

1. **Given** the source of NIST, **When** the package is made, **Then** it has 6 functions, 22 categories and 106 controls, each identifier in the form `GV.OC-01`, per FR-001.
2. **Given** a source whose digest is not the pinned one, **When** the generator runs, **Then** it refuses and says so, per FR-003.

## Out of scope

- The mapping from CSF 1.1 to 2.0, the references to SP 800-53 and the implementation examples: later packages and crosswalks.

## Edge cases

- A subcategory with an empty title in the source: the title of the category is used, per FR-001.

## Assumptions

- The pinned source is the one NIST's data service gave on 2026-11-21; the licence wording is that of the copyright page of NIST (information on NIST sites is public information and may be distributed or copied, with a byline requested).

## Open questions

- **OQ-1**: Counsel's confirmation of the licence wording for the data service itself.

## Key entities

- **Source**, **Package**.

## Success criteria

- **SC-001**: The 106 controls of CSF 2.0 are available as framework data from a folder of JSON.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
