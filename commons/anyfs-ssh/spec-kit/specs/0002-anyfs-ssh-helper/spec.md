# Feature Specification: AnyFS SSH helper

**Spec ID:** 0002-anyfs-ssh-helper
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The helper is the one small script that runs on the host: it keeps the store's rules where the files are (revisions, atomic writes, locks, confinement), speaks to the store by arguments, standard input, standard output and its exit status, and is trusted by its SHA-256, which the library pins.

## Requirements

- **FR-001**: The helper of the posix dialect MUST be the script `src/helper/posix.sh`, and the module `src/helper/posix.ts` that carries its text and its SHA-256 MUST be made from it by `bun tools/helper.ts`; the hash in the module MUST be the SHA-256 of the script, and `verify` MUST fail where the module is not what the script makes.
- **FR-002**: The dialect of a host MUST be a closed union (`HostDialect`, `posix` today) and `helperOf` MUST state every case, so that a dialect added later is a compile error wherever a case is missing.
- **FR-003**: A call of the helper MUST be one argument vector: the kept script, the command, the folder and the arguments, or the carried script as the argument of `sh -c`; no word of it MUST hold the bytes of an object, which go over standard input.
- **FR-004**: The helper MUST answer by its exit status and its output: 0 done, 10 missing, 11 conflict with `found absent` or `found sha256:HEX` (and ` at to` for the target of a rename), 12 refused with the reason, 13 locked, 14 too large, 21 no tool for SHA-256, 22 no such folder, 30 a hash that is not the one asked for, and any other status a failure; the library MUST read each as one case of a closed union, and 255 or a signal as a lost connection.
- **FR-005**: A write, a delete and a rename MUST take an expectation (`any`, `absent` or `rev:HEX`) and MUST leave the object as it was, naming what was found, where it does not hold; an expectation of no object MUST be an exclusive link, and one of a revision MUST be held under the lock of the path.
- **FR-006**: A path MUST be refused as `shape` where it is empty, absolute, has an empty, `.` or `..` segment or a line end, as `hidden` where a segment begins with `.anyfs-`, and as `outside` where it, or a link on the way to it, leaves the folder of the store; a link MUST never be an object and a file outside the folder MUST never be read, written or removed.
- **FR-007**: A name with a space, a quote, a dollar sign, a backquote, a leading dash, a glob character or a letter that is not ASCII MUST be kept exactly as it is, and no name MUST be run by the shell.
- **FR-008**: Of many writers that expect the same revision exactly one MUST win; a lock MUST be a folder made by `mkdir`, a lock of a process that is gone MUST be taken over under a second lock that is looked at again once held, and one of a process that is alive MUST be waited for, to a limit, after which the answer is `locked`.
- **FR-009**: A write MUST go whole through a temporary file in the folder of the object and a rename, and a read or a write of more than the most it is told MUST be refused as too large with nothing kept.
- **FR-010**: `install` MUST keep the script, given on standard input, under a name that carries its hash in a folder of the account, once, not writable, and MUST refuse a script whose hash is not the one asked for and keep nothing.

## Acceptance scenarios

1. **Given** two writers that expect the revision an object has, **When** both write at once, **Then** one is told it is done and the other that the object is at the new revision, per FR-008.
2. **Given** a link in the folder that points outside it, **When** a path through it is read or written, **Then** the answer is `outside` and the file outside is unchanged, per FR-006.

## Out of scope

- A dialect for hosts that have PowerShell, `batch`, `history`, ranges and streams, and the fleet store itself: their own specifications.

## Edge cases

- A lock left by a process killed in the moment between making the folder and writing its pid: it is waited for to the limit, then `locked`, per FR-008.
- A host that has no `stat` that gives a time: the time of an object is left out, per FR-004.

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
