SET allowed_configs=['TimeZone'];

SET allowed_configs=['pivot_limit', 'EXPLAIN_output', 'memory_limit'];

SET lock_configuration=true;

SET pivot_limit=20000;

SET explain_output='OPTIMIZED_ONLY';

SET memory_limit='2GB';

SET max_memory='2GB';

SET search_path='';

SET TimeZone='America/New_York';

RESET allowed_directories;

SET enable_external_access=false;

CREATE TABLE integers(i INT);

FROM integers;

CREATE TABLE a1.integers(i INTEGER);

SELECT len(current_setting('allowed_directories'));

SELECT len(current_setting('allowed_paths'));

RESET allowed_paths;

SELECT len(current_setting('allowed_directories')) + len(current_setting('allowed_paths'));

SET allowed_directories=['~'];

SET autoload_known_extensions=false;

SET autoinstall_known_extensions=false;

SET allowed_paths=['http://127.0.0.1:1/explicit/%2e%2e/private'];

SET disabled_filesystems='HTTPFileSystem,S3FileSystem,AzureBlobStorageFileSystem';

CREATE TABLE m AS SELECT range i, range % 100 g FROM range(1000);

SET GLOBAL disabled_optimizers='expression_rewriter,filter_pushdown,cte_filter_pusher,join_order';

SELECT count(*) FROM m a WHERE a.i > (SELECT min(b.i) FROM m b WHERE b.g = a.g);

SET GLOBAL disabled_optimizers='';

SELECT count(*) FROM m a WHERE EXISTS (SELECT 1 FROM m b WHERE b.g = a.g AND b.i < a.i);

RESET GLOBAL disabled_optimizers;

SELECT current_setting('disabled_optimizers');

CREATE TABLE tbl AS FROM (VALUES (1), (2), (3), (NULL)) t(i);

SET default_order = 'ASCENDING';

SET default_null_order = 'NULLS FIRST';

SELECT * FROM tbl ORDER BY i;

SELECT list_count(
    list_intersect(
        (SELECT list(name) FROM duckdb_settings(debug := true)),
        (SELECT list(name) FROM duckdb_settings(debug := false))
    )
);

SELECT list_count(
    list_intersect(
        (SELECT list(name) FROM duckdb_settings(deprecated := true)),
        (SELECT list(name) FROM duckdb_settings(deprecated := false))
    )
);

SELECT name FROM duckdb_settings(debug := true) WHERE name = 'debug_enable_caching_operators';

SELECT count(*) != 0 FROM duckdb_settings(debug := true);

SELECT count(*) != 0 FROM duckdb_settings(deprecated := true);

SELECT (SELECT count(*) FROM duckdb_settings(include_all := true)) =
    (SELECT count(*) FROM duckdb_settings()) +
    (SELECT count(*) FROM duckdb_settings(debug := true)) +
    (SELECT count(*) FROM duckdb_settings(deprecated := true)) +
    (SELECT count(*) FROM duckdb_settings(debug := true, deprecated := true));

SELECT count(*) FROM duckdb_settings(include_all := true) WHERE name IN ('threads', 'debug_enable_caching_operators');

SELECT (SELECT count(*) FROM duckdb_settings(include_all := false)) = (SELECT count(*) FROM duckdb_settings());

SELECT * FROM duckdb_settings() WHERE name = 'default_grammar_extensions';

SELECT value FROM duckdb_settings() WHERE name = 'default_grammar_extensions';

SET GLOBAL default_grammar_extensions = [];

SET GLOBAL default_grammar_extensions = NULL;

RESET GLOBAL default_grammar_extensions;

CREATE TABLE integers(i integer);

INSERT INTO integers VALUES (1), (2), (3), (NULL);

SET default_null_order='nulls_first';

SELECT * FROM integers ORDER BY i;

SELECT * FROM integers ORDER BY i DESC;

SELECT FIRST(i ORDER BY i), LAST(i ORDER BY i) FROM integers;

SELECT FIRST(i ORDER BY i DESC), LAST(i ORDER BY i DESC) FROM integers;

SELECT list_sort(LIST(i)), list_reverse_sort(LIST(i)) FROM integers;

SET default_null_order='sqlite';

SET default_null_order='postgres';

SET enable_logging=true;

SET warnings_as_errors=true;

RESET delim_join_as_cte;

RESET enable_object_cache;

RESET regex_match_operator_semantics;

RESET table_function_identifier_conversion;

RESET lambda_syntax;

SET integer_division=true;

RESET integer_division;

SET warnings_as_errors=false;

SELECT current_setting('dialect_compatibility_mode');

SET dialect_compatibility_mode='spark';

RESET dialect_compatibility_mode;

SET GLOBAL dialect_compatibility_mode='SPARK';

RESET GLOBAL dialect_compatibility_mode;

create schema my_schema;

select current_schema();

SET schema='my_schema';

drop schema my_schema;

create schema schema1;

create schema schema2;

set schema='schema1';

drop schema schema2;

ATTACH ':memory:' as db2;

create schema db2.schema1;

drop schema db2.schema1;

drop schema schema1;

SELECT current_setting('enable_block_allocator');

SET enable_block_allocator=true;

CREATE TABLE blocks AS SELECT i, repeat('a', 100) AS s FROM range(10000) t(i);

SET enable_block_allocator=false;

SELECT sum(i), sum(length(s)) FROM blocks;

DROP TABLE blocks;

SET errors_as_json=true;

SELECT current_setting('tracked_metrics');

SET tracked_metrics=['query.*', 'optimizer.*'];

SET tracked_metrics=[];

SELECT len(current_setting('tracked_metrics'));

RESET tracked_metrics;

SELECT 42;

PRAGMA disable_profiling;

SET GLOBAL tracked_metrics=['optimizer.*'];

RESET GLOBAL tracked_metrics;

SELECT current_setting('profiling_coverage'), current_setting('debug_force_variant_shredding'),
       current_setting('checkpoint_threshold'), current_setting('allocator_bulk_deallocation_flush_threshold');

SELECT current_setting('disabled_optimizers'), current_setting('disabled_compression_methods'),
       current_setting('extension_directories'), current_setting('profiling_output'),
       current_setting('custom_user_agent');

SET debug_verification_mode='verify_vectors';

SET profiling_coverage='all';

SELECT current_setting('debug_verification_mode'), current_setting('profiling_coverage');

RESET debug_verification_mode;

RESET profiling_coverage;

SET disabled_optimizers='Join_Order , extension';

SET disabled_compression_methods='rle,bitpacking';

SELECT current_setting('disabled_optimizers'), current_setting('disabled_compression_methods');

SET disabled_compression_methods='bitpacking,rle,rle';

SELECT current_setting('disabled_compression_methods');

SET disabled_compression_methods='rle,rle';

RESET disabled_optimizers;

RESET disabled_compression_methods;

SET checkpoint_threshold='1GB';

SET allocator_bulk_deallocation_flush_threshold='1GiB';

SET extension_directories=['/tmp/a', '/tmp/b'];

SELECT current_setting('checkpoint_threshold'), current_setting('allocator_bulk_deallocation_flush_threshold'),
       current_setting('extension_directories');

SELECT current_setting('extension_directories');

SELECT count(*) > 0 FROM duckdb_extensions();

RESET checkpoint_threshold;

RESET allocator_bulk_deallocation_flush_threshold;

RESET extension_directories;

SET enable_progress_bar_print=false;

SELECT current_setting('enable_progress_bar_print');

RESET enable_progress_bar_print;

SET force_variant_shredding='STRUCT(a INTEGER)';

SELECT current_setting('debug_force_variant_shredding');

RESET force_variant_shredding;

SELECT name, scope FROM duckdb_settings()
WHERE name IN ('max_streaming_buffer_size', 'profiling_coverage', 'profiling_output',
               'profiling_renderer_settings', 'progress_bar_time') ORDER BY name;

SELECT current_setting('profiling_renderer_settings');

SET profiling_renderer_settings = MAP {'B': '1', 'a': 'true'};

RESET profiling_renderer_settings;

SELECT current_setting('threads') > 0 AND current_setting('async_threads') >= 0;

SET threads=3;

SET async_threads=0;

SELECT current_setting('threads'), current_setting('async_threads');

RESET threads;

RESET async_threads;

SET max_memory='1GB';

SELECT current_setting('max_memory');

RESET max_memory;

SELECT current_setting('max_memory') <> '953.6 MiB';

SET storage_compatibility_version='v1.2.0';

SELECT current_setting('storage_compatibility_version');

RESET storage_compatibility_version;

SET http_proxy='proxy.example.com:8080';

SELECT current_setting('http_proxy');

RESET http_proxy;

SELECT current_setting('http_proxy') <> 'proxy.example.com:8080';

SET GLOBAL checkpoint_on_shutdown = false;

SELECT value, scope FROM duckdb_settings() WHERE name = 'checkpoint_on_shutdown';

RESET GLOBAL checkpoint_on_shutdown;

SELECT current_setting('checkpoint_on_shutdown');

SET SESSION debug_order_verification = 'NONE';

SET VARIABLE default_http_capacity = current_setting('http_client_pool_capacity');

SET async_threads = 0;

SELECT current_setting('http_client_pool_capacity');

RESET http_client_pool_capacity;

SELECT current_setting('http_client_pool_capacity') >= 1;

SELECT current_setting('http_client_pool_capacity') = getvariable('default_http_capacity');

SELECT 1/2;

SELECT 1//2;

SET integer_division=false;

SELECT weighted_avg(v, w) FROM (VALUES (1, 1), (2, 2)) t(v, w);

PRAGMA disable_optimizer;

SELECT current_setting('enable_optimizer');

PRAGMA enable_optimizer;

PRAGMA enable_progress_bar;

SELECT current_setting('enable_progress_bar');

PRAGMA disable_progress_bar;

PRAGMA disable_print_progress_bar;

PRAGMA enable_print_progress_bar;

SET enable_profiling='no_output';

SELECT current_setting('enable_profiling') IS NULL;

PRAGMA enable_profiling;

SELECT current_setting('enable_profiling');

PRAGMA verify_parallelism;

PRAGMA disable_verify_parallelism;

PRAGMA disable_checkpoint_on_shutdown;

PRAGMA enable_checkpoint_on_shutdown;

SET enable_logging=false;

SELECT current_setting('enable_profiling'), current_setting('profiling_output');

SELECT current_setting('enable_logging')::BOOLEAN;

create schema s1;

create schema s2;

use s1;

use s2;

reset schema;

reset search_path;

SELECT current_setting('max_decimal_width');

SELECT length(1::DECIMAL(100000,99990)::VARCHAR);

SET max_decimal_width = 100;

SELECT typeof(NULL::DECIMAL(50,0) * NULL::DECIMAL(50,0));

SELECT coalesce('0.5'::DECIMAL(99,1), 0::DECIMAL(99,0)) AS c, typeof(c);

SET max_decimal_width = 50;

SELECT typeof(123456789012345678901234567890123456789012345.5);

CREATE VIEW lv AS SELECT 1234567890123456789012345678901234567890.5 = 1234567890123456789012345678901234567890.0 AS same;

SELECT same FROM lv;

SET max_decimal_width = 38;

SELECT typeof(1234567890123456789012345678901234567890123456789012345678901234567890.5e0);

SET max_decimal_width = 4294967295;

CREATE TABLE wide AS SELECT '1'::DECIMAL(300,100) AS d;

SELECT d::VARCHAR = '1.' || repeat('0', 100) FROM wide;

SELECT count(*) FROM wide WHERE d = d;

SELECT typeof(coalesce(d, d)), typeof(CASE WHEN d > 0 THEN d ELSE NULL END), typeof(coalesce(d, 1::DECIMAL(50,0))), typeof(coalesce(d, 1))
FROM wide;

SELECT max(d) = min(d), typeof(max(d)), round(max(d), 2) FROM wide;

SELECT typeof(d) FROM (SELECT d FROM wide UNION ALL SELECT d FROM wide) LIMIT 1;

SELECT count(*) FROM wide w1 JOIN wide w2 ON w1.d = w2.d;

CREATE TABLE wide2 AS SELECT '1'::DECIMAL(250,200) AS e;

CREATE TABLE w (d DECIMAL(5000,10));

INSERT INTO w VALUES (1);

SET max_decimal_width = 1000;

SELECT count(*), typeof(max(d)) FROM w WHERE d = d;

SELECT typeof(1::DECIMAL(38,0) + 1::DECIMAL(38,0)), typeof(1::DECIMAL(38,0) * 1::DECIMAL(38,0));

SET max_decimal_width = 39;

SELECT typeof(1::DECIMAL(38,0) + 1::DECIMAL(38,0));

SET max_decimal_width = 1;

SELECT typeof(1::DECIMAL(38,2) + 1::DECIMAL(38,2)), typeof(1::DECIMAL(38,2) * 1::DECIMAL(38,2)), typeof(CASE WHEN true THEN 1::DECIMAL(38,10) ELSE 1::DECIMAL(38,0) END);

RESET max_decimal_width;

SELECT current_setting('max_execution_time');

SET max_execution_time=5000;

RESET max_execution_time;

SELECT name, value, input_type FROM duckdb_settings() WHERE name = 'max_execution_time';

SET max_execution_time=100;

SET max_execution_time=50;

SELECT 1;

SELECT COUNT(*) FROM range(1000);

SET GLOBAL max_execution_time=5000;

SET max_execution_time=9000;

SET GLOBAL max_execution_time=0;

SET max_execution_time=9223372036854775807;

SET max_execution_time=10000000000000;

SET max_execution_time=0;

CREATE MACRO d(x) AS x + x;

SELECT d(d(d(1)));

SET max_execution_time=200;

SET max_memory='100%';

CREATE TABLE all_memory AS SELECT current_setting('max_memory') AS v;

SET max_memory='50%';

SELECT (SELECT v FROM all_memory) <> current_setting('max_memory');

SET max_memory='0.5%';

SELECT current_setting('max_memory') <> '0 bytes';

SET max_memory='1GiB';

SET max_streaming_buffer_size='2MiB';

SELECT current_setting('max_streaming_buffer_size'), current_setting('streaming_buffer_size');

SET streaming_buffer_size='4.0MiB';

RESET streaming_buffer_size;

SELECT current_setting('max_streaming_buffer_size');

SET operator_memory_limit = '-1';

SELECT current_setting('operator_memory_limit') IS NULL;

SET operator_memory_limit = 'none';

SET operator_memory_limit = '-1 GB';

SET write_buffer_row_group_memory_limit = 'null';

SET write_buffer_row_group_memory_limit = '-1';

SELECT current_setting('operator_memory_limit');

SET operator_memory_limit='256MB';

RESET operator_memory_limit;

SET operator_memory_limit='128MB';

SET operator_memory_limit=NULL;

SELECT name, value, input_type FROM duckdb_settings() WHERE name = 'operator_memory_limit';

SET memory_limit='100MB';

SET temp_directory='';

SET max_temp_directory_size='0B';

SET operator_memory_limit='1MB';

SET threads=1;

CREATE TABLE t1 AS SELECT * FROM range(1000000);

SELECT COUNT(*) FROM t1;

SELECT SUM(i) FROM range(1000000) t(i);

SELECT i % 10 as g, COUNT(*) FROM range(1000000) t(i) GROUP BY 1 ORDER BY 1;

SELECT COUNT(*), MIN(n), MAX(n)
FROM (SELECT i % 20000 AS g, COUNT(*) AS n FROM range(100000) t(i) GROUP BY g);

SELECT COUNT(*) FROM (SELECT * FROM range(1000) ORDER BY random());

SELECT LENGTH(string_agg(i::VARCHAR, ',')) > 0 FROM range(100000) t(i);

SELECT LENGTH(list(i)::VARCHAR) > 0 FROM range(50000) t(i);

SELECT COUNT(*) FROM range(100) a, range(100) b;

PRAGMA threads=2;

SET threads=2;

SET enable_profiling = 'json';

SET profiling_renderer_settings = MAP {'expand_all': 'invalid_boolean'};

RESET enable_profiling;

SET profiling_renderer_settings = MAP {'expand_all': 'true'};

SET memory_limit='2MB';

RESET memory_limit;

select current_setting('threads');

SET threads=42;

SET GLOBAL TIME ZONE 'UTC';

SELECT current_setting('TimeZone');

SET SESSION TIME ZONE 'Europe/Amsterdam';

RESET TimeZone;

CREATE TABLE default_tz AS SELECT current_setting('TimeZone') AS tz;

SET SESSION TIME ZONE 'Asia/Tokyo';

RESET SESSION TIME ZONE;

SELECT current_setting('TimeZone') = (SELECT tz FROM default_tz);

RESET TIME ZONE;

SET SESSION TIME ZONE DEFAULT;

SET SESSION TIME ZONE LOCAL;

SET SESSION TimeZone = 'UTC';

RESET SESSION TimeZone;

SET SESSION SCHEMA 's1';

RESET SESSION SCHEMA;

SET SCHEMA 'main';

SELECT current_setting('null_order'), (SELECT value FROM duckdb_settings() WHERE name='null_order');

SET null_order='NULLS_FIRST';

RESET null_order;

SET default_collation='NOCASE';

CREATE TABLE collate_test(s VARCHAR);

INSERT INTO collate_test VALUES ('hEllO'), ('WöRlD'), ('wozld');

SELECT COUNT(*) FROM collate_test WHERE 'BlA'='bLa';

SELECT * FROM collate_test WHERE s='hello';

SELECT * FROM collate_test ORDER BY s;

SET default_collation='NOCASE.NOACCENT';

SET GLOBAL default_collation='NOCASE';

SET SESSION default_collation='NOCASE';

SET extension_directories=['first', 'second'];

SELECT current_setting('extension_directories') = ['first', 'second'];

SELECT current_setting('extension_directories') = []::VARCHAR[];

SET allowed_configs=['threads', 'memory_limit'];

SELECT list_sort(current_setting('allowed_configs')) = ['max_memory', 'threads'];

RESET allowed_configs;

SELECT current_setting('allowed_configs') = []::VARCHAR[];

SET profiling_renderer_settings=MAP {'maximum_render_width': 300, 'maximum_render_height': 20};

SELECT current_setting('profiling_renderer_settings')['maximum_render_width'] = '300'
   AND current_setting('profiling_renderer_settings')['maximum_render_height'] = '20';

SELECT map_entries(current_setting('profiling_renderer_settings')) = [];

SET active_grammar_extensions=[];

SELECT current_setting('active_grammar_extensions') = []::VARCHAR[];

SET active_grammar_extensions=NULL;

RESET active_grammar_extensions;

SET current_dialect=NULL;

SELECT current_setting('current_dialect') IS NULL;

RESET current_dialect;

SET disabled_optimizers='';

SET disabled_optimizers TO 'expression_rewriter';

SET disabled_optimizers TO 'expression_rewriter,filter_pushdown,join_order';

SELECT * FROM duckdb_settings();

SET enable_progress_bar=true;

SELECT * FROM range(3) UNION ALL SELECT NULL ORDER BY 1;

SELECT * FROM range(3) ORDER BY 1;

SELECT value FROM duckdb_settings() WHERE name='preserve_identifier_case';

CREATE SCHEMA MySchema;

CREATE TABLE MySchema.Integers(I INTEGER);

SELECT duckdb_tables.schema_name, duckdb_tables.table_name, column_name FROM duckdb_tables JOIN duckdb_columns USING (table_oid);

DROP SCHEMA MySchema CASCADE;

SET preserve_identifier_case TO 'lowercase';

SET preserve_identifier_case TO 'uppercase';

CREATE TABLE "QuotedName"("MixedCol" INTEGER);

SELECT duckdb_tables.table_name, column_name FROM duckdb_tables JOIN duckdb_columns USING (table_oid);

DROP TABLE "QuotedName";

SELECT 'MyString';

RESET preserve_identifier_case;

SET profiling_mode='standard';

SET profiling_mode='detailed';

SET profiling_mode='all';

SET disabled_compression_methods='rle,dictionary';

SELECT current_setting('disabled_compression_methods') = 'RLE,Dictionary';

SET disabled_compression_methods='none';

SELECT current_setting('disabled_compression_methods') = '';

SET force_variant_shredding='STRUCT(a INTEGER[])';

SELECT current_setting('force_variant_shredding') <> 'INVALID';

SELECT current_setting('force_variant_shredding') = 'INVALID';

SELECT current_setting('standard_vector_size') > 0;

RESET enable_progress_bar;

SET progress_bar_time=10;

SELECT current_setting('progress_bar_time');

RESET progress_bar_time;

SET debug_order_verification='none';

SELECT current_setting('debug_order_verification') = 'none';

RESET debug_order_verification;

SET max_temp_directory_size='90% of available disk space';

SELECT current_setting('max_temp_directory_size') = '90% of available disk space';

RESET max_temp_directory_size;

SET Calendar='gregorian';

SET TimeZone='pacific/honolulu';

SELECT name, value, description, input_type, scope FROM duckdb_settings() WHERE name = 'TimeZone';

SET Calendar='Coptic';

SELECT name, value, description, input_type, scope FROM duckdb_settings() WHERE name = 'Calendar';

SELECT current_setting('disabled_filesystems');

RESET disabled_filesystems;

SET disabled_filesystems='';

SET disabled_filesystems='LocalFileSystem';

SELECT value FROM duckdb_settings() WHERE name = 'disabled_filesystems';

SET disabled_filesystems='x, LocalFileSystem ';

SELECT * FROM duckdb_secrets();

SELECT current_setting('lock_configuration');

SET memory_limit='8GB';

RESET lock_configuration;

SET lock_configuration=false;

SET index_scan_percentage=0.5;

RESET index_scan_percentage;

SET enable_progress_bar=false;

SET enable_progress_bar_print=true;

SET progress_bar_time = 100;

SELECT current_setting('custom_user_agent');

SELECT regexp_matches(user_agent, '^duckdb/.*(.*)') FROM pragma_user_agent();
