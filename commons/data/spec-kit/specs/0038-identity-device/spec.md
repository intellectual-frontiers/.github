# Feature Specification: Identity devices

**Spec ID:** 0038-identity-device
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** Devices as principals: a laptop, a phone, a server or a thing, with an owner. A device proves things about itself (attestations, judged, each with a nonce and an expiry), reports how it is doing (posture, with typed columns for the usual checks of device assurance and a bag only for the rest, and after its time is up it reads as unknown, never as compliant), and carries sessions, so that a decision about a person can use the posture of the device they are on.

## Requirements

- **FR-001**: A device MUST be a principal with its kind, its platform, a hash of its hardware identifier (which is personal where it identifies a person's device), how far it is managed, whose it is, and when it was enrolled and last seen.
- **FR-002**: An attestation MUST say what was proved, a hash of the evidence, who judged it, how, when and until when, and the hash of its nonce, and MUST be kept ninety days.
- **FR-003**: A posture report MUST say what reported it, whether the device is compliant (or unknown), typed checks (encryption, screen lock, firewall, jailbreak, endpoint detection, patch age, risk), when it was reported and until when it counts, and MUST be kept thirty days; and a device session MUST bind a device to a session once.

## Out of scope

- The operations that do the business of this module: a later specification, run by the operations runtime (0031).
- How a decision is made from these tables: the decision engine is a later specification.

## Edge cases

- A kind of principal that has no table of its own in this module: it is held by the principal and its roles alone, per FR-001.
- DuckDB loads this schema and can read it, and cannot update a row that another row refers to; operations that change principals, runs or delegations are for PostgreSQL and SQLite, per FR-001.

## Assumptions

- The application makes identifiers, hashes and timestamps; the database stores them and refuses what the constraints say.

## Open questions

- **OQ-1**: The constraints that governance cannot say (acyclic hierarchies, a subtype row only for a principal of its kind) are checks of the operations and of invariant queries, not of the schema.

## Key entities

- **Devices** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
