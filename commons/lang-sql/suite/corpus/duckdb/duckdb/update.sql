SET wal_autocheckpoint='1TB';

SET threads=1;

CREATE TABLE mem_test (a INTEGER, b INTEGER, c INTEGER, d VARCHAR);

INSERT INTO mem_test SELECT i, i%500, i%200, 'val_' || (i%100)::VARCHAR FROM range(500000) t(i);

CREATE TABLE mem_before AS SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag = 'TRANSACTION';

UPDATE mem_test SET a = a + 1 WHERE a % 2048 = 0;

CREATE TABLE mem_after AS SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag = 'TRANSACTION';

SELECT CASE WHEN (a.memory_usage_bytes - b.memory_usage_bytes) < 1500000
            THEN 'ok'
            ELSE error(concat('expected < 1.5MB increase, got ',
                             (a.memory_usage_bytes - b.memory_usage_bytes), ' bytes'))
       END
FROM mem_after a, mem_before b;

DROP TABLE mem_before;

DROP TABLE mem_after;

CREATE TABLE single_update (i INTEGER NOT NULL, v VARCHAR);

INSERT INTO single_update SELECT range, 'hello' FROM range(10000);

UPDATE single_update SET v = 'updated' WHERE i = 5000;

SELECT i, v FROM single_update WHERE i = 5000;

SELECT count(*) FROM single_update WHERE v = 'hello';

UPDATE single_update SET v = 'second' WHERE i = 5001;

UPDATE single_update SET v = 'third' WHERE i = 5002;

UPDATE single_update SET v = 'fourth' WHERE i = 5003;

UPDATE single_update SET v = 'fifth' WHERE i = 5004;

UPDATE single_update SET v = 'sixth' WHERE i = 5005;

UPDATE single_update SET v = 'seventh' WHERE i = 5006;

UPDATE single_update SET v = 'eighth' WHERE i = 5007;

UPDATE single_update SET v = 'ninth' WHERE i = 5008;

SELECT count(*) FROM single_update WHERE v NOT IN ('hello');

SELECT i, v FROM single_update WHERE i BETWEEN 5000 AND 5008 ORDER BY i;

CREATE TABLE full_vector_update (i INTEGER NOT NULL);

INSERT INTO full_vector_update SELECT range FROM range(4096);

UPDATE full_vector_update SET i = i + 10000 WHERE i < 2048;

SELECT MIN(i) FROM full_vector_update;

SELECT MAX(i) FROM full_vector_update WHERE i >= 10000;

SELECT count(*) FROM full_vector_update WHERE i >= 10000;

CREATE TABLE checkpoint_test (a INTEGER, b VARCHAR);

INSERT INTO checkpoint_test SELECT range, 'original' FROM range(10000);

UPDATE checkpoint_test SET b = 'modified' WHERE a % 1000 = 0;

SELECT count(*) FROM checkpoint_test WHERE b = 'modified';

CHECKPOINT;

SELECT count(*) FROM checkpoint_test WHERE b = 'original';

CREATE TABLE rollback_test (i INTEGER NOT NULL);

INSERT INTO rollback_test SELECT range FROM range(5000);

BEGIN TRANSACTION;

UPDATE rollback_test SET i = i + 99999 WHERE i = 2500;

SELECT i FROM rollback_test WHERE i > 99000;

ROLLBACK;

SELECT i FROM rollback_test WHERE i = 2500;

SELECT count(*) FROM rollback_test WHERE i > 99000;

CREATE TABLE concurrent_test (i INTEGER NOT NULL);

INSERT INTO concurrent_test SELECT range FROM range(5000);

UPDATE concurrent_test SET i = i + 100000 WHERE i = 1000;

SELECT i FROM concurrent_test WHERE i > 99000;

COMMIT;

CREATE TABLE scatter_test (a BIGINT NOT NULL, b DOUBLE, c VARCHAR);

INSERT INTO scatter_test SELECT range, range * 1.5, 'str_' || range::VARCHAR FROM range(100000);

UPDATE scatter_test SET b = -1.0, c = 'UPDATED' WHERE a % 2048 = 1024;

SELECT count(*) FROM scatter_test WHERE c = 'UPDATED';

SELECT count(*) FROM scatter_test WHERE b = -1.0;

SELECT count(*) FROM scatter_test WHERE b != -1.0 AND b = a * 1.5;

CREATE TABLE null_test (i INTEGER);

INSERT INTO null_test SELECT range FROM range(5000);

UPDATE null_test SET i = NULL WHERE i % 500 = 0;

SELECT count(*) FROM null_test WHERE i IS NULL;

UPDATE null_test SET i = -1 WHERE i IS NULL;

SELECT count(*) FROM null_test WHERE i = -1;

CREATE TABLE types_test (
    ti TINYINT,
    si SMALLINT,
    bi BIGINT,
    f FLOAT,
    d DOUBLE,
    v VARCHAR,
    bl BOOLEAN
);

INSERT INTO types_test
SELECT (range % 127)::TINYINT,
       (range % 32000)::SMALLINT,
       range::BIGINT,
       range::FLOAT,
       range::DOUBLE,
       range::VARCHAR,
       (range % 2 = 0)
FROM range(5000);

UPDATE types_test SET ti = -1, si = -1, bi = -1, f = -1.0, d = -1.0, v = 'X', bl = true WHERE bi = 2500;

SELECT ti, si, bi, f, d, v, bl FROM types_test WHERE bi = -1;

SELECT count(*) FROM types_test WHERE bi >= 0;

SELECT current_setting('force_update_to_del_and_insert');

CREATE TABLE t(i INTEGER, j INTEGER, k INTEGER);

INSERT INTO t VALUES (1, 10, 100), (2, 20, 200), (3, 30, 300);

SET force_update_to_del_and_insert=true;

UPDATE t SET j=j+1 WHERE i>1;

SELECT * FROM t ORDER BY i;

RESET force_update_to_del_and_insert;

UPDATE t SET k=k+1;

SET index_scan_percentage = 1.0;

SET index_scan_max_count = 0;

CREATE TABLE t (k INTEGER PRIMARY KEY, v INTEGER);

INSERT INTO t VALUES (0, 0), (1, NULL);

UPDATE t SET v = 99 WHERE k = 1;

SELECT k, v FROM t WHERE k IN (0);

SELECT k, v FROM t WHERE k IN (1);

CREATE TABLE test (id INTEGER, a INTEGER);

INSERT INTO test VALUES (1, 1), (2, 2), (3, 3), (4, NULL);

SELECT * FROM test ORDER BY id;

UPDATE test SET a=CASE WHEN id=1 THEN 7 ELSE NULL END WHERE id <= 2;

UPDATE test SET a=17 WHERE id > 2;

UPDATE test SET a=CASE WHEN id=4 THEN 1 ELSE NULL END;

UPDATE test SET a=2 WHERE id >= 2 AND id <= 3;

UPDATE test SET a=NULL WHERE id >= 3;

UPDATE test SET a=id WHERE id != 3;

UPDATE test SET a=NULL WHERE id != 3;

UPDATE test SET a=3 WHERE id != 2;

UPDATE test SET a=7 WHERE id != 3;

UPDATE test SET a=NULL;

UPDATE test SET a=CASE WHEN a IS NULL THEN 1 ELSE NULL END;

CREATE TABLE test (id INTEGER, s VARCHAR);

INSERT INTO test VALUES (1, 'a'), (2, 'b');

UPDATE test SET s=CASE WHEN id=1 THEN NULL ELSE 'cccccccccccccccccccc' END;

BEGIN;

CREATE TABLE t1(a VARCHAR(256) PRIMARY KEY, b INTEGER);

INSERT INTO t1 VALUES('    4-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 2 + 1);

INSERT INTO t1 VALUES('   34-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 18);

INSERT INTO t1 SELECT b, b + 1 FROM t1 WHERE b < 5;

FROM t1;

UPDATE t1 SET a = CONCAT(a, 'x') WHERE b % 2 = 0;

SELECT LENGTH(a) FROM test;

SET default_null_order='nulls_first';

SET immediate_transaction_mode=true;

CREATE TABLE integers(id INTEGER, val INTEGER);

INSERT INTO integers SELECT i, i FROM range(10000) t(i);

SET checkpoint_threshold='1GB';

UPDATE integers SET val=val+1000000 WHERE id=1;

UPDATE integers SET val=val+1000000 WHERE id=2;

UPDATE integers SET val=val+1000000 WHERE id=3;

SELECT COUNT(*) FROM integers WHERE val>1000000;

CREATE TABLE tbl (key INT, fruit VARCHAR, cost INT);

INSERT INTO tbl VALUES (1, 'apple', 2), (2, 'orange', 3);

UPDATE tbl SET (key, fruit, cost) = (1, 'pear', 2);

SELECT * FROM tbl;

UPDATE tbl SET (key, fruit, cost) = (2, 'apple', 3);

UPDATE tbl SET (key, fruit, cost) = 3;

UPDATE tbl SET (key, fruit, cost) = ADD(key, cost);

SELECT * FROM test ORDER BY a;

DROP TABLE IF EXISTS test_stress_update_issue_19688;

CREATE TABLE test_stress_update_issue_19688 (
    id INTEGER,
    val INTEGER
);

INSERT INTO test_stress_update_issue_19688 SELECT range AS id, range * 1000 AS val FROM range(10);

SELECT COUNT(*) FROM test_stress_update_issue_19688;

SELECT COUNT(DISTINCT id) FROM test_stress_update_issue_19688;

SELECT DISTINCT a FROM test ORDER BY a;

SELECT * FROM test;

SELECT * FROM test WHERE a=3;

SELECT * FROM test WHERE a=1;

CREATE TABLE test (a INTEGER);

INSERT INTO test VALUES (3);

CREATE  TABLE src (a INTEGER);

INSERT INTO src VALUES (2);

SELECT * FROM src;

UPDATE test SET a=test.a+s.a FROM src s;

UPDATE test SET a=test.a+t.a FROM test t;

UPDATE test SET a=t.a+s.a FROM test t, src s;

UPDATE test SET a=s.q FROM (SELECT a+1 as q FROM src) s;

CREATE VIEW vt AS (SELECT 17 as v);

UPDATE test SET a=v FROM vt;

UPDATE test SET a=s.a FROM src s WHERE s.a = 2;

UPDATE test t SET a=1 FROM src s WHERE s.a = t.a;

UPDATE test t SET a=9 FROM src s WHERE s.a=t.a;

INSERT INTO src VALUES (7);

UPDATE test SET a=s.a FROM src s;

CREATE TABLE terms(docid INTEGER, term INTEGER);

CREATE TABLE docs(id INTEGER, len INTEGER);

insert into docs values (1, 0), (2, 0);

insert into terms values (1, 1);

insert into terms values (2, 1);

insert into terms values (2, 2);

insert into terms values (2, 3);

UPDATE docs
SET len = sq.len
FROM (
    SELECT docid AS id, count(term) AS len
    FROM terms
    GROUP BY docid
    ORDER BY docid
) AS sq
WHERE docs.id = sq.id;

select * from docs;

CREATE TABLE student(id INTEGER, name VARCHAR, PRIMARY KEY(id));

INSERT INTO student SELECT i, 'creator' FROM RANGE(260001) tbl(i);

SELECT name FROM student WHERE id = 122879;

SELECT name FROM student WHERE id = 122881;

SELECT name FROM student WHERE id = 245780;

SELECT name FROM student WHERE id = 150881;

UPDATE student SET name = 'updator0' WHERE id = 122879;

UPDATE student SET name = 'updator1' WHERE id = 122881;

UPDATE student SET name = 'updator2' WHERE id = 245780;

UPDATE student SET name = 'updator3' WHERE id = 150881;

insert into student select i, 'creator' from range(130001) tbl(i);

select id, name from student where id=122881;

UPDATE student SET name = 'updator' WHERE id = 122881;

SELECT id, name FROM student WHERE id = 122881;

UPDATE test SET a=NULL WHERE a=1;

UPDATE test SET a=NULL WHERE a=2;

UPDATE test SET a=NULL WHERE a=3;

SELECT COUNT(*) FROM test WHERE a IS NULL;

UPDATE test SET a=99 WHERE a IS NULL;

SELECT SUM(a) FROM test;

CREATE TABLE test (a VARCHAR);

INSERT INTO test VALUES ('hello'), ('world');

UPDATE test SET a='test' WHERE a='hello';

UPDATE test SET a='test2' WHERE a='world';

SELECT * FROM test WHERE a=4;

SELECT * FROM test WHERE a=5;

CREATE TABLE t AS SELECT i, i::VARCHAR AS s FROM range(3000) tbl(i);

SELECT SUM(i), COUNT(s), MIN(s), MAX(s) FROM t;

SELECT i, s FROM t ORDER BY i DESC, s NULLS LAST LIMIT 3;

UPDATE t SET i = i * 2, s = 'z' WHERE i % 3 = 0;

CREATE TABLE r AS SELECT i, i::VARCHAR AS s FROM range(5000) tbl(i);

UPDATE r SET i = i + 100000, s = 'first' WHERE i % 3 = 0;

UPDATE r SET i = -i, s = NULL WHERE i % 2 = 0;

UPDATE r SET s = 'again' WHERE i < 0 AND i % 5 = 0;

SELECT SUM(i), COUNT(s), COUNT(*) FILTER (s = 'first'), MAX(s) FROM r;

CREATE TABLE p (id INTEGER PRIMARY KEY, v INTEGER, s VARCHAR);

INSERT INTO p SELECT i, i, 'val' || i::VARCHAR FROM range(10000) tbl(i);

UPDATE p SET v = 1000 WHERE id = 42;

SELECT v, s FROM p WHERE id = 42;

UPDATE p SET v = NULL, s = 'changed' WHERE id = 42 OR id = 43;

UPDATE p SET v = 7 WHERE id = 43;

SELECT v, s FROM p WHERE id = 43;

SELECT id, v, s FROM p WHERE id = 42 OR id = 43 ORDER BY id;

SET wal_autocheckpoint = '1TB';

CREATE TABLE g AS SELECT i, i::VARCHAR AS s FROM range(4096) tbl(i);

DELETE FROM g WHERE s LIKE '%xx%' AND i % 3 = 0;

UPDATE g SET s = 'last' WHERE i > 10000 AND i % 7 = 0;

SELECT SUM(i), COUNT(s), MAX(s), COUNT(*) FROM g;

SELECT SUM(i), COUNT(s), COUNT(*) FILTER (s = 'last'), COUNT(*) FROM g;

PRAGMA disable_checkpoint_on_shutdown;

CREATE TABLE t AS SELECT i, repeat('base', 25) || i AS s FROM range(20000) tbl(i);

CREATE TABLE mem_before AS SELECT memory_usage_bytes AS bytes FROM duckdb_memory() WHERE tag = 'ALLOCATOR';

SELECT COUNT(*), COUNT(DISTINCT s), MIN(s)
FROM t WHERE s = repeat('round29', 10) || i;

SELECT CASE WHEN m.memory_usage_bytes - b.bytes < 16 * 1024 * 1024
            THEN 'ok'
            ELSE error(concat('expected < 16MB of update strings, got ', m.memory_usage_bytes - b.bytes))
       END
FROM duckdb_memory() m, mem_before b
WHERE m.tag = 'ALLOCATOR';

SELECT COUNT(*), SUM((s = repeat('txn29', 15) || i)::INT) FROM t WHERE i % 2 = 0;

SELECT COUNT(*) FROM t WHERE s = (CASE WHEN i % 2 = 0 THEN repeat('txn29', 15) ELSE repeat('round29', 10) END) || i;

SELECT s FROM t WHERE i = 9;

SELECT COUNT(*) FROM t WHERE i % 3 = 0 AND s = repeat('snap19', 10) || i;

SELECT COUNT(*) FROM t WHERE i % 3 = 1 AND s = repeat('rollback', 10) || i;

SELECT COUNT(*) FROM t WHERE i % 3 = 1 AND s = (CASE WHEN i % 2 = 0 THEN repeat('txn29', 15) ELSE repeat('round29', 10) END) || i;

SELECT COUNT(*) FROM t WHERE i % 3 = 2 AND s = repeat('other19', 10) || i;

UPDATE t SET s = CASE WHEN i % 5 = 0 THEN NULL WHEN i % 5 = 1 THEN 'short' || (i % 10) ELSE s END;

SELECT COUNT(s), COUNT(*) FILTER (s LIKE 'short%'), COUNT(DISTINCT s) FILTER (s NOT LIKE 'short%') FROM t;

CREATE TABLE expected AS SELECT * FROM t;

SELECT COUNT(*) FROM t JOIN expected USING (i) WHERE t.s IS NOT DISTINCT FROM expected.s;

CREATE TABLE t1 (id VARCHAR, new_id VARCHAR, tags VARCHAR[], g GEOMETRY);

INSERT INTO t1 VALUES ('A', 'B', ARRAY['tag1', 'tag2'], 'POINT(1 2)');

UPDATE t1 SET new_id = 'C' WHERE id='A';

UPDATE t1 SET tags = ['tag3'] WHERE id='A';

UPDATE t1 SET g = 'POINT(3 4)' WHERE id='A';

CREATE TABLE t2 (id INT, val VARCHAR, tags VARCHAR[], g GEOMETRY);

INSERT INTO t2 VALUES (1, 'A', ARRAY['tag1', 'tag2'], 'POINT (5 6)');

UPDATE t2 SET val = t1.new_id FROM t1 WHERE t2.val=t1.id;

UPDATE t2 SET tags = ['tag3'] FROM t1 WHERE t2.val=t1.new_id;

UPDATE t2 SET g = 'POINT(0 0)' FROM t1 WHERE t2.val=t1.new_id;

CREATE TABLE a (b int);

INSERT INTO a VALUES (1);

UPDATE a SET b = b + 10;

SELECT * FROM a;

CREATE TABLE t1 (c0 INT);

INSERT INTO t1(c0) VALUES (1),(2),(3);

UPDATE t1 SET c0 = DEFAULT;

create table test (id bigint primary key, c1 text);

insert into test (id, c1) values (1, 'foo');

insert into test (id, c1) values (2, 'bar');

delete from test where id = 1;

update test set c1='baz' where id=2;

CREATE TABLE tbl(mycol INTEGER);

CREATE TABLE t AS
SELECT i AS id,
       CASE WHEN i % 5 = 0 THEN NULL ELSE i END AS k,
       CASE WHEN i % 7 = 0 THEN NULL ELSE 'string_value_' || (i % 100) END AS c,
       i * 2 AS nn
FROM range(10000) r(i);

UPDATE t SET k = 42, c = 'single' WHERE id = 35;

UPDATE t SET k = NULL, c = NULL WHERE id = 6;

UPDATE t SET k = -1, c = 'boundary', nn = -1 WHERE id IN (2047, 2048);

UPDATE t SET k = k + 1000000, c = c || '_sparse', nn = nn + 1 WHERE id BETWEEN 4096 AND 6143 AND id % 13 = 3;

UPDATE t SET k = k + 2000000, c = c || '_dense' WHERE id BETWEEN 6144 AND 8191 AND id % 3 <> 0;

CREATE VIEW expected AS
SELECT i AS id,
       CASE
           WHEN i = 35 THEN 42
           WHEN i = 6 THEN NULL
           WHEN i IN (2047, 2048) THEN -1
           WHEN i % 5 = 0 THEN NULL
           WHEN i BETWEEN 4096 AND 6143 AND i % 13 = 3 THEN i + 1000000
           WHEN i BETWEEN 6144 AND 8191 AND i % 3 <> 0 THEN i + 2000000
           ELSE i
       END AS k,
       CASE
           WHEN i = 35 THEN 'single'
           WHEN i = 6 THEN NULL
           WHEN i IN (2047, 2048) THEN 'boundary'
           WHEN i % 7 = 0 THEN NULL
           WHEN i BETWEEN 4096 AND 6143 AND i % 13 = 3 THEN 'string_value_' || (i % 100) || '_sparse'
           WHEN i BETWEEN 6144 AND 8191 AND i % 3 <> 0 THEN 'string_value_' || (i % 100) || '_dense'
           ELSE 'string_value_' || (i % 100)
       END AS c,
       CASE
           WHEN i IN (2047, 2048) THEN -1
           WHEN i BETWEEN 4096 AND 6143 AND i % 13 = 3 THEN i * 2 + 1
           ELSE i * 2
       END AS nn
FROM range(10000) r(i);

SELECT count(*) FROM t JOIN expected e USING (id)
WHERE t.k IS DISTINCT FROM e.k OR t.c IS DISTINCT FROM e.c OR t.nn IS DISTINCT FROM e.nn;

CREATE TABLE t(id INTEGER PRIMARY KEY, name VARCHAR UNIQUE, payload VARCHAR, n BIGINT);

INSERT INTO t SELECT i, 'name_' || i, repeat('x', i % 50) || i, i * 7 FROM range(5000) r(i);

UPDATE t SET id = id + 100000 WHERE id % 2 = 0;

SELECT count(*), sum(id), count(DISTINCT name), sum(n) FROM t;

SELECT id, name, payload = repeat('x', 42) || '42' FROM t WHERE name = 'name_42';

UPDATE t SET id = id + 1000000 WHERE id = 1;

INSERT INTO t VALUES (1, 'other', 'p', 0);

SELECT id, name FROM t WHERE id IN (1, 1000001) ORDER BY id;

UPDATE t SET id = id + 1 WHERE id = 3 RETURNING id, name, payload;

CREATE TABLE e(id INTEGER PRIMARY KEY, s VARCHAR);

CREATE UNIQUE INDEX e_lower ON e(lower(s));

INSERT INTO e SELECT i, 'Key_' || i FROM range(3000) r(i);

UPDATE e SET id = id + 10000;

UPDATE e SET id = id + 100000 WHERE id = 10005;

DELETE FROM e WHERE id = 110005;

INSERT INTO e VALUES (5, 'KEY_5');

SELECT id, s FROM e WHERE lower(s) = 'key_5';

SELECT count(*), min(id) FROM e;

CREATE TABLE u(a INTEGER, s VARCHAR);

CREATE INDEX u_a ON u(a);

INSERT INTO u SELECT i, 's' || i FROM range(3000) r(i);

UPDATE u SET a = a + 1;

SELECT count(*), sum(a), max(s) FROM u WHERE a > 0;

CREATE TABLE g(a INTEGER, b VARCHAR, c INTEGER, d INTEGER UNIQUE);

CREATE INDEX g_a ON g(a);

INSERT INTO g SELECT i, 'b' || i, i, i FROM range(3000) r(i);

UPDATE g SET a = a + 1 WHERE d = 5;

DELETE FROM g WHERE d = 5;

INSERT INTO g VALUES (0, 'x', 0, 5);

SELECT a, b, c, d FROM g WHERE d = 5;

INSERT INTO g SELECT i, 'b' || i, i, i FROM range(3000, 3100) r(i);

UPDATE g SET a = a + 1;

SELECT count(*), sum(a), count(DISTINCT d), max(d) FROM g;

CREATE TABLE src AS SELECT i % 100 AS k FROM range(3000) r(i);

CREATE TABLE h(k INTEGER PRIMARY KEY, v INTEGER, w INTEGER UNIQUE);

INSERT INTO h SELECT i, i, i FROM range(100) r(i);

UPDATE h SET k = h.k + 1000 FROM src WHERE h.k = src.k;

SELECT count(*), min(k), max(k), sum(w) FROM h;

CREATE TABLE target_pk (id INTEGER PRIMARY KEY, value INTEGER);

INSERT INTO target_pk VALUES (1, 0), (2, 0);

CREATE TABLE source_dup (id INTEGER, value INTEGER);

INSERT INTO source_dup VALUES (1, 10), (1, 11), (2, 20), (2, 21);

UPDATE target_pk SET value = source_dup.value FROM source_dup WHERE target_pk.id = source_dup.id RETURNING id;

SELECT count(*) FROM target_pk WHERE (id = 1 AND value IN (10, 11)) OR (id = 2 AND value IN (20, 21));

CREATE TABLE t(table_id BIGINT, val BOOLEAN);

INSERT INTO t VALUES (1, NULL);

WITH new_values(tid, new_val) AS (
	VALUES (1, NULL)
)
UPDATE t
SET val=new_val
FROM new_values
WHERE table_id=tid;

CREATE TABLE t(i int, j int);

INSERT INTO t SELECT ii, NULL FROM range(1024) tbl(ii);

select COUNT(j), MIN(j), MAX(j) from t;

UPDATE t SET j = 1;

CREATE TABLE t(a INT, b TEXT, c DOUBLE);

INSERT INTO t VALUES (1, 'hello', 1.5), (2, 'world', 2.5), (3, 'foo', 3.5);

UPDATE t SET a = 10 WHERE a = 1;

SELECT * FROM t ORDER BY a;

UPDATE t SET a = 0, b = 'changed' WHERE a = 2;

UPDATE t SET a = a + 1 WHERE a = 0 RETURNING a, b, c;

CREATE TABLE src(id INT, val TEXT);

INSERT INTO src VALUES (3, 'updated');

UPDATE t SET b = src.val FROM src WHERE t.a = src.id;

WITH new_vals AS (SELECT 100 AS new_a, 3 AS old_a)
UPDATE t SET a = new_vals.new_a FROM new_vals WHERE t.a = new_vals.old_a RETURNING a;

CREATE SCHEMA myschema;

CREATE TABLE myschema.t2(x INT);

INSERT INTO myschema.t2 VALUES (1), (2);

UPDATE myschema.t2 SET x = x * 10;

SELECT * FROM myschema.t2;

UPDATE t SET c = 0.0;

SELECT DISTINCT c FROM t;

SET force_compression='dict_fsst';

create table t as select case when i = 0 or i = 2 then NULL else 'value_' || (i % 50) end s from range(5000) t(i);

update t set s='seedseedseed' where rowid = 1;

update t set s='merge_value' where rowid = 0;

select s from t where rowid < 3 order by rowid;

select count(*), count(s) from t;

CREATE TABLE t1 (a INT, b INT, c INT, d INT, e VARCHAR);

INSERT INTO t1 VALUES (1, 2, 3, 4, 'FIVE');

UPDATE t1
 SET (a, b) = (10, 20),
        c = 30,
     (d, e) = (40, 'SIX');

SELECT * FROM t1;

CREATE TABLE t2 (k INT PRIMARY KEY, a INT, b INT, c INT);

INSERT INTO t2 VALUES (1, 2, 3, 4);

INSERT INTO t2 VALUES (1, 20, 30, 40) ON CONFLICT DO UPDATE SET (a, b) = (excluded.a, excluded.b), c = excluded.c + 1;

SELECT * FROM t2;

CREATE TABLE src (k INT, a INT, b INT, c INT);

INSERT INTO src VALUES (1, 100, 200, 300);

MERGE INTO t2 USING src ON t2.k = src.k
WHEN MATCHED THEN UPDATE SET a = src.a, (b, c) = (src.b, src.c);

SET threads=4;

CREATE TABLE tgt AS SELECT i AS id, i AS v, i::VARCHAR AS s, {'a': i, 'b': i::VARCHAR} AS st FROM range(300000) t(i);

CREATE TABLE src AS SELECT i AS id FROM range(400000) t(i) ORDER BY hash(i);

UPDATE tgt SET v = tgt.v + 1, s = CASE WHEN src.id % 7 = 0 THEN NULL ELSE 'x' || src.id END,
	st = {'a': src.id * 2, 'b': NULL} FROM src WHERE tgt.id = src.id AND src.id % 3 <> 0;

SELECT count(*), sum(v), count(s), count(*) FILTER (s = 'x' || id), sum(st.a), count(st.b),
	count(*) FILTER (v <> id + (id % 3 <> 0)::INT)
FROM tgt;

SELECT count(*) FROM tgt WHERE v = 299999 + 1;

UPDATE tgt SET v = -1, s = 'rolled back' FROM src WHERE tgt.id = src.id;

SELECT count(*) FROM tgt WHERE v = -1 AND s = 'rolled back';

SELECT count(*) FILTER (v = -1), count(*) FILTER (s = 'rolled back') FROM tgt;

SELECT count(*) FILTER (v = -5), count(*) FILTER (v = -1) FROM tgt;

UPDATE tgt SET v = -7 FROM src WHERE tgt.id = src.id AND src.id % 1000 = 0;

SELECT count(*) FROM tgt WHERE v = -7;

INSERT INTO tgt SELECT i AS id, 0 AS v, NULL AS s, NULL AS st FROM range(300000, 600000) t(i);

CREATE TABLE src2 AS SELECT i AS id FROM range(300000, 1000000) t(i) ORDER BY hash(i);

UPDATE tgt SET v = src2.id FROM src2 WHERE tgt.id = src2.id;

SELECT count(*), count(*) FILTER (v = id) FROM tgt WHERE id >= 300000;

CREATE TABLE dup AS SELECT i % 100000 AS id, i AS w FROM range(700000) t(i) ORDER BY hash(i);

UPDATE tgt SET v = dup.w FROM dup WHERE tgt.id = dup.id;

SELECT count(*) FROM tgt WHERE id < 100000 AND v % 100000 <> id;

SET memory_limit = '200MB';

UPDATE tgt SET v = -src.id, s = 'staged with a small memory limit ' || src.id FROM src WHERE tgt.id = src.id;

SELECT count(*) FILTER (v = -id), count(*) FILTER (s = 'staged with a small memory limit ' || id), count(*) FROM tgt WHERE id < 300000;

CREATE TABLE multi_tgt AS SELECT i AS id, 0 AS a, NULL::INTEGER AS b FROM range(200000) t(i);

CREATE TABLE multi_src AS SELECT i AS id, CASE WHEN j = 0 THEN 1 END AS a, CASE WHEN j = 1 THEN 1 END AS b
FROM range(200000) t(i), range(2) u(j) ORDER BY hash(i, j);

UPDATE multi_tgt SET a = multi_src.a, b = multi_src.b FROM multi_src WHERE multi_tgt.id = multi_src.id;

SELECT count(*), count(*) FILTER ((a IS NULL) = (b IS NULL)) FROM multi_tgt;
