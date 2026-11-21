COPY (SELECT 42) TO '/dev/null' (FORMAT CSV);

SET GLOBAL debug_fs_delay_mean_ms=1.0;

SET async_threads=0;

SET warnings_as_errors = true;

SELECT count(*) FROM glob('no_such_file.csv');

INSERT INTO copy_cte_source VALUES (1, 'one'), (2, 'two'), (3, 'three');

TRUNCATE t;

SELECT sum(i) FROM ca.t;

SELECT Delimiter, Quote, Escape FROM sniff_csv('data/19578.csv');

select count(file) from glob('./data/csv/afl/20250226_csv_fuzz_error/*');

PRAGMA verify_parallelism;

SELECT * FROM cranlogs LIMIT 5;

CREATE TABLE ncvoters2 AS SELECT * FROM ncvoters LIMIT 0;

SELECT COUNT(*) FROM movie_info;

SELECT l_partkey, l_comment FROM lineitem WHERE l_orderkey=1 ORDER BY l_linenumber;

SELECT year, uniquecarrier, origin, origincityname, div5longestgtime FROM ontime;

SELECT * FROM web_page ORDER BY column00 LIMIT 3;

SELECT a, b FROM test;

SELECT a, b, a_1 FROM test ORDER BY a;

SELECT a, a_8, a_9, column12 FROM test;

SELECT column0, column1 FROM test ORDER BY column0;

INSERT INTO my_varchars VALUES ('Hello', 'Beautiful', 'World');

SELECT _select, _insert, _join FROM test ORDER BY _select;

SELECT typeof(TestInteger), typeof(TestDouble), typeof(TestDate), typeof(TestText) FROM test LIMIT 1;

CREATE OR REPLACE TABLE timings(tool string, sf float, day string, batch_type string, q string, parameters string, time float);

SELECT typeof(linenr), typeof(mixed_string), typeof(mixed_double) FROM test LIMIT 1;

SELECT typeof(a), typeof(b), typeof(t), typeof(d), typeof(ts) FROM test LIMIT 1;

SELECT typeof(i), typeof(b) FROM test LIMIT 1;

SELECT * FROM integers_copied LIMIT 3 OFFSET 500000;

SELECT rsID, chr, pos, refb, altb FROM t1;

SELECT max(bytes) <= 262144
FROM duckdb_logs_parsed('FileSystem')
WHERE path LIKE '%read_size.csv.gz' AND op = 'READ';

CREATE TABLE tbl(i INTEGER);

SET preserve_insertion_order=false;

SELECT commas, periods FROM decimal_separators2;

SELECT typeof(commas), typeof(periods) FROM decimal_separators4 limit 1;

INSERT INTO ubn1 VALUES (1), (2), (9223372036854775807);

DROP TABLE reject_errors;

SET enable_external_access=false;

SELECT * FROM '~/integers.csv';

SELECT COUNT(*) FROM '~/homedir_integers*.csv';

FROM data;

SELECT i, j, k FROM v1 ORDER BY i NULLS LAST;

CREATE TABLE integers(i INTEGER);

CREATE TABLE s1.tbl AS SELECT * FROM range(10) t(i);

CREATE TABLE customer(c_customer_sk INTEGER, c_customer_id VARCHAR, c_current_cdemo_sk INTEGER, c_current_hdemo_sk INTEGER, c_current_addr_sk INTEGER, c_first_shipto_date_sk INTEGER, c_first_sales_date_sk INTEGER, c_salutation VARCHAR, c_first_name VARCHAR, c_last_name VARCHAR, c_preferred_cust_flag VARCHAR, c_birth_day INTEGER, c_birth_month INTEGER, c_birth_year INTEGER, c_birth_country VARCHAR, c_login VARCHAR, c_email_address VARCHAR, c_last_review_date_sk INTEGER);

CREATE TABLE dates(d DATE);

SELECT COUNT(*) FROM glob('*/*.csv');

SELECT CODGEO FROM leading_zeros LIMIT 1;

select '09001'::int;

DELETE FROM abac_tbl;

CREATE TABLE test (a VARCHAR, b INTEGER, c INTEGER);

INSERT INTO test VALUES (1, 'hello'), (2, 'world '), (3, ' xx');

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

SELECT min (i + i) FROM integers;

SELECT a FROM exprtest WHERE a BETWEEN 43 AND 44;

SELECT count(*) FROM (
    (FROM explicit_quote EXCEPT ALL FROM automatic_quote)
    UNION ALL
    (FROM automatic_quote EXCEPT ALL FROM explicit_quote)
);

SELECT count(*) FROM reject_errors;

SELECT * FROM read_csv(getvariable('csv_files')) ORDER BY 1;

SELECT count(*) FROM read_single_csv_file('data/csv/tpcds_14.csv', skip=2);

SELECT count(*) FROM read_csv('data/csv/glob/a1/*.csv');

SELECT d, column0, i FROM read_csv('data/csv/glob/*/*.csv', union_by_name=true) ORDER BY ALL LIMIT 3;

SELECT count(*) FROM read_csv('data/csv/error/mismatch/small1.csv', store_rejects=true);

SELECT count(*), sum(i_brand_id) FROM copy_target;

CREATE TABLE copy_rt(id BIGINT, s VARCHAR);

SELECT * EXCLUDE (scan_id) FROM reject_errors order by all;

SELECT csv_line FROM baz;

DELETE FROM reject_scans;

SELECT line, column_idx, error_type FROM reject_errors ORDER BY ALL;

SELECT * EXCLUDE (scan_id, file_id) FROM reject_errors ORDER BY ALL;

SELECT * EXCLUDE (scan_id) FROM reject_scans order by all;

SELECT * EXCLUDE (scan_id) FROM rejects_errors_3 order by all;

SElECT * EXCLUDE (scan_id) FROM reject_errors ORDER BY byte_position;

CREATE TABLE t1 AS select '2024/12/12' as a, '01:02:03' as b, '2020/01/01 01:02:03' as c from range(0,10000);

DROP TABLE date_tests;

SELECT COUNT(*) FROM concat;

SELECT b FROM blobs;

SELECT line, line_byte_position, byte_position, column_idx, error_type, replace(replace(csv_line, chr(10), '<LF>'), chr(13), '<CR>') FROM rej_file_pipe2 ORDER BY ALL;

SELECT line, line_byte_position, byte_position, column_idx, error_type, replace(replace(csv_line, chr(10), '<LF>'), chr(13), '<CR>') FROM rej_file_4 ORDER BY ALL;

SELECT line, column_idx, error_type FROM rej_cr_count ORDER BY ALL;

SELECT line, column_idx, error_type, replace(csv_line, chr(10), '<LF>') FROM rej_a ORDER BY ALL;

SELECT line, line_byte_position, byte_position, column_idx, error_type, replace(csv_line, chr(10), '<LF>') FROM rej_chunk ORDER BY ALL;

SELECT b FROM read_csv('data/csv/block_scan_invalid_utf8.csv', delim=',', quote='"', escape='"', header=false, new_line='\n', auto_detect=false, columns={'a':'INTEGER','b':'VARCHAR','c':'VARCHAR'}, ignore_errors=true) ORDER BY ALL;

SELECT line, column_idx, error_type, replace(csv_line, chr(10), '<LF>') FROM reject_errors ORDER BY ALL;

SELECT count(*) FROM read_csv('data/csv/block_scan_invalid_utf8.csv', ignore_errors=true);

SELECT a, length(b) FROM r_escaped ORDER BY ALL;

SELECT line, column_idx, error_type FROM rej_pipe2_ad ORDER BY ALL;

SELECT line, column_idx, error_type FROM rej_cr_star ORDER BY ALL;

SELECT line, column_idx, error_type FROM rej_crlf_comment_b ORDER BY ALL;

SELECT line, column_idx, error_type FROM rej_comment_ad ORDER BY ALL;

SELECT COUNT(a), SUM(a) FROM test;

CREATE TABLE test_too_few_rows (a INTEGER, b INTEGER, c VARCHAR, d INTEGER);

SELECT * FROM test4 ORDER BY 1 LIMIT 3;

CREATE TABLE test (a INTEGER, b VARCHAR DEFAULT('hello'), c INTEGER DEFAULT(3+4));

SELECT COUNT(*) FROM (FROM lineitem EXCEPT FROM lineitem_rt);

SELECT * FROM test_null_option ORDER BY 1 LIMIT 3;

CREATE TABLE venue_2 (
    venueid          SMALLINT        NOT NULL /*PRIMARY KEY*/
    , venuename      VARCHAR (100)
    , venuecity      VARCHAR (30)
    , venuestate     CHAR (2)
    , venueseats     VARCHAR
);

SELECT * FROM read_csv('data/csv/extra_value_null_prefix.csv', columns={'a':'INT','b':'INT'}, strict_mode=true, nullstr='x', header=false, auto_detect=false, delim=',');

SET TimeZone='UTC';

SET TimeZone = 'America/Los_Angeles';

SELECT * FROM dates ORDER BY d;

SELECT * FROM timestamps;

CREATE TABLE no_quote(a VARCHAR, b VARCHAR);

SELECT * FROM long_escaped_value;

insert into integers values (42);

create table tbl(a VARCHAR NOT NULL);

insert into tbl_2 values ('','','','');

SELECT * FROM test2;

insert into t2 select NULL as b,NULL as a from range(30000);

SELECT * FROM greek_utf8;

SELECT * FROM integers AS too_many_columns;

select count(*) from integers;

INSERT INTO trigger_loop VALUES ('"');

select * from users;

CREATE TABLE proj (
        name VARCHAR(10) NOT NULL,
        id INTEGER NOT NULL,  /*primary key*/
);

insert into ppl values ('alice'), ('bob'), ('pedro');

select * from users_age;

DELETE FROM lineitem;

CREATE TABLE test (a INTEGER, b VARCHAR, c INTEGER);

SELECT * FROM ncvoters;

SELECT COUNT(*) FROM nfcstrings;

drop table if exists reject_errors;

select b,d from np;

select * from v limit 10;

select count(*) from v where d is null;

CREATE TABLE T as select '1, "Oogie Boogie"' from range (100000);

CREATE TABLE test (a VARCHAR, b INTEGER);

SELECT * FROM people;

CREATE TABLE T (name varchar, money double, city varchar);

SELECT * FROM web_page ORDER BY wp_web_page_sk LIMIT 3;

CREATE TABLE tbl(id int, ts timestamp);

SELECT * FROM tbl_tz;

INSERT INTO special_char VALUES
    (0, E'\\'), (1, E'\t'), (2, E'\n'),
    (3, E'a\\a'), (4, E'b\tb'), (5, E'c\nc'),
    (6, E'\\d'), (7, E'\te'), (8, E'\nf'),
    (9, E'g\\'), (10, E'h\t'), (11, E'i\n'),
    (12, E'\\j'), (13, E'\tk'), (14, E'\nl'),
    (15, E'\\\\'), (16, E'\t\t'), (17, E'\n\n'),
    (18, E'\\\t\n');

CREATE TABLE human_eval_tsv(task_id TEXT, prompt TEXT, entry_point TEXT, canonical_solution TEXT, test TEXT);

INSERT INTO human_eval_tsv
SELECT replace(COLUMNS(*), E'\r\n', E'\n')
FROM read_csv('data/csv/unquoted_escape/human_eval.tsv', quote = '', escape = '\', sep = '\t', header = false, strict_mode = false);

CREATE TABLE test_zst(a INTEGER, b INTEGER, c INTEGER, d VARCHAR, e VARCHAR);

CREATE OR REPLACE TABLE unencrypted.tbl AS SELECT * FROM range(10) t(i);

DETACH unencrypted;

DETACH encrypted_v2;

COPY FROM DATABASE encrypted_v2 TO unencrypted_v_1_2_0;

SELECT SUM(i) FROM unencrypted_v_1_2_0.tbl;

SET force_mbedtls_unsafe = 'false';

SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name='encrypted_v1';

COPY FROM DATABASE unencrypted to encrypted_v1;

DETACH encrypted_v1;

CREATE TABLE src AS SELECT (i * 7919) % 300007 AS k, i AS id FROM range(300000) t(i);

CREATE TABLE bigdata AS SELECT i AS col_a, i AS col_b FROM range(0,10_000) tbl(i);

CREATE TABLE t AS SELECT 1 AS a;

CREATE TABLE test5 as SELECT i as a, (i*5) as b, power(i,5) as c from range(0,10) tbl(i);

SELECT * FROM attached_parquet;

CREATE MACRO bloom_reads(f, col) AS TABLE
	SELECT count(*) AS reads, coalesce(sum(bytes), 0) AS bytes
	FROM duckdb_logs_parsed('FileSystem'), bloom_span(f, col)
	WHERE op = 'READ' AND parse_filename(path) = parse_filename(f) AND pos >= span_begin AND pos + bytes <= span_end;

CALL truncate_duckdb_logs();

CREATE MACRO survivor_span(f) AS TABLE
	SELECT min(bloom_filter_offset) AS span_begin, max(bloom_filter_offset + bloom_filter_length) AS span_end
	FROM parquet_metadata(f)
	WHERE path_in_schema = 'h' AND row_group_id BETWEEN 3 AND 16;

CREATE TABLE wrapped AS SELECT ((i // 2 + 20000) % 30000)::INTEGER AS n FROM range(122880) t(i);

CREATE TABLE options_test(k VARCHAR);

SELECT bloom_filter_excludes FROM parquet_bloom_probe('data/parquet-testing/interval_bloom_saturated_main.parquet', 'iv', to_months(2147483646) + to_days(2147483647) + INTERVAL '744 hours');

SELECT reads > 0 FROM bloom_reads();

SELECT count(*), count(dec_7_3_bss), count(dec_19_4_bss), count(dec_38_10_bss), count(fixed_16_bss),
       count(fixed_20_bss), count(float16_bss)
FROM bss;

SELECT count(*) = (SELECT count(*) FROM bss WHERE fixed_16_plain < '\x80'::BLOB)
FROM bss WHERE fixed_16_bss < '\x80'::BLOB;

PRAGMA disable_optimizer;

PRAGMA add_parquet_key('arrow_key', '0123456789012345');

CREATE TABLE raw_data (
  ts TIMESTAMP_S NOT NULL,
  hits INTEGER NOT NULL
);

CREATE TABLE integers AS SELECT * FROM range(6) tbl(i);

SELECT typeof(ts), ts::VARCHAR
FROM int96_copy_ns
ORDER BY ts;

PRAGMA add_parquet_key('key256', '01234567891123450123456789112345');

SELECT count(*) FROM 'test/sql/copy/parquet/issue_27456_constant_stats.parquet' WHERE NOT (c IS NOT NULL);

PRAGMA tpch(1);

SELECT unnest(parquet_schema, recursive:=True) FROM parquet_full_metadata('data/parquet-testing/lineitem-top10000.gzip.parquet');

SELECT * FROM parquet_full_metadata('data/parquet-testing/decimal/int64_decimal.parquet');

SELECT column_id, name FROM (SELECT unnest(parquet_schema, recursive:=True) FROM parquet_full_metadata('data/parquet-testing/lineitem-top10000.gzip.parquet')) ORDER BY column_id;

SELECT info['source'] FROM duckdb_logs_parsed('AdaptiveFilter')
WHERE event = 'INIT' AND file_path LIKE '%af_cross_2.parquet' ORDER BY timestamp LIMIT 1;

SELECT count(*) FROM duckdb_logs_parsed('AdaptiveFilter');

SELECT info['source'] FROM duckdb_logs_parsed('AdaptiveFilter')
WHERE event = 'INIT' AND file_path LIKE '%ord_cab.parquet' ORDER BY timestamp LIMIT 1;

SELECT f, i
FROM integer_file_first
WHERE i='042';

SELECT f, i
FROM integer_file_first
WHERE i IS NULL;

SELECT struct_val.f, struct_val.i
FROM integer_file_first
WHERE struct_val.i='042'::INTEGER;

SELECT struct_val.f, struct_val.i
FROM integer_file_first
WHERE struct_val.i IS NULL;

CREATE MACRO bytes_read(f) AS (SELECT coalesce(sum(bytes), 0) FROM duckdb_logs_parsed('FileSystem') WHERE op = 'READ' AND parse_filename(path) = f);

SET parquet_use_page_index = false;

CREATE TABLE promo_lookups AS SELECT bytes_read('page_index_cache_promo.parquet') AS bytes, cached_bytes('page_index_cache_promo.parquet') AS cached;

SELECT bytes_read('page_index_cache_budget.parquet');

CREATE MACRO index_bytes_read(f) AS (
	SELECT coalesce(sum(bytes), 0)
	FROM duckdb_logs_parsed('FileSystem'), index_span(f)
	WHERE op = 'READ' AND parse_filename(path) = parse_filename(f) AND pos >= span_begin AND pos + bytes <= span_end);

CREATE TABLE with_index AS SELECT bytes_read() AS bytes, largest_read() AS largest;

SELECT bytes_read() < 1500000;

CALL enable_logging('ParquetPrefetch');

CALL enable_logging('PhysicalOperator');

SELECT sum(info['rows_skipped']::BIGINT) = 100000 - (SELECT count(*) FROM data WHERE id // 512 <= 39 AND (id // 512) % 2 = 1)
FROM duckdb_logs_parsed('PhysicalOperator') WHERE class = 'ParquetReader' AND event = 'SkipPages';

CREATE TABLE typed AS
	SELECT range AS id, range % 1000 >= 500 AS b, DATE '2024-01-01' + INTERVAL (range // 100) DAY AS dt,
	       TIMESTAMP '2024-01-01 00:00:00' + INTERVAL (range) SECOND AS ts, (range::DECIMAL(12,2) / 8) AS dec,
	       ('00000000-0000-0000-0000-' || lpad(hex(range), 12, '0'))::UUID AS u
	FROM range(100000);

CREATE MACRO actual_page_index(file) AS TABLE
	SELECT row_group_id, column_id, path_in_schema, page_id, page_offset, compressed_page_size, first_row_index, num_rows,
	       null_page, min_value, max_value, null_count, boundary_order
	FROM parquet_page_index('data/parquet-testing/page_index/' || file || '.parquet');

SELECT count(*), sum(n) FROM 'data/parquet-testing/page_index/spark_sorted.parquet' WHERE n BETWEEN 1000 AND 1999;

SELECT count(*), min(id), max(id) FROM 'data/parquet-testing/page_index/spark_sorted.parquet' WHERE ts BETWEEN TIMESTAMP '2024-01-01 00:10:00' AND TIMESTAMP '2024-01-01 00:10:09';

SELECT arr, st FROM 'data/parquet-testing/page_index/spark_sorted.parquet' WHERE id = 2500;

SELECT count(*) = (SELECT count(*) FROM ref WHERE f BETWEEN 100.5 AND 200.25) FROM 'data/parquet-testing/page_index/arrow_row_groups_v2.parquet' WHERE f BETWEEN 100.5 AND 200.25;

SELECT count(*) FROM (
	(SELECT * FROM 'data/parquet-testing/page_index/arrow_row_groups_v2.parquet' WHERE n IS NULL EXCEPT ALL SELECT * FROM ref WHERE n IS NULL)
	UNION ALL
	(SELECT * FROM ref WHERE n IS NULL EXCEPT ALL SELECT * FROM 'data/parquet-testing/page_index/arrow_row_groups_v2.parquet' WHERE n IS NULL)
);

SELECT count(*), sum(v) = (SELECT sum(r % 7) FROM range(600, 701) t(r)) FROM 'data/parquet-testing/page_index/corrupt_base.parquet' WHERE id BETWEEN 600 AND 700;

SELECT count(*) FROM 'data/parquet-testing/page_index/corrupt_non_monotonic.parquet' WHERE id > 2900;

SELECT min(ts), max(ts), count(*) FROM 'data/parquet-testing/page_index/corrupt_offset_index_other_column.parquet' WHERE id > 2900;

SELECT column_id, page_id, page_offset FROM parquet_page_index('data/parquet-testing/page_index/corrupt_offset_index_other_column.parquet') WHERE page_id <= 1 ORDER BY column_id, page_id;

SELECT min(ts), max(ts), count(*) FROM 'data/parquet-testing/page_index/corrupt_offset_index_swapped.parquet' WHERE id BETWEEN 1000 AND 1100;

create table some_bools (val boolean);

CREATE VIEW v1 AS
SELECT map([2], [{'key1': map([3,4],[1,2]), 'key2':2}]) AS x;

CREATE VIEW v3 AS
SELECT {'key': [2], 'val': [{'key1': {'key': [3,4], 'val': [1,2]}, 'key2':2}]} AS x;

CREATE TABLE lists as SELECT i as id, [i] as list from range(0,10000) tbl(i);

INSERT INTO table1 VALUES ('Test value 2!');

SET binary_as_string=true;

CREATE MACRO column_stats_schema() AS MAP {'id': {name: 'id', type: 'BIGINT', default_value: NULL::VARCHAR},
    'nation': {name: 'nation', type: 'INTEGER', default_value: NULL::VARCHAR},
    'half': {name: 'half', type: 'BIGINT', default_value: NULL::VARCHAR}};

CREATE TYPE mood AS ENUM();

PRAGMA add_parquet_key('key192', '012345678911234501234567');

SELECT COUNT(*) FROM parq
WHERE least(str, 'thisisalongstring50') = str;

CREATE TABLE expr_prune_prefix_corner AS
	SELECT range::INTEGER AS x,
		CASE
			WHEN range < 2048 THEN NULL
			WHEN range < 4096 THEN 'a' || lpad((range - 2048)::VARCHAR, 4, '0')
			WHEN range < 6144 THEN 'b' || lpad((range - 4096)::VARCHAR, 4, '0')
			ELSE 'c' || lpad((range - 6144)::VARCHAR, 4, '0')
		END AS s,
		CASE WHEN range % 2 = 0 THEN 'a' ELSE 'b' END AS p
	FROM range(8192);

CREATE TABLE test AS SELECT 1 as id, 'test' as filename;

SELECT ORGUNITID FROM tbl LIMIT 10;

SELECT c FROM f;

SELECT COUNT(*) FROM f WHERE c <> 0.1;

SELECT COUNT(*) FROM f7 WHERE c >= 0.7;

EXPLAIN select count(*) from parquet_scan(['t1.parquet', 't2.parquet']);

create table test as select i%5 as a, i%2 as b from range(0,10) tbl(i);

CREATE TABLE test_hive_default_collision AS
SELECT *
FROM (VALUES ('__HIVE_DEFAULT_PARTITION__', 1), (NULL, 2), ('ok', 3)) v(p, id);

CREATE OR REPLACE TABLE iv_a AS
SELECT CASE WHEN i % 2 = 0 THEN INTERVAL '1 month 2 days' ELSE INTERVAL '32 days' END AS iv
FROM range(2000) t(i);

SELECT * FROM test ORDER BY j DESC LIMIT 2;

explain SELECT j FROM test WHERE j > 3 ORDER BY i LIMIT 2;

SELECT * FROM (SELECT 100 + i i, 1000 + j j, 10000 + k k, 100000 + l l FROM (SELECT -i i, -j j, -k k, -l l FROM test)) ORDER BY j DESC LIMIT 2;

explain SELECT * FROM test USING SAMPLE 10%;

SELECT j, k, l, i FROM test WHERE i > 5 ORDER BY j DESC LIMIT 2;

EXECUTE s;

CREATE VIEW nan_values AS FROM (VALUES (1, 1.0::DOUBLE), (2, 'nan'::DOUBLE), (3, 2.0::DOUBLE)) v(k, d);

FROM nan_forms('nan_last');

SET parquet_can_have_nan = true;

SELECT stats(d), stats(f) FROM nan_first_explicit_false LIMIT 1;

SET GLOBAL parquet_can_have_nan = true;

SELECT count(*)
FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%cost_model_gap.parquet' AND (accepted_column_gap < 4096 OR accepted_column_gap > 33554432);

SET enable_external_file_cache=false;

SELECT count(DISTINCT accepted_column_gap) > 1
FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%train-services%';

SELECT count(*) = count(DISTINCT (pos, bytes))
FROM duckdb_logs_parsed('FileSystem')
WHERE path LIKE '%prefetch_footer_once.parquet' AND op = 'READ';

SET enable_profiling='json';

SELECT row_group_id, fully_filtered, strategy, prefetch_groups
FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%rgo_proj_gap.parquet'
ORDER BY row_group_id;

SELECT row_group_id, fully_filtered, strategy, prefetch_groups
FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%rgo3.parquet'
ORDER BY row_group_id;

SELECT row_group_id, fully_filtered, strategy
FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%force.parquet'
ORDER BY row_group_id;

SET debug_verify_aggregate_state_export = getvariable('metadata_saved_state_export');

CREATE TABLE bare_option(i INTEGER);

SET max_execution_time=10000;

SELECT id FROM default_only_struct WHERE s.n.y = 5 ORDER BY id;

SET disabled_optimizers = 'unused_columns';

CREATE MACRO file_schema() AS MAP {
    'i': {'name': 'i', 'type': 'BIGINT', 'default_value': NULL},
    'b': {'name': 'b', 'type': 'VARCHAR', 'default_value': NULL}};

CREATE TABLE test_nullable AS SELECT
    {'a': NULL, 'b': 2} as partial_null,
    NULL::STRUCT(x INT, y INT) as full_null;

SELECT a FROM variant_default WHERE v.outer.answer::INTEGER = 9;

SELECT id, s.a, s.a.b FROM mapped ORDER BY id;

SELECT id FROM mapped WHERE id = 2 OR s.a.b::VARCHAR = '7' ORDER BY id;

SELECT id FROM mapped WHERE s.n::VARCHAR = '{''b'': 20, ''a'': 10}';

SELECT count(*) FROM mapped WHERE s.empty.k::VARCHAR IS NULL;

SELECT id, s.n.a::INTEGER FROM as_variant ORDER BY id;

SELECT id FROM from_text WHERE s.n.a = 42;

CREATE OR REPLACE TABLE ubn1(a BIGINT);

SET enable_profiling = 'json';

SET disabled_optimizers = '';

CREATE TABLE test AS SELECT
	'test' AS user,
	'2025' AS year;

CALL enable_logging('ReadAheadBudget');

SET read_ahead_depth=4;

SET read_ahead_depth=1099511627776;

SET read_ahead_depth=64;

CREATE TABLE recheck_values AS
SELECT i AS id,
       CASE WHEN i BETWEEN 8192 AND 10239 THEN NULL ELSE i // 4096 END AS k,
       CASE WHEN i >= 22528 THEN 'nan'::DOUBLE ELSE k::DOUBLE END AS f,
       lpad(k::VARCHAR, 4, '0') || 'é' AS s,
       TIMESTAMP '2020-01-01' + k * INTERVAL '1 day' AS ts,
       repeat('payload-' || i::VARCHAR, 32) AS payload
FROM range(24576) t(i);

SELECT count(*) FROM duckdb_logs_parsed('ParquetPrefetch')
WHERE file_path LIKE '%recheck_nulls_first.parquet';

SET memory_limit='4MB';

SET GLOBAL debug_local_file_system_delay_ms=2;

SET read_ahead_depth=2;

SELECT count(*) FROM read_single_parquet_file('data/parquet-testing/lineitem-top10000.gzip.parquet');

SET parquet_use_page_index=false;

SELECT count(*),count(x) FROM read_parquet('data/parquet-testing/required_plain_page_boundary.parquet') WHERE hash(x) <> hash(1::BIGINT);

RESET parquet_use_page_index;

SELECT MIN(id), MAX(id) FROM userdata1;

SELECT MIN(last_name), MAX(last_name) FROM userdata1;

SELECT MIN(gender), MAX(gender) FROM userdata1;

SELECT MIN(cc), MAX(cc) FROM userdata1;

SELECT MIN(birthdate), MAX(birthdate) FROM userdata1;

SELECT MIN(title), MAX(title) FROM userdata1;

SET explain_output = 'PHYSICAL_ONLY';

create table t (ts TIMESTAMP_S);

CREATE TYPE null_target_struct AS STRUCT(n INTEGER, s VARCHAR);

SELECT p, p = encode('café') FROM blobs;

CREATE TABLE wide AS
SELECT ('{' || string_agg('"k' || i || '": [' || i || ', "' || i || '", null, [' || i || '.5]]', ', ') || '}')::JSON::VARIANT AS v
FROM range(300) t(i);

SELECT s.page_type, s.encoding, s."count"
FROM (SELECT unnest(encoding_stats) AS s
      FROM parquet_metadata('data/parquet-testing/enum.parquet')
      WHERE path_in_schema = 'trace_id');

SELECT * REPLACE (
	hugeint::DOUBLE AS hugeint,
	uhugeint::DOUBLE AS uhugeint,
	timezone(interval '0 seconds', time_tz) AS time_tz
)
FROM all_types;

INSERT INTO origin_int VALUES
(1, union_value(nums := [1, 2, 3])),
(2, union_value(nums := [])),
(3, union_value(flag := true));

INSERT INTO origin_list_union VALUES
(1, [1::UNION(str VARCHAR, num INT), 'one']),
(2, []::UNION(str VARCHAR, num INT)[]),
(3, NULL);

INSERT INTO origin_single VALUES
(1, union_value(vals := [10, 20])),
(2, NULL);

INSERT INTO origin_map_struct VALUES
(1, map([{'k': 1}], [10]), [map(['x'], [1]), map(['y'], [2])]),
(2, map([], []::INT[]), []::MAP(VARCHAR, INT)[]);

SELECT u FROM target;

SET force_compression='dict_fsst';

CREATE TEMP TABLE expected AS
SELECT i, 'category_' || (i % 16)::VARCHAR || '_padding' AS s,
       CASE WHEN i % 7 = 0 THEN NULL ELSE 'nullable_' || (i % 5)::VARCHAR END AS ns
FROM range(100000) t(i);

CREATE TABLE integers AS FROM range(100) t(i);

SELECT * FROM decimals;

INSERT INTO enums VALUES
	('happy'), ('happy'), ('joy'), ('joy'),
	('happy'), ('happy'), ('joy'), ('joy'),
    ('happy'), ('happy'), ('joy'), ('joy'),
    ('happy'), ('happy'), ('joy'), ('joy'),
    ('happy'), ('happy'), ('joy'), ('joy'),
    ('happy'), ('happy'), ('joy'), ('joy'),
    ('happy'), ('happy'), ('joy'), ('joy'), ('joy');

CREATE TABLE t1 AS SELECT 'a'::myenum AS m FROM range(10) t(i);

SELECT * FROM '~/integers.parquet';

INSERT INTO hugeints VALUES (-1180591620717411303424), (0), (NULL), (1180591620717411303424);

INSERT INTO empty_lists SELECT [] FROM range(10) UNION ALL SELECT [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

INSERT INTO empty_list_nested SELECT [] FROM range(10) UNION ALL SELECT [[1, 2, 3], [4, 5], [6, 7, 8]];

CREATE TABLE values_INTEGER AS SELECT d::INTEGER d FROM (VALUES
    (-2147483648), (42), (NULL), (2147483647)) tbl (d);

UPDATE strings SET s=NULL WHERE s='joy';

INSERT INTO strings VALUES
	('0'), ('1'), ('2'), (NULL), ('4'), ('5'), ('6'), (NULL), ('8'), ('9'),
	('10'), ('11'), ('12'), ('13'), ('14'), ('15'), ('16'), ('17'), ('18'), ('19'),
	('20'), (NULL), ('22'), ('23'), ('24'), ('25'), (NULL), ('27'), ('28'), ('29');

CREATE OR REPLACE TABLE timestamps_int96(
	ts TIMESTAMP,
	ts_s TIMESTAMP_S,
	ts_ms TIMESTAMP_MS,
	ts_ns TIMESTAMP_NS,
	ts_tz TIMESTAMPTZ
);

INSERT INTO hugeints VALUES (0), (1), (NULL), (1180591620717411303424);

CREATE TABLE values_UBIGINT AS SELECT d::UBIGINT d FROM (VALUES
    (0), (42), (NULL), (18446744073709551615)) tbl (d);

CREATE TABLE t1(part_key INT, val INT);

CREATE TABLE mixed AS SELECT i, CASE WHEN i % 100 = 0 THEN repeat(md5(i::VARCHAR), 4096) ELSE md5(i::VARCHAR) END::BLOB AS payload FROM range(20000) t(i);

RESET partitioned_write_flush_threshold;

CREATE TABLE empty_tbl(i INT, j VARCHAR);

CREATE TABLE list_of_structs AS SELECT * FROM (VALUES
	([{'a': 1, 'b': 100}, NULL, {'a': 2, 'b': 101}]),
	(NULL),
	([]),
	([{'a': NULL, 'b': 102}, {'a': 3, 'b': NULL}, NULL])
) tbl(i);

CREATE TABLE list_of_lists_of_lists_of_lists AS
   SELECT [LIST(i)] i FROM list_of_lists
   UNION ALL
   SELECT NULL
   UNION ALL
   SELECT [NULL]
   UNION ALL
   SELECT [[], NULL, [], []]
   UNION ALL
   SELECT [[[NULL, NULL, [NULL]], NULL, [[], [7, 8, 9], [NULL], NULL, []]], [], [NULL]];

INSERT INTO int_maps VALUES 
	(MAP([42, 84], [1, 2])), 
	(MAP([101, 201, 301], [3, NULL, 5])),
	(MAP([55, 66, 77], [6, 7, NULL]));

INSERT INTO list_map VALUES 
	(MAP([[1, 2, 3], [], [4, 5]], [[6, 7, 8], NULL, [NULL]])),
	(MAP([], [])),
	(MAP([[1]], [NULL])),
	(MAP([[10, 12, 14, 16, 18, 20], []], [[1], [2]]));

CREATE TABLE structs AS SELECT {'a': NULL, 'b': 'hello'} i UNION ALL SELECT NULL UNION ALL SELECT {'a': 84, 'b': 'world'};

CREATE TABLE struct_nested_null AS SELECT * FROM (VALUES
	({'a': {'x': 3, 'x1': 22}, 'b': {'y': NULL, 'y1': 44}}),
	({'a': {'x': NULL, 'x1': 26}, 'b': {'y': 1, 'y1': NULL}}),
	({'a': {'x': 17, 'x1': NULL}, 'b': {'y': 3, 'y1': 9999}}),
	(NULL),
	({'a': NULL, 'b': NULL})
) tbl(i);

CREATE TABLE sensor_data(ts TIMESTAMP, value INT);

CREATE SEQUENCE seq;

CREATE TABLE blob_tbl AS SELECT * FROM (VALUES (1, 'blob'::BLOB), (2, '\x00\xFF'::BLOB)) v(id, key);

CREATE TABLE tbl2 AS SELECT (date '2000-01-01' + interval (i//2000) years)::DATE AS part1, i%2 AS part2, i FROM range(10000) t(i);

CREATE TABLE delayed_skew AS
SELECT
	CASE WHEN i % 17 = 0 THEN ((i / 17) % 64) + 1 ELSE 0 END::INTEGER AS p,
	i::INTEGER AS v
FROM range(0, 20000) tbl(i);

SET partitioned_write_max_open_files=1;

SET partitioned_write_flush_threshold=2048;

CREATE TABLE regions AS SELECT * FROM (VALUES
	(1, 'eu', 'us-east-1'), (2, 'eu', 'us-west-2'), (3, 'us', 'us-east-1'), (4, 'eu', 'us-east-1'), (5, 'us', NULL)
) v(id, region, other_col);

CREATE TABLE events AS SELECT * FROM (VALUES (1, 'eu', 'x'), (2, 'us', 'y'), (3, 'eu', 'y')) v(id, region, part);

SET asof_loop_join_threshold=0;

CREATE TABLE trade AS 
	SELECT 
		i AS tid,
		getvariable('fiftyInstrs')[1 + floor(random() * 40)::INTEGER]::symbols AS sym,
		getvariable('datadate') + INTERVAL 9 HOURS + INTERVAL (floor(random() * (7 * 60 * 60 + 30 * 60) * 1000)::INTEGER) MILLISECONDS AS time
	FROM range(10_000) t(i);

DROP TABLE quote;

CREATE TABLE partitioned_early_finalize_source AS
SELECT
	(i % 32)::INTEGER AS p,
	i::INTEGER AS v,
	repeat('payload-', 4) || i::VARCHAR AS payload
FROM range(0, 8192) tbl(i);

CREATE TABLE partitioned_rotation_source AS
SELECT
	(i % 4)::INTEGER AS p,
	((i * 17) % 32768)::INTEGER AS v,
	hash(i)::DOUBLE AS payload
FROM range(32768) tbl(i);

CREATE TABLE a AS SELECT i AS k, i % 1000 AS v FROM range(500000) t(i);

SELECT partition, SUM(col1)
FROM partitioned_tbl
GROUP BY partition
ORDER BY ALL;

SELECT partition, SUM(col1) FILTER (col2%7>2)
FROM partitioned_tbl
GROUP BY partition
ORDER BY ALL;

DROP TABLE partitioned_tbl2;

SELECT partition1, SUM(col1)
FROM partitioned_tbl2
WHERE partition2=0
GROUP BY partition1
ORDER BY ALL;

CREATE TABLE r AS
SELECT (DATE '1998-01-08' + INTERVAL ((i * 7919) % 1996) DAY)::DATE AS r_date, i AS r_id
FROM range(2000) t(i);

CREATE TABLE ordered_source AS
SELECT 0 AS p, i::INTEGER AS v
FROM range(16384) tbl(i);

CREATE TABLE large_ordered_source AS
SELECT
	(i % 16)::INTEGER AS p,
	((i * 17) % 65536)::INTEGER AS v
FROM range(131072) tbl(i);

SELECT count(*), count(l.i), count(r.i) FROM l ASOF RIGHT JOIN r ON l.t >= r.t;

SELECT count(*)
FROM (
	SELECT partition1, partition2, lag(col1) OVER w AS prev
	FROM partitioned_tbl2
	WINDOW w AS (PARTITION BY partition1 ORDER BY col1)
	QUALIFY col1 - prev <> 2
);

SET memory_limit='128MB';

CREATE TABLE row_input AS SELECT repeat('x', 200) p, i::BIGINT v FROM range(10000) t(i);

SET partitioned_write_flush_threshold=16384;

SELECT count(*) FILTER (WHERE reason='BATCH_SIZE_BYTES') >= 8,
       min(bytes) FILTER (WHERE reason='BATCH_SIZE_BYTES') >= 131072,
       count(*) FILTER (WHERE reason='FORCED_FLUSH') <= 4,
       sum(rows)=131072
FROM batches();

SELECT count(*) FILTER (WHERE bytes >= 2097152 * 328 // 337) >= 2,
       count(*) FILTER (WHERE bytes < 2097152 * 328 // 337) <= 2,
       max(rows) <= (2097152 + 327) // 328,
       sum(rows)=16000
FROM batches();

SELECT count(*) FILTER (WHERE bytes >= 65536 * 328 // 337) > 10,
       count(*) FILTER (WHERE bytes < 65536 * 328 // 337) <= 3,
       max(rows) <= (65536 + 327) // 328,
       sum(rows)=32000
FROM batches();

SELECT count(*) FILTER (WHERE bytes >= 1048576) >= 2,
       count(*) FILTER (WHERE bytes < 1048576) <= 1,
       max(rows) <= (1048576 + 279) // 280,
       sum(rows)=8000
FROM batches();

INSERT INTO return_column_types_tbl VALUES (1, 'x', 1.5);

INSERT INTO return_column_types_altered VALUES (1);

CREATE TYPE return_column_types_mood AS ENUM ('sad', 'ok');

CREATE SEQUENCE return_column_types_seq_on;

CREATE TABLE multi_column_test AS SELECT range i, range%10 j, case when range%2=0 then null else range end k FROM range(2500);

CREATE TABLE string_test AS SELECT concat('thisisalongstring_', range) s FROM range(2500);

CREATE TABLE decimal_test AS
SELECT 25.3::DECIMAL(4,1) AS dec_i16,
       123456.789::DECIMAL(9,3) AS dec_i32,
       123456789123.456::DECIMAL(18,3) AS dec_i64,
       12345678912345678912345678912345678.912::DECIMAL(38,3) AS dec_i128
UNION ALL
SELECT 1.1::DECIMAL(4,1),
       2.123::DECIMAL(9,3),
       3.456::DECIMAL(18,3),
       4.567::DECIMAL(38,3);

CREATE TABLE nested_struct_test AS SELECT {'s1': {'x': i}, 's2': {'s3': {'y': i}, 'l': [i]}} n FROM range(2500) t(i);

CREATE TABLE struct_nan_test AS SELECT case when i%10=0 then null else {'x': case when i%10=5 then 'nan'::double else i/10.0 end, 'y': (i/10.0)::float} end struct_val FROM range(2500) t(i);

CREATE TABLE nested_nan_test AS SELECT {'s': {'x': case when i%10=5 then 'nan'::double else i/10.0 end}, 'l': [case when i%5=0 then 'nan'::float else (i/10.0)::float end]} n, [{'a': case when i%2=0 then 'nan'::double else i/10.0 end}] ls FROM range(2500) t(i);

CREATE TABLE partitioned_test AS SELECT range%2 as partition_key, range val FROM range(2500);

CREATE TABLE uuids AS SELECT uuid '47183823-2574-4bfd-b411-99ed177d3e43' uuid_val union all select uuid '00112233-4455-6677-8899-aabbccddeeff';

CREATE TABLE nested_nan_rg AS SELECT {'x': CASE WHEN i = 0 THEN 'nan'::double ELSE i::double END} s, [CASE WHEN i % 1000 = 0 THEN 'nan'::float ELSE i::float END] l, (CASE WHEN i IN (1, 2) THEN 'nan'::double ELSE i::double END)::VARIANT v FROM range(4096) t(i);

CREATE TABLE partitioned_test AS SELECT range%2 AS partition_key, range val FROM range(10000);

INSERT INTO nested_containers VALUES
    (NULL, NULL),
    ({'inner_struct': NULL, 'l': NULL, 'a': NULL, 'm': NULL}, []),
    ({'inner_struct': {'x': NULL}, 'l': [], 'a': [NULL, NULL], 'm': MAP {}},
     [NULL, [], [NULL], [1, NULL]]),
    ({'inner_struct': {'x': 1}, 'l': [NULL, {'y': NULL}, {'y': 1}],
      'a': [1, NULL], 'm': MAP {'absent': NULL, 'null_field': {'z': NULL}, 'value': {'z': 1}}},
     [[1]]);

CREATE TABLE object_variants AS
SELECT * FROM (VALUES
    (0, NULL::VARIANT),
    (1, {'a': NULL}::VARIANT),
    (2, {'a': []::INTEGER[]}::VARIANT),
    (3, {'a': [1], 'extra': true}::VARIANT),
    (4, {'b': 42}::VARIANT),
    (5, 'fallback'::VARIANT)
) t(id, v);
