# Feature Specification: Evidence capture journal

**Spec ID:** 0002-evidence-capture-journal
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The journal of the collector and the choice of what to look at, pure: where a day's entries are kept, an entry as a line and lines read back, the digest of a state, which kind of entry a look makes under the capture policy (every look, or a change and a heartbeat; a failure always), and which assets are due by their cadences. The journal is the ledger of `grc` (an entry chained to the one before), one chain for the tenant, so that the head of it is what a seal covers.

## Requirements

- **FR-001**: The kinds of entry of the journal MUST be `capture.changed`, `capture.unchanged`, `capture.unreachable`, `capture.refused`, `capture.unreadable`, `push.failed` and `seal`, and an asset the collector observes MUST be managed or adopted.
- **FR-002**: `journalPath` MUST give `journal/YYYY/MM/DD.jsonl` by the day of the instant in UTC and refuse an instant that is not one; `statePath` MUST give `state/<asset>.json`.
- **FR-003**: `encodeEntry` MUST give the canonical form of an entry and a line break, and `decodeEntries` MUST give back the entries of a text of lines, skipping blank lines, and MUST name the line that is not JSON or not an entry of the journal.
- **FR-004**: `entryTypeFor` MUST give `capture.changed` for a state whose digest differs from the one kept (or where none is kept), `capture.unchanged` for the same state where every capture is journaled, and for the same state where only changes and a heartbeat are, `capture.unchanged` only when the asset was last journaled a heartbeat ago or more (within a second) and nothing otherwise; and for a failure the kind of entry of its kind, always; WHERE the asset states `disposability: disposable` and the policy has a journal for disposable assets (estate 0008-estate-workstations FR-016), the granularity and the heartbeat are those of that journal.
- **FR-005**: `dueAssets` MUST give, in order, the assets whose cadence (their own, or that of their role by the attribute `role`, or that of their state) has run since they were last looked at (within a second), and those never looked at; a discovered asset has no cadence and is never due, and an instant that is not one gives none.

## Acceptance scenarios

1. **Given** the same state looked at twice, **When** every capture is journaled, **Then** the second is `capture.unchanged`, per FR-004.
2. **Given** a journal of changes and a half-hour heartbeat, **When** the same state is looked at after 15 and after 30 minutes, **Then** the first makes no entry and the second a heartbeat, per FR-004.
3. **Given** a managed asset looked at 15 minutes ago and an adopted one looked at 15 minutes ago, **When** the due assets are asked, **Then** only the managed one is due, per FR-005.

## Out of scope

- Keeping the entries and committing them: the collector (0003-evidence-capture-collect).

## Edge cases

- A day of entries read back in order is a ledger that `grc` verifies, per FR-003.

## Assumptions

- Entries are written by one collector at a time (the collector holds a lock).

## Open questions

- None.

## Key entities

- **Journal** - the hash-chained list of every look the collector made, the pushes that failed and the seals.

## Success criteria

- **SC-001**: Only what the capture policy asks to be journaled is.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
