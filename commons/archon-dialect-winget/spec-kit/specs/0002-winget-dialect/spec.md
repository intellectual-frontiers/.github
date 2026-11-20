# Feature Specification: WinGet dialect

**Spec ID:** 0002-winget-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What this dialect says of WinGet as data, and the call that makes it: WinGet, whose manifests carry the SHA-256 of each installer, which it checks before it runs one. It runs the installers its manifests name, and builds nothing itself. The status of its query of an installed package is not known to this dialect, so it has no check and `apply` asks WinGet to install again, which WinGet treats as nothing to do; that a manifest's hash is checked is WinGet's guarantee and is stated, not proved here. The commands are the packaging ontology's and the code is the kit's (commons package-managers 0004-package-managers-dialect).

## Requirements

- **FR-001**: The dialect MUST declare as data that it is the manager `manager-winget`, that it pins `exact`, checks by `hash`, installs in the scope user and system, reaches windows-x64, takes the packages of a binding, and cannot build from source.
- **FR-002**: `winget(commands, options)` MUST give the dialect of the kit made from this data and the commands it is given, with the id `winget`, of the kind `tool`, so that Archon renders, steps and observes through the kit and this package holds no command line.
- **FR-003**: An exact version MUST be written as flags after the name (`--id Git.Git --exact --version 2.43.0`), for one package.
- **FR-004**: Toolchain MUST resolve a tool to this dialect only where its guarantees meet the control: for `rolling` it is chosen, for `release-line` it is chosen, and for `exact-hashed` it is chosen.

## Acceptance scenarios

1. **Given** the dialect, **When** its data is read, **Then** it is as FR-001 says.
2. **Given** commands, **When** a tool is rendered, **Then** the commands are those of the manager with the version as FR-003 says, per FR-002.
3. **Given** each control, **When** a tool is resolved, **Then** the dialect is chosen as FR-004 says.

## Out of scope

- Reading the commands from the ontology: the reader of the ontology gives them as a function.
- Proving idempotence on a real WinGet: a conformance run on a machine that has it.

## Edge cases

- A version asked of a manager that cannot write one is refused at render with the manager's reason, per FR-003.

## Assumptions

- What WinGet guarantees (what it checks, what it pins) is stated from its documentation and not proved by a run of this suite; the dialect states it and claims no more.

## Open questions

- None.

## Key entities

- **Manager spec** - the data of WinGet for the kit.

## Success criteria

- **SC-001**: A fleet whose control a manager cannot meet never gets it chosen.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
