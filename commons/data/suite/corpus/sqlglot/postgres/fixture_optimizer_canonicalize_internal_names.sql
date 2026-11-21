SELECT j -> 'field' FROM jtbl;

SELECT x.a, t.b FROM x, LATERAL (SELECT x.a + 1 AS b) AS t;

SELECT DISTINCT ON (a) a, b FROM x;

SELECT * FROM LATERAL UNNEST(ARRAY[10, 20]) WITH ORDINALITY AS r(v, idx);

SELECT * FROM generate_series(1, 10) AS g(n);
