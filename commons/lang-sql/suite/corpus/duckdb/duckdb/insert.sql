CREATE TABLE integers(i INTEGER, j INTEGER);

INSERT INTO integers BY NAME SELECT 42 AS j;

INSERT INTO integers BY NAME SELECT 84 AS i;

INSERT INTO integers BY NAME SELECT 99 AS j, 9 AS i;

INSERT INTO integers BY POSITION SELECT 1 AS j, 10 AS i;

FROM integers;

CREATE TABLE "My Table"("My Column 1" INT, "My Column 2" INT);

INSERT INTO "My Table" BY NAME SELECT 1 AS "My Column 2";

FROM "My Table";

CREATE TABLE tbl (
	price INTEGER,
	total_price AS ((price)::DATE)
);

INSERT INTO integers BY POSITION VALUES (42, 84);

CREATE TABLE tbl2 (a INTEGER, b INTEGER PRIMARY KEY);

INSERT INTO tbl2 BY NAME (SELECT 22 AS b);

FROM tbl2;

INSERT OR REPLACE INTO tbl2 BY NAME (SELECT 22 AS b);

INSERT OR REPLACE INTO tbl2 BY NAME (SELECT 22 AS b, 1 as a);

CREATE TABLE struct_defaults_by_name(
	i ROW(
		a INT,
		b INT,
		c INT
	) DEFAULT (
		{
			'a': 7
		}
	),
	j INT DEFAULT 42,
	k INT DEFAULT 99
);

INSERT INTO struct_defaults_by_name BY NAME SELECT {'b': 12} AS i, 10 AS k;

INSERT INTO struct_defaults_by_name BY NAME SELECT {'a': 11} AS i;

SELECT * FROM struct_defaults_by_name ORDER BY k, i.a NULLS LAST;

CREATE TABLE nested_struct_defaults_by_name(
	i ROW(
		a INT,
		n ROW(
			x INT,
			y INT,
			z INT
		),
		b INT
	) DEFAULT (
		{
			'n': {
				'y': 3
			}
		}
	),
	j INT DEFAULT 42
);

INSERT INTO nested_struct_defaults_by_name BY NAME SELECT {'n': {'x': 10}} AS i;

SELECT * FROM nested_struct_defaults_by_name;

CREATE TABLE tbl3 (id INTEGER PRIMARY KEY);

INSERT INTO tbl3 SELECT * FROM range(1000000) t(id);

INSERT OR REPLACE INTO tbl3 BY NAME SELECT * FROM range(1000000) t(id);

SELECT COUNT(*) FROM tbl3;

CREATE TABLE integers AS SELECT i, i%2 as j FROM generate_series(0,999999,1) tbl(i);

CREATE TABLE integers2 AS SELECT * FROM integers GROUP BY GROUPING SETS ((), (i), (i, j), (j));

SELECT SUM(i), SUM(j), COUNT(*), COUNT(i), COUNT(j) FROM integers;

SELECT SUM(i), SUM(j), COUNT(*), COUNT(i), COUNT(j) FROM integers2;

DROP TABLE integers;

DROP TABLE integers2;

CREATE TABLE integers AS SELECT case when i%2=0 then null else i end AS i, i%2 as j  FROM generate_series(0,999999,1) tbl(i);

CREATE TABLE t(a INT, b TEXT, c DOUBLE);

INSERT INTO t VALUES (1, 'hello', 1.5), (2, 'world', 2.5);

SELECT * FROM t ORDER BY a;

INSERT INTO t (a, b, c) VALUES (3, 'foo', 3.5);

SELECT * FROM t WHERE a = 3;

INSERT INTO t VALUES (4, 'bar', 4.5) RETURNING a, b, c;

WITH vals AS (SELECT 5 AS a, 'cte' AS b, 5.5 AS c)
INSERT INTO t SELECT * FROM vals RETURNING a;

SELECT * FROM t WHERE a = 5;

CREATE TABLE t2(x INT DEFAULT 42, y TEXT DEFAULT 'default');

INSERT INTO t2 DEFAULT VALUES;

SELECT * FROM t2;

CREATE TABLE t3(a INT, b TEXT, c DOUBLE);

INSERT INTO t3 SELECT * FROM t WHERE a <= 2;

SELECT * FROM t3 ORDER BY a;

CREATE SCHEMA myschema;

CREATE TABLE myschema.t4(x INT);

INSERT INTO myschema.t4 VALUES (1), (2), (3);

SELECT * FROM myschema.t4;

CREATE TABLE t5(id INT PRIMARY KEY, val TEXT);

INSERT INTO t5 VALUES (1, 'original');

INSERT OR REPLACE INTO t5 VALUES (1, 'replaced');

SELECT * FROM t5;

CREATE TABLE t6(a INT, b TEXT, c DOUBLE);

INSERT INTO t6 BY NAME SELECT 3.14 AS c, 'hello' AS b, 42 AS a;

SELECT * FROM t6;

CREATE TABLE t7(id INT PRIMARY KEY, val TEXT);

INSERT INTO t7 VALUES (1, 'first');

INSERT INTO t7 VALUES (1, 'duplicate') ON CONFLICT DO NOTHING;

SELECT * FROM t7;

INSERT INTO t7 VALUES (1, 'updated') ON CONFLICT (id) DO UPDATE SET val = excluded.val;

CREATE TABLE integers(i INTEGER);

BEGIN TRANSACTION;

INSERT INTO integers VALUES (0), (1), (2);

SELECT COUNT(*) FROM integers;

ROLLBACK;

INSERT INTO integers SELECT i FROM range(100) tbl(i);

INSERT INTO integers SELECT NULL FROM range(100) tbl(i);

SELECT COUNT(i), SUM(i), MIN(i), MAX(i), COUNT(*) FROM integers;

COMMIT;

SELECT SUM(CASE WHEN i IS NULL THEN 1 ELSE 0 END) FROM integers;

INSERT INTO integers VALUES (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (0), (1), (2), (3), (4), (5), (6), (7), (8), (9);

INSERT INTO integers SELECT * FROM integers;

INSERT INTO integers VALUES (3, 4), (4, 3);

INSERT INTO integers VALUES (DEFAULT, 4);

INSERT INTO integers (i) SELECT j FROM integers;

SELECT * FROM integers;

INSERT INTO integers VALUES (1), (2), (3), (4), (5);

CREATE TABLE i2 AS SELECT 1 AS i FROM integers WHERE i % 2 <> 0;

SELECT * FROM i2 ORDER BY 1;

UPDATE i2 SET i=NULL;

CREATE TABLE IF NOT EXISTS presentations(presentation_date Date NOT NULL UNIQUE, author VARCHAR NOT NULL, title VARCHAR NOT NULL, bio VARCHAR, abstract VARCHAR, zoom_link VARCHAR);

insert into presentations values ('2020-05-29', 'Eduardo Pena', 'Analytical Query Processing Based on Continuous Compression of Intermediates', NULL, 'Modern in-memory column-stores are widely accepted as the adequate database architecture for the efficient processing of complex analytical queries over large relational data volumes. These systems keep their entire data in main memory and typically employ lightweight compression to address the bottleneck between main memory and CPU. Numerous lightweight compression algorithms have been proposed in the past years, but none of them is suitable in all cases. While lightweight compression is already well established for base data, the efficient representation of intermediate results generated during query processing has attracted insufficient attention so far, although in in-memory systems, accessing intermeFdiates is as expensive as accessing base data. Thus, our vision is a continuous use of lightweight compression for all intermediates in a query execution plan, whereby a suitable compression algorithm should be selected for each intermediate. In this talk, I will provide an overview of our research in the context of this vision, including an experimental survey of lightweight compression algorithms, our compression-enabled processing model, and our compression-aware query optimization strategies.', 'https://zoom.us/j/7845983526');

CREATE TABLE strings(i STRING);

INSERT INTO strings OVERRIDING SYSTEM VALUE VALUES (1);

select * from strings;

INSERT INTO strings OVERRIDING USER VALUE SELECT 2;

INSERT INTO strings (i) OVERRIDING SYSTEM VALUE SELECT 'three';

INSERT INTO strings VALUES ('�(');

SELECT * FROM strings WHERE i = '�(';

CREATE TABLE a(i integer, j integer);

INSERT INTO a VALUES (1, 2);

INSERT INTO integers SELECT 42;

INSERT INTO integers SELECT CAST(NULL AS VARCHAR);

SET default_null_order='nulls_first';

CREATE TABLE strings(a VARCHAR);

INSERT INTO integers VALUES (3), (4), (NULL);

INSERT INTO strings SELECT * FROM integers;

UPDATE strings SET a=13 WHERE a='3';

SELECT * FROM strings ORDER BY cast(a AS INTEGER);

SET immediate_transaction_mode=true;
