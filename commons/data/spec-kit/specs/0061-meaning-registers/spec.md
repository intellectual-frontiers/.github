# Feature Specification: meaning-registers

**Spec ID:** 0061-meaning-registers
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The second stage of the toolkit of the book "Accepted Is Not Correct": what a value means and what its absence means. A source's value is mapped to the canonical one by a mapping that says how the two relate, who approved it and when it holds; a known difference between a source and the canonical form is a variance that is accepted for a time and then expires; a missing value has a rule that says what it may be and which kind of absence it is; and there is a profile of a column made with counts only, and a seeded generator of synthetic rows. The mapping rule and coverage mirror what `commons/integrations` 0006 FR-008 says of a mapping, and this library imports nothing of it. Its fixtures are healthcare, and the second domain is a batch extract for analytics.

## Requirements

- **FR-001**: The model MUST be a module of governance named `meaning` that requires nothing, with a mapping as a record of the source system, field and value, the canonical field and value, how the two relate, the rule it follows, its status, who approved it and when, and the dates between which it holds.
- **FR-002**: How a source value relates to the canonical one MUST be a closed code list (equivalent, broader, narrower, related, unmapped) and a mapping's status MUST be a closed code list (draft, approved, retired).
- **FR-003**: A variance MUST be a record of the source and field it is about, what differs, its status (open, accepted, resolved, expired), who answers for it, who decided and when, and when the acceptance ends.
- **FR-004**: A null rule MUST be a record of the table and column it is about (unique), what is done with a missing value (reject, allow absent, default to), the kind of absence it stands for, the default and why.
- **FR-005**: The kinds of absence MUST be a closed code list (not collected, not applicable, unknown, not yet known, refused, suppressed, invalid) so that one null is not taken for another; every concept and code list MUST be defined.
- **FR-006**: `translate` MUST give the one approved mapping that holds at the time asked (now where not given) with its target, how it relates and its id; `unmapped` for a value that no approved mapping that holds covers, whether it is a draft, retired or ended; and `ambiguous` with the ids where two hold, choosing none.
- **FR-007**: `coverage` MUST give how many values observed in a field there were (a missing value is not counted), how many a mapping that holds covers, the share, and the values nothing maps with how many times each was seen, the most seen first.
- **FR-008**: `resolve` MUST keep a value that is there, and for one that is missing (null, undefined or only spaces) MUST reject, keep the kind of absence, or replace it with the default as the rule's policy says, rejecting a replacing rule that has no default; `ruleOf` MUST read the rule of a table and column.
- **FR-009**: `dueVariances` MUST give the variances that are accepted and past the date they end, and those that are open, and no others.
- **FR-010**: `profile` MUST give for each column named the rows, the nulls, the distinct values and the lowest and highest, as counts and extremes only, on every engine.
- **FR-011**: `synthetic` MUST make for a seed, a number of rows and a spec of columns (sequence, integer range, weighted choice, date range, pattern) the same rows every time, other rows for another seed, a rate of absence for a column and a rate of duplicate rows as asked.

## Out of scope

- Reading a mapping from a message and the codecs that use it: `commons/integrations`'s, which will satisfy a structural port of `translate`.
- Seeding a table from a code list or a profile of a distribution of a real source: a later stage.
- Linkage of records (matching one entity across sources): an optional later extension (0067).

## Edge cases

- A value that is observed as null is not counted by `coverage`, per FR-007.
- Two mappings that hold at once are an error of the register and `translate` says so, per FR-006.
- A mapping whose `validTo` is the time asked has ended: the end is not included, per FR-006.

## Assumptions

- The tables are made by `bind` from the model on any of SQLite, DuckDB and PostgreSQL; the fixtures of the tests are synthetic.

## Open questions

- **OQ-1**: Whether the registers of mappings and variances should be loadable from a spreadsheet by `runLoad`, which they can be today as any table.

## Key entities

- **Mapping** - a source value, the canonical value, how they relate and when they hold.
- **Variance** - a decided difference between a source and the canonical form, with an end.
- **Null rule** - what a missing value of a field may be.

## Success criteria

- **SC-001**: For any source value, which canonical value it means at a time, who approved that and what is not covered is a query; and what a missing value stands for is a rule and not a guess.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
