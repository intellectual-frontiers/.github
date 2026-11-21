SELECT a.id, b.val FROM a ASOF JOIN b ON a.id = b.id AND a.ts >= b.ts WHERE b.val > 10;

-- ANY matches must not be changed by prefiltering the RHS
SELECT a.id, b.val FROM a ANY JOIN b ON a.id = b.id WHERE b.val > 10;

SELECT a.id, b.val FROM a ANY JOIN (SELECT id, val FROM b) AS b ON a.id = b.id WHERE (a.id = 1 AND b.val > 10) OR (a.id = 2 AND b.val > 20);

SELECT x.a, y.b FROM x PASTE JOIN y WHERE y.b = 3;

SELECT x.a, y.b FROM (SELECT a FROM x) AS x PASTE JOIN y WHERE x.a = 3;
