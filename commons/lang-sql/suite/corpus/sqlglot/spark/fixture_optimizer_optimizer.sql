CREATE OR REPLACE TEMPORARY VIEW latest_boo AS
SELECT
    TRIM(split(points, ':')[0]) as points_type,
    TRIM(split(points, ':')[1]) as points_value
FROM (
         SELECT
             explode_outer(split(object_pointsText, ',')) as points
         FROM (
                  SELECT
                      object_pointstext,
                  FROM boo
              )
         WHERE object_pointstext IS NOT NULL
     );

SELECT /*+ BROADCAST(y) */ x.b FROM x JOIN y ON x.b = y.b;

SELECT cola, colb FROM (VALUES (1, 'test'), (2, 'test2')) AS tab(cola, colb);

WITH m AS (
  SELECT
    x.a,
    x.b
  FROM x
), n AS (
  SELECT
    y.b,
    y.c
  FROM y
), joined as (
  SELECT /*+ BROADCAST(n) */
    m.a,
    n.c
  FROM m JOIN n ON m.b = n.b
)
SELECT
  joined.a,
  joined.c
FROM joined;

WITH m AS (
  SELECT
    x.a,
    x.b
  FROM x
), n AS (
  SELECT
    y.b,
    y.c
  FROM y
), joined as (
  SELECT /*+ BROADCAST(m), MERGE(m, n) */
    m.a,
    n.c
  FROM m JOIN n ON m.b = n.b
)
SELECT
  /*+ COALESCE(3) */
  joined.a,
  joined.c
FROM joined;

SELECT * FROM u PIVOT (SUM(f) FOR h IN ('x', 'y'));

SELECT Name,
       FruitStruct.`$id`,
       FruitStruct.value
  FROM
       (SELECT Name,
               explode(Fruits) as FruitStruct
          FROM fruits_table);

SELECT
  COUNT(DISTINCT cs1.cs_order_number) AS `order count`,
  SUM(cs1.cs_ext_ship_cost) AS `total shipping cost`,
  SUM(cs1.cs_net_profit) AS `total net profit`
FROM catalog_sales cs1, date_dim, customer_address, call_center
WHERE
  date_dim.d_date BETWEEN '2002-02-01' AND (CAST('2002-02-01' AS DATE) + INTERVAL 60 days)
  AND cs1.cs_ship_date_sk = date_dim.d_date_sk
  AND cs1.cs_ship_addr_sk = customer_address.ca_address_sk
  AND customer_address.ca_state = 'GA'
  AND cs1.cs_call_center_sk = call_center.cc_call_center_sk
  AND call_center.cc_county IN (
    'Williamson County', 'Williamson County', 'Williamson County', 'Williamson County', 'Williamson County'
  )
  AND EXISTS(
    SELECT *
    FROM catalog_sales cs2
    WHERE cs1.cs_order_number = cs2.cs_order_number
      AND cs1.cs_warehouse_sk <> cs2.cs_warehouse_sk)
      AND NOT EXISTS(
        SELECT *
        FROM catalog_returns cr1
        WHERE cs1.cs_order_number = cr1.cr_order_number
      )
    ORDER BY COUNT(DISTINCT cs1.cs_order_number
  )
LIMIT 100;

WITH a AS (SELECT 'v' AS x) SELECT * FROM (SELECT TRANSFORM(x) USING 'cat' AS (y STRING) FROM a);

WITH a AS (SELECT 'v' AS x) SELECT * FROM (SELECT TRANSFORM(x) USING 'cat'  FROM a);
