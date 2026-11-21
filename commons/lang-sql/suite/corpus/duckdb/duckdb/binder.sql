SELECT a % 2 AS x, COUNT(*) AS cnt
FROM (VALUES (1),(2),(3),(4)) t(a)
GROUP BY alias.x
ORDER BY x;

SELECT (a/2)::INT AS "Half", COUNT(*) AS c
FROM (VALUES (1),(2),(3),(4)) t(a)
GROUP BY alias."Half"
ORDER BY "Half";

CREATE TABLE alias (g INT);

INSERT INTO alias VALUES (1), (1), (2);

SELECT g AS x, COUNT(*) c FROM alias
GROUP BY alias.g
ORDER BY x;

SELECT a % 2 AS x, SUM(a) AS s
FROM (VALUES (1),(2),(3),(4)) t(a)
GROUP BY alias.x
HAVING alias.s >= 6
ORDER BY x;

SELECT a + 1 AS x, alias.x % 2 AS y, SUM(a) AS s
FROM (VALUES (1),(2),(3),(4)) t(a)
GROUP BY a
HAVING alias.s > 2
ORDER BY y;

SELECT (a/2)::INT AS "Half", COUNT(*) AS c
FROM (VALUES (1),(2),(3),(4)) t(a)
GROUP BY alias."Half"
HAVING alias.c >= 1
ORDER BY "Half";

SELECT g AS x, COUNT(*) c FROM alias
GROUP BY alias.g
HAVING alias.c = 2
ORDER BY x;

SELECT c1, sum(c2) as c3 FROM VALUES ('a', 1), ('b', 2), ('b', 3), ('c', 4), ('d', null) AS t(c1, c2) group by c1 having c3.add(1) > 2 order by c1;

FROM VALUES ('CS', 'Bachelor'), ('CS', 'Bachelor'), ('CS', 'PhD'), ('Math', 'Masters') AS t(c1, c2)
SELECT c1, STRING_AGG(c2, ',' order by c2) as c3
GROUP BY c1
HAVING len(c3) > 7;

FROM VALUES ('CS', 'Bachelor'), ('CS', 'Bachelor'), ('CS', 'PhD'), ('Math', 'Masters') AS t(c1, c2)
SELECT c1, STRING_AGG(c2, ',' order by c2) as c3
GROUP BY c1
HAVING c3.len() > 7;

SELECT a AS x FROM (VALUES (3),(1),(2)) t(a)
ORDER BY alias.x;

SELECT a + 1 AS x, alias.x * 10 AS y FROM (VALUES (1),(3),(2)) t(a)
ORDER BY alias.y DESC;

SELECT a AS "MiXeD" FROM (VALUES (2),(1)) t(a)
ORDER BY alias."MiXeD";

CREATE TABLE alias (v INT);

INSERT INTO alias VALUES (20), (10);

SELECT v AS x FROM alias
ORDER BY alias.v;

SELECT a, row_number() OVER (ORDER BY a) AS rn
FROM (VALUES (3),(1),(2)) t(a)
QUALIFY alias.rn <= 2
ORDER BY a;

SELECT a + 1 AS x, row_number() OVER (ORDER BY alias.x) AS rx
FROM (VALUES (10),(20),(30)) t(a)
QUALIFY alias.rx = 2
ORDER BY a;

SELECT a AS "MiXeD", row_number() OVER (ORDER BY a) AS r
FROM (VALUES (2),(1)) t(a)
QUALIFY alias.r = 1
ORDER BY a;

INSERT INTO alias VALUES (2), (1), (3);

SELECT v AS x, row_number() OVER (ORDER BY v) r FROM alias
QUALIFY alias.r <= 2
ORDER BY v;

SELECT c1, row_number() over(partition BY c1 order by c2) as rk FROM VALUES ('a', 1), ('b', 2), ('b', 3), ('c', 4) AS t(c1, c2) qualify rk.add(1) > 2;

FROM VALUES ('CS', 'Bachelor'), ('CS', 'Bachelor'), ('CS', 'PhD'), ('Math', 'Masters') AS t(c1, c2)
SELECT list(c2) over(partition BY c1) AS "c3"
QUALIFY "c3".len() = 1;

SELECT
  a + 1 AS x,
  alias.x + 2 AS y
FROM (VALUES (42)) t(a);

SELECT
  a AS a,
  a + 1 AS x,
  alias.x + 2 AS y,
  alias.y * 2 AS z
FROM (VALUES (10)) t(a);

SELECT
  a + 1 AS x,
  alias.x AS x2,
  alias.x + alias.x AS xsum
FROM (VALUES (5)) t(a);

SELECT
  a + 1 AS "MiXeD",
  alias."MiXeD" + 1 AS y
FROM (VALUES (1)) t(a);

SELECT
  a,
  row_number() OVER (ORDER BY a) AS rn,
  alias.rn + 1 AS rn2
FROM (VALUES (3),(1),(2)) t(a)
ORDER BY a;

SELECT DISTINCT
  a AS x,
  alias.x + 0 AS y
FROM (VALUES (1),(1),(2)) t(a)
ORDER BY x;

SELECT
  a AS x,
  CASE WHEN alias.x % 2 = 0 THEN 'even' ELSE 'odd' END AS parity
FROM (VALUES (1),(2),(3)) t(a)
ORDER BY a;

SELECT
  'hi' AS s,
  alias.s || '!' AS ex
FROM (VALUES (1)) t(a);

CREATE TABLE alias (col1 INT, col2 INT);

INSERT INTO alias VALUES (11, 22);

SELECT alias.col1, alias.col2 FROM alias;

SELECT col1 * 10 AS col2, alias.col2 AS projected_col2 FROM alias;

SELECT 'AbC' AS s, alias.s.lower();

SELECT a AS x FROM (VALUES (1),(2),(3)) t(a)
WHERE alias.x > 1
ORDER BY a;

SELECT a + 1 AS x, alias.x * 2 AS y FROM (VALUES (1),(2)) t(a)
WHERE alias.y >= 6
ORDER BY a;

SELECT a AS "MiXeD" FROM (VALUES (0),(1)) t(a)
WHERE alias."MiXeD" = 1;

INSERT INTO alias VALUES (10), (20);

SELECT v AS x FROM alias
WHERE alias.v > 10
ORDER BY v;

create table ss_items as select 1 item_id, 10 ss_item_rev;

create table cs_items as select 1 item_id, 100 cs_item_rev;

select ss_items.item_id
from ss_items,cs_items
where ss_items.item_id = cs_items.item_id
order by item_id;

create table test(a int);

insert into test values (2), (1), (3);

select a as "user" from test group by "user";

select a as "user" from test group by "user" having "user"=1;

select a as "user" from test order by "user";

select a as "user" from test group by "user" order by "user";

create table t(i int);

INSERT INTO t VALUES (42);

SELECT COUNT(*) FROM t, t;

SELECT * FROM (SELECT 42 x) t, (SELECT 84 y) t;

SELECT t.x, t.y FROM (SELECT 42 x) t, (SELECT 84 y) t;

CREATE TABLE tbl(i INT);

SELECT * FROM (SELECT 1, 2) t(a, "b c");

WITH x(a) AS (SELECT 42) SELECT a FROM x;

CREATE TABLE binder_values(i INTEGER, j INTEGER);

CREATE TABLE merge_target(i INTEGER);

CREATE TABLE merge_source(i INTEGER);

with stage as (
      select
          [1,2,3] as c1,
          [4,5,6] as c2
)
select
     list_transform(
       c1,
       lambda x: list_bool_or(
          list_transform(
            c2,
            lambda y: y == x
          )
       )
     ) as c3
from stage;

select list_transform(
           [1,2,3],
           lambda x: list_max(
                list_transform([4,5,6], lambda y: y + x)
           )) as result;

CREATE MACRO list_contains_macro(x, y) AS (SELECT list_contains(x, y));

CREATE TABLE tbl(a int[]);

INSERT INTO tbl VALUES ([5, 4, 3]), ([1, 2, 3]), (NULL), ([NULL, 101, 12]);

SELECT list_transform(a, lambda x, i: x + i + list_any_value(a)) FROM tbl;

select ['a a ', ' b ', ' cc'].list_transform(lambda x: nullif(trim(x), '')) as trimmed_and_nulled;

select ['a a ', ' b ', ' cc'].list_transform(lambda x: x.trim().nullif('')) as trimmed_and_nulled;

select ['a a ', ' b ', ' cd'].list_transform(lambda x: x.trim().nullif('').reverse()) as trimmed_and_nulled;

create table my_functions as select 'my_name' as function_name;

select
    function_name as raw,
    replace(raw, '_', ' ') as prettier
from my_functions
group by all;

CREATE SCHEMA IF NOT EXISTS prd;

CREATE TABLE prd.ad_stats_v(event_date DATE, app VARCHAR, country VARCHAR, platform VARCHAR);

select event_date, country
FROM prd.ad_stats_v
GROUP by event_date, prd.ad_stats_v.country
order by country;

select event_date, ad_stats_v.country
FROM prd.ad_stats_v
GROUP by event_date, prd.ad_stats_v.country
order by ad_stats_v.country;

select event_date, prd.ad_stats_v.country
FROM prd.ad_stats_v
GROUP by event_date, prd.ad_stats_v.country;

SELECT typeof(1::TINYINT + 100);

SELECT typeof(1::TINYINT + 10000);

SELECT typeof(1.05 + 1);

SELECT typeof(1 + 1);

SET legacy_disable_null_type=true;

CREATE TABLE t AS SELECT NULL c;

SELECT TYPEOF(c) FROM t;

create table customers (name varchar, age integer, something_easy_to_type_wrong integer, city varchar);

create table zipcodes (city varchar, zipcode varchar);

SET TimeZone='America/Los_Angeles';

create or replace table foo as select 'd' as a, 'e' as b, 'f' as c;

select * similar to '(a|c)' from foo;

select * not similar to '(a|c)' from foo;

SELECT * similar to 'b' FROM (select * not similar to '(a|c)' from foo);

CREATE TABLE t0(c0 VARCHAR);

INSERT INTO t0(c0) VALUES (0.1);

SELECT * FROM t0 WHERE REGEXP_MATCHES(t0.c0, '1');

SELECT * FROM t0 WHERE NOT REGEXP_MATCHES(t0.c0, '1');

SELECT 'aaa' NOT SIMILAR TO '[b-z]{3}';

CREATE TABLE integers(col1 INTEGER, col2 INTEGER, k INTEGER);

INSERT INTO integers VALUES (1, 2, 3);

SELECT * LIKE 'col%' FROM integers;

CREATE TABLE integers AS SELECT 42 AS i, '5' AS v;

SET old_implicit_casting=true;

SELECT i[1] FROM integers;

SELECT i >= v FROM integers;

SELECT [i, v] FROM integers;

create table t1 as select * from values ('1-2', '3-4', 'a-z', NULL) as r(v);

SELECT list_extract(string_split(v, '-'), 1) FROM t1;

SET old_implicit_casting = true;

CREATE TABLE src("Name" VARCHAR, CreatedAt TIMESTAMP, userID VARCHAR, "Version" VARCHAR, Clients BIGINT, HasDocumentation BOOLEAN, HasCustomAddress BOOLEAN, HasHostname BOOLEAN, RunningContainers BIGINT, HasActions BOOLEAN);

CREATE VIEW model AS 
	SELECT DISTINCT on(userID,  CreatedAt::DATE)
	CreatedAt::DATE AS CreatedAt,
	"Version",
	Clients,
	HasCustomAddress, 
	HasHostname,
	RunningContainers, 
	HasDocumentation, 
	HasActions
FROM src 
WHERE name = 'events' 
ORDER BY userID, CreatedAt DESC;

SELECT HasCustomAddress, count(*) AS total_records 
FROM model 
WHERE  
1 = 1 AND 
CreatedAt >= '2023-12-01' AND
CreatedAt < '2023-12-13' 
GROUP BY HasCustomAddress;

CREATE TABLE test_alias(a INT, b VARCHAR);

INSERT INTO test_alias VALUES (1, 'hello'), (2, 'world'), (3, 'foo');

SELECT a, b || '!' AS greeting FROM test_alias GROUP BY a, b HAVING greeting.lower() != 'foo!' ORDER BY a;

SELECT a, b || '!' AS greeting FROM test_alias GROUP BY a, b HAVING alias.greeting.lower() != 'foo!' ORDER BY a;

SELECT a, (a*10)::VARCHAR AS big FROM test_alias WHERE big.length() > 1 ORDER BY a;

SELECT a, (a*10)::VARCHAR AS big FROM test_alias WHERE alias.big.length() > 1 ORDER BY a;

SELECT a, b, row_number() OVER (ORDER BY a)::VARCHAR AS rn FROM test_alias QUALIFY rn.length() > 0 ORDER BY a;

SELECT a, b, row_number() OVER (ORDER BY a)::VARCHAR AS rn FROM test_alias QUALIFY alias.rn.length() > 0 ORDER BY a;

SELECT a, b AS x, alias.x.upper() AS y FROM test_alias ORDER BY a;

SELECT a, sum(a) AS total FROM test_alias GROUP BY a HAVING alias.total > 1 ORDER BY a;

CREATE SCHEMA IF NOT EXISTS s1;

CREATE SCHEMA IF NOT EXISTS s2;

CREATE SCHEMA IF NOT EXISTS s3;

CREATE TABLE s1.tbl(i INT);

CREATE TABLE s2.tbl(i INT);

CREATE TABLE s3.tbl(i INT);

INSERT INTO s1.tbl VALUES (10);

INSERT INTO s2.tbl VALUES (100);

INSERT INTO s3.tbl VALUES (1000);

INSERT INTO tbl VALUES (1);

SELECT * FROM tbl, s1.tbl, s2.tbl;

SELECT * FROM tbl, s1.tbl, s2.tbl, s3.tbl;

SELECT s1.tbl, s2.tbl, s3.tbl FROM s1.tbl, s2.tbl, s3.tbl;

CREATE TABLE s1.t AS SELECT 1 id, 's1.t' payload UNION ALL SELECT 10 id, 'AAA' payload;

CREATE TABLE s2.t AS SELECT 1 id, 's2.t' payload2 UNION ALL SELECT 100 id, 'BBB' payload2;

CREATE TABLE s3.t AS SELECT 1 id, 's3.t' payload3 UNION ALL SELECT 1000 id, 'CCC' payload3;

SELECT * FROM s1.t JOIN s2.t USING (id) JOIN s3.t USING (id);

SELECT id FROM s1.t JOIN s2.t USING (id) JOIN s3.t USING (id);

SELECT * FROM s1.t NATURAL JOIN s2.t NATURAL JOIN s3.t;

SELECT id, s1.t.id, s2.t.id, s3.t.id, s1.t.payload, s2.t.payload2, s3.t.payload3
FROM s1.t LEFT JOIN s2.t USING (id) LEFT JOIN s3.t USING (id)
ORDER BY ALL;

SELECT id, s1.t.id, s2.t.id, s3.t.id, s1.t.payload, s2.t.payload2, s3.t.payload3
FROM s1.t RIGHT JOIN s2.t USING (id) RIGHT JOIN s3.t USING (id)
ORDER BY ALL;

SELECT id, s1.t.id, s2.t.id, s3.t.id, s1.t.payload, s2.t.payload2, s3.t.payload3
FROM s1.t FULL OUTER JOIN s2.t USING (id) FULL OUTER JOIN s3.t USING (id)
ORDER BY ALL;

CREATE OR REPLACE TABLE s1.tbl(col INT);

CREATE OR REPLACE TABLE s2.TBL(COL INT);

CREATE OR REPLACE TABLE s3.Tbl(Col INT);

CREATE TABLE depdelay_minutes(depdelay_minutes INTEGER);

CREATE TABLE lineitem(i INTEGER);

create schema s1;

create table s1.my_lineitem(i int);

create table s1.orders(i int);

select '01'=1;

SELECT cos('0');

select date '1992-01-01'>'1991-01-01';

select date '2023-12-11' < '2023-12-11 15:54:45.119';

CREATE TABLE test (
    "date" DATE,
    value VARCHAR
);

INSERT INTO test VALUES ('2023-08-01', 1), ('2023-08-02', 2), ('2023-08-03', 3), ('2023-08-04', 4), ('2023-08-05', 5), ('2023-08-06', 6), ('2023-08-07', 7);

SELECT * FROM test WHERE date >= '2023-08-05 00:00:00' AND date < '2023-08-06 00:00:00';

SELECT '[hello]'[1];

SELECT list('hello world');

select 1 IN ('1', '2');

SELECT COALESCE(1, '1');

select i=1 from (values ('01')) t(i);

select i IN (1) from (values ('01')) t(i);

WITH cte AS (SELECT '01' AS s)
SELECT 1=s AS in_res FROM cte;

WITH cte AS (SELECT '01' AS s)
SELECT 1 IN (s) AS in_res FROM cte;

SET default_null_order='nulls_first';

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (1), (2), (3), (NULL);

SELECT t.k FROM integers AS 't'('k') ORDER BY ALL;

SELECT t.k FROM integers t('k') ORDER BY ALL;

CREATE VIEW s1.v AS SELECT 42 c;

CREATE TABLE s1.t AS SELECT 42 c;

SELECT s1.v.c, v.c, c FROM s1.v;

SELECT s1.t.c, t.c, c FROM s1.t;

SELECT i % 2 AS p, SUM(i) AS sum_i FROM integers GROUP BY p ORDER BY 1;

SELECT alias(i % 2) AS p, alias(SUM(i)) AS sum_i FROM integers GROUP BY p ORDER BY 1;

SELECT i + 1 + 1 + 1 AS k, abs(i) AS l FROM integers WHERE i=1 ORDER BY 1;

SELECT alias(i + 1 + 1 + 1) AS k, alias(abs(i)) AS l FROM integers WHERE i=1 ORDER BY 1;

SELECT alias(i) AS k, alias(i IN (1)) AS l, alias(i >= 10) AS m, alias(1=0) AS n FROM integers WHERE i=1 ORDER BY 1;

SELECT alias(CASE WHEN i=1 THEN 19 ELSE 0 END) AS k, alias(i::VARCHAR) AS l FROM integers WHERE i=1 ORDER BY 1;

CREATE TABLE test (a INTEGER, b INTEGER);

INSERT INTO test VALUES (42, 10), (43, 100);

SELECT a, b, a * 2 AS c, b * (a * 2) AS d FROM test ORDER BY a;

SELECT alias(a), alias(b), alias(a * 2) AS c, alias(b * (a * 2)) AS d FROM test ORDER BY a;

select i as b, b as c, c as d, d as e from integers where e = 3;

CREATE OR REPLACE TABLE tbl (example VARCHAR);

INSERT INTO tbl VALUES ('hello');

SELECT (WITH keys AS (
    		SELECT example AS k
    	), nonNull AS (
    		SELECT keys.k, example AS v
    		FROM keys
    		WHERE v IS NOT NULL
    	)
    	SELECT nonNull.v
    	FROM nonNull
)
FROM tbl;

CREATE OR REPLACE TABLE testjson (example JSON);

INSERT INTO testjson VALUES ('{ "location" : { "address" : "123 Main St" }, "sampleField" : null, "anotherField" : 123, "yetAnotherField" : "abc" }');

SELECT (WITH keys AS (SELECT unnest(json_keys(example)) AS k), nonNull AS (
    		SELECT keys.k, example->keys.k AS v
    		FROM keys WHERE nullif(v, 'null') IS NOT NULL
    	)
    	SELECT json_group_object(nonNull.k, nonNull.v)
    	FROM nonNull
)
FROM testjson;

CREATE OR REPLACE MACRO strip_null_value(jsonValue) AS (
	WITH keys AS (SELECT UNNEST(json_keys(jsonValue)) AS k),
		nonNull AS (
		SELECT keys.k, jsonValue->keys.k AS v
		FROM keys WHERE nullif(v, 'null') IS NOT NULL
	)
	SELECT json_group_object(nonNull.k, nonNull.v)
	FROM nonNull
);

SELECT strip_null_value('{ "location" : { "address" : "123 Main St" }, "sampleField" : null, "anotherField" : 123, "yetAnotherField" : "abc" }')
AS example;

SELECT strip_null_value(example) FROM testjson;

WITH x AS (
	SELECT '{ "location" : { "address" : "123 Main St" }, "sampleField" : null, "anotherField" : 123, "yetAnotherField" : "abc" }'
	AS example)
SELECT strip_null_value(x.example) AS test
FROM x;

CREATE TABLE test ("HeLlO" INTEGER);

INSERT INTO test VALUES (1);

SELECT HeLlO FROM test;

SELECT "HeLlO" FROM test;

SELECT alias(HeLlO) FROM test;

SELECT alias(x) FROM (SELECT HeLlO as x FROM test) tbl;

SELECT test.HeLlO FROM test;

SELECT test."HeLlO" FROM test;

UPDATE test SET hello=3;

DROP TABLE test;

CREATE TABLE test1("HeLlO" INTEGER);

CREATE TABLE test2("HELLO" INTEGER);

SELECT test1.HeLlO FROM test1, test2;

SELECT test1."HeLlO" FROM test1, test2;

SELECT test2.HeLlO FROM test1, test2;

SELECT test2."HeLlO" FROM test1, test2;

SELECT * FROM test1 JOIN test2 USING (hello);

SELECT hello FROM (SELECT 42) tbl("HeLlO");

CREATE TABLE case_test(MixedCase INTEGER);

CREATE TABLE case_output AS
SELECT mixedcase
FROM case_test;

SELECT column_name
FROM duckdb_columns()
WHERE table_name = 'case_output';

CREATE TABLE case_alias_output AS
SELECT mixedcase AS custom_name
FROM case_test;

SELECT column_name
FROM duckdb_columns()
WHERE table_name = 'case_alias_output';

create table t1(col1 varchar collate nocase);

create table t2(col1 varchar collate nocase);

insert into t1 values ('a');

insert into t2 values ('A');

select upper(col1)
from (
	select *
	from t1
	union
	select *
	from t2
) d;

SET explain_output='physical_only';

explain select upper(col1)
from (
	select *
	from t1
	union
	select *
	from t2
) d;

SELECT 'test' || ' more testing' AS added, added.substr(5) AS my_substr;

CREATE TABLE varchars(v VARCHAR);

INSERT INTO varchars VALUES ('>>%Test<<'), ('%FUNCTION%'), ('Chaining');

SELECT v.lower() FROM varchars;

SELECT
	v.trim('><') AS trim_inequality,
	trim_inequality.replace('%', '') AS only_alphabet,
	only_alphabet.lower() AS lower
FROM varchars;

SELECT
	varchars.v.trim('><') AS trim_inequality,
	trim_inequality.replace('%', '') AS only_alphabet,
	only_alphabet.lower() AS lower
FROM varchars;

DELETE FROM varchars;

INSERT INTO varchars VALUES ('Test Function Chaining Alias');

SELECT
	v.split(' ')::VARCHAR strings,
	strings.lower() lower,
	lower.upper() upper
FROM varchars;

SELECT
	v.split(' ') strings,
	strings.apply(lambda x: x.lower()).filter(lambda x: x[1] == 't') lower,
	strings.apply(lambda x: x.upper()).filter(lambda x: x[1] == 'T') upper,
	lower + upper AS mix_case_srings
FROM varchars;

PREPARE v1 AS 
SELECT
	(?.split(' ')::VARCHAR).lower() lstrings,
	(?.split(' ')::VARCHAR).upper() ustrings,
	list_concat(lstrings::VARCHAR[], ustrings::VARCHAR[]) AS mix_case_srings;

EXECUTE v1('Hello World', 'test function chaining');

INSERT INTO varchars VALUES ('Another longggggg String');

SELECT
	v.split(' ') strings,
	strings.apply(lambda x: x.lower()).filter(lambda x: x[1] == 't' OR x[1] == 'a') lower,
	strings.apply(lambda x: x.upper()).filter(lambda x: x[1] == 'T' OR x[1] == 'A') upper,
	lower + upper AS mix_case_srings
FROM varchars
WHERE mix_case_srings[1] = 'test';

SELECT
	v.split(' ') strings,
	strings.apply(lambda x: x.lower()).filter(lambda x: x[1] == 't' OR x[1] == 'a') lower,
	strings.apply(lambda x: x.upper()).filter(lambda x: x[1] == 'T' OR x[1] == 'A') upper,
	lower + upper AS mix_case_srings
FROM varchars
WHERE mix_case_srings[1] = 'another';

WITH test AS (
    SELECT 'woot' AS my_column
)
FROM test
SELECT
	my_column.substr(2) AS partial_woot,
	partial_woot.substr(2) AS more_partially_woot
WHERE
    more_partially_woot = 'ot';

CREATE TABLE integers AS SELECT * FROM range(5) tbl(i);

SELECT i, COUNT(*) AS k FROM integers GROUP BY i HAVING k=1 ORDER BY i;

SELECT 1 AS i, COUNT(*) FROM integers GROUP BY i HAVING i=2;

SELECT i AS j, COUNT(*) AS i FROM integers GROUP BY j HAVING integers.i=1 ORDER BY i;

SELECT i AS j, COUNT(*) AS i FROM integers GROUP BY j HAVING j=1 ORDER BY i;

SELECT COUNT(i) AS j FROM integers HAVING j=5;

SELECT COUNT(i) AS i FROM integers HAVING i=5;

SELECT COUNT(i) AS i FROM integers GROUP BY i HAVING i=5;

SELECT COUNT(i) AS i FROM integers HAVING i=5 ORDER BY i;

SELECT COUNT(i) AS j FROM integers HAVING j=j;

SELECT COUNT(*) FROM (SELECT i, SUM(RANDOM()) AS k FROM integers GROUP BY i HAVING k=k) tbl(i, k);

create table test as select range i from range(3);

select test from test;

select test from main.test;

select main.test from main.test;

SELECT t FROM test AS t;

select t from (SELECT * FROM test) AS t;

WITH data AS (
    SELECT 1 as a, 2 as b, 3 as c
)
SELECT d FROM data d;

create table main as select 3 test;

select main.test from main, test;

select test from main, test;

create table structs as select {test: 4} main;

select main.test from structs, test;

create table tbl (str varchar);

insert into tbl values ('ABCDE'), ('aBcDe');

insert into tbl values ('àbcdë');

insert into tbl values ('ÀbCdÈ');

select * from tbl where str in ('AbCdE');

select * from tbl where str collate nocase in ('abcde');

select * from tbl where str collate noaccent in ('abcde');

select * from tbl where str collate nocase.noaccent in ('abcde');

select * from tbl where str not in ('abcde');

select * from tbl where str collate nocase not in ('abcde');

select * from tbl where str collate noaccent not in ('abcde');

select * from tbl where str collate nocase.noaccent not in ('abcde');

SELECT NULL;

SELECT NULL UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT NULL UNION ALL SELECT NULL;

SELECT NULL UNION ALL SELECT NULL UNION ALL SELECT NULL UNION ALL SELECT NULL UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT (SELECT NULL) UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT * FROM (SELECT NULL) tbl(i) UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT * FROM (SELECT (SELECT NULL) UNION ALL SELECT CAST(1 AS BOOLEAN)) tbl(i);

SELECT * FROM (SELECT NULL) tbl(i) UNION ALL SELECT NULL;

SELECT bool_and(i) FROM (SELECT * FROM (SELECT NULL) tbl(i) UNION ALL SELECT CAST(1 as BOOLEAN)) tbl(i);

SELECT * FROM (SELECT NULL) tbl(i), (SELECT NULL) tbl2(j);

SELECT bool_and(i), bool_and(j) FROM (SELECT NULL) tbl(i), (SELECT NULL) tbl2(j);

SELECT NULL as a, NULL as b, 1 as id UNION SELECT CAST(1 AS BOOLEAN) as a, CAST(0 AS BOOLEAN) as b, 2 as id;

SELECT CAST(1 AS BOOLEAN) as a, CAST(0 AS BOOLEAN) as b, 1 as id UNION SELECT NULL as a, NULL as b, 2 as id;

SELECT NULL::INTEGER as a, NULL::INTEGER as b, 1 as id UNION SELECT CAST(1 AS BOOLEAN) as a, CAST(0 AS BOOLEAN) as b, 2 as id;

SELECT CAST(1 AS BOOLEAN) as a, CAST(0 AS BOOLEAN) as b, 1 as id UNION SELECT NULL::INTEGER as a, NULL::INTEGER as b, 2 as id;

CREATE TABLE tbl AS SELECT NULL UNION ALL SELECT NULL;

SELECT * FROM tbl;

SELECT typeof(#1) FROM tbl LIMIT 1;

INSERT INTO tbl VALUES (NULL);

CREATE VIEW v1 AS SELECT NULL;

SELECT * FROM v1;

SELECT * FROM v1 UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT typeof(#1) FROM v1;

CREATE VIEW v2 AS SELECT NULL UNION ALL SELECT NULL;

SELECT * FROM v2;

SELECT * FROM v2 UNION ALL SELECT CAST(1 AS BOOLEAN);

SELECT typeof(#1) FROM v2 LIMIT 1;

SELECT [NULL];

SELECT [NULL] UNION ALL SELECT [True];

SELECT {'x': NULL};

SELECT {'x': NULL} UNION ALL SELECT {'x': True};

WITH cte AS (SELECT NULL)
SELECT * FROM cte;

create table test as select * from (values (42, 43), (44, 45)) v(i, j);

select i, sum(j) as s from test group by i order by #1;

INSERT INTO integers VALUES (1), (2), (3);

SELECT i + 1 AS a, a + 1 AS b FROM integers ORDER BY b;

SELECT i + 1 AS a, a + a AS b, b + b AS c, c + c AS d FROM integers ORDER BY b;

SELECT i + 1 AS i, i + 1 AS b FROM integers ORDER BY b;

create table orders as
select
    cast(random()*100 as integer) + 1 as customer_id,
    date '2020-01-01' + interval (cast(random()*365*10 as integer)) days as order_date,
    cast(random()*1000 as integer) as order_amount,
from range(0, 1000)
order by order_date;

select
    split(from0, ' ') as expr_parts,
    case
        try(expr_parts[6][1]::int)
        when 1                
        then 'NOT'
    end as dayname,
from (select '1 2 3 1 2 3 4 5 6' as from0);

select
    split('1 2 3', ' ') as expr_parts,
    try(expr_parts[1]::int) as try_val;

select
    split('1 2 x', ' ') as expr_parts,
    case
        when try(expr_parts[3]::int) is null
        then 'invalid'
        else 'valid'
    end as check_val;

SELECT i AS 'hello world' FROM integers;

SELECT i "hello world" FROM integers;

SELECT i AS "hello world" FROM integers;

SELECT "hello world".i FROM integers AS 'hello world';
