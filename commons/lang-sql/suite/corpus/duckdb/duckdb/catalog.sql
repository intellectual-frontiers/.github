CREATE TABLE "MyTable"(i integer, "BigColumn" integer);

ALTER TABLE MyTable ALTER COLUMN BIGCOLUMN SET DEFAULT 3;

ALTER TABLE MyTable RENAME BIGCOLUMN TO "SmallColumn";

SELECT * FROM "MyTable";

CREATE TABLE "ABC"(i integer);

DROP TABLE abc;

ALTER TABLE "MYTABLE" ADD COLUMN mycolumn INTEGER;

with "CTE" AS (SELECT 42)
select * from cte;

SELECT integers.i FROM integers ORDER BY i;

UPDATE integers SET i=integers.i+1;

SELECT i, j FROM integers ORDER BY integers.i;

SELECT tbl.k FROM (SELECT j FROM integers) TBL(K) ORDER BY K;

SELECT structs.S.i.K, "STRUCTS"."S"."I"."K", "structs"."s"."i"."k" FROM structs;

SET preserve_identifier_case='lowercase';

select * from A join B using("X");

create table A as select 1 as "hello", 2 as x;

create table E as select 1 as "heLLo", 6 as x5;

SELECT * FROM a JOIN b USING (hello) JOIN c USING ("HELLO");

SELECT * FROM a FULL OUTER JOIN b USING (hello);

SELECT * FROM a NATURAL JOIN b;

SELECT * FROM (a NATURAL JOIN b NATURAL JOIN c) NATURAL JOIN (d NATURAL JOIN e);

SELECT * FROM a NATURAL FULL OUTER JOIN b NATURAL FULL OUTER JOIN c NATURAL FULL OUTER JOIN d NATURAL FULL OUTER JOIN e;

SELECT * FROM (SELECT 1 "hello", 2 "hello") t1 JOIN (SELECT 1 "hello", 2 "hello") t2 USING (hello);

ALTER TABLE test_table ADD COLUMN new_col INTEGER;

ALTER TABLE test_table RENAME COLUMN new_col TO new_col_2;

COMMENT ON TABLE test_table IS NULL;

COMMENT ON VIEW test_view IS 'very gezellige view';

select comment from duckdb_columns() where column_name='test_view_column';

select comment from duckdb_indexes() where index_name='test_index';

CREATE SEQUENCE test_sequence;

DROP SEQUENCE test_sequence;

SELECT 1::test_type as val;

ALTER TABLE test_table RENAME COLUMN test_table_column TO test_table_column_renamed;

COMMENT ON MACRO test_macro IS 'very gezellige macro';

select comment from duckdb_functions() where function_name='test_function';

COMMENT ON MACRO TABLE test_table_macro IS 'very gezellige table macro';

CREATE VIEW test_view AS SELECT test_table_column as test_view_column FROM test_table;

SELECT table_name, database_name, temporary FROM duckdb_tables() WHERE table_name='temp_comment_test';

SELECT column_name, comment FROM duckdb_columns() WHERE table_name='aliased_view' AND column_name='c1';

COMMENT ON COLUMN swapped_view.a IS 'visible a';

COMMENT ON COLUMN tbl.i IS 'local column comment';

SELECT comment FROM duckdb_columns() WHERE table_name = 'v' AND column_name = 'vi';

CREATE INDEX test_index ON t1 using art(c1);

COMMENT ON TABLE a IS 'a table';

select comment from duckdb_columns() where column_name='i';

CREATE SCHEMA db1.s1;

CREATE TABLE db1.s1.t3 AS SELECT 3 as c3;

SELECT count(*) from duckdb_tables() where comment IS NOT NULL;

USE db2.s2;

COMMENT ON TABLE s2.t2 IS 'yet another very gezellige table 2';

select database_name, schema_name, comment from duckdb_indexes() where index_name='test_index' order by comment;

select database_name, schema_name, table_name, comment from duckdb_columns() where column_name='c2' order by comment;

COMMENT ON TABLE test IS 'comment-1';

CREATE INDEX test_index ON test(a);

COMMENT ON SEQUENCE seq IS 'comment-5';

SELECT ddb.comment, pg.description
FROM duckdb_tables AS ddb
LEFT JOIN pg_description AS pg
    ON pg.classoid=ddb.database_oid AND pg.objoid=ddb.table_oid
WHERE pg.objsubid=0 AND ddb.table_name='test';

SELECT ddb.comment, pg.description
FROM duckdb_indexes AS ddb
LEFT JOIN pg_description AS pg
    ON pg.classoid=ddb.database_oid AND pg.objoid=ddb.index_oid
WHERE ddb.index_name='test_index';

SELECT ddb.comment, pg.description
FROM duckdb_functions() AS ddb
LEFT JOIN pg_description AS pg
    ON pg.classoid=ddb.database_oid AND pg.objoid=ddb.function_oid
WHERE ddb.function_name='test_function';

PRAGMA disable_checkpoint_on_shutdown;

insert into tbl2 values ('abc');

create table tbl(a varchar default 'abc');

create view vw as select * from tbl;

CREATE TABLE s.t AS SELECT range AS i, range::VARCHAR AS v FROM range(1000);

ALTER TABLE s.t ALTER COLUMN k SET DEFAULT 42;

CREATE TABLE s.t(i INTEGER);

create index idx on tbl(a);

DROP SCHEMA IF EXISTS idx CASCADE;

COMMIT;

create macro static_table() as table select * from vw;

select a, b from tbl;

ALTER SEQUENCE sequence1 OWNED BY tablename;

ALTER SEQUENCE main.sequence1 OWNED BY main.tablename;

DROP TABLE tablename2;

ALTER SEQUENCE sequence3 OWNED BY tablename;

SELECT colname, colname2, colname3, colname4, colname5 FROM tablename;

DROP TABLE new_tablename;

CREATE TABLE tablename (
    colname integer DEFAULT nextval('sequence1')
);

ALTER TABLE tablename DROP colname3;

CREATE VIEW v1_sequence1(a) AS SELECT 42;

CREATE SEQUENCE sequence4;

DROP SEQUENCE sequence4;

ALTER SEQUENCE sequence1 OWNED BY tbl1;

alter sequence seq owned by tbl;

CREATE TABLE t2 AS (SELECT 42);

drop sequence seq;

SELECT SUM(i) FROM integers;

DROP SEQUENCE seq2;

ALTER TABLE tbl4 DROP COLUMN a;

CREATE SEQUENCE seq5 START 1;

DROP TABLE tbl6;

INSERT INTO position_ledger(v) VALUES
	('a'),
	('b');

INSERT INTO position_ledger(id, v) VALUES
	(99, 'c');

CREATE TABLE moods (history mood[], last STRUCT(m mood));

DROP TYPE mood CASCADE;

SELECT * FROM s1.integers;

ALTER TABLE tbl ALTER COLUMN id SET DEFAULT NULL;

CREATE TABLE tbl2 (
	a INTEGER DEFAULT nextval('seq'),
	b INTEGER DEFAULT nextval('seq')
);

CREATE SEQUENCE seq4 START 1;

DROP TABLE tbl5;

insert into tbl VALUES ('test');

CREATE SCHEMA a;

CREATE SCHEMA c;

CREATE VIEW duckdb_viewsz AS SELECT 1 AS a;

CREATE MACRO nullig(a, b) AS a;

DROP TABLE IF EXISTS t1;

CREATE MACRO checksum_macro.checksum(table_name) AS TABLE
    SELECT bit_xor(md5_number(COLUMNS(*)::VARCHAR))
    FROM query_table(table_name);

ABORT;

SELECT 3 / 2, weighted_avg(x, w) FROM (VALUES (1, 1), (2, 1)) t(x, w);

CREATE MACRO generate_series(a, b) AS a + b;

CREATE MACRO list_aggr(l, f) AS 'evil';

CREATE MACRO "+"(a, b) AS 999;

SELECT round(geomean(v) OVER (), 3) AS r FROM win_t LIMIT 1;

SELECT system.main.array_pop_front([10, 20, 30]);

SELECT array_append([1], 2);

SELECT generate_subscripts([10, 20], 1);

CREATE MACRO param_macro(lower) AS lower || '!';

CREATE MACRO "//"(a, b) AS 0;

CREATE MACRO "-"(a, b) AS 0;

SELECT array_pop_back([10, 20, 30]);

CREATE MACRO struct_pack(key, value) AS 999;

SELECT system.pg_catalog.format_type(NULL::BIGINT, -1);

SELECT 42;

SELECT bin, count FROM histogram_values('hist_t', v) ORDER BY bin LIMIT 3;

CREATE MACRO list_apply(xs, f) AS [0.5];

DROP MACRO f(VARCHAR);

SELECT f(1);

SELECT g(1), g(1, 2);

CREATE MACRO r(x) AS x, (x INTEGER) AS x + 1;

CREATE MACRO h() AS 42, (x INTEGER) AS x;

DROP MACRO dm(DECIMAL(10,2));

CREATE MACRO qs.q(x INTEGER) AS 1, (x VARCHAR) AS 2;

CREATE TYPE "any" AS STRUCT(i INTEGER);

DROP MACRO anyt;

DROP MACRO m(mood);

DROP MACRO whole;

CREATE MACRO pt(x INTEGER, y) AS 1, (x VARCHAR, y) AS 2;

CREATE MACRO amb(x, y) AS 1, (x INTEGER, y) AS 2;

CREATE MACRO casc(x INTEGER) AS x, (x VARCHAR) AS x;

SELECT v FROM tmm(7);

DROP MACRO TABLE shared(VARCHAR);

DROP MACRO TABLE shared;

CREATE TYPE ty_s1.mood AS ENUM ('ok');

SET schema = 'ty_s2';

DROP SCHEMA ty_s1 CASCADE;

SELECT tmp_m(1);

ATTACH ':memory:' AS cat_a;

CREATE TYPE cat_a.s.mood AS ENUM ('a');

SET search_path = 'cat_a.main,cat_b.s';

USE cat_neutral;

SET wal_autocheckpoint = '1TB';

DROP MACRO alt(VARCHAR);

DROP MACRO alt(DATE);

DROP MACRO s.sf(INTEGER);

SELECT v FROM tm(7);

DETACH odb;

CHECKPOINT ndb;

CREATE MACRO blk(x INTEGER) AS x, (x VARCHAR) AS x;

DROP VIEW blk_v1;

CREATE MACRO last_one(x INTEGER) AS x;

CREATE MACRO mdb.tm(x INTEGER) AS TABLE (SELECT x + 1 AS v), (x VARCHAR) AS TABLE (SELECT 42 AS v);

SELECT mdb.f(1), mdb.f('a'), mdb.caller();

SET enable_macro_dependencies=true;

DROP MACRO TABLE mdb.tm(VARCHAR);

DETACH mdb;

SELECT rollback_subject('a'), rollback_caller();

CREATE MACRO comment_order(x INTEGER) AS x, (x VARCHAR) AS 42;

CREATE OR REPLACE MACRO other_subject(x INTEGER) AS x, (x VARCHAR) AS 42;

DROP MACRO dependency_holder;

DROP MACRO dep_survivor(VARCHAR);

CREATE MACRO dep_release(x INTEGER) AS x, (x VARCHAR) AS (SELECT count(*) FROM dep_released);

CREATE TABLE dep_kept(i INTEGER);

CREATE TABLE dep_toggled(i INTEGER);

DROP TABLE dep_toggled CASCADE;

CREATE TABLE dep_src(i INTEGER);

DROP SCHEMA dep_s1 CASCADE;

CREATE TABLE amb_s1.src(i INTEGER);

DROP MACRO TABLE amb_s1.holder(VARCHAR);

CREATE SCHEMA sh_s2;

CREATE MACRO sh_s1.holder(x INTEGER) AS TABLE (SELECT i FROM src), (x VARCHAR) AS TABLE (SELECT i FROM sh_s2.src);

CREATE SCHEMA at_a;

SET schema = 'at_b';

DROP SCHEMA at_b CASCADE;

DROP MACRO dep_typed;

CREATE TABLE cpd_table(i INTEGER);

COPY FROM DATABASE cpd_src TO cpd_dst;

DETACH cpd_src;

DROP MACRO shared_dep(VARCHAR);

CREATE TABLE rb_src(i INTEGER);

DROP TABLE rb_src CASCADE;

COPY FROM DATABASE attr_src TO attr_dst;

DETACH attr_dst;

DROP MACRO blocked_f(VARCHAR);

CREATE MACRO probe_other.helper() AS 1;

CREATE TABLE probe_mem.probe_t(i INT);

SELECT i FROM probe_mem.probe_log;

CREATE TABLE pdb.src(i INTEGER);

DROP MACRO pdb.main.pf(ANY);

DROP TABLE pdb.src;

SELECT odb.main.old_pf(1), odb.main.old_plain('a');

create macro min_from_tbl(tbl, col) as (select min(col) from query_table(tbl::VARCHAR));

SELECT m(1), typeof(m(1));

CREATE MACRO multi(x INTEGER) RETURNS BIGINT AS x, (x INTEGER, y INTEGER) RETURNS VARCHAR AS x + y;

SELECT return_type, macro_definition FROM duckdb_functions() WHERE function_name = 'multi';

CREATE TYPE rtype AS ENUM ('a', 'b');

SELECT typeof(plain(1::SMALLINT));

CREATE MACRO collated_param(p VARCHAR('nocase')) AS p = 'A';

DETACH cex;

USE old_db;

SELECT json_serialize_plan('CREATE MACRO jm() RETURNS VARCHAR AS 42') LIKE '%"error":false%';

CREATE MACRO plain_typed(x INTEGER, y) AS x + y;

select m();

select m('c', 'd');

select * from m();

select * from m('c', 'd');

FROM query('SELECT 42 AS a');

FROM query('SELECT 1, 2, 3');

FROM query('SELECT *, 1 + 2 FROM tbl');

SELECT * FROM query('WITH a(i) AS (SELECT 1) SELECT a1.i AS i1, a2.i AS i2 FROM a AS a1, a AS a2');

CREATE TABLE tbl2_varchar AS SELECT '1?ch@racter$';

FROM query_table('tbl');

CREATE TABLE "(SELECT 17 + 25)"(i int);

SELECT f.* FROM query_table('tbl_int') as f;

FROM query_table('tbl2', true);

CREATE TABLE "a/b".t AS SELECT 7 AS i;

CREATE MACRO my_subquery_extract(x) AS (SELECT x.a.b);

CREATE MACRO cte_sq(a,b) AS (WITH cte AS (SELECT a * 2 AS c) SELECT cte.c + sq.d FROM cte, (SELECT b * 3 AS d) AS sq);

CREATE MACRO IFELSE(a,b,c) AS CASE WHEN a THEN b ELSE c END;

SELECT IFELSE(1, IFELSE(1,a,'b'), 'c') FROM integers;

SELECT mod_two(a), SUM(a) FROM integers GROUP BY mod_two(a);

CREATE MACRO triple_add1(a, b, c, d) AS add_mac(add_mac(a, b), add_mac(c, d));

INSERT INTO integers VALUES (41);

PREPARE v1 AS SELECT add_one(?::INTEGER);

EXECUTE v2(3);

CREATE TABLE fts_main_documents.terms AS (
    SELECT
        term,
        docid,
        row_number() OVER (PARTITION BY docid) AS pos
    FROM (
        SELECT
            unnest(string_split_regex(regexp_replace(lower(strip_accents(body)), '[^a-z]', ' ', 'g'), '\s+')) AS term,
            row_number() OVER () AS docid
        FROM main.documents
    ) AS sq
    WHERE
        term != ''
);

ALTER TABLE fts_main_documents.terms ADD termid INT;

UPDATE fts_main_documents.dict d
SET df = (
    SELECT count(distinct docid)
    FROM fts_main_documents.terms t
    WHERE d.termid = t.termid
    GROUP BY termid
);

CREATE MACRO mywindow(k,v) AS SUM(v) OVER (PARTITION BY k);

SELECT my_second_macro();

SELECT in_with_cte(1);

SELECT plus42(a) FROM integers;

SELECT plus42(a) + plus1(a) FROM integers;

create macro m() as table (select 42 i);

set storage_compatibility_version='v0.10.2';

SELECT f(x := (SELECT 41));

select f(x:=a) from t;

CREATE OR REPLACE MACRO eq(x := NULL, y := NULL) AS x = y;

USE macro_default_arg;

drop table integers cascade;

create or replace macro my_macro(a:={duck:42}) as a;

SELECT ['foo', 'baz'] AS k, extract_many(x, k) FROM (SELECT {'foo': 1, 'bar': 2, 'baz': 3} AS x);

INSERT INTO t (x) VALUES (1), (2);

CREATE MACRO arithmetic
	(a, b, mult := 1) AS (a + b) * mult,
	(a, b, c, division := 1) AS  (a + b + c) / division;

SELECT COUNT(*) FROM generate_numbers(1, 2, 2, mult := 5);

CREATE MACRO pack_parameter(y) AS list_transform([1, 2], lambda x: struct_pack(x := y));

SELECT subtract_args(#1, #2) FROM (VALUES (10, 3)) AS t(a, b);

SELECT join_args(#1, #2) FROM (VALUES ('left', 'right')) AS t(y, x);

SELECT a FROM (SELECT #1 FROM (VALUES (42)) AS t(a));

select test(4, 2);

create temporary macro test(a, b) as a + b;

use inmemorydb;

use newerdb;

create or replace macro m(s varchar := 'cc') as s || 'c';

select
    m(0::utinyint),
    m(0::usmallint),
    m(0::uinteger),
    m(0::ubigint),
    m(0::uhugeint),
    m(0::float);

create or replace type cool_string as varchar;

create or replace macro m(i bigint := 42::integer) as i;

select typeof(result.i), typeof(result.s), typeof(result.ut), typeof(result.us),
       typeof(result.ui), typeof(result.ub), typeof(result.uh)
from (select integral_defaults() result);

select result.min_i::varchar, result.max_ut::varchar, result.max_s::varchar,
       result.first_ui::varchar, result.max_b::varchar, result.first_ub::varchar
from (select boundary_defaults() result);

use switch_db;

create or replace macro m(s varchar) as table (select s || 'c');

create or replace macro m
    (a tinyint) as table (select a + 1),
    (a smallint) as table (select a + 2),
    (a integer) as table (select a + 3),
    (a bigint) as table (select a + 4),
    (a hugeint) as table (select a + 5),
    (a) as table (select a + 10);

create or replace macro m
    (i int, j) as table (select i + j),
    (i, j int) as table (select i - j);

from m('duck');

CREATE TEMP MACRO m1(x, y) AS (
    SELECT list_has_all(x, y) AND list_has_all(y, x)
);

CREATE MACRO "sum"(x) AS (CASE WHEN system.main.sum(x) IS NULL THEN 0 ELSE system.main.sum(x) END);

create macro m2(a) as m1(a)+1;

create or replace macro m3(a) as (from m4(42));

CREATE MACRO w(x) AS TABLE SELECT * FROM u(x) JOIN u(x) USING (a);

CREATE MACRO t2(x) AS TABLE SELECT * FROM u2(x);

CREATE TABLE t AS SELECT i::INTEGER AS i FROM range(3) r(i);

CREATE OR REPLACE MACRO mt(x INTEGER) AS mt(mt(1));

CREATE OR REPLACE MACRO ms(x INTEGER) AS ms((SELECT ms(1)));

CREATE MACRO ml(x INTEGER) AS x;

CREATE OR REPLACE MACRO mx(x) AS my(my(1));

RESET max_expression_depth;

SELECT inc(inc(inc(inc(inc(1))))), inc(inc(inc('a')));

CREATE TABLE integers (i INT);

SELECT in_next_n(12, 'seq', 5);

CREATE SEQUENCE seq2 INCREMENT BY 2 START WITH 2;

CREATE MACRO add_macro(a, b) AS a + b;

DROP MACRO one;

CREATE MACRO union_macro(x, y, z) AS (SELECT x IN (SELECT y UNION ALL SELECT z));

CREATE MACRO in_expression_list(x, y, z) AS (SELECT x IN (VALUES (y), (z)));

CREATE FUNCTION two() AS (SELECT 2);

CREATE TABLE floats (b FLOAT);

SELECT string_split(1, 2);

SELECT IFELSE(a = 0, 'true', 'false') FROM integers;

SELECT macros.add_macro(40,2);

CREATE MACRO weird_avg(x) AS (MIN(x) + MAX(x)) / COUNT(x);

SELECT add_default5(3);

CREATE MACRO two_default_params(a := 4, b := 2) AS a + b;

CREATE MACRO my_macro(a) AS 42;

select function_name, parameters, macro_definition
from duckdb_functions()
where function_name like 'zz%'
and macro_definition like '%macro_parameters%';

SELECT subquery(3) + a FROM integers;

SELECT a1(3) + a FROM integers;

CREATE TABLE test2_tbl (id INT, name string);

INSERT INTO  greek_tbl VALUES (1, 'alpha'), (2, 'beta'), (3, 'gamma'), (4, 'delta'), (5, 'epsilon'),(6, 'zeta'), (7, 'eta') , (8, 'theta'), (9, 'iota') , (10, 'kappa');

( SELECT* FROM xt(1, 'tom') UNION SELECT* FROM  xt2(1, '%%%') ) INTERSECT SELECT* FROM xt(100,'midge');

CREATE  MACRO xtm(cmp_str) as TABLE SELECT id, name FROM test_tbl  WHERE( name similar to cmp_str);

CREATE MACRO   cmp(a,m) as regexp_matches(a,m) or a similar to m;

DROP MACRO TABLE xt;

SELECT * FROM test_tbl where id>=(SELECT max(id) FROM xt(id,30));

INSERT INTO cards_tbl values (1, 'ace', 'clubs'),    (11,'jack', 'clubs' ),
(12, 'queen', 'clubs' ),     (13, 'king', 'clubs');

CREATE MACRO card_select(_val_min:=1, _val_max:=1,  _name:='%', _suit:='%')
as TABLE SELECT * FROM  cards_tbl WHERE val>=_val_min AND val<=_val_max AND name like  _name AND suit like _suit;

SELECT count(suit) FROM  card_select() GROUP BY ALL;

CREATE MACRO card_dfl() as TABLE SELECT DISTINCT suit FROM cards_tbl where suit='hearts';

CREATE MACRO sc2(dlimit, noffset) AS TABLE SELECT DISTINCT  suit from cards_tbl order by all limit dlimit% offset noffset;

SELECT * FROM sc3(suit);

select max(col0)  from my_values_union(1.0,2.0,3.0,20.0);

SELECT * FROM fibonacci(1, 2, 5, 10);

INSERT INTO car_pool VALUES 
 ( 1, 'VW',     'Golf',    2005, 5),
 ( 2, 'VW',     'Golf',    2006, 2),
 ( 3, 'VW',     'Golf',    2007, 3),
 ( 4, 'VW',     'Golf',    2008, 3),
 ( 5, 'VW',     'Passat',  2005, 5),
 ( 6, 'VW',     'Passat',  2006, 1),
 ( 7, 'VW',     'Beetle',  2005, 1),
 ( 8, 'VW',     'Beetle',  2006, 2),
 ( 9, 'VW',     'Beetle',  2008, 4),
 (10, 'Toyota', 'Corolla', 2005, 4),
 (11, 'Toyota', 'Corolla', 2006, 3),
 (12, 'Toyota', 'Corolla', 2007, 2),
 (13, 'Toyota', 'Corolla', 2008, 4),
 (14, 'Toyota', 'Prius',   2005, 1),
 (15, 'Toyota', 'Prius',   2006, 1),
 (16, 'Toyota', 'Hilux',   2005, 1),
 (17, 'Toyota', 'Hilux',   2006, 1),
 (18, 'Toyota', 'Hilux',   2008, 1);

SELECT * FROM car_pool_rollup(model, yyyy, hcnt:=4);

select my_agg(range) 
from range(2);

CREATE OR REPLACE MACRO my_case(x) AS (CASE WHEN x THEN 1 END);

CREATE MACRO my_count(x) AS COUNT(x);

SELECT LIST(i ORDER BY i DESC) OVER (PARTITION BY i % 2) FROM range(6) t(i) ORDER BY i;

INSERT INTO secret VALUES (42);

drop schema """cursed_schema";

CREATE SCHEMA db2.s3;

CREATE SCHEMA db2.s3.s3child;

CREATE SCHEMA s1.s2;

CREATE TABLE s1.s2.s3.tbl(i INTEGER, s STRUCT(a INTEGER));

SELECT s1.s2.s3.tbl.i FROM s1.s2.s3.tbl;

UPDATE memory.s1.s2.s3.tbl SET i = i + 1;

SELECT database_name, schema_name, table_name FROM duckdb_tables() WHERE table_name = 'tbl_renamed';

SELECT * FROM memory.s1.s2.s3.s4.v;

SELECT * FROM s1.s2.s3.tbl_macro();

CREATE SEQUENCE s1.s2.s3.seq START 5;

SELECT name FROM pragma_table_info('memory.s1.s2.s3.s4.info_tbl');

CREATE TABLE db2.a.b.c.t(i INTEGER);

DROP SCHEMA s1.child.grandchild;

DROP SCHEMA memory.s2.child;

DROP SCHEMA s1.child CASCADE;

SELECT count(*) FROM duckdb_schemas()
WHERE database_name = 'memory' AND schema_name IN ('s1','child','grandchild','sibling');

DROP SCHEMA IF EXISTS s1.does_not_exist;

CREATE SCHEMA n2;

SELECT schema_name, parent_schema FROM duckdb_schemas()
WHERE database_name = 'memory' AND schema_name = 'dup';

CREATE SCHEMA parent.sibling;

CREATE SCHEMA parent.child.gc2;

DROP SCHEMA parent CASCADE;

ALTER TABLE s1.s2.t RENAME TO t2;

SELECT k FROM s1.s2.t;

SELECT * FROM s1.s2.t;

ALTER TABLE s1.s2.t ALTER COLUMN k SET DEFAULT 7;

ALTER TABLE s1.s2.t ADD PRIMARY KEY (i);

COMMENT ON TABLE s1.s2.t IS 'nested table';

COMMENT ON VIEW s1.s2.v2 IS 'nested view';

SELECT comment FROM duckdb_sequences() WHERE sequence_name = 'seq';

CREATE TABLE a.b.tt(x INTEGER);

CREATE SCHEMA deep.mid;

CREATE SEQUENCE deep.mid.seq;

SELECT comment FROM duckdb_columns() WHERE column_name = 'id' AND table_name = 't' AND schema_name = 'bottom';

SELECT comment FROM duckdb_sequences() WHERE sequence_name = 'seq' AND schema_name = 'mid';

INSERT INTO s1.s2.fk VALUES (1);

CREATE SCHEMA s1.s3;

ATTACH ':memory:' AS lake;

CREATE SCHEMA lake.a.b.c;

DROP INDEX IF EXISTS lake.a.b.c.idx;

CREATE TABLE lake.a.b.c."d.e".t(i INTEGER);

CREATE INDEX idx ON lake.a.t(i);

DROP SEQUENCE lake.a.b.c.seq;

CREATE SEQUENCE lake.a.b.c."d.e"."s""q";

CREATE TABLE s1.s2.t(i INTEGER);

SELECT schema_name, view_name FROM duckdb_views() WHERE view_name = 'v';

SELECT currval('memory.s1.s2.seq');

SELECT i FROM s1.s2.defaults;

SELECT * FROM s1.s2.tbl_macro();

CREATE TABLE s1.s2.moods(m s1.s2.mood);

CREATE INDEX idx ON s1.s2.t(i);

CREATE TABLE s1.s2.log(i INTEGER);

SELECT database_name, schema_name, trigger_name FROM duckdb_triggers() WHERE trigger_name = 'trg';

CREATE VIEW a.b.v AS SELECT 1 AS x;

DROP VIEW s1.s2.v;

SELECT count(*) FROM duckdb_views() WHERE view_name = 'v' AND database_name = 'memory';

CREATE TABLE parent.child.t(i INTEGER);

CREATE MACRO parent.child.double(a) AS a * 2;

SELECT nextval('parent.child.seq');

CREATE TABLE parent.child.pk(i INTEGER PRIMARY KEY);

CREATE TABLE parent.child.log(i INTEGER);

INSERT INTO parent.child.t VALUES (4);

SELECT count(*) FROM duckdb_sequences() WHERE sequence_name = 'seq';

INSERT INTO s1.s2.t VALUES (1, 'a'), (2, 'b');

ATTACH ':memory:' AS imported;

SELECT schema_name, parent_schema FROM duckdb_schemas()
WHERE database_name = 'imported' AND schema_name IN ('s1','s2','s3') ORDER BY schema_name;

USE copied;

CREATE TABLE s.pk(id INTEGER PRIMARY KEY);

CREATE TABLE a.b.s.fq(id INTEGER REFERENCES nested_foreign_key_paths.a.b.s.pk(id));

INSERT INTO a.b.s.local_fk VALUES (1);

INSERT INTO a.b.s.self_ok VALUES (2, 1);

CREATE TABLE a.b."s.x".quoted_fk(id INTEGER REFERENCES a.b."s.x".pk(id));

ATTACH ':memory:' AS other;

CREATE SCHEMA main.sub;

CREATE MACRO main.sub.f() AS 8;

CREATE TABLE main.sub.t AS SELECT 9 AS i;

USE nested_missing_entries;

CREATE MACRO a.b.c.tabular() AS TABLE SELECT 1 AS i;

USE s1.s2;

CREATE TABLE shadow.inner_schema.tbl(i INTEGER);

SELECT database_name, schema_name FROM duckdb_types() WHERE type_name = 'ty';

DETACH shadow;

SELECT schema_name, table_name FROM duckdb_tables() WHERE table_name = 't';

CREATE SCHEMA p;

INSERT INTO p.s.audit VALUES (1);

CREATE MACRO s.f() AS 2;

SELECT x FROM p.s.v;

SELECT m FROM p.s.v_type;

CREATE SCHEMA p.inner;

CREATE TABLE p.s.t(m mood);

INSERT INTO p.s.t VALUES ('nested', 'nested', 'nested');

INSERT INTO p.s.d (id) VALUES (1);

SELECT id, y, z FROM p.s.d ORDER BY id;

CREATE SCHEMA nested_db.s;

CREATE VIEW nested_db.p.s.v AS SELECT x FROM nested_db.audit;

CREATE TABLE dt.my_table AS SELECT 1 AS x;

INSERT INTO p.s.d (id) VALUES (3);

CREATE SCHEMA mem.p.c;

CREATE SCHEMA lake.s3tablescatalog.salesdemo.retail;

PREPARE current_namespace AS SELECT database_name, schema_name FROM (SHOW SCHEMAS) WHERE current;

SELECT * FROM lake.widget_sales;

SELECT in_search_path('lake', 's3tablescatalog.salesdemo.retail'), in_search_path('lake', 'retail');

SELECT * FROM lake.s3tablescatalog.salesdemo.retail.created_here;

CREATE MACRO twice(x) AS x * 2;

SELECT * FROM nested_view;

SELECT * FROM lake.s3tablescatalog.salesdemo.retail.nested_view;

CREATE TABLE parent_table AS SELECT 11 AS id;

SELECT twice(21);

CREATE SCHEMA lake."a.b"."c,d"."e""f";

SET schema = '"a.b"."c,d"."e""f"';

DROP VIEW nested_view;

SELECT current_schema();

DROP SCHEMA lake.s3tablescatalog.main;

USE a.b;

SELECT * FROM other.a.b.t;

SELECT current_database(), current_schema();

SET schema = 'pg_catalog';

CREATE TABLE c.t(id INTEGER);

CREATE TABLE lake.s3tablescatalog.salesdemo.retail.widget_sales(id INTEGER);

CREATE SCHEMA lake.recreated;

EXECUTE list_recreated;

SHOW TABLES FROM s3tablescatalog.salesdemo.retail;

SHOW TABLES FROM lake;

CREATE TABLE lake."a.b"."c,d"."e""f".quoted_table(i INTEGER);

SELECT database_name, schema_name, table_name FROM duckdb_tables()
WHERE table_name IN ('t1','t2') ORDER BY table_name;

DROP TABLE s1.child.t1;

SELECT count(*) FROM duckdb_tables() WHERE table_name = 't2';

SELECT count(*) FROM duckdb_schemas() WHERE database_name = 'memory' AND schema_name IN ('s1','child');

SELECT memory.s1.s2.tbl.i FROM s1.s2.tbl;

SELECT tbl.s.b FROM s1.s2.tbl;

SELECT s2.tbl FROM s1.s2.tbl;

INSERT INTO s1.s2.dup VALUES (100);

CREATE SCHEMA s4;

SELECT s1.s2.dup.a AS x, s4.s2.dup.a AS y FROM s1.s2.dup, s4.s2.dup;

SELECT * FROM s1.child.t1 ORDER BY i;

INSERT INTO s1.child.t1 VALUES (99, 'z') RETURNING i, s;

CREATE TABLE s1.child.t2(i INTEGER, v INTEGER);

SELECT name, type FROM pragma_table_info('s1.child.t1');

INSERT INTO s1.child.t1 VALUES (42, 'tx');

UPDATE parent.child.t1 SET s = 'updated' WHERE i = 1;

INSERT INTO parent.child.big SELECT * FROM range(200000);

INSERT INTO parent.child.t1 VALUES (5, 'e');

CREATE TABLE parent.child.t2(j INTEGER);

SELECT count(*) FROM duckdb_tables() WHERE table_name IN ('t2','wal_table');

CREATE TABLE p2.c2.tbl(i INTEGER);

CREATE SCHEMA db.s1;

SELECT * FROM db.s1.s2.v;

CREATE SCHEMA s3;

SELECT * FROM db.s1.s2.v_default;

CREATE SCHEMA db.p;

CREATE VIEW db.p.s.v_table AS SELECT x FROM p.s.t;

SELECT z FROM db.p.s.v_table_function;

CREATE MACRO q.r.g() AS 33;

CREATE TABLE p.s.t AS SELECT 103 AS x;

USE db;

CREATE VIEW v_top AS SELECT db.s.f() AS y;

USE other;

SELECT schema_name, index_name FROM duckdb_indexes() WHERE index_name = 'idx';

ALTER TABLE parent.child.alt RENAME TO t2;

COMMENT ON COLUMN parent.child.t2.i IS 'nested column';

SELECT comment FROM duckdb_tables() WHERE table_name = 't2';

DROP VIEW parent.child.v2;

DROP INDEX parent.child.idx;

SELECT count(*) FROM duckdb_sequences();

SELECT count(*) FROM duckdb_tables();

CREATE TABLE s2.x.t(i INTEGER);

DROP TABLE s1.x.t;

SELECT schema_name, parent_schema FROM duckdb_schemas() WHERE schema_name IN ('parent','child','grandchild') ORDER BY schema_name;

CREATE SCHEMA otherdb.frontier;

CREATE TABLE otherdb.p.frontier.t AS SELECT 42 AS n;

SELECT n FROM otherdb.p.frontier.t ORDER BY n;

CREATE SCHEMA db2.leaf;

CREATE SCHEMA db2.leaf.leaf;

CREATE TABLE IF NOT EXISTS db2.q.leaf.s AS SELECT 7 AS n;

CREATE OR REPLACE TABLE db2.q.leaf.t AS SELECT 11 AS n;

CREATE TABLE u AS SELECT 42 AS n;

CREATE TABLE pdb.frontier.t AS SELECT 99 AS n;

SELECT n FROM pdb.p.frontier.t;

CREATE TEMP TABLE tshadow AS SELECT 2 AS n;

CREATE SCHEMA "sch,ema""name";

CREATE SCHEMA prequotedsuffix;

EXECUTE stmt;

SELECT currval('scenario_id');

DETACH v15;

CHECKPOINT v15;

CREATE SEQUENCE up INCREMENT BY 1 NO MAXVALUE START 9223372036854775806;

SELECT nextval('down');

SELECT nextval('temp_down');

CREATE SEQUENCE edge_called;

SELECT setval('edge_called_down', -9223372036854775808);

CREATE SEQUENCE nearly_whole INCREMENT BY 2 MINVALUE -9223372036854775808 MAXVALUE 9223372036854775806 START 9223372036854775806;

CREATE SEQUENCE wal_up START 9223372036854775807;

CREATE SEQUENCE up START 9223372036854775806;

SELECT currval('up'), currval('down'), currval('wal_up');

SELECT nextval('seq1') from generate_series(0,20);

create sequence seq4 INCREMENT BY -1 MINVALUE -9223372036854775808 MAXVALUE -9223372036854775800;

create sequence seq7 INCREMENT BY -9223372036854775808 MINVALUE -9223372036854775808 MAXVALUE -9223372036854775800;

SELECT setval('seq9', -9223372036854775808, false);

CREATE SEQUENCE myseq;

SELECT setval('myseq', 42, true);

CREATE SEQUENCE myseq MINVALUE 10 MAXVALUE 20;

SELECT setval(NULL, 42, true);

SELECT setval(NULL, NULL);

CREATE SEQUENCE persisted_seq;

DROP SEQUENCE persisted_seq;

INSERT INTO t VALUES (42, true), (NULL, true), (10, NULL);

DROP SEQUENCE t_seq;

CREATE SEQUENCE IF NOT EXISTS seq;

SELECT nextval(NULL);

SELECT nextval('"seq"');

CREATE SEQUENCE seq MAXVALUE 2 CYCLE;

CREATE SEQUENCE seq INCREMENT 1 MAXVALUE 3 START 2 CYCLE;

CREATE SEQUENCE b.seq;

SELECT currval('"a"."seq"'), currval('"b".seq');

CREATE SEQUENCE seq NO MAXVALUE START WITH -9223372036854775808;

INSERT INTO strings VALUES ('seq'), ('seq2');

CREATE SEQUENCE fresh;

SELECT database_name, schema_name, table_name FROM duckdb_tables() WHERE table_name = 't1' ORDER BY ALL;

SELECT count(*) FROM duckdb_tables() WHERE table_name LIKE 't1%';

SELECT table_name FROM duckdb_tables() WHERE table_name = NULL;

SELECT count(*) FROM duckdb_views() WHERE lower(view_name) = 'v1';

SELECT view_name FROM duckdb_views() WHERE view_name = NULL;

SELECT database_name, schema_name, column_name FROM duckdb_columns() WHERE table_name = 't1' ORDER BY ALL;

SELECT count(*) FROM duckdb_columns WHERE table_name = 't1b';

SELECT t.table_name FROM duckdb_tables t JOIN duckdb_columns c ON t.table_oid = c.table_oid
WHERE t.database_name = 'db1' AND c.column_name = 'i' ORDER BY t.table_name;

EXPLAIN SELECT schema_name FROM duckdb_tables() WHERE lower(table_name) = 't1';

EXPLAIN ANALYZE SELECT table_name FROM duckdb_tables() WHERE database_name = 'db1' AND schema_name = 's1' AND table_name = 't1';

SELECT table_name FROM duckdb_tables WHERE lower(schema_name) = lower('S1') ORDER BY database_name, table_name;

SELECT table_name FROM duckdb_tables
WHERE database_oid = (SELECT database_oid FROM duckdb_databases WHERE database_name = 'db1')
  AND schema_oid = (SELECT oid FROM duckdb_schemas WHERE database_name = 'db1' AND schema_name = 's2');

SELECT database_name, table_name FROM duckdb_tables WHERE schema_name = 's1' AND table_name = 't1' AND database_name = 'db1';

SELECT comment FROM duckdb_views WHERE view_name = 'v1' ORDER BY database_name;

EXPLAIN SELECT schema_name FROM duckdb_tables WHERE table_name = 't1';

EXPLAIN ANALYZE SELECT table_name FROM duckdb_tables WHERE lower(schema_name) = 's1';

EXECUTE p('s2');

SELECT table_name FROM duckdb_tables WHERE schema_name = 'nope';

CREATE SCHEMA db3."b";

CREATE TABLE db3."C".tc(i INTEGER);

SELECT table_name FROM duckdb_tables WHERE schema_name = 'O''Brien' AND database_name = 'db1';

CREATE TABLE "2"."1"."3"(j INTEGER);

CREATE VIEW "1".v AS SELECT 1 AS c1;

EXPLAIN ANALYZE SELECT table_name FROM duckdb_tables() WHERE TRY_CAST(schema_name AS INTEGER) = 1;

EXPLAIN SELECT schema_name FROM duckdb_functions() WHERE function_name = 'm1';

EXPLAIN SELECT trigger_name FROM duckdb_triggers() WHERE comment = 'x';

SELECT database_name, schema_name, index_name FROM duckdb_indexes() WHERE table_name = 't1' ORDER BY ALL;

SELECT database_name, schema_name, trigger_name FROM duckdb_triggers() WHERE table_name = 't1' ORDER BY ALL;

SET VARIABLE db2_oid = (SELECT database_oid FROM duckdb_databases() WHERE database_name = 'db2');

SELECT count(*) FROM duckdb_functions() WHERE function_name = 'm1';

SELECT database_name, schema_name, trigger_name FROM duckdb_triggers() WHERE schema_name = 'child' ORDER BY ALL;

SELECT count(*) = count(DISTINCT (function_oid, parameters)) FROM full_duckdb_functions WHERE database_name IN ('db1', 'db2');

SELECT database_name, schema_name FROM duckdb_schemas() WHERE oid = getvariable('s2_oid');

EXPLAIN ANALYZE SELECT * FROM duckdb_sequences() WHERE database_name = 'db1' AND schema_name = 's1' AND sequence_name = 'seq1';

EXPLAIN ANALYZE SELECT * FROM duckdb_schemas() WHERE database_name = 'db1';

EXPLAIN ANALYZE SELECT sequencename FROM pg_catalog.pg_sequences WHERE schemaname = 's2';

SELECT schema_name FROM information_schema.schemata WHERE catalog_name = 'db1' AND schema_name = 's1';

ATTACH ':memory:' AS aaa;

CREATE TABLE s.c(k INTEGER NOT NULL);

set variable x = 5;

select "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" from integers2;

CREATE TABLE test AS (SELECT string_agg(range::VARCHAR, '🦆 ') AS s, mod(range, 10000) xx FROM range(50000) GROUP BY xx);

SELECT count(*) FROM test3;

SELECT * FROM test;

CREATE TABLE test (a INTEGER DEFAULT 1+1, b INTEGER);

SELECT * FROM test ORDER BY 1;

CREATE TABLE test (a DOUBLE DEFAULT random(), b INTEGER);

INSERT INTO uuids (a) VALUES (42);

INSERT INTO uuids2 (a) VALUES (1);

SELECT v, a FROM t;

SELECT v, a FROM t2;

insert into x default values returning (i);

insert into x default values on conflict do nothing;

ALTER TABLE t ADD COLUMN j INTEGER;

DROP TABLE t2;

CREATE INDEX IF NOT EXISTS i_index ON integers(i);

CREATE UNIQUE INDEX IF NOT EXISTS i_index ON integers(i);

CREATE TABLE integers2 AS SELECT i, i+2 AS j FROM integers;

CREATE TABLE IF NOT EXISTS integers(i INTEGER, j INTEGER);

DROP TABLE IF EXISTS no_such_scheme.integers;

INSERT INTO integers VALUES (33);

SELECT "table ""."."col "".", "col ""." FROM "table "".";

SELECT count(*) FROM duckdb_tables WHERE table_name = '''QuotedName''';

CREATE TABLE test_catalog.main.existing_table(i INTEGER);

CREATE SCHEMA out_of_path;

CREATE TABLE out_of_path.oop_table(k INTEGER);

INSERT INTO test_table (i) VALUES (1);

INSERT INTO out_of_path.oop_table (k) VALUES (8), (9);

DELETE FROM main_table WHERE j=5;

SELECT k FROM out_of_path.oop_table;

UPDATE main.main_table SET j=600 WHERE j=60;

SELECT * FROM temp.test_temp_table;

CREATE VIEW main.main_view AS SELECT * FROM main.main_table;

SELECT * FROM main_view;

DROP VIEW out_of_path.oop_view;

SELECT main_macro(1, 2);

SELECT out_of_path.oop_macro(1, 2);

CREATE SEQUENCE test_sequence2;

SELECT main.nextval('test_sequence');

DROP SEQUENCE test.test_sequence2;

ALTER TABLE main_table ADD COLUMN l INTEGER;

DROP TABLE main_table;

CREATE TABLE test_table3(i INTEGER);

CREATE TABLE main.main_table2(i INTEGER);

CREATE SCHEMA test2;

CREATE SCHEMA test4;

SET SEARCH_PATH = 'test';

SET SCHEMA 'main';

SELECT pg_catalog.CURRENT_SCHEMAS(false);

SELECT current_schemas(false);

SELECT i FROM main_table;

SELECT in_test FROM table_with_same_name;

SET search_path = pg_catalog;

DROP SCHEMA test;

DROP SCHEMA test CASCADE;

CREATE TEMPORARY TABLE main.integersy(i INTEGER);

CREATE SCHEMA temp;

CREATE TEMPORARY TABLE temp.integersx(i INTEGER);

CREATE TEMPORARY TABLE integers2(i INTEGER);

SELECT i from integers2;

SELECT i from integers3;

SELECT index_name, database_name='temp' FROM duckdb_indexes() ORDER BY index_name;

CREATE TABLE ✍(🔑 INTEGER PRIMARY KEY, 🗣 varchar(64));

INSERT INTO ✍ VALUES (1, 'Herman Melville'), (2, 'Lewis Carroll');

SELECT 👤.🗣, 👤🏠📕.⭐ FROM 👤🏠📕 JOIN 📕 ON 👤🏠📕.📕 = 📕.🔑 JOIN 👤 ON 👤🏠📕.👤=👤.🔑 WHERE 📕.💬 = 'Moby Dick' ORDER BY 👤.🗣;

INSERT INTO tbl VALUES (42);

CREATE SCHEMA nested_view_db.outer_schema.inner_schema;

CREATE TABLE IF NOT EXISTS test (val INTEGER);

CREATE OR REPLACE VIEW foo2 AS (SELECT * FROM foo);

CREATE TABLE integers(i INTEGER, j INTEGER);

SELECT SUM(j) FROM v1;

CREATE VIEW v3 AS SELECT * FROM v1;

SELECT * FROM v1 ORDER BY i;

CREATE SECURE RECURSIVE VIEW rv(n) AS SELECT 1 UNION ALL SELECT n + 1 FROM rv WHERE n < 3;

SELECT v2.a, v2.b, other.k FROM v2 JOIN other ON v2.a = other.i ORDER BY 1;

CREATE TABLE secure(secure INTEGER);

CREATE VIEW rv AS SELECT * FROM integers;

EXPLAIN SELECT * FROM sv WHERE i = 42;

SELECT count(*) FROM tv;

create or replace view v1 as
from (select col+5 from s1.t1);

CREATE TABLE t1(i INTEGER);

CREATE VIEW v3 (v3c1, v3c2) AS SELECT v2c1, v2c3 FROM v2 WHERE v2c1 > 43;

SELECT j FROM v1 WHERE j > 41;

CREATE OR REPLACE VIEW v1 AS SELECT 42;

CREATE VIEW v1 (j, "j2") AS SELECT i,i+1, i+2 FROM t1;

DROP VIEW df;

from duplicate_column_view;

DROP TABLE t1;

ALTER TABLE t1 ALTER i TYPE VARCHAR;

create schema my_schema;

drop schema my_schema cascade;

create or replace table "table name" (
	"column name 1" integer,
	"column name 2" varchar
);

create schema "schema name";

CREATE TABLE db1.s1.t(i INTEGER);

CREATE VIEW db1.v_colref AS SELECT db1.t.i FROM db1.t;

CREATE VIEW db1.v_deferred WITH (DEFER_BINDING) AS SELECT * FROM db1.t;

SELECT * FROM db2.v_full;

SELECT * FROM db2.s1.v_schema;

CREATE VIEW db2.v_other AS SELECT * FROM db2.t UNION ALL SELECT * FROM other.t;

CREATE TABLE db1.t2(x INTEGER, y INTEGER);

CREATE VIEW db1.v_unpivot AS UNPIVOT db1.t ON x INTO NAME n VALUE val;

CREATE VIEW db1.v_entry AS UNPIVOT db1.t ON (db1.main.identity(x)) INTO NAME n VALUE val;

SELECT * FROM db2.v_joined;

CREATE VIEW IF NOT EXISTS v1 AS SELECT 84;
