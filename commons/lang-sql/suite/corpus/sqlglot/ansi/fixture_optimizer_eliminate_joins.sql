SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT DISTINCT
    y.b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT DISTINCT ON (y.c)
    y.b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT DISTINCT ON (y.b)
    y.b
  FROM y
  GROUP BY y.b
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT DISTINCT ON (y.b)
    y.b
  FROM y
  LIMIT 1
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b,
    SUM(y.c)
  FROM y
  GROUP BY y.b
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    SUM(y.b) AS b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT DISTINCT
    y.b,
    y.c
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b,
    y.c
  FROM y
  GROUP BY
    y.b,
    y.c
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
JOIN (
  SELECT DISTINCT
    y.b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  a
FROM x
LEFT JOIN (
  SELECT DISTINCT
    y.b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  a
FROM x
CROSS JOIN (
  SELECT DISTINCT
    y.b
  FROM y
) AS y;

SELECT
  x.a,
  y.b
FROM x
LEFT JOIN (
  SELECT DISTINCT
    y.b
  FROM y
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b,
    y.c + 1 AS d,
    COUNT(1)
  FROM y
  GROUP BY y.b, y.c + 1
) AS y
  ON x.b = y.b
  AND 1 = y.d;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
  GROUP BY y.b
) AS y
  ON x.b = y.b
LEFT JOIN (
  SELECT
    y.b AS c
  FROM y
  GROUP BY y.b
) AS z
  ON y.b = z.c;

WITH z AS (
  SELECT DISTINCT
    y.b
  FROM y
)
SELECT
  x.a
FROM x
LEFT JOIN z
  ON x.b = z.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b
  FROM y
  GROUP BY
    y.b,
    y.c
) AS y
  ON x.b = y.b;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    SUM(y.b) AS b
  FROM y
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    y.b AS b
  FROM y
  LIMIT 1
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    1 AS b,
    2 AS c
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    y.b
  FROM y
) AS y;

SELECT
  x.b
FROM x
LEFT ANTI JOIN (
  SELECT
    1 AS b
) AS sub
  ON x.b = sub.b;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    1 AS b
  WHERE
    FALSE
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    COUNT(*) AS b
  FROM y
  HAVING
    FALSE
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    COUNT(*) AS b
  FROM y
  GROUP BY
    y.b
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    1 AS b
  OFFSET 1
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    COUNT(*) AS b
  FROM y
  QUALIFY
    ROW_NUMBER() OVER () > 1
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    COUNT(*) AS b
  FROM y
  WHERE
    FALSE
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    UNNEST(ARRAY(1, 1)) AS b
) AS y;

SELECT
  x.a
FROM x
CROSS JOIN (
  SELECT
    COUNT(*) AS b,
    UNNEST(ARRAY(1, 2)) AS c
  FROM y
) AS y;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    UNNEST(ARRAY(1, 1)) AS b
) AS y
  ON x.a = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
  FETCH FIRST 1 ROWS ONLY
) AS y
  ON x.a = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
) AS y
  ON x.a = y.b;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
  WHERE
    y.b > 100
  LIMIT 1
) AS y
  ON x.a = y.b;

SELECT x.a FROM x LEFT JOIN (SELECT DISTINCT t.b FROM (VALUES ('1'), ('01')) AS t(b)) AS y ON x.a = CAST(y.b AS INT) ORDER BY x.a;

SELECT x.a FROM x LEFT JOIN (SELECT t.b FROM (VALUES ('1'), ('01')) AS t(b) GROUP BY t.b) AS y ON TRY_CAST(y.b AS INT) = x.a ORDER BY x.a;

SELECT x.a FROM x JOIN (SELECT MIN(y.b) AS b FROM y) AS y USING (b) ORDER BY x.a;

SELECT x.a FROM x NATURAL JOIN (SELECT MIN(y.b) AS b FROM y) AS y ORDER BY x.a;

SELECT empty_x.a FROM (SELECT x.a, x.b FROM x WHERE FALSE) AS empty_x RIGHT JOIN (SELECT MIN(y.b) AS b FROM y) AS y USING (b);

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
  UNION ALL
  SELECT
    y.b AS b
  FROM y
) AS y
  ON x.a = y.b
ORDER BY
  x.a;

SELECT
  x.a
FROM x
LEFT JOIN (
  SELECT
    y.b AS b
  FROM y
  UNION
  SELECT
    y.b AS b
  FROM y
) AS y
  ON x.a = y.b
ORDER BY
  x.a;
