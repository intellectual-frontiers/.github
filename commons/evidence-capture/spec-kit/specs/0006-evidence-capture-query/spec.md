# Feature Specification: Questions of the journal in SQL

**Spec ID:** 0006-evidence-capture-query
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The journal of the collector is the ledger of every look at every asset: what changed, what could not be reached, when each asset was last looked at. An operator asks of it what no view gives: the assets that changed most, the assets not looked at for a day, the failures of a kind. This feature makes the entries and the last look at each asset into relations and answers one read-only SQL over them with the SQL language library, without a database and without a way to change an entry.

## Relations

- **FR-001**: The relations MUST be `journal` (`seq`, `at`, `type`, `asset`, `evidence`, `digest`, `previous`: an entry, its asset the subject of the entry and its time the instant it was made, in the order of `seq`) and `assets` (`asset`, `entries`, `changes`, `failures`, `last_type`, `last_at`, `first_at`: the entries of each asset counted, those of type `capture.changed` as changes and those of type `capture.unreachable`, `capture.refused`, `capture.unreadable` and `push.failed` as failures, with its last entry and its first), in the order of the asset's name.
- **FR-002**: `journalCatalog()` MUST give the catalog of those relations with the type of each column, so that a name or a column that is not there is found before a question is answered.

## Questions

- **FR-003**: `queryJournal(entries, sql, options?)` MUST answer one query that the guard of the SQL language library judges to be a single read and binds to the catalog, with the engine of the same library, and MUST give an error value, never a throw, for anything else (a statement that writes, more than one statement, an unknown relation or column with the name it is closest to), with the sentence of the guard and its place; an answer MUST hold at most `options.limit` rows (1000 where none is given) and say whether it was cut; parameters (`?`) MUST be given by `options.params` and never read as SQL.
- **FR-004**: `askJournal(store, branch, sql, options?)` MUST read the journal of the branch through the store (which holds its chain) and answer through `queryJournal`; a branch that does not exist MUST be an error value that says that nothing was captured; the journal and the states MUST NOT be changed by a question.

## Out of scope

- A question over the states of the assets (their text is the codec's), and a question that changes the journal.

## Edge cases

- A journal with no entry: both relations have no rows, per FR-001.
- An asset with only failures: `changes` is 0 and `failures` its count, per FR-001.

## Assumptions

- The subject of an entry of the journal is the asset it is about, and `seal` entries are about the tenant.

## Open questions

- None.

## Key entities

- **Entry**: a line of the journal, chained to the one before.
- **Relation**: a table of values that a question may name.

## Success criteria

- The assets that changed most are found by one line of SQL over the journal of a branch.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
