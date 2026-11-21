CREATE SCHEMA test;

CREATE TABLE test.tbl(col INTEGER);

INSERT INTO test.tbl VALUES (1), (2), (3);

SELECT test.tbl.col FROM test.tbl;

CREATE SCHEMA t;

CREATE TABLE t.t(t ROW(t INTEGER));

INSERT INTO t.t VALUES ({'t': 42});

SELECT t FROM t.t;

SELECT t.t FROM t.t;

SELECT t.t.t FROM t.t;

SELECT t.t.t.t FROM t.t;

DROP SCHEMA t CASCADE;

CREATE TABLE t.t AS SELECT {'t': {'t': {'t': {'t': {'t': 42}}}}} t;

SELECT t.t.t.t.t.t.t.t FROM t.t;

SELECT t.t.t.t.t.t.t FROM t.t;

SELECT t.t.t.t.t.t FROM t.t;

SELECT t.t.t.t.t FROM t.t;

CREATE SCHEMA s1;

CREATE SCHEMA s2;

CREATE TABLE s1.t1 AS SELECT 42 t;

CREATE TABLE s2.t1 AS SELECT 84 t;

SELECT s1.t1.t FROM s1.t1, s2.t1;

SELECT * EXCLUDE (s1.t1.t) FROM s1.t1, s2.t1;

SELECT s2.t1.t FROM s1.t1, s2.t1;

SELECT #1 FROM range(1);

SELECT #1+#2 FROM range(1) tbl, range(1) tbl2;

SELECT #1 FROM (SELECT * FROM range(1)) tbl;

CREATE TABLE t(a INT, b INT);

INSERT INTO t VALUES (1, 2), (3, NULL);

SELECT #2 AS x FROM t WHERE (SELECT x) IS NULL;

SELECT #1 AS x, (SELECT x + 100) AS y FROM t ORDER BY 1;

SELECT #2 AS x FROM t ORDER BY (SELECT x) NULLS LAST;

CREATE TABLE integers("COL1" INTEGER, "COL2" INTEGER);

CREATE TABLE tbl AS SELECT * FROM integers;

SELECT name FROM pragma_table_info('tbl') ORDER BY name;

DROP TABLE tbl;

CREATE TABLE tbl AS SELECT COL1, COL2 FROM integers;

CREATE TABLE tbl AS SELECT integers.COL1, integers.COL2 FROM integers;

CREATE TABLE s1.integers("COL1" INTEGER, "COL2" INTEGER);

CREATE TABLE tbl AS SELECT s1.integers.COL1, s1.integers.COL2 FROM s1.integers;

CREATE TABLE s1.tbl(i INTEGER);

SELECT s1.tbl.i FROM s1.tbl;

SELECT j : 42;

select column_name from (describe SELECT j : 42);

SELECT "j" : 42;

SELECT "hel lo" : 42;

select column_name from (describe SELECT "hel lo" : 42);

SELECT j1 : 42, 42 AS j2, 42 j3;

CREATE TABLE a (i INTEGER);

INSERT INTO a VALUES (42);

SELECT j : i FROM a;

SELECT "j" : "i" FROM a;

SELECT * FROM b : a;

SELECT * FROM "b" : a;

SELECT i FROM b : a;

SELECT b.i FROM b : a;

from my_wonderful_values : (values(42));

from 'my_wonderful_values' : (values(42));

from "my_wonderful_values" : (values(42));

from r : range(1);

from "r" : range(1);

CREATE TABLE integers(i INTEGER);

SELECT * FROM integers;

CREATE TABLE t (t TEXT);

INSERT INTO t VALUES ('foo'), ('bar'), ('baz');

CREATE SCHEMA s;

create table s.a as select 'hello' as col1;

create view s.b as select * from s.a;

select s.b.col1 from s.b;

select b.col1 from s.b;
