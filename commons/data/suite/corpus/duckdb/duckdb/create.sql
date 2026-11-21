CREATE TABLE tbl1 AS SELECT 1;

SELECT * FROM tbl1;

CREATE TABLE tbl2 AS SELECT 2 AS f;

SELECT * FROM tbl2;

CREATE OR REPLACE TABLE tbl3 AS SELECT 3;

SELECT * FROM tbl3;

CREATE OR REPLACE TABLE tbl1 AS SELECT 4;

CREATE OR REPLACE TABLE tbl1 AS SELECT 'hello' UNION ALL SELECT 'world';

CREATE OR REPLACE TABLE tbl1 AS SELECT 5 WHERE false;

CREATE TABLE tbl4(col1, col2) AS SELECT 1, 'hello';

SELECT * FROM tbl4;

CREATE OR REPLACE TABLE tbl4(col1, col2) AS SELECT 2, 'duck';

CREATE TABLE IF NOT EXISTS tbl5(col1, col2) AS SELECT 3, 'database';

SELECT * FROM tbl5;

CREATE OR REPLACE TABLE tbl5(col1, "col need ' quote") AS SELECT 3.5, 'quote';

CREATE TABLE tbl6(col1) AS SELECT 4 ,'mismatch';

SELECT * FROM tbl6;

CREATE TABLE tbl8 AS SELECT 42 WITH NO DATA;

SELECT COUNT(*) FROM tbl8;

CREATE TABLE tbl9 AS SELECT 42 WITH DATA;

SELECT COUNT(*) FROM tbl9;

CREATE TABLE test (x INTEGER[]);

INSERT INTO test SELECT CASE WHEN x <= 520 THEN [0, 0] ELSE [0] END FROM generate_series(1, 2048) s(x);

CHECKPOINT;

CREATE TABLE test2 AS SELECT x FROM test;

SET VARIABLE location_var='boop';

CREATE SCHEMA db0;

USE db0;

CREATE TABLE t0 (a BIGINT PRIMARY KEY, b INT, c INT);

CREATE INDEX t0_idx ON t0 (b);

CREATE UNIQUE INDEX t0_uidx ON t0 (c);

CREATE UNIQUE INDEX t0_uidx2 ON db0.t0 (c);

create table t1 as select 'c1' as c1;

CREATE TABLE integers(i INTEGER);

CREATE OR REPLACE TABLE integers(i INTEGER, j INTEGER);

CREATE VIEW integers2 AS SELECT 42;

CREATE TABLE IF NOT EXISTS integers(i INTEGER);

INSERT INTO integers VALUES (1, 2);

ATTACH ':memory:' AS other_db;

CREATE SCHEMA parent_schema;

CREATE SCHEMA s1;

CREATE TABLE s1.t(i INTEGER);

SET debug_verify_statement='reparse_statement';

SELECT * FROM range(5) tbl1(i) JOIN range(5) tbl2(i) ON tbl1.i=tbl2.i;

SELECT i, i FROM range(5) tbl(i);

SELECT * FROM (SELECT i, i FROM range(5) tbl(i)) tbl;

SELECT * FROM (SELECT i, i, i, i FROM range(5) tbl(i)) tbl;

CREATE TABLE t1 AS SELECT i, i FROM range(5) tbl(i);

SELECT * FROM t1;

CREATE TABLE t2 AS SELECT i, i, i, i FROM range(5) tbl(i);

SELECT * FROM (SELECT * FROM range(5) tbl1(i) JOIN range(5) tbl2(i) ON tbl1.i=tbl2.i) tbl;

CREATE TABLE t3 AS SELECT tbl1.i, tbl2.i FROM range(5) tbl1(i) JOIN range(5) tbl2(i) ON tbl1.i=tbl2.i;

SELECT * FROM t3;

CREATE TABLE t4 AS SELECT * FROM range(5) tbl1(i) JOIN range(5) tbl2(i) ON tbl1.i=tbl2.i;

SELECT * FROM t4;

CREATE TABLE t1 AS SELECT 1 a LIMIT 1 WITH NO DATA;

SELECT count(*) FROM t1;

CREATE TABLE t2 AS SELECT range a FROM range(5) ORDER BY a LIMIT 2 OFFSET 1 WITH NO DATA;

SELECT count(*) FROM t2;

CREATE TABLE t3 AS SELECT 1 a WITH NO DATA;

SELECT count(*) FROM t3;

CREATE TABLE t4 AS SELECT range a FROM range(5) ORDER BY a LIMIT 2 WITH DATA;

SELECT count(*) FROM t4;

CREATE TABLE T (a INTEGER USING COMPRESSION RLE);

DROP TABLE T;

CREATE TABLE T (a INTEGER NOT NULL USING COMPRESSION RLE);

CREATE TABLE T (a INTEGER USING COMPRESSION RLE, b VARCHAR );

CREATE TABLE T (a INTEGER USING COMPRESSION RLE, b INTEGER USING COMPRESSION BITPACKING, C INTEGER USING COMPRESSION UNCOMPRESSED);

INSERT INTO T VALUES (1,1,1), (1,1,1), (1,1,1), (2,2,2), (2,2,2), (3,3,3);

SELECT * FROM T;

SELECT compression FROM pragma_storage_info('T') WHERE segment_type ILIKE 'INTEGER' LIMIT 3;

ALTER TABLE T RENAME COLUMN a TO a_1;

ALTER TABLE T RENAME COLUMN b TO b_1;

ALTER TABLE T RENAME COLUMN c TO c_1;

ALTER TABLE T RENAME TO T_1;

SELECT * FROM T_1;

SELECT compression FROM pragma_storage_info('T_1') WHERE segment_type ILIKE 'INTEGER' LIMIT 3;

ALTER TABLE T_1 DROP COLUMN c_1;

ALTER TABLE T_1 DROP COLUMN b_1;

SELECT compression FROM pragma_storage_info('T_1') WHERE segment_type ILIKE 'INTEGER' LIMIT 2;

ALTER TABLE T_1 ADD COLUMN b INTEGER DEFAULT 2;

create table T (
	vis enum ('hide', 'visible')[]
);

select column_type from (describe T);

attach ':memory:' as db2;

create schema schema2;

create schema db2.schema3;

create type schema2.foo as VARCHAR;

create type db2.schema3.bar as BOOL;

create table B (
	vis schema2.foo[]
);

insert into b values (['foo', 'bar']);

from b;

create table C (
	vis db2.schema3.bar[]
);

insert into C values ([true]);

select typeof(vis) from C;
