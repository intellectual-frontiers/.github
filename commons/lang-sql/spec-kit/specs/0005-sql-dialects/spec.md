# Feature Specification: The dialects of the SQL language core, and their conformance

**Spec ID:** 0005-sql-dialects
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The core reads three dialects. sqlglot, the library this one is learned from, reads thirty-three. This feature adds the other SQL dialects as extensions of the core, each saying how it is written (its comments, quoting, strings, parameters, numbers and operators) and what its grammar adds, from the facts of sqlglot's tokenizers and the documentation of each engine, and it adds the testing that says how well all of them read real SQL: corpora of statements taken from open-source test suites, run through each dialect's lexer and parser, with the number that are read held by a ratchet that only rises.

## The dialects

- **FR-001**: The library MUST have, each as `dialects/<name>/mod.ts` that exports `dialect` and is an export of the package, the dialects `athena`, `bigquery`, `clickhouse`, `databricks`, `doris`, `dremio`, `drill`, `druid`, `duckdb`, `dune`, `exasol`, `fabric`, `hive`, `materialize`, `mysql`, `oracle`, `postgres`, `presto`, `redshift`, `risingwave`, `singlestore`, `snowflake`, `solr`, `spark`, `spark2`, `sqlite`, `starrocks`, `teradata`, `trino` and `tsql`; a dialect that another extends (`starrocks`, `doris` and `singlestore` on `mysql`; `redshift`, `materialize` and `risingwave` on `postgres`; `spark2` on `hive`, `spark` on `spark2`, `databricks` on `spark`; `trino` on `presto`, `athena` and `dune` on `trino`; `fabric` on `tsql`) MUST import that dialect and no other of its siblings, and every other extends `ansi`.
- **FR-002**: Each dialect's lexical MUST say its comments (the markers, whether block comments nest, whether `--` needs a space, hints and conditional comments), its quoted identifiers, its strings (their quotes, their escapes, the prefixes and the dollar quotes), its parameters and its operators, as the facts of its engine are: a table of these facts, one row for each dialect, MUST be tested against the dialect's lexer.
- **FR-003**: The lexer MUST read number suffixes where a dialect lists them (`1L`, `1.5BD` in Hive), Oracle's alternative quoting (`q'[...]'`, `q'!...!'`) where a dialect has it, and words that begin with a character the dialect names (`#temp` in Transact-SQL); a lexical that names a suffix that is not letters or a start character that is not ASCII, a letter or a digit MUST be an error value.
- **FR-004**: Each dialect's grammar MUST name what it adds to the common ground: the cast operator, the like-words, and the operators with their binding powers, as its engine documents them; a dialect with nothing to add keeps its parent's.
- **FR-005**: The library does not make a dialect of what is not SQL: DAX, PRQL and Tableau's calculations, which sqlglot reads as dialects, MUST NOT be among them, and the reason MUST be in the documentation of the folder.

## The corpora

- **FR-006**: The statements of open-source test suites MUST be kept as files under `suite/corpus/<source>/<dialect>/<name>.sql`, each statement ended by `;`, and each file MUST have a row in `suite/corpus/PROVENANCE.tsv` that names the repository, the commit, the paths, the license (an identifier of SPDX, read from the repository's own license file and kept in `suite/corpus/LICENSES/`), the number of statements and how they were chosen; a source that is not under a permissive license (MIT, BSD, Apache-2.0, ISC, the PostgreSQL License, public domain) MUST NOT be included, and what is included MUST be in the register of third-party files of this repository.
- **FR-007**: For every statement of every corpus, read in the dialect of its folder, the lexer and the parser MUST NOT throw, every character MUST be in a token, a comment or white space, the ranges of the tree MUST nest, every comment MUST be attached once, the projection to `unist` MUST give a tree, a rewrite with no rules MUST give back its input, and the result MUST be the same on a second run.
- **FR-008**: The number of statements of each corpus file that are read with no error MUST be kept in `suite/corpus/baseline.tsv` with the number that the lexer had an error in, and a test MUST fail where the first number is lower or the second is higher than the baseline's, so that no change makes a dialect read less of what it read; `bun tools/conformance.ts --write` MUST write the baseline from the corpora, and `bun tools/conformance.ts` MUST print, for each dialect, the statements, the share read, the share the lexer found an error in, and the most common errors of the parser.
- **FR-009**: Every dialect MUST be read in a corpus of its own (a source for that dialect, or the statements of a source written for it) except where no open-source suite under a permissive license is found, and the exceptions MUST be listed in `suite/corpus/PROVENANCE.tsv`.

## The grammar the corpora asked for

- **FR-010**: A statement that begins with a command word (`SET`, `SHOW`, `EXPLAIN`, `DESCRIBE`, `DESC`, `ANALYZE`, `GRANT`, `REVOKE`, `USE`, `PRAGMA`, `BEGIN`, `START`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `RELEASE`, `TRUNCATE`, `COPY`, `VACUUM`, `CALL`, `EXEC`, `EXECUTE`, `DECLARE`, `IF`, `WHILE`, `LOAD`, `ATTACH`, `DETACH`, `INSTALL`, `EXPORT`, `IMPORT`, `COMMENT`, `LOCK`, `UNLOCK`, `REFRESH`, `REINDEX`, `CLUSTER`, `CHECKPOINT`, `RESET`, `DISCARD`, `DO`, `LISTEN`, `NOTIFY`, `PREPARE`, `DEALLOCATE`, `FETCH`, `OPTIMIZE`, `MERGE`, `UNSET`, `UNDROP`, `RENAME`, `OPTIMIZE`, `SYSTEM`), and a `CREATE`, `ALTER` or `DROP` of an object that the grammar does not read (a sequence, a function, a type, a schema, a trigger and the rest), MUST be a node `command` with its keyword and, for those three, its object, both upper case, and the text of the statement after them as written; it holds no node; it MUST be a statement and never an error; and `readOnlyProblem` MUST say that it holds a command.
- **FR-011**: `CREATE TABLE` MUST be read with `AS query` (a table made from a query), with no column list, and with text after the column list or the name that the parser does not read (an engine, partitions, options): the node holds the query where there is one and that text as `options`, as written.
- **FR-012**: An array MUST be read as `[a, b]` and `ARRAY[a, b]`, and a subscript as `x[i]` (a node `subscript`), where `[` is not the opening of a quoted identifier in the dialect; a subscript binds as tightly as `::`.
- **FR-013**: `VALUES (...), (...)` MUST be read as a source, with an alias and a column list, as it is read as a subquery in parentheses.
- **FR-014**: A dialect's grammar MAY name word operators, operators that are keywords (MySQL's `DIV`, `MOD` and `XOR`), with their binding powers, and a grammar that names a word its lexical does not have as a keyword MUST be an error value.
- **FR-015**: `COLLATE name` MUST be read after an expression (a node `collate`) and after a data type (in the type's `collation`).

## The grammar of the standard and of PostgreSQL and SQLite

- **FR-016**: A select MUST be read with `DISTINCT ON (...)`, `GROUP BY ALL`, a `GROUP BY` of the empty grouping `()` and of `GROUPING SETS (...)` (a call of that name), a `WINDOW` clause (nodes `window-def`) and `QUALIFY`; the frame of a window MUST be read with its `EXCLUDE` (`NO OTHERS`, `CURRENT ROW`, `GROUP`, `TIES`); and `QUALIFY` MUST stay a name where nothing but the end of an item follows it.
- **FR-017**: A call MUST be read with an `ORDER BY` among its arguments (`string_agg(x, ',' ORDER BY y)`), with `WITHIN GROUP (ORDER BY ...)`, and with a query as an argument (`ANY (SELECT ...)`, `array(SELECT ...)`), which is a scalar query node.
- **FR-018**: `TRY_CAST` and `SAFE_CAST` MUST be a cast that says it gives `NULL` on failure, `CAST(x AS type FORMAT 'f')` MUST keep its format as an expression, and a parenthesized join or source MUST be read where it follows `(` and begins with a query in parentheses (`((SELECT 1) JOIN t)`), and MUST keep its alias (`(a JOIN b ON c) AS t`) on the join.

- **FR-019**: An expression MUST be read with: a field of a row (`(r).c`, `(r).*`), a slice of an array (`a[1:3]`, `a[:2]`, `a[1:]`), a typed literal (`DATE '2020-01-01'`, `int2 '2'`, `timestamp without time zone '...'`), an interval with a range of units (`INTERVAL '1 2' DAY TO SECOND(2)`), the keyword arguments of the standard's functions (`TRIM(BOTH 'x' FROM y)`, `SUBSTRING(x FROM a FOR b)`, `SUBSTRING(x SIMILAR p ESCAPE e)`, `POSITION(a IN b)`, `OVERLAY(x PLACING y FROM a)`, `VARIADIC x`) as nodes `keyword-arg`, `IGNORE NULLS` and `RESPECT NULLS` after a call, `SIMILAR TO`, `x NOT NULL`, `x IS y` (as a test of distinctness), the empty list `IN ()` and a table after `IN` (`x IN t`), `DEFAULT` where a value is, and a star with its `EXCEPT`, `EXCLUDE`, `REPLACE` and `RENAME` (nodes `star-modifier`).
- **FR-020**: A dialect whose grammar says `operatorRuns` (PostgreSQL) MUST read a run of operator characters that it does not list as one `operator` node with the binding power of the other operators, and one before its operand (`@ x`, `|/ x`) as an `operator` node with no left operand; a run MUST NOT end in `+` or `-` unless it holds one of `~ ! @ # % ^ & | ?`.
- **FR-021**: A data change MUST be read with `INSERT OR REPLACE|IGNORE|ABORT|FAIL|ROLLBACK`, `REPLACE INTO`, an alias of the table, columns that are parts of columns (`a[1]`, `r.f`), `ON CONFLICT [(target) | ON CONSTRAINT name] [WHERE] DO NOTHING | DO UPDATE SET ... [WHERE]` (a node `on-conflict`); an `UPDATE` with targets that are parts of columns and rows of columns (`SET (a, b) = (...)`); a `DELETE` with `USING`; a `WITH` and a common table expression whose body is an `INSERT`, `UPDATE` or `DELETE`, with `MATERIALIZED` or `NOT MATERIALIZED`, and with `SEARCH` and `CYCLE` clauses kept as text.
- **FR-022**: A definition MUST be read with `CREATE TABLE` with no columns, with `LIKE other [options]` among its elements, with column options the grammar does not know kept as text (`AUTOINCREMENT`, `GENERATED ... AS IDENTITY | (expr) STORED`, `NO INHERIT`) and a `NOT NULL` among its table constraints; a check with `NO INHERIT` or `NOT VALID` kept as text; a reference with `MATCH`, `DEFERRABLE` and `INITIALLY` kept as text; `CREATE INDEX` with `USING method`, an operator class after a column and the options after the columns kept as text; `CREATE VIEW` with `WITH (options)` and `WITH CHECK OPTION`; `ALTER TABLE ... ADD ... NOT VALID` and `DROP COLUMN ... CASCADE`; a column list with types (`AS t (a int, b text)`).
- **FR-023**: A query MUST be read with `LIMIT offset, count`, a table followed by `NOT INDEXED` or `INDEXED BY i` kept as text, `WITH ORDINALITY` after a table function, `LEFT SEMI JOIN` and `LEFT ANTI JOIN`, a join whose right side is a join with its own `ON` (`a JOIN b JOIN c ON x ON y`) and whose `USING` list has an alias, the locking clauses (`FOR UPDATE OF t NOWAIT`, `FOR SHARE SKIP LOCKED`) kept as text on the select or set operation, `x AT TIME ZONE z`, `CREATE INDEX [CONCURRENTLY] ... ON [ONLY]` and `DROP INDEX CONCURRENTLY`, and, where its grammar says `emptySelect` (PostgreSQL), a select with no items.

- **FR-024**: A dialect's `Grammar` MUST be able to switch on, for the dialects that have them: a query that begins with `FROM` (`fromFirst`: DuckDB, Hive and so Spark), lambdas `x -> body`, `(x, y) -> body` and `lambda x: body` (`lambdas`), paths `x:a.b` (`colonPaths`), indexes among the elements of `CREATE TABLE` (`tableIndexes`), the words that begin the tail of a query (`queryTail`: `SETTINGS` and `FORMAT` of ClickHouse), parametric calls `f(p)(x)` (`parametric`) and `SELECT TOP n` (`selectTop`); a dialect that does not switch one on MUST read the text as it did before.
- **FR-025**: Struct and map literals (`{'a': 1}`, `map{1: 'x'}`), types with fields (`STRUCT(a INT)`, `ARRAY<INT>`, `MAP<K, V>`, `ARRAY<ARRAY<INT>>`), `ORDER BY ALL`, `CAST(x, 'Type')`, `BY NAME` after a set operator and after `INSERT INTO t`, `ON DUPLICATE KEY UPDATE`, `INSERT OVERWRITE [TABLE] t PARTITION (...)`, `CROSS APPLY` and `OUTER APPLY`, `TABLE(f(...))` as a source, `PIVOT`, `UNPIVOT`, `MATCH_RECOGNIZE` and `LATERAL VIEW` after a source (a node `table-op`, kept as text), table hints (`WITH (NOLOCK)`, `FORCE INDEX (i)`, `FOR SYSTEM_TIME AS OF x`), `CHARACTER SET` in a type, `IGNORE NULLS` and `AS name` among the arguments of a call, and `INTERVAL (expr) UNIT` MUST be read.
- **FR-026**: A statement of the StarRocks corpus that holds a template variable of its test runner (`${...}`) is not SQL and MUST NOT be in the corpus; the provenance MUST say so where one was removed. (`${var}` in Spark and Hive is SQL and stays.)

## Out of scope

- Reading everything each engine accepts: the grammar of each dialect beyond the common ground grows as the corpora ask, one feature at a time, each with its specification.
- Procedural code (the bodies of functions and procedures), `MERGE`, `PIVOT`, `QUALIFY`, `CONNECT BY` and the syntax of one engine that its corpus shows and this specification does not list.
- Executing any statement of a corpus.

## Edge cases

- `1L` in Hive is one number token; in PostgreSQL it is a number and a word, per FR-003.
- `q'[it's]'` in Oracle is one string whose value is `it's`; in PostgreSQL `q` is a word, per FR-003.
- `#temp` in Transact-SQL is one word; in MySQL `#temp` is a comment, per FR-002.
- A corpus statement that is not valid in its dialect (the corpus is the suite's, and some of its statements are written to fail): an error value, and counted, never a crash, per FR-007 and FR-008.

## Assumptions

- The facts of a dialect's lexical come from sqlglot's tokenizers (MIT) and are not copied as code: the settings are the engine's facts.
- A statement that a corpus gives for a dialect is read in that dialect even where another dialect's suite also contains it.
- Measured on 2026-11-21, on one cloud container, on the 67,585 statements of `suite/corpus/` with sqlglot at commit `b812ff9` (not compiled, `parse_one` with the dialect of the statement, a fallback to its `Command` counted as read): this parser reads 94.9% of them with no error and sqlglot 97.7%; in the corpora of engines that are not sqlglot's own (PostgreSQL's regression tests 99.6% against 97.5%, Spark 96.1% against 97.8%, StarRocks 93.7% against 94.7%, DuckDB 94.6% against 97.3%, ClickHouse 87.2% against 94.4%, sqllogictest 100% against 100%) the two are closer than in the corpora that sqlglot's own tests make (88.5% against 99.8%), which sqlglot was built to pass. ANSI is read at 99.5%, PostgreSQL at 99.3% and SQLite at 98.9%; the dialects furthest behind are Hive (66.2%), Materialize (66.7%), Oracle (70.7%), BigQuery (70.0%) and Teradata (75.7%). A statement kept as a `command` node counts as read in both; counting only statements read into a tree, this parser reads 81.4% and sqlglot 91.5%. The speed on the 4 MB corpus of `suite/corpus.sql` is about 74 MB/s for lexing against sqlglot's 1.4 and about 25 MB/s for parsing with the comments attached against 0.57. One machine and one corpus: numbers to be judged against, not claims about sqlglot's compiled build.

## Open questions

- **OQ-1**: What the grammar of each dialect should add first: the errors the corpora give, counted by `bun tools/conformance.ts`, are the list.

## Key entities

- **Corpus** - the statements of one open-source suite for one dialect, with their provenance.
- **Baseline** - the number of statements each corpus file reads, which only rises.

## Success criteria

- **SC-001**: All thirty dialects lex and parse without a crash every statement of every corpus, and the share each reads is measured and cannot fall.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
