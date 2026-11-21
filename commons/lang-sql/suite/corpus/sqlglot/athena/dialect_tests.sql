SELECT '\d+';

SELECT 'foo''bar';

SELECT '\';

SELECT * FROM t WHERE name LIKE 'a\_%' ESCAPE '\';

CREATE TABLE IF NOT EXISTS t (name STRING) LOCATION 's3://bucket/tmp/mytable/' TBLPROPERTIES ('table_type'='iceberg', 'FORMAT'='parquet');

UNLOAD (SELECT name1, address1, comment1, key1 FROM table1) TO 's3://amzn-s3-demo-bucket/ partitioned/' WITH (format = 'TEXTFILE', partitioned_by = ARRAY['key1']);

/* leading comment */CREATE SCHEMA foo;

/* leading comment */ CREATE SCHEMA `foo`;

/* leading comment */SELECT * FROM foo;

/* leading comment */ SELECT * FROM "foo";

MSCK REPAIR TABLE foo;

CREATE DATABASE foo COMMENT "a\"b";

CREATE DATABASE foo COMMENT 'a"b';

CREATE EXTERNAL TABLE foo (id INT) COMMENT 'test comment';

CREATE EXTERNAL TABLE george.t (id INT COMMENT 'foo \\ bar') LOCATION 's3://my-bucket/';

CREATE EXTERNAL TABLE my_table (id BIGINT COMMENT 'this is the row\'s id') LOCATION 's3://my-s3-bucket';

CREATE EXTERNAL TABLE foo (id INT, val STRING) CLUSTERED BY (id, val) INTO 10 BUCKETS;

CREATE EXTERNAL TABLE foo (id INT, val STRING) STORED AS PARQUET LOCATION 's3://foo' TBLPROPERTIES ('has_encryped_data'='true', 'classification'='test');

CREATE EXTERNAL TABLE IF NOT EXISTS foo (a INT, b STRING) ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe' WITH SERDEPROPERTIES ('case.insensitive'='FALSE') LOCATION 's3://table/path';

CREATE EXTERNAL TABLE x (y INT) ROW FORMAT SERDE 'serde' ROW FORMAT DELIMITED FIELDS TERMINATED BY '1' WITH SERDEPROPERTIES ('input.regex'='');

CREATE EXTERNAL TABLE `my_table` (`a7` ARRAY<DATE>) ROW FORMAT SERDE 'a' STORED AS INPUTFORMAT 'b' OUTPUTFORMAT 'c' LOCATION 'd' TBLPROPERTIES ('e'='f');

CREATE TABLE iceberg_table (`id` BIGINT, `data` STRING, category STRING) PARTITIONED BY (category, BUCKET(16, id)) LOCATION 's3://amzn-s3-demo-bucket/your-folder/' TBLPROPERTIES ('table_type'='ICEBERG', 'write_compression'='snappy');

CREATE OR REPLACE TABLE iceberg_table (`id` BIGINT, `data` STRING, category STRING) PARTITIONED BY (category, BUCKET(16, id)) LOCATION 's3://amzn-s3-demo-bucket/your-folder/' TBLPROPERTIES ('table_type'='ICEBERG', 'write_compression'='snappy');

CREATE TABLE foo WITH (table_type='ICEBERG', location='s3://foo/', format='orc', partitioning=ARRAY['bucket(id, 5)']) AS SELECT * FROM a;

CREATE TABLE foo WITH (table_type='HIVE', external_location='s3://foo/', format='parquet', partitioned_by=ARRAY['ds']) AS SELECT * FROM a;

CREATE TABLE foo AS WITH foo AS (SELECT a, b FROM bar) SELECT * FROM foo;

ALTER TABLE `foo`.`bar` ADD COLUMN `end_ts` BIGINT;

ALTER TABLE `foo`.`bar` ADD COLUMNS (`end_ts` BIGINT);

ALTER TABLE `foo` DROP COLUMN `id`;

SELECT CAST(ds AS VARCHAR) AS ds FROM (VALUES ('2022-01-01')) AS t(ds);

CREATE SCHEMA `foo`;

CREATE SCHEMA foo;

CREATE EXTERNAL TABLE `foo` (`id` INT) LOCATION 's3://foo/';

CREATE EXTERNAL TABLE foo (id INT) LOCATION 's3://foo/';

CREATE TABLE foo AS SELECT * FROM a;

CREATE TABLE "foo" AS SELECT * FROM "a";

DROP VIEW IF EXISTS "foo"."bar";

DROP TABLE `foo`;

DROP TABLE foo;

CREATE VIEW "foo" AS SELECT "id" FROM "tbl";

CREATE VIEW foo AS SELECT id FROM tbl;

CREATE SCHEMA "foo";

DROP TABLE "foo";

DESCRIBE foo.bar;

DESCRIBE `foo`.`bar`;

CREATE TABLE "foo" AS WITH "foo" AS (SELECT "a", "b" FROM "bar") SELECT * FROM "foo";

SELECT a AS foo FROM tbl;

SELECT "a" AS "foo" FROM "tbl";

INSERT INTO foo (id) VALUES (1);

INSERT INTO "foo" ("id") VALUES (1);

UPDATE foo SET id = 3 WHERE id = 7;

UPDATE "foo" SET "id" = 3 WHERE "id" = 7;

DELETE FROM foo WHERE id > 10;

DELETE FROM "foo" WHERE "id" > 10;

WITH foo AS (SELECT a, b FROM bar) SELECT * FROM foo;

WITH "foo" AS (SELECT "a", "b" FROM "bar") SELECT * FROM "foo";

CREATE TABLE t WITH (format='PARQUET') AS USING EXTERNAL FUNCTION f(x VARCHAR) RETURNS VARCHAR LAMBDA 'l' SELECT f('a') AS b;

CREATE TABLE t WITH (format='PARQUET') AS SELECT 1 AS a;

SELECT ARRAY_EXCEPT(ARRAY[1, 2, 3], ARRAY[2]);

SELECT array_position(array[1, 2, 3], 2);

SELECT * FROM (SELECT 1 AS col) apply;

SELECT U&'can''t';

SELECT U&'a
b';

CREATE TABLE test WITH (format='PARQUET') AS SELECT 1;

SELECT a FROM x LEFT JOIN UNNEST(y) AS t(a) ON TRUE;
