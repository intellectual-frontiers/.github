SELECT c = NOT (a = b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c = NOT (a <> b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c = NOT (a < b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c = NOT (a <= b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c = NOT (a > b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c = NOT (a >= b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a = b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a <> b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a < b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a <= b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a > b) AS result FROM comparisons ORDER BY a, b, c;

SELECT c <> NOT (a >= b) AS result FROM comparisons ORDER BY a, b, c;

SELECT COUNT(*) FILTER (WHERE TRUE) FROM x;

SELECT COUNT(a) FILTER (WHERE TRUE) AS count_value, SUM(DISTINCT a) FILTER (WHERE 1 = 1) AS sum_value FROM x;

SELECT COUNT(*) FILTER (WHERE TRUE), SUM(a) FILTER (WHERE TRUE) FROM x WHERE FALSE;

SELECT COUNT(*) FILTER (WHERE FALSE) AS count_value, SUM(a) FILTER (WHERE NULL) AS null_sum, SUM(a) FILTER (WHERE a > 1 AND TRUE) AS sum_value FROM x;

SELECT a, SUM(a) FILTER (WHERE TRUE) OVER () FROM x ORDER BY a;

SELECT COUNT(*) FILTER (WHERE TRUE) FROM x WHERE TRUE;

--------------------------------------
-- COALESCE
--------------------------------------
SELECT COALESCE(a, NULL, 1) = 1 AS eq FROM x;

SELECT 1 = COALESCE(a, NULL, 1) AS eq FROM x;

SELECT 0 < COALESCE(a, NULL, -1) AS gt FROM x;

SELECT COALESCE(a, NULL, b, 3) = 3 AS eq FROM x;

SELECT COALESCE(a, NULL, NULL, 1) = 1 AS eq FROM x;

SELECT COALESCE(a, NULL) = 1 AS eq FROM x;
