# Feature Specification: Estate capture policy

**Spec ID:** 0004-estate-capture
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** How the evidence of a tenant's assets is captured, as typed data the compiler checks: the branch it is kept on, where the collector runs, how often each kind of asset is observed, whether every capture or only a change and a heartbeat is journaled and how the journal is committed, whether and when the branch is pushed, and whether a person's seal is asked for. The collector runs without a person; a seal is a person's act.

## Requirements

- **FR-001**: `defineCapturePolicy` MUST give a policy in which every field is present, taking from the defaults what is left out: the branch `evidence`, the controller as collector, managed assets every 15 minutes and adopted assets every day, every capture journaled with the journal committed every hour, nothing pushed to the remote `origin`, and a seal asked for only with an export; and MUST give every reason, together, where it cannot.
- **FR-002**: The branch MUST be a name of a branch that is not the tenant's own (`main`, `master`, `HEAD`, `trunk`, `develop`), so that the tenant's branch stays what a person signed.
- **FR-003**: The collector MUST run on `controller` or on an asset, whose id is an asset id.
- **FR-004**: A cadence MUST be an ISO 8601 duration above zero and at most seven days, for managed assets, for adopted assets and for each asset named (which MUST be an asset id); the freshness window of a cadence MUST be twice the cadence and never more than seven days.
- **FR-005**: The journal MUST be `every-capture` or `changes-and-heartbeat`; a heartbeat MUST be given for the second and only for it, MUST be a duration above zero and MUST NOT be longer than the freshness window of any cadence, so that an asset does not look stale between heartbeats; the interval of the journal's commits MUST be a duration above zero.
- **FR-006**: Pushing MUST be `never`, `after-commit` or `every`, to a remote that has a name; `every` MUST have an interval above zero, and an interval MUST NOT be given for another mode.
- **FR-007**: A seal MUST be `never`, `on-export` or `daily` (a person's seal of the journal's head is due every day), and a requirement written out MUST name a signer where it is not `never`.
- **FR-008**: `cadenceOf` MUST give the cadence of an asset: its own where one is given, else that of its state, and nothing for a discovered asset.
- **FR-009**: A policy MAY name `ignore`, the records of the state of a machine (`os`, `hardware`, `security`, `software`, `listening`, `agent`) that are not kept as evidence, sorted and each once; a name that is not a record is refused. It is for a fleet whose machines share a network namespace or a kernel with what else runs on their host, where a record such as the listening ports moves with that and not with the machine; nothing is ignored by default, and what is ignored is said in the policy that a person reads. Relies on audit rows: F2.

## Acceptance scenarios

1. **Given** no input, **When** the policy is defined, **Then** it holds the defaults, per FR-001.
2. **Given** the branch `main`, **When** the policy is defined, **Then** it is refused, per FR-002.
3. **Given** a cadence of eight days, **When** the policy is defined, **Then** it is refused, per FR-004.
4. **Given** a heartbeat of an hour and managed assets every 15 minutes, **When** the policy is defined, **Then** it is refused, because a managed asset would look stale, per FR-005.
5. **Given** an adopted asset and a managed asset with a cadence of their own, **When** the cadence is asked, **Then** it is the one of their own or that of their state, per FR-008.

## Out of scope

- Collecting, journaling, committing and pushing: the programs that use the policy.
- Whether the signer a seal names is one of the tenant's signers: the tenant's check.

## Edge cases

- An asset that is discovered has no cadence, per FR-008.

## Assumptions

- Seven days is the longest interval of continuous validation of FedRAMP 20x.

## Open questions

- None.

## Key entities

- **Capture policy** - how the evidence of a tenant's assets is captured, journaled, committed, pushed and sealed.

## Success criteria

- **SC-001**: A policy that would leave an asset looking stale between captures does not compile into a tenant.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
