# Feature Specification: Actor retention

**Spec ID:** 0003-actor-retention
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0048-actors

**Input:** How long the digests of agent sessions are kept (commons 0048-actors FR-062), by the regime of a boundary, with its source and whether it was read.

## Requirements

- **FR-001**: The retention rules MUST be data, each with the regime, the period or its absence, the basis in our own words, the source and whether it was read; the rule of the HIPAA Security Rule (six years from the creation of the documentation or from when it was last in effect, whichever is later, the time limit of its documentation rule, read at the eCFR) MUST be marked read, and a rule that was not read MUST be marked unread and MUST NOT set or lower a floor.
- **FR-002**: The period of a boundary MUST be the longest fixed period of the rules that were read for its regimes, else six years; an override of the owner MUST replace it and MUST be refused where it is under the floor of a rule that was read or is not a whole number of years of at least one; the regimes with no rule that was read MUST be listed as unresolved.
- **FR-003**: Dropping digests MUST be an act with a record (the digests, when they were created, when they were dropped, the period, what set it and who did it), and MUST be refused where any digest is not past its period.

## Acceptance scenarios

1. **Given** the regime hipaa, **When** the retention is asked, **Then** it is six years set by hipaa, per FR-002.
2. **Given** an override of three years for hipaa, **When** the retention is asked, **Then** it is refused under the floor of six, per FR-002.
3. **Given** digests created five years ago and a period of six, **When** they are expired, **Then** it is refused, per FR-003.

## Out of scope

- Qualification and tasking certificates, the directive-first refusal of regulated verbs, the review canary and the dossier lens of commons 0048-actors: they come after the first acceptance run and are stated there.

## Edge cases

- A regime that is not in the table: the default applies and the regime is unresolved, per FR-002.
- No digests: refused, per FR-003.

## Assumptions

- The first version is the simplest slice that is valuable: it records, finds and lints; it refuses nothing at a verb (commons 0048-actors FR-022 is a finding first).

## Open questions

- None.

## Key entities

- **Actor** - a person, a system or an agent. **Act** - what the six roles are held in.

## Success criteria

- **SC-001**: The tests of this specification pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
