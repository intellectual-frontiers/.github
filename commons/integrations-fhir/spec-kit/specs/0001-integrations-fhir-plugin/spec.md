# Feature Specification: Integrations FHIR plugin

**Spec ID:** 0001-integrations-fhir-plugin
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** FHIR is the first standards plugin of Integrations: a package behind the codec, loader and acknowledgement ports, with registry entries that record the licence as data. It reads FHIR R4 JSON and NDJSON into the abstract typed tree and out again, reads StructureDefinitions, CodeSystems and ValueSets that the user supplies (it embeds none), and makes and reads OperationOutcome.

## Requirements

- **FR-001**: The plugin MUST register FHIR JSON, FHIR NDJSON, FHIR R4 and US Core as entries with a licence as data (an SPDX identifier, what is allowed, the text that cites the terms); because embedding is not verified here, each MUST be `user-supplied`, and the package MUST embed no content of any standard (`EMBEDDED` is empty and passes the publication gate).
- **FR-002**: The JSON codec MUST read a resource into one transaction whose id is its `resourceType` and write it back so that reading the result gives the same tree, and the NDJSON codec MUST do the same for one resource a line; both MUST pass `conformPlugin` of Integrations.
- **FR-003**: The JSON codec MUST write as an array every path in the set of repeating paths it is given (from the StructureDefinitions, `repeatingPaths`) and any id that occurs twice, so that a resource with one occurrence of a repeating element is written as FHIR says.
- **FR-004**: A text that is not FHIR MUST be a syntax failure with a code and an offset that holds no part of the text.
- **FR-005**: The loader MUST read StructureDefinitions, CodeSystems and ValueSets only from a source the licence allows, into a schema (and a profile where the definition is a constraint) with cardinalities and bindings, and terminologies with their codes; a resource MUST then validate against them with findings that hold no value.
- **FR-006**: The acknowledgement port MUST make an OperationOutcome from a status (information, warning, error) and read it back into an acknowledgement whose status is the one made and whose findings hold no value.
- **FR-007**: The plugin MUST be a standards plugin of Integrations whose codec is the JSON syntax and whose loader is for FHIR R4.

## Acceptance scenarios

1. **Given** the synthetic fixtures of the suite, **When** the conformance suites of Integrations run over this plugin, **Then** they find nothing, per FR-001.

## Out of scope

- Everything the plugin does not list above: Planned, and specified in commons integrations 0007-integrations-standards where it is a standard.

## Edge cases

- A fixture that would be real data: never, every fixture is made up, per FR-001.

## Assumptions

- FHIR XML and choice-type expansion are Planned; fixtures are made up, never real records.

## Open questions

- None.

## Key entities

- **Integrations FHIR** - the plugin.

## Success criteria

- **SC-001**: The plugin passes the conformance suite of Integrations.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
