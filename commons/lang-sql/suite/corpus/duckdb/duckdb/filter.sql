SET threads=1;

CREATE TABLE t AS
SELECT i AS id,
       CASE WHEN i%101=0 THEN NULL
            WHEN i<131072 THEN ['AIR','AIR REG'][i%2+1]
            ELSE ['AIR','AIR REG','MAIL','RAIL','SHIP','TRUCK','FOB'][i%7+1] END AS s,
       (i%17)::INTEGER AS k
FROM range(300007) r(i);

CHECKPOINT;

SELECT count(*) FROM (
    (SELECT id FROM t WHERE s IN ('AIR','AIR REG')
     EXCEPT ALL
     SELECT i FROM range(300007) r(i) WHERE i%101<>0 AND (i<131072 OR i%7<2))
    UNION ALL
    (SELECT i FROM range(300007) r(i) WHERE i%101<>0 AND (i<131072 OR i%7<2)
     EXCEPT ALL
     SELECT id FROM t WHERE s IN ('AIR','AIR REG'))
);

SELECT count(*) FROM (
    (SELECT id FROM t WHERE (s='AIR' OR s='AIR REG') AND id>=80000 AND id<280000
     EXCEPT ALL
     SELECT i FROM range(80000,280000) r(i) WHERE i%101<>0 AND (i<131072 OR i%7<2))
    UNION ALL
    (SELECT i FROM range(80000,280000) r(i) WHERE i%101<>0 AND (i<131072 OR i%7<2)
     EXCEPT ALL
     SELECT id FROM t WHERE (s='AIR' OR s='AIR REG') AND id>=80000 AND id<280000)
);

SELECT count(*) FROM t WHERE s IN ('absent','missing');

SELECT count(*) = (SELECT count(*) FROM range(300007) r(i) WHERE i%101<>0)
FROM t WHERE s IN ('AIR','AIR REG','MAIL','RAIL','SHIP','TRUCK','FOB');

SELECT count(*) = (SELECT count(*) FROM range(300007) r(i) WHERE i%17=2 OR i%17=11)
FROM t WHERE k IN (2,11);

PREPARE selected AS SELECT count(*), sum(id) FROM t WHERE s IN ('AIR','AIR REG');

EXECUTE selected;

UPDATE t SET s=NULL WHERE id>=250000;

DEALLOCATE selected;

DROP TABLE t;

SET max_execution_time=20000;

SELECT ((((((((((((((((((((((((((((((1 BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2)::INT BETWEEN 0 AND 2;

SELECT 1 BETWEEN 0 AND 2;

CREATE TABLE booleans AS
SELECT i AS id,
       CASE WHEN i % 2 = 0 THEN i::DOUBLE ELSE 'Infinity'::DOUBLE END AS d,
       CASE WHEN i % 2 = 0 THEN 'yes' ELSE 'no' END AS s,
       CASE WHEN i % 5 = 0 THEN NULL WHEN i % 2 = 0 THEN i::DOUBLE ELSE 'Infinity'::DOUBLE END AS nd,
       CASE WHEN i % 7 = 0 THEN NULL WHEN i % 2 = 0 THEN 'yes' ELSE 'no' END AS ns
FROM range(4099) t(i);

SELECT count(*), sum(id) FROM booleans WHERE isfinite(d);

SELECT count(*), sum(id) FROM booleans WHERE contains(s, 'y');

SELECT count(*), sum(id) FROM booleans WHERE isfinite(nd);

SELECT count(*), sum(id) FROM booleans WHERE contains(ns, 'y');

SELECT count(*), sum(id) FROM booleans WHERE isfinite(nd) OR contains(ns, 'y');

SELECT count(*), sum(id) FROM booleans WHERE id % 3 = 0 AND isfinite(nd);

SELECT sum(CASE WHEN isfinite(nd) THEN id ELSE -id END) FROM booleans;

SELECT count(*) FILTER (WHERE isfinite(d)),
       sum(id) FILTER (WHERE contains(s, 'y')),
       count(*) FILTER (WHERE isfinite(nd)),
       sum(id) FILTER (WHERE contains(ns, 'y'))
FROM booleans;

SELECT count(DISTINCT id % 4) FILTER (WHERE isfinite(d)) FROM booleans;

SELECT id % 3 AS g, count(*) FILTER (WHERE isfinite(d)), sum(id) FILTER (WHERE contains(s, 'y'))
FROM booleans
GROUP BY g
ORDER BY g;

SELECT count(*), sum(i) FROM dense_selection WHERE v < 0;

SELECT count(*), sum(i) FROM dense_selection WHERE v = 7;

SELECT count(*), sum(i) FROM dense_selection WHERE v BETWEEN -13 AND 29;

SELECT count(*), sum(i) FROM dense_selection WHERE v < -25 OR v > 31;

SELECT count(*), sum(i) FROM dense_selection WHERE v < 0 AND i % 7 <> 0;

SELECT sum(CASE WHEN v < 0 THEN i ELSE -i END) FROM dense_selection;

UPDATE dense_selection SET v = NULL WHERE i % 7 = 0;

DROP TABLE dense_selection;

SET force_compression='rle';

CREATE TABLE runs AS SELECT (i//10)::INTEGER AS v FROM range(100000) t(i);

SELECT count(*) > 0 FROM pragma_storage_info('runs') WHERE column_name='v' AND compression='RLE';

SELECT count(*) FROM runs WHERE v BETWEEN 1000 AND 4000 OR v BETWEEN 6000 AND 9000;

CREATE TABLE integers AS SELECT a FROM generate_series(0, 9999, 1) tbl(a), generate_series(0, 9, 1) tbl2(b);

SELECT COUNT(*) FROM integers WHERE a<5;

SELECT COUNT(*) FROM (SELECT * FROM integers WHERE (a>1 AND a<10) OR a>9995) tbl(a) WHERE a<5;

SELECT COUNT(*) FROM (SELECT * FROM (SELECT * FROM integers WHERE (a <> 3 AND a<50) OR (a > 9995)) WHERE a>1 AND a<20) tbl(a) WHERE a<5;

SET force_compression='dictionary';

SET disabled_optimizers='filter_pushdown,compressed_materialization';

CREATE TABLE t (id INTEGER, s VARCHAR);

INSERT INTO t SELECT i, 'val_' || (i % 1000) FROM range(300000) tbl(i);

SELECT DISTINCT compression FROM pragma_storage_info('t')
WHERE segment_type ILIKE 'VARCHAR' AND compression NOT IN ('Dictionary', 'Uncompressed');

SELECT s FROM t WHERE id % 64 = 0 ORDER BY id LIMIT 6;

SELECT count(*) FROM t WHERE id % 64 = 0;

SELECT s, count(*) FROM t WHERE id % 100 = 7 GROUP BY s ORDER BY s LIMIT 5;

SELECT count(*), count(DISTINCT s) FROM t WHERE id % 100 = 7;

SELECT id, s FROM t WHERE id % 100 = 7 ORDER BY id LIMIT 5;

SELECT count(*) FROM (
    SELECT id, s FROM t WHERE id % 100 = 7
    EXCEPT
    SELECT id, s FROM t WHERE id % 100 = 7
);

SELECT count(*), sum(id) FROM t WHERE id % 100 = 7;

SET disabled_optimizers='';

PRAGMA disable_optimizer;

CREATE TABLE null_inputs AS
SELECT i,
       CASE WHEN i%4<>0 THEN i END AS n,
       CASE WHEN i%4<>0 THEN repeat('value', 5) || i::VARCHAR END AS s,
       CASE WHEN i%4<>0 THEN [CASE WHEN i%7<>0 THEN i END] END AS l,
       CASE WHEN i%4<>0 THEN {'v': CASE WHEN i%7<>0 THEN i END} END AS st,
       CASE WHEN i%4<>0 THEN map(['v'], [CASE WHEN i%7<>0 THEN i END]) END AS m
FROM range(5003) t(i);

SELECT count(*), sum(i) FROM null_inputs
WHERE i%5=2 AND NULL::INTEGER IS NULL AND 42 IS NOT NULL;

SELECT count(*) FROM null_inputs WHERE 42 IS NULL OR NULL::INTEGER IS NOT NULL;

SELECT count(*) FROM null_inputs WHERE i<0 AND CAST(s AS INTEGER) IS NULL;

RESET debug_verify_vector;

SELECT count(*), sum(i) FROM null_inputs
WHERE TRY_CAST(s AS INTEGER) IS NULL;

CREATE SEQUENCE null_selection_seq;

SELECT count(*) FROM range(5003) WHERE nextval('null_selection_seq') IS NOT NULL;

SELECT currval('null_selection_seq');

SELECT count(*) FROM range(5003) WHERE nextval('null_selection_seq') IS NULL;

WITH actual AS (
    SELECT true AS is_null, n FROM test_vector_types(NULL::INTEGER, all_flat=false) t(n) WHERE n IS NULL
    UNION ALL
    SELECT false AS is_null, n FROM test_vector_types(NULL::INTEGER, all_flat=false) t(n) WHERE n IS NOT NULL
), expected AS (
    SELECT n IS NULL AS is_null, n FROM test_vector_types(NULL::INTEGER, all_flat=true) t(n)
)
SELECT count(*) FROM (
    (TABLE actual EXCEPT ALL TABLE expected)
    UNION ALL
    (TABLE expected EXCEPT ALL TABLE actual)
);

PRAGMA enable_optimizer;

DROP TABLE null_inputs;

DROP SEQUENCE null_selection_seq;

CREATE TABLE null_runs AS
SELECT i, CASE WHEN i%7<>0 THEN i%31 END AS n FROM range(20003) t(i);

WITH actual AS (
    SELECT i FROM null_runs WHERE n IS NULL OR (n IS NOT NULL AND n%3=0)
), expected AS (
    SELECT i FROM null_runs WHERE i%7=0 OR (i%7<>0 AND (i%31)%3=0)
)
SELECT count(*) FROM (
    (TABLE actual EXCEPT ALL TABLE expected)
    UNION ALL
    (TABLE expected EXCEPT ALL TABLE actual)
);

SELECT count(*) FROM null_runs WHERE n IS NULL;

SELECT count(*) FROM null_runs WHERE n IS NOT NULL;

CREATE TABLE non_null_runs AS SELECT i AS n FROM range(20003) t(i);

SELECT count(*), sum(n) FROM non_null_runs WHERE NULLIF(n,7) IS NOT NULL;

SELECT count(*), sum(n) FROM non_null_runs WHERE NULLIF(n,7) IS NULL;

SET VARIABLE initial_database = current_database();

USE fragments;

CREATE TABLE runs AS SELECT i AS id,((i//997)%3)::BIGINT k FROM range(122891) t(i);

SELECT bool_or(compression='RLE'),bool_and(compression IN ('RLE','Constant')) FROM pragma_storage_info('runs') WHERE column_name='k' AND segment_type<>'VALIDITY';

SELECT count(*),sum(id),sum(k) FROM runs WHERE k=1;

SELECT count(*),sum(id),sum(k) FROM runs WHERE k>=1;

SELECT count(*),sum(id),sum(k) FROM runs WHERE k=0 OR k=2;

SELECT count(*),sum(id),sum(k) FROM runs WHERE id%7=0 AND k=1;

SELECT count(*),sum(id),sum(k) FROM runs WHERE id>=1001 AND id<122883 AND k=2;

SELECT count(*),sum(id),sum(k) FROM runs JOIN (VALUES (2::BIGINT)) b(k) USING(k);

SET schema = getvariable('initial_database');

DETACH fragments;

RESET force_compression;

RESET VARIABLE initial_database;

CREATE TABLE integers(i INTEGER);

INSERT INTO integers VALUES (1), (2), (3), (NULL);

SELECT i % 2 AS k FROM integers WHERE k<>0;

SELECT i % 2 AS i FROM integers WHERE i<>0;

SELECT i % 2 AS k FROM integers WHERE integers.i<>0;

SELECT i % 2 AS k FROM integers WHERE k=k;

SELECT sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL)
FROM (VALUES (1, 10, 100), (2, NULL, 200), (3, 30, NULL)) v(x, a, b);

SELECT coalesce(sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL), 0)
FROM (VALUES (1, 10, 100), (2, NULL, 200), (3, 30, NULL)) v(x, a, b);

SELECT sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) OVER ()
FROM (VALUES (1, 10, 100), (2, NULL, 200), (3, 30, NULL)) v(x, a, b);

SELECT g, sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) AS s
FROM (VALUES (1, 1000, NULL, 1), (1, 1, 1, 1), (2, 100, 1, 1)) v(g, x, a, b)
GROUP BY g
ORDER BY sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL);

SELECT DISTINCT ON (sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL)) g,
       sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) AS s
FROM (VALUES (1, 1, 1, NULL), (1, 1, NULL, 1), (2, 1, 1, 1), (2, 1, NULL, NULL)) v(g, x, a, b)
GROUP BY g
ORDER BY sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) DESC, g;

SELECT g, sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) AS s
FROM (VALUES (1, 1, 1, NULL), (1, 1, NULL, 1), (2, 1, 1, 1), (2, 1, NULL, NULL)) v(g, x, a, b)
GROUP BY g
HAVING sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) > 0
ORDER BY g;

SELECT g, x
FROM (VALUES (1, 1, 1, NULL), (1, 1, NULL, 1), (2, 1, 1, 1), (2, 1, NULL, NULL)) v(g, x, a, b)
QUALIFY sum(x) FILTER (WHERE COLUMNS(*) IS NOT NULL) OVER (PARTITION BY g) > 0
ORDER BY g, x;

CREATE TABLE integers(a INTEGER, b INTEGER);

INSERT INTO integers VALUES (2, 12);

SELECT * FROM integers WHERE 2=2;

SELECT * FROM integers WHERE 2=3;

SELECT * FROM integers WHERE 2<>3;

SELECT * FROM integers WHERE 2<>2;

SELECT * FROM integers WHERE 2>1;

SELECT * FROM integers WHERE 2>2;

SELECT * FROM integers WHERE 2>=2;

SELECT * FROM integers WHERE 2>=3;

SELECT * FROM integers WHERE 2<3;

SELECT * FROM integers WHERE 2<2;

SELECT * FROM integers WHERE 2<=2;

SELECT * FROM integers WHERE 2<=1;

SELECT a=NULL FROM integers;

SELECT NULL=a FROM integers;

SELECT * FROM integers WHERE 2 IN (2, 3, 4, 5);

SELECT * FROM integers WHERE 2 NOT IN (2, 3, 4, 5);

SELECT * FROM integers WHERE 2 IN (((1*2)+(1*0))*1, 3, 4, 5);

SELECT * FROM integers WHERE 2 IN ((1+1)*2, 3, 4, 5);

SELECT CASE WHEN 1 THEN 13 ELSE 12 END;

SELECT * FROM integers WHERE CASE WHEN 2=2 THEN true ELSE false END;

SELECT * FROM integers WHERE CASE WHEN 2=3 THEN true ELSE false END;

CREATE TABLE t0(c3 JSON);

INSERT INTO t0 VALUES (NULL);

SELECT 'x'::BLOB AS c0 UNION ALL SELECT c3 FROM t0 ORDER BY c0 LIMIT 1;

PREPARE const_eq AS
SELECT count(*) FROM range(6) tbl(i) WHERE ?::INTEGER = ?::INTEGER;

EXECUTE const_eq(1, 1);

EXECUTE const_eq(1, 2);

PREPARE const_is_not_distinct AS
SELECT count(*) FROM range(6) tbl(i) WHERE ?::INTEGER IS NOT DISTINCT FROM ?::INTEGER;

EXECUTE const_is_not_distinct(NULL, NULL);

EXECUTE const_is_not_distinct(1, NULL);

CREATE TABLE dict_select(
	id INTEGER,
	s VARCHAR
);

SET debug_verify_vector='dictionary_expression';

INSERT INTO dict_select VALUES
	(1, 'duck'),
	(2, 'goose'),
	(3, NULL),
	(4, 'duck'),
	(5, 'swan'),
	(6, 'duck');

PREPARE dict_eq AS
SELECT id FROM dict_select WHERE s = ?::VARCHAR ORDER BY id;

EXECUTE dict_eq('duck');

EXECUTE dict_eq('goose');

PREPARE dict_is_not_distinct AS
SELECT id FROM dict_select WHERE s IS NOT DISTINCT FROM ?::VARCHAR ORDER BY id;

EXECUTE dict_is_not_distinct(NULL);

EXECUTE dict_is_not_distinct('duck');

PREPARE dict_between AS
SELECT id FROM dict_select WHERE s BETWEEN ?::VARCHAR AND ?::VARCHAR ORDER BY id;

EXECUTE dict_between('duck', 'goose');

SET debug_verify_vector='none';

SELECT current_setting('binary_as_string')::BOOLEAN;

CREATE TABLE t(c1 VARCHAR);

INSERT INTO t VALUES ('Jd*q^c'),(''),('x');

SELECT count(*) FROM t WHERE c1 ILIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END);

SELECT c1, (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END) AS case_value, c1 ILIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END) AS predicate FROM t;

SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN true THEN 'x' ELSE 'other' END);

SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN 'other' ELSE 'x' END);

SELECT count(*) FROM t WHERE c1 LIKE (CASE CAST(NULL AS BLOB) WHEN NULL THEN c1 END);

SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN c1 END);

SELECT count(*) FROM t WHERE c1 ILIKE (CASE WHEN false THEN c1 ELSE NULL END);

SELECT count(*) FROM t WHERE c1 ILIKE NULL;

SELECT count(*) FROM t WHERE c1 NOT ILIKE NULL;

SELECT count(*) FROM t WHERE c1 LIKE NULL;

SELECT count(*) FROM t WHERE c1 NOT LIKE NULL;

SELECT 'x' LIKE NULL, 'x' NOT LIKE NULL, 'x' ILIKE NULL, 'x' NOT ILIKE NULL, NULL LIKE NULL, NULL ILIKE NULL;

SET default_null_order='nulls_first';

INSERT INTO integers VALUES (1, 10), (2, 12), (3, 14), (4, 16), (5, NULL), (NULL, NULL);

SELECT * FROM integers WHERE TRUE ORDER BY 1;

SELECT * FROM integers WHERE FALSE ORDER BY 1;

SELECT * FROM integers WHERE NULL ORDER BY 1;

SELECT * FROM integers WHERE a=2 AND a=2;

SELECT * FROM integers WHERE a=2 AND a>0;

SELECT * FROM integers WHERE a>0 AND a=2;

SELECT * FROM integers WHERE a=2 AND a<4;

SELECT * FROM integers WHERE a<4 AND a=2;

SELECT * FROM integers WHERE a=2 AND a<=2;

SELECT * FROM integers WHERE a=2 AND a>=2;

SELECT * FROM integers WHERE a>2 AND a>4;

SELECT * FROM integers WHERE a>4 AND a>2;

SELECT * FROM integers WHERE a>4 AND a>=4;

SELECT * FROM integers WHERE a>=4 AND a>4;

SELECT * FROM integers WHERE a<2 AND a<4;

SELECT * FROM integers WHERE a<4 AND a<2;

SELECT * FROM integers WHERE a<2 AND a<=2;

SELECT * FROM integers WHERE a<=2 AND a<2;

SELECT * FROM integers WHERE a<2 AND a<>3;

SELECT * FROM integers WHERE a<=1 AND a<>3;

SELECT * FROM integers WHERE a>4 AND a<>2;

SELECT * FROM integers WHERE a>=5 AND a<>2;

SELECT * FROM integers WHERE a>=4 AND a<>4 AND a<>4;

SELECT * FROM integers WHERE a<3 AND a<4 AND a<5 AND a<10 AND a<2 AND a<20;

SELECT * FROM integers WHERE a=2 AND a=4;

SELECT * FROM integers WHERE a=2 AND a>4;

SELECT * FROM integers WHERE a>4 AND a=2;

SELECT * FROM integers WHERE a=2 AND a>2;

SELECT * FROM integers WHERE a>=4 AND a=2;

SELECT * FROM integers WHERE a=4 AND a<2;

SELECT * FROM integers WHERE a<2 AND a=4;

SELECT * FROM integers WHERE a=2 AND a<2;

SELECT * FROM integers WHERE a<=2 AND a=4;

SELECT * FROM integers WHERE a<2 AND a>4;

SELECT * FROM integers WHERE a=2 AND a<>2;

SELECT * FROM integers WHERE a<>2 AND a=2;

SELECT * FROM integers WHERE 0;

SELECT * FROM integers WHERE a<2 AND 0;

CREATE TABLE strings(s VARCHAR);

INSERT INTO strings VALUES ('hello'), ('world'), (NULL);

SELECT * FROM strings WHERE s='hello' AND s='hello';

SELECT * FROM strings WHERE s='hello' AND s='world';

SELECT * FROM strings WHERE s='hello' AND s<>'hello';

SELECT * FROM strings WHERE s='hello' AND s<>'world';

SELECT * FROM strings WHERE s='hello' AND s>'a';

SELECT * FROM strings WHERE s='hello' AND s>='hello';

SELECT * FROM strings WHERE s='hello' AND s<='hello';

SELECT * FROM strings WHERE s='hello' AND s<'z';

SELECT * FROM strings WHERE s='hello' AND s<='a';

SELECT * FROM strings WHERE s='hello' AND s<'hello';

SELECT * FROM strings WHERE s='hello' AND s>'hello';

SELECT * FROM strings WHERE s='hello' AND s>='z';

SELECT * FROM strings WHERE s<>'hello' AND s<='a';

SELECT * FROM strings WHERE s<>'hello' AND s<'hello';

SELECT * FROM strings WHERE s<>'hello' AND s>'hello';

SELECT * FROM strings WHERE s<>'world' AND s>='hello';

SET explain_output = 'PHYSICAL_ONLY';

create table t1 as select range a, 'foo' || (range%100)::VARCHAR b, 100000-range c, timestamp '1992-01-01' + interval (range * 20) minute d from range(900000);

select count(*) from t1 where a < 5 or b = 'foo8';

explain select * from t1 where a<5 or b = 'foo8';

explain select * from t1 where a<5 or c>8000;

select a from t1 where a=5 or a=899999;

explain select * from t1 where a<5 or a>10;

explain select * from t1 where 5>a or 10<a;

explain select * from t1 where 5>=a or 10<=a;

explain select * from t1 where a in (1, 5, 10);

explain select * from t1 where a = 1 or a = 5 or a = 10;

explain select * from t1 where a in (1, 2, 3);

explain select * from t1 where a in (1);

explain select b from t1 where b = 'foo9' or b = 'foo10';

select a from t1 where d=timestamp '1992-01-01 01:40:00' or d=timestamp '2026-03-22 23:40:00';

explain select a from t1 where d=timestamp '1992-01-01 01:40:00' or d=timestamp '2026-03-22 23:40:00';

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

CREATE TABLE test_structs(i STRUCT(a integer, b bool));

INSERT INTO test_structs VALUES ({'a': 1, 'b': true}), ({'a': 2, 'b': false}), (NULL), ({'a': 3, 'b': true}), ({'a': NULL, 'b': NULL});

EXPLAIN SELECT * FROM test_structs WHERE i.a < 2;

SELECT * FROM test_structs WHERE i.a < 2;

EXPLAIN SELECT * FROM test_structs WHERE i.a > 2;

SELECT * FROM test_structs WHERE i.a > 2;

EXPLAIN SELECT * FROM test_structs WHERE i.a IS NULL;

SELECT * FROM test_structs WHERE i.a IS NULL;

EXPLAIN SELECT * FROM test_structs WHERE i.a = 2 OR i.a IS NULL;

SELECT * FROM test_structs WHERE i.a = 2 OR i.a IS NULL ORDER BY 1 DESC NULLS FIRST;

CREATE TABLE string_structs(s STRUCT(a varchar, b varchar));

INSERT INTO string_structs VALUES ({'a': 'foo', 'b': 'bar'}), ({'a': 'baz', 'b': 'qux'}), (NULL), ({'a': 'foo', 'b': NULL});

EXPLAIN SELECT * FROM string_structs WHERE s.a = 'foo';

SELECT * FROM string_structs WHERE s.a = 'foo';

CREATE TABLE large_structs(i STRUCT(a integer, b bool));

INSERT INTO large_structs SELECT {'a': n, 'b': n % 2 = 0} FROM generate_series(200000) as t(n);

EXPLAIN SELECT * FROM large_structs WHERE i.a > 150000;

EXPLAIN SELECT MIN(i.a), MAX(i.a), COUNT(*) FROM large_structs WHERE i.a > 150000;

SELECT MIN(i.a), MAX(i.a), COUNT(*) FROM large_structs WHERE i.a > 150000;

CREATE TABLE nested_structs(s STRUCT(a STRUCT(b integer, c bool), d STRUCT(e integer, f varchar)));

INSERT INTO nested_structs VALUES
	({'a': {'b': 1, 'c': false}, 'd': {'e': 2, 'f': 'foo'}}),
	(NULL),
	({'a': {'b': 3, 'c': true}, 'd': {'e': 4, 'f': 'bar'}}),
	({'a': {'b': NULL, 'c': true}, 'd': {'e': 5, 'f': 'qux'}}),
	({'a': NULL, 'd': NULL});

EXPLAIN SELECT * FROM nested_structs WHERE s.a.b < 2;

SELECT * FROM nested_structs WHERE s.a.b < 2;

EXPLAIN SELECT * FROM nested_structs WHERE s.a.c = true AND s.d.e = 5;

SELECT * FROM nested_structs WHERE s.a.c = true AND s.d.e = 5;

EXPLAIN SELECT * FROM nested_structs WHERE s.d.f = 'bar';

SELECT * FROM nested_structs WHERE s.d.f = 'bar';

CREATE TABLE dict_strings AS
    SELECT (i % 5)::INTEGER AS id, CASE WHEN i % 5 = 0 THEN 'not_a_number' ELSE ((i % 5) * 10)::VARCHAR END AS s
    FROM range(100000) t(i);

CREATE TABLE rle_values AS
    SELECT (i // 20000)::INTEGER AS grp, CASE WHEN i < 20000 THEN 100000 ELSE 5 END::INTEGER AS val
    FROM range(100000) t(i);

SELECT count(*) > 0 FROM pragma_storage_info('dict_strings')
WHERE column_name = 's' AND compression IN ('DICT_FSST', 'Dictionary');

SELECT count(*) > 0 FROM pragma_storage_info('rle_values') WHERE column_name = 'val' AND compression = 'RLE';

SELECT count(*) FROM dict_strings WHERE id <> 0 AND s::INT = 10;

SELECT count(*) FROM rle_values WHERE grp <> 0 AND val::TINYINT = 5;

CREATE TABLE vals1 AS SELECT i AS i, i AS j FROM range(0, 11, 1) t1(i);

INSERT INTO vals1 SELECT i, i+1 FROM vals1;

INSERT INTO vals1 SELECT DISTINCT(i), i-1 FROM vals1 ORDER by i;

SELECT * FROM vals1 WHERE i=5 AND j>=i;

SELECT * FROM vals1 WHERE i>9 AND j>=i;

SELECT * FROM vals1 WHERE i>=10 AND j>=i;

SELECT * FROM vals1 WHERE i<1 AND j>=i;

SELECT * FROM vals1 WHERE i<=0 AND j>=i;

SELECT * FROM vals1 WHERE i=5 AND j<=i;

SELECT * FROM vals1 WHERE i>9 AND j<=i;

SELECT * FROM vals1 WHERE i>=10 AND j<=i;

SELECT * FROM vals1 WHERE i<1 AND j<=i;

SELECT * FROM vals1 WHERE i<=0 AND j<=i;

SELECT * FROM vals1 WHERE i=5 AND j>i;

SELECT * FROM vals1 WHERE i>9 AND j>i;

SELECT * FROM vals1 WHERE i>=10 AND j>i;

SELECT * FROM vals1 WHERE i<1 AND j>i;

SELECT * FROM vals1 WHERE i<=0 AND j>i;

SELECT * FROM vals1 WHERE i=5 AND j<i;

SELECT * FROM vals1 WHERE i>9 AND j<i;

SELECT * FROM vals1 WHERE i>=10 AND j<i;

SELECT * FROM vals1 WHERE i<1 AND j<i;

SELECT * FROM vals1 WHERE i<=0 AND j<i;

SELECT * FROM vals1 WHERE j>=i AND i=5;

SELECT * FROM vals1 WHERE j>=i AND i>9;

SELECT * FROM vals1 WHERE j>=i AND i>=10;

SELECT * FROM vals1 WHERE j>=i AND i<1;

SELECT * FROM vals1 WHERE j>=i AND i<=0;

SELECT * FROM vals1 WHERE j<=i AND i=5;

SELECT * FROM vals1 WHERE j<=i AND i>9;

SELECT * FROM vals1 WHERE j<=i AND i>=10;

SELECT * FROM vals1 WHERE j<=i AND i<1;

SELECT * FROM vals1 WHERE j<=i AND i<=0;

SELECT * FROM vals1 WHERE j>i AND i=5;

SELECT * FROM vals1 WHERE j>i AND i>9;

SELECT * FROM vals1 WHERE j>i AND i>=10;

SELECT * FROM vals1 WHERE j>i AND i<1;

SELECT * FROM vals1 WHERE j>i AND i<=0;

SELECT * FROM vals1 WHERE j<i AND i=5;

SELECT * FROM vals1 WHERE j<i AND i>9;

SELECT * FROM vals1 WHERE j<i AND i>=10;

SELECT * FROM vals1 WHERE j<i AND i<1;

SELECT * FROM vals1 WHERE j<i AND i<=0;

CREATE TABLE vals2(k BIGINT, l BIGINT);

INSERT INTO vals2 SELECT * FROM vals1;

SELECT * FROM vals1, vals2 WHERE i>9 AND j<=l AND k>=i AND l<11
ORDER BY 2 DESC, 4 DESC;

SELECT * FROM vals1, vals2 WHERE i>9 AND j>=i AND k>=j ORDER by l;

SELECT * FROM vals1, vals2 WHERE i>9 AND k>=j AND j>=i AND l>=k;

SELECT * FROM vals1, vals2 WHERE i<1 AND k<=j AND j<=i AND l<=k;

CREATE TABLE t0(c0 INT, c1 INT);

INSERT INTO t0(c0, c1) VALUES (1819832341, -2039202523);

INSERT INTO t0(c0) VALUES (517438920);

SELECT t0.c1, t0.c0
FROM t0
WHERE TRY(t0.c1 - t0.c0) IS NULL
ORDER BY t0.c0;

CREATE TABLE t1(c0 INT, c1 INT);

INSERT INTO t1 VALUES (10, 5);

INSERT INTO t1 VALUES (NULL, 3);

INSERT INTO t1 VALUES (20, NULL);

INSERT INTO t1 VALUES (30, 1000000000);

SELECT c0, c1
FROM t1
WHERE TRY(c1 - c0) IS NULL
ORDER BY c0 NULLS LAST;

SELECT c0, c1, TRY(c1 - c0)
FROM t1
WHERE TRY(c1 - c0) IS NOT NULL
ORDER BY c0;

CREATE TABLE t_big(c0 BIGINT, c1 BIGINT);

INSERT INTO t_big VALUES (9223372036854775807, -1);

INSERT INTO t_big VALUES (NULL, 5);

INSERT INTO t_big VALUES (10, NULL);

SELECT c0, c1
FROM t_big
WHERE TRY(c1 - c0) IS NULL
ORDER BY c0 NULLS LAST;

CREATE TABLE t_double(c0 DOUBLE, c1 DOUBLE);

INSERT INTO t_double VALUES (1.5, 2.5);

INSERT INTO t_double VALUES (NULL, 3.0);

INSERT INTO t_double VALUES (4.0, NULL);

SELECT c0, c1
FROM t_double
WHERE TRY(c1 - c0) IS NULL
ORDER BY c0 NULLS LAST;

CREATE TABLE t_decimal(c0 DECIMAL(10,2), c1 DECIMAL(10,2));

INSERT INTO t_decimal VALUES (1.00, 2.00);

INSERT INTO t_decimal VALUES (0.00, 5.00);

INSERT INTO t_decimal VALUES (NULL, 7.00);

SELECT c0, c1
FROM t_decimal
WHERE TRY(c1 / c0) IS NULL
ORDER BY c0 NULLS LAST;

CREATE TABLE t_varchar(c0 VARCHAR, c1 VARCHAR);

INSERT INTO t_varchar VALUES ('10', '5');

INSERT INTO t_varchar VALUES ('abc', '3');

INSERT INTO t_varchar VALUES (NULL, '7');

SELECT c0, c1
FROM t_varchar
WHERE TRY(c1::INTEGER - c0::INTEGER) IS NULL
ORDER BY c0 NULLS LAST;

WITH cte as (
	select '12'::VARIANT a
)
select IF(a == 12, 1, 0) from cte;

WITH cte as (
	select '12'::VARIANT a
)
select IF(a == [1,2,3], 1, 0) from cte;

WITH cte as (
	select '[1,2,3]'::VARIANT a
)
select IF(a == [1,2,3], 1, 0) from cte;

WITH cte as (
	select [1,2,3]::VARIANT a
)
select IF(a == [3, 2, 1], 1, 0) from cte;

WITH cte as (
	select [1,2,3]::VARIANT a
)
select IF(a == [1,2,3], 1, 0) from cte;

WITH cte as (
	select [1::VARIANT,'2',3]::VARIANT a
)
select IF(a == [1,2,3], 1, 0) from cte;

WITH cte as (
	select {a: 21, b: [1,2,3]}::VARIANT a
)
select IF(a == [1,2,3], 1, 0) from cte;

WITH cte as (
	select {a: 21, b: [1,2,3]}::VARIANT a
)
select IF(a == {b: [1,2,3], a: 21}, 1, 0) from cte;

WITH cte as (
	select {a: 21, b: [1,2,3]}::VARIANT a
)
select IF(a < [1,2,3], 1, 0) from cte;

WITH cte as (
	select {a: 21, b: [1,2,3]}::VARIANT a
)
select IF(a > [1,2,3], 1, 0) from cte;

CREATE TEMPORARY TABLE t AS SELECT range a, length(range::VARCHAR) b, mod(range,10000) c, 5 d, 10000 e FROM range(1000000);

select count(*) from t where a > 500 or a <= 700;

explain select count(*) from t where (a > 500 and b = 3) or (a > 7000 and b = 2);

select count(*) from t where (a > 500 and b = 3) or (a > 7000 and b = 2);

explain select count(*) from t where (a > 500 AND b = 3) OR (a > 400) OR (a > 300 AND b=4) OR (a > 600 AND a > 300);

select count(*) from t where (a > 500 AND b = 3) OR (a > 400) OR (a > 300 AND b=4) OR (a > 600 AND a > 300);

EXPLAIN SELECT count(*) FROM t WHERE (a > 500 AND b = 3) OR (c = 100) OR (a > 300 AND b = 4) OR (a > 600 AND a > 300);

SELECT count(*) FROM t WHERE (a > 500 AND b = 3) OR (c = 100) OR (a > 300 AND b = 4) OR (a > 600 AND a > 300);

EXPLAIN SELECT count(*) FROM t WHERE (a > 500 AND b = 3) OR (c = 400) OR (a > 300 AND b = 4) OR (a > 600 AND a > 300) OR (d < 10);

SELECT count(*) FROM t WHERE (a > 500 AND b = 3) OR (c = 400) OR (a > 300 AND b = 4) OR (a > 600 AND a > 300) OR (d < 10);

explain select count(*) from t where (a > 500 AND b = 1) OR b < 2;

select count(*) from t where (a > 500 AND b = 1) OR b < 2;

INSERT INTO integers SELECT 1 FROM range(65534);

INSERT INTO integers SELECT 2 FROM range(65534);

INSERT INTO integers SELECT 3 FROM range(65534);

SELECT SUM(i) FROM integers WHERE i=1;

SELECT SUM(i) FROM integers WHERE i=2;

SELECT SUM(i) FROM integers WHERE i=3;

SELECT SUM(i) FROM integers WHERE i=4;

INSERT INTO integers SELECT 4 FROM range(65534);

INSERT INTO integers SELECT 5 FROM range(65534);

SELECT SUM(i) FROM integers WHERE i=5;

SELECT SUM(i) FROM integers WHERE i=6;

CREATE SEQUENCE transitive_calls;

SELECT i FROM range(5) t(i) WHERE i > 0 AND nextval('transitive_calls') >= i ORDER BY i;

SELECT last_value BETWEEN 4 AND 5 FROM duckdb_sequences() WHERE sequence_name='transitive_calls';

CREATE SEQUENCE transitive_reordered_calls;

SELECT i FROM range(5) t(i) WHERE nextval('transitive_reordered_calls') >= i AND i > 0 ORDER BY i;

SELECT last_value BETWEEN 4 AND 5 FROM duckdb_sequences() WHERE sequence_name='transitive_reordered_calls';

CREATE SEQUENCE transitive_join_calls;

SELECT i FROM range(5) t(i), range(1) u(j)
WHERE i+j > 0 AND nextval('transitive_join_calls') >= i+j ORDER BY i;

SELECT last_value BETWEEN 4 AND 5 FROM duckdb_sequences() WHERE sequence_name='transitive_join_calls';

CREATE SEQUENCE transitive_join_bound_calls;

SELECT i FROM range(5) t(i), range(4,5) u(j)
WHERE i > 0 AND nextval('transitive_join_bound_calls') >= i AND j >= i ORDER BY i;

SELECT last_value BETWEEN 4 AND 5 FROM duckdb_sequences() WHERE sequence_name='transitive_join_bound_calls';

SELECT i FROM (VALUES (1, '2'), (2, '2'), (3, '2'), (NULL, '2')) t(i,s)
WHERE i >= 1 AND s::INTEGER >= i ORDER BY i;

CREATE TABLE bounds(a INTEGER, b INTEGER, c INTEGER);

INSERT INTO bounds VALUES (0,0,0), (1,1,2), (1,1,2), (1,2,3),
	(2,1,3), (NULL,1,2), (1,NULL,2), (1,1,NULL);

SELECT * FROM bounds WHERE a >= 0 AND b >= a AND a >= b AND c > b;

SELECT * FROM bounds WHERE a >= 1 AND b >= a AND c > a;

SELECT * FROM bounds WHERE a > 0 AND a = b AND b > a;

CREATE TABLE lhs AS SELECT * FROM (VALUES (1), (2)) t(i);

CREATE TABLE rhs AS SELECT * FROM (VALUES (0), (1), (NULL)) t(j);

SELECT i,j FROM lhs LEFT JOIN rhs ON j >= i WHERE i >= 1;

SELECT i,j FROM rhs RIGHT JOIN lhs ON j >= i WHERE i >= 1;

CREATE TABLE single_scan AS SELECT range i0, range i1, range i2, range i3,
	range i4, range i5, range i6, range i7 FROM range(10);

SET disabled_optimizers='statistics_propagation';

SET explain_output='OPTIMIZED_ONLY';

EXPLAIN SELECT * FROM single_scan
WHERE i0 >= 5 AND i1 >= i0 AND i2 >= i1 AND i3 >= i2 AND i4 >= i3
	AND i5 >= i4 AND i6 >= i5 AND i7 >= i6;

SELECT i7 FROM single_scan
WHERE i0 >= 5 AND i1 >= i0 AND i2 >= i1 AND i3 >= i2 AND i4 >= i3
	AND i5 >= i4 AND i6 >= i5 AND i7 >= i6 ORDER BY i7;

EXPLAIN SELECT * FROM single_scan, range(1) u(j)
WHERE i0 >= 5 AND i1 >= i0 AND i2 >= i1 AND i3 >= i2 AND i4 >= i3
	AND i5 >= i4 AND i6 >= i5 AND i7 >= i6 AND i0 >= j;

SELECT i7 FROM single_scan, range(1) u(j)
WHERE i0 >= 5 AND i1 >= i0 AND i2 >= i1 AND i3 >= i2 AND i4 >= i3
	AND i5 >= i4 AND i6 >= i5 AND i7 >= i6 AND i0 >= j ORDER BY i7;

SET disabled_optimizers='expression_rewriter';

SELECT i,j FROM (VALUES (1), (2)) t(i), (VALUES (1::DOUBLE), (2::DOUBLE)) u(j)
WHERE CAST(i AS DOUBLE) >= 1::DOUBLE AND j >= CAST(i AS DOUBLE) ORDER BY i,j;

SELECT i,j FROM (VALUES (1), (2)) t(i), (VALUES (1::DOUBLE), (2::DOUBLE)) u(j)
WHERE TRY_CAST(i AS DOUBLE) >= 1::DOUBLE AND j >= TRY_CAST(i AS DOUBLE) ORDER BY i,j;

SELECT i,j FROM (VALUES (1), (2)) t(i), (VALUES (1::DOUBLE), (2::DOUBLE)) u(j)
WHERE j >= CAST(i AS DOUBLE) AND CAST(i AS DOUBLE) >= 1::DOUBLE ORDER BY i,j;

RESET disabled_optimizers;
