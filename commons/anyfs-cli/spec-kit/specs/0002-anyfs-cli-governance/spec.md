# Feature Specification: AnyfsCli governance

**Spec ID:** 0002-anyfs-cli-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The facts of the program: its verbs, tiers, problem codes and the grammar of a place on a command line. The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first.

## Requirements

- **FR-001**: The verbs MUST be a closed union `VerbId` with one entry in the table `VERBS` for each, the compiler MUST hold the table complete, and `verbIds()` MUST list every entry once.
- **FR-002**: The facts of every verb MUST NOT contradict each other by the rules of Headless (`actionProblems`): a report only reads, an action does not only read, a destructive verb previews and is not idempotent, and every verb that changes anything MUST name the channels `local` and `mcp` only.
- **FR-003**: The tiers MUST be two, `reader` and `writer`, lowest first, the ladder's default MUST be `writer`, `tierOf` MUST name each and no other word, and every verb of the tier `reader` MUST only read.
- **FR-004**: Every problem the program raises MUST be one of the closed union of codes `ProblemCode`, each code MUST have one explanation of four non-empty parts in `CATALOGUE`, and `isProblemCode` MUST accept the codes and nothing else.
- **FR-005**: `parseMountName` MUST accept lower-case words joined by hyphens of two to thirty-two characters that start with a letter, and MUST refuse the name of a kind of place and any other word, so that `name:` on a command line is never a place.
- **FR-006**: `parseLocation` MUST read a word as a drive path, an address (`scheme://` or `memory:`), a mount (`name:` and a path, where the name is a mount), or a plain path, and MUST end with `E-MOUNT-UNKNOWN` for a word of the form `name:` whose name is no mount, never read it as a file; the reading MUST depend on the word and the names of the mounts only.

## Acceptance scenarios

1. **Given** the union and the table, **When** the ids are listed, **Then** each id has one entry and each entry one id, per FR-001.
2. **Given** every verb, **When** its facts are checked by Headless, **Then** there is no contradiction, per FR-002.
3. **Given** the ladder, **When** a verb of the tier reader is read, **Then** its effect is read, per FR-003.
4. **Given** the codes, **When** the catalogue is read, **Then** each has a title, what, why and fix, per FR-004.
5. **Given** `fleet`, `file` and `Fleet`, **When** they are parsed, **Then** the first is a mount name and the others are refused, per FR-005.
6. **Given** the mounts `fleet`, **When** `fleet:/a`, `ssh://h/p`, `./x` and `other:/a` are read, **Then** the first three are locations and the last is E-MOUNT-UNKNOWN, per FR-006.

## Out of scope

- The backends that plug in through the configuration: their own libraries.
- A mount of the stores as a file system (a WebDAV or NFS server, or FUSE): their own libraries.

## Edge cases

- A word of the form `name:` whose name is no mount: the ending is E-MOUNT-UNKNOWN, never a file named so, per FR-006.
- A mount named like a kind of place: it is refused, per FR-005.
- A verb whose facts contradict each other: it is a finding of the test, per FR-002.

## Assumptions

- The libraries `anyfs`, `anyfs-bridge`, `anyfs-posix`, `anyfs-ssh` and Headless are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **AnyfsCli** - the library.

## Success criteria

- **SC-001**: `bun run verify` in this folder passes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
