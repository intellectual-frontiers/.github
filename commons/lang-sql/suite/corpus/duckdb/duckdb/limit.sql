SELECT i FROM range(10) t(i) ORDER BY i LIMIT 2147483647;

SELECT i FROM range(10) t(i) ORDER BY i DESC LIMIT 11;

SELECT i FROM range(10) t(i) GROUP BY i ORDER BY i LIMIT 2147483647;

CREATE TABLE tbl AS SELECT range AS i FROM range(5);

SELECT i FROM tbl ORDER BY i LIMIT 9223372036854775807;

SELECT count(*) FROM (SELECT i FROM tbl ORDER BY i LIMIT 100);

PRAGMA disable_optimizer;

SELECT o.o_orderkey
FROM (
    SELECT l.o_orderkey
    FROM orders l
    LEFT JOIN lineitem li ON li.l_orderkey = l.o_orderkey
    WHERE l.o_orderkey = 1
    LIMIT 1
) AS filtered
JOIN orders o ON TRUE
WHERE o.o_orderkey = 1;

SET threads = 1;

SELECT count(*), sum(x)
         FROM (
             SELECT unnest(range(200000)) AS u, x
             FROM (
                 SELECT lead(i, 1, 7) OVER () AS x
                 FROM range(1) t(i)
             )
             LIMIT 200001
         );

CREATE TABLE tbl AS SELECT concat('thisisastring', i) s FROM range(1_000_000) t(i);

FROM tbl WHERE s LIKE '%string999999%' LIMIT 5;

EXPLAIN FROM tbl WHERE s LIKE '%string999999%' LIMIT 5;

SELECT * FROM (SELECT SUM(i) FROM range(100000000000) tbl(i)) LIMIT 0;

SET explain_output='OPTIMIZED_ONLY';

EXPLAIN SELECT * FROM (SELECT SUM(i) FROM range(100000000000) tbl(i)) LIMIT 0;

EXPLAIN SELECT * FROM (SELECT SUM(i) FROM range(100000000000) tbl(i)) WHERE 1=0;

SET preserve_insertion_order=false;

CREATE TABLE integers AS SELECT 1 AS i FROM range(1000000) t(i);

SELECT MIN(i), MAX(i), COUNT(*) FROM integers;

SELECT * FROM integers LIMIT 5;

CREATE TABLE integers2 AS SELECT * FROM range(1000000) tbl(i);

SELECT MIN(i), MAX(i), COUNT(*) FROM integers2;

SELECT * FROM integers2 WHERE i IN (337, 195723, 442578, 994375);

SELECT * FROM integers2 WHERE i IN (337, 195723, 442578, 994375) LIMIT 4;

SET warnings_as_errors=false;

SELECT * FROM integers LIMIT 5 OFFSET 500000;
