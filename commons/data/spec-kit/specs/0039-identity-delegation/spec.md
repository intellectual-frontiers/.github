# Feature Specification: Identity delegation

**Spec ID:** 0039-identity-delegation
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** One principal acting on behalf of another, for any kinds of principals (a person for an agent, an agent for a sub-agent, a machine for a person's request), with attenuation at every step. A delegation passes on a subset of what its delegator holds, can only add to the condition of the one above it, can only end sooner, and can only be passed on fewer times; what a delegate may do is derived from the chain when a decision is made, so that revoking one delegation ends everything below it at once. A delegation always ends.

## Requirements

- **FR-001**: A delegation MUST say its tenant, who delegates and who is delegated to (never the same principal), the delegation above it and the first of its chain (both empty for the first), how deep it is, its purpose, the one resource it is limited to (exact or a prefix), an extra condition, whether it may be passed on and how many more times, when it starts, when it ends, its status and, where it was ended early, when, by whom and why; and MUST be kept a year after it ends.
- **FR-002**: A delegation MUST name the permissions it passes on, once each.

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

- **Delegation** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
