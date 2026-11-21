# Feature Specification: AnyFS Git: the store of a branch

**Spec ID:** 0003-git-ref
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A branch of a repository is a store that is written with Git's plumbing, so that nothing a person has checked out is touched.

## Requirements

- **FR-001**: The revision of a file MUST be `sha256:` and the digest of its bytes, the same as in every other store, and the library MUST give Git's names for the blob and the newest commit and the mode of the file beside it; a digest kept for the name of a blob MUST never be forgotten, since the name stands for the bytes.
- **FR-002**: A store of a branch MUST never change the working tree, the index or the head of the repository: a commit MUST be made in a temporary index and a temporary folder and the branch moved by `update-ref`, and a store of a branch that is checked out in a working tree (this one or another) MUST be refused unless the caller allows it.
- **FR-003**: A write, a delete and a rename MUST check what they expect (no object, the object at a revision, or anything) against the file at the tip they read, and a branch that moved while the change was made MUST be read again and the change checked again, so that two writers of different files both succeed, two writers who expect the same revision of a file cannot both succeed, and the commit of another writer is never overwritten; a branch that keeps moving MUST end as a retryable `unavailable` after the tries.
- **FR-004**: A batch MUST be one commit with every change in it, all or none, each change checked against the state the changes before it made; a change that changes nothing (the same bytes, a delete of what is not there) MUST make no commit.
- **FR-005**: A history MUST be the commits of the first-parent line that changed the file, newest first, each with its revision, size and instant, and the library MUST give each commit's identity and message besides; a file that is not at the tip MUST have no history.
- **FR-006**: A branch with no commit MUST read as empty and be made by the first write with no parent, in a repository that is bare or not.
- **FR-007**: The store MUST hold regular files: a symbolic link or another repository named by a path MUST be refused as outside its scope and left out of a list, a path where Git would hold a file and a folder of the same name MUST be refused, and a path that another file system could not hold MUST be refused (unless the caller turns that off).
- **FR-008**: A list MUST give the files below a prefix in the order of their paths, in pages with a cursor, with the revision of each, and a name that is not text in its normal form MUST not be listed; a rename MUST be one commit and MUST refuse a destination that is there.

## Acceptance scenarios

1. **Given** a repository with a working tree, **When** a store writes to a branch that is not checked out, **Then** `git status`, the index and the head are as they were, per FR-002.
2. **Given** two writers who expect the same revision of one file, **When** both write at once, **Then** exactly one succeeds and the other has a conflict, per FR-003.
3. **Given** a batch of three changes, **When** it is made, **Then** the branch has one new commit that holds all three, per FR-004.
4. **Given** a file written three times, **When** its history is read, **Then** it is three revisions newest first, per FR-005.
5. **Given** a branch that does not exist in a bare repository, **When** a file is written, **Then** the branch is made with a commit that has no parent, per FR-006.
6. **Given** a tree with a symbolic link, **When** it is read by its path, **Then** it is refused, and a list does not hold it, per FR-007.
7. **Given** twenty-five files, **When** they are listed ten at a time, **Then** three pages give them in order, per FR-008.

## Out of scope

- Remote repositories (0005-git-remote).
- A merge of branches.

## Edge cases

- A repository whose tip moves while a change is made is read again and the change checked again (FR-003).

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
