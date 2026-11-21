SELECT COALESCE(1, 'hello'::INT);

CREATE TABLE vals AS SELECT * FROM (
	VALUES (1, 'hello'), (NULL, '2'), (3, NULL)
) tbl(a, b);

SELECT COALESCE(a, b::INT) FROM vals;

create table tbl as select case when i%2=0 then null else i end as i from range(10) tbl(i);

select i, coalesce(rowid+i, rowid) from tbl ORDER BY rowid;

select i, rowid, rowid+i, COALESCE(rowid+i, NULL) IS NULL OR rowid+3=6 from tbl ORDER BY rowid;

CREATE TABLE expression_inputs AS
SELECT i, CASE WHEN i % 2 = 0 THEN NULL ELSE i END a,
       CASE WHEN i % 3 = 0 THEN NULL ELSE i + 100 END b,
       CASE WHEN i % 5 = 0 THEN NULL ELSE i + 200 END c
FROM range(70003) t(i);

SELECT count(*) FROM expression_inputs
WHERE coalesce(a, coalesce(b, c), -1) IS DISTINCT FROM
      CASE WHEN a IS NOT NULL THEN a WHEN b IS NOT NULL THEN b WHEN c IS NOT NULL THEN c ELSE -1 END;

WITH actual AS (
    SELECT i FROM expression_inputs
    WHERE (a > 100 OR (b < 300 AND c > 200)) AND (i % 7 = 0 OR i % 11 = 0)
), expected AS (
    SELECT i FROM expression_inputs
    WHERE CASE WHEN a > 100 THEN true WHEN b < 300 THEN c > 200 ELSE false END
      AND CASE WHEN i % 7 = 0 THEN true ELSE i % 11 = 0 END
)
SELECT count(*) FROM (
    (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
    UNION ALL
    (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
);

SELECT count(*) FROM expression_inputs
WHERE coalesce(CASE WHEN a IS NULL THEN NULL ELSE [a] END, [b])
      IS DISTINCT FROM CASE WHEN a IS NULL THEN [b] ELSE [a] END
   OR coalesce(CASE WHEN a IS NULL THEN NULL ELSE {'v': a} END, {'v': b})
      IS DISTINCT FROM {'v': coalesce(a, b)};

SELECT count(*) FROM expression_inputs
WHERE concat(a::VARCHAR, ':', b::VARCHAR, ':', c::VARCHAR) IS DISTINCT FROM
      coalesce(a::VARCHAR, '') || ':' || coalesce(b::VARCHAR, '') || ':' || coalesce(c::VARCHAR, '');

CREATE TABLE truth_inputs AS
WITH inputs AS (SELECT * FROM (VALUES (true), (false), (NULL::BOOLEAN)) t(v))
SELECT a.v a, b.v b, c.v c, d.v d
FROM inputs a, inputs b, inputs c, inputs d, range(101);

SELECT count(*) FROM (
    SELECT *, (a OR b OR c OR d) actual_or, (a AND b AND c AND d) actual_and,
        (CASE WHEN a THEN 1 ELSE 0 END + CASE WHEN b THEN 1 ELSE 0 END +
         CASE WHEN c THEN 1 ELSE 0 END + CASE WHEN d THEN 1 ELSE 0 END) ntrue,
        (CASE WHEN a IS NULL THEN 1 ELSE 0 END + CASE WHEN b IS NULL THEN 1 ELSE 0 END +
         CASE WHEN c IS NULL THEN 1 ELSE 0 END + CASE WHEN d IS NULL THEN 1 ELSE 0 END) nnull
    FROM truth_inputs
) WHERE actual_or IS DISTINCT FROM CASE WHEN ntrue > 0 THEN true WHEN nnull > 0 THEN NULL ELSE false END
     OR actual_and IS DISTINCT FROM CASE WHEN ntrue + nnull < 4 THEN false WHEN nnull > 0 THEN NULL ELSE true END;

PRAGMA disable_optimizer;

PRAGMA enable_optimizer;

SELECT count(*) FROM expression_inputs
WHERE TRY(coalesce(a, ('invalid-' || i::VARCHAR)::BIGINT, b)) IS DISTINCT FROM a;

SELECT count(*) FROM expression_inputs
WHERE list_transform([a, b, c], lambda x: coalesce(x, i)) IS DISTINCT FROM
      [CASE WHEN a IS NULL THEN i ELSE a END,
       CASE WHEN b IS NULL THEN i ELSE b END,
       CASE WHEN c IS NULL THEN i ELSE c END];

DROP TABLE truth_inputs;

DROP TABLE expression_inputs;

SET threads=4;

CREATE TABLE projection_input AS
SELECT i, CASE WHEN i % 7 = 0 THEN NULL ELSE 'long value carried through a projection ' || i::VARCHAR END AS s,
       [i, NULL, i + 1] AS l, {'x': i, 'y': i::VARCHAR} AS r
FROM range(5003) t(i);

WITH p AS MATERIALIZED (
    SELECT s, r, i AS j, l, i AS duplicate FROM projection_input WHERE i % 2 = 1
)
SELECT count(*), sum(j), count(s), bool_and(j = duplicate),
       bool_and(l[1] = j AND l[2] IS NULL AND l[3] = j + 1),
       bool_and(r.x = j AND r.y = j::VARCHAR AND (s IS NOT DISTINCT FROM
           CASE WHEN j % 7 = 0 THEN NULL ELSE 'long value carried through a projection ' || j::VARCHAR END))
FROM p;

WITH p AS MATERIALIZED (SELECT s, i, l, r FROM projection_input WHERE i < 0)
SELECT count(*) FROM p;

WITH p AS MATERIALIZED (
    SELECT s, r, i AS j, l, i AS duplicate FROM projection_input
    WHERE i < 2 OR md5(i::VARCHAR) = ''
)
SELECT count(*), sum(j) FROM p;

PREPARE reference_output AS
WITH p AS MATERIALIZED (SELECT s, l, i, r FROM projection_input WHERE i < $1)
SELECT count(*), coalesce(sum(i), 0), count(s) FROM p;

EXECUTE reference_output(100);

EXECUTE reference_output(0);

EXECUTE reference_output(5003);

WITH RECURSIVE r(i, s) AS (
    SELECT 0, 'long value carried through a recursive projection'
    UNION ALL SELECT i + 1, s FROM r WHERE i < 20
)
SELECT count(*), sum(i), count(DISTINCT s) FROM r;

CREATE TABLE integers(i INTEGER, j INTEGER, k INTEGER);

INSERT INTO integers VALUES (1, 2, 3);

SELECT * EXCLUDE i FROM integers;

SELECT * EXCLUDE (i, j) FROM integers;

SELECT * EXCLUDE (j) FROM integers;

SELECT * EXCLUDE ("J") FROM integers;

SELECT integers.* EXCLUDE (i) FROM integers;

SELECT integers.* EXCLUDE ('i') FROM integers;

SELECT integers.* EXCLUDE (i, j) FROM integers;

SELECT integers.* EXCLUDE (j) FROM integers;

SELECT integers.* EXCLUDE (i, j), * EXCLUDE (i, j), * EXCLUDE (i, k) FROM integers;

SELECT * EXCLUDE (i, j) FROM integers i1, integers i2;

SELECT i1.* EXCLUDE (i, j), i2.* EXCLUDE (i, j, k) FROM integers i1, integers i2;

SELECT i1.* EXCLUDE (i, j), i2.* EXCLUDE (k) FROM integers i1, integers i2;

SELECT * EXCLUDE (i) FROM integers i1 JOIN integers i2 USING (i);

SELECT * EXCLUDE integers.i FROM integers;

SELECT * EXCLUDE (integers.i, integers.j) FROM integers;

SELECT integers.* EXCLUDE (integers.i, integers.j) FROM integers;

SELECT * EXCLUDE ("a.b") FROM (SELECT 1 AS "a.b", 2 AS c);

SELECT * EXCLUDE ("table.with.dot"."column.with.dot") FROM (SELECT 1 AS "column.with.dot", 2 AS c) AS "table.with.dot";

SELECT * EXCLUDE (i1.i, i2.i) FROM integers i1 JOIN integers i2 USING (i);

SELECT * EXCEPT i FROM integers;

SELECT * EXCEPT (i, j) FROM integers;

SELECT * EXCEPT (j) FROM integers;

SELECT * EXCEPT ("J") FROM integers;

SELECT integers.* EXCEPT (i) FROM integers;

SELECT integers.* EXCEPT ('i') FROM integers;

SELECT integers.* EXCEPT (i, j) FROM integers;

SELECT integers.* EXCEPT (j) FROM integers;

SELECT integers.* EXCEPT (i, j), * EXCEPT (i, j), * EXCEPT (i, k) FROM integers;

SELECT * EXCEPT (i, j) FROM integers i1, integers i2;

SELECT i1.* EXCEPT (i, j), i2.* EXCEPT (i, j, k) FROM integers i1, integers i2;

SELECT i1.* EXCEPT (i, j), i2.* EXCEPT (k) FROM integers i1, integers i2;

SELECT * EXCEPT (i) FROM integers i1 JOIN integers i2 USING (i);

SELECT * EXCEPT integers.i FROM integers;

SELECT * EXCEPT (integers.i, integers.j) FROM integers;

SELECT integers.* EXCEPT (integers.i, integers.j) FROM integers;

SELECT * EXCEPT (i1.i, i2.i) FROM integers i1 JOIN integers i2 USING (i);

SELECT integers.* EXCLUDE (i, j), * EXCEPT (i, j), * EXCLUDE (i, k) FROM integers;

CREATE TABLE integers(col1 INTEGER, col2 INTEGER, k INTEGER);

SELECT COLUMNS(lambda x: x LIKE 'col%') FROM integers;

SELECT * LIKE 'col%' FROM integers;

SELECT * NOT LIKE 'col%' FROM integers;

SELECT * ILIKE 'COL%' FROM integers;

SELECT * SIMILAR TO '.*col.*' FROM integers;

SELECT * EXCLUDE (col1) SIMILAR TO '.*col.*' FROM integers;

SELECT c2, c1 FROM (
SELECT * SIMILAR TO 'number(\d+)' AS 'c\1' FROM (SELECT 1 AS number1, 2 AS number2, 3 AS end)
);

SELECT val FROM (
SELECT * NOT LIKE '%number%' AS val FROM (SELECT 1 AS number1, 2 AS number2, 3 AS end)
);

SELECT * LIKE '\_%' ESCAPE '\' AS val FROM (SELECT 1 AS number1, 2 AS _number2);

SELECT * NOT LIKE '\_%' ESCAPE '\' AS val FROM (SELECT 1 AS number1, 2 AS _number2);

SELECT * ILIKE '\_NUM%' ESCAPE '\' AS val FROM (SELECT 1 AS number1, 2 AS _number2);

SELECT * NOT ILIKE '\_NUM%' ESCAPE '\' AS val FROM (SELECT 1 AS number1, 2 AS _number2);

CREATE TABLE t1(id INTEGER, col1 INTEGER, col2 INTEGER);

INSERT INTO t1 VALUES (1, 10, 20);

CREATE TABLE t2(name VARCHAR, category VARCHAR, col2 INTEGER);

INSERT INTO t2 VALUES ('foo', 'bar', 30);

SELECT t1.* LIKE 'col%' FROM t1, t2;

SELECT t2.* LIKE 'col%' FROM t1, t2;

SELECT t1.* LIKE 'col%', t2.* LIKE 'col%' FROM t1, t2;

SELECT renamed_col FROM (SELECT * RENAME i AS renamed_col FROM integers);

SELECT renamed_col FROM (SELECT COLUMNS(* RENAME i AS renamed_col) FROM integers);

SELECT renamed_col FROM (SELECT * RENAME integers.i AS renamed_col FROM integers);

SELECT renamed_col FROM (SELECT integers.* RENAME integers.i AS renamed_col FROM integers);

SELECT d, c FROM (SELECT * RENAME ("a.b" AS d) FROM (SELECT 1 AS "a.b", 2 AS c));

SELECT d, c FROM (SELECT * RENAME ("table.with.dot"."column.with.dot" AS d) FROM (SELECT 1 AS "column.with.dot", 2 AS c) AS "table.with.dot");

SELECT r1, r2 FROM (SELECT * RENAME (integers.i AS r1, j AS r2) FROM integers);

SELECT r1, r2 FROM (SELECT * RENAME (integers.i AS r1, j AS r2,) FROM integers);

SELECT i FROM (SELECT * EXCLUDE (i) RENAME (j AS i) FROM integers);

SELECT r FROM (SELECT struct.* RENAME (i AS r) FROM (SELECT {'i': 42} AS struct));

SELECT new_col FROM (SELECT * RENAME (i AS new_col) FROM integers i1 JOIN integers i2 USING (i));

SELECT new_col, new_col2 FROM (SELECT * RENAME (i1.i AS new_col, i1.j AS new_col2) FROM integers i1 JOIN integers i2 USING (i));

SELECT new_col FROM (SELECT * RENAME (i AS new_col) FROM integers i1 LEFT JOIN integers i2 USING (i));

SELECT new_col FROM (SELECT * RENAME (i1.i AS new_col) FROM integers i1 FULL OUTER JOIN integers i2 USING (i));

SELECT * REPLACE i+100 AS i FROM integers;

SELECT * EXCLUDE (j, k) REPLACE (i+100 AS i), * EXCLUDE (j) REPLACE (i+100 AS i), * EXCLUDE (j, k) REPLACE (i+101 AS i) FROM integers;

SELECT * REPLACE (i+100 AS i, j+200 AS "J") FROM integers;

SELECT integers.* REPLACE (i+100 AS i) FROM integers;

CREATE TABLE test_star(id INTEGER, col1 VARCHAR, col2 VARCHAR, col3 INTEGER);

INSERT INTO test_star VALUES (1, 'val1', 'val2', 42);

SELECT test_star.* REPLACE ('computed: ' || (id * 2)::VARCHAR AS col1) FROM test_star;

SELECT test_star.* EXCLUDE (col2) REPLACE (id * 2 AS col1) RENAME (col3 AS final3) FROM test_star;

SELECT test_star.* EXCLUDE (col2) REPLACE ('replaced: ' || col3::VARCHAR AS col1) RENAME (id AS renamed_id, col3 AS final3) FROM test_star;

CREATE TABLE t(ab INT, b INT, bc INT);

SELECT column_name FROM (DESCRIBE SELECT * SIMILAR TO 'b' FROM t);

SELECT column_name FROM (DESCRIBE SELECT * SIMILAR TO 'a|b' FROM t);

SELECT column_name FROM (DESCRIBE SELECT * SIMILAR TO 'b.*' FROM t) ORDER BY 1;

SELECT column_name FROM (DESCRIBE SELECT regexp_full_match(*, 'b') FROM t);

CREATE TABLE test(a STRUCT(i INT, j INT));

INSERT INTO test VALUES ({i: 1, j: 2});

SELECT a.* FROM test;

SELECT a.* EXCLUDE(j) FROM test;

SELECT a.* EXCLUDE(i) FROM test;

SELECT a.* REPLACE(a.i + 3 AS i) FROM test;

CREATE TABLE a(i row(t int));

CREATE TABLE b(i row(t int));

SELECT COLUMNS(* REPLACE a AS a) FROM range(1) t1(a) NATURAL JOIN range(1) t2(a);

SELECT * FROM range(1) t1(a) NATURAL JOIN range(1) t2(a);

SELECT COLUMNS(* REPLACE a AS a) FROM range(1) t1(a) JOIN range(1) t2(a) USING (a);

SELECT COLUMNS(* REPLACE (a + 1 AS a)) FROM range(1) t1(a) NATURAL JOIN range(1) t2(a);

SELECT COLUMNS(* REPLACE (a * 2 AS a)) FROM range(3) t1(a) NATURAL JOIN range(3) t2(a);

SELECT COLUMNS(* REPLACE (a + 100 AS a)) FROM (SELECT 1 as a, 2 as b) t1 NATURAL JOIN (SELECT 1 as a, 3 as c) t2;

SELECT COLUMNS(* REPLACE (b + 10 AS b)) FROM (SELECT 1 as a, 2 as b) t1 NATURAL JOIN (SELECT 1 as a, 3 as c) t2;

SELECT COLUMNS(* REPLACE (a AS a)) FROM range(1) t1(a) NATURAL JOIN range(1) t2(a) NATURAL JOIN range(1) t3(a);

SELECT COLUMNS(* REPLACE (a + 1 AS a)) FROM range(2) t1(a) NATURAL JOIN range(2) t2(a) NATURAL JOIN range(2) t3(a);

SELECT COLUMNS(* RENAME a AS b) FROM range(1) t1(a) NATURAL JOIN range(1) t2(a);

CREATE TABLE test_t1 AS SELECT 1 as a, 2 as b, 3 as c;

CREATE TABLE test_t2 AS SELECT 1 as a, 4 as d, 5 as e;

SELECT COLUMNS(* REPLACE (a + 10 AS a, b + 20 AS b)) FROM test_t1 NATURAL JOIN test_t2;

SELECT COLUMNS(* REPLACE (concat(a::VARCHAR, '_joined') AS a)) FROM test_t1 NATURAL JOIN test_t2;

DROP TABLE test_t1;

DROP TABLE test_t2;

DROP TABLE integers;

CREATE TABLE exprtest (a INTEGER, b INTEGER);

INSERT INTO exprtest VALUES (42, 10), (43, 100), (NULL, 1), (45, -1);

SELECT * FROM exprtest;

SELECT a FROM exprtest WHERE a BETWEEN 43 AND 44;

SELECT a FROM exprtest WHERE a NOT BETWEEN 43 AND 44;

SELECT a FROM exprtest WHERE a BETWEEN b AND 44;

SELECT CASE a WHEN 42 THEN 100 WHEN 43 THEN 200 ELSE 300 END FROM exprtest;

SELECT CASE WHEN a = 42 THEN 100 WHEN a = 43 THEN 200 ELSE 300 END FROM exprtest;

SELECT CASE WHEN a = 42 THEN 100 WHEN a = 43 THEN 200 END FROM exprtest;

SELECT ABS(1), ABS(-1), ABS(NULL);

SELECT ABS(b) FROM exprtest;

CREATE TABLE intest (a INTEGER, b INTEGER, c INTEGER);

INSERT INTO intest VALUES (42, 42, 42), (43, 42, 42), (44, 41, 44);

SELECT * FROM intest WHERE a IN (42, 43);

SELECT a IN (42, 43) FROM intest;

SELECT * FROM intest WHERE a IN (86, 103, 162);

SELECT * FROM intest WHERE a IN (NULL, NULL, NULL, NULL);

SELECT * FROM intest WHERE a IN (b);

SELECT * FROM intest WHERE a IN (b, c);

SELECT * FROM intest WHERE a IN (43, b) ORDER BY 1;

SELECT * FROM intest WHERE a NOT IN (42, 43);

SELECT * FROM intest WHERE a NOT IN (86, 103, 162) ORDER BY 1;

SELECT * FROM intest WHERE a NOT IN (NULL, NULL);

SELECT * FROM intest WHERE a NOT IN (b) ORDER BY 1;

SELECT * FROM intest WHERE a NOT IN (b, c);

SELECT * FROM intest WHERE a NOT IN (43, b);

SELECT * FROM intest WHERE NULL IN ('a', 'b');

SELECT * FROM intest WHERE NULL NOT IN ('a', 'b');

CREATE TABLE strtest (a INTEGER, b VARCHAR);

INSERT INTO strtest VALUES (1, 'a'), (2, 'h'), (3, 'd');

INSERT INTO strtest VALUES (4, NULL);

SELECT a FROM strtest WHERE b = 'a';

SELECT a FROM strtest WHERE b <> 'a';

SELECT a FROM strtest WHERE b < 'h';

SELECT a FROM strtest WHERE b <= 'h';

SELECT a FROM strtest WHERE b > 'h';

SELECT a FROM strtest WHERE b >= 'h';

create table a(i integer);

insert into a values (42), (44);

SELECT rowid, * FROM a;

SELECT rowid+1 FROM a WHERE CASE WHEN i=42 THEN rowid=0 ELSE rowid=1 END;

SELECT * FROM a;

create table b(rowid integer);

insert into b values (42), (22);

SELECT * FROM b ORDER BY 1;

SELECT rowid FROM b ORDER BY 1;

UPDATE b SET rowid=5;

INSERT INTO b (rowid) VALUES (5);

SELECT * FROM b;

insert into a values (42);

SELECT rowid + 1, rowid - 1, rowid + rowid, i + rowid FROM a;

SELECT -rowid, +rowid, abs(rowid) FROM a;

SELECT rowid BETWEEN -1 AND 1, 0 BETWEEN rowid AND 1, 1 BETWEEN -3 AND rowid FROM a;

SELECT rowid < i, rowid = NULL, rowid = i, rowid <> 0 FROM a;

SELECT SUM(rowid), MIN(rowid), MAX(rowid), COUNT(rowid), FIRST(rowid) FROM a;

SELECT SUM(rowid), MIN(rowid), MAX(rowid), COUNT(rowid), LAST(rowid) FROM a;

SELECT COUNT(*) FROM a;

SELECT SUM(rowid), MIN(rowid), MAX(rowid), COUNT(rowid), FIRST(rowid), LAST(rowid) FROM a GROUP BY i;

SELECT SUM(i) FROM a GROUP BY rowid;

SELECT * FROM a, a a2 WHERE a.rowid=a2.rowid;

SELECT * FROM a, a a2 WHERE a.rowid<>a2.rowid;

SELECT * FROM a, a a2 WHERE a.rowid>=a2.rowid;

SELECT * FROM a ORDER BY rowid;

INSERT INTO a SELECT rowid FROM a;

SELECT * FROM a ORDER BY 1;

UPDATE a SET i=rowid;

SELECT * FROM a WHERE rowid=0;

SELECT * FROM a WHERE rowid BETWEEN -100 AND 100 ORDER BY 1;

SELECT * FROM a WHERE rowid=0 OR rowid=1;

SELECT row_number() OVER (PARTITION BY rowid) FROM a ORDER BY rowid;

SELECT row_number() OVER (ORDER BY rowid) FROM a ORDER BY rowid;

SELECT row_number() OVER (ORDER BY rowid DESC) FROM a ORDER BY rowid;

SELECT (SELECT rowid FROM a LIMIT 1);

SELECT 0 IN (SELECT rowid FROM a);

SELECT EXISTS(SELECT rowid FROM a);

SELECT (SELECT a2.rowid FROM a a2 WHERE a.rowid=a2.rowid) FROM a;

SELECT a.rowid IN (SELECT a2.rowid FROM a a2 WHERE a.rowid>=a2.rowid) FROM a;

SELECT EXISTS(SELECT a2.rowid FROM a a2 WHERE a.rowid>=a2.rowid) FROM a;

SELECT 42;

SELECT 42 + 1;

SELECT 2 * (42 + 1), 35 - 2;

SELECT 'hello';

SELECT cast('3' AS INTEGER);

SELECT cast(3 AS VARCHAR);

SELECT CASE WHEN 43 > 33 THEN 43 ELSE 33 END;

SELECT 1 AS a, a * 2;

SELECT + CASE WHEN NOT + 84 NOT BETWEEN - 78 + 98 * 51 AND - ( ( - 28 ) ) * COUNT ( * ) + + - 65 THEN NULL ELSE 16 // + 34 + + - 98 END // + 70 - ( - - CASE - COALESCE ( + 73, + - 66 * - 89 * - 72 ) WHEN COUNT ( * ) // + 4 * CAST ( - - 18 AS INTEGER ) + + + COUNT ( * ) - - 88 THEN NULL WHEN 92 THEN NULL ELSE COUNT ( * ) END ) AS col0;

CREATE TABLE a (i integer, j integer);

SELECT i, j FROM a;

INSERT INTO a VALUES (42, 84);

SELECT x, y FROM a i1(x, y);

CREATE TABLE test (a INTEGER, b INTEGER);

INSERT INTO test VALUES (11, 22), (12, 21), (13, 22);

SELECT a, b FROM test;

SELECT a + 2, b FROM test WHERE a = 11;

SELECT a + 2, b FROM test WHERE a = 12;

SELECT cast(a AS VARCHAR) FROM test;

SELECT cast(cast(a AS VARCHAR) as INTEGER) FROM test;

SELECT * FROM test;

SELECT test.* FROM test;

SELECT t.* FROM test t;

create table r4 (i int, j int);

insert into r4 (i, j) values (1,1), (1,2), (1,3), (1,4), (1,5);

select t1.i, t1.j as a, t2.j as b from r4 t1 inner join r4 t2 using(i,j) ORDER BY a;

select t1.i, t1.j as a, t2.j as b from r4 t1 inner join r4 t2 on t1.i=t2.i and t1.j=t2.j ORDER BY a;

select t1.*, t2.j b from r4 t1 inner join r4 t2 using(i,j) ORDER BY t1.j;

select t1.*, t2.j b from r4 t1 inner join r4 t2 on t1.i=t2.i and t1.j=t2.j ORDER BY t1.j;

SET default_null_order='nulls_first';

(VALUES (1, 3), (2, 4));

SELECT * FROM (VALUES (NULL, NULL), (3, 4), (3, 7)) v1;

SELECT * FROM (VALUES (1, 2, 3), (1, 2, 3)) v1;

SELECT * FROM (VALUES (1 + 1, 2, 3), (1 + 3, 2, 3)) v1;

SELECT * FROM (VALUES ((SELECT 42), 2, 3), (1 + 3,2,3)) v1;

INSERT INTO test VALUES (1, 2), (3, 4);

SELECT * FROM (VALUES ((SELECT MIN(a) FROM test), 2, 3), ((SELECT MAX(b) FROM test), 2, 3)) v1;

SELECT * FROM (VALUES (DATE '1992-09-20', 3), (NULL, NULL)) v1;

SELECT * FROM (VALUES (NULL, NULL)) v1;

SELECT * FROM (VALUES (NULL, NULL), (3, 4)) v1;

SELECT * FROM (VALUES (3), ('42')) v1;

SELECT typeof(x) FROM (VALUES (DATE '1992-01-01'), ('1992-01-01')) v1(x) LIMIT 1;

SELECT * FROM (VALUES (NULL), ('hello')) v1;

CREATE TABLE varchars(v VARCHAR);

INSERT INTO varchars VALUES (1), ('hello'), (DEFAULT);

SELECT * FROM varchars ORDER BY 1;
