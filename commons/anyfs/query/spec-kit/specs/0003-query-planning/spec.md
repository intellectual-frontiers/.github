# Feature Specification: AnyFS Query: planning

**Spec ID:** 0003-query-planning
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store of a million objects is not listed to find one, and no object is read to answer a question its listing answers. The plan of a query says where to list and what to read, and the answer is the one that listing and reading everything would give.

## Requirements

- **FR-001**: Each conjunct of the `WHERE` MUST be classified as of the listing, when it uses no column that needs a read of the object, or of the content, when it uses `text`, `is_text` or `redacted`; a conjunct is a part of an `AND`, and an `OR` or a `NOT` is one whole.
- **FR-002**: A listing conjunct that is `path = '...'`, `path GLOB '...'` or `under(path, '...')` MUST bound where the objects can be: one path, a prefix ending at a whole segment (the literal start of a glob up to its last `/`), or nowhere where the bounds cannot all hold; `LIKE` MUST NOT bound, since it ignores case and a prefix does not. A run MUST list below the deepest prefix that is within the prefix of its place, ask `stat` of one path where the store has it, and ask nothing where the bound is nowhere or does not meet the place.
- **FR-003**: An object MUST be read only when it has passed every listing conjunct, and no object MUST be read for a query on `files`.
- **FR-004**: The rows of a query MUST be the rows of its plan run over every object of the place, whatever was bounded or left unread.
- **FR-005**: A query with a `LIMIT` and no `ORDER BY` and no `DISTINCT` MUST end its run when it has the rows that the limit and the offset ask for; a query with an `ORDER BY` MUST read every object that its listing conjuncts leave.
- **FR-006**: An explanation MUST say the plan, the source and the place, what is listed (a prefix, one path or nothing, and the rule that gave it), the listing filters, the content filters and that only the objects the listing leaves are read, the consent needed and the budget, and MUST call no store.
- **FR-007**: The table `revisions` MUST be asked of one path (`path = '...'`) and of a store that has `history`, and a query that does not name one path MUST be a problem that says so; the table `places` MUST give the places of the context and call no store.

## Acceptance scenarios

1. **Given** `ext = 'json' AND contains(text, 'a')`, **When** it is classified, **Then** the first is of the listing and the second of the content, per FR-001.
2. **Given** `path GLOB 'machines/al*'`, **When** it is bounded, **Then** the prefix is `machines`, per FR-002.
3. **Given** `under(path, 'a') AND under(path, 'b')`, **When** it is run, **Then** no operation reaches the store, per FR-002.
4. **Given** nine objects of which four are small JSON, **When** a query reads those of 60 bytes or less that contain a word, **Then** four are read, per FR-003.
5. **Given** random conjuncts and orders, **When** each query is run, **Then** its rows are those of the plan run over all objects, per FR-004.
6. **Given** `LIMIT 1` with no sort over a store where the first object matches, **When** it is run, **Then** not every object is read, per FR-005.
7. **Given** a query, **When** it is explained, **Then** the text is as FR-006 says and the store was not called.

## Out of scope

- Joins and aggregates over files (0002-query-language).
- A statistics catalogue and cost-based choices: the plan has one way to carry out each query.

## Edge cases

- A glob such as `*.json` has no literal start, so it bounds nothing and the whole place is listed (FR-002).

## Assumptions

- A store lists everything below a prefix in one key space, so a prefix is the only bound a listing can use (FR-002).

## Open questions

- None.

## Key entities

- **Bound**, **Classified filter**, **Reach**, **Explanation**.

## Success criteria

- **SC-001**: The rows of every random query are tested to equal the rows of its plan run over everything, and the operations a run makes are counted.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
