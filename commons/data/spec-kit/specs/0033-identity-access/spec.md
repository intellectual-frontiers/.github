# Feature Specification: Identity access

**Spec ID:** 0033-identity-access
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** Role-based access for every kind of principal. Permissions are named `resource:action` and carry how risky they are and what using them does; roles hold permissions, inherit from other roles, and say which kinds of principal may hold them (a role that is privileged is never held by an agent); rules of separation of duties say that no principal may hold too many of a set of roles together; a role assignment grants a role to a principal of any kind, in a tenant, for one resource and a time if it says so, and cannot be made twice even where the resource is empty; and entitlements say what a tenant may use, as distinct from what a principal may do. Permissions are the one registry that the other kinds of access (attribute-based, relationship-based, delegated) name, so that a tool call, an API route and a button are all one action.

## Requirements

- **FR-001**: The access module MUST require the identity core and hold the permission (unique by its key, with its risk, its side effect and the kinds that may hold it), the role (unique by key within its tenant, with the kinds that may hold it and whether it is privileged), a role's inheritance of another role (never of itself) and the permissions a role holds (once each).
- **FR-002**: A separation rule MUST say how many of a set of roles together are too many, and name its roles once each.
- **FR-003**: A role assignment MUST grant one role to one principal of any kind in one tenant, with who granted it, how it came to be, its status and its time, and MUST be unique by a key made of the principal, the role, the tenant and the resource, so that it is not made twice where the resource is empty; and an invitation MUST name the roles it grants once each.
- **FR-004**: An entitlement MUST say what feature a tenant may use, how much, until when and where it comes from.

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

- **Access** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
