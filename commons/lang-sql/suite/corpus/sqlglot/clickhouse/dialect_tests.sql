SELECT varSamp(x) FROM t;

SELECT purchases, LAST_VALUE(item) OVER item_window AS most_popular FROM Produce WINDOW item_window AS (PARTITION BY purchases ORDER BY purchases NULLS FIRST ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING);

SELECT LAST_DAY(CAST('2008-11-25' AS Nullable(DATE)));

SELECT countIf(x);

SELECT LOWER(HEX(MD5(some_string)));

SELECT JSONExtractString(j, 'a');

SELECT $$a\$b$$;

SELECT 'a\\$b';

SELECT 1 SETTINGS log_comment = 'performance';

SELECT DISTINCT ON ("id") * FROM t;

SELECT 1 OR (1 = 2);

SELECT 1 AND (1 = 2);

SELECT json.a.:Int64;

SELECT json.a.:JSON.b.:Int64;

SELECT json.a.b.:"Array(JSON)".c;

SELECT json.a.b.:"Array(Array(JSON))".c;

SELECT json.a.b[].c;

SELECT json.a.b[][];

SELECT json.a.b.:"Array(Array(JSON))";

WITH arrayJoin([(1, [2, 3])]) AS arr SELECT arr;

SELECT toString(CHAR(104.1, 101, 108.9, 108.9, 111, 32));

SELECT toFloat(like);

SELECT like;

SELECT STR_TO_DATE(str, fmt, tz);

SELECT STR_TO_DATE('05 12 2000', '%d %m %Y');

SELECT EXTRACT(YEAR FROM toDateTime('2023-02-01'));

SELECT * FROM x LIMIT 1 UNION ALL SELECT * FROM y;

SELECT 1 UNION ALL SELECT 2 INTERSECT SELECT 2 FORMAT JSON;

SELECT 1 UNION ALL (SELECT 2 INTERSECT SELECT 2) FORMAT JSON;

SELECT 1 UNION ALL SELECT 1 INTERSECT SELECT 1 LIMIT 1 SETTINGS limit = 1;

SELECT 1 UNION ALL (SELECT 1 INTERSECT SELECT 1 LIMIT 1) SETTINGS limit = 1;

SELECT CAST(x AS Tuple(String, Array(Nullable(Float64))));

SELECT * FROM (SELECT a FROM b SAMPLE 0.01);

SELECT * FROM (SELECT a FROM b SAMPLE 1 / 10 OFFSET 1 / 2);

SELECT sum(foo * bar) FROM bla SAMPLE 10000000;

SELECT isNaN(1.0);

SELECT startsWith('Spider-Man', 'Spi');

SELECT xor(TRUE, FALSE);

SELECT x, COUNT() FROM y GROUP BY x WITH TOTALS;

SELECT x, COUNT() FROM y GROUP BY x WITH TOTALS LIMIT 1;

SELECT INTERVAL t.days DAY;

SELECT match('abc', '([a-z]+)');

WITH final AS (SELECT 1) SELECT * FROM final;

SELECT * FROM x FINAL;

SELECT * FROM x AS y FINAL;

SELECT event_id FROM "analytics"."events_view"(final = 1);

SELECT event_id FROM "analytics"."uniqExactIf"(final = 1);

SELECT event_id FROM "analytics".uniqExactIf(final = 1);

SELECT event_id FROM "analytics"."sum"(final = 1);

SELECT event_id FROM "analytics".sum(final = 1);

SELECT * FROM foo LEFT ANY JOIN bla;

SELECT * FROM foo LEFT ASOF JOIN bla;

SELECT * FROM foo ASOF JOIN bla;

SELECT * FROM foo ANY JOIN bla;

SELECT * FROM foo PASTE JOIN bla;

SELECT * FROM foo AS a PASTE JOIN bla AS b PASTE JOIN baz AS c;

SELECT paste(paste) FROM paste AS paste;

SELECT * FROM foo GLOBAL ANY JOIN bla;

SELECT * FROM foo GLOBAL LEFT ANY JOIN bla;

SELECT quantile(0.5)(a);

SELECT quantiles(0.5)(a) AS x FROM t;

SELECT quantilesIf(0.5)(a, a > 1) AS x FROM t;

SELECT quantileState(0.5)(a) AS x FROM t;

SELECT deltaSumMerge(a) AS x FROM t;

SELECT quantiles(0.1, 0.2, 0.3)(a);

SELECT quantileTiming(0.5)(RANGE(100));

SELECT histogram(5)(a);

SELECT groupUniqArray(2)(a);

SELECT exponentialTimeDecayedAvg(60)(a, b);

SELECT groupBitAnd(x) OVER (PARTITION BY y) FROM t;

SELECT * FROM foo WHERE x GLOBAL IN (SELECT * FROM bar);

SELECT * FROM foo WHERE x GLOBAL NOT IN (SELECT * FROM bar);

SELECT arrayJoin([1, 2, 3] AS src) AS dst, 'Hello', src;

SELECT JSONExtractString('{"x": {"y": 1}}', 'x', 'y');

SELECT JSONExtractRaw('{"x": {"y": 1}}', 'x', 'y');

SELECT * FROM table LIMIT 1 BY a, b;

SELECT * FROM table LIMIT 2 OFFSET 1 BY a, b;

TRUNCATE TABLE t1 ON CLUSTER test_cluster;

TRUNCATE TABLE t1 ON CLUSTER '{cluster}';

CREATE TABLE test (id UInt8) ENGINE=Null();

SELECT * FROM foo ORDER BY bar OFFSET 0 ROWS FETCH NEXT 10 ROWS WITH TIES;

SELECT 1 AS x LIMIT 1;

SELECT 1 AS x LIMIT 2 OFFSET 1;

SELECT 1 AS x ORDER BY x NULLS FIRST FETCH FIRST 1 ROWS ONLY UNION ALL SELECT 2 AS x;

SELECT 2 AS x UNION ALL SELECT 1 AS x ORDER BY x NULLS FIRST FETCH FIRST 1 ROWS ONLY;

SELECT 1 AS x ORDER BY x NULLS FIRST LIMIT 1 OFFSET 1 UNION ALL SELECT 2 AS x;

SELECT DATE_BIN(toDateTime('2023-01-01 14:45:00'), INTERVAL '1' MINUTE, toDateTime('2023-01-01 14:35:30'), 'UTC');

SELECT CAST(1730098800 AS DateTime64) AS DATETIME, 'test' AS interp ORDER BY DATETIME WITH FILL FROM toDateTime64(1730098800, 3) - INTERVAL '7' HOUR TO toDateTime64(1730185140, 3) - INTERVAL '7' HOUR STEP toIntervalSecond(900) INTERPOLATE (interp);

SELECT number, COUNT() OVER (PARTITION BY number % 3) AS partition_count FROM numbers(10) WINDOW window_name AS (PARTITION BY number) QUALIFY partition_count = 4 ORDER BY number;

SELECT id, quantileGK(100, 0.95)(reading) OVER (PARTITION BY id ORDER BY id RANGE BETWEEN 30000 PRECEDING AND CURRENT ROW) AS window FROM table;

SELECT * FROM table LIMIT 1 BY CONCAT(datalayerVariantNo, datalayerProductId, warehouse);

SELECT JSONExtractString('{"a": "hello", "b": [-100, 200.0, 300]}', 'a');

SELECT JSONExtractRaw(payload, 'amount'), JSONExtractString(payload, 'amount');

ATTACH DATABASE DEFAULT ENGINE = ORDINARY;

SELECT n, source FROM (SELECT toFloat32(number % 10) AS n, 'original' AS source FROM numbers(10) WHERE number % 3 = 1) ORDER BY n WITH FILL;

SELECT n, source FROM (SELECT toFloat32(number % 10) AS n, 'original' AS source FROM numbers(10) WHERE number % 3 = 1) ORDER BY n WITH FILL FROM 0 TO 5.51 STEP 0.5;

SELECT toDate((number * 10) * 86400) AS d1, toDate(number * 86400) AS d2, 'original' AS source FROM numbers(10) WHERE (number % 3) = 1 ORDER BY d2 WITH FILL, d1 WITH FILL STEP 5;

SELECT n, source, inter FROM (SELECT toFloat32(number % 10) AS n, 'original' AS source, number AS inter FROM numbers(10) WHERE number % 3 = 1) ORDER BY n WITH FILL FROM 0 TO 5.51 STEP 0.5 INTERPOLATE (inter AS inter + 1);

SELECT SUM(1) AS impressions, arrayJoin(cities) AS city, arrayJoin(browsers) AS browser FROM (SELECT ['Istanbul', 'Berlin', 'Bobruisk'] AS cities, ['Firefox', 'Chrome', 'Chrome'] AS browsers) GROUP BY 2, 3;

SELECT sum(1) AS impressions, (arrayJoin(arrayZip(cities, browsers)) AS t).1 AS city, t.2 AS browser FROM (SELECT ['Istanbul', 'Berlin', 'Bobruisk'] AS cities, ['Firefox', 'Chrome', 'Chrome'] AS browsers) GROUP BY 2, 3;

SELECT CAST(tuple(1 AS "a", 2 AS "b", 3.0 AS "c").2 AS Nullable(String));

CREATE TABLE test (id UInt8) ENGINE=AggregatingMergeTree() ORDER BY tuple();

CREATE TABLE test UUID '28f1c61c-2970-457a-bffe-454156ddcfef' (n UInt64) ENGINE=MergeTree;

CREATE TABLE test ON CLUSTER default (id UInt8) ENGINE=AggregatingMergeTree() ORDER BY tuple();

CREATE TABLE test ON CLUSTER '{cluster}' (id UInt8) ENGINE=AggregatingMergeTree() ORDER BY tuple();

CREATE MATERIALIZED VIEW test_view ON CLUSTER cl1 (id UInt8) ENGINE=AggregatingMergeTree() ORDER BY tuple() AS SELECT * FROM test_data;

CREATE MATERIALIZED VIEW test_view ON CLUSTER '{cluster}' (id UInt8) ENGINE=AggregatingMergeTree() ORDER BY tuple() AS SELECT * FROM test_data;

CREATE MATERIALIZED VIEW test_view ON CLUSTER cl1 TO table1 AS SELECT * FROM test_data;

CREATE MATERIALIZED VIEW test_view ON CLUSTER '{cluster}' TO table1 AS SELECT * FROM test_data;

CREATE MATERIALIZED VIEW test_view TO db.table1 (id UInt8) AS SELECT * FROM test_data;

CREATE TABLE t (foo String CODEC(LZ4HC(9), ZSTD, DELTA), size String ALIAS formatReadableSize(size_bytes), INDEX idx1 a TYPE bloom_filter(0.001) GRANULARITY 1, INDEX idx2 a TYPE set(100) GRANULARITY 2, INDEX idx3 a TYPE minmax GRANULARITY 3);

SELECT generate_series FROM generate_series(0, 10) AS g(x);

SELECT t.c FROM (SELECT arrayJoin([1,2,3,4,5]) AS c) AS t WHERE (t.c + 0) NOT IN (1,2);

SELECT t.c FROM (SELECT arrayJoin([1, 2, 3, 4, 5]) AS c) AS t WHERE NOT ((t.c + 0) IN (1, 2));

SELECT * FROM t1, t2;

SELECT * FROM t1 CROSS JOIN t2;

SELECT and(1, 2);

SELECT (1 AND 2);

SELECT or(1, 2);

SELECT (1 OR 2);

SELECT generate_series FROM generate_series(0, 10) AS g;

SELECT generate_series FROM generate_series(0, 10) AS g(generate_series);

INSERT INTO tab VALUES ({'key1': 1, 'key2': 10}), ({'key1': 2, 'key2': 20}), ({'key1': 3, 'key2': 30});

INSERT INTO tab VALUES ((map('key1', 1, 'key2', 10))), ((map('key1', 2, 'key2', 20))), ((map('key1', 3, 'key2', 30)));

SELECT (toUInt8('1') + toUInt8('2')) IS NOT NULL;

SELECT NOT ((toUInt8('1') + toUInt8('2')) IS NULL);

SELECT $1$foo$1$;

SELECT 'foo';

SELECT * FROM table LIMIT 1, 2 BY a, b;

SELECT SUM(1) AS impressions FROM (SELECT ['Istanbul', 'Berlin', 'Bobruisk'] AS cities) WHERE arrayJoin(cities) IN ['Istanbul', 'Berlin'];

SELECT SUM(1) AS impressions FROM (SELECT ['Istanbul', 'Berlin', 'Bobruisk'] AS cities) WHERE arrayJoin(cities) IN ('Istanbul', 'Berlin');

SELECT SUBSTRING_INDEX(str, delim, count);

SELECT SUBSTRING_INDEX('a.b.c.d', '.', 2);

SELECT SUBSTRING_INDEX('a.b.c.d', '.', -2);

SELECT substringIndex('a.b.c.d', '.', 2);

SELECT CAST(STR_TO_DATE(SUBSTRING(a.eta, 1, 10), '%Y-%m-%d') AS Nullable(DATE));

SELECT lag(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

SELECT lead(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

SELECT lagInFrame(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

SELECT leadInFrame(salary, 1, 0) OVER (ORDER BY hire_date) AS prev_sal FROM employees;

SELECT CAST(STR_TO_DATE('05 12 2000', '%d %m %Y') AS Nullable(DATE));

SELECT * FROM x PREWHERE y = 1 WHERE z = 2;

SELECT * FROM x AS prewhere;

SELECT a, b FROM (SELECT * FROM x) AS t(a, b);

SELECT arrayJoin([1,2,3]);

SELECT arrayJoin([1, 2, 3]);

SELECT 2 = ANY(SELECT 2);

SELECT 2 <> ANY(SELECT 1);

SELECT 2 = ANY(SELECT 1 UNION ALL SELECT 2);

SELECT CAST('2020-01-01' AS Nullable(DateTime)) + INTERVAL '500' MICROSECOND;

SELECT CURRENT_DATE();

SELECT CURRENT_TIMESTAMP();

SELECT match('ThOmAs', CONCAT('(?i)', 'thomas'));

SELECT match('ThOmAs', CONCAT('(?i)', x)) FROM t;

SELECT countMatches(s, 'a');

SELECT countMatches(substringUTF8(s, 3), CONCAT('(?is)', 'a.b'));

SELECT countMatches(substringUTF8(s, 1), 'a');

SELECT '\0';

SELECT "a\\";

SELECT "a\\""b";

SELECT `a\\b`;

SELECT "a\\b";

SELECT xor(1, 0);

SELECT xor(0, 1, xor(1, 0, 0));

SELECT xor(xor(0, 1), (xor(xor(1, 0), 0)));

SELECT xor(xor(1, 0), 1);

SELECT xor((xor(1, 0)), 1);

SELECT xor(0, 1, 1, 0);

SELECT xor(xor(xor(0, 1), 1), 0);

SELECT uniq(x) FROM (SELECT any(y) AS x FROM (SELECT 1 AS y));

SELECT fname, lname, age FROM person ORDER BY age DESC NULLS FIRST, fname ASC NULLS LAST, lname;

SELECT fname, lname, age FROM person ORDER BY age DESC NULLS FIRST, fname ASC, lname;

SELECT x #! comment;

SELECT quantileIf(0.5)(a, true);

SELECT POSITION(needle IN haystack);

SELECT POSITION(haystack, needle);

SELECT * FROM x LIMIT 10 SETTINGS max_results = 100, result = 'break';

SELECT * FROM x LIMIT 10 SETTINGS max_results = 100, result_;

SELECT * FROM x FORMAT PrettyCompact;

SELECT * FROM x LIMIT 10 SETTINGS max_results = 100, result_ FORMAT PrettyCompact;

SELECT * FROM foo JOIN bar USING id, name;

SELECT * FROM foo JOIN bar USING (id, name);

SELECT * FROM foo ANY LEFT JOIN bla ON foo.c1 = bla.c2;

SELECT * FROM foo LEFT ANY JOIN bla ON foo.c1 = bla.c2;

SELECT * FROM foo GLOBAL ANY LEFT JOIN bla ON foo.c1 = bla.c2;

SELECT * FROM foo GLOBAL LEFT ANY JOIN bla ON foo.c1 = bla.c2;

SELECT
                loyalty,
                count()
            FROM hits SEMI LEFT JOIN users USING (UserID)
            GROUP BY loyalty
            ORDER BY loyalty ASC;

SELECT loyalty, count() FROM hits LEFT SEMI JOIN users USING (UserID) GROUP BY loyalty ORDER BY loyalty ASC;

SELECT median(a);

SELECT quantiles(0.5, 0.4)(a);

SELECT quantiles(0.5)(a);

SELECT isNaN(x), arrayReverse(a);

SELECT IS_NAN(x), ISNAN(x);

SELECT isNaN(x), isNaN(x);

SELECT isInfinite(x);

SELECT POSITION(s, 'a') > 0;

SELECT POSITION(LOWER(s), LOWER('a')) > 0;

SELECT (POSITION(s, 'a') > 0) = (POSITION(t, 'b') > 0) FROM x WHERE NOT POSITION(s, 'a') > 0 AND y;

SELECT (POSITION(s, 'a') > 0) IN (0);

SELECT startsWith('a', 'b');

SELECT STARTS_WITH('a', 'b'), STARTSWITH('a', 'b');

SELECT startsWith('a', 'b'), startsWith('a', 'b');

INSERT INTO FUNCTION s3('url', 'CSV', 'name String, value UInt32', 'gzip') SELECT name, value FROM existing_table;

INSERT INTO FUNCTION remote('localhost', default.simple_table) VALUES (100, 'inserted via remote()');

INSERT INTO FUNCTION remote('localhost', default.simple_table) VALUES ((100), ('inserted via remote()'));

INSERT INTO TABLE FUNCTION hdfs('hdfs://hdfs1:9000/test', 'TSV', 'name String, column2 UInt32, column3 UInt32') VALUES ('test', 1, 2);

INSERT INTO FUNCTION hdfs('hdfs://hdfs1:9000/test', 'TSV', 'name String, column2 UInt32, column3 UInt32') VALUES (('test'), (1), (2));

INSERT INTO t (n.a, n.b) VALUES (1, [1, 2]);

INSERT INTO t (n.a, n.b) VALUES ((1), ([1, 2]));

SELECT 1 FORMAT TabSeparated;

SELECT * FROM t FORMAT TabSeparated;

SELECT FORMAT;

SELECT formatDateTime(NOW(), '%Y-%m-%d', '%T');

SELECT formatDateTime(NOW(), '%Y-%m-%d');

SELECT formatDateTime(x, '%H:%i %M %W');

SELECT SHA1(x), SHA256(x), SHA512(x);

SELECT LOWER(HEX(SHA256(x))), LOWER(HEX(SHA1(x)));

SELECT SHA256(x);

ALTER TABLE visits DROP PARTITION 201901;

ALTER TABLE visits DROP PARTITION ALL;

ALTER TABLE visits DROP PARTITION tuple(toYYYYMM(toDate('2019-01-25')));

ALTER TABLE visits DROP PARTITION ID '201901';

ALTER TABLE visits REPLACE PARTITION 201901 FROM visits_tmp;

ALTER TABLE visits REPLACE PARTITION ALL FROM visits_tmp;

ALTER TABLE visits REPLACE PARTITION tuple(toYYYYMM(toDate('2019-01-25'))) FROM visits_tmp;

ALTER TABLE visits REPLACE PARTITION ID '201901' FROM visits_tmp;

ALTER TABLE visits ON CLUSTER test_cluster DROP COLUMN col1;

ALTER TABLE visits ON CLUSTER '{cluster}' DROP COLUMN col1;

DELETE FROM tbl ON CLUSTER test_cluster WHERE date = '2019-01-01';

DELETE FROM tbl ON CLUSTER '{cluster}' WHERE date = '2019-01-01';

ALTER TABLE t ALTER COLUMN c TYPE Nullable(Int64);

ALTER TABLE t MODIFY COLUMN IF EXISTS c Int64;

ALTER TABLE t ALTER COLUMN IF EXISTS c TYPE Int64;

ALTER TABLE t MODIFY COLUMN c REMOVE DEFAULT;

ALTER TABLE t MODIFY TTL d + INTERVAL 1 DAY;

ALTER TABLE t MODIFY TTL d + INTERVAL '1' DAY;

ALTER TABLE t MODIFY COMMENT 'hi';

INSERT INTO t (col1, col2) VALUES ('abcd', 1234);

INSERT INTO t (col1, col2) VALUES (('abcd'), (1234));

SELECT TRIM(TRAILING ')' FROM '(   Hello, world!   )');

SELECT TRIM(LEADING '(' FROM '(   Hello, world!   )');

SELECT trimLeft(s, 'xy'), trimRight(s, 'xy'), trimBoth(s, 'xy');

SELECT TRIM(LEADING 'xy' FROM s), TRIM(TRAILING 'xy' FROM s), TRIM(BOTH 'xy' FROM s);

SELECT LTRIM(s), RTRIM(s), TRIM(s);

SELECT trimLeft(s), trimRight(s), trimBoth(s);

SELECT * APPLY(sum) FROM columns_transformers;

SELECT COLUMNS('[jk]') APPLY(toString) FROM columns_transformers;

SELECT COLUMNS('[jk]') APPLY(toString) APPLY(length) APPLY(max) FROM columns_transformers;

SELECT * APPLY(sum), COLUMNS('col') APPLY(sum) APPLY(avg) FROM t;

SELECT * FROM ABC WHERE hasAny(COLUMNS('.*field') APPLY(toUInt64) APPLY(to), (SELECT groupUniqArray(toUInt64(field))));

SELECT col apply;

SELECT col AS apply;

SELECT name FROM data WHERE (SELECT DISTINCT name FROM data) IS NOT NULL;

SELECT name FROM data WHERE NOT ((SELECT DISTINCT name FROM data) IS NULL);

SELECT 1_2_3_4_5;

SELECT 12345;

SELECT 1_b;

SELECT COUNT(1) FROM table SETTINGS additional_table_filters = {'a': 'b', 'c': 'd'};

SELECT arrayConcat([1, 2], [3, 4]);

SELECT parseDateTime('2021-01-04+23:00:00', '%Y-%m-%d+%H:%i:%s');

SELECT parseDateTime('2021-01-04+23:00:00', '%Y-%m-%d+%H:%i:%s', 'Asia/Istanbul');

SELECT LIKE(a, b);

SELECT a LIKE b;

SELECT notLike(a, b);

SELECT NOT a LIKE b;

SELECT ilike(a, b);

SELECT a ILIKE b;

SELECT quantilesExactExclusive(0.25, 0.5, 0.75)(x) AS y FROM (SELECT number AS x FROM num);

SELECT or(0, 1, -2);

SELECT (0 OR 1 OR -2);

SELECT and(1, 2, 3);

SELECT (1 AND 2 AND 3);

SELECT or(and(3, 0), 5);

SELECT ((3 AND 0) OR 5);

SELECT UTCTimestamp();

SELECT CURRENT_TIMESTAMP('UTC');

SELECT [];

SELECT formatDateTime(x, '%%M %%B %%A %%i %%W %H:%i %M %W');

SELECT parseDateTime('2024-03-04 %M %B %A', '%Y-%m-%d %%M %%B %%A');

SELECT CAST(JSONExtractRaw(v, 'a') AS Nullable(String)) FROM data;

SELECT JSONExtractRaw(v, 'a') FROM data;

SELECT * FROM t AS a JOIN s AS b ON a.id = b.id GLOBAL ANY LEFT JOIN u AS c ON a.id = c.id;

SELECT * FROM t AS a JOIN s AS b ON a.id = b.id GLOBAL LEFT ANY JOIN u AS c ON a.id = c.id;

SELECT * FROM VALUES ((1, 1), (2, 1), (3, 1), (4, 1));

SELECT type, id FROM VALUES ('id Int, type Int', (1, 1), (2, 1), (3, 1), (4, 1));

INSERT INTO t (col1, col2) FORMAT Values('abcd', 1234);

SELECT * FROM VALUES ((1), (2), (3));

SELECT * FROM (VALUES (1, 'x'), (2, 'y')) AS t(a, b);

SELECT * FROM (VALUES ((1), ('x')), ((2), ('y'))) AS t(a, b);

SELECT * FROM numbers(1) AS n CROSS JOIN (VALUES (1), (2)) SETTINGS joined_subquery_requires_alias = 0;

SELECT * FROM numbers(1) AS n CROSS JOIN (VALUES ((1)), ((2))) SETTINGS joined_subquery_requires_alias = 0;

WITH t(a, b) AS (VALUES (1, 'x'), (2, 'y')) SELECT * FROM t;

WITH t(a, b) AS (SELECT * FROM (VALUES ((1), ('x')), ((2), ('y'))) AS _values) SELECT * FROM t;

WITH t(a, b) AS (SELECT * FROM (VALUES (1, 'x'), (2, 'y')) AS _values) SELECT * FROM t;

SELECT col FROM (SELECT 1 AS col) AS _t;

SELECT col1, col2 FROM (SELECT 1 AS col1, 2 AS col2 UNION ALL SELECT 3, 4) AS _t;

WITH 'x' AS foo SELECT foo;

WITH ['c'] AS field_names SELECT field_names;

WITH SUM(bytes) AS foo SELECT foo FROM system.parts;

WITH (SELECT foo) AS bar SELECT bar + 5;

WITH test1 AS (SELECT i + 1, j + 1 FROM test1) SELECT * FROM test1;

SELECT {abc: UInt32}, {b: String}, {c: DateTime},{d: Map(String, Array(UInt8))}, {e: Tuple(UInt8, String)};

SELECT {abc: UInt32}, {b: String}, {c: DateTime}, {d: Map(String, Array(UInt8))}, {e: Tuple(UInt8, String)};

SELECT * FROM {table: Identifier};

SELECT CAST(val AS JSON(
                col1 String,
                skip col2,
                max_dynamic_paths=2
            ));

SELECT CAST(val AS JSON(col1 String, SKIP col2, max_dynamic_paths = 2));

SELECT CAST(val AS JSON(col1 String, col2 JSON(colA String, SKIP colB)));

CREATE TABLE my_db.my_table
            (
                someId UUID,
                aggregatedColumn AggregateFunction(any, String),
                aggregatedColumnWithParams AggregateFunction(any(somecolumn), String),
            )
            ENGINE = AggregatingMergeTree()
            ORDER BY (someId);

CREATE TABLE my_db.my_table (
  someId UUID,
  aggregatedColumn AggregateFunction(any, String),
  aggregatedColumnWithParams AggregateFunction(any(somecolumn), String)
)
ENGINE=AggregatingMergeTree()
ORDER BY (
  someId
);

CREATE TABLE t (`projection` Int8);

CREATE TABLE t ("projection" Int8);

CREATE FUNCTION linear_equation AS (x, k, b) -> k * x + b;

CREATE MATERIALIZED VIEW a.b TO a.c (c Int32) AS SELECT * FROM a.d;

CREATE TABLE ip_data (ip4 IPv4, ip6 IPv6) ENGINE=TinyLog();

CREATE TABLE dates (dt1 Date32) ENGINE=TinyLog();

CREATE TABLE named_tuples (a Tuple(select String, i Int64));

CREATE TABLE t (a String) EMPTY AS SELECT * FROM dummy;

CREATE TABLE t1 (a String EPHEMERAL, b String EPHEMERAL func(), c String MATERIALIZED func(), d String ALIAS func()) ENGINE=TinyLog();

CREATE TABLE t (a String, b String, c UInt64, PROJECTION p1 (SELECT a, sum(c) GROUP BY a, b), PROJECTION p2 (SELECT b, sum(c) GROUP BY b)) ENGINE=MergeTree();

CREATE TABLE xyz (ts DateTime, data String) ENGINE=MergeTree() ORDER BY ts SETTINGS index_granularity = 8192 COMMENT '{"key": "value"}';

INSERT INTO FUNCTION s3('a', 'b', 'c', 'd', 'e') PARTITION BY CONCAT(s1, s2, s3, s4) SETTINGS set1 = 1, set2 = '2' SELECT * FROM some_table SETTINGS foo = 3;

CREATE TABLE data5 ("x" UInt32, "y" UInt32) ENGINE=MergeTree ORDER BY (round(y / 1000000000), cityHash64(x)) SAMPLE BY cityHash64(x);

CREATE TABLE foo (x UInt32) TTL time_column + INTERVAL '1' MONTH DELETE WHERE column = 'value';

CREATE FUNCTION parity_str AS (n) -> IF(n % 2, 'odd', 'even');

CREATE FUNCTION parity_str AS n -> CASE WHEN n % 2 THEN 'odd' ELSE 'even' END;

CREATE TABLE a ENGINE=Memory AS SELECT 1 AS c COMMENT 'foo';

CREATE TABLE a ENGINE=Memory AS (SELECT 1 AS c) COMMENT 'foo';

CREATE TABLE t1 ("x" UInt32, "y" Dynamic, "z" Dynamic(max_types = 10)) ENGINE=MergeTree ORDER BY x;

CREATE TABLE test_table (id Int32, name String) ENGINE=MergeTree PRIMARY KEY id;

CREATE TABLE test_table (id Int32, name String) ENGINE=MergeTree PRIMARY KEY (id);

CREATE TABLE test_table (id Int32, name String) ENGINE=MergeTree PRIMARY KEY tuple();

CREATE TABLE test_table (id Int32, name String) ENGINE=MergeTree PRIMARY KEY (tuple());

CREATE TABLE t (a UInt32, CONSTRAINT a_constraint CHECK (a < 10)) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (a UInt32, CONSTRAINT c1 ASSUME (a > 5)) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (a UInt32, CONSTRAINT a_constraint CHECK a < 10) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (a UInt32, CONSTRAINT c1 ASSUME a > 5) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (a UInt32, CONSTRAINT t CHECK (SELECT 1)) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (a UInt32, CONSTRAINT t ASSUME (SELECT 1)) ENGINE=MergeTree ORDER BY a;

CREATE TABLE t (check UInt32);

CREATE TABLE t (assume UInt32);

CREATE DATABASE x;

DROP DATABASE x;

CREATE TABLE example1 (
               timestamp DateTime,
               x UInt32 TTL now() + INTERVAL 1 MONTH,
               y String TTL timestamp + INTERVAL 1 DAY,
               z String
            )
            ENGINE = MergeTree
            ORDER BY tuple();

CREATE TABLE example1 (
  timestamp DateTime,
  x UInt32 TTL now() + INTERVAL '1' MONTH,
  y String TTL timestamp + INTERVAL '1' DAY,
  z String
)
ENGINE=MergeTree
ORDER BY tuple();

CREATE TABLE test (id UInt64, timestamp DateTime64, data String, max_hits UInt64, sum_hits UInt64) ENGINE = MergeTree
            PRIMARY KEY (id, toStartOfDay(timestamp), timestamp)
            TTL timestamp + INTERVAL 1 DAY
            GROUP BY id, toStartOfDay(timestamp)
            SET
               max_hits = max(max_hits),
               sum_hits = sum(sum_hits);

CREATE TABLE test (
  id UInt64,
  timestamp DateTime64,
  data String,
  max_hits UInt64,
  sum_hits UInt64
)
ENGINE=MergeTree
PRIMARY KEY (id, dateTrunc('DAY', timestamp), timestamp)
TTL
  timestamp + INTERVAL '1' DAY
GROUP BY
  id,
  dateTrunc('DAY', timestamp)
SET
  max_hits = max(max_hits),
  sum_hits = sum(sum_hits);

CREATE TABLE test (id String, data String) ENGINE = AggregatingMergeTree()
                ORDER BY tuple()
            SETTINGS
                max_suspicious_broken_parts=500,
                parts_to_throw_insert=100;

CREATE TABLE test (
  id String,
  data String
)
ENGINE=AggregatingMergeTree()
ORDER BY tuple()
SETTINGS
  max_suspicious_broken_parts = 500,
  parts_to_throw_insert = 100;

CREATE TABLE example_table
            (
                d DateTime,
                a Int
            )
            ENGINE = MergeTree
            PARTITION BY toYYYYMM(d)
            ORDER BY d
            TTL d + INTERVAL 1 MONTH DELETE,
                d + INTERVAL 1 WEEK TO VOLUME 'aaa',
                d + INTERVAL 2 WEEK TO DISK 'bbb';

CREATE TABLE example_table (
  d DateTime,
  a Int32
)
ENGINE=MergeTree
PARTITION BY toYYYYMM(d)
ORDER BY d
TTL
  d + INTERVAL '1' MONTH DELETE,
  d + INTERVAL '1' WEEK TO VOLUME 'aaa',
  d + INTERVAL '2' WEEK TO DISK 'bbb';

CREATE TABLE table_with_where
            (
                d DateTime,
                a Int
            )
            ENGINE = MergeTree
            PARTITION BY toYYYYMM(d)
            ORDER BY d
            TTL d + INTERVAL 1 MONTH DELETE WHERE toDayOfWeek(d) = 1;

CREATE TABLE table_with_where (
  d DateTime,
  a Int32
)
ENGINE=MergeTree
PARTITION BY toYYYYMM(d)
ORDER BY d
TTL
  d + INTERVAL '1' MONTH DELETE
WHERE
  toDayOfWeek(d) = 1;

CREATE TABLE table_for_recompression
            (
                d DateTime,
                key UInt64,
                value String
            ) ENGINE MergeTree()
            ORDER BY tuple()
            PARTITION BY key
            TTL d + INTERVAL 1 MONTH RECOMPRESS CODEC(ZSTD(17)), d + INTERVAL 1 YEAR RECOMPRESS CODEC(LZ4HC(10))
            SETTINGS min_rows_for_wide_part = 0, min_bytes_for_wide_part = 0;

CREATE TABLE table_for_recompression (
  d DateTime,
  key UInt64,
  value String
)
ENGINE=MergeTree()
ORDER BY tuple()
PARTITION BY key
TTL
  d + INTERVAL '1' MONTH RECOMPRESS CODEC(ZSTD(17)),
  d + INTERVAL '1' YEAR RECOMPRESS CODEC(LZ4HC(10))
SETTINGS
  min_rows_for_wide_part = 0,
  min_bytes_for_wide_part = 0;

CREATE TABLE table_for_aggregation
            (
                d DateTime,
                k1 Int,
                k2 Int,
                x Int,
                y Int
            )
            ENGINE = MergeTree
            ORDER BY (k1, k2)
            TTL d + INTERVAL 1 MONTH GROUP BY k1, k2 SET x = max(x), y = min(y);

CREATE TABLE table_for_aggregation (
  d DateTime,
  k1 Int32,
  k2 Int32,
  x Int32,
  y Int32
)
ENGINE=MergeTree
ORDER BY (k1, k2)
TTL
  d + INTERVAL '1' MONTH
GROUP BY
  k1,
  k2
SET
  x = max(x),
  y = min(y);

CREATE DICTIONARY discounts_dict (
                advertiser_id UInt64,
                discount_start_date Date,
                discount_end_date Date,
                amount Float64
            )
            PRIMARY KEY id
            SOURCE(CLICKHOUSE(TABLE 'discounts'))
            LIFETIME(MIN 1 MAX 1000)
            LAYOUT(RANGE_HASHED(range_lookup_strategy 'max'))
            RANGE(MIN discount_start_date MAX discount_end_date);

CREATE DICTIONARY discounts_dict (
  advertiser_id UInt64,
  discount_start_date DATE,
  discount_end_date DATE,
  amount Float64
)
PRIMARY KEY (id)
SOURCE(CLICKHOUSE(
  TABLE 'discounts'
))
LIFETIME(MIN 1 MAX 1000)
LAYOUT(RANGE_HASHED(
  range_lookup_strategy 'max'
))
RANGE(MIN discount_start_date MAX discount_end_date);

CREATE DICTIONARY my_ip_trie_dictionary (
                prefix String,
                asn UInt32,
                cca2 String DEFAULT '??'
            )
            PRIMARY KEY prefix
            SOURCE(CLICKHOUSE(TABLE 'my_ip_addresses'))
            LAYOUT(IP_TRIE)
            LIFETIME(3600);

CREATE DICTIONARY my_ip_trie_dictionary (
  prefix String,
  asn UInt32,
  cca2 String DEFAULT '??'
)
PRIMARY KEY (prefix)
SOURCE(CLICKHOUSE(
  TABLE 'my_ip_addresses'
))
LAYOUT(IP_TRIE())
LIFETIME(MIN 0 MAX 3600);

CREATE DICTIONARY polygons_test_dictionary
            (
                key Array(Array(Array(Tuple(Float64, Float64)))),
                name String
            )
            PRIMARY KEY key
            SOURCE(CLICKHOUSE(TABLE 'polygons_test_table'))
            LAYOUT(POLYGON(STORE_POLYGON_KEY_COLUMN 1))
            LIFETIME(0);

CREATE DICTIONARY polygons_test_dictionary (
  key Array(Array(Array(Tuple(Float64, Float64)))),
  name String
)
PRIMARY KEY (key)
SOURCE(CLICKHOUSE(
  TABLE 'polygons_test_table'
))
LAYOUT(POLYGON(
  STORE_POLYGON_KEY_COLUMN 1
))
LIFETIME(MIN 0 MAX 0);

CREATE DICTIONARY dict1 (key UInt64) PRIMARY KEY (key) SOURCE(CLICKHOUSE(HOST 'localhost' PORT tcpPort() USER 'default' DB CURRENT_DATABASE())) LIFETIME(MIN 1 MAX 10) LAYOUT(FLAT());

CREATE DICTIONARY dict1 (key UInt64) PRIMARY KEY (key) SOURCE(FILE(PATH '/tmp/test.csv' FORMAT CSVWithNames)) LIFETIME(MIN 0 MAX 1) LAYOUT(FLAT());

CREATE DICTIONARY dict1 (key UInt64) PRIMARY KEY (key) SOURCE(NULL()) LAYOUT(CACHE(SIZE_IN_CELLS 1000)) LIFETIME(MIN 0 MAX 1);

CREATE DICTIONARY dict1 (key UInt64) PRIMARY KEY (key) SOURCE(EXECUTABLE(COMMAND 'echo "1"' FORMAT TabSeparated)) LIFETIME(MIN 0 MAX 1) LAYOUT(FLAT());

CREATE TABLE t (
                a AggregateFunction(quantiles(0.5, 0.9), UInt64),
                b AggregateFunction(quantiles, UInt64),
                c SimpleAggregateFunction(sum, Float64),
                d AggregateFunction(count)
            );

CREATE TABLE session_log
            (
                UserID UInt64,
                SessionID UUID
            )
            ENGINE = MergeTree
            PARTITION BY sipHash64(UserID) % 16
            ORDER BY tuple();

CREATE TABLE visits
            (
                VisitDate Date,
                Hour UInt8,
                ClientID UUID
            )
            ENGINE = MergeTree()
            PARTITION BY (toYYYYMM(VisitDate), Hour)
            ORDER BY Hour;

DROP TABLE t SYNC;

DROP DATABASE IF EXISTS d SYNC;

GRANT SELECT(x, y) ON db.table TO john WITH GRANT OPTION;

GRANT INSERT(x, y) ON db.table TO john;

REVOKE SELECT(x, y) ON db.table FROM john;

REVOKE INSERT(x, y) ON db.table FROM john;

SELECT * FROM arrays_test ARRAY JOIN arr1, arrays_test.arr2 AS foo, ['a', 'b', 'c'] AS elem;

SELECT s, arr FROM arrays_test ARRAY JOIN arr;

SELECT s, arr, a FROM arrays_test LEFT ARRAY JOIN arr AS a;

SELECT s, arr_external FROM arrays_test ARRAY JOIN [1, 2, 3] AS arr_external;

SELECT * FROM arrays_test ARRAY JOIN [1, 2, 3] AS arr_external1, ['a', 'b', 'c'] AS arr_external2, splitByString(',', 'asd,qwerty,zxc') AS arr_external3;

SELECT row_number(column1) OVER (PARTITION BY column2 ORDER BY column3) FROM table;

SELECT row_number() OVER (PARTITION BY column2 ORDER BY column3) FROM table;

SELECT groupConcat(', ')(part_name) FROM system.parts;

SELECT groupConcat(part_name) FROM t;

SELECT groupConcat(', ', 2)(part_name) FROM t;

SELECT groupConcat(', ')(part_name) FROM t;

SELECT TRANSFORM(foo, [1, 2], ['first', 'second']) FROM table;

SELECT TRANSFORM(foo, [1, 2], ['first', 'second'], 'default') FROM table;

SELECT arraySort(y -> -y, x), arrayReverseSort(y -> -y, x);

SELECT minOrNull(x <> 0), maxOrNull(x <> 0) FROM t;

CREATE VIEW myschema.myview (c1 String NOT NULL) AS SELECT c1 FROM file('base/dir/*.parquet', Parquet);

SELECT * FROM file('path', Parquet) WHERE x > 1;

SELECT * FROM file('path', Parquet);

SELECT x FROM view(SELECT 1 AS x);

SELECT country, sum(installs) AS installs FROM cluster('default', view(SELECT 'US' AS country, count() AS installs FROM numbers(1) GROUP BY country)) GROUP BY country;

SELECT 1e_5foo FROM (SELECT 7 AS `1e_5foo`);

SELECT 1e_5foo FROM (SELECT 7 AS "1e_5foo");

SELECT 1__2, 1_, 1e_5 FROM (SELECT 7 AS `1__2`, 8 AS `1_`, 9 AS `1e_5`);

SELECT 1__2, 1_, 1e_5 FROM (SELECT 7 AS "1__2", 8 AS "1_", 9 AS "1e_5");

SELECT 1_000;

SELECT 1000;

SELECT col[1];

ALTER TABLE t MODIFY COLUMN c Int64;

ALTER TABLE t ALTER COLUMN c TYPE Int64;

SELECT JSONExtract(JSONExtractRaw(v, 'a'), 'Nullable(String)') FROM data;

CREATE MATERIALIZED VIEW v TO db.t AS SELECT 1;

CREATE MATERIALIZED VIEW v REFRESH AS SELECT 1;

CREATE TABLE t1 (a String MATERIALIZED func());

SELECT col.^nested, t.col2.^nested, t.col3.^nested.twice FROM t;

SELECT groupBitAndIf(x, y) FROM t;

SELECT approx_top_sum(column, weight) FROM t;

SELECT approx_top_sum(N)(column, weight) FROM t;

SELECT approx_top_sum(N, reserved)(column, weight) FROM t;

SELECT uniqExactIf(x, y) FROM t;

SELECT countIfMerge(state) FROM t;

SELECT uniqExactIfMerge(state) FROM t;

SELECT avgArgMinIfState(x, y) FROM t;

SELECT quantileIfState(0.5)(col, cond) FROM t;

SELECT sumMap(k, v) FROM t;

SELECT minMap(k, v) FROM t;

SELECT maxMap(k, v) FROM t;

SELECT sumMapIf(k, v, cond) FROM t;

SELECT minMapIf(k, v, cond) FROM t;

SELECT maxMapIf(k, v, cond) FROM t;

SELECT sumMapState(k, v) FROM t;

SELECT sumMapIfState(k, v, cond) FROM t;

SELECT sumMergeIfMerge(s) FROM (SELECT sumMergeIfState(agg, 1 = 1) AS s FROM (SELECT sumState(toFloat64(number)) AS agg FROM numbers(10)));

SELECT groupConcatIf(x, cond) FROM t;

SELECT groupConcatIf(', ')(x, cond) FROM t;

SELECT quantileExactInclusive(0.25)(number) AS x FROM numbers(5);

SELECT arrayMap((a, b) -> a * b, [1, 2, 3], [10, 20, 30]) AS products;

SELECT toTypeName(1);

SELECT arrayDistinct(x);

CREATE TABLE a AS b;

SELECT CASE WHEN NOT (a IS NULL) THEN b ELSE c END;

SELECT CASE WHEN NOT (a IS NULL) THEN b END;

SELECT * FROM (SELECT * FROM a UNION DISTINCT SELECT * FROM b) AS _l_0 OFFSET 1;

SELECT * FROM (SELECT * FROM a UNION DISTINCT SELECT * FROM b) AS _l_0 ORDER BY x NULLS FIRST LIMIT 1 OFFSET 1;

SELECT * FROM (SELECT a FROM x UNION DISTINCT SELECT a FROM y) AS _l_0 LIMIT 2;

SELECT * FROM (SELECT * FROM a UNION DISTINCT SELECT * FROM b) AS _l_0 ORDER BY x NULLS FIRST LIMIT 1;

SELECT * FROM a UNION DISTINCT SELECT * FROM b;

SELECT * FROM a UNION ALL SELECT * FROM b;

SELECT * FROM a INTERSECT DISTINCT SELECT * FROM b;

SELECT * FROM a EXCEPT DISTINCT SELECT * FROM b;

SELECT * FROM a INTERSECT SELECT * FROM b;

SELECT * FROM a EXCEPT ALL SELECT * FROM b;

SELECT 1 #! arbitrary content,,, until end-of-line;

SELECT # comment1
  x, # comment2
  y # comment3;

SELECT * FROM t QUALIFY COUNT(*) OVER () > 1;

SELECT "user id", some_id, 1 AS other_id, 2 AS "2 nd id" FROM t QUALIFY COUNT(*) OVER () > 1;

SELECT * FROM (WITH t AS (SELECT 1 AS c) SELECT c FROM t) AS subq;

SELECT 1 EXCEPT SELECT 1;

SELECT 1 AS `x\``;

SELECT 1 AS "x`";

SELECT x BETWEEN 2 AND 10;

SELECT (x BETWEEN 10 AND 2 OR x BETWEEN 2 AND 10);

SELECT x BETWEEN 10 AND 2;

SELECT 1 AS "x""";

SELECT argMax(a, b), argMin(c, d);

SELECT arraySum(x -> x*x, [2, 3]);

SELECT arraySum(x -> x * x, [2, 3]);

SELECT CAST('foo' AS Nullable(DateTime));

CREATE TABLE t (foo Nullable(String));

SELECT TRIM(BOTH '|' FROM '||Hello ||| world||');

SELECT CASE COUNT(x) WHEN 0 THEN NULL WHEN 1 THEN 0 ELSE varSamp(x) END FROM (SELECT 1 AS x) AS t WHERE 1 = 0;

SELECT JSONExtractString(x, k1, k2, k3) FROM t;

SELECT argMax(a.id, a.timestamp) FROM a;

SELECT argMin(a.id, a.timestamp) FROM a;

CREATE TABLE testTypes (a DATE32);

CREATE TABLE testTypes (a DATETIME64);

CREATE TABLE testTypes (a DECIMAL32(3));

CREATE TABLE testTypes (a DECIMAL64(3));

CREATE TABLE testTypes (a DECIMAL128(3));

CREATE TABLE testTypes (a DECIMAL256(3));

CREATE TABLE testTypes (a ENUM8('a'));

CREATE TABLE testTypes (a ENUM16('a'));

CREATE TABLE testTypes (a FIXEDSTRING(2));

CREATE TABLE testTypes (a POINT);

CREATE TABLE testTypes (a RING);

CREATE TABLE testTypes (a LINESTRING);

CREATE TABLE testTypes (a POLYGON);

CREATE TABLE testTypes (a MULTIPOLYGON);

SELECT VERSION();

WITH tbl AS (SELECT 1 AS id, 'eggy' AS name UNION ALL SELECT NULL AS id, 'jake' AS name) SELECT COUNT(DISTINCT id, name) AS cnt FROM tbl;

SELECT fname, lname, age FROM person ORDER BY age DESC NULLS FIRST, fname ASC, lname NULLS FIRST;

SELECT CHAR(72, 105, x);

SELECT argMax(a, b), argMin(a, b) FROM t;

CREATE TABLE a;

SELECT * FROM (SELECT a FROM x UNION DISTINCT SELECT a FROM y) AS _l_0 ORDER BY a NULLS FIRST OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY;

SELECT * FROM (SELECT a FROM x UNION ALL SELECT a FROM y LIMIT 1) AS _l_0 ORDER BY a NULLS FIRST OFFSET 1;

SELECT a FROM x LIMIT 1 UNION ALL SELECT a FROM y LIMIT 1;

SELECT 1 AS x UNION ALL SELECT 2 AS x ORDER BY x NULLS FIRST;

SELECT DATE_DIFF(DAY, CAST(CAST(a AS Nullable(DateTime)) AS DateTime64(6)), CAST(CAST(b AS Nullable(DateTime)) AS DateTime64(6))) AS x FROM foo;
