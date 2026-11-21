SELECT MAP([MAP([ARRAY_VALUE('1', NULL), ARRAY_VALUE(NULL, '2')], [1, 2])], [1]);

SELECT count(*) FROM array_fold_db.inputs WHERE array_inner_product(a, b) IS NOT NULL;

SELECT array_length(a, NULL) FROM null_arrays ORDER BY id;

SELECT list_contains(array_value(1,2,3), 2);

SELECT suggestion, suggestion_start FROM sql_auto_complete('ALTER TABLE my_table RENAME COLUMN fi') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('CREATE SCHEMA I') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('create table tbl(i INTEGER, j INTE') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('CREATE TABLE attached_in_memory.a') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('DROP TABLE my_s') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SELECT sum(42) IS NOT NUL') LIMIT 1;

CREATE SCHEMA my_catalog_entry;

SELECT suggestion, suggestion_start FROM sql_auto_complete('PRAGMA show_t') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SELECT * FROM tbl ORDER B') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SELECT * FROM tbl NAT') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SELECT * FROM tbl UNION AL') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('UPDATE my_table SET m') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SHOW thr') LIMIT 1;

SELECT count(*) FROM sql_auto_complete('SUMMARIZE ') WHERE suggestion = '(';

SELECT duckdb_format_sql('select a from t1 union all select a from t2') = $$SELECT a
FROM t1
UNION ALL
SELECT a
FROM t2$$;

SELECT duckdb_format_sql('CREATE TABLE t (id INTEGER PRIMARY KEY)') = $$CREATE TABLE t(id INTEGER PRIMARY KEY)$$;

SELECT duckdb_format_sql('CREATE UNIQUE INDEX idx_email ON users (email)') = $$CREATE UNIQUE INDEX idx_email ON users(email)$$;

SELECT duckdb_format_sql(NULL);

SELECT duckdb_format_sql('SELECT s.id, s.name FROM mydb.information_schema.tables s WHERE s.table_schema = ''main''') = $$SELECT s.id, s.name
FROM mydb.information_schema.tables s
WHERE s.table_schema = 'main'$$;

SELECT duckdb_format_sql('CREATE TABLE t AS SELECT a, b FROM s') = $$CREATE TABLE t AS
SELECT a, b
FROM s$$;

SELECT duckdb_format_sql('SELECT 100.00 * sum(CASE WHEN p_type LIKE ''PROMO%'' THEN l_extendedprice * (1 - l_discount) ELSE 0 END) / sum(l_extendedprice * (1 - l_discount)) AS promo_revenue FROM t') = $$SELECT 100.00 * sum(
    CASE
        WHEN p_type LIKE 'PROMO%' THEN l_extendedprice *(1 - l_discount)
        ELSE 0
    END) / sum(l_extendedprice *(1 - l_discount)) AS promo_revenue
FROM t$$;

SELECT duckdb_format_sql($query$SELECT $$a
    b
    c$$$query$) = $query$SELECT $$a
    b
    c$$$query$;

SELECT suggestion, suggestion_start FROM sql_auto_complete('FROM duckdb_c') LIMIT 1;

SELECT suggestion, suggestion_start FROM sql_auto_complete('SELECT l_orderkey FROM lineitem JOIN ord') LIMIT 1;

CREATE VIEW v2(alias_name) AS SELECT 42 alias;

SELECT base64(encode('a'));

select from_base64('AAAA');

CREATE TABLE int_list(l INT[]);

INSERT INTO list_of_structs VALUES
([{'i': 42, v: 'hello'}]),
([]),
([{'i': 42, v: 'hello'}, {'i': 84, v: ''}]),
([{'i': 43, v: ''}]),
(NULL),
([NULL]),
([{'i': 42, v: NULL}]),
([{'i': NULL, v: ''}]),
([{'i': 42, v: 'hello'}, {'i': 84, v: chr(0)}]),
([{'i': 42, v: 'hello'}, NULL, {'i': 84, v: ''}]);

CREATE TABLE arrays(l INT[3]);

SELECT count(*) FROM (
    SELECT row_number() OVER (ORDER BY b ASC, len, pos, esc) AS by_blob,
           row_number() OVER (ORDER BY create_sort_key(b, 'ASC NULLS LAST') ASC, len, pos, esc) AS by_key
    FROM sweep
) WHERE by_blob <> by_key;

SELECT decode(encode(a)) || a from (values ('hello'), ('world')) tbl(a);

select octet_length(array_slice(blob '\x00\x01\x02\x03\x04\x05', 4, 3));

SELECT cell.col, cell."row" FROM sheet WHERE cell BETWEEN {'col': 'A', 'row': 2} AND {'col': 'B', 'row': 1} ORDER BY ALL;

INSERT INTO nested VALUES
  ({'a': {'x': 1, 'y': 'a'}, 'b': 1}),
  ({'a': {'x': 1, 'y': 'b'}, 'b': 0}),
  ({'a': {'x': 2, 'y': 'a'}, 'b': 5}),
  ({'a': NULL, 'b': 2}),
  (NULL);

CREATE TABLE dates(d DATE);

SELECT EXTRACT(decade FROM d) FROM dates;

SELECT EXTRACT(quarter FROM d) FROM dates;

create table t1 (date timestamp);

INSERT INTO d VALUES ('5877642-06-25', 'A'), ('2024-01-01', 'b');

SELECT d, year(d), month(d), day(d), dayofyear(d), date_part(['year', 'month', 'day'], d)
FROM (VALUES (DATE '5877642-06-25 (BC)'), (DATE '5881580-07-10'), (DATE '2000-02-29'), (DATE '1900-02-28'),
             (DATE '0001-01-01 (BC)'), (DATE '1600-03-01'), (DATE '2050-12-31'), (DATE '2051-01-01'),
             (DATE '1969-12-31'), ('infinity'::DATE), ('-infinity'::DATE), (NULL)) t(d);

SELECT date_part('julian', d) FROM dates;

SELECT LAST_DAY(DATE '1900-02-12'), LAST_DAY(DATE '1992-02-12'), LAST_DAY(DATE '2000-02-12');

SELECT d, DATE_PART(['weekday', 'isodow', 'doy', 'julian'], d) AS parts
FROM dates
ORDER BY 1;

SELECT date_trunc(s, NULL::TIMESTAMP) FROM timestamps LIMIT 3;

SELECT date_trunc('millennium', TIMESTAMP '1996-01-06 04:03:02') FROM timestamps LIMIT 1;

SELECT s.min, s.max, s.has_null, s.has_no_null FROM (SELECT stats(date_trunc('day', d)) s FROM dates LIMIT 1);

INSERT INTO dates VALUES ('1993-08-14'), (NULL);

SELECT EXTRACT(millennium FROM i) FROM dates;

SELECT EXTRACT(dow FROM cast('1970-01-01' AS DATE) - 1);

SELECT EXTRACT(week FROM cast('2005-01-01' AS DATE));

SELECT EXTRACT(week FROM cast('2007-01-01' AS DATE) + 49);

SELECT EXTRACT(week FROM cast('2007-01-01' AS DATE) + 140);

SELECT EXTRACT(week FROM cast('2007-01-01' AS DATE) + 231);

SELECT strftime(DATE '1992-01-01', '%Y');

SELECT strftime(NULL::TIMESTAMP, '%%%%%% %Y %%%%%%') FROM range(3);

SELECT strftime(d, '%-m') FROM dates ORDER BY d;

SELECT strftime(d, '%j') FROM dates ORDER BY d;

select d, time_bucket('3 years'::interval, d) from dates;

select d, time_bucket(null::interval, d, '1970-01-04'::date) from dates;

select time_bucket('-1 month'::interval, null::date, '6 days'::interval);

SELECT d, isoyear(d), weekofyear(d), yearweek(d), strftime(d, '%U %W')
FROM (VALUES (DATE '5877641-01-01 (BC)'), (DATE '5877641-01-03 (BC)'), (DATE '5877641-01-04 (BC)')) t(d) ORDER BY d;

CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy', 'anxious');

SELECT enum_range_boundary('orange'::rainbow, 'green'::rainbow);

SELECT can_cast_implicitly(i, NULL::HUGEINT) FROM tbl LIMIT 1;

EXECUTE implicit_cast_target_parameter(NULL);

SELECT count(v), sum(v) FROM (
    SELECT CASE WHEN i%3=0 THEN NULL
                WHEN i%3=1 THEN nextval('case_fill_seq')
                ELSE NULL END AS v
    FROM range(12) t(i)
);

select n, case 
when n <> '' and cast(substr(n, 1, 1) as int) <= 0 then '0' 
when n <> '' and cast(substr(n, 1, 1) as int) > 0 then '1' 
else '2'end as x from t
ORDER BY n;

SELECT i, CASE i WHEN >= 0 THEN true ELSE false END
FROM tbl
ORDER BY i NULLS LAST;

SELECT i, CASE i WHEN 0, 1, 2 THEN 'good'
                 WHEN 3, 7, 9 THEN 'bad'
          END
FROM tbl
ORDER BY i NULLS LAST;

SELECT try_trim_null(42) as trim_int, try_trim_null('  col  ') as trim_varchar, try_trim_null('') as trim_empty;

SELECT COALESCE(42, -CAST('not-an-integer' AS INTEGER));

SELECT make_type('STRUCT', a := make_type('INTEGER'), b := make_type('var' || 'char'))::VARCHAR;

SELECT count(*) FROM nested a JOIN nested b ON a.l IS NOT DISTINCT FROM b.l AND a.s IS NOT DISTINCT FROM b.s AND a.r IS NOT DISTINCT FROM b.r WHERE hash(a.l, a.s, a.r) <> hash(b.l, b.s, b.r);

SET default_collation = 'nocase';

SELECT m, HASH(m) FROM maps;

select approx_count_distinct((range, range)) > 800_000 from range(1_000_000);

select invoke(lambda x: invoke(lambda y: y + x + 5, 3), 2) as result;

CREATE TABLE invoke_dictionary_tbl AS
	SELECT CASE WHEN i % 2 = 0 THEN 'x' ELSE 'y' END s FROM range(10000) tbl(i);

CREATE TYPE t AS ENUM ('z','y','x');

SELECT LEAST(200::UTINYINT, 1::UTINYINT, 128::UTINYINT), LEAST(65535::USMALLINT, 1::USMALLINT, 32768::USMALLINT),
       LEAST(4294967295::UINTEGER, 1::UINTEGER, 2147483648::UINTEGER),
       LEAST(18446744073709551615::UBIGINT, 1::UBIGINT, 9223372036854775808::UBIGINT),
       LEAST(340282366920938463463374607431768211455::UHUGEINT, 1::UHUGEINT, 170141183460469231731687303715884105728::UHUGEINT);

SELECT get_type(struct_pack(s := lower(NULL::VARCHAR COLLATE NOCASE)))=
       get_type(struct_pack(s := NULL::VARCHAR COLLATE NOCASE));

SELECT typeof(list_extract(NULL::INT[], 1)), typeof(array_extract(NULL::DATE[3], 1)), typeof(list_aggr(NULL::INT[], 'sum')), typeof(struct_insert(NULL::STRUCT(x INT), a := 'a'));

SELECT typeof(repeat('z', 2)), typeof(repeat(NULL::VARCHAR || 'z', 2)), typeof(repeat('z'::BLOB, 2)), typeof(repeat(NULL::BLOB || 'z'::BLOB, 2));

SELECT typeof(NULL || 'z'), typeof([1] || NULL), typeof(NULL || NULL), typeof(list_extract(NULL, 1));

SELECT replace_type('duck'::UNION(a INTEGER, b VARCHAR, c BOOLEAN), NULL::INTEGER, NULL::BIGINT);

CREATE TABLE allowed(id INTEGER);

EXPLAIN SELECT * FROM (SELECT i * 2 AS k FROM t) WHERE __internal_barrier(k = 4);

SELECT i BETWEEN NULL AND 2 FROM integers ORDER BY i;

SELECT COUNT(*) FROM integers WHERE i BETWEEN NULL AND 2;

SELECT COUNT(*) FROM integers WHERE 1 BETWEEN i-1 AND 100;

EXECUTE v1(3);

select null is not true;

SELECT IF(true, 20, 2000), IF(false, 20, 2000), IF(NULL, 20, 2000);

SELECT i, i IN (i + 1) FROM integers ORDER BY i;

PREPARE v1 AS SELECT 1 IN ?;

SELECT LEAST(1, 3, 0);

SELECT LEAST(TIMESTAMP '1992-01-01 13:45:21.890123', TIMESTAMP '1994-02-02 05:43:21', TIMESTAMP '1991-01-01 01:23:45', NULL);

CREATE SEQUENCE least_greatest_sequence;

SELECT a, CASE WHEN a>11 THEN CAST(a AS VARCHAR) ELSE CAST(b AS VARCHAR) END FROM test3 ORDER BY 1;

SELECT * FROM range(3) UNION ALL SELECT NULL ORDER BY 1;

SELECT sleep_ms(sleep_ms(1));

SELECT pg_sleep(NULL);

INSERT INTO integers VALUES (1), (2), (3);

pragma verify_parallelism;

SELECT index_key({'table': 'tbl1', 'constraint': 'primary'}, 1);

CREATE TABLE tbl3_wrong_type(c1 VARCHAR, c2 INTEGER, c3 BIGINT);

CREATE SCHEMA test_schema;

PRAGMA disable_checkpoint_on_shutdown;

SELECT count(*) FROM epochs WHERE epoch(i) > epoch(INTERVAL '362 days');

SELECT count(*) FROM equal_milliseconds WHERE epoch_ms(i) = 86400000;

SELECT date_part(s, i) FROM intervals;

SELECT EXTRACT(century FROM i) FROM intervals;

SELECT EXTRACT(century FROM interval '1400 months ago');

select 2::BIGINT * (interval '1 days');

SELECT list_aggr([NULL, 1, 2], 'any_value');

CREATE TABLE list_ints (l INTEGER[]);

CREATE TABLE IF NOT EXISTS names (t string[]);

SELECT list_avg(i) FROM integers;

SELECT list_avg(i) FROM bigints;

SELECT list_bit_and([]) FROM integers;

INSERT INTO bools VALUES ([True, False]);

select list_entropy(k) from aggr;

CREATE TABLE five_dates AS
	SELECT
		LIST(i::integer) AS i,
		LIST('2021-08-20'::DATE + i::INTEGER) AS d,
		LIST('2021-08-20'::TIMESTAMP + INTERVAL (i) HOUR) AS dt,
		LIST('14:59:37'::TIME + INTERVAL (i) MINUTE) AS t,
		LIST(INTERVAL (i) SECOND) AS s
	FROM range(1, 6, 1) t1(i);

select list_histogram(name) from names;

INSERT INTO hugeints VALUES ([NULL, 1, 2]), (NULL), ([]), ([NULL]), ([1, 2, 3]);

SELECT list_last(d), list_last(dt), list_last(t), list_last(s) FROM five_dates;

SELECT count(*) FROM (SELECT list_histogram([md5((i % 3)::VARCHAR), md5((i % 3)::VARCHAR), md5(i::VARCHAR)]) h FROM range(5000) r(i)) WHERE cardinality(h) != 2;

SELECT list_mad(r) FROM second;

DROP TABLE quantile;

INSERT INTO structs VALUES ({'i': 99999999});

INSERT INTO lists VALUES ([]), (NULL), ([NULL, NULL, NULL]);

CREATE TABLE arrays AS SELECT (case when i<500 then [i, i + 1, i + 2] else [i, 0, 0] end)::BIGINT[3] AS l FROM range(1000) t(i);

insert into dates values (['2021-05-02', '2021-05-02', '2021-05-02', '2020-02-29', '2020-02-29', '2004-09-01', NULL]);

select list_mode(v) from hugeints;

INSERT INTO integers VALUES ([1, 2, 4]), (NULL), ([]), ([NULL]), ([1, 2, NULL, 4, NULL]);

select list_skewness([1]);

CREATE TABLE str_aggs (str varchar[]);

SELECT list_sum([2, 2]);

SELECT COUNTIF(i > 500), COUNT_IF(i=1), COUNTIF(i IS NULL) FROM integers;

SELECT list_stddev_samp([1]);

select list_aggr([0, 0], 'stddev');

SELECT len(l) FROM lists;

SELECT array_to_string_comma_default([], sep:='-');

SELECT flatten([[], []]);

SELECT flatten(flatten([[[]], [[]]]));

SELECT generate_series(3);

SELECT range(3, 1);

SELECT range(3, 1, 1);

EXPLAIN FROM range(-5, -20, -1);

SELECT generate_series(timestamp '2020-01-01', timestamp '2020-06-01', -interval '3' month);

SELECT y, count(r), count(DISTINCT r), min(r), max(r)
FROM (VALUES (2000), (2001)) inputs(y), LATERAL generate_series(make_timestamp(y, 1, 1, 0, 0, 0), make_timestamp(-9223372036854775807 - 1 + y * 0), -INTERVAL 100000 YEAR) t(r)
GROUP BY y ORDER BY y;

SELECT count(*) FROM (
	SELECT unnest(generate_series(timestamptz '2000-01-01', timestamptz '2020-06-01', interval '1' day))
);

SELECT count(*) > 0 FROM duckdb_logs WHERE log_level = 'WARNING' AND starts_with(message, 'Deprecated lambda arrow');

SELECT list_transform(['hello', 'duck', 'sunshine'], str -> CASE WHEN str LIKE '%e%' THEN 'e' ELSE 'other' END);

CREATE TABLE my_window (l integer[], g integer, o integer);

INSERT INTO lists VALUES (1, [1]), (2, [1, 2, 3]), (3, NULL), (4, [-1, NULL, 2]);

CREATE TABLE corr_test (n integer, l varchar[], g integer);

CREATE TABLE t1 AS SELECT [1, 2, 3] AS x;

SELECT list_transform([1, 2], x -> list_transform([3, 4], x -> x));

SELECT list_intersect(list_intersect([1, 2, 3, 4], [4, 5, 6, 7]), list_intersect([4, 5, 6, 7], [1, 2, 3, 4]));

CREATE TABLE uniform_purchase_forecast AS
SELECT 'gold' AS color, 10 AS forecast
UNION ALL SELECT 'blue', 15
UNION ALL SELECT 'red', 300;

CREATE MACRO other_reduce_macro(list, num, bla) AS (SELECT list_reduce(list, (x, y) -> list + x + y + num + bla));

SELECT list_transform([[1, NULL, 2], [3, NULL]], a -> list_filter(a, x -> x IS NOT NULL));

SELECT list_reduce([NULL], (x, y, i) -> x + y + i);

DROP TABLE t1;

SELECT list_reduce([['a', 'b'], ['c', 'd'], ['e', 'f']], (x, y) -> list_pack(list_reduce(x, (a, b) -> a || b) || list_reduce(y, (c, d) -> c || d)));

INSERT INTO nested VALUES (['a', 'b', 'c', 'd'], ['1', '2', '3', '4']), (NULL, NULL), (NULL, ['110', '111', '112']), (['77', '88', '99'], ['55', '66', NULL]);

SELECT a FROM where_clause WHERE list_reduce(a, (x, y) -> x - y) > 0;

SELECT list_reduce([1, 2, 3], (x, y, i) -> x + y + i, -1);

INSERT INTO t1 VALUES ([-1, NULL, -2], 4);

SELECT list_reduce([[1,2,3], [4,5,6], [7,8,9]], (x, y) -> list_pack(list_reduce(x, (l, m) -> l + m) + list_reduce(y, (n, o) -> n + o)), [100]);

INSERT INTO nested VALUES ([[4, 5, 6], []], [9]);

SELECT list_reduce(s, (a, b) -> row(a.v || b.v, a.i + b.i), initial) FROM t_struct;

SELECT list_apply(range(5), x -> {x:x, w:list_filter(range(5), y -> abs(y-x) < 2)});

SELECT my_transform([1, 2, 3]);

CREATE OR REPLACE FUNCTION deprecated_syntax.transpose(lst) AS (
	SELECT list_transform(range(1, 1 + length(lst[1])),
		j -> list_transform(range(1, length(lst) + 1),
			i -> lst[i][j]
		)
	)
);

SELECT list_transform(['x', 'abc', 'z'], x -> x || '0');

select list_apply(i, x -> x + 1 AND x + 1) from (values (list_value(1, 2, 3))) tbl(i);

SELECT ct.n FROM corr_test ct
WHERE list_count(ct.l) < (SELECT list_count(list_transform(list_concat(list(c.n), ct.l), a -> a)) FROM corr_test c GROUP BY c.g)
ORDER BY ct.n;

SELECT list_transform(['abc'], (x, i) -> x[i + 1]);

SELECT list_transform(a, (x, i) -> x + i + list_any_value(a)) FROM tbl;

SELECT list_filter([10], lambda x: sum(1) > 0);

SELECT list_transform([2], lambda x: x + x);

SELECT list_filter(l, lambda x: x <= n) FROM lists;

SELECT list_filter([1, 2, 3, 4, 5, 6, 7, 8, 9], lambda x: x > #1) FROM range(10);

SELECT sum(list_reduce(l, lambda x, y: x + y)) FROM t;

SELECT list_transform(['A'], lambda system: system.lower());

SELECT y FROM t_scope WHERE list_transform([-2], lambda y: y.abs()) = [2];

CREATE MACRO aux.main.only_here(v) AS v + 1;

SELECT list_transform([-2], lambda y: list_transform([-3], y -> y.abs()));

CREATE MACRO n1.n2.times_ten(v) AS v * 10;

INSERT INTO up VALUES (1, 10, NULL);

SELECT list_has_any(['b'], list_transform(['a'], lambda variable_has_any: variable_has_any)) AS list_transform_result;

SELECT list_filter([[1, 2], NULL, [3], [4, NULL]], lambda f: list_count(macro_with_lambda(f, 2)) > 1);

SELECT [i FOR x, i IN [4, 5, 6] IF x > 5];

SELECT list_reduce(a, lambda x, y, i: x + y + i) FROM t1;

SELECT list_reduce(n, lambda x, y: list_pack(list_reduce(x, lambda l, m: l + m) + list_reduce(y, lambda j, k: j + k))) from nested;

SELECT reduce([1.0, 2.5], lambda x, y: x + y);

SELECT reduce([1, 2, 3], lambda x, y: x + y, 100);

SELECT list_reduce(['a', 'b', 'c'], lambda x, y: x || y, NULL);

SELECT list_reduce(n, lambda x, y, x_i: list_reduce(l, lambda a, b, a_i: x + y + a + b + x_i + a_i), initial) FROM nested;

SELECT list_reduce([1, 2, 3], lambda x, y: x * y, 2.5);

SELECT list_reduce([BLOB 'hello'], lambda x, y: x, 'text');

SELECT count(DISTINCT list_reduce([1, 2], lambda a, x: a + random(), 0.0)) > 1 FROM range(100);

CREATE MACRO my_transform(list) AS list_transform(list, lambda x: x * x);

SELECT list_transform([1, 2, 3], lambda x: x + 1);

SELECT list_transform([[1], [4], NULL, [1], [8]], lambda x: list_concat(
	list_transform(x, lambda y: CASE WHEN y > 1 THEN 'yay' ELSE 'nay' END), x::VARCHAR[]));

SELECT n FROM corr_test WHERE list_sum(list_transform(l, lambda elem: elem - n)) >= n;

SELECT list_filter([1, 2, 1], lambda x, y: x >= y);

SELECT list_transform(range(10000), lambda x, i: x + i);

SELECT list_concat([], [3, 4]);

SELECT list_concat([1, 2], [NULL]);

SELECT i, list_concat(j, k) FROM lists;

SELECT [1, 2] || b FROM (VALUES (NULL::INT[])) t(b);

create table TEST (i int[]);

SELECT list_contains([1,2,3],1.0);

SELECT list_contains(['test', 'notest'],'a');

INSERT INTO test0 VALUES ([2]), ([1]), ([1, 2]), ([]), ([2, 2]), ([NULL]), ([2, 3]);

SELECT list_contains([{a: 1}, {a: 2}], {a: 2});

SELECT function_name FROM functions
WHERE function_type = 'scalar' AND list_has(parameter_types, 'TIMESTAMP');

SELECT map_contains(m, NULL::INT) FROM (VALUES (map([1], [1]))) t(m);

SELECT count(*) FROM (VALUES
	(INTERVAL '-2147483648 months -2147483648 days -9223372036854775807 microseconds', INTERVAL '-2147483648 months -2147483648 days -9223372036854775806 microseconds'),
	(INTERVAL '2147483647 months 2147483647 days 9223372036854775806 microseconds', INTERVAL '2147483647 months 2147483647 days 9223372036854775807 microseconds'),
	(INTERVAL '1 month', INTERVAL '30 days'),
	(INTERVAL '1 month', INTERVAL '31 days')
) t(a, b) WHERE list_contains([a], b) IS DISTINCT FROM (a = b);

EXECUTE list_distance_operator([1.0, 2.0], [2.0, 4.0]);

SELECT UNNEST(list_distinct([True, True, False, NULL])) AS l ORDER BY l;

SELECT list_distinct([INTERVAL 1 YEAR]);

SELECT list_grade_up(list_transform(range(30), lambda x: 1)) = range(1, 31);

INSERT INTO list_data VALUES (NULL, [1,2,3]);

insert into list_of_list values ([[1 , 2, 3], NULL, [8, 8, 8]], [[8, 8, 8], NULL, [1, 2, 3]]);

create table tbl(l1 int[], l2 int[]);

select l1 <@ NULL from tbl;

SELECT list_sort(list_intersect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2, 5, 8]));

SELECT list_sort(list_intersect([1::INT, 2::INT, 3::INT], [2.0::DOUBLE, 3.0::DOUBLE, 4.0::DOUBLE]));

SELECT i, list_position(i,'aaaaaaaaaaaaaaaaaaaaaaaa') from STR_TEST;

SELECT list_position(NULL,NULL);

SELECT list_position([NULL, 1],NULL);

SELECT list_position([[1,NULL],[1], [1,2,3]],[0,NULL]);

SELECT i, j, list_position(i,j) from test0;

SELECT a, list_position(a, NULL) FROM no_null_elements;

insert into tbl values ([10,11,12], 2);

CREATE TABLE nulls(l INT[], b INT);

select list_resize([{'i': 1,'j': [{'a': 1, 'b': [2, 3]}, {'a': 3, 'b': [4, 5]}]}, NULL, {'i': 1, 'j': [{'a': 1, 'b': [2, 3]}, {'a': 3, 'b': [4, 5]}]}], 4);

SELECT list_resize([1, 2, 3], 4000);

prepare q4 as select array_resize(?, ?, ?);

prepare q1 as select list_reverse(?);

select list_reverse(test_vector) from test_vector_types(null::int[], true);

CREATE OR REPLACE TABLE integers AS SELECT LIST(i) AS i FROM range(1, 10, 1) t1(i);

UPDATE w SET c2 = list_select(list_distinct(c2), [1, 1]);

SELECT list_sort([INTERVAL '25 hours', INTERVAL '1 day 1 hour', INTERVAL '1500 minutes']);

CREATE TABLE t2 AS SELECT list_sort(NULL::INT[]) l, list_grade_up(NULL::INT[]) g;

SELECT array_unique([1, 2, 2, NULL]);

SELECT list_unique([INTERVAL 1 YEAR]);

SELECT list_value(['a', 'b', 'c']::VARCHAR[3], ['d', 'e', 'f']::VARCHAR[3], NULL::VARCHAR[3]);

INSERT INTO array_table VALUES (['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']);

SELECT LIST_VALUE([1, 7], [NULL], [2], [3]);

INSERT INTO STRUCT_TABLE VALUES ([ROW(7, 7), ROW(8, 8)], [ROW(9, 9)], [ROW(10, 10), ROW(11, 11), ROW(12, 12)]);

SELECT LIST_VALUE(a, b, c) FROM string_table;

SELECT list_value({'a': 1, 'b': 'a'}, {'a': 2, 'b': 'b'}, {'a': NULL, 'b': 'c'});

INSERT INTO mixed_structs VALUES (ROW([4, 5], NULL, 2, ['c', 'd'], ROW(2, NULL)));

SELECT list_where(i, j) FROM integers, selections order by all;

SELECT list_where(['2021-08-20'::TIMESTAMP_S], [true]);

SELECT LIST_WHERE(ARRAY_VALUE('1', NULL), [TRUE, TRUE, TRUE]);

SELECT list_zip([1, '2', 3]::int[], [1, 2, 3]::int[3]);

SELECT list_zip(i, j, b) FROM integers, integers2, bools order by all desc;

SELECT list_zip(['14:59:37'::TIMETZ]);

SELECT MAP_FROM_ENTRIES(LIST_ZIP(CAST(['123'] AS VARIANT[]), CAST([] AS VARIANT[])));

CREATE TABLE addresses (i INT, b INT);

WITH data AS (SELECT 1 AS a, 2 AS b, 3 AS c)
SELECT struct_insert (data, d := 4) FROM data;

SELECT struct_update({'a': 1, 'b': 'abc', 'c': true}, d := {'a': 'new stuff'});

INSERT INTO t0 VALUES ({'a': 1, 'b': 2}, 5), ({'a': 3, 'b': 4}, NULL), (NULL, 1), ({'a': 7, 'b': 8}, 7);

SELECT 12345678901111111 % 2.0;

CREATE TABLE dec4(x DECIMAL(4,1));

SELECT setseed(0.42);

SELECT binom(0, 0), binom(1, 0), binom(1, 1);

SELECT even(19.4), even(-19.4);

SET ieee_floating_point_ops=false;

SELECT fdiv(12.3456789, 5);

SELECT cast(FLOOR(n::smallint) as bigint) FROM numbers ORDER BY n;

SELECT gamma(2::hugeint);

SELECT a, b, gcd(a, b), gcd(a, -b), gcd(b, a), gcd(-b, a)
FROM (VALUES (0::int8, 0::int8),
             (0::int8, 29893644334::int8),
             (288484263558::int8, 29893644334::int8),
             (-288484263558::int8, 29893644334::int8),
             ((-9223372036854775808)::int8, 1::int8),
             ((-9223372036854775808)::int8, 9223372036854775807::int8),
             ((-9223372036854775808)::int8, 4611686018427387904::int8)) AS v(a, b);

SELECT DEGREES(1e308);

select mod(a, 40) from modme;

select nextafter(99, 1);

select nextafter(a, b) from test_twoc;

select radians(45.0);

CREATE TABLE powerme(a DOUBLE, b INTEGER);

SELECT count(*) FROM t1 WHERE (SELECT min(#1) FROM t1 ) == (SELECT max(#1) FROM t1);

select setseed(a), a from seeds;

select round(42::DOUBLE, 0);

SELECT round(-0.049999999999999996::DOUBLE, 1)::VARCHAR, round(0.049999999999999996::DOUBLE, 1)::VARCHAR, round(-0.49999999999999994::DOUBLE, 0)::VARCHAR, round_even(-0.049999999999999996::DOUBLE, 1)::VARCHAR, round_even(0.049999999999999996::DOUBLE, 1)::VARCHAR, round_even(-0.49999999999999994::DOUBLE, 0)::VARCHAR;

SELECT roundBankers(45.5, 0), roundBankers(44.5, 0);

SELECT round_even(12345678901234567890123456789012344.5::DECIMAL(38,1), 0), round_even(-12345678901234567890123456789012344.5::DECIMAL(38,1), 0);

INSERT INTO numbers VALUES (-42),(-1),(0), (1), (42), (NULL);

SELECT cast(TAN(n::tinyint)*1000 as bigint) FROM numbers ORDER BY n;

SELECT cast(ASIN(n::smallint)*1000 as bigint) FROM numbers  WHERE n between -1 and 1 ORDER BY n;

SELECT cast(COT(n::integer)*1000 as bigint) FROM numbers  WHERE n > 0.1 OR N < -0.1 ORDER BY n;

select cot(0::DOUBLE), cot(-0::DOUBLE);

SELECT 1::TINYINT + 1::BIGINT;

SELECT 1::INTEGER + 1::REAL;

SELECT 1::REAL + 1::DOUBLE;

SELECT -+-+-+-+-i FROM test;

SELECT 3-i<2, 2>3-i FROM integers ORDER BY i;

INSERT INTO tab2 VALUES(64,77,40);

CREATE TABLE bitwise_test(i TINYINT, j TINYINT);

SELECT "="(1, 1.0), "<"(1, 2::BIGINT), ">="('b', 'a'), "<="(DATE '2000-01-01', TIMESTAMP '2000-01-01 00:00:01'), "IS NOT DISTINCT FROM"(NULL, NULL), "IS DISTINCT FROM"(1, NULL);

SELECT false AND NULL;

SELECT i>3 AND true FROM a ORDER BY i;

CREATE MACRO ref_and(x, y) AS CASE WHEN x IS FALSE OR y IS FALSE THEN false WHEN x IS NULL OR y IS NULL THEN NULL ELSE true END;

SELECT d, ttz, d + ttz
FROM dates, timetzs
ORDER BY 1, 2;

SELECT (-127)::TINYINT // (-1)::TINYINT;

SELECT format_bytes(1024*1024);

SELECT formatReadableSize(500);

SELECT from_hex(to_hex(columns('^(.*int|varchar)$'))) FROM test_all_types();

CREATE TABLE with_nulls AS SELECT * FROM (VALUES (1, 255::BIGNUM), (2, NULL), (3, -4096::BIGNUM), (4, NULL)) t(i, v);

SELECT path_join(hive_partition_component('year', 2024), hive_partition_component('month', 1));

select md5('\xff\xff'::BLOB);

SELECT id, hex(nfc_normalize(s)) FROM hangul ORDER BY id;

SELECT * FROM null_byte WHERE v LIKE concat('%', chr(0), '%');

SELECT v, SUM(id) FROM more_null_bytes GROUP BY v ORDER BY ALL;

SELECT overlay('33333rce' placing 'resou' from -1);

SELECT overlay('abc' placing 'X' from 10);

SELECT parse_formatted_bytes('1 KB');

WITH data(value) AS (
	VALUES
		('1 KB'),
		('2 MB'),
		('3 GiB'),
		('4 TB'),
		(NULL)
)
SELECT value, parse_formatted_bytes(value) AS bytes FROM data;

SELECT parse_formatted_bytes('18446744073709551 KB');

SELECT parse_path(NULL, NULL);

SELECT parse_dirname('\path\to\file', 'forward_slash');

SELECT parse_dirpath('/', 'backslash');

SELECT parse_filename('/path/to/file.csv\file2.csv', true);

SELECT parse_filename('path/to///', true, 'forward_slash');

INSERT INTO paths VALUES
	(1, 'a/b\c', 'forward_slash'),
	(2, 'a/b\c', 'backslash'),
	(3, 'a/b\c', NULL),
	(4, 'a/b\c', 'both_slash'),
	(5, '', 'backslash'),
	(6, NULL, 'forward_slash'),
	(7, 'a/b\c', ''),
	(8, 'a/b\c', '@');

SELECT parse_path('//path/to///file.csv', 'forward_slash');

SELECT path_join('dir/..', '../..');

SELECT path_join('base', NULL, 'dir');

SELECT regexp_escape('abc123ABC');

WITH cte AS (
    SELECT c
    FROM tbl
    OFFSET 500 LIMIT 500
)
SELECT sum(cast(regexp_escape(c) = '1\?ch\@racter\$' as int))
FROM cte;

SELECT regexp_extract(NULL, 'b..');

SELECT regexp_extract(s, pattern, 1)
FROM (VALUES ('abc', '(b)'), ('def', '(x)')) t(s, pattern);

SELECT regexp_extract_all('1a 2b 14m', '(\\d+)([a-z]+)', 0);

select regexp_extract_all('abc', '.');

select regexp_extract_all('щццф', 'ц*');

select regexp_extract_all('abc', '((a))');

SELECT str, 
  REGEXP_EXTRACT_ALL(str,'a[bc]*d') AS matched
FROM (
  VALUES ('ad'), ('abd'), ('acd'), ('abcd'), ('abcbbcd'), ('abce')
) AS t(str);

select regexp_extract_all('si1si2', '^(si\d)(?:.*)$', 1);

SELECT regexp_extract_all('x1 y2', '(\w)(\d)', ['digit','letter']) AS res;

WITH t(s) AS (VALUES ('x1 y2'), ('a3'), ('no_digits'))
SELECT s, regexp_extract_all(s, '(\w)(\d)', ['c','d']) AS res FROM t;

SELECT regexp_extract_all('aabb', '^((aa)(bb))$', ['all','p1','p2']) AS res;

SELECT regexp_extract_all('щцф', 'щ(.).', ['g1']) AS res;

SELECT count(*) FILTER (WHERE k = 'abcdefghijklé'), count(*) FILTER (WHERE k = 'äabcdefghijk')
FROM (SELECT regexp_extract(s, '^([^:]+)://', 1) AS k FROM strings);

SELECT s FROM regex WHERE REGEXP_MATCHES(s, 'as(c|d|e)f');

INSERT INTO regex_columns_partial VALUES (1, 2, 3);

SELECT 'ABC' !~* 'a.*';

SELECT regexp_replace('ana ana', 'ana', 'banana', 'g');

insert into regex values ('abc', '*');

CREATE TABLE t_repl_invalid(s VARCHAR, pat VARCHAR, repl VARCHAR);

SELECT count(TRY(regexp_replace(s, CASE i % 3 WHEN 0 THEN '^a' ELSE '[' END, ''))) FROM strings;

SELECT regexp_matches('', '.*');

SELECT regexp_matches('hello
world', '.*', 's');

SELECT string_split('aäb', 'a\C');

SELECT sha1('');

INSERT INTO collate_test VALUES ('äää', 'aaa');

SELECT array_extract('hello', NULL) FROM strings;

SELECT ASCII('Ä');

select bar('nan'::double, 0, 10);

select bar(1, 0, 1, 1.125);

select BIT_LENGTH(b) FROM strings;

SELECT length_grapheme('S̈a');

SELECT substring_grapheme('🤦🏼‍♂️🤦🏼‍♂️🤦🏼‍♂️', 1, 1);

SELECT CONCAT('hello', ' ', s) FROM strings ORDER BY s;

select CONCAT(a, b) FROM strings;

select CONCAT_WS(',', a, 'SUFFIX') FROM strings WHERE a != 'Hello';

select CONCAT_WS(a, NULL, b, '') FROM strings ORDER BY a;

select CONCAT_WS(',', [], 'a', ['b','c']);

SELECT contains(s,'he') FROM strings;

INSERT INTO strings VALUES ('átomo');

SELECT damerau_levenshtein('potion', 'option');

SELECT damerau_levenshtein('cat', 'cats');

SELECT damerau_levenshtein('herse', s) FROM strings ORDER BY s;

CREATE TABLE strings(s_left VARCHAR, s_right VARCHAR);

SELECT decode(encode('aé😀', 'utf-16'), 'UTF-16');

SELECT format('hello'), format(NULL);

select format('{:b}', 123456789);

select format('{:_}', 123456789);

select format('{0:d} {0:L}', 123456789);

SELECT '3' GLOB '[0-9]';

SELECT 'a' GLOB '\\';

SELECT '6' GLOB '[1-35-7]';

SELECT s FROM strings WHERE 'aba' GLOB pat;

SELECT 'aaa' ILIKE 'A_a';

SELECT s FROM strings WHERE 'aba' NOT ILIKE pat;

SELECT id FROM t WHERE s ILIKE '%zznotfound%' ORDER BY id;

SELECT id FROM t WHERE s ILIKE NULL ORDER BY id;

SELECT ('goo' || chr(0) || 'se') ILIKE ('goo' || chr(0) || 'se');

select NULL ilike 'a$%C' escape '/';

SELECT str ILIKE pat ESCAPE esc FROM nul_escapes ORDER BY esc;

SELECT id FROM t WHERE s ILIKE '%100%done%' ESCAPE '\' ORDER BY id;

SELECT 'abc' ILIKE '%a%' ESCAPE NULL;

SELECT position('he' in s) FROM strings;

SELECT instr(s,'ñ') FROM strings;

SELECT jaccard('hello', NULL);

SELECT round(jaccard('ababababababba', 'aaaabbbccddeeffgabcccc'), 3);

select jaro_winkler_similarity('00000000000000000000000000000000000000000000000000000000000000000', '00000000000000000000000000000000000000000000000000000000000000000');

select jaro_winkler_similarity('foo', '  foo');

select jaro_winkler_similarity('CRATE', 'TRACE', 0.6);

INSERT INTO STRINGS VALUES ('abcd', 0), ('abc', -1), ('abc', -2), ('abc', -3), ('abc', -4);

SELECT levenshtein('sitting', 'kitten');

SELECT levenshtein('hallo', s) FROM strings ORDER BY s;

SET max_execution_time=50;

SELECT 'aaa' LIKE '__%';

SELECT 'zebra elephant tiger horse' LIKE 'zebra elephant tiger horse%';

SELECT 'zebra elephant tiger horse' LIKE 'zebra%tiger%elephant%horse';

SELECT 'zebra elephant tiger horse' NOT LIKE 'zebra%tiger%horse';

INSERT INTO strings VALUES ('abab', 'ab%'), ('aaa', 'a*_a'), ('aaa', '*%b'), ('bbb', 'a%');

SELECT ilike_escape(repeat('A', 30000) || 'b', repeat('%a', 30000) || '%c', '');

SELECT mismatches(s, 'hallo') FROM strings ORDER BY s;

select LPAD('Base', 7, '-|'), LPAD('Base', 6, '-|'), LPAD('Base', 5, '-|'), LPAD('Base', 4, '-|');

SELECT prefix('abcd', 'abc');

SELECT prefix('abcdefghijklmnopqrstuvwxyz', 'abcde');

SELECT prefix('ñeft', 'ñeft');

SELECT printf('hello'), printf(NULL);

SELECT printf('%d', '170141183460469231731687303715884105727'::HUGEINT);

SELECT printf('%.2f', 10.0::FLOAT), printf('%.4f', 0.5);

SELECT regexp_extract_all('ab', '$'), regexp_extract_all('ab', 'x*'), regexp_extract_all('axb', 'x*'), regexp_extract_all('aé中', '');

SELECT repeat('hello world', 0);

select REPLACE(a, 'l', '-') FROM strings;

SELECT 'aaa' SIMILAR TO '.*';

SELECT 'aaa' SIMILAR TO '^a';

SELECT levenshtein('é', 'e'), editdist3('é', 'e'), damerau_levenshtein('é', 'e'), damerau_levenshtein('éü', 'üé'), hamming('é', 'e'), hamming('éa', 'üa');

select split_part('a,b,c',',',-1);

SELECT STARTS_WITH('hello world', 'a'),
       STARTS_WITH('hello world', 'ha'),
       STARTS_WITH('hello world', 'hea'),
       STARTS_WITH('hello world', 'hela'),
       STARTS_WITH('hello world', 'hella'),
       STARTS_WITH('hello world', 'helloa'),
       STARTS_WITH('hello world', 'hello a'),
       STARTS_WITH('hello world', 'hello wa'),
       STARTS_WITH('hello world', 'hello woa'),
       STARTS_WITH('hello world', 'hello wora');

SELECT starts_with(s,'two ñ thr') FROM strings;

SELECT s ^@ 'á' FROM strings;

SELECT array_slice(s, 2, 3) FROM strings;

SELECT array_slice(s, 0, 1) FROM strings;

INSERT INTO nulltable VALUES (NULL);

SELECT 'hello'[off+1:NULL+off] FROM strings;

SELECT s[(-2147483646-1):-2147483647] FROM strings;

SELECT UNNEST(string_split('🦆 🦆 🦆 🦆 🦆', ' '));

SELECT UNNEST(string_split_regex('aaaaa', ''));

select UNNEST(string_split('abc', ','));

SELECT s[off] FROM strings;

SELECT substring(s from 1 for length) FROM strings;

SELECT SUBSTRING('hello' FROM 2);

CREATE TABLE clusters AS SELECT * FROM (VALUES
	('zwj', repeat('🦆' || chr(8205), 20) || '🦆'),
	('family', '👨‍👩‍👧‍👦'),
	('flag', '🇳🇱'),
	('combining', 'e' || repeat(chr(769), 30)),
	('hangul', chr(4352) || chr(4449) || chr(4520)),
	('indic', chr(2325) || chr(2381) || chr(2359)),
	('spacing_mark', 'a' || chr(2366)),
	('prepend', chr(1536) || chr(1537) || 'x')
) t(name, c);

SELECT suffix('abcdefgh', 'efgh');

SELECT suffix(NULL, 'aaa');

SELECT suffix('two ñ three ₡ four 🦆 end', 'two ñ three ₡ four 🦆 end');

SELECT to_base(col0, 36) FROM fib ORDER BY col0;

select TRANSLATE('MotörHeadΩ', 'aeΩ', 'eÄ');

select LTRIM(b) FROM strings;

select UNICODE(b) FROM strings;

SELECT ({'a': 1, 'z': 2}).z;

CREATE TABLE executor_input(i INTEGER, s VARCHAR);

SELECT date_part(NULL::VARCHAR, NULL::TIME) FROM times;

SELECT EXTRACT(second FROM i) FROM times;

select time_bucket('3 years'::interval, null::time) from times;

select time_bucket('7 months'::interval, null::time, '08:08:10'::time) from times;

select time_bucket('-1 month'::interval, null::time, '10:00:00'::time);

INSERT INTO timestamp VALUES('2019-06-11', '2019-06-11');

SELECT AGE(DATE '1900-01-01', DATE '1950-01-01');

SET TimeZone='Pacific/Honolulu';

SELECT date_trunc('hour', TIMESTAMP '1900-01-01 12:34:56');

SELECT count(*) FILTER (century(x) = 1), count(*) FILTER (century(x) >= 2) FROM b2;

SELECT TRY_CAST('290309-12-22 (BC) 00:00:00 Asia/Tokyo' AS TIMESTAMPTZ);

SELECT ts, mts
FROM (SELECT ts, make_timestamp(year(ts), month(ts), day(ts), hour(ts), minute(ts), microsecond(ts) / 1000000.0) mts
	FROM timestamps) t
WHERE mts IS DISTINCT FROM ts;

SELECT md
FROM (SELECT make_time(NULL, minute(d), microsecond(d) / 1000000.0) md FROM dates) t
WHERE md IS NOT NULL;

SELECT 
	start_ts, 
	end_ts, 
	DATEDIFF('second', start_ts, end_ts) AS dd_second 
FROM VALUES (
	'1970-01-01 00:00:12.456'::TIMESTAMP, 
	'1969-12-31 23:59:05.123'::TIMESTAMP
	) x(start_ts, end_ts);

SELECT ts::DATE AS d, DATE_PART(['weekday', 'isodow','doy', 'julian'], ts) AS parts
FROM timestamps
ORDER BY ts;

SELECT ts, epoch_us(ts) FROM timestamps ORDER BY ALL;

SELECT t,
       hour(t) AS h, 
       minute(t) AS m, 
       second(t) AS s,
       date_part('second', t) AS dp_second,
       extract('microsecond' FROM t) AS us,
       epoch_ns(t) % 1000000000 AS ns_of_second
FROM (VALUES ('2026-07-01 09:59:59.999999533'::TIMESTAMP_NS),
             ('2026-07-01 09:32:06.999999533'::TIMESTAMP_NS),
             ('2026-07-01 09:32:06.999999499'::TIMESTAMP_NS)) v(t);

SELECT EXTRACT(quarter FROM i) FROM timestamps;

SELECT EXTRACT(microseconds FROM i) FROM timestamps;

SELECT t1 - t2 FROM timestamps;

select 'epoch'::timestamptz + '-9223372022400001001 microseconds'::interval;

select '2000-04-09 17:00:00-07'::timestamptz - interval 2400 hours;

set timezone = 'Europe/London';

SELECT '1962-07-31 12:20:48.000000001Z'::TIMESTAMPTZ_NS + INTERVAL '-1 microsecond',
	'1962-07-31 12:20:48.000000001Z'::TIMESTAMPTZ_NS - INTERVAL '1 microsecond';

SELECT '1677-09-21 00:12:43.145224192+00'::TIMESTAMPTZ_NS + INTERVAL 1 month,
	'1677-09-21 00:12:43.145224192+00'::TIMESTAMPTZ_NS + INTERVAL 1 year;

SELECT part, date_diff(part, startdate, enddate)
FROM datetime_ns, (VALUES ('era'), ('year'), ('month'), ('day'), ('hour')) parts(part);

SELECT starttime, recordtime, date_diff('minute', starttime, recordtime)
FROM issue9673;

CREATE TABLE timestamps AS SELECT * FROM (VALUES
	('0044-03-13 (BC) 10:33:41.987654+01'::TIMESTAMPTZ, 'era'),
	('1962-07-31 12:20:48.123456+00'::TIMESTAMPTZ, 'epoch'),
	('2021-01-01 00:00:00+00'::TIMESTAMPTZ, 'year'),
	('2021-02-02 00:00:00+00'::TIMESTAMPTZ, 'month'),
	('2021-11-26 10:15:13.123456+00'::TIMESTAMPTZ, 'microsecond'),
	('2021-11-15 02:30:00-08'::TIMESTAMPTZ, 'hour'),
	('2021-11-15 02:30:00-07'::TIMESTAMPTZ, 'minute'),
	('2021-12-25 00:00:00+02'::TIMESTAMPTZ, 'day'),
	('infinity'::TIMESTAMPTZ, 'second'),
	('-infinity'::TIMESTAMPTZ, 'decade'),
	(NULL::TIMESTAMPTZ, 'century'),
) tbl(ts, part);

SELECT isodow(ts), isodow(ts::TIMESTAMP) FROM timestamps;

SELECT JULIAN(ts) FROM timestamps;

SELECT DATE_PART(['hour', 'minute', 'microsecond'], ts), ts
FROM timestamps
ORDER BY 2;

SET Calendar = 'hebrew';

SELECT date_part('microsecond', ns)
FROM nanos;

SELECT
	date_sub('year', '2-01-01 (BC)'::TIMESTAMPTZ, '2-01-01'::TIMESTAMPTZ),
	date_sub('year', '2-01-01'::TIMESTAMPTZ, '2-01-01 (BC)'::TIMESTAMPTZ);

select DATESUB('hour', '2004-01-31 12:00:00-08'::TIMESTAMPTZ, '2004-02-01 12:00:00-08'::TIMESTAMPTZ);

select DATESUB('microsecond', '2004-01-31 12:00:00.000050-08'::TIMESTAMPTZ, '2004-02-01 12:00:00-08'::TIMESTAMPTZ);

SELECT date_trunc('minute', TIMESTAMPTZ '1992-02-02 04:03:02Z') FROM timestamps LIMIT 1;

SELECT date_trunc('day', TIMESTAMPTZ '2019-01-06 04:03:02-08') FROM timestamps LIMIT 1;

INSERT INTO timestamps VALUES
	('1001-03-15 (BC) 20:38:40+00'),
	('0044-03-15 (BC) 20:38:40+00'),
	('1962-07-31 12:20:48.123456+00'),
	('1969-01-01 01:03:20.45432+00'),
	('1992-01-01 01:01:01.400+00'),
	('1992-01-01 01:01:02.200+00'),
	('1992-01-01 01:01:02.400+00'),
	('1993-08-14 08:22:33+00'),
	('1993-08-14 08:22:33.42+00'),
	('2001-04-20 14:42:11.0+00'),
	('2001-04-20 14:42:11.123+00'),
	('2004-01-31 12:00:00.000050+00'),
	('2004-01-31 12:00:00.050+00'),
	('2004-02-01 12:00:00.000050+00'),
	('2004-02-01 12:00:00.050+00'),
	('2004-02-29 13:05:47.123456+00'),
	('2008-01-01 00:00:01.5+00'),
	('2008-01-01 00:00:01.594+00'),
	('2008-01-01 00:00:01.794+00'),
	('2008-01-01 00:00:01.88926+00'),
	('2008-01-01 00:00:01.894+00'),
	('2008-01-01 00:00:01.98926+00'),
	('2008-01-01 00:00:01.99926+00'),
	('2008-01-01 00:00:11.1+00'),
	('2019-01-06 04:03:02.123456+00'),
	('2019-01-06 04:03:02.5+00'),
	('2020-01-01 00:00:01.88926+00'),
	('2020-12-31 21:25:58.745232+00'),
	('2021-04-15 14:55:17.915+00'),
	('2021-04-15 14:55:17.915000+00'),
	('2021-05-02 12:11:49.5+00'),
	('2021-12-01 13:54:48.123456+00'),
	(NULL);

SELECT make_timestamptz(2021, 12, 30, 10, NULL, 4.123, 'America/New_York');

SELECT ts, strftime(ts, '%Y-%m-%d %H:%M:%S.%f %Z') FROM timestamps;

select strptime(NULL, '%Y-%m-%d %H:%M:%S.%g %Z');

INSERT INTO multiples VALUES
	('2022-03-05 17:59:17.877 CST', '%Y-%m-%d %H:%M:%S.%g %Z'),
	('2022-03-05 17:59:17.877', '%Y-%m-%d %H:%M:%S.%g'),;

select t, time_bucket('3 days'::interval, t) from timestamps_tz;

select t, time_bucket('11 days'::interval, t, '1990-01-06 08:08:10+09'::timestamptz) from timestamps_tz;

select t, time_bucket('11 seconds'::interval, t, null::text) from timestamps_tz;

INSERT INTO timestamps_tz_ns VALUES ('10 days', '-infinity', '0 days', '1970-01-05 00:00:00+00', 'UTC'),
	('333 microseconds', '1907-11-20 04:00:00+08', '0 microseconds', '1970-03-06 00:00:00+00', 'UTC'),
	('333 microseconds', '1970-01-01 00:00:00+00', '444 microseconds', '1970-01-05 00:05:05.006006+03', 'America/Los_Angeles'),
	('333 microseconds', '1979-04-10 02:02:05.003003123-03', '-444 microseconds', '1962-12-10 00:05:05.006006-03', 'America/Los_Angeles'),
	('333 milliseconds', '1981-09-30 02:02:06.003003456+00', '0 milliseconds', '1970-02-05 00:00:00+00', 'UTC'),
	('333 milliseconds', '1982-06-15 02:02:07.003003789+04', '444 milliseconds', '1970-11-15 00:05:05.006006+04', 'Asia/Aden'),
	('333 milliseconds', '1985-02-20 02:02:08.003003012-04', '-444 milliseconds', '1980-08-05 00:05:05.006006-04', 'Asia/Aden'),
	('333 seconds', '1989-06-08 02:02:09.003003234+00', '0 seconds', '1970-11-25 00:00:00+00', 'UTC'),
	('333 seconds', '1990-07-11 02:02:10.003003567+02', '444 seconds', '1970-04-10 00:05:05.006006+02', 'Pacific/Guam'),
	('333 seconds', '1991-05-12 02:02:11.003003890-02', '-444 seconds', '1971-01-05 00:05:05.006006-02', 'Pacific/Guam'),
	('333 minutes', '1992-10-17 02:02:12.003003123+00', '0 minutes', '1950-04-24 00:00:00+00', 'UTC'),
	('333 minutes', '1994-12-05 02:02:13.003003456+05', '444 minute', '1970-06-09 00:05:05.006006+05', 'Europe/Berlin'),
	('333 minutes', '1997-01-02 02:02:14.003003789-05', '-444 minute', '1970-07-06 00:05:05.006006-05', 'Europe/Berlin'),
	('333 hours', '1999-04-26 02:02:15.003003012+00', '0 hours', '1970-02-05 00:00:00+00', 'UTC'),
	('333 hours', '2000-01-01 00:00:00+00', '444 hours', '1970-01-05 00:05:05.006006+01', 'Europe/London'),
	('333 hours', '2000-01-03 00:00:00+00', '-444 hours', '1970-03-15 00:05:05.006006-01', 'Europe/London'),
	('333 hours', '2000-03-26 02:00:00+01', '0 hours', '1980-10-05 00:00:00+00', 'Europe/London'),
	('333 hours', '2000-04-02 03:00:00-07', '0 hours', '1990-05-20 00:00:00+00', 'Europe/London'),
	('333 hours', '2000-10-29 01:00:00+00', '0 hours', '2010-07-27 00:00:00+00', 'Europe/London'),
	('333 hours', '2000-10-29 01:00:00-08', '0 hours', '2010-07-27 00:00:00+00', 'Europe/London'),
	('10 days', '2008-12-31 23:59:59.999999000+00', '0 days', '1970-02-27 00:00:00+00', 'UTC'),
	('1 week', '2010-05-03 02:02:19.003003345+00', '0 days', '1970-07-25 00:00:00+00', 'UTC'),
	('10 days', '2013-08-19 02:02:20.003003678+02', '2 days 4 hours', '2003-03-24 00:05:05.006006+02', 'Asia/Kolkata'),
	('10 days', '2014-07-15 02:02:21.003003901-02', '-2 days 4 hours', '1970-04-12 00:05:05.006006-02', 'Asia/Kolkata'),
	('2 months', '2016-03-21 02:02:22.003003234+00', '0 months', '1970-11-05 00:00:00+00', 'UTC'),
	('2 months', '2018-02-01 02:02:23.003003567+09', '1 month 1 week', '1970-05-07 00:05:05.006006+09', 'Australia/Sydney'),
	('2 months', '2019-09-30 02:02:24.003003890-09', '-1 month 1 week', '1969-10-09 00:05:05.006006-09', 'Australia/Sydney'),
	('2 year', '2020-03-20 02:02:25.003003123+11', '6 months', '2032-06-29 00:05:05.006006+11', 'Asia/Yekaterinburg'),
	('2 year', '2022-07-20 02:02:26.003003456-11', '-6 months', '1969-11-14 00:05:05.006006-11', 'Asia/Yekaterinburg'),
	('10 days', '2024-08-12 02:02:26.003003789+07', '1 year', '-infinity', 'Asia/Tokyo'),
	('10 days', '2032-12-18 02:02:26.003003012-07', '-1 year', 'infinity', 'Asia/Tokyo'),
	('10 days', 'infinity', '0 days', '1970-01-01 00:00:00+00', 'UTC'),;

select w, t, shift, time_bucket(w, t, shift) from timestamps_tz_ns;

select t, time_bucket(null::interval, t, 'Asia/Calcutta') from timestamps_tz_ns;

EXECUTE v1;

SELECT strftime(d, '%h') FROM timestamps ORDER BY d;

SELECT strftime(d, '%n') 
FROM timestamps 
ORDER BY d;

SELECT strptime('21/10/2018', '%d/%m/%Y');

SELECT strptime('1', '%U');

select strptime('2024 100', '%Y %j');

SELECT * FROM (
    SELECT dt, strftime(dt, '%G-%V-%u') AS ft, strptime(strftime(dt, '%G-%V-%u'), '%G-%V-%u') AS rt
    FROM (SELECT '2021-01-01'::DATE + (INTERVAL (d) DAY) AS dt FROM range(365) tbl(d)) days
) diffs
WHERE rt <> dt;

select strptime('2020-12-30 23:25:58.745232-04', '%Y-%m-%d %H:%M:%S.%f%z');

SELECT try_strptime('infinity trailing', '%Y-%m-%d') IS NULL;

SELECT try_strptime('21 June, 2018', '%d %B, %Y');

select time_bucket('3 months'::interval, null::timestamp, '2 seconds'::interval) from timestamps;

select time_bucket('1 month 1 day'::interval, null::timestamp);

SELECT date_sub('millisecond', a::TIMESTAMPTZ, b::TIMESTAMPTZ) = (epoch_us(b)::HUGEINT - epoch_us(a)::HUGEINT) // 1000, date_sub('second', a::TIMESTAMPTZ, b::TIMESTAMPTZ) = (epoch_us(b)::HUGEINT - epoch_us(a)::HUGEINT) // 1000000, date_sub('minute', a::TIMESTAMPTZ, b::TIMESTAMPTZ) = (epoch_us(b)::HUGEINT - epoch_us(a)::HUGEINT) // 60000000 FROM ts;

SELECT try_strptime('Mon 30, December 2003, 7:3:5 PM', '%a %d, %B %Y, %I:%M:%S %p');

SELECT try_strptime('6', '%w');

SELECT try_strptime('2021-1-5', '%G-%V-%u'), strftime('2021-01-08'::DATE, '%G-%V-%u');

select try_strptime('2020-12-31 21:25:58.745232-02', '%Y-%m-%d %H:%M:%S.%f%z');

select try_strptime('2020-12-31 21:25:58.745232+000', '%Y-%m-%d %H:%M:%S.%f%z');

SELECT try_strptime('2000-10-01 23:59:59.10000000', '%Y-%m-%d %H:%M:%S.%f');

SELECT try_strptime('junee', '%B');

SELECT try_strptime('20 19', '%U %j');

SELECT try_strptime('20 1950', '%V %Y');

SELECT w, try_strptime(w, ['%d/%m/%Y', '%n']), strptime(w, ['%d/%m/%Y', '%n']) FROM words ORDER BY i;

SELECT '12:00:00'::TIMETZ, TIME '12:00:00'::TIMETZ, TIMESTAMPTZ '2000-01-01 00:00:00+00'::TIMETZ;

SELECT d, epoch_ms(d) FROM timetzs ORDER BY ALL;

SELECT start, token_type, word FROM sql_tokenize('1+-2 2**-3');

select start, token_type, word from sql_tokenize($$select * fro$$);

CREATE TABLE uuids(u UUID NOT NULL DEFAULT gen_random_uuid(), a INTEGER);

SELECT uuid_extract_version('ac227128-7d55-4ee0-a765-5025cc52e55a');

select variant_array_length(a, '') from struct_cast_data();

select variant_array_length(j, ['a', 'b']) from (values ({'a': [1, 2]}::VARIANT), (NULL::VARIANT)) t(j);

SELECT variant_array_length(v, 'arr') FROM variants ORDER BY id;

SELECT ((TIMESTAMP_MS '2025-01-02 03:04:05.678')::VARIANT)::TIMESTAMP_MS =
       TIMESTAMP_MS '2025-01-02 03:04:05.678';

SELECT ((B'101001')::VARIANT)::BIT = B'101001';

SELECT try_cast(([[1::VARIANT, 2::VARIANT], [3::VARIANT, 'bad'::VARIANT]])::VARIANT
                AS TUPLE(INTEGER, INTEGER)[]);

SELECT variant_contains('[{"a": 1}, {"b": 2}]'::JSON::VARIANT, '{"a": 1, "b": 2}'::JSON::VARIANT);

CREATE TABLE contains_data(id INTEGER, haystack VARIANT, needle VARIANT);

select variant_exists(a, 'c') from struct_cast_data();

create table t1 as
select range, case when range % 2 = 0 then {"duck": 42}::VARIANT else {"duck": 42, "goose": 43}::VARIANT end j
from range(4096);

select variant_extract(a, 'a[1].c') from struct_cast_data();

select variant_extract_string(a, ['']) from struct_cast_data();

SELECT variant_extract_string({'interval': interval}::VARIANT, '')
FROM test_all_types()
WHERE bool = false;

select variant_extract_string({'a': 1}::VARIANT, NULL);

set explain_output='optimized_only';

INSERT INTO variants VALUES
	-- partially shredded
	(1, {'z': 9, 'a': 1, 'b': 2}::VARIANT),
	-- VARIANT_NULL
	(2, {'a': 10, 'b': NULL}::VARIANT),
	-- missing value in shredded schema
	(3, {'a': 20}::VARIANT),
	-- root with different type than shredded schema
	(4, 42::VARIANT),
	-- SQL-NULL
	(5, NULL::VARIANT);

select variant_keys(a, 'c') from struct_cast_data();

select variant_keys(j, 'a') from (values ({'a': {'x': 1}}::VARIANT), (NULL::VARIANT)) t(j);

SELECT variant_keys(v) FROM variants ORDER BY id;

select
	(list_variant.my_struct::STRUCT(b VARCHAR, a VARCHAR)).b[1]
from
	list_variant
limit 1;

SELECT [*COLUMNS(*)] FROM (
	SELECT variant_type(
		COLUMNS(lambda c: NOT regexp_matches(c, 'array|struct|map|union|tuple'))::VARIANT
	)
	FROM test_all_types()
	-- strip NULLs from output
	WHERE bool IS NOT NULL
);

SELECT variant_type(v, 'z') FROM variants ORDER BY id;

select variant_typeof(variant_extract(test, 'struct').variant_extract('a')) from all_types limit 2;
