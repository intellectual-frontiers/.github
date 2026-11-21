SET debug_verify_serializer = true;

CREATE TABLE tbl(g INTEGER, s VARCHAR);

INSERT INTO tbl VALUES (1, 'a'), (1, 'A'), (1, 'Z'), (2, 'b'), (2, 'B');

SELECT count(DISTINCT s COLLATE NOCASE) FROM tbl;

SELECT count(DISTINCT s) FROM tbl;

SELECT len(list(DISTINCT s COLLATE NOCASE)), len(list(DISTINCT s)),
       len(list(DISTINCT s COLLATE NOCASE))
FROM tbl;

SELECT count(DISTINCT row(s)), len(list(DISTINCT row(s COLLATE NOCASE)))
FROM tbl;

SELECT len(list(DISTINCT row(s COLLATE NOCASE))), len(list(DISTINCT row(s))),
       len(list(DISTINCT row(s COLLATE NOCASE)))
FROM tbl;

SELECT len(list(DISTINCT row(s))), len(list(DISTINCT row(s COLLATE NOCASE)))
FROM tbl;

SELECT len(list(DISTINCT {'values': [s COLLATE NOCASE]})),
       len(list(DISTINCT {'values': [s]}))
FROM tbl;

SELECT count(DISTINCT v), len(list(DISTINCT v)), typeof(list(DISTINCT v))
FROM (VALUES (1::INTEGER::VARIANT), (1::BIGINT::VARIANT)) t(v);

SELECT g, len(list(DISTINCT s COLLATE NOCASE) FILTER (WHERE keep)),
       len(list(DISTINCT s) FILTER (WHERE keep))
FROM (VALUES (1, 'a', true), (1, 'A', true), (1, 'z', false),
             (2, 'b', false), (2, 'B', NULL)) t(g, s, keep)
GROUP BY g ORDER BY g;

SELECT count(DISTINCT v), len(list(DISTINCT v)), len(list(DISTINCT row(v)))
FROM (VALUES (row('a' COLLATE NOCASE)), (row('A' COLLATE NOCASE)),
             (row(NULL)), (NULL)) t(v);

SELECT count(DISTINCT s COLLATE NOCASE), len(list(DISTINCT s COLLATE NOCASE)),
       len(list(DISTINCT row(s COLLATE NOCASE)))
FROM tbl WHERE false;

CREATE SEQUENCE collation_sequence;

SELECT len(list(DISTINCT nextval('collation_sequence')::VARCHAR COLLATE NOCASE))
FROM range(3);

SELECT currval('collation_sequence');

PREPARE distinct_rows AS
SELECT len(list(DISTINCT row(s COLLATE NOCASE))), len(list(DISTINCT row(s)))
FROM (VALUES ($1::VARCHAR), ($2::VARCHAR)) t(s);

EXECUTE distinct_rows('a', 'A');

EXECUTE distinct_rows('a', 'b');

SELECT g, count(DISTINCT s COLLATE NOCASE) FROM tbl GROUP BY g ORDER BY g;

SELECT list_sort(list(DISTINCT s COLLATE NOCASE)) FROM (VALUES ('x'), ('Z')) t(s);

SELECT string_agg(DISTINCT s COLLATE NOCASE, ',' ORDER BY s COLLATE NOCASE) FROM (VALUES ('x'), ('Z')) t(s);

SELECT count(DISTINCT s COLLATE NOCASE), count(DISTINCT s) FROM (VALUES ('a'), ('A'), ('Z')) t(s);

SELECT count(DISTINCT s COLLATE NOCASE) FILTER (WHERE g = 1) FROM tbl;

SELECT count(DISTINCT s COLLATE NOCASE) FROM (VALUES ('a'), ('A'), (NULL)) t(s);

SELECT list_sort(list(DISTINCT s COLLATE NOCASE)) FROM (VALUES ('x'), (NULL), ('Z')) t(s);

SET default_collation='nocase';

SELECT count(DISTINCT s), len(list(DISTINCT s)), len(list(DISTINCT lower(s)))
FROM tbl;

SELECT list_sort(list(DISTINCT s)) FROM (VALUES ('x'), ('Z')) t(s);

SET default_collation='binary';

SELECT count(DISTINCT s COLLATE de), len(list(DISTINCT s COLLATE de)), len(list(DISTINCT s))
FROM (VALUES ('ä'), ('ä'), ('Z')) t(s);

SELECT count(*)
FROM (SELECT unnest(list(DISTINCT s COLLATE de)) AS s
      FROM (VALUES ('ä'), ('ä'), ('Z')) t(s)) result
WHERE s COLLATE "binary" IN ('ä', 'ä', 'Z');

SELECT list(DISTINCT s COLLATE de ORDER BY s COLLATE de),
       string_agg(DISTINCT s COLLATE de, ',' ORDER BY s COLLATE de)
FROM (VALUES ('GÖTHE'), ('Z'), ('GÖTHE')) t(s);

SELECT count(DISTINCT row(s COLLATE de)), len(list(DISTINCT row(s COLLATE de))),
       len(list(DISTINCT row(s)))
FROM (VALUES ('ä'), ('ä'), ('Z')) t(s);

SET default_collation = 'de';

SELECT count(DISTINCT s), len(list(DISTINCT s)), len(list(DISTINCT row(s)))
FROM (VALUES ('ä'), ('ä'), ('Z')) t(s);

SELECT list(DISTINCT s ORDER BY s) FROM (VALUES ('GÖTHE'), ('Z'), ('GÖTHE')) t(s);

SET default_collation = 'binary';

CREATE TABLE t0(c0 BOOLEAN, PRIMARY KEY(c0));

CREATE TABLE t63(c0 VARCHAR COLLATE C, PRIMARY KEY(c0));

insert into t0(c0) values (0.7);

insert into t63(c0) values ('1');

SELECT t63.c0 FROM t0 NATURAL LEFT JOIN t63;

CREATE TABLE t (id BIGINT, c0 VARCHAR COLLATE NOCASE);

INSERT INTO t VALUES (0, 'A'), (1, 'a'), (2, 'b'), (3, NULL), (4, NULL);

SELECT c0, count(*) AS n FROM t GROUP BY ALL ORDER BY n DESC, c0 NULLS LAST;

SELECT c0 AS k, count(*) FROM t GROUP BY ALL ORDER BY k NULLS LAST;

SELECT id > 1 AS big, c0, count(*) FROM t GROUP BY ALL ORDER BY ALL;

SELECT c0 || 'x' AS c, count(*) FROM t GROUP BY ALL ORDER BY ALL;

SELECT (SELECT t) AS s, count(*) FROM (VALUES ('10:00:00+00'::TIMETZ)) v(t) GROUP BY ALL;

SELECT (SELECT c0) AS k, count(*) FROM t GROUP BY ALL ORDER BY ALL;

SELECT id > 1 AS big, (SELECT c0) || 'x' AS k, count(*) FROM t GROUP BY ALL ORDER BY ALL;

SELECT c0 AS x, (SELECT x) AS k, count(*) FROM t GROUP BY ALL ORDER BY ALL;

PREPARE p AS SELECT (SELECT c0 || $1::VARCHAR) AS k, count(*) FROM t GROUP BY ALL ORDER BY ALL;

EXECUTE p('x');

EXECUTE p('y');

CREATE SEQUENCE seq;

SELECT ((nextval('seq') % 2) + i * 0)::VARCHAR COLLATE NOCASE AS k, count(*) FROM range(3) v(i) GROUP BY ALL ORDER BY k;

SELECT currval('seq');

CREATE SEQUENCE seq2;

SELECT (SELECT c0 || (nextval('seq2') * 0)) AS k, count(*) FROM t WHERE id < 2 GROUP BY ALL;

SELECT currval('seq2');

CREATE TABLE u (c VARCHAR COLLATE NOACCENT.NOCASE);

INSERT INTO u VALUES ('é'), ('E'), ('e');

SELECT count(*) FROM (SELECT c, count(*) FROM u GROUP BY ALL);

SELECT s, count(*) FROM (SELECT CASE WHEN id = 4 THEN NULL ELSE {'k': c0} END AS s FROM t) GROUP BY ALL ORDER BY ALL;

SELECT typeof(t), t, count(*) FROM (VALUES ('10:00:00+00'::TIMETZ)) v(t) GROUP BY ALL;

SELECT (c0 || NULL)::VARCHAR COLLATE NOCASE AS n, count(*) FROM t GROUP BY ALL;

CREATE TABLE t(v TIMETZ);

INSERT INTO t VALUES (TIMETZ '01:02:03');

SELECT (SELECT max(v) FROM t) AS g
FROM range(2)
GROUP BY (SELECT max(v) FROM t);

SELECT (SELECT max(v) FROM t) AS g
FROM range(2)
GROUP BY g;

SELECT (SELECT max(v) FROM t) AS g
FROM range(2)
GROUP BY 1;

CREATE TABLE t2(a TIMETZ, k INT);

INSERT INTO t2 VALUES (TIMETZ '01:02:03', 5), (TIMETZ '04:05:06+02', 6);

CREATE TABLE nums(n INT);

INSERT INTO nums VALUES (5);

SELECT CASE WHEN k IN (SELECT n FROM nums) THEN a ELSE NULL END AS g
FROM t2
GROUP BY CASE WHEN k IN (SELECT n FROM nums) THEN a ELSE NULL END
ORDER BY ALL;

SELECT (SELECT max(a) FROM t2 WHERE t2.k = r.k) AS g, count(*)
FROM (SELECT range % 2 + 5 AS k FROM range(4)) r
GROUP BY (SELECT max(a) FROM t2 WHERE t2.k = r.k)
ORDER BY ALL;

SELECT (SELECT max(v) FROM t) AS g
FROM range(2)
GROUP BY (SELECT max(v) FROM t)
HAVING (SELECT max(v) FROM t) = TIMETZ '01:02:03'
ORDER BY (SELECT max(v) FROM t);

SELECT (SELECT max(v) FROM t) AS g, count(*)
FROM range(2)
GROUP BY GROUPING SETS (((SELECT max(v) FROM t)), ())
ORDER BY ALL;

CREATE TABLE s(v VARCHAR COLLATE NOCASE);

INSERT INTO s VALUES ('UPPERCASE');

SELECT (SELECT max(v) FROM s) AS g
FROM range(2)
GROUP BY (SELECT max(v) FROM s);

SELECT (SELECT max(v) FROM s) AS g
FROM range(2)
GROUP BY (SELECT max(v) FROM s)
HAVING (SELECT max(v) FROM s) = 'uppercase';

SELECT (SELECT 'MiXeD') AS g
FROM range(2)
GROUP BY (SELECT 'MiXeD');

select 'ABC' collate nocase in (select 'aBc');

select upper in (select lower) from (values ('ABC' COLLATE nocase, 'aBc' COLLATE nocase)) t(upper, lower);

select 'ABC' collate nocase in (select s) from (values ('aBc')) t(s);

select 'ABC' in (select s collate nocase) from (values ('aBc')) t(s);

select 'AB' collate nocase in (select 'AB');

CREATE TABLE tbl(id INT, val JSON);

INSERT INTO tbl VALUES (1, '"b"'), (2, '"A"'), (3, '"c"');

SELECT list(id ORDER BY val::VARCHAR COLLATE nocase) FROM tbl;

SELECT 'a' LIKE 'A' COLLATE NOCASE;

SELECT 'a' NOT LIKE 'A' COLLATE NOCASE;

SELECT 'A' COLLATE NOCASE LIKE 'a';

SELECT 'a' LIKE 'A%' COLLATE NOCASE;

SELECT 'A' COLLATE NOCASE LIKE '%A' COLLATE NOCASE;

SELECT 'a' COLLATE NOCASE LIKE '%A%' COLLATE NOCASE;

SELECT 'OX' COLLATE NOACCENT.NOCASE LIKE 'ö%';

CREATE TABLE t1 (c1 VARCHAR, pattern VARCHAR);

INSERT INTO t1 VALUES('A', 'a'),('a', 'A'),('AAAA', 'AaAa'),('aaaa', 'baba');

SELECT c1 FROM t1 WHERE c1 LIKE pattern;

SELECT c1 FROM t1 WHERE c1 LIKE pattern COLLATE NOCASE;

SELECT 'a%ö' COLLATE NOACCENT LIKE 'a$%ö' ESCAPE '$';

SELECT 'a%ö' COLLATE NOACCENT NOT LIKE 'a$%ö' ESCAPE '$';

SELECT 'oX' ILIKE 'Ö%';

SELECT 'OX' COLLATE NOACCENT ILIKE 'ö%';

SELECT 'öX' COLLATE NOACCENT NOT ILIKE 'Ö%';

SELECT 'oX' GLOB 'O*';

SELECT 'oX' COLLATE NOCASE GLOB 'O*';

SELECT NULL::STRUCT(x VARCHAR) = {'x': 'a' COLLATE NOCASE};

SELECT NULL::STRUCT(x VARCHAR) IS DISTINCT FROM {'x': NULL::VARCHAR COLLATE NOCASE};

SELECT {'x': NULL::VARCHAR COLLATE NOCASE} = {'x': NULL::VARCHAR};

SELECT [{'x': 'a' COLLATE NOCASE}, NULL::STRUCT(x VARCHAR)] = [{'x': 'A'}, NULL::STRUCT(x VARCHAR)];

CREATE SEQUENCE collate_sequence;

SELECT {'x': nextval('collate_sequence')::VARCHAR COLLATE NOCASE,
        'y': nextval('collate_sequence')::VARCHAR COLLATE NOCASE} = {'x': '1', 'y': '2'};

SELECT currval('collate_sequence');

DROP SEQUENCE collate_sequence;

SELECT 'a' COLLATE NOCASE < 'B';

SELECT ('a' COLLATE NOCASE, 0) < ('B', 0);

SELECT {'x': 'b' COLLATE NOCASE} = {'x': 'B'};

SELECT {'x': 'b' COLLATE NOCASE} != {'x': 'B'};

SELECT {'x': 'a' COLLATE NOCASE} < {'x': 'B'};

SELECT {'x': 'B' COLLATE NOCASE} >= {'x': 'a'};

SELECT {'x': '10:00:00+00'::TIMETZ} < {'x': '09:00:00-05'::TIMETZ};

SELECT {'x': 'a' COLLATE NOCASE, 'y': 2} < {'x': 'A', 'y': 1};

SELECT {'x': 'B' COLLATE NOCASE, 'y': 2} < {'x': 'a', 'y': 1};

SELECT {'x': 'héllo' COLLATE NOACCENT.NOCASE} = {'x': 'HELLO'};

SELECT {'x': 'b'} = {'x': 'B'};

SELECT ('b', 0) < ('B', 0);

SELECT [{'x': 'a' COLLATE NOCASE}] < [{'x': 'B'}];

SELECT {'x': ['a' COLLATE NOCASE]} < {'x': ['B']};

SELECT {'x': {'y': 'b' COLLATE NOCASE}} = {'x': {'y': 'B'}};

SELECT {'x': {'y': {'z': 'HELLO' COLLATE NOCASE}}} = {'x': {'y': {'z': 'hello'}}};

SELECT {'x': ['HELLO' COLLATE NOCASE]} = {'x': ['hello']};

SELECT [{'x': 'HELLO' COLLATE NOCASE}] = [{'x': 'hello'}];

CREATE TABLE t(id INTEGER, s VARCHAR COLLATE NOCASE);

INSERT INTO t VALUES (1, 'B'), (2, 'a'), (3, 'b');

SELECT id FROM t ORDER BY {'x': s}, id;

SELECT count(*) FROM (SELECT DISTINCT {'x': s} FROM t);

SELECT count(*) FROM (SELECT {'x': s} AS g, count(*) FROM t GROUP BY g);

SELECT count(*) FROM t AS l JOIN t AS r ON {'x': l.s} = {'x': r.s};

CREATE TABLE tz(t TIMETZ);

INSERT INTO tz VALUES ('10:00:00+00'), ('09:00:00-05');

SELECT string_agg(t::VARCHAR, ',' ORDER BY t) FROM tz;

SELECT string_agg(t::VARCHAR, ',' ORDER BY {'x': t}) FROM tz;

SELECT {'x': 'a' COLLATE NOCASE} IN [{'x': 'A'}, {'x': 'z'}];

SELECT ('b', 0) = ('B', 0);

select typeof(x) from (select 1::INT as x group by x);

CREATE TABLE CreditCardTable(id BIGINT, creditCard_number VARCHAR);

CREATE TABLE CustomerTable(id BIGINT, pk BIGINT);

INSERT INTO CreditCardTable VALUES (1, 'A'), (2, 'z');

INSERT INTO CustomerTable VALUES (1, 100), (2, 0);

select
  creditCard_number as "pk", CustomerTable.pk AS inner_pk
from
  CreditCardTable JOIN CustomerTable USING (id)
order by
  "pk" COLLATE NOCASE;

select
  creditCard_number as "pk", CustomerTable.pk AS inner_pk
from
  CreditCardTable JOIN CustomerTable USING (id)
order by #1 COLLATE NOCASE;

create table tbl(id int, val varchar);

insert into tbl values (0, 'a'), (1, 'B');

select list(id order by val collate nocase) from tbl;

CREATE TABLE tbl (
	col1 STRING COLLATE NOCASE
);

INSERT INTO tbl VALUES ('Hello'), ('hello'), ('HELLO'), ('hElLo');

SELECT * FROM tbl WHERE col1 = 'hello';

CREATE TABLE tuples AS SELECT * FROM (VALUES ('a' COLLATE NOCASE, 0), ('B', 0)) v(s, i);

SELECT (s, i) FROM tuples ORDER BY (s, i) DESC LIMIT 1;

SELECT max((s, i)) FROM tuples;

SELECT min((s, i)) FROM tuples;

CREATE TABLE structs AS SELECT * FROM (VALUES ({'x': 'a' COLLATE NOCASE}), ({'x': 'B'})) v(s);

SELECT s FROM structs ORDER BY s DESC LIMIT 1;

SELECT max(s) FROM structs;

SELECT min(s) FROM structs;

create table t0(c1 varchar);

insert into t0 values ('XXX');

select (select c1 from t0) collate nocase;

select (select c1 from t0) collate nocase='xxx';

CREATE MACRO olddb.m(x) AS CAST(x AS VARCHAR('nocase')) = 'A';

DETACH olddb;

SELECT olddb.m('a');

SELECT macro_definition FROM duckdb_functions() WHERE function_name = 'm' AND database_name = 'olddb';

USE olddb;

DROP MACRO m;

SELECT m('a');

SELECT typeof('a'::VARCHAR('nocase')), typeof('a'::VARCHAR('nocase.noaccent')), typeof('a'::VARCHAR);

SELECT typeof(['a'::VARCHAR('nocase')]), typeof({'k': 'a'::VARCHAR('nocase')});

CREATE TABLE t(s VARCHAR COLLATE nocase, c VARCHAR COLLATE nocase.noaccent, l VARCHAR('nocase')[], st STRUCT(k VARCHAR('nocase')), p VARCHAR);

SELECT column_name, column_type FROM (DESCRIBE t) ORDER BY ALL;

SELECT sql FROM duckdb_tables() WHERE table_name = 't';

INSERT INTO t VALUES ('a', 'ä', ['a'], {'k': 'a'}, 'a');

DROP TABLE t;

SELECT s = 'A', c = 'a', st.k = 'A', p = 'A' FROM t;

SELECT column_name, column_type FROM (DESCRIBE t) WHERE column_name IN ('s', 'st') ORDER BY ALL;

ALTER TABLE t ALTER COLUMN p TYPE VARCHAR COLLATE nocase;

SELECT p = 'A' FROM t;

SELECT column_type FROM (DESCRIBE t) WHERE column_name = 'p';

SELECT 'a'::VARCHAR('nocase') = 'A';

SELECT l[1] = 'A' FROM t;

CREATE TABLE nested(a VARCHAR('nocase')[2], m MAP(INTEGER, VARCHAR('nocase')), u UNION(s VARCHAR('nocase'), i INTEGER));

INSERT INTO nested VALUES (['a', 'b'], MAP {1: 'a'}, 'a'::VARCHAR('nocase'));

DROP TABLE nested;

SELECT a[1] = 'A', m[1] = 'A', u.s = 'A' FROM nested;

SELECT column_name, column_type FROM (DESCRIBE nested) ORDER BY ALL;

CREATE TABLE g(s VARCHAR COLLATE nocase, v AS (s));

INSERT INTO g VALUES ('a');

DROP TABLE g;

SELECT s = 'A', v = 'A' FROM g;

CREATE MACRO nested_m(p STRUCT(k VARCHAR('nocase'))) AS p.k;

DROP MACRO nested_m;

SELECT parameter_types FROM duckdb_functions() WHERE function_name = 'nested_m';

SELECT s = 'A' FROM query(getvariable('csv_prompt'));

SELECT columns FROM reject_scans;

SELECT s = 'A' FROM query(getvariable('quoted_prompt'));

SET debug_verification_mode='none';

SET disabled_optimizers='statistics_propagation';

LOAD icu;

SELECT icu_sort_key('a', 'en');

SELECT icu_sort_key('ab', 'en');

SELECT icu_sort_key('1', 'en');

SELECT icu_sort_key(' ', 'en');

SELECT icu_sort_key('æ', 'en');

SELECT icu_sort_key(chr(19968), 'en');

SELECT icu_sort_key(chr(19969), 'en');

SELECT icu_sort_key(chr(40869), 'en');

SELECT icu_sort_key(chr(262144), 'en');

SELECT icu_sort_key(chr(44032), 'en');

SELECT icu_sort_key(chr(44032), 'en') = icu_sort_key(chr(4352) || chr(4449), 'en');

SELECT icu_sort_key('ch', 'cs');

SELECT icu_sort_key('aa', 'da');

SELECT icu_sort_key('ーあ', 'ja');

SELECT icu_sort_key('α', 'el');

SELECT icu_sort_key('б', 'ru');

SELECT icu_sort_key('А', 'cu');

SELECT icu_sort_key('côte', 'fr_ca');

SELECT icu_sort_key('-', 'th');

CREATE TABLE strings(s VARCHAR);

INSERT INTO strings VALUES ('a'), ('Müller'), ('ch'), ('aa'), ('ーあ'), (chr(44032)), (chr(19968)), ('');

SELECT count(*) FROM strings WHERE hex(system.collations.de(s)) <> icu_sort_key(s, 'de');

SELECT count(*) FROM strings WHERE hex(system.collations.de(s)) <> icu_collate_de(s);

SELECT typeof(system.collations.de('a')), typeof(icu_collate_de('a'));

SELECT s FROM (VALUES ('h'), ('ch'), ('i')) t(s) ORDER BY s COLLATE cs;

SELECT s FROM (VALUES ('z'), ('aa'), ('å'), ('a')) t(s) ORDER BY s COLLATE da, s;

CREATE TABLE strings(g INTEGER, s VARCHAR);

INSERT INTO strings VALUES (1, 'a'), (1, 'A'), (1, 'Z'), (1, NULL), (2, 'b'), (2, 'B'), (2, 'B'), (2, NULL);

SELECT count(DISTINCT s COLLATE NOCASE), count(DISTINCT s), count(s), count(*) FROM strings;

SELECT g, count(DISTINCT s COLLATE NOCASE), count(DISTINCT s)
FROM strings GROUP BY g ORDER BY g;

SELECT count(DISTINCT s COLLATE NOCASE) FILTER (WHERE g = 1),
       count(DISTINCT s) FILTER (WHERE g = 1)
FROM strings;

SELECT count(DISTINCT row(s COLLATE NOCASE)), count(DISTINCT row(s)) FROM strings;

SET disabled_optimizers = '';

SELECT DISTINCT g, count(DISTINCT s COLLATE NOCASE) OVER (PARTITION BY g),
       count(DISTINCT s) OVER (PARTITION BY g)
FROM strings ORDER BY g;

SELECT count(DISTINCT s COLLATE NOCASE), count(DISTINCT s)
FROM strings WHERE s IS NULL;

SELECT count(DISTINCT s COLLATE NOCASE), count(DISTINCT s)
FROM strings WHERE false;

SET default_collation = 'nocase';

SELECT count(DISTINCT s), count(s) FROM strings;

create table tbl (a varchar, b varchar);

insert into tbl values ('ö', '>>>>>ö<<<<<'), ('o', '>>>>>o<<<<<'), ('p', '>>>>>p<<<<<');

select concat(a collate de, a) from tbl order by all;

select lower(a collate de) from tbl order by all;

select upper(a collate de) from tbl order by all;

select trim(b collate de, '<>') from tbl order by all;

select ltrim(b collate de, '<>') from tbl order by all;

select rtrim(b collate de, '<>') from tbl order by all;

select repeat(a collate de, 10) from tbl order by all;

select left(b collate de, 6) from tbl order by all;

select right(b collate de, 6) from tbl order by all;

select right(left(b collate de, 6), 1) from tbl order by all;

select reverse(a collate de) from tbl order by all;

select a from tbl where contains(b collate de, 'o') order by all;

select a from tbl where starts_with(b collate de, '>>>>>o') order by all;

select a from tbl where b collate de like '%>o<%' order by all;

SELECT icu_sort_key('Ab', 'und-u-ks-level1') = icu_sort_key('ab', 'und-u-ks-level1'),
       icu_sort_key('a-b', 'en-u-ka-shifted') = icu_sort_key('ab', 'en-u-ka-shifted');

SELECT string_agg(s, ' ' ORDER BY s) FILTER (WHERE icu_sort_key(s, 'en-u-ka-shifted-kv-space') = icu_sort_key('ab', 'en-u-ka-shifted-kv-space')),
       string_agg(s, ' ' ORDER BY s) FILTER (WHERE icu_sort_key(s, 'en-u-ka-shifted') = icu_sort_key('ab', 'en-u-ka-shifted')),
       string_agg(s, ' ' ORDER BY s) FILTER (WHERE icu_sort_key(s, 'en-u-ka-shifted-kv-symbol') = icu_sort_key('ab', 'en-u-ka-shifted-kv-symbol')),
       string_agg(s, ' ' ORDER BY s) FILTER (WHERE icu_sort_key(s, 'en-u-ka-shifted-kv-currency') = icu_sort_key('ab', 'en-u-ka-shifted-kv-currency'))
FROM (VALUES ('a b'), ('a-b'), ('a+b'), ('a$b'), ('a1b')) t(s);

SELECT string_agg(s, ',' ORDER BY icu_sort_key(s, 'sv_SE')) FROM (VALUES ('z'), ('ä'), ('a')) t(s);

SET explain_output='optimized_only';

SET disabled_optimizers TO 'column_lifetime,compressed_materialization';

CREATE TABLE s (a text);

INSERT INTO s SELECT 'val_' || range FROM range(10000);

CREATE TABLE t (b text);

INSERT INTO t VALUES ('val_3');

EXPLAIN ANALYZE SELECT * FROM s, t WHERE a = b COLLATE C;

CREATE TABLE collate_test(s VARCHAR COLLATE NOACCENT);

INSERT INTO collate_test VALUES ('Mühleisen'), ('Hëllö');

SELECT * FROM collate_test WHERE s='Muhleisen';

SELECT * FROM collate_test WHERE s='mühleisen';

SELECT * FROM collate_test WHERE s='Hello';

CREATE TABLE collate_join_table(s VARCHAR, i INTEGER);

INSERT INTO collate_join_table VALUES ('Hello', 1), ('Muhleisen', 3);

SELECT collate_test.s, collate_join_table.s, i FROM collate_test JOIN collate_join_table ON (collate_test.s=collate_join_table.s) ORDER BY 1;

DROP TABLE collate_test;

INSERT INTO collate_test VALUES ('Hällo'), ('Hallo'), ('Hello');

SELECT * FROM collate_test ORDER BY s;

INSERT INTO collate_test VALUES ('Hällo'), ('Hallo');

SELECT DISTINCT s FROM collate_test;

set default_collation=c;

CREATE TABLE sales (
   product_id INT,
   region VARCHAR(50),
   year INT,
   amount_sold DECIMAL(10,2)
);

INSERT INTO sales VALUES
  (1, 'North', 2020, 1000.00),
  (1, 'North', 2021, 1500.00),
  (1, 'South', 2020, 800.00),
  (1, 'South', 2021, 700.00),
  (2, 'North', 2020, 500.00),
  (2, 'North', 2021, 600.00),
  (2, 'South', 2020, 400.00),
  (2, 'South', 2021, 550.00);

SELECT product_id, region, SUM(amount_sold) AS total_amount
FROM sales
GROUP BY GROUPING SETS ((product_id), (region), ())
ORDER BY product_id, region, total_amount;

set default_collation=en_us;

select NULL product_id, region, sum(amount_sold) from sales group by region
UNION ALL
select NULL product_id, NULL region, sum(amount_sold) from sales
UNION ALL
select product_id, NULL region, sum(amount_sold) from sales group by product_id order by 1,2;

CREATE TABLE collate_test(s VARCHAR, t VARCHAR);

INSERT INTO collate_test VALUES ('mark', 'muhleisen');

SELECT COUNT(*) FROM collate_test WHERE 'mórritz' BETWEEN s AND t;

SELECT COUNT(*) FROM collate_test WHERE 'mórritz' COLLATE NOACCENT BETWEEN s AND t;

SELECT COUNT(*) FROM collate_test WHERE 'mórritz' BETWEEN (s COLLATE NOACCENT) AND t;

SELECT COUNT(*) FROM collate_test WHERE 'mórritz' BETWEEN s AND (t COLLATE NOACCENT);

SET default_collation='NOACCENT';

CREATE TABLE collate_test(s VARCHAR COLLATE NOCASE);

INSERT INTO collate_test VALUES ('hello'), ('WoRlD'), ('world'), ('Mühleisen');

SELECT * FROM collate_test WHERE s='world';

INSERT INTO collate_join_table VALUES ('HeLlO', 1), ('mÜHLEISEN', 3);

SELECT collate_test.s, collate_join_table.s, i FROM collate_test JOIN collate_join_table ON (collate_test.s=collate_join_table.s) ORDER BY i;

INSERT INTO collate_test VALUES ('Hallo'), ('ham'), ('HELLO'), ('hElp');

INSERT INTO collate_test VALUES ('Hallo'), ('hallo');

CREATE TABLE collate_test(s VARCHAR);

INSERT INTO collate_test VALUES ('hEllO'), ('WöRlD'), ('wozld');

SELECT 'hëllo' COLLATE NOACCENT='hello';

SELECT 'hëllo' COLLATE POSIX='hello';

SELECT 'hëllo' COLLATE C='hello';

SELECT * FROM collate_test WHERE s='hello' COLLATE NOCASE;

SELECT * FROM collate_test WHERE s COLLATE NOCASE='hello';

SELECT * FROM collate_test ORDER BY s COLLATE NOCASE;

SELECT * FROM collate_test ORDER BY s COLLATE NOCASE.NOACCENT;

SELECT system.collations.nocase('HeLLo');

SELECT system.collations.noaccent('café');

SELECT collname FROM pragma_collations() WHERE collname IN ('nocase', 'noaccent', 'nfc') ORDER BY 1;

SELECT schema_name FROM duckdb_functions() WHERE function_name = 'nocase';

CREATE MACRO nocase(s) AS 'macro';

SELECT nocase('A'), 'A' = 'a' COLLATE nocase;

DROP MACRO nocase;

SELECT 'ÀB' = 'ab' COLLATE nocase.noaccent;

CREATE MACRO my_macro(s) AS lower(s);

SELECT count(*) FROM pragma_collations() WHERE collname = 'my_macro';

SELECT 'Ä' COLLATE nfc.nocase = 'ä';

SELECT 'Ä' COLLATE nocase.nfc.noaccent = 'a';

PRAGMA collations;

SELECT list_contains(['hello', 'world'], 'HELLO' COLLATE NOCASE);

SELECT list_contains(['hello', 'world'], 'XYZ' COLLATE NOCASE);

SELECT list_position(['hello', 'world'], 'WORLD' COLLATE NOCASE);

SELECT list_position(['hello', 'world'], 'XYZ' COLLATE NOCASE);

SELECT contains(['hello', 'world'], 'World' COLLATE NOCASE);

SELECT list_contains(['hello', 'world'], 'HELLO');

SELECT list_contains(['héllo', 'world'], 'HELLO' COLLATE NOACCENT.NOCASE);

SELECT list_position([NULL, 'BB'], 'bb' COLLATE NOCASE);

SELECT list_contains([NULL, 'BB'], 'bb' COLLATE NOCASE);

SELECT list_contains([]::VARCHAR[], 'x' COLLATE NOCASE);

SELECT list_contains(NULL::VARCHAR[], 'x' COLLATE NOCASE);

CREATE TABLE null_needle(n VARCHAR COLLATE NOCASE);

INSERT INTO null_needle VALUES (NULL);

SELECT list_position(['a', 'b'], n) FROM null_needle;

CREATE TABLE t(id INTEGER, l VARCHAR[], needle VARCHAR COLLATE NOCASE);

INSERT INTO t VALUES (1, ['Apple', 'Banana'], 'banana'), (2, ['Cherry', 'date'], 'DATE'), (3, ['Egg'], 'fig');

SELECT id, list_contains(l, needle), list_position(l, needle) FROM t ORDER BY id;

SELECT list_contains([needle], 'BANANA'), list_position([needle], 'BANANA') FROM t WHERE id = 1;

SELECT list_contains([1, 2, 3], 2);

SELECT list_contains([{'x': 'hello'}, {'x': 'world'}], {'x': 'HELLO' COLLATE NOCASE});

SELECT list_position([{'x': 'hello'}, {'x': 'world'}], {'x': 'WORLD' COLLATE NOCASE});

SELECT contains([{'x': 'hello'}], {'x': 'HELLO' COLLATE NOCASE});

SELECT list_contains([{'x': 'héllo'}], {'x': 'HELLO' COLLATE NOACCENT.NOCASE});

SELECT list_contains([{'x': ['hello']}], {'x': ['HELLO' COLLATE NOCASE]});

SELECT list_contains([{'x': 'hello'}], {'x': 'HELLO'});

SELECT id, list_contains([{'x': 'Apple'}, {'x': 'Banana'}], {'x': needle})
FROM t ORDER BY id;

SELECT id, list_position([{'x': 'Apple'}, {'x': 'Banana'}], {'x': needle})
FROM t ORDER BY id;

SELECT id, list_contains([{'x': needle}], {'x': 'BANANA'})
FROM t ORDER BY id;

SELECT list_contains([{'x': 'a', 'y': 'b'}], {'x': 'A' COLLATE NOCASE, 'y': 'B'});

SELECT list_contains([{'x': 'a', 'y': 'é'}], {'x': 'A' COLLATE NOCASE, 'y': 'e' COLLATE NOACCENT});

SELECT list_contains([{'x': 'A' COLLATE NOCASE, 'y': 'e' COLLATE NOACCENT}], {'x': 'a', 'y': 'é'});

SELECT list_contains([{'x': 'HELLO' COLLATE NOCASE, 'y': 'é'}], {'x': 'hello', 'y': 'e' COLLATE NOACCENT});

SELECT list_position([{'x': 'hello', 'y': 'e' COLLATE NOACCENT}], {'x': 'HELLO' COLLATE NOCASE, 'y': 'é'});

SELECT list_contains([{'x': 'HELLO', 'y': 'é'}], {'y': 'e' COLLATE NOACCENT, 'x': 'hello' COLLATE NOCASE});

SELECT list_contains([('HELLO', 'é')], ('hello' COLLATE NOCASE, 'e' COLLATE NOACCENT));

SELECT list_contains([{'x': 'HELLO'}]::STRUCT(x VARCHAR)[1], {'x': 'hello' COLLATE NOCASE});

SELECT list_position([{'x': '10:00:00+00'::TIMETZ}], {'x': '10:00:00+00'::TIMETZ});

SELECT list_position([('hello' COLLATE NOCASE, 1), NULL], NULL);

SELECT len([{'x': 'hello' COLLATE NOCASE}, {'x': 'hello' COLLATE NOACCENT}]);

SELECT list_has_any(['A' COLLATE NOCASE, 'b'], ['B', 'z']), list_has_any(['A', 'b'], ['B' COLLATE NOCASE]),
	list_has_all(['A' COLLATE NOCASE, 'b'], ['a', 'B']), list_has_all(['A', 'b'], ['B' COLLATE NOCASE, 'c']);

SELECT list_has_any(['A', 'b'], ['a', 'B']), list_has_all(['A', 'b'], ['a']);

SELECT list_has_any(['héllo'], ['HELLO' COLLATE NOACCENT.NOCASE]), list_has_all(['HÉLLO', 'x'], ['hello' COLLATE NOACCENT.NOCASE]);

SELECT list_has_any([NULL, 'BB'], ['bb' COLLATE NOCASE]), list_has_all([NULL, 'BB'], ['bb' COLLATE NOCASE, NULL]),
	list_has_any([]::VARCHAR[], ['a' COLLATE NOCASE]), list_has_all(['A' COLLATE NOCASE], []::VARCHAR[]);

SELECT array_has_any(['A' COLLATE NOCASE], ['a']), array_has_all(['A' COLLATE NOCASE], ['a']),
	['A' COLLATE NOCASE] && ['a'], ['A' COLLATE NOCASE] @> ['a'], ['a'] <@ ['A' COLLATE NOCASE],
	['A'] <@ ['a' COLLATE NOCASE, 'b'];

SELECT list_has_any(['A', 'B']::VARCHAR[2], ['b' COLLATE NOCASE]), list_has_all(['A', 'B']::VARCHAR[2], ['b' COLLATE NOCASE, 'a']),
	list_has_any(['A', 'B']::VARCHAR[2], ['b']);

SELECT list_has_any([{'s': 'A' COLLATE NOCASE}], [{'s': 'a'}]),
	list_has_any([{'v': 1::TINYINT::VARIANT}], [{'v': 1::BIGINT::VARIANT}]),
	list_has_all([{'v': 1::TINYINT::VARIANT}, {'v': 'x'::VARIANT}], [{'v': 1::BIGINT::VARIANT}]);

CREATE TABLE t AS SELECT i AS id, ['A' || (i % 7), 'B'] AS tags, ('a' || (i % 3))::VARCHAR COLLATE NOCASE AS needle
FROM range(5000) r(i);

SELECT count(*) FILTER (WHERE list_has_any(tags, [needle])), count(*) FILTER (WHERE list_has_all(tags, [needle, 'b']))
FROM t;

SELECT count(*) FROM t WHERE list_has_any(tags, [needle]) = list_contains(tags, needle);

SELECT 'a' COLLATE de.nocase = 'A';

SELECT AGE(NULL, NULL) GROUP BY AGE(NULL, NULL);

SELECT AGE(DATE '2024-01-01', NULL::TIMESTAMP) GROUP BY AGE(DATE '2024-01-01', NULL::TIMESTAMP);

SELECT NULL::VARCHAR GROUP BY NULL::VARCHAR;

SELECT NULL::VARCHAR[] GROUP BY NULL::VARCHAR[];

SELECT NULL::VARCHAR[2] GROUP BY NULL::VARCHAR[2];

SELECT NULL::VARCHAR COLLATE nocase;

SELECT min(NULL::VARCHAR);

SELECT arg_min(1, NULL::VARCHAR);

RESET default_collation;

SELECT DISTINCT NULL::INTERVAL;

SELECT 1 ORDER BY NULL::INTERVAL;

SELECT row_number() OVER (PARTITION BY NULL::INTERVAL ORDER BY NULL::INTERVAL);

SELECT string_agg(s, ',' ORDER BY NULL::INTERVAL) FROM (SELECT 'a' s) t;

SELECT NULL::INTERVAL = NULL::INTERVAL;

SELECT NULL::INTERVAL BETWEEN NULL::INTERVAL AND NULL::INTERVAL;

SELECT NULL::INTERVAL IN (NULL::INTERVAL, INTERVAL 1 DAY);

SELECT NULL::INTERVAL IN (SELECT INTERVAL 1 DAY);

SELECT NULL::INTERVAL = ANY (SELECT INTERVAL 1 DAY);

SELECT (SELECT 1 WHERE t.i = NULL::INTERVAL) FROM (SELECT INTERVAL 1 DAY i) t;

SELECT NULL::INTERVAL UNION SELECT NULL::INTERVAL;

SELECT NULL::INTERVAL EXCEPT SELECT NULL::INTERVAL;

SELECT max(NULL::BIT);

SELECT AGE(TIMESTAMP '2014-04-25', TIMESTAMP '2014-04-17') GROUP BY AGE(TIMESTAMP '2014-04-25', TIMESTAMP '2014-04-17');

SELECT count(*) FROM (VALUES (INTERVAL '30' DAY), (INTERVAL '1' MONTH), (INTERVAL '720' HOUR)) t(i) GROUP BY i;

SELECT 'a' AS c1 ORDER BY 1 COLLATE NOCASE;

SELECT 'a' ORDER BY 1 COLLATE NOCASE;

SELECT 'A', 'B' ORDER BY 2 COLLATE NOCASE;

SELECT 999::VARCHAR ORDER BY 1 COLLATE NOCASE;

INSERT INTO collate_test VALUES ('ã'),('B'),('a'),('A');

SELECT s FROM collate_test ORDER BY 1 COLLATE NOCASE;

SELECT s FROM collate_test ORDER BY s COLLATE NOCASE;

SELECT CONCAT(s, s) FROM collate_test ORDER BY 1 COLLATE NOCASE;

SELECT CONCAT(s, s) AS concat, concat FROM collate_test ORDER BY 2 COLLATE NOCASE;

SELECT collate_test.s FROM collate_test ORDER BY 1 COLLATE NOCASE;

SELECT CASE WHEN s[1]='a' THEN s ELSE NULL END FROM collate_test ORDER BY 1 COLLATE NOCASE;

SELECT (SELECT s) FROM collate_test ORDER BY 1 COLLATE NOCASE;

SELECT concat('a', (SELECT s)) FROM collate_test ORDER BY 1 COLLATE NOCASE;

CREATE TABLE Cities (
    Country VARCHAR, Name VARCHAR, Year INTEGER, Population INTEGER
);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2010, 1005);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2011, 1065);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2012, 1158);

INSERT INTO Cities VALUES ('US', 'Seattle', 2013, 564);

INSERT INTO Cities VALUES ('US', 'Seattle', 2014, 608);

INSERT INTO Cities VALUES ('US', 'Seattle', 2015, 738);

INSERT INTO Cities VALUES ('US', 'New York City', 2016, 8015);

INSERT INTO Cities VALUES ('US', 'New York City', 2017, 8175);

INSERT INTO Cities VALUES ('US', 'New York City', 2018, 8772);

INSERT INTO Cities VALUES ('US', 'New York City', 2019, 8772);

INSERT INTO Cities VALUES ('US', 'New York City', 2020, 8772);

SET pivot_filter_threshold=99;

PIVOT Cities ON Year USING sum(Population);

SET pivot_filter_threshold=0;

select a from tbl where contains(b collate nocase, 'O') order by all;

select concat(a collate noaccent, a) from tbl order by all;

select lower(a collate noaccent) from tbl order by all;

select upper(a collate noaccent) from tbl order by all;

select trim(b collate noaccent, '<>') from tbl order by all;

select ltrim(b collate noaccent, '<>') from tbl order by all;

select rtrim(b collate noaccent, '<>') from tbl order by all;

select repeat(a collate noaccent, 10) from tbl order by all;

select left(b collate noaccent, 6) from tbl order by all;

select right(b collate noaccent, 6) from tbl order by all;

select right(left(b collate noaccent, 6), 1) from tbl order by all;

select reverse(a collate noaccent) from tbl order by all;

select a from tbl where contains(b collate noaccent, 'o') order by all;

select a from tbl where contains(b, 'ö' collate noaccent) order by all;

select a from tbl where starts_with(b collate noaccent, '>>>>>o') order by all;

CREATE TABLE collate_test(s VARCHAR COLLATE NOACCENT.NOCASE);

SELECT * FROM collate_test WHERE s='hEllô';

CREATE TABLE strings AS SELECT i, CASE WHEN i % 2 = 0 THEN 'ABC' ELSE 'xyz' END AS s FROM range(5000) t(i);

SELECT contains('ABC', 'b'), 'ABC' LIKE '%b%', starts_with('ABC', 'a'), 'ABC' GLOB '*b*', instr('ABC', 'b'), list_contains(['A'], 'a');

PREPARE contains_b AS SELECT contains(?, 'b');

EXECUTE contains_b('ABC');

SELECT contains('ABC', 'b'), 'ABC' LIKE '%b%', starts_with('ABC', 'a'), 'ABC' GLOB '*b*', instr('ABC', 'b'), list_contains(['A'], 'a'), 'A' = 'a';

SELECT count(*) FILTER (WHERE contains(s, 'b')), count(*) FILTER (WHERE s LIKE 'a%'), count(*) FILTER (WHERE starts_with(s, 'XY')),
       count(*) FILTER (WHERE contains(s, 'b') = contains(s COLLATE NOCASE, 'b'))
FROM strings;

SELECT count(*) FROM strings WHERE list_contains(['abc'], s);

SELECT list_position(['x', 'A'], 'a'), 'ABC' NOT LIKE '%b%', 'ABC' NOT ILIKE '%b%', 'A_C' LIKE 'aX_c' ESCAPE 'X',
       ('A_C' LIKE 'aX_c' ESCAPE 'X') = ('A_C' COLLATE NOCASE LIKE 'aX_c' ESCAPE 'X');

SET default_collation = 'noaccent.nocase';

SELECT contains('HÉLLO', 'e'), list_contains(['héllo'], 'HELLO');

SELECT contains('ABC', 'b'), list_contains(['A'], 'a');

SELECT COUNT(*) FROM collate_test WHERE 'BlA'='bLa';

SET default_collation='NOCASE.NOACCENT';

INSERT INTO strings VALUES ('Gabel'), ('Göbel'), ('Goethe'), ('Goldmann'), ('Göthe'), ('Götz');

SELECT * FROM strings ORDER BY s COLLATE de;

SELECT * FROM strings WHERE 'Goethe' > s COLLATE de ORDER BY 1;

SELECT * FROM strings WHERE 'Goethe' > s ORDER BY 1;

SELECT * FROM strings WHERE 'goethe' > s COLLATE de.NOCASE ORDER BY 1;

SELECT * FROM strings WHERE 'goethe' > s COLLATE NOCASE.de ORDER BY 1;

SELECT * FROM strings WHERE 'goethe' > s COLLATE NOACCENT.de ORDER BY 1;

DELETE FROM strings;

INSERT INTO strings VALUES ('賃貸人側連絡先 (Lessor side contact)'), ('賃借人側連絡先 (Lessee side contact)'), ('解約連絡先 (Termination contacts)'), ('更新連絡先 (Update contact)');

SELECT * FROM strings ORDER BY s;

SELECT * FROM strings ORDER BY s COLLATE ja.NOCASE;

select icu_sort_key('Ş', 'ro');

select icu_sort_key('æ', 'icu_noaccent');

select chr(2*16*256+1*256+2*16+11) collate da  =chr(12*16+5) collate da;

select icu_sort_key(chr(2*16*256+1*256+2*16+11),'da')=icu_sort_key(chr(12*16+5),'da');

select chr(2*16*256+1*256+2*16+11) collate da > chr(12*16+5) collate da;

select count(*) from (select chr(2*16*256+1*256+2*16+11) union select chr(12*16+5)) as t(s) group by s collate da;

select nfc_normalize(chr(2*16*256+1*256+2*16+11))=nfc_normalize(chr(12*16+5));

select count(*) from (select chr(2*16*256+1*256+2*16+11) union select chr(12*16+5)) as t(s) group by s collate nfc;

CREATE TABLE t1 (c1 CHAR(10));

INSERT INTO t1 VALUES('z'),('Z'),('a'),('A'),('æ'),('Æ'),('à'),('À'),('á'),('Á'),('â'),('Â'),
('ã'),('Ã'),('ä'),('Ä'),('å'),('Å'),('b'),('B');

SELECT GROUP_CONCAT(c1, '') as group_c1 FROM t1 GROUP BY c1  COLLATE "NOCASE.ICU_NOACCENT" ORDER BY group_c1 COLLATE "NOCASE.ICU_NOACCENT";

SELECT 'Á' COLLATE "ICU_NOACCENT.NOACCENT";

SELECT 'Á' COLLATE "NOACCENT.ICU_NOACCENT";

from pragma_collations() 
where collname like 'n%'
order by all;

SELECT strpos('HELLO' COLLATE NOCASE, 'el');

SELECT instr('HELLO' COLLATE NOCASE, 'el');

SELECT position('el' IN ('HELLO' COLLATE NOCASE));

SELECT strpos('HELLO' COLLATE NOCASE, '');

SELECT strpos('HELLO' COLLATE NOCASE, 'xyz');

SELECT strpos('HELLO' COLLATE NOCASE, 'HELLO');

SELECT strpos('Hello World' COLLATE NOCASE, 'world');

SELECT strpos('HELLO WORLD' COLLATE NOCASE, 'o w');

SELECT contains('HELLO' COLLATE NOCASE, 'hEllO');

SELECT starts_with('HELLO' COLLATE NOCASE, 'heL');

INSERT INTO collate_test VALUES ('Hello World'), ('HELLO WORLD'), ('hElLo WoRlD');

SELECT strpos(s COLLATE NOCASE, 'hello') FROM collate_test ORDER BY s;

SELECT strpos(s COLLATE NOCASE, 'world') FROM collate_test ORDER BY s;

SELECT strpos('HELLO' COLLATE NOCASE, 'el' COLLATE NOCASE);

SELECT strpos('HELLO', 'el');

SELECT strpos('' COLLATE NOCASE, '');

SELECT strpos('' COLLATE NOCASE, 'a');

SELECT strpos('a' COLLATE NOCASE, '');

SELECT strpos('HéLLO' COLLATE NOCASE, 'éll');

SELECT strpos('HELLO', 'HELLO');

SELECT strpos('HELLO', '');

SELECT strpos('HELLO', 'xyz');

CREATE TABLE collate_test(s VARCHAR COLLATE NOACCENT.NOACCENT);
