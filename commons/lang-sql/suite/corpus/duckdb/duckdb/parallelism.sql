SET debug_physical_table_scan_execution_strategy=DEFAULT;

SET threads=1;

SET read_ahead_depth=0;

CALL enable_logging('AsyncTaskSchedule');

SELECT DISTINCT pool FROM duckdb_logs_parsed('AsyncTaskSchedule');

SELECT sum(task_count) > 0 FROM duckdb_logs_parsed('AsyncTaskSchedule');

CALL truncate_duckdb_logs();

CREATE TABLE t AS SELECT md5(range::VARCHAR) || md5((range + 1)::VARCHAR) AS s, range AS i, range * 2 AS a, range * 3 AS b, range * 5 AS c FROM range(100000);

CHECKPOINT;

SET debug_physical_table_scan_execution_strategy=SYNCHRONOUS;

SET storage_block_prefetch='debug_force_always';

SELECT sum(i), sum(a), sum(b), sum(c), max(s) FROM t;

CALL disable_logging();

SELECT count(*) > 0 FROM duckdb_logs_parsed('AsyncTaskSchedule') WHERE pool LIKE 'SYNCHRONOUS_%' AND task_count > 1;

SELECT count(*) FROM duckdb_logs_parsed('AsyncTaskSchedule') WHERE pool NOT LIKE 'SYNCHRONOUS_%';

CREATE TABLE blocks AS SELECT i, repeat('a', 100) AS s FROM range(10000) t(i);

SELECT sum(i), sum(length(s)) FROM blocks;

SET async_threads=0;

DROP TABLE blocks;

SET memory_limit='64MiB';

CREATE TABLE integers(i INTEGER);

INSERT INTO integers SELECT * FROM range(100);

SELECT COUNT(*), SUM(i) FROM integers;

CREATE TABLE integers(i INTEGER PRIMARY KEY);

INSERT INTO integers SELECT * FROM range(1000);

CREATE OR REPLACE TABLE integers(i INTEGER);

INSERT INTO integers SELECT * FROM range(10000);

BEGIN;

COMMIT;

SELECT * FROM integers;

SET threads=2;

SET enable_external_file_cache=false;

SET debug_physical_table_scan_execution_strategy='SYNCHRONOUS';

SELECT sleep_ms(5);

SELECT 42;

call dsdgen(sf=0.01);

SELECT ss_quantity quantity,
       ss_list_price list_price
FROM store_sales,
     date_dim
WHERE ss_sold_date_sk = d_date_sk
  AND d_year BETWEEN 1999 AND 1999 + 2
UNION ALL SELECT cs_quantity quantity,
                 cs_list_price list_price
FROM catalog_sales,
     date_dim
WHERE cs_sold_date_sk = d_date_sk
  AND d_year BETWEEN 1999 AND 1999 + 2;

SELECT ss_quantity quantity,
       ss_list_price list_price
FROM store_sales,
   date_dim
WHERE ss_sold_date_sk = d_date_sk
  AND d_year BETWEEN 1999 AND 1999 + 2
UNION ALL SELECT cs_quantity quantity,
               cs_list_price list_price
FROM catalog_sales,
   date_dim
WHERE cs_sold_date_sk = d_date_sk
  AND d_year BETWEEN 1999 AND 1999 + 2
UNION ALL SELECT ws_quantity quantity,
               ws_list_price list_price
FROM web_sales,
   date_dim
WHERE ws_sold_date_sk = d_date_sk
  AND d_year BETWEEN 1999 AND 1999 + 2;

SET threads=16;

create table varchars as select i::varchar i from range(1000000) tbl(i);

insert into varchars values ('hello');

SET threads=4;

PRAGMA verify_parallelism;

SET enable_profiling='json';

SET profiling_mode = 'detailed';

CREATE TABLE integers AS SELECT * FROM range(50000) tbl(i);

SELECT COUNT(*) FROM integers TABLESAMPLE RESERVOIR(100);

PRAGMA enable_profiling;

create table t as select range a, range%10 b from range(100000);

select first([a]) from t group by b%2;

select min([a]), max([a]) from t group by b%2;

select min([-a, 1, a]), max([-a, 1, a]) from t group by b%2;

select min({'i': a}), max({'i': a}) from t group by b%2 order by all;

select min({'i': a, 'j': a % 2}), max({'i': a, 'j': a % 2}) from t group by b%2;

select first(NULL::INT[]) from t group by b%2;

select min(NULL::INT[]) from t group by b%2;

select first(NULL::ROW(i INTEGER)) from t group by b%2;

select min(NULL::ROW(i INTEGER)) from t group by b%2;

BEGIN TRANSACTION;

CREATE TABLE integers AS SELECT * FROM range(0, 5000) tbl(i);

SELECT MIN(i), MAX(i) FROM integers;

CREATE TABLE large_integers AS SELECT * FROM range(1000000) tbl(i);

SELECT COUNT(*), MIN(i), MAX(i) FROM large_integers;

INSERT INTO integers SELECT * FROM range(5000, 10000);

INSERT INTO integers VALUES (1), (2), (3), (NULL);

SELECT SUM(i) FROM integers UNION ALL SELECT AVG(i) FROM integers UNION ALL SELECT MIN(i) FROM integers UNION ALL SELECT MAX(i) FROM integers;

CREATE VIEW v1(i) AS SELECT SUM(i) FROM integers UNION ALL SELECT AVG(i) FROM integers UNION ALL SELECT MIN(i) FROM integers UNION ALL SELECT MAX(i) FROM integers;

SELECT * FROM v1 t1 JOIN v1 t2 USING (i);

SET threads=8;

CREATE TABLE committed AS SELECT range AS i FROM range(1000);

CREATE TABLE t AS SELECT range AS i FROM range(1000000);

SELECT count(*), sum(i), max(i) FROM t;

CREATE TABLE t2 AS SELECT * FROM t;

SELECT i FROM t2 LIMIT 3 OFFSET 777777;

SELECT count(*) FROM (SELECT i, rowid - min(rowid) OVER () AS pos FROM t2) WHERE i <> pos;

INSERT INTO t SELECT * FROM t;

SELECT count(*), sum(i) FROM t;

UPDATE t SET i = i + 1 WHERE i % 3 = 0;

INSERT INTO committed SELECT range FROM range(1000, 1000000);

SELECT count(*), sum(i) FROM committed;

SELECT count(*) FROM range(1000000) r(i) WHERE i IN (SELECT i FROM t2);

DROP TABLE t;

DROP TABLE t2;

DROP TABLE committed;

PRAGMA disable_verify_parallelism;

SET storage_block_prefetch='always_prefetch';

SET debug_verify_progress_ignore='STALLED:ORDER_BY';

INSERT INTO t SELECT * FROM t LIMIT 300000;

SELECT count(*) FROM t;

SELECT MIN(i), MAX(i) FROM integers WHERE i>2000;

CREATE TABLE integers2 AS SELECT i%4 i, i j FROM range(0, 5000) tbl(i);

SELECT i, SUM(j), MIN(j), MAX(j) FROM integers2 GROUP BY i ORDER BY i;
