# Feature Specification: Archon assembly

**Spec ID:** 0005-archon-assembly
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** One command, `archon`, whose verbs come from plugins (`archon-tool`, `archon-server`, `archon-device`, and so on) that are installed separately and assembled by a fleet in a small composition root (commons 0034-archon, commons headless 0009-composition). Archon is the host: it names the program, holds the ladder of tiers, has one verb of its own that says what was assembled, and runs the composed program. Which verbs a caller sees is governance (tier, audience, effect); where a verb runs is reach.

## Requirements

- **FR-001**: `archonHost(version, plugins)` MUST be the program `archon` with the environment prefix `ARCHON`, the default ladder of tiers (public, operator, administrator) and one verb of its own, `plugins`, a report that only reads: it MUST list each assembled plugin by its id with its version and purpose, in the order of the ids, and say so where there is none.
- **FR-002**: `assemble(plugins, version)` MUST compose the host with the plugins through Headless and return one program, whatever the order the plugins are given in; it MUST return every conflict as a value and no program (two plugins claiming one verb, a plugin of another program, one composed twice, a requirement not composed) and MUST NOT choose a winner.
- **FR-003**: `main(plugins, version, argv, deps)` MUST run the assembled program with the tier the environment variable `ARCHON_TIER` names (the lowest tier where it says nothing), MUST end with 2 and name the tiers where the word is not one of them, and MUST end with 3 and name each conflict where the plugins cannot be assembled; it MUST read the environment and write the report and the problems only through `deps`.
- **FR-004**: A plugin MUST be a package named `archon-<noun>` whose noun the manifest of Archon declares in its table (`kanon.plugins`), and the package MUST export the assembly as `./cli`, so that a fleet assembles the command by importing the plugins it wants and nothing else.

## Acceptance scenarios

1. **Given** no plugin, **When** `archon plugins` runs, **Then** it says no plugin is assembled and ends with 0, per FR-001.
2. **Given** two plugins, **When** they are assembled in either order, **Then** the program, its verbs and `archon plugins` are the same, per FR-002.
3. **Given** two plugins that each claim the verb `server list`, **When** they are assembled, **Then** the result is a conflict that names both and no program, per FR-002.
4. **Given** `ARCHON_TIER=operator`, **When** a verb of the tier operator is run, **Then** it runs; **Given** `ARCHON_TIER=wizard`, **Then** it ends with 2 naming the tiers, per FR-003.
5. **Given** plugins that conflict, **When** `main` runs, **Then** it ends with 3 and names the conflict, per FR-003.
6. **Given** the manifest, **When** its plugins are read, **Then** `tool` is declared and `./cli` is exported, per FR-004.

## Out of scope

- The plugins themselves: each is a package with its own specifications.
- The composition root of a fleet: it is the fleet's, and holds which plugins and dialects the fleet uses.

## Edge cases

- A tier word with capitals or spaces is not a tier and ends with 2, per FR-003.
- Plugins given in the other order give the same program, per FR-002.

## Assumptions

- The default ladder of Headless is the ladder of `archon`: a fleet that needs another declares it in its own composition, not here.

## Open questions

- None.

## Key entities

- **Host** - the program `archon` and its verb `plugins`.
- **Plugin** - the value a package `archon-<noun>` exports for composition.

## Success criteria

- **SC-001**: A fleet gets one command from the plugins it chose, with one help and one gate, and never a verb it did not install.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
