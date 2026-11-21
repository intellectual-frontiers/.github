# Feature Specification: Quoting, placeholders and a registry of dialects

**Spec ID:** 0007-sql-emit
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** A library that builds statements for a database (the SQL store of AnyFS, a query planner, a generator) must not write the quotes of an identifier or the style of a placeholder by hand, and must not need this library's source to add a dialect of its own. This feature gives the library what the lexical of a dialect already knows as functions: how to quote an identifier and a string, which placeholder a dialect writes, and a registry in which a library outside this one registers a dialect, with a catalog of the functions it has.

## Quoting

- **FR-001**: `quoteIdent(dialect, name)` MUST give the name written as the dialect's first quoted-identifier syntax writes it (its open quote, the name with the close quote written twice, its close quote) and MUST be an error value for a dialect that has no quoted identifier; `identifier(dialect, name)` MUST give the name bare where it is a plain lower-case word (letters a to z, digits and `_`, not beginning with a digit) that is not one of the dialect's keywords, and quoted as `quoteIdent` quotes it otherwise; `qualified(dialect, parts)` MUST give the parts joined by `.`, each as `identifier` gives it.
- **FR-002**: `quoteString(dialect, value)` MUST give the value written as the dialect's first string syntax writes it: a close quote inside written twice where the escape is `double`, and a backslash and a close quote each after a backslash where the escape is `backslash` or `both`; for the escape `none` a value that holds the close quote MUST be an error value.
- **FR-003**: What `quoteIdent` and `quoteString` give MUST be read back by the lexer of the same dialect as exactly one token (a quoted identifier, a string) that holds the whole text, for any name or value without a character the lexer reports as an error, in every dialect of this library.

## Placeholders

- **FR-004**: `paramStyles(dialect)` MUST give the styles of parameter that the dialect reads, in the order its lexical lists them; `placeholder(dialect, position, name?)` MUST give the text of a parameter of the dialect: for a name, the first of the colon, at and dollar styles the dialect has (`:name`, `@name`, `$name`); for a position (from 1), `$n` where the dialect has the dollar-number style and `?` where it has the question style; and an error value where the dialect has no style that fits (a name where it has no named style, a position where it has no positional one).
- **FR-005**: What `placeholder` gives MUST be read back by the lexer of the same dialect as exactly one token of the kind parameter, in every dialect of this library that has a style that fits.

## The registry

- **FR-006**: `createRegistry()` MUST give a registry that holds the base dialect `ansi` and its catalog of functions; `register(dialect)` MUST add a dialect, found afterwards by `get(name)` without regard to case, and MUST be an error value where the name is taken (by another dialect) or where the dialect extends a dialect that is not in the registry; registering the same dialect value twice MUST change nothing and succeed; `names()` MUST give the names in the order of registration.
- **FR-007**: `registerFunctions(dialect, functions)` MUST add the functions to the catalog of a registered dialect and `lookupFunction(dialect, name)` MUST find a function by name without regard to case, in the catalog of the dialect first and then in the catalog of each dialect it extends, so that a dialect's function replaces its parent's of the same name; a function whose name is empty, whose smallest number of arguments is more than its largest, or whose dialect is not registered MUST be an error value and MUST change nothing; `functionsOf(dialect)` MUST give every function the dialect finds, each name once.
- **FR-008**: None of these functions MUST throw for any value.

## Out of scope

- Writing a whole statement from a syntax tree, and the rules of a dialect for the case of an unquoted identifier (a name that is not a lower-case word is quoted, so that its case is kept where the engine folds an unquoted one).
- Checking the call of a function against its catalog.

## Edge cases

- A name with the close quote inside (`a"b`): written twice, per FR-001.
- `it's` in a dialect whose strings are written with a backslash: `'it\'s'`, per FR-002.
- A dialect that lists both `?` and `$n`: `$n` for a position, per FR-004.

## Assumptions

- A parameter of the question style is written `?`, one of the dollar-number style `$1`, and a position is from 1.

## Open questions

- None.

## Key entities

- **Quoting** - the functions that write an identifier or a string as a dialect does.
- **Placeholder** - the text of a parameter in a dialect.
- **Registry** - the dialects registered, with the catalog of functions of each.

## Success criteria

- **SC-001**: A library outside this one builds a statement for any dialect, and registers a dialect of its own, without writing a quote or a placeholder by hand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
