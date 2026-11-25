# Feature Specification: Workbench resolution

**Spec ID:** 0005-workbench-resolution
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A task is made ready by exactly what it needs: the base and the contributions of the units it is about, nothing installed unless asked, and a test that has not been selected installs nothing.

## Requirements

- **FR-001**: `compose` MUST give, for a task and a selection of units, the base requirements and the requirements of the selected units that apply to the task, once each in the order of their ids, and a unit that is not selected MUST contribute nothing; the task `verify` MUST also take what `build` and `test` need, since verifying builds and tests.
- **FR-002**: A requirement named by the test needs of a unit MUST be part of a `test` task only where a selected test file matches one of the globs that name it (or, where no files are given, where its unit is selected), and a unit's other requirements MUST NOT include it; a glob MUST be able to say `*` (one segment), `**` (any segments) and `{a,b}` (either).
- **FR-003**: Selecting every unit MUST be possible only by asking for all of them, which is for the cold start of a pipeline and never the default.
- **FR-004**: `ready` without a selection MUST check the base alone, with a selection the base and the contributions composed, MUST obtain nothing unless asked, and MUST end with 1 only where a finding is an error: a hint or a warning never fails it.
- **FR-005**: With `ensure`, `ready` MUST run only the install argument vector of a requirement whose finding an agent may fix, never through a shell, never for a safety rule, a credential or a gate, and then look again and report what it obtained and for which requirement.
- **FR-006**: The probe MUST ask a program its version by running it with the argument vector the requirement names, read a credential as a name only and drop its value at once, and read a Git ref, the Git identity and an install of a folder with Git and the file system, and nothing more.

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

- Obtaining a program through the pinned downloads and the package managers of the toolchain library is a port the caller gives; the default installs by the requirement's own argument vector.

## Open questions

- None.

## Key entities

- **Workbench**, **Contract**, **Contribution**, **Dialect**.

## Success criteria

- **SC-001**: Every requirement of 0005-workbench-resolution is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
