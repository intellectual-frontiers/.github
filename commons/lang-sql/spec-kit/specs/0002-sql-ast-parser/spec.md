# Feature Specification: The syntax tree and the parser of the SQL language core

**Spec ID:** 0002-sql-ast-parser
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** 0001-sql-lang reads SQL text into tokens and keeps every comment, but nothing yet says what the text means. This feature is the next layer of `src/`: a syntax tree whose types make a wrong tree not compile, a parser that reads the common ground of SQL (queries, data changes and the definitions of tables, views and indexes) in any dialect that says how it differs, the attachment of each comment to the node it belongs to, and the walks over a tree that every later feature needs. A parser that fails does not stop: the statement it could not read is kept as a node, the others are read, and the errors are values.

## The tree

- **FR-001**: A tree MUST be a closed union of nodes told apart by `kind`; every child field MUST have the type of the sort of node it may hold (`Expr`, `Query`, `Source`, `Statement`, `ColumnConstraint`, `TableConstraint`, `AlterAction`, or a single kind), so that a node of another sort in that place does not compile, and a `switch` on `kind` that leaves a kind out does not compile either.
- **FR-002**: Every node MUST hold `start` and `end`, the half-open range of its text in UTF-16 units, and no node MUST hold its parent or the text; a node's range MUST contain the ranges of its children, and a node whose first or last token is a parenthesis MUST include it.
- **FR-003**: A name MUST be an identifier (`ident`: its text with the quotes taken off and a doubled closing quote made one, and whether it was quoted) or a qualified name (`name`: one or more identifiers); a star MUST be `star` with the qualifier it has.
- **FR-004**: A number MUST keep its text as written; a string MUST hold its value as the dialect reads it (a quote written twice or after a backslash made one, per the string's escape and prefix, a dollar quote's contents whole) and its prefix; `TRUE`, `FALSE` and `NULL` MUST be nodes of their own; a parameter MUST hold its style and its text.
- **FR-005**: The tree MUST have the nodes of the expressions below, each as a kind of its own: unary (`-`, `+`, `NOT`), binary (`+ - * / % || = <> != < <= > >= AND OR`), an operator of the dialect, `IS [NOT] NULL | TRUE | FALSE | UNKNOWN | DISTINCT FROM x`, `[NOT] BETWEEN`, `[NOT] IN` of a list and of a query, `[NOT] LIKE` (and the like-words of the dialect) with `ESCAPE`, `CASE` with `WHEN`, `CAST`, `EXTRACT`, `INTERVAL`, a call (with `DISTINCT`, `FILTER (WHERE ...)`, `OVER` a window or a named window, and arguments that are expressions, stars or named), `EXISTS`, a scalar subquery and a row.
- **FR-006**: The tree MUST have the nodes of queries (`select` with its items, sources, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`; `set-op` of `UNION`, `INTERSECT` and `EXCEPT` with `ALL` or `DISTINCT`; `values`; `with` with its common table expressions, recursive or not, with their column lists), of sources (a table with its alias and column list, a subquery with `LATERAL`, a table function, a join of each type with `ON` or `USING`, natural or not), of data changes (`insert`, `update`, `delete`, each with `RETURNING`), and of definitions (`create-table` with columns, types and constraints, `create-index`, `create-view`, `alter-table` with its actions, `drop`).
- **FR-007**: A script MUST be a `script` node of its statements; a statement the parser could not read MUST be an `unparsed` node of its range.

## The parser

- **FR-008**: `parse(text, dialect)` MUST accept any text and any dialect, MUST NOT throw and MUST end, and MUST return the script, the errors, the comments and their attachment; `parseStrict` MUST return the same as a value of `ok` where there is no error and the errors as `err` where there is any.
- **FR-009**: Expressions MUST be read with the precedence of SQL, from the loosest: `OR`, `AND`, `NOT`, `IS`, the comparisons, `LIKE`/`BETWEEN`/`IN`, the other operators (`||` among them), `+ -`, `* / %`, the exponent, the unary sign and `::`; the binary operators of the same level MUST associate to the left, so that `a OR b AND c` is `a OR (b AND c)`, `NOT a = b` is `NOT (a = b)`, `a - b - c` is `(a - b) - c` and `-a * b` is `(-a) * b`.
- **FR-010**: A query MUST be read with `INTERSECT` binding tighter than `UNION` and `EXCEPT`, all to the left; the `ORDER BY`, `LIMIT`, `OFFSET` and `FETCH FIRST | NEXT n ROWS ONLY` that follow a set operation MUST belong to the whole of it, and those inside parentheses to the query in them; a query MUST be allowed in parentheses, as a source, as a scalar, after `IN`, after `EXISTS`, and as the body of `INSERT` and of `CREATE VIEW`.
- **FR-011**: A word MUST be an identifier where the dialect does not reserve it, and a reserved word MUST be an identifier only after a `.` or where it is quoted; an alias MUST be read with or without `AS`.
- **FR-012**: A statement that cannot be read MUST be an error value with the span of what was found, what was expected and one sentence, and the parser MUST go on at the next `;` with the statement as an `unparsed` node; the errors the lexer found MUST be among the errors; text with a nesting deeper than 200 MUST be an error value and not a stack overflow.
- **FR-013**: A dialect MUST say how its grammar differs in a `Grammar` value made, like its lexical, by a function from its parent's: the operators it adds with their binding powers, its cast operator, and its like-words; a grammar that names an operator or a word that its lexical does not have MUST be an error value of `defineDialect`. SQLite, PostgreSQL and DuckDB MUST each declare theirs (the JSON arrows, `==`, `GLOB` and `REGEXP` for SQLite; `::`, `ILIKE` and the operators of the language for PostgreSQL; `::`, `ILIKE`, `//`, `**` and the arrows for DuckDB).

## Comments

- **FR-014**: Each comment MUST be attached, by one rule and without regard to the dialect, to exactly one node as `leading`, `trailing`, `dangling` or `detached`: the smallest node that contains it is its enclosing node; a comment on a line of its own (`ownLine`) that is followed by a child of the enclosing node and not by a blank line is the `leading` comment of that child; one that is followed by a blank line is `detached` and belongs to the enclosing node; a comment that shares a line with what precedes it is the `trailing` comment of the nearest child that precedes it, and where none precedes it the `leading` comment of the child that follows; a comment with no children near it is `dangling` on the enclosing node; and an own-line comment with no child after it is the `trailing` comment of the last child before it.
- **FR-015**: The attachment MUST be a table that gives, for a node, its comments by placement in the order of the text, and for a comment its node and placement; every comment of the text MUST be in it once, whether the statement around it was read or not.

## Walks

- **FR-016**: `children(node)` MUST give every child node of a node in the order of the text, for every kind, with nothing left out (a test finds a child field it does not give); `walk` MUST visit a tree depth first, calling `enter` before and `leave` after a node's children and not visiting them where `enter` returns `false`; `findAll(root, kind)` MUST give the nodes of that kind, typed as that kind; `fold` MUST combine a tree from its leaves.
- **FR-017**: `toSexp(node)` MUST write a tree as text that is the same for the same tree, one node to a line, indented, without the offsets unless asked; the text of the corpus's trees MUST be committed under `suite/golden/`, so that a change of the grammar shows as a difference, and a test MUST fail where a file is not what the parser makes.

## Speed

- **FR-018**: The parser MUST read the tokens by index and make a node with one object literal, with no regular expression and no copy of the text but the identifiers' and strings' own; `bun tools/bench.ts` MUST measure its throughput (the lexer and the parser together, the parser alone) on the corpus beside the throughput of sqlglot's parser on the same corpus.

## Paging

- **FR-019**: The parser MUST read `FETCH FIRST|NEXT n [PERCENT] ROWS ONLY` and `FETCH FIRST|NEXT n [PERCENT] ROWS WITH TIES` after a select or a set operation, as the count in `limit` and the words that a `LIMIT` cannot say, `PERCENT`, `WITH TIES` or `PERCENT WITH TIES`, in `limitOptions` (none for a count of rows only), so that a `FETCH FIRST n ROWS ONLY` is a `LIMIT n` as before.
- **FR-020**: A table followed at once by `TABLESAMPLE method (...)` MUST be read with the sample as what stands beside the table (its `hint`) and no alias, as a table with an alias before it is: `FROM t TABLESAMPLE BERNOULLI (10)` and `FROM t AS x TABLESAMPLE BERNOULLI (10)`.

## Out of scope

- Writing SQL from a tree, and changing a tree into another dialect's.
- Rewriting a tree (`map`), queries over trees and the projection to `unist`: the next specification of this folder.
- `MERGE`, `GROUP BY ROLLUP`, `CUBE` and `GROUPING SETS`, ordered-set aggregates, the `WINDOW` clause, array subscripts, JSON paths and the syntax of one dialect that the three dialects of this folder do not share, procedural code, and SQL over data that is not a database.
- A name for every word of every dialect: a word is reserved by the grammar of the core and by nothing else.

## Edge cases

- `a OR b AND c`, `NOT a = b`, `a - b - c`, `-a * b`: per FR-009.
- `a BETWEEN 1 AND 2 AND c`: the first `AND` belongs to `BETWEEN`, per FR-009.
- `SELECT 1 UNION SELECT 2 ORDER BY 1`: the order belongs to the union, per FR-010.
- `t.order`: `order` is an identifier after a dot, per FR-011.
- `SELECT FROM t; SELECT 1`: the first is `unparsed` with an error and the second is read, per FR-012.
- `((((` nested past 200: an error value, per FR-012.
- A comment before a column, after it on the same line, and between two statements with a blank line: per FR-014.
- A comment inside a statement that could not be read: still attached (dangling on the `unparsed` node), per FR-015.

## Assumptions

- Measured on 2026-11-21, on one cloud container, on the 4 MB corpus of `suite/corpus.sql`, with sqlglot at commit `b812ff9` as installed from a checkout (not compiled): sqlglot tokenizes and parses it at 0.54 MB/s; this parser, before any tuning, reads it at 33 MB/s with the comments attached (`parse`) and 36 MB/s without (`attach: false`). One machine and one corpus: a number to be judged against, and no claim about sqlglot's compiled build. The first version attached comments by scanning the script's children for each comment and read at 0.7 MB/s; the benchmark found it, and a cached child list with a binary search fixed it.
- The tree is that of the common ground; where a dialect writes more, its grammar names the operators and words and the parser reads them as the nodes of the common ground (an `operator` node, a `like` with its word), never as a kind that only one dialect has.
- A name is not looked up: `current_date` is a `name`, and `count` is the name of a call because a `(` follows.

## Open questions

- **OQ-1**: Whether a parenthesized expression should be a node of its own, so that the tree can write the parentheses back; the tree does not hold them now and generation is out of scope.

## Key entities

- **Node** - a part of a tree, with its kind and range.
- **Grammar** - how a dialect's grammar differs.
- **Attachment** - a comment's node and placement.

## Success criteria

- **SC-001**: Every statement of the corpus is read into a tree whose ranges nest, whose comments are all attached, and that is the same on every run.
- **SC-002**: A wrong tree does not compile and a new kind of node fails the compile of every walk that does not handle it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
