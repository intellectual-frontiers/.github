SELECT x.a AS a FROM (SELECT x.a FROM x AS x) AS x JOIN y WHERE x.a = 1 AND x.b = 1 AND y.a = 1;

WITH x AS (SELECT y.a FROM y) SELECT * FROM x WHERE x.a = 1;

SELECT x.a FROM (SELECT * FROM x) AS x CROSS JOIN y WHERE y.a = 1 OR (x.a = 1 AND x.b = 1);

SELECT x.a FROM (SELECT * FROM x) AS x JOIN y WHERE (x.a = y.a AND x.a = 1 AND x.b = 1) OR x.a = y.a;

SELECT x.a FROM (SELECT * FROM x) AS x JOIN y WHERE (x.a = y.a AND x.a = 1 AND x.b = 1) OR x.a = y.b;

SELECT x.a FROM (SELECT x.a AS a, x.b * 1 AS c FROM x) AS x WHERE x.c = 1;

SELECT x.a FROM (SELECT x.a AS a, x.b * 1 AS c FROM x) AS x WHERE x.c = 1 or x.c = 2;

SELECT x.a FROM (SELECT x.a AS a, x.b OR x.c AS d FROM x) AS x WHERE x.d = FALSE;

SELECT x.a FROM (SELECT x.a AS a, x.b AND x.c AS d FROM x) AS x WHERE NOT x.d;

SELECT x.a AS a FROM (SELECT x.a FROM x AS x) AS x JOIN y WHERE x.a = 1 AND x.b = 1 AND (x.c = 1 OR y.c = 1);

SELECT x.a FROM x AS x JOIN (SELECT y.a FROM y AS y) AS y ON y.a = 1 AND x.a = y.a;

SELECT x.a AS a FROM x AS x JOIN (SELECT * FROM y AS y) AS y ON y.a = 1 WHERE x.a = 1 AND x.b = 1 AND y.a = x.a;

SELECT x.a AS a FROM x AS x CROSS JOIN (SELECT * FROM y AS y) AS y WHERE x.a = 1 AND x.b = 1 AND y.a = x.a AND y.a = 1;

with t1 as (SELECT x.a, x.b, ROW_NUMBER() OVER (PARTITION BY x.a ORDER BY x.a) as row_num FROM x) SELECT t1.a, t1.b FROM t1 WHERE row_num = 1;

WITH m AS (SELECT a, b FROM (VALUES (1, 2)) AS a1(a, b)), n AS (SELECT a, b FROM m WHERE m.a = 1), o AS (SELECT a, b FROM m WHERE m.a = 2) SELECT n.a, n.b, n.a, o.b FROM n FULL OUTER JOIN o ON n.a = o.a;

-- Pushdown predicate to HAVING (CNF)
SELECT x.cnt AS cnt FROM (SELECT COUNT(1) AS cnt FROM x AS x) AS x WHERE x.cnt > 0;

-- Pushdown predicate to HAVING (DNF)
SELECT x.cnt AS cnt FROM (SELECT COUNT(1) AS cnt, COUNT(x.a) AS cnt_a, COUNT(x.b) AS cnt_b FROM x AS x) AS x WHERE (x.cnt_a > 0 AND x.cnt_b > 0) OR x.cnt > 0;

SELECT x.a, u.val FROM x AS x CROSS JOIN UNNEST(ARRAY[0, 1]) AS u("val") WHERE x.a > u.val;

-- DNF: cross-table predicate is only pushed to the last eligible JOIN (not to an earlier JOIN that doesn't yet have all referenced tables in scope)
SELECT a.id, b.val, c.name FROM t_a AS a INNER JOIN t_b AS b ON b.a_id = a.id INNER JOIN t_c AS c ON c.b_id = b.id WHERE (b.flag = 1 AND c.active = 1) OR (b.flag = 2 AND c.active = 0);

-- DNF: single-table predicate is pushed to its own JOIN regardless of join order
SELECT a.id, b.val FROM t_a AS a INNER JOIN t_b AS b ON b.a_id = a.id WHERE (b.flag = 1 AND b.active = 1) OR (b.flag = 2 AND b.active = 0);

-- Predicate is not pushed into a subquery with LIMIT: filtering before the limit changes which rows the limit keeps
SELECT s.a FROM (SELECT a, b FROM x ORDER BY a LIMIT 10) AS s WHERE s.b = 1;

-- Predicate is not pushed into a subquery with OFFSET: filtering before the offset changes which rows are skipped
SELECT s.a FROM (SELECT a, b FROM x ORDER BY a OFFSET 3) AS s WHERE s.b = 1;

-- Predicate is not pushed into a subquery with QUALIFY: filtering before the window filter changes its results
SELECT s.a FROM (SELECT a, b FROM x QUALIFY ROW_NUMBER() OVER (ORDER BY a) <= 10) AS s WHERE s.b = 1;

-- DISTINCT ON selects a row before the outer filter runs
SELECT s.a FROM (SELECT DISTINCT ON (x.a) x.a, x.b FROM x ORDER BY x.a, x.b) AS s WHERE s.b > 0;

WITH s AS (SELECT DISTINCT ON (x.a) x.a, x.b FROM x ORDER BY x.a, x.b) SELECT s.a FROM s WHERE s.b > 0;

-- JOIN predicates must also remain outside DISTINCT ON
SELECT x.a, y.c FROM x JOIN (SELECT DISTINCT ON (y.b) y.b, y.c FROM y ORDER BY y.b, y.c) AS y ON x.b = y.b AND y.c > 0;

-- DNF predicates must not be copied below DISTINCT ON
SELECT s.a FROM (SELECT DISTINCT ON (x.a) x.a, x.b FROM x ORDER BY x.a, x.b) AS s WHERE (s.a = 1 AND s.b > 0) OR (s.a = 2 AND s.b > 1);

-- Plain DISTINCT still allows predicate pushdown
SELECT s.a FROM (SELECT DISTINCT x.a, x.b FROM x) AS s WHERE s.b > 0;

-- The RHS of a RIGHT JOIN is preserved, so a WHERE predicate on it can't become a match-only ON predicate
SELECT x.a, y.b FROM x RIGHT JOIN y ON x.a = y.b WHERE y.b = 3;

-- A WHERE predicate on the preserved RHS of a RIGHT JOIN can still be pushed into an isolated source
SELECT x.a, y.b FROM x RIGHT JOIN (SELECT b FROM y) AS y ON x.a = y.b WHERE y.b = 3;

-- A RIGHT JOIN preserves its own source, so an ON predicate can't be pushed into it as a filter
SELECT x.a, y.b FROM x RIGHT JOIN (SELECT b FROM y) AS y ON x.a = y.b AND y.b = 3;

-- A FULL JOIN preserves its own source, so an ON predicate can't be pushed into it as a filter
SELECT x.a, y.b FROM x FULL JOIN (SELECT b FROM y) AS y ON x.a = y.b AND y.b = 3;

-- A FULL JOIN preserves both sides, so a WHERE predicate on either of them can't be pushed down
SELECT x.a, y.b FROM x FULL JOIN y ON x.a = y.b WHERE y.b = 3;

-- That covers anything joined before the FULL JOIN too, not just the FROM source
SELECT x.a, z.b FROM x JOIN z ON x.b = z.b FULL JOIN y ON x.b = y.b WHERE z.b = 3;

SELECT x.a, z.b FROM x JOIN (SELECT b FROM z) AS z ON x.b = z.b FULL JOIN y ON x.b = y.b WHERE z.b = 3;

-- A later RIGHT JOIN null-extends the source of an earlier one
SELECT x.a, z.b FROM x RIGHT JOIN z ON x.b = z.b RIGHT JOIN y ON x.b = y.b WHERE z.b = 3;
