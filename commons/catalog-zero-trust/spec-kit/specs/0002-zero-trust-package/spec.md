# Feature Specification: Zero trust catalog package

**Spec ID:** 0002-zero-trust-package
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Zero trust as data for the catalog package loader of grc (commons grc 0008-grc-catalogs), as commons 0047-zero-trust FR-021 to FR-023 ask: the seven tenets and the eight sources of input of NIST SP 800-207, the pillars, the cross-cutting capabilities, the functions and the stages of the CISA Zero Trust Maturity Model 2.0, the goals of OMB M-22-09, and a crosswalk to the controls of NIST SP 800-53 and SP 800-171. All of it is in the words of Intellectual Frontiers, because the publications are the works of their authors and a table of them is not carried. The three documents were read at the source on 2026-11-26; the Department of Defense model was not, and is not here.

## Requirements

- **FR-001**: The package MUST hold three `grc.framework` documents. `nist-sp800-207` (version `2020`) MUST have the 7 tenets `T1` to `T7` and the 8 sources of input `S1` to `S8`. `cisa-ztmm` (version `2.0`) MUST have the 4 general stages (`ALL@traditional` to `ALL@optimal`), the 5 pillars `ID`, `DV`, `NW`, `AW` and `DT`, the 3 cross-cutting capabilities `VA`, `AO` and `GV`, the 22 functions (`ID.AU` to `DT.EN`), the 20 statements of a pillar at a stage (`ID@traditional` to `DT@optimal`) and the 12 of a capability at a stage. `omb-m-22-09` (version `2022`) MUST have the 5 goals `ID` to `DT`. Each control MUST have an identifier, a title, a statement and a group as its family, and no framework may hold an identifier twice.
- **FR-002**: The manifest MUST record, for each of the three publications, the publisher, the edition, the address and the date it was read; the SHA-256 of each source file of the package; the licence wording; that the content may be redistributed; and a notice of what is not in the package. The package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: The package MUST be made by `tools/generate.ts` from the files of `src/governance/` and never edited by hand; `--check` MUST find any file of the package that differs from what the sources give, including a source whose digest is not the one recorded.
- **FR-004**: The conversion MUST be a pure function of the entries: the same entries give the same documents, byte for byte, with no clock and no network, and the conversion MUST say which identifier a source repeats; the package MUST NOT be made from a source that repeats one.
- **FR-005**: The package MUST hold one `grc.crosswalk`, `zero-trust-crosswalk`, whose mappings start from every tenet, every function and every cross-cutting capability and reach controls of `nist-800-53` (5.2.0) and `nist-800-171` (3). Every mapping MUST be `intersects-with` at strength 1 and its note MUST start with the words `person-decision-required` and give the reason, because the published mapping of the example architecture has not been read and no row is taken from a source (commons 0047-zero-trust FR-023); every mapping MUST reach a control that the held catalog of that framework has; a consumer MUST NOT count a row that still carries the words.
- **FR-006**: The package MUST NOT carry text of the publications: the titles and statements are our own reading, the licence wording MUST say so, no statement may be long enough to be a transcription of a passage, and no table of a publication is carried.
- **FR-007**: The package MUST NOT hold what has not been read: it MUST hold no pillar, stage or activity of the Department of Defense model, the pillars of `cisa-ztmm` MUST be exactly the five of the model, and the notice of the manifest MUST say that the model was not read (commons 0047-zero-trust FR-022).

## Acceptance scenarios

1. **Given** the entries, **When** the package is made, **Then** `cisa-ztmm` has 66 controls in 11 groups, `nist-sp800-207` has 15 and `omb-m-22-09` has 5, and the identifiers `T4`, `S6`, `ID.AM`, `DT.EN`, `NW@advanced` and `GV@optimal` are among them, per FR-001.
2. **Given** a source file that is edited, **When** `--check` runs, **Then** it reports that the data differs, per FR-003.
3. **Given** the crosswalk, **When** each of its mappings is read, **Then** it starts from a tenet, a function or a capability, reaches a control that exists, and says `person-decision-required` with a reason, per FR-005.

## Out of scope

- The stages and the activities of the Department of Defense model (commons 0047-zero-trust FR-022): not read, so not written.
- The decision of a row of the crosswalk: a person's, recorded by removing the words and giving the strength.
- The property sets of the pillars and the readings that give evidence for a function (commons 0047-zero-trust FR-025).

## Edge cases

- An entry list that repeats an identifier is refused, per FR-004.
- A proposal that starts from a framework the package does not hold is refused, per FR-005.

## Assumptions

- The CISA model's four stages are traditional, initial, advanced and optimal; the text of page 9 speaks of three steps of a journey from the traditional stage to the other three.

## Open questions

- None.

## Key entities

- **Tenet**, **Source of input**, **Pillar**, **Capability**, **Function**, **Stage**, **Goal**, **Proposal**, **Package**.

## Success criteria

- **SC-001**: A report, a reading or a control can name a tenet, a pillar, a function or a stage of zero trust by its identifier and read what it asks, from framework data, without the publications' text.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
