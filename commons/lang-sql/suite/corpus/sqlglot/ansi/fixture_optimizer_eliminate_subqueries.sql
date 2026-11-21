-- No derived tables
SELECT * FROM x;

-- Unaliased derived tables
SELECT a FROM (SELECT b FROM (SELECT c FROM x));

-- Joined derived table inside nested derived table
SELECT b FROM (SELECT b FROM (SELECT b FROM x JOIN (SELECT b FROM y) AS y ON x.b = y.b));

-- Aliased derived tables
SELECT a FROM (SELECT b FROM (SELECT c FROM x) AS y) AS z;

-- Existing CTEs
WITH q AS (SELECT c FROM x) SELECT a FROM (SELECT b FROM q AS y) AS z;

-- Derived table inside CTE
WITH x AS (SELECT a FROM (SELECT a FROM x) AS y) SELECT a FROM x;

-- Name conflicts with existing outer derived table
SELECT a FROM (SELECT b FROM (SELECT c FROM x) AS y) AS y;

-- Name conflicts with outer join
SELECT a, b FROM (SELECT c FROM (SELECT d FROM x) AS x) AS y JOIN x ON x.a = y.a;

-- Name conflicts with table name that is selected in another branch
SELECT * FROM (SELECT * FROM (SELECT a FROM x) AS x) AS y JOIN (SELECT * FROM x) AS z ON x.a = y.a;

-- Name conflicts with table alias
SELECT a FROM (SELECT a FROM (SELECT a FROM x) AS y) AS z CROSS JOIN q AS y;

-- Name conflicts with existing CTE
WITH y AS (SELECT a FROM (SELECT a FROM x) AS y) SELECT a FROM y;

-- Union of selects with derived tables
(SELECT a FROM (SELECT b FROM x)) UNION (SELECT a FROM (SELECT b FROM y));

-- Subquery
SELECT a FROM x WHERE b = (SELECT y.c FROM y);

-- Correlated subquery
SELECT a FROM x WHERE b = (SELECT c FROM y WHERE y.a = x.a);

-- Duplicate CTE
SELECT a FROM (SELECT b FROM x) AS y CROSS JOIN (SELECT b FROM x) AS z;

-- Case-sensitive recursive JSON paths must not share a CTE
SELECT x.v, y.v FROM (SELECT JSON_EXTRACT(j, '$..Key') AS v FROM t) AS x JOIN (SELECT JSON_EXTRACT(j, '$..key') AS v FROM t) AS y ON x.v = y.v;

-- Doubly duplicate CTE
SELECT * FROM (SELECT * FROM x JOIN (SELECT * FROM x) AS y) AS z JOIN (SELECT * FROM x JOIN (SELECT * FROM x) AS y) AS q;

-- Another duplicate...
SELECT x.id FROM (SELECT * FROM x AS x JOIN y AS y ON x.id = y.id) AS x JOIN (SELECT * FROM x AS x JOIN y AS y ON x.id = y.id) AS y ON x.id = y.id;

-- Root subquery
(SELECT * FROM (SELECT * FROM x)) LIMIT 1;

-- Existing duplicate CTE
WITH y AS (SELECT a FROM x) SELECT a FROM (SELECT a FROM x) AS y CROSS JOIN y AS z;

-- Nested CTE
WITH cte1 AS (SELECT a FROM x) SELECT a FROM (WITH cte2 AS (SELECT a FROM cte1) SELECT a FROM cte2);

-- Nested CTE inside CTE
WITH cte1 AS (WITH cte2 AS (SELECT a FROM x) SELECT t.a FROM cte2 AS t) SELECT a FROM cte1;

-- Duplicate CTE nested in CTE
WITH cte1 AS (SELECT a FROM x), cte2 AS (WITH cte3 AS (SELECT a FROM x) SELECT a FROM cte3) SELECT a FROM cte2;

-- Wrapped subquery joined with table
SELECT * FROM ((SELECT c FROM t1) JOIN t2);

-- Wrapped subquery with redundant parentheses
SELECT * FROM (((SELECT * FROM tbl)));

-- CTE hoisted from a DML value-position subquery stays within that subquery
UPDATE t SET x = (SELECT a FROM (SELECT a FROM x) AS y);

-- Derived table under a DML FROM clause is not eliminated; subqueries nested in it are hoisted within the fragment
WITH c AS (SELECT 1 AS y) UPDATE t SET x = 1 FROM (SELECT x FROM (SELECT x FROM t2) AS i) AS s;

-- CTE hoisted from a MERGE USING subquery stays within that subquery
MERGE INTO t USING (SELECT id FROM (SELECT id FROM u) AS i) AS s ON t.id = s.id WHEN MATCHED THEN UPDATE SET x = 1;
