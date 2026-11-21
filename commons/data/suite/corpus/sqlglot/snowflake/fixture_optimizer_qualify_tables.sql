SELECT value FROM TABLE(SPLIT_TO_TABLE('a.b', '.'));

SELECT s.value FROM t, TABLE(SPLIT_TO_TABLE(t.a, '.')) AS s;

SELECT value FROM t, LATERAL SPLIT_TO_TABLE(t.a, '.');

SELECT s.value FROM t, LATERAL SPLIT_TO_TABLE(t.a, '.') AS s;

SELECT v FROM t, LATERAL SPLIT_TO_TABLE(t.a, '.') AS s(x, y, v);
