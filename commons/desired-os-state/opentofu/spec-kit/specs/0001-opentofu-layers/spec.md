# Feature Specification: opentofu dialect: layers

**Spec ID:** 0001-opentofu-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `desired-os-state-opentofu` is the dialect of Desired OS State for cloud resources (OpenTofu). It is a package of its own on the port of Desired OS State (commons desired-os-state 0004-desired-os-state-dialects) and a member of the Desired OS State family (commons 0033-kanon FR-019 to FR-024); it reaches `@intellectual-frontiers/desired-os-state` only through its exports.

## Requirements

- **FR-001**: The package MUST be a member of the family of `desired-os-state` as a dialect: its manifest `library.ts` MUST declare `family: { host: "desired-os-state", role: "dialect" }` and the field `kanon` with `extends` naming `@intellectual-frontiers/desired-os-state`, its sources MUST be one unit of the Physical layer (`src/`), and the host MUST declare it as an instance of the dialect port; the shared checker of `@intellectual-frontiers/kanon` MUST find no finding.
- **FR-002**: The package MUST reach `@intellectual-frontiers/desired-os-state` only through its exports (`governance`, `logical`, `dialect`), and MUST NOT import another dialect or a plugin of the command.
- **FR-003**: The package MUST export `.` (the dialect and its data).
- **FR-004**: `bun run verify` in the folder of the package MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The package MUST be released as `desired-os-state-opentofu-v<version>` (commons 0026-works-versioning).

## Acceptance scenarios

1. **Given** the real tree of the package, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source that imports another dialect, **When** the check runs, **Then** it is a finding, per FR-002.

## Out of scope

- The observation of what is on a machine: an observer outside the dialect (commons desired-os-state 0034-desired-os-state FR-010).
- The program that runs the steps: the headless executor and the plugin that drives it.

## Edge cases

- The module at the top of `src/` that re-exports the dialect is in the one unit of the package, per FR-001.

## Assumptions

- The desired-os-state is reached only through its exports, per FR-002.

## Open questions

- None.

## Key entities

- **Dialect** - the value of the port, made by this package.

## Success criteria

- **SC-001**: The package is its data and one call.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
