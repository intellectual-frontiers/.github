# Feature Specification: AnyFS Query: the language

**Spec ID:** 0002-query-language
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A person or a program asks about files in the language of tables: the files of a place, what they hold, what they were, and the places there are. The language is the common ground of SQL with a few words more, held to one SELECT of one source.

## Requirements

- **FR-001**: The language MUST be the dialect `anyfs`, made with the SQL language library as an instance that extends its common ground with the like-words `GLOB` and `ILIKE` and the units of sizes and times; it MUST be registered with its functions in a registry of that library, and the library MUST name nothing of AnyFS.
- **FR-002**: The tables MUST be `files` (place, path, name, ext, size, media_type, mtime, rev, kind, depth), `content` (the columns of `files` and text, is_text, redacted), `revisions` (place, path, rev, size, instant) and `places` (uri, kind, capabilities, consistency, max_object), each column with a type of int, text, bool or timestamp, and `SELECT *` MUST give a table's columns in this order; a path in a row MUST be the path in the store, and `mtime` and `instant` whole seconds, or no value where the store does not say.
- **FR-003**: A source MUST be a table of the language, with the default place of the context, or a table function of the same name with one text, the place: `files('s3://bucket/prefix')`, `files('fleet:/machines')`; a source that is anything else, or names a table or function the language does not have, or a place that is not a text, MUST be a problem with the position of what was wrong.
- **FR-004**: A query MUST be one `SELECT` of one source; a statement of another kind, more than one statement, a join, a subquery, `WITH`, a set operation, a window, an aggregate or `GROUP BY`, a function that is not in the language and a `LIMIT` that is not a number MUST each be refused as a value that says what and where, before any store is called.
- **FR-005**: The scalar functions MUST be `now`, `lower`, `upper`, `length`, `substr`, `instr`, `replace`, `coalesce`, `nullif`, `abs`, `basename`, `dirname`, `glob`, `under` (a path is the prefix or below it, by whole segments), `contains` (a text holds another) and `json_get` (the value at a path such as `$.a.b[0]` of a JSON text: a scalar as itself, an object or array as its text, and no value where there is none); each MUST give no value where an argument has none, and `json_get` MUST give no value for a text over 1 MiB, nested deeper than 64, or a path over 256 characters or not of this form. A function that takes a pattern from a query as a regular expression MUST NOT be in the language.
- **FR-006**: A number MAY be followed by a unit of size (`B`, `KB`, `MB`, `GB`, in powers of 1024) or of time (`S`, `M`, `H`, `D`, `W`, in seconds), and the number is then the product.
- **FR-007**: No text MUST make a query throw: every failure MUST be a value of the closed type of problems, and a problem with positions MUST be described with the line and column of each, counted from 1.

## Acceptance scenarios

1. **Given** the dialect and its functions, **When** a registry of the language library is made, **Then** it holds them and the language library's sources name nothing of AnyFS, per FR-001.
2. **Given** a query `SELECT * FROM files('fleet:/')`, **When** it is run, **Then** the columns are those of FR-002 in order.
3. **Given** `files('fleet:/machines')`, `files` with a default place and `files()`, **When** they are run, **Then** each reads the place it names or the default, per FR-003.
4. **Given** a `DELETE`, a join, a subquery, a `WITH`, a `UNION`, a `count(*)`, a `GROUP BY` and `regexp(...)`, **When** each is run, **Then** each is refused with a position inside the text, per FR-004.
5. **Given** `under('a/b', 'a')` and `under('ab', 'a')`, **When** they are evaluated, **Then** the first is true and the second false, per FR-005.
6. **Given** `size >= 1 KB`, **When** it is run, **Then** it compares with 1024, per FR-006.
7. **Given** text with a NUL, five thousand open parentheses, an unterminated comment or `'; DROP TABLE files; --`, **When** it is run, **Then** a value comes back, per FR-007.

## Out of scope

- Joins between tables, aggregates and grouping: the planner of the language library plans one table without them.
- Writing: the language reads.

## Edge cases

- A path that is not valid in a store never matches, and a column with no value compares as no value, so a row with none is left out by any comparison (FR-005, FR-007).

## Assumptions

- The language library's planner plans one table without joins or aggregates (FR-004).

## Open questions

- None.

## Key entities

- **Dialect**, **Table**, **Table function**, **Profile**, **Catalog**, **Unit**.

## Success criteria

- **SC-001**: Every statement the language refuses is tested to be refused with a position inside the text, and none throws.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
