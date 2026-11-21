explain PRAGMA enable_checkpoint_on_shutdown;

explain CREATE TABLE integers(i INTEGER);

CREATE TABLE integers(i INTEGER);

explain SELECT * FROM integers;

explain INSERT INTO integers VALUES (1);

INSERT INTO integers VALUES (1);

explain DELETE FROM integers WHERE i=1;

explain UPDATE integers SET i=i+1;

explain CREATE INDEX i_index ON integers(i);

explain ALTER TABLE integers RENAME TO integers2;

explain ALTER TABLE integers ADD COLUMN j INTEGER;

explain ALTER TABLE integers RENAME i TO k;

SELECT * FROM integers;

explain PREPARE v1 AS SELECT * FROM integers WHERE i=?;

PREPARE v1 AS SELECT * FROM integers WHERE i=?;

explain EXECUTE v1(1);

explain DEALLOCATE v1;

EXECUTE v1(1);

explain VACUUM;

explain CREATE SEQUENCE seq;

explain CREATE VIEW v1 AS SELECT * FROM integers;

explain DROP TABLE integers;

explain CHECKPOINT;

explain TRUNCATE integers;

explain INSTALL json;

explain FORCE INSTALL json;

explain UPDATE EXTENSIONS;

explain UPDATE EXTENSIONS (json);

explain BEGIN TRANSACTION;

explain SET memory_limit='1GB';

explain CREATE MACRO f(x) AS x+1;

CREATE MACRO f(x) AS x+1;

SELECT f(1);

CREATE TABLE integers(i INTEGER, j INTEGER);

INSERT INTO integers VALUES (1, 1), (2, 2), (3, 3), (NULL, NULL);

PREPARE query AS SELECT * FROM integers;

EXPLAIN EXECUTE query;

CREATE TABLE renderer_t AS SELECT i AS i, i % 7 AS g, 'v' || (i % 3)::VARCHAR AS s FROM range(200) t(i);

CREATE VIEW renderer_plan AS
SELECT a.g, count(*) AS c, sum(sum(a.i)) OVER () AS w
FROM renderer_t a JOIN renderer_t b ON a.i = b.i
WHERE a.i > 2 AND b.s <> 'v9'
GROUP BY a.g
ORDER BY a.g
LIMIT 3;

EXPLAIN (FORMAT text) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT json) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT yaml) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT html) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT graphviz) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT mermaid) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT compact) SELECT * FROM renderer_plan;

EXPLAIN ANALYZE (FORMAT compact) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT default) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT query_tree) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT query_tree_optimizer) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT no_output) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT JSON) SELECT 42;

EXPLAIN (FORMAT 'graphviz') SELECT 42;

EXPLAIN ANALYZE (FORMAT json) SELECT * FROM renderer_plan;

EXPLAIN ANALYZE (FORMAT graphviz) SELECT * FROM renderer_plan;

EXPLAIN ANALYZE (FORMAT yaml) SELECT * FROM renderer_plan;

EXPLAIN ANALYZE (FORMAT mermaid) SELECT * FROM renderer_plan;

EXPLAIN ANALYZE (FORMAT html) SELECT * FROM renderer_plan;

EXPLAIN (FORMAT graphviz) SELECT 1;

EXPLAIN (FORMAT mermaid) SELECT 1;

CREATE TABLE renderer_escapes("we<i>rd ""col""" VARCHAR);

EXPLAIN (FORMAT html) SELECT "we<i>rd ""col""" FROM renderer_escapes;

EXPLAIN (FORMAT json) SELECT "we<i>rd ""col""" FROM renderer_escapes;

SET profiling_renderer_settings = MAP {'operator_casing': 'upper'};

CREATE TABLE date_table (d DATE);

INSERT INTO date_table (d)
SELECT
    DATE '2025-01-01' + CAST(RANDOM() * 364 AS INT)
FROM generate_series(1, 2500);

EXPLAIN SELECT * from date_table ORDER BY d;

EXPLAIN SELECT * from date_table ORDER BY d LIMIT 10;

EXPLAIN SELECT * from date_table dt ORDER BY d;

EXPLAIN SELECT * from date_table dt ORDER BY d LIMIT 10;

EXPLAIN SELECT * from date_table dt ORDER BY dt.d;

EXPLAIN SELECT * from date_table ORDER BY date_table.d;

EXPLAIN SELECT d dc from date_table dt ORDER BY dc;

EXPLAIN  SELECT dayofweek(d) dw from date_table ORDER BY dw;

EXPLAIN select sum(i), j, sum(i), j from integers group by j having j < 10;

SET explain_output='optimized_only';

EXPLAIN (FORMAT JSON) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (FORMAT HTML) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (FORMAT GRAPHVIZ) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (FORMAT YAML) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (FORMAT MERMAID) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (SELECT 42) INTERSECT (SELECT 42);

CREATE TABLE integers AS SELECT * FROM range(100) tbl(i);

EXPLAIN ANALYZE SELECT SUM(i) FROM integers;

EXPLAIN ANALYSE SELECT SUM(i) FROM integers;

EXPLAIN (ANALYZE) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (ANALYSE) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

PRAGMA enable_profiling;

EXPLAIN ANALYZE SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

PRAGMA disable_profiling;

EXPLAIN (ANALYZE, FORMAT JSON) SELECT SUM(i) FROM (SELECT * FROM integers i1, integers i2 UNION ALL SELECT * FROM integers i1, integers i2);

EXPLAIN (ANALYZE, FORMAT JSON) SELECT SUM(i) FROM integers;

SET enable_profiling='json';

SELECT 42;

EXPLAIN (ANALYZE, FORMAT graphviz) SELECT SUM(i) FROM integers;

EXPLAIN (ANALYZE, FORMAT html) SELECT SUM(i) FROM integers;

EXPLAIN (ANALYZE, FORMAT mermaid) SELECT SUM(i) FROM integers;

SET enable_profiling = 'no_output';

EXPLAIN ANALYZE SELECT 42;

EXPLAIN (FORMAT JSON) SELECT * FROM integers LIMIT 10;

EXPLAIN (FORMAT JSON) SELECT * FROM integers LIMIT 10 OFFSET 5;

EXPLAIN (FORMAT JSON) SELECT * FROM integers LIMIT 10%;

CREATE SCHEMA this_is_a_very_long_schema_name;

CREATE TABLE this_is_a_very_long_schema_name."renderer`""table" (
	abcdefghijklmnopqrstu BIGINT,
	vwxyzabcdefghijklmnop BIGINT,
	cccccccccccccccccccc VARCHAR
);

INSERT INTO this_is_a_very_long_schema_name."renderer`""table" VALUES (1, 2, 'duck');

CREATE TABLE renderer_columns (
	column_one_with_long_name BIGINT,
	column_two_with_long_name BIGINT,
	column_three_with_long_name BIGINT,
	column_four_with_long_name BIGINT,
	column_five_with_long_name BIGINT,
	column_six_with_long_name BIGINT,
	column_seven_with_long_name BIGINT,
	column_eight_with_long_name BIGINT,
	column_nine_with_long_name BIGINT,
	column_ten_with_long_name BIGINT
);

INSERT INTO renderer_columns VALUES (1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

SET profiling_renderer_settings = MAP {
	'maximum_render_width': '30',
	'max_extra_lines': '0',
	'thousand_separator': '',
	'decimal_separator': '.',
	'expand_all': 'false',
	'operator_casing': 'title',
	'ignored_by_text': 'yes'
};

EXPLAIN SELECT *
FROM this_is_a_very_long_schema_name."renderer`""table"
WHERE abcdefghijklmnopqrstu > 0;

EXPLAIN SELECT * FROM renderer_columns;

EXPLAIN (FORMAT yaml)
SELECT * FROM this_is_a_very_long_schema_name."renderer`""table";

EXPLAIN (FORMAT mermaid)
SELECT * FROM this_is_a_very_long_schema_name."renderer`""table";

EXPLAIN (FORMAT html) SELECT * FROM range(2);

EXPLAIN SELECT * FROM range(2);

SET profiling_renderer_settings = MAP {'operator_casing': 'title'};

SET profiling_renderer_settings = MAP {
	'maximum_render_width': '44',
	'thousand_separator': ',',
	'expand_all': 'false',
	'operator_casing': 'title'
};

EXPLAIN ANALYZE
SELECT count(*)
FROM (
	SELECT x, row_number() OVER (ORDER BY x) AS rn
	FROM (SELECT sleep_ms(10) AS x FROM range(1))
	QUALIFY rn <= 10
	ORDER BY x
	LIMIT 5
);

EXPLAIN ANALYZE
SELECT sum(x)
FROM (
	SELECT sleep_ms(10)::BIGINT AS x FROM range(1)
	UNION ALL SELECT i + 1 FROM range(1) t(i)
	UNION ALL SELECT i + 2 FROM range(1) t(i)
	UNION ALL SELECT i + 3 FROM range(1) t(i)
	UNION ALL SELECT i + 4 FROM range(1) t(i)
	UNION ALL SELECT i + 5 FROM range(1) t(i)
	UNION ALL SELECT i + 6 FROM range(1) t(i)
	UNION ALL SELECT i + 7 FROM range(1) t(i)
	UNION ALL SELECT i + 8 FROM range(1) t(i)
	UNION ALL SELECT i + 9 FROM range(1) t(i)
	UNION ALL SELECT i + 10 FROM range(1) t(i)
	UNION ALL SELECT i + 11 FROM range(1) t(i)
	UNION ALL SELECT i + 12 FROM range(1) t(i)
	UNION ALL SELECT i + 13 FROM range(1) t(i)
	UNION ALL SELECT i + 14 FROM range(1) t(i)
	UNION ALL SELECT i + 15 FROM range(1) t(i)
);

EXPLAIN ANALYZE
SELECT count(*)
FROM (
	SELECT * FROM range(2)
	UNION ALL SELECT * FROM range(1500)
	UNION ALL SELECT * FROM range(200)
	UNION ALL SELECT * FROM range(2000)
);

RESET profiling_renderer_settings;

SET enable_profiling = 'html';

SELECT 42 WHERE 'left<&' <> 'right>' /* renderer comment */;

RESET profiling_output;

SET enable_profiling = 'compact';

RESET enable_profiling;
