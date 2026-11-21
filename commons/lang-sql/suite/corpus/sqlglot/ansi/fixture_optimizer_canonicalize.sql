SELECT w.d + w.e AS c FROM w AS w;

SELECT CAST(w.d AS DATE) > w.e AS a FROM w AS w;

SELECT CAST(1 AS VARCHAR) AS a FROM w AS w;

SELECT CAST(1 + 3.2 AS DOUBLE) AS a FROM w AS w;

SELECT '1' + 1 AS "col";

SELECT '1' + '1' AS "col";

SELECT CAST('2022-01-01' AS DATE) + INTERVAL '1' DAY;

SELECT CAST('2022-01-01' AS DATE) IS NULL AS "a";

--------------------------------------
-- Ensure boolean predicates
--------------------------------------
SELECT a FROM x WHERE b;

SELECT NOT b FROM x;

SELECT a FROM x GROUP BY a HAVING SUM(b);

SELECT a FROM x GROUP BY a HAVING SUM(b) AND TRUE;

SELECT a FROM x WHERE 1;

SELECT a FROM x WHERE COALESCE(0, 1);

SELECT a FROM x WHERE CASE WHEN COALESCE(b, 1) THEN 1 ELSE 0 END;

SELECT t.d + INTERVAL '1' HOUR FROM temporal AS t;

SELECT DATE_ADD(t.d, 1, 'HOUR') FROM temporal AS t;

SELECT DATE_TRUNC('SECOND', t.d) FROM temporal AS t;

SELECT "t"."d" > '2023-01-01' AS "d" FROM "temporal" AS "t";

SELECT "t"."d" > CAST('2023-01-01' AS DATETIME) AS "d" FROM "temporal" AS "t";

SELECT "t"."t" > '2023-01-01 00:00:01' AS "t" FROM "temporal" AS "t";

WITH "t" AS (SELECT CAST("ext"."created_at" AS TIMESTAMP) AS "created_at" FROM "ext" AS "ext") SELECT "t"."created_at" > '2024-10-01 12:05:02' AS "col" FROM "t" AS "t";

SELECT CAST(x.a - x.b AS INT) * 2 AS c FROM x AS x;

SELECT -CAST(x.a - x.b AS INT) AS c FROM x AS x;

SELECT CAST(x.a * x.b AS INT) + 2 AS c FROM x AS x;

SELECT CAST(x.a > 0 OR x.b > 0 AS BOOLEAN) IN (FALSE) AS c FROM x AS x;

SELECT CAST(x.a BETWEEN 1 AND 3 AS BOOLEAN) = (x.b > 0) AS c FROM x AS x;

SELECT CAST(NOT x.a > 0 AS BOOLEAN) = (x.b > 0) AS c FROM x AS x;
