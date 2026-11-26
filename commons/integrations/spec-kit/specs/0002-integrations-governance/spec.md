# Feature Specification: Integrations governance

**Spec ID:** 0002-integrations-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Governance is data that names no vendor, no syntax, no transport and no file. Identities are made only by smart constructors (parse, do not validate). Observation is governed by a connector class, a read-only contract, a credential reference with a least-privilege scope, a cadence, entity kinds, a generic denylist of fields, labels in the world's terms and a trust policy. Exchange is governed by standards as registry entries with identity, version and licence, the four levels (syntax, schema, profile, terminology), the agreement with a trading partner, the protection of what is exchanged and obligations.

## Identities

- **FR-001**: A connector id, a partner id, an agreement id, a standard urn, a credential reference, a digest, an instant and a duration MUST each be an opaque branded value that only its smart constructor makes (`parse*`, returning a `Result`), and `brand` MUST be the one cast of the library.
- **FR-002**: A credential reference MUST be `vault://<store>/<name>`, a reference to a vault store and never a value; the refusal of a text that is not one MUST NOT repeat the text, because it may be the secret.
- **FR-003**: A standard urn MUST be `urn:standard:<issuer>:<name>:<version>`, an instant an ISO 8601 moment in UTC, a duration a whole number and one of `s`, `m`, `h`, `d`, and a digest 64 lower-case hexadecimal digits; a property test MUST show that a urn built from its parts reads back to them.

## Observation

- **FR-004**: A connector MUST have a class of the closed union `cloud`, `identity`, `code-host`, `hr`, `endpoint`, `ticketing`, `network-device`, `vulnerability`, a read-only contract (`writes: never`) and labels in the world's terms (the service models of NIST SP 800-145 and categories of the consumer's own vocabulary); consumers attach their own policy data (paths, estate labels, control ids).
- **FR-005**: The scope of a connector MUST be a list of grants whose only access is `read`, and governance with no grant MUST be a problem (`no-scope`).
- **FR-006**: A cadence MUST have `every` and `staleAfter`, `staleAfter` MUST default to twice `every`, MUST NOT exceed seven days and MUST NOT be less than `every`; whether an observation is stale MUST be a pure function of the cadence and two instants.
- **FR-007**: A credential spec MUST hold a reference and fields, at least one of them secret, each with a hint and none twice.
- **FR-008**: Governance MUST carry a generic denylist of fields that are never kept (compensation, government identifiers, birth dates, home address, personal contact, secrets), a connector MAY add to it and MUST NOT remove from it (a weaker one is a problem `denylist-weaker`), and `isDenied` MUST be a pure function of the list and a field name.
- **FR-009**: The trust a connector places in a system MUST be a typed policy (`https` with its hosts and a TLS policy of system roots or a pinned certificate whose origin is `trust-on-first-use` or `preconfigured`, `snmp-v3`, or `local`, a store of our own read with the access of the process, which has no host to reach), and `decidePin` MUST be a total function of the policy, the digest shown and the digest remembered: it accepts a match, remembers the first digest only under trust on first use, and refuses a mismatch.


## Exchange

- **FR-010**: A standard MUST be a typed entry with its urn, level, family (`message`, `document`, `resource-api`, `vocabulary`, `file-format`), title, issuer, name and version, basis (`adopts`, `specializes`, `maps`, `unaligned`), location, licence and the SHA-256 of what was imported where anything was (commons 0018-standards-first FR-006); a registry MUST refuse a urn twice, a urn that does not agree with its parts and a licence with no terms.
- **FR-011**: A licence MUST be data (an SPDX identifier or a `LicenseRef`, what it allows, the text that cites its terms) with the rule that follows: `allowed` (may be committed), `user-supplied` (only read from a copy the user holds) or `refused`; whether a source (`embedded-in-package`, `user-supplied`, `published-by-issuer`) is allowed MUST be a pure function of the licence.
- **FR-012**: A standard MUST be referred to at one level (`syntax`, `schema`, `profile`, `terminology`) by a reference whose level is in its type, so that a schema cannot stand where a terminology is wanted; a profile binding MUST name a profile and the schema it constrains, and a terminology binding an element path, a terminology and a strength (`required`, `extensible`, `preferred`, `example`).
- **FR-013**: An exchange agreement MUST name its trading partner, direction, syntax, schemas, profiles, bindings, acknowledgement requirements (X12 TA1 and 999, HL7 ACK, FHIR OperationOutcome, each within a duration), service levels, data protection, obligations, transport and a credential reference; `agreementProblems` MUST find an agreement with no schema, an obligation to acknowledge with no requirement, validation of no level, a send that is never tried and a keep longer than the retention.
- **FR-014**: Data protection MUST classify what is exchanged (`public`, `internal`, `confidential`, `protected-health-information`), say its handling and its minimum necessary (`whole-record`, `listed-elements`, `treatment-exempt`), and `mayAppearInLogs` MUST be true of `public` only.
- **FR-015**: Obligations MUST be a closed union (`validate` with its levels, `acknowledge`, `log` metadata only, `keep` for a duration), and the publication gate `embeddingFindings` MUST refuse, as a finding, an embedded file of a standard whose licence does not allow embedding or that is not in the registry.
- **FR-016**: A connector that reads only a store of our own, with the access of the process that runs it, MAY have the credential spec made by `localAccess`: a reference and at least one field that names the store, none of them secret, each with a hint and none twice; a secret field MUST be refused there, and `credentialSpec` MUST still refuse a spec with no secret field, so that the way to a secret has no exception.

## Acceptance scenarios

1. **Given** the text `hunter2-token`, **When** it is parsed as a credential reference, **Then** it is refused and the error does not contain the text, per FR-002.
2. **Given** `every` of `1d` and no `staleAfter`, **When** the cadence is made, **Then** it is stale after two days; with `every` of `6d` it is stale after seven, per FR-006.
3. **Given** a licence that is `user-supplied`, **When** its content is embedded in a package, **Then** the gate finds it, per FR-015.

## Out of scope

- The code lists of data's privacy vocabulary are aligned by value, not imported; a dependency on commons/data is added when it carries them.

## Edge cases

- A cadence of `1s`: valid; it is never stale before 2 seconds, per FR-006.
- A duration of `0m`: refused, a duration is positive, per FR-003.

## Assumptions

- The classification values follow the governance vocabulary of commons/data; the library defines no new meaning for them.

## Open questions

- None.

## Key entities

- **Connector governance** - what a connector may be and read.
- **Standard** - a registry entry with a licence.
- **Exchange agreement** - what a partner and we agreed.

## Success criteria

- **SC-001**: Nothing that is not a smart constructor's output reaches a function that wants an identity, and nothing in governance names a vendor or a transport.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
