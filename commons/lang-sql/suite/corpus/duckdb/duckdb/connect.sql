SET VARIABLE server_uri = (SELECT concat('''', listen_uri, '''') FROM quack_serve('quack:localhost:0', token='test_token'));

DETACH qk;

DISCONNECT;

CONNECT qk;

SELECT 42;

SET VARIABLE server_uri = (SELECT concat('''', listen_uri, '''') FROM quack_serve('quack:127.0.0.1:0', token='test_token'));

SET GLOBAL quack_prepare_inline_rows = 0;

CREATE TABLE local_t AS SELECT 1 AS i;

BEGIN;

INSERT INTO local_t VALUES (2);

SELECT sum(i) FROM local_t;

COMMIT;

INSERT INTO local_t VALUES (3);

ROLLBACK;

INSERT INTO local_t VALUES (4);

LOAD quack;

CALL enable_logging('Quack');

SELECT count(*) > 0 FROM duckdb_logs WHERE type = 'Quack' AND message LIKE '%''server'': NULL%'
	AND message LIKE '%''query'': CONNECT no_such_db;%';

SELECT count(*) FROM duckdb_logs WHERE type = 'Quack' AND message LIKE '%''server'': NULL%'
	AND message LIKE '%''query'': CREATE GRANT;%' AND message LIKE '%''error'': ''Parser Error: syntax error at or near "GRANT"%';

SELECT count(*) FROM duckdb_logs WHERE type = 'Quack' AND message LIKE '%''server'': NULL%'
	AND message LIKE '%''query'': CREATE GRANT;%';

SELECT range AS x, range * 2 AS y FROM range(3);

SELECT 7;

SELECT 1 + 1;

SELECT 'hello'::VARCHAR;

SET VARIABLE my_var = 42;

SELECT getvariable('my_var');

SET VARIABLE v = 7;

SELECT getvariable('v');

SELECT count(*) FROM pragma_database_list WHERE name LIKE '__connect%';

ATTACH ':memory:' AS plain_duckdb;

DETACH plain_duckdb;

CREATE TABLE remote_t (i INT);

CREATE TABLE local_t (i INT);

INSERT INTO qk.remote_t VALUES (1);

INSERT INTO local_t VALUES (1);

SELECT count(*) FROM remote_t;

SELECT (SELECT count(*) FROM local_t), (SELECT count(*) FROM remote_t);
