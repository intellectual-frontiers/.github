# Feature Specification: Identity ABAC

**Spec ID:** 0034-identity-abac
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Attribute-based access for every kind of principal. Decisions use attributes of the subject (a person's department, a machine's environment, a device's compliance, an agent's autonomy), of the resource, of the environment and of the action; a registry says what each attribute is, its type, where its values come from and how old a stored value may be before it is unknown, which is never true. A policy is a condition over attributes that allows or refuses an action, and a refusal always wins.

## Requirements

- **FR-001**: The registry MUST hold each attribute once by a key of the form `category.name`, with its category, type, source, the kinds of principal it applies to, its sensitivity, how old a value may be, and whether it is in use.
- **FR-002**: A principal MUST have at most one value of an attribute, and a resource MUST have at most one value of an attribute, each with the time it starts to hold and when it was asserted.
- **FR-003**: A policy MUST say its effect (allow or deny), the permission or prefix of permissions it is about, the kind of principal and of resource, its condition and the language of it (open), what must happen before an allowed action is done, its priority, its status and its version, and MUST be unique by a key made of its tenant, its name and its version.

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

- **Abac** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
