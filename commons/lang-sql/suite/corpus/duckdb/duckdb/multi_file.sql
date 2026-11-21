CREATE TABLE t(v BIGINT, file_row_number BIGINT);

SELECT * FROM t ORDER BY v;

SET enable_external_file_cache=true;

SET threads = 1;

SELECT count(*) FROM narrow_file WHERE c IN (1, 3, 5);

EXPLAIN ANALYZE SELECT c FROM narrow_file ORDER BY c DESC LIMIT 3;

SELECT c FROM narrow_file ORDER BY c DESC LIMIT 3;

SELECT count(*) FROM wide_file WHERE c IN (1, 3, 5);

SELECT count(*) FROM wide_file WHERE c > 100 AND c < 105;
