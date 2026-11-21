SELECT * FROM pg_attribute;

SELECT * FROM pg_catalog.pg_attribute;

CREATE TABLE integers(i integer);

select relname, attname, attnum from pg_attribute join pg_class on (pg_attribute.attrelid=pg_class.oid) where relname='integers' and attnum>=0;

CREATE TABLE typed (
	v VARCHAR, i INTEGER, d DOUBLE, n DECIMAL(10, 2), tm TIME, ts TIMESTAMP_S, tn TIMESTAMP_NS, l DATE[]
);

SELECT a.attname, a.atttypid, t.typname, format_type(a.atttypid, a.atttypmod)
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid LEFT JOIN pg_type t ON t.oid = a.atttypid
WHERE c.relname = 'typed' AND a.attnum <= 5
ORDER BY a.attnum;

SELECT a.attname, a.atttypid BETWEEN 16384 AND 19999, t.typname, format_type(a.atttypid, a.atttypmod)
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid LEFT JOIN pg_type t ON t.oid = a.atttypid
WHERE c.relname = 'typed' AND a.attnum > 5
ORDER BY a.attnum;

CREATE TYPE mood AS ENUM ('sad', 'happy');

SELECT format_type(oid, -1) FROM pg_type WHERE typname = 'mood';

CREATE SCHEMA s;

CREATE TYPE s.int AS VARCHAR;

SELECT count(*), min(typname) FROM pg_type WHERE oid = 23;

SELECT t.typname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_type t ON t.oid = a.atttypid
WHERE c.relname = 'typed' AND a.attname = 'i';

SELECT * FROM pg_constraint;

create table a (id int , primary key (id));

create table b (id int , foreign_a int, foreign key (foreign_a) references a);

insert into a (id) values (0);

insert into b (id, foreign_a) VALUES (0, 0);

SELECT * EXCLUDE (OID, CONRELID, connamespace) FROM pg_catalog.pg_constraint;

SELECT * FROM pg_database;

SELECT * FROM pg_catalog.pg_database;

SELECT * FROM pg_depend ORDER BY ALL;

SELECT * FROM pg_catalog.pg_depend ORDER BY ALL;

SELECT * FROM pg_enum;

SELECT * FROM pg_catalog.pg_enum;

CREATE TABLE integers(i INTEGER, j INTEGER, k INTEGER);

CREATE INDEX i_index ON integers((j + 1), k);

SELECT * FROM pg_index;

SELECT * FROM pg_catalog.pg_index;

SELECT * FROM pg_indexes;

SELECT * FROM pg_catalog.pg_indexes;

SELECT COUNT(*) FROM pg_namespace WHERE nspname='myschema';

CREATE SCHEMA myschema;

SELECT * FROM pg_namespace;

SELECT * FROM pg_catalog.pg_namespace;

SELECT * FROM pg_namespace WHERE nspname='myschema';

CREATE SCHEMA bla;

CREATE SCHEMA test;

CREATE SCHEMA myschema33;

prepare p1 as select 42;

create table tbl(a varchar);

prepare p2 as insert into tbl values ('test');

prepare p3 as select 21, $1, $2;

prepare p4 as select $name, $other_name;

select * from pg_prepared_statements order by name;

SELECT has_column_privilege('main', 'test', 'col'), has_column_privilege(current_user, 'main', 'test', 'col');

CREATE SEQUENCE seq;

SELECT * FROM pg_sequence;

SELECT * FROM pg_catalog.pg_sequence;

SELECT seqstart, seqincrement, seqmax, seqmin, seqcycle FROM pg_sequence;

SELECT * FROM pg_sequences;

SELECT * FROM pg_catalog.pg_sequences;

SELECT sequencename, min_value, max_value, start_value, cycle FROM pg_sequences;

SET default_null_order='nulls_first';

SELECT * FROM pg_settings;

SELECT name, setting FROM pg_settings WHERE name='default_null_order';

SET default_null_order='nulls_last';

SELECT * FROM pg_tablespace;

SELECT * FROM pg_catalog.pg_tablespace;

CREATE TYPE greeting AS ENUM('hi', 'bonjour', 'konnichiwa', 'howdy');

SELECT * FROM pg_type;

SELECT * FROM pg_catalog.pg_type;

SELECT oid FROM pg_type WHERE typname = 'int8' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'bytea' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'bit' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'bool' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'varchar' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'date' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'float8' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'float4' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'uuid' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'int4' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'int2' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'interval' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'time' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'timestamp' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'timestamptz' AND oid IS NOT NULL;

SELECT oid FROM pg_type WHERE typname = 'timetz' AND oid IS NOT NULL;

SELECT count(*) FROM pg_type where typname = 'greeting';

SELECT oid FROM pg_type WHERE typname = 'numeric' AND oid IS NOT NULL;

SELECT count(*) FROM pg_type where typname = 'enum' AND oid is NOT NULL;

SELECT pg_catalog.format_pg_type('DECIMAL', 'test');

CREATE VIEW v1 AS SELECT 42;

SELECT * FROM pg_views;

SELECT * FROM pg_catalog.pg_views;

SELECT viewname, viewowner FROM pg_views WHERE viewname='v1';

CREATE TABLE integral_values (
    j smallint,
    k integer,
    l bigint,
    i real,
    z double precision,
    m DECIMAL(4, 1),
    n DECIMAL(9, 2),
    o DECIMAL(18, 4),
    p DECIMAL(37, 2),
    q varchar,
    r bytea,
    s date,
    t time,
    u timestamp,
	v date[],
	w greeting
);

select distinct nspname from pg_namespace " "where lower(nspname)='main';

select relname from pg_class c join pg_namespace n on
n.oid=c.relnamespace where
pg_catalog.pg_table_is_visible(c.oid)
and relname='integral_values';

select relname from pg_class c join pg_namespace n on
n.oid=c.relnamespace where
pg_catalog.pg_table_is_visible(c.oid)
and relname='f';

select relname from pg_class c join pg_namespace n on
n.oid=c.relnamespace where n.nspname='main' and
relname='integral_values';

select relname from pg_class c join pg_namespace n on
n.oid=c.relnamespace where n.nspname='main' and
relname='f';

SELECT relname FROM pg_class c join pg_namespace n on
n.oid=c.relnamespace where relkind='S' and
n.nspname='main' and relname='seq';

SELECT relname FROM pg_class c join pg_namespace n on
n.oid=c.relnamespace where relkind='S' and
n.nspname='main' and relname='f';

SELECT EXISTS (
	SELECT * FROM pg_catalog.pg_type t, pg_catalog.pg_namespace n
	WHERE t.typnamespace = n.oid
	AND t.typname = 'integer'
	AND n.nspname = 'main'
	);

SELECT EXISTS (
	SELECT * FROM pg_catalog.pg_type t, pg_catalog.pg_namespace n
	WHERE t.typnamespace = n.oid
	AND t.typname = 'int4'
	AND n.nspname = 'main'
	);

SELECT COUNT(c.oid)
FROM pg_catalog.pg_class c
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE (pg_catalog.pg_table_is_visible(c.oid))
AND c.relname = 'integral_values' AND c.relkind in
('r', 'v', 'm', 'f', 'p');

SELECT nspname FROM pg_namespace
WHERE nspname NOT LIKE 'pg_%'
ORDER BY nspname;

SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'main' AND c.relkind in ('r', 'p');

SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'main' AND c.relkind = 'f';

CREATE VIEW myschema.v1 AS SELECT 42;

SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'myschema' AND c.relkind IN ('v', 'm');

SELECT relname FROM pg_class c join pg_namespace n on
n.oid=c.relnamespace where relkind='S' and
n.nspname='main';

SELECT string_split_regex(pg_get_viewdef(c.oid), '\n')[1] view_def FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'myschema' AND c.relname = 'v1'
AND c.relkind IN ('v', 'm');

SELECT a.attname,
	pg_catalog.format_type(a.atttypid, a.atttypmod),
	(
	SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid)
	FROM pg_catalog.pg_attrdef d
	WHERE d.adrelid = a.attrelid AND d.adnum = a.attnum
	AND a.atthasdef
	) AS DEFAULT,
	a.attnotnull
FROM pg_catalog.pg_attribute a
LEFT JOIN pg_catalog.pg_description pgd ON (
	pgd.objoid = a.attrelid AND pgd.objsubid = a.attnum)
WHERE a.attrelid = (SELECT MIN(oid) FROM pg_class WHERE relname='integral_values')
AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT a.attname,
	CASE WHEN (a.attcollation != 0 AND (
		SELECT t.typcollation
		FROM pg_catalog.pg_type t
		WHERE t.oid = a.atttypid
	) != a.attcollation) THEN (
		SELECT c.collname
		FROM pg_catalog.pg_collation c
		WHERE c.oid = a.attcollation
	) ELSE NULL END AS collation
FROM pg_catalog.pg_attribute a
WHERE a.attrelid = (SELECT MIN(oid) FROM pg_class WHERE relname='integral_values')
AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT a.attname
FROM
	pg_class t
	join pg_index ix on t.oid = ix.indrelid
	join pg_attribute a
		on t.oid=a.attrelid
	WHERE
	t.oid = (SELECT MIN(table_oid) FROM duckdb_tables) and ix.indisprimary = 't'
ORDER BY a.attnum;

SELECT a.attname
FROM pg_attribute a JOIN (
	SELECT unnest(ix.indkey) attnum,
			generate_subscripts(ix.indkey, 1) ord
	FROM pg_index ix
	WHERE ix.indrelid = (SELECT MIN(table_oid) FROM duckdb_tables) AND ix.indisprimary
	) k ON a.attnum=k.attnum
WHERE a.attrelid = (SELECT MIN(table_oid) FROM duckdb_tables)
ORDER BY k.ord;

SELECT r.conname,
	pg_catalog.pg_get_constraintdef(r.oid, true) as condef,
	n.nspname as conschema
FROM  pg_catalog.pg_constraint r,
	pg_namespace n,
	pg_class c
WHERE r.conrelid = (SELECT MIN(table_oid) FROM duckdb_tables) AND
	r.contype = 'f' AND
	c.oid = confrelid AND
	n.oid = c.relnamespace
ORDER BY 1;

SELECT
	cons.conname as name,
	cons.conkey as key,
	a.attnum as col_num,
	a.attname as col_name
FROM
	pg_catalog.pg_constraint cons
	join pg_attribute a
		on cons.conrelid = a.attrelid AND
		a.attnum = ANY(cons.conkey)
WHERE
	cons.conrelid = (SELECT MIN(table_oid) FROM duckdb_tables) AND
	cons.contype = 'u';

SELECT
	i.relname as relname,
	ix.indisunique, ix.indexprs, ix.indpred,
	a.attname, a.attnum, NULL, ix.indkey,
	am.amname,
	NULL as indnkeyatts
FROM
	pg_class t
		join pg_index ix on t.oid = ix.indrelid
		join pg_class i on i.oid = ix.indexrelid
		left outer join
			pg_attribute a
			on t.oid = a.attrelid
		left outer join
			pg_am am
			on i.relam = am.oid
WHERE
	t.relkind IN ('r', 'v', 'f', 'm')
	and t.oid = (SELECT MIN(table_oid) FROM duckdb_tables)
	and ix.indisprimary = 'f'
ORDER BY
	t.relname,
	i.relname;

SELECT
	i.relname as relname,
	ix.indisunique, ix.indexprs,
	a.attname, a.attnum, c.conrelid, ix.indkey::varchar,
	ix.indoption::varchar, i.reloptions, am.amname,
	pg_get_expr(ix.indpred, ix.indrelid)
FROM
	pg_class t
		join pg_index ix on t.oid = ix.indrelid
		join pg_class i on i.oid = ix.indexrelid
		left outer join
			pg_attribute a
			on t.oid = a.attrelid and a.attnum = ANY(ix.indkey)
		left outer join
			pg_constraint c
			on (ix.indrelid = c.conrelid and
				ix.indexrelid = c.conindid and
				c.contype in ('p', 'u', 'x'))
		left outer join
			pg_am am
			on i.relam = am.oid
WHERE
	t.relkind IN ('r', 'v', 'f', 'm', 'p')
	and t.oid = (SELECT MIN(table_oid) FROM duckdb_tables)
	and ix.indisprimary = 'f'
ORDER BY
	t.relname,
	i.relname;

SELECT
	pgd.description as table_comment
FROM
	pg_catalog.pg_description pgd
WHERE
	pgd.objsubid = 0 AND
	pgd.objoid = (SELECT MIN(table_oid) FROM duckdb_tables);

CREATE TABLE check_constraint_tbl (
	i INTEGER CHECK (i < 42)
);

SELECT
	cons.conname as name,
	pg_get_constraintdef(cons.oid) as src
FROM
	pg_catalog.pg_constraint cons
WHERE
	cons.contype = 'c';

SELECT t.typname as "name",
	-- no enum defaults in 8.4 at least
	-- t.typdefault as "default",
	pg_catalog.pg_type_is_visible(t.oid) as "visible",
	n.nspname as "schema",
	e.enumlabel as "label"
FROM pg_catalog.pg_type t
		LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
		LEFT JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e' AND e.enumlabel IS NOT NULL
ORDER BY e.enumsortorder;

SELECT t.typname as "name",
	pg_catalog.format_type(t.typbasetype, t.typtypmod) as "attype",
	not t.typnotnull as "nullable",
	t.typdefault as "default",
	pg_catalog.pg_type_is_visible(t.oid) as "visible",
	n.nspname as "schema"
FROM pg_catalog.pg_type t
	LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE t.typtype = 'd';

SELECT CURRENT_USER;

SELECT CURRENT_CATALOG;

SELECT CURRENT_DATABASE();

SELECT pg_catalog.CURRENT_DATABASE();

SELECT USER;

SELECT SESSION_USER;

SELECT version();

SELECT current_query();

SELECT pg_catalog.current_query();

SELECT 1, 2, 3, current_query();

SELECT current_schema();

SELECT current_schemas(true);

SELECT current_schemas(false);

SELECT inet_client_addr(), inet_client_port(), inet_server_addr(), inet_server_port();

select pg_postmaster_start_time();

SELECT pg_is_other_temp_schema(33);

SELECT col_description(0, 0), obj_description(0, 'duckdb'), shobj_description(0, 'duckdb');

select txid_current();

select pg_typeof(1);
