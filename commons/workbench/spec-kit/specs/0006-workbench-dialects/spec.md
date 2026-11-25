# Feature Specification: Workbench dialects

**Spec ID:** 0006-workbench-dialects
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A dialect is how one kind of operator receives the contract: a harness, or a person. The matrix of requirement by dialect proves that none is left unprepared, and projections make the files every environment needs from the one contract.

## Requirements

- **FR-001**: The library MUST have three dialects as instances of its physical layer, `claude-code` and `codex` held by agents and `human` held by a person, each reached by its own entry of the package.
- **FR-002**: The matrix MUST have a row for each requirement and a cell for each dialect, each cell expressed, carried or unexpressed with a reason, and a cell that a dialect leaves unanswered MUST be a finding `dropped`.
- **FR-003**: A requirement that an agent dialect leaves unexpressed because a person is needed MUST be expressed by a human dialect, and where none is the matrix MUST give the finding `no-person`.
- **FR-004**: The setup script, the Containerfile, the pipeline step and the block of `AGENTS.md` MUST be the same bytes for the same contract, MUST carry only the base (what a unit contributes is obtained when its task runs), MUST hold no credential value and no shell built from a requirement's text, and a block put into a file MUST replace the one between its marks or be added at the end.
- **FR-005**: The human dialect MUST render a runbook with the setup checklist of the base, each stage with its autonomy level and gates, for each gate its approver, that the approver is never the author and the record of an approval, and how to review an agent's work in a worktree of one's own.
- **FR-006**: The Claude Code dialect MUST render the settings of the harness with a SessionStart hook that runs `workbench ready` and a deny rule for each command of a gate, and a file that points to `AGENTS.md`; the Codex dialect MUST render the block of `AGENTS.md`; each MUST be the same bytes each time, and a format of a harness MUST be checked against that harness's current documentation before a release.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is checked, **Then** it holds, per FR-001.
2. **Given** the case of FR-002, **When** it is checked, **Then** it holds, per FR-002.
3. **Given** the case of FR-003, **When** it is checked, **Then** it holds, per FR-003.
4. **Given** the case of FR-004, **When** it is checked, **Then** it holds, per FR-004.
5. **Given** the case of FR-005, **When** it is checked, **Then** it holds, per FR-005.
6. **Given** the case of FR-006, **When** it is checked, **Then** it holds, per FR-006.

## Out of scope

- Everything of the library that another of its specifications states.

## Edge cases

- A name that is not a name is refused where it is made, never later, per FR-001.

## Assumptions

- The Kanon checker's own matrix (`kanon/dropped`) reads a model of annotated elements; the workbench's matrix uses the same three dispositions over the requirements of a contract, and joining the two is a later step.

## Open questions

- None.

## Key entities

- **Workbench**, **Contract**, **Contribution**, **Dialect**.

## Success criteria

- **SC-001**: Every requirement of 0006-workbench-dialects is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
