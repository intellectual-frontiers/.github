USE db1;

CREATE TABLE test(a INTEGER, b INTEGER, c VARCHAR(10));

INSERT INTO test VALUES (42, 88, 'hello');

CREATE UNIQUE INDEX i_unique ON test(a);

CREATE VIEW v1 AS FROM test;

CREATE TYPE mood AS ENUM('ok', 'sad', 'happy');

CREATE TABLE enums(i mood);

INSERT INTO enums VALUES ('ok'), ('sad'), (NULL);

select * from db1.enums;

CREATE SEQUENCE seq;

SELECT nextval('seq');

CREATE FUNCTION my_add(a, b) AS a + b;

COPY FROM DATABASE db1 TO db2;

USE db2;

SELECT * FROM test;

SELECT * FROM enums;

SELECT * FROM v1;

INSERT INTO test VALUES (43, 88, 'hello');

SELECT my_add(1, 2);

ATTACH DATABASE ':memory:' AS db1;

ATTACH DATABASE ':memory:' AS db2;

CREATE TABLE db1.test(a INTEGER, b INTEGER, c VARCHAR);

INSERT INTO db1.test VALUES (42, 84, 'hello');

CREATE TABLE read_only.t(i INT);

DETACH read_only;

COPY FROM DATABASE read_only TO db1;

SET threads = 4;

ATTACH ':memory:' AS source;

USE source;

CREATE TABLE pk_integers(i INTEGER PRIMARY KEY);

CREATE TABLE fk_integers(j INTEGER, FOREIGN KEY (j) REFERENCES pk_integers(i));

INSERT INTO pk_integers VALUES (1), (2), (3);

INSERT INTO fk_integers VALUES (1), (2);

ATTACH ':memory:' AS db1;

COPY FROM DATABASE source TO db1;

SELECT i FROM db1.pk_integers ORDER BY i;

SELECT j FROM db1.fk_integers ORDER BY j;

INSERT INTO fk_integers VALUES (3);

DELETE FROM fk_integers WHERE j=3;

DELETE FROM pk_integers WHERE i=3;

DROP TABLE fk_integers;

DROP TABLE pk_integers;

ATTACH ':memory:' AS target;

CREATE SCHEMA source.first;

CREATE SCHEMA source.second;

CREATE TABLE source.first.parent(i INTEGER PRIMARY KEY);

CREATE TABLE source.second.root(i INTEGER PRIMARY KEY);

CREATE TABLE source.second.parent(i INTEGER PRIMARY KEY REFERENCES source.second.root(i));

CREATE TABLE source.second.child(i INTEGER REFERENCES source.second.parent(i));

INSERT INTO source.first.parent VALUES (42);

INSERT INTO source.second.root SELECT i FROM range(10000) t(i);

INSERT INTO source.second.parent SELECT i FROM range(10000) t(i);

INSERT INTO source.second.child SELECT i FROM range(10000) t(i);

INSERT INTO source.second.child VALUES (NULL);

COPY FROM DATABASE source TO target (SCHEMA);

COPY FROM DATABASE source TO target (DATA);

SELECT i FROM target.first.parent;

SELECT count(*), sum(i) FROM target.second.root;

SELECT count(*), sum(i) FROM target.second.parent;

SELECT count(*), sum(i) FROM target.second.child;

DETACH target;

DETACH source;

CREATE TABLE test (x INT, y AS (x + 100));

insert into test VALUES (42);

FROM test;

COPY FROM DATABASE mydb TO myotherdb;

select * from myotherdb.test;

CREATE INDEX i_index ON test(a);

INSERT INTO test SELECT range, 88, 'hello' FROM range(10000);

EXPLAIN ANALYZE SELECT a, b, c FROM db1.test WHERE a = 42;

SELECT a, b, c FROM db1.test WHERE a = 42;

SELECT * FROM test WHERE a = 42;

EXPLAIN ANALYZE SELECT * FROM test WHERE a = 42;

DROP INDEX i_index;

ATTACH ':memory:' AS db2;

CREATE TABLE db1.tbl1 AS FROM range(3) r(i);

FROM db2.tbl1;

CREATE TABLE db1.test(a INTEGER, b INTEGER, c VARCHAR(10));

INSERT INTO db1.test VALUES (42, 88, 'hello');

SELECT * FROM db2.test;

ATTACH ':memory:' AS src;

SELECT 42;

CREATE TABLE data AS
SELECT i, hash(i)::VARCHAR AS value FROM generate_series(1, 10000) s(i);

ALTER TABLE data ALTER COLUMN value SET NOT NULL;

CREATE INDEX data_value ON data(value);

SELECT database_name, table_name, index_name FROM duckdb_indexes ORDER BY ALL;

SELECT database_name, table_name, index_count FROM duckdb_tables ORDER BY ALL;

CREATE TABLE old.items (id INT, uniq INT UNIQUE);

INSERT INTO old.items VALUES (1, 1), (2, 2), (3, 3);

CREATE UNIQUE INDEX idx_id ON old.items(id);

COPY FROM DATABASE old TO new1 (SCHEMA);

COPY FROM DATABASE old TO new1 (DATA);

SELECT id, uniq FROM new1.items ORDER BY ALL;

DETACH new1;

create sequence seq start 1;

create table tbl (
	id int default nextval('seq')
);

insert into tbl values (DEFAULT);

copy from database memory to backup;

drop sequence seq cascade;

select * from backup.tbl;

select currval('backup.main.seq');

drop sequence backup.main.seq cascade;

create schema my_schema;

create sequence my_schema.seq start 1;

create table tbl (
	id int default nextval('my_schema.seq')
);

drop sequence my_schema.seq cascade;

drop sequence backup.my_schema.seq cascade;

create schema backup;

create sequence memory.backup.seq start 1;

drop schema backup cascade;

create table tbl (
	id int default nextval('memory.backup.seq')
);

drop sequence memory.backup.seq cascade;

from duckdb_sequences();
