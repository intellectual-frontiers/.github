# Feature Specification: Identity machines

**Spec ID:** 0037-identity-machine
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Machines as principals: services, workloads, pipelines and integrations, each with an owner. A workload identity is what a platform vouches for (a SPIFFE ID, a Kubernetes service account, an OIDC subject, a certificate), bound to one machine once, so that a machine proves itself by it instead of by a secret. An API key is a random secret kept only as a keyed hash and shown once, found by a unique prefix, and never wider in authority than its owner (its scopes narrow what its owner may use); a public key credential has a unique thumbprint.

## Requirements

- **FR-001**: A machine MUST be a principal with a kind, a purpose, where it runs, whether it is kept for emergencies, the longest its credentials may live and when its owner must next review it.
- **FR-002**: A workload identity MUST say what vouches for it, the issuer, the subject, the audience and selectors, and MUST be unique by a key made of the issuer and the subject.
- **FR-003**: An API key MUST be a credential with a unique prefix, a keyed hash and the scopes it is narrowed to, and a key credential MUST hold a public key as a JSON Web Key and its unique thumbprint, and no private half.

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

- **Machines** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
