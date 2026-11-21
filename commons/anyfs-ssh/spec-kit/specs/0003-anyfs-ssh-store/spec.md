# Feature Specification: AnyFS SSH store

**Spec ID:** 0003-anyfs-ssh-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The store on a host: a store of AnyFS over a folder on a host reached through an executor of Headless, with the capabilities it keeps, a revision that means the same as in memory, bytes that go over standard input, and a problem of AnyFS for everything that goes wrong.

## Requirements

- **FR-001**: The store MUST pass every case of the conformance suite of AnyFS that its capabilities hold it to, under each shell of the host and with the helper kept on the host and carried in each call.
- **FR-002**: The store MUST have the capabilities `read`, `write`, `list`, `stat`, `delete`, `cas` and `rename` and no other, MUST be `strong`, MUST have the place `ssh` of the host and the folder, and a list MUST be paged by name with a cursor.
- **FR-003**: The revision of an object MUST be `sha256:` and the digest of its bytes, the same as the store in memory gives for the same bytes, computed by this library for what it reads and writes and by the host for `stat` and `list`.
- **FR-004**: The bytes of an object MUST go over standard input and standard output, never in an argument, and every call MUST be one argument vector of the program `sh` that the executor quotes, so that a name with a quote, a dollar sign or a leading dash is one word.
- **FR-005**: A path that leaves the folder, by a link or otherwise, MUST be refused as `outside-scope`, the helper's own names and the names another file system could not hold MUST be refused as `unportable-path`, and a file outside the folder MUST never be touched.
- **FR-006**: The helper MUST be kept on the host under a name that carries its hash and used from there; where it cannot be kept it MUST be carried in each call with no capability lost; and a host whose helper is not the pinned one MUST be refused, with nothing run from it.
- **FR-007**: A lost connection and a call stopped by a signal or a time MUST be `unavailable` and retryable, a call the host answers as a failure MUST be `unavailable` and not retryable, and a lock that is held too long MUST be `unavailable` and retryable.
- **FR-008**: Bytes that the host did not keep as sent, or a revision it answers that is not the revision of the bytes sent, MUST be `tampered`, never a success.
- **FR-009**: An object of more than `maxBytes` (32 MiB where it is not said) MUST be refused as `too-large` when written, before it is sent, and when read, before it is taken, and the trait `maxObject` of the store MUST say the limit.
- **FR-010**: A host with no tool for SHA-256, a folder that is not there (and was not asked to be made), a folder that is not an absolute path and a helper of another protocol or dialect MUST not be taken, each with its sentence, and the folder MUST be made where `create` says so.

## Acceptance scenarios

1. **Given** a host with a folder of the fleet, **When** two machines write the same asset expecting the same revision, **Then** one write is done and the other is a conflict that names the revision found, per FR-003.
2. **Given** a connection that is lost, **When** a read is asked, **Then** the answer is `unavailable` and retryable, per FR-007.

## Out of scope

- A dialect for hosts that have PowerShell, `batch`, `history`, ranges and streams, and the fleet store itself: their own specifications.

## Edge cases

- A host that has only `openssl` for SHA-256: it is used, per FR-010.
- A write whose bytes the network changed: `tampered`, per FR-008.

## Assumptions

- The host has a POSIX shell and the utilities of POSIX, and a tool for SHA-256.

## Open questions

- None.

## Key entities

- **The helper** - the script that runs on the host.
- **The store** - the store of AnyFS over a folder of the host.

## Success criteria

- **SC-001**: The tests of the specification pass under dash and bash.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
