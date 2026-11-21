CREATE TYPE mood AS ENUM ('happy', 'sad', 'ok', 'meh');

SELECT count(*) FROM (SELECT (k % 300)::SMALLINT AS g, count(*) FROM t GROUP BY (k % 300)::SMALLINT);

EXPLAIN SELECT g, min(x) AS m FROM t GROUP BY g HAVING m > 20000;

EXPLAIN SELECT g, any_value(x) AS m FROM t GROUP BY g HAVING m > 20000;

CREATE TABLE tn AS
SELECT CASE WHEN range % 7 = 0 THEN NULL ELSE range END::INTEGER AS x, (range % 16)::INTEGER AS g
FROM range(10240);

INSERT INTO t_big VALUES (4, -614.508, 4), (5, -614.385, 5), (6, -614.262, 6), (7, -614.139, 0), (8, -614.016, 1), (9, -613.893, 2), (12, -613.524, 5), (13, -613.401, 6), (14, -613.278, 0), (15, -613.155, 1), (16, -613.032, 2), (17, -612.909, 3), (18, -612.786, 4), (19, -612.663, 5), (20, NULL, 6), (21, -612.417, 0), (22, -612.294, 1), (23, -612.171, 2), (24, -612.048, 3), (25, -611.925, 4), (26, -611.802, 5), (27, -611.679, 6), (28, -611.556, 0), (29, -611.433, 1), (30, -611.310, 2), (31, -611.187, 3), (32, -611.064, 4), (33, -610.941, 5), (34, -610.818, 6), (35, -610.695, 0), (36, -610.572, 1), (37, -610.449, 2), (38, -610.326, 3), (39, -610.203, 4), (40, -610.080, 5), (41, -609.957, 6), (42, -609.834, 0), (43, -609.711, 1), (44, -609.588, 2), (45, -609.465, 3), (46, -609.342, 4), (47, -609.219, 5), (48, -609.096, 6), (49, -608.973, 0), (50, -608.850, 1), (51, -608.727, 2), (52, -608.604, 3), (53, -608.481, NULL), (54, -608.358, 5), (55, -608.235, 6), (56, -608.112, 0);

SELECT t1.i32, t2.g
FROM t_del t1
JOIN t_big t2 ON t1.i = t2.i
ANTI JOIN t_mid t3 ON t2.dec = t3.dec AND t3.k = 1000
WHERE t1.tsz IS NULL
  AND t2.i IN (SELECT i FROM t_small WHERE g = t2.g);

SELECT x > ANY(SELECT y FROM t2 WHERE t2.id = t1.id) FROM t1 WHERE id = 99;

SELECT 1 <= ANY(SELECT y FROM t2 WHERE y IS NOT NULL);

SELECT count(*) FROM arrays WHERE a[1] BETWEEN 2900 AND 3100;

SELECT count(*) FROM nullable_arrays WHERE a[4] IS NULL;

WITH src AS (SELECT b,c,d FROM guard_rows)
SELECT count(*) FROM src WHERE c::INTEGER>d AND __internal_barrier(CASE WHEN b='hidden' THEN error('hidden row') ELSE true END);

CREATE TABLE pushdown_rows AS SELECT i FROM range(10) t(i);

EXPLAIN ANALYZE SELECT count(*) FROM t WHERE __internal_barrier(i = 42);

EXPLAIN ANALYZE SELECT count(*) FROM t WHERE __internal_barrier(i % 2048 = 42);

EXPLAIN ANALYZE SELECT sum(x) FROM tb WHERE b = FALSE;

EXPLAIN ANALYZE SELECT sum(x) FROM tb WHERE NOT b;

SELECT count(*) FILTER (WHERE isnan(d)), count(*) FILTER (WHERE isnan(f)) FROM isnan_tb;

EXPLAIN ANALYZE SELECT sum(rowid) FROM integers WHERE (x > 3000) = true;

SELECT count(*) FROM booleans WHERE (nextval('s') > 0) IS TRUE;

EXPLAIN ANALYZE
SELECT count(*) FROM case_pruning
WHERE (CASE WHEN x % 2 = 0 THEN x ELSE 0 END) > 1000000;

SELECT count(*) FROM coalesce_pruning WHERE coalesce(x, 0) = 0;

SET explain_output = 'optimized_only';

BEGIN;

EXECUTE midnight;

ATTACH ':memory:' AS elsewhere;

CREATE TEMP TABLE signed_zeros AS SELECT x FROM (VALUES ('0'::DOUBLE), ('-0'::DOUBLE)) t(x);

EXPLAIN ANALYZE SELECT s FROM const_db.constant_strings WHERE hash(s) = hash(NULL::VARCHAR);

SELECT count(*) FILTER (WHERE x::VARCHAR = '1 month'),
       count(*) FILTER (WHERE x::VARCHAR = '30 days') FROM equal_intervals;

SELECT count(*) FROM with_nulls WHERE contains(s, 'python');

SELECT count(*) FROM requests WHERE path NOT LIKE '%health%';

SELECT count(*), sum(x) FROM t WHERE x < 100 OR s > '00008000' OR y = 3000;

CREATE TABLE expression_t AS
SELECT range::INTEGER AS a,
       (range + 10000)::INTEGER AS b,
       5000::BIGINT AS c,
       range::VARCHAR AS s,
       (range + 10000)::VARCHAR AS s2,
       CASE WHEN range < 4096 THEN range ELSE NULL END::INTEGER AS nullable_a,
       CASE WHEN range % 2 = 0 THEN NULL ELSE range END::INTEGER AS mixed_nullable
FROM range(6144);

EXPLAIN ANALYZE SELECT count(*) FROM expression_t WHERE a > b OR a > c;

SELECT count(*) FROM expression_t WHERE least(nullable_a, b) > 5000;

CREATE TABLE t(x INTEGER);

EXPLAIN (FORMAT compact) SELECT count(*) FILTER (WHERE sha256(s) < '8' AND random() < 2.0), sum(i) FILTER (WHERE sha256(s) < '8' AND random() < 2.0) FROM g;

SELECT count(*) FROM months WHERE month(d) BETWEEN 6 AND 9;

SELECT count(*) FROM months WHERE week(d) = 20;

CREATE TABLE cross_year AS
    SELECT make_date(2023 + (range % 2)::INT, 12 - (range % 2)::INT * 11, 1 + (range // 236)::INT) AS d
    FROM range(6144);

EXPLAIN ANALYZE SELECT count(*) FROM cross_year WHERE week(d) = 52;

SELECT count(*) FROM hours_ts WHERE hour(ts) = 12;

CREATE TABLE seconds_ts AS
    SELECT TIMESTAMP '2024-06-01 12:30:00'
           + INTERVAL ((range // 2048) * 20) SECOND
           + INTERVAL ((range % 2048) * 9 // 2048) SECOND AS ts
    FROM range(6144);

EXPLAIN ANALYZE SELECT count(*) FROM seconds_ts WHERE nanosecond(ts) = 25000000000;

SELECT count(*) FROM cross_minute WHERE second(ts) = 59;

INSERT INTO person VALUES (1, 'alice', 10), (2, 'bob', 20), (3, 'carol', 30);

SELECT id FROM (SELECT DISTINCT * FROM (SELECT DISTINCT id, tag FROM keys));

CREATE OR REPLACE TABLE build AS SELECT b FROM scalar_keys;

SELECT count(*) FROM probe JOIN nullable_build ON a IS DISTINCT FROM b;

INSERT INTO function_probe VALUES (1), (2), (NULL);

INSERT INTO prepared_keys VALUES (1,1,1), (2,2,3);

SELECT p.id, o.a IS NOT DISTINCT FROM o.b, o.a IS DISTINCT FROM o.b
FROM preserved p LEFT JOIN optional o USING (id)
ORDER BY p.id;

SELECT a IS NOT DISTINCT FROM b, a IS DISTINCT FROM b FROM tuple_probe, tuple_build;

CREATE TABLE group_build(g INTEGER, v INTEGER);

EXPLAIN SELECT * FROM nullable_probe JOIN build ON a IS NOT DISTINCT FROM b;

EXPLAIN SELECT * FROM function_probe JOIN function_build ON xor(a, 1) IS NOT DISTINCT FROM b;

SELECT count(*) FROM divide_pruning WHERE i // 1000 = 5;

EXPLAIN ANALYZE SELECT count(*) FROM divide_pruning WHERE i // -1000 = -5;

CREATE TABLE divide_float AS
SELECT CASE WHEN i = 5000 THEN 'infinity'::DOUBLE ELSE i::DOUBLE END AS d
FROM range(6144) r(i);

SELECT count(*) FROM empty_concat_pruning WHERE s || '' = 'p495000';

SELECT count(*) FROM dates WHERE date_trunc('dow', d) <= DATE '2020-06-15';

CREATE TABLE nullables(m mood);

explain
SELECT random() FROM nullables WHERE m NOT IN ('sad', 'ok', 'happy');

explain
SELECT count(*) FROM covered WHERE m IN ('sad'::mood, 'ok'::mood, 'happy'::mood);

WITH ins AS (INSERT INTO guard_check VALUES (NULL) RETURNING *) SELECT count(*) FROM guard_check WHERE m IN ('sad', 'ok', 'happy');

INSERT INTO t_int VALUES (1), (2), (3);

CREATE TABLE t_a(i INTEGER);

EXECUTE p;

SELECT list_transform(
	list_filter(list_transform(l, lambda x: struct_pack(filter := true, result := x)), lambda s: s.filter),
	lambda s: s.result::VARCHAR
) FROM (VALUES ([2])) t(l);

EXECUTE list_cast([2]);

SELECT [i + 5 FOR x, i IN l IF i > 2] FROM t;

INSERT INTO capture_t VALUES ([10, 9, 8, 7, 6], 8);

EXPLAIN SELECT NOT constant_or_null(false, mood = 'sad') FROM person;

EXPLAIN SELECT n FROM range(10) t(n) WHERE n > 1 AND n <= 8;

EXPLAIN (FORMAT json) SELECT n FROM range(10) t(n) WHERE n > 1 AND n < 8;

EXPLAIN SELECT abs(n) BETWEEN 1 AND 8 FROM range(10) t(n);

select cast(cast(c1 as BIT) as INTEGER) as cast_res,  1 between -1 and cast(cast(c1 as BIT) as INTEGER) as watever from t1;

INSERT INTO integers VALUES (NULL);

SELECT dt
FROM issue8316
WHERE CAST(dt as TIME) = CAST('10:04:25' as TIME)
ORDER BY 1;

SELECT i FROM integers WHERE (i IS NULL AND (i+1) IS NULL) OR (i IS NULL AND (i+2) IS NULL) ORDER BY i;

SELECT (i IS NOT NULL AND i>1) OR (i IS NOT NULL AND i<10) FROM integers ORDER BY i;

SELECT a, SUM((a*2)+(a*2)+(a*2)+(a*2)+(a*2)) FROM test GROUP BY a;

INSERT INTO dates VALUES (DATE '1992-02-10');

SELECT contains(['a', '', 'b'], '');

explain
SELECT sym, 
    SUM(asize * ask) AS wsumAsk, 
    SUM(bid * bsize) AS wsumBid, 
    STDDEV(asize) AS sdevasksize, 
    STDDEV(bid) AS sdevbid, 
    CORR(ask, bid) AS corPrice, 
    CORR(asize, bsize) AS corSize 
FROM quote
WHERE sym NOT IN (
	NULL,
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'11',
	'12',
)
GROUP BY sym 
ORDER BY sym;

WITH ins AS (
	INSERT INTO dml_quote VALUES (NULL) RETURNING *
)
SELECT count(*)
FROM dml_quote
WHERE sym IN (
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9'
);

SELECT count(*)
FROM quote
WHERE sym NOT IN (
	'0',
	'1',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9'
);

EXPLAIN
FROM quote
WHERE sym <> '100';

SELECT i FROM test WHERE (i=j) OR (i IS NULL AND j IS NULL);

SELECT a = b OR (a IS NULL AND b IS NULL) AS v FROM projection_test;

SELECT i FROM test WHERE (i=j) OR (i IS NULL AND j = 1);

EXPLAIN SELECT x / 1 FROM floats;

EXPLAIN SELECT i FROM integers WHERE 1::DOUBLE = i::DOUBLE;

SELECT count(*) FROM rounded_integers WHERE i::FLOAT / 1 = 16777216::FLOAT;

SELECT x, max(distinct x) over (order by x desc) from range(10) tbl(x);

SELECT -(CAST(-32768 AS SMALLINT)), typeof(-(CAST(-32768 AS SMALLINT)));

SELECT 0 + a FROM test;

SELECT 1 // a FROM test;

CREATE TABLE rows(a INTEGER, b INTEGER, c INTEGER, d INTEGER);

WITH RECURSIVE
edges(here, there) AS (
	VALUES (0, 1), (1, 0)
),
cc(node, comp) USING KEY (node) AS (
	VALUES (0, 0), (1, 1)
	UNION ALL
	SELECT current.node, changed.comp
	FROM cc changed, edges edge, recurring.cc current
	WHERE (edge.here, edge.there) = (current.node, changed.node)
	  AND changed.comp < current.comp
)
SELECT * FROM cc;

SELECT count(*) FROM hours WHERE t::TIME_NS < TIME_NS '13:00:00.0000004';

CREATE TABLE t(i INTEGER);

SELECT count(*) FROM m1 WHERE m IN ('sad', 'ok', 'happy');

EXPLAIN ANALYZE SELECT count(*) FROM covered WHERE i NOT IN (1, 2, 3);

SELECT count(*) FROM doubles WHERE i NOT IN (1, 2, 3);

EXPLAIN ANALYZE SELECT sum(payload) FROM nullable_strings WHERE s NOT IN ('a', 'z');

SELECT count(*) FROM instr_pruning WHERE instr(s, 'mmm') = 1;

EXPLAIN ANALYZE SELECT count(*) FROM interval_pairs WHERE a > b;

CREATE TABLE compat.intervals AS
    SELECT range * INTERVAL '1 day' AS iv, range::BIGINT AS i
    FROM range(6144);

SELECT count(*) FROM dec_small t1 JOIN dec_small t2 ON t1.n >= t2.n AND t1.n + 1 >= t2.n AND t1.n * 2 >= t2.n;

SELECT count(*) FROM dec_small t1 LEFT JOIN dec_small t2 ON t1.n + 1 >= t2.n OR t2.n IS NULL;

INSERT INTO ints VALUES (1), (NULL), (0), (-7);

SELECT count(*) FROM no_nulls t1 JOIN dec_small t2 ON t1.n >= t2.n AND t1.n >= t2.n - 1;

EXPLAIN SELECT count(*) FROM big_a t1 SEMI JOIN big_b t2 ON t1.n = t2.n AND t1.n + 1 >= t2.n;

CREATE TABLE mid_b AS SELECT CASE WHEN i % 5 = 0 THEN NULL ELSE i END::DECIMAL(10,2) AS n FROM range(200) t(i);

SELECT count(*) FROM lhs JOIN rhs ON lhs.n >= rhs.n AND lhs.n + 1 >= rhs.n;

CREATE TABLE prune_right(y INTEGER);

SELECT count(*) FROM big_a t1 SEMI JOIN big_c t2 ON t1.n = t2.n AND t1.n + 1 >= t2.n;

CREATE TABLE lm_pushdown_extract (
    id INTEGER,
    s STRUCT(a INTEGER, b VARCHAR),
    x INTEGER
);

SELECT x FROM pushdown_extract_multi WHERE s.a + s.b = 12 AND s.a = 1;

SELECT id, grp, ts
FROM lm_test
WHERE grp = 1
  AND ts >= TIMESTAMP '2024-01-01'
  AND ts < TIMESTAMP '2024-07-01'
ORDER BY ts
LIMIT 3;

EXPLAIN SELECT id, grp, ts, payload1
FROM lm_test WHERE grp = 1 AND ts >= TIMESTAMP '2024-03-01' ORDER BY ts LIMIT 3;

EXPLAIN ANALYZE SELECT sum(i) FROM left_pruning WHERE left(s, 4) > '0050';

EXPLAIN ANALYZE SELECT sum(i) FROM left_pruning WHERE left(s, -2) = '0010';

SELECT count(*) FROM left_pruning WHERE left(s, 0) <= '';

EXPLAIN ANALYZE SELECT count(*) FROM lists WHERE list_position(l, 3000) IS NOT NULL;

SELECT count(*) FROM string_lists WHERE list_contains(l, '3000');

CREATE TABLE long_string_lists AS
SELECT [repeat('a', 20) || lpad(i::VARCHAR, 4, '0')] AS l
FROM range(6144) tbl(i);

SELECT count(*) FROM interval_lists WHERE list_contains(l, INTERVAL '3000 days');

CREATE TABLE big_lists AS SELECT [9223372036854775807] AS l;

SELECT coalesce(list_position(list_transform(l, lambda x: epoch(x)), -1::DOUBLE), 99)
FROM (SELECT [make_time(nextval('lambda_seq') % 24, 0, 0)] AS l) q;

EXPLAIN ANALYZE SELECT count(*) FROM maps WHERE map_contains_value(m, 3000);

SELECT count(*) FROM null_valued_map WHERE list_position(map_values(m), NULL) = 1;

SELECT s.min, s.max FROM (SELECT STATS(3 % i) s FROM integers LIMIT 1);

SELECT s.min, s.max FROM (SELECT STATS(i % 3) s FROM integers LIMIT 1);

INSERT INTO extremes VALUES (-9223372036854775808, -128, -9223372036854775808, -128), (9223372036854775807, 127, -1, -1);

CREATE TABLE unsigned(u UTINYINT, h UHUGEINT, b UBIGINT);

SELECT s.min, s.max FROM (SELECT STATS(i::HUGEINT % 3) s FROM integers LIMIT 1);

SELECT s.min, s.max FROM (SELECT STATS(x % -100.0) s FROM doubles LIMIT 1);

SELECT s.min, s.max FROM (SELECT STATS(x % 2.0) s FROM doubles LIMIT 1);

SELECT count(*) FROM modulo_pruning WHERE 6144 % (i - 3000) = 3000;

SELECT count(*) FROM t WHERE floor(x::DOUBLE) BETWEEN 245760 AND 249999;

EXPLAIN ANALYZE
SELECT sum(x)
FROM monotone_math
WHERE atan(x) > 1;

SELECT count(*) FROM last_day_db.two WHERE date_diff('day', DATE '2025-01-01', d) > 60;

EXPLAIN SELECT count(*) FROM d WHERE year(dt) < 1975;

INSERT INTO e VALUES ('2020-06-15'), ('2019-01-01'), ('2021-12-31'), ('infinity'), ('-infinity'), (NULL);

SELECT count(*) FROM e WHERE (year(dt) = 2020) IS FALSE;

CREATE TABLE ets AS
  SELECT ('2000-01-01'::TIMESTAMP + INTERVAL (range) HOUR) AS t FROM range(200000)
  UNION ALL SELECT 'infinity'::TIMESTAMP UNION ALL SELECT '-infinity'::TIMESTAMP UNION ALL SELECT NULL::TIMESTAMP;

EXPLAIN SELECT count(*) FROM ets WHERE year(t) > -1000000000;

SELECT count(*) FROM edge WHERE epoch(t) > -9223372036854775807;

SELECT count(*) FROM edge WHERE epoch_us(t) = -9223372036854775806;

SELECT count(*) FILTER (epoch_us(t) <= -9223372036854775806), count(*) FILTER (epoch(t) > -9223372036854775807),
       count(*) FILTER (epoch_us(t) >= -9223372036854775806), count(*) FILTER (year(t) < 2000) FROM below;

INSERT INTO edge_d VALUES
  (make_date(-2147483646)), ('2000-01-01'), (make_date(2147483646)), ('-infinity'), ('infinity'), (NULL);

INSERT INTO tinyints VALUES (CAST(-128 AS TINYINT)), (-2), (0), (2), (127), (NULL);

SELECT count(*) FROM edge_tz WHERE epoch_us(t) >= -9223372036854775806;

CREATE TABLE xy AS
SELECT CASE WHEN range % 2 = 0 THEN NULL ELSE range END::BIGINT AS i, (range + 200000)::BIGINT AS j
FROM range(400000);

SET explain_output='all';

EXPLAIN SELECT count(*) FROM t WHERE TRY_CAST(a AS TINYINT) > 50;

CREATE TABLE array_nulls AS
SELECT [i, i, i]::INTEGER[3] AS a
FROM range(99999) t(i);

EXPLAIN ANALYZE SELECT count() FROM t WHERE NOT (i >= 10 AND i <= 999989);

SELECT count(*) FROM volatile_t WHERE NOT (a AND nextval('s') > 0);

EXPLAIN SELECT s IS NOT NULL FROM t;

SELECT sum(i) FROM integers WHERE i < 1000;

EXPLAIN ANALYZE SELECT sum(length(s)) FROM strings WHERE s = '03000';

EXPLAIN ANALYZE SELECT count(*) FROM not_null_integers WHERE NULL IS NOT DISTINCT FROM i;

SELECT count(*) FROM t WHERE x = 5 OR NULL OR NULL::BOOLEAN;

SELECT count(*) FROM t WHERE COALESCE(x = 5 OR NULL, true);

EXPLAIN SELECT count(*) FROM t WHERE x BETWEEN 1 AND 20 OR x BETWEEN 21 AND 40 OR x BETWEEN 41 AND 60 OR x BETWEEN 61 AND 80 OR x BETWEEN 81 AND 100;

EXPLAIN SELECT count(*) FROM t WHERE (x >= 1 AND x < 20) OR (x >= 20 AND x <= 40);

EXPLAIN SELECT count(*) FROM t WHERE (x > 0 AND x <= 20) OR (x >= 21 AND x < 41);

EXPLAIN SELECT count(*) FROM t WHERE x BETWEEN 1 AND 20 OR y BETWEEN 21 AND 40;

EXPLAIN SELECT count(*) FROM t WHERE x <= 20 OR x > 20;

CREATE TABLE iv AS SELECT INTERVAL '15 days' AS v UNION ALL SELECT INTERVAL '40 days';

SELECT count(*) FROM (VALUES (INTERVAL '5 days')) t(v) WHERE (invoke(lambda a: day(a + INTERVAL '1 month'), v) >= 0 AND invoke(lambda a: day(a + INTERVAL '30 days'), v) <= 10) OR invoke(lambda a: day(a + INTERVAL '1 month'), v) BETWEEN 10 AND 20;

SELECT x, x BETWEEN 1 AND 20 OR x BETWEEN 21 AND 40 FROM t WHERE x IS NULL OR x IN (0, 1, 40, 41) ORDER BY x NULLS FIRST;

CREATE TABLE huge AS SELECT (i * 1000000000000000000000)::HUGEINT AS v FROM range(-50, 50) r(i);

SELECT count(*) FROM dec WHERE v BETWEEN 1 AND 20 OR v BETWEEN 20 AND 40;

SELECT count(*) FROM dates WHERE v BETWEEN DATE '2020-01-01' AND DATE '2020-01-31' OR v BETWEEN DATE '2020-02-01' AND DATE '2020-02-29';

SET disabled_optimizers = 'expression_rewriter';

SELECT x FROM dense_or WHERE x = 1 OR x = 1 OR x = 2 ORDER BY x;

SELECT count(*) FROM dense_or_other WHERE s = 'a' OR s = 'b';

PREPARE dense_or_prepared AS SELECT x FROM dense_or WHERE x = $1 OR x = $2 ORDER BY x;

INSERT INTO struct_pushdown_test VALUES (1, {'sub_col1': 42, 'sub_col2': true}), (2, NULL), (3, {'sub_col1': 84, 'sub_col2': NULL}), (4, {'sub_col1': NULL, 'sub_col2': false});

CREATE TABLE x AS SELECT i AS w FROM range(5) t(i);

set disabled_optimizers to 'build_side_probe_side';

CREATE TABLE tbl(x INTEGER);

SELECT * FROM integers i1, integers i2 WHERE i1.i=i2.i AND i1.i>1 ORDER BY 1;

SELECT * FROM integers i1 LEFT OUTER JOIN integers i2 ON 1=1 WHERE i1.i=i2.i ORDER BY 1;

SELECT * FROM (SELECT i1.i AS a, i2.i AS b FROM integers i1, integers i2) a1 WHERE a=b ORDER BY 1;

INSERT INTO cohort (person_id, cohort_start_date, cohort_end_date) VALUES
  (1, DATE '2021-01-01', DATE '2021-02-15'),
  (1, DATE '2021-01-01', NULL);

CREATE TABLE vals2(k INTEGER, l INTEGER);

SELECT * FROM vals1 LEFT OUTER JOIN vals2 ON 1=1 WHERE i=k ORDER BY i LIMIT 5;

SELECT * FROM (SELECT * FROM vals1, vals2 EXCEPT SELECT * FROM vals1, vals2) tbl1 WHERE i=3 AND k=5;

SELECT COUNT(*) FROM (SELECT * FROM vals1, vals2) tbl1, (SELECT * FROM vals1, vals2) tbl2 WHERE tbl1.i=tbl1.k AND tbl1.i=tbl2.k AND tbl1.i=tbl2.i AND tbl1.i>4999 AND tbl1.i<5001;

explain with recursive
	field(x, y, v) as (
		values (0, 0, 'S'), (1, 0, '.'), (0, 1, '.'), (1, 1, '#')
	),
	directions(dx, dy) as (
		values (1, 0), (-1, 0), (0, 1), (0, -1)
	),
	maxlen(maxlen) as (
		select 3
	),
	flood(step, x, y, lx, ly) as (
		select 0::smallint, x, y, -1::smallint, -1::smallint
		from field
		where v = 'S'
		union all
		select distinct
			step + 1::smallint,
			f.x,
			f.y,
			l.x,
			l.y
		from (flood l cross join directions)
		join field f on l.x + dx = f.x and l.y + dy = f.y, maxlen
		where v != '#' and (f.x != lx or f.y != ly) and step < maxlen
	)
select * from flood;

CREATE TABLE test2 (b INTEGER, c INTEGER);

CREATE TABLE power_pruning AS
SELECT CASE WHEN i < 122880 THEN 1 ELSE 100 END::INTEGER AS x
FROM range(245760) tbl(i);

CREATE TABLE power_zero AS
SELECT CASE WHEN i < 122880 THEN 'inf'::DOUBLE ELSE 1.0 END AS x
FROM range(245760) tbl(i);

SET ieee_floating_point_ops = false;

EXPLAIN SELECT * FROM t WHERE (a=1 AND b=5) OR (a=2 AND b=5);

SELECT (a=1 AND b>3) OR (a=1 AND c<5) FROM t;

EXPLAIN ANALYZE SELECT count(*) FROM prefix_pruning WHERE NOT prefix(s, '00');

SELECT count(*) FROM prefix_mixed WHERE NOT starts_with(s, '00');

SELECT count(*) FROM prefix_nullable WHERE NOT starts_with(s, '00');

CREATE TABLE store_sales AS
SELECT (i % 1800) + 1 AS ss_item_sk, (i % 5) + 1 AS ss_quantity, CAST((i % 1000) / 10.0 AS DECIMAL(7,2)) AS ss_sales_price,
       CAST((i % 200) - 100 AS DECIMAL(7,2)) AS ss_net_profit, 2451000 + (i % 1000) AS ss_sold_date_sk, i AS ss_ticket_number
FROM range(3000) t(i);

INSERT INTO store_sales VALUES (1, 1, 2, 25.0, 1.0, 1, 0.0, 1), (2, 2, 1, 5.0, -1.0, 2, 1.0, 2), (1, 2, 2, 30.0, 2.0, 2, 0.0, 3);

EXPLAIN SELECT * FROM (SELECT b, d, b // 2 AS j FROM casts) WHERE b BETWEEN 100.5 AND 200.5;

EXPLAIN SELECT * FROM (SELECT i, d, i // 2 AS j FROM casts) WHERE CAST(i AS DECIMAL(9,0)) BETWEEN 100 AND 200;

EXPLAIN SELECT * FROM (SELECT i, d, count(*) AS c FROM casts GROUP BY ALL) WHERE CAST(d AS DECIMAL(5,2)) BETWEEN 100 AND 200;

SELECT h FROM (SELECT h, d, h // 2 AS j FROM casts) WHERE CAST(h AS DECIMAL(39,0)) BETWEEN 100 AND 200;

SELECT i FROM flat WHERE s.a::BOOLEAN AND i > 0 AND j > 0 ORDER BY i;

SELECT i, s.b FROM flat WHERE s.a AND i < j ORDER BY i;

CREATE TABLE windowed AS SELECT
    k % 2 AS grp, {'id': k + 1000, 'ms': {'a': k + 200, 'b': 50 - k}} AS v
FROM range(6) t(k);

SET disabled_optimizers = 'filter_pushdown';

SELECT s.payload.x.deep AS a, s.payload::VARCHAR AS b FROM t2;

CREATE TABLE dt(id INTEGER, d DATE);

SET scalar_aggregate_merge_threshold = 1;

INSERT INTO two_keys VALUES (1), (2);

SELECT CAST(am AS DECIMAL(15, 4)) / CAST(pm AS DECIMAL(15, 4)) AS ratio FROM
    (SELECT count(*) AS am FROM sales, dim1, dim2 WHERE sales.k = dim1.dk AND sales.q = dim2.qk AND dim1.dname = 'b' AND dim2.h BETWEEN 1 AND 2) a,
    (SELECT count(*) AS pm FROM sales, dim1, dim2 WHERE sales.k = dim1.dk AND sales.q = dim2.qk AND dim1.dname = 'b' AND dim2.h BETWEEN 7 AND 8) p;

SELECT (SELECT sum(CASE WHEN k = 1 THEN 1 ELSE CAST('bad' AS INTEGER) END) FROM two_keys WHERE k = 1) AS a,
       (SELECT count(*) FROM two_keys WHERE k = 2) AS b;

EXPLAIN SELECT (SELECT sum(paid) FROM sales, dim1 WHERE sales.k = dim1.dk AND dim1.dname = 'a') AS a,
       (SELECT avg(disc) FROM sales, dim1 WHERE sales.k = dim1.dk AND dim1.dname = 'b') AS b,
       (SELECT max(q) FROM sales, dim1 WHERE dim1.dk = sales.k AND dim1.dname = 'c') AS c;

EXPLAIN SELECT (SELECT count(*) FROM sales, dim1 WHERE sales.k = dim1.dk AND dim1.dname = 'a') AS a,
       (SELECT count(*) FROM sales, dim1 WHERE sales.v = dim1.dk AND dim1.dname = 'a') AS b;

SET scalar_aggregate_merge_threshold = 5001;

PRAGMA tpcds(90, sf=0.01);

CREATE VIEW regular_view AS
    SELECT hidden_table.j, count(*) AS c, max(other.k) AS mk
    FROM hidden_table JOIN other ON hidden_table.i = other.i
    WHERE hidden_table.j <> 7
    GROUP BY hidden_table.j;

EXPLAIN ANALYZE (FORMAT json) SELECT * FROM counting_view;

CREATE SECURE VIEW visible_secrets AS
	SELECT sec.id, sec.pattern, sec.d, sec.i FROM secrets sec JOIN allowed a ON (sec.id = a.id);

SELECT id FROM visible_secrets WHERE timezone_hour(i) IS NULL;

EXPLAIN ANALYZE SELECT count(*) FROM big_secure b JOIN dim d ON b.id = d.k WHERE d.yr = 42;

CREATE SECURE VIEW big_projected AS SELECT id FROM big;

SELECT count(*) FROM probe p JOIN narrow_secure n ON n.id = p.id;

SELECT count(*) FROM wide_try_secure n JOIN probe p ON n.id = p.id;

CREATE TABLE vt AS SELECT CASE WHEN i % 10 = 9 THEN (i::DOUBLE)::VARIANT ELSE i::INTEGER::VARIANT END AS v FROM range(100) t(i);

CREATE TABLE wide_hidden AS SELECT i::BIGINT AS id, i % 2 AS g, true AS visible FROM range(100) t(i) UNION ALL SELECT 9999999999::BIGINT, 1, false;

EXPLAIN ANALYZE SELECT count(*) FROM wide_any_joined_secure w JOIN ik ON w.id::INTEGER = ik.k;

SELECT count(*) FROM cross_secure w JOIN ik ON w.id::INTEGER = ik.k;

SELECT count(*) FROM outer_secure o JOIN nested_keys n ON o.id = n.k;

CREATE VIEW fact_regular_filtered AS SELECT * FROM fact WHERE id < 100000;

EXPLAIN SELECT count(*) FROM fact_secure_filtered f JOIN dim1 ON f.d1 = dim1.k WHERE f.v > 150000;

EXPLAIN SELECT secure_view.i FROM secure_view JOIN integers USING (i) WHERE integers.i = 42;

INSERT INTO secrets VALUES (1, 'top_secret'), (2, '42');

CREATE TABLE mixed AS SELECT i, CASE WHEN i < 50 THEN 'hidden_' || i ELSE i::VARCHAR END AS s FROM range(100) t(i);

CREATE VIEW filtered_regular_view AS SELECT * FROM integers WHERE i = 42;

CREATE SECURE VIEW visible_cast AS SELECT * FROM (SELECT i, s FROM mixed) WHERE i::VARCHAR::INT >= 50;

CREATE SECURE VIEW guarded_view AS
WITH src AS (SELECT b,c,d FROM guard_rows) SELECT * FROM src WHERE c::INTEGER>d;

SELECT count(*) > 0 FROM pragma_storage_info('rle_secrets') WHERE column_name = 'val' AND compression = 'RLE';

CREATE TABLE employees AS SELECT i AS id, ('emp' || i) AS name, i * 1000 AS salary FROM range(10) t(i);

CREATE SECURE VIEW limited_secure_view AS SELECT * FROM integers LIMIT 10;

CREATE SECURE VIEW joined_secure_view AS SELECT i1.i FROM integers i1 JOIN integers i2 USING (i);

CREATE SECURE VIEW secure_view_over_secure_view AS SELECT * FROM secure_view;

CREATE SECURE VIEW impossible_secure_view AS SELECT * FROM integers WHERE i > 100000;

CREATE TABLE ws2 AS FROM ws;

SELECT count(*), sum(o), sum(p) FROM (SELECT DISTINCT a.o, a.p FROM ws a, ws b WHERE a.o = b.o AND a.p = b.p AND a.w <> b.w);

EXPLAIN SELECT count(*), sum(x) FROM q WHERE x IN (SELECT a.o FROM ws a JOIN ws b ON a.o = b.o AND a.w <> b.w);

EXPLAIN SELECT count(*) FROM q WHERE x IN (SELECT a.w FROM ws a, ws b WHERE a.o = b.o AND a.w <> b.w);

EXPLAIN SELECT count(*) FROM q WHERE x IN (SELECT a.o FROM ws a, ws b WHERE a.o = b.o AND a.w <> b.w + 1);

SELECT count(*), sum(x) FROM q WHERE EXISTS (SELECT 1 FROM ws a, ws b WHERE a.o = b.o AND a.w <> b.w AND a.o = q.x);

CREATE TABLE t (k INTEGER, x INTEGER);

CREATE TABLE web_sales AS SELECT
    CASE WHEN i % 89 = 0 THEN NULL ELSE (i % 400)::INTEGER END AS ws_order_number,
    CASE WHEN i % 400 < 100 THEN 1 WHEN i % 400 < 120 THEN NULL WHEN i % 11 = 0 THEN NULL ELSE ((i // 400) % 3)::INTEGER END AS ws_warehouse_sk,
    (i % 7)::INTEGER AS ws_ship_date_sk,
    (i % 50)::DECIMAL(7,2) AS ws_net_profit
FROM range(4000) r(i);

CREATE TABLE false_singletons AS
SELECT CASE WHEN i = 32 THEN 0 ELSE i END * 2018::BIGINT AS g,
       CASE WHEN i = 32 THEN 9 ELSE i % 2 END::INT AS x FROM range(33) t(i);

EXPLAIN SELECT count(*) FROM (SELECT DISTINCT ON (id) k FROM nodes) s JOIN edges e ON s.k = e.k;

EXPLAIN SELECT count(*)
FROM (SELECT arg_min(x, p, 2) AS k FROM bit_pairs_left GROUP BY g) l
JOIN (SELECT arg_min(x, p, 2) AS k FROM bit_pairs_right GROUP BY g) r ON l.k = r.k;

EXPLAIN SELECT count(*)
FROM (SELECT first(x) AS k FROM unique_list_values GROUP BY id) l
JOIN (SELECT first(x) AS k FROM unique_list_values_right GROUP BY id) r ON l.k = r.k;

SELECT count(*)
FROM (SELECT arg_max(x, p, 2) AS k FROM bit_pairs_left GROUP BY g) l
JOIN (SELECT arg_max(x, p, 2) AS k FROM bit_pairs_right GROUP BY g) r ON l.k = r.k;

SELECT count(*)
FROM (SELECT arg_min(x, p) AS k FROM unique_list_values GROUP BY id) l
JOIN (SELECT arg_min(x, p) AS k FROM unique_list_values_right GROUP BY id) r ON l.k = r.k;

INSERT INTO nullable_unique SELECT CASE WHEN id < 2 THEN NULL ELSE id END, x FROM unique_list_values;

EXPLAIN SELECT count(*)
FROM (SELECT min(x) AS k FROM unique_list_values GROUP BY CAST(id AS BOOLEAN)) l
JOIN (SELECT min(x) AS k FROM unique_list_values_right GROUP BY CAST(id AS BOOLEAN)) r ON l.k = r.k;

CREATE TABLE biased_edges AS SELECT ((i % 3) * 3)::INT AS k FROM range(12) t(i);

SELECT count(*), sum(l.z + r.z)
FROM (SELECT min(x) AS k, max(id) AS z FROM unique_list_values GROUP BY id::BIGINT) l
JOIN (SELECT min(x) AS k, max(id) AS z FROM unique_list_values_right GROUP BY id::BIGINT) r USING (k);

EXPLAIN SELECT count(*)
FROM (SELECT first(x ORDER BY id) AS k FROM unique_list_values GROUP BY GROUPING SETS ((id), ())) l
JOIN (SELECT first(x ORDER BY id) AS k FROM unique_list_values_right GROUP BY GROUPING SETS ((id), ())) r USING (k);

SELECT count(*), sum(l.z + r.z), sum(l.w + r.w)
FROM (SELECT min(x) AS k, max(id) AS z, max(rn) AS w
      FROM (SELECT *, row_number() OVER (ORDER BY x, id DESC) AS rn FROM unique_list_values) p GROUP BY id) l
JOIN (SELECT min(x) AS k, max(id) AS z, max(rn) AS w
      FROM (SELECT *, row_number() OVER (ORDER BY x, id DESC) AS rn FROM unique_list_values_right) p GROUP BY id) r USING (k);

SELECT length(l) FROM same_length;

CREATE TABLE empty_lists(l INT[]);

SELECT length([1, 2, 3]);

INSERT INTO concat_t VALUES (NULL, [7, 8, 9]), ([10], NULL);

CREATE TABLE lists AS SELECT [i::INT, (i + 1)::INT] AS l, [i::INT, NULL] AS nl, [i::INT, i::INT]::INT[2] AS a
FROM range(1000) r(i);

EXPLAIN SELECT x IS NULL FROM (SELECT unnest(l) AS x FROM lists);

SELECT max(x) FROM (SELECT unnest(['a', 'bb', 'ccc']) AS x);

EXPLAIN ANALYZE SELECT sum(payload) FROM s WHERE v <> 'a';

EXPLAIN ANALYZE SELECT sum(payload) FROM s WHERE v <= 'a';

INSERT INTO long_strings SELECT repeat('b', 13), 1 FROM range(2048);

SELECT sum(payload) FROM long_strings WHERE v <= repeat('b', 12);

SELECT sum(payload) FROM long_strings WHERE v < repeat('b', 13);

SELECT sum(payload) FROM long_strings WHERE v <> repeat('b', 13);

SELECT sum(payload) FROM long_strings WHERE v <= repeat('a', 12);

SELECT sum(payload) FROM long_strings WHERE v < repeat('c', 12);

SELECT sum(payload) FROM long_strings WHERE v <> repeat('c', 12);

WITH extracted AS (
	SELECT {'d': s} AS g FROM dates
)
SELECT g.d::DATE
FROM extracted
WHERE CASE WHEN (SELECT 1) = 1
           THEN length(g.d) > 0 OR (SELECT 1) <> 1
           ELSE length(g.d) > 0 OR (SELECT 1) <> 1
      END;

CREATE TABLE c(s VARCHAR);

SET wal_autocheckpoint = '1TB';

EXPLAIN ANALYZE SELECT sum(i) FROM substring_pruning WHERE substr(s, 2, 4) = '4950';

EXPLAIN ANALYZE SELECT sum(i) FROM substring_pruning WHERE s[0:2] > 'p3';

SELECT count(*) FROM substring_pruning WHERE s[5:2] = '';

SELECT count(*) FROM substring_pruning WHERE substr(s, 0, 3) > 'p3';

EXPLAIN ANALYZE SELECT sum(i) FROM substring_pruning_utf8 WHERE s[2:5] > '4950';

EXPLAIN ANALYZE SELECT sum(i) FROM substring_truncated_pruning
WHERE substr(s, 2) = '495000' || repeat('x', 20);

SELECT count(*) FROM substring_truncated_stats WHERE s[14:] > '495000';

CREATE TABLE tb AS SELECT (range % 3 = 0) AS b FROM range(10000);

SELECT sum(s) FROM tshn HAVING sum(s) < 0;

EXPLAIN SELECT sum(x) FROM tu8  HAVING sum(x) < 0;

EXPLAIN SELECT g FROM tallneg GROUP BY g HAVING sum(v) > 0;

SELECT count(*)
FROM distinct_from_nulls
WHERE a IS DISTINCT FROM 5;

CREATE TABLE build_num AS
SELECT i::BIGINT AS k, (i % 7)::INTEGER AS g
FROM (VALUES (100000), (900000)) v(i);

CREATE TABLE build_part AS
SELECT v::INTEGER AS part
FROM (VALUES (42), (43)) t(v);

SELECT count(*)
FROM probe_cast_down p
JOIN build_cast_down b
  ON p.k = b.k
 AND p.g >= b.g;

SELECT count(*)
FROM phj_probe_cast_down p
JOIN phj_build_cast_down b
  ON p.k = b.k;

SELECT count(*)
FROM (
  SELECT *
  FROM phj_probe_narrow_cast
  WHERE k < 2000000000
) p
JOIN phj_build_narrow_cast_sparse b
  ON p.k::INTEGER = b.k;

SELECT count(*)
FROM phj_probe_narrow_cast p
JOIN bf_build_narrow_cast_errors b
  ON TRY_CAST(p.k AS INTEGER) = b.k;

SELECT count(*)
FROM bf_probe_cast_down p
JOIN bf_build_cast_down b
  ON p.k = b.k
 AND p.g >= b.g;

EXPLAIN SELECT * FROM dst_table WHERE CAST(col AS TIMESTAMP) > '2026-10-25 02:30:00'::TIMESTAMP;

CREATE TABLE tsns_table AS SELECT ('2020-01-01'::TIMESTAMP + (i * INTERVAL '1 minute'))::TIMESTAMP_NS AS col FROM range(1000000) t(i);

EXPLAIN SELECT * FROM date_table WHERE CAST(col AS TIMESTAMP) = '2022-06-15'::TIMESTAMP;

EXPLAIN SELECT * FROM tss_table WHERE CAST(col AS DATE) > '2020-06-01'::DATE;

SELECT count(*) FROM date_table WHERE CAST(col AS TIMESTAMP) > '2024-01-01'::TIMESTAMP;

SELECT count(*) FROM tz_table WHERE CAST(col AS DATE) = DATE '2021-11-07';

EXPLAIN SELECT count(*) FROM tz_table WHERE CAST(col AS TIMESTAMP_MS) = TIMESTAMP_MS '2021-11-07 01:30:00';

EXPLAIN SELECT count(*) FROM apia WHERE CAST(col AS TIMESTAMPTZ) = TIMESTAMPTZ '2011-12-31 12:00:00+14';

SELECT (SELECT sum(a) FROM scan_columns WHERE k % 5 = 1),
       (SELECT sum(b)::BIGINT FROM scan_columns WHERE k % 5 = 1);

SELECT sum(x), avg(x)
FROM (
	SELECT a + 1 AS x FROM scan_columns WHERE k < 5
	UNION ALL
	SELECT a + 1 AS x FROM scan_columns WHERE k < 5
);

SELECT nextval('aggregate_calls');

WITH survey_daily AS (
	SELECT order_type, count(*) AS responses, sum(amount) AS revenue
	FROM (SELECT amount, order_type FROM order_lifecycle) survey_results
	GROUP BY order_type
),
daily_totals AS (
	SELECT count(*) AS total_orders
	FROM order_lifecycle
	WHERE is_net_order
)
SELECT order_type, responses::VARCHAR, revenue::VARCHAR, total_orders::VARCHAR
FROM (
	SELECT s.order_type, s.responses, s.revenue, dt.total_orders
	FROM survey_daily s, daily_totals dt
) result
ORDER BY order_type;

SELECT *
FROM (SELECT count(*)
      FROM shared_fact f JOIN shared_dim d ON f.k = d.k
      JOIN shared_store s ON f.j = s.j
      WHERE s.keep AND d.bucket = 0) a,
     (SELECT count(*)
      FROM shared_fact x JOIN shared_dim y ON x.k = y.k
      JOIN shared_store z ON x.j = z.j
      WHERE z.keep AND y.bucket = 1) b;

SELECT (SELECT count(*) FROM outlier_fact f JOIN outlier_dim d ON f.a = d.a WHERE f.b = 50 AND d.g = 0),
       (SELECT count(*) FROM outlier_fact f JOIN outlier_dim d ON f.a = d.a WHERE f.b < 10),
       (SELECT count(*) FROM outlier_fact f JOIN outlier_dim d ON f.a = d.a WHERE f.b > 90);

EXPLAIN (FORMAT JSON) SELECT sum(length(s)), avg(length(s)) FROM projected_plan WHERE length(s) > 1
UNION ALL SELECT sum(length(u)), avg(length(u)) FROM projected_plan WHERE length(u) > 1;

EXPLAIN (FORMAT JSON) SELECT (SELECT avg(a) FROM plan_fact WHERE k < 990),
                            (SELECT avg(b) FROM plan_fact WHERE k < 990);

EXPLAIN (FORMAT JSON) SELECT (SELECT sum(v::INTEGER) FROM throwing_input WHERE k < 5),
                            (SELECT max(v::INTEGER) FROM throwing_input WHERE k < 5);

CREATE TABLE d (id INT, j INT, x INT, y INT, z INT, k INT);

SELECT (SELECT sum(a) FROM overlap_join), (SELECT sum(b) FROM overlap_join);

SELECT sum(length(s)), avg(length(s)) FROM projected
UNION ALL
SELECT sum(length(u)), avg(length(u)) FROM projected;

SELECT l.k, r.x, r.y FROM projected l
LEFT JOIN (SELECT k, coalesce(length(s), 7) x, 42 y FROM projected WHERE k < 2) r USING (k)
UNION ALL
SELECT l.k, r.x, r.y FROM projected l
LEFT JOIN (SELECT k, coalesce(length(u), 9) x, 42 y FROM projected WHERE k < 2) r USING (k);

SELECT sum(x), count(x) FROM (
	SELECT length(s) x FROM positional_input UNION ALL SELECT length(u) FROM positional_input
) q
UNION ALL
SELECT sum(x), count(x) FROM (
	SELECT length(s) x FROM positional_input UNION ALL SELECT length(s) FROM positional_input
) q;

CREATE TABLE csp_pm_a_upserts(customer_id BIGINT, id BIGINT);

CREATE TABLE csp_pm_o_upserts(customer_id BIGINT, id BIGINT, flag BOOLEAN);

CREATE TABLE csp_pm_p_upserts(id BIGINT, category VARCHAR, alert_at TIMETZ);

SELECT MAX(CASE WHEN COALESCE(orders_by_customer.c1, 0) = 0 OR COALESCE(orders_by_customer.c2, 0) = 0 THEN 1 ELSE 2 END)
FROM csp_pm_a
LEFT JOIN (
	SELECT csp_pm_o.customer_id,
	       COUNT(product_info.name1) AS c1,
	       COUNT(product_info.name2) AS c2
	FROM csp_pm_o
	INNER JOIN csp_pm_i ON csp_pm_o.id = csp_pm_i.order_id
	LEFT JOIN (
		SELECT csp_pm_p.id,
		       category_info.name1 AS name1,
		       category_info.name2 AS name2
		FROM csp_pm_p
		LEFT JOIN (
			SELECT csp_pm_c.name,
			       csp_pm_c.short_name AS name1,
			       csp_pm_c.short_name AS name2
			FROM csp_pm_c
			WHERE csp_pm_c.demand <= 2::SMALLINT
		) AS category_info
		ON csp_pm_p.category = category_info.name
		WHERE csp_pm_p.alert_at >= ('18:30:00.178')::TIMETZ
	) AS product_info
	ON csp_pm_i.product_id = product_info.id
	GROUP BY csp_pm_o.customer_id
) AS orders_by_customer
ON csp_pm_a.customer_id = orders_by_customer.customer_id
LEFT JOIN csp_pm_tx
ON csp_pm_a.id = csp_pm_tx.a_id
LEFT JOIN (
	SELECT csp_pm_o.customer_id,
	       MAX(repeated_order.v) AS v
	FROM csp_pm_o
	LEFT JOIN (
		SELECT csp_pm_o.customer_id,
		       MIN(DISTINCT csp_pm_o.customer_id) AS v
		FROM csp_pm_o
		GROUP BY csp_pm_o.customer_id
	) AS repeated_order
	ON csp_pm_o.customer_id = repeated_order.customer_id
	WHERE csp_pm_o.flag != FALSE
	GROUP BY csp_pm_o.customer_id
) AS unreferenced_branch
ON csp_pm_a.customer_id = unreferenced_branch.customer_id;

SELECT count(*) FROM (SELECT * FROM repeat_row([1,NULL], {'a': 'x'}, num_rows=3) INTERSECT ALL SELECT * FROM repeat_row([1,NULL], {'a': 'x'}, num_rows=3));

SELECT count(*) FROM (SELECT * FROM generate_series(1,3) INTERSECT ALL SELECT * FROM generate_series(1,3));

SELECT (SELECT count(*) FROM pragma_storage_info('repeatable_input')) = (SELECT count(*) FROM pragma_storage_info('repeatable_input'));

SET TimeZone='America/New_York';

EXPLAIN (FORMAT JSON) SELECT * FROM json_tree('[1,1,null]') INTERSECT ALL SELECT * FROM json_tree('[1,1,null]');

SET enable_caching_operators=true;

CREATE TABLE repeatable_schema(i INTEGER, s VARCHAR);

EXPLAIN (FORMAT JSON) SELECT * FROM pragma_table_info('repeatable_schema') INTERSECT ALL SELECT * FROM pragma_table_info('repeatable_schema');

SELECT count(*) FROM (SELECT * FROM pragma_show('repeatable_schema_view') INTERSECT ALL SELECT * FROM pragma_show('repeatable_schema_view'));

INSERT INTO csp_fact VALUES (NULL, 77);

SELECT (SELECT count(*) FROM csp_fact f JOIN csp_dim d USING (k)),
       (SELECT count(*) FROM csp_fact f JOIN csp_dim d USING (k) WHERE bucket = 0);

SELECT sum(lhs.val), sum(rhs.val) FROM self_input lhs JOIN self_input rhs ON lhs.key < rhs.key
UNION ALL
SELECT sum(lhs.val), sum(rhs.val) FROM self_input lhs JOIN self_input rhs ON lhs.key < rhs.key;

EXPLAIN SELECT 'a', count(*) FROM csp_filter_key WHERE a > 1
UNION ALL
SELECT 'b', count(*) FROM csp_filter_key WHERE b > 1;

select
      col1,
      col2,
      col3
  from t1
      join t2
      on t1.col1 = t2.col3
  group by grouping sets (col1, col2, col3), (col1, col2), (col1) order by 1, 2 ,3;

SELECT floor(x), floor(x)+1, count(*) FROM f GROUP BY floor(x), floor(x)+1 ORDER BY floor(x);

EXPLAIN (FORMAT JSON) SELECT x, x-1, x+2, x*3, count(*) FROM t GROUP BY x, x-1, x+2, x*3;

EXPLAIN (FORMAT JSON) SELECT floor(x), floor(x)+1, count(*) FROM f GROUP BY floor(x), floor(x)+1;

SELECT count(*) FROM t WHERE s GLOB '*m?m*';

CREATE TABLE strings(value VARCHAR NOT NULL);

EXPLAIN (FORMAT JSON) SELECT * FROM nullable_strings WHERE value NOT LIKE '%special%requests%';

EXPLAIN SELECT * FROM t WHERE NOT (a > 2);

SELECT * FROM t WHERE NOT (a > 2);

EXPLAIN WITH limited AS (
    SELECT col1, col2 FROM events WHERE col3 = 1 LIMIT 10
)
SELECT e.col1, COUNT(*) 
FROM events e
WHERE e.col1 IN (SELECT col1 FROM limited)
GROUP BY ROLLUP(e.col1);

EXPLAIN ANALYZE SELECT count(*) FROM rowid_prune WHERE rowid = 122880;

EXPLAIN ANALYZE SELECT count(*) FROM rowid_prune WHERE rowid >= 300000;

SELECT * FROM t1 where rowid = 6;

EXPLAIN SELECT * FROM t1 where rowid = 6 OR rowid = 9 ORDER BY ALL;

SELECT * FROM lineitem WHERE l_orderkey % 20000 == 0;

SELECT v FROM s WHERE rowid = 0;

CREATE TABLE p (k BIGINT PRIMARY KEY, o BIGINT, s VARCHAR);

CREATE TABLE nested AS SELECT [{'xs': [i, i + 1]}] AS v, i AS k FROM range(4097) t(i);

CREATE TABLE plain AS SELECT * FROM r;

SELECT k, g FROM r WHERE rowid IN (SELECT rowid FROM r WHERE k IN (-1, -3000, -5000, 4242)) ORDER BY k;

SELECT * FROM plain WHERE risk = 3 ORDER BY score DESC LIMIT 2 OFFSET 1;

SELECT count(*), max(x) FROM seg WHERE rowid < 10 AND x < 10;

EXPLAIN SELECT * FROM w JOIN s ON w.b = s.x;

EXPLAIN SELECT * FROM (SELECT r.*, row_number() OVER (PARTITION BY b, v ORDER BY id) AS rn FROM r) w2 JOIN s ON w2.b = s.x;

EXPLAIN SELECT * FROM w LEFT JOIN s ON w.b = s.x;

EXPLAIN SELECT * FROM w LEFT JOIN s2 ON w.b = s2.x;

EXPLAIN SELECT * FROM w SEMI JOIN s ON w.b IS NOT DISTINCT FROM s.x;

EXPLAIN SELECT * FROM w ANTI JOIN s2 ON w.b = s2.x;

EXPLAIN SELECT * FROM w FULL JOIN s ON w.b = s.x;

FROM services QUALIFY count(*) OVER(PARTITION BY date, train_number) > 1;

EXPLAIN FROM items QUALIFY count(*) OVER(PARTITION BY category) = 1;

FROM services
QUALIFY max(train_number) OVER(PARTITION BY date, train_number) = 100
    AND count(*) OVER(PARTITION BY date, train_number) = 1;

explain
SELECT seq,
       sum(seq) OVER (PARTITION BY grp ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumsum
FROM (VALUES (1,'A'),(2,'A'),(3,'A'),(1,'B'),(2,'B')) AS t(seq, grp)
ORDER BY grp, seq;

SELECT id, SUM(x) OVER (PARTITION BY id) AS outer_sum
FROM (
  SELECT id, x, LAG(total, 1, 0) OVER (PARTITION BY id) AS prev_total
  FROM (
    SELECT id, x, COUNT(*) OVER (PARTITION BY id) AS total
    FROM t
  ) AS a
) AS b;

CREATE TABLE arg_ties(id INT, key_s VARCHAR, payload_s VARCHAR, ord INT);

SELECT i, list(x ORDER BY x) OVER (
	PARTITION BY p ORDER BY i DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) FROM frame_ties
ORDER BY i LIMIT 2;

CREATE TABLE ts_us AS SELECT TIMESTAMP '2000-01-01' + to_seconds(range) AS ts FROM range(10240);

SELECT count(*) FROM ts_tz WHERE ts::TIMESTAMP < TIMESTAMP '1970-01-01 00:30:00';

SELECT count(*) FROM ts_ms WHERE ts < TIMESTAMP '2000-01-01 00:01:40';

SELECT count(*) FROM ts_us WHERE ts > '2000-01-01 02:50:00'::TIMESTAMP_NS;

INSERT INTO t VALUES (1, 5, 1), (1, 6, 2);

SET disabled_optimizers = 'top_n_window_elimination';

SELECT uv FROM (SELECT *, upper(v) AS uv FROM t)
QUALIFY row_number() OVER (PARTITION BY g ORDER BY s) = 1
ORDER BY uv;

EXPLAIN SELECT key, v, note FROM (
  SELECT key, ts, TRY_CAST(val AS INTEGER) AS v, note FROM try_cast_t)
QUALIFY row_number() OVER (PARTITION BY key ORDER BY ts DESC) = 1;

SELECT id, val_norm, p2
FROM (
    SELECT id, val_norm, p2,
           ROW_NUMBER() OVER (PARTITION BY id ORDER BY ord ASC) AS rn
    FROM (
        SELECT id, CAST(val_b AS INT) AS val_norm, p2, ord
        FROM (
            SELECT id, CAST(val AS BOOLEAN) AS val_b, p2, ord
            FROM t_27812
        ) s1
        WHERE p2 > 0
    ) s2
    WHERE val_norm + p2 > 0
) s3
WHERE rn <= 1;

SELECT id, p1, ord, rowid FROM (SELECT id, p1, ord, rowid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY ord ASC) rn FROM rowid_payload) WHERE rn <= 2 ORDER BY id, ord;

SELECT c_pk, c_int FROM t2 QUALIFY (ROW_NUMBER() OVER (ORDER BY c_pk)) < 1000001;

CREATE TABLE r_topn_dup(k INTEGER, s INTEGER);

INSERT INTO l_topn_dup_other VALUES (1, 20), (1, 10);

CREATE TABLE t(id INTEGER PRIMARY KEY);

CREATE or replace TABLE timeseries AS
FROM (
    VALUES
        (timestamp '2026-03-25 05:33:11.822+08', 10),
        (timestamp '2026-03-26 05:33:11.822+08', 15),
        (timestamp '2026-03-27 05:33:11.822+08', 12),
        (timestamp '2026-03-28 05:33:11.822+08', 18),
        (timestamp '2026-03-29 05:33:11.822+08', 14)
) AS t(date, value);

SELECT TRY(t2.bar::INTEGER) FROM foo;

EXPLAIN SELECT * FROM (SELECT s FROM tt_tuple) p WHERE CAST(p.s AS STRUCT(a BIGINT)) = struct_pack(a := 1::BIGINT);

EXPLAIN ANALYZE SELECT sum(i) FROM case_pruning WHERE upper(s) = 'BETA';

EXPLAIN ANALYZE SELECT i FROM case_lengthening WHERE upper(s) = 'ⱯⱯⱯⱯⱯⱯ';

EXPLAIN ANALYZE SELECT count(*) FROM case_truncated_distinct WHERE upper(s) = 'ZZZZ';

CREATE TABLE strings AS
SELECT id, {'k': s, 'nested': {'k': s}}::VARIANT AS v
FROM (VALUES
    (1, 'true'),
    (2, 'x'),
    (3, '1'),
    (4, 'false'),
    (5, 'null'),
    (6, '[]'),
    (7, '{"n":1}'),
    (8, E'quote"\\line\n'),
    (9, ''),
    (10, NULL)
) t(id, s);

SET disabled_optimizers = 'window_self_join';

CREATE TABLE timestamps AS
SELECT TIMESTAMP '-00043-01-01' + INTERVAL (i) DAY AS ts
FROM range(120) r(i);

CREATE TABLE special(d DATE);
