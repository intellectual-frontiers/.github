# Feature Specification: Change Control: reading Git

**Spec ID:** 0003-change-control-git
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The commits of a range of a repository, read with Git's own commands and its own verification of SSH signatures, so that what is judged is what Git itself says.

## Requirements

- **FR-001**: `readCommits` MUST give the commits after `from` up to `to` (all up to `to` where `from` is empty), oldest first, merges left out, each with the paths it changed, the body, and the state of its signature and the signer as Git says them when it verifies with `gpg.format=ssh` and the `allowed_signers` text given, and MUST refuse a revision that is not one before handing anything to Git.
- **FR-002**: Reading MUST change nothing in the repository or its working tree: only reading commands are run, with no configuration of the person's, and the signers' file MUST be written to a folder of its own that is removed.

## Acceptance scenarios

1. **Given** a repository with a commit signed by a key in the file and one signed by another key, **When** it is read, **Then** the first is `G` with the signer's name and the second `U`, per FR-001.

## Out of scope

- Verifying a signature without Git.

## Edge cases

- A revision that begins with `-` or holds a space: refused, per FR-001.
- A repository with unsigned commits: `N`, per FR-001.

## Assumptions

- `git` and `ssh-keygen` are on the machine, as they are wherever a fleet is committed to.

## Open questions

- None.

## Key entities

- **Commit**.

## Success criteria

- **SC-001**: The verdicts are those Git would give by `git verify-commit` with the same signers.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
