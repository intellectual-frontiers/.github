# Feature Specification: Crosswalks and the coverage of a framework

**Spec ID:** 0002-crosswalks
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The catalogs of SOC 2, ISO/IEC 27001 and the HIPAA Security Rule are useful together only if one control can be said to meet another. This library holds the crosswalks as data for the catalog package loader of grc (commons grc 0008-grc-catalogs): SOC 2 to NIST SP 800-53, ISO/IEC 27001 Annex A to SP 800-53, the Security Rule to SP 800-53, and ISO/IEC 27001 to SOC 2 derived through the controls of SP 800-53 that the two sides share. It also holds the pure view of the coverage of a framework through a crosswalk, and the projection of a framework as an OSCAL catalog and of a crosswalk as an OSCAL mapping collection. No published mapping was read (the mapping of SP 800-53 to ISO/IEC 27001 from NIST's OLIR program, the AICPA's mapping of the criteria to SP 800-53 and the mapping of the Security Rule in SP 800-66 were not fetched), so every row is our proposal for a person to decide.

## Requirements

- **FR-001**: The package MUST hold four `grc.crosswalk` documents: `soc2-tsc-to-nist-800-53` (every one of the 61 criteria of `soc2-tsc` 2017), `iso-27001-to-nist-800-53` (every one of the 93 controls of Annex A of `iso-27001` 2022), `hipaa-security-to-nist-800-53` (every one of the 65 entries of `hipaa-security` 2026) and `iso-27001-to-soc2-tsc`. Each source MUST be a control of the framework it names in a catalog package of this repository, and each target MUST be a control of `nist-800-53` 5.2.0 or of `soc2-tsc` 2017 that the catalog has.
- **FR-002**: The manifest MUST record the published mappings that were not read, each as `unread`, the SHA-256 of each source file of the package, the licence wording, that the content may be redistributed and a notice that says no published mapping was read, that every row is ours and that a row that still carries the words `person-decision-required` MUST NOT be counted. The package MUST load through `readCatalogPackage` of grc with no problem.
- **FR-003**: Every mapping MUST be `intersects-with` at strength 1 and its note MUST start with the words `person-decision-required` and give the reason, because no row is taken from a published mapping; the mappings MUST be in a fixed order (by source, then target) and a pair MUST NOT be named twice.
- **FR-004**: The package MUST be made by `tools/generate.ts` from the files of `src/governance/` and never edited by hand, and its making MUST be a pure function of the proposals: the same proposals give the same documents, byte for byte, with no clock and no network. `--check` MUST find any file that differs from what the sources give, including a source whose digest is not the one recorded.
- **FR-005**: The crosswalk `iso-27001-to-soc2-tsc` MUST be derived and not written by hand: for each control of Annex A it MUST name the criteria of SOC 2 that share the most controls of SP 800-53 with it (all that tie), and its note MUST name the shared controls and say that the derivation is weaker than a proposal.
- **FR-006**: `coverageOf` MUST be a pure function that, for the controls of a target framework, a crosswalk and the standing of each source control, returns for each target its standing in the six standings of an assessment (`met`, `not-met`, `not-applicable`, `supported`, `stale`, `no-evidence`) and a count of the controls for each standing, and it MUST NOT return a percentage or any score. A row that still carries `person-decision-required` MUST NOT be counted and MUST be reported as undecided. A decided row of relationship `equal` gives its source's standing to its target; a decided row of any other relationship gives at most `supported`; where several decided rows reach one target the worst standing in the order `not-met`, `stale`, `no-evidence`, `supported`, `met`, `not-applicable` is the target's; a target that no decided row reaches is `no-evidence`.
- **FR-007**: `oscalCatalogOf` MUST write a framework as an OSCAL catalog, one group for each family and one control for each control with its statement as a part, and `oscalMappingOf` MUST write a crosswalk as an OSCAL mapping collection with one map for each row and the note as its remarks; both MUST be pure, with a version 5 UUID of the document's own name so that the same document gives the same bytes. An identifier that does not start with a letter or an underscore MUST be written with one underscore in front, and a character that an OSCAL token cannot hold MUST be written as an underscore. Where NIST's schema and a Node with ajv are at hand, the catalogs of the four frameworks and the four crosswalks MUST be valid against it.

## Acceptance scenarios

1. **Given** the proposals, **When** the package is made, **Then** every one of the 61 criteria, the 93 controls and the 65 entries is the source of at least one row and every target exists in the catalog it names, per FR-001.
2. **Given** a crosswalk row that is `intersects-with` and undecided, **When** the coverage is asked for, **Then** the target has no standing from it and the row is reported as undecided, per FR-006.
3. **Given** a decided `equal` row from a control that is `met` and a decided `intersects-with` row from one that is `not-met`, **When** the coverage is asked for, **Then** the target is `not-met`, per FR-006.
4. **Given** the framework `hipaa-security`, **When** it is written as an OSCAL catalog, **Then** the control `164.308.a.1` is written as `_164.308.a.1`, per FR-007.

## Out of scope

- The clauses 4 to 10 of ISO/IEC 27001: not mapped.
- The decision of a row of a crosswalk: a person's, recorded by removing the words and giving the relationship and the strength.
- The Payment Card Industry Data Security Standard: its text is licensed and its use here was not read, so no catalog and no crosswalk of it is written.

## Edge cases

- A proposal that names the same pair twice is refused, per FR-003.
- A source with no standing is `no-evidence`, per FR-006.
- An identifier that starts with a digit is written with an underscore in front in OSCAL, per FR-007.

## Assumptions

- The control identifiers of `nist-800-53` 5.2.0 are those of the catalog package `catalog-nist-sp800`.

## Open questions

- Whether a person who has read the published mappings will decide the rows, and which of the three published sources comes first.

## Key entities

- **Proposal**, **Crosswalk**, **Mapping**, **Standing**, **Coverage**, **OSCAL catalog**, **OSCAL mapping collection**.

## Success criteria

- **SC-001**: A person can read, for a control of one framework, which controls of another it is proposed to meet and why, and a program can add up what the standings of the first say of the second, without a score and without counting what nobody has decided.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
