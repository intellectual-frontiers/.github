# Feature Specification: DNS plugin: layers

**Spec ID:** 0001-dns-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `archon-dns` is the plugin that gives the command `archon` its verbs for DNS. It is a package of its own, a member of the Archon family as a plugin (commons 0033-kanon FR-019 to FR-024) whose noun `dns` the host declares, and it works on Headless and on `linux-services`.

## Requirements

- **FR-001**: The package MUST be a member of the family of `archon` as a plugin: its manifest `library.ts` MUST declare `family: { host: "archon", role: "plugin" }` and the field `kanon` with `extends` naming `@intellectual-frontiers/archon`, the host MUST declare the noun `dns`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no finding.
- **FR-002**: The package MUST reach `@intellectual-frontiers/archon` only through its exports, and MUST NOT import a dialect package or another plugin of the command: the provider is given by the fleet.
- **FR-003**: The package MUST export `.` (the plugin and its configuration).
- **FR-004**: `bun run verify` in the folder of the package MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The package MUST be released as `archon-dns-v<version>` (commons 0026-works-versioning).

## Acceptance scenarios

1. **Given** the real tree of the package, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.

## Out of scope

- The provider and the layout of a fleet: given by the fleet.

## Edge cases

- The module at the top of `src/` that re-exports the plugin is in the one unit of the package, per FR-001.

## Assumptions

- The shared checker of Kanon is on the branch that holds this package.

## Open questions

- None.

## Key entities

- **Plan hash**, **Zone**, **Provider**.

## Success criteria

- **SC-001**: A zone is changed only by the plan that a person approved by its hash, and the next plan is empty.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
