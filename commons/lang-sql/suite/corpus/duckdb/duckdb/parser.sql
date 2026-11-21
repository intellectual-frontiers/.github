SELECT 'foo'
'bar';

SELECT 'one' -- comment
'two';

SELECT 'one'
'two'
'three';

SELECT DATE '2020-'
'01-01'::VARCHAR;

SELECT N'national'
' string';

SELECT E'escape\n'
'string' = 'escape' || chr(10) || 'string';

SELECT X'48656C6C6F'
'20576F726C64'::VARCHAR;

SELECT B'1010'
'0101';

SELECT `x` FROM (SELECT 1 x) t;

SELECT 42 AS `my alias`;

SELECT `my alias` FROM (SELECT 42 AS `my alias`);

CREATE TABLE `my table`(`a col` INTEGER, `b col` VARCHAR);

INSERT INTO `my table` VALUES (1, 'one'), (2, 'two');

SELECT `t`.`a col`, `t`.`b col` FROM `my table` `t` ORDER BY `t`.`a col`;

SELECT `t`.`a col`, `t`.`b col` FROM `my table` AS `t` ORDER BY ALL;

SELECT "a col", `a col` FROM "my table" ORDER BY `a col`;

CREATE SCHEMA `my schema`;

CREATE TABLE `my schema`.`tbl`(`i` INTEGER);

INSERT INTO `my schema`.`tbl` VALUES (7);

SELECT `i` FROM `my schema`.`tbl`;

SELECT i FROM "my schema".tbl;

ALTER TABLE `my table` ADD COLUMN `c col` INTEGER DEFAULT 3;

SELECT `c col` FROM `my table` LIMIT 1;

CREATE VIEW `my view` AS SELECT `a col` FROM `my table`;

SELECT COUNT(*) FROM `my view`;

UPDATE `my table` SET `b col` = 'ONE' WHERE `a col` = 1;

SELECT `b col` FROM `my table` WHERE `a col` = 1;

DELETE FROM `my table` WHERE `a col` = 2;

SELECT COUNT(*) FROM `my table`;

SELECT column_name FROM (DESCRIBE SELECT 1 AS `a``b`);

SELECT "a`b" FROM (SELECT 1 AS `a``b`);

SELECT column_name FROM (DESCRIBE SELECT 1 AS `a"b`);

SELECT column_name FROM (DESCRIBE SELECT 1 AS "a`b");

SELECT `a"b` FROM (SELECT 1 AS "a""b");

SELECT '`' || 'a' || '`';

SELECT 'it''s `quoted`';

SELECT $$`x`$$;

SELECT $tag$a ` b$tag$;

SELECT 1 -- `not an identifier
;

SELECT /* `also` not */ 2;

SELECT `b col` || `b col` FROM `my table`;

SELECT `a col`! FROM `my table`;

SELECT -`a col` FROM `my table`;

SELECT `a col`+`c col`*2 FROM `my table`;

SELECT `select` FROM (SELECT 5 AS `select`);

SELECT `from`.`select` FROM (SELECT 5 AS `select`) `from`;

SELECT `upper`('abc');

SET preserve_identifier_case TO 'lowercase';

CREATE TABLE `MixedCase`(`ColA` INTEGER, ColB INTEGER);

SELECT table_name, column_name FROM duckdb_columns() WHERE table_name = 'MixedCase' ORDER BY column_name;

SELECT `ColA`, ColB FROM `MixedCase` LIMIT 0;

RESET preserve_identifier_case;

SELECT sql FROM duckdb_views() WHERE view_name = 'my view';

CREATE TABLE t(a INTEGER, b INTEGER);

INSERT INTO t VALUES (1, 2), (3, 4);

SELECT a foo, b type, a name, b value FROM t ORDER BY a;

SELECT a first, b last FROM t ORDER BY a;

SELECT a nulls, b rows, a range FROM t ORDER BY a;

SELECT typeof(a + b) type FROM t LIMIT 1;

SELECT a NAME, b Type FROM t ORDER BY a;

INSERT INTO t VALUES (5, 6) RETURNING a name, b value;

DELETE FROM t WHERE a = 5;

UNPIVOT (SELECT 1 AS x, 2 AS y) ON x key, y INTO NAME col VALUE val;

CREATE TABLE p(k VARCHAR, a INTEGER);

INSERT INTO p VALUES ('x', 1), ('y', 2);

PIVOT p ON k USING sum(a) total;

WITH c AS (SELECT a name FROM t) SELECT name FROM c ORDER BY name LIMIT 1;

SELECT (SELECT 1 name) sub;

CREATE MACRO m() AS TABLE SELECT 1 name, 2 type;

SELECT name, type FROM m();

SELECT [1, 2] list, {'a': 1} struct_val, MAP {1: 2} map_val;

SELECT sum(a) OVER w total FROM t WINDOW w AS () LIMIT 1;

SELECT a AS month, b AS filter, a "over", b `without` FROM t ORDER BY a;

SELECT (DATE '2020-01-01' + INTERVAL 1 month)::DATE;

SELECT INTERVAL '1' day;

SELECT 'a%' LIKE 'a\%' ESCAPE '\';

SELECT count(*) FILTER (WHERE a > 1) FROM t;

SELECT sum(a) OVER () FROM t LIMIT 1;

SELECT '2020-01-01'::TIMESTAMP WITHOUT TIME ZONE;

SELECT * EXCLUDE (b) FROM t ORDER BY a;

CREATE TABLE integers AS SELECT 42 i, 84 j UNION ALL SELECT 13, 14;

SELECT i, j FROM (SELECT COLUMNS(*)::VARCHAR FROM integers);

SELECT min_i, min_j, max_i, max_j FROM (SELECT MIN(COLUMNS(*)) AS "min_\0", MAX(COLUMNS(*)) AS "max_\0" FROM integers);

CREATE TABLE numerics AS SELECT 42 a42, 84 b84, 126 c126, 1000 d;

SELECT min_a, min_b, min_c FROM (SELECT MIN(COLUMNS('([a-z])\d+')) AS "min_\1" FROM numerics);

SELECT min_, "min__1", "min__2" FROM (SELECT MIN(COLUMNS('([a-z])\d+')) AS "min_\2" FROM numerics);

SELECT "min_\a\", "min_\b\", "min_\c\" FROM (SELECT MIN(COLUMNS('([a-z])\d+')) AS "min_\\\1\\" FROM numerics);

SELECT "a42aa", "b84bb", "c126cc" FROM (SELECT MIN(COLUMNS('([a-z])(\d+)')) AS "\1\2\1\1" FROM numerics);

CREATE TABLE tbl (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold),
);

INSERT INTO tbl VALUES (5,4);

SELECT price, amount_sold, total_profit FROM (SELECT COLUMNS(*)::VARCHAR FROM tbl);

SELECT varchar_price, varchar_amount_sold, varchar_total_profit FROM (SELECT COLUMNS(*)::VARCHAR AS "varchar_\0" FROM tbl);

create table a as select 42 as i, 80 as j;

create table b as select 43 as i, 84 as k;

create table c as select 44 as i, 84 as l;

select i, j, k from (select columns(*)::VARCHAR from a full outer join b using (i)) order by 1;

select i, j, k, l from (select columns(*)::VARCHAR from a full outer join b using (i) full outer join c using (i)) order by 1;

CREATE TABLE df1 AS
  SELECT
    UNNEST(['K0', 'K1', 'K2', 'K3', 'K4', 'K5']) AS key,
    UNNEST([11, 12, 13, 14, 15, 16]) AS A,
    UNNEST([21, 22, 23, 24, 25, 26]) AS B;

CREATE TABLE df2 AS
  SELECT
    UNNEST(['K0', 'K2', 'K5']) AS key,
    UNNEST([2, 3, 5]) AS C;

select sin(columns(df1.* exclude (key))) from df1 join df2 using(key);

CREATE TABLE one(a INT);

INSERT INTO one VALUES (1);

SELECT coalesce(*COLUMNS(*)) FROM one;

SELECT 1 IN (*COLUMNS(*)) FROM one;

CREATE OR REPLACE MACRO "overloaded macro"("a b") AS "a b", ("a b", "c d") AS "a b" + "c d";

SELECT "overloaded macro"(2), "overloaded macro"(2, 3);

CREATE VIEW printable_cte AS WITH x AS (SELECT 1 AS i) SELECT i FROM x;

CREATE VIEW printable_recursive_cte AS WITH RECURSIVE r(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM r WHERE i < 3) SELECT i FROM r;

SELECT contains(sql, ') SELECT ') FROM duckdb_views() WHERE view_name = 'printable_cte';

SELECT contains(sql, ') SELECT '), contains(sql, ' UNION ALL ') FROM duckdb_views() WHERE view_name = 'printable_recursive_cte';

SELECT * FROM printable_recursive_cte ORDER BY i;

SELECT @5;

SELECT @(-5);

SELECT @ -5 + -6;

SELECT 1 + @ -5;

SELECT 'a' || @ -1;

SELECT 2 ^ @ -3;

SELECT 3 % @ -2;

SELECT 1 + @ @ -5;

SELECT 1 + - @ -5;

SELECT 1 + @ 5 * 2;

SELECT 1 + @ -2 - 1;

SELECT 1 * @ 2 + 3;

SELECT @ -2 | 1;

SELECT @ -2 || 'x';

SELECT @ -5 << 1;

SELECT 1 + @ 2 << 1;

SELECT @ -2 = 2;

SELECT 1 + @ 5 = 11;

SELECT 'a' || @ -1 || 'b';

SELECT count(*) FROM range(3);

SELECT typeof(-2147483648);

SELECT 1 - -1;

SET max_expression_depth TO 20;

SELECT @ @ 1;

RESET max_expression_depth;

SET max_expression_depth=1000;

FROM query('SELECT (NULL::' || repeat('MAP(INTEGER, STRUCT(a ', 100) || 'INTEGER[]' || repeat('))', 100) || ') IS NULL');

SET max_expression_depth=100;

SELECT typeof(NULL::MAP(INTEGER, STRUCT(a UNION(u TUPLE(INTEGER[], VARCHAR))))[]);

SELECT 1_2;

SELECT 1_2.1_2E1_0;

SELECT '1_2.1_2E1_0'::DOUBLE;

SELECT 1__2;

SELECT 1_000_000;

SELECT '1000_000_000'::INT;

SELECT 1_2.1_2;

SELECT 12.1_2;

SELECT 1_2.12;

SELECT '12.1_2'::FLOAT;

SELECT '1_2.12'::FLOAT;

SELECT '12.1_2e2'::FLOAT;

SELECT 1_000_000_000_000_000_000_000::DOUBLE;

SELECT .000_000_000_000_000_000_000_123::DOUBLE;

SELECT 1_000_000_000_000_000_000_000.5::DOUBLE;

SELECT '1_000_000_000.000_000_000_5'::DOUBLE;

SELECT 12e1_0::BIGINT == 12e10::BIGINT;

SELECT '0b01_01'::INT;

SELECT '0b0_1_0_1'::INT;

SELECT '0xFF_FF'::INT;

SELECT '0xF_F_F_F'::INT;

SELECT typeof(10.00), typeof(10.0_0), typeof(1_0.00), typeof(1_0.0_0);

select 1_2e1_0::FLOAT;

select '1_2e1_0'::FLOAT;

select 1_2e1_0::BIGINT;

select '1_2e1_0'::BIGINT;

SELECT 6 * 1 / 2;

SELECT 6 * 1 // 2;

SELECT (6 * 1) // 2;

SELECT 6 * (1 // 2);

SELECT 6 + 1 / 2;

SELECT 6 + 1 // 2;

select $tag$ $tag$ = $tag$　$tag$;

select ' ' = '　';

select $$$$ = '';

select $tag$$tag$ = '';

select '' = $$$$;

select '' = $tag$$tag$;

select $$ $$ = $$　$$ or ' ' = '　';

select $tag$ $tag$ = $tag$　$tag$ or ' ' = '　';

select ' ' = '　' or $$ $$ = $$　$$;

select ' ' = '　' or $tag$ $tag$ = $tag$　$tag$;

select $tag$ $duck$ $tag$ = $tag$　$duck$　$tag$;

select $🦆$du ck$🦆$ = $🦆$du　ck$🦆$;

select $ü$x x$ü$ = $ü$x　x$ü$;

ATTACH ':memory:' AS db2;

CREATE SCHEMA s;

CREATE SCHEMA db2.s2;

CREATE MACRO s.tm() AS TABLE SELECT 1 AS x;

CREATE MACRO main.tm() AS TABLE SELECT 2 AS x;

DROP MACRO TABLE s.tm;

SELECT * FROM tm();

CREATE MACRO db2.s2.tm() AS TABLE SELECT 3 AS x;

DROP MACRO TABLE db2.s2.tm;

DROP MACRO TABLE "main"."tm";

SELECT count(*) FROM duckdb_functions() WHERE function_name = 'tm';

DROP MACRO TABLE IF EXISTS nonexistent_db.nonexistent_schema.tm;

CREATE MACRO s.sm(a) AS a + 1;

SELECT (1+(1+(1+(1+(1+(1+(1+1)))))));

SET max_expression_depth TO 7;

SET max_expression_depth TO 1000;

SHOW EXTERNAL RESOURCES;

SHOW EXTERNAL RESOURCES WITH TYPE 'aws:ec2:quack';

SHOW EXTERNAL RESOURCES WITH TYPE 'aws:ec2:it''s quacky';

SHOW EXTERNAL RESOURCES WITH TYPE quack;

SELECT count(*) FROM duckdb_external_resources();

RESET debug_verify_statement;

CREATE TABLE t(a INT);

INSERT INTO t VALUES (1), (2), (3);

SELECT * FROM t ORDER BY a FETCH FIRST 2 ROWS ONLY;

SELECT * FROM t ORDER BY a FETCH NEXT 1 ROW ONLY;

SELECT * FROM t ORDER BY a FETCH FIRST 1 ROW ONLY;

SELECT * FROM t ORDER BY a FETCH NEXT 2 ROWS ONLY;

SELECT * FROM t ORDER BY a OFFSET 1 ROW FETCH FIRST 1 ROW ONLY;

SELECT * FROM t ORDER BY a OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY;

SELECT * FROM t ORDER BY a FETCH FIRST (1 + 1) ROWS ONLY;

SELECT * FROM t ORDER BY a FETCH FIRST ROW ONLY;

SELECT * FROM t ORDER BY a FETCH FIRST ROWS ONLY;

SELECT * FROM t ORDER BY a FETCH NEXT ROW ONLY;

SELECT * FROM t ORDER BY a FETCH NEXT ROWS ONLY;

SELECT * FROM t ORDER BY a OFFSET 1 ROW FETCH NEXT ROW ONLY;

SELECT * FROM t ORDER BY a FETCH FIRST 2 ROWS ONLY OFFSET 1 ROW;

SELECT * FROM t ORDER BY a FETCH NEXT ROW ONLY OFFSET 1 ROWS;

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (1), (2), (3), (NULL);

FROM integers;

FROM integers SELECT i + 1;

FROM integers LIMIT 2;

FROM integers WHERE i IS NOT NULL;

FROM integers ORDER BY i DESC NULLS FIRST;

FROM integers SELECT DISTINCT i%2 WHERE i>0 ORDER BY ALL;

FROM integers SELECT i%2 AS g, SUM(i) sum GROUP BY g HAVING sum IS NOT NULL ORDER BY ALL;

FROM integers JOIN integers i2 USING (i);

FROM integers i1, integers i2 SELECT COUNT(*);

CREATE TABLE varchars(v VARCHAR);

INSERT INTO varchars VALUES ('Hello'), ('World');

SELECT v.lower() FROM varchars;

SELECT (v).lower() FROM varchars;

SELECT varchars.v.lower() FROM varchars;

SELECT v.lower().upper() FROM varchars;

SELECT v.lower()[:3] FROM varchars;

DELETE FROM varchars;

INSERT INTO varchars VALUES ('Hello World');

SELECT v.split(' ') FROM varchars;

SELECT v.split(' ').apply(lambda x: x.lower()) FROM varchars;

SELECT v.split(' ').apply(lambda x: x.lower()).filter(lambda x: x[1] == 'h') FROM varchars;

SELECT v.split(' ').length() FROM varchars;

SELECT v.split(' ').aggregate('count') FROM varchars;

SELECT v.split(' ').aggregate('min') FROM varchars;

PREPARE v1 AS SELECT ?.split(' ')[1].lower();

EXECUTE v1('Hello World');

SELECT strftime(ci.purchasedate.nullif('1899-12-30T00:00:00'), '%Y-%m-%d')
FROM (VALUES (TIMESTAMP '2026-01-01')) AS ci("PurchaseDate");

SELECT pg_typeof(X'FF');

SELECT X'41'::VARCHAR;

SELECT X'48656C6C6F'::VARCHAR;

SELECT octet_length(X'DEADBEEF');

select case when true then {'a': 42} end.a;

select [42][1];

select array[42][1];

select [a for a in [42, 84]][1];

prepare v1 as select $1[1];

execute v1([42]);

SET errors_as_json=true;

SELECT 42;

SELECT 10 IS NOT NULL::VARCHAR;

SELECT 10 IS NULL::VARCHAR, typeof(10 IS NULL::VARCHAR);

SELECT 10 NOTNULL::VARCHAR, 10 ISNULL::VARCHAR;

SELECT true IS TRUE::VARCHAR, true IS NOT FALSE::VARCHAR, NULL IS UNKNOWN::VARCHAR;

SELECT NULL IS NULL::INT::VARCHAR;

SELECT 10 IS NOT NULL::INT + 1;

SELECT NOT 10 IS NOT NULL::VARCHAR;

SELECT 1 IN (1, 2)::VARCHAR, typeof(1 IN (1, 2)::VARCHAR);

SELECT 1 NOT IN (1, 2)::INT, 1 IN (1)::INT::VARCHAR::INT;

SELECT 1 IN (1)::INT IN (1), 1 IN (1) BETWEEN 0 AND 1;

SELECT 1 IN (SELECT 1)::INT;

SELECT 1 IN (1) IS NULL::INT;

select t.*
from (
  (values (1), (2)) as t1 (a)
  cross join
  (values (3), (4)) as t2 (b)
) as t;

select x, y
from (
  (values (1), (2)) as t1 (a)
  cross join
  (values (3), (4)) as t2 (b)
) as t(x, y);

SELECT 1_000, 1e3, 1.50, -9223372036854775808, -170141183460469231731687303715884105728, X'FF', B'0101', E'a\x41b', $$a'b$$, N'x', 'it''s', DATE '2020-01-01', -(-5), 2 - -5, .5, 170141183460469231731687303715884105728, 123456789012345678901234567890123456789012345678901234567890, TRUE;

SELECT typeof(1_000), typeof(1e3), typeof(1.50), typeof(-9223372036854775808), typeof(-170141183460469231731687303715884105728), typeof(X'FF'), typeof(B'0101'), typeof(.5), typeof(170141183460469231731687303715884105728), typeof(123456789012345678901234567890123456789012345678901234567890);

SELECT typeof(-1), typeof(- -1), -(-(-3));

CREATE VIEW v AS SELECT 1_000 a, 1e3 b, 1.50 c, X'FF' d, B'0101' e, 'it''s' f, DATE '2020-01-01' g, [1, 2, 3][:2] h, [1, 2, 3][2:] i, [1, 2, 3][:-1] j, TRUE k, NULL l;

SELECT sql FROM duckdb_views() WHERE view_name = 'v';

CREATE MACRO m(a := 1_000, b := 'x') AS a || b;

CREATE TABLE t(i INTEGER DEFAULT 1_000, s VARCHAR DEFAULT 'it''s', d DATE DEFAULT DATE '2020-01-01', f DOUBLE DEFAULT 1e3);

INSERT INTO t DEFAULT VALUES;

SELECT * FROM v;

SELECT typeof(a), typeof(b), typeof(c), typeof(d) FROM v;

SELECT m(), m(b := 'y');

SELECT * FROM t;

SELECT i FROM t GROUP BY 1 ORDER BY 1;

SELECT #1 FROM (SELECT 42);

PREPARE p AS SELECT $1 + $2;

EXECUTE p(1, 2);

PREPARE q AS SELECT ?::INTEGER + ?::INTEGER;

EXECUTE q(1, 2);

SELECT 'a' COLLATE NOCASE = 'A';

SELECT count(*) FROM range(100) USING SAMPLE 10 ROWS;

SELECT count(*) <= 100 FROM range(100) USING SAMPLE 10%;

SELECT [1, 2, 3, 4, 5][2:[]], [1, 2, 3, 4, 5][[]:2];

CREATE TABLE s(v STRUCT(a INTEGER, b VARCHAR) DEFAULT {'a': 1, 'b': 'x'});

INSERT INTO s DEFAULT VALUES;

ALTER TABLE s ADD COLUMN v.c INTEGER DEFAULT 7;

SELECT v FROM s ORDER BY ALL;

SELECT -2147483648 * 2;

SELECT typeof(-2147483647);

SELECT typeof(-2_147_483_648);

SELECT typeof(2147483648);

SELECT typeof(-9223372036854775808);

SELECT typeof(-9223372036854775807);

SELECT typeof(-170141183460469231731687303715884105728);

SELECT -(2147483648);

SELECT typeof(-(2147483648));

SELECT typeof(-(-2147483648));

SELECT typeof(-128);

CREATE TABLE t(e INTEGER);

SELECT * FROM (VALUES (1)) t1(a) LEFT JOIN (VALUES (1)) t2(b) JOIN (VALUES (1)) t3(c) ON t2.b = t3.c ON t1.a = t2.b;

SELECT false < NOT true IS NULL;

SELECT NOT NULL IS NULL;

SELECT 1 < NOT 2 = 2;

SELECT (1 < NOT 2) = 2;

SELECT true = NOT false;

SELECT true = NOT NOT true;

SELECT true = NOT 3 IN (1, 2);

SELECT false = NOT 1 BETWEEN 0 AND 2;

SELECT true <> NOT 'a' LIKE 'b';

SELECT true = NOT false IS DISTINCT FROM NULL;

SELECT 1 < NOT 2 = 2 AND true;

SELECT 1 < NOT 2 = 2 OR false;

SELECT NOT 1 < 2 IS NULL;

SELECT false < NOT true IS NULL = true;

CREATE TABLE t AS SELECT * FROM (VALUES (1, NULL), (2, 2)) v(a, b);

SELECT a, a < NOT b IS NULL FROM t ORDER BY a;

SELECT 1.23, 1_000.5, 1_2., 12., 100000.000001, -1.23;

CREATE TABLE t (x INTEGER);

INSERT INTO t VALUES (7);

FROM (t a CROSS JOIN t b) SELECT a.x + b.x;

FROM ((t a CROSS JOIN t b)) j SELECT count(*);

FROM j: (t a CROSS JOIN t b) SELECT count(*);

SELECT count(*) FROM (range(2) a JOIN range(3) b ON a.range = b.range) JOIN range(4) c ON c.range = a.range;

FROM ((((((((((((((((((((((((((((((t a CROSS JOIN t b)))))))))))))))))))))))))))))) SELECT count(*);

FROM ((SELECT 1 x)) SELECT x;

FROM (VALUES (1)) v(x) SELECT x;

CREATE SCHEMA IF NOT EXISTS parsed_data_schema;

ATTACH OR REPLACE ':memory:' AS parsed_data_db (READ_ONLY false);

ALTER DATABASE IF EXISTS missing_database SET ALIAS TO other_name;

CREATE OR REPLACE SECRET parsed_data_secret IN connection (
    TYPE HTTP,
    PROVIDER CONFIG,
    SCOPE 'https://example.com/data/',
    BEARER_TOKEN 'token'
);

DROP SECRET IF EXISTS parsed_data_secret FROM connection;

DROP EXTENSION REPOSITORY IF EXISTS parsed_data_repo;

SET autoload_known_extensions=false;

RESET autoload_known_extensions;

DROP EXTENSION REPOSITORY IF EXISTS "parsed-data.example";

DROP TABLE IF EXISTS parsed_data_trigger_target;

DROP TABLE IF EXISTS parsed_data_trigger_audit;

CREATE TEMP TABLE parsed_data_trigger_target(i INTEGER, j INTEGER);

CREATE TEMP TABLE parsed_data_trigger_audit(i INTEGER);

CREATE OR REPLACE TRIGGER parsed_data_tr
AFTER UPDATE ON parsed_data_trigger_target
REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
FOR EACH STATEMENT
INSERT INTO parsed_data_trigger_audit SELECT i FROM new_rows;

DROP TRIGGER parsed_data_tr ON parsed_data_trigger_target;

DROP TABLE IF EXISTS parsed_data_alter;

CREATE TABLE parsed_data_alter(
    i INTEGER,
    nested STRUCT(a INTEGER, b INTEGER),
    removable INTEGER
);

CREATE TABLE IF NOT EXISTS parsed_data_if_not_exists(i INTEGER);

CREATE OR REPLACE VIEW parsed_data_deferred WITH (DEFER_BINDING) AS SELECT * FROM missing_deferred_table;

ALTER SEQUENCE IF EXISTS missing_sequence OWNED BY parsed_data_alter;

ALTER TABLE IF EXISTS parsed_data_alter RENAME COLUMN nested.a TO renamed;

ALTER TABLE IF EXISTS parsed_data_alter ADD COLUMN nested.c INTEGER;

ALTER TABLE IF EXISTS parsed_data_alter DROP COLUMN IF EXISTS nested.b CASCADE;

ALTER TABLE IF EXISTS parsed_data_alter ADD COLUMN constrained INTEGER NOT NULL UNIQUE USING COMPRESSION uncompressed;

ALTER TABLE IF EXISTS parsed_data_alter ALTER COLUMN removable SET NOT NULL;

ALTER TABLE IF EXISTS parsed_data_alter ALTER COLUMN removable DROP NOT NULL;

CREATE INDEX IF NOT EXISTS parsed_data_index ON parsed_data_alter(i);

COPY parsed_data_alter TO (getvariable('parsed_data_copy_path'));

CREATE OR REPLACE SEQUENCE parsed_data_sequence;

CREATE TEMPORARY SEQUENCE IF NOT EXISTS parsed_data_temp_sequence;

VACUUM ANALYZE parsed_data_alter(i, removable);

BEGIN TRANSACTION READ ONLY;

ROLLBACK;

BEGIN TRANSACTION READ WRITE;

COMMIT;

DETACH IF EXISTS parsed_data_db;

SELECT (3).ifnull(5);

SELECT (NULL::INTEGER).ifnull(5);

SELECT ifnull(NULL::INTEGER, 5);

SELECT ['abc'].ifnull(['def']);

SELECT ['abc'].ifnull(NULL);

SELECT (NULL::VARCHAR).ifnull('x').ifnull('y');

SELECT (3).nullif(3);

SELECT ('abc'::INTEGER).try();

SELECT try('abc'::INTEGER);

SELECT (1).construct_array(2, 3);

SELECT construct_array(1, 2, 3);

SELECT ('2020-01-01').date();

SELECT date('2020-01-01');

SELECT (NULL::INTEGER).coalesce(5);

SELECT (NULL::INTEGER).coalesce(NULL, 7);

SELECT coalesce(NULL::INTEGER, 5);

SELECT (NULL::INTEGER).coalesce(NULL, NULL, 9);

SELECT (1).coalesce(error('must not be evaluated'));

CREATE TABLE integers(a INTEGER, b INTEGER);

INSERT INTO integers VALUES (1, 2), (3, 4);

SELECT [(COLUMNS(*).unpack())] FROM integers ORDER BY ALL;

CREATE MACRO "try"(x) AS 999;

SELECT try(1);

SELECT (1)."try"();

CREATE MACRO chain_probe(x) AS 999;

SELECT (1).chain_probe();

CREATE MACRO "coalesce"(a, b) AS 999;

CREATE MACRO s.coalesce(a, b) AS 777;

SELECT "coalesce"(NULL, 5), s.coalesce(NULL, 5) FROM (SELECT 1 AS s);

SELECT COALESCE(NULL, 5);

SELECT (NULL::INTEGER).coalesce(1);

SELECT (a).string_agg(',' ORDER BY a DESC) FROM integers;

CREATE TABLE t AS SELECT * FROM (VALUES (NULL::VARCHAR), ('2020-01-01')) v(col);

SELECT col.ifnull('b'), col.coalesce(NULL, 'c'), t.col.ifnull('d'), col.coalesce('e').ifnull('f') FROM t ORDER BY ALL;

SELECT col.date(), col.try(), col.construct_array('x') FROM t ORDER BY ALL;

ATTACH ':memory:' AS mem_db;

SELECT main.ifnull(NULL, 'z'), MAIN.ifnull(NULL, 'y'), system.main.date('2020-01-01'), mem_db.main.try('x'::INTEGER);

SELECT [main.unpack(COLUMNS(*))] FROM (SELECT 1 AS a, 2 AS b);

CREATE MACRO mem_db.main.coalesce(a, b) AS 777;

SELECT mem_db.main.coalesce(NULL, 5);

SELECT s.ifnull('z'), s.lower() FROM (VALUES (NULL), ('A')) v(s) ORDER BY ALL;

SELECT mem_db.ifnull(2) FROM (SELECT 1 AS mem_db);

DETACH mem_db;

CREATE MACRO or_z(p) AS p.ifnull('z');

SELECT or_z(NULL), or_z('q');

PREPARE v1 AS SELECT POSITION(? in ?);

EXECUTE v1('e', 'hello world');

CREATE SCHEMA g;

CREATE MACRO g.describe(x) AS TABLE SELECT x AS v;

CREATE MACRO g.summarize(x) AS TABLE SELECT x AS v;

CREATE MACRO g.show(x) AS TABLE SELECT x AS v;

CREATE MACRO g.pivot(x) AS TABLE SELECT x AS v;

CREATE MACRO g.unpivot(x) AS TABLE SELECT x AS v;

FROM g.describe('a') UNION ALL FROM g.summarize('b') UNION ALL FROM g.show('c') UNION ALL FROM g.pivot('d')
UNION ALL FROM g.unpivot('e') ORDER BY ALL;

ATTACH ':memory:' AS db;

CREATE SCHEMA db.g;

CREATE MACRO db.g.describe(x) AS TABLE SELECT x AS v;

SELECT * FROM db.g.describe('f');

CREATE SCHEMA "_3_schema";

CREATE TABLE "_3_schema"."_4_table"("_0_a" INTEGER, "__2_c" INTEGER, _a3 INTEGER);

INSERT INTO "_3_schema"."_4_table" VALUES (1,2,3),(1,2,3),(NULL,NULL,4);

CREATE VIEW quoted_columns AS SELECT t."_0_a", t."__2_c", t._a3 FROM "_3_schema"."_4_table" t;

SELECT contains(sql, 't."_0_a"') FROM duckdb_views() WHERE view_name = 'quoted_columns';

SELECT * FROM quoted_columns;

CREATE VIEW printable_join AS SELECT count(*) n FROM "_3_schema"."_4_table" l JOIN "_3_schema"."_4_table" r ON l."_0_a"=r."_0_a";

SELECT n FROM printable_join;

SELECT count(*) FROM temp.main."_0_errors";

SELECT count(*) FROM temp.main."_9e3";

SELECT 'a' NOT LIKE 'b', 'a' NOT ILIKE 'b', 'a' NOT GLOB 'b', 'a' NOT SIMILAR TO 'b', 'a' !~~ 'b';

SELECT a[:-:2], a[2:-1], a[:-2], a[-2:] FROM (SELECT [1, 2, 3] a);

CREATE TEMP MACRO m(a INT := 1) AS a + 1;

SELECT m(), m(a := 5);

SELECT 1.5, .5, 1., 1e5, 1.5e-3, 1_000.5;

CREATE TABLE t (a INTEGER);

SELECT x'41', e'ab', b'101', n'abc';

SELECT 1 IN (), 1 NOT IN ();

CREATE TEMPORARY TABLE x (a INTEGER);

CREATE TEMPORARY SECRET s (TYPE http);

CREATE PERSISTENT SECRET p (TYPE http);

SELECT name, persistent FROM duckdb_secrets() WHERE name = 'p';

DROP PERSISTENT SECRET p;

DROP SECRET s;

CREATE RECURSIVE VIEW v(n) AS SELECT 1 UNION ALL SELECT n + 1 FROM v WHERE n < 3;

SELECT count(*) FROM v;

PIVOT t USING count(*);

PIVOT t GROUP BY a ORDER BY a;

CREATE TABLE y (a INTEGER CONSTRAINT c NOT NULL, b INTEGER CONSTRAINT d CHECK (b > 0));

SELECT count(*) FROM t TABLESAMPLE 2 ROWS;

SELECT count(*) FROM t WHERE a > 0 USING SAMPLE 1 ROWS;

SELECT count(*) FROM range(100) TABLESAMPLE 10 ROWS;

SELECT count(*) FROM (SELECT * FROM range(100)) TABLESAMPLE 10 ROWS;

SELECT count(*) FROM VALUES (1), (2), (3) v(x) TABLESAMPLE 1 ROWS;

SELECT count(*) FROM VALUES (1), (2), (3) TABLESAMPLE 2 ROWS;

SELECT count(*) FROM range(3) t, LATERAL (SELECT t.range) s;

SELECT typeof('2020-01-01'::TIMESTAMP(3)), typeof('2020-01-01'::TIMESTAMP(3) WITHOUT TIME ZONE),
       typeof('2020-01-01'::TIMESTAMP WITH TIME ZONE);

VACUUM (ANALYZE) t;

VACUUM (ANALYSE) t;

CREATE SEQUENCE s INCREMENT BY -2 START WITH -1 MINVALUE -100 MAXVALUE -1;

SELECT nextval('s'), nextval('s');

PREPARE 'p' AS SELECT 42;

EXECUTE 'p';

DEALLOCATE 'p';

WITH x('a') AS (SELECT 1)
SELECT a FROM x;

SELECT *
FROM (VALUES (1)) a(i)
JOIN (VALUES (1)) b(i) USING ('i');

CREATE TABLE named_constraint(i INT, CONSTRAINT 'u' UNIQUE(i));

INSERT INTO named_constraint VALUES (1);

CREATE TABLE rename_target(i INT);

INSERT INTO rename_target VALUES (1);

ALTER TABLE rename_target RENAME COLUMN i TO 'renamed_i';

ALTER TABLE rename_target RENAME TO 'renamed_table';

SELECT renamed_i FROM renamed_table;

CREATE TABLE analyze_target(i INT);

ANALYZE analyze_target('i');

VACUUM ANALYZE analyze_target('i');

CREATE TABLE 'commented'(i INT);

COMMENT ON TABLE 'commented' IS 'hello';

SELECT comment FROM duckdb_tables() WHERE table_name = 'commented';

SELECT * FROM integers WHERE COLUMNS(*) IS NULL ORDER BY ALL;

SELECT * FROM integers ORDER BY *, *;

CALL enable_logging(['QueryLog'], storage='memory');

/* leading */ SELECT current_query();

SELECT current_query() /* trailing */;

-- tag
SELECT replace(current_query(), chr(10), '|');

SELECT 'first';

/* between */ SELECT 'second';

SELECT '[' || message || ']' FROM duckdb_logs WHERE type = 'QueryLog' AND (message LIKE 'SELECT ''first''%' OR message LIKE ' /* between */%') ORDER BY timestamp;

CREATE TABLE "weird name"("odd col" INTEGER, "select" VARCHAR, "He said ""hi""" INTEGER);

CREATE TABLE "t chk"("a b" INTEGER CHECK ("a b" > 0), "c d" INTEGER UNIQUE);

CREATE TABLE "t gen"("a b" INTEGER, "g h" INTEGER GENERATED ALWAYS AS ("a b" * 2));

CREATE TABLE "t fk"("a b" INTEGER PRIMARY KEY, "c d" INTEGER REFERENCES "t fk"("a b"));

CREATE TABLE "t comp"("a b" INTEGER NOT NULL DEFAULT 7, "c d" INTEGER, PRIMARY KEY ("a b", "c d"));

CREATE SCHEMA "weird schema";

CREATE TABLE "weird schema"."qualified tbl"("x y" INTEGER);

CREATE TABLE "t fk2"("a b" INTEGER, FOREIGN KEY ("a b") REFERENCES "t fk"("a b"));

CREATE VIEW "weird view"("col a", "col b") AS SELECT 1, 2;

CREATE SEQUENCE "weird seq" START WITH 3 INCREMENT BY 2 MINVALUE 1 MAXVALUE 99 CYCLE;

CREATE TYPE "weird enum" AS ENUM ('a b', 'c''d', '');

CREATE TYPE "weird struct" AS STRUCT("a b" INTEGER, "c d" VARCHAR);

CREATE TYPE "weird union" AS UNION("a b" INTEGER, "c d" VARCHAR);

CREATE MACRO "weird macro"("a b") AS "a b" + 1;

CREATE MACRO "macro defaults"(a, "b c" := 3) AS a + "b c";

CREATE MACRO "table macro"() AS TABLE SELECT 1 AS "q q";

ALTER TABLE "weird name" ADD COLUMN "new col" INTEGER;

ALTER TABLE "weird name" ADD COLUMN IF NOT EXISTS "new col2" INTEGER DEFAULT 4;

ALTER TABLE "weird name" RENAME COLUMN "odd col" TO "odder col";

ALTER TABLE "weird name" ALTER COLUMN "odder col" SET DEFAULT 5;

ALTER TABLE "weird name" ALTER COLUMN "odder col" DROP DEFAULT;

ALTER TABLE "weird name" ALTER COLUMN "odder col" TYPE BIGINT;

ALTER TABLE "weird name" DROP COLUMN "new col2";

ALTER TABLE "weird name" RENAME TO "other name";

ALTER TABLE "other name" RENAME TO "weird name";

ALTER VIEW "weird view" RENAME TO "other view";

COMMENT ON TABLE "weird name" IS 'a comment with '' a quote';

COMMENT ON COLUMN "weird name"."odder col" IS 'hi';

CREATE INDEX "weird idx" ON "weird name"("odder col");

CREATE UNIQUE INDEX "weird uidx" ON "weird name"("select");

INSERT INTO "weird name"("odder col", "select", "He said ""hi""") VALUES (1, 'x', 2);

INSERT INTO "weird name" BY NAME SELECT 3 AS "odder col", 'y' AS "select";

INSERT INTO "t chk" VALUES (1, 1) ON CONFLICT DO NOTHING;

INSERT INTO "t comp" VALUES (1, 1) ON CONFLICT ("a b", "c d") DO NOTHING;

INSERT INTO "t chk" VALUES (1, 1) ON CONFLICT ("c d") DO UPDATE SET "a b" = excluded."a b" + 1 WHERE "t chk"."a b" > 0;

INSERT INTO "weird name"("odder col", "select", "He said ""hi""") VALUES (5, 'x', 6)
ON CONFLICT ("select") DO UPDATE SET "He said ""hi""" = excluded."He said ""hi""";

UPDATE "weird name" SET "select" = 'z' WHERE "odder col" = 1;

DELETE FROM "weird name" WHERE "odder col" = 99;

MERGE INTO "t chk" USING "t chk" AS "src x" ON "t chk"."a b" = "src x"."a b" WHEN MATCHED THEN DELETE;

MERGE INTO "t comp" USING (SELECT 1 AS "a b", 1 AS "c d") AS "src x" USING ("a b", "c d") WHEN MATCHED THEN DELETE;

SELECT ~1 + 2;

SELECT (~1) + 2;

SELECT (-x) + 2 FROM (VALUES (1)) t(x);

SELECT (+x) + 2 FROM (VALUES (1)) t(x);

SELECT "odder col" AS "a b" FROM "weird name" AS "al ias" ORDER BY "a b";

SELECT * FROM "weird name" t1 JOIN "weird name" t2 USING ("odder col");

SELECT sum("odder col") FILTER (WHERE "odder col" > 0) OVER (PARTITION BY "select" ORDER BY "odder col")
FROM "weird name";

SELECT * FROM "weird name" QUALIFY row_number() OVER (ORDER BY "odder col") = 1;

SELECT list_transform([1,2], lambda "x y": "x y" * 2), {'a b': 1}['a b'], MAP{'k k': 1}['k k'];

SELECT * FROM (VALUES (1)) AS "v v"("c c");

SELECT "weird name".* FROM "weird name";

SELECT "weird name".* EXCLUDE ("select") FROM "weird name";

SELECT * EXCLUDE ("select") RENAME ("odder col" AS "renamed col") FROM "weird name";

SELECT * REPLACE ("odder col" + 1 AS "odder col") FROM "weird name";

SELECT COLUMNS('od.*') FROM "weird name";

SELECT * FROM (PIVOT "weird name" ON "select" USING sum("odder col"));

SELECT * FROM (UNPIVOT "weird name" ON "odder col" INTO NAME "n n" VALUE "v v");

WITH "cte name"("c one") AS (SELECT 1) SELECT "c one" FROM "cte name";

SELECT * FROM "weird name" TABLESAMPLE reservoir(2 ROWS) REPEATABLE (1);

PREPARE "weird prep" AS SELECT $1;

EXECUTE "weird prep"(1);

DEALLOCATE "weird prep";

ATTACH IF NOT EXISTS ':memory:' AS "db two";

DETACH "db two";

ATTACH IF NOT EXISTS ':memory:' AS "db four" (READ_ONLY false);

DETACH "db four";

DESCRIBE SELECT "odder col" AS "a b" FROM "weird name";

SUMMARIZE SELECT "odder col" AS "a b" FROM "weird name";

DROP INDEX "weird uidx";

DROP INDEX "weird idx";

DROP MACRO "weird macro";

DROP MACRO "macro defaults";

DROP MACRO TABLE "table macro";

DROP VIEW "other view";

DROP SEQUENCE "weird seq";

DROP TYPE "weird enum";

DROP TYPE "weird struct";

DROP TYPE "weird union";

DROP TABLE "t fk2";

DROP TABLE "t fk";

DROP TABLE "t gen";

DROP TABLE "t chk";

DROP TABLE "t comp";

DROP TABLE "weird name";

DROP SCHEMA "weird schema" CASCADE;

CREATE TABLE tbl AS FROM values(1), (4), (8), (0) i(x);

SELECT SWITCH(x, MAP { 1: 'yes', 0: 'no'}, 'maybe') FROM tbl;

CREATE TABLE nums AS FROM range(5) tbl(i);

SELECT SWITCH(i % 2, MAP { 0 : 'even', 1 : 'odd'}, 'error') FROM nums ORDER BY i;

SELECT
    CASE (i % 2)
        WHEN 0 THEN 'even'
        WHEN 1 THEN 'odd'
        ELSE 'error'
    END
FROM nums
ORDER BY i;

SELECT switch(i, MAP {1 : 100, 3 : 300}) FROM nums ORDER BY i;

SELECT
    CASE i
        WHEN 1 THEN 100
        WHEN 3 THEN 300
    END
FROM nums
ORDER BY i;

CREATE TABLE null_test AS FROM VALUES (1), (NULL), (2) i(val);

SELECT
    CASE val
        WHEN 1 THEN 'one'
        WHEN NULL THEN 'is_null'
        ELSE 'other'
    END
FROM null_test
ORDER BY val;

SELECT switch(val, MAP { 1+1 : 'one', 1: 'is_null'}, 'other') FROM null_test ORDER BY val;

CREATE TABLE map_expr(i map(integer, integer));

INSERT INTO map_expr VALUES (MAP {1 : 2});

SELECT switch(map([false],[10]), map([map([false],[10])],[999]), 777);

SELECT switch(2, map([1,2,3],['a','b','c']));

SELECT switch(9, map([1,2],['a','b']), 'dflt');

SELECT switch(map([true],[10]), 99);

SELECT switch(map([true],[10]));

SELECT val, switch(val, MAP {1: 'one'}, NULL) FROM null_test ORDER BY val;

SELECT switch(NULL::INT, MAP {1: 'one'}, 'other');

SELECT switch(MAP {true: 'one'}, NULL);

SELECT switch(val, MAP {1: 'one', 2: 'two'}, 'other') FROM null_test ORDER BY val;

CREATE TABLE t(a INTEGER, x INTEGER);

CREATE TABLE tbl(i INTEGER);

SET VARIABLE my_timestamp = TIMESTAMP '2020-01-01';

SELECT COLUMNS(*) FROM integers;

SELECT MIN(COLUMNS(*)), MAX(COLUMNS(*)) FROM integers;

SELECT MIN(COLUMNS(* EXCLUDE (j))), MAX(COLUMNS(* EXCLUDE (i))) FROM integers;

SELECT MIN(COLUMNS(* REPLACE (i+j AS i))) FROM integers;

SELECT COLUMNS(*) + 1 FROM integers;

SELECT COLUMNS(*) + COLUMNS(*) FROM integers;

CREATE TABLE grouped_table AS SELECT  1 id, 42 index1, 84 index2 UNION ALL SELECT 2, 13, 14;

SELECT id, MIN(COLUMNS('index[0-9]')) FROM grouped_table GROUP BY all ORDER BY ALL;

SELECT id, MIN(COLUMNS('[0-9]')) FROM grouped_table GROUP BY all ORDER BY ALL;

SELECT * FROM grouped_table ORDER BY COLUMNS('index[0-9]');

SELECT * FROM grouped_table ORDER BY COLUMNS(*);

SELECT COLUMNS([x for x in *]) FROM integers;

SELECT COLUMNS([x for x in (*) if x <> 'i']) FROM integers;

SELECT COLUMNS(lambda x: x <> 'i') FROM integers;

SELECT COLUMNS([x for x in (*) if x SIMILAR TO 'i']) FROM integers;

SELECT COLUMNS(['i', 'i']) FROM integers;

SELECT COLUMNS(list_concat(['i'], ['i'])) FROM integers;

SELECT COLUMNS([x for x in (* EXCLUDE (i))]) FROM integers;

SELECT COLUMNS(['i']) + COLUMNS(['i']) FROM integers;

SELECT COLUMNS([x for x in (*) if x LIKE 'i']) FROM integers i1 JOIN integers i2 USING (i);

SELECT COLUMNS([x for x in (*) if x LIKE 'i']) FROM integers i1 JOIN integers i2 ON (i1.i=i2.i);

CREATE TABLE tbl(col1 INTEGER, col2 INTEGER, col3 INTEGER);

INSERT INTO tbl VALUES (1, 200, 10), (2, 100, 20), (3, 200, 0);

SELECT * FROM tbl ORDER BY COLUMNS('col1|col3');

SELECT * FROM tbl ORDER BY COLUMNS('col2|col3');

SELECT * FROM tbl ORDER BY COLUMNS('col2|col3') DESC;

SELECT * FROM tbl ORDER BY COLUMNS('col2') DESC, COLUMNS('col3') ASC;

SELECT * FROM tbl ORDER BY COLUMNS(lambda x: x[-1] IN ('2', '3'));

FROM tbl UNION FROM tbl ORDER BY COLUMNS('col2|col3') DESC;

create or replace table my_table as
select 'test1' as column1, 1 as column2, 'quack' as column3
union all
select 'test2' as column1, 2 as column2, 'quacks' as column3
union all
select 'test3' as column1, 3 as column2, 'quacking' as column3;

prepare v1 as
select
	COLUMNS(?)
from my_table;

EXECUTE v1('col.*1');

EXECUTE v1('col.*2');

EXECUTE v1('col.*3');

EXECUTE v1(['column1', 'column2']);

select COALESCE(*COLUMNS(*)) from (select NULL, 2, 3) t(a, b, c);

select column_name from (describe select COALESCE(*COLUMNS(*)) from (select NULL, 2, 3) t(a, b, c));

select column_name from (describe select COALESCE(*COLUMNS(*)) as a from (select NULL, 2, 3) t(a, b, c));

create table contains_test as select '123abc234' a, 4 b, 'abc' c;

select contains(*COLUMNS('[a|c]')) from contains_test;

select COLUMNS('[a|c]') from contains_test;

create table sales as from ( values
	(150, '2017/06/12'::DATE, 3),
	(125, '2017/08/29'::DATE, 2),
	(175, '2017/06/12'::DATE, 4),
) t(amount, date, priority);

SELECT first(amount ORDER BY date ASC, priority DESC) FROM sales;

select COALESCE(*COLUMNS(lambda c: c in ('a', 'c'))) from (select NULL, 2, 3) t(a, b, c);

select 2 in (*COLUMNS(*)) from (select 1, 2, 3) t(a, b, c);

from (VALUES (1, 2, 3), (2, 3, 0), (0, 0, 1)) tbl(a, b, c) where 1 IN (*COLUMNS(*));

create table data AS (
	SELECT * FROM (VALUES
	(1, 'Alice'),
	(2, 'Bob'),
	(3, 'Alice'),
	(4, 'Carol')
	) AS t(id, name)
);

select struct_pack(*COLUMNS(*)) from data;

select COLUMNS(*), struct_pack(COLUMNS(['id'])) from data;

select struct_pack(
	b := struct_pack(*COLUMNS(['id'])),
	a := struct_pack(*COLUMNS(['id']))
) from data;

select struct_pack(*COLUMNS('id')) a, struct_pack(*COLUMNS('name')) from data;

select CONCAT(*COLUMNS(*), *COLUMNS(*)) from data;

with integers as (
	SELECT * FROM (VALUES
		(42, 31),
		(85, 76),
	) as t(a, b)
)
select *COLUMNS('a') + 42 from integers;

with integers as (
	select * FROM (VALUES
		(21, 42),
		(1337, 7331)
	) as t(a, b)
)
select [(UNPACK(a + COLUMNS(['a', 'b'])))] from integers;

select
	[UNPACK(COLUMNS(*)::VARCHAR)]
from (
	select
		21::INTEGER a,
		True::BOOL b,
		0.1234::DOUBLE c
);

SELECT * FROM tbl WHERE COLUMNS(*) >= 2 ORDER BY ALL;

SELECT * FROM tbl WHERE COLUMNS(['col1', 'col2']) >= 2 ORDER BY ALL;

SELECT * FROM tbl WHERE COLUMNS(['col1', 'col2']) >= 2 AND COLUMNS(*) IS NOT NULL ORDER BY ALL;

SELECT * FROM tbl WHERE COLUMNS(['col1', 'col2']) >= 2 AND COLUMNS(['col1', 'col3']) < 10 ORDER BY ALL;

FROM query('SELECT 1' || repeat('::INTEGER', 50));

FROM query('SELECT ''a''' || repeat('.lower()', 50));

FROM query('SELECT 1 IN (1)' || repeat('::BOOLEAN', 50));

FROM query('SELECT length(''a''' || repeat(' || ''a''', 50) || ')');

FROM query('SELECT x IS NULL FROM (SELECT NULL::' || repeat('STRUCT(a ', 50) || 'INTEGER' || repeat(')', 50) || ' AS x)');

FROM query('SELECT ' || repeat('abs(', 30) || 'length(''a''' || repeat(' || ''a''', 30) || ')' || repeat(')', 30));

SET max_expression_depth=300;

SELECT [[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[1]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]] IS NOT NULL;

SELECT abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(abs(1))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))))));

SET max_expression_depth=10;

CREATE TABLE data AS SELECT x FROM range(100) t(x);

FROM query('SELECT count(*) FROM data WHERE x < 1' || repeat(' OR x < 50', 49));

FROM query('SELECT count(*) FROM data WHERE x >= 0' || repeat(' AND x < 50', 50));

FROM query('SELECT count(*) FROM data WHERE x < 1' || repeat(' OR x < 50 AND x >= 0', 49));

FROM query('SELECT count(*) FROM data WHERE x < 1' || repeat(' OR x < 50', 20000));

SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT 1 AS x)))));

SELECT * FROM (SELECT * FROM (SELECT x FROM (SELECT 1 AS x) t1) t2) t3 JOIN LATERAL (SELECT x + 1 AS y) t4 ON true;

SELECT 2*3+1;

SELECT 1+2*3;

SELECT 2^2 + 1;

SELECT 2**2 + 1;

SELECT 1+2**2;

SELECT 1+2^2;

SELECT 2**4 / 2;

SELECT 2**(4 / 2);

SELECT 16/2**4;

SELECT (16/2)**4;

SELECT 2**3**2;

SELECT 2^3**2;

SELECT 2**3^2;

SELECT ~1 * 2;

SELECT ~(1 + 2);

SELECT ~1 & 3;

SELECT ~1 | 3;

SELECT 5 & ~1 + 2;

SELECT ~ ~1 + 2;

SELECT (~2) ^ 2;

SELECT user FROM (VALUES ('hello world')) t(user);

SELECT user;

SELECT user FROM (VALUES (42)) user(x);

select
  1 as one,
  max(cast('1000-05-01 00:00:00' as timestamp)) as mt
group by one
having max(cast('1000-05-01 00:00:00' as timestamp))  <= current_timestamp;

select a as "b", "b" + 1 from (VALUES (84), (42)) t(a) ORDER BY ALL;

select a as "CURRENT_TIMESTAMP" from (VALUES (84), (42)) t(a) order by "CURRENT_TIMESTAMP" + 1;

select a as localtime from (VALUES ('2018-01-01'), ('2022-01-01')) t(a) where localtime >= '2020-01-01';

SET debug_verify_statement='reparse_statement';

ATTACH ':memory:' AS "my db";

CREATE TABLE "my db".tbl AS SELECT 42 i;

SELECT 42,;

SELECT 42,
       84,;

SELECT DISTINCT 42,
       84,;

VALUES (42,);

VALUES (42,),;

SELECT * FROM (VALUES (42,));

CREATE TABLE integers(i INTEGER, j INTEGER,);

INSERT INTO integers VALUES (42, 84,),;

SELECT * FROM integers,;

SELECT i, SUM(j) FROM integers GROUP BY i,;

UPDATE integers SET i=100,;

SELECT i FROM integers;

SELECT [1,];

SELECT ARRAY[1,];

SELECT {'a': 42, 'b': 84,};

CREATE TABLE _1099_vendors (id INTEGER, _1099_amount DECIMAL(10,2));

INSERT INTO _1099_vendors VALUES (1, 12.5);

SELECT v._1099_amount FROM _1099_vendors v;

SELECT * FROM main._1099_vendors;

ATTACH ':memory:' AS _0_db;

CREATE TABLE _0_db.main._1099_vendors AS SELECT * FROM _1099_vendors;

SELECT * FROM _0_db.main._1099_vendors;

SELECT _1099_vendors._1099_amount, main._1099_vendors.id FROM main._1099_vendors;

SELECT s._1, {'_2': 42}._2 FROM (SELECT {'_1': 7} AS s);

CREATE SCHEMA _0_db._2_schema;

CREATE TABLE _0_db._2_schema._3_table (_4_col INTEGER);

INSERT INTO _0_db._2_schema._3_table VALUES (5);

USE _0_db;

SELECT t._4_col FROM _2_schema._3_table t WHERE t._4_col = 5;

SELECT _0_db._2_schema._3_table._4_col FROM _0_db._2_schema._3_table;

SELECT 1_000, .5, 1.5_5, 1_0.2_5;

SELECT c FROM (SELECT 1._5) t(c);

SELECT _5 FROM (SELECT 1._5);

CREATE TABLE people(Name VARCHAR, STATE VARCHAR, Country VARCHAR);

DESCRIBE people;

SELECT * FROM values (42) t;

SELECT * FROM values (42) t, values (84) x;

SET VARIABLE wide_struct_sql = (
    SELECT 'SELECT (NULL::STRUCT(' || string_agg('c' || i || ' INTEGER', ',') || ')) IS NULL'
    FROM range(1500) t(i)
);

FROM query(getvariable('wide_struct_sql'));

SET VARIABLE many_structs_sql = (
    SELECT 'SELECT ' || string_agg('NULL::STRUCT(a INTEGER) AS c' || i, ',')
    FROM range(600) t(i)
);

SELECT count(*) FROM query(getvariable('many_structs_sql'));

SET VARIABLE many_maps_sql = (
    SELECT 'SELECT ' || string_agg('NULL::MAP(INTEGER, INTEGER) AS c' || i, ',')
    FROM range(1100) t(i)
);

CREATE TABLE wide_maps AS FROM query(getvariable('many_maps_sql'));

SELECT count(*) FROM wide_maps;
