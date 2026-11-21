ANALYZE;

ANALYSE;

VACUUM;

VACUUM ANALYSE;

CREATE TABLE test (i INT, j INT);

ANALYZE test;

ANALYSE test;

CREATE VIEW testview AS SELECT * FROM test;

INSERT INTO test SELECT range % 5000, range % 5000 FROM range(10000);

SELECT s.min, s.max, s.has_null, s.has_no_null, s.approx_unique FROM (SELECT stats(i) s FROM test LIMIT 1);

SELECT s.min, s.max, s.has_null, s.has_no_null, s.approx_unique FROM (SELECT stats(j) s FROM test LIMIT 1);

PRAGMA verify_parallelism;

ANALYZE test(i);

VACUUM test(i);

PRAGMA disable_verify_parallelism;

SELECT s.approx_unique FROM (SELECT stats(i) s FROM test LIMIT 1);

SELECT s.approx_unique FROM (SELECT stats(j) s FROM test LIMIT 1);

CREATE TABLE test (x INT[], y AS (x || [100]));

ANALYZE test(x);

INSERT INTO test SELECT [range % 5000] FROM range(10000);
