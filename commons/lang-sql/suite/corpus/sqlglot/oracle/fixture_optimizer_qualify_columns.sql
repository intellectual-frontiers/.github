SELECT t."col" FROM tbl t;

WITH base AS (SELECT x.dummy AS COL_1 FROM dual x) SELECT b."COL_1" FROM base b;

SELECT 1 AS z, z + 1 AS w FROM (SELECT * FROM t) c;

SELECT 1 AS z FROM (SELECT * FROM t) c WHERE z > 0;

WITH
t1 AS (
  SELECT
    1 AS c1,
    1 AS c2,
    'Y' AS TOP_PARENT_INDICATOR,
    1 AS id
  FROM DUAL
),
t2 AS (
  SELECT
    1 AS c2,
    2 AS id
  FROM DUAL
)
SELECT t1.c1
FROM t1
LEFT JOIN t2 ON t1.c2 = t2.c2
WHERE (t1.TOP_PARENT_INDICATOR = 'Y' OR LEVEL = 1)
START WITH (t1.id IS NOT NULL)
CONNECT BY PRIOR t1.id = t2.id;

SELECT a AS b, b AS a FROM c;
