SELECT string_agg(DISTINCT v, '|' ORDER BY length(v), v)
FROM (VALUES ('aa'),('b'),('b'),(NULL)) t(v);

SELECT avg(v) FROM (VALUES (1::BIGINT),(NULL),(1),(4)) input(v);

SELECT count(v), approx_count_distinct(v), avg(v), sum(v), sum(v + 1)
FROM (VALUES (1::BIGINT),(NULL),(1),(4)) input(v) WHERE false;

INSERT INTO string_values VALUES('a'),('b');

INSERT INTO aggregate_values VALUES(1),(2),(2),(NULL);

INSERT INTO large_sum_values SELECT 4000000000000000000 FROM range(5);

SELECT sum(i),typeof(sum(i)) FROM decimal_values;

SELECT mean(i) FROM aggregate_values;

SELECT string_agg(x, '&') FROM string_values;

SELECT finalize(string_agg(x, '&' ORDER BY x) EXPORT_STATE) FROM string_values;

SELECT quantile_cont(v.exported_0,0.5) FROM (VALUES(1),(2)) v(exported_0);

SELECT n BETWEEN 0 AND 2 FROM (SELECT count(i) AS n FROM count_values WHERE random()>0.5);

CREATE TEMP TABLE reuse_owner AS FROM (VALUES (1,10),(2,20),(3,30),(4,40)) t(k,dim_id);

SELECT i,j,sum(k) FROM (VALUES (1,1,2),(1,2,3),(2,1,4),(2,2,5)) t(i,j,k) GROUP BY ROLLUP(i,j) ORDER BY ALL;

EXPLAIN SELECT i,sum(j) FROM (VALUES (1,2),(1,3),(2,4),(2,5)) t(i,j) GROUP BY GROUPING SETS ((i),()) ORDER BY ALL;

SET disabled_optimizers='top_n_window_elimination';

SELECT o.k,d.label,sum(f.v) FROM reuse_owner o JOIN reuse_dim d ON o.dim_id=d.id JOIN reuse_fact f USING(k) WHERE o.k IN (SELECT k FROM reuse_fact GROUP BY k HAVING sum(v)>25) GROUP BY o.k,d.label ORDER BY ALL;

SET disabled_optimizers='unused_columns';

SELECT min(k), max(k) FROM reuse_owner WHERE false;

SELECT alias(renamed) FROM (SELECT "MiXeD" AS renamed FROM names);

SELECT alias(i+1) FROM (VALUES (1),(2),(NULL)) t(i);

CREATE TABLE reserved_scan(rowid INTEGER, rownum INTEGER);

WITH RECURSIVE t(i,unused) AS (SELECT 0,int FROM test_all_types() UNION ALL SELECT i+1,unused FROM t WHERE i<2) SELECT i,count(*) FROM t GROUP BY i ORDER BY i;

SELECT log2(8);

SELECT log2(8), equi_width_bins(0, 10, 2, true), quantile_cont(i, 0.5) OVER () FROM (VALUES (1), (2)) v(i);

SELECT constant_or_null(42, 1, i) FROM (VALUES (1), (NULL), (1)) t(i);

SELECT typeof(round(i, -1)) FROM rounding_values;

INSERT INTO rounding_values VALUES (999999999999999999);

SELECT hash(i) FROM rounding_values;

SELECT alias(nextval('alias_effect'));

CREATE TABLE attached.outer_schema."inner.schema".scan_rows(i INTEGER, rowid VARCHAR,g INTEGER GENERATED ALWAYS AS (i+1));

SELECT * FROM attached.outer_schema."inner.schema".scan_rows;

SELECT * FROM pragma_version();

INSERT INTO ci_structs VALUES ({'c1': 'unused', 'c2': 2}), ({'c1': 'unused', 'c2': NULL}), ({'c1': 'unused', 'c2': 2});

SELECT s FROM ci_collated ORDER BY s COLLATE C NULLS LAST;

INSERT INTO collated_state_input VALUES (0, 'a'), (0, 'B'), (0, 'Z'), (0, NULL), (1, 'b'), (1, 'y'), (2, NULL);

SET VARIABLE count_star_state=(SELECT count(*) EXPORT_STATE FROM collated_state_input);

SELECT finalize(combine_aggr(state)), finalize(combine_aggr(state))='z'
FROM (SELECT g, max(s COLLATE NOCASE) EXPORT_STATE state FROM collated_state_input GROUP BY g);

SELECT getvariable('collated_empty_state');

SELECT finalize(combine(state, rebound)), finalize(combine(state, rebound))='z'
FROM (SELECT state, to_aggregate_state(state, 'arg_max',
      [get_type(NULL::VARCHAR COLLATE NOCASE), get_type(NULL::VARCHAR COLLATE NOCASE)]) rebound
      FROM (SELECT max(s COLLATE NOCASE) EXPORT_STATE state FROM collated_state_input));

SELECT finalize(combine_aggr(state))
FROM (SELECT g, count(s) EXPORT_STATE state FROM collated_state_input GROUP BY g);

SELECT finalize(getvariable('canonical_count_state')), finalize(getvariable('count_star_state')),
       finalize(getvariable('ordered_collated_state'));

INSERT INTO collated_values VALUES ('A'),('a'),(NULL);

SELECT 'A' COLLATE nocase FROM collated_values;

SELECT concat(v,'') COLLATE nocase FROM collated_values;

SELECT CASE WHEN v IS NULL THEN NULL ELSE v END COLLATE nocase FROM collated_values;

SELECT v COLLATE "binary" FROM collated_values;

SET default_collation='nocase';

CREATE TABLE composition_overflow(i HUGEINT);

EXPLAIN (SQL) SELECT CASE WHEN i=0 THEN x ELSE 1 END FROM (SELECT CAST(s AS INTEGER) x,i FROM composition_input) q;

EXPLAIN (SQL) SELECT n FROM (SELECT sum(i) s,count(*) n FROM composition_overflow) q;

EXPLAIN (SQL) SELECT x FROM (SELECT CAST(s AS INTEGER) x FROM composition_input) q ORDER BY x LIMIT 1;

EXPLAIN (SQL) SELECT i,k FROM (SELECT i,NULL k FROM composition_input) q ORDER BY k,i;

EXPLAIN (SQL) SELECT n+n+n FROM (SELECT count(*) n FROM composition_input) q;

SELECT
    l_returnflag,
    l_linestatus,
    sum(l_quantity) AS sum_qty,
    sum(l_extendedprice) AS sum_base_price,
    sum(l_extendedprice * (1 - l_discount)) AS sum_disc_price,
    sum(l_extendedprice * (1 - l_discount) * (1 + l_tax)) AS sum_charge,
    avg(l_quantity) AS avg_qty,
    avg(l_extendedprice) AS avg_price,
    avg(l_discount) AS avg_disc,
    count(*) AS count_order
FROM
    lineitem
WHERE
    l_shipdate <= CAST('1998-09-02' AS date)
GROUP BY
    l_returnflag,
    l_linestatus
ORDER BY
    l_returnflag,
    l_linestatus;

EXPLAIN (SQL) SELECT
    l_returnflag,
    l_linestatus,
    sum(l_quantity) AS sum_qty,
    sum(l_extendedprice) AS sum_base_price,
    sum(l_extendedprice * (1 - l_discount)) AS sum_disc_price,
    sum(l_extendedprice * (1 - l_discount) * (1 + l_tax)) AS sum_charge,
    avg(l_quantity) AS avg_qty,
    avg(l_extendedprice) AS avg_price,
    avg(l_discount) AS avg_disc,
    count(*) AS count_order
FROM
    lineitem
WHERE
    l_shipdate <= CAST('1998-09-02' AS date)
GROUP BY
    l_returnflag,
    l_linestatus
ORDER BY
    l_returnflag,
    l_linestatus;

SELECT n,n+1 FROM (SELECT count(*) n FROM composition_input) q;

SELECT lower(s),count(*),grouping(lower(s)) FROM composition_input GROUP BY ROLLUP(lower(s));

WITH c AS NOT MATERIALIZED (SELECT lower(s) x,i FROM composition_input) SELECT x,count(*) FROM c GROUP BY x;

SELECT k,count(*) FROM (SELECT 1 k FROM composition_input) q GROUP BY k;

SELECT i,k FROM (SELECT i,NULL k FROM composition_input) q ORDER BY k,i LIMIT 1;

SELECT * FROM (SELECT DISTINCT i FROM composition_input) q;

CREATE TABLE composition_one_row(i INTEGER);

CREATE TABLE compressed_values(i BIGINT);

SELECT sum(i) FROM (SELECT i FROM offset_values ORDER BY i);

CREATE TABLE null_strings AS SELECT NULL::VARCHAR AS s FROM range(2);

CREATE TABLE cast_source AS SELECT i::INTEGER id FROM range(100)t(i);

SELECT g,id FROM materialized_source WHERE id<100010 ORDER BY id;

INSERT INTO computed_groups VALUES (3),(4),(4),(NULL);

EXPLAIN (SQL) SELECT id FROM materialized_source ORDER BY id;

EXPLAIN (SQL) SELECT g,id FROM materialized_source WHERE id<100010 ORDER BY id;

EXPLAIN (SQL) SELECT CAST(i AS SMALLINT),count(*) FROM computed_groups GROUP BY CAST(i AS SMALLINT) ORDER BY 1;

EXPLAIN (SQL) SELECT '-0.0'::FLOAT;

SELECT variant_typeof(v.n),variant_typeof(v.items[1]) FROM (VALUES ({'n': 7::SMALLINT, 'items': [1::TINYINT, NULL]}::VARIANT)) t(v);

WITH literals AS MATERIALIZED (
	SELECT
		'hello'::VARIANT v0,
		NULL::VARIANT v1,
		7::SMALLINT::VARIANT v2,
		12.34::DECIMAL(9,2)::VARIANT v3,
		'a''b'::BLOB::VARIANT v4,
		{'slash\key': {'🦆': 12.34::DECIMAL(9,2)}}::VARIANT v5,
		{'quoted''key': [1::SMALLINT::VARIANT, 'x'::VARIANT, NULL::VARIANT]}::VARIANT v6,
		[7::SMALLINT::VARIANT, 'x'::VARIANT] v7,
		{'v': 7::SMALLINT::VARIANT} v8,
		[7::SMALLINT::VARIANT]::VARIANT[1] v9
)
SELECT *,variant_typeof(v3),variant_typeof(v5."slash\key"."🦆") FROM literals;

WITH literals AS MATERIALIZED (
    SELECT [to_months(-2147483648)+to_days(-2147483648)+to_microseconds(-9223372036854775808)] payload
)
SELECT date_part('year',payload[1])::BIGINT*12+date_part('month',payload[1]),
       date_part('day',payload[1]),
       date_part('hour',payload[1])::HUGEINT*3600000000+date_part('minute',payload[1])::HUGEINT*60000000+date_part('microsecond',payload[1])
FROM literals;

SELECT i, (WITH c AS MATERIALIZED (SELECT i x) SELECT a.x FROM c a, c b WHERE a.x=b.x) FROM range(3) t(i);

SELECT i, (WITH c AS MATERIALIZED (SELECT i x), d AS MATERIALIZED (SELECT x+1 y FROM c) SELECT y FROM d) FROM range(3)t(i);

CREATE TABLE lhs(k DOUBLE,x INTEGER);

SELECT o.k,o.x,EXISTS(SELECT 1 FROM rhs r WHERE r.k=o.k) FROM lhs o;

SELECT o.k,o.x,o.x=ANY(SELECT r.y FROM rhs r WHERE r.k=o.k) FROM lhs o;

CREATE TABLE union_r(g INTEGER,y UNION(i INTEGER,s VARCHAR));

CREATE TABLE list_r(g INTEGER,y INTEGER[]);

SELECT x<ANY(SELECT y FROM list_r r WHERE r.g=l.g) FROM list_l l;

INSERT INTO r VALUES (1,10),(1,10),(1,NULL),(2,99),(NULL,NULL);

SELECT id FROM l WHERE x<>ALL(SELECT y FROM r WHERE r.k=l.k);

WITH r0(x) AS MATERIALIZED (VALUES (1))
SELECT x,y FROM r0,
(WITH R0(y) AS MATERIALIZED (VALUES (2)) SELECT y FROM R0) q;

CREATE TABLE cte_input(x INTEGER, y DECIMAL(9,2), z INTEGER[]);

WITH c AS MATERIALIZED (SELECT * FROM cte_input WHERE x>10) SELECT * FROM c;

WITH c AS MATERIALIZED (SELECT x,y FROM cte_input) SELECT x,count(*),sum(y) FROM c GROUP BY x;

WITH c AS MATERIALIZED (SELECT x FROM cte_input) SELECT a.x,b.x FROM c a CROSS JOIN (WITH c AS MATERIALIZED (SELECT 9 x) SELECT x FROM c) b;

WITH RECURSIVE c(x) AS (SELECT 1 UNION SELECT x FROM c) SELECT x FROM c ORDER BY ALL;

WITH RECURSIVE c(x,y) AS (SELECT 1,[1,NULL]::INTEGER[] UNION ALL SELECT x+1,y FROM c WHERE x<3) SELECT x,y FROM c ORDER BY ALL;

WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x,row_number() OVER (ORDER BY x) FROM c ORDER BY ALL;

EXPLAIN (SQL) WITH c AS MATERIALIZED (SELECT nextval('cte_sequence') v FROM range(10000)) SELECT v FROM c LIMIT 1;

WITH c AS NOT MATERIALIZED (SELECT nextval('cte_sequence') v FROM range(10000)) SELECT v FROM c LIMIT 1;

WITH c AS  (SELECT nextval('cte_sequence') v FROM range(10000)) SELECT v FROM c LIMIT 1;

CREATE TABLE dml_target(a INTEGER, b TEXT DEFAULT 'x');

EXPLAIN (SQL) DELETE FROM dml_target WHERE a = 3;

DELETE FROM main.dml_target
WHERE (rowid = ANY (
                SELECT r0.rowid AS c1
                FROM main.dml_target AS r0(column0, column1)
                WHERE (r0.column0 = CAST(3 AS INTEGER))
            ));

EXPLAIN (SQL) DELETE FROM dml_target WHERE a = 20 RETURNING *, rowid >= 0 AS has_row;

EXPLAIN (SQL) UPDATE dml_target SET b = s.b FROM dml_source s WHERE dml_target.a = s.a;

CREATE TABLE dml_generated(a INTEGER, d AS (a * 2), b TEXT DEFAULT 'z');

INSERT INTO dml_merge_target VALUES (1,'a'),(2,'b');

MERGE INTO main.dml_merge_target USING (
        SELECT r2.column0 AS c0, r2.column1 AS c1, r2.column1 AS c2, r0.rowid AS c3
        FROM (main.dml_merge_target AS r0(column0, column1)
                RIGHT JOIN main.dml_merge_source AS r2(
                    column0,
                    column1) ON ((r0.column0 = r2.column0))
            )
    ) AS r5(c0, c1, c2, c3) ON (dml_merge_target.rowid = r5.c3) WHEN MATCHED THEN
UPDATE
SET v = r5.c2 WHEN NOT MATCHED THEN
INSERT (k, v)
VALUES (r5.c0, r5.c1);

CREATE TABLE dml_keyed(a INTEGER PRIMARY KEY, b TEXT);

SELECT * FROM dml_keyed;

INSERT INTO dml_cte_target VALUES (1),(2),(3);

WITH x(c0) AS MATERIALIZED (
        SELECT CAST(3 AS INTEGER) AS c0
    )
DELETE FROM main.dml_cte_target
WHERE (rowid = ANY (
                SELECT r3.c1 AS c1
                FROM ((
                                SELECT r2.column0 AS c0, r2.rowid AS c1
                                FROM main.dml_cte_target AS r2(column0)
                                WHERE (r2.column0 >= CAST(3 AS INTEGER))
                            ) AS r3(c0, c1) SEMI
                        JOIN x AS r4(c0) ON ((r3.c0 = r4.c0))
                    )
            ));

WITH i1 AS (INSERT INTO dml_cte_multi VALUES (1) RETURNING a),
     i2 AS (INSERT INTO dml_cte_aux VALUES (2) RETURNING a)
SELECT * FROM i1 UNION ALL SELECT * FROM i2;

CREATE TABLE dml_key_only(k INTEGER PRIMARY KEY, v INTEGER);

CREATE TABLE states AS SELECT avg(i) EXPORT_STATE a, sum(i) EXPORT_STATE s,
    count(*) EXPORT_STATE c, approx_quantile(i, 0.5) EXPORT_STATE q FROM range(10) t(i);

SELECT typeof(finalize(combine_aggr(a))), typeof(finalize(combine_aggr(s))),
       typeof(finalize(combine_aggr(c))), typeof(finalize(combine_aggr(q))) FROM states WHERE false;

SELECT finalize(combine_aggr(c)), finalize(combine_aggr(a)),
       finalize(combine_aggr(o)), finalize(combine_aggr(q)) FROM any_states WHERE false;

CREATE TABLE nested_any_states AS SELECT [c] l, {'state': a, 'ordered': o} t FROM any_states;

CREATE TYPE empty_enum AS ENUM ();

SELECT e FROM empty_enum_values;

SELECT nextval('exported_calls');

SELECT count(*),sum(i) FROM hinted_values WHERE i>v AND nextval('hinted_calls')>0;

EXPLAIN (SQL) VALUES (42);

PREPARE query_to_explain AS SELECT 1;

EXPLAIN (SQL) SELECT error('execution only');

EXPLAIN (SQL) SELECT * FROM duckdb_views();

EXPLAIN (SQL) SELECT sum(i) AS total FROM range(5) t(i) WHERE i > 1;

WITH t AS MATERIALIZED (SELECT * FROM (VALUES (1), (1), (NULL), (2)) v(i))
SELECT l.i, r.i FROM t l LEFT JOIN t r ON l.i=r.i ORDER BY l.i, r.i;

CREATE TABLE explain_data(i INTEGER, g VARCHAR);

SELECT i,row_number() OVER (ORDER BY i NULLS LAST) FROM explain_data ORDER BY 2;

SELECT i FROM explain_data UNION ALL SELECT 3;

SELECT count(*) FROM (DESCRIBE SELECT 1 AS n);

SELECT count(*) FROM range(1000) TABLESAMPLE BERNOULLI(50 PERCENT) REPEATABLE(42);

SELECT last_value FROM duckdb_sequences() WHERE sequence_name='explain_once';

EXPLAIN (SQL) SELECT NULL::INTEGER AS "null value", 2::BIGINT AS "two";

SELECT i FROM (VALUES (1)) t(i) WHERE false;

SELECT 1 AS result UNION ALL SELECT 1;

SELECT
	date_part('year', ts),
	date_part('dayofweek', ts),
	date_part('microseconds', ts),
	date_part('epoch', ts),
	date_part('julian', ts)
FROM dates;

EXPLAIN (SQL) SELECT date_part('microseconds', ts) FROM dates;

SELECT alias(NULL) AS wanted;

SELECT constant_or_null(42, i) FROM (VALUES (1), (NULL)) t(i);

SELECT list_transform(l, lambda x, i: x + c + CAST(i AS INTEGER)) FROM lists;

EXPLAIN (SQL) SELECT sum(i) FROM (VALUES (1.25::DECIMAL(9,2)), (2.50::DECIMAL(9,2)), (NULL::DECIMAL(9,2))) t(i);

DELETE FROM strings;

INSERT INTO strings VALUES ('a');

SELECT first(g ORDER BY i), list(g ORDER BY i) FROM (SELECT i, ST_SetCRS('POINT(0 1)'::GEOMETRY, 'GEäDCRS') g FROM range(2) t(i)) q;

CREATE TABLE probes(id INTEGER,g VARCHAR COLLATE nocase,h INTEGER[],v INTEGER);

SELECT id,v IN (SELECT c.v FROM candidates c WHERE p.g IS NOT DISTINCT FROM c.g AND p.h IS NOT DISTINCT FROM c.h) FROM probes p ORDER BY id;

INSERT INTO candidates SELECT 'a',[1,NULL],CASE WHEN i%3=0 THEN NULL ELSE 2 END FROM range(8192) t(i);

CREATE TABLE candidate_values(g INTEGER,is_null BOOLEAN,a INTEGER,b INTEGER);

INSERT INTO candidate_values VALUES(1,false,1,2),(1,false,1,2),(1,true,NULL,NULL),(2,false,2,2),(NULL,false,1,2),(4,false,1,NULL);

SELECT list(__mark_join_marker ORDER BY id) FROM probes p JOIN BY(TYPE MARK) candidates c ON p.g IS NOT DISTINCT FROM c.g AND p.v=c.v;

SET TimeZone='UTC';

EXPLAIN (SQL) SELECT datepart('epoch',ts) FROM export_dates;

SELECT date_part('hour',ts),datepart('microseconds',ts),extract(doy FROM ts)
FROM export_dates ORDER BY id;

SELECT count(*) FROM export_dates WHERE
date_part('hour',ts) IS DISTINCT FROM hour(ts)
OR date_part('dow',ts) IS DISTINCT FROM dayofweek(ts)
OR datepart('doy',ts) IS DISTINCT FROM dayofyear(ts)
OR date_part('milliseconds',ts) IS DISTINCT FROM millisecond(ts)
OR date_part('microseconds',ts) IS DISTINCT FROM microsecond(ts)
OR date_part('julian',ts) IS DISTINCT FROM julian(ts)
OR date_part('epoch',ts) IS DISTINCT FROM epoch(ts);

RESET Calendar;

PREPARE exported_part AS SELECT date_part($1,ts) FROM export_dates ORDER BY id;

INSERT INTO boundary_dates VALUES (800,NULL),(801,'infinity'),(802,'-infinity');

CREATE TEMP TABLE expected_parts AS
SELECT 'isoyear' AS part,id FROM boundary_dates WHERE isoyear(ts)=2000
UNION ALL SELECT 'yearweek',id FROM boundary_dates WHERE yearweek(ts)=199952
UNION ALL SELECT 'century',id FROM boundary_dates WHERE century(ts)=20
UNION ALL SELECT 'millennium',id FROM boundary_dates WHERE millennium(ts)=2
UNION ALL SELECT 'era',id FROM boundary_dates WHERE era(ts)=1;

SELECT count(*) FROM (
  (SELECT * FROM actual_parts EXCEPT ALL SELECT * FROM expected_parts)
  UNION ALL
  (SELECT * FROM expected_parts EXCEPT ALL SELECT * FROM actual_parts)
);

SELECT * FROM (VALUES (1,10),(2,20),(2,21),(NULL,30)) l(a,x) POSITIONAL JOIN (VALUES (2,100),(3,200),(NULL,300)) r(b,y);

SELECT * FROM (VALUES (1,10),(2,20),(2,21),(NULL,30)) l(a,x) FULL JOIN (VALUES (2,100),(3,200),(NULL,300)) r(b,y) ON a=b;

SELECT * FROM (VALUES (1,10),(2,20),(2,21),(NULL,30)) l(a,x) JOIN BY (TYPE right_anti) (VALUES (2,100),(3,200),(NULL,300)) r(b,y) ON a=b;

SELECT * FROM (VALUES (1,10),(2,20),(2,20),(NULL,30)) l(a,x) INNER JOIN (VALUES (2,20),(3,30),(NULL,40)) r(b,y) ON a IS NOT DISTINCT FROM b;

SELECT * FROM (VALUES (1,10),(2,20),(2,20),(NULL,30)) l(a,x) LEFT JOIN (VALUES (2,20),(3,30),(NULL,40)) r(b,y) ON a=b AND x<y;

SELECT * FROM (VALUES (1,10),(2,20),(2,20),(NULL,30)) l(a,x) FULL JOIN (VALUES (2,20),(3,30),(NULL,40)) r(b,y) ON a=b OR x=y;

SELECT * FROM (VALUES (1,10),(2,20),(2,20),(NULL,30)) l(a,x) ANTI JOIN (VALUES (2,20),(3,30),(NULL,40)) r(b,y) ON a IS NOT DISTINCT FROM b;

CREATE TABLE json_ordering(v JSON);

SELECT v, rank() OVER (ORDER BY v NULLS LAST) FROM json_ordering;

SELECT s, 'ABC' COLLATE nocase IN (SELECT s WHERE s IS NOT NULL)
FROM (VALUES ('aBc'), ('aBc'), ('xyz'), (NULL)) t(s)
ORDER BY s NULLS LAST;

SELECT a,__mark_join_marker FROM (VALUES (1),(3),(NULL)) l(a)
JOIN BY (TYPE MARK) (VALUES (2)) r(b) ON a<b ORDER BY a NULLS LAST;

INSERT INTO mark_boundary_l VALUES (NULL,(1,NULL)),(1,(2,3));

CREATE TABLE l AS SELECT i,(i%5)::DOUBLE g,CASE WHEN i%11=0 THEN NULL ELSE i%13 END x FROM range(8192)t(i);

EXPLAIN (SQL) SELECT i,nextval('seq'),x=ANY(SELECT y FROM r WHERE r.g=l.g) m FROM l;

EXPLAIN (SQL) SELECT i,CASE WHEN i>=4096 THEN CAST(error('grouped mark stream') AS BIGINT) ELSE nextval('seq') END,x=ANY(SELECT y FROM r WHERE r.g=l.g) m FROM l LIMIT 1;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::TUPLE(INTEGER,INTEGER)),(1,row(1,2)),(2,row(2,1)),(3,row(1,2)),(4,row(1,NULL::INTEGER))) p(id,k) JOIN BY(TYPE MARK) (VALUES (row(1,2)),(row(1,2)),(row(1,NULL::INTEGER))) b(k) ON p.k = b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::TUPLE(INTEGER,INTEGER)),(1,row(1,2)),(2,row(2,1)),(3,row(1,2)),(4,row(1,NULL::INTEGER))) p(id,k) JOIN BY(TYPE MARK) (VALUES (row(1,2)),(row(1,2)),(row(1,NULL::INTEGER))) b(k) ON p.k > b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::STRUCT(a INTEGER,b INTEGER)),(1,{'a':1,'b':2}),(2,{'a':2,'b':1}),(3,{'a':1,'b':2}),(4,{'a':1,'b':NULL::INTEGER})) p(id,k) JOIN BY(TYPE MARK) (VALUES ({'a':1,'b':2}),({'a':1,'b':2}),({'a':1,'b':NULL::INTEGER})) b(k) ON p.k = b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::STRUCT(a INTEGER,b INTEGER)),(1,{'a':1,'b':2}),(2,{'a':2,'b':1}),(3,{'a':1,'b':2}),(4,{'a':1,'b':NULL::INTEGER})) p(id,k) JOIN BY(TYPE MARK) (VALUES ({'a':1,'b':2}),({'a':1,'b':2}),({'a':1,'b':NULL::INTEGER})) b(k) ON p.k > b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::INTEGER[]),(1,[1,2]),(2,[2,1]),(3,[1,2]),(4,[1,NULL::INTEGER])) p(id,k) JOIN BY(TYPE MARK) (VALUES ([1,2]),([1,2]),([1,NULL::INTEGER])) b(k) ON p.k = b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::INTEGER[]),(1,[1,2]),(2,[2,1]),(3,[1,2]),(4,[1,NULL::INTEGER])) p(id,k) JOIN BY(TYPE MARK) (VALUES ([1,2]),([1,2]),([1,NULL::INTEGER])) b(k) ON p.k > b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::INTEGER),(1,1),(2,2),(3,1),(4,NULL::INTEGER)) p(id,k) JOIN BY(TYPE MARK) (VALUES (1),(1),(NULL::INTEGER)) b(k) ON p.k = b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::INTEGER),(1,1),(2,2),(3,1),(4,NULL::INTEGER)) p(id,k) JOIN BY(TYPE MARK) (VALUES (1),(1),(NULL::INTEGER)) b(k) ON p.k > b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::TUPLE(INTEGER,INTEGER)),(1,row(1,NULL::INTEGER))) p(id,k) JOIN BY(TYPE MARK) (SELECT row(1,2) k WHERE false) b ON p.k = b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::TUPLE(INTEGER,INTEGER)),(1,row(1,NULL::INTEGER))) p(id,k) JOIN BY(TYPE MARK) (SELECT row(1,2) k WHERE false) b ON p.k > b.k;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::INTEGER),(1,1)) p(id,k) JOIN BY(TYPE MARK) (VALUES (2),(2)) b(k) ON p.k IS DISTINCT FROM 2;

SELECT list(__mark_join_marker ORDER BY id) AS markers FROM (VALUES (0,NULL::TUPLE(INTEGER,INTEGER)),(1,row(1,2))) p(id,k) JOIN BY(TYPE MARK) (VALUES (2),(2)) b(k) ON row(1,NULL::INTEGER) > p.k;

SELECT NULL::INTERVAL IN (SELECT INTERVAL 1 DAY);

SELECT 1 WHERE (1,2) IN (SELECT 1,2);

CREATE TABLE mark_probe(id INTEGER,label VARCHAR,a INTEGER,c INTEGER);

SELECT label,id,a IN (SELECT b FROM mark_build WHERE c+d>0) FROM mark_probe;

CREATE TABLE l(g DOUBLE,k INTEGER,x INTEGER);

SELECT o.g,o.k,o.x,o.x=ANY(SELECT r.y FROM r WHERE r.g=o.g AND r.k=o.k) m FROM l o;

SELECT o.g,o.k,o.x,o.x=ALL(SELECT r.y FROM r WHERE r.g=o.g AND r.k=o.k) m FROM l o;

CREATE TABLE l(g DOUBLE,k INTEGER,x DECIMAL(9,2));

INSERT INTO l SELECT g,k,CASE WHEN v IS NULL THEN NULL ELSE [v,NULL] END FROM (VALUES (1,1,10),(1,1,10),(1,1,20),(1,1,NULL),(1,2,10),(1,2,NULL),(1,3,NULL),(2,1,20),(NULL,1,10),(NULL,1,NULL),(1,NULL,20),(NULL,NULL,NULL)) t(g,k,v);

INSERT INTO l SELECT g,k,CASE WHEN v IS NULL THEN NULL ELSE {'v':v} END FROM (VALUES (1,1,10),(1,1,10),(1,1,20),(1,1,NULL),(1,2,10),(1,2,NULL),(1,3,NULL),(2,1,20),(NULL,1,10),(NULL,1,NULL),(1,NULL,20),(NULL,NULL,NULL)) t(g,k,v);

INSERT INTO l SELECT g,k,CASE v WHEN 10 THEN 'a' WHEN 20 THEN 'B' ELSE NULL END FROM (VALUES (1,1,10),(1,1,10),(1,1,20),(1,1,NULL),(1,2,10),(1,2,NULL),(1,3,NULL),(2,1,20),(NULL,1,10),(NULL,1,NULL),(1,NULL,20),(NULL,NULL,NULL)) t(g,k,v);

SET prefer_range_joins=true;

SELECT __mark_join_marker FROM (VALUES (1,3),(NULL::INTEGER,2)) l(a,c) JOIN BY (TYPE MARK) (VALUES (2,1),(NULL::INTEGER,2)) r(b,d) ON a IS NOT DISTINCT FROM b ORDER BY a NULLS LAST;

SELECT __mark_join_marker FROM (VALUES (1,3),(NULL::INTEGER,2)) l(a,c) JOIN BY (TYPE MARK) (VALUES (2,1),(NULL::INTEGER,2)) r(b,d) ON a IS NOT DISTINCT FROM b AND c IS NOT DISTINCT FROM d ORDER BY a NULLS LAST;

SELECT __mark_join_marker FROM (VALUES (1,3),(NULL::INTEGER,2)) l(a,c) JOIN BY (TYPE MARK) (VALUES (2,1),(NULL::INTEGER,2)) r(b,d) ON a<b ORDER BY a NULLS LAST;

INSERT INTO nested_r VALUES (1,NULL);

CREATE OR REPLACE TABLE nested_r(g INTEGER,y STRUCT(v INTEGER));

SELECT struct_pack("named field" := 1, null_field := NULL::INTEGER), row(1, NULL::INTEGER), struct_update({'old': 1}, old := 2, "new field" := NULL::INTEGER), write_log('ignored', disable_logging := true, return_value := 42);

SELECT CASE WHEN false THEN array_value('x' COLLATE nocase,'y' COLLATE nocase) ELSE NULL END AS v;

SELECT CASE WHEN false THEN {'s': 'x' COLLATE nocase} ELSE NULL END AS v;

CREATE TABLE nested_input(id INTEGER, l VARCHAR[], needle VARCHAR COLLATE nocase);

SELECT list_contains([needle], 'BANANA'), list_position([needle], 'BANANA') FROM nested_input WHERE id=1;

SELECT cast_to_type(['A'], array_value('x' COLLATE nocase))[1]='a',
       (array_value('A' COLLATE nocase)::VARCHAR[])[1]='a';

SELECT i,CASE WHEN i=4 THEN NULL ELSE struct_pack(v := s COLLATE NOCASE) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s) ORDER BY i;

SELECT min(v),max(v) FROM (SELECT CASE WHEN i=4 THEN NULL ELSE struct_pack(v := s COLLATE NOCASE) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s));

SELECT v,count(*) FROM (SELECT CASE WHEN i=4 THEN NULL ELSE row(s COLLATE NOCASE,i % 2) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s)) GROUP BY v ORDER BY v;

SELECT v,count(*) FROM (SELECT CASE WHEN i=4 THEN NULL ELSE [s COLLATE NOCASE] END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s)) GROUP BY v ORDER BY v;

SELECT i,CASE WHEN i=4 THEN NULL ELSE array_value(s COLLATE NOCASE) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s) ORDER BY i;

SELECT min(v),max(v) FROM (SELECT CASE WHEN i=4 THEN NULL ELSE array_value(s COLLATE NOCASE) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s));

SELECT v,count(*) FROM (SELECT CASE WHEN i=4 THEN NULL ELSE map(['v'],[s COLLATE NOCASE]) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s)) GROUP BY v ORDER BY v;

SELECT count(v[1]), count(*) FILTER (WHERE v[1]='a') FROM (SELECT CASE WHEN i=4 THEN NULL ELSE [s COLLATE NOCASE] END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s));

SELECT first_value(v) OVER (ORDER BY i), last_value(v) OVER (ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) FROM (SELECT i, CASE WHEN i=4 THEN NULL ELSE struct_pack(v := s COLLATE NOCASE) END v FROM (VALUES (0,'A'),(1,'a'),(2,'B'),(3,NULL),(4,'A')) t(i,s)) ORDER BY i;

SELECT id, struct_insert(s, "constant field" := 7) FROM struct_insert_input ORDER BY id;

CREATE TABLE probes(id INTEGER, g VARCHAR COLLATE nocase, v INTEGER[], w INTEGER);

SELECT id,__mark_join_marker FROM probes p JOIN BY(TYPE MARK) candidates c
ON p.g IS NOT DISTINCT FROM c.g AND p.v IS DISTINCT FROM c.v ORDER BY id;

CREATE TABLE numbered_scan AS SELECT i, (i%7)::INTEGER v, {'x':i,'y':i::VARCHAR} s FROM range(300000)t(i);

INSERT INTO numbered_scan SELECT i,(i%7)::INTEGER,{'x':i,'y':i::VARCHAR} FROM range(300000,300017)t(i);

SELECT * FROM (SELECT s.x,row_number() OVER () n FROM numbered_scan) LIMIT 4097;

CREATE TABLE offset_rows AS SELECT i::INTEGER AS i FROM range(245760) t(i);

SELECT i FROM offset_rows ORDER BY i LIMIT 1 OFFSET 122880;

SELECT first(n) FROM (SELECT i,row_number() OVER () n FROM hinted_scan) WHERE i>50;

SELECT variant_to_parquet_variant(i::VARIANT) FROM range(2) t(i);

SELECT get_type({'v': variant_to_parquet_variant(NULL)});

SELECT get_type(NULL::PARQUET_VARIANT);

SELECT * FROM (VALUES ('g','a',10),('g','a',NULL),('g','b',20),('h','a',NULL)) t(g,k,v) PIVOT (sum(v) AS s,count(v) AS c FOR k IN ('a','b','z')) ORDER BY g;

SELECT array_sort(x) FROM (VALUES (['b','B']::VARCHAR[]))t(x);

SELECT list_reverse_sort(x) FROM (VALUES (['B','b']::VARCHAR[]))t(x);

RESET pivot_limit;

FROM (VALUES ('a',1),('a',2),('b',NULL)) t(k,v)
PIVOT (list(v) FOR k IN ('a','b','z'));

CREATE SEQUENCE pivot_export_sequence;

SELECT count(*)
FROM (FROM (VALUES ('a',1),('b',2),('a',3)) t(k,v)
      PIVOT (sum(v) AS s, max(nextval('pivot_count_sequence')) AS effect FOR k IN ('a','b','z')));

FROM (VALUES ('g','p',1),('h','q',2)) t(g,k,v)
PIVOT (bitstring_agg(v, 1, 3) FOR k IN ('p','q'));

INSERT INTO scope_rows VALUES (1,2,'B',[2,NULL],[10],'2'),(2,1,'a',[1,3],[],'1'),(3,1,'A',[],[30,40],'bad'),(4,NULL,'c',NULL,NULL,'4'),(5,2,'b',[2],[50,60],'5');

SELECT id,unnest(xs),unnest(ys) FROM scope_rows WHERE id<>3;

SELECT i,sum(n) OVER(ORDER BY i NULLS LAST) FROM (SELECT i,count(*) n FROM scope_rows GROUP BY i) q ORDER BY i NULLS LAST;

SELECT r.id,unnest(r.xs),b.id FROM scope_rows r LEFT JOIN (VALUES (1),(2)) b(id) ON r.id=b.id;

SELECT sum(v) OVER() FROM (SELECT nextval('scope_sequence') v FROM range(2)) q;

SELECT x,
	sum(DISTINCT x) FILTER (WHERE x > 1) OVER (),
	first_value(x ORDER BY x DESC NULLS LAST) OVER ()
FROM (VALUES (1),(2),(3)) t(x)
ORDER BY x;

CREATE TABLE pure_values_input(i INTEGER);

SELECT count(*) FROM (SELECT * FROM pure_values_input WHERE false) t,
LATERAL (VALUES (i),(i)) v(x);

INSERT INTO column_paths VALUES ({'a''b':1,'y':{'z':2}},{'x':{'y':'3'}}::VARIANT),(NULL,NULL),({'a''b':NULL,'y':NULL},{'x':{'y':4}}::VARIANT);

EXPLAIN SELECT v.x.y::INTEGER FROM column_paths;

EXPLAIN (SQL) SELECT quantile_disc(1, 0.5), max(0.5::DOUBLE);

SELECT reservoir_quantile(x, 0.5), max(0.5::DOUBLE) FROM (VALUES (1),(2),(3)) t(x);

SELECT x, sum(x) OVER (ORDER BY x RANGE BETWEEN 1 + 1 PRECEDING AND CURRENT ROW)
FROM (VALUES (1),(2),(4)) t(x) ORDER BY x;

INSERT INTO frame_values VALUES (1,1,'2024-02-28',10),(2,1,'2024-02-29',20),
    (3,2,'2024-03-01',NULL),(4,4,'2024-03-03',40),(5,NULL,NULL,50);

SELECT id,sum(v) OVER (ORDER BY d DESC RANGE BETWEEN INTERVAL 1 DAY PRECEDING AND CURRENT ROW)
FROM frame_values ORDER BY id;

SELECT x, sum(x) OVER (ORDER BY x ASC NULLS FIRST RANGE BETWEEN 1 PRECEDING AND 2 FOLLOWING) FROM (VALUES (1,1),(2,2),(2,1),(4,NULL),(NULL,1)) t(x,d) ORDER BY x NULLS FIRST, 2;

SELECT x, sum(x) OVER (ORDER BY x ASC NULLS FIRST RANGE BETWEEN 1 FOLLOWING AND 2 FOLLOWING) FROM (VALUES (1,1),(2,2),(2,1),(4,NULL),(NULL,1)) t(x,d) ORDER BY x NULLS FIRST, 2;

SELECT x, sum(x) OVER (ORDER BY x DESC NULLS LAST RANGE BETWEEN 1 PRECEDING AND 2 FOLLOWING) FROM (VALUES (1,1),(2,2),(2,1),(4,NULL),(NULL,1)) t(x,d) ORDER BY x NULLS FIRST, 2;

SELECT x, sum(x) OVER (ORDER BY x DESC NULLS LAST RANGE BETWEEN 1 FOLLOWING AND 2 FOLLOWING) FROM (VALUES (1,1),(2,2),(2,1),(4,NULL),(NULL,1)) t(x,d) ORDER BY x NULLS FIRST, 2;

SELECT sum(x) OVER (ORDER BY x RANGE BETWEEN 0.25 PRECEDING AND 0.5 FOLLOWING) FROM (VALUES (1.00::DECIMAL(9,2)),(1.25),(NULL),(1.25),(2.00)) t(x);

SELECT count(*) OVER (ORDER BY CAST(x AS TIMESTAMP) RANGE BETWEEN INTERVAL 1 DAY PRECEDING AND CURRENT ROW) FROM (VALUES (DATE '2024-02-28'),(DATE '2024-02-29')) t(x);

SELECT x, sum(x) OVER (ORDER BY x RANGE BETWEEN (SELECT nextval('range_origin_calls')) PRECEDING AND CURRENT ROW)
FROM (VALUES (1::BIGINT),(2),(3)) t(x) ORDER BY x;

SELECT s.k, sum(s.k) OVER (ORDER BY s.k RANGE BETWEEN s.delta PRECEDING AND CURRENT ROW)
FROM range_origin_structs ORDER BY s.k;

WITH RECURSIVE r(k,v) USING KEY(k,last(v)) AS (SELECT 1,v FROM nested_payload UNION ALL SELECT k+1,v FROM r WHERE k<3) SELECT k,v FROM r ORDER BY k;

WITH RECURSIVE r(k,v) USING KEY(k,last(nextval('seq')) AS v) AS (VALUES(1,1) UNION SELECT k+1,v FROM r WHERE k<4) SELECT k,v FROM r LIMIT 1;

WITH RECURSIVE c(x) USING KEY(x) AS (SELECT (x || '') COLLATE nocase FROM (VALUES ('A'),('a'),(NULL))v(x) UNION SELECT x FROM c WHERE false) SELECT x FROM c ORDER BY x NULLS LAST;

WITH RECURSIVE r(k,v) USING KEY(k,max(v+1) AS v) AS (VALUES(1,3),(1,1),(1,NULL) UNION ALL SELECT k+1,v FROM r WHERE k<3) SELECT k,v FROM r ORDER BY k;

WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT count(*)::INTEGER FROM c WHERE false) SELECT x FROM c LIMIT 4;

WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT count(*) FROM c WHERE false GROUP BY x) SELECT x FROM c LIMIT 3;

WITH RECURSIVE c(x) AS (SELECT 1 UNION SELECT x+1 FROM recurring.c WHERE false) SELECT x FROM c;

WITH RECURSIVE c(x) USING KEY(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x FROM c ORDER BY x;

WITH RECURSIVE c(k,v) USING KEY(k,list(v)) AS (SELECT 1,1 UNION SELECT k+1,len(v)::INTEGER FROM c WHERE k<3) SELECT k,v FROM c ORDER BY k;

WITH RECURSIVE r0(c0) AS (SELECT 1 UNION SELECT c0+1 FROM recurring.r0 WHERE c0<2) SELECT a.c0,b.c0 FROM r0 a CROSS JOIN (WITH RECURSIVE r0(c0) AS (SELECT 10 UNION SELECT c0+1 FROM recurring.r0 WHERE c0<11) SELECT c0 FROM r0) b ORDER BY ALL;

SELECT NULL::VARCHAR COLLATE nocase WHERE false;

WITH RECURSIVE c(x) AS NOT MATERIALIZED (SELECT 1 UNION ALL SELECT CASE WHEN x=2 THEN error('recursive step')::INTEGER ELSE x+1 END FROM c WHERE x<3) SELECT x FROM c LIMIT 1;

WITH RECURSIVE c(k,v) USING KEY(k,list(v)) AS MATERIALIZED (SELECT 1,1 UNION SELECT 2,count(*)::INTEGER FROM recurring.c WHERE false HAVING nextval('seq')<3) SELECT * FROM c ORDER BY k;

WITH RECURSIVE c(k,v) USING KEY(k,list(v)) AS MATERIALIZED (SELECT 1,1 UNION ALL SELECT 2,count(*)::INTEGER FROM recurring.c WHERE false HAVING nextval('seq')<3) SELECT * FROM c ORDER BY k;

WITH RECURSIVE c(x) AS  (SELECT 0::BIGINT UNION ALL SELECT count(*)+CASE WHEN nextval('seq')<3 THEN currval('seq') ELSE error('recursive iteration') END FROM c WHERE false) SELECT x FROM c LIMIT 3;

SELECT * FROM (VALUES ('v1'), ('w2'), ('v\x5C')) t(s) WHERE s SIMILAR TO 'v.*' ORDER BY s;

EXPLAIN (SQL) SELECT x,y FROM (VALUES (3,30), (1,10), (NULL,40), (3,20), (NULL,50)) t(x,y) ORDER BY y DESC LIMIT 2 OFFSET 1;

SELECT DISTINCT x FROM (VALUES (3,30), (1,10), (NULL,40), (3,20), (NULL,50)) t(x,y);

SET disabled_optimizers='grouping_sets,common_subplan';

SELECT x,x::INTEGER,grouping(x,x::INTEGER),count(*) FROM (VALUES (1,10),(1,20),(NULL,5),(2,NULL),(2,NULL)) t(x,y) GROUP BY GROUPING SETS ((x),(x::INTEGER),(),(x));

SET disabled_optimizers='distinct_aggregate_rewrite';

EXPLAIN (SQL) SELECT NULL::DECIMAL(9,2) a, [1,NULL] b, {'x': 2} c WHERE false;

(VALUES (1),(1),(1),(NULL),(NULL),(2)) UNION ALL (VALUES (1),(1),(NULL),(3));

(VALUES (1),(1),(1),(NULL),(NULL),(2)) INTERSECT ALL (VALUES (1),(1),(NULL),(3));

CREATE MACRO shadow.suffix(a,b) AS false;

SELECT s LIKE 'a%' FROM (VALUES ('abc'),('cab'),(NULL)) v(s);

SELECT s LIKE '%a' FROM (VALUES ('bca'),('abc'),(NULL)) v(s);

SELECT s LIKE '%a%' FROM (VALUES ('abc'),('bbb'),(NULL)) v(s);

SELECT avg(i) FROM (VALUES (1),(2),(NULL)) v(i);

SET search_path='main';

EXPLAIN (SQL) SELECT sum(i + 1) FROM (VALUES (1),(2),(NULL)) t(i);

EXPLAIN (SQL) SELECT count(*) FROM (VALUES (1),(2)) t(i);

EXPLAIN (SQL) SELECT s FROM (VALUES ('abc'),('cab'),('bca'),(NULL)) t(s) WHERE s LIKE 'a%';

EXPLAIN (SQL) SELECT s FROM (VALUES ('abc'),('cab'),('bca'),(NULL)) t(s) WHERE s LIKE '%a%';

EXPLAIN (SQL) SELECT histogram(i) FROM (VALUES (1), (2), (2)) t(i);

EXPLAIN (SQL) SELECT mode(i) FROM (VALUES (1), (2), (2)) t(i);

SELECT i > 100, i < 100 FROM bounded_values;

SELECT * FROM summary((SELECT x AS first_value, y AS second_value FROM measurements));

SELECT to_aggregate_state(NULL::HUGEINT, 'sum', ['INTEGER']);

SELECT min(s COLLATE nocase), max(s COLLATE nocase) FROM (VALUES ('a'), ('B'), (NULL), ('B')) t(s);

SELECT finalize(min(s) EXPORT_STATE) FROM (VALUES ('1'::BIT), ('01'::BIT), (NULL)) t(s);

SELECT * FROM (SELECT i,i v FROM range(0)t(i)) USING SAMPLE 31 (reservoir,42);

SELECT * FROM (SELECT i,CASE WHEN i%5=0 THEN NULL ELSE i%3 END v FROM range(10000)t(i) WHERE i%2=0) USING SAMPLE 50% (bernoulli,42);

SELECT * FROM (SELECT i,nextval('seq') v FROM range(10000)t(i)) USING SAMPLE 50% (system,42);

SELECT * FROM (SELECT i,i v FROM range(0)t(i)) USING SAMPLE 80% (system,1);

SELECT * FROM range(10000) USING SAMPLE 31 (system,42);

EXPLAIN (SQL) SELECT * FROM sample_source USING SAMPLE 31 (system,42) ORDER BY i;

EXPLAIN (SQL) SELECT * FROM sample_source USING SAMPLE 31 (system) ORDER BY i;

SELECT count(*),count(DISTINCT x),count(*) FILTER (WHERE x>=0 AND x<10000) FROM (SELECT * FROM range(10000) USING SAMPLE 31 (reservoir)) t(x);

SELECT i FROM range(10) t(i) ORDER BY i
LIMIT (SELECT nextval('limit_calls')+2) OFFSET (SELECT nextval('offset_calls')+1);

SELECT currval('row_calls');

SELECT i FROM (VALUES (1),(1),(NULL)) t(i) LIMIT (SELECT NULL) OFFSET (SELECT NULL);

SELECT currval('nested_limit_calls');

INSERT INTO t VALUES (0,'first'),(1,'a'),(1,'a'),(2,'b'),(4,'last'),(NULL,'n');

SELECT t.i,t.s,u.v FROM t FULL JOIN u USING (i) ORDER BY ALL;

SELECT i+2 FROM (VALUES (1),(2),(4),(NULL)) t(i) WHERE i+1>2;

SELECT s FROM (SELECT s FROM (VALUES ('1'),('bad')) t(s) WHERE s!='bad') q WHERE CAST(s AS INTEGER)>0;

SELECT x,x FROM (SELECT i+1 AS x FROM (VALUES (1),(2),(2),(NULL)) t(i)) q;

SELECT x,x FROM (SELECT nextval('export_sequence') AS x FROM (VALUES (1),(2),(2)) t(i)) q;

EXPLAIN (SQL) SELECT t.i,t.s,u.v FROM t FULL JOIN u USING (i);

EXPLAIN (SQL) SELECT i+2 FROM (VALUES (1),(2),(4),(NULL)) t(i) WHERE i+1>2;

EXPLAIN (SQL) SELECT s FROM (SELECT s FROM (VALUES ('1'),('bad')) t(s) WHERE s!='bad') q WHERE CAST(s AS INTEGER)>0;

EXPLAIN (SQL) SELECT x,x FROM (SELECT i+1 AS x FROM (VALUES (1),(2),(2),(NULL)) t(i)) q;

CREATE TABLE scope_input(i INTEGER,xs INTEGER[]);

EXPLAIN (SQL) SELECT i,row_number() OVER(ORDER BY i) FROM scope_input WHERE i>0;

EXPLAIN (SQL) SELECT v,row_number() OVER(ORDER BY v) FROM (SELECT i+1 v FROM scope_input) q;

SET disabled_optimizers='window_self_join';

EXPLAIN (SQL) SELECT unnest(v) FROM (SELECT unnest([[i],[i+1]]) v FROM scope_input) q;

CREATE SECURE VIEW nested_rows AS SELECT * FROM public_rows;

INSERT INTO private_text VALUES (1,'7'),(2,'bad'),(1,'7'),(1,NULL);

EXPLAIN (SQL) SELECT p FROM public_rows WHERE i=1;

SELECT r.s FROM barrier_rows r JOIN visible_ids v USING(i) WHERE __internal_barrier(r.s::INTEGER=42);

SELECT count(*) FROM barrier_view WHERE nextval('barrier_sequence') > 0;

SELECT currval('limit_sequence');

CREATE SECURE VIEW secret.paths(first, second) AS SELECT s,t FROM secret.path_data;

CREATE SECURE VIEW union_struct AS SELECT {'a':1} AS unused, {'a':2} AS s UNION ALL SELECT {'a':3}, {'a':4};

INSERT INTO filtered_data VALUES (0,'1'), (1,'bad');

SELECT count(*) FROM union_values;

SELECT value FROM filtered_values WHERE i=0;

WITH c AS NOT MATERIALIZED (SELECT * FROM secret.paths_twice)
SELECT a.second,b.second FROM c a CROSS JOIN c b;

SELECT count(*) FROM unused_secure_values;

SELECT count(*) FROM retained_secure_values;

SELECT s.k,s.j.z FROM collated_outer ORDER BY s.k,s.j.z;

SELECT right_value,left_value FROM secure_data WHERE right_value >= 20 ORDER BY right_value;

SELECT * FROM (VALUES (1),(1),(NULL),(NULL)) t(x) UNION ALL SELECT 2 WHERE false;

SELECT * FROM (VALUES (1,2),(1,2),(NULL,3)) t(x,y) UNION SELECT 2,3 WHERE false;

INSERT INTO slice_input VALUES (1, [[1,2],[3,NULL]], 'abcdef'), (2, []::INTEGER[][], ''), (3, NULL, NULL);

EXPLAIN (SQL) SELECT id,b[:2],s[:3] FROM slice_input ORDER BY id;

EXPLAIN (SQL) SELECT id,b[1:-:2] FROM slice_input ORDER BY id;

SELECT array_slice([1,2,3], 1, 2);

CREATE TABLE filter_join_input AS SELECT i::INTEGER i,CASE WHEN i%4=0 THEN NULL ELSE (i%7)::INTEGER END v FROM range(12)t(i);

SELECT l.i,row_number() OVER () FROM filter_lists l LEFT JOIN filter_join_input USING(i) WHERE v IS NULL ORDER BY ALL;

SELECT name,value,typed_value FROM system.main.duckdb_settings() WHERE name IN ('threads','default_collation') ORDER BY name;

SELECT * FROM repeat(NULL::DECIMAL(9,2),2);

SELECT c,a,c FROM repeat_row(NULL::INTEGER,'text',4.50::DECIMAL(8,2),num_rows=2) t(a,b,c);

SELECT * FROM unnest(NULL::INTEGER[]);

SELECT i,j FROM range(3) t(i), generate_series(0,i) u(j) ORDER BY i,j;

CREATE TABLE csv_source(i INTEGER,s VARCHAR);

INSERT INTO "_3_schema"."_4_table" VALUES (1,'a',2,3),(1,'a',2,3),(NULL,'n',NULL,4);

SELECT count(*) FROM range(4);

SELECT * FROM duckdb_optimizers() ORDER BY ALL;

INSERT INTO scan_rows VALUES (1,3,'first',1.125,[1,NULL]),(2,2,NULL,NULL,[]),(2,2,'duplicate',2.250,[2]),(2,2,'duplicate',2.250,[2]),(NULL,4,'null',4.500,NULL);

SELECT rowid,i FROM scan_rows WHERE j=2;

SELECT a,e,b FROM scan_rows AS q(a,b,c,d,e) WHERE b=2;

INSERT INTO t VALUES ('b', 1), ('a', 2);

SELECT s, row_number() OVER (ORDER BY NULL || s, s) FROM t ORDER BY s;

SELECT s, rank() OVER (ORDER BY NULL || s), count(*) OVER (ORDER BY NULL || s),
       cume_dist() OVER (ORDER BY NULL || s), percent_rank() OVER (ORDER BY NULL || s)
FROM t ORDER BY s;

SELECT s FROM t ORDER BY NULL || s;

EXPLAIN (SQL) SELECT list(s ORDER BY 1 + 1, s) FROM t;

SELECT t.s,sum(u.v) FROM t JOIN u USING(i) GROUP BY t.s ORDER BY 1 LIMIT 10;

SELECT count(*) FROM t ANTI JOIN u USING(i);

SELECT count(*) FROM t LEFT JOIN (u RIGHT JOIN (VALUES(1),(5)) r(k) ON u.i=r.k) ON t.i=u.i;

SELECT quantile_cont(x, [0.0] ORDER BY x DESC) FROM (VALUES (1), (2), (2), (NULL)) t(x);

SELECT quantile_cont(x, 0.0 ORDER BY x DESC) FROM (VALUES (1), (2), (2), (NULL)) t(x) WHERE x > 10;

SELECT test_vector FROM test_vector_types(NULL::INTEGER);

CREATE SEQUENCE type_source_calls;

SELECT sum(i) AS "quoted total" FROM (VALUES (1),(2),(2),(4)) t(i) WHERE i>1;

CREATE TABLE lhs(i INTEGER);

SELECT i,o FROM range(100000) WITH ORDINALITY t(i,o) WHERE o>99995 ORDER BY o;

SELECT write_log('not emitted', disable_logging := true, return_value := 42::INTEGER);

SELECT s LIKE 'a%' FROM (VALUES ('abc'),('xyz')) t(s);

SELECT i FROM t WHERE i<j;

CREATE TABLE export_transaction(i INTEGER);

SELECT NULL::fallback_empty_enum;

SELECT TRY_CAST(CAST(42 AS INTEGER) AS BIGINT);

SELECT 1 > 2;

SELECT 1 IS NOT DISTINCT FROM 2;

SELECT NOT true;

SELECT 1 NOT IN (2,3);

SELECT value FROM (SELECT row(42) AS value);

SELECT abs(i), i + 2, struct_pack(value := i), NOT (i = 7) FROM scalar_values ORDER BY i;

CREATE SCHEMA "number space";

SELECT rowid,n,column0,s.x FROM (SELECT *,row_number() OVER () n FROM "number space".numbers) t ORDER BY rowid;

SET disabled_optimizers='window_rewriter';

SELECT
	map([]::INTEGER[],[]::TUPLE(SMALLINT,VARCHAR)[]),
	typeof(map([]::INTEGER[],[]::TUPLE(SMALLINT,VARCHAR)[])),
	get_type(NULL::DECIMAL(13,4)),
	typeof(get_type(NULL::DECIMAL(13,4))),
	get_type(NULL::TUPLE(SMALLINT,VARCHAR)),
	typeof(get_type(NULL::TUPLE(SMALLINT,VARCHAR))),
	get_type(NULL::TYPE),
	typeof(get_type(NULL::TYPE)),
	NULL::TYPE,
	typeof(NULL::TYPE),
	[get_type(NULL::SMALLINT),NULL::TYPE],
	typeof([get_type(NULL::SMALLINT),NULL::TYPE]),
	[]::TYPE[],
	typeof([]::TYPE[]),
	{'type': get_type(NULL::TUPLE(SMALLINT,VARCHAR)[])},
	typeof({'type': get_type(NULL::TUPLE(SMALLINT,VARCHAR)[])});

SELECT CAST(NULL::TUPLE(VARCHAR) AS TUPLE(SMALLINT));

EXPLAIN (SQL) SELECT CAST(row('bad')::TUPLE(VARCHAR) AS TUPLE(SMALLINT));

EXPLAIN (SQL) SELECT union_tag(u),union_extract(u,'v'),union_extract(u,'v')='a',u IS NULL FROM (SELECT union_value(v := 'A' COLLATE NOCASE) u);

EXPLAIN (SQL) SELECT union_tag(u),union_extract(u,'v'),u IS NULL FROM (SELECT CASE WHEN false THEN union_value(v := 'A' COLLATE NOCASE) ELSE NULL END u);

EXPLAIN (SQL) SELECT union_tag(u),union_extract(u,'v'),union_extract(u,'v')[1]='a' FROM (SELECT union_value(v := ['A' COLLATE NOCASE,NULL]) u);

EXPLAIN (SQL) SELECT [union_value(v := 'A' COLLATE NOCASE),union_value(v := NULL::VARCHAR COLLATE NOCASE),NULL];

EXPLAIN (SQL) SELECT i%2,union_extract(min(union_value(v := s COLLATE NOCASE)), 'v') FROM (VALUES (0,'A'),(1,'b'),(2,NULL))t(i,s) WHERE s='missing' GROUP BY ROLLUP(i%2) ORDER BY ALL;

CREATE TYPE alias_union AS UNION(v GEOMETRY('OGC:CRS84'));

INSERT INTO union_export_input VALUES (42), (NULL), (42), (-7);

SELECT union_tag(u), union_tag(union_extract(u, 'outer member')),
       union_extract(union_extract(u, 'outer member'), 'inner member')
FROM (SELECT union_value("outer member" := union_value("inner member" := i)) u FROM union_export_input);

EXECUTE union_export_parameter(2);

SELECT count(*) FROM values_input a,
values_input b JOIN LATERAL (VALUES (a.v),(-1)) ss(x) ON b.v=ss.x;

CREATE SEQUENCE values_input_sequence;

CREATE SEQUENCE values_guard;

SELECT x,y,row_number() OVER () FROM (VALUES (1,10),(2,20),(2,NULL),(3,30),(NULL,40)) t(x,y);

SELECT x,y,first_value(y IGNORE NULLS) OVER (ORDER BY x),last_value(y) OVER (ORDER BY x),nth_value(y,3) OVER (ORDER BY x) FROM (VALUES (1,10),(2,20),(2,20),(3,NULL),(NULL,40)) t(x,y);

SELECT x,y,sum(y) OVER (ORDER BY x RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM (VALUES (1,10),(2,20),(2,NULL),(3,30),(NULL,40)) t(x,y);

SELECT row_number() OVER () FROM (SELECT 1 WHERE false);

SELECT unnest(x,recursive:=true) FROM (VALUES([[1,NULL],[2]]),([[3]]))t(x);

SELECT r, o FROM range((SELECT 10)) WITH ORDINALITY t(r,o) WHERE o > 4 ORDER BY r, o;

INSERT INTO ctas_src VALUES (1,'x'),(2,'y'),(3,'z');

EXPLAIN (SQL) CREATE OR REPLACE TEMP TABLE ctas_tmp AS SELECT a + 1 AS n FROM ctas_src;

CREATE TABLE empty_t(c0 INTEGER);

SELECT count(*) FROM (SELECT 1 FROM (DESCRIBE SELECT 1 AS n) LIMIT 1);

SELECT count(*) FROM (SELECT 1 FROM (SELECT 1 FROM (DESCRIBE SELECT 1 AS a, 2 AS b, 3 AS c) LIMIT 2) LIMIT 1);

SELECT count(*) FROM (SELECT 1 FROM (DESCRIBE SELECT 1 AS a, 2 AS b) WHERE column_name='b' LIMIT 1);

SELECT count(*) FROM (SELECT DISTINCT 1 FROM (DESCRIBE SELECT 1 AS a, 2 AS b));

SELECT count(*) FROM (SELECT 1 FROM empty_t HAVING true);

EXPLAIN (SQL) SELECT count(*) FROM (DESCRIBE SELECT 1 AS a, 2 AS b);
