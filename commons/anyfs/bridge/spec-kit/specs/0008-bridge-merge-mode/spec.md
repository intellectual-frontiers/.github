# Feature Specification: Bridge merge mode

**Spec ID:** 0008-bridge-merge-mode
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Two stores that both merge are brought together by a plan first, as every transfer of the bridge is: what each holds, what each takes from the other and the hash of that, and applying it takes the hash the plan had. A merge has no conflict, so there is no policy to choose.

## Requirements

- **FR-001**: The plan of a merge between two stores that have `merge` MUST hold the vector of each, what each would take (rows, blobs, bytes and the identity of the delta) and a hash of all of it, and planning MUST change nothing in either store.
- **FR-002**: Applying a merge MUST need the hash of its plan; without it the apply MUST be refused as unapproved, and where the stores have changed since the plan was made the apply MUST be refused as stale and MUST change nothing.
- **FR-003**: Each store MUST take its delta whole or not at all, and a second merge of the same stores MUST plan nothing to take and change nothing.
- **FR-004**: The rails of a merge, a most of rows and a most of bytes for what one store takes at once, MUST refuse a plan that is over them, naming the store and the amount.
- **FR-005**: The report of a merge MUST give what each store said of the delta it took (applied, duplicate, deferred or refused with the reason), so that a store that does not trust the other is told so and the other direction is still taken, and MUST say whether the two vectors are equal afterwards.

## Acceptance scenarios

1. **Given** two stores of different rows, **When** a merge is planned and applied with its hash, **Then** both hold all the rows and a second plan is empty, per FR-001 to FR-003.
2. **Given** a plan and then a write to one of the stores, **When** the plan is applied, **Then** it is stale and nothing changes, per FR-002.

## Out of scope

- A merge of more than two stores at once (merge in pairs, or through a medium) and a store that does not merge (it keeps copy, sync and bisync).

## Edge cases

- A store that trusts only itself: it refuses the other's delta, the report says so, and the other direction is still taken, per FR-005.

## Assumptions

- Both stores are open for the length of the merge.

## Open questions

- None.

## Key entities

- **Merge plan** - the vectors, the takings and the hash.
- **Taking** - what one store takes: rows, blobs, bytes and a delta identity.

## Success criteria

- **SC-001**: Two SQLite databases are merged by a plan and an apply, and then hold the same files.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
