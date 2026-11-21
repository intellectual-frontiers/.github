-- Error handling: coordinates out of geographic bounds.
SELECT CAST(ST_GeomFromWKB(X'010100000000000000000069400000000000005940', 4326) AS GEOGRAPHY(4326)) AS result;

-- Map
SELECT typeof(map('a', ST_GeogFromWKB(wkb), 'b', ST_GeogFromWKB(wkb)::GEOGRAPHY(ANY))) FROM geodata;

SELECT typeof(array(named_struct('g1', ST_GeomFromWKB(wkb), 'g2', ST_GeomFromWKB(wkb)::GEOMETRY(ANY)), named_struct('g1', ST_GeomFromWKB(wkb)::GEOMETRY(ANY), 'g2', ST_GeomFromWKB(wkb)))) FROM geodata;

-- NVL
SELECT typeof(nvl(ST_GeogFromWKB(wkb), ST_GeogFromWKB(wkb)::GEOGRAPHY(ANY))) FROM geodata;

SELECT typeof(nvl2(ST_GeomFromWKB(wkb), ST_GeomFromWKB(wkb)::GEOMETRY(ANY), ST_GeomFromWKB(wkb))) FROM geodata;

-- COALESCE
SELECT typeof(coalesce(ST_GeogFromWKB(wkb), ST_GeogFromWKB(wkb)::GEOGRAPHY(ANY))) FROM geodata;

SELECT typeof(IF(wkb IS NOT NULL, ST_GeomFromWKB(wkb)::GEOMETRY(ANY), ST_GeomFromWKB(wkb))) FROM geodata;

---- ST_GeogFromWKB

-- 1. Driver-level queries.
SELECT ST_AsBinary(ST_GeogFromWKB(NULL));

-- 2. Table-level queries.
SELECT COUNT(*) FROM geodata WHERE ST_GeogFromWKB(wkb) IS NULL AND wkb IS NOT NULL;

SELECT hex(ST_AsBinary(ST_GeomFromWKB(X'0101000000000000000000F03F0000000000000040')));

SELECT hex(ST_AsBinary(ST_GeomFromWKB(X'0101000000000000000000F03F0000000000000040', 4326)));

-- Error handling: invalid WKB.
SELECT ST_GeomFromWKB(X'6F');

SELECT COUNT(*) FROM geodata WHERE ST_GeomFromWKB(wkb, 4326) IS NULL AND wkb IS NOT NULL;

-- Error handling: invalid SRID.
SELECT COUNT(*) FROM geodata WHERE ST_GeomFromWKB(wkb, 1);

SELECT hex(ST_AsBinary(ST_GeogFromWKB(X'0101000000000000000000F03F0000000000000040'), 'XDR'));

-- Error handling: invalid endianness.
SELECT ST_AsBinary(ST_GeogFromWKB(X'0101000000000000000000F03F0000000000000040'), '');

-- 2. Table-level queries.
SELECT COUNT(*) FROM geodata WHERE ST_AsBinary(ST_GeogFromWKB(wkb)) <> wkb;

SELECT COUNT(*) FROM geodata WHERE ST_AsBinary(ST_GeomFromWKB(wkb), 'NDR') <> wkb;

SELECT COUNT(*) FROM geodata WHERE ST_AsBinary(ST_GeogFromWKB(wkb), 'ABC') IS NOT NULL;

SELECT ST_Srid(ST_GeogFromWKB(X'0101000000000000000000F03F0000000000000040'));

SELECT COUNT(*) FROM geodata WHERE ST_Srid(ST_GeomFromWKB(wkb)) <> 0;

-- Error handling: invalid SRID.
SELECT ST_Srid(ST_SetSrid(ST_GeogFromWKB(X'0101000000000000000000F03F0000000000000040'), 3857));

SELECT COUNT(*) FROM geodata WHERE ST_Srid(ST_SetSrid(ST_GeomFromWKB(wkb), 3857)) <> 3857;

-- Drop the test table.
DROP TABLE geodata;

DROP TABLE IF EXISTS streaming_sql_golden_multiple_flows_sink;

CREATE TABLE streaming_sql_golden_multiple_flows_intermediate
  (id INT, value STRING) USING parquet;

CREATE FLOW streaming_sql_golden_multiple_flows_upstream AS
INSERT INTO streaming_sql_golden_multiple_flows_intermediate BY NAME
SELECT id, upper(value) AS value
FROM STREAM(streaming_sql_golden_multiple_flows_source);

REFRESH FLOW streaming_sql_golden_multiple_flows_upstream;

INSERT INTO streaming_sql_golden_multiple_flows_source VALUES (3, 'three');

DROP TABLE streaming_sql_golden_multiple_flows_intermediate;

DROP TABLE IF EXISTS streaming_sql_golden_join_customers;

INSERT INTO streaming_sql_golden_join_events
VALUES (1, 10, 25), (2, 20, 40), (3, 99, 15);

CREATE TABLE streaming_sql_golden_join_sink (
  event_id INT, tier STRING, amount INT) USING parquet;

SELECT * FROM streaming_sql_golden_join_sink ORDER BY event_id;

DROP TABLE streaming_sql_golden_join_sink;

CREATE TABLE streaming_sql_golden_available_now_source (id INT, value STRING) USING parquet;

CREATE FLOW streaming_sql_golden_available_now_flow AS
INSERT INTO streaming_sql_golden_available_now_sink BY NAME
SELECT id, upper(value) AS value
FROM STREAM(streaming_sql_golden_available_now_source)
WHERE id >= 2;

INSERT INTO streaming_sql_golden_available_now_source VALUES (4, 'four');

DROP TABLE IF EXISTS streaming_sql_golden_union_left;

CREATE TABLE streaming_sql_golden_union_left (id INT, value STRING) USING parquet;

INSERT INTO streaming_sql_golden_union_right VALUES (3, 'gamma'), (4, 'delta');

REFRESH FLOW streaming_sql_golden_union_flow;

DROP TABLE streaming_sql_golden_union_right;

DROP TABLE IF EXISTS streaming_sql_golden_aggregation_sink;

CREATE TABLE streaming_sql_golden_aggregation_sink (
  window_start TIMESTAMP,
  window_end TIMESTAMP,
  category STRING,
  total BIGINT,
  event_count BIGINT) USING parquet;

SELECT *
FROM streaming_sql_golden_aggregation_sink
ORDER BY window_start, category;

DROP TABLE streaming_sql_golden_aggregation_sink;

CREATE TABLE streaming_sql_golden_farm_fingerprint_source (
  id INT, s STRING, b BINARY) USING parquet;

CREATE FLOW streaming_sql_golden_farm_fingerprint_flow AS
INSERT INTO streaming_sql_golden_farm_fingerprint_sink BY NAME
SELECT id, farm_fingerprint(s) AS fp_s, farm_fingerprint(b) AS fp_b
FROM STREAM(streaming_sql_golden_farm_fingerprint_source);

DROP TABLE streaming_sql_golden_farm_fingerprint_source;

DROP TABLE IF EXISTS streaming_sql_golden_gap_fill_sink;

CREATE TABLE streaming_sql_golden_gap_fill_sink (ts TIMESTAMP_NTZ, v INT) USING parquet;

SELECT * FROM streaming_sql_golden_gap_fill_sink ORDER BY ts;

-- A streaming flow that replaces one column and appends another with |> EVAL.
DROP TABLE IF EXISTS streaming_sql_golden_pipe_eval_source;

INSERT INTO streaming_sql_golden_pipe_eval_source VALUES
  (1, '/API/v1/users'),
  (2, '/home');

REFRESH FLOW streaming_sql_golden_pipe_eval_flow;

DROP TABLE streaming_sql_golden_pipe_eval_sink;

CREATE TABLE reused_exchange_watermark_source (
  event_time TIMESTAMP,
  value INT) USING parquet;

CREATE FLOW reused_exchange_watermark_flow AS
INSERT INTO reused_exchange_watermark_sink BY NAME
WITH aggregated AS (
  SELECT
    window(event_time, '5 seconds') AS window,
    value % 2 AS key,
    count(*) AS event_count
  FROM STREAM(reused_exchange_watermark_source)
    WATERMARK event_time DELAY OF INTERVAL 0 SECONDS
  GROUP BY window(event_time, '5 seconds'), value % 2
)
SELECT 'left' AS branch, window.start AS window_start, key, event_count
FROM aggregated
UNION ALL
SELECT 'right' AS branch, window.start AS window_start, key, event_count
FROM aggregated;

INSERT INTO reused_exchange_watermark_source VALUES
  (TIMESTAMP '2024-01-01 00:00:10', 10);

-- Argument number exception
select concat_ws();

-- replace function
select replace('abc', 'b', '123');

-- position
select position('bar' in 'foobarbar'), position(null, 'foobarbar'), position('aaads', null);

select left("abcd", -2), left("abcd", 0), left("abcd", 'a');

select right("abcd", -2), right("abcd", 0), right("abcd", 'a');

SELECT split('hello', '');

SELECT split('hello', '', 3);

SELECT split('', '');

SELECT split('', '', 1);

-- split_part function
SELECT split_part('11.12.13', '.', 2);

SELECT split_part('11.12.13', '', 1);

SELECT split_part('11.12.13', '.', 4);

SELECT split_part(null, '.', 1);

SELECT substr('Spark SQL', -3);

SELECT substr('Spark SQL' from -3);

SELECT substring('Spark SQL', -3);

SELECT substring('Spark SQL' from -3);

SELECT trim(BOTH 'xyz' FROM 'yxTomxx'), trim('xyz' FROM 'yxTomxx');

SELECT trim(LEADING 'xyz' FROM 'zzzytestxyz');

SELECT trim(TRAILING 'xyz' FROM 'xyztestxxzx');

SELECT btrim(encode(" xyz ", 'utf-8'));

-- Check lpad/rpad with invalid length parameter
SELECT lpad('hi', 'invalid_length');

SELECT hex(lpad(unhex('aabb'), 5));

SELECT hex(lpad(unhex('12345'), 2));

SELECT hex(lpad(unhex('aa'), 6, unhex('1f')));

SELECT hex(lpad(unhex('aa'), 6, unhex('1f2e')));

SELECT hex(lpad(unhex('aabbcc'), 2, unhex('ff')));

SELECT hex(rpad(unhex('aabbcc'), 2));

SELECT hex(rpad(unhex(''), 5, unhex('1f')));

SELECT hex(rpad(unhex(''), 5, unhex('1f2e')));

SELECT hex(rpad(unhex(''), 6, unhex('')));

-- lpad/rpad with mixed STRING and BINARY input
SELECT lpad('abc', 5, x'57');

SELECT rpad(x'57', 5, 'abc');

select encode(scol, ecol) from values('hello', 'WINDOWS-1252') as t(scol, ecol);

select encode(scol, ecol) from values('hello', 'Windows-xxx') as t(scol, ecol);

select encode(scol, ecol) from values('渭城朝雨浥轻尘', 'US-ASCII') as t(scol, ecol);

select encode(scol, ecol) from values('客舍青青柳色新', 'US-ASCII') as t(scol, ecol);

select encode(decode(encode('세계에서 가장 인기 있는 빅데이터 처리 프레임워크인 Spark', 'UTF-16'), 'UTF-16'), 'UTF-8');

-- decode
select decode();

select decode(encode('大千世界', 'utf-32'), 'utf-32');

select decode(2, 1, 'Southlake', 2, 'San Francisco', 3, 'New Jersey', 4, 'Seattle', 'Non domestic');

select decode(null, 6, 'Spark', NULL, 'SQL', 4, 'rocks');

select decode(scol, ecol) from values(X'68656c6c6f', 'Windows-xxx') as t(scol, ecol);

select decode(scol, ecol) from values(X'68656c6c6f', 'WINDOWS-1252') as t(scol, ecol);

select decode(X'E8A5BFE587BAE998B3E585B3E697A0E69585E4BABA', 'US-ASCII');

SELECT CONTAINS('Spark SQL', null);

SELECT CONTAINS('Spark SQL', 'SQL');

SELECT startswith(null, 'Spark');

SELECT endswith('Spark SQL', 'QL');

SELECT endswith('Spark', null);

SELECT contains(x'', x'');

SELECT contains(true, 'ru');

SELECT startswith(x'537061726b2053514c', x'537061726b');

SELECT startswith(x'537061726b2053514c', null);

SELECT endsWith(x'537061726b2053514c', x'');

-- to_number
select to_number('454', '000');

select to_number('$78.12', '$00.00');

select to_number('12,454.8-', '00,000.9MI');

-- to_binary
-- base64 valid
select to_binary('', 'base64');

select to_binary(' ab c=', 'base64');

-- base64 invalid
select to_binary('a', 'base64');

select to_binary('abcd=', 'base64');

-- utf-8
select to_binary(
  '∮ E⋅da = Q,  n → ∞, ∑ f(i) = ∏ g(i), ∀x∈ℝ: ⌈x⌉ = −⌊−x⌋, α ∧ ¬β = ¬(¬α ∨ β)', 'utf-8');

select to_binary('  ', 'utf8');

select to_binary('');

select to_binary('123', 'hex');

select to_binary('01 AF', 'hex');

select to_binary(' ab cdef= = ', replace('HEX0', '0'));

select to_binary(null, 'utf-8');

-- invalid format
select to_binary('abc', 1);

SELECT to_binary('abc', fmtField) FROM fmtTable;

select luhn_check('5500000000000004');

select luhn_check('6011000000000005');

-- spaces in the beginning/middle/end
select luhn_check('4111111111111111    ');

-- space
select luhn_check('');

select luhn_check('ABCDED');

select luhn_check(6011111111111118);

select is_valid_utf8('abc');

select make_valid_utf8('abc');

select validate_utf8('abc');

select try_validate_utf8('abc');

select quote("Don't");

select instr('abcabc', 'b', 3);

select instr('abcabc', 'b', -2);

-- start and occurrence
select instr('abcabc', 'b', 1, 2);

select instr('abcabc', 'b', -1, 1);

select instr('abcabc', 'a', -1, 2);

-- empty substring
select instr('hello', '', 1);

select instr('hello', '', -2);

-- multi-byte characters
select instr('你好世界你好', '你好', 1, 2);

select instr('你好世界你好', '你好', -1);

-- overlapping matches
select instr('aaaa', 'aa', 1, 2);

select instr('aaaa', 'aa', -2, 2);

-- start out of range
select instr('abc', 'b', 10, 1);

select instr('a', 'b', 1, cast(null as int));

select instr('a', 'b', cast(null as int), 2);

select normalize('hello', 'NFD');

select normalize('hello', 'not_a_form');

-- Create a struct with aliases
SELECT STRUCT('alpha' AS A, 'beta' AS B) ST;

-- Prepend a column to a struct
SELECT ID, STRUCT(CAST(ID AS STRING) AS AA, ST.*) NST FROM tbl_x;

-- Select an alias from a struct
SELECT ID, STRUCT(ST.C as STC, ST.D as STD).STD FROM tbl_x;

SELECT STRUCT(1 AS a) AS b, b AS c GROUP BY b;

-- Test for subexpression elimination.












-- Test data.
CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
('{"a":1, "b":"2"}', '[{"a": 1, "b":2}, {"a":2, "b":2}]'), ('{"a":1, "b":"2"}', null), ('{"a":2, "b":"3"}', '[{"a": 3, "b":4}, {"a":4, "b":5}]'), ('{"a":5, "b":"6"}', '[{"a": 6, "b":7}, {"a":8, "b":9}]'), (null, '[{"a": 1, "b":2}, {"a":2, "b":2}]')
AS testData(a, b);

SELECT if(isnull(from_json(a, 'struct<a:int,b:string>').a), from_json(b, 'array<struct<a:int,b:int>>')[0].b + 1, from_json(b, 'array<struct<a:int,b:int>>')[0].b) FROM testData;

-- With non-deterministic expressions.
SELECT from_json(a, 'struct<a:int,b:string>').a + random() > 2, from_json(a, 'struct<a:int,b:string>').b, from_json(b, 'array<struct<a:int,b:int>>')[0].a, from_json(b, 'array<struct<a:int,b:int>>')[0].b + + random() > 2 FROM testData;

-- Tests aggregate expressions in outer query and EXISTS subquery.

-- Test aggregate operator with codegen on and off.





CREATE TEMPORARY VIEW EMP AS SELECT * FROM VALUES
  (100, "emp 1", date "2005-01-01", 100.00D, 10),
  (100, "emp 1", date "2005-01-01", 100.00D, 10),
  (200, "emp 2", date "2003-01-01", 200.00D, 10),
  (300, "emp 3", date "2002-01-01", 300.00D, 20),
  (400, "emp 4", date "2005-01-01", 400.00D, 30),
  (500, "emp 5", date "2001-01-01", 400.00D, NULL),
  (600, "emp 6 - no dept", date "2001-01-01", 400.00D, 100),
  (700, "emp 7", date "2010-01-01", 400.00D, 100),
  (800, "emp 8", date "2016-01-01", 150.00D, 70)
AS EMP(id, emp_name, hiredate, salary, dept_id);

-- Aggregate in outer query block.
-- TC.01.01
SELECT emp.dept_id, 
       avg(salary),
       sum(salary)
FROM   emp 
WHERE  EXISTS (SELECT state 
               FROM   dept 
               WHERE  dept.dept_id = emp.dept_id) 
GROUP  BY dept_id;

-- Nested exists with aggregate expression in inner most query block.
-- TC.01.04
SELECT * 
FROM   bonus 
WHERE  EXISTS (SELECT 1 
               FROM   emp 
               WHERE  emp.emp_name = bonus.emp_name 
                      AND EXISTS (SELECT max(dept.dept_id) 
                                  FROM   dept 
                                  WHERE  emp.dept_id = dept.dept_id 
                                  GROUP  BY dept.dept_id));

-- Not exists with Aggregate expression in outer and subquery block
-- TC.01.07
SELECT count(*) 
FROM   emp 
WHERE  NOT EXISTS (SELECT max(dept.dept_id) a 
                   FROM   dept 
                   WHERE  dept.dept_id = emp.dept_id 
                   GROUP  BY dept.dept_id);

-- SPARK-46468: Aggregate always returns 1 row, so EXISTS is always true.
SELECT tt1.emp_name
FROM EMP as tt1
WHERE EXISTS (
  select max(tt2.id)
  from EMP as tt2
  where tt1.emp_name is null
);

-- Correlated exists subquery with a top-level aggregation
SELECT
  emp.dept_id,
  NOT EXISTS (SELECT dept.dept_id FROM dept)
FROM emp
GROUP BY emp.dept_id ORDER BY emp.dept_id;

-- Tests EXISTS subquery support. Tests basic form
-- of EXISTS subquery (both EXISTS and NOT EXISTS)

CREATE TEMPORARY VIEW EMP(id, emp_name, hiredate, salary, dept_id) AS VALUES
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (200, 'emp 2', DATE '2003-01-01', 200.00, 10),
  (300, 'emp 3', DATE '2002-01-01', 300.00, 20),
  (400, 'emp 4', DATE '2005-01-01', 400.00, 30),
  (500, 'emp 5', DATE '2001-01-01', 400.00, NULL),
  (600, 'emp 6 - no dept', DATE '2001-01-01', 400.00, 100),
  (700, 'emp 7', DATE '2010-01-01', 400.00, 100),
  (800, 'emp 8', DATE '2016-01-01', 150.00, 70);

-- uncorrelated exist query 
-- TC.01.01
SELECT * 
FROM   emp 
WHERE  EXISTS (SELECT 1 
               FROM   dept 
               WHERE  dept.dept_id > 10 
                      AND dept.dept_id < 30);

-- Simple correlation with a local predicate in outer query
-- TC.01.04
SELECT * 
FROM   emp 
WHERE  EXISTS (SELECT dept.dept_name 
               FROM   dept 
               WHERE  emp.dept_id = dept.dept_id) 
       AND emp.id > 200;

-- not exists with correlated predicate + local predicate
-- TC.01.07
SELECT * 
FROM   dept 
WHERE  NOT EXISTS (SELECT emp_name 
                   FROM   emp 
                   WHERE  emp.dept_id = dept.dept_id 
                           OR state = 'NJ');

-- Nested exists
-- TC.01.10
SELECT * 
FROM   bonus 
WHERE  EXISTS (SELECT emp_name 
               FROM   emp 
               WHERE  bonus.emp_name = emp.emp_name 
                      AND EXISTS (SELECT state 
                                  FROM   dept 
                                  WHERE  dept.dept_id = emp.dept_id));

create temporary view t3(c1, c2) as values (0, 3), (1, 4), (2, 5);

select *, exists (select count(*) from t2 where t2.c1 = t1.c1) from t1;

select * from t1 where
 (exists(select count(*) + 1 from t2 where t2.c1 = t1.c1) OR
 not exists(select count(*) - 1 from t2 where t2.c1 = t1.c1)) AND
 exists(select count(*) from t2 where t2.c1 = t1.c2);

set spark.sql.optimizer.decorrelateExistsSubqueryLegacyIncorrectCountHandling.enabled = false;

-- Inner join between two CTEs with correlated condition
-- TC.01.02
WITH emp_cte 
     AS (SELECT * 
         FROM   emp 
         WHERE  id >= 100 
                AND id <= 300), 
     dept_cte 
     AS (SELECT * 
         FROM   dept 
         WHERE  dept_id = 10) 
SELECT * 
FROM   bonus 
WHERE  EXISTS (SELECT * 
               FROM   emp_cte a 
                      JOIN dept_cte b 
                        ON a.dept_id = b.dept_id 
               WHERE  bonus.emp_name = a.emp_name);

-- Using not exists 
-- TC.01.05      
WITH empdept 
     AS (SELECT id, 
                salary, 
                emp_name, 
                dept.dept_id 
         FROM   emp 
                LEFT JOIN dept 
                       ON emp.dept_id = dept.dept_id 
         WHERE  emp.id IN ( 100, 200 )) 
SELECT emp_name, 
       Sum(bonus_amt) 
FROM   bonus 
WHERE  NOT EXISTS (SELECT dept_id, 
                          Max(salary) 
                   FROM   empdept 
                   GROUP  BY dept_id 
                   HAVING count(*) < 1) 
GROUP  BY emp_name;

-- simple having in subquery. 
-- TC.01.01
SELECT dept_id, count(*) 
FROM   emp 
GROUP  BY dept_id 
HAVING EXISTS (SELECT 1 
               FROM   bonus 
               WHERE  bonus_amt < min(emp.salary));

-- more aggregate expressions in projection list of subquery
-- TC.01.04
SELECT * 
FROM   dept 
WHERE  EXISTS (SELECT dept_id, 
                        Count(*) 
                 FROM   emp 
                 GROUP  BY dept_id 
                 HAVING EXISTS (SELECT 1 
                                FROM   bonus 
                                WHERE  bonus_amt > Min(emp.salary)));

CREATE TEMP VIEW y(y1, y2) AS VALUES
    (0, 2),
    (1, 4),
    (4, 11);

-- Correlated NOT EXISTS, REFERENCE LEFT, INNER JOIN
select * from x inner join y on x1 = y1 and not exists (select * from z where z2 = x2) order by x1, x2, y1, y2;

-- Same as above, but for left outer join
select * from x left join y on x1 = y1 and exists (select * from z where z2 = x2) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 and not exists (select * from z where z2 = y2) order by x1, x2, y1, y2;

select * from x right join y on x1 = y1 and exists (select * from z where z2 = y2) order by x1, x2, y1, y2;

-- Same as above, but for left semi join
select * from x left semi join y on x1 = y1 and exists (select * from z where z2 = x2) order by x1, x2;

select * from x left semi join y on x1 = y1 and not exists (select * from z where z2 = y2) order by x1, x2;

select * from x left anti join y on x1 = y1 and exists (select * from z where z2 = y2) order by x1, x2;

select * from x full outer join y on x1 = y1 and not exists (select * from z where z2 = x2) order by x1, x2, y1, y2;

-- OR instead of AND in the join condition
select * from x inner join y on x1 = y1 or exists (select * from z where z1 = x1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 or not exists (select * from z where z1 = x1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 or exists (select * from z where z1 = y1) order by x1, x2, y1, y2;

select * from x inner join y on x1 = y1 and not exists (select * from z where z1 = x1) order by x1, x2, y1, y2;

select * from x inner join y on x1 = y1 and exists (select * from z where z1 = y1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 and not exists (select * from z where z1 = y1) order by x1, x2, y1, y2;

-- Tests EXISTS subquery support. Tests Exists subquery
-- used in Joins (Both when joins occurs in outer and suquery blocks)

-- There are 2 dimensions we want to test
--  1. run with broadcast hash join, sort merge join or shuffle hash join.
--  2. run with whole-stage-codegen, operator codegen or no codegen.









CREATE TEMPORARY VIEW EMP(id, emp_name, hiredate, salary, dept_id) AS VALUES
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (200, 'emp 2', DATE '2003-01-01', 200.00, 10),
  (300, 'emp 3', DATE '2002-01-01', 300.00, 20),
  (400, 'emp 4', DATE '2005-01-01', 400.00, 30),
  (500, 'emp 5', DATE '2001-01-01', 400.00, NULL),
  (600, 'emp 6 - no dept', DATE '2001-01-01', 400.00, 100),
  (700, 'emp 7', DATE '2010-01-01', 400.00, 100),
  (800, 'emp 8', DATE '2016-01-01', 150.00, 70);

-- Left join in outer query block with ON condition 
-- TC.01.03
SELECT * 
FROM   emp 
       LEFT JOIN dept 
              ON emp.dept_id = dept.dept_id 
WHERE  EXISTS (SELECT * 
               FROM   bonus 
               WHERE  bonus.emp_name = emp.emp_name);

-- right join in subquery
-- TC.01.06
SELECT * 
FROM   bonus 
WHERE  EXISTS (SELECT * 
                 FROM   emp 
                        RIGHT JOIN dept 
                                ON dept.dept_id = emp.dept_id 
                 WHERE  bonus.emp_name = emp.emp_name);

-- TC.01.09
SELECT emp_name, 
       Sum(bonus_amt) 
FROM   bonus 
WHERE  NOT EXISTS (SELECT emp_name, 
                          Max(salary) 
                   FROM   emp 
                          JOIN dept 
                            ON dept.dept_id = emp.dept_id 
                   WHERE  bonus.emp_name = emp.emp_name 
                   GROUP  BY emp_name 
                   HAVING Count(*) > 1 
                   ORDER  BY emp_name) 
GROUP  BY emp_name;

-- intersect + not exists 
-- TC.02.03                
SELECT * 
FROM   emp 
WHERE  NOT EXISTS (SELECT * 
                     FROM   dept 
                     WHERE  dept_id < 30 
                     INTERSECT 
                     SELECT * 
                     FROM   dept 
                     WHERE  dept_id >= 30 
                            AND dept_id <= 50);

-- Correlated predicates under set ops - unsupported
SELECT *
FROM   emp
WHERE  EXISTS (SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'CA'
               UNION
               SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'TX');

SELECT *
FROM   emp
WHERE EXISTS (SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'CA'
               INTERSECT DISTINCT
               SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'TX');

SELECT *
FROM   emp
WHERE NOT EXISTS (SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'CA'
               INTERSECT ALL
               SELECT *
               FROM   dept
               WHERE  dept_id = emp.dept_id and state = 'TX');

-- order by in both outer and/or inner query block
-- TC.01.01
SELECT * 
FROM   emp 
WHERE  EXISTS (SELECT dept.dept_id 
               FROM   dept 
               WHERE  emp.dept_id = dept.dept_id 
               ORDER  BY state) 
ORDER  BY hiredate;

SELECT *
FROM   emp
WHERE  EXISTS (SELECT dept.dept_id
               FROM   dept
               WHERE  emp.dept_id = dept.dept_id
               ORDER  BY state
               LIMIT 0)
ORDER  BY hiredate;

-- TC.01.05
SELECT count(*) 
FROM   emp 
WHERE  NOT EXISTS (SELECT max(dept.dept_id) a 
                   FROM   dept 
                   WHERE  dept.dept_id = emp.dept_id 
                   GROUP  BY dept_id 
                   ORDER  BY dept_id);

-- limit in the exists subquery block.
-- TC.02.01
SELECT * 
FROM   emp 
WHERE  EXISTS (SELECT dept.dept_name 
               FROM   dept 
               WHERE  dept.dept_id > 10 
               LIMIT  1);

-- limit in the not exists subquery block with aggregates.
-- TC.02.04
SELECT * 
FROM   emp 
WHERE  NOT EXISTS (SELECT max(dept.dept_id) 
                   FROM   dept 
                   WHERE  dept.dept_id > 100 
                   GROUP  BY state 
                   LIMIT  1);

SELECT *
FROM   emp
WHERE  EXISTS (SELECT dept.dept_name
               FROM   dept
               WHERE  dept.dept_id > emp.dept_id
               LIMIT  1);

-- SPARK-46526: LIMIT over correlated predicate that references only the outer table.
SELECT *
FROM   emp
WHERE  EXISTS (SELECT max(dept.dept_id)
               FROM   dept
               WHERE  emp.salary > 200
               LIMIT  1);

-- limit and offset in the not exists subquery block with aggregates.
-- TC.03.04
SELECT *
FROM   emp
WHERE  NOT EXISTS (SELECT max(dept.dept_id)
                   FROM   dept
                   WHERE  dept.dept_id > 100
                   GROUP  BY state
                   LIMIT  1
                   OFFSET 2);

-- offset in the exists subquery block with aggregate.
-- TC.04.02
SELECT *
FROM   emp
WHERE  EXISTS (SELECT max(dept.dept_id)
               FROM   dept
               GROUP  BY state
               OFFSET 2);

-- Tests EXISTS subquery support where the subquery is used outside the WHERE clause.

CREATE TEMPORARY VIEW EMP(id, emp_name, hiredate, salary, dept_id) AS VALUES
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (100, 'emp 1', DATE '2005-01-01', 100.00, 10),
  (200, 'emp 2', DATE '2003-01-01', 200.00, 10),
  (300, 'emp 3', DATE '2002-01-01', 300.00, 20),
  (400, 'emp 4', DATE '2005-01-01', 400.00, 30),
  (500, 'emp 5', DATE '2001-01-01', 400.00, NULL),
  (600, 'emp 6 - no dept', DATE '2001-01-01', 400.00, 100),
  (700, 'emp 7', DATE '2010-01-01', 400.00, 100),
  (800, 'emp 8', DATE '2016-01-01', 150.00, 70);

-- uncorrelated exist in aggregate filter
-- TC.01.03
SELECT
  sum(salary),
  sum(salary) FILTER (WHERE EXISTS (SELECT 1
                                    FROM   dept
                                    WHERE  dept.dept_id > 10
                                      AND dept.dept_id < 30))
FROM   emp;

-- correlated exist in DISTINCT aggregate filter
-- TC.01.06
SELECT
    sum(DISTINCT salary),
    count(DISTINCT hiredate) FILTER (WHERE EXISTS (SELECT 1
                                    FROM   dept
                                    WHERE  emp.dept_id = dept.dept_id))
FROM   emp;

-- uncorrelated exist in aggregate function
-- TC.01.09
SELECT
    count(CASE WHEN EXISTS (SELECT 1
                            FROM   dept
                            WHERE  dept.dept_id > 10
                              AND dept.dept_id < 30) THEN 1 END),
    sum(CASE WHEN EXISTS (SELECT 1
                          FROM   dept
                          WHERE  dept.dept_id > 10
                            AND dept.dept_id < 30) THEN salary END)
FROM   emp;

-- correlated exist in window
-- TC.01.12
SELECT
    emp_name,
    sum(salary) OVER (PARTITION BY EXISTS (SELECT 1
                                           FROM   dept
                                           WHERE  emp.dept_id = dept.dept_id))
FROM   emp;

-- all records from emp including the null dept_id 
-- TC.02.02
SELECT * 
FROM   emp 
WHERE  EXISTS (SELECT dept.dept_name 
               FROM   dept 
               WHERE  emp.dept_id = dept.dept_id) 
        OR emp.dept_id IS NULL;

-- not exists and in predicate within AND
-- TC.02.05
SELECT * FROM bonus WHERE NOT EXISTS 
( 
       SELECT * 
       FROM   emp 
       WHERE  emp.emp_name = emp_name 
       AND    bonus_amt > emp.salary) 
AND 
emp_name IN 
( 
       SELECT emp_name 
       FROM   emp 
       WHERE  bonus_amt < emp.salary);

create temporary view struct_tab as select struct(col1 as a, col2 as b) as record from
 values (1, 1), (1, 2), (2, 1), (2, 2);

-- Aliasing is needed as a workaround for SPARK-24443
select count(*) from struct_tab where record in
  (select (a2 as a, b2 as b) from tab_b);

select *, c1 in (select count(*) + 1 from t2 where t2.c1 = t1.c1)
from t1;

select * from t1 where
 (c1 in (select count(*) + 1 from t2 where t2.c1 = t1.c1) OR
 c2 in (select count(*) - 1 from t2 where t2.c1 = t1.c1)) AND
 c1 NOT in (select count(*) from t2 where t2.c1 = t1.c2);

select * from t1 where c1 in (select count(*) from t1 join t3 using (c1) where t3.c1 = t1.c2);

create temporary view t2(t2a, t2b, t2c, t2d, t2e, t2f, t2g, t2h, t2i) as values
  ('t2a', 6, 12, 14, 15.0, 20.0, 2000.0, timestamp '2014-04-04 01:01:00.000', date '2014-04-04'),
  ('t1b', 10, 12, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('t1b', 8, 16, 119, 17.0, 25.0, 2600.0, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('t1c', 12, 16, 219, 17.0, 25.0, 2600.0, timestamp '2016-05-04 01:01:00.000', date '2016-05-04'),
  ('t1b', null, 16, 319, 17.0, 25.0, 2600.0, timestamp '2017-05-04 01:01:00.000', null),
  ('t2e', 8, null, 419, 17.0, 25.0, 2600.0, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ('t1f', 19, null, 519, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('t1b', 10, 12, 19, 17.0, 25.0, 2600.0, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ('t1b', 8, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('t1c', 12, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-08-04 01:01:00.000', date '2014-08-05'),
  ('t1e', 8, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-09-04 01:01:00.000', date '2014-09-04'),
  ('t1f', 19, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-10-04 01:01:00.000', date '2014-10-04'),
  ('t1b', null, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', null);

-- TC 01.02
SELECT t1a,
       Max(t1b)
FROM   t1
WHERE  t1b IN (SELECT t2b
               FROM   t2
               WHERE  t1a = t2a)
GROUP  BY t1a,
          t1d;

-- TC 01.05
SELECT t1a,
       Sum(DISTINCT( t1b ))
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t1a = t2a)
       AND t1c IN (SELECT t3c
                   FROM   t3
                   WHERE  t1a = t3a)
GROUP  BY t1a,
          t1c;

-- TC 01.08
SELECT *
FROM   (SELECT t2a,
               t2b
        FROM   t2
        WHERE  t2a IN (SELECT t1a
                       FROM   t1
                       WHERE  t1b = t2b)
        GROUP  BY t2a,
                  t2b) t2;

-- TC 01.11
SELECT t1a,
       t1b
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t2a IN (SELECT Min(t3a)
                              FROM   t3
                              WHERE  t3a = t2a
                              GROUP  BY t3b)
               GROUP  BY t2c);

-- TC 01.14
SELECT t1a,
       Min(t1b)
FROM   t1
WHERE  t1c IN (SELECT Min(t2c)
               FROM   t2
               WHERE  t2b = t1b
               GROUP  BY t2a)
       AND t1d IN (SELECT t3d
                   FROM   t3
                   WHERE  t1c = t3c
                   GROUP  BY t3d)
GROUP  BY t1a;

-- Window functions are not supported in IN subqueries yet
select t1a
from t1
where t1f IN (SELECT RANK() OVER (partition by t3c  order by t2b) as s
                             FROM t2, t3 where t2.t2c = t3.t3c and t2.t2a < t1.t1a);

-- Derived table from subquery
SELECT
    agg_results.t1a,
    COUNT(*)
    FROM (SELECT t1.t1a FROM t1 WHERE t1.t1a IN (SELECT t2a FROM t2)) AS agg_results
GROUP BY agg_results.t1a ORDER BY agg_results.t1a;

-- CASE statement with an in-subquery inside an agg function, without group-by
SELECT
  SUM(CASE
    WHEN t1.t1c IN (SELECT t2c FROM t2) THEN 10
    ELSE -10
  END) AS v1,
  count(t1.t1c) as ct
FROM t1;

create temporary view t2(t2a, t2b, t2c, t2d, t2e, t2f, t2g, t2h, t2i) as values
  ('val2a', 6, 12, 14, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:01:00.000', date '2014-04-04'),
  ('val1b', 10, 12, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1b', 8, 16, 119, 17.0, 25.0, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1c', 12, 16, 219, 17.0, 25.0, 26E2, timestamp '2016-05-04 01:01:00.000', date '2016-05-04'),
  ('val1b', null, 16, 319, 17.0, 25.0, 26E2, timestamp '2017-05-04 01:01:00.000', null),
  ('val2e', 8, null, 419, 17.0, 25.0, 26E2, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ('val1f', 19, null, 519, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1b', 10, 12, 19, 17.0, 25.0, 26E2, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 12, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-05'),
  ('val1e', 8, null, 19, 17.0, 25.0, 26E2, timestamp '2014-09-04 01:01:00.000', date '2014-09-04'),
  ('val1f', 19, null, 19, 17.0, 25.0, 26E2, timestamp '2014-10-04 01:01:00.000', date '2014-10-04'),
  ('val1b', null, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', null);

-- TC 01.02
SELECT t1a,
       t1b,
       t1c
FROM   t1
WHERE  t1b IN (SELECT Min(t2b)
               FROM   t2
               WHERE  t1a = t2a
               GROUP  BY t2b
               HAVING t2b > 1);

-- BOTH
-- TC 01.05
SELECT Count(DISTINCT( t1a )),
       t1b
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t1a = t2a
               GROUP BY t2c
               HAVING t2c > 10)
GROUP  BY t1b
HAVING t1b >= 8;

-- TC 01.08
SELECT t1a,
       t1b
FROM   t1
WHERE  t1d NOT IN (SELECT t2d
                   FROM   t2
                   WHERE  t1a = t2a
                   GROUP BY t2c, t2d
                   HAVING t2c > 8)
GROUP  BY t1a, t1b
HAVING t1b < 10;

create temporary view t2 as select * from values
  ("val2a", 6S, 12, 14L, float(15), 20D, 20E2, timestamp '2014-04-04 01:01:00.000', date '2014-04-04'),
  ("val1b", 10S, 12, 19L, float(17), 25D, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ("val1b", 8S, 16, 119L, float(17), 25D, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ("val1c", 12S, 16, 219L, float(17), 25D, 26E2, timestamp '2016-05-04 01:01:00.000', date '2016-05-04'),
  ("val1b", null, 16, 319L, float(17), 25D, 26E2, timestamp '2017-05-04 01:01:00.000', null),
  ("val2e", 8S, null, 419L, float(17), 25D, 26E2, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ("val1f", 19S, null, 519L, float(17), 25D, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ("val1b", 10S, 12, 19L, float(17), 25D, 26E2, timestamp '2014-06-04 01:01:00.000', date '2014-06-04'),
  ("val1b", 8S, 16, 19L, float(17), 25D, 26E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ("val1c", 12S, 16, 19L, float(17), 25D, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-05'),
  ("val1e", 8S, null, 19L, float(17), 25D, 26E2, timestamp '2014-09-04 01:01:00.000', date '2014-09-04'),
  ("val1f", 19S, null, 19L, float(17), 25D, 26E2, timestamp '2014-10-04 01:01:00.000', date '2014-10-04'),
  ("val1b", null, 16, 19L, float(17), 25D, 26E2, timestamp '2014-05-04 01:01:00.000', null)
  as t2(t2a, t2b, t2c, t2d, t2e, t2f, t2g, t2h, t2i);

create temporary view s2 as select * from values
    (1), (3), (4), (6), (9)
  as s2(id);

-- TC 01.02
SELECT    Count(DISTINCT(t1a)),
          t1b,
          t3a,
          t3b,
          t3c
FROM      t1 natural left JOIN t3
WHERE     t1a IN
          (
                 SELECT t2a
                 FROM   t2
                 WHERE t1d = t2d)
AND       t1b > t3b
GROUP BY  t1a,
          t1b,
          t3a,
          t3b,
          t3c
ORDER BY  t1a DESC, t3b DESC, t3c ASC;

-- TC 01.05
SELECT     Count(DISTINCT(t1a)),
           t1b
FROM       t1 RIGHT JOIN t3
where      t1a IN
           (
                  SELECT t2a
                  FROM   t2
                  WHERE  t2h > t3h)
AND        t3a IN
           (
                  SELECT t2a
                  FROM   t2
                  WHERE  t2c > t3c)
AND        t1h >= t3h
GROUP BY   t1a,
           t1b
HAVING     t1b > 8
ORDER BY   t1a;

-- different JOIN in the subquery
-- TC 01.08
SELECT   Count(DISTINCT(t1a)),
         t1b
FROM     t1
WHERE    t1a IN
         (
                    SELECT     t2a
                    FROM       t2
                    JOIN t1
                    WHERE      t2b <> t1b)
AND      t1h IN
         (
                    SELECT     t2h
                    FROM       t2
                    RIGHT JOIN t3
                    where      t2b = t3b)
GROUP BY t1b
HAVING t1b > 8;

-- TC 01.11
SELECT    t1a,
          t1b,
          t1c,
          count(distinct(t2a)),
          t2b,
          t2c
FROM      t1
FULL JOIN t2  on t1a = t2a
RIGHT JOIN t3 on t1a = t3a
where     t1a IN
          (
                 SELECT t2a
                 FROM   t2 INNER
                 JOIN   t3
                 ON     t2b < t3b
                 WHERE  t2c IN
                        (
                               SELECT t1c
                               FROM   t1
                               WHERE  t1a = t2a))
and t1a = t2a
Group By t1a, t1b, t1c, t2a, t2b, t2c
HAVING t2c IS NOT NULL
ORDER By t2b DESC nulls last;

-- IN with Subquery ON INNER JOIN
SELECT s1.id FROM s1
JOIN s2 ON s1.id = s2.id
AND s1.id IN (SELECT id FROM s3);

-- IN with Subquery ON LEFT OUTER JOIN
SELECT s1.id, s2.id as id2 FROM s1
LEFT OUTER JOIN s2
ON s1.id = s2.id
AND s1.id IN (SELECT id FROM s3);

-- NOT IN with Subquery ON INNER JOIN
SELECT s1.id FROM s1
JOIN s2 ON s1.id = s2.id
AND s1.id NOT IN (SELECT id FROM s3);

-- NOT IN with Subquery ON LEFT OUTER JOIN
SELECT s1.id, s2.id AS id2 FROM s1
LEFT OUTER JOIN s2
ON s1.id = s2.id
AND s1.id NOT IN (SELECT id FROM s3);

-- SPARK-58481: NOT IN subquery with NULL in result and non-nullable child on FULL OUTER JOIN.
-- 5 NOT IN (99, NULL) evaluates to UNKNOWN; a join condition that is not TRUE matches no rows,
-- so FULL OUTER JOIN must emit null-padded rows for every row from each side (5+5=10 rows).
create temporary view s4 as select * from values
    (99), (cast(null as int))
  as s4(id);

DROP VIEW s1;

-- A test suite for IN LIMIT in parent side, subquery, and both predicate subquery
-- It includes correlated cases.





create temporary view t1 as select * from values
  ("val1a", 6S, 8, 10L, float(15.0), 20D, 20E2BD, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ("val1b", 8S, 16, 19L, float(17.0), 25D, 26E2BD, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ("val1a", 16S, 12, 21L, float(15.0), 20D, 20E2BD, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ("val1a", 16S, 12, 10L, float(15.0), 20D, 20E2BD, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ("val1c", 8S, 16, 19L, float(17.0), 25D, 26E2BD, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ("val1d", null, 16, 22L, float(17.0), 25D, 26E2BD, timestamp '2014-06-04 01:01:00.000', null),
  ("val1d", null, 16, 19L, float(17.0), 25D, 26E2BD, timestamp '2014-07-04 01:02:00.001', null),
  ("val1e", 10S, null, 25L, float(17.0), 25D, 26E2BD, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ("val1e", 10S, null, 19L, float(17.0), 25D, 26E2BD, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ("val1d", 10S, null, 12L, float(17.0), 25D, 26E2BD, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ("val1a", 6S, 8, 10L, float(15.0), 20D, 20E2BD, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ("val1e", 10S, null, 19L, float(17.0), 25D, 26E2BD, timestamp '2014-05-04 01:01:00.000', date '2014-05-04')
  as t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i);

-- correlated IN subquery
-- LIMIT in parent side
-- TC 01.01
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE  t1d = t2d)
LIMIT  2;

-- correlated IN subquery
-- LIMIT with OFFSET on both parent and subquery sides
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE  t1d = t2d
               ORDER BY t2a
               LIMIT 10
               OFFSET 2)
LIMIT  2
OFFSET 1;

-- TC 01.02
SELECT *
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t2b >= 8
               ORDER  BY t2c NULLS LAST
               LIMIT  2)
LIMIT 4;

-- LIMIT with NOT IN
-- TC 01.04
SELECT *
FROM   t1
WHERE  t1b NOT IN (SELECT t2b
                   FROM   t2
                   WHERE  t2b > 6
                   ORDER  BY t2b
                   LIMIT  2);

-- LIMIT and OFFSET in parent side
-- TC 02.01
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE  t1d = t2d)
LIMIT  2
OFFSET 2;

-- TC 02.03
SELECT Count(DISTINCT( t1a )),
       t1b
FROM   t1
WHERE  t1d IN (SELECT t2d
               FROM   t2
               ORDER  BY t2c, t2d
               LIMIT 2)
GROUP  BY t1b
ORDER  BY t1b DESC NULLS FIRST
LIMIT  1
OFFSET 1;

SELECT *
FROM   t1
WHERE  t1b NOT IN (SELECT t2b
                   FROM   t2
                   WHERE  t2b = t1b
                   LIMIT  2
                   OFFSET 2);

-- OFFSET in parent side
-- TC 03.01
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE  t1d = t2d)
OFFSET 2;

SELECT *
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t2b < t1b
               ORDER BY t2c
               OFFSET 2)
OFFSET 1;

-- OFFSET with NOT IN correlated
SELECT count(*)
FROM   t1
WHERE  t1b NOT IN (SELECT t2b
                   FROM   t2
                   WHERE  t2b < t1b
                   OFFSET 2);

SELECT COUNT(DISTINCT(t1a))
FROM t1
WHERE t1d IN (SELECT MAX(t2d)
              FROM   t2
              WHERE t1a IS NOT NULL
              LIMIT 10);

-- LIMIT is not supported in correlated IN, unless the DECORRELATE_EXISTS_AND_IN_SUBQUERIES
-- is enabled.
SELECT *
FROM   t1
WHERE  t1b NOT IN (SELECT t2b
                   FROM   t2
                   WHERE  t2b = t1b
                   LIMIT  2
                   OFFSET 2);

-- correlated IN subquery
-- TC 01.01
SELECT t1a,
       t1b,
       t1h
FROM   t1
WHERE  ( t1a, t1h ) NOT IN (SELECT t2a,
                                   t2h
                            FROM   t2
                            WHERE  t2a = t1a
                            ORDER  BY t2a)
AND t1a = 'val1a';

-- TC 01.04
SELECT t2a
FROM   (SELECT t2a
        FROM   t2
        WHERE  ( t2a, t2b ) IN (SELECT t1a,
                                       t1b
                                FROM   t1)
        UNION ALL
        SELECT t2a
        FROM   t2
        WHERE  ( t2a, t2b ) IN (SELECT t1a,
                                       t1b
                                FROM   t1)
        UNION DISTINCT
        SELECT t2a
        FROM   t2
        WHERE  ( t2a, t2b ) IN (SELECT t3a,
                                       t3b
                                FROM   t3)) AS t4;

create temp view v_empty (e) as select 1 where false;

create table t2(d int) using json;

set spark.sql.legacy.nullInEmptyListBehavior = false;

select c, c not in (select e from t_empty) from t;

select null in (select e from v_empty);

-- IN subquery which is not rewritten to join - here we use IN in the ON condition because that is a case that doesn't get rewritten to join in RewritePredicateSubquery, so we can observe the execution behavior of InSubquery directly
-- Correct results: column t2.d should be NULL because the ON condition is always false
select * from t left join t2 on (t.c in (select e from t_empty)) is null;

-- IN subquery which IS rewritten to join
select * from t left join t2 on (t.c in (select e from t_empty)) is null;

reset spark.sql.legacy.nullInEmptyListBehavior;

-- SPARK-43413: Tests for IN subquery nullability


create temp view t0 as select 1 as a_nonnullable;

select * from t0 where a_nonnullable in (select b_nullable from t1);

select * from t0 where (a_nonnullable not in (select b_nullable from t1)) <=> true;

-- A test suite for ORDER BY in parent side, subquery, and both predicate subquery
-- It includes correlated cases.


-- Test sort operator with codegen on and off.








create temporary view t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i) as values
  ('val1a', 6, 8, 10, 15.0, 20.0, 2000.0, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16, 12, 21, 15.0, 20.0, 2000.0, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16, 12, 10, 15.0, 20.0, 2000.0, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22, 17.0, 25.0, 2600.0, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10, null, 25, 17.0, 25.0, 2600.0, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10, null, 12, 17.0, 25.0, 2600.0, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6, 8, 10, 15.0, 20.0, 2000.0, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04');

-- correlated IN subquery
-- ORDER BY in parent side
-- TC 01.01
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2)
ORDER  BY t1a;

-- TC 01.04
SELECT Count(DISTINCT( t1a ))
FROM   t1
WHERE  t1b IN (SELECT t2b
               FROM   t2
               WHERE  t1a = t2a)
ORDER  BY Count(DISTINCT( t1a ));

-- TC 01.07
SELECT t1a,
       t1b,
       t1h
FROM   t1
WHERE  t1c IN (SELECT t2c
               FROM   t2
               WHERE  t1a = t2a
               ORDER  BY t2b DESC nulls first)
        OR t1h IN (SELECT t2h
                   FROM   t2
                   WHERE  t1h > t2h)
ORDER  BY t1h DESC nulls last;

-- TC 01.10
SELECT *
FROM   t1
WHERE  t1a NOT IN (SELECT t2a
                   FROM   t2
                   ORDER  BY t2a DESC nulls first)
       and t1c IN (SELECT t2c
                   FROM   t2
                   ORDER  BY t2b DESC nulls last)
ORDER  BY t1c DESC nulls last;

-- GROUP BY and ORDER BY with NOT IN
-- TC 01.13
SELECT *
FROM   t1
WHERE  t1b NOT IN (SELECT Min(t2b)
                   FROM   t2
                   GROUP  BY t2a
                   ORDER  BY t2a);

-- A test suite for set-operations in parent side, subquery, and both predicate subquery
-- It includes correlated cases.



create temporary view t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i) as values
  ('val1a', 6, 8, 10, 15.0, 20.0, 2000.0, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16, 12, 21, 15.0, 20.0, 2000.0, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16, 12, 10, 15.0, 20.0, 2000.0, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22, 17.0, 25.0, 2600.0, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19, 17.0, 25.0, 2600.0, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10, null, 25, 17.0, 25.0, 2600.0, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10, null, 12, 17.0, 25.0, 2600.0, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6, 8, 10, 15.0, 20.0, 2000.0, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 2600.0, timestamp '2014-05-04 01:01:00.000', date '2014-05-04');

-- TC 01.03
SELECT t2a,
       t2b,
       t2c,
       Min(t2d)
FROM   t2
WHERE  t2a IN (SELECT t1a
               FROM   t1
               WHERE  t1b = t2b)
GROUP BY t2a, t2b, t2c
UNION ALL
SELECT t2a,
       t2b,
       t2c,
       Max(t2d)
FROM   t2
WHERE  t2a IN (SELECT t1a
               FROM   t1
               WHERE  t2c = t1c)
GROUP BY t2a, t2b, t2c
UNION
SELECT t3a,
       t3b,
       t3c,
       Min(t3d)
FROM   t3
WHERE  t3a IN (SELECT t2a
               FROM   t2
               WHERE  t3c = t2c)
GROUP BY t3a, t3b, t3c
UNION DISTINCT
SELECT t1a,
       t1b,
       t1c,
       Max(t1d)
FROM   t1
WHERE  t1a IN (SELECT t3a
               FROM   t3
               WHERE  t3d = t1d)
GROUP BY t1a, t1b, t1c;

-- TC 01.06
SELECT t2a,
       t2b,
       t2c,
       t2d
FROM   t2
WHERE  t2a IN (SELECT t1a
               FROM   t1
               WHERE  t1b = t2b AND
                      t1d < t2d)
INTERSECT
SELECT t2a,
       t2b,
       t2c,
       t2d
FROM   t2
WHERE  t2b IN (SELECT Max(t1b)
               FROM   t1
               WHERE  t2c = t1c)
EXCEPT
SELECT t2a,
       t2b,
       t2c,
       t2d
FROM   t2
WHERE  t2d IN (SELECT Min(t3d)
               FROM   t3
               WHERE  t2c = t3c)
UNION ALL
SELECT t2a,
       t2b,
       t2c,
       t2d
FROM   t2
WHERE  t2c IN (SELECT Max(t1c)
               FROM   t1
               WHERE t1d = t2d);

-- TC 01.09
SELECT t1a,
       t1b,
       t1c
FROM   t1
WHERE  t1h IN (SELECT t2h
               FROM   (SELECT t2h
                       FROM   t2
                       EXCEPT
                       SELECT t3h
                       FROM   t3) AS t3)
ORDER BY t1b DESC NULLs first, t1c  DESC NULLs last;

-- UNION, UNION ALL, UNION DISTINCT, INTERSECT and EXCEPT for NOT IN
-- TC 01.12
SELECT t2a,
       t2b,
       t2c,
       t2i
FROM   (SELECT *
        FROM   t2
        WHERE  t2a NOT IN (SELECT t1a
                           FROM   t1
                           UNION
                           SELECT t3a
                           FROM   t3)
        UNION ALL
        SELECT *
        FROM   t2
        WHERE  t2a NOT IN (SELECT t1a
                           FROM   t1
                           INTERSECT
                           SELECT t2a
                           FROM   t2)) AS t3
WHERE  t3.t2a NOT IN (SELECT t1a
                      FROM   t1
                      INTERSECT
                      SELECT t2a
                      FROM   t2)
       AND t2c IS NOT NULL
ORDER  BY t2a;

SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE t2b = t1b
               UNION DISTINCT
               SELECT t3a
               FROM   t3);

SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2
               WHERE t2b = t1b
               EXCEPT ALL
               SELECT t3a
               FROM   t3);

SELECT *
FROM   t1
WHERE  t1a NOT IN (SELECT t2a
               FROM   t2
               WHERE t2b = t1b
               UNION DISTINCT
               SELECT t3a
               FROM   t3);

SELECT *
FROM   t1
WHERE  t1a NOT IN (SELECT t2a
               FROM   t2
               WHERE t2b = t1b
               EXCEPT ALL
               SELECT t3a
               FROM   t3);

--Correlated IN, REFERENCE LEFT, INNER JOIN
select * from x inner join y on x1 = y1 and x2 IN (select z1 from z where z2 = x2) order by x1, x2, y1, y2;

--Correlated NOT IN, REFERENCE RIGHT, INNER JOIN
select * from x inner join y on x1 = y1 and y2 not IN (select z1 from z where z2 = y2) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 and y2 IN (select z1 from z where z2 = y2) order by x1, x2, y1, y2;

select * from x right join y on x1 = y1 and x2 not IN (select z1 from z where z2 = x2) order by x1, x2, y1, y2;

-- Same as above, but for left semi join
select * from x left semi join y on x1 = y1 and x2 IN (select z1 from z where z2 = x2) order by x1, x2;

select * from x left semi join y on x1 = y1 and y2 not IN (select z1 from z where z2 = y2) order by x1, x2;

select * from x left anti join y on x1 = y1 and y2 IN (select z1 from z where z2 = y2) order by x1, x2;

select * from x full outer join y on x1 = y1 and x2 not IN (select z1 from z where z2 = x2) order by x1, x2, y1, y2;

-- OR instead of AND in the join condition
select * from x inner join y on x1 = y1 or x2 IN (select z1 from z where z1 = x1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 or x2 not IN (select z1 from z where z1 = x1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 or y2 IN (select z1 from z where z1 = y1) order by x1, x2, y1, y2;

select * from x inner join y on x1 = y1 and x2 not IN (select z1 from z where z1 = x1) order by x1, x2, y1, y2;

select * from x inner join y on x1 = y1 and y2 IN (select z1 from z where z1 = y1) order by x1, x2, y1, y2;

select * from x left join y on x1 = y1 and y2 not IN (select z1 from z where z1 = y1) order by x1, x2, y1, y2;

-- A test suite for in with cte in parent side, subquery, and both predicate subquery
-- It includes correlated cases.





create temporary view t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i) as values
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16, 12, 21, 15.0, 20.0, 20E2, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16, 12, 10, 15.0, 20.0, 20E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22, 17.0, 25.0, 26E2, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10, null, 25, 17.0, 25.0, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10, null, 12, 17.0, 25.0, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04');

-- TC 01.03
WITH cte1 AS
(
       SELECT t1a,
              t1b,
              t1c,
              t1d,
              t1e
       FROM   t1)
SELECT t1a,
       t1b,
       t1c,
       t1h
FROM   t1
WHERE  t1c IN
       (
              SELECT          cte1.t1c
              FROM            cte1
              JOIN            cte1 cte2
              on              cte1.t1b > cte2.t1b
              FULL OUTER JOIN cte1 cte3
              ON              cte1.t1c = cte3.t1c
              LEFT JOIN       cte1 cte4
              ON              cte1.t1d = cte4.t1d
              INNER JOIN  cte1 cte5
              ON              cte1.t1b < cte5.t1b
              LEFT OUTER JOIN  cte1 cte6
              ON              cte1.t1d > cte6.t1d);

-- TC 01.06
WITH cte1 AS
(
       SELECT t1a,
              t1b,
              t1c
       FROM   t1
       WHERE  t1b IN
              (
                     SELECT t2b
                     FROM   t2 FULL OUTER JOIN T3 on t2a = t3a
                     WHERE  t1c = t2c) AND
              t1a = 'val1b')
SELECT *
FROM            (
                       SELECT *
                       FROM   cte1
                       INNER JOIN   cte1 cte2 ON cte1.t1a = cte2.t1a
                       RIGHT OUTER JOIN cte1 cte3  ON cte1.t1b = cte3.t1b
                       LEFT OUTER JOIN cte1 cte4 ON cte1.t1c = cte4.t1c
                       ) s;

-- CTE with NOT IN
-- TC 01.09
WITH cte1
     AS (SELECT t1a,
                t1b
         FROM   t1
         WHERE  t1a = 'val1d')
SELECT t1a,
       t1b,
       t1c,
       t1h
FROM   t1
WHERE  t1b NOT IN (SELECT cte1.t1b
                   FROM   cte1
                   WHERE  cte1.t1b < 0) AND
       t1c > 10;

CREATE TEMPORARY VIEW ADDRESS(id, emp_name, address) AS VALUES
  (100, 'emp 1', 'addr1'),
  (200, null, 'addr2'),
  (null, 'emp 3', 'addr3'),
  (null, null, 'addr4'),
  (600, 'emp 6', 'addr6'),
  (800, 'emp 8', 'addr8');

-- null produced from both sides.
-- TC.01.01
SELECT id, 
       dept_id 
FROM   emp 
WHERE  id = 600
       OR id = 500 
       OR dept_id NOT IN (SELECT dept_id 
                          FROM   emp);

-- no null in both left and right
-- TC.01.04
SELECT id, 
       dept_id 
FROM   emp 
WHERE  id = 200 
       OR (dept_id IS NOT NULL        
       AND dept_id + 100 NOT IN (SELECT dept_id 
                           FROM   emp
                           WHERE dept_id IS NOT NULL));

-- multiple columns in not-in
-- TC.01.07
SELECT id,
       dept_id,
       emp_name
FROM   emp
WHERE  dept_id = 10
OR (id, emp_name) NOT IN (SELECT id, emp_name FROM address);

-- multiple not-in(s) in side disjunction`
-- TC.01.10
SELECT id, 
       dept_id, 
       emp_name 
FROM   emp 
WHERE  id NOT IN (SELECT id 
                         FROM   address 
                         WHERE  id IS NOT NULL 
                         AND emp_name IS NOT NULL
                         AND id >= 400)
       OR emp_name NOT IN (SELECT emp_name 
                                  FROM   address 
                                  WHERE  id IS NOT NULL 
                                  AND emp_name IS NOT NULL
                                  AND emp.id = address.id
                                  AND id < 400);

-- NOT (OR (expression, NOT-IN-SUB)
SELECT * 
FROM   s1 
WHERE  NOT (a > 5 
            OR a NOT IN (SELECT c 
                         FROM   s2));

-- A test suite for NOT IN GROUP BY in parent side, subquery, and both predicate subquery
-- It includes correlated cases.


-- Test aggregate operator with codegen on and off.




create temporary view t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i) as values
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16, 12, 21, 15.0, 20.0, 20E2, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16, 12, 10, 15.0, 20.0, 20E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22, 17.0, 25.0, 26E2, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10, null, 25, 17.0, 25.0, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10, null, 12, 17.0, 25.0, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04');

-- TC 01.03
SELECT Count(*)
FROM   (SELECT *
        FROM   t2
        WHERE  t2a NOT IN (SELECT t3a
                           FROM   t3
                           WHERE  t3h != t2h)) t2
WHERE  t2b NOT IN (SELECT Min(t2b)
                   FROM   t2
                   WHERE  t2b = t2b
                   GROUP  BY t2c);

-- A test suite for not-in-joins in parent side, subquery, and both predicate subquery
-- It includes correlated cases.





create temporary view t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i) as values
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:00:00.000', date '2014-04-04'),
  ('val1b', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16, 12, 21, 15.0, 20.0, 20E2, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16, 12, 10, 15.0, 20.0, 20E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22, 17.0, 25.0, 26E2, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19, 17.0, 25.0, 26E2, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10, null, 25, 17.0, 25.0, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10, null, 12, 17.0, 25.0, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6, 8, 10, 15.0, 20.0, 20E2, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10, null, 19, 17.0, 25.0, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04');

-- TC 01.03
SELECT t1a,
       t1b,
       t1c,
       t1d,
       t1h
FROM   t1
WHERE  t1a NOT IN
       (
                 SELECT    t2a
                 FROM      t2
                 LEFT JOIN t3 on t2b = t3b
                 WHERE t1d = t2d
                  )
AND    t1d NOT IN
       (
              SELECT t2d
              FROM   t2
              RIGHT JOIN t1 on t2e = t1e
              WHERE t1a = t2a);

-- TC 01.06
SELECT   COUNT(DISTINCT(t1a)),
         t1b,
         t1c,
         t1d
FROM     t1
WHERE    t1a NOT IN
         (
                SELECT t2a
                FROM   t2 INNER
                JOIN   t1
                ON     t1a = t2a)
AND      t1d NOT IN
         (
                    SELECT     t2d
                    FROM       t2
                    INNER JOIN t3
                    ON         t2b = t3b )
GROUP BY t1b,
         t1c,
         t1d
HAVING   t1b < sum(t1c);

-- Case 6
  -- (no null columns with match -> row not returned)
SELECT *
FROM   m
WHERE  b = 3.0 -- Matches (2, 3.0)
       AND (a, b) NOT IN ((2, 3.0));

CREATE TEMPORARY VIEW s(c, d) AS VALUES
  (null, null),
  (0, 1.0),
  (2, 3.0),
  (4, null);

-- Case 3
  -- (probe-side columns are all null -> row not returned)
SELECT *
FROM   m
WHERE  a IS NULL AND b IS NULL -- Matches only (null, null)
       AND (a, b) NOT IN (SELECT *
                          FROM s
                          WHERE c IS NOT NULL) -- Matches (0, 1.0), (2, 3.0), (4, null)
;

-- Case 6
  -- (no null columns with match -> row not returned)
SELECT *
FROM   m
WHERE  b = 3.0 -- Matches (2, 3.0)
       AND (a, b) NOT IN (SELECT *
                          FROM s
                          WHERE c = 2) -- Matches (2, 3.0)
;

-- Uncorrelated NOT IN Subquery test cases
  -- Case 1 (not possible to write a literal with no rows, so we ignore it.)
  -- (empty subquery -> all rows returned)

  -- Case 2
  -- (subquery includes null -> no rows returned)
SELECT *
FROM   m
WHERE  a NOT IN (null);

-- Case 5
  -- (probe column does not match subquery row -> row is returned)
SELECT *
FROM   m
WHERE  b = 3.0 -- Only matches (2, 3.0)
       AND a NOT IN (6);

-- Uncorrelated NOT IN Subquery test cases
  -- Case 1
  -- (empty subquery -> all rows returned)
SELECT *
FROM   m
WHERE  a NOT IN (SELECT c
                 FROM   s
                 WHERE  d > 10.0) -- (empty subquery)
;

-- Case 4
  -- (probe column matches subquery row -> row not returned)
SELECT *
FROM   m
WHERE  b = 3.0 -- Only matches (2, 3.0)
       AND a NOT IN (SELECT c
                     FROM   s
                     WHERE  d = 3.0) -- Matches (2, 3.0)
;

-- Case 3->1
  -- (probe column is null but subquery returns no rows -> row is returned)
SELECT *
FROM   m
WHERE  b = 1.0 -- Only matches (null, 1.0)
       AND a NOT IN (SELECT c
                     FROM   s
                     WHERE  d = b + 10) -- Matches no row
;

-- correlated IN subquery
-- simple select
-- TC 01.01
SELECT *
FROM   t1
WHERE  t1a IN (SELECT t2a
               FROM   t2);

-- TC 01.04
SELECT t1a,
       t1b
FROM   t1
WHERE  t1c IN (SELECT t2b
               FROM   t2
               WHERE  t1a = t2a
                       OR t1b > t2b);

-- simple select for NOT IN
-- TC 01.07
SELECT DISTINCT( t1a ),
               t1b,
               t1h
FROM   t1
WHERE  t1a NOT IN (SELECT t2a
                   FROM   t2);

-- TC 02.01
SELECT a1, a2
FROM   a
WHERE  a1 NOT IN (SELECT b.b1
                  FROM   b
                  WHERE  a.a2 = b.b2);

CREATE TEMPORARY VIEW t2 AS SELECT * FROM VALUES
  (1, 0, 1)
AS t2(t2a, t2b, t2c);

-- TC 01.02
-- Invalid due to the column t2b not part of the output from table t2.
SELECT *
FROM   t1
WHERE  t1a IN (SELECT   min(t2a)
               FROM     t2
               GROUP BY t2c
               HAVING   t2c IN (SELECT   max(t3c)
                                FROM     t3
                                GROUP BY t3b
                                HAVING   t3b > t2b ));

-- TC 01.05
-- Invalid due to outer reference appearing in projection list
SELECT t1a 
FROM   t1
WHERE  t1a IN (SELECT t2a 
               FROM   t2
               WHERE  EXISTS (SELECT min(t2a) 
                              FROM   t3));

-- invalid because the correlated CTE is used on the right side of a left outer join.
SELECT *
FROM   t1
WHERE  EXISTS (WITH cte AS (SELECT * FROM t2 WHERE t2a = t1.t1a)
               SELECT *
               FROM   t3
                      LEFT JOIN cte
                             ON t3b = cte.t2b);

-- TC 01.01
SELECT 
  ( SELECT max(t2b), min(t2b) 
    FROM t2 
    WHERE t2.t2b = t1.t1b
    GROUP BY t2.t2b
  )
FROM t1;

-- TC 01.04
SELECT * FROM T1 
WHERE
(t1a, t1b) IN (SELECT t2a
               FROM t2
               WHERE t1a = t2a);

CREATE TABLE t3(col1 INT, col2 STRING);

SELECT *
FROM (
    SELECT EXISTS (
        SELECT t1.col1
        FROM t1
        WHERE t3.col1 = t1.col2
        LIMIT 1
    )
    FROM t3
    GROUP BY EXISTS (
        SELECT t1.col1
        FROM t1
        WHERE t3.col1 = t1.col2
        LIMIT 1
    )
);

SELECT col1 FROM t2 GROUP BY col1 ORDER BY 1 IN (SELECT 1);

CREATE OR REPLACE VIEW t2(b1, b2) as values (0, 2), (0, 3);

set spark.sql.legacy.scalarSubqueryCountBugBehavior=false;

-- test for count bug in correlated scalar subqueries with nested aggregates with multiple counts
select (
  select SUM(l.cnt + r.cnt)
  from (select count(*) cnt from t2 where t1.a1 = t2.b1 having cnt = 0) l
  join (select count(*) cnt from t3 where t1.a1 = t3.c1 having cnt = 0) r
  on l.cnt = r.cnt
) a from t1 order by a desc;

reset spark.sql.legacy.scalarSubqueryCountBugBehavior;

create temp view r (c, d)
as values
    (2, 3.0),
    (2, 3.0),
    (3, 2.0),
    (4, 1.0),
    (null, null),
    (null, 5.0),
    (6, null);

select *, (select count(*) from r where l.a = r.c group by 'constant') from l;

-- Empty groups should evaluate to 0, and groups filtered by HAVING should evaluate to NULL
select *, (select count(*) from r where l.a = r.c having count(*) <= 1) from l;

-- SPARK-46743: count bug is still detected on top of the subquery that can be constant folded.
SELECT
  (
    SELECT
      COUNT(null_view.a) AS result
    FROM
      null_view
    WHERE
      null_view.a = l.a
  )
FROM
  l;

-- Same as above but with a filter (HAVING) above the aggregate
SELECT
(
  SELECT
    COUNT(null_view.a) AS result
  FROM
    null_view
  INNER JOIN r
    ON r.c = null_view.a
    AND r.c IS NOT NULL
  WHERE
    null_view.a = l.a
  HAVING COUNT(*) > -1
)
FROM
  l;

set spark.sql.optimizer.decorrelateSubqueryLegacyIncorrectCountHandling.enabled = true;

reset spark.sql.optimizer.decorrelateSubqueryLegacyIncorrectCountHandling.enabled;

create temp view z (z1, z2) as values (1, 0), (1, 1);

select * from x where (select count(*) from y where y1 > x1 group by x1) = 1;

-- Group-by expression is the same as the one we filter on - legal
select *, (select count(*) from y where x1 = y1 and cast(y2 as double) = x1 + 1
           group by cast(y2 as double)) from x;

select * from x where (select count(*) from y where y1 > x1 group by y1) = 1;

-- Same queries, with LeftSingle join
set spark.sql.optimizer.scalarSubqueryUseSingleJoin = true;

-- The correlation below the join is unsupported in Spark anyway, but when we do support it this query should still be disallowed.

-- Test legacy behavior conf
set spark.sql.legacy.scalarSubqueryAllowGroupByNonEqualityCorrelatedPredicate = true;

-- Scalar subqueries with a WITH clause are validated with their CTEs inlined.
set spark.sql.legacy.scalarSubqueryAllowGroupByNonEqualityCorrelatedPredicate = false;

select *, (with cte1 as (select * from y where y1 = x1), cte2 as (select y1, count(*) as cnt from cte1 group by y1) select cnt from cte2) from x;

-- The CTE is referenced only from a nested subquery
select *, (with cte as (select * from y) select count(*) from z where z1 = x1 and exists (select * from cte) group by z1) from x;

select *, (with cte as (select * from y where y1 = x1), unused as (select * from z left join cte on z1 = y1) select count(*) from cte) from x;

select *, (with cte as (select y2 from y where y1 = x1) select y2 from cte) from x;

select *, (with cte as (select * from y where y1 = x1) select count(*) from z left join cte on z1 = y1) from x;

-- The group-by column is equal to a constant only in another reference to the CTE
select *, (with cte as (select * from y where y1 = 2) select count(*) from z left join cte a on z2 = a.y2 join cte b on true where z1 = x1 group by a.y1) from x;

-- Also when it comes from a reference to a CTE that passes on the columns of another reference
select *, (with cte as (select * from y where y1 = x1), other as (select * from cte) select count(*) from other a join cte b on a.y2 = b.y2 group by a.y1) from x;

-- A test suite for scalar subquery in predicate context


CREATE OR REPLACE TEMPORARY VIEW p AS VALUES (1, 1) AS T(pk, pv);

-- SPARK-18814.2: Adding stack of aggregates
SELECT pk, cv
FROM   p, c
WHERE  p.pk = c.ck
AND    c.cv = (SELECT max(avg)
               FROM   (SELECT   c1.cv, avg(c1.cv) avg
                       FROM     c c1
                       WHERE    c1.ck = p.pk
                       GROUP BY c1.cv));

create temporary view t3 as select * from values
  ('val3a', 6S, 12, 110L, float(15), 20D, 20E2BD, timestamp '2014-04-04 01:02:00.000', date '2014-04-04'),
  ('val3a', 6S, 12, 10L, float(15), 20D, 20E2BD, timestamp '2014-05-04 01:02:00.000', date '2014-05-04'),
  ('val1b', 10S, 12, 219L, float(17), 25D, 26E2BD, timestamp '2014-05-04 01:02:00.000', date '2014-05-04'),
  ('val1b', 10S, 12, 19L, float(17), 25D, 26E2BD, timestamp '2014-05-04 01:02:00.000', date '2014-05-04'),
  ('val1b', 8S, 16, 319L, float(17), 25D, 26E2BD, timestamp '2014-06-04 01:02:00.000', date '2014-06-04'),
  ('val1b', 8S, 16, 19L, float(17), 25D, 26E2BD, timestamp '2014-07-04 01:02:00.000', date '2014-07-04'),
  ('val3c', 17S, 16, 519L, float(17), 25D, 26E2BD, timestamp '2014-08-04 01:02:00.000', date '2014-08-04'),
  ('val3c', 17S, 16, 19L, float(17), 25D, 26E2BD, timestamp '2014-09-04 01:02:00.000', date '2014-09-05'),
  ('val1b', null, 16, 419L, float(17), 25D, 26E2BD, timestamp '2014-10-04 01:02:00.000', null),
  ('val1b', null, 16, 19L, float(17), 25D, 26E2BD, timestamp '2014-11-04 01:02:00.000', null),
  ('val3b', 8S, null, 719L, float(17), 25D, 26E2BD, timestamp '2014-05-04 01:02:00.000', date '2014-05-04'),
  ('val3b', 8S, null, 19L, float(17), 25D, 26E2BD, timestamp '2015-05-04 01:02:00.000', date '2015-05-04')
  as t3(t3a, t3b, t3c, t3d, t3e, t3f, t3g, t3h, t3i);

-- TC 01.03
SELECT t1a, t1h
FROM   t1
WHERE  t1c = (SELECT max(t2c)
              FROM   t2)
OR     t1b = (SELECT min(t3b)
              FROM   t3
              WHERE  t3b > 10);

-- TC 01.06
-- test casting
SELECT t1a, t1h
FROM   t1
WHERE  date(t1h) = (SELECT min(t2i)
                    FROM   t2);

-- TC 01.09
-- more than one scalar subquery
SELECT t3b, t3c
FROM   t3
WHERE  (SELECT max(t3c)
        FROM   t3
        WHERE  t3b > 10) >=
       (SELECT min(t3b)
        FROM   t3
        WHERE  t3c > 0)
AND    (t3b is null or t3c is null);

-- TC 02.03
SELECT t1a
FROM   t1
WHERE  t1a = (SELECT   max(t2a)
              FROM     t2
              WHERE    t2c = t1c
              GROUP BY t2c
              HAVING   count(*) >= 0)
OR     t1i > '2014-12-31';

-- TC 02.05
SELECT t1a
FROM   t1
WHERE  t1b <= (SELECT   max(t2b)
               FROM     t2
               WHERE    t2c = t1c
               GROUP BY t2c)
AND    t1b >= (SELECT   min(t2b)
               FROM     t2
               WHERE    t2c = t1c
               GROUP BY t2c);

-- TC 02.07.02
-- set op
SELECT t1a
FROM   t1
WHERE  t1a <= (SELECT   max(t2a)
               FROM     t2
               WHERE    t2c = t1c
               GROUP BY t2c)
UNION DISTINCT
SELECT t1a
FROM   t1
WHERE  t1a >= (SELECT   min(t2a)
               FROM     t2
               WHERE    t2c = t1c
               GROUP BY t2c);

-- SPARK-44549: window function in the correlated subquery.
SELECT 1
FROM t1
WHERE t1b < (SELECT MAX(tmp.s) FROM (
             SELECT SUM(t2b) OVER (partition by t2c order by t2d) as s
               FROM t2 WHERE t2.t2d = t1.t1d) as tmp);

-- Same as above but with LIMIT/ORDER BY
SELECT 1
FROM t1
WHERE t1b < (SELECT SUM(t2b) OVER (partition by t2c order by t2d) as s
               FROM t2 WHERE t2.t2d <= t1.t1d
             ORDER BY s DESC
             LIMIT 1);

-- SPARK-44549: correlation in window function itself is not supported yet.
SELECT 1
FROM t1
WHERE t1b = (SELECT MAX(tmp.s) FROM (
             SELECT SUM(t2c) OVER (partition by t2c order by t1.t1d + t2d) as s
               FROM t2) as tmp);

-- SPARK-46526: LIMIT over correlated predicate that references only the outer table.
SELECT t1a, t1b
FROM   t1
WHERE  t1c = (SELECT t2c
              FROM   t2
              WHERE  t1b < t1d
              ORDER BY t2c LIMIT 1);

-- Set operations in correlation path

CREATE OR REPLACE TEMP VIEW t0(t0a, t0b) AS VALUES (1, 1), (2, 0);

SELECT * FROM t0 WHERE t0a <
(SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
);

SELECT * FROM t0 WHERE t0a <
(SELECT sum(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
);

-- Test handling of COUNT bug
SELECT * FROM t0 WHERE t0a <
(SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
);

-- In HAVING clause
SELECT t0a, t0b FROM t0
GROUP BY t0a, t0b
HAVING t0a <
(SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  UNION ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
);

SELECT * FROM t0 WHERE t0a <
(SELECT sum(t1c) FROM
  (SELECT t1c
   FROM   t1 JOIN t2 ON (t1a < t0a AND t2b >= t1b))
);

SELECT *
FROM t1
WHERE (SELECT max(t2c)
       FROM t2 WHERE t1b = t2b
      ) between 1 and 2;

-- A test suite for scalar subquery in SELECT clause


create temporary view t1 as select * from values
  ('val1a', 6S, 8, 10L, float(15.0), 20D, 20E2, timestamp '2014-04-04 00:00:00.000', date '2014-04-04'),
  ('val1b', 8S, 16, 19L, float(17.0), 25D, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04'),
  ('val1a', 16S, 12, 21L, float(15.0), 20D, 20E2, timestamp '2014-06-04 01:02:00.001', date '2014-06-04'),
  ('val1a', 16S, 12, 10L, float(15.0), 20D, 20E2, timestamp '2014-07-04 01:01:00.000', date '2014-07-04'),
  ('val1c', 8S, 16, 19L, float(17.0), 25D, 26E2, timestamp '2014-05-04 01:02:00.001', date '2014-05-05'),
  ('val1d', null, 16, 22L, float(17.0), 25D, 26E2, timestamp '2014-06-04 01:01:00.000', null),
  ('val1d', null, 16, 19L, float(17.0), 25D, 26E2, timestamp '2014-07-04 01:02:00.001', null),
  ('val1e', 10S, null, 25L, float(17.0), 25D, 26E2, timestamp '2014-08-04 01:01:00.000', date '2014-08-04'),
  ('val1e', 10S, null, 19L, float(17.0), 25D, 26E2, timestamp '2014-09-04 01:02:00.001', date '2014-09-04'),
  ('val1d', 10S, null, 12L, float(17.0), 25D, 26E2, timestamp '2015-05-04 01:01:00.000', date '2015-05-04'),
  ('val1a', 6S, 8, 10L, float(15.0), 20D, 20E2, timestamp '2014-04-04 01:02:00.001', date '2014-04-04'),
  ('val1e', 10S, null, 19L, float(17.0), 25D, 26E2, timestamp '2014-05-04 01:01:00.000', date '2014-05-04')
  as t1(t1a, t1b, t1c, t1d, t1e, t1f, t1g, t1h, t1i);

-- Group 1: scalar subquery in SELECT clause
--          no correlation
-- TC 01.01
-- more than one scalar subquery
SELECT (SELECT min(t3d) FROM t3) min_t3d,
       (SELECT max(t2h) FROM t2) max_t2h
FROM   t1
WHERE  t1a = 'val1c';

-- TC 01.04
SELECT (SELECT min(t3c) FROM t3) min_t3d
FROM   t1
WHERE  t1a = 'val1a'
INTERSECT
SELECT (SELECT min(t2c) FROM t2) min_t2d
FROM   t1
WHERE  t1a = 'val1d';

-- TC 02.02
SELECT (SELECT min(t3d) FROM t3 WHERE t3a = t1a) min_t3d
FROM   t1
WHERE  t1a = 'val1b'
MINUS
SELECT (SELECT min(t3d) FROM t3) abs_min_t3d
FROM   t1
WHERE  t1a = 'val1b';

-- SPARK-61664: Sketch aggregates and schema_of_variant_agg should not return NULL
-- in a correlated subquery when no inner row matches
CREATE TEMPORARY VIEW t2_sketch AS SELECT t2a,
    hll_sketch_agg(t2d) hll_sketch,
    theta_sketch_agg(t2d) theta_sketch,
    kll_sketch_agg_bigint(t2d) kll_sketch,
    tuple_sketch_agg_double(t2d, t2f) tuple_sketch,
    approx_top_k_accumulate(t2d) top_k_state
FROM t2 GROUP BY t2a;

SELECT t1a,
    (SELECT kll_sketch_get_n_bigint(kll_sketch_agg_bigint(t2d)) FROM t2 WHERE t2a = t1a)
      kll_sketch_agg_bigint,
    (SELECT kll_sketch_get_n_float(kll_sketch_agg_float(t2e)) FROM t2 WHERE t2a = t1a)
      kll_sketch_agg_float,
    (SELECT kll_sketch_get_n_double(kll_sketch_agg_double(t2f)) FROM t2 WHERE t2a = t1a)
      kll_sketch_agg_double,
    (SELECT kll_sketch_get_n_bigint(kll_merge_agg_bigint(kll_sketch))
      FROM t2_sketch WHERE t2a = t1a) kll_merge_agg_bigint
FROM (SELECT DISTINCT t1a FROM t1);

SELECT t1a,
    (SELECT schema_of_variant_agg(parse_json(CAST(t2d AS STRING))) FROM t2 WHERE t2a = t1a)
      schema_of_variant_agg
FROM (SELECT DISTINCT t1a FROM t1);

-- SPARK-36028: Allow Project to host outer references in scalar subqueries
SELECT t1c, (SELECT t1c) FROM t1;

SELECT t1c, (SELECT SUM(c) FROM (SELECT t1c AS c)) FROM t1;

CREATE OR REPLACE TEMPORARY VIEW t2 AS VALUES (0, 2), (0, 3) t2(c1, c2);

-- Multiple CTE definitions.
SELECT c1, (
    WITH t3 AS (SELECT c1 + 1 AS c1, c2 + 1 AS c2 FROM t2),
    t4 AS (SELECT * FROM t3 WHERE t1.c1 = c1)
    SELECT SUM(c2) FROM t4
) FROM t1;

-- Single row subquery that references CTE in the main query.
WITH t AS (SELECT 1 AS a)
SELECT c1, (SELECT a FROM t WHERE a = c1) FROM t1;

-- SPARK-36114: Support correlated non-equality predicates
CREATE OR REPLACE TEMP VIEW t1(c1, c2) AS (VALUES (0, 1), (1, 2));

CREATE OR REPLACE TEMP VIEW exams(sid, course, curriculum, grade, date) AS (VALUES
    (0, 'C1', 'CS', 4, 2020),
    (0, 'C2', 'CS', 3, 2021),
    (1, 'C1', 'CS', 2, 2020),
    (1, 'C2', 'CS', 1, 2021));

SELECT (SELECT min(c2) FROM t2 WHERE t1.c1 >= t2.c1 AND t1.c2 < t2.c2) FROM t1;

SELECT c, (
    SELECT count(*)
    FROM (VALUES (0, 6), (1, 5), (2, 4), (3, 3)) t1(a, b)
    WHERE a + b = c
) FROM (VALUES (6)) t2(c);

-- SPARK-43596: handle IsNull when rewriting the domain join
set spark.sql.optimizer.optimizeOneRowRelationSubquery.alwaysInline=false;

-- SPARK-43760: the result of the subquery can be NULL.
select * from (
 select t1.id c1, (
  select t2.id c from range (1, 2) t2
  where t1.id = t2.id  ) c2
 from range (1, 3) t1 ) t
where t.c2 is not null;

-- Outer struct star expansion in scalar subquery
SELECT (SELECT t1.s.* FROM VALUES(2) AS t2(col1) LIMIT 1)
FROM (SELECT named_struct('a', 1) AS s) AS t1;

-- Outer star expansion through a derived table wrapper
SELECT (SELECT * FROM (SELECT t1.* FROM VALUES(2) AS t2(col1) LIMIT 1)) FROM VALUES(1) AS t1(col1);

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  UNION ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- UNION DISTINCT

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  UNION DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  UNION DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  UNION DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- INTERSECT ALL

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  INTERSECT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- INTERSECT DISTINCT

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  INTERSECT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  INTERSECT DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- EXCEPT ALL

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  EXCEPT ALL
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT ALL
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- EXCEPT DISTINCT

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

SELECT t0a, (SELECT sum(c) FROM
  (SELECT t1c as c
  FROM   t1
  WHERE  t1a > t0a
  EXCEPT DISTINCT
  SELECT t2c as c
  FROM   t2
  WHERE  t2b <= t0b)
)
FROM t0;

-- Test handling of COUNT bug
SELECT t0a, (SELECT count(t1c) FROM
  (SELECT t1c
  FROM   t1
  WHERE  t1a = t0a
  EXCEPT DISTINCT
  SELECT t2c
  FROM   t2
  WHERE  t2b = t0b)
)
FROM t0;

-- Correlated references in join predicates
SELECT t0a, (SELECT sum(t1b) FROM
  (SELECT t1b
  FROM   t1 join t2 ON (t1a = t0a and t1b = t2b)
  UNION ALL
  SELECT t2b
  FROM   t1 join t2 ON (t2a = t0a and t1a = t2a))
)
FROM t0;

FROM (SELECT * FROM testData WHERE key = 1) AS t SELECT *;

-- Disallow unaliased subqueries in FROM clause
SELECT * FROM (SELECT * FROM testData) WHERE key = 1;

drop table if exists y;

create table y(ym map<int, int>, y2 int) using parquet;

-- exists, in, lateral
select * from x where exists (select * from y where xm[1] = ym[1]);

select * from x join lateral (select * from y where xm[1] = ym[1] union all select * from y where xm[1] = ym[1] + 1);

select * from x where xm[1] in (select ym[1] from y);

-- Multiple different extracts from same map
select * from x where (select sum(y2) from y where xm[1] = ym[1] and xm[2] >= ym[2]) > 2;

select * from x join lateral (select xm[1], xm[1] as s1, xm[1] - ym[1] as s2 from y);

select * from x where (select sum(y2) from y where xm[x2+1] = ym[1]) > 2;

-- Unsupported when disabled due to DomainJoin over map
set spark.sql.optimizer.pullOutNestedDataOuterRefExpressions.enabled = false;

insert into x values (1, 1), (2, 2);

select * from x where exists (select * from y where x1 = y1 limit 1 offset 2);

select * from x where (select sum(y2) from y where x1 = y1 limit 1 offset 2) > 2;

select * from x where x1 in (select y1 from y offset 2);

SELECT emp_name
FROM   emp
WHERE EXISTS (SELECT max(dept.dept_id) a
                   FROM   dept
                   WHERE  dept.dept_id = emp.dept_id
                   GROUP  BY state
                   ORDER  BY state
                   LIMIT 2
                   OFFSET 1);

SELECT emp_name
FROM   emp
JOIN LATERAL (SELECT max(dept.dept_id) a
                   FROM   dept
                   WHERE  dept.dept_id = emp.dept_id
                   GROUP  BY state
                   ORDER  BY state
                   OFFSET 1);

SELECT * FROM testData AS t(col1, col2) WHERE col1 = 2;

-- Check alias duplication
SELECT a AS col1, b AS col2 FROM testData AS t(c, d);

SELECT col1, col2 FROM (SELECT 1 AS a, 1 AS b) t(col1, col2);

CREATE OR REPLACE TEMPORARY VIEW src2 AS SELECT * FROM VALUES (2, 1.0), (3, 3.2), (1, 8.5) AS src2(id, v2);

-- Negative examples after aliasing
SELECT src1.* FROM src1 a ORDER BY id LIMIT 1;

-- range call with end
select * from range(6 + cos(3));

-- range call with numPartitions
select * from range(0, 10, 1, 200);

-- range call with incompatible type
select * from range(array(1, 2, 3));

-- range call with alias
select i from range(0, 2) t(i);

-- explode
select * from explode(array(1, 2));

select * from explode(map());

-- explode with non-deterministic values
select * from explode(array(rand(0)));

select * from explode(1);

select * from explode(array(1, 2)) t(c1, c2);

select * from explode_outer(array());

select * from range(2) join explode_outer(array());

select * from inline(array_remove(array(struct(1, 'a')), struct(1, 'a')));

-- inline_outer
select * from inline_outer(array(struct(1, 'a'), struct(2, 'b')));

select * from posexplode(array(1, 2));

select * from posexplode(map('a', 1, 'b', 2));

select * from posexplode(1, 2);

-- posexplode
select * from posexplode_outer(array());

select * from posexplode_outer(map('a', 1, 'b', 2));

select * from json_tuple('{"a": 1, "b": 2}', 'a', 'a');

-- json_tuple with erroneous input
select * from json_tuple();

select * from json_tuple('{"a": 1}', null);

select * from stack(2, 1, 2, 3);

select * from stack(2, 1, 1.1, 'a', 2, 2.2, 'b') t(a, b, c);

select * from stack(2, 1, 2, 3) t(a, b, c);

-- Table-valued function argument that is an alias: the `:` semi-structured extraction makes the
-- variant_explode argument a top-level Alias. The variant values are returned as JSON strings,
-- which the Thrift server can also return.
SELECT pos, key, to_json(value) AS value FROM variant_explode(parse_json('{"a": [1, 2, 3]}'):a);

SELECT pos, key, to_json(value) AS value
FROM variant_explode(parse_json('{"a": {"b": [1, 2]}}'):a.b);

SELECT p, to_json(v) AS v FROM variant_explode(parse_json('{"a": [1, 2]}'):a) AS t(p, k, v);

-- Negative tests: negative percentage
SELECT mydb1.t1 FROM t1 TABLESAMPLE (-1 PERCENT);

CREATE TABLE t_double_1_1_1_4_through_1_5_1_8 AS
SELECT CAST(col1 AS DOUBLE) AS col1, CAST(col2 AS DOUBLE) AS col2
FROM VALUES
  (1.1, 1.4), (1.2, 1.5), (1.3, 1.6), (1.4, 1.7), (1.5, 1.8) AS tab(col1, col2);

-- String table
DROP TABLE IF EXISTS t_string_a_d_through_e_h;

CREATE TABLE t_binary_a_b_through_e_f AS 
VALUES 
  (X'A', X'B'), (X'B', X'C'), (X'C', X'D'), (X'D', X'E'), (X'E', X'F') AS tab(col1, col2);

-- Array Long table
DROP TABLE IF EXISTS t_array_long_1_3_through_4_6;

-- `\u030A` is the "combining ring above" Unicode character: https://www.compart.com/en/unicode/U+030A
-- `\uFFFD is the Unicode replacement character
-- `\xC1` is an invalid Unicode byte.
-- `\x80` is a Unicode continuation byte, that is it cannot be the first byte of a multi-byte UTF8 character.
-- All strings are different based on the UTF8_BINARY collation.
-- The first and second strings are equal for any collation with the RTRIM modifier, and equal to the empty string.
-- The last three strings are respectively equal to the next last three strings for any collation with the RTRIM modifier.
-- The strings "\xC1", "\x80" and "\uFFFD" are equal for all collations except UTF8_BINARY.
-- The (sub)strings `å` and `a\u030A` are equal for the UNICODE family of collations.
-- `å` is the lowercase version of `Å`.
CREATE TABLE t_string_collation AS
VALUES
  (''), ('  '), (CAST(X'C1' AS STRING)), (CAST(X'80' AS STRING)),
  ('\uFFFD'), ('Å'), ('å'), ('a\u030A'), ('Å '), ('å  '),
  ('a\u030A   ') AS tab(col1);

-- Test theta_sketch_agg with ArrayType(LongType) values from table  
SELECT theta_sketch_estimate(theta_sketch_agg(col2)) FROM t_array_long_1_3_through_4_6;

-- Test theta_sketch_agg with FloatType values from table (promoted to Double internally)
SELECT theta_sketch_estimate(theta_sketch_agg(col2)) FROM t_float_1_1_1_4_through_1_5_1_8;

-- Test theta_sketch_agg with StringType values
SELECT theta_sketch_estimate(theta_sketch_agg(col1)) FROM t_string_a_d_through_e_h;

-- Test theta_union function with DoubleType sketches
SELECT theta_sketch_estimate(
  theta_union(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2))) FROM t_double_1_1_1_4_through_1_5_1_8;

-- Test theta_union function with BinaryType sketches and explicit lgNomEntries parameter
SELECT theta_sketch_estimate(
  theta_union(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2), 20)) FROM t_binary_a_b_through_e_f;

-- Test theta_intersection function with IntegerType sketches  
SELECT theta_sketch_estimate(
  theta_intersection(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2))) FROM t_int_1_5_through_7_11;

-- Test theta_intersection function with FloatType sketches and explicit lgNomEntries parameter
SELECT theta_sketch_estimate(
  theta_intersection(
    theta_sketch_agg(col1, 5),
    theta_sketch_agg(col2))) FROM t_float_1_1_1_4_through_1_5_1_8;

-- Test theta_intersection function with ArrayType(IntegerType) sketches
SELECT theta_sketch_estimate(
  theta_intersection(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2))) FROM t_array_int_1_3_through_4_6;

-- Test theta_difference function with LongType sketches and explicit lgNomEntries parameter
SELECT theta_sketch_estimate(
  theta_difference(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2, 5))) FROM t_long_1_5_through_7_11;

-- Test theta_difference function with StringType sketches
SELECT theta_sketch_estimate(
  theta_difference(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2))) FROM t_string_a_d_through_e_h;

-- Test theta_difference function with ArrayType(LongType) sketches and explicit lgNomEntries parameter
SELECT theta_sketch_estimate(
  theta_difference(
    theta_sketch_agg(col1),
    theta_sketch_agg(col2, 4))) FROM t_array_long_1_3_through_4_6;

-- Test theta_union_agg with StringType sketches and explicit lgNomEntries parameter
SELECT theta_sketch_estimate(theta_union_agg(sketch, 14))
    FROM (SELECT theta_sketch_agg(col1) as sketch FROM t_string_a_d_through_e_h
          UNION ALL
          SELECT theta_sketch_agg(col2) as sketch FROM t_string_a_d_through_e_h);

-- Test theta_union_agg with BinaryType sketches
SELECT theta_sketch_estimate(theta_union_agg(sketch))
    FROM (SELECT theta_sketch_agg(col1) as sketch FROM t_binary_a_b_through_e_f
          UNION ALL
          SELECT theta_sketch_agg(col2) as sketch FROM t_binary_a_b_through_e_f);

-- Test theta_intersection_agg with IntegerType sketches
SELECT theta_sketch_estimate(theta_intersection_agg(sketch))
    FROM (SELECT theta_sketch_agg(col1) as sketch FROM t_int_1_5_through_7_11
          UNION ALL
          SELECT theta_sketch_agg(col2) as sketch FROM t_int_1_5_through_7_11);

-- Test theta_intersection_agg with DoubleType sketches
SELECT theta_sketch_estimate(theta_intersection_agg(sketch))
    FROM (SELECT theta_sketch_agg(col1) as sketch FROM t_double_1_1_1_4_through_1_5_1_8
          UNION ALL
          SELECT theta_sketch_agg(col2) as sketch FROM t_double_1_1_1_4_through_1_5_1_8);

-- Test theta_intersection_agg with ArrayType(IntegerType) sketches
SELECT theta_sketch_estimate(theta_intersection_agg(sketch))
    FROM (SELECT theta_sketch_agg(col1) as sketch FROM t_array_int_1_3_through_4_6
          UNION ALL
          SELECT theta_sketch_agg(col2) as sketch FROM t_array_int_1_3_through_4_6);

-- Test theta_sketch_agg with StringType and null values (nulls should be ignored)
SELECT theta_sketch_estimate(theta_sketch_agg(col))
FROM VALUES ('test'), (null), ('null'), (null) tab(col);

-- Test theta_sketch_agg with FloatType and null values (nulls should be ignored)
SELECT theta_sketch_estimate(theta_sketch_agg(CAST(col AS FLOAT)))
FROM VALUES (1.5), (null), (2.5), (null), (3.5) tab(col);

-- Test theta_sketch_agg with ArrayType(LongType) and null values (nulls should be ignored)
SELECT theta_sketch_estimate(theta_sketch_agg(col))
FROM VALUES (ARRAY(10L, 20L)), (null), (ARRAY(30L, 40L)), (null), (ARRAY(50L, 60L)) tab(col);

-- Test theta_sketch_agg with empty arrays
SELECT theta_sketch_estimate(theta_sketch_agg(col))
FROM VALUES (ARRAY()), (ARRAY(1, 2)), (ARRAY()), (ARRAY(3, 4)) tab(col);

-- Test theta_sketch_agg with collated string data
SELECT theta_sketch_estimate(theta_sketch_agg(col1)) utf8_b FROM t_string_collation;

SELECT theta_sketch_estimate(theta_sketch_agg(col1 COLLATE UNICODE_CI)) unicode_ci FROM t_string_collation;

SELECT theta_sketch_estimate(theta_sketch_agg(col1 COLLATE UNICODE_RTRIM)) unicode_rt FROM t_string_collation;

-- Negative test cases

-- Test theta_sketch_agg with lgNomEntries value of 2 (too low, minimum is 4) - should fail
SELECT theta_sketch_agg(col, 2)
FROM VALUES (50), (60), (60) tab(col);

-- Test theta_union_agg with lgNomEntries value of 27 (too high, maximum is 26) - should fail
SELECT theta_union_agg(sketch, 27)
FROM (SELECT theta_sketch_agg(col, 12) as sketch
        FROM VALUES (1) AS tab(col)
      UNION ALL
      SELECT theta_sketch_agg(col, 20) as sketch
        FROM VALUES (1) AS tab(col));

-- lgNomEntries parameter has wrong type (STRING instead of INT)
SELECT theta_sketch_agg(col, '15')
FROM VALUES (50), (60), (60) tab(col);

-- Test theta_difference with integers (1, 2) instead of binary sketch data - should fail
SELECT theta_difference(1, 2)
  FROM VALUES
    (1, 4),
    (2, 5),
    (3, 6) AS tab(col1, col2);

-- Test theta_sketch_estimate with invalid binary data ('abc') that is not a valid theta sketch - should fail
SELECT theta_sketch_estimate(CAST('abc' AS BINARY));

-- Test theta_difference with invalid binary data ('abc', 'def') that are not valid theta sketches - should fail
SELECT theta_difference(CAST('abc' AS BINARY), CAST('def' AS BINARY));

DROP TABLE IF EXISTS t_double_1_1_1_4_through_1_5_1_8;

DROP TABLE IF EXISTS t_binary_a_b_through_e_f;

-- time_bucket function tests



-- Pin session timezone to UTC. With UTC as the session zone, TIMESTAMP (LTZ)
-- bucketing produces the same results as TIMESTAMP_NTZ. The session-zone-aware
-- behavior is exercised in a dedicated `SET TIME ZONE 'America/Los_Angeles'`
-- section at the end of this file.
SET TIME ZONE 'UTC';

SELECT time_bucket(INTERVAL '0' YEAR, TIMESTAMP '2024-01-01 11:00:00');

SELECT time_bucket(INTERVAL '-1' YEAR, TIMESTAMP '2024-01-01 11:00:00');

SELECT time_bucket(INTERVAL '3' MONTH - INTERVAL '3' MONTH, TIMESTAMP '2024-06-20 09:47:00');

SELECT time_bucket(INTERVAL '1' HOUR, TIMESTAMP_NTZ '2024-01-01 11:27:00', TIMESTAMP '2024-01-01 00:00:00');

SELECT time_bucket(INTERVAL '15' MINUTE, '2024-01-15 10:23:00');

-- DATE and string cast to TIMESTAMP (LTZ). Mixing them with TIMESTAMP_NTZ
-- makes ts and origin different types, so the call is rejected.
SELECT time_bucket(INTERVAL '15' MINUTE, TIMESTAMP_NTZ '2024-01-15 10:23:00', DATE '2024-01-01');

SELECT time_bucket(INTERVAL '15' MINUTE, '2024-01-15 10:23:00', TIMESTAMP_NTZ '2024-01-01 00:00:00');

-- Non-foldable bucket_size via scalar subquery (DT and YM)
SELECT time_bucket((SELECT INTERVAL '1' HOUR), TIMESTAMP '2024-06-20 09:47:00');

SELECT time_bucket(INTERVAL '1' MONTH, TIMESTAMP '2024-06-20 09:47:00', o) FROM VALUES (TIMESTAMP '2024-01-01 00:00:00') tab(o);

-- 4-arg (too many)
SELECT time_bucket(INTERVAL '1' HOUR, TIMESTAMP '2024-01-01 11:27:00', TIMESTAMP '1970-01-01 00:00:00', TIMESTAMP '1970-01-01 00:00:00');

SELECT time_bucket(INTERVAL '1' HOUR, TIMESTAMP '2024-01-01 11:27:00', NULL);

SELECT time_bucket(INTERVAL '1' HOUR, NULL, TIMESTAMP_NTZ '2024-01-01 00:00:00');

-- 7-day (weekly) bucket (epoch is Thursday, so buckets run Thu-Wed)
SELECT time_bucket(INTERVAL '7' DAY, TIMESTAMP '2024-01-10 11:27:00');

-- DayTimeInterval bucket on TIMESTAMP_NTZ
SELECT time_bucket(INTERVAL '15' MINUTE, TIMESTAMP_NTZ '2024-01-01 11:27:00');

-- ts exactly equal to origin returns origin
SELECT time_bucket(INTERVAL '1' HOUR, TIMESTAMP '2024-01-01 11:27:00', TIMESTAMP '2024-01-01 11:27:00');

-- YearMonthInterval buckets: default (epoch) origin

-- 1-month bucket
SELECT time_bucket(INTERVAL '1' MONTH, TIMESTAMP '2024-03-15 11:27:00');

-- Compound YearMonthInterval (1 year 3 months = 15 months)
SELECT time_bucket(INTERVAL '1-3' YEAR TO MONTH, TIMESTAMP '2024-06-20 10:00:00');

-- YearMonthInterval buckets: explicit origin

-- Origin on 15th aligns grid to the 15th of each month
SELECT time_bucket(INTERVAL '1' MONTH, TIMESTAMP '2024-03-20 09:00:00', TIMESTAMP '1970-01-15 00:00:00');

-- Leap-year capping: origin Feb 29, 1-year bucket -> 2025-02-28 (non-leap target)
SELECT time_bucket(INTERVAL '1' YEAR, TIMESTAMP '2025-03-01 00:00:00', TIMESTAMP '2024-02-29 00:00:00');

-- Pre-epoch timestamps and origins

-- Pre-epoch ts, 1-day bucket
SELECT time_bucket(INTERVAL '1' DAY, TIMESTAMP '1969-12-31 23:30:00');

-- Pre-epoch ts, YearMonthInterval bucket
SELECT time_bucket(INTERVAL '1' MONTH, TIMESTAMP '1968-07-15 10:00:00');

-- Foldable YearMonthInterval arithmetic in bucket_size
SELECT time_bucket(INTERVAL '2' MONTH + INTERVAL '1' MONTH, TIMESTAMP '2024-06-20 09:47:00');

-- Column reference as ts

-- DayTimeInterval bucket over TIMESTAMP column (with one NULL row)
SELECT t, time_bucket(INTERVAL '1' HOUR, t) AS bucket
  FROM VALUES (TIMESTAMP '2024-01-15 10:23:00'), (TIMESTAMP '2024-01-15 14:45:00'), (CAST(NULL AS TIMESTAMP)) tab(t)
  ORDER BY t;

-- Nanosecond-precision timestamps (SPARK-57820): TIMESTAMP_NTZ(p) / TIMESTAMP_LTZ(p),
-- p in [7, 9]. Bucket boundaries fall on whole microseconds, so the result's sub-microsecond
-- digits always equal the origin's; only placement of `ts` needs nanosecond resolution.

-- DayTimeInterval bucket, default (epoch, zero sub-micro remainder) origin: result has no
-- fractional digits left (all-zero fraction renders as none).
SELECT time_bucket(INTERVAL '1' SECOND, CAST('2024-06-20 10:00:00.123456789' AS timestamp_ntz(9)));

-- Boundary case: ts lands on the same microsecond as a grid point, but with a smaller
-- sub-micro remainder than the origin's -- steps back to the previous bucket.
SELECT time_bucket(
  INTERVAL '1' SECOND,
  CAST('2024-06-20 10:00:04.000000100' AS timestamp_ntz(9)),
  CAST('1970-01-01 00:00:00.000000500' AS timestamp_ntz(9)));

-- Column reference as ts, TIMESTAMP_LTZ(p).
SELECT t, time_bucket(INTERVAL '1' HOUR, t) AS bucket
  FROM VALUES
    (CAST('2024-01-15 10:23:00.123456789' AS timestamp_ltz(9))),
    (CAST('2024-01-15 14:45:00.987654321' AS timestamp_ltz(9))) tab(t)
  ORDER BY t;

SELECT t, time_bucket(INTERVAL '1' MONTH, CAST(t AS TIMESTAMP_NTZ)) AS bucket
  FROM VALUES
    (TIMESTAMP '2024-02-15 10:00:00'),
    (TIMESTAMP '2024-03-15 10:00:00'),
    (TIMESTAMP '2024-04-15 10:00:00') tab(t)
  ORDER BY t;

-- Compound day-time bucket (36h) on LTZ across the fall-back day.
SELECT t, time_bucket(INTERVAL '36' HOUR, t, TIMESTAMP '2024-11-01 00:00:00') AS bucket
  FROM VALUES
    (TIMESTAMP '2024-11-05 11:30:00') tab(t);

-- window_with_cube
SELECT
  a,
  window.start,
  count(*) AS cnt
FROM ts_data
GROUP BY a, window(ts, '5 minutes') WITH CUBE
ORDER BY a, start;

-- window_having
SELECT
  window.start,
  count(*) AS cnt
FROM ts_data
GROUP BY window(ts, '5 minutes')
HAVING count(*) > 1
ORDER BY window.start;

-- tumbling_window_pre_epoch
SELECT
  window.start,
  window.end,
  count(*) AS cnt
FROM VALUES
  (CAST('1969-12-31 23:59:59.500000' AS TIMESTAMP)),
  (CAST('1969-12-31 23:55:00.000000' AS TIMESTAMP)),
  (CAST('1970-01-01 00:00:00.000000' AS TIMESTAMP))
AS tab(ts)
GROUP BY window(ts, '5 minutes')
ORDER BY start;

-- sliding_window_with_grouping_sets
SELECT
  a,
  window.start,
  count(*) AS cnt
FROM ts_data
GROUP BY GROUPING SETS ((a, window(ts, '5 minutes', '1 minute')), (a))
ORDER BY a, start;

-- sliding_window_in_subquery
SELECT * FROM (
  SELECT
    a,
    window.start AS ws,
    count(*) AS cnt
  FROM ts_data
  GROUP BY a, window(ts, '5 minutes', '1 minute')
) sub
ORDER BY a, ws;

-- session_window_with_rollup
SELECT
  a,
  session_window.start,
  count(*) AS cnt
FROM ts_data
GROUP BY a, session_window(ts, '5 minutes') WITH ROLLUP
ORDER BY a, start;

-- session_window_nested_in_expression
SELECT
  count(*) AS cnt
FROM ts_data
GROUP BY concat(cast(session_window(ts, '5 minutes').start AS string), a)
ORDER BY cnt;

-- session_window_pre_epoch
SELECT
  session_window.start,
  session_window.end,
  count(*) AS cnt
FROM VALUES
  (CAST('1969-12-31 23:59:59.500000' AS TIMESTAMP)),
  (CAST('1969-12-31 23:55:00.000000' AS TIMESTAMP)),
  (CAST('1970-01-01 00:00:00.000000' AS TIMESTAMP))
AS tab(ts)
GROUP BY session_window(ts, '5 minutes')
ORDER BY start;

-- window_1_hour
SELECT
  window.start,
  window.end,
  count(*) AS cnt
FROM ts_data
GROUP BY window(ts, '1 hour')
ORDER BY start;

-- sliding_window_ntz
SELECT
  window.start,
  window.end,
  count(*) AS cnt
FROM (
  SELECT TIMESTAMP_NTZ '2021-01-01 00:00:00' AS ts
  UNION ALL SELECT TIMESTAMP_NTZ '2021-01-01 00:04:30'
  UNION ALL SELECT TIMESTAMP_NTZ '2021-01-01 00:06:00'
)
GROUP BY window(ts, '10 minutes', '5 minutes')
ORDER BY window.start;

-- window_order_by_desc
SELECT
  window.start,
  window.end,
  count(*) AS cnt
FROM ts_data
GROUP BY window(ts, '5 minutes')
ORDER BY window.start DESC;

-- window_in_simple_project_sliding
SELECT window(ts, '7 minutes', '3 minutes').start AS bucket_start
FROM ts_data
ORDER BY bucket_start;

-- window_multiple_windows_error
SELECT count(*)
FROM ts_data
GROUP BY window(ts, '5 minutes'), window(ts, '10 minutes');

-- window_negative_duration
SELECT count(*)
FROM ts_data
GROUP BY window(ts, '-5 minutes');

-- window_select_star_error
SELECT *
FROM ts_data
GROUP BY a, window(ts, '5 minutes');

-- window_unparseable_interval
SELECT count(*)
FROM ts_data
GROUP BY window(ts, 'not_an_interval');

-- window_negative_slide_duration
SELECT count(*)
FROM ts_data
GROUP BY window(ts, '10 minutes', '-5 minutes');

-- negative_start_time
SELECT
  window.start,
  window.end,
  count(*) AS counts
FROM VALUES
  (CAST('2016-03-27 19:39:30' AS TIMESTAMP), 1, 'a'),
  (CAST('2016-03-27 19:39:25' AS TIMESTAMP), 2, 'a')
AS tab(time, value, id)
GROUP BY window(time, '10 seconds', '10 seconds', '-5 seconds')
ORDER BY window.start;

-- null_timestamps
SELECT
  window.start,
  window.end,
  sum(value) AS total
FROM VALUES
  (CAST('2016-03-27 09:00:05' AS TIMESTAMP), 1),
  (CAST('2016-03-27 09:00:32' AS TIMESTAMP), 2),
  (CAST(NULL AS TIMESTAMP), 3),
  (CAST(NULL AS TIMESTAMP), 4)
AS tab(time, value)
GROUP BY window(time, '10 seconds')
ORDER BY window.start;

-- window_multi_in_select_group_by_all
SELECT
  window(ts, '5 minutes').start AS bucket_start,
  window(ts, '5 minutes').end AS bucket_end,
  count(*) AS cnt
FROM ts_data
GROUP BY ALL
ORDER BY bucket_start;

-- window_time_ntz
WITH ts_ntz_data AS (
  SELECT TIMESTAMP_NTZ '2021-01-01 00:00:00' AS ts
  UNION ALL SELECT TIMESTAMP_NTZ '2021-01-01 00:04:30'
  UNION ALL SELECT TIMESTAMP_NTZ '2021-01-01 00:06:00'
)
SELECT window_time(window) AS event_time, count(*) AS cnt
FROM ts_ntz_data
GROUP BY window(ts, '5 minutes')
ORDER BY event_time;

-- nested_window_via_subquery
SELECT outer_window.start AS outer_start, outer_window.end AS outer_end, cnt
FROM (
  SELECT window(inner_window, '5 minutes') AS outer_window, sum(cnt) AS cnt
  FROM (
    SELECT window(ts, '1 minute') AS inner_window, count(*) AS cnt
    FROM ts_data
    GROUP BY window(ts, '1 minute')
  )
  GROUP BY window(inner_window, '5 minutes')
)
ORDER BY outer_start;

-- window_time_wrong_arity
SELECT window_time(window, window) FROM ts_data GROUP BY window(ts, '5 minutes');

-- window_time_struct_inline_rejected
SELECT window_time(named_struct('start', ts, 'end', ts + INTERVAL 1 MINUTE)) FROM ts_data;

-- window_in_simple_project_different_windows_error
SELECT
  window(ts, '5 minutes').start AS bucket_5,
  window(ts, '10 minutes').end AS bucket_10
FROM ts_data;

-- window_in_order_by_rejected
SELECT count(*) FROM ts_data GROUP BY ts ORDER BY window(ts, '5 minutes').start;

-- stacked_sibling_windows_on_same_base_rejected
SELECT
  window(window(ts, '1 minute'), '5 minutes').start,
  window(window(ts, '1 minute'), '10 minutes').end
FROM ts_data;

-- session_window_with_conditional_gap
SELECT
  a,
  session_window.start,
  session_window.end,
  count(*) AS cnt
FROM VALUES
  ('A1', CAST('2021-01-01 00:00:00' AS TIMESTAMP)),
  ('A1', CAST('2021-01-01 00:04:30' AS TIMESTAMP)),
  ('A1', CAST('2021-01-01 00:10:00' AS TIMESTAMP)),
  ('A2', CAST('2021-01-01 00:01:00' AS TIMESTAMP)),
  ('A2', CAST('2021-01-01 00:04:30' AS TIMESTAMP))
AS tab(a, ts)
GROUP BY a, session_window(ts, CASE WHEN a = 'A1' THEN '5 minutes'
                                    WHEN a = 'A2' THEN '1 minute'
                                    ELSE '10 minutes' END)
ORDER BY a, start;

-- session_window_null_timestamps
SELECT
  session_window.start,
  session_window.end,
  count(*) AS cnt
FROM VALUES
  (CAST(NULL AS TIMESTAMP)),
  (CAST('2021-01-01 00:00:00' AS TIMESTAMP)),
  (CAST('2021-01-01 00:01:00' AS TIMESTAMP))
AS tab(ts)
GROUP BY session_window(ts, '5 minutes')
ORDER BY start;

-- session_window_zero_gap
SELECT count(*) FROM ts_data GROUP BY session_window(ts, '0 seconds');

-- window_time_session_basic_rejected
SELECT window_time(session_window) AS event_time, count(*) AS cnt
FROM ts_data
GROUP BY session_window(ts, '5 minutes')
ORDER BY event_time;

-- session_window_select_star_error
SELECT * FROM ts_data GROUP BY a, session_window(ts, '5 minutes');

-- window_group_by_select_alias_window_only
SELECT window(ts, '10 minutes') AS w, COUNT(*) AS cnt
FROM VALUES
  ('g1', TIMESTAMP '2024-01-01 00:00:00'),
  ('g1', TIMESTAMP '2024-01-01 00:05:00')
AS t(grp, ts)
GROUP BY w;

-- window_group_by_select_alias_having_order_by
SELECT grp AS k, window(ts, '10 minutes') AS w, COUNT(*) AS cnt
FROM VALUES
  ('g1', TIMESTAMP '2024-01-01 00:00:00'),
  ('g1', TIMESTAMP '2024-01-01 00:05:00')
AS t(grp, ts)
GROUP BY k, w
HAVING cnt > 1
ORDER BY k, w;

-- window_in_window_order_by
SELECT grp, row_number() OVER (PARTITION BY grp ORDER BY window(ts, '10 minutes'), ts) AS rn
FROM VALUES
  ('g1', TIMESTAMP '2024-01-01 00:00:00'),
  ('g1', TIMESTAMP '2024-01-01 00:05:00')
AS t(grp, ts);

-- time literals, functions and operations

create temporary view timediff_view as select time'01:02:03' time_start, time'04:05:06' time_end, 'SECOND' unit;

select time '16:39:45\t';

-- SPARK-58296: a NULL format must not change the result type of `to_time` (stays TIME).
select typeof(to_time('00:12:00', null));

-- invalid: there is no 13 hours
select to_time("13-60", "HH-mm");

select try_to_time('12:48:31 abc');

select try_to_time('11:12:13', 'HH:mm:ss', 'SSSSSS');

select make_time(1, null, 19.87);

select make_time(1, 60, 19.87);

select make_time(1, 18, -999999999.999999);

select minute(to_time('23-59-58.987654', 'HH-mm-ss.SSSSSS'));

select extract(H from time'23:59:00.987654');

select extract(HRS from time'23:59:58.987654');

select extract(M from time'23:00:59.987654');

select extract(MINUTES from time'23:59:58.987654');

select extract(SECOND from time'00:0:00.100000');

select extract(SEC from time'00:00:00');

select extract(SECS from time'23:59:58.987654');

select extract(SECOND FROM cast('09:08:01.987654' as time(2)));

select extract(SECOND FROM cast('09:08:01.987654' as time(5)));

SELECT TIME'01:02:03';

SELECT TIME'23:59:59.9';

SELECT TIME'23:59:59.9999';

SELECT TIME'01:02:03 AM';

SELECT TIME'00:60:00';

SELECT TIME'00:00:00 PM';

SELECT TIME'12:60:00 AM';

SELECT TIME'13:00:00 PM';

-- cast string to time
SELECT cast("12:34:56" as time);

SELECT cast("12:34:56.789012" as time without time zone);

SELECT cast(time'11:59:59.999999' as time without time zone);

SELECT time_trunc('SECOND', time'12:34:56');

-- SPARK-51554: time truncation with various time precisions.
SELECT time_trunc('HOUR', time'12:34:56.1');

SELECT time_trunc('MILLISECOND', time'12:34:56.1');

SELECT time_trunc('MINUTE', time'12:34:56.123456');

SELECT time_trunc('MICROSECOND', time'12:34:56.123456');

SELECT time_trunc('SECOND', time'12:34:56.123456789');

-- SPARK-51554: time truncation with various unit cases.
SELECT time_trunc('hour', time'12:34:56');

SELECT time_trunc('SECOND', time'00:00:00');

-- SPARK-51554: time truncation with small time.
SELECT time_trunc('HOUR', time'00:00:00.000000001');

SELECT time_trunc('MILLISECOND', time'00:00:00.000000001');

SELECT time_trunc('MINUTE', time'23:59:59.999999999');

SELECT time_trunc('MICROSECOND', time'23:59:59.999999999');

SELECT time_trunc('MS', time'12:34:56');

SELECT time_trunc('ABCD', time'12:34:56');

SELECT time_trunc('INVALID_UNIT', time'12:34:56');

SELECT time_trunc(NULL, NULL);

SELECT time_trunc(unit, time_val) FROM trunc_time_view;

SELECT time("12:34:56.789012");

SELECT time(time'11:59:59.999999');

SELECT NULL + TIME'08:30';

SELECT '23:59:59.999999' :: TIME - INTERVAL '23:59:59.999999' HOUR TO SECOND;

SELECT '10:00:01' :: TIME(1) - INTERVAL '1' MONTH;

SELECT time_diff('SECOND', time'00:00:00', time'12:34:56');

-- SPARK-51555: positive and negative time difference.
SELECT time_diff('HOUR', time'01:02:03', time'12:34:56');

SELECT time_diff('HOUR', time'12:34:56', time'01:02:03');

-- SPARK-51555: time difference with various time precisions.
SELECT time_diff('HOUR', time'00:00:00', time'12:34:56.1');

SELECT time_diff('MILLISECOND', time'00:00:00', time'12:34:56.1');

SELECT time_diff('MINUTE', time'00:00:00', time'12:34:56.123456');

SELECT time_diff('MICROSECOND', time'00:00:00', time'12:34:56.123456');

SELECT time_diff('SECOND', time'00:00:00', time'12:34:56.123456789');

-- SPARK-51555: time difference with various unit cases.
SELECT time_diff('hour', time'00:00:00', time'12:34:56');

SELECT time_diff('SECOND', time'00:00:00', time'00:00:00');

-- SPARK-51555: time difference with small time.
SELECT time_diff('HOUR', time'00:00:00', time'00:00:00.000000001');

SELECT time_diff('MILLISECOND', time'00:00:00', time'00:00:00.000000001');

SELECT time_diff('MINUTE', time'00:00:00', time'23:59:59.999999999');

SELECT time_diff('MICROSECOND', time'00:00:00', time'23:59:59.999999999');

SELECT time_diff('MS', time'00:00:00', time'12:34:56');

SELECT time_diff('ABCD', time'00:00:00', time'12:34:56');

SELECT time_diff('INVALID_UNIT', time'00:00:00', time'12:34:56');

SELECT time_diff('MICROSECOND', time'00:00:00', NULL);

SELECT time_diff('MICROSECOND', NULL, NULL);

SELECT time_diff(unit, time'01:02:03', time_end) FROM timediff_view;

SELECT time_diff('SECOND', time_start, time'04:05:06') FROM timediff_view;

-- Subtract times
SELECT TIME'12:30:41' - TIME'10:00';

SELECT TIME'12:30:41.123' - TIMESTAMP'2025-07-11 10:00:01';

SELECT '00:00:00.1234' :: TIME(4) - TIME'23:59:59';

SELECT time_from_seconds(52200.5);

-- invalid: negative -> exception
SELECT time_from_seconds(86400);

-- time_from_millis (valid: 0 to 86399999)
SELECT time_from_millis(0);

SELECT time_from_millis(52200500);

-- invalid: negative -> exception
SELECT time_from_millis(86400000);

SELECT time_from_micros(43200);

SELECT time_from_micros(86399999999);

-- invalid: >= 86400000000 -> exception
SELECT time_from_micros(NULL);

SELECT time_to_seconds(TIME'14:30:00.5');

SELECT time_to_seconds(NULL);

SELECT time_to_millis(TIME'14:30:00.5');

SELECT time_to_millis(NULL);

SELECT time_to_micros(TIME'14:30:00.5');

SELECT time_to_micros(NULL);

SELECT time_to_millis(time_from_millis(52200500));

SELECT time_from_micros(time_to_micros(TIME'14:30:00.5'));

-- INTERSECT widens TIME(3) and TIME(6) to TIME(6); the matching value is compared at TIME(6).
SELECT typeof(c), c FROM (
  SELECT '01:02:03.456' :: TIME(3) AS c
    INTERSECT SELECT '01:02:03.456000' :: TIME(6));

-- CASE WHEN unifies its branches to TIME(6).
SELECT typeof(v), v FROM (SELECT CASE WHEN true
  THEN '12:34:56.789' :: TIME(3) ELSE '01:02:03.456789' :: TIME(6) END AS v);

SELECT greatest('12:34:56.789' :: TIME(3), '01:02:03.456789' :: TIME(6));

SELECT typeof(map('a', '12:34:56.789' :: TIME(3), 'b', '01:02:03.456789' :: TIME(6)));

-- Store assignment: widening TIME(3) -> TIME(6) succeeds, narrowing TIME(6) -> TIME(3) requires
-- an explicit cast.
CREATE TABLE time_widen_tbl (t6 TIME(6)) USING parquet;

DROP TABLE time_widen_tbl;

INSERT INTO time_narrow_tbl SELECT CAST('01:02:03.456789' :: TIME(6) AS TIME(3));

-- width_bucket over the TIME type: 09:00:00 .. 17:00:00 split into 8 one-hour buckets
select width_bucket(TIME'12:00:00', TIME'09:00:00', TIME'17:00:00', 8);

select width_bucket(TIME'08:00:00', TIME'09:00:00', TIME'17:00:00', 8);

-- null and degenerate inputs
select width_bucket(CAST(null AS TIME), TIME'09:00:00', TIME'17:00:00', 8);

SELECT CAST('2020-01-01 00:00:00.123456789' AS timestamp_ltz(8));

SELECT CAST('2020-01-01 00:00:00.000000999' AS timestamp_ltz(9));

SELECT CAST('2020-01-01 00:00:00.000000001' AS timestamp_ltz(7));

-- Nested values (array / map / struct).
SELECT array(CAST('2020-01-01 00:00:00.123456789' AS timestamp_ltz(9)));

-- NULL values (top-level and nested).
SELECT CAST(NULL AS timestamp_ltz(9));

SELECT named_struct('f', CAST(NULL AS timestamp_ltz(9)));

SELECT second(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789');

SELECT hour(NULL :: timestamp_ltz(9));

SELECT second(TIMESTAMP_LTZ '1960-01-01 13:24:35.123456789');

SELECT second(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789 Asia/Kolkata');

SELECT second(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789 UTC');

SELECT extract(SECOND FROM TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789');

SELECT date_part('SECOND', TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789');

SELECT extract(SECOND FROM NULL :: timestamp_ltz(9));

SELECT extract(SECOND FROM TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789 Asia/Kolkata');

SELECT year(v), quarter(v), month(v), day(v), dayofyear(v), dayofweek(v), weekday(v),
       weekofyear(v), extract(YEAROFWEEK FROM v)
  FROM VALUES (TIMESTAMP_LTZ '2021-01-01 00:00:00.000000001') AS t(v);

-- Pre-epoch and far-past dates exercise the negative-epoch / minimum-date path.
SELECT year(v), quarter(v), month(v), day(v), dayofyear(v), dayofweek(v), weekday(v),
       weekofyear(v), extract(YEAROFWEEK FROM v)
  FROM VALUES (TIMESTAMP_LTZ '1960-07-15 06:07:08.123456789') AS t(v);

SELECT year(v), month(v), day(v), dayofyear(v) FROM VALUES
  ('2020-02-29 13:24:35.999999999' :: timestamp_ltz(8)) AS t(v);

SELECT year(v), month(v), day(v) FROM VALUES
  (TIMESTAMP_LTZ '2020-01-01 04:00:00.123456789') AS t(v);

SELECT extract(MONTH FROM TIMESTAMP_LTZ '2020-02-29 12:00:00.123456789');

SELECT extract(WEEK FROM TIMESTAMP_LTZ '2021-01-01 12:00:00.123456789');

SELECT date_part('YEAROFWEEK', TIMESTAMP_LTZ '2021-01-01 00:00:00.000000001');

SELECT DATE '2020-01-01'::timestamp_ltz(7);

-- Zone-dependence: a UTC instant in the early hours of Jan 1 falls on Dec 31 in the session
-- zone (America/Los_Angeles, UTC-08:00), so LTZ -> DATE yields the previous calendar day.
SELECT TIMESTAMP_LTZ '2020-01-01 04:00:00.123456789 UTC'::date;

SELECT (NULL :: timestamp_ltz(9)) :: date;

SELECT map('k', TIMESTAMP_LTZ '2020-01-01 12:30:15.123456789') :: map<string, date>;

-- SPARK-60543: date_add / date_sub (and the dateadd alias) over TIMESTAMP_LTZ(p) cast the start to
-- DATE in the session zone like the micro type, so the sub-microsecond digits never affect the
-- result.
SELECT date_add(TIMESTAMP_LTZ '2020-02-28 23:59:59.999999999', 1);

SELECT date_sub('2020-01-01 12:00:00.12345678' :: timestamp_ltz(8), -1);

SELECT date_sub(TIMESTAMP_LTZ '2020-01-01 04:00:00.123456789 UTC', 1);

SELECT date_add(TIMESTAMP_LTZ '2020-01-01 04:00:00.123456789 UTC', 1);

-- Pre-epoch value exercises the negative-epoch path.
SELECT date_add(TIMESTAMP_LTZ '1969-12-31 23:59:59.999999999 UTC', 1);

-- SPARK-57501: TIMESTAMP_LTZ(p) +/- ANSI day-time interval preserves nanos remainder.
SELECT TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789 UTC' +
  INTERVAL '2 00:03:00.000456' DAY TO SECOND;

-- SPARK-57825: TIMESTAMP_LTZ(p) +/- ANSI year-month interval keeps the nanos type/precision and
-- carries the whole fraction (including the sub-microsecond digits) through unchanged; the month
-- shift is applied on the session-local wall clock.
SELECT TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789 UTC' + INTERVAL '1' YEAR;

SELECT TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789 UTC' - INTERVAL '1-2' YEAR TO MONTH;

-- Subtraction with a TIMESTAMP_LTZ(p) operand is rejected: the interval result only has
-- microsecond precision.
SELECT TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789 UTC' - TIMESTAMP_LTZ '2020-01-01 03:04:05.000000111 UTC';

-- The elapsed time in nanoseconds, and subtraction at microsecond precision after a cast.
SELECT unix_nanos(TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789 UTC') - unix_nanos(TIMESTAMP_LTZ '2020-01-01 03:04:05.000000111 UTC');

-- SPARK-57818: convert_timezone is NTZ-only, so a nanosecond LTZ(p) source is rejected rather
-- than silently reinterpreted as NTZ (the positive TIMESTAMP_NTZ(p) path is covered in
-- timestamp-ntz-nanos.sql).
SELECT convert_timezone('Europe/Brussels', 'Europe/Moscow',
    '2022-03-27 03:00:00.123456789 UTC' :: timestamp_ltz(9));

SELECT typeof(
    to_utc_timestamp('2015-07-24 00:00:00.1234567 UTC' :: timestamp_ltz(7), 'Asia/Kolkata'));

-- SPARK-57103: MAX / MIN over nanosecond-precision TIMESTAMP_LTZ. The aggregate preserves the
-- nanosecond type and orders by the sub-microsecond remainder; NULLs are ignored. Values are
-- rendered in the session time zone (America/Los_Angeles).
SELECT max(c), min(c) FROM VALUES
  (TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC'),
  (TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC'),
  (CAST(NULL AS timestamp_ltz(9))) AS t(c);

-- SPARK-56822: mode over nanosecond-precision TIMESTAMP_LTZ. Frequencies are counted on the full
-- nanos value, so the most-frequent value is selected down to the sub-microsecond and the result
-- type stays TIMESTAMP_LTZ(9); the value renders in the session time zone (America/Los_Angeles).
-- .000000001 appears twice, .000000999 once.
SELECT mode(c) FROM VALUES
  (TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC'),
  (TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC'),
  (TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC') AS t(c);

-- SPARK-57528: unix_timestamp / to_unix_timestamp over nanosecond-precision values. The result is
-- whole-second BIGINT; the sub-second digits are dropped. A literal without an explicit zone is
-- read in the session time zone (America/Los_Angeles, UTC-08:00); an explicit-zone literal fixes
-- the instant directly.
SELECT unix_timestamp(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789');

SELECT to_unix_timestamp('2020-01-01 13:24:35.000000001 UTC' :: timestamp_ltz(9));

-- NULL nanosecond timestamp.
SELECT unix_timestamp(NULL :: timestamp_ltz(9)), to_unix_timestamp(NULL :: timestamp_ltz(9));

-- SPARK-57527: unix_nanos over nanosecond-precision values returns DECIMAL(21, 0) nanoseconds since
-- the epoch. The explicit-zone literals below fix the instant directly, independent of the session
-- time zone. The sub-microsecond digits are kept, truncated to the type's precision.
SELECT unix_nanos(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789 UTC');

-- Far-future value: epochMicros * 1000 overflows a 64-bit BIGINT, exercising the DECIMAL path.
SELECT unix_nanos(TIMESTAMP_LTZ '9999-12-31 23:59:59.999999999 UTC');

-- SPARK-57526: timestamp_nanos builds a TIMESTAMP_LTZ(9) from a nanosecond count since the epoch.
-- An integral argument is accepted directly; the LTZ result renders in the session zone.
SELECT timestamp_nanos(1230219000123456789);

-- Out-of-range input: epochMicros overflows a 64-bit long, so the conversion fails at runtime.
SELECT timestamp_nanos(10000000000000000000000000BD);

-- SPARK-57454: implicit type coercion / widening over nanosecond TIMESTAMP_LTZ(p). The resolved
-- common type itself is unit-tested in TypeCoercionSuite / AnsiTypeCoercionSuite, and the operator
-- wiring (schema and boolean outcomes for UNION/coalesce/CASE/IN/comparison) in
-- TimestampNanosWideningSuite; the cases below complement those by locking the resolved type with
-- typeof() and the end-to-end rendered values, by covering operators those suites do not
-- (greatest/least and the array/map constructors), and by exercising the mixed time-zone family
-- rule that has no TIMESTAMP_NTZ counterpart. Values span the min/max supported instants, the 1582
-- Julian/Gregorian boundary (proleptic Gregorian), pre/post epoch, near-current values, varied
-- fractions / precisions, and non-standard source zones. Bare literals are interpreted in the
-- session zone (America/Los_Angeles) and so round-trip on rendering; an explicit source zone
-- (e.g. the sub-hour offsets Asia/Kolkata +05:30 and Asia/Kathmandu +05:45) shifts the rendered
-- wall clock deterministically.

-- UNION ALL widens micro -> nanos: the minimum and maximum supported instants.
SELECT typeof(c), c FROM (
    SELECT TIMESTAMP_LTZ '0001-01-01 00:00:00' AS c
    UNION ALL SELECT TIMESTAMP_LTZ '9999-12-31 23:59:59.999999999') ORDER BY c;

SELECT typeof(c), c FROM (
    SELECT '2020-01-01 00:00:00.12345678' :: timestamp_ltz(8) AS c
    UNION ALL SELECT '2021-07-15 12:34:56.123456789' :: timestamp_ltz(9)) ORDER BY c;

-- nanos <-> DATE widening: the minimum DATE adopts the nanos family, midnight in the session zone.
SELECT typeof(v), v FROM (SELECT coalesce(
    DATE '0001-01-01', '2020-01-01 00:00:00.12345678' :: timestamp_ltz(8)) AS v);

SELECT least('1970-01-01 00:00:00.0000001' :: timestamp_ltz(7),
    '1969-12-31 23:59:59.999999999' :: timestamp_ltz(9));

SELECT map('min', '0001-01-01 00:00:00.000000001' :: timestamp_ltz(9),
    'max', TIMESTAMP_LTZ '9999-12-31 23:59:59.999999');

SELECT typeof(coalesce('0001-01-01 00:00:00.0000001' :: timestamp_ntz(7),
    '2026-06-21 10:16:30.123456789 UTC' :: timestamp_ltz(9)));

-- row_number() over a nanosecond ORDER BY key: the row numbers follow the sub-microsecond order.
SELECT v, row_number() OVER (ORDER BY v) AS rn FROM (
    SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000900' AS v
    UNION ALL SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000100'
    UNION ALL SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000500') ORDER BY rn;

-- BETWEEN over nanosecond timestamps: only the value inside the sub-microsecond range qualifies.
SELECT c FROM VALUES
  (TIMESTAMP_LTZ '2020-01-02 03:04:05.000000001'),
  (TIMESTAMP_LTZ '2020-01-02 03:04:05.000000009') AS t(c)
  WHERE c BETWEEN '2020-01-02 03:04:05.000000001' AND '2020-01-02 03:04:05.000000005';

SELECT c = '2020-01-02 03:04:05.123456789',
       c < '2020-01-02 03:04:05.123456790'
  FROM VALUES (TIMESTAMP_LTZ '2020-01-02 03:04:05.123456789') AS t(c);

SELECT unix_millis(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789 UTC');

-- Pre-epoch value: floorDiv floors toward -inf, so unix_seconds -> -1 (not 0).
SELECT unix_seconds(TIMESTAMP_LTZ '1969-12-31 23:59:59.500000000 UTC');

SELECT date_format('2020-01-01 13:24:35.123456789' :: timestamp_ltz(8), 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

SELECT to_char(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

-- Pre-epoch value exercises the negative-epoch path.
SELECT date_format(TIMESTAMP_LTZ '1960-01-01 13:24:35.123456789 UTC', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

SELECT date_trunc('MICROSECOND', TIMESTAMP_LTZ '2020-01-01 12:34:56.123456789 UTC');

-- An unsupported (sub-microsecond) unit yields NULL; the result still carries the nanos type.
SELECT date_trunc('NANOSECOND', TIMESTAMP_LTZ '2020-01-01 12:34:56.123456789 UTC');

SELECT typeof(current_timestamp()), typeof(current_timestamp(6));

-- Out-of-range precision is rejected.
SELECT current_timestamp(3);

SELECT c FROM (SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC' AS c
    UNION ALL SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC')
  EXCEPT SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC' ORDER BY c;

SELECT TIMESTAMP_LTZ '2020-01-01 00:00:00.000001000 UTC'
    BETWEEN TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC'
        AND TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC';

SELECT typeof(v), v FROM (SELECT nvl(
    CAST(NULL AS timestamp_ltz(9)),
    TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC') AS v);

-- explode(array<ts_nanos>) yields one row per element.
SELECT typeof(col), col FROM (SELECT explode(array(
    TIMESTAMP_LTZ '2020-01-01 00:00:00.000000001 UTC',
    TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999 UTC'))) ORDER BY col;

-- map lookup by string key and by nanosecond key.
SELECT map('k', TIMESTAMP_LTZ '2020-01-01 00:00:00.123456789 UTC')['k'];

-- SPARK-57833: timestampadd over TIMESTAMP_LTZ(p). Units of MICROSECOND or coarser keep the
-- sub-microsecond fraction unchanged; the NANOSECOND unit adds whole nanoseconds and carries into
-- the microsecond (a negative quantity borrows across the boundary). The result stays nanos-typed.
SELECT timestampadd(SECOND, 5, TIMESTAMP_LTZ '2020-01-01 00:00:00.000000123 UTC');

SELECT timestampadd(NANOSECOND, -300, TIMESTAMP_LTZ '2020-01-01 00:00:00.000000100 UTC');

-- SPARK-57836: to_timestamp / to_timestamp_ltz / try_to_timestamp(str, fmt, p) parse up to 9
-- fractional digits into TIMESTAMP_LTZ(p), flooring the digits beyond p; p = 6 keeps TIMESTAMP.
-- A TIMESTAMP_LTZ(p) input keeps p.
SELECT to_timestamp('2020-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS', 9);

SELECT typeof(to_timestamp('2020-01-01 13:24:35.1', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS', 9)),
  typeof(to_timestamp_ltz('2020-01-01 13:24:35.1', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS', 6));

SELECT to_timestamp('bad', 'yyyy', 9);

SELECT to_timestamp(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789', 'yyyy', 7);

-- With a nanosecond input or result, a DATE or timestamp input ignores the format and
-- converts like CAST.
SELECT to_timestamp_ntz(TIMESTAMP_LTZ '2020-01-01 13:24:35.123456789', 'yyyy', 9);

-- Functions without TIMESTAMP_LTZ(p) support reject it in both ANSI modes instead of implicitly
-- narrowing it to a microsecond timestamp, DATE or TIME. Date-valued functions still take it
-- as DATE.
SELECT timestampdiff(MICROSECOND, TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999',
    TIMESTAMP_LTZ '2020-01-01 00:00:00.000001001');

SELECT session_window(c, '1 second')
  FROM VALUES (TIMESTAMP_LTZ '2020-01-01 12:00:00.123456789') AS t(c);

SELECT time_trunc('HOUR', c)
  FROM VALUES (TIMESTAMP_LTZ '2020-01-01 12:00:00.123456789') AS t(c);

SELECT timestampdiff(MICROSECOND, TIMESTAMP_LTZ '2020-01-01 00:00:00.000000999',
    TIMESTAMP_LTZ '2020-01-01 00:00:00.000001001');

-- A sub-microsecond midpoint that a double interpolation would lose.
SELECT median(c) FROM VALUES (TIMESTAMP_LTZ '2020-01-01 12:00:00.123456789 UTC'),
                             (TIMESTAMP_LTZ '2020-01-01 12:00:00.123456791 UTC') AS t(c);

-- At p=7 the midpoint .00000025 is floored to .0000002.
SELECT median(c), percentile(c, array(0.0, 1.0))
  FROM VALUES (CAST('2020-01-01 12:00:00.0000001 UTC' AS timestamp_ltz(7))),
              (CAST('2020-01-01 12:00:00.0000004 UTC' AS timestamp_ltz(7))) AS t(c);

SELECT typeof(median(c))
  FROM VALUES (CAST('2020-01-01 12:00:00.0000001 UTC' AS timestamp_ltz(7))) AS t(c);

SELECT CAST('today' AS timestamp_ltz(9)) = CAST(current_date() AS timestamp_ltz(9)),
       CAST('tomorrow' AS timestamp_ltz(8)) = CAST(current_date() + 1 AS timestamp_ltz(8)),
       CAST('yesterday' AS timestamp_ltz(7)) = CAST(current_date() - 1 AS timestamp_ltz(7));

SELECT CAST('epoch' AS timestamp_ltz(9)), CAST('epochs' AS timestamp_ltz(9));

-- `to_timestamp_ltz` can also take date input
select to_timestamp_ltz(to_date(null)), to_timestamp_ltz(to_date('2016-12-31'));

SELECT make_timestamp_ltz(2021, 07, 11, 6, 30, 45.678, 'CET');

-- TimestampLTZ date/time fields constructor
SELECT make_timestamp_ltz(make_date(2021, 07, 11), make_time(6, 30, 45.678));

-- Handling invalid input.
SELECT make_timestamp_ltz(timestamp_ntz'2018-11-17 13:33:33', TIME'0:0:0');

SELECT make_timestamp_ltz(make_date(2021, 07, 11), make_time(6, 30, 45.678), 'CET');

-- Handling NULL input.
SELECT try_make_timestamp_ltz(NULL, TIME'00:00:00');

SELECT try_make_timestamp_ltz(DATE'2025-06-20', timestamp_ntz'2018-11-17 13:33:33');

-- Nanosecond-precision TIMESTAMP_NTZ(p) (p in [7, 9]) in Hive results (SPARK-57257).
-- NTZ values are zone-independent.




-- Precision-driven fraction width: sub-p digits are floored.
SELECT CAST('2020-01-01 00:00:00.123456789' AS timestamp_ntz(7));

-- Trailing-zero trimming: an all-zero fraction renders as no fraction at all.
SELECT CAST('2020-01-01 00:00:00.999999000' AS timestamp_ntz(9));

SELECT CAST('2020-01-01 00:00:00.000000001' AS timestamp_ntz(8));

SELECT CAST('1960-01-01 00:00:00.123456789' AS timestamp_ntz(7));

SELECT named_struct('f', CAST('2020-01-01 00:00:00.123456789' AS timestamp_ntz(9)));

SELECT map('k', CAST(NULL AS timestamp_ntz(9)));

SELECT minute(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789');

SELECT second('2020-01-01 13:24:35.999999999' :: timestamp_ntz(8));

SELECT minute(TIMESTAMP_NTZ '1960-01-01 13:24:35.123456789');

SELECT extract(MINUTE FROM TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789');

SELECT date_part('MINUTE', TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789');

SELECT extract(SECOND FROM '2020-01-01 13:24:35.999999999' :: timestamp_ntz(8));

-- Date field functions over nanosecond-precision values (SPARK-57469). Date fields depend only
-- on the calendar date, so the precision, time-of-day and sub-microsecond digits never affect the
-- result; the values below exercise leap years, ISO-week and quarter boundaries, pre-epoch and
-- far-past dates, and varied precisions / fractions. Columns are year, quarter, month, day,
-- dayofyear, dayofweek (1=Sun..7=Sat), weekday (0=Mon..6=Sun), weekofyear (ISO), yearofweek (ISO).
SELECT year(v), quarter(v), month(v), day(v), dayofyear(v), dayofweek(v), weekday(v),
       weekofyear(v), extract(YEAROFWEEK FROM v)
  FROM VALUES (TIMESTAMP_NTZ '2020-02-29 23:59:59.999999999') AS t(v);

SELECT year(v), quarter(v), month(v), day(v), dayofyear(v), dayofweek(v), weekday(v),
       weekofyear(v), extract(YEAROFWEEK FROM v)
  FROM VALUES (TIMESTAMP_NTZ '2016-01-01 06:30:00.123456789') AS t(v);

SELECT year(v), quarter(v), month(v), day(v), dayofyear(v), dayofweek(v), weekday(v),
       weekofyear(v), extract(YEAROFWEEK FROM v)
  FROM VALUES (TIMESTAMP_NTZ '2020-12-31 23:59:59.999999999') AS t(v);

-- Precision (7/8/9) and fraction invariance: the same date read at different precisions and
-- fractions yields identical date fields.
SELECT year(v), month(v), day(v), dayofyear(v) FROM VALUES
  ('2020-02-29 13:24:35.000000001' :: timestamp_ntz(7)) AS t(v);

-- EXTRACT / date_part date components (rewrite transitively to the same functions).
SELECT extract(YEAR FROM TIMESTAMP_NTZ '2020-02-29 12:00:00.123456789');

SELECT extract(DOY FROM TIMESTAMP_NTZ '2020-02-29 12:00:00.123456789');

SELECT date_part('DOW', TIMESTAMP_NTZ '2020-02-29 00:00:00.000000001');

-- DATE <-> TIMESTAMP_NTZ(p) casts (SPARK-57323): midnight UTC / date extraction (zone-independent).
-- Nanosecond typed literals derive precision from the fractional digits (SPARK-57250).
SELECT DATE '2020-01-01'::timestamp_ntz(9);

SELECT TIMESTAMP_NTZ '1960-01-01 00:00:00.000000001'::date;

SELECT (NULL :: timestamp_ntz(9)) :: date;

SELECT map('k', TIMESTAMP_NTZ '2020-01-01 12:30:15.123456789') :: map<string, date>;

-- SPARK-60543: date_add / date_sub (and the dateadd alias) over TIMESTAMP_NTZ(p) cast the start to
-- DATE like the micro types, so the time of day and sub-microsecond digits never affect the result.
SELECT date_add(TIMESTAMP_NTZ '2020-02-28 23:59:59.999999999', 1);

SELECT date_sub('2020-01-01 12:00:00.12345678' :: timestamp_ntz(8), -1);

-- Same result as the micro type.
SELECT date_add(TIMESTAMP_NTZ '2020-01-01 00:00:00.123456789', 1),
       date_add(TIMESTAMP_NTZ '2020-01-01 00:00:00.123456', 1);

-- SPARK-57501: TIMESTAMP_NTZ(p) +/- ANSI day-time interval preserves nanos remainder.
SELECT TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' + INTERVAL '2 00:03:00.000456' DAY TO SECOND;

-- SPARK-57825: TIMESTAMP_NTZ(p) +/- ANSI year-month interval keeps the nanos type/precision and
-- carries the whole fraction (including the sub-microsecond digits) through unchanged; a month
-- shift never touches the time of day.
SELECT TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' + INTERVAL '1' YEAR;

SELECT TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' - INTERVAL '1-2' YEAR TO MONTH;

-- Subtraction with a TIMESTAMP_NTZ(p) operand is rejected: the interval result only has
-- microsecond precision. This holds in a filter, a subquery, and the folded VALUES rows,
-- EXECUTE IMMEDIATE arguments and PIVOT values too.
SELECT TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' - TIMESTAMP_NTZ '2020-01-01 03:04:05.000000111';

SELECT 1 WHERE TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' - TIMESTAMP_NTZ '2020-01-01 03:04:05' > INTERVAL '0' SECOND;

EXECUTE IMMEDIATE 'SELECT ?' USING TIMESTAMP_NTZ '2020-01-02 03:04:05.123456789' - TIMESTAMP_NTZ '2020-01-01 03:04:05';

SELECT unix_nanos(TIMESTAMP_NTZ '2020-01-02 00:00:00.000000789') - unix_nanos(CAST(DATE '2020-01-01' AS TIMESTAMP_NTZ(9)));

SELECT l.v, r.v FROM VALUES (TIMESTAMP_NTZ '2020-01-01 00:00:00.000002', 1) AS l(ts, v)
  ASOF JOIN VALUES (TIMESTAMP_NTZ '2020-01-01 00:00:00.000001100', 10), (TIMESTAMP_NTZ '2020-01-01 00:00:00.000001800', 20) AS r(ts, v)
  MATCH_CONDITION (l.ts >= r.ts);

-- SPARK-57818: convert_timezone over nanosecond-precision TIMESTAMP_NTZ. The sub-microsecond
-- remainder is carried through unchanged; only the whole-microsecond part shifts with the zone
-- offset, and the result keeps the source's exact precision.
SELECT convert_timezone('Europe/Brussels', 'Europe/Moscow',
    TIMESTAMP_NTZ '2022-03-27 03:00:00.123456789');

-- SPARK-59300: from_utc_timestamp / to_utc_timestamp over nanosecond-precision TIMESTAMP_NTZ. A
-- zone shift moves only the whole-microsecond instant, so the sub-microsecond remainder is carried
-- through unchanged and the result keeps the source's exact NTZ precision.
SELECT from_utc_timestamp(TIMESTAMP_NTZ '2015-07-24 00:00:00.123456789', 'America/Los_Angeles');

-- NULL nanosecond timestamp and NULL zone both propagate.
SELECT from_utc_timestamp(CAST(NULL AS timestamp_ntz(9)), 'America/Los_Angeles');

-- GROUP BY a nanosecond key: two keys that share epochMicros but differ within the microsecond
-- must not collapse into one group.
SELECT c, count(*) FROM VALUES
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001') AS t(c)
  GROUP BY c ORDER BY c;

-- SPARK-56822: collect_set over nanosecond-precision TIMESTAMP_NTZ. It deduplicates on the full
-- sub-microsecond value: the two .000000001 rows collapse to one, the .000000999 row stays, so the
-- sorted set has two distinct elements and the element type stays TIMESTAMP_NTZ(9). collect_set
-- order is non-deterministic, so the output is stabilized with sort_array.
SELECT sort_array(collect_set(c)) FROM VALUES
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001') AS t(c);

SELECT to_unix_timestamp(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789');

-- Pre-epoch value exercises the negative-epoch path (truncation toward zero).
SELECT unix_timestamp(TIMESTAMP_NTZ '1969-12-31 23:59:59.500000000');

-- DISTINCT over a nanosecond column: exact duplicates are removed, two values sharing epochMicros
-- but differing within the microsecond are both kept, and NULL survives as a single row. Three
-- rows: .000000001, .000000999, NULL.
SELECT DISTINCT c FROM VALUES
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001'),
  (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'),
  (CAST(NULL AS timestamp_ntz(9))) AS t(c)
  ORDER BY c;

SELECT unix_nanos('2020-01-01 13:24:35.123456789' :: timestamp_ntz(8));

-- NULL nanosecond timestamp.
SELECT unix_nanos(NULL :: timestamp_ntz(9));

-- The p=8 boundary widens to the wider precision (nanos(7)/nanos(8) -> nanos(8), nanos(8)/nanos(9)
-- -> nanos(9)); widening never floors, so each operand keeps its exact value and only the resolved
-- type moves up. typeof() locks the wider precision; the rendered fractions confirm neither operand
-- lost a digit (trailing zeros are trimmed on render, so the narrower value shows fewer digits).
SELECT typeof(c), c FROM (
    SELECT '2020-01-01 00:00:00.1234567' :: timestamp_ntz(7) AS c
    UNION ALL SELECT '2021-07-15 12:34:56.12345678' :: timestamp_ntz(8)) ORDER BY c;

-- CASE WHEN unifies its branches: a near-current value taken from the micro branch.
SELECT typeof(v), v FROM (SELECT CASE WHEN true
    THEN TIMESTAMP_NTZ '2026-06-21 10:16:30'
    ELSE '2026-06-21 10:16:30.987654321' :: timestamp_ntz(9) END AS v);

SELECT greatest(TIMESTAMP_NTZ '1500-03-01 12:00:00',
    '1582-10-15 00:00:00.123456789' :: timestamp_ntz(9),
    TIMESTAMP_NTZ '2026-06-21 10:16:30.5');

SELECT typeof(array(TIMESTAMP_NTZ '9999-12-31 23:59:59',
    '0001-01-01 00:00:00.000000001' :: timestamp_ntz(9)));

-- row_number() over a nanosecond ORDER BY key: the row numbers follow the sub-microsecond order.
SELECT v, row_number() OVER (ORDER BY v) AS rn FROM (
    SELECT TIMESTAMP_NTZ '2020-01-01 00:00:00.000000900' AS v
    UNION ALL SELECT TIMESTAMP_NTZ '2020-01-01 00:00:00.000000100'
    UNION ALL SELECT TIMESTAMP_NTZ '2020-01-01 00:00:00.000000500') ORDER BY rn;

-- BETWEEN over nanosecond timestamps: only the value inside the sub-microsecond range qualifies.
SELECT c FROM VALUES
  (TIMESTAMP_NTZ '2020-01-02 03:04:05.000000001'),
  (TIMESTAMP_NTZ '2020-01-02 03:04:05.000000009') AS t(c)
  WHERE c BETWEEN '2020-01-02 03:04:05.000000001' AND '2020-01-02 03:04:05.000000005';

-- SPARK-57814: unix_seconds / unix_millis / unix_micros over nanosecond-precision values. The result
-- is a whole BIGINT count of the unit; sub-unit digits (incl. the sub-microsecond remainder) are
-- dropped and NTZ applies no zone shift, so the wall-clock value is read as the epoch instant.
SELECT unix_seconds(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789');

SELECT unix_micros('2020-01-01 13:24:35.999999999' :: timestamp_ntz(7));

-- SPARK-57816: date_format / to_char / to_varchar over nanosecond-precision values. The pattern's
-- fractional-second placeholders render up to nanosecond digits; a 9-`S` field is fixed width, so
-- digits below the type's precision floor to zeros rather than being dropped. NTZ renders its
-- wall clock zone-independently. to_char / to_varchar route through the same code path.
SELECT date_format(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

SELECT to_char(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

-- Pre-epoch value exercises the negative-epoch path.
SELECT date_format(TIMESTAMP_NTZ '1960-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS');

SELECT date_trunc('MICROSECOND', TIMESTAMP_NTZ '2020-01-01 12:34:56.123456789');

-- An unsupported (sub-microsecond) unit yields NULL; the result still carries the nanos type.
SELECT date_trunc('NANOSECOND', TIMESTAMP_NTZ '2020-01-01 12:34:56.123456789');

-- A foldable (constant) precision expression is accepted.
SELECT typeof(localtimestamp(8 + 1));

SELECT localtimestamp(10);

-- Mixed-precision set op widens to the wider precision; the equal instant matches after widening.
SELECT typeof(c), c FROM (
    (SELECT '2020-01-01 00:00:00.0000009' :: timestamp_ntz(7) AS c)
     INTERSECT (SELECT '2020-01-01 00:00:00.000000900' :: timestamp_ntz(9))) ORDER BY c;

-- Mixed-precision BETWEEN widens the bounds to the probe's precision.
SELECT '2020-01-01 00:00:00.000000500' :: timestamp_ntz(9)
    BETWEEN '2020-01-01 00:00:00.0000001' :: timestamp_ntz(7)
        AND TIMESTAMP_NTZ '2020-01-01 00:00:00.000001';

SELECT ifnull(TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001', CAST(NULL AS timestamp_ntz(9)));

SELECT typeof((SELECT TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'));

-- EXISTS (correlated on a nanos equality): the outer row is kept iff a matching nanos key exists
-- in the subquery relation. Only the .000000999 row correlates to s.v.
SELECT k FROM VALUES
    (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001'),
    (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999') AS t(k)
  WHERE EXISTS (SELECT 1 FROM VALUES
    (TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999') AS s(v)
    WHERE s.v = t.k) ORDER BY k;

-- Mixed-precision NOT IN widens the probe to p=9 before the anti-join. The p=7 value .0000009
-- becomes .000000900 at p=9, which is not .000000999, so the row is not in the set and is kept.
SELECT k FROM VALUES
    ('2020-01-01 00:00:00.0000009' :: timestamp_ntz(7)) AS t(k)
  WHERE k NOT IN (SELECT TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999') ORDER BY k;

-- element_at over array<ts_nanos> (1-based) returns the addressed element unchanged.
SELECT element_at(array(
    TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001',
    TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'), 2);

SELECT map(TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001', 'a',
           TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999', 'b')[
       TIMESTAMP_NTZ '2020-01-01 00:00:00.000000999'];

SELECT timestampadd(MICROSECOND, 2, TIMESTAMP_NTZ '2020-01-01 00:00:00.000000123');

SELECT timestampadd(NANOSECOND, -300, TIMESTAMP_NTZ '2020-01-01 00:00:00.000000100');

SELECT timestampadd(NANOSECOND, 50, '2020-01-01 00:00:00.0000001' :: timestamp_ntz(7));

SELECT to_timestamp_ntz('2020-01-01 13:24:35.123456789', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS', 7);

SELECT to_timestamp_ntz('2020-01-01 13:24:35.123456789 UTC', 'yyyy-MM-dd HH:mm:ss.SSSSSSSSS z', 9);

SELECT to_timestamp_ntz(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789'),
  typeof(to_timestamp_ntz(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789'));

SELECT to_timestamp(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789'),
  typeof(to_timestamp(TIMESTAMP_NTZ '2020-01-01 13:24:35.123456789'));

SELECT to_timestamp_ntz(DATE '2020-01-01', 'yyyy-MM-dd', 9);

SELECT months_between(TIMESTAMP_NTZ '2020-02-01 00:00:00.000000001',
    TIMESTAMP_NTZ '2020-01-01 00:00:00.000000001');

SELECT percentile_approx(c, 0.5)
  FROM VALUES (TIMESTAMP_NTZ '2020-01-01 12:00:00.123456789') AS t(c);

SELECT time_diff('SECOND', TIME '12:00:00', c)
  FROM VALUES (TIMESTAMP_NTZ '2020-01-01 12:00:00.123456789') AS t(c);

-- percentile / median / percentile_cont / percentile_disc over TIMESTAMP_NTZ(p) keep the input
-- type. Interpolation is exact in nanoseconds and floored to p; percentile_disc returns an input
-- value; NULLs are ignored.
SELECT median(c), percentile(c, 0.25), percentile_cont(0.75) WITHIN GROUP (ORDER BY c),
       percentile_cont(0.25) WITHIN GROUP (ORDER BY c DESC),
       percentile_disc(0.5) WITHIN GROUP (ORDER BY c)
  FROM VALUES (TIMESTAMP_NTZ '2020-01-01 12:00:00.000000100'),
              (TIMESTAMP_NTZ '2020-01-01 12:00:00.000000400'),
              (TIMESTAMP_NTZ '2020-01-01 12:00:00.000001000'), (NULL) AS t(c);

-- Pre-epoch: the midpoint -499.5ns is floored to -500ns.
SELECT median(c) FROM VALUES (TIMESTAMP_NTZ '1969-12-31 23:59:59.999999000'),
                             (TIMESTAMP_NTZ '1970-01-01 00:00:00.000000001') AS t(c);

-- As a window function, and with a frequency column.
SELECT k, median(c) OVER (PARTITION BY k)
  FROM VALUES (1, TIMESTAMP_NTZ '2020-01-01 12:00:00.000000001'),
              (1, TIMESTAMP_NTZ '2020-01-01 12:00:00.000000003'),
              (2, TIMESTAMP_NTZ '2020-01-01 12:00:00.000000005') AS t(k, c);

SELECT typeof(median(c))
  FROM VALUES (CAST('2020-01-01 12:00:00.0000001' AS timestamp_ntz(7))) AS t(c);

SELECT CAST('today' AS timestamp_ntz(9)) = CAST(current_date() AS timestamp_ntz(9)),
       CAST('tomorrow' AS timestamp_ntz(8)) = CAST(current_date() + 1 AS timestamp_ntz(8)),
       CAST('yesterday' AS timestamp_ntz(7)) = CAST(current_date() - 1 AS timestamp_ntz(7));

SELECT CAST('epoch' AS timestamp_ntz(9)), CAST('epochs' AS timestamp_ntz(9));

-- `to_timestamp_ntz` can also take date input
select to_timestamp_ntz(to_date(null)), to_timestamp_ntz(to_date('2016-12-31'));

-- make_timestamp_ntz should not accept time zone input
SELECT make_timestamp_ntz(2021, 07, 11, 6, 30, 45.678, 'CET');

SELECT make_timestamp_ntz(make_date(2021, 07, 11), make_time(6, 30, 45.678));

SELECT make_timestamp_ntz(timestamp_ntz'2018-11-17 13:33:33', TIME'0:0:0');

SELECT try_make_timestamp_ntz(NULL, TIME'23:59:59.00001');

SELECT try_make_timestamp_ntz(DATE'2025-06-20', 10D);

-- Get the difference between timestamps w/o time zone in the specified units
select timestampdiff(QUARTER, timestamp_ntz'2022-01-01 01:02:03', timestamp_ntz'2022-05-02 05:06:07');

select timestampdiff(MILLISECOND, timestamp_ntz'2022-02-14 23:59:59.123', date'2022-02-15');

select timestamp_ntz'2022-01-01 00:00:00' < date'2022-01-01';

select timestamp_ntz'2022-01-01 00:00:00' < timestamp_ltz'2022-01-01 00:00:00';

DESC FORMATTED a;

-- timestamp literals, functions and operations

select timestamp '2019-01-01\t';

-- invalid: minute field can have at most 2 digits
select timestamp'2021-01-01T12:30:4294967297.123456';

select localtimestamp() = localtimestamp();

SELECT make_timestamp(2021, 07, 11, 6, 30, 60.007);

SELECT make_timestamp(1, 1, 1, 1, 1, 61);

SELECT make_timestamp(1, 1, 1, 1, 1, 99.999999);

SELECT try_make_timestamp(1, 1, 1, 1, 1, 4324.967296);

SELECT make_timestamp(NULL);

SELECT make_timestamp(NULL, TIME'00:00:00');

-- SPARK-51415: timestamp date + time + timezone constructor.
SELECT make_timestamp(make_date(2021, 07, 11), make_time(6, 30, 45.678), 'MIT');

SELECT make_timestamp(make_date(2021, 07, 11), make_time(6, 30, 45.678), 'CET');

SELECT make_timestamp(NULL, TIME'00:00:00', 'UTC');

SELECT make_timestamp(NULL, NULL, 'UTC');

SELECT make_timestamp(NULL, NULL, NULL);

SELECT make_timestamp(DATE'1970-01-01', timestamp '2018-11-17 13:33:33', 'CET');

SELECT try_make_timestamp(make_date(2021, 07, 11), make_time(6, 30, 45.678));

SELECT try_make_timestamp(NULL, NULL);

SELECT try_make_timestamp(DATE'1970-01-01', timestamp_ntz '2018-11-17 13:33:33', 'CET');

select TIMESTAMP_MILLIS(1230219000123),TIMESTAMP_MILLIS(-1230219000123),TIMESTAMP_MILLIS(null);

select TIMESTAMP_SECONDS(-1230219000123123);

-- truncate exception
select TIMESTAMP_SECONDS(0.1234567);

select typeof(current_date), typeof(current_timestamp) from ttf1;

select a, b from ttf2 order by a, current_date;

select UNIX_MICROS(timestamp'2020-12-01 14:30:08Z'), UNIX_MICROS(timestamp'2020-12-01 14:30:08.999999Z'), UNIX_MICROS(null);

select to_timestamp('2019-10-06 10:11:12.0', 'yyyy-MM-dd HH:mm:ss.SSSSSS[zzz]');

select to_timestamp('2019-10-06 10:11:12.123UTC', 'yyyy-MM-dd HH:mm:ss.SSSSSS[zzz]');

select to_timestamp('2019-10-06 10:11:12.123456PST', 'yyyy-MM-dd HH:mm:ss.SSSSSS[zzz]');

select to_timestamp('223456 2019-10-06 10:11:12.123456PST', 'SSSSSS yyyy-MM-dd HH:mm:ss.SSSSSS[zzz]');

select to_timestamp('2019-10-06 10:11:12', 'yyyy-MM-dd HH:mm:ss[.SSSSSS]');

select to_timestamp("2019-10-06S10:11:12.12345", "yyyy-MM-dd'S'HH:mm:ss.SSSSSS");

select to_timestamp("12.1232019-10-06S10:11", "ss.SSSSyy-MM-dd'S'HH:mm");

select to_timestamp("S2019-10-06", "'S'yyyy-MM-dd");

-- tail
select to_timestamp("'2019-10-06T10:11:12", "''yyyy-MM-dd'T'HH:mm:ss");

select to_timestamp("02-29", "MM-dd");

-- timestamp - timestamp
select timestamp'2011-11-11 11:11:11' - timestamp'2011-11-11 11:11:10';

-- if one side is string/null literal, promote it to timestamp type.
select timestamp'2011-11-11 11:11:11' - '2011-11-11 11:11:10';

select null - timestamp'2011-11-11 11:11:11';

select timestamp'2011-11-11 11:11:11' - str from ts_view;

-- null result: timestamp + null
select timestamp'2011-11-11 11:11:11' + null;

-- promote date to timestamp if the interval is hour to second.
select date '2012-01-01' - interval 3 hours,
       date '2012-01-01' + interval '12:12:12' hour to second,
       interval '2' minute + date '2012-01-01';

select to_timestamp('22 05 2020 Friday', 'dd MM yyyy EEEEE');

select from_csv('26/October/2015', 't Timestamp', map('timestampFormat', 'dd/MMMMM/yyyy'));

select timestampadd(YEAR, 1, date'2022-02-15');

select timestampadd('SECOND', -1, date'2022-02-15');

select timestampdiff(YEAR, date'2022-02-15', date'2023-02-15');

select timestampdiff('YEAR', date'2022-02-15', date'2023-02-15');

select timediff(HOUR, timestamp'2022-02-14 01:02:03', timestamp'2022-02-14 12:00:03');

select timediff('MINUTE', timestamp'2023-02-14 01:02:03', timestamp'2023-02-14 02:00:03');

-- valid time zones
SET TIME ZONE 'Asia/Hong_Kong';

SET TIME ZONE INTERVAL '15:40:32' HOUR TO SECOND;

SET TIME ZONE 'invalid/zone';

SET TIME ZONE INTERVAL '19:40:32' HOUR TO SECOND;

-- Timezone should be applied recursively
SELECT NANVL(col1, NULL) FROM t1;

set variable avro_schema =
  '{ "type": "record", "name": "struct", "fields": [{ "name": "u", "type": ["int","string"] }] }';

select to_avro(s, 42) from t;

-- Clean up.
drop temporary variable avro_schema;

CREATE OR REPLACE TEMPORARY VIEW complex_trans AS SELECT * FROM VALUES
(1, 1),
(1, 1),
(2, 2),
(2, 2),
(3, 3),
(2, 2),
(3, 3),
(1, 1),
(3, 3)
as complex_trans(a, b);

-- common supported data types between no serde and serde transform
SELECT a, b, decode(c, 'UTF-8'), d, e, f, g, h, i, j, k, l FROM (
  SELECT TRANSFORM(a, b, c, d, e, f, g, h, i, j, k, l)
  USING 'cat' AS (
    a string,
    b string,
    c string,
    d string,
    e string,
    f string,
    g string,
    h string,
    i string,
    j string,
    k string,
    l string)
  FROM t
) tmp;

SELECT TRANSFORM(a, b, c)
USING 'cat'
FROM t;

-- transform use MAP
MAP a, b USING 'cat' AS (a, b) FROM t;

SELECT TRANSFORM(a, b, c, null)
  ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '@'
  LINES TERMINATED BY '\n'
  NULL DEFINED AS 'NULL'
USING 'cat' AS (d)
  ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '@'
  LINES TERMINATED BY '\n'
  NULL DEFINED AS 'NULL'
FROM t;

SELECT TRANSFORM(a, b, c, null)
  ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '@'
  LINES TERMINATED BY '\n'
  NULL DEFINED AS 'XXXX'
USING 'cat' AS (a, b, c, d)
  ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '@'
  LINES TERMINATED BY '\n'
FROM t;

-- transform with defined row format delimit handle schema with wrong type
SELECT a, b, decode(c, 'UTF-8'), d, e, f, g, h, i, j, k, l FROM (
  SELECT TRANSFORM(a, b, c, d, e, f, g, h, i, j, k, l)
    ROW FORMAT DELIMITED
    FIELDS TERMINATED BY ','
    LINES TERMINATED BY '\n'
    NULL DEFINED AS 'NULL'
    USING 'cat' AS (
      a string,
      b long,
      c binary,
      d tinyint,
      e int,
      f smallint,
      g long,
      h float,
      i double,
      j decimal(38, 18),
      k int,
      l long)
    ROW FORMAT DELIMITED
    FIELDS TERMINATED BY ','
    LINES TERMINATED BY '\n'
    NULL DEFINED AS 'NULL'
  FROM t
) tmp;

SELECT TRANSFORM(1, 2, 3)
  USING 'cat' AS (a, b, c)
FROM script_trans
WHERE a <= 4;

SELECT TRANSFORM(b, a, c + 1)
  USING 'cat' AS (a, b, c)
FROM script_trans
WHERE a <= 4;

SELECT TRANSFORM(b, MAX(a) FILTER (WHERE a > 3), CAST(SUM(c) AS STRING))
  USING 'cat' AS (a,b,c)
FROM script_trans
WHERE a <= 4
GROUP BY b;

SELECT TRANSFORM(b, MAX(a), CAST(SUM(c) AS STRING))
  USING 'cat' AS (a, b, c)
FROM script_trans
WHERE a <= 4
GROUP BY b
HAVING MAX(a) > 1;

FROM(
  FROM script_trans
  SELECT TRANSFORM(a, b)
    USING 'cat' AS (`a` INT, b STRING)
) t
SELECT a + 1;

FROM (SELECT 1 AS key, 100 AS value) src
MAP src.*, src.key, CAST(src.key / 10 AS INT), CAST(src.key % 10 AS INT), src.value
  USING 'cat' AS (k, v, tkey, ten, one, tvalue);

SELECT TRANSFORM(DISTINCT b, a, c)
  USING 'cat' AS (a, b, c)
FROM script_trans
WHERE a <= 4;

SELECT TRANSFORM(b b_1, MAX(a), CAST(sum(c) AS STRING))
  USING 'cat' AS (a, b, c)
FROM script_trans
WHERE a <= 2
GROUP BY b;

FROM (
  SELECT TRANSFORM(a, b)
    USING 'cat' AS (a, b)
  FROM complex_trans
  ORDER BY a
) map_output
SELECT TRANSFORM(a, b)
  USING 'cat' AS (a, b);

select try_to_binary('  ', 'base64');

select try_to_binary(' ab cdef= = ', 'base64');

select try_to_binary('a?', 'base64');

select try_to_binary('a===', 'base64');

select try_to_binary('大千世界', 'utf8');

-- hex valid
select try_to_binary('737472696E67');

select try_to_binary('1', 'hex');

select try_to_binary('12345');

-- 'format' parameter can be any foldable string value, not just literal.
select try_to_binary('abc', concat('utf', '-8'));

-- 'format' parameter is case insensitive.
select try_to_binary('abc', 'Hex');

select try_to_binary(null, null);

select try_to_binary('abc', 'invalidFormat');

SELECT try_sum(col) FROM VALUES (NULL), (10), (15) AS tab(col);

-- test overflow in Decimal(38, 0)
SELECT try_sum(col) FROM VALUES (98765432109876543210987654321098765432BD), (98765432109876543210987654321098765432BD) AS tab(col);

SELECT try_sum(col) FROM VALUES (interval '1 seconds'), (interval '1 seconds') AS tab(col);

SELECT try_sum(col / 0) FROM VALUES (5.0), (10.0), (15.0) AS tab(col);

SELECT try_sum(col / 0) FROM VALUES (interval '1 months'), (interval '1 months') AS tab(col);

SELECT try_avg(col) FROM VALUES (5.0), (10.0), (15.0) AS tab(col);

SELECT try_avg(col) FROM VALUES (9223372036854775807L), (1L) AS tab(col);

SELECT try_avg(col) FROM VALUES (interval '2147483647 months'), (interval '1 months') AS tab(col);

-- errors in child should be shown in ANSI mode
SELECT try_avg(col / 0) FROM VALUES (5), (10), (15) AS tab(col);

SELECT try_avg(col + 1L) FROM VALUES (9223372036854775807L), (1L) AS tab(col);

-- Numeric + Numeric
SELECT try_add(1, 1);

SELECT try_add(2147483647, "1");

SELECT try_add(-9223372036854775808L, -1);

SELECT try_add(1, 1.0 / 0.0);

SELECT try_add(1, date'2021-01-01');

SELECT try_add(interval 2 year, date'2021-01-01');

SELECT try_add(timestamp_ntz'2021-01-01 00:00:00', interval 2 second);

-- Time + Interval
SELECT try_add(time'08:00:00', interval 1 hour);

SELECT try_add(time'00:00:00', interval -1 second);

-- Interval + Interval
SELECT try_add(interval 2 year, interval 2 year);

SELECT try_add(interval 2147483647 month, interval 2 month);

SELECT try_divide(1, 0);

SELECT try_divide(1L, (9223372036854775807L + 1L));

SELECT try_divide(1, "0");

SELECT try_divide(interval 2 second, 2);

SELECT try_divide(interval 2147483647 month, 0.5);

SELECT try_subtract(2147483647, -1);

SELECT try_subtract(-2147483648, 1);

SELECT try_subtract(1, (2147483647 + 1));

SELECT try_subtract(sum(1), 1) GROUP BY ALL;

SELECT try_subtract(interval 2147483647 month, interval -2 month);

SELECT try_subtract(time'00:30:00', interval 1 hour);

-- Time - Time
SELECT try_subtract(time'10:00:00', time'08:00:00');

-- Numeric * Numeric
SELECT try_multiply(2, 3);

SELECT try_multiply(2147483647, "-2");

SELECT try_multiply(-9223372036854775808L, -2);

SELECT try_multiply(1, 1.0 / 0.0);

SELECT try_multiply(interval 2 second, 2);

SELECT try_multiply(interval 2147483647 month, 2);

SELECT TRY_CAST('1.23' AS long);

-- TRY_CAST string which are not numbers to integral should return null
SELECT TRY_CAST('abc' AS int);

SELECT TRY_CAST('' AS long);

-- TRY_CAST invalid decimal string to integral should return null
SELECT TRY_CAST('123.a' AS int);

SELECT TRY_CAST('-2147483649' AS int);

-- '-9223372036854775808' is the smallest long value
SELECT TRY_CAST('-9223372036854775808' AS long);

SELECT TRY_CAST('9223372036854775808' AS long);

-- TRY_CAST string to boolean
select TRY_CAST('true' as boolean);

-- TRY_CAST string to date
SELECT TRY_CAST("2021-01-01" AS date);

SELECT TRY_CAST("2021-101-01 00:00:00" AS timestamp);

SELECT TRY_CAST("24:00:00" AS time);

select try_to_timestamp(1);

select try_to_timestamp("02-29", "MM-dd");

select try_to_time('24-00', 'HH-mm');

SELECT try_element_at(array(1, 2, 3), 3);

SELECT try_element_at(array(1, 2, 3), -4);

-- map input
SELECT try_element_at(map('a','b'), 'a');

SELECT try_reflect("java.lang.String", "valueOf", 1);

SELECT try_reflect("java.lang.Integer", "valueOf", "10", 16);

SELECT try_reflect("java.wrongclass.Math", "max", 2, 3);

SELECT try_reflect("java.lang.Math", "round", 2.5);

CREATE TABLE t_int_double_1_5_through_7_11 AS
VALUES
  (1, 1.0D, 5, 5.0D), (2, 2.0D, 6, 6.0D), (3, 3.0D, 7, 7.0D),
  (4, 4.0D, 8, 8.0D), (5, 5.0D, 9, 9.0D), (6, 6.0D, 10, 10.0D),
  (7, 7.0D, 11, 11.0D) AS tab(key1, val1, key2, val2);

-- Double key with double values
DROP TABLE IF EXISTS t_double_double_1_1_1_4_through_1_5_1_8;

CREATE TABLE t_float_double_1_1_1_4_through_1_5_1_8 AS
SELECT CAST(key1 AS FLOAT) key1, CAST(val1 AS DOUBLE) AS val1,
       CAST(key2 AS FLOAT) key2, CAST(val2 AS DOUBLE) AS val2
FROM VALUES
  (1.1, 1.0, 1.4, 4.0), (1.2, 2.0, 1.5, 5.0), (1.3, 3.0, 1.6, 6.0),
  (1.4, 4.0, 1.7, 7.0), (1.5, 5.0, 1.8, 8.0) AS tab(key1, val1, key2, val2);

-- Binary key with double values
DROP TABLE IF EXISTS t_binary_double_a_b_through_e_f;

CREATE TABLE t_array_int_double_1_3_through_4_6 AS
VALUES
  (ARRAY(1), 1.00D, ARRAY(3), 3.00D),
  (ARRAY(2), 2.00D, ARRAY(4), 4.00D),
  (ARRAY(3), 3.00D, ARRAY(5), 5.00D),
  (ARRAY(4), 4.00D, ARRAY(6), 6.00D) AS tab(key1, val1, key2, val2);

-- Integer key with integer values
DROP TABLE IF EXISTS t_int_int_1_5_through_7_11;

-- Test basic tuple_sketch_agg_double with IntegerType key and double summary from table
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1)) AS result
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_agg_double with ArrayType(LongType) key and double summary from table
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key2, val2))
FROM t_array_long_double_1_3_through_4_6;

-- Test tuple_sketch_agg_double with FloatType key and double summary from table
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key2, val2))
FROM t_float_double_1_1_1_4_through_1_5_1_8;

-- Test tuple_sketch_agg_double with StringType key and double summary
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1))
FROM t_string_double_a_d_through_e_h;

-- Test tuple_sketch_agg_double with all parameters including mode - sum (default)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1, 12, 'sum'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_agg_double with mode - alwaysone
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1, 12, 'alwaysone'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_summary_double to aggregate summary values - max mode
SELECT tuple_sketch_summary_double(tuple_sketch_agg_double(key1, val1, 12, 'max'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_theta_double to get theta value from double sketch
SELECT tuple_sketch_theta_double(tuple_sketch_agg_double(key1, val1))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_theta_integer to get theta value from integer sketch
SELECT tuple_sketch_theta_integer(tuple_sketch_agg_integer(key1, val1, 12))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_double function with DoubleType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_union_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2)))
FROM t_double_double_1_1_1_4_through_1_5_1_8;

-- Test tuple_union_double function with BinaryType key sketches and explicit lgNomEntries parameter
SELECT tuple_sketch_estimate_double(
  tuple_union_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2, 20), 20))
FROM t_binary_double_a_b_through_e_f;

-- Test tuple_union_double with lgNomEntries and mode parameters
SELECT tuple_sketch_estimate_double(
  tuple_union_double(
    tuple_sketch_agg_double(key1, val1, 12, 'sum'),
    tuple_sketch_agg_double(key2, val2, 12, 'sum'), 12, 'sum'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_intersection_double function with DoubleType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_intersection_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2)))
FROM t_double_double_1_1_1_4_through_1_5_1_8;

-- Test tuple_intersection_double function with BinaryType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_intersection_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2, 22)))
FROM t_binary_double_a_b_through_e_f;

-- Test tuple_intersection_double with mode parameter
SELECT tuple_sketch_estimate_double(
  tuple_intersection_double(
    tuple_sketch_agg_double(key1, val1, 12, 'min'),
    tuple_sketch_agg_double(key2, val2, 12, 'min'), 'min'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_difference_double function with DoubleType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_difference_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2)))
FROM t_double_double_1_1_1_4_through_1_5_1_8;

-- Test tuple_difference_double function with BinaryType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_difference_double(
    tuple_sketch_agg_double(key1, val1, 6),
    tuple_sketch_agg_double(key2, val2, 8)))
FROM t_binary_double_a_b_through_e_f;

-- Test tuple_difference_integer with integer summary type
SELECT tuple_sketch_estimate_integer(
  tuple_difference_integer(
    tuple_sketch_agg_integer(key1, val1, 12, 'sum'),
    tuple_sketch_agg_integer(key2, val2, 12, 'sum')))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_theta_double function with DoubleType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_union_theta_double(
    tuple_sketch_agg_double(key1, val1),
    theta_sketch_agg(key2)))
FROM t_double_double_1_1_1_4_through_1_5_1_8;

-- Test tuple_union_theta_integer function with IntegerType key sketches
SELECT tuple_sketch_estimate_integer(
  tuple_union_theta_integer(
    tuple_sketch_agg_integer(key1, val1),
    theta_sketch_agg(key2)))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_intersection_theta_double function with LongType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_intersection_theta_double(
    tuple_sketch_agg_double(key1, val1, 5),
    theta_sketch_agg(key2)))
FROM t_long_double_1_5_through_7_11;

-- Test tuple_intersection_theta_double with mode parameter
SELECT tuple_sketch_estimate_double(
  tuple_intersection_theta_double(
    tuple_sketch_agg_double(key1, val1, 12, 'min'),
    theta_sketch_agg(key2), 'min'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_difference_theta_double function with IntegerType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_difference_theta_double(
    tuple_sketch_agg_double(key1, val1),
    theta_sketch_agg(key2)))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_difference_theta_double function with StringType key sketches
SELECT tuple_sketch_estimate_double(
  tuple_difference_theta_double(
    tuple_sketch_agg_double(key1, val1),
    theta_sketch_agg(key2)))
FROM t_string_double_a_d_through_e_h;

-- Test tuple_union_theta_double with 'min' mode
SELECT tuple_sketch_estimate_double(
  tuple_union_theta_double(
    tuple_sketch_agg_double(key1, val1, 12, 'min'),
    theta_sketch_agg(key2), 12, 'min'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_union_theta_integer with 'min' mode
SELECT tuple_sketch_estimate_integer(
  tuple_union_theta_integer(
    tuple_sketch_agg_integer(key1, val1, 12, 'min'),
    theta_sketch_agg(key2), 12, 'min'))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_intersection_theta_double with 'alwaysone' mode
SELECT tuple_sketch_estimate_double(
  tuple_intersection_theta_double(
    tuple_sketch_agg_double(key1, val1, 12, 'alwaysone'),
    theta_sketch_agg(key2), 'alwaysone'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_intersection_theta_integer with 'alwaysone' mode
SELECT tuple_sketch_estimate_integer(
  tuple_intersection_theta_integer(
    tuple_sketch_agg_integer(key1, val1, 12, 'alwaysone'),
    theta_sketch_agg(key2), 'alwaysone'))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_agg_double with StringType key sketches and explicit lgNomEntries parameter
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(sketch, 14, 'sum'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_string_double_a_d_through_e_h
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_string_double_a_d_through_e_h);

-- Test tuple_union_agg_double with BinaryType key sketches
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(sketch, 12, 'sum'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_binary_double_a_b_through_e_f
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_binary_double_a_b_through_e_f);

-- Test tuple_union_agg_integer with integer summary type
SELECT tuple_sketch_estimate_integer(tuple_union_agg_integer(sketch, 12, 'sum'))
FROM (SELECT tuple_sketch_agg_integer(key1, val1, 12, 'sum') as sketch FROM t_int_int_1_5_through_7_11
      UNION ALL
      SELECT tuple_sketch_agg_integer(key2, val2, 12, 'sum') as sketch FROM t_int_int_1_5_through_7_11);

-- Test tuple_intersection_agg_double with FloatType key sketches
SELECT tuple_sketch_estimate_double(tuple_intersection_agg_double(sketch, 'sum'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_float_double_1_1_1_4_through_1_5_1_8
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_float_double_1_1_1_4_through_1_5_1_8);

-- Test tuple_intersection_agg_double with BinaryType key sketches
SELECT tuple_sketch_estimate_double(tuple_intersection_agg_double(sketch, 'sum'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_binary_double_a_b_through_e_f
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_binary_double_a_b_through_e_f);

-- Test tuple_intersection_agg_integer with integer summary type
SELECT tuple_sketch_estimate_integer(tuple_intersection_agg_integer(sketch, 'sum'))
FROM (SELECT tuple_sketch_agg_integer(key1, val1, 12, 'sum') as sketch FROM t_int_int_1_5_through_7_11
      UNION ALL
      SELECT tuple_sketch_agg_integer(key2, val2, 12, 'sum') as sketch FROM t_int_int_1_5_through_7_11);

-- Test tuple_sketch_agg_double with StringType key and Float summary with null values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES ('test', 1.0F), (null, 2.0F), ('null', 3.0F), ('null', 4.0F) tab(key, val);

-- Test tuple_sketch_agg_double with FloatType key and null values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(CAST(key AS FLOAT), val))
FROM VALUES (1.5, 1.0D), (null, 2.0D), (2.5, 3.0D), (null, 4.0D), (3.5, 5.0D) tab(key, val);

-- Test tuple_sketch_agg_double with ArrayType(LongType) key and null values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (ARRAY(10L, 20L), 1.0), (null, 2.0D), (ARRAY(30L, 40L), 3.0D), (null, 4.0D), (ARRAY(50L, 60L), 5.0D) tab(key, val);

-- Test tuple_sketch_agg_double with null summary values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (1, 1.0D), (2, null), (3, 3.0D), (4, null), (5, 5.0D) tab(key, val);

-- Test tuple_sketch_agg_double with DoubleType key and null summary values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(CAST(key AS DOUBLE), val))
FROM VALUES (1.1, 1.0D), (2.2, null), (3.3, 3.0D), (4.4, null) tab(key, val);

-- Test tuple_sketch_agg_double with ArrayType(IntegerType) key and null summary values (nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (ARRAY(1, 2), 1.0D), (ARRAY(3, 4), null), (ARRAY(5, 6), 3.0D), (ARRAY(7, 8), null) tab(key, val);

-- Test tuple_sketch_agg_double with both null keys and null summaries (all nulls should be ignored)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (1, 1.0D), (null, 2.0D), (3, null), (null, null), (5, 5.0D) tab(key, val);

-- Test tuple_sketch_agg_double with all-null keys and summaries (should return null or empty sketch)
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (null, null), (null, null), (null, null) tab(key, val);

-- Test tuple_sketch_agg_integer with all-null keys and summaries (should return null or empty sketch)
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_integer(key, val, 12))
FROM VALUES (null, null), (null, null), (null, null) tab(key, val);

-- Test tuple_sketch_agg_double with empty arrays
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val))
FROM VALUES (ARRAY(), 1.0D), (ARRAY(1, 2), 2.0D), (ARRAY(), 3.0D), (ARRAY(3, 4), 4.0D) tab(key, val);

-- Test tuple_sketch_agg_double with collated string data
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1)) utf8_b FROM t_string_collation;

SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1 COLLATE UNICODE_CI, val1)) unicode_ci FROM t_string_collation;

SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1 COLLATE UNICODE_RTRIM, val1)) unicode_rt FROM t_string_collation;

-- Test tuple_sketch_summary_integer with empty sketch (no rows)
SELECT tuple_sketch_summary_integer(tuple_sketch_agg_integer(key, val, 12, 'sum'), 'sum')
FROM VALUES (1, 1) tab(key, val) WHERE key > 100;

-- Test tuple_sketch_agg_double with mode parameter in uppercase - MIN
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1, 12, 'MIN'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_agg_double with mode parameter in mixed case - Max
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key1, val1, 12, 'Max'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_agg_integer with mode parameter in uppercase - SUM
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_integer(key1, val1, 12, 'SUM'))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_agg_double with mode parameter in mixed case - Min
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(sketch, 12, 'Min'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_int_double_1_5_through_7_11
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_int_double_1_5_through_7_11);

-- Test tuple_intersection_double with empty sketch (intersection with empty result set)
SELECT tuple_sketch_estimate_double(
  tuple_intersection_double(
    tuple_sketch_agg_double(key1, val1),
    tuple_sketch_agg_double(key2, val2)))
FROM t_int_double_1_5_through_7_11
WHERE key1 > 100;

-- Test tuple_union_agg_double with empty sketches
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(sketch, 12, 'sum'))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_int_double_1_5_through_7_11 WHERE key1 > 100
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_int_double_1_5_through_7_11 WHERE key2 > 100);

-- Test tuple_union_theta_double with empty TupleSketch and non-empty ThetaSketch
WITH empty_tuple AS (
  SELECT tuple_sketch_agg_double(key1, val1) as tuple_sketch FROM t_int_double_1_5_through_7_11 WHERE key1 > 100
),
non_empty_theta AS (
  SELECT theta_sketch_agg(key2) as theta_sketch FROM t_int_double_1_5_through_7_11
)
SELECT
  tuple_sketch_estimate_double(
    tuple_union_theta_double(tuple_sketch, theta_sketch)) as estimate,
  tuple_sketch_summary_double(
    tuple_union_theta_double(tuple_sketch, theta_sketch)) as summary
FROM empty_tuple, non_empty_theta;

-- Test tuple_intersection_theta_double with empty TupleSketch (should return empty)
WITH empty_tuple AS (
  SELECT tuple_sketch_agg_double(key1, val1) as tuple_sketch FROM t_int_double_1_5_through_7_11 WHERE key1 > 100
),
non_empty_theta AS (
  SELECT theta_sketch_agg(key2) as theta_sketch FROM t_int_double_1_5_through_7_11
)
SELECT
  tuple_sketch_estimate_double(
    tuple_intersection_theta_double(tuple_sketch, theta_sketch)) as estimate
FROM empty_tuple, non_empty_theta;

-- Test tuple_difference_theta_double with empty TupleSketch (should return empty)
WITH empty_tuple AS (
  SELECT tuple_sketch_agg_double(key1, val1) as tuple_sketch FROM t_int_double_1_5_through_7_11 WHERE key1 > 100
),
non_empty_theta AS (
  SELECT theta_sketch_agg(key2) as theta_sketch FROM t_int_double_1_5_through_7_11
)
SELECT
  tuple_sketch_estimate_double(
    tuple_difference_theta_double(tuple_sketch, theta_sketch)) as estimate
FROM empty_tuple, non_empty_theta;

-- Test summary preservation after tuple_difference_theta_double
-- Summaries should be retained for remaining entries (key 8)
WITH tuple_sketch_data AS (
  SELECT tuple_sketch_agg_double(key, val, 12, 'sum') as tuple_sketch
  FROM VALUES (5, 5.0D), (6, 6.0D), (7, 7.0D), (8, 8.0D) tab(key, val)
),
theta_sketch_data AS (
  SELECT theta_sketch_agg(key) as theta_sketch
  FROM VALUES (5), (6), (7), (9) tab(key)
)
SELECT
  tuple_sketch_estimate_double(
    tuple_difference_theta_double(tuple_sketch, theta_sketch)) as estimate,
  tuple_sketch_summary_double(
    tuple_difference_theta_double(tuple_sketch, theta_sketch)) as summary
FROM tuple_sketch_data, theta_sketch_data;

-- Test summary preservation with 'max' mode on union_theta
-- Theta entries get -Infinity for max mode, tuple entries keep their values
WITH tuple_sketch_data AS (
  SELECT tuple_sketch_agg_integer(key, val, 12, 'max') as tuple_sketch
  FROM VALUES (1, 10), (2, 20) tab(key, val)
),
theta_sketch_data AS (
  SELECT theta_sketch_agg(key) as theta_sketch
  FROM VALUES (3), (4) tab(key)
)
SELECT
  tuple_sketch_estimate_integer(
    tuple_union_theta_integer(tuple_sketch, theta_sketch, 12, 'max')) as estimate,
  tuple_sketch_summary_integer(
    tuple_union_theta_integer(tuple_sketch, theta_sketch, 12, 'max'), 'max') as summary
FROM tuple_sketch_data, theta_sketch_data;

-- Test tuple_sketch_agg_integer with negative overflow (sum mode)
-- Testing sum of values that go below INT min (-2147483648)
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_integer(key, val, 12, 'sum'))
FROM VALUES
  (1, -2147483648),
  (2, -1),
  (3, -100) AS tab(key, val);

-- Test tuple_sketch_agg_integer with min mode - should handle min integer value
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_integer(key, val, 12, 'min'))
FROM VALUES
  (1, -2147483648),
  (2, -2147483647),
  (3, 100) AS tab(key, val);

-- Test tuple_sketch_agg_double with max mode using Double.MAX_VALUE
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key, val, 12, 'max'))
FROM VALUES
  (1, 1.7976931348623157E308),
  (2, 1.0E308),
  (3, 100.0D) AS tab(key, val);

-- Test tuple_sketch_summary_integer with overflow in sum mode
SELECT tuple_sketch_summary_integer(tuple_sketch_agg_integer(key, val, 12, 'sum'), 'sum')
FROM VALUES
  (1, 2147483647),
  (2, 1),
  (3, 100) AS tab(key, val);

-- Test tuple_sketch_agg_integer with mixed overflow - positive and negative values for same key
SELECT tuple_sketch_summary_integer(tuple_sketch_agg_integer(key, val, 12, 'sum'), 'sum')
FROM VALUES
  (1, 2147483647),
  (1, 2147483647),
  (1, -2147483648),
  (2, 500) AS tab(key, val);

-- Test tuple_union_double with sketches containing values that overflow to infinity when combined
SELECT tuple_sketch_estimate_double(
  tuple_union_double(
    tuple_sketch_agg_double(key1, val1, 12, 'sum'),
    tuple_sketch_agg_double(key2, val2, 12, 'sum'), 12, 'sum'))
FROM VALUES
  (1, 1.0E308, 1, 1.0E308) AS tab(key1, val1, key2, val2);

-- Test tuple_sketch_agg_double with named parameters - setting only mode
SELECT tuple_sketch_estimate_double(tuple_sketch_agg_double(key => key1, summary => val1, mode => 'max'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_agg_integer with named parameters - only required params
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_integer(key => key1, summary => val1))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_agg_double with named parameters - only required param
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(child => sketch))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_int_double_1_5_through_7_11
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_int_double_1_5_through_7_11);

-- Test tuple_union_agg_double with named parameters - different order
SELECT tuple_sketch_estimate_double(tuple_union_agg_double(mode => 'min', lgNomEntries => 13, child => sketch))
FROM (SELECT tuple_sketch_agg_double(key1, val1) as sketch FROM t_int_double_1_5_through_7_11
      UNION ALL
      SELECT tuple_sketch_agg_double(key2, val2) as sketch FROM t_int_double_1_5_through_7_11);

-- Test tuple_union_double with named parameters - setting only lgNomEntries
SELECT tuple_sketch_estimate_double(
  tuple_union_double(
    first => tuple_sketch_agg_double(key1, val1),
    second => tuple_sketch_agg_double(key2, val2),
    lgNomEntries => 14))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_union_integer with named parameters - setting only lgNomEntries
SELECT tuple_sketch_estimate_integer(
  tuple_union_integer(
    first => tuple_sketch_agg_integer(key1, val1),
    second => tuple_sketch_agg_integer(key2, val2),
    lgNomEntries => 14))
FROM t_int_int_1_5_through_7_11;

-- Test tuple_union_theta_double with named parameters - setting only mode
SELECT tuple_sketch_estimate_double(
  tuple_union_theta_double(
    first => tuple_sketch_agg_double(key1, val1),
    second => theta_sketch_agg(key2),
    mode => 'max'))
FROM t_int_double_1_5_through_7_11;

-- Negative test cases

-- Test tuple_sketch_agg_double with lgNomEntries value of 2 (too low, minimum is 4) - should fail
SELECT tuple_sketch_agg_double(col, val, 2)
FROM VALUES (50, 1.0D), (60, 2.0D), (60, 3.0D) tab(col, val);

-- Test tuple_union_agg_double with lgNomEntries value of 27 (too high, maximum is 26) - should fail
SELECT tuple_union_agg_double(sketch, 27, 'sum')
FROM (SELECT tuple_sketch_agg_double(col, val, 12) as sketch
        FROM VALUES (1, 1.0D) AS tab(col, val)
      UNION ALL
      SELECT tuple_sketch_agg_double(col, val, 20) as sketch
        FROM VALUES (1, 1.0D) AS tab(col, val));

-- lgNomEntries parameter has wrong type (STRING instead of INT)
SELECT tuple_sketch_agg_double(col, val, 'fifteen')
FROM VALUES (50, 1.0D), (60, 2.0D), (60, 3.0D) tab(col, val);

-- Invalid input - summary is a string when supposed to be double
SELECT tuple_sketch_agg_double(col, 'fifteen')
FROM VALUES (50, 1.0D), (60, 2.0D), (60, 3.0D) tab(col, val);

-- Test tuple_intersection_double with integers (1, 2) instead of binary sketch data - should fail
SELECT tuple_intersection_double(1, 2)
FROM VALUES
  (1, 4),
  (2, 5),
  (3, 6) AS tab(col1, col2);

-- Test tuple_intersection_double with string 'invalid_sketch' instead of binary sketch data - should fail
SELECT tuple_intersection_double(
    tuple_sketch_agg_double(col1, 1.0),
    'invalid_sketch')
FROM VALUES
  (1, 4),
  (2, 5),
  (3, 6) AS tab(col1, col2);

-- Test tuple_intersection_double with invalid binary data ('abc', 'def') that are not valid tuple sketches - should fail
SELECT tuple_intersection_double(CAST('abc' AS BINARY), CAST('def' AS BINARY));

-- Test tuple_intersection_agg_double with invalid binary data ('abc') that is not a valid tuple sketch - should fail
SELECT tuple_intersection_agg_double(buffer, 'sum')
FROM (SELECT CAST('abc' AS BINARY) AS buffer);

-- Test tuple_sketch_estimate_integer with wrong sketch type (integer estimate on double sketch)
SELECT tuple_sketch_estimate_integer(tuple_sketch_agg_double(key1, val1, 12, 'sum'))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_sketch_theta_double with integer input instead of binary - should fail
SELECT tuple_sketch_theta_double(123);

-- Test tuple_union_theta_double with invalid mode parameter - should fail
SELECT tuple_union_theta_double(
    tuple_sketch_agg_double(col1, 1.0D),
    theta_sketch_agg(col2), 12, 'invalid_mode')
FROM VALUES
  (1, 4),
  (2, 5),
  (3, 6) AS tab(col1, col2);

-- Test tuple_difference_theta_double with integers (1, 2) instead of binary sketch data - should fail
SELECT tuple_difference_theta_double(1, 2)
FROM VALUES
  (1, 4),
  (2, 5),
  (3, 6) AS tab(col1, col2);

-- Test tuple_difference_theta_double with invalid binary data ('abc', 'def') that are not valid sketches - should fail
SELECT tuple_difference_theta_double(CAST('abc' AS BINARY), CAST('def' AS BINARY));

-- Test tuple_difference_theta_integer with wrong sketch type (integer difference on double tuple sketch) - should fail
SELECT tuple_difference_theta_integer(
    tuple_sketch_agg_double(key1, val1),
    theta_sketch_agg(key2))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_union_theta_integer with both null inputs - should fail
SELECT tuple_union_theta_integer(CAST(NULL AS BINARY), CAST(NULL AS BINARY));

-- Test tuple_intersection_theta_integer with both null inputs - should fail
SELECT tuple_intersection_theta_integer(CAST(NULL AS BINARY), CAST(NULL AS BINARY));

-- Test tuple_difference_theta_integer with both null inputs - should fail
SELECT tuple_difference_theta_integer(CAST(NULL AS BINARY), CAST(NULL AS BINARY));

-- Test tuple_intersection_theta_double with swapped sketch types (ThetaSketch first, TupleSketch second) - should fail
SELECT tuple_intersection_theta_double(theta_sketch_agg(key1), tuple_sketch_agg_double(key2, val2))
FROM t_int_double_1_5_through_7_11;

-- Test tuple_difference_theta_integer with swapped sketch types (ThetaSketch first, TupleSketch second) - should fail
SELECT tuple_difference_theta_integer(theta_sketch_agg(key1), tuple_sketch_agg_integer(key2, val2))
FROM t_int_int_1_5_through_7_11;

DROP TABLE IF EXISTS t_double_double_1_1_1_4_through_1_5_1_8;

DROP TABLE IF EXISTS t_binary_double_a_b_through_e_f;

DROP TABLE IF EXISTS t_int_int_1_5_through_7_11;

-- Type coercion is applied to recursive data types
SELECT col2.field FROM t1;

SELECT array_join(array(2Y, 1Y), ', ');

SELECT array_join(array(2L, 1L), ', ');

SELECT array_join(array(float(2.0), float(1.0)), ', ');

SELECT array_join(array('a', 'b'), ', ');

SELECT cast(1 as binary) > '2' FROM t;

SELECT cast(1 as binary) <= '2' FROM t;

SELECT cast(1 as binary) > cast(null as string) FROM t;

SELECT cast(1 as binary) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as binary) FROM t;

SELECT '2' <= cast(1 as binary) FROM t;

SELECT cast(null as string) > cast(1 as binary) FROM t;

SELECT cast(null as string) <= cast(1 as binary) FROM t;

SELECT cast(1 as tinyint) > '2' FROM t;

SELECT cast(1 as tinyint) <= '2' FROM t;

SELECT cast(1 as tinyint) > cast(null as string) FROM t;

SELECT cast(1 as tinyint) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as tinyint) FROM t;

SELECT '2' <= cast(1 as tinyint) FROM t;

SELECT cast(null as string) > cast(1 as tinyint) FROM t;

SELECT cast(null as string) <= cast(1 as tinyint) FROM t;

SELECT cast(1 as smallint) > '2' FROM t;

SELECT cast(1 as smallint) <= '2' FROM t;

SELECT cast(1 as smallint) > cast(null as string) FROM t;

SELECT cast(1 as smallint) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as smallint) FROM t;

SELECT '2' <= cast(1 as smallint) FROM t;

SELECT cast(null as string) > cast(1 as smallint) FROM t;

SELECT cast(null as string) <= cast(1 as smallint) FROM t;

SELECT cast(1 as int) > '2' FROM t;

SELECT cast(1 as int) <= '2' FROM t;

SELECT cast(1 as int) > cast(null as string) FROM t;

SELECT cast(1 as int) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as int) FROM t;

SELECT '2' <> cast(1 as int) FROM t;

SELECT cast(null as string) > cast(1 as int) FROM t;

SELECT cast(null as string) <> cast(1 as int) FROM t;

SELECT cast(1 as bigint) > '2' FROM t;

SELECT cast(1 as bigint) <= '2' FROM t;

SELECT cast(1 as bigint) > cast(null as string) FROM t;

SELECT cast(1 as bigint) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as bigint) FROM t;

SELECT '2' <= cast(1 as bigint) FROM t;

SELECT cast(null as string) > cast(1 as bigint) FROM t;

SELECT cast(null as string) <= cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(10, 0)) > '2' FROM t;

SELECT cast(1 as decimal(10, 0)) <> '2' FROM t;

SELECT cast(1 as decimal(10, 0)) > cast(null as string) FROM t;

SELECT cast(1 as decimal(10, 0)) <> cast(null as string) FROM t;

SELECT '2' > cast(1 as decimal(10, 0)) FROM t;

SELECT '2' <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(null as string) > cast(1 as decimal(10, 0)) FROM t;

SELECT cast(null as string) <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as double) > '2' FROM t;

SELECT cast(1 as double) <= '2' FROM t;

SELECT cast(1 as double) > cast(null as string) FROM t;

SELECT cast(1 as double) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as double) FROM t;

SELECT '2' <= cast(1 as double) FROM t;

SELECT cast(null as string) > cast(1 as double) FROM t;

SELECT cast(null as string) <= cast(1 as double) FROM t;

SELECT cast(1 as float) > '2' FROM t;

SELECT cast(1 as float) <= '2' FROM t;

SELECT cast(1 as float) > cast(null as string) FROM t;

SELECT cast(1 as float) <= cast(null as string) FROM t;

SELECT '2' > cast(1 as float) FROM t;

SELECT '2' <= cast(1 as float) FROM t;

SELECT cast(null as string) > cast(1 as float) FROM t;

SELECT cast(null as string) <= cast(1 as float) FROM t;

SELECT '1996-9-10' > date('1996-09-09') FROM t;

SELECT '1996-9-10' <= date('1996-09-09') FROM t;

SELECT cast(null as string)> date('1996-09-09') FROM t;

SELECT cast(null as string)<= date('1996-09-09') FROM t;

SELECT date('1996-9-10') > '1996-09-09' FROM t;

SELECT date('1996-9-10') <= '1996-09-09' FROM t;

SELECT date('1996-9-10') > cast(null as string) FROM t;

SELECT date('1996-9-10') <= cast(null as string) FROM t;

SELECT '1996-09-09 12:12:12.5' > timestamp('1996-09-09 12:12:12.4') FROM t;

SELECT '1996-09-09 12:12:12.5' <= timestamp('1996-09-09 12:12:12.4') FROM t;

SELECT cast(null as string) > timestamp('1996-09-09 12:12:12.4') FROM t;

SELECT cast(null as string) <= timestamp('1996-09-09 12:12:12.4') FROM t;

SELECT timestamp('1996-09-09 12:12:12.5' )> '1996-09-09 12:12:12.4' FROM t;

SELECT timestamp('1996-09-09 12:12:12.5' )<= '1996-09-09 12:12:12.4' FROM t;

SELECT timestamp('1996-09-09 12:12:12.5' )> cast(null as string) FROM t;

SELECT timestamp('1996-09-09 12:12:12.5' )<= cast(null as string) FROM t;

SELECT ' ' > X'001F' FROM t;

SELECT ' ' <= X'001F' FROM t;

SELECT cast(null as string) > X'001F' FROM t;

SELECT cast(null as string) <= X'001F' FROM t;

SELECT X'001F' > ' ' FROM t;

SELECT X'001F' <= ' ' FROM t;

SELECT X'001F' > cast(null as string) FROM t;

SELECT X'001F' <= cast(null as string) FROM t;

SELECT true = cast(1 as tinyint) FROM t;

SELECT true = cast(1 as bigint) FROM t;

SELECT true = cast(1 as decimal(10, 0)) FROM t;

SELECT true = cast(1 as boolean) FROM t;

SELECT true <=> cast(1 as tinyint) FROM t;

SELECT true <=> cast(1 as bigint) FROM t;

SELECT true <=> cast(1 as decimal(10, 0)) FROM t;

SELECT true <=> cast(1 as boolean) FROM t;

SELECT cast(1 as tinyint) = true FROM t;

SELECT cast(1 as bigint) = true FROM t;

SELECT cast(1 as decimal(10, 0)) = true FROM t;

SELECT cast(1 as boolean) = true FROM t;

SELECT cast(1 as tinyint) <=> true FROM t;

SELECT cast(1 as bigint) <=> true FROM t;

SELECT cast(1 as decimal(10, 0)) <=> true FROM t;

SELECT cast(1 as boolean) <=> true FROM t;

SELECT false = cast(0 as tinyint) FROM t;

SELECT false = cast(0 as bigint) FROM t;

SELECT false = cast(0 as decimal(10, 0)) FROM t;

SELECT false = cast(0 as boolean) FROM t;

SELECT false <=> cast(0 as tinyint) FROM t;

SELECT false <=> cast(0 as bigint) FROM t;

SELECT false <=> cast(0 as decimal(10, 0)) FROM t;

SELECT false <=> cast(0 as boolean) FROM t;

SELECT cast(0 as tinyint) = false FROM t;

SELECT cast(0 as bigint) = false FROM t;

SELECT cast(0 as decimal(10, 0)) = false FROM t;

SELECT cast(0 as boolean) = false FROM t;

SELECT cast(0 as tinyint) <=> false FROM t;

SELECT cast(0 as bigint) <=> false FROM t;

SELECT cast(0 as decimal(10, 0)) <=> false FROM t;

SELECT cast(0 as boolean) <=> false FROM t;

SELECT CASE WHEN true THEN cast(1 as tinyint) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as tinyint) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as tinyint) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as tinyint) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as smallint) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as smallint) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as smallint) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as smallint) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as int) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as int) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as int) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as int) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as bigint) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as bigint) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as bigint) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as bigint) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as float) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as float) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as float) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as float) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as double) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as double) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as double) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as double) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as decimal(10, 0)) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as decimal(10, 0)) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as decimal(10, 0)) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as decimal(10, 0)) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as string) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as string) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as string) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as string) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast('1' as binary) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast('1' as binary) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast('1' as binary) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast('1' as binary) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast(1 as boolean) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as boolean) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast(1 as boolean) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast(1 as boolean) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00.0' as timestamp) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00.0' as timestamp) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00.0' as timestamp) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00.0' as timestamp) ELSE cast(2 as boolean) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00' as date) ELSE cast(2 as tinyint) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00' as date) ELSE cast(2 as bigint) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00' as date) ELSE cast(2 as decimal(10, 0)) END FROM t;

SELECT CASE WHEN true THEN cast('2017-12-12 09:30:00' as date) ELSE cast(2 as boolean) END FROM t;

-- Concatenate mixed inputs (output type is string)
SELECT (col1 || col2 || col3) col
FROM (
  SELECT
    id col1,
    string(id + 1) col2,
    encode(string(id + 2), 'utf-8') col3
  FROM range(10)
);

-- turn on concatBinaryAsString
set spark.sql.function.concatBinaryAsString=true;

SELECT ((col1 || col2) || (col3 || col4)) col
FROM (
  SELECT
    encode(string(id), 'utf-8') col1,
    encode(string(id + 1), 'utf-8') col2,
    encode(string(id + 2), 'utf-8') col3,
    encode(string(id + 3), 'utf-8') col4
  FROM range(10)
);

CREATE TEMPORARY VIEW various_arrays AS SELECT * FROM VALUES (
  array(true, false), array(true),
  array(2Y, 1Y), array(3Y, 4Y),
  array(2S, 1S), array(3S, 4S),
  array(2, 1), array(3, 4),
  array(2L, 1L), array(3L, 4L),
  array(9223372036854775809, 9223372036854775808), array(9223372036854775808, 9223372036854775809),
  array(2.0D, 1.0D), array(3.0D, 4.0D),
  array(float(2.0), float(1.0)), array(float(3.0), float(4.0)),
  array(date '2016-03-14', date '2016-03-13'), array(date '2016-03-12', date '2016-03-11'),
  array(timestamp '2016-11-15 20:54:00.000', timestamp '2016-11-12 20:54:00.000'),
  array(timestamp '2016-11-11 20:54:00.000'),
  array('a', 'b'), array('c', 'd'),
  array(array('a', 'b'), array('c', 'd')), array(array('e'), array('f')),
  array(struct('a', 1), struct('b', 2)), array(struct('c', 3), struct('d', 4)),
  array(map('a', 1), map('b', 2)), array(map('c', 3), map('d', 4))
) AS various_arrays(
  boolean_array1, boolean_array2,
  tinyint_array1, tinyint_array2,
  smallint_array1, smallint_array2,
  int_array1, int_array2,
  bigint_array1, bigint_array2,
  decimal_array1, decimal_array2,
  double_array1, double_array2,
  float_array1, float_array2,
  date_array1, data_array2,
  timestamp_array1, timestamp_array2,
  string_array1, string_array2,
  array_array1, array_array2,
  struct_array1, struct_array2,
  map_array1, map_array2
);

select cast(1 as tinyint) + interval 2 day;

select cast(1 as bigint) + interval 2 day;

select cast(1 as decimal(10, 0)) + interval 2 day;

select cast('1' as binary) + interval 2 day;

select cast('2017-12-11 09:30:00' as date) + interval 2 day;

select interval 2 day + cast(1 as int);

select interval 2 day + cast(1 as double);

select interval 2 day + cast('2017-12-11 09:30:00' as string);

select interval 2 day + cast('2017-12-11 09:30:00.0' as timestamp);

select cast(1 as smallint) - interval 2 day;

select cast(1 as float) - interval 2 day;

select cast('2017-12-11' as string) - interval 2 day;

select cast(1 as boolean) - interval 2 day;

-- TIME +/- day-time interval and TIME - TIME
select cast('12:34:56' as time) + interval '02:00:00' hour to second;

select cast('12:34:56' as time) - cast('10:00:00' as time);

SELECT cast(1 as tinyint) + cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) + cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) + cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) + cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) + cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) + cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) + cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) + cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) + cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) + cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) + cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) + cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) + cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  + cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  + cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) + cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) + cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  + cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  + cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) + cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) + cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  + cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  + cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  + cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) + cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) + cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  + cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  + cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) + cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) - cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) - cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) - cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) - cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) - cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) - cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) - cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) - cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) - cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) - cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) - cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) - cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) - cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  - cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  - cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) - cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) - cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  - cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  - cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) - cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) - cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  - cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  - cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  - cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) - cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) - cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  - cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  - cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) - cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) * cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) * cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) * cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) * cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) * cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) * cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) * cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) * cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) * cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) * cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017*12*11 09:30:00.0' as timestamp) * cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017*12*11 09:30:00.0' as timestamp) * cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017*12*11 09:30:00' as date) * cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  * cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  * cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) * cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) * cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  * cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  * cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) * cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) * cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  * cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  * cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  * cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) * cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) * cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  * cast('2017*12*11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  * cast('2017*12*11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) * cast('2017*12*11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) / cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) / cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) / cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) / cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) / cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) / cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) / cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) / cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) / cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) / cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017/12/11 09:30:00.0' as timestamp) / cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017/12/11 09:30:00.0' as timestamp) / cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017/12/11 09:30:00' as date) / cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  / cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  / cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) / cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) / cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  / cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  / cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) / cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) / cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  / cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  / cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  / cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) / cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) / cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  / cast('2017/12/11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  / cast('2017/12/11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) / cast('2017/12/11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) % cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) % cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) % cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) % cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) % cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) % cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) % cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) % cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) % cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) % cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) % cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) % cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) % cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  % cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  % cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) % cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) % cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  % cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  % cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) % cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) % cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  % cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  % cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  % cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) % cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) % cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  % cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  % cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) % cast('2017-12-11 09:30:00' as date) FROM t;

SELECT pmod(cast(1 as tinyint), cast(1 as decimal(10, 0))) FROM t;

SELECT pmod(cast(1 as smallint), cast(1 as decimal(5, 0))) FROM t;

SELECT pmod(cast(1 as int), cast(1 as decimal(3, 0))) FROM t;

SELECT pmod(cast(1 as int), cast(1 as decimal(20, 0))) FROM t;

SELECT pmod(cast(1 as bigint), cast(1 as decimal(10, 0))) FROM t;

SELECT pmod(cast(1 as float), cast(1 as decimal(5, 0))) FROM t;

SELECT pmod(cast(1 as double), cast(1 as decimal(3, 0))) FROM t;

SELECT pmod(cast(1 as double), cast(1 as decimal(20, 0))) FROM t;

SELECT pmod(cast(1 as decimal(10, 0)), cast(1 as decimal(10, 0))) FROM t;

SELECT pmod(cast('1' as binary), cast(1 as decimal(5, 0))) FROM t;

SELECT pmod(cast('2017-12-11 09:30:00.0' as timestamp), cast(1 as decimal(3, 0))) FROM t;

SELECT pmod(cast('2017-12-11 09:30:00.0' as timestamp), cast(1 as decimal(20, 0))) FROM t;

SELECT pmod(cast('2017-12-11 09:30:00' as date), cast(1 as decimal(10, 0))) FROM t;

SELECT pmod(cast(1 as decimal(5, 0)) , cast(1 as tinyint)) FROM t;

SELECT pmod(cast(1 as decimal(3, 0)) , cast(1 as smallint)) FROM t;

SELECT pmod(cast(1 as decimal(20, 0)), cast(1 as smallint)) FROM t;

SELECT pmod(cast(1 as decimal(10, 0)), cast(1 as int)) FROM t;

SELECT pmod(cast(1 as decimal(5, 0)) , cast(1 as bigint)) FROM t;

SELECT pmod(cast(1 as decimal(3, 0)) , cast(1 as float)) FROM t;

SELECT pmod(cast(1 as decimal(20, 0)), cast(1 as float)) FROM t;

SELECT pmod(cast(1 as decimal(10, 0)), cast(1 as double)) FROM t;

SELECT pmod(cast(1 as decimal(5, 0)) , cast(1 as decimal(10, 0))) FROM t;

SELECT pmod(cast(1 as decimal(5, 0)) , cast(1 as string)) FROM t;

SELECT pmod(cast(1 as decimal(3, 0)) , cast('1' as binary)) FROM t;

SELECT pmod(cast(1 as decimal(20, 0)), cast('1' as binary)) FROM t;

SELECT pmod(cast(1 as decimal(10, 0)), cast(1 as boolean)) FROM t;

SELECT pmod(cast(1 as decimal(5, 0)) , cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT pmod(cast(1 as decimal(3, 0)) , cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT pmod(cast(1 as decimal(20, 0)), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as tinyint) = cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) = cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) = cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) = cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) = cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) = cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) = cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) = cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) = cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) = cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) = cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) = cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) = cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  = cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  = cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) = cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) = cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  = cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  = cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) = cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) = cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  = cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  = cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  = cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) = cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) = cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  = cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  = cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) = cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) <=> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) <=> cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) <=> cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) <=> cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) <=> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) <=> cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) <=> cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) <=> cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) <=> cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) <=> cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <=> cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <=> cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) <=> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <=> cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  <=> cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) <=> cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) <=> cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  <=> cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  <=> cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) <=> cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) <=> cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  <=> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <=> cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  <=> cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) <=> cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) <=> cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  <=> cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  <=> cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) <=> cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) < cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) < cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) < cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) < cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) < cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) < cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) < cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) < cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) < cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) < cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) < cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) < cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) < cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  < cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  < cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) < cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) < cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  < cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  < cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) < cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) < cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  < cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  < cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  < cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) < cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) < cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  < cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  < cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) < cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) <= cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) <= cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) <= cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) <= cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) <= cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) <= cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) <= cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <= cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <= cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <= cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  <= cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) <= cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) <= cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  <= cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  <= cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) <= cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) <= cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  <= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <= cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  <= cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) <= cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) <= cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  <= cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  <= cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) <= cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) > cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) > cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) > cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) > cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) > cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) > cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) > cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) > cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) > cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) > cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) > cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) > cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) > cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  > cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  > cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) > cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) > cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  > cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  > cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) > cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) > cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  > cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  > cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  > cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) > cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) > cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  > cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  > cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) > cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) >= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) >= cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) >= cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) >= cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) >= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) >= cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) >= cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) >= cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) >= cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) >= cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) >= cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) >= cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) >= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  >= cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  >= cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) >= cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) >= cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  >= cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  >= cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) >= cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) >= cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  >= cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  >= cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  >= cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) >= cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) >= cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  >= cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  >= cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) >= cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) <> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) <> cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as int) <> cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as int) <> cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as bigint) <> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) <> cast(1 as decimal(5, 0)) FROM t;

SELECT cast(1 as double) <> cast(1 as decimal(3, 0)) FROM t;

SELECT cast(1 as double) <> cast(1 as decimal(20, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) <> cast(1 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) <> cast(1 as decimal(5, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <> cast(1 as decimal(3, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <> cast(1 as decimal(20, 0)) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) <> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <> cast(1 as tinyint) FROM t;

SELECT cast(1 as decimal(3, 0))  <> cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(20, 0)) <> cast(1 as smallint) FROM t;

SELECT cast(1 as decimal(10, 0)) <> cast(1 as int) FROM t;

SELECT cast(1 as decimal(5, 0))  <> cast(1 as bigint) FROM t;

SELECT cast(1 as decimal(3, 0))  <> cast(1 as float) FROM t;

SELECT cast(1 as decimal(20, 0)) <> cast(1 as float) FROM t;

SELECT cast(1 as decimal(10, 0)) <> cast(1 as double) FROM t;

SELECT cast(1 as decimal(5, 0))  <> cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(5, 0))  <> cast(1 as string) FROM t;

SELECT cast(1 as decimal(3, 0))  <> cast('1' as binary) FROM t;

SELECT cast(1 as decimal(20, 0)) <> cast('1' as binary) FROM t;

SELECT cast(1 as decimal(10, 0)) <> cast(1 as boolean) FROM t;

SELECT cast(1 as decimal(5, 0))  <> cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as decimal(3, 0))  <> cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as decimal(20, 0)) <> cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as tinyint) / cast(1 as int) FROM t;

SELECT cast(1 as tinyint) / cast(1 as double) FROM t;

SELECT cast(1 as tinyint) / cast(1 as boolean) FROM t;

SELECT cast(1 as smallint) / cast(1 as tinyint) FROM t;

SELECT cast(1 as smallint) / cast(1 as bigint) FROM t;

SELECT cast(1 as smallint) / cast(1 as string) FROM t;

SELECT cast(1 as smallint) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as int) / cast(1 as smallint) FROM t;

SELECT cast(1 as int) / cast(1 as float) FROM t;

SELECT cast(1 as int) / cast('1' as binary) FROM t;

SELECT cast(1 as int) / cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as bigint) / cast(1 as int) FROM t;

SELECT cast(1 as bigint) / cast(1 as double) FROM t;

SELECT cast(1 as bigint) / cast(1 as boolean) FROM t;

SELECT cast(1 as float) / cast(1 as tinyint) FROM t;

SELECT cast(1 as float) / cast(1 as bigint) FROM t;

SELECT cast(1 as float) / cast(1 as string) FROM t;

SELECT cast(1 as float) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as double) / cast(1 as smallint) FROM t;

SELECT cast(1 as double) / cast(1 as float) FROM t;

SELECT cast(1 as double) / cast('1' as binary) FROM t;

SELECT cast(1 as double) / cast('2017-12-11 09:30:00' as date) FROM t;

SELECT cast(1 as string) / cast(1 as tinyint) FROM t;

SELECT cast(1 as string) / cast(1 as bigint) FROM t;

SELECT cast(1 as string) / cast(1 as decimal(10, 0)) FROM t;

SELECT cast(1 as string) / cast(1 as boolean) FROM t;

SELECT cast('1' as binary) / cast(1 as tinyint) FROM t;

SELECT cast('1' as binary) / cast(1 as bigint) FROM t;

SELECT cast('1' as binary) / cast(1 as string) FROM t;

SELECT cast('1' as binary) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as boolean) / cast(1 as smallint) FROM t;

SELECT cast(1 as boolean) / cast(1 as float) FROM t;

SELECT cast(1 as boolean) / cast(1 as string) FROM t;

SELECT cast(1 as boolean) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) / cast(1 as smallint) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) / cast(1 as float) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) / cast(1 as string) FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) / cast(1 as smallint) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) / cast(1 as float) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) / cast(1 as string) FROM t;

SELECT cast('2017-12-11 09:30:00' as date) / cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT elt(3, col1, col2, col3, col4) col
FROM (
  SELECT
    string(id) col1,
    string(id + 1) col2,
    encode(string(id + 2), 'utf-8') col3,
    encode(string(id + 3), 'utf-8') col4
  FROM range(10)
);

-- turn off eltOutputAsString
set spark.sql.function.eltOutputAsString=false;

SELECT IF(true, cast(1 as tinyint), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as tinyint), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as tinyint), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as tinyint), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as smallint), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as smallint), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as smallint), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as smallint), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as int), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as int), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as int), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as int), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as bigint), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as bigint), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as bigint), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as bigint), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as float), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as float), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as float), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as float), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as double), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as double), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as double), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as double), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as decimal(10, 0)), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as decimal(10, 0)), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as decimal(10, 0)), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as decimal(10, 0)), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as string), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as string), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as string), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as string), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast('1' as binary), cast(2 as smallint)) FROM t;

SELECT IF(true, cast('1' as binary), cast(2 as float)) FROM t;

SELECT IF(true, cast('1' as binary), cast(2 as string)) FROM t;

SELECT IF(true, cast('1' as binary), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast(1 as boolean), cast(2 as smallint)) FROM t;

SELECT IF(true, cast(1 as boolean), cast(2 as float)) FROM t;

SELECT IF(true, cast(1 as boolean), cast(2 as string)) FROM t;

SELECT IF(true, cast(1 as boolean), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00.0' as timestamp), cast(2 as smallint)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00.0' as timestamp), cast(2 as float)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00.0' as timestamp), cast(2 as string)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00.0' as timestamp), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00' as date), cast(2 as smallint)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00' as date), cast(2 as float)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00' as date), cast(2 as string)) FROM t;

SELECT IF(true, cast('2017-12-12 09:30:00' as date), cast('2017-12-11 09:30:00.0' as timestamp)) FROM t;

SELECT 1 + '2' FROM t;

SELECT 4 / '2' FROM t;

SELECT 1.1 * '2' FROM t;

SELECT 1.1 - '2.2' FROM t;

-- concatenation
SELECT '$' || cast(1 as smallint) || '$' FROM t;

SELECT '$' || cast(1.1 as float) || '$' FROM t;

SELECT '$' || cast(1.1 as decimal(8,3)) || '$' FROM t;

SELECT '$' || timestamp('1996-09-09 10:11:12.4' )|| '$' FROM t;

SELECT length(cast(1 as bigint)) FROM t;

SELECT length(1.1) FROM t;

SELECT length(date('1996-09-10')) FROM t;

SELECT '12:00:01' > TIME'12:00:00' FROM t;

SELECT month( '1996-01-10') FROM t;

SELECT minute( '10:11:12') FROM t;

select date('1996-09-10') like '19%' FROM t;

select '1996-09-10' like date('1996-09-10') FROM t;

SELECT cast(1 as tinyint) in (cast(1 as int)) FROM t;

SELECT cast(1 as tinyint) in (cast(1 as double)) FROM t;

SELECT cast(1 as tinyint) in (cast('1' as binary)) FROM t;

SELECT cast(1 as tinyint) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as int)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as double)) FROM t;

SELECT cast(1 as smallint) in (cast('1' as binary)) FROM t;

SELECT cast(1 as smallint) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as int) in (cast(1 as int)) FROM t;

SELECT cast(1 as int) in (cast(1 as double)) FROM t;

SELECT cast(1 as int) in (cast('1' as binary)) FROM t;

SELECT cast(1 as int) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as int)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as double)) FROM t;

SELECT cast(1 as bigint) in (cast('1' as binary)) FROM t;

SELECT cast(1 as bigint) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as float) in (cast(1 as int)) FROM t;

SELECT cast(1 as float) in (cast(1 as double)) FROM t;

SELECT cast(1 as float) in (cast('1' as binary)) FROM t;

SELECT cast(1 as float) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as double) in (cast(1 as int)) FROM t;

SELECT cast(1 as double) in (cast(1 as double)) FROM t;

SELECT cast(1 as double) in (cast('1' as binary)) FROM t;

SELECT cast(1 as double) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as int)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as double)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast('1' as binary)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as string) in (cast(1 as int)) FROM t;

SELECT cast(1 as string) in (cast(1 as double)) FROM t;

SELECT cast(1 as string) in (cast('1' as binary)) FROM t;

SELECT cast(1 as string) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('1' as binary) in (cast(1 as int)) FROM t;

SELECT cast('1' as binary) in (cast(1 as double)) FROM t;

SELECT cast('1' as binary) in (cast('1' as binary)) FROM t;

SELECT cast('1' as binary) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT true in (cast(1 as int)) FROM t;

SELECT true in (cast(1 as double)) FROM t;

SELECT true in (cast('1' as binary)) FROM t;

SELECT true in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast(2 as int)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast(2 as double)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2' as binary)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast(2 as int)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast(2 as double)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2' as binary)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as tinyint) in (cast(1 as tinyint), cast(1 as int)) FROM t;

SELECT cast(1 as tinyint) in (cast(1 as tinyint), cast(1 as double)) FROM t;

SELECT cast(1 as tinyint) in (cast(1 as tinyint), cast('1' as binary)) FROM t;

SELECT cast(1 as tinyint) in (cast(1 as tinyint), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as smallint), cast(1 as int)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as smallint), cast(1 as double)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as smallint), cast('1' as binary)) FROM t;

SELECT cast(1 as smallint) in (cast(1 as smallint), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as int) in (cast(1 as int), cast(1 as int)) FROM t;

SELECT cast(1 as int) in (cast(1 as int), cast(1 as double)) FROM t;

SELECT cast(1 as int) in (cast(1 as int), cast('1' as binary)) FROM t;

SELECT cast(1 as int) in (cast(1 as int), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as bigint), cast(1 as int)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as bigint), cast(1 as double)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as bigint), cast('1' as binary)) FROM t;

SELECT cast(1 as bigint) in (cast(1 as bigint), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as float) in (cast(1 as float), cast(1 as int)) FROM t;

SELECT cast(1 as float) in (cast(1 as float), cast(1 as double)) FROM t;

SELECT cast(1 as float) in (cast(1 as float), cast('1' as binary)) FROM t;

SELECT cast(1 as float) in (cast(1 as float), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as double) in (cast(1 as double), cast(1 as int)) FROM t;

SELECT cast(1 as double) in (cast(1 as double), cast(1 as double)) FROM t;

SELECT cast(1 as double) in (cast(1 as double), cast('1' as binary)) FROM t;

SELECT cast(1 as double) in (cast(1 as double), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as decimal(10, 0)), cast(1 as int)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as decimal(10, 0)), cast(1 as double)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as decimal(10, 0)), cast('1' as binary)) FROM t;

SELECT cast(1 as decimal(10, 0)) in (cast(1 as decimal(10, 0)), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast(1 as string) in (cast(1 as string), cast(1 as int)) FROM t;

SELECT cast(1 as string) in (cast(1 as string), cast(1 as double)) FROM t;

SELECT cast(1 as string) in (cast(1 as string), cast('1' as binary)) FROM t;

SELECT cast(1 as string) in (cast(1 as string), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('1' as binary) in (cast('1' as binary), cast(1 as int)) FROM t;

SELECT cast('1' as binary) in (cast('1' as binary), cast(1 as double)) FROM t;

SELECT cast('1' as binary) in (cast('1' as binary), cast('1' as binary)) FROM t;

SELECT cast('1' as binary) in (cast('1' as binary), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('1' as boolean) in (cast('1' as boolean), cast(1 as int)) FROM t;

SELECT cast('1' as boolean) in (cast('1' as boolean), cast(1 as double)) FROM t;

SELECT cast('1' as boolean) in (cast('1' as boolean), cast('1' as binary)) FROM t;

SELECT cast('1' as boolean) in (cast('1' as boolean), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2017-12-12 09:30:00.0' as timestamp), cast(1 as int)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2017-12-12 09:30:00.0' as timestamp), cast(1 as double)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2017-12-12 09:30:00.0' as timestamp), cast('1' as binary)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) in (cast('2017-12-12 09:30:00.0' as timestamp), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2017-12-12 09:30:00' as date), cast(1 as int)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2017-12-12 09:30:00' as date), cast(1 as double)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2017-12-12 09:30:00' as date), cast('1' as binary)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) in (cast('2017-12-12 09:30:00' as date), cast('2017-12-11 09:30:00' as date)) FROM t;

SELECT map_zip_with(smallint_map, int_map, (k, v1, v2) -> struct(k, v1, v2)) m
FROM various_maps;

SELECT map_zip_with(decimal_map1, decimal_map2, (k, v1, v2) -> struct(k, v1, v2)) m
FROM various_maps;

SELECT map_zip_with(decimal_map2, int_map, (k, v1, v2) -> struct(k, v1, v2)) m
FROM various_maps;

SELECT map_zip_with(string_map2, date_map, (k, v1, v2) -> struct(k, v1, v2)) m
FROM various_maps;

SELECT map_zip_with(array_map1, array_map2, (k, v1, v2) -> struct(k, v1, v2)) m
FROM various_maps;

SELECT map_zip_with(float_infinity_map1, float_infinity_map2, (k, v1, v2) -> (v1, v2)) m
FROM various_maps;

-- map_zip_with with non-coercible key types reports MAP_ZIP_WITH_DIFF_TYPES, not an internal error
SELECT map_zip_with(map(true, false), map(1, 0), (k, v1, v2) -> struct(k, v1, v2));

SELECT typeof(map_zip_with(map(1, 0), map(2.5, 0), (k, v1, v2) -> k));

SELECT map_zip_with(map(1, 0), map(CAST(1 AS FLOAT), 1), (k, v1, v2) -> v1 + v2);

SELECT map_zip_with(map(array(1), 0), map(1, 0), (k, v1, v2) -> k);

SELECT typeof(map_zip_with(map(1, 0), map('2', 0), (k, v1, v2) -> k));

-- Concatenate maps of the same type
SELECT
    map_concat(boolean_map1, boolean_map2) boolean_map,
    map_concat(tinyint_map1, tinyint_map2) tinyint_map,
    map_concat(smallint_map1, smallint_map2) smallint_map,
    map_concat(int_map1, int_map2) int_map,
    map_concat(bigint_map1, bigint_map2) bigint_map,
    map_concat(decimal_map1, decimal_map2) decimal_map,
    map_concat(float_map1, float_map2) float_map,
    map_concat(double_map1, double_map2) double_map,
    map_concat(date_map1, date_map2) date_map,
    map_concat(timestamp_map1, timestamp_map2) timestamp_map,
    map_concat(string_map1, string_map2) string_map,
    map_concat(array_map1, array_map2) array_map,
    map_concat(struct_map1, struct_map2) struct_map,
    map_concat(string_int_map1, string_int_map2) string_int_map,
    map_concat(int_string_map1, int_string_map2) int_string_map
FROM various_maps;

-- Concatenate map of incompatible types 2
SELECT
    map_concat(boolean_map1, int_map2) bi_map
FROM various_maps;

-- Concatenate map of incompatible types 5
SELECT
    map_concat(int_map1, array_map2) ms_map
FROM various_maps;

SELECT '1' + cast(1 as int)                             FROM t;

SELECT '1' + cast(1 as double)                          FROM t;

SELECT '1' + cast('1' as binary)                        FROM t;

SELECT '1' + cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' - cast(1 as int)                             FROM t;

SELECT '1' - cast(1 as double)                          FROM t;

SELECT '1' - cast('1' as binary)                        FROM t;

SELECT '1' - cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' * cast(1 as int)                             FROM t;

SELECT '1' * cast(1 as double)                          FROM t;

SELECT '1' * cast('1' as binary)                        FROM t;

SELECT '1' * cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' / cast(1 as int)                             FROM t;

SELECT '1' / cast(1 as double)                          FROM t;

SELECT '1' / cast('1' as binary)                        FROM t;

SELECT '1' / cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' % cast(1 as int)                             FROM t;

SELECT '1' % cast(1 as double)                          FROM t;

SELECT '1' % cast('1' as binary)                        FROM t;

SELECT '1' % cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT pmod('1', cast(1 as int))                             FROM t;

SELECT pmod('1', cast(1 as double))                          FROM t;

SELECT pmod('1', cast('1' as binary))                        FROM t;

SELECT pmod('1', cast('2017-12-11 09:30:00' as date))        FROM t;

SELECT cast(1 as int)                             + '1' FROM t;

SELECT cast(1 as double)                          + '1' FROM t;

SELECT cast(1 as boolean)                         + '1' FROM t;

SELECT cast(1 as tinyint)                         - '1' FROM t;

SELECT cast(1 as bigint)                          - '1' FROM t;

SELECT cast(1 as decimal(10, 0))                  - '1' FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) - '1' FROM t;

SELECT cast(1 as smallint)                        * '1' FROM t;

SELECT cast(1 as float)                           * '1' FROM t;

SELECT cast('1' as binary)                        * '1' FROM t;

SELECT cast('2017-12-11 09:30:00' as date)        * '1' FROM t;

SELECT cast(1 as int)                             / '1' FROM t;

SELECT cast(1 as double)                          / '1' FROM t;

SELECT cast(1 as boolean)                         / '1' FROM t;

SELECT cast(1 as tinyint)                         % '1' FROM t;

SELECT cast(1 as bigint)                          % '1' FROM t;

SELECT cast(1 as decimal(10, 0))                  % '1' FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) % '1' FROM t;

SELECT pmod(cast(1 as smallint), '1')                        FROM t;

SELECT pmod(cast(1 as float), '1')                           FROM t;

SELECT pmod(cast('1' as binary), '1')                        FROM t;

SELECT pmod(cast('2017-12-11 09:30:00' as date), '1')        FROM t;

SELECT '1' = cast('1' as binary)                        FROM t;

SELECT '1' = cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) = '1' FROM t;

SELECT '1' <=> cast(1 as smallint)                        FROM t;

SELECT '1' <=> cast(1 as float)                           FROM t;

SELECT '1' <=> '1'                                        FROM t;

SELECT '1' <=> cast('2017-12-11 09:30:00.0' as timestamp) FROM t;

SELECT cast(1 as smallint)                        <=> '1' FROM t;

SELECT cast(1 as float)                           <=> '1' FROM t;

SELECT cast('1' as binary)                        <=> '1' FROM t;

SELECT cast('2017-12-11 09:30:00' as date)        <=> '1' FROM t;

SELECT '1' < cast(1 as int)                             FROM t;

SELECT '1' < cast(1 as double)                          FROM t;

SELECT '1' < cast('1' as binary)                        FROM t;

SELECT '1' < cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' <= cast(1 as int)                             FROM t;

SELECT '1' <= cast(1 as double)                          FROM t;

SELECT '1' <= cast('1' as binary)                        FROM t;

SELECT '1' <= cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' > cast(1 as int)                             FROM t;

SELECT '1' > cast(1 as double)                          FROM t;

SELECT '1' > cast('1' as binary)                        FROM t;

SELECT '1' > cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' >= cast(1 as int)                             FROM t;

SELECT '1' >= cast(1 as double)                          FROM t;

SELECT '1' >= cast('1' as binary)                        FROM t;

SELECT '1' >= cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT '1' <> cast(1 as int)                             FROM t;

SELECT '1' <> cast(1 as double)                          FROM t;

SELECT '1' <> cast('1' as binary)                        FROM t;

SELECT '1' <> cast('2017-12-11 09:30:00' as date)        FROM t;

SELECT cast(1 as int)                             < '1' FROM t;

SELECT cast(1 as double)                          < '1' FROM t;

SELECT cast(1 as boolean)                         < '1' FROM t;

SELECT cast(1 as tinyint)                         <= '1' FROM t;

SELECT cast(1 as bigint)                          <= '1' FROM t;

SELECT cast(1 as decimal(10, 0))                  <= '1' FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <= '1' FROM t;

SELECT cast(1 as smallint)                        > '1' FROM t;

SELECT cast(1 as float)                           > '1' FROM t;

SELECT cast('1' as binary)                        > '1' FROM t;

SELECT cast('2017-12-11 09:30:00' as date)        > '1' FROM t;

SELECT cast(1 as int)                             >= '1' FROM t;

SELECT cast(1 as double)                          >= '1' FROM t;

SELECT cast(1 as boolean)                         >= '1' FROM t;

SELECT cast(1 as tinyint)                         <> '1' FROM t;

SELECT cast(1 as bigint)                          <> '1' FROM t;

SELECT cast(1 as decimal(10, 0))                  <> '1' FROM t;

SELECT cast('2017-12-11 09:30:00.0' as timestamp) <> '1' FROM t;

SELECT sum('1') FROM t;

SELECT stddev_samp('1') FROM t;

SELECT var_pop('1') FROM t;

SELECT kurtosis('1') FROM t;

select cast(a as short) from t;

select cast(a as float) from t;

select cast(a as boolean) from t;

-- casting to binary works correctly
select cast(a as binary) from t;

select cast(a as map<string, string>) from t;

select to_unix_timestamp(a) from t;

select unix_timestamp('2018-01-01', a) from t;

select next_day(a, 'MO') from t;

select trunc('2018-01-01', a) from t;

select get_json_object(a, a) from t;

-- UNION
SELECT cast(1 as tinyint) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as tinyint) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as tinyint) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as tinyint) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as smallint) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as smallint) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as smallint) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as smallint) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as int) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as int) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as int) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as int) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as bigint) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as bigint) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as bigint) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as bigint) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as float) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as float) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as float) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as float) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as double) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as double) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as double) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as double) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as decimal(10, 0)) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as decimal(10, 0)) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as decimal(10, 0)) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as decimal(10, 0)) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as string) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as string) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as string) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as string) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast('1' as binary) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast('1' as binary) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast('1' as binary) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast('1' as binary) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast(1 as boolean) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast(1 as boolean) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast(1 as boolean) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast(1 as boolean) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast('2017-12-12 09:30:00.0' as timestamp) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) FROM t UNION SELECT cast(2 as tinyint) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) FROM t UNION SELECT cast(2 as bigint) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) FROM t UNION SELECT cast(2 as decimal(10, 0)) FROM t;

SELECT cast('2017-12-12 09:30:00' as date) FROM t UNION SELECT cast(2 as boolean) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as tinyint)) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as bigint)) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as decimal(10, 0))) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as boolean)) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as tinyint) DESC RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as bigint) DESC RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as decimal(10, 0)) DESC RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t;

SELECT COUNT(*) OVER (PARTITION BY 1 ORDER BY cast(1 as boolean) DESC RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM t;

-- CUBE on overlapping columns
SELECT a + b, b, udaf(a - b) FROM testData GROUP BY a + b, b WITH CUBE;

SELECT a, b, udaf(b) FROM testData GROUP BY a, b WITH ROLLUP;

SELECT course, year, udaf(earnings) FROM courseSales GROUP BY ROLLUP(course, year, (course, year), ()) ORDER BY course, year;

SELECT course, year, udaf(earnings) FROM courseSales GROUP BY CUBE(course, year, (course, year), ()) ORDER BY course, year;

SELECT course, year, udaf(earnings) FROM courseSales GROUP BY course, year GROUPING SETS(course);

SELECT course, year, udaf(earnings) FROM courseSales GROUP BY CUBE(course, year), ROLLUP(course, year) ORDER BY course, year;

SELECT course, udaf(earnings) AS sum, GROUPING_ID(course, earnings) FROM courseSales
GROUP BY course, earnings GROUPING SETS((), (course), (course, earnings)) ORDER BY course, sum;

SELECT a + b, b AS k, udaf(a - b) FROM testData GROUP BY a + b, k GROUPING SETS(k);

SELECT a, b, udaf(1) FROM testData GROUP BY CUBE(a, b), ROLLUP(a, b);

SELECT a, b, udaf(1) FROM testData GROUP BY a, CUBE(a, b), GROUPING SETS((a, b), (a), ());

SELECT a, b, udaf(1) FROM testData GROUP BY a, GROUPING SETS(GROUPING SETS((a, b), (a), ()));

SELECT a, b, udaf(1) FROM testData GROUP BY a, GROUPING SETS(GROUPING SETS((a, b, a, b), (a, b, a), (a, b)));

SELECT a, b, udaf(1) FROM testData GROUP BY a, GROUPING SETS((a, b), (a), (), (a, b), (a), (b), ());

-- duplicate group by column
select a, 1, udaf(b) from data group by a, 1;

-- with alias
select a as aa, b + 2 as bb, udaf(2) from data group by 1, 2;

select a, b, udaf(b) + 2 from data group by 3;

-- group by ordinal followed by having
select udaf(a), a from (select 1 as a) tmp group by 2 having a > 0;

-- mixed cases: can use ordinal in CUBE
select a, b, udaf(1) from data group by cube(1, b);

-- mixed cases: can use ordinal in ROLLUP
select a, b, udaf(1) from data group by rollup(1, b);

-- mixed cases: can use ordinal in GROUPING SETS
select a, b, udaf(1) from data group by grouping sets((1), (b), (a, 2));

select a, b, udaf(1) from data group by a, 3;

-- can now group by negative literal
select udaf(b) from data group by -1;

-- Aggregate with non-empty GroupBy expressions.
SELECT a, udaf(b) FROM testData GROUP BY a;

-- Aggregate grouped by literals.
SELECT 'foo', udaf(a) FROM testData GROUP BY 1;

-- Aggregate with complex GroupBy expressions.
SELECT a + b, udaf(b) FROM testData GROUP BY a + b;

-- Aggregate with nulls.
SELECT SKEWNESS(a), KURTOSIS(a), udaf(a), udaf(a), AVG(a), VARIANCE(a), STDDEV(a), SUM(a), udaf(a)
FROM testData;

SELECT a AS k, udaf(b) FROM testData GROUP BY k HAVING k > 1;

-- Check analysis exceptions
SELECT a AS k, udaf(b) FROM testData GROUP BY k;

SELECT 1 FROM (SELECT udaf(1) FROM testData WHERE false) t;

-- empty table
SELECT udaf(v), some(v), any(v), bool_and(v), bool_or(v) FROM test_agg WHERE 1 = 0;

-- group by
SELECT k, udaf(v), some(v), any(v), bool_and(v), bool_or(v) FROM test_agg GROUP BY k;

-- basic subquery path to make sure rewrite happens in both parent and child plans.
SELECT k,
       udaf(v) AS count
FROM   test_agg
WHERE  k = 2
       AND v IN (SELECT Any(v)
                 FROM   test_agg
                 WHERE  k = 1)
GROUP  BY k;

-- SPARK-17849: grouping set throws NPE #3
SELECT a, b, c, udaf(d) FROM grouping GROUP BY a, b, c GROUPING SETS ((c));

-- Mutiple grouping within a grouping set
SELECT c1, c2, udaf(c3), grouping__id
FROM   (VALUES ('x', 'a', 10), ('y', 'b', 20) ) AS t (c1, c2, c3)
GROUP  BY GROUPING SETS ( ( c1 ), ( c2 ) )
HAVING GROUPING__ID > 1;

-- negative tests - must have at least one grouping expression
SELECT a, b, c, udaf(d) FROM grouping GROUP BY WITH ROLLUP;

SELECT grouping__id, k1, k2, udaf(v) FROM (VALUES (1,1,1),(2,2,2)) AS t(k1,k2,v) GROUP BY GROUPING SETS ((k1),(k1,k2),(k2,k1));

-- Test aggregate operator and UDAF with codegen on and off.




CREATE OR REPLACE TEMPORARY VIEW t1 AS SELECT * FROM VALUES
(1), (2), (3), (4)
as t1(int_col1);

SELECT default.myDoubleAvg(int_col1, 3) as my_avg from t1;

DROP FUNCTION myDoubleAvg;

SELECT udf(avg(a)) AS avg_32 FROM aggtest WHERE a < 100;

SELECT udf(sum(a)) AS sum_198 FROM aggtest;

SELECT max(udf(a)) AS max_100 FROM aggtest;

SELECT udf(stddev_samp(b)) FROM aggtest;

SELECT udf(stddev_pop(CAST(b AS Decimal(38,0)))) FROM aggtest;

SELECT var_samp(udf(CAST(b AS Decimal(38,0)))) FROM aggtest;

-- verify correct results for null and NaN inputs
select sum(udf(CAST(null AS int))) from range(1,4);

select sum(udf(CAST(null AS DOUBLE))) from range(1,4);

select avg(udf(CAST(null AS Decimal(38,0)))) from range(1,4);

select avg(CAST(udf('NaN') AS DOUBLE)) from range(1,4);

SELECT avg(CAST(udf(x) AS DOUBLE)), var_pop(CAST(udf(x) AS DOUBLE))
FROM (VALUES ('-Infinity'), ('Infinity')) v(x);

SELECT udf(covar_pop(b, udf(a))), covar_samp(udf(b), a) FROM aggtest;

-- test count, distinct
SELECT count(udf(four)) AS cnt_1000 FROM onek;

select ten, count(udf(four)), udf(sum(DISTINCT four)) from onek
group by ten order by ten;

-- [SPARK-27769] Test handling of sublinks within outer-level aggregates.
-- Per bug report from Daniel Grace.
select
  (select udf(max((select i.unique2 from tenk1 i where i.unique1 = o.unique1))))
from tenk1 o;

-- explain
--  select max(unique1) from tenk1;
select udf(max(unique1)) from tenk1;

-- the planner may choose a generic aggregate here if parallel query is
-- enabled, since that plan will be parallel safe and the "optimized"
-- plan, which has almost identical cost, will not be.  we want to test
-- the optimized plan, so temporarily disable parallel query.
-- begin;
-- set local max_parallel_workers_per_gather = 0;
-- explain
--  select max(unique1) from tenk1 where unique1 > 42000;
select max(unique1) from tenk1 where udf(unique1) > 42000;

-- [SPARK-17348] Correlated column is not allowed in a non-equality predicate
-- check parameter propagation into an indexscan subquery
-- explain
--  select f1, (select min(unique1) from tenk1 where unique1 > f1) AS gt
--    from int4_tbl;
-- select f1, (select min(unique1) from tenk1 where unique1 > f1) AS gt
--  from int4_tbl;

-- check some cases that were handled incorrectly in 8.3.0
-- explain
--  select distinct max(unique2) from tenk1;
select distinct max(udf(unique2)) from tenk1;

-- explain
--  select max(unique2) from tenk1 order by max(unique2)+1;
select udf(max(udf(unique2))) from tenk1 order by udf(max(unique2))+1;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- AGGREGATES [Part 3]
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/aggregates.sql#L352-L605

-- This test file was converted from postgreSQL/aggregates_part3.sql.

-- [SPARK-28865] Table inheritance
-- try it on an inheritance tree
-- create table minmaxtest(f1 int);
-- create table minmaxtest1() inherits (minmaxtest);
-- create table minmaxtest2() inherits (minmaxtest);
-- create table minmaxtest3() inherits (minmaxtest);
-- create index minmaxtesti on minmaxtest(f1);
-- create index minmaxtest1i on minmaxtest1(f1);
-- create index minmaxtest2i on minmaxtest2(f1 desc);
-- create index minmaxtest3i on minmaxtest3(f1) where f1 is not null;

-- insert into minmaxtest values(11), (12);
-- insert into minmaxtest1 values(13), (14);
-- insert into minmaxtest2 values(15), (16);
-- insert into minmaxtest3 values(17), (18);

-- explain (costs off)
--   select min(f1), max(f1) from minmaxtest;
-- select min(f1), max(f1) from minmaxtest;

-- DISTINCT doesn't do anything useful here, but it shouldn't fail
-- explain (costs off)
--   select distinct min(f1), max(f1) from minmaxtest;
-- select distinct min(f1), max(f1) from minmaxtest;

-- drop table minmaxtest cascade;

-- check for correct detection of nested-aggregate errors
select udf(max(min(unique1))) from tenk1;

--
-- Portions Copyright (c) 1996-2019, PostgreSQL Global Development Group
--
--
-- CASE
-- https://github.com/postgres/postgres/blob/REL_12_BETA2/src/test/regress/sql/case.sql
-- Test the CASE statement
--
-- This test file was converted from postgreSQL/case.sql.

CREATE TABLE CASE_TBL (
  i integer,
  f double
) USING parquet;

SELECT '3' AS `One`,
  CASE
    WHEN udf(1) < 2 THEN udf(3)
    ELSE udf(4)
  END AS `Simple ELSE`;

SELECT '7' AS `None`,
  CASE WHEN rand() < udf(0) THEN 1
  END AS `NULL on no matches`;

-- SPARK-39122: Python UDF does not follow the conditional expression evaluation order
-- SELECT CASE WHEN i > 100 THEN udf(1/0) ELSE udf(0) END FROM case_tbl;

-- Test for cases involving untyped literals in test expression
SELECT CASE 'a' WHEN 'a' THEN udf(1) ELSE udf(2) END;

SELECT udf(COALESCE(a.f, b.i, b.j))
  FROM CASE_TBL a, CASE2_TBL b;

SELECT '' AS `Two`, *
  FROM CASE_TBL a, CASE2_TBL b
  WHERE udf(COALESCE(f,b.i) = 2);

-- [SPARK-20856] Do not need onerow because it only used for test statement using nested joins
-- useful in some tests below
-- create temp table onerow();
-- insert into onerow default values;
-- analyze onerow;


--
-- CORRELATION NAMES
-- Make sure that table/column aliases are supported
-- before diving into more complex join syntax.
--

SELECT udf('') AS `xxx`, udf(i), udf(j), udf(t)
  FROM J1_TBL AS tx;

SELECT udf('') AS `xxx`, udf(a), udf(b), udf(udf(c))
  FROM J1_TBL t1 (a, b, c);

-- ambiguous column
SELECT udf('') AS `xxx`, udf(i) AS i, udf(k), udf(t) AS t
  FROM J1_TBL CROSS JOIN J2_TBL;

-- [SPARK-28377] Fully support correlation names in the FROM clause
-- SELECT '' AS `xxx`, tx.ii, tx.jj, tx.kk
--   FROM (J1_TBL t1 (a, b, c) CROSS JOIN J2_TBL t2 (d, e))
--     AS tx (ii, jj, tt, ii2, kk);

SELECT udf('') AS `xxx`, udf(udf(j1_tbl.i)), udf(j), udf(t), udf(a.i), udf(a.k), udf(b.i),  udf(b.k)
  FROM J1_TBL CROSS JOIN J2_TBL a CROSS JOIN J2_TBL b;

SELECT udf('') AS `xxx`, *
  FROM J1_TBL t1 (a, b, c) JOIN J2_TBL t2 (a, d) USING (a)
  ORDER BY udf(udf(a)), udf(d);

SELECT udf('') AS `xxx`, udf(udf(a)), udf(udf(b)), udf(udf(c)) AS c, udf(udf(udf(d))) AS d
  FROM J1_TBL t1 (a, b, c) NATURAL JOIN J2_TBL t2 (d, a);

--
-- Non-equi-joins
--

SELECT udf('') AS `xxx`, udf(J1_TBL.i), udf(J1_TBL.j), udf(J1_TBL.t), udf(J2_TBL.i), udf(J2_TBL.k)
  FROM J1_TBL JOIN J2_TBL ON (udf(J1_TBL.i) <= udf(udf(J2_TBL.k)));

SELECT udf('') AS `xxx`, udf(udf(i)), udf(j), udf(t), udf(k)
  FROM J1_TBL RIGHT OUTER JOIN J2_TBL USING (i);

SELECT udf('') AS `xxx`, udf(i), udf(j), t, udf(udf(k))
  FROM J1_TBL FULL JOIN J2_TBL USING (i)
  ORDER BY udf(udf(i)), udf(k), udf(udf(t));

--
-- Test interactions of join syntax and subqueries
--

-- Basic cases (we expect planner to pull up the subquery here)
SELECT * FROM
(SELECT udf(name) as name, t2.n FROM t2) as s2
INNER JOIN
(SELECT udf(udf(name)) as name, t3.n FROM t3) s3
USING (name);

-- Cases with non-nullable expressions in subquery results;
-- make sure these go to null as expected
SELECT * FROM
(SELECT udf(udf(name)) as name, udf(n) as s2_n, udf(2) as s2_2 FROM t2) as s2
NATURAL INNER JOIN
(SELECT udf(name) as name, udf(udf(n)) as s3_n, udf(3) as s3_2 FROM t3) s3;

SELECT * FROM
(SELECT udf(udf(name)) as name, udf(n) as s1_n, 1 as s1_1 FROM t1) as s1
NATURAL INNER JOIN
(SELECT udf(name) as name, udf(n) as s2_n, 2 as s2_2 FROM t2) as s2
NATURAL INNER JOIN
(SELECT udf(udf(udf(name))) as name, udf(n) as s3_n, 3 as s3_2 FROM t3) s3;

SELECT * FROM
(SELECT name, n as s1_n FROM t1) as s1
NATURAL FULL JOIN
  (SELECT * FROM
    (SELECT name, udf(udf(n)) as s2_n, 2 as s2_2 FROM t2) as s2
    NATURAL FULL JOIN
    (SELECT name, udf(n) as s3_n FROM t3) as s3
  ) ss2;

select udf(y1), udf(udf(y2)) from y;

select * from (x left join y on (udf(x1) = udf(udf(y1)))) left join x xx(xx1,xx2)
on (udf(udf(x1)) = udf(xx1));

select * from (x left join y on (udf(x1) = y1)) left join x xx(xx1,xx2)
on (udf(udf(x1)) = udf(xx1) and udf(udf(xx2)) is not null);

select * from (x left join y on (udf(x1) = udf(y1))) left join x xx(xx1,xx2)
on (x1 = udf(xx1)) where (xx2 is not null);

-- try that with GEQO too
-- begin;
-- set geqo = on;
-- set geqo_threshold = 2;
select udf(udf(count(*))) from tenk1 x where
  udf(x.unique1) in (select udf(a.f1) from int4_tbl a,float8_tbl b where udf(udf(a.f1))=b.f1) and
  udf(x.unique1) = 0 and
  udf(udf(x.unique1)) in (select udf(aa.f1) from int4_tbl aa,float8_tbl bb where udf(aa.f1)=udf(udf(bb.f1)));

--
-- regression test: check a case where we formerly missed including an EC
-- enforcement clause because it was expected to be handled at scan level
--
-- explain (costs off)
-- select a.f1, b.f1, t.thousand, t.tenthous from
--   tenk1 t,
--   (select sum(f1)+1 as f1 from int4_tbl i4a) a,
--   (select sum(f1) as f1 from int4_tbl i4b) b
-- where b.f1 = t.thousand and a.f1 = b.f1 and (a.f1+b.f1+999) = t.tenthous;

select udf(a.f1), udf(b.f1), udf(t.thousand), udf(t.tenthous) from
  tenk1 t,
  (select udf(udf(sum(udf(f1))+1)) as f1 from int4_tbl i4a) a,
  (select udf(sum(udf(f1))) as f1 from int4_tbl i4b) b
where b.f1 = udf(t.thousand) and udf(a.f1) = udf(b.f1) and udf((udf(a.f1)+udf(b.f1)+999)) = udf(udf(t.tenthous));

-- set enable_hashjoin to off;
-- set enable_nestloop to off;

-- these should give the same results

select tt1.*, tt2.* from tt1 left join tt2 on udf(udf(tt1.joincol)) = udf(tt2.joincol);

-- reset work_mem;
-- reset enable_mergejoin;

--
-- regression test for 8.2 bug with improper re-ordering of left joins
--

DROP TABLE IF EXISTS tt3;

-- create index tt3i on tt3(f1);
-- analyze tt3;

DROP TABLE IF EXISTS tt4;

-- analyze tt4;

SELECT udf(udf(a.f1)) as f1
FROM tt4 a
LEFT JOIN (
        SELECT b.f1
        FROM tt3 b LEFT JOIN tt3 c ON udf(b.f1) = udf(c.f1)
        WHERE udf(c.f1) IS NULL
) AS d ON udf(a.f1) = d.f1
WHERE udf(udf(d.f1)) IS NULL;

select * from
  zt2 left join zt3 on (udf(f2) = udf(udf(f3)))
      left join zt1 on (udf(udf(f3)) = udf(f1))
where udf(f2) = 53;

select * from a left join b on udf(i) = x and i = udf(y) and udf(x) = udf(i);

-- [SPARK-28330] Enhance query limit
-- select t1.q2, count(t2.q1, t2.q2)
-- from int8_tbl t1 left join (select * from int8_tbl offset 0) t2 on (t1.q2 = t2.q1)
-- group by t1.q2 order by 1;

select udf(t1.q2) as q2, udf(udf(count(t2.q1, t2.q2)))
from int8_tbl t1 left join
  (select udf(q1) as q1, case when q2=1 then 1 else q2 end as q2 from int8_tbl) t2
  on (udf(t1.q2) = udf(t2.q1))
group by t1.q2 order by 1;

-- test the path using join aliases, too
SELECT * FROM
( SELECT 1 as key1 ) sub1
LEFT JOIN
( SELECT udf(sub3.key3) as key3, udf(value2), udf(COALESCE(value2, 66)) as value3 FROM
    ( SELECT 1 as key3 ) sub3
    LEFT JOIN
    ( SELECT sub5.key5, COALESCE(sub6.value1, 1) as value2 FROM
        ( SELECT 1 as key5 ) sub5
        LEFT JOIN
        ( SELECT 2 as key6, 42 as value1 ) sub6
        ON udf(udf(sub5.key5)) = sub6.key6
    ) sub4
    ON sub4.key5 = sub3.key3
) sub2
ON sub1.key1 = udf(udf(sub2.key3));

--
-- test for ability to use a cartesian join when necessary
--

-- explain (costs off)
-- select * from
--   tenk1 join int4_tbl on f1 = twothousand,
--   int4(sin(1)) q1,
--   int4(sin(0)) q2
-- where q1 = thousand or q2 = thousand;

-- explain (costs off)
-- select * from
--   tenk1 join int4_tbl on f1 = twothousand,
--   int4(sin(1)) q1,
--   int4(sin(0)) q2
-- where thousand = (q1 + q2);

--
-- test ability to generate a suitable plan for a star-schema query
--

-- explain (costs off)
-- select * from
--   tenk1, int8_tbl a, int8_tbl b
-- where thousand = a.q1 and tenthous = b.q1 and a.q2 = 1 and b.q2 = 2;

--
-- test a corner case in which we shouldn't apply the star-schema optimization
--

-- explain (costs off)
-- select t1.unique2, t1.stringu1, t2.unique1, t2.stringu2 from
--   tenk1 t1
--   inner join int4_tbl i1
--     left join (select v1.x2, v2.y1, 11 AS d1
--                from (select 1,0 from onerow) v1(x1,x2)
--                left join (select 3,1 from onerow) v2(y1,y2)
--                on v1.x1 = v2.y2) subq1
--     on (i1.f1 = subq1.x2)
--   on (t1.unique2 = subq1.d1)
--   left join tenk1 t2
--   on (subq1.y1 = t2.unique1)
-- where t1.unique2 < 42 and t1.stringu1 > t2.stringu2;

-- [SPARK-20856] support statement using nested joins
-- select t1.unique2, t1.stringu1, t2.unique1, t2.stringu2 from
--   tenk1 t1
--   inner join int4_tbl i1
--     left join (select v1.x2, v2.y1, 11 AS d1
--                from (select 1,0 from onerow) v1(x1,x2)
--                left join (select 3,1 from onerow) v2(y1,y2)
--                on v1.x1 = v2.y2) subq1
--     on (i1.f1 = subq1.x2)
--   on (t1.unique2 = subq1.d1)
--   left join tenk1 t2
--   on (subq1.y1 = t2.unique1)
-- where t1.unique2 < 42 and t1.stringu1 > t2.stringu2;

-- variant that isn't quite a star-schema case

-- [SPARK-16452] basic INFORMATION_SCHEMA support
-- select ss1.d1 from
--   tenk1 as t1
--   inner join tenk1 as t2
--   on t1.tenthous = t2.ten
--   inner join
--     int8_tbl as i8
--     left join int4_tbl as i4
--       inner join (select 64::information_schema.cardinal_number as d1
--                   from tenk1 t3,
--                        lateral (select abs(t3.unique1) + random()) ss0(x)
--                   where t3.fivethous < 0) as ss1
--       on i4.f1 = ss1.d1
--     on i8.q1 = i4.f1
--   on t1.tenthous = ss1.d1
-- where t1.unique1 < i4.f1;

-- this variant is foldable by the remove-useless-RESULT-RTEs code

-- explain (costs off)
-- select t1.unique2, t1.stringu1, t2.unique1, t2.stringu2 from
--   tenk1 t1
--   inner join int4_tbl i1
--     left join (select v1.x2, v2.y1, 11 AS d1
--                from (values(1,0)) v1(x1,x2)
--                left join (values(3,1)) v2(y1,y2)
--                on v1.x1 = v2.y2) subq1
--     on (i1.f1 = subq1.x2)
--   on (t1.unique2 = subq1.d1)
--   left join tenk1 t2
--   on (subq1.y1 = t2.unique1)
-- where t1.unique2 < 42 and t1.stringu1 > t2.stringu2;

-- [SPARK-20856] support statement using nested joins
-- select t1.unique2, t1.stringu1, t2.unique1, t2.stringu2 from
--   tenk1 t1
--   inner join int4_tbl i1
--     left join (select v1.x2, v2.y1, 11 AS d1
--                from (values(1,0)) v1(x1,x2)
--                left join (values(3,1)) v2(y1,y2)
--                on v1.x1 = v2.y2) subq1
--     on (i1.f1 = subq1.x2)
--   on (t1.unique2 = subq1.d1)
--   left join tenk1 t2
--   on (subq1.y1 = t2.unique1)
-- where t1.unique2 < 42 and t1.stringu1 > t2.stringu2;

--
-- test extraction of restriction OR clauses from join OR clause
-- (we used to only do this for indexable clauses)
--

-- explain (costs off)
-- select * from tenk1 a join tenk1 b on
--   (a.unique1 = 1 and b.unique1 = 2) or (a.unique2 = 3 and b.hundred = 4);
-- explain (costs off)
-- select * from tenk1 a join tenk1 b on
--   (a.unique1 = 1 and b.unique1 = 2) or (a.unique2 = 3 and b.ten = 4);
-- explain (costs off)
-- select * from tenk1 a join tenk1 b on
--   (a.unique1 = 1 and b.unique1 = 2) or
--   ((a.unique2 = 3 or a.unique2 = 7) and b.hundred = 4);

--
-- test placement of movable quals in a parameterized join tree
--

-- explain (costs off)
-- select * from tenk1 t1 left join
--   (tenk1 t2 join tenk1 t3 on t2.thousand = t3.unique2)
--   on t1.hundred = t2.hundred and t1.ten = t3.ten
-- where t1.unique1 = 1;

-- explain (costs off)
-- select * from tenk1 t1 left join
--   (tenk1 t2 join tenk1 t3 on t2.thousand = t3.unique2)
--   on t1.hundred = t2.hundred and t1.ten + t2.ten = t3.ten
-- where t1.unique1 = 1;

-- explain (costs off)
-- select count(*) from
--   tenk1 a join tenk1 b on a.unique1 = b.unique2
--   left join tenk1 c on a.unique2 = b.unique1 and c.thousand = a.thousand
--   join int4_tbl on b.thousand = f1;

select udf(count(*)) from
  tenk1 a join tenk1 b on udf(a.unique1) = udf(b.unique2)
  left join tenk1 c on udf(a.unique2) = udf(b.unique1) and udf(c.thousand) = udf(udf(a.thousand))
  join int4_tbl on udf(b.thousand) = f1;

-- explain (costs off)
-- select * from
-- (values (1, array[10,20]), (2, array[20,30])) as v1(v1x,v1ys)
-- left join (values (1, 10), (2, 20)) as v2(v2x,v2y) on v2x = v1x
-- left join unnest(v1ys) as u1(u1y) on u1y = v2y;

-- [SPARK-28382] Array Functions: unnest
-- select * from
-- (values (1, array(10,20)), (2, array(20,30))) as v1(v1x,v1ys)
-- left join (values (1, 10), (2, 20)) as v2(v2x,v2y) on v2x = v1x
-- left join unnest(v1ys) as u1(u1y) on u1y = v2y;

--
-- test handling of potential equivalence clauses above outer joins
--

-- explain (costs off)
-- select q1, unique2, thousand, hundred
--   from int8_tbl a left join tenk1 b on q1 = unique2
--   where coalesce(thousand,123) = q1 and q1 = coalesce(hundred,123);

select udf(q1), udf(unique2), udf(thousand), udf(hundred)
  from int8_tbl a left join tenk1 b on udf(q1) = udf(unique2)
  where udf(coalesce(thousand,123)) = udf(q1) and udf(q1) = udf(udf(coalesce(hundred,123)));

--
-- check handling of join aliases when flattening multiple levels of subquery
--

-- explain (verbose, costs off)
-- select foo1.join_key as foo1_id, foo3.join_key AS foo3_id, bug_field from
--   (values (0),(1)) foo1(join_key)
-- left join
--   (select join_key, bug_field from
--     (select ss1.join_key, ss1.bug_field from
--       (select f1 as join_key, 666 as bug_field from int4_tbl i1) ss1
--     ) foo2
--    left join
--     (select unique2 as join_key from tenk1 i2) ss2
--    using (join_key)
--   ) foo3
-- using (join_key);


-- [SPARK-28377] Fully support correlation names in the FROM clause
-- select foo1.join_key as foo1_id, foo3.join_key AS foo3_id, bug_field from
--   (values (0),(1)) foo1(join_key)
-- left join
--   (select join_key, bug_field from
--     (select ss1.join_key, ss1.bug_field from
--       (select f1 as join_key, 666 as bug_field from int4_tbl i1) ss1
--     ) foo2
--    left join
--     (select unique2 as join_key from tenk1 i2) ss2
--    using (join_key)
--   ) foo3
-- using (join_key);

-- [SPARK-20856] Support statement using nested joins
--
-- test successful handling of nested outer joins with degenerate join quals
--

-- explain (verbose, costs off)
-- select t1.* from
--   text_tbl t1
--   left join (select *, '***'::text as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, null::int as d2 from int8_tbl i8b2) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- select t1.* from
--   text_tbl t1
--   left join (select *, string('***') as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, int(null) as d2 from int8_tbl i8b2) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- explain (verbose, costs off)
-- select t1.* from
--   text_tbl t1
--   left join (select *, '***'::text as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, null::int as d2 from int8_tbl i8b2, int4_tbl i4b2) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- select t1.* from
--   text_tbl t1
--   left join (select *, string('***') as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, int(null) as d2 from int8_tbl i8b2, int4_tbl i4b2) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- explain (verbose, costs off)
-- select t1.* from
--   text_tbl t1
--   left join (select *, '***'::text as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, null::int as d2 from int8_tbl i8b2, int4_tbl i4b2
--                  where q1 = f1) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- select t1.* from
--   text_tbl t1
--   left join (select *, string('***') as d1 from int8_tbl i8b1) b1
--     left join int8_tbl i8
--       left join (select *, int(null) as d2 from int8_tbl i8b2, int4_tbl i4b2
--                  where q1 = f1) b2
--       on (i8.q1 = b2.q1)
--     on (b2.d2 = b1.q2)
--   on (t1.f1 = b1.d1)
--   left join int4_tbl i4
--   on (i8.q2 = i4.f1);

-- explain (verbose, costs off)
-- select * from
--   text_tbl t1
--   inner join int8_tbl i8
--   on i8.q2 = 456
--   right join text_tbl t2
--   on t1.f1 = 'doh!'
--   left join int4_tbl i4
--   on i8.q1 = i4.f1;

select * from
  text_tbl t1
  inner join int8_tbl i8
  on udf(i8.q2) = udf(udf(456))
  right join text_tbl t2
  on udf(t1.f1) = udf(udf('doh!'))
  left join int4_tbl i4
  on udf(udf(i8.q1)) = i4.f1;

-- this case is optimizable
select p.* from parent p left join child c on (udf(p.k) = udf(c.k));

-- explain (costs off)
-- select p.* from
--   parent p left join child c on (p.k = c.k)
--   where p.k = 1 and p.k = 2;

select p.* from
  (parent p left join child c on (udf(p.k) = c.k)) join parent x on p.k = udf(x.k)
  where udf(p.k) = udf(1) and udf(udf(p.k)) = udf(udf(2));

SELECT * FROM
    (SELECT udf(1) AS x) ss1
  LEFT JOIN
    (SELECT udf(q1), udf(q2), udf(COALESCE(dat1, q1)) AS y
     FROM int8_tbl LEFT JOIN innertab ON udf(udf(q2)) = id) ss2
  ON true;

-- error
select * from
  int8_tbl x join (int4_tbl x cross join int4_tbl y(ff)) j on udf(q1) = udf(udf(f1));

-- error, prefer "t2" suggestion
select udf(uunique1) from
  tenk1 t1 join tenk2 t2 on udf(t1.two) = udf(t2.two);

-- case requiring nested PlaceHolderVars
-- explain (verbose, costs off)
-- select * from
--   int8_tbl c left join (
--     int8_tbl a left join (select q1, coalesce(q2,42) as x from int8_tbl b) ss1
--       on a.q2 = ss1.q1
--     cross join
--     lateral (select q1, coalesce(ss1.x,q2) as y from int8_tbl d) ss2
--   ) on c.q2 = ss2.q1,
--   lateral (select ss2.y offset 0) ss3;

-- case that breaks the old ph_may_need optimization
-- explain (verbose, costs off)
-- select c.*,a.*,ss1.q1,ss2.q1,ss3.* from
--   int8_tbl c left join (
--     int8_tbl a left join
--       (select q1, coalesce(q2,f1) as x from int8_tbl b, int4_tbl b2
--        where q1 < f1) ss1
--       on a.q2 = ss1.q1
--     cross join
--     lateral (select q1, coalesce(ss1.x,q2) as y from int8_tbl d) ss2
--   ) on c.q2 = ss2.q1,
--   lateral (select * from int4_tbl i where ss2.y > f1) ss3;

-- check processing of postponed quals (bug #9041)
-- explain (verbose, costs off)
-- select * from
--   (select 1 as x offset 0) x cross join (select 2 as y offset 0) y
--   left join lateral (
--     select * from (select 3 as z offset 0) z where z.z = x.x
--   ) zz on zz.z = y.y;

-- check dummy rels with lateral references (bug #15694)
-- explain (verbose, costs off)
-- select * from int8_tbl i8 left join lateral
--   (select *, i8.q2 from int4_tbl where false) ss on true;
-- explain (verbose, costs off)
-- select * from int8_tbl i8 left join lateral
--   (select *, i8.q2 from int4_tbl i1, int4_tbl i2 where false) ss on true;

-- check handling of nested appendrels inside LATERAL
-- select * from
--   ((select 2 as v) union all (select 3 as v)) as q1
--   cross join lateral
--   ((select * from
--       ((select 4 as v) union all (select 5 as v)) as q3)
--    union all
--    (select q1.v)
--   ) as q2;

-- check we don't try to do a unique-ified semijoin with LATERAL
-- explain (verbose, costs off)
-- select * from
--   (values (0,9998), (1,1000)) v(id,x),
--   lateral (select f1 from int4_tbl
--            where f1 = any (select unique1 from tenk1
--                            where unique2 = v.x offset 0)) ss;
-- select * from
--   (values (0,9998), (1,1000)) v(id,x),
--   lateral (select f1 from int4_tbl
--            where f1 = any (select unique1 from tenk1
--                            where unique2 = v.x offset 0)) ss;

-- check proper extParam/allParam handling (this isn't exactly a LATERAL issue,
-- but we can make the test case much more compact with LATERAL)
-- explain (verbose, costs off)
-- select * from (values (0), (1)) v(id),
-- lateral (select * from int8_tbl t1,
--          lateral (select * from
--                     (select * from int8_tbl t2
--                      where q1 = any (select q2 from int8_tbl t3
--                                      where q2 = (select greatest(t1.q1,t2.q2))
--                                        and (select v.id=0)) offset 0) ss2) ss
--          where t1.q1 = ss.q2) ss0;

-- select * from (values (0), (1)) v(id),
-- lateral (select * from int8_tbl t1,
--          lateral (select * from
--                     (select * from int8_tbl t2
--                      where q1 = any (select q2 from int8_tbl t3
--                                      where q2 = (select greatest(t1.q1,t2.q2))
--                                        and (select v.id=0)) offset 0) ss2) ss
--          where t1.q1 = ss.q2) ss0;

-- test some error cases where LATERAL should have been used but wasn't
select udf(udf(f1,g)) from int4_tbl a, (select udf(udf(f1)) as g) ss;

select udf(f1,g) from int4_tbl a cross join (select udf(udf(a.f1)) as g) ss;

SELECT udf(b), udf(c) FROM test_having
	GROUP BY b, c HAVING udf(count(*)) = 1 ORDER BY udf(b), udf(c);

-- test degenerate cases involving HAVING without GROUP BY
-- Per SQL spec, these should generate 0 or 1 row, even without aggregates

SELECT udf(udf(min(udf(a)))), udf(udf(max(udf(a)))) FROM test_having HAVING udf(udf(min(udf(a)))) = udf(udf(max(udf(a))));

SELECT 1 AS one FROM test_having HAVING udf(a) > 1;

-- [SPARK-33008] Spark SQL throws an exception
-- and just to prove that we aren't scanning the table:
SELECT 1 AS one FROM test_having WHERE 1/udf(a) = 1 HAVING 1 < 2;

--   w/o existing GROUP BY target using a relation name in GROUP BY clause
SELECT udf(count(*)) FROM test_missing_target GROUP BY udf(test_missing_target.c)
ORDER BY udf(c);

--   w/ existing GROUP BY target using a relation name in target
SELECT udf(test_missing_target.b), udf(count(*))
  FROM test_missing_target GROUP BY udf(b) ORDER BY udf(b);

--   group using reference number
SELECT udf(count(*)) FROM test_missing_target ORDER BY udf(1) desc;

--   group w/o existing GROUP BY and ORDER BY target under ambiguous condition
--   failure expected
SELECT udf(count(*)) FROM test_missing_target x, test_missing_target y
	WHERE udf(x.a) = udf(y.a)
	GROUP BY udf(b) ORDER BY udf(b);

--   group expression w/ target under ambiguous condition
--   failure NOT expected
SELECT udf(a/2), udf(a/2) FROM test_missing_target
	GROUP BY udf(a/2) ORDER BY udf(a/2);

-- [SPARK-28329] SELECT INTO syntax
--   group w/o existing GROUP BY target under ambiguous condition
--   into a table
-- SELECT count(*) INTO TABLE test_missing_target2
-- FROM test_missing_target x, test_missing_target y
-- 	WHERE x.a = y.a
-- 	GROUP BY x.b ORDER BY x.b;
-- SELECT * FROM test_missing_target2;


--  Functions and expressions

--   w/ existing GROUP BY target
SELECT udf(a%2), udf(count(udf(b))) FROM test_missing_target
GROUP BY udf(test_missing_target.a%2)
ORDER BY udf(test_missing_target.a%2);

--   w/o existing GROUP BY target and w/o existing same ORDER BY target
SELECT udf(count(b)) FROM test_missing_target GROUP BY udf(b/2) ORDER BY udf(b/2);

--   w/o existing ORDER BY target
SELECT udf(count(b)) FROM test_missing_target
	GROUP BY udf((b + 1) / 2) ORDER BY udf((b + 1) / 2) desc;

--   group w/o existing GROUP BY target under ambiguous condition
--   failure expected due to ambiguous b in count(b)
SELECT udf(count(udf(b))) FROM test_missing_target x, test_missing_target y
	WHERE udf(x.a) = udf(y.a)
	GROUP BY udf(x.b/2);

-- distinct count with single expression
SELECT
  udf(count(DISTINCT 1)),
  udf(count(DISTINCT null)),
  udf(count(DISTINCT a)),
  udf(count(DISTINCT b)),
  udf(count(DISTINCT (a + b))),
  udf(count(DISTINCT (a, b)))
FROM testData;

-- Cross join detection and error checking is done in JoinSuite since explain output is
-- used in the error message and the ids are not stable. Only positive cases are checked here.
-- This test file was converted from cross-join.sql.

create temporary view nt1 as select * from values
  ("one", 1),
  ("two", 2),
  ("three", 3)
  as nt1(k, v1);

SELECT * FROM nt1 cross join nt2 where udf(nt1.v1) = "1" and udf(nt2.v2) = "22";

-- Cross joins with non-equal predicates
SELECT * FROM nt1 CROSS JOIN nt2 ON (udf(nt1.k) > udf(nt2.k));

-- MINUS ALL (synonym for EXCEPT)
SELECT udf(c1) FROM tab1
MINUS ALL
SELECT udf(c1) FROM tab2;

-- Empty right relation
SELECT udf(c1) FROM tab1
EXCEPT ALL
SELECT udf(c1) FROM tab2 WHERE udf(c1 > udf(6));

-- Basic
SELECT udf(k), v FROM tab3
EXCEPT ALL
SELECT k, udf(v) FROM tab4;

-- EXCEPT ALL + EXCEPT
SELECT udf(k), v FROM tab4
EXCEPT ALL
SELECT k, udf(v) FROM tab3
EXCEPT DISTINCT
SELECT udf(k), udf(v) FROM tab4;

-- Using MINUS ALL
SELECT udf(k), udf(v) FROM tab3
MINUS ALL
SELECT k, udf(v) FROM tab4
UNION
SELECT udf(k), udf(v) FROM tab3
MINUS DISTINCT
SELECT k, udf(v) FROM tab4;

-- Join under except all (2)
SELECT * 
FROM   (SELECT udf(udf(tab3.k)),
               udf(tab4.v)
        FROM   tab3 
               JOIN tab4 
                 ON udf(udf(tab3.k)) = udf(tab4.k))
EXCEPT ALL 
SELECT * 
FROM   (SELECT udf(tab4.v) AS k,
               udf(udf(tab3.k)) AS v
        FROM   tab3 
               JOIN tab4 
                 ON udf(tab3.k) = udf(tab4.k));

-- Except operation that will be replaced by left anti join
SELECT udf(k), udf(v) FROM t1 EXCEPT SELECT udf(k), udf(v) FROM t2;

-- Except operation that will be replaced by Filter: SPARK-22181
SELECT t1.* FROM t1, t2 where t1.k = t2.k
EXCEPT
SELECT t1.* FROM t1, t2 where t1.k = t2.k and t1.k != udf('one');

-- Except operation that will be replaced by left anti join
SELECT t1.k
FROM   t1
WHERE  t1.v <= (SELECT   udf(max(udf(t2.v)))
                FROM     t2
                WHERE    udf(t2.k) = udf(t1.k))
MINUS
SELECT t1.k
FROM   t1
WHERE  udf(t1.v) >= (SELECT   min(udf(t2.v))
                FROM     t2
                WHERE    t2.k = t1.k);

SELECT udf(a), udf(b), SUM(b) FROM testData GROUP BY udf(a), b WITH CUBE;

-- ROLLUP
SELECT course, year, SUM(earnings) FROM courseSales GROUP BY ROLLUP(course, year) ORDER BY udf(course), year;

SELECT course, year, udf(SUM(earnings)) FROM courseSales GROUP BY course, year GROUPING SETS(course);

SELECT course, SUM(earnings) AS sum, GROUPING_ID(course, earnings) FROM courseSales
GROUP BY course, earnings GROUPING SETS((), (course), (course, earnings)) ORDER BY udf(course), sum;

SELECT course, udf(year), GROUPING_ID(course, year) FROM courseSales GROUP BY udf(course), year;

SELECT course, udf(year) FROM courseSales GROUP BY udf(course), year HAVING GROUPING(course) > 0;

-- GROUPING/GROUPING_ID in orderBy clause
SELECT course, year, GROUPING(course), GROUPING(year) FROM courseSales GROUP BY CUBE(course, year)
ORDER BY GROUPING(course), GROUPING(year), course, udf(year);

SELECT course, udf(year) FROM courseSales GROUP BY course, udf(year) ORDER BY GROUPING_ID(course);

SELECT udf(udf(a + b)) AS k, b, SUM(a - b) FROM testData GROUP BY ROLLUP(k, b);

-- Aggregate with empty GroupBy expressions.
SELECT udf(a), udf(COUNT(b)) FROM testData;

SELECT udf(a), udf(COUNT(udf(b))) FROM testData GROUP BY b;

-- Aggregate grouped by literals (whole stage code generation).
SELECT 'foo' FROM testData WHERE a = 0 GROUP BY udf(1);

-- Aggregate with complex GroupBy expressions.
SELECT udf(a + b), udf(COUNT(b)) FROM testData GROUP BY a + b;

-- Aggregate with nulls.
SELECT SKEWNESS(udf(a)), udf(KURTOSIS(a)), udf(MIN(a)), MAX(udf(a)), udf(AVG(udf(a))), udf(VARIANCE(a)), STDDEV(udf(a)), udf(SUM(a)), udf(COUNT(a))
FROM testData;

SELECT a AS k, udf(COUNT(b)) FROM testData GROUP BY k HAVING k > 1;

-- Check analysis exceptions
SELECT a AS k, udf(COUNT(udf(b))) FROM testData GROUP BY k;

SELECT 1 FROM (SELECT udf(COUNT(1)) FROM testData WHERE false) t;

-- SPARK-25708 HAVING without GROUP BY means global aggregate
SELECT udf(1) FROM range(10) HAVING true;

-- empty table
SELECT udf(every(v)), udf(some(v)), any(v) FROM test_agg WHERE 1 = 0;

-- group by
SELECT udf(k), every(v), udf(some(v)), any(v) FROM test_agg GROUP BY udf(k);

-- basic subquery path to make sure rewrite happens in both parent and child plans.
SELECT udf(k),
       udf(Every(v)) AS every
FROM   test_agg
WHERE  k = 2
       AND v IN (SELECT Any(v)
                 FROM   test_agg
                 WHERE  k = 1)
GROUP  BY udf(k);

-- input type checking Short
SELECT some(udf(1S));

-- every/some/any aggregates are supported as windows expression.
SELECT k, v, every(v) OVER (PARTITION BY k ORDER BY v) FROM test_agg;

-- Having referencing aggregate expressions is ok.
SELECT udf(count(*)) FROM test_agg HAVING count(*) > 1L;

-- Error when aggregate expressions are in where clause directly
SELECT udf(count(*)) FROM test_agg WHERE count(*) > 1L;

-- This test file was converted from having.sql.

create temporary view hav as select * from values
  ("one", 1),
  ("two", 2),
  ("three", 3),
  ("one", 5)
  as hav(k, v);

-- SPARK-11032: resolve having correctly
SELECT udf(MIN(t.v)) FROM (SELECT * FROM hav WHERE v > 0) t HAVING(udf(COUNT(udf(1))) > 0);

-- single row, without column alias
select udf(col1), udf(udf(col2)) from values ("one", 1) as data;

-- three rows
select udf(a), b from values ("one", 1), ("two", 2), ("three", null) as data(a, b);

-- foldable expressions
select udf(udf(a)), udf(b) from values ("one", 1 + 0), ("two", 1 + 3L) as data(a, b);

-- nondeterministic function rand
select udf(a), b from values ("one", rand(5)), ("two", 3.0D) as data(a, b);

-- error reporting: number aliases different from number data values
select udf(a), udf(b) from values ("one"), ("two") as data(a, b);

-- string to timestamp
select udf(a), b from values (timestamp('1991-12-06 00:00:00.0'), array(timestamp('1991-12-06 01:00:00.0'), timestamp('1991-12-06 12:00:00.0'))) as data(a, b);

CREATE TEMPORARY VIEW tb AS
SELECT udf(a) AS a, udf('a') AS tag FROM t3
UNION ALL
SELECT udf(a) AS a, udf('b') AS tag FROM t4;

-- Basic INTERSECT ALL
SELECT udf(k), v FROM tab1
INTERSECT ALL
SELECT k, udf(v) FROM tab2;

-- Empty right relation
SELECT udf(k), v FROM tab1
INTERSECT ALL
SELECT udf(k), v FROM tab2 WHERE udf(udf(k)) > 3;

-- Mismatch on number of columns across both branches
SELECT udf(k) FROM tab1
INTERSECT ALL
SELECT udf(k), udf(v) FROM tab2;

-- Chain of different `set operations
SELECT udf(k), udf(v) FROM tab1
EXCEPT
SELECT udf(k), v FROM tab2
EXCEPT
SELECT k, udf(v) FROM tab1
INTERSECT ALL
SELECT udf(k), udf(udf(v)) FROM tab2;

-- Join under intersect all (2)
SELECT * 
FROM   (SELECT udf(tab1.k),
               udf(tab2.v)
        FROM   tab1 
               JOIN tab2 
                 ON udf(tab1.k) = udf(tab2.k))
INTERSECT ALL 
SELECT * 
FROM   (SELECT udf(tab2.v) AS k,
               udf(tab1.k) AS v
        FROM   tab1 
               JOIN tab2 
                 ON tab1.k = udf(tab2.k));

SELECT k, udf(v) FROM tab1
EXCEPT
SELECT udf(k), v FROM tab2
UNION ALL
SELECT udf(k), udf(v) FROM tab1
INTERSECT
SELECT udf(k), udf(udf(v)) FROM tab2;

SELECT udf(t1.a), udf(udf(empty_table.a)) FROM t1 CROSS JOIN empty_table ON (udf(udf(t1.a)) = udf(empty_table.a));

SELECT udf(t1.a), empty_table.a FROM t1 FULL OUTER JOIN empty_table ON (udf(t1.a) = udf(empty_table.a));

SELECT udf(empty_table.a), udf(t1.a) FROM empty_table INNER JOIN t1 ON (udf(udf(empty_table.a)) = udf(t1.a));

SELECT empty_table.a, udf(t1.a) FROM empty_table RIGHT OUTER JOIN t1 ON (udf(empty_table.a) = udf(t1.a));

SELECT empty_table.a FROM empty_table LEFT ANTI JOIN t1 ON (udf(empty_table.a) = udf(t1.a));

SELECT udf(empty_table.a) FROM empty_table LEFT OUTER JOIN empty_table AS empty_table2 ON (udf(empty_table.a) = udf(empty_table2.a));

SELECT udf(udf(empty_table.a)) FROM empty_table LEFT SEMI JOIN empty_table AS empty_table2 ON (udf(empty_table.a) = udf(empty_table2.a));

SELECT * FROM nt1 natural join nt2 where udf(k) = "one";

SELECT udf(count(*)) FROM nt1 natural full outer join nt2;

-- Set the cross join enabled flag for the LEFT JOIN test since there's no join condition.
-- Ultimately the join should be optimized away.
set spark.sql.crossJoin.enabled = true;

-- pivot courses
SELECT * FROM (
  SELECT udf(year), course, earnings FROM courseSales
)
PIVOT (
  udf(sum(earnings))
  FOR course IN ('dotNET', 'Java')
);

-- pivot with no group by column
SELECT * FROM (
  SELECT udf(course) as course, earnings FROM courseSales
)
PIVOT (
  udf(sum(earnings))
  FOR course IN ('dotNET', 'Java')
);

-- pivot on join query with multiple aggregations on different columns
SELECT * FROM (
  SELECT course, year, earnings, s
  FROM courseSales
  JOIN years ON year = y
)
PIVOT (
  udf(sum(earnings)), udf(min(s))
  FOR course IN ('dotNET', 'Java')
);

-- pivot with projection and value aliases
SELECT firstYear_s, secondYear_s, firstYear_a, secondYear_a, c FROM (
  SELECT year y, course c, earnings e FROM courseSales
)
PIVOT (
  udf(sum(e)) s, udf(avg(e)) a
  FOR y IN (2012 as firstYear, 2013 secondYear)
);

-- pivot with unresolvable columns
SELECT * FROM (
  SELECT course, earnings FROM courseSales
)
PIVOT (
  udf(sum(earnings))
  FOR year IN (2012, 2013)
);

-- pivot on multiple pivot columns
SELECT * FROM (
  SELECT course, year, earnings, s
  FROM courseSales
  JOIN years ON year = y
)
PIVOT (
  udf(sum(earnings))
  FOR (course, year) IN (('dotNET', 2012), ('Java', 2013))
);

-- pivot with unresolvable values
SELECT * FROM courseSales
PIVOT (
  udf(sum(earnings))
  FOR year IN (s, 2013)
);

-- pivot on multiple pivot columns containing array type
SELECT * FROM (
  SELECT course, earnings, udf(year) as year, a
  FROM courseSales
  JOIN yearsWithComplexTypes ON year = y
)
PIVOT (
  udf(sum(earnings))
  FOR (course, a) IN (('dotNET', array(1, 1)), ('Java', array(2, 2)))
);

-- pivot on pivot column of map type
SELECT * FROM (
  SELECT earnings, year, m
  FROM courseSales
  JOIN yearsWithComplexTypes ON year = y
)
PIVOT (
  udf(sum(earnings))
  FOR m IN (map('1', 1), map('2', 2))
);

-- This file tests special values such as NaN, Infinity and NULL.

SELECT udf(x) FROM (VALUES (1), (2), (NULL)) v(x);

SELECT udf(x) FROM (VALUES ('Infinity'), ('1'), ('2')) v(x);

-- This test file was converted from udaf.sql.

CREATE OR REPLACE TEMPORARY VIEW t1 AS SELECT * FROM VALUES
(1), (2), (3), (4)
as t1(int_col1);

SELECT default.udaf1(udf(int_col1)) as udaf1, udf(default.udaf1(udf(int_col1))) as udaf2, udf(default.udaf1(int_col1)) as udaf3 from t1;

-- Simple Union
SELECT udf(c1) as c1, udf(c2) as c2
FROM   (SELECT udf(c1) as c1, udf(c2) as c2 FROM t1
        UNION ALL
        SELECT udf(c1) as c1, udf(c2) as c2 FROM t1);

-- Regression test for SPARK-18841 Push project through union should not be broken by redundant alias removal.
CREATE OR REPLACE TEMPORARY VIEW p1 AS VALUES 1 T(col);

SELECT udf(1) AS x,
       udf(col) as col
FROM   (SELECT udf(col) AS col
        FROM (SELECT udf(p1.col) AS col
              FROM   p1 CROSS JOIN p2
              UNION ALL
              SELECT udf(col)
              FROM p3) T1) T2;

DROP VIEW IF EXISTS p1;

--This test file was converted from window.sql.
-- Test data.
CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
(null, 1L, 1.0D, date("2017-08-01"), timestamp_seconds(1501545600), "a"),
(1, 1L, 1.0D, date("2017-08-01"), timestamp_seconds(1501545600), "a"),
(1, 2L, 2.5D, date("2017-08-02"), timestamp_seconds(1502000000), "a"),
(2, 2147483650L, 100.001D, date("2020-12-31"), timestamp_seconds(1609372800), "a"),
(1, null, 1.0D, date("2017-08-01"), timestamp_seconds(1501545600), "b"),
(2, 3L, 3.3D, date("2017-08-03"), timestamp_seconds(1503000000), "b"),
(3, 2147483650L, 100.001D, date("2020-12-31"), timestamp_seconds(1609372800), "b"),
(null, null, null, null, null, null),
(3, 1L, 1.0D, date("2017-08-01"), timestamp_seconds(1501545600), null)
AS testData(val, val_long, val_double, val_date, val_timestamp, cate);

SELECT val_long, udf(cate), sum(val_long) OVER(PARTITION BY cate ORDER BY udf(val_long)
ROWS BETWEEN CURRENT ROW AND 2147483648 FOLLOWING) FROM testData ORDER BY udf(cate), val_long;

SELECT val_long, udf(cate), sum(val_long) OVER(PARTITION BY udf(cate) ORDER BY val_long
RANGE BETWEEN CURRENT ROW AND 2147483648 FOLLOWING) FROM testData ORDER BY udf(cate), val_long;

SELECT val_timestamp, udf(cate), avg(val_timestamp) OVER(PARTITION BY udf(cate) ORDER BY val_timestamp
RANGE BETWEEN CURRENT ROW AND interval 23 days 4 hours FOLLOWING) FROM testData
ORDER BY udf(cate), val_timestamp;

SELECT udf(val), cate, count(val) OVER(PARTITION BY udf(cate)
RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM testData ORDER BY cate, udf(val);

SELECT udf(val), cate, count(val) OVER(PARTITION BY udf(cate) ORDER BY val
RANGE BETWEEN 1 FOLLOWING AND 1 PRECEDING) FROM testData ORDER BY udf(cate), val;

-- Null inputs
SELECT udf(val), cate, avg(null) OVER(PARTITION BY cate ORDER BY val) FROM testData ORDER BY cate, val;

-- first_value()/last_value()/any_value() over ()
SELECT udf(val), cate,
first_value(false) OVER w AS first_value,
first_value(true, true) OVER w AS first_value_ignore_null,
first_value(false, false) OVER w AS first_value_contain_null,
any_value(false) OVER w AS any_value,
any_value(true, true) OVER w AS any_value_ignore_null,
any_value(false, false) OVER w AS any_value_contain_null,
last_value(false) OVER w AS last_value,
last_value(true, true) OVER w AS last_value_ignore_null,
last_value(false, false) OVER w AS last_value_contain_null
FROM testData
WINDOW w AS ()
ORDER BY cate, val;

CREATE OR REPLACE TEMPORARY VIEW t2 AS VALUES (0, 1), (1, 2), (1, 3) t(partition_col, input);

SELECT * FROM udtf(0, -1);

-- test lateral join
SELECT * FROM t1, LATERAL udtf(c1, c2);

-- test non-deterministic input
SELECT * FROM udtf(cast(rand(0) AS int) + 1, 1);

SELECT * FROM UDTFCountSumLast(TABLE(t2) PARTITION BY partition_col ORDER BY input DESC);

SELECT * FROM UDTFWithSinglePartition(1, TABLE(t2));

SELECT * FROM
    VALUES (0), (1) AS t(col)
    JOIN LATERAL
    UDTFWithSinglePartition(0, TABLE(t2) PARTITION BY partition_col);

SELECT * FROM UDTFPartitionByOrderBy(TABLE(t2) PARTITION BY partition_col);

SELECT * FROM UDTFPartitionByOrderBySelectExpr(TABLE(t2));

SELECT * FROM UDTFInvalidSelectExprParseError(TABLE(t2));

SELECT * FROM UDTFInvalidOrderByAscKeyword(TABLE(t2));

SELECT * FROM UDTFInvalidPartitionByAndWithSinglePartition(TABLE(t2) WITH SINGLE PARTITION);

-- As a reminder, UDTFInvalidOrderByWithoutPartitionBy function returns this analyze result:
--     AnalyzeResult(
--         schema=StructType()
--             .add("last", IntegerType()),
--         order_by=[
--             OrderingColumn("input")
--         ])
SELECT * FROM UDTFInvalidOrderByWithoutPartitionBy(TABLE(t2));

SELECT * FROM
    VALUES (0), (1) AS t(col)
    JOIN LATERAL
    UDTFInvalidOrderByWithoutPartitionBy(TABLE(t2) PARTITION BY partition_col);

SELECT * FROM InvalidEvalReturnsNoneToNonNullableColumnArrayElementType(TABLE(t2));

SELECT * FROM InvalidTerminateReturnsNoneToNonNullableColumnScalarType(TABLE(t2));

SELECT * FROM InvalidTerminateReturnsNoneToNonNullableColumnStructType(TABLE(t2));

SELECT * FROM UDTFForwardStateFromAnalyzeWithKwargs(1, 2);

SELECT * FROM InvalidAnalyzeMethodWithSinglePartitionNoInputTable(argument => 1);

SELECT * FROM InvalidAnalyzeMethodWithPartitionByListOfStrings(argument => TABLE(t2));

SELECT * FROM UDTFWithSinglePartition(1);

SELECT * FROM UDTFWithSinglePartition(1, initial_count => 2);

-- Exercise the UDTF partitioning bug.
SELECT * FROM UDTFPartitionByIndexingBug(
    TABLE(
        SELECT
            5 AS unused_col,
            'hi' AS partition_col,
            1.0 AS double_col

        UNION ALL

        SELECT
            4 AS unused_col,
            'hi' AS partition_col,
            1.0 AS double_col
    )
);

CREATE TABLE t1 (col1 STRING, col2 STRING, col3 STRING);

SELECT *
FROM (
         SELECT col1, col2 FROM t1
         UNION
         SELECT col3, col2 FROM t1
         UNION
         SELECT col2, col2 FROM v1
     );

SELECT *
FROM (
         SELECT col1, col2 FROM v1
         UNION
         SELECT col3, col2 FROM v1
         UNION
         SELECT col2, col2 FROM t1
     );

-- Duplicates in UNION under CTE
WITH cte AS (
    SELECT col1, col1 FROM t1
    UNION
    SELECT col1, col1 FROM t1
)
SELECT col1 FROM cte;

-- SetOperationLike output deduplication across different branches should be done only in context of UNION
SELECT col1, TRIM(col2), col1 FROM t2 UNION SELECT col1, col2, col1 FROM t2;

SELECT col1, RTRIM(col2), col1 FROM t2 EXCEPT SELECT col1, col2, col1 FROM t2;

CREATE TABLE jsonTable (col1 INT, col2 INT, col3 INT, col4 INT) USING json;

-- Regression test for SPARK-18622
SELECT a
FROM (SELECT 0 a, 0 b
      UNION ALL
      SELECT SUM(1) a, CAST(0 AS BIGINT) b
      UNION ALL SELECT 0 a, 0 b) T;

-- SPARK-24012 Union of array and other compatible columns.
SELECT array(1, 2), 'str'
UNION ALL
SELECT array(1, 2, 3, NULL), 1;

-- SPARK-52462: UNION should produce consistent results with different underlying table providers.
SELECT col1, col2, col3, NULLIF('','') AS col4
FROM jsonTable
UNION ALL
SELECT col2, col2, null AS col3, col4
FROM jsonTable;

-- Single array: one row per element, default column name `col`.
SELECT * FROM UNNEST(array(10, 20, 30));

-- NULL array is treated as empty and produces no rows.
SELECT * FROM UNNEST(cast(null as array<int>));

-- Multiple arrays are expanded in parallel and padded with NULLs to the longest length.
SELECT * FROM UNNEST(array(1, 2), array(10, 20, 30)) AS t(a, b);

-- Correlated UNNEST over a table column, via LATERAL.
SELECT id, elem FROM nested, LATERAL UNNEST(xs) AS t(elem) ORDER BY id, elem;

-- Nested arrays: the element type is preserved as-is (a single array-typed column).
SELECT * FROM UNNEST(array(array(1, 2), array(3))) AS t(inner);

-- Non-array argument is rejected.
SELECT * FROM UNNEST(42);

-- UNNEST is a non-reserved keyword: a table-valued function named `unnest` can still be invoked
-- by quoting the name, which bypasses the dedicated UNNEST relation syntax. Here it resolves as a
-- generic (unregistered) TVF and fails at analysis, proving the name is not swallowed by the
-- grammar.
SELECT * FROM `unnest`(array(1, 2));

-- alias for column names
SELECT * FROM courseEarnings
UNPIVOT (
  earningsYear FOR year IN (`2012` as `twenty-twelve`, `2013` as `twenty-thirteen`, `2014` as `twenty-fourteen`)
);

-- NULL values excluded by default, include them explicitly
SELECT * FROM courseEarningsAndSales
UNPIVOT INCLUDE NULLS (
  (earnings, sales) FOR year IN ((earnings2012, sales2012), (earnings2013, sales2013), (earnings2014, sales2014))
);

-- EXCLUDE NULLS keeps partially-null tuples and removes all-null tuples across different types
SELECT * FROM mixedTypeValues
UNPIVOT EXCLUDE NULLS (
  (date_value, int_value) FOR kind IN (
    (date1, int1) as date_only,
    (date2, int2) as int_only,
    (date3, int3) as all_null
  )
)
ORDER BY kind;

-- struct values: the value column merges the field nullability of all values
SELECT store, half, b.lo, b.hi, b.hi IS NULL AS hi_is_null
FROM (
  SELECT store, named_struct('lo', jan, 'hi', feb) AS h1, named_struct('lo', mar, 'hi', apr) AS h2
  FROM monthlySales
)
UNPIVOT (b FOR half IN (h1, h2))
ORDER BY store, half;

-- map values: the value column merges the value nullability of all values
SELECT store, half, m['k'] AS v, m['k'] IS NULL AS v_is_null
FROM (SELECT store, map('k', jan) AS m1, map('k', mar) AS m2 FROM monthlySales)
UNPIVOT (m FOR half IN (m1, m2))
ORDER BY store, half;

select parse_url('http://userinfo@spark.apache.org/path?query=1#Ref', 'PATH');

select parse_url('http://userinfo@spark.apache.org/path?query=1#Ref', 'PROTOCOL');

select parse_url('http://userinfo@spark.apache.org/path?query=1#Ref', 'USERINFO');

select url_encode(null);

select url_decode('inva lid://user:pass@host/file\\;param?query\\;p2');

select try_url_decode('http%3A%2F%2spark.apache.org');

create temporary view nt2 as select * from values
  ("one", 1),
  ("two", 22),
  ("one", 5),
  ("four", 4)
  as nt2(k, v2);

SELECT nt1.*, nt2.* FROM nt1 left outer join nt2 using (k);

SELECT nt2.k AS key FROM nt1 left outer join nt2 using (k) ORDER BY key;

SELECT k, nt2.k FROM nt1 left outer join nt2 using (k);

SELECT nt1.* FROM nt1 left semi join nt2 using (k);

SELECT * FROM nt1 right outer join nt2 using (k);

SELECT nt1.k, nt2.k FROM nt1 right outer join nt2 using (k);

SELECT k, nt1.k FROM nt1 right outer join nt2 using (k);

SELECT k FROM nt1 full outer join nt2 using (k);

SELECT k FROM (SELECT nt2.k FROM nt1 full outer join nt2 using (k));

SELECT k, nt2.k FROM nt1 full outer join nt2 using (k);

SELECT nt1.k, nt2.k FROM nt1 inner join nt2 using (k);

SELECT k, nt1.k FROM nt1 inner join nt2 using (k);

-- ResolvesNameByHiddenOutput.retainOriginalOutput shouldn't change NameScope output
SELECT *
FROM
    ( SELECT col1 FROM VALUES(false) ) LEFT JOIN ( SELECT col1 FROM VALUES(false) ) b USING(col1)
WHERE b.col1;

-- A top-level join without a SELECT, with the hidden nt2.k in the join condition
FROM nt1 JOIN nt2 USING (k) JOIN nt2 x ON nt2.k = x.k;

FROM nt2 x LEFT ANTI JOIN (nt1 JOIN nt2 USING (k)) ON x.k = nt2.k;

-- Create temp view with Variant columns for testing field extraction and type casting.
CREATE TEMP VIEW variant_test_data AS
SELECT
  parse_json('{ "price": 30 }') as int_price_variant,
  parse_json('{ "price": 12345.678 }') as double_price_variant,
  parse_json('{ "name": "John", "age": 30, "city": "New York", "active": true, "scores": [85, 92, 78] }') as multi_field_variant,
  parse_json('{ "item": [ { "model" : "basic", "price" : 6.12 }, { "model" : "medium", "price" : 9.24 } ] }') as array_value_variant,
  parse_json('[{ "id": 1, "name": "Alice" }, { "id": 2, "name": "Bob" }, { "id": 3, "name": "Charlie" }]') as array_variant,
  parse_json('{ "metadata": { "version": "1.0", "tags": ["important", "urgent"], "nested": { "level": 2, "value": "deep" } } }') as nested_variant,
  parse_json('{ "field-name": "value1", "field.name": "value2", "field_name": "value3" }') as special_chars_variant;

select int_price_variant:price::string from variant_test_data;

select multi_field_variant:name::string, multi_field_variant:age::int, multi_field_variant:active::boolean from variant_test_data;

-- Array value access.
select array_value_variant:item[0].model from variant_test_data;

select array_value_variant:item[1].price from variant_test_data;

select array_variant:[1].id from variant_test_data;

select nested_variant:metadata.tags[0] from variant_test_data;

select nested_variant:metadata['version'] from variant_test_data;

select special_chars_variant:['field-name']::string from variant_test_data;

-- Not supported; will return NULL.
select special_chars_variant:`field.name`::string from variant_test_data;

select count(*) from (select explode(cast(multi_field_variant:scores as array<int>)) as score from variant_test_data);

-- Type checking: The result of the following would all be 'variant'.
select typeof(multi_field_variant:name) from variant_test_data;

select typeof(multi_field_variant:scores) from variant_test_data;

select coalesce(multi_field_variant:missing_field, 'default_value') from variant_test_data;

SELECT * FROM variant_explode(input => parse_json('{"a": [1, 2]}'), recursive => true);

SELECT * FROM variant_explode(parse_json('{"a": ["hello", "world"], "b": {"x": true, "y": 3.14}}')) AS t, LATERAL variant_explode(t.value);

-- Empty input produces an empty object.
select cast(variant_from_arrays(cast(array() as array<string>), cast(array() as array<int>)) as string);

-- A null array input produces null.
select cast(variant_from_arrays(cast(null as array<string>), array(1)) as string);

-- Mismatched array lengths are rejected.
select variant_from_arrays(array('a', 'b'), array(1));

-- variant_from_entries

-- Basic object construction from key/value struct entries.
select cast(variant_from_entries(array(named_struct('k', 'a', 'v', 1), named_struct('k', 'b', 'v', 2))) as string);

-- A null entry makes the whole result null.
select cast(variant_from_entries(array(named_struct('k', 'a', 'v', 1), cast(null as struct<k:string,v:int>))) as string);

-- Duplicate keys are rejected.
select variant_from_entries(array(named_struct('k', 'a', 'v', 1), named_struct('k', 'a', 'v', 2)));

-- A non-string key type is rejected.
select variant_from_entries(array(named_struct('k', 1, 'v', 'a')));

SELECT vector_sum(col) FROM VALUES (array(1.0D, 2.0D, 3.0D)), (array(4.0D, 5.0D, 6.0D)) AS tab(col);

SELECT vector_avg(col) FROM VALUES (array(1.0F, 2.0F, 3.0F)), (array(3.0F, 4.0F, 5.0F)) AS tab(col);

SELECT category, vector_avg(embedding) AS avg_vector
FROM VALUES
    ('A', array(2.0F, 4.0F, 6.0F)),
    ('A', array(4.0F, 8.0F, 12.0F)),
    ('B', array(1.0F, 2.0F, 3.0F)),
    ('B', array(3.0F, 6.0F, 9.0F))
AS tab(category, embedding)
GROUP BY category
ORDER BY category;

SELECT vector_avg(col) FROM VALUES
    (array(1.0F, 2.0F)),
    (CAST(NULL AS ARRAY<FLOAT>)),
    (array(3.0F, 4.0F)) AS tab(col);

-- Empty vectors
SELECT vector_sum(col) FROM VALUES
    (CAST(array() AS ARRAY<FLOAT>)),
    (CAST(array() AS ARRAY<FLOAT>)) AS tab(col);

SELECT key, vector_sum(vec) OVER (PARTITION BY grp) as sum_vec
FROM VALUES
    ('a', 'g1', array(1.0D, 2.0D)),
    ('b', 'g1', array(3.0D, 4.0D)),
    ('c', 'g2', array(5.0D, 6.0D))
AS tab(key, grp, vec)
ORDER BY key;

SELECT vector_sum(col) FROM VALUES
    (array(1.0D, 2.0D, 3.0D)),
    (array(1.0D, 2.0D)) AS tab(col);

SELECT vector_avg(col) FROM VALUES (array(1.0D, 2.0D)), (array(3.0D, 4.0D)) AS tab(col);

SELECT vector_avg(col) FROM VALUES (1.0F), (2.0F) AS tab(col);

-- vector_cosine_similarity: orthogonal vectors (similarity = 0.0)
SELECT vector_cosine_similarity(array(1.0F, 0.0F), array(0.0F, 1.0F));

-- vector_inner_product: orthogonal vectors (product = 0)
SELECT vector_inner_product(array(1.0F, 0.0F), array(0.0F, 1.0F));

-- vector_l2_distance: identical vectors (distance = 0)
SELECT vector_l2_distance(array(1.0F, 2.0F), array(1.0F, 2.0F));

-- Empty vectors: inner product returns 0.0
SELECT vector_inner_product(CAST(array() AS ARRAY<FLOAT>), CAST(array() AS ARRAY<FLOAT>));

-- NULL array input: cosine similarity returns NULL
SELECT vector_cosine_similarity(NULL, array(1.0F, 2.0F, 3.0F));

SELECT vector_inner_product(array(1.0F, 2.0F, 3.0F), NULL);

-- Array containing NULL element: returns NULL
SELECT vector_cosine_similarity(array(1.0F, CAST(NULL AS FLOAT), 3.0F), array(1.0F, 2.0F, 3.0F));

-- Dimension mismatch errors

-- vector_cosine_similarity: dimension mismatch
SELECT vector_cosine_similarity(array(1.0F, 2.0F, 3.0F), array(1.0F, 2.0F));

-- Type mismatch errors (only ARRAY<FLOAT> is accepted)

-- vector_cosine_similarity: ARRAY<DOUBLE> not accepted
SELECT vector_cosine_similarity(array(1.0D, 2.0D, 3.0D), array(4.0D, 5.0D, 6.0D));

-- vector_inner_product: ARRAY<INT> not accepted
SELECT vector_inner_product(array(1, 2, 3), array(4, 5, 6));

-- Mixed type errors (first arg correct, second wrong)
SELECT vector_cosine_similarity(array(1.0F, 2.0F, 3.0F), array(1.0D, 2.0D, 3.0D));

-- vector_cosine_similarity: both arguments are not arrays
SELECT vector_cosine_similarity(123, 456);

-- vector_l2_distance: first argument is not an array
SELECT vector_l2_distance('not an array', array(1.0F, 2.0F, 3.0F));

SELECT vector_l2_distance(
    array(1.0F, 2.0F, 3.0F, 4.0F, 5.0F, 6.0F, 7.0F, 8.0F, 9.0F, 10.0F, 11.0F, 12.0F, 13.0F, 14.0F, 15.0F, 16.0F),
    array(16.0F, 15.0F, 14.0F, 13.0F, 12.0F, 11.0F, 10.0F, 9.0F, 8.0F, 7.0F, 6.0F, 5.0F, 4.0F, 3.0F, 2.0F, 1.0F)
);

-- vector_inner_product: individual products overflow the float range but cancel out
SELECT vector_inner_product(array(1.0e20F, 1.0e20F), array(1.0e20F, -1.0e20F));

-- vector_cosine_similarity of orthogonal tiny vectors is 0.0, not NULL
SELECT vector_cosine_similarity(array(1.0e-23F, 1.0e-23F), array(1.0e-23F, -1.0e-23F));

-- vector_l2_distance: the distance is infinite
SELECT vector_l2_distance(array(float('inf'), 1.0F), array(0.0F, 0.0F));

-- vector_norm: L1 norm - |3| + |4| = 7
SELECT vector_norm(array(3.0F, 4.0F), 1.0F);

-- vector_norm: infinity norm with negative values - max(|3|, |-5|) = 5
SELECT vector_norm(array(3.0F, -5.0F), float('inf'));

-- vector_normalize: L1 normalization - [3/7, 4/7]
SELECT vector_normalize(array(3.0F, 4.0F), 1.0F);

-- Edge cases

-- Empty vectors: norm returns 0.0
SELECT vector_norm(CAST(array() AS ARRAY<FLOAT>), 2.0F);

-- Empty vectors: normalize returns empty array
SELECT vector_normalize(CAST(array() AS ARRAY<FLOAT>), 2.0F);

-- NULL array input: norm returns NULL
SELECT vector_norm(NULL, 2.0F);

SELECT vector_normalize(array(3.0F, 4.0F), CAST(NULL AS FLOAT));

-- Invalid degree errors

-- vector_norm: invalid degree (0.0)
SELECT vector_norm(array(3.0F, 4.0F), 0.0F);

-- vector_norm: invalid degree (negative)
SELECT vector_norm(array(3.0F, 4.0F), -1.0F);

-- Type mismatch errors (only ARRAY<FLOAT> is accepted for vector)

-- vector_norm: ARRAY<DOUBLE> not accepted
SELECT vector_norm(array(3.0D, 4.0D), 2.0F);

-- vector_normalize: ARRAY<INT> not accepted
SELECT vector_normalize(array(3, 4), 2.0F);

-- vector_normalize: degree as DOUBLE not accepted
SELECT vector_normalize(array(3.0F, 4.0F), 2.0D);

-- vector_norm: first argument is a scalar
SELECT vector_norm(3.0F, 2.0F);

-- Large vectors (test SIMD unroll path with 16 elements)
SELECT vector_norm(
    array(1.0F, 2.0F, 3.0F, 4.0F, 5.0F, 6.0F, 7.0F, 8.0F, 9.0F, 10.0F, 11.0F, 12.0F, 13.0F, 14.0F, 15.0F, 16.0F),
    2.0F
);

SELECT vector_normalize(
    array(1.0F, 2.0F, 3.0F, 4.0F, 5.0F, 6.0F, 7.0F, 8.0F, 9.0F, 10.0F, 11.0F, 12.0F, 13.0F, 14.0F, 15.0F, 16.0F),
    2.0F
);

-- vector_normalize: [3e19, 4e19] normalizes to [0.6, 0.8]
SELECT vector_normalize(array(3.0e19F, 4.0e19F), 2.0F);

-- SPARK-58544: small magnitudes, the intermediate sum of squares must not underflow to zero

-- vector_norm: the L2 norm of a tiny vector is not zero
SELECT vector_norm(array(1.0e-23F, 0.0F), 2.0F);

-- SPARK-58544: elements that are already infinite still produce an infinite norm; the wider
-- accumulators do not change that

-- vector_norm: an infinite element makes the L2 norm infinite
SELECT vector_norm(array(float('inf'), 1.0F), 2.0F);

SELECT vector_norm(array(float('nan'), 5.0F), float('inf'));

-- vector_norm: the L1 and L2 norms propagate NaN in the same way
SELECT vector_norm(array(float('nan'), 5.0F), 1.0F);

-- vector_norm: a NULL element still takes precedence over a NaN element
SELECT vector_norm(array(float('nan'), CAST(NULL AS FLOAT)), float('inf'));

CREATE OR REPLACE TEMPORARY VIEW testData AS SELECT * FROM VALUES
('a', 1), ('a', 2), ('b', 1), ('b', 2), ('c', 1), ('c', 2), (null, 1), ('c', null), (null, null)
AS testData(ColumnA, ColumnB);

SELECT * FROM view_ansi;

SET spark.sql.caseSensitive = true;

DROP VIEW IF EXISTS view_case_sensitivity;

-- 1.a Attempts to use the SCHEMA BINDING clause fail with FEATURE_NOT_ENABLED
CREATE OR REPLACE VIEW v WITH SCHEMA BINDING AS SELECT 1;

CREATE OR REPLACE VIEW v WITH SCHEMA EVOLUTION AS SELECT 1;

SHOW TABLE EXTENDED LIKE 'v';

-- 1.c Views get invalidated if the types change in an unsafe matter
DROP TABLE IF EXISTS t;

-- Baseline: v(c1 INT);
DESCRIBE EXTENDED v;

-- The view should be invalidated, cannot upcast from BIGINT to INT
SELECT * FROM v;

SET spark.sql.legacy.viewSchemaCompensation = false;

-- Widen the column c1 in t
DROP TABLE t;

-- The view still describes as v(c1 BIGINT)
DESCRIBE EXTENDED v;

-- This now succeeds
SELECT * FROM v;

INSERT INTO t VALUES ('1', 2);

CREATE TABLE t(c1 MAP<STRING, STRING>, c2 INT) USING PARQUET;

CREATE TABLE t(c1 INT, c2 INT) USING PARQUET;

-- The view should be invalidated, it lost a column
SELECT * FROM v;

-- 3. Test the behavior of grandfathered views and temp views
SET spark.sql.legacy.viewSchemaBindingMode = false;

SET spark.sql.legacy.viewSchemaCompensation = true;

-- This test suite checks that the WITH SCHEMA BINDING clause is correctly implemented

-- New view with schema binding
-- 1.a BINDING is persisted
DROP TABLE IF EXISTS t;

-- Baseline: v(c1 INT, c2 INT);
DESCRIBE EXTENDED v;

-- The view still describes as v(c1 INT, c2 INT);
DESCRIBE EXTENDED v;

ALTER VIEW v WITH SCHEMA BINDING;

-- In COMPENSATION views get invalidated if the type can't cast
DROP TABLE IF EXISTS t;

-- Still can't drop a column, though
DROP TABLE IF EXISTS t;

INSERT INTO t VALUES(1);

-- This fails, because teh view uses SCHEMA BINDING
SELECT * FROM v;

-- Cleanup
DROP VIEW IF EXISTS v;

CREATE OR REPLACE VIEW v WITH SCHEMA EVOLUTION AS SELECT * FROM t;

INSERT INTO t VALUES ('1', 2.0);

CREATE TABLE t(c4 STRING, c5 DOUBLE, c6 DATE) USING PARQUET;

-- We can even drop columns
DROP TABLE IF EXISTS t;

CREATE OR REPLACE VIEW v(a1, a2) WITH SCHEMA EVOLUTION AS SELECT * FROM t;

-- The view now describes as v(a1 STRING, a2 DOUBLE)
DESCRIBE EXTENDED v;

-- The view still describes as v(a1 STRING, a2 DOUBLE)
DESCRIBE EXTENDED v;

-- Attempt to rename a column
DROP TABLE IF EXISTS t;

CREATE TABLE t(c1 INT COMMENT 'c1', c2 INT COMMENT 'c2') USING PARQUET;

CREATE TABLE t(c1 BIGINT COMMENT 'c1 6c', c2 STRING COMMENT 'c2 6c') USING PARQUET;

-- EVOLUTION, no column list
CREATE OR REPLACE VIEW v WITH SCHEMA EVOLUTION AS SELECT * FROM t;

CREATE TABLE t1(c1 INT) USING PARQUET;

CREATE TABLE t2(c1 INT) USING PARQUET;

ALTER VIEW v WITH SCHEMA EVOLUTION;

-- clean up
DROP VIEW IF EXISTS v;

-- The view now describes as v(c1 STRING, c2 DOUBLE)
DESCRIBE EXTENDED v;

-- Still can't drop a column
DROP TABLE IF EXISTS t;

CREATE TABLE t(c1 BIGINT COMMENT 'c1 6a', c2 STRING COMMENT 'c2 6a') USING PARQUET;

-- Test ALTER VIEW ... WITH SCHEMA TYPE EVOLUTION

DROP TABLE IF EXISTS t;

CREATE VIEW v DEFAULT COLLATION UNICODE AS SELECT 'a';

CREATE TABLE t (c1 STRING COLLATE UTF8_LCASE);

SELECT COUNT(*) FROM v;

SELECT DISTINCT COLLATION(c1) FROM v;

SELECT COUNT(*) FROM v WHERE c2 = 'a';

CREATE TABLE t (c1 STRING, c2 STRING COLLATE UTF8_LCASE);

SELECT DISTINCT COLLATION(c2) FROM v;

-- ALTER VIEW check default collation
DROP VIEW IF EXISTS v;

SELECT COLLATION(c1) FROM v;

SELECT COLLATION(c3) FROM v;

CREATE VIEW v DEFAULT COLLATION sr_AI_CI AS SELECT 'a' AS c1;

SELECT COLLATION(c5) FROM v;

CREATE TEMPORARY VIEW v DEFAULT COLLATION UNICODE AS SELECT 'a';

CREATE TEMPORARY VIEW v DEFAULT COLLATION UNICODE AS SELECT CAST(c1 AS STRING COLLATE SR_AI) FROM t;

CREATE OR REPLACE TEMPORARY VIEW v DEFAULT COLLATION sr_ci_ai AS SELECT *, 'ć' AS c3 FROM t;

CREATE TEMPORARY VIEW v DEFAULT COLLATION sr_AI_CI AS SELECT 'a' AS c1;

-- Nested window function: MAX(ROW_NUMBER() OVER (...)) OVER (...)
-- The nested ROW_NUMBER() must be extracted to a separate window layer, producing the nested
-- window at the bottom of the plan.
SELECT
  col1,
  MAX(ROW_NUMBER() OVER (ORDER BY col1)) OVER () AS max_rn
FROM t1;

-- Nested in the spec with GROUP BY (Aggregate-backed child).
SELECT col1 FROM t1 GROUP BY col1
QUALIFY ROW_NUMBER() OVER (ORDER BY DENSE_RANK() OVER (ORDER BY col1)) <= 1;

SELECT id
FROM VALUES
  (0L, 0L, 10L), (1L, 0L, 20L), (2L, 1L, 30L),
  (3L, 2L, 40L), (4L, 2L, 50L), (5L, 2L, 60L)
  AS input(id, grp, value)
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY COUNT(*) OVER (PARTITION BY grp)
  ORDER BY id
) = 1
ORDER BY id;

SELECT id, grp, value
FROM VALUES
  (0L, 0L, 10L), (1L, 0L, 20L), (2L, 1L, 30L),
  (3L, 2L, 40L), (4L, 2L, 50L), (5L, 2L, 60L)
  AS input(id, grp, value)
QUALIFY ROW_NUMBER() OVER (
  ORDER BY COUNT(*) OVER (PARTITION BY grp) DESC,
    SUM(value) OVER (PARTITION BY grp) DESC,
    id
) = 1
ORDER BY id;

SELECT col1, MAX(SUM(ROW_NUMBER() OVER (ORDER BY col1)) OVER ()) OVER () AS m FROM t1;

-- Nested windows over an aggregate, and in QUALIFY together with HAVING.
SELECT col1, MAX(RANK() OVER (ORDER BY SUM(col2))) OVER () AS m FROM t1 GROUP BY col1;

SELECT *, lead(COL1) OVER (ORDER BY COL1) AS flag FROM t1;

SELECT lead(COL1) OVER (PARTITION BY COL2 ORDER BY COL1) AS flag, * FROM t1 ORDER BY COL1;

SELECT col1, count(randn(0)) OVER (ORDER BY col1) AS cnt FROM t1;

-- Nondeterministic expressions are also allowed in window partitioning expressions.
SELECT col1, row_number() OVER (PARTITION BY rand(0) < 2 ORDER BY col1) AS rn FROM t1;

SELECT
    col1 % 2 as parity,
  SUM(col1) as group_sum,
  SUM(SUM(col1)) OVER (PARTITION BY col1 % 2) as partition_sum
FROM VALUES (1, 10), (2, 20), (3, 30), (4, 40), (5, 50) AS t(col1, col2)
GROUP BY col1, col2, col1 % 2
ORDER BY SUM(col1), col1 % 2;

SELECT
    col1,
    SUM(col2) as sum_col2,
    SUM(SUM(col2)) OVER (ORDER BY col1 ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as rolling_sum
FROM VALUES (1, 5), (2, 10), (3, 15), (4, 20), (5, 25) AS t(col1, col2)
GROUP BY col1, col2
ORDER BY SUM(col2), col1;

SELECT
    col1,
    col2 + 100 as adjusted_col2,
    COUNT(*) as cnt,
    AVG(COUNT(*)) OVER () as avg_count
FROM VALUES (1, 5), (1, 15), (2, 25), (2, 35), (3, 45) AS t(col1, col2)
GROUP BY col1, col2 + 100, col2
HAVING COUNT(*) >= 1
ORDER BY COUNT(*) DESC, col2 + 100;

SELECT
    COALESCE(col1, 0) as safe_col1,
    COUNT(col2) as non_null_count,
    SUM(COUNT(col2)) OVER () as total_non_null
FROM VALUES (1, 10), (NULL, 20), (3, NULL), (4, 40) AS t(col1, col2)
GROUP BY COALESCE(col1, 0), col1, col2
ORDER BY COUNT(col2) DESC, COALESCE(col1, 0);

SELECT
    col1 % 2 as parity,
  COUNT(*) as cnt,
  AVG(col2) as avg_col2,
  SUM(COUNT(*)) OVER () as total_count,
  MAX(AVG(col2)) OVER () as max_avg
FROM VALUES (1, 100), (2, 200), (3, 300), (4, 400) AS t(col1, col2)
GROUP BY col1 % 2, col1, col2;

SELECT
    col1 % 3 as mod_group,
  col2,
  COUNT(*) as cnt,
  SUM(COUNT(*)) OVER (PARTITION BY col1 % 3) as sum_by_mod,
  AVG(COUNT(*)) OVER (PARTITION BY col2) as avg_by_col2
FROM VALUES (1, 'A'), (2, 'B'), (3, 'A'), (4, 'B'), (5, 'A') AS t(col1, col2)
GROUP BY col1 % 3, col2, col1;

SELECT
    col1,
    SUM(col2) as sum_col2,
    SUM(SUM(col2)) OVER (ORDER BY col1 ROWS UNBOUNDED PRECEDING) as running_sum
FROM VALUES (1, 10), (2, 20), (3, 30) AS t(col1, col2)
GROUP BY col1, col2;

-- ORDER BY grouping key that is aliased with a different name in SELECT,
-- combined with a window function (Aggregate + Window + Sort).
SELECT col1 AS a, count(*) * 1.0 / sum(count(*)) OVER () AS ratio
FROM wwa_data
GROUP BY col1
ORDER BY col1;

-- QUALIFY on grouping key that is aliased with a different name in SELECT,
-- combined with a window function (Aggregate + Window + Filter).
SELECT col1 AS a, count(*) * 1.0 / sum(count(*)) OVER () AS ratio
FROM wwa_data
GROUP BY col1
QUALIFY col1 > 0;

-- QUALIFY with a window function in the condition + ORDER BY on aliased grouping key.
-- The Sort child is Project(_, Filter(_, Window(_, Window(_)))).
SELECT col1 AS a, count(*) * 1.0 / sum(count(*)) OVER () AS ratio
FROM wwa_data
GROUP BY col1
QUALIFY row_number() OVER (ORDER BY col1) = 1
ORDER BY col1;

-- ORDER BY the alias in descending order, with a window function.
SELECT col1 AS a, count(*) * 1.0 / sum(count(*)) OVER () AS ratio
FROM wwa_data
GROUP BY col1
ORDER BY a DESC;

-- ROLLUP and CUBE with aliased GROUPING_ID() and GROUPING(), referenced by ORDER BY, HAVING,
-- QUALIFY and a window specification.
SELECT col1, COUNT(*) AS cnt, SUM(COUNT(*)) OVER () AS total, GROUPING_ID() AS gid
FROM wwa_data
GROUP BY ROLLUP(col1)
ORDER BY gid, col1;

SELECT col1, COUNT(*) AS cnt, SUM(COUNT(*)) OVER () AS total, GROUPING(col1) AS grp
FROM wwa_data
GROUP BY GROUPING SETS ((col1), ())
QUALIFY grp = 1;

CREATE OR REPLACE TEMPORARY VIEW test_ignore_null AS SELECT * FROM VALUES
('a', 0, null),
('a', 1, 'x'),
('b', 2, null),
('c', 3, null),
('a', 4, 'y'),
('b', 5, null),
('a', 6, 'z'),
('a', 7, 'v'),
('a', 8, null)
AS test_ignore_null(content, id, v);

SELECT val_long, cate, sum(val_long) OVER(PARTITION BY cate ORDER BY val_long
ROWS BETWEEN CURRENT ROW AND 2147483648 FOLLOWING) FROM testData ORDER BY cate, val_long;

SELECT val_long, cate, sum(val_long) OVER(PARTITION BY cate ORDER BY val_long
RANGE BETWEEN CURRENT ROW AND 2147483648 FOLLOWING) FROM testData ORDER BY cate, val_long;

SELECT val_timestamp, cate, avg(val_timestamp) OVER(PARTITION BY cate ORDER BY val_timestamp
RANGE BETWEEN CURRENT ROW AND interval 23 days 4 hours FOLLOWING) FROM testData
ORDER BY cate, val_timestamp;

SELECT val_timestamp, cate, avg(val_timestamp) OVER(PARTITION BY cate ORDER BY to_timestamp_ntz(val_timestamp)
RANGE BETWEEN CURRENT ROW AND interval '1-1' year to month FOLLOWING) FROM testData
ORDER BY cate, to_timestamp_ntz(val_timestamp);

SELECT val_date, cate, avg(val_timestamp) OVER(PARTITION BY cate ORDER BY val_date
RANGE BETWEEN CURRENT ROW AND interval '1-1' year to month FOLLOWING) FROM testData
ORDER BY cate, val_date;

-- Invalid window frame
SELECT val, cate, count(val) OVER(PARTITION BY cate
ROWS BETWEEN UNBOUNDED FOLLOWING AND 1 FOLLOWING) FROM testData ORDER BY cate, val;

SELECT val, cate, count(val) OVER(PARTITION BY cate ORDER BY current_timestamp
RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) FROM testData ORDER BY cate, val;

-- Window functions
SELECT val, cate,
max(val) OVER w AS max,
min(val) OVER w AS min,
min(val) OVER w AS min,
count(val) OVER w AS count,
sum(val) OVER w AS sum,
avg(val) OVER w AS avg,
stddev(val) OVER w AS stddev,
first_value(val) OVER w AS first_value,
first_value(val, true) OVER w AS first_value_ignore_null,
first_value(val, false) OVER w AS first_value_contain_null,
any_value(val) OVER w AS any_value,
any_value(val, true) OVER w AS any_value_ignore_null,
any_value(val, false) OVER w AS any_value_contain_null,
last_value(val) OVER w AS last_value,
last_value(val, true) OVER w AS last_value_ignore_null,
last_value(val, false) OVER w AS last_value_contain_null,
rank() OVER w AS rank,
dense_rank() OVER w AS dense_rank,
cume_dist() OVER w AS cume_dist,
percent_rank() OVER w AS percent_rank,
ntile(2) OVER w AS ntile,
row_number() OVER w AS row_number,
var_pop(val) OVER w AS var_pop,
var_samp(val) OVER w AS var_samp,
approx_count_distinct(val) OVER w AS approx_count_distinct,
covar_pop(val, val_long) OVER w AS covar_pop,
corr(val, val_long) OVER w AS corr,
stddev_samp(val) OVER w AS stddev_samp,
stddev_pop(val) OVER w AS stddev_pop,
collect_list(val) OVER w AS collect_list,
collect_set(val) OVER w AS collect_set,
skewness(val_double) OVER w AS skewness,
kurtosis(val_double) OVER w AS kurtosis
FROM testData
WINDOW w AS (PARTITION BY cate ORDER BY val)
ORDER BY cate, val;

-- OrderBy not specified for lead
SELECT lead(t) OVER ()
FROM VALUES ('A'), ('B'), ('C') AS tbl(t);

-- parentheses around window reference
SELECT cate, sum(val) OVER (w)
FROM testData
WHERE val is not null
WINDOW w AS (PARTITION BY cate ORDER BY val);

-- window aggregate with filter predicate: entire partition frame
SELECT val, cate,
sum(val) FILTER (WHERE cate = 'a') OVER(PARTITION BY cate) AS total_sum_filtered
FROM testData ORDER BY cate, val;

-- nth_value()/first_value()/any_value() over ()
SELECT
    employee_name,
    salary,
    first_value(employee_name) OVER w highest_salary,
    any_value(employee_name) OVER w highest_salary,
    nth_value(employee_name, 2) OVER w second_highest_salary
FROM
    basic_pays
WINDOW w AS (ORDER BY salary DESC)
ORDER BY salary DESC;

SELECT
    employee_name,
    salary,
    first_value(employee_name) OVER w highest_salary,
    any_value(employee_name) OVER w highest_salary,
    nth_value(employee_name, 2) OVER w second_highest_salary
FROM
    basic_pays
WINDOW w AS (ORDER BY salary RANGE BETWEEN 2000 PRECEDING AND 1000 FOLLOWING)
ORDER BY salary;

SELECT
    employee_name,
    salary,
    first_value(employee_name) OVER w highest_salary,
    any_value(employee_name) OVER w highest_salary,
    nth_value(employee_name, 2) OVER w second_highest_salary
FROM
    basic_pays
WINDOW w AS (ORDER BY salary DESC RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
ORDER BY salary DESC;

SELECT
	employee_name,
	department,
	salary,
	FIRST_VALUE(employee_name) OVER w highest_salary,
	NTH_VALUE(employee_name, 2) OVER w second_highest_salary
FROM
	basic_pays
WINDOW w AS (
  PARTITION BY department
  ORDER BY salary DESC
  RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
ORDER BY department;

SELECT
    content,
    id,
    v,
    nth_value(v, 1) IGNORE NULLS OVER w nth_value_1,
    nth_value(v, 2) IGNORE NULLS OVER w nth_value_2,
    nth_value(v, 3) IGNORE NULLS OVER w nth_value_3,
    first_value(v) IGNORE NULLS OVER w first_value,
    any_value(v) IGNORE NULLS OVER w any_value,
    last_value(v) IGNORE NULLS OVER w last_value
FROM
    test_ignore_null
WINDOW w AS (ORDER BY id RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
ORDER BY id;

SELECT
    content,
    id,
    v,
    nth_value(v, 1) IGNORE NULLS OVER w nth_value_1,
    nth_value(v, 2) IGNORE NULLS OVER w nth_value_2,
    nth_value(v, 3) IGNORE NULLS OVER w nth_value_3,
    first_value(v) IGNORE NULLS OVER w first_value,
    any_value(v) IGNORE NULLS OVER w any_value,
    last_value(v) IGNORE NULLS OVER w last_value
FROM
    test_ignore_null
WINDOW w AS (ORDER BY id ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING)
ORDER BY id;

SELECT
    content,
    id,
    v,
    nth_value(v, 1) IGNORE NULLS OVER w nth_value_1,
    nth_value(v, 2) IGNORE NULLS OVER w nth_value_2,
    nth_value(v, 3) IGNORE NULLS OVER w nth_value_3,
    first_value(v) IGNORE NULLS OVER w first_value,
    any_value(v) IGNORE NULLS OVER w any_value,
    last_value(v) IGNORE NULLS OVER w last_value
FROM
    test_ignore_null
WINDOW w AS (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
ORDER BY id;

SELECT
	SUM(salary) OVER w sum_salary
FROM
	basic_pays;

SELECT * FROM (SELECT cate, val, rank() OVER(PARTITION BY cate ORDER BY val) as r FROM testData) where r = 1;

SELECT * FROM (SELECT cate, val, dense_rank() OVER(PARTITION BY cate ORDER BY val) as r FROM testData) where r <= 2;

SELECT *, mean(val_double) over (partition BY val ORDER BY val_date RANGE INTERVAL '5' DAY PRECEDING) AS mean FROM testData;

-- to_xml
select to_xml(named_struct('a', 1, 'b', 2), map('indent', ''));

select to_xml(map('a', 1));

select to_xml();

-- Check if errors handled
select from_xml('<p><a>1</a></p>', 1);

select from_xml('<p><a>1</a></p>', 'a INT', map('mode', 1));

-- from_xml - complex types
select from_xml('<p><a>1</a></p>', 'struct<a:array<int>>');

select from_xml('<p><a>1</a><a>2</a><a>3</a></p>', schema_of_xml('<p><a>1</a><a>2</a></p>'));

select from_xml('<p><a>1</a><a></a></p>', 'struct<a:array<int>>');

select from_xml(
  '<p><d>12/15 2012</d><t>12/15 2012 15:15:15</t>}</p>',
  'd date, t timestamp',
  map('dateFormat', 'MM/dd yyyy', 'timestampFormat', 'MM/dd yyyy HH:mm:ss'));

-- infer schema of xml literal with options
select schema_of_xml(null);

SELECT schema_of_xml(xmlField) FROM xmlTable;

select from_xml('<record><time>14:30:45.123456</time></record>', 'time TIME(6)', map('rowTag', 'record'));

-- Invalid input
select from_xml('<record><time>25:00:00</time></record>', 'time TIME', map('rowTag', 'record'));

-- to_xml with TIME type
select to_xml(named_struct('time', TIME'14:30:45'), map('rowTag', 'record', 'indent', ''));

-- TIME type roundtrip tests
select from_xml(to_xml(named_struct('time', TIME'14:30:45'), map('rowTag', 'record')), 'time TIME(0)', map('rowTag', 'record'));

select from_xml(to_xml(named_struct('time', TIME'14:30:45.123'), map('rowTag', 'record')), 'time TIME(3)', map('rowTag', 'record'));

select from_xml(to_xml(named_struct('time', TIME'14:30:45.123456'), map('rowTag', 'record')), 'time TIME(6)', map('rowTag', 'record'));

select to_xml(from_xml('<record><time>14:30:45.123456</time></record>', 'time TIME(6)', map('rowTag', 'record')), map('rowTag', 'record', 'indent', ''));

-- LIMIT test
select from_xml('<record><time>14:30:45</time></record>', 'time TIME', map('rowTag', 'record')) LIMIT 1;
