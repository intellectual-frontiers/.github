# Feature Specification: Integrations plugins and conformance

**Spec ID:** 0008-integrations-plugins
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Vendors and standards are plugin packages (each its own folder of commons with its own manifests and publish workflow) behind typed ports and a conformance suite. A connector package gives a `Connector`; a standards package gives a codec, loaders of definitions the user supplies, an acknowledgement port and its registry entries. The suites are pure functions from the extension and its fixtures to findings, which a package runs in its own tests.

## The plugin contract

- **FR-001**: A standards plugin MUST be `{id, standards, codec, loaders, acks}`; registering it MUST refuse a syntax that another plugin already parses, a codec whose syntax is not one of its standards at the level `syntax`, and a loader for a standard it does not list.
- **FR-002**: A codec MUST be `parse` and `serialize` between a text and the abstract tree, returning a `Result`; a syntax failure MUST be a code and an offset and MUST NOT hold any part of the text.
- **FR-003**: A loader MUST be given a definition only from a source its standard's licence allows (`loadFrom`), and MUST read the standard's machine-readable definition from the supplied data; the library embeds none.
- **FR-004**: `detect` MUST try the registered syntaxes in order and give the first tree that parses, or the last failure.

## Conformance

- **FR-005**: `conformConnector` MUST find a connector with a governance problem, a description that disagrees with its governance, no fixture, a probe or observation that fails, a provider that is not the connector, a denied field kept, an observation that is not the same when repeated, and any expectation of a fixture that is not met.
- **FR-006**: `conformPlugin` MUST find a codec that does not parse a valid sample, that does not give the same tree after parse, serialize and parse, that accepts garbage, or whose failure repeats the text it refused, and a standard whose licence has no terms.
- **FR-007**: A package that embeds standard content MUST declare each file and its standard, and the publication gate (`embeddingFindings`) MUST be part of its conformance, so that content a licence does not allow is refused before publication.
- **FR-008**: Every fixture and sample MUST be synthetic or taken from a standard's published examples where its licence allows; no real health, claims or personal data MUST be anywhere in this repository, and a payload MUST NEVER appear in a log, a hint, a run log or a trace.

## Acceptance scenarios

1. **Given** a codec that echoes the refused text in its error, **When** `conformPlugin` runs, **Then** `codec/echoes-input` is found, per FR-006.

## Out of scope

- Planned: HL7 v2, EDIFACT, ISO 20022 and NIEM plugins; the loaders of licensed X12 guides.

## Edge cases

- Two plugins for one syntax: the second is refused, per FR-001.

## Assumptions

- A package's tests assert that the findings of its suites are empty.

## Open questions

- None.

## Key entities

- **Plugin** - a package that extends the library.
- **Conformance suite** - what every extension passes.

## Success criteria

- **SC-001**: An extension that does not meet the contract is found before it is used.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
