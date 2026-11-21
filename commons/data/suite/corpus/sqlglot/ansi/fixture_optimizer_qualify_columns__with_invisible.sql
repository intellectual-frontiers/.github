--------------------------------------
-- Qualify columns
--------------------------------------
SELECT a FROM x;

SELECT b FROM x;

--------------------------------------
-- Derived tables
--------------------------------------
SELECT x.a FROM x AS x CROSS JOIN (SELECT * FROM x);

SELECT x.b FROM x AS x CROSS JOIN (SELECT b FROM x);

--------------------------------------
-- Expand *
--------------------------------------
SELECT * FROM x;

SELECT * FROM y CROSS JOIN z ON y.b = z.b;

SELECT * FROM y CROSS JOIN z ON y.c = z.c;

SELECT a FROM (SELECT * FROM x);

SELECT * FROM (SELECT a FROM x);
