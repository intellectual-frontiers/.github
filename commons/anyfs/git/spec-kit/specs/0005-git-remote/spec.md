# Feature Specification: AnyFS Git: push and fetch

**Spec ID:** 0005-git-remote
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The branch of a store, and only it, goes to a remote and comes back from one, and a remote that has moved is never overwritten.

## Requirements

- **FR-001**: A push MUST send the branch of the store and no other reference, MUST never be forced, and a remote that has commits the branch lacks MUST end as a `rejected` value that says so and leaves the remote as it was.
- **FR-002**: A fetch MUST read the remote's branch into a private reference and move the branch of the store only where that is a fast-forward (or the branch is not yet made); a branch that has diverged MUST be left as it is and said to have diverged, a branch the local store is ahead with MUST be said so, and a remote with no such branch MUST be said to be absent.
- **FR-003**: The name of a remote MUST be refused where it starts with a dash, holds a control character or names a transport that runs a program, and only the transports for files, Git, SSH and the web MUST be allowed.

## Acceptance scenarios

1. **Given** a bare remote, **When** the branch is pushed, **Then** the remote has the branch at the tip, per FR-001.
2. **Given** a remote that another writer has moved, **When** the branch is pushed, **Then** it is rejected and the remote keeps the other writer's commit, per FR-001.
3. **Given** a remote ahead of the branch, **When** it is fetched, **Then** the branch is fast-forwarded, and a diverged branch is left and said so, per FR-002.
4. **Given** the name `--upload-pack=x` or `ext::sh`, **When** a push is asked for, **Then** it is refused before Git sees it, per FR-003.

## Out of scope

- Pushing to GitHub or GitLab through their interfaces: that is the library for managed hosts.

## Edge cases

- A remote with no such branch is said to be absent and is not an error (FR-002).

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
