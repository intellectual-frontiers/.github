CREATE TABLE c(x STRUCT(y INT), y STRUCT(x INT), CHECK (x.y < 10));

INSERT INTO c VALUES ({'y': 1}, {'x': 100});

CREATE TABLE s1(s STRUCT(a INT), CHECK (s.a > 0));

INSERT INTO s1 VALUES ({'a': 1});

CREATE TABLE s2(s STRUCT(a STRUCT(x INT)), CHECK (s2.s.a.x > 0));

INSERT INTO s2 VALUES ({'a': {'x': 1}});

CREATE TABLE t(x STRUCT(y INT), y STRUCT(x INT), z INT);

INSERT INTO t VALUES ({'y': 1}, {'x': 100}, 0);

ALTER TABLE t ALTER z TYPE INT USING x.y;

SELECT z FROM t;

CREATE TABLE rc(a STRUCT(a INT), b STRUCT(a INT), CHECK (b.a > 0));

ALTER TABLE rc RENAME COLUMN a TO c;

INSERT INTO rc VALUES ({'a': -1}, {'a': 1});

CREATE TABLE rq(x INT, CHECK (rq.x > 0));

ALTER TABLE rq RENAME COLUMN x TO y;

CREATE TABLE d.u(x INT, CHECK (u.x > 0));

ALTER TABLE d.u RENAME TO u2;

INSERT INTO d.u2 VALUES (1);

ALTER TABLE d.u2 ADD COLUMN y INT;

CREATE TABLE d.r(x STRUCT(r INT), CHECK (r.x IS NOT NULL));

ALTER TABLE d.r RENAME TO r2;

INSERT INTO d.r2 VALUES ({'r': NULL});

DETACH d;

INSERT INTO d.u2 VALUES (2, 3);

CREATE TABLE tbl(t ROW(t INTEGER) CHECK(t.t=42));

INSERT INTO tbl VALUES ({'t': 42});

DROP TABLE tbl;

CREATE TABLE tbl(t ROW(t INTEGER) CHECK(tbl.t.t=42));

CREATE TABLE integers(i INTEGER CHECK(i < 5));

INSERT INTO integers VALUES (3);

INSERT INTO integers VALUES (NULL);

SELECT * FROM integers;

DROP TABLE integers;

CREATE TABLE integers(i INTEGER CHECK(i + j < 10), j INTEGER);

INSERT INTO integers VALUES (3, 3);

CREATE TABLE integers4(i INTEGER CHECK(integers4.i < 10), j INTEGER);

CREATE TABLE v0 (
    v3 INTEGER,
    v2 INTEGER,
    v4 INTEGER,
    v1 INTEGER,
    CHECK ( ( ( NOT (v2 = v1) = v3 - 0 ) > (18 = 10) ) ),
    CHECK ( v3 = v4 )
);

INSERT INTO v0 (v4) VALUES (2), (1);

UPDATE v0 SET v4 = 44;

SELECT COUNT(*), MIN(v4) FROM v0;

CREATE TABLE v1 (
    a INTEGER,
    b INTEGER,
    c INTEGER,
    CHECK (a = b),
    CHECK (b = c)
);

INSERT INTO v1 VALUES (1, 1, 1);

SELECT a, b, c FROM v1;

CREATE TABLE v2 (
    x INTEGER,
    y INTEGER,
    z INTEGER,
    CHECK (x + y = z)
);

INSERT INTO v2 VALUES (1, 2, 3);

INSERT INTO v2 VALUES (2, 3, 5);

SELECT x, y, z FROM v2 ORDER BY x;

CREATE TABLE v3 (
    id INTEGER,
    payload INTEGER,
    flag BOOLEAN,
    CHECK (flag IS NOT NULL)
);

INSERT INTO v3 VALUES (1, 42, TRUE);

UPDATE v3 SET payload = 99;

SELECT id, payload, flag FROM v3;

CREATE TABLE v_char (
    username VARCHAR,
    status   VARCHAR,
    CHECK (length(username) >= 3),
    CHECK (status IN ('active', 'inactive'))
);

INSERT INTO v_char VALUES ('alice', 'active');

UPDATE v_char SET status = 'inactive' WHERE username = 'alice';

SELECT username, status FROM v_char;

CREATE TABLE t(i INTEGER, j INTEGER, k INTEGER);

ALTER TABLE t ADD UNIQUE(i) DEFERRED;

ALTER TABLE t ADD PRIMARY KEY(j) DEFERRED;

ALTER TABLE t ADD UNIQUE(k) IMMEDIATE;

SELECT constraint_text FROM duckdb_constraints() WHERE table_name = 't' AND constraint_type <> 'NOT NULL';

CREATE TABLE t(a INTEGER UNIQUE, b INTEGER UNIQUE IMMEDIATE, c INTEGER PRIMARY KEY IMMEDIATE);

SELECT sql FROM duckdb_tables() WHERE table_name = 't';

INSERT INTO t VALUES (1, 2, 3);

CREATE TABLE t1(i INTEGER UNIQUE, j INTEGER PRIMARY KEY);

INSERT INTO t1 VALUES (1, 2);

CREATE TABLE t2(i INTEGER, j INTEGER);

ALTER TABLE t2 ADD UNIQUE(i);

ALTER TABLE t2 ADD PRIMARY KEY(j);

CREATE TEMP TABLE t3(i INTEGER UNIQUE IMMEDIATE, j INTEGER);

ALTER TABLE t3 ADD PRIMARY KEY(j) IMMEDIATE;

ATTACH ':memory:' AS mem;

CREATE TABLE mem.t(i INTEGER UNIQUE IMMEDIATE, j INTEGER);

ALTER TABLE mem.t ADD PRIMARY KEY(j) IMMEDIATE;

CREATE TABLE db.t(i INTEGER UNIQUE IMMEDIATE, j INTEGER);

ALTER TABLE db.t ADD PRIMARY KEY(j) IMMEDIATE;

INSERT INTO t1 VALUES (3, 4);

SELECT count(*) FROM t1;

SELECT constraint_text FROM duckdb_constraints() WHERE table_name = 't2' AND constraint_type <> 'NOT NULL';

CREATE TABLE with_duplicates(i INTEGER);

INSERT INTO with_duplicates VALUES (1), (1);

CREATE TABLE without_duplicates(i INTEGER);

INSERT INTO without_duplicates VALUES (1), (2);

ALTER TABLE without_duplicates ADD UNIQUE(i) DEFERRED;

BEGIN TRANSACTION;

INSERT INTO without_duplicates VALUES (2);

CREATE TABLE altered_in_transaction(i INTEGER);

INSERT INTO altered_in_transaction VALUES (1);

INSERT INTO altered_in_transaction VALUES (2);

ALTER TABLE altered_in_transaction ADD UNIQUE(i) DEFERRED;

DELETE FROM altered_in_transaction WHERE i = 1;

COMMIT;

SELECT i FROM altered_in_transaction;

CREATE TABLE local_duplicates(i INTEGER);

INSERT INTO local_duplicates VALUES (1), (1);

ALTER TABLE local_duplicates ADD UNIQUE(i) DEFERRED;

INSERT INTO local_duplicates VALUES (1);

SELECT count(*) FROM local_duplicates;

INSERT INTO local_duplicates VALUES (2), (2);

DELETE FROM local_duplicates WHERE rowid = (SELECT max(rowid) FROM local_duplicates);

SELECT i FROM local_duplicates;

CREATE TABLE local_nulls(i INTEGER);

INSERT INTO local_nulls VALUES (NULL);

ROLLBACK;

CREATE TABLE deleted_before_alter(i INTEGER);

INSERT INTO deleted_before_alter VALUES (1);

DELETE FROM deleted_before_alter WHERE i = 1;

ALTER TABLE deleted_before_alter ADD UNIQUE(i) DEFERRED;

CREATE TABLE add_column(i INTEGER PRIMARY KEY DEFERRED, j INTEGER);

CREATE TABLE alter_type(i INTEGER PRIMARY KEY DEFERRED, j INTEGER);

CREATE TABLE drop_column(i INTEGER PRIMARY KEY DEFERRED, j INTEGER);

INSERT INTO add_column VALUES (1, 10);

INSERT INTO alter_type VALUES (1, 10);

INSERT INTO drop_column VALUES (1, 10);

BEGIN;

INSERT INTO add_column VALUES (2, 20), (2, 21);

ALTER TABLE add_column ADD COLUMN k INTEGER;

DELETE FROM add_column WHERE i = 1;

INSERT INTO add_column VALUES (1, 11, 0);

INSERT INTO alter_type VALUES (2, 20), (2, 21);

ALTER TABLE alter_type ALTER j TYPE BIGINT;

DELETE FROM alter_type WHERE i = 1;

INSERT INTO alter_type VALUES (1, 11);

INSERT INTO drop_column VALUES (2, 20), (2, 21);

ALTER TABLE drop_column DROP COLUMN j;

DELETE FROM drop_column WHERE i = 1;

INSERT INTO drop_column VALUES (1);

SELECT (SELECT count(*) FROM add_column), (SELECT count(*) FROM alter_type), (SELECT count(*) FROM drop_column);

CREATE TABLE parent(i INTEGER PRIMARY KEY DEFERRED, j INTEGER UNIQUE DEFERRED);

CREATE TABLE mixed(i INTEGER UNIQUE DEFERRED, j INTEGER UNIQUE);

INSERT INTO mixed VALUES (1, 1);

INSERT INTO mixed VALUES (2, 1) ON CONFLICT (j) DO NOTHING;

SELECT count(*) FROM mixed;

INSERT INTO mixed VALUES (2, 2) ON CONFLICT (j) DO NOTHING;

INSERT INTO mixed VALUES (3, 2) ON CONFLICT (j) DO UPDATE SET i = 3;

SELECT i, j FROM mixed;

INSERT INTO mixed VALUES (1, 3) ON CONFLICT (j) DO NOTHING;

DELETE FROM mixed WHERE j = 1;

CREATE TABLE t(i INTEGER PRIMARY KEY DEFERRED, j INTEGER);

INSERT INTO t VALUES (1, 10), (2, 20);

SELECT i, j FROM t;

DELETE FROM t WHERE i = 1;

INSERT INTO t VALUES (1, 11), (1, 12);

INSERT INTO t VALUES (1, 11);

INSERT INTO t VALUES (1, 12);

INSERT INTO t VALUES (1, 13);

INSERT INTO t VALUES (1, 15), (1, 16);

DELETE FROM t WHERE j = 16;

UPDATE t SET i = CASE i WHEN 1 THEN 2 WHEN 2 THEN 1 ELSE i END;

UPDATE t SET i = i + 1;

CREATE TABLE p(a INTEGER PRIMARY KEY, b INTEGER UNIQUE IMMEDIATE, c INTEGER UNIQUE DEFERRED, d INTEGER CHECK (d > 0));

CREATE TABLE q(i INTEGER PRIMARY KEY DEFERRED, j INTEGER);

ALTER TABLE q ADD UNIQUE(j) DEFERRED;

CREATE TABLE child(x INTEGER REFERENCES p(a));

SELECT table_name, constraint_text, constraint_check_mode FROM duckdb_constraints()
WHERE constraint_type IN ('PRIMARY KEY', 'UNIQUE');

SELECT count(*) FROM duckdb_constraints() WHERE constraint_check_mode <> 'DEFAULT' AND constraint_type NOT IN ('PRIMARY KEY', 'UNIQUE');

SELECT table_name, constraint_type, is_deferrable, initially_deferred FROM information_schema.table_constraints
WHERE constraint_type IN ('PRIMARY KEY', 'UNIQUE');

SELECT conname, contype, condeferrable, condeferred FROM pg_constraint WHERE contype IN ('p', 'u');

SET checkpoint_threshold = '10.0 GB';

PRAGMA disable_checkpoint_on_shutdown;

CREATE TABLE checkpointed(i INTEGER PRIMARY KEY DEFERRED);

CREATE TABLE altered(i INTEGER);

CHECKPOINT;

ALTER TABLE altered ADD UNIQUE(i) DEFERRED;

CREATE TABLE created(i INTEGER, j VARCHAR, PRIMARY KEY(i, j) DEFERRED);

INSERT INTO checkpointed VALUES (1);

INSERT INTO altered VALUES (1);

INSERT INTO created VALUES (1, 'a');

DELETE FROM altered WHERE i = 1;

SELECT constraint_text FROM duckdb_constraints()
WHERE table_name IN ('checkpointed', 'altered', 'created') AND constraint_type <> 'NOT NULL';

SELECT count(*) FROM checkpointed WHERE i = 1;

SELECT count(*) FROM altered WHERE i = 1;

SELECT count(*) FROM created;

SELECT count(*) FROM altered;

CREATE TABLE composite(i INTEGER, s VARCHAR, PRIMARY KEY(i, s) DEFERRED);

INSERT INTO composite VALUES (1, 'a'), (1, 'b'), (2, 'a'), (1, 'a');

SELECT count(*) FROM composite WHERE i = 1 AND s = 'a';

INSERT INTO composite VALUES (1, 'a'), (1, 'b'), (2, 'a'), (1, 'a long string that is not inlined');

SELECT count(*) FROM composite;

CREATE TABLE nulls(i INTEGER UNIQUE DEFERRED);

INSERT INTO nulls VALUES (NULL), (NULL), (1);

INSERT INTO nulls VALUES (NULL);

SELECT count(*) FROM nulls;

CREATE TEMPORARY TABLE temp_t(i INTEGER PRIMARY KEY DEFERRED);

INSERT INTO temp_t VALUES (1), (1);

DELETE FROM temp_t WHERE rowid = (SELECT min(rowid) FROM temp_t);

PREPARE insert_t AS INSERT INTO t VALUES ($1, $2) RETURNING i, j;

EXECUTE insert_t(1, 10);

EXECUTE insert_t(1, 20);

UPDATE t SET i = 2 WHERE j = 20 RETURNING i, j;

MERGE INTO t USING (VALUES (1, 11), (3, 30), (4, 40)) s(i, j) ON t.j = s.j - 1
WHEN MATCHED THEN UPDATE SET i = 3
WHEN NOT MATCHED THEN INSERT VALUES (s.i, s.j);

SELECT count(*) FROM t WHERE i = 3;

MERGE INTO t USING (VALUES (30)) s(j) ON t.j = s.j
WHEN MATCHED THEN DELETE;

SELECT count(*) FROM t;

CREATE TABLE both_timings(i INTEGER, UNIQUE(i) DEFERRED, PRIMARY KEY(i));

INSERT INTO both_timings VALUES (1);

CREATE TABLE both_child(i INTEGER REFERENCES both_timings(i));

INSERT INTO both_child VALUES (1);

INSERT INTO both_timings VALUES (1) ON CONFLICT (i) DO NOTHING;

SELECT count(*) FROM both_timings;

CREATE TABLE t(i INTEGER UNIQUE DEFERRED);

DROP TABLE t;

CREATE TABLE t(i INTEGER PRIMARY KEY DEFERRED);

CREATE TABLE t(i INTEGER, UNIQUE(i) DEFERRED);

CREATE TABLE t(i INTEGER, PRIMARY KEY(i) DEFERRED);

CREATE TABLE t(i INTEGER UNIQUE IMMEDIATE, j INTEGER PRIMARY KEY IMMEDIATE);

CREATE TABLE t(i INTEGER, j INTEGER, UNIQUE(i) IMMEDIATE, PRIMARY KEY(j) IMMEDIATE);

RESET debug_verify_statement;

CREATE TABLE target(id INTEGER);

CREATE TABLE log(id INTEGER PRIMARY KEY DEFERRED);

CREATE TRIGGER log_inserts AFTER INSERT ON target
REFERENCING NEW TABLE AS inserted
FOR EACH STATEMENT
    INSERT INTO log SELECT id FROM inserted;

INSERT INTO target VALUES (1), (2);

SELECT count(*) FROM target;

INSERT INTO target VALUES (1);

SELECT count(*) FROM log WHERE id = 1;

DELETE FROM log WHERE rowid = (SELECT min(rowid) FROM log WHERE id = 1);

SELECT id FROM target;

SELECT id FROM log;

CREATE TABLE t(i INTEGER PRIMARY KEY DEFERRED, j INTEGER UNIQUE DEFERRED);

INSERT INTO t VALUES (1, 10), (1, 20);

SELECT count(*) FROM t WHERE i = 1;

INSERT INTO t VALUES (3, 20);

SELECT count(*) FROM t WHERE i = 4;

CREATE TABLE immediate(i INTEGER UNIQUE IMMEDIATE);

INSERT INTO immediate VALUES (1);

CREATE TABLE B (b1 INTEGER,
b2 INTEGER,
PRIMARY KEY(b1, b2));

CREATE TABLE A (a1 VARCHAR(1),
a2 VARCHAR(1),
a3 VARCHAR(1),
a4 VARCHAR(1),
a5 INTEGER,
a6 INTEGER,
PRIMARY KEY(a1, a2),
UNIQUE(a3, a4),
FOREIGN KEY (a5, a6) REFERENCES B(b1, b2));

INSERT INTO B (b1, b2) VALUES
(1, 2),
(2, 3),
(6, 7);

CREATE TABLE C (
    c1 INTEGER,
    c2 INTEGER,
    c3 VARCHAR(1),
    c4 VARCHAR(1),
    PRIMARY KEY (c1, c2),
    UNIQUE (c3, c4)
);

CREATE TABLE D (
    d1 INTEGER,
    d2 INTEGER,
    d3 VARCHAR(1),
    d4 VARCHAR(1),
    payload INTEGER,
    FOREIGN KEY (d1, d2) REFERENCES C (c1, c2),
    FOREIGN KEY (d3, d4) REFERENCES C (c3, c4)
);

INSERT INTO C VALUES
(0, 1, 'a', 'b'),
(1, 0, 'a', 'c'),
(2, 2, 'd', 'e');

INSERT INTO D VALUES
(0, 1, 'a', 'b', 10),
(1, 0, 'a', 'c', 20),
(2, 2, 'd', 'e', 30);

CREATE TABLE fk_19990_reference (
    reference_id BIGINT PRIMARY KEY
);

INSERT INTO fk_19990_reference VALUES (1), (2);

CREATE TABLE fk_19990_data (
    data_id INTEGER PRIMARY KEY,
    reference_id BIGINT,
    FOREIGN KEY (reference_id) REFERENCES fk_19990_reference (reference_id)
);

CREATE TABLE fk_19990_temp_data AS
    SELECT *
    FROM (VALUES (1, 1), (2, 3)) AS t(data_id, reference_id);

CREATE TABLE fk_local_p(id INT PRIMARY KEY);

CREATE TABLE fk_local_c(pid INT, FOREIGN KEY (pid) REFERENCES fk_local_p(id));

INSERT INTO fk_local_p VALUES (10), (20);

CREATE SCHEMA freddy;

SET schema = freddy;

CREATE TABLE zippy(
    id INTEGER PRIMARY KEY
);

CREATE TABLE george(
    zippy_id INTEGER,
    FOREIGN KEY (zippy_id) REFERENCES zippy(id)
);

INSERT INTO zippy VALUES (1);

INSERT INTO george VALUES (1);

SELECT constraint_text
FROM duckdb_constraints()
WHERE table_name = 'george'
  AND constraint_type = 'FOREIGN KEY';

SET schema = main;

CREATE TABLE zippy_main(
    id INTEGER PRIMARY KEY
);

CREATE TABLE george_main(
    zippy_id INTEGER,
    FOREIGN KEY (zippy_id) REFERENCES zippy_main(id)
);

SELECT constraint_text
FROM duckdb_constraints()
WHERE table_name = 'george_main'
  AND constraint_type = 'FOREIGN KEY';

CREATE TABLE tf_1 (
  a integer, b integer, c integer,
  PRIMARY KEY (a),
  UNIQUE (b),
  UNIQUE (c)
);

CREATE TABLE tf_2 (
  d integer, e integer, f integer,
  FOREIGN KEY (d) REFERENCES tf_1 (a),
  FOREIGN KEY (e) REFERENCES tf_1 (b),
  FOREIGN KEY (f) REFERENCES tf_1 (c)
);

INSERT INTO tf_1 VALUES (1, 1, 1);

INSERT INTO tf_2 VALUES (1, 1, 1);

INSERT INTO tf_1 VALUES (2, NULL, NULL);

INSERT INTO tf_2 VALUES (2, NULL, NULL);

DELETE FROM tf_2 WHERE d=2;

DELETE FROM tf_1 WHERE a=2;

INSERT INTO tf_1 VALUES (2, 3, NULL);

INSERT INTO tf_2 VALUES (1, 3, 1);

DELETE FROM tf_2 WHERE d=2 OR e=3;

INSERT INTO tf_1 VALUES (2, NULL, 4);

INSERT INTO tf_2 VALUES (1, 1, 4);

create table x (c1 integer, primary key (c1));

create table y (c1 integer, foreign key (c1) references x (c1));

select count(*) from duckdb_constraints() where constraint_type = 'NOT NULL';

CREATE TABLE parent(id INTEGER PRIMARY KEY, val TEXT);

CREATE TABLE child(id INTEGER, pid INTEGER REFERENCES parent(id));

INSERT INTO parent VALUES (1, 'a'), (2, 'b');

INSERT INTO child VALUES (10, 1);

ALTER TABLE child ADD COLUMN extra INTEGER;

ALTER TABLE child RENAME COLUMN extra TO extra2;

ALTER TABLE child ALTER COLUMN extra2 SET DEFAULT 5;

UPDATE child SET extra2 = 0 WHERE extra2 IS NULL;

ALTER TABLE child ALTER COLUMN extra2 SET NOT NULL;

ALTER TABLE child ALTER COLUMN extra2 DROP DEFAULT;

INSERT INTO child VALUES (11, 2, 7);

SELECT count(*) FROM child;

CREATE TABLE selfref(id INTEGER PRIMARY KEY, pid INTEGER REFERENCES selfref(id));

ALTER TABLE selfref ADD COLUMN x INTEGER;

INSERT INTO selfref VALUES (1, NULL, 9);

CREATE TABLE fkdb.parent(id INTEGER PRIMARY KEY, val TEXT);

CREATE TABLE fkdb.child(id INTEGER, pid INTEGER REFERENCES parent(id));

ALTER TABLE fkdb.child ADD COLUMN extra INTEGER;

CHECKPOINT fkdb;

DETACH fkdb;

INSERT INTO fkdb.parent VALUES (1, 'a');

INSERT INTO fkdb.child VALUES (10, 1, 5);

create table a (a int not null, constraint pk_a primary key (A));

create table b (a int references a (a));

drop table b;

drop table a;

create table a (i int primary key);

create table b (i int references A (i));

create table c (i int primary key, j int references C (i));

create table b (i int references a);

insert into a values (1);

insert into b values (1);

create table a (i int);

create table a (i int, j int, primary key(i,j));

CREATE TABLE t(id INT PRIMARY KEY, parent INT REFERENCES t(id));

SELECT constraint_type, constraint_text
FROM duckdb_constraints()
WHERE table_name = 't' AND constraint_type = 'FOREIGN KEY';

CREATE TABLE agency (
	agency_id TEXT PRIMARY KEY,
	agency_name TEXT UNIQUE NOT NULL
);

CREATE TABLE routes (
	route_id TEXT PRIMARY KEY,
	agency_id TEXT,
	FOREIGN KEY (agency_id) REFERENCES agency
);

INSERT INTO agency VALUES (1, 1);

INSERT INTO routes VALUES (1, 1);

DROP TABLE routes;

DROP TABLE agency;

CREATE TABLE agency (
	agency_id TEXT,
	agency_name TEXT NOT NULL
);

CREATE TABLE routes (
	route_id TEXT PRIMARY KEY,
	agency_id TEXT,
	FOREIGN KEY (agency_id) REFERENCES routes
);

INSERT INTO routes VALUES (1, NULL);

INSERT INTO routes VALUES (2, 1);

CREATE TABLE agency (
	agency_id TEXT,
	agency_id_2 TEXT,
	agency_name TEXT NOT NULL,
	PRIMARY KEY (agency_id, agency_id_2)
);

CREATE TABLE routes (
	route_id TEXT PRIMARY KEY,
	agency_id TEXT,
	FOREIGN KEY (route_id, agency_id) REFERENCES agency
);

CREATE TABLE t1(id INTEGER PRIMARY KEY);

CREATE TABLE t2(id INTEGER PRIMARY KEY, t1_id INTEGER, FOREIGN KEY (t1_id) REFERENCES t1(id));

CREATE TABLE t3(id INTEGER PRIMARY KEY, t1_id INTEGER, FOREIGN KEY (t1_id) REFERENCES t1(id) ON UPDATE NO ACTION);

CREATE TABLE t4(id INTEGER PRIMARY KEY, t1_id INTEGER, FOREIGN KEY (t1_id) REFERENCES t1(id) ON DELETE NO ACTION);

CREATE TABLE t5(id INTEGER PRIMARY KEY, t1_id INTEGER, FOREIGN KEY (t1_id) REFERENCES t1(id) ON UPDATE RESTRICT);

CREATE TABLE t6(id INTEGER PRIMARY KEY, t1_id INTEGER, FOREIGN KEY (t1_id) REFERENCES t1(id) ON DELETE RESTRICT);

CREATE TABLE departments (
    department_id INTEGER PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    employee_id INTEGER PRIMARY KEY,
    employee_name VARCHAR(100) NOT NULL,
    department_id INT REFERENCES departments(department_id)
);

ALTER TABLE employees RENAME TO old_employees;

CREATE TABLE t1(i1 INTEGER UNIQUE);

INSERT INTO t1 VALUES (1), (2), (3), (4);

CREATE TABLE t2(i2 INTEGER PRIMARY KEY, FOREIGN KEY (i2) REFERENCES t1(i1));

INSERT INTO t2 VALUES (1), (2), (3);

CREATE TABLE t3(i3 INTEGER UNIQUE, FOREIGN KEY (i3) REFERENCES t2(i2));

INSERT INTO t3 VALUES (1), (2);

CREATE TABLE t4(i4 INTEGER, FOREIGN KEY (i4) REFERENCES t3(i3));

INSERT INTO t4 VALUES (1);

INSERT INTO t2 VALUES (4);

INSERT INTO t3 VALUES (3);

INSERT INTO t4 VALUES (2);

DELETE FROM t2 WHERE i2=4;

DELETE FROM t3 WHERE i3=3;

DELETE FROM t4 WHERE i4=2;

DROP TABLE t4;

DROP TABLE t3;

DROP TABLE t2;

DROP TABLE t1;

CREATE TABLE composite_pk(a INTEGER, b INTEGER, PRIMARY KEY(a, b));

CREATE TABLE single_pk(a INTEGER PRIMARY KEY, b INTEGER);

CREATE TABLE child(x INTEGER REFERENCES single_pk(a));

CREATE TABLE parent (id INTEGER PRIMARY KEY);

INSERT INTO parent VALUES (1), (2);

CREATE TABLE child (fk INTEGER REFERENCES parent(id));

CREATE OR REPLACE TABLE child (fk INTEGER);

DELETE FROM parent WHERE id = 1;

DROP TABLE parent;

DROP TABLE child;

CREATE OR REPLACE TABLE child (fk INTEGER REFERENCES parent(id));

CREATE OR REPLACE TABLE child AS SELECT 1 AS fk;

create type custom_type as integer;

create table parent (
	id custom_type primary key
);

create table child (
	parent custom_type references parent
);

create table child (
	parent integer references parent
);

create type another_custom_type as integer;

create table child (
	parent another_custom_type references parent
);

CREATE SCHEMA s1;

CREATE SCHEMA s2;

CREATE TABLE s1.pk_integers(i INTEGER PRIMARY KEY);

INSERT INTO s1.pk_integers VALUES (1), (2), (3);

SET storage_compatibility_version = 'v0.10.3';

USE fk_db;

CREATE TABLE tbl_pk (i INT PRIMARY KEY, payload STRUCT(v VARCHAR, i INTEGER[]));

INSERT INTO tbl_pk VALUES (1, {'v': 'hello', 'i': [42]}), (2, {'v': 'world', 'i': [43]});

CREATE TABLE tbl_fk (i INT REFERENCES tbl_pk(i));

INSERT INTO tbl_fk VALUES (1), (1), (1);

USE other_fk_db;

CHECKPOINT fk_db;

DETACH fk_db;

CREATE TABLE pk_integers(i INTEGER PRIMARY KEY);

CREATE TABLE fk_integers(j INTEGER, FOREIGN KEY (j) REFERENCES pk_integers(i));

INSERT INTO pk_integers VALUES (1), (2), (3);

INSERT INTO fk_integers VALUES (1), (2);

DROP TABLE fk_integers;

DROP TABLE pk_integers;

INSERT INTO fk_integers VALUES (3);

DELETE FROM fk_integers WHERE j=3;

DELETE FROM pk_integers WHERE i=3;

CREATE TABLE parent (id INT PRIMARY KEY);

CREATE TABLE child (
    parent_id INT REFERENCES parent(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
);

CREATE TABLE sibling (
    parent_id INT REFERENCES parent(id)
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

CREATE TABLE cousin (
    parent_id INT,
    FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE TABLE nephew (
    parent_id INT,
    FOREIGN KEY (parent_id) REFERENCES parent(id) ON UPDATE RESTRICT ON DELETE NO ACTION
);

CREATE TABLE pkt1(
	i1 INTEGER PRIMARY KEY CHECK(i1 < 3),
	j1 INTEGER UNIQUE
);

CREATE TABLE pkt2(
	i2 INTEGER PRIMARY KEY,
	j2 INTEGER UNIQUE CHECK (j2 > 1000)
);

CREATE TABLE fkt1(
	k1 INTEGER,
	l1 INTEGER,
	FOREIGN KEY(k1) REFERENCES pkt1(i1),
	FOREIGN KEY(l1) REFERENCES pkt2(i2)
);

CREATE TABLE fkt2(
	k2 INTEGER,
	l2 INTEGER,
	FOREIGN KEY(k2) REFERENCES pkt1(j1),
	FOREIGN KEY(l2) REFERENCES pkt2(j2)
);

INSERT INTO pkt1 VALUES (1, 11), (2, 12);

INSERT INTO pkt2 VALUES (101, 1001), (102, 1002);

INSERT INTO fkt1 VALUES (1, 102), (2, 101);

INSERT INTO fkt2 VALUES (12, 1001), (11, 1002);

DELETE FROM fkt1 WHERE k1=1;

DELETE FROM fkt2 WHERE k2=11;

DELETE FROM pkt1 WHERE i1=1;

SELECT * FROM pkt1;

SELECT * FROM pkt2;

SELECT * FROM fkt1;

SELECT * FROM fkt2;

UPDATE pkt2 SET i2=103, j2=1003 WHERE i2=102;

DELETE FROM fkt1 WHERE k1=2;

DELETE FROM fkt2 WHERE k2=12;

UPDATE pkt1 SET i1=1, j1=11 WHERE i1=2;

UPDATE pkt2 SET i2=104, j2=1004 WHERE i2=101;

DROP TABLE fkt2;

DROP TABLE fkt1;

DROP TABLE pkt1;

DROP TABLE pkt2;

CREATE TABLE vdata AS SELECT * FROM (VALUES ('v2',)) v(id);

CREATE VIEW v AS SELECT * FROM vdata;

CREATE TABLE primary_table (id INT PRIMARY KEY);

CREATE TABLE secondary_table (primary_id INT, FOREIGN KEY (primary_id) REFERENCES primary_table(id));

INSERT INTO primary_table VALUES (42);

INSERT INTO pk_integers VALUES (1);

INSERT INTO pk_integers VALUES (1), (2);

INSERT INTO fk_integers VALUES (2);

CREATE TABLE self_ref(id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES self_ref(id));

INSERT INTO self_ref VALUES (1, NULL);

INSERT INTO self_ref VALUES (2, 1);

DROP TABLE self_ref;

CREATE TABLE employee(
	id INTEGER PRIMARY KEY,
	managerid INTEGER,
	name VARCHAR,
	FOREIGN KEY(managerid) REFERENCES employee(id));

INSERT INTO employee VALUES (1, NULL, 'Smith'), (2, NULL, 'Jhon'), (3, NULL, 'Romeo');

INSERT INTO employee VALUES (4, 2, 'Mark');

DELETE FROM employee WHERE id = 4;

SELECT * FROM employee ORDER BY ALL;

UPDATE employee SET name = 'Juliet' WHERE id = 3;

UPDATE employee SET id = 4 WHERE id = 3;

UPDATE employee SET managerid = 2 WHERE id = 4;

UPDATE employee SET id = 5, managerid = 2 WHERE id = 4;

SELECT * FROM employee WHERE managerid = 2;

ALTER TABLE employee RENAME COLUMN name TO name_new;

ALTER TABLE employee ALTER COLUMN name_new SET DATA TYPE TEXT;

ALTER TABLE employee DROP COLUMN name_new;

DROP TABLE employee;

CREATE TEMPORARY TABLE album (artistid INTEGER, albumname TEXT, albumcover TEXT, UNIQUE (artistid, albumname));

INSERT INTO album VALUES (1, 'A', 'A_cover'), (2, 'B', 'B_cover'), (3, 'C', 'C_cover'), (4, 'D', 'D_cover');

CREATE TEMPORARY TABLE song (songid INTEGER, songartist INTEGER, songalbum TEXT, songname TEXT,
FOREIGN KEY (songartist, songalbum) REFERENCES album (artistid, albumname));

INSERT INTO song VALUES (11, 1, 'A', 'A_song'), (12, 2, 'B', 'B_song'), (13, 3, 'C', 'C_song');

DELETE FROM album WHERE albumname = 'D';

SELECT * FROM album ORDER BY ALL;

UPDATE song SET songartist = 1, songalbum = 'A' WHERE songname = 'B_song';

SELECT * FROM song ORDER BY ALL;

UPDATE album SET artistid=5, albumname='D' WHERE albumcover='B_cover';

SELECT * FROM album;

UPDATE album SET albumcover='C_cover_new' WHERE artistid=3;

UPDATE song SET songname='C_song_new' WHERE songartist=3;

SELECT * FROM song;

ALTER TABLE song RENAME COLUMN songname TO songname_new;

ALTER TABLE song ALTER COLUMN songname_new SET DATA TYPE VARCHAR;

ALTER TABLE song DROP COLUMN songname_new;

DROP TABLE song;

ALTER TABLE album RENAME COLUMN albumname TO albumname_new;

ALTER TABLE album ALTER COLUMN albumcover SET DATA TYPE VARCHAR;

ALTER TABLE album DROP COLUMN albumcover;

DROP TABLE album;

CREATE TABLE pkt(i INTEGER UNIQUE, k INTEGER UNIQUE);

INSERT INTO pkt VALUES (1, 11), (2, 12), (3, 13);

CREATE TABLE fkt(j INTEGER, l INTEGER UNIQUE, FOREIGN KEY (j) REFERENCES pkt(i));

CREATE INDEX k_index ON pkt(k);

CREATE INDEX l_index ON fkt(l);

INSERT INTO fkt VALUES (1, 101), (2, 102);

INSERT INTO fkt VALUES (3, 103);

DELETE FROM fkt WHERE l=103;

DELETE FROM pkt WHERE k=13;

DROP INDEX k_index;

DROP INDEX l_index;

DROP TABLE fkt;

DROP TABLE pkt;

CREATE TABLE s1.pkt(i INTEGER PRIMARY KEY);

CREATE TABLE s1.fkt(j INTEGER, FOREIGN KEY (j) REFERENCES s1.pkt(i));

INSERT INTO s1.pkt VALUES (1), (2), (3), (4), (5);

INSERT INTO s1.fkt VALUES (2), (3);

INSERT INTO s1.fkt VALUES (1);

DELETE FROM s1.pkt WHERE i=5;

DROP TABLE s1.fkt;

DROP TABLE s1.pkt;

CREATE TABLE pkt(i INTEGER UNIQUE);

CREATE TABLE fkt(j INTEGER, FOREIGN KEY (j) REFERENCES pkt(i));

INSERT INTO fkt VALUES (NULL);

CREATE TABLE pkt(i INTEGER PRIMARY KEY);

INSERT INTO pkt VALUES (1);

INSERT INTO fkt VALUES (1);

INSERT INTO pkt VALUES (2);

DELETE FROM pkt WHERE i = 1;

INSERT INTO fkt VALUES (1), (2);

DELETE FROM fkt WHERE j = 1;

DELETE FROM fkt WHERE j = 2;

DELETE FROM pkt WHERE i = 2;

INSERT INTO pkt VALUES (3);

DELETE FROM pkt WHERE i = 3;

CREATE TABLE a(i INTEGER PRIMARY KEY);

CREATE TABLE b(j INTEGER, FOREIGN KEY (j) REFERENCES a(i));

INSERT INTO a VALUES (1), (2);

INSERT INTO b VALUES (1), (2);

DELETE FROM b;

DELETE FROM a;

CREATE TABLE cross_fk_parent(id INTEGER PRIMARY KEY);

CREATE TABLE cross_fk_child(pid INTEGER, FOREIGN KEY (pid) REFERENCES cross_fk_parent(id));

INSERT INTO cross_fk_parent VALUES (1);

DELETE FROM cross_fk_parent WHERE id = 1;

SELECT count(*) FROM cross_fk_parent;

SELECT count(*) FROM cross_fk_child;

DROP TABLE cross_fk_child;

DROP TABLE cross_fk_parent;

USE db1;

CREATE TABLE IF NOT EXISTS t1 (
  cache_key VARCHAR PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
);

CREATE TABLE IF NOT EXISTS t2 (
  cache_key VARCHAR NOT NULL,
  dose DOUBLE NOT NULL,
  PRIMARY KEY (cache_key, dose),
  FOREIGN KEY (cache_key) REFERENCES t1 (cache_key)
);

ATTACH ':memory:' AS other;

USE other;

DETACH db1;

CREATE TABLE album(artistid INTEGER, albumname TEXT, albumcover TEXT, UNIQUE (artistid, albumname));

CREATE TABLE song(songid INTEGER, songartist INTEGER, songalbum TEXT, songname TEXT, FOREIGN KEY(songartist, songalbum) REFERENCES album(artistid, albumname));

DELETE FROM album WHERE albumname='D';

UPDATE song SET songartist=1, songalbum='A' WHERE songname='B_song';

CREATE TABLE fkt(
	j INTEGER,
	l INTEGER UNIQUE,
	FOREIGN KEY (j) REFERENCES pkt(i)
);

CREATE TABLE t (id INT PRIMARY KEY, parent INT REFERENCES t (id));

INSERT INTO t VALUES (1, NULL);

INSERT INTO t VALUES (2, 1), (3, 1);

CREATE TABLE integers(i INTEGER, j BOOLEAN, PRIMARY KEY(i, j));

INSERT INTO integers VALUES (1, false), (1, true), (2, false);

INSERT INTO integers VALUES (2, true);

SELECT * FROM integers ORDER BY 1, 2;

CREATE TABLE numbers(a integer, b integer, c integer, d integer, e integer, PRIMARY KEY(a,b));

INSERT INTO numbers VALUES (1,1,1,1,1),(1,2,1,1,1),(2,1,2,1,1),(2,2,2,2,2);

INSERT INTO numbers VALUES (1,5,1,1,4);

UPDATE numbers SET c=1 WHERE c=2;

UPDATE numbers SET b=3 WHERE b=2;

SELECT * FROM integers ORDER BY i;

CREATE TABLE numbers(a integer, b integer, c integer, d integer, e integer, PRIMARY KEY(a,b,c,d,e));

INSERT INTO numbers VALUES (1,1,1,1,1),(1,2,1,1,1),(1,1,2,1,1),(2,2,2,2,2);

INSERT INTO numbers VALUES (1,1,1,1,4);

CREATE TABLE integers(i INTEGER, j VARCHAR, PRIMARY KEY(i, j));

INSERT INTO integers VALUES (3, 'hello'), (3, 'world');

INSERT INTO integers VALUES (6, 'bla');

CREATE TABLE tst(a varchar, b varchar,PRIMARY KEY(a,b));

INSERT INTO tst VALUES ('hell', 'hello'), ('hello','hell'), ('hel','hell'), ('hell','hel');

INSERT INTO tst VALUES ('hel', 'hello');

UPDATE tst SET b='hell' WHERE b='hel';

CREATE TABLE integers(i INTEGER PRIMARY KEY);

INSERT INTO integers VALUES (1);

CREATE TABLE numbers(i varchar PRIMARY KEY, j INTEGER);

INSERT INTO numbers VALUES ('1', 4), ('2', 5);

SELECT * FROM numbers;

INSERT INTO numbers VALUES ('6', 6);

CREATE TABLE test (a INTEGER PRIMARY KEY, b INTEGER);

INSERT INTO test VALUES (11, 1), (12, 2), (13, 3);

UPDATE test SET b=2 WHERE b=3;

SELECT * FROM test;

DELETE FROM test WHERE a=11;

SELECT * FROM test ORDER BY a;

INSERT INTO test VALUES (11, 1);

UPDATE test SET a=4 WHERE b=1;

UPDATE integers SET i=33;

INSERT INTO integers VALUES (33);

CREATE TABLE test (a INTEGER, b VARCHAR, PRIMARY KEY(a, b));

INSERT INTO test VALUES (11, 'hello'), (12, 'world'), (13, 'blablabla');

UPDATE test SET b = 'pandas';

SELECT * FROM test ORDER BY ALL;

UPDATE test SET a = a + 3;

UPDATE test SET a = a - 3;

DELETE FROM test WHERE a = 12;

INSERT INTO test VALUES (12, 'pandas');

INSERT INTO test VALUES (12, 'other pandas');

UPDATE test SET a = 4 WHERE a = 42;

UPDATE test SET a = 4 WHERE a = 12;

CREATE TABLE integers(i INTEGER PRIMARY KEY, j INTEGER);

INSERT INTO integers VALUES (3, 4), (2, 5);

INSERT INTO integers VALUES (6, 6);

INSERT INTO integers VALUES (7, 8);

CREATE TABLE integers(i INTEGER, j INTEGER CHECK(i + j < 5), k INTEGER);

INSERT INTO integers VALUES (1, 2, 4);

UPDATE integers SET k=7;

UPDATE integers SET i=i, j=3;

UPDATE integers SET j=2;

CREATE TABLE integers(i INTEGER NOT NULL, j INTEGER NOT NULL);

INSERT INTO integers VALUES (1, 2);

UPDATE integers SET j=3;

CREATE TABLE p(id INT PRIMARY KEY);

INSERT INTO p VALUES (1), (2);

CREATE TABLE t(
    a INT
      CONSTRAINT name_that_is_not_stored_just_like_the_rest CHECK (a > 0)
      CONSTRAINT c_not_null NOT NULL,
    b INT DEFAULT 5 CONSTRAINT chk CHECK (b > 0) CONSTRAINT u UNIQUE,
    c INT CONSTRAINT pk PRIMARY KEY CONSTRAINT fk REFERENCES p(id)
);

SELECT constraint_type, constraint_name, constraint_column_names, constraint_text
FROM duckdb_constraints() WHERE table_name = 't' ORDER BY constraint_name;

SELECT column_name, column_default, is_nullable FROM duckdb_columns() WHERE table_name = 't' ORDER BY column_index;

INSERT INTO t (a, c) VALUES (1, 1);

SELECT * FROM t;

CREATE TABLE integers(i INTEGER NOT NULL);

UPDATE integers SET i=4;

CREATE TABLE integers_with_null(i INTEGER);

INSERT INTO integers_with_null VALUES (3), (4), (5), (NULL);

INSERT INTO integers (i) SELECT * FROM integers_with_null WHERE i IS NOT NULL;

UPDATE integers SET i=4 WHERE i>4;

SET default_null_order='nulls_first';

CREATE TABLE integers(i INTEGER UNIQUE, j INTEGER);

INSERT INTO integers VALUES (NULL, 6), (NULL, 7);

SELECT * FROM integers ORDER BY i, j;

UPDATE integers SET i=77 WHERE i IS NULL AND j=6;

CREATE TEMPORARY TABLE integers(i INTEGER, j VARCHAR);

INSERT INTO integers VALUES (3, '4'), (2, '4');

CREATE TEMPORARY TABLE integers(i INTEGER, j INTEGER);

CREATE UNIQUE INDEX uidx ON integers (i,j);

INSERT INTO integers VALUES (NULL, 6), (NULL, 6), (NULL, 7);

UPDATE integers SET i=77 WHERE i IS NULL AND j=7;

CREATE TABLE integers(i INTEGER PRIMARY KEY, j INTEGER UNIQUE);

INSERT INTO integers VALUES (1, 1), (2, 2);

INSERT INTO integers VALUES (3, 3), (4, 4);

SELECT * FROM integers WHERE i > 0 ORDER BY 1;

INSERT INTO integers VALUES (5, 5), (6, 6);

INSERT INTO integers VALUES (100, 100);

CREATE TABLE constraint_order (PRIMARY KEY (i), i INTEGER, j INTEGER UNIQUE, k INTEGER NOT NULL);

INSERT INTO constraint_order VALUES (1, 1, 1);

CREATE UNIQUE INDEX "uidx" ON "integers" ("j");

INSERT INTO integers VALUES (3, '4'), (2, '5');

INSERT INTO integers VALUES (6,NULL), (7,NULL);

UPDATE integers SET j='7777777777777777777777777777' WHERE j IS NULL AND i=6;

CREATE UNIQUE INDEX uidx ON integers (i);
