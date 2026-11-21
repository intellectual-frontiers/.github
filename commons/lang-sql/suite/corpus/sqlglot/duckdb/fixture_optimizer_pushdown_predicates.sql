-- ASOF matches must be selected before applying the WHERE filter
SELECT a.id, b.val FROM a ASOF JOIN b ON a.id = b.id AND a.ts >= b.ts WHERE b.val > 10;

SELECT a.id, b.val FROM a ASOF JOIN (SELECT id, ts, val FROM b) AS b ON a.id = b.id AND a.ts >= b.ts WHERE b.val > 10;

SELECT a.id, b.val FROM a ASOF JOIN b ON a.id = b.id AND a.ts >= b.ts WHERE (a.id = 1 AND b.val > 10) OR (a.id = 2 AND b.val > 20);

-- Positional joins have no ON clause, and filtering either input changes row pairings
SELECT x.a, y.b FROM x POSITIONAL JOIN y WHERE y.b = 3;

SELECT x.a, y.b FROM (SELECT a FROM x) AS x POSITIONAL JOIN y WHERE x.a = 3;

SELECT x.a, y.b FROM x JOIN (SELECT b FROM y) AS y ON x.a = y.b POSITIONAL JOIN z WHERE y.b = 3;

-- Predicates inside independent subqueries can still be pushed down
SELECT x.a, y.b FROM x POSITIONAL JOIN (SELECT y.b FROM (SELECT b FROM y) AS y WHERE y.b = 3) AS y WHERE y.b > 2;

-- Parenthesized operands remain in the current scope
SELECT x.a, y.b FROM (x POSITIONAL JOIN y) JOIN z ON x.a = z.b WHERE y.b = 3;

SELECT x.a, y.b FROM (x ASOF JOIN y ON x.a >= y.b) JOIN z ON x.a = z.b WHERE y.b = 2;

-- A special join inside a separate scope does not block ordinary predicate pushdown
SELECT s.a, p.b FROM (SELECT a FROM x) AS s JOIN (SELECT y.b FROM y POSITIONAL JOIN z) AS p ON s.a = p.b WHERE s.a = 2;
