# Feature Specification: Arca tenancy

**Spec ID:** 0029-arca-tenancy
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A business that serves businesses (B2B), and the consumers of those businesses (B2B2C), keeps each customer's data apart from every other's, and has a hierarchy of such boundaries: a platform at the root, resellers and businesses on it, and for a business the pool of its own consumers, kept apart from its staff and from other businesses' consumers. This module is that boundary and that hierarchy as a subject area (0028-modules), in the words of Arca. It requires the party model (a tenant may be for an organization) and nothing else, and is written to be required by the models that want a scope (identity, orders, billing, content) so that none of them depends on another. A WorkOS organization or an Okta org is a `business` tenant; the vendor is the root `platform` tenant; the consumers of a business are a `consumerPool` tenant whose parent is that business; an Auth0 tenant is an environment, which is deployment, not data.

## The module

- **FR-001**: The tenancy module MUST be a module (0028-modules) named `arcaTenancy` that requires `arcaParty` and holds the concept `tenant` and the code lists `tenantKind`, `tenantStatus` and `isolation`, importing the party model through its entry of `exports`.
- **FR-002**: A tenant MUST have an identifier, a kind (platform, reseller, business or consumer pool), a slug that is unique among tenants, a display name, an ancestry (the path of its parents from the root, kept by the operation that moves a tenant), a status (active, suspended or closed), an isolation (shared or dedicated) and the time it was made; it MAY have an organization (a consumer pool has none) and a parent, and MUST NOT be its own parent.
- **FR-003**: Projected and bound for each of the three dialects and loaded into the real engines, the tenant MUST be a table whose slug is unique, whose kind, status and isolation are checked against their code lists, whose parent is a foreign key to a tenant, and which refuses to be its own parent.

## Out of scope

- The operations that move a tenant, close it or keep its ancestry (a later specification, with the identity operations).
- Row-level scope of other concepts by tenant: a composition overlay (a later specification).
- Environments (development, production): deployment, not data.

## Edge cases

- The root tenant has no parent, per FR-002.
- A tenant that cycles through its parents: not found by a constraint; the operation that moves a tenant refuses it, per FR-002.

## Assumptions

- Acyclicity of the hierarchy and its depth limit are preconditions of the operations that move a tenant.

## Open questions

- **OQ-1**: Whether the hierarchy's acyclicity can be said in governance (no annotation says it).

## Key entities

- **Tenant** - a boundary that separates one customer's data from another's.

## Success criteria

- **SC-001**: A project adopts tenants without identity, or identity with tenants, and gets only the tables it listed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
