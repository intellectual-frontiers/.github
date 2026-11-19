# Feature Specification: Identity principals

**Spec ID:** 0032-identity-principals
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** One principal, five kinds. Humans, machines, devices, AI agents and groups are all principals, as people and organizations are all parties in Arca: everything a principal can have (a lifecycle, an owner, credentials, roles, attributes, policies, a place in the audit trail) is attached to the principal once, and only what is specific to a kind is in a concept of its own, in the module of that kind. A principal has a status, and making it disabled denies everything it could do at once, which is the kill switch for any kind. A machine, a device and an agent have an owner, a person or a group accountable for them, and a principal is never its own owner. The audit trail says what did something (a person, a machine, a device, an agent, the platform or someone acting as another), on whose behalf, through which delegation and run, and what decided.

## Requirements

- **FR-001**: A principal MUST have a kind (user, machine, device, agent or group), a status (pending, active, suspended, disabled or deleted) with its reason and the time it changed, the time it was made, an optional owning tenant and an optional owner that is a principal.
- **FR-002**: A principal MUST NOT be its own owner, MUST refuse a kind or a status that is not one of its code list's, MUST refuse an owner that is not a principal, and the same table MUST hold a principal of every kind, so that a role, a credential, an attribute, a group membership and an audit event refer to any kind alike.
- **FR-003**: Every kind, status and method that a concept of any identity module names MUST be a code list with a definition of each code, closed unless it says it is open (so that a module can add a kind of credential), and the helpers the modules are written with MUST be public so that every module says things the same way.

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

- **Principals** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
