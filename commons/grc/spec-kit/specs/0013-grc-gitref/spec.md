# Feature Specification: A branch of Git as a store of files

**Spec ID:** 0013-grc-gitref
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** Evidence that a program writes without a person, many times a day, kept on a branch of a Git repository of its own (as the quality system keeps its evidence): a commit is made with Git's plumbing so that the working tree, the index and the branch a person has checked out are never touched, only the files that differ from the tip are written so that nothing that did not change is a commit, the history of a file and the state at an instant are read from the branch, and the branch, and only it, is pushed, never forced.

## Requirements

- **FR-001**: `commit` MUST write the files whose bytes differ from the tip of the branch in one commit by the identity of the store (creating the branch, with no parent, where it does not exist), MUST make no commit where no file differs and say so, and MUST give the commit and the paths that differed.
- **FR-002**: A commit MUST NOT touch the working tree, the index or the checked-out branch of the repository, MUST be made at the instant given where one is (its author and committer date), and MUST NOT be signed, so that a program with no key can write it.
- **FR-003**: A path MUST be a relative path of letters, digits and `. _ @ + = , -` in segments that do not start with a hyphen, with no `..`; any other MUST be refused, and nothing written.
- **FR-004**: The branch MUST be written with the tip it was made on as the guard: where it moved while the commit was made, the commit MUST be refused as `moved` and the branch left as the other writer made it.
- **FR-005**: `read`, `list`, `history` and `head` MUST read from the branch: `read` the bytes of a file at the tip or at a commit (nothing where there is none), `list` the files under a folder in order, `history` the commits that touched a path newest first with their instant and subject, and `at` the newest commit made at or before an instant (the second itself included), nothing where there is none or the instant is not one.
- **FR-006**: `push` MUST push the branch to a remote and nothing else, MUST NOT force, and a remote that has moved MUST be an error that says so, the branch left as it was.

## Acceptance scenarios

1. **Given** a repository with a branch checked out and uncommitted work, **When** a file is committed to the evidence branch, **Then** the checked-out branch, the index and the work are as they were, per FR-002.
2. **Given** a file committed, **When** the same bytes are committed again, **Then** no commit is made, per FR-001.
3. **Given** three commits at three instants, **When** the state at an instant between two is asked, **Then** it is the earlier commit, per FR-005.
4. **Given** a remote that has moved, **When** the branch is pushed, **Then** it is refused and not forced, per FR-006.

## Out of scope

- Which files are kept, and their meaning: the program that writes them.
- Signing the commits: a seal of the journal's head is a person's, made elsewhere.

## Edge cases

- A repository with no commit at all can still have the branch, per FR-001.

## Assumptions

- Git is installed; its plumbing is the same on every system.

## Open questions

- None.

## Key entities

- **Branch store** - a branch of a repository that holds files written by a program and read by anyone.

## Success criteria

- **SC-001**: A program that writes once a minute makes a commit only when something changed, and no person's checkout is disturbed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
