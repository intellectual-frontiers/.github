# Feature Specification: Native-pinned layers

**Spec ID:** 0001-native-pinned-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `archon-dialect-native-pinned` is the default dialect of tools: it obtains the programs a computer needs as the publishers released them, pinned by the SHA-256 of the artifact, into a folder of the user's own, with no administrator rights and no package manager. It is a package of its own on the port of Archon (commons archon 0004-archon-dialects), a member of the Archon family (commons 0033-kanon FR-019 to FR-024), and it resolves tools with Toolchain (commons toolchain 0003-toolchain-logical). It builds nothing from source.

## Requirements

- **FR-001**: The package MUST be a member of the family of `archon` as a dialect: its manifest `library.ts` MUST declare `family: { host: "archon", role: "dialect" }` and the field `kanon` with `extends` naming `@intellectual-frontiers/archon`, its sources MUST be one unit of the Physical layer (`src/`), and the host MUST declare it as an instance of the dialect port; the shared checker of `@intellectual-frontiers/kanon` MUST find no finding.
- **FR-002**: The package MUST reach `@intellectual-frontiers/archon` only through its exports (`governance`, `logical`, `dialect`) and `@intellectual-frontiers/toolchain` only through its exports (`governance`, `logical`, `ontology`), and MUST NOT import another dialect or a plugin of the command.
- **FR-003**: The package MUST export `.` (the dialect), `./install` (the pure logic of an install, so that another program that installs pinned tools uses it and keeps no copy) and `./pin` (the pin tool).
- **FR-004**: `bun run verify` in the folder of the package MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The package MUST be released as `archon-dialect-native-pinned-v<version>` (commons 0026-works-versioning).
- **FR-006**: No source of the package MUST run a package manager, ask for administrator rights, or run a compiler or a build: it installs what its publisher released and nothing else.

## Acceptance scenarios

1. **Given** the real tree of the package, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source that imports another dialect, **When** the check runs, **Then** it is a finding, per FR-002.
3. **Given** the sources, **When** they are read, **Then** none names `sudo`, `apt`, `brew`, `winget`, `cargo build` or `make`, per FR-006.

## Out of scope

- The other dialects of tools (package managers): packages of their own.
- The command a person types (`archon tool ...`): a plugin.

## Edge cases

- A source that runs `git`: allowed only where it is not a package manager; none is needed, per FR-006.

## Assumptions

- The shared checker of Kanon and the family rules are on the branch that holds this package.

## Open questions

- None.

## Key entities

- **Native-pinned** - the dialect.
- **Install** - what the dialect does for one tool.

## Success criteria

- **SC-001**: The layers check of Kanon finds nothing in the real tree.
- **SC-002**: No source can install anything but a pinned artifact.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
