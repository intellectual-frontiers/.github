CREATE TABLE t1(col1 INT, col2 STRING);

SELECT LEN(LOWER('X')) AS a, 1 AS b, b AS c GROUP BY LOWER('X') HAVING LOWER('X') = 'x';

-- LCA attributes shouldn't be counted in UNRESOLVED_GROUP_BY_ALL validation
SELECT COUNT(col1) as alias, SUM(col1) + alias FROM t1 GROUP BY ALL;

-- LCA in a Project, subquery laterally referenced.
SELECT 1 AS a,
  (SELECT MAX(rn) FROM (SELECT ROW_NUMBER() OVER (ORDER BY col1) AS rn FROM VALUES (1), (2))) AS c,
  c + a AS d;

SELECT 1 AS a, a + 1 AS b,
  b IN (SELECT ROW_NUMBER() OVER (ORDER BY col1) FROM VALUES (1), (2)) AS c;

-- The same with other functions, with GROUP BY, without LCA, and inside a scalar subquery.
SELECT 1 AS a, a + 1 AS b, MAX(RANK() OVER (ORDER BY col1)) AS s FROM VALUES (1), (2);

SELECT 1 AS a, a + 1 AS b,
  (SELECT SUM(ROW_NUMBER() OVER (ORDER BY col1)) FROM VALUES (1), (2)) AS c;

-- test cases for array functions

create temporary view data as select * from values
  ("one", array(11, 12, 13), array(array(111, 112, 113), array(121, 122, 123))),
  ("two", array(21, 22, 23), array(array(211, 212, 213), array(221, 222, 223)))
  as data(a, b, c);

-- index into array of arrays
select a, c[0][0] + c[0][0 + 1] from data;

-- array_contains on all primitive types: result should alternate between true and false
select
  array_contains(boolean_array, true), array_contains(boolean_array, false),
  array_contains(tinyint_array, 2Y), array_contains(tinyint_array, 0Y),
  array_contains(smallint_array, 2S), array_contains(smallint_array, 0S),
  array_contains(int_array, 2), array_contains(int_array, 0),
  array_contains(bigint_array, 2L), array_contains(bigint_array, 0L),
  array_contains(decimal_array, 9223372036854775809), array_contains(decimal_array, 1),
  array_contains(double_array, 2.0D), array_contains(double_array, 0.0D),
  array_contains(float_array, float(2.0)), array_contains(float_array, float(0.0)),
  array_contains(date_array, date '2016-03-14'), array_contains(date_array, date '2016-01-01'),
  array_contains(timestamp_array, timestamp '2016-11-15 20:54:00.000'), array_contains(timestamp_array, timestamp '2016-01-01 20:54:00.000')
from primitive_arrays;

-- sort_array with an invalid string literal for the argument of sort order.
select sort_array(array('b', 'd'), '1');

-- index out of range for array elements
select element_at(array(1, 2, 3), 5);

select element_at(array(1, 2, 3), -2147483648);

select elt(0, '123', '456');

select elt(null, '123', null);

select array(1, 2, 3)[5];

select array_size(array(true));

select array_size(map('a', 1, 'b', 2));

select size(arrays_zip(array(1, 2, 3), array(4), null, array(7, 8, 9, 10)));

select isnotnull(arrays_zip(array(1, 2, 3), NULL, array(4), array(7, 8, 9, 10)));

select get(array(1, 2, 3), null);

select get(1, -1);

select get(null, 0);

select get(CAST (null AS string), 0);

select array_insert(array(2, 3, 4), 1, 1);

select array_insert(cast(NULL as ARRAY<INT>), 1, 1);

select array_insert(array(2, 3, NULL, 4), 5, 5);

set spark.sql.legacy.negativeIndexInArrayInsert=true;

select array_compact(array("1", null, "2", null));

select array_compact(array(array(1, 2, 3, null), null, array(4, null, 6)));

select array_append(array('a', 'b', 'c'), 'd');

select array_append(CAST(null AS ARRAY<String>), 'a');

select array_append(CAST(array() AS ARRAY<String>), CAST(NULL AS String));

select array_prepend(array('a', 'b', 'c'), 'd');

select array_prepend(CAST(null AS ARRAY<String>), 'a');

select array_prepend(CAST(array() AS ARRAY<String>), CAST(NULL AS String));

select array_distinct(array(0.0, -0.0, -0.0, DOUBLE("NaN"), DOUBLE("NaN")));

select trim_array(array(1, 2, 3, 4, 5), 5);

select trim_array(array(), 0);

-- trim_array with NULL array or NULL n returns NULL
select trim_array(CAST(null AS ARRAY<INT>), 1);

SET TIME ZONE 'UTC';

-- Composability: feed BIN BY into a downstream GROUP BY.
SELECT bin_start, SUM(value) AS total
FROM metrics BIN BY (
  RANGE ts_start TO ts_end
  BIN WIDTH INTERVAL '5' MINUTE
  ALIGN TO TIMESTAMP '2024-01-01 00:00:00'
  DISTRIBUTE UNIFORM (value)
)
GROUP BY bin_start
ORDER BY bin_start;

SELECT * FROM metrics BIN BY (
  RANGE value TO ts_end
  BIN WIDTH INTERVAL '5' MINUTE
  DISTRIBUTE UNIFORM (value)
);

SELECT X'';

SELECT array( X'', X'4561736F6E2059616F20323031382D31312D31373A31333A33333A3333', CAST('Spark' as BINARY));

SELECT from_xml(
         to_xml(named_struct('name', binary('Eason'), 'birth', 2018, 'org', binary('Kindergarten Cop'))),
         'name STRING, birth INT, org STRING');

-- boolean
select bit_count(true);

select bit_count(cast(2 as tinyint));

select bit_count(2S);

select bit_count(2);

select bit_count(2L);

-- edge value
select bit_count(9223372036854775807L);

select bit_count('a');

-- null case
SELECT BIT_XOR(b4) AS n1 FROM bitwise_test where b4 is null;

--having
SELECT b1, bit_xor(b2) FROM bitwise_test GROUP BY b1 HAVING bit_and(b2) < 7;

select getbit(11L, 2 + 1), getbit(11L, 3 - 1), getbit(10L + 1, 1 * 1), getbit(cast(11L / 1 AS long), 1 - 1);

select getbit(11L, 64);

SELECT 20181117 >>> 2;

SELECT 20181117 > >> 2;

select cast(null as array<array<int>>), 20181117 >> 2;

select 1 << 1 + 2 as plus_over_shift;

-- cast string representing a valid fractional number to integral should truncate the number
SELECT CAST('1.23' AS int);

SELECT CAST('-4.56' AS long);

SELECT CAST('abc' AS float);

SELECT CAST('12345678901234567890123' AS long);

SELECT CAST('' AS float);

SELECT CAST(NULL AS long);

SELECT CAST('123.a' AS float);

SELECT CAST('-2147483649' AS int);

-- '-9223372036854775808' is the smallest long value
SELECT CAST('-9223372036854775808' AS long);

SELECT CAST('9223372036854775808' AS long);

SELECT HEX(CAST(CAST(-123 AS byte) AS binary));

SELECT HEX(CAST(123 AS binary));

SELECT HEX(CAST(-123L AS binary));

-- TODO: migrate all cast tests here.

-- cast string to interval and interval to string
SELECT CAST('interval 3 month 1 hour' AS interval);

SELECT CAST(interval 3 month 1 hour AS string);

-- trim string before cast to numeric
select cast(' 1' as tinyint);

select cast(' 1' as INT);

select cast(' 1 ' as DOUBLE);

select cast('1中文' as smallint);

select cast('1中文' as bigint);

select cast('\t\n xyz \t\r' as boolean);

select cast('xyz' as decimal(4, 2));

select cast('2022-01-01 00:00:00' as timestamp);

select cast('a' as timestamp_ntz);

select cast('a' as timestamp_ntz(9)) is null;

select cast(cast('2020-01-01 00:00:00.123456789' as timestamp_ntz(8)) as string);

select cast(cast('2020-01-01 00:00:00.000000999' as timestamp_ntz(9)) as string);

select cast(cast('2020-01-01 00:00:00.123456789' as timestamp_ltz(7)) as string);

-- Complex types cast to string (recursive element path, including a nested NULL).
select cast(array(cast('2020-01-01 00:00:00.123456789' as timestamp_ntz(9)), cast(null as timestamp_ntz(9))) as string);

-- NULL and a real string context.
select cast(cast(null as timestamp_ntz(9)) as string);

-- Narrowing TIMESTAMP_NTZ(p) -> TIMESTAMP_NTZ drops the sub-microsecond digits (floor).
select cast(cast('2020-01-01 00:00:00.123456789' as timestamp_ntz(9)) as timestamp_ntz);

select cast(cast('2020-01-01 00:00:00.123456789' as timestamp_ltz(9)) as timestamp);

select typeof(timestamp_ltz'2020-01-01 00:00:00.123456789'::timestamp_ltz(8));

select timestamp_ntz'2020-01-01 00:00:00.123456789'::timestamp_ntz(7)::timestamp_ntz(9);

select cast(null as timestamp_ltz(8))::timestamp_ltz(9);

select typeof(timestamp_ntz'2020-01-01 00:00:00.123456789'::timestamp_ltz(8));

select timestamp_ntz'2020-01-01 00:00:00.123456789'::timestamp_ltz(9)::timestamp_ntz(9);

-- Null propagation in both directions.
select cast(null as timestamp_ltz(9))::timestamp_ntz(7);

select typeof(timestamp_ntz'2020-01-01 00:00:00.123456'::timestamp_ltz(9));

-- Same-zone round-trips: micro(6) -> nanos -> micro(6) is lossless; nanos -> micro(6) -> nanos
-- drops the sub-microsecond digits.
select timestamp'2020-01-01 00:00:00.123456'::timestamp_ntz(9)::timestamp;

select timestamp_ntz'2020-01-01 00:00:00.123456789'::timestamp_ltz(6)::timestamp_ntz;

select cast(null as timestamp_ntz(9))::timestamp;

select cast(cast('inf' as float) as timestamp);

select cast(interval '1000' month as int);

select cast(interval -'1 02:03:04.123' day to second as int);

select cast(interval '1000000' second as smallint);

select cast(ym as interval year to month) from values(-122S) as t(ym);

select cast(100Y as interval hour to second);

select cast(10 as interval day);

-- cast ANSI intervals to decimals
select cast(interval '-1' year as decimal(10, 0));

select cast(interval '1 01:02:03.1' day to second as decimal(8, 1));

select cast(interval '10.123' second as decimal(5, 2));

select cast(80.654321BD as interval hour to minute);

-- cast TIME to integral types
SELECT CAST(TIME '00:01:52' AS tinyint);

SELECT CAST(TIME '00:01:52' AS bigint);

SELECT CAST(TIME '23:59:59' AS int);

SELECT CAST(TIME '00:00:17.5' AS int);

SELECT CAST(TIME '00:00:00' AS int);

SELECT '12345678901234567890123' :: long;

SELECT '123.a' :: int;

SELECT HEX((123 :: byte) :: binary);

select ' 1 ' :: DOUBLE;

select '2022-01-01 00:00:00' :: timestamp;

select interval '08:11:10.001' hour to second :: decimal(10, 4);

SELECT TIME '00:01:52' :: int;

SELECT '1.23' :: int :: long;

SELECT map(1, '123', 2, '456')[1] :: int;

SELECT FALSE IS NOT NULL :: string;

SELECT CAST(time '01:30:45' AS decimal(8, 3));

SELECT CAST(time '10:20:30' AS decimal(20, 10));

SELECT CAST(time '23:59:59.999999999' AS decimal(14, 9));

SELECT CAST(time '01:00:00' AS decimal(3, 0));

SELECT CAST(time '23:59:59.999' AS decimal(8, 2));

-- SPARK-57618: cast TIMESTAMP_NTZ(q) to TIME(p) extracts the time-of-day and truncates to p.
-- This direction is deterministic and time-zone independent.
SELECT CAST(timestamp_ntz'2020-05-17 12:34:56.789012' AS TIME(6));

-- Pre-epoch wall-clock time-of-day is preserved.
SELECT CAST(timestamp_ntz'1969-12-31 23:59:59.123456' AS TIME(6));

SELECT CAST(timestamp_ntz'2020-05-17 12:34:56.789012345'::timestamp_ntz(9) AS TIME(6));

-- SPARK-57618: cast TIME(p) to TIMESTAMP_NTZ(q) takes the date from CURRENT_DATE. SQL-layer
-- coverage stays deterministic: type resolution, the date anchor equals current_date(), and the
-- value round-trips back to TIME. The current-date stabilization is covered by ComputeCurrentTimeSuite
-- and the value semantics by CastSuite* unit tests.
SELECT typeof(CAST(TIME'12:34:56' AS TIMESTAMP_NTZ));

SELECT CAST(CAST(TIME'12:34:56.789012345' AS TIMESTAMP_NTZ(9)) AS DATE) = current_date();

SELECT CAST(CAST(TIME'12:34:56.789012345' AS TIMESTAMP_NTZ(7)) AS TIME(9));

SELECT CAST(CAST(NULL AS TIME) AS TIMESTAMP_NTZ(9));

-- SPARK-57749: inside an inline table the TIME -> TIMESTAMP_NTZ cast is foldable and carries no
-- CURRENT_LIKE pattern, so it is early-evaluated at analysis time and is NOT stabilized by
-- ComputeCurrentTime. Its date anchor is LocalDate.now() at analysis (not necessarily
-- current_date()), so it is intentionally not compared against current_date() here -- that would be
-- midnight-sensitive. Coverage stays deterministic via the round-trip back to TIME: the date
-- cancels, so only the time-of-day is asserted.
SELECT CAST(x AS TIME(6)) FROM VALUES (CAST(TIME'12:34:56.789012' AS TIMESTAMP_NTZ)) t(x);

SELECT coalesce(time'12:34:56', timestamp_ntz'2020-05-17 12:34:56');

-- SPARK-57660: cast TIMESTAMP_LTZ(q) to TIME(p) extracts the local wall-clock time-of-day in the
-- session time zone and truncates to p. The LTZ literal is parsed in the session zone and the
-- time-of-day is read back in the same zone, so these values stay zone-independent.
SELECT CAST(timestamp'2020-05-17 12:34:56.789012' AS TIME(6));

-- Nanosecond TIMESTAMP_LTZ(q) preserves the sub-microsecond digits up to p.
SELECT CAST(timestamp_ltz'2020-05-17 12:34:56.789012345'::timestamp_ltz(9) AS TIME(9));

SELECT CAST(timestamp_ltz'2020-05-17 12:34:56.789012345'::timestamp_ltz(7) AS TIME(9));

SELECT typeof(CAST(TIME'12:34:56' AS TIMESTAMP_LTZ(9)));

-- Round-trips re-extract the original time-of-day (truncated to the intermediate precision).
SELECT CAST(CAST(TIME'12:34:56.789012' AS TIMESTAMP_LTZ) AS TIME(6));

SELECT CAST(CAST(TIME'12:34:56.789012345'::time(9) AS TIMESTAMP_LTZ(6)) AS TIME(9));

SELECT CAST(CAST(NULL AS TIMESTAMP_LTZ) AS TIME(6));

SELECT CAST(x AS TIME(9)) FROM VALUES (CAST(TIME'12:34:56.789012345' AS TIMESTAMP_LTZ(9))) t(x);

SELECT coalesce(time'12:34:56', timestamp_ltz'2020-05-17 12:34:56.789012345'::timestamp_ltz(9));

SELECT CEIL(3.5, 0);

SELECT CEIL(-0.35, 1);

SELECT CEIL(5, 0);

SELECT CEIL(CAST(99 AS DECIMAL(2, 0)), -1);

SELECT CEIL(2.5, 0, 0);

SELECT FLOOR(-2.5, 0);

SELECT FLOOR(-35, -1);

SELECT FLOOR(3.14115, -3);

SELECT FLOOR(2.5, null);

-- Create the origin table
CREATE TABLE test_change(a INT, b STRING, c INT) using parquet;

-- Change column name (not supported on v1 table)
ALTER TABLE test_change RENAME COLUMN a TO a1;

ALTER TABLE test_change CHANGE b FIRST;

ALTER TABLE test_change CHANGE c COMMENT '';

-- Change a invalid column
ALTER TABLE test_change CHANGE invalid_col TYPE INT;

ALTER TABLE temp_view CHANGE a TYPE INT;

-- DROP TEST TABLE
DROP TABLE test_change;

SELECT typeof(CAST('hello' AS VARCHAR(5)));

SELECT CAST('abcdef' AS CHAR(2));

SELECT try_cast('abcdef' AS VARCHAR(2));

SELECT try_cast(12345 AS VARCHAR(4));

-- Explicit CAST inside LCT must keep inner truncation / overflow (do not retarget).
SELECT coalesce(CAST('abcdef' AS VARCHAR(2)), CAST('x' AS VARCHAR(4)));

SELECT coalesce(
  CAST('abcdef' AS VARCHAR(2) COLLATE UTF8_LCASE),
  CAST('x' AS VARCHAR(4) COLLATE UTF8_LCASE));

-- R2: least common type (COALESCE / CASE)
SELECT typeof(coalesce(cast('hello' AS VARCHAR(5)), cast('world' AS VARCHAR(10))));

SELECT typeof(coalesce(cast('hello' AS VARCHAR(5)), 'world'));

-- R2: least common type for IN lists
SELECT cast('a' AS CHAR(2)) IN (cast('a ' AS CHAR(2)), cast('bbb' AS VARCHAR(3)));

SELECT typeof(lower(cast('AB' AS VARCHAR(2))));

SELECT typeof(upper(coalesce(cast('a' AS CHAR(2)), cast('b' AS CHAR(4)))));

SELECT concat('<', concat(
  cast('a' AS CHAR(2) COLLATE UTF8_LCASE),
  cast('b' AS CHAR(3) COLLATE UTF8_LCASE)), '>');

SELECT typeof(trim(cast('ab  ' AS CHAR(4))));

SELECT typeof(regexp_extract(cast('ab' AS VARCHAR(2)), '(a)', 1));

SELECT typeof(mask(cast('ab' AS CHAR(2))));

SELECT typeof(elt(1, cast('ab' AS CHAR(5)), 'x'));

SELECT typeof(left(cast('ab' AS CHAR(5)), 2));

SELECT hex(cast('ab' AS CHAR(5)));

-- reverse() on a non-string input is unaffected.
SELECT typeof(reverse(array(1, 2)));

-- Collation survives CAST and LCT. Mixed lengths with the same collation widen to max(n, m);
-- they must not collapse to an indeterminate collation.
SELECT typeof(cast('a' AS CHAR(2) COLLATE UTF8_LCASE));

SELECT hex(coalesce(
  cast('a' AS CHAR(2) COLLATE UTF8_LCASE), cast('bb' AS CHAR(4) COLLATE UTF8_LCASE)));

SELECT hex(coalesce(
  cast('a' AS CHAR(2) COLLATE UTF8_LCASE),
  cast(1 AS CHAR(4) COLLATE UTF8_LCASE)));

SELECT concat('<', c, '>') FROM (
  SELECT cast('a' AS CHAR(2)) AS c
  UNION ALL
  SELECT cast('bb' AS CHAR(4)) AS c
) t;

SELECT typeof(c) FROM (
  SELECT cast('ab' AS CHAR(2)) AS c
  INTERSECT
  SELECT cast('ab' AS CHAR(4)) AS c
) t;

SELECT concat('<', c, '>') FROM (
  SELECT cast('ab' AS CHAR(2)) AS c
  EXCEPT
  SELECT cast('xy' AS CHAR(4)) AS c
) t;

-- Comparison and IN: both sides (including the IN left-hand side) are cast to the LCT of all
-- participants. Casting to CHAR pads, so CHAR vs CHAR of different lengths compares equal after
-- widening; casting to VARCHAR/STRING keeps the CHAR pad, so CHAR 'a' (stored as 'a ') is not equal
-- to VARCHAR/STRING 'a' unless the other side carries the same trailing blank. Trailing-blank
-- ignoring is a collation concern (RTRIM), not a type-level PAD SPACE policy.
SELECT cast('a' AS CHAR(2)) = cast('a' AS CHAR(4));

SELECT cast('a' AS CHAR(2)) = 'a';

SELECT cast('a' AS CHAR(2) COLLATE UTF8_BINARY_RTRIM) =
  cast('a' AS CHAR(4) COLLATE UTF8_BINARY_RTRIM);

SELECT cast('a' AS CHAR(2)) IN (cast('a ' AS VARCHAR(2)));

-- Three-part IN: LHS CHAR(2) and list CHAR(4)/VARCHAR(3) all widen to VARCHAR(4).
SELECT cast('a' AS CHAR(2)) IN (cast('a' AS CHAR(4)), cast('b' AS VARCHAR(3)));

-- CHAR/VARCHAR vs non-string follow STRING: compare promotes the string side to the other
-- atomic type; COALESCE uses the same STRING promotion (including vs BOOLEAN).
SELECT typeof(coalesce(cast('123' AS CHAR(3)), 1)),
       typeof(coalesce(cast('123' AS VARCHAR(3)), 1)),
       typeof(coalesce(cast('123' AS STRING), 1));

SELECT typeof(coalesce(cast('1.5' AS CHAR(3)), 1.5)),
       typeof(coalesce(cast('1.5' AS VARCHAR(3)), 1.5)),
       typeof(coalesce(cast('1.5' AS STRING), 1.5));

SELECT typeof(coalesce(cast('true' AS CHAR(4)), true));

-- Nested types keep CHAR/VARCHAR
SELECT typeof(array(cast('a' AS CHAR(2)), cast('bb' AS CHAR(3))));

-- R3: bare column references keep the declared type; write and read pad CHAR
CREATE TABLE char_varchar_std (c CHAR(5), v VARCHAR(5)) USING parquet;

SELECT concat('[', c, ']'), concat('[', v, ']') FROM char_varchar_std;

SELECT typeof(c), typeof(v) FROM char_varchar_std_ctas;

CREATE VIEW char_varchar_std_view_v AS SELECT v FROM char_varchar_std;

CREATE TABLE char_varchar_std_orc (c CHAR(5), v VARCHAR(5)) USING orc;

SELECT concat('[', c, ']'), concat('[', v, ']') FROM char_varchar_std_orc;

DROP TABLE char_varchar_std_ctas;

create table char_tbl(c char(5), v varchar(6)) using parquet;

show create table char_tbl;

desc formatted char_tbl2;

desc formatted char_tbl3;

create view char_view as select * from char_tbl;

show create table char_view;

alter table char_tbl1 change column c type char(6);

alter view char_view as select * from char_tbl2;

alter table char_tbl1 UNSET TBLPROPERTIES('yes');

create table char_part(c1 char(5), c2 char(2), v1 varchar(6), v2 varchar(2)) using parquet partitioned by (v2, c2);

alter table char_part change column v1 comment 'varchar comment';

alter table char_part partition (v2='ke', c2='nt') set location 'loc2';

create table char_tbl4(c7 char(7), c8 char(8), v varchar(6), s string) using parquet;

select c7, c8, v, s from char_tbl4 where c7 = c8;

select c7, c8, v, s from char_tbl4 where c7 = 'NetEase               ';

select c7, c8, v, s from char_tbl4 order by v;

select bit_length(c7), bit_length(c8), bit_length(v), bit_length(s) from char_tbl4;

select concat_ws('|', c7, c8), concat_ws('|', c7, v), concat_ws('|', c7, s), concat_ws('|', v, s) from char_tbl4;

select like(v, 'Spark_') from char_tbl4;

select c7 = 'NetEase', upper(c7) = upper('NetEase'), lower(c7) = lower('NetEase') from char_tbl4 where s = 'NetEase';

select replace(c7, 'Net', 'Apache'), replace(c8, 'Net', 'Apache'), replace(v, 'Spark', 'Kyuubi'), replace(s, 'Net', 'Apache') from char_tbl4;

select split(c7, 'e'), split(c8, 'e'), split(v, 'a'), split(s, 'e') from char_tbl4;

select right(c7, 2), right(c8, 2), right(v, 3), right(s, 2) from char_tbl4;

-- char_tbl has renamed to char_tbl1
drop table char_tbl1;

drop table char_tbl4;

-- to_varchar is an alias for to_char
SELECT to_varchar(78.12, '$99.99');

-- test cases for implicit aliases to collated expression trees are correctly generated

create table t1(s string, utf8_binary string collate utf8_binary, utf8_lcase string collate utf8_lcase) using parquet;

insert into t1 values ('aaAaAAaA', 'aaAaAAaA', 'aaAaaAaAaaAaaAaAaaAaaAaA');

insert into t1 values ('İo', 'İo', 'İo ');

insert into t1 values ('Hello, world! Nice day.', 'Hello, world! Nice day.', 'Hello, world! Nice day.');

insert into t1 values ('abc', 'abc', 'abc');

-- Select by implicit alias
select `concat_ws(' ' collate UTF8_LCASE, utf8_lcase, utf8_lcase)` from (
  select concat_ws(' ', utf8_lcase, utf8_lcase) from t1
);

-- Implicit alias in CTE output
with cte as (
  select concat_ws(' ', utf8_lcase, utf8_lcase) from t1
)
select * from cte;

-- Scalar subquery with CTE with implicit alias
select (
  with cte as (
    select concat_ws(' ', utf8_lcase, utf8_lcase) from t1
  )
  select * from cte limit 1
);

-- Implciit alias from aggregate in Sort
select lower(`concat_ws(' ' collate UTF8_LCASE, utf8_lcase, utf8_lcase)`) from (
  select concat_ws(' ', utf8_lcase, utf8_lcase) from t1
  group by 1
  order by max(concat_ws(' ', utf8_lcase, utf8_lcase))
);

select `concat_ws(' ' collate UTF8_LCASE, utf8_lcase, utf8_lcase)` from v1;

drop table if exists t1;

insert into t1 values('bbb', 'bbb');

-- group by and count utf8_lcase
select count(*) from t1 group by utf8_lcase;

-- filter less then utf8_binary
select * from t1 where utf8_binary < 'bbb';

-- create second table for anti-join
create table t2(utf8_binary string collate utf8_binary, utf8_lcase string collate utf8_lcase) using parquet;

-- anti-join on lcase
select * from t1 anti join t2 on t1.utf8_lcase = t2.utf8_lcase;

select col1 collate utf8_lcase from values ('aaa'), ('AAA'), ('bbb'), ('BBB'), ('zzz'), ('ZZZ') union select col1 collate utf8_lcase from values ('aaa'), ('bbb');

-- set operations with conflicting collations
select col1 collate utf8_lcase from values ('aaa'), ('AAA'), ('bbb'), ('BBB'), ('zzz'), ('ZZZ') except select col1 collate unicode_ci from values ('aaa'), ('bbb');

select col1 collate utf8_lcase from values ('aaa'), ('AAA'), ('bbb'), ('BBB'), ('zzz'), ('ZZZ') union all select col1 collate unicode_ci from values ('aaa'), ('bbb');

insert into t1 values (named_struct('utf8_binary', 'aaa', 'utf8_lcase', 'aaa'));

-- array function tests
select array_contains(ARRAY('aaa' collate utf8_lcase),'AAA' collate utf8_lcase);

select least('aaa' COLLATE utf8_lcase, 'AAA' collate utf8_lcase, 'a' collate utf8_lcase);

select array_union(array('aaa' collate utf8_lcase), array('AAA' collate utf8_lcase));

-- ICU collations (all statements return true)
select 'a' collate unicode < 'A';

select 'a' collate unicode_ci_ai = 'Å';

select 'a' collate en_ai = 'å';

select 'Kypper' collate de > 'Köpfe';

insert into t3 values('a:1,b:2,c:3', ',', ':');

select str_to_map(text collate utf8_binary, pairDelim collate utf8_binary, keyValueDelim collate utf8_binary) from t3;

create table t1(s string, utf8_binary string collate utf8_binary, utf8_lcase string collate utf8_lcase) using parquet;

insert into t2 values (66.421);

insert into t3 values ('efd2', 'efd2');

insert into t4 values (66);

select elt(1, utf8_binary collate utf8_binary, utf8_lcase collate utf8_lcase) from t1;

select elt(1, utf8_binary, 'word'), elt(1, utf8_lcase, 'word') from t1;

select ascii(utf8_binary collate utf8_lcase), ascii(utf8_lcase collate utf8_binary) from t1;

-- Base64, Decode
select base64(utf8_binary), base64(utf8_lcase) from t1;

select decode(encode(utf8_binary collate utf8_lcase, 'utf-8'), 'utf-8'), decode(encode(utf8_lcase collate utf8_binary, 'utf-8'), 'utf-8') from t1;

-- Encode, ToBinary
select encode(utf8_binary, 'utf-8'), encode(utf8_lcase, 'utf-8') from t1;

select to_binary(utf8_binary collate utf8_lcase, 'utf-8'), to_binary(utf8_lcase collate utf8_binary, 'utf-8') from t1;

-- Luhncheck
select luhn_check(num) from t4;

select levenshtein(utf8_binary collate utf8_binary, s collate utf8_lcase) from t1;

select levenshtein(utf8_binary, 'a'), levenshtein(utf8_lcase, 'a') from t1;

select is_valid_utf8(utf8_binary collate utf8_lcase), is_valid_utf8(utf8_lcase collate utf8_binary) from t1;

select make_valid_utf8(utf8_binary collate utf8_lcase), make_valid_utf8(utf8_lcase collate utf8_binary) from t1;

select validate_utf8(utf8_binary collate utf8_lcase), validate_utf8(utf8_lcase collate utf8_binary) from t1;

select try_validate_utf8(utf8_binary collate utf8_lcase), try_validate_utf8(utf8_lcase collate utf8_binary) from t1;

drop table t4;

select 'aaa' collate unicode;

select 'aaa' collate UtF8_lCaSE_rtRIM;

select collation('aaa' collate unicode);

select collation('aaa' collate utf8_lcase_rtrim);

-- ============================================================================
-- Collate function syntax
-- ============================================================================
select collate('aaa', 'utf8_binary');

select collate('aaa', 'utf8_lcase_rtrim');

select 'aaa' collate utf8_binary_rtrim = 'AAA' collate utf8_binary_rtrim;

select 'aaa' collate utf8_lcase = 'bbb' collate utf8_lcase;

select 'aaa' collate unicode = 'aaa' collate unicode;

select 'aaa' collate unicode_CI = 'aaa' collate unicode_CI;

select 'aaa ' collate unicode_CI_rtrim = 'AAA  ' collate unicode_CI_rtrim;

select collate('aaa', 'utf8_lcase') = collate('AAA', 'utf8_lcase');

select 'aaa' collate utf8_binary < 'aaa' collate utf8_binary;

select 'aaa' collate utf8_lcase < 'aaa' collate utf8_lcase;

select 'aaa' collate unicode < 'aaa' collate unicode;

select 'aaa' collate unicode_CI < 'aaa' collate unicode_CI;

-- comparisons with collate function syntax
select collate('AAA', 'utf8_binary') < collate('aaa', 'utf8_binary');

select count(*), c from (select collate(col1, 'utf8_binary') as c from values ('aaa'), ('aaa')) t group by c order by c;

select count(*), c from (select collate(col1, 'utf8_lcase') as c from values ('aaa'), ('aaa')) t group by c order by c;

select count(*), c from (select collate(col1, 'unicode') as c from values ('AAA'), ('aaa')) t group by c order by c;

select count(*), c from (select collate(col1, 'unicode_CI') as c from values ('aaa'), ('aaa')) t group by c order by c;

-- ============================================================================
-- Cast expressions for collations
-- ============================================================================
SELECT collation(cast('a' as string collate utf8_lcase));

SELECT cast('A' as string);

select array_join(array('a' collate utf8_lcase, 'b' collate utf8_lcase), ', ' collate utf8_lcase);

select concat(array('a' collate utf8_lcase, 'b' collate utf8_lcase));

-- ============================================================================
-- SR_AI vs SR_Latn_AI collation differences
-- ============================================================================
-- scalastyle:off nonascii
SELECT 'c' = 'ć' COLLATE SR_Latn_AI;

SELECT 'ć' = 'č' COLLATE SR_AI;

SELECT 's' = 'š' COLLATE SR_AI;

-- scalastyle:on nonascii

-- ============================================================================
-- Fully qualified collation names
-- ============================================================================
SELECT collation('a' collate system.builtin.UTF8_BINARY);

SELECT collation('a' collate system.builtin.UNICODE_CI_AI);

SELECT startswith('a' collate system.builtin.UNICODE_CI, 'A' collate UNICODE_CI);

SELECT typeof(array('a' COLLATE UNICODE, 'b')[1]);

-- ============================================================================
-- Error: collate function syntax invalid arg count
-- ============================================================================
select collate('aaa', 'a', 'b');

-- ============================================================================
-- Error: collate function invalid collation data type
-- ============================================================================
select collate('abc', 123);

-- ============================================================================
-- Error: collation mismatch for string functions
-- ============================================================================
SELECT contains(collate('abc', 'UNICODE_CI'), collate('b', 'UNICODE'));

-- ============================================================================
-- Error: explicit collation mismatch
-- ============================================================================
SELECT COLLATE('a', 'UTF8_BINARY') = COLLATE('a', 'UNICODE');

SELECT array_join(array('a', 'b' collate UNICODE), 'c' collate UNICODE_CI);

SELECT 'a' COLLATE builtin.UTF8_LCASE;

-- ============================================================================
-- Error: map creation with wrong number of args
-- ============================================================================
select map('a' COLLATE UTF8_LCASE, 'b', 'c');

select rpad(s, 8, utf8_binary) from t1;

select rpad(utf8_binary collate utf8_lcase, 8, utf8_lcase collate utf8_lcase) from t1;

select rpad(utf8_binary, 8, 'AaAA' collate utf8_lcase), rpad(utf8_lcase, 8, 'AAa' collate utf8_binary) from t1;

select lpad(utf8_binary collate utf8_binary, 8, s collate utf8_lcase) from t1;

select lpad(utf8_binary, 8, 'a'), lpad(utf8_lcase, 8, 'a') from t1;

select TRIM(s, utf8_binary) from t1;

select TRIM(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase) from t1;

select TRIM('ABc', utf8_binary), TRIM('ABc', utf8_lcase) from t1;

select BTRIM(s, utf8_binary) from t1;

select BTRIM(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase) from t1;

select BTRIM('ABc', utf8_binary), BTRIM('ABc', utf8_lcase) from t1;

select LTRIM(s, utf8_binary) from t1;

select LTRIM(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase) from t1;

select LTRIM('ABc', utf8_binary), LTRIM('ABc', utf8_lcase) from t1;

select RTRIM(s, utf8_binary) from t1;

select RTRIM(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase) from t1;

select RTRIM('ABc', utf8_binary), RTRIM('ABc', utf8_lcase) from t1;

select trim(' ' collate unicode_ci, s), length(trim(' ' collate unicode_ci, s)),
       octet_length(trim(' ' collate unicode_ci, s))
  from (select concat(chr(160), 'abc', chr(160)) collate unicode_ci as s);

select trim(s), length(trim(s)), octet_length(trim(s))
  from (select concat(chr(160), 'abc', chr(160)) collate unicode as s);

-- test cases for string functions with collations

create table t1(s string, utf8_binary string collate utf8_binary, utf8_lcase string collate utf8_lcase) using parquet;

insert into t2 values (66);

-- ConcatWs
select concat_ws(' ', utf8_lcase, utf8_lcase) from t1;

select concat_ws(' ' collate utf8_lcase, utf8_binary, 'SQL' collate utf8_lcase) from t1;

-- SplitPart
select split_part(utf8_binary, utf8_lcase, 3) from t1;

select split_part(utf8_binary, utf8_lcase collate utf8_binary, 2) from t1;

select split_part(utf8_binary, 'a', 3), split_part(utf8_lcase, 'a', 3) from t1;

-- Contains
select contains(utf8_binary, utf8_lcase) from t1;

select contains(utf8_binary, utf8_lcase collate utf8_binary) from t1;

select contains(utf8_binary, 'a'), contains(utf8_lcase, 'a') from t1;

-- SubstringIndex
select substring_index(utf8_binary, utf8_lcase, 2) from t1;

select substring_index(utf8_binary, utf8_lcase collate utf8_binary, 2) from t1;

select substring_index(utf8_binary, 'a', 2), substring_index(utf8_lcase, 'a', 2) from t1;

-- StringInStr
select instr(utf8_binary, utf8_lcase) from t1;

select instr(utf8_binary, utf8_lcase collate utf8_binary) from t1;

select instr(utf8_binary, 'a'), instr(utf8_lcase, 'a') from t1;

select instr(utf8_lcase, 'a', 1) from t1;

select instr(utf8_binary, utf8_lcase collate utf8_binary, -1, 2) from t1;

-- FindInSet
select find_in_set(utf8_binary, utf8_lcase) from t1;

select find_in_set(utf8_binary, utf8_lcase collate utf8_binary) from t1;

select find_in_set(utf8_binary, 'aaAaaAaA,i̇o' collate utf8_lcase), find_in_set(utf8_lcase, 'aaAaaAaA,i̇o' collate utf8_binary) from t1;

select startswith(s, utf8_binary) from t1;

select startswith(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase) from t1;

select startswith(utf8_binary, 'aaAaaAaA' collate utf8_lcase), startswith(utf8_lcase, 'aaAaaAaA' collate utf8_binary) from t1;

select translate(utf8_binary, utf8_lcase, '12345') from t1;

select translate(utf8_binary, 'SQL' collate unicode_ai, '12345' collate unicode_ai) from t1;

select translate(utf8_lcase, 'aBc ' collate utf8_binary_rtrim, '12345'), translate(utf8_binary, 'aBc' collate utf8_lcase, '12345') from t1;

select replace(utf8_binary collate utf8_binary, s collate utf8_lcase, 'abc') from t1;

select replace(utf8_binary collate unicode_ai, utf8_lcase collate unicode_ai, 'abc') from t1;

select replace(utf8_binary, 'aaAaaAaA ' collate utf8_lcase_rtrim, 'abc'), replace(utf8_lcase, 'aaAaaAaA' collate utf8_binary, 'abc') from t1;

select endswith(utf8_binary collate utf8_binary, s collate utf8_lcase) from t1;

select endswith(utf8_binary collate unicode_ai, utf8_lcase collate unicode_ai) from t1;

select endswith(utf8_binary, 'aaAaaAaA ' collate utf8_lcase_rtrim), endswith(utf8_lcase, 'aaAaaAaA' collate utf8_binary) from t1;

-- Chr
select chr(ascii) from t2;

-- Upper
select upper(utf8_binary), upper(utf8_lcase) from t1;

select lower(utf8_binary collate utf8_lcase), lower(utf8_lcase collate utf8_binary) from t1;

-- Overlay
select overlay(utf8_binary, utf8_lcase, 2) from t1;

select overlay(utf8_binary, utf8_lcase collate utf8_binary, 2) from t1;

select overlay(utf8_binary, 'AaAA' collate utf8_lcase, 2), overlay(utf8_lcase, 'AAa' collate utf8_binary, 2) from t1;

select format_string(format, utf8_binary, utf8_lcase) from t3;

select bit_length(utf8_binary), bit_length(utf8_lcase) from t1;

select octet_length(utf8_binary collate utf8_lcase), octet_length(utf8_lcase collate utf8_binary) from t1;

select substr(utf8_binary collate utf8_lcase, 2, 2), substr(utf8_lcase collate utf8_binary, 2, 2) from t1;

select left(utf8_binary, '2' collate utf8_lcase), left(utf8_lcase, 2) from t1;

select locate(s, utf8_binary) from t1;

select locate(utf8_binary collate utf8_lcase, utf8_lcase collate utf8_lcase, 3) from t1;

select locate(utf8_binary, 'AaAA' collate utf8_lcase, 4), locate(utf8_lcase, 'AAa' collate utf8_binary, 4) from t1;

CREATE TEMPORARY VIEW v2 AS VALUES (1, 1, 1), (2, 2, 1) AS t(x, y, all);

-- Relation output columns have higher priority than GROUP BY alias. This query should
-- fail as `a` is not in GROUP BY.
SELECT a AS k FROM v1 GROUP BY k;

-- GROUP BY alias/ALL does not support lateral column alias.
SELECT k AS lca, lca + 1 AS col FROM v1 GROUP BY k, col;

-- GROUP BY ALL has higher priority than outer reference. This query should run as `a` and `b` are
-- in GROUP BY due to the GROUP BY ALL resolution.
SELECT * FROM v2 WHERE EXISTS (SELECT a, b FROM v1 GROUP BY all);

-- Relation output columns have higher priority than missing reference.
-- Query will fail if we order by the column `v1.b`, as it's not in GROUP BY.
-- Actually results are [1, 2] as we order by `max(a) AS b`.
SELECT max(a) AS b FROM v1 GROUP BY k ORDER BY b;

-- Negative testcases for column resolution
CREATE DATABASE mydb1;

CREATE DATABASE mydb2;

-- Negative tests: column resolution scenarios with ambiguous cases in join queries
SET spark.sql.crossJoin.enabled = true;

SELECT mydb1.t1.i1 FROM t1, mydb1.t1;

SELECT db1.t1.i1 FROM t1, mydb2.t1;

SELECT mydb1.t1 FROM t1;

SELECT mydb1.t1.i1 FROM t1;

CREATE TABLE t1 USING parquet AS SELECT 1 AS i2;

SELECT * FROM v2;

-- Tests for qualified column names for the view code-path
-- Test scenario with Temporary view
CREATE OR REPLACE TEMPORARY VIEW view1 AS SELECT 2 AS i1;

SELECT view1.i1 FROM view1;

SELECT i1 FROM view1 AS a;

SELECT * FROM global_temp.view1;

SELECT global_temp.view1.i1 FROM global_temp.view1;

SELECT i1 FROM global_temp.view1 AS a;

SELECT i1 FROM t1;

SELECT t1.i1 FROM mydb1.t1;

SELECT t1.* FROM t1;

SELECT a.* FROM mydb1.t1 AS a;

CREATE TABLE t4 USING parquet AS SELECT * FROM VALUES (4,1), (2,1) AS t4(c2, c3);

-- Scenario: column resolution scenarios in join queries
SET spark.sql.crossJoin.enabled = true;

-- Scenario: Table with struct column
USE mydb1;

SELECT t5.i1 FROM t5;

SELECT t5.i1 FROM mydb1.t5;

SELECT mydb1.t5.t5.i1 FROM mydb1.t5;

SELECT mydb1.t5.* FROM t5;

/* This is the first example of bracketed comment.
SELECT 'ommented out content' AS first;
*/
SELECT 'selected content' AS first;

/**/
SELECT 'selected content' AS fourth;

/*
 * This is the third example of nested bracketed comment.
  /*
   * I am a nested bracketed comment.
   */
 */
SELECT 'selected content' AS seventh;

/*/**/*/
SELECT 'selected content' AS tenth;

/* SELECT /*+ HINT() 4; */ SELECT 1;

-- binary type
select x'00' < x'0f';

select '\t1 ' = 1Y;

select ' 1' = 1L;

select ' 1.0 ' = 1.0BD;

SELECT nanvl(c2, 1/0) FROM conditional_t;

SELECT if(1 == 1, 1, 1/0);

SELECT coalesce(1, 1/0);

SELECT case when 1 < 2 then 1 else 1/0 end;

SELECT nullifzero('abc');

DROP TABLE conditional_t;

-- distinct count with single expression
SELECT
  count(DISTINCT 1),
  count(DISTINCT null),
  count(DISTINCT a),
  count(DISTINCT b),
  count(DISTINCT (a + b)),
  count(DISTINCT (a, b))
FROM testData;

-- distinct count with multiple literals
SELECT count(DISTINCT 3,2);

SELECT count(DISTINCT a), count(DISTINCT 2,3) FROM testData;

SELECT count(DISTINCT a), count(DISTINCT 2), count(DISTINCT 3,2) FROM testData;

SELECT count() FROM testData;

SELECT count(testData.*) FROM testData;

SELECT count(DISTINCT t.*) FROM testData t;

SELECT count(testData.*) OVER () FROM testData;

set spark.sql.legacy.allowStarWithSingleTableIdentifierInCount=false;

-- Single-row input: the only row has no predecessor and returns NULL.
SELECT t, counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, 50) AS tab(t, c)
ORDER BY t;

-- NULL counter rows have NULL as the result and are skipped when calculating differences.
SELECT t, c, counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, 100), (2, CAST(NULL AS INT)), (3, 200) AS tab(t, c)
ORDER BY t;

------------------------------------------------------------
-- High-precision DECIMAL inputs
------------------------------------------------------------
-- Decimal subtraction normally widens the result type to handle possible overflow.
-- For counter_diff, since counters cannot be negative, there is no risk of overflow, and no
-- need to widen the result type, so we subtract directly in the input type.
-- These tests verify that the result type is not widened, and that no precision is lost for
-- large precision and scale.

-- DECIMAL(38, 38): normal subtraction would be of type DECIMAL(38, 37).
SELECT t, counter_diff(c) OVER (ORDER BY t) AS diff, c - lag(c) OVER (ORDER BY t) AS diff_subtract
FROM VALUES
  (1, CAST(0.10000000000000000000000000000000000001 AS DECIMAL(38, 38))),
  (2, CAST(0.10000000000000000000000000000000000002 AS DECIMAL(38, 38)))
AS tab(t, c) ORDER BY t;

------------------------------------------------------------
-- NULL type inputs
------------------------------------------------------------

-- Untyped NULL counters are treated as DOUBLE.
SELECT t, counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, NULL), (2, NULL), (3, NULL) AS tab(t, c)
ORDER BY t;

------------------------------------------------------------
-- Negative counter values are runtime errors
------------------------------------------------------------

-- INT.
SELECT counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, -5) AS tab(t, c);

-- -Infinity is treated as a negative value.
SELECT counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, DOUBLE('-Infinity')) AS tab(t, c);

-- NaN values are greater than all other numeric values, so:
-- any value -> NaN => NaN
-- NaN -> any non-NaN value => Reset
SELECT t, counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES
  (1, 100.0D), (2, DOUBLE('NaN')), (3, DOUBLE('NaN')), (4, 200.0D),
  (5, 400.0D), (6, DOUBLE('NaN')), (7, 50.0D), (8, 100.0D) AS tab(t, c)
ORDER BY t;

-- Constant start_time alongside constant counter.
SELECT t, counter_diff(1, TIMESTAMP '2026-01-01 00:00:00')
  OVER (ORDER BY t) AS diff
FROM RANGE(1, 5) AS tab(t)
ORDER BY t;

-- Mix counter_diff with avg, lead, max over different frames.
SELECT t, c,
       counter_diff(c) OVER (ORDER BY t) AS diff,
       avg(c) OVER (ORDER BY t ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS local_avg,
       lead(c) OVER (ORDER BY t) AS nc,
       max(c) OVER (ORDER BY t ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING) AS some_max
FROM VALUES (1, 100), (2, 200), (3, 150), (4, 400), (5, 500), (6, 600) AS tab(t, c)
ORDER BY t;

-- Equal start_time across rows: behavior matches the case with no start time.
SELECT t, c,
  counter_diff(c, st) OVER (ORDER BY t) AS diff
FROM VALUES
  (1, TIMESTAMP '2026-01-01 00:00:00', 100),
  (2, TIMESTAMP '2026-01-01 00:00:00', 200)
AS tab(t, st, c)
ORDER BY t;

-- Negative counter still raises in the start_time form.
SELECT counter_diff(c, st) OVER (ORDER BY t) AS diff
FROM VALUES
  (1, TIMESTAMP '2026-01-01 00:00:00', -1)
AS tab(t, st, c);

-- A NULL-counter row is skipped before the start_time check, so a same-row
-- start_time decrease is absorbed when the counter is NULL.
SELECT t, counter_diff(c, st) OVER (ORDER BY t) AS diff
FROM VALUES
  (1, TIMESTAMP '2026-01-01 00:05:00', 100),
  (2, TIMESTAMP '2026-01-01 00:01:00', CAST(NULL AS INT))
AS tab(t, st, c)
ORDER BY t;

------------------------------------------------------------
-- End-to-end: bucket per-row diffs by hour using a CTE
------------------------------------------------------------

-- 8 measurements every 30 min; start_time changes at id=4 -> single reset.
-- The hourly SUM of diffs yields the per-hour total counter increase.
WITH gen AS (
  SELECT
    TIMESTAMPADD(MINUTE, id * 30, TIMESTAMP '2026-01-01 00:00:00') AS ts,
    CASE WHEN id < 4 THEN TIMESTAMP '2026-01-01 00:00:00'
         ELSE TIMESTAMP '2026-01-01 02:00:00' END AS st,
    CASE WHEN id < 4 THEN id * 1000 ELSE (id - 4) * 800 END AS c
  FROM RANGE(8) AS r(id)
),
diffs AS (
  SELECT ts, c, counter_diff(c, st) OVER (ORDER BY ts) AS diff
  FROM gen
)
SELECT date_trunc('hour', ts) AS hour_bucket,
       SUM(diff) AS total_diff
FROM diffs GROUP BY 1 ORDER BY 1;

-- Counter argument must be NUMERIC: STRING is rejected.
SELECT counter_diff(c) OVER (ORDER BY t) AS diff
FROM VALUES (1, 'abc') AS tab(t, c);

-- Explicitly specifying the required frame is allowed.
SELECT t, counter_diff(c) OVER (
  ORDER BY t ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS diff
FROM VALUES (1, 100), (2, 200) AS tab(t, c)
ORDER BY t;

-- More than 2 arguments: not accepted.
SELECT counter_diff(1, TIMESTAMP '2026-01-01', 99) OVER (ORDER BY t) AS diff
FROM VALUES (1) AS tab(t);

-- CREATE TABLE behavior in the session catalog and a V2 catalog.
CREATE NAMESPACE testcat.ns;

-- Omitting USING selects the configured default provider.
CREATE TABLE ct_default_provider (c INT);

CREATE TABLE IF NOT EXISTS testcat.ns.ct_v2 (c INT) USING parquet;

-- Creating an existing table without IF NOT EXISTS fails in both catalogs.
CREATE TABLE ct_v1 (c INT) USING parquet;

CREATE TABLE ct_dup (a INT, A STRING) USING parquet;

-- With spark.sql.fileSource.insert.enforceNotNull=false (the default), V1 file-source tables
-- store a nullable schema, so SHOW CREATE TABLE renders c INT NOT NULL as c INT.
CREATE TABLE ct_not_null (c INT NOT NULL, s STRING) USING parquet;

CREATE TABLE testcat.ns.ct_interval (i INTERVAL DAY) USING parquet;

-- Qualified names: a valid schema and a missing schema.
CREATE TABLE default.ct_qualified (c INT) USING parquet;

DESCRIBE ct_exec;

-- A table without an explicit collation inherits its schema's default collation.
CREATE SCHEMA ct_coll_schema DEFAULT COLLATION UTF8_LCASE;

-- Session-catalog REPLACE with a non-V2 provider such as parquet is unsupported, even
-- when the table is missing. In a V2 catalog, REPLACE requires an existing table.
REPLACE TABLE ct_repl_missing (c INT) USING parquet;

REPLACE TABLE ct_v1 (c INT) USING parquet;

DESCRIBE testcat.ns.ct_cor_missing;

CREATE OR REPLACE TABLE ct_cor_parquet (c INT, d INT) USING parquet;

DROP TABLE ct_default_provider;

DROP TABLE ct_interval;

DROP TABLE ct_exec;

DROP SCHEMA ct_coll_schema CASCADE;

DROP VIEW IF EXISTS cv_plain;

DROP VIEW IF EXISTS cv_agg;

DROP VIEW IF EXISTS cv_scalar;

DROP VIEW IF EXISTS cv_rec;

DROP VIEW IF EXISTS cv_uses_temp_view;

DROP VIEW IF EXISTS cv_ident_var;

DROP VIEW IF EXISTS cv_var_target;

DROP VIEW IF EXISTS cv_cte;

DROP VIEW IF EXISTS cv_meta;

DROP VIEW IF EXISTS cv_using;

DROP VIEW IF EXISTS cv_coll_values;

DROP VIEW IF EXISTS cv_coll_inner;

DROP VIEW IF EXISTS cv_fn_lambda;

DROP VIEW IF EXISTS cv_tgt_sfx;

DROP VIEW IF EXISTS cv_rel_cte;

DROP VIEW IF EXISTS cv_fn_const;

DROP VIEW IF EXISTS cv_col_var;

DROP TABLE IF EXISTS cv_t2;

DROP TABLE IF EXISTS cv_file;

INSERT INTO cv_t1 VALUES (1, 'a', 1), (2, 'b', 1), (3, 'c', 2);

SELECT * FROM cv_plain ORDER BY id;

-- OR REPLACE changes the schema of the view; the new schema is what SELECT returns.
CREATE OR REPLACE VIEW cv_plain AS SELECT id, name, grp FROM cv_t1;

CREATE VIEW cv_agg AS SELECT grp, count(*) AS cnt, sum(id) AS total FROM cv_t1 GROUP BY grp;

SELECT * FROM cv_window ORDER BY id;

CREATE VIEW cv_scalar AS SELECT id, (SELECT max(score) FROM cv_t2) AS max_score FROM cv_t1;

SELECT * FROM cv_exists ORDER BY id;

CREATE TABLE cv_k2 (k INT, b INT);

CREATE VIEW cv_using AS SELECT * FROM cv_k1 JOIN cv_k2 USING (k);

CREATE VIEW cv_natural AS SELECT * FROM cv_k1 NATURAL JOIN cv_k2;

CREATE TABLE cv_file (id INT, v STRING) USING parquet;

SELECT * FROM cv_file_meta;

SELECT * FROM cv_cols ORDER BY x;

CREATE VIEW cv_cols_dup (a, a) AS SELECT id, name FROM cv_t1;

CREATE VIEW cv_t1 AS SELECT 1 AS other;

SELECT COUNT(*) FROM cv_t1;

CREATE OR REPLACE VIEW cv_rec AS SELECT n + 1 AS n FROM cv_rec;

CREATE OR REPLACE VIEW cv_a AS SELECT x FROM cv_b;

DROP VIEW cv_tmp_view;

DROP TEMPORARY FUNCTION cv_tmp_fn;

DECLARE VARIABLE cv_src STRING DEFAULT 'cv_t1';

CREATE TEMPORARY FUNCTION cv_tf2(x INT) RETURNS INT RETURN x + 1;

CREATE VIEW cv_fn_lambda AS SELECT transform(array(1), x -> x + cv_tf1()) AS t;

DROP TEMPORARY FUNCTION cv_tf2;

-- Targets: IDENTIFIER('lit'), IDENTIFIER(variable), default.-qualified name.
CREATE VIEW IDENTIFIER('cv_ident_target') AS SELECT 1 AS a;

CREATE VIEW IDENTIFIER(cv_target) AS SELECT 2 AS a;

SELECT * FROM default.cv_qualified;

DECLARE VARIABLE cv_tgt_sfx STRING DEFAULT 'sfx';

CREATE VIEW cv_rel_sub AS SELECT x.id FROM (SELECT id FROM IDENTIFIER('cv_t' || '1')) AS x;

SELECT * FROM cv_rel_cte ORDER BY id;

CREATE VIEW cv_col_const AS SELECT IDENTIFIER('i' || 'd') AS c FROM cv_t1;

SELECT * FROM cv_fn_const;

-- The legacy configuration allows variable identifiers in the body. Variable targets remain
-- valid, while reading the persisted body still requires a constant identifier expression.
SET spark.sql.legacy.allowSessionVariableInPersistedView=true;

CREATE VIEW IDENTIFIER('cv_tgt_' || cv_tgt_sfx || '_legacy') AS SELECT 3 AS a;

CREATE VIEW cv_col_var AS SELECT IDENTIFIER(cv_col_name) FROM cv_t1;

CREATE VIEW cv_ident_var_sub AS SELECT (SELECT max(id) FROM IDENTIFIER(cv_src)) AS m;

CREATE VIEW cv_ident_var_concat AS SELECT id FROM IDENTIFIER('cv_t' || cv_idx_str);

DROP TEMPORARY VARIABLE cv_fn_name;

CREATE VIEW cv_shadow AS SELECT 'persistent' AS src;

-- CTE in the view body: single CTE, CTE referenced twice, nested WITH.
CREATE VIEW cv_cte AS WITH c AS (SELECT id FROM cv_t1) SELECT id FROM c;

SELECT * FROM cv_cte_twice ORDER BY id;

-- Metadata: column list with comments, view comment, table properties, default collation,
-- and schema binding in one statement.
CREATE VIEW cv_meta (id COMMENT 'row id', label COMMENT 'label text')
  COMMENT 'metadata baseline'
  TBLPROPERTIES ('owner_team' = 'sql', 'purpose' = 'baseline')
  DEFAULT COLLATION UTF8_LCASE
  WITH SCHEMA BINDING
  AS SELECT id, name AS label FROM cv_t1;

SELECT * FROM cv_meta ORDER BY id;

-- DEFAULT COLLATION UTF8_LCASE is retained on VALUES and CAST output columns.
CREATE VIEW cv_coll_values DEFAULT COLLATION UTF8_LCASE AS
  SELECT s FROM VALUES ('ABC'), ('def') AS t(s);

SELECT COUNT(*) FROM cv_coll_cast WHERE cs = 'abc';

SELECT COUNT(*) FROM cv_coll_outer WHERE s = 'abc';

CREATE VIEW cv_coll_schema.cv_inherit AS SELECT 'ABC' AS s;

SELECT COLLATION(s) FROM cv_coll_schema.cv_inherit;

DESCRIBE EXTENDED cv_coll_schema.cv_inherit;

CREATE VIEW cv_coll_schema.cv_inherit_after_alter AS SELECT 'ABC' AS s;

DESCRIBE EXTENDED cv_coll_schema.cv_inherit_after_alter;

CREATE VIEW cv_auto_union AS SELECT count(*) FROM cv_t1 UNION ALL SELECT 1;

SELECT * FROM cv_auto_corr_aliased ORDER BY id;

SELECT * FROM cv_auto_union ORDER BY 1;

-- EXECUTE IMMEDIATE and plain EXPLAIN. EXPLAIN does not create the view.
EXECUTE IMMEDIATE 'CREATE VIEW cv_exec AS SELECT 1 AS a';

SELECT * FROM cv_explain;

DROP VIEW IF EXISTS cv_auto_union;

DROP TEMPORARY VARIABLE cv_var;

DROP SCHEMA cv_coll_schema CASCADE;

-- Cross joins with and without predicates
SELECT * FROM nt1 cross join nt2;

SELECT * FROM nt1 cross join nt2 where nt1.v1 = 1 and nt2.v2 = 22;

create temporary view B(b, vb) as select * from nt1;

-- Allowed since cross join with C is explicit
select * from ((A join B on (a = b)) cross join C) join D on (a = d);

select from_csv('26/08/2015', 'time Timestamp', map('timestampFormat', 'dd/MM/yyyy'));

select from_csv('1', 'Array<int>');

select from_csv();

select schema_of_csv(null);

SELECT schema_of_csv(csvField) FROM csvTable;

select to_csv(named_struct('time', to_timestamp('2015-08-26', 'yyyy-MM-dd')), map('timestampFormat', 'dd/MM/yyyy'));

-- TIME type tests
select from_csv('14:30:45', 'time TIME(0)');

select from_csv('14-30-45.123456', 'time TIME(6)', map('timeFormat', 'HH-mm-ss.SSSSSS'));

select to_csv(named_struct('time', TIME'14:30:45.123456'), map('timeFormat', 'HH-mm-ss.SSSSSS'));

select from_csv(to_csv(named_struct('time', TIME'14:30:45.12')), 'time TIME(2)');

select from_csv(to_csv(named_struct('time', TIME'14:30:45.12345')), 'time TIME(5)');

select from_csv('invalid', 'time TIME');

-- Schema inference: TIME type is never auto-inferred (requires explicit schema).
-- Time-like strings are inferred as TIMESTAMP by CSV's existing inference logic.
select schema_of_csv('14:30:45');

SELECT * FROM cte_tbl;

-- INSERT inside WITH
WITH s AS (SELECT 43 AS col)
INSERT INTO cte_tbl SELECT * FROM S;

-- Multi-INSERT
WITH s AS (SELECT 45 AS col)
FROM s
INSERT INTO cte_tbl SELECT col
INSERT INTO cte_tbl2 SELECT col;

-- NOT MATERIALIZED CTE in a Multi-INSERT
WITH s AS NOT MATERIALIZED (SELECT 46 AS col)
FROM s
INSERT INTO cte_tbl SELECT col
INSERT INTO cte_tbl2 SELECT col;

DROP TABLE cte_tbl2;

-- CTE in subquery expression
SELECT (
  WITH t AS (SELECT 1)
  SELECT * FROM t
);

-- un-referenced CTE in subquery expression: references a correlated CTE on the right side of a
-- left join
SELECT (
  WITH correlated AS (SELECT * FROM VALUES (0), (1) AS r(id) WHERE r.id = o.id),
  unreferenced AS (SELECT * FROM VALUES (0), (1) AS l(id) LEFT JOIN correlated ON l.id = correlated.id)
  SELECT 1
) FROM VALUES (0) AS o(id);

-- un-referenced CTE in EXISTS subquery: references a correlated CTE in a full outer join, which
-- the CTE main query also references
SELECT * FROM VALUES (0) AS o(id) WHERE EXISTS (
  WITH correlated AS (SELECT * FROM VALUES (0), (1) AS r(id) WHERE r.id = o.id),
  unreferenced AS (SELECT * FROM VALUES (0), (1) AS l(id) FULL OUTER JOIN correlated ON l.id = correlated.id)
  SELECT * FROM correlated
);

-- un-referenced CTE of the main query, read only by another un-referenced CTE: holds a scalar
-- subquery whose own correlated CTE is on the right side of a left join
WITH unreferenced AS (
  SELECT (
    WITH correlated AS (SELECT * FROM VALUES (0), (1) AS r(id) WHERE r.id = o.id)
    SELECT count(*) FROM VALUES (0), (1) AS l(id) LEFT JOIN correlated ON l.id = correlated.id
  ) FROM VALUES (0) AS o(id)
),
other_unreferenced AS (SELECT * FROM unreferenced)
SELECT 1;

SELECT * FROM unreferenced_cte_view;

-- Make sure CTE in subquery is scoped to that subquery rather than global
-- the 2nd half of the union should fail because the cte is scoped to the first half
SELECT * FROM
  (
   WITH cte AS (SELECT * FROM range(10))
   SELECT * FROM cte WHERE id = 8
  ) a
UNION
SELECT * FROM cte;

-- CTE in CTE definition shadows outer 3
WITH
  t AS (SELECT 1),
  t2 AS (
    WITH t AS (SELECT 2),
    t2 AS (
      WITH t AS (SELECT 3)
      SELECT * FROM t
    )
    SELECT * FROM t2
  )
SELECT * FROM t2;

-- CTE in subquery shadows outer 3
WITH t(c) AS (SELECT 1)
SELECT sum(c) FROM (
  WITH t(c) AS (SELECT 2)
  SELECT max(c) AS c FROM (
    WITH t(c) AS (SELECT 3)
    SELECT * FROM t
  )
);

-- CTE in subquery expression shadows outer 3
WITH t AS (SELECT 1)
SELECT (
  WITH t AS (SELECT 2)
  SELECT (
    WITH t AS (SELECT 3)
    SELECT * FROM t
  )
);

-- case insensitive name conflicts: in other CTE relations
WITH
  abc AS (SELECT 1),
  t AS (
    WITH aBc AS (SELECT 2)
    SELECT * FROM aBC
  )
SELECT * FROM t;

-- CTE nested in CTE main body FROM clause references outer CTE def
WITH cte_outer AS (
  SELECT 1
)
SELECT * FROM (
  WITH cte_inner AS (
    SELECT * FROM cte_outer
  )
  SELECT * FROM cte_inner
);

-- Invalid reference to invisible CTE def nested CTE def (in FROM)
WITH cte_outer AS (
  SELECT * FROM (
    WITH cte_invisible_inner AS (
      SELECT 1
    )
    SELECT * FROM cte_invisible_inner
  )
)
SELECT * FROM (
  WITH cte_inner AS (
    SELECT * FROM cte_invisible_inner
  )
  SELECT * FROM cte_inner
);

-- basic recursion with subquery column alias
WITH RECURSIVE r(level) AS (
  VALUES 0
  UNION ALL
  SELECT level + 1 FROM r WHERE level < 9
)
SELECT * FROM r;

-- unlimited recursion fails at spark.sql.cteRecursionRowLimit level
CREATE TEMPORARY VIEW ZeroAndOne(current, next) AS VALUES
    (0,0),
    (0,1),
    (1,0),
    (1,1);

-- limited recursion doesn't fail at spark.sql.cteRecursionLevelLimit by setting MAX RECURSION LEVEL
WITH RECURSIVE r(level) MAX RECURSION LEVEL 35 AS (
  VALUES 0
  UNION ALL
  SELECT level + 1 FROM r WHERE level < 30
  )
SELECT * FROM r;

-- unlimited recursion stopped from failing by putting LIMIT
CREATE TEMPORARY VIEW ZeroAndOne(current, next) AS VALUES
    (0,0),
    (0,1),
    (1,0),
    (1,1);

WITH RECURSIVE t MAX RECURSION LEVEL 100 AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM t WHERE n < 60
    )
SELECT * FROM t LIMIT ALL;

-- terminate recursion with LIMIT
WITH RECURSIVE r(level) AS (
  VALUES 0
  UNION ALL
  SELECT level + 1 FROM r
)
SELECT * FROM r LIMIT 10;

-- unlimited recursion fails because using LIMIT to terminate recursion only works where it can be
-- pushed down to recursion
WITH RECURSIVE r(level) AS (
  VALUES 0
  UNION ALL
  SELECT level + 1 FROM r
)
SELECT level, level FROM r ORDER BY 1 LIMIT 10;

--recursive keyword but no self-reference
--other sql engines don't throw an error in this case, so Spark doesn't throw it as well
WITH RECURSIVE t(n) AS (
    SELECT 1
    UNION ALL
    SELECT 2
)
SELECT * FROM t;

-- complicated subquery example: self-reference in subquery in an inner CTE
WITH
  t1 AS (SELECT 1 as n),
  t2(n) AS (
    WITH RECURSIVE t3(n) AS (
      SELECT 1
      UNION ALL
      SELECT n+1 FROM (SELECT MAX(n) FROM t3)
    )
    SELECT * FROM t3
  )
SELECT * FROM t2;

-- recursive reference and conflicting outer CTEs in a nested CTE
SET spark.sql.legacy.ctePrecedencePolicy=CORRECTED;

-- recursive reference is allowed on left side of a left outer join
WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, r.data
  FROM r
  LEFT OUTER JOIN (
    SELECT 0 AS data
  ) AS t ON t.data = r.data
  WHERE r.level < 9
)
SELECT * FROM r;

-- recursive reference is not allowed on left side of a right outer join
WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, r.data
  FROM r
  RIGHT OUTER JOIN (
    SELECT 0 AS data
  ) AS t ON t.data = r.data
  WHERE r.level < 9
)
SELECT * FROM r;

-- recursive reference is not allowed on right side of a left semi join
WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, data
  FROM (
    SELECT 0 AS level, 0 AS data
  ) AS t
  LEFT SEMI JOIN r ON r.data = t.data AND r.level < 9
)
SELECT * FROM r;

-- recursive reference is not allowed in an aggregate
WITH RECURSIVE r(level, data) AS (
  VALUES (0, 1L)
  UNION ALL
  SELECT MAX(level) + 1, SUM(data) FROM r WHERE level < 9
)
SELECT * FROM r;

SELECT * FROM rv;

WITH RECURSIVE r(level) AS (
  VALUES (0)
  UNION ALL
  SELECT level + 1 FROM r WHERE level < 9
)
INSERT INTO rt SELECT * FROM r;

-- recursion is not allowed in multi commands
CREATE TABLE rt2(level INT) USING csv;

DROP TABLE rt2;

-- recursive cte nested into recursive cte as anchor
WITH RECURSIVE r2 AS (
  WITH RECURSIVE r1 AS (
    SELECT 0 AS innerlevel
    UNION ALL
    SELECT innerlevel + 1 FROM r1 WHERE innerlevel < 3
  )
  SELECT 0 AS outerlevel, innerlevel FROM r1
  UNION ALL
  SELECT outerlevel + 1, innerlevel FROM r2 WHERE outerlevel < 3
)
SELECT * FROM r2;

-- routes represented here is as follows:
--
-- New York<--->Boston
-- |            ∧
-- ∨            |
-- Washington---+
-- |
-- ∨
-- Raleigh
CREATE TEMPORARY VIEW routes(origin, destination) AS VALUES
  ('New York', 'Washington'),
  ('New York', 'Boston'),
  ('Boston', 'New York'),
  ('Washington', 'Boston'),
  ('Washington', 'Raleigh');

-- Fibonacci numbers
WITH RECURSIVE fibonacci AS (
  VALUES (0, 1) AS t(a, b)
  UNION ALL
  SELECT b, a + b FROM fibonacci WHERE a < 10
)
SELECT a FROM fibonacci ORDER BY a;

INSERT INTO tb VALUES (0), (1);

-- CROSS JOIN example 2

WITH RECURSIVE
    x(id) AS (SELECT 1 UNION SELECT 2),
    t(id, xid) AS (
        SELECT 0 AS id, 0 AS xid
        UNION ALL
        SELECT t.id + 1, xid * 10 + x.id FROM t CROSS JOIN x WHERE t.id < 3
    )
SELECT * FROM t;

-- Column aliases with CTEs inside rCTEs
WITH RECURSIVE r2(outerlevel1, innerlevel1) AS (
    WITH RECURSIVE r1 AS (
        SELECT 0 AS innerlevel
        UNION ALL
        SELECT innerlevel + 1 FROM r1 WHERE innerlevel < 3
    )
    SELECT 0 AS outerlevel, innerlevel FROM r1
    UNION ALL
    SELECT outerlevel1 + 1, innerlevel1 FROM r2 WHERE outerlevel1 < 3
)
SELECT * FROM r2;

-- Recursive CTE with multiple of the same reference in the anchor, which get referenced differently subsequent iterations.
WITH RECURSIVE tmp(x) AS (
    values (1), (2), (3), (4), (5)
), rcte(x, y) AS (
    SELECT x, x FROM tmp WHERE x = 1
    UNION ALL
    SELECT x + 1, x FROM rcte WHERE x < 5
)
SELECT * FROM rcte;

-- Recursive CTE with a filter on a subquery alias that LIMIT keeps on top of the recursion
WITH RECURSIVE r(k, lvl) AS (
    SELECT id, 0 FROM range(5)
    UNION ALL
    SELECT * FROM (SELECT k, lvl + 1 AS lvl FROM r LIMIT 100) t WHERE t.lvl < 3
)
SELECT count(*), max(lvl) FROM r;

-- Non-deterministic query with rand with seed
WITH RECURSIVE randoms(val) AS (
    SELECT CAST(floor(rand(82374) * 5 + 1) AS INT)
    UNION ALL
    SELECT CAST(floor(rand(237685) * 5 + 1) AS INT)
    FROM randoms
)
SELECT val FROM randoms LIMIT 5;

-- Non-deterministic query with randstr
WITH RECURSIVE randoms(val) AS (
    SELECT randstr(10, 82374)
    UNION ALL
    SELECT randstr(10, 237685)
    FROM randoms
)
SELECT val FROM randoms LIMIT 5;

-- Type coercion where the anchor is wider
WITH RECURSIVE t1(n, m) AS (
    SELECT 1, CAST(1 AS BIGINT)
    UNION ALL
    SELECT n+1, n+1 FROM t1 WHERE n < 5)
SELECT * FROM t1;

-- Recursive CTE with nullable recursion and non-recursive anchor
WITH RECURSIVE t1(n) AS (
    SELECT 1
    UNION ALL
    SELECT CASE WHEN n < 5 THEN n + 1 ELSE NULL END FROM t1
)
SELECT * FROM t1 LIMIT 25;

-- Two calls to same infinite rCTE from another rCTE
WITH RECURSIVE t1(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM t1
), t2(m) AS (
    SELECT (SELECT SUM(n) FROM (SELECT n FROM t1 LIMIT 10) AS sums)
    UNION ALL
    SELECT m + (SELECT SUM(n) FROM (SELECT n FROM t1 LIMIT 3) AS sums) FROM t2
)
SELECT * FROM t2 LIMIT 20;

WITH RECURSIVE t1(n) AS (
    SELECT 1
    UNION ALL
    (SELECT n + 1 FROM t1 WHERE n < 5 ORDER BY n)
)
SELECT * FROM t1;

WITH RECURSIVE t1(n) AS (
    WITH t2(m) AS (SELECT 1)
    SELECT 1 FROM t1
    UNION ALL
    SELECT n+1 FROM t1 WHERE n < 5)
SELECT * FROM t1;

-- Recursive CTE self-reference under INNER JOIN ... USING
WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, data
  FROM r INNER JOIN (VALUES (0)) AS t(data) USING (data)
  WHERE level < 2
)
SELECT * FROM r;

WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, data
  FROM (VALUES (0)) AS t(data) NATURAL INNER JOIN r
  WHERE level < 2
)
SELECT * FROM r;

WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, data
  FROM r NATURAL LEFT OUTER JOIN (VALUES (0)) AS t(data)
  WHERE level < 2
)
SELECT * FROM r;

WITH RECURSIVE r(level, data) AS (
  VALUES (0, 0)
  UNION ALL
  SELECT level + 1, data
  FROM r FULL OUTER JOIN (VALUES (0)) AS t(data) USING (data)
  WHERE level < 2
)
SELECT * FROM r;

-- The single-aggregate PIVOT path permits a recursive reference in its expression subquery.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS STRING)
  UNION ALL
  SELECT `1` FROM VALUES (1, 1) AS source(k, v)
  PIVOT (max(cast((SELECT cast(n AS INT) + 1 FROM t) AS STRING)) FOR k IN (1))
  WHERE `1` < 3
)
SELECT * FROM t;

-- The single-aggregate PIVOT path with an aliased pivot value.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS STRING)
  UNION ALL
  SELECT one FROM VALUES (1, 1) AS source(k, v)
  PIVOT (max(cast((SELECT cast(n AS INT) + 1 FROM t) AS STRING)) FOR k IN (1 AS one))
  WHERE one < 3
)
SELECT * FROM t;

-- A chain of local helpers retains the recursive dependency below an aggregate.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS BIGINT)
  UNION ALL (
    WITH h1 AS (SELECT n FROM t), h2 AS (SELECT n FROM h1)
    SELECT sum(n) FROM h2
  )
)
SELECT * FROM t;

-- A local helper on a forbidden side of right outer and full outer joins.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS BIGINT)
  UNION ALL (
    WITH helper AS (SELECT n FROM t)
    SELECT helper.n + 1
    FROM helper RIGHT JOIN VALUES (1) AS v(x) ON helper.n < 3
  )
)
SELECT * FROM t LIMIT 5;

-- The completed inner loop read directly, without a helper, on the left side of the join.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS BIGINT)
  UNION ALL (
    WITH RECURSIVE inner_loop(n) AS (
      SELECT 1
      UNION ALL
      SELECT n + 1 FROM inner_loop WHERE n < 2
    )
    SELECT t.n + totals.n
    FROM (SELECT sum(n) AS n FROM inner_loop) totals CROSS JOIN t
    WHERE t.n < 3
  )
)
SELECT * FROM t;

-- A recursive reference in an aggregate-list subquery with GROUP BY.
WITH RECURSIVE t(n) AS (
  SELECT CAST(1 AS BIGINT)
  UNION ALL (
    SELECT s FROM (
      SELECT max(x) + (SELECT n FROM t LIMIT 1) AS s FROM VALUES (1), (1) AS v(x) GROUP BY x
    ) WHERE s < 4
  )
)
SELECT * FROM t;

CREATE TEMPORARY VIEW t2 AS SELECT * FROM VALUES
  ("one", 1), ("two", 2), ("three", 3), ("one", 5) AS t1(col1, col2);

-- RIGHT JOIN
SELECT * FROM (WITH cte AS (SELECT * FROM t1) SELECT * FROM t1)
RIGHT JOIN (WITH cte AS (SELECT * FROM t2) SELECT * FROM t2);

-- EXCEPT
SELECT * FROM (WITH cte AS (SELECT * FROM t1) SELECT * FROM t1)
EXCEPT
SELECT * FROM (WITH cte AS (SELECT * FROM t2) SELECT * FROM t2);

-- INNER JOIN with CTE reference
SELECT * FROM (WITH cte AS (SELECT * FROM t1) SELECT * FROM cte)
INNER JOIN (WITH cte AS (SELECT * FROM t2) SELECT * FROM cte);

-- UNION with CTE reference
SELECT * FROM (WITH cte AS (SELECT * FROM t1) SELECT * FROM cte)
UNION
SELECT * FROM (WITH cte AS (SELECT * FROM t2) SELECT * FROM cte);

create temporary view t as select * from values 0, 1, 2 as t(id);

create table t4(col1 TIMESTAMP);

-- WITH clause should reference the base table
WITH t AS (SELECT 1 FROM t) SELECT * FROM t;

-- WITH clause should reference the previous CTE
WITH t1 AS (SELECT * FROM t2), t2 AS (SELECT 2 FROM t1) SELECT * FROM t1 cross join t2;

-- CTE with multiple column aliases
WITH t(x, y) AS (SELECT 1, 2)
SELECT * FROM t WHERE x = 1 AND y = 2;

-- CTEs with duplicate names are not allowed
WITH
  t(x) AS (SELECT 1),
  t(x) AS (SELECT 2)
SELECT * FROM t;

-- Deeply nested
WITH w1(c1) AS
 (WITH w2(c2) AS
  (WITH w3(c3) AS
   (WITH w4(c4) AS
    (WITH w5(c5) AS
     (WITH w6(c6) AS
      (WITH w7(c7) AS
       (WITH w8(c8) AS
        (SELECT 1)
        SELECT * FROM w8)
       SELECT * FROM w7)
      SELECT * FROM w6)
     SELECT * FROM w5)
    SELECT * FROM w4)
   SELECT * FROM w3)
  SELECT * FROM w2)
SELECT * FROM w1;

-- CTE name collision with subquery name, should fail
WITH same_name(x) AS (SELECT 42)
SELECT same_name.x FROM (SELECT 10) AS same_name(x), same_name;

-- Reference of later WITH, should fail.
with r1 as (select * from r2),
     r2 as (select 1)
select 2;

-- WITH in an IN subquery
select 1 in (with q as (select 1) select * from q);

-- References to CTEs of the same name should be resolved properly
WITH TTtt as (select 1 a),
     `tTTt_2` as (select 2 a)
select *
from
  (WITH TtTt as (select 3 c) select * from ttTT, `tttT_2`);

-- A WITH subquery alias is visible inside a WITH clause subquery.
WITH q1 as (select 1 x)
select * from
  (with q2 as (select * from q1) select * from q2);

-- Refer to CTE in subquery
with cte1 as (Select id as j from t)
select * from cte1 where j = (select max(j) from cte1 as cte2);

-- WithCTE placement for WITH in boch UNION branches
SELECT * FROM (
  (
    WITH cte AS (SELECT 1)
    SELECT * FROM cte
  ) UNION ALL (
    WITH cte AS (SELECT 2)
    SELECT * FROM cte
  )
);

WITH cte AS (
  SELECT
    *
  FROM
    VALUES (1)
  WHERE EXISTS (
    WITH cte AS (SELECT 1)
    SELECT * FROM cte
  )
  UNION ALL (
    SELECT
      *
    FROM
      VALUES (1)
    WHERE EXISTS (
      WITH cte AS (SELECT 1)
      SELECT * FROM cte
    )
  )
)
SELECT * FROM cte;

-- Expression ID assignment in CTE with JOIN
SELECT * FROM (
  WITH cte1 AS (SELECT * FROM t4) SELECT t4.col1 FROM t4 JOIN cte1 USING (col1)
);

SELECT * FROM (
  WITH cte1 AS (SELECT * FROM t4) SELECT cte1.col1 FROM cte1 JOIN t4 USING (col1)
);

-- CTE materialization options
WITH t AS MATERIALIZED (SELECT 1 AS x)
SELECT * FROM t, t AS t2;

-- MATERIALIZED is a non-reserved keyword
WITH materialized AS (SELECT 1 AS x)
SELECT * FROM materialized;

-- Unreferenced MATERIALIZED CTE referencing the outer query, should fail
SELECT * FROM t WHERE EXISTS (
  WITH s AS MATERIALIZED (SELECT 1 FROM t2 WHERE t2.id = t.id)
  SELECT 1
);

-- MATERIALIZED CTE referencing the outer query through another CTE, should fail
SELECT * FROM t WHERE EXISTS (
  WITH s AS (SELECT 1 FROM t2 WHERE t2.id = t.id),
       s2 AS MATERIALIZED (SELECT * FROM s)
  SELECT * FROM s2
);

-- MATERIALIZED CTE referencing a CTE whose inner CTE is correlated to that CTE's own relation
WITH v1 AS (
  SELECT t.id, (WITH s AS (SELECT count(*) c FROM t2 WHERE t2.id = t.id) SELECT c FROM s) AS c
  FROM t
),
v2 AS MATERIALIZED (SELECT * FROM v1)
SELECT * FROM v2;

SELECT * FROM t o WHERE EXISTS (
  WITH s AS (SELECT i.id FROM t2 i WHERE i.id = o.id),
       v AS MATERIALIZED (SELECT t.id, l.n FROM t, LATERAL (SELECT count(*) n FROM s) l)
  SELECT * FROM v
);

WITH cte_time_travel AS (SELECT 1 AS col1) SELECT * FROM cte_time_travel VERSION AS OF 0;

WITH cte_time_travel AS (SELECT 1 AS col1) SELECT * FROM cte_time_travel FOR SYSTEM_VERSION AS OF 0;

-- A nested WITH reading the outer CTE with time travel.
WITH cte_time_travel AS (SELECT 1 AS col1)
SELECT * FROM (WITH cte AS (SELECT * FROM cte_time_travel VERSION AS OF 0) SELECT * FROM cte);

DROP TABLE cte_time_travel;

DROP VIEW IF EXISTS t3;

-- date literals, functions and operations

create temporary view date_view as select '2011-11-11' date_str, '1' int_str;

select make_date(2019, 1, 1), make_date(12, 12, 12);

-- invalid: year field must have at least 4 digits
select date'015';

-- under ANSI mode, `current_date` can't be a function name.
select current_date() = current_date();

select UNIX_DATE(DATE('1970-01-01')), UNIX_DATE(DATE('2020-12-04')), UNIX_DATE(null);

-- invalid: there is no 29 in February, 1970
select to_date("02-29", "MM-dd");

-- `year` accepts both date and timestamp ltz/ntz inputs.
select year('1500-01-01'), year('1582-10-15 13:10:15'), year(timestamp_ltz'1582-10-15 13:10:15'), year(timestamp_ntz'1582-10-15 13:10:15');

-- next_day
select next_day("2015-07-23", "Mon");

-- next_date does not accept timestamp lzt/ntz input
select next_day(timestamp_ltz"2015-07-23 12:12:12", "Mon");

select next_day(null, "Mon");

select date_add('2011-11-11', 1);

-- invalid cases: the second parameter can only be byte/short/int
select date_add('2011-11-11', 1L);

-- the second parameter can be a string literal if it can be parsed to int
select date_add('2011-11-11', '1');

select date_add(date'2011-11-11', null);

-- date sub
select date_sub(date'2011-11-11', 1);

select date_sub('2011-11-11', 1S);

select date_sub('2011-11-11', 1E1);

-- null input leads to null result.
select date_sub(null, 1);

select date_sub(timestamp_ntz'2011-11-11 12:12:12', 1);

select date_add(date_str, 1) from date_view;

select date '2001-09-28' + 7Y;

-- date - date
select date '2001-10-01' - date '2001-09-28';

select date '2001-09-28' - null;

select date '2001-09-28' - date_str from date_view;

-- null result: date + null
select date'2011-11-11' + null;

-- Unsupported narrow text style
select to_date('26/October/2015', 'dd/MMMMM/yyyy');

-- Add a number of units to a timestamp or a date
select dateadd(MICROSECOND, 1001, timestamp'2022-02-25 01:02:03.123');

select date_add(MINUTE, -100, date'2022-02-25');

select dateadd(WEEK, -4, timestamp'2022-02-25 01:02:03');

select date_add(YEAR, 1, date'2022-02-25');

-- Get the difference between timestamps or dates in the specified units
select datediff(MICROSECOND, timestamp'2022-02-25 01:02:03.123', timestamp'2022-02-25 01:02:03.124001');

select date_diff(MINUTE, date'2022-02-25', timestamp'2022-02-24 22:20:00');

select datediff(WEEK, timestamp'2022-02-25 01:02:03', timestamp'2022-01-28 01:02:03');

select date_diff(YEAR, date'2022-02-25', date'2023-02-25');

--- TESTS FOR DATETIME FORMATTING FUNCTIONS WITH INVALID PATTERNS ---

-- separating this from datetime-formatting.sql, because the text form
-- for patterns with 5 letters in SimpleDateFormat varies from different JDKs
select date_format('2018-11-17 13:33:33.333', 'GGGGG');

select date_format('2018-11-17 13:33:33.333', 'QQQQQ');

select date_format('2018-11-17 13:33:33.333', 'EEEEE');

-- DD is invalid if the day-of-year exceeds 100, but it becomes valid in Java 11
-- select date_format('2018-11-17 13:33:33.333', 'DD');
select date_format('2018-11-17 13:33:33.333', 'DDDD');

select date_format('2018-11-17 13:33:33.333', 'mmm');

select date_format('2018-11-17 13:33:33.333', 'aa');

select date_format('2018-11-17 13:33:33.333', 'XXXXXX');

select date_format('2018-11-17 13:33:33.333', 'A');

-- disabled week-based patterns
select date_format('2018-11-17 13:33:33.333', 'Y');

select date_format('2018-11-17 13:33:33.333', 'e');

select date_format('2018-11-17 13:33:33.333', 'I');

select col, date_format(col, 'y yy yyy yyyy yyyyy yyyyyy'), to_char(col, 'y yy yyy yyyy yyyyy yyyyyy'), to_varchar(col, 'y yy yyy yyyy yyyyy yyyyyy') from v;

select col, date_format(col, 'M MM MMM MMMM'), to_char(col, 'M MM MMM MMMM'), to_varchar(col, 'M MM MMM MMMM') from v;

select col, date_format(col, 'F'), to_char(col, 'F'), to_varchar(col, 'F') from v;

select col, date_format(col, 'D DDD'), to_char(col, 'D DDD'), to_varchar(col, 'D DDD') from v;

select col, date_format(col, 'm mm'), to_char(col, 'm mm'), to_varchar(col, 'm mm') from v;

select col, date_format(col, 'a'), to_char(col, 'a'), to_varchar(col, 'a') from v;

select col, date_format(col, 'X XX XXX'), to_char(col, 'X XX XXX'), to_varchar(col, 'X XX XXX') from v;

select col, date_format(col, 'O OOOO'), to_char(col, 'O OOOO'), to_varchar(col, 'O OOOO') from v;

-- literals
select col, date_format(col, "姚123'GyYqQMLwWuEFDdhHmsSaVzZxXOV'"), to_char(col, "姚123'GyYqQMLwWuEFDdhHmsSaVzZxXOV'"), to_varchar(col, "姚123'GyYqQMLwWuEFDdhHmsSaVzZxXOV'") from v;

-- different datetime types
select date_format(date'2023-08-18', 'yyyy-MM-dd'), to_char(date'2023-08-18', 'yyyy-MM-dd'), to_varchar(date'2023-08-18', 'yyyy-MM-dd');

-- SPARK-57575: TIME type formatting
select to_char(TIME'12:13:14', 'HH:mm:ss'), to_varchar(TIME'12:13:14', 'HH:mm:ss');

-- out of year value range [0, 294247]
select to_timestamp('1', 'yy');

-- the number of digits must be 2 for 'yy'.
select to_timestamp('1', 'yyy');

select to_timestamp('9', 'DD');

select to_timestamp('99', 'DDD');

select to_timestamp('2019-366', 'yyyy-DDD');

select to_timestamp('2020-10-350', 'yyyy-MM-DDD');

-- Datetime types parse error
select to_date("2020-01-27T20:06:11.847", "yyyy-MM-dd HH:mm:ss.SSS");

select to_timestamp("Unparseable", "yyyy-MM-dd HH:mm:ss.SSS");

select to_unix_timestamp("2020-01-27T20:06:11.847", "yyyy-MM-dd HH:mm:ss.SSS");

select cast("Unparseable" as date);

select to_time("12:00:60", "HH:mm:ss");

--- TESTS FOR DATETIME PARSING FUNCTIONS ---

-- parsing with pattern 'y'.
-- the range of valid year is [-290307, 294247],
-- but particularly, some thrift client use java.sql.Timestamp to parse timestamp, which allows
-- only positive year values less or equal than 9999. So the cases bellow only use [1, 9999] to pass
-- ThriftServerQueryTestSuite
select to_timestamp('1', 'y');

select to_timestamp('99', 'yy');

-- the range of valid year is [-9999, 9999], the number of digits must be 4 for 'yyyy'.
select to_timestamp('0001', 'yyyy');

select to_timestamp('09999', 'yyyyy');

-- parsing with pattern 'D'
select to_timestamp('9', 'D');

select to_timestamp('99', 'DD');

select to_timestamp('365', 'DDD');

select to_timestamp('2020-365', 'yyyy-DDD');

select to_timestamp('2020-12-350', 'yyyy-MM-DDD');

select to_timestamp(20260924073325, 'yyyyMMddHHmmss');

select to_timestamp(1);

select to_time('12:34', 'HH:mm');

select to_time('01:02:03 PM', 'hh:mm:ss a');

-- timestamp with year outside [0000-9999]
select timestamp'-1969-12-31 16:00:00', timestamp'-0015-03-18 16:00:00', timestamp'-000001', timestamp'99999-03-18T12:03:17';

select next_day(date'+5881580-07-04', 'FR');

select last_day(date'+5881580-07-11');

select trunc(date'-5877641-06-30', 'MONTH');

--
--   Licensed to the Apache Software Foundation (ASF) under one or more
--   contributor license agreements.  See the NOTICE file distributed with
--   this work for additional information regarding copyright ownership.
--   The ASF licenses this file to You under the Apache License, Version 2.0
--   (the "License"); you may not use this file except in compliance with
--   the License.  You may obtain a copy of the License at
--
--      http://www.apache.org/licenses/LICENSE-2.0
--
--   Unless required by applicable law or agreed to in writing, software
--   distributed under the License is distributed on an "AS IS" BASIS,
--   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
--   See the License for the specific language governing permissions and
--   limitations under the License.
--

CREATE TEMPORARY VIEW t AS SELECT 1.0 as a, 0.0 as b;

select pmod(a, b) from t;

-- test decimal operations
select id, a+b, a-b, a*b, a/b from decimals_test order by id;

select 10.3000 * 3.0;

select 10.300000000000000000 * 3.0000000000000000000;

select (-4e36BD - 0.1) - 7e36BD;

select 1.2345678901234567890E30BD * 1.2345678901234567890E25BD;

select 12345678912345.123456789123 / 0.000000012345678;

SELECT CAST(20 AS DECIMAL(4, 1))
UNION ALL
SELECT CAST(10 AS DECIMAL(3, 1)) * CAST(10 AS DECIMAL(3, 1));

SELECT CAST(20 AS DECIMAL(4, 1))
UNION ALL
SELECT pmod(CAST(10 AS DECIMAL(10, 2)), CAST(3 AS DECIMAL(5, 1)));

-- test decimal operations
select /*+ COALESCE(1) */ id, a+b, a-b, a*b, a/b from decimals_test order by id;

select 1.0123456789012345678901234567890123456e35BD / 1.0;

select 1.0123456789012345678901234567890123456e32BD / 1.0;

select 1.0123456789012345678901234567890123456e31BD / 10.0;

INSERT INTO TABLE t PARTITION (ds='2017-08-01', hr=10)
VALUES ('k1', 100), ('k2', 200), ('k3', 300);

DESC EXTENDED t PARTITION (ds='2017-08-01', hr=10);

DESC EXTENDED t PARTITION (ds='2017-08-01', hr=11);

-- DROP TEST TABLES/VIEWS
DROP TABLE t;

-- Simple Describe query
DESC SELECT key, key + 1 as plusone FROM desc_temp1;

DESC SELECT 10.00D as col1;

DESC QUERY FROM desc_temp1 a SELECT *;

DESCRIBE SELECT * FROM (FROM desc_temp2 select * select *);

DESCRIBE
   FROM desc_temp1 a
     insert into desc_temp1 select *
     insert into desc_temp2 select *;

-- cleanup
DROP TABLE desc_temp1;

DESC FORMATTED table_with_comment;

-- CREATE TABLE WITHOUT COMMENT
CREATE TABLE table_comment (a STRING, b INT) USING parquet;

-- ALTER UNSET PROPERTIES COMMENT
ALTER TABLE table_comment UNSET TBLPROPERTIES IF EXISTS ('comment');

CREATE TEMPORARY VIEW temp_v AS SELECT * FROM t;

ALTER TABLE t SET TBLPROPERTIES (e = '3');

DESCRIBE EXTENDED t AS JSON;

DESC default.t;

DESC EXTENDED t;

DESC t PARTITION (c='Us', d=1);

DESC FORMATTED t PARTITION (c='Us', d=1);

-- ParseException: PARTITION specification is incomplete
DESC t PARTITION (c='Us', d);

DESCRIBE SCHEMA EXTENDED test_schema;

DESC TABLE temp_v;

DESC temp_Data_Source_View;

DESC TABLE v;

-- AnalysisException DESC PARTITION is not allowed on a view
DESC v PARTITION (c='Us', d=1);

EXPLAIN EXTENDED DESC t;

EXPLAIN DESCRIBE EXTENDED t PARTITION (c='Us', d=2) AS JSON;

DESC EXTENDED d;

-- Show column default values with newlines in the string
CREATE TABLE e (a STRING DEFAULT CONCAT('a\n b\n ', 'c\n d'), b INT DEFAULT 42) USING parquet COMMENT 'table_comment';

DESC TABLE EXTENDED e;

DESC FORMATTED f PARTITION (B='SPARK', C=TIMESTAMP'2018-11-17 13:33:33');

DROP VIEW temp_Data_Source_View;

DROP TABLE d;

-- Test DISTINCT aggregates with MapType arguments.

CREATE OR REPLACE TEMPORARY VIEW distinct_map_data AS SELECT * FROM VALUES
  (2, map('a', 1, 'b', 2), 1, true),
  (2, map('b', 2, 'a', 1), 1, true),
  (1, map('a', 1, 'b', 2), 1, true),
  (1, map('a', 3), 2, false)
AS distinct_map_data(g, m, id, should_keep);

SELECT map_entries(m)
FROM (
  SELECT EXPLODE(COLLECT_LIST(DISTINCT m)) AS m
  FROM distinct_map_data
) AS collected_maps
ORDER BY element_at(m, 'a');

SELECT COUNT(DISTINCT m), COUNT(DISTINCT id) FROM distinct_map_data;

SELECT COUNT(DISTINCT m) FILTER (WHERE should_keep) FROM distinct_map_data;

SELECT g
FROM distinct_map_data
GROUP BY g
ORDER BY COUNT(DISTINCT m), g;

SELECT COUNT(DISTINCT array(m)) FROM distinct_map_data;

SELECT g, GROUPING(g), COUNT(DISTINCT m)
FROM distinct_map_data
GROUP BY GROUPING SETS ((g), ())
ORDER BY GROUPING(g), g;

SELECT map_entries(m)
FROM (
  SELECT EXPLODE(COLLECT_LIST(DISTINCT m)) AS m
  FROM distinct_map_data
) AS collected_maps
ORDER BY element_at(m, 'a'), map_entries(m)[0].key;

-- All these should error out in the parser in non-ansi mode, error out in the analyzer in ansi mode
SELECT 1 FROM "not_exist";

ALTER TABLE not_exist ADD COLUMN "not_exist" int;

SELECT "not_exist"();

-- All these should error out in analysis
SELECT 1 FROM `hello`;

ALTER TABLE not_exist ADD COLUMN `not_exist` int;

SELECT `not_exist`();

-- Ok for non-ansi mode, error for ansi-mode
CREATE TEMPORARY VIEW v(c1 COMMENT "hello") AS SELECT 1;

CREATE TEMPORARY VIEW v(c1 COMMENT 'hello') AS SELECT 1;

CREATE TEMPORARY VIEW "myview"("c1") AS
  WITH "v"("a") AS (SELECT 1) SELECT "a" FROM "v";

DROP SCHEMA "myschema";

-- DROP TABLE IF EXISTS on an existing and on a missing table.
CREATE TABLE drop_table_t2 (c INT) USING parquet;

-- DROP TABLE on a missing table.
DROP TABLE drop_table_missing;

-- DROP TABLE with PURGE.
CREATE TABLE drop_table_t4 (c INT) USING parquet;

DROP TABLE drop_table_v1;

DROP TABLE global_temp.drop_table_gv1;

DROP TABLE IDENTIFIER('drop_table_t6');

DROP TABLE drop_table_t7;

DROP TABLE IF EXISTS drop_table_t9;

DROP TABLE drop_table_t8 PURGE;

DROP VIEW drop_view_v1;

DROP VIEW IF EXISTS drop_view_missing;

DROP VIEW IF EXISTS global_temp.drop_view_gv1;

CREATE VIEW drop_view_pv2 AS SELECT 2 AS c;

CREATE TEMPORARY VIEW drop_view_sh AS SELECT 1 AS c;

DROP VIEW default.drop_view_sh;

DROP VIEW IF EXISTS drop_view_t1;

DROP VIEW IDENTIFIER('drop_view_id1');

-- DROP VIEW with an IDENTIFIER clause over a session variable.
CREATE VIEW drop_view_var_v AS SELECT 1 AS c;

DROP TEMPORARY VARIABLE drop_view_var;

DROP VIEW IDENTIFIER(rand());

DROP VIEW IF EXISTS global_temp.drop_view_a.drop_view_b;

DROP VIEW session.drop_view_s1;

DROP VIEW system.session.drop_view_s2;

CREATE TEMPORARY VIEW tab2 AS SELECT * FROM VALUES
    (1), (2), (2), (3), (5), (5), (null) AS tab2(c1);

-- Basic EXCEPT ALL
SELECT * FROM tab1
EXCEPT ALL
SELECT * FROM tab2;

-- Empty left relation
SELECT * FROM tab1 WHERE c1 > 5
EXCEPT ALL
SELECT * FROM tab2;

-- Error as types of two side are not compatible
SELECT * FROM tab1
EXCEPT ALL
SELECT array(1);

-- EXCEPT ALL + INTERSECT
SELECT * FROM tab4
EXCEPT ALL
SELECT * FROM tab3
INTERSECT DISTINCT
SELECT * FROM tab4;

-- Mismatch on number of columns across both branches
SELECT k FROM tab3
EXCEPT ALL
SELECT k, v FROM tab4;

-- Chain of set operations
SELECT * FROM tab3
EXCEPT ALL
SELECT * FROM tab4
EXCEPT DISTINCT
SELECT * FROM tab3
EXCEPT DISTINCT
SELECT * FROM tab4;

-- Group by under ExceptAll
SELECT v FROM tab3 GROUP BY v
EXCEPT ALL
SELECT k FROM tab4 GROUP BY k;

DROP VIEW IF EXISTS tab3;

create temporary view t2 as select * from values
  ("one", 1),
  ("two", 22),
  ("one", 5),
  ("one", NULL),
  (NULL, 5)
  as t2(k, v);

-- Except operation that will be replaced by Filter: SPARK-22181
SELECT * FROM t1 where v <> 1 and v <> 22 EXCEPT SELECT * FROM t1 where v <> 2 and v >= 3;

-- Except operation that will be replaced by left anti join
SELECT (SELECT min(k) FROM t2 WHERE t2.k = t1.k) min_t2 FROM t1
MINUS
SELECT (SELECT min(k) FROM t2) abs_min_t2 FROM t1 WHERE  t1.k = 'one';

SELECT t.v FROM (
  SELECT v FROM t3
  EXCEPT
  SELECT v + v AS v FROM t3
) t;

-- Automatically generated by SQLQueryTestSuite
-- !query
CREATE TEMPORARY VIEW tbl_view AS SELECT * FROM VALUES
  (10, 'name1', named_struct('f1', 1, 's2', named_struct('f2', 101, 'f3', 'a'))),
  (20, 'name2', named_struct('f1', 2, 's2', named_struct('f2', 202, 'f3', 'b'))),
  (30, 'name3', named_struct('f1', 3, 's2', named_struct('f2', 303, 'f3', 'c'))),
  (40, 'name4', named_struct('f1', 4, 's2', named_struct('f2', 404, 'f3', 'd'))),
  (50, 'name5', named_struct('f1', 5, 's2', named_struct('f2', 505, 'f3', 'e'))),
  (60, 'name6', named_struct('f1', 6, 's2', named_struct('f2', 606, 'f3', 'f'))),
  (70, 'name7', named_struct('f1', 7, 's2', named_struct('f2', 707, 'f3', 'g')))
AS tbl_view(id, name, data);

SET VAR sql_string = 'SELECT * from tbl_view where name = \'name1\'';

EXECUTE IMMEDIATE 'SELECT * FROM tbl_view_tmp';

EXECUTE IMMEDIATE 'SELECT * from tbl_view where name = \'name1\'';

SET VAR a = 'name1';

EXECUTE IMMEDIATE 'SELECT * from tbl_view where name = ? or name = ?' USING 'name1', 'name3';

-- test positional command
EXECUTE IMMEDIATE 'INSERT INTO x VALUES(?)' USING 1;

DECLARE b INT;

EXECUTE IMMEDIATE sql_string USING b as second, 'name7' as first;

-- named parameter used multiple times
EXECUTE IMMEDIATE 'SELECT tbl_view.*, :first as p FROM tbl_view WHERE name = :first' USING 'name7' as first;

-- test into
DECLARE res_id INT;

EXECUTE IMMEDIATE sql_string INTO res_id USING a as first;

-- multiple INTOs
EXECUTE IMMEDIATE 'SELECT id, name FROM tbl_view WHERE id = ?' INTO b, a USING 10;

-- empty query
EXECUTE IMMEDIATE 'SELECT 42 WHERE 2 = 1' INTO res_id;

-- require query when using INTO
EXECUTE IMMEDIATE 'INSERT INTO x VALUES (?)' INTO res_id USING 1;

-- use column in using - should fail as we expect variable here
EXECUTE IMMEDIATE 'SELECT * FROM tbl_view WHERE ? = id' USING id;

-- all parameters must be named
EXECUTE IMMEDIATE 'SELECT * FROM tbl_view where :first = name' USING 1, 'name2' as first;

-- Parameter passed must be STRING
EXECUTE IMMEDIATE b;

-- constant expressions are supported
EXECUTE IMMEDIATE 'SELECT * from tbl_view where name = :first' USING CONCAT(a , "me1") as first;

-- INTO does not support braces - parser error
EXECUTE IMMEDIATE 'SELECT id, name FROM tbl_view WHERE id = ?' INTO (a, b) USING 10;

EXECUTE IMMEDIATE 'SELECT id FROM tbl_view' INTO res_id, b;

EXECUTE IMMEDIATE 'SELECT id FROM tbl_view WHERE id = :p' USING p;

-- nested execute immediate
EXECUTE IMMEDIATE 'EXECUTE IMMEDIATE \'SELECT id FROM tbl_view WHERE id = ?\' USING 10';

-- sqlString is not a string
SET VAR sql_string = 5;

-- mixed positional and named parameters in query
EXECUTE IMMEDIATE 'SELECT 42 where ? = :first' USING 1, 2 as first;

EXECUTE IMMEDIATE int_var;

EXECUTE IMMEDIATE null_var;

-- Query is not a constant
EXECUTE IMMEDIATE (SELECT c FROM (VALUES(1)) AS T(c));

-- !query
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING 5L AS p;

-- !query
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING 3.14F AS p;

-- !query
-- Boolean type
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING true AS p;

-- !query
-- String with single quotes (test escaping)
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING 'it''s a test' AS p;

-- !query
-- TimestampNTZ type
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING TIMESTAMP_NTZ '2023-12-25 10:30:45' AS p;

-- !query
-- Binary type
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, hex(:p) as val' USING X'010203FF' AS p;

-- !query
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING INTERVAL '1-2' YEAR TO MONTH AS p;

-- !query
-- Test multiple parameters with different types
EXECUTE IMMEDIATE 'SELECT typeof(:p1) as type1, :p1 as val1, typeof(:p2) as type2, :p2 as val2' 
  USING 42 as p1, 'test string' as p2;

-- !query
-- Nested array
EXECUTE IMMEDIATE 'SELECT typeof(:p) as type, :p as val' USING ARRAY(ARRAY(1, 2), ARRAY(3, 4)) AS p;

-- !query
-- Test unbound parameter markers without USING clause
-- named parameter without USING clause should fail
EXECUTE IMMEDIATE 'SELECT :param';

CREATE TABLE explain_temp2(c INT, d INT) USING PARQUET;

EXPLAIN COST WITH max_store_sales AS
(
  SELECT max(csales) tpcds_cmax
  FROM (
    SELECT sum(b) csales
    FROM explain_temp1 WHERE a < 100
  ) x
),
best_ss_customer AS
(
  SELECT c
  FROM explain_temp2
  WHERE d > (SELECT * FROM max_store_sales)
)
SELECT c FROM best_ss_customer;

-- Test tables
CREATE table  explain_temp1 (key int, val int) USING PARQUET;

CREATE table  explain_temp4 (key int, val string) USING PARQUET;

-- distinct func
EXPLAIN EXTENDED
  SELECT sum(distinct val)
  FROM explain_temp1;

-- simple union
EXPLAIN FORMATTED
  SELECT key, val FROM explain_temp1 WHERE key > 0
  UNION 
  SELECT key, val FROM explain_temp1 WHERE key > 1;

-- Subqueries nested.
EXPLAIN FORMATTED
  SELECT * 
  FROM   explain_temp1 
  WHERE  key = (SELECT max(key) 
                FROM   explain_temp2 
                WHERE  key = (SELECT max(key) 
                              FROM   explain_temp3 
                              WHERE  val > 0) 
                       AND val = 2) 
         AND val > 3;

-- CTE + ReuseExchange
EXPLAIN FORMATTED
  WITH cte1 AS (
    SELECT *
    FROM explain_temp1 
    WHERE key > 10
  )
  SELECT * FROM cte1 a, cte1 b WHERE a.key = b.key;

-- Recursion
EXPLAIN FORMATTED
  WITH RECURSIVE r(level) AS (
    VALUES 0
    UNION ALL
    SELECT level + 1 FROM r WHERE level < 9
  )
SELECT * FROM r;

-- ObjectHashAggregate
EXPLAIN FORMATTED
  SELECT key, sort_array(collect_set(val))[0]
  FROM explain_temp4
  GROUP BY key;

-- cleanup
DROP TABLE explain_temp1;

DROP TABLE explain_temp5;

-- SPARK-57186: multipart field access (col.a) on a NullType base propagates NULL under the
-- single-pass resolver as well, consistently with the legacy analyzer. Dual-running both analyzers
-- locks in that consistency (no HYBRID_ANALYZER_EXCEPTION).
-- The col[0]/col['key'] subscript forms are intentionally not covered here: the single-pass
-- resolver does not resolve subscript extraction (UnresolvedExtractValue) at all -- a pre-existing
-- limitation independent of NullType -- so they are exercised only under the legacy analyzer in
-- extract-value-resolution-edge-cases.sql.


SELECT col.a FROM (SELECT null AS col) t;

SELECT col1.a, a FROM t1 ORDER BY col1.a;

SELECT col1[get(filter(col1,k -> k == col2), col2)] FROM t2;

SELECT col1[col1[get(filter(col1, k -> k == col2), col2)]] FROM t2;

SELECT col2 FROM t2 GROUP BY col1, col2 HAVING col1[get(filter(col1, k -> k == col2), col2)] > 0;

SELECT transform(map_values(col1), v -> v + col2)[0] FROM t3;

SELECT col['key'] FROM (SELECT null AS col) t;

select extract(y from c), extract(y from ntz), extract(y from i) from t;

select extract(yrs from c), extract(yrs from ntz), extract(yrs from i) from t;

select extract(qtr from c), extract(qtr from ntz) from t;

select extract(mons from c), extract(mons from ntz), extract(mons from i) from t;

select extract(w from c), extract(w from ntz) from t;

select extract(d from c), extract(d from ntz), extract(d from j) from t;

select extract(dow from c), extract(dow from ntz) from t;

select extract(doy from c), extract(doy from ntz) from t;

select extract(hours from c), extract(hours from ntz), extract(hours from j) from t;

select extract(minute from c), extract(minute from ntz), extract(minute from j) from t;

select extract(mins from c), extract(mins from ntz), extract(mins from j) from t;

select extract(s from c), extract(s from ntz), extract(s from j) from t;

select extract(secs from c), extract(secs from ntz), extract(secs from j) from t;

select extract(not_supported from j) from t;

select date_part('years', c), date_part('years', ntz), date_part('years', i) from t;

select date_part('yearofweek', c), date_part('yearofweek', ntz) from t;

select date_part('month', c), date_part('month', ntz), date_part('month', i) from t;

select date_part('months', c), date_part('months', ntz), date_part('months', i) from t;

select date_part('weeks', c), date_part('weeks', ntz) from t;

select date_part('days', c), date_part('days', ntz), date_part('days', j) from t;

select date_part('dayofweek_iso', c), date_part('dayofweek_iso', ntz) from t;

select date_part('hour', c), date_part('hour', ntz), date_part('hour', j) from t;

select date_part('hr', c), date_part('hr', ntz), date_part('hr', j) from t;

select date_part('m', c), date_part('m', ntz), date_part('m', j) from t;

select date_part('minutes', c), date_part('minutes', ntz), date_part('minutes', j) from t;

select date_part('sec', c), date_part('sec', ntz), date_part('sec', j) from t;

select date_part('not_supported', c) from t;

select date_part(i, i) from t;

select extract('quarter', c) from t;

select extract('day', c) from t;

select extract('dow', c) from t;

select extract('minute', c) from t;

select day(c - j) from t;

select extract(second from to_timestamp(c) - j) from t;

select extract(YEAR from -interval '2-1' YEAR TO MONTH);

select extract(MONTH from -interval '2-1' YEAR TO MONTH);

select date_part('DAY', interval '2-1' YEAR TO MONTH);

select date_part('DAY', interval '123 12:34:56.789123123' DAY TO SECOND);

select date_part('HOUR', interval '123 12:34:56.789123123' DAY TO SECOND);

select date_part('MINUTE', interval '123 12:34:56.789123123' DAY TO SECOND);

select date_part('SECOND', interval '123 12:34:56.789123123' DAY TO SECOND);

select extract(MONTH from interval '123 12:34:56.789123123' DAY TO SECOND);

select datepart('DAY', interval '123 12:34:56.789123123' DAY TO SECOND);

-- multiple generators should work
SELECT explode(array(0, 1, 2)), explode(array(10, 20));

-- multiple generators in project with multi-alias should work
SELECT explode(array(1, 2)) AS a, posexplode(array('x', 'y', 'z')) AS (pos, b);

-- GROUP BY generator alias should fail
SELECT id, explode(array(1, 2, 3)) AS array_element
FROM (VALUES (1), (2)) AS t(id)
GROUP BY id, array_element;

-- generator in CTE with join
WITH cte AS (SELECT explode(array(1, 2)) AS col)
SELECT t1.col, t2.col FROM cte t1 JOIN cte t2 ON t1.col = t2.col;

-- generator with GROUP BY ALL should respect generators arguments
SELECT explode(arr) AS package
FROM (VALUES(array('a', 'b'))) AS t(arr)
GROUP BY ALL;

-- generator with GROUP BY ordinal should count generators arguments
SELECT id, explode(arr)
FROM (VALUES(42, array('a', 'b', 'c'))) AS t(id, arr)
GROUP BY id, 2;

-- generator's generated aliases should not be visible in HAVING.
SELECT stack(2, 'first', count(*), arr,
             'second', 0L, array('1', '2', '3')) AS (x1, x2, x3), id
FROM (VALUES (1, array('a', 'b'))) AS t(id, arr)
GROUP BY _gen_input_3, id
HAVING size (_gen_input_3) > 0;

-- generator with multi-alias and column references should work
SELECT id, posexplode(arr) AS (index, value), index, value
FROM (VALUES (42, array('a', 'b', 'c')), (42, array('t'))) AS t(id, arr);

-- generator with LCA in argument + aggregate + LCA from generator output should fail
SELECT array(1, 2, 3) as arr, explode(arr) as col, count(*), col + 1 as col2;

-- generator output LCA should work
SELECT explode(array(1, 2, 3)) as col, col + 1 as col2;

-- generator LCA left-to-right should work
SELECT explode(array(array(0), array(1), array(2))) as arr, explode(arr) as col;

-- multi-alias on non-generator expression should fail
SELECT 1 AS (pos, val);

-- generator with GROUP BY ALL and HAVING should work
SELECT explode(packages) AS package
FROM (VALUES(array('a', 'b'))) AS t(packages)
GROUP BY ALL
HAVING package IN ('a');

-- three generators with full outer join, one with constant array
SELECT
  explode(array(1)) AS x1,
  explode(array(t1.c1, t2.c1)) AS x2,
  explode(array(t2.c1)) AS x3
FROM (VALUES (1), (2)) AS t1(c1)
FULL OUTER JOIN (VALUES (2), (3)) AS t2(c1)
USING (c1);

-- LCA and generator output share the same alias name: LCA defined first
SELECT 1 as a, explode(array(1, 2, 3)) as a, a * 10;

-- LCA and generator output share the same alias name: generator defined first with aggregate
SELECT explode(array(1, 2, 3)) as a, 1 as a, a * 10, count(*);

-- generator's output alias does not shadow table column
SELECT explode(array(10, 20)) as col, col FROM (VALUES (42)) AS t(col);

-- generator's multi-alias does not shadow table column with aggregate
SELECT posexplode(array('x', 'y')) as (pos, val), pos, val, count(*) FROM (VALUES (42)) AS t(pos) GROUP BY pos;

-- HAVING should be evaluated before multiple window functions with a generator
SELECT explode(array(a)) AS col,
       count(*) OVER () AS cnt,
       count(*) OVER (
         ORDER BY a
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
       ) AS ordered_cnt,
       a
FROM VALUES (1), (2), (3), (NULL) AS t(a)
GROUP BY a
HAVING a IS NOT NULL;

SELECT explode(array(a, b)) AS elem, 'Spark' FROM testData;

SELECT explode(map(1, 'a', 2, 'b'));

SELECT explode(null);

SELECT explode_outer(array(a, b)) AS elem, 'Spark' FROM testData;

SELECT explode_outer(map(1, 'a', 2, 'b'));

SELECT explode_outer(null);

SELECT posexplode(array(a, b)) AS (elem, elem2) FROM testData;

SELECT posexplode(map(1, 'a', 2, 'b'));

SELECT posexplode(null);

SELECT posexplode_outer(array(a, b)) AS (elem, elem2) FROM testData;

SELECT posexplode_outer(map(1, 'a', 2, 'b'));

SELECT posexplode_outer(null);

SELECT inline(array(struct(null, 'a'), struct(null, 'b')));

SELECT inline(1);

-- inline_outer function
SELECT inline_outer(array(struct(1, 'a')));

SELECT inline_outer(array(struct(a, 'a'), struct(b, 'b'))) FROM testData;

SELECT inline_outer(struct(1, 'a'));

select json_tuple('{"a": 1}');

-- stack function
select stack(1, 1, 2, 3);

select stack();

-- CUBE on overlapping columns
SELECT a + b, b, SUM(a - b) FROM testData GROUP BY a + b, b WITH CUBE;

SELECT a, b, SUM(b) FROM testData GROUP BY a, b WITH ROLLUP;

SELECT course, year, SUM(earnings) FROM courseSales GROUP BY ROLLUP(course, year, (course, year)) ORDER BY course, year;

SELECT course, year, SUM(earnings) FROM courseSales GROUP BY CUBE(course, year, (course, year)) ORDER BY course, year;

SELECT course, year, SUM(earnings) FROM courseSales GROUP BY course, year GROUPING SETS(course, year, ());

-- Partial ROLLUP/CUBE/GROUPING SETS
SELECT course, year, SUM(earnings) FROM courseSales GROUP BY course, CUBE(course, year) ORDER BY course, year;

-- GROUPING SETS with aggregate functions containing groupBy columns
SELECT course, SUM(earnings) AS sum FROM courseSales
GROUP BY course, earnings GROUPING SETS((), (course), (course, earnings)) ORDER BY course, sum;

SELECT course, year, GROUPING(course) FROM courseSales GROUP BY course, year;

-- GROUPING/GROUPING_ID in having clause
SELECT course, year FROM courseSales GROUP BY CUBE(course, year)
HAVING GROUPING(year) = 1 AND GROUPING_ID(course, year) > 0 ORDER BY course, year;

SELECT course, year FROM courseSales GROUP BY CUBE(course, year) HAVING grouping__id > 0;

SELECT course, year FROM courseSales GROUP BY course, year ORDER BY GROUPING(course);

-- Aliases in SELECT could be used in ROLLUP/CUBE/GROUPING SETS
SELECT a + b AS k1, b AS k2, SUM(a - b) FROM testData GROUP BY CUBE(k1, k2);

-- GROUP BY use mixed Separate columns and CUBE/ROLLUP/Gr
SELECT a, b, count(1) FROM testData GROUP BY a, b, CUBE(a, b);

SELECT a, b, count(1) FROM testData GROUP BY a, CUBE(a, b), ROLLUP(b);

SELECT a, b, count(1) FROM testData GROUP BY a, CUBE(a, b), ROLLUP(a, b), GROUPING SETS((a, b), (a), ());

SELECT a, b, count(1) FROM testData GROUP BY a, GROUPING SETS((a, b), GROUPING SETS(ROLLUP(a, b)));

SELECT a, b, count(1) FROM testData GROUP BY a, GROUPING SETS(ROLLUP(a, b), CUBE(a, b));

-- Additional grouping analytics coverage focused on combinations not exercised above:
-- aggregate functions in HAVING / ORDER BY over grouping analytics, lateral column
-- aliases over grouping functions, struct field access inside aggregates, uncorrelated
-- subqueries combined with grouping analytics, and negative cases.

CREATE TEMPORARY VIEW gidSrc AS SELECT * FROM VALUES
  (1, 10), (2, 20), (1, 30)
  AS gidSrc(col1, col2);

CREATE TEMPORARY VIEW qualSrc AS SELECT * FROM VALUES
  (1, 2)
  AS qualSrc(c1, c2);

CREATE TEMPORARY VIEW subOuter4 AS SELECT * FROM VALUES
  (1, 10), (1, 20), (2, 30), (3, 40)
  AS subOuter4(col1, col2);

CREATE TEMPORARY VIEW cubeStr AS SELECT * FROM VALUES
  (1, 'a', 10), (2, 'b', 20)
  AS cubeStr(col1, col2, col3);

CREATE TEMPORARY VIEW sub13 AS SELECT * FROM VALUES (1), (3) AS sub13(x);

CREATE TEMPORARY VIEW maxW AS SELECT * FROM VALUES (10), (20) AS maxW(y);

CREATE TEMPORARY VIEW wide34 AS SELECT * FROM VALUES
  (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34)
  AS wide34(c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13,c14,c15,c16,c17,c18,c19,c20,
            c21,c22,c23,c24,c25,c26,c27,c28,c29,c30,c31,c32,c33,c34);

CREATE TEMPORARY VIEW structNested AS SELECT * FROM VALUES
  ('a', named_struct('inner', named_struct('val', CAST(1 AS BIGINT))))
  AS structNested(col1, s1);

-- Lateral column aliases that reference grouping() / grouping_id() results
SELECT col1, grouping_id() AS gid, gid + 1 AS gid_plus
FROM gidSrc
GROUP BY col1 WITH ROLLUP
ORDER BY col1;

SELECT grouping_id() AS gid, SUM(col2) AS s, gid + s AS combined
FROM gidSrc
GROUP BY col1 WITH ROLLUP
ORDER BY col1;

SELECT a, b, count(1)
FROM pairAb
GROUP BY GROUPING SETS ((1, a), (b))
ORDER BY a, b;

SELECT a, b, SUM(b) AS sb
FROM aggSrc
GROUP BY ROLLUP(a, b)
HAVING SUM(b) > 15
ORDER BY a, b;

SELECT a, b, SUM(a + b) AS s
FROM aggSrc
GROUP BY GROUPING SETS ((a, b), (a))
HAVING SUM(a + b) > 20
ORDER BY a, b;

SELECT a, b, SUM(b) AS sb
FROM aggSrc
GROUP BY CUBE(a, b)
ORDER BY SUM(b);

SELECT col1, col2, SUM(s1.val) AS sum1
FROM structOne
GROUP BY ROLLUP (col1, col2)
ORDER BY col1, col2;

SELECT col1, SUM(col2) AS s,
       (SELECT COUNT(*) FROM nums3) AS const_cnt
FROM subOuter3
GROUP BY GROUPING SETS ((col1), ())
ORDER BY col1 NULLS LAST;

-- Uncorrelated scalar subquery computing the same local expression as the ROLLUP grouping key
SELECT 1 + 1 AS gkey, SUM(col2) AS s,
       (SELECT 1 + 1 FROM zeroDummy) AS local_expr
FROM localOuter
GROUP BY ROLLUP(1 + 1)
ORDER BY gkey NULLS LAST;

SELECT col1, SUM(col2) AS s
FROM notInOuter
WHERE col1 NOT IN (SELECT x FROM one3)
GROUP BY GROUPING SETS((col1), ())
ORDER BY col1 NULLS LAST;

SELECT col1 + col2 AS gkey, SUM(col3) AS s,
       (col1 + col2) IN (SELECT x FROM sub1132) AS in_result
FROM exprOuter
GROUP BY ROLLUP(col1 + col2)
ORDER BY gkey NULLS LAST;

-- Negative: window function in GROUP BY
SELECT SUM(a)
FROM (SELECT 1 AS a) t
GROUP BY ROW_NUMBER() OVER (ORDER BY a);

SELECT a, COUNT(DISTINCT b) AS dcnt
FROM distSrc
GROUP BY CUBE(a)
ORDER BY a NULLS LAST;

SELECT a, COUNT(*) FILTER (WHERE b > 15) AS cfilt
FROM aggSrc
GROUP BY ROLLUP(a)
ORDER BY a NULLS LAST;

-- GROUPING SETS with only the empty grouping set (grand total)
SELECT SUM(b) AS s
FROM aggSrc
GROUP BY GROUPING SETS (());

-- Scalar subquery with its own GROUP BY inside, in the SELECT list
SELECT col1, SUM(col2) AS s,
       (SELECT COUNT(*) FROM (SELECT a FROM aggSrc GROUP BY a)) AS distinct_a
FROM subOuter3
GROUP BY ROLLUP(col1)
ORDER BY col1 NULLS LAST;

-- Correlated EXISTS (pre-aggregation, on a base column) with a nested IN inside
SELECT col1, SUM(col2) AS s
FROM subOuter4
WHERE EXISTS (
  SELECT 1 FROM sub12
  WHERE sub12.x = subOuter4.col1 AND sub12.x IN (SELECT a FROM aggSrc)
)
GROUP BY GROUPING SETS((col1), ())
ORDER BY col1 NULLS LAST;

-- Scalar subquery used inside an ORDER BY expression
SELECT a, SUM(b) AS s
FROM aggSrc
GROUP BY CUBE(a)
ORDER BY SUM(b) + (SELECT MAX(y) FROM maxW), a NULLS LAST;

-- IN subquery in WHERE plus an uncorrelated scalar subquery in the SELECT list
SELECT col1, col2, COUNT(*) AS cnt, (SELECT SUM(y) FROM maxW) AS total
FROM cubeStr
WHERE col1 IN (SELECT a FROM aggSrc)
GROUP BY CUBE(col1, col2)
ORDER BY col1 NULLS LAST, col2 NULLS LAST;

-- Correlated scalar subquery in WHERE (pre-aggregation, on a base column)
SELECT col1, SUM(col2) AS s
FROM subOuter4
WHERE col2 > (SELECT AVG(x) FROM sub12 WHERE x <= subOuter4.col1)
GROUP BY ROLLUP(col1)
ORDER BY col1 NULLS LAST;

SELECT payload.file_name
FROM VALUES
  (named_struct('file_name', 'a')),
  (named_struct('file_name', 'b'))
AS t(payload)
GROUP BY GROUPING SETS ((payload.file_name), ());

-- A struct field grouping key referenced by HAVING and through a SELECT alias.
SELECT payload.file_name
FROM VALUES
  (named_struct('file_name', 'a')),
  (named_struct('file_name', 'b'))
AS t(payload)
GROUP BY ROLLUP(payload.file_name)
HAVING payload.file_name IS NOT NULL;

DROP VIEW courseSales;

DROP VIEW pairAb;

DROP VIEW subOuter3;

DROP VIEW exprOuter;

DROP VIEW sub12;

DROP VIEW one3;

DROP VIEW nums3;

DROP VIEW structOne;

-- Test data.
CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
(1, 1), (1, 2), (2, 1), (2, 2), (3, 1), (3, 2), (null, 1), (3, null), (null, null)
AS testData(a, b);

SELECT a AS k, COUNT(b) FROM testData GROUP BY k HAVING k > 1;

-- GROUP BY literal
SELECT a AS k FROM testData GROUP BY 'k';

-- GROUP BY column with name same as an alias used in the project list
SELECT 1 AS a FROM testData GROUP BY a;

-- GROUP BY alias with the subquery name
SELECT (SELECT a FROM testData) + (SELECT b FROM testData) group by `(scalarsubquery() + scalarsubquery())`;

SELECT a, count(*) FROM testData GROUP BY a, (SELECT b FROM testData LIMIT 1);

SELECT a, count(*) FROM testData GROUP BY a, EXISTS(SELECT b FROM testData);

-- Ordinal is replaced correctly when grouping by alias of a literal
SELECT MAX(col1), 3 as abc FROM VALUES(1),(2),(3),(4) GROUP BY col1 % abc;

-- Group by alias on subquery with relation
SELECT (
  SELECT a FROM testData LIMIT 1
) AS subq1
FROM
  VALUES (1)
GROUP BY
  subq1;

-- Group by alias should respect order of aliases in aggregate expressions list
SELECT col1 as a, col2 AS a FROM values('a','b') GROUP BY col2, a;

-- turn off group by aliases
set spark.sql.groupByAliases=false;

SELECT 1 AS col FROM testData GROUP BY `col`;

SELECT g, SUM(i) FROM integers GROUP BY ALL ORDER BY 1;

SELECT (g+i)%2, SUM(i), SUM(g) FROM integers GROUP BY ALL ORDER BY 1;

SELECT c0 FROM (SELECT 1 c0) t0 GROUP BY ALL HAVING c0>0;

-- group by all
-- additional group by star test cases from Mosha
create temporary view stuff as select * from values
  (42, 9.75, 'hello world', '1970-08-07', '13.37', array(1,20,300)),
  (1337, 1.2345, 'oh no', '2000-01-01', '42.0', array(4000,50000,600000)),
  (42, 13.37, 'test', '1970-08-07', '1234567890', array(7000000,80000000,900000000))
  as stuff(i, f, s, t, d, a);

SELECT i AS i, COUNT(i) ci, f AS f, SUM(i + f) sif FROM stuff GROUP BY ALL ORDER BY 1, i, 2, ci, 3, f, 4, sif;

SELECT s AS s, COUNT(*) c FROM stuff GROUP BY ALL HAVING SUM(f) > 0 ORDER BY s;

-- negative test, i shouldn't propagate through the aggregate so the having should fail
SELECT SUM(i) si FROM stuff GROUP BY ALL HAVING i > 2;

-- basic
select country, count(*) from data group by ALL;

-- a column named "all" should take precedence over the normal group by all expansion
-- if all refers to the column, then the following should return 3 rows.
-- if all refers to the global aggregate, then 1 row.
SELECT count(1) FROM VALUES(1), (2), (3) AS T(all) GROUP BY all;

-- alias in grouping column
select country as con, count(*) from data group by all;

-- scalar expression in aggregate column
select country, sum(power) + 10 as powerup from data group by all;

-- having
select country, count(id) as cnt from data group by all having cnt > 1;

-- no grouping column on an empty relation
-- this should still return one row because we rewrite this to a global aggregate, as opposed to
-- returning zero row (grouping by a constant).
select count(*) from (select * from data where country = "DNS") group by all;

-- uncorrelated subquery should work
select country, (select count(*) from data) as cnt, count(id) as cnt_id from data group by all;

-- SELECT list contains unresolved column, should not report UNRESOLVED_ALL_IN_GROUP_BY
select non_exist from data group by all;

SELECT *, 4 AS a, 5 AS b, 6 AS c FROM data GROUP BY ALL;

-- Group by ALL on subquery with relation
SELECT (
  SELECT country FROM data LIMIT 1
) AS subq1
FROM
  VALUES (1)
GROUP BY
  ALL;

CREATE OR REPLACE TEMPORARY VIEW DEPT AS SELECT * FROM VALUES
  (10, "dept 1", "CA"),
  (20, "dept 2", "NY"),
  (30, "dept 3", "TX"),
  (40, "dept 4 - unassigned", "OR"),
  (50, "dept 5 - unassigned", "NJ"),
  (70, "dept 7", "FL")
AS DEPT(dept_id, dept_name, state);

SELECT COUNT(a) FILTER (WHERE a = 1), COUNT(b) FILTER (WHERE a > 1) FROM testData;

SELECT COUNT(id) FILTER (WHERE hiredate = to_timestamp("2001-01-01 00:00:00")) FROM emp;

SELECT COUNT(DISTINCT id), COUNT(DISTINCT id) FILTER (WHERE date_format(hiredate, "yyyy-MM-dd HH:mm:ss") = "2001-01-01 00:00:00") FROM emp;

SELECT COUNT(DISTINCT 1) FILTER (WHERE a = 1) FROM testData;

SELECT COUNT(DISTINCT 2), COUNT(DISTINCT 2,3) FILTER (WHERE dept_id = 40) FROM emp;

SELECT COUNT(DISTINCT 2), COUNT(DISTINCT 3,2) FILTER (WHERE dept_id > 0) FROM emp;

SELECT COUNT(DISTINCT id), COUNT(DISTINCT 2,3) FILTER (WHERE dept_id > 0) FROM emp;

SELECT a, COUNT(b) FILTER (WHERE a != 2) FROM testData GROUP BY b;

SELECT dept_id, SUM(salary) FILTER (WHERE hiredate > to_date("2003-01-01")) FROM emp GROUP BY dept_id;

SELECT dept_id, SUM(DISTINCT salary) FILTER (WHERE date_format(hiredate, "yyyy-MM-dd HH:mm:ss") > "2001-01-01 00:00:00") FROM emp GROUP BY dept_id;

SELECT dept_id, COUNT(id), SUM(DISTINCT salary), SUM(DISTINCT salary) FILTER (WHERE date_format(hiredate, "yyyy-MM-dd") > "2001-01-01") FROM emp GROUP BY dept_id;

SELECT 'foo', SUM(salary) FILTER (WHERE hiredate >= date "2003-01-01") FROM emp GROUP BY 1;

-- Aggregate with filter, more than one aggregate function goes with distinct.
select dept_id, count(distinct emp_name), count(distinct hiredate), sum(salary), sum(salary) filter (where id > 200) from emp group by dept_id;

select dept_id, count(distinct emp_name), count(distinct hiredate), sum(salary) filter (where salary < 400.00D), sum(salary) filter (where id + dept_id > 500) from emp group by dept_id;

select dept_id, count(distinct emp_name), count(distinct emp_name) filter (where id > 200), sum(salary) from emp group by dept_id;

select dept_id, count(distinct emp_name), count(distinct emp_name) filter (where id + dept_id > 500), sum(salary), sum(salary) filter (where id > 200) from emp group by dept_id;

select dept_id, count(distinct emp_name) filter (where id > 200), count(distinct hiredate) filter (where hiredate > date "2003-01-01"), sum(salary) filter (where salary < 400.00D) from emp group by dept_id;

select dept_id, count(distinct emp_name) filter (where id > 200), count(distinct emp_name) filter (where hiredate > date "2003-01-01"), sum(salary) from emp group by dept_id;

select dept_id, avg(distinct (id + dept_id)) filter (where id > 200), count(distinct hiredate) filter (where hiredate > date "2003-01-01"), sum(salary) filter (where salary < 400.00D) from emp group by dept_id;

select dept_id, count(distinct 1), count(distinct 1) filter (where id > 200), sum(salary) from emp group by dept_id;

-- Aggregate with filter and complex GroupBy expressions.
SELECT a + b, COUNT(b) FILTER (WHERE b >= 2) FROM testData GROUP BY a + b;

-- Aggregate with filter, foldable input and multiple distinct groups.
SELECT COUNT(DISTINCT b) FILTER (WHERE b > 0), COUNT(DISTINCT b, c) FILTER (WHERE b > 0 AND c > 2)
FROM (SELECT 1 AS a, 2 AS b, 3 AS c) GROUP BY a;

SELECT emp.dept_id,
       avg(salary),
       avg(salary) FILTER (WHERE emp.dept_id = (SELECT dept_id FROM dept LIMIT 1))
FROM emp
GROUP BY dept_id;

SELECT emp.dept_id, 
       avg(salary),
       avg(salary) FILTER (WHERE emp.dept_id IN (SELECT DISTINCT dept_id
               FROM dept))
FROM emp 
GROUP BY dept_id;

-- SPARK-47256: Wrong use of FILTER expression in aggregate functions
SELECT count(num1) FILTER (WHERE rand(int(num2)) > 1) FROM FilterExpressionTestData;

SELECT sum(num1) FILTER (WHERE nth_value(num2, 2) OVER(ORDER BY num2) > 1) FROM FilterExpressionTestData;

-- constant case
select 1, 2, sum(b) from data group by 1, 2;

-- group by a non-aggregate expression's ordinal
select a, b + 2, count(2) from data group by a, 2;

-- negative cases: ordinal out of range
select a, b from data group by -1;

-- negative case: position is an aggregate expression
select a, b, sum(b) from data group by 3;

-- negative case: star
select * from data group by a, b, 1;

-- mixed cases: group-by ordinals and aliases
select a, a AS k, count(b) from data group by k, 1;

-- can use ordinal with cube
select a, b, count(1) from data group by 1, 2 with cube;

-- can use ordinal with rollup
select a, b, count(1) from data group by 1, 2 with rollup;

select a, b, count(1) from data group by a, 2 grouping sets((1), (b), (a, 2));

select a, b, count(1) from data group by cube(-1, 2);

-- Group by ordinal on subquery with relation
SELECT (
  SELECT a FROM data LIMIT 1
) AS subq1
FROM
  VALUES (1)
GROUP BY
  1;

-- Test aggregate operator with codegen on and off.




-- Test data.
CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
(1, 1), (1, 2), (2, 1), (2, 2), (3, 1), (3, 2), (null, 1), (3, null), (null, null)
AS testData(a, b);

SELECT COUNT(a), COUNT(b) FROM testData;

SELECT COUNT(a), COUNT(b) FROM testData GROUP BY a;

-- Aggregate grouped by literals (hash aggregate).
SELECT 'foo', APPROX_COUNT_DISTINCT(a) FROM testData WHERE a = 0 GROUP BY 1;

SELECT a + 2, COUNT(b) FROM testData GROUP BY a + 1;

-- Aggregate with nulls.
SELECT SKEWNESS(a), KURTOSIS(a), MIN(a), MAX(a), AVG(a), VARIANCE(a), STDDEV(a), SUM(a), COUNT(a)
FROM testData;

SELECT k AS a, COUNT(v) FROM testDataHasSameNameWithAlias GROUP BY a;

SELECT 1 FROM (SELECT COUNT(1) FROM testData WHERE false) t;

-- SPARK-25708 HAVING without GROUP BY means global aggregate
SELECT 1 FROM range(10) HAVING true;

SET spark.sql.legacy.parser.havingWithoutGroupByAsWhere=true;

-- Test data
CREATE OR REPLACE TEMPORARY VIEW test_agg AS SELECT * FROM VALUES
  (1, true), (1, false),
  (2, true),
  (3, false), (3, null),
  (4, null), (4, null),
  (5, null), (5, true), (5, false) AS test_agg(k, v);

-- aggregates are null Filtering
SELECT every(v), some(v), any(v), bool_and(v), bool_or(v) FROM test_agg WHERE k = 5;

SELECT k, every(v) FROM test_agg GROUP BY k HAVING every(v) IS NULL;

-- input type checking Int
SELECT every(1);

-- input type checking String
SELECT every("true");

-- every/some/any aggregates/bool_and/bool_or are supported as windows expression.
SELECT k, v, every(v) OVER (PARTITION BY k ORDER BY v) FROM test_agg;

SELECT k, v, bool_and(v) OVER (PARTITION BY k ORDER BY v) FROM test_agg;

SELECT k, max(v) FROM test_agg GROUP BY k HAVING max(v) = true;

SELECT count(*) FROM test_agg WHERE count(*) + 1L > 1L;

-- SPARK-34581: Don't optimize out grouping expressions from aggregate expressions without aggregate function
SELECT not(a IS NULL), count(*) AS c
FROM testData
GROUP BY a IS NULL;

SELECT histogram_numeric(col, 3) FROM VALUES (1), (2), (3) AS tab(col);

SELECT histogram_numeric(col, 3) FROM VALUES (1D), (2D), (3D) AS tab(col);

SELECT histogram_numeric(col, 3) FROM VALUES
  (CAST(1 AS TINYINT)), (CAST(2 AS TINYINT)), (CAST(3 AS TINYINT)) AS tab(col);

SELECT histogram_numeric(col, 3) FROM VALUES
  (CAST(1 AS DECIMAL(4, 2))), (CAST(2 AS DECIMAL(4, 2))), (CAST(3 AS DECIMAL(4, 2))) AS tab(col);

SELECT histogram_numeric(col, 3) FROM VALUES (INTERVAL '12 20:4:0' DAY TO SECOND),
  (INTERVAL '12 21:4:0' DAY TO SECOND), (INTERVAL '12 22:4:0' DAY TO SECOND) AS tab(col);

SELECT histogram_numeric(col, 3)
FROM VALUES (CAST(NULL AS INT)), (CAST(NULL AS INT)), (CAST(NULL AS INT)) AS tab(col);

-- SPARK-44846: PushFoldableIntoBranches in complex grouping expressions cause bindReference error
SELECT c * 2 AS d
FROM (
         SELECT if(b > 1, 1, b) AS c
         FROM (
                  SELECT if(a < 0, 0, a) AS b
                  FROM VALUES (-1), (1), (2) AS t1(a)
              ) t2
         GROUP BY b
     ) t3
GROUP BY c;

-- STRUCT<b:MAP<INT,INT>>
SELECT count(*)
FROM VALUES (named_struct('b', map(1, 2, 2, 3))), (named_struct('b', map(1, 3))), (named_struct('b', map(2, 3, 1, 2))) as t(a)
GROUP BY a;

-- ARRAY<STRUCT<b:MAP<INT,INT>>>
SELECT count(*)
FROM VALUES (ARRAY(named_struct('b', map(1, 2, 2, 3)), named_struct('b', map(1, 3)))), (ARRAY(named_struct('b', map(2, 3)), named_struct('b', map(1, 3)))), (ARRAY(named_struct('b', map(2, 3, 1, 2)), named_struct('b', map(1, 3)))) as t(a)
group BY a;

-- ARRAY<MAP<ARRAY<INT>,INT>>
SELECT count(*)
FROM VALUES (ARRAY(map(array(1, 2), 2, array(2, 3), 3))), (ARRAY(MAP(ARRAY(1, 3), 3))), (ARRAY(map(array(2, 3), 3, array(1, 2), 2))) as t(a)
group BY a;

SELECT count(*)
FROM VALUES (named_struct('b', map(named_struct('c', 1), 2, named_struct('c', 2), 3))), (named_struct('b', map(named_struct('c', 1), 3))), (named_struct('b', map(named_struct('c', 2), 3, named_struct('c', 1), 2))) as t(a)
group BY a.b;

-- Attributes under Last, First, AnyValue can be resolved using the hidden output.
SELECT col1 FROM t1 GROUP BY ALL HAVING first(col2) = 'a';

SELECT col1 FROM t1 GROUP BY col1 HAVING EXISTS (SELECT last(t1.col2) == 0);

-- Window and generator functions as grouping keys. A window function is computed after grouping,
-- so it can never be a grouping key: it is rejected in an explicit GROUP BY, when GROUP BY ALL
-- promotes the SELECT window to a grouping key, and when a GROUP BY ordinal points at it. A
-- generator is rejected as an explicit grouping key, but a generator in the SELECT list is
-- extracted to a Generate operator evaluated after aggregation, so GROUP BY ALL / a GROUP BY
-- ordinal that points at it groups by the generator's input and stays valid. Repeated generated
-- values are therefore not collapsed.
SELECT c1, ROW_NUMBER() OVER (ORDER BY c1) AS rn FROM VALUES (1), (2) AS t(c1)
GROUP BY ALL ORDER BY c1;

SELECT explode(a) FROM VALUES (array(1, 2)), (array(3)) AS t(a) GROUP BY ALL;

-- Multiple unsupported grouping keys are reported together, in grouping-list order, and an
-- unsupported expression nested inside a larger grouping key is reported on its own.
SELECT count(*) FROM VALUES (1, array(1, 2)), (2, array(3)) AS t(c1, a)
GROUP BY ROW_NUMBER() OVER (ORDER BY c1), explode(a);

SELECT count(*) FROM VALUES (1), (2) AS t(c1) GROUP BY SUM(c1) OVER ();

SELECT c1, ROW_NUMBER() OVER (ORDER BY c1) FROM VALUES (1), (2) AS t(c1) GROUP BY 1, 2;

SELECT c1, explode(a) FROM VALUES (1, array(1, 2)), (2, array(3)) AS t(c1, a) GROUP BY ALL;

-- Unsupported grouping keys in the reverse order, inside grouping analytics, and nested deeper.
SELECT count(*) FROM VALUES (1, array(1, 2)), (2, array(3)) AS t(c1, a)
GROUP BY explode(a), ROW_NUMBER() OVER (ORDER BY c1);

CREATE TEMPORARY VIEW grouping AS SELECT * FROM VALUES
  ("1", "2", "3", 1),
  ("4", "5", "6", 1),
  ("7", "8", "9", 1)
  as grouping(a, b, c, d);

-- SPARK-17849: grouping set throws NPE #3
SELECT a, b, c, count(d) FROM grouping GROUP BY a, b, c GROUPING SETS ((c));

-- Group sets without explicit group by
SELECT c1, sum(c2) FROM (VALUES ('x', 10, 0), ('y', 20, 0)) AS t (c1, c2, c3) GROUP BY GROUPING SETS (c1);

-- Group sets without explicit group by
SELECT grouping(c1) FROM (VALUES ('x', 'a', 10), ('y', 'b', 20)) AS t (c1, c2, c3) GROUP BY GROUPING SETS (c1,c2);

-- complex expression in grouping sets
SELECT a + b, b, sum(c) FROM (VALUES (1,1,1),(2,2,2)) AS t(a,b,c) GROUP BY GROUPING SETS ( (a + b), (b + a), (b));

SELECT a, b, c, count(d) FROM grouping GROUP BY WITH CUBE;

-- Semantically identical query without GROUP BY, for comparison.
SELECT count(*) AS c FROM VALUES (1), (2), (3) AS t(k) WHERE k > 100;

-- Meaningful aggregates make the grand-total row explicit. Over empty input it is a single row of
-- NULL measures with count 0 (identical to the same query with no GROUP BY); over non-empty input
-- it carries the real totals.
SELECT sum(v) AS total, avg(v) AS mean, max(v) AS hi, count(*) AS c
FROM VALUES (10), (20), (30) AS t(v) WHERE v > 100 GROUP BY GROUPING SETS (());

-- Contrast: grouping by a real column over empty input returns no rows (no groups), whereas the
-- grand total above returns one row -- the grand-total-specific semantics this fix restores.
SELECT v, count(*) AS c FROM VALUES (10), (20), (30) AS t(v) WHERE v > 100 GROUP BY v;

-- grouping() over a grand total references a non-grouping column and is rejected.
SELECT grouping(k) FROM VALUES (1), (2), (3) AS t(k) GROUP BY GROUPING SETS (());

SELECT count(*) AS c FROM VALUES (1), (2), (3) AS t(k) HAVING grouping(k) = 0;

SELECT count(*) AS c FROM VALUES (1), (2), (3) AS t(k) GROUP BY GROUPING SETS ((), ()) HAVING grouping_id() = 0;

-- Grand total over a named relation rather than inline data in the query: the grand total reads
-- FROM a temporary view.
CREATE TEMPORARY VIEW grouping_grand_total AS
  SELECT * FROM VALUES (1, 10), (2, 20), (3, 30) AS t(k, v);

-- grouping_id() over the grand total folds to 0.
SELECT count(*) AS c, grouping_id() AS g
FROM grouping_grand_total WHERE k > 100 GROUP BY GROUPING SETS (());

SELECT grouping__id, k1, k2, avg(v) FROM (VALUES (1,1,1),(2,2,2)) AS t(k1,k2,v) GROUP BY GROUPING SETS ((k1),(k1,k2),(k2,k1));

SELECT CASE WHEN a IS NULL THEN count(b) WHEN b IS NULL THEN count(c) END
FROM grouping
GROUP BY GROUPING SETS (a, b, c);

-- Non-empty input still returns the single aggregated row.
SELECT count(*) AS c FROM VALUES (1), (2), (3) AS t(k) GROUP BY GROUPING SETS (());

-- We run these tests with fixed-point analyzer separately because for some cases with recursive
-- types, fixed-point analyzer either fails to resolve the query completely or resolves it to a
-- slightly different logical plan due to spark.sql.analyzer.singlePassResolver.preventUsingAliasesFromNonDirectChildren
-- not being set in all tests.




-- This test file contains queries that test recursive types name resolution in ORDER BY and HAVING clauses.

-- Alias type: String, Table column type: Struct
SELECT 'a' AS col1 FROM VALUES (NAMED_STRUCT('a', 1)) t (col1) GROUP BY col1 ORDER BY col1.a;

-- Alias type: Struct, Table column type: String
SELECT NAMED_STRUCT('a', 1) AS col1 FROM VALUES ('a') t (col1) GROUP BY col1 ORDER BY col1.a;

-- Alias type: Struct, Table column type: Struct
SELECT NAMED_STRUCT('a', 1) AS col1 FROM VALUES (NAMED_STRUCT('a', 0)) t (col1) GROUP BY col1 ORDER BY col1.a;

-- Alias type: String, Table column type: Array
SELECT 'a' AS col1 FROM VALUES (ARRAY(1)) t (col1) GROUP BY col1 ORDER BY col1[0];

-- Alias type: Array, Table column type: String
SELECT ARRAY(1) AS col1 FROM VALUES ('a') t (col1) GROUP BY col1 ORDER BY col1[0];

SELECT NAMED_STRUCT('a', NAMED_STRUCT('b', 1)) AS col1 FROM VALUES ('a') t (col1) GROUP BY col1 HAVING col1.a.b > 0;

SELECT ARRAY(NAMED_STRUCT('a', 1)) AS col1 FROM VALUES ('a') t (col1) GROUP BY col1 HAVING col1[0].a > 0;

SELECT 'a' AS col1 FROM VALUES (MAP('key', 1)) t (col1) GROUP BY col1 HAVING col1['key'] > 0 ORDER BY col1['key'];

-- Using ORDER BY with named_struct
SELECT named_struct('a',1) as col, col1
FROM values(named_struct('a',1))
ORDER BY col1.a;

-- Using array with HAVING
SELECT array(1, 2, 3) AS col1, col1
FROM values(array(1, 2, 3))
GROUP BY col1
HAVING col1[1] > 1;

-- Both alias and column are named the `col1`, but fields are named `a` and `b`

-- Reference to column field
SELECT NAMED_STRUCT('b', 1) AS col1 FROM VALUES (NAMED_STRUCT('a', 0)) t (col1) GROUP BY col1 ORDER BY col1.a;

-- Reference to alias field
SELECT NAMED_STRUCT('b', 1) AS col1 FROM VALUES (NAMED_STRUCT('a', 0)) t (col1) GROUP BY col1 ORDER BY col1.b;

SELECT col1.name
FROM VALUES (NAMED_STRUCT('name', 'test', 'id', 1)) t (col1)
GROUP BY col1
HAVING col1.id > 0
ORDER BY col1.name;

SELECT col1.users[0].name
FROM VALUES (
             NAMED_STRUCT('users', ARRAY(NAMED_STRUCT('name', 'John', 'age', 30)))
     ) t (col1)
GROUP BY col1
HAVING col1.users[0].age > 25
ORDER BY col1.users[0].name;

SELECT col1.data[0].props['status']
FROM VALUES (
             NAMED_STRUCT('data', ARRAY(NAMED_STRUCT('props', MAP('status', 'active'))))
     ) t (col1)
GROUP BY col1
HAVING col1.data[0].props['status'] = 'active';

create temporary view hav as select * from values
  ("one", 1),
  ("two", 2),
  ("three", 3),
  ("one", 5)
  as hav(k, v);

-- invalid having condition contains grouping column
SELECT count(k) FROM hav GROUP BY v HAVING v = array(1);

-- SPARK-31519: Cast in having aggregate expressions returns the wrong result
SELECT SUM(a) AS b, CAST('2020-01-01' AS DATE) AS fake FROM VALUES (1, 10), (2, 20) AS T(a, b) GROUP BY b HAVING b > 10;

SELECT SUM(a) AS b FROM VALUES (1, 10), (2, 20) AS T(a, b) GROUP BY ROLLUP(a, b) HAVING b > 10;

SELECT c1 FROM VALUES (1, 2) as t(c1, c2) GROUP BY ROLLUP(t.c1) HAVING t.c1 = 1;

-- SPARK-28386: Resolve ORDER BY agg function with HAVING clause, while the agg function does not present on SELECT list
SELECT k, sum(v) FROM hav GROUP BY k HAVING sum(v) > 2 ORDER BY avg(v);

SELECT sum(v) FROM hav HAVING sum(ifnull(v, 1)) = 1;

SELECT v + 1 FROM hav GROUP BY ALL HAVING avg(try_add(v, 1)) = 1;

-- HAVING condition should prefer table columns over aliases
SELECT 1 AS `2`, 2 FROM VALUES (2) t (`2`) GROUP BY `2` HAVING `2` > 2;

SELECT 2 FROM VALUES (2) t (`2`) GROUP BY `2` HAVING `2` > 2;

SELECT SUM(v) + 1 FROM hav HAVING 1 + SUM(v);

-- HAVING with outer reference to alias in outer project list
SELECT col1 AS alias
FROM values(1)
GROUP BY col1
HAVING (
    SELECT col1 = 1
);

SELECT col1 AS alias
FROM values(map('a', 1))
GROUP BY col1
HAVING (
    SELECT col1[0] = 1
);

-- Replacing Having condition with alias from below
SELECT col1, col1 AS a FROM VALUES(1) GROUP BY col1 HAVING col1 > 0;

SELECT 1 AS a, 1 / a AS b, ZEROIFNULL(SUM(col1)) FROM VALUES(1) GROUP BY 1 HAVING ZEROIFNULL(SUM(col1)) > 0;

SELECT col1 FROM VALUES(1,2) GROUP BY col1 HAVING (SELECT 1 WHERE MAX(col2) = 1) == MAX(col2);

SELECT 1 GROUP BY COALESCE(1, 1) HAVING COALESCE(1, 1) = 1  OR COALESCE(1, 1) IS NOT NULL;

SELECT col2 FROM hav_outer GROUP BY col1, col2 HAVING (SELECT col1);

SELECT col2 FROM hav_outer GROUP BY col1, col2 HAVING col2 IN (SELECT col1 + 1);

DROP VIEW hav_outer;

-- Also test functions registered with `ExpressionBuilder`.
select ceil(x -> x) as v;

-- Transform an array with index
select transform(ys, (y, i) -> y + i) as v from nested;

-- Transform a null array
select transform(cast(null as array<int>), x -> x + 1) as v;

-- Filter nested arrays
select transform(zs, z -> filter(z, zz -> zz > 50)) as v from nested;

-- Aggregate nested arrays
select transform(zs, z -> aggregate(z, 1, (acc, val) -> acc * val * size(z))) as v from nested;

select reduce(ys, (0 as sum, 0 as n), (acc, x) -> (acc.sum + x, acc.n + 1), acc -> acc.sum / acc.n) as v from nested;

-- Check for element existence
select exists(ys, y -> y > 30) as v from nested;

-- Zip with array with concat
select zip_with(array('a', 'b', 'c'), array('d', 'e', 'f'), (x, y) -> concat(x, y)) as v;

-- Identity Transform Keys in a map
select transform_keys(ys, (k, v) -> k) as v from nested;

-- Identity Transform values in a map
select transform_values(ys, (k, v) -> v) as v from nested;

-- use non reversed keywords: all is non reversed only if !ansi
select transform(ys, all -> all * all) as v from values (array(32, 97)) as t(ys);

-- HigherOrderFunctions without lambda variables

select aggregate(array(1, 2, 3), 0, 100) as aggregate_int_literal;

select aggregate(array(1, 2, 3), array(), array('result')) as aggregate_array_literal;

select array_sort(array(3, 1, 2), struct('result', 0)) as array_sort_struct_literal;

select exists(array(1, 2, 3), map('found', true)) as exists_map_literal;

select filter(array(1, 2, 3), 1) as filter_int_literal;

select filter(array(1, 2, 3), array(true, false)) as filter_array_literal;

select forall(array(1, 2, 3), struct('all', true)) as forall_struct_literal;

select map_filter(map('a', 1, 'b', 2), map('keep', true)) as map_filter_map_literal;

select map_zip_with(map('a', 1), map('a', 10), 100) as map_zipwith_int_literal;

select map_zip_with(map('a', 1), map('a', 10), array('combined')) as map_zipwith_array_literal;

select reduce(array(1, 2, 3), struct('init', 0), struct('final', 999)) as reduce_struct_literal;

select transform(array(1, 2, 3), map('key', 'value')) as transform_map_literal;

select transform_keys(map('a', 1, 'b', 2), 42) as transform_keys_int_literal;

select transform_keys(map('a', 1, 'b', 2), array('new_key')) as transform_keys_array_literal;

select transform_values(map('a', 1, 'b', 2), struct('val', 999)) as transform_values_struct_literal;

select zip_with(array(1, 2, 3), array(4, 5, 6), map('merged', true)) as zipwith_map_literal;

-- Tests for query hints.
--
-- Covers the two families of hints Spark SQL understands:
--   * Partitioning hints: COALESCE, REPARTITION, REPARTITION_BY_RANGE, REBALANCE and
--     REBALANCE_BY_SIZE. These are resolved by ResolveHints.ResolveCoalesceHints.
--   * Join strategy hints: BROADCAST, MERGE, SHUFFLE_HASH and SHUFFLE_REPLICATE_NL (with their
--     aliases). These are resolved by ResolveHints.ResolveJoinStrategyHints.
--
-- Hint names are case-insensitive. Unrecognized hints, and hints that reference a relation not
-- present in the query, are dropped during analysis (a warning is logged) and leave the plan
-- unchanged.
--
-- Adaptive query execution is enabled by default. A dedicated section near the end turns it off,
-- both to feed the EXPLAIN examples deterministic physical plans and to show that REBALANCE and
-- REBALANCE_BY_SIZE only take effect when AQE is enabled.

-- Test relations. Temp views over inline VALUES keep the analyzed plans focused on the hint nodes
-- (ResolvedHint / Repartition / RebalancePartitions) without a file-scan or warehouse-path surface.
CREATE TEMPORARY VIEW t1 AS SELECT * FROM VALUES (1, 'a'), (2, 'b'), (3, 'c') AS t1(c1, c2);

-- REPARTITION accepts a partition number, column names, or both.
SELECT /*+ REPARTITION(3) */ * FROM t1;

SELECT /*+ REPARTITION(3, c1, c2) */ * FROM t1;

SELECT /*+ REPARTITION_BY_RANGE(3, c1) */ * FROM t1;

SELECT /*+ REBALANCE(c1) */ * FROM t1;

SELECT /*+ REBALANCE_BY_SIZE('10MB') */ * FROM t1;

-- ---------------------------------------------------------------------------------------------
-- Join strategy hints
-- ---------------------------------------------------------------------------------------------

-- BROADCAST and its aliases BROADCASTJOIN and MAPJOIN.
SELECT /*+ BROADCAST(t1) */ * FROM t1 JOIN t2 ON t1.c1 = t2.c1;

-- MERGE (shuffle sort merge join) and its aliases SHUFFLE_MERGE and MERGEJOIN.
SELECT /*+ MERGE(t1) */ * FROM t1 JOIN t2 ON t1.c1 = t2.c1;

-- SHUFFLE_HASH (shuffle hash join).
SELECT /*+ SHUFFLE_HASH(t1) */ * FROM t1 JOIN t2 ON t1.c1 = t2.c1;

-- A join strategy hint may reference more than one relation.
SELECT /*+ MERGE(t1, t2) */ * FROM t1 JOIN t2 ON t1.c1 = t2.c1;

-- Not every strategy applies to every join type; BROADCAST of the right side of a LEFT JOIN is
-- allowed.
SELECT /*+ BROADCAST(t2) */ * FROM t1 LEFT JOIN t2 ON t1.c1 = t2.c1;

-- ---------------------------------------------------------------------------------------------
-- Negative and edge cases
-- ---------------------------------------------------------------------------------------------

-- COALESCE only accepts a partition number; a column name is rejected.
SELECT /*+ COALESCE(c1) */ * FROM t1;

-- REBALANCE_BY_SIZE rejects a non-positive advisory partition size.
SELECT /*+ REBALANCE_BY_SIZE(0) */ * FROM t1;

-- ---------------------------------------------------------------------------------------------
-- Optimizer and planner behavior (EXPLAIN EXTENDED)
-- ---------------------------------------------------------------------------------------------
--
-- The analyzed plans above show how hints are resolved. The queries below use EXPLAIN EXTENDED to
-- show what the optimizer and planner then do with them. AQE is turned off first so the physical
-- plans are deterministic (the same reason explain.sql disables it).
SET spark.sql.adaptive.enabled=false;

-- ---------------------------------------------------------------------------------------------
-- REBALANCE hints require adaptive query execution
-- ---------------------------------------------------------------------------------------------
--
-- AQE is still disabled from the section above. ResolveCoalesceHints only recognizes REBALANCE /
-- REBALANCE_BY_SIZE when AQE is enabled, so here the hints are dropped (a warning is logged) and
-- the plan is left unchanged -- contrast with the RebalancePartitions nodes in the partitioning
-- section above.
SELECT /*+ REBALANCE */ * FROM t1;

DROP VIEW t2;

DROP TABLE IF EXISTS hll_string_test;

CREATE TABLE hll_string_test (s STRING) USING PARQUET;

SELECT hll_sketch_estimate(hll_sketch_agg(col)) AS result FROM t1;

SELECT hll_sketch_estimate(hll_sketch_agg(s COLLATE UTF8_LCASE)) utf8_lc FROM hll_string_test;

SELECT hll_sketch_estimate(hll_sketch_agg(s COLLATE UTF8_BINARY_RTRIM)) utf8_b_rt FROM hll_string_test;

SELECT hll_sketch_estimate(hll_sketch_agg(s COLLATE UNICODE_CI_RTRIM)) unicode_ci_rt FROM hll_string_test;

SELECT hll_sketch_estimate(
  hll_union(
    hll_sketch_agg(col1),
    hll_sketch_agg(col2)))
  FROM VALUES
    (1, 4),
    (1, 4),
    (2, 5),
    (2, 5),
    (3, 6) AS tab(col1, col2);

SELECT hll_sketch_estimate(hll_union_agg(sketch, true))
    FROM (SELECT hll_sketch_agg(col) as sketch
            FROM VALUES (TIME'12:00:00'), (TIME'09:00:00') AS tab(col)
          UNION ALL
          SELECT hll_sketch_agg(col) as sketch
            FROM VALUES (TIME'12:00:00'), (TIME'17:00:00') AS tab(col));

SELECT hll_sketch_agg(col, 40)
FROM VALUES (50), (60), (60) tab(col);

SELECT hll_sketch_agg(col, '15')
FROM VALUES (50), (60), (60) tab(col);

SELECT hll_union(1, 2)
  FROM VALUES
    (1, 4),
    (1, 4),
    (2, 5),
    (2, 5),
    (3, 6) AS tab(col1, col2);

SELECT hll_union_agg(buffer, false)
FROM (SELECT CAST('abc' AS BINARY) AS buffer);

SELECT IDENTIFIER(${colname} || '_1') FROM VALUES(1) AS T(c_1);

SELECT IDENTIFIER('`t`.c1') FROM VALUES(1) AS T(c1);

SELECT IDENTIFIER('c' || '1') FROM VALUES(1) AS T(c1);

CREATE TABLE s.tab(c1 INT) USING CSV;

DELETE FROM IDENTIFIER('ta' || 'b') WHERE 1=0;

SELECT * FROM IDENTIFIER('tab');

SELECT * FROM IDENTIFIER('t' || 'a' || 'b');

DROP TABLE s.tab;

SELECT IDENTIFIER(concat('COAL', 'ESCE'))(NULL, 1);

VALUES(IDENTIFIER(abs(1)));

SELECT IDENTIFIER(array_join(transform(array('c', '1'), element -> element), ''))
FROM VALUES(1) AS T(c1);

SELECT IDENTIFIER(row_number() OVER (ORDER BY 'x')) FROM VALUES(1) AS T(c1);

SELECT * FROM IDENTIFIER(row_number() OVER (ORDER BY 'x'));

SELECT IDENTIFIER(identifier_name()) FROM VALUES(1) AS T(c1);

SELECT IDENTIFIER(persistent_identifier_name()) FROM VALUES(1) AS T(c1);

SELECT IDENTIFIER(concat('persistent_identifier_', 'function'))(1);

CREATE FUNCTION persistent_identifier_nested_name()
RETURNS STRING
RETURN persistent_identifier_base_name();

DROP FUNCTION persistent_identifier_base_name;

SELECT * FROM IDENTIFIER(identifier_relation_name());

DROP TEMPORARY FUNCTION identifier_relation_count;

DROP FUNCTION persistent_identifier_relation_name;

-- Table DDL
CREATE TABLE IDENTIFIER('tab')(c1 INT) USING CSV;

USE identifier_clauses;

CREATE TABLE IDENTIFIER('identifier_clauses.' || 'tab')(c1 INT) USING CSV;

UNCACHE TABLE IDENTIFIER('ta' || 'b');

CREATE TABLE tab(c1 INT) USING CSV;

DESCRIBE IDENTIFIER('ta' || 'b');

SHOW TBLPROPERTIES IDENTIFIER('ta' || 'b');

REFRESH TABLE IDENTIFIER('ta' || 'b');

DROP TABLE IF EXISTS tab;

ALTER VIEW IDENTIFIER('v') AS VALUES(2);

-- Schema
CREATE SCHEMA IDENTIFIER('id' || 'ent');

COMMENT ON SCHEMA IDENTIFIER('id' || 'ent') IS 'some comment';

SHOW TABLE EXTENDED IN IDENTIFIER('id' || 'ent') LIKE 'hello';

USE SCHEMA IDENTIFIER('id' || 'ent');

CREATE FUNCTION IDENTIFIER('ident.' || 'myDoubleAvg') AS 'test.org.apache.spark.sql.MyDoubleAvg';

DROP FUNCTION IDENTIFIER('ident.' || 'myDoubleAvg');

DROP TEMPORARY FUNCTION IDENTIFIER('my' || 'DoubleAvg');

SET VAR var = 'c1';

DROP TABLE IDENTIFIER(var || 'table');

VALUES(IDENTIFIER(CAST(NULL AS STRING)));

SELECT `IDENTIFIER`('abs')(c1) FROM VALUES(-1) AS T(c1);

SELECT * FROM IDENTIFIER((SELECT 't'));

SELECT * FROM (SELECT IDENTIFIER((SELECT 'col1')) FROM IDENTIFIER((SELECT 't')));

SELECT IDENTIFIER((SELECT 'col1', 'col2')) FROM VALUES(1,2);

CREATE TABLE IDENTIFIER('a.b.c')(c1 INT) USING csv;

DROP VIEW IDENTIFIER('a.b.c');

VALUES(IDENTIFIER('a.b.c.d')());

CREATE TEMPORARY VIEW IDENTIFIER('default.v')(c1) AS VALUES(1);

create table identifier('t2') using csv as (select my_col from (values (1), (2), (1) as (my_col)) group by 1);

DECLARE col = 'c1';

WITH S(c1, c2) AS (VALUES(1, 2), (2, 3)),
     T(c1, c2) AS (VALUES ('a', 'b'), ('c', 'd'))
SELECT IDENTIFIER('max')(IDENTIFIER('c1')) FROM IDENTIFIER('T');

SELECT T1.c1 FROM VALUES(1) AS T1(c1) JOIN VALUES(1) AS T2(c1) USING (IDENTIFIER('c1'));

SELECT named_struct('a', 1).IDENTIFIER('a') FROM VALUES(1) AS T(c1);

SELECT * FROM IDENTIFIER('s').tab;

SELECT 1 AS IDENTIFIER('col1');

CREATE OR REPLACE VIEW v(IDENTIFIER('c1')) AS VALUES(1);

CREATE TABLE tab(IDENTIFIER('c1') INT) USING CSV;

SELECT col1 FROM tab;

ALTER TABLE IDENTIFIER('tab') DROP COLUMN IDENTIFIER('c2');

DROP TABLE IF EXISTS tab_renamed;

-- Identifier-lite: table alias with qualified name should error (table alias must be single)
SELECT * FROM VALUES (1, 2) AS IDENTIFIER('schema.table')(c1, c2);

USE identifier_clause_test_schema;

SHOW PARTITIONS IDENTIFIER('test_show');

-- SET CATALOG with identifier-lite
-- SET CATALOG IDENTIFIER('spark_catalog');

-- DESCRIBE with different forms
CREATE TABLE test_desc(c1 INT) USING CSV;

DESCRIBE EXTENDED IDENTIFIER('test_desc');

-- COMMENT ON COLUMN with identifier-lite
CREATE TABLE test_comment(c1 INT, c2 STRING) USING CSV;

COMMENT ON TABLE IDENTIFIER('test_comment') COLUMN (c1 IS 'c1 comment', c2 IS 'c2 comment');

ANALYZE TABLE IDENTIFIER('identifier_clause_test_schema.test_table') COMPUTE STATISTICS;

SHOW COLUMNS FROM IDENTIFIER('identifier_clause_test_schema.test_table');

SET VAR IDENTIFIER('my_var') = 'new_value';

-- SQL UDF with identifier-lite in parameter names and return statement
CREATE TEMPORARY FUNCTION test_udf(IDENTIFIER('param1') INT, IDENTIFIER('param2') STRING)
RETURNS INT
RETURN IDENTIFIER('param1') + length(IDENTIFIER('param2'));

-- SQL UDF with table return type using identifier-lite
CREATE TEMPORARY FUNCTION test_table_udf(IDENTIFIER('input_val') INT)
RETURNS TABLE(IDENTIFIER('col1') INT, IDENTIFIER('col2') STRING)
RETURN SELECT IDENTIFIER('input_val'), 'result';

-- Integration tests: Combining parameter markers, string coalescing, and IDENTIFIER
-- These tests demonstrate the power of combining IDENTIFIER with parameters

-- Test 1: IDENTIFIER with parameter marker for table name
EXECUTE IMMEDIATE 'SELECT IDENTIFIER(:tab \'b\').c1 FROM VALUES(1) AS tab(c1)' USING 'ta' AS tab;

INSERT INTO integration_test VALUES (1, 'a'), (2, 'b');

-- Test 5: IDENTIFIER in WHERE clause with parameters
EXECUTE IMMEDIATE 'SELECT * FROM integration_test WHERE IDENTIFIER(:col) = :val'
  USING 'c1' AS col, 1 AS val;

EXECUTE IMMEDIATE 'SELECT t1.*, t2.* FROM IDENTIFIER(:t1) t1 JOIN IDENTIFIER(:t2) t2 USING (IDENTIFIER(:col)) ORDER BY ALL'
  USING 'integration_test' AS t1, 'integration_test2' AS t2, 'c1' AS col;

-- Test 9: IDENTIFIER in ORDER BY with multiple parameters
EXECUTE IMMEDIATE 'SELECT * FROM integration_test ORDER BY IDENTIFIER(:col1) DESC, IDENTIFIER(:col2)'
  USING 'c1' AS col1, 'c2' AS col2;

-- Test 12: IDENTIFIER in CTE name with parameter
EXECUTE IMMEDIATE 'WITH IDENTIFIER(:cte_name)(c1) AS (VALUES(1)) SELECT c1 FROM IDENTIFIER(:cte_name)'
  USING 'my_cte' AS cte_name;

DROP VIEW test_view;

-- Test 15: IDENTIFIER with dereference using parameters
EXECUTE IMMEDIATE 'SELECT map(:key, :val).IDENTIFIER(:key) AS result'
  USING 'mykey' AS key, 42 AS val;

-- Test 19: IDENTIFIER with qualified name coalescing for schema.table.column pattern
-- This should work for multi-part identifiers
EXECUTE IMMEDIATE 'SELECT * FROM IDENTIFIER(:schema ''.'' :table) WHERE IDENTIFIER(concat(:tab_alias, ''.c1'')) > 0 ORDER BY ALL'
  USING 'identifier_clause_test_schema' AS schema, 'integration_test' AS table, 'integration_test' AS tab_alias;

DROP TABLE integration_test2;

SELECT * FROM lateral_test LATERAL VIEW explode(arr) IDENTIFIER('tbl') AS IDENTIFIER('col') ORDER BY ALL;

-- UNPIVOT with IDENTIFIER() for value column alias
CREATE TABLE unpivot_test(id INT, a INT, b INT, c INT) USING CSV;

SELECT * FROM unpivot_test UNPIVOT ((v1, v2) FOR col IN ((a, b) AS IDENTIFIER('cols_ab'), (b, c) AS IDENTIFIER('cols_bc'))) ORDER BY ALL;

DESCRIBE describe_col_test IDENTIFIER('c1');

-- All the following tests fail because they are not about "true" identifiers

-- This should fail - named parameters don't support IDENTIFIER()
SELECT :IDENTIFIER('param1') FROM VALUES(1) AS T(c1);

SELECT /*+ IDENTIFIER('BROADCAST')(hint_test) */ * FROM hint_test;

-- These should fail - function scope doesn't support IDENTIFIER()
SHOW IDENTIFIER('USER') FUNCTIONS;

DROP SCHEMA identifier_clause_test_schema;

CREATE OR REPLACE TEMPORARY VIEW identifier_var_view AS
SELECT * FROM IDENTIFIER(identifier_var_name);

DROP VIEW identifier_var_target;

DECLARE OR REPLACE VARIABLE identifier_perm_name STRING DEFAULT 'identifier_perm_target';

DROP TEMPORARY VARIABLE identifier_perm_name;

CREATE TABLE identifier_alter_target (c1 INT) USING parquet;

ALTER VIEW identifier_alter_view AS SELECT * FROM IDENTIFIER(identifier_alter_name);

DROP TABLE identifier_alter_target;

-- ALTER VIEW whose TARGET is picked by a variable, with a body that has no temp dependency, must
-- still succeed: the variable is not a dependency of the view definition.
CREATE SCHEMA ivt_schema;

DECLARE OR REPLACE VARIABLE ivt_name STRING DEFAULT 'ivt_target';

DROP VIEW ivt_target;

-- A temporary view whose body reads a variable via an IDENTIFIER clause in expression position
-- (here as a column name). Unlike the table-position case above, this identifier expression
-- resolves to a bare variable reference, so recording it requires visiting the root of the
-- expression tree. If it is not recorded, the variable is missing from the view's referred-variable
-- metadata (the stored view text still names it via IDENTIFIER), so view-context re-analysis cannot
-- resolve the reference and reading the view back fails.
DECLARE OR REPLACE VARIABLE identifier_expr_col STRING DEFAULT 'c1';

DROP VIEW identifier_expr_view;

CREATE OR REPLACE GLOBAL TEMPORARY VIEW identifier_gtv_view AS
SELECT IDENTIFIER(identifier_gtv_col) AS x FROM VALUES(1) AS t(c1);

DROP TEMPORARY VARIABLE identifier_gtv_col;

SELECT * FROM identifier_named_view;

-- When both the NAME and the BODY use an IDENTIFIER clause, only the body variable is a dependency
-- of the view; the name variable must not be recorded.
DECLARE OR REPLACE VARIABLE identifier_name_part STRING DEFAULT 'identifier_named_view2';

SELECT * FROM identifier_named_view2;

DROP TEMPORARY VARIABLE identifier_body_part;

DECLARE OR REPLACE VARIABLE identifier_perm_view_name STRING DEFAULT 'identifier_named_perm_view';

DROP VIEW identifier_named_perm_view;

-- ALTER VIEW honors `spark.sql.legacy.allowSessionVariableInPersistedView` just like CREATE VIEW:
-- with it set, the DDL is allowed instead of rejected (the legacy permissive behavior). The flag
-- does not persist the variable into the stored view, so the view is not guaranteed to resolve in a
-- fresh session; the default (tested by `identifier_alter_view` above) rejects it outright.
SET spark.sql.legacy.allowSessionVariableInPersistedView=true;

ALTER VIEW identifier_p2a_view AS SELECT IDENTIFIER(identifier_p2a_col) FROM VALUES(1) AS t(c1);

SET spark.sql.legacy.allowSessionVariableInPersistedView=false;

CREATE OR REPLACE TEMPORARY VIEW identifier_nested_outer AS
SELECT x FROM identifier_nested_inner;

DROP VIEW identifier_nested_inner;

DECLARE OR REPLACE VARIABLE identifier_fn_var STRING DEFAULT 'identifier_fn_target';

SELECT * FROM identifier_fn_view;

DROP VIEW identifier_fn_target;

DECLARE OR REPLACE VARIABLE identifier_talter_col STRING DEFAULT 'c1';

DROP VIEW identifier_talter_view;

CACHE TABLE identifier_cache_view AS
SELECT IDENTIFIER(identifier_cache_col) AS x FROM VALUES(1) AS t(c1);

DROP TEMPORARY VARIABLE identifier_cache_col;

SELECT * FROM identifier_cache_named;

-- A persisted CREATE VIEW must reject a session variable read via an IDENTIFIER clause even when it
-- appears only inside a scalar subquery. The variable is absent from the analyzed plan, so the
-- recorded set (not a scan of the plan) is what the validator must consult; otherwise the view is
-- wrongly created and stores text that cannot be resolved on read.
DECLARE OR REPLACE VARIABLE identifier_subq_col STRING DEFAULT 'c1';

-- A SQL function named through IDENTIFIER(<variable>) is subject to the same operator restrictions
-- as a direct call, in an aggregate select list, a grouping expression, and a join condition.
CREATE TEMPORARY FUNCTION identifier_sql_function(arg1 STRING) RETURNS STRING
RETURN arg1 || 'blah';

SELECT count(*) FROM VALUES ('b'), ('a') GROUP BY IDENTIFIER(identifier_sql_function_name)(col1);

SELECT col1 FROM VALUES ('b'), ('a') GROUP BY col1
HAVING IDENTIFIER(identifier_sql_function_name)(col1) = 'ablah';

SELECT col1, row_number() OVER (
  PARTITION BY IDENTIFIER(identifier_sql_function_name)(col1) ORDER BY col1) AS rn
FROM VALUES ('b'), ('a');

SELECT IDENTIFIER(identifier_sql_function_name || '')(col1) FROM VALUES ('b'), ('a') GROUP BY col1;

SET VAR identifier_builtin_function_name = 'max';

SELECT count(*) FROM VALUES (array(1, 2)) AS t(a)
GROUP BY IDENTIFIER(identifier_builtin_function_name)(a);

DROP TEMPORARY FUNCTION identifier_sql_function;

SELECT company FROM ilike_all_table WHERE company ILIKE ALL ('%oO%', '%Go%');

-- Mix test with constant pattern and column value
SELECT company FROM ilike_all_table WHERE company ILIKE ALL ('%oo%', pat);

SELECT company FROM ilike_all_table WHERE company NOT ILIKE ALL ('%oo%', 'fA%');

SELECT company FROM ilike_all_table WHERE company NOT ILIKE ALL ('%Oo%', NULL);

-- negative case
SELECT company FROM ilike_any_table WHERE company ILIKE ALL ();

SELECT company FROM ilike_any_table WHERE company ILIKE ANY ('microsoft', '%yoo%');

-- not ilike any test
SELECT company FROM ilike_any_table WHERE company NOT ILIKE ANY ('%oO%', '%iN', 'fa%');

SELECT company FROM ilike_any_table WHERE NOT company ILIKE ANY ('%OO%', 'fa%');

SELECT company FROM ilike_any_table WHERE company ILIKE ANY (NULL, NULL);

-- test cases for ilike

-- null handling
select null ilike 'a';

-- simple patterns
select 'a' ilike 'a';

select 'abdef' ilike 'aBdef';

select 'abC' ilike 'a%';

select 'A' ilike '';

select ilike('\\\__', '%\\%\%');

select 'a€AA' ilike '_\u20AC_a';

-- escape char
select 'Addb' ilike 'a%#%b' escape '#';

select 'a_%b' ilike 'a%+%B' escape '+';

-- single row
select * from values ("one", 1) as data(a, b);

-- null type
select * from values ("one", null), ("two", null) as data(a, b);

-- expressions with alias
select * from values ("one", 1 as one) as data(a, b);

-- decimal and double coercion
select * from values ("one", 2.0), ("two", 3.0D) as data(a, b);

-- error reporting: types that are incompatible
select * from values ("one", array(0, 1)), ("two", struct(1, 2)) as data(a, b);

-- error reporting: aggregate expression
select * from values ("one", count(1)), ("two", 2) as data(a, b);

select * from values (try_divide(5, 0));

-- current_timestamp() should be kept as tempResolved inline expression.
select count(distinct ct) from values current_timestamp(), current_timestamp() as data(ct);

-- aliased expressions without table alias
select * from values (1 as a, 2 as b);

-- foldable expressions next to non-foldable expressions
select a, b is not null from values (1 + 1, rand()), (cast('3' as int), rand()) as data(a, b);

-- error reporting: EXISTS subquery
select * from values (exists (select 1), rand()) as data(a, b);

CREATE TEMPORARY VIEW t2 AS SELECT * FROM VALUES (1) AS GROUPING(a);

CREATE TEMPORARY VIEW ta AS
SELECT a, 'a' AS tag FROM t1
UNION ALL
SELECT a, 'b' AS tag FROM t2;

CREATE TEMPORARY VIEW tab1 AS SELECT * FROM VALUES
    (1, 2), 
    (1, 2),
    (1, 3),
    (1, 3),
    (2, 3),
    (null, null),
    (null, null)
    AS tab1(k, v);

-- INTERSECT ALL same table in both branches
SELECT * FROM tab1
INTERSECT ALL
SELECT * FROM tab1 WHERE k = 1;

-- Type Coerced INTERSECT ALL
SELECT * FROM tab1
INTERSECT ALL
SELECT CAST(1 AS BIGINT), CAST(2 AS BIGINT);

-- Basic
SELECT * FROM tab2
INTERSECT ALL
SELECT * FROM tab1
INTERSECT ALL
SELECT * FROM tab2;

-- test use parenthesis to control order of evaluation
(
  (
    (
      SELECT * FROM tab1
      EXCEPT
      SELECT * FROM tab2
    )
    EXCEPT
    SELECT * FROM tab1
  )
  INTERSECT ALL
  SELECT * FROM tab2
);

-- Group by under intersect all
SELECT v FROM tab1 GROUP BY v
INTERSECT ALL
SELECT k FROM tab2 GROUP BY k;

SELECT * FROM tab1
EXCEPT
SELECT * FROM tab2
UNION ALL
SELECT * FROM tab1
INTERSECT
SELECT * FROM tab2;

SELECT t.v FROM (
  SELECT v FROM tab3
  INTERSECT
  SELECT v + v AS v FROM tab3
) t;

select interval 4 month 2 weeks 3 microseconds * 1.5;

select (timestamp'2019-10-15' - timestamp'2019-10-14') / 1.5;

select interval 2147483647 day * 2;

select interval 2 second / '2';

select interval 2 second * 'a';

select interval 2 year / 'a';

select 'a' * interval 2 second;

select '2' / interval 2 year;

select interval '2 seconds' * null;

select interval '2' year / null;

-- invalid: divide by interval
select 2 / interval '2' year;

select null / interval '2' hour;

select -interval '-1 day 1 hour -1 minute 1 second';

select -interval -1 day 1 hour -1 minute 1 second;

select +interval '-1 day 1 hour -1 minute 1 second';

select +interval -1 day 1 hour -1 minute 1 second;

select interval +'-1-1' year to month;

select interval -'-1 2:3:4.001' day to second;

select interval -'11' month;

select interval -'-1' day;

select interval -'59' minute;

select interval -'-59' second;

select make_interval(1, 2, 3);

select make_interval(1, 2, 3, 4, 5, 6);

select make_interval(0, 0, 0, 0, 0, 0, 1234567890123456789);

select make_dt_interval(1, 2, 3);

select make_dt_interval(2147483647);

select make_ym_interval(0, 1);

select make_ym_interval(-178956970, -8);

select cast('+1 second' as interval);

select cast('-     1 second' as interval);

-- interval literal
select interval 13.123456789 seconds, interval -13.123456789 second;

select interval 4 day 5 hour 6 minute 7 seconds;

select interval '30' year '25' month;

select interval '0 0:0:0' day to second;

select interval '20 15' day to hour;

select interval '15:40' hour to minute;

select interval '40:32' minute to second;

-- invalid day-time string intervals
select interval '20 15:40:32.99899999' day to hour;

select interval '15:40.99899999' hour to second;

-- ns is not supported
select interval 10 nanoseconds;

select map(1, interval 1 year, 2, interval 2 month);

select map(1, interval 2 millisecond, 3, interval 3 microsecond);

SELECT interval 'interval 2 weeks 2 days 1 hour 3 minutes 2 seconds 100 millisecond 200 microseconds';

select interval 1 year to month;

select interval '10-9' year to month '12:11:10' hour to second;

select interval 1 year '12:11:10' hour to second;

select interval (-30) day;

select interval (-30) days;

SELECT INTERVAL '178956970-7' YEAR TO MONTH;

SELECT INTERVAL -'178956970-8' YEAR TO MONTH;

select
  interval '2' year + null,
  interval '2' year - null,
  interval '2' hour + null,
  interval '2' hour - null,
  null + interval '2' year,
  null - interval '2' year,
  null + interval '2' hour,
  null - interval '2' hour;

select '4 11:11' - interval '4 22:12' day to minute;

select interval '2' year + str from interval_view;

select str + interval '4 22:12' day to minute from interval_view;

select interval '2-2' year to month - interval '3' day;

select 1 + interval '2' month;

-- control characters as white spaces
select interval '\t interval 1 day';

select interval '1\t' day;

select interval '-\t2-2\t' year to month;

select interval '中文 interval 1 day';

-- interval overflow: if (ansi) exception else NULL
select -(a) from values (interval '-2147483648 months', interval '2147483647 months') t(a, b);

select a * 1.1 from values (interval '-2147483648 months', interval '2147483647 months') t(a, b);

SELECT
  from_json('{"a":"1 days"}', 'a interval'),
  from_csv('1, 1', 'a INT, b interval year'),
  to_json(from_json('{"a":"1 days"}', 'a interval')),
  to_csv(from_csv('1, 1', 'a INT, b interval year')),
  to_csv(named_struct('a', interval 32 year, 'b', interval 10 month)),
  from_csv(to_csv(named_struct('a', interval 32 year, 'b', interval 10 month)), 'a interval year, b interval month');

select interval '+';

select interval '1.2';

select interval '1 day 1';

select interval '-\t 1' day;

SELECT (INTERVAL '-178956970-8' YEAR TO MONTH) / -1;

SELECT (INTERVAL '-178956970-8' YEAR TO MONTH) / -1.0D;

SELECT (INTERVAL '-106751991 04:00:54.775808' DAY TO SECOND) / -1;

SELECT (INTERVAL '-106751991 04:00:54.775808' DAY TO SECOND) / -1.0D;

SELECT INTERVAL '106751991 04:00:54.775807' DAY TO SECOND;

SELECT INTERVAL '153722867280:54.775807' MINUTE TO SECOND;

SELECT INTERVAL '-106751991 04:00:54.775808' DAY TO SECOND;

SELECT INTERVAL '-153722867280:54.775808' MINUTE TO SECOND;

SELECT INTERVAL '2562047789:00' HOUR TO MINUTE;

SELECT INTERVAL '-153722867281:54.775808' MINUTE TO SECOND;

SELECT INTERVAL '2147483647' MONTH;

SELECT INTERVAL '-106751991' DAY;

SELECT INTERVAL '153722867280' MINUTE;

SELECT INTERVAL '-54.775807' SECOND;

SELECT INTERVAL '1' YEAR < INTERVAL '1' MONTH;

-- compare interval with string
SELECT INTERVAL '1' DAY < '1';

SELECT '1' < INTERVAL '1' DAY;

SELECT INTERVAL '1' YEAR < '1';

SELECT '1' < INTERVAL '1' YEAR;

SELECT array(INTERVAL '1' YEAR, INTERVAL '1' MONTH);

SELECT coalesce(INTERVAL '1' YEAR, INTERVAL '1' MONTH);

SELECT abs(INTERVAL '-10' YEAR);

SELECT div(INTERVAL '1-1' YEAR TO MONTH, INTERVAL '-1' MONTH);

SELECT div(INTERVAL '1' MONTH, INTERVAL '-1' DAY);

SELECT signum(INTERVAL '0-0' YEAR TO MONTH);

SELECT signum(INTERVAL '0 0:0:0' DAY TO SECOND);

SELECT width_bucket(INTERVAL '0' DAY, INTERVAL '0' DAY, INTERVAL '10' DAY, 10);

-- FVT Category 7: ASOF JOIN container integration (FVT-ASOF-7-*)



-- Run with codegen on and off.




CREATE OR REPLACE TEMP VIEW trades(trade_time, symbol, quantity) AS
  VALUES (TIMESTAMP '2026-06-29 10:00:05', 'AAPL', 100),
         (TIMESTAMP '2026-06-29 10:00:11', 'AAPL', 200),
         (TIMESTAMP '2026-06-29 10:00:12', 'MSFT',  50),
         (TIMESTAMP '2026-06-29 09:59:59', 'GOOG',  30);

SELECT count(*) AS cnt FROM asof_matched_v;

CREATE TABLE asof_perm_trades USING parquet AS SELECT * FROM trades;

SELECT count(*) AS cnt FROM asof_perm_v;

-- FVT-ASOF-7-006: scalar SQL UDF wrapping ASOF count
CREATE OR REPLACE FUNCTION asof_match_count() RETURNS INT RETURN (
  SELECT count(*)
  FROM asof_perm_trades t ASOF JOIN asof_perm_quotes q
    MATCH_CONDITION (t.trade_time >= q.quote_time)
    ON t.symbol = q.symbol
);

SELECT count(*) AS cnt FROM asof_matches();

SELECT count(*) AS cnt FROM asof_ctas_tgt;

INSERT INTO asof_insert_tgt
SELECT t.trade_time, t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT Category 6: ASOF JOIN query-context integration (FVT-ASOF-6-*)



-- Run with codegen on and off.




CREATE OR REPLACE TEMP VIEW trades(trade_time, symbol, quantity) AS
  VALUES (TIMESTAMP '2026-06-29 10:00:05', 'AAPL', 100),
         (TIMESTAMP '2026-06-29 10:00:11', 'AAPL', 200),
         (TIMESTAMP '2026-06-29 10:00:12', 'MSFT',  50),
         (TIMESTAMP '2026-06-29 09:59:59', 'GOOG',  30);

-- FVT-ASOF-6-001: WHERE after ASOF
SELECT t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
WHERE q.bid_price > 200
ORDER BY t.symbol;

-- FVT-ASOF-6-004: HAVING after GROUP BY
SELECT t.symbol, count(*) AS cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
GROUP BY t.symbol
HAVING count(*) > 1
ORDER BY t.symbol;

-- FVT-ASOF-6-007: QUALIFY on ASOF result
SELECT t.trade_time, t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
QUALIFY row_number() OVER (PARTITION BY t.symbol ORDER BY t.trade_time DESC) = 1
ORDER BY t.symbol;

-- FVT-ASOF-6-010: table aliasing on right
SELECT t.trade_time, x.bid_price
FROM trades t ASOF JOIN quotes AS x
  MATCH_CONDITION (t.trade_time >= x.quote_time)
  ON t.symbol = x.symbol
ORDER BY t.trade_time;

-- FVT-ASOF-6-013: IN subquery from ASOF
SELECT symbol, bid_price
FROM quotes
WHERE bid_price IN (
  SELECT q.bid_price
  FROM trades t ASOF JOIN quotes q
    MATCH_CONDITION (t.trade_time >= q.quote_time)
    ON t.symbol = q.symbol
)
ORDER BY symbol, bid_price;

-- FVT-ASOF-6-016: EXCEPT
SELECT t.symbol
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
EXCEPT
SELECT 'GOOG';

-- FVT-ASOF-6-019: UNPIVOT on ASOF result
SELECT symbol, hour_bucket, bid_price
FROM (
  SELECT t.symbol,
         CASE WHEN extract(hour FROM q.quote_time) = 10 THEN q.bid_price END AS hour_10
  FROM trades t ASOF JOIN quotes q
    MATCH_CONDITION (t.trade_time >= q.quote_time)
    ON t.symbol = q.symbol
) src
UNPIVOT (bid_price FOR hour_bucket IN (hour_10))
ORDER BY symbol, hour_bucket;

-- FVT-ASOF-5-002: empty right, LEFT
SELECT count(*) AS cnt
FROM trades t LEFT ASOF JOIN (SELECT * FROM quotes WHERE 1 = 0) q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-5-005: both empty
SELECT count(*) AS inner_cnt
FROM (SELECT * FROM trades WHERE 1 = 0) t ASOF JOIN (SELECT * FROM quotes WHERE 1 = 0) q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-5-007: single-row both sides, non-matching
SELECT count(*) AS inner_cnt
FROM VALUES (TIMESTAMP '2026-06-29 08:00:00', 1) AS t(ts, k) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 09:00:00', 42) AS r(ts, v)
  MATCH_CONDITION (t.ts >= r.ts);

SELECT count(*) AS left_cnt
FROM (SELECT CAST(NULL AS TIMESTAMP) AS trade_time, symbol, quantity FROM trades) t LEFT ASOF JOIN
     quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-5-010: duplicate right rows at exact match boundary
SELECT count(*) AS cnt
FROM VALUES (TIMESTAMP '2026-06-29 10:00:10', 'AAPL') AS t(trade_time, symbol) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 10:00:10', 'AAPL', 1.0),
            (TIMESTAMP '2026-06-29 10:00:10', 'AAPL', 2.0) AS q(quote_time, symbol, bid_price)
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  USING (symbol);

-- FVT-ASOF-5-013: dense right — every left row matches
SELECT count(*) AS cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-5-015: single right row per equi-key
SELECT t.symbol, q.bid_price
FROM trades t ASOF JOIN
     (SELECT quote_time, symbol, bid_price FROM quotes WHERE symbol = 'MSFT') q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
ORDER BY t.trade_time;

-- FVT-ASOF-9-001: two ASOF JOINs chained
SELECT t.symbol, q.bid_price, q2.bid_price AS earlier_bid
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
ASOF JOIN quotes q2
  MATCH_CONDITION (q.quote_time >= q2.quote_time)
  ON q.symbol = q2.symbol AND q2.bid_price < q.bid_price
WHERE t.symbol = 'AAPL'
ORDER BY t.trade_time;

-- FVT-ASOF-9-004: regular JOIN inside ASOF right side
SELECT t.symbol, qs.bid_price, qs.sector
FROM trades t ASOF JOIN (
  SELECT q.quote_time, q.symbol, q.bid_price, s.sector
  FROM quotes q
  INNER JOIN VALUES ('AAPL', 'Tech'), ('MSFT', 'Tech') AS s(symbol, sector)
    ON q.symbol = s.symbol
) qs
  MATCH_CONDITION (t.trade_time >= qs.quote_time)
  ON t.symbol = qs.symbol
ORDER BY t.trade_time;

-- FVT-ASOF-9-007: session variable in MATCH_CONDITION operand
DECLARE v_offset INTERVAL DAY TO SECOND;

-- FVT-ASOF-9-008: parameter marker via EXECUTE IMMEDIATE
EXECUTE IMMEDIATE
  'SELECT count(*) AS cnt FROM trades t ASOF JOIN quotes q
     MATCH_CONDITION (t.trade_time >= q.quote_time + ?)
     ON t.symbol = q.symbol'
USING INTERVAL 1 HOUR;

-- FVT Category 4: ASOF JOIN data type coverage (FVT-ASOF-4-*)



-- Run with codegen on and off.




CREATE OR REPLACE TEMP VIEW deploys(deploy_ts, seq, service, version) AS
  VALUES (TIMESTAMP '2026-06-29 10:00:00', 1, 'api', 'v1.0'),
         (TIMESTAMP '2026-06-29 10:00:00', 2, 'api', 'v1.1'),
         (TIMESTAMP '2026-06-29 10:05:00', 1, 'api', 'v1.2');

-- FVT-ASOF-4-002: TIMESTAMP anchor — covered by trades/quotes in categories 1-3

-- FVT-ASOF-4-003: TIMESTAMP_NTZ operand
SELECT t.ts, r.ts AS matched_ts
FROM VALUES (TIMESTAMP_NTZ '2026-06-29 10:00:00') AS t(ts) ASOF JOIN
     VALUES (TIMESTAMP_NTZ '2026-06-29 09:00:00') AS r(ts)
  MATCH_CONDITION (t.ts >= r.ts);

-- FVT-ASOF-4-004b: SMALLINT operand
SELECT t.k, r.k AS matched_k
FROM VALUES (CAST(10 AS SMALLINT)) AS t(k) ASOF JOIN VALUES (CAST(5 AS SMALLINT)) AS r(k)
  MATCH_CONDITION (t.k >= r.k);

-- FVT-ASOF-4-006: DOUBLE operand
SELECT t.k, r.k AS matched_k
FROM VALUES (CAST(10.0 AS DOUBLE)) AS t(k) ASOF JOIN
     VALUES (CAST(5.0 AS DOUBLE)), (CAST(7.0 AS DOUBLE)) AS r(k)
  MATCH_CONDITION (t.k >= r.k);

-- FVT-ASOF-4-009: INTERVAL YEAR TO MONTH operand
SELECT t.iv, r.iv AS matched_iv
FROM VALUES (INTERVAL '2-0' YEAR TO MONTH) AS t(iv) ASOF JOIN
     VALUES (INTERVAL '1-0' YEAR TO MONTH), (INTERVAL '1-6' YEAR TO MONTH) AS r(iv)
  MATCH_CONDITION (t.iv >= r.iv);

-- FVT-ASOF-4-012: nested whole STRUCT column MATCH_CONDITION
SELECT r.k.tag, r.k.inner_seq
FROM VALUES (named_struct(
  'inner_ts', TIMESTAMP '2026-06-29 10:00:00',
  'inner_seq', 2,
  'tag', 'a')) AS t(k)
ASOF JOIN (
  SELECT * FROM VALUES
    (named_struct(
      'inner_ts', TIMESTAMP '2026-06-29 09:00:00',
      'inner_seq', 1,
      'tag', 'a')),
    (named_struct(
      'inner_ts', TIMESTAMP '2026-06-29 10:00:00',
      'inner_seq', 1,
      'tag', 'a')) AS r(k)
) r
  MATCH_CONDITION (t.k >= r.k);

-- FVT-ASOF-4-012c: empty STRUCT operands (SPARK-59749); two empty structs are equal
SELECT t.id, r.tag AS matched
FROM VALUES (1, named_struct()) AS t(id, k) ASOF JOIN
     VALUES (named_struct(), 'hit') AS r(k, tag)
  MATCH_CONDITION (t.k >= r.k);

-- FVT-ASOF-4-015: coercion DATE vs TIMESTAMP
SELECT t.d, r.ts AS matched_ts
FROM VALUES (DATE '2026-06-29') AS t(d) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 10:00:00'), (TIMESTAMP '2026-06-28 08:00:00') AS r(ts)
  MATCH_CONDITION (t.d >= r.ts);

SELECT l.id, r.id
FROM VALUES
  (TIMESTAMP_LTZ '2024-03-10 10:05:00Z', 1),
  (TIMESTAMP_LTZ '2024-03-10 10:55:00Z', 2) AS l(ts, id)
LEFT ASOF JOIN VALUES
  (TIMESTAMP_NTZ '2024-03-10 02:50:00', 1),
  (TIMESTAMP_NTZ '2024-03-10 03:00:00', 2),
  (TIMESTAMP_NTZ '2024-03-10 03:15:00', 3) AS r(ts, id)
MATCH_CONDITION (l.ts >= r.ts);

-- FVT-ASOF-4-016a: coercion DATE vs STRING (SPARK-59527), coerced like the >= operator
SELECT t.d, r.s AS matched_s
FROM VALUES (DATE '2026-06-29') AS t(d) ASOF JOIN
     VALUES ('2026-06-28'), ('2026-06-29') AS r(s)
  MATCH_CONDITION (t.d >= r.s);

-- FVT-ASOF-4-016d: coercion STRING vs DATE with the string on the left (SPARK-59527)
SELECT t.s, r.d AS matched_d
FROM VALUES ('2026-06-29') AS t(s) ASOF JOIN
     VALUES (DATE '2026-06-28'), (DATE '2026-06-29') AS r(d)
  MATCH_CONDITION (t.s >= r.d);

-- FVT-ASOF-4-017: ARRAY<INT> operand
SELECT t.a, r.a AS matched_a
FROM VALUES (ARRAY(1, 3)) AS t(a) ASOF JOIN
     VALUES (ARRAY(1, 2)), (ARRAY(1, 4)) AS r(a)
  MATCH_CONDITION (t.a >= r.a);

-- FVT-ASOF-4-018a: scalar STRUCT tuple MATCH_CONDITION
SELECT r.c1, r.c2
FROM VALUES (1, 2) AS t(c1, c2) ASOF JOIN VALUES (1, 1) AS r(c1, c2)
  MATCH_CONDITION ((t.c1, t.c2) >= (r.c1, r.c2));

-- FVT-ASOF-4-018d: ARRAY of empty STRUCT with <=. Sizes 2 and 3 pass; the closest is size 2.
SELECT size(r.a) AS matched_size
FROM VALUES (ARRAY(named_struct(), named_struct())) AS t(a) ASOF JOIN
     VALUES (ARRAY(named_struct())),
            (ARRAY(named_struct(), named_struct())),
            (ARRAY(named_struct(), named_struct(), named_struct())) AS r(a)
  MATCH_CONDITION (t.a <= r.a);

-- FVT-ASOF-3-001: scalar subquery in MATCH_CONDITION operand
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= (SELECT max(trade_time) FROM trades))
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-004: generator in MATCH_CONDITION operand
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= EXPLODE(ARRAY(q.quote_time)))
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-007: <> rejected in MATCH_CONDITION (parse time)
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time <> q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-009a: IS NOT DISTINCT FROM rejected in MATCH_CONDITION (parse time)
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time IS NOT DISTINCT FROM q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-011a: ARRAY elements with no common type rejected (INT vs STRING only string-promotes)
SELECT * FROM VALUES (ARRAY(1)) AS t(a) ASOF JOIN VALUES (ARRAY('x')) AS r(a)
  MATCH_CONDITION (t.a >= r.a);

-- FVT-ASOF-3-013: STRUCT with non-orderable field rejected
SELECT * FROM VALUES (named_struct('a', 1, 'm', MAP('a', 1))) AS t(s) ASOF JOIN
     VALUES (named_struct('a', 1, 'm', MAP('a', 1))) AS r(s)
  MATCH_CONDITION (t.s >= r.s);

-- FVT-ASOF-3-014: operand references both sides
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time + (q.quote_time - t.trade_time) >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-018: window function in ON
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
    AND row_number() OVER (PARTITION BY q.symbol ORDER BY q.quote_time) = 1;

-- FVT-ASOF-3-021: non-boolean ON
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol;

-- FVT-ASOF-3-024: literal constant operand (right) references no join input
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= TIMESTAMP '2026-06-29 10:00:00')
  ON t.symbol = q.symbol;

-- FVT-ASOF-3-027: both operands are constants that reference no join input
SELECT * FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (TIMESTAMP '2026-06-29 10:00:01' >= TIMESTAMP '2026-06-29 10:00:00')
  ON t.symbol = q.symbol;

-- FVT-ASOF-8-002: aggregate over ASOF — covered by FVT-ASOF-6-003

-- FVT-ASOF-8-003: deterministic function in MATCH_CONDITION operand
SELECT t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (year(t.trade_time) >= year(q.quote_time))
  ON t.symbol = q.symbol
ORDER BY t.trade_time;

-- FVT-ASOF-8-006: deterministic SQL UDF rejected in MATCH_CONDITION (UNSUPPORTED_SQL_UDF_USAGE)
CREATE OR REPLACE FUNCTION shift_ts(ts TIMESTAMP) RETURNS TIMESTAMP
RETURN ts - INTERVAL 1 HOUR;

-- FVT-ASOF-8-007: non-deterministic SQL UDF rejected in MATCH_CONDITION (UNSUPPORTED_SQL_UDF_USAGE)
CREATE OR REPLACE FUNCTION jitter_ts(ts TIMESTAMP) RETURNS TIMESTAMP NOT DETERMINISTIC
RETURN ts + INTERVAL 1 SECOND;

-- FVT Category 10: ASOF JOIN feature gating (FVT-ASOF-10-*)



-- FVT-ASOF-10-001: ASOF JOIN rejected when feature flag is disabled
SELECT * FROM VALUES (TIMESTAMP '2026-06-29 10:00:00', 'AAPL') AS t(ts, symbol) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 09:00:00', 'AAPL') AS q(ts, symbol)
  MATCH_CONDITION (t.ts >= q.ts)
  ON t.symbol = q.symbol;

-- FVT-ASOF-1-001: default INNER with MATCH_CONDITION and ON
SELECT t.trade_time, t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
ORDER BY t.trade_time, t.symbol;

-- FVT-ASOF-1-004: LEFT OUTER ASOF JOIN
SELECT count(*) AS cnt
FROM trades t LEFT OUTER ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-1-008: MATCH_CONDITION with >
SELECT count(*) AS cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time > q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-1-011: MATCH_CONDITION with tuple / STRUCT operands
SELECT r.req_ts, r.seq, d.version
FROM requests r ASOF JOIN deploys d
  MATCH_CONDITION ((r.req_ts, r.seq) >= (d.deploy_ts, d.seq))
  ON r.service = d.service
ORDER BY r.req_ts, r.seq;

-- FVT-ASOF-1-014: FULL ASOF JOIN rejected
SELECT * FROM trades t FULL ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-1-019: LEFT SEMI ASOF JOIN rejected
SELECT * FROM trades t LEFT SEMI ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT Category 2: ASOF JOIN semantic behavior (FVT-ASOF-2-*)



-- Run with codegen on and off.




CREATE OR REPLACE TEMP VIEW trades(trade_time, symbol, quantity) AS
  VALUES (TIMESTAMP '2026-06-29 10:00:05', 'AAPL', 100),
         (TIMESTAMP '2026-06-29 10:00:11', 'AAPL', 200),
         (TIMESTAMP '2026-06-29 10:00:12', 'MSFT',  50),
         (TIMESTAMP '2026-06-29 09:59:59', 'GOOG',  30);

CREATE OR REPLACE TEMP VIEW using_keys(k) AS
  VALUES (1), (2);

-- FVT-ASOF-2-003: >= at exact equality selects equal row
SELECT t.trade_time, q.quote_time
FROM VALUES (TIMESTAMP '2026-06-29 10:00:00', 'X') AS t(trade_time, symbol) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 10:00:00', 'X'),
            (TIMESTAMP '2026-06-29 09:00:00', 'X') AS q(quote_time, symbol)
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  USING (symbol);

-- FVT-ASOF-2-006: NULL left operand, INNER drops row
SELECT count(*) AS cnt
FROM VALUES (CAST(NULL AS TIMESTAMP), 'AAPL', 100) AS t(trade_time, symbol, quantity) ASOF JOIN
     quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-2-009: ON filters right search space before closest-match
SELECT t.symbol, q.bid_price
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol AND q.bid_price > 200
ORDER BY t.symbol;

-- FVT-ASOF-2-012: LEFT cardinality equals left input
SELECT count(*) AS cnt
FROM trades t LEFT ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-2-015: GOOG unmatched — INNER drops, LEFT retains
SELECT count(*) AS inner_cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol
WHERE t.symbol = 'GOOG';

-- FVT-ASOF-2-017: disjunction in ON
SELECT count(*) AS cnt
FROM VALUES (CAST(NULL AS STRING), TIMESTAMP '2026-06-29 10:00:00') AS t(symbol, trade_time) ASOF JOIN
     VALUES (CAST(NULL AS STRING), TIMESTAMP '2026-06-29 09:00:00') AS q(symbol, quote_time)
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol OR (t.symbol IS NULL AND q.symbol IS NULL);

-- FVT-ASOF-2-020: ON FALSE empties right search space
SELECT count(*) AS inner_cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON FALSE;

-- FVT-ASOF-2-010: USING is equivalent to ON symbol equality
SELECT count(*) AS on_cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-2-023: join operand asymmetry — driving side changes row count
SELECT count(*) AS trades_driving_cnt
FROM trades t ASOF JOIN quotes q
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  ON t.symbol = q.symbol;

-- FVT-ASOF-2-025: NULL equi-key in USING never matches
SELECT count(*) AS cnt
FROM VALUES (TIMESTAMP '2026-06-29 10:00:00', CAST(NULL AS STRING)) AS t(trade_time, symbol) ASOF JOIN
     VALUES (TIMESTAMP '2026-06-29 09:00:00', CAST(NULL AS STRING)) AS q(quote_time, symbol)
  MATCH_CONDITION (t.trade_time >= q.quote_time)
  USING (symbol);

-- FVT-ASOF-2-028: a hidden USING column of the left input is a MATCH_CONDITION operand
SELECT l.lts, r.rts
FROM (using_left l LEFT JOIN using_keys d USING (k)) ASOF JOIN using_right r
  MATCH_CONDITION (d.k <= r.rts);

-- FVT-ASOF-2-031: the SELECT list also outputs the hidden MATCH_CONDITION column
SELECT l.lts, r.rts, d.k
FROM using_left l ASOF JOIN (using_right r LEFT JOIN using_keys d USING (k))
  MATCH_CONDITION (l.lts >= d.k);

-- FVT-ASOF-2-034: WHERE on the hidden MATCH_CONDITION column
SELECT l.lts
FROM using_left l ASOF JOIN (using_right r LEFT JOIN using_keys d USING (k))
  MATCH_CONDITION (l.k >= d.k)
WHERE d.k > 1;

-- FVT-ASOF-2-037: an ASOF JOIN with a hidden MATCH_CONDITION column under a table alias
SELECT s.lts, s.rts
FROM (using_left l ASOF JOIN (using_right r LEFT JOIN using_keys d USING (k))
        MATCH_CONDITION (l.lts >= d.k)) AS s;

-- FVT-ASOF-2-040: a bare FROM query does not output the hidden MATCH_CONDITION column
FROM using_left l ASOF JOIN (using_right r LEFT JOIN using_keys d USING (k))
  MATCH_CONDITION (l.lts >= d.k);

-- FVT-ASOF-2-043: an ASOF JOIN with USING passes up the hidden columns of its inputs
SELECT l.lts, d.k
FROM using_left l ASOF JOIN (using_right r LEFT JOIN using_keys d USING (k))
  MATCH_CONDITION (l.lts >= r.rts) USING (k);

-- FVT-ASOF-2-046: a hidden MATCH_CONDITION column whose table is also on the other side
SELECT d.k, x.k
FROM (using_right r LEFT JOIN using_keys d USING (k))
  ASOF JOIN using_keys x MATCH_CONDITION (d.k >= x.k);

-- FVT-ASOF-2-049: a LEFT ASOF JOIN with USING makes a NOT NULL hidden column of its inputs nullable
SELECT l.lts, d.k
FROM using_left l LEFT ASOF JOIN (using_right r JOIN using_keys d USING (k))
  MATCH_CONDITION (l.lts >= r.rts) USING (k);

-- FVT-ASOF-2-052: same as FVT-ASOF-2-051, with that JOIN on the right side
SELECT z.k, d.k
FROM (VALUES (1), (2)) AS z(k)
  ASOF JOIN ((using_right r LEFT JOIN using_keys d USING (k)) JOIN using_keys y ON y.k = 1)
  MATCH_CONDITION (z.k >= d.k);

SELECT * FROM t1 INNER JOIN empty_table;

SELECT * FROM t1 RIGHT OUTER JOIN empty_table;

SELECT * FROM t1 LEFT ANTI JOIN empty_table;

SELECT * FROM empty_table LEFT OUTER JOIN t1;

SELECT * FROM empty_table LEFT SEMI JOIN t1;

SELECT * FROM empty_table CROSS JOIN empty_table;

SELECT * FROM empty_table FULL OUTER JOIN empty_table;

-- Test cases for lateral join

CREATE VIEW t1(c1, c2) AS VALUES (0, 1), (1, 2);

CREATE VIEW t4(c1, c2) AS VALUES (0, 1), (0, 2), (1, 1), (1, 3);

SELECT * FROM t1, LATERAL (SELECT t1.c1 FROM t2);

SELECT * FROM t1, LATERAL (SELECT * FROM t2);

SELECT * FROM t1, LATERAL (SELECT t1.* FROM t2 AS t1);

SELECT * FROM t1 LEFT JOIN LATERAL (SELECT c1 + c2 AS c3) ON c2 = c3;

SELECT * FROM t1 JOIN LATERAL (SELECT c1 + c2 AS c2) USING (c2);

SELECT * FROM LATERAL (SELECT * FROM t1) JOIN LATERAL (SELECT * FROM t2);

-- lateral join with correlated equality predicates
SELECT * FROM t1, LATERAL (SELECT c2 FROM t2 WHERE t1.c1 = t2.c1);

-- lateral join can reference preceding FROM clause items
SELECT * FROM t1 JOIN t2 JOIN LATERAL (SELECT t1.c2 + t2.c2);

SELECT x FROM (SELECT SUM(c1) AS x FROM t1), LATERAL (SELECT x + rand(0) AS y);

-- expect error: lateral join cannot have non-deterministic join condition.
SELECT * FROM t1 JOIN LATERAL (SELECT * FROM t2) s ON t1.c1 + rand(0) = s.c1;

-- nested lateral joins
SELECT * FROM t1, LATERAL (SELECT * FROM t2, LATERAL (SELECT c1));

-- expect error: cannot resolve `t1.c1`
SELECT * FROM t1, LATERAL (SELECT * FROM t2, LATERAL (SELECT t1.c1 + t2.c1));

-- correlated scalar subquery inside lateral join
SELECT * FROM t1, LATERAL (SELECT (SELECT SUM(c2) FROM t2 WHERE c1 = a) FROM (SELECT c1 AS a));

-- lateral join inside correlated subquery
SELECT * FROM t1 WHERE c1 = (SELECT MIN(a) FROM t2, LATERAL (SELECT c1 AS a) WHERE c1 = t1.c1);

SELECT * FROM t1 LEFT JOIN lateral (SELECT * FROM t4 LEFT JOIN t2 ON t2.c1 = t4.c1 AND t2.c1 = t1.c1);

-- COUNT bug without count aggregate
SELECT * FROM t1, LATERAL (SELECT SUM(c2) IS NULL FROM t2 WHERE t1.c1 = t2.c1);

SELECT * FROM t1, LATERAL (SELECT c2, COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1 GROUP BY c2);

SELECT * FROM t1 CROSS JOIN LATERAL (SELECT COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1);

-- COUNT bug with non-empty join conditions
SELECT * FROM t1 JOIN LATERAL (SELECT COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1) ON cnt + 1 = c1;

-- COUNT bug with multiple aggregates
SELECT * FROM t1, LATERAL (SELECT SUM(cnt) FROM (SELECT COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1));

SELECT * FROM t1, LATERAL (
  SELECT COUNT(*) FROM (SELECT COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1)
  JOIN t2 ON cnt = t2.c1
);

SELECT * FROM t1, LATERAL (
  SELECT COUNT(*) FROM (SELECT COUNT(*) cnt FROM t2 WHERE t1.c1 = t2.c1)
  WHERE cnt = c1 - 1 GROUP BY cnt
);

-- lateral subquery with group by
SELECT * FROM t1 LEFT JOIN LATERAL (SELECT MIN(c2) FROM t2 WHERE c1 = t1.c1 GROUP BY c1);

SELECT * FROM t3 JOIN LATERAL (SELECT EXPLODE_OUTER(c2));

-- Window func
SELECT * FROM t1 JOIN LATERAL
  (SELECT sum(t2.c2) over (order by t2.c1)
  FROM   t2
  WHERE  t2.c1 >= t1.c1);

-- INTERSECT
SELECT * FROM t1 JOIN LATERAL
  (SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1
  INTERSECT ALL
  SELECT t4.c2
  FROM   t4
  WHERE  t4.c1 = t1.c1);

SELECT * FROM t1 JOIN LATERAL
  (SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1
  EXCEPT DISTINCT
  SELECT t4.c2
  FROM   t4
  WHERE  t4.c1 > t1.c2);

SELECT * FROM t1 JOIN LATERAL
  (SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1 and t2.c2 >= t1.c2
  UNION ALL
  SELECT t4.c2
  FROM   t4);

SELECT * FROM t1 JOIN LATERAL
  (SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1 and t2.c2 >= t1.c2
  INTERSECT ALL
  SELECT t4.c2
  FROM   t4);

SELECT * FROM t1 JOIN LATERAL
  (SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1 and t2.c2 >= t1.c2
  EXCEPT DISTINCT
  SELECT t4.c2
  FROM   t4);

-- Window func - unsupported
SELECT * FROM t1 JOIN LATERAL
  (SELECT sum(t2.c2) over (order by t2.c1)
  FROM   t2
  WHERE  t2.c1 >= t1.c1
  UNION ALL
  SELECT t4.c2
  FROM   t4);

-- Combinations of set ops
SELECT * FROM t1 JOIN LATERAL
  ((SELECT t2.c2
  FROM   t2
  WHERE  t2.c1 = t1.c1
  EXCEPT DISTINCT
  SELECT t4.c2
  FROM   t4
  WHERE  t4.c1 > t1.c2)
  UNION DISTINCT
  (SELECT t4.c1
  FROM   t4
  WHERE  t4.c1 <= t1.c2
  INTERSECT ALL
  SELECT t4.c2
  FROM   t4
  WHERE  t4.c1 <> t1.c1)
);

-- Semi join with correlation on right side - unsupported
SELECT * FROM t1 JOIN LATERAL (SELECT sum(c1) FROM
  (SELECT *
  FROM   t2
  WHERE  t2.c1 <= t1.c1) lhs
  LEFT SEMI JOIN
  (SELECT *
  FROM   t4
  WHERE t4.c1 > t1.c2) rhs
  ON lhs.c1 <=> rhs.c1 and lhs.c2 <=> rhs.c2
);

SELECT * FROM t1, LATERAL EXPLODE(ARRAY(c1, c2)) t2(c3);

SELECT * FROM EXPLODE(ARRAY(1, 2)) t(v), LATERAL (SELECT v + 1);

SELECT * FROM t3 LEFT JOIN LATERAL EXPLODE(c2) t(c3) ON t3.c1 = c3;

SELECT * FROM t1, LATERAL (SELECT t1.c1 + c3 FROM EXPLODE(ARRAY(c1, c2)) t(c3) WHERE t1.c2 > 1);

SELECT * FROM t1, LATERAL INLINE(ARRAY(STRUCT(1, 'a'), STRUCT(2, 'b')));

SELECT * FROM array_struct LEFT JOIN LATERAL INLINE(arr) t(k, v) ON id = k;

-- lateral join with table-valued functions posexplode and posexplode_outer
SELECT * FROM LATERAL posexplode(ARRAY(1, 2));

SELECT * FROM t3, LATERAL posexplode(c2) t2(pos, v);

SELECT * FROM t3 LEFT JOIN LATERAL posexplode(c2) t(pos, c3) ON t3.c1 = c3;

SELECT t1.key, t2.* FROM json_table t1, LATERAL json_tuple(t1.jstring, 'f1', 'f2', 'f3', 'f4', 'f5') t2;

SELECT t1.key, t2.* FROM json_table t1
  LEFT JOIN LATERAL json_tuple(t1.jstring, 'f1', 'f2', 'f3', 'f4', 'f5') t2(f1, f2, f3, f4, f5)
  ON t1.key = t2.f1;

SELECT t.* FROM t1 JOIN LATERAL stack(1, c1, c2) t(x, y);

-- SPARK-36191: ORDER BY/LIMIT in the correlated subquery
select * from t1 join lateral (select * from t2 where t1.c1 = t2.c1 and t1.c2 < t2.c2 limit 1);

select * from t1 join lateral (select c1, min(c2) as m
                               from t4 where t1.c1 = t4.c1
                               group by t4.c1
                               limit 1);

select 1
from t1 as t_outer
left join
 lateral(
     select b1,b2
     from
     (
         select
             t2.c1 as b1,
             1 as b2
         from t2
         union
         select t_outer.c1 as b1,
                null as b2
     ) as t_inner
     where (t_inner.b1 < t_outer.c2  or t_inner.b1 is null)
      and  t_inner.b1 = t_outer.c1
     order by t_inner.b1,t_inner.b2 desc limit 1
 ) as lateral_table;

-- lateral after USING JOIN: unqualified and qualified keys
WITH uj1(k, v1) AS (VALUES (1, 'a')),
     uj2(k, v2) AS (VALUES (1, 'b'))
SELECT * FROM uj1 JOIN uj2 USING (k),
LATERAL (SELECT k AS unq_k, uj1.k AS qual_uj1k, uj2.k AS qual_uj2k);

-- Table-valued function argument that is an alias over an outer reference: the `:` extraction on
-- the lateral join's outer `t.value` makes the variant_explode argument a top-level Alias. The
-- variant values are returned as JSON strings, which the Thrift server can also return.
SELECT t.key, u.pos, to_json(u.value) AS value
FROM variant_explode(parse_json('{"a": {"b": [1, 2, 3]}}')) AS t,
  LATERAL variant_explode(t.value:b) AS u;

SELECT t.key, u.pos, to_json(u.value) AS value
FROM variant_explode(parse_json('{"a": {"b": {"c": [1, 2]}}}')) AS t,
  LATERAL variant_explode(t.value:b.c) AS u;

-- clean up
DROP VIEW t1;

-- Test cases for NEAREST BY top-K ranking join.

CREATE VIEW users(user_id, score) AS VALUES (1, 10.0), (2, 20.0), (3, 30.0);

-- SELECT * to validate the output schema. Must surface only the user-visible columns from
-- left and right (`user_id`, `score`, `product`, `pscore`) -- no rewrite-internal columns
-- (`__qid`, `__nearest_matches__`, `__ranking__`) and no Generator-aliased names.
SELECT *
FROM users u JOIN products p
  APPROX NEAREST 1 BY SIMILARITY -abs(u.score - p.pscore);

-- EXACT NEAREST BY SIMILARITY with default k = 1
SELECT u.user_id, p.product
FROM users u INNER JOIN products p
  EXACT NEAREST BY SIMILARITY -abs(u.score - p.pscore);

-- Explicit INNER keyword
SELECT u.user_id, p.product
FROM users u INNER JOIN products p
  APPROX NEAREST 1 BY DISTANCE abs(u.score - p.pscore);

-- Error: num_results out of range (0)
SELECT u.user_id, p.product
FROM users u JOIN products p
  APPROX NEAREST 0 BY SIMILARITY -abs(u.score - p.pscore);

-- Both EXACT and APPROX permit a nondeterministic ranking expression. Rows differ run to
-- run, so we only assert the row count: one match per left row when k = 1.
SELECT COUNT(*) AS num_rows
FROM (
  SELECT u.user_id, p.product
  FROM users u JOIN products p
    EXACT NEAREST 1 BY SIMILARITY rand() + p.pscore
);

-- EXPLAIN of APPROX + nondeterministic ranking. Locks in the plan shape: the rewrite
-- injects a Project above the Join that materializes `rand(0) + p.pscore` as `__ranking__`,
-- An explicit seed is used so the EXPLAIN string is byte-stable across runs (without it,
-- `rand()` synthesizes a fresh random seed each time and the seed appears in the EXPLAIN).
EXPLAIN
SELECT u.user_id, p.product
FROM users u JOIN products p
  APPROX NEAREST 1 BY SIMILARITY rand(0) + p.pscore;

-- The rewrite produces an unconditioned cross-product internally. When the user has opted
-- out of cross-products via `spark.sql.crossJoin.enabled = false`, NEAREST BY queries are
-- rejected by `CheckCartesianProducts` -- the rewrite does not bypass the user's choice.
SET spark.sql.crossJoin.enabled = false;

-- Tie behavior: when multiple right rows have equal ranking values for a given left row,
-- MaxMinByK breaks ties arbitrarily (the SPIP marks tie-break as unspecified). We can't
-- pin specific rows, but the operator must still return exactly `numResults` matches per
-- left row when enough candidates exist.
CREATE OR REPLACE TEMP VIEW tied_products(product, pscore)
  AS VALUES ('A', 10.0), ('B', 10.0), ('C', 10.0);

DROP VIEW users;

-- Join names should be computed as intersection of names of the left and right sides.
SELECT * FROM t2 as t2_1 LEFT JOIN t2 as t2_2 ON t2_1.col1 = t2_2.col1
    NATURAL JOIN t2 as t2_3;

SELECT * FROM t2 as t2_1 INNER JOIN t2 as t2_2 ON t2_1.col1 = t2_2.col1
    NATURAL JOIN t2 as t2_3;

SELECT col1 FROM t1 as t1_1 LEFT SEMI JOIN t1 as t1_2 ORDER BY col2;

SELECT 1 FROM t2 NATURAL JOIN t1 JOIN t2 ON t2.col1 = t1.col1 GROUP BY t2.col2 HAVING t2.col2 = 1;

SELECT * FROM t1 JOIN t2 ON random(100) > 0.1;

SELECT * FROM t1 JOIN t2 ON t1.col2 = uuid();

SELECT * FROM t1 RIGHT JOIN t2 ON random(100) > 0.1;

SELECT * FROM t1 LEFT ANTI JOIN t2 ON random(100) > 0.1;

select to_json(named_struct('time', to_timestamp('2015-08-26', 'yyyy-MM-dd')), map('timestampFormat', 'dd/MM/yyyy'));

select to_json(map('a', named_struct('a', 1, 'b', 2)));

select to_json(array(map('a',1), map('b',2)));

select to_json();

-- Check if errors handled
select from_json('{"a":1}', 1);

select from_json('{"a":1}', 'a INT', map('mode', 1));

CREATE TEMPORARY VIEW jsonTable(jsonField, a) AS SELECT * FROM VALUES ('{"a": 1, "b": 2}', 'a');

SELECT json_tuple('{"a":"1"}', if(c1 < 1, null, 'a'), if(c2 < 1, null, 'a')) FROM ( SELECT 0 AS c1, rand() AS c2 );

select from_json('{"a":1, "b":"2"}', 'struct<a:int,b:string>');

-- from_json - array type
select from_json('[1, 2, 3]', 'array<int>');

select from_json('[{"a": 1}, {"a":2}]', 'array<struct<a:int>>');

select from_json('[{"a": 1}, {"b":2}]', 'array<map<string,int>>');

select from_json(
  '{"d": "12/15 2012", "t": "12/15 2012 15:15:15"}',
  'd date, t timestamp',
  map('dateFormat', 'MM/dd yyyy', 'timestampFormat', 'MM/dd yyyy HH:mm:ss'));

-- to_json - array type
select to_json(array('1', '2', '3'));

select schema_of_json('{"c1":01, "c2":0.1}', map('allowNumericLeadingZeros', 'true', 'prefersDecimal', 'true'));

SELECT schema_of_json(jsonField) FROM jsonTable;

select json_array_length();

select json_array_length('[1,2,3]');

select json_array_length('[1,2,3,[33,44],{"key":[2,3,4]}]');

-- json_object_keys
select json_object_keys();

select json_object_keys('');

select json_object_keys('{"key": "value", "key2": 2}');

select json_object_keys('{"f1":"abc","f2":{"f3":"a", "f4":"b"}}');

select json_object_keys('{"key": 45, "random_string"}');

select json_typeof(null);

select json_typeof('{}');

select json_typeof('[1, 2, 3]');

select json_typeof('1.5');

select json_typeof('true');

select json_typeof('bad');

-- TIME type tests
-- from_json with TIME type
select from_json('{"time": "14:30:45"}', 'time TIME(0)');

select from_json('{"time": "14-30-45.123456"}', 'time TIME(6)', map('timeFormat', 'HH-mm-ss.SSSSSS'));

select from_json('{"time": "invalid"}', 'time TIME');

select to_json(named_struct('time', TIME'14:30:45.123456'));

-- TIME type roundtrip tests
select from_json(to_json(named_struct('time', TIME'14:30:45')), 'time TIME(0)');

select from_json(to_json(named_struct('time', TIME'14:30:45.123')), 'time TIME(3)');

select from_json(to_json(named_struct('time', TIME'14:30:45.123456')), 'time TIME(6)');

select to_json(from_json('{"time":"14:30:45"}', 'time TIME(0)'));

select to_json(from_json('{"time":"14:30:45.123"}', 'time TIME(3)'));

select to_json(from_json('{"time":"14:30:45.123456"}', 'time TIME(6)'));

-- TIME type schema inference and other tests
select schema_of_json('{"time": "14:30:45"}');

-- JSON_VALUE: extract a scalar value (ANSI SQL:2016)
select json_value('{"id":7,"name":"Ada","tags":["x","y"],"addr":{"city":"NYC"},"score":null}', '$.name');

-- present but JSON null -> SQL NULL
select json_value('{"score":null}', '$.score');

-- missing path -> NULL ON EMPTY (default)
select json_value('{"id":7}', '$.missing');

select json_value('{"id":7}', '$.missing' RETURNING INT DEFAULT 42 ON EMPTY);

select json_value('not json', '$.a' DEFAULT 'bad' ON ERROR);

select json_value('{"name":"Ada"}', '$.name' RETURNING INT ERROR ON ERROR);

-- RETURNING types
select json_value('{"v":"3.14"}', '$.v' RETURNING DOUBLE);

-- invalid: wildcard path
select json_value('{"a":[1,2]}', '$.a[*]');

-- JSON_EXISTS: test path presence (ANSI SQL:2016)
select json_exists('{"id":7,"addr":{"city":"NYC"},"score":null,"tags":["x","y"]}', '$.addr.city');

-- matches an object / array -> true
select json_exists('{"addr":{"city":"NYC"}}', '$.addr');

-- malformed input -> FALSE ON ERROR (default)
select json_exists('not json', '$.a');

select json_exists('not json', '$.a' UNKNOWN ON ERROR);

select json_exists('{"a":[]}', '$.a[*]');

-- out-of-range index -> false
select json_exists('{"a":[1,2]}', '$.a[5]');

-- invalid: an unparseable path is rejected at analysis
select json_exists('{"a":1}', '$[');

-- a scalar result is emitted as JSON text (not an error) under the default WITHOUT ARRAY WRAPPER
select json_query('{"id":7}', '$.id');

-- missing path -> NULL ON EMPTY (default)
select json_query('{"id":7}', '$.missing');

select json_query('{"tags":["x","y"]}', '$.tags' WITH UNCONDITIONAL ARRAY WRAPPER);

select json_query('{"addr":{"city":"NYC"}}', '$.addr' WITH CONDITIONAL ARRAY WRAPPER);

-- ON EMPTY behaviors
select json_query('{"id":7}', '$.missing' EMPTY ARRAY ON EMPTY);

-- ON ERROR behaviors (malformed input)
select json_query('not json', '$.a');

select json_query('not json', '$.a' ERROR ON ERROR);

-- invalid: non-string RETURNING type
select json_query('{"a":1}', '$.a' RETURNING INT);

-- default ABSENT ON NULL drops NULL elements
select json_array(1, NULL, 3);

-- decimals and dates render via the JSON generator
select json_array(CAST(1.50 AS DECIMAL(5,2)), DATE'2020-01-02');

select json_array('[1,2]' FORMAT JSON);

-- FORMAT JSON requires the string to be exactly one well-formed JSON value
select json_array('1,2' FORMAT JSON);

-- values accept unparenthesized predicate expressions
select json_array(1 IS NULL, 2 > 1);

select json_object('id': 7, 'v': NULL);

select json_object('int': 42, 'str': 'hello', 'bool': true, 'float': 3.14);

-- JSON_OBJECT comma-separated (MySQL-style) key/value pairs
select json_object('id', 7, 'name', 'Ada');

-- JSON_OBJECT FORMAT JSON splices an already-JSON string verbatim; a plain string is quoted
select json_object('a' VALUE '{"b":1}' FORMAT JSON);

-- JSON_OBJECT error: malformed FORMAT JSON value
select json_object('a' VALUE '{bad' FORMAT JSON);

-- Positive test cases
-- Create tables with two columns for each data type

-- Integer table
DROP TABLE IF EXISTS t_int_1_5_through_7_11;

CREATE TABLE t_long_1_5_through_7_11 AS
VALUES
  (1L, 5L), (2L, 6L), (3L, 7L), (4L, 8L), (5L, 9L), (6L, 10L), (7L, 11L) AS tab(col1, col2);

-- TINYINT (ByteType) table
DROP TABLE IF EXISTS t_byte_1_5_through_7_11;

CREATE TABLE t_float_1_5_through_7_11 AS
VALUES
    (CAST(1 AS FLOAT), CAST(5 AS FLOAT)),
    (CAST(2 AS FLOAT), CAST(6 AS FLOAT)),
    (CAST(3 AS FLOAT), CAST(7 AS FLOAT)),
    (CAST(4 AS FLOAT), CAST(8 AS FLOAT)),
    (CAST(5 AS FLOAT), CAST(9 AS FLOAT)),
    (CAST(6 AS FLOAT), CAST(10 AS FLOAT)),
    (CAST(7 AS FLOAT), CAST(11 AS FLOAT)) AS tab(col1, col2);

-- BIGINT sketches
SELECT lower(kll_sketch_to_string_bigint(agg)) LIKE '%kll%' AS str_contains_kll,
       abs(kll_sketch_get_quantile_bigint(agg, 0.5) - 4) < 1 AS median_close_to_4,
       abs(kll_sketch_get_rank_bigint(agg, 3) - 0.4) < 0.1 AS rank3_close_to_0_4
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg
    FROM t_byte_1_5_through_7_11
);

SELECT lower(kll_sketch_to_string_bigint(agg)) LIKE '%kll%' AS str_contains_kll,
       abs(kll_sketch_get_quantile_bigint(agg, 0.5) - 4) < 1 AS median_close_to_4,
       abs(kll_sketch_get_rank_bigint(agg, 3) - 0.4) < 0.1 AS rank3_close_to_0_4
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg
    FROM t_short_1_5_through_7_11
);

-- Test float column with double sketch (valid type promotion)
SELECT lower(kll_sketch_to_string_double(agg)) LIKE '%kll%' AS str_contains_kll,
       abs(kll_sketch_get_quantile_double(agg, 0.5) - 4.0) < 0.5 AS median_close_to_4,
       abs(kll_sketch_get_rank_double(agg, 3) - 0.4) < 0.1 AS rank3_close_to_0_4
FROM (
    SELECT kll_sketch_agg_double(col1) AS agg
    FROM t_float_1_5_through_7_11
);

SELECT
  split(
    kll_sketch_to_string_double(
      kll_sketch_merge_double(
        kll_sketch_agg_double(col1),
        kll_sketch_agg_double(col1)
      )
    ),
    '\n'
  )[1] AS result
FROM t_byte_1_5_through_7_11;

-- Test empty aggregation: zero rows input for kll_merge_agg_float
SELECT kll_sketch_get_n_float(kll_merge_agg_float(sketch_col)) AS empty_merge_n
FROM (
  SELECT kll_sketch_agg_float(col1) AS sketch_col
  FROM t_float_1_5_through_7_11
  WHERE col1 > 1000.0
) empty_sketches;

-- Test kll_merge_agg_float: merge float sketches from multiple rows
-- Merging col1 (1-7) and col2 (5-11) gives combined data with median ~5.5
SELECT lower(kll_sketch_to_string_float(agg)) LIKE '%kll%' AS str_contains_kll,
       abs(kll_sketch_get_quantile_float(agg, 0.5) - 5.5) < 1.0 AS median_close_to_5_5,
       abs(kll_sketch_get_rank_float(agg, 5.0) - 0.35) < 0.15 AS rank5_close_to_0_35
FROM (
    SELECT kll_merge_agg_float(sketch_col) AS agg
    FROM (
        SELECT kll_sketch_agg_float(col1) AS sketch_col
        FROM t_float_1_5_through_7_11
        UNION ALL
        SELECT kll_sketch_agg_float(col2) AS sketch_col
        FROM t_float_1_5_through_7_11
    ) sketches
);

-- Test kll_merge_agg_float with custom k parameter
SELECT LENGTH(kll_sketch_to_string_float(kll_merge_agg_float(sketch_col, 300))) > 0 AS merged_with_k
FROM (
    SELECT kll_sketch_agg_float(col1, 300) AS sketch_col
    FROM t_float_1_5_through_7_11
) sketches;

-- Tests verifying that NULL input values are ignored by aggregate functions

-- Test BIGINT aggregate ignores NULL values
-- Verify that the sketch computed with NULLs matches the sketch without NULLs
-- Both should compute median of [1, 3, 5, 7] which is 4
-- Input data: 1, NULL, 3, 5, NULL, 7
SELECT abs(kll_sketch_get_quantile_bigint(agg_with_nulls, 0.5) - 
           kll_sketch_get_quantile_bigint(agg_without_nulls, 0.5)) < 1 AS medians_match,
       abs(kll_sketch_get_rank_bigint(agg_with_nulls, 4) - 
           kll_sketch_get_rank_bigint(agg_without_nulls, 4)) < 0.1 AS ranks_match
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg_with_nulls
    FROM (VALUES (1L), (CAST(NULL AS BIGINT)), (3L), (5L), (CAST(NULL AS BIGINT)), (7L)) AS tab(col1)
) WITH_NULLS,
(
    SELECT kll_sketch_agg_bigint(col1) AS agg_without_nulls
    FROM (VALUES (1L), (3L), (5L), (7L)) AS tab(col1)
) WITHOUT_NULLS;

-- Tests covering NULLs
-- NULL sketch to get_quantile
SELECT kll_sketch_get_quantile_bigint(CAST(NULL AS BINARY), 0.5) AS null_sketch;

SELECT LENGTH(kll_sketch_to_string_bigint(kll_sketch_agg_bigint(col1, 200))) > 0 AS k_default_value
FROM t_long_1_5_through_7_11;

SELECT LENGTH(kll_sketch_to_string_float(kll_sketch_agg_float(col1, 100))) > 0 AS k_float_sketch
FROM t_float_1_5_through_7_11;

SELECT kll_sketch_get_n_bigint(kll_sketch_agg_bigint(col1)) AS n_byte
FROM t_byte_1_5_through_7_11;

-- FLOAT sketches
SELECT kll_sketch_get_n_float(kll_sketch_agg_float(col1)) AS n_float
FROM t_float_1_5_through_7_11;

-- Negative tests
-- These queries should fail with type mismatch or validation errors

-- Type mismatch: BIGINT sketch does not accept DOUBLE columns
SELECT lower(kll_sketch_to_string_bigint(agg)) LIKE '%kll%' AS str_contains_kll,
       abs(kll_sketch_get_quantile_bigint(agg, 0.5) - 4) < 1 AS median_close_to_4,
       abs(kll_sketch_get_rank_bigint(agg, 3) - 0.4) < 0.1 AS rank3_close_to_0_4
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg
    FROM t_double_1_5_through_7_11
);

-- Type mismatch: FLOAT sketch does not accept integer types (BIGINT) to avoid precision loss
SELECT kll_sketch_agg_float(col1) AS invalid_float_bigint
FROM t_long_1_5_through_7_11;

-- Type mismatch: FLOAT sketch does not accept integer types (TINYINT) to avoid precision loss
SELECT kll_sketch_agg_float(col1) AS invalid_float_byte
FROM t_byte_1_5_through_7_11;

-- Type mismatch: DOUBLE sketch does not accept integer types (SMALLINT) to avoid precision loss
SELECT kll_sketch_agg_double(col1) AS invalid_double_short
FROM t_short_1_5_through_7_11;

-- Invalid quantile: quantile value must be between 0 and 1 (value > 1)
SELECT kll_sketch_get_quantile_bigint(agg, 1.5) AS invalid_quantile
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg
    FROM t_long_1_5_through_7_11
);

-- Type mismatch: incompatible sketches in merge (BIGINT and FLOAT)
SELECT kll_sketch_merge_bigint(agg1, agg2) AS incompatible_merge
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg1,
           kll_sketch_agg_float(CAST(col1 AS FLOAT)) AS agg2
    FROM t_long_1_5_through_7_11
);

-- Note: to_string functions cannot detect sketch type mismatches because they just
-- interpret the binary data. This query succeeds even though we're using a DOUBLE
-- to_string function on a BIGINT sketch. The function reads the binary representation
-- and produces output, but the numeric values will be incorrectly interpreted.
SELECT lower(kll_sketch_to_string_double(agg)) LIKE '%kll%' AS contains_kll_header
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg
    FROM t_long_1_5_through_7_11
);

-- k parameter is NULL
SELECT kll_sketch_agg_float(col1, CAST(NULL AS INT)) AS k_is_null
FROM t_float_1_5_through_7_11;

-- Negative tests for kll_merge_agg functions

-- Test wrong sketch type: float sketch passed to kll_merge_agg_bigint (should fail)
SELECT kll_merge_agg_bigint(sketch_col) AS wrong_type_merge
FROM (
  SELECT kll_sketch_agg_float(col1) AS sketch_col
  FROM t_float_1_5_through_7_11
) float_sketches;

-- Type mismatch: kll_merge_agg_double does not accept double columns (needs binary)
SELECT kll_merge_agg_double(col1) AS merge_wrong_type
FROM t_double_1_5_through_7_11;

-- Invalid binary data for kll_merge_agg_double
SELECT kll_merge_agg_double(sketch_col) AS invalid_merge
FROM (
    SELECT X'cafebabe' AS sketch_col
) invalid_data;

-- k parameter is NULL for kll_merge_agg_double
SELECT kll_merge_agg_double(sketch_col, CAST(NULL AS INT)) AS k_is_null
FROM (
    SELECT kll_sketch_agg_double(col1) AS sketch_col
    FROM t_double_1_5_through_7_11
) sketches;

SELECT kll_sketch_get_n_float(X'cafebabe') AS invalid_binary_float;

SELECT kll_sketch_get_n_float(42.0) AS wrong_argument_type;

-- Invalid type: BINARY instead of DOUBLE for quantile parameter
SELECT kll_sketch_get_quantile_float(agg, X'deadbeef') AS quantile_binary
FROM (
    SELECT kll_sketch_agg_float(col1) AS agg
    FROM t_float_1_5_through_7_11
);

-- Invalid type: BINARY instead of FLOAT for rank value parameter
SELECT kll_sketch_get_rank_float(agg, X'cafebabe') AS rank_binary
FROM (
    SELECT kll_sketch_agg_float(col1) AS agg
    FROM t_float_1_5_through_7_11
);

-- Non-foldable array rank argument to get_quantile (array containing column reference)
SELECT kll_sketch_get_quantile_bigint(agg, array(0.25, CAST(col1 AS DOUBLE) / 10.0, 0.75)) AS non_foldable_array_rank
FROM (
    SELECT kll_sketch_agg_bigint(col1) AS agg, col1
    FROM t_long_1_5_through_7_11
    GROUP BY col1
);

-- Clean up
DROP TABLE IF EXISTS t_int_1_5_through_7_11;

DROP TABLE IF EXISTS t_byte_1_5_through_7_11;

CREATE TABLE t1(col1 ARRAY<INT>, col2 INT);

SELECT g AS f, COUNT(*) AS cnt FROM t1 LATERAL VIEW EXPLODE(col1) unknown AS g WHERE col2 = 0
GROUP BY g ORDER BY g;

-- LATERAL VIEW OUTER, POSEXPLODE with two outputs, a qualified generator output, multiple LATERAL
-- VIEWs, an expression over the hidden output, and INLINE.
SELECT t1.* FROM t1 LATERAL VIEW OUTER EXPLODE(col1) AS g ORDER BY g, col2;

SELECT col2 FROM t1 LATERAL VIEW EXPLODE(col1) AS g LATERAL VIEW EXPLODE(array(g, g * 10)) AS h
ORDER BY h;

-- Hidden output in aggregate functions in HAVING and ORDER BY.
SELECT col2 FROM t1 LATERAL VIEW EXPLODE(col1) AS g GROUP BY col2 HAVING max(g) > 2;

SELECT DISTINCT col2 FROM t1 LATERAL VIEW EXPLODE(col1) AS g ORDER BY g;

SELECT company FROM like_all_table WHERE company LIKE ALL ('microsoft', '%yoo%');

-- not like all test
SELECT company FROM like_all_table WHERE company NOT LIKE ALL ('%oo%', '%in', 'fa%');

SELECT company FROM like_all_table WHERE NOT company LIKE ALL ('%oo%', 'fa%');

SELECT company FROM like_all_table WHERE company LIKE ALL (NULL, NULL);

-- test cases for like any

CREATE OR REPLACE TEMPORARY VIEW like_any_table AS SELECT * FROM (VALUES
  ('google', '%oo%'),
  ('facebook', '%oo%'),
  ('linkedin', '%in'))
  as t1(company, pat);

select
    company,
    CASE
        WHEN company LIKE ANY ('%oo%', '%in', 'fa%') THEN 'Y'
        ELSE 'N'
    END AS is_available,
    CASE
        WHEN company LIKE ANY ('%oo%', 'fa%') OR company LIKE ANY ('%in', 'ms%') THEN 'Y'
        ELSE 'N'
    END AS mix
FROM like_any_table;

SELECT company FROM like_any_table WHERE company NOT LIKE ANY ('microsoft', '%yoo%');

-- null test
SELECT company FROM like_any_table WHERE company LIKE ANY ('%oo%', NULL);

SELECT company FROM like_any_table WHERE company NOT LIKE ANY (NULL, NULL);

SELECT * FROM arraydata LIMIT 2;

SELECT * FROM testdata LIMIT CAST(1 AS int);

-- evaluated limit must not be null
SELECT * FROM testdata LIMIT CAST(NULL AS INT);

SELECT * FROM testdata LIMIT 'a';

-- Test data.
CREATE OR REPLACE TEMPORARY VIEW testRegression AS SELECT * FROM VALUES
(1, 10, null), (2, 10, 11), (2, 20, 22), (2, 25, null), (2, 30, 35), (2, null, 40)
AS testRegression(k, y, x);

SELECT k, count(*), regr_count(y, x) FROM testRegression GROUP BY k;

SELECT regr_r2(y, x) FROM testRegression WHERE x IS NOT NULL;

-- SPARK-37614: Support ANSI Aggregate Function: regr_avgx & regr_avgy
SELECT regr_avgx(y, x), regr_avgy(y, x) FROM testRegression;

SELECT k, avg(x) FILTER (WHERE x IS NOT NULL AND y IS NOT NULL), avg(y) FILTER (WHERE x IS NOT NULL AND y IS NOT NULL), regr_avgx(y, x), regr_avgy(y, x) FROM testRegression GROUP BY k;

SELECT k, regr_sxx(y, x) FROM testRegression GROUP BY k;

SELECT regr_sxy(y, x) FROM testRegression WHERE x IS NOT NULL AND y IS NOT NULL;

-- SPARK-37702: Support ANSI Aggregate Function: regr_syy
SELECT regr_syy(y, x) FROM testRegression;

SELECT k, regr_syy(y, x) FROM testRegression WHERE x IS NOT NULL AND y IS NOT NULL GROUP BY k;

SELECT k, regr_slope(y, x) FROM testRegression GROUP BY k;

SELECT regr_intercept(y, x) FROM testRegression WHERE x IS NOT NULL AND y IS NOT NULL;

-- SPARK-55969: regr_r2 should treat first param as dependent variable
SELECT regr_r2(k, x) FROM testRegression where k=2;

SELECT corr(CAST(x AS DOUBLE), CAST(y AS DOUBLE)) FROM testCorrConstant;

-- y-constant (x varies): corr should return NULL
SELECT corr(CAST(x AS DOUBLE), CAST(y AS DOUBLE)) FROM VALUES
(1, 1), (2, 1), (3, 1) AS t(x, y);

WITH t(c1) AS (SELECT listagg(col1) WITHIN GROUP (ORDER BY col1) FROM (VALUES ('abc  '), ('abc '), ('abc\n'), ('abc'), ('x'))) SELECT replace(replace(c1, ' ', ''), '\n', '$') FROM t;

SELECT lower(listagg(DISTINCT c1 COLLATE utf8_lcase) WITHIN GROUP (ORDER BY c1 COLLATE utf8_lcase)) FROM (VALUES ('a'), ('B'), ('b'), ('A')) AS t(c1);

-- Error case with collations
SELECT listagg(DISTINCT c1 COLLATE utf8_lcase) WITHIN GROUP (ORDER BY c1 COLLATE utf8_binary) FROM (VALUES ('a'), ('b'), ('A'), ('B')) AS t(c1);

-- binary -> string (safe): cast to default STRING (UTF8_BINARY)
SELECT listagg(DISTINCT CAST(col AS STRING)) WITHIN GROUP (ORDER BY col) FROM VALUES (X'414243'), (X'616263'), (X'414243') AS t(col);

-- string -> binary (unsafe): non-binary-equality source (UTF8_LCASE), BinaryType target
SELECT listagg(DISTINCT CAST(col AS BINARY)) WITHIN GROUP (ORDER BY col) FROM (SELECT col COLLATE UTF8_LCASE AS col FROM VALUES ('ABC'), ('abc'), ('ABC') AS t(col));

-- Test cases for listagg function
WITH t(col) AS (SELECT listagg(col2) FROM df GROUP BY col1) SELECT len(col), regexp_count(col, 'a'), regexp_count(col, 'b'), regexp_count(col, 'c'), regexp_count(col, 'd') FROM t;

SELECT listagg(col2) FROM df WHERE 1 != 1;

WITH t(col) AS (SELECT listagg(DISTINCT col1) FROM df) SELECT len(col), regexp_count(col, 'a'), regexp_count(col, 'b') FROM t;

SELECT listagg(col1) WITHIN GROUP (ORDER BY col1 DESC) OVER (PARTITION BY col2) FROM df;

WITH t(col) AS (SELECT listagg(col1, '|') WITHIN GROUP (ORDER BY col2 DESC) FROM df) SELECT (col == 'b|a|b|a') || (col == 'b|b|a|a') FROM t;

SELECT listagg(col1) WITHIN GROUP (ORDER BY col2 DESC, col1 DESC) FROM df;

WITH t(col) AS (SELECT listagg(col1, X'42') FROM (VALUES (X'DEAD'), (X'BEEF'))) SELECT len(col), regexp_count(hex(col), hex(X'42')), regexp_count(hex(col), hex(X'DEAD')), regexp_count(hex(col), hex(X'BEEF')) FROM t;

SELECT listagg(DISTINCT col, ',') WITHIN GROUP (ORDER BY col) FROM VALUES (cast(1 as bigint)), (cast(2 as bigint)), (cast(2 as bigint)), (cast(3 as bigint)) AS t(col);

SELECT listagg(DISTINCT col, ',') WITHIN GROUP (ORDER BY col) FROM VALUES (cast(1.10 as decimal(10,2))), (cast(2.20 as decimal(10,2))), (cast(2.20 as decimal(10,2))) AS t(col);

SELECT listagg(DISTINCT col, ',') WITHIN GROUP (ORDER BY col) FROM VALUES (true), (false), (true) AS t(col);

SELECT listagg(DISTINCT col, ',') WITHIN GROUP (ORDER BY col DESC) FROM VALUES (1), (10), (2), (20), (2) AS t(col);

SELECT grp, listagg(DISTINCT col) WITHIN GROUP (ORDER BY col) FROM VALUES (1, 'a'), (1, 'b'), (2, 'a'), (2, 'a'), (1, 'b') AS t(grp, col) GROUP BY grp;

SELECT grp, hex(listagg(DISTINCT col, X'2C') WITHIN GROUP (ORDER BY col)) FROM VALUES (1, X'AA'), (1, X'BB'), (1, X'AA'), (2, X'CC'), (2, X'CC') AS t(grp, col) GROUP BY grp;

SELECT listagg(col2, col1) FROM df GROUP BY col1;

SELECT string_agg(col1) WITHIN GROUP (ORDER BY col1) OVER (ORDER BY col1) FROM df;

SELECT listagg(DISTINCT col1) WITHIN GROUP (ORDER BY col1, col2) FROM df;

SELECT listagg(DISTINCT col, ',') WITHIN GROUP (ORDER BY col) FROM VALUES (TIMESTAMP'2024-01-01 10:00:00'), (TIMESTAMP'2024-01-02 12:00:00'), (TIMESTAMP'2024-01-01 10:00:00') AS t(col);

-- Semi-structured extract with DESC ordering
SELECT listagg(DISTINCT v:a::string, ',') WITHIN GROUP (ORDER BY v:a::string DESC) FROM (SELECT parse_json('{"a": "x"}') v UNION ALL SELECT parse_json('{"a": "y"}') UNION ALL SELECT parse_json('{"a": "x"}'));

-- Semi-structured extract: DISTINCT with non-equality-preserving cast (double->string)
-- Tests that checkOrderValueDeterminism strips Alias wrappers before comparing via semanticEquals
SELECT listagg(DISTINCT (v:a)::double::string, ',') WITHIN GROUP (ORDER BY (v:a)::double) FROM (SELECT parse_json('{"a": 1.1}') v UNION ALL SELECT parse_json('{"a": 2.2}') UNION ALL SELECT parse_json('{"a": 1.1}'));

-- byte (tinyint)
select 1Y;

-- short (smallint)
select 1S;

-- long (bigint)
select 1L, 2147483648L;

-- integral parsing

-- parse int
select 1, -1;

-- parse as decimals (Long.MaxValue + 1, and Long.MinValue - 1)
select 9223372036854775808, -9223372036854775809;

-- float
select 1F, 1.2F, .10f, 0.10f;

-- double
select 1D, 1.2D, 1e10, 1.5e5, .10D, 0.10D, .1e5, .9e+2, 0.9e+2, 900e-1, 9.e+1;

-- very large decimals (overflowing double).
select 1E309, -1E309;

-- super large scientific notation double literals should still be valid doubles
select 123456789012345678901234567890123456789e10d, 123456789012345678901234567890123456789.1e10d;

-- single quote within double quotes
select "hello 'peter'";

-- "Hello!" in octals
select '\110\145\154\154\157\041';

-- invalid date
select date 'mar 11 2016';

-- unsupported data type
select GEO '(10,-6)';

-- hexadecimal binary literal
select x'2379ACFe';

-- awareness of the negative/positive sign before type
select +date '1999-01-01';

select +map(1, 2);

select +X'1';

select -x'2379ACFe';

SELECT 'S''par''k' AS c1, 'S\'par\'k' AS c2, "S''par''k" AS c3;

SELECT "S""par""k" AS c1, "S\"par\"k" AS c2, 'S""par""k' AS c3;

-- map_contains_key
select map_contains_key(map(1, 'a', 2, 'b'), 5);

select map_contains_key(map(1, 'a', 2, 'b'), 1.0);

select map_contains_key(map('1', 'a', '2', 'b'), 1);

SELECT mask('AbCD123-@$#', 'Q');

SELECT mask('AbCD123-@$#', 'Q', 'q', 'd', 'o');

SELECT mask('AbCD123-@$#', NULL, NULL, 'd', 'o');

SELECT mask(NULL);

SELECT mask(NULL, NULL, NULL, NULL, 'o');

SELECT mask(c1, 'Q', 'q')from values ('AbCD123-@$#') as tab(c1);

SELECT mask(c1, NULL, 'q', 'd', 'o') from values ('AbCD123-@$#') as tab(c1);

SELECT mask(c1, NULL, NULL, NULL, NULL) from values ('AbCD123-@$#') as tab(c1);

SELECT mask(c1, 'Q', 'q', 'd', NULL) from values ('AbCD123-@$#') as tab(c1);

SELECT mask('abcd-EFGH-8765-4321', 'Q');

SELECT mask('abcd-EFGH-8765-4321', 'Q', 'q', 'd', '*');

SELECT mask('abcd-EFGH-8765-4321', NULL, NULL, NULL, '*');

SELECT mask(NULL, NULL, NULL, 'd', '*');

SELECT mask(c1) from values ('abcd-EFGH-8765-4321') as tab(c1);

SELECT mask(c1, 'Q', 'q', 'd') from values ('abcd-EFGH-8765-4321') as tab(c1);

SELECT mask(c1, NULL, NULL, 'd', '*') from values ('abcd-EFGH-8765-4321') as tab(c1);

SELECT mask(c1, replaceArg) from values('abcd-EFGH-8765-4321', 'a') as t(c1, replaceArg);

SELECT mask('abcd-EFGH-8765-4321', 'A', 'w', '');

SELECT round(25y, 0);

SELECT round(25y, -3);

-- Round with short integer input
SELECT round(525s, 1);

SELECT round(525s, -2);

SELECT round(-32768s, -1);

SELECT round(525, -1);

SELECT round(2147483647, -1);

SELECT round(525L, 0);

SELECT round(525L, -3);

-- Bround with byte input
SELECT bround(25y, 1);

SELECT bround(25y, -2);

SELECT bround(-128y, -1);

SELECT bround(525s, -1);

SELECT bround(32767s, -1);

SELECT bround(525, 0);

SELECT bround(525, -3);

-- Bround with big integer input
SELECT bround(525L, 1);

SELECT bround(525L, -2);

SELECT bround(-9223372036854775808L, -1);

SELECT truncate(25y, -1);

-- Truncate with negative Byte input: truncation is toward zero, unlike floor.
SELECT truncate(-25y, 1);

SELECT truncate(-25y, -2);

SELECT truncate(-128y, -1);

SELECT truncate(525s, -1);

-- Truncate with negative short integer input: truncation is toward zero, unlike floor.
SELECT truncate(-525s, 1);

SELECT truncate(-525s, -2);

SELECT truncate(525, 0);

SELECT truncate(525, -3);

SELECT truncate(-525, -1);

-- Truncate with big integer input
SELECT truncate(525L, 1);

SELECT truncate(525L, -2);

SELECT truncate(-525L, 0);

SELECT truncate(-525L, -3);

SELECT conv(-10, 16, -10);

SELECT conv('9223372036854775807', 36, 10);

SELECT BIN(25);

SELECT POSITIVE(0Y);

SELECT POSITIVE(25.5);

SELECT POSITIVE(null);

-- Basic min_by with k
SELECT min_by(name, score, 3) FROM basic_data;

-- k larger than row count (should return all elements)
SELECT max_by(name, score, 10) FROM basic_data;

-- max_by with GROUP BY
SELECT dept, max_by(emp, salary, 2) FROM dept_data GROUP BY dept ORDER BY dept;

SELECT max_by(x, y, 2) FROM null_data;

SELECT max_by(x, y, 2) FROM null_value_data;

SELECT max_by(name, score, 2) FROM typed_data;

SELECT max_by(event, event_date, 2) FROM date_data;

-- Error case: k must be positive
SELECT max_by(name, score, 0) FROM basic_data;

-- Cleanup
DROP VIEW basic_data;

DROP VIEW null_value_data;

-- Tests for _metadata virtual column resolution across different file formats,
-- qualifications, clauses, and join types.
-- t1 uses PARQUET, t2 uses CSV, t3 uses ORC.

CREATE DATABASE IF NOT EXISTS testdb;

CREATE TABLE t2(id INT, category STRING, amount BIGINT) USING CSV;

SELECT _metadata.file_path FROM t1;

SELECT _metadata.row_index FROM t1;

-- Qualified table references with metadata
SELECT t1._metadata.file_name FROM t1;

SELECT t1._metadata.file_name, testdb.t1._metadata.file_path FROM testdb.t1;

SELECT * FROM t1 WHERE _metadata.file_name = 'data.parquet';

SELECT * FROM testdb.t1 WHERE testdb.t1._metadata.row_index < 100;

SELECT id, _metadata.file_name FROM t1 ORDER BY _metadata.file_modification_time, _metadata.row_index;

-- Metadata with aggregations
SELECT _metadata.file_name, MIN(_metadata.row_index), MAX(_metadata.row_index) FROM t1
GROUP BY _metadata.file_name;

SELECT t1.id, t1._metadata.file_name, t2._metadata.file_name
FROM t1 JOIN t2 ON t1.id = t2.id;

SELECT t1._metadata.file_path, t2._metadata.file_path, t1.id
FROM t1 RIGHT JOIN t2 ON t1.id = t2.id;

-- Metadata with table aliases
SELECT t._metadata.file_name, t.id FROM t1 t;

SELECT id FROM t1 WHERE _metadata.file_name IN
                        (SELECT _metadata.file_name FROM t2 WHERE amount > 100);

SELECT _metadata.* FROM t2;

SELECT t2._metadata.* FROM t2;

-- _metadata.* alongside regular columns (csv)
SELECT id, category, _metadata.* FROM t2 ORDER BY id;

-- _metadata.* in Aggregate
SELECT _metadata.*, COUNT(*) AS cnt FROM t1 GROUP BY ALL ORDER BY _metadata.file_name;

-- Cleanup
DROP TABLE t1;

select typeof(true);

select typeof(date '1986-05-23'),  typeof(timestamp '1986-05-23'), typeof(interval '23 days');

-- Spark-32793: Rewrite AssertTrue with RaiseError
SELECT assert_true(true), assert_true(boolean(1));

SELECT assert_true(null);

CREATE TEMPORARY VIEW tbl_misc AS SELECT * FROM (VALUES (1), (8), (2)) AS T(v);

-- Too many parameters
SELECT raise_error('error message', Map());

-- Passing null as message
SELECT raise_error(NULL);

SELECT raise_error('hello');

-- hmac
SELECT hex(hmac('key', 'message'));

SELECT lower(hex(hmac('key', 'message', 'sha256')));

SELECT hmac('key', CAST(NULL AS BINARY));

-- xxh3_64 and xxh3_128
SELECT xxh3_64('Spark');

SELECT xxh3_128(CAST('Spark' AS BINARY));

-- farm_fingerprint
SELECT farm_fingerprint('Spark');

-- Matches BigQuery FARM_FINGERPRINT.
SELECT farm_fingerprint(concat(CAST(1 AS STRING), 'foo', CAST(true AS STRING)));

-- Non-string and non-binary input is rejected.
SELECT farm_fingerprint(1);

SELECT mode(department), mode(salary) FROM basic_pays;

-- SPARK-45034: Support deterministic mode function
SELECT mode(col) FROM VALUES (-10), (0), (10) AS tab(col);

SELECT mode(col, 'true') FROM VALUES (-10), (0), (10) AS tab(col);

SELECT mode(col) FROM VALUES (map(1, 'a')) AS tab(col);

SELECT
  mode() WITHIN GROUP (ORDER BY col),
  mode() WITHIN GROUP (ORDER BY col DESC)
FROM VALUES (null), (null), (null) AS tab(col);

SELECT
  mode() WITHIN GROUP (ORDER BY salary),
  mode() WITHIN GROUP (ORDER BY salary) FILTER (WHERE salary > 10000)
FROM basic_pays;

SELECT
    employee_name,
    department,
    salary,
    mode() WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY department ORDER BY salary)
FROM basic_pays
ORDER BY salary;

SELECT
  mode(DISTINCT salary) WITHIN GROUP (ORDER BY salary)
FROM basic_pays;

CREATE OR REPLACE TEMPORARY VIEW intervals AS SELECT * FROM VALUES
(0, INTERVAL '0' MONTH, INTERVAL '0' SECOND, INTERVAL '0' MINUTE),
(0, INTERVAL '10' MONTH, INTERVAL '10' SECOND, INTERVAL '10' MINUTE),
(0, INTERVAL '20' MONTH, INTERVAL '20' SECOND, INTERVAL '20' MINUTE),
(0, INTERVAL '30' MONTH, INTERVAL '30' SECOND, INTERVAL '30' MINUTE),
(0, INTERVAL '40' MONTH, INTERVAL '40' SECOND, INTERVAL '40' MINUTE),
(1, INTERVAL '10' MONTH, INTERVAL '10' SECOND, INTERVAL '10' MINUTE),
(1, INTERVAL '20' MONTH, INTERVAL '20' SECOND, INTERVAL '20' MINUTE),
(2, INTERVAL '10' MONTH, INTERVAL '10' SECOND, INTERVAL '10' MINUTE),
(2, INTERVAL '20' MONTH, INTERVAL '20' SECOND, INTERVAL '20' MINUTE),
(2, INTERVAL '25' MONTH, INTERVAL '25' SECOND, INTERVAL '25' MINUTE),
(2, INTERVAL '30' MONTH, INTERVAL '30' SECOND, INTERVAL '30' MINUTE),
(3, INTERVAL '60' MONTH, INTERVAL '60' SECOND, INTERVAL '60' MINUTE),
(4, null, null, null)
AS intervals(k, dt, ym, dt2);

CREATE OR REPLACE TEMPORARY VIEW v1 AS SELECT col1 FROM VALUES
  (42), (17), (99), (5), (42),
  (23), (8), (17), (76), (33),
  (99), (55), (3), (42), (8);

SELECT 2 AS col1 FROM v1 GROUP BY ALL ORDER BY col1;

SELECT * FROM (
  SELECT col1 AS c, 2 AS col1 FROM v1 GROUP BY ALL ORDER BY col1
) ORDER BY 1;

SELECT 2 AS col1, 3 AS col1 FROM v1 GROUP BY ALL ORDER BY col1;

SELECT col1 AS c, 2 AS col1, 3 AS col1 FROM v1 GROUP BY ALL ORDER BY col1;

SELECT col1, 2 AS col1 FROM v1 GROUP BY ALL ORDER BY col1;

SELECT 3 AS col1 FROM (SELECT 1 AS col1, 2 AS col1) GROUP BY ALL ORDER BY col1;

SELECT col1 AS c, 3 AS col1 FROM (SELECT 1 AS col1, 2 AS col1) GROUP BY ALL ORDER BY col1;

SELECT 'col1' FROM v2 GROUP BY ALL ORDER BY col1;

SELECT * FROM (
  SELECT col1 AS c, 'col1' FROM v2 GROUP BY ALL ORDER BY col1
) ORDER BY 1;

SELECT 'col1', 'col1' FROM v2 GROUP BY ALL ORDER BY col1;

SELECT col1 AS c, 'col1', 'col1' FROM v2 GROUP BY ALL ORDER BY col1;

SELECT col1, 'col1' FROM v2 GROUP BY ALL ORDER BY col1;

SELECT 'col1' FROM (SELECT 'a' AS col1, 'b' AS col1) GROUP BY ALL ORDER BY col1;

SELECT col1 AS c, 'col1' FROM (SELECT 'a' AS col1, 'b' AS col1) GROUP BY ALL ORDER BY col1;

-- Test for named arguments for Mask
SELECT mask('AbCD123-@$#', lowerChar => 'q', upperChar => 'Q', otherChar => 'o', digitChar => 'd');

SELECT mask(lowerChar => 'q', upperChar => 'Q', digitChar => 'd', str => 'AbCD123-@$#');

SELECT hex(count_min_sketch(seed => 1, epsilon => 0.5d, confidence => 0.5d, column => t2d)) FROM t2;

SELECT * FROM explode_outer(collection => map('a', 1, 'b', 2));

SELECT num, val, 'Spark' FROM explode(map(1, 'a', 2, 'b')) AS t(num, val);

SELECT * FROM posexplode(array(1, 2)), posexplode(array(3, 4));

-- Test for tabled value functions inline and inline_outer
SELECT * FROM inline(input => array(struct(1, 'a'), struct(2, 'b')));

SELECT * FROM inline(array(struct(1, 'a'), struct(2, 'b'))) AS t, LATERAL inline(array(struct(3 * t.col1, 4 * t.col1)));

SELECT * FROM explode(collection => explode(collection => array(1)));

-- Unexpected positional argument
SELECT mask(lowerChar => 'q', 'AbCD123-@$#', upperChar => 'Q', otherChar => 'o', digitChar => 'd');

-- Required parameter not found
SELECT mask(lowerChar => 'q', upperChar => 'Q', otherChar => 'o', digitChar => 'd');

-- Wrong number of arguments
SELECT mask('AbCD123-@$#', 'Q', 'q', 'd', 'o', 'k');

-- Basic named window reference: OVER w with WINDOW clause.
SELECT n_nationkey, n_name, sum(n_nationkey) OVER w AS ws
FROM nation
WINDOW w AS (ORDER BY n_nationkey)
ORDER BY n_nationkey;

-- Multiple named windows with different specs, each used by a different function.
SELECT n_regionkey, n_nationkey,
       sum(n_nationkey) OVER w1 AS running_sum,
       rank() OVER w2 AS rgn_rank
FROM nation
WINDOW
  w1 AS (ORDER BY n_nationkey),
  w2 AS (PARTITION BY n_regionkey ORDER BY n_nationkey)
ORDER BY n_nationkey;

-- Multiple windows aliasing the same inline spec: w2 and w3 both reference w1.
SELECT n_nationkey,
       sum(n_nationkey) OVER w2 AS s2,
       rank() OVER w3 AS r3
FROM nation
WINDOW w1 AS (ORDER BY n_nationkey), w2 AS w1, w3 AS w1
ORDER BY n_nationkey;

-- OVER w without a WINDOW clause should produce an error.
SELECT sum(n_nationkey) OVER w FROM nation;

-- Named window inside a FROM subquery works independently of the outer query.
SELECT * FROM (
  SELECT n_nationkey, sum(n_nationkey) OVER w AS s
  FROM nation
  WINDOW w AS (ORDER BY n_nationkey)
) sub
ORDER BY n_nationkey;

-- Outer WINDOW clause is not visible inside a CTE body (error).
WITH cte AS (
  SELECT sum(n_nationkey) OVER w AS s FROM nation
)
SELECT * FROM cte
WINDOW w AS (ORDER BY n_nationkey);

-- Outer WINDOW w is not visible inside a correlated scalar subquery (error).
SELECT n_nationkey,
  (SELECT sum(r_regionkey) OVER w FROM region WHERE r_regionkey = n_regionkey) AS s
FROM nation
WINDOW w AS (ORDER BY n_nationkey)
ORDER BY n_nationkey;

-- Both UNION branches define WINDOW w with different specs; each resolves independently.
SELECT n_nationkey, sum(n_nationkey) OVER w AS s
FROM nation
WINDOW w AS (ORDER BY n_nationkey ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
UNION ALL
SELECT r_regionkey, sum(r_regionkey) OVER w AS s
FROM region
WINDOW w AS (ORDER BY r_regionkey RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
ORDER BY 1, 2;

create temporary view nt1 as select * from values
  ("one", 1),
  ("two", 2),
  ("three", 3)
  as nt1(k, v1);

SELECT * FROM nt1 natural join nt2;

SELECT * FROM nt1 natural right join nt2 order by v1, v2;

SELECT k FROM nt1 natural join nt2 where k = "one";

SELECT sbq.* from (SELECT * FROM nt1 natural join nt2) sbq;

SELECT *, nt2.k FROM nt1 natural join nt2;

SELECT nt2.k AS key FROM nt1 natural join nt2 ORDER BY key;

SELECT * FROM (SELECT nt1.*, nt2.* FROM nt1 natural join nt2);

SELECT * FROM nt1 natural join nt2 natural join nt3;

SELECT * FROM nt1 natural join nt2 join nt3 on nt1.k = nt3.k;

SELECT * FROM (SELECT 1 AS ID) t1 NATURAL JOIN (SELECT 1 AS id) t2;

-- SPARK-39448
SET spark.sql.optimizer.excludedRules=org.apache.spark.sql.catalyst.optimizer.ReplaceCTERefWithRepartition;

WITH tmp AS (
  SELECT id FROM range(2)
  INTERSECT
  SELECT id FROM range(4)
)
SELECT id FROM range(3) WHERE id > (SELECT max(id) FROM tmp);

-- Create a test table with data
create table t1(a int, b int, c int) using parquet;

insert into t1 values(3,1,0);

insert into t1 values(6,null,1);

select b + 0 from t1 where a = 5;

-- nulls are NOT distinct in SELECT DISTINCT
select distinct b from t1;

select a+30, case c when b then 1 else 0 end from t1;

select a+60, case when b<>0 and c<>0 then 1 else 0 end from t1;

select a+90, case when not (b<>0 or c<>0) then 1 else 0 end from t1;

select a+110 from t1 where not b>10;

select a+140 from t1 where not (b<10 AND c=1);

-- count(null) should be 0
SELECT COUNT(NULL) FROM VALUES 1, 2, 3;

SELECT COUNT(1 + NULL) OVER () FROM VALUES 1, 2, 3;

select -5.2;

select -(key + 1), - key + 1, +(key + 5) from testdata where key = 1;

select + (-key) from testdata where key = 32;

select - + 20;

select + - key from testdata where key = 33;

select 5 / null;

select 5 div 0;

select cast(51 as decimal(10, 0)) div cast(2 as decimal(2, 0));

select cast(null as decimal(1, 0)) div cast(5 as decimal(2, 0));

select 2 * 5;

-- math functions
select sec(1);

select sec(-1);

select csc(0);

select cot(null);

-- ceil and ceiling
select ceiling(0);

select ceiling(1234567890123456);

-- floor
select floor(0);

select floor(0.01);

-- mod
select mod(7, 2), mod(7, 0), mod(0, 2), mod(7, null), mod(null, 2), mod(null, null);

select CHARACTER_LENGTH('abc');

-- positive/negative
select positive('-1.11'), positive(-1.11), negative('-1.11'), negative(-1.11);

-- width_bucket
select width_bucket(5.35, 0.024, 10.06, 5);

select width_bucket(5.35, 0.024, 10.06, 2.5);

select width_bucket(5.35, null, 10.06, 5);

select width_bucket(5.35, 0.024, 10.06, -5);

-- ORDER BY alias should work with case insensitive names
SELECT a FROM testData ORDER BY A;

SELECT 1 AS k FROM testData ORDER BY 'k';

SELECT 1 AS a FROM testData ORDER BY `a`;

-- ORDER BY more than one row
SELECT a FROM testData ORDER BY (SELECT b FROM testData);

-- ORDER BY alias with invalid col in SELECT list
SELECT a AS k, c FROM testData ORDER BY k;

SELECT 1 AS `2` FROM VALUES (2) t (`2`) ORDER BY `2`;

-- most basic test with only 1 column
select g from data order by all;

-- asc/desc
select * from data order by all asc;

select * from data order by all nulls last;

select * from data order by all asc nulls last;

select * from data union select * from data order by all;

-- shouldn't work in window functions
select name, dept, rank() over (partition by dept order by all) as rank
from values('Lisa', 'Sales', 10000, 35) as T(name, dept, salary, age);

CREATE OR REPLACE TEMPORARY VIEW v2 AS SELECT * FROM VALUES
  (1, 2),
  (5, 9),
  (8, 4),
  (7, 5),
  (4, 9),
  (3, 1),
  (7, 2),
  (6, 8),
  (9, 7),
  (2, 3),
  (8, 3),
  (5, 7),
  (1, 6),
  (3, 2),
  (9, 8);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY v1.col1;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY v2.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 ORDER BY 1 + v1.col1, 2 + v1.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 ORDER BY 1 + v2.col1, 2 + v1.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY MAX(v1.col1);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY MAX(v2.col2);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 ORDER BY 1 + MAX(v1.col1), 2 + MIN(v1.col2);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 ORDER BY 1 + MAX(v2.col1), 2 + MIN(v1.col2);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY v1.col1;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY v2.col2;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 ORDER BY 1 + v1.col1, 2 + v1.col2;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 ORDER BY 1 + v2.col1, 2 + v1.col2;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY MAX(v1.col1);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 ORDER BY MAX(v2.col2);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 ORDER BY 1 + MAX(v1.col1), 2 + MIN(v1.col2);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 ORDER BY 1 + MAX(v2.col1), 2 + MIN(v1.col2);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v1.col1 > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v2.col2 > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + v1.col1 > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 HAVING 1 + v2.col1 > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v1.col1) > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v2.col2) > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + MAX(v1.col1) > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 HAVING 1 + MAX(v2.col1) > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v1.col1 > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v2.col2 > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + v1.col1 > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 HAVING 1 + v2.col1 > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v1.col1) > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v2.col2) > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + MAX(v1.col1) > 5;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 HAVING 1 + MAX(v2.col1) > 5;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v1.col1 > 5 ORDER BY v1.col1;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v2.col2 > 5 ORDER BY v2.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + v1.col1 > 5 ORDER BY 1 + v1.col1, 2 + v1.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v2.col2 + 2 HAVING 1 + v2.col1 > 5 ORDER BY 1 + v2.col1, 2 + v1.col2;

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v1.col1) > 5 ORDER BY MAX(v1.col1);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v2.col2) > 5 ORDER BY MAX(v2.col2);

SELECT SUM(col2) FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + MAX(v1.col1) > 5 ORDER BY 1 + MAX(v1.col1), 2 + MIN(v1.col2);

-- ORDER BY and HAVING with LCA below

-- Referencing a grouping attribute

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY col1 HAVING col1 > 5 ORDER BY col1;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING v1.col2 > 5 ORDER BY v1.col2;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY col1 + 1, col2 + 2 HAVING 1 + col1 > 5 ORDER BY 1 + col1, 2 + col2;

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + v1.col2 > 5 ORDER BY 1 + v1.col2, 2 + v1.col1;

-- Referencing any attribute under aggregate expression.
-- These mostly fail because Spark does not support referencing any attributes under aggregate expressions in ORDER BY on top of HAVING

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY col1 HAVING MAX(col1) > 5 ORDER BY MAX(col1);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 HAVING MAX(v1.col2) > 5 ORDER BY MAX(v1.col2);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY col1 + 1, col2 + 2 HAVING 1 + MAX(col1) > 5 ORDER BY 1 + MAX(col1), 2 + MIN(col2);

SELECT SUM(col2) AS a, a + 1 AS b, b + 1 AS c FROM v1 NATURAL JOIN v2 GROUP BY v1.col1 + 1, v1.col2 + 2 HAVING 1 + MAX(v1.col2) > 5 ORDER BY 1 + MAX(v1.col2), 2 + MIN(v1.col1);

DROP VIEW IF EXISTS v2;

-- Q3. windowing with order by DESC NULLS LAST
select col1, col2, col3, sum(col2)
    over (partition by col1
       order by col3 desc nulls last, col2
       rows between 2 preceding and 2 following ) as sum_col2
from spark_10747 where col1 = 6 order by sum_col2;

-- Q6. windowing with order by ASC NULLS FIRST
select col1, col2, col3, sum(col2)
    over (partition by col1
       order by col3 asc nulls first, col2
       rows between 2 preceding and 2 following ) as sum_col2
from spark_10747 where col1 = 6 order by sum_col2;

-- Q9. Regular query with ORDER BY DESC NULLS FIRST
SELECT COL1, COL2, COL3 FROM spark_10747 ORDER BY COL3 DESC NULLS FIRST, COL2;

-- Q11. mix datatype for ORDER BY NULLS FIRST|LAST
create table spark_10747_mix(
col1 string,
col2 int,
col3 double,
col4 decimal(10,2),
col5 decimal(20,1))
using parquet;

-- Q14. Regular query with 2 NULLS FIRST columns
select * from spark_10747_mix order by col1 desc nulls first, col5 desc nulls first;

-- order by and sort by ordinal positions

create temporary view data as select * from values
  (1, 1),
  (1, 2),
  (2, 1),
  (2, 2),
  (3, 1),
  (3, 2)
  as data(a, b);

-- order by multiple ordinals
select * from data order by 1 desc, 2 desc;

select * from data order by -1;

-- SPARK-52565: Enforce ordinal resolution before other sort order expressions
set spark.sql.prioritizeOrdinalResolutionInSort.enabled=true;

SELECT a FROM data ORDER BY 'b', 2;

SELECT a FROM data ORDER BY b, 3;

-- turn off order by ordinal
set spark.sql.orderByOrdinal=false;

-- ORDER BY a column from a child's output
SELECT a FROM testData ORDER BY a;

-- ORDER BY a column from grouping expressions list
SELECT b FROM testData GROUP BY a, b ORDER BY a;

-- ORDER BY column can't reference an outer scope
SELECT a, (SELECT b FROM testData GROUP BY b HAVING b > 1 ORDER BY a) FROM testData;

SELECT * FROM testData ORDER BY (SELECT * FROM testData ORDER BY (SELECT a FROM testData ORDER BY b));

-- Order by table column and alias with the same name
SELECT 1 AS col1, col1 FROM VALUES (10) ORDER BY col1;

SELECT a FROM testData ORDER BY CAST(CAST(a AS VARIANT) AS VARIANT);

SELECT a FROM testData ORDER BY ARRAY(CAST(true AS VARIANT));

-- ORDER BY expression is resolved as a semantically equivalent to one in the SELECT list
SELECT SUM(a) + 1 FROM testData ORDER BY SUM(a) + 1;

SELECT MAX(a) + SUM(b) FROM testData ORDER BY SUM(b) + MAX(a);

-- Missing attribute (col2) in ORDER BY is added only once
SELECT col1 FROM VALUES(1,2) GROUP BY col1, col2 ORDER BY col2, col2;

SELECT col1 AS a, col1 FROM VALUES(1) GROUP BY col1 ORDER BY col1 ASC;

SELECT col1 AS a, SUM(col2) AS b, CASE WHEN col1 = 1 THEN 1 END AS c FROM VALUES(1,2) GROUP BY col1 ORDER BY CASE WHEN col1 = 1 THEN 1 END ASC;

SELECT a FROM testData ORDER BY a, max(a) OVER ();

SELECT a FROM testData DISTRIBUTE BY a, max(a) OVER ();

SELECT a FROM testData ORDER BY a, 1 + max(a) OVER ();

SELECT a FROM testData SORT BY a, max(a) OVER ();

SELECT a FROM testData DISTRIBUTE BY a, max(a) OVER () SORT BY a;

-- Clean up
DROP VIEW IF EXISTS testData;

SELECT
  (SUM(COALESCE(t1.int_col1, t2.int_col0))),
     ((COALESCE(t1.int_col1, t2.int_col0)) * 2)
FROM t1
RIGHT JOIN t2
  ON (t2.int_col0) = (t1.int_col1)
GROUP BY GREATEST(COALESCE(t2.int_col1, 109), COALESCE(t1.int_col1, -449)),
         COALESCE(t1.int_col1, t2.int_col0)
HAVING (SUM(COALESCE(t1.int_col1, t2.int_col0)))
            > ((COALESCE(t1.int_col1, t2.int_col0)) * 2);

SELECT *
FROM (
SELECT
    COALESCE(t2.int_col1, t1.int_col1) AS int_col
    FROM t1
    LEFT JOIN t2 ON false
) t where (t.int_col) is not null;

-- Column wins over parameterless function.
SELECT current_user FROM v_user;

-- Parameterless function wins over outer reference.
SELECT (SELECT current_user) = current_user() AS function_won FROM v_user;

DROP TEMPORARY VARIABLE current_user;

-- Parameterless function wins over outer reference (user / session_user).
WITH t1 AS (SELECT 1 AS user)
SELECT (SELECT user) = current_user() AS function_won FROM t1;

DROP VIEW v_user;

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1
  UNION
  SELECT 2
  UNION
  SELECT 3
  UNION
  SELECT 4;

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1, 'a' AS a
  UNION
  SELECT 2, 'b'
  UNION
  SELECT 3, 'c'
  UNION
  SELECT 4, 'd';

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1
  EXCEPT
  SELECT 2
  EXCEPT
  SELECT 1
  EXCEPT
  SELECT 2;

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1, 'a' AS a
  EXCEPT
  SELECT 2, 'b'
  EXCEPT
  SELECT 1, 'a'
  EXCEPT
  SELECT 2, 'b';

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1
  INTERSECT
  SELECT 1
  INTERSECT
  SELECT 2
  INTERSECT
  SELECT 2;

CREATE OR REPLACE TEMPORARY VIEW v1 AS
  SELECT 1, 'a' AS a
  INTERSECT
  SELECT 1, 'a'
  INTERSECT
  SELECT 2, 'b'
  INTERSECT
  SELECT 2, 'b';

CREATE OR REPLACE VIEW v1 WITH SCHEMA EVOLUTION AS
  SELECT 1 AS num, 'a'
  UNION
  SELECT 2, 'b'
  UNION
  SELECT 3, 'c'
  UNION
  SELECT 4, 'd';

EXECUTE IMMEDIATE 'SELECT 1 UNION SELECT 2 UNION SELECT 3' INTO v1;

EXECUTE IMMEDIATE 'SELECT 1 EXCEPT SELECT 2 EXCEPT SELECT 3' INTO v1;

EXECUTE IMMEDIATE 'SELECT 1 INTERSECT SELECT 1 INTERSECT SELECT 1' INTO v1;

EXECUTE IMMEDIATE 'SELECT 1 alias garbage garbage garbage' INTO v1;

-- Use keywords as attribute names
select from_csv('1', 'create INT');

select from_json('{"cube":1}', 'cube INT');

-- ANALYZE types literals without catalog objects
SELECT parse_sql('SELECT 1 AS a', 'ANALYZE');

SELECT get_json_object(parse_sql('SELECT a FROM missing_parse_sql_analyze_t', 'ANALYZE'),
  '$[0].analyze_success');

SELECT get_json_object(parse_sql('SELECT a FROM missing_parse_sql_analyze_t', 'ANALYZE'),
  '$[0].source_table_references[0][1]');

DROP VIEW parse_sql_analyze_v;

DROP TABLE parse_sql_analyze_t;

-- ANALYZE inherits the invoker schema
CREATE DATABASE parse_sql_ctx_a;

SELECT get_json_object(parse_sql('SELECT a FROM t', 'ANALYZE'), '$[0].analyze_success');

DROP TABLE parse_sql_ctx_a.t;

-- End-to-end coverage for parse_sql (SPARK-59255).
-- Returns a compact JSON array for parse-only SQL batch analysis via SparkSqlParser.
-- Off by default while the JSON contract is still evolving.


-- null input
SELECT parse_sql(NULL);

SELECT parse_sql('select 1; select 2');

-- JSON-path access over one shared successful parse result
SELECT
  get_json_object(result, '$[0].statement_identifier') AS statement_identifier,
  get_json_object(result, '$[0].source_table_references[0][0]') AS first_table,
  get_json_object(result, '$[0].select_list[1].name[0]') AS second_column
FROM (SELECT parse_sql('SELECT a, b FROM t') AS result);

SELECT parse_sql('UPDATE t SET a = 1 WHERE b = 2');

SELECT parse_sql('CREATE TABLE t AS SELECT 1 AS a');

-- TABLE / VALUES are SELECT-shaped (not Unrecognized)
SELECT parse_sql('TABLE t');

SELECT parse_sql('DECLARE VARIABLE x INT');

-- CTE shadowing is scoped: the inner CTE real_t does not hide the outer table
SELECT parse_sql('SELECT * FROM real_t WHERE EXISTS (WITH real_t AS (SELECT * FROM inner_base) SELECT * FROM real_t)');

-- functions in projection, window, join, TVF, predicates, subquery, grouping, and ordering
SELECT parse_sql(
'SELECT coalesce(t.a, 0), sum(abs(t.b)) OVER (
   PARTITION BY lower(t.c) ORDER BY length(t.d))
 FROM left_t t
 JOIN right_t r ON hash(t.id) = hash(r.id)
 JOIN LATERAL range(cast(t.n AS BIGINT)) rng
 WHERE startswith(t.c, ''x'')
   AND EXISTS (SELECT max(s.v) FROM scalar_t s WHERE s.id = t.id)
 GROUP BY coalesce(t.a, 0), t.b, t.c, t.d
 HAVING count_if(t.b > 0) > 0
 ORDER BY greatest(t.a, 1)');

-- syntax error: dump the complete STANDARD error, including query context
SELECT parse_sql('SELEC FROM t');

-- JSON-path access over one shared multiline parse result
SELECT
  get_json_object(result, '$[0].error.errorClass') AS error_class,
  get_json_object(result, '$[0].error.line') AS line,
  get_json_object(result, '$[0].error.position') AS position,
  get_json_object(result, '$[0].error.queryContext[0].startIndex') AS start_index
FROM (
  SELECT parse_sql(
'SELECT *
 FROM t
 ORDER BY a
 CLUSTER BY b') AS result
);

SELECT parse_sql('WITH c AS (SELECT 1), c AS (SELECT 2) SELECT * FROM c');

SELECT parse_sql('SET spark.sql.adaptive.enabled=true');

SELECT parse_sql('SELECT 1 AS IDENTIFIER(''alias.field'')');

SELECT
  get_json_object(result, '$[1].start') AS start,
  get_json_object(result, '$[1].length') AS length,
  get_json_object(result, '$[1].error.errorClass') AS error_class,
  get_json_object(result, '$[1].error.line') AS line,
  get_json_object(result, '$[1].error.position') AS position,
  get_json_object(result, '$[1].error.queryContext[0].fragment') AS fragment
FROM (
  SELECT parse_sql(
'BEGIN
   SELECT 1;
   SELEC 2;
 END') AS result
);

-- batch over a column of SQL text
SELECT sql_text, parse_sql(sql_text) FROM VALUES
  ('SELECT 1'),
  ('INSERT INTO t SELECT 1'),
  ('CACHE TABLE t')
AS t(sql_text);

SELECT parse_sql('BEGIN SELECT * FROM t WHERE a = ?; END');

SELECT parse_sql(
'BEGIN
   DECLARE EXIT HANDLER FOR SQLEXCEPTION
   BEGIN
     INSERT INTO error_log
     SELECT format_string(''%s'', message) FROM error_source;
   END;

   WITH prepared AS (
     SELECT id, normalize_name(name) AS name
     FROM input_names
     WHERE is_valid(id)
   )
   INSERT INTO output_names
   SELECT id, upper(name) FROM prepared;

   IF EXISTS (SELECT 1 FROM control_flags WHERE enabled()) THEN
     UPDATE update_target
     SET value = coalesce((SELECT max(value) FROM update_source), 0)
     WHERE should_update(id);
   ELSE
     DELETE FROM delete_target
     WHERE id IN (SELECT id FROM delete_source WHERE expired(ts));
   END IF;

   FOR row AS
     SELECT id FROM loop_source WHERE ready(id)
   DO
     SELECT audit(row.id), count(*) FROM loop_body;
   END FOR;
 END');

-- Test data.
CREATE OR REPLACE TEMPORARY VIEW aggr AS SELECT * FROM VALUES
(0, 0), (0, 10), (0, 20), (0, 30), (0, 40), (1, 10), (1, 20), (2, 10), (2, 20), (2, 25), (2, 30), (3, 60), (4, null)
AS aggr(k, v);

SELECT
  k,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY v),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY v) FILTER (WHERE k > 0),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY v DESC),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY v DESC) FILTER (WHERE k > 0)
FROM aggr
GROUP BY k
ORDER BY k;

SELECT
  median(v),
  percentile(v, 0.5),
  percentile_cont(0.5) WITHIN GROUP (ORDER BY v)
FROM aggr;

SELECT
  percentile(v, 0.5) WITHIN GROUP (ORDER BY v)
FROM aggr;

SELECT
  percentile_cont(DISTINCT 0.5) WITHIN GROUP (ORDER BY v) OVER (PARTITION BY k)
FROM aggr;

SELECT
  percentile_cont(0.5)
FROM aggr;

SELECT
  percentile_cont(k, 0.5) WITHIN GROUP (ORDER BY v)
FROM aggr;

SELECT
    employee_name,
    department,
    salary,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY department ORDER BY salary),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER (PARTITION BY department ORDER BY salary)
FROM basic_pays
ORDER BY salary;

SELECT
    employee_name,
    department,
    salary,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary) OVER (PARTITION BY department ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING),
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER (PARTITION BY department ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING)
FROM basic_pays
ORDER BY salary;

SELECT
    employee_name,
    department,
    salary,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary) OVER w,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary) OVER w,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER w,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER w
FROM basic_pays
WINDOW w AS (PARTITION BY department)
ORDER BY salary;

SELECT
    employee_name,
    department,
    salary,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary) OVER w,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER w
FROM basic_pays
WINDOW w AS (PARTITION BY department ORDER BY salary)
ORDER BY salary;

SELECT
    employee_name,
    department,
    salary,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary) OVER w,
    percentile_disc(0.25) WITHIN GROUP (ORDER BY salary DESC) OVER w
FROM basic_pays
WINDOW w AS (PARTITION BY department ROWS BETWEEN UNBOUNDED PRECEDING AND 1 FOLLOWING)
ORDER BY salary;

SELECT
  k,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY ym),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY ym DESC)
FROM intervals
GROUP BY k
ORDER BY k;

SELECT
  k,
  percentile_disc(0.25) WITHIN GROUP (ORDER BY ym),
  percentile_disc(0.25) WITHIN GROUP (ORDER BY ym DESC)
FROM intervals
GROUP BY k
ORDER BY k;

SELECT
  k,
  median(ym),
  percentile(ym, 0.5),
  percentile_cont(0.5) WITHIN GROUP (ORDER BY ym)
FROM intervals
GROUP BY k
ORDER BY k;

SELECT
  percentile_disc(0.0) WITHIN GROUP (ORDER BY a) as p0,
  percentile_disc(0.1) WITHIN GROUP (ORDER BY a) as p1,
  percentile_disc(0.2) WITHIN GROUP (ORDER BY a) as p2,
  percentile_disc(0.3) WITHIN GROUP (ORDER BY a) as p3,
  percentile_disc(0.4) WITHIN GROUP (ORDER BY a) as p4,
  percentile_disc(0.5) WITHIN GROUP (ORDER BY a) as p5,
  percentile_disc(0.6) WITHIN GROUP (ORDER BY a) as p6,
  percentile_disc(0.7) WITHIN GROUP (ORDER BY a) as p7,
  percentile_disc(0.8) WITHIN GROUP (ORDER BY a) as p8,
  percentile_disc(0.9) WITHIN GROUP (ORDER BY a) as p9,
  percentile_disc(1.0) WITHIN GROUP (ORDER BY a) as p10
FROM VALUES (0), (1) AS v(a);

SET spark.sql.legacy.percentileDiscCalculation = true;

-- SPARK-57557: percentile, median and percentile_cont/disc over the TIME type
CREATE OR REPLACE TEMPORARY VIEW aggr_time AS SELECT * FROM VALUES
  (TIME '00:00:00'), (TIME '06:00:00'), (TIME '12:00:00'), (TIME '18:00:00')
AS aggr_time(t);

-- Aggregate function inside an AggregateExpression should be validated using checkInputDataTypes
CREATE OR REPLACE TEMPORARY VIEW aggr_double AS SELECT * FROM VALUES
(1.0D), (2.0D), (3.0D), (4.0D) AS aggr_double(col1);

SELECT percentile(col1, -0.1) FROM aggr_double;

SELECT percentile(col1, col1) FROM aggr_double;

SELECT percentile_disc(1.1) WITHIN GROUP (ORDER BY col1) FROM aggr_double;

SELECT percentile(DISTINCT col1, 1.1) FROM aggr_double;

SELECT percentile(DISTINCT col1, 0.5) FILTER (WHERE col1 > 1) FROM aggr_double;

create table t(x int, y string) using csv;

create table other(a int, b int) using json;

create table st(x int, col struct<i1:int, i2:int>) using parquet;

create temporary view courseEarnings as select * from values
  ("dotNET", 15000, 48000, 22500),
  ("Java", 20000, 30000, NULL)
  as courseEarnings(course, `2012`, `2013`, `2014`);

create temporary view join_test_t1 as select * from values (1) as grouping(a);

create temporary view join_test_empty_table as select a from join_test_t2 where false;

create temporary view lateral_test_t3(c1, c2)
  as values (0, array(0, 1)), (1, array(2)), (2, array()), (null, array(4));

create temporary view natural_join_test_t2 as select * from values
  ("one", 1), ("two", 22), ("one", 5) as natural_join_test_t2(k, v2);

-- FROM operators: positive tests.
----------------------------------

-- FromClause alone.
from t;

-- Selecting using a table alias.
from t as t_alias
|> select t_alias.x;

-- Selecting from multiple relations with join.
from t join other on (t.x = other.a)
|> select t.x + other.a as z;

-- Selecting struct fields using a table alias.
from st as st_alias
|> select st_alias.col.i1;

-- SELECT operators: positive tests.
---------------------------------------

-- Selecting a constant.
table t
|> select 1 as x;

-- Using the VALUES list as the source relation.
values (0), (1) tab(col)
|> select col * 2 as result;

-- Selecting struct fields.
(select col from st)
|> select col.i1;

-- Pipe operator SELECT inside expression subqueries.
select (values (0) tab(col) |> select col) as result;

-- Window functions are allowed in the pipe operator SELECT list.
table t
|> select first_value(x) over (partition by y) as result;

-- DISTINCT is supported.
table t
|> select distinct x, y;

-- Hints are supported.
table t
|> select /*+ repartition(3) */ *;

-- EXTEND operators: positive tests.
------------------------------------

-- Extending with a constant.
table t
|> extend 1 as z;

-- Extending with an expression.
table t
|> extend x + length(y) as z;

-- Extending with a struct field.
select col from st
|> extend col.i1 as z;

-- Extending with a column name that already exists in the input relation.
table t
|> extend 1 as x;

-- EXTEND operators: negative tests.
------------------------------------

-- Aggregations are not allowed.
table t
|> extend sum(x) as z;

-- SET operators: positive tests.
---------------------------------

-- Setting with a constant.
-- The indicated column is not the last column in the table, and the SET operator will replace it
-- with the new value in its existing position.
table t
|> set x = 1;

-- Setting two times.
table t
|> extend 1 as z
|> extend 2 as zz
|> set z = x + length(y), zz = x + 1;

-- Setting two times in sequence.
table t
|> extend 1 as z
|> set z = x + length(y)
|> set z = z + 1;

-- Setting with a subquery.
table t
|> set y = (select a from other where x = a limit 1);

-- Any prior table aliases remain visible after a SET operator.
values (0), (1) lhs(a)
|> inner join values (1), (2) rhs(a) using (a)
|> extend lhs.a + rhs.a as z1
|> extend lhs.a - rhs.a as z2
|> drop z1
|> where z2 = 0
|> order by lhs.a, rhs.a, z2
|> set z2 = 4
|> limit 2
|> select lhs.a, rhs.a, z2;

-- Setting nested fields in structs is not supported.
select col from st
|> set col.i1 = 42;

-- Existing columns are replaced in place and new columns are appended, and each assignment sees
-- the result of the preceding ones.
table t
|> eval z = x + length(y), x = x * 10, zz = z + x;

-- Normalizing rows with assignments that replace some columns and add others.
values ('/API/v1/users', 1200), ('/home', 3500) as web_logs(uri, response_ms)
|> eval duration_s = response_ms / 1000,
        slow = if(duration_s > 2, 1, 0),
        uri = lower(uri),
        is_api = if(uri like '/api/%', 1, 0);

-- With case-sensitive matching, z does not match Z, so both columns are appended.
set spark.sql.caseSensitive=true;

-- A column added by EVAL can be referenced by the following pipe operators.
table t
|> eval z = x + 1
|> where z > 1
|> select z;

table t
|> eval m = (select max(a) from other);

-- EVAL matches only the columns that * expands to, so a hidden metadata column such as _metadata
-- is not replaced: a new column with that name is appended, and later references resolve to it.
table t
|> eval _metadata = x + 1
|> select x, _metadata;

-- EVAL on an empty input.
table t
|> where false
|> eval z = x + 1, x = 0;

select * from pipe_eval_view;

-- EVAL inside a correlated subquery can reference the outer query.
select x, (table other |> eval z = a + x |> aggregate max(z)) as m from t;

select x, * from t
|> eval x = 1;

table t
|> eval x = sum(x);

-- DROP operators: positive tests.
------------------------------------

-- Dropping a column.
table t
|> drop y;

-- Dropping all columns in the input relation.
select x from t
|> drop x;

-- Dropping multiple struct fields using qualified names.
table st
|> drop col.i1, col.i2;

-- Multi-level nested struct field drop.
select 1 as x, named_struct('middle', named_struct('inner', 2)) as outer
|> drop outer.middle.inner;

-- Attempting to drop a column using a backquoted name with dot (looks for a literal column name).
table st
|> drop `col.i1`;

-- Renaming an input relation that is not a table.
select 1 as x, 2 as y
|> as u
|> select u.x, u.y;

-- Filtering by referring to the table or table subquery alias.
table t
|> as u
|> where u.x = 1;

-- Renaming as an invalid name.
table t
|> as u-v;

-- WHERE operators: positive tests.
-----------------------------------

-- Filtering with a constant predicate.
table t
|> where true;

-- It is possible to use the WHERE operator instead of the HAVING clause when processing the result
-- of aggregations. For example, this WHERE operator is equivalent to the normal SQL "HAVING x = 1".
(select x, sum(length(y)) as sum_len from t group by x)
|> where x = 1;

-- Filtering using struct fields.
(select col from st)
|> where col.i1 = 1;

-- Aggregations are allowed within expression subqueries in the pipe operator WHERE clause as long
-- no aggregate functions exist in the top-level expression predicate.
table t
|> where (select any_value(a) from other where x = a limit 1) = 1;

-- Window functions are not allowed in the WHERE clause (pipe operators or otherwise).
-- (Note: to implement this behavior, perform the window function first separately in a SELECT
-- clause and then add a pipe-operator WHERE clause referring to the result of the window function
-- expression(s) therein).
table t
|> where sum(x) over (partition by y) = 1;

-- Pipe operators may only refer to attributes produced as output from the directly-preceding
-- pipe operator, not from earlier ones.
table t
|> select x, length(y) as z
|> where x + length(y) < 4;

table t
|> select x, length(y) as z
|> order by x, y
|> where x + length(y) < 4;

table courseSales
|> select `year` as y, course as c, earnings as e
|> pivot (
     sum(e) as s, avg(e) as a
     for y in (2012 as firstYear, 2013 as secondYear)
   );

table courseEarnings
|> unpivot (
     earningsYear for `year` in (`2012`, `2013`, `2014`)
   );

-- Pivot and unpivot operators: negative tests.
-----------------------------------------------

-- The PIVOT operator refers to a column 'year' is not available in the input relation.
table courseSales
|> select course, earnings
|> pivot (
     sum(earnings)
     for `year` in (2012, 2013)
   );

table courseSales
|> select course, earnings
|> unpivot (
     earningsYear for `year` in (`2012`, `2013`, `2014`)
   )
   pivot (
     sum(earnings)
     for `year` in (2012, 2013)
   );

-- Sampling operators: positive tests.
--------------------------------------

-- We will use the REPEATABLE clause and/or adjust the sampling options to either remove no rows or
-- all rows to help keep the tests deterministic.
table t
|> tablesample (100 percent) repeatable (0);

table t
|> tablesample (100 percent) repeatable (0)
|> tablesample (5 rows) repeatable (0)
|> tablesample (bucket 1 out of 1) repeatable (0);

table t
|> tablesample (-5 rows);

-- Byte literals are not supported.
table t
|> tablesample (200b) repeatable (0);

table join_test_t1
|> cross join join_test_empty_table;

table join_test_t1
|> full outer join join_test_empty_table using (a);

table join_test_t1
|> left anti join join_test_empty_table;

table join_test_t1
|> inner join (join_test_t2 jt2 inner join join_test_t3 jt3 using (a)) using (a)
|> select a, join_test_t1.a, jt2.a, jt3.a;

table join_test_t1
|> join join_test_t1 using (a);

table lateral_test_t1
|> join lateral (select lateral_test_t1.c1 from lateral_test_t2);

table lateral_test_t1
|> join lateral (select * from lateral_test_t2);

table lateral_test_t1
|> join lateral_test_t2
|> join lateral (select lateral_test_t1.c2 + lateral_test_t2.c2);

table natural_join_test_t1
|> natural join natural_join_test_t2 nt2
|> natural join natural_join_test_t3 nt3
|> select natural_join_test_t1.*, nt2.*, nt3.*;

-- The table from the pipe input is not visible as a table name in the right side.
table join_test_t1 jt
|> cross join (select * from jt);

-- Union all with a table subquery.
(select * from t)
|> union all table t;

-- Union distinct with a VALUES list.
-- The |> WHERE operator applies to the result of the |> UNION operator, not to the "table t" input.
values (2, 'xyz') tab(x, y)
|> union table t
|> where x = 0;

-- Except all.
table t
|> except all table t;

-- Intersect distinct.
table t
|> intersect table t;

-- Set operations: negative tests.
----------------------------------

-- The UNION operator requires the same number of columns in the input relations.
table t
|> select x
|> union all table t;

-- Order by with a table subquery.
(select * from t)
|> order by x;

-- Limit with offset.
table t
|> where x = 1
|> select y
|> limit 2 offset 1;

-- Distribute by.
table t
|> distribute by x;

-- It is possible to apply a final ORDER BY clause on the result of a query containing pipe
-- operators.
table t
|> order by x desc
order by y;

-- The DISTRIBUTE BY clause may only refer to column names from the previous input relation.
table t
|> select 1 + 2 as result
|> distribute by x;

-- Aggregation operators: positive tests.
-----------------------------------------

-- Basic aggregation with a GROUP BY clause. The resulting table contains all the attributes from
-- the grouping keys followed by all the attributes from the aggregate functions, in order.
table other
|> aggregate sum(b) as result group by a;

-- Basic aggregation on a constant table.
select 1 as x, 2 as y
|> aggregate group by x, y;

values (3, 4), (5, 4) as tab(x, y)
|> aggregate sum(y) group by 1;

select 3 as x, 4 as y
|> aggregate sum(y) group by 2;

select 3 as x, 4 as y, 5 as z
|> aggregate sum(y) group by 2, 3;

-- Basic table aggregation.
table t
|> aggregate sum(x);

-- Group by an expression on columns, all of which are already grouped.
select 1 as x, 2 as y, 3 as z
|> aggregate group by x, y, x + y as z;

-- Chained aggregates.
select 1 x, 2 y, 3 z
|> aggregate sum(z) z group by x, y
|> aggregate avg(z) z group by x
|> aggregate count(distinct z) c;

-- Aggregation operators: negative tests.
-----------------------------------------

-- All aggregate expressions must contain at least one aggregate function.
table other
|> aggregate a group by a;

-- The AGGREGATE GROUP BY ordinal position is not positive.
select 3 as x, 4 as y
|> aggregate sum(y) group by 0;

select 3 as x, 4 as y
|> aggregate sum(y) group by (2) as grp;

select 3 as x, 4 as y
|> aggregate sum(y) group by 1 + 1 as grp;

select 3 as x, 4 as y
|> aggregate sum(y) group by 2 as grp;

set spark.sql.groupByOrdinal=true;

-- GROUPING SETS is not supported yet.
table courseSales
|> aggregate sum(earnings) group by course, `year` grouping sets(course, `year`)
|> where course = 'dotNET' and `year` = '2013';

-- GROUP BY () is not valid syntax.
select 1 as x, 2 as y
|> aggregate group by ();

-- The AGGREGATE GROUP BY list cannot be empty.
table other
|> aggregate group by;

-- Ambiguous name from AGGREGATE list vs GROUP BY.
select 1 x, 2 y, 3 z
|> aggregate count(*) AS c, sum(x) AS x group by x
|> where c = 1
|> where x = 1;

-- SELECT with a WINDOW clause not being referred in the SELECT list.
table windowTestData
|> select cate, val
    window w as (partition by cate order by val);

-- SELECT with a WINDOW clause for multiple window functions over one window definition
table windowTestData
|> select cate, val, sum(val) over w, first_value(val) over w
   window w1 as (partition by cate order by val);

table st
|> select spark_catalog.default.st.col.i1, sum(spark_catalog.default.st.col.i2) over w
   window w as (partition by spark_catalog.default.st.col.i1 order by spark_catalog.default.st.col.i2);

-- Multiple WINDOW clauses are not supported in the pipe operator SELECT clause.
table windowTestData
|> select cate, val, sum(val) over w1, first_value(cate) over w2
   window w1 as (partition by cate)
   window w2 as (order by val);

-- Exercise SQL compilation using a subset of TPC-DS table schemas.
-------------------------------------------------------------------

-- Q1
with customer_total_return as
(select
    sr_customer_sk as ctr_customer_sk,
    sr_store_sk as ctr_store_sk,
    sum(sr_return_amt) as ctr_total_return
  from store_returns, date_dim
  where sr_returned_date_sk = d_date_sk and d_year = 2000
  group by sr_customer_sk, sr_store_sk)
select c_customer_id
from customer_total_return ctr1, store, customer
where ctr1.ctr_total_return >
  (select avg(ctr_total_return) * 1.2
  from customer_total_return ctr2
  where ctr1.ctr_store_sk = ctr2.ctr_store_sk)
  and s_store_sk = ctr1.ctr_store_sk
  and s_state = 'tn'
  and ctr1.ctr_customer_sk = c_customer_sk
order by c_customer_id
limit 100;

with wscs as
  (table web_sales
  |> select
       ws_sold_date_sk sold_date_sk,
       ws_ext_sales_price sales_price
  |> as x
  |> union all (
       table catalog_sales
       |> select
            cs_sold_date_sk sold_date_sk,
            cs_ext_sales_price sales_price)
  |> select
       sold_date_sk,
       sales_price),
wswscs as
  (table wscs
  |> join date_dim
  |> where d_date_sk = sold_date_sk
  |> aggregate
      sum(case when (d_day_name = 'sunday')
        then sales_price
          else null end)
      sun_sales,
      sum(case when (d_day_name = 'monday')
        then sales_price
          else null end)
      mon_sales,
      sum(case when (d_day_name = 'tuesday')
        then sales_price
          else null end)
      tue_sales,
      sum(case when (d_day_name = 'wednesday')
        then sales_price
          else null end)
      wed_sales,
      sum(case when (d_day_name = 'thursday')
        then sales_price
          else null end)
      thu_sales,
      sum(case when (d_day_name = 'friday')
        then sales_price
          else null end)
      fri_sales,
      sum(case when (d_day_name = 'saturday')
        then sales_price
          else null end)
      sat_sales
      group by d_week_seq)
table wswscs
|> join date_dim
|> where date_dim.d_week_seq = wswscs.d_week_seq AND d_year = 2001
|> select
     wswscs.d_week_seq d_week_seq1,
     sun_sales sun_sales1,
     mon_sales mon_sales1,
     tue_sales tue_sales1,
     wed_sales wed_sales1,
     thu_sales thu_sales1,
     fri_sales fri_sales1,
     sat_sales sat_sales1
|> as y
|> join (
     table wswscs
     |> join date_dim
     |> where date_dim.d_week_seq = wswscs.d_week_seq AND d_year = 2001 + 1
     |> select
          wswscs.d_week_seq d_week_seq2,
          sun_sales sun_sales2,
          mon_sales mon_sales2,
          tue_sales tue_sales2,
          wed_sales wed_sales2,
          thu_sales thu_sales2,
          fri_sales fri_sales2,
          sat_sales sat_sales2
     |> as z)
|> where d_week_seq1 = d_week_seq2 - 53
|> order by d_week_seq1
|> select
     d_week_seq1,
     round(sun_sales1 / sun_sales2, 2),
     round(mon_sales1 / mon_sales2, 2),
     round(tue_sales1 / tue_sales2, 2),
     round(wed_sales1 / wed_sales2, 2),
     round(thu_sales1 / thu_sales2, 2),
     round(fri_sales1 / fri_sales2, 2),
     round(sat_sales1 / sat_sales2, 2);

-- Q12
select
  i_item_desc,
  i_category,
  i_class,
  i_current_price,
  sum(ws_ext_sales_price) as itemrevenue,
  sum(ws_ext_sales_price) * 100 / sum(sum(ws_ext_sales_price))
  over
  (partition by i_class) as revenueratio
from
  web_sales, item, date_dim
where
  ws_item_sk = i_item_sk
    and i_category in ('sports', 'books', 'home')
    and ws_sold_date_sk = d_date_sk
    and d_date between cast('1999-02-22' as date)
  and (cast('1999-02-22' as date) + interval 30 days)
group by
  i_item_id, i_item_desc, i_category, i_class, i_current_price
order by
  i_category, i_class, i_item_id, i_item_desc, revenueratio
limit 100;

from store_sales ss1
|> where ss_store_sk = 4
|> aggregate avg(ss_net_profit) rank_col
     group by ss_item_sk as item_sk
|> where rank_col > 0.9 * (
     from store_sales
     |> where ss_store_sk = 4
          and ss_addr_sk is null
     |> aggregate avg(ss_net_profit) rank_col
          group by ss_store_sk
     |> select rank_col)
|> as v1
|> select
     item_sk,
     rank() over (
       order by rank_col asc) rnk
|> as v11
|> where rnk < 11
|> as asceding
|> join (
     from store_sales ss1
     |> where ss_store_sk = 4
     |> aggregate avg(ss_net_profit) rank_col
          group by ss_item_sk as item_sk
     |> where rank_col > 0.9 * (
          table store_sales
          |> where ss_store_sk = 4
               and ss_addr_sk is null
          |> aggregate avg(ss_net_profit) rank_col
               group by ss_store_sk
          |> select rank_col)
     |> as v2
     |> select
          item_sk,
          rank() over (
            order by rank_col asc) rnk
     |> as v21
     |> where rnk < 11) descending
|> join item i1
|> join item i2
|> where asceding.rnk = descending.rnk
     and i1.i_item_sk = asceding.item_sk
     and i2.i_item_sk = descending.item_sk
|> order by asceding.rnk
|> select
     asceding.rnk,
     i1.i_product_name best_performing,
     i2.i_product_name worst_performing;

-- Single PIPE token syntax (|): positive tests.
--------------------------------------------------
-- Test that the single PIPE token (|) works as an alternative to OPERATOR_PIPE (|>) for all pipe operators.

-- SELECT with single pipe.
table t
| select x, y;

-- EVAL with single pipe.
table t
| eval z = x + length(y), x = z;

-- Mixed single pipe (|) and double pipe (|>) operators in same query.
table t
|> select x, y
| where x < 2
|> extend x + 1 as z
| order by z;

select 1 | extend y;

drop temporary variable extend;

select * from values (1, 2) as v(x, eval) where (x | eval) = 3;

-- Try to use single pipe for SELECT - should fail with parse error.
table t
| select x, y;

-- Verify that single pipe works again after re-enabling.
table t
| select x, y;

-- Aggregates in SELECT with WHERE clause.
table other
|> where b > 1
|> select sum(a) as result;

-- Multiple grouping columns in SELECT.
select 1 as x, 2 as y, 3 as z
|> select x, y, sum(z) as total group by x, y;

-- GROUP BY with expression and alias.
select 1 as x, 2 as y
|> select x + 1 as x_plus_one, sum(y) as sum_y group by x + 1;

-- Aggregates in WHERE are not allowed.
table other
|> where sum(a) > 5;

from values (1, named_struct('a', 10, 'b', 20)) as tab(id, h)
|> select id
|> select h.a;

from values (1, named_struct('a', 10, 'b', 20)) as tab(id, h)
|> aggregate count(*) as c group by id
|> select h.a;

from values (1, named_struct('a', 10, 'b', 20)) as tab(id, h)
|> select id, h
|> select h.*;

from values (1, named_struct('a', 10, 'b', 20)) as tab(id, h)
|> as x
|> select x.h.a;

drop table st;

-- pivot years with no subquery
SELECT * FROM courseSales
PIVOT (
  sum(earnings)
  FOR year IN (2012, 2013)
);

-- pivot with no group by column and with multiple aggregations on different columns
SELECT * FROM (
  SELECT year, course, earnings FROM courseSales
)
PIVOT (
  sum(earnings), min(year)
  FOR course IN ('dotNET', 'Java')
);

-- pivot on join query with multiple columns in one aggregation
SELECT * FROM (
  SELECT course, year, earnings, s
  FROM courseSales
  JOIN years ON year = y
)
PIVOT (
  sum(earnings * s)
  FOR course IN ('dotNET', 'Java')
);

-- pivot years with non-aggregate function
SELECT * FROM courseSales
PIVOT (
  abs(earnings)
  FOR year IN (2012, 2013)
);

-- pivot with complex aggregate expressions
SELECT * FROM (
  SELECT year, course, earnings FROM courseSales
)
PIVOT (
  ceil(sum(earnings)), avg(earnings) + 1 as a1
  FOR course IN ('dotNET', 'Java')
);

-- pivot on multiple pivot columns with aliased values
SELECT * FROM (
  SELECT course, year, earnings, s
  FROM courseSales
  JOIN years ON year = y
)
PIVOT (
  sum(earnings)
  FOR (course, s) IN (('dotNET', 2) as c1, ('Java', 1) as c2)
);

-- pivot with non-literal values
SELECT * FROM courseSales
PIVOT (
  sum(earnings)
  FOR year IN (course, 2013)
);

-- pivot on pivot column of array type
SELECT * FROM (
  SELECT earnings, year, a
  FROM courseSales
  JOIN yearsWithComplexTypes ON year = y
)
PIVOT (
  sum(earnings)
  FOR a IN (array(1, 1), array(2, 2))
);

-- pivot on multiple pivot columns containing struct type
SELECT * FROM (
  SELECT course, earnings, year, s
  FROM courseSales
  JOIN yearsWithComplexTypes ON year = y
)
PIVOT (
  sum(earnings)
  FOR (course, s) IN (('dotNET', (1, 'a')), ('Java', (2, 'b')))
);

-- grouping columns output in the same order as input
-- correctly handle pivot columns with different cases
SELECT * FROM (
  SELECT course, earnings, "a" as a, "z" as z, "b" as b, "y" as y, "c" as c, "x" as x, "d" as d, "w" as w
  FROM courseSales
)
PIVOT (
  sum(Earnings)
  FOR Course IN ('dotNET', 'Java')
);

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- AGGREGATES [Part 1]
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/aggregates.sql#L1-L143

-- avoid bit-exact output here because operations may not be bit-exact.
-- SET extra_float_digits = 0;

-- Test aggregate operator with codegen on and off.




SELECT avg(four) AS avg_1 FROM onek;

-- `student` has a column with data type POINT, which is not supported by Spark [SPARK-27766]
-- SELECT avg(gpa) AS avg_3_4 FROM ONLY student;

SELECT sum(four) AS sum_1500 FROM onek;

-- `student` has a column with data type POINT, which is not supported by Spark [SPARK-27766]
-- SELECT sum(gpa) AS avg_6_8 FROM ONLY student;

SELECT max(four) AS max_3 FROM onek;

-- `student` has a column with data type POINT, which is not supported by Spark [SPARK-27766]
-- SELECT max(student.gpa) AS max_3_7 FROM student;

SELECT stddev_pop(b) FROM aggtest;

SELECT var_samp(b) FROM aggtest;

SELECT var_pop(CAST(b AS Decimal(38,0))) FROM aggtest;

SELECT stddev_pop(CAST(3.0 AS Decimal(38,0))), stddev_samp(CAST(4.0 AS Decimal(38,0)));

select sum(CAST(null AS Decimal(38,0))) from range(1,4);

select avg(CAST(null AS long)) from range(1,4);

select sum(CAST('NaN' AS DOUBLE)) from range(1,4);

SELECT avg(CAST(x AS DOUBLE)), var_pop(CAST(x AS DOUBLE))
FROM (VALUES ('infinity'), ('1')) v(x);

-- test accuracy with a large input offset
SELECT avg(CAST(x AS DOUBLE)), var_pop(CAST(x AS DOUBLE))
FROM (VALUES (100000003), (100000004), (100000006), (100000007)) v(x);

SELECT regr_sxx(b, a) FROM aggtest;

SELECT regr_avgx(b, a), regr_avgy(b, a) FROM aggtest;

SELECT covar_pop(b, a), covar_samp(b, a) FROM aggtest;

SELECT count(*), sum(x), regr_sxx(y,x), sum(y),regr_syy(y,x), regr_sxy(y,x)
FROM regr_test WHERE x IN (10,20,30,80);

SELECT count(*), sum(x), regr_sxx(y,x), sum(y),regr_syy(y,x), regr_sxy(y,x)
FROM regr_test WHERE x IN (80,100);

SELECT count(DISTINCT four) AS cnt_4 FROM onek;

-- user-defined aggregates
-- SELECT newavg(four) AS avg_1 FROM onek;
-- SELECT newsum(four) AS sum_1500 FROM onek;
-- SELECT newcnt(four) AS cnt_1000 FROM onek;
-- SELECT newcnt(*) AS cnt_1000 FROM onek;
-- SELECT oldcnt(*) AS cnt_1000 FROM onek;
-- SELECT sum2(q1,q2) FROM int8_tbl;

-- test for outer-level aggregates

-- this should work
select ten, sum(distinct four) from onek a
group by ten
having exists (select 1 from onek b where sum(distinct a.four) = b.four);

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- AGGREGATES [Part 2]
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/aggregates.sql#L145-L350

-- Test aggregate operator with codegen on and off.




create temporary view int4_tbl as select * from values
  (0),
  (123456),
  (-123456),
  (2147483647),
  (-2147483647)
  as int4_tbl(f1);

-- null case
SELECT BIT_AND(b4) AS n1, BIT_OR(b4)  AS n2 FROM bitwise_test where b4 is null;

--having
SELECT b1, bit_and(b2) FROM bitwise_test GROUP BY b1 HAVING bit_and(b2) < 7;

--
-- test boolean aggregates
--
-- first test all possible transition and final states

-- The result is inconsistent with PostgreSQL because our AND does not have strict mode
SELECT
  -- boolean and transitions
  -- null because strict
  (NULL AND NULL) IS NULL AS `t`,
  (TRUE AND NULL) IS NULL AS `t`,
  (FALSE AND NULL) IS NULL AS `t`,
  (NULL AND TRUE) IS NULL AS `t`,
  (NULL AND FALSE) IS NULL AS `t`,
  -- and actual computations
  (TRUE AND TRUE) AS `t`,
  NOT (TRUE AND FALSE) AS `t`,
  NOT (FALSE AND TRUE) AS `t`,
  NOT (FALSE AND FALSE) AS `t`;

-- empty case
SELECT BOOL_AND(b1) AS n1, BOOL_OR(b3) AS n2 FROM bool_test WHERE 1 = 0;

SELECT
  BOOL_OR(b1)      AS t1,
  BOOL_OR(b2)      AS t2,
  BOOL_OR(b3)      AS f3,
  BOOL_OR(b4)      AS n4,
  BOOL_OR(NOT b2)  AS f5,
  BOOL_OR(NOT b3)  AS t6
FROM bool_test;

-- explain
--  select max(unique1) from tenk1 where unique1 < 42;
select max(unique1) from tenk1 where unique1 < 42;

-- rollback;

-- multi-column index (uses tenk1_thous_tenthous)
-- explain
--  select max(tenthous) from tenk1 where thousand = 33;
select max(tenthous) from tenk1 where thousand = 33;

-- explain
--  select max(unique2) from tenk1 order by 1;
select max(unique2) from tenk1 order by 1;

-- explain
--  select max(unique2), generate_series(1,3) as g from tenk1 order by g desc;
select t1.max_unique2, g from (select max(unique2) as max_unique2 FROM tenk1) t1 LATERAL VIEW explode(array(1,2,3)) t2 AS g order by g desc;

-- select (select max(min(unique1)) from int8_tbl) from tenk1;

-- These tests only test the explain. Skip these tests.
--
-- Test removal of redundant GROUP BY columns
--

-- create temp table t1 (a int, b int, c int, d int, primary key (a, b));
-- create temp table t2 (x int, y int, z int, primary key (x, y));
-- create temp table t3 (a int, b int, c int, primary key(a, b) deferrable);

-- Non-primary-key columns can be removed from GROUP BY
-- explain (costs off) select * from t1 group by a,b,c,d;

-- No removal can happen if the complete PK is not present in GROUP BY
-- explain (costs off) select a,c from t1 group by a,c,d;

-- Test removal across multiple relations
-- explain (costs off) select *
-- from t1 inner join t2 on t1.a = t2.x and t1.b = t2.y
-- group by t1.a,t1.b,t1.c,t1.d,t2.x,t2.y,t2.z;

-- Test case where t1 can be optimized but not t2
-- explain (costs off) select t1.*,t2.x,t2.z
-- from t1 inner join t2 on t1.a = t2.x and t1.b = t2.y
-- group by t1.a,t1.b,t1.c,t1.d,t2.x,t2.z;

-- Cannot optimize when PK is deferrable
-- explain (costs off) select * from t3 group by a,b,c;

-- drop table t1;
-- drop table t2;
-- drop table t3;

-- [SPARK-28664] ORDER BY in aggregate function
--
-- Test combinations of DISTINCT and/or ORDER BY
--

-- select array_agg(a order by b)
--   from (values (1,4),(2,3),(3,1),(4,2)) v(a,b);
-- select array_agg(a order by a)
--   from (values (1,4),(2,3),(3,1),(4,2)) v(a,b);
-- select array_agg(a order by a desc)
--   from (values (1,4),(2,3),(3,1),(4,2)) v(a,b);
-- select array_agg(b order by a desc)
--   from (values (1,4),(2,3),(3,1),(4,2)) v(a,b);

-- select array_agg(distinct a)
--   from (values (1),(2),(1),(3),(null),(2)) v(a);
-- select array_agg(distinct a order by a)
--   from (values (1),(2),(1),(3),(null),(2)) v(a);
-- select array_agg(distinct a order by a desc)
--   from (values (1),(2),(1),(3),(null),(2)) v(a);
-- select array_agg(distinct a order by a desc nulls last)
--   from (values (1),(2),(1),(3),(null),(2)) v(a);

-- Skip the test below because it requires 4 UDAFs: aggf_trans, aggfns_trans, aggfstr, and aggfns
-- multi-arg aggs, strict/nonstrict, distinct/order by

-- select aggfstr(a,b,c)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);
-- select aggfns(a,b,c)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);

-- select aggfstr(distinct a,b,c)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,3) i;
-- select aggfns(distinct a,b,c)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,3) i;

-- select aggfstr(distinct a,b,c order by b)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,3) i;
-- select aggfns(distinct a,b,c order by b)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,3) i;

-- test specific code paths

-- [SPARK-28768] Implement more text pattern operators
-- select aggfns(distinct a,a,c order by c using ~<~,a)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,2) i;
-- select aggfns(distinct a,a,c order by c using ~<~)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,2) i;
-- select aggfns(distinct a,a,c order by a)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,2) i;
-- select aggfns(distinct a,b,c order by a,c using ~<~,b)
--   from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--        generate_series(1,2) i;

-- check node I/O via view creation and usage, also deparsing logic

-- create view agg_view1 as
--   select aggfns(a,b,c)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(distinct a,b,c)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--          generate_series(1,3) i;

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(distinct a,b,c order by b)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--          generate_series(1,3) i;

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(a,b,c order by b+1)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(a,a,c order by b)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(a,b,c order by c using ~<~)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c);

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- create or replace view agg_view1 as
--   select aggfns(distinct a,b,c order by a,c using ~<~,b)
--     from (values (1,3,'foo'),(0,null,null),(2,2,'bar'),(3,1,'baz')) v(a,b,c),
--          generate_series(1,2) i;

-- select * from agg_view1;
-- select pg_get_viewdef('agg_view1'::regclass);

-- drop view agg_view1;

-- incorrect DISTINCT usage errors

-- select aggfns(distinct a,b,c order by i)
--   from (values (1,1,'foo')) v(a,b,c), generate_series(1,2) i;
-- select aggfns(distinct a,b,c order by a,b+1)
--   from (values (1,1,'foo')) v(a,b,c), generate_series(1,2) i;
-- select aggfns(distinct a,b,c order by a,b,i,c)
--   from (values (1,1,'foo')) v(a,b,c), generate_series(1,2) i;
-- select aggfns(distinct a,a,c order by a,b)
--   from (values (1,1,'foo')) v(a,b,c), generate_series(1,2) i;

-- [SPARK-27978] Add built-in Aggregate Functions: string_agg
-- string_agg tests
-- select string_agg(a,',') from (values('aaaa'),('bbbb'),('cccc')) g(a);
-- select string_agg(a,',') from (values('aaaa'),(null),('bbbb'),('cccc')) g(a);
-- select string_agg(a,'AB') from (values(null),(null),('bbbb'),('cccc')) g(a);
-- select string_agg(a,',') from (values(null),(null)) g(a);

-- check some implicit casting cases, as per bug #5564
-- select string_agg(distinct f1, ',' order by f1) from varchar_tbl;  -- ok
-- select string_agg(distinct f1::text, ',' order by f1) from varchar_tbl;  -- not ok
-- select string_agg(distinct f1, ',' order by f1::text) from varchar_tbl;  -- not ok
-- select string_agg(distinct f1::text, ',' order by f1::text) from varchar_tbl;  -- ok

-- [SPARK-28121] decode can not accept 'hex' as charset
-- string_agg bytea tests
-- CREATE TABLE bytea_test_table(v BINARY) USING parquet;

-- select string_agg(v, '') from bytea_test_table;

-- insert into bytea_test_table values(decode('ff','hex'));

-- select string_agg(v, '') from bytea_test_table;

-- insert into bytea_test_table values(decode('aa','hex'));

-- select string_agg(v, '') from bytea_test_table;
-- select string_agg(v, NULL) from bytea_test_table;
-- select string_agg(v, decode('ee', 'hex')) from bytea_test_table;

-- drop table bytea_test_table;

-- FILTER tests

select min(unique1) filter (where unique1 > 100) from tenk1;

-- [SPARK-28682] ANSI SQL: Collation Support
-- select max(foo COLLATE "C") filter (where (bar collate "POSIX") > '0')
-- from (values ('a', 'b')) AS v(foo,bar);

-- outer reference in FILTER (PostgreSQL extension)
select (select count(*)
        from (values (1)) t0(inner_c))
from (values (2),(3)) t1(outer_c);

select percentile_cont(0.5) within group (order by thousand) from tenk1;

-- ******************testing built-in type bool********************

-- check bool input syntax

SELECT true AS true;

SELECT boolean('   f           ') AS `false`;

SELECT boolean('false') AS `false`;

SELECT boolean('yes') AS true;

SELECT boolean('no') AS `false`;

SELECT boolean('off') AS `false`;

-- [SPARK-27923] PostgreSQL does not accept 'on_' but Spark SQL accepts it and sets it to NULL
SELECT boolean('on_') AS error;

-- [SPARK-27923] PostgreSQL does not accept '11' but Spark SQL accepts it and sets it to NULL
SELECT boolean('11') AS error;

-- [SPARK-27923] PostgreSQL does not accept '' but Spark SQL accepts it and sets it to NULL
SELECT boolean('') AS error;

SELECT not boolean('f') AS true;

SELECT boolean('t') > boolean('f') AS true;

SELECT boolean('f') <= boolean('t') AS true;

SELECT string(boolean(true)) AS true, string(boolean(false)) AS `false`;

-- error

CREATE TABLE BOOLTBL1 (f1 boolean) USING parquet;

-- BOOLTBL1 should be full of true's at this point
SELECT '' AS t_3, BOOLTBL1.* FROM BOOLTBL1;

SELECT '' AS zero, BOOLTBL1.*
   FROM BOOLTBL1
   WHERE booleq(boolean('false'), f1);

CREATE TABLE BOOLTBL2 (f1 boolean) USING parquet;

-- [SPARK-27923] PostgreSQL does not accept 'XXX' but Spark SQL accepts it and sets it to NULL
-- This is now an invalid expression
-- For pre-v6.3 this evaluated to false - thomas 1997-10-23
INSERT INTO BOOLTBL2
   VALUES (boolean('XXX'));

SELECT '' AS tf_12, BOOLTBL1.*, BOOLTBL2.*
   FROM BOOLTBL1, BOOLTBL2
   WHERE boolne(BOOLTBL2.f1,BOOLTBL1.f1);

-- [SPARK-27924] E061-14: Search Conditions
--
-- SQL syntax
-- Try all combinations to ensure that we get nothing when we expect nothing
-- - thomas 2000-01-04
--

SELECT '' AS True, f1
   FROM BOOLTBL1
   WHERE f1 IS TRUE;

SELECT '' AS `Not True`, f1
   FROM BOOLTBL1
   WHERE f1 IS NOT TRUE;

SELECT '' AS `False`, f1
   FROM BOOLTBL2
   WHERE f1 IS FALSE;

INSERT INTO BOOLTBL3 VALUES ('true', true, 1);

-- [SPARK-27924] E061-14: Search Conditions
SELECT
    d,
    b IS TRUE AS istrue,
    b IS NOT TRUE AS isnottrue,
    b IS FALSE AS isfalse,
    b IS NOT FALSE AS isnotfalse,
    b IS UNKNOWN AS isunknown,
    b IS NOT UNKNOWN AS isnotunknown
FROM booltbl3 ORDER BY o;

-- \pset null '(null)'

-- AND expression need to return null if there's any nulls and not all
-- of the value are true
SELECT istrue AND isnul AND istrue FROM booltbl4;

SELECT isfalse AND isnul AND istrue FROM booltbl4;

-- OR expression need to return null if there's any nulls and none
-- of the value is true
SELECT isfalse OR isnul OR isfalse FROM booltbl4;

SELECT isfalse OR isnul OR istrue FROM booltbl4;

--
-- Clean up
-- Many tables are retained by the regression test, but these do not seem
--  particularly useful so just get rid of them for now.
--  - thomas 1997-11-30
--

DROP TABLE  BOOLTBL1;

DROP TABLE  BOOLTBL4;

INSERT INTO CASE_TBL VALUES (1, 10.1);

INSERT INTO CASE_TBL VALUES (4, NULL);

INSERT INTO CASE2_TBL VALUES (3, -3);

INSERT INTO CASE2_TBL VALUES (NULL, -6);

SELECT '3' AS `One`,
  CASE
    WHEN 1 < 2 THEN 3
    ELSE 4
  END AS `Simple ELSE`;

SELECT '7' AS `None`,
  CASE WHEN rand() < 0 THEN 1
  END AS `NULL on no matches`;

-- However we do not currently suppress folding of potentially
-- reachable subexpressions
SELECT CASE WHEN i > 100 THEN 1/0 ELSE 0 END FROM case_tbl;

SELECT '' AS `Five`,
  CASE WHEN i >= 3 THEN (i + i)
       ELSE i
  END AS `Simplest Math`
  FROM CASE_TBL;

--
-- Examples of qualifications involving tables
--

--
-- NULLIF() and COALESCE()
-- Shorthand forms for typical CASE constructs
--  defined in the SQL standard.
--

SELECT * FROM CASE_TBL WHERE COALESCE(f,i) = 4;

SELECT *
  FROM CASE_TBL a, CASE2_TBL b
  WHERE COALESCE(a.f, b.i, b.j) = 2;

-- We don't support update now.
--
-- Examples of updates involving tables
--

-- UPDATE CASE_TBL
--   SET i = CASE WHEN i >= 3 THEN (- i)
--                 ELSE (2 * i) END;

-- SELECT * FROM CASE_TBL;

-- UPDATE CASE_TBL
--   SET i = CASE WHEN i >= 2 THEN (2 * i)
--                 ELSE (3 * i) END;

-- SELECT * FROM CASE_TBL;

-- UPDATE CASE_TBL
--   SET i = CASE WHEN b.i >= 2 THEN (2 * j)
--                 ELSE (3 * j) END
--   FROM CASE2_TBL b
--   WHERE j = -CASE_TBL.i;

-- SELECT * FROM CASE_TBL;

--
-- Nested CASE expressions
--

-- This test exercises a bug caused by aliasing econtext->caseValue_isNull
-- with the isNull argument of the inner CASE's CaseExpr evaluation.  After
-- evaluating the vol(null) expression in the inner CASE's second WHEN-clause,
-- the isNull flag for the case test value incorrectly became true, causing
-- the third WHEN-clause not to match.  The volatile function calls are needed
-- to prevent constant-folding in the planner, which would hide the bug.

-- Wrap this in a single transaction so the transient '=' operator doesn't
-- cause problems in concurrent sessions
-- BEGIN;

-- CREATE FUNCTION vol(text) returns text as
--   'begin return $1; end' language plpgsql volatile;

SELECT CASE
  (CASE vol('bar')
    WHEN 'foo' THEN 'it was foo!'
    WHEN vol(null) THEN 'null input'
    WHEN 'bar' THEN 'it was bar!' END
  )
  WHEN 'it was foo!' THEN 'foo recognized'
  WHEN 'it was bar!' THEN 'bar recognized'
  ELSE 'unrecognized' END;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- COMMENTS
-- https://github.com/postgres/postgres/blob/REL_12_BETA3/src/test/regress/sql/comments.sql
--

SELECT 'trailing' AS first;

-- trailing single line

SELECT 'before multi-line' AS fourth;

-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
-- CREATE VIEW
-- https://github.com/postgres/postgres/blob/REL_12_STABLE/src/test/regress/sql/create_view.sql

-- [SPARK-27764] Support geometric types
-- CREATE VIEW street AS
--    SELECT r.name, r.thepath, c.cname AS cname
--    FROM ONLY road r, real_city c
--    WHERE c.outline ## r.thepath;

-- [SPARK-27764] Support geometric types
-- CREATE VIEW iexit AS
--    SELECT ih.name, ih.thepath,
-- 	interpt_pp(ih.thepath, r.thepath) AS exit
--    FROM ihighway ih, ramp r
--    WHERE ih.thepath ## r.thepath;

CREATE TABLE emp (
  name string,
  age int,
  -- [SPARK-27764] Support geometric types
  -- location point
  salary int,
  manager string
) USING parquet;

DROP TABLE emp;

--
-- [SPARK-19842] Informational Referential Integrity Constraints Support in Spark
-- ALTER TABLE view_base_table DROP CONSTRAINT view_base_table_pkey;  -- fails

CREATE VIEW key_dependent_view_no_cols AS
   SELECT FROM view_base_table GROUP BY key HAVING length(data) > 0;

CREATE OR REPLACE VIEW viewtest AS
	SELECT * FROM viewtest_tbl;

CREATE OR REPLACE VIEW viewtest AS
	SELECT a, b FROM viewtest_tbl WHERE a > 5 ORDER BY b DESC;

-- should fail
-- [SPARK-29660] Dropping columns and changing column names/types are prohibited in VIEW definition
CREATE OR REPLACE VIEW viewtest AS
	SELECT a, decimal(b) FROM viewtest_tbl;

DROP TABLE viewtest_tbl;

CREATE TABLE temp_view_test.base_table2 (a int, id int) using parquet;

-- should be created in temp_view_test schema
CREATE VIEW v1 AS SELECT * FROM base_table;

-- should be created in temp object schema
CREATE TEMP VIEW v2_temp AS SELECT * FROM base_table;

DESC TABLE EXTENDED temp_view_test.v2;

DESC TABLE EXTENDED v3;

-- subqueries
CREATE VIEW v4 AS SELECT * FROM base_table WHERE id IN (SELECT id FROM base_table2);

DESC TABLE EXTENDED v5;

CREATE VIEW v7 AS SELECT * FROM base_table WHERE NOT EXISTS (SELECT 1 FROM base_table2);

DESC TABLE EXTENDED v8;

CREATE VIEW v8_temp AS SELECT * FROM base_table WHERE EXISTS (SELECT 1 FROM temp_table);

CREATE VIEW v11_temp AS SELECT t1.id, t2.a FROM base_table t1, v10_temp t2;

-- Replace SET with USE
-- SET search_path TO testviewschm2, public;
USE testviewschm2;

-- Since Spark doesn't support CREATE TEMPORARY TABLE, we used CREATE TEMPORARY VIEW instead
-- CREATE TEMP TABLE tt (num2 int, value string);
CREATE TEMP VIEW tt AS SELECT * FROM VALUES
  (1, 'a') AS tt(num2, value);

-- [SPARK-29628] Forcibly create a temporary view in CREATE VIEW if referencing a temporary view
CREATE VIEW temporal1 AS SELECT * FROM t1 CROSS JOIN tt;

-- [SPARK-29628] Forcibly create a temporary view in CREATE VIEW if referencing a temporary view
CREATE VIEW temporal2 AS SELECT * FROM t1 INNER JOIN tt ON t1.num = tt.num2;

-- [SPARK-29628] Forcibly create a temporary view in CREATE VIEW if referencing a temporary view
CREATE VIEW temporal3 AS SELECT * FROM t1 LEFT JOIN tt ON t1.num = tt.num2;

-- [SPARK-29628] Forcibly create a temporary view in CREATE VIEW if referencing a temporary view
CREATE VIEW temporal4 AS SELECT * FROM t1 LEFT JOIN tt ON t1.num = tt.num2 AND tt.value = 'xxx';

CREATE TABLE tbl2 (c int, d int) using parquet;

-- Since Spark doesn't support CREATE TEMPORARY TABLE, we used CREATE TABLE instead
-- CREATE TEMP TABLE tmptbl (i int, j int);
CREATE TABLE tmptbl (i int, j int) using parquet;

DESC TABLE EXTENDED pubview;

-- Skip the test below because of PostgreSQL specific cases
-- SELECT count(*) FROM pg_class where relname LIKE 'mytempview'
-- And relnamespace IN (SELECT OID FROM pg_namespace WHERE nspname LIKE 'pg_temp%');

--
-- CREATE VIEW and WITH(...) clause
-- CREATE VIEW mysecview1
--        AS SELECT * FROM tbl1 WHERE a = 0;
--
-- Skip the tests below because Spark doesn't support `WITH options`
-- CREATE VIEW mysecview2 WITH (security_barrier=true)
--        AS SELECT * FROM tbl1 WHERE a > 0;
-- CREATE VIEW mysecview3 WITH (security_barrier=false)
--        AS SELECT * FROM tbl1 WHERE a < 0;
-- CREATE VIEW mysecview4 WITH (security_barrier)
--        AS SELECT * FROM tbl1 WHERE a <> 0;
-- Spark cannot support options in WITH clause
-- CREATE VIEW mysecview5 WITH (security_barrier=100)	-- Error
--        AS SELECT * FROM tbl1 WHERE a > 100;
-- CREATE VIEW mysecview6 WITH (invalid_option)		-- Error
--        AS SELECT * FROM tbl1 WHERE a < 100;
-- Skip the test below because of PostgreSQL specific cases
-- SELECT relname, relkind, reloptions FROM pg_class
--        WHERE oid in ('mysecview1'::regclass, 'mysecview2'::regclass,
--                      'mysecview3'::regclass, 'mysecview4'::regclass)
--        ORDER BY relname;

-- CREATE OR REPLACE VIEW mysecview1
--        AS SELECT * FROM tbl1 WHERE a = 256;
-- CREATE OR REPLACE VIEW mysecview2
--        AS SELECT * FROM tbl1 WHERE a > 256;
-- CREATE OR REPLACE VIEW mysecview3 WITH (security_barrier=true)
--        AS SELECT * FROM tbl1 WHERE a < 256;
-- CREATE OR REPLACE VIEW mysecview4 WITH (security_barrier=false)
--        AS SELECT * FROM tbl1 WHERE a <> 256;
-- Skip the test below because of PostgreSQL specific cases
-- SELECT relname, relkind, reloptions FROM pg_class
--        WHERE oid in ('mysecview1'::regclass, 'mysecview2'::regclass,
--                      'mysecview3'::regclass, 'mysecview4'::regclass)
--        ORDER BY relname;

-- Check that unknown literals are converted to "text" in CREATE VIEW,
-- so that we don't end up with unknown-type columns.

-- Skip the tests below because of PostgreSQL specific cases
-- CREATE VIEW unspecified_types AS
--   SELECT 42 as i, 42.5 as num, 'foo' as u, 'foo'::unknown as u2, null as n;
-- \d+ unspecified_types
-- SELECT * FROM unspecified_types;

-- This test checks that proper typmods are assigned in a multi-row VALUES

CREATE VIEW tt1 AS
  SELECT * FROM (
    VALUES
       ('abc', '0123456789', 42, 'abcd'),
       ('0123456789', 'abc', 42.12, 'abc')
  ) vv(a,b,c,d);

DROP VIEW tt1;

CREATE TABLE temp_view_test.tt1 (y1 int, f2 int, f3 string) using parquet;

CREATE VIEW aliased_view_3 AS
  select * from tt1
    where exists (select 1 from tx1 a2 where tt1.f1 = a2.x1);

-- \d+ aliased_view_2
DESC TABLE aliased_view_2;

ALTER TABLE tx1 RENAME TO a1;

ALTER TABLE a2 RENAME TO tx1;

create table tt3 (ax bigint, b short, c decimal) using parquet;

create view v1a as select * from (tt2 natural join tt3) j;

create view v3 as select * from tt2 join tt3 using (b,c) full join tt4 using (b);

-- select pg_get_viewdef('v2', true);
DESC TABLE v2;

alter table tt2 add column d int;

create table tt3 (ax bigint, b short, d decimal) using parquet;

-- [SPARK-27589] Spark file source V2 (For supporting DROP COLUMN in ALTER TABLE)
-- alter table tt2 drop column d;

-- select pg_get_viewdef('v1', true);
-- select pg_get_viewdef('v1a', true);
-- select pg_get_viewdef('v2', true);
-- select pg_get_viewdef('v2a', true);
-- select pg_get_viewdef('v3', true);

create table tt5 (a int, b int) using parquet;

-- Replace `pg_get_viewdef` with `DESC`
-- select pg_get_viewdef('vv1', true);
DESC TABLE vv1;

alter table tt5 add column cc int;

create view vv2 as
select * from (values(1,2,3,4,5)) v(a,b,c,d,e)
union all
select * from tt7 full join tt8 using (x), tt8 tt8x;

-- Replace `pg_get_viewdef` with `DESC`
-- select pg_get_viewdef('vv3', true);
DESC TABLE vv3;

alter table tt7 add column zz int;

-- select pg_get_viewdef('vv3', true);
DESC TABLE vv3;

-- alter table tt7a drop column xx;
create table tt8a (x timestamp, z int) using parquet;

--
-- Also check dropping a column that existed when the view was made
--

create table tt9 (x int, xx int, y int) using parquet;

-- Replace `pg_get_viewdef` with `DESC`
-- select pg_get_viewdef('vv5', true);
DESC TABLE vv5;

create table tt12 (x int, z int) using parquet;

-- Replace `pg_get_viewdef` with `DESC`
-- select pg_get_viewdef('vv6', true);
DESC TABLE vv6;

create view tt18v as
  select * from int8_tbl xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxy
  union all
  select * from int8_tbl xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxz;

-- Replace `pg_get_viewdef` with `DESC`
-- select pg_get_viewdef('tt21v', true);
DESC TABLE tt21v;

-- check handling of views with immediately-renamed columns

create view tt23v (col_a, col_b) as
select q1 as other_name1, q2 as other_name2 from int8_tbl
union
select 42, 43;

DROP SCHEMA testviewschm2 CASCADE;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- DATE
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/date.sql

CREATE TABLE DATE_TBL (f1 date) USING parquet;

INSERT INTO DATE_TBL VALUES (date('1996-02-28'));

INSERT INTO DATE_TBL VALUES (date('1996-03-02'));

INSERT INTO DATE_TBL VALUES (date('1997-03-02'));

INSERT INTO DATE_TBL VALUES (date('2000-04-03'));

INSERT INTO DATE_TBL VALUES (date('2040-04-10'));

SELECT f1 AS `Three` FROM DATE_TBL
  WHERE f1 BETWEEN '2000-01-01' AND '2001-01-01';

-- SELECT date '1/8/1999';
-- SELECT date '1/18/1999';
-- SELECT date '18/1/1999';
-- SELECT date '01/02/03';
-- SELECT date '19990108';
-- SELECT date '990108';
-- SELECT date '1999.008';
-- SELECT date 'J2451187';
-- SELECT date 'January 8, 99 BC';

-- SELECT date '99-Jan-08';
-- SELECT date '1999-Jan-08';
-- SELECT date '08-Jan-99';
-- SELECT date '08-Jan-1999';
-- SELECT date 'Jan-08-99';
-- SELECT date 'Jan-08-1999';
-- SELECT date '99-08-Jan';
-- SELECT date '1999-08-Jan';

-- SELECT date '99 Jan 08';
SELECT date '1999 Jan 08';

-- SELECT date '08-01-99';
-- SELECT date '08-01-1999';
-- SELECT date '01-08-99';
-- SELECT date '01-08-1999';
-- SELECT date '99-08-01';
SELECT date '1999-08-01';

-- SET datestyle TO dmy;

-- SELECT date 'January 8, 1999';
SELECT date '1999-01-08';

-- [SPARK-28253] Date type have different low value and high value
-- Check upper and lower limits of date range
SELECT date '4714-11-24 BC';

SELECT date '5874898-01-01';

SELECT date 'yesterday' - date 'today' AS `One day`;

SELECT date 'tomorrow' - date 'today' AS `One day`;

-- [SPARK-28017] Enhance date EXTRACT
--
-- test extract!
--
-- epoch
--
-- SELECT EXTRACT(EPOCH FROM DATE        '1970-01-01');     --  0
-- SELECT EXTRACT(EPOCH FROM TIMESTAMP   '1970-01-01');     --  0
-- SELECT EXTRACT(EPOCH FROM TIMESTAMPTZ '1970-01-01+00');  --  0
--
-- century
--
-- SELECT EXTRACT(CENTURY FROM TO_DATE('0101-12-31 BC', 'yyyy-MM-dd G')); -- -2
-- SELECT EXTRACT(CENTURY FROM TO_DATE('0100-12-31 BC', 'yyyy-MM-dd G')); -- -1
-- SELECT EXTRACT(CENTURY FROM TO_DATE('0001-12-31 BC', 'yyyy-MM-dd G')); -- -1
-- SELECT EXTRACT(CENTURY FROM DATE '0001-01-01');    --  1
-- SELECT EXTRACT(CENTURY FROM DATE '0001-01-01 AD'); --  1
-- SELECT EXTRACT(CENTURY FROM DATE '1900-12-31');    -- 19
-- SELECT EXTRACT(CENTURY FROM DATE '1901-01-01');    -- 20
-- SELECT EXTRACT(CENTURY FROM DATE '2000-12-31');    -- 20
-- SELECT EXTRACT(CENTURY FROM DATE '2001-01-01');    -- 21
-- SELECT EXTRACT(CENTURY FROM CURRENT_DATE)>=21 AS True;     -- true
--
-- millennium
--
-- SELECT EXTRACT(MILLENNIUM FROM TO_DATE('0001-12-31 BC', 'yyyy-MM-dd G')); -- -1
-- SELECT EXTRACT(MILLENNIUM FROM DATE '0001-01-01 AD'); --  1
-- SELECT EXTRACT(MILLENNIUM FROM DATE '1000-12-31');    --  1
-- SELECT EXTRACT(MILLENNIUM FROM DATE '1001-01-01');    --  2
-- SELECT EXTRACT(MILLENNIUM FROM DATE '2000-12-31');    --  2
-- SELECT EXTRACT(MILLENNIUM FROM DATE '2001-01-01');    --  3
-- next test to be fixed on the turn of the next millennium;-)
-- SELECT EXTRACT(MILLENNIUM FROM CURRENT_DATE);         --  3
--
-- decade
--
-- SELECT EXTRACT(DECADE FROM DATE '1994-12-25');    -- 199
-- SELECT EXTRACT(DECADE FROM DATE '0010-01-01');    --   1
-- SELECT EXTRACT(DECADE FROM DATE '0009-12-31');    --   0
-- SELECT EXTRACT(DECADE FROM TO_DATE('0001-01-01 BC', 'yyyy-MM-dd G')); --   0
-- SELECT EXTRACT(DECADE FROM TO_DATE('0002-12-31 BC', 'yyyy-MM-dd G')); --  -1
-- SELECT EXTRACT(DECADE FROM TO_DATE('0011-01-01 BC', 'yyyy-MM-dd G')); --  -1
-- SELECT EXTRACT(DECADE FROM TO_DATE('0012-12-31 BC', 'yyyy-MM-dd G')); --  -2
--
-- some other types:
--
-- on a timestamp.
-- SELECT EXTRACT(CENTURY FROM NOW())>=21 AS True;       -- true
-- SELECT EXTRACT(CENTURY FROM TIMESTAMP '1970-03-20 04:30:00.00000'); -- 20
-- on an interval
-- SELECT EXTRACT(CENTURY FROM INTERVAL '100 y');  -- 1
-- SELECT EXTRACT(CENTURY FROM INTERVAL '99 y');   -- 0
-- SELECT EXTRACT(CENTURY FROM INTERVAL '-99 y');  -- 0
-- SELECT EXTRACT(CENTURY FROM INTERVAL '-100 y'); -- -1
--
-- test trunc function!
-- SELECT DATE_TRUNC('MILLENNIUM', TIMESTAMP '1970-03-20 04:30:00.00000'); -- 1001
-- SELECT DATE_TRUNC('MILLENNIUM', DATE '1970-03-20'); -- 1001-01-01
-- SELECT DATE_TRUNC('CENTURY', TIMESTAMP '1970-03-20 04:30:00.00000'); -- 1901
-- SELECT DATE_TRUNC('CENTURY', DATE '1970-03-20'); -- 1901
-- SELECT DATE_TRUNC('CENTURY', DATE '2004-08-10'); -- 2001-01-01
-- SELECT DATE_TRUNC('CENTURY', DATE '0002-02-04'); -- 0001-01-01
-- SELECT DATE_TRUNC('CENTURY', TO_DATE('0055-08-10 BC', 'yyyy-MM-dd G')); -- 0100-01-01 BC
-- SELECT DATE_TRUNC('DECADE', DATE '1993-12-25'); -- 1990-01-01
-- SELECT DATE_TRUNC('DECADE', DATE '0004-12-25'); -- 0001-01-01 BC
-- SELECT DATE_TRUNC('DECADE', TO_DATE('0002-12-31 BC', 'yyyy-MM-dd G')); -- 0011-01-01 BC

-- [SPARK-29006] Support special date/timestamp values `infinity`/`-infinity`
--
-- test infinity
--
-- select 'infinity'::date, '-infinity'::date;
-- select 'infinity'::date > 'today'::date as t;
-- select '-infinity'::date < 'today'::date as t;
-- select isfinite('infinity'::date), isfinite('-infinity'::date), isfinite('today'::date);
--
-- oscillating fields from non-finite date/timestamptz:
--
-- SELECT EXTRACT(HOUR FROM DATE 'infinity');      -- NULL
-- SELECT EXTRACT(HOUR FROM DATE '-infinity');     -- NULL
-- SELECT EXTRACT(HOUR FROM TIMESTAMP   'infinity');      -- NULL
-- SELECT EXTRACT(HOUR FROM TIMESTAMP   '-infinity');     -- NULL
-- SELECT EXTRACT(HOUR FROM TIMESTAMPTZ 'infinity');      -- NULL
-- SELECT EXTRACT(HOUR FROM TIMESTAMPTZ '-infinity');     -- NULL
-- all possible fields
-- SELECT EXTRACT(MICROSECONDS  FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(MILLISECONDS  FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(SECOND        FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(MINUTE        FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(HOUR          FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(DAY           FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(MONTH         FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(QUARTER       FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(WEEK          FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(DOW           FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(ISODOW        FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(DOY           FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(TIMEZONE      FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(TIMEZONE_M    FROM DATE 'infinity');    -- NULL
-- SELECT EXTRACT(TIMEZONE_H    FROM DATE 'infinity');    -- NULL
--
-- monotonic fields from non-finite date/timestamptz:
--
-- SELECT EXTRACT(EPOCH FROM DATE 'infinity');         --  Infinity
-- SELECT EXTRACT(EPOCH FROM DATE '-infinity');        -- -Infinity
-- SELECT EXTRACT(EPOCH FROM TIMESTAMP   'infinity');  --  Infinity
-- SELECT EXTRACT(EPOCH FROM TIMESTAMP   '-infinity'); -- -Infinity
-- SELECT EXTRACT(EPOCH FROM TIMESTAMPTZ 'infinity');  --  Infinity
-- SELECT EXTRACT(EPOCH FROM TIMESTAMPTZ '-infinity'); -- -Infinity
-- all possible fields
-- SELECT EXTRACT(YEAR       FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(DECADE     FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(CENTURY    FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(MILLENNIUM FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(JULIAN     FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(ISOYEAR    FROM DATE 'infinity');    --  Infinity
-- SELECT EXTRACT(EPOCH      FROM DATE 'infinity');    --  Infinity
--
-- wrong fields from non-finite date:
--
-- SELECT EXTRACT(MICROSEC  FROM DATE 'infinity');     -- ERROR:  timestamp units "microsec" not recognized
-- SELECT EXTRACT(UNDEFINED FROM DATE 'infinity');     -- ERROR:  timestamp units "undefined" not supported

-- test constructors
select make_date(2013, 7, 15);

select make_date(2013, 13, 1);

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- FLOAT4
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/float4.sql

CREATE TABLE FLOAT4_TBL (f1  float) USING parquet;

INSERT INTO FLOAT4_TBL VALUES (float('     -34.84    '));

-- [SPARK-28024] Incorrect numeric values when out of range
-- test for over and under flow
-- INSERT INTO FLOAT4_TBL VALUES ('10e70');
-- INSERT INTO FLOAT4_TBL VALUES ('-10e70');
-- INSERT INTO FLOAT4_TBL VALUES ('10e-70');
-- INSERT INTO FLOAT4_TBL VALUES ('-10e-70');

-- INSERT INTO FLOAT4_TBL VALUES ('10e400');
-- INSERT INTO FLOAT4_TBL VALUES ('-10e400');
-- INSERT INTO FLOAT4_TBL VALUES ('10e-400');
-- INSERT INTO FLOAT4_TBL VALUES ('-10e-400');

-- [SPARK-27923] Spark SQL insert there bad inputs to NULL
-- bad input
-- INSERT INTO FLOAT4_TBL VALUES ('');
-- INSERT INTO FLOAT4_TBL VALUES ('       ');
-- INSERT INTO FLOAT4_TBL VALUES ('xyz');
-- INSERT INTO FLOAT4_TBL VALUES ('5.0.0');
-- INSERT INTO FLOAT4_TBL VALUES ('5 . 0');
-- INSERT INTO FLOAT4_TBL VALUES ('5.   0');
-- INSERT INTO FLOAT4_TBL VALUES ('     - 3.0');
-- INSERT INTO FLOAT4_TBL VALUES ('123            5');

-- special inputs
SELECT float('NaN');

SELECT float('infinity');

SELECT float('NaN x');

SELECT float('Infinity') / float('Infinity');

SELECT '' AS five, * FROM FLOAT4_TBL;

SELECT '' AS three, f.* FROM FLOAT4_TBL f WHERE '1004.3' > f.f1;

SELECT '' AS four, f.* FROM FLOAT4_TBL f WHERE  f.f1 <= '1004.3';

SELECT '' AS three, f.f1, f.f1 / '-10' AS x FROM FLOAT4_TBL f
   WHERE f.f1 > '0.0';

-- [SPARK-28027] Spark SQL does not support prefix operator @
-- test the unary float4abs operator
-- SELECT '' AS five, f.f1, @f.f1 AS abs_f1 FROM FLOAT4_TBL f;

-- Spark SQL does not support update now.
-- UPDATE FLOAT4_TBL
--    SET f1 = FLOAT4_TBL.f1 * '-1'
--    WHERE FLOAT4_TBL.f1 > '0.0';

-- SELECT '' AS five, * FROM FLOAT4_TBL;

-- [SPARK-28028] Cast numeric to integral type need round
-- [SPARK-28024] Incorrect numeric values when out of range
-- test edge-case coercions to integer
SELECT smallint(float('32767.4'));

SELECT smallint(float('-32768.6'));

SELECT int(float('-2147483648.5'));

SELECT bigint(float('9223372036854775807'));

-- [SPARK-28061] Support for converting float to binary format
-- Test for correct input rounding in edge cases.
-- These lists are from Paxson 1991, excluding subnormals and
-- inputs of over 9 sig. digits.

-- SELECT float4send('5e-20'::float4);
-- SELECT float4send('67e14'::float4);
-- SELECT float4send('985e15'::float4);
-- SELECT float4send('55895e-16'::float4);
-- SELECT float4send('7038531e-32'::float4);
-- SELECT float4send('702990899e-20'::float4);

-- SELECT float4send('3e-23'::float4);
-- SELECT float4send('57e18'::float4);
-- SELECT float4send('789e-35'::float4);
-- SELECT float4send('2539e-18'::float4);
-- SELECT float4send('76173e28'::float4);
-- SELECT float4send('887745e-11'::float4);
-- SELECT float4send('5382571e-37'::float4);
-- SELECT float4send('82381273e-35'::float4);
-- SELECT float4send('750486563e-38'::float4);

-- Test that the smallest possible normalized input value inputs
-- correctly, either in 9-significant-digit or shortest-decimal
-- format.
--
-- exact val is             1.1754943508...
-- shortest val is          1.1754944000
-- midpoint to next val is  1.1754944208...

-- SELECT float4send('1.17549435e-38'::float4);
-- SELECT float4send('1.1754944e-38'::float4);

-- We do not support creating types, skip the test below
-- test output (and round-trip safety) of various values.
-- To ensure we're testing what we think we're testing, start with
-- float values specified by bit patterns (as a useful side effect,
-- this means we'll fail on non-IEEE platforms).

-- create type xfloat4;
-- create function xfloat4in(cstring) returns xfloat4 immutable strict
--   language internal as 'int4in';
-- create function xfloat4out(xfloat4) returns cstring immutable strict
--   language internal as 'int4out';
-- create type xfloat4 (input = xfloat4in, output = xfloat4out, like = float4);
-- create cast (xfloat4 as float4) without function;
-- create cast (float4 as xfloat4) without function;
-- create cast (xfloat4 as integer) without function;
-- create cast (integer as xfloat4) without function;

-- float4: seeeeeee emmmmmmm mmmmmmmm mmmmmmmm

-- we don't care to assume the platform's strtod() handles subnormals
-- correctly; those are "use at your own risk". However we do test
-- subnormal outputs, since those are under our control.

-- with testdata(bits) as (values
--   -- small subnormals
--   (x'00000001'),
--   (x'00000002'), (x'00000003'),
--   (x'00000010'), (x'00000011'), (x'00000100'), (x'00000101'),
--   (x'00004000'), (x'00004001'), (x'00080000'), (x'00080001'),
--   -- stress values
--   (x'0053c4f4'),  -- 7693e-42
--   (x'006c85c4'),  -- 996622e-44
--   (x'0041ca76'),  -- 60419369e-46
--   (x'004b7678'),  -- 6930161142e-48
--   -- taken from upstream testsuite
--   (x'00000007'),
--   (x'00424fe2'),
--   -- borderline between subnormal and normal
--   (x'007ffff0'), (x'007ffff1'), (x'007ffffe'), (x'007fffff'))
-- select float4send(flt) as ibits,
--        flt
--   from (select bits::integer::xfloat4::float4 as flt
--           from testdata
-- 	offset 0) s;

-- with testdata(bits) as (values
--   (x'00000000'),
--   -- smallest normal values
--   (x'00800000'), (x'00800001'), (x'00800004'), (x'00800005'),
--   (x'00800006'),
--   -- small normal values chosen for short vs. long output
--   (x'008002f1'), (x'008002f2'), (x'008002f3'),
--   (x'00800e17'), (x'00800e18'), (x'00800e19'),
--   -- assorted values (random mantissae)
--   (x'01000001'), (x'01102843'), (x'01a52c98'),
--   (x'0219c229'), (x'02e4464d'), (x'037343c1'), (x'03a91b36'),
--   (x'047ada65'), (x'0496fe87'), (x'0550844f'), (x'05999da3'),
--   (x'060ea5e2'), (x'06e63c45'), (x'07f1e548'), (x'0fc5282b'),
--   (x'1f850283'), (x'2874a9d6'),
--   -- values around 5e-08
--   (x'3356bf94'), (x'3356bf95'), (x'3356bf96'),
--   -- around 1e-07
--   (x'33d6bf94'), (x'33d6bf95'), (x'33d6bf96'),
--   -- around 3e-07 .. 1e-04
--   (x'34a10faf'), (x'34a10fb0'), (x'34a10fb1'),
--   (x'350637bc'), (x'350637bd'), (x'350637be'),
--   (x'35719786'), (x'35719787'), (x'35719788'),
--   (x'358637bc'), (x'358637bd'), (x'358637be'),
--   (x'36a7c5ab'), (x'36a7c5ac'), (x'36a7c5ad'),
--   (x'3727c5ab'), (x'3727c5ac'), (x'3727c5ad'),
--   -- format crossover at 1e-04
--   (x'38d1b714'), (x'38d1b715'), (x'38d1b716'),
--   (x'38d1b717'), (x'38d1b718'), (x'38d1b719'),
--   (x'38d1b71a'), (x'38d1b71b'), (x'38d1b71c'),
--   (x'38d1b71d'),
--   --
--   (x'38dffffe'), (x'38dfffff'), (x'38e00000'),
--   (x'38efffff'), (x'38f00000'), (x'38f00001'),
--   (x'3a83126e'), (x'3a83126f'), (x'3a831270'),
--   (x'3c23d709'), (x'3c23d70a'), (x'3c23d70b'),
--   (x'3dcccccc'), (x'3dcccccd'), (x'3dccccce'),
--   -- chosen to need 9 digits for 3dcccd70
--   (x'3dcccd6f'), (x'3dcccd70'), (x'3dcccd71'),
--   --
--   (x'3effffff'), (x'3f000000'), (x'3f000001'),
--   (x'3f333332'), (x'3f333333'), (x'3f333334'),
--   -- approach 1.0 with increasing numbers of 9s
--   (x'3f666665'), (x'3f666666'), (x'3f666667'),
--   (x'3f7d70a3'), (x'3f7d70a4'), (x'3f7d70a5'),
--   (x'3f7fbe76'), (x'3f7fbe77'), (x'3f7fbe78'),
--   (x'3f7ff971'), (x'3f7ff972'), (x'3f7ff973'),
--   (x'3f7fff57'), (x'3f7fff58'), (x'3f7fff59'),
--   (x'3f7fffee'), (x'3f7fffef'),
--   -- values very close to 1
--   (x'3f7ffff0'), (x'3f7ffff1'), (x'3f7ffff2'),
--   (x'3f7ffff3'), (x'3f7ffff4'), (x'3f7ffff5'),
--   (x'3f7ffff6'), (x'3f7ffff7'), (x'3f7ffff8'),
--   (x'3f7ffff9'), (x'3f7ffffa'), (x'3f7ffffb'),
--   (x'3f7ffffc'), (x'3f7ffffd'), (x'3f7ffffe'),
--   (x'3f7fffff'),
--   (x'3f800000'),
--   (x'3f800001'), (x'3f800002'), (x'3f800003'),
--   (x'3f800004'), (x'3f800005'), (x'3f800006'),
--   (x'3f800007'), (x'3f800008'), (x'3f800009'),
--   -- values 1 to 1.1
--   (x'3f80000f'), (x'3f800010'), (x'3f800011'),
--   (x'3f800012'), (x'3f800013'), (x'3f800014'),
--   (x'3f800017'), (x'3f800018'), (x'3f800019'),
--   (x'3f80001a'), (x'3f80001b'), (x'3f80001c'),
--   (x'3f800029'), (x'3f80002a'), (x'3f80002b'),
--   (x'3f800053'), (x'3f800054'), (x'3f800055'),
--   (x'3f800346'), (x'3f800347'), (x'3f800348'),
--   (x'3f8020c4'), (x'3f8020c5'), (x'3f8020c6'),
--   (x'3f8147ad'), (x'3f8147ae'), (x'3f8147af'),
--   (x'3f8ccccc'), (x'3f8ccccd'), (x'3f8cccce'),
--   --
--   (x'3fc90fdb'), -- pi/2
--   (x'402df854'), -- e
--   (x'40490fdb'), -- pi
--   --
--   (x'409fffff'), (x'40a00000'), (x'40a00001'),
--   (x'40afffff'), (x'40b00000'), (x'40b00001'),
--   (x'411fffff'), (x'41200000'), (x'41200001'),
--   (x'42c7ffff'), (x'42c80000'), (x'42c80001'),
--   (x'4479ffff'), (x'447a0000'), (x'447a0001'),
--   (x'461c3fff'), (x'461c4000'), (x'461c4001'),
--   (x'47c34fff'), (x'47c35000'), (x'47c35001'),
--   (x'497423ff'), (x'49742400'), (x'49742401'),
--   (x'4b18967f'), (x'4b189680'), (x'4b189681'),
--   (x'4cbebc1f'), (x'4cbebc20'), (x'4cbebc21'),
--   (x'4e6e6b27'), (x'4e6e6b28'), (x'4e6e6b29'),
--   (x'501502f8'), (x'501502f9'), (x'501502fa'),
--   (x'51ba43b6'), (x'51ba43b7'), (x'51ba43b8'),
--   -- stress values
--   (x'1f6c1e4a'),  -- 5e-20
--   (x'59be6cea'),  -- 67e14
--   (x'5d5ab6c4'),  -- 985e15
--   (x'2cc4a9bd'),  -- 55895e-16
--   (x'15ae43fd'),  -- 7038531e-32
--   (x'2cf757ca'),  -- 702990899e-20
--   (x'665ba998'),  -- 25933168707e13
--   (x'743c3324'),  -- 596428896559e20
--   -- exercise fixed-point memmoves
--   (x'47f1205a'),
--   (x'4640e6ae'),
--   (x'449a5225'),
--   (x'42f6e9d5'),
--   (x'414587dd'),
--   (x'3f9e064b'),
--   -- these cases come from the upstream's testsuite
--   -- BoundaryRoundEven
--   (x'4c000004'),
--   (x'50061c46'),
--   (x'510006a8'),
--   -- ExactValueRoundEven
--   (x'48951f84'),
--   (x'45fd1840'),
--   -- LotsOfTrailingZeros
--   (x'39800000'),
--   (x'3b200000'),
--   (x'3b900000'),
--   (x'3bd00000'),
--   -- Regression
--   (x'63800000'),
--   (x'4b000000'),
--   (x'4b800000'),
--   (x'4c000001'),
--   (x'4c800b0d'),
--   (x'00d24584'),
--   (x'00d90b88'),
--   (x'45803f34'),
--   (x'4f9f24f7'),
--   (x'3a8722c3'),
--   (x'5c800041'),
--   (x'15ae43fd'),
--   (x'5d4cccfb'),
--   (x'4c800001'),
--   (x'57800ed8'),
--   (x'5f000000'),
--   (x'700000f0'),
--   (x'5f23e9ac'),
--   (x'5e9502f9'),
--   (x'5e8012b1'),
--   (x'3c000028'),
--   (x'60cde861'),
--   (x'03aa2a50'),
--   (x'43480000'),
--   (x'4c000000'),
--   -- LooksLikePow5
--   (x'5D1502F9'),
--   (x'5D9502F9'),
--   (x'5E1502F9'),
--   -- OutputLength
--   (x'3f99999a'),
--   (x'3f9d70a4'),
--   (x'3f9df3b6'),
--   (x'3f9e0419'),
--   (x'3f9e0610'),
--   (x'3f9e064b'),
--   (x'3f9e0651'),
--   (x'03d20cfe')
-- )
-- select float4send(flt) as ibits,
--        flt,
--        flt::text::float4 as r_flt,
--        float4send(flt::text::float4) as obits,
--        float4send(flt::text::float4) = float4send(flt) as correct
--   from (select bits::integer::xfloat4::float4 as flt
--           from testdata
-- 	offset 0) s;

-- clean up, lest opr_sanity complain
-- drop type xfloat4 cascade;
DROP TABLE FLOAT4_TBL;

INSERT INTO FLOAT8_TBL VALUES (double('1004.30  '));

INSERT INTO FLOAT8_TBL VALUES (double('1.2345678901234e-200'));

SELECT double('10e-400');

SELECT double('nan');

SELECT double('          -INFINiTY   ');

SELECT double(' INFINITY    x');

SELECT double('NaN') / double('NaN');

SELECT '' AS four, f.* FROM FLOAT8_TBL f WHERE f.f1 <> '1004.3';

SELECT '' AS three, f.* FROM FLOAT8_TBL f WHERE  f.f1 < '1004.3';

SELECT '' AS three, f.f1, f.f1 * '-10' AS x
   FROM FLOAT8_TBL f
   WHERE f.f1 > '0.0';

SELECT '' AS three, f.f1, f.f1 - '-10' AS x
   FROM FLOAT8_TBL f
   WHERE f.f1 > '0.0';

select ceiling(f1) as ceiling_f1 from float8_tbl f;

-- avoid bit-exact output here because operations may not be bit-exact.
-- SET extra_float_digits = 0;

-- square root
SELECT sqrt(double('64')) AS eight;

SELECT power(double('144'), double('NaN'));

-- [SPARK-28135] power returns incorrect values
SELECT power(double('1'), double('NaN'));

-- [SPARK-28027] Spark SQL does not support prefix operator ||/
-- cube root
-- SELECT ||/ float8 '27' AS three;

-- SELECT '' AS five, f.f1, ||/f.f1 AS cbrt_f1 FROM FLOAT8_TBL f;


SELECT '' AS five, * FROM FLOAT8_TBL;

-- [SPARK-28007] Caret operator (^) means bitwise XOR in Spark/Hive and exponentiation in Postgres
-- SELECT '' AS bad, f.f1 ^ '1e200' from UPDATED_FLOAT8_TBL f;

-- SELECT 0 ^ 0 + 0 ^ 1 + 0 ^ 0.0 + 0 ^ 0.5;

-- [SPARK-27923] Cannot take logarithm of zero
-- SELECT '' AS bad, ln(f.f1) from UPDATED_FLOAT8_TBL f where f.f1 = '0.0' ;

-- [SPARK-27923] Cannot take logarithm of a negative number
-- SELECT '' AS bad, ln(f.f1) from UPDATED_FLOAT8_TBL f where f.f1 < '0.0' ;

-- [SPARK-28024] Incorrect numeric values when out of range
-- SELECT '' AS bad, exp(f.f1) from UPDATED_FLOAT8_TBL f;

-- [SPARK-27923] Divide by zero, Spark SQL returns NULL
-- SELECT '' AS bad, f.f1 / '0.0' from UPDATED_FLOAT8_TBL f;

SELECT '' AS five, * FROM UPDATED_FLOAT8_TBL;

SELECT tanh(double('1'));

SELECT atanh(double('0.5'));

SELECT sinh(double('NaN'));

SELECT cosh(double('NaN'));

SELECT tanh(double('NaN'));

SELECT asinh(double('NaN'));

SELECT acosh(double('NaN'));

SELECT atanh(double('NaN'));

INSERT INTO FLOAT8_TBL VALUES (double('-34.84'));

INSERT INTO FLOAT8_TBL VALUES (double('-1.2345678901234e-200'));

SELECT smallint(double('-32768.4'));

SELECT int(double('2147483647.6'));

SELECT bigint(double('9223372036854773760'));

SELECT bigint(double('-9223372036854780000'));

-- Since Spark doesn't support CREATE TEMPORARY TABLE, we used CREATE TABLE instead
-- create temp table gstest2 (a integer, b integer, c integer, d integer,
--                            e integer, f integer, g integer, h integer);
create table gstest2 (a integer, b integer, c integer, d integer,
                      e integer, f integer, g integer, h integer) using parquet;

-- [SPARK-29386] Copy data between a file and a table
-- copy gstest3 from stdin;
-- 1	1	1	1
-- 2	2	2	2
-- \.
insert into gstest3 values
  (1, 1, 1, 1),
  (2, 2, 2, 2);

-- Since Spark doesn't support CREATE TEMPORARY TABLE, we used CREATE TABLE instead
-- create temp table gstest_empty (a integer, b integer, v integer);
create table gstest_empty (a integer, b integer, v integer) using parquet;

-- select a, b, grouping(a,b), sum(v), count(*), max(v)
select a, b, grouping(a), grouping(b), sum(v), count(*), max(v)
  from gstest1 group by rollup (a,b) order by b desc, a;

-- [SPARK-29700] Support nested grouping sets
-- nesting with grouping sets
-- select sum(c) from gstest2
--   group by grouping sets((), grouping sets((), grouping sets(())))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets((), grouping sets((), grouping sets(((a, b)))))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(grouping sets(rollup(c), grouping sets(cube(c))))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(a, grouping sets(a, cube(b)))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(grouping sets((a, (b))))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(grouping sets((a, b)))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(grouping sets(a, grouping sets(a), a))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets(grouping sets(a, grouping sets(a, grouping sets(a), ((a)), a, grouping sets(a), (a)), a))
--   order by 1 desc;
-- select sum(c) from gstest2
--   group by grouping sets((a,(a,b)), grouping sets((a,(a,b)),a))
--   order by 1 desc;

-- empty input: first is 0 rows, second 1, third 3 etc.
select a, b, sum(v), count(*) from gstest_empty group by grouping sets ((a,b),a);

select sum(v), count(*) from gstest_empty group by grouping sets ((),(),());

-- [SPARK-29698] Support grouping function with multiple arguments
-- select t1.a, t2.b, grouping(t1.a, t2.b), sum(t1.v), max(t2.a)
select t1.a, t2.b, grouping(t1.a), grouping(t2.b), sum(t1.v), max(t2.a)
  from gstest1 t1 join gstest2 t2 on (t1.a=t2.a)
 group by grouping sets ((t1.a, t2.b), ());

select four, x || 'x'
  from (select four, ten, 'foo' as x from tenk1) as t
  group by grouping sets (four, x)
  order by four;

select x, not x as not_x, q2 from
  (select *, q1 = 1 as x from int8_tbl i1) as t
  group by grouping sets(x, q2)
  order by x, q2;

-- Tests around pushdown of HAVING clauses, partially testing against previous bugs
select a,count(*) from gstest2 group by rollup(a) order by a;

select ten, grouping(ten) from onek
group by grouping sets(ten, four) having grouping(ten) > 0
order by 2,1;

-- [SPARK-29703] grouping() can only be used with GroupingSets/Cube/Rollup
-- select ten, grouping(ten) from onek
-- group by (ten) having grouping(ten) >= 0
-- order by 2,1;

-- FILTER queries
select ten, sum(distinct four) filter (where string(four) like '123') from onek a
group by rollup(ten);

-- explain (costs off) select a, b, grouping(a,b), sum(v), count(*), max(v)
--   from gstest1 group by grouping sets ((a),(b)) order by 3,1,2;

-- [SPARK-29698] Support grouping function with multiple arguments
-- select a, b, grouping(a,b), sum(v), count(*), max(v)
select a, b, grouping(a), grouping(b), sum(v), count(*), max(v)
  from gstest1 group by cube(a,b) order by 3,4,1,2 /* 3,1,2 */;

-- explain (costs off)
--   select unhashable_col, unsortable_col,
--          grouping(unhashable_col, unsortable_col),
--          count(*), sum(v)
--     from gstest4 group by grouping sets ((unhashable_col),(unsortable_col))
--    order by 3,5;

-- [SPARK-29698] Support grouping function with multiple arguments
select unhashable_col, unsortable_col,
       -- grouping(unhashable_col, unsortable_col),
       grouping(unhashable_col), grouping(unsortable_col),
       count(*), sum(v)
  from gstest4 group by grouping sets ((v,unhashable_col),(v,unsortable_col))
 order by 3, 4, 6 /* 3,5 */;

-- explain (costs off)
--   select a, b, sum(v), count(*) from gstest_empty group by grouping sets ((a,b),(),(),());
-- [SPARK-29701] Different answers when empty input given in GROUPING SETS
select sum(v), count(*) from gstest_empty group by grouping sets ((),(),());

-- explain (costs off)
--   select a, b, sum(c), sum(sum(c)) over (order by a,b) as rsum
--     from gstest2 group by cube (a,b) order by rsum, a, b;
-- select a, b, sum(v.x)
--   from (values (1),(2)) v(x), gstest_data(v.x)
--  group by cube (a,b) order by a,b;
-- explain (costs off)
--   select a, b, sum(v.x)
--     from (values (1),(2)) v(x), gstest_data(v.x)
--    group by cube (a,b) order by a,b;

-- Verify that we correctly handle the child node returning a
-- non-minimal slot, which happens if the input is pre-sorted,
-- e.g. due to an index scan.
-- BEGIN;
-- Ignore a PostgreSQL-specific option
-- SET LOCAL enable_hashagg = false;
-- EXPLAIN (COSTS OFF) SELECT a, b, count(*), max(a), max(b) FROM gstest3 GROUP BY GROUPING SETS(a, b,()) ORDER BY a, b;
SELECT a, b, count(*), max(a), max(b) FROM gstest3 GROUP BY GROUPING SETS(a, b,()) ORDER BY a, b;

-- end

DROP VIEW gstest1;

DROP TABLE gstest4;

-- [SPARK-29119] DEFAULT option is not supported in Spark
-- [SPARK-20845] Support specification of column names in INSERT INTO
-- Skip a test below because the PK constraint is violated and the query fails in PostgreSQL
-- insert into inserttest (col1, col2, col3) values (DEFAULT, DEFAULT, DEFAULT);
-- insert into inserttest (col2, col3) values (3, DEFAULT);
insert into inserttest  values (NULL, 3, 'testing');

-- insert into inserttest values (DEFAULT, 7);
insert into inserttest values (NULL, 7, 'testing');

select col1, col2, char_length(col3) from inserttest;

-- [SPARK-28023] Trim the string when cast string type to other types
-- PostgreSQL implicitly casts string literals to data with integral types, but
-- Spark does not support that kind of implicit casts.
INSERT INTO INT2_TBL VALUES (smallint(trim('0   ')));

-- [SPARK-27923] Invalid input syntax for type short throws exception at PostgreSQL
-- INSERT INTO INT2_TBL VALUES ('34.5');

-- largest and smallest values
-- PostgreSQL implicitly casts string literals to data with integral types, but
-- Spark does not support that kind of implicit casts.
INSERT INTO INT2_TBL VALUES (smallint('32767'));

SELECT '' AS four, i.* FROM INT2_TBL i WHERE i.f1 <> smallint('0');

SELECT '' AS one, i.* FROM INT2_TBL i WHERE i.f1 = int('0');

SELECT '' AS three, i.* FROM INT2_TBL i WHERE i.f1 <= smallint('0');

SELECT '' AS two, i.* FROM INT2_TBL i WHERE i.f1 > int('0');

-- positive odds
SELECT '' AS one, i.* FROM INT2_TBL i WHERE (i.f1 % smallint('2')) = smallint('1');

SELECT '' AS five, i.f1, i.f1 * int('2') AS x FROM INT2_TBL i;

-- [SPARK-28024] Incorrect value when out of range
-- SELECT '' AS five, i.f1, i.f1 - smallint('2') AS x FROM INT2_TBL i;

SELECT '' AS five, i.f1, i.f1 - smallint('2') AS x FROM INT2_TBL i
WHERE f1 > -32767;

SELECT '' AS five, i.f1, i.f1 / int('2') AS x FROM INT2_TBL i;

-- check sane handling of INT16_MIN overflow cases
-- [SPARK-28024] Incorrect numeric values when out of range
-- SELECT smallint((-32768)) * smallint(-1);
-- SELECT smallint(-32768) / smallint(-1);
SELECT smallint(-32768) % smallint(-1);

DROP TABLE INT2_TBL;

INSERT INTO INT4_TBL VALUES (int(trim('123456     ')));

INSERT INTO INT4_TBL VALUES (int('-2147483647'));

SELECT '' AS four, i.* FROM INT4_TBL i WHERE i.f1 <> int('0');

SELECT '' AS two, i.* FROM INT4_TBL i WHERE i.f1 < smallint('0');

SELECT '' AS three, i.* FROM INT4_TBL i WHERE i.f1 <= int('0');

SELECT '' AS three, i.* FROM INT4_TBL i WHERE i.f1 >= smallint('0');

-- any evens
SELECT '' AS three, i.* FROM INT4_TBL i WHERE (i.f1 % int('2')) = smallint('0');

-- [SPARK-28024] Incorrect value when out of range
SELECT '' AS five, i.f1, i.f1 * int('2') AS x FROM INT4_TBL i;

SELECT '' AS five, i.f1, i.f1 + smallint('2') AS x FROM INT4_TBL i
WHERE f1 < 2147483646;

-- [SPARK-28024] Incorrect value when out of range
SELECT '' AS five, i.f1, i.f1 - smallint('2') AS x FROM INT4_TBL i;

SELECT '' AS five, i.f1, i.f1 - int('2') AS x FROM INT4_TBL i
WHERE f1 > -2147483647;

--
-- more complex expressions
--

-- variations on unary minus parsing
SELECT -2+3 AS one;

SELECT 2 - -2 AS four;

SELECT smallint('2') * int('2') = int('16') / smallint('4') AS true;

SELECT 2 + 2 / 2 AS three;

SELECT string(int(shiftleft(int(-1), 31))+1);

-- [SPARK-28028] Cast numeric to integral type need round
-- check rounding when casting from float
SELECT x, int(x) AS int4_value
FROM (VALUES double(-2.5),
             double(-1.5),
             double(-0.5),
             double(0.0),
             double(0.5),
             double(1.5),
             double(2.5)) t(x);

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- INT8
-- Test int8 64-bit integers.
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/int8.sql
--
CREATE TABLE INT8_TBL(q1 bigint, q2 bigint) USING parquet;

INSERT INTO INT8_TBL VALUES(bigint('4567890123456789'),bigint('123'));

-- [SPARK-27923] Spark SQL insert there bad inputs to NULL
-- bad inputs
-- INSERT INTO INT8_TBL(q1) VALUES ('      ');
-- INSERT INTO INT8_TBL(q1) VALUES ('xxx');
-- INSERT INTO INT8_TBL(q1) VALUES ('3908203590239580293850293850329485');
-- INSERT INTO INT8_TBL(q1) VALUES ('-1204982019841029840928340329840934');
-- INSERT INTO INT8_TBL(q1) VALUES ('- 123');
-- INSERT INTO INT8_TBL(q1) VALUES ('  345     5');
-- INSERT INTO INT8_TBL(q1) VALUES ('');

SELECT * FROM INT8_TBL;

SELECT * FROM INT8_TBL WHERE q2 < 4567890123456789;

SELECT * FROM INT8_TBL WHERE q2 >= 4567890123456789;

SELECT * FROM INT8_TBL WHERE q2 < 456;

SELECT * FROM INT8_TBL WHERE q2 >= 456;

SELECT * FROM INT8_TBL WHERE 123 < q1;

SELECT * FROM INT8_TBL WHERE 123 >= q1;

SELECT * FROM INT8_TBL WHERE q2 < smallint('456');

SELECT * FROM INT8_TBL WHERE q2 >= smallint('456');

SELECT * FROM INT8_TBL WHERE smallint('123') < q1;

SELECT * FROM INT8_TBL WHERE smallint('123') >= q1;

SELECT '' AS five, q1, q2, q1 - q2 AS `minus` FROM INT8_TBL;

SELECT '' AS five, q1, q2, q1 / q2 AS divide, q1 % q2 AS mod FROM INT8_TBL;

SELECT 37 + q1 AS plus4 FROM INT8_TBL;

SELECT '' AS five, q1 * 2 AS `twice int4` FROM INT8_TBL;

-- int8 op int2
SELECT q1 + smallint(42) AS `8plus2`, q1 - smallint(42) AS `8minus2`, q1 * smallint(42) AS `8mul2`, q1 / smallint(42) AS `8div2` FROM INT8_TBL;

SELECT min(q1), min(q2) FROM INT8_TBL;

-- SELECT '' AS to_char_2, to_char(q1, '9G999G999G999G999G999D999G999'), to_char(q2, '9,999,999,999,999,999.999,999')
-- FROM INT8_TBL;

SELECT '' AS to_char_3, to_char( (q1 * -1), '9999999999999999PR'), to_char( (q2 * -1), '9999999999999999.999PR')
FROM INT8_TBL;

-- SELECT '' AS to_char_6,  to_char(q2, 'FMS9999999999999999')    FROM INT8_TBL;
-- SELECT '' AS to_char_7,  to_char(q2, 'FM9999999999999999THPR') FROM INT8_TBL;
-- SELECT '' AS to_char_8,  to_char(q2, 'SG9999999999999999th')   FROM INT8_TBL;
SELECT '' AS to_char_9,  to_char(q2, '0999999999999999')       FROM INT8_TBL;

-- select bigint('9223372036854775800') % bigint('0');

-- select abs(bigint('-9223372036854775808'));

-- select bigint('9223372036854775800') + int('100');
-- select bigint('-9223372036854775800') - int('100');
-- select bigint('9223372036854775800') * int('100');

-- select int('100') + bigint('9223372036854775800');
-- select int('-100') - bigint('9223372036854775800');
-- select int('100') * bigint('9223372036854775800');

-- select bigint('9223372036854775800') + smallint('100');
-- select bigint('-9223372036854775800') - smallint('100');
-- select bigint('9223372036854775800') * smallint('100');
select bigint('-9223372036854775808') / smallint('0');

SELECT CAST(q1 AS int) FROM int8_tbl WHERE q2 <> 456;

SELECT CAST(smallint('42') AS bigint), CAST(smallint('-37') AS bigint);

SELECT CAST(double('922337203685477580700.0') AS bigint);

SELECT * FROM range(bigint('+4567890123456789'), bigint('+4567890123456799'), 0);

SELECT string(int(shiftleft(bigint(-1), 63))+1);

SELECT bigint((-9223372036854775808)) % bigint((-1));

SELECT bigint((-9223372036854775808)) % int((-1));

SELECT bigint((-9223372036854775808)) % smallint((-1));

DROP TABLE INT8_TBL;

SELECT interval '999' hour;

-- test SQL-spec syntaxes for restricted field sets
SELECT interval '1' year;

SELECT interval '4' hour;

-- [SPARK-29391] Default year-month units
-- SELECT interval '1' year to month;
SELECT interval '1-2' year to month;

-- SELECT interval '1 2' day to minute;
SELECT interval '1 2:03' day to minute;

SELECT interval '1 2:03:04' day to second;

-- SELECT interval '1 2' hour to second;
SELECT interval '1 2:03' hour to second;

SELECT interval '1 2:03:04' minute to second;

CREATE OR REPLACE TEMPORARY VIEW INT8_TBL AS SELECT * FROM
  (VALUES
    (123, 456),
    (123, 4567890123456789),
    (4567890123456789, 123),
    (4567890123456789, 4567890123456789),
    (4567890123456789, -4567890123456789))
  AS v(q1, q2);

CREATE OR REPLACE TEMPORARY VIEW tenk2 AS SELECT * FROM tenk1;

INSERT INTO J1_TBL VALUES (1, 4, 'one');

INSERT INTO J1_TBL VALUES (4, 1, 'four');

INSERT INTO J1_TBL VALUES (7, 7, 'seven');

INSERT INTO J1_TBL VALUES (NULL, NULL, 'null');

INSERT INTO J2_TBL VALUES (2, 2);

INSERT INTO J2_TBL VALUES (5, -5);

INSERT INTO J2_TBL VALUES (NULL, 0);

SELECT '' AS `xxx`, *
  FROM J1_TBL AS t1 (a, b, c);

-- [SPARK-28377] Fully support correlation names in the FROM clause
-- SELECT '' AS "xxx", t1.a, t2.e
--   FROM J1_TBL t1 (a, b, c), J2_TBL t2 (d, e)
--   WHERE t1.a = t2.d;


--
-- CROSS JOIN
-- Qualifications are not allowed on cross joins,
-- which degenerate into a standard unqualified inner join.
--

SELECT '' AS `xxx`, *
  FROM J1_TBL CROSS JOIN J2_TBL;

SELECT '' AS `xxx`, ii, tt, kk
  FROM (J1_TBL CROSS JOIN J2_TBL)
    AS tx (ii, jj, tt, ii2, kk);

-- Same as above, slightly different syntax
SELECT '' AS `xxx`, *
  FROM J1_TBL JOIN J2_TBL USING (i);

SELECT '' AS `xxx`, *
  FROM J1_TBL t1 (a, b, c) NATURAL JOIN J2_TBL t2 (a, d);

SELECT '' AS `xxx`, *
  FROM J1_TBL JOIN J2_TBL ON (J1_TBL.i = J2_TBL.k);

SELECT '' AS `xxx`, *
  FROM J1_TBL LEFT JOIN J2_TBL USING (i)
  ORDER BY i, k, t;

SELECT '' AS `xxx`, *
  FROM J1_TBL FULL OUTER JOIN J2_TBL USING (i)
  ORDER BY i, k, t;

SELECT '' AS `xxx`, *
  FROM J1_TBL LEFT JOIN J2_TBL USING (i) WHERE (i = 1);

CREATE TABLE t3 (name STRING, n INTEGER) USING parquet;

INSERT INTO t2 VALUES ( 'cc', 22 );

INSERT INTO t3 VALUES ( 'cc', 23 );

--
-- Test interactions of join syntax and subqueries
--

-- Basic cases (we expect planner to pull up the subquery here)
SELECT * FROM
(SELECT * FROM t2) as s2
INNER JOIN
(SELECT * FROM t3) s3
USING (name);

-- Cases with non-nullable expressions in subquery results;
-- make sure these go to null as expected
SELECT * FROM
(SELECT name, n as s2_n, 2 as s2_2 FROM t2) as s2
NATURAL INNER JOIN
(SELECT name, n as s3_n, 3 as s3_2 FROM t3) s3;

SELECT * FROM
(SELECT name, n as s1_n, 1 as s1_1 FROM t1) as s1
NATURAL INNER JOIN
(SELECT name, n as s2_n, 2 as s2_2 FROM t2) as s2
NATURAL INNER JOIN
(SELECT name, n as s3_n, 3 as s3_2 FROM t3) s3;

SELECT * FROM
(SELECT name, n as s1_n FROM t1) as s1
NATURAL FULL JOIN
  (SELECT * FROM
    (SELECT name, n as s2_n, 2 as s2_2 FROM t2) as s2
    NATURAL FULL JOIN
    (SELECT name, n as s3_n FROM t3) as s3
  ) ss2;

create or replace temporary view y as select * from
  (values (1,111), (2,222), (3,333), (4,null))
  as v(y1, y2);

select * from x left join y on (x1 = y1 and y2 is not null);

select * from (x left join y on (x1 = y1)) left join x xx(xx1,xx2)
on (x1 = xx1 and y2 is not null);

select * from (x left join y on (x1 = y1)) left join x xx(xx1,xx2)
on (x1 = xx1) where (y2 is not null);

--
-- regression test: check for failure to generate a plan with multiple
-- degenerate IN clauses
--
select count(*) from tenk1 x where
  x.unique1 in (select a.f1 from int4_tbl a,float8_tbl b where a.f1=b.f1) and
  x.unique1 = 0 and
  x.unique1 in (select aa.f1 from int4_tbl aa,float8_tbl bb where aa.f1=bb.f1);

--
-- regression test: check a case where join_clause_is_movable_into() gives
-- an imprecise result, causing an assertion failure
--
select count(*)
from
  (select t3.tenthous as x1, coalesce(t1.stringu1, t2.stringu1) as x2
   from tenk1 t1
   left join tenk1 t2 on t1.unique1 = t2.unique1
   join tenk1 t3 on t1.unique2 = t3.unique2) ss,
  tenk1 t4,
  tenk1 t5
where t4.thousand = t5.unique1 and ss.x1 = t4.tenthous and ss.x2 = t5.stringu1;

--
-- a different check for handling of redundant sort keys in merge joins
--
-- explain (costs off)
-- select count(*) from
--   (select * from tenk1 x order by x.thousand, x.twothousand, x.fivethous) x
--   left join
--   (select * from tenk1 y order by y.unique2) y
--   on x.thousand = y.unique2 and x.twothousand = y.hundred and x.fivethous = y.unique2;

select count(*) from
  (select * from tenk1 x order by x.thousand, x.twothousand, x.fivethous) x
  left join
  (select * from tenk1 y order by y.unique2) y
  on x.thousand = y.unique2 and x.twothousand = y.hundred and x.fivethous = y.unique2;

DROP TABLE J2_TBL;

-- set enable_hashjoin to off;
-- set enable_nestloop to off;

-- these should give the same results

select tt1.*, tt2.* from tt1 left join tt2 on tt1.joincol = tt2.joincol;

-- reset work_mem;
-- reset enable_mergejoin;

--
-- regression test for 8.2 bug with improper re-ordering of left joins
--

create or replace temporary view tt3 as select * from
  (SELECT cast(x.id as int), repeat('xyzzy', 100) FROM range(1,10001) x)
  as v(f1, f2);

--
-- regression test for proper handling of outer joins within antijoins
--

-- create temp table tt4x(c1 int, c2 int, c3 int);

-- explain (costs off)
-- select * from tt4x t1
-- where not exists (
--   select 1 from tt4x t2
--     left join tt4x t3 on t2.c3 = t3.c1
--     left join ( select t5.c1 as c1
--                 from tt4x t4 left join tt4x t5 on t4.c2 = t5.c1
--               ) a1 on t3.c2 = a1.c1
--   where t1.c1 = t2.c2
-- );

--
-- regression test for problems of the sort depicted in bug #3494
--

create or replace temporary view tt5 as select * from
  (values (1, 10), (1, 11))
  as v(f1, f2);

--
-- regression test for problems of the sort depicted in bug #3588
--

create or replace temporary view xx as select * from
  (values (1), (2), (3))
  as v(pkxx);

--
-- regression test for improper pushing of constants across outer-join clauses
-- (as seen in early 8.2.x releases)
--

create or replace temporary view zt1 as select * from
  (values (53))
  as v(f1);

select * from
  zt2 left join zt3 on (f2 = f3)
      left join zt1 on (f3 = f1)
where f2 = 53;

--
-- regression test for improper extraction of OR indexqual conditions
-- (as seen in early 8.3.x releases)
--

select a.unique2, a.ten, b.tenthous, b.unique2, b.hundred
from tenk1 a left join tenk1 b on a.unique2 = b.tenthous
where a.unique1 = 42 and
      ((b.unique2 is null and a.ten = 2) or b.hundred = 3);

select * from a left join b on i = x and i = y and x = i;

-- [SPARK-28330] Enhance query limit
-- select t1.q2, count(t2.q1, t2.q2)
-- from int8_tbl t1 left join (select * from int8_tbl offset 0) t2 on (t1.q2 = t2.q1)
-- group by t1.q2 order by 1;

select t1.q2, count(t2.q1, t2.q2)
from int8_tbl t1 left join
  (select q1, case when q2=1 then 1 else q2 end as q2 from int8_tbl) t2
  on (t1.q2 = t2.q1)
group by t1.q2 order by 1;

create or replace temporary view c as select * from
  (values ('A', 'p'), ('B', 'q'), ('C', null))
  as v(name, a);

-- test the path using join aliases, too
SELECT * FROM
( SELECT 1 as key1 ) sub1
LEFT JOIN
( SELECT sub3.key3, value2, COALESCE(value2, 66) as value3 FROM
    ( SELECT 1 as key3 ) sub3
    LEFT JOIN
    ( SELECT sub5.key5, COALESCE(sub6.value1, 1) as value2 FROM
        ( SELECT 1 as key5 ) sub5
        LEFT JOIN
        ( SELECT 2 as key6, 42 as value1 ) sub6
        ON sub5.key5 = sub6.key6
    ) sub4
    ON sub4.key5 = sub3.key3
) sub2
ON sub1.key1 = sub2.key3;

create or replace temporary view nt2 as select * from
  (values(1,1,true,true), (2,2,true,false), (3,3,false,false))
  as v(id, nt1_id, b1, b2);

-- Accessing outer query column is not allowed in LocalLimit
--
-- test case where a PlaceHolderVar is propagated into a subquery
--

-- explain (costs off)
-- select * from
--   int8_tbl t1 left join
--   (select q1 as x, 42 as y from int8_tbl t2) ss
--   on t1.q2 = ss.x
-- where
--   1 = (select 1 from int8_tbl t3 where ss.y is not null limit 1)
-- order by 1,2;

-- select * from
--   int8_tbl t1 left join
--   (select q1 as x, 42 as y from int8_tbl t2) ss
--   on t1.q2 = ss.x
-- where
--   1 = (select 1 from int8_tbl t3 where ss.y is not null limit 1)
-- order by 1,2;

--
-- test the corner cases FULL JOIN ON TRUE and FULL JOIN ON FALSE
--
select * from int4_tbl a full join int4_tbl b on true;

-- explain (costs off)
-- select b.unique1 from
--   tenk1 a join tenk1 b on a.unique1 = b.unique2
--   left join tenk1 c on b.unique1 = 42 and c.thousand = a.thousand
--   join int4_tbl i1 on b.thousand = f1
--   right join int4_tbl i2 on i2.f1 = b.tenthous
--   order by 1;

select b.unique1 from
  tenk1 a join tenk1 b on a.unique1 = b.unique2
  left join tenk1 c on b.unique1 = 42 and c.thousand = a.thousand
  join int4_tbl i1 on b.thousand = f1
  right join int4_tbl i2 on i2.f1 = b.tenthous
  order by 1;

-- explain (costs off)
-- select f1, unique2, case when unique2 is null then f1 else 0 end
--   from int4_tbl a left join tenk1 b on f1 = unique2
--   where (case when unique2 is null then f1 else 0 end) = 0;

select f1, unique2, case when unique2 is null then f1 else 0 end
  from int4_tbl a left join tenk1 b on f1 = unique2
  where (case when unique2 is null then f1 else 0 end) = 0;

-- [SPARK-27877] ANSI SQL: LATERAL derived table(T491)
--
-- test for appropriate join order in the presence of lateral references
--

-- explain (verbose, costs off)
select * from
   text_tbl t1
   left join int8_tbl i8
   on i8.q2 = 123,
   lateral (select i8.q1, t2.f1 from text_tbl t2 limit 1) as ss
where t1.f1 = ss.f1;

select * from
  text_tbl t1
  left join int8_tbl i8
  on i8.q2 = 123,
  lateral (select i8.q1, t2.f1 from text_tbl t2 limit 1) as ss1,
  lateral (select ss1.* from text_tbl t3 limit 1) as ss2
where t1.f1 = ss2.f1;

--
-- check a case in which a PlaceHolderVar forces join order
--

-- explain (verbose, costs off)
-- select ss2.* from
--   int4_tbl i41
--   left join int8_tbl i8
--     join (select i42.f1 as c1, i43.f1 as c2, 42 as c3
--           from int4_tbl i42, int4_tbl i43) ss1
--     on i8.q1 = ss1.c2
--   on i41.f1 = ss1.c1,
--   lateral (select i41.*, i8.*, ss1.* from text_tbl limit 1) ss2
-- where ss1.c2 = 0;

-- select ss2.* from
--   int4_tbl i41
--   left join int8_tbl i8
--     join (select i42.f1 as c1, i43.f1 as c2, 42 as c3
--           from int4_tbl i42, int4_tbl i43) ss1
--     on i8.q1 = ss1.c2
--   on i41.f1 = ss1.c1,
--   lateral (select i41.*, i8.*, ss1.* from text_tbl limit 1) ss2
-- where ss1.c2 = 0;

--
-- test successful handling of full join underneath left join (bug #14105)
--

-- explain (costs off)
-- select * from
--   (select 1 as id) as xx
--   left join
--     (tenk1 as a1 full join (select 1 as id) as yy on (a1.unique1 = yy.id))
--   on (xx.id = coalesce(yy.id));

select * from
  (select 1 as id) as xx
  left join
    (tenk1 as a1 full join (select 1 as id) as yy on (a1.unique1 = yy.id))
  on (xx.id = coalesce(yy.id));

create or replace temporary view child as select * from
  (values (1, 100), (4, 400))
  as v(k, cd);

-- explain (costs off)
--   select p.*, linked from parent p
--     left join (select c.*, true as linked from child c) as ss
--     on (p.k = ss.k);

-- check for a 9.0rc1 bug: join removal breaks pseudoconstant qual handling
select p.* from
  parent p left join child c on (p.k = c.k)
  where p.k = 1 and p.k = 2;

create or replace temporary view b as select * from
  (values (0, 0), (1, NULL))
  as v(id, a_id);

-- rollback;

-- another join removal bug: this is not optimizable, either
-- begin;

create or replace temporary view innertab as select * from
  (values (123L, 42L))
  as v(id, dat1);

-- error
select * from
  int8_tbl x join (int4_tbl x cross join int4_tbl y) j on q1 = y.f1;

-- error, prefer "t1" suggestion
select t2.uunique1 from
  tenk1 t1 join tenk2 t2 on t1.two = t2.two;

-- explain (costs off)
--   select unique2, x.*
--   from tenk1 a, lateral (select * from int4_tbl b where f1 = a.unique1) x;
select unique2, x.*
from int4_tbl x, lateral (select unique2 from tenk1 where f1 = unique1) ss;

-- select * from (select f1 as x from int4_tbl) ss1 join int4_tbl i4 on x = f1,
--   lateral (values(x)) ss2(y);
 select * from ((select f1/2 as x from int4_tbl) ss1 join int4_tbl i4 on x = f1) j,
   lateral (select x) ss2(y);

-- Accessing outer query column is not allowed in Union
-- select v.* from
--   (int8_tbl x left join (select q1,coalesce(q2,0) q2 from int8_tbl) y on x.q2 = y.q1)
--   left join int4_tbl z on z.f1 = x.q2,
--   lateral (select x.q1,y.q1 union all select x.q2,y.q2) v(vx,vy);
-- Accessing outer query column is not allowed in Union
-- select v.* from
--   (int8_tbl x left join (select q1,(select coalesce(q2,0)) q2 from int8_tbl) y on x.q2 = y.q1)
--   left join int4_tbl z on z.f1 = x.q2,
--   lateral (select x.q1,y.q1 union all select x.q2,y.q2) v(vx,vy);
-- Expressions referencing the outer query are not supported outside of WHERE/HAVING clauses
-- select v.* from
--   (int8_tbl x left join (select q1,(select coalesce(q2,0)) q2 from int8_tbl) y on x.q2 = y.q1)
--   left join int4_tbl z on z.f1 = x.q2,
--   lateral (select x.q1,y.q1 from onerow union all select x.q2,y.q2 from onerow) v(vx,vy);

-- explain (verbose, costs off)
-- select * from
--   int8_tbl a left join
--   lateral (select *, a.q2 as x from int8_tbl b) ss on a.q2 = ss.q1;
select * from
  int8_tbl a left join
  lateral (select *, a.q2 as x from int8_tbl b) ss on a.q2 = ss.q1;

-- explain (verbose, costs off)
-- select * from int4_tbl i left join
--   lateral (select coalesce(i) from int2_tbl j where i.f1 = j.f1) k on true;
-- select * from int4_tbl i left join
--   lateral (select coalesce(i) from int2_tbl j where i.f1 = j.f1) k on true;
-- explain (verbose, costs off)
-- select * from int4_tbl a,
--   lateral (
--     select * from int4_tbl b left join int8_tbl c on (b.f1 = q1 and a.f1 = q2)
--   ) ss;
-- select * from int4_tbl a,
--   lateral (
--     select * from int4_tbl b left join int8_tbl c on (b.f1 = q1 and a.f1 = q2)
--   ) ss;

-- lateral reference in a PlaceHolderVar evaluated at join level
-- explain (verbose, costs off)
-- select * from
--   int8_tbl a left join lateral
--   (select b.q1 as bq1, c.q1 as cq1, least(a.q1,b.q1,c.q1) from
--    int8_tbl b cross join int8_tbl c) ss
--   on a.q2 = ss.bq1;
select * from
  int8_tbl a left join lateral
  (select b.q1 as bq1, c.q1 as cq1, least(a.q1,b.q1,c.q1) from
   int8_tbl b cross join int8_tbl c) ss
  on a.q2 = ss.bq1;

select f1,g from int4_tbl a cross join (select f1 as g) ss;

CREATE TABLE j2 (id1 int, id2 int) USING parquet;

-- insert into j3 values(1,1);

-- analyze j1;
-- analyze j2;
-- analyze j3;

-- ensure there's no unique join when not all columns which are part of the
-- unique index are seen in the join clause
-- explain (verbose, costs off)
-- select * from j1
-- inner join j2 on j1.id1 = j2.id1;

-- ensure proper unique detection with multiple join quals
-- explain (verbose, costs off)
-- select * from j1
-- inner join j2 on j1.id1 = j2.id1 and j1.id2 = j2.id2;

-- ensure we don't detect the join to be unique when quals are not part of the
-- join condition
-- explain (verbose, costs off)
-- select * from j1
-- inner join j2 on j1.id1 = j2.id1 where j1.id2 = 1;

-- as above, but for left joins.
-- explain (verbose, costs off)
-- select * from j1
-- left join j2 on j1.id1 = j2.id1 where j1.id2 = 1;

-- validate logic in merge joins which skips mark and restore.
-- it should only do this if all quals which were used to detect the unique
-- are present as join quals, and not plain quals.
-- set enable_nestloop to 0;
-- set enable_hashjoin to 0;
-- set enable_sort to 0;

-- create indexes that will be preferred over the PKs to perform the join
-- create index j1_id1_idx on j1 (id1) where id1 % 1000 = 1;
-- create index j2_id1_idx on j2 (id1) where id1 % 1000 = 1;

-- need an additional row in j2, if we want j2_id1_idx to be preferred
INSERT INTO j2 values(1,2);

drop table j2;

SELECT '' AS two, unique1, unique2, stringu1
		FROM onek WHERE unique1 > 60 AND unique1 < 63
		ORDER BY unique1 LIMIT 5;

SELECT '' AS eleven, unique1, unique2, stringu1
		FROM onek WHERE unique1 < 50
 		ORDER BY unique1 DESC LIMIT 20 OFFSET 39;

-- Test null limit and offset.  The planner would discard a simple null
-- constant, so to ensure executor is exercised, do this:
-- [SPARK-29650] Discard a NULL constant in LIMIT
select * from int8_tbl limit (case when random() < 0.5 then bigint(null) end);

-- Stress test for variable LIMIT in conjunction with bounded-heap sorting

-- [SPARK-27767] Built-in function: generate_series
-- SELECT
--   (SELECT n
--      FROM (VALUES (1)) AS x,
--           (SELECT n FROM generate_series(1,10) AS n
--              ORDER BY n LIMIT 1 OFFSET s-1) AS y) AS z
--   FROM generate_series(1,10) AS s;

--
-- Test behavior of volatile and set-returning functions in conjunction
-- with ORDER BY and LIMIT.
--

-- [SPARK-29631] Support ANSI SQL CREATE SEQUENCE
-- create temp sequence testseq;

-- explain (verbose, costs off)
-- select unique1, unique2, nextval('testseq')
--   from tenk1 order by unique2 limit 10;

-- select unique1, unique2, nextval('testseq')
--   from tenk1 order by unique2 limit 10;

-- select currval('testseq');

-- explain (verbose, costs off)
-- select unique1, unique2, nextval('testseq')
--   from tenk1 order by tenthous limit 10;

-- select unique1, unique2, nextval('testseq')
--   from tenk1 order by tenthous limit 10;

-- select currval('testseq');

-- explain (verbose, costs off)
-- select unique1, unique2, generate_series(1,10)
--   from tenk1 order by unique2 limit 7;

-- [SPARK-27767] Built-in function: generate_series
-- select unique1, unique2, generate_series(1,10)
--   from tenk1 order by unique2 limit 7;

-- explain (verbose, costs off)
-- select unique1, unique2, generate_series(1,10)
--   from tenk1 order by tenthous limit 7;

-- [SPARK-27767] Built-in function: generate_series
-- select unique1, unique2, generate_series(1,10)
--   from tenk1 order by tenthous limit 7;

-- use of random() is to keep planner from folding the expressions together
-- explain (verbose, costs off)
-- select generate_series(0,2) as s1, generate_series((random()*.1)::int,2) as s2;

-- [SPARK-27767] Built-in function: generate_series
-- select generate_series(0,2) as s1, generate_series((random()*.1)::int,2) as s2;

-- explain (verbose, costs off)
-- select generate_series(0,2) as s1, generate_series((random()*.1)::int,2) as s2
-- order by s2 desc;

-- [SPARK-27767] Built-in function: generate_series
-- select generate_series(0,2) as s1, generate_series((random()*.1)::int,2) as s2
-- order by s2 desc;

-- test for failure to set all aggregates' aggtranstype
-- explain (verbose, costs off)
-- select sum(tenthous) as s1, sum(tenthous) + random()*0 as s2
--   from tenk1 group by thousand order by thousand limit 3;

select sum(tenthous) as s1, sum(tenthous) + random()*0 as s2
  from tenk1 group by thousand order by thousand limit 3;

CREATE TABLE num_exp_sub (id1 int, id2 int, expected decimal(38,10)) USING parquet;

CREATE TABLE num_exp_sqrt (id int, expected decimal(38,10)) USING parquet;

CREATE TABLE num_exp_power_10_ln (id int, expected decimal(38,10)) USING parquet;

INSERT INTO num_exp_sub VALUES (0,0,0);

INSERT INTO num_exp_add VALUES (0,1,0);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (0,1,double('NaN'));

INSERT INTO num_exp_mul VALUES (0,2,0);

INSERT INTO num_exp_sub VALUES (0,3,-4.31);

INSERT INTO num_exp_add VALUES (0,4,7799461.4119);

INSERT INTO num_exp_div VALUES (0,4,0);

INSERT INTO num_exp_mul VALUES (0,5,0);

INSERT INTO num_exp_sub VALUES (0,6,-93901.57763026);

INSERT INTO num_exp_add VALUES (0,7,-83028485);

INSERT INTO num_exp_div VALUES (0,7,0);

INSERT INTO num_exp_mul VALUES (0,8,0);

INSERT INTO num_exp_sub VALUES (0,9,24926804.045047420);

INSERT INTO num_exp_add VALUES (1,0,0);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (1,0,double('NaN'));

INSERT INTO num_exp_mul VALUES (1,1,0);

INSERT INTO num_exp_sub VALUES (1,2,34338492.215397047);

INSERT INTO num_exp_add VALUES (1,3,4.31);

INSERT INTO num_exp_div VALUES (1,3,0);

INSERT INTO num_exp_mul VALUES (1,4,0);

INSERT INTO num_exp_sub VALUES (1,5,-16397.038491);

INSERT INTO num_exp_add VALUES (1,6,93901.57763026);

INSERT INTO num_exp_div VALUES (1,6,0);

INSERT INTO num_exp_mul VALUES (1,7,0);

INSERT INTO num_exp_sub VALUES (1,8,-74881);

INSERT INTO num_exp_add VALUES (1,9,-24926804.045047420);

INSERT INTO num_exp_div VALUES (1,9,0);

INSERT INTO num_exp_mul VALUES (2,0,0);

INSERT INTO num_exp_sub VALUES (2,1,-34338492.215397047);

INSERT INTO num_exp_add VALUES (2,2,-68676984.430794094);

INSERT INTO num_exp_div VALUES (2,2,1.00000000000000000000);

INSERT INTO num_exp_mul VALUES (2,3,-147998901.44836127257);

INSERT INTO num_exp_sub VALUES (2,4,-42137953.627297047);

INSERT INTO num_exp_add VALUES (2,5,-34322095.176906047);

INSERT INTO num_exp_div VALUES (2,5,-2094.18866914563535496429);

INSERT INTO num_exp_mul VALUES (2,6,-3224438592470.18449811926184222);

INSERT INTO num_exp_sub VALUES (2,7,48689992.784602953);

INSERT INTO num_exp_add VALUES (2,8,-34263611.215397047);

INSERT INTO num_exp_div VALUES (2,8,-458.57416721727870888476);

INSERT INTO num_exp_mul VALUES (2,9,855948866655588.453741509242968740);

INSERT INTO num_exp_sub VALUES (3,0,4.31);

INSERT INTO num_exp_add VALUES (3,1,4.31);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (3,1,double('NaN'));

INSERT INTO num_exp_mul VALUES (3,2,-147998901.44836127257);

INSERT INTO num_exp_sub VALUES (3,3,0);

INSERT INTO num_exp_add VALUES (3,4,7799465.7219);

INSERT INTO num_exp_div VALUES (3,4,.00000055260225961552);

INSERT INTO num_exp_mul VALUES (3,5,70671.23589621);

INSERT INTO num_exp_sub VALUES (3,6,-93897.26763026);

INSERT INTO num_exp_add VALUES (3,7,-83028480.69);

INSERT INTO num_exp_div VALUES (3,7,-.00000005190989574240);

INSERT INTO num_exp_mul VALUES (3,8,322737.11);

INSERT INTO num_exp_sub VALUES (3,9,24926808.355047420);

INSERT INTO num_exp_add VALUES (4,0,7799461.4119);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (4,0,double('NaN'));

INSERT INTO num_exp_mul VALUES (4,1,0);

INSERT INTO num_exp_sub VALUES (4,2,42137953.627297047);

INSERT INTO num_exp_add VALUES (4,3,7799465.7219);

INSERT INTO num_exp_div VALUES (4,3,1809619.81714617169373549883);

INSERT INTO num_exp_mul VALUES (4,4,60831598315717.14146161);

INSERT INTO num_exp_sub VALUES (4,5,7783064.373409);

INSERT INTO num_exp_add VALUES (4,6,7893362.98953026);

INSERT INTO num_exp_div VALUES (4,6,83.05996138436129499606);

INSERT INTO num_exp_mul VALUES (4,7,-647577464846017.9715);

INSERT INTO num_exp_sub VALUES (4,8,7724580.4119);

INSERT INTO num_exp_add VALUES (4,9,-17127342.633147420);

INSERT INTO num_exp_div VALUES (4,9,-.31289456112403769409);

INSERT INTO num_exp_mul VALUES (5,0,0);

INSERT INTO num_exp_sub VALUES (5,1,16397.038491);

INSERT INTO num_exp_add VALUES (5,2,-34322095.176906047);

INSERT INTO num_exp_div VALUES (5,2,-.00047751189505192446);

INSERT INTO num_exp_mul VALUES (5,3,70671.23589621);

INSERT INTO num_exp_sub VALUES (5,4,-7783064.373409);

INSERT INTO num_exp_add VALUES (5,5,32794.076982);

INSERT INTO num_exp_div VALUES (5,5,1.00000000000000000000);

INSERT INTO num_exp_mul VALUES (5,6,1539707782.76899778633766);

INSERT INTO num_exp_sub VALUES (5,7,83044882.038491);

INSERT INTO num_exp_add VALUES (5,8,91278.038491);

INSERT INTO num_exp_div VALUES (5,8,.21897461960978085228);

INSERT INTO num_exp_mul VALUES (5,9,-408725765384.257043660243220);

INSERT INTO num_exp_sub VALUES (6,0,93901.57763026);

INSERT INTO num_exp_add VALUES (6,1,93901.57763026);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (6,1,double('NaN'));

INSERT INTO num_exp_mul VALUES (6,2,-3224438592470.18449811926184222);

INSERT INTO num_exp_sub VALUES (6,3,93897.26763026);

INSERT INTO num_exp_add VALUES (6,4,7893362.98953026);

INSERT INTO num_exp_div VALUES (6,4,.01203949512295682469);

INSERT INTO num_exp_mul VALUES (6,5,1539707782.76899778633766);

INSERT INTO num_exp_sub VALUES (6,6,0);

INSERT INTO num_exp_add VALUES (6,7,-82934583.42236974);

INSERT INTO num_exp_div VALUES (6,7,-.00113095617281538980);

INSERT INTO num_exp_mul VALUES (6,8,7031444034.53149906);

INSERT INTO num_exp_sub VALUES (6,9,25020705.622677680);

INSERT INTO num_exp_add VALUES (7,0,-83028485);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (7,0,double('NaN'));

INSERT INTO num_exp_mul VALUES (7,1,0);

INSERT INTO num_exp_sub VALUES (7,2,-48689992.784602953);

INSERT INTO num_exp_add VALUES (7,3,-83028480.69);

INSERT INTO num_exp_div VALUES (7,3,-19264149.65197215777262180974);

INSERT INTO num_exp_mul VALUES (7,4,-647577464846017.9715);

INSERT INTO num_exp_sub VALUES (7,5,-83044882.038491);

INSERT INTO num_exp_add VALUES (7,6,-82934583.42236974);

INSERT INTO num_exp_div VALUES (7,6,-884.20756174009028770294);

INSERT INTO num_exp_mul VALUES (7,7,6893729321395225);

INSERT INTO num_exp_sub VALUES (7,8,-83103366);

INSERT INTO num_exp_add VALUES (7,9,-107955289.045047420);

INSERT INTO num_exp_div VALUES (7,9,3.33089171198810413382);

INSERT INTO num_exp_mul VALUES (8,0,0);

INSERT INTO num_exp_sub VALUES (8,1,74881);

INSERT INTO num_exp_add VALUES (8,2,-34263611.215397047);

INSERT INTO num_exp_div VALUES (8,2,-.00218067233500788615);

INSERT INTO num_exp_mul VALUES (8,3,322737.11);

INSERT INTO num_exp_sub VALUES (8,4,-7724580.4119);

INSERT INTO num_exp_add VALUES (8,5,91278.038491);

INSERT INTO num_exp_div VALUES (8,5,4.56673929509287019456);

INSERT INTO num_exp_mul VALUES (8,6,7031444034.53149906);

INSERT INTO num_exp_sub VALUES (8,7,83103366);

INSERT INTO num_exp_add VALUES (8,8,149762);

INSERT INTO num_exp_div VALUES (8,8,1.00000000000000000000);

INSERT INTO num_exp_mul VALUES (8,9,-1866544013697.195857020);

INSERT INTO num_exp_sub VALUES (9,0,-24926804.045047420);

INSERT INTO num_exp_add VALUES (9,1,-24926804.045047420);

-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_div VALUES (9,1,double('NaN'));

INSERT INTO num_exp_mul VALUES (9,2,855948866655588.453741509242968740);

INSERT INTO num_exp_sub VALUES (9,3,-24926808.355047420);

INSERT INTO num_exp_add VALUES (9,4,-17127342.633147420);

INSERT INTO num_exp_div VALUES (9,4,-3.19596478892958416484);

INSERT INTO num_exp_mul VALUES (9,5,-408725765384.257043660243220);

INSERT INTO num_exp_sub VALUES (9,6,-25020705.622677680);

INSERT INTO num_exp_add VALUES (9,7,-107955289.045047420);

INSERT INTO num_exp_div VALUES (9,7,.30021990699995814689);

INSERT INTO num_exp_mul VALUES (9,8,-1866544013697.195857020);

INSERT INTO num_exp_sub VALUES (9,9,0);

-- COMMIT TRANSACTION;
-- BEGIN TRANSACTION;
-- PostgreSQL implicitly casts string literals to data with decimal types, but
-- Spark does not support that kind of implicit casts. To test all the INSERT queries below,
-- we rewrote them into the other typed literals.
INSERT INTO num_exp_sqrt VALUES (0,0);

INSERT INTO num_exp_sqrt VALUES (3,2.07605394920266944396);

INSERT INTO num_exp_sqrt VALUES (6,306.43364311096782703406);

INSERT INTO num_exp_sqrt VALUES (9,4992.67503899937593364766);

INSERT INTO num_exp_ln VALUES (2,17.35177750493897715514);

INSERT INTO num_exp_ln VALUES (5,9.70485601768871834038);

INSERT INTO num_exp_ln VALUES (8,11.22365546576315513668);

INSERT INTO num_exp_log10 VALUES (1,double('NaN'));

INSERT INTO num_exp_log10 VALUES (4,6.89206461372691743345);

INSERT INTO num_exp_log10 VALUES (7,7.91922711353275546914);

-- COMMIT TRANSACTION;
-- BEGIN TRANSACTION;
-- PostgreSQL implicitly casts string literals to data with decimal types, but
-- Spark does not support that kind of implicit casts. To test all the INSERT queries below,
-- we rewrote them into the other typed literals.
-- [SPARK-28315] Decimal can not accept NaN as input
INSERT INTO num_exp_power_10_ln VALUES (0,double('NaN'));

INSERT INTO num_exp_power_10_ln VALUES (3,28.90266599445155957393);

INSERT INTO num_exp_power_10_ln VALUES (6,281839893606.99372343357047819067);

INSERT INTO num_exp_power_10_ln VALUES (9,107511333880052007.04141124673540337457);

INSERT INTO num_data VALUES (2, -34338492.215397047);

INSERT INTO num_data VALUES (5, 16397.038491);

INSERT INTO num_data VALUES (8, 74881);

-- ******************************
-- * Create indices for faster checks
-- ******************************

-- CREATE UNIQUE INDEX num_exp_add_idx ON num_exp_add (id1, id2);
-- CREATE UNIQUE INDEX num_exp_sub_idx ON num_exp_sub (id1, id2);
-- CREATE UNIQUE INDEX num_exp_div_idx ON num_exp_div (id1, id2);
-- CREATE UNIQUE INDEX num_exp_mul_idx ON num_exp_mul (id1, id2);
-- CREATE UNIQUE INDEX num_exp_sqrt_idx ON num_exp_sqrt (id);
-- CREATE UNIQUE INDEX num_exp_ln_idx ON num_exp_ln (id);
-- CREATE UNIQUE INDEX num_exp_log10_idx ON num_exp_log10 (id);
-- CREATE UNIQUE INDEX num_exp_power_10_ln_idx ON num_exp_power_10_ln (id);

-- VACUUM ANALYZE num_exp_add;
-- VACUUM ANALYZE num_exp_sub;
-- VACUUM ANALYZE num_exp_div;
-- VACUUM ANALYZE num_exp_mul;
-- VACUUM ANALYZE num_exp_sqrt;
-- VACUUM ANALYZE num_exp_ln;
-- VACUUM ANALYZE num_exp_log10;
-- VACUUM ANALYZE num_exp_power_10_ln;

-- ******************************
-- * Now check the behaviour of the NUMERIC type
-- ******************************

-- ******************************
-- * Addition check
-- ******************************
TRUNCATE TABLE num_result;

TRUNCATE TABLE num_result;

-- ******************************
-- * Subtraction check
-- ******************************
TRUNCATE TABLE num_result;

INSERT INTO num_result SELECT t1.id, t2.id, round(t1.val - t2.val, 40)
    FROM num_data t1, num_data t2;

INSERT INTO num_result SELECT t1.id, t2.id, t1.val, t2.val, t1.val * t2.val
    FROM num_data t1, num_data t2;

SELECT t1.id1, t1.id2, t1.result, round(t2.expected, 30) as expected
    FROM num_result t1, num_exp_mul t2
    WHERE t1.id1 = t2.id1 AND t1.id2 = t2.id2
    AND t1.result != round(t2.expected, 30);

SELECT t1.id1, t1.id2, t1.result, t2.expected
    FROM num_result t1, num_exp_div t2
    WHERE t1.id1 = t2.id1 AND t1.id2 = t2.id2
    AND t1.result != t2.expected;

-- ******************************
-- * Square root check
-- ******************************
TRUNCATE TABLE num_result;

-- ******************************
-- * Natural logarithm check
-- ******************************
TRUNCATE TABLE num_result;

-- ******************************
-- * Logarithm base 10 check
-- ******************************
TRUNCATE TABLE num_result;

-- ******************************
-- * POWER(10, LN(value)) check
-- ******************************
-- [SPARK-28316] Decimal precision issue
TRUNCATE TABLE num_result;

-- ******************************
-- * miscellaneous checks for things that have been broken in the past...
-- ******************************
-- numeric AVG used to fail on some platforms
SELECT AVG(val) FROM num_data;

INSERT INTO fract_only VALUES (2, 0.1);

-- [SPARK-27923] PostgreSQL throws an exception but Spark SQL is NULL
-- INSERT INTO fract_only VALUES (6, '0.99995');  -- should fail
-- PostgreSQL implicitly casts string literals to data with decimal types, but
-- Spark does not support that kind of implicit casts. To test all the INSERT queries below,
-- we rewrote them into the other typed literals.
INSERT INTO fract_only VALUES (7, 0.00001);

DROP TABLE fract_only;

SELECT decimal(double('-Infinity'));

SELECT decimal(float('-Infinity'));

INSERT INTO ceil_floor_round VALUES (-5.499999);

INSERT INTO ceil_floor_round VALUES (0.0);

SELECT a, ceil(a), ceiling(a), floor(a), round(a) FROM ceil_floor_round;

SELECT width_bucket(5.0, 3.0, 4.0, -5);

SELECT width_bucket(double(5.0), double(3.0), double(4.0), -5);

SELECT width_bucket(double(0), 'NaN', double(4.0), 888);

SELECT
    operand_num,
    width_bucket(operand_num, 0, 10, 5) AS wb_1,
    width_bucket(operand_f8, 0, 10, 5) AS wb_1f,
    width_bucket(operand_num, 10, 0, 5) AS wb_2,
    width_bucket(operand_f8, 10, 0, 5) AS wb_2f,
    width_bucket(operand_num, 2, 8, 4) AS wb_3,
    width_bucket(operand_f8, 2, 8, 4) AS wb_3f,
    width_bucket(operand_num, 5.0, 5.5, 20) AS wb_4,
    width_bucket(operand_f8, 5.0, 5.5, 20) AS wb_4f,
    width_bucket(operand_num, -25, 25, 10) AS wb_5,
    width_bucket(operand_f8, -25, 25, 10) AS wb_5f
    FROM width_bucket_test
    ORDER BY operand_num ASC;

-- error
SELECT width_bucket(double('Infinity'), 1, 10, 10),
       width_bucket(double('-Infinity'), 1, 10, 10);

SELECT '' AS to_char_4, to_char(val, '9999999999999999.999999999999999S'), val
FROM num_data;

SELECT '' AS to_char_10, to_char(val, 'S0999999999999999.999999999999999'), val      FROM num_data;

-- SELECT '' AS to_number_3,  to_number('<564646.654564>', '999999.999999PR');
SELECT '' AS to_number_4,  to_number('0.00001-', '9.999999S');

-- SELECT '' AS to_number_11, to_number('.-01', 'S99.99');
SELECT '' AS to_number_12, to_number('.01-', '99.99S');

SELECT '' AS to_number_16, to_number('123456','999G999');

INSERT INTO num_input_test VALUES (double(trim('   3245874    ')));

INSERT INTO num_input_test VALUES (-555.50);

select div(cast(999999999999999999999 as decimal(38, 0)),1000000000000000000000);

select mod(cast(-9999999999999999999999 as decimal(38, 0)),1000000000000000000000);

select div (70.0,70);

-- [SPARK-2659] HiveQL: Division operator should always perform fractional division
-- select 12345678901234567890 DIV 123;
-- select div(12345678901234567890, 123);
-- select div(12345678901234567890, 123) * 123 + 12345678901234567890 % 123;

-- [SPARK-28007] Caret operator (^) means bitwise XOR in Spark and exponentiation in Postgres
--
-- Test code path for raising to integer powers
--

-- select 10.0 ^ -2147483648 as rounds_to_zero;
-- select 10.0 ^ -2147483647 as rounds_to_zero;
-- select 10.0 ^ 2147483647 as overflows;
-- select 117743296169.0 ^ 1000000000 as overflows;

-- cases that used to return inaccurate results
-- select 3.789 ^ 21;
-- select 3.789 ^ 35;
-- select 1.2 ^ 345;
-- select 0.12 ^ (-20);

-- cases that used to error out
-- select 0.12 ^ (-25);
-- select 0.5678 ^ (-85);

--
-- Tests for raising to non-integer powers
--

-- special cases
-- select 0.0 ^ 0.0;
-- select (-12.34) ^ 0.0;
-- select 12.34 ^ 0.0;
-- select 0.0 ^ 12.34;

-- NaNs
-- select 'NaN'::numeric ^ 'NaN'::numeric;
-- select 'NaN'::numeric ^ 0;
-- select 'NaN'::numeric ^ 1;
-- select 0 ^ 'NaN'::numeric;
-- select 1 ^ 'NaN'::numeric;

-- invalid inputs
-- select 0.0 ^ (-12.34);
-- select (-12.34) ^ 1.2;

-- cases that used to generate inaccurate results
-- select 32.1 ^ 9.8;
-- select 32.1 ^ (-9.8);
-- select 12.3 ^ 45.6;
-- select 12.3 ^ (-45.6);

-- big test
-- select 1.234 ^ 5678;

--
-- Tests for EXP()
--

-- special cases
select exp(0.0);

select exp(-32.999);

-- big test
select exp(1234.5678);

select * from range(cast(4.0 as decimal(38, 18)), cast(-1.5 as decimal(38, 18)), cast(-2.2 as decimal(38, 18)));

-- [SPARK-28318] Decimal can only support precision up to 38
-- select ln(0.349873948359354029493948309745709580730482050975);
select ln(0.99949452);

select ln(5.80397490724e5);

select log(9.999999999999999999);

select log(590489.45235237);

-- [SPARK-28318] Decimal can only support precision up to 38
-- select log(3.1954752e47, 9.4792021e-73);

-- [SPARK-28317] Built-in Mathematical Functions: SCALE
--
-- Tests for scale()
--

-- select scale(numeric 'NaN');
-- select scale(NULL::numeric);
-- select scale(1.12);
-- select scale(0);
-- select scale(0.00);
-- select scale(1.12345);
-- select scale(110123.12475871856128);
-- select scale(-1123.12471856128);
-- select scale(-13.000000000000000);

--
-- Tests for SUM()
--

-- cases that need carry propagation
SELECT SUM(decimal(9999)) FROM range(1, 100001);

DROP TABLE num_exp_add;

DROP TABLE num_exp_mul;

DROP TABLE num_exp_log10;

DROP TABLE num_input_test;

-- btree index
-- awk '{if($1<10){print;}else{next;}}' onek.data | sort +0n -1
--
SELECT * FROM onek
   WHERE onek.unique1 < 10
   ORDER BY onek.unique1;

--
-- awk '{if($1>980){print $1,$16;}else{next;}}' onek.data |
-- sort +1d -2 +0nr -1
--
SELECT onek.unique1, onek.string4 FROM onek
   WHERE onek.unique1 > 980
   ORDER BY string4 ASC, unique1 DESC;

--
-- awk '{if($1<20){print $1,$16;}else{next;}}' onek.data |
-- sort +0n -1 +1dr -2
--
SELECT onek.unique1, onek.string4 FROM onek
   WHERE onek.unique1 < 20
   ORDER BY unique1 ASC, string4 DESC;

--
-- awk '{if($1>980){print $1,$14;}else{next;}}' onek.data | sort +1d -2
--
SELECT onek2.unique1, onek2.stringu1 FROM onek2
   WHERE onek2.unique1 > 980;

select foo.* from (select null) as foo;

-- [SPARK-28296] Improved VALUES support
-- a more complex case
-- looks like we're coding lisp :-)
-- select * from onek,
--   (values ((select i from
--     (values(10000), (2), (389), (1000), (2000), ((select 10029))) as foo(i)
--     order by i asc limit 1))) bar (i)
--   where onek.unique1 = bar.i;

-- try VALUES in a subquery
-- select * from onek
--     where (unique1,ten) in (values (1,1), (20,0), (99,9), (17,99))
--     order by unique1;

-- VALUES is also legal as a standalone query or a set-operation member
VALUES (1,2), (3,4+4), (7,77.7);

-- [SPARK-28333] NULLS FIRST for DESC and NULLS LAST for ASC
SELECT * FROM foo ORDER BY f1;

SELECT * FROM foo ORDER BY f1 DESC;

-- actually run the query with an analyze to use the partial index
-- explain (costs off, analyze on, timing off, summary off)
-- select * from onek2 where unique2 = 11 and stringu1 = 'ATAAAA';
-- explain (costs off)
-- select unique2 from onek2 where unique2 = 11 and stringu1 = 'ATAAAA';
select unique2 from onek2 where unique2 = 11 and stringu1 = 'ATAAAA';

-- but if it's an update target, must retest anyway
-- explain (costs off)
-- select unique2 from onek2 where unique2 = 11 and stringu1 < 'B' for update;
-- select unique2 from onek2 where unique2 = 11 and stringu1 < 'B' for update;
-- partial index is not applicable
-- explain (costs off)
-- select unique2 from onek2 where unique2 = 11 and stringu1 < 'C';
select unique2 from onek2 where unique2 = 11 and stringu1 < 'C';

-- explain (costs off)
-- select unique1, unique2 from onek2
--   where (unique2 = 11 and stringu1 < 'B') or unique1 = 0;
select unique1, unique2 from onek2
  where (unique2 = 11 and stringu1 < 'B') or unique1 = 0;

select * from (values (2),(null),(1)) v(k) where k = k;

--
-- awk '{print $3;}' onek.data | sort -n | uniq
--
SELECT DISTINCT two FROM tmp ORDER BY 1;

-- [SPARK-28010] Support ORDER BY ... USING syntax
--
-- awk '{print $3,$16,$5;}' onek.data | sort -d | uniq |
-- sort +0n -1 +1d -2 +2n -3
--
-- SELECT DISTINCT two, string4, ten
--    FROM tmp
--    ORDER BY two using <, string4 using <, ten using <;
SELECT DISTINCT two, string4, ten
   FROM tmp
   ORDER BY two ASC, string4 ASC, ten ASC;

-- basic cases
SELECT f1, f1 IS DISTINCT FROM 2 as `not 2` FROM disttable;

SELECT f1, f1 IS DISTINCT FROM f1+1 as `not null` FROM disttable;

SELECT 2 IS DISTINCT FROM null as `yes`;

SELECT 2 IS NOT DISTINCT FROM 2 as `yes`;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- SELECT_HAVING
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/select_having.sql
--

-- load test data
CREATE TABLE test_having (a int, b int, c string, d string) USING parquet;

INSERT INTO test_having VALUES (2, 2, 'AAAA', 'c');

INSERT INTO test_having VALUES (5, 3, 'bbbb', 'F');

INSERT INTO test_having VALUES (8, 4, 'CCCC', 'I');

-- HAVING is effectively equivalent to WHERE in this case
SELECT b, c FROM test_having
	GROUP BY b, c HAVING b = 3 ORDER BY b, c;

SELECT min(a), max(a) FROM test_having HAVING min(a) < max(a);

-- the really degenerate case: need not scan table at all
SELECT 1 AS one FROM test_having HAVING 1 > 2;

DROP TABLE test_having;

INSERT INTO test_missing_target VALUES (1, 2, 'ABAB', 'b');

INSERT INTO test_missing_target VALUES (4, 3, 'BBBB', 'e');

INSERT INTO test_missing_target VALUES (7, 4, 'cccc', 'h');

--   w/ existing GROUP BY target
SELECT c, count(*) FROM test_missing_target GROUP BY test_missing_target.c ORDER BY c;

--   w/o existing GROUP BY target and w/o existing same ORDER BY target
SELECT count(*) FROM test_missing_target GROUP BY b ORDER BY b;

--   w/o existing ORDER BY target
SELECT count(*) FROM test_missing_target GROUP BY b ORDER BY b desc;

--   group using reference number out of range
--   failure expected
SELECT c, count(*) FROM test_missing_target GROUP BY 3;

--   order expression w/ target under ambiguous condition
--   failure NOT expected
SELECT a/2, a/2 FROM test_missing_target
	ORDER BY a/2;

--   group w/o existing GROUP BY target under ambiguous condition
SELECT count(*) FROM test_missing_target x, test_missing_target y
	WHERE x.a = y.a
	GROUP BY x.b ORDER BY x.b;

--   w/o existing GROUP BY target and w/o existing a different ORDER BY target
--   failure expected
SELECT count(a) FROM test_missing_target GROUP BY a ORDER BY b;

--   w/o existing GROUP BY target
SELECT a FROM test_missing_target ORDER BY upper(d);

--   group w/ existing GROUP BY target under ambiguous condition
SELECT x.b/2, count(x.b) FROM test_missing_target x, test_missing_target y
	WHERE x.a = y.a
	GROUP BY x.b/2 ORDER BY x.b/2;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
-- STRINGS
-- -- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/strings.sql
-- Test various data entry syntaxes.
--

-- SQL string continuation syntax
-- E021-03 character string literals
SELECT 'first line'
' - next line'
	' - third line'
	AS `Three lines to one`;

SELECT binary('\\x De Ad Be Ef ');

SELECT binary('De\\000dBeEf');

SELECT TRIM(LEADING FROM '  bunch o blanks  ') = 'bunch o blanks  ' AS `bunch o blanks  `;

-- E021-06 substring expression
SELECT SUBSTRING('1234567890' FROM 3) = '34567890' AS `34567890`;

SELECT POSITION('5' IN '1234567890') = '5' AS `5`;

SELECT OVERLAY('yabadoo' PLACING 'daba' FROM 5 FOR 0) AS `yabadabadoo`;

SELECT 'hawkeye' NOT LIKE 'h%' AS `false`;

SELECT 'hawkeye' LIKE 'indio%' AS `false`;

SELECT 'hawkeye' NOT LIKE 'h%eye' AS `false`;

SELECT 'indio' LIKE 'in__o' AS `true`;

SELECT 'indio' NOT LIKE 'in_o' AS `true`;

SELECT 'indio' LIKE 'ind_o' ESCAPE '$' AS `true`;

SELECT 'h%' NOT LIKE 'h#%' ESCAPE '#' AS `false`;

SELECT 'h%wkeye' LIKE 'h#%%' ESCAPE '#' AS `true`;

SELECT 'h%awkeye' NOT LIKE 'h#%a%k%e' ESCAPE '#' AS `false`;

SELECT 'i_dio' LIKE 'i$_d_o' ESCAPE '$' AS `true`;

SELECT 'i_dio' NOT LIKE 'i$_nd_o' ESCAPE '$' AS `true`;

-- escape character same as pattern character
SELECT 'maca' LIKE 'm%aca' ESCAPE '%' AS `true`;

SELECT 'ma%a' NOT LIKE 'm%a%%a' ESCAPE '%' AS `false`;

SELECT 'be_r' LIKE 'b_e__r' ESCAPE '_' AS `true`;

SELECT 'be_r' NOT LIKE '__e__r' ESCAPE '_' AS `true`;

SELECT 'foo' LIKE '__%' as t, 'foo' LIKE '___%' as t, 'foo' LIKE '____%' as f;

-- Skip tests of LIKE with indexes
--
-- basic tests of LIKE with indexes
--

-- CREATE TABLE texttest (a text PRIMARY KEY, b int);
-- SELECT * FROM texttest WHERE a LIKE '%1%';

-- CREATE TABLE byteatest (a bytea PRIMARY KEY, b int);
-- SELECT * FROM byteatest WHERE a LIKE '%1%';

-- DROP TABLE texttest, byteatest;


--
-- test implicit type conversion
--

-- E021-07 character concatenation
SELECT 'unknown' || ' and unknown' AS `Concat unknown types`;

insert into toasttest values(repeat('1234567890',10000));

-- If start plus length is > string length, the result is truncated to
-- string length
SELECT substr(f1, 99995, 10) from toasttest;

SELECT position('xy', 'abcdef') AS `pos_0`;

SELECT replace('yabadoo', 'bad', '') AS `yaoo`;

--
-- MD5 test suite - from IETF RFC 1321
-- (see: ftp://ftp.rfc-editor.org/in-notes/rfc1321.txt)
--
select md5('') = 'd41d8cd98f00b204e9800998ecf8427e' AS `TRUE`;

select md5('message digest') = 'f96b697d7cb7938d525a2f31aaf161d0' AS `TRUE`;

select md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890') = '57edf4a22be3c955ac49da2e2107b67a' AS `TRUE`;

select md5(binary('abc')) = '900150983cd24fb0d6963f7d28e17f72' AS `TRUE`;

select md5(binary('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')) = 'd174ab98d277d9f5a5611c2c9f419d9f' AS `TRUE`;

SELECT lpad('hi', 5, 'xy');

SELECT lpad('hello', 2);

SELECT rpad('hi', 5);

SELECT rpad('hi', 5, '');

SELECT ascii('x');

-- PostgreSQL throws: ERROR:  null character not permitted
SELECT chr(0);

SELECT trim(binary('\\000') from binary('\\000Tom\\000'));

SELECT btrim(binary('\\000trim\\000'), binary(''));

SELECT string('this is a text string') = string('this is a text strin') AS `false`;

INSERT INTO TEXT_TBL VALUES ('hi de ho neighbor');

-- But as a special exception for usability's sake, we still allow implicit
-- casting to text in concatenations, so long as the other input is text or
-- an unknown literal.  So these work:
-- [SPARK-28033] String concatenation low priority than other arithmeticBinary
select string('four: ') || 2+2;

/*
 * various string functions
 */
select concat('one');

select concat_ws('#',1,2,3,'hello',true, false, to_date('20100309','yyyyMMdd'));

select concat_ws(NULL,10,20,null,30) is null;

-- [SPARK-28037] Add built-in String Functions: quote_literal
-- select quote_literal('');
-- select quote_literal('abc''');
-- select quote_literal(e'\\');

-- Skip these tests because Spark does not support variadic labeled argument
-- check variadic labeled argument
-- select concat(variadic array[1,2,3]);
-- select concat_ws(',', variadic array[1,2,3]);
-- select concat_ws(',', variadic NULL::int[]);
-- select concat(variadic NULL::int[]) is NULL;
-- select concat(variadic '{}'::int[]) = '';
--should fail
-- select concat_ws(',', variadic 10);

-- [SPARK-27930] Replace format to format_string
/*
 * format
 */
select format_string(NULL);

select format_string('Hello %%');

select format_string('Hello %s');

select format_string('%1$s %12$s', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);

--PostgreSQL throw ERROR:  format specifies argument 0, but arguments are numbered from 1
select format_string('%0$s', 'Hello');

-- Skip these tests because Spark does not support variadic labeled argument
-- check variadic labeled arguments
-- select format('%s, %s', variadic array['Hello','World']);
-- select format('%s, %s', variadic array[1, 2]);
-- select format('%s, %s', variadic array[true, false]);
-- select format('%s, %s', variadic array[true, false]::text[]);
-- check variadic with positional placeholders
-- select format('%2$s, %1$s', variadic array['first', 'second']);
-- select format('%2$s, %1$s', variadic array[1, 2]);
-- variadic argument can be array type NULL, but should not be referenced
-- select format('Hello', variadic NULL::int[]);
-- variadic argument allows simulating more than FUNC_MAX_ARGS parameters
-- select format(string_agg('%s',','), variadic array_agg(i))
-- from generate_series(1,200) g(i);
-- check field widths and left, right alignment
select format_string('>>%10s<<', 'Hello');

select format_string('>>%-10s<<', '');

select format_string('>>%1$10s<<', 'Hello');

-- Test shorthand input values
-- We can't just "select" the results since they aren't constants; test for
-- equality instead.  We can do that by running the test inside a transaction
-- block, within which the value of 'now' shouldn't change.  We also check
-- that 'now' *does* change over a reasonable interval such as 100 msec.
-- NOTE: it is possible for this part of the test to fail if the transaction
-- block is entered exactly at local midnight; then 'now' and 'today' have
-- the same values and the counts will come out different.

-- PostgreSQL implicitly casts string literals to data with timestamp types, but
-- Spark does not support that kind of implicit casts.
INSERT INTO TIMESTAMP_TBL VALUES (timestamp'now');

INSERT INTO TIMESTAMP_TBL VALUES (timestamp'yesterday');

-- [SPARK-29024] Ignore case while resolving time zones
INSERT INTO TIMESTAMP_TBL VALUES (timestamp'tomorrow Zulu');

SELECT count(*) AS One FROM TIMESTAMP_TBL WHERE d1 = timestamp 'yesterday';

-- [SPARK-27923] Spark SQL insert there obsolete special values to NULL
-- Obsolete special values
-- INSERT INTO TIMESTAMP_TBL VALUES ('invalid');
-- INSERT INTO TIMESTAMP_TBL VALUES ('undefined');
-- INSERT INTO TIMESTAMP_TBL VALUES ('current');

-- [SPARK-28259] Date/Time Output Styles and Date Order Conventions
-- Postgres v6.0 standard output format
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01 1997 PST');

-- Variations on Postgres v6.1 standard output format
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01.000001 1997 PST');
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01.999999 1997 PST');
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01.4 1997 PST');
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01.5 1997 PST');
-- INSERT INTO TIMESTAMP_TBL VALUES ('Mon Feb 10 17:32:01.6 1997 PST');

-- ISO 8601 format
-- PostgreSQL implicitly casts string literals to data with timestamp types, but
-- Spark does not support that kind of implicit casts.
INSERT INTO TIMESTAMP_TBL VALUES (timestamp('1997-01-02'));

-- INSERT INTO TIMESTAMP_TBL VALUES ('1997-02-10 17:32:01-0800');
-- INSERT INTO TIMESTAMP_TBL VALUES ('1997-02-10 17:32:01 -08:00');
-- INSERT INTO TIMESTAMP_TBL VALUES ('19970210 173201 -0800');
-- INSERT INTO TIMESTAMP_TBL VALUES ('1997-06-10 17:32:01 -07:00');
INSERT INTO TIMESTAMP_TBL VALUES (timestamp('2001-09-22T18:19:20'));

SELECT '' AS `15`, d1 FROM TIMESTAMP_TBL
   WHERE d1 < timestamp '1997-01-02';

SELECT '' AS `16`, d1 FROM TIMESTAMP_TBL
   WHERE d1 <= timestamp '1997-01-02';

SELECT '' AS date_trunc_week, date_trunc( 'week', timestamp '2004-02-29 15:44:17.71393' ) AS week_trunc;

-- SELECT '' AS `54`, d1 as `timestamp`,
--     date_part( 'quarter', d1) AS quarter, date_part( 'msec', d1) AS msec,
--     date_part( 'usec', d1) AS usec
--     FROM TIMESTAMP_TBL WHERE d1 BETWEEN '1902-01-01' AND '2038-01-01';

-- SELECT '' AS `54`, d1 as `timestamp`,
--     date_part( 'isoyear', d1) AS isoyear, date_part( 'week', d1) AS week,
--     date_part( 'dow', d1) AS dow
--     FROM TIMESTAMP_TBL WHERE d1 BETWEEN '1902-01-01' AND '2038-01-01';

-- [SPARK-28137] Data Type Formatting Functions
-- TO_CHAR()
-- SELECT '' AS to_char_1, to_char(d1, 'DAY Day day DY Dy dy MONTH Month month RM MON Mon mon')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_2, to_char(d1, 'FMDAY FMDay FMday FMMONTH FMMonth FMmonth FMRM')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_3, to_char(d1, 'Y,YYY YYYY YYY YY Y CC Q MM WW DDD DD D J')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_4, to_char(d1, 'FMY,YYY FMYYYY FMYYY FMYY FMY FMCC FMQ FMMM FMWW FMDDD FMDD FMD FMJ')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_5, to_char(d1, 'HH HH12 HH24 MI SS SSSS')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_6, to_char(d1, E'"HH:MI:SS is" HH:MI:SS "\\"text between quote marks\\""')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_7, to_char(d1, 'HH24--text--MI--text--SS')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_8, to_char(d1, 'YYYYTH YYYYth Jth')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_9, to_char(d1, 'YYYY A.D. YYYY a.d. YYYY bc HH:MI:SS P.M. HH:MI:SS p.m. HH:MI:SS pm')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_10, to_char(d1, 'IYYY IYY IY I IW IDDD ID')
--    FROM TIMESTAMP_TBL;

-- SELECT '' AS to_char_11, to_char(d1, 'FMIYYY FMIYY FMIY FMI FMIW FMIDDD FMID')
--    FROM TIMESTAMP_TBL;


-- timestamp numeric fields constructor
SELECT make_timestamp(2014,12,28,6,30,45.887);

CREATE OR REPLACE TEMPORARY VIEW FLOAT8_TBL AS SELECT * FROM
  (VALUES (0.0), (-34.84), (-1004.30),
    (CAST('-1.2345678901234e+200' AS DOUBLE)), (CAST('-1.2345678901234e-200' AS DOUBLE)))
  AS v(f1);

SELECT 1 AS two UNION ALL SELECT 2;

SELECT 1 AS two UNION SELECT 2 UNION SELECT 2 ORDER BY 1;

-- Mixed types

SELECT 1.1 AS two UNION SELECT 2 ORDER BY 1;

SELECT 1.1 AS two UNION ALL SELECT 2 ORDER BY 1;

SELECT double(1.1) AS two UNION SELECT 2 UNION SELECT double(2.0) ORDER BY 1;

--
-- Try testing from tables...
--

SELECT f1 AS five FROM FLOAT8_TBL
UNION
SELECT f1 FROM FLOAT8_TBL
ORDER BY 1;

SELECT f1 AS ten FROM FLOAT8_TBL
UNION ALL
SELECT f1 FROM INT4_TBL;

SELECT q2 FROM int8_tbl INTERSECT ALL SELECT q1 FROM int8_tbl ORDER BY 1;

SELECT q2 FROM int8_tbl EXCEPT ALL SELECT DISTINCT q1 FROM int8_tbl ORDER BY 1;

SELECT q1 FROM int8_tbl EXCEPT ALL SELECT DISTINCT q2 FROM int8_tbl ORDER BY 1;

(SELECT 1,2,3 UNION SELECT 4,5,6) EXCEPT SELECT 4,5,6;

-- explain (costs off)
-- select unique1 from tenk1 except select unique2 from tenk1 where unique2 != 10;
select unique1 from tenk1 except select unique2 from tenk1 where unique2 != 10;

SELECT f1 FROM float8_tbl EXCEPT SELECT f1 FROM int4_tbl ORDER BY 1;

(((SELECT q1 FROM int8_tbl INTERSECT SELECT q2 FROM int8_tbl ORDER BY 1))) UNION ALL SELECT q2 FROM int8_tbl;

(((SELECT q1 FROM int8_tbl UNION ALL SELECT q2 FROM int8_tbl))) EXCEPT SELECT q1 FROM int8_tbl ORDER BY 1;

-- But this should work:
SELECT q1 FROM int8_tbl EXCEPT (((SELECT q2 FROM int8_tbl ORDER BY q2 LIMIT 1))) ORDER BY 1;

select * from range(1,6) union all select * from range(1,4);

select * from range(1,6) except select * from range(1,4);

-- reset enable_hashagg;
-- reset enable_sort;

--
-- Check handling of a case with unknown constants.  We don't guarantee
-- an undecorated constant will work in all cases, but historically this
-- usage has worked, so test we don't break it.
--

-- SELECT a.f1 FROM (SELECT 'test' AS f1 FROM varchar_tbl) a
-- UNION
-- SELECT b.f1 FROM (SELECT f1 FROM varchar_tbl) b
-- ORDER BY 1;

-- This should fail, but it should produce an error cursor
SELECT cast('3.4' as decimal(38, 18)) UNION SELECT 'foo';

-- explain (costs off)
-- SELECT * FROM
--   (SELECT 1 AS t, (random()*3)::int AS x
--    UNION
--    SELECT 2 AS t, 4 AS x) ss
-- WHERE x > 3
-- ORDER BY x;

SELECT * FROM
  (SELECT 1 AS t, int((random()*3)) AS x
   UNION
   SELECT 2 AS t, 4 AS x) ss
WHERE x > 3
ORDER BY x;

-- Skip this test because it only test explain
-- Test proper handling of parameterized appendrel paths when the
-- potential join qual is expensive
-- create function expensivefunc(int) returns int
-- language plpgsql immutable strict cost 10000
-- as $$begin return $1; end$$;

-- create temp table t3 as select generate_series(-1000,1000) as x;
-- create index t3i on t3 (expensivefunc(x));
-- analyze t3;

-- explain (costs off)
-- select * from
--   (select * from t3 a union all select * from t3 b) ss
--   join int4_tbl on f1 = expensivefunc(x);
-- select * from
--   (select * from t3 a union all select * from t3 b) ss
--   join int4_tbl on f1 = expensivefunc(x);

-- drop table t3;
-- drop function expensivefunc(int);

-- Test handling of appendrel quals that const-simplify into an AND
-- explain (costs off)
-- select * from
--   (select *, 0 as x from int8_tbl a
--    union all
--    select *, 1 as x from int8_tbl b) ss
-- where (x = 0) or (q1 >= q2 and q1 <= q2);
select * from
  (select *, 0 as x from int8_tbl a
   union all
   select *, 1 as x from int8_tbl b) ss
where (x = 0) or (q1 >= q2 and q1 <= q2);

-- [SPARK-29540] Thrift in some cases can't parse string to date
-- SELECT depname, empno, salary, sum(salary) OVER w FROM empsalary WINDOW w AS (PARTITION BY depname);

-- [SPARK-28064] Order by does not accept a call to rank()
-- SELECT depname, empno, salary, rank() OVER w FROM empsalary WINDOW w AS (PARTITION BY depname ORDER BY salary) ORDER BY rank() OVER w;

-- empty window specification
SELECT COUNT(*) OVER () FROM tenk1 WHERE unique2 < 10;

-- cumulative aggregate
SELECT sum(four) OVER (PARTITION BY ten ORDER BY unique2) AS sum_1, ten, four FROM tenk1 WHERE unique2 < 10;

SELECT dense_rank() OVER (PARTITION BY four ORDER BY ten), ten, four FROM tenk1 WHERE unique2 < 10;

SELECT ntile(3) OVER (ORDER BY ten, four), ten, four FROM tenk1 WHERE unique2 < 10;

SELECT lead(ten * 2, 1) OVER (PARTITION BY four ORDER BY ten), ten, four FROM tenk1 WHERE unique2 < 10;

-- last returns the last row of the frame, which is CURRENT ROW in ORDER BY window.
SELECT last(four) OVER (ORDER BY ten), ten, four FROM tenk1 WHERE unique2 < 10;

SELECT count(*) OVER (PARTITION BY four), four FROM (SELECT * FROM tenk1 WHERE two = 1)s WHERE unique2 < 10;

SELECT avg(four) OVER (PARTITION BY four ORDER BY thousand / 100) FROM tenk1 WHERE unique2 < 10;

-- [SPARK-29540] Thrift in some cases can't parse string to date
-- mixture of agg/wfunc in the same window
-- SELECT sum(salary) OVER w, rank() OVER w FROM empsalary WINDOW w AS (PARTITION BY depname ORDER BY salary DESC);

-- Cannot safely cast 'enroll_date': string to date;
-- SELECT empno, depname, salary, bonus, depadj, MIN(bonus) OVER (ORDER BY empno), MAX(depadj) OVER () FROM(
-- SELECT *,
--   CASE WHEN enroll_date < '2008-01-01' THEN 2008 - extract(year FROM enroll_date) END * 500 AS bonus,
--   CASE WHEN
--     AVG(salary) OVER (PARTITION BY depname) < salary
--     THEN 200 END AS depadj FROM empsalary
--   )s;

create temporary view int4_tbl as select * from values
  (0),
  (123456),
  (-123456),
  (2147483647),
  (-2147483647)
  as int4_tbl(f1);

-- window and aggregate with GROUP BY expression (9.2 bug)
-- explain
-- select first(max(x)) over (), y
--   from (select unique1 as x, ten+four as y from tenk1) ss
--   group by y;

-- test non-default frame specifications
SELECT four, ten,
sum(ten) over (partition by four order by ten),
last(ten) over (partition by four order by ten)
FROM (select distinct ten, four from tenk1) ss;

-- [SPARK-29451] Some queries with divisions in SQL windows are failling in Thrift
-- SELECT four, ten/4 as two,
-- sum(ten/4) over (partition by four order by ten/4 range between unbounded preceding and current row),
-- last(ten/4) over (partition by four order by ten/4 range between unbounded preceding and current row)
-- FROM (select distinct ten, four from tenk1) ss;

-- [SPARK-29451] Some queries with divisions in SQL windows are failling in Thrift
-- SELECT four, ten/4 as two,
-- sum(ten/4) over (partition by four order by ten/4 rows between unbounded preceding and current row),
-- last(ten/4) over (partition by four order by ten/4 rows between unbounded preceding and current row)
-- FROM (select distinct ten, four from tenk1) ss;

SELECT sum(unique1) over (order by four range between current row and unbounded following),
unique1, four
FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (rows between 2 preceding and 2 following exclude no others),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (rows between 2 preceding and 2 following exclude current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (rows between 2 preceding and 2 following exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (rows between 2 preceding and 2 following exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT first(unique1) over (ORDER BY four rows between current row and 2 following exclude current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT first(unique1) over (ORDER BY four rows between current row and 2 following exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT first(unique1) over (ORDER BY four rows between current row and 2 following exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT last(unique1) over (ORDER BY four rows between current row and 2 following exclude current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT last(unique1) over (ORDER BY four rows between current row and 2 following exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT last(unique1) over (ORDER BY four rows between current row and 2 following exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

SELECT sum(unique1) over (rows between 2 preceding and 1 preceding),
unique1, four
FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (w range between current row and unbounded following),
-- 	unique1, four
-- FROM tenk1 WHERE unique1 < 10 WINDOW w AS (order by four);

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (w range between unbounded preceding and current row exclude current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10 WINDOW w AS (order by four);

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (w range between unbounded preceding and current row exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10 WINDOW w AS (order by four);

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (w range between unbounded preceding and current row exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10 WINDOW w AS (order by four);

-- [SPARK-30707] Lead/Lag window function throws AnalysisException without ORDER BY clause
-- SELECT first_value(unique1) over w,
-- nth_value(unique1, 2) over w AS nth_2,
-- last_value(unique1) over w, unique1, four
-- FROM tenk1 WHERE unique1 < 10
-- WINDOW w AS (order by four range between current row and unbounded following);

-- [SPARK-28501] Frame bound value must be a literal.
-- SELECT sum(unique1) over
-- (order by unique1
--   rows (SELECT unique1 FROM tenk1 ORDER BY unique1 LIMIT 1) + 1 PRECEDING),
-- unique1
-- FROM tenk1 WHERE unique1 < 10;

CREATE TEMP VIEW v_window AS
SELECT i.id, sum(i.id) over (order by i.id rows between 1 preceding and 1 following) as sum_rows
FROM range(1, 11) i;

-- [SPARK-29540] Thrift in some cases can't parse string to date
-- DROP TABLE empsalary;
DROP VIEW tenk2;

INSERT INTO empsalary VALUES
  ('develop', 10, 5200, date '2007-08-01'),
  ('sales', 1, 5000, date '2006-10-01'),
  ('personnel', 5, 3500, date '2007-12-10'),
  ('sales', 4, 4800, date '2007-08-08'),
  ('personnel', 2, 3900, date '2006-12-23'),
  ('develop', 7, 4200, date '2008-01-01'),
  ('develop', 9, 4500, date '2008-01-01'),
  ('sales', 3, 4800, date '2007-08-01'),
  ('develop', 8, 6000, date '2006-10-01'),
  ('develop', 11, 5200, date '2007-08-15');

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 preceding exclude no others),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 preceding exclude current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 preceding exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 preceding exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 6 following exclude ties),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 6 following exclude group),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

SELECT sum(unique1) over (partition by four order by unique1 range between 5 preceding and 6 following),
unique1, four
FROM tenk1 WHERE unique1 < 10;

select ss.id, ss.y,
       first(ss.y) over w,
       last(ss.y) over w
from
  (select x.id, x.id as y from range(1,6) as x
   union all select null, 42
   union all select null, 43) ss
window w as
  (order by ss.id desc nulls first range between 2 preceding and 2 following);

select x.id, last(x.id) over (order by x.id desc range between current row and 2147450885 following)
from range(-32766, -32765) x;

select x.id, last(x.id) over (order by x.id range between current row and 4 following)
from range(9223372036854775804, 9223372036854775807) x;

insert into numerics values
(1, -3, -3, -3),
(2, -1, -1, -1),
(3, 0, 0, 0),
(4, 1.1, 1.1, 1.1),
(5, 1.12, 1.12, 1.12),
(6, 2, 2, 2),
(7, 100, 100, 100);

select id, f_float4, first(id) over w, last(id) over w
from numerics
window w as (order by f_float4 range between
             'inf' preceding and 'inf' following);

select id, f_float8, first(id) over w, last(id) over w
from numerics
window w as (order by f_float8 range between
             1 preceding and 1.1 following);

-- error, NaN disallowed

select id, f_numeric, first(id) over w, last(id) over w
from numerics
window w as (order by f_numeric range between
             1 preceding and 1 following);

-- error, NaN disallowed

drop table empsalary;

CREATE TABLE empsalary (
    depname string,
    empno integer,
    salary int,
    enroll_date date
) USING parquet;

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_time, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_time range between
--              '70 min' preceding and '2 hours' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_time, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_time desc range between
--              '70 min' preceding and '2 hours' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timetz, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timetz range between
--              '70 min' preceding and '2 hours' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timetz, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timetz desc range between
--              '70 min' preceding and '2 hours' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_interval, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_interval range between
--              '1 year' preceding and '1 year' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_interval, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_interval desc range between
--              '1 year' preceding and '1 year' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timestamptz, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timestamptz range between
--              '1 year' preceding and '1 year' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timestamptz, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timestamptz desc range between
--              '1 year' preceding and '1 year' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timestamp, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timestamp range between
--              '1 year' preceding and '1 year' following);

-- [SPARK-28429] SQL Datetime util function being casted to double instead of timestamp
-- select id, f_timestamp, first(id) over w, last(id) over w
-- from datetimes
-- window w as (order by f_timestamp desc range between
--              '1 year' preceding and '1 year' following);

-- RANGE offset PRECEDING/FOLLOWING error cases
-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select sum(salary) over (order by enroll_date, salary range between '1 year' preceding and '2 years' following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select sum(salary) over (range between '1 year' preceding and '2 years' following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select sum(salary) over (order by depname range between '1 year' preceding and '2 years' following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select max(enroll_date) over (order by enroll_date range between 1 preceding and 2 following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select max(enroll_date) over (order by salary range between -1 preceding and 2 following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select max(enroll_date) over (order by salary range between 1 preceding and -2 following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select max(enroll_date) over (order by salary range between '1 year' preceding and '2 years' following
-- 	exclude ties), salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select max(enroll_date) over (order by enroll_date range between '1 year' preceding and '-2 years' following
-- 	exclude ties), salary, enroll_date from empsalary;

-- GROUPS tests

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between unbounded preceding and current row),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between unbounded preceding and unbounded following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between current row and unbounded following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between 1 preceding and unbounded following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between 1 following and unbounded following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between unbounded preceding and 2 following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between 2 preceding and 1 preceding),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between 2 preceding and 1 following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (order by four groups between 0 preceding and 0 following),
-- unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four groups between 2 preceding and 1 following
--   exclude current row), unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 following
--   exclude group), unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- SELECT sum(unique1) over (order by four range between 2 preceding and 1 following
--   exclude ties), unique1, four
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (partition by ten
--   order by four groups between 0 preceding and 0 following),unique1, four, ten
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (partition by ten
--   order by four groups between 0 preceding and 0 following exclude current row), unique1, four, ten
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (partition by ten
--   order by four groups between 0 preceding and 0 following exclude group), unique1, four, ten
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- SELECT sum(unique1) over (partition by ten
--   order by four groups between 0 preceding and 0 following exclude ties), unique1, four, ten
-- FROM tenk1 WHERE unique1 < 10;

-- [SPARK-27951] ANSI SQL: NTH_VALUE function
-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- select first_value(salary) over(order by enroll_date groups between 1 preceding and 1 following),
-- lead(salary) over(order by enroll_date groups between 1 preceding and 1 following),
-- nth_value(salary, 1) over(order by enroll_date groups between 1 preceding and 1 following),
-- salary, enroll_date from empsalary;

-- [SPARK-28508] Support for range frame+row frame in the same query
-- [SPARK-28648] Adds support to `groups` unit type in window clauses
-- select last(salary) over(order by enroll_date groups between 1 preceding and 1 following),
-- lag(salary)         over(order by enroll_date groups between 1 preceding and 1 following),
-- salary, enroll_date from empsalary;

-- [SPARK-27951] ANSI SQL: NTH_VALUE function
-- select first_value(salary) over(order by enroll_date groups between 1 following and 3 following
--   exclude current row),
-- lead(salary) over(order by enroll_date groups between 1 following and 3 following exclude ties),
-- nth_value(salary, 1) over(order by enroll_date groups between 1 following and 3 following
--   exclude ties),
-- salary, enroll_date from empsalary;

-- [SPARK-28428] Spark `exclude` always expecting `()`
-- select last(salary) over(order by enroll_date groups between 1 following and 3 following
--   exclude group),
-- lag(salary) over(order by enroll_date groups between 1 following and 3 following exclude group),
-- salary, enroll_date from empsalary;

-- Show differences in offset interpretation between ROWS, RANGE, and GROUPS
WITH cte (x) AS (
        SELECT * FROM range(1, 36, 2)
)
SELECT x, (sum(x) over w)
FROM cte
WINDOW w AS (ORDER BY x rows between 1 preceding and 1 following);

WITH cte (x) AS (
        select 1 union all select 1 union all select 1 union all
        SELECT * FROM range(5, 50, 2)
)
SELECT x, (sum(x) over w)
FROM cte
WINDOW w AS (ORDER BY x range between 1 preceding and 1 following);

insert into t1 values (1,1),(1,2),(2,2);

select f1, sum(f1) over (partition by f1, f1 order by f2
range between 2 preceding and 1 preceding)
from t1 where f1 = f2;

-- can't order by another window function
-- [SPARK-28566] window functions should not be allowed in window definitions
-- SELECT rank() OVER (ORDER BY rank() OVER (ORDER BY random()));

-- some other errors
SELECT * FROM empsalary WHERE row_number() OVER (ORDER BY salary) < 10;

SELECT * FROM rank() OVER (ORDER BY random());

-- [SPARK-28645] Throw an error on window redefinition
-- select count(*) OVER w FROM tenk1 WINDOW w AS (ORDER BY unique1), w AS (ORDER BY unique1);

select rank() OVER (PARTITION BY four, ORDER BY ten) FROM tenk1;

SELECT nth_value(four, 0) OVER (ORDER BY ten), ten, four FROM tenk1;

-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
-- Window Functions Testing
-- https://github.com/postgres/postgres/blob/REL_12_STABLE/src/test/regress/sql/window.sql#L913-L1278

-- Test window operator with codegen on and off.




-- Spark doesn't handle UDFs in SQL
-- test user-defined window function with named args and default args
-- CREATE FUNCTION nth_value_def(val anyelement, n integer = 1) RETURNS anyelement
--   LANGUAGE internal WINDOW IMMUTABLE STRICT AS 'window_nth_value';

-- Spark doesn't handle UDFs in SQL
-- SELECT nth_value_def(n := 2, val := ten) OVER (PARTITION BY four), ten, four
--   FROM (SELECT * FROM tenk1 WHERE unique2 < 10 ORDER BY four, ten) s;

-- Spark doesn't handle UDFs in SQL
-- SELECT nth_value_def(ten) OVER (PARTITION BY four), ten, four
--   FROM (SELECT * FROM tenk1 WHERE unique2 < 10 ORDER BY four, ten) s;

--
-- Test the basic moving-aggregate machinery
--

-- create aggregates that record the series of transform calls (these are
-- intentionally not true inverses)

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_sfunc_nonstrict(text, anyelement) RETURNS text AS
-- $$ SELECT COALESCE($1, '') || '*' || quote_nullable($2) $$
-- LANGUAGE SQL IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_msfunc_nonstrict(text, anyelement) RETURNS text AS
-- $$ SELECT COALESCE($1, '') || '+' || quote_nullable($2) $$
-- LANGUAGE SQL IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_minvfunc_nonstrict(text, anyelement) RETURNS text AS
-- $$ SELECT $1 || '-' || quote_nullable($2) $$
-- LANGUAGE SQL IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE AGGREGATE logging_agg_nonstrict (anyelement)
-- (
-- 	stype = text,
-- 	sfunc = logging_sfunc_nonstrict,
-- 	mstype = text,
-- 	msfunc = logging_msfunc_nonstrict,
-- 	minvfunc = logging_minvfunc_nonstrict
-- );

-- Spark doesn't handle UDFs in SQL
-- CREATE AGGREGATE logging_agg_nonstrict_initcond (anyelement)
-- (
-- 	stype = text,
-- 	sfunc = logging_sfunc_nonstrict,
-- 	mstype = text,
-- 	msfunc = logging_msfunc_nonstrict,
-- 	minvfunc = logging_minvfunc_nonstrict,
-- 	initcond = 'I',
-- 	minitcond = 'MI'
-- );

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_sfunc_strict(text, anyelement) RETURNS text AS
-- $$ SELECT $1 || '*' || quote_nullable($2) $$
-- LANGUAGE SQL STRICT IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_msfunc_strict(text, anyelement) RETURNS text AS
-- $$ SELECT $1 || '+' || quote_nullable($2) $$
-- LANGUAGE SQL STRICT IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION logging_minvfunc_strict(text, anyelement) RETURNS text AS
-- $$ SELECT $1 || '-' || quote_nullable($2) $$
-- LANGUAGE SQL STRICT IMMUTABLE;

-- Spark doesn't handle UDFs in SQL
-- CREATE AGGREGATE logging_agg_strict (text)
-- (
-- 	stype = text,
-- 	sfunc = logging_sfunc_strict,
-- 	mstype = text,
-- 	msfunc = logging_msfunc_strict,
-- 	minvfunc = logging_minvfunc_strict
-- );

-- Spark doesn't handle UDFs in SQL
-- CREATE AGGREGATE logging_agg_strict_initcond (anyelement)
-- (
-- 	stype = text,
-- 	sfunc = logging_sfunc_strict,
-- 	mstype = text,
-- 	msfunc = logging_msfunc_strict,
-- 	minvfunc = logging_minvfunc_strict,
-- 	initcond = 'I',
-- 	minitcond = 'MI'
-- );

-- Spark doesn't handle UDFs in SQL
-- test strict and non-strict cases
-- SELECT
-- 	p::text || ',' || i::text || ':' || COALESCE(v::text, 'NULL') AS row,
-- 	logging_agg_nonstrict(v) over wnd as nstrict,
-- 	logging_agg_nonstrict_initcond(v) over wnd as nstrict_init,
-- 	logging_agg_strict(v::text) over wnd as strict,
-- 	logging_agg_strict_initcond(v) over wnd as strict_init
-- FROM (VALUES
-- 	(1, 1, NULL),
-- 	(1, 2, 'a'),
-- 	(1, 3, 'b'),
-- 	(1, 4, NULL),
-- 	(1, 5, NULL),
-- 	(1, 6, 'c'),
-- 	(2, 1, NULL),
-- 	(2, 2, 'x'),
-- 	(3, 1, 'z')
-- ) AS t(p, i, v)
-- WINDOW wnd AS (PARTITION BY P ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
-- ORDER BY p, i;

-- Spark doesn't handle UDFs in SQL
-- and again, but with filter
-- SELECT
-- 	p::text || ',' || i::text || ':' ||
-- 		CASE WHEN f THEN COALESCE(v::text, 'NULL') ELSE '-' END as row,
-- 	logging_agg_nonstrict(v) filter(where f) over wnd as nstrict_filt,
-- 	logging_agg_nonstrict_initcond(v) filter(where f) over wnd as nstrict_init_filt,
-- 	logging_agg_strict(v::text) filter(where f) over wnd as strict_filt,
-- 	logging_agg_strict_initcond(v) filter(where f) over wnd as strict_init_filt
-- FROM (VALUES
-- 	(1, 1, true,  NULL),
-- 	(1, 2, false, 'a'),
-- 	(1, 3, true,  'b'),
-- 	(1, 4, false, NULL),
-- 	(1, 5, false, NULL),
-- 	(1, 6, false, 'c'),
-- 	(2, 1, false, NULL),
-- 	(2, 2, true,  'x'),
-- 	(3, 1, true,  'z')
-- ) AS t(p, i, f, v)
-- WINDOW wnd AS (PARTITION BY p ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
-- ORDER BY p, i;

-- Spark doesn't handle UDFs in SQL
-- test that volatile arguments disable moving-aggregate mode
-- SELECT
-- 	i::text || ':' || COALESCE(v::text, 'NULL') as row,
-- 	logging_agg_strict(v::text)
-- 		over wnd as inverse,
-- 	logging_agg_strict(v::text || CASE WHEN random() < 0 then '?' ELSE '' END)
-- 		over wnd as noinverse
-- FROM (VALUES
-- 	(1, 'a'),
-- 	(2, 'b'),
-- 	(3, 'c')
-- ) AS t(i, v)
-- WINDOW wnd AS (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
-- ORDER BY i;

-- Spark doesn't handle UDFs in SQL
-- SELECT
-- 	i::text || ':' || COALESCE(v::text, 'NULL') as row,
-- 	logging_agg_strict(v::text) filter(where true)
-- 		over wnd as inverse,
-- 	logging_agg_strict(v::text) filter(where random() >= 0)
-- 		over wnd as noinverse
-- FROM (VALUES
-- 	(1, 'a'),
-- 	(2, 'b'),
-- 	(3, 'c')
-- ) AS t(i, v)
-- WINDOW wnd AS (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
-- ORDER BY i;

-- Spark doesn't handle UDFs in SQL
-- test that non-overlapping windows don't use inverse transitions
-- SELECT
-- 	logging_agg_strict(v::text) OVER wnd
-- FROM (VALUES
-- 	(1, 'a'),
-- 	(2, 'b'),
-- 	(3, 'c')
-- ) AS t(i, v)
-- WINDOW wnd AS (ORDER BY i ROWS BETWEEN CURRENT ROW AND CURRENT ROW)
-- ORDER BY i;

-- Spark doesn't handle UDFs in SQL
-- test that returning NULL from the inverse transition functions
-- restarts the aggregation from scratch. The second aggregate is supposed
-- to test cases where only some aggregates restart, the third one checks
-- that one aggregate restarting doesn't cause others to restart.

-- Spark doesn't handle UDFs in SQL
-- CREATE FUNCTION sum_int_randrestart_minvfunc(int4, int4) RETURNS int4 AS
-- $$ SELECT CASE WHEN random() < 0.2 THEN NULL ELSE $1 - $2 END $$
-- LANGUAGE SQL STRICT;

-- Spark doesn't handle UDFs in SQL
-- CREATE AGGREGATE sum_int_randomrestart (int4)
-- (
-- 	stype = int4,
-- 	sfunc = int4pl,
-- 	mstype = int4,
-- 	msfunc = int4pl,
-- 	minvfunc = sum_int_randrestart_minvfunc
-- );

-- Spark doesn't handle UDFs in SQL
-- WITH
-- vs AS (
-- 	SELECT i, (random() * 100)::int4 AS v
-- 	FROM generate_series(1, 100) AS i
-- ),
-- sum_following AS (
-- 	SELECT i, SUM(v) OVER
-- 		(ORDER BY i DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS s
-- 	FROM vs
-- )
-- SELECT DISTINCT
-- 	sum_following.s = sum_int_randomrestart(v) OVER fwd AS eq1,
-- 	-sum_following.s = sum_int_randomrestart(-v) OVER fwd AS eq2,
-- 	100*3+(vs.i-1)*3 = length(logging_agg_nonstrict(''::text) OVER fwd) AS eq3
-- FROM vs
-- JOIN sum_following ON sum_following.i = vs.i
-- WINDOW fwd AS (
-- 	ORDER BY vs.i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
-- );

--
-- Test various built-in aggregates that have moving-aggregate support
--

-- test inverse transition functions handle NULLs properly
SELECT i,AVG(v) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(1,1),(2,2),(3,NULL),(4,NULL)) t(i,v);

-- [SPARK-28602] Spark does not recognize 'interval' type as 'numeric'
-- SELECT i,AVG(v::interval) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
--   FROM (VALUES(1,'1 sec'),(2,'2 sec'),(3,NULL),(4,NULL)) t(i,v);

SELECT i,SUM(v) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(1,1),(2,2),(3,NULL),(4,NULL)) t(i,v);

SELECT SUM(n) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(1,1.01),(2,2),(3,3)) v(i,n);

SELECT VAR_POP(n) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(1,600),(2,470),(3,170),(4,430),(5,300)) r(i,n);

SELECT STDDEV_POP(n) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(1,NULL),(2,600),(3,470),(4,170),(5,430),(6,300)) r(i,n);

SELECT STDDEV(n) OVER (ORDER BY i ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
  FROM (VALUES(0,NULL),(1,600),(2,470),(3,170),(4,430),(5,300)) r(i,n);

SELECT i,SUM(v) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING)
  FROM (VALUES(1,1),(2,2),(3,3),(4,4)) t(i,v);

-- Multiple uses are evaluated only once
-- [SPARK-28299] Evaluation of multiple CTE uses
-- [ORIGINAL SQL]
--SELECT count(*) FROM (
--  WITH q1(x) AS (SELECT random() FROM generate_series(1, 5))
--    SELECT * FROM q1
--  UNION
--    SELECT * FROM q1
--) ss;
SELECT count(*) FROM (
  WITH q1(x) AS (SELECT rand() FROM (SELECT EXPLODE(SEQUENCE(1, 5))))
    SELECT * FROM q1
  UNION
    SELECT * FROM q1
) ss;

-- recursive view
-- [SPARK-28453] Support recursive view syntax
-- [ORIGINAL SQL]
--CREATE RECURSIVE VIEW nums (n) AS
--    VALUES (1)
--UNION ALL
--    SELECT n+1 FROM nums WHERE n < 5;
CREATE TEMPORARY VIEW nums AS
WITH RECURSIVE nums (n) AS (
    VALUES (1)
UNION ALL
    SELECT n+1 FROM nums WHERE n < 5
)
SELECT * FROM nums;

-- This is an infinite loop with UNION ALL, but not with UNION
WITH RECURSIVE t(n) AS (
    SELECT 1
UNION
    SELECT 10-n FROM t)
SELECT * FROM t;

-- Test behavior with an unknown-type literal in the WITH
-- [SPARK-28146] Support IS OF type predicate
-- [ORIGINAL SQL]
--WITH q AS (SELECT 'foo' AS x)
--SELECT x, x IS OF (text) AS is_text FROM q;
WITH q AS (SELECT 'foo' AS x)
SELECT x FROM q;

--
-- Some examples with a tree
--
-- department structure represented here is as follows:
--
-- ROOT-+->A-+->B-+->C
--      |         |
--      |         +->D-+->F
--      +->E-+->G


-- [ORIGINAL SQL]
--CREATE TEMP TABLE department (
--	id INTEGER PRIMARY KEY,  -- department ID
--	parent_department INTEGER REFERENCES department, -- upper department ID
--	name string -- department name
--);
CREATE TABLE department (
	id INTEGER,  -- department ID
	parent_department INTEGER, -- upper department ID
	name string -- department name
) USING parquet;

INSERT INTO department VALUES (2, 1, 'B');

INSERT INTO department VALUES (5, 0, 'E');

-- extract all departments under 'A'. Result should be A, B, C, D and F
WITH RECURSIVE subdepartment AS
(
	-- non recursive term
	SELECT name as root_name, * FROM department WHERE name = 'A'

	UNION ALL

	-- recursive term
	SELECT sd.root_name, d.* FROM department AS d, subdepartment AS sd
		WHERE d.parent_department = sd.id
)
SELECT * FROM subdepartment ORDER BY name;

-- "RECURSIVE" is ignored if the query has no self-reference
WITH RECURSIVE subdepartment AS
(
	-- note lack of recursive UNION structure
	SELECT * FROM department WHERE name = 'A'
)
SELECT * FROM subdepartment ORDER BY name;

SET spark.sql.cteRecursionLevelLimit=100;

SELECT * FROM vsubdepartment ORDER BY name;

-- corner case in which sub-WITH gets initialized first
-- [NOTE] Spark SQL doesn't support recursive reference in an inner CTE
--with recursive q as (
--      select * from department
--    union all
--      (with x as (select * from q)
--       select * from x)
--    )
--select * from q limit 24;

-- [NOTE] Spark SQL doesn't support recursive reference in an inner CTE
--with recursive q as (
--      select * from department
--    union all
--      (with recursive x as (
--           select * from department
--         union all
--           (select * from q union all select * from x)
--        )
--       select * from x)
--    )
--select * from q limit 32;

-- recursive term has sub-UNION
WITH RECURSIVE t(i,j) AS (
	VALUES (1,2)
	UNION ALL
	SELECT t2.i, t.j+1 FROM
		(SELECT 2 AS i UNION ALL SELECT 3 AS i) AS t2
		JOIN t ON (t2.i = t.i+1))

	SELECT * FROM t;

--
-- get all paths from "second level" nodes to leaf nodes
--
-- [ORIGINAL SQL]
--WITH RECURSIVE t(id, path) AS (
--    VALUES(1,ARRAY[]::integer[])
--UNION ALL
--    SELECT tree.id, t.path || tree.id
--    FROM tree JOIN t ON (tree.parent_id = t.id)
--)
--SELECT t1.*, t2.* FROM t AS t1 JOIN t AS t2 ON
--	(t1.path[1] = t2.path[1] AND
--	array_upper(t1.path,1) = 1 AND
--	array_upper(t2.path,1) > 1)
--	ORDER BY t1.id, t2.id;
WITH RECURSIVE t(id, path) AS (
    VALUES(1,cast(array() as array<Int>))
UNION ALL
    SELECT tree.id, t.path || array(tree.id)
    FROM tree JOIN t ON (tree.parent_id = t.id)
)
SELECT t1.*, t2.* FROM t AS t1 JOIN t AS t2 ON
	(t1.path[0] = t2.path[0] AND
	size(t1.path) = 1 AND
	size(t2.path) > 1)
	ORDER BY t1.id, t2.id;

--
-- test cycle detection
--
-- [ORIGINAL SQL]
--create temp table graph( f int, t int, label text );
create table graph( f int, t int, label string ) USING parquet;

-- ordering by the path column has same effect as SEARCH DEPTH FIRST
-- [ORIGINAL SQL]
--with recursive search_graph(f, t, label, path, cycle) as (
--	select *, array[row(g.f, g.t)], false from graph g
--	union all
--	select g.*, path || row(g.f, g.t), row(g.f, g.t) = any(path)
--	from graph g, search_graph sg
--	where g.f = sg.t and not cycle
--)
--select * from search_graph order by path;
with recursive search_graph(f, t, label, path, cycle) as (
	select *, array(struct(g.f, g.t)), false from graph g
	union all
	select g.*, path || array(struct(g.f, g.t)), array_contains(path, struct(g.f, g.t))
	from graph g, search_graph sg
	where g.f = sg.t and not cycle
)
select * from search_graph order by path;

WITH RECURSIVE
   x(id) AS
     (SELECT 1 UNION ALL SELECT id+1 FROM x WHERE id < 3 ),
   y(id) AS
     (SELECT * FROM x UNION ALL SELECT * FROM x),
   z(id) AS
     (SELECT * FROM y UNION ALL SELECT id+1 FROM z WHERE id < 10)
 SELECT * FROM z;

-- [SPARK-28147] Support RETURNING clause
--WITH t AS (
--	SELECT a FROM y
--)
--INSERT INTO y
--SELECT a+20 FROM t RETURNING *;
--
--SELECT * FROM y;

-- [NOTE] Spark SQL doesn't support UPDATE statement
--WITH t AS (
--	SELECT a FROM y
--)
--UPDATE y SET a = y.a-10 FROM t WHERE y.a > 20 AND t.a = y.a RETURNING y.a;
--
--SELECT * FROM y;

-- [NOTE] Spark SQL doesn't support DELETE statement
--WITH RECURSIVE t(a) AS (
--	SELECT 11
--	UNION ALL
--	SELECT a+1 FROM t WHERE a < 50
--)
--DELETE FROM y USING t WHERE t.a = y.a RETURNING y.a;
--
--SELECT * FROM y;

DROP TABLE y;

-- EXCEPT
WITH RECURSIVE x(n) AS (SELECT 1 EXCEPT SELECT n+1 FROM x)
	SELECT * FROM x;

-- recursive term in the left hand side (strictly speaking, should allow this)
WITH RECURSIVE x(n) AS (SELECT n FROM x UNION ALL SELECT 1)
	SELECT * FROM x;

-- RIGHT JOIN
WITH RECURSIVE x(n) AS (SELECT a FROM y WHERE a = 1
	UNION ALL
	SELECT x.n+1 FROM x RIGHT JOIN y ON x.n = y.a WHERE n < 10)
SELECT * FROM x;

-- aggregate functions
-- we need to cast 1 as bigint, as otherwise it will throw an error that the data types
-- are different
WITH RECURSIVE x(n) AS (SELECT cast(1 as bigint) UNION ALL SELECT count(*) FROM x)
  SELECT * FROM x;

-- LIMIT/OFFSET
WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x LIMIT 10 OFFSET 1)
  SELECT * FROM x;

-- non-linear recursion is not allowed
WITH RECURSIVE foo(i) AS
    (values (1)
    UNION ALL
       (SELECT i+1 FROM foo WHERE i < 10
          UNION ALL
       SELECT i+1 FROM foo WHERE i < 5)
) SELECT * FROM foo;

WITH RECURSIVE foo(i) AS
    (values (1)
    UNION ALL
       (SELECT i+1 FROM foo WHERE i < 10
          INTERSECT
       SELECT i+1 FROM foo WHERE i < 5)
) SELECT * FROM foo;

-- test CTE referencing an outer-level variable (to see that changed-parameter
-- signaling still works properly after fixing this bug)
-- [SPARK-28296] Improved VALUES support
-- [SPARK-28297] Handling outer links in CTE subquery expressions
--select ( with cte(foo) as ( values(f1) )
--         select (select foo from cte) )
--from int4_tbl;

-- [SPARK-28296] Improved VALUES support
-- [SPARK-28297] Handling outer links in CTE subquery expressions
--select ( with cte(foo) as ( values(f1) )
--          values((select foo from cte)) )
--from int4_tbl;

--
-- test for nested-recursive-WITH bug
--
WITH RECURSIVE t(j) AS (
    WITH RECURSIVE s(i) AS (
        VALUES (1)
        UNION ALL
        SELECT i+1 FROM s WHERE i < 10
    )
    SELECT i FROM s
    UNION ALL
    SELECT j+1 FROM t WHERE j < 10
)
SELECT * FROM t;

WITH RECURSIVE outermost(x) AS (
  SELECT 1
  UNION (WITH innermost as (SELECT 2)
         SELECT * FROM outermost
         UNION SELECT * FROM innermost)
)
SELECT * FROM outermost ORDER BY 1;

-- [NOTE] Spark SQL doesn't support UNIQUE constraints
--ALTER TABLE withz ADD UNIQUE (k);

-- [NOTE] Spark SQL doesn't support UPDATE statement
--WITH t AS (
--    INSERT INTO withz SELECT i, 'insert'
--    FROM generate_series(0, 16) i
--    ON CONFLICT (k) DO UPDATE SET v = withz.v || ', now update'
--    RETURNING *
--)
--SELECT * FROM t JOIN y ON t.k = y.a ORDER BY a, k;

-- Test EXCLUDED.* reference within CTE
-- [NOTE] Spark SQL doesn't support ON CONFLICT clause
--WITH aa AS (
--    INSERT INTO withz VALUES(1, 5) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v
--    WHERE withz.k != EXCLUDED.k
--    RETURNING *
--)
--SELECT * FROM aa;

-- New query/snapshot demonstrates side-effects of previous query.
SELECT * FROM withz ORDER BY k;

-- [ORIGINAL SQL]
--INSERT INTO y SELECT generate_series(1, 3);
INSERT INTO y SELECT EXPLODE(SEQUENCE(1, 3));

SELECT * FROM yy;

-- [NOTE] Spark SQL doesn't support INHERITS clause
--CREATE TEMP TABLE child1 ( ) INHERITS ( parent );
-- [NOTE] Spark SQL doesn't support INHERITS clause
--CREATE TEMP TABLE child2 ( ) INHERITS ( parent );

INSERT INTO parent VALUES ( 1, 'p1' );

-- [NOTE] Spark SQL doesn't support DELETE statement
--WITH wcte AS ( INSERT INTO child2 VALUES ( 42, 'new2' ) RETURNING id AS newid )
--DELETE FROM parent USING wcte WHERE id = newid;
--
--SELECT * FROM parent;

-- check EXPLAIN VERBOSE for a wCTE with RETURNING

-- [NOTE] Spark SQL doesn't support DELETE statement
--EXPLAIN (VERBOSE, COSTS OFF)
--WITH wcte AS ( INSERT INTO int8_tbl VALUES ( 42, 47 ) RETURNING q2 )
--DELETE FROM a USING wcte WHERE aa = q2;

-- error cases

-- data-modifying WITH tries to use its own output
-- [NOTE] Spark SQL doesn't support INSERT in WITH
--WITH RECURSIVE t AS (
--	INSERT INTO y
--		SELECT * FROM t
--)
--VALUES(FALSE);

-- no RETURNING in a referenced data-modifying WITH
-- [NOTE] Spark SQL doesn't support INSERT in WITH
--WITH t AS (
--	INSERT INTO y VALUES(0)
--)
--SELECT * FROM t;

-- data-modifying WITH allowed only at the top level
-- [SPARK-28147] Support RETURNING clause
--SELECT * FROM (
--	WITH t AS (UPDATE y SET a=a+1 RETURNING *)
--	SELECT * FROM t
--) ss;

-- most variants of rules aren't allowed
-- [NOTE] Spark SQL doesn't support RULEs
--CREATE RULE y_rule AS ON INSERT TO y WHERE a=0 DO INSTEAD DELETE FROM y;
--WITH t AS (
--	INSERT INTO y VALUES(0)
--)
--VALUES(FALSE);
--DROP RULE y_rule ON y;

-- check that parser lookahead for WITH doesn't cause any odd behavior
create table foo (with baz);

-- check sane response to attempt to modify CTE relation
WITH test AS (SELECT 42) INSERT INTO test VALUES (1);

select * from test;

DROP VIEW vsubdepartment;

DROP TABLE tree;

DROP TABLE yy;

CREATE OR REPLACE TEMPORARY VIEW tbl_b AS VALUES 1 AS T(c1);

-- NOT
select not true;

-- AND
select true and true;

select false and false;

select null::boolean and true;

-- OR
select true or true;

select false or false;

select null::boolean or true;

-- EqualTo
select 1 = 1;

select 1.5 = '1.51';

select 2 > '2.0';

select to_date('2009-07-30 04:17:52') > to_date('2009-07-30 04:17:52');

select 2 >= '1.0';

select '1.5' >= 0.5;

-- LessThan
select 1 < '1';

select 2.0 < '2.2';

select to_date('2009-07-30 04:17:52') < '2009-07-30 04:17:52';

select 2 <= '2.0';

select to_date('2009-07-30 04:17:52') <= to_date('2009-07-30 04:17:52');

select to_timestamp('2017-03-01 00:00:01') > to_date('2017-03-01');

select to_date('2017-03-01') <= to_timestamp('2017-03-01 00:00:01');

select 1 in (1.0, 2.0, 3.0);

select 1 in ('2', '3', '4', null);

-- Not(In)
select 1 not in (1, 2, 3);

select 1 not in (1.0, 2.0, 3.0, null);

select null not in (1, 2, 3);

select 1 not in ();

select 2.0 between '1.0' and '3.0';

select rand(123) between 0.1 AND 0.2;

select 2.0 not between '1.0' and '3.0';

select rand(123) not between 0.1 AND 0.2;

select 1 ! in (3, 4);

select false is ! true;

SELECT city, car_model, RANK() OVER (PARTITION BY car_model ORDER BY quantity) AS rank
FROM dealer
QUALIFY rank = 1
ORDER BY car_model, city;

SELECT a, SUM(b) AS total
FROM testData2
GROUP BY a
HAVING SUM(b) > 2
QUALIFY ROW_NUMBER() OVER (ORDER BY a DESC) = 1;

SELECT a
FROM testData2
QUALIFY a = 1;

CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
(1, "1", "11"), (2, "2", "22"), (3, "3", "33"), (4, "4", "44"), (5, "5", "55"), (6, "6", "66")
AS testData(key, value1, value2);

SELECT t.`(a)?+.+` FROM testData2 t WHERE a = 1;

SELECT SUM(`(a|b)?+.+`) FROM testData2;

-- Regex columns
SELECT `(a)?+.+` FROM testData2 WHERE a = 1;

SELECT t.`(e|f)` FROM testData2 t;

CREATE OR REPLACE TEMPORARY VIEW testdata3 AS SELECT * FROM VALUES
(0, 1), (1, 2), (2, 3), (3, 4)
AS testdata3(a, b);

SELECT `(A)?+.+` FROM testdata3 WHERE a > 1;

SELECT SUM(`(a)`) FROM testdata3;

-- AnalysisException
SELECT SUM(a) FROM testdata3 GROUP BY `(a)`;

SELECT rand(cast(3 / 7 AS int));

-- rand unsupported data type
SELECT rand(1.0);

SELECT randn(NULL);

-- The uniform random number generation function supports generating random numbers within a
-- specified range. We use a seed of zero for these queries to keep tests deterministic.
SELECT uniform(0, 1, 0) AS result;

SELECT uniform(0, 10L, 0) AS result;

SELECT uniform(0, 10S, 0) AS result;

SELECT uniform(cast(10 as decimal(10, 3)), cast(20 as decimal(10, 3)), 0) AS result;

SELECT uniform(cast(10 as decimal(10, 3)), 20, 0) AS result;

SELECT uniform(10, 20, 0) AS result FROM VALUES (0), (1), (2) tab(col);

SELECT uniform(-20L, -10L, 0) AS result;

SELECT uniform(cast(NULL AS int), 1, 0) AS result;

SELECT uniform(0, cast(NULL AS int), 0) AS result;

SELECT uniform(NULL, NULL, 0) AS result;

SELECT uniform(0, 1, cast(NULL as float)) AS result;

SELECT uniform(10) AS result;

SELECT uniform(10.0F, 20.0F, 0.0D) AS result;

SELECT uniform(0, 'def', 0) AS result;

SELECT randstr(5, 0) AS result;

SELECT randstr(CAST(10 AS TINYINT), 0) AS result;

SELECT randstr(1.0D, 0) AS result;

SELECT randstr(10) IS NOT NULL AS result;

SELECT randstr(10.0F, 0) AS result;

SELECT randstr(0, NULL) AS result;

SELECT randstr(10, 0, 1) AS result;

SELECT randstr(10, 1.5) AS result FROM VALUES (0) tab(a);

SELECT regexp_extract('1a 2b 14m', '\\d+', 1);

SELECT regexp_extract('1a 2b 14m', '(\\d+)?', 1);

SELECT regexp_extract('1a 2b 14m', '(\\d+)([a-z]+)', 0);

SELECT regexp_extract('1a 2b 14m', '(\\d+)([a-z]+)', 3);

SELECT regexp_extract('a b m', '(\\d+)?([a-z]+)', 1);

SELECT regexp_extract_all('1a 2b 14m', '\\d+', 0);

SELECT regexp_extract_all('1a 2b 14m', '\\d+', -1);

SELECT regexp_extract_all('1a 2b 14m', '(\\d+)([a-z]+)');

SELECT regexp_extract_all('1a 2b 14m', '(\\d+)([a-z]+)', 2);

SELECT regexp_extract_all('1a 2b 14m', '(\\d+)?([a-z]+)', 1);

-- regexp_replace
SELECT regexp_replace('healthy, wealthy, and wise', '\\w+thy', 'something');

SELECT regexp_replace('healthy, wealthy, and wise', '\\w+thy', 'something', 1);

SELECT regexp_replace('healthy, wealthy, and wise', '\\w', 'something', 26);

SELECT regexp_replace('healthy, wealthy, and wise', '\\w', 'something', null);

SELECT regexp('1a 2b 14m', '\\d+b');

SELECT rlike('1a 2b 14m', '[a-z]+b');

SELECT regexp_count('the fox', 'FOX');

SELECT regexp_count(null, 'abc');

SELECT regexp_substr('1a 2b 14m', '\\d+ ');

SELECT regexp_substr('1a 2b 14m', '');

-- regexp_instr
SELECT regexp_instr('abc', 'b');

SELECT regexp_instr('1a 2b 14m', '\\d{2}(a|b|m)');

SELECT regexp_instr('abc', col0, 1) FROM VALUES(') ?') AS t(col0);

SELECT col1 + 1 AS a, a AS b FROM VALUES(1) GROUP BY a ORDER BY col1 + 1;

SELECT col1, col2, GROUPING(col1) FROM VALUES("abc", 1) GROUP BY CUBE(col1, col2) ORDER BY GROUPING(col1);

SELECT make_date(col1, col2, col3) AS a FROM VALUES(1,2,3) GROUP BY make_date(col1, col2, col3) HAVING make_date(col1, col2, col3) > '2025-01-01';

-- Don't replace expression with alias that has semantically equal child if expression is in output
SELECT col1, col1 AS a FROM VALUES(1) GROUP BY col1 ORDER BY col1 ASC;

SELECT col2 AS b, col2 FROM VALUES(1,2) GROUP BY 1,2 HAVING col2 > 0 ORDER BY ALL;

-- We run the following tests in fixed-point and single-pass modes separately because there is a difference
-- in results. Difference is order in inner Project nodes which is usually normalized when we compare results between
-- those two modes but in golden files we have to run them one after another.

-- Fixed point doesn't know to correctly replace `col1` with `a` because HAVING adds an artificial Project node

-- Fixed-point mode
SET spark.sql.analyzer.singlePassResolver.dualRunWithLegacy=false;

SELECT col1 AS a, a AS b FROM VALUES(1,2) GROUP BY col1, col2 HAVING col2 > 1 ORDER BY col1;

-- Check that replacement in RuntimeReplaceable is resolved
SELECT xpath_string('abc', date_format('X', 'unknown'));

-- Table: orders
CREATE TABLE orders (
    order_id INT,
    customer_id INT,
    order_date TIMESTAMP,
    order_status STRING,
    order_total DOUBLE,
    order_tax DOUBLE,
    order_discount DOUBLE,
    order_shipping DOUBLE,
    order_shipping_address_1 STRING,
    order_shipping_address_2 STRING,
    order_shipping_city STRING,
    order_shipping_state STRING,
    order_shipping_zip STRING,
    order_shipping_country STRING,
    order_billing_identifier STRING,
    order_payment_method STRING,
    order_payment_status STRING,
    order_payment_date TIMESTAMP,
    order_cancelation_date TIMESTAMP,
    order_return_request_date TIMESTAMP,
    order_completion_date TIMESTAMP,
    order_source STRING,
    order_device STRING,
    order_channel STRING
);

-- Table: suppliers
CREATE TABLE suppliers (
    supplier_id INT,
    supplier_name STRING,
    supplier_contact STRING,
    supplier_contact_role STRING,
    supplier_contact_email STRING,
    supplier_contact_phone_1 STRING,
    supplier_contact_phone_2 STRING,
    supplier_address_1 STRING,
    supplier_address_2 STRING,
    supplier_address_3 STRING,
    supplier_city STRING,
    supplier_state STRING,
    supplier_zip STRING,
    supplier_country STRING,
    supplier_region STRING,
    supplier_main_products STRING,
    supplier_website STRING,
    supplier_pricing_agreement_date TIMESTAMP,
    supplier_last_order_date TIMESTAMP,
    supplier_last_contact_date TIMESTAMP,
    supplier_rating DOUBLE,
    supplier_active BOOLEAN
);

INSERT INTO products VALUES (3, 'Classic Toy', 'Toys', 19.95, 12.00, 3, 'Toy Supply', 'Ann T.', '789 Oak St', 50, 'Multicolor', 'Medium', 0.8, 'Classic wooden toy', 4.7, 80, TIMESTAMP '2021-11-01', TIMESTAMP '2023-01-10', true, 0.05, 0.15);

INSERT INTO customers VALUES (3, 'Cathy Lee', 'cathy@example.com', '555-1003', '303 Pine Ln', NULL, 'Pineville', 'TX', '54321', 'USA', 'Retail', TIMESTAMP '2022-07-01', 400.75, 1003, TIMESTAMP '2023-03-05', TIMESTAMP '2023-03-06', true, true, 0.0, 'US563456', 'Cathy Lee');

INSERT INTO orders VALUES (1003, 3, TIMESTAMP '2023-03-05', 'Processing', 19.95, 3.99, 1.0, 5.99, '303 Pine Ln', NULL, 'Pineville', 'TX', '54321', 'USA', 'ORD1003', 'PayPal', 'Pending', NULL, NULL, NULL, NULL, 'App', 'Android', 'Mobile App');

INSERT INTO order_items VALUES (103, 1003, 3, 1, 19.95, 1.0, 3.99, 22.94, 'Processing', 'FALL2023', NULL, NULL, NULL);

INSERT INTO employees VALUES (3, 'Frank Wong', 'frank@example.com', '555-2003', 'Warehouse', 'Operations', TIMESTAMP '2020-06-15', NULL, 40000.0, 0.0, 2, '606 Walnut Ln', NULL, 'Walnut', 'CA', '00345', 'USA', TIMESTAMP '1988-02-14', 'Male', 'Married', 1);

INSERT INTO suppliers VALUES (3, 'Toy Supply', 'Ann T.', 'Director', 'ann@toysupply.com', '555-5001', NULL, '789 Oak St', NULL, NULL, 'Pineville', 'TX', '54321', 'USA', 'South', 'Toys, Games', 'https://toysupply.com', TIMESTAMP '2019-03-01', NULL, TIMESTAMP '2023-03-01', 4.4, true);

BEGIN
    DECLARE v_total_orders INT;
    DECLARE v_customer_id INT;
    DECLARE v_order_id INT;
    DECLARE v_last_order_date TIMESTAMP;
    DECLARE v_product_count INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Orders processing error'); END;
    -- Wide and deep, with mixed control structures
    customer_block: BEGIN
        DECLARE v_customer_threshold INT DEFAULT 2;
        FOR cust AS SELECT customer_id, customer_name FROM customers LIMIT 5 DO
            SET v_customer_id = cust.customer_id;
            SET v_total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = cust.customer_id);
            SET v_last_order_date = (SELECT MAX(order_date) FROM orders WHERE customer_id = cust.customer_id);
            IF v_total_orders < v_customer_threshold THEN
                SET v_order_id = (SELECT COALESCE(MAX(order_id), 0) + 1 FROM orders);
                INSERT INTO orders (order_id, customer_id, order_date, order_status, order_total, order_tax, order_discount, order_shipping)
                VALUES (v_order_id, v_customer_id, CURRENT_TIMESTAMP, 'New', 10.0, 1.0, 0.0, 2.0);
                L1: BEGIN
                    DECLARE v_item_id INT;
                    SET v_product_count = (SELECT COUNT(*) FROM products);
                    IF v_product_count > 0 THEN
                        FOR prod AS SELECT product_id FROM products LIMIT 3 DO
                            SET v_item_id = (SELECT COALESCE(MAX(order_item_id), 0) + 1 FROM order_items);
                            INSERT INTO order_items (order_item_id, order_id, product_id, item_quantity, item_price_per_unit, item_discount, item_tax, item_total)
                            VALUES (v_item_id, v_order_id, prod.product_id, 1, (SELECT product_price FROM products WHERE product_id = prod.product_id), 0.0, 0.0, (SELECT product_price FROM products WHERE product_id = prod.product_id));
                        END FOR;
                    END IF;
                END L1;
            ELSE
                L2: BEGIN
                    DECLARE v_days_since_last_order INT;
                    SET v_days_since_last_order = DATEDIFF(DAY, v_last_order_date, CURRENT_TIMESTAMP);
                    IF v_days_since_last_order > 30 THEN
                        L3: BEGIN
                            DECLARE v_random_product_id INT;
                            SET v_random_product_id = (SELECT product_id FROM products LIMIT 1);
                            INSERT INTO order_items (order_item_id, order_id, product_id, item_quantity, item_price_per_unit, item_discount, item_tax, item_total)
                            VALUES ((SELECT COALESCE(MAX(order_item_id), 0) + 1 FROM order_items), (SELECT MIN(order_id) FROM orders WHERE customer_id = v_customer_id), v_random_product_id, 1, (SELECT product_price FROM products WHERE product_id = v_random_product_id), 0.0, 0.0, (SELECT product_price FROM products WHERE product_id = v_random_product_id));
                        END L3;
                        SET v_last_order_date = CURRENT_TIMESTAMP;
                    ELSE
                        BEGIN
                            DECLARE v_orders_to_delete INT;
                            SET v_orders_to_delete = (SELECT COUNT(*) FROM orders WHERE order_status = 'Processing' AND customer_id = v_customer_id);
                            WHILE v_orders_to_delete > 1 DO
                                DELETE FROM orders WHERE order_id IN (SELECT order_id FROM orders WHERE order_status = 'Processing' AND customer_id = v_customer_id LIMIT 1);
                                SET v_orders_to_delete = v_orders_to_delete - 1;
                            END WHILE;
                        END;
                    END IF;
                END L2;
            END IF;
        END FOR;
    END customer_block;
    BEGIN
        DECLARE v_max_order_total DOUBLE;
        SET v_max_order_total = (SELECT MAX(order_total) FROM orders);
        IF v_max_order_total > 200 THEN
            L4: BEGIN
                DECLARE v_large_orders INT;
                SET v_large_orders = (SELECT COUNT(*) FROM orders WHERE order_total > 200);
                IF v_large_orders > 1 THEN
                    REPEAT
                        UPDATE orders SET order_shipping = order_shipping * 0.9 WHERE order_status = 'Completed' AND order_total > 200;
                        SET v_large_orders = (SELECT COUNT(*) FROM orders WHERE order_total > 200);
                    UNTIL v_large_orders < 2 END REPEAT;
                END IF;
            END L4;
        END IF;
    END;
END;

BEGIN
    DECLARE v_hq_state STRING DEFAULT 'CA';
    DECLARE v_regional_office_count INT DEFAULT 0;
    DECLARE v_wrong_city_found BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Office location error'); END;

    -- Wide, deep, random logic with labels
    main_office: BEGIN
        DECLARE v_total_offices INT;
        SET v_total_offices = (SELECT COUNT(DISTINCT customer_city) FROM customers);
        FOR city AS SELECT DISTINCT customer_city FROM customers LIMIT 2 DO
            SET v_wrong_city_found = true;
            IF city.customer_city LIKE '%ville' THEN
                SET v_wrong_city_found = false;
                L1: BEGIN
                    DECLARE v_region_check BOOLEAN DEFAULT true;
                    FOR supplier_region AS SELECT supplier_region FROM suppliers WHERE supplier_region LIKE '%est%' LIMIT 1 DO
                        IF supplier_region IS NULL THEN
                            SET v_region_check = false;
                        END IF;
                    END FOR;
                    IF NOT v_region_check THEN
                        INSERT INTO suppliers (
                            supplier_id, supplier_name, supplier_contact, supplier_contact_role,
                            supplier_contact_email, supplier_contact_phone_1, supplier_address_1,
                            supplier_city, supplier_state, supplier_zip, supplier_country, supplier_region
                        ) VALUES (
                            (SELECT MAX(supplier_id) + 1 FROM suppliers),
                            'Regional Supplier',
                            'Regional Contact',
                            'Regional Manager',
                            'region@supplier.com',
                            '555-1212',
                            '123 Regional St',
                            city.customer_city,
                            'CA',
                            '00001',
                            'USA',
                            'West'
                        );
                    END IF;
                END L1;
                SET v_regional_office_count = v_regional_office_count + 1;
            END IF;
        END FOR;
    END main_office;
    BEGIN
        DECLARE v_hq_exists BOOLEAN;
        SET v_hq_exists = (SELECT COUNT(*) FROM suppliers WHERE supplier_state = v_hq_state);
        IF NOT v_hq_exists OR v_wrong_city_found THEN
            L2: BEGIN
                DECLARE v_emp_in_city INT;
                SET v_emp_in_city = (SELECT COUNT(*) FROM employees WHERE employee_state = v_hq_state AND employee_city LIKE '%town%');
                IF v_emp_in_city > 0 THEN
                    REPEAT
                        INSERT INTO suppliers (
                            supplier_id, supplier_name, supplier_contact, supplier_contact_role,
                            supplier_contact_email, supplier_contact_phone_1, supplier_address_1,
                            supplier_city, supplier_state, supplier_zip, supplier_country, supplier_region, supplier_active
                        ) VALUES (
                            (SELECT MAX(supplier_id) + 1 FROM suppliers),
                            'Main Office Supplier',
                            'HQ Contact',
                            'HQ Manager',
                            'hq@supplier.com',
                            '555-1111',
                            '123 Main St',
                            (SELECT employee_city FROM employees WHERE employee_state = v_hq_state LIMIT 1),
                            v_hq_state,
                            '00000',
                            'USA',
                            'HQ',
                            true
                        );
                        SET v_hq_exists = (SELECT COUNT(*) FROM suppliers WHERE supplier_state = v_hq_state);
                    UNTIL v_hq_exists = 0 OR v_hq_exists > 2 END REPEAT;
                END IF;
            END L2;
        END IF;
    END;
END;

BEGIN
    DECLARE v_employee_id INT;
    DECLARE v_employee_commission DOUBLE;
    DECLARE v_employee_total DOUBLE DEFAULT 0.0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Commission calculation error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_total_emp INT;
        SET v_total_emp = (SELECT COUNT(*) FROM employees);
        FOR emp AS SELECT employee_id, employee_commission FROM employees LIMIT 3 DO
            SET v_employee_id = emp.employee_id;
            SET v_employee_commission = emp.employee_commission;
            L1: BEGIN
                DECLARE v_order_count INT;
                SET v_order_count = (SELECT COUNT(*) FROM orders WHERE customer_id = (SELECT MIN(customer_id) FROM customers));
                IF v_order_count > 0 THEN
                    L2: BEGIN
                        DECLARE v_commission_changed BOOLEAN DEFAULT false;
                        WHILE v_employee_commission > 0 AND v_employee_commission < 2000 DO
                            UPDATE employees SET employee_commission = employee_commission + 100.0 WHERE employee_id = v_employee_id;
                            SET v_employee_total = v_employee_total + 100.0;
                            SET v_employee_commission = (SELECT employee_commission FROM employees WHERE employee_id = v_employee_id);
                            SET v_commission_changed = true;
                        END WHILE;
                        IF v_commission_changed THEN
                            REPEAT
                                SET v_employee_total = v_employee_total - 50.0;
                                UPDATE employees SET employee_commission = employee_commission - 50.0 WHERE employee_id = v_employee_id;
                            UNTIL v_employee_total <= 1500 END REPEAT;
                        END IF;
                    END L2;
                END IF;
            END L1;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_shipping_cost DOUBLE DEFAULT 0.0;
    DECLARE v_shipping_city STRING;
    DECLARE v_shipping_orders INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Shipping analysis error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_max_orders INT DEFAULT 3;
        FOR city AS SELECT DISTINCT order_shipping_city FROM orders LIMIT 2 DO
            SET v_shipping_city = city.order_shipping_city;
            SET v_shipping_cost = (SELECT SUM(order_shipping) FROM orders WHERE order_shipping_city = v_shipping_city);
            IF v_shipping_cost > 5 THEN
                L1: BEGIN
                    REPEAT
                        SET v_shipping_cost = v_shipping_cost - 1.0;
                        UPDATE orders SET order_shipping = order_shipping - 0.5 WHERE order_shipping_city = v_shipping_city;
                    UNTIL v_shipping_cost < 5 END REPEAT;
                END L1;
                BEGIN
                    DECLARE v_customer_in_shipping_city INT;
                    SET v_customer_in_shipping_city = (SELECT COUNT(*) FROM customers c WHERE c.customer_city = v_shipping_city);
                    IF v_customer_in_shipping_city = 0 THEN
                        BEGIN
                            DECLARE v_new_customer_id INT;
                            SET v_new_customer_id = (SELECT MAX(customer_id) + 1 FROM customers);
                            INSERT INTO customers VALUES (
                                v_new_customer_id,
                                'Local Customer',
                                'local@' || v_shipping_city || '.com',
                                '555-0000',
                                '123 Main St',
                                v_shipping_city,
                                (SELECT DISTINCT order_shipping_state FROM orders WHERE order_shipping_city = v_shipping_city LIMIT 1),
                                '00000',
                                'USA',
                                'Retail',
                                CURRENT_TIMESTAMP, 0.0, NULL, NULL, NULL, true, true, 0.0, NULL, NULL
                            );
                        END;
                    END IF;
                END;
            ELSE
                L2: BEGIN
                    SET v_shipment_orders = (SELECT COUNT(*) FROM orders WHERE order_shipping_city = v_shipping_city);
                    WHILE v_shipping_orders < v_max_orders DO
                        BEGIN
                            DECLARE v_new_order_id INT;
                            SET v_new_order_id = (SELECT MAX(order_id) + 1 FROM orders);
                            INSERT INTO orders (
                                order_id, customer_id, order_date, order_status, order_total,
                                order_tax, order_discount, order_shipping, order_shipping_city,
                                order_shipping_state, order_shipping_zip, order_shipping_country
                            ) VALUES (
                                v_new_order_id,
                                (SELECT MIN(customer_id) FROM customers),
                                CURRENT_TIMESTAMP, 'Local Insert', 10.0, 1.0, 0.0, 2.0,
                                v_shipping_city, 'TX', '00000', 'USA'
                            );
                            SET v_shipping_orders = v_shipping_orders + 1;
                        END;
                    END WHILE;
                END L2;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_order_source STRING;
    DECLARE v_order_total DOUBLE;
    DECLARE v_order_date TIMESTAMP;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Order source analysis error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_order_source_count INT DEFAULT 0;
        FOR source AS SELECT DISTINCT order_source FROM orders LIMIT 2 DO
            SET v_order_source = source.order_source;
            SET v_order_total = (SELECT SUM(order_total) FROM orders WHERE order_source = source.order_source);
            IF v_order_source = 'Web' OR v_order_source = 'Mobile' THEN
                L1: BEGIN
                    REPEAT
                        SET v_order_source_count = v_order_source_count + 1;
                        SET v_order_date = (SELECT MAX(order_date) FROM orders WHERE order_source = source.order_source);
                        IF v_order_date < DATEADD(DAY, -30, CURRENT_TIMESTAMP) THEN
                            BEGIN
                                INSERT INTO orders (
                                    order_id, customer_id, order_date, order_status, order_total,
                                    order_tax, order_discount, order_shipping, order_source
                                ) VALUES (
                                    (SELECT MAX(order_id) + 1 FROM orders),
                                    (SELECT MIN(customer_id) FROM customers),
                                    CURRENT_TIMESTAMP,
                                    'Recent Web',
                                    50.0,
                                    5.0,
                                    0.0,
                                    5.0,
                                    source.order_source
                                );
                                SET v_order_date = CURRENT_TIMESTAMP;
                            END;
                        END IF;
                    UNTIL v_order_source_count > 1 OR v_order_date > DATEADD(DAY, -30, CURRENT_TIMESTAMP) END REPEAT;
                END L1;
            ELSE
                BEGIN
                    DECLARE v_fake_source STRING DEFAULT CONCAT('Fake ', source.order_source);
                    INSERT INTO orders (
                        order_id, customer_id, order_date, order_status, order_total,
                        order_tax, order_discount, order_shipping, order_source
                    ) VALUES (
                        (SELECT MAX(order_id) + 1 FROM orders),
                        (SELECT MIN(customer_id) FROM customers),
                        CURRENT_TIMESTAMP,
                        'Generated',
                        30.0,
                        3.0,
                        0.0,
                        3.0,
                        v_fake_source
                    );
                END;
            END IF;
        END FOR;
    END L0;
    BEGIN
        DECLARE v_source_total DOUBLE;
        SET v_source_total = (SELECT SUM(order_total) FROM orders WHERE order_source LIKE 'Fake%');
        IF v_source_total < 100 THEN
            REPEAT
                INSERT INTO orders (
                    order_id, customer_id, order_date, order_status, order_total,
                    order_tax, order_discount, order_shipping, order_source
                ) VALUES (
                    (SELECT MAX(order_id) + 1 FROM orders),
                    (SELECT MIN(customer_id) FROM customers),
                    CURRENT_TIMESTAMP,
                    'Fake Source',
                    15.0,
                    1.5,
                    0.0,
                    1.5,
                    'Fake Source'
                );
                SET v_source_total = (SELECT SUM(order_total) FROM orders WHERE order_source LIKE 'Fake%');
            UNTIL v_source_total >= 100 END REPEAT;
        END IF;
    END;
END;

BEGIN
    DECLARE v_employee_birth_year INT;
    DECLARE v_employee_age INT;
    DECLARE v_employee_city STRING;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Employee demographics error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_emp_count INT DEFAULT 0;
        FOR emp AS SELECT employee_id, employee_birth_date, employee_city FROM employees LIMIT 3 DO
            SET v_employee_birth_year = YEAR(emp.employee_birth_date);
            SET v_employee_age = DATEDIFF(YEAR, emp.employee_birth_date, CURRENT_TIMESTAMP);
            SET v_employee_city = emp.employee_city;
            IF v_employee_age < 30 THEN
                L1: BEGIN
                    DECLARE v_city_emp_count INT;
                    SET v_city_emp_count = (SELECT COUNT(*) FROM employees WHERE employee_city = v_employee_city);
                    IF v_city_emp_count < 2 THEN
                        REPEAT
                            SET v_emp_count = v_emp_count + 1;
                            INSERT INTO employees VALUES (
                                (SELECT MAX(employee_id) + 1 FROM employees),
                                'Young Emp ' || v_emp_count,
                                'emp' || v_emp_count || '@company.com',
                                '555-0000',
                                'Junior',
                                'Ops',
                                CURRENT_TIMESTAMP,
                                NULL,
                                35000.0,
                                0.0,
                                NULL,
                                '123 Jun St',
                                NULL,
                                v_employee_city,
                                (SELECT DISTINCT employee_state FROM employees WHERE employee_city = v_employee_city LIMIT 1),
                                '00000',
                                'USA',
                                DATEADD(YEAR, -(FLOOR(RAND() * 10) + 20), CURRENT_TIMESTAMP),
                                'Male',
                                'Single',
                                0
                            );
                        UNTIL v_emp_count > 1 END REPEAT;
                    END IF;
                END L1;
            ELSE
                BEGIN
                    DECLARE v_birth_month INT;
                    SET v_birth_month = MONTH(emp.employee_birth_date);
                    CASE v_birth_month
                        WHEN 1 THEN
                            UPDATE employees SET employee_commission = employee_commission + 100.0 WHERE employee_id = emp.employee_id;
                        WHEN 6 THEN
                            BEGIN
                                WHILE v_employee_age < 40 DO
                                    SET v_employee_age = v_employee_age + 1;
                                    INSERT INTO customers VALUES (
                                        (SELECT MAX(customer_id) + 1 FROM customers),
                                        'Age Group Customer',
                                        'age@group.com',
                                        '555-0001',
                                        '123 Age St',
                                        v_employee_city,
                                        (SELECT DISTINCT employee_state FROM employees WHERE employee_city = v_employee_city LIMIT 1),
                                        '00000',
                                        'USA',
                                        'Senior',
                                        CURRENT_TIMESTAMP,
                                        0.0,
                                        NULL,
                                        NULL,
                                        NULL,
                                        true,
                                        true,
                                        0.0,
                                        NULL,
                                        NULL
                                    );
                                END WHILE;
                            END;
                        ELSE
                            L2: BEGIN
                                DECLARE v_new_birth_year INT;
                                SET v_new_birth_year = v_employee_birth_year - (FLOOR(RAND() * 5) + 1);
                                INSERT INTO employees VALUES (
                                    (SELECT MAX(employee_id) + 1 FROM employees),
                                    'Filler Emp',
                                    'filler@company.com',
                                    '555-0000',
                                    'Filler',
                                    'Ops',
                                    CURRENT_TIMESTAMP,
                                    NULL,
                                    30000.0,
                                    0.0,
                                    NULL,
                                    '123 Filler St',
                                    NULL,
                                    v_employee_city,
                                    (SELECT DISTINCT employee_state FROM employees WHERE employee_city = v_employee_city LIMIT 1),
                                    '00000',
                                    'USA',
                                    MAKE_DATE(v_new_birth_year, MONTH(CURRENT_TIMESTAMP), DAY(CURRENT_TIMESTAMP)),
                                    'Female',
                                    'Single',
                                    0
                                );
                            END L2;
                    END CASE;
                END;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_order_shipping_cost DOUBLE;
    DECLARE v_region STRING;
    DECLARE v_region_shipping_changed BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Shipping region logic error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_order_limit INT DEFAULT 3;
        FOR region AS SELECT DISTINCT order_shipping_region FROM orders LIMIT 2 DO
            SET v_region = region.order_shipping_region;
            SET v_order_shipping_cost = (SELECT SUM(order_shipping) FROM orders WHERE order_shipping_region = v_region);
            IF v_order_shipping_cost > 10 THEN
                L1: BEGIN
                    REPEAT
                        SET v_order_shipping_cost = v_order_shipping_cost - 1.0;
                        SET v_region_shipping_changed = true;
                        UPDATE orders SET order_shipping = order_shipping - 0.5 WHERE order_shipping_region = v_region;
                    UNTIL v_order_shipping_cost < 10 END REPEAT;
                END L1;
            END IF;
            BEGIN
                IF v_region_shipping_changed THEN
                    L2: BEGIN
                        DECLARE v_supplier_in_region INT;
                        SET v_supplier_in_region = (SELECT COUNT(*) FROM suppliers WHERE supplier_region = v_region);
                        IF v_supplier_in_region = 0 THEN
                            INSERT INTO suppliers VALUES (
                                (SELECT MAX(supplier_id) + 1 FROM suppliers),
                                'Region Supplier',
                                'Region Contact',
                                'Region Manager',
                                'region@supplier.com',
                                '555-0000',
                                '123 Region St',
                                'Region City',
                                'CA',
                                '00000',
                                'USA',
                                v_region,
                                'General',
                                true
                            );
                        END IF;
                    END L2;
                END IF;
            END;
        END FOR;
    END L0;
    BEGIN
        DECLARE v_nonexistent_orders INT;
        SET v_nonexistent_orders = (SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_id IS NULL);
        IF v_nonexistent_orders > 0 THEN
            L3: BEGIN
                WHILE v_nonexistent_orders > 0 DO
                    DELETE FROM orders WHERE order_id = (SELECT MIN(order_id) FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_id IS NULL);
                    SET v_nonexistent_orders = v_nonexistent_orders - 1;
                END WHILE;
            END L3;
        END IF;
    END;
END;

BEGIN
    DECLARE v_product_size STRING;
    DECLARE v_size_count INT;
    DECLARE v_min_size_count INT DEFAULT 2;
    DECLARE v_size_has_price_flag BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Product size error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR size AS SELECT DISTINCT product_size FROM products LIMIT 3 DO
            SET v_product_size = size.product_size;
            SET v_size_count = (SELECT COUNT(*) FROM products WHERE product_size = v_product_size);
            IF v_size_count < v_min_size_count THEN
                L1: BEGIN
                    REPEAT
                        INSERT INTO products VALUES (
                            (SELECT MAX(product_id) + 1 FROM products),
                            'Extra ' || v_product_size,
                            'General',
                            24.99,
                            15.99,
                            (SELECT MIN(supplier_id) FROM suppliers),
                            'Size Contact',
                            'Size Role',
                            '123 Size St',
                            5,
                            'Black',
                            v_product_size,
                            0.6,
                            'Extra ' || v_product_size || ' product',
                            3.5,
                            8,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            true,
                            0.0,
                            0.19
                        );
                        SET v_size_count = v_size_count + 1;
                        SET v_size_has_price_flag = true;
                    UNTIL v_size_count >= v_min_size_count END REPEAT;
                END L1;
            END IF;
            IF v_size_has_price_flag THEN
                BEGIN
                    DECLARE v_avg_size_price DOUBLE;
                    SET v_avg_size_price = (SELECT AVG(product_price) FROM products WHERE product_size = v_product_size);
                    IF v_avg_size_price > 30 THEN
                        REPEAT
                            UPDATE products SET product_discount = product_discount + 0.05 WHERE product_size = v_product_size AND product_discount < 0.15;
                            SET v_avg_size_price = (SELECT AVG(product_price) FROM products WHERE product_size = v_product_size);
                        UNTIL v_avg_size_price <= 30 END REPEAT;
                    END IF;
                END;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_order_shipping_city STRING;
    DECLARE v_shipping_fee_min DOUBLE DEFAULT 2.0;
    DECLARE v_order_volume INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('City shipping error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR city AS SELECT DISTINCT order_shipping_city FROM orders LIMIT 3 DO
            SET v_order_shipping_city = city.order_shipping_city;
            SET v_order_volume = (SELECT COUNT(*) FROM orders WHERE order_shipping_city = v_order_shipping_city);
            IF v_order_volume > 1 THEN
                L1: BEGIN
                    REPEAT
                        SET v_shipping_fee_min = v_shipping_fee_min + 0.1;
                        UPDATE orders SET order_shipping = order_shipping + 0.2 WHERE order_shipping_city = v_order_shipping_city AND order_shipping < v_shipping_fee_min;
                    UNTIL v_shipping_fee_min > 5.0 END REPEAT;
                END L1;
                BEGIN
                    DECLARE v_order_tax_avg DOUBLE;
                    SET v_order_tax_avg = (SELECT AVG(order_tax) FROM orders WHERE order_shipping_city = v_order_shipping_city);
                    IF v_order_tax_avg > 10 THEN
                        L2: BEGIN
                            REPEAT
                                SET v_order_tax_avg = v_order_tax_avg - 1.0;
                                UPDATE orders SET order_tax = order_tax * 0.9 WHERE order_shipping_city = v_order_shipping_city;
                            UNTIL v_order_tax_avg <= 10 END REPEAT;
                        END L2;
                    END IF;
                END;
            ELSE
                L3: BEGIN
                    REPEAT
                        INSERT INTO orders (
                            order_id,
                            customer_id,
                            order_date,
                            order_status,
                            order_total,
                            order_tax,
                            order_discount,
                            order_shipping,
                            order_shipping_city
                        ) VALUES (
                            (SELECT MAX(order_id) + 1 FROM orders),
                            (SELECT MIN(customer_id) FROM customers),
                            CURRENT_TIMESTAMP,
                            'Volume Insert',
                            12.0,
                            1.2,
                            0.0,
                            2.0,
                            v_order_shipping_city
                        );
                        SET v_order_volume = (SELECT COUNT(*) FROM orders WHERE order_shipping_city = v_order_shipping_city);
                    UNTIL v_order_volume > 1 END REPEAT;
                END L3;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_order_item_id INT;
    DECLARE v_order_item_status STRING;
    DECLARE v_shipped_item_count INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Order item error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR order_item AS SELECT order_item_id, item_status FROM order_items LIMIT 3 DO
            SET v_order_item_id = order_item.order_item_id;
            SET v_order_item_status = order_item.item_status;
            IF v_order_item_status = 'Shipped' THEN
                SET v_shipped_item_count = v_shipped_item_count + 1;
                L1: BEGIN
                    DECLARE v_item_shipping_delay INT;
                    SET v_item_shipping_delay = (SELECT DATEDIFF(DAY, (SELECT item_shipping_date FROM order_items WHERE order_item_id = v_order_item_id), CURRENT_TIMESTAMP));
                    IF v_item_shipping_delay > 7 THEN
                        REPEAT
                            UPDATE order_items SET item_discount = item_discount + 0.05 WHERE order_item_id = v_order_item_id;
                            SET v_item_shipping_delay = (SELECT DATEDIFF(DAY, (SELECT item_shipping_date FROM order_items WHERE order_item_id = v_order_item_id), CURRENT_TIMESTAMP));
                        UNTIL v_item_shipping_delay < 4 END REPEAT;
                    END IF;
                END L1;
            END IF;
        END FOR;
        BEGIN
            IF v_shipped_item_count < 1 THEN
                L2: BEGIN
                    REPEAT
                        INSERT INTO order_items (
                            order_item_id,
                            order_id,
                            product_id,
                            item_quantity,
                            item_price_per_unit,
                            item_discount,
                            item_tax,
                            item_total,
                            item_status,
                            item_shipping_date
                        ) VALUES (
                            (SELECT MAX(order_item_id) + 1 FROM order_items),
                            (SELECT MIN(order_id) FROM orders),
                            (SELECT MIN(product_id) FROM products),
                            1,
                            10.0,
                            0.0,
                            1.0,
                            11.0,
                            'Shipped',
                            CAST(CURRENT_TIMESTAMP AS DATE)
                        );
                        SET v_shipped_item_count = v_shipped_item_count + 1;
                    UNTIL v_shipped_item_count > 0 END REPEAT;
                END L2;
            END IF;
        END;
    END L0;
END;

BEGIN
    DECLARE v_employee_gender STRING;
    DECLARE v_gender_count INT DEFAULT 0;
    DECLARE v_min_gender_emp INT DEFAULT 1;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Employee diversity error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR gender AS SELECT DISTINCT employee_gender FROM employees LIMIT 2 DO
            SET v_employee_gender = gender.employee_gender;
            SET v_gender_count = (SELECT COUNT(*) FROM employees WHERE employee_gender = v_employee_gender);
            IF v_gender_count < v_min_gender_emp THEN
                L1: BEGIN
                    REPEAT
                        INSERT INTO employees VALUES (
                            (SELECT COALESCE(MAX(employee_id), 0) + 1 FROM employees),
                            v_employee_gender || ' Equality',
                            'diverse@' || LOWER(v_employee_gender) || '.com',
                            '555-0000',
                            'Balancer',
                            'HR',
                            CURRENT_TIMESTAMP,
                            NULL,
                            40000.0,
                            0.0,
                            NULL,
                            '123 Balancer St',
                            NULL,
                            'Balancer City',
                            'CA',
                            '00000',
                            'USA',
                            CURRENT_TIMESTAMP,
                            v_employee_gender,
                            'Single',
                            0
                        );
                        SET v_gender_count = v_gender_count + 1;
                    UNTIL v_gender_count >= v_min_gender_emp END REPEAT;
                END L1;
            END IF;
        END FOR;
    END L0;
    L2: BEGIN
        DECLARE v_fill_role STRING;
        SET v_fill_role = 'Filler';
        REPEAT
            INSERT INTO employees VALUES (
                (SELECT COALESCE(MAX(employee_id), 0) + 1 FROM employees),
                v_fill_role,
                'fill@company.com',
                '555-0000',
                v_fill_role,
                v_fill_role,
                CURRENT_TIMESTAMP,
                NULL,
                30000.0,
                0.0,
                NULL,
                '123 Filler St',
                NULL,
                v_fill_role || 'ville',
                'CA',
                '00000',
                'USA',
                CURRENT_TIMESTAMP,
                'Female',
                'Married',
                1
            );
            SET v_fill_role = v_fill_role || '_R';
        UNTIL (SELECT COUNT(*) FROM employees WHERE employee_position = 'Filler') > 1 END REPEAT;
    END L2;
END;

BEGIN
    DECLARE v_zip_code STRING;
    DECLARE v_zip_orders INT DEFAULT 0;
    DECLARE v_zip_customers INT DEFAULT 0;
    DECLARE v_zip_customer_total DOUBLE DEFAULT 0.0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Zip code analysis error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_zip_orders INT DEFAULT 3;
        FOR zip AS SELECT DISTINCT customer_zip FROM customers LIMIT 2 DO
            SET v_zip_code = zip.customer_zip;
            SET v_zip_orders = (SELECT COUNT(*) FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_zip = v_zip_code);
            SET v_zip_customers = (SELECT COUNT(*) FROM customers WHERE customer_zip = v_zip_code);
            IF v_zip_orders < v_min_zip_orders AND v_zip_customers > 0 THEN
                L1: BEGIN
                    REPEAT
                        INSERT INTO orders (
                            order_id,
                            customer_id,
                            order_date,
                            order_status,
                            order_total,
                            order_tax,
                            order_discount,
                            order_shipping
                        ) VALUES (
                            (SELECT MAX(order_id) + 1 FROM orders),
                            (SELECT MIN(customer_id) FROM customers WHERE customer_zip = v_zip_code),
                            CURRENT_TIMESTAMP,
                            'Zip Fill',
                            20.0,
                            2.0,
                            0.0,
                            3.0
                        );
                        SET v_zip_orders = v_zip_orders + 1;
                    UNTIL v_zip_orders >= v_min_zip_orders END REPEAT;
                END L1;
            ELSEIF v_zip_customers = 0 THEN
                L2: BEGIN
                    REPEAT
                        INSERT INTO customers VALUES (
                            (SELECT MAX(customer_id) + 1 FROM customers),
                            'Zip Filler ' || v_zip_code,
                            'zip_' || v_zip_code || '@example.com',
                            '555-0000',
                            '123 Zip St',
                            'Zip City',
                            'CA',
                            v_zip_code,
                            'USA',
                            'Retail',
                            CURRENT_TIMESTAMP,
                            0.0,
                            NULL,
                            NULL,
                            NULL,
                            true,
                            true,
                            0.0,
                            NULL,
                            NULL
                        );
                        SET v_zip_customers = v_zip_customers + 1;
                    UNTIL v_zip_customers > 0 END REPEAT;
                END L2;
            END IF;
            SET v_zip_customer_total = (SELECT SUM(customer_total_spent) FROM customers WHERE customer_zip = v_zip_code);
            IF v_zip_customer_total > 200.0 AND v_zip_customers > 0 THEN
                L3: BEGIN
                    REPEAT
                        UPDATE customers
                        SET customer_discount_percentage = customer_discount_percentage + 0.05
                        WHERE customer_zip = v_zip_code
                        AND customer_discount_percentage < 0.2;
                        SET v_zip_customer_total = (SELECT SUM(customer_total_spent) FROM customers WHERE customer_zip = v_zip_code);
                    UNTIL v_zip_customer_total <= 200.0 OR v_zip_customers = 0 END REPEAT;
                END L3;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_department_emp_count INT;
    DECLARE v_department_avg_yearly_salary DOUBLE;
    DECLARE v_salary_change_needed BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Department salary error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_dept_size INT DEFAULT 2;
        FOR department AS SELECT DISTINCT employee_department FROM employees LIMIT 3 DO
            SET v_department_emp_count = (SELECT COUNT(*) FROM employees WHERE employee_department = department.employee_department);
            SET v_department_avg_yearly_salary = (SELECT AVG(employee_salary) FROM employees WHERE employee_department = department.employee_department);
            IF v_department_emp_count > v_min_dept_size THEN
                L1: BEGIN
                    IF v_department_avg_yearly_salary > 60000 THEN
                        L2: BEGIN
                            SET v_salary_change_needed = true;
                            REPEAT
                                UPDATE employees SET employee_salary = employee_salary * 0.97 WHERE employee_department = department.employee_department AND employee_salary > 40000;
                                SET v_department_avg_yearly_salary = (SELECT AVG(employee_salary) FROM employees WHERE employee_department = department.employee_department);
                            UNTIL v_department_avg_yearly_salary < 60000 OR v_salary_change_needed = false END REPEAT;
                        END L2;
                    END IF;
                END L1;
            ELSE
                L3: BEGIN
                    DECLARE v_new_emp_id INT;
                    SET v_new_emp_id = (SELECT MAX(employee_id) + 1 FROM employees);
                    INSERT INTO employees VALUES (
                        v_new_emp_id,
                        'Dept Filler',
                        'dept_' || LOWER(department.employee_department) || '@company.com',
                        '555-0000',
                        'Member',
                        department.employee_department,
                        CURRENT_TIMESTAMP,
                        NULL,
                        45000.0,
                        0.0,
                        NULL,
                        '123 Dept St',
                        NULL,
                        'Dept City',
                        'CA',
                        '00000',
                        'USA',
                        CURRENT_TIMESTAMP,
                        'Female',
                        'Single',
                        0
                    );
                    SET v_department_emp_count = v_department_emp_count + 1;
                END L3;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_supplier_type STRING;
    DECLARE v_supplier_product_count INT;
    DECLARE v_products_per_type_min INT DEFAULT 3;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Supplier product error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR supplier AS SELECT supplier_id, supplier_main_products FROM suppliers LIMIT 3 DO
            SET v_supplier_type = supplier.supplier_main_products;
            SET v_supplier_product_count = (SELECT COUNT(*) FROM products WHERE supplier_id = supplier.supplier_id AND product_category = v_supplier_type);
            IF v_supplier_product_count < v_products_per_type_min THEN
                L1: BEGIN
                    REPEAT
                        INSERT INTO products VALUES (
                            (SELECT MAX(product_id) + 1 FROM products),
                            'Type ' || v_supplier_type,
                            v_supplier_type,
                            39.99,
                            29.99,
                            supplier.supplier_id,
                            supplier.supplier_main_products || ' Contact',
                            supplier.supplier_main_products || ' Role',
                            '123 Type St',
                            7,
                            'Mixed',
                            'Standard',
                            0.8,
                            'Type product',
                            3.5,
                            0,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            true,
                            0.0,
                            0.19
                        );
                        SET v_supplier_product_count = v_supplier_product_count + 1;
                    UNTIL v_supplier_product_count >= v_products_per_type_min END REPEAT;
                END L1;
            END IF;
        END FOR;
    END L0;
    BEGIN
        DECLARE v_no_match_product_count INT;
        SET v_no_match_product_count = (
            SELECT COUNT(*)
            FROM products p
            JOIN suppliers s
                ON p.supplier_id = s.supplier_id
            WHERE p.product_category != s.supplier_main_products
        );
        IF v_no_match_product_count > 0 THEN
            L2: BEGIN
                REPEAT
                    UPDATE products
                    SET product_category = (
                        SELECT supplier_main_products
                        FROM suppliers
                        WHERE supplier_id = products.supplier_id
                        LIMIT 1
                    )
                    WHERE product_id = (
                        SELECT MIN(product_id)
                        FROM products p
                        JOIN suppliers s
                            ON p.ssupplier_id = s.supplier_id
                        WHERE p.product_category != s.supplier_main_products
                        LIMIT 1
                    );
                    SET v_no_match_product_count = (
                        SELECT COUNT(*)
                        FROM products p
                        JOIN suppliers s
                            ON p.supplier_id = s.supplier_id
                        WHERE p.product_category != s.supplier_main_products
                    );
                UNTIL v_no_match_product_count = 0 END REPEAT;
            END L2;
        END IF;
    END;
END;

BEGIN
    DECLARE v_product_cost DOUBLE;
    DECLARE v_product_discount DOUBLE;
    DECLARE v_low_margin_flag BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Product margin error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_products_margin_check INT DEFAULT 2;
        FOR product AS SELECT product_id, product_cost, product_discount FROM products LIMIT 3 DO
            SET v_product_cost = product.product_cost;
            SET v_product_discount = product.product_discount;
            L1: BEGIN
                DECLARE v_sale_price DOUBLE;
                SET v_sale_price = (SELECT product_price FROM products WHERE product_id = product.product_id);
                IF v_sale_price - v_product_cost < 10 THEN
                    SET v_low_margin_flag = true;
                    L2: BEGIN
                        REPEAT
                            UPDATE products
                            SET product_price = product_price * 1.05
                            WHERE product_id = product.product_id;
                            SET v_sale_price = (SELECT product_price FROM products WHERE product_id = product.product_id);
                        UNTIL v_sale_price - v_product_cost >= 10 OR v_low_margin_flag = false END REPEAT;
                    END L2;
                END IF;
                IF v_product_discount > 0.1 AND v_low_margin_flag = true THEN
                    REPEAT
                        UPDATE products
                        SET product_discount = product_discount - 0.02
                        WHERE product_id = product.product_id;
                        SET v_product_discount = (SELECT product_discount FROM products WHERE product_id = product.product_id);
                    UNTIL v_product_discount <= 0.1 END REPEAT;
                END IF;
            END L1;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_supplier_active BOOLEAN;
    DECLARE v_suppliers_per_region_target INT DEFAULT 2;
    DECLARE v_region_suppliers_current INT;
    DECLARE v_region_to_balance STRING;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Supplier region error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        FOR region AS SELECT DISTINCT supplier_region FROM suppliers LIMIT 3 DO
            SET v_region_to_balance = region.supplier_region;
            SET v_region_suppliers_current = (SELECT COUNT(*) FROM suppliers WHERE supplier_active = true AND supplier_region = v_region_to_balance);
            IF v_region_suppliers_current < v_suppliers_per_region_target THEN
                L1: BEGIN
                    REPEAT
                        INSERT INTO suppliers VALUES (
                            (SELECT MAX(supplier_id) + 1 FROM suppliers),
                            'Regional Filler',
                            'Regional Manager',
                            'Contact Role',
                            'region_' || v_region_to_balance || '@example.com',
                            '555-0001',
                            '123 Regional St',
                            'Regional City',
                            'CA',
                            '00000',
                            'USA',
                            v_region_to_balance,
                            'Diverse',
                            'http://regional.com',
                            CURRENT_TIMESTAMP,
                            NULL,
                            NULL,
                            4.0,
                            true
                        );
                        SET v_region_suppliers_current = (SELECT COUNT(*) FROM suppliers WHERE supplier_active = true AND supplier_region = v_region_to_balance);
                    UNTIL v_region_suppliers_current >= v_suppliers_per_region_target END REPEAT;
                END L1;
            END IF;
        END FOR;
    END L0;
    BEGIN
        DECLARE v_no_region_suppliers_count INT;
        SET v_no_region_suppliers_count = (SELECT COUNT(DISTINCT supplier_region) FROM suppliers);
        IF v_no_region_suppliers_count < 5 THEN
            L2: BEGIN
                REPEAT
                    INSERT INTO suppliers VALUES (
                        (SELECT MAX(supplier_id) + 1 FROM suppliers),
                        'New Region Corp',
                        'Region Manager',
                        'Contact',
                        'newregion@example.com',
                        '555-0002',
                        '123 Main St',
                        'New City',
                        'CA',
                        '00001',
                        'USA',
                        CONCAT('Region_', v_no_region_suppliers_count + 1),
                        'General',
                        'http://newregion.com',
                        CURRENT_TIMESTAMP,
                        NULL,
                        NULL,
                        4.5,
                        true
                    );
                    SET v_no_region_suppliers_count = (SELECT COUNT(DISTINCT supplier_region) FROM suppliers);
                UNTIL v_no_region_suppliers_count >= 5 END REPEAT;
            END L2;
        END IF;
    END;
END;

BEGIN
    DECLARE v_customer_city STRING;
    DECLARE v_city_order_count INT;
    DECLARE v_city_supplier_count INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('City order diversity error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_orders_per_city INT DEFAULT 1;
        DECLARE v_min_suppliers_per_city INT DEFAULT 1;
        FOR city AS SELECT DISTINCT customer_city FROM customers LIMIT 3 DO
            SET v_customer_city = city.customer_city;
            SET v_city_order_count = (SELECT COUNT(*) FROM orders WHERE customer_id IN (SELECT customer_id FROM customers WHERE customer_city = v_customer_city));
            IF v_city_order_count = 0 THEN
                L1: BEGIN
                    INSERT INTO orders (
                        order_id,
                        customer_id,
                        order_date,
                        order_status,
                        order_total,
                        order_tax,
                        order_discount,
                        order_shipping
                    ) VALUES (
                        (SELECT MAX(order_id) + 1 FROM orders),
                        (SELECT MIN(customer_id) FROM customers WHERE customer_city = v_customer_city),
                        CURRENT_TIMESTAMP,
                        'City Fill',
                        25.0,
                        2.5,
                        0.0,
                        2.5
                    );
                    SET v_city_order_count = (SELECT COUNT(*) FROM orders WHERE customer_id IN (SELECT customer_id FROM customers WHERE customer_city = v_customer_city));
                END L1;
                L2: BEGIN
                    SET v_city_supplier_count = (SELECT COUNT(*) FROM suppliers WHERE supplier_city = v_customer_city);
                    IF v_city_supplier_count = 0 THEN
                        INSERT INTO suppliers VALUES (
                            (SELECT MAX(supplier_id) + 1 FROM suppliers),
                            'City ' || v_customer_city,
                            'City Contact',
                            'City Role',
                            'city@example.com',
                            '555-0000',
                            '123 City St',
                            v_customer_city,
                            'CA',
                            '00000',
                            'USA',
                            v_customer_city,
                            'General',
                            'http://city.com',
                            CURRENT_TIMESTAMP,
                            NULL,
                            NULL,
                            4.0,
                            true
                        );
                        SET v_city_supplier_count = v_city_supplier_count + 1;
                    END IF;
                END L2;
            END IF;
            IF EXISTS (SELECT 1 FROM customers WHERE customer_city = v_customer_city) THEN
                L3: BEGIN
                    CASE
                        WHEN v_city_order_count % 2 = 0 THEN
                            UPDATE customers
                            SET customer_active_status = true
                            WHERE customer_city = v_customer_city;
                        ELSE
                            UPDATE customers
                            SET customer_active_status = false
                            WHERE customer_city = v_customer_city
                            AND customer_id = (
                                SELECT MIN(customer_id)
                                FROM customers
                                WHERE customer_city = v_customer_city
                            );
                    END CASE;
                END L3;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_product_weight DOUBLE;
    DECLARE v_product_category STRING;
    DECLARE v_category_weights INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Category weight error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_category_weight_count INT DEFAULT 3;
        FOR category AS SELECT DISTINCT product_category FROM products LIMIT 3 DO
            SET v_product_category = category.product_category;
            SET v_category_weights = (SELECT COUNT(*) FROM products WHERE product_category = v_product_category AND product_weight IS NOT NULL);
            IF v_category_weights < v_min_category_weight_count THEN
                L1: BEGIN
                BEGIN
                        DECLARE v_weight_to_set DOUBLE;
                        SET v_weight_to_set = 0.5 + (SELECT COUNT(*) FROM products WHERE product_category = v_product_category);
                        WHILE v_weight_to_set < 2.5 DO
                            INSERT INTO products VALUES (
                                (SELECT MAX(product_id) + 1 FROM products),
                                v_product_category || ' Weight',
                                v_product_category,
                                39.99,
                                29.99,
                                (SELECT MIN(supplier_id) FROM suppliers),
                                'Weight Contact',
                                'Weight Role',
                                '123 Weight St',
                                4,
                                CASE WHEN MOD((SELECT COUNT(*) FROM products WHERE product_category = v_product_category), 2) = 0 THEN 'Black' ELSE 'Gray' END,
                                'Standard',
                                v_weight_to_set,
                                'Weighted item',
                                3.0,
                                0,
                                CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP,
                                true,
                                0.0,
                                0.19
                            );
                            SET v_weight_to_set = v_weight_to_set + 0.2;
                            SET v_category_weights = v_category_weights + 1;
                        END WHILE;
                    END;
                END L1;
            END IF;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_product_review DOUBLE;
    DECLARE v_product_rating DOUBLE;
    DECLARE v_reviews_per_category INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Product review/rating error'); END;

    -- Wide, deep, random logic, labels
    L0: BEGIN
        DECLARE v_min_reviews_per_category INT DEFAULT 1;
        FOR category AS SELECT DISTINCT product_category FROM products LIMIT 3 DO
            SET v_reviews_per_category = (SELECT SUM(product_reviews) FROM products WHERE product_category = category.product_category);
            SET v_product_rating = (SELECT AVG(product_rating) FROM products WHERE product_category = category.product_category);
            L1: BEGIN
                IF v_reviews_per_category < v_min_reviews_per_category THEN
                    BEGIN
                        INSERT INTO products VALUES (
                            (SELECT MAX(product_id) + 1 FROM products),
                            'Review Filler',
                            category.product_category,
                            39.99,
                            29.99,
                            (SELECT MIN(supplier_id) FROM suppliers),
                            'Review Contact',
                            'Review Role',
                            '123 Reviews St',
                            6,
                            'Blue',
                            'Large',
                            1.2,
                            'Filled with reviews',
                            4.0,
                            25,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            true,
                            0.0,
                            0.19
                        );
                        SET v_reviews_per_category = v_reviews_per_category + 25;
                    END;
                END IF;
                IF v_product_rating IS NULL OR v_product_rating < 3.0 THEN
                    BEGIN
                        UPDATE products
                        SET product_rating = 4.0
                        WHERE product_category = category.product_category AND product_reviews > 0;
                        SET v_product_rating = (SELECT AVG(product_rating) FROM products WHERE product_category = category.product_category);
                    END;
                END IF;
            END L1;
        END FOR;
    END L0;
END;

BEGIN
    DECLARE v_customer_is_prime BOOLEAN DEFAULT false;
    DECLARE v_prime_customer_count INT;
    DECLARE v_min_prime_customers INT DEFAULT 2;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Prime customer error'); END;

    L0: BEGIN
        SET v_prime_customer_count = (SELECT COUNT(*) FROM customers WHERE customer_is_prime_member = true);
        IF v_prime_customer_count < v_min_prime_customers THEN
            FOR cust AS SELECT customer_id FROM customers WHERE customer_is_prime_member IS NULL LIMIT v_min_prime_customers DO
                UPDATE customers
                SET customer_is_prime_member = true,
                    customer_prime_customer_since = CURRENT_TIMESTAMP
                WHERE customer_id = cust.customer_id;
                SET v_customer_is_prime = true;
            END FOR;
            IF v_customer_is_prime = false AND v_prime_customer_count < v_min_prime_customers THEN
                INSERT INTO customers VALUES (
                    (SELECT MAX(customer_id) + 1 FROM customers),
                    'Prime Customer',
                    'prime@example.com',
                    '555-0000',
                    '123 Prime St',
                    'Prime City',
                    'CA',
                    '00000',
                    'USA',
                    'Retail',
                    CURRENT_TIMESTAMP,
                    0.0,
                    NULL,
                    NULL,
                    NULL,
                    true,
                    true,
                    0.0,
                    CURRENT_TIMESTAMP,
                    NULL,
                    true
                );
                SET v_customer_is_prime = true;
            END IF;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_order_status STRING;
    DECLARE v_orders_with_items INT;
    DECLARE v_empty_orders INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Order-item linkage error'); END;

    L0: BEGIN
        SET v_orders_with_items = (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi);
        SET v_empty_orders = (SELECT COUNT(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.order_id));
        IF v_empty_orders > 0 THEN
            L1: BEGIN
                FOR empty_order AS SELECT order_id FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.order_id) LIMIT 2 DO
                    SET v_order_status = (SELECT order_status FROM orders WHERE order_id = empty_order.order_id);
                    L2: BEGIN
                        CASE
                            WHEN v_order_status = 'Completed' THEN
                                INSERT INTO order_items (
                                    order_item_id,
                                    order_id,
                                    product_id,
                                    item_quantity,
                                    item_price_per_unit,
                                    item_discount,
                                    item_tax,
                                    item_total
                                ) VALUES (
                                    (SELECT MAX(order_item_id) + 1 FROM order_items),
                                    empty_order.order_id,
                                    (SELECT MIN(product_id) FROM products),
                                    1,
                                    10.0,
                                    0.0,
                                    1.0,
                                    11.0
                                );
                            WHEN v_order_status = 'Processing' THEN
                                INSERT INTO order_items (
                                    order_item_id,
                                    order_id,
                                    product_id,
                                    item_quantity,
                                    item_price_per_unit,
                                    item_discount,
                                    item_tax,
                                    item_total,
                                    item_status
                                ) VALUES (
                                    (SELECT MAX(order_item_id) + 1 FROM order_items),
                                    empty_order.order_id,
                                    (SELECT MIN(product_id) FROM products),
                                    1,
                                    10.0,
                                    0.0,
                                    1.0,
                                    11.0,
                                    'Preparing'
                                );
                            ELSE
                                BEGIN
                                    DECLARE v_product_id INT;
                                    SET v_product_id = (SELECT product_id FROM products WHERE product_category = 'Specialty' LIMIT 1);
                                    IF v_product_id IS NULL THEN
                                        SET v_product_id = (SELECT MIN(product_id) FROM products);
                                    END IF;
                                    INSERT INTO order_items (
                                        order_item_id,
                                        order_id,
                                        product_id,
                                        item_quantity,
                                        item_price_per_unit,
                                        item_discount,
                                        item_tax,
                                        item_total,
                                        item_status
                                    ) VALUES (
                                        (SELECT MAX(order_item_id) + 1 FROM order_items),
                                        empty_order.order_id,
                                        v_product_id,
                                        1,
                                        20.0,
                                        0.0,
                                        2.0,
                                        22.0,
                                        CASE
                                            WHEN RANDOM() > 0.5 THEN 'Shipped'
                                            ELSE 'Processing'
                                        END
                                    );
                                END;
                        END CASE;
                    END L2;
                    SET v_empty_orders = v_empty_orders - 1;
                END FOR;
            END L1;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_supplier_product_match INT;
    DECLARE v_is_supplier_core BOOLEAN;
    DECLARE v_product_supplier_missing BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Supplier-product match error'); END;

    L0: BEGIN
        FOR sup AS SELECT supplier_id, supplier_main_products FROM suppliers LIMIT 2 DO
            SET v_supplier_product_match = (SELECT COUNT(*) FROM products p WHERE p.supplier_id = sup.supplier_id AND p.product_category = sup.supplier_main_products);
            IF v_supplier_product_match = 0 THEN
                L1: BEGIN
                    SET v_is_supplier_core = (sup.supplier_main_products IS NOT NULL AND sup.supplier_main_products != '');
                    IF v_is_supplier_core THEN
                        INSERT INTO products VALUES (
                            (SELECT MAX(product_id) + 1 FROM products),
                            sup.supplier_main_products || ' Special',
                            sup.supplier_main_products,
                            44.99,
                            34.99,
                            sup.supplier_id,
                            sup.supplier_name,
                            'Product Specialist',
                            '123 Main St',
                            10,
                            'Any',
                            'Large',
                            1.3,
                            'Supplier-matched',
                            4.2,
                            0,
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP,
                            true,
                            0.0,
                            0.19
                        );
                    END IF;
                END L1;
            END IF;
        END FOR;
    END L0;

    L2: BEGIN
        IF EXISTS (
            SELECT 1
            FROM products
            WHERE product_category NOT LIKE '%' || (
                SELECT supplier_main_products
                FROM suppliers
                WHERE supplier_id = products.supplier_id
            ) || '%'
            AND supplier_id IS NOT NULL
        ) THEN
            FOR prod AS SELECT product_id, product_category, supplier_id FROM products WHERE product_category NOT LIKE '%' || (
                SELECT supplier_main_products
                FROM suppliers
                WHERE supplier_id = products.supplier_id
            ) || '%' LIMIT 2 DO
                IF EXISTS (
                    SELECT 1
                    FROM suppliers
                    WHERE supplier_main_products LIKE '%' || prod.product_category || '%'
                ) THEN
                    UPDATE products
                    SET supplier_id = (
                        SELECT MIN(supplier_id)
                        FROM suppliers
                        WHERE supplier_main_products LIKE '%' || prod.product_category || '%'
                    )
                    WHERE product_id = prod.product_id;
                END IF;
            END FOR;
        END IF;
    END L2;
END;

BEGIN
    DECLARE v_order_tax_percent DOUBLE;
    DECLARE v_country_tax_rates INT;
    DECLARE v_tax_exception BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Tax rate diversity error'); END;

    L0: BEGIN
        SET v_country_tax_rates = (
            SELECT COUNT(DISTINCT CONCAT(order_tax, order_shipping_country))
            FROM orders
            WHERE order_tax != 0
        );
        IF v_country_tax_rates < 4 AND (SELECT COUNT(DISTINCT order_shipping_country) FROM orders) > 2 THEN
            L1: BEGIN
                FOR country_tax_pair AS SELECT DISTINCT order_shipping_country FROM orders WHERE order_tax = 0 LIMIT 4 DO
                    SET v_order_tax_percent = CASE
                        WHEN country_tax_pair.order_shipping_country = 'USA' THEN 0.08
                        WHEN country_tax_pair.order_shipping_country = 'UK' THEN 0.20
                        WHEN country_tax_pair.order_shipping_country = 'CA' THEN 0.05
                        WHEN country_tax_pair.order_shipping_country = 'AU' THEN 0.10
                        ELSE 0.19
                    END;
                    INSERT INTO orders (
                        order_id,
                        customer_id,
                        order_date,
                        order_status,
                        order_total,
                        order_tax,
                        order_discount,
                        order_shipping,
                        order_shipping_country
                    ) VALUES (
                        (SELECT MAX(order_id) + 1 FROM orders),
                        (SELECT MIN(customer_id) FROM customers),
                        CURRENT_TIMESTAMP,
                        'Tax Diversity',
                        50.0,
                        ROUND(50.0 * v_order_tax_percent, 2),
                        0.0,
                        2.0,
                        country_tax_pair.order_shipping_country
                    );
                END FOR;
                SET v_tax_exception = true;
            END L1;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_customer_type_count INT;
    DECLARE v_low_diversity_type STRING;
    DECLARE v_orders_by_type INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Type order diversity error'); END;

    L0: BEGIN
        SET v_customer_type_count = (SELECT COUNT(DISTINCT customer_type) FROM customers);
        IF v_customer_type_count < 5 THEN
            FOR type_boost AS SELECT DISTINCT customer_type FROM customers LIMIT 3 DO
                SET v_orders_by_type = (SELECT COUNT(*) FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_type = type_boost.customer_type);
                IF v_orders_by_type < 2 THEN
                    INSERT INTO orders (
                        order_id,
                        customer_id,
                        order_date,
                        order_status,
                        order_total,
                        order_tax,
                        order_discount,
                        order_shipping
                    ) VALUES (
                        (SELECT MAX(order_id) + 1 FROM orders),
                        (SELECT MIN(customer_id) FROM customers WHERE customer_type = type_boost.customer_type),
                        CURRENT_TIMESTAMP,
                        'Type Filler',
                        15.0,
                        1.5,
                        0.0,
                        2.0
                    );
                END IF;
            END FOR;
        ELSE
            SET v_low_diversity_type = (SELECT customer_type FROM customers GROUP BY customer_type ORDER BY COUNT(*) LIMIT 1);
            IF (SELECT COUNT(*) FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE c.customer_type = v_low_diversity_type) < 1 THEN
                INSERT INTO orders (
                    order_id,
                    customer_id,
                    order_date,
                    order_status,
                    order_total,
                    order_tax,
                    order_discount,
                    order_shipping
                ) VALUES (
                    (SELECT MAX(order_id) + 1 FROM orders),
                    (SELECT MIN(customer_id) FROM customers WHERE customer_type = v_low_diversity_type),
                    CURRENT_TIMESTAMP,
                    'Type Revival',
                    10.0,
                    1.0,
                    0.0,
                    1.0
                );
            END IF;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_supplier_product_min INT DEFAULT 2;
    DECLARE v_products_per_supplier INT;
    DECLARE v_suppliers_with_stock INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Supplier-product linkage error'); END;

    L0: BEGIN
        FOR sup AS SELECT supplier_id FROM suppliers LIMIT 3 DO
            SET v_products_per_supplier = (SELECT COUNT(*) FROM products WHERE supplier_id = sup.supplier_id);
            IF v_products_per_supplier < v_supplier_product_min THEN
                BEGIN
                    DECLARE v_new_product_id INT;
                    SET v_new_product_id = (SELECT MAX(product_id) + 1 FROM products);
                    INSERT INTO products VALUES (
                        v_new_product_id,
                        'Supplier Stock',
                        'Generic',
                        24.99,
                        19.99,
                        sup.supplier_id,
                        'Stock Contact',
                        'Stock Role',
                        '123 Stock St',
                        5,
                        'White',
                        'Standard',
                        0.6,
                        'Supplier item',
                        3.0,
                        0,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP,
                        true,
                        0.0,
                        0.19
                    );
                    SET v_suppliers_with_stock = v_suppliers_with_stock + 1;
                END;
            END IF;
        END FOR;
    END L0;
    BEGIN
        IF v_suppliers_with_stock < 2 AND (SELECT COUNT(*) FROM products WHERE supplier_id IS NULL) > 0 THEN
            UPDATE products
            SET supplier_id = (SELECT MIN(supplier_id) FROM suppliers)
            WHERE product_id = (SELECT MIN(product_id) FROM products WHERE supplier_id IS NULL);
        END IF;
    END;
END;

BEGIN
    DECLARE v_order_total_min DOUBLE DEFAULT 10.0;
    DECLARE v_order_count_low_value INT;
    DECLARE v_order_min_value_id INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Order value error'); END;

    L0: BEGIN
        SET v_order_count_low_value = (SELECT COUNT(*) FROM orders WHERE order_total < v_order_total_min);
        IF v_order_count_low_value > 0 THEN
            L1: BEGIN
                SET v_order_min_value_id = (SELECT MIN(order_id) FROM orders WHERE order_total < v_order_total_min);
                REPEAT
                    UPDATE orders
                    SET order_total = v_order_total_min,
                        order_discount = 0.0
                    WHERE order_id = v_order_min_value_id;
                    SET v_order_min_value_id = (SELECT MIN(order_id) FROM orders WHERE order_total < v_order_total_min);
                UNTIL v_order_min_value_id IS NULL OR v_order_count_low_value < 2
                END REPEAT;
            END L1;
        ELSE
            L2: BEGIN
                INSERT INTO orders (
                    order_id,
                    customer_id,
                    order_date,
                    order_status,
                    order_total,
                    order_tax,
                    order_discount,
                    order_shipping
                ) VALUES (
                    (SELECT MAX(order_id) + 1 FROM orders),
                    (SELECT MIN(customer_id) FROM customers),
                    CURRENT_TIMESTAMP,
                    'Low Value',
                    v_order_total_min / 2.0,
                    0.0,
                    0.0,
                    1.0
                );
            END L2;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_order_item_bulk_flag BOOLEAN DEFAULT false;
    DECLARE v_large_orders_count INT;
    DECLARE v_min_bulk_items INT DEFAULT 2;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Bulk item error'); END;

    L0: BEGIN
        SET v_large_orders_count = (SELECT COUNT(*) FROM order_items WHERE item_quantity >= 5);
        IF v_large_orders_count < v_min_bulk_items THEN
            WHILE v_large_orders_count < v_min_bulk_items DO
                INSERT INTO orders (
                    order_id,
                    customer_id,
                    order_date,
                    order_status,
                    order_total,
                    order_tax,
                    order_discount,
                    order_shipping
                ) VALUES (
                    (SELECT MAX(order_id) + 1 FROM orders),
                    (SELECT MIN(customer_id) FROM customers),
                    CURRENT_TIMESTAMP,
                    'Bulk',
                    120.0,
                    12.0,
                    0.0,
                    0.0
                );
                INSERT INTO order_items (
                    order_item_id,
                    order_id,
                    product_id,
                    item_quantity,
                    item_price_per_unit,
                    item_discount,
                    item_tax,
                    item_total
                ) VALUES (
                    (SELECT MAX(order_item_id) + 1 FROM order_items),
                    (SELECT MAX(order_id) FROM orders),
                    (SELECT MIN(product_id) FROM products),
                    6,
                    15.0,
                    0.0,
                    1.0,
                    96.0
                );
                SET v_large_orders_count = v_large_orders_count + 1;
            END WHILE;
            SET v_order_item_bulk_flag = true;
        END IF;
        IF v_order_item_bulk_flag = false AND (SELECT COUNT(*) FROM order_items WHERE item_quantity > 1) < 5 THEN
            REPEAT
                INSERT INTO order_items (
                    order_item_id,
                    order_id,
                    product_id,
                    item_quantity,
                    item_price_per_unit,
                    item_discount,
                    item_tax,
                    item_total
                ) VALUES (
                    (SELECT MAX(order_item_id) + 1 FROM order_items),
                    (SELECT MIN(order_id) FROM orders),
                    (SELECT MIN(product_id) FROM products),
                    3,
                    12.0,
                    0.0,
                    1.0,
                    39.0
                );
            UNTIL (SELECT COUNT(*) FROM order_items WHERE item_quantity > 1) >= 5
            END REPEAT;
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_product_tags_count INT;
    DECLARE V_TAG_VALUE STRING DEFAULT 'featured';
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Product tag error'); END;

    L0: BEGIN
        SET v_product_tags_count = (SELECT COUNT(*) FROM products WHERE JSON_EXTRACT(product_metadata, '$.tags') IS NOT NULL AND JSON_EXTRACT(product_metadata, '$.tags') != '[]');
        IF v_product_tags_count < 3 THEN
            L1: BEGIN
                FOR prod AS SELECT product_id, product_metadata FROM products LIMIT 3 DO
                    IF JSON_EXTRACT(prod.product_metadata, '$.tags') IS NULL OR JSON_EXTRACT(prod.product_metadata, '$.tags') = '[]' THEN
                        UPDATE products
                        SET product_metadata = JSON_SET(
                            IFNULL(product_metadata, '{}'),
                            '$.tags',
                            JSON_ARRAY(
                                V_TAG_VALUE,
                                CASE WHEN MOD(prod.product_id, 2) = 0 THEN 'eco' ELSE 'limited' END
                            )
                        )
                        WHERE product_id = prod.product_id;
                        SET v_product_tags_count = v_product_tags_count + 1;
                    END IF;
                END FOR;
            END L1;
        END IF;
        IF v_product_tags_count < 1 THEN
            INSERT INTO products VALUES (
                (SELECT MAX(product_id) + 1 FROM products),
                'Tagged Example',
                'Special',
                29.99,
                19.99,
                (SELECT MIN(supplier_id) FROM suppliers),
                'Tag Contact',
                'Tag Role',
                '123 Tag St',
                5,
                'Yellow',
                'Small',
                0.5,
                'Tagged',
                4.0,
                0,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                true,
                0.0,
                0.19,
                '{"tags": ["featured", "eco"]}'
            );
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_order_item_returns BOOLEAN DEFAULT false;
    DECLARE v_returns_to_cover INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Return item error'); END;

    L0: BEGIN
        SET v_returns_to_cover = (SELECT COUNT(*) FROM order_items WHERE item_status = 'Returned');
        IF v_returns_to_cover < 2 THEN
            L1: BEGIN
                FOR oi AS SELECT order_item_id FROM order_items WHERE item_status != 'Returned' LIMIT 2 DO
                    UPDATE order_items
                    SET item_status = 'Returned',
                        item_return_date = CURRENT_TIMESTAMP
                    WHERE order_item_id = oi.order_item_id;
                    SET v_returns_to_cover = v_returns_to_cover + 1;
                END FOR;
                SET v_order_item_returns = true;
            END L1;
        END IF;
        IF v_order_item_returns = false AND v_returns_to_cover < 1 THEN
            INSERT INTO order_items (
                order_item_id,
                order_id,
                product_id,
                item_quantity,
                item_price_per_unit,
                item_discount,
                item_tax,
                item_total,
                item_status,
                item_return_date
            ) VALUES (
                (SELECT MAX(order_item_id) + 1 FROM order_items),
                (SELECT MIN(order_id) FROM orders),
                (SELECT MIN(product_id) FROM products),
                1,
                10.0,
                0.0,
                1.0,
                11.0,
                'Returned',
                CURRENT_TIMESTAMP
            );
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_order_item_status_aging BOOLEAN DEFAULT false;
    DECLARE v_order_item_status_preprocessing INT;
    DECLARE v_required_status_transitions INT DEFAULT 2;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Status workflow error'); END;

    L0: BEGIN
        SET v_order_item_status_preprocessing = (SELECT COUNT(*) FROM order_items WHERE item_status = 'Preprocessing' AND item_delivery_date IS NULL);
        IF v_order_item_status_preprocessing >= 1 THEN
            -- Advance one preprocessing item
            UPDATE order_items
            SET item_status = 'Processing',
                item_delivery_date = CURRENT_TIMESTAMP
            WHERE order_item_id = (SELECT MIN(order_item_id) FROM order_items WHERE item_status = 'Preprocessing');
            SET v_order_item_status_aging = true;
        END IF;
        IF v_order_item_status_aging = false AND (SELECT COUNT(*) FROM customers WHERE customer_last_order_date > DATEADD(DAY, -7, CURRENT_TIMESTAMP)) < 2 THEN
            INSERT INTO orders (
                order_id,
                customer_id,
                order_date,
                order_status,
                order_total,
                order_tax,
                order_discount,
                order_shipping
            ) VALUES (
                (SELECT MAX(order_id) + 1 FROM orders),
                (SELECT MIN(customer_id) FROM customers),
                CURRENT_TIMESTAMP,
                'Item Status Flow',
                15.0,
                1.5,
                0.0,
                2.0
            );
            INSERT INTO order_items (
                order_item_id,
                order_id,
                product_id,
                item_quantity,
                item_price_per_unit,
                item_discount,
                item_tax,
                item_total,
                item_status,
                item_delivery_date
            ) VALUES (
                (SELECT MAX(order_item_id) + 1 FROM order_items),
                (SELECT MAX(order_id) FROM orders),
                (SELECT MIN(product_id) FROM products),
                1,
                12.0,
                0.0,
                1.0,
                13.0,
                'Preprocessing',
                NULL
            );
        END IF;
    END L0;
END;

BEGIN
    DECLARE v_supplier_product_diversity_count INT;
    DECLARE v_min_supplier_product_diversity INT DEFAULT 2;
    DECLARE v_diversity_enforced BOOLEAN DEFAULT false;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN VALUES('Supplier-product diversity error'); END;

    L0: BEGIN
        SET v_supplier_product_diversity_count = (
            SELECT COUNT(DISTINCT product_category)
            FROM products p
            JOIN suppliers s ON p.supplier_id = s.supplier_id
            WHERE s.supplier_main_products IS NULL
               OR p.product_category NOT LIKE CONCAT('%', s.supplier_main_products, '%')
        );
        IF v_supplier_product_diversity_count < v_min_supplier_product_diversity THEN
            FOR sup AS
                SELECT s.supplier_id, s.supplier_main_products
                FROM suppliers s
                WHERE s.supplier_main_products IS NOT NULL
                  AND s.supplier_main_products != 'General'
                LIMIT 1
            DO
                INSERT INTO products VALUES (
                    (SELECT MAX(product_id) + 1 FROM products),
                    'Diverse Category Product',
                    (SELECT MIN(product_category) FROM products
                     WHERE product_category NOT LIKE CONCAT('%', sup.supplier_main_products, '%')
                     AND product_category IS NOT NULL),
                    29.99,
                    19.99,
                    sup.supplier_id,
                    'Diverse Contact',
                    'Diverse Role',
                    '123 Diverse St',
                    4,
                    'White',
                    'Medium',
                    0.7,
                    'Supplier-product diversity',
                    3.0,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    true,
                    0.0,
                    0.19
                );
            END FOR;
            SET v_diversity_enforced = true;
        END IF;
    END L0;
END;

-- TAGS: FOREACH, IF, DML, deep-nesting, exception-handler, foreign-customer-logic
-- EXPECTED: Foreign customer inserts, international customer coverage, DML
-- EXECUTES: FOR, IF, nested BEGIN...END, exception handler

DROP TABLE products;

DROP TABLE order_items;

CREATE TEMPORARY VIEW tbl_view AS SELECT * FROM VALUES
  (10, "name1", named_struct("f1", 1, "s2", named_struct("f2", 101, "f3", "a"))),
  (20, "name2", named_struct("f1", 2, "s2", named_struct("f2", 202, "f3", "b"))),
  (30, "name3", named_struct("f1", 3, "s2", named_struct("f2", 303, "f3", "c"))),
  (40, "name4", named_struct("f1", 4, "s2", named_struct("f2", 404, "f3", "d"))),
  (50, "name5", named_struct("f1", 5, "s2", named_struct("f2", 505, "f3", "e"))),
  (60, "name6", named_struct("f1", 6, "s2", named_struct("f2", 606, "f3", "f"))),
  (70, "name7", named_struct("f1", 7, "s2", named_struct("f2", 707, "f3", "g")))
AS tbl_view(id, name, data);

SELECT * EXCEPT (id) FROM tbl_view;

SELECT * EXCEPT (data.f1) FROM tbl_view;

SELECT * EXCEPT (data.f1, data.s2) FROM tbl_view;

-- EXCEPT qualified star
SELECT tbl_view.* EXCEPT (name) FROM tbl_view;

-- EXCEPT qualified columns
SELECT * EXCEPT (ids.id) FROM ids;

SELECT data.s2.* EXCEPT (f2) FROM tbl_view;

-- EXCEPT invalid column
SELECT * EXCEPT(invalid_column) FROM tbl_view;

-- EXCEPT overlapping columns
SELECT * EXCEPT(data.s2, data.s2.f2) FROM tbl_view;

-- star tests in select list
SELECT coalesce(*) FROM v1;

SELECT array(v1.*) FROM v1;

SELECT struct(*) FROM v1;

SELECT c1.* FROM VALUES(named_struct('a', 1, 'b', 2), 10, 20) as t(c1, c2, c3);

SELECT 1 FROM v1 WHERE 4 IN (*);

DECLARE all = 1;

SELECT col1, SUM(col2) FROM t1 GROUP BY ALL ORDER BY ALL;

DROP TEMP VARIABLE a;

create temporary view variant_view as select parse_json('1') as v, id from range(2);

SELECT * FROM map_view UNION SELECT * FROM map_view;

SELECT * FROM variant_view EXCEPT SELECT * FROM variant_view;

-- VARIANT nested inside complex types is also rejected
SELECT DISTINCT struct(v) FROM variant_view;

SHOW CATALOGS;

CREATE DATABASE show_commands_db;

DROP DATABASE show_commands_db;

SHOW COLLATIONS LIKE 'non_existing_collation_pattern';

DROP TABLE tbl;

-- location
CREATE TABLE tbl (a INT, b STRING, c INT) USING parquet
LOCATION '/path/to/table';

-- default column values
CREATE TABLE tbl (a INT DEFAULT 42, b STRING DEFAULT 'abc, def', c INT DEFAULT 42) USING parquet
COMMENT 'This is a comment';

-- float alias real and decimal alias numeric
CREATE TABLE tbl (a REAL, b NUMERIC, c NUMERIC(10), d NUMERIC(10,1)) USING parquet;

SHOW CREATE TABLE view_SPARK_30302 AS SERDE;

-- comment
CREATE VIEW view_SPARK_30302 (aaa COMMENT 'comment with \'quoted text\' for aaa', bbb)
COMMENT 'This is a comment with \'quoted text\' for view'
AS SELECT a, b FROM tbl;

-- View with default collation.
CREATE VIEW view_SPARK_55372 DEFAULT COLLATION UTF8_LCASE
AS SELECT 'a' AS c1, 'b' COLLATE UTF8_BINARY AS c2, 'c' COLLATE UNICODE_CI AS c3;

-- Test data.
CREATE DATABASE showdb;

ALTER TABLE show_t1 ADD PARTITION (c='Us', d=1);

CREATE GLOBAL TEMP VIEW show_t4 AS SELECT 1 as col1;

-- SHOW TABLES WITH wildcard match
SHOW TABLES 'show_t*';

SHOW TABLES IN showdb LIKE 'show_t*';

-- SHOW TABLE EXTENDED ... PARTITION
SHOW TABLE EXTENDED LIKE 'show_t1' PARTITION(c='Us', d=1);

-- Partition specification is not complete.
SHOW TABLE EXTENDED LIKE 'show_t1' PARTITION(c='Us');

-- Clean Up
DROP TABLE show_t1;

DROP VIEW  global_temp.show_t4;

SHOW TBLPROPERTIES tbl;

-- create a view with properties
CREATE VIEW view TBLPROPERTIES('p1'='v1', 'p2'='v2') AS SELECT 1 AS c1;

SHOW TBLPROPERTIES view("p3");

-- Properties for a temporary view should be empty
SHOW TBLPROPERTIES tv;

CREATE VIEW view_1 AS SELECT * FROM tbl;

CREATE TEMPORARY VIEW view_4(e INT) USING parquet;

SHOW VIEWS IN showdb;

SHOW VIEWS LIKE 'view_1*|view_2*';

-- Error when database not exists
SHOW VIEWS IN wrongdb LIKE 'view_*';

DROP DATABASE showdb CASCADE;

CREATE TABLE showcolumn2 (price int, qty int, year int, month int) USING parquet partitioned by (year, month);

-- only table name
SHOW COLUMNS IN showcolumn1;

-- partitioned table
SHOW COLUMNS IN showcolumn2 IN showdb;

-- different database name in table identifier and database name.
-- Raise an error in this case.
SHOW COLUMNS IN showdb.showcolumn1 FROM baddb;

-- error temp view can't be qualified with a database
SHOW COLUMNS IN showcolumn3 FROM showdb;

-- global temp view qualified with database
SHOW COLUMNS IN showcolumn4 FROM global_temp;

DROP VIEW  showcolumn3;

SELECT nullif('x', 'x'), nullif('x', 'y');

-- type coercion
SELECT ifnull(1, 2.1d), ifnull(null, 2.1d);

SELECT nvl2(null, 1, 2.1d), nvl2('n', 1, 2.1d);

SELECT date("2014-04-04"), timestamp(date("2014-04-04"));

SELECT nvl(st.col1, "value"), count(*) FROM from tempView1 GROUP BY nvl(st.col1, "value");

-- Parquet
CREATE TABLE sql_on_files.test_parquet USING PARQUET AS SELECT 1;

SELECT * FROM parquet.`${spark.sql.warehouse.dir}/sql_on_files.db/test_parquet`;

SELECT * FROM orc.``;

DROP TABLE sql_on_files.test_orc;

SELECT * FROM csv.`/file/not/found`;

-- JSON
CREATE TABLE sql_on_files.test_json USING JSON AS SELECT 1;

SELECT * FROM json.`${spark.sql.warehouse.dir}/sql_on_files.db/test_json`;

SELECT * FROM json.`https://raw.githubusercontent.com/apache/spark/refs/heads/master/examples/src/main/resources/employees.json`;

SELECT current_path();

-- Multi-level namespace (3+ parts) is accepted by the grammar. The stored entry
-- is verified at the Scala layer (SetPathSuite) because the session catalog
-- only supports single-part namespaces, so calling current_path() while a
-- multi-level entry is on the path would surface that catalog limitation
-- rather than the PATH grammar property under test here.

SET PATH = DEFAULT_PATH;

-- SYSTEM_PATH composes naturally with CURRENT_SCHEMA to give "system functions
-- plus my working schema".
USE spark_catalog.default;

-- 2.4 PATH keyword (append to live path) --------------------------------------

SET PATH = spark_catalog.default, system.builtin;

SET PATH = current_schema, system.builtin;

SELECT CURRENT_PATH = current_path() AS ansi_form_matches;

-- Case-insensitive duplicate is still flagged.
SET PATH = spark_catalog.DEFAULT, spark_catalog.default;

-- 4.4 current_database vs current_schema cross-alias duplicate ----------------

SET PATH = current_database, current_schema;

CREATE FUNCTION sql_path_routines.pick() RETURNS INT RETURN 7;

-- 5.2 Persistent table function follows PATH ----------------------------------

CREATE FUNCTION sql_path_routines.pick_tvf()
RETURNS TABLE(val INT)
RETURN SELECT 7 AS val;

CREATE FUNCTION sql_path_routines_b.pick() RETURNS INT RETURN 11;

SET PATH = spark_catalog.sql_path_routines_b, spark_catalog.sql_path_routines, system.builtin;

DROP FUNCTION sql_path_routines.pick;

DROP SCHEMA sql_path_routines;

CREATE SCHEMA sql_path_relations_b;

-- 6.1 First-match ordering ----------------------------------------------------

SET PATH = spark_catalog.sql_path_relations_a, spark_catalog.sql_path_relations_b, system.builtin;

-- 6.2 Unqualified miss when schema is not on PATH -----------------------------

SET PATH = spark_catalog.default, system.builtin;

DROP TABLE sql_path_relations_a.tbl;

DROP SCHEMA sql_path_relations_b;

CREATE TABLE sql_path_views_a.frozen_t USING parquet AS SELECT 1 AS id;

CREATE VIEW default.v_path_frozen AS SELECT id FROM frozen_t;

SELECT id FROM default.v_path_frozen AS view_body_uses_frozen_path;

USE spark_catalog.sql_path_views_b;

DROP VIEW default.v_path_frozen;

DROP TABLE sql_path_views_b.frozen_t;

-- ============================================================================
-- 8. SQL function frozen-path behavior
-- ============================================================================

CREATE SCHEMA sql_path_fn_a;

CREATE TABLE sql_path_fn_b.frozen_t USING parquet AS SELECT 20 AS id;

SET PATH = spark_catalog.sql_path_fn_b, system.builtin;

-- 8.2 Table function body resolves via creation-time PATH ---------------------

SET PATH = spark_catalog.sql_path_fn_a, system.builtin;

-- 8.3 current_schema / current_path in function body use invoker context -----

USE spark_catalog.sql_path_fn_a;

-- Like 7.2: current_schema() / current_path() in a SQL function body bind to
-- the INVOKER's context, not the creator's.
SELECT sql_path_fn_a.f_ctx() AS invoker_context;

DROP FUNCTION default.frozen_tvf;

DROP TABLE sql_path_fn_b.frozen_t;

-- ============================================================================
-- 9. DEFAULT_PATH conf (spark.sql.defaultPath)
-- ============================================================================
--
-- The conf's RHS is captured as a raw string by the SQL `SET key = value`
-- form; keywords like `current_schema` and shortcut tokens like `SYSTEM_PATH`
-- must be written WITHOUT backticks so the conf's SET-PATH-grammar validator
-- recognizes them as path tokens rather than 1-part quoted identifiers.

-- 9.1 Explicit SET PATH overrides the conf ------------------------------------

SET spark.sql.defaultPath = system.session, system.builtin;

RESET spark.sql.defaultPath;

SELECT current_path() AS default_path_expands_to_conf;

-- ============================================================================
-- 10. PATH disabled
-- ============================================================================

SET spark.sql.path.enabled = false;

SET spark.sql.ansi.enabled = true;

DECLARE var1 INT = 5;

DROP TEMPORARY VARIABLE var1;

SELECT 'Expect: INT, NULL', typeof(var1), var1;

DECLARE OR REPLACE VARIABLE var1 TIMESTAMP;

-- No support for IF NOT EXISTS
DECLARE VARIABLE IF NOT EXISTS var1 INT;

DECLARE VAR var1 INT;

-- Success
DROP TEMPORARY VARIABLE IF EXISTS var1;

DROP VARIABLE system.session.var1;

SELECT 1 as Expected, var1 as Unqualified, session.var1 AS SchemaQualified, system.session.var1 AS fullyQualified;

DECLARE OR REPLACE VARIABLE session.var1 INT DEFAULT 1;

SET VARIABLE system.session.var1 = 2;

DROP TEMPORARY VARIABLE system.session.var1;

SET VARIABLE title = 'Dropped struct variable -- field access vs qualified name';

DROP TEMPORARY VARIABLE session;

DECLARE OR REPLACE VARIABLE system.sesion.var1 INT;

SELECT ses.var1;

SET VARIABLE ses.var1 = 1;

DECLARE OR REPLACE VARIABLE var1 INT DEFAULT 1;

SELECT true AS Expected, var1 >= 1 AS result;

DECLARE OR REPLACE VARIABLE var1 DEFAULT NULL;

SELECT 'INT, 5' AS Expected, typeof(var1) AS type, var1 AS result;

DECLARE OR REPLACE VARIABLE var1 INT DEFAULT NULL;

SELECT 'true' AS Expected, length(var1) > 0 AS result;

-- No subqueries allowed in DEFAULT expression
DECLARE OR REPLACE VARIABLE var1 INT DEFAULT (SELECT c1 FROM VALUES(1) AS T(c1));

-- Runtime overflow on assignment
DECLARE OR REPLACE VARIABLE var1 SMALLINT DEFAULT 100000;

SET VARIABLE var1 = 7;

SET VARIABLE var1 = (SELECT c1 FROM VALUES(1) AS T(c1) WHERE 1=0);

SET VARIABLE var1 = (SELECT c1 FROM VALUES(1.0E10) AS T(c1));

SET VARIABLE var1 = (SELECT c1 FROM VALUES('hello') AS T(c1));

SET VARIABLE title = 'SET VARIABLE - comma separated target';

SET VARIABLE var1 = 6, var2 = 'world', var3 = pi();

SELECT var1 AS `7`, var2 AS `universe` , var3 as `-1`;

SET VARIABLE var1 = var3, var2 = INTERVAL'5' HOUR, var3 = var1;

DROP TEMPORARY VARIABLE var3;

DECLARE VARIABLE var4, var5, var6 INT DEFAULT CAST(RAND(0) * 10 AS INT);

DECLARE OR REPLACE VARIABLE var1, var2, var3 DOUBLE;

DROP TEMPORARY VARIABLE var4;

DROP TEMPORARY VARIABLE var7;

SET VARIABLE title = 'DECLARE VARIABLE - duplicate names';

SET VARIABLE title = 'SET VARIABLE - row assignment';

SET VARIABLE (var1, var2) = (SELECT c1, c2 FROM VALUES(10, 11) AS T(c1, c2));

SELECT var1 AS `100`, var2 AS `110`, var3 AS `120`;

-- Fail no target
SET VARIABLE () = (SELECT 1);

-- Fail, too many columns
SET VARIABLE (var1, var2, var3) = (SELECT c1, c2, c3, c1 FROM VALUES(100, 110, 120) AS T(c1, c2, c3));

DECLARE OR REPLACE VARIABLE var1 STRING DEFAULT 'default1';

SET VARIABLE var1 = 'hello';

SET VARIABLE var1 = 'hello1';

SET VARIABLE var1 = DEFAULT, var2 = DEFAULT, var3 = DEFAULT;

SET VARIABLE (var1, var2, var3) = (VALUES(DEFAULT, DEFAULT, DEFAULT));

SELECT var1 AS `world`;

SET VARIABLE (var1) = (SELECT DEFAULT FROM VALUES(1),(2),(3) AS T(c1) OFFSET 1);

SET VARIABLE (var1) = (SELECT max(c1) FROM VALUES(DEFAULT) AS T(c1));

SET VARIABLE (var1) =
  (SELECT (SELECT DEFAULT) FROM VALUES('outer-value') AS T(default));

SELECT var1 AS `variable-value`;

DROP TEMPORARY VARIABLE default;

-- Failure
SET VARIABLE var1 = 'Hello' || DEFAULT;

SET VARIABLE (default_int) = (VALUES(DEFAULT + 1));

SET VARIABLE (var1) = (WITH v1(c1) AS (VALUES(1) AS T(c1)) SELECT DEFAULT + 1 FROM VALUES(1),(2),(3) AS T(c1));

SET x = 5;

-- These raise errors: UNSUPPORTED_FEATURE.SET_VARIABLE_IN_SET
SET var1 = 5;

SET vAr1 = 5;

SELECT session.var1 AS `1` FROM VALUES(2) AS T(var1);

VALUES (var1);

SELECT substr('12345', var1, 1);

SELECT 1 FROM VALUES(1) AS T(c1) WHERE c1 IN (var1);

-- TBD usage in body of lambda function

SELECT 1 FROM VALUES(1) AS T(c1) WHERE c1 = var1;

SET VARIABLE title = 'variable references -- prohibited';

DECLARE OR REPLACE VARIABLE var1 STRING DEFAULT 'a INT';

CREATE OR REPLACE TEMPORARY FUNCTION identity_fn(x INT) RETURNS INT RETURN x;

-- Column wins over UDF parameter.
SELECT col_vs_param(42);

CREATE OR REPLACE TEMPORARY FUNCTION paramless_vs_param_date(current_date INT)
RETURNS STRING RETURN typeof(current_date);

-- Parameterless function wins over UDF parameter (current_time): the body returns a
-- time-typed value, vs 'int' if the parameter alias had won.
SELECT paramless_vs_param_time(42);

CREATE OR REPLACE TEMPORARY FUNCTION lca_vs_param(x INT)
RETURNS INT RETURN (SELECT y FROM (SELECT 999 AS x, x + 1 AS y));

-- Outer column wins over UDF parameter.
SELECT outer_vs_param(42);

CREATE OR REPLACE TEMPORARY FUNCTION derived_col_vs_paramless(u STRING)
RETURNS STRING RETURN (SELECT current_user FROM (SELECT u AS current_user));

-- UDF parameter wins over session variable.
SELECT identity_fn(42);

-- Nested UDF only sees innermost scope: inner_fn resolves 'x' from session variable (999),
-- not outer_fn parameter (42).
SELECT outer_fn(42);

DROP TEMPORARY VARIABLE x;

DROP TEMPORARY FUNCTION paramless_vs_param;

DROP TEMPORARY FUNCTION paramless_vs_param_grouping;

DROP TEMPORARY FUNCTION outer_param_pure;

DROP TEMPORARY FUNCTION outer_fn;

-- Expect: 1
SELECT foo1a0();

-- Expect: 1
SELECT foo1a1(1);

-- Expect: 1
SELECT foo1a2(1, 2, 3, 4);

CREATE FUNCTION foo1b1(a INT) RETURNS TABLE (c1 INT) RETURN SELECT 1;

-- Expect (1)
SELECT * FROM foo1b2(1, 2, 3, 4);

-- 1.1.d DEFAULT parameters
-- A NULL default
CREATE OR REPLACE FUNCTION foo1d1(a INT DEFAULT NULL) RETURNS INT RETURN a;

-- Expect 5, 10
SELECT foo1d1(5), foo1d1();

-- An expression that needs a cast
CREATE OR REPLACE FUNCTION foo1d1(a INT DEFAULT '5' || length(substr(current_database(), 1, 1)))
  RETURNS INT RETURN a;

-- Expect 5, 0
SELECT foo1d1(5), foo1d1();

-- Multiple parameters
CREATE OR REPLACE FUNCTION foo1d2(a INT, b INT DEFAULT 7, c INT DEFAULT 8, d INT DEFAULT 9 COMMENT 'test')
  RETURNS STRING RETURN a || ' ' || b || ' ' || c || ' ' || d;

-- Expect error, too many parameters
SELECT foo1d2(1, 2, 3, 4, 5);

-- Temporary function
CREATE OR REPLACE TEMPORARY FUNCTION foo1d3(a INT DEFAULT 7 COMMENT 'hello') RETURNS INT RETURN a;

-- Defaults with SQL UDF
CREATE OR REPLACE FUNCTION foo1d4(a INT, b INT DEFAULT 3) RETURNS INT RETURN a + b;

-- Function invocation with default in SQL UDF
CREATE OR REPLACE FUNCTION foo1d5(a INT, b INT) RETURNS INT RETURN a + foo1d4(b);

-- Expect (5, 7)
SELECT * FROM foo1d6(5);

CREATE FUNCTION foo1e2(x INT, y INT NOT NULL) RETURNS TABLE (x INT) RETURN SELECT 1;

CREATE FUNCTION foo1f2(id BIGINT GENERATED ALWAYS AS IDENTITY) RETURNS BIGINT RETURN id + 1;

-- 1.2 Returns Columns
-- 1.2.a A table function with various numbers of returns columns
-- Expect error: Cannot have an empty RETURNS
CREATE FUNCTION foo2a0() RETURNS TABLE() RETURN SELECT 1;

CREATE FUNCTION foo2a4() RETURNS TABLE(c1 INT, c2 INT, c3 INT, c4 INT) RETURN SELECT 1, 2, 3, 4;

-- Expect failure
CREATE FUNCTION foo2b2() RETURNS TABLE(a INT, b INT, duplicate INT, c INT, d INT, e INT, DUPLICATE INT)
RETURN SELECT 1, 2, 3, 4, 5, 6, 7;

CREATE FUNCTION foo32() RETURNS TABLE(a INT) RETURN SELECT 1, 2;

-- Expect failure
CREATE FUNCTION foo42() RETURNS TABLE(a INT) RETURN 1;

-- 1.5.b No Rows
CREATE FUNCTION foo52() RETURNS INT RETURN (SELECT 1 FROM VALUES(1) WHERE 1 = 0);

SELECT foo6c(1, 2, 3);

-- 1.7 Parameter resolution
CREATE FUNCTION foo7a(a STRING, b STRING, c STRING) RETURNS STRING RETURN
SELECT 'Foo.a: ' || a ||  ' Foo.a: ' || foo7a.a
       || ' T.b: ' ||  b || ' Foo.b: ' || foo7a.b
       || ' T.c: ' || c || ' T.c: ' || t.c FROM VALUES('t.b', 't.c') AS T(b, c);

SELECT * FROM foo7at('Foo.a', 'Foo.b', 'Foo.c');

-- Expect error
SELECT foo9a(5);

SELECT foo9b(126);

-- Short
CREATE FUNCTION foo9c(a SHORT) RETURNS SHORT RETURN CAST(a AS INTEGER) + 1;

SELECT foo9c(32768);

SELECT foo9d(2147483647);

SELECT foo9e(9223372036854775807 - 1);

-- DECIMAL
CREATE FUNCTION foo9f(a DECIMAL( 5, 2 )) RETURNS DECIMAL (5, 2) RETURN CAST(a AS DECIMAL(6, 2)) + 1;

SELECT foo9f(999 + 1);

SELECT foo9g('hello', '7');

SELECT foo9h(123.23, '7');

-- VARCHAR
-- Expect failure: char/varchar type can only be used in the table schema.
CREATE FUNCTION foo9i(a VARCHAR(10), b VARCHAR(10)) RETURNS VARCHAR(12) RETURN a || b;

SELECT foo9j(12345678901, '12');

SELECT foo9l('2020-02-02', INTERVAL '1' YEAR);

-- TIMESTAMP
CREATE FUNCTION foo9m(a TIMESTAMP, b INTERVAL) RETURNS TIMESTAMP RETURN a + b;

SELECT foo9m(TIMESTAMP'2020-02-02 12:15:16.123', INTERVAL '999999' YEAR);

SELECT foo9n(from_json('[1, 2, 3]', 'array<int>'));

SELECT foo9o(from_json('{"hello":1, "world":2}', 'map<string,int>'));

SELECT foo9p(from_json('{1:"hello"}', 'struct<a1:int, a2:string>'));

SELECT foo9q(ARRAY(NAMED_STRUCT('x', 1, 'y', 'hello'), NAMED_STRUCT('x', 2, 'y', 'world')));

SELECT foo9r(ARRAY(MAP('hello', 1), MAP('world', 2)));

CREATE OR REPLACE FUNCTION bar1_10(b INT) RETURNS STRING RETURN foo1_10(TRY_CAST(b AS STRING));

-- Expect: 42
SELECT foo1_11a();

-- Expression return - should infer INT
CREATE OR REPLACE FUNCTION foo1_11c(a INT, b INT) RETURN a + b;

-- Expect: 16.5
SELECT foo1_11d(3.0, 5);

-- Date arithmetic return
CREATE OR REPLACE FUNCTION foo1_11f(d DATE) RETURN d + INTERVAL '1' DAY;

-- Expect: [1, 2, 5]
SELECT foo1_11g(5);

-- Subquery return - scalar
CREATE OR REPLACE FUNCTION foo1_11i(x INT) RETURN (SELECT x * 2);

-- Expect: 'HELLO'
SELECT foo1_11j('hello');

-- 1.11.b Table UDF without TABLE schema - schema inferred from body
-- Simple SELECT with literals
CREATE OR REPLACE FUNCTION foo1_11l() RETURNS TABLE RETURN SELECT 1 as id, 'hello' as name;

-- Expect: (10, 'WORLD')
SELECT * FROM foo1_11m(5, 'world');

-- SELECT with struct columns
CREATE OR REPLACE FUNCTION foo1_11o(id INT, name STRING) RETURNS TABLE RETURN SELECT STRUCT(id, name) as person_info, id + 100 as modified_id;

SELECT foo2_1a(5);

CREATE FUNCTION foo2_1c(a INT, b INT) RETURNS INT RETURN 10 * (a + b) + 100 * (a -b);

SELECT foo2_1d(-5, 6);

CREATE FUNCTION foo2_2b(a INT) RETURNS INT RETURN 1 + (SELECT a);

-- SELECT foo2_2c(5);

-- Expect error: deep correlation is not yet supported
CREATE FUNCTION foo2_2d(a INT) RETURNS INT RETURN 1 + (SELECT (SELECT (SELECT (SELECT a))));

-- SELECT foo2_2f(5);

-- Expect error: correlated scalar subquery must be aggregated.
CREATE FUNCTION foo2_2g(a INT) RETURNS INT RETURN
SELECT a FROM (VALUES 1) AS V(c1)
INTERSECT
SELECT a FROM (VALUES 1) AS V(a);

DROP TABLE IF EXISTS ts;

DROP TABLE IF EXISTS V1;

DROP VIEW IF EXISTS ts;

DROP VIEW IF EXISTS V1;

CREATE VIEW V2(c1, c2) AS VALUES (-1, -2), (-3, -4), (-5, -6);

-- 2.3.3 Different places around an aggregate
SELECT foo2_3(SUM(c1), SUM(c2)), SUM(c1) + SUM(c2), SUM(foo2_3(c1, c2) + foo2_3(c2, c1) - foo2_3(c2, c1))
FROM V1;

-- 2.4.2 built-in functions
CREATE FUNCTION foo2_4b(m MAP<STRING, STRING>, k STRING) RETURNS STRING RETURN
SELECT v || ' ' || v FROM (SELECT upper(m[k]) AS v);

-- 3. Misc
CREATE VIEW t1(c1, c2) AS VALUES (0, 1), (0, 2), (1, 2);

CREATE VIEW ta(x) AS VALUES ARRAY(1, 2, 3);

CREATE FUNCTION foo3_1c(x INT) RETURNS INT RETURN SELECT x;

-- Function body is a uncorrelated scalar subquery.
CREATE FUNCTION foo3_1f() RETURNS INT RETURN SELECT SUM(c2) FROM t2 WHERE c1 = 0;

SELECT x, foo3_1c(x) FROM t1 AS t(x, y);

SELECT c1, foo3_1d(foo3_1c(foo3_1b(c1))) FROM t1;

-- in aggregate
SELECT foo3_1a(MAX(c1), MAX(c2)) FROM t1;

SELECT MAX(foo3_1a(c1, c2)) FROM t1 GROUP BY c1, c2;

SELECT c1, SUM(foo3_1d(c2)) FROM t1 GROUP BY c1;

SELECT foo3_1a(SUM(c1) + rand(0) * 0, SUM(c2)) FROM t1;

SELECT foo3_1c(SUM(c2) + rand(0) * 0) FROM t1 GROUP by c1;

SELECT foo3_1a(foo3_1b(c1), MAX(c2)) FROM t1 GROUP BY c1;

SELECT c1, foo3_1b(c1 + rand(0) * 0) FROM t1 GROUP BY c1;

SELECT c1, c2, foo3_1a(c1, c2) FROM t1 GROUP BY c1, c2;

SELECT COUNT(*) + foo3_1b(c1) + foo3_1b(SUM(c2)) + SUM(foo3_1b(c2)) FROM t1 GROUP BY c1;

-- Expect failure
SELECT c1, COUNT(*), foo3_1b(SUM(c2)) FROM t1 GROUP BY c1 HAVING SUM(foo3_1b(c2)) > 0;

SELECT c1, c2, foo3_1a(c1, c2) FROM t1 GROUP BY c1, c2, 3;

SELECT foo3_1b(SUM(c1)) + (SELECT foo3_1b(SUM(c1))) FROM t1;

SELECT foo3_1b(SUM(c1) + SUM(SUM(c1))) FROM t1;

-- in aggregate, with non-deterministic function input inside aggregate expression
SELECT SUM(foo3_1b(c1 + rand(0) * 0)) FROM t1;

SELECT c1, COUNT(*), foo3_1b(SUM(c2) + foo3_1b(SUM(c2))) FROM t1 GROUP BY c1 HAVING COUNT(*) > 0;

-- in GROUP BY
SELECT SUM(c2) FROM t1 GROUP BY foo3_1b(c1);

-- in HAVING
SELECT c1, SUM(c2) FROM t1 GROUP BY c1 HAVING foo3_1b(SUM(c2)) > 1;

SELECT * FROM t1 JOIN t2 ON foo3_1b(t1.c2) = foo3_1b(t2.c2);

-- in join with non-correlated scalar subquery
SELECT * FROM t1 JOIN t2 ON foo3_1f() > 0;

-- expect error: correlated scalar subquery cannot be used in Join
SELECT * FROM t1 JOIN t2 ON foo3_1g(t1.c1) = 2;

-- in generate: unsupported
SELECT * FROM ta LATERAL VIEW EXPLODE(ARRAY(foo3_1b(x[0]), foo3_1b(x[1]))) AS t;

-- with uncorrelated scalar subquery
SELECT foo3_1b((SELECT SUM(c1) FROM t1));

SELECT foo3_1b((SELECT SUM(c1) FROM t1 WHERE c2 = t2.c2)) FROM t2;

CREATE FUNCTION foo3_1y(x ARRAY<INT>) RETURNS INT RETURN aggregate(x, BIGINT(0), (x, y) -> x + y);

-- with map type
SELECT foo3_1a(x['a'], x['b']) FROM tm;

-- 3.2 Scalar function with complex function body
-- 3.2.a Non-deterministic expression
CREATE FUNCTION foo3_2a() RETURNS INT RETURN FLOOR(RAND() * 6) + 1;

-- 3.2.b IN subqueries
CREATE FUNCTION foo3_2b1(x INT) RETURNS BOOLEAN RETURN x IN (SELECT 1);

SELECT * FROM t1 WHERE foo3_2b2(c1) = 0;

SELECT * FROM t1 WHERE foo3_2b3(c1);

-- Expect error
CREATE FUNCTION foo3_2b5(x INT) RETURNS BOOLEAN RETURN SUM(1) + IF(x IN (SELECT 1), 1, 0);

-- 3.2.c EXISTS subqueries
CREATE FUNCTION foo3_2c1(x INT) RETURNS BOOLEAN RETURN EXISTS(SELECT 1);

SELECT * FROM t1 WHERE foo3_2c2(c1);

-- 3.2.e CTEs
CREATE FUNCTION foo3_2e1(
    occurrences ARRAY<STRUCT<start_time: TIMESTAMP, occurrence_id: STRING>>,
    instance_start_time TIMESTAMP
) RETURNS STRING RETURN
WITH t AS (
    SELECT transform(occurrences, x -> named_struct(
        'diff', abs(unix_millis(x.start_time) - unix_millis(instance_start_time)),
        'id', x.occurrence_id
    )) AS diffs
)
SELECT CASE WHEN occurrences IS NULL OR size(occurrences) = 0
       THEN NULL
       ELSE sort_array(diffs)[0].id END AS id
FROM t;

SET spark.sql.optimizer.scalarSubqueryUseSingleJoin=false;

-- 3.3 Create and invoke function with different SQL configurations
SET spark.sql.ansi.enabled=true;

CREATE TEMPORARY FUNCTION foo3_3b(x INT) RETURNS DOUBLE RETURN 1 / x;

SELECT foo3_3b(0);

CREATE OR REPLACE FUNCTION foo3_3at(x INT) RETURNS TABLE (a DOUBLE) RETURN SELECT 1 / x;

-- Cast inside the UDF should respect the captured SQL configurations
-- Explicit cast
CREATE FUNCTION foo3_3c() RETURNS INT RETURN CAST('a' AS INT);

CREATE FUNCTION foo3_3dt() RETURNS TABLE (a INT) RETURN SELECT 'a' + 1;

SELECT * FROM foo3_3ct();

RESET spark.sql.ansi.enabled;

CREATE FUNCTION foo3_4c(x INT) RETURNS INT RETURN foo3_4b(x);

CREATE FUNCTION foo3_4f(x INT) RETURNS TABLE(b INT) RETURN SELECT * FROM foo3_4e(x);

-- Expect error
CREATE OR REPLACE FUNCTION foo3_4a(x INT) RETURNS INT RETURN foo3_4b(x);

CREATE OR REPLACE FUNCTION foo3_4a(x INT) RETURN FoO3_4b(x);

CREATE OR REPLACE FUNCTION foo3_4e(x INT) RETURNS TABLE RETURN SELECT * FROM fOo3_4F(x);

CREATE TEMPORARY FUNCTION foo3_5a(x INT) RETURNS INT RETURN x;

-- Expect error: permanent function cannot reference temporary function
CREATE FUNCTION foo3_5d(x INT) RETURNS INT RETURN foo3_5a(x);

CREATE FUNCTION foo3_5d(x INT) RETURNS TABLE (a INT) RETURN SELECT a FROM t;

-- Expect error: the same holds for a variable read only inside an IDENTIFIER clause. The analyzed
-- body no longer mentions it (the clause is replaced by the expression built from the evaluated
-- name), so it has to be recorded during analysis to be rejected here.
CREATE FUNCTION foo3_5d(x INT) RETURNS INT
RETURN (SELECT IDENTIFIER(foo3_5_col) FROM VALUES (1) AS T(a));

SELECT foo3_5e(0);

CREATE FUNCTION foo3_5d(x INT) RETURNS TABLE (c1 INT)
RETURN SELECT c1 FROM IDENTIFIER(foo3_5_tbl);

-- With `spark.sql.legacy.allowSessionVariableInPersistedView` set, a persistent function may read
-- the variable through an IDENTIFIER clause, as a persisted view may. The dependency is not
-- persisted, so the function only resolves while the variable exists in the session.
SET spark.sql.legacy.allowSessionVariableInPersistedView=true;

-- A function that calls foo3_5f does not inherit its IDENTIFIER-clause variable: the variable is
-- foo3_5f's own dependency, so creating the caller succeeds without the legacy flag.
CREATE FUNCTION foo3_5g(x INT) RETURNS INT RETURN foo3_5f(x) + 1;

DROP FUNCTION foo3_5f;

-- 3.12 SQL data access routine
-- Scalar functions
CREATE FUNCTION foo3_12a(x INT) RETURNS INT CONTAINS SQL RETURN x;

CREATE FUNCTION foo3_12d(x INT) RETURNS INT CONTAINS SQL RETURN (SELECT COUNT(*) FROM range(0, 3));

CREATE FUNCTION foo3_12f(x INT) RETURNS INT CONTAINS SQL RETURN foo3_12b(x) + 1;

CREATE FUNCTION foo3_12h(x INT) RETURNS TABLE (a INT, b INT) READS SQL DATA RETURN SELECT x, x + 1;

-- Derived SQL data access: READS SQL DATA.
CREATE FUNCTION foo3_12k(x INT) RETURNS TABLE (a INT, b INT) RETURN SELECT c1, c2 FROM t1;

CREATE FUNCTION foo3_12f(x INT) RETURNS TABLE (a INT, b INT) CONTAINS SQL RETURN SELECT * FROM foo3_12h(x);

CREATE FUNCTION foo3_12f(x INT) RETURNS INT CONTAINS SQL RETURN SELECT SUM(c1) FROM tbl;

CREATE FUNCTION foo3_14b() RETURNS TABLE (a INT) RETURN SELECT 1;

-- 4. SQL table functions
CREATE FUNCTION foo4_0() RETURNS TABLE (x INT) RETURN SELECT 1;

CREATE FUNCTION foo4_3(x INT) RETURNS TABLE (a INT, cnt INT) RETURN SELECT c1, COUNT(*) FROM t2 WHERE c1 = x GROUP BY c1;

SELECT * FROM foo4_2(2);

-- named arguments
SELECT * FROM foo4_1(x => 1);

SELECT * FROM t1 JOIN LATERAL foo4_2(c1) ON t1.c2 = foo4_2.a;

SELECT * FROM t1, LATERAL foo4_1(c1 + rand(0) * 0);

-- 4.4 table functions inside scalar subquery
SELECT (SELECT MAX(a) FROM foo4_1(c1)) FROM t1;

DROP FUNCTION IF EXISTS foo1a0;

DROP FUNCTION IF EXISTS foo1b0;

DROP FUNCTION IF EXISTS foo1c1;

DROP FUNCTION IF EXISTS foo1d2;

DROP FUNCTION IF EXISTS foo1d6;

DROP FUNCTION IF EXISTS foo1e3;

DROP FUNCTION IF EXISTS foo1g1;

DROP FUNCTION IF EXISTS foo2a2;

DROP FUNCTION IF EXISTS foo2b2;

DROP FUNCTION IF EXISTS foo32;

DROP FUNCTION IF EXISTS foo42;

DROP FUNCTION IF EXISTS foo6c;

DROP FUNCTION IF EXISTS foo7at;

DROP FUNCTION IF EXISTS foo9c;

DROP FUNCTION IF EXISTS foo9f;

DROP FUNCTION IF EXISTS foo9i;

DROP FUNCTION IF EXISTS foo9m;

DROP FUNCTION IF EXISTS foo9p;

DROP FUNCTION IF EXISTS foo1_10;

DROP FUNCTION IF EXISTS foo1_11b;

DROP FUNCTION IF EXISTS foo1_11e;

DROP FUNCTION IF EXISTS foo1_11h;

DROP FUNCTION IF EXISTS foo1_11k;

DROP FUNCTION IF EXISTS foo1_11n;

DROP FUNCTION IF EXISTS foo2_1b;

DROP FUNCTION IF EXISTS foo2_2a;

DROP FUNCTION IF EXISTS foo2_2d;

DROP FUNCTION IF EXISTS foo2_2g;

DROP FUNCTION IF EXISTS foo2_4b;

DROP FUNCTION IF EXISTS foo3_1c;

DROP FUNCTION IF EXISTS foo3_1f;

DROP FUNCTION IF EXISTS foo3_1y;

DROP FUNCTION IF EXISTS foo3_2b2;

DROP FUNCTION IF EXISTS foo3_2b5;

DROP FUNCTION IF EXISTS foo3_2d1;

DROP FUNCTION IF EXISTS foo3_2e2;

DROP FUNCTION IF EXISTS foo3_14a;

DROP FUNCTION IF EXISTS foo3_3ct;

DROP FUNCTION IF EXISTS foo3_4a;

DROP FUNCTION IF EXISTS foo3_4d;

DROP FUNCTION IF EXISTS foo3_12a;

DROP FUNCTION IF EXISTS foo3_12d;

DROP FUNCTION IF EXISTS foo3_12g;

DROP FUNCTION IF EXISTS foo3_12j;

DROP FUNCTION IF EXISTS foo4_1;

-- Drop temporary functions
DROP TEMPORARY FUNCTION IF EXISTS foo1d3;

DROP TEMPORARY FUNCTION IF EXISTS foo3_5b;

CREATE TABLE geodata(wkb BINARY) USING parquet;

SELECT ST_GeomFromWKB(X'0101000000000000000000f03f0000000000000040', 4326);

SELECT CAST(ST_GeogFromWKB(X'0101000000000000000000f03f0000000000000040') AS GEOMETRY(4326));

SELECT ST_SetSrid(ST_GeomFromWKB(NULL), 3857);

-- Nested in array.
SELECT array(ST_GeomFromWKB(X'0101000000000000000000f03f0000000000000040'));

-- 2. Table-level queries.
SELECT ST_GeomFromWKB(wkb) FROM geodata;

SELECT ST_GeogFromWKB(wkb) FROM geodata;

SELECT array(ST_GeomFromWKB(wkb, 4326)) FROM geodata;

SELECT CAST(X'0101000000000000000000f03f0000000000000040' AS GEOMETRY(4326)) AS result;

-- Casting GEOGRAPHY to GEOMETRY is allowed only if SRIDs match.
SELECT hex(ST_AsBinary(CAST(ST_GeogFromWKB(X'0101000000000000000000f03f0000000000000040') AS GEOMETRY(4326)))) AS result;

-- Casting GEOMETRY(ANY) to GEOMETRY(<srid>) is not allowed.
SELECT CAST(ST_GeomFromWKB(X'0101000000000000000000f03f0000000000000040')::GEOMETRY(ANY) AS GEOMETRY(4326)) AS result;
