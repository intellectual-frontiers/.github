CREATE SCHEMA IF NOT EXISTS schema__test;

CREATE TABLE tbl (
	g AS (x + 1),
	x INTEGER,
	y INTEGER UNIQUE
);

INSERT INTO tbl VALUES (1, 10);

INSERT OR REPLACE INTO tbl (x, y) VALUES (2, 10);

SELECT * FROM tbl;

create table t(
	id varchar primary key,
	state varchar not null,
	name varchar not null
);

create index idx_state on t(state);

insert or replace into t values ('a', 'first', 'jeremy');

insert or replace into t values ('a', 'second', 'tim');

select * from t;

insert or replace into t(name, id, state) values ('sam', 'a', 'third');

insert or replace into t(id, state) values ('a', 'fourth');

create table t_offset(
	id integer primary key,
	dropped_col integer,
	state integer not null,
	payload integer not null
);

insert or replace into t_offset values (1, 111, 10, 20);

alter table t_offset drop column dropped_col;

create index idx_state_offset on t_offset(state);

insert or replace into t_offset values (1, 30, 40);

select * from t_offset;

insert or replace into t_offset(payload, id, state) values (50, 1, 60);

select count(*) from t_offset where state = 10;

create table t_comp(
	id integer primary key,
	a integer,
	b integer,
	payload varchar
);

create index idx_ab on t_comp(a, b);

insert or replace into t_comp values (1, 10, 20, 'v1');

insert or replace into t_comp values (1, 11, 21, 'v2');

select * from t_comp;

insert or replace into t_comp(id, a) values (1, 12);

select count(*) from t_comp where a = 11 and b = 21;

create table tbl(
	a int,
	b int,
	c int,
	primary key(a,b,c)
);

create index non_unique on tbl(b);

insert or replace into tbl values (1,2,3);

create table foo(
	bar text primary key,
	baz bigint,
);

insert or replace into foo(bar, baz) values ('baz', 1) returning bar;

insert or replace into foo(bar, baz) values ('baz', 2) returning bar;

insert or replace into foo(bar, baz) values ('baz', 1), ('bar', 2) returning bar;

CREATE SEQUENCE seq START 1;

CREATE TABLE bug (
	id INTEGER PRIMARY KEY DEFAULT NEXTVAL('seq'),
	name VARCHAR
);

CREATE UNIQUE INDEX idx ON bug (name);

INSERT OR IGNORE INTO bug VALUES
	(DEFAULT, 'toto') RETURNING(id);

INSERT OR IGNORE INTO bug VALUES
	(DEFAULT, 'toto'), (DEFAULT, 'yoyo') RETURNING(id);

create table tbl(
	a int,
	b int,
	c int
);

create UNIQUE index "unique" on tbl(a, b);

create index non_unique on tbl(a, b);

create table tbl(
	a int unique,
	b int
);

insert or replace into tbl values(1, 2);

create table multiple_unique(
	a int unique,
	b int unique,
	c int
);

CREATE TABLE tbl(a INT, b INT, c INT);

INSERT OR REPLACE INTO tbl VALUES (1, 2, 3);

CREATE UNIQUE INDEX idx3 ON tbl(b, c);

create or replace table tbl(
	i integer PRIMARY KEY,
	j integer UNIQUE,
	k integer
);

insert into tbl VALUES (1, 10, 1), (2, 20, 1), (3, 30, 2);

insert into tbl VALUES (3,5,1) ON CONFLICT (i) DO UPDATE SET k = k + excluded.k;

create or replace table tbl (a integer default 3);

CREATE TABLE n2(u INT UNIQUE, w INT);

INSERT INTO n2 VALUES (NULL,1),(NULL,2) ON CONFLICT DO NOTHING;

INSERT OR IGNORE INTO n2 VALUES (NULL,3),(NULL,4);

SELECT count(*) FROM n2;

INSERT INTO n2 VALUES (1,10),(1,11),(NULL,5) ON CONFLICT DO NOTHING;

SELECT count(*) FROM n2 WHERE u = 1;

SELECT count(*) FROM n2 WHERE u IS NULL;

CREATE TABLE c(a INT, b INT, UNIQUE(a, b));

INSERT INTO c VALUES (1,NULL),(1,NULL),(2,3),(2,3) ON CONFLICT DO NOTHING;

SELECT a, count(*) FROM c GROUP BY a ORDER BY a;

CREATE TABLE pk(i INT PRIMARY KEY, v INT);

EXPLAIN INSERT INTO pk VALUES (1, 1) ON CONFLICT DO NOTHING;

CREATE TABLE nn(i INT NOT NULL UNIQUE, v INT);

EXPLAIN INSERT INTO nn VALUES (1, 1) ON CONFLICT DO NOTHING;

INSERT INTO nn VALUES (1, 1), (1, 2), (2, 3) ON CONFLICT DO NOTHING;

SELECT count(*) FROM nn;

CREATE TABLE nu(i INT UNIQUE, v INT);

EXPLAIN INSERT INTO nu VALUES (1, 1) ON CONFLICT DO NOTHING;

create table insertconflicttest(
	key int4,
	fruit text,
	other int4,
	unique (key, fruit)
);

insert into insertconflicttest values(0, 'Crowberry', 0) on conflict (key, fruit) do nothing;

insert into insertconflicttest values(0, 'Crowberry', 0) on conflict (fruit, key, fruit, key) do nothing;

insert into insertconflicttest values (7, 'Raspberry', 0) on conflict (key, fruit) do update set other = 1;

insert into insertconflicttest values (8, 'Lime', 0) on conflict (fruit, key) do update set other = 1;

insert into insertconflicttest values (11, 'Cherry', 0) on conflict (key, fruit) do update set other = 1;

insert into insertconflicttest values (12, 'Date', 0) on conflict (fruit, key) do update set other = 1;

create unique index expr_key_index on insertconflicttest(fruit);

insert into insertconflicttest values (20, 'Quince', 0) on conflict (fruit) do update set other = 1;

insert into insertconflicttest values (21, 'Pomegranate', 0) on conflict (fruit, fruit) do update set other = 1;

create unique index expr_comp_key_index on insertconflicttest(key, fruit);

create unique index tricky_expr_comp_key_index on insertconflicttest(key, fruit, fruit);

insert into insertconflicttest values (24, 'Plum', 0) on conflict (key, fruit) do update set other = 1;

insert into insertconflicttest values (25, 'Peach', 0) on conflict (fruit, key) do update set other = 1;

insert into insertconflicttest values (26, 'Fig', 0) on conflict (fruit, key, fruit, key) do update set other = 1;

create table insertconflicttest(
	key int4,
	fruit text,
	other int4,
	unique (key),
	unique (fruit)
);

insert into insertconflicttest values (25, 'Fig', 0) on conflict (fruit) do update set other = 1;

insert into insertconflicttest values (23, 'Blackberry', 0) on conflict (key) do update set other = 1 where fruit like '%berry';

insert into insertconflicttest as i values (23, 'Jackfruit', 0) on conflict (key) do update set other = 1;

insert into insertconflicttest as i values (23, 'Avocado', 0) on conflict (key) do update set other = 1;

drop table insertconflicttest;

create table cities (
	name		text,
	population	float8,
	altitude	int,
	unique (name)
);

create table capitals (
	name		text,
	population	float8,
	altitude	int,
	state		char(2),
	unique (name)
);

insert into cities values ('San Francisco', 7.24E+5, 63);

insert into cities values ('Las Vegas', 2.583E+5, 2174);

insert into cities values ('Mariposa', 1200, 1953);

insert into capitals values ('Sacramento', 3.694E+5, 30, 'CA');

insert into capitals values ('Madison', 1.913E+5, 845, 'WI');

select * from capitals;

insert into cities values ('Las Vegas', 2.583E+5, 2174) on conflict do nothing;

insert into capitals values ('Sacramento', 4664.E+5, 30, 'CA') on conflict (name) do update set population = excluded.population;

insert into capitals values ('Sacramento', 50, 2267, 'NE') on conflict (name) do nothing;

insert into cities values ('Las Vegas', 5.83E+5, 2001) on conflict (name) do update set population = excluded.population, altitude = excluded.altitude;

select rowid, * from cities;

insert into capitals values ('Las Vegas', 5.83E+5, 2222, 'NV') on conflict (name) do update set population = excluded.population;

insert into cities values ('Las Vegas', 5.86E+5, 2223) on conflict (name) do update set population = excluded.population, altitude = excluded.altitude;

drop table capitals;

drop table cities;

create table excluded(key int primary key, data text);

insert into excluded values(1, '1');

insert into excluded AS target values(1, '2') on conflict (key) do update set data = excluded.data RETURNING *;

insert into excluded AS target values(1, '2') on conflict (key) do update set data = target.data RETURNING *;

drop table excluded;

create table dropcol(key int primary key, drop1 int, keep1 text, drop2 numeric, keep2 float);

insert into dropcol(key, drop1, keep1, drop2, keep2) values(1, 1, '1', '1', 1);

insert into dropcol(key, drop1, keep1, drop2, keep2) values(1, 2, '2', '2', 2) on conflict(key)
    do update set drop1 = excluded.drop1, keep1 = excluded.keep1, drop2 = excluded.drop2, keep2 = excluded.keep2
    where excluded.drop1 is not null and excluded.keep1 is not null and excluded.drop2 is not null and excluded.keep2 is not null
          and dropcol.drop1 is not null and dropcol.keep1 is not null and dropcol.drop2 is not null and dropcol.keep2 is not null
    returning *;

insert into dropcol(key, drop1, keep1, drop2, keep2) values(1, 3, '3', '3', 3) on conflict(key)
    do update set drop1 = dropcol.drop1, keep1 = dropcol.keep1, drop2 = dropcol.drop2, keep2 = dropcol.keep2
    returning *;

alter table dropcol
drop column drop1;

alter table dropcol
drop column drop2;

insert into dropcol(key, keep1, keep2) values(1, '4', 4) on conflict(key)
    do update set keep1 = excluded.keep1, keep2 = excluded.keep2
    where excluded.keep1 is not null and excluded.keep2 is not null
          and dropcol.keep1 is not null and dropcol.keep2 is not null
    returning *;

insert into dropcol(key, keep1, keep2) values(1, '5', 5) on conflict(key)
    do update set keep1 = dropcol.keep1, keep2 = dropcol.keep2
    returning *;

DROP TABLE dropcol;

create table insertconflicttest(
	key int4,
	fruit text,
	unique (key)
);

insert into insertconflicttest values (0, 'Bilberry') on conflict (key) do update set fruit = excluded.fruit;

insert into insertconflicttest values (0, 'Bilberry') on conflict (key) do update set fruit = excluded.fruit where insertconflicttest.fruit != 'Cawesh';

insert into insertconflicttest values(0, 'Crowberry') on conflict (key) do update set fruit = excluded.fruit where excluded.fruit != 'Elderberry';

insert into insertconflicttest values (0, 'Bilberry') on conflict (key) do update set fruit = excluded.fruit where insertconflicttest.fruit != 'Lime' returning *;

insert into insertconflicttest values (1, 'Apple') on conflict do update set fruit = excluded.fruit;

insert into insertconflicttest values (1, 'Apple') on conflict (key) do update set fruit = excluded.fruit;

insert into insertconflicttest values (2, 'Orange') on conflict (key, key, key) do update set fruit = excluded.fruit;

INSERT INTO insertconflicttest VALUES (1, 'Apple'), (2, 'Orange')
ON CONFLICT (key) DO UPDATE SET fruit = excluded.fruit, key = excluded.key;

insert into insertconflicttest AS ict values (6, 'Passionfruit') on conflict (key) do update set fruit = excluded.fruit;

insert into insertconflicttest AS ict values (6, 'Passionfruit') on conflict (key) do update set fruit = ict.fruit;

SET preserve_insertion_order = false;

CREATE TABLE integers(
	i INT UNIQUE,
	j INT DEFAULT 0,
	k INT DEFAULT 0
);

INSERT INTO integers(i) SELECT i FROM range(5000) tbl(i);

SELECT COUNT(*) FROM integers;

INSERT INTO integers SELECT * FROM integers ON CONFLICT DO NOTHING;

INSERT INTO integers SELECT * FROM integers ON CONFLICT DO UPDATE SET j = 10;

SELECT COUNT(*) FILTER (WHERE j = 10) FROM integers;

INSERT INTO integers(i, j) SELECT i % 5, i FROM range(4995, 5000) tbl(i) ON CONFLICT DO UPDATE SET j = excluded.j, k = excluded.i;

SELECT j FROM integers LIMIT 5;

INSERT INTO integers(i, j)
	SELECT CASE WHEN i % 2 = 0
		THEN 4999 - (i // 2)
		ELSE i - ((i // 2) + 1)
		END, i
	FROM range(5000) tbl(i)
ON CONFLICT DO UPDATE SET j = excluded.j;

SELECT j FROM integers ORDER BY rowid LIMIT 5 OFFSET 4995;

UPDATE integers SET j = 0;

INSERT INTO integers(i, j)
	SELECT CASE WHEN i % 2 = 0
		THEN 4999 - (i // 2)
		ELSE i - ((i // 2) + 1)
		END, i
	FROM range(5000) tbl(i)
ON CONFLICT DO UPDATE SET j = excluded.j
WHERE i % 2 = 0 AND excluded.j % 2 = 0;

SELECT COUNT(j) FILTER (WHERE j != 0) FROM integers;

INSERT INTO integers(i, j)
SELECT i % 5, i
FROM range(5000) tbl(i) ON CONFLICT DO UPDATE SET
	j = excluded.j,
	k = excluded.i;

CREATE TABLE t1 (
	a CHAR NOT NULL,
	c CHAR GENERATED ALWAYS AS (a) VIRTUAL,
	b INT,
);

CREATE UNIQUE INDEX t1_idx ON t1 (a);

INSERT INTO t1 VALUES ('a', 1) ON CONFLICT(a) DO UPDATE SET b = excluded.b;

SELECT * FROM t1;

CREATE TABLE t2 (
	b INT,
	c CHAR GENERATED ALWAYS AS (a) VIRTUAL,
	a CHAR NOT NULL,
);

CREATE UNIQUE INDEX t2_idx ON t2 (a);

INSERT INTO t2 VALUES (1, 'a') ON CONFLICT(a) DO UPDATE SET b = excluded.b;

CREATE TABLE users (
	id BIGINT PRIMARY KEY,
	username TEXT UNIQUE,
	email TEXT
);

INSERT INTO users (id, username, email)
VALUES
	(3, 'inner_conflict', 'test'),
	(3, 'inner_conflict2', 'other_test'),
	(3, 'inner_conflict3', 'filtered_out')
ON CONFLICT (id) DO
    UPDATE SET email = EXCLUDED.email
    WHERE EXCLUDED.email != 'filtered_out'
RETURNING id;

SELECT count(*), count(*) FILTER (WHERE (username, email) IN (
    ('inner_conflict', 'test'),
    ('inner_conflict2', 'other_test'),
    ('inner_conflict3', 'filtered_out')
)) FROM users;

UPDATE users SET username = 'existing_user', email = 'test';

INSERT INTO users (id, username, email)
VALUES
	(3, 'inner_conflict', 'test'),
	(3, 'inner_conflict2', 'other_test'),
	(3, 'inner_conflict3', 'yet_another_test'),
	(3, 'inner_conflict4', 'dont_skip_me')
ON CONFLICT (id) DO
    UPDATE SET email = EXCLUDED.email
    WHERE email != 'other_test' OR EXCLUDED.email == 'dont_skip_me'
RETURNING id, username;

SELECT count(*), count(*) FILTER (WHERE username = 'existing_user' AND email IN
    ('test', 'other_test', 'yet_another_test', 'dont_skip_me')) FROM users;

UPDATE users SET email = 'other_test';

INSERT INTO users VALUES
    (3, 'unused_username', 'yet_another_test'),
    (3, 'unused_username', 'yet_another_test')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
WHERE email != 'other_test' OR EXCLUDED.email = 'dont_skip_me'
RETURNING *;

SELECT * FROM users;

INSERT INTO users VALUES
    (3, 'unused_username', 'dont_skip_me'),
    (3, 'unused_username', 'dont_skip_me')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
WHERE email != 'other_test' OR EXCLUDED.email = 'dont_skip_me'
RETURNING *;

DROP TABLE users;

create table tbl (
	i integer,
	j integer unique
);

insert into tbl values (5,3), (6,7);

insert into tbl AS test values (3,5), (8,3), (2,6) on conflict (j) do update set i = excluded.i * 2 where i <= excluded.i;

select * from tbl order by all;

insert into tbl AS test values (2,3) on conflict do update set i = test.i;

insert into tbl as test values (2,3) on conflict (j) do update set i = excluded.j where test.i < 5;

insert into tbl as test values (2,3) on conflict (j) do update set i = excluded.j where test.i >= 5;

insert into tbl as test (j, i) values (5,3) on conflict (j) do update set i = 10 where test.j <= 3;

insert into tbl as test (j, i) values (5,3) on conflict (j) do update set i = 10 where test.j > 3;

CREATE TABLE tbl(
	i INT PRIMARY KEY,
	j INT UNIQUE,
	k INT
);

INSERT INTO tbl VALUES (3, 5, 1)
ON CONFLICT (i) DO UPDATE SET i = i + 1;

SELECT i, j, k FROM tbl ORDER BY ALL;

SELECT i, j, k FROM tbl WHERE i = 4;

INSERT INTO tbl VALUES (4, 30, 2)
ON CONFLICT (i) DO UPDATE SET i = i - 1;

insert into tbl VALUES
	(3,5,1)
ON CONFLICT (i) DO UPDATE SET k = excluded.k;

insert into tbl VALUES
	(4,2,3),
	(3,5,10)
ON CONFLICT (i) DO NOTHING;

insert into tbl VALUES
	(3,3,10),
	(3,3,10)
ON CONFLICT (i) DO UPDATE SET
	k = excluded.k;

insert into tbl VALUES (3,5,1) ON CONFLICT (i) DO UPDATE SET k = 1 WHERE k < 5;

insert into tbl VALUES (3,5,1) ON CONFLICT (i) DO UPDATE SET k = 1 WHERE k >= 5;

insert into tbl VALUES (3,5,3) on conflict (i) do update set k = 10 WHERE k != 1;

insert into tbl VALUES (3,5,3) on conflict (i) do update set k = 10 WHERE k == 1;

insert into tbl VALUES (5,1,0), (3,5,20) ON CONFLICT DO NOTHING;

create or replace table single_constraint (
	i integer PRIMARY KEY,
	j integer,
	k varchar,
);

insert into single_constraint values (5,1,'hello'), (1,10,'test');

insert into single_constraint values (1,5,'bye'), (3,10,'quack') on conflict do update set j = excluded.j, k = concat(k, excluded.k);

select * from single_constraint;

CREATE TABLE t1 (k VARCHAR PRIMARY KEY);

INSERT INTO t1 VALUES ('a');

INSERT INTO t1 SELECT 1 ON CONFLICT DO NOTHING;

SELECT k FROM t1 ORDER BY k;

CREATE TABLE t2 (k INTEGER PRIMARY KEY, n INTEGER);

INSERT INTO t2 VALUES (1, 0);

INSERT OR IGNORE INTO t2 SELECT 1.4, 7;

INSERT OR IGNORE INTO t2 BY NAME SELECT 7 AS n, 1.4 AS k;

INSERT INTO t2 (k) SELECT 1.4 ON CONFLICT (k) DO NOTHING;

SELECT * FROM t2;

INSERT INTO t2 SELECT 1.4, 7 ON CONFLICT (k) DO UPDATE SET n = excluded.k * 10;

INSERT OR REPLACE INTO t2 SELECT 2.3, 8;

INSERT OR REPLACE INTO t2 SELECT 0.9, 9;

SELECT * FROM t2 ORDER BY k;

PREPARE upsert_t2 AS INSERT INTO t2 SELECT $1, 20 ON CONFLICT (k) DO UPDATE SET n = excluded.n WHERE excluded.k = 1 RETURNING k, n;

EXECUTE upsert_t2(1.4);

EXECUTE upsert_t2(2.4);

SELECT k, n FROM t2 WHERE k = 2;

INSERT INTO t2 SELECT 3.1, 1 UNION ALL SELECT 3.2, 2 ON CONFLICT DO NOTHING;

SELECT count(*) FROM t2 WHERE k = 3;

CREATE TABLE t3 (k VARCHAR PRIMARY KEY, n INTEGER);

INSERT INTO t3 VALUES ('2', 0);

INSERT INTO t3 SELECT 2.0::DOUBLE, 1 ON CONFLICT DO NOTHING;

INSERT INTO t3 SELECT '2', 2 ON CONFLICT DO NOTHING;

SELECT * FROM t3 ORDER BY k;

CREATE TABLE t4 (k VARCHAR PRIMARY KEY DEFAULT 3.0::DOUBLE, n INTEGER);

INSERT INTO t4 VALUES ('3', 0);

INSERT INTO t4 (n) SELECT 1 ON CONFLICT DO NOTHING;

INSERT INTO t4 (n) VALUES (2) ON CONFLICT DO NOTHING;

INSERT INTO t4 DEFAULT VALUES ON CONFLICT DO NOTHING;

SELECT * FROM t4 ORDER BY k;

CREATE TABLE t5 (a INTEGER, b VARCHAR, c DATE UNIQUE, n INTEGER, PRIMARY KEY (a, b));

INSERT INTO t5 VALUES (1, '1', DATE '2000-01-01', 0);

INSERT INTO t5 SELECT 1.2, 1, NULL, 1 ON CONFLICT DO NOTHING;

INSERT INTO t5 SELECT 2, '2', TIMESTAMP '2000-01-01 10:00:00', 2 ON CONFLICT DO NOTHING;

INSERT INTO t5 SELECT 1.2, 1, NULL, 3 ON CONFLICT (a, b) DO UPDATE SET n = excluded.n;

SELECT * FROM t5 ORDER BY a;

CREATE TABLE t8 (k VARCHAR COLLATE NOCASE PRIMARY KEY, n INTEGER);

INSERT INTO t8 VALUES ('A', 0);

INSERT INTO t8 SELECT 'a', 1 UNION ALL SELECT 'A', 1 ON CONFLICT DO UPDATE SET n = excluded.n;

INSERT INTO t8 SELECT 'b'::BLOB, 2 UNION ALL SELECT 'B'::BLOB, 2 ON CONFLICT DO NOTHING;

INSERT OR IGNORE INTO t8 SELECT 'c', 3 UNION ALL SELECT 'C', 3;

INSERT OR REPLACE INTO t8 SELECT 'd', 4 UNION ALL SELECT 'D', 4;

INSERT INTO t8 SELECT 'Q', 5 ON CONFLICT DO NOTHING;

SELECT lower(k), n FROM t8 ORDER BY n;

SELECT k FROM t8 WHERE n IN (1, 5) ORDER BY n;

PREPARE upsert_t8 AS INSERT INTO t8 SELECT $1, 6 ON CONFLICT DO UPDATE SET n = excluded.n RETURNING k, n;

EXECUTE upsert_t8('q');

SELECT count(*) FROM t8;

CREATE TABLE t8b (k VARCHAR COLLATE NOACCENT UNIQUE);

INSERT INTO t8b SELECT 'é' UNION ALL SELECT 'e' ON CONFLICT DO NOTHING;

SELECT count(*) FROM t8b;

CREATE TABLE t8c (a INTEGER, b VARCHAR COLLATE NOCASE, n INTEGER, PRIMARY KEY (a, b));

INSERT INTO t8c SELECT 1.4, 'X', 1 UNION ALL SELECT 1, 'x', 1 ON CONFLICT DO NOTHING;

SELECT a, lower(b) FROM t8c;

CREATE TABLE t8e (k VARCHAR PRIMARY KEY);

INSERT INTO t8e VALUES ('B');

INSERT INTO t8e SELECT 'A' COLLATE NOCASE UNION ALL SELECT 'a' COLLATE NOCASE ON CONFLICT DO NOTHING;

INSERT INTO t8e SELECT 'b' COLLATE NOCASE ON CONFLICT DO NOTHING;

SELECT k FROM t8e ORDER BY k::BLOB;

SET default_collation = 'nocase';

CREATE TABLE t8f (k VARCHAR PRIMARY KEY, n INTEGER);

INSERT INTO t8f VALUES ('B', 0);

INSERT INTO t8f SELECT 'A' COLLATE "binary", 1 UNION ALL SELECT 'a' COLLATE "binary", 1 ON CONFLICT DO NOTHING;

INSERT INTO t8f SELECT 'b' COLLATE "binary", 2 ON CONFLICT DO UPDATE SET n = excluded.n RETURNING k, n;

SELECT lower(k), n FROM t8f ORDER BY n;

RESET default_collation;

PREPARE upsert_t8f AS INSERT INTO t8f SELECT $1::VARCHAR, 3 ON CONFLICT DO UPDATE SET n = t8f.n + 1 RETURNING k, n;

EXECUTE upsert_t8f('x');

CREATE TABLE t8d (k TIMETZ PRIMARY KEY, n INTEGER);

INSERT INTO t8d VALUES ('12:00:00+00', 0);

INSERT INTO t8d SELECT '13:00:00+01', 1 UNION ALL SELECT '12:00:00+00', 2 ON CONFLICT DO UPDATE SET n = excluded.n;

INSERT INTO t8d SELECT '14:00:00+02', 3 UNION ALL SELECT '15:00:00+03', 4 ON CONFLICT DO NOTHING;

SELECT k::VARCHAR, n FROM t8d ORDER BY n;

CREATE TYPE mood AS ENUM ('sad', 'ok');

CREATE TABLE t6 (k mood PRIMARY KEY, n INTEGER);

INSERT INTO t6 VALUES ('ok', 0);

INSERT INTO t6 SELECT 'ok', 1 ON CONFLICT DO UPDATE SET n = excluded.n;

SELECT * FROM t6;

CREATE TABLE t6b (a INTEGER, k mood, n INTEGER, PRIMARY KEY (a, k));

INSERT INTO t6b VALUES (1, 'ok', 0);

INSERT INTO t6b SELECT 1.4, 'ok', 1 ON CONFLICT DO UPDATE SET n = excluded.n;

SELECT * FROM t6b;

CREATE TYPE empty_enum AS ENUM ();

CREATE TABLE t7 (k empty_enum UNIQUE);

INSERT INTO t7 VALUES (NULL) ON CONFLICT DO NOTHING;

INSERT INTO t7 SELECT NULL ON CONFLICT DO NOTHING;

SELECT count(*) FROM t7;

SET enable_optimizer=false;

CREATE TABLE t_prepared_returning (k VARCHAR PRIMARY KEY, n INTEGER);

PREPARE upsert_returning AS INSERT INTO t_prepared_returning SELECT $1::VARCHAR, 3 ON CONFLICT DO UPDATE SET n = t_prepared_returning.n + 1 RETURNING k, n;

EXECUTE upsert_returning('x');

SET enable_optimizer=true;

CREATE TABLE t9 (k JSON PRIMARY KEY);

INSERT INTO t9 VALUES ('1');

CREATE SCHEMA s;

CREATE TYPE s.JSON AS INTEGER;

SET search_path = 's,main';

INSERT INTO t9 SELECT '1.4' ON CONFLICT DO NOTHING;

SELECT k FROM t9 ORDER BY k;

CREATE OR REPLACE TABLE tbl (a INT, b INT, c INT, PRIMARY KEY (a, b));

INSERT INTO tbl VALUES (1, 2, 3), (1, 4, 5);

INSERT INTO tbl VALUES (1,4,7), (1,8,4) ON CONFLICT (a,b) DO UPDATE SET c = 5;

SELECT a, b, c FROM tbl ORDER BY ALL;

create or replace table index_tbl (
	i integer,
	j integer
);

insert into index_tbl values (5, 3);

create unique index other_index on index_tbl(i);

select * from index_tbl;

CREATE TABLE tbl (a INT, b INT UNIQUE, c INT UNIQUE, d INT UNIQUE);

INSERT INTO tbl (b, c, d) VALUES (1, 2, 3), (2, 3, 1), (3, 1, 2);

INSERT INTO tbl(b, c, d) VALUES (3, 3, 3) ON CONFLICT DO NOTHING;

SELECT b, c, d FROM tbl ORDER BY ALL;

create table tbl (
	a integer DEFAULT 5,
	b integer unique,
	c integer DEFAULT 10
);

insert into tbl(b) VALUES (3), (5), (6);

insert into tbl(b) VALUES (7), (3), (4) ON CONFLICT do update set c = 5, a = 10;

create table t (i int primary key, j int);

insert into t values (1, 1) on conflict do nothing;

insert into t values (1, 1) on conflict (i) do update set j = excluded.i;

create table t_case (i int not null primary key);

insert into t_case (I) select 1 on conflict do nothing;

select * from t_case;

create table t_case_nullable (i int, j int unique);

insert into t_case_nullable (I, J) select 7, 9 on conflict do nothing;

select i, j from t_case_nullable;

create table t_case_upd (i int primary key, j int);

insert into t_case_upd (I, J) select 1, 10 on conflict do nothing;

insert into t_case_upd (I, J) select 1, 20 on conflict (I) do update set j = excluded.j;

select i, j from t_case_upd;

create or replace table tbl (
	a integer primary key default 4,
	b integer DEFAULT 3
);

insert into tbl VALUES (2,3), (4,5);

insert into tbl VALUES (DEFAULT, 6) ON CONFLICT (a) DO UPDATE SET b = DEFAULT;

create or replace table tbl (
	a integer primary key default 5,
	b integer
);

insert into tbl(b) VALUES (10);

insert into tbl(b) VALUES (10) ON CONFLICT (a) DO NOTHING;

insert into tbl(b) VALUES (10) ON CONFLICT (a) DO UPDATE SET b = excluded.b * 2;

insert into tbl DEFAULT VALUES;

FROM tbl;

CREATE TABLE test_table_raw(id VARCHAR, name VARCHAR);

INSERT INTO test_table_raw VALUES
	('abc001','foo'),
	('abc002','bar'),
	('abc001','foo2'),
	('abc002','bar2');

CREATE TABLE test_table(id VARCHAR PRIMARY KEY, name VARCHAR);

INSERT OR IGNORE INTO test_table
SELECT
  DISTINCT(id) as id,
  name
FROM test_table_raw;

SELECT * FROM test_table_raw;

CREATE TABLE tmp_edges(from_v VARCHAR, to_v VARCHAR, PRIMARY KEY(from_v, to_v));

create or replace table tbl (
	a integer primary key,
	b integer
);

insert into tbl VALUES (1,2), (2,2);

insert into tbl VALUES (1,3), (3,4) ON CONFLICT (a) DO UPDATE SET b = excluded.b;

insert into tbl VALUES (4,3), (3,8) ON CONFLICT (a) DO UPDATE SET b = 10;

insert into tbl VALUES (3,8), (2,2), (7,2) ON CONFLICT (a) DO UPDATE SET b = b*2 WHERE b == excluded.b;

SET max_vacuum_tasks = 0;

CREATE TABLE tbl (i INT, j INT);

INSERT INTO tbl VALUES (5, 3), (3, 2);

CREATE UNIQUE INDEX my_index ON tbl(i);

INSERT INTO tbl VALUES (5, 2) ON CONFLICT (i) DO UPDATE SET j = 10;

SELECT i, j FROM tbl ORDER BY ALL DESC;

DROP TABLE tbl CASCADE;

CREATE TABLE tbl (i INT PRIMARY KEY, j INT);

INSERT INTO tbl VALUES (42, 21), (21, 42);

CREATE INDEX my_index ON tbl(j);

INSERT INTO tbl VALUES (42, 20) ON CONFLICT DO UPDATE SET j = 30;

SELECT i, j, rowid FROM tbl WHERE j = 30;

SELECT i, j, rowid FROM tbl ORDER BY ALL;

create table tbl (
	number INTEGER PRIMARY KEY,
	str VARCHAR
);

insert into tbl VALUES
	(1, 'd'),
	(3, 'nope'),
	(2, 'n');

insert into tbl VALUES
	(1, 'c'),	-- conflict (existing)
	(6, 'yep'),
	(3, 'abc'),	-- conflict (existing)
	(4, 'abc'),
	(7, 'tes'),
	(2, 'b'),	-- conflict (existing)
	(1, 'c'),	-- conflict (existing + inner)
	(5, 'abc'),
	(7, 'tes'), -- conflict (inner)
	(2, 'b')	-- conflict (existing + inner)
ON CONFLICT (number) DO UPDATE SET str = excluded.str || 'e';

create table tbl(
	i int primary key
);

insert into tbl values (1);

insert into tbl select 1 from range(2) on conflict do nothing;

CREATE OR REPLACE TABLE foo (
	pk_col INT PRIMARY KEY,
	str VARCHAR,
	str_list VARCHAR[],
	payload_col INT
);

INSERT INTO foo
SELECT 1, 'hello', ['x', 'y', 'z'], 40
ON CONFLICT DO UPDATE SET
	str = list_reduce(EXCLUDED.str_list, lambda x, y: x || '||' || y);

FROM foo;

INSERT INTO foo
SELECT 1, 'world', ['a', 'b', 'c'], 41
ON CONFLICT DO UPDATE SET
	str = list_reduce(EXCLUDED.str_list, lambda x, y: x || '||' || y);

INSERT INTO foo
SELECT 1, '', ['1', '2'], 42
ON CONFLICT DO UPDATE SET
  str = list_reduce(EXCLUDED.str_list, lambda x, y: x || '||' || y),
  payload_col = EXCLUDED.payload_col;

INSERT INTO foo
SELECT 1, '', ['l', 'm', 'n'], 43
ON CONFLICT DO UPDATE SET
  str = list_reduce(str_list, lambda x, y: x || '||' || y);

INSERT INTO foo
SELECT 1, 'world', ['s', 't'], 42
ON CONFLICT DO UPDATE SET
  str = list_reduce(EXCLUDED.str_list, lambda x, y: x || str || y || EXCLUDED.str);

INSERT INTO foo
SELECT 1, 'motorcycle', ['brrr', 'brrrrrr'], 1042
ON CONFLICT DO UPDATE SET
  str = 'black-bellied whistling duck'
  WHERE list_reduce(EXCLUDED.str_list, lambda x, y: x || str || y || EXCLUDED.str) = 'brrrsx||y||ztworldbrrrrrrmotorcycle';

create table tbl (
	a short primary key,
	b short
);

insert into tbl(a, b) values(1, 2);

begin transaction;

insert into tbl(a, b) values(1, 2) on conflict do nothing;

select * from tbl where a = 1;

commit;

insert into tbl (a, b) values (5,4);

select * from tbl order by a;

CREATE TABLE IF NOT EXISTS tbl (id INTEGER PRIMARY KEY, uniq INTEGER, UNIQUE(uniq));

INSERT OR IGNORE INTO tbl VALUES (1, 1), (2, 1);

SELECT uniq FROM tbl;

create or replace table tbl(
	i integer UNIQUE,
	j integer,
	k integer PRIMARY KEY
);

insert into tbl values (3,4,2), (5,3,1);

insert into tbl(k, i) values (2,3), (4,4), (1,8) on conflict (k) do update set j = excluded.j;

create or replace table tbl (a integer primary key, b integer);

insert into tbl VALUES (1,3), (2,2), (3,10), (4,3);

insert into tbl VALUES (3,8), (2,2) ON CONFLICT (a) DO UPDATE SET b = b*2 WHERE b == excluded.b;

INSERT INTO users (id, username, email) VALUES
	(1, 'john_doe', 'john@example.com')
ON CONFLICT (username) DO NOTHING
RETURNING *;

INSERT INTO users (id, username, email)
VALUES (1, 'john_doe', 'john_new@example.com')
ON CONFLICT (id) DO
    UPDATE SET email = EXCLUDED.email
    WHERE EXCLUDED.email != 'john_new@example.com'
RETURNING *;

INSERT INTO users (id, username, email)
VALUES
	(1, 'john_doe', 'john_new@example.com'),
	(2, 'not_john_doe', 'not_john_new@example.com')
ON CONFLICT (id) DO
    UPDATE SET email = EXCLUDED.email
    WHERE EXCLUDED.email != 'john_new@example.com'
RETURNING *;

INSERT INTO users (id, username, email)
VALUES
	(3, 'inner_conflict', 'test'),
	(4, 'a', ''),
	(5, 'b', ''),
	(6, 'c', ''),
	(3, 'inner_conflict', 'test'),
	(7, 'd', ''),
	(8, 'e', ''),
	(9, 'f', ''),
	(3, 'inner_conflict', 'test')
ON CONFLICT (id) DO
    UPDATE SET email = EXCLUDED.email
    WHERE EXCLUDED.email != 'test'
RETURNING *;

INSERT INTO users VALUES
    (3, 'unused_username', 'updated'),
    (3, 'unused_username', 'updated')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
WHERE EXCLUDED.email != 'test'
RETURNING *;

INSERT INTO users VALUES
    (3, 'unused_username', 'test'),
    (3, 'unused_username', 'test')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
WHERE EXCLUDED.email != 'test'
RETURNING *;

SELECT * FROM users ORDER BY id;

insert into tbl VALUES (3,5,1) ON CONFLICT (i) DO UPDATE SET k = 5;

insert into tbl VALUES (3,5,1) ON CONFLICT (i) DO UPDATE SET k = 1 + excluded.k;

create table tbl (a integer, b integer unique);

insert into tbl values (1,2), (2,1);

insert into tbl values (1,2) on conflict do update set a = excluded.a;

insert or ignore into tbl values (1,2), (2,1);

insert or replace into tbl values (5,2), (10,1);

create or replace table tbl (a integer unique, b integer unique);

INSERT INTO tbl VALUES
	(1, 2)
ON CONFLICT (a) DO UPDATE SET b = excluded.b;

INSERT INTO tbl VALUES
	(1, 3)
ON CONFLICT (a) DO UPDATE SET b = excluded.b;

INSERT INTO tbl VALUES
	(2, 1),
	(3, 1),
	(4, 1);

INSERT INTO tbl VALUES
	(2, 1),
	(3, 1),
	(4, 1)
ON CONFLICT (a) DO NOTHING;

INSERT INTO tbl VALUES
	(5, 0);

insert into tbl VALUES
	(5, 0),
	(5, 1)
ON CONFLICT (a) DO UPDATE SET
	b = excluded.b;

INSERT INTO tbl VALUES (6,0);

INSERT INTO tbl VALUES (5,0), (6,0), (7,0) ON CONFLICT (a) DO UPDATE set b = excluded.b;

INSERT INTO tbl VALUES (-1, 0), (5,0), (6,0) ON CONFLICT (a) DO NOTHING;

CREATE OR REPLACE TABLE tbl (a SHORT PRIMARY KEY, b SHORT);

INSERT INTO tbl (select i, 0 from range(2500) tbl(i));

select max(b) from tbl;

INSERT INTO tbl (select i, i from range(2500) tbl(i)) ON CONFLICT (a) DO UPDATE SET b = excluded.b;

create or replace table tbl (
	a integer unique,
	b integer
);

insert into tbl VALUES (3,2), (1,3);

insert into tbl(b) VALUES (5) ON CONFLICT (a) DO UPDATE SET b = 8;
