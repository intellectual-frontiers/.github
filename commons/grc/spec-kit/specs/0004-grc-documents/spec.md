# Feature Specification: GRC documents and serializers

**Spec ID:** 0004-grc-documents
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** Everything GRC persists or exchanges is a document that describes itself: its `kind`, the `schema` version of its shape, its `id`, when it was created and where it came from. A reader knows exactly the schemas of its own release. The standards' formats (OSCAL, OCSF, SARIF, CycloneDX, in-toto) are written by serializers, each a plugin behind one port with a registry of its own and a conformance suite.

## The envelope

- **FR-001**: A document MUST be `{ kind, schema, id, createdAt, provenance, ...body }`, where `schema` is a version string, `createdAt` an ISO 8601 instant and `provenance` says the producer (a name and a version), the ids or digests of the documents it was made from, and optionally who or what acted; `defineKind` MUST make the decoder of one kind from the decoders of its body, and a kind MUST be registered once in the registry of kinds under its `kind` as the stable id.
- **FR-002**: `readDocument` MUST decode any text or value through the registry of kinds, and MUST return an error value that names the unknown `kind`, or the `schema` that was found and the one expected, and MUST NOT read any other schema than the one the kind holds in this release (no dual reader, no migration).
- **FR-003**: `canonicalize` MUST write RFC 8785's JSON Canonicalization Scheme (members sorted by the UTF-16 code units of their names, no white space), `digestOf` MUST be the SHA-256 of it, and the same document MUST have the same digest on every runtime whatever the order of its members.
- **FR-004**: Ids that are derived MUST be derived the same way every time: `idOf` MUST give a version 5 UUID URN of a namespace and the parts of a name, so that the same input gives the same document.

## Serializers

- **FR-005**: A serializer MUST be a port `{ id, format, version, media, serialize(assessment, context) }` returning the text of a document of that format or an error value, registered in a registry of serializers by its stable id; it MUST be deterministic (the same assessment, the same bytes) and MUST NOT read the clock.
- **FR-006**: The `oscal` serializer MUST write OSCAL `assessment-results` (results with observations, findings and the control each is about) for the assessment, every `uuid` a version 5 UUID of the document's id and a stable name.
- **FR-007**: The `oscal` serializer MUST also write a `system-security-plan` (each control the checks speak of, `implemented` where every result shows it and `partial` where one does not, by the checks that show it; and what the caller says of the system, by the option `system`: its description, sensitivity level, boundary, import profile, information types, components, users and whose each control is, `provider`, `inherited` or `customer`, none of which is made up where it is not said) and a `plan-of-action-and-milestones` (the findings that are open and the risks that are not closed, each with its milestones and the exception or accepted risk that holds it until a date, and the planned findings of Planning with their milestones, owners and days, as 0016-grc-poam says) from the same assessment, and all three documents MUST be valid against the schema NIST publishes for OSCAL; a serializer MAY be given a mapping through a crosswalk (0002 FR-002) so that a control of one framework is written under another's identifier.
- **FR-008**: The `ocsf` serializer MUST write each finding as an OCSF Compliance Finding (class 2003) with `type_uid`, `status_id` and `severity_id` mapped from the status and the severity, the control in `compliance`, and `metadata.product` and `metadata.version`.
- **FR-009**: The `sarif` serializer MUST write SARIF 2.1.0: a run with the rules (one for each check), and a result for each finding with its level, its message and the subject as a logical location.
- **FR-010**: The `cyclonedx` serializer MUST write a CycloneDX BOM whose `declarations` hold the assessor, the claims (one for each control), the evidence and the attestations, and the `intoto` serializer MUST write an in-toto Statement v1 whose subjects are the digests of the evidence and whose predicate type is the one the caller names.
- **FR-011**: A conformance suite for serializers MUST check that each registered serializer is deterministic, names its format and version, gives an error value and not an exception for an assessment with no results, and produces what a decoder of its format accepts; the suite MUST return each failure as data.

## Scenarios

- **Given** `{"kind":"grc.result","schema":"0.2"}` when the registry holds `grc.result` at `1`, **When** it is written or read, **Then** the error names `0.2` and `1`, per FR-002.
- **Given** `{"b":1,"a":2.0}` and `{"a":2,"b":1}`, **When** it is written or read, **Then** one digest, per FR-003.
- **Given** an assessment with a failing and a passing result, **When** it is written as `sarif`, **Then** one result with level `error`, per FR-009.

## Out of scope

- Reading a standard's format back into documents; signatures (0006-grc-evidence).

## Edge cases

- An assessment with no results: each serializer gives a valid, empty document, per FR-011.
- A control URN in an OSCAL `control-id`: its control segment only, per FR-006.

## Assumptions

- The versions of the standards are constants of each serializer and change only by changing the serializer and its fixtures: OSCAL 1.2.x, OCSF 1.x, SARIF 2.1.0, CycloneDX 1.6 and in-toto Statement v1, as they stood at the time of writing; the release verifies them.

## Open questions

- **OQ-1**: Whether the SBOM of the artifacts under assessment (not the declarations about them) belongs to this library or to a supply-chain one.

## Key entities

- **Document**, **Kind**, **Serializer**.

## Success criteria

- **SC-001**: A document of another schema is refused with both versions named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
