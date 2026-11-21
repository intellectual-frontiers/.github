# Feature Specification: Estate Query: policy as SQL

**Spec ID:** 0004-estate-query-checks
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A policy written as a question in SQL over the estate (every managed asset has an owner for converge; no asset has gone unobserved for a month; nothing is inherited that is not observed), run as a check of the `grc` library by its `sql` runner with the estate as the connection, so that its result is a result of `grc` with the controls it answers to.

## Requirements

- **FR-001**: `estateConnection` MUST be a connection that says it only reads and answers a query as rows that are objects of the columns; a query the estate refuses or cannot answer MUST be a failure with the reasons, so that a check over it is an `error` result with the reasons and never a pass.
- **FR-002**: `checkOf` MUST make a check of `grc` from a statement, the question in words, the controls it answers to and what is expected of the rows (none by default, the `empty` expectation), with a runner of the kind `sql`, and MUST give the reason, with the path, where what was written is not a check.
- **FR-003**: `runEstateChecks` MUST give a result of `grc` for each check, in order: a pass where the rows are as expected, a fail with the number of rows where they are not, and an `error` where the check cannot be run; one check that fails or errors MUST NOT stop the others, and no check MUST change the estate.

## Acceptance scenarios

1. **Given** the check "no managed asset lacks an owner of converge" over an estate that has one, **When** it runs, **Then** the result is a fail naming the number of rows, per FR-003.
2. **Given** a check whose statement deletes, **When** it runs, **Then** the result is an `error` with the reasons, per FR-001 and FR-003.

## Out of scope

- Where the checks are kept and where their results go (the tenant's files, the evidence store): the program that runs them.

## Edge cases

- A check that expects some rows and gets none: a fail, per FR-003.
- A statement with a value given apart: the value is never read as SQL, per FR-001.

## Assumptions

- The estate is given as in 0002-estate-query-relations.

## Open questions

- None.

## Key entities

- **Check**, **Result**, **Connection**.

## Success criteria

- **SC-001**: A compliance question about the estate is a check that anyone can read, run and attach controls to.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
