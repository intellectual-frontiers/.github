# Feature Specification: Introspection, SQL over the syntax tree

**Spec ID:** 0008-sql-introspect
**Status:** Active
**Owner:** if
**Domain:** lang-sql

**Input:** Once SQL is parsed, what a person asks of it (which tables does it write, where is a `DELETE` with no `WHERE`, how deep is it nested, what is its shape) is best asked in SQL. This feature, a helper in `aide` (`aide/introspect`, on the engine of `aide/relational`), turns a parse into relations and answers a small SQL over them, so that the tree, its comments, its errors and the language itself are observable with the tool every reader of the tree already knows. It is self-hosting: the query is read by this library's own parser.

## The relations

- **FR-001**: `introspect(text, dialect, options?)` MUST return, for any text and any dialect and without throwing, an `Introspection` with `query(sql, params?)`, `tables()`, `diagnostics()` and `addRule(rule)`; `query` MUST return an `ok` value of rows (a list of column names and a list of rows of values: text, number, boolean or null) or an `err` value that says in one sentence what in the query is wrong or unsupported.
- **FR-002**: The relations MUST be (`stop` is the end of a range, `end` being a word of SQL): `statement(id, kind, start, stop, text, fingerprint, read_only)`; `node(id, parent, stmt, kind, field, ordinal, depth, start, stop)` for every node of every statement in the order of the text, where `parent` is 0 for a statement and `field` names the field of the parent that holds the node; `attr(node, name, value)` for every field of a node that is not a node; `ancestor(node, ancestor, distance)`; `token(id, kind, start, stop, text)`; `comment(id, style, marker, text, start, stop, placement, node)`; `table_ref(node, name, access)`, where the access is `read`, `write`, `create`, `alter` or `drop`; `column_ref(node, name, qualifier)`; `function_call(node, name, argc, is_distinct)`; `param(node, style, text)`; `cte(node, name, uses)`; and `diagnostic(id, severity, code, message, start, stop, rule, node)`.
- **FR-003**: The relations of the language MUST be `keyword(word)` and `operator(text)` of the dialect, and `function(name, min_args, max_args, aggregate)` of the registry given in the options, none where none is given.
- **FR-004**: A relation MUST be built only when a query names it (and the relations it needs: `diagnostic` needs the rules), so that a query over `statement` costs no tokens; `tables()` MUST give the names and columns of every relation and `built()` the names of those built so far.

## The query language

- **FR-005**: The query MUST be written in the dialect `astsql` (the common ground of SQL) and read by this library's parser; a query MUST be allowed `SELECT [DISTINCT]` with expressions and aliases, `FROM` with aliases, inner, left and cross joins, subqueries and the common table expressions of `WITH`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY` (by expression, alias or position), `LIMIT` and `OFFSET`; the operators `AND OR NOT = <> < <= > >= + - * / % ||`, `IS [NOT] NULL`, `[NOT] BETWEEN`, `[NOT] IN` of a list and of a query, `[NOT] LIKE`, `EXISTS`, scalar subqueries (correlated ones too), `CASE`, `CAST`, and the parameters `?` and `$n`; the functions `count sum avg min max group_concat lower upper length substr coalesce nullif abs instr replace typeof text_of line_of`, where `text_of(node)` is the source text of a node and `line_of(offset)` the line, from 1, of an offset; and logic that is three-valued, with null where a value is not known.
- **FR-006**: What `astsql` does not have (set operations, window functions, recursion, data changes, a table or function that does not exist) MUST be an `err` value that names it.

## Diagnostics and observability

- **FR-007**: `diagnostics()` MUST give the errors of the lexer and of the parser (rule `parse` or `lex`, severity `error`) and the rows of every rule; a rule is a code, a severity, a message and a query that gives a `node` column, so that the rules are data written in the same SQL; the built-in rules MUST be `delete-without-where`, `update-without-where`, `select-star`, `join-without-condition`, `unused-cte`, `deep-nesting` (a query nested in four others) and `too-many-joins` (more than seven in a statement), and `addRule` MUST add one, an `err` value where its query does not run or has no `node` column.
- **FR-008**: The fingerprint of a statement MUST be the same for two statements that differ only in their literals and in their layout and comments, and MUST differ for two that differ in shape; `read_only` MUST be true for a query and for nothing else.

## Out of scope

- Rules that need names resolved (aide, 0010-aide), and the evaluation of a statement against data.

## Edge cases

- Text that does not parse: its statement is in `statement` with the kind `unparsed`, its errors in `diagnostic`, and the rest is read, per FR-001 and FR-007.
- A query over `node` for a script of no statements: no rows, per FR-001.

## Assumptions

- The relations are the tree as it is today: a new kind of node is a new value of `kind` and needs no new relation.
- The engine is behind the interface `Engine` and can move out of the core to a utility with no change to the API.

## Open questions

- None.

## Key entities

- **Relation** - a table made from a parse.
- **Rule** - a query, held as data, that finds nodes that deserve a diagnostic.
- **Fingerprint** - the shape of a statement with its literals taken out.

## Success criteria

- **SC-001**: A question about a tree, its comments, its errors or its dialect is one SQL query.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
