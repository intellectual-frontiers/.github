# Feature Specification: Integrations standards registry

**Spec ID:** 0007-integrations-standards
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The standards of exchange are registry entries (governance 0002 FR-010 to FR-015). This specification says which are planned, and what each licence is understood to allow. The licence facts below are my understanding at writing time and MUST be verified against each issuer's terms and cited in the entry (`license.terms`) before a plugin ships them; the library embeds no standard.

## The catalogue

- **FR-001**: FHIR R4 (4.0.1) and US Core MUST be the first entries: HL7 publishes FHIR under an open licence (Creative Commons CC0 for the specification text, as HL7 states on its FHIR licence page), so their machine-readable definitions MAY be embedded with the licence cited; this MUST be verified at the issuer before publication.
- **FR-002**: X12 transaction sets, implementation guides and companion guides MUST be treated as licensed: they are sold by their issuer (X12 publishes them for purchase), so the schema loader MUST read them from the user's licensed copy and nothing of them MUST be embedded or committed.
- **FR-003**: HL7 v2 message definitions and EDIFACT directories MUST each have their own terms recorded as data before a plugin embeds anything; until verified they MUST be `user-supplied`.
- **FR-004**: Terminologies MUST each record a licence: ICD-10 (WHO and national modifications), LOINC (free licence from Regenstrief), SNOMED CT (affiliate licence of SNOMED International, free in member countries, not otherwise), CPT (a licence of the American Medical Association, never embedded), NPI (a public registry of the US government) and UCUM (a licence of the Regenstrief Institute); each MUST be verified and cited, and where unverified MUST be `user-supplied`.

## Acceptance scenarios

1. **Given** a plugin that embeds a CPT code list, **When** the gate runs, **Then** it is a finding, per 0002 FR-015.

## Out of scope

- Embedding any standard in this library.

## Edge cases

- A licence that is not yet verified: recorded as `user-supplied`, never `allowed`, per FR-003.

## Assumptions

- The licence facts in this specification are unverified understandings and are marked so; the conformance check holds the plugin to the entry, not to this prose.

## Open questions

- **OQ-1**: The exact terms of each issuer, to be verified and cited when each plugin is built.

## Key entities

- **Standard** - a registry entry.

## Success criteria

- **SC-001**: No content a licence does not allow is ever committed to this public repository.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
