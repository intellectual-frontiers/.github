CREATE TABLE keys(i INTEGER PRIMARY KEY);

BEGIN;

INSERT INTO keys VALUES (1);

COMMIT;

SELECT COUNT(*) FROM keys;

CREATE TABLE t(i INTEGER);

INSERT INTO t VALUES (1), (2), (3);

SET debug_force_commit_failure=true;

INSERT INTO t VALUES (4);

UPDATE t SET i = i + 100 WHERE i = 1;

DELETE FROM t WHERE i = 2;

SET debug_force_commit_failure=false;

SELECT i FROM t ORDER BY i;

INSERT INTO t VALUES (5);

CREATE TABLE indexed_t(a INTEGER PRIMARY KEY, b INTEGER);

INSERT INTO indexed_t VALUES (1, 10), (2, 20), (3, 30);

CREATE INDEX indexed_t_b ON indexed_t(b);

UPDATE indexed_t SET b = 99 WHERE a = 2;

SELECT a, b FROM indexed_t ORDER BY a;

SELECT a FROM indexed_t WHERE b = 20;

SET debug_force_commit_revert_failure=true;

INSERT INTO t VALUES (6);

SET immediate_transaction_mode=true;

CREATE TABLE t1 (id INTEGER, val INTEGER);

INSERT INTO t1 SELECT i, i * 10 FROM range(10) tbl(i);

CREATE INDEX idx1 ON t1(id);

CHECKPOINT;

SELECT id FROM t1 WHERE id = 5;

EXPLAIN ANALYZE SELECT id FROM t1 WHERE id = 5;

SELECT COUNT(*) FROM t1;

DROP INDEX idx1;

SELECT COUNT(*) FROM duckdb_indexes WHERE index_name = 'idx1';

CREATE TABLE t (id INTEGER PRIMARY KEY);

INSERT INTO t SELECT range FROM range(10);

SELECT id FROM t WHERE id = 5;

SELECT memory_usage_bytes > 0 FROM duckdb_memory() WHERE tag = 'ART_INDEX';

SELECT used_blocks > 1 FROM pragma_database_size();

SELECT COUNT(*) FROM t;

DROP TABLE t;

EXPLAIN ANALYZE SELECT id FROM t WHERE id = 5;

SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag = 'ART_INDEX';

SELECT used_blocks FROM pragma_database_size();

create or replace table original_table as from range(10) select 1 as col;

CREATE TABLE tbl (id INT);

INSERT INTO tbl FROM range(10000);

SELECT COUNT(*) FROM tbl;

DELETE FROM tbl WHERE id%2=0;

SELECT COUNT(*), COUNT(*) + 1 FROM tbl;

INSERT INTO tbl FROM range(10000, 15000);

CREATE OR REPLACE TABLE SampleTable AS
SELECT DISTINCT id
FROM (VALUES
    ('one'),
    ('two'),
    ('three')
) AS t(id);

BEGIN TRANSACTION;

DELETE FROM sampletable;

DROP TABLE SampleTable;

COMMIT TRANSACTION;

CREATE TABLE tbl (id INT PRIMARY KEY, payload VARCHAR);

INSERT INTO tbl VALUES (1, 'first payload');

SELECT id, payload FROM tbl WHERE id = 1 ORDER BY ALL;

SELECT id, payload FROM tbl WHERE id = 5 ORDER BY ALL;

SELECT id, payload, rowid FROM tbl WHERE id = 1 ORDER BY ALL;

SET debug_skip_checkpoint_on_commit = true;

CREATE TABLE t1 (id INTEGER, status VARCHAR);

INSERT INTO t1 VALUES (1, 'open'), (2, 'open');

SELECT * FROM t1 ORDER BY id;

CREATE TABLE t2 (id INTEGER, status VARCHAR);

INSERT INTO t2 VALUES (1, 'open'), (2, 'open');

SELECT * FROM t2 ORDER BY id;

CREATE TABLE t3 (id INTEGER, status VARCHAR);

INSERT INTO t3 VALUES (1, 'open');

SELECT * FROM t3;

CREATE TABLE t4 (id INTEGER, status VARCHAR);

INSERT INTO t4 VALUES (1, 'open');

SELECT * FROM t4;

CREATE TABLE t5 (id INTEGER, status VARCHAR, tags VARCHAR[]);

INSERT INTO t5 VALUES (1, 'open', []);

SELECT * FROM t5;

CREATE TABLE t6 (id INTEGER PRIMARY KEY, status VARCHAR);

INSERT INTO t6 VALUES (1, 'open');

SELECT * FROM t6;

CREATE TABLE t8 (id INTEGER, status VARCHAR);

INSERT INTO t8 VALUES (1, 'open'), (2, 'open'), (3, 'open'), (4, 'open');

SELECT count(*) FROM t8;

SELECT * FROM t8 ORDER BY id;

CREATE TABLE t9 AS SELECT i AS id, 'open' AS status FROM range(5000) t(i);

SELECT count(*) FROM t9;

SELECT count(*), count(*) FILTER (status = 'closed') FROM t9;

SELECT count(*), count(*) FILTER (status = 'all') FROM t9;

CREATE TABLE t10 AS SELECT i AS id, 'open' AS status FROM range(4096) t(i);

SELECT count(*) FROM t10;

CREATE TABLE t11 AS SELECT i AS id, 'open' AS status FROM range(4096) t(i);

SELECT count(*) FROM t11;

CREATE TABLE t13 AS SELECT i AS id, 'open' AS status FROM range(300000) t(i);

SELECT count(*) FROM t13;

SELECT count(*), count(*) FILTER (status = 'closed') FROM t13;

CREATE TABLE t14 (id INTEGER PRIMARY KEY, v VARCHAR);

INSERT INTO t14 VALUES (1, 'a'), (2, 'b');

SELECT count(*) FROM t14;

SELECT * FROM t14 ORDER BY id;

CREATE TABLE t17 (a INTEGER, b INTEGER, c INTEGER);

INSERT INTO t17 VALUES (1, 1, 1), (2, 2, 2), (3, 3, 3);

UPDATE t17 SET c = 10 WHERE a = 1;

ALTER TABLE t17 DROP COLUMN b;

DELETE FROM t17 WHERE a = 3;

SELECT * FROM t17 ORDER BY a;

CREATE TABLE t18 (id INTEGER, v INTEGER);

CREATE TABLE t18_other AS SELECT 1 AS x;

SELECT count(*) FROM t18;

SELECT count(*), sum(v) FILTER (id = 7) FROM t18;

CREATE TABLE t15 AS SELECT i AS id, 'open' AS status FROM range(4096) t(i);

SELECT count(*) FROM t15;

CREATE TABLE t16 AS SELECT i AS id, 'open' AS status FROM range(4096) t(i);

DELETE FROM t16 WHERE id % 3 = 0;

UPDATE t16 SET status = 'closed' WHERE id = 1;

DELETE FROM t16 WHERE id = 2;

SELECT count(*) FROM t16;

SELECT count(*), count(*) FILTER (status = 'closed') FROM t16;

CREATE TABLE u1 (id INTEGER, a INTEGER, b INTEGER);

INSERT INTO u1 SELECT i, 0, 0 FROM range(4) t(i);

SELECT * FROM u1 WHERE id = 3;

SELECT * FROM u1 ORDER BY id;

CREATE TABLE u3 (id INTEGER, a INTEGER);

INSERT INTO u3 SELECT i, 0 FROM range(100) t(i);

SELECT count(*), sum(a) FROM u3;

CREATE TABLE u5 AS SELECT i AS id, 0 AS a FROM range(100) t(i);

SELECT id, a FROM u5 WHERE id < 2 ORDER BY id;

CREATE TABLE u6 AS SELECT i AS id, 0 AS a FROM range(10) t(i);

SELECT count(*) FROM u6;

SELECT id, a FROM u6 WHERE id >= 7 ORDER BY id;

CREATE TABLE u7 AS SELECT i AS id, 0 AS a FROM range(10) t(i);

SELECT count(*) FROM u7;

UPDATE u7 SET a = 3 WHERE id IN (3, 5, 7);

SELECT id, a FROM u7 WHERE id IN (3, 5, 7) ORDER BY id;

SELECT min(id), max(id) FROM tbl;

CREATE TABLE tbl(i INT);

INSERT INTO tbl FROM range(10);

SELECT MIN(i), MAX(i) FROM tbl;

CREATE TABLE t1 (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t1 SELECT i, i * 10 FROM range(1000) tbl(i);

CREATE TABLE t2 (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t2 SELECT i, i * 10 FROM range(1000) tbl(i);

SELECT id, val FROM t1 WHERE id = 42;

SELECT id, val FROM t1 WHERE val = 7000;

SELECT id, val FROM t1 WHERE id = 700;

DROP TABLE original_table;

ROLLBACK;

delete from original_table where rowid % 2 = 0;

SELECT COUNT(*) FROM original_table;

CREATE TABLE t1 (id INTEGER, val INTEGER, extra VARCHAR);

INSERT INTO t1 SELECT i, i, repeat(md5(i::VARCHAR), 200) FROM range(100) tbl(i);

CREATE TABLE t2 (id INTEGER);

INSERT INTO t2 SELECT i FROM range(10) tbl(i);

ALTER TABLE t2 ADD COLUMN x INTEGER;

ALTER TABLE t1 DROP COLUMN extra;

SELECT index_name FROM duckdb_indexes WHERE index_name = 'idx1';

DROP TABLE t2;

CREATE TABLE t1 (id INTEGER);

INSERT INTO t1 SELECT i FROM range(10) tbl(i);

DROP TABLE t1;

CREATE TABLE t1 (id INTEGER PRIMARY KEY);

SELECT * from t1 LIMIT 1;

SET default_transaction_invalidation_policy='SYNTACTIC_ERRORS_DO_NOT_INVALIDATE';

USE wal_replay;

PRAGMA disable_checkpoint_on_shutdown;

SET wal_autocheckpoint='1TB';

CREATE OR REPLACE TABLE t AS SELECT range::INT AS id FROM range(10);

ALTER TABLE t ADD COLUMN d TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

from t;

PIVOT VALUES(1,2),(1,3) x(y,z) ON x USING FIRST(y) ORDER BY 1;

CREATE TABLE t_add (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_add VALUES (1, 10), (2, 20);

DELETE FROM t_add WHERE id = 1;

ALTER TABLE t_add ADD COLUMN extra INTEGER DEFAULT 0;

INSERT INTO t_add VALUES (1, 30, 0);

SELECT * FROM t_add ORDER BY id;

CREATE TABLE t_drop (id INTEGER PRIMARY KEY, val INTEGER, extra INTEGER);

INSERT INTO t_drop VALUES (1, 10, 0), (2, 20, 0);

DELETE FROM t_drop WHERE id = 1;

ALTER TABLE t_drop DROP COLUMN extra;

INSERT INTO t_drop VALUES (1, 30);

SELECT * FROM t_drop ORDER BY id;

CREATE TABLE t_type (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_type VALUES (1, 10), (2, 20);

DELETE FROM t_type WHERE id = 1;

ALTER TABLE t_type ALTER val TYPE BIGINT;

INSERT INTO t_type VALUES (1, 30);

SELECT * FROM t_type ORDER BY id;

CREATE TABLE tbl1 (id INT);

CREATE SEQUENCE seq;

CREATE TABLE tbl2 (
	id INT DEFAULT nextval('seq')
);

ALTER SEQUENCE seq OWNED BY tbl1;

CREATE TABLE tbl1 (
	id INT
);

drop table tbl1;

drop sequence seq;

SELECT * FROM integers;

INSERT INTO t1 SELECT range, range FROM range(10000);

EXPLAIN SELECT * FROM t1;

SET preserve_insertion_order = false;

SET threads = 1;

SET memory_limit = '4MB';

CREATE TABLE t (id INT, s VARCHAR);

INSERT INTO t SELECT range, repeat('a', 100) FROM range(5000);

UPDATE t SET s = repeat('b', 100);

SET memory_limit = '1.5MB';

SET memory_limit = '10MB';

SELECT count(*) FROM t WHERE s = repeat('b', 100);

SET memory_limit = '6MB';

CREATE TABLE d (id INT PRIMARY KEY);

INSERT INTO d SELECT range FROM range(10);

DELETE FROM d WHERE id < 5;

SELECT count(*) FROM d;

SET memory_limit = '3.3MB';

INSERT INTO d VALUES (100);

SELECT list(id ORDER BY id) FROM d;

INSERT INTO d SELECT range FROM range(5);

CREATE TABLE pk (k INTEGER PRIMARY KEY, u INTEGER UNIQUE, v VARCHAR);

INSERT INTO pk VALUES (0, 0, 'seed');

SELECT count(*), count(DISTINCT k) FROM pk;

SELECT v FROM pk WHERE k = 5000;

INSERT INTO pk SELECT i, i, 'retry' FROM range(1, 5000) r(i);

SELECT count(*), count(DISTINCT k), count(DISTINCT u) FROM pk;

CREATE TABLE ix (k INTEGER PRIMARY KEY, j INTEGER, l BIGINT);

CREATE INDEX ix_e ON ix ((j + l));

INSERT INTO ix SELECT i, 1, i FROM range(1, 5000) r(i);

SELECT count(*) FROM ix;

CREATE TABLE pk (k INTEGER PRIMARY KEY, v VARCHAR);

INSERT INTO pk VALUES (1, 'a'), (2, 'b');

INSERT INTO pk VALUES (3, 'c'), (4, 'd');

SET debug_force_flush_append_failure = true;

SET debug_force_flush_append_failure = false;

SELECT count(*), max(k) FROM pk;

INSERT INTO pk VALUES (3, 'c2'), (4, 'd2');

CREATE TABLE m (k INTEGER PRIMARY KEY);

INSERT INTO m SELECT i FROM range(122880) r(i);

SELECT count(*) FROM m;

CREATE TABLE t (server_id INTEGER, account VARCHAR, n INTEGER, payload VARCHAR, PRIMARY KEY (server_id, account));

INSERT INTO t SELECT 11, 'old' || i, 0, 'x' FROM range(100) r(i);

SET max_temp_directory_size = '0KB';

INSERT OR REPLACE INTO t SELECT 11, 'old' || i, 1, 'x' FROM range(50) r(i);

INSERT INTO t SELECT 12, 'key' || i || repeat('k', 1000), 0, 'x' FROM range(20000) r(i);

SET memory_limit = '70MB';

RESET memory_limit;

RESET max_temp_directory_size;

SELECT count(*), count(*) FILTER (WHERE server_id = 11) FROM t;

CREATE SCHEMA foo;

DROP SCHEMA foo CASCADE;

select schema_name from duckdb_schemas() where schema_name = 'foo';

CREATE TABLE t1 (id INT);

INSERT INTO t1 (id) VALUES (1);

UPDATE t1 SET id = 2 WHERE id = 1;

ALTER TABLE t1 ADD COLUMN c0 INT DEFAULT 0;

select * from t1;

ALTER TABLE t1 ADD COLUMN c1 VARCHAR DEFAULT repeat('a', 5);

ALTER TABLE t1 DROP COLUMN c0;

CREATE TABLE t2 (id INT);

INSERT INTO t2 (id) VALUES (10), (20), (30);

ALTER TABLE t2 ADD COLUMN c0 INT DEFAULT 7;

ALTER TABLE t2 RENAME TO t3;

SELECT * FROM t3 ORDER BY id;

SELECT src.rowid sr, b, test.rowid tr, a FROM src, test WHERE src.b = test.a ORDER BY a;

SELECT b FROM src;

SELECT * FROM integers ORDER BY i;

SET index_scan_percentage=1.0;

SET index_scan_max_count=1;

CREATE TABLE t_drop (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_drop SELECT i, i * 10 FROM range(1000) tbl(i);

SELECT COUNT(*) FROM t_drop;

EXPLAIN ANALYZE SELECT val FROM t_drop WHERE id = 42;

SELECT val FROM t_drop WHERE id = 42;

CREATE TABLE t_replace (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_replace SELECT i, i * 10 FROM range(1000) tbl(i);

SELECT COUNT(*) FROM t_replace;

EXPLAIN ANALYZE SELECT val FROM t_replace WHERE id = 42;

SELECT val FROM t_replace WHERE id = 42;

CREATE TABLE t_alter (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_alter SELECT i, i * 10 FROM range(1000) tbl(i);

SELECT COUNT(*) FROM t_alter;

EXPLAIN ANALYZE SELECT val FROM t_alter WHERE id = 42;

SELECT val FROM t_alter WHERE id = 42;

SELECT COUNT(*), MIN(id), MAX(id), MIN(extra), MAX(extra) FROM t_alter;

EXPLAIN ANALYZE SELECT val FROM t_alter WHERE id = 700;

SELECT val FROM t_alter WHERE id = 700;

SELECT COUNT(*) FROM t_alter WHERE id = 42;

CREATE TABLE t_same_tx (id INTEGER PRIMARY KEY, val INTEGER);

INSERT INTO t_same_tx SELECT i, i * 10 FROM range(1000) tbl(i);

DELETE FROM t_same_tx WHERE id < 500;

ALTER TABLE t_same_tx ADD COLUMN extra INTEGER DEFAULT 0;

SELECT COUNT(*), MIN(id), MAX(id), MIN(extra), MAX(extra) FROM t_same_tx;

EXPLAIN ANALYZE SELECT val FROM t_same_tx WHERE id = 700;

SELECT val FROM t_same_tx WHERE id = 700;

SELECT COUNT(*) FROM t_same_tx WHERE id = 42;

CREATE TABLE integers(i INTEGER PRIMARY KEY);

INSERT INTO integers VALUES (1);

INSERT INTO integers SELECT i FROM range(2, 131068, 1) t1(i);

INSERT INTO integers VALUES (2);

INSERT INTO integers VALUES (3);

INSERT INTO integers VALUES (4);

SELECT * FROM integers ORDER BY 1;

DROP TABLE integers;

INSERT INTO integers VALUES (1), (2), (3);

SELECT COUNT(*) FROM integers;

UPDATE integers SET i = 5 WHERE i = 4;

SELECT i FROM integers WHERE i = 5;

SELECT i FROM integers WHERE i = 4;

SELECT i FROM integers ORDER BY i;

SELECT COUNT(*) FROM integers WHERE i=1;

SELECT COUNT(*) FROM integers WHERE i=4;

INSERT INTO integers SELECT i FROM range(2, 4097, 1) t1(i);

SELECT MAX(i) FROM integers;

CREATE TABLE issue2241 (id text primary key);

INSERT INTO issue2241 VALUES ('Alice');

INSERT INTO issue2241 VALUES ('Bob');

DELETE FROM issue2241 WHERE id = 'Bob';

SELECT i FROM integers WHERE i=1;

SELECT i FROM integers WHERE i=4;

SELECT j FROM integers WHERE i=1;

CREATE TABLE integers(i INTEGER);

SELECT SUM(i) FROM integers;

SELECT COUNT(*), COUNT(DISTINCT ROWID) FROM integers WHERE i=1;

SELECT COUNT(*) FROM integers WHERE i=2;

SELECT COUNT(*) FROM integers WHERE i=3;

DELETE FROM integers WHERE i=1;

SET current_transaction_invalidation_policy='ALL_ERRORS_INVALIDATE_TRANSACTION';

create table audit(i int);

insert into audit values (21);

abort;

insert into audit values (22);

select count(*) from audit;

CREATE TABLE p(i INTEGER);

INSERT INTO p VALUES (7);

CREATE SEQUENCE ps;

BEGIN TRANSACTION READ ONLY;

CREATE TEMP TABLE t(i INTEGER PRIMARY KEY);

UPDATE t SET i = i + 10 WHERE i = 3;

DELETE FROM t WHERE i = 1;

INSERT OR REPLACE INTO t VALUES (2);

ALTER TABLE t RENAME COLUMN i TO k;

CREATE INDEX t_k ON t(k);

CREATE TEMP VIEW v AS SELECT k FROM t;

SELECT k FROM v ORDER BY k;

CREATE TEMP TABLE snapshot AS SELECT i FROM p;

INSERT INTO snapshot SELECT i + 1 FROM p;

SELECT i FROM snapshot ORDER BY i;

CREATE TEMP TABLE tr(i INTEGER);

CREATE TEMP TABLE audit(msg VARCHAR);

CREATE TRIGGER trg AFTER INSERT ON tr FOR EACH STATEMENT INSERT INTO audit VALUES ('fired');

INSERT INTO tr VALUES (1);

SELECT msg FROM audit;

CREATE TEMP SEQUENCE s;

SELECT nextval('s'), nextval('s');

SELECT setval('s', 10);

SELECT currval('s');

DROP SEQUENCE s;

DROP VIEW v;

DROP INDEX t_k;

DROP TRIGGER trg ON tr;

CREATE TEMP TABLE c AS SELECT range i FROM range(3);

CREATE TEMP SEQUENCE cs;

SELECT nextval('cs');

SELECT sum(i), nextval('cs') FROM c;

CREATE TABLE a(i INTEGER);

INSERT INTO a VALUES (42);

SELECT * FROM a;

INSERT INTO a VALUES (44);

SELECT i FROM a;

DROP TABLE a;

INSERT INTO a VALUES (45);

INSERT INTO a VALUES (46);

INSERT INTO integers VALUES (1), (2);

SELECT 42;

START TRANSACTION;

CREATE TABLE integers(i INTEGER, j INTEGER);

INSERT INTO integers VALUES (1, 1), (2, 2), (3, 3);

ALTER TABLE integers ADD COLUMN k INTEGER DEFAULT 4;

ALTER TABLE integers ALTER j TYPE BIGINT;

INSERT INTO integers VALUES (1, 3), (2, 3);

UPDATE integers SET j=5 WHERE i=2;

DELETE FROM integers WHERE i=2;

ALTER TABLE integers DROP COLUMN j;

CREATE TABLE integers(i INTEGER PRIMARY KEY, j INTEGER);

INSERT INTO integers VALUES (1, 3);

DELETE FROM integers;

INSERT INTO integers VALUES (1, 2);

UPDATE integers SET i=3 WHERE i=2;

SELECT nextval('seq');

SELECT * FROM t ORDER BY id;

SELECT * FROM pos ORDER BY fname;

INSERT INTO integers FROM range(1000);

SELECT MIN(i), MAX(i), COUNT(*) FROM integers;

INSERT INTO integers FROM range(10000);

SELECT typeof(txid_current()), txid_current() = current_transaction_id();

SET VARIABLE current_txid = txid_current();

SELECT txid_current() = getvariable('current_txid');

PREPARE txid AS SELECT txid_current() = getvariable('current_txid');

EXECUTE txid;

ATTACH ':memory:' AS txid_first;

ATTACH ':memory:' AS txid_second;

USE txid_first;

USE txid_second;

SELECT txid_current() = getvariable('current_txid'), txid_current() = current_transaction_id();

SELECT count(DISTINCT txid_current()), bool_and(txid_current() = getvariable('current_txid')) FROM range(5000);

SELECT * FROM hugeints ORDER BY 1;

SELECT COUNT(DISTINCT h) FROM hugeints;

SELECT h, COUNT(*) FROM hugeints GROUP BY h ORDER BY 2 DESC;

UPDATE hugeints SET h=h+1 WHERE h=100;

SELECT * FROM interval ORDER BY 1;

SELECT COUNT(DISTINCT t) FROM interval;

SELECT t, COUNT(*) FROM interval GROUP BY t ORDER BY 2 DESC;

SELECT * FROM uhugeints ORDER BY 1;

SELECT COUNT(DISTINCT h) FROM uhugeints;

SELECT h, COUNT(*) FROM uhugeints GROUP BY h ORDER BY 2 DESC;

UPDATE uhugeints SET h=h+1 WHERE h=100;

CREATE TABLE t (id INTEGER, a INTEGER);

INSERT INTO t SELECT i, 0 FROM range(3000) t(i);

CREATE TABLE t2 AS FROM t;

CREATE TABLE t3 AS FROM t;

CREATE TABLE t4 AS FROM t;

CREATE TABLE t6 AS FROM t;

CREATE TABLE t7 AS FROM t;

CREATE TABLE t8 AS FROM t;

CREATE TABLE t9 AS FROM t;

CREATE TABLE t10 AS FROM t;

CREATE TABLE t11 AS FROM t;

SELECT COUNT(*) FROM t2;

SELECT id, a FROM t2 WHERE id IN (3, 7, 9, 11, 13, 15) ORDER BY id;

SELECT COUNT(*) FROM t3;

SELECT COUNT(*) FROM t4;

SELECT COUNT(*) FROM t6;

SELECT COUNT(*), SUM(a) FROM t6;

SELECT COUNT(*) FROM t7;

SELECT COUNT(*), SUM(a) FROM t7;

UPDATE t8 SET a = 1 WHERE id < 2048;

UPDATE t8 SET a = 5 WHERE id = 100;

SELECT COUNT(*), SUM(a) FROM t8;

UPDATE t9 SET a = 1 WHERE id < 2048;

UPDATE t9 SET a = 3 WHERE id = 1500;

SELECT COUNT(*), SUM(a) FROM t9;

UPDATE t10 SET a = 1 WHERE id < 10;

SET GLOBAL debug_force_commit_failure = true;

SET GLOBAL debug_force_commit_failure = false;

UPDATE t10 SET a = 3 WHERE id = 1500;

SELECT COUNT(*), SUM(a) FROM t10;

SELECT COUNT(*), SUM(a) FROM t11;

UPDATE t11 SET a = 3 WHERE id = 1;

CREATE TABLE d1 AS SELECT i AS id, 0 AS a FROM range(4096) t(i);

DELETE FROM d1 WHERE id % 10 = 0;

SELECT COUNT(*), SUM(a) FROM d1;

UPDATE d1 SET a = 1;

UPDATE d1 SET a = 5;

UPDATE d1 SET a = 2 WHERE id = 1;

DELETE FROM d1 WHERE id = 2;

CREATE TABLE d2 AS SELECT i AS id, 0 AS a FROM range(2048) t(i);

UPDATE d2 SET a = 1 WHERE id % 2 = 1;

SELECT COUNT(*), SUM(a) FROM d2;

UPDATE d2 SET a = 2 WHERE id = 0;

UPDATE d2 SET a = 2 WHERE id = 1;

CREATE TABLE d3 AS SELECT i AS id, 0 AS a FROM range(2048) t(i);

UPDATE d3 SET a = 1 WHERE id % 2 = 1;

SELECT COUNT(*), SUM(a) FROM d3;

UPDATE d3 SET a = 2 WHERE id = 1;

CREATE TABLE d4 AS SELECT i AS id, 0 AS a FROM range(2048) t(i);

DELETE FROM d4 WHERE id % 3 = 0;

UPDATE d4 SET a = 1;

SELECT COUNT(*), SUM(a) FROM d4;

UPDATE d4 SET a = 2 WHERE id = 1;

CREATE TABLE d5 AS SELECT i AS id, 0 AS a FROM range(2048) t(i);

DELETE FROM d5 WHERE id % 3 = 0;

UPDATE d5 SET a = 1;

DELETE FROM d5 WHERE id % 3 = 1;

SELECT COUNT(*), SUM(a) FROM d5;
