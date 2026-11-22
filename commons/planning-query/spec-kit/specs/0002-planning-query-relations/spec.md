# Feature Specification: Planning Query relations

**Spec ID:** 0002-planning-query-relations
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The items of Planning (commons planning, the library of the items, their events, links and traces) as relations of SQL, read-only, in the way `estate-query` and `anyfs-query` give the estate and the stores: the relations are data (a name, a sentence, and columns with a type and a sentence), the catalog the guard binds a statement to and the rows are made from that one list, one statement that only reads is refused with every reason before it runs and is run by the engine of `lang-sql`, and a proposed item is not counted unless the question says so. It realizes the requirement of commons 0037-planning named in each requirement below and only cites upward.

## Requirements

- **FR-001**: The relation `issues` MUST have a column for each field of the core of an item (its id, kind, title, body, severity, origin, external ids, labels, assignees, links, comments and the carried fields of its source) and for its state (`state`, `reason` of a close, the `until` day of a deferral), and the columns the monorepo's relation of that name has (`id`, `title`, `state`, `reason`, `severity`, `blocker`, `labels`, `assignees`, `comments`, `opened_at` and `updated_at`) where the item has the field; the relations `events`, `links` and `traces` MUST give each event, link and trace of the items (commons 0037-planning FR-036).
- **FR-002**: The relations MUST be data, one list of columns for each relation, and the catalog the guard binds to, the help that lists them and the rows MUST all be made from that one list, so that a column has one definition and a column with no way to be filled does not compile (commons 0037-planning FR-036).
- **FR-003**: A statement MUST be one read-only statement over the relations, refused with every reason before it runs where it is not (an unknown table or column is said with the nearest), run by the engine of `lang-sql`, within a budget of rows, and its answer MUST be the same rows as the query algebra of commons planning gives for the same items (commons 0037-planning FR-020, FR-036).
- **FR-004**: A proposed item MUST NOT be a row of `issues` unless the question is opened with proposals included, and the proposals MUST then be told by their state (commons 0037-planning FR-006).
- **FR-005**: The store of a repository MUST be askable: its items are the fold of its events as commons planning loads them, and no secret is in a relation, because the model holds none (commons 0037-planning FR-036).

## Acceptance scenarios

1. **Given** items of every kind and state, **When** `select state, count(*) from issues group by state` is asked, **Then** the counts are those the query algebra gives, per FR-003.
2. **Given** a proposed item, **When** `select * from issues` is asked, **Then** it is not a row, and **When** proposals are included, **Then** it is, with the state proposed, per FR-004.
3. **Given** a statement that writes, **When** it is asked, **Then** it is refused with its reasons and nothing runs, per FR-003.

## Out of scope

- The program `agora query`, which reads the relations through the plugin pattern of the host: it is not in this repository.

## Edge cases

- A list-valued field (labels, assignees): one text with the members joined by a comma, per FR-001.
- An item with no severity: an empty text, per FR-001.

## Assumptions

- The engine and the guard of `lang-sql` are as `estate-query` uses them.

## Open questions

- None.

## Key entities

- **Relation** - a name and a list of columns, as data.
- **Planning query** - a question over the relations.

## Success criteria

- **SC-001**: The same items answer the same in SQL and in the query algebra.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
