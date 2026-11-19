# Feature Specification: Identity ReBAC

**Spec ID:** 0035-identity-rebac
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** Relationship-based access, in the style of Zanzibar. A model says the types of objects and their relations; a fact (a tuple) says that this subject has this relation to this object, perhaps under a named caveat with its values and until a time; and a permission relation says that holding a relation on an object of a type grants a permission of the shared registry, so that a relationship grants what a role grants.

## Requirements

- **FR-001**: The module MUST hold the definition of an authorization model with its version and status, and relation tuples of an object, a relation and a subject (a kind of principal or of object, with the relation of the subject where a set is meant), a caveat and its values, an expiry and a time, unique by a key made of all of them.
- **FR-002**: A permission relation MUST say which relation on which type of object grants which permission, once for a permission and a type.

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

- **Rebac** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
