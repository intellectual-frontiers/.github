SELECT typeof(s) FROM (SELECT sum(1) AS s UNION ALL SELECT sum(1) EXPORT_STATE) t LIMIT 1;

SELECT finalize(approx_count_distinct(i) EXPORT_STATE) FROM (SELECT 1 AS i WHERE false) t;

SELECT finalize(combine_aggr(s)) FROM (
    SELECT approx_count_distinct(v) EXPORT_STATE s FROM (VALUES (1::BIGINT),(NULL)) input(v)
    UNION ALL
    SELECT approx_count_distinct(v) EXPORT_STATE s FROM (VALUES ('a'),(NULL)) input(v)
) input;

SELECT finalize(approx_quantile(ts, 0.5) EXPORT_STATE) = approx_quantile(ts, 0.5) FROM (SELECT TIMESTAMP '2000-01-01' + INTERVAL (range) DAY AS ts FROM range(100)) t;

SELECT g, finalize(s) FROM approx_state ORDER BY g;

SELECT approx_top_k(x, 2), approx_top_k(x, 1) FROM (VALUES ('a'), ('a'), ('b'), ('a'), ('c'), ('b')) t(x);

SELECT (approx_top_k(x, 1) EXPORT_STATE)::STRUCT(k UBIGINT, "values" STRUCT("value" VARCHAR, "count" UBIGINT)[], "filter" UBIGINT[]).k FROM (VALUES ('a'), ('a'), ('b')) t(x);

SELECT finalize(combine(approx_top_k(x, 2) EXPORT_STATE, (SELECT approx_top_k(y, 2) EXPORT_STATE FROM (VALUES ('a'), ('c')) s(y)))) FROM (VALUES ('a'), ('b'), ('a')) t(x);

SELECT finalize(combine(to_aggregate_state({
	'k': 3::UBIGINT,
	'values': []::STRUCT("value" VARCHAR, "count" UBIGINT)[],
	'filter': list_transform(range(128), lambda x: 0::UBIGINT)
}, 'approx_top_k', ['VARCHAR', 'BIGINT']), (SELECT approx_top_k(y, 2) EXPORT_STATE FROM (VALUES ('a'), ('b'), ('a')) s(y))));

SELECT (arg_min_null(a, b) EXPORT_STATE)::STRUCT(arg INTEGER, "by" INTEGER) FROM (VALUES (NULL, 5), (2, 10)) t(a, b);

SELECT finalize(arg_max(a, b) EXPORT_STATE) FROM (VALUES ([1, 2], [10]), ([3], [5])) t(a, b);

SELECT finalize(to_aggregate_state(NULL::STRUCT(arg INTEGER, "by" INTEGER), 'arg_min', ['INTEGER', 'INTEGER']));

SELECT finalize(avg(x) EXPORT_STATE), finalize(avg(x::TIMETZ) EXPORT_STATE) FROM (VALUES (TIME '23:00:00'), (TIME '22:00:00')) t(x);

SELECT finalize(combine_aggr(st)), finalize(combine_aggr(st) FILTER (g < 2)) FROM states;

SELECT finalize(to_aggregate_state({'count': 0, 'value': v}, 'avg', ['TIMESTAMP'])) FROM (VALUES (1::HUGEINT), (2), (3), (5)) t(v) ORDER BY v;

SELECT (sum(x) EXPORT_STATE)::VARCHAR, finalize(sum(x) EXPORT_STATE), sum(x) FROM (VALUES ('170141183460469231731687303715884105727'::BIGNUM), ('170141183460469231731687303715884105727'::BIGNUM), (5::BIGNUM)) t(x);

SELECT finalize(combine_aggr(s)) FROM (
    SELECT sum(x) EXPORT_STATE s FROM (VALUES (1.25::DECIMAL(40,2)), (NULL), ('-99999999999999999999999999999999999999.75'::DECIMAL(40,2))) t(x) GROUP BY x
);

SELECT finalize(bool_and(v) EXPORT_STATE) FROM (VALUES (true), (true)) t(v);

SELECT bool_or(v) EXPORT_STATE FROM (VALUES (false), (true)) t(v);

SELECT finalize(combine_aggr(to_aggregate_state(v, 'sum', ['INTEGER']))) FROM (VALUES (1), (2)) t(v);

SELECT finalize(to_aggregate_state(3::BIGINT, 'count', ['BIGINT'])),
       finalize(to_aggregate_state(3::BIGINT, 'count', [make_type('VARCHAR')])),
       finalize(to_aggregate_state(3::BIGINT, 'count_star', []));

SELECT finalize(first(NULL::INTEGER) EXPORT_STATE);

SELECT finalize(first(v) EXPORT_STATE), finalize(last(v) EXPORT_STATE)
FROM (VALUES ('this-is-a-very-long-string-that-is-not-inlined'), ('apple'), ('this-is-another-very-long-string')) t(v);

SELECT g, first(d), last(d), any_value(d) FROM dummy GROUP BY g ORDER BY g;

SELECT finalize(to_aggregate_state(NULL::STRUCT(value INTEGER), 'first', ['INTEGER']));

FROM legacy.t;

SELECT finalize(list(i) EXPORT_STATE) FROM (SELECT NULL::INTEGER AS i WHERE false) t;

SELECT finalize(list(m) EXPORT_STATE) FROM (VALUES (MAP {'k': 1}), (MAP {})) t(m);

SELECT finalize(combine(list(i) EXPORT_STATE, (SELECT list(j) EXPORT_STATE FROM (SELECT NULL::INTEGER j WHERE false) s))) FROM (VALUES (1), (2)) t(i);

SELECT list_bool_and([*columns(*)]) = true FROM (SELECT finalize(list(columns(*)) EXPORT_STATE) IS NOT DISTINCT FROM list(columns(*)) FROM test_all_types());

SELECT max(v) EXPORT_STATE FROM (VALUES ('long-string-banana'), ('long-string-apple'), ('long-string-cherry')) t(v);

SELECT (min(d) EXPORT_STATE)::VARCHAR FROM (VALUES (DATE '2000-01-01'), (DATE '2010-01-01')) t(d);

SELECT finalize(list(l_orderkey ORDER BY l_quantity) EXPORT_STATE) FROM lineitem;

SELECT finalize(list(i ORDER BY i) EXPORT_STATE) FROM (SELECT 1 AS i WHERE false) t;

SELECT g, finalize(arg_max(v, v ORDER BY v) EXPORT_STATE)
FROM (VALUES (0, 30), (0, 10), (0, 20), (1, 5), (1, 9)) t(g, v) GROUP BY g ORDER BY g;

SELECT count(*) FROM (
    SELECT g, list(v ORDER BY v) AS direct FROM narrow GROUP BY g
) d JOIN (
    SELECT g, finalize(list(v ORDER BY v) EXPORT_STATE) AS exported FROM narrow GROUP BY g
) e USING (g)
WHERE d.direct IS DISTINCT FROM e.exported;

CREATE TABLE ordered_state AS SELECT g, list(v ORDER BY v) EXPORT_STATE l FROM narrow GROUP BY g;

SELECT finalize(to_aggregate_state(
    [{'v0': 'b', 'v1': 2}, {'v0': 'a', 'v1': 1}, {'v0': 'c', 'v1': 3}],
    'string_agg', ['VARCHAR', 'VARCHAR'], [NULL, ' '],
    [{'column': 1, 'order': 'ASC NULLS LAST'}]
));

SELECT count(i ORDER BY k) FROM (SELECT 1 i, 1 k) WHERE false;

CREATE TABLE y(s VARCHAR);

SELECT finalize(combine(
    product(v) EXPORT_STATE,
    product(v) EXPORT_STATE
)) FROM (SELECT NULL::double AS v WHERE false) t;

SELECT typeof(sum(1.12::DECIMAL) EXPORT_STATE);

CREATE TABLE t2_count_int AS SELECT count(range::INT) EXPORT_STATE as state FROM range(10);

SELECT typeof(avg(TIME '12:00:00' ) EXPORT_STATE);

SELECT typeof(first(42) EXPORT_STATE);

CREATE TABLE t3_product AS SELECT product(range::DOUBLE) EXPORT_STATE as state FROM range(1, 6);

SELECT finalize(product(1.0::DOUBLE) EXPORT_STATE) IS NULL FROM (SELECT 1 WHERE FALSE);

SELECT typeof(regr_sxx(1.0, 2.0) EXPORT_STATE);

SELECT (regr_avgx(1.0, 2.0) export_state)::struct(sum double, count ubigint);

select finalize(combine_aggr(state))::integer from states where g = 0;

WITH states AS (
    SELECT
        avg(3::SMALLINT) EXPORT_STATE AS smallint_s,
        avg(3::HUGEINT) EXPORT_STATE AS hugeint_s,
        avg(3::DOUBLE) EXPORT_STATE AS double_s,
        avg(INTERVAL '3 days') EXPORT_STATE AS interval_s,
        avg(TIMESTAMP '2020-01-03 12:00:00') EXPORT_STATE AS timestamp_s,
        avg(TIMETZ '12:00:00+02') EXPORT_STATE AS timetz_s
)
SELECT
    finalize(combine_aggr(smallint_s, 3)) = 3,
    finalize(combine_aggr(hugeint_s, 3)) = 3,
    finalize(combine_aggr(double_s, 3)) = 3,
    finalize(combine_aggr(interval_s, 3)) = INTERVAL '3 days',
    finalize(combine_aggr(timestamp_s, 3)) = TIMESTAMP '2020-01-03 12:00:00',
    finalize(combine_aggr(timetz_s, 3)) = TIMETZ '10:00:00+00'
FROM states;

select finalize(combine(combine_aggr(state), (select avg(d) export_state from dummy where d < 10)))::integer from states;

CREATE TABLE state AS SELECT g, corr(d, d+1) EXPORT_STATE corr_state FROM dummy GROUP BY g;

SELECT samp_state::STRUCT(count UBIGINT, meanx DECIMAL(18,2), meany DECIMAL(18,2), co_moment DOUBLE) FROM covar_state;

CREATE TABLE t AS SELECT i % 3 AS g, i % 10 AS v FROM range(30) r(i);

SELECT finalize(combine_aggr(s)) FROM (SELECT g, string_agg(v ORDER BY v) EXPORT_STATE AS s FROM t WHERE v < 3 GROUP BY g);

SELECT finalize(to_aggregate_state([{'v0': 1::BIGINT, 'k': 'b'}, {'v0': 2::BIGINT, 'k': 'a'}], 'list', ['VARCHAR'], NULL, [{'column': 1, 'order': 'ASC NULLS FIRST'}]));

SELECT finalize(skewness(d) EXPORT_STATE) FROM dummy;

SELECT skewness(d) FROM (SELECT NULL::integer d);

SELECT quantile_disc(d, 0.5) FROM dummy;

SELECT finalize(quantile_disc(d, [0.25, 0.5, 0.75]) EXPORT_STATE) FROM dummy;

SELECT g, finalize(quantile_cont(d, 0.5) EXPORT_STATE) FROM dummy GROUP BY g ORDER BY g;

SELECT finalize(combine(
	(SELECT quantile_disc(d, 0.5) EXPORT_STATE FROM dummy WHERE d < 50),
	(SELECT quantile_disc(d, 0.5) EXPORT_STATE FROM dummy WHERE d >= 50)));

SELECT median([d, d + 1]) FROM dummy;

SELECT quantile_disc(s, [0.1, 0.5, 0.9]) FROM big;

SELECT finalize(string_agg(d, '|') EXPORT_STATE) FROM dummy;

SELECT finalize(combine(
	(SELECT string_agg(d, '|') EXPORT_STATE FROM dummy WHERE d < 3),
	(SELECT string_agg(d, '|') EXPORT_STATE FROM dummy WHERE FALSE)));

SELECT finalize(to_aggregate_state(string_agg(d) EXPORT_STATE, 'string_agg', ['VARCHAR'])) FROM dummy;

SELECT corr(d, d+1) FROM dummy;

SELECT finalize(regr_count(d, d+1) EXPORT_STATE) FROM dummy;

SELECT regr_intercept(d, d+1) FROM dummy;

SELECT finalize(regr_syy(d, d+1) EXPORT_STATE) FROM dummy;

SELECT g, finalize(slope_state), finalize(count_state) FROM state_regr ORDER BY g;

SELECT g, sum(d)*2 combined_sum FROM dummy GROUP BY g ORDER BY g;

SELECT avg(d)::integer, count(d), min(d), max(d), first(d), last(d), kurtosis(d), kurtosis_pop(d) FROM (SELECT NULL::integer d);

select FINALIZE(argmin(a,b) EXPORT_STATE), FINALIZE(argmax(a,b) EXPORT_STATE) from (values (1,1), (2,2), (8,8), (10,10)) s(a,b);

SELECT (bit_and(42) export_state)::UINTEGER;

SELECT g, finalize(kurtosis(d) EXPORT_STATE) FROM dummy GROUP BY g ORDER BY g;

CREATE TABLE state AS SELECT g, avg(d) EXPORT_STATE avg_state, count(d) EXPORT_STATE count_state, first(d) EXPORT_STATE first_state, last(d) EXPORT_STATE last_state, min(d) EXPORT_STATE min_state, max(d) EXPORT_STATE max_state FROM dummy GROUP BY g ORDER BY g;

CREATE TABLE stored_big_string_state AS 
SELECT 
    g,
    first(big_str) EXPORT_STATE as first_state
FROM big_string_test 
GROUP BY g;

create table stddev_test(val integer, grp integer);

SELECT sem_state::STRUCT(count UBIGINT, mean DOUBLE, dsquared DECIMAL(18,2)) FROM stddev_state;

SELECT finalize(min(v) EXPORT_STATE) FROM (SELECT NULL::struct(a int, b varchar) AS v WHERE false) t;

SELECT finalize(min(v) EXPORT_STATE) FROM (VALUES ([3, 2]), ([1, 5]), ([2, 0])) t(v);

SELECT finalize(combine_aggr(s)) FROM (
    SELECT min({'a': v}) EXPORT_STATE AS s FROM (SELECT NULL::struct(a int) AS v WHERE false) t
    UNION ALL
    SELECT min({'a': v}) EXPORT_STATE AS s FROM (SELECT NULL::struct(a int) AS v WHERE false) t
) t;

SELECT approx_quantile(x, 0.5) FROM (VALUES (0.25::DECIMAL(18,2)), (0.25), (0.25)) v(x);

SELECT approx_quantile(TIMESTAMP_NS 'infinity', 0.5), approx_quantile(ts, 0.5) FROM (VALUES (TIMESTAMP_NS '-infinity'), (TIMESTAMP_NS '-infinity')) t(ts);

CREATE TABLE t AS SELECT i % 5000 AS g, (i * 7919) % 997 AS v FROM range(120000) r(i);

SELECT list_sort(approx_top_k(even_groups, 10)) FROM integers;

SELECT g FROM (SELECT g, approx_top_k(v, 3 ORDER BY v DESC) k FROM ordered_groups GROUP BY g)
WHERE len(k) <> 3;

SET threads=2;

CREATE TABLE t1 (val VARCHAR, arg INT);

SELECT min(v), max(v), min(v, 2), max(v, 2) FROM (VALUES (1),(4),(1),(NULL)) input(v);

SELECT l_returnflag, max(l_orderkey, 3) FROM lineitem GROUP BY ALL ORDER BY ALL;

SELECT arg_max_nulls_last(val, val, 4) FROM tbl;

SELECT grp, arg_min_nulls_last(arg, val, 2) FROM tbl GROUP BY grp ORDER BY grp;

SELECT approx_quantile(TIMESTAMP_MS '3000-01-01', 0.5);

SELECT avg, q25, q50, q75 FROM (SUMMARIZE ts_s);

SELECT avg(d) FROM (VALUES (DATE '1600-01-01'), (DATE '2400-01-01')) t(d);

SELECT equi_width_bins(0, 10, 5, true);

SELECT equi_width_bins(0, 39343341, 10, true);

SELECT equi_width_bins(0.0, 9.0, 5, true);

SELECT unnest(equi_width_bins(-1e308, 1e308, 5, true));

select equi_width_bins(0.0, 3.974, 7, true) AS boundaries;

SELECT equi_width_bins(timestamp '1992-01-01', timestamp '2000-01-01', 2, true);

SELECT equi_width_bins(timestamp '1992-01-01 01:23:01.999', timestamp '1992-01-01 01:23:49.377', 4, true);

SELECT equi_width_bins(1::BIGINT, 2::BIGINT, 1000000, false);

SELECT equi_width_bins(1.0, 1.0000000000000002, 3, false);

SET max_temp_directory_size='0B';

CREATE TABLE src AS
SELECT (i // 2)::BIGINT AS g, ((i * 7) % 96)::INTEGER AS v
FROM range(2000000) t(i);

EXPLAIN (SQL) FROM (VALUES ('g','p',1.0),('h','q',2.0)) t(g,k,v)
PIVOT (quantile_cont(v, 0.5) FOR k IN ('p','q'));

RESET pivot_filter_threshold;

SELECT first(s), last(s), any_value(s) FROM (VALUES ('abc'), ('de')) t(s);

SELECT mode(s) FROM (VALUES ('a'), ('b'), ('b')) t(s);

SELECT histogram_exact(n::varchar, [10, 20, 30, 40, 50]::VARCHAR[]) FROM obs;

SELECT histogram_exact(1::INTEGER, [0.6]);

insert into integers values (42);

SELECT COUNT(*), AVG(count) FROM histogram_values('integers', i, technique := 'equi-height');

SELECT * FROM histogram_values('booleans', b::INTEGER);

SELECT lttb(x::DOUBLE, y::DOUBLE, 4 ORDER BY x)
FROM (SELECT i AS x, (i * i)::DOUBLE AS y FROM range(10) t(i));

SELECT lttb(x::DOUBLE, NULL::DOUBLE, 5 ORDER BY x) FROM range(10) t(x);

SELECT lttb(ts, y, 3 ORDER BY ts)
FROM (
    VALUES
        (TIMESTAMPTZ '2020-01-01 00:00:00+00', 0::DOUBLE),
        (TIMESTAMPTZ '2020-01-01 01:00:00+00', 1::DOUBLE),
        (TIMESTAMPTZ '2020-01-01 02:00:00+00', 2::DOUBLE),
        (TIMESTAMPTZ '2020-01-01 03:00:00+00', 3::DOUBLE),
        (TIMESTAMPTZ '2020-01-01 04:00:00+00', 4::DOUBLE)
) t(ts, y);

SELECT len(lttb((x // 2)::DOUBLE, x::DOUBLE, 4 ORDER BY x))
FROM range(10) t(x);

INSERT INTO lttb_states VALUES ([NULL, NULL]);

CREATE OR REPLACE TABLE agg_table AS SELECT grp_col as grp, max(val_col, 2) as res FROM tbl GROUP BY ALL ORDER BY ALL;

SELECT min(v, 2), arg_max(v, v, 2) FROM vals;

CREATE TABLE mode_rewrite(g INTEGER, v VARCHAR, ord INTEGER, keep BOOLEAN);

SELECT mode(v), count(DISTINCT ord), sum(ord)
FROM mode_rewrite
WHERE g = 1;

SELECT g,
	mode(v ORDER BY ord) FILTER (WHERE keep),
	mode(ord) FILTER (WHERE false)
FROM mode_rewrite
GROUP BY g
ORDER BY g;

INSERT INTO mode_rewrite_errors VALUES ('bad', false), ('1', true);

SET explain_output='optimized_only';

SET enable_optimizer=true;

SELECT quantile_disc(v, 0.5::DECIMAL(2,1)) FROM (VALUES (1), (2)) t(v);

SELECT quantile_cont(ts, 0.00000000000000000001)
FROM (VALUES ('290309-12-22 (BC) 00:00:00'::TIMESTAMP), ('294247-01-10 04:00:54.775806'::TIMESTAMP)) t(ts);

SELECT median(ts) OVER (ORDER BY ts ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
FROM (VALUES ('2000-01-01'::TIMESTAMP), ('2000-01-03'::TIMESTAMP)) t(ts) QUALIFY ts = '2000-01-03';

WITH my_data as (
        SELECT 'text1'::varchar(1000) as my_column union all
        SELECT 'text1'::varchar(1000) as my_column union all
        SELECT 'text1'::varchar(1000) as my_column
    )
        SELECT string_agg(my_column,', ') as my_string_agg
        FROM my_data;

SELECT bool_and(a IS NOT DISTINCT FROM b) FROM (SELECT sum(x) AS a, sum(x::HUGEINT) AS b FROM t WHERE i%2048=2047 GROUP BY i%7);

SELECT sum(bal), sum(small_bal), sum(c.id), count(*)
FROM c
JOIN s ON c.nk = s.nk
LEFT JOIN n ON c.nk = n.nk AND n.nk < -1
GROUP BY n.rk
HAVING ((count(*) <> 92.44) OR (n.rk < 0));

SELECT sum_no_overflow(d), typeof(sum_no_overflow(d)) FROM big WHERE b > 9223372036854775798;

SELECT column_name, column_type, avg IS NULL FROM (SUMMARIZE SELECT '2020-01-01 00:00:00'::TIMESTAMPTZ_NS AS ts);

SELECT a, COUNT(*), COUNT(s) FROM test GROUP BY a ORDER BY a;

INSERT INTO test_strings VALUES ('aaaaaaaahello'), ('bbbbbbbbbbbbbbbbbbbbhello'), ('ccccccccccccccchello'), ('aaaaaaaaaaaaaaaaaaaaaaaahello');

SELECT g, COUNT(*), COUNT(s), MIN(s), MAX(s), STRING_AGG(s, ' ') FROM strings GROUP BY g ORDER BY g;

SELECT COUNT(*), COUNT(b), MIN(b), MAX(b) FROM booleans WHERE b IS NULL;

SELECT COUNT(*), COUNT(i), MIN(i), MAX(i), SUM(i) FROM INTEGERS WHERE i IS NULL;

SELECT MIN(1, 2);

SELECT STRING_AGG('hello');

INSERT INTO tbl VALUES (NULL), (2), (3);

DROP TABLE five;

SELECT ANY_VALUE(dt::TIMESTAMPTZ), ANY_VALUE(t::TIMETZ) FROM five_dates;

SELECT i % 3 AS g, ANY_VALUE(s), ANY_VALUE(l), ANY_VALUE(r)
FROM five_complex
GROUP BY 1
ORDER BY 1;

SELECT ANY_VALUE(b) FROM tbl;

SELECT ANY_VALUE(i) FROM (VALUES (NULL::INT32)) tbl(i);

SELECT CASE
	  WHEN ( approx_quantile between (true_quantile - 100) and (true_quantile + 100) )
		  THEN TRUE
		  ELSE FALSE
	  END
	  FROM (SELECT approx_quantile(42, 0.5)  as approx_quantile ,quantile(42, 0.5)  as true_quantile) AS T;

SELECT [
	(a[1] BETWEEN (q[1] - 100) AND (q[1] + 100)),
	(a[2] BETWEEN (q[2] - 100) AND (q[2] + 100)),
	(a[3] BETWEEN (q[3] - 100) AND (q[3] + 100)),
	]
FROM (
	SELECT approx_quantile(r, [0.25, 0.5, 0.75]) AS a,
		   quantile(r, [0.25, 0.5, 0.75]) AS q,
	FROM quantile
) tbl;

SELECT CASE
	  WHEN (approx_quantile between (true_quantile - (sumr * 0.01)) and (true_quantile + (sumr * 0.01)))
		  THEN TRUE
		  ELSE FALSE
	  END
	  FROM (SELECT approx_quantile(r, 0.5) as approx_quantile, quantile(r, 0.5) as true_quantile, SUM(r) as sumr from quantile) AS T;

SELECT reservoir_quantile(1, 0.5, 1) FROM quantile;

RESET threads;

SELECT approx_quantile(1.55::DECIMAL(9,2), 0.5), typeof(approx_quantile(1.55::DECIMAL(9,2), 0.5));

SELECT approx_quantile('-infinity'::TIMESTAMP, 0.25), approx_quantile('infinity'::TIMESTAMP, 0.25);

SELECT approx_quantile(t, 0.5) FROM (VALUES (TIMESTAMP '2020-01-01'), (TIMESTAMP '2020-01-02'), (TIMESTAMP '2020-01-03')) v(t);

SELECT approx_quantile(x, [0.0, 1.0])::VARCHAR FROM (VALUES ('10:00:00+05'::TIMETZ), ('09:00:00+00'::TIMETZ)) t(x);

select approx_count_distinct(i) from range (100) tbl(i) WHERE 1 == 0;

create  table t as select range a, mod(range,10) b from range(2000);

SELECT COUNT(t),approx_count_distinct(t) from names;

select argmin(NULL,NULL);

select argmax(i,i) from range (100) tbl(i) where 1 = 0;

SELECT min(z) - arg_min(z,z) FROM hugeints;

create table names (name string, salary integer);

CREATE OR REPLACE TABLE employees(
	employee_id NUMERIC,
	department_id NUMERIC,
	salary NUMERIC);

select arg_min(first_name,last_name),arg_max(first_name,last_name)  from names;

select arg_max_null(i,i) from range (100) tbl(i);

select arg_min_null(a,b) over ( partition by a%2) from args;

CREATE SEQUENCE seq;

INSERT INTO intervals VALUES 
	('1 day'), 
	('30 days'), 
	('30 days'), 
	('30 days'), 
	('30 days');

SELECT AVG(i), AVG(j), AVG(k) FROM vals;

CREATE TABLE timetzs (ttz TIMETZ);

SELECT column_name, avg FROM (SUMMARIZE (SELECT * FROM (VALUES ('infinity'::TIMESTAMP), ('-infinity'::TIMESTAMP)) t(ts)));

SELECT avg(DISTINCT ts), avg(ts ORDER BY ts DESC), avg(DISTINCT ts) FILTER (ts < TIMESTAMP '2001-01-01')
FROM (VALUES ('infinity'::TIMESTAMP), ('infinity'::TIMESTAMP), (TIMESTAMP '2000-01-01'), ('-infinity'::TIMESTAMP)) t(ts);

SELECT i, avg(ts) OVER (PARTITION BY i % 2), avg(DISTINCT ts) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
FROM (VALUES (1, TIMESTAMP '2000-01-01'), (2, '-infinity'::TIMESTAMP), (3, TIMESTAMP '2000-01-03'), (4, TIMESTAMP '2000-01-05')) t(i, ts)
ORDER BY i;

SELECT histogram(n, [10, 20, 30, 40]) FROM obs;

SELECT histogram(v, [-9223372036854775808, -9223372036854775807, 9223372036854775807]) FROM
(VALUES (-9223372036854775808), (-9223372036854775807), (0), (9223372036854775807)) t(v);

SELECT histogram(n, [10, 10, 10, 10]) FROM obs;

SELECT histogram(d, [TIMESTAMP '2020-06-01']) FROM (VALUES (DATE '2020-01-01')) t(d);

SELECT typeof(histogram(v, ['a', 'b'])) FROM (VALUES ('a'::small_enum)) t(v);

EXECUTE binned([10, 20, 30, 40, 50]);

SELECT BIT_AND(i) FROM integers WHERE i > 100;

SELECT BIT_OR(nextval('seq'));

SELECT BIT_XOR(3), BIT_XOR(NULL);

SELECT BIT_XOR('0010101010101010101101011'::BIT) from bits;

SELECT BITSTRING_AGG(i) FROM smallints;

INSERT INTO bigints VALUES(2378097), (2378100), (2378095), (2378104), (NULL), (2378113), (2378100), (2378095), (2378105), (2378097);

INSERT INTO uhugeints VALUES(12243372036854775807), (12243372036854778191), (12243372036854730332), (12243372036854773737), (12243372036854737711), (12243372036854722124), (12243372036854778191);

SELECT COUNT(DISTINCT i) FROM bigints;

SELECT BITSTRING_AGG(3);

INSERT INTO groups VALUES(10, 'a'), (13, 'b'), (9, 'a'), (16, 'c'), (NULL, 'd'), (2, 'a'), (6, 'c'), (9, 'b');

SELECT bit_count(bitstring_agg(v)), bit_length(bitstring_agg(v)) FROM bs;

SELECT bool_or(True) FROM range(100);

select d,bool_or(d > '2021-02-09') AS or_result,
       bool_and(d > '2021-02-09') AS and_result
from t
group by d
order by d;

select k, corr(v, v2) from aggr group by k ORDER BY ALL;

SELECT COUNT(*), COUNT(1), COUNT(i), COUNT(COALESCE(i, 1)), COUNT(DISTINCT i), COUNT(DISTINCT 1) FROM integers;

INSERT INTO int FROM range(88);

SELECT rowid // 200 AS g, COUNT(i), COUNT(rowid) FROM int GROUP BY g;

DROP TABLE b;

INSERT INTO b VALUES (NULL, NULL);

SELECT count(*), count(nx.*), count(ny.*) FROM nx FULL OUTER JOIN ny ON nx.v IS NOT DISTINCT FROM ny.v;

CREATE TABLE r(id INT, y VARCHAR);

SELECT l.id FROM l LEFT JOIN r ON l.id = r.id GROUP BY l.id HAVING count(r.*) > 0 ORDER BY 1;

SELECT l.id, count(r.*) FROM l LEFT JOIN r ON l.id = r.id GROUP BY ALL ORDER BY 1;

SELECT count(l.*), count(r.*) FROM l FULL OUTER JOIN r ON l.id = r.id;

SELECT count(t.*) FROM l LEFT JOIN (SELECT * FROM r) t ON l.id = t.id;

SELECT count(st.*) FROM (SELECT {'x': 1, 'y': 2} AS st) t;

PREPARE p AS SELECT count(r.*) FROM l LEFT JOIN r ON l.id = r.id WHERE l.id > ?;

CREATE TABLE piv(g INT, y VARCHAR);

INSERT INTO integers VALUES (3, 4), (3, 4), (2, 4);

SELECT COVAR_POP(nextval('seqx'),nextval('seqy'));

SELECT avg(x := 1.5::DECIMAL(4,1)), sum(arg := 2.5), avg(i), sum(i) FROM range(3) t(i);

create table aggr(k int);

select entropy(name) from names;

CREATE OR REPLACE TABLE t AS SELECT i::INTEGER AS i, (i % 7)::INTEGER AS g, CASE WHEN i % 5 = 0 THEN NULL ELSE (i % 100)::INTEGER END AS q, ((i * 3) % 11)::INTEGER AS v, CASE WHEN i % 3 = 0 THEN NULL ELSE 'k' || (i % 4) END AS s FROM range(4097) tbl(i);

SELECT count(*) FILTER (WHERE q > 50), count(*) FILTER (WHERE q IS NULL), count(*) FILTER (WHERE NULL), sum(v) FILTER (WHERE NULL), count(*) FILTER (WHERE q > 50 OR q IS NULL), count(q) FILTER (WHERE q > 50 OR q IS NULL), count(*) FROM t;

SELECT count(DISTINCT g) FILTER (WHERE q < 50), count(DISTINCT g), count(DISTINCT v) FILTER (WHERE q < 50), sum(DISTINCT v) FILTER (WHERE q < 50), count(DISTINCT s) FILTER (WHERE q < 50), count(*) FILTER (WHERE q < 50), sum(v) FILTER (WHERE q < 50) FROM t;

CREATE OR REPLACE TABLE h AS SELECT i, repeat(i::VARCHAR, 32) AS s FROM range(2049) t(i);

SELECT g, count(*), count(q), count(s), sum(v), avg(v), min(i), max(i) FROM t WHERE q BETWEEN 1 AND 20 GROUP BY g ORDER BY g;

SELECT g, count(*) FILTER (WHERE q < 50), sum(v) FILTER (WHERE q < 50), count(*) FILTER (WHERE q >= 50), sum(v) FILTER (WHERE q < 50) FROM t GROUP BY ROLLUP(g) ORDER BY g NULLS LAST;

WITH f AS (SELECT g, [*COLUMNS(* EXCLUDE g)] AS l FROM query('SELECT g, ' || filtered('max(v)', 16) || ', ' || filtered('sum(v)', 16) || ' FROM many GROUP BY g')), r AS (SELECT g, list(x ORDER BY n, k) AS l FROM (SELECT g, k, 0 AS n, max(v) AS x FROM many GROUP BY g, k UNION ALL SELECT g, k, 1, sum(v) FROM many GROUP BY g, k) GROUP BY g) SELECT count(*) FROM f JOIN r USING (g, l);

SELECT FIRST(i ORDER BY grp NULLS LAST) FROM integers;

SELECT ANY_VALUE(i ORDER BY grp DESC NULLS LAST) FROM integers;

SELECT FIRST(b) FROM tbl WHERE a=1 GROUP BY a;

SELECT j * 2 FROM integer GROUP BY j * 2 ORDER BY j * 2;

SELECT integer.j * 2 FROM integer GROUP BY integer.j * 2 ORDER BY integer.j * 2;

WITH d(v) AS (
	VALUES (1.0), ('nan'::DOUBLE), ('nan'::DOUBLE), (1.0)
)
SELECT histogram(v)::VARCHAR FROM d;

select histogram(g)
    from hist_data
    group by g%2==0 ORDER BY g%2==0;

SELECT histogram(CAST('15:05:42' AS TIME));

SELECT histogram(e) FROM enums;

create table tmp (c0 integer, c1 integer);

SELECT printf('%.17g', fsum(x)),
	printf('%.17g', kahan_sum(x)),
	printf('%.17g', sumkahan(x)),
	printf('%.17g', sum(x)),
	printf('%.17g', favg(x)),
	printf('%.17g', avg(x))
FROM doubles;

SELECT printf('%.17g', fsum(v)) FROM (
	SELECT 3.6686354453820154e17::DOUBLE AS v
	UNION ALL SELECT 37.0::DOUBLE FROM range(14)
	UNION ALL SELECT -3.6686354453820154e17::DOUBLE
);

SELECT fsum(v), favg(v) FROM (VALUES (NULL::DOUBLE)) t(v);

SELECT sumKahan(n)::BIGINT FROM doubles;

create table aggr(k int, v int, v2 int);

SELECT kurtosis(x), kurtosis_pop(x) FROM (VALUES (1000000.0), (1000000.0), (1000000.0), (1000000.001)) t(x);

SELECT i % 3 AS g, LAST(i ORDER BY 5-i) FROM five GROUP BY 1 ORDER BY 1;

SELECT LAST(dt::TIMESTAMPTZ), LAST(t::TIMETZ) FROM five_dates;

SELECT LAST(s ORDER BY 5-i), LAST(l ORDER BY 5-i), LAST(r ORDER BY 5-i)
FROM five_complex;

SELECT a, LAST(b) FROM tbl GROUP BY a ORDER BY a;

SELECT mad('2018-01-01'::TIMESTAMP + INTERVAL (r) HOUR) FROM numerics;

select mad(x) from (values
	('294247-01-10 04:00:54.775806'::timestamp),
	('290309-12-22 (BC) 00:00:00'::timestamp)
	) tbl(x);

SELECT median(r::float)::VARCHAR FROM quantile;

SELECT median(r::decimal(10,2))::VARCHAR FROM quantile;

SELECT MEDIAN(range::timestamptz) 
FROM range('2024-01-01'::date, '2024-01-11'::date, INTERVAL 1 DAY);

DESCRIBE SELECT max(l) from (select unnest( [{'a':1}::JSON, [2]::JSON ]) as l);

insert into aggr (k, v) values (2, 20),(2, 20), (2, 25), (2, 30);

create table dates (k int, v date);

select mode(v) from times;

select k, v, mode(v) over (partition by k)
    from timestamps
    order by k, v;

insert into hugeints values (1, 5), (1, 5), (2, 5), (2, 2), (2, 2), (3, 1), (1, null);

CREATE TABLE parallel_mode AS SELECT i % 20000 AS g,
	md5((CASE WHEN i // 20000 < 6 THEN i % 20000 % 7 ELSE (i % 20000 + i // 20000) % 31 + 7 END)::VARCHAR) AS s
FROM range(200000) r(i);

INSERT INTO t1 VALUES(-7650527153348320600,NULL);

INSERT INTO t1 VALUES(-6350463272352412486,NULL);

INSERT INTO t1 VALUES(-4928993529687100359,NULL);

INSERT INTO t1 VALUES(-3297429447844697659,NULL);

INSERT INTO t1 VALUES(-1554405226393925625,NULL);

INSERT INTO t1 VALUES(-542467477806120649,NULL);

INSERT INTO t1 VALUES(672222439154311688,NULL);

INSERT INTO t1 VALUES(2026591599286391832,NULL);

INSERT INTO t1 VALUES(2848885963459816804,NULL);

INSERT INTO t1 VALUES(4690678276679226532,NULL);

INSERT INTO t1 VALUES(5849452934504718062,NULL);

INSERT INTO t1 VALUES(7612353589185494102,NULL);

INSERT INTO t1 VALUES(8757751876611013998,NULL);

INSERT INTO integers VALUES (1, 10), (2, 15), (1, 30), (2, 20);

SELECT grp, FIRST(i ORDER BY i) FROM integers GROUP BY grp ORDER BY ALL;

SELECT count(*) FROM (SELECT i % 1000 g, string_agg(md5(i::VARCHAR), ',' ORDER BY i) s FROM range(3000) r(i) GROUP BY g) WHERE s != concat_ws(',', md5(g::VARCHAR), md5((g + 1000)::VARCHAR), md5((g + 2000)::VARCHAR));

SELECT "dest", percentile_disc([0.25, 0.5, 0.75]) WITHIN GROUP (ORDER BY "arr_delay") AS "iqr_delay"
FROM "flights"
GROUP BY "dest";

SELECT MODE() WITHIN GROUP (ORDER BY order_occurrences DESC) FROM (
VALUES
	(500, 1),
	(1000, 2),
	(800, 3),
	(1000, 4),
	(500, 5),
	(550, 6),
	(400, 7),
	(200, 8),
	(10, 9)
) items_per_order(order_occurrences, item_count);

SELECT year, SUM(val), COUNT(val), COUNT(*) FROM timeseries GROUP BY year ORDER BY year;

SELECT COUNT(DISTINCT i), MIN(i), MAX(i), SUM(i) / COUNT(i) FROM (SELECT t::SMALLINT t1 FROM smallints GROUP BY t1) tbl(i);

SELECT PRODUCT(2) FROM range(100);

SELECT quantile_cont(r::decimal(10,2), 0.5) FROM quantile;

SELECT quantile_cont(r, 0.25), quantile_cont(r, 0.5), quantile_cont(r, 0.75) from quantile;

SELECT quantile_cont(r, -0.1) FROM quantile;

SELECT quantile_cont(t, 0.5) FROM tinyints;

SELECT quantile_cont(t, 0.5) FROM (VALUES (2147483642::INTEGER), (2147483644::INTEGER)) tbl(t);

INSERT INTO bigints VALUES (-9223372036854775800), (-9223372036854775800);

SELECT quantile_cont('1990-01-01'::DATE + interval (r/100) day, [0.25, 0.5, 0.75]) FROM quantiles;

SELECT quantile_cont(r, []) FROM quantiles;

SELECT quantile_disc(r, 0.0) FROM quantile;

SELECT 
    percentile_disc(0.8) WITHIN GROUP (ORDER BY x DESC),
    quantile_disc(x, 0.8 ORDER BY x DESC),
FROM 
    (VALUES (2), (1)) _(x);

SELECT mod(r,10) as g, quantile_disc(r, 0.1) FROM quantile GROUP BY 1 ORDER BY 1;

SELECT quantile_disc(r, 0.1) FROM quantile WHERE 1=0;

SELECT quantile_disc(r, [0.1, 0.5, 0.9]) FROM quantiles;

SELECT quantile_disc(r, [0.1, 0.5, 0.9]) FROM quantiles WHERE 1=0;

SELECT quantile_disc(col, [0.1, 0.32, 0.33, 0.34, 0.49, .5, .51, 0.75, 0.9, 0.999, 1])
FROM VALUES (0), (1), (2), (10) AS tab(col);

CREATE TABLE z AS FROM (VALUES ('10:00:00+05'::TIMETZ), ('09:00:00+00'::TIMETZ), ('07:00:00+00'::TIMETZ)) v(x);

select regr_avgx(1,1);

select regr_r2(NULL,NULL);

select regr_sxx(2e230*i, 0) from range(5) tbl(i);

select regr_intercept(NULL,NULL);

select k, regr_r2(v, v2) from aggr group by k ORDER BY ALL;

select  regr_count(v, v2) from aggr;

select  regr_avgx(v, v2) over (partition by k)
    from aggr;

select  regr_sxy(v, v2) over (partition by k)
    from aggr;

SELECT list_aggregate(reservoir_quantile(x, [0.1, 0.9], 1000), 'min') > 50000 AND
       list_aggregate(reservoir_quantile(x, [0.1, 0.9], 1000), 'max') > 800000 FROM range(1000000) t(x);

SELECT COUNT(1), MIN(1), FIRST(1), LAST(1), MAX(1), SUM(1), STRING_AGG('hello', ',') FROM integers;

SELECT
    count(*) as total_rows,
    count(*) FILTER (WHERE i <= 5) as lte_five,
    count(*) FILTER (WHERE i % 2 = 1) as odds
FROM generate_series(1,11) tbl(i);

SELECT
	SUM(pay) FILTER (WHERE gender = 'male'),
	SUM(pay),
	SUM(pay) FILTER (WHERE gender = 'female')
FROM issue3105;

select skewness(v2) from aggr group by v ORDER BY ALL;

SELECT var_samp(1);

select grp, sum(val), round(stddev_pop(val), 1), min(val) from stddev_test group by grp order by grp;

select round(var_pop(val), 1) from stddev_test;

select stddev(0) from range(10);

select var_pop(a) from (values (1.0/0.0), (2.0)) tbl(a);

INSERT INTO strings VALUES (1,'a','/'), (1,'b','-'), (2,'i','/'), (2,NULL,'-'), (2,'j','+'), (3,'p','/'), (4,'x','/'), (4,'y','-'), (4,'z','+');

SELECT STRING_AGG(x ORDER BY x DESC), STRING_AGG(x,'|' ORDER BY x DESC) FROM strings;

INSERT INTO integers (VALUES (1), (2), (3), (NULL));

INSERT INTO integers SELECT * FROM range(0, 1000, 1);

CREATE TABLE bigints(b BIGINT);

SELECT finalize(to_aggregate_state(99999999999999999999999999999999999999, 'sum', ['DECIMAL(38,2)']));

SELECT wavg(3, 3);

CREATE TABLE count_validity AS
SELECT i,
       CASE
           WHEN i < 64 THEN i
           WHEN i < 128 THEN NULL
           WHEN i % 2 = 0 THEN i
           ELSE NULL
       END AS v
FROM range(192) t(i);

CREATE TABLE t1 AS SELECT i, i % 10 AS j FROM range(100000) t(i);

CREATE TABLE empty_table (i INTEGER);

EXPLAIN SELECT DISTINCT i % 100 FROM range(1000000) t(i) LIMIT 10;

EXPLAIN SELECT i % 100, COUNT(*) FROM range(1000000) t(i) GROUP BY 1 LIMIT 10;

SELECT DISTINCT ON (i) i, j FROM integers ORDER BY j;

SELECT DISTINCT ON (key) * FROM distinct_on_test  WHERE key <> 2 ORDER BY key, v1, v2, v3;

SELECT i, j, (SELECT DISTINCT ON(i) j) AS k FROM integers ORDER BY i, j;

SELECT DISTINCT ON(i) i, j, k FROM integers ORDER BY i, j NULLS FIRST, k DESC NULLS LAST;

CREATE TABLE example (
    id               INT,
    person_id        INT,
    address_id       INT,
    effective_date   DATE
);

SET debug_verify_statement = 'explain_sql';

DESCRIBE SELECT DISTINCT ON (b) a, b, c FROM t ORDER BY b, a;

SELECT sum(distinct value), GROUPING_ID(course), course, COUNT(*) FROM students GROUP BY course ORDER BY all;

SELECT GROUPING(course), GROUPING(type), avg(value), GROUPING(course)+GROUPING(type), avg(distinct value), course, type, COUNT(*) FROM students GROUP BY CUBE(students.course, students.type) ORDER BY all;

insert into students
		(course, type, value)
	values
		('CS', 'Bachelor', 20),
		('CS', 'Bachelor', 10),
		('CS', 'PhD', -20),
		('Math', 'Masters', 10),
		('CS', NULL, -15),
		('CS', NULL, 10),
		('Math', NULL, 15);

select count(*), ARG_MIN(distinct value%5, value), course, sum(distinct value), type
	from students
	group by course, grouping sets(type, ())
	order by all;

select sum(distinct value) FILTER (where value % 10 != 0), count(*), course, type, sum(distinct value)
        from students
        group by grouping sets((course, type), (type))
        order by all;

SET order_by_non_integer_literal=true;

INSERT INTO t VALUES (1, 1), (1, 2);

explain select distinct on (id, provider) record_key from test order by id, provider, record_rank desc, record_date;

SELECT g, count(DISTINCT x), sum(DISTINCT x)
FROM distinct_rewrite
GROUP BY g
ORDER BY g;

SELECT count(DISTINCT x), sum(DISTINCT x), avg(DISTINCT x)
FROM distinct_rewrite_nulls
WHERE false;

SELECT g, count(DISTINCT s), string_agg(y::VARCHAR, ',' ORDER BY y DESC)
FROM distinct_rewrite_order
GROUP BY g
ORDER BY g;

INSERT INTO distinct_rewrite_filter_errors VALUES (1, 'bad', false), (1, '1', true);

INSERT INTO supplier VALUES
	(10, 'regular supplier'),
	(20, 'Customer service Complaints pending'),
	(30, 'regular supplier'),
	(40, 'regular supplier'),
	(50, 'regular supplier'),
	(60, 'regular supplier'),
	(70, 'regular supplier'),
	(80, 'regular supplier');

SELECT count(DISTINCT nextval('distinct_rewrite_seq_count')),
       sum(DISTINCT nextval('distinct_rewrite_seq_sum'))
FROM range(4);

SELECT currval('distinct_rewrite_seq_filtered_arg');

SELECT t1.c1, s3.a1
FROM t1, (
	SELECT t1.c1 AS a0, max(s1.v1) AS a1, max(t1.c1)::BIGINT AS a2, count(DISTINCT t1.c1) AS a3
	FROM t1
	JOIN (SELECT c1 AS k1, [c1] AS v1 FROM t1) AS s1 ON (t1.c1 = s1.k1)
	JOIN (SELECT DISTINCT c1 FROM t1) AS s2 ON (t1.c1 = s2.c1)
	GROUP BY t1.c1
) AS s3
WHERE t1.c1 = s3.a0
ORDER BY ALL;

SELECT g, STRING_AGG(DISTINCT u, ',' ORDER BY u), list_sort(string_split(STRING_AGG(DISTINCT u, ','), ','))
FROM tu
GROUP BY g
ORDER BY g;

CREATE TABLE ts(g INT, s VARCHAR);

SELECT DISTINCT a FROM test ORDER BY a;

SELECT DISTINCT ON (i) i, j FROM integers WHERE i <> 2;

SELECT DISTINCT ON (2) i, j FROM integers ORDER BY 2;

SELECT DISTINCT ON (i) i, j FROM integers ORDER BY k;

CREATE TABLE grouped_table AS SELECT 1 id, 42 index1, 84 index2 UNION ALL SELECT 2, 42, 84 UNION ALL SELECT 3, 13, 14;

FROM (VALUES (1,1,2),(1,1,3)) AS t(key1,key2,v)
SELECT DISTINCT ON (COLUMNS('key'), key1) * ORDER BY key1, key2;

SELECT DISTINCT COLUMNS('key') FROM (VALUES(1,1,2),(1,1,3)) AS t(key1,key2,v);

DROP TABLE IF EXISTS b;

SELECT DISTINCT integers.i FROM integers ORDER BY integers.i DESC;

select
	sum(j),
	sum(distinct i),
	count(j),
	sum(distinct j)
from tbl;

select
	sum(j) FILTER (WHERE j == 5),
	sum(distinct i) FILTER (WHERE j == 5),
	count(j),
	sum(distinct j)
from tbl;

SELECT any_value(CASE WHEN i % 5 = 0 THEN {'value': i, 'items': [i, i + 1]} END) IS NOT NULL
FROM range(3000) r(i)
GROUP BY i >= 2500
ORDER BY i >= 2500;

SELECT count(*) FROM (
    SELECT DISTINCT g, histogram(s) OVER (PARTITION BY g) h, mode(s) OVER (PARTITION BY g) m FROM adopt
) w JOIN (SELECT g, histogram(s) h, mode(s) m FROM adopt GROUP BY g) a USING (g)
WHERE w.h != a.h OR w.m != a.m;

SET disabled_optimizers='join_order,join_filter_pushdown,compressed_materialization';

CREATE TABLE integers(g integer, i integer);

SELECT g, SUM(i), COUNT(*), COUNT(i), SUM(g) FROM integers GROUP BY ALL ORDER BY 1;

SELECT g, i, g%2, SUM(i), SUM(g) FROM integers GROUP BY 1, 2, 3 ORDER BY 1, 2, 3, 4;

SELECT s, count(*) FROM (VALUES ('a'), ('A'), ('b')) v(s) GROUP BY ALL ORDER BY 1;

SELECT small: x < 2, count(*) AS n FROM unnest([0, 1]) _(x) GROUP BY ALL HAVING small;

INSERT INTO collated VALUES ('a', 1), ('A', 2), ('b', 3);

SELECT SUM(i) FROM integers GROUP BY ALL ORDER BY ALL;

INSERT INTO t VALUES (-128), (127);

CREATE TABLE t(t_k0 BIGINT);

INSERT INTO t VALUES (0), (65535);

USE perfect_hash_corrupt_stats_range;

CREATE TABLE t AS SELECT (i%16)::INT g FROM range(300000) t(i);

SELECT SUM(a+2), SUM(a) + 2 * COUNT(*) FROM test;

INSERT INTO test VALUES (12, 21), (12, 21), (12, 21);

DROP TABLE integers;

SELECT i % 2 AS k, SUM(i) FROM integers WHERE i IS NOT NULL GROUP BY 1 HAVING i%2>0;

CREATE TABLE tbl(i INT);

SELECT k, SUM(v) FROM intlists GROUP BY k ORDER BY 2;

SELECT k, LEAST(v, 21) as c, SUM(v) FROM struct_lint_lstr
GROUP BY k, c
ORDER BY 2, 3;

CREATE TABLE t0(c0 INTEGER);

SELECT NULL FROM t0 GROUP BY NULL;

INSERT INTO integers VALUES (3, 4), (NULL, 4), (2, 4);

select course, type, count(*) from students group by cube (course, type, course) order by 1, 2, 3;

SELECT GROUPING(course), course, COUNT(*) FROM students GROUP BY course ORDER BY 1, 2, 3;

SELECT GROUPING(course, type, course, course, type, type, course), course, type, COUNT(*) FROM students GROUP BY CUBE(course, type) ORDER BY 1, 2, 3, 4;

select count(*) from students group by ();

select count(*), course, type
	from students
	group by course, grouping sets(type, ())
	order by 1, 2, 3;

select count(*), course, type
        from students
        group by grouping sets((course, type), (type))
        order by 1, 2, 3;

SELECT course, COUNT(*) FROM students GROUP BY GROUPING SETS ((), (course)) HAVING random()>1000;

EXPLAIN SELECT g, sum(i) FROM t GROUP BY ROLLUP (g) HAVING sum(i) > 1 OR g IS NULL;

INSERT INTO response VALUES
	(1,'yes'),
	(1,'no'),
	(1,'yes'),
	(2,'no'),
	(2,'no');

select course, type, count(*) from students group by rollup (course, type) order by 1, 2, 3;

SELECT b, sum(a) AS a
FROM (VALUES (1, 0), (1, 1)) t(a, b)
GROUP BY b
HAVING a > 0
ORDER BY ALL;

SELECT 1 AS one FROM (
	values
	(1,2),
	(3,2)
) t(a, b)
HAVING 1 < 2;

SELECT b, SUM(a) AS sum FROM test GROUP BY b HAVING COUNT(*) = 1 ORDER BY b;

SELECT g, sum(v) AS n, row_number() OVER (ORDER BY sum(v)) AS rn FROM (VALUES (1, 1), (2, 2), (3, 3)) t(g, v) GROUP BY g HAVING n >= 2 QUALIFY rn = 1;

SELECT SUM(42)+COUNT(*)+COUNT(1), 3 HAVING SUM(42)+MAX(20)+AVG(30) > SUM(120)-MIN(100);

SELECT SUM(a) FROM test HAVING COUNT(*)>10;

SELECT * FROM exam QUALIFY rank() OVER (ORDER BY mark desc) = 4;

SELECT * FROM power QUALIFY rank() OVER (PARTITION BY plant ORDER BY date DESC) = 2 ORDER BY plant;

SELECT unique1 FROM tenk1 QUALIFY cast(cume_dist() OVER (PARTITION BY four ORDER BY ten)*10 as integer) = 5 order by four, ten;

SET wal_autocheckpoint='1TB';

CREATE TABLE test.t (a INTEGER, b INTEGER);

SELECT quantile_disc(0.1::decimal(4,1), [0.1, 0.5, 0.9]);

SELECT g, count(*), count(first_v), count(any_v) FROM (SELECT g, first(v) FILTER(WHERE v IS NOT NULL) first_v, any_value(v) any_v FROM selected_values GROUP BY g) GROUP BY g ORDER BY g;

SELECT count(*) FROM (SELECT first(v) AS k FROM selected_values WHERE false) f JOIN (VALUES(NULL::INTEGER)) e(k) ON f.k IS NOT DISTINCT FROM e.k;

SELECT g, sum(NULL::BIGINT), sum(3), count(*)
FROM (VALUES (1),(1),(NULL),(NULL)) t(g) GROUP BY g ORDER BY g NULLS LAST;

DROP TABLE initialization_input;

select variant_group_object(k, v) filter (where false)
from (values ('filtered', 1::VARIANT)) t(k, v);

select variant_comparator(variant_group_object(k, v)) = variant_comparator({
    'date': DATE '2020-01-02',
    'timestamp': TIMESTAMP '2020-01-02 03:04:05',
    'blob': 'abc'::BLOB,
    'map': MAP {'x': 1, 'y': 2}::VARIANT
}::VARIANT)
from (values
    ('date', DATE '2020-01-02'::VARIANT),
    ('timestamp', TIMESTAMP '2020-01-02 03:04:05'::VARIANT),
    ('blob', 'abc'::BLOB::VARIANT),
    ('map', MAP {'x': 1, 'y': 2}::VARIANT)
) t(k, v);

SET variant_minimum_shredding_size = 0;
