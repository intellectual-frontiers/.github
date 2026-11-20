# Feature Specification: Headless layers

**Spec ID:** 0001-headless-layers
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The shape of Headless, a library of commons for programs that have no window: three layers (governance, logical, and a surface for each way a program is reached), each file one unit, imports pointing one way, units reaching each other only through the package's `exports`, each unit allowed the packages its row of the table names, and a place left in the table for the surfaces that are not built yet (a tool server, a REST interface). It is the layers of commons data applied to actions instead of schemas.

## The layers

- **FR-001**: The library MUST be arranged as the units of one table, and every file of it MUST be in exactly one unit: `src/governance/` (layer 1), `src/logical/` (layer 2), one folder under `src/surfaces/` for each surface (layer 3), `src/otel/` (the adapter), `src/mod.ts` (the entry that names the two pure layers), and the checking of the library itself (`suite/`, `tools/`, and the manifest files of its root); a file in none MUST be a finding `layers/unclassified`. Taken from: the layers specification of commons data (its unit table and its unclassified-file rule), which the layers of this library follow.
- **FR-002**: Imports MUST point one way: the logical layer MAY import the governance layer, a surface MAY import the logical and governance layers, the adapter MAY import a surface and the layers below it, and nothing below MAY import what is above it (`layers/above`); a surface MUST NOT import another surface, and a layer MUST NOT import a unit its row does not name (`layers/around`). Taken from: the layers specification of commons data (its table of what each unit may import).
- **FR-003**: A file of one unit MUST import a file of another by the package's own name and an entry of its `exports` (`@intellectual-frontiers/headless/governance`), never by a relative path (`layers/relative`), and an import by the package's name that `exports` does not name MUST be a finding `layers/private`. Taken from: the layers specification of commons data (its rules on package entries and relative imports).
- **FR-004**: Each unit MUST import by package name only what its row of the table allows, and anything else MUST be a finding `layers/external`: governance, Core alone; logical, Core and the terminal's `args` and `commands`; the command-line surface, Core, the terminal and the system; the adapter, Core and the telemetry. Taken from: the plan of `commons/headless` ("depend only on terminal, system and core") and the layers specification of commons data (its rule on external imports).
- **FR-005**: The command-line surface MUST NOT depend on the telemetry. WHERE a run is to be reported in OpenTelemetry, the surface MUST give a port (`RunObserver` of its `Io`) and the adapter (`@intellectual-frontiers/headless/otel`) MUST sit behind it, as the telemetry sits behind `proc.setProcessTracer` of the system; no unit but the adapter MAY import the telemetry. Taken from: commons 0032-lifting-libraries FR-003 and the way `proc.setProcessTracer` is installed by the telemetry's own module.
- **FR-006**: WHEN a surface is added (a tool server, a REST interface), it MUST be one folder under `src/surfaces/` with one row of the table naming the packages it may import; a folder with no row MUST be a finding `layers/unclassified`, so that a surface cannot be added without saying what it may import. Taken from: the decision of the plan that `mcp` and `rest` slot in beside the command line without being built now.

## The check and the package

- **FR-007**: `tools/check.ts` MUST run the layers check (`tools/layers.ts`, pure: given the files and the `exports` map it returns findings as data) together with the trace of the sources and tests to these specifications, and hold the findings against `trace.baseline.txt`, which only shrinks; `bun run verify` MUST run it. Taken from: commons data `tools/check.ts` and its layers specification (the check held against a baseline).
- **FR-008**: Headless MUST be published as compiled modules with their declarations as `@intellectual-frontiers/headless` (commons 0032-lifting-libraries FR-005), with an entry for the package (`.`) and one for each layer (`./governance`, `./logical`, `./cli`, `./otel`), for Node 26 and Bun, and its manifest (`library.ts`) MUST agree with its folder; its `package.json` MUST stay private so that nothing is published from the folder by hand. Taken from: the packaging of terminal, system and quality (commons 0032-lifting-libraries FR-005, commons 0032-lifting-libraries FR-013).

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** it finds nothing, per FR-001 to FR-004.
2. **Given** a file of the governance layer that imports the logical layer, **When** the layers check runs, **Then** it reports `layers/above`, per FR-002.
3. **Given** a file of the logical layer that imports a file of the governance layer by a relative path, **When** the check runs, **Then** it reports `layers/relative`, per FR-003.
4. **Given** a file of the command-line surface that imports the telemetry, **When** the check runs, **Then** it reports `layers/external`, per FR-004 and FR-005.
5. **Given** a folder `src/surfaces/mcp/` with no row in the table, **When** the check runs, **Then** it reports `layers/unclassified`, per FR-006.
6. **Given** the packed package, **When** a consumer on Node 26 and on Bun type-checks and imports each entry, **Then** both succeed, per FR-008.

## Out of scope

- The tool server and the REST interface themselves, and the conformance check of a program against the contract (`headless check`).
- What each action does: the programs that declare them.

## Edge cases

- An import written as a dynamic `import("...")` or as a re-export: read as an import, per FR-002.
- An import of the package's own root (`@intellectual-frontiers/headless`) from a layer: not allowed, the entry names the layers and is above them, per FR-002.

## Assumptions

- A surface is a way of being reached, not a set of commands: the same tree of commands is drawn by each.

## Open questions

- None.

## Key entities

- **Unit** - a folder of the table, with a class that says what it may import.
- **Surface** - a folder under `src/surfaces/` with a row of its own.

## Success criteria

- **SC-001**: A new surface cannot be added, and no layer can reach upward, without the check failing.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
