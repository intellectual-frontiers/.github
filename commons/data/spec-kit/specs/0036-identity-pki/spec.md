# Feature Specification: Identity PKI

**Spec ID:** 0036-identity-pki
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Public-key credentials for machines and devices alike. A trust anchor is what certificates and keys are checked against; a certificate is a credential of a principal, with its fingerprint (unique, and the value mutual TLS binds a token to), its subject and alternative names (such as a SPIFFE ID), its validity and the anchor that vouches for it. Only the public half of any key is kept.

## Requirements

- **FR-001**: A trust anchor MUST say its trust domain, its kind, its public material, when it stops being trusted and whether it is trusted.
- **FR-002**: A certificate MUST be a credential of its principal, with a unique fingerprint, and MUST hold no private key.

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

- **Pki** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
