# Feature Specification: AnyFS Mirror: logical

**Spec ID:** 0003-mirror-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The pure part of a mirror: which paths an operation changes, how two listings differ, what makes them the same, and what the traits of a mirror are, each a function of its inputs with no store behind it.

## Requirements

- **FR-001**: An operation that reads (read, stat, list, history, range read, search, merge) MUST change no path, and an operation that changes (write, delete, append, rename, batch) MUST name each path it changes once, in the order of the paths, a rename naming both of its paths and a batch the paths of its changes.
- **FR-002**: The drift of two listings MUST be computed from the path and the revision of each entry alone: a path only the primary has is missing, a path both have at different revisions is different, and a path only the secondary has is extra.
- **FR-003**: The steps that make a secondary the same MUST copy every missing and every different path and then remove every extra path, each in the order of the paths, and applying them to the secondary's listing MUST leave no drift.
- **FR-004**: The traits of a mirror MUST be the narrowest of its stores: it tells paths apart by case only where every store does, and its largest object is the smallest limit of any store that has one.
- **FR-005**: A secondary that does not tell paths apart by case MUST be refused as the follower of a primary that does, with the reason, and the other way round MUST be allowed.
- **FR-006**: The size of the largest object an operation would write MUST be known from the operation alone.

## Acceptance scenarios

1. **Given** a batch that puts one path twice and deletes another, **When** the paths it changes are asked, **Then** each is named once in order, per FR-001.
2. **Given** two listings, **When** their drift is made and its steps applied, **Then** the listings are the same, per FR-002 and FR-003.
3. **Given** a case-sensitive primary and a case-folding secondary, **When** they are checked, **Then** the secondary is refused, per FR-005.

## Out of scope

- Reading a store: a listing is given to these functions.

## Edge cases

- Two lists that are both empty have no drift (FR-002).

## Assumptions

- A revision is equal across backends where the bytes are (anyfs 0002-anyfs-governance FR-003).

## Open questions

- None.

## Key entities

- **Entry**, **Step**, **Drift**.

## Success criteria

- **SC-001**: The properties of FR-003 hold for any two listings, checked with generated ones.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
