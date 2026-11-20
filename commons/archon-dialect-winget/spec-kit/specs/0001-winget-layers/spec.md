# Feature Specification: WinGet dialect: layers

**Spec ID:** 0001-winget-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `archon-dialect-winget` is the dialect of tools that installs them with WinGet: WinGet, whose manifests carry the SHA-256 of each installer, which it checks before it runs one. It is a package of its own on the port of Archon (commons archon 0004-archon-dialects), a member of the Archon family (commons 0033-kanon FR-019 to FR-024), resolved by Toolchain (commons toolchain 0003-toolchain-logical), and it holds only the data of the manager: the code it shares with the other manager dialects is in `@intellectual-frontiers/package-managers`.

## Requirements

- **FR-001**: The package MUST be a member of the family of `archon` as a dialect: its manifest `library.ts` MUST declare `family: { host: "archon", role: "dialect" }` and the field `kanon` with `extends` naming `@intellectual-frontiers/archon`, its sources MUST be one unit of the Physical layer (`src/`), and the host MUST declare it as an instance of the dialect port; the shared checker of `@intellectual-frontiers/kanon` MUST find no finding.
- **FR-002**: The package MUST reach `@intellectual-frontiers/archon` only through its exports (`governance`, `logical`, `dialect`), `@intellectual-frontiers/toolchain` only through its exports (`governance`, `logical`, `ontology`) and the kit by `@intellectual-frontiers/package-managers`, and MUST NOT import another dialect or a plugin of the command.
- **FR-003**: The package MUST export `.` (the dialect and its data).
- **FR-004**: `bun run verify` in the folder of the package MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The package MUST be released as `archon-dialect-winget-v<version>` (commons 0026-works-versioning).

## Acceptance scenarios

1. **Given** the real tree of the package, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source that imports another dialect, **When** the check runs, **Then** it is a finding, per FR-002.

## Out of scope

- The command lines, the plan file, the program and the observation: the kit.
- The commands of the manager: the packaging ontology.

## Edge cases

- The module at the top of `src/` that re-exports the dialect is in the one unit of the package, per FR-001.

## Assumptions

- The kit is a library of commons that is no member of the family, so a dialect may use it, per FR-002.

## Open questions

- None.

## Key entities

- **Dialect** - the value of the port, made by the kit from this package's data.

## Success criteria

- **SC-001**: The package is its data and one call.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
