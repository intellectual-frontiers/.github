# Feature Specification: Assurance lenses

**Spec ID:** 0002-assurance-lenses
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0046-dossiers

**Input:** The first lenses of the dossier family (commons 0046-dossiers FR-091): the acceptance of a case, the findings with a plan of action and milestones, how each requirement stands, and what is missing. Each reads sources whose bodies it decodes, cites them, says how old they are, and says so where it has none.

## Requirements

- **FR-001**: The sources the lenses read MUST be of three kinds: `acceptance-run` (a case, its title, optionally the system, its steps each with an id, a title, a result of `pass`, `fail` or `not-run`, who made it (`tool` or `person`) and a note, and optionally the person who approved the run), `finding-set` (findings each with an id, a title, a severity, a status of `open`, `accepted` or `fixed`, and optionally a control, a milestone and a date), and `reading` (a requirement and its standing of `met`, `partial`, `not-met` or `no-evidence`); a body of another shape MUST be refused with what is wrong and the id of the source.
- **FR-002**: The `acceptance` lens MUST give, for each run in the order of the case and the instant, the counts of passed, failed and not-run steps, a table of the steps with their result, who made them and the note, and the freshness of the evidence; it MUST say that no person has approved a run that no person approved, and that a step only a person can do has not been done where one is not run; and it MUST give a plate that says there is no evidence where it has no run.
- **FR-003**: The `findings` lens MUST give the count of the findings in each status, taking for each finding the state in the latest set that holds it, and a table of the open ones in the order of severity and id with the control, the milestone, the date and the evidence; it MUST name the open findings that have no milestone or no date; and it MUST say that none is open, or that there is no evidence, where that is so.
- **FR-004**: The `posture` lens MUST give, for each requirement, one row from its latest reading with the standing and the evidence with its freshness, and the count of each standing, and MUST give no percentage; where a reading carries the requirement's title or who answers for it, the row MUST show them, and where none does the table MUST have no such column.
- **FR-005**: The `negative-space` lens, given the requirements that should have a reading and the greatest age of a reading in days, MUST list each requirement with no reading, with a reading that says there is no evidence, is not met or is only partly met, or whose reading is older than the limit, say why, and say how many requirements show a gap and how many show none; it MUST NOT leave out a gap because another lens shows the requirement as met.
- **FR-006**: Every plate of these lenses MUST cite only sources it was given, and the lenses MUST be given to a build as lenses of a registry (`ASSURANCE_LENSES`), and their parameters MUST be refused where they are not a title (and for the negative space a list of requirements and a whole number of days).

## Acceptance scenarios

1. **Given** a run with a step a person has not done and no approval, **When** the acceptance lens is built, **Then** the plate says both, per FR-002.
2. **Given** an open finding with no milestone, **When** the findings lens is built, **Then** the plate names it, per FR-003.
3. **Given** a requirement with a stale reading, **When** the negative space is built, **Then** it is listed with its age, per FR-005.

## Out of scope

- Where the sources come from: the product that builds the dossier.
- Lenses of a framework (CMMC, SOC 2, FedRAMP, HIPAA) and of a pentest: further plugins.

## Edge cases

- A finding in two sets is shown in the state of the later set, per FR-003.
- A requirement given twice is listed once, per FR-005.
- An empty list of requirements gives a plate that says no requirement has a gap, per FR-005.

## Assumptions

- The bodies are decoded from JSON that another library or a product wrote.

## Open questions

- None.

## Key entities

- **Acceptance run**, **Finding set**, **Reading**.

## Success criteria

- **SC-001**: An assessor reads what ran, what is open, how each requirement stands and what is missing, with the evidence behind each statement.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the requirements of commons 0046-dossiers it proves
