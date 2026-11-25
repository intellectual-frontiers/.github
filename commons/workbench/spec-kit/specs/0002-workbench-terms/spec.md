# Feature Specification: Workbench terms

**Spec ID:** 0002-workbench-terms
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The four concepts every requirement and every error belongs to, and the suggested layout of a workspace so that a path means the same on every workshop and workstation.

## Requirements

- **FR-001**: The library MUST define four concepts, `workstation` (where the operator, a person or an agent, orchestrates from), `workshop` (where the work happens: a machine, a virtual machine or a container), `workspace` (the repositories and other stores the work is about) and `workbench` (everything a role needs to do its job with a repository), as a closed list, each with a sentence that defines it.
- **FR-002**: The library MUST place a repository at `<home>/workspaces/<githost>/<org>/<repo>`, reading the host, organization and name from a remote written as `https://host/org/repo`, `ssh://host/org/repo` or `git@host:org/repo` with or without `.git`, and MUST refuse a remote whose host, organization or name is not a safe folder name (no `..`, no separator).
- **FR-003**: The library MUST place another store at `<home>/workspaces/stores/<kind>/<place>`, refusing a kind or a place that could leave its folder, and MUST name `.workbench` as the folder of the workbench's own records in a repository (claims, hand-back reports, approvals and the output of `ready`), which is not committed.
- **FR-004**: The library MUST place the worktree of one actor on one task at `<repo path>.wt/<actor>/<task>`, where an actor is `human-<id>` or `agent-<harness>-<session>` made of safe words, so that one actor has one worktree and an agent never writes the primary checkout of a repository.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is checked, **Then** it holds, per FR-001.
2. **Given** the case of FR-002, **When** it is checked, **Then** it holds, per FR-002.
3. **Given** the case of FR-003, **When** it is checked, **Then** it holds, per FR-003.
4. **Given** the case of FR-004, **When** it is checked, **Then** it holds, per FR-004.

## Out of scope

- Everything of the library that another of its specifications states.

## Edge cases

- A name that is not a name is refused where it is made, never later, per FR-001.

## Assumptions

- The terms are defined in typed code here; a published ontology of them is a later step.

## Open questions

- None.

## Key entities

- **Workbench**, **Contract**, **Contribution**, **Dialect**.

## Success criteria

- **SC-001**: Every requirement of 0002-workbench-terms is proved by a test of the library, with made-up names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
