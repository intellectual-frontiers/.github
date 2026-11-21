# Feature Specification: Documentation extracted from SQL comments

**Spec ID:** 0004-sql-docs
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** People write the documentation of a table, a column, a view or an index as a comment beside it, in whatever comment the dialect has (`--`, `---`, `#`, `//`, a block comment, `/** ... */`). 0001-sql-lang keeps every comment and 0002-sql-ast-parser attaches each to its node. This feature reads the comments attached to the declarations of a script and gives them as documentation in the way JSDoc and TSDoc do: a summary, a description and tags (`@param`, `@returns`, `@example`, `@deprecated`, `@since`, `@see`, and the tags a project adds), with the examples parsed back by the same parser, and written as Markdown. It is an extension of the SQL language core: it imports the core and nothing else.

## What is documentation

- **FR-001**: The text of a comment MUST be read as documentation with its markers taken off: a line comment loses its marker, any run of the marker's last character that follows it (`---`, `///`, `##`) and one space; a block comment loses its delimiters, and on each line its leading white space, any `*` and one space, with empty lines at its start and end dropped; consecutive comments are joined by a new line; and the kind of comment MUST NOT matter, so that every kind a dialect has (`--`, `#`, `//`, `#!`, block comments, hints) can carry documentation.
- **FR-002**: The documentation of a declaration MUST be its `leading` comments (those on lines of their own that stand directly before it, with no blank line between) followed by its `trailing` comments (those on its line, after it); the comments that trail the declaration's name (`CREATE TABLE t ( -- the table`) count as its trailing comments; a `detached` comment, a `dangling` one and a comment of another node MUST NOT be part of it; where it has none, it has no documentation.

## What it says

- **FR-003**: `parseDoc` MUST give a summary (the first paragraph, with its lines joined by a space), a description (the paragraphs after it that come before the first tag, with their line breaks kept) and the tags; a tag MUST begin on a line whose first character is `@` followed by a name, and its text MUST continue over the lines that follow until the next tag; an empty paragraph, text that begins with a tag, and a tag with no text MUST be allowed.
- **FR-004**: The tags `param` (a name, an optional type in braces, and its text), `returns` (and `return`), `example`, `deprecated`, `since` and `see` MUST be typed; every other tag MUST be a tag with its name and text; and a project MUST be able to give a reader for a tag of its own, which is used in the place of the generic one.
- **FR-005**: The code of an `example` MUST be the text of the tag with a Markdown fence (` ``` ` or ` ```sql `) taken off where it has one, and MUST be parsed with the dialect of the script, so that the example's tree and its errors are part of the tag.

## What is documented

- **FR-006**: `documentScript` MUST give, in the order of the text, a declaration for each of: a table (`create-table`), with its columns and its named constraints as members; a view; an index; each common table expression of a `WITH`; a column added by `ALTER TABLE ... ADD COLUMN`; and every other statement, so that a named query can be documented; each with its kind, its name as written (qualified names joined by a dot), its node and its documentation or none.
- **FR-007**: `toMarkdown` MUST write declarations as Markdown, one section for each declaration with a documentation or members, in the order of the text: the heading is the kind and the name, then the summary and description, a list of the members with their summaries, and each tag, with the examples as fenced code; and it MUST write the same text for the same declarations.
- **FR-008**: Extracting documentation MUST NOT change the tree, the comments or the attachments it reads, and MUST give the same result for the same input.

## Out of scope

- Documentation of routines and of what a routine's body holds: a later specification, with the parsers of stored routines.
- Resolving `@see` to a declaration, checking that a `@param` names a parameter, and generating a site.

## Edge cases

- A column that has a comment on the line above it and another after it on its line: the documentation is both, in that order, per FR-002.
- A comment above a table separated from it by a blank line: no documentation, per FR-002.
- `/** @deprecated use b */` over a column: no summary, a `deprecated` tag, per FR-003.
- A `@param` with no type: the type is absent, per FR-004.
- `@example` followed by a fenced block that holds two statements: both are parsed, per FR-005.
- `-- name: GetUser :one` before a query: the documentation of that statement, whose text is that line, per FR-006.

## Assumptions

- The first paragraph is the summary, as in TSDoc; no sentence is cut.
- A comment that is not meant as documentation (a commented-out statement) is documentation to this feature; telling them apart is the project's convention.

## Open questions

- **OQ-1**: Whether `trailing` comments of a table (after its closing parenthesis) should be documentation of the table; they are, per FR-002, as they are comments of the node.

## Key entities

- **Doc** - a summary, a description and tags.
- **Declaration** - a documented part of a script with its members.

## Success criteria

- **SC-001**: The comments a person wrote beside the tables and columns of a schema come out as structured documentation in any dialect and with any kind of comment.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
