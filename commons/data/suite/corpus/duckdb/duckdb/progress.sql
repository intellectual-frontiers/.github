SET threads=1;

CREATE TABLE integers AS SELECT i FROM range(500000) t(i);

SET debug_verify_progress='error';

SET debug_verify_progress_ignore='';

SELECT sum(i) FROM integers;

SELECT sum(i) FROM range(500000) t(i);

SELECT count(*) FROM generate_series(TIMESTAMP '2000-01-01', TIMESTAMP '2001-01-01', INTERVAL 1 MINUTE);

SELECT count(*) FROM repeat(42, 100000);

SELECT count(*) FROM repeat_row(1, 'hello', num_rows=100000);

SELECT count(*) > 4096 FROM duckdb_columns();

SELECT count(*) > 2048 FROM duckdb_functions();

SELECT count(*) > 0 FROM test_vector_types(NULL::INT, NULL::VARCHAR, NULL::INT[]);

SELECT count(*) FROM (SELECT * FROM read_text('test/sql/table_function/files/*.txt') ORDER BY filename);

CREATE TABLE small_integers AS SELECT i FROM range(30000) t(i);

SET threads=4;

SELECT sum(i) FROM (SELECT i FROM small_integers WHERE i % 2 = 0 LIMIT 5000 OFFSET 10);

SELECT sum(i) FROM (SELECT i FROM range(1000000) t(i) ORDER BY i DESC LIMIT 5000 OFFSET 10);

SET perfect_ht_threshold=16;

CREATE TABLE groups AS SELECT (i % 10000)::SMALLINT g FROM range(100000) t(i);

SELECT count(*), sum(c) FROM (SELECT g, count(*) c FROM groups GROUP BY g);

RESET perfect_ht_threshold;

CREATE TABLE modified AS SELECT i FROM range(10000) t(i);

WITH u AS (UPDATE modified SET i = i + 1 RETURNING i) SELECT count(*) FROM u;

WITH d AS (DELETE FROM modified RETURNING i) SELECT count(*), sum(i) FROM d;

SELECT count(*) FROM (SELECT * FROM range(100000) t(i) USING SAMPLE 10000 ROWS);

SELECT count(*) FROM (SELECT * FROM range(300000) t(i) USING SAMPLE 10 PERCENT (reservoir, 42));

SELECT count(*) FROM (SELECT i, count(*) FROM range(500000) t(i) GROUP BY i);

CREATE TABLE empty_groups(i INTEGER);

SELECT 1 FROM empty_groups GROUP BY GROUPING SETS ((),(),(i)) HAVING true;

SELECT sum(i) FROM (SELECT i FROM integers LIMIT 100000 OFFSET 10);

CREATE INDEX integers_index ON integers(i);

DROP INDEX integers_index;

SELECT count(*) FROM (SELECT * FROM range(1000000) t(i) ORDER BY i DESC);

SELECT count(*) FROM (SELECT * FROM range(1000000) t(i) WHERE i < 0 ORDER BY i DESC);

SET debug_force_external=true;

RESET debug_force_external;

SELECT count(*) FROM (SELECT sum(i) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM range(100000) t(i));

SELECT count(*) FROM (SELECT sum(i) OVER (PARTITION BY i % 7 ORDER BY i) FROM range(100000) t(i));

SELECT count(*) FROM (SELECT row_number() OVER () FROM range(100000) t(i));

WITH RECURSIVE t(i) AS (SELECT * FROM range(100000) UNION ALL SELECT i + 100000 FROM t WHERE i < 400000) SELECT sum(i) FROM t;

WITH RECURSIVE t(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM t WHERE i < 20000) SELECT count(*) FROM t;

WITH RECURSIVE t(i) AS (SELECT * FROM range(100000) UNION ALL SELECT i // 2 FROM t WHERE i > 1 AND i % 2 = 0) SELECT count(*) FROM t;

WITH RECURSIVE t(k, v) USING KEY (k) AS (SELECT i, 0 FROM range(10000) t(i) UNION (SELECT r.k, r.v + 1 FROM recurring.t r WHERE r.v < 3 AND EXISTS (SELECT 1 FROM t LIMIT 1))) SELECT count(*), sum(v) FROM t;

SELECT sum(i) FROM unnest(range(500000)) t(i);

SELECT sum(i) FROM range(2) t(i);

SELECT max(i) FROM (SELECT i FROM integers WHERE i % 2 = 0 LIMIT 5000);

SET debug_verify_progress='log';

CALL enable_logging('ProgressVerification');

SELECT invariant, operator, pipeline FROM duckdb_logs_parsed('ProgressVerification');

SET debug_verify_progress='none';

CALL truncate_duckdb_logs();

SELECT count(*) FROM duckdb_logs_parsed('ProgressVerification');
