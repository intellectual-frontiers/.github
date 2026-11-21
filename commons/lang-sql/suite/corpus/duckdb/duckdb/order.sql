CREATE TABLE test (a hugeint);

INSERT INTO test values ((-170141183460469231731687303715884105728)::hugeint), (-1111::hugeint), (-1::hugeint), (0::hugeint), (1::hugeint), (1111::hugeint);

SELECT * FROM test order by a;

SELECT * FROM test order by a DESC;

CREATE TABLE test(col1 INT, col2 INT2[][][][][][]);

INSERT INTO test VALUES(1000000000, null), (1000000001, [[[[[[]]]]]]), (null, [[[[[[]]]]]]), (null, [[[[[[]]]]]]), (1, [[[[[[]]]]]]);

SELECT col1, col2 FROM test ORDER BY col1 NULLS LAST, col2;

CREATE TABLE integers(i INTEGER, j INTEGER);

INSERT INTO integers VALUES (1, 1), (3, 3);

CREATE TABLE integers2(k INTEGER, l INTEGER);

INSERT INTO integers2 VALUES (1, 10), (2, 20);

SELECT i, j, k, l FROM integers FULL OUTER JOIN integers2 ON integers.i=integers2.k ORDER BY ALL LIMIT 2;

SELECT COUNT(*) FROM (SELECT i, j, k, l FROM integers FULL OUTER JOIN integers2 ON integers.i=integers2.k LIMIT 2) tbl;

SELECT * FROM range(5) LIMIT (SELECT 2) OFFSET (SELECT 1);

SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT 5;

CREATE TABLE integers AS SELECT 5 k;

SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT (SELECT k FROM integers);

CREATE TABLE strings AS SELECT '5'::VARCHAR k;

SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT (SELECT k FROM strings);

PREPARE v1 AS SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT ?::VARCHAR;

EXECUTE v1(5);

PREPARE v1 AS SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT ?::VARCHAR %;

EXECUTE v1('0.05');

CREATE TABLE doubles AS SELECT 0.05 d;

SELECT * FROM generate_series(0, 10000, 1) tbl(i) ORDER BY i DESC LIMIT (SELECT d FROM doubles) %;

EXPLAIN SELECT * FROM range(9223372036854775807) LIMIT 50 PERCENT;

EXPLAIN SELECT * FROM range(9223372036854775807) LIMIT 100 PERCENT;

SELECT count(*) FROM (SELECT * FROM range(100) LIMIT 50 PERCENT);

CREATE TABLE test (a INTEGER, b INTEGER);

INSERT INTO test VALUES (11, 22), (12, 21), (13, 22), (14, 32), (15, 52);

CREATE VIEW test_view AS SELECT a FROM test LIMIT 20 %;

FROM test_view;

CREATE VIEW test_view2 AS SELECT a FROM test LIMIT 20 % OFFSET 1;

FROM test_view2;

SELECT * FROM range(5) UNION ALL SELECT * FROM range(5) LIMIT 7;

SELECT COUNT(*) FROM (SELECT * FROM range(5) UNION ALL SELECT * FROM range(5) LIMIT 7) tbl;

CREATE TABLE integers AS SELECT -1 k;

SET default_null_order='nulls_first';

CREATE TABLE integers(g integer, i integer);

INSERT INTO integers values (0, 1), (0, 2), (1, 3), (1, NULL);

SELECT * FROM integers ORDER BY ALL;

SELECT * FROM integers ORDER BY * DESC;

SELECT * FROM integers ORDER BY * DESC NULLS LAST;

SELECT * FROM integers UNION ALL SELECT * FROM integers ORDER BY ALL;

SELECT * FROM integers UNION SELECT * FROM integers ORDER BY ALL;

create table t1 as from VALUES
	('A', 1),
	('B', 3),
	('C', 12),
	('A', 5),
	('B', 8),
	('C', 9),
	('A', 10),
	('B', 20),
	('C', 3)
	t(a, b);

SET disabled_optimizers='compressed_materialization';

from t1 order by a;

CREATE TABLE zero_probe(id INTEGER, v DOUBLE, vf FLOAT);

INSERT INTO zero_probe VALUES (1, '-0.0', '-0.0'), (2, '0.0', '0.0');

SELECT id, signbit(v), signbit(vf) FROM zero_probe ORDER BY id;

SELECT id, signbit(v), signbit(vf) FROM zero_probe ORDER BY v, id;

SELECT v, 1.0 / v FROM zero_probe ORDER BY v, id;

CREATE TEMP TABLE srs_zero_probe(id INTEGER, v DOUBLE);

INSERT INTO srs_zero_probe VALUES (1, '-0.0'), (2, '0.0');

WITH q AS MATERIALIZED (
    SELECT id, v FROM srs_zero_probe ORDER BY v, id
)
SELECT id, v, signbit(v), 1.0 / v FROM q ORDER BY id;

SET threads=3;

PRAGMA verify_parallelism;

SET memory_limit='128MB';

SET asof_loop_join_threshold=0;

SET debug_asof_iejoin=false;

CREATE TABLE prices AS
SELECT g, n, symbol, (2*n)::TINYINT AS t
FROM (VALUES (0,encode(repeat('a',10)||'m')), (1,encode(repeat('a',11)||'m')),
             (2,encode(repeat('a',12)||'m')), (3,encode(repeat('a',40)||'m')),
             (4,encode(repeat('a',11)||'m')||from_hex('00'))) symbols(g,symbol),
     range(3) times(n);

CREATE TABLE trades AS SELECT g,n,symbol,(t+1)::TINYINT AS t FROM prices;

SELECT count(*), sum(p.n), bool_and(t.g=p.g AND t.n=p.n)
FROM trades t ASOF JOIN prices p ON t.symbol=p.symbol AND t.t>=p.t;

SET threads = 1;

CREATE TABLE tiny_wide AS SELECT 'common_prefix' || lpad(((i % 1000) * 2 + i // 1000)::VARCHAR, 6, '0') AS s, i FROM range(2000) t(i);

CREATE TABLE tiny_fixed AS SELECT (i // 1000)::BIGINT AS c, ((i % 1000) * 2 + i // 1000)::BIGINT AS k, i FROM range(2000) t(i);

SELECT s, i FROM tiny_wide ORDER BY s, i;

SELECT s, i FROM tiny_wide ORDER BY s DESC, i DESC;

SELECT c, k, i FROM tiny_fixed ORDER BY k, c, i;

CREATE TABLE wide AS
    SELECT 'common_prefix' || lpad(CASE WHEN i < 60000 THEN i ELSE ((i - 60000) % 5000) * 8 + (i - 60000) // 5000 END::VARCHAR, 6, '0') AS s, i
    FROM range(100000) t(i);

CREATE TABLE fixed AS
    SELECT CASE WHEN i < 60000 THEN 4611686018427387904 ELSE 0 END::BIGINT AS c,
           CASE WHEN i < 60000 THEN i ELSE ((i - 60000) % 5000) * 8 + (i - 60000) // 5000 END::BIGINT AS k, i
    FROM range(100000) t(i);

SELECT s, i FROM wide ORDER BY s, i;

SELECT s, i FROM wide ORDER BY s DESC, i DESC;

SELECT c, k, i FROM fixed ORDER BY c, k, i;

SELECT c, k, i FROM fixed ORDER BY c DESC, k DESC, i DESC;

SET threads=4;

SET memory_limit='1GB';

SET preserve_insertion_order=true;

CREATE TABLE byte_keys AS
SELECT i, (i * 977) % 262147 AS k,
       CASE WHEN k < 8192 THEN repeat('x', 8192) ELSE repeat('y', 32) END AS p
FROM range(262147) t(i);

CREATE TEMP TABLE sorted_keys AS SELECT * FROM byte_keys ORDER BY k DESC;

SELECT count(*),
       bool_and(coalesce((prev_k IS NULL OR prev_k > k) AND
                         i BETWEEN 0 AND 262146 AND k = (i * 977) % 262147 AND
                         p = CASE WHEN k < 8192 THEN repeat('x', 8192) ELSE repeat('y', 32) END, false))
FROM (SELECT *, lag(k) OVER () AS prev_k FROM sorted_keys);

DROP TABLE sorted_keys;

SELECT count(*), count(*) FILTER (
    WHERE r.i IS DISTINCT FROM l.i OR
          r.p IS DISTINCT FROM CASE WHEN l.k < 8192 THEN repeat('x', 8192) ELSE repeat('y', 32) END
)
FROM byte_keys l ASOF JOIN byte_keys r ON l.k >= r.k;

CREATE TABLE prefix_keys AS
SELECT i, repeat('p', 600) || lpad(((i * 977) % 8193)::VARCHAR, 4, '0') AS k
FROM range(8193) t(i);

SELECT count(*), sum(i),
       bool_and((prev_k IS NULL OR prev_k <= k) AND
                k = repeat('p', 600) || lpad(((i * 977) % 8193)::VARCHAR, 4, '0'))
FROM (
    SELECT *, lag(k) OVER () AS prev_k
    FROM (SELECT * FROM prefix_keys ORDER BY k)
);

SET debug_force_external=true;

SELECT count(*), sum(i),
       bool_and((prev_k IS NULL OR prev_k >= k) AND
                k = repeat('p', 600) || lpad(((i * 977) % 8193)::VARCHAR, 4, '0'))
FROM (
    SELECT *, lag(k) OVER () AS prev_k
    FROM (SELECT * FROM prefix_keys ORDER BY k DESC)
);

CREATE TABLE prefix_lengths AS
SELECT i, CASE WHEN i % 11 = 0 THEN NULL
              ELSE repeat('p', (i % 4) * 200) END AS k
FROM prefix_keys;

SELECT count(*), sum(i),
       bool_and(prev_k IS NULL OR k IS NULL OR prev_k < k OR (prev_k = k AND prev_i < i))
FROM (
    SELECT *, lag(k) OVER () AS prev_k, lag(i) OVER () AS prev_i
    FROM (SELECT * FROM prefix_lengths ORDER BY k NULLS FIRST, i)
);

SELECT count(*), bool_and(prev_k IS NULL OR prev_k <= k)
FROM (
    SELECT k, lag(k) OVER () AS prev_k
    FROM (SELECT k FROM prefix_keys ORDER BY k)
);

SET memory_limit='256MB';

CREATE TABLE strings AS
SELECT g::BIGINT*1000000+((i*977)%1024)*10+z AS r,
       chr(97+g::INTEGER)||repeat('a',p)||lpad(((i*977)%1024)::VARCHAR,4,'0')||repeat(chr(0),z) AS s
FROM (VALUES (0,0),(1,6),(2,7),(3,8),(4,15),(5,16),(6,64),(7,256),(8,512)) prefixes(g,p),
     range(1024) suffixes(i), range(4) tails(z), range(2) copies;

INSERT INTO strings VALUES
    (6999999, 'g'||repeat('a',8)||'b'||repeat('a',55)||'0000'),
    (-1, NULL);

SELECT list(r ORDER BY s NULLS FIRST) = list(r ORDER BY r) FROM strings;

SELECT list(r ORDER BY s DESC NULLS LAST) = list(r ORDER BY r DESC) FROM strings;

SELECT list(s ORDER BY n) IS NOT DISTINCT FROM (SELECT list(s ORDER BY r) FROM strings)
FROM (SELECT s, row_number() OVER () AS n FROM (SELECT s FROM strings ORDER BY s NULLS FIRST));

SELECT list(s ORDER BY n) IS NOT DISTINCT FROM (SELECT list(s ORDER BY r DESC) FROM strings)
FROM (SELECT s, row_number() OVER () AS n FROM (SELECT s FROM strings ORDER BY s DESC NULLS LAST));

SELECT list(i ORDER BY g DESC, b, t DESC, i) = list(i ORDER BY g DESC, v, t DESC, i)
FROM binary_strings;

SELECT list(b ORDER BY n) = (SELECT list(b ORDER BY v) FROM binary_strings)
FROM (SELECT b, row_number() OVER () AS n FROM (SELECT b FROM binary_strings ORDER BY b));

SET memory_limit='64MB';

CREATE TABLE strings AS
SELECT (64-p)::BIGINT*100000+j*10000+i*10+z AS r,
       repeat('a',p)||c||lpad(i::VARCHAR,4,'0')||repeat(chr(0),z) AS s
FROM (VALUES (0),(6),(7),(8),(14),(15),(16),(23),(24),(31),(32),(63),(64)) prefixes(p),
     (VALUES (0,'b'),(1,'é'),(2,'🙂')) separators(j,c),
     range(16) digits(i), range(10) zeros(z);

SELECT list(r ORDER BY s) = list(r ORDER BY r) FROM strings;

SELECT list(r ORDER BY s DESC) = list(r ORDER BY r DESC) FROM strings;

SELECT list(s ORDER BY n) = (SELECT list(s ORDER BY r) FROM strings)
FROM (SELECT s, row_number() OVER () AS n FROM (SELECT s FROM strings ORDER BY s));

SELECT list(s ORDER BY n) = (SELECT list(s ORDER BY r DESC) FROM strings)
FROM (SELECT s, row_number() OVER () AS n FROM (SELECT s FROM strings ORDER BY s DESC));

INSERT INTO test VALUES (11, 22), (12, 21), (13, 22);

SELECT a FROM test LIMIT 1;

SELECT * FROM range(10) LIMIT 20;

EXPLAIN SELECT * FROM range(10) LIMIT 20;

SELECT a FROM test LIMIT 1.25;

SELECT a FROM test LIMIT 2-1;

CREATE TABLE test2 (a STRING);

INSERT INTO test2 VALUES ('Hello World');

PREPARE v1 AS SELECT * FROM test2 LIMIT 3;

EXECUTE v1;

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (1), (2), (3), (4), (5);

CREATE SEQUENCE seq START 3;

SELECT * FROM integers LIMIT nextval('seq');

SELECT * FROM integers LIMIT RANDOM();

SELECT * FROM integers as int LIMIT (SELECT MIN(integers.i) FROM integers);

CREATE SEQUENCE of_seq START 1;

SELECT * FROM integers OFFSET nextval('of_seq');

SELECT * FROM integers OFFSET RANDOM();

SELECT * FROM integers as int OFFSET (SELECT MIN(integers.i) FROM integers);

SELECT * FROM integers as int LIMIT (SELECT MAX(integers.i) FROM integers) OFFSET (SELECT MIN(integers.i) FROM integers);

SELECT * FROM integers as int LIMIT (SELECT max(integers.i) FROM integers where i > 5);

SELECT * FROM integers as int LIMIT (SELECT NULL);

CREATE OR REPLACE TABLE t AS SELECT range x FROM range(10);

SELECT * FROM t ORDER BY x;

SELECT * FROM t ORDER BY x OFFSET 5;

SELECT * FROM t ORDER BY x OFFSET (SELECT 5);

SELECT * FROM t ORDER BY x LIMIT (SELECT 5);

SELECT * FROM t ORDER BY x LIMIT (SELECT 3) OFFSET (SELECT 3);

SELECT * FROM t ORDER BY x LIMIT 3 OFFSET (SELECT 3);

SELECT * FROM t ORDER BY x LIMIT (SELECT 3) OFFSET 3;

create table t0(c0 int);

insert into t0 values (1), (2), (3), (4), (5), (6), (7);

SET scalar_subquery_error_on_multiple_rows=false;

SELECT * FROM t0 ORDER BY ALL OFFSET (SELECT DISTINCT 6.5 FROM (SELECT 1) t1(c0) UNION ALL SELECT 3);

WITH cte AS (SELECT 3) SELECT * FROM range(10000000) LIMIT (SELECT * FROM cte);

WITH cte AS (SELECT 3) SELECT * FROM range(10000000) LIMIT (SELECT * FROM cte) OFFSET (SELECT * FROM cte);

SELECT [1] LIMIT (SELECT 5);

SELECT map {1:2} LIMIT (SELECT 5);

SELECT {'a': 1} OFFSET (SELECT 0);

SELECT {'a': 1} LIMIT 1 + random()::INT;

SELECT [1,2]::INT[2] LIMIT (SELECT 5);

SELECT 1::VARIANT LIMIT (SELECT 5);

CREATE TABLE t AS SELECT [i] l, {'a': i} s, [i, i]::BIGINT[2] a, i::VARIANT v, i FROM range(5000) t(i);

SELECT * FROM t LIMIT (SELECT 3);

SELECT count(*) FROM (SELECT * FROM t LIMIT (SELECT 3000) OFFSET (SELECT 1000));

SELECT l, s FROM t ORDER BY i DESC LIMIT (SELECT 2);

PREPARE v1 AS SELECT 'Test' LIMIT ?;

EXECUTE v1(1);

EXECUTE v1(0);

PREPARE v2 AS SELECT * FROM RANGE(1000000000) LIMIT ? OFFSET ?;

EXECUTE v2(3, 0);

EXECUTE v2(3, 17);

PREPARE v3 AS SELECT * FROM RANGE(1000000000) LIMIT 2 OFFSET ?;

EXECUTE v3(0);

EXECUTE v3(17);

PREPARE v4 AS SELECT * FROM RANGE(1000000000) LIMIT ? OFFSET 17;

EXECUTE v4(3);

EXECUTE v4(6);

PREPARE v5 AS SELECT * FROM RANGE(1000000000) LIMIT (SELECT ?::INT) OFFSET (SELECT ?::INT);

EXECUTE v5(3, 0);

EXECUTE v5(3, 17);

PREPARE v6 AS SELECT * FROM RANGE(1000000000) LIMIT 3+? OFFSET ?+2*?;

EXECUTE v6(1, 0, 0);

EXECUTE v6(3, 1, 2);

PREPARE v7 AS SELECT * FROM GENERATE_SERIES(0,4,1) LIMIT ? OFFSET ?;

EXECUTE v7(NULL, 2);

EXECUTE v7(2, NULL);

EXECUTE v7(NULL, 9223372036854775807);

EXECUTE v7(9223372036854775807, NULL);

EXECUTE v7(NULL, 4611686018427387904);

EXECUTE v7(4611686018427387904, NULL);

SELECT a FROM test LIMIT 20 %;

SELECT a FROM test LIMIT 40 PERCENT;

SELECT a FROM test LIMIT 35%;

SELECT a FROM test LIMIT 79.9%;

SELECT a FROM test LIMIT 80.1%;

SELECT a FROM test LIMIT 100 PERCENT;

SELECT a FROM test LIMIT (30-10) %;

SELECT * FROM test LIMIT RANDOM() %;

SELECT a FROM test LIMIT 50% OFFSET 2;

SELECT * FROM range(10) LIMIT 50% OFFSET 2;

SELECT * FROM range(10000) LIMIT 0.1% OFFSET 8000;

SELECT * FROM range(10000) LIMIT 0.1% OFFSET 9999;

SELECT a FROM test LIMIT (SELECT COUNT(*) FROM test) % OFFSET 1;

SELECT a FROM test LIMIT 50% OFFSET (((SELECT MIN(b) FROM test)-1)/10);

SELECT b FROM test LIMIT 70% OFFSET (((SELECT MIN(test.a) FROM test)-1)/10);

SELECT * FROM test LIMIT 30% OFFSET RANDOM() / 10.0;

SELECT b FROM test LIMIT 0%;

INSERT INTO test2 VALUES ('first'), ('second'), ('third'), ('4th'), ('5th');

PREPARE v1 AS SELECT * FROM test2 LIMIT 40%;

CREATE VIEW v3 AS SELECT i % 5 g, LIST(CASE WHEN i=6 or i=8 then null else i end) l FROM RANGE(20) tbl(i) group by g;

SELECT g, 5=ANY(l) FROM v3 ORDER BY g LIMIT 80%;

SELECT g, 3>ANY(l) FROM v3 ORDER BY g LIMIT 50%;

CREATE TABLE struct_data (g INTEGER, e INTEGER);

INSERT INTO struct_data VALUES (1, 1), (1, 2), (2, 3), (2, 4), (2, 5), (3, 6), (5, NULL);

SELECT STRUCT_PACK(a := 42, b := 43);

SELECT e, STRUCT_PACK(e) FROM struct_data ORDER BY e LIMIT 60%;

SELECT * FROM integers as int LIMIT (SELECT max(integers.i) FROM integers where i > 5) %;

select 1 union all select 2 union all select 3 union all select 4 limit 50%;

INSERT INTO integers VALUES (1), (NULL);

SELECT * FROM integers ORDER BY i;

SELECT * FROM integers ORDER BY i NULLS FIRST;

SELECT * FROM integers ORDER BY i NULLS LAST;

SELECT 10 AS j, i FROM integers ORDER BY j, i NULLS LAST;

CREATE TABLE test(i INTEGER, j INTEGER);

INSERT INTO test VALUES (1, 1), (NULL, 1), (1, NULL);

SELECT * FROM test ORDER BY i NULLS FIRST, j NULLS LAST;

SELECT * FROM test ORDER BY i NULLS FIRST, j NULLS FIRST;

SELECT * FROM test ORDER BY i NULLS LAST, j NULLS FIRST;

SELECT i, j, row_number() OVER (PARTITION BY i ORDER BY j NULLS FIRST) FROM test ORDER BY i NULLS FIRST, j NULLS FIRST;

SELECT i, j, row_number() OVER (PARTITION BY i ORDER BY j NULLS LAST) FROM test ORDER BY i NULLS FIRST, j NULLS FIRST;

SELECT * FROM test ORDER BY i NULLS FIRST, j NULLS LAST LIMIT 2;

SELECT * FROM test ORDER BY i NULLS LAST, j NULLS LAST LIMIT 2;

SET default_null_order='NULLS LAST';

SET default_null_order='NULLS FIRST';

select b from test where a = 12;

SELECT b FROM test ORDER BY a DESC;

SELECT a, b FROM test ORDER BY a;

SELECT a, b FROM test ORDER BY a DESC;

SELECT a, b FROM test ORDER BY b, a;

SELECT a, b FROM test ORDER BY 2, 1;

SELECT a, b FROM test ORDER BY b DESC, a;

SELECT a, b FROM test ORDER BY b, a DESC;

SELECT a, b FROM test ORDER BY b, a DESC LIMIT 1;

SELECT a, b FROM test ORDER BY b, a DESC LIMIT 1 OFFSET 1;

SELECT a, b FROM test ORDER BY b, a DESC OFFSET 1;

SELECT a, b FROM test WHERE a < 13 ORDER BY b;

SELECT a, b FROM test WHERE a < 13 ORDER BY 2;

SELECT a, b FROM test WHERE a < 13 ORDER BY b DESC;

SELECT b, a FROM test WHERE a < 13 ORDER BY b DESC;

SELECT b % 2 AS f, SUM(a) FROM test GROUP BY f ORDER BY b % 2;

SELECT b % 2 AS f, a FROM test ORDER BY b % 2, a;

SELECT b % 2 AS f, SUM(a) FROM test GROUP BY f ORDER BY f;

SELECT b % 2 AS f, SUM(a) FROM test GROUP BY f ORDER BY 1;

SELECT a-10 AS k FROM test UNION SELECT a-10 AS l FROM test ORDER BY k;

SELECT a-10 AS k FROM test UNION SELECT a-10 AS l FROM test ORDER BY l;

SELECT a-10 AS k FROM test UNION SELECT a-10 AS l FROM test ORDER BY 1-k;

SELECT a-10 AS k FROM test UNION SELECT a-10 AS l FROM test ORDER BY a-10;

SELECT a-10 AS k FROM test UNION SELECT a-11 AS l FROM test ORDER BY a-11;

SET order_by_non_integer_literal=true;

SELECT a FROM test ORDER BY 'hello world', a;

SELECT a FROM test ORDER BY 'hello', a;

SELECT a AS k, b FROM test UNION SELECT a, b AS k FROM test ORDER BY k;

SELECT a AS k, b FROM test UNION SELECT a AS k, b FROM test ORDER BY k;

SELECT a % 2, b FROM test UNION SELECT a % 2 AS k, b FROM test ORDER BY a % 2;

CREATE TABLE t (a INTEGER, b INTEGER);

INSERT INTO t VALUES (11, 22), (12, 21), (13, 22);

SELECT a, b FROM t ORDER BY 1, 2;

SELECT a FROM t ORDER BY CAST('a' AS VARCHAR), a;

SELECT a FROM t ORDER BY CAST('t' AS BOOLEAN), a;

SELECT a FROM t ORDER BY CAST('yes' AS BOOLEAN), a;

SELECT a FROM t ORDER BY true, a;

SELECT a FROM t ORDER BY false, a;

SELECT a AS k FROM t UNION SELECT a AS k FROM t ORDER BY true, k;

SELECT DISTINCT ON (a) a, b FROM t ORDER BY true, a, b;

CREATE TABLE test AS SELECT a FROM range(10000, 0, -1) t1(a);

SELECT a FROM test ORDER BY a;

SET default_order='DESCENDING';

SET default_order='ASC';

insert into test values (100), (25), (75), (50);

select * from test order by i;

drop table test;

insert into test values (10000), (2500), (7500), (5000);

insert into test values (1000000), (250000), (750000), (500000);

insert into test values (1000000000), (250000000), (750000000), (500000000);

create table test (i hugeint);

insert into test values (295147905179352825856), (73786976294838206464), (147573952589676412928), (36893488147419103232);

CREATE TABLE tbl_structs AS SELECT
	{'a': 2.0, 'b': 'hello', 'c': [1, 2]} AS s1,
	1::BIGINT AS i,
	{'k': 1::TINYINT, 'j': 0::BOOL} AS s2;

INSERT INTO tbl_structs VALUES (
	{'a': 1.0, 'b': 'yay', 'c': [10, 20]},
	42,
	{'k': 2, 'j': 1});

SELECT UNNEST(s1), s1.a AS id FROM tbl_structs ORDER BY id;

SELECT s1, s1.a FROM tbl_structs ORDER BY 1;

SELECT UNNEST(s1), s1.a AS id FROM tbl_structs ORDER BY 1;

SELECT UNNEST(s1), UNNEST(s2), i FROM tbl_structs ORDER BY i;

SELECT UNNEST(s1), UNNEST(s2), i FROM tbl_structs ORDER BY 2 DESC;

SELECT i, UNNEST(s1), UNNEST(s2) FROM tbl_structs ORDER BY 5 DESC;

CREATE OR REPLACE TABLE t3(c VARCHAR);

INSERT INTO t3
VALUES ('19'),
    ('21'),
    ('22'),
    ('23');

CREATE OR REPLACE TABLE t2(
    a VARCHAR,
    b VARCHAR
);

INSERT INTO t2
VALUES ('3', '8'),
    ('5', NULL),
    ('8', NULL),
    ('11', NULL);

CREATE OR REPLACE TABLE t1(
    a VARCHAR,
    c VARCHAR
);

INSERT INTO t1
VALUES ('2', '22'),
    ('3', '21'),
    ('11', '19'),
    ('5', '23');

WITH
    cte1 AS (
        SELECT
            struct_pack(f := json_extract('[]', '$[*]')) AS s0, struct_pack(ff := c) AS s1, t1.a AS p
        FROM t3
        JOIN t1 USING (c)
    ),
    cte2 AS (
        SELECT
            cte1.s1, cte1.s0, struct_pack(fff := cte1.p) AS s2
        FROM cte1
        JOIN t2 AS t22 ON cte1.p = t22.a
        LEFT JOIN t2 ON t22.b = t2.a
    ),
    cte3 AS (
        SELECT cte2.*
        FROM cte2
        ORDER BY s1, s2
    )
SELECT *
FROM cte3
LIMIT 1;

SET disabled_optimizers='filter_pushdown,join_order';

CREATE TABLE src(vp_rowid BIGINT PRIMARY KEY, c0 BOOLEAN, c1 BOOLEAN, c2 BIGINT);

INSERT INTO src VALUES (1, TRUE, NULL, NULL), (2, TRUE, FALSE, 42);

CREATE TABLE l AS SELECT vp_rowid, c2 FROM src;

CREATE TABLE r AS SELECT vp_rowid, c0, c1 FROM src;

SELECT c2 FROM src ORDER BY vp_rowid LIMIT 0;

SELECT c2 FROM src ORDER BY vp_rowid LIMIT 0 OFFSET 1;

SELECT sub.c2
FROM (
    SELECT l.vp_rowid, r.c0, r.c1, l.c2
    FROM l
    JOIN r ON l.vp_rowid = r.vp_rowid
    WHERE NOT EXISTS (SELECT 1 FROM r rx WHERE rx.vp_rowid = l.vp_rowid AND rx.vp_rowid <> l.vp_rowid)
) sub
ORDER BY sub.vp_rowid
LIMIT 0;

select o_orderkey, o_clerk, o_orderstatus, o_totalprice from orders_small
                    order by o_orderkey NULLS FIRST,
                    o_clerk NULLS FIRST, o_orderstatus NULLS FIRST,
                    o_totalprice DESC NULLS LAST limit 360;

select o_orderkey, o_clerk, o_orderstatus, o_totalprice from orders_small
                    order by o_orderkey NULLS FIRST,
                    o_clerk NULLS FIRST, o_orderstatus NULLS FIRST,
                    o_totalprice DESC NULLS LAST limit 10 offset 440;
