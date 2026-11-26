# Feature Specification: Desired OS State tool plugin: layers

**Spec ID:** 0001-tool-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `desired-os-state-tool` is the plugin that gives the command `desired-os-state` its verbs for tools. It is a package of its own, a member of the Desired OS State family as a plugin (commons 0033-kanon FR-019 to FR-024) whose noun `tool` the host declares, and it works on Toolchain (commons toolchain) and Headless composition (commons headless 0009-composition). It holds no catalog of tools and no dialect: a fleet gives it both.

## Requirements

- **FR-001**: The package MUST be a member of the family of `desired-os-state` as a plugin: its manifest `library.ts` MUST declare `family: { host: "desired-os-state", role: "plugin" }` and the field `kanon` with `extends` naming `@intellectual-frontiers/desired-os-state`, the host MUST declare the noun `tool`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no finding.
- **FR-002**: The package MUST reach `@intellectual-frontiers/desired-os-state` and `@intellectual-frontiers/toolchain` only through their exports, and MUST NOT import a dialect package or another plugin of the command: the dialects are given by the fleet.
- **FR-003**: The package MUST export `.` (the plugin and its configuration).
- **FR-004**: `bun run verify` in the folder of the package MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests under Bun and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-005**: The package MUST be released as `desired-os-state-tool-v<version>` (commons 0026-works-versioning).

## Acceptance scenarios

1. **Given** the real tree of the package, **When** the layers check runs, **Then** it finds nothing, per FR-001 and FR-002.
2. **Given** a source that imports a dialect package, **When** the check runs, **Then** it is a finding, per FR-002.

## Out of scope

- The catalog of tools and the dialects: the fleet's.
- The assembly of the command: Desired OS State.

## Edge cases

- The module at the top of `src/` that re-exports the plugin is in the one unit of the package, per FR-001.

## Assumptions

- A test in `suite/` may use the shared kit of the manager dialects to make a dialect, because the kit is no member of the family, per FR-002.

## Open questions

- None.

## Key entities

- **Plugin** - the value `toolPlugin` makes for composition.

## Success criteria

- **SC-001**: Two fleets with different tools and dialects use the same plugin.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
