# Feature Specification: The dialects of the SQL language core, and their conformance

**Spec ID:** 0069-sql-dialects
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** The core reads three dialects. sqlglot, the library this one is learned from, reads thirty-three. This feature adds the other SQL dialects as extensions of the core, each saying how it is written (its comments, quoting, strings, parameters, numbers and operators) and what its grammar adds, from the facts of sqlglot's tokenizers and the documentation of each engine, and it adds the testing that says how well all of them read real SQL: corpora of statements taken from open-source test suites, run through each dialect's lexer and parser, with the number that are read held by a ratchet that only rises.

## The dialects

- **FR-001**: The library MUST have, each as `sql/lang/dialects/<name>/mod.ts` that exports `dialect` and is an export of the package, the dialects `athena`, `bigquery`, `clickhouse`, `databricks`, `doris`, `dremio`, `drill`, `druid`, `duckdb`, `dune`, `exasol`, `fabric`, `hive`, `materialize`, `mysql`, `oracle`, `postgres`, `presto`, `redshift`, `risingwave`, `singlestore`, `snowflake`, `solr`, `spark`, `spark2`, `sqlite`, `starrocks`, `teradata`, `trino` and `tsql`; a dialect that another extends (`starrocks`, `doris` and `singlestore` on `mysql`; `redshift`, `materialize` and `risingwave` on `postgres`; `spark2` on `hive`, `spark` on `spark2`, `databricks` on `spark`; `trino` on `presto`, `athena` and `dune` on `trino`; `fabric` on `tsql`) MUST import that dialect and no other of its siblings, and every other extends `ansi`.
- **FR-002**: Each dialect's lexical MUST say its comments (the markers, whether block comments nest, whether `--` needs a space, hints and conditional comments), its quoted identifiers, its strings (their quotes, their escapes, the prefixes and the dollar quotes), its parameters and its operators, as the facts of its engine are: a table of these facts, one row for each dialect, MUST be tested against the dialect's lexer.
- **FR-003**: The lexer MUST read number suffixes where a dialect lists them (`1L`, `1.5BD` in Hive), Oracle's alternative quoting (`q'[...]'`, `q'!...!'`) where a dialect has it, and words that begin with a character the dialect names (`#temp` in Transact-SQL); a lexical that names a suffix that is not letters or a start character that is not ASCII, a letter or a digit MUST be an error value.
- **FR-004**: Each dialect's grammar MUST name what it adds to the common ground: the cast operator, the like-words, and the operators with their binding powers, as its engine documents them; a dialect with nothing to add keeps its parent's.
- **FR-005**: The library does not make a dialect of what is not SQL: DAX, PRQL and Tableau's calculations, which sqlglot reads as dialects, MUST NOT be among them, and the reason MUST be in the documentation of the folder.

## The corpora

- **FR-006**: The statements of open-source test suites MUST be kept as files under `suite/corpus/<source>/<dialect>/<name>.sql`, each statement ended by `;`, and each file MUST have a row in `suite/corpus/PROVENANCE.tsv` that names the repository, the commit, the paths, the license (an identifier of SPDX, read from the repository's own license file and kept in `suite/corpus/LICENSES/`), the number of statements and how they were chosen; a source that is not under a permissive license (MIT, BSD, Apache-2.0, ISC, the PostgreSQL License, public domain) MUST NOT be included, and what is included MUST be in the register of third-party files of this repository.
- **FR-007**: For every statement of every corpus, read in the dialect of its folder, the lexer and the parser MUST NOT throw, every character MUST be in a token, a comment or white space, the ranges of the tree MUST nest, every comment MUST be attached once, the projection to `unist` MUST give a tree, a rewrite with no rules MUST give back its input, and the result MUST be the same on a second run.
- **FR-008**: The number of statements of each corpus file that are read with no error MUST be kept in `suite/corpus/baseline.tsv` with the number that the lexer had an error in, and a test MUST fail where the first number is lower or the second is higher than the baseline's, so that no change makes a dialect read less of what it read; `bun tools/conformance-lang.ts --write` MUST write the baseline from the corpora, and `bun tools/conformance-lang.ts` MUST print, for each dialect, the statements, the share read, the share the lexer found an error in, and the most common errors of the parser.
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

## Open questions

- **OQ-1**: What the grammar of each dialect should add first: the errors the corpora give, counted by `bun tools/conformance-lang.ts`, are the list.

## Key entities

- **Corpus** - the statements of one open-source suite for one dialect, with their provenance.
- **Baseline** - the number of statements each corpus file reads, which only rises.

## Success criteria

- **SC-001**: All thirty dialects lex and parse without a crash every statement of every corpus, and the share each reads is measured and cannot fall.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
