SET debug_disable_optimizer=true;

select lefttable.x, righttable.y
from (select 1 as x limit 0) lefttable
asof left join (select 1 as x, 1 as y) righttable
on lefttable.x >= righttable.x;

SELECT t.*, p.price
FROM trades t ASOF JOIN prices p 
  ON t.symbol = p.symbol AND t.when >= p.when;

SELECT * FROM l ASOF LEFT JOIN r ON l.t >= r.t;

SELECT p.ts, e.value
FROM range(0,10) p(ts) ASOF LEFT JOIN events0 e
ON p.ts >= e.begin
ORDER BY p.ts ASC NULLS FIRST;

CREATE TABLE probes AS
	SELECT key, ts
	FROM range(1,3) k(key) CROSS JOIN range(0,10) t(ts);

SELECT p.key, p.ts, e.value
FROM probes p ASOF RIGHT JOIN events e
  ON p.key = e.key AND p.ts >= e.begin
ORDER BY 1 ASC NULLS FIRST, 2;

SELECT * FROM left_table l
ASOF JOIN right_table r
ON l.symbol = r.symbol AND l.ts >= r.ts AND r.active = true;

INSERT INTO events0 VALUES 
	(NULL, -10),
	('infinity', 9),
	('-infinity', -1);

SELECT p.begin, e.begin, e.value
FROM probe0 p ASOF RIGHT JOIN events0 e
ON p.begin <= e.begin
ORDER BY ALL ASC;

SELECT p.begin, e.value
FROM probe0 p ASOF JOIN events0 e
USING (begin)
ORDER BY p.begin ASC;

SELECT count(*) FROM l ASOF JOIN r ON row(l.g, 1) = row(r.g, 1) AND l.ts >= r.ts;

SELECT count(*), count(*) FILTER (l2.g <> r.g) FROM l2 ASOF JOIN r ON row(l2.g, 1) = row(r.g, 1) AND l2.ts >= r.ts;

CREATE TABLE t(id INTEGER, k INTEGER);

SELECT l.id, l.k.a, r.id, r.k.a FROM s l ASOF JOIN s r ON l.k = r.k AND l.id >= r.id ORDER BY ALL;

SELECT t.id, p.id
FROM (VALUES (1, NULL::INTEGER, 1)) t(id, symbol, ts)
ASOF LEFT JOIN (VALUES (40, NULL::INTEGER, 65537)) p(id, symbol, ts)
  ON t.symbol IS NOT DISTINCT FROM p.symbol AND t.ts <= p.ts;

explain
SELECT tt1.i, tt2.k
   FROM tt1
   ASOF JOIN tt2 ON
  tt1.j = tt2.j AND tt1.i >= tt2.i
  ORDER BY tt1.i;

create temp table tbl1 as 
	select unnest(range(1000)) % 10 as x, '2022-01-01'::timestamp + to_days(unnest(range(1000))) as ts;

INSERT INTO trades_int VALUES 
	('2020-01-01 00:00:03', 1),
	('2020-01-01 00:00:03', 3),;

INSERT INTO prices_struct VALUES 
	('2020-01-01 00:00:00', {'ticker': 'APPL', 'exchange': 1}, 42),
	('2020-01-01 00:00:00', {'ticker': 'MEL', 'exchange': 2}, 55),;

SELECT t.*, p.price
FROM trades_list t ASOF JOIN prices_list p 
  ON t.symbol = p.symbol AND t.when >= p.when;

CREATE TABLE trades_nested("when" timestamp, symbol STRUCT(ticker VARCHAR[], exchange INTEGER));

CREATE OR REPLACE TABLE right_pushdown(time INTEGER, value FLOAT);

WITH t as (
    SELECT
        t1.col0 AS left_val,
        t2.col0 AS right_val,
    FROM
        (VALUES (0), (5), (10), (15)) AS t1
        ASOF JOIN (VALUES (1), (6), (11), (16)) AS t2
        ON t2.col0 > t1.col0
)
SELECT *
FROM t
WHERE right_val BETWEEN 3 AND 12
ORDER BY ALL;

CREATE TABLE r AS SELECT * FROM a;

SELECT * FROM (SELECT * FROM a EXCEPT ALL SELECT 1) t0
ASOF LEFT JOIN r t1 ON t0.d >= t1.d
ORDER BY ALL;

SELECT p.begin, e.value
FROM probe0 p ASOF LEFT JOIN (SELECT * FROM events0 WHERE log(value + 5) > 10) e
ON p.begin >= e.begin
ORDER BY p.begin ASC;

INSERT INTO events0 VALUES
	(NULL, -1),
	(1, 0),
	(3, 1),
	(6, 2),
	(8, 3),
	('infinity', 9);

EXPLAIN ANALYZE SELECT count(*) FROM t JOIN s ON t.rowid = s.v;

WITH actual AS (SELECT p.* FROM probe p SEMI JOIN duplicates b ON p.k = b.k),
expected AS (SELECT * FROM probe WHERE k % 3 = 0)
SELECT count(*) FROM (
    (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    UNION ALL
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual));

PREPARE selected_join AS
SELECT count(*), sum(p.id), sum(b.payload)
FROM probe p LEFT JOIN build b ON p.k = b.k WHERE p.id < $1;

INSERT INTO test VALUES (11, 1), (12, 2);

CREATE VIEW integers_empty AS SELECT * FROM integers WHERE rowid>100;

SELECT COUNT(*) FROM integers_empty LEFT JOIN integers2 USING (i);

SELECT * FROM integers RIGHT JOIN integers2_empty USING (i);

RESET memory_limit;

CREATE TABLE u3 AS SELECT range % 200000 AS k FROM range(400000);

SELECT count(*) FROM join_left JOIN join_right USING (k);

SET disabled_optimizers='statistics_propagation,join_order,build_side_probe_side,compressed_materialization';

CALL disable_logging();

CREATE TABLE bigtable AS SELECT a::INTEGER a FROM generate_series(0, 9999, 1) tbl(a), generate_series(0, 9, 1) tbl2(b);

SELECT i, j, k, l FROM integers FULL OUTER JOIN integers2 ON integers.i=integers2.k
UNION ALL
SELECT i, j, k, l FROM integers FULL OUTER JOIN integers2 ON integers.i=integers2.k
ORDER BY i;

SELECT i, j, k, l FROM integers FULL OUTER JOIN (SELECT k, l::VARCHAR AS l FROM integers2) integers2 ON integers.i=integers2.k ORDER BY 1, 2, 3, 4;

CREATE TABLE test (x INT, y INT);

INSERT INTO df3 VALUES
    ('2022-01-02',  1000, 'org1'),
    ('2022-02-03',  2000, 'org2'),
    ('2022-04-01',  3000, 'org3');

SELECT count(*) FROM (DESCRIBE SELECT 1 AS a, 2 AS b) l FULL JOIN (DESCRIBE SELECT 1 AS c, 2 AS d, 3 AS e) r ON NULL;

INSERT INTO t1 VALUES (1), (2), (NULL);

SELECT count(*)
  FROM (SELECT k, CASE WHEN currency = 'USD' THEN 1.0::DOUBLE ELSE fx_rate END AS rate
          FROM positions JOIN rates USING (day))
 WHERE (k * rate) % 997 < 1;

SELECT rate, nm, k, row_number() OVER (ORDER BY rate, nm, k)
  FROM (SELECT k, CASE WHEN currency = 'USD' THEN 'const' ELSE rate_name END AS nm,
               CASE WHEN currency = 'USD' THEN 1.0::DOUBLE ELSE fx_rate END AS rate
          FROM positions JOIN rates USING (day))
 WHERE (k * rate) % 997 < 1
 ORDER BY rate DESC, nm, k LIMIT 4;

INSERT INTO boundary_keys VALUES
(6885310024661668613), (2935053147940365472), (4427563264838490210),
(8682129448174287271), (6568086975123622471), (4461762103045784787);

RESET threads;

INSERT INTO cdb.dim_i VALUES (0,'zero'), (2000000,'twomillion');

SELECT count(*) FROM (SELECT CAST(NULL AS VARCHAR) AS ccy, id FROM fact) t JOIN dim d ON t.ccy = d.k;

SELECT count(*) FROM (SELECT 'USD' AS ccy, id FROM fact) t WHERE ccy IN (SELECT k FROM dim);

SET disabled_optimizers='join_order';

CREATE TABLE customer2 AS SELECT i * 1000 AS ck, i % 300 AS nk FROM range(2000) t(i);

CREATE TABLE lineitem AS SELECT i AS lk, (i % 8000) * 1000 AS ok FROM range(30000) t(i);

CREATE TABLE customer_orphan AS
SELECT i * 1000 AS ck, i % 25 AS nk FROM range(2000) t(i)
UNION ALL SELECT 7777777, 0;

SELECT COUNT(DISTINCT n.n_name)
FROM nation n JOIN customer c ON n.nk = c.nk JOIN orders o ON o.ck = c.ck;

SELECT n.n_name, COUNT(*) AS cnt
FROM nation n JOIN customer c ON n.nk = c.nk JOIN orders_null_probe o ON o.ck = c.ck
GROUP BY n.n_name ORDER BY n.n_name;

SELECT u.n_name, COUNT(*) AS cnt
FROM (SELECT c.ck, n.n_name FROM nation n JOIN customer c ON n.nk = c.nk WHERE 1=0) u
JOIN orders o ON o.ck = u.ck
GROUP BY u.n_name ORDER BY u.n_name;

INSERT INTO sdb.fact SELECT i, 'K_' || (i % 5000) FROM range(20000) t(i);

UPDATE dim SET d_label = CASE WHEN d_key = 'KEY_0' THEN NULL ELSE repeat(d_key, 32) END;

CREATE TABLE b AS SELECT i AS id, 'b' || i AS name, CASE WHEN i = 0 THEN repeat('x,', 4999) || 'x' ELSE 'r' || i END AS csv FROM range(2000) t(i);

CREATE TABLE small_fact AS SELECT i * 1000 AS k, i % 25 AS dk FROM range(5000) t(i);

WITH c AS MATERIALIZED (FROM mixed_dictionaries)
SELECT count(*), count(DISTINCT b.label)
FROM probe p JOIN (SELECT * FROM c ORDER BY k) b ON p.k=b.k;

SELECT d_name, n_name, count(*)
FROM dates d RIGHT JOIN (
    SELECT c.ck, n.n_name, r.dk
    FROM customer c JOIN nation n ON c.nk = n.nk
    FULL OUTER JOIN returns r ON c.ck = r.ck
) b ON d.dk = b.dk
WHERE d_name IN ('day_0', 'day_3') AND (n_name IS NULL OR n_name = 'NATION_1')
GROUP BY ALL ORDER BY ALL NULLS LAST;

SELECT d256_name IS NULL AS unmatched_returns, d_name IS NULL AS unmatched_fact, count(*)
FROM dates d RIGHT JOIN (
    SELECT f.ck, n.d256_name, r.dk
    FROM fact256 f JOIN dim256 n ON f.dk256 = n.dk256
    FULL OUTER JOIN returns r ON f.ck = r.ck
) b ON d.dk = b.dk
GROUP BY ALL ORDER BY ALL;

CREATE TABLE probe AS SELECT i % 20000 AS k FROM range(40000) t(i);

CHECKPOINT;

SELECT d.name, count(*) FROM fact f JOIN dim_nd d ON f.k IS NOT DISTINCT FROM d.k GROUP BY d.name ORDER BY d.name;

SELECT count(*) FROM fact f WHERE f.k IN (SELECT k FROM dim WHERE name IN ('Alpha','Beta'));

INSERT INTO fact2 SELECT id, k, id % 3 FROM fact WHERE k IS NOT NULL;

INSERT INTO dim_s VALUES ({'a':'A'},'Alpha'),({'a':'B'},'Beta');

CREATE TABLE mem.fact_i (k INTEGER);

SELECT count(*) FILTER (
    WHERE list_sort(vals)[1] IS DISTINCT FROM expected
       OR (expected IS NOT NULL AND expected % 31 <> list_probe.k))
FROM list_probe LEFT JOIN list_build USING (k)
WHERE random() < 0.5;

CREATE MACRO expected_structs(i) AS
CASE WHEN i % 11 = 0 THEN NULL WHEN i % 13 = 0 THEN []
ELSE [{'n': i, 's': repeat('x', 40) || i}, NULL, {'n': NULL, 's': NULL}] END;

CREATE TEMP MACRO expected_variants(i) AS
CASE WHEN i % 11 = 0 THEN NULL WHEN i % 13 = 0 THEN []
ELSE [i::VARIANT, (repeat('x', 40) || i)::VARIANT, NULL, {'n': i, 'a': [i, NULL]}::VARIANT] END;

SELECT count(*), count(*) FILTER (
    WHERE row_id <> p.k OR vals IS DISTINCT FROM list_resize([''], 300 + row_id % 2, ''))
FROM budget_probe p JOIN budget_build b USING (k);

CREATE MACRO check_nested_activation() AS
    NOT current_setting('debug_force_external')
    AND NOT current_setting('debug_disable_optimizer')
    AND current_setting('debug_verify_vector') = 'NONE';

SELECT NOT check_nested_activation() OR bool_and(vector_type(b.arr) = 'FLAT_VECTOR'),
       count(*) FILTER (WHERE b.arr IS DISTINCT FROM [p.k, p.k + 1]::BIGINT[2])
FROM coverage_probe p JOIN coverage_build b USING (k);

CREATE TABLE t AS
SELECT [NULL, 1, 1] AS front, [1, NULL, 1] AS mid, [1, 1, NULL] AS back, 7 AS i, [5, NULL] AS l,
       [5, 6]::INTEGER[2] AS a, {'k': [5]} AS s, []::INTEGER[] AS e, [[5], [6, NULL]] AS ll,
       MAP {'a': 1} AS m;

SELECT count(*)
FROM (SELECT unnest(front) AS x, i, e FROM t) p JOIN (SELECT unnest(front) AS x, i, e FROM t) q
ON p.i = q.i AND p.e = q.e AND p.x = q.x;

INSERT INTO b VALUES (0,'a_non_inline_zero_payload'),(2,NULL),(7,'orphan'),(NULL,'null_key');

SELECT count(*),count(*) FILTER (WHERE v IS DISTINCT FROM
           CASE WHEN i%5=1 THEN 30 WHEN i%5=2 THEN 40 END),
       NOT check_dictionary_emission() OR bool_and(vector_type(v)='DICTIONARY_VECTOR')
FROM (SELECT i,(SELECT b.v FROM residual_build b WHERE b.k=p.k AND b.v!=p.cutoff) v
      FROM residual_probe p);

SELECT count(*),count(*) FILTER (WHERE b.v IS NULL),
       NOT check_dictionary_emission() OR bool_and(vector_type(b.v)='DICTIONARY_VECTOR')
FROM p FULL JOIN (SELECT f.k,d.v FROM fact f JOIN dim d USING(d)) b ON p.k=b.k;

SELECT p.k,b.a,b.s,b.r FROM (VALUES (0),(1),(2),(NULL)) p(k) LEFT JOIN nested b USING(k);

SELECT o.o_orderkey, o.o_custkey, o.o_totalprice, l.l_orderkey, l.l_partkey, l.l_quantity, l.l_extendedprice
FROM orders o
INNER JOIN lineitem l ON o.o_orderkey = l.l_orderkey
    AND o.o_totalprice < l.l_extendedprice
    AND o.o_totalprice + l.l_extendedprice > 250;

SELECT o.o_orderkey, o.o_custkey, o.o_totalprice, l.l_orderkey, l.l_partkey, l.l_quantity, l.l_extendedprice
FROM orders o
RIGHT JOIN lineitem l ON o.o_orderkey = l.l_orderkey
    AND l.l_shipmode != 'TRUCK';

SELECT o.o_orderkey, o.o_custkey, o.o_totalprice, o.o_orderstatus
FROM orders o
ANTI JOIN lineitem l ON o.o_orderkey = l.l_orderkey
    AND o.o_totalprice + l.l_extendedprice > 250;

SELECT o.o_orderkey, o.o_custkey, o.o_totalprice, o.o_orderstatus
FROM orders o
WHERE o.o_orderkey NOT IN (
    SELECT l.l_orderkey
    FROM lineitem l
    WHERE l.l_orderkey = o.o_orderkey
    AND o.o_totalprice + l.l_extendedprice > 250
);

CREATE TABLE residual_empty_build(a INTEGER, c INTEGER);

SELECT *
FROM l ANTI JOIN r
  ON l.k = r.k
 AND l.v + r.v > 2
ORDER BY k;

SELECT count(*) FROM p SEMI JOIN b USING(k);

CREATE TABLE b AS SELECT (i % 500000) * 200 k FROM range(4000000) t(i);

PREPARE membership AS SELECT count(*) FROM p SEMI JOIN b USING (k);

SELECT count(*), sum(k) FROM p SEMI JOIN b USING (k);

SELECT count(*) FROM high_unsigned p JOIN high_unsigned b ON p.k IS NOT DISTINCT FROM b.k;

SELECT count(*) FROM null_keys p JOIN null_keys b ON p.k IS NOT DISTINCT FROM b.k;

SELECT p.k::VARCHAR FROM unsigned_crossing p JOIN unsigned_crossing b
ON p.k IS NOT DISTINCT FROM b.k ORDER BY p.k NULLS LAST;

SELECT count(*),sum(p.k) FROM full_tinyint p SEMI JOIN full_tinyint b USING(k);

SELECT count(*),sum(b.n) FROM range(5000) p(i) JOIN b ON p.i//2500=b.k;

INSERT INTO build VALUES (NULL, 40), (NULL, 50);

SELECT NOT getvariable('check_perfect_activation') OR list_sort(list(info['backend'])) = ['direct','direct','direct','direct','direct']
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class='PhysicalHashJoin' AND event='Lookup';

SELECT count(*),sum(id) FROM b SEMI JOIN probe p ON b.k=p.target;

CREATE TABLE mapping2 AS SELECT k,CASE WHEN target IS NOT NULL THEN target+1 END target FROM mapping;

WITH RECURSIVE r(iter,k,id) AS (
    VALUES (0,0::BIGINT,0),(0,2::BIGINT,1)
    UNION ALL
    SELECT b.iter+1,CASE WHEN b.iter%2=0 THEN 0 ELSE 2*b.id END,b.id
    FROM probe p JOIN r b ON p.target=b.k WHERE b.iter<3 GROUP BY ALL
)
SELECT * FROM r ORDER BY ALL;

INSERT INTO probe VALUES (0),(1),(1),(4);

CREATE TABLE keys(k BIGINT);

INSERT INTO b VALUES (0,-1),(0,NULL),(1,5),(2,0),(NULL,0);

INSERT INTO p VALUES (NULL,0);

DROP TABLE null_build;

SELECT count(*),sum(u.v) FROM p JOIN u USING(k);

SET disabled_optimizers='compressed_materialization,join_filter_pushdown,join_order,build_side_probe_side';

SELECT count(*) FROM wide_bitmap_probe p SEMI JOIN bitmap_build b
ON p.k::HUGEINT IS NOT DISTINCT FROM b.k::HUGEINT;

SET disabled_optimizers='compressed_materialization,join_filter_pushdown,join_order,build_side_probe_side,statistics_propagation';

CREATE TABLE pushdown_build AS SELECT i k,j v FROM range(100) t(i),range(3) u(j)
UNION ALL SELECT NULL,7;

SELECT * FROM (VALUES (0::BIGINT),(63),(127),(NULL)) p(k) ANTI JOIN b USING(k) ORDER BY k NULLS LAST;

SELECT k,CASE WHEN k=1 THEN v IN (10,20) WHEN k=2 THEN v=7 ELSE v IS NULL END
FROM (SELECT k,(SELECT b.v FROM b WHERE b.k=p.k AND b.v!=p.v) v FROM p) ORDER BY k;

INSERT INTO membership_build VALUES (1), (1), (2000000), (NULL);

SELECT count(*) FROM range(8) p(i) ANTI JOIN dense_build USING (i);

SET nested_loop_join_threshold=0;

EXPLAIN
SELECT * 
FROM test AS a, all_null AS b 
WHERE (a.x BETWEEN b.x AND b.x);

select
	count(*)
from snapshot_data data
join cal_last_13 cal
	on data.snapshot_ts >= cal.start_ts
	and data.snapshot_ts <= cal.end_ts;

SELECT count(r.u), count(*) FROM l LEFT JOIN r ON l.i < r.i AND l.i + 2 > r.i AND (l.i + r.i) % 7 = 1;

SELECT count(*) FROM l FULL JOIN r ON l.a > r.a AND l.b < r.b AND l.c < r.c AND l.id + r.id > -10;

SET explain_output = 'PHYSICAL_ONLY';

create table scd2 as 
select 
  range as range_start,
  case when date_part('year', range) < 2023 then range + interval 4 month - interval 1 day end as range_end,
  n
from calendar
cross join generate_series(1, 85) as n;

create or replace table states as
	select 
		i // 100 as k,
		'2024-01-01'::TIMESTAMP + INTERVAL (i // 1) seconds as b,
		b + INTERVAL 1 second as e,
	from range(100_000) as tbl(i);

EXPLAIN
SELECT l.id, l.start, l.stop
FROM left_small l
ANTI JOIN right_small r
       ON l.start < r.stop
      AND r.start < l.stop
      AND l.symbol = r.symbol
ORDER BY 1;

UPDATE wide_ranges SET start = NULL WHERE id = 6;

FROM wide_ranges l
ANTI JOIN narrow_ranges r
	   ON l.start < r.stop
	  AND r.start < l.stop
	  AND r.symbol = l.symbol
ORDER BY id;

create table test_big as select range i, range + 100_000 j, 'hello' k from range (20_000);

SELECT s1.rid, s2.rid
FROM west s1, west s2
WHERE s1.time > s2.time AND s1.cost < s2.cost
ORDER BY 1, 2;

SELECT COUNT(*) FROM (
	SELECT r.id, s.id
	FROM events r, events s
	WHERE r.start <= s.end AND r.end >= s.start
	  AND r.id <> s.id
) q2;

select t1.x, t1.y
from (
    select (case when x < 100 then null else 99 end) x, (case when x < 100 then 99 else 99 end) y
    from tt2
) t1 left join tt2 t2
on t1.x < t2.x and t1.y < t2.x
order by t1.x nulls first, t1.y nulls first;

select l.k100 as lid, r.k100 as rid
from tleft l 
left join tleft r 
on l.b100 < r.e100
and r.b100 < l.e100
and l.k100 + r.k100 < 10
order by 1;

EXPLAIN
SELECT l.id, l.start, l.stop
FROM left_small l
SEMI JOIN right_small r
       ON l.start < r.stop
      AND r.start < l.stop
      AND l.symbol = r.symbol
ORDER BY 1;

CREATE OR REPLACE TABLE narrow_ranges AS (
	SELECT 
		id,
		'2026-01-01'::TIMESTAMP + INTERVAL (id) SECONDS AS start,
		start + INTERVAL 1 SECOND AS stop,
		CHR(65 + (id % 26)::INTEGER) AS symbol,
		150.0 + id / 100.0 AS bid,
		(id % 2)::BOOLEAN AS active,
	FROM range(2048*5) tbl(id)
);

SET disabled_optimizers='statistics_propagation,join_order,build_side_probe_side';

CREATE TABLE rle_frequency AS SELECT 1::BIGINT w,1::BIGINT d,CASE WHEN i%2048=0 THEN 1 ELSE 3000 END::BIGINT k,1::BIGINT n FROM range(122880)t(i);

DETACH native_cache;

EXPLAIN (ANALYZE,FORMAT JSON) SELECT count(*),sum(p.n) FROM rle_recovery p JOIN numeric_build b ON p.w=b.w AND p.d=b.d AND p.k=b.k WHERE b.keep;

USE nullable_cache;

EXPLAIN (ANALYZE,FORMAT JSON) SELECT count(*),sum(p.n) FROM dict_nullable p JOIN string_build b ON p.w=b.w AND p.d=b.d AND p.k=b.k WHERE b.keep;

CREATE TABLE build(k BIGINT, selected BOOLEAN);

CREATE TABLE t1(c0 INT4, c1 VARCHAR);

INSERT INTO u VALUES (-128), (127);

CREATE TABLE t(t_k0 INTEGER);

CREATE TABLE t(t_k0 HUGEINT);

CREATE TABLE t(t_k0 USMALLINT);

CREATE TABLE t(t_k0 UBIGINT);

SELECT * FROM bigtable JOIN smalltable USING (a);

insert into t4 values (2), (3);

CREATE TABLE t2(c0 INT);

INSERT INTO build VALUES (NULL,0),(NULL,1);

INSERT INTO cast_build VALUES (NULL,0),(1,1),(3,1);

CREATE TABLE date_build AS SELECT k FROM date_probe WHERE id IN (0,2,4);

CREATE TABLE aux AS SELECT 1 g;

CREATE TABLE p AS SELECT i a,0 g FROM range(1000000)t(i) UNION ALL SELECT NULL::BIGINT,0;

SET dynamic_or_filter_threshold=50;

CREATE TABLE p (pb BOOLEAN);

SET disabled_optimizers='join_order,build_side_probe_side,compressed_materialization,partial_aggregate_pushdown';

INSERT INTO build SELECT NULL, NULL FROM range(4097);

DROP TABLE probe;

EXECUTE runtime_in_typed;

EXECUTE prf_query;

CREATE OR REPLACE TABLE build AS SELECT k FROM probe WHERE i BETWEEN 100 AND 1100;

INSERT INTO test2 VALUES (11, 1), (12, 1), (13, 4);

CREATE TABLE test (a INTEGER, b INTEGER, str VARCHAR);

SELECT * FROM test WHERE EXISTS(SELECT * FROM test2 WHERE test.a=test2.a AND test.b<>test2.c) AND test.a > 11 order by b;

SELECT * FROM left_table l
INNER JOIN right_table r ON l.id = r.id AND l.val > 1 AND r.category = 1;

CREATE TABLE boolean_keys(flag_key BOOLEAN);

SELECT a, (SELECT test.a), c FROM test, test2 WHERE test.b = test2.b ORDER BY c;

SELECT * FROM (VALUES (1), (2)) tbl(i) JOIN (VALUES (1), (2)) tbl2(j) ON (i=j) WHERE i+j=2;

SET dynamic_or_filter_threshold=1000;

CREATE TABLE bloom_probe AS
SELECT (-1000000000000 + i * 20000000)::BIGINT AS k, (i % 7)::INTEGER AS g
FROM range(100000) t(i);

EXPLAIN ANALYZE
SELECT count(*)
FROM dense_probe p
JOIN dense_build b
  ON p.k = b.k
 AND p.g >= b.g;

SELECT count(*) FROM probe p JOIN few_groups b ON p.grp = b.grp AND p.id = b.id;

SELECT x.col1, y.col1 FROM tbl x JOIN tbl y
ON x.col0 = y.col0 AND x.col1 != y.col1
ORDER BY x.col1;

SELECT x.col1, y.col1 FROM tbl_l x JOIN tbl_l y
ON x.col0 = y.col0 AND x.col1 != y.col1
ORDER BY x.col1;

CREATE TABLE tbl_s_null (col0 STRUCT(x INTEGER), col1 STRUCT(x INTEGER));

INSERT INTO tbl_l_null VALUES ([1], [0]), ([1], [1]), ([1], NULL), ([1], [NULL]);

insert into tb1 (select NULL from range(20));

SELECT x.col1, y.col1 FROM tbl x JOIN tbl y
ON x.col0 = y.col0 AND x.col1 = y.col1
ORDER BY x.col1;

SELECT x.col1, y.col1 FROM tbl_s_null x JOIN tbl_s_null y
ON x.col0 = y.col0 AND x.col1 = y.col1
ORDER BY x.col1.x, y.col1.x NULLS LAST;

CREATE TABLE build AS FROM probe WHERE i%100=0;

CREATE TABLE probe AS SELECT (2*(i%50)+1)::INTEGER a, ((i//50)%100)::INTEGER b FROM range(200000) t(i);

CREATE TABLE e_semi AS SELECT p.v FROM probe p SEMI JOIN build b ON p.item = b.item AND p.sparse_ticket = b.sparse_ticket;

CREATE TABLE e_full AS
SELECT p.v, b.null_ticket FROM probe p FULL JOIN build b ON p.null_item = b.null_item AND p.null_ticket = b.null_ticket;

EXPLAIN ANALYZE SELECT count(*) FROM probe p JOIN build b ON p.item = b.item AND p.sparse_ticket = b.sparse_ticket;

EXPLAIN ANALYZE SELECT count(*) FROM probe p JOIN build b ON p.null_item = b.null_item AND p.null_ticket = b.null_ticket;

CREATE TABLE build_large AS SELECT item, sparse_ticket FROM probe WHERE ticket % 5 = 0;

SELECT count(*) FROM probe p JOIN build_7pct b ON p.item = b.item AND p.sparse_ticket = b.sparse_ticket;

SELECT count(*) FROM (
    (SELECT p.v, EXISTS (SELECT 1 FROM build b WHERE b.item = p.item AND b.sparse_ticket = p.sparse_ticket) FROM probe p
     EXCEPT ALL TABLE e_mark)
    UNION ALL
    (TABLE e_mark EXCEPT ALL
     SELECT p.v, EXISTS (SELECT 1 FROM build b WHERE b.item = p.item AND b.sparse_ticket = p.sparse_ticket) FROM probe p)
);

SELECT count(*) FROM (
    (SELECT b.ticket FROM build b SEMI JOIN probe p ON p.item = b.item AND p.sparse_ticket = b.sparse_ticket
     EXCEPT ALL SELECT ticket FROM build)
    UNION ALL
    (SELECT ticket FROM build EXCEPT ALL
     SELECT b.ticket FROM build b SEMI JOIN probe p ON p.item = b.item AND p.sparse_ticket = b.sparse_ticket)
);

SET disabled_optimizers = 'join_order,build_side_probe_side,compressed_materialization,statistics_propagation';

SELECT count(*), min(p.k), max(p.k) FROM prf_probe_mixed p JOIN prf_build b ON p.k = b.k;

CREATE OR REPLACE TABLE build AS
SELECT (i * 2)::BIGINT AS k, (i % 7)::INTEGER AS g
FROM range(0, 30000) t(i);

CREATE OR REPLACE TABLE probe_timestamp AS
SELECT make_timestamp(i * 1000) AS k, (i % 7)::INTEGER AS g
FROM range(0, 100000) t(i);

EXPLAIN ANALYZE
SELECT count(*)
FROM probe_hugeint p
JOIN build_hugeint b
  ON p.k = b.k
 AND p.g >= b.g;

INSERT INTO prf_probe_string VALUES
	(1, 'ab', 1),
	(2, 'abc', 2),
	(3, 'abcd0', 3),
	(4, 'abcd1', 4),
	(5, 'abcd9', 8),
	(6, 'abce0', 5),
	(7, '', 5),
	(8, NULL, 1),
	(9, 'zzzz', NULL),
	(10, 'zzzzzz', 4);

SELECT p.id, hex(p.k), p.g, b.payload
FROM prf_probe_string_nul p
JOIN prf_build_string_nul b
  ON p.k = b.k
 AND p.g >= b.g
ORDER BY ALL;

INSERT INTO prf_row_group_bug.prf_probe_small VALUES
	(1, 0), (2, 0),
	(3, 0), (4, 0),
	(5, 0), (6, 0);

CREATE OR REPLACE TABLE prf_build_string (k VARCHAR, g INTEGER, payload INTEGER);

EXPLAIN ANALYZE
SELECT count(*)
FROM prf_probe_string_long_single p
JOIN prf_build_string_long_single b
  ON p.k = b.k
 AND p.g >= b.g;

INSERT INTO prf_build_string_nul_stats VALUES
	('ab' || chr(0) || 'd', 1, 300),
	('ab' || chr(0) || 'x', 1, 301);

CREATE TABLE issue4419 (x INT, y VARCHAR);

INSERT INTO test2 VALUES (NULL, NULL);

CREATE TABLE test2 AS SELECT * FROM repeat(1, 10*1024) t1(b);

SELECT * FROM t1 JOIN t2 USING (b) JOIN t3 USING (c) ORDER BY 1, 2, 3, 4;

CREATE TABLE t3 (d INTEGER, e INTEGER);

SELECT t2.a, t2.b, t2.c FROM t1 JOIN t2 USING(a,b);

select * from (select 42 as a, 'asdf' as b) sq2, (select 42 as a, NULL::varchar as b) sq1 where sq1.a=sq2.a and sq1.b <> sq2.b;

select * from t1 left join t2 on t1.id > t2.id;

CREATE OR REPLACE TABLE single_col_table AS
SELECT i.range AS col1
FROM range(50) i;

CREATE TABLE t3 (id VARCHAR);

INSERT INTO foo VALUES ('2023-01-01 00:00:01');

CREATE TABLE d(
  d1 VARCHAR,
  d2 VARCHAR,
);

SELECT * FROM left_table l
LEFT JOIN right_table r ON l.id = r.id AND false;

SELECT * FROM integers LEFT OUTER JOIN integers2 ON TRUE AND integers.i=integers2.k AND TRUE ORDER BY i;

SELECT * FROM integers LEFT OUTER JOIN integers2 ON 1=1 ORDER BY i, k;

SELECT * FROM integers LEFT OUTER JOIN integers2 ON i+l=21 ORDER BY i;

INSERT INTO dim VALUES (1, 'a'), (2, 'b'), (3, 'c'), (4, 'd'), (5, 'e');

CREATE TABLE dim_unique(id INTEGER UNIQUE, label TEXT);

CREATE TABLE big_dim AS SELECT range::INTEGER AS id, 'val_' || range AS label FROM range(1, 10001);

SELECT f.fk, f.value, d.a, d.b, d.c
FROM fact f LEFT JOIN dim_wide d ON f.fk = d.id
WHERE f.fk <= 3;

RESET nested_loop_join_threshold;

SELECT p.i,__mark_join_marker FROM probe p JOIN BY (TYPE MARK) build b ON b.i=1;

SELECT __mark_join_marker
FROM range(2) p(i) JOIN BY (TYPE MARK)
(SELECT i FROM range(12) b(i) WHERE random()<0) b
ON nextval('scalar_operand')=b.i;

SELECT __mark_join_marker FROM (SELECT NULL::INTEGER AS dummy) l JOIN BY(TYPE MARK) (SELECT 'aBc' AS s) r ON 'ABC' COLLATE nocase=r.s;

INSERT INTO rs VALUES ('a', 5), ('a', 0), ('B', 9), (NULL, 9), ('c', 1);

SELECT * FROM l WHERE EXISTS (SELECT 1 FROM r WHERE r.k IS NOT DISTINCT FROM l.k AND r.c > l.v - 40) ORDER BY ALL;

SELECT * FROM l WHERE EXISTS (SELECT 1 FROM r WHERE r.k = l.k AND r.c > l.v - 10) = (v > 10) ORDER BY ALL;

SELECT (SELECT count(*) FROM e WHERE EXISTS (SELECT 1 FROM r WHERE r.k = e.k AND r.c > e.c - 10)), (SELECT count(*) FROM e WHERE NOT EXISTS (SELECT 1 FROM r WHERE r.k = e.k AND r.c > e.c - 10));

SELECT a,__mark_join_marker FROM distinct_probe JOIN BY (TYPE MARK) distinct_build ON 2 IS DISTINCT FROM a;

SELECT __mark_join_marker FROM (VALUES (NULL::INTEGER[])) l(a) JOIN BY (TYPE MARK) (VALUES ([2])) r(b) ON a IS DISTINCT FROM b;

WITH ins AS (INSERT INTO b VALUES (NULL) RETURNING b)
SELECT m FROM (SELECT 1 IN (SELECT b FROM b) AS m) marked WHERE m IS NOT TRUE;

WITH ins AS (INSERT INTO semi_build VALUES (NULL), (1), (1), (3) RETURNING i)
SELECT p.i FROM semi_probe p JOIN BY(TYPE MARK) semi_build b
ON p.i IS NOT DISTINCT FROM b.i WHERE __mark_join_marker ORDER BY p.i NULLS FIRST;

CREATE TABLE union_candidates(g INTEGER, u UNION(i INTEGER,s VARCHAR));

CREATE TABLE candidates(g INTEGER, v INTEGER);

INSERT INTO multi_probes VALUES (0,0,0,NULL),(1,1,1,NULL),(2,1,2,2),(3,2,1,2),(4,NULL,1,1),(5,NULL,2,2),(6,2,NULL,2);

PREPARE typed_groups AS WITH actual AS (SELECT id,__mark_join_marker m FROM typed_probes p JOIN BY(TYPE MARK) typed_candidates c ON p.g IS NOT DISTINCT FROM c.g AND p.h IS NOT DISTINCT FROM c.h AND p.v=c.v), expected AS (SELECT id,p.v=ANY(SELECT c.v FROM typed_candidates c WHERE p.g IS NOT DISTINCT FROM c.g AND p.h IS NOT DISTINCT FROM c.h) m FROM typed_probes p) SELECT count(*) FROM actual a JOIN expected e USING(id) WHERE a.m IS DISTINCT FROM e.m;

SELECT __mark_join_marker FROM (VALUES (row(1,2))) p(c) JOIN BY(TYPE MARK) (VALUES (row(1,NULL::INT))) b(d) ON c >= d;

SELECT __mark_join_marker FROM (VALUES (row(1,NULL::INT))) p(c) JOIN BY(TYPE MARK) (VALUES (row(1,2))) b(d) ON c >= d;

SELECT a, renamed FROM (SELECT a, m AS renamed FROM (SELECT a, a IN (SELECT b FROM b) AS m FROM p)) WHERE renamed IS TRUE;

WITH c AS MATERIALIZED (SELECT a, a IN (SELECT b FROM b) AS m FROM p)
SELECT a, m FROM c WHERE m UNION ALL SELECT a, m FROM c WHERE m IS NOT TRUE;

SELECT a, m FROM (SELECT a, a IN (SELECT b FROM b_nonnull) AS m FROM p_nonnull) WHERE m IS NOT TRUE;

INSERT INTO b_nonnull VALUES (2);

CREATE TEMP TABLE tuple_build AS SELECT row(1,NULL::INTEGER) AS b;

SELECT a FROM residual_probe JOIN BY (TYPE SEMI) residual_build ON a<b AND a+b=2;

SELECT a FROM residual_vectors_probe JOIN BY(TYPE SEMI) residual_vectors_build ON a<2 AND a+b=2;

SELECT a FROM p WHERE NOT EXISTS (SELECT 1 FROM b WHERE a IS NOT DISTINCT FROM b AND a+b>0);

SELECT a, m FROM (SELECT a, a IN (SELECT b FROM b) AS m FROM p) WHERE m
UNION ALL SELECT 42, false;

CREATE TABLE union_build AS SELECT union_value(i:=NULL::INTEGER) AS b;

SELECT currval('marker_sequence');

CREATE TABLE setop_nullable_members(k INTEGER);

INSERT INTO a VALUES (1), (NULL);

EXPLAIN SELECT count(*) FROM a WHERE EXISTS (SELECT 1 FROM c WHERE a.x IS NOT DISTINCT FROM c.k);

INSERT INTO v VALUES (1);

EXPLAIN SELECT count(*) FROM w w1 WHERE EXISTS (SELECT 1 FROM w w2 WHERE w1.z IS NOT DISTINCT FROM w2.z);

SELECT NULL::TUPLE(INT,INT) = ANY (SELECT row(1,2));

SELECT v, m FROM (
    SELECT v, v IN (SELECT 1) AS m FROM (
        SELECT CASE WHEN nextval('marker_seq')=1 THEN 2 END AS v
        FROM range(1)
        WHERE (CASE WHEN nextval('marker_seq')=1 THEN 2 END) IS NOT NULL
    ) q
) marked WHERE NOT m;

CREATE TABLE t3 (a INTEGER, b INTEGER, c INTEGER);

CREATE TABLE issue24045_d(y INTEGER);

select *
from
    (select 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52) tbl1(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
    natural join
    (select 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52) tbl2(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);

CREATE VIEW v0(c0) AS SELECT false FROM t1, t0 HAVING 1689380428;

CREATE TABLE products(product_id VARCHAR, name VARCHAR, price INT, country VARCHAR, embedding FLOAT[3]);

SELECT q.user_id, t.product_id FROM users q
  INNER JOIN empty_products t NEAREST 2 BY DISTANCE array_distance(q.embedding, t.embedding)
  ORDER BY q.user_id;

INSERT INTO lnums VALUES (1,10),(2,20);

CREATE TABLE all_null(y INT);

CREATE TABLE nearest(approx INT, exact INT, distance INT, similarity INT);

(
  SELECT q.user_id, t.product_id FROM users q
    INNER JOIN products t NEAREST 2 BY DISTANCE array_distance(q.embedding, t.embedding)
  EXCEPT
  SELECT q.user_id, t.product_id FROM users q
    INNER JOIN (SELECT * FROM products ORDER BY array_distance(q.embedding, products.embedding) LIMIT 2) t ON TRUE
)
UNION ALL
(
  SELECT q.user_id, t.product_id FROM users q
    INNER JOIN (SELECT * FROM products ORDER BY array_distance(q.embedding, products.embedding) LIMIT 2) t ON TRUE
  EXCEPT
  SELECT q.user_id, t.product_id FROM users q
    INNER JOIN products t NEAREST 2 BY DISTANCE array_distance(q.embedding, t.embedding)
);

CREATE VIEW latest_db.nearest_view AS
  SELECT q.user_id, t.product_id FROM latest_db.users q
    INNER JOIN latest_db.products t APPROX NEAREST 2 BY SIMILARITY array_cosine_similarity(q.embedding, t.embedding);

SELECT count(*) FROM old_db.regular_view;

INSERT INTO t0 SELECT range FROM range(5);

INSERT INTO tbl VALUES (1, 'a', 0.5), (2, 'b', 1.5), (3, 'c', 2.5), (4, 'd', 3.5), (NULL, NULL, NULL);

SELECT x1.s, x2.d FROM tbl AS x1 LEFT JOIN tbl AS x2 ON ((SELECT 3) = x1.i AND x2.i > 2) ANTI JOIN tbl AS x3 ON (x2.i < x3.i) ORDER BY ALL;

SELECT l.a, r.b
FROM (VALUES (1), (2)) l(a)
FULL OUTER JOIN (VALUES (10), (20)) r(b)
  ON EXISTS (SELECT 1 WHERE l.a = 1 AND r.b = 10)
WHERE EXISTS (SELECT 1 WHERE l.a + r.b = 11)
ORDER BY ALL;

SELECT l.a, r.b, s.c, t.d
FROM ((VALUES (1), (2)) l(a)
FULL OUTER JOIN (VALUES (10), (20)) r(b)
	ON EXISTS (SELECT 1 WHERE l.a = 1 AND r.b = 10))
CROSS JOIN ((VALUES (3), (4)) s(c)
FULL OUTER JOIN (VALUES (30), (40)) t(d)
	ON EXISTS (SELECT 1 WHERE s.c = 3 AND t.d = 30))
ORDER BY ALL;

SELECT o.x, EXISTS (
	SELECT *
	FROM (VALUES (1)) l(a)
	ANTI JOIN (VALUES (2)) r(b)
		ON l.a = r.b AND o.x = 10
) AS ex
FROM (VALUES (10), (20)) o(x)
ORDER BY o.x;

SET debug_verify_column_bindings=false;

CREATE TABLE non_inner_s(i INTEGER, j INTEGER);

SELECT l.i, r.i, r.j
FROM non_inner_l l
LEFT JOIN non_inner_r r ON r.i IS NULL OR (r.i = l.i AND l.i NOT IN (SELECT i FROM non_inner_s))
ORDER BY l.i, r.i NULLS LAST, r.j NULLS LAST;

SELECT *
FROM (VALUES (1, 1)) l(x, a)
LEFT JOIN (VALUES (2, 1)) r(x, b)
ON list_transform([1], lambda x: x)[1] = 1
AND EXISTS (
	SELECT 1
	WHERE l.a = r.b
);

SELECT a.x, r.x
FROM ((VALUES (1)) a(x) JOIN (VALUES (1)) b(x) USING (x))
LEFT JOIN (VALUES (1)) r(x)
ON EXISTS (
	SELECT 1
	WHERE x = r.x
);

DELETE FROM delete_target t
USING (VALUES (1)) l(a)
FULL JOIN (VALUES (1)) r(b)
  ON l.a = r.b
 AND EXISTS (
	SELECT 1
	WHERE l.a = r.b
);

SELECT l.i, l.j, r.i, r.j FROM l LEFT JOIN r ON r.i IN (SELECT i FROM s) AND r.j >= 150 AND l.i <= r.i ORDER BY ALL;

SELECT l.i, r.i, r.j FROM l LEFT JOIN r ON EXISTS (SELECT 1 FROM s WHERE s.i = r.i AND s.j * 10 = r.j) AND l.i = r.i ORDER BY ALL;

INSERT INTO pair_r VALUES (10, 100), (20, 200), (30, 300), (40, 400);

CREATE TABLE pair_nested_r(b INTEGER);

SELECT l.a, r.b
FROM pair_nested_l l
FULL OUTER JOIN pair_nested_r r ON EXISTS (
	WITH c AS (
		SELECT s.b
		FROM pair_nested_s s
		WHERE s.a = l.a
	)
	SELECT 1
	FROM c
	WHERE c.b = r.b
)
ORDER BY ALL;

CREATE TABLE pair_nested_local_s(a INTEGER, b INTEGER, c INTEGER);

SELECT *
FROM pair_nested_outer_o o
WHERE EXISTS (
	SELECT 1
	FROM pair_nested_l l
	FULL OUTER JOIN pair_nested_r r ON EXISTS (
		SELECT 1
		FROM pair_nested_local_t t
		WHERE EXISTS (
			SELECT 1
			FROM pair_nested_local_s s
			WHERE s.a = l.a
			  AND s.b = r.b
			  AND s.c = t.c
			  AND s.c = o.x
		)
	)
);

SELECT l.a, r.b
FROM pair_decor_l l
FULL OUTER JOIN pair_decor_r r ON EXISTS (
	SELECT s.a
	FROM pair_decor_s s
	WHERE s.a = l.a
	  AND s.b = r.b
	GROUP BY s.a
	HAVING count(*) > 0
)
ORDER BY ALL;

INSERT INTO pair_nested_full_m VALUES (10), (20);

SELECT l.a, l.x, r.b, r.y, count(*)::INTEGER
FROM pair_l l
FULL OUTER JOIN pair_r r ON r.b NOT IN (
	SELECT s.b FROM pair_s s WHERE s.a = l.a
)
GROUP BY ALL
ORDER BY ALL;

CREATE TABLE pair_l_order(a INTEGER, x INTEGER);

INSERT INTO pair_s_null VALUES (1, 10), (1, 20), (1, NULL);

SELECT l.rowid, l.a, r.rowid, r.b
FROM pair_rowid_l l
FULL OUTER JOIN pair_rowid_r r ON EXISTS (
	SELECT 1 FROM pair_rowid_s s WHERE s.a = l.a AND s.b = r.b
)
ORDER BY ALL;

INSERT INTO pair_generated_r VALUES (10, 100), (20, 200), (30, 300);

CREATE TABLE pair_sparse_r(y INTEGER, b INTEGER);

SELECT 'semi' AS j, l.a, l.x
FROM pair_l l
SEMI JOIN pair_r r ON EXISTS (
	SELECT 1
	FROM pair_s s
	WHERE s.a = l.a
	  AND s.b = r.b
	  AND random() >= 0
)
UNION ALL
SELECT 'anti' AS j, l.a, l.x
FROM pair_l l
ANTI JOIN pair_r r ON EXISTS (
	SELECT 1
	FROM pair_s s
	WHERE s.a = l.a
	  AND s.b = r.b
	  AND random() >= 0
)
ORDER BY j, l.a, l.x;

INSERT INTO pair_multi_r VALUES (10), (20), (30);

INSERT INTO pair_multi_quant_s VALUES (1, 10, 5), (1, NULL, 5), (2, 20, 5);

CREATE TABLE pair_complex_l(a INTEGER, tags INTEGER[], st STRUCT(v INTEGER));

SELECT l.a, r.b
FROM (VALUES (1), (2)) l(a)
FULL OUTER JOIN range(10, 40, 10) r(b) ON EXISTS (
	SELECT 1
	FROM pair_multi_s s
	WHERE s.a = l.a
	  AND s.b = r.b
)
ORDER BY ALL;

CREATE TABLE pair_multi_agg_s(a INTEGER, b INTEGER, cnt BIGINT);

CREATE TABLE pair_null_s(a INTEGER, b INTEGER);

INSERT INTO pair_empty_l VALUES (1), (2);

CREATE TABLE pair_multi_dup_s(a INTEGER, b INTEGER, c INTEGER);

CREATE TABLE pair_dup_unmatched_s(a INTEGER, b INTEGER);

INSERT INTO pair_null_dup_l VALUES (NULL), (NULL), (1);

CREATE TABLE pair_multi_both_s(a INTEGER, b INTEGER, z INTEGER, w INTEGER);

WITH left_side AS (
	SELECT l.id AS lid, l.a, l2.z
	FROM pair_multi_both_l l
	JOIN pair_multi_both_l2 l2 ON l.id = l2.lid
), right_side AS (
	SELECT r.id AS rid, r.b, r2.w
	FROM pair_multi_both_r r
	JOIN pair_multi_both_r2 r2 ON r.id = r2.rid
), actual AS (
	SELECT l.id AS lid, l.a, l2.z
	FROM pair_multi_both_l l
	JOIN pair_multi_both_l2 l2 ON l.id = l2.lid
	ANTI JOIN (
		pair_multi_both_r r
		JOIN pair_multi_both_r2 r2 ON r.id = r2.rid
	) ON EXISTS (
		SELECT 1
		FROM pair_multi_both_s s
		WHERE s.a IS NOT DISTINCT FROM l.a
		  AND s.b IS NOT DISTINCT FROM r.b
		  AND s.z IS NOT DISTINCT FROM l2.z
		  AND s.w IS NOT DISTINCT FROM r2.w
	)
), manual AS (
	SELECT l.lid, l.a, l.z
	FROM left_side l
	WHERE NOT EXISTS (
		SELECT 1
		FROM right_side r
		WHERE EXISTS (
			SELECT 1
			FROM pair_multi_both_s s
			WHERE s.a IS NOT DISTINCT FROM l.a
			  AND s.b IS NOT DISTINCT FROM r.b
			  AND s.z IS NOT DISTINCT FROM l.z
			  AND s.w IS NOT DISTINCT FROM r.w
		)
	)
), a_minus_m AS (
	SELECT * FROM actual EXCEPT ALL SELECT * FROM manual
), m_minus_a AS (
	SELECT * FROM manual EXCEPT ALL SELECT * FROM actual
)
SELECT 'anti_multi_layout', (SELECT count(*) FROM a_minus_m), (SELECT count(*) FROM m_minus_a);

WITH q AS (
	SELECT count(*)::INTEGER AS count_value
	FROM (SELECT a, nextval('pair_effect_seq') AS v FROM pair_effect_l) l
	FULL OUTER JOIN pair_effect_r r ON EXISTS (
		SELECT 1 WHERE l.v = r.b
	)
)
SELECT count_value, currval('pair_effect_seq') FROM q;

CREATE TABLE pair_unique_domain_l(a INTEGER, x INTEGER);

EXPLAIN SELECT l.a, l.x, r.b, r.y
FROM (SELECT a, max(x)::INTEGER AS x FROM pair_unique_domain_l GROUP BY a) l
FULL OUTER JOIN (SELECT b, max(y)::INTEGER AS y FROM pair_unique_domain_r GROUP BY b) r ON EXISTS (
	SELECT 1
	FROM pair_unique_domain_s s
	WHERE s.a = l.a
	  AND s.b = r.b
);

SELECT l.a, l.x, r.b
FROM pair_l l
LEFT JOIN pair_r r ON CASE WHEN l.x > 10 THEN r.b ELSE NULL END = (
	SELECT s.b FROM pair_s s WHERE s.a = l.a AND s.b = r.b LIMIT 1
)
ORDER BY l.a, l.x, r.b NULLS LAST;

INSERT INTO pair_left_multi_l2 VALUES (5);

SELECT l.a, l.x, r.b
FROM pair_l l
LEFT JOIN pair_r r ON EXISTS (
	SELECT 1
	FROM pair_left_nested_t t
	WHERE EXISTS (
		SELECT 1
		WHERE EXISTS (
			SELECT 1
			FROM pair_left_multi_s s
			WHERE s.a = l.a
			  AND s.b = r.b
			  AND s.c = t.c
		)
	)
)
ORDER BY l.a, l.x, r.b NULLS LAST;

INSERT INTO pair_left_dup_s VALUES (1, 10), (2, 20);

INSERT INTO pair_left_null_r VALUES (NULL), (10), (20);

INSERT INTO pair_left_rowid_s VALUES (0, 0);

CREATE SEQUENCE pair_exists_effect_seq START 1;

SELECT l.a, l.x, r.b
FROM pair_l l
RIGHT JOIN pair_r r ON EXISTS (
	SELECT 1 FROM pair_s s WHERE s.a = l.a AND s.b = r.b
)
ORDER BY r.b, l.x NULLS LAST;

CREATE TABLE pair_right_corr_s(a INTEGER, b INTEGER);

CREATE TABLE pair_state_l(a INTEGER);

CREATE TEMP TABLE pair_volatile_left_result AS
SELECT l.lid, r.rid
FROM (VALUES (1, 1), (2, 1)) l(lid, a)
LEFT JOIN (VALUES (10, 1), (20, 1)) r(rid, b) ON EXISTS (
	SELECT 1
	WHERE l.a = r.b
	  AND nextval('pair_volatile_left_seq') = 2
);

SELECT count(*), currval('pair_volatile_anti_seq')
FROM (VALUES (1, 1), (2, 1)) l(lid, a)
ANTI JOIN (VALUES (10, 1), (20, 1)) r(rid, b) ON EXISTS (
	SELECT 1
	WHERE l.a = r.b
	  AND nextval('pair_volatile_anti_seq') > 100
);

SELECT outer_l.x, q.lx, q.b
FROM pair_l outer_l
LEFT JOIN LATERAL (
	SELECT l.x AS lx, r.b
	FROM (SELECT * FROM pair_l WHERE pair_l.a = outer_l.a) l
	LEFT JOIN pair_r r ON EXISTS (
		SELECT 1
		FROM pair_s s
		WHERE s.a = l.a
		  AND s.b = r.b
	)
) q ON true
ORDER BY outer_l.x, q.lx, q.b NULLS LAST;

SELECT outer_r.b, q.a, q.x
FROM pair_r outer_r
LEFT JOIN LATERAL (
	WITH cr AS (SELECT b FROM pair_r WHERE pair_r.b = outer_r.b)
	SELECT l.a, l.x
	FROM pair_l l
	SEMI JOIN cr ON EXISTS (
		SELECT 1
		FROM pair_s s
		WHERE s.a = l.a
		  AND s.b = cr.b
	)
) q ON true
ORDER BY outer_r.b, q.a, q.x;

SELECT outer_l.x, q.a, q.b
FROM pair_l outer_l
LEFT JOIN LATERAL (
	SELECT l.a, r.b
	FROM pair_l l
	LEFT JOIN pair_r r ON l.a = outer_l.a AND r.b IN (
		SELECT s.b
		FROM pair_s s
		WHERE s.a = l.a
	)
	WHERE l.x = outer_l.x
) q ON true
ORDER BY outer_l.x, q.a, q.b NULLS LAST;

SET wal_autocheckpoint='1TB';

CREATE TABLE two (a INTEGER, b INTEGER);

SELECT COUNT(a), COUNT(id)
FROM three POSITIONAL JOIN threek;

CREATE TABLE unit2(
	price INTEGER,
	amount_sold INTEGER,
	total_profit INTEGER GENERATED ALWAYS AS (price * amount_sold) VIRTUAL,
	also_total_profit INTEGER GENERATED ALWAYS AS (total_profit) VIRTUAL
);

SELECT COUNT(*), COUNT(max_i) IS NOT NULL FROM (
SELECT * FROM integers FULL OUTER JOIN (SELECT MAX(i) AS max_i FROM integers) ON i=max_i
);

SELECT COUNT(*) FROM bigtbl JOIN smalltbl USING (small_key) JOIN mediumtbl USING (medium_key);

INSERT INTO t1(c0) VALUES (TIMESTAMP '1969-12-13 07:02:08');

SELECT * FROM left_table l
RIGHT JOIN right_table r ON l.id = r.id AND l.val > 1 AND r.category = 1;

SELECT integers.*, integers2.* FROM integers2 RIGHT OUTER JOIN integers ON integers.i=integers2.k AND integers2.k IS NOT NULL ORDER BY i;

SELECT integers.*, integers2.* FROM integers2 RIGHT OUTER JOIN integers ON i=4 OR l=17 ORDER BY i;

CREATE TABLE a AS SELECT i AS id,i%100 AS k FROM range(10000) t(i);

SELECT count(*) FROM (SELECT id AS x,k AS y FROM a) a
JOIN b ON a.x=b.id AND a.y=b.k JOIN c ON b.k=c.k;

INSERT INTO c VALUES (42),(NULL);

INSERT INTO float_a VALUES (1,'-0.0'),(2,'0.0'),(3,'nan'),(4,NULL);

CREATE TABLE c AS SELECT 42::DOUBLE k;

EXECUTE nested_target;

CREATE TABLE lookup AS SELECT i AS id,i%8 AS k FROM range(256) t(i);

INSERT INTO wanted VALUES (7);

CREATE TABLE c AS SELECT 1::BIGINT AS k;

INSERT INTO c VALUES (42,2);

SELECT count(*) FROM a JOIN b USING(id) JOIN c ON b.k=c.k;

SELECT p.k,n FROM (
    SELECT b.k,count(*) AS n FROM a JOIN b USING(id) GROUP BY b.k
) p JOIN c ON p.k IS NOT DISTINCT FROM c.k;

EXPLAIN ANALYZE SELECT id,p.k,p.rn FROM (
    SELECT id,k,row_number() OVER (PARTITION BY k ORDER BY id) AS rn FROM a
) p JOIN c ON p.k=c.k AND p.rn=c.rn;

CREATE TABLE probe AS SELECT range AS k FROM range(300000);

CREATE TABLE probe AS SELECT i AS k,i%7 AS v FROM range(200000) t(i);

SELECT p.k,p.v FROM (
    SELECT k,sum(v) v FROM probe GROUP BY k
) p JOIN build b ON p.k=b.k
JOIN second_build c ON p.k=c.k;

SET disabled_optimizers='statistics_propagation,join_order,build_side_probe_side,compressed_materialization,projection_pullup,projection_placement';

SELECT a FROM (SELECT a FROM probe WHERE nextval('target_seq')=2) p JOIN build ON a=b;

SELECT choices.a FROM choices RIGHT JOIN probe ON choices.a=probe.a
ORDER BY choices.a NULLS FIRST LIMIT 2;

INSERT INTO prepared_build VALUES (42,0);

create table test_str(k varchar);

insert into test_int VALUES (NULL);

SELECT * FROM left_table ANTI JOIN right_table ON left_table.a = right_table.a WHERE a > 5;

DELETE FROM left_table where c=5;

INSERT INTO right_table VALUES (1, 42), (1, 42);

CREATE OR REPLACE TABLE right_input(i INTEGER);

SELECT r.i FROM left_input l JOIN BY (TYPE RIGHT_SEMI) right_input r ON r.i IS NOT DISTINCT FROM NULL;

select * from t1 semi join t2 on t1.a < t2.b and t1.b > t2.b order by all;

create table input_table as select * from VALUES
('1', '2023-03-14T00:00:00Z', 2),
('2', '2023-03-15T00:00:00Z', 4),
('3', '2023-03-16T00:00:00Z', 7),
('4', '2023-03-17T00:00:00Z', 3),
('5', '2023-03-18T00:00:00Z', 2),
('6', '2023-03-19T23:59:59Z', 4),
('7', '2023-03-20T00:00:00Z', 7),
('8', '2023-03-21T00:00:00Z', 3) t(user_id, timestamp, value);

explain analyze SELECT * FROM left_table ANTI JOIN (SELECT a as foo from right_table where b > 5) buzz ON left_table.a = buzz.foo;

explain analyze SELECT a as outer_a, (SELECT MAX(right_table.b) FROM right_table where right_table.a != outer_a) right_table_b FROM left_table ANTI JOIN right_table ON (left_table.a = right_table.a) Order by outer_a, right_table_b;

SELECT count(*) FROM (
    (TABLE actual_semi EXCEPT ALL TABLE expected_semi)
    UNION ALL
    (TABLE expected_semi EXCEPT ALL TABLE actual_semi)
    UNION ALL
    (TABLE actual_anti EXCEPT ALL TABLE expected_anti)
    UNION ALL
    (TABLE expected_anti EXCEPT ALL TABLE actual_anti)
);

DROP TABLE expected_semi;

INSERT INTO left_table VALUES (41, 1, 1), (42, 1, 1), (42, 1, 1), (43, 1, 1), (45, 2, 2), (46, 7, 7);

EXPLAIN ANALYZE SELECT * FROM left_table
NATURAL SEMI JOIN (select right_table.a FROM right_table JOIN other ON (other.a = right_table.a)) joined_right_table;

CREATE TABLE small(k INTEGER);

CREATE TABLE many AS SELECT i::INTEGER AS k FROM range(1000000) t(i);

SELECT k FROM small s SEMI JOIN big b ON s.k < b.k ORDER BY k;

SELECT k FROM small s SEMI JOIN (SELECT nullif(k, k) AS k FROM big) b ON s.k < b.k;

SELECT k FROM small_date s SEMI JOIN big_date b ON s.k < b.k ORDER BY k;

SELECT k FROM (SELECT k + 998990 AS k FROM small) s SEMI JOIN many b ON s.k < b.k ORDER BY k;

WITH RECURSIVE t(i) AS (
	SELECT 1005::INTEGER
	UNION ALL
	(WITH tmp AS (SELECT * FROM t),
	      above AS (SELECT count(*) AS c FROM small s SEMI JOIN big b ON s.k > b.k)
	 SELECT i + c::INTEGER FROM tmp, above WHERE i < 1013)
) SELECT count(*), max(i) FROM t;

SELECT * FROM left_table SEMI JOIN right_table USING (a);

SELECT a as outer_a, (SELECT b FROM right_table where right_table.a != outer_a) right_table_b FROM left_table SEMI JOIN right_table ON (left_table.a = right_table.a) Order by outer_a, right_table_b;

SELECT * FROM left_table l
ANTI JOIN right_table r ON l.id = r.id AND l.val = 1;

select * FROM t1 WHERE NOT EXISTS (SELECT 1 FROM t0 WHERE null);

select w from (from xx limit 4)
CROSS JOIN (select 1 as f1) p
WHERE
   w IN (
	  SELECT 'a'
	  UNION -- with 'UNION ALL' it works also using 'limit 4'
	  SELECT 'b'
	  UNION
	  SELECT 'c' WHERE p.f1 = 1
	  UNION
	  SELECT 'd' WHERE p.f1 = 1
);

CREATE TABLE tt(x INT, l INT, u INT);

SELECT count(*) FROM (
  SELECT 1 FROM t1 RIGHT JOIN (SELECT 1 AS col0 FROM t1) AS sub0
    ON ((EXISTS (SELECT 1 FROM t1 WHERE t1.c2 < 0)) NOT BETWEEN (t1.c2 = t1.c1) AND t1.c0)
  UNION ALL
  SELECT 1 FROM t1 RIGHT JOIN (SELECT 1 AS col0 FROM t1) AS sub0
    ON ((EXISTS (SELECT 1 FROM t1 WHERE t1.c2 < 0)) NOT BETWEEN (t1.c2 = t1.c1) AND t1.c0)
) x;

WITH lhs(i, j, k) AS (VALUES
	(100, 10, 1),
	(200, 20, 2)
),
rhs(p, q, r) AS (VALUES
	(100, 10, 1),
	(200, 20, 2)
)
SELECT lhs.*, rhs.*
FROM lhs, rhs
WHERE i <= p AND k >= r AND j <= q
ORDER BY i;

CREATE TABLE limits_nulls AS (
	SELECT CASE WHEN z % 9 = 0 THEN NULL ELSE z END AS z
	FROM limits
);

EXPLAIN
SELECT lhs.i, rhs.i
FROM wide_nulls lhs, wide_nulls rhs
WHERE lhs.c3 < rhs.c0
  AND lhs.c8 IS DISTINCT FROM rhs.c3
ORDER BY 1, 2;

SELECT * FROM left_table l
RIGHT JOIN right_table r ON TRUE;

SELECT * FROM left_table l
ANTI JOIN (SELECT * FROM stats_table WHERE tag % 7 = 3) e ON l.val <= e.category;

SELECT a, a IN (SELECT b FROM t2) FROM t1 ORDER BY a NULLS LAST;

SELECT count(*) FROM t1 JOIN BY (TYPE semi) (SELECT b AS a FROM t2) USING (a);

INSERT INTO groups VALUES (1, 1), (2, 1), (3, 2), (NULL, 2);

select l.k100 as lid, r.k100 as rid
from tleft l 
full join tleft r 
on l.b100 < r.e100
and l.k100 + r.k100 < 10
order by all;

select lhs.*, rhs.*
from list_int lhs, list_int rhs
where lhs.i2 = rhs.i2 and lhs.l3 <> rhs.l3
order by lhs.i, rhs.i;

SELECT (issue23927.s < issue23927.s) 
FROM issue23927 
INNER JOIN issue23927 AS sub0 
ON (issue23927.s <= sub0.s);

SELECT t5.created_at
FROM (SELECT 'YEAR' AS c0
      FROM t AS t1 
      INNER JOIN t AS t2 
      ON t1.created_at = t2.created_at
      WHERE COALESCE(t1.id, t2.id) IS NOT NULL
) AS sq4
INNER JOIN t AS t5 
ON sq4.c0 = t5.created_at;
