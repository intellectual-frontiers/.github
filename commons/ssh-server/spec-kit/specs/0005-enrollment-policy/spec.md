# Feature Specification: Enrollment policy

**Spec ID:** 0005-enrollment-policy
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** When a session is approved without a person: typed rules, an explanation with every decision, and the adoption of a device that an asset already describes.

## Requirements

- **FR-001**: The enrollment policy MUST be typed data: an ordered list of rules (`token` scoped to a tenant, fleet and labels; `pairing-code`; `inventory` by serial, MAC, machine id or host key; `source-network`; `cloud-attestation`; `refuse-network`), and the first rule that matches MUST decide.
- **FR-002**: Every decision MUST carry an explanation and MUST be written as an audit event with the rule that decided.
- **FR-003**: A device that matches an asset by machine id, serial, MAC or host key MUST be adopted (merged), and MUST NOT be duplicated; a device that matches more than one asset MUST wait for a person.
- **FR-004**: A rule `cloud-attestation` (the instance identity of AWS, Azure or GCP) MUST be in the type and MUST never match until it is built.
- **FR-005**: A session that no rule approves MUST wait for a person.

## Acceptance scenarios

1. **Given** a session whose token is in scope, **When** the facts come in, **Then** it is approved by that rule with the explanation (FR-001, FR-002).

## Out of scope

- Booting a machine (PXE, TFTP, boot servers): it is not a concern of commons.
- The controller that calls this library: it is in the private erga repository.

## Edge cases

- A requirement of this specification that a test cannot reach on this machine: it says so in its note (FR-001).
- A reserved requirement: it is held by name and enforces nothing until it is built (FR-001).

## Assumptions

- The system OpenSSH client is the client of the tests, and Debian 13 is the container of the script test.

## Open questions

- None.

## Key entities

- **SSH Server** - the library.

## Success criteria

- **SC-001**: Every requirement of this specification with the mechanism `check` is proved by `bun run verify`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
