# Feature Specification: AnyFS Git: the store of a working tree

**Spec ID:** 0004-git-worktree
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A working tree is a store of the files below a folder, and a commit of them is an operation of its own.

## Requirements

- **FR-001**: The store of a working tree MUST hold the files below a folder of the working tree as the store in a folder holds them (revision, compare-and-write, rename), and MUST NOT list or accept the folder of Git, a file the store of a folder makes, a link or a name that is not text in its normal form.
- **FR-002**: A commit MUST take the paths asked for, or every changed path (staged, not staged or not tracked) below the folder, and MUST be by the identity the program gives and dated by its clock, whatever the configuration of the computer says.
- **FR-003**: Where something the commit was not asked to take has changed, the commit MUST be refused with the paths (the default `refuse`), or MUST take only what it was asked (`allow`), and it MUST NOT take what a person has staged for other paths.
- **FR-004**: A commit MUST NOT run a hook and MUST NOT be signed unless the caller asks for the hooks.
- **FR-005**: A commit with nothing changed MUST make no commit and say so.

## Acceptance scenarios

1. **Given** a working tree with the folder of Git, **When** the store is listed, **Then** nothing of `.git` is in it, per FR-001.
2. **Given** a file written through the store, **When** a commit is asked for, **Then** the commit holds that file and is by the identity given, per FR-002.
3. **Given** a file that a person has staged elsewhere, **When** a commit of the folder is asked for, **Then** it is refused with that path, and with `allow` it is made without it, per FR-003.
4. **Given** a hook that fails, **When** a commit is made, **Then** the hook is not run, per FR-004.
5. **Given** no change, **When** a commit is asked for, **Then** none is made, per FR-005.

## Out of scope

- Pushing a working tree: a working tree is pushed with Git.

## Edge cases

- A symbolic link in the working tree is not an object of the store (FR-001).

## Assumptions

- Git is on the path of the computer; the stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003).

## Open questions

- None.

## Key entities

- **Branch**, **Working tree**, **Revision**, **Identity**.

## Success criteria

- **SC-001**: Every behaviour is tested in real repositories in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
