# Feature Specification: Homebrew dialect

**Spec ID:** 0002-homebrew-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What this dialect says of Homebrew as data, and the call that makes it: Homebrew, which installs the current bottle of a formula in a folder of the user's own, checked by the SHA-256 of the bottle. Homebrew builds a formula from source where it has no bottle and no option known to this dialect forbids it, so the dialect says it can build from source and is used only where the fleet approved source builds. It pins no version: it follows Homebrew's current formula, so it serves only fleets whose control `toolIntegrity` is `rolling`. The commands are the packaging ontology's and the code is the kit's (commons package-managers 0004-package-managers-dialect).

## Requirements

- **FR-001**: The dialect MUST declare as data that it is the manager `manager-brew`, that it pins `rolling`, checks by `hash`, installs in the scope user, reaches macos-x64, macos-arm64, linux-x64, linux-arm64, takes the packages of a binding, and can build from source.
- **FR-002**: `homebrew(commands, options)` MUST give the dialect of the kit made from this data and the commands it is given, with the id `homebrew`, of the kind `tool`, so that Archon renders, steps and observes through the kit and this package holds no command line.
- **FR-003**: An exact version MUST be written not at all: Homebrew installs the current version of a formula, and an older line is a formula of its own (`jq@1`) named as the package.
- **FR-004**: Toolchain MUST resolve a tool to this dialect only where its guarantees meet the control: for `rolling` it is chosen only where the fleet approved source builds, for `release-line` it is not chosen: it pins less exactly than the control asks, and for `exact-hashed` it is not chosen: it pins less exactly than the control asks.

## Acceptance scenarios

1. **Given** the dialect, **When** its data is read, **Then** it is as FR-001 says.
2. **Given** commands, **When** a tool is rendered, **Then** the commands are those of the manager with the version as FR-003 says, per FR-002.
3. **Given** each control, **When** a tool is resolved, **Then** the dialect is chosen as FR-004 says.

## Out of scope

- Reading the commands from the ontology: the reader of the ontology gives them as a function.
- Proving idempotence on a real Homebrew: a conformance run on a machine that has it.

## Edge cases

- A version asked of a manager that cannot write one is refused at render with the manager's reason, per FR-003.

## Assumptions

- What Homebrew guarantees (what it checks, what it pins) is stated from its documentation and not proved by a run of this suite; the dialect states it and claims no more.

## Open questions

- None.

## Key entities

- **Manager spec** - the data of Homebrew for the kit.

## Success criteria

- **SC-001**: A fleet whose control a manager cannot meet never gets it chosen.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
