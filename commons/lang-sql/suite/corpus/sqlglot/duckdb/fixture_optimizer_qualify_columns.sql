WITH x AS (SELECT * FROM (VALUES (1, 10), (2, 10), (3, 20)) AS v(a, b)) SELECT (SELECT MAX(t.a) FROM x AS t) + x.b AS f FROM x GROUP BY f ORDER BY f;

SELECT r FROM range(3) AS r(range);

SELECT r.range AS x FROM range(3) AS r ORDER BY SUM(x) OVER ();

SELECT range + 1 AS range FROM range(3) AS r;

SELECT range + 1 AS x FROM range(3) AS r(range) WHERE x > 1;

SELECT x, y + 1 FROM READ_PARQUET('data.parquet') AS r WHERE x > 0;

SELECT payload.field AS payload FROM READ_PARQUET('data.parquet') AS r;

SELECT *, x FROM READ_PARQUET('data.parquet') AS r;

SELECT id AS email FROM t ORDER BY email LIKE 'a%' DESC, id;

SELECT id AS email FROM t ORDER BY email, (email), 1;

SELECT DISTINCT ON (email || '') id AS email FROM t;

SELECT (SELECT x FROM (SELECT 1 AS y) AS x) AS v FROM (SELECT 2 AS x) AS t;

SELECT * FROM (SELECT 1 AS foo, 2 AS bar UNION ALL BY NAME SELECT 3 AS bar, 4 AS baz) ORDER BY bar;

SELECT baz FROM (SELECT 1 AS foo, 2 AS bar UNION BY NAME SELECT 3 AS bar, 4 AS baz) AS t ORDER BY baz;

WITH cities AS (SELECT * FROM (VALUES ('nl', 'amsterdam', 2000, 1005)) AS t(country, name, year, population)) SELECT * FROM cities PIVOT(SUM(population) AS total, COUNT(population) AS count FOR country IN ('nl', 'us') year IN (2000, 2010) name IN ('amsterdam', 'seattle'));

SELECT * REPLACE(b * 2 AS b) FROM x JOIN y USING (b);

SELECT * RENAME(b AS new_b) FROM x FULL JOIN y USING (b);

SELECT * REPLACE(b * 2 AS b), * FROM x JOIN y USING (b);

SELECT * RENAME(b AS new_b), * FROM x FULL JOIN y USING (b);

SELECT x.* REPLACE(b * 2 AS b), x.* FROM x;

SELECT * EXCLUDE(b), * FROM x;

SELECT * FROM x JOIN y USING(b);

SELECT * FROM x LEFT JOIN y USING(b);

SELECT * FROM x NATURAL JOIN y;

SELECT v FROM t, LATERAL (SELECT rel.a AS v) AS l;

SELECT v FROM t, UNNEST(rel.arr) AS l(v);

SELECT k, ANY_VALUE(j.Foo) AS v FROM t GROUP BY k ORDER BY ANY_VALUE(j.Foo), ANY_VALUE(j.foo);

SELECT DISTINCT ON (ANY_VALUE(j.Foo || j.foo), ANY_VALUE(j.foo || j.Foo)) k, ANY_VALUE(j.Foo || j.foo) AS v FROM t GROUP BY k;

SELECT * FROM x SEMI JOIN y USING (b);

SELECT * FROM x ANTI JOIN y USING (b);

SELECT s.k FROM (VALUES (1, 10, {'k': 10}), (2, 20, {'k': 99})) AS t(id, k, s) SEMI JOIN (VALUES (20)) AS s(k) ON t.k = s.k WHERE s.k > 0;

SELECT s.k FROM (VALUES (1, 10, {'k': 10}), (2, 20, {'k': 99})) AS t(id, k, s) ANTI JOIN (VALUES (20)) AS s(k) ON t.k = s.k JOIN (VALUES (10)) AS u(k) ON s.k = u.k;

SELECT s.k FROM (VALUES (1, 10, {'k': 10}), (2, 20, {'k': 99})) AS t(id, k, s) JOIN (VALUES (99)) AS u(k) ON s.k = u.k SEMI JOIN (VALUES (20)) AS s(k) ON t.k = s.k;

SELECT t.k FROM (VALUES (20, {'k': 99})) AS t(k, s) SEMI JOIN (VALUES ({'k': 20})) AS s(payload) ON t.k = s.payload.k CROSS JOIN (VALUES (1)) AS payload(v);

SELECT s.k, u.k FROM (VALUES (20, {'k': 99}, {'k': 88})) AS t(k, s, u) SEMI JOIN (VALUES (20)) AS s(k) ON t.k = s.k AND s.k = 20 ANTI JOIN (VALUES (20)) AS u(k) ON t.k = u.k AND s.k = 20;

SELECT t.id FROM (VALUES (1, 10, {'k': 10}), (2, 20, {'k': 99})) AS t(id, k, s) SEMI JOIN (VALUES (1)) AS s(v) ON t.k = s.k;

SELECT t.id FROM (VALUES (1, 10, {'payload': {'k': 10}}), (2, 20, {'payload': {'k': 99}})) AS t(id, k, s) ANTI JOIN (VALUES (1)) AS s(v) ON t.k = s.payload.k;

SELECT b FROM x SEMI JOIN y USING (b);

SELECT a FROM x ANTI JOIN y USING (b) WHERE b > 0;

SELECT * FROM x SEMI JOIN y USING (b) JOIN y USING (b);

SELECT * FROM x ANTI JOIN y USING (b) JOIN y USING (b);

WITH t AS (SELECT 1 AS id, 100 AS jan, 200 AS feb, 7 AS north, 8 AS south) SELECT * FROM t UNPIVOT(revenue FOR month IN (jan, feb)) UNPIVOT(headcount FOR region IN (north, south));

SELECT * FROM unpivotable UNPIVOT(revenue FOR month IN (jan, feb)) UNPIVOT(headcount FOR region IN (north, south));

WITH t AS (SELECT 1 AS id, 100 AS jan, 200 AS feb, 7 AS north, 8 AS south) SELECT u.month, u.headcount FROM t UNPIVOT(revenue FOR month IN (jan, feb)) UNPIVOT(headcount FOR region IN (north, south)) AS u;

SELECT * FROM pivotable PIVOT(SUM(val) FOR cat IN ('a' AS a, 'b' AS b)) PIVOT(SUM(amt) FOR kind IN ('x' AS x, 'y' AS y));

SELECT * FROM pivotable PIVOT(SUM(val) FOR cat IN ('a' AS a, 'b' AS b)) UNPIVOT(v FOR c IN (a, b));

SELECT * FROM x JOIN unpivotable UNPIVOT(revenue FOR month IN (jan, feb)) AS u ON x.a = u.id;

SELECT u.* FROM unpivotable UNPIVOT(revenue FOR month IN (jan, feb)) AS u;

SELECT x.b, u.* FROM x JOIN unpivotable UNPIVOT(revenue FOR month IN (jan, feb)) AS u ON x.a = u.id;

WITH c AS (SELECT id, jan, feb FROM unpivotable) SELECT piv.* FROM c UNPIVOT(revenue FOR month IN (jan, feb)) AS piv;

WITH c AS (SELECT id, jan, feb FROM unpivotable) SELECT piv.* FROM c AS m UNPIVOT(revenue FOR month IN (jan, feb)) AS piv;

SELECT piv.* FROM (SELECT id, jan, feb FROM unpivotable) UNPIVOT(revenue FOR month IN (jan, feb)) AS piv;

SELECT u.* FROM unpivotable UNPIVOT(revenue FOR month IN (jan, feb)) UNPIVOT(headcount FOR region IN (north, south)) AS u;
