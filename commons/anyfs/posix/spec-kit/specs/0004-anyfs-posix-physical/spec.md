# Feature Specification: AnyFS POSIX: physical

**Spec ID:** 0004-anyfs-posix-physical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The view of a store as a file system: `posix(store)` carries out each operation by the plan of its capabilities, through the handler of the store, and every result carries the fidelity of its plan.

## Requirements

- **FR-001**: `posix` MUST take a store of at least the three capabilities that read, `read`, `list` and `stat` (a store without one MUST be a compile error), and MUST read from its capabilities what it can write, MUST carry out every operation through the handler of the store and nothing else, and MUST give every outcome and every error the fidelity of the plan of the operation it carried out.
- **FR-002**: `stat` MUST give a file the size, the revision and the time of its object, a directory (an object lies below it) no size, the root as a directory, and a name that is not there `ENOENT`; `readdir` MUST list the names of a directory in the order of their code points with `ENOTDIR` for a file and `ENOENT` for a name that is not there; `readFile` MUST give the bytes, `EISDIR` for a directory and `ENOENT` for a name that is not there.
- **FR-003**: `writeFile` MUST make or replace an object with its whole bytes and refuse a directory (`EISDIR`), a name with a file above it (`ENOTDIR`, where the policy checks the ancestors) and, where exclusive, a name that is there (`EEXIST`); `mkdir` MUST write nothing under the policy that keeps no marker and one marker object under the policy that does, `EEXIST` for a name that is there and `ENOTDIR` for a file above; `rmdir` MUST remove only a directory that holds nothing but its marker (`ENOTEMPTY` otherwise, `ENOTDIR` for a file, `EINVAL` for the root); `unlink` MUST remove an object (`EISDIR` for a directory); `touch` MUST make an empty object where there is none and leave one that is there.
- **FR-004**: A handle MUST hold the whole object in a buffer: a write MUST change only the buffer, the store MUST be written at `fsync` or `close` and not before, the write MUST expect the revision read at the open (and no object where there was none), a change another writer made since MUST be `ESTALE` at the close (`EEXIST` for `wx`), where the store has no `cas` the close MUST overwrite and say so in the outcome, a read of a handle opened to write only and a write of a handle opened to read only MUST be `EBADF`, and a close MUST let the handle go whether or not it was written.
- **FR-005**: `rename` MUST move an object with the `rename` of the store where it has one and with a copy then a delete where it has not, replace a file with a copy then a delete guarded by the revision where the store has `cas`, refuse a file onto a directory (`EISDIR`), a directory onto a file (`ENOTDIR`), a directory onto a directory that is there (`EEXIST`) and a directory into itself (`EINVAL`), and move a directory by moving every object below it, reporting the objects it did and those it could not as `EIO` where some were not moved; `removeAll` MUST list the objects below a name and delete them, in batches where the store has `batch`, with the same report, `EINVAL` for the root and `ENOENT` for a name that is not there.
- **FR-006**: The read cache MUST be kept by path and revision, so that an entry can never be stale, MUST hold at most the bytes the policy gives, MUST drop the oldest first, MUST NOT keep an object larger than itself, and MUST give a copy the caller may change.
- **FR-007**: `truncate` and `appendFile` MUST read an object, change it and write it back expecting the revision they read, try again after a conflict up to the attempts of the policy and then end with `ESTALE`, and MUST be refused (`ENOTSUP`, a refusal of `capability-absent`) where the store has no `cas`; `chmod`, `chown`, `utimes`, `symlink`, `link`, `readlink` and `mmap` MUST be refused with `ENOTSUP` and the reason that an object store has no such thing, and MUST change nothing.
- **FR-008**: An operation MUST use no operation of the store that the steps of its plan do not name, and a write into a handle MUST use none; a view over a store that cannot be written MUST refuse every operation that changes it with `EROFS`, and show the modes of a name without the bits of write.

## Acceptance scenarios

1. **Given** a store in memory, **When** `/fleet/olympia.json` is written and `/fleet` is read, **Then** the list has `olympia.json` as a file with its size, and the list says it is derived, per FR-002 and FR-001.
2. **Given** a handle opened to write, **When** it is written, **Then** the store has nothing until the close, per FR-004.
3. **Given** a store with `cas`, **When** another writer changes an object after it was opened and the handle is closed, **Then** the close is `ESTALE` and the other writer's bytes stay, per FR-004.
4. **Given** a store with the five core capabilities, **When** a file is renamed, **Then** it is moved by a copy then a delete and the fidelity says it is not one change, per FR-005.
5. **Given** a store without `cas`, **When** an append is asked, **Then** it is refused with `ENOTSUP`, per FR-007.

## Out of scope

- Serving the view over a protocol, and a command line over it: later libraries.

## Edge cases

- A directory is never written, and an empty one is kept only by a marker (FR-003).
- A handle that failed to close is gone and what it held is discarded, and the error says so (FR-004).

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and gives the store, its capabilities and its problems.

## Open questions

- None.

## Key entities

- **Posix** - the view of a store as a file system.
- **ReadCache** - whole objects by path and revision.

## Success criteria

- **SC-001**: A view over any store gives the answers of the reference model and the fidelity of its plan.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
