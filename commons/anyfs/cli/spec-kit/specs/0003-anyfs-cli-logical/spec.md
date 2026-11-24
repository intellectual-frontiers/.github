# Feature Specification: AnyfsCli logical

**Spec ID:** 0003-anyfs-cli-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The pure functions of the verbs and the world they run in. The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first.

## Requirements

- **FR-001**: `defineConfig` MUST be a typed identity, `parseConfig` MUST check every mount (a name that is a word and unique, a place that parses), the defaults (concurrency from 1 to 64, a verify mode, a maximum object size of at least one byte) and the openers (one for each kind), and MUST give every problem it finds, not the first only.
- **FR-002**: A configuration MUST be written as code: its mounts MAY be marked read-only, and its `kinds` MUST be openers of stores that other libraries bring, so that a new backend is a line of the configuration and no change of the program.
- **FR-003**: The verbs MUST run in a `World` of ports (open a place once for a run, a plain path as a root and an inner path, standard input and output as bytes, a local file, a small state) and in no other, so that they are tested with stores in memory.
- **FR-004**: The capabilities a verb needs of a store MUST be asked at run time by `viewable`, `sourceOf`, `movableOf` and `destOf`, each of which MUST give nothing where a capability is missing, and `missing` MUST name the capabilities that are.
- **FR-005**: `humanSize`, `modeText`, `table` and `drawTree` MUST be pure: sizes below 1024 are bytes and above are K, M, G or T with one decimal where not whole; a mode is ten characters with the type first; a table pads every column but the last; a tree is drawn with branches.
- **FR-006**: `unifiedDiff` MUST give `same` for equal texts and the hunks of the shortest edit by the longest common subsequence, with three lines of context, for different ones, and MUST NOT compare two texts whose product of lines is over four million but say `too-large`.
- **FR-007**: `matchingLines` MUST find a literal text and never a pattern, with an option to ignore case; `wildcard` MUST read `*` as a run within a name and `?` as one character; `parseSizeTest` MUST read `+N`, `-N` and `N` with the units K, M and G; `looksLikeText` MUST refuse bytes with a NUL in their first 8 KiB.
- **FR-008**: A verb MUST keep the fidelity of each operation of the POSIX view in a trail, and a failed operation MUST be written as its errno, its path and what the store said.
- **FR-009**: With `--strict` any step whose fidelity is a strict violation MUST end the verb with a problem `E-STRICT`, and with `-v` the steps that were not native MUST be written once each, so that nothing is pretended silently.
- **FR-010**: A run MUST end in one of four ways: with what it did, with a finding (exit `findings`), with a usage error (exit `usage`), or with an environment error (exit `environment`), and every problem MUST carry its code and the fix of the catalogue unless one is given.
- **FR-011**: A plan MUST be written as its header, the counts of its actions by kind in the order a plan lists them, each action, what it would lose, the bytes to write and its hash, and at most two hundred actions are listed with the rest counted.
- **FR-012**: The refusals of the bridge MUST be written as the problems `E-PLAN-REFUSED`, `E-PLAN-STALE` and `E-CONFLICTS`, each with the sentence of the refusal, and a report MUST be written as its counts, its unguarded writes, each failure and its hash.

## Acceptance scenarios

1. **Given** a configuration with two faults, **When** it is parsed, **Then** both are reported, per FR-001.
2. **Given** a configuration with a read-only mount and an opener, **When** it is parsed, **Then** both are in the result, per FR-002.
3. **Given** a world of memory stores, **When** a verb runs, **Then** it touches nothing outside the ports, per FR-003.
4. **Given** a store without delete, **When** it is asked for as a destination, **Then** there is none and delete is named as missing, per FR-004.
5. **Given** 1536 and a mode of 0644, **When** they are written, **Then** they are 1.5K and -rw-r--r--, per FR-005.
6. **Given** two texts that differ on one line, **When** they are compared, **Then** one hunk shows it with its context, per FR-006.
7. **Given** a text, a wildcard and a size test, **When** they are applied, **Then** they match as the rules say, per FR-007.
8. **Given** a failed operation, **When** it is written, **Then** it holds the errno, the path and the problem kind, per FR-008.
9. **Given** a trail with an emulated step of risk not-durable, **When** strictness is asked, **Then** there is a violation, and when verbosity is asked the step is a line, per FR-009.
10. **Given** a usage ending and an environment ending, **When** their exits are read, **Then** they are usage and environment, per FR-010.
11. **Given** a plan, **When** it is written, **Then** its last line is its hash, per FR-011.
12. **Given** a stale refusal, **When** it is written, **Then** the problem is E-PLAN-STALE and names both hashes, per FR-012.

## Out of scope

- The backends that plug in through the configuration: their own libraries.
- A mount of the stores as a file system (a WebDAV or NFS server, or FUSE): their own libraries.

## Edge cases

- Two texts too large to compare line by line: the result says so and does not stall, per FR-006.
- A plan of more than two hundred actions: the rest are counted, per FR-011.
- A configuration with several faults: every one is reported, per FR-001.

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
