SELECT a FROM (SELECT * FROM x);

SELECT a FROM (SELECT a, b AS unused, a AS j, -b AS j FROM x ORDER BY 3, 4 LIMIT 2) AS t;

SELECT 1 FROM (SELECT * FROM x) WHERE b = 2;

SELECT a, b, a from x;

SELECT (SELECT c FROM y WHERE q.b = y.b) FROM (SELECT * FROM x) AS q;

SELECT a FROM x JOIN (SELECT b, c FROM y) AS z ON x.b = z.b;

SELECT x1.a FROM (SELECT * FROM x) AS x1, (SELECT * FROM x) AS x2;

SELECT a FROM (SELECT DISTINCT a, b FROM x);

SELECT a FROM (SELECT a, b FROM x UNION ALL SELECT a, b FROM x);

WITH t1 AS (SELECT x.a AS a, x.b AS b FROM x UNION ALL SELECT z.b AS b, z.c AS c FROM z) SELECT a, b FROM t1;

SELECT a FROM (SELECT a, b FROM x UNION SELECT a, b FROM x);

SELECT a FROM (SELECT a, b FROM x INTERSECT ALL SELECT a, b FROM x);

SELECT a FROM (SELECT a, b FROM x EXCEPT ALL SELECT a, b FROM x);

SELECT a FROM (SELECT a, b FROM x GROUP BY ALL);

WITH y AS (SELECT * FROM x) SELECT a FROM y;

WITH z AS (SELECT * FROM x), q AS (SELECT b FROM z) SELECT b FROM q;

WITH z AS (SELECT * FROM x) SELECT a FROM z UNION SELECT a FROM z;

SELECT b FROM (SELECT a, SUM(b) AS b FROM x GROUP BY a);

WITH x AS (SELECT 0 AS c, SUM(d) AS s FROM t GROUP BY 1) SELECT s FROM x;

WITH x AS (SELECT z, 0 AS c, a, SUM(d) AS s FROM t GROUP BY z, 2, a) SELECT c, a, s FROM x;

WITH x AS (SELECT a, b, 0 AS c, SUM(d) AS s FROM t GROUP BY 1, 2, 3) SELECT a, s FROM x;

WITH x AS (SELECT z, 0 AS c, SUM(d) AS s FROM t GROUP BY z, 2, 2) SELECT c, s FROM x;

SELECT b FROM (SELECT a, SUM(b) AS b FROM x ORDER BY a);

SELECT x FROM (VALUES(1, 2)) AS q(x, y);

SELECT x FROM UNNEST([1, 2]) AS q(x, y);

WITH t1 AS (SELECT cola, colb FROM UNNEST([STRUCT(1 AS cola, 'test' AS colb)]) AS "q"("cola", "colb")) SELECT cola FROM t1;

SELECT x FROM VALUES(1, 2) AS q(x, y);

SELECT i.a FROM x AS i LEFT JOIN (SELECT a, b FROM (SELECT a, b FROM x)) AS j ON i.a = j.a;

WITH cte AS (SELECT source.a AS a, ROW_NUMBER() OVER (PARTITION BY source.id, source.timestamp ORDER BY source.a DESC) AS index FROM source AS source QUALIFY index) SELECT cte.a AS a FROM cte;

WITH cte AS (SELECT 1 AS x, 2 AS y, 3 AS z) SELECT cte.a FROM cte AS cte(a);

WITH cte(x, y, z) AS (SELECT 1, 2, 3) SELECT a, z FROM cte AS cte(a);

WITH cte(x, y, z) AS (SELECT 1, 2, 3) SELECT a, z FROM (SELECT * FROM cte AS cte(b)) AS cte(a);

WITH y AS (SELECT a FROM x) SELECT 1 FROM y;

WITH y AS (SELECT SUM(a) FROM x) SELECT 1 FROM y;

WITH y AS (SELECT a FROM x GROUP BY a) SELECT 1 FROM y;

WITH cte AS (SELECT col FROM t) SELECT IF(1 IN UNNEST(col), 1, 0) AS col FROM cte;

SELECT a FROM (SELECT * FROM zz) WHERE b = 1;

SELECT a FROM (SELECT * FROM aa UNION ALL SELECT * FROM bb UNION ALL SELECT * from cc);

SELECT a FROM (SELECT a FROM aa UNION ALL SELECT * FROM bb UNION ALL SELECT * from cc);

SELECT a FROM (SELECT * FROM aa CROSS JOIN bb);

SELECT a FROM (SELECT aa.* FROM aa);

SELECT a FROM (SELECT * FROM (SELECT * FROM aa));

with cte1 as (SELECT cola, colb FROM tb UNION ALL SELECT colc, cold FROM tb2) SELECT cola FROM cte1;

SELECT * FROM ((SELECT c FROM t1) JOIN t2);

SELECT a, d FROM (SELECT 1 a, 2 c, 3 d, 4 e UNION ALL BY NAME SELECT 6 c, 7 d, 8 a, 9 e);

SELECT a, b FROM (WITH cte1 AS (SELECT 1 AS a, 2 AS b, 3 AS c, 4 AS d) (SELECT a, b, c FROM cte1));

SELECT c FROM (SELECT 1 AS c UNION ALL BY NAME SELECT 2 AS c, 3 AS d) AS t;

SELECT c FROM (SELECT 1 AS c UNION ALL BY NAME SELECT 2 AS d, 3 AS c) AS t;

WITH cte1 AS (SELECT a, SUM(b) AS sale FROM x GROUP BY a), cte2 AS (SELECT cte1.a, COUNT(*) AS cnt FROM cte1 GROUP BY cte1.a) SELECT a, cnt FROM cte2;

--------------------------------------
-- Set-returning functions affect cardinality and are retained even when unused
--------------------------------------
SELECT d FROM (SELECT EXPLODE(e) AS col, d FROM w);

SELECT d FROM (SELECT POSEXPLODE(e) AS col, d FROM w);

SELECT d FROM (SELECT INLINE(e) AS col, d FROM w);

-- Window functions do not affect cardinality and stay prunable
SELECT d FROM (SELECT d, ROW_NUMBER() OVER (PARTITION BY e ORDER BY d) AS rn FROM w);

SELECT t.a FROM (SELECT a, b FROM x UNION ALL SELECT a, b FROM x ORDER BY b, a LIMIT 3) AS t;

WITH t AS (SELECT a, b FROM x UNION ALL SELECT a, b FROM x ORDER BY b LIMIT 3) SELECT a FROM t;

SELECT t.a FROM (SELECT a, b FROM x UNION ALL SELECT a, b FROM x UNION ALL SELECT a, b FROM x ORDER BY b) AS t;

SELECT t.a FROM (SELECT a, b FROM x UNION SELECT a, b FROM x ORDER BY b LIMIT 3) AS t;

SELECT t.a FROM (SELECT a, b FROM x UNION ALL SELECT a, b FROM x LIMIT 3) AS t;

SELECT t.a FROM (SELECT a, b FROM x UNION ALL SELECT a, b FROM x ORDER BY (SELECT 1 FROM y WHERE b = 5)) AS t;

--------------------------------------
-- GROUP BY ALL implicitly groups by every non-aggregate projection, so those
-- projections must be retained even when unreferenced by the outer scope
--------------------------------------
SELECT t.a FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY ALL) t;

-- Unreferenced aggregate projections stay prunable, including those after the
-- first aggregate in the SELECT list
SELECT t.a FROM (SELECT a, SUM(b) AS s1, MAX(b) AS s2 FROM x GROUP BY ALL) t;

-- An implicit key can be a non-column expression, not just a bare column
SELECT t.a, t.c FROM (SELECT a, b, b + 1 AS c, SUM(a) AS s FROM x GROUP BY ALL) t;

-- ALL is a grouping-sets modifier (not implicit-key inference) once CUBE/ROLLUP/an explicit
-- list is present, so those columns stay prunable like any other explicit GROUP BY column
SELECT t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY ALL CUBE (a, b)) t;

SELECT t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY ALL a, b) t;

--------------------------------------
-- GROUP BY ordinals nested in GROUPING SETS / CUBE / ROLLUP reference projections
-- positionally, so pruning must not shift what they point at
--------------------------------------
SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY GROUPING SETS (1, 2)) t;

SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY CUBE (1, 2)) t;

SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY ROLLUP (1, 2)) t;

SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY GROUPING SETS (1, (1, 2))) t;

SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY GROUPING SETS ((1), (2))) t;

SELECT t.a, t.s FROM (SELECT a, b, SUM(b) AS s FROM x GROUP BY (1), (2)) t;

WITH RECURSIVE t(c, d) AS (SELECT a, b FROM x) SELECT c FROM t;

WITH RECURSIVE t(c, d) AS (SELECT a, b FROM x UNION ALL SELECT b, c FROM y) SELECT c FROM t;

WITH t AS (SELECT a, b FROM x) SELECT t1.r, t2.p FROM t AS t1(q, r) CROSS JOIN t AS t2(p);
