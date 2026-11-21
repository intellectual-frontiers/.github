SELECT * FROM u PIVOT (SUM(f) FOR h IN ('x', 'y'));

WITH source AS (
  SELECT
    id,
    key,
    value,
    timestamp_1,
    timestamp_2
  FROM DB_NAME.SCHEMA_NAME.TABLE_NAME
),
enriched AS (
  SELECT * FROM source
  PIVOT(MAX(value) FOR key IN ('a', 'b', 'c'))
  AS final (id, timestamp_1, timestamp_2, col_1, col_2, col_3)
)
SELECT id, timestamp_1 FROM enriched;

SELECT * FROM m_sales AS m_sales(empid, dept, jan, feb) UNPIVOT(sales FOR month IN (jan, feb)) ORDER BY empid;

SELECT * FROM (SELECT * FROM m_sales) AS m_sales(empid, dept, jan, feb) UNPIVOT(sales FOR month IN (jan, feb)) ORDER BY empid;

with cte1("id", foo) as (select 1, 2) select "id" from cte1;

SELECT
  ("SUBQUERY_0"."KEY") AS "SUBQUERY_1_COL_0"
FROM
  (
    SELECT
      *
    FROM
      (((
          SELECT
            *
          FROM
            (
              SELECT
                event_name AS key,
                insert_ts
              FROM
                (
                  SELECT
                    insert_ts,
                    event_name
                  FROM
                    sales
                  WHERE
                    insert_ts > '2023-08-07 21:03:35.590 -0700'
                )
            )
      ))) AS "SF_CONNECTOR_QUERY_ALIAS"
  ) AS "SUBQUERY_0";

SELECT
  A.ACCOUNT_ID,
  A.NAME,
  C.EMAIL_DOMAIN
FROM ACCOUNTS AS A
LEFT JOIN CONTACTS AS C
  ON C.ACCOUNT_ID = A.ACCOUNT_ID
  AND C.EMAIL_DOMAIN IN (
    SELECT
      D.DOMAIN
    FROM DOMAINS D
    WHERE
      TYPE = 'education'
  );

WITH obj AS (SELECT object_construct('a', '1', 'b', '2') AS data), flattened AS (SELECT f.key, f.value FROM obj, lateral flatten(input => obj.data) AS f) SELECT key::varchar, value::varchar FROM flattened;

SELECT array_agg(id) WITHIN GROUP (ORDER BY id) OVER (PARTITION BY grp) FROM t;
