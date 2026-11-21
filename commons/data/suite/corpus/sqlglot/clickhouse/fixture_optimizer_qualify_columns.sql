SELECT x AS k FROM t JOIN u USING (k) GROUP BY x ORDER BY MAX(k);

SELECT s, arr1, arr2 FROM arrays_test LEFT ARRAY JOIN arr1, arrays_test.arr2;

SELECT generate_series FROM generate_series(0, 10) AS g;

SELECT * FROM VALUES ('person String, place String', ('Noah', 'Paris'));

SELECT * FROM VALUES ((1, 1), (2, 2));

SELECT * FROM VALUES (1, 2, 3);
