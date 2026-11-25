# Feature Specification: GRC plan of action and milestones from planned findings

**Spec ID:** 0016-grc-poam
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** A plan of action and milestones (a POA&M) is kept in Planning as items: an item of kind `finding` whose milestones are linked items of kind `task`, each with a day it is due and its owners, the finding bearing on controls of any framework (commons planning 0006-planning-poam). The `oscal` serializer of 0004-grc-documents FR-007 already writes a `plan-of-action-and-milestones` of the findings and risks of an assessment; this specification makes it write the same document from such planned findings too, with their milestones, owners and days, so that what a team plans in Planning is the document it gives an assessor. The library `grc` does not import Planning: it states the shape it reads, which the view `poam` of Planning gives as it is.

## Requirements

- **FR-001**: The library MUST state a planned finding as data (`PlannedFinding`): its id, title, body, severity (optional), state, status (`open`, `delayed` or `completed`), control references, owners, milestones (each with its id, title, owners, day due, state, status and instant of completion, the day and the instant optional) and scheduled completion (optional); and `plannedFindings` MUST decode it from a value read from outside as a `Result` whose error names the member that is wrong, refusing a day that is not a day, a status that is not one of the three, and a control reference that is not a control URN of 0002-grc-governance (`parseControlUrn`), so that no reference is invented or guessed.
- **FR-002**: The `oscal` serializer, for the model `plan-of-action-and-milestones` and the option `planned` (an array of planned findings), MUST write for each planned finding: a `risk` (its title, description, statement, `status` `remediating` where it has a milestone and `open` where it has none, the `deadline` of its scheduled completion, and a `remediation` of lifecycle `planned`, or `completed` where its status is completed, whose `tasks` are its milestones); a `finding` for each control reference (its target the control and `not-satisfied`, related to the risk); and a `poam-item` with `related-findings` (the findings of its controls) and `related-risks` (its risk), as the OSCAL model requires.
- **FR-003**: Each milestone MUST be written as an OSCAL `task` of `type` `milestone` with its title, its `timing` as `on-date` at its day due (where it has one) and a property for its status, and its owners MUST be written as `parties` of type `person` with the role `owner` in the metadata of the document and as the `responsible-roles` of the task, each party with a `uuid` derived from the owner's name; a document with no owner MUST hold no roles and no parties.
- **FR-004**: Every `uuid` of what FR-002 and FR-003 write MUST be a version 5 UUID of the assessment's id and a stable name (0004-grc-documents FR-004, FR-006: the kind of thing and the ids of the planned finding, the milestone, the control or the owner), so that the same assessment and the same planned findings give the same bytes whatever the order they are given in, and the entries MUST be written in the order of the ids.
- **FR-005**: The control references of planned findings MUST be written as the findings and assessments of the library write controls (the control of the URN, with its framework in a property; and the control of another framework where the option `framework` and a crosswalk of `equal` say so), so that planned findings bearing on the controls of several frameworks are one document; the planned findings MUST be added to the findings and risks of the assessment and MUST NOT replace them, and where there are none of any kind the document MUST say that nothing is open, as before.
- **FR-006**: WHERE the option `planned` is present and is not an array of planned findings, the serializer MUST return an `invalid` problem that says what is wrong and write nothing; for any other model the option MUST be ignored.
- **FR-007**: The document MUST be valid against the OSCAL JSON schema of the version the serializer writes, with planned findings having milestones, owners and several frameworks, where the schema is at hand (0004-grc-documents FR-007).

## Scenarios

- **Given** a planned finding with two milestones of different days and owners, **When** the plan of action and milestones is written, **Then** it has one risk with a deadline, one remediation with two tasks of type milestone with `on-date`, and one poam-item that relates the risk and the findings, per FR-002 and FR-003.
- **Given** planned findings in two orders, **When** they are written, **Then** the bytes are the same, per FR-004.
- **Given** a planned finding that bears on a control of one framework and a control of another, **When** it is written, **Then** it has a finding for each, each with its framework, per FR-005.
- **Given** a control reference that is not a control URN, **When** the planned findings are decoded or written, **Then** the result is an error that names it, per FR-001 and FR-006.
- **Given** an assessment with open findings and planned findings, **When** the plan is written, **Then** it holds both, per FR-005.
- **Given** the document written with milestones, owners and two frameworks, **When** it is validated against the schema, **Then** it is valid, per FR-007.

## Out of scope

- Reading a POA&M back into Planning, and the signing of the document.
- Deciding what is open: Planning's view does, and the library writes what it is given.

## Edge cases

- A planned finding with no milestone and no control: a risk and a poam-item that relates the risk only, per FR-002.
- A milestone with no day due: a task with no `timing`, per FR-003.
- An owner who owns two milestones: one party, per FR-003 and FR-004.

## Assumptions

- The days of Planning are days and not instants; OSCAL wants a date and time with a zone, so a day is written as that day at 00:00:00 UTC.
- The OSCAL version is the one the serializer constants say (`OSCAL_VERSION`); the model of the milestone is the one of that version, read in the OSCAL documentation.

## Open questions

- None.

## Key entities

- **Planned finding** - a finding of Planning, with its milestones, as this library reads it.
- **Milestone** - a task with a day due and owners.

## Standards considered

Each source below was read on 2026-11-25: the OSCAL 1.1.3 reference of the plan of action and milestones model (JSON format) and the OSCAL 1.2.3 complete JSON schema, a release file of the OSCAL project. An IRI is written only where it was read.

| Standard (version) | What the library takes from it | Chosen |
| --- | --- | --- |
| NIST OSCAL plan of action and milestones model, 1.1.3 reference and 1.2.3 schema | `poam-item` (`title`, `description`, `related-findings`, `related-risks`); `risk` (`title`, `description`, `statement`, `status` of `open`, `investigating`, `remediating`, `deviation-requested`, `deviation-approved` or `closed`, `deadline`, `remediations`); a `response` (`lifecycle` of `recommendation`, `planned` or `completed`, `title`, `description`, `tasks`); a `task` (`type` of `milestone` or `action`, `title`, `timing` of `on-date`, `within-date-range` or `at-frequency`, `responsible-roles`); a `finding` (`target` with `type`, `target-id` and `status`); `metadata` `roles` and `parties` | Milestones are the `tasks` of the remediation of the risk; owners are `parties` with the role `owner`; the properties are in the namespace the serializer already uses |

## Success criteria

- **SC-001**: What a team plans as a finding with milestones in Planning is a valid OSCAL plan of action and milestones with no step by hand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
