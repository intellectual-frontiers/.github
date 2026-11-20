# Feature Specification: Integrations exchange

**Spec ID:** 0006-integrations-exchange
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The EXCHANGE family, in four levels each data with an identity and a version: syntax, schema, profile and terminology. A common abstract typed tree (interchange, group, transaction, segment, loop, element) is what X12, HL7 v2, EDIFACT and FHIR all map to, so that validation, mapping and redaction are written once. Mappings are declared as data and account for every source field (Kanon rule 5). Validation gives findings by level that never hold a value of the payload. The life of a message is a total transition function.

## The tree

- **FR-001**: The abstract tree MUST be the sum of interchange, group, transaction, segment, loop and element, each a discriminated, readonly record, with the syntax of an interchange a reference of level `syntax`.
- **FR-002**: A path MUST be the ids from the transaction down joined by `.`, an element with an empty id adding nothing; `entries` MUST list every value with its path and its indexed path, `pathsOf` each path once, and `occurrences` the count of a path under each instance of its parent.
- **FR-003**: Redaction MUST be written once over the tree: `redactTree` MUST hide every value whose path, or an ancestor's, a predicate names, and `hidingAllBut` MUST express minimum-necessary as the elements a recipient may have.

## Constraints and validation

- **FR-004**: A schema MUST be the paths a kind of transaction has with constraints (`cardinality`, `pattern`, `fixed`, `binding`), and a profile MUST add constraints to a schema it names.
- **FR-005**: A finding MUST have a level (`syntax`, `schema`, `profile`, `terminology`, `business-rule`), a severity, a code, a path and a message made of the code and the path only; a message MUST NOT hold a value of the payload.
- **FR-006**: A terminology MUST be the codes of a code system or value set loaded from data supplied, and a binding MUST produce an error for a `required` strength, a warning for `extensible`, information for `preferred` and nothing for `example`; an unloaded terminology MUST be a warning, never a pass.
- **FR-007**: `validate` MUST be total and pure: every finding of a transaction against a schema, a profile, the terminologies and the business rules supplied, in the order of the levels.

## Mapping and the life of a message

- **FR-008**: A mapping MUST be data (`map` with a transform, `carry`, `drop` with a reason) between two schemas, and `coverage` MUST find a source path that ends in no rule (`unmapped-source-field`), a rule that names no path, two sources to one target, and every drop as `lossy-mapping`: a lossy mapping is a finding.
- **FR-009**: `translate` MUST write each mapped or carried value to its target path, MUST NOT write a dropped one, and MUST stop with `unmapped-source-field` rather than lose a value silently; transforms are total.
- **FR-010**: An acknowledgement MUST be the sum of X12 TA1, X12 999, HL7 ACK and FHIR OperationOutcome, and `statusOf` MUST be total: HL7 AA and CA accepted, AE and CE accepted with errors, AR and CR rejected; an outcome with an error rejected.
- **FR-011**: `transition` MUST be a total function of a state (`pending`, `sent`, `received`, `retrying`, `acknowledged`, `rejected`, `abandoned`), an event and the agreement's attempts, and an illegal pair MUST be an error value, never a throw.
- **FR-012**: A send that times out MUST retry until `maxAttempts` and then be abandoned; a state that is final (acknowledged, rejected, abandoned) MUST accept no event.

## Acceptance scenarios

1. **Given** a mapping that drops `Claim.note`, **When** its coverage is computed, **Then** `lossy-mapping` is found for `Claim.note`, per FR-008.
2. **Given** a validation finding at `Patient.name[0].family`, **When** it is printed, **Then** the family name is not in the message, per FR-005.

## Out of scope

- Planned: a canonical model and the standard mappings (X12 837 to FHIR Claim); EDIFACT, HL7 v2 syntax and schemas, ISO 20022 and NIEM.

## Edge cases

- A source field below a dropped path: covered by the drop, per FR-008.
- A retry event in a final state: an error, per FR-012.

## Assumptions

- The tree is flat in values and nested in structure; a codec decides how its syntax maps to it.

## Open questions

- None.

## Key entities

- **Interchange** - what is sent in one go.
- **Mapping** - rules that account for every field.
- **Exchange state** - where a message is in its life.

## Success criteria

- **SC-001**: A document is validated, mapped and redacted by code written once, whatever its syntax, and nothing is lost without being named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
