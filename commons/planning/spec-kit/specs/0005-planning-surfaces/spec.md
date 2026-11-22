# Feature Specification: Planning surfaces

**Spec ID:** 0005-planning-surfaces
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The surfaces of Planning (commons 0037-planning phase 6): the typed configuration `planning.config.ts`, the program `planctl` on Headless, its tool server, the principal of a run and the SQL relations. It realizes the requirements of commons 0037-planning named below and only cites upward. The SQL relations are in the library `planning-query`, which has its own spec kit. The command is `bun src/planctl.ts` of this library: the registration of `planctl` as a command of the commons package is a change of the packaging that is the release's.

## Requirements

- **FR-001**: The configuration MUST be a typed value made by `definePlanning` (the identity, as `defineConfig` of `repoctl` is) and read by `parsePlanning`, the one reader, which returns a `Result` that names the field of a bad value and refuses a field that is not in the type; it MUST name the store, the sources and their places, the markers, the threshold of duplicates, the authority of each field (one for the field: an authority that differs for each source is not yet read), the files anchors may be written to, the principal of a run, the rule that makes an actor an agent acting for a person, who confirms, the clock's limit and the formats to render, and MUST NOT be read from JSON or YAML (commons 0037-planning FR-037).
- **FR-002**: The principal of an agent's event MUST be established from who runs the work and never guessed (a session, an argument, the configuration, or the author of a commit where the configuration names that rule), an argument MUST override the configuration, a tool server MUST take it from its session and never from a call, and a run with none MUST refuse to write an agent's event and say that no principal is established (commons 0037-planning FR-005, FR-045).
- **FR-003**: `planctl` MUST be a Headless program with the verbs `collect`, `show`, `query`, `views`, `confirm`, `plan` and `apply`, each returning a typed outcome; `plan` MUST be the dry run that prints the preview and its hash, and `apply` MUST write exactly the plan of the hash it is given and refuse another; in check mode the command MUST print the hash and exit with a status that says whether anything would change (commons 0037-planning FR-032, FR-034).
- **FR-004**: The tool server MUST serve the same verbs as a projection of the same program, MUST make every agent that calls it an actor of kind agent with the principal of its session, MUST take the target and the hash of a write as arguments, and MUST refuse a call with no principal (commons 0037-planning FR-035).
- **FR-005**: The configuration MUST be trusted as a build script is: it MUST be read only from the root of the repository the run started in and never from a path an argument or an item names, MUST hold no secret (a token is named by its variable), and in a repository just cloned from another's remote MUST be read only after the person says so (commons 0037-planning, plan.md, Trust).
- **FR-006**: The items MUST be rendered in the formats the configuration names by the pure renderers of commons planning 0003-planning-reconcile FR-013, with `planctl render`, saying what a format cannot hold (commons 0037-planning FR-039).

## Acceptance scenarios

1. **Given** a configuration with a field of the wrong type, **When** it is parsed, **Then** the error names the field, per FR-001.
2. **Given** a headless run with no principal, **When** an agent's event is to be written, **Then** it is refused and says so, per FR-002.
3. **Given** `planctl plan` and then `planctl apply` with its hash, **When** they run over a folder, **Then** the first writes nothing and the second writes that plan, per FR-003.
4. **Given** a tool server whose session has no principal, **When** a tool is called, **Then** it is refused, per FR-004.

## Out of scope

- A user interface and a REST surface.

## Edge cases

- An argument that names a principal different from the configuration's: the argument wins, per FR-002.

## Assumptions

- The surfaces are thin: every verb calls the logic of commons planning 0003-planning-reconcile and 0004-planning-sources.

## Open questions

- None.

## Key entities

- **Configuration** - a typed value, `planning.config.ts`.
- **planctl** - the program.

## Success criteria

- **SC-001**: The same verb through the command line and the tool server gives the same outcome.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
