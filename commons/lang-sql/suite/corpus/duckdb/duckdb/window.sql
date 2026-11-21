CREATE TABLE tile_input(id INTEGER PRIMARY KEY);

RESET debug_verify_vector;

SELECT count(*) FROM (
    SELECT i, count(*) OVER (ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS n
    FROM collection_input
) t WHERE n IS DISTINCT FROM i + 1;

SELECT count(*) FROM (
    SELECT i, min(i, (i // 2053) % 3 + 1) OVER (PARTITION BY i // 2053 ORDER BY i) AS actual
    FROM range(131392) t(i)
) t
WHERE actual IS DISTINCT FROM list_transform(range(least((i // 2053) % 3 + 1, i % 2053 + 1)), lambda x: (i // 2053) * 2053 + x);

SELECT depname, empno, salary, sum(salary) OVER (PARTITION BY depname ORDER BY empno) FROM empsalary ORDER BY depname, empno;

SELECT depname, empno,
	last_value(empno) OVER (
		PARTITION BY depname ORDER BY empno ASC
		ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
		) fv
FROM empsalary
ORDER BY 1, 2;

SELECT depname, STDDEV_POP(salary) OVER (PARTITION BY depname ORDER BY salary, empno) s FROM empsalary ORDER BY depname, empno;

WITH t AS (
	SELECT i, i % 5 AS p
	FROM range(1000) tbl(i)
), w AS (
	SELECT i, p, row_number() OVER (PARTITION BY p ORDER BY i DESC) AS rn
	FROM t
), g AS (
	SELECT p, max(i) AS max_i
	FROM t
	GROUP BY p
)
SELECT count(*)
FROM w
JOIN g USING (p)
WHERE rn = 1 AND i = max_i;

SELECT sum(unique1) over (order by unique1 rows between 2 preceding and 1 preceding) su FROM tenk1 order by unique1;

create table issue1472 (permno real, date date, ret real);

select avg(a) over (
    order by b asc
    rows between mod(b * 1023, 11) preceding and 23 - mod(b * 1023, 11) following)
from issue1697;

SELECT 
	i,
	(i * 29) % 11 AS outside,
	i // 2 AS inside,
	cume_dist(ORDER BY inside DESC) OVER w AS cd,
FROM range(10) tbl(i)
WINDOW w AS (
	ORDER BY outside
)
ORDER BY inside DESC, i;

WITH t AS (
	SELECT i, DENSE_RANK() OVER (ORDER BY i % 50) AS d
	FROM range(3000) tbl(i)
), w AS (
	SELECT d, COUNT(*) as c
	FROM t
	GROUP BY ALL
)
SELECT COUNT(*), MIN(d), MAX(d), MIN(c), MAX(c)
FROM w;

WITH dups AS (
  SELECT ROW_NUMBER() OVER same_idx AS dup
  , COUNT(*) OVER same_idx AS n_dup
  , (DENSE_RANK() OVER asc_spcmn) + (DENSE_RANK() OVER desc_spcmn) - 1 AS n_spcmn
  , *
  FROM issue9416
  WINDOW same_idx AS (
    PARTITION BY idx
    ORDER BY source, project, specimen
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  )
  , asc_spcmn AS (
    PARTITION BY idx
    ORDER BY specimen ASC NULLS FIRST
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  )
  , desc_spcmn AS (
    PARTITION BY idx
    ORDER BY specimen DESC NULLS LAST
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  )
)
SELECT *
FROM dups
WHERE n_spcmn > 1
ORDER BY idx, dup;

CREATE TABLE a(i INT);

INSERT INTO src VALUES (1, 1, 10), (1, 2, 20);

SELECT
	MAX(v) OVER (PARTITION BY a),
	SUM(v) OVER (PARTITION BY a, a)
FROM src
ORDER BY b;

SELECT
	SUM(v) OVER (PARTITION BY a, a, b) AS w_aab,
	SUM(v) OVER (PARTITION BY a, a, a) AS w_aaa
FROM src
ORDER BY b;

INSERT INTO t1 VALUES (NULL, 'B');

SELECT id, ntile(2 ORDER BY id) OVER (ORDER BY ch ROWS BETWEEN 3 FOLLOWING AND 1 FOLLOWING)
FROM t1
ORDER BY 1;

SELECT id, string_agg(id, ' ') OVER (PARTITION BY ch ORDER BY id ROWS BETWEEN 1 FOLLOWING AND 2 FOLLOWING) 
FROM t1
ORDER BY 1;

SELECT empno, sum(salary*2) OVER (PARTITION BY depname ORDER BY empno) FROM empsalary ORDER BY depname, empno;

SELECT * 
FROM empty_unsorted 
WHERE(NOT(false = ANY([]))) 
ORDER BY(~((SUM(true) OVER() - SUM(true) OVER())::INT)) ASC;

SELECT k, fill(v) OVER (ORDER BY k) FROM (VALUES (0, 0::DECIMAL(9,9)), (1, 0.9::DECIMAL(9,9)), (2, NULL)) t(k, v) ORDER BY k;

CREATE TABLE tms AS SELECT k, fill(v) OVER (ORDER BY k) f FROM (VALUES (0, '200000-01-01'::TIMESTAMP_MS), (1, '290000-01-01'::TIMESTAMP_MS), (3, NULL)) t(k, v);

SELECT k, fill(v) OVER (ORDER BY k) FROM (VALUES (0, TIME '01:00:00'), (1, NULL), (2, TIME '03:00:00'), (3, NULL)) t(k, v) ORDER BY k;

with null_chunk as (
	select 
		1 as p, 
		s,
		NULL::DOUBLE as v,
	from range(2050) tbl(s)
	union all
	select
		2 as p, 
		s,
		s::DOUBLE as v,
	from range(16) tbl(s)
)
select 
	p, 
	s, 
	fill(v order by -s) over(partition by p order by s) as f,
from null_chunk;

with source as (
	select 
		i, 
		(i + 1) * 3 % 5 as permuted,
		if(permuted = 4, NULL, permuted) as missing
	from (
		from range(5) tbl(i)
		union all 
		select NULL::INTEGER as i
	) t(i)
)
select
	i,
	permuted,
	fill(missing order by permuted asc nulls last) over (order by i) as filled
from source
qualify filled is distinct from permuted;

SELECT x, y, fill(y ORDER BY x) OVER () AS filled
FROM (VALUES
    (1::BIGINT,  19::BIGINT),
    (2::BIGINT,  5::BIGINT),
    (3::BIGINT,  NULL)) t(x, y)
ORDER BY x;

SELECT i, fill(value) OVER (ORDER BY i) AS filled
FROM (VALUES (0, NULL::INTEGER), (1, 1), (2, NULL::INTEGER)) t(i, value)
ORDER BY i;

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

select count(a) over ia, count(*) over ia
from t
window ia as (rows between current row and current row exclude current row);

select percent_rank() over ia
from t
window ia as (rows between current row and current row exclude current row);

select count(a) over ia, count(*) over ia, count(case when p = 0 then a end) over ia
from t
window ia as (rows between current row and current row);

INSERT INTO p VALUES (3, 'c', 1), (1, 'a', 2), (2, NULL, 1), (5, 'a', NULL), (4, 'b', 2);

EXPLAIN
SELECT id, payload, MIN(payload) OVER iv
FROM p
WINDOW iv AS (PARTITION BY payload, id ORDER BY grp);

EXPLAIN
SELECT id, payload, MIN(payload) OVER iv
FROM p
WINDOW iv AS (
	PARTITION BY id 
	ORDER BY grp 
	ROWS BETWEEN UNBOUNDED PRECEDING 
	AND UNBOUNDED FOLLOWING 
	EXCLUDE CURRENT ROW);

SELECT
  id,
  user_id,
  order_id,
  LAST_VALUE (order_id IGNORE NULLS) over (
    PARTITION BY user_id
    ORDER BY id
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS last_order_id
FROM issue2549
ORDER BY ALL;

SELECT
  id,
  user_id,
  order_id,
  LAG(order_id, 1, -1 IGNORE NULLS) over (
    PARTITION BY user_id
    ORDER BY id
  ) AS last_order_id
FROM issue2549
ORDER BY ALL;

SELECT
  id,
  user_id,
  order_id,
  NTH_VALUE (order_id, 2 RESPECT NULLS) over (
    PARTITION BY user_id
    ORDER BY id
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS last_order_id
FROM issue2549
ORDER BY ALL;

CREATE TABLE IF NOT EXISTS issue6635(index INTEGER, data INTEGER);

SELECT 
	v, 
	lead(v) OVER (ORDER BY id), 
	lead(v IGNORE NULLS) OVER (ORDER BY id) 
FROM (VALUES 
	(1, 1), 
	(2, NULL), 
	(3, 2), 
	(4, NULL), 
	(5, 3), 
	(6, NULL)
) tbl(id, v);

SELECT count(x), count(*) FILTER (x IS DISTINCT FROM m) FROM (
    SELECT last(CASE WHEN i % 1000 != 3 THEN i END ORDER BY i DESC IGNORE NULLS)
           OVER (PARTITION BY i % 2 ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) x,
           min(CASE WHEN i % 1000 != 3 THEN i END)
           OVER (PARTITION BY i % 2 ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) m
    FROM range(1, 100000) t(i));

select c1, lead("default" := 1337, col := c1) over (order by c0 rows between 2 preceding and 4 preceding) as b
from (values
	(1, 2),
	(2, 3),
	(3, 4),
	(4, 5)
) a(c0, c1);

CREATE TABLE issue14398 (date DATE, "group" INT, count INT, status STRING);

INSERT INTO issue17266 VALUES
(0, null, null),
(1, 32767, '101'),
(2, -32767, '101'),
(3, 0, '000'),
(4, null, null);

SELECT 
	i,
	i // 2 AS inside,
	lead(i, 1, NULL ORDER BY i // 2, i) OVER w AS next,
	lag(i, 1, NULL ORDER BY i // 2, i) OVER w AS prev,
FROM range(10) tbl(i)
WINDOW w AS (
	ORDER BY i // 2
	ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING
)
ORDER BY i;

CREATE TABLE issue25699(id INTEGER, x VARCHAR);

INSERT INTO leadlag_frames VALUES (1, 'e'), (2, 'd'), (3, 'c'), (4, 'b'), (5, 'a');

CREATE TABLE list_extract_test(i INTEGER, g INTEGER);

SELECT FIRST(LIST_EXTRACT(l, 1)) FROM list_window GROUP BY g ORDER BY g;

select j, s, list(s) over (partition by j order by s) 
from list_combine_test 
order by j, s;

SELECT r, r/3.0, mad(r/3.0) over (order by r rows between 1 preceding and 3 following) FROM mads ORDER BY 1, 2, 3;

SELECT r, n, mad(n) over (order by r rows between unbounded preceding and unbounded following)
FROM (SELECT r, CASE r % 2 WHEN 0 THEN r ELSE NULL END AS n FROM mads) nulls
ORDER BY 1;

create table modes as select range r from range(10) union all values (NULL), (NULL), (NULL);

SELECT r, r // 3, n, mode(n) over (partition by r % 3 order by r)
FROM (SELECT r, CASE r % 2 WHEN 0 THEN r ELSE NULL END AS n FROM modes) nulls
ORDER BY 1;

WITH t(r) AS (VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (NULL), (NULL), (NULL))
SELECT r, r//3, mode(r//3) over (order by r rows between 1 preceding and 1 following) 
FROM t 
ORDER BY ALL;

WITH t(id, x) AS (VALUES (1, 'A'), (2, 'B'), (3, 'A'), (4, 'B'), (5, 'A'))
SELECT id, MODE(x ORDER BY id) OVER (ORDER BY id ROWS BETWEEN 3 PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW)
FROM t
ORDER BY id;

SELECT count(*) FROM (
    SELECT mode(v) OVER (ORDER BY r ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS m FROM modes_str
) WHERE m NOT IN (repeat('x', 50), repeat('y', 5), repeat('z', 100));

SELECT
	 x
	,y
	,z
	,count(*) OVER (PARTITION BY y) AS plain_window
	,count(*) FILTER (WHERE x = 1) OVER (PARTITION BY y) AS x_filtered_window
	,count(*) FILTER (WHERE z = 0) OVER (PARTITION BY y) AS z_filtered_window
FROM filtering
ORDER BY y, x;

SELECT i
	, s
	, COUNT(DISTINCT s) OVER( ORDER BY i ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS c
FROM figure1
ORDER BY i;

SELECT 
	i // 10 AS p,
	i,
	LIST(DISTINCT i // 2 ORDER BY i DESC) OVER(
		PARTITION BY i // 10
		ORDER BY i
		ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING 
	) AS c
FROM range(20) tbl(i)
ORDER BY ALL;

create table tenk1d(ten int4, four int4);

SELECT four, ten, sum(ten) over (partition by four order by ten range between unbounded preceding and unbounded following) st, last_value(ten) over (partition by four order by ten range between unbounded preceding and unbounded following) lt FROM tenk1d order by four, ten;

SELECT depname, empno,
	nth_value(empno, NULL) OVER (
		PARTITION BY depname ORDER BY empno ASC
		ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
		) fv
FROM empsalary
ORDER BY 1, 2;

SELECT depname, empno,
	nth_value(empno, 2) OVER (
		PARTITION BY depname ORDER BY empno ASC
		ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
		) fv
FROM empno_nulls
ORDER BY 1, 2, 3;

CREATE TABLE Scoreboard(TeamName VARCHAR, Player VARCHAR, Score INTEGER);

INSERT INTO Scoreboard VALUES ('Mongrels', 'Burns', 1270);

INSERT INTO Scoreboard VALUES ('Simpsons', 'Bart', 2010);

SELECT
  TeamName,
  Player,
  Score,
  NTILE(1) OVER (PARTITION BY TeamName ORDER BY Score ASC) AS NTILE
FROM ScoreBoard s
ORDER BY TeamName, Score;

CREATE TABLE retained AS
SELECT p, j, list(s) OVER w AS items, string_agg(s, '|') OVER w AS joined,
       row_number() OVER w AS rn, count(*) OVER w AS n
FROM cleanup_input
WINDOW w AS (PARTITION BY p ORDER BY j ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)
ORDER BY p, j;

SELECT count(*) FROM (
    SELECT row_number() OVER (PARTITION BY p ORDER BY j) AS rn FROM cleanup_input
) t WHERE rn = 1;

CREATE TABLE skip_strings AS
SELECT i, 'payload_' || lpad(CAST(i AS VARCHAR), 8, '0') AS v
FROM range(50000) t(i);

RESET threads;

SELECT r, median(r) over (order by r rows between 1 preceding and 3 following) FROM quantiles ORDER BY 1, 2;

SELECT r, quantile(r::VARCHAR, 0.5) over (order by r rows between 1 preceding and 3 following) FROM quantiles ORDER BY 1, 2;

SELECT r, n, median(n) over (order by r rows between 1 preceding and 3 following)
FROM (SELECT r, CASE r % 2 WHEN 0 THEN r ELSE NULL END AS n FROM quantiles) nulls
ORDER BY 1;

WITH t(r, i, p, f) AS (VALUES
	(0, 0, 1, 2),
	(1, 1, 1, 2),
	(2, 2, 1, 2),
	(3, 3, 1, 2),
	(4, 4, 1, 2),
	(5, 5, 1, 2)
)
SELECT r, QUANTILE_DISC(i, [0.25, 0.5, 0.75]) OVER (ORDER BY r ROWS BETWEEN p PRECEDING and f FOLLOWING)
FROM t
ORDER BY 1;

WITH t(r, i, p, f) AS (VALUES
	(0, 0, 1, 2),
	(1, 1, 1, 2),
	(2, 2, 1, 2),
	(3, 0, 1, 2),
	(4, 1, 1, 2),
	(5, 2, 1, 2)
)
SELECT r, QUANTILE_CONT(i, [0.25, 0.5, 0.75]) OVER (ORDER BY r ROWS BETWEEN p PRECEDING and f FOLLOWING)
FROM t
ORDER BY 1;

WITH t(r, i, p, f) AS (VALUES
	(0, 0, 1, 1),
	(1, 1, 1, 1),
	(2, 2, 1, 1),
	(3, 0, 1, 1),
	(4, 1, 1, 1),
	(5, 2, 1, 1)
)
SELECT r, QUANTILE_DISC(i, 0.5) OVER (ORDER BY r ROWS BETWEEN p PRECEDING and f FOLLOWING)
FROM t
ORDER BY 1;

WITH t AS (
	SELECT i, RANK() OVER (ORDER BY i % 50) AS d
	FROM range(3000) tbl(i)
), w AS (
	SELECT d, COUNT(*) as c
	FROM t
	GROUP BY ALL
)
SELECT COUNT(*), MIN(d), MAX(d), MIN(c), MAX(c)
FROM w;

WITH ranked AS (
	SELECT 
		i,
		i // 100 AS p,
		i % 50 AS o,
		100 - 2 * (i % 50) - 1 AS expected,
		rank(ORDER BY i % 50 DESC) OVER w AS actual,
	FROM range(100_000) tbl(i)
	WINDOW w AS (
		PARTITION BY i // 100
		ORDER BY i
		ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
	)
)
SELECT *
FROM ranked
WHERE expected <> actual
ORDER BY p, o DESC
LIMIT 20;

SELECT 
	i,
	(i * 29) % 11 AS outside,
	row_number(ORDER BY (i // 2) DESC) OVER w,
	ntile(4 ORDER BY (i // 2) DESC) OVER w,
FROM range(10) tbl(i)
WINDOW w AS (
	ORDER BY (i * 29) % 11
)
ORDER BY 2;

create table partsupp as select uuid()::varchar as c5 from range(8000);

EXPLAIN
SELECT i, LAG(i, -1) OVER() AS i1
FROM range(10) tbl(i);

EXPLAIN
SELECT i, LEAD(i, 1) OVER() AS i1
FROM range(10) tbl(i);

EXPLAIN
SELECT i, LAG(i, 1, 50) OVER() AS i1
FROM range(10) tbl(i);

EXPLAIN
SELECT i, LEAD(i, 2) OVER() AS i1
FROM range(3000) tbl(i)
WHERE i % 2048 = 0;

EXPLAIN
SELECT i, LAG(i, 3000) OVER() AS i1
FROM range(5000) tbl(i);

SELECT LAG ( v3 , 10 , 3 ) OVER( ) 
FROM VALUES 
	( 0 , 1::VARCHAR , 1 ),
	( 1 , NULL , 2 )
	AS v0(v1, v3, v2);

CREATE TABLE ints(i INTEGER);

SELECT lag(i, 1 // 0) OVER () FROM ints WHERE i > 10;

explain select nth_value(i, -1) over (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) 
from range(5) tbl(i);

select i, nth_value(i, 2049) over(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) n
from range(2049) tbl(i)
QUALIFY n IS NOT NULL;

insert into integers values (2, 2), (2, 1), (1, 2), (1, NULL);

EXPLAIN
SELECT j, COUNT(*) FILTER(WHERE i = 2) OVER(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM integers;

explain select row_number() over (), i, j from integers where i>1;

explain select dense_rank() over (), i, j from integers;

EXPLAIN
SELECT i, COUNT(*) OVER(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM integers;

EXPLAIN
SELECT j, COUNT(j) OVER(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM integers;

EXPLAIN
SELECT SUM(s) FROM (
	SELECT SUM(i) OVER(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) s
	FROM range(5000) tbl(i)
);

select i, j, first_value(i) over (), first_value(j) over () from integers;

EXPLAIN
SELECT first_value(i) OVER (GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
FROM integers;

EXPLAIN
SELECT first_value(i) OVER (RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
FROM integers;

SELECT i, first_value(i) OVER (RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
FROM integers;

explain select first_value(i IGNORE NULLS) over (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) 
from integers;

SELECT s,
	last(s IGNORE NULLS) over(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
FROM (VALUES (NULL), ('A'), (NULL), ('B')) t(s);

WITH alternate AS (
	SELECT 
		range r,
		IF(range < 2100, NULL, range) s
	FROM range(3000)
)
SELECT 
	r,
	s,
	first(s IGNORE NULLS) over(ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) f
FROM alternate
QUALIFY (f IS NOT NULL AND r < 2100)
     OR (f IS NULL AND r >= 2100);

explain select last_value(i) over (order by j), first_value(i) over () from integers;

INSERT INTO v2 VALUES (21),  (22);

PREPARE sw1 AS
	SELECT i, row_number() OVER() AS row_no
	FROM range(10, 20) tbl(i)
	QUALIFY row_no <= ?::BIGINT;

from (values ([1]::INT[1]), ([2]::INT[1]), ([3]::INT[1]))
select
   list(col0) over (rows between unbounded preceding and current row) as result;

WITH start_and_inputs AS (
    SELECT 50 AS moves
    UNION ALL
    SELECT 50 AS moves
)
SELECT moves, sum(moves) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS sum
FROM start_and_inputs;

WITH w AS (
	SELECT i, LAST_VALUE(CASE WHEN i = 2048 THEN i END IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(2051) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, FIRST_VALUE(CASE WHEN i = 2048 THEN i END IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(4096) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, NTH_VALUE(CASE WHEN i = 2048 THEN i END, 1 IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(4096) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, LAST_VALUE(CASE WHEN i = 2048 THEN i END IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(6144) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, FIRST_VALUE(CASE WHEN i < 2048 THEN NULL WHEN i % 2 = 0 THEN i ELSE -i END IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(2051) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, NTH_VALUE(CASE WHEN i < 2048 THEN 42 WHEN i % 2 = 0 THEN i ELSE -i END, 2049 IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(2051) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS DISTINCT FROM CASE WHEN i >= 2048 THEN 2048 END) FROM w;

WITH w AS (
	SELECT i, NTH_VALUE(CASE WHEN i = 2048 THEN i END, 99999 IGNORE NULLS) OVER (
		ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
	FROM range(2051) AS r(i)
)
SELECT COUNT(*), COUNT(*) FILTER (WHERE x IS NOT NULL) FROM w;

SELECT i,
	SUM(DISTINCT i % 3) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
FROM range(10) tbl(i);

SELECT i,
	SUM(DISTINCT i % 5) FILTER (i % 3 = 0) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
FROM range(20) tbl(i);

SELECT item, rank() OVER (ORDER BY return_ratio) AS return_rank, rank() OVER (ORDER BY currency_ratio) AS currency_rank FROM wintest order by item;

with IDS as (
    select * as idx from generate_series(1,4)
),DATA as (
    select *, (case when idx != 3 then idx * 1.0 else NULL end) as value from IDS
)
SELECT 
 last(value ORDER BY idx IGNORE NULLS) OVER (ORDER BY idx ROWS BETWEEN UNBOUNDED PRECEDING AND 0 FOLLOWING)
FROM DATA;

SELECT first_value(value_col ORDER BY order_col IGNORE NULLS) over (PARTITION BY partition_col) 
FROM all_nulls;

WITH t(a, q) AS (
  VALUES
    (1, NULL),
    (2, 0)
)
SELECT
  a,
  q,
  FIRST_VALUE(q ORDER BY 1 IGNORE NULLS) OVER (
    PARTITION BY q, a
  ) AS actual
FROM t
ORDER BY a;

SELECT rank(ORDER BY i DESC) OVER w AS crash
FROM range(5_000) tbl(i)
WINDOW w AS (ORDER BY i ASC);

SELECT id, BITSTRING_AGG(id) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::VARCHAR AS w
FROM bt
ORDER BY id;

SELECT id, COUNT(id) OVER () FROM cnt ORDER BY id;

CREATE MACRO tinyint_min(a) as cast(min(a) as tinyint);

SELECT DISTINCT tinyint_min(x) OVER (), max_plus_one(x) OVER () FROM test;

select i, lag(i) over named_window from (values (1), (2), (3)) as t (i) window named_window as (order by i);

select * from v1;

create table a as select range%2==0 j, range::integer AS i from range(1, 5, 1);

drop table a;

select j, i, bool_and(not i) over (partition by j order by i), bool_and(i) over (partition by j order by i), bool_or(i) over (partition by j order by i) from a order by 1,2;

SELECT sum(i) over cumulativeSum 
FROM integers 
WINDOW cumulativeSum AS ();

SELECT count(*) OVER w AS x
FROM (VALUES (1), (2)) AS t(a)
WINDOW base AS (ORDER BY a), w AS (base GROUPS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
ORDER BY a;

SELECT count(*) FROM (SELECT * FROM range(3) WHERE (SELECT true) WINDOW w AS () QUALIFY sum(1) OVER w > 0);

SELECT (SELECT sum(i) OVER w FROM range(3) t(i) WINDOW w AS () LIMIT 1), sum(j) OVER w
FROM range(2) t(j)
WINDOW w AS (ORDER BY j ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
ORDER BY 2;

SELECT part, min(const) AS lo, max(const) AS hi
FROM (
	SELECT part, sum(val) OVER(PARTITION BY part) AS const
	FROM (
		SELECT part, val
		FROM (
			(SELECT range as part, random() AS val FROM range(10)) r
		CROSS JOIN 
			range(3000)
		) p
	) t
) w
GROUP BY ALL
HAVING lo <> hi
ORDER BY ALL;

SELECT *, max(Ct) FILTER (WHERE Depth=1) OVER (PARTITION BY Season) as value_depth1 
from issue7353
order by all;

with repro2 AS (
	SELECT range // 59 AS id, random() AS value
	FROM range(1475)
), X AS (
	SELECT
		list(value) OVER (
			PARTITION BY id 
			ORDER BY value 
			ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
			) AS values
	FROM repro2
)
select count(*) 
from X 
where values[1] != list_aggregate(values, 'min');

EXPLAIN FROM cse;

INSERT INTO dbplyr_052 VALUES (1,1, 42),(2,1, 42),(3,1, 42),(2,2, 42),(3,2, 42),(4,2, 42);

CREATE TABLE t(i INTEGER, peer INTEGER, v INTEGER);

SELECT i,
	first_value(v ORDER BY i) OVER wg,
	sum(v) OVER wg,
	count(*) OVER wg,
	last_value(v) OVER wc,
	sum(v) OVER wc,
	count(v) OVER wc
FROM t
WINDOW wg AS (ORDER BY peer ROWS BETWEEN CURRENT ROW AND CURRENT ROW EXCLUDE GROUP),
	wc AS (ORDER BY peer ROWS BETWEEN CURRENT ROW AND CURRENT ROW EXCLUDE CURRENT ROW)
ORDER BY i;

BEGIN;

WITH src(c) AS (
	SELECT range % 2
	FROM range(33)
)
SELECT LIST(DISTINCT c ORDER BY c) OVER (
	ORDER BY c
	ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
) AS window_list
FROM src
LIMIT 1;

SELECT i
	, s
	, i // 2 AS o
	, COUNT(DISTINCT s) OVER(
		ORDER BY i // 2
		ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING 
		EXCLUDE TIES
	) AS c
FROM figure1
ORDER BY i;

SELECT i
	, n
	, COUNT(DISTINCT n) OVER( ORDER BY i, s NULLS LAST ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS c
FROM nested
ORDER BY i, s NULLS LAST;

SELECT i
	, s
	, MEDIAN(DISTINCT s) OVER( ORDER BY i, s NULLS LAST ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS c
FROM nested
ORDER BY i, s NULLS LAST;

SELECT count(x) FROM (
    SELECT histogram(i) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE CURRENT ROW) x
    FROM range(3) t(i)
);

SELECT
	 x
	,y
	,z
	,avg(x) OVER (PARTITION BY y) AS plain_window
	,avg(x) FILTER (WHERE x = 1) OVER (PARTITION BY y) AS x_filtered_window
	,avg(x) FILTER (WHERE z = 0) OVER (PARTITION BY y) AS z_filtered_window
FROM testing
ORDER BY y, x;

SELECT count(*) FROM (
    SELECT count(*) FILTER (WHERE keep) OVER w AS counted,
           sum(CASE WHEN keep THEN 1 ELSE 0 END) OVER w AS summed
    FROM counted WINDOW w AS (ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
) WHERE counted IS DISTINCT FROM summed;

SELECT DISTINCT
    count(*) OVER (ORDER BY i ROWS BETWEEN 2 PRECEDING AND 3 PRECEDING),
    count(*) FILTER (WHERE keep) OVER (ORDER BY i ROWS BETWEEN 2 PRECEDING AND 3 PRECEDING)
FROM counted;

create table lineitem (
    l_extendedprice decimal(15,2),
    l_partkey integer,
    l_orderkey integer
);

select 
	l_extendedprice, 
	l_partkey, 
	l_orderkey, 
	sum(l_extendedprice) over(order by l_partkey, l_orderkey), 
from lineitem 
order by l_partkey, l_orderkey, l_extendedprice desc;

select 
	l_extendedprice, 
	l_partkey, 
	l_orderkey, 
	sum(l_extendedprice) over(partition by l_partkey order by l_orderkey),
from lineitem 
order by l_partkey, l_orderkey, l_extendedprice desc;

create table a as select case when range%2==0 then interval '1 year' else interval '2 years' end j, range::integer AS i from range(1, 5, 1);

INSERT INTO db_city VALUES
	('DuckDB', 'Amsterdam'), 
	('MonetDB','amsterdam'),
	('VectorWise', 'Amstërdam');

CREATE TABLE t0
(
    c0 BOOLEAN UNIQUE NOT NULL,
    PRIMARY KEY (c0)
);

CREATE TABLE t3(a TEXT, b TEXT, c INTEGER);

SELECT min(c) OVER win, max(c) OVER win, sum(c) OVER win FROM t3
  WINDOW win AS (
      ORDER BY c, b, a
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  EXCLUDE NO OTHERS 
    ) ORDER BY a, b, c;

SELECT row_number() OVER win 
FROM t3
  WINDOW win AS (
      ORDER BY c, b, a
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING  EXCLUDE GROUP 
    );

SELECT nth_value(c, 14) OVER win 
FROM t3
  WINDOW win AS (
      ORDER BY c, b, a
      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING  EXCLUDE TIES 
    );

INSERT INTO t1 VALUES
    (NULL, 1), (NULL, 2), (NULL, 3), (10, 4), (10, 5);

SELECT sum(b) OVER (
    ORDER BY a DESC NULLS LAST ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
  ) FROM t1 ORDER BY 1 NULLS LAST;

SELECT max(c) OVER win,
             min(c) OVER win,
             count(a) OVER win
FROM t3
    WINDOW win AS (  ORDER BY c NULLS LAST, b NULLS LAST, a NULLS LAST
        ROWS BETWEEN 6 PRECEDING AND UNBOUNDED FOLLOWING   EXCLUDE NO OTHERS  )
      ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;

SELECT max(c) OVER win,
             min(c) OVER win,
             count(a) OVER win
FROM t3
    WINDOW win AS (  ORDER BY c NULLS LAST, b NULLS LAST, a NULLS LAST
        ROWS BETWEEN 6 PRECEDING AND UNBOUNDED FOLLOWING   EXCLUDE CURRENT ROW  )
      ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;

SELECT max(c) OVER win,
             min(c) OVER win,
             count(a) OVER win
FROM t3
    WINDOW win AS (  ORDER BY c NULLS LAST, b NULLS LAST, a NULLS LAST
        ROWS BETWEEN 6 PRECEDING AND UNBOUNDED FOLLOWING   EXCLUDE GROUP  )
      ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;

SELECT max(c) OVER win,
             min(c) OVER win,
             count(a) OVER win
FROM t3
  WINDOW win AS (  ORDER BY c NULLS LAST, b NULLS LAST, a NULLS LAST
        ROWS BETWEEN 6 PRECEDING AND UNBOUNDED FOLLOWING   EXCLUDE TIES  )
      ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;

create table a as select range%3 j, range::varchar AS s, case when range%3=0 then '-' else '|' end sep from range(1, 7, 1);

INSERT INTO item VALUES ('toys', 'fisher-price', 100);

CREATE TABLE date_dim(d_year INTEGER, d_moy INTEGER, d_date_sk INTEGER);

INSERT INTO date_dim VALUES (1999, 1, 1);

SELECT SUM(i) OVER (ROWS BETWEEN (SELECT UNNEST([1])) PRECEDING AND 1 FOLLOWING) FROM tbl;

SELECT first_value(peer) OVER (
           ORDER BY peer ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE GROUP
       ), peer
FROM value_edges ORDER BY peer, i;

CREATE TABLE range_edges(i INTEGER, v INTEGER);

SELECT count(x) FROM (
    SELECT lead(i, try_cast('bad' AS BIGINT)) OVER () AS x FROM range(3) r(i)
);

SELECT count(x) FROM (
    SELECT nth_value(i, i + 1) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS x
    FROM range(3) r(i)
);

SELECT count(x) FROM (
    SELECT last_value(v ORDER BY i) OVER (
        ORDER BY peer ROWS BETWEEN CURRENT ROW AND CURRENT ROW EXCLUDE GROUP
    ) AS x
    FROM value_edges
);

insert into tenk1 values (8800,0,0,0,0,0,0,800,800,3800,8800,0,1,'MAAAAA','AAAAAA','AAAAxx'), (1891,1,1,3,1,11,91,891,1891,1891,1891,182,183,'TUAAAA','BAAAAA','HHHHxx'), (3420,2,0,0,0,0,20,420,1420,3420,3420,40,41,'OBAAAA','CAAAAA','OOOOxx'), (9850,3,0,2,0,10,50,850,1850,4850,9850,100,101,'WOAAAA','DAAAAA','VVVVxx'), (7164,4,0,0,4,4,64,164,1164,2164,7164,128,129,'OPAAAA','EAAAAA','AAAAxx'), (8009,5,1,1,9,9,9,9,9,3009,8009,18,19,'BWAAAA','FAAAAA','HHHHxx'), (5057,6,1,1,7,17,57,57,1057,57,5057,114,115,'NMAAAA','GAAAAA','OOOOxx'), (6701,7,1,1,1,1,1,701,701,1701,6701,2,3,'TXAAAA','HAAAAA','VVVVxx'), (4321,8,1,1,1,1,21,321,321,4321,4321,42,43,'FKAAAA','IAAAAA','AAAAxx'), (3043,9,1,3,3,3,43,43,1043,3043,3043,86,87,'BNAAAA','JAAAAA','HHHHxx');

SELECT rank() OVER (PARTITION BY four ORDER BY ten) AS rank_1, ten, four FROM tenk1 WHERE unique2 < 10 ORDER BY four, ten;

SELECT cast(cume_dist() OVER (PARTITION BY four ORDER BY ten)*10 as integer) FROM tenk1 WHERE  unique2 < 10 order by four, ten;

SELECT ntile(5) OVER (ORDER BY ten, four) nn FROM tenk1 ORDER BY ten, four, nn;

SELECT lag(ten, four, 0) OVER (PARTITION BY four ORDER BY ten) lt FROM tenk1 order by four, ten, lt;

SELECT COUNT(*) OVER w c, SUM(four) OVER w s, cast(AVG(ten) OVER w * 10 as integer) a, RANK() over w r, DENSE_RANK() over w dr, ROW_NUMBER() OVER w rn FROM tenk1 WINDOW w AS (rows between 1 preceding and 1 following) ORDER BY rn;

DROP TABLE window_inputs;

SELECT i, median('constant_string_payload_longer_than_twelve') OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS m
FROM range(3) t(i);

SELECT i, min('constant_string_payload_longer_than_twelve') OVER (ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS m
FROM range(3) t(i);

SELECT i, count(DISTINCT 'segment_a') OVER (ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS c
FROM range(3) t(i);

SET threads = 4;

SET memory_limit='64MB';

SELECT count(x) FROM (SELECT histogram(DISTINCT i % 7) OVER (ORDER BY i ROWS BETWEEN 100 PRECEDING AND CURRENT ROW) x FROM range(30000) r(i));

SELECT count(*) FROM window_results;

INSERT INTO mtcars VALUES ('21.0', '6', '160.0', '110', '3.90', '2.875', '17.02', '0', '1', '4', '4');

INSERT INTO mtcars VALUES ('18.1', '6', '225.0', '105', '2.76', '3.460', '20.22', '1', '0', '3', '1');

INSERT INTO mtcars VALUES ('19.2', '6', '167.6', '123', '3.92', '3.440', '18.30', '1', '0', '4', '4');

INSERT INTO mtcars VALUES ('15.2', '8', '275.8', '180', '3.07', '3.780', '18.00', '0', '0', '3', '3');

INSERT INTO mtcars VALUES ('32.4', '4', '78.7', '66', '4.08', '2.200', '19.47', '1', '1', '4', '1');

INSERT INTO mtcars VALUES ('15.5', '8', '318.0', '150', '2.76', '3.520', '16.87', '0', '0', '3', '2');

INSERT INTO mtcars VALUES ('27.3', '4', '79.0', '66', '4.08', '1.935', '18.90', '1', '1', '4', '1');

INSERT INTO mtcars VALUES ('19.7', '6', '145.0', '175', '3.62', '2.770', '15.50', '0', '1', '5', '6');

SET temp_directory = '';

SELECT sum(q)
FROM (
	SELECT mad(v) OVER (ORDER BY p, j ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS q
	FROM t
	WHERE p < 8
);

SELECT count(v) OVER (ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM (VALUES (1), (NULL)) t(v);

SELECT approx_top_k(i, 1 ORDER BY i DESC) OVER (ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM range(3) t(i);

SET memory_limit = '400MB';
