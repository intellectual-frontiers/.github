SELECT +(x = 1) FROM t;

SELECT +(x IN (1, 2)) FROM t;

SELECT +(x IS 1) FROM t;

SELECT +(NOT x) FROM t;

SELECT NOT(NOT(NOT(NOT t_bool.a))) FROM t_bool;

WITH t0 AS (SELECT 1 AS a, 'foo' AS p) SELECT NOT (NOT(CASE WHEN t0.a > 1 THEN t0.a ELSE t0.p END)) AS res FROM t0;
