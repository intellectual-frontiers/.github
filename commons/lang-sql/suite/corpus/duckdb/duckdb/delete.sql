CREATE TABLE a AS SELECT i FROM range(1228800) t(i);

BEGIN;

DELETE FROM a;

SELECT memory_usage_bytes < 1000000 FROM duckdb_memory() WHERE tag='BASE_TABLE';

ROLLBACK;

SELECT COUNT(*) FROM a;

CREATE TABLE tbl(i INTEGER);

INSERT INTO tbl FROM range(1000) t(i);

SET immediate_transaction_mode=true;

DELETE FROM tbl WHERE i <= 500;

CREATE TABLE tbl AS SELECT i FROM range(122880) t(i);

CHECKPOINT;

DELETE FROM tbl WHERE i % 2048 <> 0 AND i % 2 = 0;

DELETE FROM tbl WHERE i % 2 = 1;

SELECT COUNT(*), MIN(i), MAX(i) FROM tbl;

DELETE FROM tbl WHERE i % 2048 = 0;

SELECT COUNT(*) FROM tbl;

SET debug_skip_checkpoint_on_commit=true;

SET VARIABLE base_mem = (SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag='BASE_TABLE');

DELETE FROM tbl WHERE i >= 2048 AND i % 2 = 0;

DELETE FROM tbl WHERE i >= 2048 AND i % 2 = 1;

SELECT memory_usage_bytes > getvariable('base_mem') + 900000 FROM duckdb_memory() WHERE tag='BASE_TABLE';

CREATE TABLE other AS SELECT 1 AS i;

SELECT memory_usage_bytes < getvariable('base_mem') + 300000 FROM duckdb_memory() WHERE tag='BASE_TABLE';

SELECT COUNT(*), MAX(i) FROM tbl;

CREATE TABLE t(a INT, b TEXT, c DOUBLE);

INSERT INTO t VALUES (1, 'hello', 1.5), (2, 'world', 2.5), (3, 'foo', 3.5);

DELETE FROM t WHERE a = 1;

SELECT * FROM t ORDER BY a;

DELETE FROM t WHERE a = 2 RETURNING a, b, c;

INSERT INTO t VALUES (1, 'hello', 1.5), (2, 'world', 2.5);

CREATE TABLE to_delete(id INT);

INSERT INTO to_delete VALUES (1);

DELETE FROM t USING to_delete WHERE t.a = to_delete.id;

INSERT INTO t VALUES (10, 'ten', 10.5);

WITH targets AS (SELECT 10 AS target_a)
DELETE FROM t WHERE a IN (SELECT target_a FROM targets) RETURNING a;

DELETE FROM t;

SELECT count(*) FROM t;

CREATE SCHEMA myschema;

CREATE TABLE myschema.t2(x INT);

INSERT INTO myschema.t2 VALUES (1), (2), (3);

DELETE FROM myschema.t2 WHERE x > 1;

SELECT * FROM myschema.t2;

CREATE TABLE w(id INT PRIMARY KEY, v INT);

INSERT INTO w VALUES (1,1),(2,2),(3,3);

DELETE FROM w USING (VALUES (2),(2)) d(x) WHERE w.id = d.x RETURNING id;

COMMIT;

SELECT id, v FROM w ORDER BY id;

CREATE TABLE u(id INT UNIQUE, v INT);

INSERT INTO u VALUES (1,1);

INSERT INTO u VALUES (2,2),(3,3);

DELETE FROM u USING (VALUES (1),(1),(2),(2)) d(x) WHERE u.id = d.x;

SELECT id, v FROM u ORDER BY id;

CREATE TABLE c(id INT PRIMARY KEY, v INT);

INSERT INTO c VALUES (1,1),(2,2);

DELETE FROM c USING (SELECT 2 FROM range(5000)) d(x) WHERE c.id = d.x;

SELECT id, v FROM c ORDER BY id;

CREATE TABLE l(id INT PRIMARY KEY);

INSERT INTO l SELECT range FROM range(5000);

DELETE FROM l USING (SELECT range FROM range(5000) UNION ALL SELECT 4999) d(x) WHERE l.id = d.x;

SELECT count(*), count(DISTINCT id) FROM l;

CREATE TABLE tbl AS SELECT i FROM range(4096) t(i);

DELETE FROM tbl;

CREATE TABLE tbl2 AS SELECT i FROM range(4096) t(i);

DELETE FROM tbl2 WHERE i < 100;

DELETE FROM tbl2;

SELECT COUNT(*) FROM tbl2;

DELETE FROM tbl WHERE i < 2048;

DELETE FROM a WHERE i%2=0;

CREATE TABLE aggr (k int[]);

INSERT INTO aggr VALUES ([0, 1, 1, 1, 4, 0, 3, 3, 2, 2, 4, 4, 2, 4, 0, 0, 0, 1, 2, 3, 4, 2, 3, 3, 1]);

INSERT INTO aggr VALUES ([]), ([NULL]), (NULL), ([0, 1, 1, 1, 4, NULL, 0, 3, 3, 2, NULL, 2, 4, 4, 2, 4, 0, 0, 0, 1, NULL, 2, 3, 4, 2, 3, 3, 1]);

SELECT COUNT(k) FROM aggr;

DELETE FROM aggr;

CREATE TABLE t AS SELECT i FROM range(4096) t(i);

DELETE FROM t WHERE i % 2 = 0;

DELETE FROM t WHERE i % 4 = 1;

SELECT COUNT(*), MIN(i) FROM t;

CREATE TABLE r AS SELECT i FROM range(4096) t(i);

DELETE FROM r WHERE i % 2 = 0;

SELECT COUNT(*) FROM r;

DELETE FROM r WHERE i % 4 = 1;

SELECT COUNT(*) FILTER (WHERE i % 2 = 0) FROM r;

DELETE FROM a WHERE i % 2 = 0;

SELECT COUNT(*), MIN(i), MAX(i) FROM a;

SELECT COUNT(*) FILTER (WHERE i % 2 = 0) FROM a;

SELECT COALESCE(SUM(memory_usage_bytes), 0) < 2000000 FROM duckdb_memory() WHERE tag='BASE_TABLE';

CREATE TABLE a(i INTEGER);

INSERT INTO a VALUES (42);

BEGIN TRANSACTION;

CREATE TABLE t (id INT PRIMARY KEY, s TEXT, j BIGINT);

CREATE INDEX idx ON t(j);

INSERT INTO t VALUES (1, 'a', 10), (2, 'b', 20), (3, 'c', 30);

SELECT * FROM t ORDER BY id;

DELETE FROM t WHERE id = 2;

DELETE FROM t WHERE j = 30;

INSERT INTO t VALUES (4, 'd', 40), (5, 'e', 50);

DELETE FROM t WHERE j > 10;

DELETE FROM t WHERE j >= 20;

INSERT INTO t VALUES (2, 'new_20', 20), (3, 'new_30', 30);

SELECT * FROM t WHERE j = 20;

SELECT * FROM t WHERE j = 30;

INSERT INTO t VALUES (2, 'tmp_20', 20), (3, 'tmp_30', 30);

SELECT * FROM t WHERE j >= 20 ORDER BY j;

CREATE TABLE source (id INT, s TEXT, j BIGINT);

INSERT INTO source VALUES (2, 'x', 200), (3, 'y', 300);

MERGE INTO t USING source ON t.id = source.id
WHEN MATCHED THEN DELETE;

INSERT INTO t VALUES (2, 'new_b', 25), (3, 'new_c', 35);

SELECT * FROM t WHERE j = 25;

DELETE FROM source;

INSERT INTO t VALUES (2, 'merge_20', 20), (3, 'merge_30', 30);

DROP TABLE source;

CREATE TABLE delete_using_indexed(id INTEGER PRIMARY KEY, payload VARCHAR);

INSERT INTO delete_using_indexed SELECT range, range::VARCHAR FROM range(10);

DELETE FROM delete_using_indexed USING range(100) source(i) WHERE source.i = 0;

SELECT count(*) FROM delete_using_indexed;

DELETE FROM delete_using_indexed USING range(100) source(i) WHERE source.i = 0 RETURNING id;

SET threads=1;

PRAGMA disable_optimizer;

CREATE TABLE delete_using_duplicate_indexed(id INTEGER PRIMARY KEY, payload VARCHAR);

INSERT INTO delete_using_duplicate_indexed VALUES (0, 'zero'), (1, 'one');

DELETE FROM delete_using_duplicate_indexed
USING (VALUES (0), (0), (1)) AS source(id)
WHERE delete_using_duplicate_indexed.id = source.id
RETURNING delete_using_duplicate_indexed.id;

INSERT INTO delete_using_duplicate_indexed VALUES (1, 'replacement');

SELECT * FROM delete_using_duplicate_indexed;

PRAGMA enable_optimizer;

CREATE TABLE a AS SELECT * FROM range(0, 10000, 1) t1(i);

SELECT COUNT(*) FROM a WHERE i >= 2000 AND i < 5000;

DELETE FROM a WHERE i >= 2000 AND i < 5000;

SET threads=2;

pragma verify_parallelism;

SET threads=8;

CREATE OR REPLACE TABLE t AS SELECT range AS i FROM range(1000000);

INSERT INTO t SELECT range FROM range(1000000);

SELECT count(*), sum(i) FROM t;

WITH deleted AS (DELETE FROM t WHERE i % 2 = 0 RETURNING i) SELECT count(*), sum(i) FROM deleted;

TRUNCATE TABLE a;

TRUNCATE a;

TRUNCATE a AS ignored_alias;

TRUNCATE TABLE a RESTRICT;

TRUNCATE a AS ignored_alias RESTRICT;

TRUNCATE a "cascade";

TRUNCATE a AS restrict;

INSERT INTO a VALUES (1), (2), (3);

DELETE FROM a USING (values (1)) tbl(i) WHERE a.i=tbl.i;

SELECT * FROM a;

DELETE FROM a USING (values (1)) tbl(i);

DELETE FROM a USING (values (1)) tbl(i), (values (1), (2)) tbl2(i) WHERE a.i=tbl.i AND a.i=tbl2.i;

DELETE FROM a USING (values (4)) tbl(i) WHERE a.i=tbl.i;

DELETE FROM a USING a a2(i) WHERE a.i>a2.i;

create table integers as select * from generate_series(0, 9, 1);

create table integers2 as select * from generate_series(0, 9, 1);

DELETE FROM integers USING integers2;

SELECT COUNT(*) FROM integers;

DROP TABLE integers;

DROP TABLE integers2;

CREATE or replace TABLE integers AS FROM range(10);

create table integers_copy as select * from integers;

DELETE FROM integers USING range(100) RETURNING *;

select * from integers_copy;

create or replace table t1 as select range%10 a from range(1000);

create or replace table t2 as select range b from range(10);

create or replace table t2_copy as select * from t2;

delete from t2 using t1 where a=b returning *;

select * from t2_copy;

create or replace table t1 as select range%10 a from range(100);

insert into t2 select 12 from range(5);

insert into t1 select 12 from range(10);

create or replace table t1 as select range%1000 a from range(100_000);

create or replace table t2 as select range b from range(100);

insert into t2 select 100_050 from range(50);

insert into t1 select 100_050 from range(50);
