# Feature Specification: AnyFS Git: conformance

**Spec ID:** 0006-git-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Both stores pass the laws of AnyFS, and a sync from any store into a branch is one commit.

## Requirements

- **FR-001**: The store of a branch (in a repository that is bare and in one that is not) and the store of a working tree MUST pass every case of the conformance suite of AnyFS that their capabilities name.
- **FR-002**: Every law of the bridge MUST hold between a store in memory or in a folder and the store of a branch, in both directions, and a sync from a store into the store of a branch applied atomically (the bridge's option that makes one batch of it) MUST be one commit however many files it changes.

## Acceptance scenarios

1. **Given** a new repository, **When** the conformance suite is run on a branch of it, **Then** every case passes, per FR-001.
2. **Given** twelve files in memory, **When** they are synced to a branch, **Then** the branch has one commit, and a second sync makes none, per FR-002.

## Out of scope

- Conformance of the push and the fetch: those are held by 0005-git-remote.

## Edge cases

- A sync of nothing into a branch makes no commit (FR-002).

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
