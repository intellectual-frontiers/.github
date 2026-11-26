# Feature Specification: Actor roles

**Spec ID:** 0002-actor-roles
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0048-actors

**Input:** The actors and the six roles of an act, with the rule of which kind of actor may hold which role in the types (commons 0048-actors FR-001, FR-010 to FR-014, FR-022, FR-040).

## Requirements

- **FR-001**: An actor MUST be a person, a system or an agent, with an id; an agent MUST carry the model it says it runs, with the assurance `reported` (the controller cannot check it), and MAY carry the digest of its instruction set; a value from outside MUST be decoded into one of the three or refused with the path of the field.
- **FR-002**: The types MUST make an agent as initiator, reviewer or approver a program that does not type check, and the decoder of an act MUST refuse such a value with an error that names the role (`initiatedBy`, `reviewedBy` or `approvedBy`) and the kind found.
- **FR-003**: The executor MUST be a person or a system, the assistant an agent or a system and the preparer any kind; a value of another kind MUST be refused with the role named.
- **FR-004**: The initiator of an act that names a directive MUST be the owner of the directive; an act that an agent took part in and that names no directive MUST be undirected and MUST be reported as a finding (it is not refused at first); the reviewer being the preparer, and one person being initiator, reviewer and approver, MUST be reported as findings; and the tasking levels T0 to T3 MUST allow what commons 0048-actors FR-040 says, each level allowing what the levels below it allow.

## Acceptance scenarios

1. **Given** an act with an agent as initiator, **When** it is decoded, **Then** it is refused naming `initiatedBy`, per FR-002.
2. **Given** an act with a person as initiator and an agent as preparer under a directive that the person owns, **When** it is decoded, **Then** it is an act, per FR-001 and FR-004.
3. **Given** the same act with no directive, **When** its findings are read, **Then** it is undirected, per FR-004.

## Out of scope

- Qualification and tasking certificates, the directive-first refusal of regulated verbs, the review canary and the dossier lens of commons 0048-actors: they come after the first acceptance run and are stated there.

## Edge cases

- An agent as executor is refused, per FR-003.
- A directive owned by another person than the initiator is refused, per FR-004.

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
