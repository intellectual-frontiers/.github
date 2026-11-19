# Feature Specification: The issues model and its synchronisation

**Spec ID:** 0045-issues-model
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** The issues that the code holds (0044-issues) are useful in a database too: they can be queried, joined to the work and the people that fix them and reported on. This feature has a model of the records (an issue, its goals, engines, evidence and links, and a ledger of synchronisations) that requires nothing, and an extension that keeps the records in step with the code: git is the source of truth and the database is a copy that is never ahead of it.

## Requirements

- **FR-001**: The issues model MUST be a module that requires no other and composes alone, with closed code lists for severity, priority, size, status, presence, evidence kind, link kind, goal and outcome, and its tables MUST bind on every dialect.
- **FR-002**: An issue record MUST be identified by its scope and number, hold what the code says of it and a hash of that, say whether the code still has it, and have its goals, engines, evidence and links as records of their own.
- **FR-003**: `syncIssues` MUST add the issues that are new, rewrite those whose hash changed with their goals, engines, evidence and links, and record the run in a ledger with how many it added, changed, withdrew and reopened, all in one transaction.
- **FR-004**: An issue that the code no longer has MUST be marked withdrawn and never deleted, and MUST be brought back, rewritten where it changed, when the code has it again.
- **FR-005**: Where the records already match the code a sync MUST write nothing (unless it is told to record the run); a failure MUST roll back everything it did and be an error as a value.

## Out of scope

- Writing the code from the database: the code is the source of truth, per FR-003.
- DuckDB: it cannot update a row that others refer to, so the sync is for the engines that can.

## Edge cases

- Two scopes in one sync: each scope is judged alone and the run is one transaction, per FR-003.
- An issue whose links point at one that is new: the links are written after every issue, per FR-003.

## Assumptions

- A project that wants the model lists `issuesModule` to `composeModules`, alone or with others.

## Open questions

- **OQ-1**: Whether a sync should also read who closed an issue from the commit that did it.

## Key entities

- **Issue record** - one issue in the database.
- **Sync run** - one row of the ledger.

## Success criteria

- **SC-001**: The records of a database match the issues of the code after a sync, and the sync does nothing when they already match.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
