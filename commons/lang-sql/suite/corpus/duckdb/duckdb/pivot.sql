CREATE TABLE Cities(Country VARCHAR, Name VARCHAR, Year INT, Population INT);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2000, 1005);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2010, 1065);

INSERT INTO Cities VALUES ('NL', 'Amsterdam', 2020, 1158);

INSERT INTO Cities VALUES ('US', 'Seattle', 2000, 564);

INSERT INTO Cities VALUES ('US', 'Seattle', 2010, 608);

INSERT INTO Cities VALUES ('US', 'Seattle', 2020, 738);

INSERT INTO Cities VALUES ('US', 'New York City', 2000, 8015);

INSERT INTO Cities VALUES ('US', 'New York City', 2010, 8175);

INSERT INTO Cities VALUES ('US', 'New York City', 2020, 8772);

PIVOT Cities USING SUM(Population);

PIVOT Cities USING SUM(Population) GROUP BY Country;

PIVOT Cities ON Year USING SUM(Population) GROUP BY (Country);

PIVOT Cities GROUP BY Country;

PIVOT Cities ON Year GROUP BY Country;

PIVOT (SELECT Country, Year FROM Cities) ON Year;

create table p (col1 timestamp, col2 int);

INSERT INTO p VALUES 
    ('2024-12-04 09:30:01', 100),
    ('2024-12-04 09:30:02', 100),
    ('2024-12-04 09:30:03', 100),
    ('2024-12-04 09:30:04', 100),
    ('2024-12-04 09:30:05', 100),
    ('2024-12-04 09:30:06', 100),
    ('2024-12-04 09:30:07', 100),
    ('2024-12-04 09:30:08', 100);

pivot p using sum (col2) group by col1 order by col1;

CREATE TABLE cpb_tbl AS
WITH CPB(CPDH,NF,JG) AS (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
) FROM CPB;

pivot cpb_tbl on nf using sum(jg)group by cpdh;

WITH CPB(CPDH,NF,JG) AS (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
pivot CPB on nf IN (2010, 2017, 2018, 2022) using sum(jg)group by cpdh;

WITH CPB(CPDH,NF,JG) AS (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
pivot CPB on nf using sum(jg)group by cpdh;

WITH CPB(CPDH,NF,JG) AS (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
SELECT *
FROM  (pivot CPB on nf using sum(jg)group by cpdh);

WITH CPB(CPDH,NF,JG) AS (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
from CPB pivot (sum(jg) for nf in (2010, 2017, 2018, 2022) group by cpdh);

WITH CPB AS (SELECT 42)
SELECT *
FROM  (
	WITH CPB(CPDH,NF,JG) AS (
		SELECT 'C1',2022,10
		UNION ALL
		SELECT 'C1',2018,20
		UNION ALL
		SELECT 'C1',2017,0
		UNION ALL
		SELECT 'C2',2022,10
		UNION ALL
		SELECT 'C2',2010,30
		UNION ALL
		SELECT 'C3',2010,80
	)
	pivot CPB on nf using sum(jg) group by cpdh);

WITH CPB(CPDH,NF,JG) AS MATERIALIZED (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
pivot CPB on nf IN (2010, 2017, 2018, 2022) using sum(jg)group by cpdh;

WITH CPB(CPDH,NF,JG) AS MATERIALIZED (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
pivot CPB on nf using sum(jg)group by cpdh;

WITH CPB(CPDH,NF,JG) AS MATERIALIZED (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
SELECT *
FROM  (pivot CPB on nf using sum(jg)group by cpdh);

WITH CPB(CPDH,NF,JG) AS MATERIALIZED (
SELECT 'C1',2022,10
UNION ALL
SELECT 'C1',2018,20
UNION ALL
SELECT 'C1',2017,0
UNION ALL
SELECT 'C2',2022,10
UNION ALL
SELECT 'C2',2010,30
UNION ALL
SELECT 'C3',2010,80
)
from CPB pivot (sum(jg) for nf in (2010, 2017, 2018, 2022) group by cpdh);

WITH CPB AS (SELECT 42)
SELECT *
FROM  (
	WITH CPB(CPDH,NF,JG) AS MATERIALIZED (
		SELECT 'C1',2022,10
		UNION ALL
		SELECT 'C1',2018,20
		UNION ALL
		SELECT 'C1',2017,0
		UNION ALL
		SELECT 'C2',2022,10
		UNION ALL
		SELECT 'C2',2010,30
		UNION ALL
		SELECT 'C3',2010,80
	)
	pivot CPB on nf using sum(jg) group by cpdh);

CREATE TABLE t(k INT, y VARCHAR, v INT);

INSERT INTO t VALUES (1,'p',1),(1,'p',12),(1,'q',5),(2,'p',20);

SELECT * FROM (PIVOT t ON y USING sum(v) FILTER (WHERE v>1) GROUP BY k) ORDER BY k;

SELECT * FROM (PIVOT t ON y IN ('p', 'q') USING sum(v) FILTER (WHERE v>1) GROUP BY k) ORDER BY k;

SET pivot_filter_threshold=0;

CREATE TABLE Produce AS
  SELECT 'Kale' as product, 51 as sales, 'Q1' as quarter, 2020 as year UNION ALL
  SELECT 'Kale', 23, 'Q2', 2020 UNION ALL
  SELECT 'Kale', 45, 'Q3', 2020 UNION ALL
  SELECT 'Kale', 3, 'Q4', 2020 UNION ALL
  SELECT 'Kale', 70, 'Q1', 2021 UNION ALL
  SELECT 'Kale', 85, 'Q2', 2021 UNION ALL
  SELECT 'Apple', 77, 'Q1', 2020 UNION ALL
  SELECT 'Apple', 0, 'Q2', 2020 UNION ALL
  SELECT 'Apple', 1, 'Q1', 2021;

SELECT * FROM Produce
PIVOT(SUM(sales) FOR quarter IN ('Q1', 'Q2', 'Q3', 'Q4'))
ORDER BY ALL;

SELECT * FROM
  (SELECT product, sales, quarter FROM Produce)
  PIVOT(SUM(sales) FOR quarter IN ('Q1', 'Q2', 'Q3', 'Q4'))
ORDER BY ALL;

SELECT * FROM
  (SELECT product, sales, quarter FROM Produce)
  PIVOT(SUM(sales) FOR quarter IN ('Q1', 'Q2', 'Q3'))
  ORDER BY ALL;

SELECT * FROM
  (SELECT sales, quarter FROM Produce)
  PIVOT(SUM(sales) FOR quarter IN ('Q1', 'Q2', 'Q3'))
  ORDER BY ALL;

SELECT * FROM
  (SELECT product, sales, quarter FROM Produce)
  PIVOT(SUM(sales) total_sales, COUNT(*) num_records FOR quarter IN ('Q1', 'Q2'))
ORDER BY ALL;

CREATE OR REPLACE TABLE Produce AS
  SELECT 'Kale' as product, 51 as Q1, 23 as Q2, 45 as Q3, 3 as Q4 UNION ALL
  SELECT 'Apple', 77, 0, 25, 2;

SELECT * FROM Produce
UNPIVOT(sales FOR quarter IN (Q1, Q2, Q3, Q4))
ORDER BY ALL;

SELECT product, first_half_sales, second_half_sales, semesters FROM Produce
UNPIVOT(
  (first_half_sales, second_half_sales)
  FOR semesters
  IN ((Q1, Q2) AS 'semester_1', (Q3, Q4) AS 'semester_2'));

CREATE TABLE Cities (Name VARCHAR, id INTEGER);

INSERT INTO Cities VALUES ('Test', 1);

INSERT INTO Cities VALUES ('test',2);

SET pivot_filter_threshold=1;

FROM Cities
PIVOT (
    array_agg(id)
    FOR
        name IN ('test','Test')
);

FROM Cities
PIVOT (
    array_agg(id), sum(id)
    FOR
        name IN ('test','Test')
);

CREATE TEMP VIEW sales(year, quarter, region, sales) AS
   VALUES (2018, 1, 'east', 100),
          (2018, 2, 'east',  20),
          (2018, 3, 'east',  40),
          (2018, 4, 'east',  40),
          (2019, 1, 'east', 120),
          (2019, 2, 'east', 110),
          (2019, 3, 'east',  80),
          (2019, 4, 'east',  60),
          (2018, 1, 'west', 105),
          (2018, 2, 'west',  25),
          (2018, 3, 'west',  45),
          (2018, 4, 'west',  45),
          (2019, 1, 'west', 125),
          (2019, 2, 'west', 115),
          (2019, 3, 'west',  85),
          (2019, 4, 'west',  65);

SELECT year, region, q1, q2, q3, q4
  FROM sales
  PIVOT (sum(sales)
    FOR quarter
    IN (1 AS q1, 2 AS q2, 3 AS q3, 4 AS q4));

SELECT year, q1_east, q1_west, q2_east, q2_west, q3_east, q3_west, q4_east, q4_west
    FROM sales
    PIVOT (sum(sales)
      FOR (quarter, region)
      IN ((1, 'east') AS q1_east, (1, 'west') AS q1_west, (2, 'east') AS q2_east, (2, 'west') AS q2_west,
          (3, 'east') AS q3_east, (3, 'west') AS q3_west, (4, 'east') AS q4_east, (4, 'west') AS q4_west));

SELECT year, q1, q2, q3, q4
  FROM (SELECT year, quarter, sales FROM sales) AS s
  PIVOT (sum(sales)
    FOR quarter
    IN (1 AS q1, 2 AS q2, 3 AS q3, 4 AS q4));

SELECT year, q1_total, q1_avg, q2_total, q2_avg, q3_total, q3_avg, q4_total, q4_avg
    FROM (SELECT year, quarter, sales FROM sales) AS s
    PIVOT (sum(sales) AS total, avg(sales) AS avg
      FOR quarter
      IN (1 AS q1, 2 AS q2, 3 AS q3, 4 AS q4));

SELECT *
    FROM (SELECT year, quarter, sales FROM sales) AS s
    PIVOT (sum(sales), avg(sales)
      FOR quarter
      IN (1 AS q1, 2 AS q2, 3 AS q3, 4 AS q4));

CREATE OR REPLACE TEMPORARY VIEW sales(location, year, q1, q2, q3, q4) AS
  VALUES ('Toronto'      , 2020, 100 , 80 , 70, 150),
         ('San Francisco', 2020, NULL, 20 , 50,  60),
         ('Toronto'      , 2021, 110 , 90 , 80, 170),
         ('San Francisco', 2021, 70  , 120, 85, 105);

SELECT *
    FROM sales UNPIVOT INCLUDE NULLS
    (sales FOR quarter IN (q1       AS "Jan-Mar",
                           q2       AS "Apr-Jun",
                           q3       AS "Jul-Sep",
                           q4 AS "Oct-Dec"));

CREATE OR REPLACE TEMPORARY VIEW oncall
         (year, week, area      , name1   , email1              , phone1     , name2   , email2              , phone2) AS
  VALUES (2022, 1   , 'frontend', 'Freddy', 'fred@alwaysup.org' , 15551234567, 'Fanny' , 'fanny@lwaysup.org' , 15552345678),
         (2022, 1   , 'backend' , 'Boris' , 'boris@alwaysup.org', 15553456789, 'Boomer', 'boomer@lwaysup.org', 15554567890),
         (2022, 2   , 'frontend', 'Franky', 'frank@lwaysup.org' , 15555678901, 'Fin'   , 'fin@alwaysup.org'  , 15556789012),
         (2022, 2   , 'backend' , 'Bonny' , 'bonny@alwaysup.org', 15557890123, 'Bea'   , 'bea@alwaysup.org'  , 15558901234);

SELECT *
    FROM oncall UNPIVOT ((name, email, phone) FOR precedence IN ((name1, email1, phone1) AS primary,
                                                                 (name2, email2, phone2) AS secondary));

PIVOT Cities ON Country USING SUM(Population);

PIVOT Cities ON Country, Name USING SUM(Population);

PIVOT Cities ON Country IN ('xx') USING SUM(Population);

PIVOT Cities ON (Country, Name) IN ('xx') USING SUM(Population);

PIVOT Cities ON Country IN ('xx', 'yy') USING SUM(Population);

SET pivot_filter_threshold = 1;

CREATE TABLE z AS PIVOT (SELECT * FROM (VALUES (''), ('a')) t(v)) ON v USING count(*);

SELECT column_name FROM duckdb_columns() WHERE table_name = 'z' ORDER BY ALL;

RESET pivot_filter_threshold;

CREATE TABLE z2 AS PIVOT (SELECT * FROM (VALUES (''), ('a')) t(v)) ON v USING count(*);

SELECT column_name FROM duckdb_columns() WHERE table_name = 'z2' ORDER BY ALL;

SELECT count(*) FROM (PIVOT (SELECT CASE WHEN r = 0 THEN '' ELSE 'x' || r END v FROM range(21) t(r)) ON v USING count(*));

CREATE OR REPLACE TABLE monthly_sales(empid INT, amount INT, month TEXT);

INSERT INTO monthly_sales VALUES
    (1, 10000, 'JAN'),
    (1, 400, 'JAN'),
    (2, 4500, 'JAN'),
    (2, 35000, 'JAN'),
    (1, 5000, 'FEB'),
    (1, 3000, 'FEB'),
    (2, 200, 'FEB'),
    (2, 90500, 'FEB'),
    (1, 6000, 'MAR'),
    (1, 5000, 'MAR'),
    (2, 2500, 'MAR'),
    (2, 9500, 'MAR'),
    (1, 8000, 'APR'),
    (1, 10000, 'APR'),
    (2, 800, 'APR'),
    (2, 4500, 'APR');

CREATE TYPE unique_months AS ENUM (SELECT DISTINCT month FROM monthly_sales ORDER BY
	CASE month WHEN 'JAN' THEN 1 WHEN 'FEB' THEN 2 WHEN 'MAR' THEN 3 ELSE 4 END);

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN unique_months)
      AS p
  ORDER BY EMPID;

CREATE TYPE not_an_enum AS VARCHAR;

CREATE TABLE test(i INT, j VARCHAR);

SET pivot_filter_threshold=100;

PIVOT Cities ON Country || '_' || Name USING SUM(Population) GROUP BY Year;

PIVOT Cities ON (CASE WHEN Country='NL' THEN NULL ELSE Country END) USING SUM(Population) GROUP BY Year;

PIVOT Cities ON Country || '_' || Name USING COALESCE(SUM(Population), 0) GROUP BY Year;

PIVOT Cities ON Country || '_' || Name USING SUM(Population)::VARCHAR GROUP BY Year;

PIVOT Cities ON Country || '_' || Name USING SUM(Population) + 42 GROUP BY Year;

CREATE TABLE Product(DaysToManufacture int, StandardCost int GENERATED ALWAYS AS (DaysToManufacture * 5));

INSERT INTO Product VALUES (0), (1), (2), (4);

SELECT 'AverageCost' AS Cost_Sorted_By_Production_Days,
  "0", "1", "2", "3", "4"
FROM
(
  SELECT DaysToManufacture, StandardCost
  FROM Product
) AS SourceTable
PIVOT
(
  AVG(StandardCost)
  FOR DaysToManufacture IN (0, 1, 2, 3, 4)
) AS PivotTable;

SELECT k0_x, k0_y FROM (PIVOT (SELECT 'k' || (r % 21) a, r v FROM range(42) t(r)) ON a USING sum(v) AS x, max(v) AS y);

pivot cities on (Country='NL') using avg(Population) group by name;

pivot cities on (Country='NL') in (false, true) using avg(Population) group by name;

WITH src AS (SELECT 'a' AS k), p AS (PIVOT src ON k) SELECT * FROM p;

WITH src AS (SELECT 'a' AS k), p AS (PIVOT (SELECT * FROM src) ON k) SELECT * FROM p;

WITH src AS (SELECT 'a' AS k, 1 AS v UNION ALL SELECT 'b', 2), p AS (PIVOT src ON k USING sum(v)) SELECT * FROM p;

WITH s1 AS (SELECT 'x' AS k), s2 AS (SELECT * FROM s1), p AS (PIVOT s2 ON k) SELECT * FROM p;

WITH src AS (SELECT 'a' AS k), p AS (WITH src AS (SELECT 'z' AS k) PIVOT src ON k) SELECT * FROM p;

WITH src AS (SELECT 'a' AS k), p AS (WITH src AS (SELECT 'z' AS k) PIVOT src ON k) SELECT z FROM p;

WITH RECURSIVE r(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM r WHERE i < 3), p AS (PIVOT r ON i) SELECT * FROM p;

CREATE TABLE t(col VARCHAR);

SELECT * FROM t PIVOT (count(*) FOR col IN (CAST(map() AS VARCHAR)));

INSERT INTO t VALUES ('{}'), ('x'), ('{a=1}');

SELECT * FROM t PIVOT (count(*) FOR col IN (map()));

SELECT * FROM t PIVOT (count(*) FOR col IN (CAST(map(['a'], [1]) AS VARCHAR)));

SELECT * FROM t PIVOT (count(*) FOR col IN (CAST(MAP {} AS VARCHAR)));

SELECT * FROM t PIVOT (count(*) FOR col IN (MAP {'a': 1}));

SELECT * FROM t PIVOT (count(*) FOR col IN (CAST([map()] AS VARCHAR), CAST({'k': map()} AS VARCHAR)));

PIVOT Cities ON Year IN (SELECT Year FROM Cities ORDER BY Year DESC) USING SUM(Population);

PIVOT Cities ON Year IN (SELECT YEAR FROM (SELECT Year, SUM(POPULATION) AS popsum FROM Cities GROUP BY Year ORDER BY popsum DESC)) USING SUM(Population);

PIVOT Cities ON Year IN (SELECT '2010' UNION ALL SELECT '2000' UNION ALL SELECT '2020') USING SUM(Population);

INSERT INTO monthly_sales VALUES
    (1, 10000, '1-JAN'),
    (1, 400, '1-JAN'),
    (2, 4500, '1-JAN'),
    (2, 35000, '1-JAN'),
    (1, 5000, '2-FEB'),
    (1, 3000, '2-FEB'),
    (2, 200, '2-FEB'),
    (2, 90500, '2-FEB'),
    (2, 2500, '3-MAR'),
    (2, 9500, '3-MAR'),
    (1, 8000, '4-APR'),
    (1, 10000, '4-APR'),
    (2, 800, '4-APR'),
    (2, 4500, '4-APR');

PIVOT monthly_sales ON MONTH USING COALESCE(SUM(AMOUNT), 0);

SELECT mode(column_type) FROM (DESCRIBE PIVOT monthly_sales ON MONTH USING SUM(AMOUNT)::INTEGER);

INSERT INTO monthly_sales VALUES
    (1, 10000, '1-JAN'),
    (1, 400, '1-JAN'),
    (2, 4500, '1-JAN'),
    (2, 35000, '1-JAN'),
    (1, 5000, '2-FEB'),
    (1, 3000, '2-FEB'),
    (2, 200, '2-FEB'),
    (2, 90500, '2-FEB'),
    (1, 6000, '3-MAR'),
    (1, 5000, '3-MAR'),
    (2, 2500, '3-MAR'),
    (2, 9500, '3-MAR'),
    (1, 8000, '4-APR'),
    (1, 10000, '4-APR'),
    (2, 800, '4-APR'),
    (2, 4500, '4-APR');

PREPARE v1 AS SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount + ?) FOR MONTH IN ('1-JAN', '2-FEB', '3-MAR', '4-APR'))
      AS p
  ORDER BY EMPID;

EXECUTE v1(0);

EXECUTE v1(1);

PREPARE v2 AS
   PIVOT monthly_sales ON MONTH USING SUM(AMOUNT + ?);

EXECUTE v2(1);

CREATE TABLE t(c VARCHAR, v INTEGER);

INSERT INTO t VALUES ('a', 1), ('b', 2);

CREATE TABLE captured AS
PIVOT (SELECT c, v, current_query() AS q FROM t) ON c USING ANY_VALUE(q) ORDER BY v;

SELECT v,
       regexp_replace(a, '__pivot_enum_[0-9a-f\-]+', '__pivot_enum_X') AS a,
       regexp_replace(b, '__pivot_enum_[0-9a-f\-]+', '__pivot_enum_X') AS b
FROM captured ORDER BY v;

CREATE TABLE t(id INT, jan INT, feb INT);

CREATE VIEW poison_view AS SELECT * FROM t UNPIVOT (val FOR col IN (*));

CREATE VIEW expr_view AS SELECT * FROM t UNPIVOT (val FOR col IN (1+2+id));

CREATE VIEW v AS PIVOT t ON id IN (CASE WHEN true THEN 'a' END) USING (SUM(feb));

CREATE VIEW v1 AS SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'APR'))
      AS p
  ORDER BY EMPID;

CREATE MACRO pivot_macro(val)
as TABLE SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount + val) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'APR'))
      AS p
  ORDER BY EMPID;

FROM v1;

FROM pivot_macro(1);

create table donnees_csv as select {'year': i::varchar, 'month': i::varchar} AS donnee, i%5 as variable_id, i%10 id_niv from range(1000) t(i);

pivot donnees_csv on variable_id using first(donnee) group by id_niv order by all;

CREATE OR REPLACE TABLE sales(empid INT, amount INT, d DATE);

INSERT INTO sales VALUES
    (1, 10000, DATE '2000-01-01'),
    (1, 400, DATE '2000-01-07'),
    (2, 4500, DATE '2001-01-21'),
    (2, 35000, DATE '2001-01-21'),
    (1, 5000, DATE '2000-02-03'),
    (1, 3000, DATE '2000-02-07'),
    (2, 200, DATE '2001-02-05'),
    (2, 90500, DATE '2001-02-19'),
    (1, 6000, DATE '2000-03-01'),
    (1, 5000, DATE '2000-03-09'),
    (2, 2500, DATE '2001-03-03'),
    (2, 9500, DATE '2001-03-08');

PIVOT (SELECT YEAR(d) AS year, MONTH(d) AS month, empid, amount FROM sales) ON YEAR, MONTH USING SUM(AMOUNT) ORDER BY ALL;

PIVOT (PIVOT (SELECT YEAR(d) AS year, MONTH(d) AS month, empid, amount FROM sales) ON YEAR, MONTH USING SUM(AMOUNT))
ON empid USING SUM(COALESCE("2000_1",0) + COALESCE("2000_2",0) + COALESCE("2000_3",0) + COALESCE("2001_1",0) + COALESCE("2001_2",0) + COALESCE("2001_3",0));

PIVOT (WITH cte AS (SELECT 1 AS col, 10 AS v UNION ALL SELECT 2, 20) SELECT * FROM cte) ON col USING SUM(v) ORDER BY ALL;

WITH x AS (SELECT 1 AS col)
SELECT 42
ORDER BY (SELECT * FROM (PIVOT x ON col));

CREATE TABLE t AS SELECT * FROM (VALUES ('x_y', 'z', 1), ('x', 'y_z', 10)) t(a, b, v);

SELECT x_y_z, x_y_z_1 FROM (PIVOT t ON a, b USING sum(v));

SELECT v, x_y_z, x_y_z_1 FROM (PIVOT t ON a, b USING sum(v) GROUP BY v) ORDER BY v;

CREATE TABLE n AS SELECT * FROM (VALUES (NULL, 1), ('NULL', 10), ('a', 100)) t(a, v);

SELECT * FROM (PIVOT n ON a IN (NULL, 'NULL', 'a') USING sum(v));

CREATE TABLE t2 AS SELECT * FROM (VALUES ('x_y', 'z', 1), ('x', 'y_z', 10)) t(a, b, v) UNION ALL SELECT 'p' || r, 'q', 0 FROM range(20) t(r);

SELECT x_y_z, x_y_z_1 FROM (PIVOT t2 ON a, b USING sum(v));

SELECT p3_q FROM (PIVOT t2 ON a, b USING sum(v));

CREATE TABLE t2 AS SELECT 'g' || (i % 3) AS g, 'c' || i AS c, i AS v FROM range(30) r(i);

INSERT INTO t2 VALUES ('g0', 'g', 1000);

SELECT g, "g_1" FROM (PIVOT t2 ON c USING sum(v) GROUP BY g) ORDER BY g;

CREATE OR REPLACE TABLE sales(empid INT, amount INT, month TEXT, year INT);

INSERT INTO sales VALUES
    (1, 10000, 'JAN', 2020),
    (1, 400, 'JAN', 2021),
    (2, 4500, 'JAN', 2021),
    (2, 35000, 'JAN', 2020),
    (1, 5000, 'FEB', 2020),
    (1, 3000, 'FEB', 2021),
    (2, 200, 'FEB', 2021),
    (2, 90500, 'FEB', 2020),
    (1, 6000, 'MAR', 2021),
    (1, 5000, 'MAR', 2021),
    (2, 2500, 'MAR', 2021),
    (2, 9500, 'MAR', 2021),
    (1, 8000, 'APR', 2020),
    (1, 10000, 'APR', 2020),
    (2, 800, 'APR', 2021),
    (2, 4500, 'APR', 2020);

SELECT *
  FROM sales
    PIVOT(
        SUM(amount)
        FOR YEAR IN (2020, 2021)
            MONTH IN ('JAN', 'FEB', 'MAR', 'APR')
    ) AS p
  ORDER BY EMPID;

SELECT *
  FROM sales
    PIVOT(
        SUM(amount + year)
        FOR YEAR IN (2020, 2021)
            MONTH IN ('JAN', 'FEB', 'MAR', 'APR')
    ) AS p
  ORDER BY EMPID;

SELECT *
FROM (SELECT 1 a, NULL::INTEGER b, [1] c)
PIVOT (min(a) FOR (b, c) IN ((NULL, [1])));

SELECT *
FROM (SELECT 1 a, 2 b, 3 c)
PIVOT (min(a) FOR (b, c) IN ((NULL, [1])));

SELECT (SELECT * FROM (SELECT 1 a, 2 b, 3 c) PIVOT (min(a) FOR (b, c) IN ((NULL, [1]))));

SELECT * FROM (VALUES (1)) PIVOT (count(col0) FOR col0 IN (1::INT));

FROM (SELECT 1 a, 2 b) PIVOT (sum(a) FOR b IN ('2022-01-01'::DATE));

SET pivot_limit=10000;

CREATE TABLE Product(DaysToManufacture int, StandardCost int);

INSERT INTO Product VALUES (0, 5.0885), (1, 223.88), (2, 359.1082), (4, 949.4105);

SELECT DaysToManufacture, AVG(StandardCost) AS AverageCost
FROM Product
GROUP BY DaysToManufacture;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'APR'))
      AS p
  ORDER BY EMPID;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount+1) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'DEC'))
      AS p
  ORDER BY EMPID;

SELECT *
  FROM monthly_sales
    PIVOT(COUNT(*) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'DEC') GROUP BY empid)
      AS p
  ORDER BY EMPID;

SELECT empid, January, February, March, April
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('JAN' AS January, 'FEB' AS February, 'MAR' AS March, 'APR' AS April))
      AS p
  ORDER BY EMPID;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('JAN', 'FEB', 'MAR'))
      AS p
  ORDER BY EMPID;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'DEC'))
      AS p
  ORDER BY EMPID;

SELECT *
FROM monthly_sales
PIVOT(SUM(amount) FOR MONTH IN ('JAN', 'FEB', 'MAR', 'APR'))
  AS p (EMP_ID_renamed, JAN, FEB, MAR, APR)
ORDER BY EMP_ID_renamed;

INSERT INTO monthly_sales VALUES (1, 250, NULL);

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN (NULL, 'JAN', 'FEB', 'MAR', 'APR'))
      AS p
  ORDER BY EMPID;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN (NULL, 'JAN', 'FEB', 'MAR', 'APR'))
      AS p
    UNPIVOT INCLUDE NULLS(amount FOR MONTH IN ("NULL", JAN, FEB, MAR, APR))
  ORDER BY ALL;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN (NULL, 'JAN', 'FEB', 'MAR', 'APR'))
      AS p
    UNPIVOT EXCLUDE NULLS(amount FOR MONTH IN ("NULL", JAN, FEB, MAR, APR))
  ORDER BY ALL;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN (NULL, 'JAN', 'FEB', 'MAR', 'APR'))
      AS p
    UNPIVOT EXCLUDE NULLS(amount FOR MONTH IN ("NULL", JAN, FEB, MAR, APR))
  ORDER BY EMPID;

FROM
(
  SELECT DaysToManufacture, StandardCost
  FROM Product
) AS SourceTable
PIVOT
(
  AVG(StandardCost)
  FOR DaysToManufacture IN ('zz')
) AS PivotTable;

PIVOT (FROM range(21)) ON range USING sum(range), sum(range);

SELECT COUNT(*) FROM (PIVOT (FROM range(21)) ON range USING sum(range), sum(range));

PIVOT (FROM range(20)) ON range USING sum(range), sum(range);

PIVOT (FROM range(10)) ON range USING sum(range), sum(range);

PIVOT (FROM range(10)) ON range USING sum(range), sum(range), sum(range);

SELECT COUNT(*) FROM (PIVOT (FROM range(10)) ON range USING sum(range), sum(range), sum(range));

PIVOT (FROM range(21)) ON range USING sum(range), max(range), sum(range);

SELECT COUNT(*) FROM (PIVOT (FROM range(21)) ON range USING sum(range), max(range), sum(range));

PIVOT (FROM range(21)) ON range USING avg(range), avg(range);

PIVOT (FROM range(21)) ON range USING count(range), count(range);

SELECT * FROM (
  PIVOT (FROM range(3)) ON range USING sum(range), sum(range)
);

SELECT "0_sum(""range"")", "0_sum(""range"")_1" FROM (
  PIVOT (FROM range(21)) ON range USING sum(range), sum(range)
);

SELECT "5_sum(""range"")", "5_sum(""range"")_1" FROM (
  PIVOT (FROM range(21)) ON range USING sum(range), sum(range)
);

SELECT "0_sum(""range"")", "0_max(""range"")", "0_sum(""range"")_1" FROM (
  PIVOT (FROM range(21)) ON range USING sum(range), max(range), sum(range)
);

SELECT "5_sum(""range"")", "5_max(""range"")", "5_sum(""range"")_1" FROM (
  PIVOT (FROM range(21)) ON range USING sum(range), max(range), sum(range)
);

PIVOT (
  SELECT range, range::VARCHAR as str_range
  FROM range(21)
)
ON range
USING max(str_range), max(str_range);

CREATE OR REPLACE TABLE monthly_sales(empid INT, dept TEXT, Jan INT, Feb INT, Mar INT, April INT);

INSERT INTO monthly_sales VALUES
    (1, 'electronics', 100, 200, 300, 100),
    (2, 'clothes', 100, 300, 150, 200),
    (3, 'cars', 200, 400, 100, 50);

SELECT * FROM monthly_sales
    UNPIVOT(sales FOR month IN (jan, feb, mar, april))
    ORDER BY empid;

SELECT empid, dept, april, month, sales FROM monthly_sales
    UNPIVOT(sales FOR month IN (jan, feb, mar))
    ORDER BY empid;

SELECT * FROM monthly_sales
    UNPIVOT(sales FOR month IN (jan AS January, feb AS February, mar AS March, april))
    ORDER BY empid;

SELECT p.id, p.type, p.m, p.vals FROM monthly_sales
    UNPIVOT(sales FOR month IN (jan, feb, mar, april)) AS p(id, type, m, vals);

SELECT empid, dept, month, sales_jan_feb, sales_mar_apr FROM monthly_sales
    UNPIVOT((sales_jan_feb, sales_mar_apr) FOR month IN ((jan, feb), (mar, april)));

UNPIVOT (SELECT * FROM monthly_sales)
    ON jan, feb, mar april
    INTO
        NAME month
        VALUE sales;

CREATE TABLE t1(id BIGINT, "Sales (05/19/2020)" BIGINT, "Sales (06/03/2020)" BIGINT, "Sales (10/23/2020)" BIGINT);

INSERT INTO t1 VALUES(10629465, 23, 47, 99);

INSERT INTO t1 VALUES(98765432, 10, 99, 33);

SELECT id, regexp_replace(date, 'Sales [(]([0-9]+)/([0-9]+)/([0-9]+)[)]', '\3-\1-\2')::DATE AS date, sales
FROM t1
    UNPIVOT (sales FOR date IN ("Sales (05/19/2020)", "Sales (06/03/2020)", "Sales (10/23/2020)"))
 ORDER BY ALL;

SELECT id, regexp_replace(date, 'Sales [(]([0-9]+)/([0-9]+)/([0-9]+)[)]', '\3-\1-\2')::DATE AS date, sales
FROM
    (UNPIVOT t1 ON "Sales (05/19/2020)", "Sales (06/03/2020)", "Sales (10/23/2020)" INTO NAME date VALUE sales)
 ORDER BY ALL;

SELECT *
FROM
	(UNPIVOT t1 ON "Sales (05/19/2020)" AS "2020-05-19", "Sales (06/03/2020)" AS "2020-06-03", "Sales (10/23/2020)" AS "2020-10-23" INTO NAME date VALUE sales)
ORDER BY ALL;

SELECT id, regexp_replace(date, 'Sales [(]([0-9]+)/([0-9]+)/([0-9]+)[)]', '\3-\1-\2')::DATE AS date, sales FROM t1
    UNPIVOT (Sales FOR Date IN (COLUMNS('Sales.*')))
 ORDER BY ALL;

SELECT id, regexp_replace(date, 'Sales [(]([0-9]+)/([0-9]+)/([0-9]+)[)]', '\3-\1-\2')::DATE AS date, sales
FROM
	(UNPIVOT t1 ON COLUMNS('Sales.*') INTO NAME date VALUE sales)
ORDER BY ALL;

SELECT id, regexp_replace(date, 'Sales [(]([0-9]+)/([0-9]+)/([0-9]+)[)]', '\3-\1-\2')::DATE AS date, sales
FROM
	(UNPIVOT t1 ON * EXCLUDE (id) INTO NAME date VALUE sales)
ORDER BY ALL;

PIVOT monthly_sales ON MONTH USING SUM(AMOUNT);

FROM (PIVOT monthly_sales ON MONTH USING SUM(AMOUNT));

PIVOT monthly_sales ON MONTH USING SUM(AMOUNT) GROUP BY empid;

PIVOT monthly_sales ON MONTH IN ('1-JAN', '2-FEB', '3-MAR', '4-APR') USING SUM(AMOUNT) GROUP BY empid;

PIVOT monthly_sales ON MONTH IN ('1-JAN', '2-FEB', '3-MAR') USING SUM(AMOUNT) GROUP BY empid;

ALTER TABLE monthly_sales ADD COLUMN status VARCHAR;

UPDATE monthly_sales SET status=CASE WHEN amount >= 10000 THEN 'important' ELSE 'regular' END;

FROM (PIVOT monthly_sales ON MONTH USING SUM(AMOUNT)) ORDER BY ALL;

PIVOT monthly_sales ON MONTH USING SUM(AMOUNT) GROUP BY empid ORDER BY ALL;

FROM (PIVOT monthly_sales ON MONTH USING SUM(AMOUNT) GROUP BY status) ORDER BY ALL;

SELECT *
  FROM monthly_sales
    PIVOT(SUM(amount) FOR MONTH IN ('1-JAN', '2-FEB', '3-MAR', '4-APR') GROUP BY status)
      AS p
  ORDER BY 1;

WITH pivoted_sales AS (PIVOT monthly_sales ON MONTH USING SUM(AMOUNT) GROUP BY empid)
SELECT * FROM pivoted_sales ORDER BY empid DESC;

WITH pivoted_sales AS MATERIALIZED (PIVOT monthly_sales ON MONTH USING SUM(AMOUNT) GROUP BY empid)
SELECT * FROM pivoted_sales ORDER BY empid DESC;

CREATE VIEW v1 AS PIVOT monthly_sales ON MONTH IN ('1-JAN', '2-FEB', '3-MAR', '4-APR') USING SUM(AMOUNT) GROUP BY empid ORDER BY ALL;

CREATE TABLE w(id INT, a INT, b INT, g INT);

INSERT INTO w VALUES (1, 10, NULL, NULL), (2, NULL, 5, 7);

SELECT id, g, n, g_1 FROM (UNPIVOT w ON a, b INTO NAME n VALUE g) ORDER BY ALL;

SELECT id, n, id_1 FROM (UNPIVOT w ON a, b INTO NAME n VALUE id) ORDER BY ALL;

SELECT id, g, n, n_1 FROM (UNPIVOT w ON a, b INTO NAME n VALUE n) ORDER BY ALL;

SELECT id, g, n, g_1 FROM (SELECT * FROM w UNPIVOT INCLUDE NULLS (g FOR n IN (a, b))) ORDER BY ALL;

SELECT id, name, value FROM (UNPIVOT w ON a, b) ORDER BY ALL;

unpivot (select 42 as col1, 'woot' as col2)
    on col1::VARCHAR, col2;

unpivot (select 42 as col1, 'woot' as col2)
    on COLUMNS(*)::VARCHAR;

unpivot (select 42 as col1, 'woot' as col2)
    on (col1 + 100)::VARCHAR, col2;

unpivot (select 42 as col1, 'woot' as col2)
    on (col1 + 100)::VARCHAR AS c, col2;

select * from (select 42 as col1, 'woot' as col2) UNPIVOT ("value" FOR "name" IN (col1::VARCHAR, col2));

FROM (SELECT 42 c1) AS t
UNPIVOT (c1 FOR 'v' IN ((c1, 40 + 2)));

CREATE TABLE unpivot_names(unpivot_names VARCHAR, unpivot_list VARCHAR, unpivot_list_2 VARCHAR, col1 INT, col2 INT, col3 INT);

INSERT INTO unpivot_names VALUES ('unpivot_names', 'unpivot_list', 'unpivot_list_2', 1, 2, 3);

UNPIVOT unpivot_names ON COLUMNS('col*');

create table integers(i integer);

CREATE TABLE test(id BIGINT, metric_1 VARCHAR, value_x VARCHAR, metric_2 VARCHAR, value_q VARCHAR, metric_3 VARCHAR, value_j VARCHAR);

INSERT INTO test VALUES(1,'a','a_value','b','b_value','c','c_value');

INSERT INTO test VALUES(2,'d','d_value','e','e_value','f','f_value');

UNPIVOT test ON (metric_1, value_x), (metric_2, value_q), (metric_3, value_j) INTO NAME metric VALUES metric_value, metric_type;

SELECT column_name, column_type FROM (DESCRIBE unpivot ( select 42) on columns(*));

SELECT column_name, column_type FROM (DESCRIBE unpivot ( select {n : 1 }) on columns(*));

SELECT unpivot_list(1, 2.5), typeof(unpivot_list(1, 2.5));

SELECT unpivot_list(1.2::DECIMAL(2,1), 1.23::DECIMAL(3,2)), typeof(unpivot_list(1.2::DECIMAL(2,1), 1.23::DECIMAL(3,2)));

UNPIVOT (SELECT 1::INTEGER AS i, 2.5::DECIMAL(2,1) AS d)
ON i, d
INTO NAME source_column VALUE value;

unpivot (select cast(columns(*) as varchar) from (select 42 as col1, 'woot' as col2))
    on columns(*);

CREATE TABLE t (
    id INTEGER,
    a INTEGER,
    b INTEGER
);

INSERT INTO t VALUES (1, 10, 20);

CREATE VIEW v AS
SELECT *
FROM t
UNPIVOT (val FOR key IN (a, b));

FROM v;
