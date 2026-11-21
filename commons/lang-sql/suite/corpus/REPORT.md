# SQL test corpora

Output root: /tmp/claude-0/corpora/  (layout `<source>/<dialect>/<name>.sql`, `PROVENANCE.tsv`, `LICENSES/<source>.txt`).
Total .sql bytes: 7741203 (cap 9,000,000; every file <= 550 KB; no statement > 20 KB; every file UTF-8, ends with newline, no NUL).
Tools (re-runnable, deterministic): /tmp/claude-0/corpora-tools/ (`sqlsplit.py` = quote/comment/dollar-quote-aware splitter, `ex_*.py` extractors, `finalize.py`).
Clones: /tmp/claude-0/corpora-src/ (sparse, depth 1). sqlglot was read in place at /home/user/tobymao/sqlglot (not modified).

## Sources included (license file actually read)
| source | repo @ commit | license file read | SPDX |
|---|---|---|---|
| sqlglot | tobymao/sqlglot @ b812ff95 | LICENSE ("MIT License") | MIT |
| postgres_regress | postgres/postgres @ 207b5293 | COPYRIGHT ("Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee...") | PostgreSQL |
| sqllogictest | gregrahn/sqllogictest @ c93ac416 | COPYRIGHT.md (see doubt 1) | CC0-1.0 OR MIT OR BSD (author's choice offer) |
| duckdb | duckdb/duckdb @ 87d96b77 | LICENSE (MIT text) | MIT |
| clickhouse | ClickHouse/ClickHouse @ 2a2f5746 | LICENSE (Apache License 2.0) | Apache-2.0 |
| spark | apache/spark @ 03a2b318 | LICENSE (Apache License 2.0) | Apache-2.0 |
| starrocks | StarRocks/starrocks @ 576d9cf7 | LICENSE.txt (Apache License) | Apache-2.0 |
| calcite | apache/calcite @ 647e8f28 | LICENSE (Apache License 2.0) | Apache-2.0 |

Full SHAs are in PROVENANCE.tsv. License texts are in LICENSES/<source>.txt.

## Excluded / skipped
- antlr/grammars-v4: cloned and inspected; the repository tree has NO LICENSE file at the root nor in any sql/<grammar>/ directory (only unrelated grammars such as css3, elixir, awk have one). With no license file to read, EXCLUDED as unclear per rule 1. Nothing taken from it. (Individual grammar headers may carry notices, but these were not treated as a LICENSE file.)
- sqlglot tests/fixtures/partial.sql: deliberately incomplete fragments, not statements: skipped. DAX/Tableau/PRQL tests: not SQL dialects, skipped. test_pipe_syntax.py: has no class dialect, only dict-keyed values extracted.
- trinodb/trino, prestodb/presto, apache/doris regression suites (Groovy), snowflake examples: not attempted (time/size budget; Doris suites are Groovy; Trino/Presto tests are Java strings).
- duckdb: test/sql subdirs error, peg_parser, serialization, storage_version, extensions, secrets, logging, outofcore excluded (error/negative or non-SQL-surface heavy).
- No source for dialects: dune (sqlglot test strings for it were all fragments), and none of the other listed dialects not in the table below (e.g. athena only via sqlglot).

## Extraction rules
- sqlglot: Python `ast` over tests/dialects/test_*.py. Per class `dialect = "..."`. Taken: validate_identity arg 0 and write_sql (arg 1; also valid in class dialect); validate_all arg 0 (class dialect; NOT for test_dialect.py, whose class dialect is sqlglot's permissive base dialect, so only its read/write dict values are used); values of read={"d": sql} and write={"d": sql} labelled by key d (spark2->spark). Keys not in the allowed dialect list (e.g. "" , tableau, dax) dropped. Strings are split with the splitter; only pieces starting with a statement keyword (SELECT, WITH, INSERT, CREATE, ... see `looks_like_stmt`) are kept, because most sqlglot test strings are expression fragments (`CAST(...)`, `a + b`); 6,543 fragments were dropped. Dedup per dialect. NOTE: a validate_all first arg with a `read=` entry for the same dialect is still included (it is the class dialect SQL).
- sqlglot fixtures: identity.sql (ansi, all), pretty.sql (ansi, inputs and pretty outputs), optimizer/*.sql and tpc-h/tpc-ds (first statement of each blank-line-separated case = the input; outputs skipped; `# dialect:` header -> first listed dialect, else ansi).
- postgres: files from the requested list (all present); lines starting with backslash removed, `COPY..FROM stdin` data up to `\.` removed, trailing `\gset/\g...` converted to `;`; statements using psql `:var` interpolation dropped (298); dollar quotes handled.
- sqllogictest / duckdb: `statement ok|maybe|count` and `query` blocks only (`statement error` dropped, results dropped, `#` comment lines dropped, loop/`${}`/`{var}` templated statements dropped). Water-filling sample across groups (every k-th statement of each group; k recorded per file in PROVENANCE `how`). sqllogictest evidence/ -> sqlite, everything else ansi.
- clickhouse: tests/queries/0_stateless/*.sql only (jinja files skipped, 18); `-- Tags:` and `-- { ... }` directive comments removed; statements annotated serverError/clientError dropped; every 27th of the unique statements.
- spark: all sql-tests/inputs/**/*.sql (incl. ansi/, postgreSQL/, udf/ labelled spark); `--SET/--IMPORT/--CONFIG_DIM/...` lines removed; `--QUERY-DELIMITER-START/END` blocks kept as one statement; every 3rd unique statement.
- starrocks: test/sql/*/T/* (inputs only) -> every 8th unique statement. calcite: core/src/test/resources/sql/*.iq, statements followed by `!ok/!plan` (not `!error`), label ansi (Calcite dialect), every 2nd unique statement.
- Splitter: quote ('..', "..", `..`), backslash-escape dialects (mysql, bigquery, clickhouse, hive, spark, ...), E'..' in postgres, `--`, `/* */` (nested for postgres/duckdb), `#` comments for mysql family, dollar quotes ($$ / $tag$), DELIMITER (mysql family), GO (tsql) and `/` lines (oracle), PL/SQL and T-SQL blocks kept whole. Statements end with ';' (on its own line if the last line is a `--` comment). A statement may contain internal blank lines.

## Caveats / doubts
1. sqllogictest COPYRIGHT.md says: "As far as the author is concerned, you can redistribute it and/or modify the code as you see fit. No attribution is required. Use whichever of the following license terms best applies to your situation. 1. GNU General Public License 2. BSD License 3. MIT License 4. CC0 License". The file lists the options but does not give their texts; we take the BSD/MIT/CC0 option. Moderately clear but not a standard SPDX file.
2. Test corpora of permissive projects may embed third-party material (e.g. TPC-H/TPC-DS query texts in duckdb, calcite, sqlglot; PostgreSQL-derived tests in spark's postgreSQL/ dir and duckdb). Spark's postgreSQL/ files derive from PostgreSQL regression tests (PostgreSQL License, permissive).
3. The corpora are test inputs: postgres regress, duckdb, clickhouse, spark and starrocks include some statements that are intentionally invalid or only valid in a particular session setup (negative tests not annotated as errors, e.g. postgres regress error cases). sqlglot strings are mostly parseable by sqlglot, but may use syntax only valid in the stated dialect. Calcite `.iq` and sqlglot `ansi` statements are not strictly ANSI.
4. Dialect labels for sqlglot optimizer fixtures with multi-dialect headers use the first listed dialect.

## Totals
| source | statements | bytes |
|---|---:|---:|
| calcite | 1505 | 202432 |
| clickhouse | 8616 | 1160321 |
| duckdb | 19082 | 1423719 |
| postgres_regress | 13125 | 1221391 |
| spark | 6196 | 878822 |
| sqlglot | 11176 | 997095 |
| sqllogictest | 12450 | 1381121 |
| starrocks | 2947 | 476302 |

| dialect | statements | bytes |
|---|---:|---:|
| ansi | 14717 | 1907568 |
| athena | 67 | 4331 |
| bigquery | 838 | 63052 |
| clickhouse | 9122 | 1196033 |
| databricks | 337 | 19929 |
| doris | 85 | 5114 |
| dremio | 39 | 1845 |
| drill | 19 | 969 |
| druid | 10 | 352 |
| duckdb | 20564 | 1531504 |
| exasol | 122 | 6957 |
| fabric | 9 | 363 |
| hive | 213 | 13683 |
| materialize | 30 | 1315 |
| mysql | 702 | 39964 |
| oracle | 317 | 24607 |
| postgres | 13974 | 1278183 |
| presto | 261 | 22175 |
| redshift | 250 | 15981 |
| risingwave | 16 | 1087 |
| singlestore | 223 | 9247 |
| snowflake | 1662 | 103660 |
| solr | 2 | 76 |
| spark | 6788 | 917467 |
| sqlite | 727 | 28990 |
| starrocks | 3125 | 488105 |
| teradata | 148 | 7760 |
| trino | 259 | 17202 |
| tsql | 471 | 33684 |

| source/dialect | statements | bytes |
|---|---:|---:|
| calcite/ansi | 1505 | 202432 |
| clickhouse/clickhouse | 8616 | 1160321 |
| duckdb/duckdb | 19082 | 1423719 |
| postgres_regress/postgres | 13125 | 1221391 |
| spark/spark | 6196 | 878822 |
| sqlglot/ansi | 1142 | 336600 |
| sqlglot/athena | 67 | 4331 |
| sqlglot/bigquery | 838 | 63052 |
| sqlglot/clickhouse | 506 | 35712 |
| sqlglot/databricks | 337 | 19929 |
| sqlglot/doris | 85 | 5114 |
| sqlglot/dremio | 39 | 1845 |
| sqlglot/drill | 19 | 969 |
| sqlglot/druid | 10 | 352 |
| sqlglot/duckdb | 1482 | 107785 |
| sqlglot/exasol | 122 | 6957 |
| sqlglot/fabric | 9 | 363 |
| sqlglot/hive | 213 | 13683 |
| sqlglot/materialize | 30 | 1315 |
| sqlglot/mysql | 702 | 39964 |
| sqlglot/oracle | 317 | 24607 |
| sqlglot/postgres | 849 | 56792 |
| sqlglot/presto | 261 | 22175 |
| sqlglot/redshift | 250 | 15981 |
| sqlglot/risingwave | 16 | 1087 |
| sqlglot/singlestore | 223 | 9247 |
| sqlglot/snowflake | 1662 | 103660 |
| sqlglot/solr | 2 | 76 |
| sqlglot/spark | 592 | 38645 |
| sqlglot/sqlite | 347 | 16405 |
| sqlglot/starrocks | 178 | 11803 |
| sqlglot/teradata | 148 | 7760 |
| sqlglot/trino | 259 | 17202 |
| sqlglot/tsql | 471 | 33684 |
| sqllogictest/ansi | 12070 | 1368536 |
| sqllogictest/sqlite | 380 | 12585 |
| starrocks/starrocks | 2947 | 476302 |

