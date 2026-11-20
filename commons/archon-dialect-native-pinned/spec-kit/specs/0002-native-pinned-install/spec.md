# Feature Specification: Native-pinned install

**Spec ID:** 0002-native-pinned-install
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What an install of a pinned tool is, as pure functions (reshaped from the workspaces manager's own, commons ergonex 0002-workspace-model FR-039): the bytes of a downloaded artifact are checked against the pinned SHA-256 before anything is unpacked, an archive is unpacked in memory with every path checked, the install record keeps the SHA-256 of each file so that a change since can be found, and a shim puts a command in one folder. No file is read or written here, and no network is reached.

## Requirements

- **FR-001**: The bytes of an artifact MUST be checked against the SHA-256 of its pin before anything is unpacked, and a download whose SHA-256 differs MUST be refused with both hashes named and no file returned.
- **FR-002**: An artifact MUST be unpacked in memory by its format: `zip`, `tar` (plain or compressed with gzip, found by its first bytes) or `file` (the bytes are the program, named by the program's name, with `.exe` added for Windows); every path in it MUST be a path inside the folder (never absolute, never with `..`), and an archive with a path that is not MUST be refused whole.
- **FR-003**: The program MUST be in the unpacked files, at the folder of the pin (`binPath`) with the program's name (and `.exe` on Windows), and an artifact that does not hold it MUST be refused naming the path.
- **FR-004**: The install record MUST name the tool, the version, the platform, the address, the SHA-256 of the artifact, the path of the program and the SHA-256 of each file by its path, MUST be written as JSON with its keys in order, two spaces, and a final line break, and MUST be read back, a text that is not a record being refused with the reason.
- **FR-005**: `installDrift` MUST find, by comparing the files found in a tool's folder with its record, every file changed, missing or extra, in the order of the paths, and MUST say where the record's artifact is not the one the pin now names.
- **FR-006**: A shim MUST be a POSIX `sh` script that runs the installed program with its arguments, or on Windows a `.cmd` file; a command name that is not letters, digits, dots, underscores and hyphens, a path with a line break, and on Windows a path with `"`, `%`, `^`, `&`, `|`, `<` or `>` MUST be refused.

## Acceptance scenarios

1. **Given** bytes that are not the pinned bytes, **When** they are unpacked, **Then** nothing is returned and the error names both hashes, per FR-001.
2. **Given** a tar with an entry `../evil`, **When** it is unpacked, **Then** the whole archive is refused, per FR-002.
3. **Given** a zip, a tar and a gzipped tar of the same files, **When** each is unpacked, **Then** the files are the same, per FR-002.
4. **Given** an artifact without the program, **When** it is unpacked, **Then** it is refused naming the path it should have, per FR-003.
5. **Given** an installed folder with one file changed, one removed and one added, **When** it is compared with its record, **Then** each is found, per FR-005.
6. **Given** the command `bun` and the path `/home/a/b`, **When** the shim is made for Linux and for Windows, **Then** each is the right text, per FR-006.

## Out of scope

- Fetching, writing and switching: the store (0003-native-pinned-store).
- What is installed on a computer: observed by the dialect (0004-native-pinned-dialect).

## Edge cases

- An artifact that is a single file for the root folder: the program is the file, per FR-002.
- A zip with a directory entry: ignored, never a file, per FR-002.
- Two entries with one path in an archive: refused, per FR-002.

## Assumptions

- The SHA-256 of an artifact is the one a person put in the packaging ontology from the publisher's own checksum.

## Open questions

- None.

## Key entities

- **Download** - what a pin gives for a platform (commons toolchain).
- **InstallRecord** - what an install leaves beside the files.

## Success criteria

- **SC-001**: No byte of an artifact is unpacked before its hash is checked.
- **SC-002**: A change to an installed file is always found.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
