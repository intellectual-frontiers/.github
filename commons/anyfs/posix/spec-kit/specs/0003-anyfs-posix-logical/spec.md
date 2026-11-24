# Feature Specification: AnyFS POSIX: logical

**Spec ID:** 0003-anyfs-posix-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The model the view reasons with: the plan of each operation for the capabilities of a store, the table from a problem to a code, the directories derived from a list, the mode of a name, the handles of open objects and the contract of the view.

## Requirements

- **FR-001**: `plan` MUST be total over the operations: for the capabilities of a store and a policy it MUST give the fidelity of the operation and the operations of the store it may use, and the same facts MUST give the same plan.
- **FR-002**: The plans MUST be: `stat-file`, `unlink` native; `stat-dir`, `readdir` emulated as derived directories; `mkdir` emulated as a marker object where the policy keeps markers and as no marker where it does not; `rename-file` native where the store has `rename` and a copy then a delete where it has not; `rename-over` a copy then a delete; `rename-dir` and `rm-r` a walk over a list; `open-write`, `write`, `fsync` and `close` through a write-back buffer, unguarded at the close where the store has no `cas`; `truncate` and `append` a read-modify-write where the store has `cas` and refused where it has not; `touch` emulated without a time; `chmod`, `chown`, `utimes`, `symlink`, `link`, `readlink` and `mmap` refused as not in the model; and every operation that changes a store that cannot be written refused as read-only.
- **FR-003**: `errnoOf` MUST be total over the five kinds of problem and the seven reasons of a refusal: `missing` is `ENOENT`; a `conflict` is `EEXIST` where the operation was making an object and expected none, and `ESTALE` otherwise; `read-only` is `EROFS`; `outside-scope` is `EXDEV` for a rename and `EACCES` otherwise; `unsupported-expectation` and `capability-absent` are `ENOTSUP`; `too-large` is `EFBIG` for an operation that writes and `ENAMETOOLONG` otherwise; `unportable-path` is `EINVAL`; `consent` is `EACCES`; and `unavailable` and `tampered` are `EIO`.
- **FR-004**: `modeOf` MUST give a file the mode of the ownership for files and a directory the mode for directories, with every bit of write taken away where the store has no `write`.
- **FR-005**: `childrenOf` MUST derive a directory from the objects below it: it exists where an object lies below it, its names are the first segments below it in the order of their code points, a name that is an object and also the start of other paths is a file and is noticed, and a marker object keeps a directory and is not a name in it.
- **FR-006**: The table of handles MUST give numbers from 3 upwards and never reuse one while it is open, `writeAt` MUST pad a gap with zeros, `resize` MUST cut or pad with zeros, and `concat` MUST add bytes at the end.
- **FR-007**: The contract `Posix` MUST be the one type the command line, the servers and a mount are written against: every operation of it MUST take text paths, and end with a result of an outcome or an error that carries a fidelity, and `explain` MUST give the plan of an operation without running it.

## Acceptance scenarios

1. **Given** a store with the five core capabilities, **When** `rename-file` is planned, **Then** it is emulated as a copy then a delete; and **Given** a store that also has `rename`, **Then** it is native, per FR-002.
2. **Given** a `missing` problem and a `conflict` that expected no object, **When** their codes are read, **Then** they are `ENOENT` and `EEXIST`, per FR-003.
3. **Given** the objects `d/x/1`, `d/2` and a marker `d/.m`, **When** the names of `d` are derived, **Then** they are `2` and `x/`, and the marker is not one, per FR-005.

## Out of scope

- Running a plan against a store: the physical layer does that.

## Edge cases

- A name that is both an object and the start of other paths is shown as a file and noticed (FR-005).
- An operation whose plan is refused names no step (FR-001).

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and gives the store, its capabilities and its problems.

## Open questions

- None.

## Key entities

- **Plan** - how an operation is carried out on a store of some capabilities.
- **Facts** - the capabilities and the policy a plan depends on.
- **OpenFile** - an object held open, with its buffer.

## Success criteria

- **SC-001**: A plan depends on the capabilities and the policy and on nothing else, and the table of codes has no problem it does not map.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
