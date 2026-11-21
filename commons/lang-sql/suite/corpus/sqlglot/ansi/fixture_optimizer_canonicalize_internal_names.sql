SELECT a FROM x;

SELECT a FROM x WHERE b > 5;

SELECT * FROM x;

SELECT a, b FROM x;

WITH t AS (SELECT a, b FROM x) SELECT * FROM t;

WITH t1 AS (SELECT a FROM x), t2 AS (SELECT b FROM y) SELECT t1.a, t2.b FROM t1 JOIN t2 ON t1.a = t2.b;

SELECT x.a, y.c FROM x CROSS JOIN y;

SELECT x.a, y.c FROM x JOIN y ON x.b = y.b;

SELECT a.a, b.b FROM x AS a JOIN x AS b ON a.a = b.b;

SELECT t.a FROM (SELECT a FROM x) AS t;

SELECT t.p, t.q FROM (SELECT a, b FROM x) AS t(p, q);

SELECT t.a FROM (SELECT t.a FROM (SELECT a FROM x) AS t) AS t;

SELECT a FROM x WHERE b IN (SELECT b FROM y);

SELECT a FROM x WHERE EXISTS (SELECT 1 FROM y WHERE y.b = x.b);

SELECT a, COUNT(b) FROM x GROUP BY a HAVING COUNT(b) > 1;

SELECT a + 1 FROM x;

SELECT a, b FROM x ORDER BY a LIMIT 10;

SELECT a, b FROM x ORDER BY 1 DESC;

SELECT a, COUNT(b) FROM x GROUP BY 1;

SELECT a, b, COUNT(*) FROM x GROUP BY 1, 2;

SELECT a FROM x UNION SELECT b FROM y;

SELECT CASE WHEN a > 0 THEN b ELSE a END FROM x;

SELECT x.a, y.b, z.c FROM x JOIN y ON x.b = y.b JOIN z ON y.c = z.c;

SELECT structs.one.a_1 FROM structs;

SELECT structs.nested_0.nested_1.a_2 FROM structs;

SELECT structs.one.b_1 FROM structs WHERE structs.one.a_1 > 0;

SELECT j['name'] FROM jtbl WHERE j['age'] > 18;

SELECT j['a']['b'] FROM jtbl;

SELECT JSON_EXTRACT(j, '$.field') FROM jtbl;

SELECT t.i, t.s FROM (VALUES (1, 'a'), (2, 'b')) AS t(i, s);

SELECT a, ROW_NUMBER() OVER (PARTITION BY a ORDER BY b) AS rn FROM x;

SELECT x.a, (SELECT MAX(y.c) FROM y) AS m FROM x;

SELECT a, (SELECT MAX(y.c) FROM y) FROM x UNION ALL SELECT a, (SELECT MAX(y.c) FROM y) FROM x;

WITH t AS (SELECT a, (SELECT MAX(y.c) FROM y) FROM x) SELECT a FROM t;

SELECT * FROM x JOIN y USING (b);

SELECT a FROM x UNION SELECT b FROM y UNION SELECT c FROM z;

SELECT SUM(a) FILTER (WHERE b > 0) FROM x;

WITH RECURSIVE cte AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM cte WHERE n < 5) SELECT * FROM cte;

WITH t AS (SELECT a AS foo FROM x) SELECT foo FROM t;

SELECT a + 1 AS total FROM x;

WITH t AS (SELECT a + 1 AS total FROM x) SELECT total FROM t;

WITH t AS (SELECT a + 1 AS total FROM x ORDER BY total) SELECT total FROM t;

MERGE INTO x USING (SELECT b FROM y) AS s ON x.b = s.b WHEN MATCHED THEN UPDATE SET a = 1;
