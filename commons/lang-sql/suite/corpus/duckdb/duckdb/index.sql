SET immediate_transaction_mode = true;

CREATE UNIQUE INDEX unique_idx ON tbl_comp((d || 'hello'), (a + 42));

CREATE UNIQUE INDEX lookup_idx ON tbl_comp(c);

INSERT INTO tbl_comp VALUES (2, 'hello', 1, 'world')
ON CONFLICT (c, b) DO UPDATE SET a = excluded.a, d = excluded.d;

INSERT INTO tbl_comp VALUES (3, 'hoi', 2, 'wereld');

SELECT a, b, gen, c, d FROM tbl_comp WHERE c = 2;

CREATE TABLE test2 (id INT PRIMARY KEY, payload VARCHAR);

INSERT INTO test2 VALUES (1, 'row 1 from test 2');

BEGIN;

INSERT INTO test1 SELECT * FROM test2;

SET max_vacuum_tasks = 0;

CREATE TABLE u_7182 (iu INTEGER PRIMARY KEY, ju INTEGER REFERENCES t_7182 (it));

INSERT INTO u_7182 VALUES (1, NULL);

SELECT iu, ju, rowid FROM u_7182 WHERE iu = 1;

INSERT INTO tunion_5807 SELECT 1, 41;

SELECT id, u, rowid FROM tunion_5807 WHERE id = 1;

INSERT INTO workers_5771 VALUES (1, 'wagner', '123');

UPDATE workers_5771 SET worker = 'leo' WHERE id = 1;

CREATE TABLE test_4886 (i INTEGER PRIMARY KEY);

UPDATE test_4886 SET i = 4 WHERE i = 1;

SELECT i, rowid FROM test_4886 WHERE i = 1;

CREATE TABLE tbl_1631 (
	id INTEGER PRIMARY KEY,
	c1 text NOT NULL UNIQUE,
	c2 text NOT NULL);

UPDATE tbl_1631 SET c1 = 'ghi', c2 = 'mno' WHERE id = 2;

CREATE TABLE c_4214 (id INTEGER NOT NULL PRIMARY KEY);

INSERT INTO c_4214 (id) VALUES (1), (2);

UPDATE a_4214 SET c_id = 2 WHERE id = 1;

CREATE TABLE tag_8764 (
  key VARCHAR(65535) NOT NULL,
  name VARCHAR(65535) NULL,
  value VARCHAR(65535) NOT NULL,
  PRIMARY KEY (key, name)
);

CREATE UNIQUE INDEX idx_value_8764 ON tag_8764(value);

UPDATE tag_8764 SET value = 'new_value' WHERE key = 'key1' AND name = 'name1';

CREATE TABLE t_11288 (i INT PRIMARY KEY, j MAP(VARCHAR, VARCHAR));

UPDATE t_11288 SET j = MAP(['c'], ['d']) WHERE i = 1;

CREATE TABLE t_4807 (id INT PRIMARY KEY, u UNION (i INT));

UPDATE t_4807 SET u = 42 WHERE id = 1;

CREATE TABLE t_14133 (i INT PRIMARY KEY, s VARCHAR);

DELETE FROM t_14133 WHERE i IN (SELECT i FROM generate_series(1, 20) s(i));

SELECT COUNT(*), MIN(i), MAX(i) FROM t_14133;

INSERT INTO tbl_6500 VALUES (1, 100), (2, 200);

CHECKPOINT;

SELECT i, j FROM tbl_6500 ORDER BY ALL;

SET checkpoint_threshold = '10.0 GB';

CREATE TABLE tbl (id INT PRIMARY KEY);

DELETE FROM tbl WHERE id = 1;

INSERT INTO a VALUES (1, 4);

INSERT INTO a SELECT i id, NULL c FROM range(-2, -250000, -1) tbl(i);

SELECT c FROM a WHERE id=1;

INSERT INTO a SELECT i id, -i c FROM range(-2, -250000, -1) tbl(i);

INSERT INTO tbl VALUES(1, [1, 2, 3]), (2, [42]);

UPDATE tbl SET l1 = [1, 2, 4] WHERE i = 1;

INSERT OR REPLACE INTO tbl VALUES (2, [44]);

CREATE TABLE tbl(i INT PRIMARY KEY);

INSERT INTO tbl2 VALUES (42);

DROP TABLE tbl;

CREATE TABLE tbl (id INT PRIMARY KEY, payload VARCHAR[]);

SELECT id, payload, rowid FROM tbl WHERE id = 1;

INSERT INTO tbl_list VALUES (1, ['first payload']);

SELECT id, payload, rowid FROM tbl_list ORDER BY ALL;

INSERT INTO tbl_rollback VALUES (1, ['first payload']);

CREATE TABLE tbl (id INT PRIMARY KEY, payload VARCHAR);

SELECT id, payload, rowid FROM tbl ORDER BY ALL;

INSERT INTO tbl VALUES (1, 'row 1'), (2, 'row 2'), (3, 'row 3');

INSERT INTO tbl_list SELECT range, [range || ' payload'] FROM range(5);

INSERT INTO tbl_list SELECT range + 10, [(range + 10) || ' payload'] FROM range(3000);

DELETE FROM tbl_list USING range(100) t(i) RETURNING id, payload;

SELECT id, payload, rowid FROM tbl_list WHERE id = 2;

SELECT id, payload FROM tbl WHERE id = 3;

SELECT id, payload, rowid FROM tbl WHERE id = 3;

INSERT INTO tbl_local VALUES (1, ['first payload']);

CREATE TABLE hero (
        name VARCHAR NOT NULL,
        secret_name VARCHAR NOT NULL,
        age INTEGER,
        PRIMARY KEY (name));

INSERT INTO hero (name, secret_name, age)
VALUES
	('Captain North America', 'Esteban Rogelios', 93),
	('Rusty-Man', 'Tommy Sharp', 48),
	('Tarantula', 'Natalia Roman-on', 32),
	('Spider-Boy', 'Pedro Parqueador', 17),
	('Captain North America', 'Esteban Rogelios', 93)
ON CONFLICT (name) DO UPDATE
SET	secret_name = EXCLUDED.secret_name,
	age = EXCLUDED.age;

CREATE INDEX kve_idx ON kvp (expiration);

SELECT key, value, expiration, cache FROM kvp;

INSERT INTO kvp VALUES ('/key', 'value', 20000000, false)
ON CONFLICT DO UPDATE SET
	value = excluded.value,
	expiration = excluded.expiration,
	cache = excluded.cache;

INSERT INTO v0 (v2 ,v1 ) VALUES ('358677 4 2 1', 7), ('a%', 1);

CREATE TABLE t(a INTEGER, b INTEGER);

CREATE INDEX CONCURRENTLY i ON t(a);

CREATE INDEX CONCURRENTLY IF NOT EXISTS j ON t(b);

SELECT a, b FROM t WHERE a = 2;

SELECT COUNT(*) FROM duckdb_indexes;

CREATE INDEX IF NOT EXISTS my_idx ON tbl(i);

INSERT INTO integers SELECT * FROM range(10);

SELECT * FROM integers WHERE i=1;

CREATE INDEX i_index ON integers(i);

INSERT INTO integers SELECT * FROM repeat(1, 1500) t1(i);

INSERT INTO integers SELECT * FROM repeat(3, 1500) t1(i);

SELECT count(i) FROM integers WHERE i > 1 AND i < 3;

SELECT count(i) FROM integers WHERE i > 1;

SELECT count(i) FROM integers WHERE i < 5;

DROP TABLE integers;

DELETE FROM integers WHERE i = 5;

CREATE UNIQUE INDEX i0 ON t0(c0);

SELECT * FROM t0 WHERE t0.c0 = 1;

INSERT INTO merge_violation SELECT range FROM range(2048);

INSERT INTO merge_violation VALUES (2047);

INSERT INTO local_index VALUES (1);

CREATE UNIQUE INDEX local_idx ON local_index(i);

SELECT i FROM local_index;

INSERT INTO A VALUES (1, 1, 1);

CREATE TABLE B (B1 INTEGER,B2 INTEGER, B3 INTEGER);

INSERT INTO B VALUES (2, 2, 2);

INSERT INTO C VALUES ('t1', 1, 1);

SELECT A2 FROM A WHERE A1=1;

CREATE INDEX B_index ON B (B1);

DROP INDEX IF EXISTS A_index;

create table lists(id int, l int[]);

SELECT SUM(i) FROM integers WHERE i > 0;

DROP INDEX idx;

DELETE FROM t WHERE a = 1;

SELECT * FROM t ORDER BY a;

INSERT INTO integers VALUES (1);

SELECT * FROM integers WHERE i <= 1;

SELECT * FROM integers WHERE i >= 1;

SELECT * FROM integers WHERE i < 1;

SELECT * FROM integers WHERE i > 1;

SELECT * FROM integers WHERE i = 2;

INSERT INTO t VALUES (1, [3, 1, 2], 'abc');

SELECT parameter_types, stability FROM duckdb_functions() WHERE function_name = 'age' AND parameter_types[1] = 'TIMESTAMP' ORDER BY length(parameter_types);

CREATE INDEX i_cast ON t ((CASE WHEN can_cast_implicitly(id, 1.5) THEN id ELSE -id END));

CREATE INDEX i_sort ON t ((list_sort(l)[1]));

CREATE INDEX i_dlev ON t ((damerau_levenshtein(s, 'acb')));

SELECT id FROM t WHERE levenshtein(s, 'abd') = 2;

SELECT id FROM t WHERE list_sort(l)[1] = 4;

INSERT INTO t VALUES (3, [7], 'abe');

INSERT INTO t VALUES (4, [1], 'ábdéx');

CREATE TABLE d (id INTEGER, s VARCHAR);

CREATE UNIQUE INDEX i_d ON d ((damerau_levenshtein(s, 'ácb')));

DELETE FROM d WHERE id = 1;

SELECT id, damerau_levenshtein(s, 'ácb') FROM d ORDER BY id;

INSERT INTO v VALUES (1, {'a': 'one'}::VARIANT), (2, {'a': {'b': [1, 2, 3], 'c': 'a string longer than the inline size'}}::VARIANT);

INSERT INTO v VALUES (3, {'a': 'two'}::VARIANT), (4, {'a': {'b': [4], 'c': 'another string longer than the inline size'}}::VARIANT);

INSERT INTO v VALUES (5, {'a': {'b': [1, 2, 3], 'c': 'a string longer than the inline size'}}::VARIANT);

INSERT INTO t VALUES (5, [2], 'abd');

INSERT INTO t VALUES (6, [1], 'abdy');

SELECT id, variant_extract_string(x, 'a') FROM v WHERE id > 4 ORDER BY id;

SET VARIABLE x = 42;

CREATE INDEX i8 ON w.t((lower(s)));

DETACH w;

SELECT count(*) FROM w.t;

CREATE TABLE s (s STRUCT(n INTEGER));

CREATE INDEX idx ON s ((s.n::VARCHAR));

CREATE INDEX idx ON s ((CAST(s.n AS VARCHAR)));

CREATE INDEX idx2 ON s ((s.s.n + 1));

CREATE TABLE t (t INTEGER, u INTEGER);

SELECT sql FROM duckdb_indexes() WHERE index_name = 'idx_t';

CREATE TABLE t (id INTEGER, ts TIMESTAMPTZ, s VARCHAR, naive TIMESTAMP);

CREATE TYPE ts_enum AS ENUM ('2026-01-01 00:00:00');

CREATE INDEX i_enum_text ON nested ((e::VARCHAR));

CREATE INDEX i_generated_epoch ON generated (ts_epoch);

CREATE INDEX i_map_text ON nested (((s::MAP(VARCHAR,VARCHAR))['k']));

CREATE INDEX i_epoch ON t ((epoch_us(ts)));

CREATE INDEX i_epoch_seconds ON t ((epoch(ts)));

CREATE INDEX i_date_part_struct_epoch ON t ((date_part(['epoch'], ts).epoch));

CREATE INDEX i_strptime ON t ((strptime(s, '%Y-%m-%d %H:%M:%S')));

SET TimeZone = 'Europe/Amsterdam';

SELECT count(*) FROM t;

CREATE TABLE days AS SELECT TIMESTAMPTZ '2000-01-01 00:00:00+00' + i * INTERVAL '1 day' AS ts FROM range(10000) r(i);

EXPLAIN SELECT count(*) FROM days WHERE era(ts) = 0;

CREATE TABLE pruning.days AS SELECT TIMESTAMPTZ '2000-01-01 00:00:00+00' + i * INTERVAL '1 day' AS ts FROM range(8192) r(i);

EXPLAIN ANALYZE SELECT ts FROM pruning.days WHERE date_diff('day', TIMESTAMPTZ '2000-01-01 00:00:00+00', ts) = 3000;

CREATE TABLE w.t(v BIGINT);

INSERT INTO w.t VALUES (1), (2);

INSERT INTO w.t VALUES (3);

SET checkpoint_threshold = '1TB';

CHECKPOINT w;

CREATE OR REPLACE MACRO m(x) AS CASE WHEN x > 200000 THEN CAST('boom' || x::VARCHAR AS BIGINT) ELSE x + 1 END;

INSERT INTO w.t VALUES (0);

INSERT INTO w.t VALUES (100000);

SELECT count(*) FROM w.t WHERE m(v) = 200011;

CREATE TABLE t(x INT);

INSERT INTO t VALUES (1);

DROP INDEX i;

DROP TABLE t;

USE db;

SET index_scan_percentage = 1.0;

CREATE TABLE node4_under_prefix (k INTEGER);

INSERT INTO node4_under_prefix SELECT (i << 16) | j FROM range(5000) r(i), range(2) s(j) ORDER BY i, j;

SELECT count(*) FROM node4_under_prefix WHERE k = (4321 << 16);

CREATE TABLE prefix_under_node4 (k INTEGER);

INSERT INTO prefix_under_node4 SELECT (i << 16) | (j << 8) FROM range(5000) r(i), range(2) s(j) ORDER BY i, j;

SELECT count(*) FROM prefix_under_node4 WHERE k = (4321 << 16);

CREATE TABLE node7_under_gate (k INTEGER);

INSERT INTO node7_under_gate SELECT i // 2 FROM range(10000) r(i) ORDER BY i;

SELECT count(*) FROM node7_under_gate WHERE k = 4321;

CREATE TABLE node4_under_gate (k INTEGER);

INSERT INTO node4_under_gate SELECT i % 5000 FROM range(10000) r(i) ORDER BY i;

SELECT count(*) FROM node4_under_gate WHERE k = 4321;

DELETE FROM node4_under_prefix;

DELETE FROM node7_under_gate;

CREATE TABLE source(i INTEGER);

INSERT INTO integers SELECT * FROM source WHERE i % 2 = 0;

SELECT * FROM integers ORDER BY 1;

SELECT * FROM integers WHERE i<=3 ORDER BY 1;

UPDATE integers SET i=3 WHERE i=4;

SELECT * FROM integers WHERE i > 0 ORDER BY 1;

SELECT * FROM integers WHERE i < 5;

CREATE INDEX i_index ON integers using art(j);

UPDATE integers SET j=10 WHERE i=1;

DELETE FROM integers WHERE rowid=1;

SELECT * FROM integers WHERE j=1;

SELECT * FROM integers ORDER BY j;

INSERT INTO bar (col1, col2) VALUES (NULL, 'one');

UPDATE bar AS original SET col1 = 'a';

CREATE TABLE t1 (c1 DECIMAL(4, 3));

CREATE INDEX i1 ON t1 (TRY_CAST(c1 AS USMALLINT));

CREATE TABLE t2 (c1 VARCHAR);

INSERT INTO t2 VALUES (decode('g\x00'::BLOB)::VARCHAR),('g');

CREATE INDEX i22 ON t2 (c1);

INSERT INTO t3 VALUES (0), (85491);

CREATE TABLE t4 (c1 BOOLEAN);

INSERT INTO t4 VALUES (1), (0), (1), (1);

CREATE TABLE t_leak (c1 INT);

CREATE TABLE t21 (c1 INT);

INSERT INTO t21 VALUES (1);

CREATE INDEX i1 ON t1 (c1);

INSERT INTO t1(c2) (SELECT DISTINCT 'b');

create index my_index on test(i);

select count(*) from test SEMI JOIN (select i from test using sample reservoir(10) repeatable (42)) USING (i);

create or replace table sample as select i from test using sample reservoir(10) repeatable (42);

select count(*) from test SEMI JOIN sample USING (i);

CREATE TABLE t0(c0 INT);

UPDATE t0 SET c0=0;

DELETE FROM t0;

DROP INDEX i1;

INSERT INTO t_rollback SELECT range, range FROM range(1000);

DROP INDEX i2;

EXPLAIN ANALYZE SELECT * FROM t_rollback WHERE a = 1;

INSERT INTO indexed_strings(a, b, c) VALUES (1, 10, 100001), (2, 42, 100002);

SELECT a FROM indexed_strings WHERE b = 42 ORDER BY a;

EXPLAIN ANALYZE SELECT a FROM indexed_strings WHERE c = 100002;

CREATE TABLE up(
    a INTEGER PRIMARY KEY,
    g INTEGER AS (a + b),
    b INTEGER DEFAULT 10,
    c INTEGER UNIQUE
);

INSERT INTO up(a, b, c) VALUES (1, 42, 200001)
ON CONFLICT(a) DO UPDATE SET b = excluded.b, c = excluded.c;

SELECT count(*) FROM up WHERE b = 42;

CREATE TABLE t(a INTEGER, p INTEGER);

CREATE INDEX t_a ON t(a);

SELECT p FROM t WHERE a IN (1, 3) AND a IS NOT DISTINCT FROM 1 ORDER BY p;

SELECT p FROM t WHERE a IN (1, 3) AND a IS DISTINCT FROM 1 ORDER BY p;

INSERT INTO t0(c1, c0) VALUES (TIMESTAMP '1969-12-28 23:02:08', 1);

CREATE INDEX i2 ON t0(c1, c0);

CREATE SEQUENCE seq;

CREATE INDEX edge1_idx ON edge (x1);

INSERT INTO path SELECT 1, y0, y1 FROM (SELECT DISTINCT edge0.x0 AS y0, edge0.x1 AS y1 FROM edge AS edge0 WHERE edge0.it = 0 AND true AND NOT EXISTS (SELECT * from path AS pre WHERE pre.x0 = edge0.x0 AND pre.x1 = edge0.x1));

CREATE TABLE key_value_pairs (key VARCHAR PRIMARY KEY, value VARCHAR);

CREATE TABLE keys_to_lookup (key VARCHAR PRIMARY KEY);

SELECT COUNT(*) FROM
(
	SELECT key, value
	FROM
		keys_to_lookup
		JOIN key_value_pairs USING(key)
);

CREATE UNIQUE INDEX sqlsim0 ON td(tz);

CREATE TABLE tab1(c2 DATE NOT NULL);

START TRANSACTION;

INSERT INTO tab0 VALUES('2006-12-25');

INSERT INTO tab1 VALUES('2006-12-25');

CREATE TABLE t14(c0 BIGINT);

CREATE INDEX i1 ON t14(c0 );

create or replace table test as (
    select
        cast(unnest(range(1000)) as varchar) as x,
        cast(unnest(range(2000,3000)) as varchar) as y,
        cast(unnest(range(3000,4000)) as varchar) as z
);

create view test_view as (select z, y, x from test);

select z, y, x from test_view where x = '525';

create index test_upper_x on test(upper(x));

select z, y, x from test_view where upper(x) = '526';

CREATE TABLE t(a INTEGER, b VARCHAR);

CREATE VIEW v AS SELECT a, b FROM t;

EXPLAIN ANALYZE SELECT * FROM v WHERE b = 'x';

EXPLAIN ANALYZE SELECT * FROM v WHERE UPPER(b) = 'X';

INSERT INTO integers VALUES (10, 1, 'hello'), (11, 2, 'world');

SELECT * FROM integers WHERE i=10;

SELECT k FROM integers WHERE k='hello';

SELECT * FROM integers WHERE k='hello';

SELECT * FROM integers WHERE i = 1 AND j = 2;

INSERT INTO duplicates SELECT range + 500 FROM range(500);

INSERT INTO duplicates SELECT range + 1000 FROM range(500);

SELECT id FROM duplicates WHERE id = 255;

INSERT INTO leaf_merge_1 SELECT range, range FROM range (0, 2048, 1);

CREATE INDEX idx_merge_1 ON leaf_merge_1(id, id2);

INSERT INTO leaf_merge_2 SELECT range, range FROM range (0, 2048, 1);

CREATE INDEX idx_merge_2 ON leaf_merge_2(id, id2);

INSERT INTO tbl_dup_ser SELECT range FROM range(2043);

CREATE INDEX idx_dup_ser ON tbl_dup_ser(id);

DELETE FROM integers where rowid = 1;

DELETE FROM integers where rowid = 2;

SELECT sum(i) FROM integers WHERE i <= 2;

DELETE FROM integers WHERE i = 0;

DELETE FROM integers WHERE i=16;

SELECT sum(i) FROM integers WHERE i > 1;

INSERT INTO n48_tbl SELECT 'a', range FROM range(10000);

INSERT INTO n48_tbl SELECT 'c', range FROM range(25);

CREATE TABLE n48_free (id INTEGER);

CREATE INDEX idx_n48_free ON n48_free(id);

CREATE INDEX child_gate_in_place_idx ON child_gate_in_place(k);

DELETE FROM child_gate_in_place WHERE k IN (2);

CREATE INDEX child_gate_full_tail_idx ON child_gate_full_tail(k);

DELETE FROM child_gate_full_tail WHERE k IN (2);

CREATE INDEX child_gate_chain_full_idx ON child_gate_chain_full(k);

DELETE FROM child_gate_chain_full WHERE k IN (repeat('a', 30) || 'b');

CREATE INDEX child_gate_chain_room_idx ON child_gate_chain_room(k);

DELETE FROM child_gate_chain_room WHERE k IN (repeat('a', 20) || 'b');

CREATE INDEX child_gate_parent_node_idx ON child_gate_parent_node(k);

DELETE FROM child_gate_parent_node WHERE k IN (2);

CREATE INDEX child_inlined_parent_prefix_idx ON child_inlined_parent_prefix(k);

DELETE FROM child_inlined_parent_prefix WHERE k IN (2);

CREATE INDEX child_inlined_parent_node_idx ON child_inlined_parent_node(k);

DELETE FROM child_inlined_parent_node WHERE k IN (2);

CREATE INDEX child_prefix_parent_prefix_idx ON child_prefix_parent_prefix(k);

DELETE FROM child_prefix_parent_prefix WHERE k IN (131072);

CREATE INDEX child_prefix_parent_node_idx ON child_prefix_parent_node(k);

DELETE FROM child_prefix_parent_node WHERE k IN (131072);

CREATE INDEX child_prefix_to_gate_idx ON child_prefix_to_gate(k);

DELETE FROM child_prefix_to_gate WHERE k IN (131072);

CREATE INDEX child_prefix_overflow_idx ON child_prefix_overflow(k);

DELETE FROM child_prefix_overflow WHERE k IN (4294967297);

CREATE INDEX child_prefix_chain_idx ON child_prefix_chain(k);

DELETE FROM child_prefix_chain WHERE k IN ('pb');

CREATE INDEX gate_inline_all_the_way_up_idx ON gate_inline_all_the_way_up(k);

SELECT bool_and(rowid = v) FROM gate_inline_all_the_way_up;

CREATE TABLE gate_inline_into_node (k INTEGER, v INTEGER);

INSERT INTO gate_inline_into_node SELECT CASE WHEN i IN (0, 256, 65536) THEN 1 ELSE i + 10 END, i FROM range(65537) r(i);

DELETE FROM gate_inline_into_node WHERE v = 256;

CREATE INDEX gate_child_leaf_parent_prefix_idx ON gate_child_leaf_parent_prefix(k);

SELECT bool_and(rowid = v) FROM gate_child_leaf_parent_prefix;

CREATE TABLE gate_child_prefix_parent_prefix (k INTEGER, v INTEGER);

INSERT INTO gate_child_prefix_parent_prefix SELECT CASE WHEN i IN (0, 1, 65536) THEN 1 ELSE i + 10 END, i FROM range(65537) r(i);

DELETE FROM gate_child_prefix_parent_prefix WHERE v = 65536;

SELECT count(*) FROM child_gate_full_tail WHERE k = 1;

SELECT count(*) FROM child_gate_chain_room WHERE k = repeat('a', 20);

SELECT count(*) FROM child_gate_parent_node WHERE k = 256;

SELECT count(*) FROM child_inlined_parent_node WHERE k = 1;

SELECT count(*) FROM child_prefix_parent_prefix WHERE k = 66051;

SELECT count(*) FROM child_prefix_parent_node WHERE k = -1;

SELECT count(*) FROM child_prefix_parent_node WHERE k = 66052;

SELECT count(*) FROM child_prefix_overflow WHERE k = 1;

SELECT list_sort(list(v)) FROM gate_inline_all_the_way_up WHERE k = 1;

SELECT list_sort(list(v)) FROM gate_child_leaf_parent_prefix WHERE k = 1;

DELETE FROM gate_inline_all_the_way_up WHERE v = 0;

DELETE FROM gate_inline_into_node WHERE v = 65536;

SELECT count(*) FROM gate_inline_into_node WHERE k = 1;

SELECT count(*) FROM child_gate_in_place WHERE k IN (2);

SELECT count(*) FROM child_gate_full_tail WHERE k IN (2);

SELECT count(*) FROM child_gate_chain_full WHERE k IN (repeat('a', 30) || 'b');

SELECT count(*) FROM child_gate_chain_room WHERE k IN (repeat('a', 20) || 'b');

SELECT count(*) FROM child_gate_parent_node WHERE k IN (2);

SELECT count(*) FROM child_inlined_parent_prefix WHERE k IN (2);

SELECT count(*) FROM child_inlined_parent_node WHERE k IN (2);

SELECT count(*) FROM child_prefix_parent_prefix WHERE k IN (131072);

SELECT count(*) FROM child_prefix_parent_node WHERE k IN (131072);

SELECT count(*) FROM child_prefix_to_gate WHERE k IN (131072);

SELECT count(*) FROM child_prefix_overflow WHERE k IN (4294967297);

SELECT count(*) FROM child_prefix_chain WHERE k IN ('pb');

INSERT INTO gate_inline_into_node VALUES (1, -1);

SELECT count(*) FROM gate_child_leaf_parent_prefix WHERE k = 1;

SELECT count(*) FROM gate_child_prefix_parent_prefix WHERE k = 1;

DELETE FROM child_gate_full_tail;

DELETE FROM child_gate_chain_room;

DELETE FROM child_inlined_parent_prefix;

DELETE FROM child_prefix_parent_prefix;

DELETE FROM child_prefix_to_gate;

DELETE FROM child_prefix_chain;

DELETE FROM gate_inline_into_node;

DELETE FROM gate_child_prefix_parent_prefix;

INSERT OR IGNORE INTO db.t
	SELECT range || 'hello this is a long prefix', current_timestamp, range
	FROM range(1_000_000);

SET index_scan_max_count = 0;

INSERT INTO db.t
SELECT
	repeat('a', 80) || 'gate',
	repeat('b', 80) || 'tail',
	repeat('a', 80) || 'gate' || repeat('b', 80) || 'tail',
	i
FROM range(1, 10) AS r(i);

CREATE INDEX idx_t_compound ON db.t(k1, k2);

DETACH db;

SELECT payload
FROM db.t
WHERE k = repeat('a', 80) || 'gate' || repeat('b', 80) || 'tail'
ORDER BY payload;

SELECT payload
FROM db.t
WHERE k = repeat('a', 80) || 'gate' || repeat('b', 80) || 'taih';

DELETE FROM db.t WHERE payload = 1;

CREATE INDEX idx ON tbl(id);

CREATE TABLE tbl_varchar (id VARCHAR);

INSERT INTO tbl_varchar VALUES
	('hello I am a prefix, and it is a beautiful sommer evening, and the plants are blossoming - 1'),
	('hello I am a prefix, and it is a beautiful sommer evening, and the plants are blossoming - 2');

DELETE FROM tbl_varchar;

INSERT INTO tbl_varchar VALUES
	('0123456789-0123456789-0123456789-0123456789');

CREATE TABLE tbl1 (i INT);

DELETE FROM tbl1 WHERE i > 4;

SELECT COUNT(i) FROM tbl1 WHERE i = 1;

INSERT INTO integers SELECT 42 + 1 + range FROM range(5000);

SELECT COUNT(i) FROM integers WHERE i = 42;

CREATE INDEX idx ON t ((vertex_extract(g, 'x')));

SELECT count(*) FROM t WHERE vertex_extract(g, 'x') BETWEEN 2 AND vertex_extract(g, 'z');

CREATE INDEX idx_i ON tbl(i);

SELECT i FROM tbl WHERE i BETWEEN 100 AND 102 ORDER BY i;

EXPLAIN ANALYZE SELECT i FROM tbl WHERE i > 100 AND i < 103;

SELECT i FROM tbl WHERE i < 103 AND 100 <= i ORDER BY i;

SELECT COUNT(*) FROM integers WHERE i<1;

SELECT COUNT(*) FROM integers WHERE i=0;

SELECT COUNT(*) FROM integers WHERE i>0;

INSERT INTO integers SELECT i FROM RANGE(0, 2048, 1) t2(j), (VALUES (0), (1)) t1(i) ORDER BY j, i;

SELECT sum(i) FROM integers WHERE i >= -500 AND i <= -498;

SELECT sum(i) FROM integers WHERE i >= 10 AND i <= 15;

CREATE TABLE byte_edges(k INTEGER PRIMARY KEY);

EXPLAIN ANALYZE SELECT k FROM byte_edges WHERE k <= 1;

EXPLAIN ANALYZE SELECT k FROM byte_edges WHERE k > 254;

DELETE FROM byte_edges WHERE k BETWEEN 36 AND 255;

EXPLAIN ANALYZE
SELECT count(*), min(k), max(k), sum(k)
FROM byte_edges
WHERE k >= 0;

CREATE TABLE varchars(v VARCHAR PRIMARY KEY);

SELECT * FROM varchars WHERE v = 'hello';

SELECT * FROM varchars WHERE v = 'hello' || chr(0) || chr(0);

CREATE TABLE blobs(b BLOB PRIMARY KEY);

SELECT * FROM blobs WHERE b = '';

SELECT * FROM blobs WHERE b = '\x00\x01';

SELECT * FROM blobs WHERE b >= '\x01' ORDER BY b::VARCHAR;

INSERT INTO integers VALUES (1), (2), (4);

SELECT i FROM integers WHERE i = 2;

EXPLAIN ANALYZE EXECUTE v1(2);

CREATE TABLE test (x VARCHAR PRIMARY KEY);

INSERT INTO test VALUES ('def');

INSERT INTO test VALUES ('abcd');

DROP TABLE test;

CREATE TABLE test (x USMALLINT PRIMARY KEY);

SELECT x FROM test WHERE x > 20;

INSERT INTO test SELECT i FROM range(1, 135) tbl(i);

INSERT INTO test VALUES (256), (257);

CREATE TABLE scan_limits AS SELECT i::BIGINT AS id, i::BIGINT AS key FROM range(3) t(i);

SET index_scan_max_count = 2;

SELECT count(*), sum(id) FROM scan_limits WHERE key < 2;

CREATE TABLE candidate_reset AS SELECT i::BIGINT AS key FROM range(16) t(i);

CREATE INDEX idx_candidate_key ON candidate_reset(key);

EXPLAIN ANALYZE SELECT sum(key) FROM candidate_reset WHERE key < 8;

CREATE TABLE indexed AS
SELECT
	i::BIGINT AS id,
	((i::BIGINT * 15485863) % 131072)::BIGINT AS sparse_key
FROM range(131072) t(i);

SET threads = 32;

EXPLAIN ANALYZE SELECT count(*), count(DISTINCT id) FROM indexed WHERE sparse_key < 8192;

SET index_scan_max_count = 4096;

SELECT count(*), count(DISTINCT id) FROM indexed WHERE sparse_key < 4096;

EXPLAIN ANALYZE SELECT id FROM indexed WHERE sparse_key < 4096;

CREATE INDEX idx_reverse ON reverse_indexed(reverse_key);

SELECT count(*), count(DISTINCT id) FROM reverse_indexed WHERE reverse_key < 4096;

CREATE INDEX idx_duplicate ON duplicate_keys(key);

EXPLAIN ANALYZE SELECT count(*), count(DISTINCT id) FROM duplicate_keys WHERE key IN (1, 3);

INSERT INTO duplicate_keys
SELECT i, 1 FROM range(10000, 10100) t(i);

CREATE TABLE tab0(pk INTEGER PRIMARY KEY, col0 INTEGER, col1 FLOAT, col2 TEXT, col3 INTEGER, col4 FLOAT, col5 TEXT);

INSERT INTO tab0 VALUES(1,72,81.64,'zsnbm',42,74.55,'tzagd');

INSERT INTO tab0 VALUES(3,81,97.79,'tdbjm',48,89.67,'hvaol');

INSERT INTO tab0 VALUES(5,46,83.75,'khqpe',31,31.98,'hzpio');

INSERT INTO tab0 VALUES(7,36,54.34,'pflrv',18,61.89,'vrltg');

INSERT INTO tab0 VALUES(9,76,63.21,'uakya',80,80.58,'ocfgj');

CREATE INDEX idx_tab1_0 on tab1 (col0);

CREATE INDEX idx_tab1_3 on tab1 (col3);

INSERT INTO tab1 SELECT * FROM tab0;

SELECT pk FROM tab1 WHERE col3 = 54 AND col1 <= 76.83;

DELETE FROM tab1 WHERE (col4 > 71.47) OR col0 IN (98,26,25,60);

SELECT pk FROM tab1 WHERE NOT ((col4 > 71.47) OR col0 IN (98,26,25,60));

SELECT pk FROM tab1 WHERE ((col0 > 32) AND col0 < 87);

INSERT INTO t0_varchar(c0) VALUES ('a'), ('a');

SELECT c0 FROM t0_varchar WHERE t0_varchar.c0 <= 'a';

INSERT INTO t0_scan(c0) VALUES ('1970-01-02'), ('1970-01-02'), ('1970-01-03');

SELECT c0 FROM t0_scan WHERE '1970-01-03' >= t0_scan.c0 ORDER BY c0;

CREATE TABLE t_3 (fIdx VARCHAR, sIdx UUID);

CREATE TABLE t_5 (sIdx UUID);

INSERT INTO t_4 (sIdx) VALUES
('1381e0ce-6b3e-43f5-9536-5e7af3a512a5'::UUID),
('6880cdba-09f5-3c4f-8eb8-391aefdd8052'::UUID),
('a3e876dd-5e50-3af7-9649-689fd938daeb'::UUID),
('e0abc0d3-63be-41d8-99ca-b1269ed153a8'::UUID);

WITH
	cte_5 AS (
		SELECT sIdx FROM t_4 ANTI JOIN t_3 USING (sIdx)
	),
	cte_6 AS MATERIALIZED (
		SELECT
			COALESCE(cte_5.sIdx, t_1.sIdx) AS sIdx,
			COALESCE(t_1.fIdx, cte_5.sIdx::VARCHAR) AS fIdx,
		FROM cte_5 FULL JOIN t_1 USING (sIdx)
	),
	cte_7 AS (
		SELECT t_5.sIdx, FROM t_5
		WHERE sIdx IN (SELECT sIdx FROM cte_6)
	)
SELECT fIdx, FROM cte_6 JOIN cte_7 USING (sIdx) ORDER BY fIdx;

SELECT b FROM t WHERE a = 1;

SET index_scan_max_count = 10000;

INSERT INTO t SELECT range FROM range(300000);

INSERT INTO t VALUES (1000000);

CREATE TABLE t (id INTEGER PRIMARY KEY, s STRUCT(a INTEGER), v VARIANT);

INSERT INTO t VALUES (1, {'a': 11}, {'x': 42}::VARIANT);

SELECT v.x::INTEGER FROM t WHERE id = 1;

SELECT id, s.a::BIGINT FROM t WHERE id = 1 AND s.a > 5;

CREATE TABLE integers (i BIGINT);

INSERT INTO integers (i) VALUES ('1'), ('-1'), ('1');

CREATE TABLE t0(c1 TIMESTAMP);

CREATE INDEX i0 ON t0(c1);

INSERT INTO integers SELECT 42 FROM range(1000);

CREATE INDEX idx ON integers(i);

SET index_scan_percentage = 0.000001;

INSERT INTO integers SELECT 4242 FROM range(4000);

CREATE TABLE t AS SELECT i FROM range(100000) r(i);

SET dynamic_or_filter_threshold = 100;

CREATE VIEW in_lookup AS SELECT i FROM t WHERE i IN (
    SELECT 1 + 10 * j FROM range(100) r(j)
);

SELECT count(*), sum(i) FROM in_lookup;

EXPLAIN ANALYZE SELECT count(*), sum(t.i) FROM t JOIN k USING(i);

CREATE TABLE random_orders AS (
	(SELECT o_orderkey FROM orders
	OFFSET 100
	LIMIT 3)
	UNION
	(SELECT o_orderkey FROM orders
	OFFSET (SELECT COUNT(*) FROM orders) / 2
	LIMIT 3)
	UNION
	(SELECT o_orderkey FROM orders
	OFFSET (SELECT COUNT(*) FROM orders) / 2 + 100000
	LIMIT 3));

EXPLAIN ANALYZE
SELECT o_orderkey FROM orders_shuffled WHERE o_orderkey IN (
	SELECT UNNEST(LIST(o_orderkey)) FROM random_orders
) ORDER BY ALL;

ALTER TABLE tbl ADD PRIMARY KEY(i);

SELECT COUNT(*) FROM tbl;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) ORDER BY i;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) AND i != 42 AND i <= 100 ORDER BY i;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) AND i = 42 AND i <= 100 ORDER BY i;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) AND i < 101 AND i >= 42 ORDER BY i;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) AND i > 42 AND i >= 42 ORDER BY i;

SELECT i FROM tbl WHERE i IN (2, 42, 100, 42, 101) AND i > 42 AND i IN (56, 200, 2, 100) ORDER BY i;

SELECT count(*) FROM tbl WHERE i IS NOT DISTINCT FROM 499995;

INSERT INTO tbl VALUES (NULL);

SELECT count(*) FROM tbl WHERE i IS NOT DISTINCT FROM NULL;

CREATE INDEX idx_nulls ON nulls(i);

SELECT count(*) FROM nulls WHERE i IS NOT DISTINCT FROM 499997;

EXPLAIN ANALYZE SELECT count(*) FROM nulls WHERE NOT (i IS NOT DISTINCT FROM 499997);

EXPLAIN ANALYZE SELECT count(*) FROM nulls WHERE (i IS NOT DISTINCT FROM 499997) = false;

SELECT count(*) FROM nulls WHERE (i IS NOT DISTINCT FROM 499997) IS NULL;

CREATE TABLE tbl AS SELECT range::INTEGER AS i, range::VARCHAR AS s FROM range(10000) UNION ALL SELECT NULL, NULL;

EXPLAIN ANALYZE SELECT i FROM tbl WHERE i = 9999 OR 5 = i OR i = 5 OR i = -1 OR i = NULL;

EXPLAIN ANALYZE SELECT s FROM tbl WHERE s = '5' OR s = '7';

EXPLAIN ANALYZE SELECT i FROM tbl WHERE i = 5 OR i > 9998;

SELECT i FROM tbl WHERE i = 5 OR s = '7' ORDER BY i;

SELECT i FROM tbl WHERE i = 5 OR i = -7 OR i = -5 ORDER BY i;

create unique index uid on t(id);

set variable u2 = uuid();

set variable u4 = uuid();

select * from t where id = getvariable('u1');

select * from t where id = getvariable('u2');

drop index uid;

SET enable_block_allocator=true;

CREATE TABLE db.keys (k BIGINT PRIMARY KEY);

CREATE TEMP TABLE donor AS SELECT repeat('Q', 1000) AS s FROM range(10000) r(i);

INSERT INTO db.keys SELECT (i + 100000) * 7919 FROM range(5000) r(i);

SELECT k FROM db.keys WHERE k = 7919;

CREATE TABLE bitmap_db.t AS SELECT i // 256 AS k, i AS id FROM range(21760) r(i);

CHECKPOINT bitmap_db;

DELETE FROM bitmap_db.t WHERE k=0;

INSERT INTO bitmap_db.t SELECT 0, i FROM range(21760,22016) r(i);

SELECT count(*) FROM bitmap_db.t;

SET wal_autocheckpoint='400KB';

SELECT used_blocks FROM pragma_database_size();

SELECT used_blocks > 0 FROM pragma_database_size();

INSERT INTO tbl SELECT range FROM range(40000);

CREATE TABLE tbl(i INTEGER);

INSERT INTO tbl SELECT r FROM range(0, 251) t(r);

INSERT INTO tbl SELECT r FROM range(251, 2049) t(r);

INSERT INTO tbl SELECT r FROM range(2049, 4096) t(r);

INSERT INTO tbl VALUES (5000);

DELETE FROM tbl WHERE i = 5000;

SELECT i FROM tbl WHERE i = 5000;

SELECT i FROM tbl WHERE i = 6000;

CREATE UNIQUE INDEX idx_i ON tbl (i);

SELECT i FROM tbl WHERE i = 1;

INSERT INTO tbl VALUES (60001);

SELECT i FROM tbl WHERE i = 60000;

SELECT i FROM tbl WHERE i = 60001;

SELECT i FROM tbl WHERE i = 3000;

SELECT i FROM tbl WHERE i = 13000;

SELECT i FROM tbl WHERE i = 23000;

SELECT i FROM tbl WHERE i = 4500;

SELECT i FROM tbl WHERE i = 14500;

SELECT i FROM tbl WHERE i = 24500;

CREATE UNIQUE INDEX idx_tbl_idx_col ON tbl(idx_col);

DELETE FROM tbl WHERE idx_col % 2 = 0;

SELECT idx_col FROM tbl WHERE idx_col = 0;

SELECT idx_col FROM tbl WHERE idx_col = 10;

INSERT INTO integers VALUES (1), (2), (3), (4), (5);

INSERT INTO integers (SELECT range FROM range(512) UNION ALL SELECT 55);

SET checkpoint_threshold='1TB';

CREATE TABLE art AS
SELECT hash(i) AS k, 'common-prefix-' || md5(i::VARCHAR) AS s
FROM range(100000) t(i);

CREATE UNIQUE INDEX art_s ON art(s);

CREATE INDEX cold_art_k ON cold_art(k);

INSERT INTO checkpoint_trigger VALUES(0);

EXPLAIN ANALYZE SELECT s FROM art WHERE s='common-prefix-' || md5('42');

CREATE TEMP TABLE warm_blocks AS
SELECT total_blocks FROM pragma_database_size() WHERE database_name = current_database();

UPDATE checkpoint_trigger SET i=i+1;

SELECT total_blocks = (SELECT total_blocks FROM warm_blocks)
FROM pragma_database_size() WHERE database_name = current_database();

SELECT memory_usage_bytes > (SELECT memory_usage_bytes FROM warm_memory)
FROM duckdb_memory() WHERE tag='ART_INDEX';

INSERT INTO simple_table VALUES(0);

SET debug_verify_serializer = true;

CREATE TABLE d.t (a DECIMAL(38,0), b DECIMAL(38,1));

CREATE UNIQUE INDEX ix ON d.t ((coalesce(a, b)::DECIMAL(38,1)));

CHECKPOINT d;

RESET max_decimal_width;

INSERT INTO d.t VALUES (NULL, 0.2);

CREATE TABLE d.s (a DECIMAL(40,0));

INSERT INTO d.s SELECT i FROM range(1000) r(i);

SELECT typeof(list_reduce([NULL::DECIMAL(38,0), NULL::DECIMAL(38,1)], lambda x, y: x + y));

INSERT INTO d.r VALUES (1, 0.1);

CREATE INDEX cx ON d.c ((a < b));

CREATE TABLE d.e AS SELECT 1 AS id, sum(1::DECIMAL(40,0)) EXPORT_STATE AS s;

CREATE TABLE d.k (a VARCHAR);

INSERT INTO d.k VALUES ('x');

CREATE UNIQUE INDEX bx ON d.b ((finalize(to_aggregate_state(v, 'sum', ['DECIMAL(40,0)']))));

SELECT a FROM d.s WHERE a = 7;

SELECT id FROM d.e WHERE id = 1;

SELECT id FROM d.b WHERE id = 1;

INSERT INTO d.c VALUES (99999999999999999999999999999999999999, 0.6);

INSERT INTO d.e VALUES (2, NULL);

INSERT INTO d.k VALUES ('y');

SELECT id FROM d.b WHERE id = 2;

INSERT INTO d.e SELECT 2, sum(2::DECIMAL(40,0)) EXPORT_STATE;

CREATE TABLE d.t (a DECIMAL(38,2), b DECIMAL(38,2));

CREATE UNIQUE INDEX ix ON d.t ((a + b));

CREATE TABLE d.g (a DECIMAL(38,0), b DECIMAL(38,1));

CREATE UNIQUE INDEX gx ON d.g ((greatest(a, b)));

CREATE TABLE d.n (a BIGNUM);

CREATE TABLE d.st (s STRUCT(n BIGNUM, amount DECIMAL(18,0)));

CREATE TABLE d.u (s STRUCT(keep INTEGER, dropped BIGNUM));

CREATE INDEX sx3 ON d.st ((struct_extract(try_cast(row(s.n, s.amount) AS STRUCT(n VARCHAR, amount DECIMAL(19,0))), 'amount')));

CREATE TABLE d.l (v BIGNUM[]);

CREATE TABLE d.un (u UNION(a BIGNUM, b INTEGER));

ATTACH ':memory:' AS mem;

CREATE UNIQUE INDEX mx ON mem.m ((coalesce(a, b)::DECIMAL(38,1)));

CREATE TABLE mem.g (a DECIMAL(38,0), b DECIMAL(38,1));

INSERT INTO mem.g VALUES (0, 0.1);

CREATE TABLE mem.n (a BIGNUM);

INSERT INTO mem.n VALUES ('1'::BIGNUM);

DETACH mem;

CREATE UNIQUE INDEX jx ON d.j ((json_transform(v, '"DECIMAL(40,0)"')::VARCHAR));

CREATE TABLE d.n (v VARCHAR);

INSERT INTO d.n VALUES ('{"a": [1]}');

INSERT INTO d.n VALUES ('{"a": [2]}');

SELECT table_name, index_count FROM duckdb_tables() ORDER BY table_name;

SELECT table_name, constraint_type FROM duckdb_constraints() ORDER BY ALL;

SELECT id FROM pk_tbl WHERE id = 2;

INSERT INTO idx_tbl SELECT range, range, range FROM range(300000);

CREATE INDEX ART_index ON idx_tbl(i);

DROP INDEX idx_1;

DROP INDEX ART_index;

DROP TABLE idx_tbl;

SELECT
	CASE WHEN (
		CASE WHEN get_block_size('test_art_import') = 16384
		THEN used_blocks < 3
		ELSE used_blocks < 2 END
	)
	THEN NULL
	ELSE T END
FROM pragma_database_size() T;

CREATE TABLE child (id INTEGER REFERENCES parent(id), val INTEGER);

INSERT INTO child SELECT range, range * 10 FROM range(3000);

CREATE INDEX FOREIGN_child_0 ON child(val);

DROP INDEX FOREIGN_child_0;

INSERT INTO tracking values ('a', 0,0,0);

CREATE UNIQUE INDEX tracking_key_idx ON tracking (gameId, playId, frameId, nflId);

INSERT INTO raw VALUES (1, 1, 1, 1);

SET checkpoint_threshold = '1GB';

INSERT INTO t VALUES (1, [1, 2]), (2, [5, 4]);

CREATE INDEX j ON t ((list_grade_up(l, 'DESC')[1]));

SELECT wal_size FROM pragma_database_size();

SET checkpoint_threshold = '1B';

DELETE FROM t WHERE id = 2;

SELECT id FROM t WHERE list_sort(l)[1] = 6;

CREATE TABLE tbl AS SELECT range AS id FROM range(200000);

CREATE TABLE parent(k BIGINT PRIMARY KEY);

CREATE TABLE child(k BIGINT REFERENCES parent(k), payload BIGINT USING COMPRESSION uncompressed);

SELECT memory_usage_bytes FROM duckdb_memory() WHERE tag='ART_INDEX';

SELECT sum(payload) FROM child;

DROP TABLE child;

DROP TABLE parent;

INSERT INTO tbl SELECT range, range FROM range (3000);

INSERT INTO fk_tbl SELECT range, range FROM range (3000);

CREATE INDEX leaf_idx ON leaf_db.t(k);

DETACH leaf_db;

SELECT count(*), min(id), max(id) FROM leaf_db.t WHERE k=1023;

DELETE FROM leaf_db.t WHERE k=0 AND id>=12;

INSERT INTO leaf_db.t SELECT 0,i FROM range(12,256) r(i);

DELETE FROM leaf_db.t WHERE k=0;

SELECT count(*) FROM leaf_db.t WHERE k=1;

SELECT count(*) FROM leaf_db.t;

CREATE INDEX old_idx ON upgrade_db.old_t(k);

DETACH upgrade_db;

EXPLAIN ANALYZE SELECT count(*) FROM upgrade_db.old_t WHERE k=1023;

DELETE FROM upgrade_db.old_t WHERE k=1;

CREATE TABLE upgrade_db.new_t AS SELECT i // 256 AS k, i AS id FROM range(1024) r(i);

SELECT count(*) FROM upgrade_db.old_t WHERE k=0;

EXPLAIN ANALYZE SELECT count(*) FROM upgrade_db.new_t WHERE k=3;

EXPLAIN ANALYZE SELECT count(*) FROM upgrade_db.old_t WHERE k=0;

SELECT index_name FROM duckdb_indexes();

INSERT INTO integers VALUES (1,1),(2,2),(3,3),(4,4),(5,5),;

CREATE TABLE tbl_deser_scan(id INTEGER);

INSERT INTO tbl_deser_scan SELECT 424242 FROM range(5);

INSERT INTO tbl_deser_scan SELECT 1 FROM range(5);

SELECT id FROM tbl_deser_scan WHERE id >= 424242;

DELETE FROM tbl_deser_scan WHERE rowid = (SELECT MAX(id) FROM max_row_id);

CREATE MACRO m(x, y := 7) AS x + y;

CREATE UNIQUE INDEX idx_m on tbl_m (m(tbl_m.x));

SET wal_autocheckpoint = '10GB';

INSERT INTO history(id, type) VALUES ('5_create_aaaaaaaaaaa_mapping', 'sql');

INSERT INTO history(id, type) VALUES ('m0005_create_aaaaaaaaaaa_mapping_table', 'sql');

INSERT INTO pk_integers VALUES (1);

INSERT INTO pk_integers2 VALUES (1);

CREATE TABLE minimal_tbl(i INTEGER);

INSERT INTO minimal_tbl VALUES (42);

INSERT INTO minimal_tbl VALUES (44);

CREATE TABLE test (a INTEGER);

CREATE TABLE alter_test (a INTEGER);

CREATE INDEX other_idx ON test(a);

INSERT INTO alter_test VALUES (0), (1);

ALTER TABLE alter_test ADD PRIMARY KEY(a);

CREATE TABLE drop_test (a INTEGER);

INSERT INTO drop_test VALUES (0), (1);

DROP INDEX drop_idx;

DELETE FROM alter_test WHERE a = 1;

INSERT INTO alter_test VALUES (1);

CREATE TABLE tbl (u_2 UNION("string" VARCHAR, "bool" BOOLEAN));

INSERT INTO tbl VALUES ('helloo');

SELECT * FROM tbl ORDER BY ALL;

CREATE UNIQUE INDEX idx_2 ON tbl ((u_2.string));

CREATE UNIQUE INDEX idx_4 ON tbl ((u_2.string));

CREATE TABLE t0(c0 DOUBLE UNIQUE);

CREATE TABLE test_table (id INTEGER PRIMARY KEY);

SELECT rowid FROM test_table LIMIT 1;

CREATE INDEX idx ON t USING ART(a);

PREPARE stmt AS SELECT index_key({'table': 't', 'index': 'idx'}, CAST(random() * 0 AS INTEGER) + 42);

CREATE TABLE aux.t(a INTEGER);

INSERT INTO aux.t VALUES (1), (2), (3);

PREPARE detached_stmt AS
SELECT index_key({'catalog': 'aux', 'table': 't', 'index': 'idx'}, CAST(random() * 0 AS INTEGER) + 42);

DEALLOCATE detached_stmt;

CREATE INDEX i0 ON t0(c1, c0);

SELECT * FROM t0;

INSERT INTO duplicate_id SELECT range, range FROM range (0, 2048, 1);

DROP TABLE duplicate_id;

INSERT INTO int128_first SELECT range, range FROM range(5000);

CREATE TABLE uint8_first (id UINT8, id2 UINT8);

CREATE INDEX idx_2 ON uint8_first(id, id2);

INSERT INTO uint64_first SELECT range, range, range, 0.456 + range FROM range(5000);

CREATE TABLE int128_point AS SELECT range::INT128 AS id FROM range(5000);

SELECT id FROM int128_point WHERE id = 2048;

CREATE INDEX idx_uint64_point ON uint64_point(id);

CREATE TABLE uint32_point AS SELECT range::UINT32 AS id FROM range(5000);

SELECT id FROM uint32_point WHERE id = 2048;

CREATE INDEX idx_uint8_point ON uint8_point(id);

CREATE TABLE numbers(i DOUBLE);

INSERT INTO numbers VALUES (CAST(-0 AS DOUBLE));

SELECT COUNT(i) FROM numbers WHERE i = CAST(0 AS DOUBLE);

CREATE TABLE integers(i BIGINT, j INTEGER, k VARCHAR, l BIGINT);

INSERT INTO integers VALUES (10, 1, 'hello', 4), (11, 2, 'world', 6);

UPDATE integers SET j=5, l=l WHERE j=1;

SELECT * FROM integers WHERE j+l=9;

DELETE FROM integers WHERE j+l=9;

CREATE TABLE integers(i TINYINT, j SMALLINT, k INTEGER, l BIGINT);

CREATE INDEX i_index2 ON integers(j);

CREATE INDEX i_index4 ON integers(l);

SELECT j FROM integers WHERE j < 0;

SELECT l FROM integers WHERE l <= 0;

INSERT INTO integers VALUES (2,2,2,2);

INSERT INTO integers VALUES (4,4,4,4);

SELECT * FROM integers ORDER BY i;

SELECT j FROM integers WHERE j <= 2::SMALLINT ORDER BY j;

SELECT k FROM integers WHERE k >= 100000::INTEGER ORDER BY k;

SELECT l FROM integers WHERE l <= 1000000000::BIGINT ORDER BY i;

CREATE TABLE numbers(i REAL);

INSERT INTO numbers VALUES (CAST(-0 AS REAL));

SELECT COUNT(i) FROM numbers WHERE i = CAST(-0 AS REAL);

INSERT INTO numbers VALUES (3.45, 4), (2.2, 5);

INSERT INTO numbers VALUES (6, 6);

INSERT INTO tbl VALUES
	('hello', 'world', 42, [1, 2, 3]),
	(NULL, NULL, NULL, NULL),
	(true, NULL, 44, 45),
	(false, 'wazzup', false, [1]);

DROP INDEX idx_i;

CREATE UNIQUE INDEX idx_u_1 ON tbl ((u_1.string));

CREATE UNIQUE INDEX idx_list_3 ON tbl ((u_list.bool));

SELECT u_1.string FROM tbl WHERE u_2 = 'helloo';

DROP INDEX idx_u_2_2;

DROP INDEX idx_list_1;

CREATE UNIQUE INDEX idx_c_1 ON tbl ((u_2.string), (u_1.string));

INSERT INTO tbl VALUES ('sunshine', 'love', 85, true);

CREATE TABLE strings(i varchar);

INSERT INTO strings VALUES ('test'), ('test1'), ('vest1'), ('somesuperbigstring'), ('somesuperbigstring1'),
	('somesuperbigstring2'), ('somesuperbigstring'), ('maybesomesuperbigstring'),
	('maybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstring'),
	('maybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstring2');

SELECT COUNT(i) FROM strings WHERE i = 'somesuperbigstring';

SELECT COUNT(i) FROM strings WHERE i = 'maybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstringmaybesomesuperbigstring2';

SELECT COUNT(i) FROM strings WHERE i = 'somesuperthisdoesnotexist';

CREATE TABLE w.t(id BIGINT, k VARCHAR);

DELETE FROM w.t WHERE id = 2;

SELECT id, k FROM w.t ORDER BY id;

INSERT INTO w.t VALUES (3, 'x');

CREATE UNIQUE INDEX idl ON w.tl(id);

UPDATE w.tl SET l = [5] WHERE id = 2;

CREATE TABLE leaf_db.t AS SELECT i // 256 AS k, i AS id FROM range(338944) r(i);

SELECT count(*) FROM leaf_db.t WHERE k = 1250;

VACUUM leaf_db.t;

SELECT count(*) FROM leaf_db.t WHERE k = 816;

CREATE TABlE t1 (foo INT);

CREATE INDEX i2 ON t1(foo) WITH (default);

CREATE INDEX i4 ON t1(foo) WITH ('default' = 5);

CREATE INDEX i6 ON t1(foo) WITH ('default' = 5, deferrable, default.x = 1);

CREATE TABLE il(v INTERVAL[]);

CREATE TABLE vl(v VARIANT[]);

CREATE TABLE t(s VARCHAR);

INSERT INTO il VALUES ([INTERVAL 1 DAY]);

INSERT INTO t VALUES ('A'), ('b');

INSERT INTO vl VALUES ([2::TINYINT::VARIANT]);

DELETE FROM t WHERE s = 'A';

DELETE FROM vl WHERE v = [1::TINYINT::VARIANT];

SELECT count(*) FROM vl;

CREATE UNIQUE INDEX idx ON t (i);

COMMENT ON INDEX idx IS 'b';

INSERT INTO t VALUES (1, 1);

COMMENT ON INDEX idx_j IS 'x';

INSERT INTO t VALUES (2, 1);
