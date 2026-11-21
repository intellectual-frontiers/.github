# Feature Specification: Scanners: running a scanner

**Spec ID:** 0004-scanners-run
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Running a scanner the safe way: the engagement's say first, the pinned binary only, no shell, a bare environment, and a record of every run.

## Requirements

- **FR-001**: A run MUST be refused, with the reason and a record and before anything else is done, where the scanner is unknown, the target is of the wrong kind or unfit (0002-scanners-catalog FR-002), or a path does not exist.
- **FR-002**: A run MUST ask the engagement whether the scanner's technique is allowed on the asset before any tool is looked for, any file is read or anything is sent to a target, and MUST do nothing more where the answer is no; the asset asked about is the estate's asset, never a name the target or the output gives.
- **FR-003**: A tool MUST be run only when it has a pin and the file at the pin's path exists and has the pinned SHA-256; a tool with no pin, a missing file or a file with another digest MUST be refused and MUST NOT be run, and the refusal MUST say which and give the digest it found.
- **FR-004**: A tool MUST be run with an argument vector (never a shell), in an empty working folder that is removed afterwards, with only a bare `PATH`, a `HOME` in that folder and the language and colour settings, and MUST be stopped when its time limit passes.
- **FR-005**: What a tool prints (or the file it writes) MUST be read by the findings importers, every finding MUST be about the estate's asset the run was for, and an output that is empty or that no importer reads MUST be a refusal that says so; every run, refused or made, MUST give a record of the scanner, the asset, the target, the technique, the time, the tool's name, version and digest, the exit code and the number of findings.

## Acceptance scenarios

1. **Given** an engagement that does not allow `scan` on the asset, **When** nuclei is run, **Then** no tool is started, per FR-002.
2. **Given** a pinned tool that was changed after it was pinned, **When** it is run, **Then** it is refused with both digests, per FR-003.
3. **Given** a pinned tool that prints a report, **When** it is run, **Then** its findings are about the asset, per FR-005.

## Out of scope

- Installing or fetching a tool, and pinning it: the owner does, with `opsfolio scan pin`.

## Edge cases

- A target, a tool or an answer that is not as required is refused, never run or kept, per the requirements above (FR-001).

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Scanner**, **Pin**, **Run record**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
