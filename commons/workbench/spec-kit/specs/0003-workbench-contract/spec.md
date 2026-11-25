# Feature Specification: Workbench contract

**Spec ID:** 0003-workbench-contract
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The contract of a repository: a base every task needs and contributions from the units that need more, with roles, gates and autonomy levels so that people and agents are both first-class and a regulated stage stops for a person.

## Requirements

- **FR-001**: A requirement MUST be one of six kinds, `program`, `credential`, `network`, `git`, `install` and `authority`, with an id of lower case words joined by hyphens, a concept, a task (`any`, `build`, `test`, `verify`, `release` or `run`), whether it is a safety rule and a summary, and a name that is not a name of its kind (a program, a host, a folder inside the repository, a gate) MUST be refused where it is made, as MUST an install or a probe that is not an argument vector free of shell syntax.
- **FR-002**: A contribution MUST be one unit's requirements and its test needs, each a glob of test files and the ids of the requirements those tests need, so that a runner knows what a selected test needs before it runs; a test need for a requirement that is none MUST be refused, as MUST a unit that contributes twice.
- **FR-003**: `defineContract` MUST return a contract or every reason it is not one: a name that is not a name, an `enforceFrom` that is not a day, an id used twice, a role or a gate or a stage used twice, a gate whose approver is not a role or is a role not held by a person, a stage that names a gate that is none, an authority that names a gate that is none, and a test need for a requirement that is none.
- **FR-004**: There MUST be four autonomy levels, `human-only`, `agent-proposes`, `agent-acts-human-reviews` and `agent-autonomous`, each allowing an agent more actions than the one before and `human-only` none, and an approval and a signed tag MUST be a person's at every level; the level of a stage the contract calls regulated and says no more of MUST be `agent-proposes`.
- **FR-005**: A credential requirement MUST name environment variables, in capitals and underscores, and never a value: a name that is not one MUST be refused with a message that does not repeat it.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is checked, **Then** it holds, per FR-001.
2. **Given** the case of FR-002, **When** it is checked, **Then** it holds, per FR-002.
3. **Given** the case of FR-003, **When** it is checked, **Then** it holds, per FR-003.
4. **Given** the case of FR-004, **When** it is checked, **Then** it holds, per FR-004.
5. **Given** the case of FR-005, **When** it is checked, **Then** it holds, per FR-005.

## Out of scope

- Everything of the library that another of its specifications states.

## Edge cases

- A name that is not a name is refused where it is made, never later, per FR-001.

## Assumptions

- Where a contract is kept: in the manifests of the units (the `library.ts` of a library of commons, the `item.ts` of a part of erga) as the optional field `workbench`; this specification fixes the shape, and the manifests' own specifications admit the field.

## Open questions

- None.

## Key entities

- **Workbench**, **Contract**, **Contribution**, **Dialect**.

## Success criteria

- **SC-001**: Every requirement of 0003-workbench-contract is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
