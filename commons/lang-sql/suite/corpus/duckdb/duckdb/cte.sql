create table t as with q(id,s) as (values(1,42)),
a(s)as materialized(select 42)
select id from q join a on q.s=a.s;

with cte as (select 42 AS a) FROM (SUMMARIZE TABLE cte);

WITH c AS MATERIALIZED (SELECT * FROM strings) SELECT count(*) FROM c WHERE s::INTEGER=1;

WITH c AS MATERIALIZED (SELECT * FROM strings)
SELECT (SELECT count(*) FROM c WHERE id=1 AND random()<2),
       (SELECT count(*) FROM c WHERE random()<2);

EXPLAIN WITH c AS MATERIALIZED (SELECT * FROM strings)
SELECT count(*) FROM c WHERE __internal_barrier(id=1);

RESET debug_verify_serializer;

WITH q4 AS (
  SELECT TRY_CAST(DATE '0001-01-01' AS TIMESTAMP) AS c0
  FROM typed_scalars t2 JOIN typed_data_2 t3 ON (t3.flag <= TRUE)
  WHERE (t3.flag AND NULL)
  ORDER BY c0 ASC NULLS FIRST
  LIMIT 61
)
SELECT t5.c0, MAX(2147483647), MAX(COALESCE(CAST('nan' AS DOUBLE), -2147483648))
FROM q4 t5 JOIN q4 t6 ON t5.c0 = t6.c0
WHERE (9223372036854775807 <> -9223372036854775808)
GROUP BY ROLLUP (t5.c0, t5.c0);

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

WITH
  cte1 AS (SELECT NULL AS y),
  cte1_filter AS (SELECT y FROM cte1 WHERE y < '2025-12-01'::TIMESTAMPTZ)
SELECT * FROM cte1_filter;

insert into s1.tbl values ('hello');

SELECT count(*) FROM dml_exchange_t;

WITH ins AS (
    INSERT INTO t VALUES (1, 10), (2, 20) RETURNING i
)
SELECT * FROM ins;

INSERT INTO t VALUES (10, 100);

WITH ins AS (INSERT INTO t VALUES (99, 99))
SELECT 1;

WITH ins AS (INSERT INTO t VALUES (55, 55))
SELECT 1 AS x FROM ins;

SELECT * FROM multiplier;

PREPARE dml_prepared AS
    WITH ins AS (INSERT INTO t VALUES ($1, $2) RETURNING i)
    SELECT * FROM ins;

WITH ins AS (
    INSERT INTO t SELECT v, v * 2 FROM src RETURNING i
)
SELECT * FROM ins;

SELECT * FROM t_aux;

INSERT INTO t1 VALUES (1, 10), (2, 20);

WITH ins1 AS (INSERT INTO t1 VALUES (1, 10) RETURNING i),
     ins2 AS (INSERT INTO t_aux VALUES (2, 20) RETURNING i),
     ins3 AS (INSERT INTO t3 VALUES (3) RETURNING i)
SELECT * FROM ins1
UNION ALL SELECT * FROM ins2
UNION ALL SELECT * FROM ins3;

SELECT count(*) FROM t_aux;

WITH ins AS (INSERT INTO t1 VALUES (1, 10), (2, 20) RETURNING i),
     sel AS MATERIALIZED (SELECT * FROM t1)
SELECT count(*) FROM sel;

BEGIN;

INSERT INTO t_unique VALUES (1);

WITH ins1 AS MATERIALIZED (INSERT INTO t1 VALUES (1, 10) RETURNING i),
     ins2 AS MATERIALIZED (INSERT INTO t_aux VALUES (2, 20) RETURNING i)
SELECT * FROM ins1 UNION ALL SELECT * FROM ins2;

INSERT INTO t1 VALUES (1, 10), (2, 20), (3, 30), (4, 40);

WITH ins AS (INSERT INTO t1 VALUES (1, 10), (2, 20) RETURNING i, j),
     upd AS (UPDATE t1 SET j = j + 1 RETURNING i, j),
     del AS (DELETE FROM t1 WHERE i = 1 RETURNING i, j)
SELECT * FROM ins;

WITH ups AS (
    INSERT INTO upsert_t VALUES (2, 99), (3, 30)
    ON CONFLICT (i) DO UPDATE SET j = excluded.j
    RETURNING i, j
)
SELECT * FROM ups;

WITH ups AS (
    INSERT INTO upsert_t VALUES (1, 99), (2, 20)
    ON CONFLICT (i) DO UPDATE SET j = excluded.j
    RETURNING i, j
)
SELECT * FROM upsert_t;

WITH ins AS MATERIALIZED (
    INSERT INTO t2 VALUES (1, 10), (2, 20) RETURNING i, j
), sel AS MATERIALIZED (SELECT * FROM t2)
SELECT ins.i, sel.i FROM ins, sel;

WITH ins AS (
    INSERT INTO base SELECT i + 1 FROM base_view RETURNING i
)
SELECT * FROM ins;

CREATE VIEW small_base AS SELECT * FROM base WHERE i <= 3;

WITH cte AS (
    INSERT INTO cso_t SELECT COUNT(i) FROM cso_t RETURNING i
) SELECT COUNT(i) FROM cso_t;

CREATE TABLE cte_inline_t (i INTEGER);

SELECT * FROM empty_consumer_t;

FROM persist_v;

WITH ins AS (INSERT INTO stats_t VALUES (NULL), (100) RETURNING i)
SELECT count(*), count(i), min(i), max(i), avg(i) FROM stats_t;

SELECT count(*), min(i), max(i) FROM stats_t;

EXECUTE add_row(500);

WITH RECURSIVE cte AS (SELECT 42) SELECT * FROM cte;

SELECT * FROM table2;

explain create table new_active_events as
with
  new_events as materialized (  -- Does not make much sense in this example, but my original query was a union of a bunch of things
      select * from batch
  ), combined_deduplicated_events as (
      select
          entity,
          min(start_ts) as start_ts,
          max(end_ts) as end_ts
      from
          active_events
      group by
          entity
  ), all_events as (
      select  * from combined_deduplicated_events
  )
select
  *
from
  new_events;

INSERT INTO u SELECT 1 FROM range(1000);

WITH c2 AS MATERIALIZED (SELECT range AS a FROM range(15000000)), c1 AS MATERIALIZED (SELECT a FROM c2 LIMIT 5) SELECT count(*) FROM c2 JOIN c1 ON c2.a = c1.a;

SET preserve_insertion_order=false;

CREATE TABLE rf_t AS SELECT (range % 2000000)::BIGINT k FROM range(8000000);

SET disabled_optimizers='join_filter_pushdown';

RESET threads;

WITH cte AS MATERIALIZED (
	SELECT i, md5(i::VARCHAR) AS digest
	FROM range(100) t(i)
)
SELECT count(*) FROM cte WHERE digest < '4'
UNION ALL
SELECT count(*) FROM cte WHERE digest > 'c';

WITH cte AS MATERIALIZED (
	SELECT i + 1 AS x, md5(i::VARCHAR) AS payload
	FROM range(100) t(i)
)
SELECT sum(length(payload))
FROM cte
WHERE x < 10;

CREATE TABLE cte_filter_context(x INTEGER);

EXPLAIN (FORMAT JSON) WITH cte AS MATERIALIZED (
	SELECT i AS k, i % 10 AS v FROM range(1000000000) t(i)
)
SELECT count(*)
FROM cte c, cte_filter_context s
WHERE c.v IN (1, 2, 3, 4, 5, 6) OR s.x > 100
UNION ALL
SELECT count(*) FROM cte;

WITH c AS MATERIALIZED (
    SELECT i FROM range(500000) r(i)
    UNION ALL
    SELECT i + 500000 FROM range(500000) r(i)
)
SELECT count(*)
FROM (
    (SELECT i FROM c LIMIT 100000)
    UNION ALL
    (SELECT i FROM c LIMIT 1)
    LIMIT 100001
) q;

WITH a AS MATERIALIZED (
    SELECT i FROM range(1000000) r(i)
), b AS MATERIALIZED (
    SELECT i FROM a LIMIT 1
)
SELECT count(*)
FROM (
    (SELECT i FROM b LIMIT 1)
    UNION ALL
    (SELECT i FROM a LIMIT 1)
    LIMIT 2
) q;

WITH OwnSum AS (
    SELECT report_date, plant_id_eia, generator_id,
           sum(fraction_owned) AS fraction_owned, 1 AS toy_join
    FROM own
    GROUP BY report_date, plant_id_eia, generator_id
    HAVING fraction_owned IS NOT NULL
), OwnSumInvalid AS (
    SELECT * FROM OwnSum WHERE fraction_owned > 1.02
    LIMIT 1000000 OFFSET 0
), PercentileScores AS (
    SELECT fraction_owned,
           row_number() OVER w AS "row_number",
           percent_rank() OVER w AS "percent_rank"
    FROM OwnSum
    WINDOW w AS (ORDER BY fraction_owned)
), PercentileMissing AS (
    SELECT percent_rank AS pct_missing, 1 AS toy_join
    FROM PercentileScores
    WHERE fraction_owned >= 0.98
    LIMIT 1
), Summary AS (
    SELECT * FROM OwnSumInvalid RIGHT JOIN PercentileMissing USING (toy_join)
)
SELECT count(*) FROM Summary WHERE (report_date IS NOT NULL) OR (pct_missing >= 0.5);

CREATE TABLE t2 AS SELECT (range % 2000000)::BIGINT k FROM range(8000000);

EXPLAIN ANALYZE WITH c2 AS MATERIALIZED (SELECT range AS a FROM range(15000000)), c1 AS MATERIALIZED (SELECT a FROM c2 LIMIT 5) SELECT count(*) FROM c2 JOIN c1 ON c2.a = c1.a;

CREATE TABLE b(s VARCHAR);

EXECUTE changing_builds;

INSERT INTO wide VALUES (1),(2),(5000000000);

CREATE SEQUENCE cte_effect_seq;

CREATE TABLE miss_b AS SELECT 101::BIGINT k;

SET operator_memory_limit='256KB';

SET max_execution_time=10000;

WITH p AS MATERIALIZED (SELECT * FROM facts)
SELECT count(*),sum(length(x.payload))
FROM (SELECT p.* FROM p JOIN b USING(k)) x
JOIN (SELECT p.* FROM p JOIN c USING(k)) y USING(k);

WITH p AS MATERIALIZED (SELECT * FROM large_facts)
SELECT (SELECT count(*) FROM (
           SELECT p.k FROM p JOIN (SELECT i AS k FROM range(600000) t(i) WHERE i IN (1,3)) b USING(k) LIMIT 1
       ) t),
       (SELECT count(*) FROM (SELECT k FROM p JOIN c USING(k) LIMIT 1) t);

CREATE TABLE b AS SELECT i AS g FROM range(100,300) t(i);

EXPLAIN (ANALYZE, FORMAT JSON)
WITH p AS MATERIALIZED (SELECT d.g,sum(f.v) v FROM facts f JOIN dates d USING(k) GROUP BY d.g)
SELECT sum(x.v),sum(y.v)
FROM (SELECT p.* FROM p JOIN b USING(g)) x
JOIN (SELECT p.* FROM p JOIN c USING(g)) y ON x.g=y.g-400;

INSERT INTO b SELECT i FROM range(120,140) t(i);

CREATE OR REPLACE TABLE c AS SELECT i AS g FROM range(100500,100700) t(i);

CREATE TABLE c(k BIGINT);

INSERT INTO b VALUES (12),(NULL);

INSERT INTO c VALUES (9999);

WITH p AS MATERIALIZED (SELECT k FROM probe ORDER BY k LIMIT 3)
SELECT p.k FROM p JOIN b USING(k)
UNION ALL SELECT p.k FROM p JOIN c USING(k);

CREATE TABLE second_pair AS SELECT 3::BIGINT a,4::BIGINT b;

WITH p AS MATERIALIZED (SELECT a FROM pairs)
SELECT count(*),count(*) FILTER (WHERE a IS NULL) FROM (
    SELECT p.a FROM p JOIN b ON p.a IS NOT DISTINCT FROM b.k
    UNION ALL SELECT p.a FROM p JOIN first_pair f ON p.a=f.a
) result;

WITH p AS MATERIALIZED (SELECT s FROM strings)
SELECT length(p.s),left(p.s,1) FROM p JOIN string_b b USING(s)
UNION ALL SELECT length(p.s),left(p.s,1) FROM p JOIN string_c c USING(s);

SET memory_limit='32MB';

WITH t(x) AS MATERIALIZED (VALUES (42))
UPDATE a SET i = 0 WHERE a.i IN (SELECT * FROM t);

FROM a ORDER BY 1;

with
    system_types as (
        select distinct
            type_name as label,
            'type' as type_label,
            1000 as priority,
            null as context
        from duckdb_types()
        where database_name = 'system'
    ),
    custom_types as (
        select distinct
            type_name as label,
            'type' as type_label,
            1000 as priority,
            schema_name as context
        from duckdb_types()
        where
            database_name not in ('system', 'temp')
            and type_name not in (select label from system_types)
    )
select *
from system_types
union all
select *
from custom_types;

EXPLAIN ANALYZE
CREATE TABLE cte_order_direct AS
WITH t(i) AS MATERIALIZED (
	SELECT i FROM cte_order_batch
)
SELECT i FROM t;

CREATE TABLE cte_order_sparse AS
WITH t(i) AS MATERIALIZED (
	SELECT i FROM cte_order_batch WHERE i % 100000 = 0
)
SELECT i FROM t;

WITH t(i) AS MATERIALIZED (
	SELECT i FROM range(1000000) tbl(i)
)
SELECT (SELECT i FROM t LIMIT 1 OFFSET 100000), (SELECT i FROM t LIMIT 1 OFFSET 900000);

WITH t AS MATERIALIZED (
	SELECT * FROM cte_order_left
	UNION ALL
	SELECT * FROM cte_order_right
)
SELECT i FROM t LIMIT 5 OFFSET 5000;

SELECT i FROM cte_order_sorted_copy LIMIT 5;

WITH t(i) AS MATERIALIZED (
	VALUES (1), (2), (3), (4), (5)
)
SELECT i FROM t LIMIT 3 OFFSET 1;

SELECT count(*), min(i), max(i) FROM cte_parallel_copy;

EXECUTE cte_parallel_prepared;

SELECT count(*)
FROM cte_parallel_nested
WHERE i != rowid;

CREATE TABLE cte_parallel_empty AS
WITH t AS MATERIALIZED (
	SELECT i FROM cte_parallel_left WHERE false
	UNION ALL
	SELECT i FROM cte_parallel_right WHERE false
)
SELECT i FROM t;

SET debug_verify_progress='error';

EXECUTE parallel_scan;

PREPARE direct_fanout_cte AS
WITH c AS MATERIALIZED (SELECT i FROM range(1000) t(i))
SELECT count(*) FROM c;

EXECUTE buffered_fanout_cte;

EXECUTE direct_batch_cte;

PREPARE v2 AS WITH t(x) AS MATERIALIZED (VALUES ($1))
DELETE FROM a WHERE (i + $2) IN (FROM t);

WITH RECURSIVE t(y, arr) AS MATERIALIZED
(
  SELECT 1, array[1,2,3,4,5,6]
    UNION ALL
  SELECT y+1, arr
  FROM   t, p
  WHERE y < 10
    AND y = loc
) SELECT * FROM t;

CREATE TABLE a AS SELECT * FROM range(100) t1(i);

WITH RECURSIVE t AS MATERIALIZED
(
	SELECT 1 AS x
UNION
	SELECT (SELECT t.x+t2.x FROM t t2 LIMIT 1) AS x
	FROM t
	WHERE x < 10
)
SELECT * FROM t ORDER BY 1 NULLS LAST;

with parents_tab (id , value , parent )
as MATERIALIZED (values (1, 1, 2), (2, 2, 4), (3, 1, 4), (4, 2, -1), (5, 1, 2), (6, 2, 7), (7, 1, -1)
),
parents_tab2(id , value , parent )
as MATERIALIZED (values (1, 1, 2), (2, 2, 4), (3, 1, 4), (4, 2, -1), (5, 1, 2), (6, 2, 7), (7, 1, -1)
),
parents as MATERIALIZED (
    select * from parents_tab
    union all
    select id, value+2, parent from parents_tab2
)
select * from parents ORDER BY id, value, parent;

SELECT x, y
FROM   generate_series(1,4) AS _(x), LATERAL
(WITH RECURSIVE t(y) AS MATERIALIZED (
  SELECT 1
    UNION ALL
  SELECT y + _.x
  FROM   t
  WHERE y < 3
)
SELECT * FROM t) AS t
ORDER BY x, y;

SELECT x, y
FROM   generate_series(1,4) AS _(x), LATERAL
(WITH RECURSIVE t(y) AS MATERIALIZED (
  SELECT _.x
    UNION
  SELECT y + 1
  FROM   t
  WHERE y < 3
)
SELECT * FROM t) AS t
ORDER BY x, y;

SELECT x, y, (WITH RECURSIVE t(z) AS MATERIALIZED (
  SELECT x + y
    UNION
  SELECT z + 1
  FROM   (WITH RECURSIVE g(a) AS MATERIALIZED (
          SELECT t.z
          FROM   t
            UNION
          SELECT g.a + (x + y) / 2
          FROM   g
          WHERE  g.a < 3)
          SELECT * FROM g) AS t(z)
  WHERE z < 5
) SELECT sum(z) FROM t) AS z
FROM   generate_series(1,2) AS _(x), generate_series(1,2) AS __(y) order by all;

EXPLAIN ANALYZE WITH c AS MATERIALIZED (SELECT i FROM range(10000) t(i))
SELECT count(*) FROM c JOIN range(10000) r(i) ON c.i=r.i;

WITH c AS MATERIALIZED (SELECT i FROM range(10000) t(i))
SELECT (SELECT sum(i) FROM c),
       (SELECT count(*) FROM c JOIN range(10000) r(i) USING (i));

WITH c(i) AS MATERIALIZED (VALUES (1), (2), (2), (NULL)), b(i) AS (VALUES (2), (3), (NULL))
SELECT count(*) FROM c FULL JOIN b ON c.i=b.i;

WITH c AS MATERIALIZED (
  SELECT i FROM range(1000) t(i)
  UNION ALL
  SELECT i + 1000 FROM range(1000) t(i)
)
SELECT count(*) FROM range(2000) l(i) JOIN c ON l.i=c.i;

EXPLAIN ANALYZE
WITH l AS MATERIALIZED (SELECT i FROM range(10000) t(i)),
     r AS MATERIALIZED (SELECT i FROM range(10000) t(i))
SELECT count(*) FROM (
  SELECT l.i FROM l JOIN r USING (i)
  UNION ALL
  SELECT l.i FROM r JOIN l USING (i)
);

CREATE SEQUENCE cte_hash_sequence;

EXPLAIN ANALYZE
WITH c AS MATERIALIZED (
  SELECT i, repeat('x', 32) payload FROM range(10000) t(i)
)
SELECT (SELECT sum(length(payload)) FROM c),
       (SELECT count(*) FROM c JOIN range(10000) r(i) USING (i));

SET debug_force_external=false;

RESET operator_memory_limit;

with cte1 as MATERIALIZED (with b as MATERIALIZED (Select i as j from a) select j from b), cte2 as MATERIALIZED (with c as MATERIALIZED (select ref.j+1 as k from cte1 as ref) select k from c) select * from cte1 , cte2;

with cte1 as MATERIALIZED (Select i as j from a) select x from cte1 t1(x);

with cte1 as MATERIALIZED (Select i as j from a) select * from cte1 cte11, cte1 cte12;

with cte AS MATERIALIZED (SELECT * FROM va) SELECT * FROM cte;

with cte (a) as MATERIALIZED (
    select 1
)
select
    a as alias1,
    alias1 as alias2
from cte
where alias2 > 0;

create view va as (with v as MATERIALIZED (select * from a) select * from v);

INSERT INTO T1(C1) VALUES (1);

EXPLAIN ANALYZE WITH d AS MATERIALIZED (SELECT i FROM range(10000) tbl(i))
SELECT sum(i) FROM d;

WITH t(x) AS MATERIALIZED (SELECT t FROM generate_series(1,3) AS _(t)) SELECT t1.x, t1.x FROM t AS t1 ORDER BY x;

WITH d AS MATERIALIZED (
  SELECT
    i AS c00,
    i AS c01, i AS c02, i AS c03, i AS c04, i AS c05, i AS c06, i AS c07,
    i AS c08, i AS c09, i AS c10, i AS c11, i AS c12, i AS c13, i AS c14, i AS c15
  FROM range(300000) tbl(i)
)
SELECT (SELECT sum(c00 + c01 + c02 + c03 + c04 + c05 + c06 + c07 +
                   c08 + c09 + c10 + c11 + c12 + c13 + c14 + c15)
        FROM (SELECT * FROM d LIMIT 10)),
       (SELECT sum(c00 + c01 + c02 + c03 + c04 + c05 + c06 + c07 +
                   c08 + c09 + c10 + c11 + c12 + c13 + c14 + c15)
        FROM (SELECT * FROM d LIMIT 10));

WITH d AS (
  SELECT
    i AS c00, i + 1 AS c01, i + 2 AS c02, i + 3 AS c03, i + 4 AS c04,
    i + 5 AS c05, i + 6 AS c06, i + 7 AS c07, i + 8 AS c08, i + 9 AS c09,
    i + 10 AS c10, i + 11 AS c11, i + 12 AS c12, i + 13 AS c13, i + 14 AS c14,
    i + 15 AS c15, i + 16 AS c16, i + 17 AS c17, i + 18 AS c18, i + 19 AS c19,
    i + 20 AS c20, i + 21 AS c21, i + 22 AS c22, i + 23 AS c23, i + 24 AS c24,
    i + 25 AS c25, i + 26 AS c26, i + 27 AS c27, i + 28 AS c28, i + 29 AS c29,
    i + 30 AS c30, i + 31 AS c31, i + 32 AS c32, i + 33 AS c33, i + 34 AS c34,
    i + 35 AS c35, i + 36 AS c36, i + 37 AS c37, i + 38 AS c38, i + 39 AS c39,
    i + 40 AS c40, i + 41 AS c41, i + 42 AS c42, i + 43 AS c43, i + 44 AS c44,
    i + 45 AS c45, i + 46 AS c46, i + 47 AS c47, i + 48 AS c48, i + 49 AS c49,
    i + 50 AS c50, i + 51 AS c51, i + 52 AS c52, i + 53 AS c53, i + 54 AS c54,
    i + 55 AS c55, i + 56 AS c56, i + 57 AS c57, i + 58 AS c58, i + 59 AS c59,
    i + 60 AS c60, i + 61 AS c61, i + 62 AS c62, i + 63 AS c63
  FROM range(70000) tbl(i)
)
SELECT (SELECT sum(c00) FROM d),
       (SELECT sum(c00 + c01 + c02 + c03 + c04 + c05 + c06 + c07 +
                   c08 + c09 + c10 + c11 + c12 + c13 + c14 + c15 +
                   c16 + c17 + c18 + c19 + c20 + c21 + c22 + c23 +
                   c24 + c25 + c26 + c27 + c28 + c29 + c30 + c31 +
                   c32 + c33 + c34 + c35 + c36 + c37 + c38 + c39 +
                   c40 + c41 + c42 + c43 + c44 + c45 + c46 + c47 +
                   c48 + c49 + c50 + c51 + c52 + c53 + c54 + c55 +
                   c56 + c57 + c58 + c59 + c60 + c61 + c62 + c63)
        FROM (SELECT * FROM d ORDER BY c00 DESC LIMIT 10));

WITH t(x) AS MATERIALIZED (SELECT 1),
     u(x) AS MATERIALIZED (SELECT x+1 FROM t)
  TABLE u UNION ALL TABLE t;

WITH RECURSIVE t(x) AS MATERIALIZED
(
  SELECT 1
    UNION ALL
  SELECT x + 1
  FROM   (SELECT t.x+1 FROM v AS _(p) FULL OUTER JOIN t ON t.x = p) AS _(x)
  WHERE  x < 10
) SELECT * FROM v AS _(p) RIGHT OUTER JOIN t ON t.x = p ORDER BY p, x NULLS LAST;

INSERT INTO emp VALUES (7782, 'CLARK', 'MANAGER', 7839, DATE '1981-06-09', 2450.00, NULL, 10);

INSERT INTO emp VALUES (7521, 'WARD', 'SALESMAN', 7698, DATE '1981-02-22', 1250.00, 500.00, 30);

WITH RECURSIVE ctename AS MATERIALIZED (
      SELECT empno, ename
      FROM emp
      WHERE empno = 7566
   UNION ALL
      SELECT emp.empno, emp.ename
      FROM emp
         JOIN ctename ON emp.mgr = ctename.empno
)
SELECT * FROM ctename;

WITH RECURSIVE fib AS MATERIALIZED (
      SELECT 1 AS n,
             1::bigint AS "fibₙ",
             1::bigint AS "fibₙ₊₁"
   UNION ALL
      SELECT n+1,
             "fibₙ₊₁",
             "fibₙ" + "fibₙ₊₁"
      FROM fib
      WHERE  n <= 20
)
SELECT n, "fibₙ" FROM fib
LIMIT 20;

with recursive t as MATERIALIZED (select 1 as x union all select x+1 from t where x < 3) select min(a1.x) from t a1, t a2;

WITH RECURSIVE t AS MATERIALIZED (
	SELECT 1 AS i
	UNION ALL
	SELECT j
	FROM t, generate_series(0, 10, 1) series(j)
	WHERE j=i+1
)
SELECT * FROM t;

with recursive t as MATERIALIZED (select 1 as x union select x from t) select * from t;

with recursive t as MATERIALIZED (select 1 as x union select x+(SELECT 1) from t where x < 3) select * from t order by x;

create view vr as (with recursive t(x) as MATERIALIZED (select 1 union select x+1 from t where x < 3) select * from t order by x);

WITH m1 AS MATERIALIZED (SELECT i, 'hop_payload_string_longer_than_twelve' AS c FROM range(50000) t(i)),
     m2 AS MATERIALIZED (SELECT i, c FROM m1)
SELECT count(*), count(DISTINCT c), min(c), max(c)
FROM m2 JOIN (SELECT max(i) AS mi FROM m2) x ON m2.i <= x.mi;

WITH m AS MATERIALIZED (SELECT i, 'ordered_constant' AS c FROM range(10000) t(i))
SELECT c, i FROM m JOIN (SELECT max(i) AS mi FROM m) x ON m.i <= x.mi ORDER BY i DESC LIMIT 2;

SET memory_limit='60mb';

WITH RECURSIVE t(y, arr) AS
(
  SELECT 1, array[1,2,3,4,5,6]
    UNION ALL
  SELECT y+1, arr
  FROM   t, p
  WHERE y < 10
    AND y = loc
) SELECT * FROM t;

SET enable_caching_operators=false;

EXPLAIN WITH RECURSIVE r(a, b, c) AS (
	SELECT 1, 2, repeat('x', 1000)
	UNION ALL
	SELECT a + 1, b + 1, c FROM r WHERE a < 3
)
SELECT a FROM r;

WITH RECURSIVE t(a, b, c, level) AS (
	SELECT 1, 2, 3, 0
	UNION ALL
	SELECT c, a, b, level + 1 FROM t WHERE level < 3
)
SELECT a FROM t ORDER BY level;

WITH RECURSIVE t(i, unused) AS (
	SELECT 1, nextval('recursive_anchor_pruning_sequence')
	UNION ALL
	SELECT i + 1, unused FROM t WHERE i < 3
)
SELECT max(i), currval('recursive_anchor_pruning_sequence') FROM t;

WITH RECURSIVE t(i, payload) AS (
	SELECT 1, 'x'
	UNION ALL
	SELECT i + length(payload), columns.column_type
	FROM t
	CROSS JOIN (DESCRIBE SELECT 42::INTEGER AS value) columns
	WHERE i < 3
)
SELECT i FROM t ORDER BY i;

WITH RECURSIVE t AS
(
	SELECT 1 AS x
UNION
	SELECT SUM(x)
	FROM
		(SELECT SUM(x) FROM t) t1(x), a
	WHERE x < 1000
)
SELECT * FROM t ORDER BY 1 NULLS LAST;

WITH RECURSIVE t(step, r, v) AS (
	VALUES (0, 'x', 1)
	UNION ALL (
		WITH tmp AS (SELECT * FROM t),
		next(step, r, v) AS NOT MATERIALIZED (
			SELECT step, 'z', v FROM tmp WHERE r = 'x'
			UNION ALL
			SELECT * FROM tmp WHERE r <> 'z'
		)
		SELECT step + 1, r, v
		FROM next
		WHERE EXISTS (
			SELECT *
			FROM next n
			LEFT JOIN tmp p ON n.r = p.r
			WHERE p.v IS DISTINCT FROM n.v
		)
	)
)
SELECT max(step), count(*) FROM t;

SELECT *
FROM (SELECT {x: 1} AS a, {y: 3} AS b) seed,
LATERAL (
    WITH RECURSIVE t(n) AS (
        SELECT a.x
        UNION ALL
        SELECT n + 1 FROM t
        WHERE n < b.y
          AND NOT EXISTS (SELECT 1 FROM t r WHERE r.n = b.y)
    )
    SELECT * FROM t
) q
ORDER BY n;

CREATE TYPE savings AS struct(
  savings          numeric,     -- saved supply cost (in %)
  supplier_changes supplier_change[] -- supplier changes required to achieve savings
);

WITH RECURSIVE r(n) AS (
    SELECT 1
    UNION ALL
    (SELECT n + 1 FROM r WHERE n < 3 UNION ALL SELECT n + 1 FROM r WHERE n < 3 LIMIT 1 OFFSET 1)
)
SELECT n FROM r;

INSERT INTO steps VALUES (3);

CREATE TABLE powers AS
SELECT g AS grp, k AS kind, m AS m0, j, s AS sk, 0.9 AS uu, 0.05 AS lu, 0.03 AS du, 0.02 AS cu
FROM range(20) t1(g), range(getvariable('K')) t2(k), range(11) t3(m), range(20) t4(j), range(-4, 6) t5(s);

SELECT * FROM chain_step;

SELECT * FROM walk_step;

CREATE SEQUENCE cross_build_sequence START 1;

WITH RECURSIVE r(i, x) AS (
	SELECT 0, NULL::BIGINT
	UNION ALL
	SELECT r.i + 1, build.x
	FROM r
	JOIN (
		SELECT i AS k, nextval('parallel_build_sequence') AS x
		FROM range(8192) t(i)
	) build ON build.k = r.i % 8192
	WHERE r.i < 3
)
SELECT count(*), currval('parallel_build_sequence') FROM r;

SELECT info.recursive_pipeline_execute_work_ns::UBIGINT > 0,
       info.invariant_build_execute_work_ns::UBIGINT = 0,
       info.invariant_cte_materialization_execute_work_ns::UBIGINT = 0
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

SELECT info.recursive_pipeline_execute_work_ns::UBIGINT > 0,
       info.invariant_build_execute_work_ns::UBIGINT > 0
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

CREATE TABLE parallel_build_edges AS
SELECT i AS src, i + 1 AS dst FROM range(491520) t(i);

WITH RECURSIVE big(round, g, v) AS (
    SELECT 0 AS round, i % 100000 AS g, i::BIGINT AS v FROM range(400000) t(i)
    UNION ALL
    SELECT round + 1, (g * 37 + 11) % 99991 AS g2, max(v)
    FROM big
    WHERE round < 3
    GROUP BY round, g2
)
SELECT count(*), max(v), min(v) FROM big;

WITH RECURSIVE m(n, v) AS (
    SELECT 0, 1::BIGINT
    UNION ALL
    SELECT m.n + 1,
           CASE WHEN m.v + 1 NOT IN (SELECT CASE WHEN x % 3 = 0 THEN NULL ELSE x END FROM (SELECT m2.v AS x FROM m m2))
                THEN m.v + 2 ELSE m.v + 1 END
    FROM m WHERE m.n < 50
)
SELECT count(*), max(v) FROM m;

WITH RECURSIVE big(round, g, v) AS (
    SELECT 0, 0::BIGINT, 0::BIGINT
    UNION ALL
    SELECT round + 1, (big.g * 37 + i) % 199999 AS g2,
           max(big.v + i)
    FROM big CROSS JOIN range(CASE WHEN round = 0 THEN 10 ELSE 200000 END) t(i)
    WHERE round < 2
    GROUP BY round, g2
)
SELECT count(*), max(v), min(v) FROM big;

WITH RECURSIVE tbl(a, b) USING KEY (a , max(b)) AS (
	SELECT 1, 5
	UNION ALL
	SELECT a, b - 1
	FROM tbl
	WHERE b > 0)
TABLE tbl;

WITH RECURSIVE dvr(here, there, via, len) USING KEY (here, there , arg_min(via, len), min(len)) AS (
	SELECT n.person1id AS here, n.person2id AS there, n.person2id AS via, 1 AS len
	FROM knows AS n
	UNION ALL
	SELECT n.person1id AS here, dvr.there, dvr.here AS via, 1 + dvr.len AS len
	FROM dvr
	JOIN knows AS n ON
	(n.person2id = dvr.here AND n.person1id <> dvr.there))
TABLE dvr
ORDER BY here, there;

WITH RECURSIVE tbl(a,b) USING KEY (a , any_value(b)) AS (
	SELECT 1, 5
	UNION ALL
	SELECT tbl.a, tbl.b - 1
	FROM tbl
	WHERE tbl.b > 0)
TABLE tbl;

WITH RECURSIVE tbl(key,b) USING KEY (key , bit_xor(b)) AS (
	SELECT 1, '1111' :: BIT
	UNION ALL
	SELECT key, b << 1
	FROM tbl
	WHERE b > '0000' :: BIT
) TABLE tbl;

WITH RECURSIVE tbl(key, iter, c) USING KEY (key, count() AS iter, count(c)) AS (
	SELECT 1, 1, 1
	UNION ALL
	SELECT key, iter + 1, c
	FROM tbl
	WHERE iter < 8
) TABLE tbl;

WITH RECURSIVE tbl(key, iter, b) USING KEY (key, approx_quantile(b, [0.5, 0.4, 0.1]) AS b) AS (
	SELECT 1, 1, 0
	UNION ALL
	SELECT key, iter + 1, iter
	FROM tbl, VALUES (2, 1), (3, 2), (4, 10) AS tab(id, col)
	WHERE iter + 1 = id)
SELECT b FROM tbl;

WITH RECURSIVE tbl(iter, k, v, v2) USING KEY (k, corr(v, v2) AS v2) AS (
	SELECT it, k, v, v2
	FROM aggr
	WHERE it = 1
	UNION ALL
	SELECT tbl.iter + 1, tbl.k, a.v, a.v2
	FROM tbl, aggr AS a
	WHERE tbl.iter + 1 = a.it AND tbl.k = a.k
) SELECT k, v2 FROM tbl;

INSERT INTO names VALUES (1, 'pedro'), (2, 'pedro'), (3, 'pedro'),(4, 'hannes'),(5, 'hannes'),(6, 'mark'),(7, null);

CREATE SEQUENCE keyed_drain_sequence START 1;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	SELECT i, 0 FROM range(0) r(i)
	UNION ALL
	SELECT k, v + 1 FROM t WHERE v < 0
)
SELECT count(*) FROM t;

WITH RECURSIVE t(k, v, phase, seen) USING KEY (k, min(v, 3), max(phase)) AS (
	SELECT 0, letter || repeat('x', 64), 0, '' FROM (VALUES ('a'), ('c'), ('e')) s(letter)
	UNION ALL
	SELECT n.k, 'b' || repeat('x', 64), 1, left(r.v[1], 1)
	FROM t n JOIN recurring.t r USING (k)
	WHERE n.phase=0
)
SELECT list_transform(v, lambda x: left(x, 1)), phase, seen FROM t;

WITH RECURSIVE t(k, v) USING KEY (k, reservoir_quantile(v, 1.0, 16)) AS (
	SELECT i, 0.0::DOUBLE FROM range(16384) r(i)
	UNION
	SELECT n.k, r.v + 1
	FROM t n JOIN recurring.t r USING (k)
	WHERE r.v < 3
),
actual AS (SELECT * FROM t)
SELECT (SELECT count(*) FROM (TABLE actual EXCEPT TABLE expected_reservoir)),
       (SELECT count(*) FROM (TABLE expected_reservoir EXCEPT TABLE actual));

WITH RECURSIVE t(k, v, iter) USING KEY (k, max(v, 3), max(iter)) AS (
	SELECT i % 100, (i % 7)::INTEGER, 0 FROM range(16384) r(i)
	UNION ALL
	SELECT n.k, (r.iter + 1)::INTEGER, r.iter + 1 FROM t n JOIN recurring.t r USING (k) WHERE r.iter < 3
),
actual AS (SELECT k, v::VARCHAR AS v, iter FROM t)
SELECT (SELECT count(*) FROM (TABLE actual EXCEPT TABLE expected_payload)),
       (SELECT count(*) FROM (TABLE expected_payload EXCEPT TABLE actual));

CREATE OR REPLACE TABLE expected_payload AS
WITH RECURSIVE t(k, v, iter) USING KEY (k, quantile_cont(v, 0.5), max(iter)) AS (
	SELECT i % 100, (i % 7)::INTEGER, 0 FROM range(16384) r(i)
	UNION ALL
	SELECT n.k, (r.iter + 1)::INTEGER, r.iter + 1 FROM t n JOIN recurring.t r USING (k) WHERE r.iter < 3
)
SELECT k, v::VARCHAR AS v, iter FROM t;

WITH RECURSIVE t(k, v, iter) USING KEY (k, approx_top_k(v, 2), max(iter)) AS (
	SELECT i % 100, (i % 7)::INTEGER, 0 FROM range(16384) r(i)
	UNION ALL
	SELECT n.k, (r.iter + 1)::INTEGER, r.iter + 1 FROM t n JOIN recurring.t r USING (k) WHERE r.iter < 3
),
actual AS (SELECT k, v::VARCHAR AS v, iter FROM t)
SELECT (SELECT count(*) FROM (TABLE actual EXCEPT TABLE expected_payload)),
       (SELECT count(*) FROM (TABLE expected_payload EXCEPT TABLE actual));

WITH RECURSIVE t(k, v, iter) USING KEY (k, arg_min(v, v, 3), max(iter)) AS (
	SELECT 0, i, 0 FROM range(1, 4) r(i)
	UNION ALL
	SELECT n.k, 2, 1 FROM t n JOIN recurring.t r USING (k) WHERE n.iter = 0
)
SELECT k, v, iter FROM t;

INSERT INTO collated_input VALUES (1, 'a'), (2, 'x');

WITH RECURSIVE
base(k, w) AS (SELECT i % 3, i FROM range(12) r(i)),
t(k, v) USING KEY (k, sum(v)) AS (
	SELECT k, 1 FROM base
	UNION
	SELECT b.k, r.v FROM base b JOIN recurring.t r USING (k) WHERE r.v < 20
)
SELECT count(*), min(v), max(v) FROM t;

WITH RECURSIVE t(k, v) USING KEY (k, max(v)) AS (
	SELECT 'aa' COLLATE NOCASE AS k, 1 AS v
	UNION
	SELECT 'AA', v + 1 FROM t WHERE v < 4
)
SELECT upper(k), v FROM t;

create table customers (id integer, cname varchar);

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	SELECT i, 0 FROM range(8192) r(i)
	UNION ALL
	SELECT n.k, r.v + 1
	FROM recurring.t r JOIN t n USING (k)
	WHERE n.v < 3
)
SELECT count(*), min(v), max(v), sum(v) FROM t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	VALUES (NULL::INTEGER, 0), (1, 0)
	UNION ALL
	SELECT n.k, r.v + 1
	FROM t n JOIN recurring.t r ON r.k = n.k
	WHERE n.v < 1
)
SELECT k, v FROM t;

WITH RECURSIVE
fast(k1, k2, v) USING KEY (k1, k2) AS (
	VALUES (1, NULL::INTEGER, 0), (1, 2, 0), (NULL, 2, 0), (NULL, NULL, 0)
	UNION ALL
	SELECT n.k1, n.k2, r.v + 1
	FROM fast n
	JOIN recurring.fast r ON r.k2 IS NOT DISTINCT FROM n.k2 AND r.k1 = n.k1
	WHERE n.v < 1
),
fallback(k1, k2, v) USING KEY (k1, k2) AS (
	VALUES (1, NULL::INTEGER, 0), (1, 2, 0), (NULL, 2, 0), (NULL, NULL, 0)
	UNION ALL
	SELECT n.k1, n.k2, r.v + 1
	FROM fallback n
	JOIN (SELECT * FROM recurring.fallback WHERE v >= 0) r
	  ON r.k2 IS NOT DISTINCT FROM n.k2 AND r.k1 = n.k1
	WHERE n.v < 1
)
SELECT count(*) FROM (
	(SELECT * FROM fast EXCEPT ALL SELECT * FROM fallback)
	UNION ALL
	(SELECT * FROM fallback EXCEPT ALL SELECT * FROM fast)
);

WITH RECURSIVE t(k, v) USING KEY (k, max(v) AS v) AS (
	VALUES (1, 0)
	UNION ALL
	SELECT n.k, r.v + 1
	FROM t n JOIN recurring.t r USING (k)
	WHERE n.v < 3
)
SELECT k, v FROM t;

EXPLAIN WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2) AS (
	VALUES (1, 1, 0)
	UNION ALL
	SELECT n.k1, n.k2, r.v + 1
	FROM t n JOIN recurring.t r ON r.k1 = n.k1
	WHERE n.v < 1
)
SELECT * FROM t;

WITH RECURSIVE t(k1, k2, k3, v) USING KEY (k1, k2, k3) AS (
	VALUES (1, 10, 'a', 0), (1, 20, 'a', 0), (1, 30, 'b', 0)
	UNION ALL
	SELECT n.k1, n.k2, n.k3, r.v + 1
	FROM t n JOIN recurring.t r ON r.k3 = n.k3 AND r.k1 = n.k1
	WHERE n.v < 1
)
SELECT * FROM t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2) AS (
	VALUES (1, 10, 0), (1, 20, 0), (2, 10, 0), (2, 20, 0)
	UNION ALL
	(
		SELECT n.k1, n.k2, r.v + 1
		FROM t n JOIN recurring.t r ON r.k1 = n.k1
		WHERE n.v < 1
		UNION ALL
		SELECT n.k1, n.k2, r.v + 1
		FROM t n JOIN recurring.t r ON r.k2 = n.k2
		WHERE n.v < 1
	)
)
SELECT * FROM t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2) AS (
	VALUES (1, 1, 0), (1, 2, 0)
	UNION ALL
	SELECT n.k1, n.k2, r.v + 1
	FROM t n JOIN recurring.t r ON r.k1 = n.k1
	WHERE n.v < 1
)
SELECT * FROM t;

EXPLAIN WITH RECURSIVE t(k, v) USING KEY (k) AS (
	VALUES (1, 0)
	UNION ALL
	SELECT n.k, r.v + 1
	FROM t n JOIN recurring.t r ON r.k = n.k AND r.v = n.v
	WHERE n.v < 1
)
SELECT * FROM t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	SELECT 1, 0
	UNION ALL
	SELECT n.k, r.v + 1
	FROM t n
	JOIN recurring.t r USING (k)
	WHERE n.v < 3
)
SELECT k, v FROM t;

WITH RECURSIVE t(k, v) USING KEY (k, min(v)) AS (
	VALUES (1, 5)
	UNION
	SELECT k, v + delta
	FROM t, (VALUES (0), (0), (1), (2)) offsets(delta)
)
TABLE t;

WITH RECURSIVE t(k, total, recursive_type) USING KEY (k, sum(total)) AS (
	VALUES (1, 1::INTEGER, 'anchor')
	UNION
	SELECT k, 1, typeof(total) FROM t WHERE total < 2
)
SELECT k, total, recursive_type FROM t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	VALUES (1, 'NaN'::DOUBLE), (2, -0e0::DOUBLE)
	UNION
	SELECT k, CASE WHEN k = 1 THEN 'NaN'::DOUBLE ELSE 0e0::DOUBLE END
	FROM t
)
SELECT count(*), count_if(isnan(v)), count_if(signbit(v)) FROM t;

WITH RECURSIVE t(k, v) USING KEY (k, string_agg(v, '') AS v) AS (
	VALUES (1, 'a')
	UNION
	SELECT k, v || 'b' FROM t WHERE length(v) < 4
)
TABLE t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2, min(v)) AS (
	VALUES (1, NULL::INTEGER, 5), (1, 2, 10)
	UNION
	SELECT k1, k2, v FROM t
)
TABLE t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2, sum(v) AS v) AS (
	VALUES (1, 1, 1)
	UNION
	SELECT n.k1, n.k2 + 1, n.v
	FROM t n JOIN recurring.t r ON r.k1 = n.k1
	WHERE n.k2 < 3
)
TABLE t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	VALUES (1, 'a')
	UNION
	SELECT CASE ascii(v) WHEN 97 THEN 1 ELSE 2 END, upper(v) FROM t
)
TABLE t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (
	SELECT 1, ['a' COLLATE nocase]
	UNION
	SELECT CASE ascii(v[1]) WHEN 97 THEN 1 ELSE 2 END, ['A' COLLATE nocase] FROM t
)
TABLE t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2, sum(v)) AS (
	SELECT * FROM (VALUES ('a' COLLATE nocase, 1, 1), ('A' COLLATE nocase, 1, 2))
	UNION
	SELECT 'A' COLLATE nocase, 2, 4
)
SELECT count(*), sum(v) FROM t;

WITH RECURSIVE t(k, v) USING KEY (k, min(v)) AS (
	SELECT (NULL::VARCHAR) COLLATE nocase, 1
	UNION
	SELECT k, v FROM t
)
TABLE t;

WITH RECURSIVE t(k, v) USING KEY (k, min(v)) AS (
	SELECT array_value('a' COLLATE nocase), 2
	UNION
	SELECT array_value('A' COLLATE nocase), v - 1 FROM t WHERE v > 0
)
SELECT count(*), min(v), min(k[1]) FROM t;

WITH RECURSIVE t(k1, k2, v) USING KEY (k1, k2, min(v)) AS (
	SELECT i, i % 4, 2
	FROM range(current_setting('standard_vector_size')::BIGINT) r(i), range(8) duplicates(_)
	UNION
	SELECT n.k1, n.k2, r.v - 1
	FROM (SELECT t.*, duplicates._ FROM t, range(8) duplicates(_)) n
	JOIN recurring.t r ON r.k1 = n.k1
	WHERE n.v > 0
)
SELECT count(*) = current_setting('standard_vector_size')::BIGINT, sum(v), max(v) FROM t;

EXPLAIN WITH RECURSIVE t(k, total) USING KEY (k, sum(total)) AS (
	SELECT i, 1 FROM range(100) r(i)
	UNION
	SELECT n.k, r.total * 0 + 1
	FROM t n JOIN recurring.t r USING (k)
	WHERE n.total < 3
)
TABLE t;

WITH RECURSIVE r(i, s, dom) AS (
	SELECT 0::BIGINT, 0::BIGINT, (SELECT list(x) FROM range(1, 3001) t(x))
	UNION ALL
	SELECT i + 1, s + list_extract(dom, i + 1), dom FROM r WHERE i < 40
)
SELECT count(*), max(s), bool_and(len(dom) = 3000 AND list_sum(dom) = 4501500) FROM r;

SET max_execution_time=30000;

WITH RECURSIVE r(i, s, dom) AS (
	SELECT 0::BIGINT, 0::BIGINT, (SELECT list(x) FROM range(1, 10001) t(x))
	UNION ALL
	SELECT i + 1, s + dom[i + 1], dom FROM r WHERE i < 100
)
SELECT max(s), bool_and(list_sum(dom) = 50005000) FROM r;

SELECT count(*) FROM (
	WITH RECURSIVE t(i) AS (
		SELECT 0
		UNION ALL
		SELECT i + 1 FROM t
	)
	SELECT i FROM t LIMIT 2048
);

SELECT info.frontier_rows::UBIGINT = 4,
       info.frontier_chunks::UBIGINT = 2,
       info.scheduler_input_rows::UBIGINT = 8
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'RuntimeMetrics';

SELECT count(*) FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'RuntimeMetrics';

SELECT info.distinct_grouping_work_ns::UBIGINT > 0,
       info.distinct_candidate_rows::UBIGINT = 7,
       info.distinct_inserted_rows::UBIGINT = 4,
       info.distinct_duplicate_rows::UBIGINT = 3
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

WITH RECURSIVE t(i, digest, level) AS (
	SELECT i, md5(i::VARCHAR), 0
	FROM range(current_setting('standard_vector_size')::BIGINT * 2) values(i)
	UNION ALL
	(
		WITH state AS MATERIALIZED (
			SELECT i, md5(md5(md5(digest))) AS digest, level + 1 AS level
			FROM t
			WHERE level < 3
		)
		SELECT * FROM state WHERE i % 6 = 0
		UNION ALL
		SELECT * FROM state WHERE i % 6 = 1
		UNION ALL
		SELECT * FROM state WHERE i % 6 = 2
		UNION ALL
		SELECT * FROM state WHERE i % 6 = 3
		UNION ALL
		SELECT * FROM state WHERE i % 6 = 4
		UNION ALL
		SELECT * FROM state WHERE i % 6 = 5
	)
)
SELECT count(*) = current_setting('standard_vector_size')::BIGINT * 8,
       max(level),
       sum(length(digest)) = current_setting('standard_vector_size')::BIGINT * 8 * 32
FROM t;

SELECT info.direct_probe_lookup_work_ns::UBIGINT > 0,
       info.direct_probe_key_gather_work_ns::UBIGINT > 0,
       info.direct_probe_payload_finalize_work_ns::UBIGINT > 0,
       info.keyed_hash_commit_work_ns::UBIGINT > 0,
       info.partial_index_maintenance_work_ns::UBIGINT = 0,
       info.recurring_scan_work_ns::UBIGINT = 0,
       info.final_state_drain_work_ns::UBIGINT > 0
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

SELECT info.scheduled_workers::UBIGINT = info.epochs::UBIGINT + 7,
       info.recurring_scan_rows::UBIGINT = 0
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'RuntimeMetrics';

SELECT info.direct_probe_lookup_work_ns::UBIGINT = 0,
       info.direct_probe_key_gather_work_ns::UBIGINT = 0,
       info.direct_probe_payload_finalize_work_ns::UBIGINT = 0
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

SELECT info.key_preaggregation_classification_work_ns::UBIGINT > 0,
	   info.key_preaggregation_combine_work_ns::UBIGINT > 0,
	   info.local_key_preaggregation_classification_work_ns::UBIGINT > 0,
	   info.local_key_preaggregation_work_ns::UBIGINT > 0,
	   info.local_key_preaggregation_candidate_rows::UBIGINT > 0,
	   info.local_key_preaggregation_groups::UBIGINT > 0,
	   info.local_key_preaggregation_groups::UBIGINT <= info.local_key_preaggregation_candidate_rows::UBIGINT,
	   info.local_key_preaggregation_states::UBIGINT > 0,
	   info.local_key_preaggregation_residual_rows::UBIGINT > 0,
	   info.local_key_preaggregation_candidate_rows::UBIGINT +
	       info.local_key_preaggregation_residual_rows::UBIGINT = info.key_delta_candidate_rows::UBIGINT,
	   info.key_preaggregation_candidate_rows::UBIGINT <= info.local_key_preaggregation_residual_rows::UBIGINT,
	   info.key_delta_candidate_rows::UBIGINT = current_setting('standard_vector_size')::UBIGINT * 32,
	   info.key_delta_touched_keys::UBIGINT = current_setting('standard_vector_size')::UBIGINT * 4
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'EpochSummary';

WITH RECURSIVE r(n) AS (
  SELECT 1
  UNION ALL
  (SELECT n+1 FROM r WHERE n < 3 UNION ALL SELECT n+1 FROM r WHERE n < 3 LIMIT 1)
)
SELECT n FROM r ORDER BY n;

WITH RECURSIVE r(n) AS (
  SELECT 1
  UNION ALL
  (SELECT n+1 FROM r WHERE n < 5 UNION SELECT n+1 FROM r WHERE n < 5 LIMIT 1)
)
SELECT n FROM r ORDER BY n;

EXECUTE recursive_sorted_aggregate;

WITH RECURSIVE r(iter, v) AS (
	SELECT 0, i FROM range(8) t(i)
	UNION ALL
	SELECT iter + 1, (v + 1) % 8
	FROM (SELECT iter, v, row_number() OVER () AS rn FROM (SELECT iter, v FROM r WHERE iter < 6 ORDER BY v DESC) o) s
	WHERE rn <= 4
)
SELECT iter, list(v ORDER BY v) FROM r GROUP BY iter ORDER BY iter;

SELECT count(*)
FROM duckdb_logs_parsed('PhysicalOperator')
WHERE class = 'PhysicalRecursiveCTE' AND event = 'RuntimeMetrics'
  AND info.epochs::UBIGINT = 4
  AND info.scheduled_workers::UBIGINT > info.epochs::UBIGINT
  AND info.scheduled_tasks::UBIGINT >= info.scheduled_workers::UBIGINT;

WITH RECURSIVE t(i) AS (
	VALUES (0::BIGINT)
	UNION ALL
	SELECT i + 1 FROM t WHERE i < 4999
)
SELECT count(*) FROM t;

WITH RECURSIVE t(i, level) AS (
	SELECT * FROM (VALUES (NULL::INTEGER, 0), (NULL, 0), (1, 0), (1, 0))
	UNION
	SELECT i, level + 1 FROM t WHERE level < 2
)
SELECT i, level FROM t;

EXECUTE q1;

INSERT INTO lookup VALUES (1, 10), (2, 20), (3, 30), (4, 40);

CREATE TABLE replay_seed(k INTEGER);

PREPARE keyed_replay_all AS
WITH RECURSIVE r(k, v) USING KEY (k) AS (
    SELECT k, 0 FROM replay_seed
    UNION ALL
    SELECT w.k, s.v + 1
    FROM r w JOIN recurring.r s USING (k)
    WHERE s.v < 2
)
SELECT k, v FROM r ORDER BY k;

CREATE TABLE e(src INTEGER, dst INTEGER);

CREATE TABLE q AS SELECT 1 AS n;

CREATE TABLE free AS SELECT i AS ofs FROM range(100) t(i);

WITH RECURSIVE t(i) AS (
	SELECT 1::BIGINT
	UNION ALL
	(WITH tmp AS (SELECT * FROM t),
	      marked AS (SELECT f.ofs, (f.ofs, 0) > ANY (SELECT i, 0 FROM tmp) AS above FROM free f),
	      nextfree AS (SELECT min(ofs) FILTER (WHERE above) AS nf, count(*) FILTER (WHERE above IS NULL) AS unknown
	                   FROM marked)
	 SELECT nf FROM nextfree WHERE nf < 10)
) SELECT count(*), max(i) FROM t;

WITH RECURSIVE r(n) AS (
    SELECT 1 FROM range(5000)
    UNION ALL
    (SELECT pm.v FROM (
        SELECT s.x AS m FROM arm_filter s JOIN r ON s.x = r.n + 1 WHERE r.n < 4
        UNION ALL
        SELECT s.x AS m FROM arm_filter s JOIN r ON s.x = r.n + 1 WHERE r.n < 4
     ) arms JOIN probe_map pm ON pm.m = arms.m)
)
SELECT count(*) FROM r;

with parents_tab (id , value , parent )
as (values (1, 1, 2), (2, 2, 4), (3, 1, 4), (4, 2, -1), (5, 1, 2), (6, 2, 7), (7, 1, -1)
),
parents_tab2(id , value , parent )
as (values (1, 1, 2), (2, 2, 4), (3, 1, 4), (4, 2, -1), (5, 1, 2), (6, 2, 7), (7, 1, -1)
),
parents as (
    select * from parents_tab
    union all
    select id, value+2, parent from parents_tab2
)
select * from parents ORDER BY id, value, parent;

CREATE TABLE nodes (node int);

WITH my_list(value) AS (VALUES (1), (2), (3))
    SELECT * FROM my_list LIMIT 0 OFFSET 1;

with cte1 as (Select i as j from a), cte2 as (select ref.j as k from cte1 as ref), cte3 as (select ref2.j+1 as i from cte1 as ref2) select * from cte2 , cte3;

create view va AS (with cte as (Select i as j from a) select * from cte);

WITH RECURSIVE cte(d) AS (
		SELECT 1
	UNION ALL
		(WITH c(d) AS (SELECT * FROM cte)
			SELECT d + 1
			FROM c
			WHERE FALSE
		)
)
SELECT max(d) FROM cte;

WITH RECURSIVE
  t(b) AS MATERIALIZED (
    (WITH helper(c) AS (
      SELECT 5
    )
    SELECT * FROM helper h
    UNION
    SELECT 7
    )
  )
SELECT * FROM t ORDER BY b;

with cte1 as (Select i as j from a) select * from (with cte2 as (select max(j) as j from cte1) select * from cte2) f;

create or replace table orders(ordered_at int);

CREATE VIEW union_view AS
SELECT 0 i
UNION ALL
SELECT 1
UNION ALL
SELECT 2
UNION ALL
SELECT 3
UNION ALL
SELECT 4
UNION ALL
SELECT 5
UNION ALL
SELECT 6
UNION ALL
SELECT 7
UNION ALL
SELECT 8
UNION ALL
SELECT 9
UNION ALL
SELECT 10
UNION ALL
SELECT 11
UNION ALL
SELECT 12
UNION ALL
SELECT 13
UNION ALL
SELECT 14
UNION ALL
SELECT 15
UNION ALL
SELECT 16
UNION ALL
SELECT 17
UNION ALL
SELECT 18
UNION ALL
SELECT 19
UNION ALL
SELECT 20
UNION ALL
SELECT 21
UNION ALL
SELECT 22
UNION ALL
SELECT 23
UNION ALL
SELECT 24
UNION ALL
SELECT 25
UNION ALL
SELECT 26
UNION ALL
SELECT 27
UNION ALL
SELECT 28
UNION ALL
SELECT 29
UNION ALL
SELECT 30
UNION ALL
SELECT 31
UNION ALL
SELECT 32
UNION ALL
SELECT 33
UNION ALL
SELECT 34
UNION ALL
SELECT 35
UNION ALL
SELECT 36
UNION ALL
SELECT 37
UNION ALL
SELECT 38
UNION ALL
SELECT 39
UNION ALL
SELECT 40
UNION ALL
SELECT 41
UNION ALL
SELECT 42
UNION ALL
SELECT 43
UNION ALL
SELECT 44
UNION ALL
SELECT 45
UNION ALL
SELECT 46
UNION ALL
SELECT 47
UNION ALL
SELECT 48
UNION ALL
SELECT 49;

WITH RECURSIVE t(x) AS
(
  SELECT 1
    UNION ALL
  SELECT x + 1
  FROM   (SELECT t.x+1 FROM v AS _(p) FULL OUTER JOIN t ON t.x <= p) AS _(x)
  WHERE  x < 10
) SELECT * FROM v AS _(p) RIGHT OUTER JOIN t ON t.x = p ORDER BY p, t NULLS LAST;

WITH RECURSIVE t(x) AS
(
  SELECT 1
    UNION ALL
  SELECT t.x + 1
  FROM   (VALUES (NULL::INTEGER)) AS v(p) RIGHT OUTER JOIN t ON t.x <= p
  WHERE  t.x < 3
) SELECT * FROM t ORDER BY x;

WITH RECURSIVE ctename AS (
      SELECT empno, ename,
             0 AS level
      FROM emp
      WHERE empno = 7566
   UNION ALL
      SELECT emp.empno, emp.ename,
             ctename.level + 1
      FROM emp
         JOIN ctename ON emp.mgr = ctename.empno
)
SELECT * FROM ctename;

with recursive t(x) as (select 1 union select x+1 from t where x < 3) select * from t order by x;

with recursive t as (select 1 as x union select m.x+f.x from t as m, t as f where m.x < 3) select * from t order by x;

with recursive t as (select 1 as x union all select * from (select 1) tbl2(i) join (select x from t where x < 5) tbl(i) using (i)) select * from t limit 3;

with recursive t as (select (select min(x) from integers) as x union select x+1 from t where x < 3) select * from t order by x;

with recursive t as (select 1 as x union all select m.x+f.x from t as m, t as f where m.x < 3) select * from t;

with recursive t as (select (select min(x) from integers) as x union all select x+1 from t where x < 3) select * from t;

WITH RECURSIVE r(k,v) USING KEY(k,max(v)) AS (VALUES(1,10) UNION ALL SELECT k+1,v+1 FROM r WHERE k<3) SELECT * FROM r ORDER BY k;
