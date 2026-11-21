CREATE TABLE integers(i INTEGER);

PRAGMA database_size;

CALL disable_profiling();

SELECT CURRENT_SETTING('enable_profiling');

CALL enable_profiling();

CALL enable_profiling(format='json');

SELECT CURRENT_SETTING('profiling_coverage');

CALL enable_profiling(coverage='all');

SELECT CURRENT_SETTING('profiling_output');

SELECT CURRENT_SETTING('profiling_mode');

CALL enable_profiling(mode='detailed');

CALL enable_profiling(metrics = ['operator.intermediate_rows', 'operator.rows_scanned', 'query.total_intermediate_rows', 'query.total_rows_scanned']);

SELECT UNNEST(CURRENT_SETTING('tracked_metrics')) ORDER BY ALL;

CALL enable_profiling(metrics = ['query.sql', 'operator.extra_info']);

CALL enable_profiling(metrics = ['query.total_time', 'operator.intermediate_size_bytes']);

CALL enable_profiling(metrics = 'query.*');

CALL enable_profiling(metrics = '*');

RESET tracked_metrics;

CALL enable_profiling(['query.total_time', 'operator.intermediate_size_bytes']);

CALL enable_profiling(['io.total_bytes_read', 'io.total_bytes_written'], mode = 'detailed');

CALL enable_profiling(format);

SET enable_profiling='json';

SET enable_external_access=false;

SET profiling_output='';

SET enable_profiling='no_output';

SELECT 44;

SET enable_profiling = 'json';

PRAGMA disable_profiling;

SET profiling_renderer_settings = MAP {'max_extra_lines': 3};

SELECT 42;

SET profiling_mode='all';

SELECT unnest(['Maia', 'Thijs', 'Mark', 'Hannes', 'Tom', 'Max', 'Carlo', 'Sam', 'Tania']) AS names ORDER BY random();

SELECT operator[1].extra_info, operator[1].intermediate_size_bytes, query.cpu_time,  query.total_time FROM metrics_output;

SET threads = 1;

SET wal_autocheckpoint = '1TB';

PRAGMA disable_checkpoint_on_shutdown;

CREATE TABLE profile_fs.tbl AS SELECT range AS id FROM range(100_000);

SET tracked_metrics = ['storage.waiting_to_attach_latency', 'storage.attach_load_storage_latency', 'storage.attach_replay_wal_latency', 'storage.checkpoint_latency'];

SET profiling_coverage='ALL';

CHECKPOINT profile_fs;

SELECT
	CASE WHEN storage.checkpoint_latency >= 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

CREATE TABLE profile_fs.other_tbl AS SELECT range AS id FROM range(100_000);

DETACH profile_fs;

SELECT
	CASE WHEN storage.waiting_to_attach_latency >= 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SELECT
	CASE WHEN storage.attach_load_storage_latency >= 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SELECT
	CASE WHEN storage.attach_replay_wal_latency >= 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SET wal_autocheckpoint='1TB';

CREATE TABLE acp_db.tbl(id INTEGER);

CHECKPOINT acp_db;

SET tracked_metrics = ['storage.checkpoint_latency', 'io.total_bytes_written', 'storage.commit_local_storage_latency', 'storage.write_to_wal_latency'];

INSERT INTO acp_db.tbl VALUES (1);

SET wal_autocheckpoint_entries=1;

INSERT INTO acp_db.tbl VALUES (2);

DETACH acp_db;

CREATE TABLE checkpoint_prof.tbl(id INTEGER, category INTEGER);

INSERT INTO checkpoint_prof.tbl SELECT range, range % 100 FROM range(10000);

CHECKPOINT checkpoint_prof;

SET tracked_metrics = ['storage.checkpoint_latency', 'query.total_time'];

INSERT INTO checkpoint_prof.tbl SELECT range + 100000, range % 100 FROM range(10000);

SELECT CASE WHEN latency > 0 THEN 'true' ELSE 'false' END FROM first_cp;

INSERT INTO checkpoint_prof.tbl SELECT range + 200000, range % 100 FROM range(10000);

SELECT CASE WHEN latency > 0 THEN 'true' ELSE 'false' END FROM second_cp;

SELECT CASE WHEN (SELECT latency FROM first_cp) + (SELECT latency FROM second_cp) > (SELECT latency FROM first_cp) THEN 'true' ELSE 'false' END;

INSERT INTO checkpoint_prof.tbl SELECT range + 1000000, range % 100 FROM range(10000);

SELECT CASE WHEN storage.checkpoint_latency > 0 THEN 'true' ELSE 'false' END FROM metrics;

CREATE TABLE wal_latency.tbl AS SELECT range AS id, 0 AS v FROM range(500_000);

BEGIN TRANSACTION;

UPDATE wal_latency.tbl SET v = id;

SET tracked_metrics = ['storage.commit_local_storage_latency', 'storage.write_to_wal_latency'];

COMMIT;

SELECT CASE WHEN storage.commit_local_storage_latency >= 0 THEN 'true' ELSE 'false' END FROM commit_metrics;

SELECT CASE WHEN storage.write_to_wal_latency >= 0 THEN 'true' ELSE 'false' END FROM commit_metrics;

DETACH wal_latency;

SET tracked_metrics = ['storage.wal_replay_entry_count', 'storage.attach_replay_wal_latency'];

SELECT CASE WHEN storage.wal_replay_entry_count > 0 THEN 'true' ELSE 'false' END FROM replay_metrics;

SELECT CASE WHEN storage.attach_replay_wal_latency > 0 THEN 'true' ELSE 'false' END FROM replay_metrics;

SET threads = 4;

CREATE TABLE bigdata AS SELECT i AS col_a, i AS col_b FROM range(0, 10000) tbl(i);

SET tracked_metrics = ['system.blocked_thread_time'];

SELECT (SELECT COUNT(*) FROM bigdata WHERE col_a = 1) + (SELECT COUNT(*) FROM bigdata WHERE col_b = 1);

SELECT COUNT(system.blocked_thread_time) FROM metrics_output;

SET tracked_metrics = ['operator.extra_info', 'operator.intermediate_rows', 'operator.timing', 'query.total_time'];

SELECT operator[1].extra_info, query.total_time FROM metrics_output;

SET tracked_metrics = ['query.sql', 'query.cpu_time', 'operator.extra_info', 'query.total_intermediate_rows', 'query.total_rows_scanned'];

SELECT
	CASE WHEN query.cpu_time > 0 THEN 'true'
    ELSE 'false' END
FROM metrics_output;

SELECT
	CASE WHEN query.total_intermediate_rows > 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SELECT
	CASE WHEN query.total_rows_scanned > 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SELECT
	CASE WHEN EXISTS(
		SELECT
			1
		FROM information_schema.columns
		WHERE table_name = 'metrics_output' AND column_name = 'query'
	) THEN 'true'
	ELSE 'false' END;

SELECT;

FROM metrics_output;

SET tracked_metrics = [];

SET tracked_metrics = ['*'];

SELECT unnest(current_setting('tracked_metrics'));

SET profiling_mode='standard';

SET tracked_metrics = ['optimizer.total_time'];

SET tracked_metrics = ['optimizer.join_order'];

SELECT
    CASE WHEN optimizer.join_order > 0 THEN 'true'
     ELSE 'false' END
FROM metrics_output;

SET tracked_metrics = ['optimizer.mark_join_simplifier'];

SELECT a FROM range(3) t(a) WHERE a IN (SELECT b FROM range(1) t(b));

SELECT
    CASE WHEN optimizer.total_time > 0 THEN 'true'
    ELSE 'false' END
FROM metrics_output;

SET profiling_mode = 'detailed';

SET profiling_mode = 'standard';

SET tracked_metrics = ['system.peak_streaming_buffer_size'];

SELECT COUNT(*) FROM range(10000);

SELECT COUNT(system.peak_streaming_buffer_size) FROM metrics_output;

SET tracked_metrics = ['operator.intermediate_size_bytes', 'operator.intermediate_rows'];

SELECT
    CASE
        WHEN operator[1].intermediate_size_bytes < 10_000 THEN NULL
        ELSE operator[1].intermediate_size_bytes
    END AS result
FROM metrics_output;

CREATE TABLE local_pruned(i BIGINT);

INSERT INTO local_pruned VALUES
	(1000000), (1000001), (1000002), (1000003), (1000004),
	(1000005), (1000006), (1000007), (1000008), (1000009);

CREATE TABLE persistent_only(i BIGINT);

INSERT INTO persistent_only VALUES
	(0), (1), (2), (3), (4),
	(5), (6), (7), (8), (9);

INSERT INTO local_pruned VALUES
	(0), (1), (2), (3), (4),
	(5), (6), (7), (8), (9);

SET tracked_metrics = ['operator.row_groups_scanned', 'operator.total_row_groups_to_scan', 'operator.type', 'query.total_row_groups_scanned', 'query.total_row_groups_to_scan'];

SELECT count(*) FROM local_pruned a, persistent_only b WHERE a.i < 100 AND b.i < 100;

SELECT * FROM operator_metrics WHERE operator_type = 'TABLE_SCAN' ORDER BY total;

SELECT sum(scanned)::VARCHAR || '/' || sum(total)::VARCHAR
FROM operator_metrics
WHERE operator_type = 'TABLE_SCAN';

ROLLBACK;

SET tracked_metrics = ['operator.intermediate_rows', 'operator.rows_scanned', 'query.total_intermediate_rows', 'query.total_rows_scanned'];

INSERT INTO integers VALUES (1), (2), (3), (NULL);

SELECT * FROM integers i1, integers i2 WHERE i1.i = i2.i ORDER BY 1;

SELECT query.total_intermediate_rows, query.total_rows_scanned FROM metrics_output;

SELECT
	CASE WHEN query.total_rows_scanned = 8 THEN NULL
	ELSE metrics_output END
FROM metrics_output;

SET tracked_metrics = ['query.total_intermediate_rows', 'query.total_rows_scanned', 'system.blocked_thread_time'];

SELECT
	CASE WHEN query.total_rows_scanned = 10 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SET tracked_metrics = ['system.total_memory_allocated'];

CREATE OR REPLACE TABLE test AS SELECT range AS id, hash(range) AS data FROM range(100000);

SELECT
	CASE WHEN system.total_memory_allocated >= 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

SELECT id, COUNT(*) as cnt FROM test GROUP BY id ORDER BY id LIMIT 1000;

SET tracked_metrics = ['system.total_memory_allocated', 'operator.type'];

SELECT * FROM test WHERE id < 1000 ORDER BY id;

CREATE OR REPLACE TABLE metrics_children AS SELECT unnest(operator, recursive := true) FROM metrics_output;

CREATE OR REPLACE TABLE test2 AS SELECT range AS id FROM range(10000);

SET memory_limit = '100MB';

CREATE OR REPLACE TABLE large_test AS SELECT range AS id, hash(range) AS data FROM range(1000000);

SELECT operator[1].extra_info,
	optimizer,
	optimizer.total_time,
	parser.total_time,
	physical_planner.column_binding,
	physical_planner.create_plan,
	physical_planner.resolve_types,
	physical_planner.total_time,
	planner.binding_time,
	planner.total_time,
	operator[1].intermediate_size_bytes,;

system.blocked_thread_time,
	system.peak_buffer_memory,
	system.peak_temp_dir_size,
	system.total_memory_allocated
FROM metrics_output;

SET tracked_metrics = ['query.*'];

SELECT query.cpu_time,;

SET tracked_metrics = ['system.*'];

SELECT system.blocked_thread_time,
	system.peak_buffer_memory,
	system.peak_temp_dir_size,
	system.total_memory_allocated
FROM metrics_output;

SET tracked_metrics = ['storage.*'];

SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='metrics_output' AND column_name='operator');

SET tracked_metrics = ['operator.*'];

SELECT intermediate_rows,
	timing,
	type
FROM (
	SELECT unnest(operator, max_depth := 2)
	FROM metrics_output
);

SET tracked_metrics = ['optimizer.*'];

SELECT optimizer FROM metrics_output;

SET tracked_metrics = ['optimizer.*', 'parser.*', 'physical_planner.*', 'planner.*'];

SELECT optimizer.total_time,
	optimizer,
	parser.total_time,
	physical_planner.column_binding,
	physical_planner.create_plan,
	physical_planner.resolve_types,
	physical_planner.total_time,
	planner.binding_time,
	planner.total_time
FROM metrics_output;

SET tracked_metrics = ['io.*', 'operator.*', 'query.*', 'storage.*', 'system.*'];

storage.*
system.*;

SELECT operator[1].extra_info,
	operator[1].intermediate_size_bytes,;

SET tracked_metrics = ['optimizer.*', 'parser.*', 'physical_planner.*', 'planner.*', 'system.*', 'storage.*'];

SELECT optimizer.total_time,
	optimizer,
	parser.total_time,
	physical_planner.column_binding,
	physical_planner.create_plan,
	physical_planner.resolve_types,
	physical_planner.total_time,
	planner.binding_time,
	planner.total_time,
	system.blocked_thread_time,
	system.peak_buffer_memory,
	system.peak_temp_dir_size,
	system.total_memory_allocated
FROM metrics_output;

SELECT * EXCLUDE(value, description) FROM duckdb_profiling_settings() ORDER BY name;

SET profiling_mode='DETAILED';

SET tracked_metrics = ['query.cpu_time'];

SELECT * EXCLUDE(description) FROM duckdb_profiling_settings() ORDER BY name;

SELECT metric_name, metric_type, description, unit
FROM duckdb_available_metrics()
WHERE metric_name = 'io.total_read_operations';

SELECT metric_name, metric_type, description, unit
FROM duckdb_available_metrics()
WHERE metric_name = 'io.total_write_operations';

SET tracked_metrics = ['io.*'];

SELECT io.total_read_operations > 0 AND io.total_write_operations > 0 FROM metrics_output;

SELECT io.total_read_operations >= 1 AND io.total_bytes_read > 0
   AND io.total_write_operations >= 1 AND io.total_bytes_written > 0
FROM metrics_output;

SET tracked_metrics = ['query.total_time', 'query.cpu_time', 'query.sql', 'query.total_intermediate_rows', 'query.total_rows_scanned', 'operator.type', 'operator.timing', 'operator.intermediate_rows'];

SET legacy_metrics_format = true;

SELECT latency, cpu_time, query_name, cumulative_cardinality, cumulative_rows_scanned FROM metrics_output;

SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='metrics_output' AND column_name='query');

SELECT children IS NOT NULL FROM metrics_output;

SELECT children[1].operator_type, children[1].operator_timing FROM metrics_output;

SET tracked_metrics = ['query.total_time', 'operator.type', 'operator.timing'];

SET legacy_metrics_format = false;

SELECT query.total_time FROM metrics_output;

SELECT operator IS NOT NULL FROM metrics_output;

SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='metrics_output' AND column_name='latency');

USE my_db;

call enable_logging();

CREATE TABLE small AS FROM range(100);

CREATE TABLE medium AS FROM range(10000);

CREATE TABLE big AS FROM range(1000000);

SELECT count(*) FROM duckdb_logs_parsed('Metrics') WHERE metric == 'query.cpu_time';

CALL enable_logging('Metrics');

SET tracked_metrics = [
	'query.sql',
	'query.total_time',
	'parser.total_time',
	'planner.total_time',
	'optimizer.total_time',
	'physical_planner.total_time'
];

SET enable_profiling = 'no_output';

SELECT sum(i) FROM range(1000) t(i);

SELECT count(*)
FROM duckdb_logs_parsed('Metrics')
WHERE metric IN (
	'query.total_time',
	'parser.total_time',
	'planner.total_time',
	'optimizer.total_time',
	'physical_planner.total_time'
)
AND (
	start_time IS NULL
	OR end_time IS NULL
	OR start_time > end_time
);

SELECT CASE
	WHEN current_setting('debug_verify_statement') = 'none' THEN count(*) = 5
	ELSE count(*) > 0
END
FROM duckdb_logs_parsed('Metrics')
WHERE metric IN (
	'query.total_time',
	'parser.total_time',
	'planner.total_time',
	'optimizer.total_time',
	'physical_planner.total_time'
);

SELECT start_time IS NULL, end_time IS NULL
FROM duckdb_logs_parsed('Metrics')
WHERE metric = 'query.sql';

SET tracked_metrics = ['io.total_bytes_read', 'io.total_bytes_written'];

SET tracked_metrics = ['operator.timing'];

SET profiling_coverage='SELECT';

SELECT query.total_time != 0, contains(query.sql, 'ATTACH') FROM metrics_output;

CREATE TABLE profile_attach.tbl AS SELECT range AS id FROM range(10000);

SELECT query.total_time != 0, contains(query.sql, 'CREATE TABLE') FROM metrics_output;

INSERT INTO profile_attach.tbl SELECT range + 20000 FROM range(10000);

SELECT query.total_time != 0, contains(query.sql, 'INSERT INTO') FROM metrics_output;

CREATE INDEX idx ON profile_attach.tbl(id);

SELECT query.total_time != 0, contains(query.sql, 'CREATE INDEX') FROM metrics_output;

DETACH profile_attach;

SELECT query.total_time != 0, contains(query.sql, 'DETACH') FROM metrics_output;

SET disabled_optimizers = 'scalar_aggregate_merge';

SELECT count(DISTINCT file_name), count(DISTINCT row_group_id) FROM chunks;

SET tracked_metrics = ['query.total_bytes_scanned'];

SET tracked_metrics = ['query.total_bytes_scanned', 'operator.bytes_scanned', 'operator.type'];

CREATE MACRO scan_bytes(profile) AS TABLE
WITH RECURSIVE ops(op) AS (
    SELECT unnest(operator)::JSON AS op FROM read_json(profile)
    UNION ALL
    SELECT unnest((op->'children')::JSON[]) FROM ops WHERE json_array_length(op->'children') > 0
)
SELECT (op->>'bytes_scanned')::BIGINT AS bytes FROM ops WHERE op->>'type' = 'TABLE_SCAN';

SELECT count(*) FROM chunks WHERE file_name LIKE '%_1.parquet' AND col = 'i' AND max_i >= 4096;

CREATE TABLE native AS SELECT range AS i FROM range(2048);

EXPLAIN ANALYZE (FORMAT json) SELECT sum(i) FROM native;

SELECT query.total_bytes_scanned > 0,;

SET threads = 2;

SELECT count(*) FROM read_csv('data/csv/encodings/latin1.csv', encoding = 'latin-1');

EXPLAIN ANALYZE (FORMAT json) SELECT sum(i) FROM secure_scan;

EXPLAIN ANALYZE (FORMAT json) SELECT sum(i) FROM regular_scan;

CREATE TABLE profile_fs.tbl AS SELECT range AS id FROM range(10000);

SELECT io.total_bytes_written FROM metrics_output;

SELECT
	CASE WHEN io.total_bytes_written > 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

CREATE INDEX idx ON profile_fs.tbl(id);

SELECT * FROM profile_fs.tbl;

SELECT
	CASE WHEN io.total_bytes_read > 0 THEN 'true'
	ELSE 'false' END
FROM metrics_output;

CREATE TABLE integers AS SELECT range AS i FROM range(100);

EXPLAIN (ANALYZE, FORMAT json) SELECT i FROM integers WHERE i > 10;

EXPLAIN ANALYZE SELECT i FROM integers WHERE i > 10;

SET tracked_metrics = ['operator.type'];

RESET profiling_output;

SET enable_profiling = 'html';

SET enable_profiling = 'query_tree';

SET enable_profiling = 'GRAPHVIZ';

RESET enable_profiling;

CREATE TYPE empty_enum AS ENUM();

CREATE TABLE t(m empty_enum);

INSERT INTO t VALUES (NULL);

SELECT stats::VARCHAR FROM pragma_storage_info('t') ORDER BY ALL;

SELECT m, m::VARIANT FROM t;

CREATE TYPE single_enum AS ENUM('a');

CREATE TABLE t1(m single_enum);

INSERT INTO t1 VALUES (NULL);

SELECT stats::VARCHAR FROM pragma_storage_info('t1') ORDER BY ALL;

SELECT count(*) FROM t1 WHERE m = 'a';

INSERT INTO t1 VALUES ('a');

CREATE TYPE two_enum AS ENUM('a', 'b');

CREATE TABLE t2(m two_enum);

INSERT INTO t2 VALUES ('b'), (NULL);

SELECT stats::VARCHAR FROM pragma_storage_info('t2') WHERE segment_type <> 'VALIDITY';

SELECT count(*) FROM t2 WHERE m = 'b';

SET disabled_compression_methods='dictionary,rle';

SET profiling_output='test.json';

SET memory_limit='1GB';

SET memory_limit=-1;

SET memory_limit='-1';

SET memory_limit='none';

SET memory_limit=' -1';

SET memory_limit='1G';

SET memory_limit='   1G';

SET memory_limit = '1GB';

SET memory_limit='1.0gb';

SET memory_limit='1.0 gb';

SET memory_limit='488.2 MiB';

SET memory_limit='1.0 gigabytes';

SET memory_limit='100M';

SET memory_limit='100MB';

SET memory_limit='100 megabytes';

SET memory_limit='10000K';

SET memory_limit='10000KB';

SET memory_limit='10000 kilobytes';

SET memory_limit='1000000B';

SET memory_limit='1000000 bytes';

SET memory_limit='0.01T';

SET memory_limit='0.01TB';

SET memory_limit='0.01 terabytes';

CREATE TABLE integers(i INTEGER, j INTEGER);

CHECKPOINT;

PRAGMA metadata_info;

FROM pragma_metadata_info();

CREATE TABLE db1.integers(i INTEGER, j INTEGER);

CHECKPOINT db1;

FROM pragma_metadata_info('db1');

PRAGMA database_list;

SELECT * FROM pragma_database_list;

SELECT name, file FROM pragma_database_list;

CREATE TABLE db1.integers AS FROM range(1000000);

DROP TABLE db1.integers;

SELECT case when used_blocks <= 3 then NULL else t end  FROM pragma_database_size() t WHERE database_name='db1';

DETACH db1;

PRAGMA functions;

PRAGMA table_info('integers');

PRAGMA    table_info  ('integers');

CREATE TABLE test_table(i INTEGER, j VARCHAR);

INSERT INTO test_table VALUES (1, 'hello'), (2, 'world');

SELECT * FROM test_table ORDER BY i;

PRAGMA version;

select * from pragma_version();

select library_version from pragma_version();

PRAGMA platform;

select * from pragma_platform();

select platform from pragma_platform();

SELECT count(*) FROM pragma_version() WHERE library_version LIKE 'v%';

pragma extension_versions;

SET VARIABLE v = (select library_version  from pragma_version());

SET VARIABLE v_or_latest = (select CASE WHEN getvariable('v') ILIKE 'v%-dev%' THEN 'latest' WHEN getvariable('v') ILIKE 'v%-alpha%' THEN 'latest' WHEN getvariable('v') ILIKE 'v0.0.1' THEN 'latest' ELSE getvariable('v') END);

SET VARIABLE codename = (select CASE WHEN getvariable('v') ILIKE 'v%-dev%' THEN 'Development Version' WHEN getvariable('v') ILIKE 'v0.0.1' THEN 'Unknown Version' ELSE '%' END);

select count(*) FROM (select codename from pragma_version() WHERE codename LIKE getvariable('codename'));

SELECT CURRENT_SETTING('log_query_path');

SELECT 100;

SELECT 200;

SET log_query_path='';

CREATE TABLE "select"(i INTEGER);

CREATE VIEW v1 AS SELECT DATE '1992-01-01' AS k;

CREATE TABLE t2 (id INTEGER PRIMARY KEY, j VARCHAR UNIQUE);

CREATE SCHEMA s1;

CREATE TABLE s1.tbl(i INTEGER UNIQUE);

CREATE INDEX my_index ON s1.tbl(i);

CREATE TABLE tbl(i INTEGER PRIMARY KEY);

CREATE INDEX not_a_table ON tbl(i);

DESCRIBE s1.tbl;

DESCRIBE tbl;

DESCRIBE t2;

PRAGMA "SHOW"('t2');

SHOW TABLES;

DESCRIBE TABLES;

PRAGMA show_tables;

SHOW integers;

SHOW "select";

PRAGMA "SHOW"('integers');

DESCRIBE v1;

CREATE VIEW show_tables_view AS ( SHOW TABLES );

SELECT * FROM show_tables_view ORDER BY ALL;

ATTACH IF NOT EXISTS ':memory:' AS db;

USE db;

CREATE TABLE main_table1(i INTEGER);

CREATE SCHEMA test_schema;

CREATE TABLE test_schema.test_schema_table1(k INTEGER);

ATTACH DATABASE ':memory:' AS db1;

CREATE TABLE db1.db1_table1(m INTEGER);

CREATE SCHEMA db1.db1_schema;

CREATE TABLE db1.db1_schema.db1_schema_table1(n INTEGER);

ATTACH DATABASE ':memory:' AS "db_quo""ted";

CREATE SCHEMA "db_quo""ted"."db_quo""ted_schema";

CREATE TABLE "db_quo""ted"."db_quo""ted_schema"."db_quo""ted_table1"(m INTEGER);

SHOW TABLES FROM db.main;

SHOW TABLES FROM db1;

SHOW TABLES FROM test_schema;

SHOW TABLES FROM db1.main;

SHOW TABLES FROM db1.db1_schema;

CREATE SCHEMA "Quoted Schema";

CREATE TABLE "Quoted Schema"."Quoted Table"(r INTEGER);

SHOW TABLES FROM db."Quoted Schema";

SHOW TABLES FROM "db_quo""ted"."db_quo""ted_schema";

CREATE TEMPORARY VIEW v1 AS SELECT 42 AS a;

SHOW ALL TABLES;

CREATE VIEW v2 AS SELECT 42 AS b;

CREATE VIEW s1.v3 AS SELECT 42 AS c;

SET schema='s1';

FROM v2;

PRAGMA storage_info('integers');

INSERT INTO integers VALUES (1, 1), (2, NULL), (3, 3), (4, 5);

CREATE VIEW v1 AS SELECT 42;

CREATE TABLE different_types(i INTEGER, j VARCHAR, k STRUCT(k INTEGER, l VARCHAR));

INSERT INTO different_types VALUES (1, 'hello', {'k': 3, 'l': 'hello'}), (2, 'world', {'k': 3, 'l': 'thisisaverylongstring'});

PRAGMA storage_info('different_types');

CREATE TABLE nested_lists AS SELECT
	[1, 2, 3] i,
	[['hello', 'world'], [NULL]] j,
	[{'a': 3}, {'a': 4}] k;

PRAGMA storage_info('nested_lists');

CREATE TABLE integers(i INTEGER DEFAULT 1+3, j INTEGER);

PRAGMA table_info(integers);

PRAGMA table_info='integers';

PRAGMA table_info=integers;

CREATE VIEW v1 AS SELECT 42::INTEGER AS a, 'hello' AS b;

PRAGMA table_info('v1');

CREATE VIEW v2(c) AS SELECT 42::INTEGER AS a, 'hello' AS b;

PRAGMA table_info('v2');

CREATE VIEW v3(c, d) AS SELECT DATE '1992-01-01' a, 'hello' AS b;

PRAGMA table_info('v3');

CREATE SCHEMA test;

CREATE VIEW test.v1 AS SELECT 42::INTEGER AS a, 'hello' AS b;

PRAGMA table_info('test.v1');

create table tconstraint1(i integer primary key default(3), j blob not null);

PRAGMA table_info(tconstraint1);

create table tconstraint2(i integer, j integer, k integer, l integer unique, primary key(i, j, k));

PRAGMA table_info(tconstraint2);

create table t1 (
	c1 int,
	c2 int generated always as (c1 + 1)
);

SELECT * FROM pragma_table_info('t1');

CREATE SCHEMA "my.schema";

CREATE TABLE "my.schema"."dotted.name"(i INTEGER);

SELECT count(*) FROM pragma_table_info('"my.schema"."dotted.name"');

CREATE TABLE "quo""ted"(i INTEGER, j INTEGER);

SELECT count(*) FROM pragma_table_info('"quo""ted"');

CREATE TABLE quoted(i INTEGER);

CREATE TABLE """"(i INTEGER);

SELECT count(*) FROM pragma_table_info('""""');

CREATE TABLE t(i INTEGER);

PRAGMA enable_checkpoint_on_shutdown;

PRAGMA verify_parallelism;

PRAGMA disable_verify_parallelism;

SET explain_output='all';

PRAGMA enable_progress_bar;

PRAGMA disable_progress_bar;

PRAGMA enable_print_progress_bar;

PRAGMA disable_print_progress_bar;

SET debug_checkpoint_abort='none';
