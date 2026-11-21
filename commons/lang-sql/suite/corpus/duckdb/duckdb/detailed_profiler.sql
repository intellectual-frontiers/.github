SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

SET enable_profiling='json';

SET profiling_mode = 'detailed';

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (3);

SELECT min (i + i) FROM integers;

CREATE TABLE exprtest (a INTEGER, b INTEGER);

INSERT INTO exprtest VALUES (42, 10), (43, 100), (NULL, 1), (45, -1);

SELECT min (a + a ) FROM exprtest;

SELECT a FROM exprtest WHERE a BETWEEN 43 AND 44;

SELECT CASE a WHEN 42 THEN 100 WHEN 43 THEN 200 ELSE 300 END FROM exprtest;
