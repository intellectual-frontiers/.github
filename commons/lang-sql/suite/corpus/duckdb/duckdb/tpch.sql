USE dbgen_nested;

CREATE SCHEMA a;

CREATE SCHEMA a.b;

CREATE SCHEMA b;

CREATE SCHEMA "a.b";

CREATE TABLE b.region AS SELECT 42 AS sentinel;

USE dbgen_nested.a.b;

CALL dbgen(sf=0);

SELECT count(*) FROM (SHOW TABLES FROM dbgen_nested.a.b);

SELECT sentinel FROM dbgen_nested.b.region;

CALL dbgen(sf=0.01);

SELECT count(*) > 0 FROM dbgen_nested.a.b.nation;

SELECT count(*) FROM dbgen_nested.a.b.nation;

CALL dbgen(sf=0, schema='a.b', suffix='_nested_arg');

SELECT count(*) FROM dbgen_nested.a.b.nation_nested_arg;

SELECT count(*) FROM (SHOW TABLES FROM dbgen_nested."a.b");

CALL dbgen(sf=0, schema='"a.b"');

SELECT count(*) FROM dbgen_nested."a.b".nation;

CREATE SCHEMA dbgen_nested."legacy.dot";

CALL dbgen(sf=0, schema='legacy.dot');

SELECT count(*) FROM dbgen_nested."legacy.dot".nation;

CREATE SCHEMA dbgen_arg."a.b";

CALL dbgen(sf=0, schema='a.b', catalog='dbgen_arg');

SELECT count(*) FROM dbgen_arg."a.b".nation;

CALL dbgen(sf=0, catalog='dbgen_arg', schema='a.b', suffix='_reverse');

SELECT count(*) FROM dbgen_arg."a.b".nation_reverse;

CREATE SCHEMA dbgen_nested.a."b.c";

USE dbgen_nested.a."b.c";

CALL dbgen(sf=0, suffix='_quoted');

SELECT count(*) FROM dbgen_nested.a."b.c".nation_quoted;

RESET threads;

CREATE TABLE tbl (i INTEGER);

SELECT c_custkey,
       c_address = 'IVhzIApeRb ot,c,E',
       c_comment = 'to the even, regular platelets. regular, ironic epitaphs nag e',
       c_comment = 'l accounts. blithely ironic theodolites integrate boldly: caref'
FROM customer WHERE c_custkey <= 2 ORDER BY c_custkey;

SELECT s_suppkey,
       s_address = ' N kD4on9OM Ipw3,gf0JBoQDd7tgrzrddZ',
       s_comment = 'each slyly above the careful'
FROM supplier WHERE s_suppkey = 1;

SELECT o_orderkey, o_comment = 'nstructions sleep furiously among '
FROM orders WHERE o_orderkey = 1;

SELECT c_count, custdist FROM (
    SELECT c_count, count(*) AS custdist FROM (
        SELECT c_custkey, count(o_orderkey) AS c_count
        FROM customer LEFT OUTER JOIN orders ON c_custkey = o_custkey AND o_comment NOT LIKE '%special%requests%'
        GROUP BY c_custkey) c_orders
    GROUP BY c_count)
ORDER BY custdist DESC, c_count DESC LIMIT 3;

SELECT count(*) FROM tpch_queries() q JOIN tpch_queries(sf=1) s USING (query_nr) WHERE q.query <> s.query;

SELECT list(query_nr) FROM tpch_queries() q JOIN tpch_queries(sf=1000) s USING (query_nr) WHERE q.query <> s.query;

SELECT query_nr, regexp_extract(query, '\* ([0-9.]+)', 1) FROM tpch_queries(sf=100) WHERE query_nr = 11;

SELECT regexp_extract(query, '\* ([0-9.]+)', 1) FROM tpch_queries(0.01) WHERE query_nr = 11;

SELECT regexp_extract(query, '\* ([0-9.]+)', 1) FROM tpch_queries(100000) WHERE query_nr = 11;

SELECT count(*) FROM tpch_queries(sf=10);

PRAGMA tpch(11, sf=0.01);

SELECT answer = 'ps_partkey|value' || chr(10) || '1376|13271249.89' || chr(10) FROM tpch_answers() WHERE query_nr = 11 AND scale_factor = 0.01;
