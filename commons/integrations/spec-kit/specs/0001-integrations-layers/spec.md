# Feature Specification: Integrations layers

**Spec ID:** 0001-integrations-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Integrations is one library on one skeleton, the governance to logical to physical pattern of Kanon, for two families: OBSERVE (read-only connectors that write observations and entities) and EXCHANGE (messages and documents under standards and partner agreements). Governance names no vendor, no syntax, no transport and no file; the logical layer is pure; only the physical layer and the surfaces reach anything. Each file is one unit, imports point one way, units reach each other only through the package's `exports`, and each unit may import only what its row of the table allows. The rules are those of commons/kanon (commons 0033-kanon), declared as a table in the manifest and held by its shared checker.

## The layers

- **FR-001**: The library MUST be arranged as the units of one table, and every file of it MUST be in exactly one unit: `src/governance/` (layer 1), `src/logical/` (layer 2), one folder under `src/physical/` for each adapter (`http`, `transport`), one folder under `src/surfaces/` for each surface (`headless`), `suite/`, `tools/` and the files of the root; a file in none MUST be a finding (`layers/unclassified`).
- **FR-002**: Imports MUST point one way: governance imports nothing of the library; the logical layer imports governance; a physical adapter imports the logical layer and governance and never another adapter; a surface imports the adapters, the logical layer and governance. An import that climbs or reaches around MUST be a finding (`layers/above`, `layers/around`), and a unit MUST reach another only by the package's name through an entry of `exports` (`layers/relative`, `layers/private`).
- **FR-003**: Governance and the logical layer MUST import no package but Core; only a physical adapter MUST reach a network (Net), and each adapter and surface MUST have a row of the table naming the packages it may import (`layers/external`), so that no vendor, no framework and no host reaches a layer below.
- **FR-004**: The core MUST name no vendor and no framework: no file of governance or of the logical layer MUST name a cloud, a SaaS product, a code host, an EHR or a clearinghouse; a vendor is a plugin package (0008-integrations-plugins).

## The check and the package

- **FR-005**: `tools/check.ts` MUST run the trace of the sources and tests to these specifications (commons 0015-trace), beside the shared layers checker in `verify`, hold the findings against `trace.baseline.txt`, which only shrinks, and be part of `bun run verify`.
- **FR-006**: The public surface MUST be the entries of `exports`: `.`, `./governance`, `./logical`, `./http`, `./transport` and `./headless`, and a vendor adapter or a standard MUST be a separate package of commons that imports them by name.
- **FR-007**: The library MUST declare its table of layers as the field `kanon` of its manifest `library.ts` (commons 0033-kanon FR-010) and its `verify` MUST run the shared checker of `@intellectual-frontiers/kanon` (`bun ../kanon/src/check.ts`); the library keeps no checker of its own.
- **FR-008**: The library MUST declare itself with a manifest (`library.ts`, `release.ts`, `about.ts`) and be published as compiled ESM with declarations, with exports conditions `types`, `bun` and `default` (commons 0032-libraries-by-concern).
- **FR-009**: The library MUST be the host of the family of its plugins (commons 0033-kanon FR-019 to FR-024, and 0041-telemetry-and-reach audit row C6): its manifest declares `family: { host: "integrations", role: "host" }`, its table declares the rule `{host}-{name}` for a plugin, the contract `./logical` that each plugin imports, and one plugin noun for each connector and standard (`github`, `identity`, `fhir`, `x12`, `snmp`, `redfish`, `otel`); each of those libraries MUST declare `family: { host: "integrations", role: "plugin" }` and a table that extends this package; and the shared checker MUST hold the name and the imports of each plugin.

## Acceptance scenarios

1. **Given** a file of `src/logical/` that imports `@intellectual-frontiers/integrations/http`, **When** the check runs, **Then** `layers/above` is found, per FR-002.
2. **Given** a file of `src/governance/` that imports Net, **When** the check runs, **Then** `layers/external` is found, per FR-003.
3. **Given** a folder `src/physical/ftp/` with no row, **When** the check runs, **Then** its files are `layers/unclassified`, per FR-001.
4. **Given** a source of governance that names a vendor, **When** the vendor check runs, **Then** it is a finding, per FR-004.

## Out of scope

- The shared checker of commons/kanon: switched to when it lands (FR-007).
- Vendor and standards packages: they have their own folders and manifests.

## Edge cases

- A file of `suite/` that imports a unit by a relative path: allowed, the suite and the tools are the library's own checking, per FR-002.
- An import that is a comment: not read, per FR-005.

## Assumptions

- The pattern is Kanon's: governance, then logical, then physical, each importing only below.

## Open questions

- None.

## Key entities

- **Unit** - a folder of the table with a class and a row of allowed packages.
- **Adapter** - a folder of `src/physical/` that reaches a network.
- **Surface** - a folder of `src/surfaces/`.

## Success criteria

- **SC-001**: A change that makes a lower layer know a higher one, or a pure layer know a network or a vendor, fails `bun run verify` and names the file and the rule.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
