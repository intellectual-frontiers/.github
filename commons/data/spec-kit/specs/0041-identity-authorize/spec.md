# Feature Specification: Identity authorize

**Spec ID:** 0041-identity-authorize
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** One decision for every kind of principal. `decide(principal, action, resource, context)` answers for a person, a machine, a device, an AI agent or a group alike, in the same transaction as the effect it guards. Permits come from roles (held directly, through groups, and through role inheritance), from relationships (a tuple that a permission relation joins to a permission) and from policies; any refusal wins; and what is unknown never allows: an attribute that is not known, or is older than its definition allows, makes a policy that reads it unknown, an unknown allow allows nothing, and an unknown refusal refuses. A principal acting under a delegation can do only what every delegation of its chain passes on and what the person at the root of the chain can do themselves at that moment, so a delegation never adds and revoking a right at the root ends what was delegated from it. Every decision says why. Policies are written in a small closed expression tree, with no code in it, that answers true, false or unknown. The audit trail is written with each operation and is a chain of hashes in which a change to an event shows.

## Requirements

- **FR-001**: `decide` MUST allow a principal that holds a permission through a role assigned to it directly, to a group it is in (to any depth up to five), or inherited from a role it holds, within the tenant, the resource and the time of the assignment, and MUST refuse a principal that is not known or is not active.
- **FR-002**: `decide` MUST NOT let an agent use a role that is privileged, MUST refuse a permission that names a feature the tenant is not entitled to, and MUST allow a permission through a relation tuple that a permission relation joins to it, for that object only, until the tuple expires.
- **FR-003**: `decide` MUST apply policies so that a refusal wins over any permit, an allow whose condition is unknown allows nothing, a refusal whose condition cannot be told not to apply refuses, and a stored attribute that is older than its definition allows is unknown.
- **FR-004**: The expression language MUST be a closed tree (`and`, `or`, `not`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `contains`, `startsWith`, `exists`, attributes by key, literals) that evaluates to true, false or unknown, where a missing attribute and a comparison of different types are unknown, and MUST refuse as unknown anything that is not a well-formed expression.
- **FR-005**: For a principal acting under a delegation, `decide` MUST require every delegation of the chain to be active, in force, in the tenant, to the one who holds it, passing on the permission, limited to a resource that includes the one asked about and with a condition that holds, and MUST then require the delegator at the root of the chain to be allowed the action itself, so that a delegation never adds.
- **FR-006**: The identity audit sink MUST write each event in the transaction of what it records with the hash of the event before it, and `verifyAuditChain` MUST report a chain that is forked or broken, so that a change to an event shows.

## Out of scope

- A generated typed client and a server: the runtime is a function.
- Operations that are not of delegation and agents (create a human, a session, a key, a device): later specifications.
- Real concurrency: two connections at the same instant cannot be shown by these in-process engines; each operation's single conditional update is what decides.

## Edge cases

- DuckDB cannot update a row that another row refers to, so these operations run on PostgreSQL and SQLite, per FR-001.
- A decision about a principal that is disabled is a refusal whatever it holds, per FR-001.
- A delegation whose delegator loses the right it passed on stops working at once, because the root is asked again at every decision, per FR-001.

## Assumptions

- A role of a group is held by its members, and a group's members may be principals of any kind.
- The clock is given to each operation, so that a test is the same every time.

## Open questions

- **OQ-1**: Whether an approval by two people (four eyes) is wanted for a critical action; the model supports one.
- **OQ-2**: Whether the decision engine should be given bound parameters instead of literals, since agents supply free text.

## Key entities

- **Decision** - allow or deny, with why, what must happen first, and what decided.
- **Delegation chain** - the delegations from a principal back to the person at the root.

## Success criteria

- **SC-001**: An agent can be given exactly the authority of a person for exactly one task, can be stopped at once, and leaves a trail in which a change shows.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
