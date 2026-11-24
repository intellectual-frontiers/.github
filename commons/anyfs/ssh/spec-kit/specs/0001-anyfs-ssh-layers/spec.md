# Feature Specification: AnyFS SSH layers

**Spec ID:** 0001-anyfs-ssh-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The SSH backend of AnyFS is a plugin of the family of AnyFS: it extends the host library, reaches the hosts only through the executor of Headless, ships held from the registries until its first consumer runs on it, and is proved by its own `verify`.

## Requirements

- **FR-001**: The library MUST be a plugin of the family of AnyFS: its manifest `library.ts` MUST name the host `anyfs` and the role `plugin`, declare `extends: "@intellectual-frontiers/anyfs"` and the table of its units in the field `kanon`, and the shared checker of `@intellectual-frontiers/kanon` MUST find nothing in its tree.
- **FR-002**: `bun run verify` in the folder of the library MUST run the check that the module of the helper is made from its script, the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests and the packer.
- **FR-003**: No source of the library MUST build an `ssh` command line of its own: it MUST reach a host only through an `Executor` of `@intellectual-frontiers/headless`, so that the options, the quoting and the host-key policy are those of the executor, and the ban of Headless on hand-built ssh arguments MUST find nothing in `src/` and `tools/`.
- **FR-004**: The library MUST be held from the registries (`held` in its manifest, with the reason) until the fleet store runs on it, and its distribution MUST be the GitHub package registry alone until it is released.
- **FR-005**: `bun tools/pack.ts` MUST pack the library as the package `@intellectual-frontiers/anyfs-ssh` with declarations for every export, and `verify` MUST run it with `--check`.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the sources of the library, **When** the ban on hand-built ssh arguments reads them, **Then** it finds none, per FR-003.

## Out of scope

- A dialect for hosts that have PowerShell, `batch`, `history`, ranges and streams, and the fleet store itself: their own specifications.

## Edge cases

- A source that builds an ssh vector with `BatchMode` or `-T`: a finding of the ban, per FR-003.
- A `verify` that leaves out the check of the helper module: a finding of the test, per FR-002.

## Assumptions

- The host has a POSIX shell and the utilities of POSIX, and a tool for SHA-256.

## Open questions

- None.

## Key entities

- **The helper** - the script that runs on the host.
- **The store** - the store of AnyFS over a folder of the host.

## Success criteria

- **SC-001**: The tests of the specification pass under dash and bash.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
