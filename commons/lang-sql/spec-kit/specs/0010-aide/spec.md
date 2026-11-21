# Feature Specification: Aide, the helpers of the SQL language

**Spec ID:** 0010-aide
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** The core reads and writes SQL and says what the tree is. A library that builds a small language of SQL for data access needs more than that: to restrict the language to a subset, to resolve names against a catalog, to type an expression, to simplify it, to plan a query, to decide what a backend can do and what is left, and to run what is left. These helpers are in `src/aide/`, a folder of this library that the rest of `src/`, the core, does not know, so that the core stays small and about the language alone (it is under `src/` because the packer of commons publishes what is under `src/`).

## The shape

- **FR-001**: Every file of `src/aide/` MUST import only files of `src/aide/`, the core (the files of `src/` outside `src/aide/`) and `@intellectual-frontiers/core`, and no `node:` module; no file of the core MUST import `src/aide/`; every file of `acceptance/` MAY import the core, `src/aide/` and `node:` modules and nothing else of commons but by package name; the manifest MUST export each file `src/aide/<name>/mod.ts` as `./aide/<name>` and MUST NOT export `acceptance/`.

## Profiles

- **FR-002**: `defineProfile(spec)` and `conform(parsed, profile)` MUST restrict a parse to a subset of the language: the kinds of statement, the kinds of node, the names of functions, the names of tables, the functions that are denied, the most statements a text may hold, and the limits of depth, of nodes and of tables used; `conform` MUST give an `ok` value where the parse is inside the profile and an `err` value of every violation with the span of its node and one sentence each.

## Catalog, names and types

- **FR-003**: A `Catalog` MUST say the tables (with their columns and the type of each: `int`, `float`, `text`, `bool`, `timestamp`) and the functions (with the types of their parameters and of their result) of a language; `bind(select, catalog)` MUST resolve each table and column of a query against it, with aliases and the scopes of subqueries, and give the type of each name or an error value of every unknown table, unknown column and ambiguous column, with the span of the name and, for a name close to one that exists, the name that was meant.
- **FR-004**: `typeOf(expr, bound)` MUST give the type of an expression (comparisons and logic `bool`, arithmetic the wider of its operands, the result of a function from its signature, `null` for `NULL`, `unknown` where it is not known) and `check(bound)` an error value for each use that cannot be right (a comparison of text with a number, arithmetic on text, a function called with the wrong number of arguments).

## Simplifying

- **FR-005**: `simplify(expr)` MUST give an expression that has the same value for every row, in which a constant is folded, `NOT` is pushed to the leaves (De Morgan, and the comparisons turned), a double negation is taken away, `BETWEEN` is two comparisons, `IN` of a list is `OR` of equalities where it has up to eight values, nested `AND` and `OR` are flat, and `TRUE` and `FALSE` are taken out of them; `conjuncts(expr)` MUST give the operands of the top-level `AND`.

## Planning

- **FR-006**: `plan(select, bound)` MUST give a logical plan of a query over one table (`scan`, `filter`, `sort`, `limit`, `project`), with its `distinct` where it has one, and an error value for a construct it does not plan (joins, aggregates, window functions, set operations); `explain(plan)` MUST write the plan as indented text, one operator on a line.
- **FR-007**: `split(plan, capabilities)` MUST divide a plan between a backend and the process: each conjunct of the filter that the capability `canEval` accepts is pushed, the others are the residual; the sort is pushed where `sort` is true and the limit where `limit` is true and no residual filter or unpushed sort stands between; the result MUST say the pushed part and the residual and MUST give a residual that, run on the rows of the pushed part, gives the rows of the whole plan.

## Running

- **FR-008**: `compile(expr, environment)` MUST give a closure `(row) => value` with the logic of SQL (null where a value is not known, `AND` and `OR` with their three values), the operators of the language of `astsql` (0008-sql-introspect FR-005), `LIKE` (with `%`, `_` and `ESCAPE`), the like-words of a dialect (`GLOB`, `ILIKE`, `REGEXP`), and the functions of the environment; an unknown function MUST be an error value at compile time and not at run time; `run(plan, rows, environment)` MUST run a plan or a residual over an iterable or an async iterable of rows and give the rows it selects, with `ORDER BY` (nulls first), `LIMIT`, `OFFSET`, `DISTINCT` and the projection.

## Writing, templates and diagnostics

- **FR-009**: `transpile(text, from, to)` MUST read the text in one dialect and write it in another, and give with the text the list of constructs that the other dialect does not read (found by reading what was written in it); `sql` MUST be a tagged template that gives the text and the values of a statement with a parameter for each value in the dialect's style, and MUST NOT put a value into the text; `renderDiagnostic(text, diagnostic)` MUST write a diagnostic with its line, the text of the line and a caret under its span.

## Relations

- **FR-010**: `createEngine(provider, functions?)` of `aide/relational` MUST answer one `SELECT`, `WITH`, set operation or `VALUES` over the relations a `Provider` gives by name (inner, left and cross joins, `WHERE`, `GROUP BY` with `count`, `sum`, `avg`, `min`, `max` and `group_concat`, `HAVING`, `ORDER BY`, `LIMIT`, subqueries and common table expressions), with the logic of SQL, and MUST give an error value, never a throw, for text that is not one query, a statement that writes, and a clause it does not have; `providerOf(record)` MUST find the relations of a record without regard to case; `aide/introspect` (the relations of a parse and the rules written as queries, 0008-sql-introspect) MUST run on it.

## Out of scope

- Joins, aggregates and optimizing across tables in the planner; a cost model; any change of a store.

## Edge cases

- A filter that folds to `FALSE`: the plan keeps a filter that selects nothing, per FR-005 and FR-006.
- A column that is close to two: the first by the order of the table, per FR-003.

## Assumptions

- Rows are records of values; a column that a row does not have is null.

## Open questions

- None.

## Key entities

- **Profile** - a subset of the language.
- **Catalog** - what a language's tables and functions are.
- **Plan** - a query as operators.
- **Capability** - what a backend can do.

## Success criteria

- **SC-001**: A consumer builds a language of its own from these parts and writes only what is its own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
