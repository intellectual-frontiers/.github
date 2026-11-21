# Feature Specification: Bridge mirrored store

**Spec ID:** 0006-bridge-mirrored
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store with a primary that is the authority and replicas that converge on it by the plans of the bridge: writes go to the primary and wait for the replicas, a replica that fails is behind and never fails a write, a replica that someone else changed is diverged and is never merged, a read says where it was answered, the ledgers of what each replica was last brought to are the primary's and are hidden from the store, a replica can become the primary only as an explicit act, and the events say what happened.

## Requirements

- **FR-001**: The store of a mirror MUST have exactly the capabilities of its primary, the compiler MUST refuse a primary without the core capabilities (`read`, `write`, `list`, `stat`, `delete`), and a store of a primary that has no `batch` or no `cas` MUST have neither.
- **FR-002**: A write, a delete, a rename, an append and a batch MUST go to the primary and to no replica, MUST be queued for the replicas, and a settlement MUST bring a replica up to the primary by a plan of the bridge and a second settlement MUST change nothing.
- **FR-003**: A replica that cannot be reached, or that fails in the middle of a settlement, MUST NOT fail a write; it MUST be reported as `behind` and as not reachable where it could not be reached, what was done before the failure MUST be kept, and a later settlement MUST finish without doing again what was done.
- **FR-004**: A path at a replica that was changed by someone other than the mirror MUST be reported as `diverged` and MUST NOT be overwritten, merged or deleted, whatever is done to it at the primary, and the paths that are not diverged MUST still be brought up.
- **FR-005**: A read of the store MUST be the primary's answer alone; a read of the mirror MUST answer from a replica only where the policy says so and the primary is `unavailable`, MUST say that it did and which replica, and MUST say what the replica is known to hold of the path: `converged`, `pending`, `diverged` or `unknown`.
- **FR-006**: The ledgers MUST be kept on the primary as typed documents below a reserved prefix, the store MUST NOT list that prefix and MUST refuse every operation on it as `outside-scope`, a ledger MUST NOT be copied to a replica, a new mirror over the same stores MUST read them, and a ledger that cannot be read MUST be a problem and never an empty ledger.
- **FR-007**: The mirror MUST tell each write, each queue, each convergence, each state of a replica that is behind or diverged, each promotion and each degraded read as an event with the time, to listeners and to an iterable that ends when the mirror is closed, and a listener that throws MUST be dropped without affecting the operation.
- **FR-008**: A replica MUST become the primary only by an explicit call that the bridge allows (not behind and not diverged unless the caller accepts the loss or the divergence), only where it has every capability of the store, and then the old primary MUST become a replica, the ledgers MUST move to the new primary and be taken from the old one, and the other replicas MUST be seen against the new primary by what they share with it.
- **FR-009**: Where the policy says `after-write` a settlement MUST be started after a write and never waited for by it, settlements started while one runs MUST be combined, and `drain` MUST wait for those that were started.
- **FR-010**: Of two writes through the store that expect the same revision exactly one MUST succeed, as at the primary, and a mirror MUST end with a replica equal to the primary after writes at once and a settlement.
- **FR-011**: A mirror MUST work over a store in a folder and a store in memory alike, and a replica that is a folder MUST hold exactly the files of the primary and nothing of the ledgers.
- **FR-012**: A mirror MUST be refused where a name is used twice, where a store lacks a core capability, or where the prefix of the ledgers is the root, and a replica name MUST be one identifier.
- **FR-013**: After any run of changes and settlements the replica MUST equal the primary at every path that is not diverged, and a second settlement MUST change nothing.
- **FR-014**: A convergence MUST delete at a replica only within the allowance of the policy, and a policy that forbids deletes MUST leave a deleted file at the replica.

## Acceptance scenarios

1. **Given** a primary and a replica, **When** a file is written and the mirror is settled, **Then** the replica holds it and a second settlement does nothing, per FR-002.
2. **Given** a replica that is down, **When** a file is written, **Then** the write succeeds and the replica is behind, per FR-003.

## Out of scope

- A mirror of a primary and replicas of different paths (a replica is a whole store; narrow it with `sub` first), a mirror that runs in the background by a timer, and the merge of a diverged path.

## Edge cases

- A promotion of a replica whose capabilities are fewer than the primary's: refused, per FR-008.
- A primary that is down and a policy that does not allow a fallback: the read is the primary's answer, per FR-005.

## Assumptions

- A store passed as a replica is the object with all of its own capabilities, so that a replica with `batch` is settled as one batch.

## Open questions

- None.

## Key entities

- **The mirror** - the store, its replicas, and what is done with them.
- **The ledger** - for one replica, the digest of what it was last brought to at each path.

## Success criteria

- **SC-001**: A fleet written to an SSH primary is held, by settlement, by a Git replica and a folder, and the Git replica can become the primary.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
