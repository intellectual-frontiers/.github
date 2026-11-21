SELECT id AS email FROM t ORDER BY email || '';

WITH employees AS (
    SELECT *
    FROM (VALUES ('President', 1, NULL),
                 ('Vice President Engineering', 10, 1),
                 ('Programmer', 100, 10),
                 ('QA Engineer', 101, 10),
                 ('Vice President HR', 20, 1),
                 ('Health Insurance Analyst', 200, 20)
    ) AS t(title, employee_ID, manager_ID)
)
SELECT
  employee_ID,
  manager_ID,
  title,
  level
FROM employees
START WITH title = 'President'
CONNECT BY manager_ID = PRIOR employee_id
ORDER BY
  employee_ID NULLS LAST;

SELECT empid FROM quarterly_sales PIVOT(SUM(amount) FOR quarter IN (ANY ORDER BY quarter));

SELECT * REPLACE(b * 2 AS b) RENAME(b AS new_b) FROM x FULL JOIN y USING (b);

--------------------------------------
-- Snowflake allows column alias to be used in almost all clauses
--------------------------------------
SELECT x.a AS foo FROM x JOIN y ON foo = y.b;

SELECT x.a AS foo FROM x QUALIFY foo = 1;

SELECT x.a AS foo FROM x GROUP BY foo = 1;

SELECT x.a AS foo FROM x WHERE foo = 1;

WITH t AS (SELECT 1 AS "Id", 2 AS "Jan", 3 AS "Feb", 4 AS "Nor", 5 AS "Sou") SELECT * FROM t UNPIVOT(v1 FOR n1 IN ("Jan", "Feb")) UNPIVOT(v2 FOR n2 IN ("Nor", "Sou"));

WITH base AS (SELECT id, jan, feb FROM unpivotable) SELECT p.amount FROM base AS m UNPIVOT(amount FOR metric IN (jan, feb)) AS p;

WITH t AS (SELECT PARSE_JSON('{"id": 1}') AS data, 'file' AS filepath) SELECT t.$1:"id"::INT AS id, t.$2 AS filename FROM t;

WITH t AS (SELECT 1 AS "lower") SELECT t.$1 FROM t;

WITH t AS (SELECT 1 AS "SELECT") SELECT t.$1 FROM t;

WITH t AS (SELECT 1 AS x, 2 AS x, 3 AS y) SELECT t.$2, t.$3 FROM t;

WITH t("lower") AS (SELECT 1) SELECT t.$1 FROM t;

WITH t AS (SELECT 1 AS "SELECT", 2 AS a, 3 AS b) SELECT t.$1 FROM t UNPIVOT(v FOR k IN (a, b));

WITH t AS (SELECT 1 AS id, 2 AS v, 'a' AS k) SELECT p.$2 FROM t PIVOT(SUM(v) FOR k IN ('a' AS "SELECT")) AS p;

WITH t AS (SELECT 1 AS id, 2 AS v, 'a' AS k) SELECT t.$2 FROM t PIVOT(SUM(v) FOR k IN ('a' AS a));

WITH t AS (SELECT 1 AS id, 2 AS v, 'a' AS k) SELECT t.$1 FROM t PIVOT(SUM(v) FOR k IN ('a' AS a)) UNPIVOT(v2 FOR k2 IN (a));

WITH t AS (SELECT 1 AS x), s AS (SELECT 1 AS id, 2 AS v, 'a' AS k) SELECT t.$1, p.$2 FROM t CROSS JOIN s PIVOT(SUM(v) FOR k IN ('a' AS a)) AS p;

SELECT x.$1, x.$2 FROM x AS x(alias_name);

SELECT t.$1 FROM source AS t;

WITH t AS (SELECT * FROM source) SELECT t.$1 FROM t;

SELECT x.$2 FROM unknown AS x(alias_name);
