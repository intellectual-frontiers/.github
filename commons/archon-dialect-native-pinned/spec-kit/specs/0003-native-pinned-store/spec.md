# Feature Specification: Native-pinned store

**Spec ID:** 0003-native-pinned-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Where the dialect puts what it installs and how: a folder of the user's own with a short path, a download that is kept only where it is the pinned one, one lock for each tool so that a second run waits and then finds the first's copy, and an install that is unpacked beside its place and switched into it by a rename that is retried where Windows refuses it. Nothing is written outside the store and no administrator rights are used.

## Requirements

- **FR-001**: The store MUST be the data folder of the program `archon` of the user (the XDG folders on Linux and macOS, `%LOCALAPPDATA%` on Windows, commons system 0031-install-locations) with `tools`, and a tool MUST be at `<store>/<name>/<version>` with no platform in the path, so that the path stays short.
- **FR-002**: The dialect MUST write only inside the store (the programs, `.cache`, `.locks`, the temporary folders and the folder of shims) and MUST NOT need administrator rights: it MUST NOT write below a system folder and MUST NOT change the PATH.
- **FR-003**: A download MUST be fetched through the verified download of `net` (retrying, resuming, kept in `<store>/.cache` only where its SHA-256 is the pinned one), and a file that is not the pinned one MUST be removed and never kept.
- **FR-004**: A tool MUST be installed under a lock of its own (`<store>/.locks/<name>`): a second run MUST wait and then use the first run's copy and MUST NOT fetch again where the copy is there and as pinned.
- **FR-005**: An install MUST be unpacked in a temporary folder inside the store and switched into its place by one rename; an existing copy MUST be moved aside before the rename and removed only once the new copy is in place, a rename refused with `EPERM`, `EBUSY` or `EACCES` MUST be retried a number of times with a pause that grows, and where the switch fails the old copy MUST be put back as it was and the temporary folder MUST be removed.
- **FR-006**: On Linux and macOS the program of an install MUST be made executable, and its shims MUST be written to `<store>/bin`.
- **FR-007**: `clean` MUST remove what can be got again, each with its size: the cache, the leftover temporary folders and, only when asked, the programs of the store.

## Acceptance scenarios

1. **Given** the platform Windows and the tool `bun` at `1.4.4`, **When** its place is asked for, **Then** it is `<store>\bun\1.4.4`, per FR-001.
2. **Given** an install, **When** the files are listed outside the store, **Then** none was written, per FR-002.
3. **Given** a download whose bytes are wrong, **When** it is fetched, **Then** it is refused and no file is kept, per FR-003.
4. **Given** two runs that install one tool at once, **When** both finish, **Then** the tool is installed once and both found it, per FR-004.
5. **Given** an existing copy and a rename that fails twice with `EBUSY`, **When** the install is switched in, **Then** the old copy is moved aside, the rename succeeds on the third try, the old copy is removed and the new one is in place, per FR-005.
6. **Given** a rename that always fails, **When** the install is switched in, **Then** the temporary folder is removed and the old copy is as it was, per FR-005.
7. **Given** a store with a cache and a leftover temporary folder, **When** `clean` runs, **Then** both are removed with their sizes and the programs stay, per FR-007.

## Out of scope

- The input of a package manager: the other dialects.
- Unpacking to disk in a stream: the artifact is unpacked in memory, per 0002-native-pinned-install.

## Edge cases

- A store folder that does not exist: made, per FR-002.
- A tool at a version already in place and as pinned: nothing fetched, nothing written, per FR-004.

## Assumptions

- A rename of a folder over a folder fails on Windows while a program holds a file, and succeeds a moment later.

## Open questions

- None.

## Key entities

- **Store** - the user's folder of installed tools.
- **Switch** - the rename that puts an install in its place.

## Success criteria

- **SC-001**: An interrupted install leaves the old copy and no half-written one.
- **SC-002**: Nothing is written outside the store.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
