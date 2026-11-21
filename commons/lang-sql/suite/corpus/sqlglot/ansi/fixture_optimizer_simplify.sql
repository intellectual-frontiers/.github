SELECT (EXISTS(SELECT 1 WHERE FALSE)) AND NULL;

SELECT NULL AND (EXISTS(SELECT 1 WHERE FALSE));

SELECT c = NOT (a = ALL (SELECT b FROM t)) FROM t;

SELECT c = NOT (a <> ANY (SELECT b FROM t)) FROM t;

SELECT NOT (2 <> ALL (SELECT 2 UNION ALL SELECT 3));

SELECT t_bool.a AND TRUE FROM t_bool;

SELECT TRUE AND t_bool.a FROM t_bool;

SELECT t_bool.a OR FALSE FROM t_bool;

SELECT FALSE OR t_bool.a FROM t_bool;

SELECT t_bool.a OR t_bool.a FROM t_bool;

SELECT t_bool.a AND t_bool.a FROM t_bool;

SELECT SUM(t.x OR t.x) FROM t;

SELECT SUM(t.x AND t.x) FROM t;

--------------------------------------
-- Where removal
--------------------------------------
SELECT x WHERE TRUE;

SELECT x FROM y JOIN z ON TRUE;

SELECT x FROM y RIGHT JOIN z ON TRUE;

SELECT x FROM y LEFT JOIN z ON TRUE;

SELECT x FROM y FULL OUTER JOIN z ON TRUE;

SELECT x FROM y JOIN z USING (x);

SELECT (ARRAY_AGG(foo))[1];

SELECT -(x.a > x.b) FROM x;

SELECT (-((x.a) IS NULL)) FROM x;

SELECT * FROM A WHERE a - (b < c) < 0 AND a + (b > c) >= 0;

SELECT 1 WHERE 'foo';

SELECT 1 WHERE NOT 'foo';

SELECT nn.a > 1 AND nn.a < 1 AS r FROM nn;

SELECT nn.a = 1 AND nn.a <> 1 AS r FROM nn;

SELECT nn.a > 1 AND nn.a < 2 AND nn.a > 3 AS r FROM nn;

SELECT nn.a = 1 AND nn.a >= 2 AS r FROM nn;

SELECT nn.a FROM nn WHERE NOT (nn.a < 1 AND nn.a > 3);

SELECT x.a FROM x WHERE NOT (x.a < 1 AND x.a > 3);

SELECT nn.a, COALESCE(nn.a < 1 AND nn.a > 3, TRUE) AS r FROM nn;

SELECT x.a, COALESCE(x.a < 1 AND x.a > 3, TRUE) AS r FROM x;

--------------------------------------
-- Constant Propagation
--------------------------------------
-- constants only propagate through columns that can't be NULL (nn in the test schema)
SELECT nn.a = 5 AND nn.b = nn.a AS r FROM nn;

SELECT nn.a = 5 AND nn.b > nn.a AS r FROM nn;

SELECT nn.a = 5 AND nn.a + nn.b = 7 AS r FROM nn;

SELECT nn.a = 5 AND nn.a = 6 AS r FROM nn;

(SELECT x FROM t WHERE y = 1) AND x = 5;

(SELECT z = 5 FROM t WHERE y = 1) AND x = 1 AND y > 0;

(SELECT z FROM t WHERE a AND (b OR c)) AND x = 1 AND x = y;

(SELECT 1);

(SELECT 2);

SELECT CASE WHEN a > 1 THEN comparisons.b WHEN TRUE THEN 2 END AS result FROM comparisons;

SELECT CASE WHEN c THEN comparisons.a WHEN b = 1 THEN comparisons.b WHEN TRUE THEN 2 WHEN a = 2 THEN 3 ELSE 4 END AS result FROM comparisons;

SELECT CASE 1 WHEN a THEN comparisons.b WHEN 1 THEN 2 ELSE 3 END AS result FROM comparisons;

--------------------------------------
-- Simplify NOT
--------------------------------------
SELECT NOT(NOT(a)) FROM x;

SELECT NOT(NOT(NOT(NOT t_bool.a))) FROM t_bool;

SELECT IF(NULL = NULL, 1, 100);
