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

- **FR-010**: `createEngine(provider, functions?)` of `aide/relational` MUST answer one `SELECT`, `WITH`, set operation or `VALUES` over the relations a `Provider` gives by name (inner, left and cross joins, `WHERE`, `GROUP BY` with `count`, `sum`, `avg`, `min`, `max` and `group_concat`, `HAVING`, `ORDER BY`, `LIMIT`, subqueries and common table expressions), with the logic of SQL, and MUST give an error value, never a throw, for text that is not one query, a statement that writes, and a clause it does not have (FR-012 to FR-016 say what it has beyond that list); `providerOf(record)` MUST find the relations of a record without regard to case; `aide/introspect` (the relations of a parse and the rules written as queries, 0008-sql-introspect) MUST run on it.

## Colouring

- **FR-011**: `highlight(text, dialect)` of `aide/text` MUST give the stretches of the text and what each is, by the lexer of the dialect: `keyword` (a word the dialect lists as one), `function` (a word followed at once by `(`), `name`, `quoted-name`, `number`, `string` (a dollar quote and a doubled quote read as the dialect reads them), `param`, `operator`, `punctuation`, `comment` and `error` (a character the lexer cannot read); in the order of the text, never overlapping, with the white space left out, a word in a string or a comment not being a keyword; and it MUST NOT throw for any text.

## Relations, more

- **FR-012**: The engine MUST answer a set operation, `UNION`, `INTERSECT` and `EXCEPT`, each with or without `ALL`, and a `VALUES` list as a query (its columns `column1`, `column2`, and so on): the two sides MUST have the same number of columns (an error value says how many each has), the columns of the answer are those of the left side, a null equals a null where rows are compared for the operation, `UNION` and the other two without `ALL` give each row once, `INTERSECT ALL` gives a row as many times as the fewer of its two counts and `EXCEPT ALL` as many times as its count on the left less its count on the right, `INTERSECT` binds tighter than `UNION` and `EXCEPT` as the parser reads them, and the `ORDER BY`, `LIMIT` and `OFFSET` of the whole are applied to the answer by the name of an output column or its place; `BY NAME` and a data change MUST be error values.
- **FR-013**: The engine MUST answer a window function, a call with `OVER`: `row_number`, `rank`, `dense_rank`, `percent_rank`, `cume_dist`, `ntile`, `lag`, `lead` (with an offset and a default), `first_value`, `last_value` and `nth_value`, and `count`, `sum`, `avg`, `min`, `max` and `group_concat` over the frame, each by its `PARTITION BY` and `ORDER BY` (with `ASC`, `DESC` and `NULLS FIRST` or `LAST`), a named window (`WINDOW w AS (...)`, `OVER w`, `OVER (w ORDER BY ...)`) and a frame in `ROWS` (with `n PRECEDING`, `CURRENT ROW`, `n FOLLOWING` and unbounded ends) or in `RANGE` between unbounded ends and the current row; the frame MUST be, where none is given, the whole partition without `ORDER BY` and its start to the last peer of the current row with it; a window function MUST stand in the select list or the `ORDER BY` only (an error value elsewhere), may stand in a query that groups (it then runs over the groups), and `GROUPS`, `EXCLUDE` and a `RANGE` with an offset MUST be error values (and `IGNORE NULLS` where FR-022 does not allow it); a call of an aggregate with a `FILTER` MUST keep only the rows the filter holds, with or without `OVER`.
- **FR-014**: The engine MUST answer `RIGHT` and `FULL` outer joins (a row of the side that has no partner is kept with nulls for the other side's columns), and `NATURAL` and `USING` joins: the columns of a `USING` list (of a `NATURAL` join, the columns the two sides have in common) are compared for equality, appear once, first, in `SELECT *` and are the same name for an unqualified reference, whose value in a `RIGHT` or `FULL` join is the one from the side that has the row; a qualified reference still reads its own side; a `USING` column that a side does not have MUST be an error value.
- **FR-015**: The engine MUST honour `NULLS FIRST` and `NULLS LAST` in an `ORDER BY` (nulls first for `ASC` and last for `DESC` where neither is written, as the engine did) and the `OFFSET n ROWS` and `FETCH FIRST|NEXT n ROWS ONLY` forms (FR-023 says `PERCENT` and `WITH TIES`).
- **FR-016**: The engine MUST answer a recursive common table expression, `WITH RECURSIVE name (columns) AS (anchor UNION [ALL] step) body`: the anchor is run once, the step again with the rows the last round made as `name` until a round makes none (`UNION` giving each row once and stopping where a round adds none), and a recursion that does not end within a limit of rounds (10 000) or of rows (1 000 000) MUST be an error value.

## Dates and times

- **FR-017**: The engine MUST hold a date, a time, a timestamp and an interval as text, so that a relation holds only strings, numbers, booleans and nulls: a `DATE` as `YYYY-MM-DD`, a `TIME` as `HH:MM:SS[.fff]`, a `TIMESTAMP` as `YYYY-MM-DD HH:MM:SS[.fff]` (all in UTC, with no time zones) and an `INTERVAL` as the duration of ISO 8601 with a sign on each part (`P1Y-2M3DT4H5M6.5S`, `PT0S` for none); `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP`, `LOCALTIME` and `LOCALTIMESTAMP` (and the call forms with a precision) MUST be the moment of a clock that the engine is given (`options.now`, the system clock where none is given), read once for each statement, so that two of them in one statement agree; the dates and times of two values MUST compare as the moments do (a date and a timestamp by the date's midnight, two intervals by their lengths, a month being 30 days), and a text that is none of them compares as text as before.
- **FR-018**: The engine MUST read the literals `DATE '...'`, `TIME '...'`, `TIMESTAMP '...'` and `INTERVAL '...' unit` (a single unit, `YEAR TO MONTH`, `DAY TO HOUR`, `DAY TO MINUTE`, `DAY TO SECOND`, `HOUR TO MINUTE`, `HOUR TO SECOND` and `MINUTE TO SECOND`, and an interval of words, `INTERVAL '1 year 2 months'`, or of ISO 8601), and `CAST(x AS DATE | TIME | TIMESTAMP | INTERVAL)` (a date from a timestamp keeps its day, a timestamp from a date is its midnight, a time from a timestamp its time of day), with an error value for a text that is not what it is said to be; it MUST do `date + interval`, `date - interval`, `timestamp ± interval` (months by the calendar, a day past the end of a month going to its last day), `date ± n` (days), `interval ± interval`, `interval * n`, `n * interval`, `interval / n`, `-interval`, `date - date` (a number of days), and `timestamp - timestamp` and `time - time` (an interval), a date plus an interval with a time part being a timestamp; and `EXTRACT(field FROM x)` of a date or a timestamp (`YEAR`, `QUARTER`, `MONTH`, `WEEK` (ISO), `DAY`, `DOW`, `ISODOW`, `DOY`, `HOUR`, `MINUTE`, `SECOND`, `MILLISECOND`, `MICROSECOND`, `EPOCH`), of a time (`HOUR`, `MINUTE`, `SECOND`, `EPOCH`) and of an interval (`YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `EPOCH`), a null giving a null and a field that the value has not being an error value; a type with a time zone MUST be an error value.

## Grouping sets

- **FR-019**: The engine MUST answer `GROUP BY ROLLUP (...)`, `CUBE (...)` and `GROUPING SETS (...)` (their arguments single expressions or parenthesized lists that stand together, and `GROUPING SETS` holding `ROLLUP`, `CUBE`, other `GROUPING SETS` and the empty list `()`), alone or with plain expressions (`GROUP BY a, ROLLUP (b, c)` being the sets `(a, b, c)`, `(a, b)` and `(a)`): each set is grouped on its own, its groups follow those of the sets before it, a grouping expression that the set does not hold is null in the select list, the `HAVING` and the `ORDER BY` of its rows, the empty set gives one row even where there are no rows and any other set none, and `GROUPING(e, ...)` gives the whole number whose bits, the first argument the highest, are 1 where the argument is not in the row's set and 0 where it is (0 in a query with plain grouping); `GROUPING` of an expression that the query does not group on, and a `CUBE` of more than 12 expressions, MUST be error values.

## Quantified comparisons

- **FR-020**: The engine MUST answer `x op ANY (subquery)`, `x op SOME (subquery)` and `x op ALL (subquery)` for `=`, `<>`, `!=`, `<`, `<=`, `>` and `>=`, and the same over `ARRAY[...]`, with the logic of SQL: `ANY` and `SOME` are true where one comparison is true, else null where one is null, else false (and false over no value), `ALL` is false where one comparison is false, else null where one is null, else true (and true over no value); the subquery MUST have one column, and any other operator or argument MUST be an error value.

## Strings and ordered aggregates

- **FR-021**: The engine MUST have the string functions `char_length` and `character_length` (characters), `octet_length` (bytes of UTF-8), `substring` (`SUBSTRING(x FROM a [FOR n])` and `substring(x, a [, n])`, positions from 1, the part before the string's start taken from the length), `position(a IN x)` (0 where `a` is not in `x`), `trim([LEADING | TRAILING | BOTH] [chars FROM] x)` (spaces where no characters are given) and `trim(x)`, `ltrim(x [, chars])`, `rtrim(x [, chars])`, `overlay(x PLACING y FROM a [FOR n])` (the length of `y` where `n` is not given), `concat` (a null left out), `left`, `right`, `repeat`, `reverse`, `lpad` and `rpad`; a null argument gives a null (but for `concat`), and an argument that is not a whole number where one is needed MUST be an error value.
- **FR-022**: The engine MUST answer `listagg(x, separator)`, `string_agg(x, separator)` and `group_concat(x [, separator])` with an `ORDER BY` among their arguments or after `WITHIN GROUP`, and with `DISTINCT`, joining the values in that order (a null left out, null where there is none); the separator of `listagg` and `string_agg` MUST be given (an error value where it is not); and it MUST answer `lag`, `lead`, `first_value`, `last_value` and `nth_value` with `IGNORE NULLS` (counting only the rows whose value is not null: the offset of `lag` and `lead`, the first, last and nth of the frame), `RESPECT NULLS` being as none is written, and `IGNORE NULLS` of any other function an error value.

## Paging, sampling and patterns

- **FR-023**: The engine MUST answer `FETCH FIRST|NEXT n PERCENT ROWS ONLY` (the first `ceil(n / 100 * rows)` rows of what the `OFFSET` leaves, `n` from 0 to 100) and `FETCH FIRST|NEXT n ROWS WITH TIES` (the first `n` rows and the rows after them that equal the last of them on every key of the `ORDER BY`; an error value where there is no `ORDER BY`), `PERCENT` with `WITH TIES` giving the rows of the percent and their ties, in a select and in a set operation, and an error value for a count that is not a number or a percent out of 0 to 100.
- **FR-024**: The engine MUST answer `x [NOT] SIMILAR TO pattern [ESCAPE e]`, the whole of `x` matching the pattern in which `%` is any run of characters, `_` any one, `| * + ? {m,n} ( )` are those of a regular expression, `[...]` is a class (with `[:alpha:]`, `[:digit:]`, `[:alnum:]`, `[:upper:]`, `[:lower:]`, `[:space:]`), the escape character makes the next character itself (there is none unless `ESCAPE` gives one) and every other character stands for itself, with the logic of SQL (null where a side is null); a pattern that is not one MUST be an error value.
- **FR-025**: The engine MUST answer `TABLESAMPLE BERNOULLI (p)` and `TABLESAMPLE SYSTEM (p)` after a table and its alias, with or without `REPEATABLE (seed)`: each row is kept where a pseudo-random number of a generator that the seed starts (the seed 0 where none is given, so that the same query over the same rows gives the same rows) is under `p` percent (`p` from 0 to 100); any other method, and a `p` out of range, MUST be an error value.
- **FR-026**: The engine MUST answer `LATERAL (subquery)` and `JOIN LATERAL`, `CROSS JOIN LATERAL` and `LEFT JOIN LATERAL ... ON TRUE`: the subquery is run for each row of what stands before it in the `FROM` and may name that row's columns, an inner or cross join keeping the rows that the subquery gives and a left join keeping the row once with nulls where it gives none.

## Numbers and truncation

- **FR-027**: The engine MUST have `round(x [, n])` (half away from zero, as decimal text reads it, so that `round(2.675, 2)` is 2.68; `n` a whole number that may be negative, 0 where it is not given), `floor(x)`, `ceil(x)` and `ceiling(x)`, and `date_trunc(field, x)` of a date or a timestamp (a date is read as its midnight, and the answer is a timestamp) for the fields `microseconds`, `milliseconds`, `second`, `minute`, `hour`, `day`, `week` (the Monday), `month`, `quarter`, `year`, `decade`, `century` and `millennium`, the field without regard to case; a null argument gives a null, and an argument that is not a number (or not a date or a timestamp), a `n` that is not whole and a field that is none MUST be error values.

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
