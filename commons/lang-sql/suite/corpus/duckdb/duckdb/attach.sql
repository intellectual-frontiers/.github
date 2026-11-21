CREATE TABLE db1.all_types AS SELECT * FROM test_all_types();

SELECT * FROM test_all_types();

SELECT * FROM db1.all_types;

DETACH db1;

SET catalog_error_max_schemas = 0;

SET wal_autocheckpoint = '1TB';

CREATE TABLE test1.tbl AS SELECT range AS id FROM range(100);

DETACH test1;

PRAGMA disable_checkpoint_on_shutdown;

CREATE TABLE test2.tbl AS SELECT range AS id FROM range(100);

DETACH test2;

PRAGMA enable_checkpoint_on_shutdown;

SET checkpoint_on_detach = 'ENABLED';

CREATE TABLE test3.tbl AS SELECT range AS id FROM range(100);

DETACH test3;

CREATE TABLE test4.tbl AS SELECT range AS id FROM range(100);

DETACH test4;

SET checkpoint_on_detach = 'DISABLED';

CREATE TABLE test5.tbl AS SELECT range AS id FROM range(100);

DETACH test5;

CREATE TABLE test6.tbl AS SELECT range AS id FROM range(100);

DETACH test6;

RESET checkpoint_on_detach;

CREATE TABLE test7.tbl AS SELECT range AS id FROM range(100);

DETACH test7;

CREATE TABLE db1.integers(i INTEGER);

CHECKPOINT db1;

VACUUM db1.integers;

ATTACH DATABASE ':memory:' AS db1;

CREATE TABLE db1.test(a INTEGER, b INTEGER, c VARCHAR(10));

USE db1;

ATTACH '' AS tmp;

CREATE TABLE tmp.t1(id int);

CREATE INDEX idx ON tmp.t1(id);

CREATE TABLE test(a INTEGER);

CREATE INDEX index ON test(a);

CREATE TYPE db1.mood AS ENUM('ok', 'sad', 'happy');

CREATE TABLE db1.integers(i mood);

SELECT 'happy'::mood;

DETACH default_size;

DETACH dbname;

SET default_block_size = '16384';

SET default_block_size = '262144';

ATTACH DATABASE ':memory:' AS new_database (BLOCK_SIZE 262144, ROW_GROUP_SIZE 2048);

SELECT options['block_size'] from duckdb_databases() where database_name = 'new_database';

SELECT options['row_group_size'] from duckdb_databases() where database_name = 'new_database';

SELECT database_name FROM pragma_database_size() WHERE database_name = 'db1';

ATTACH ':memory:' AS db2;

SELECT database_name FROM pragma_database_size() WHERE database_name = 'db1' OR database_name = 'db2' ORDER BY ALL;

ATTACH ':memory:' as "my""db";

CREATE TABLE "my""db".tbl(i int);

INSERT INTO "my""db".tbl VALUES (42);

USE "my""db";

SET search_path=current_setting('search_path');

SELECT * FROM tbl;

USE attach_quoated_base;

CREATE SCHEMA "my""db"."my""schema";

CREATE TABLE "my""db"."my""schema".tbl(i int);

INSERT INTO "my""db"."my""schema".tbl VALUES (84);

USE "my""db"."my""schema";

CREATE SCHEMA """";

USE """";

ATTACH ':memory:' AS MyDB;

USE MyDB;

SELECT current_database();

USE memory;

DETACH mydb;

CREATE OR REPLACE TABLE ddb.my_table AS (SELECT 1337 as value);

from ddb;

from ddb.my_table;

from ddb.main.my_table;

create table ddb as select 42 as value;

from memory.main.ddb;

SELECT
    t1.value,
    t2.value
FROM
    memory.main.ddb as t1
JOIN
    ddb.main.my_table as t2
ON
    t1.value != t2.value;

use ddb;

from my_table;

from main.my_table;

DROP TABLE memory.main.ddb;

CREATE VIEW ddb as SELECT 1;

DROP VIEW ddb;

ATTACH DATABASE ':memory:' AS new_database;

CREATE TABLE pk_tbl (id INTEGER PRIMARY KEY, name VARCHAR UNIQUE);

CREATE TABLE fk_tbl (id INTEGER REFERENCES pk_tbl(id));

CREATE TABLE tbl_alter_column (id INT, other INT, nn_col INT NOT NULL, rm INT, rename_c INT, my_def INT, drop_def INT DEFAULT 10, new_null_col INT);

ALTER TABLE tbl_alter_column ADD COLUMN k INTEGER;

ALTER TABLE tbl_alter_column ALTER other SET DATA TYPE VARCHAR USING concat(other, '_', 'yay');

ALTER TABLE tbl_alter_column ALTER COLUMN nn_col DROP NOT NULL;

ALTER TABLE tbl_alter_column DROP rm;

ALTER TABLE tbl_alter_column RENAME rename_c TO my_new_col;

ALTER TABLE tbl_alter_column ALTER COLUMN my_def SET DEFAULT 10;

ALTER TABLE tbl_alter_column ALTER COLUMN drop_def DROP DEFAULT;

ALTER TABLE tbl_alter_column ALTER COLUMN new_null_col SET NOT NULL;

START TRANSACTION;

CREATE TABLE other_db.test (ts TIMESTAMP);

INSERT INTO other_db.test(ts) VALUES (now());

DETACH other_db;

ROLLBACK;

COMMIT;

SELECT count(*) FROM other_db.test;

BEGIN;

CREATE TABLE copied AS SELECT * FROM source_db.test;

DETACH source_db;

SELECT count(*) FROM copied;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'source_db';

ATTACH ':memory:' AS x;

CREATE TABLE x.original AS SELECT 1 AS i;

DETACH x;

SELECT i FROM x.replacement;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'x';

ATTACH ':memory:' AS a;

DETACH a;

CREATE TABLE a.t AS SELECT 42 i;

SELECT i FROM a.t;

CREATE TABLE a.tbl AS SELECT 2 AS i;

SELECT * FROM a.tbl;

CREATE TABLE b.tbl AS SELECT 1 AS i;

DETACH b;

ATTACH ':memory:' AS b;

CREATE TABLE c.tbl AS SELECT 1 AS i;

SELECT * FROM c.tbl;

DETACH c;

ATTACH ':memory:' AS c;

CREATE TABLE c.tbl AS SELECT 2 AS i;

SELECT * FROM c_file.tbl;

CREATE TABLE hello(i INTEGER);

CREATE TABLE db1.test(a INTEGER);

CREATE SCHEMA db1.myschema;

CREATE TABLE db1.myschema.blablabla(i INTEGER);

SET catalog_error_max_schemas=0;

RESET catalog_error_max_schemas;

SELECT * FROM test;

SELECT * FROM myschema.blablabla;

SELECT * FROM memory.hello;

USE db1.myschema;

SELECT * FROM blablabla;

SELECT * FROM db1.main.test;

create table alias1.tbl1 as select 1 as a;

FROM alias1.tbl1;

DETACH alias1;

FROM alias2.tbl1;

SELECT database_name FROM duckdb_databases() WHERE database_name = 'first';

CREATE TABLE lake.ducklake_metadata(key VARCHAR NOT NULL, value VARCHAR NOT NULL);

DETACH lake;

CREATE TABLE plain.t(i INTEGER);

DETACH plain;

SET enable_logging = true;

SELECT count(*) FROM duckdb_logs WHERE log_level = 'WARNING' AND contains(message, 'is a DuckLake metadata catalog');

CALL truncate_duckdb_logs();

CREATE SCHEMA other.s;

CREATE TABLE other.s.ducklake_metadata(key VARCHAR, value VARCHAR);

DETACH other;

CREATE SCHEMA nested.s;

CREATE SCHEMA nested.s.main;

CREATE TABLE nested.s.main.ducklake_metadata(key VARCHAR, value VARCHAR);

DETACH nested;

CREATE VIEW v.ducklake_metadata AS SELECT 'version' AS key, '1' AS value;

DETACH v;

SET warnings_as_errors = true;

SET enable_external_access=false;

CREATE TABLE a1.test (a INTEGER PRIMARY KEY, b INTEGER);

CHECKPOINT a1;

CREATE TABLE a2.test (a INTEGER PRIMARY KEY, b INTEGER);

CHECKPOINT a2;

DETACH encrypted;

DETACH encrypted_aws;

SET force_mbedtls_unsafe = true;

RESET storage_compatibility_version;

SELECT database_name, tags['storage_version'] FROM duckdb_databases()
WHERE database_name IN ('e', 'e0', 'u') ORDER BY ALL;

CREATE TABLE e.t AS SELECT 7 AS i;

DETACH e;

DETACH e0;

DETACH u;

SELECT i, (SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name = 'e') FROM e.t;

SET storage_compatibility_version = 'v1.5.0';

SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name = 'e';

CREATE TABLE e.t AS SELECT 1 AS i;

CREATE TABLE e0.t AS SELECT 2 AS i;

SELECT (SELECT i FROM e.t), (SELECT i FROM e0.t), list(tags['storage_version'] ORDER BY database_name)
FROM duckdb_databases() WHERE database_name IN ('e', 'e0');

CREATE TABLE e.t AS SELECT 42 AS i;

SELECT i FROM e.t;

INSERT INTO e.t VALUES (2);

CHECKPOINT e;

SELECT sum(i), (SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name = 'e') FROM e.t;

SET force_mbedtls_unsafe = false;

INSERT INTO enc.test VALUES (5);

CHECKPOINT enc;

DETACH enc;

SELECT sum(value), (SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name = 'enc') FROM enc.test;

CREATE OR REPLACE TABLE encrypted.tbl AS SELECT * FROM range(10) t(i);

CREATE OR REPLACE TABLE unencrypted.tbl AS SELECT * FROM range(10) t(i);

SELECT SUM(i) FROM encrypted.tbl;

SELECT SUM(i) FROM unencrypted.tbl;

DETACH unencrypted;

SELECT tags FROM duckdb_databases() WHERE database_name LIKE '%encrypted%' ORDER BY database_name;

ATTACH 'data/attach_test/encrypted_ctr_key=abcde.db' as enc1 (ENCRYPTION_KEY 'abcde', ENCRYPTION_CIPHER 'CTR');

ATTACH 'data/attach_test/encrypted_gcm_key=abcde.db' as enc2 (ENCRYPTION_KEY 'abcde');

set autoinstall_known_extensions=false;

set autoload_known_extensions=false;

FROM enc.test ORDER BY value;

SELECT count(*) FROM duckdb_extensions() WHERE extension_name='httpfs' AND loaded;

SET force_mbedtls_unsafe = 'true';

SET force_mbedtls_unsafe = 'false';

CREATE TABLE enc.test AS SELECT 1 as a;

FROM enc.test;

CREATE TYPE db1.mood AS ENUM ('sad', 'ok', 'happy');

SELECT enum_range(NULL::db1.mood) AS my_enum_range;

SELECT enum_range(NULL::db1.main.mood) AS my_enum_range;

DROP TYPE db1.mood;

DROP TYPE IF EXISTS db1.main.mood;

CREATE TABLE db1.person (
    name text,
    current_mood mood
);

INSERT INTO db1.person VALUES ('Moe', 'happy');

select * from db1.person;

CREATE TYPE db2.mood AS ENUM ('ble','grr','kkcry');

CREATE TABLE db2.person (
    name text,
    current_mood mood
);

INSERT INTO db2.person VALUES ('Moe', 'kkcry');

select * from db2.person;

ATTACH ':memory:' AS db1;

ATTACH ':memory:' as other;

INSERT INTO db1.integers VALUES (1), (2), (3), (NULL);

CREATE VIEW db1.integers_view AS SELECT * FROM integers;

BEGIN TRANSACTION;

CREATE TABLE other.dont_export_me (i integer);

drop table db1.integers CASCADE;

drop view integers_view;

SELECT * FROM integers ORDER BY i NULLS LAST;

SELECT * FROM integers_view order by i NULLS LAST;

SET VARIABLE db_type='DUCKDB';

ATTACH ':memory:' AS db1 (TYPE getvariable('db_type'));

SET VARIABLE db_type='UNKNOWN_TYPE';

SET default_transaction_invalidation_policy='SYNTACTIC_ERRORS_DO_NOT_INVALIDATE';

SELECT database_name FROM duckdb_databases() WHERE database_name = 'concurrent';

DETACH concurrent;

CREATE TABLE album(artistid INTEGER, albumname TEXT, albumcover TEXT, UNIQUE (artistid, albumname));

INSERT INTO album VALUES (1, 'A', 'A_cover'), (2, 'B', 'B_cover'), (3, 'C', 'C_cover'), (4, 'D', 'D_cover');

CREATE TABLE song(songid INTEGER, songartist INTEGER, songalbum TEXT, songname TEXT, FOREIGN KEY(songartist, songalbum) REFERENCES album(artistid, albumname));

ATTACH DATABASE ':memory:' AS db2;

USE db2;

INSERT INTO db1.song VALUES (11, 1, 'A', 'A_song'), (12, 2, 'B', 'B_song'), (13, 3, 'C', 'C_song');

CREATE TABLE ext.artist(id INTEGER PRIMARY KEY, name TEXT);

CREATE TABLE ext.album(id INTEGER PRIMARY KEY, artist_id INTEGER, title TEXT, FOREIGN KEY(artist_id) REFERENCES artist(id));

INSERT INTO ext.artist VALUES (1, 'Alice'), (2, 'Bob');

INSERT INTO ext.album VALUES (100, 1, 'First Album'), (101, 2, 'Second Album');

CREATE TABLE ext.track(id INTEGER PRIMARY KEY, album_id INTEGER, artist_id INTEGER, title TEXT, FOREIGN KEY(album_id) REFERENCES album(id), FOREIGN KEY(artist_id) REFERENCES artist(id));

INSERT INTO ext.track VALUES (1000, 100, 1, 'Track One'), (1001, 101, 2, 'Track Two');

CREATE TABLE main_table(id INTEGER PRIMARY KEY);

DROP TABLE ext.track;

DROP TABLE ext.album;

DROP TABLE ext.artist;

DETACH ext;

CREATE TABLE dummy.tbl(i INTEGER);

DETACH dummy;

FROM dummy.tbl;

ATTACH ':memory:' AS hidden_db (HIDDEN true);

SELECT database_name FROM duckdb_databases() WHERE database_name = 'hidden_db';

SELECT database_name FROM duckdb_tables() WHERE database_name = 'hidden_db';

SELECT database_name FROM pragma_database_size() WHERE database_name = 'hidden_db';

CREATE TABLE hidden_db.main.tbl AS SELECT 42 AS i;

SELECT * FROM hidden_db.main.tbl;

ATTACH ':memory:' AS shown_db;

CREATE TABLE shown_db.main.shown_tbl AS SELECT 42 AS i;

DETACH shown_db;

DETACH hidden_db;

CREATE TABLE s1.integers AS FROM range(10) t(i);

SELECT SUM(i) FROM s1.integers;

DETACH s1;

ATTACH '~/home_dir.db' AS s1;

SELECT * FROM db.strings;

SELECT * FROM db.strings ORDER BY 1;

ATTACH IF NOT EXISTS ':memory:' AS db1;

USE attach_index_db;

CREATE TABLE tbl_a (
	a_id INTEGER PRIMARY KEY,
	value VARCHAR NOT NULL
);

CREATE INDEX idx_tbl_a ON tbl_a (value);

INSERT INTO tbl_a VALUES (1, 'x');

INSERT INTO tbl_a VALUES (2, 'y');

SELECT * FROM tbl_a WHERE a_id = 2;

USE other_attach_index;

DETACH attach_index_db;

SELECT * FROM attach_index_db.tbl_a WHERE a_id = 2;

create table mytable (C1 VARCHAR(10));

insert into mytable values ('a');

create table TOMERGE.mytable (C1 VARCHAR(10));

insert into TOMERGE.mytable SELECT * FROM mytable;

select * from TOMERGE.mytable;

attach ':memory:' as test;

use test;

create schema schema1;

create table schema1.table1 as select 1 as a;

set schema='schema1';

select * from table1;

detach test;

ATTACH ':memory:' AS memdb;

DETACH memdb;

ATTACH lower(':MEMORY:') AS memdb;

create table tbl1 as select 1 as a;

FROM test.tbl1;

FROM tbl1;

CREATE TABLE db1.tbl AS SELECT 42 AS x, 3 AS y;

CREATE MACRO db1.two_x_plus_y(x, y) AS 2 * x + y;

SELECT db1.two_x_plus_y(x, y) FROM db1.tbl;

SELECT db1.main.two_x_plus_y(x, y) FROM db1.tbl;

SELECT two_x_plus_y(x, y) FROM db1.tbl;

SELECT 42;

ATTACH DATABASE ':memory:' AS database;

CREATE TABLE database.integers(i INTEGER);

CREATE TABLE integers(i INTEGER);

INSERT INTO database.integers SELECT * FROM range(10);

INSERT INTO integers SELECT * FROM range(10);

CREATE TEMP TABLE tmp AS SELECT * FROM range(3) t(i);

INSERT INTO database.integers SELECT * FROM tmp;

INSERT INTO tmp VALUES (3);

CREATE SCHEMA db1.s1;

CREATE SCHEMA db2.s1;

CREATE TABLE db1.s1.t(c INT);

CREATE TABLE db2.s1.t(c INT);

INSERT INTO db1.s1.t VALUES (42);

INSERT INTO db2.s1.t SELECT c * 2 FROM db1.s1.t;

SELECT * FROM db1.s1.t, db2.s1.t;

SELECT db1.t.c, db2.t.c FROM db1.s1.t, db2.s1.t;

SELECT db1.s1.t.c, db2.s1.t.c FROM db1.s1.t, db2.s1.t;

SELECT * EXCLUDE (db1.s1.t.c) FROM db1.s1.t, db2.s1.t;

SELECT * EXCLUDE (s1.t.c) FROM db1.s1.t, (SELECT 42) t;

SELECT * EXCLUDE (new_col) FROM (SELECT * RENAME (db1.s1.t.c AS new_col) FROM db1.s1.t, db2.s1.t);

SELECT * EXCLUDE (new_col) FROM (SELECT * RENAME (s1.t.c AS new_col) FROM db1.s1.t, (SELECT 42) t);

SELECT db1.s1.t, db2.s1.t FROM db1.s1.t, db2.s1.t;

SELECT db1.t, db2.t FROM db1.s1.t, db2.s1.t;

SELECT db1.s1.t.c FROM db1.s1.t, db2.s1.t;

CREATE OR REPLACE TABLE db1.s1.t (
	c INT,
	c_squared AS (c * c),
);

CREATE SCHEMA database.schema;

CREATE TABLE database.schema.table(col ROW(field INTEGER));

INSERT INTO database.schema.table VALUES ({'field': 42});

SELECT database.schema.table.col.field FROM database.schema.table;

SELECT database.schema.table.col FROM database.schema.table;

SELECT database.schema.table FROM database.schema.table;

USE database;

SELECT schema.table FROM database.schema.table;

SELECT "table" FROM database.schema.table;

USE database.schema;

SELECT "table" FROM "table";

SELECT schema.table FROM "table";

SELECT database.table FROM "table";

SELECT database.schema.table FROM "table";

SET force_compression='roaring';

CREATE TABLE db1.tbl AS SELECT CASE WHEN i%2=0 THEN NULL ELSE i END i FROM range(10000) t(i);

SET force_compression='zstd';

CREATE TABLE db1.str_tbl AS SELECT STRING_AGG('long_string_' || i, '-') FROM range(1000) t(i);

SELECT COUNT(*)>0 FROM pragma_storage_info('db1.tbl') WHERE compression='Roaring';

SELECT COUNT(*)>0 FROM pragma_storage_info('db1.str_tbl') WHERE compression='ZSTD';

CREATE TABLE db1.tbl2 AS FROM db1.tbl;

CREATE TABLE db1.str_tbl2 AS FROM db1.str_tbl;

SELECT COUNT(*)>0 FROM pragma_storage_info('db1.tbl2') WHERE compression='Roaring';

SELECT COUNT(*)>0 FROM pragma_storage_info('db1.str_tbl2') WHERE compression='ZSTD';

SET threads = 1;

CREATE TABLE no_wal_writes.tbl AS SELECT range AS id, 0 AS v FROM range(5_000);

UPDATE no_wal_writes.tbl SET v = id;

DETACH no_wal_writes;

SELECT COUNT(*) FROM no_wal_writes.tbl WHERE v = 0;

CHECKPOINT no_wal_writes;

CREATE TABLE db2.all_types_new AS SELECT * FROM test_all_types();

DETACH db2;

SELECT * FROM db1.all_types_new;

SELECT * FROM db2.all_types;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'db3';

CREATE TABLE persistent_attach.integers(i INTEGER);

INSERT INTO persistent_attach.integers VALUES (42);

SELECT SUM(i) FROM persistent_attach.integers;

DETACH persistent_attach;

CREATE OR REPLACE TABLE persistent.T1 (A0 int);

insert into persistent.T1 values (5);

SELECT column_name from pragma_storage_info('persistent.T1');

CREATE TABLE db1.integers AS SELECT range AS i FROM range(10000);

CREATE TABLE db1.strings AS SELECT 'v' || range::VARCHAR AS s FROM range(1000);

SELECT COUNT(*) FROM db1.integers;

SELECT SUM(i) FROM db1.integers;

SELECT COUNT(*) FROM db1.strings;

INSERT INTO db1.integers VALUES (10000);

SELECT a FROM c.file;

CREATE SCHEMA x;

CREATE VIEW x.t AS SELECT 'schema view' AS k;

CREATE TABLE x.main.t AS SELECT 'catalog table' AS k;

DROP SCHEMA x CASCADE;

CREATE TABLE x.t AS SELECT 'schema table' AS k;

SET default_transaction_invalidation_policy='ALL_ERRORS_INVALIDATE_TRANSACTION';

CREATE TABLE u(k INTEGER);

INSERT INTO u VALUES (1);

DROP TABLE u;

CREATE SCHEMA x.s;

CREATE TABLE x.main.t AS SELECT 1 AS k;

CREATE TABLE x.s.t AS SELECT 2 AS k;

SET search_path = 'x.s';

SELECT * FROM x.t;

RESET search_path;

CREATE TABLE db1.integers AS SELECT * FROM range(10) t(i);

CREATE TABLE db2.integers AS SELECT * FROM db1.integers;

SELECT SUM(i) FROM db2.integers;

SELECT SUM(i) FROM integers;

ATTACH ':memory:' AS db1 (READ_WRITE);

CREATE TABLE db1.test AS SELECT * FROM integers;

INSERT INTO db1.integers VALUES (42);

BEGIN TRANSACTION READ ONLY;

FROM db1.integers;

CALL enable_logging('HTTP');

ATTACH 'https://blobs.duckdb.org/databases/stations.duckdb' AS stations (READ_ONLY);

SELECT count(*) FROM stations.stations;

SELECT count(*) > 1 FROM duckdb_logs_parsed('HTTP') WHERE request.type = 'GET';

DETACH stations;

CREATE TABLE wal_writes.tbl AS SELECT range AS id, 0 AS v FROM range(5_000);

DETACH wal_writes;

INSERT INTO wal_writes.tbl VALUES (42, 42);

CHECKPOINT wal_writes;

UPDATE wal_writes.tbl SET v = id;

CREATE TABLE temp_db.integers(i INTEGER);

DETACH temp_db;

CREATE TABLE system_db.integers(i INTEGER);

DETACH system_db;

CREATE TABLE db1.tbl AS FROM range(10000) t(i);

INSERT INTO db1.tbl FROM range(10000);

CREATE TABLE test.data (key BIGINT PRIMARY KEY);

INSERT INTO test.data SELECT * FROM range(8190);

SELECT COUNT(DISTINCT row_group_id) FROM pragma_storage_info('test.data');

INSERT INTO test.data VALUES(8190), (8191);

SELECT row_group_id, SUM(count) FROM pragma_storage_info('test.data') where segment_type != 'VALIDITY' GROUP BY (row_group_id) ORDER BY row_group_id;

CREATE SCHEMA new_database.s1;

CREATE SEQUENCE seq;

CREATE SEQUENCE db1.seq;

CREATE TABLE db1.integers(i INTEGER DEFAULT nextval('db1.seq'));

SELECT nextval('db1.seq');

SELECT nextval('seq');

set storage_compatibility_version='latest';

CREATE TABLE A (A1 INTEGER PRIMARY KEY,A2 VARCHAR, A3 INTEGER);

CREATE INDEX A_index ON A (A2);

CREATE TABLE B(B1 INTEGER REFERENCES A(A1));

USE db1_other;

SET wal_autocheckpoint='1TB';

CREATE TABLE tbl(a INTEGER);

CREATE TABLE new_database.tbl(b INTEGER);

CREATE TABLE new_database.s1.tbl(c INTEGER);

SHOW ALL TABLES;

SHOW ALL;

DESCRIBE ALL;

DESC ALL;

DESCRIBE ALL TABLES;

CREATE TABLE db1.table_in_db1(i int);

CREATE TABLE db2.table_in_db2(i int);

CREATE SCHEMA db2.test_schema;

CREATE TABLE db2.test_schema.table_in_db2_test_schema(i int);

SHOW TABLES;

USE db2.test_schema;

FROM table_in_db2;

FROM table_in_db2_test_schema;

SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name='version_1_2_0';

DETACH version_1_2_0;

set storage_compatibility_version='v0.10.2';

CREATE TABLE default_version.tbl(i VARCHAR);

SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name='default_version';

DETACH default_version;

SET force_compression = 'zstd';

INSERT INTO default_version.tbl VALUES ('abcd'), ('efgh'), ('hello'), ('world'), (NULL);

CHECKPOINT default_version;

FROM default_version.tbl;

SET storage_compatibility_version = 'v1.2.0';

SELECT tags['storage_version'] FROM duckdb_databases() WHERE database_name='modified_default_setting';

CREATE TABLE test.tbl(i INTEGER PRIMARY KEY);

select constraint_catalog, table_catalog, table_name from information_schema.table_constraints limit 1;

CREATE TABLE new_database.integers(i INTEGER);

PRAGMA table_info('new_database.integers');

CREATE SCHEMA new_database.new_schema;

CREATE TABLE new_database.new_schema.integers(i INTEGER);

PRAGMA table_info('new_database.new_schema.integers');

USE new_database.new_schema;

PRAGMA table_info('integers');

SET VARIABLE server_uri = (SELECT concat('''', listen_uri, '''') FROM quack_serve('quack:localhost:0', token='test_token'));

CREATE MACRO qk_create(p) AS TABLE SELECT MAP {'id': 'q1'} AS handle;

CREATE MACRO qk_destroy(h) AS TABLE SELECT 'destroyed' AS status;

CALL register_external_resource_type('quack@local', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status', destroy_function := 'qk_destroy');

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quack@local' AS qk;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'qk';

DETACH qk;

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quack@local' (INSTANCE 'r7i.16xlarge', REGION 'eu-west-1', SPOT, ANYTHING 'else') AS qk2;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'qk2';

DETACH qk2;

CREATE EXTERNAL RESOURCE 'quack@local' AS shared_res;

ATTACH TO EXTERNAL RESOURCE shared_res AS qk3;

DETACH qk3;

SELECT count(*) FROM duckdb_external_resources() WHERE name = 'shared_res';

DESTROY EXTERNAL RESOURCE shared_res;

CREATE MACRO qk_status_null(h) AS TABLE
  SELECT 'ready' AS state, MAP {'uri': NULL, 'attached_db_type': 'quack'} AS result;

CALL register_external_resource_type('quacknull@local', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status_null', destroy_function := 'qk_destroy');

CONNECT TO NEW TEMPORARY EXTERNAL RESOURCE 'quack@local';

DISCONNECT;

CREATE MACRO qk_destroy_fail(h) AS TABLE SELECT CAST('boom' AS INTEGER) AS x;

CALL register_external_resource_type('quackfail@local', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status', destroy_function := 'qk_destroy_fail');

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackfail@local' AS qkf;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'qkf';

CREATE TABLE victim(x INTEGER);

CALL register_external_resource_type('quackinj@local', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status', destroy_function := 'qk_destroy(1); DROP TABLE victim; --');

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackinj@local' AS qki;

SELECT count(*) FROM duckdb_tables() WHERE table_name = 'victim';

CREATE SEQUENCE destroy_seq;

CREATE MACRO qk_destroy_count(h) AS TABLE SELECT nextval('destroy_seq') AS status;

CALL register_external_resource_type('quackcount@local', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status', destroy_function := 'qk_destroy_count');

ATTACH ':memory:' AS taken;

SELECT currval('destroy_seq');

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackcount@local' AS qkr;

ATTACH OR REPLACE ':memory:' AS qkr;

DETACH qkr;

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackfail@local' AS qkr2;

ATTACH OR REPLACE ':memory:' AS qkr2;

DETACH qkr2;

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackcount@local' AS qtx;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'qtx';

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quackcount@local' AS qtx2;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'qtx2';

DETACH qtx2;

CREATE TABLE attach_transaction.integers(i INTEGER);

INSERT INTO attach_transaction.integers VALUES (42);

DETACH attach_transaction;

INSERT INTO attach_transaction.integers VALUES (84);

SELECT * FROM attach_transaction.integers;

SELECT * FROM attach_transaction.integers ORDER BY 1;

INSERT INTO attach_transaction.integers VALUES (126);

attach ':memory:' as mem;

use mem;

CREATE SCHEMA db2.s2;

ATTACH ':memory:' AS "my db";

ATTACH ':memory:' AS "it's";

ATTACH ':memory:' AS db3;

USE 'db2';

SELECT current_catalog(), current_schema();

USE 's2';

USE 'db3';

USE "db2";

USE "db2"."s2";

USE 'my db';

USE "it's";

USE 'it''s';

USE 'my"db';

USE view_search_path;

CREATE TABLE my_tbl(i INTEGER);

INSERT INTO my_tbl VALUES (42);

CREATE VIEW my_view AS FROM my_tbl;

FROM my_view;

CREATE SCHEMA my_schema;

USE my_schema;

INSERT INTO my_tbl VALUES (84);

USE view_search_path_other;

FROM view_search_path.my_view;

FROM view_search_path.my_schema.my_view;

DETACH view_search_path;

CREATE TABLE t1 AS SELECT 42 i;

ATTACH (CASE WHEN random() < 2 THEN ':memory:' END) AS volatile_db;

CREATE TABLE volatile_db.t AS SELECT 42 AS i;

SELECT i FROM volatile_db.t;

DETACH volatile_db;

ATTACH ':memory:' AS volatile_opt (BLOCK_SIZE (262144 + (random() * 0)::INTEGER));

DETACH volatile_opt;

CREATE TABLE t2(c1 INT);

CHECKPOINT;

ALTER TABLE t2 ALTER c1 SET DEFAULT 0;

INSERT INTO db1.t2 DEFAULT VALUES;

SELECT * FROM db1.t2;

CREATE TABLE db1.test (a INTEGER DEFAULT nextval('seq'), b INTEGER, c INTEGER DEFAULT currval('seq'));

INSERT INTO db1.test (b) VALUES (1);

alter table db1.test RENAME TO blubb;

INSERT INTO db1.blubb (b) VALUES (10);

SELECT * FROM db1.blubb;

INSERT INTO db2.blubb (b) VALUES (100);

SELECT * FROM db2.blubb;

ATTACH DATABASE ':memory:' AS varchar;

DETACH varchar;

USE other;

DETACH memory;

SELECT database_name FROM duckdb_databases() WHERE database_name = 'other';

CALL enable_logging('ExternalResource', storage='memory');

CREATE TABLE seed.t AS SELECT 42 AS x;

DETACH seed;

CREATE MACRO t_create(p) AS TABLE SELECT MAP {'id': 't1'} AS handle;

CREATE MACRO t_destroy(h) AS TABLE SELECT nextval('destroy_seq') AS status;

CALL register_external_resource_type('taken@local', kind := 'catalog', create_function := 't_create',
    status_function := 't_status', destroy_function := 't_destroy');

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'blocked';

SELECT operation, outcome FROM duckdb_logs_parsed('ExternalResource') ORDER BY timestamp;

DETACH holder;

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'taken@local' AS ok_now;

SELECT x FROM ok_now.t;

DETACH ok_now;

CALL register_external_resource_type('badopt@local', kind := 'catalog', create_function := 't_create',
    status_function := 'bad_status', destroy_function := 't_destroy');

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'rejected';

CREATE EXTERNAL RESOURCE 'taken@local' AS shared;

ATTACH TO EXTERNAL RESOURCE shared AS b1 (READ_ONLY);

ATTACH TO EXTERNAL RESOURCE shared AS b2 (READ_ONLY);

ATTACH ':memory:' AS unrelated;

SELECT count(*) FROM duckdb_databases() WHERE database_name IN ('b1', 'b2', 'unrelated');

DESTROY EXTERNAL RESOURCE shared;

SELECT count(*) FILTER (database_name IN ('b1', 'b2')), count(*) FILTER (database_name = 'unrelated')
FROM duckdb_databases();

CREATE EXTERNAL RESOURCE 'taken@local' AS borrowed;

ATTACH ':memory:' AS occupied;

SELECT count(*) FROM duckdb_logs_parsed('ExternalResource') WHERE operation = 'destroy';

SELECT count(*) FROM duckdb_external_resources() WHERE name = 'borrowed';

ATTACH TO EXTERNAL RESOURCE borrowed AS still_works (READ_ONLY);

SELECT x FROM still_works.t;

DETACH still_works;

DESTROY EXTERNAL RESOURCE borrowed;

CREATE MACRO qk_status(h) AS TABLE
  SELECT 'ready' AS state, MAP {'uri': 'localhost', 'attached_db_type': 'quack'} AS result;

CREATE MACRO qk_list(p) AS TABLE
  SELECT * FROM (VALUES
    (MAP {'id': 'q1'}, 'quack-one', 'ref-q1', 'running'),
    (MAP {'id': 'q2'}, 'quack-two', 'ref-q2', 'running')
  ) t(handle, name, reference, state);

CALL register_external_resource_type('quack@disco', kind := 'catalog', create_function := 'qk_create',
    status_function := 'qk_status', list_function := 'qk_list');

SELECT name, list_function FROM duckdb_external_resource_types() WHERE name = 'quack@disco';

CREATE EXTERNAL RESOURCE 'quack@disco' AS mine;

SELECT name, type, managed FROM duckdb_external_resources() ORDER BY name;

SELECT name, type, managed, state FROM duckdb_external_resources(discover := true) ORDER BY managed DESC, reference;

SELECT reference, state FROM duckdb_external_resources(discover := true) WHERE managed = false;

CREATE SEQUENCE create_calls;

CREATE MACRO mock_create(p) AS TABLE SELECT MAP {'id': 'r' || nextval('create_calls')} AS handle;

CREATE MACRO mock_status(h) AS TABLE
  SELECT 'ready' AS state, MAP {'uri': 'quack:localhost:9494', 'attached_db_type': 'quack', 'token': 't1'} AS result;

CREATE MACRO mock_destroy(h) AS TABLE SELECT 'ok' AS status;

CALL register_external_resource_type('mock@local', kind := 'catalog', create_function := 'mock_create',
    status_function := 'mock_status', destroy_function := 'mock_destroy');

SET enable_external_access = false;

SELECT last_value IS NULL FROM duckdb_sequences() WHERE sequence_name = 'create_calls';

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'res';

SELECT count(*) FROM duckdb_external_resources();

CREATE MACRO qk_destroy(h) AS TABLE SELECT 'gone' AS status;

CREATE EXTERNAL RESOURCE 'quack@local' AS beefy;

DESTROY EXTERNAL RESOURCE beefy;

REGISTER EXTERNAL RESOURCE 'quack@local' AS adopted FROM MAP {'id': 'q1'};

DESTROY EXTERNAL RESOURCE adopted;

SELECT resource_name, outcome FROM duckdb_logs_parsed('ExternalResource')
WHERE operation = 'destroy' ORDER BY timestamp;

CREATE EXTERNAL RESOURCE 'quack@local' AS r1;

CREATE EXTERNAL RESOURCE 'quack@local' AS r2;

DESTROY EXTERNAL RESOURCE r1;

SELECT name FROM duckdb_external_resources() ORDER BY name;

SHOW EXTERNAL RESOURCES;

SELECT name, type, managed FROM duckdb_external_resources(discover := true) ORDER BY name;

DESTROY EXTERNAL RESOURCE r2;

CREATE EXTERNAL RESOURCE 'quack@local' AS shared;

ATTACH TO EXTERNAL RESOURCE shared AS borrow1;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'borrow1';

DETACH borrow1;

SELECT count(*) FROM duckdb_external_resources() WHERE name = 'shared';

ATTACH TO EXTERNAL RESOURCE shared AS borrow2;

DETACH borrow2;

CREATE EXTERNAL RESOURCE 'quack@local' AS busy;

ATTACH TO EXTERNAL RESOURCE busy AS still_here1;

ATTACH TO EXTERNAL RESOURCE busy AS still_here2;

CREATE EXTERNAL RESOURCE 'quack@local' AS bystander;

ATTACH TO EXTERNAL RESOURCE bystander AS untouched;

DESTROY EXTERNAL RESOURCE busy;

SELECT count(*) FROM duckdb_databases() WHERE database_name IN ('still_here1', 'still_here2');

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'untouched';

DESTROY EXTERNAL RESOURCE bystander;

CREATE EXTERNAL RESOURCE 'quack@local' AS pinned;

ATTACH TO EXTERNAL RESOURCE pinned AS in_use;

USE in_use;

DESTROY EXTERNAL RESOURCE pinned;

SELECT count(*) FROM duckdb_external_resources() WHERE name = 'pinned';

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'in_use';

ATTACH ':memory:' AS scratch;

USE scratch;

DETACH in_use;

CREATE EXTERNAL RESOURCE 'quack@local' AS yoooo;

DESTROY EXTERNAL RESOURCE yoooo;

SELECT operation, outcome, coalesce(resource_type, '<null>'), coalesce(resource_name, '<null>'),
       coalesce(error, '<null>'), extra_info['state']
FROM duckdb_logs_parsed('ExternalResource')
ORDER BY timestamp;

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quack@local' AS anon;

DETACH anon;

SELECT operation, resource_name FROM duckdb_logs_parsed('ExternalResource') ORDER BY timestamp;

SELECT operation, resource_name IS NULL FROM duckdb_logs_parsed('ExternalResource') ORDER BY timestamp;

CREATE MACRO qk_create_fail(p) AS TABLE SELECT CAST('boom' AS INTEGER) AS handle;

CALL register_external_resource_type('quackfail@local', kind := 'catalog', create_function := 'qk_create_fail',
    status_function := 'qk_status', destroy_function := 'qk_destroy');

SELECT operation, outcome, error IS NOT NULL
FROM duckdb_logs_parsed('ExternalResource')
WHERE resource_type = 'quackfail@local';

CREATE MACRO nouri_status(h) AS TABLE SELECT 'ready' AS state, MAP {'foo': 'bar'} AS result;

CALL register_external_resource_type('nouri@local', kind := 'compute', create_function := 'qk_create',
    status_function := 'nouri_status', destroy_function := 'qk_destroy');

ATTACH TO NEW TEMPORARY EXTERNAL RESOURCE 'quack@local' AS repl_db;

ATTACH OR REPLACE ':memory:' AS repl_db;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'repl_db';

CREATE SEQUENCE cseq;

CREATE SEQUENCE dseq;

CREATE MACRO c1(p) AS TABLE SELECT CASE WHEN nextval('cseq') > 0 THEN NULL::MAP(VARCHAR, VARCHAR) END AS handle;

CREATE MACRO d1(h) AS TABLE SELECT nextval('dseq') AS status;

CREATE MACRO s1(h) AS TABLE SELECT 'ready' AS state, MAP {'uri': ':memory:', 'attached_db_type': 'duckdb'} AS result;

CALL register_external_resource_type('t', kind := 'catalog', create_function := 'c1', status_function := 's1', destroy_function := 'd1');

SELECT count(*) FROM duckdb_external_resources() WHERE name IN ('r', 'n1');

CREATE MACRO c_create(p) AS TABLE SELECT MAP {'id': 'c1'} AS handle;

CREATE MACRO c_destroy(h) AS TABLE SELECT nextval('destroy_seq') AS status;

CALL register_external_resource_type('ro@local', kind := 'catalog', create_function := 'c_create',
    status_function := 'ro_status', destroy_function := 'c_destroy');

CREATE EXTERNAL RESOURCE 'ro@local' AS pinned_ro;

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'b1';

DESTROY EXTERNAL RESOURCE pinned_ro;

CALL register_external_resource_type('null@local', kind := 'catalog', create_function := 'c_create',
    status_function := 'null_status', destroy_function := 'c_destroy');

SELECT count(*) FROM duckdb_databases() WHERE database_name = 'nulled';

CALL register_external_resource_type('plain@local', kind := 'catalog', create_function := 'c_create',
    status_function := 'plain_status', destroy_function := 'c_destroy');

CREATE EXTERNAL RESOURCE 'plain@local' AS shared;

SELECT (SELECT x FROM b1.t), (SELECT x FROM b2.t);

SELECT count(*), bool_and(readonly) FROM duckdb_databases() WHERE database_name IN ('b1', 'b2');

SELECT count(*) FROM duckdb_databases() WHERE database_name IN ('b1', 'b2');

CREATE MACRO list_s(opts) AS TABLE
    SELECT MAP {'id': 'ext-1'} AS handle, 'ext-name' AS name, 'ext-ref' AS reference, 'running' AS state;

CALL register_external_resource_type('a@sq', kind := 'catalog', create_function := 'noop_create', list_function := 'list_s');

CALL register_external_resource('a@sq', 'mine', MAP {'id': 'local-1'});

SHOW ALL EXTERNAL RESOURCES;

SELECT name, managed FROM (SHOW ALL EXTERNAL RESOURCES);

SELECT count(*) FROM (SHOW EXTERNAL RESOURCES);

FROM (SHOW ALL EXTERNAL RESOURCES) SELECT type, state WHERE NOT managed;

FROM (SHOW ALL EXTERNAL RESOURCES) SELECT handle['id'] WHERE managed;

WITH r AS (SHOW ALL EXTERNAL RESOURCES)
SELECT r.type, t.name FROM r JOIN duckdb_external_resource_types() t ON t.name = r.type;

SELECT count(*) FROM ((SHOW ALL EXTERNAL RESOURCES) UNION ALL (SHOW EXTERNAL RESOURCES));

SELECT name FROM (SHOW ALL EXTERNAL RESOURCES) ORDER BY 1 LIMIT 1;

(SHOW EXTERNAL RESOURCES);

CREATE TABLE external (i INTEGER);

SELECT count(*) FROM (SHOW external);

SHOW EXTERNAL RESOURCE TYPES;

CALL register_external_resource_type('a@st', kind := 'catalog', create_function := 'a_create',
    status_function := 'a_status', destroy_function := 'a_destroy', resolve_function := 'a_resolve',
    list_function := 'a_list');

CALL register_external_resource_type('b@st', kind := 'storage', create_function := 'b_create');

SELECT * FROM duckdb_external_resource_types();

SELECT name, kind FROM (SHOW EXTERNAL RESOURCE TYPES);

SELECT name FROM (SHOW EXTERNAL RESOURCE TYPES) WHERE list_function IS NOT NULL;

FROM (SHOW EXTERNAL RESOURCE TYPES) SELECT create_function WHERE kind = 'storage';

CALL register_external_resource('b@st', 'mine', MAP {'id': 'local-1'});

WITH t AS (SHOW EXTERNAL RESOURCE TYPES)
SELECT t.name, r.name FROM t JOIN (SHOW EXTERNAL RESOURCES) r ON r.type = t.name;

SELECT count(*) FROM ((SHOW EXTERNAL RESOURCE TYPES) UNION ALL (SHOW EXTERNAL RESOURCE TYPES));

SELECT name FROM (SHOW EXTERNAL RESOURCE TYPES) ORDER BY name DESC LIMIT 1;

SELECT count(*) FROM ((SHOW EXTERNAL RESOURCE TYPES));

CREATE SEQUENCE calls_a;

CREATE SEQUENCE calls_b;

CREATE MACRO list_a(opts) AS TABLE
    SELECT MAP {'id': 'a' || nextval('calls_a')::VARCHAR} AS handle, 'bucket-a' AS name, 'a-ref' AS reference, 'running' AS state;

CREATE MACRO list_b(opts) AS TABLE
    SELECT MAP {'id': 'b' || nextval('calls_b')::VARCHAR} AS handle, 'bucket-b' AS name, 'b-ref' AS reference, 'running' AS state;

CALL register_external_resource_type('a@st', kind := 'catalog', create_function := 'noop_create', list_function := 'list_a');

CALL register_external_resource_type('b@st', kind := 'catalog', create_function := 'noop_create', list_function := 'list_b');

CALL register_external_resource('a@st', 'local_a', MAP {'id': 'x'});

SELECT nextval('calls_a'), nextval('calls_b');

SELECT count(*) FROM (SHOW ALL EXTERNAL RESOURCES);

SELECT currval('calls_a'), currval('calls_b');

SHOW ALL EXTERNAL RESOURCES WITH TYPE 'a@st';

SHOW ALL EXTERNAL RESOURCES WITH TYPE 'b@st';

SELECT count(*) FROM (SHOW ALL EXTERNAL RESOURCES WITH TYPE 'a@st');

SHOW EXTERNAL RESOURCES WITH TYPE 'a@st';

SHOW EXTERNAL RESOURCES WITH TYPE 'b@st';

SHOW EXTERNAL RESOURCES WITH TYPE 'none@st';

CALL register_external_resource('orphan@st', 'kept', MAP {'id': 'o'});

SHOW ALL EXTERNAL RESOURCES WITH TYPE 'orphan@st';

CALL register_external_resource('it''s@st', 'quoted', MAP {'id': 'q'});

SHOW EXTERNAL RESOURCES WITH TYPE 'it''s@st';

SHOW EXTERNAL RESOURCES WITH TYPE '%@st';

CALL register_external_resource('plain', 'bare', MAP {'id': 'p'});

SHOW EXTERNAL RESOURCES WITH TYPE plain;

SHOW EXTERNAL RESOURCES WITH TYPE "it's@st";

CREATE TABLE t(i INTEGER);

SET autoload_known_extensions = false;

SET autoinstall_known_extensions = false;

SELECT * FROM duckdb_external_resources(type := 'aws:cloudformation:quack-on-ec2');

SET autoload_known_extensions = true;

SET autoinstall_known_extensions = true;

CREATE MACRO dt_create(p) AS TABLE SELECT MAP {'id': 'd1'} AS handle;

CREATE MACRO dt_status(h) AS TABLE SELECT 'ready' AS state, MAP {'uri': 'memory:', 'attached_db_type': 'duckdb'} AS result;

CREATE MACRO dt_destroy(h) AS TABLE SELECT 'gone' AS status;

CALL register_external_resource_type('test.dotted.type', kind := 'catalog', create_function := 'dt_create',
    status_function := 'dt_status', destroy_function := 'dt_destroy');

CREATE EXTERNAL RESOURCE test.dotted.type AS created;

REGISTER EXTERNAL RESOURCE TEST.Dotted.Type AS registered FROM MAP {'id': 'd2'};

SELECT name, type FROM (SHOW EXTERNAL RESOURCES WITH TYPE test.dotted.type);

SELECT name, type FROM (SHOW EXTERNAL RESOURCES WITH TYPE 'test.dotted.type');

DESTROY EXTERNAL RESOURCE created;

DESTROY EXTERNAL RESOURCE registered;

INSERT INTO new_database.integers VALUES (42);

INSERT INTO new_database.main.integers VALUES (84);

SELECT * FROM new_database.integers ORDER BY i;

SELECT * FROM new_database.main.integers ORDER BY i;

SELECT * FROM new_database.integers ORDER BY new_database.integers.i;

SELECT * FROM new_database.main.integers ORDER BY new_database.main.integers.i;

CREATE SCHEMA new_db.my_schema;

CREATE TABLE new_db.my_schema.my_table(col INTEGER);

INSERT INTO new_db.my_schema.my_table VALUES (42);

CREATE VIEW new_db.my_schema.my_view AS SELECT 84;

CREATE SEQUENCE new_db.my_schema.my_sequence;

CREATE MACRO new_db.my_schema.one() AS (SELECT 1);

CREATE MACRO new_db.my_schema.range(a) as TABLE SELECT * FROM system.main.range(a);

SELECT new_db.my_schema.one();

SELECT * FROM new_db.my_schema.range(3);

DETACH new_db;

SELECT * FROM new_name.my_schema.my_table;

SELECT * FROM new_name.my_schema.my_view;

SELECT nextval('new_name.my_schema.my_sequence');

SELECT new_name.my_schema.one();

SELECT * FROM new_name.my_schema.range(3);

USE new_name.my_schema;

SELECT * FROM my_table;

SELECT * FROM my_view;

SELECT nextval('my_sequence');

SELECT one();

SELECT * FROM range(3);

CREATE MACRO recursive_range(a) AS TABLE SELECT * FROM system.main.range(a);

CREATE OR REPLACE MACRO recursive_range(a) AS TABLE SELECT * FROM recursive_range(a);

ATTACH ':memory:' AS view_path_c1;

CREATE SCHEMA view_path_c1.s1;

CREATE MACRO view_path_c1.main.fn() AS 1;

ATTACH ':memory:' AS view_path_c2;

CREATE MACRO view_path_c2.main.fn() AS 'caller';

SET search_path = 'view_path_c2.main';

CREATE VIEW view_path_c1.s1.v AS SELECT fn() AS result;

SELECT data_type
FROM duckdb_columns()
WHERE database_name = 'view_path_c1'
  AND schema_name = 's1'
  AND table_name = 'v'
  AND column_name = 'result';

FROM view_path_c1.s1.v;

DETACH view_path_c2;

DETACH view_path_c1;

CREATE MACRO view_path_c2.main.fn() AS 2;

ATTACH ':memory:' AS dt (DEFAULT_TABLE 'real_t');

CREATE TABLE dt.main.real_t(i INT);

INSERT INTO dt.main.real_t values (1);

ATTACH ':memory:' AS c1;

CREATE SCHEMA c1.s1;

CREATE TABLE c1.main.dt(i INT);

CREATE VIEW c1.s1.vv AS SELECT * FROM dt;

FROM c1.s1.vv;

DETACH dt;

CREATE TYPE my_enum AS ENUM ('x');

ATTACH ':memory:' AS c2;

CREATE SCHEMA c2.s1;

CREATE TYPE c2.my_enum AS ENUM ('y');

CREATE TABLE c2.s1.t(a VARCHAR);

INSERT INTO c2.s1.t VALUES ('x');

ALTER TABLE c2.s1.t ALTER COLUMN a SET DATA TYPE my_enum;

FROM c2.s1.t;

DETACH c2;

ATTACH ':memory:' as test2;

CREATE OR REPLACE MACRO fn(a) as a+1;

CREATE SCHEMA other_schema;

CREATE VIEW other_schema.some_view AS SELECT fn(1) AS t;

use test2;

from test.other_schema.some_view;

SHOW DATABASES;

SELECT name FROM pragma_database_list ORDER BY name;

USE new_database;

CREATE TABLE tbl AS SELECT 42 i;

SELECT * FROM new_database.tbl;

SHOW SCHEMAS;

CREATE SCHEMA new_s1;

CREATE SCHEMA new_s2;

CREATE SCHEMA memory.mem_s1;

USE new_database.new_s2;

DROP SCHEMA new_database.new_s2;

DESCRIBE SCHEMAS;
