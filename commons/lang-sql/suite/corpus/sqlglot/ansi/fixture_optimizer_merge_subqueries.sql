SELECT a, b FROM (SELECT a, b FROM x);

SELECT c * 2 AS d FROM (SELECT a + b AS c FROM x);

SELECT c + d AS e FROM (SELECT a + b AS c, a AS d FROM x);

WITH cte AS (SELECT a * b AS c, a AS d FROM x) SELECT c + d AS e FROM cte;

SELECT 2 * foo AS bar FROM (SELECT CAST(b AS DOUBLE) AS foo FROM x);

SELECT c IN (FALSE) AS d FROM (SELECT a > 1 AS c FROM x);

SELECT c BETWEEN FALSE AND TRUE AS d FROM (SELECT a IS NULL AS c FROM x);

SELECT FALSE BETWEEN FALSE AND c AS d FROM (SELECT a > 1 AS c FROM x);

SELECT c IN (FALSE) AS d FROM (SELECT a > 1 AND b > 1 AS c FROM x);

SELECT c IN (FALSE) AS d FROM (SELECT a = 1 AS c FROM x);

SELECT c AND b = 1 AS d FROM (SELECT a = 1 AS c, b FROM x);

SELECT c AND b > 0 AS d FROM (SELECT a > 1 OR b > 1 AS c, b FROM x);

SELECT TRUE IN (c, FALSE) AS d FROM (SELECT a > 1 AS c FROM x);

SELECT foo * 2 AS bar FROM (SELECT (1 + 2 + 3) AS foo FROM x);

SELECT a, b FROM (SELECT a, b FROM x AS q) AS r;

SELECT a, b FROM (SELECT a, b FROM (SELECT a, b FROM x));

SELECT a, SUM(b) AS b FROM (SELECT a, b FROM x WHERE a > 1) GROUP BY a;

SELECT a, c FROM (SELECT a, b FROM x WHERE a > 1) AS x JOIN y ON x.b = y.b;

SELECT a, c FROM x JOIN (SELECT b, c FROM y) AS y ON x.b = y.b;

SELECT a, c FROM (SELECT a, c FROM x JOIN y ON x.b = y.b);

SELECT a, c FROM (SELECT q.a, q.b FROM x AS q) AS x JOIN y AS q ON x.b = q.b;

SELECT d2.c1 FROM (SELECT a AS c1 FROM x AS x) AS d2 ANTI JOIN x AS x ON c1 >= 0;

SELECT x.a, q.c FROM (SELECT a, x.b FROM x JOIN y AS q ON x.b = q.b) AS x JOIN y AS q ON x.b = q.b;

SELECT x.a, q.c, r.c FROM (SELECT q.a, r.b FROM x AS q JOIN y AS r ON q.b = r.b) AS x JOIN y AS q ON x.b = q.b JOIN y AS r ON x.b = r.b ORDER BY x.a, q.c, r.c;

SELECT r.b FROM (SELECT b FROM x AS x) AS q JOIN (SELECT b FROM x) AS r ON q.b = r.b;

SELECT x.a, y.c FROM x JOIN (SELECT b, c FROM y WHERE c > 1) AS y ON x.b = y.b ORDER BY x.a;

SELECT x.a, y.c FROM (SELECT a FROM x) AS x, (SELECT c FROM y) AS y;

SELECT x.a, x.c FROM (SELECT x.a, z.c FROM x, y AS z) AS x;

SELECT * FROM (SELECT * FROM (SELECT * FROM x)) ORDER BY a LIMIT 1;

WITH x AS (SELECT a, b FROM main.x) SELECT a, b FROM x;

WITH y AS (SELECT a, b FROM x) SELECT a, b FROM y AS z;

WITH x2 AS (SELECT a FROM main.x), x3 AS (SELECT a FROM x2) SELECT a FROM x3;

WITH x AS (SELECT a, b FROM main.x WHERE a > 1) SELECT a, SUM(b) AS b FROM x GROUP BY a;

WITH x2 AS (SELECT a, b FROM x WHERE a > 1) SELECT a, c FROM x2 AS x JOIN y ON x.b = y.b;

WITH y AS (SELECT a, b FROM x AS q) SELECT a, b FROM y AS z;

SELECT * FROM (WITH x AS (SELECT a, b FROM main.x) SELECT a, b FROM x);

SELECT a FROM (SELECT a FROM (SELECT COALESCE(a) AS a FROM x LEFT JOIN y ON x.a = y.b) AS x) AS x;

WITH x2 AS (SELECT COALESCE(a) AS a FROM x LEFT JOIN y ON x.a = y.b) SELECT a FROM (SELECT a FROM x2 AS x) AS x;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x WHERE x.b = 1) AS x FULL OUTER JOIN (SELECT y.b AS b FROM y AS y WHERE y.b = 2) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x) AS x FULL OUTER JOIN (SELECT y.b AS b FROM y AS y) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x WHERE x.b = 1) AS x LEFT JOIN (SELECT y.b AS b FROM y AS y WHERE y.b = 2) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x) AS x LEFT JOIN (SELECT y.b AS b FROM y AS y) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x WHERE x.b = 1) AS x RIGHT JOIN (SELECT y.b AS b FROM y AS y WHERE y.b = 2) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x) AS x RIGHT JOIN (SELECT y.b AS b FROM y AS y) AS y ON x.b = y.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, COALESCE(y.c, 0) AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, CASE WHEN y.c IS NULL THEN 0 ELSE y.c END AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c IS NULL AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c IS NOT DISTINCT FROM NULL AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c IS DISTINCT FROM NULL AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c = 1 OR TRUE AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, CONCAT(y.c, 'x') AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, GREATEST(y.c, 1) AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, POWER(y.c, 0) AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, NULLIF(1, y.c) AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, CAST(y.c AS TEXT) || 'x' AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, COALESCE(y.c, 0) + 1 AS c FROM y) AS q ON x.a = q.b;

SELECT q.a, y.c FROM (SELECT x.b, 1 AS a FROM x) AS q RIGHT JOIN y ON q.b = y.b;

SELECT p.a, q.c FROM (SELECT x.b, 1 AS a FROM x) AS p FULL JOIN (SELECT y.b, COALESCE(y.c, 0) AS c FROM y) AS q ON p.b = q.b;

SELECT q.c FROM x JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b RIGHT JOIN y AS r ON x.a = r.b;

SELECT q.c FROM x JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b FULL JOIN y AS r ON x.a = r.b;

SELECT x.a FROM x LEFT JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b WHERE q.c IS NULL;

WITH cte AS (SELECT y.b, 1 AS c FROM y) SELECT x.a, q.c FROM x LEFT JOIN cte AS q ON x.a = q.b;

WITH cte AS (SELECT y.b, 1 AS c FROM y) SELECT x.a, q.c FROM (x LEFT JOIN cte AS q ON x.a = q.b);

WITH cte AS (SELECT y.b, 1 AS c FROM y) SELECT x.a, q.c FROM x LEFT JOIN (y AS r JOIN cte AS q ON r.b = q.b) ON x.a = r.b;

WITH cte AS (SELECT y.b, 1 AS c FROM y) SELECT q.c FROM (cte AS q RIGHT JOIN x ON x.a = q.b);

WITH cte AS (SELECT y.b, 1 AS c FROM y) SELECT q.c FROM (cte AS q JOIN x ON x.a = q.b) RIGHT JOIN y AS r ON x.a = r.b;

SELECT x.a, q.b FROM x LEFT JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c + 1 AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, y.c & 1 AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, CAST(-(y.c + 1) AS BIGINT) AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, NOT y.c = 1 AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT t.b, t.s.a AS c FROM (VALUES (2, STRUCT(3 AS a)), (3, NULL)) AS t(b, s)) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT t.b, t.s.n.a AS c FROM (VALUES (2, STRUCT(STRUCT(3 AS a) AS n)), (3, NULL)) AS t(b, s)) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, (STRUCT(1 AS a, y.c AS b)).a AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, 1 - y.c AS c FROM y) AS q ON x.a = q.b;

SELECT x.a, q.c FROM x LEFT JOIN (SELECT y.b, NULL AS c FROM y) AS q ON x.a = q.b;

SELECT q.a, y.c FROM (SELECT x.b, 1 AS a FROM x) AS q LEFT JOIN y ON q.b = y.b;

SELECT x.a, q.c FROM x RIGHT JOIN (SELECT y.b, 1 AS c FROM y) AS q ON x.a = q.b;

SELECT q.c FROM x RIGHT JOIN y AS r ON x.a = r.b JOIN (SELECT y.b, 1 AS c FROM y) AS q ON r.b = q.b;

SELECT x.a, q.c FROM x JOIN (SELECT y.b, COALESCE(y.c, 0) AS c FROM y) AS q ON x.a = q.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x WHERE x.b = 1) AS x INNER JOIN (SELECT y.b AS b FROM y AS y WHERE y.b = 2) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x) AS x INNER JOIN (SELECT y.b AS b FROM y AS y) AS y ON x.b = y.b;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x WHERE x.b = 1) AS x CROSS JOIN (SELECT y.b AS b FROM y AS y WHERE y.b = 2) AS y;

SELECT x.b AS b, y.b AS b2 FROM (SELECT x.b AS b FROM x AS x) AS x CROSS JOIN (SELECT y.b AS b FROM y AS y) AS y;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
  ORDER BY x.a, x.b, row_num
)
SELECT
  t1.a,
  t1.b
FROM
  t1
WHERE
  row_num = 1;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
)
SELECT
  t1.a,
  t1.b
FROM t1 JOIN y ON t1.a = y.c AND t1.row_num = 1;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
)
SELECT
  SUM(t1.row_num) as total_rows
FROM
  t1;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
)
SELECT
  t1.row_num AS row_num,
  SUM(t1.a) AS total
FROM
  t1
GROUP BY t1.row_num
ORDER BY t1.row_num;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
)
SELECT
  t1.row_num AS row_num,
  t1.a AS a
FROM
  t1
ORDER BY t1.row_num, t1.a;

WITH t1 AS (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) - 1 AS row_num
  FROM
    x
)
SELECT
  t1.row_num AS row_num,
  t1.a AS a
FROM
  t1
ORDER BY t1.row_num, t1.a;

with t1 as (
  SELECT
    x.a,
    x.b,
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
  ORDER BY x.a, x.b, row_num
)
SELECT
  t1.a,
  t1.b,
  t1.row_num
FROM
  t1;

WITH t AS (SELECT t1.x AS x, t1.y AS y, t2.a AS a, t2.b AS b FROM t1 AS t1(x, y) CROSS JOIN t2 AS t2(a, b) ORDER BY t2.a) SELECT t.x AS x, t.y AS y, t.a AS a, t.b AS b FROM t AS t;

with t1 as (
  SELECT
    ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num
  FROM
    x
)
SELECT
  t2.row_num
FROM
  t1 AS t2
WHERE
  t2.row_num = 2;

WITH i AS (
  SELECT
    x.a AS a
  FROM x AS x
), j AS (
  SELECT
    x.a,
    x.b
  FROM x AS x
), k AS (
  SELECT
    j.a,
    j.b
  FROM j AS j
)
SELECT
  i.a,
  k.b
FROM i AS i
LEFT JOIN k AS k
ON  i.a = k.a;

WITH i AS (
  SELECT
    x.a AS a
  FROM y AS y
  JOIN x AS x
    ON y.b = x.b
)
SELECT
  x.a AS a
FROM x AS x
LEFT JOIN i AS i
  ON x.a = i.a;

WITH _q_0 AS (SELECT t1.c AS c FROM t1 AS t1) SELECT * FROM (_q_0 AS _q_0 CROSS JOIN t2 AS t2);

WITH _q_0 AS (
  SELECT
    x.a AS a
  FROM x AS x
), y_2 AS (
  SELECT
    y.b AS b
  FROM y AS y
)
SELECT
  y.b AS b
FROM (
  _q_0 AS _q_0
    JOIN y_2 AS y
      ON _q_0.a = y.b
);

WITH q AS (
  SELECT
    y.b AS a
  FROM y AS y
)
SELECT
  q.a AS a
FROM x AS q
WHERE
  q.a IN (
    SELECT
      q.a AS a
    FROM q AS q
  );

WITH q AS (
  SELECT
    x.a AS a
  FROM x
  ORDER BY x.a
)
SELECT
  q.a AS a
FROM q
UNION ALL
SELECT
  1 AS a;

WITH tbl AS (select 1 as id)
SELECT
  id
FROM (
  SELECT OTBL.id
  FROM (
    SELECT OTBL.id
    FROM (
      SELECT OTBL.id
      FROM tbl AS OTBL
      LEFT OUTER JOIN tbl AS ITBL ON OTBL.id = ITBL.id
    ) AS OTBL
    LEFT OUTER JOIN tbl AS ITBL ON OTBL.id = ITBL.id
  ) AS OTBL
  LEFT OUTER JOIN tbl AS ITBL ON OTBL.id = ITBL.id
) AS ITBL;

WITH i AS (
  SELECT
    a
  FROM (
    SELECT 1 a
  ) AS conflict
), j AS (
  SELECT 1 AS a
)
SELECT
  i.a,
  conflict.a
FROM i
LEFT JOIN j AS conflict
  ON i.a = conflict.a;

with cte as (
    select x.a * x.b as mult from x
)
select cte.mult from cte;

WITH t0 AS (
  SELECT
    5 AS id
), t1 AS (
  SELECT
    1 AS id,
    'US' AS cid
), t2 AS (
  SELECT
    1 AS id,
    'US' AS cid
)
SELECT
  t0.id,
  t3.cid AS cid
FROM t0
INNER JOIN (
  SELECT
    t1.id,
    t2.cid
  FROM t1
  RIGHT JOIN t2
    ON t1.cid = t2.cid
) AS t3
  ON t0.id = t3.id;

WITH t1 AS (SELECT 1 AS col) SELECT a, SUM(b) AS b FROM (SELECT 6 AS a, col AS b FROM t1) AS t GROUP BY a ORDER BY a;

SELECT MAX(x.b) AS lit FROM x CROSS JOIN (SELECT 6 AS lit FROM z) AS t GROUP BY t.lit;

SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY s.a ORDER BY s.a;

WITH c AS (SELECT DISTINCT a, b FROM x) SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, b FROM c) AS s GROUP BY s.a ORDER BY s.a;

WITH c AS (SELECT DISTINCT x.b AS b FROM x) SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, b FROM c) AS s CROSS JOIN x GROUP BY s.a ORDER BY s.a;

SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, y.b AS b FROM y) AS s CROSS JOIN unknown_tbl GROUP BY s.a ORDER BY s.a;

SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY ROLLUP(s.a) ORDER BY s.a;

SELECT s.a, s.b, COUNT(*) AS c FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY GROUPING SETS ((s.a, s.b)) ORDER BY s.b;

SELECT s.a, s.b, COUNT(*) AS c FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY (s.a, s.b) ORDER BY s.b;

SELECT s.a, SUM(s.b) AS b FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY (s.a) ORDER BY s.a;

SELECT s.a, s.b, COUNT(*) AS c FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY ((s.a), s.b) ORDER BY s.b;

SELECT s.a, s.b, COUNT(*) AS c FROM (SELECT 6 AS a, b FROM x) AS s GROUP BY ((s.a, s.b)) ORDER BY s.b;

SELECT s.a FROM (SELECT 6 AS a, b FROM x) AS s ORDER BY (s.a);

SELECT s.w FROM (SELECT a, ROW_NUMBER() OVER (ORDER BY a) AS w FROM x) AS s WHERE s.a > 5;

SELECT s.w FROM (SELECT b, ROW_NUMBER() OVER (ORDER BY b) AS w FROM x) AS s JOIN y ON s.b = y.b;

SELECT s.b FROM (SELECT 6 AS a, b FROM x) AS s ORDER BY s.a;

WITH c AS (SELECT DISTINCT b FROM x) SELECT s.b FROM (SELECT 6 AS a, b FROM c) AS s CROSS JOIN x ORDER BY s.a;

WITH c AS (SELECT a FROM (SELECT a, b FROM x) AS q WHERE q.b > 1) SELECT c.a FROM c JOIN y ON c.a = y.b;

WITH c AS (SELECT rn FROM (SELECT ROW_NUMBER() OVER (ORDER BY a) AS rn FROM x) AS q) SELECT c.rn FROM c JOIN y ON c.rn = y.b;

WITH c AS (SELECT q.a FROM (SELECT x.a FROM x AS x) AS q) SELECT c.a FROM c JOIN x ON c.a = x.a;

WITH q AS (SELECT a + b AS c FROM x) SELECT q.c * 1 AS c1, q.c * 2 AS c2, q.c * 3 AS c3 FROM q;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b)) AS d CROSS JOIN z AS z;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b)) AS d CROSS JOIN z AS outer_z;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b AND EXISTS (SELECT 1 FROM x AS x4 WHERE x4.a < z.b))) AS d CROSS JOIN z AS z;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b UNION ALL SELECT 1 FROM x AS x4 WHERE x4.a < z.b)) AS d CROSS JOIN z AS z;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b AND EXISTS (SELECT 1 FROM x AS z WHERE z.a > z.b))) AS d CROSS JOIN z AS z;

SELECT d.b FROM (SELECT z.b FROM x AS y1 JOIN (SELECT b FROM z) AS z ON EXISTS (SELECT 1 FROM x AS z WHERE z.a > z.b)) AS d CROSS JOIN z AS z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b)) SELECT d.b FROM d CROSS JOIN z AS z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b)) SELECT d.b FROM d CROSS JOIN z AS outer_z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b AND EXISTS (SELECT 1 FROM x AS x4 WHERE x4.a < z.b))) SELECT d.b FROM d CROSS JOIN z AS z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b UNION ALL SELECT 1 FROM x AS x4 WHERE x4.a < z.b)) SELECT d.b FROM d CROSS JOIN z AS z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS x3 WHERE x3.a < z.b AND EXISTS (SELECT 1 FROM x AS z WHERE z.a > z.b))) SELECT d.b FROM d CROSS JOIN z AS z;

WITH source_z AS (SELECT b FROM z), d AS (SELECT z.b FROM x AS y1 JOIN source_z AS z ON EXISTS (SELECT 1 FROM x AS z WHERE z.a > z.b)) SELECT d.b FROM d CROSS JOIN z AS z;
