CREATE MACRO mock_create(p) AS TABLE SELECT MAP {'id': 'r1'} AS handle;

CREATE MACRO mock_destroy(h) AS TABLE SELECT 'ok' AS status;

SELECT uri, attached_db_type, deleter_function LIKE '%mock_destroy', handle
FROM create_external_resource('mock@local', params := MAP {'region': 'x'});

SELECT handle, uri FROM create_external_resource('mock@local', handle := MAP {'id': 'adopted'});

SET VARIABLE dpl = (SELECT deleter_payload FROM create_external_resource('mock@local'));

CREATE MACRO bad_status(h) AS TABLE SELECT 'ready' AS state, MAP {'foo': 'bar'} AS result;

CREATE MACRO fail_status(h) AS TABLE SELECT 'failed' AS state, MAP {'x': 'y'} AS result;

CALL register_external_resource_type('nostatus@local', kind := 'catalog', create_function := 'mock_create');

CREATE MACRO plain_status(h) AS TABLE SELECT 'ready' AS state, MAP {'uri':'kw', 'attached_db_type':'quack'} AS result;

SELECT uri FROM create_external_resource('kw@local');

CALL register_external_resource_type('nonmap_result@local', kind := 'compute', create_function := 'mock_create', status_function := 'nonmap_result_status');

CALL register_external_resource_type('nonmap_handle@local', kind := 'compute', create_function := 'nonmap_handle_create', status_function := 'mock_status');

CALL register_external_resource_type('stuck@local', kind := 'catalog', create_function := 'mock_create', status_function := 'stuck_status');

SET max_execution_time = 0;

CALL register_external_resource_type('compute@local', kind := 'compute', create_function := 'mock_create', status_function := 'compute_status');

CREATE SCHEMA app;

CREATE MACRO app.sp_status(h) AS TABLE SELECT 'ready' AS state, MAP {'uri':'quack:sp', 'attached_db_type':'quack'} AS result;

CALL register_external_resource_type('sp@local', kind := 'catalog', create_function := 'sp_create', status_function := 'sp_status');

SELECT uri FROM create_external_resource('sp@local');

CREATE SEQUENCE q.qd_calls;

CREATE MACRO q.qd_status(h) AS TABLE SELECT 'ready' AS state, MAP {'uri':'qq','attached_db_type':'quack'} AS result;

SET search_path = 'q';

SELECT deleter_function LIKE '%.q.qd_destroy' FROM create_external_resource('qd@local');

SET VARIABLE dpl = (SELECT deleter_payload FROM create_external_resource('qd@local'));

CREATE MACRO ok_handle(p) AS TABLE SELECT MAP {'id':'z'} AS handle;

CREATE MACRO record_teardown(h) AS TABLE SELECT nextval('teardown_calls') AS n;

SELECT nextval('teardown_calls');

CREATE MACRO record_teardown_kept(h) AS TABLE SELECT nextval('teardown_calls_kept') AS n;

SELECT nextval('teardown_calls_kept');

CREATE MACRO pc_create(p) AS TABLE SELECT MAP {'id': 'r' || nextval('prov_count')} AS handle;

CALL register_external_resource_type('pc@local', kind := 'catalog', create_function := 'pc_create', status_function := 'pc_status');

SELECT nextval('prov_count');

SELECT * FROM create_external_resource('pc@local') LIMIT 0;

CREATE TABLE x (x INT);

SELECT metric_name, metric_type, description, unit
FROM duckdb_available_metrics()
WHERE metric_name = 'query.cpu_time';

set storage_compatibility_version='v0.10.2';

CREATE TABLE test(i INTEGER NOT NULL, j DECIMAL(18, 3), k VARCHAR DEFAULT 'hello');

SELECT DISTINCT(cols.database_name) = current_database()
FROM duckdb_columns cols JOIN duckdb_tables tables USING (table_oid);

select table_name, column_name from duckdb_columns where table_name = 'v1';

alter table test rename column renamed to j;

alter table test rename column k to not_k;

create table test(i varchar unique, k varchar, check(len(i || k) < 10));

create table fk_integers_2(k int, foreign key (k) references integers(i));

SELECT constraint_name, unique_constraint_name FROM information_schema.referential_constraints ORDER BY constraint_name;

SELECT constraint_name, table_name, constraint_type FROM information_schema.table_constraints ORDER BY constraint_name;

CREATE TABLE tf_3 (
  g integer, h integer,
  PRIMARY KEY (g),
  UNIQUE (h)
);

CREATE TABLE tf_4 (
  h integer,
  FOREIGN KEY (h) REFERENCES tf_3 (h),
);

create table t (i int primary key);

create table u (i int references t);

drop table v;

CREATE TABLE a (ID int PRIMARY KEY);

SELECT constraint_name, unique_constraint_name FROM information_schema.referential_constraints;

CREATE TABLE s1.a (ID int PRIMARY KEY);

SELECT COUNT(*) FROM information_schema.referential_constraints;

SELECT constraint_type, constraint_column_indexes, constraint_column_names, constraint_name FROM duckdb_constraints() WHERE table_name = 't';

SELECT constraint_column_indexes, constraint_column_names, constraint_name FROM duckdb_constraints() WHERE table_name = 't5' AND constraint_type = 'CHECK';

CREATE TABLE t6 (a INTEGER, b STRUCT(a INTEGER), CHECK (t6.b.a > 0 AND t6.a > 0));

CREATE TABLE t7 (a INTEGER[], x INTEGER, CHECK (list_transform(a, lambda x: 1) = [1]));

SELECT DISTINCT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name IN ('t_b_check', 't5_b_check', 't6_b_a_check') ORDER BY ALL;

SELECT constraint_column_indexes, constraint_column_names, constraint_name FROM duckdb_constraints() WHERE table_name = 'tj' AND constraint_type = 'CHECK';

SELECT database_name, internal, readonly, path, type FROM duckdb_databases() ORDER BY database_name;

SELECT readonly FROM duckdb_databases WHERE database_name='new_duckdb_database';

SHOW databases;

DETACH new_duckdb_database;

SELECT * FROM duckdb_dependencies();

SELECT dialect_name FROM duckdb_dialects() ORDER BY dialect_name;

RESET current_dialect;

CREATE MACRO fudge() AS (20);

CREATE TABLE t AS SELECT range AS i, range::VARCHAR AS s
FROM range(2000000);

CHECKPOINT;

SET memory_limit='2MB';

CREATE TABLE t(i BIGINT, s VARCHAR);

INSERT INTO t SELECT range AS i, range::VARCHAR AS s FROM range(200000);

COMMIT;

SELECT aliases FROM duckdb_extensions() WHERE extension_name='postgres_scanner';

LOAD tpch;

SELECT parameters, description, examples[1], categories
FROM duckdb_functions() WHERE function_name = 'variant_contains';

select function_name, parameters, parameter_types, function_type 
from duckdb_functions() 
where function_type = 'window' 
order by all;

CREATE INDEX i_index ON integers((j + 1), k);

SELECT * FROM duckdb_keywords();

SELECT metric_name, variant_typeof(metric_value) FROM duckdb_live_query_metrics()
WHERE connection_id = current_connection_id() ORDER BY metric_name;

SELECT metric_value::UBIGINT < 10000000 FROM duckdb_live_query_metrics()
WHERE connection_id = current_connection_id() AND metric_name = 'system.total_memory_allocated';

SELECT metric_name, metric_value::DOUBLE > 0 FROM duckdb_live_query_metrics()
WHERE connection_id = (SELECT id FROM monitored)
AND metric_name IN ('io.total_bytes_read', 'io.total_read_operations') ORDER BY metric_name;

SELECT metric_value::UBIGINT > 0 FROM duckdb_live_query_metrics()
WHERE connection_id = (SELECT id FROM monitored) AND metric_name = 'io.total_bytes_read';

select memory_usage_bytes from duckdb_memory() where tag = 'IN_MEMORY_TABLE';

SELECT name FROM duckdb_optimizers() WHERE name='join_order';

create table tbl(a varchar);

prepare p3 as select 21, $1, $2;

select * from duckdb_prepared_statements() order by name;

CREATE SCHEMA scheme;

SELECT COUNT(*) FROM duckdb_schemas WHERE schema_name='scheme';

CREATE SEQUENCE seq;

SELECT schema_name, sequence_name, temporary, start_value, min_value, max_value, increment_by, cycle
FROM duckdb_sequences() ORDER BY sequence_name;

SET default_null_order='nulls_first';

SELECT name, value FROM duckdb_settings() WHERE name='default_null_order';

SELECT COUNT(DISTINCT variant_typeof(typed_value)) > 1 FROM duckdb_settings();

SELECT
    typeof(value),
    typeof(typed_value),
    variant_typeof(typed_value)
FROM duckdb_settings()
WHERE name = 'logging_level';

CREATE TABLE pk(i INTEGER PRIMARY KEY, j VARCHAR, CHECK(i<100));

CREATE TABLE myschema.mytable(k DOUBLE);

CREATE VIEW v1 AS SELECT 42;

SELECT database_name = current_database() OR database_name = 'temp'
FROM duckdb_tables();

CREATE TEMPORARY VIEW v2 AS SELECT 42;

SELECT schema_name, view_name, temporary
FROM duckdb_views() WHERE NOT internal ORDER BY ALL;

SELECT schema_name, view_name, temporary
FROM duckdb_views ORDER BY ALL;

CREATE MACRO d(h) AS TABLE FROM destroy_external_resource('d', 1);

CREATE MACRO st(h) AS TABLE SELECT 'ready' AS state, MAP {'uri': ':memory:'} AS result;

CREATE MACRO ok_deleter(h) AS TABLE SELECT true AS success;

SELECT 42;

SET max_execution_time=500;

CREATE MACRO mock_list(opts) AS TABLE
    SELECT * FROM (VALUES
        (MAP {'id': 'd1'}, 'dee-one', 'ext-1', 'running'),
        (MAP {'id': 'd2'}, 'dee-two', 'ext-2', 'stopped')
    ) t(handle, name, reference, state);

SELECT list_function FROM duckdb_external_resource_types() WHERE name = 'mock@disc';

SELECT name, type, managed, state, reference FROM duckdb_external_resources(discover := true) ORDER BY reference;

SELECT name, type, managed FROM duckdb_external_resources();

CALL register_external_resource_type('nolist@disc', kind := 'catalog', create_function := 'noop_create');

CREATE MACRO other_list(opts) AS TABLE
    SELECT * FROM (VALUES (MAP {'id': 'd1'}, 'other-one', 'other-1', 'running')) t(handle, name, reference, state);

SELECT name, type, managed, state, reference FROM duckdb_external_resources(discover := true) ORDER BY type, reference;

SELECT name, type, managed FROM duckdb_external_resources(discover := true) ORDER BY type, name;

CALL register_external_resource_type('nohandle@disc', kind := 'catalog', create_function := 'noop_create', list_function := 'nohandle_list');

CREATE OR REPLACE MACRO nohandle_list(opts) AS TABLE SELECT MAP {'id': 'a'} AS handle, 'ext-1' AS reference, 'running' AS state;

SELECT name, type, reference, state FROM duckdb_external_resources(discover := true);

CALL register_external_resource_type('badtype@disc', kind := 'catalog', create_function := 'noop_create', list_function := 'badtype_list');

CALL register_external_resource_type('broken@disc', kind := 'catalog', create_function := 'noop_create', list_function := 'no_such_list_fn');

CREATE MACRO no_such_list_fn(opts) AS TABLE SELECT MAP {'id': 'c'} AS handle, 'three' AS name, 'ext-3' AS reference, 'running' AS state;

CALL register_external_resource_type('rec@disc', kind := 'catalog', create_function := 'noop_create', list_function := 'rec_list');

CALL enable_logging('ExternalResource');

SELECT operation, outcome, error IS NULL
FROM duckdb_logs_parsed('ExternalResource') WHERE resource_type = 'mock@local' ORDER BY operation;

CREATE MACRO scalar_create(p) AS TABLE SELECT 42 AS handle;

SELECT operation, outcome
FROM duckdb_logs_parsed('ExternalResource') WHERE resource_type = 'scalarcreate@local';

CALL register_external_resource_type('emptycreate@local', kind := 'catalog', create_function := 'empty_create',
    status_function := 'mock_status', destroy_function := 'mock_destroy');

CREATE MACRO failed_status(h) AS TABLE SELECT 'failed' AS state, MAP {'id': 'r1'} AS result;

SELECT operation, outcome
FROM duckdb_logs_parsed('ExternalResource') WHERE resource_type = 'failed@local' ORDER BY operation;

SELECT DISTINCT type, log_level, scope FROM duckdb_logs_parsed('ExternalResource');

SELECT operation, outcome, resource_name IS NULL
FROM duckdb_logs_parsed('ExternalResource') WHERE resource_type IS NULL;

CALL register_external_resource_type('quack@aws:ec2', kind := 'catalog', create_function := 'quack_create');

CALL register_external_resource_type('pg@aws:rds', kind := 'catalog', create_function := 'pg_create',
    status_function := 'pg_status', destroy_function := 'pg_destroy', resolve_function := 'pg_resolve');

CALL register_external_resource_type('scratch_bucket', kind := 'storage', create_function := 's3_bucket_create', destroy_function := 's3_bucket_destroy');

SELECT create_function, count(*) OVER () FROM duckdb_external_resource_types() WHERE name = 'quack@aws:ec2';

CALL register_external_resource_type('q@x', kind := 'catalog', create_function := 'my_catalog.my_schema."weird name"');

CREATE SEQUENCE calls_a;

CREATE MACRO list_a(opts) AS TABLE
    SELECT MAP {'id': 'a' || nextval('calls_a')::VARCHAR} AS handle, 'a-name' AS name, 'a-ref' AS reference, 'running' AS state;

CALL register_external_resource_type('a@pr', kind := 'catalog', create_function := 'noop_create', list_function := 'list_a');

SELECT nextval('calls_a'), nextval('calls_b');

SELECT type, handle FROM duckdb_external_resources(discover := true, type := 'a@pr');

CALL register_external_resource('a@pr', 'local_a', MAP {'id': 'x'});

SELECT * FROM duckdb_external_resources(type := 'b@pr');

SELECT name, type, managed FROM duckdb_external_resources(discover := true, type := 'a@pr');

CALL register_external_resource('orphan@pr', 'kept', MAP {'id': 'o'});

CALL register_external_resource_type('a@wp', kind := 'catalog', create_function := 'noop_create', list_function := 'list_a');

SELECT type, handle FROM duckdb_external_resources(discover := true) WHERE type = 'a@wp';

SELECT type, handle FROM duckdb_external_resources(discover := true) WHERE type IN ('a@wp', 'none@wp');

SELECT type, handle FROM duckdb_external_resources(discover := true) WHERE type <> 'b@wp';

SELECT type, handle FROM duckdb_external_resources(discover := true) WHERE handle['id'] LIKE 'b%';

EXECUTE p;

SET TimeZone = 'America/Los_Angeles';

SELECT d FROM range(TIMESTAMPTZ '1992-01-01 00:00:00-08', TIMESTAMPTZ'1991-06-01 00:00:00-07', INTERVAL '1 MONTH ago') tbl(d);

SELECT d FROM range(TIMESTAMPTZ '1992-01-01 00:00:00-08', TIMESTAMPTZ '1992-12-31 12:00:00-08', INTERVAL '1 MONTH 1 DAY 1 HOUR') tbl(d);

SELECT d FROM generate_series(TIMESTAMPTZ '1992-10-25 00:00:00-07', TIMESTAMPTZ '1992-10-25 12:00:00-08', INTERVAL '1 HOUR') tbl(d);

SELECT COUNT(*) FROM generate_series(TIMESTAMPTZ '1992-01-01 00:00:00-08', TIMESTAMPTZ '2020-01-01 00:00:00-08', INTERVAL '1 DAY') tbl(d);

SELECT d FROM range(TIMESTAMPTZ '1993-01-01 00:00:00-08', TIMESTAMPTZ '1992-01-01 00:00:00-08', INTERVAL '1 MONTH') tbl(d);

SET threads = 1;

SELECT list(i ORDER BY i) FROM t, LATERAL range(
    ts + (CASE WHEN i = 5 THEN INTERVAL '7 minutes' ELSE INTERVAL '0 minutes' END),
    ts + INTERVAL '5 minutes',
    INTERVAL '10 minutes');

SELECT count(*) FILTER (WHERE i % 2 = 0), count(*) FROM generate_series(0, 64) s(i), LATERAL range(
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + (CASE WHEN i % 2 = 0 THEN INTERVAL '1 minute' ELSE INTERVAL '7 minutes' END),
    TIMESTAMPTZ '2024-01-01 00:00:00+00' + INTERVAL '5 minutes',
    INTERVAL '10 minutes');

SELECT * FROM INFORMATION_SCHEMA.SCHEMATA;

CREATE TABLE scheme.integers (i INTEGER);

SELECT ordinal_position, column_name, data_type FROM information_schema.columns WHERE table_name='integers';

SELECT table_type FROM information_schema.tables WHERE table_catalog='temp' AND table_name='reals';

CREATE VIEW scheme.vintegers AS SELECT * FROM scheme.integers;

SELECT ordinal_position, column_name, data_type FROM information_schema.columns WHERE table_schema='scheme' AND table_name='vintegers' AND table_catalog IS NOT NULL;

SELECT * FROM information_schema.referential_constraints;

SELECT * FROM information_schema.table_constraints;

CREATE TABLE scheme.emp (emp_id INT PRIMARY KEY, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, ssn INT NOT NULL UNIQUE, salary DECIMAL(10, 2) NOT NULL CHECK (salary > 0), dept_id INT REFERENCES scheme.dept(dept_id));

SELECT DISTINCT(table_catalog) = current_database()
FROM information_schema.constraint_column_usage
WHERE table_schema = 'scheme' AND table_name = 'emp'
ORDER BY column_name ASC;

SELECT table_schema, table_name, constraint_schema, constraint_name
FROM information_schema.constraint_table_usage
WHERE table_schema = 'scheme' AND table_name = 'emp'
ORDER BY constraint_name ASC;

SELECT DISTINCT(constraint_catalog) = current_database()
FROM information_schema.check_constraints
WHERE constraint_schema = 'scheme' AND check_clause LIKE 'CHECK%';

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'scheme' AND constraint_name LIKE 'check_columns%'
ORDER BY ALL;

ATTACH ':memory:' AS check_db;

CREATE TABLE check_db.scheme.check_columns (a INTEGER, b INTEGER NOT NULL, CHECK (1 = 1));

DETACH check_db;

SELECT table_schema, table_name, SUBSTR (view_definition, 1, 32) AS view_definition_substr, check_option, is_updatable, is_insertable_into, is_trigger_updatable, is_trigger_deletable, is_trigger_insertable_into
FROM information_schema.views
WHERE table_schema = 'scheme' AND table_name = 'emp_dept_view';

DROP SCHEMA scheme CASCADE;

SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='scheme';

select constraint_name
from information_schema.key_column_usage
order by 1;

create table target_tbl (target_col int primary key);

DROP TABLE source_tbl;

CREATE TABLE a (
  a1 INT, a2 INT, a3 INT,
  UNIQUE (a1, a2), UNIQUE (a2, a3)
);

SELECT constraint_name, constraint_type FROM information_schema.table_constraints ORDER BY ALL;

CREATE TABLE b (a1 int, a2 int, FOREIGN KEY (a1, a2) REFERENCES a);

select table_name, column_name
from duckdb_columns()
where database_name = 'system'
and schema_name = 'information_schema'
and data_type = 'NULL';

select i from generate_series(1, 2) i;

select column_name, column_type from (describe select * from generate_series(1, 2) t(i));

select column_name, column_type from (describe select * from range(1, 3) r);

select i from range(1, 3) r(i);

select column_name, column_type from (describe select * from unnest([1, 2]) i);

select i.generate_series from generate_series(1, 2) i;

select r.unnest from unnest(range(0, 3)) as r;

select column_name, column_type from (describe select i from unnest([1, 2]) i);

select column_name, column_type from (describe select i.* from unnest([1, 2]) i);

create table lists as select * from (values (1, [10, 20]), (2, [30])) t(id, l);

select g.generate_series, g.ordinality from generate_series(1, 3) with ordinality as g;

SELECT count(*) FROM range(TIMESTAMP '1992-01-01', TIMESTAMP '1992-12-31', INTERVAL '-1 MONTH') t1, range(3) t2;

SELECT count(*) FROM generate_series(TIMESTAMP '1992-12-31', TIMESTAMP '1992-01-01', INTERVAL '1 day') t1, range(3) t2;

EXPLAIN SELECT count(*) FROM range(-9223372036854775808, 9223372036854775807) t1, range(-9223372036854775808, 9223372036854775807) t2;

select * from range(4,15,6);

select * from range(4,15);

select * from range(-4,-15,-3)a;

select * from range(4,19,5)a;

SELECT * FROM range(1, NULL, 1);

SELECT * FROM (SELECT NULL a), range(timestamp '2010-01-01', a, null);

SELECT * FROM range(4) t(i), range(i) t2(j), range(j) t3(k) ORDER BY i, j, k;

SELECT i, j, l, str FROM (SELECT ARRAY['null'], NULL, 'null' UNION ALL SELECT ARRAY['five'], 5, 'five' UNION ALL SELECT ARRAY['two'], 2, 'two') t(l, i, str), generate_series(0,i-1) t2(j) order by i, j;

PREPARE v1 AS SELECT * FROM range(?);

SELECT * FROM (SELECT 3, 1, -1 UNION ALL SELECT 1, 3, 2) t(s, e, increment), range(s, e, increment) t2(j) ORDER BY s, j;

SELECT * FROM (SELECT DATE '2000-01-01', DATE '2000-10-1', INTERVAL '3' MONTHS) t(s, e, increment), generate_series(s, e, increment) t2(j) ORDER BY s, j;

select count(*) from (values (1), (10), (100), (1000), (10000)) t(a), range(a);

SELECT * FROM (SELECT TIMESTAMPTZ '2000-01-01', TIMESTAMPTZ '2000-10-1', NULL) t(s, e, increment), range(s, e, increment) t2(j) ORDER BY s, j;

SET threads = 4;

SELECT count(*), sum(series) FROM t CROSS JOIN generate_series(1, CASE WHEN t.val1 % 10 = 0 THEN 0 WHEN t.val1 % 100 = 71 THEN 2 ELSE 1 END) AS g(series);

SELECT count(*), count(*) FILTER (WHERE x < val1 OR x >= val1 + n), count(*) FILTER (WHERE o <> x - val1 + 1), sum(x - val1)
FROM (SELECT val1, CASE WHEN val1 % 3000 = 0 THEN 5000 ELSE val1 % 3 END AS n FROM t), LATERAL range(val1, val1 + n) WITH ORDINALITY r(x, o);

SELECT count(*), count(DISTINCT x), max(x) = TIMESTAMPTZ '2020-01-03 00:00:00+00' FROM t, LATERAL generate_series(TIMESTAMPTZ '2020-01-01 00:00:00+00', TIMESTAMPTZ '2020-01-01 00:00:00+00' + (t.val1 % 3) * INTERVAL 1 DAY, INTERVAL 1 DAY) r(x);

CALL enable_logging('QueryLog');

SELECT count(*) AS probe_unnest FROM range(10000) t(i), LATERAL unnest([i]) r(x);

SELECT count(*) AS probe_generate_series FROM range(10000) t(i), LATERAL generate_series(i, i) r(x);

SELECT count(*) AS probe_timestamp_range FROM range(10000) t(i), LATERAL range(TIMESTAMP '2020-01-01' + i * INTERVAL 1 DAY, TIMESTAMP '2020-01-02' + i * INTERVAL 1 DAY, INTERVAL 1 DAY) r(x);

SELECT probe, span = (SELECT span FROM probe_spans WHERE probe = 'probe_unnest')
FROM probe_spans WHERE probe IN ('probe_range', 'probe_generate_series') ORDER BY probe;

SELECT count(*) AS probe_timestamptz_unnest FROM range(10000) t(i), LATERAL unnest([TIMESTAMPTZ '2020-01-01 00:00:00+00' + i * INTERVAL 1 DAY]) r(x);

SELECT count(*) AS probe_timestamptz_end FROM range(1);

SELECT count(*) FROM range((SELECT 3));

SELECT to_timestamp(range) as entry
    FROM range(
      epoch(date_trunc('month', current_date))::BIGINT,
      epoch(date_trunc('month', current_date) + interval '1 month' - interval '1 day')::BIGINT,
      epoch(interval '1 day')::BIGINT
    );

SELECT * FROM range(date '1992-01-01', date '1992-01-01', interval '1' month);

SELECT d FROM range(TIMESTAMP '1992-01-01 00:00:00', TIMESTAMP '1992-01-01 12:00:00', INTERVAL (1) HOUR) tbl(d);

SELECT * FROM range(timestamp '1992-01-01 00:00:00', timestamp '1992-01-01 00:00:01', interval '1' month);

SELECT d FROM generate_series(TIMESTAMP '1992-01-01 00:00:00', TIMESTAMP '1991-06-01 00:00:00', -INTERVAL '1 MONTH') tbl(d);

SELECT COUNT(*) FROM range(TIMESTAMP '1992-01-01 00:00:00', TIMESTAMP '2020-01-01 00:00:00', INTERVAL '1 DAY') tbl(d);

SELECT COUNT(*) FROM range(NULL, TIMESTAMP '1992-12-31 12:00:00', INTERVAL '1 MONTH') tbl(d);

explain
from range('290309-12-22 (BC) 00:00:00'::TIMESTAMP, '294247-01-10 04:00:54.775806'::TIMESTAMP, interval '1 hour');

SELECT d FROM range(TIMESTAMP '1993-01-01 00:00:00', TIMESTAMP '1992-01-01 00:00:00', INTERVAL '1 MONTH') tbl(d);

SELECT COUNT(*) FROM t, LATERAL range(ts, ts + INTERVAL '5 minutes', INTERVAL '10 minutes');

SELECT COUNT(*) FROM t, LATERAL range(
    ts + (CASE WHEN i = 0 THEN INTERVAL '7 minutes' ELSE INTERVAL '0 minutes' END),
    ts + INTERVAL '5 minutes',
    INTERVAL '10 minutes');

CREATE TABLE t2 AS
SELECT i,
       TIMESTAMP '2024-01-01' + INTERVAL (i * 60) SECOND AS ts,
       CASE WHEN i % 2 = 0 THEN 1 ELSE 7 END AS k
FROM generate_series(0, 64) s(i);

SELECT COUNT(*) FROM t2, LATERAL range(k::BIGINT, 5::BIGINT, 10::BIGINT);

SELECT COUNT(*) FROM read_text('test/sql/table_function/files/*.txt');

SELECT * FROM read_text('test/sql/table_function/files/nonexistentfile.txt') ORDER BY ALL;

SELECT parse_path(filename) FROM read_text(['test/sql/table_function/files/one.txt', 'test/sql/table_function/files/two.txt']) ORDER BY ALL;

SELECT size, parse_path(filename), content  FROM read_text('test/sql/table_function/files/*.txt') ORDER BY filename, size;

select filename from read_blob('s3://does-not-exist1144/date=2025-10-11/file.parquet');

SELECT name, type, managed, uri, attached_db_type, handle FROM duckdb_external_resources();

SELECT name, uri, attached_db_type, handle FROM duckdb_external_resources() WHERE name = 'r2';

CALL register_external_resource('mock@local', 'r_txn', MAP {'id': 'txn'});

CALL deregister_external_resource('r_txn');

CALL deregister_external_resource('r2');

SELECT * FROM sqlite_master;

SELECT EXISTS(SELECT * FROM sqlite_master OFFSET 1);

SELECT COUNT(*) FROM sqlite_master WHERE name='integers';

SELECT * FROM sqlite_master WHERE name='tconstraint1';

SELECT * FROM sqlite_master WHERE name='tconstraint2';

SELECT "type", "name", "tbl_name", rootpage FROM sqlite_master WHERE name='v1';

DROP TABLE "a b c";

DROP TABLE "inte""gers";

DROP TABLE integers;

SELECT * FROM range(1, 5);

CREATE TABLE wide (
  col0 varchar,
  col1 int,
  col2 time,
  col3 time,
  col4 bigint,
  col5 bigint,
  col6 varchar,
  col7 time,
  col8 varchar,
  col9 int,
  col10 bigint,
  col11 time,
  col12 time,
  col13 varchar,
  col14 time,
  col15 varchar,
  col16 varchar,
  col17 int,
  col18 time,
  col19 int,
  col20 bigint,
  col21 time,
  col22 int,
  col23 bigint,
  col24 varchar,
  col25 varchar,
  col26 bigint,
  col27 time,
  col28 bigint,
  col29 time,
  col30 varchar,
  col31 int,
  col32 int,
  col33 varchar,
  col34 bigint,
  col35 varchar,
  col36 bigint,
  col37 varchar,
  col38 int,
  col39 time,
  col40 time,
  col41 time,
  col42 bigint,
  col43 varchar,
  col44 bigint,
  col45 int,
  col46 time,
  col47 int,
  col48 int,
  col49 varchar,
  col50 varchar,
  col51 int,
  col52 time,
  col53 varchar,
  col54 varchar,
  col55 varchar,
  col56 bigint,
  col57 time,
  col58 bigint,
  col59 time,
  col60 time,
  col61 varchar,
  col62 varchar,
  col63 time,
  col64 varchar,
  col65 varchar,
  col66 bigint,
  col67 int,
  col68 bigint,
  col69 varchar,
  col70 int,
  col71 varchar,
  col72 bigint,
  col73 bigint,
  col74 varchar,
  col75 time,
  col76 varchar,
  col77 int,
  col78 time,
  col79 varchar,
  col80 bigint,
  col81 int,
  col82 bigint,
  col83 bigint,
  col84 bigint,
  col85 time,
  col86 bigint,
  col87 time,
  col88 time,
  col89 int,
  col90 bigint,
  col91 bigint,
  col92 int,
  col93 int,
  col94 time,
  col95 varchar,
  col96 varchar,
  col97 varchar,
  col98 varchar,
  col99 int,
  col100 varchar,
  col101 int,
  col102 time,
  col103 varchar,
  col104 bigint,
  col105 varchar,
  col106 int,
  col107 varchar,
  col108 time,
  col109 time,
  col110 bigint,
  col111 int,
  col112 time,
  col113 int,
  col114 time,
  col115 int,
  col116 int,
  col117 time,
  col118 varchar,
  col119 bigint,
  col120 time,
  col121 int,
  col122 int,
  col123 varchar,
  col124 varchar,
  col125 bigint,
  col126 varchar,
  col127 varchar,
  col128 bigint,
  col129 time,
  col130 time,
  col131 int,
  col132 varchar,
  col133 varchar,
  col134 bigint,
  col135 int,
  col136 int,
  col137 bigint,
  col138 time,
  col139 time,
  col140 varchar,
  col141 varchar,
  col142 time,
  col143 varchar,
  col144 bigint,
  col145 bigint,
  col146 time,
  col147 varchar,
  col148 bigint,
  col149 bigint,
  col150 time,
  col151 varchar,
  col152 varchar,
  col153 time,
  col154 time,
  col155 varchar,
  col156 time,
  col157 varchar,
  col158 bigint,
  col159 time,
  col160 time,
  col161 varchar,
  col162 int,
  col163 time,
  col164 bigint,
  col165 time,
  col166 int,
  col167 int,
  col168 int,
  col169 bigint,
  col170 int,
  col171 varchar,
  col172 varchar,
  col173 int,
  col174 time,
  col175 int,
  col176 bigint,
  col177 time,
  col178 int,
  col179 int,
  col180 int,
  col181 bigint,
  col182 varchar,
  col183 int,
  col184 time,
  col185 time,
  col186 bigint,
  col187 bigint,
  col188 varchar,
  col189 varchar,
  col190 bigint,
  col191 int,
  col192 int,
  col193 int,
  col194 int,
  col195 varchar,
  col196 varchar,
  col197 time,
  col198 varchar,
  col199 bigint,
  col200 varchar,
  col201 time,
  col202 varchar,
  col203 bigint,
  col204 bigint,
  col205 int,
  col206 varchar,
  col207 bigint,
  col208 bigint,
  col209 time,
  col210 varchar,
  col211 int,
  col212 varchar,
  col213 int,
  col214 bigint,
  col215 int,
  col216 int,
  col217 bigint,
  col218 int,
  col219 int,
  col220 int,
  col221 int,
  col222 varchar,
  col223 varchar,
  col224 bigint,
  col225 bigint,
  col226 int,
  col227 varchar,
  col228 int,
  col229 varchar,
  col230 bigint,
  col231 varchar,
  col232 time,
  col233 bigint,
  col234 bigint,
  col235 time,
  col236 int,
  col237 time,
  col238 int,
  col239 bigint,
  col240 bigint,
  col241 int,
  col242 time,
  col243 int,
  col244 time,
  col245 bigint,
  col246 time,
  col247 varchar,
  col248 varchar,
  col249 int,
  col250 bigint,
  col251 varchar,
  col252 varchar,
  col253 bigint,
  col254 varchar,
  col255 varchar,
  col256 varchar,
  col257 bigint,
  col258 time,
  col259 time,
  col260 varchar,
  col261 int,
  col262 varchar,
  col263 int,
  col264 bigint,
  col265 varchar,
  col266 int,
  col267 varchar,
  col268 varchar,
  col269 time,
  col270 bigint,
  col271 bigint,
  col272 bigint,
  col273 varchar,
  col274 varchar,
  col275 time,
  col276 time,
  col277 int,
  col278 bigint,
  col279 int,
  col280 bigint,
  col281 int,
  col282 varchar,
  col283 varchar,
  col284 varchar,
  col285 time,
  col286 bigint,
  col287 bigint,
  col288 int,
  col289 varchar,
  col290 bigint,
  col291 varchar,
  col292 time,
  col293 varchar,
  col294 time,
  col295 time,
  col296 bigint,
  col297 int,
  col298 bigint,
  col299 int,
  col300 time,
  col301 time,
  col302 varchar,
  col303 int,
  col304 bigint,
  col305 bigint,
  col306 int,
  col307 bigint,
  col308 bigint,
  col309 bigint,
  col310 bigint,
  col311 varchar,
  col312 time,
  col313 bigint,
  col314 time,
  col315 int,
  col316 varchar,
  col317 bigint,
  col318 time,
  col319 int,
  col320 int,
  col321 bigint,
  col322 int,
  col323 time,
  col324 time,
  col325 int,
  col326 time,
  col327 bigint,
  col328 int,
  col329 bigint,
  col330 int,
  col331 int,
  col332 int,
  col333 varchar,
  col334 bigint,
  col335 time,
  col336 int,
  col337 bigint,
  col338 time,
  col339 bigint,
  col340 time,
  col341 bigint,
  col342 varchar,
  col343 bigint,
  col344 time,
  col345 bigint,
  col346 time,
  col347 bigint,
  col348 int,
  col349 varchar,
  col350 varchar,
  col351 int,
  col352 varchar,
  col353 bigint,
  col354 int,
  col355 varchar,
  col356 int,
  col357 int,
  col358 varchar,
  col359 varchar,
  col360 time,
  col361 bigint,
  col362 varchar,
  col363 bigint,
  col364 varchar,
  col365 time,
  col366 varchar,
  col367 varchar,
  col368 varchar,
  col369 varchar,
  col370 bigint,
  col371 bigint,
  col372 time,
  col373 time,
  col374 varchar,
  col375 bigint,
  col376 varchar,
  col377 int,
  col378 bigint,
  col379 varchar,
  col380 int,
  col381 int,
  col382 varchar,
  col383 varchar,
  col384 time,
  col385 time,
  col386 varchar,
  col387 varchar,
  col388 varchar,
  col389 bigint,
  col390 varchar,
  col391 int,
  col392 varchar,
  col393 bigint,
  col394 time,
  col395 time,
  col396 int,
  col397 bigint,
  col398 varchar,
  col399 time,
  col400 varchar,
  col401 varchar,
  col402 time,
  col403 bigint,
  col404 varchar,
  col405 time,
  col406 time,
  col407 varchar,
  col408 time,
  col409 time,
  col410 varchar,
  col411 time,
  col412 bigint,
  col413 varchar,
  col414 time,
  col415 bigint,
  col416 time,
  col417 varchar,
  col418 varchar,
  col419 int,
  col420 bigint,
  col421 bigint,
  col422 time,
  col423 varchar,
  col424 time,
  col425 int,
  col426 time,
  col427 time,
  col428 varchar,
  col429 bigint,
  col430 time,
  col431 varchar,
  col432 varchar,
  col433 int,
  col434 int,
  col435 varchar,
  col436 time,
  col437 time,
  col438 time,
  col439 int,
  col440 varchar,
  col441 int,
  col442 bigint,
  col443 int,
  col444 bigint,
  col445 bigint,
  col446 time,
  col447 varchar,
  col448 int,
  col449 time,
  col450 varchar,
  col451 int,
  col452 varchar,
  col453 int,
  col454 varchar,
  col455 varchar,
  col456 bigint,
  col457 time,
  col458 bigint,
  col459 int,
  col460 bigint,
  col461 int,
  col462 varchar,
  col463 time,
  col464 varchar,
  col465 int,
  col466 bigint,
  col467 varchar,
  col468 int,
  col469 bigint,
  col470 time,
  col471 int,
  col472 varchar,
  col473 bigint,
  col474 bigint,
  col475 bigint,
  col476 varchar,
  col477 time,
  col478 bigint,
  col479 time,
  col480 int,
  col481 int,
  col482 bigint,
  col483 int,
  col484 varchar,
  col485 int,
  col486 int,
  col487 bigint,
  col488 bigint,
  col489 varchar,
  col490 int,
  col491 int,
  col492 bigint,
  col493 varchar,
  col494 time,
  col495 int,
  col496 bigint,
  col497 varchar,
  col498 varchar,
  col499 varchar,
  col500 time,
  col501 int,
  col502 varchar,
  col503 int,
  col504 time,
  col505 bigint,
  col506 bigint,
  col507 int,
  col508 bigint,
  col509 bigint,
  col510 bigint,
  col511 time,
  col512 varchar,
  col513 time,
  col514 int,
  col515 time,
  col516 time,
  col517 bigint,
  col518 int,
  col519 time,
  col520 varchar,
  col521 int,
  col522 int,
  col523 int,
  col524 bigint,
  col525 time,
  col526 time,
  col527 varchar,
  col528 time,
  col529 time,
  col530 varchar,
  col531 int,
  col532 bigint,
  col533 bigint,
  col534 int,
  col535 bigint,
  col536 varchar,
  col537 int,
  col538 time,
  col539 varchar,
  col540 bigint,
  col541 time,
  col542 bigint,
  col543 int,
  col544 time,
  col545 int,
  col546 bigint,
  col547 bigint,
  col548 int,
  col549 int,
  col550 time,
  col551 int,
  col552 time,
  col553 bigint,
  col554 int,
  col555 time,
  col556 bigint,
  col557 time,
  col558 bigint,
  col559 time,
  col560 varchar,
  col561 bigint,
  col562 int,
  col563 int,
  col564 bigint,
  col565 time,
  col566 bigint,
  col567 int,
  col568 bigint,
  col569 bigint,
  col570 int,
  col571 int,
  col572 bigint,
  col573 time,
  col574 varchar,
  col575 int,
  col576 int,
  col577 time,
  col578 time,
  col579 time,
  col580 varchar,
  col581 bigint,
  col582 varchar,
  col583 time,
  col584 varchar,
  col585 time,
  col586 bigint,
  col587 int,
  col588 time,
  col589 int,
  col590 bigint,
  col591 time,
  col592 varchar,
  col593 time,
  col594 bigint,
  col595 time,
  col596 time,
  col597 varchar,
  col598 time,
  col599 bigint,
  col600 int,
  col601 bigint,
  col602 int,
  col603 bigint,
  col604 int,
  col605 varchar,
  col606 varchar,
  col607 int,
  col608 bigint,
  col609 bigint,
  col610 time,
  col611 bigint,
  col612 time,
  col613 time,
  col614 int,
  col615 varchar,
  col616 bigint,
  col617 time,
  col618 time,
  col619 time,
  col620 time,
  col621 varchar,
  col622 bigint,
  col623 bigint,
  col624 varchar,
  col625 int,
  col626 varchar,
  col627 varchar,
  col628 time,
  col629 time,
  col630 bigint,
  col631 bigint,
  col632 int,
  col633 int,
  col634 varchar,
  col635 int,
  col636 bigint,
  col637 bigint,
  col638 int,
  col639 time,
  col640 time,
  col641 bigint,
  col642 varchar,
  col643 int,
  col644 time,
  col645 varchar,
  col646 time,
  col647 int,
  col648 int,
  col649 varchar,
  col650 time,
  col651 bigint,
  col652 bigint,
  col653 int,
  col654 time,
  col655 int,
  col656 int,
  col657 int,
  col658 bigint,
  col659 bigint,
  col660 time,
  col661 bigint,
  col662 int,
  col663 bigint,
  col664 bigint,
  col665 varchar,
  col666 varchar,
  col667 varchar,
  col668 time,
  col669 time,
  col670 varchar,
  col671 bigint,
  col672 int,
  col673 int,
  col674 bigint,
  col675 bigint,
  col676 bigint,
  col677 int,
  col678 varchar,
  col679 varchar,
  col680 varchar,
  col681 bigint,
  col682 varchar,
  col683 bigint,
  col684 int,
  col685 time,
  col686 int,
  col687 time,
  col688 varchar,
  col689 time,
  col690 varchar,
  col691 varchar,
  col692 varchar,
  col693 bigint,
  col694 varchar,
  col695 varchar,
  col696 time,
  col697 time,
  col698 bigint,
  col699 varchar,
  col700 bigint,
  col701 int,
  col702 int,
  col703 time,
  col704 bigint,
  col705 time,
  col706 bigint,
  col707 int,
  col708 bigint,
  col709 int,
  col710 varchar,
  col711 time,
  col712 varchar,
  col713 bigint,
  col714 int,
  col715 time,
  col716 bigint,
  col717 time,
  col718 bigint,
  col719 varchar,
  col720 bigint,
  col721 time,
  col722 bigint,
  col723 int,
  col724 varchar,
  col725 time,
  col726 time,
  col727 int,
  col728 bigint,
  col729 int,
  col730 int,
  col731 time,
  col732 int,
  col733 int,
  col734 bigint,
  col735 varchar,
  col736 varchar,
  col737 varchar,
  col738 time,
  col739 bigint,
  col740 varchar,
  col741 int,
  col742 int,
  col743 bigint,
  col744 time,
  col745 bigint,
  col746 bigint,
  col747 time,
  col748 time,
  col749 time,
  col750 varchar,
  col751 int,
  col752 time,
  col753 int,
  col754 time,
  col755 int,
  col756 int,
  col757 bigint,
  col758 int,
  col759 time,
  col760 time,
  col761 time,
  col762 int,
  col763 bigint,
  col764 int,
  col765 bigint,
  col766 time,
  col767 int,
  col768 time,
  col769 time,
  col770 int,
  col771 varchar,
  col772 int,
  col773 bigint,
  col774 varchar,
  col775 time,
  col776 time,
  col777 bigint,
  col778 varchar,
  col779 int,
  col780 int,
  col781 int,
  col782 bigint,
  col783 int,
  col784 time,
  col785 time,
  col786 varchar,
  col787 int,
  col788 time,
  col789 int,
  col790 varchar,
  col791 varchar,
  col792 time,
  col793 bigint,
  col794 int,
  col795 int,
  col796 varchar,
  col797 time,
  col798 time,
  col799 bigint,
  col800 time,
  col801 time,
  col802 bigint,
  col803 time,
  col804 bigint,
  col805 bigint,
  col806 varchar,
  col807 time,
  col808 int,
  col809 int,
  col810 bigint,
  col811 varchar,
  col812 int,
  col813 time,
  col814 time,
  col815 int,
  col816 time,
  col817 varchar,
  col818 int,
  col819 int,
  col820 int,
  col821 int,
  col822 varchar,
  col823 int,
  col824 bigint,
  col825 int,
  col826 int,
  col827 bigint,
  col828 bigint,
  col829 varchar,
  col830 int,
  col831 varchar,
  col832 int,
  col833 varchar,
  col834 bigint,
  col835 bigint,
  col836 time,
  col837 time,
  col838 varchar,
  col839 int,
  col840 varchar,
  col841 int,
  col842 bigint,
  col843 time,
  col844 varchar,
  col845 varchar,
  col846 int,
  col847 int,
  col848 varchar,
  col849 time,
  col850 int,
  col851 int,
  col852 time,
  col853 time,
  col854 bigint,
  col855 time,
  col856 time,
  col857 time,
  col858 time,
  col859 varchar,
  col860 time,
  col861 time,
  col862 int,
  col863 int,
  col864 varchar,
  col865 bigint,
  col866 bigint,
  col867 time,
  col868 time,
  col869 varchar,
  col870 time,
  col871 time,
  col872 bigint,
  col873 time,
  col874 bigint,
  col875 bigint,
  col876 varchar,
  col877 bigint,
  col878 varchar,
  col879 time,
  col880 varchar,
  col881 bigint,
  col882 int,
  col883 varchar,
  col884 time,
  col885 time,
  col886 time,
  col887 varchar,
  col888 time,
  col889 time,
  col890 varchar,
  col891 varchar,
  col892 varchar,
  col893 time,
  col894 bigint,
  col895 varchar,
  col896 int,
  col897 bigint,
  col898 time,
  col899 time,
  col900 time,
  col901 varchar,
  col902 varchar,
  col903 int,
  col904 varchar,
  col905 time,
  col906 bigint,
  col907 time,
  col908 varchar,
  col909 time,
  col910 bigint,
  col911 varchar,
  col912 time,
  col913 int,
  col914 bigint,
  col915 varchar,
  col916 varchar,
  col917 bigint,
  col918 varchar,
  col919 time,
  col920 int,
  col921 bigint,
  col922 time,
  col923 bigint,
  col924 time,
  col925 varchar,
  col926 varchar,
  col927 varchar,
  col928 varchar,
  col929 bigint,
  col930 varchar,
  col931 int,
  col932 bigint,
  col933 int,
  col934 bigint,
  col935 bigint,
  col936 int,
  col937 bigint,
  col938 varchar,
  col939 time,
  col940 int,
  col941 time,
  col942 int,
  col943 varchar,
  col944 bigint,
  col945 time,
  col946 bigint,
  col947 varchar,
  col948 time,
  col949 time,
  col950 time,
  col951 int,
  col952 varchar,
  col953 bigint,
  col954 time,
  col955 varchar,
  col956 int,
  col957 bigint,
  col958 bigint,
  col959 bigint,
  col960 bigint,
  col961 int,
  col962 time,
  col963 varchar,
  col964 bigint,
  col965 varchar,
  col966 bigint,
  col967 time,
  col968 varchar,
  col969 time,
  col970 time,
  col971 time,
  col972 int,
  col973 int,
  col974 bigint,
  col975 bigint,
  col976 bigint,
  col977 time,
  col978 bigint,
  col979 varchar,
  col980 varchar,
  col981 bigint,
  col982 int,
  col983 bigint,
  col984 time,
  col985 bigint,
  col986 int,
  col987 bigint,
  col988 int,
  col989 bigint,
  col990 bigint,
  col991 time,
  col992 bigint,
  col993 bigint,
  col994 bigint,
  col995 int,
  col996 int,
  col997 int,
  col998 int,
  col999 varchar,
  col1000 time,
  col1001 bigint,
  col1002 bigint,
  col1003 bigint,
  col1004 time,
  col1005 varchar,
  col1006 varchar,
  col1007 varchar,
  col1008 int,
  col1009 bigint,
  col1010 bigint,
  col1011 time,
  col1012 bigint,
  col1013 time,
  col1014 int,
  col1015 varchar,
  col1016 time,
  col1017 time,
  col1018 int,
  col1019 varchar,
  col1020 varchar,
  col1021 int,
  col1022 bigint,
  col1023 time,
  col1024 bigint);

SELECT COUNT(1) FROM information_schema.columns WHERE table_name='wide' AND column_name='col1024' AND data_type='BIGINT';

SELECT COUNT(1) FROM information_schema.columns WHERE table_name='wide' OR table_name='vwide';

CALL range(10);

SELECT * FROM range(10, 0, -1) ORDER BY 1 ASC;

SELECT * FROM generate_series(5, 1, -1) LIMIT 4;

SELECT * FROM range(0, 10, -1);

SELECT * FROM range(10);

SELECT EXISTS(SELECT * FROM range(10));

SELECT * FROM range(10) t1(j) WHERE j=3;

select * from generate_series(2305843009213693951, -2305843009213693951, -2305843009213693951);

select * from generate_series(0, 9223372036854775807, 9223372036854775807);

select * from generate_series(-9223372036854775808, 9223372036854775807, 9223372036854775807);

select * from generate_series(0, -9223372036854775808, -9223372036854775808);

SELECT * FROM repeat(0, 3);

SELECT * FROM repeat('hello', 2);

SELECT * FROM repeat(blob '\x00\x00hello', 2);

SELECT * FROM repeat(DATE '1992-01-01', 2);

SELECT * FROM repeat_row(0, num_rows=3);

SELECT * FROM repeat_row('hello', num_rows=2);

SELECT * FROM repeat_row(1, num_rows=10000);

SELECT * FROM pragma_table_info('integers');

CREATE TABLE join_table(name VARCHAR, value INTEGER);

SELECT a.name, cid, value FROM pragma_table_info('integers') AS a INNER JOIN join_table ON a.name=join_table.name ORDER BY a.name;

SELECT count(*) FROM glob(no_such_file.csv);

SET table_function_identifier_conversion='ENABLE_IMPLICIT_STRING';

RESET table_function_identifier_conversion;
