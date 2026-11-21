--------------------------------------
-- Qualify columns
--------------------------------------
SELECT a FROM x;

SELECT "a" FROM x;

SELECT a FROM zz GROUP BY a ORDER BY a;

SELECT x, p FROM (SELECT x from xx) xx CROSS JOIN yy;

SELECT a FROM x AS z;

SELECT a AS a FROM x;

SELECT x.a FROM x;

SELECT x.a AS a FROM x;

SELECT a AS b FROM x;

SELECT 1, 2 + 3 FROM x;

SELECT a + b FROM x;

SELECT l.a FROM x l WHERE a IN (select a FROM x ORDER by a);

SELECT a, SUM(b) FROM x WHERE a > 1 AND b > 1 GROUP BY a;

SELECT SUM(a) AS c FROM x HAVING SUM(a) > 3;

SELECT SUM(a) AS a FROM x HAVING SUM(a) > 3;

SELECT SUM(a) AS c FROM x HAVING c > 3;

SELECT SUM(a) AS a FROM x HAVING a > 3;

SELECT SUM(a) AS c FROM x HAVING SUM(b) > 3;

SELECT a AS j, b FROM x ORDER BY j;

SELECT a AS j, b AS a FROM x ORDER BY 1;

SELECT a AS j, -b AS j FROM x GROUP BY 1, 2 ORDER BY 1, -b;

SELECT SUM(a) AS c, SUM(b) AS d FROM x ORDER BY 1, 2;

SELECT CAST(a AS INT) FROM x ORDER BY a;

SELECT SUM(a), SUM(b) AS c FROM x ORDER BY 1, 2;

SELECT a AS j, b FROM x GROUP BY j, b;

SELECT a, b FROM x GROUP BY 1, 2;

SELECT a, b FROM x ORDER BY 1, 2;

SELECT DISTINCT a AS c, b AS d FROM x ORDER BY 1;

SELECT 2 FROM x GROUP BY 1;

SELECT 'a' AS a FROM x GROUP BY 1;

SELECT NULL AS a FROM x GROUP BY 1;

SELECT TRUE AS a FROM x GROUP BY 1;

-- this query seems to be invalid in postgres and duckdb but valid in bigquery
SELECT 2 a FROM x GROUP BY 1 HAVING a > 1;

SELECT 2 d FROM x GROUP BY d HAVING d > 1;

SELECT 2 d FROM x GROUP BY 1 ORDER BY 1;

SELECT DATE(a), DATE(b) AS c FROM x GROUP BY 1, 2;

SELECT (SELECT MIN(a) FROM UNNEST([1, 2]) AS t(a)) AS f FROM x GROUP BY 1;

SELECT SUM(x.a) AS c FROM x JOIN y ON x.b = y.b GROUP BY c;

SELECT COALESCE(x.a) AS d FROM x JOIN y ON x.b = y.b GROUP BY d;

SELECT SUM(x.a) AS d FROM x JOIN y ON x.b = y.b GROUP BY UPPER(d);

SELECT SUM(x.a) AS d FROM x JOIN y ON x.b = y.b GROUP BY d;

SELECT SUM(x.a) AS c FROM x JOIN y ON x.b = y.b GROUP BY UPPER(c);

SELECT a + 1 AS d FROM x WHERE d > 1;

SELECT a + 1 AS d, d + 2 FROM x;

SELECT a AS a, b FROM x ORDER BY a;

SELECT a, b FROM x ORDER BY a;

SELECT a FROM x ORDER BY b;

SELECT SUM(a) AS a FROM x ORDER BY SUM(a);

SELECT AGGREGATE(ARRAY(a, x.b), 0, (x, acc) -> x + acc + a) AS sum_agg FROM x;

SELECT t.x FROM READ_PARQUET('path.parquet', hive_partition=1) AS t;

select * from (values (1, 2));

select * from (values (1, 2)) x;

SELECT SOME_UDF(data).* FROM t;

SELECT p.* FROM p UNION ALL SELECT p2.* FROM p2;

SELECT a + 1 AS i, missing_column FROM x;

SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x) AS x FROM t;

SELECT first, second FROM (SELECT 'val' AS col, STACK(2, 1, 2, 3) AS (first, second)) AS tbl;

--------------------------------------
-- Derived tables
--------------------------------------
SELECT y.a AS a FROM (SELECT x.a AS a FROM x AS x) AS y;

SELECT y.a AS a FROM (SELECT x.a AS a FROM x AS x) AS y(a);

SELECT y.c AS c FROM (SELECT x.a AS a, x.b AS b FROM x AS x) AS y(c);

SELECT a FROM (SELECT a FROM x AS x) y;

SELECT a FROM (SELECT a AS a FROM x);

SELECT a FROM (SELECT a FROM (SELECT a FROM x));

SELECT x.a FROM x AS x JOIN (SELECT * FROM x) AS y ON x.a = y.a;

SELECT a FROM x as t1 /* there is comment */;

--------------------------------------
-- Joins
--------------------------------------
SELECT a, c FROM x JOIN y ON x.b = y.b;

SELECT a, c FROM x, y;

--------------------------------------
-- Unions
--------------------------------------
SELECT a FROM x UNION SELECT a FROM x ORDER BY a;

SELECT a FROM x UNION SELECT a FROM x UNION SELECT a FROM x ORDER BY a;

SELECT a FROM (SELECT a FROM x UNION SELECT a FROM x) ORDER BY a;

((select a from x where a < 1)) UNION ((select a from x where a > 2));

--------------------------------------
-- Subqueries
--------------------------------------
SELECT a FROM x WHERE b IN (SELECT c FROM y);

SELECT (SELECT c FROM y) FROM x;

WITH t(c) AS (SELECT 1) SELECT (SELECT c) FROM t;

WITH t1(c1) AS (SELECT 1), t2(c2) AS (SELECT 2) SELECT (SELECT c1 FROM t2) FROM t1;

SELECT a FROM (SELECT a FROM x) WHERE a IN (SELECT b FROM (SELECT b FROM y));

select * from x where b in ((((select b from y))));

--------------------------------------
-- Correlated subqueries
--------------------------------------
SELECT a FROM x WHERE b IN (SELECT c FROM y WHERE y.b = x.a);

SELECT a FROM x WHERE b IN (SELECT c FROM y WHERE y.b = a);

SELECT a FROM x WHERE b IN (SELECT b FROM y AS x);

SELECT a FROM x AS i WHERE b IN (SELECT b FROM y AS j WHERE j.b IN (SELECT c FROM y AS k WHERE k.b = j.b));

SELECT (SELECT n.a FROM n WHERE n.id = m.id) FROM m AS m;

SELECT id FROM t WHERE id > (SELECT AVG(id) FROM u WHERE u.name = t.name);

SELECT id FROM t WHERE id > (SELECT AVG(id) FROM t AS t2 WHERE t2.k = t.k);

SELECT id FROM t WHERE id > (SELECT AVG(u) FROM u WHERE u.k = t.k);

--------------------------------------
-- Expand *
--------------------------------------
SELECT * FROM x;

SELECT x.* FROM x;

SELECT * FROM x JOIN y ON x.b = y.b;

SELECT x.* FROM x JOIN y ON x.b = y.b;

SELECT x.*, y.* FROM x JOIN y ON x.b = y.b;

SELECT a FROM (SELECT * FROM x);

SELECT * FROM (SELECT a FROM x);

SELECT * FROM x GROUP BY 1, 2;

SELECT * FROM (SELECT * FROM x) AS s(a, b);

SELECT * FROM (SELECT * FROM t) AS s(a, b);

SELECT * FROM (SELECT * FROM t1 UNION ALL SELECT * FROM t2) AS s(b);

SELECT * FROM READ_CSV('file.csv');

--------------------------------------
-- CTEs
--------------------------------------
WITH z AS (SELECT x.a AS a FROM x) SELECT z.a AS a FROM z;

WITH z(a) AS (SELECT a FROM x) SELECT * FROM z;

WITH z AS (SELECT a FROM x) SELECT * FROM z as q;

WITH z AS (SELECT a FROM x) SELECT * FROM z;

WITH z AS (SELECT a FROM x), q AS (SELECT * FROM z) SELECT * FROM q;

WITH z AS (SELECT * FROM x) SELECT * FROM z UNION SELECT * FROM z ORDER BY a, b;

WITH z AS (SELECT * FROM x), q AS (SELECT b FROM z) SELECT b FROM q;

WITH z AS ((SELECT b FROM x UNION ALL SELECT b FROM y) ORDER BY b) SELECT * FROM z;

WITH cte(x) AS (SELECT 1) SELECT * FROM cte AS cte(a);

WITH cte(x, y) AS (SELECT 1, 2) SELECT cte.* FROM cte AS cte(a);

-- Cannot pop table column aliases for recursive ctes (redshift).
WITH RECURSIVE cte(x) AS (SELECT 1), cte2(y) AS (SELECT 2) SELECT * FROM cte, cte2;

WITH player AS (SELECT player.name, player.asset.info FROM players) SELECT * FROM player;

WITH tesT AS (SELECT c1 FROM t1) SELECT c1 FROM test;

--------------------------------------
-- Except, Replace, Rename
--------------------------------------
SELECT * RENAME(a AS d) FROM x;

SELECT * EXCEPT(b) RENAME(a AS d) FROM x;

SELECT x.* EXCEPT(a), y.* FROM x, y;

SELECT * EXCEPT(a) FROM x;

SELECT * EXCEPT(x.a) FROM x AS x;

SELECT * EXCEPT (y.b) FROM x AS x JOIN y AS y ON x.b = y.b;

SELECT * EXCEPT (b, y.c) FROM x AS x JOIN y AS y ON x.b = y.b;

SELECT * EXCEPT (a, b) FROM x;

SELECT x.a, * EXCEPT (a) FROM x AS x LEFT JOIN x AS y USING (a);

SELECT COALESCE(CAST(t1.a AS VARCHAR), '') AS a, t2.* EXCEPT (a) FROM x AS t1, x AS t2;

SELECT * REPLACE(2 AS a) FROM x;

SELECT * EXCEPT (a, b) REPLACE (a AS a) FROM x;

SELECT * REPLACE(COALESCE(b, a) AS a, a as b) FROM x;

SELECT * REPLACE(1 AS a) RENAME(b as alias_b) FROM x;

SELECT * EXCEPT(a) REPLACE(COALESCE(a, b) AS b) RENAME(b AS new_b) FROM x;

SELECT * REPLACE(1 AS a, a AS b) RENAME(b AS new_b) FROM x;

--------------------------------------
-- Using
--------------------------------------
SELECT x.b FROM x JOIN y USING (b);

WITH cte AS (SELECT a.b.c.d.f.g FROM tbl1) SELECT g FROM (SELECT g FROM tbl2) tbl2 JOIN cte USING(g);

SELECT x.b FROM x JOIN y USING (b) JOIN z USING (b);

SELECT b FROM x AS x2 JOIN y AS y2 USING (b);

SELECT b FROM x JOIN y USING (b) WHERE b = 1 and y.b = 2;

SELECT b FROM x JOIN y USING (b) JOIN z USING (b);

SELECT * FROM w, x JOIN y USING (b);

SELECT x.* FROM x JOIN y USING(b);

SELECT x.*, y.* FROM x JOIN y USING(b);

SELECT y.* FROM x LEFT JOIN y USING(b);

SELECT b FROM x JOIN y USING(b);

SELECT b, c FROM x JOIN y USING(b);

SELECT b, c FROM y JOIN z USING(b, c);

SELECT * FROM y JOIN z USING(b, c);

SELECT * FROM y JOIN z USING(b, c) WHERE b = 2 AND c = 3;

SELECT b FROM x JOIN t USING(a);

SELECT b FROM t JOIN x USING(a);

SELECT a FROM t1 JOIN t2 USING(a);

SELECT a FROM t1 FULL JOIN t2 USING (a) JOIN t3 USING (a);

WITH m(a) AS (SELECT 1), n(b) AS (SELECT 1) SELECT * FROM m JOIN n AS foo(a) USING (a);

WITH t1 AS (SELECT 'x' AS id, DATE '2024-01-01' AS foo, 000 AS value), t2 AS (SELECT 'x' AS id, DATE '2024-02-02' AS foo, 123 AS value), t3 AS (SELECT 'x' AS id, DATE '2024-02-02' AS foo, 456 AS value) SELECT * FROM t1 FULL OUTER JOIN t2 USING(id, foo) FULL OUTER JOIN t3 USING(id, foo);

WITH t1 AS (SELECT 'x' AS id, CAST('2024-01-01' AS DATE) AS foo, 000 AS value), t2 AS (SELECT 'x' AS id, CAST('2024-02-02' AS DATE) AS foo, 123 AS value), t3 AS (SELECT 'x' AS id, CAST('2024-02-02' AS DATE) AS foo, 456 AS value) SELECT * FROM t1 FULL OUTER JOIN t2 USING (id, foo, value) FULL OUTER JOIN t3 USING (id, foo, value);

WITH t1 AS (SELECT 'x' AS id, CAST('2024-01-01' AS DATE) AS foo, 000 AS value), t2 AS (SELECT 'x' AS id, CAST('2024-02-02' AS DATE) AS foo, 123 AS value), t3 AS (SELECT 'x' AS id, CAST('2024-02-02' AS DATE) AS foo, 456 AS value), t4 AS (SELECT 'x' AS id, CAST('2024-03-03' AS DATE) AS foo, 789 AS value) SELECT * FROM t1 FULL OUTER JOIN t2 USING (id, foo) FULL OUTER JOIN t3 USING (id, foo) FULL OUTER JOIN t4 USING (id, foo);

WITH t1 AS (SELECT 1 AS id), t2 AS (SELECT 2 AS id) SELECT STRUCT(id) AS my_field FROM t1 JOIN t2 USING (id);

WITH t1 AS (SELECT 1 AS id), t2 AS (SELECT 2 AS id) SELECT STRUCT(id AS col) AS my_field FROM t1 JOIN t2 USING (id);

--------------------------------------
-- Natural join
--------------------------------------
-- A NATURAL JOIN is expanded to a USING join over the common columns.
SELECT b FROM x NATURAL JOIN y;

SELECT a FROM x NATURAL JOIN z;

-- Chained NATURAL JOINs intersect against all columns accumulated so far, so the
-- second join's common columns include those contributed by y.
SELECT b FROM x NATURAL JOIN y NATURAL JOIN z;

-- No common columns: there is no USING list to expand into, so NATURAL is left
-- in place for the engine to reject or cross join as it sees fit.
SELECT a, d FROM x NATURAL LEFT JOIN w;

-- An unknown schema on either side makes the common columns unknowable.
SELECT * FROM x NATURAL JOIN unknown_table;

SELECT * FROM unknown_table NATURAL JOIN x;

--------------------------------------
-- UDTF
--------------------------------------
SELECT c FROM x LATERAL VIEW EXPLODE (a) AS c;

SELECT c FROM xx LATERAL VIEW EXPLODE (a) AS c;

SELECT c FROM x LATERAL VIEW EXPLODE (a) t AS c;

SELECT aa FROM x, UNNEST(a) AS t(aa);

SELECT c FROM (SELECT 1 a) AS x LATERAL VIEW EXPLODE(a) AS c;

SELECT * FROM foo(bar) AS t(c1, c2, c3);

SELECT c1, c3 FROM foo(bar) AS t(c1, c2, c3);

--------------------------------------
-- Window functions
--------------------------------------
SELECT a + 1 AS a, ROW_NUMBER() OVER (PARTITION BY b ORDER BY a) AS row_num FROM x ORDER BY a, row_num;

SELECT * FROM x QUALIFY COUNT(a) OVER (PARTITION BY b) > 1;

--------------------------------------
-- Expand laterals
--------------------------------------
SELECT 2 AS d, d + 1 FROM x WHERE d = 2 GROUP BY d;

SELECT
  x.a + 1 AS i,
  i + 1 AS j,
  j + 1 AS k
FROM x;

SELECT i + 1 AS j, x.a + 1 AS i FROM x;

SELECT
  *
FROM (
  SELECT
    x.a + 1 AS i,
    i + 1 AS j
  FROM x
);

SELECT x.a + x.b AS f, f * x.b FROM x;

SELECT x.a + x.b AS f, f, f + 5 FROM x;

SELECT a, SUM(b) AS c, SUM(c) OVER(PARTITION BY a) AS d from x group by 1 ORDER BY a;

WITH RECURSIVE t(c) AS (SELECT 1 AS c UNION ALL SELECT c + 1 AS c FROM t WHERE c <= 10) SELECT c FROM t;

WITH RECURSIVE t AS (SELECT 1 AS c UNION ALL SELECT c + 1 AS c FROM t WHERE c <= 10) SELECT c FROM t;

SELECT DISTINCT ON (new_col, b + 1, 1) t1.a AS new_col FROM x AS t1 ORDER BY new_col;

SELECT a, SUM(b) AS b FROM x GROUP BY a ORDER BY SUM(b);

SELECT COALESCE(COUNT(DISTINCT a)) AS a FROM x;

WITH RECURSIVE rec AS (SELECT id, parent_id AS parent, 1 AS level FROM (SELECT 1 AS id, 0 AS parent_id) AS t WHERE parent = 0 UNION ALL SELECT rec.id + 10 AS id, rec.id AS parent, rec.level + 1 AS level FROM rec WHERE level < 3) SELECT * FROM rec;

WITH RECURSIVE rec AS (SELECT id, parent_id AS parent, 1 AS level FROM (SELECT 1 AS id, 0 AS parent_id) AS t WHERE parent = 0 UNION ALL SELECT num, val AS x, 2 AS level FROM (SELECT 2 AS num, 1 AS val) AS s WHERE x = 1 UNION ALL SELECT rec.id + 10 AS id, rec.id AS parent, rec.level + 1 AS level FROM rec WHERE rec.level < 3) SELECT * FROM rec ORDER BY rec.id;

WITH RECURSIVE t(c) AS (SELECT 1 AS c UNION ALL SELECT * FROM (SELECT c + 1 AS c FROM t WHERE c <= 3 UNION ALL SELECT c + 2 AS c FROM t WHERE c <= 3)) SELECT c FROM t ORDER BY c;

--------------------------------------
-- Wrapped tables / join constructs
--------------------------------------
SELECT * FROM ((tbl));

SELECT a, c FROM (x LEFT JOIN y ON a = c);

SELECT * FROM ((a CROSS JOIN ((b CROSS JOIN c) CROSS JOIN (d CROSS JOIN e))));

SELECT * FROM ((SELECT * FROM tbl));

SELECT * FROM ((SELECT c FROM t1) CROSS JOIN t2);

SELECT * FROM ((SELECT * FROM x) INNER JOIN y ON a = c);

SELECT * FROM (SELECT a FROM x) AS s CROSS JOIN w;

SELECT * FROM UNNEST(ARRAY(1, 2)) AS u(v) CROSS JOIN x;

SELECT * FROM ((SELECT a FROM x) CROSS JOIN y) AS j;

SELECT * FROM ((x CROSS JOIN w) CROSS JOIN (SELECT c FROM y) AS s) AS j;

SELECT * FROM ((x CROSS JOIN w) AS i CROSS JOIN (SELECT c FROM y) AS s) AS j;

SELECT * FROM ((SELECT a FROM x) CROSS JOIN (w CROSS JOIN (SELECT c FROM y) AS s) AS k) AS j;

SELECT x.a, y.b, z.c FROM x LEFT JOIN (y INNER JOIN z ON y.c = z.c) ON x.b = y.b;

SELECT * FROM ((SELECT * FROM x) INNER JOIN (SELECT * FROM y) ON a = c);

SELECT * FROM (SELECT * FROM x CROSS JOIN y) AS s;

SELECT s.* FROM (SELECT * FROM x CROSS JOIN y) AS s;

SELECT * FROM (SELECT a, c FROM x CROSS JOIN y) AS s;

SELECT * FROM (SELECT * FROM (SELECT * FROM x CROSS JOIN y) AS s) AS t;

SELECT * FROM (SELECT a AS k, a AS k FROM x) AS s;

SELECT * FROM (SELECT *, a AS extra FROM x CROSS JOIN y) AS s;

SELECT b FROM ((SELECT a FROM x) INNER JOIN y ON a = b);

SELECT a, c FROM x TABLESAMPLE SYSTEM (10 ROWS) CROSS JOIN y TABLESAMPLE SYSTEM (10 ROWS);

SELECT x.a FROM x INNER JOIN y ON x.a = c INNER JOIN z ON x.a = z.c;

SELECT w.d FROM w ANTI JOIN y ON b > 0 JOIN z ON TRUE;

SELECT w.d FROM w SEMI JOIN y ON b > 0 JOIN z ON TRUE;

SELECT w.d FROM w ANTI JOIN x AS x1 ON a > 0 JOIN x AS x2 ON TRUE;

SELECT w.d FROM w ANTI JOIN (SELECT a FROM x) AS m ON a > 0 JOIN (SELECT a FROM x) AS n ON TRUE;

SELECT x.a FROM x SEMI JOIN y ON x.b = y.b JOIN z ON c > 0;
