CREATE TABLE src ("Amount" INTEGER PRIMARY KEY, x INTEGER, y INTEGER);

CREATE VIEW v AS SELECT Amount AS amount, x AS X, y FROM src;

SELECT column_name, key FROM (DESCRIBE SELECT Amount AS amount, x AS X, y AS Y, x FROM src);

SELECT column_name FROM (DESCRIBE v);

SELECT column_name FROM (DESCRIBE SELECT * FROM src);

create table sometable (
	column1 varchar
);

insert into sometable values
	('abc');

create view someview as select
	rowid as table_rowid,
	*
from sometable;

select * from someview;

select column_name, column_type from (describe someview);

SELECT column_name FROM (DESCRIBE SELECT 42 AS a);

SELECT t.column_name FROM (DESCRIBE SELECT 42 AS a) t;

(DESCRIBE SELECT 42 AS a);

CREATE TABLE t AS SELECT 42 AS a;

SELECT t.column_name FROM (DESCRIBE t) t;

FROM (SHOW databases) t;

SELECT column_name FROM (DESCRIBE ( DESCRIBE SELECT * FROM (SELECT 32 as a)));

(DESCRIBE (values(42))) UNION ALL (DESCRIBE (values(42)));

CREATE TABLE "s1"".tbl"(i INT);

SELECT column_name, column_type FROM (DESCRIBE "s1"".tbl");

CREATE TABLE integers(c1 INTEGER PRIMARY KEY, c2 INT NOT NULL, c3 INT DEFAULT 42, c4 INT UNIQUE, c5 INT);

INSERT INTO integers VALUES (42, 42, 42, 42, 42);

INSERT INTO integers VALUES (84, 84, 84, 84, 84);

DESCRIBE SELECT * FROM integers;

DESCRIBE integers;

SELECT column_name, key FROM (DESCRIBE SELECT c4, c1 FROM integers);

SELECT column_name, key FROM (DESCRIBE SELECT c4 FROM integers WHERE c1=42);

SELECT column_name, key FROM (DESCRIBE SELECT c4 FROM integers LIMIT 5);

SELECT column_name, key FROM (DESCRIBE SELECT c4 FROM integers ORDER BY c1 LIMIT 5);

SELECT column_name, key FROM (DESCRIBE SELECT c4 FROM integers USING SAMPLE 5);

SELECT column_name, key FROM (DESCRIBE SELECT c4 FROM integers, (SELECT 84));

SELECT column_name, key FROM (DESCRIBE SELECT t.c1, integers.c1 FROM integers JOIN (SELECT 84 c1) t USING (c1));

CREATE VIEW my_view AS SELECT * FROM integers;

SELECT column_name, key FROM (DESCRIBE SELECT c4, c1 FROM my_view);

SELECT column_name, key FROM (DESCRIBE SELECT c4 + 1 AS expr FROM integers LIMIT 5);

CREATE TABLE base_table(base_name int);

DESCRIBE base_table;

DESCRIBE SELECT base_name AS alias_name FROM base_table;

DESCRIBE SELECT alias_name as alias_alias_name FROM (SELECT base_name AS alias_name FROM base_table);

DESCRIBE SELECT base_name AS alias_name FROM VALUES (1) AS base_table(base_name);

DESCRIBE WITH cte_rel AS (SELECT 1 as base_name) SELECT base_name as alias_name FROM cte_rel;

CREATE TABLE my_table(i INTEGER, j INTEGER);

SET threads TO 42;

SHOW threads;

SHOW "threads";

SHOW my_table;

SHOW TABLES;

SHOW DATABASES;

SHOW ALL TABLES;

SHOW main.my_table;

SHOW (SELECT * FROM my_table);

SET show_behavior='setting';

SET show_behavior='table';

SET show_behavior='auto';

CREATE TABLE threads(x INTEGER);

SET TimeZone='Europe/Amsterdam';

SHOW timezone;

SELECT column_name, min FROM (SUMMARIZE SELECT 42 AS a);

CREATE TABLE tbl AS SELECT 42 AS a;

SELECT column_name, min FROM (SUMMARIZE tbl);

SET threads=4;

SELECT i, column_name, min, max
FROM range(2) t(i),
LATERAL (
	SUMMARIZE SELECT i + j AS x FROM range(2) u(j)
)
ORDER BY i;

RESET threads;

CREATE TABLE integers(i INTEGER, j INTEGER, a INTEGER);

DESCRIBE;

DROP TABLE integers;

CREATE TABLE t(plant TEXT, dt DATE, mwh BIGINT);

create table "a.b.c" (x int);

describe "a.b.c";

create schema defg;

drop table "a.b.c";

create table defg."a.b.c" (x int);

describe defg."a.b.c";

drop table defg."a.b.c";

create table defg.abc (x int);

describe defg.abc;

drop table defg.abc;

drop schema defg;

create schema "d.e.f.g";

create table "d.e.f.g"."a.b.c" (x int);

describe "d.e.f.g"."a.b.c";

drop table "d.e.f.g"."a.b.c";

create table "d.e.f.g".abc (x int);

describe "d.e.f.g".abc;

CREATE TABLE integers(i INTEGER, j INTEGER);

CREATE TABLE integers2 (i INTEGER, j INTEGER, st VARCHAR, d DATE);

INSERT INTO integers VALUES (1, 1), (2, 2), (3, 3), (NULL, NULL);

INSERT INTO integers2 VALUES (1, 30, 'a', '1992-01-01'), (8, 12, 'b', '1992-01-01'), (3, 24, 'c', '1992-01-01'), (9, 16, 'd', '1992-01-01'), (10, NULL, 'e', '1992-01-01');

SHOW SELECT * FROM integers;

SHOW SELECT i FROM integers;

SHOW SELECT integers.i, integers2.st, integers2.d FROM integers, integers2 WHERE integers.i=integers2.i;

SHOW SELECT SUM(i) AS sum1, j FROM integers GROUP BY j HAVING j < 10;

CREATE TABLE types(i INTEGER, j VARCHAR, k HUGEINT, d DOUBLE, e BLOB);

INSERT INTO types VALUES 
	(1, 'hello', 12, 0.5, BLOB 'a\x00b\x00c'), 
	(2, 'world', -12, -0.5, BLOB ''), 
	(3, NULL, NULL, NULL, NULL);

SELECT UNNEST(['i', 'j', 'k', 'd', 'e']) column_names,
       UNNEST(['INTEGER', 'VARCHAR', 'HUGEINT', 'DOUBLE', 'BLOB']) column_types,
       UNNEST([MIN(i)::VARCHAR, MIN(j)::VARCHAR, MIN(k)::VARCHAR, MIN(d)::VARCHAR, MIN(e)::VARCHAR]) min,
	   UNNEST([MAX(i)::VARCHAR, MAX(j)::VARCHAR, MAX(k)::VARCHAR, MAX(d)::VARCHAR, MAX(e)::VARCHAR]) max
FROM (SELECT * FROM types) tbl;

SUMMARIZE types;

SUMMARIZE SELECT * FROM types;

summarize 
from range('2024-01-01'::TIMESTAMP, '2024-04-10'::TIMESTAMP, INTERVAL 1 DAY);

summarize 
SELECT range::DATE AS range from range('2024-01-01'::DATE, '2024-04-10'::DATE, INTERVAL 1 DAY);

summarize 
SELECT range::TIME AS range from range('2024-01-01'::DATE, '2024-04-10'::DATE, INTERVAL 1 HOUR);

SUMMARIZE (SELECT '1:02:03.000000+05:30'::TIMETZ AS ttz);

SUMMARIZE VALUES (1.0),(6754950520);

SUMMARIZE SELECT 9223372036854775296;

summarize select bigint from test_all_types();

summarize select 9223372036854775295;

summarize "a.b.c";

summarize defg."a.b.c";

summarize defg.abc;

summarize "d.e.f.g"."a.b.c";

summarize "d.e.f.g".abc;

SELECT avg(x) FROM (SELECT TIMESTAMP_NS '2026-01-01 00:00:00.000000001' AS x UNION ALL SELECT TIMESTAMP_NS '2026-01-01 00:00:00.000000003');

SELECT avg(x) FROM (SELECT TIME_NS '01:00:00.000000001' AS x UNION ALL SELECT TIME_NS '01:00:00.000000003');

SELECT avg(x) FROM (SELECT TIMESTAMPTZ_NS '2026-01-01 10:00:00+10:00' AS x);

SELECT typeof(approx_quantile(x, 0.5)) FROM (SELECT TIME_NS '01:00:00.000000000' AS x);

SELECT typeof(approx_quantile(x, 0.5)) FROM (SELECT TIMESTAMP_NS '2026-01-01 00:00:00' AS x);

SELECT typeof(approx_quantile(x, 0.5)) FROM (SELECT TIMESTAMPTZ_NS '2026-01-01 00:00:00+00:00' AS x);

CREATE OR REPLACE TABLE summarize_ns AS SELECT
  TIMESTAMP_NS '2026-01-01 10:00:00.000000001' AS ts_ns,
  TIME_NS '01:02:03.000000001' AS time_ns,
  TIMESTAMPTZ_NS '2026-01-01 10:00:00+10:00' AS tstz_ns;

SELECT count(*) FROM (SUMMARIZE summarize_ns);
