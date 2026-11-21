# Feature Specification: Tenancy for service providers

**Spec ID:** 0002-tenancy
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A managed service provider runs the compliance work of many client organizations. Each client's data is its own tenant; the provider's staff act on it only as far as an engagement lets them, for as long as it lasts; the provider sees a portfolio of its clients and no more than it is granted; and a client hands an assessor a matrix of who answers for each requirement (itself, the provider, both, or a service it inherits from). This library is the model and the rules of that, with no storage and no company in it.

## Requirements

- **FR-001**: The model MUST have parties (an `operator` or a `client`, with an id and a name), principals (an id and the party they act for), engagements (an operator serves a client from an instant, until another or open) and grants (a principal holds a role on a client's tenant from an instant, until another or open); a model MUST be refused where a party or a principal id is used twice, a principal is of an unknown party, an engagement is not from an operator to a client or ends before it begins, a grant is to an unknown principal or on something that is not a client or ends before it begins, or a grant is held by someone who is neither the client's own nor an operator engaged with it.
- **FR-002**: A role MUST allow only what the model says: the `owner` everything (`read`, `record-evidence`, `determine`, `approve-change`, `administer`, `export`); the `operator` read, record evidence and export; the `auditor` read, determine and export; the `viewer` read. An operator's staff therefore never determine an objective, approve a change or administer a tenant.
- **FR-003**: A decision MUST deny by default and say why: no principal, no grant on the tenant, a grant that is not live (before its start or at or after its end), an operator's principal whose party has no live engagement with the tenant at that instant, or no role held that allows the action; it allows only where a live grant of an allowing role is held by a party that may hold it, and names the role.
- **FR-004**: A portfolio MUST list only the tenants the principal may read, with each tenant's counts of roll-ups and findings (never its evidence or the names of its assets), and its totals MUST be over those tenants alone, so that a tenant the principal may not read is neither listed nor counted.
- **FR-005**: A matrix of responsibility MUST give, for a framework's requirements, who answers for each (`client`, `operator`, `shared` or `inherited`), the requirements with no statement apart as unassigned, and refuse a statement for a requirement the framework does not have, a requirement stated twice, an inherited one that names no provider, and a shared one that says nothing of what each side does.
- **FR-006**: The standing a client may claim for a requirement MUST follow from whose it is: its own for a client's, the operator's for an operator's, the provider's for an inherited one, and for a shared one the worse of both, where a side that has given no evidence counts as having none.
- **FR-007**: Every decision, portfolio and matrix MUST be a pure function of the model, the statements and the instant: the same inputs give the same output, with no clock and no network.

## Acceptance scenarios

1. **Given** an operator engaged with two clients and a grant on each, **When** the engagement with one ends, **Then** its staff may no longer act on that client and its tenant drops out of their portfolio and totals, per FR-003 and FR-004.
2. **Given** a requirement that is shared with nothing said of the split, **When** the matrix is made, **Then** it is refused, per FR-005.

## Out of scope

- Where a tenant's data lives, and how a principal proves who they are: the program that uses the library.
- Billing, contracts and the terms of an engagement beyond its dates.

## Edge cases

- A grant that ends on the instant asked about is not live, per FR-003.
- A principal with two grants on one tenant is allowed where either allows, per FR-003.

## Assumptions

- Instants are written `YYYY-MM-DDThh:mm:ssZ`, so that they compare as text.

## Open questions

- None.

## Key entities

- **Party**, **Principal**, **Engagement**, **Grant**, **Responsibility**.

## Success criteria

- **SC-001**: A provider's staff can reach only the clients they are engaged and granted for, and a client can show who answers for each requirement.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
