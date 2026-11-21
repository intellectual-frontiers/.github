# Feature Specification: AnyFS Bridge: transfer

**Spec ID:** 0003-bridge-transfer
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Two inventories become a plan, and a plan is applied: copy, sync, move and check, with the ladder of comparators, the allowance of deletes, the checks of what was written, the batch, the journal and the events.

## Requirements

- **FR-001**: An inventory of an endpoint MUST list every object below its prefix page by page, keep what the filter of the rails keeps, name each relative to the prefix and, at a source, rewrite it, and MUST give them in the order of their target paths; a store that does not answer, or a rewrite that cannot make a path, MUST end the inventory with that as a value.
- **FR-002**: Two files MUST be compared by the comparators in order and the first that can decide MUST decide: `native-digest` where both revisions are the SHA-256 of the bytes, `size-mtime` where the sizes differ (different) or are equal with the same time (alike), and `content-hash` by the bytes, whose digest MUST be kept in the cache the caller gives; the action MUST say what decided, and where none can decide the files MUST be taken to differ.
- **FR-003**: A `copy` MUST plan a create for what is missing at the destination and an update for what differs, MUST count what is equal, MUST plan no delete and no rename, and MUST honour `neverOverwrite` by leaving a file that differs.
- **FR-004**: A `sync` MUST also plan the deletes that make the destination equal, MUST plan them only where the delete policy allows, as skips otherwise, MUST leave a path that `protect` matches, and MUST be refused with the number it wanted where the deletes and renames are more than the allowance; a sync applied twice MUST plan nothing the second time.
- **FR-005**: A `move` MUST plan the copy and then the removal of the source of every file that is at the destination, made or equal already, MUST be refused where the source cannot delete or the comparators include the size and the time, and MUST keep the source of a file whose copy did not succeed.
- **FR-006**: A `check` MUST list what is missing, different and extra without changing a store, MUST leave a protected path as a skip, MUST be applicable to no store, and a check after a sync MUST find nothing.
- **FR-007**: Two files that would become one path at the destination MUST be conflicts, `target-collision` where the path is the same and `case-collision` where the destination folds the case; a file the destination cannot hold MUST be left with a loss; a sync at a destination that can rename MUST rename a file that has the content of a missing one, found by equal SHA-256 revisions, instead of copying and deleting.
- **FR-008**: An apply MUST refuse a plan whose hash is not the one approved, a plan that the stores no longer make (it MUST make it again unless told to resume), and a plan with conflicts unless told to leave them; and a source that changed since the plan MUST be a failed action that says so and MUST NOT be written.
- **FR-009**: A write MUST expect no object for a create and the revision the plan saw for an update, a delete and a rename where the destination has `cas`, so that a change made since is the conflict of the store and not an overwrite; where the destination has no `cas` the write MUST expect nothing and the report MUST count it as unguarded.
- **FR-010**: What is written MUST be checked: by the revision where it is the SHA-256 of the bytes, by reading it back otherwise or where the caller asks, and not at all where the caller says none; a store that keeps other bytes MUST be found as a mismatch, and what cannot be checked MUST be reported as unverifiable.
- **FR-011**: Where the destination has a batch and the caller asks for it, the creates, updates and deletes MUST be made as one batch, so that one change that cannot be made stops all of them.
- **FR-012**: An apply MUST run at most the number of actions the caller allows at once, MUST mark each action done in a journal the caller gives and skip what the journal has when told to resume, MUST tell what it does as events that begin with the plan and end with the report of every action, and MUST throw nothing: a store that fails is a failed action.

## Acceptance scenarios

1. **Given** a source and a destination in memory, **When** a copy is applied, **Then** the destination has what was missing and what differed, and nothing was removed, per FR-003.
2. **Given** three extra files at the destination and an allowance of one, **When** a sync is planned, **Then** it is refused with the number three, per FR-004.
3. **Given** a move whose copy fails, **When** it is applied, **Then** the source is kept, per FR-005.
4. **Given** a plan made and a source changed, **When** it is applied, **Then** it is refused as stale, per FR-008.
5. **Given** a destination that changed a file after the plan, **When** the update is made, **Then** it is a conflict and the other writer's change stays, per FR-009.
6. **Given** a destination that keeps other bytes than it is given, **When** a copy is applied, **Then** the action fails as a mismatch, per FR-010.
7. **Given** an apply that stopped after some actions, **When** it is applied again with its journal, **Then** the rest is made and the done are skipped, per FR-012.

## Out of scope

- Ranges, streams and a transfer of the parts of one object (whole objects only).
- Copying inside a backend by its own means (a hook only).
- Metadata other than bytes.

## Edge cases

- A rename moves a file and counts as one removal of the allowance (FR-004, FR-007).
- A weak comparator can call two files alike that are not; the plan says it decided by the size and the time, and a move does not allow it (FR-002, FR-005).
- A destination with no `cas` has unguarded writes, and the report says how many (FR-009).

## Assumptions

- The stores are given by the caller; the library asks them for operations and nothing else (0001-bridge-layers FR-002).

## Open questions

- None.

## Key entities

- **Endpoint**, **Entry**, **Verdict**, **Prepared**, **ApplyOptions**, **Journal**, **Outcome**, **Report**, **ApplyEvent**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where it touches a file system, stores in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
