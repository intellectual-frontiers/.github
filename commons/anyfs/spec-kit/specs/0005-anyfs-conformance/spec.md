# Feature Specification: AnyFS: conformance and the first backends

**Spec ID:** 0005-anyfs-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** One conformance suite that every backend passes, with each case needing named capabilities, and the two backends the library ships: the store in memory and the store in a folder of the local file system.

## Requirements

- **FR-001**: The conformance suite MUST be a list of cases, each with an id, a sentence and the capabilities it needs, which a backend's tests run for every case whose needs its store has; `casesFor` MUST give the cases for a set of capabilities, and a case MUST fail with a sentence that names what differed.
- **FR-002**: The cases MUST cover: the round trip of bytes and revision; the expectations `any`, `absent` and a revision; writers that race (of the same expectation, exactly one MUST win); the order and the paging of a list and its prefix; `stat`; the idempotence of a delete; names with spaces and non-ASCII text; the empty file; a batch that is all or nothing (needs `batch`); a rename that does not overwrite (needs `rename`); a history in order (needs `history`); and a long random sequence of operations compared with a model, from a seed that is printed with a failure.
- **FR-003**: The memory store MUST have the capabilities `read`, `write`, `list`, `stat`, `delete`, `cas`, `batch`, `rename` and `history`, be `strong`, and use as a revision `sha256:` and the digest of the bytes.
- **FR-004**: The local store MUST be made for a folder, have the capabilities `read`, `write`, `list`, `stat`, `delete`, `cas` and `rename`, be `strong`, use as a revision `sha256:` and the digest of the bytes, write a file whole through a temporary file in its folder and a rename, take a lock for a path while it changes it, refuse a path that another file system could not hold, refuse every operation that would reach a file outside its folder, whether by a path or by a link, and never list the temporary files it makes.
- **FR-005**: The local store MUST NOT have `batch`, because the file system has no atomic change of several files; a store MUST NOT have a capability it does not keep, and a test MUST fail a store that has a method its capabilities do not name or lacks one they do.
- **FR-006**: The memory store and the local store MUST pass every case that needs only their capabilities.

## Acceptance scenarios

1. **Given** the memory store, **When** the suite runs, **Then** every case passes, per FR-006.
2. **Given** a folder with a link that leaves it, **When** a read through the link is made, **Then** it is refused as `outside-scope`, per FR-004.
3. **Given** a store that says `batch` and does not make a batch whole, **When** the suite runs, **Then** the batch case fails and names the path that was written, per FR-001.
4. **Given** two writers of the same path with `absent`, **When** they race, **Then** one wins and the other has a conflict, per FR-002.

## Out of scope

- Backends for other places: plugin libraries that run this suite.

## Edge cases

- The temporary file of a write is in the folder of the file, so that the rename does not cross a file system (FR-004).

## Assumptions

- A seed makes a sequence of operations the same every run.

## Open questions

- None.

## Key entities

- **Case**, **Memory store**, **Local store**.

## Success criteria

- **SC-001**: A new backend is complete when it passes the suite and says what it cannot do in its capabilities.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
