prepare v1 as select $2::int;

prepare v2 as select $1::int;

prepare v3 as select $1::int where 1=0;

execute v3(1);

CREATE TABLE t1(c0 INT2);

INSERT INTO t1 VALUES (1), (2), (3), (5), (7), (10), (20);

PREPARE prepare_query AS SELECT (? NOT IN (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?));

EXECUTE prepare_query(-675986880, 1);

PREPARE q1 AS SELECT (? NOT IN (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?)) AND
                    (? IN (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?));

EXECUTE q1(10, 1, 20, 3);

PREPARE q2 AS SELECT ? IN (
  SELECT t1.c0
  FROM t1
  WHERE t1.c0 IN (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?)
    AND t1.c0 > ?
  ORDER BY t1.c0
  LIMIT ?
);

EXECUTE q2(7, 5, 3, 2);

PREPARE q3 AS SELECT ? = ANY (
  SELECT t1.c0
  FROM t1
  WHERE t1.c0 = ALL (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?)
  ORDER BY t1.c0
  LIMIT ?
);

EXECUTE q3(1, 1, 2);

PREPARE q4 AS SELECT (? NOT IN (
  SELECT t1.c0
  FROM t1
  WHERE t1.c0 < ?
  ORDER BY t1.c0
  LIMIT ?
));

EXECUTE q4(10, 5, 2);

PREPARE q5 AS SELECT ? IN (
  (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?)
  UNION ALL
  (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?)
);

EXECUTE q5(2, 2, 4);

PREPARE q7 AS SELECT ? = (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?);

EXECUTE q7(1, 1);

PREPARE q8 AS SELECT
  (SELECT MAX(c0) FROM (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?) s1) AS a,
  ? AS b,
  (SELECT MAX(c0) FROM (SELECT t1.c0 FROM t1 ORDER BY t1.c0 LIMIT ?) s2) AS c;

EXECUTE q8(1, 10, 3);

PREPARE s1 AS SELECT CAST(? AS INTEGER), CAST(? AS STRING);

EXECUTE s1(42, 'dpfkg');

DEALLOCATE s1;

PREPARE s1 AS SELECT CAST(?1 AS INTEGER), CAST(?2 AS STRING);

PREPARE s1 AS SELECT CAST(?2 AS INTEGER), CAST(?1 AS STRING);

EXECUTE s1('dpfkg', 42);

CREATE TABLE t(a INTEGER);

EXECUTE p;

DROP TABLE t;

DEALLOCATE p;

PREPARE p AS SELECT name, type FROM pragma_table_info('t');

CREATE TABLE t(zzz VARCHAR, q DOUBLE);

execute q1 (42);

PREPARE q2 AS
	COPY (
		select 42 as 'col'
	) to $1 (
		FORMAT csv
	);

CREATE TABLE t (a INTEGER, b INTEGER);

INSERT INTO t VALUES (1, 2);

EXECUTE q3('|');

EXECUTE q4(false, ';');

EXECUTE q5('|');

SELECT * FROM t ORDER BY ALL;

PREPARE v1 AS SELECT ?;

EXECUTE v1(27);

EXECUTE v1('hello world');

EXECUTE v1([1, 2, 3]);

PREPARE v2 AS SELECT ?=?;

EXECUTE v2(27, 27);

EXECUTE v2('hello world', 'hello mars');

EXECUTE v2(1, 1.0);

EXECUTE v2([1, 2, 3], '[1, 2, 3]');

PREPARE v3 AS SELECT (SELECT ?);

EXECUTE v3(27);

EXECUTE v3('hello world');

EXECUTE v3([1, 2, 3]);

PREPARE v4 AS SELECT ? IS NULL;

EXECUTE v4(27);

EXECUTE v4('hello world');

EXECUTE v4(NULL);

PREPARE v5 AS SELECT ? IN (?, ?);

EXECUTE v5(27, 27, 28);

EXECUTE v5('hello world', 'hello', 'world');

EXECUTE v5(NULL, 27, 28);

PREPARE v6 AS SELECT COUNT(?);

EXECUTE v6(27);

EXECUTE v6('hello world');

EXECUTE v6(NULL);

PREPARE v7 AS SELECT printf('%s: %d', ?, ?);

EXECUTE v7('time', 27);

PREPARE v8 AS SELECT [?];

EXECUTE v8(27);

EXECUTE v8('hello world');

EXECUTE v8(NULL);

PREPARE v9 AS SELECT [?, NULL];

EXECUTE v9(27);

EXECUTE v9('hello world');

EXECUTE v9(NULL);

PREPARE v10 AS SELECT {'x': ?};

EXECUTE v10(27);

EXECUTE v10('hello world');

EXECUTE v10(NULL);

PREPARE v11 AS SELECT {'x': ?, 'y': NULL};

EXECUTE v11(27);

EXECUTE v11('hello world');

EXECUTE v11(NULL);

PREPARE v12 AS SELECT * FROM (VALUES (?, ?), (?, ?)) tbl(i, j);

EXECUTE v12(27, 28, 29, 30);

EXECUTE v12('hello', 'world', 'a', NULL);

PREPARE v13 AS SELECT CASE WHEN ? THEN ? ELSE ? END;

EXECUTE v13(1=1, 1, 2);

EXECUTE v13(1=0, 'hello', 'world');

PREPARE v14 AS SELECT ?+NULL;

EXECUTE v14(1);

PREPARE v15 AS SELECT ?=NULL;

EXECUTE v15(1);

PREPARE v16 AS SELECT CASE WHEN (? = 1) AND (? = 2) AND (? = 3) AND ((? IS NULL)) THEN 1.5 ELSE 2.5 END AS a;

EXECUTE v16(1, 2, 3, NULL);

EXECUTE v16(1, 2, 4, NULL);

prepare fromFirst as from (select ? fromV) select ? selectV,*;

execute fromFirst('from', 'sel');

from (select 'from' fromV) select 'sel' selectV,*;

create table test(id varchar);

prepare p as delete from test where ("id") in ((?));

execute p(null);

PREPARE v1 AS SELECT list_transform(?, lambda x: x + 1);

PREPARE v2 AS SELECT list_transform([1, 2, 3], lambda x: x + ?);

EXECUTE v2(1);

PREPARE v3 AS SELECT list_transform(?, lambda x: x + ? + ?);

EXECUTE v3([1, 2, 3], 1, 1);

PREPARE v4 AS SELECT list_filter(?, lambda x: x > 1);

EXECUTE v4([1, 2, 3]);

PREPARE v5 AS SELECT list_filter([1, 2, 3], lambda x: x > ?);

EXECUTE v5(1);

PREPARE v6 AS SELECT list_filter(?, lambda x: x > ? AND ?);

EXECUTE v6([1, 2, 3], 1, True);

PREPARE v1 AS SELECT list_aggregate(?, 'min');

EXECUTE v1(['hello', 'world']);

EXECUTE v1(NULL::INT[]);

PREPARE v2 AS SELECT array_slice(?, 1, 2);

EXECUTE v2([1, 2, 3]);

EXECUTE v2('123');

PREPARE v3 AS SELECT flatten(?);

EXECUTE v3([[1,2,3],[4,5]]);

PREPARE v4 AS SELECT list_extract(?, 2);

PREPARE q1 AS SELECT list_sort($1)[1] > 0;

EXECUTE q1([3, 1, 2]);

PREPARE q2 AS SELECT list_sort($1)[1] = 0;

EXECUTE q2([3, 1, 2]);

PREPARE q3 AS SELECT TRY(list_sort($1)[1] > 0);

EXECUTE q3([3, 1, 2]);

PREPARE q4 AS SELECT list_min(list_sort($1));

EXECUTE q4([3, 1, 2]);

PREPARE q5 AS SELECT 1 > ANY(list_sort($1));

EXECUTE q5([3, 1, 2]);

PREPARE q6 AS SELECT CASE WHEN false THEN list_sort($1) END;

EXECUTE q6([3, 1, 2]);

PREPARE q7 AS SELECT 1 = ANY(list_sort($1));

EXECUTE q7([3, 1, 2]);

PREPARE q8 AS SELECT list_sort($1)[1];

EXECUTE q8([3, 1, 2]);

EXECUTE q8(['b', 'a']);

EXECUTE q8([3.5, 1.5]);

PREPARE q9 AS SELECT list_reverse_sort($1)[1] > 0;

EXECUTE q9([3, 1, 2]);

PREPARE q10 AS SELECT list_sort($1, 'DESC')[1] > 0;

EXECUTE q10([3, 1, 2]);

PREPARE q11 AS SELECT list_grade_up($1)[1] > 0;

EXECUTE q11([3, 1, 2]);

PREPARE q12 AS SELECT list_grade_up($1);

EXECUTE q12([3, 1, 2]);

PREPARE q12b AS SELECT list_grade_up($1, 'DESC');

EXECUTE q12b([3, 1, 2]);

PREPARE q12c AS SELECT list_grade_up($1, 'DESC', 'NULLS FIRST');

EXECUTE q12c([3, NULL, 2]);

PREPARE q9b AS SELECT list_reverse_sort($1, 'NULLS LAST');

EXECUTE q9b([3, NULL, 2]);

PREPARE q16 AS SELECT list_sort($1, $2, $3), list_grade_up($1, $2, $3), list_reverse_sort($1, $3);

EXECUTE q16([3, NULL, 1], 'DESC', 'NULLS FIRST');

EXECUTE q16([3, NULL, 1], 'ASC', 'NULLS LAST');

PREPARE q15 AS SELECT array_slice($1, 1, 2)[1] > 0;

EXECUTE q15([3, 1, 2]);

PREPARE q14 AS SELECT list_filter($1, lambda x: x > 1)[1] > 0;

EXECUTE q14([3, 1, 2]);

PREPARE q17 AS SELECT list_sort($1)[1] + 1, abs(list_sort($1)[1]), list_sort($1)[1] BETWEEN 0 AND 5;

EXECUTE q17([3, 1, 2]);

PREPARE q18 AS SELECT CASE WHEN list_sort($1)[1] > 0 THEN 1 END;

EXECUTE q18([3, 1, 2]);

PREPARE q19 AS SELECT i FROM range(3) t(i) WHERE list_sort($1)[1] > i;

EXECUTE q19([3, 1, 2]);

PREPARE q20 AS SELECT list_distinct(list_sort($1))[1] > 0;

EXECUTE q20([3, 1, 2, 1]);

PREPARE q21 AS SELECT list_transform(list_sort($1), lambda x: x + 1);

EXECUTE q21([3, 1, 2]);

PREPARE q22 AS SELECT list_sum(list_sort($1)), list_aggregate(list_filter($1, lambda x: x > 1), 'min');

EXECUTE q22([3, 1, 2]);

PREPARE q23 AS SELECT cardinality($1);

EXECUTE q23([3, 1, 2]);

EXECUTE q23(MAP {1: 2});

PREPARE q24 AS SELECT struct_keys($1), struct_update($1, b := 2);

EXECUTE q24({'a': 1});

PREPARE q13 AS SELECT list_sort($1::INTEGER[])[1] > 0;

EXECUTE q13([3, 1, 2]);

EXECUTE q8(NULL);

PREPARE q25 AS SELECT list_sort([3, 1, 2], $1);

EXECUTE q25('DESC');

PREPARE q26 AS SELECT list_sort(list_distinct($1)), list_contains($1, $2);

EXECUTE q26([3, 1, 2, 1], 2);

EXECUTE q26(['b', 'a', 'b'], 'c');

PREPARE q26b AS SELECT list_contains($1, 1);

EXECUTE q26b([3, 1, 2]);

PREPARE q27 AS SELECT count($1);

EXECUTE q27(3);

PREPARE q27b AS SELECT list($1)[1];

EXECUTE q27b(3);

EXECUTE q27b('x');

PREPARE q27c AS SELECT first($1) OVER ();

EXECUTE q27c(3);

EXECUTE q27c('x');

prepare v1 as select cast(111 as short) * $1;

execute v1(1665::BIGINT);

PREPARE v1 AS SELECT $1::INT, $1::BIGINT;

EXECUTE v1(42);

PREPARE v2 AS SELECT $1::BIGINT, $1::INT;

EXECUTE v2(42);

PREPARE v3 AS SELECT $1::BIGINT, $1::UBIGINT;

EXECUTE v3(42);

PREPARE v4 AS SELECT $1::VARCHAR, $1::DATE;

EXECUTE v4('1992-01-01');

PREPARE v5 AS SELECT $1::INT, $1::BIGINT, $1::TINYINT, $1::HUGEINT, $1::SMALLINT;

EXECUTE v5(42);

PREPARE v6 AS SELECT $1::INT, $1::BIGINT, $1::TINYINT, $1::UBIGINT, $1::SMALLINT, $1::UHUGEINT;

EXECUTE v6(42);

PREPARE v7 AS SELECT CONCAT($1::TINYINT, $1);

EXECUTE v7(42);

PREPARE v8 AS SELECT * FROM (values ('body')) t(field) WHERE CASE WHEN $1 IS NULL THEN 1 ELSE field IN (SELECT * FROM (SELECT UNNEST(string_split($1, ','))) AS fsq) END;

EXECUTE v8('body');

PREPARE v9 AS SELECT UNNEST($1) UNION ALL SELECT * FROM range(1) WHERE $1::INT[]=[1];

EXECUTE v9([1]);

PREPARE p1 AS SELECT (SELECT a) FROM (SELECT ARRAY[{'a': $1}, $1]) t(a);

EXECUTE p1(NULL);

PREPARE p2 AS SELECT (SELECT a) FROM (SELECT [$1, $1]) t(a);

EXECUTE p2(5);

SET debug_verify_statement='prepared_statement';

SELECT (SELECT a) FROM (SELECT ARRAY[{'a': NULL}, NULL]) t(a);

PREPARE q AS SELECT x FROM generate_series(1, 10) t(x) OFFSET ? LIMIT ?;

EXECUTE q(3, 5);

SELECT x FROM generate_series(1, 10) t(x) OFFSET 3 LIMIT 5;

SET VARIABLE n = 10;

SELECT * FROM query('SELECT $n');

PREPARE stmt_getvariable AS SELECT * FROM query('SELECT getvariable(''n'')');

EXECUTE stmt_getvariable;

SET VARIABLE n = 20;

PREPARE stmt_outer AS SELECT $n, * FROM query('SELECT 1');

EXECUTE stmt_outer;

EXECUTE stmt_outer(n := 5);

CREATE TABLE t AS SELECT 1 AS i;

PREPARE stmt_table AS SELECT * FROM query_table('t');

EXECUTE stmt_table;

PREPARE stmt_shared AS SELECT $customer::INTEGER AS supplied, * FROM query('SELECT $customer::INTEGER AS value');

EXECUTE stmt_shared(customer := 42);

PREPARE stmt_shared_positional AS SELECT $1::INTEGER AS supplied, * FROM query('SELECT $1::INTEGER AS value');

EXECUTE stmt_shared_positional(7);

CREATE TABLE accounts AS SELECT 1 id, 'Mark' AS name;

SUMMARIZE SELECT * FROM accounts WHERE id = 1;

PREPARE query AS SUMMARIZE SELECT * FROM accounts WHERE id = $1;

EXECUTE query(1);

PREPARE query AS (SUMMARIZE SELECT * FROM accounts WHERE id = $1);

DESCRIBE SELECT * FROM accounts WHERE id = 1;

PREPARE query AS DESCRIBE SELECT * FROM accounts WHERE id = $1;

PREPARE query AS (DESCRIBE SELECT * FROM accounts WHERE id = $1);

PREPARE concat_structs AS SELECT struct_concat($1, {'b': 2}) AS s;

EXECUTE concat_structs({'a': 1});

PREPARE insert_struct AS SELECT struct_insert($1, b := $2) AS s;

EXECUTE insert_struct({'a': 1}, 'x');

PREPARE zip_lists AS SELECT list_zip($1, [10, 20]) AS z;

EXECUTE zip_lists([1, 2]);

SET VARIABLE my_var = 42;

PREPARE get_var AS SELECT getvariable($1) AS v;

EXECUTE get_var('my_var');

PREPARE v1 AS SELECT SUM(?) OVER ();

EXECUTE v1(2);

EXECUTE v1(2::HUGEINT);

EXECUTE v1(0.5);

CREATE TABLE v0 ( v2 INTEGER CHECK( v2 BETWEEN 1 AND 1119 ) , v1 INT );

INSERT INTO v0 ( v2 ) VALUES ( 10 );

PREPARE q1 AS SELECT COALESCE ( LEAD ( $1 ) OVER( ) , ( v1 ) ) > $1 FROM v0;

EXECUTE q1(1);

prepare q123 as select $param, $other_name, $param;

execute q123(param := 5, other_name := 3);

prepare q01 as select $1, ?, $2;

prepare q03 as select $aa, $bb, $cc, $dd, $ee;

PREPARE v1 AS SELECT COALESCE(COALESCE(NULL, $1) / 42::BIGINT, 0.5);

PREPARE v2 AS SELECT COALESCE(CASE WHEN FALSE THEN $1 ELSE NULL END / 42::BIGINT, 0.5);

CREATE MACRO m(x) AS x + 1;

PREPARE q AS SELECT m(10);

EXECUTE q;

CREATE OR REPLACE MACRO m(x) AS x * 100;

DROP MACRO m;

CREATE VIEW v AS SELECT 1 AS a;

PREPARE qv AS SELECT * FROM v;

EXECUTE qv;

CREATE OR REPLACE VIEW v AS SELECT 2 AS a;

CREATE TEMP MACRO t(x) AS x + 1;

PREPARE qt AS SELECT t(1);

EXECUTE qt;

CREATE OR REPLACE TEMP MACRO t(x) AS x + 50;

CREATE MACRO tm() AS TABLE SELECT 1 AS a;

PREPARE qtm AS SELECT * FROM tm();

EXECUTE qtm;

CREATE OR REPLACE MACRO tm() AS TABLE SELECT 2 AS a;

PREPARE s1 AS SELECT ?::VARCHAR FROM (SELECT ?::INTEGER) tbl(i) WHERE i > ?::INTEGER;

EXECUTE s1('hello', 2, 1);

PREPARE s2 AS
SELECT FIRST(?::VARCHAR)
FROM (VALUES (?::INTEGER)) tbl(i)
WHERE i > ?::INTEGER
GROUP BY i % ?::INTEGER
HAVING SUM(i)::VARCHAR <> ?::VARCHAR;

EXECUTE s2('hello', 2, 1, 2, 'blabla');

EXECUTE s2('hello', 2, 1, 2, '2');

PREPARE s3 AS
SELECT LENGTH(?::VARCHAR)
UNION ALL
SELECT ?::INTEGER
ORDER BY 1;

EXECUTE s3('hello', 3);

PREPARE s4 AS SELECT ?::INTEGER IN (?::INTEGER, ?::INTEGER, ?::INTEGER);

EXECUTE s4(1, 2, 3, 1);

PREPARE s5 AS SELECT ?::INTEGER IN (SELECT i FROM (VALUES (?::INTEGER), (?::INTEGER), (?::INTEGER)) tbl(i));

EXECUTE s5(1, 2, 3, 1);

SET threads=1;

CREATE TABLE filter_t(i INTEGER);

INSERT INTO filter_t SELECT range FROM range(100);

PREPARE stale_filter AS SELECT count(*) FROM filter_t WHERE i = 200;

EXECUTE stale_filter;

INSERT INTO filter_t VALUES (200);

SELECT count(*) FROM filter_t WHERE i = 200;

BEGIN TRANSACTION;

ROLLBACK;

PREPARE stale_cte AS
WITH filtered AS MATERIALIZED (SELECT * FROM filter_t WHERE i = 201)
SELECT count(*) FROM filtered;

EXECUTE stale_cte;

INSERT INTO filter_t VALUES (201);

CREATE TABLE probe AS SELECT i::BIGINT AS k FROM range(0, 6144) t(i);

CREATE TABLE build(k BIGINT);

INSERT INTO build VALUES (3000), (5000);

CHECKPOINT;

PREPARE stale_join AS
SELECT count(*)::BIGINT AS c, coalesce(sum(probe.k), 0)::BIGINT AS s
FROM probe
JOIN build USING (k);

EXECUTE stale_join;

DELETE FROM build;

INSERT INTO build VALUES (1), (2);

SELECT count(*)::BIGINT AS c, coalesce(sum(probe.k), 0)::BIGINT AS s
FROM probe
JOIN build USING (k);

INSERT INTO build VALUES (1), (1), (2), (NULL);

PREPARE stale_semi AS
SELECT count(*)::BIGINT AS c, coalesce(sum(k), 0)::BIGINT AS s
FROM probe
WHERE k IN (SELECT k FROM build);

EXECUTE stale_semi;

INSERT INTO build VALUES (3000), (3000), (5000), (NULL);

SELECT count(*)::BIGINT AS c, coalesce(sum(k), 0)::BIGINT AS s
FROM probe
WHERE k IN (SELECT k FROM build);

CREATE TABLE aggregate_t AS SELECT i::INTEGER AS i FROM range(100) t(i);

PREPARE stale_aggregate AS SELECT min(i), max(i), count(*) FROM aggregate_t;

EXECUTE stale_aggregate;

INSERT INTO aggregate_t VALUES (-1), (200);

SELECT min(i), max(i), count(*) FROM aggregate_t;

CREATE TABLE count_t(i INTEGER);

INSERT INTO count_t VALUES (1), (2);

PREPARE stale_count AS SELECT count(i), count(*) FROM count_t;

EXECUTE stale_count;

INSERT INTO count_t VALUES (NULL);

CREATE TABLE delete_t(i INTEGER);

PREPARE stale_delete AS DELETE FROM delete_t WHERE i = 42;

EXECUTE stale_delete;

INSERT INTO delete_t VALUES (42);

SELECT count(*) FROM delete_t;

PREPARE cached_constant AS SELECT 42;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'cached_constant';

CREATE TABLE insert_t(i INTEGER);

PREPARE cached_insert AS INSERT INTO insert_t VALUES (42) RETURNING i;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'cached_insert';

EXECUTE cached_insert;

SELECT count(*) FROM insert_t;

CREATE TEMP TABLE temp_insert_t(i INTEGER);

PREPARE cached_temp_insert AS INSERT INTO temp_insert_t VALUES (84) RETURNING i;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'cached_temp_insert';

EXECUTE cached_temp_insert;

PREPARE cached_scan AS SELECT i FROM filter_t;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'cached_scan';

EXPLAIN EXECUTE stale_filter;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'stale_filter';

EXPLAIN EXECUTE stale_join;

EXPLAIN ANALYZE EXECUTE stale_join;

SELECT result_types IS NULL FROM duckdb_prepared_statements() WHERE name = 'stale_aggregate';

CREATE TABLE bitstring_t(i INTEGER);

INSERT INTO bitstring_t VALUES (1), (2);

PREPARE stale_bitstring AS SELECT bit_count(bitstring_agg(i)) FROM bitstring_t;

EXECUTE stale_bitstring;

INSERT INTO bitstring_t VALUES (4);

CREATE TABLE stats_t(i INTEGER);

INSERT INTO stats_t VALUES (1), (2);

PREPARE stale_stats AS
SELECT s.min, s.max, s.has_null
FROM (SELECT stats(i) AS s FROM stats_t LIMIT 1);

EXECUTE stale_stats;

INSERT INTO stats_t VALUES (5), (NULL);

SET disabled_optimizers = 'statistics_propagation';

CREATE TABLE row_group_t AS SELECT i::INTEGER AS i FROM range(245760) t(i);

PREPARE stale_row_group AS SELECT i FROM row_group_t ORDER BY i LIMIT 1 OFFSET 122880;

EXECUTE stale_row_group;

INSERT INTO row_group_t VALUES (-1);

SELECT i FROM row_group_t ORDER BY i LIMIT 1 OFFSET 122880;

SET disabled_optimizers = '';

SET TimeZone = 'UTC';

PREPARE function_bind AS SELECT hour(to_timestamp(1767225600));

PREPARE folded_cast AS SELECT epoch_us(TIMESTAMPTZ '2026-01-01 00:00:00');

PREPARE evaluated_cast AS SELECT switch(to_timestamp(1767225600), MAP {TIMESTAMP '2026-01-01 00:00:00': 'hit'}, 'miss');

EXECUTE function_bind;

EXECUTE folded_cast;

EXECUTE evaluated_cast;

SET TimeZone = 'Europe/Amsterdam';

SELECT hour(to_timestamp(1767225600)), epoch_us(TIMESTAMPTZ '2026-01-01 00:00:00'), switch(to_timestamp(1767225600), MAP {TIMESTAMP '2026-01-01 00:00:00': 'hit'}, 'miss');

CREATE TABLE local_times (ts TIMESTAMP);

PREPARE local_time AS INSERT INTO local_times SELECT current_localtimestamp();

BEGIN;

EXECUTE local_time;

SET TimeZone = 'Asia/Kolkata';

SELECT max(ts) - min(ts) FROM local_times;

COMMIT;

SET VARIABLE server_uri = (SELECT concat('''', listen_uri, '''') FROM quack_serve('quack:localhost:0', token='test_token'));

PREPARE folded_function AS SELECT hour(to_timestamp(1767225600));

PREPARE folded_argument AS SELECT epoch_us(TIMESTAMPTZ '2026-01-01 00:00:00');

PREPARE folded_cast AS SELECT (TIMESTAMPTZ '2026-01-01 00:00:00+00')::VARCHAR;

EXECUTE folded_function;

EXECUTE folded_argument;

CREATE TABLE integers(i INTEGER, j VARCHAR);

INSERT INTO integers VALUES (1, 'hello');

PREPARE s1 AS UPDATE integers SET i=?, j=?;

EXECUTE s1(2, 'world');

SELECT * FROM integers;

PREPARE s2 AS UPDATE integers SET j=? WHERE i=?;

EXECUTE s2('test', 2);

PREPARE s3 AS UPDATE integers SET j=? WHERE i=? AND j=?;

EXECUTE s3('test2', 2, 'test');

PREPARE s1 AS SELECT CAST($1 AS INTEGER), CAST($2 AS STRING);

EXECUTE s1(43, 'asdf');

DEALLOCATE s2;

PREPARE s1 AS SELECT $1+$2;

PREPARE s1 AS SELECT NOT($1), 10+$2, $3+20, 4 IN (2, 3, $4), $5 IN (2, 3, 4);

EXECUTE s1(1, 2, 3, 4, 2);

PREPARE s1 AS SELECT $1;

PREPARE s2 AS SELECT (SELECT $1);

PREPARE s3 AS SELECT $1=$2;

PREPARE v1 AS SELECT ? + 1.0 AS a;

EXECUTE v1(2.0);

PREPARE v2 AS SELECT ? * 2.0 AS a;

EXECUTE v2(2.0);

PREPARE v3 AS SELECT ? = 2.0 AS a;

EXECUTE v3(2.0);

PREPARE v4 AS SELECT 2.0 IN (1.0, 1.5, ?);

EXECUTE v4(2.0);

EXECUTE v4(2.5);

PREPARE v5 AS SELECT ? IN (1.0, 1.5, 2.0);

EXECUTE v5(2.0);

EXECUTE v5(2.5);

PREPARE pssmallint AS SELECT - ?;

EXECUTE pssmallint(-32768);

PREPARE psinteger AS SELECT - ?;

EXECUTE psinteger(-2147483648);

PREPARE psbigint AS SELECT - ?;

EXECUTE psbigint(-9223372036854775808);

CREATE table T1(A0 TIMESTAMP, A1 INTEGER, A2 VARCHAR, A3 VARCHAR, A4 INTEGER, A5 DOUBLE);

PREPARE v1 AS SELECT (SUM(CASE WHEN ((T1.A2 = ($1)::text) AND (T1.A3 = ($1)::text)) THEN T1.A4 ELSE (0)::int END) / ((SUM(CASE WHEN ((T1.A2 = ($1)::text) AND (T1.A3 = ($1)::text)) THEN T1.A4 ELSE (0)::int END) + SUM(CASE WHEN ((T1.A2 = ($2)::text) AND (T1.A3 = ($1)::text)) THEN T1.A4 ELSE (0)::int END)))::float8) AS A00036933 FROM T1;

CREATE TABLE stringliterals AS SELECT 1 AS ID, 1::BIGINT AS a1,'value-1' AS a2,'value-1' AS a3,10::BIGINT AS a4;

PREPARE v1 AS
SELECT ((SUM(CASE
             WHEN ((stringliterals.a2 = ($1)::text) AND (stringliterals.a3 = ($1)::text))
	     THEN stringliterals.a4
	     ELSE (0)::int
	     END) +
	 SUM(CASE
	     WHEN ((stringliterals.a2 = ($2)::text) AND (stringliterals.a3 = ($2)::text))
	     THEN stringliterals.a4
	     ELSE (0)::int
	     END)) / ((SUM(CASE
	                   WHEN ((stringliterals.a2 = ($1)::text) AND (stringliterals.a3 = ($1)::text))
			   THEN stringliterals.a4
			   ELSE (0)::int
			   END) +
                       SUM(CASE
		           WHEN ((stringliterals.a2 = ($2)::text) AND (stringliterals.a3 = ($2)::text))
			   THEN stringliterals.a4
			   ELSE (0)::int
			   END)))::float8) AS A00000185
FROM stringliterals;

EXECUTE v1('value-1', 'value-2');

PREPARE v1 AS SELECT CASE ? WHEN ? THEN ? WHEN ? THEN ? ELSE ? END AS x;

EXECUTE V1(1, 2, 3, 4, 5, 6);

PREPARE v1 AS SELECT typeof(?);

EXECUTE v1(3::int);

EXECUTE v1('hello');

PREPARE v2 AS SELECT ?;

EXECUTE v2(3::int);

EXECUTE v2('hello');

PREPARE v3 AS SELECT ?=?;

EXECUTE v3(3::int, 4::bigint);

EXECUTE v3('hello', 'hello');

EXECUTE v3([1, 2, 3], [1, 2, 3]);

PREPARE v4 AS SELECT extract(year from ?);

EXECUTE v4(DATE '1992-01-01');

EXECUTE v4(TIMESTAMP '1992-01-01 23:00:20');

PREPARE v5 AS SELECT printf('%s', ?);

EXECUTE v5('hello');

PREPARE v6 AS SELECT printf('%d', ?);

EXECUTE v6(4);

PREPARE v7 AS SELECT [?];

EXECUTE v7(1);

EXECUTE v7('hello');

EXECUTE v7([1,2,3]);

EXECUTE v7(NULL);

PREPARE v8 AS SELECT [?, ?, ?];

EXECUTE v8(1, 2, 3);

EXECUTE v8(NULL, NULL, NULL);

EXECUTE v8('hello', 'world', NULL);

PREPARE v9 AS SELECT {'a': ?};

EXECUTE v9(42);

EXECUTE v9([1,2,3]);

PREPARE v10 AS SELECT {'a': ?, 'b': 42, 'c': ?};

EXECUTE v10(33, [1, 2, 3]);

EXECUTE v10(NULL, {'a': 88});

PREPARE v11 AS SELECT ROW(?, ?);

EXECUTE v11(11, 'hello');

PREPARE v12 AS SELECT ? IS NULL;

EXECUTE v12('hello');

EXECUTE v12([1, 2, 3]);

EXECUTE v12(NULL);

PREPARE v13 AS SELECT (SELECT ?);

EXECUTE v13(3::int);

EXECUTE v13('hello');

EXECUTE v13([1, 2, 3]);

PREPARE v14 AS SELECT SUM(?) FROM RANGE(100);

EXECUTE v14(2);

EXECUTE v14(2::HUGEINT);

EXECUTE v14(0.005);

PREPARE v15 AS SELECT ?+?;

EXECUTE v15(0.25, 0.25);

EXECUTE v15(1000000000000000000000000000000000000::hugeint, 1000000000000000000000000000000000000::hugeint);

PREPARE v17 AS SELECT ARRAY_CONTAINS(?, ?);

EXECUTE v17([1, 2, 3], 1);

EXECUTE v17([], 1);

EXECUTE v17(['hello', NULL, 'world'], 'world');

PREPARE v18 AS SELECT ARRAY_CONTAINS([1, 2, 3], ?);

EXECUTE v18(1);

EXECUTE v18(0);

PREPARE v19 AS SELECT ARRAY_CONTAINS(?, 1);

EXECUTE v19([1, 2, 3]);

CREATE TABLE b (i TINYINT);

INSERT INTO b VALUES (1), (2), (3), (4), (5);

PREPARE s1 AS DELETE FROM b WHERE i=$1;

SELECT * FROM b ORDER BY 1;

EXECUTE s1(3);

DROP TABLE b CASCADE;

PREPARE s1 AS UPDATE b SET i=$1 WHERE i=$2;

EXECUTE s1(6, 3);

PREPARE v1 AS SELECT ?::VARCHAR::INT;

EXECUTE v1('3');

create table test as select 42 i;

prepare q1 as SELECT cast(? AS VARCHAR) FROM test;

execute q1('oops');

PREPARE S1 AS SELECT (? / 1) + 1;

EXECUTE S1(42);

PREPARE s1 AS INSERT INTO b VALUES ($1);

EXECUTE s1 (NULL);

SELECT i FROM b;

PREPARE s2 AS UPDATE b SET i=$1;

EXECUTE s2 (NULL);

PREPARE s3 AS DELETE FROM b WHERE i=$1;

EXECUTE s3 (NULL);

CREATE TABLE a (i TINYINT);

INSERT INTO a VALUES (42);

PREPARE s3 AS SELECT * FROM a WHERE i=$1;

EXECUTE s3(10000);

EXECUTE s3(42);

EXECUTE s3(84);

DEALLOCATE s3;

PREPARE s1 AS SELECT to_years($1), CAST(list_value($1) AS BIGINT[]);

EXECUTE s1(1);

PREPARE v1 AS SELECT * FROM (SELECT $1::INTEGER) sq1;

PREPARE v2 AS SELECT * FROM (SELECT $1::INTEGER WHERE 1=0) sq1;

PREPARE v3 AS SELECT (SELECT $1::INT+sq1.i) FROM (SELECT 42 AS i) sq1;

PREPARE v4 AS SELECT (SELECT (SELECT $1::INT+sq1.i)+$2::INT+sq1.i) FROM (SELECT 42 AS i) sq1;

EXECUTE v4(20, 20);

CREATE TABLE test(a TINYINT, b SMALLINT, c INTEGER, d BIGINT, e REAL, f DOUBLE, g DATE, h VARCHAR);

PREPARE s1 AS INSERT INTO test VALUES ($1,$2,$3,$4,$5,$6,$7,$8);

EXECUTE s1(1,2,3,4,1.5,2.5,'1992-10-20', 'hello world');

SELECT * FROM test;

CREATE TABLE "user" (name string);

PREPARE s2965 AS
WITH temp_first AS (
    SELECT * FROM "user"
    WHERE "name" = ?
), temp_second AS (
    SELECT * FROM "user"
    WHERE "name" = ?
)
SELECT * FROM temp_second;

EXECUTE s2965('val1', 'val2');

DEALLOCATE s2965;
