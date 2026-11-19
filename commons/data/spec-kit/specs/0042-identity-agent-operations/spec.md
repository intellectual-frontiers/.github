# Feature Specification: Identity agent operations

**Spec ID:** 0042-identity-agent-operations
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The operations of delegation and of AI agents, as contracts (0031) and as transactions. Delegating passes on some of what one principal may do to another and can only attenuate: the first of a chain is limited to what the delegator can do now, a sub-delegation to what the delegation above it passes on, no later than it ends, no wider in resource, no more redelegable. Revoking a delegation ends it and everything below it at once. A tool call by an agent is decided, budgeted and approved in one transaction: the tool must be granted and the agent's version allowed, the decision engine must allow it under the run's delegation, a risky call waits for a person, and a budget is never exceeded, the last unit being taken by one conditional update. An approval can be given only by a person who answers for the agent and who may do the thing themselves, is bound to the arguments of one call, and is used once. The kill switch switches an agent off in one transaction: the principal, its runs, its delegations, its credentials and what waits for approval.

## Requirements

- **FR-001**: The contracts of delegate, revokeDelegation, recordToolCall, decideApproval and killAgent MUST pass the lint of operations against the identity domain, and each MUST run as the service and name the audit action it records.
- **FR-002**: `delegate` MUST refuse, as a status and not an error, a delegation to oneself, one that is already over, one by a delegator or to a delegate that is not active, one for more than the delegator can do (for the first of a chain), and, for a sub-delegation, one by someone who is not the delegate of the delegation above it, from a delegation that cannot be passed on, with a depth that is not less, that outlives its parent, that is for a wider resource, or that passes on a permission the parent does not; and `revokeDelegation` MUST end the delegation and every delegation below it, saying how many, and say that it is already ended where it is.
- **FR-003**: `recordToolCall` MUST refuse a call by an agent that has not been granted the tool, whose run is not running, whose version is not approved or active, or that the decision engine refuses under the run's delegation, and MUST record every call, allowed or not, once for an index of a run, with a hash of its arguments.
- **FR-004**: A call to a tool that is risky (its risk at or above the agent's threshold, or a grant that always asks, or an obligation) MUST wait for an approval request; an approval MUST be usable once, for exactly the arguments and the action it was asked for and before it runs out, by one conditional update; and the budget of a run MUST be taken from by one conditional update, so that it is never exceeded and what is refused is not counted; and a call that is refused MUST use nothing up: the budgets are looked at before an approval is used, an approval is given back if a budget cannot be taken, and the budgets already taken are given back if another has no room.
- **FR-005**: `decideApproval` MUST refuse a decider that is not an active person (an agent never decides), one that is not the one who answers for the agent (its owner, or the person at the root of its delegation, or a holder of a named role) and one that cannot do the thing themselves, MUST decide a pending request once, and MUST say so where it is not pending or has run out.
- **FR-006**: `killAgent` MUST, in one transaction, disable the agent, stop its running runs, end its delegations and those below them, revoke its credentials and cancel what waits for approval, say how many of each, say that it is already off where nothing changed, and refuse a principal that is not an agent.

- **FR-007**: The operations of delegation and agents MUST take the identity of the one acting from the caller the project authenticated and never from an input: `delegate`, `revokeDelegation`, `decideApproval` and `killAgent` MUST refuse as a status a caller that is not the principal an input names as acting (`caller-mismatch`) and a call with no caller (`unauthenticated`); `revokeDelegation` MUST be allowed only to the one who delegated or to one who may `delegation:revoke` in the tenant; and `killAgent` MUST be allowed only to the one who answers for the agent or to one who may `agent:kill` in its tenant.

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
