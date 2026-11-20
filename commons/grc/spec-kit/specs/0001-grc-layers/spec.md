# Feature Specification: The layers of GRC

**Spec ID:** 0001-grc-layers
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** GRC is three layers and the extensions that plug into them: governance says what must be true and how it is to be shown, and knows no runner, store or vendor; the logical layer says what a result, a finding, an attestation or an assessment is and computes with them, as pure functions over self-describing documents; the physical layer is a set of registries of typed ports (runners, evidence stores, signers) with conformance suites that a third party can run, and each extension is a unit that registers itself behind its port. The surfaces (the headless verbs) are above all of them. This is the shape commons calls Kanon (commons/kanon, a separate work); until it lands this specification states the rules in the shape of data 0001-layers, and `tools/layers.ts` holds them.

## The principle

- **FR-001**: Everything that varies MUST be a registered extension behind a typed port, and everything persisted or exchanged MUST be a self-describing versioned document; the core (governance, logical and the ports of physical) MUST name no framework, runner, store, vendor or exchange format, and a name of one in the code of the core MUST be a finding (`layers/named`).
- **FR-002**: Organization- and standard-varying content (catalogs, crosswalks, policies, cadences, evidence rules) MUST be data of a document kind, never code; catalogs are data packages of their own (0008-grc-catalogs).
- **FR-003**: There MUST be no compatibility shim in the library: no alias of a name that was changed, no deprecated export, no reader of two versions of a document, no migration. 0.x MAY break; a change to a document's shape MUST change its `schema`, and the reader MUST know only the schema of its own release. A `@deprecated` tag, or a reader of a retired schema, MUST be a finding (`layers/compat`).

## The layers

- **FR-004**: Governance (layer 1, `src/governance/`) MUST import only Core (`@intellectual-frontiers/core`) and the library's own governance.
- **FR-005**: The logical layer (layer 2, `src/logical/`) MUST import only governance, Core, and the pure packages Crypto and Formats; it MUST be pure: no file, network, process or clock (the time is a parameter).
- **FR-006**: The physical layer (layer 3, `src/physical/`) holds the ports (runner, evidence store, signer), their registries and the helpers that run through them; it MUST import only the logical layer, governance, Core, Crypto, Formats and System, and MUST NOT import a unit that registers into it.
- **FR-007**: An extension MUST be a unit of its own: a serializer (`src/serializers/<id>/`) imports the logical layer; a runner (`src/runners/<kind>/`), a store (`src/stores/<id>/`) and a signer (`src/signers/<id>/`) import the physical, logical and governance layers; the conformance suites (`src/conformance/`) import all of those; an extension MUST NOT import another extension.
- **FR-008**: A surface (`src/surfaces/<id>/`) MAY import every unit below it and Headless and Terminal, and nothing but the suite and the tools MAY import a surface.

## Registries and documents

- **FR-009**: Every registry entry MUST have a stable id (lower-case words joined by `-` or `.`), a duplicate id MUST be refused as an error value, and every port MUST ship a conformance suite as a function that a third party runs against its own implementation and that returns each failed expectation as data.
- **FR-010**: Every persisted or exchanged document MUST carry `kind`, `schema` (a version string), `id`, `createdAt` (an ISO 8601 instant) and `provenance` (what produced it, from which inputs).

## The check

- **FR-011**: `tools/layers.ts` MUST read every import of every file, relative or by package name, and find as data `layers/unclassified`, `layers/relative`, `layers/private`, `layers/external`, `layers/above`, `layers/around`, `layers/named` and `layers/compat`; `tools/check.ts` MUST run it with the trace and hold the findings against `trace.baseline.txt`, and it is part of `bun run verify`.
- **FR-012**: A term this library uses that no outside standard defines MUST be marked `unaligned` in the module that defines it (commons 0018-standards-first); the standards it follows are OSCAL, OCSF, SARIF, CycloneDX, in-toto, NIST IR 8477 and the SCF, each by the version its serializer or catalog data names.

## Scenarios

- **Given** a file of `src/governance/` that imports `@intellectual-frontiers/crypto/sha256`, **When** the check runs, **Then** `layers/external` names the file, per FR-004.
- **Given** a runner that imports a store, **When** the check runs, **Then** `layers/around`, per FR-007.
- **Given** a file of `src/logical/` that contains the name of a vendor, **When** the check runs, **Then** `layers/named`, per FR-001.
- **Given** a document of a retired schema, **When** it is read, **Then** an error value names the schema it expected, per FR-010.

## Out of scope

- What each layer does (specifications 0002 to 0007); the content of catalogs (0008).

## Edge cases

- A file in a folder the table does not know: `layers/unclassified`, per FR-011.
- A relative import that reaches another unit: `layers/relative`, per FR-011.
- A comment that names a vendor: not read by `layers/named`, per FR-001.
- The suite and the tools importing any unit by a relative path: allowed, per FR-008.

## Assumptions

- Kanon will take these rules over as its own and this library will then state only what is its own.

## Open questions

- **OQ-1**: Whether the conformance suites belong in a package of their own once more than one library has them.

## Key entities

- **Layer** - governance, logical or physical.
- **Unit** - a folder of the table.
- **Port** - a typed interface with a registry and a conformance suite.
- **Document** - kind, schema, id, createdAt, provenance and a body.

## Success criteria

- **SC-001**: A lower layer that reaches a higher one, a core that names a vendor, or a shim fails `bun run verify` and names the file and the rule.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
