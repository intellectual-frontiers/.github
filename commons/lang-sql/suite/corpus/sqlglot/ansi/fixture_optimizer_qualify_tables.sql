SELECT 1 FROM z;

SELECT 1 FROM y.z;

SELECT 1 FROM x.y.z;

SELECT 1 FROM x.y.z AS z;

WITH a AS (SELECT 1 FROM z) SELECT 1 FROM a;

WITH a AS (SELECT 1 FROM z) SELECT 1 FROM a CROSS JOIN a;

SELECT (SELECT y.c FROM y AS y) FROM x;

SELECT * FROM x PIVOT (SUM(a) FOR b IN ('a', 'b'));

SELECT * FROM x PIVOT (SUM(a) FOR b IN ('a', 'b')) AS piv;

SELECT * FROM (tbl);

SELECT * FROM (tbl AS tbl);

SELECT * FROM ((((tbl AS tbl))));

SELECT * FROM (t1 CROSS JOIN t2);

SELECT * FROM (t1 CROSS JOIN t2) AS t;

SELECT * FROM ((a CROSS JOIN b) CROSS JOIN c);

SELECT * FROM (a CROSS JOIN (b CROSS JOIN c));

SELECT * FROM ((a CROSS JOIN ((b CROSS JOIN c) CROSS JOIN d)));

SELECT * FROM ((a CROSS JOIN ((b CROSS JOIN c) CROSS JOIN (d CROSS JOIN e))));

SELECT * FROM ((a AS foo CROSS JOIN b AS bar) CROSS JOIN c AS baz);

SELECT * FROM (tbl1 CROSS JOIN (SELECT * FROM tbl2) AS t1);

SELECT * FROM (tbl1 CROSS JOIN (SELECT * FROM tbl2) AS t1) AS t2;

SELECT * FROM a LEFT JOIN (b INNER JOIN c ON c.id = b.id) ON b.id = a.id;

SELECT * FROM a LEFT JOIN b INNER JOIN c ON c.id = b.id ON b.id = a.id;

SELECT t.a FROM (tbl AS tbl) AS t;

SELECT * FROM ((((tbl AS tbl)))) AS _0;

SELECT * FROM (tbl1 AS tbl1 JOIN tbl2 AS tbl2 ON id1 = id2 JOIN tbl3 AS tbl3 ON id1 = id3) AS _0;

SELECT * FROM ((tbl1 AS tbl1 JOIN tbl2 AS tbl2 ON id1 = id2 JOIN tbl3 AS tbl3 ON id1 = id3)) AS _0;

SELECT * FROM ((t1 CROSS JOIN t2) CROSS JOIN t3) AS t;

SELECT * FROM ((SELECT * FROM t1) CROSS JOIN t2) AS t;

SELECT * FROM (tbl1 AS tbl1 JOIN (tbl2 AS tbl2 JOIN tbl3 AS tbl3 ON id2 = id3) AS _0 ON id1 = id3) AS _1;

SELECT * FROM ((SELECT * FROM t));

SELECT * FROM ((SELECT * FROM t1) INNER JOIN t2 ON a = b);

SELECT x FROM t, LATERAL UNNEST(t.xs) AS x;

SELECT x FROM t, LATERAL UNNEST(t.xs);

SELECT x FROM t, LATERAL UNNEST(t.xs), LATERAL UNNEST(t.ys);

SELECT * FROM t CROSS JOIN JSON_ARRAY_ELEMENTS(t.response) WITH ORDINALITY AS kv_json;

ALTER TABLE t ADD PRIMARY KEY (id) NOT ENFORCED;

CREATE TABLE t1 AS (WITH cte AS (SELECT x FROM t2) SELECT * FROM cte);

DELETE FROM t1 WHERE NOT c IN (SELECT c FROM t2);

(SELECT x FROM t);

SELECT db1.a.id, db2.a.id FROM db1.a JOIN db2.a ON db1.a.id = db2.a.id;

SELECT cat.db1.a.id, db2.a.id FROM cat.db1.a JOIN db2.a ON cat.db1.a.id = db2.a.id;

COPY INTO (SELECT * FROM x) TO 'data' WITH (FORMAT 'CSV');

SELECT 1 FROM x TABLESAMPLE SYSTEM (10 PERCENT) CROSS JOIN y TABLESAMPLE SYSTEM (10 PERCENT);

WITH cte_tbl AS (SELECT 1 AS col2) UPDATE y SET col1 = (SELECT * FROM x) WHERE EXISTS(SELECT 1 FROM cte_tbl);

WITH cte AS (SELECT 1 AS c, 'name' AS name) UPDATE t SET name = cte.name FROM cte WHERE cte.c = 1;

WITH cte AS (SELECT 1 AS c, 'name' AS name) DELETE t FROM t AS t INNER JOIN cte ON t.id = cte.c;

SELECT * FROM t;

SELECT * FROM t1 JOIN t2 ON t1.id = t2.id;

SELECT * FROM db1.users JOIN db2.users ON db1.users.id = db2.users.id;

WITH cte AS (SELECT * FROM t) SELECT * FROM cte;

SELECT * FROM (SELECT * FROM t);

SELECT * FROM t1, (SELECT * FROM t2) AS sub, t3;

WITH cte AS (SELECT * FROM t) SELECT * FROM cte PIVOT(SUM(c) FOR v IN ('x', 'y'));

SELECT * FROM x WHERE x.a = (SELECT SUM(y.c) AS c FROM y WHERE y.a = x.a LIMIT 10);

SELECT t.foo FROM t AS t, (SELECT t.bar FROM t AS t);

SELECT t.a, x FROM t, UNNEST(t.arr) AS x;

SELECT t.a, x, z FROM t, UNNEST(t.arr) AS x, UNNEST(x.b) AS z;
