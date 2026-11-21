WITH u_cte(f, g, h) AS (SELECT * FROM u) SELECT * FROM u_cte PIVOT(SUM(f) AS sum FOR h IN ('x', 'y'));

SELECT * FROM produce AS produce(product, q1, q2, q3, q4) UNPIVOT(sales FOR quarter IN (q1, q2, q3, q4));

SELECT * FROM produce AS produce(product, q1, q2, q3, q4) UNPIVOT((first_half_sales, second_half_sales) FOR semesters IN ((Q1, Q2) AS 'semester_1', (Q3, Q4) AS 'semester_2'));

WITH cte AS (
    SELECT
        refresh_date AS `reFREsh_date`,
        term AS `TeRm`,
        `rank`
    FROM `bigquery-public-data.GooGle_tReNDs.TOp_TeRmS`
)
SELECT
   refresh_date AS `Day`,
   term AS Top_Term,
   rank,
FROM cte
WHERE
   rank = 1
   AND refresh_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 WEEK)
GROUP BY `dAy`, `top_term`, rank
ORDER BY `DaY` DESC;
