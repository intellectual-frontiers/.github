# Feature Specification: Identity agents

**Spec ID:** 0040-identity-agent
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** AI agents as principals. An agent decides for itself what to do, so it is accountable to an owner, has a provenance, has autonomy limited by a level (observe, suggest, act with approval, autonomous), acts in runs under delegations, calls only tools it has been granted, spends budgets that cannot be exceeded, and asks a person before anything risky. A version pins which model snapshot, which prompt (by its hash; the prompt is not kept here) and which tools (by the hash of their manifest), and revoking a version pulls it from every run that uses it. Tool calls are kept as hashes of their arguments and never the arguments. An approval is bound to the hash of the arguments of one call, is used once, and is decided by a person.

## Requirements

- **FR-001**: An agent MUST be a principal with its autonomy level, its purpose, what it is built with, the risk at or above which its calls need an approval, how deep a delegation it may act in, and optionally a sponsor and how many runs it may have at once.
- **FR-002**: An agent version MUST pin the provider, the model, the model's snapshot, the hash of the prompt and the hash of the tool manifest, be unique by agent and label, and say where it is (candidate, approved, active, retired or revoked); and the model MUST hold no prompt, no argument and no secret in the clear.
- **FR-003**: A tool MUST say the permission a call needs, its risk and its side effect, and a tool grant MUST give a tool to an agent once, with an optional condition on the call, whether it needs approval and how many calls a run may make.
- **FR-004**: A run MUST say its agent, its version, its tenant, who started it, the delegation it acts under and the run that started it; a tool call MUST be one for an index of a run, with what was decided about it, a hash of its arguments and its tokens and cost; a budget MUST be one for an agent or delegation or run and a meter and a window, with its limit, what is used and a version that makes two updates unable to both win; and an approval MUST say the action, a hash of the arguments, who may approve, its status and its expiry, and be kept a year.

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

- **Agents** - what this module holds, as its requirements say.

## Success criteria

- **SC-001**: A project composes this module only when it needs it, and the database refuses what the requirements say it must refuse.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
