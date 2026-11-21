CREATE TABLE t(a INTEGER USING COMPRESSION rle, h AS (a + 1));

INSERT INTO t VALUES (1);

SELECT * FROM t;

CREATE TABLE unit (price INTEGER, amount_sold INTEGER);

INSERT INTO unit VALUES (5,4);

INSERT INTO unit VALUES (0,1);

SELECT * FROM unit;

CREATE TABLE unit (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold)
);

CREATE TABLE unit2 (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price / amount_sold),
	profit_total AS (price * amount_sold)
);

INSERT INTO unit2 VALUES (100, 4);

SELECT unit.total_profit FROM unit, unit2;

SELECT unit.total_profit FROM unit AS unit2, unit2 AS unit;

SELECT profit_total FROM unit2;

SELECT profit_total FROM unit2 as unit;

CREATE TABLE unit (
	price INTEGER,
	amount_sold INTEGER,
	total_profit as (price * amount_sold),
	profit_total AS (total_profit),
	dependent AS (profit_total),
	also_dependent AS (profit_total * dependent),
	dont_delete_me AS (amount_sold),
);

ALTER TABLE unit DROP COLUMN price CASCADE;

INSERT INTO unit VALUES (5);

ALTER TABLE unit DROP COLUMN dont_delete_me;

CREATE TABLE tbl (
	price INTEGER,
	total_price AS ((price)::DATE)
);

CREATE TABLE a (
	gen_x AS (x),
	gen_y AS (y),
	x TEXT,
	y INTEGER
);

INSERT INTO a VALUES ('hello', 42);

SELECT * FROM a;

CREATE TABLE unit (
	price INTEGER,
	amount_sold AS (price) CHECK (price > 5),
);

CREATE TABLE chk (
	g1 AS (x),
	g2 AS (x),
	x INTEGER,
	CHECK (x > 5)
);

INSERT INTO chk VALUES (6);

CREATE TABLE test_24378 (
	i INTEGER,
	j INTEGER CHECK (j > 0),
	k INTEGER GENERATED ALWAYS AS (j + 1)
);

ALTER TABLE test_24378 DROP COLUMN j CASCADE;

INSERT INTO test_24378 VALUES (1);

SELECT * FROM test_24378;

CREATE TABLE tbl (
	gcol1 AS (gcol2),
	gcol2 AS (gcol3),
	gcol3 AS (gcol4),
	gcol4 AS (gcol5),
	gcol5 AS (gcol6),
	gcol6 AS (gcol7),
	gcol7 AS (gcol8),
	gcol8 AS (gcol9),
	gcol9 AS (gcol10),
	gcol10 AS (x),
	x INTEGER,
);

CREATE TABLE coll (
	g1 AS (x),
	g2 AS (x),
	x VARCHAR COLLATE NOCASE
);

INSERT INTO coll VALUES ('string'), ('STRING');

SELECT * FROM coll;

CREATE TABLE tbl (
    total_profit BOOLEAN GENERATED ALWAYS AS(word) VIRTUAL,
    word VARCHAR,
    price INTEGER,
    amount_sold INTEGER,
);

SELECT * FROM tbl;

CREATE MACRO my_macro() AS (
    (select 42)
);

CREATE TABLE unit (
    total_profit INTEGER GENERATED ALWAYS AS(price * amount_sold) VIRTUAL,
    price INTEGER,
    amount_sold INTEGER,
);

ALTER TABLE unit DROP COLUMN total_profit;

INSERT INTO unit VALUES (4,5);

CREATE TABLE tbl (
	g1 AS (x),
	g2 AS (x),
	x INTEGER DEFAULT (5),
);

INSERT INTO tbl VALUES (DEFAULT);

ALTER TABLE unit DROP COLUMN price;

CREATE TABLE tbl (
	price INTEGER,
	total_profit AS (price)
);

CREATE TABLE tbl1 (
	a INTEGER UNIQUE,
);

CREATE TABLE tbl2 (
	price INTEGER,
	also_price AS (price)
);

CREATE TABLE a (
	a_gen1 AS (a_reg),
	a_gen2 AS (a_reg),
	a_reg INTEGER,
	PRIMARY KEY (a_reg)
);

CREATE TABLE b (
	gen1 AS (price),
	gen2 AS (price),
	price INTEGER,
	FOREIGN KEY (price) REFERENCES a (a_reg)
);

INSERT INTO a VALUES (5);

CREATE TABLE album (
	gen_artistid AS (artistid),
	gen_albumname AS (albumname),
	artistid INTEGER,
	albumname TEXT,
	albumcover TEXT,
	UNIQUE (artistid, albumname)
);

INSERT INTO album VALUES (1, 'A', 'A_cover'), (2, 'B', 'B_cover'), (3, 'C', 'C_cover'), (4, 'D', 'D_cover');

CREATE TABLE song(songid INTEGER, songartist INTEGER, songalbum TEXT, songname TEXT, FOREIGN KEY(songartist, songalbum) REFERENCES album(artistid, albumname));

INSERT INTO song VALUES (11, 1, 'A', 'A_song'), (12, 2, 'B', 'B_song'), (13, 3, 'C', 'C_song');

DELETE FROM album WHERE albumname='D';

SELECT * FROM album;

CREATE TABLE unit2(
	price INTEGER,
	amount_sold INTEGER,
	total_profit INTEGER GENERATED ALWAYS AS (price * amount_sold) VIRTUAL,
	also_total_profit INTEGER GENERATED ALWAYS AS (total_profit) VIRTUAL
);

INSERT INTO unit2 VALUES (100, 0);

SELECT * FROM unit2;

create table t (i int, j int as (1));

select column_default from duckdb_columns;

select column_name, is_generated from duckdb_columns order by column_index;

select column_name, generation_expression from duckdb_columns order by column_index;

select column_name, is_generated from information_schema.columns where table_name = 't' order by ordinal_position;

select column_name, generation_expression from information_schema.columns where table_name = 't' order by ordinal_position;

CREATE TABLE tbl (
    foo INTEGER,
    bar INTEGER GENERATED ALWAYS AS (foo+1) VIRTUAL,
    foobar INTEGER
);

insert into tbl VALUES
(1, 24),
(2342, 123),
(23523, 1),
(235, 213),
(8435, null),
(NULL, NULL),
(345, 213),
(12, 5);

insert into tbl select i % 20, random()::INTEGER * 20 from range(100) tbl(i);

CREATE TABLE non_generated as select * from tbl;

SELECT sql FROM sqlite_master WHERE name = 'tbl' and contains(sql, 'GENERATED');

SELECT sql FROM sqlite_master WHERE name = 'non_generated' and contains(sql, 'GENERATED');

select * from non_generated;

CREATE TABLE test (
    foo INTEGER,
    bar GENERATED ALWAYS AS (foo+1),
    foobar INTEGER DEFAULT 5
);

CREATE TABLE unit (
    foo INTEGER,
    bar AS (foo+1),
);

INSERT INTO test(foo) VALUES (1);

SELECT bar FROM test;

INSERT INTO unit VALUES(5);

SELECT bar FROM unit;

CREATE TABLE test (
    foo INTEGER,
    bar INTEGER GENERATED ALWAYS AS (foo+1) VIRTUAL,
    foobar INTEGER DEFAULT 5
);

INSERT INTO test (foo, foobar) VALUES (1, 10);

INSERT INTO test (foo) VALUES (12);

SELECT * FROM test;

INSERT INTO test VALUES (22, 10);

CREATE TABLE tbl (
    x INTEGER,
    y BOOLEAN AS (x),
);

INSERT INTO tbl VALUES (5);

INSERT INTO tbl VALUES (0);

CREATE TABLE tbl2 (
	x TEXT,
	y BOOLEAN AS (x),
);

CREATE TABLE tbl (
	price INTEGER,
	gcol AS (map())
);

CREATE TABLE tbl (
	gen1 AS (price),
	gen2 AS (price),
	price INTEGER NOT NULL
);

CREATE TABLE unit (
	price INTEGER,
	amount_sold INTEGER,
	name VARCHAR,
	total_profit AS (price * amount_sold)
);

INSERT INTO unit VALUES (5,4, 'Soda can');

INSERT INTO unit VALUES (5,8, 'Mars bar');

INSERT INTO unit VALUES (4, 5, 'Chewing gum');

SELECT total_profit, COUNT(total_profit), SUM(amount_sold), SUM(price) FROM unit GROUP BY total_profit ORDER BY ALL;

SELECT total_profit,
		name,
		COUNT(total_profit) OVER(PARTITION BY total_profit) AS CountTotalProfit,
		SUM(amount_sold) OVER(PARTITION BY total_profit) AS SumAmountSold,
		SUM(price) OVER(PARTITION BY total_profit) AS SumPrice
FROM unit
ORDER BY 1, 2 DESC;

CREATE TABLE test (
    foo INTEGER,
    bar INTEGER GENERATED ALWAYS AS (foo+1) VIRTUAL,
    foobar INTEGER
);

CREATE TABLE tbl (
	gen1 AS (price),
	gen2 AS (price),
	price INTEGER PRIMARY KEY
);

CREATE TABLE unit (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold),
	profit_total AS (total_profit * 5)
);

CREATE TABLE tbl2 (
	price INTEGER,
	circular AS (dependency * price),
	dependency AS (price),
);

CREATE TABLE tbl3 (
	dependency INTEGER AS (price),
	price INTEGER,
	circular AS (dependency),
);

CREATE TABLE tbl (
	price INTEGER,
	dependency INTEGER AS (price),
	circular AS (dependency * price),
);

CREATE TABLE tbl4 (
	price INTEGER,
	dependency AS (price),
	depth1 AS (dependency),
	depth2 AS (price * dependency),
	depth3 AS (depth1 * depth2 * dependency),
	depth4 aS ((dependency * depth3) + depth1),
	depth5 AS (depth4 - (depth3 + depth2) + (dependency * depth1))
);

INSERT INTO tbl4 VALUES (5);

SELECT * FROM tbl4;

SELECT total_profit FROM unit;

ALTER TABLE unit RENAME COLUMN total_profit TO profit_total;

SELECT profit_total FROM unit;

CREATE TABLE unit (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold),
	profit_total AS (total_profit),
	sold_amount AS (5 + 3)
);

ALTER TABLE unit RENAME COLUMN price TO value;

ALTER TABLE unit RENAME TO not_unit;

SELECT * FROM not_unit;

CREATE TABLE t1 (
	tr INTEGER,
	td INTEGER GENERATED ALWAYS AS (tr),
	tz INTEGER
);

CREATE INDEX id ON t1(tr);

INSERT INTO t1(tr) VALUES (2);

SELECT tz from t1 WHERE tr < 5;

ALTER TABLE unit ADD COLUMN rowid INTEGER;

CREATE TABLE tbl (
	rowid INTEGER,
	index INTEGER GENERATED ALWAYS AS (rowid) VIRTUAL
);

SELECT index FROM tbl;

CREATE TABLE tbl (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold),
);

INSERT INTO tbl VALUES (5,4);

SELECT total_profit FROM tbl;

SELECT tbl.* FROM tbl;

CREATE TABLE tbl (
	price INTEGER,
	amount_sold INTEGER,
	total_profit AS (price * amount_sold),
	order_id BIGINT,
	y as (order_id + total_profit - amount_sold)
);

select y, amount_sold from tbl;

CREATE TABLE unit (
	bar TEXT,
	foobar as (concat(foo, bar)),
	profit_total AS (foobar),
	dependent AS (profit_total),
	also_dependent AS (concat(profit_total,dependent)),
	foo TEXT,
);

INSERT INTO unit VALUES ('string','test');

INSERT INTO unit VALUES (5,0);

CREATE TABLE tbl (
	price INTEGER,
	total_profit DATE AS (price * 5),
);

CREATE TABLE tbl (
	gen1 AS (price),
	gen2 AS (price),
	price INTEGER UNIQUE
);

INSERT INTO test VALUES (5, DEFAULT);

INSERT INTO test VALUES (10, 3);

UPDATE test SET foo=3;

UPDATE test SET foo=9001 WHERE (foobar == 3);

UPDATE test SET foo=0 WHERE (bar < 9000);

CREATE TABLE tbl_comp (
	a INT,
	gen AS (2 * a),
	b INT,
	c VARCHAR,
	PRIMARY KEY(c));

INSERT INTO tbl_comp VALUES (1, 1, 'hello');

UPDATE tbl_comp SET c='world';

FROM tbl_comp;

CREATE TABLE tbl_only_indexed (
	gen AS (y + 1),
	y INT UNIQUE
);

INSERT INTO tbl_only_indexed (y) VALUES (10), (20);

BEGIN;

UPDATE tbl_only_indexed SET y = 30 WHERE y = 10;

INSERT INTO tbl_only_indexed (y) VALUES (10);

COMMIT;

SELECT * FROM tbl_only_indexed ORDER BY y;
