CREATE TABLE v0 ( c1 INT );

SELECT * FROM v0;

INSERT INTO v0 VALUES (1), (2), (3), (4), (0);

select * from v0 where c1 = 0;

Select * from v0 order by all;

CREATE TABLE table1 (a INTEGER DEFAULT -1, b INTEGER DEFAULT -2, c INTEGER DEFAULT -3);

insert into table1(a) select * from range (0, 4000, 1) t1(a);

DELETE FROM table1
WHERE a < 5 RETURNING a, b, c;

DELETE FROM table1
WHERE a = 6 RETURNING a;

DELETE FROM table1
WHERE a = 7 RETURNING *;

DELETE FROM table1
WHERE a=8 AND b=-2 AND c=-3 RETURNING *, c, b, a;

DELETE FROM table1
WHERE a=9 RETURNING c, b, a;

DELETE FROM table1
WHERE a>=10 AND a <=13  RETURNING c as aliasc, a as aliasa, b as aliasb;

DELETE FROM table1
WHERE a=14
RETURNING a + b + c;

DELETE FROM table1
WHERE a=10
RETURNING 'duckdb';

DELETE FROM table1
WHERE a=15
RETURNING 'duckdb';

CREATE TABLE table2 (a2 INTEGER, b2 INTEGER, c2 INTEGER);

CREATE TABLE table3 (a3 INTEGER, b3 INTEGER, c3 INTEGER);

INSERT INTO table2 VALUES (1, 1, 1), (2, 2, 2), (3, 3, 3), (100, 100, 100), (200, 200, 200);

INSERT INTO table3 VALUES (1, 4, 4), (2, 6, 7), (8, 8, 8);

DELETE FROM table3
WHERE a3 IN (
	SELECT a2 from table2
) RETURNING *;

CREATE TABLE table4 (a4 INTEGER, b4 INTEGER, c4 INTEGER);

CREATE TABLE table5 (a5 INTEGER, b5 INTEGER, c5 INTEGER);

INSERT INTO table4 VALUES (1, 0, 2), (2, 0, 1), (3, 0, 0);

INSERT INTO table5 VALUES (1, 0, 0), (2, 0, 0), (3, 0, 1), (4, 0, 1), (5, 0, 2), (6, 0, 2);

DELETE FROM table4
WHERE a4 IN (SELECT sum(a5) FROM table5 GROUP BY c5)
RETURNING *;

DELETE FROM table4 WHERE a4 = 1 RETURNING CASE WHEN b4=0 THEN a4 ELSE b4 END;

DELETE FROM table4 WHERE a4 = 2 RETURNING CASE WHEN b4=1 THEN a4 ELSE b4 END;

DROP TABLE table2;

DROP TABLE table3;

DROP TABLE table4;

DROP TABLE table5;

CREATE TABLE table2 (a VARCHAR DEFAULT 'hello world', b INT);

INSERT INTO table2 VALUES ('duckdb', 1), ('postgres', 2), ('sqlite', 3), ('mysql', 4), ('mongo', 5);

DELETE FROM table2
WHERE b = 1
RETURNING a, b;

DELETE FROM table2
WHERE b = 2
RETURNING b::VARCHAR;

DELETE FROM table2
WHERE b=3
RETURNING {'a': a, 'b': b};

DELETE FROM table2
WHERE b=4
RETURNING [a, b::VARCHAR];

CREATE SEQUENCE seq;

CREATE TABLE table3 (a INTEGER DEFAULT nextval('seq'), b INTEGER);

INSERT INTO table3(b) VALUES (4), (5) RETURNING a, b;

DELETE FROM table3
WHERE b = 4
RETURNING *;

DROP TABLE table1;

SELECT count(*) FROM table1;

DELETE FROM table1 RETURNING a;

CREATE TABLE test_optimized (id INTEGER, name VARCHAR, value DOUBLE);

INSERT INTO test_optimized VALUES (1, 'one', 1.0), (2, 'two', 2.0), (3, 'three', 3.0), (4, 'four', 4.0), (5, 'five', 5.0);

DELETE FROM test_optimized WHERE id <= 2 RETURNING id, name;

DELETE FROM test_optimized WHERE id = 3 RETURNING *;

DELETE FROM test_optimized WHERE id = 4 RETURNING value, name, id;

DELETE FROM test_optimized WHERE id = 5 RETURNING id * 10 + value;

DROP TABLE test_optimized;

CREATE TABLE test_where_returning (id INTEGER, amount DOUBLE, customer VARCHAR);

INSERT INTO test_where_returning VALUES (1, 100.0, 'Alice'), (2, 200.0, 'Bob'), (3, 300.0, 'Charlie');

DELETE FROM test_where_returning WHERE id < 3 RETURNING id, amount, customer;

DROP TABLE test_where_returning;

CREATE TABLE test_rowid_supported (id INTEGER, name VARCHAR);

INSERT INTO test_rowid_supported VALUES (1, 'one'), (2, 'two'), (3, 'three');

DELETE FROM test_rowid_supported WHERE id = 1 RETURNING rowid;

DELETE FROM test_rowid_supported WHERE id = 2 RETURNING id, name, rowid;

DELETE FROM test_rowid_supported WHERE id = 3 RETURNING *, rowid;

DROP TABLE test_rowid_supported;

CREATE TABLE test_rowid_generated (
    id INTEGER,
    val INTEGER,
    computed INTEGER GENERATED ALWAYS AS (val * 2) VIRTUAL
);

INSERT INTO test_rowid_generated (id, val) VALUES (1, 10), (2, 20), (3, 30);

DELETE FROM test_rowid_generated WHERE id = 1 RETURNING rowid;

DELETE FROM test_rowid_generated WHERE id = 2 RETURNING *, rowid;

DELETE FROM test_rowid_generated WHERE id = 3 RETURNING computed, id, rowid;

DROP TABLE test_rowid_generated;

CREATE TABLE test_rowid_multi_gen (
    id INTEGER,
    a INTEGER,
    b INTEGER,
    sum_ab INTEGER GENERATED ALWAYS AS (a + b) VIRTUAL,
    prod_ab INTEGER GENERATED ALWAYS AS (a * b) VIRTUAL
);

INSERT INTO test_rowid_multi_gen (id, a, b) VALUES (1, 2, 3), (2, 4, 5);

DELETE FROM test_rowid_multi_gen WHERE id = 1 RETURNING *, rowid;

DELETE FROM test_rowid_multi_gen WHERE id = 2 RETURNING rowid, sum_ab, prod_ab;

DROP TABLE test_rowid_multi_gen;

CREATE TABLE test_rowid_gen_middle (
    a INTEGER,
    gen INTEGER GENERATED ALWAYS AS (a + c) VIRTUAL,
    c INTEGER
);

INSERT INTO test_rowid_gen_middle (a, c) VALUES (1, 100), (2, 200);

DELETE FROM test_rowid_gen_middle WHERE a = 1 RETURNING *, rowid;

DELETE FROM test_rowid_gen_middle WHERE a = 2 RETURNING rowid, gen;

DROP TABLE test_rowid_gen_middle;

CREATE TABLE test_generated_virtual (
    id INTEGER,
    base_value INTEGER,
    computed_value INTEGER GENERATED ALWAYS AS (base_value * 2) VIRTUAL
);

INSERT INTO test_generated_virtual (id, base_value) VALUES (1, 10), (2, 20), (3, 30);

DELETE FROM test_generated_virtual WHERE id = 1 RETURNING id, base_value;

DELETE FROM test_generated_virtual WHERE id = 2 RETURNING *;

DELETE FROM test_generated_virtual WHERE id = 3 RETURNING computed_value;

DROP TABLE test_generated_virtual;

CREATE TABLE test_generated_middle (
    a INTEGER,
    gen INTEGER GENERATED ALWAYS AS (a + c) VIRTUAL,
    c INTEGER
);

INSERT INTO test_generated_middle (a, c) VALUES (1, 100), (2, 200), (3, 300);

DELETE FROM test_generated_middle WHERE a <= 2 RETURNING *;

DELETE FROM test_generated_middle WHERE a = 3 RETURNING gen;

DROP TABLE test_generated_middle;

CREATE TABLE test_multi_generated (
    x INTEGER,
    y INTEGER,
    sum_xy INTEGER GENERATED ALWAYS AS (x + y) VIRTUAL,
    prod_xy INTEGER GENERATED ALWAYS AS (x * y) VIRTUAL
);

INSERT INTO test_multi_generated (x, y) VALUES (2, 3), (4, 5), (6, 7);

DELETE FROM test_multi_generated WHERE x = 2 RETURNING *;

DELETE FROM test_multi_generated WHERE x = 4 RETURNING sum_xy, prod_xy;

DROP TABLE test_multi_generated;

CREATE TABLE test_generated_varchar (
    id INTEGER,
    name VARCHAR,
    greeting VARCHAR GENERATED ALWAYS AS ('Hello, ' || name || '!') VIRTUAL
);

INSERT INTO test_generated_varchar (id, name) VALUES (1, 'Alice'), (2, 'Bob');

DELETE FROM test_generated_varchar WHERE id = 1 RETURNING *;

DELETE FROM test_generated_varchar WHERE id = 2 RETURNING greeting;

DROP TABLE test_generated_varchar;

CREATE TABLE merge_gen_target(id INT, x INT, gen AS (x * 2));

INSERT INTO merge_gen_target(id, x) VALUES (1, 10), (2, 20), (3, 30);

CREATE TABLE merge_source(id INT);

INSERT INTO merge_source VALUES (1), (2);

MERGE INTO merge_gen_target USING merge_source ON merge_gen_target.id = merge_source.id
WHEN MATCHED THEN DELETE
RETURNING *, merge_action;

SELECT * FROM merge_gen_target;

DROP TABLE merge_gen_target;

DROP TABLE merge_source;

CREATE TABLE merge_multi_gen(
    id INT,
    a INT,
    b INT,
    sum_ab INT GENERATED ALWAYS AS (a + b) VIRTUAL,
    prod_ab INT GENERATED ALWAYS AS (a * b) VIRTUAL
);

INSERT INTO merge_multi_gen(id, a, b) VALUES (1, 2, 3), (2, 4, 5), (3, 6, 7);

CREATE TABLE merge_delete_source(id INT);

INSERT INTO merge_delete_source VALUES (1), (3);

MERGE INTO merge_multi_gen t USING merge_delete_source s ON t.id = s.id
WHEN MATCHED THEN DELETE
RETURNING t.id, t.a, t.b, t.sum_ab, t.prod_ab, merge_action;

DROP TABLE merge_multi_gen;

DROP TABLE merge_delete_source;

CREATE TABLE merge_rowid_target (id INT, val INT);

INSERT INTO merge_rowid_target VALUES (1, 10), (2, 20);

CREATE TABLE merge_rowid_source (id INT);

INSERT INTO merge_rowid_source VALUES (1);

DROP TABLE merge_rowid_target;

DROP TABLE merge_rowid_source;

CREATE TABLE indexed_returning (id INT PRIMARY KEY, val VARCHAR, amount INT);

CREATE INDEX idx_amount ON indexed_returning(amount);

INSERT INTO indexed_returning VALUES (1, 'a', 100), (2, 'b', 200), (3, 'c', 300);

DELETE FROM indexed_returning WHERE amount >= 200 RETURNING val;

SELECT * FROM indexed_returning ORDER BY id;

SELECT * FROM indexed_returning WHERE amount = 100;

SELECT COUNT(*) FROM indexed_returning WHERE amount = 200;

INSERT INTO indexed_returning VALUES (2, 'new_b', 250), (3, 'new_c', 350);

SELECT * FROM indexed_returning WHERE amount = 250;

SELECT * FROM indexed_returning WHERE amount = 350;

BEGIN TRANSACTION;

DELETE FROM indexed_returning WHERE id = 2 RETURNING *;

INSERT INTO indexed_returning VALUES (2, 'tx_b', 225);

SELECT * FROM indexed_returning WHERE amount = 225;

COMMIT;

SELECT * FROM indexed_returning WHERE id = 2;

DROP TABLE indexed_returning;

CREATE TABLE all_types("varchar" VARCHAR, nested_int_array INTEGER[][]);

INSERT INTO all_types VALUES('🦆🦆🦆🦆🦆🦆',[]);

INSERT INTO all_types VALUES('goo'||chr(0) || 'se' ,[[], [42, 999, NULL, NULL, -42], NULL, [], [42, 999, NULL, NULL, -42]]);

INSERT INTO all_types VALUES(NULL,NULL);

DELETE
FROM all_types
WHERE EXISTS
    (SELECT all_types."varchar" AS c2
     FROM all_types AS ref_0)
RETURNING all_types.nested_int_array;

CREATE TABLE t1 (id INT PRIMARY KEY, name TEXT);

BEGIN;

INSERT INTO t1 VALUES (1, 'alice');

DELETE FROM t1 WHERE id = 1 RETURNING *;

CREATE TABLE t2 (id INT, name TEXT);

INSERT INTO t2 VALUES (1, 'alice');

DELETE FROM t2 WHERE id = 1 RETURNING *;

CREATE TABLE t3 (id INT, name TEXT);

INSERT INTO t3 VALUES (1, 'alice'), (2, 'bob'), (3, 'charlie');

DELETE FROM t3 RETURNING *;

CREATE TABLE t4 (id INT PRIMARY KEY, name TEXT);

INSERT INTO t4 VALUES (1, 'committed');

INSERT INTO t4 VALUES (2, 'local');

DELETE FROM t4 RETURNING *;

CREATE TABLE t5 (id INT, name TEXT, value INT);

INSERT INTO t5 VALUES (1, 'alice', 100);

DELETE FROM t5 WHERE id = 1 RETURNING id;

CREATE TABLE t6 (id INT, value INT);

INSERT INTO t6 VALUES (1, 10), (2, 20);

DELETE FROM t6 RETURNING id, value * 2;

INSERT INTO table1 VALUES (1, 2, 3);

INSERT INTO table1 VALUES (1, 2, 3) RETURNING a;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING *;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING COLUMNS('a|c');

INSERT INTO table1 VALUES (1, 2, 3) RETURNING COLUMNS('a|c') + 42;

INSERT INTO table1 VALUES (10, 20, 30), (40, 50, 60), (70, 80, 90) RETURNING *, c, b, a;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING c, a, b;

INSERT INTO table1 (c, b, a) VALUES (3, 2, 1) RETURNING a, b, c;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING a AS alias1, b AS alias2;

INSERT INTO table1(a) VALUES (10) RETURNING *;

INSERT INTO table1 (a, b, c) SELECT * from table1 WHERE a = 10 and b=-2 and c=-3 RETURNING *;

INSERT INTO table1 (SELECT row_number() OVER (ORDER BY a) as row_number, b, c FROM table1 LIMIT 1) RETURNING *;

INSERT INTO table1 (a, b, c) SELECT * from table1 WHERE a = 100000 and b = 10000 and c=100000 RETURNING a, b, c;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING CASE WHEN b=2 THEN a ELSE b END;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING CASE WHEN b=3 THEN a ELSE b END;

INSERT INTO table1 VALUES (1, 1, -3) RETURNING a + b + c;

INSERT INTO table1 VALUES (1, 2, 3) RETURNING 'hello';

INSERT INTO table1 VALUES (1, 2, 3) RETURNING [a, b, c];

INSERT INTO table1 VALUES (1, 2, 3) RETURNING {'a':a, 'b':b, 'c':c};

INSERT INTO table1(a) (SELECT 42) RETURNING a, b;

INSERT INTO table2(a,b) VALUES ('hello duckdb', 1) RETURNING b, a;

INSERT INTO table2(b) VALUES (97) RETURNING b::VARCHAR;

INSERT INTO table2(a, b) VALUES ('duckdb', 97) RETURNING {'a': a, 'b': b};

INSERT INTO table1(a, b, c) SELECT a, b, c FROM table1  RETURNING a;

UPDATE table1
SET a=-10
WHERE a = 1 RETURNING a, b, c;

UPDATE table1
SET a=a*-2, b=b*2, c=c*2
WHERE a = 2 RETURNING a, b, c;

UPDATE table1
SET a=a*-2, b=b*2, c=c*2
WHERE a = 3 RETURNING a;

UPDATE table1
SET a=a*-2, b=b*2, c=c*2
WHERE a = 4 RETURNING *;

UPDATE table1
SET a=-5, b=2, c=1
WHERE a=5 AND b=-2 AND c=-3 RETURNING *, c, b, a;

UPDATE table1
SET c=1, b=2, a=3
WHERE a=6 AND b=-2 AND c=-3 RETURNING c, b, a;

UPDATE table1
SET c=1, b=2, a=3
WHERE a=7 AND b=-2 AND c=-3 RETURNING c as aliasc, a as aliasa, b as aliasb;

UPDATE table1
SET c=15
WHERE a=8 RETURNING *;

UPDATE table1
SET a=-9, b=b+7
WHERE a=9
RETURNING a + b + c;

UPDATE table1
SET a=-10
WHERE a=10
RETURNING 'duckdb';

UPDATE table3
SET c3 = t2.c2
FROM table2 AS t2
RETURNING *;

SELECT a3, b3, c3 IN (1, 200) FROM table3;

UPDATE table3
SET b3 = t2.b2
FROM table2 AS t2
WHERE table3.a3 = t2.a2 RETURNING a3, b3, c3 IN (1, 200);

UPDATE table4
SET b4 = temp_table.sum_a
FROM (SELECT sum(a5) as sum_a, c5 FROM table5 GROUP BY c5 ORDER BY sum_a) as temp_table
WHERE table4.c4 = temp_table.c5
RETURNING *;

UPDATE table4
SET b4 = temp_table.row_num
FROM (SELECT row_number() OVER (ORDER BY a4) as row_num, c4 from table4) as temp_table
WHERE table4.a4=temp_table.row_num
RETURNING *;

UPDATE table3 SET a3 = 0, b3 = 0, c3 = 0 FROM table3 t3 WHERE t3.a3 = 0 returning *;

UPDATE table3 SET a3 = 0 WHERE a3 = 1 RETURNING CASE WHEN b3=1 THEN a3 ELSE b3 END;

UPDATE table3 SET a3 = -1 WHERE a3 = 0 RETURNING CASE WHEN b3=2 THEN a3 ELSE b3 END;

INSERT INTO table2 VALUES ('duckdb', 1);

UPDATE table2
SET a='hello world'
WHERE b = 1
RETURNING a, b;

UPDATE table2
SET b=100
WHERE b = 1
RETURNING b::VARCHAR;

UPDATE table2
SET a='Mr.Duck', b=99
WHERE b=100
RETURNING {'a': a, 'b': b};

UPDATE table2
SET b=98
WHERE b=99
RETURNING [a, b::VARCHAR];

UPDATE table3
SET b=b+1
RETURNING *;

CREATE TABLE table4 (a INTEGER, b INTEGER, c INTEGER);

CREATE INDEX b_index ON table4(b);

INSERT INTO table4 VALUES (1, 2, 3), (4, 5, 6), (7, 8, 9);

UPDATE table4
SET b = 10
WHERE b = 2
RETURNING *;

SELECT * FROM table4;

UPDATE table1 SET a=5 returning a;

CREATE TABLE small_rg.t_list AS SELECT i AS id, [i] AS l FROM range(300000) t(i);

WITH u AS (UPDATE small_rg.t_list SET l = [id + 1] WHERE id % 7 <> 0 RETURNING id) SELECT count(*), count(DISTINCT id) FROM u;
