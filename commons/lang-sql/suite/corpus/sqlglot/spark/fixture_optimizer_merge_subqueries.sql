WITH m AS (SELECT x.a, x.b FROM x), n AS (SELECT y.b, y.c FROM y), joined as (SELECT /*+ BROADCAST(k) */ m.a, k.c FROM m JOIN n AS k ON m.b = k.b) SELECT joined.a, joined.c FROM joined;

WITH m AS (SELECT x.a, x.b FROM x), n AS (SELECT y.b, y.c FROM y), joined as (SELECT /*+ BROADCAST(m, n) */ m.a, n.c FROM m JOIN n ON m.b = n.b) SELECT joined.a, joined.c FROM joined;

WITH m AS (SELECT x.a, x.b FROM x), n AS (SELECT y.b, y.c FROM y), joined as (SELECT /*+ BROADCAST(m), MERGE(m, n) */ m.a, n.c FROM m JOIN n ON m.b = n.b) SELECT joined.a, joined.c FROM joined;

WITH m AS (SELECT x.a, x.b FROM x), n AS (SELECT y.b, y.c FROM y), joined as (SELECT /*+ BROADCAST(m), MERGE(m, n) */ m.a, n.c FROM m JOIN n ON m.b = n.b) SELECT /*+ COALESCE(3) */ joined.a, joined.c FROM joined;

SELECT
    subquery.a,
    subquery.c
FROM (
    SELECT /*+ BROADCAST(m), MERGE(m, n) */ m.a, n.c FROM (SELECT x.a, x.b FROM x) AS m JOIN (SELECT y.b, y.c FROM y) AS n ON m.b = n.b
) AS subquery;

SELECT /*+ BROADCAST(x) */
  x.a,
  x.c
FROM (
  SELECT
    x.a,
    x.c
  FROM (
    SELECT
      x.a,
      COUNT(1) AS c
    FROM x
    GROUP BY x.a
  ) AS x
) AS x;

WITH t1 AS (
  SELECT
    a1.cola
  FROM
    VALUES (1) AS a1(cola)
), t2 AS (
  SELECT
    a2.cola
  FROM
    VALUES (1) AS a2(cola)
)
SELECT /*+ BROADCAST(t2) */
  t1.cola,
  t2.cola,
FROM
  t1
  JOIN
  t2
  ON
    t1.cola = t2.cola;
