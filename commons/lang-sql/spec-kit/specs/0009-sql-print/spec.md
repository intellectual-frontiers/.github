# Feature Specification: The printer and unit literals

**Spec ID:** 0009-sql-print
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** A tree that can be read and changed (0003-sql-ast-tools) must be written back, in the dialect it came from or in another, and a small language made of SQL needs literals with units (`10 KB`, `7d`) that are numbers by the time any tool sees them. This feature adds the printer to the core and the first of the grammar hooks.

## The printer

- **FR-001**: `print(node, dialect, options?)` MUST write any node of the tree as text of the dialect, quoting an identifier with the dialect's quotes only where `identifier` of 0007-sql-emit would, a string as the dialect's first string syntax writes it, and a parameter in the style the node has where the dialect reads it, else in the dialect's own; `printScript(parsed, dialect, options?)` MUST write a script with its statements ended by `;`, an `unparsed` statement by its source text.
- **FR-002**: What the printer writes MUST be read back by the parser of the same dialect as a tree that is the same as the printed one but for its ranges (`toSexp` without offsets), for every statement of the corpora that the parser reads into a tree whose kinds are all printable, and the statements for which it is not are held in a list that only shrinks.
- **FR-003**: `options.pretty` MUST write each clause of a query on a line of its own, indented by two spaces for each level, and MUST read back as the same tree as without it.
- **FR-004**: A tree MUST be printed in the dialect of another: the printer MUST NOT throw, and a construct that the other dialect does not read MUST be written as the printer's dialect has it (`transpile` in aide judges and reports the difference).

## Unit literals

- **FR-005**: A grammar MUST be able to list units (`{ unit, factor }`, the unit a word of letters, upper case): a number followed by a word that is a unit (with or without white space) MUST be read as one number whose text is the product of the number and the factor, and a dialect that lists none MUST read the text as before.

## Paging

- **FR-006**: A select or a set operation whose `limitOptions` is set MUST be written with its offset first and then `FETCH FIRST n [PERCENT] ROWS ONLY | WITH TIES`, in every dialect, and read back as the same tree; one without is written with `LIMIT` and `OFFSET` as before.

## Out of scope

- Custom top-level statements, which no consumer needs yet, and the comments of a tree (the printer writes none).

## Edge cases

- `10 KB` with the unit `KB` of factor 1024: the number `10240`; `1.5 KB`: `1536`; a unit that is not listed after a number: not read as a unit, per FR-005.

## Assumptions

- A unit's factor is a finite number and the product is written with no exponent for any value a person writes.

## Open questions

- None.

## Key entities

- **Printer** - the inverse of the parser.
- **Unit** - a word that scales the number before it.

## Success criteria

- **SC-001**: A statement read in one dialect is written in it and read back as the same tree.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
