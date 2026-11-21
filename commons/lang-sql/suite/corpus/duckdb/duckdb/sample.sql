create table all_types as select * exclude(small_enum, medium_enum, large_enum, "union", bit, empty_struct) from test_all_types();

select * from all_types_csv_1;

select * from all_types_csv_2;

select * from all_types_parquet_1;

select * from all_types_parquet_2;

SELECT count(*) FROM range(100) USING SAMPLE 0 PERCENT (reservoir, 42);

SELECT count(*)
FROM (SELECT i, random() AS r FROM range(10) t(i)) s
USING SAMPLE 0 ROWS (system, 42);

SELECT count(*)
FROM (SELECT i, random() AS r FROM range(10) t(i)) s
USING SAMPLE 20 ROWS (system, 42);

EXPLAIN SELECT * FROM range(10) LIMIT 40 PERCENT OFFSET 2;

SELECT (SELECT count(*) FROM range(1000) USING SAMPLE bernoulli(10%) REPEATABLE (9223372036854775807)) =
       (SELECT count(*) FROM range(1000) USING SAMPLE bernoulli(10%) REPEATABLE (9223372036854775807));

SELECT count(*), count(DISTINCT i)
FROM range(200000) t(i) USING SAMPLE 5000 ROWS (reservoir, 42);

SELECT count(*), count(DISTINCT i)
FROM range(10000) t(i) USING SAMPLE 1 ROWS (reservoir, 42);

SELECT count(*), count(DISTINCT i)
FROM range(1000) t(i) USING SAMPLE 10 PERCENT (reservoir, 42);

SELECT count(*), count(DISTINCT i)
FROM range(200000) t(i) USING SAMPLE 1 PERCENT (reservoir, 42);

SELECT count(*)
FROM range(150000) t(i) USING SAMPLE 100 PERCENT (reservoir, 42);

SET memory_limit='100MB';

SELECT sum(length(s)) FROM (SELECT repeat('x', 1000) s FROM range(300000)) USING SAMPLE 1000 ROWS (reservoir);

CREATE OR REPLACE TABLE test AS SELECT UNNEST(RANGE(100000)) as x;

SELECT COUNT(*), min(x) FROM test TABLESAMPLE system (25 PERCENT) REPEATABLE (42);

SELECT COUNT(*), min(x) FROM test TABLESAMPLE BERNOULLI (25 PERCENT) REPEATABLE (42);

SET threads = 1;

CREATE TABLE t0(c1 BOOLEAN);

CREATE INDEX i0 ON t0 (c1);

INSERT INTO t0(c1) SELECT (i % 8 = 1) FROM range(16384) g(i);

SELECT count(*) FROM t0 WHERE c1 IN (VALUES (true));

SELECT count(*) < 16384 FROM t0 TABLESAMPLE SYSTEM (10%) REPEATABLE (7);

SELECT (SELECT count(*) FROM t0 TABLESAMPLE SYSTEM (10%) REPEATABLE (7) WHERE c1 IN (VALUES (true)))
    <= (SELECT count(*) FROM t0 TABLESAMPLE SYSTEM (10%) REPEATABLE (7));

SELECT (SELECT count(*) FROM t0 TABLESAMPLE SYSTEM (10%) REPEATABLE (7) WHERE c1 IN (VALUES (true)))
     = (SELECT count(*) FROM t0 TABLESAMPLE SYSTEM (10%) REPEATABLE (7) WHERE c1 = true);

select count(*) from range(100000) using sample (10000);

select count(*) from range(100) using sample (10);

select count(*) from range(205000) using sample (10000);

create table t1 as select range a from range(204800);

select * from duckdb_table_sample('t1');

create or replace table t1 as select range a from range(1000);

select avg(a) > 200, avg(a) < 800 from duckdb_table_sample('t1');

create or replace table t1 as select range a from range(204800);

select avg(a) > (0.2*204800), avg(a) < (0.8*204800) from duckdb_table_sample('t1');

select count(*) from duckdb_table_sample('t1') where a < 102400;

select count(*) from duckdb_table_sample('t1') where a > 102400;

select count(*) from t1 using sample (200000);

create or replace table materialized_range as select * from range(100);

create or replace table integers_1 as (select range b from materialized_range);

select count(b) from duckdb_table_sample('integers_1') where b in (select * from materialized_range);

create table materialized_range as select 1 a from range(102400);

select count(*) from duckdb_table_sample('materialized_range');

insert into materialized_range select 2 a from range(102400);

select a, count(*) from duckdb_table_sample('materialized_range') group by all order by a;

insert into materialized_range select 3 a from range(102400);

select a, count(*) > 650 from duckdb_table_sample('materialized_range') group by all order by a;

create or replace table integers_1 as select range a, range+1 b  from range(102400);

select count(*) from duckdb_table_sample('integers_1') order by all;

delete from integers_1 where a = 3;

select count(*) from duckdb_table_sample('integers_1');

update integers_1 set a = 5 where a = 1;

select * from duckdb_table_sample('integers_1');

create or replace table integers_1 as select range a, range+1 b  from range(204800);

Alter table integers_1 add column c DOUBLE;

Alter table integers_1 alter b TYPE VARCHAR;

Alter table integers_1 drop b;

create or replace table integers_1 as select range a, range+1 b  from range(500);

insert into integers_1 select range a from range(500);

create table string_samples as select range::Varchar a from range(204800);

select count(*) from duckdb_table_sample('string_samples') where a is NULL;

create table struct_samples as select {'key1': 'quack-a-lack', 'key2': range} a from range(204800);

select count(*) from duckdb_table_sample('struct_samples') where a is null;

create table blob_samples as select '\xAA\xAB\xAC'::BLOB a from range(204800);

select count(*) from duckdb_table_sample('blob_samples') where a is NULL;

create table integral_samples as select range::BIGINT a, range::DOUBLE b, range::FLOAT c, range::HUGEINT d, INTERVAL 1 YEAR e from range(204800);

select count(*) from duckdb_table_sample('integral_samples') where a NOT null;

select count(*) from duckdb_table_sample('integral_samples') where b NOT null;

select count(*) from duckdb_table_sample('integral_samples') where c NOT null;

select count(*) from duckdb_table_sample('integral_samples') where d NOT null;

select count(*) from duckdb_table_sample('integral_samples') where e IS null;

CREATE or replace TABLE t1 as select range a, [1, a, 2] b, a::VARCHAR || 'ducktastic' c, get_current_timestamp() d from range(1000000);

select count(*) from duckdb_table_sample('t1') where b is null;

select count(*) from duckdb_table_sample('t1') where c is null;

select count(*) from duckdb_table_sample('t1') where d is null;

create view v1 as select * from t1;

CREATE TABLE t1(a INT);

INSERT INTO t1 VALUES(1), (2), (3), (3), (5);

SELECT * FROM t1 WHERE a IN (SELECT * FROM t1 TABLESAMPLE RESERVOIR(1000000000)) order by all;

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

CREATE TABLE test_table AS SELECT i FROM range(10000) tbl(i);

SELECT COUNT(*) FROM test_table USING SAMPLE 100 ROWS (system);

SELECT COUNT(*) FROM test_table USING SAMPLE 500 ROWS (system);

EXPLAIN SELECT * FROM test_table USING SAMPLE 100 ROWS (system);

EXPLAIN SELECT * FROM test_table USING SAMPLE 500 ROWS (system, 42);

SELECT COUNT(*) FROM test_table USING SAMPLE 15000 ROWS (system);

SELECT COUNT(*) FROM test_table USING SAMPLE 0 ROWS (system);

CREATE TABLE empty_table(i INTEGER);

SELECT COUNT(*) FROM empty_table USING SAMPLE 5 ROWS (system);

SELECT COUNT(*) FROM test_table USING SAMPLE 1 ROWS (system);

SELECT COUNT(*) FROM test_table USING SAMPLE 250 ROWS (system, 42);

SELECT COUNT(*) FROM test_table USING SAMPLE 200 ROWS (system, 100);

SELECT COUNT(*) FROM test_table USING SAMPLE 200 ROWS (system, 999);

WITH s1 AS (
    SELECT i FROM test_table USING SAMPLE 10 ROWS (system, 1)
), s2 AS (
    SELECT i FROM test_table USING SAMPLE 10 ROWS (system, 999)
)
SELECT COUNT(*) > 0 FROM (
    (SELECT i FROM s1 EXCEPT SELECT i FROM s2)
    UNION ALL
    (SELECT i FROM s2 EXCEPT SELECT i FROM s1)
);

CREATE TABLE small_table AS SELECT i FROM range(10) tbl(i);

CREATE TABLE range_sample_src AS SELECT i FROM range(5000) tbl(i);

SELECT COUNT(*) FROM small_table USING SAMPLE 5 ROWS (system);

SELECT COUNT(*) FROM small_table USING SAMPLE 20 ROWS (system);

SELECT COUNT(*) FROM small_table USING SAMPLE 1 ROWS (system);

WITH base AS (
    SELECT i FROM test_table
)
SELECT COUNT(*) FROM base USING SAMPLE 37 ROWS (system);

SELECT COUNT(*) FROM range_sample_src USING SAMPLE 120 ROWS (system);

WITH x AS (
    SELECT * FROM test_table ORDER BY i LIMIT 200
)
SELECT COUNT(*) FROM x USING SAMPLE 50 ROWS (system);

SELECT COUNT(*) FROM (
    SELECT i, row_number() OVER w
    FROM test_table
    WINDOW w AS (ORDER BY i)
) sq USING SAMPLE 50 ROWS (system);

SELECT COUNT(*) FROM test_table WHERE i < 5000 USING SAMPLE 100 ROWS (system);

SELECT COUNT(*) FROM (SELECT * FROM test_table WHERE i % 2 = 0) tbl(i) USING SAMPLE 200 ROWS (system);

CREATE TABLE pushdown_test AS SELECT i FROM range(1000000) tbl(i);

SELECT COUNT(*) > 0 AND COUNT(*) <= 50 FROM (
    SELECT * FROM pushdown_test WHERE i % 2 = 0
) USING SAMPLE 50 ROWS (system);

SELECT COUNT(*) FROM (SELECT i FROM pushdown_test) USING SAMPLE 200 ROWS (system);

EXPLAIN SELECT COUNT(*) FROM (SELECT i FROM range(10000) tbl(i)) USING SAMPLE 100 ROWS (system);

EXPLAIN SELECT COUNT(*) FROM (SELECT i FROM pushdown_test) USING SAMPLE 100 ROWS (system);

SELECT COUNT(*) FROM (
    SELECT a.i FROM 
        (SELECT * FROM pushdown_test USING SAMPLE 1000 ROWS (system, 42)) a,
        (SELECT * FROM pushdown_test USING SAMPLE 1000 ROWS (system, 42)) b
    WHERE a.i = b.i
);
