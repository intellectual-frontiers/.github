SELECT CASE WHEN x.a > 1 THEN x.b WHEN TRUE THEN 2 END AS result FROM x;

SELECT a, m FROM z LATERAL VIEW EXPLODE([1, 2]) q AS m;

SELECT x FROM UNNEST([1, 2]) AS q(x, y);

WITH cte AS (
    (
        SELECT
            a
            FROM
            x
    )
    UNION ALL
    (
        SELECT
            b AS a
        FROM
            y
    )
)
SELECT
    *
FROM
    cte;

WITH cte1 AS (
    SELECT a
    FROM x
), cte2 AS (
    SELECT a + 1 AS a
    FROM cte1
)
SELECT
    a
FROM cte1
UNION ALL
SELECT
    a
FROM cte2;

SELECT a, SUM(b) AS sum_b
FROM (
    SELECT x.a, y.b
    FROM x, y
    WHERE (SELECT max(b) FROM y WHERE x.b = y.b) >= 0 AND x.b = y.b
) d
WHERE (TRUE AND TRUE OR 'a' = 'b') AND a > 1
GROUP BY a;

(SELECT a FROM x) LIMIT 1;

(SELECT b FROM x UNION SELECT b FROM y ORDER BY b) LIMIT 1;

SELECT AGGREGATE(ARRAY(x.a, x.b), 0, (x, acc) -> x + acc + a) AS sum_agg FROM x;

SELECT cola, colb FROM (VALUES (1, 'test'), (2, 'test2')) AS tab(cola, colb);

WITH m AS (
  SELECT a, b FROM (VALUES (1, 2)) AS a1(a, b)
), n AS (
  SELECT a, b FROM m WHERE m.a = 1
), o AS (
  SELECT a, b FROM m WHERE m.a = 2
) SELECT
    n.a,
    n.b,
    o.b
FROM n
FULL OUTER JOIN o ON n.a = o.a
CROSS JOIN n AS n2
WHERE o.b > 0 AND n.a = n2.a;

WITH cte1 AS (
  WITH cte2 AS (
    SELECT a, b FROM x
  )
  SELECT a1
  FROM (
    WITH cte3 AS (SELECT 1)
    SELECT a AS a1, b AS b1 FROM cte2
  )
)
SELECT a1 FROM cte1;

WITH RECURSIVE cte1 AS (
  SELECT *
  FROM (
      SELECT 1 AS a, 2 AS b
  ) base
  CROSS JOIN (SELECT 3 c) y
  UNION ALL
  SELECT *
  FROM cte1
  WHERE a < 1
)
SELECT *
FROM cte1;

SELECT x.a, y.b
FROM x
RIGHT JOIN y
ON x.a = y.b
WHERE x.b = 1;

SELECT x.a, y.b
FROM x
RIGHT JOIN y
ON x.a = y.b
WHERE y.b = 1;

SELECT x.a + 1 AS c, c + 1 AS d FROM x;

SELECT x.a + 1 AS b, b + 1 AS c FROM x;

WITH "cte" AS (
  SELECT
    FROM_JSON("value", 'STRUCT<f1: STRUCT<f2: STRUCT<f3: STRUCT<f4: STRING>>>>') AS "struct"
  FROM "tbl"
) SELECT "struct"."f1"."f2"."f3"."f4" AS "f4" FROM "cte";

WITH "cte" AS (
  SELECT
    FROM_JSON("value", 'STRUCT<f1: STRUCT<f2: INTEGER>, STRUCT<f3: STRING>>') AS "struct"
  FROM "tbl"
) SELECT "cte"."struct"."f1"."f2" AS "f2", "cte"."struct"."f1"."f3" AS "f3" FROM "cte";

SELECT
  main_query.id,
  main_query.score
FROM (
  SELECT
    alias_1.id,
    score
  FROM (
    SELECT
      company_table.score AS score,
      id
    FROM company_table
  ) AS alias_1
  JOIN (
    SELECT
      id
    FROM (
      SELECT
        company_table_2.id,
        CASE WHEN unlocked.company_id IS NULL THEN 0 ELSE 1 END AS is_exported
      FROM company_table AS company_table_2
      LEFT JOIN unlocked AS unlocked
        ON company_table_2.id = unlocked.company_id
    )
    WHERE
      NOT id IS NULL AND is_exported = FALSE
  ) AS alias_2
    ON (
      alias_1.id = alias_2.id
    )
) AS main_query;

select * from db1.tbl, db2.tbl;

SELECT
*,
IFF(
  IFF(
	uploaded_at >= '2022-06-16',
	'workday',
	'bamboohr'
  ) = source_system,
  1,
  0
) AS sort_order
FROM
unioned
WHERE
(
  source_system = 'workday'
  AND '9999-01-01' >= '2022-06-16'
)
OR (
  source_system = 'bamboohr'
  AND '0001-01-01' < '2022-06-16'
) QUALIFY ROW_NUMBER() OVER (
  PARTITION BY unique_filter_key
  ORDER BY
	sort_order DESC,
	1
) = 1;

SELECT * FROM (SELECT a, b, c FROM sc.tb) PIVOT (SUM(c) FOR b IN ('x','y','z'));

SELECT * EXCEPT (x), CAST(x AS TEXT) AS x FROM (SELECT a, b, c FROM sc.tb) PIVOT (SUM(c) FOR b IN ('x','y','z'));

SELECT * FROM (SELECT * FROM u) PIVOT (SUM(f) FOR h IN ('x', 'y'));

SELECT piv.x, piv.y FROM (SELECT f, h FROM u) PIVOT (SUM(f) FOR h IN ('x', 'y')) AS piv;

SELECT x, y FROM u PIVOT (SUM(f) FOR h IN ('x', 'y'));

SELECT * FROM (SELECT * FROM m_sales) AS m_sales(empid, dept, jan, feb) UNPIVOT(sales FOR month IN (jan, feb)) AS unpiv(a, b, c, d);

SELECT "foO".x FROM (SELECT 1 AS x) AS "foO";

SELECT a + 1 + 1 + 1 + 1 AS b, 2 + 1 AS c FROM x GROUP BY a + 1 + 1 HAVING a + 1 + 1 + 1 + 1 > 1;

WITH cte AS (SELECT a * b AS c, a AS d, b as e FROM x) SELECT c + d - (c - e) AS f FROM cte;

SELECT * FROM (tbl);

SELECT * FROM (tbl AS tbl);

SELECT a, c FROM (x LEFT JOIN y ON a = c);

SELECT a, c FROM (x LEFT JOIN y ON a = c) AS t;

SELECT * FROM ((a CROSS JOIN ((b CROSS JOIN c) CROSS JOIN (d CROSS JOIN e))));

SELECT * FROM ((a AS foo CROSS JOIN b AS bar) CROSS JOIN c AS baz);

SELECT x.a, y.b, z.c FROM x LEFT JOIN (y INNER JOIN z ON y.c = z.c) ON x.b = y.b;

SELECT * FROM x LEFT JOIN (y INNER JOIN z ON y.c = z.c) ON x.b = y.b;

SELECT * FROM ((SELECT * FROM tbl));

SELECT * FROM ((SELECT * FROM x) INNER JOIN y ON a = c);

SELECT * FROM ((SELECT c FROM t1) JOIN t2);

SELECT b FROM ((SELECT a FROM x) INNER JOIN y ON a = b);

SELECT * FROM ((SELECT * FROM t1) JOIN (SELECT * FROM t2));

SELECT * FROM ((SELECT * FROM x) INNER JOIN (SELECT * FROM y) ON a = c);

SELECT a, SUM(c) / (SELECT SUM(c) FROM y) * 100 AS foo FROM y INNER JOIN x ON y.b = x.b GROUP BY a;

SELECT x.a, (SELECT COUNT(*) FROM y WHERE y.b = x.a) FROM x;

WITH cte(x, y) AS (SELECT 1, 2) SELECT * FROM cte AS cte(a);

WITH cte(x) AS (SELECT 1) SELECT a FROM cte AS cte(a);

WITH m(a) AS (SELECT 1), n(b) AS (SELECT 1) SELECT * FROM m JOIN n AS foo(a) USING (a);

SELECT CONCAT('a', 'b') || CONCAT(CONCAT('c', 'd'), CONCAT('e', 'f')) + ('g' || 'h' || 'i');

with
    alias1 as (select * from table1),
    alias2 as (select * from table2),
    alias3 as (
        select
            cid,
            min(od) as m_od,
            count(odi) as c_od,
        from alias2
        group by 1
    )
select
    alias1.cid,
    alias3.m_od,
    coalesce(alias3.c_od, 0) as c_od,
from alias1
left join alias3 using (cid);

WITH x AS (
  SELECT a FROM t
)
(
  SELECT * FROM x
  UNION ALL
  SELECT * FROM x
  LIMIT 10
)
LIMIT 10;

SELECT
  a.company,
  b.num
FROM route AS a(num, company, pos, stop)
JOIN route AS b(num, company, pos, stop) ON (a.num = b.num)
JOIN stops AS c(id, name) ON (c.id = b.stop)
JOIN stops AS d(id, name) ON (d.id = c.id)
WHERE
  c.name = 'Craiglockhart'
  OR d.name = 'Tollcross';

SELECT
  *
FROM event
WHERE priority = 'High' AND tagname IN (
  SELECT
    tag_input AS tagname
  FROM cascade
  WHERE tag_input = 'XXX' OR tag_output = 'XXX'
  UNION
  SELECT
    tag_output AS tagname
  FROM cascade
  WHERE tag_input = 'XXX' OR tag_output = 'XXX'
);

WITH t1 AS (
    SELECT NULL AS id1
),
t2 AS (
    SELECT 1 AS id2
),
t3 AS (
    SELECT 'info' AS info
)
SELECT 
  t1.id1 AS id1,
  t2.id2 AS id2,
  t3.info AS info
FROM t1
RIGHT JOIN t2 AS t2
  ON t1.id1 = t2.id2
RIGHT JOIN t3 ON TRUE;

WITH t3 AS (SELECT t1.c1::bigint AS ref1 FROM (SELECT MAX(x.a) as c1 FROM x) t1 JOIN GENERATE_SERIES((SELECT MAX(a) FROM x), 10, 1) AS t2(c1) on t2.c1 > t1.c1) SELECT * FROM t3;

SELECT t1.c1 FROM z AS z RIGHT JOIN GENERATE_SERIES((SELECT MIN(x.a) FROM x), 10, 1) AS t1(c1) ON t1.c1 > z.c;

SELECT CASE WHEN TRUE THEN (SELECT 1) ELSE (SELECT 2) END AS result;

SELECT CAST(x.a - x.b AS INT) * 2 AS c FROM x AS x;

SELECT -CAST(x.a - x.b AS INT) AS c FROM x AS x;

SELECT CAST(x.a * x.b AS INT) + 2 AS c FROM x AS x;

SELECT CAST(x.a > 0 OR x.b > 0 AS BOOLEAN) IN (FALSE) AS c FROM x AS x;

SELECT CAST(x.a BETWEEN 1 AND 3 AS BOOLEAN) = (x.b > 0) AS c FROM x AS x;

SELECT CAST(NOT x.a > 0 AS BOOLEAN) = (x.b > 0) AS c FROM x AS x;

SELECT x.a, y.b, z.b, w.c FROM (x LEFT JOIN y ON x.b = y.b) INNER JOIN (y AS z LEFT JOIN y AS w ON z.c = w.c) ON y.c = z.b ORDER BY x.a, y.b, z.b, w.c;
