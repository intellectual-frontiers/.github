# Feature Specification: Estate Query: asking the estate

**Spec ID:** 0003-estate-query-run
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** One question in SQL over the relations of an estate: read only, refused with every reason before anything runs, bound to the catalog, run within a budget and given back as a table, JSON or CSV.

## Requirements

- **FR-001**: `openEstateQuery` MUST answer a text only where it is exactly one statement that only reads (the guard of lang-sql 0012-sql-guard: no data change, no definition, no denied function), MUST bind a plain `SELECT` to the catalog of the relations so that an unknown relation or column is a reason with the nearest name, MUST allow no relation outside the list of the relations (the guard is given it, a common table expression's own name being exempt as the guard says, and the engine is given the relations by name and nothing else), and MUST give every reason of a refusal and run nothing.
- **FR-002**: A question that is accepted MUST be run by the engine of lang-sql over the relations built as it names them, with joins, grouping, common table expressions and subqueries, and with values given apart (`?` and `$1`), so that a value is never put into the text of a question.
- **FR-003**: A question MUST have a budget: a statement of more nodes than allowed (2,000 by default) is refused, and an answer of more rows than allowed (10,000 by default) is a problem that says how to ask for fewer, never a part of the answer given as though it were the whole.
- **FR-004**: `formatTable` MUST give a table as aligned text with the number of rows, as JSON (a list of objects, in the order of the columns) or as CSV (a value with a comma, a quote or a line break in quotes, a quote doubled), and a null as empty.

## Acceptance scenarios

1. **Given** a statement that deletes, **When** it is asked, **Then** it is refused with the reason and nothing runs, per FR-001.
2. **Given** a join of `asset` and `capability` grouped by state, **When** it is asked, **Then** the rows are what the data says, per FR-002.
3. **Given** a budget of three rows and an answer of five, **When** it is asked, **Then** the problem says so, per FR-003.

## Out of scope

- Time limits: the engine is synchronous; a caller that needs one runs the question where it can end it.

## Edge cases

- Two statements, none, or text that does not read: each a reason, per FR-001.
- A function that sleeps or reads a file: denied by name, per FR-001.

## Assumptions

- The text of a question comes from a person or an agent and is not trusted.

## Open questions

- None.

## Key entities

- **Question**, **Budget**, **Problem**.

## Success criteria

- **SC-001**: No text, however hostile, changes anything or reads anything but the relations.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
