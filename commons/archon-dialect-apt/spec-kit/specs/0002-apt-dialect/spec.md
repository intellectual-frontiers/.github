# Feature Specification: apt dialect

**Spec ID:** 0002-apt-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What this dialect says of apt as data, and the call that makes it: Debian and Ubuntu's package manager, which checks the signed index of its repositories. It installs packages its repositories built, and builds nothing itself. It installs what the repositories offer: an exact version is installed only where a repository still offers it, and the check by the status of a package (`dpkg-query`) cannot tell an installed package from one that was removed and kept its settings. The commands are the packaging ontology's and the code is the kit's (commons package-managers 0004-package-managers-dialect).

## Requirements

- **FR-001**: The dialect MUST declare as data that it is the manager `manager-apt`, that it pins `exact`, checks by `signature`, installs in the scope system, reaches linux-x64, linux-arm64, takes the packages of a binding, and cannot build from source.
- **FR-002**: `apt(commands, options)` MUST give the dialect of the kit made from this data and the commands it is given, with the id `apt`, of the kind `tool`, so that Archon renders, steps and observes through the kit and this package holds no command line.
- **FR-003**: An exact version MUST be written joined to the name with `=` (`git=2.43.0`), as the manager writes it.
- **FR-004**: Toolchain MUST resolve a tool to this dialect only where its guarantees meet the control: for `rolling` it is chosen, for `release-line` it is chosen, and for `exact-hashed` it is not chosen: it does not check by a hash.

## Acceptance scenarios

1. **Given** the dialect, **When** its data is read, **Then** it is as FR-001 says.
2. **Given** commands, **When** a tool is rendered, **Then** the commands are those of the manager with the version as FR-003 says, per FR-002.
3. **Given** each control, **When** a tool is resolved, **Then** the dialect is chosen as FR-004 says.

## Out of scope

- Reading the commands from the ontology: the reader of the ontology gives them as a function.
- Proving idempotence on a real apt: a conformance run on a machine that has it.

## Edge cases

- A version asked of a manager that cannot write one is refused at render with the manager's reason, per FR-003.

## Assumptions

- What apt guarantees (what it checks, what it pins) is stated from its documentation and not proved by a run of this suite; the dialect states it and claims no more.

## Open questions

- None.

## Key entities

- **Manager spec** - the data of apt for the kit.

## Success criteria

- **SC-001**: A fleet whose control a manager cannot meet never gets it chosen.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
