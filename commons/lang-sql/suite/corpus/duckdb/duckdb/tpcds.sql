USE dsdgen_nested;

CREATE SCHEMA a;

CREATE SCHEMA a.b;

CREATE SCHEMA b;

CREATE SCHEMA "a.b";

CREATE TABLE b.customer_address AS SELECT 42 AS sentinel;

USE dsdgen_nested.a.b;

CALL dsdgen(sf=0, overwrite=true);

SELECT sentinel FROM dsdgen_nested.b.customer_address;

SELECT count(*) FROM (SHOW TABLES FROM dsdgen_nested.a.b);

CALL dsdgen(sf=0.01, overwrite=true);

SELECT count(*) > 0 FROM dsdgen_nested.a.b.customer_address;

CALL dsdgen(sf=0, schema='a.b', suffix='_nested_arg');

SELECT count(*) FROM dsdgen_nested.a.b.customer_address_nested_arg;

SELECT count(*) FROM (SHOW TABLES FROM dsdgen_nested."a.b");

CALL dsdgen(sf=0, schema='"a.b"');

SELECT count(*) FROM dsdgen_nested."a.b".customer_address;

CREATE SCHEMA dsdgen_nested."legacy.dot";

CALL dsdgen(sf=0, schema='legacy.dot');

SELECT count(*) FROM dsdgen_nested."legacy.dot".customer_address;

CREATE SCHEMA dsdgen_arg."a.b";

CALL dsdgen(sf=0, schema='a.b', catalog='dsdgen_arg');

SELECT count(*) FROM dsdgen_arg."a.b".customer_address;

CALL dsdgen(sf=0, catalog='dsdgen_arg', schema='a.b', suffix='_reverse');

SELECT count(*) FROM dsdgen_arg."a.b".customer_address_reverse;

CREATE SCHEMA dsdgen_nested.a."b.c";

USE dsdgen_nested.a."b.c";

CALL dsdgen(sf=0, suffix='_quoted');

SELECT count(*) FROM dsdgen_nested.a."b.c".customer_address_quoted;

RESET threads;

CREATE TABLE tbl (i INTEGER);

CALL dsdgen(sf=0);

SET debug_physical_table_scan_execution_strategy=SYNCHRONOUS;

CALL dsdgen(sf=0.01, suffix='_sync_scan');

SET debug_physical_table_scan_execution_strategy=DEFAULT;

SELECT count(*) FROM tpcds_queries() q JOIN tpcds_queries(sf=1) s USING (query_nr) WHERE q.query <> s.query;

SELECT list(query_nr) FROM tpcds_queries() q JOIN tpcds_queries(sf=10) s USING (query_nr) WHERE q.query <> s.query;

SELECT regexp_extract_all(query, '> ([0-9]+) THEN', 1) FROM tpcds_queries() WHERE query_nr = 9;

SELECT regexp_extract_all(query, '> ([0-9]+) THEN', 1) FROM tpcds_queries(sf=10) WHERE query_nr = 9;

SELECT regexp_extract_all(query, '> ([0-9]+) THEN', 1) FROM tpcds_queries(0.01) WHERE query_nr = 9;

SELECT regexp_extract_all(query, '> ([0-9]+) THEN', 1) FROM tpcds_queries(sf=0.000001) WHERE query_nr = 9;

SELECT count(*) FROM tpcds_queries(sf=100);

CALL dsdgen(sf=0.01);

PRAGMA tpcds(9);

PRAGMA tpcds(9, sf=0.01);

SELECT * FROM tpcds_queries();
