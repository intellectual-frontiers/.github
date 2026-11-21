# Feature Specification: AnyFS SSH mirror

**Spec ID:** 0005-anyfs-ssh-mirror
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The fleet as it is meant to run: the store of a real ssh server is the primary of a mirror of AnyFS, a branch of a Git repository and a folder are its replicas, and what a fleet needs of that is proved against a real OpenSSH server made for the run.

## Requirements

- **FR-001**: Ten changes written through the mirror to the host MUST be one settlement into one commit of the Git branch and ten files of the folder, a second settlement MUST make no commit and change no file, a change and a delete MUST be one more commit, and the ledgers MUST be on the host, hidden from the store and absent from every replica.
- **FR-002**: A path of the Git branch that someone committed to directly MUST be reported as diverged and left as it is; where the host cannot be reached a read of the store MUST be `unavailable` and a read of the mirror MUST be answered by a replica and say that it was, with what the replica holds; a write to a host that cannot be reached MUST fail as the host's own and queue nothing.
- **FR-003**: The Git replica MUST become the primary and the host a replica of it, with the ledgers moved to the branch in one commit, the writes of that period reaching the host by settlement, and back again, each promotion an event.
- **FR-004**: Of two writers through the mirror that expect the same revision of the host one MUST win and one MUST be a conflict, and the replicas MUST hold the winner.

## Acceptance scenarios

1. **Given** a fleet of ten machines written to the host, **When** the mirror is settled, **Then** the branch has one commit with ten files, per FR-001.
2. **Given** a host that cannot be reached, **When** a machine's record is read, **Then** the Git replica answers and says that it did, per FR-002.

## Out of scope

- A replica in the cloud (its own library), and the fleet store of estate that is made on this mirror.

## Edge cases

- A computer with no OpenSSH server or no git: the tests are skipped with the reason, per FR-001.

## Assumptions

- The server is the throwaway OpenSSH server of 0004-anyfs-ssh-sshd-test.

## Open questions

- None.

## Key entities

- **The fleet mirror** - the host as the primary, a branch and a folder as replicas.

## Success criteria

- **SC-001**: The four scenarios pass against a real OpenSSH server.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
