# Feature Specification: AnyfsCli layers

**Spec ID:** 0001-anyfs-cli-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The library is Kanon: three layers, one checker, one `verify`, one version. The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no file outside a unit and no import outside the row of its unit.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-003**: The version the program says (`anyfs --version`) MUST be the constant `ANYFS_CLI_VERSION`, which the manifest names in `versionConstants`, and it MUST be the version of the manifest and of the package.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its `verify` script is read, **Then** it runs every check, per FR-002.
3. **Given** the manifest, the package and the constant, **When** their versions are read, **Then** they are one version, per FR-003.

## Out of scope

- The backends that plug in through the configuration: their own libraries.
- A mount of the stores as a file system (a WebDAV or NFS server, or FUSE): their own libraries.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A `verify` that leaves out a check: it is a finding of the test, per FR-002.
- A manifest whose version is not the constant's: it is a finding of the test, per FR-003.

## Assumptions

- The libraries `anyfs`, `anyfs-bridge`, `anyfs-posix`, `anyfs-ssh` and Headless are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **AnyfsCli** - the library.

## Success criteria

- **SC-001**: `bun run verify` in this folder passes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
