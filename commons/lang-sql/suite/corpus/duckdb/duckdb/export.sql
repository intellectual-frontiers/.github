CREATE TABLE test_table (
    id INTEGER,
    name VARCHAR,
    value DOUBLE,
    created_at TIMESTAMP
);

INSERT INTO test_table VALUES
    (1, 'Alice', 123.45, '2024-01-01 10:00:00'),
    (2, 'Bob', 67.89, '2024-01-02 11:30:00'),
    (3, 'Charlie', 234.56, '2024-01-03 14:15:00');

DROP TABLE test_table;

FROM test_table;

CREATE TYPE m AS ENUM ('', 'a');

CREATE TABLE t(e m, b BLOB, v VARCHAR, n VARCHAR);

INSERT INTO t VALUES ('', '', '', NULL), (NULL, NULL, NULL, 'x'), ('a', 'b', 'c', '');

DROP TABLE t;

DROP TYPE m;

SELECT e IS NULL, b IS NULL, v IS NULL, n IS NULL, v, n FROM t ORDER BY ALL;

CREATE TYPE mood AS ENUM ('', 'ok');

CREATE TABLE t(id INT, v VARCHAR, b BLOB, e mood);

INSERT INTO t VALUES (1, '', ''::BLOB, ''), (2, NULL, NULL, NULL), (3, 'x', 'x'::BLOB, 'ok');

DROP TYPE mood;

SELECT id, v IS NULL AS v_null, b IS NULL AS b_null, e IS NULL AS e_null FROM t ORDER BY id;

SET default_null_order='nulls_first';

SET default_transaction_invalidation_policy='SYNTACTIC_ERRORS_DO_NOT_INVALIDATE';

BEGIN TRANSACTION;

CREATE TABLE integers(i INTEGER, j INTEGER, CHECK(i+j<10));

CREATE TABLE strings(v VARCHAR, d DATE, PRIMARY KEY(d));

CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');

CREATE TABLE enums(current_mood mood);

INSERT INTO integers VALUES (1, 3), (4, 2), (NULL, 1);

INSERT INTO strings VALUES ('NULL', DATE '1992-01-01'), (NULL, DATE '1993-01-01');

INSERT INTO enums VALUES ('sad'),('ok'),('sad'),('happy');

CREATE TABLE "table.with-symbols"(i INTEGER);

INSERT INTO "table.with-symbols" VALUES (1), (4), (NULL);

CREATE TABLE "table ""." ( "col ""." TEXT);

INSERT INTO "table ""." ("col "".") VALUES ('quote_escaped_quote_''');

CREATE TABLE "SAME_NAME"(i INTEGER, j INTEGER);

INSERT INTO "SAME_NAME" VALUES (1, 1), (2, 2);

CREATE VIEW v1 AS SELECT * FROM integers WHERE i>3;

--
CREATE VIEW v2 AS SELECT * FROM integers WHERE i < 3;

CREATE VIEW "view.with-symbols" AS SELECT * FROM "table.with-symbols" WHERE i < 3;

CREATE VIEW "view ""." AS SELECT * FROM "table.with-symbols" WHERE i < 3;

CREATE VIEW v3 AS SELECT * FROM integers WHERE i IS NULL --
;

CREATE SEQUENCE seq;

SELECT nextval('seq');

SELECT * FROM v2 ORDER BY 1;

SELECT * FROM integers ORDER BY 1;

SELECT * FROM enums ORDER BY 1;

SELECT * FROM strings ORDER BY 1;

SELECT * FROM v1 ORDER BY 1;

SELECT * FROM v3 ORDER BY 1;

SELECT * FROM "table.with-symbols" ORDER BY 1;

SELECT * FROM "view.with-symbols" ORDER BY 1;

SELECT "table ""."."col "".", "col ""." FROM "table "".";

SELECT * FROM "view ""." ORDER BY 1;

SELECT * FROM "SAME_NAME" ORDER BY i;

CREATE SCHEMA s1;

CREATE SCHEMA s2;

CREATE TABLE table01(i INTEGER, j INTEGER);

CREATE TABLE s1.table01(i INTEGER, j INTEGER);

CREATE TABLE s2.table01(i INTEGER, j INTEGER);

INSERT INTO table01 VALUES (1, 1), (2, 2);

INSERT INTO s1.table01 VALUES (3, 3), (4, 4);

INSERT INTO s2.table01 VALUES (5, 5), (6, 6);

SELECT * FROM table01 ORDER BY i;

SELECT * FROM s1.table01 ORDER BY i;

SELECT * FROM s2.table01 ORDER BY i;

SET debug_verify_serializer=true;

ROLLBACK;

CREATE SEQUENCE past_up MAXVALUE 3 START 5;

CREATE SEQUENCE past_down INCREMENT BY -1 MINVALUE -3 MAXVALUE 0 START -5;

DROP SEQUENCE past_up;

DROP SEQUENCE past_down;

CREATE SEQUENCE up MAXVALUE 3;

SELECT nextval('up') FROM range(3);

CREATE SEQUENCE down INCREMENT BY -1 MINVALUE -3 MAXVALUE 0 START 0;

SELECT nextval('down') FROM range(4);

CREATE SEQUENCE s2."my seq" MAXVALUE 2;

SELECT nextval('s2."my seq"') FROM range(2);

CREATE SEQUENCE live MAXVALUE 100;

SELECT nextval('live') FROM range(3);

SELECT nextval('live');

SET enable_external_access=false;

CREATE TABLE tbl(
    d DATE DEFAULT CURRENT_DATE,
    t TIME WITH TIME ZONE DEFAULT CURRENT_TIME,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cur_user VARCHAR DEFAULT CURRENT_USER,
    "user" VARCHAR DEFAULT USER,
    sess_user VARCHAR DEFAULT SESSION_USER,
    cur_catalog VARCHAR DEFAULT CURRENT_CATALOG,
    cur_schema VARCHAR DEFAULT CURRENT_SCHEMA
);

SET storage_compatibility_version='v1.2.0';

CREATE MACRO my_macro(b) AS b + 5;

CREATE TABLE tbl (
	x INTEGER,
	gen_x AS (my_macro(x))
);

INSERT INTO tbl VALUES(5);

SELECT * FROM tbl;

BEGIN;

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (42);

FROM integers;

CREATE MACRO elaborate_macro(x, y := 7) AS x + y;

CREATE TABLE tbl (x integer, y varchar);

CREATE UNIQUE INDEX my_index on tbl (elaborate_macro(tbl.x));

select index_name from duckdb_indexes();

SELECT elaborate_macro(28, y := 5);

insert into tbl VALUES (10, 'hello');

CREATE TABLE t(a INT, b INT);

INSERT INTO t VALUES (1, 2), (NULL, 3);

ATTACH ':memory:' AS db2;

CREATE TABLE db2.t(a INT, b INT);

INSERT INTO db2.t VALUES (1, 2);

SELECT * FROM t ORDER BY a NULLS LAST;

set enable_macro_dependencies=true;

CREATE SCHEMA my_schema;

CREATE MACRO my_schema.my_range(x, y := 7) AS TABLE SELECT range + x i FROM range(y);

CREATE MACRO my_schema.elaborate_macro(x, y := 7) AS x + y + (SELECT max(i) FROM my_schema.my_range(0, y := 10));

CREATE MACRO my_schema.my_other_range(x) AS TABLE SELECT * FROM my_schema.my_range(x, y := 3);

SELECT my_schema.elaborate_macro(28, y := 5);

SELECT max(i) FROM my_schema.my_range(33, y := 10);

SELECT max(i) FROM my_schema.my_other_range(40);

CREATE TYPE "group" AS ENUM ( 'one', 'two');

CREATE TYPE quoted_enum AS ENUM ('a''b', 'x,y', 'semi;');

CREATE TABLE table1(col1 "group");

CREATE TABLE table2(col1 quoted_enum);

INSERT INTO table2 VALUES ('a''b'), ('x,y'), ('semi;');

SELECT col1::VARCHAR FROM table2 ORDER BY col1::VARCHAR;

create table a (s STRUCT("end" VARCHAR));

insert into a values ({"end":'hello'});

select * from a;

create table a (
	u UNION(
		"member name 1" VARCHAR,
		"member name 2" BOOL
	)
);

insert into a values (
	union_value("member name 1" := 'hello')
);

select union_tag(COLUMNS(*)) from a;

CREATE TEMP TABLE temp_only AS SELECT 42 AS i;

CREATE MACRO typed_null(value := NULL::INTEGER) AS value;

SELECT typeof(typed_null()), typed_null() IS NULL;

CREATE TYPE mood AS ENUM ('happy', 'sad', 'curious');

CREATE TYPE doom as mood;

create table tbl1 (a mood, b doom);

create table tbl2 (my_struct STRUCT(a mood, b doom));

CREATE TYPE doom_mood as STRUCT(a mood, b doom);

CREATE TYPE mood_list as mood[];

CREATE TYPE my_union as UNION(a doom, b mood);

CREATE TYPE mood_map as MAP(doom, mood);

CREATE TYPE my_special_type as VARCHAR;

CREATE TABLE tbl3 (my_struct doom_mood);

CREATE TABLE tbl4 (a mood_list, b mood_map, d my_special_type);

CREATE TABLE tbl5 (c my_union);

INSERT INTO tbl1 VALUES ('happy', 'sad');

INSERT INTO tbl2 VALUES ({'a': 'curious', 'b': 'happy'});

INSERT INTO tbl3 VALUES ({'a': 'sad', 'b': 'curious'});

INSERT INTO tbl4 VALUES (['happy', 'sad'], map(['curious'], ['happy']), 'type alias');

SELECT count(*) FROM tbl5;

INSERT INTO tbl5 VALUES (union_value(b := 'sad'::mood));

SELECT a, b FROM tbl1;

SELECT my_struct.a, my_struct.b FROM tbl2;

SELECT my_struct.a, my_struct.b FROM tbl3;

SELECT a, b, union_tag(c), c.b, d FROM tbl4, tbl5;

SELECT enum_range(NULL::mood), enum_range(NULL::doom), enum_range(a[1]), enum_range(c.b) FROM tbl4, tbl5;

CREATE TABLE t(i INT);

create table tbl as select "bit" from test_all_types(), range(3);

create type my_enum as enum ('1', '2', '3');

create table tbl (a my_enum);

create table tbl2 as select 'hello''world'::enum('hello''world');

insert into tbl VALUES
	('1'),
	(NULL),
	('3');

select * from tbl2;

create table tbl as select "hugeint" from test_all_types(), range(3);

create table tbl as select val from ( select json_structure('{"a": 42}') val), range(3);

create table tbl as select val from (
	select ['01010101'::BIT, '01011101001'::BIT] val
), range(3);

create table unsupported_key as select val from (
	select MAP {
		'hello': '01010101000'::BIT,
		'HELLO': NULL::BIT
	} val
), range(3);

create table unsupported_value as select val from (
	select MAP {
		'01010101000'::BIT: 'hello',
		'11110111101'::BIT: 'world'
	} val
), range(3);

select * from unsupported_key;

select * from unsupported_value;

create table tbl as select val from (
	select {
		'a': '01010101000'::BIT,
		'b': true,
		'c': NULL
	} val
), range(3);

create table tbl as select "union" from test_all_types(), range(3);

create table tbl2 (a UNION(a bit, b bool));

insert into tbl2 VALUES ('00101010'::BIT), (True::BOOL), (NULL::BIT);

CREATE TABLE integers(i INTEGER NOT NULL, j INTEGER);

INSERT INTO integers SELECT i, i+1 FROM range(0, 1000) tbl(i);

SELECT SUM(i), SUM(j) FROM integers;

DROP TABLE integers;
