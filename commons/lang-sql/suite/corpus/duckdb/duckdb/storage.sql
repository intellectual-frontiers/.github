SET initial_column_segment_size = 8;

DROP TABLE step_test;

DROP TABLE mem_adaptive;

SELECT MIN(i) = 0 AND MAX(i) = 99 FROM overflow_test;

SELECT COUNT(*) FILTER (WHERE i IS NULL) FROM validity_test;

SELECT COUNT(*) FROM string_test;

DROP TABLE validity_test;

SELECT CASE WHEN memory_usage_bytes < 2000
            THEN 'ok'
            ELSE error(concat('expected < 2000 bytes after checkpoint, got ', memory_usage_bytes))
       END
FROM duckdb_memory()
WHERE tag = 'IN_MEMORY_TABLE';

SELECT COUNT(*), SUM(value)::BIGINT FROM persistent_suballocation;

SELECT COUNT(*) FROM (
    (FROM adaptive.t EXCEPT ALL FROM adaptive.source_rows(0, 7000))
    UNION ALL
    (FROM adaptive.source_rows(0, 7000) EXCEPT ALL FROM adaptive.t)
);

WITH expected AS (
    FROM adaptive.source_rows(0, 10000) WHERE i >= 7000 OR i % 3 != 0
)
SELECT COUNT(*) FROM (
    (FROM adaptive.t EXCEPT ALL FROM expected)
    UNION ALL
    (FROM expected EXCEPT ALL FROM adaptive.t)
);

SET debug_force_commit_failure = true;

SELECT memory_usage_bytes < 8192
FROM duckdb_memory()
WHERE tag = 'IN_MEMORY_TABLE';

ATTACH ':memory:' AS mixed_db (ROW_GROUP_SIZE 2048);

SELECT COUNT(*) FROM (
    (FROM mixed_db.mixed_rollback EXCEPT ALL FROM mixed_rows(0, 2500))
    UNION ALL
    (FROM mixed_rows(0, 2500) EXCEPT ALL FROM mixed_db.mixed_rollback)
);

use db1;

set wal_autocheckpoint = '10gb';

INSERT INTO t BY NAME SELECT
	1::INTEGER AS int_col,
	'x' AS varchar_col
FROM range(10);

ALTER TABLE a ALTER COLUMN c SET DEFAULT 10;

create table t as select i, i // 2 as j, i // 4 as k from range(1_000_000) t(i);

select min(k), max(k) from t;

SELECT MIN(i), MAX(i), MIN(v), MAX(v) FROM vals;

CREATE TABLE m.tbl(i INTEGER);

CREATE TABLE nw.tbl(i INTEGER);

SELECT COUNT(*) FROM nw.tbl;

CREATE TABLE b.tbl(i INTEGER);

SELECT 42;

SET immediate_transaction_mode = false;

INSERT INTO b.tbl VALUES (1);

SELECT (SELECT COUNT(*) FROM b.tbl), (SELECT COUNT(*) FROM main_tbl);

SET debug_force_commit_revert_failure = false;

INSERT INTO t VALUES (1);

INSERT INTO a.t VALUES (0);

SELECT COUNT(*) FROM b.t;

DETACH rsize_db;

INSERT INTO mmap_db.t SELECT i, 'val_' || i FROM range(4, 1000) tbl(i);

SELECT count(*) FROM f WHERE end_snapshot IS NULL;

SELECT count(*) FROM f WHERE end_snapshot IS NOT NULL AND end_snapshot > 1;

SELECT v.x, w.x FROM old.v, old.w WHERE v.x = w.x[1] ORDER BY ALL;

SELECT typeof(a + b) FROM old.t;

SELECT typeof(coalesce(a, b)::DECIMAL(38,1)), typeof(coalesce(a, b)) FROM old.t;

SELECT count(*) FROM old.t WHERE coalesce(try_cast(a AS DECIMAL(18,0)), -1::DECIMAL(18,0)) = 1;

SELECT a FROM ro.t WHERE a = '1'::BIGNUM;

SELECT k, d FROM wal.u;

SELECT count(*) FROM wal.t;

DETACH up;

INSERT INTO old.t VALUES (2);

INSERT INTO old.n VALUES ({'v': '2'::BIGNUM});

DROP INDEX old.mx;

DROP INDEX old.ux;

SELECT k FROM old.t WHERE k = 1000;

SELECT count(*) FROM old.t WHERE x IS DISTINCT FROM 1;

CHECKPOINT reuse;

DETACH rewrite;

CREATE VIEW db.v_slice AS SELECT [1, 2, 3][2:] AS a, [1, 2, 3][:2] AS b, 'abcdef'[2:] AS c, 'abcdef'[:3] AS d, [1, 2, 3, 4, 5][:-:2] AS e, [1, 2, 3, 4, 5][2:-:2] AS f, [1, 2, 3][:] AS g;

CREATE TABLE db.t (a VARCHAR, d VARCHAR DEFAULT ('abcdef'[2:]), g VARCHAR GENERATED ALWAYS AS (a[2:]), CHECK (a[:1] <> 'x'));

SELECT db.m_tail([1, 2, 3]);

INSERT INTO t_slice VALUES ([1, 2, 3], 'abcdef');

FROM old.v_lambda_arrow;

INSERT INTO old.t_default (b) VALUES (1);

FROM old.t_check;

SHOW TABLES;

CREATE TABLE tbl (
	price INTEGER,
	gcol AS (price)
);

SELECT * FROM tbl;

CREATE TABLE base (
	price INTEGER PRIMARY KEY
);

INSERT INTO tbl VALUES (DEFAULT);

SELECT * FROM collate_test WHERE s='Muhleisen';

INSERT INTO test VALUES (9, 90);

DROP SCHEMA test;

SELECT plus2(3);

INSERT INTO test_default (b) VALUES (2), (4), (6);

PREPARE p1 AS INSERT INTO t VALUES ($1);

PREPARE p1 AS DELETE FROM t WHERE a=$1;

ALTER TABLE test ADD COLUMN k INTEGER DEFAULT 2;

INSERT INTO test VALUES (10, 'hello');

SELECT * FROM test ORDER BY b;

CREATE TABLE test (a INTEGER DEFAULT 1, b INTEGER);

SELECT a FROM test ORDER BY a;

CREATE VIEW vtest AS SELECT * FROM test;

SELECT nextval('seq'), nextval('seq');

DELETE FROM a;

CREATE TEMPORARY VIEW v1 AS SELECT 42;

UPDATE a SET i = 45;

CREATE TABLE test_tbl (id INT, name string, height double);

SELECT * FROM my_seq(0,6);

set enable_view_dependencies=true;

DROP TABLE test.t CASCADE;

SELECT sql FROM duckdb_views() WHERE view_name = 'api_view';

INSERT INTO db.t VALUES (2);

USE other;

select min(id), max(id) from z;

CREATE VIEW persisted.v AS SELECT * FROM persisted.t;

SELECT i FROM other.t;

CREATE OR REPLACE TABLE novelty_inserts AS SELECT pk, uuid()::VARCHAR as val1, uuid()::VARCHAR as val2 FROM novelty_deletes;

SELECT COUNT(*) FROM tbl;

CHECKPOINT other;

CREATE TABLE t AS SELECT repeat('a', 100) FROM range(50000);

CREATE TABLE fail_detach.integers AS SELECT * FROM range(100) tbl(i);

SELECT count(DISTINCT row_group_id) FROM pragma_storage_info('t');

CREATE TABLE vals(i INTEGER);

INSERT INTO vals SELECT (CASE WHEN i % 2 = 0 THEN NULL ELSE i % 100 END)::TINYINT i FROM range(200000) tbl(i);

INSERT INTO test VALUES (14, 10, 'con');

CREATE TABLE fresh (i INTEGER, s VARCHAR, l INTEGER[], a INTEGER[2], st STRUCT(a INTEGER, b VARCHAR));

INSERT INTO wide FROM wide_rows(0, 1, 1);

DELETE FROM wide WHERE i = 1;

SELECT count(*), sum(i), max(s), count(l), sum(list_sum(l)), sum(a[2]), max(st.b) FROM wide;

INSERT INTO fresh FROM wide_rows(100000, 105000, 1);

SELECT i, l, a FROM wide WHERE i IN (100000, 100001, 100002) ORDER BY i;

CREATE TABLE T (a INTEGER NOT NULL USING COMPRESSION RLE);

SELECT COUNT(*) > 0 FROM pragma_storage_info('T')
WHERE segment_type ILIKE 'INTEGER' AND compression = 'RLE';

SELECT * FROM T_1;

ALTER TABLE T_1 ADD COLUMN b INTEGER DEFAULT 2;

CHECKPOINT smaller_block_size;

CHECKPOINT has_bitpacking;

SELECT MEDIAN(count) FROM pragma_storage_info('integers');

SET preserve_insertion_order=false;

SELECT list_sum(LIST(t1.i) || LIST(t2.i))
FROM large.tbl AS t1 JOIN small.tbl AS t2 ON t1.i = t2.i;

USE alp_corrupt_exponent;

USE alp_corrupt_offset;

select d, f from tbl1_alp;

SET initial_column_segment_size=262144;

CHECKPOINT legacy;

SELECT * FROM list_doubles WHERE i=5700;

SELECT compression FROM pragma_storage_info('random_double') WHERE segment_type == 'double' AND compression != 'Uncompressed';

INSERT INTO t VALUES (NULL), (42.5);

SET disabled_compression_methods='chimp,patas,alprd,rle';

create table random_float as select round(random(), 6)::FLOAT as data from range(1024) tbl(i);

select * from random_alp_float;

CHECKPOINT alp_v1_4_0_default;

create table random_double as select 0::DOUBLE as data from range(1024) tbl(i);

SELECT sum(a) IS NOT NULL FROM t;

USE alprd_corrupt_header_undercount;

USE alprd_corrupt_offset_unordered;

SET force_compression='alprd';

SELECT compression FROM pragma_storage_info('random_alprd_double') WHERE segment_type == 'double' AND compression != 'ALPRD';

CREATE TABLE alprd_v1_4_0_default.t AS SELECT round(i * 0.001, 6)::DOUBLE AS x FROM range(10000) t(i);

SELECT compression FROM pragma_storage_info('alprd_v1_4_0.t') WHERE segment_type = 'DOUBLE' ORDER BY compression LIMIT 1;

SELECT count(b), sum(b::INT), sum(c::INT), count(n), sum(d::INT), bool_or(b) FROM t;

CREATE TABLE test (c INT64);

USE bitpacking_corrupt_group_offset;

create table tt as select (x + if (random() > 0.5, 1, -1)) x from aux;

SELECT count(*), sum(v), sum(v) FILTER (WHERE h = 1) FROM t;

INSERT INTO test SELECT i::VARCHAR id, i b FROM range(10000) tbl(i);

SELECT MIN(id), MAX(id), SUM(col), MIN(col), MAX(col), COUNT(*) FROM test WHERE id='5000';

CREATE OR REPLACE MACRO expected(i) AS frame(i) + CASE WHEN i%2048=1 THEN 0 WHEN i%2048=2 THEN residual_mask(i) WHEN i%3=0 THEN NULL ELSE hash(i)::HUGEINT & residual_mask(i) END;

DROP TABLE db.t;

select a from test limit 5;

INSERT INTO test SELECT i::VARCHAR, i::HUGEINT + 500000000000000000000 FROM range(0, 16) tbl(i);

CREATE TABLE test (a BIGINT);

select sum(a), min(a), max(a) from test;

select avg(a) from test;

SELECT compression FROM pragma_storage_info('test') WHERE segment_type ILIKE 'INTEGER' LIMIT 1;

SET force_bitpacking_mode = 'delta_for';

CREATE TABLE test_2 AS SELECT a FROM test;

INSERT INTO test SELECT i::VARCHAR, i::UHUGEINT FROM range(0, 16) tbl(i);

INSERT INTO test SELECT i::VARCHAR, i::UHUGEINT + 500000000000000000000::UHUGEINT FROM range(0, 16) tbl(i);

INSERT INTO test_bp SELECT 2 FROM range(0, 1000) tbl(i);

INSERT INTO test SELECT {'a': 1337} FROM range(2147473647, 2147483647) tbl(i);

USE chimp_corrupt_leading_zero_block_count;

SET force_compression='dict_fsst';

SELECT count(*), sum(a), count(b) FROM constants;

CHECKPOINT dictionary_gap;

CHECKPOINT dict_fsst_small;

CREATE TABLE zstd_small.t AS SELECT * FROM (VALUES ('a'),('b')) v(x);

CREATE TABLE zstd_multi.t AS SELECT CASE WHEN i%2=0 THEN 'a' ELSE 'b' END AS x FROM range(4097) r(i);

CREATE TABLE zstd_overflow.t AS SELECT CASE WHEN i%2=0 THEN 'a' ELSE 'b' END AS x FROM range(12289) r(i);

CREATE TABLE uncompressed_overflow.t AS SELECT * FROM (VALUES (repeat('a',5000)),(repeat('b',5001))) v(x);

CREATE TABLE alp_small.t AS SELECT i::DOUBLE AS x FROM range(33) r(i);

CREATE TABLE alp_full.t AS SELECT sin(i::DOUBLE) AS x FROM range(1700) r(i);

CREATE TABLE alprd_small.t AS SELECT i::DOUBLE AS x FROM range(33) r(i);

CREATE TABLE alprd_full.t AS SELECT sin(i::DOUBLE) AS x FROM range(2400) r(i);

SET force_compression='roaring';

DETACH roaring_small;

DETACH roaring_multi;

CREATE TABLE no_zeroing.uncompressed AS SELECT CASE WHEN r % 5 = 0 THEN NULL ELSE r * 7 END::HUGEINT AS x, CASE WHEN r % 3 = 0 THEN NULL ELSE to_seconds(r) END AS y FROM range(5000) t(r);

DETACH no_zeroing;

CREATE TABLE test_constant (a INTEGER);

SELECT compression FROM pragma_storage_info('test_dict') WHERE segment_type ILIKE 'VARCHAR' LIMIT 1;

CREATE TABLE pos_zero AS SELECT '0.0'::DOUBLE AS v, '0.0'::FLOAT AS vf FROM range(3);

SELECT DISTINCT signbit(v), signbit(vf) FROM neg_zero;

SELECT i8, i16, u8, u16, u32, u64, i128, u128, f32, f64
FROM constant_numbers
WHERE id = 42;

EXECUTE dictionary_selection('key=');

SELECT count(ld), count(DISTINCT ld), min(ld), max(ld)
FROM (SELECT lag(d) OVER (ORDER BY i) AS ld FROM t);

WITH RECURSIVE r(i, d) AS (
	SELECT i, d FROM t WHERE i < 2500
	UNION ALL
	SELECT i + 2500, d FROM r WHERE i < 5000
)
SELECT count(*), count(DISTINCT d), min(d), max(d) FROM r;

SELECT count(*), count(*) FILTER (WHERE m = 'majority_payload_value')
FROM (SELECT median(x) OVER (ROWS BETWEEN 100 PRECEDING AND CURRENT ROW) AS m FROM t2);

CREATE TABLE t3 AS SELECT i,
	CASE WHEN i % 11 = 0 THEN NULL ELSE 'only_dictionary_payload_value' END AS xs
FROM range(50000) t(i);

USE dict_fsst_corrupt_dict_count;

USE dict_fsst_corrupt_encoded_dictionary_index;

SELECT compression FROM pragma_storage_info('t') WHERE column_name='s' AND segment_type='VARCHAR';

INSERT INTO db.t SELECT '' FROM range(20000);

SELECT count(*) FROM pragma_storage_info('partial_segment')
WHERE column_name = 'task_id'
  AND segment_type = 'VARCHAR'
  AND compression = 'DICT_FSST';

SELECT count(*) FROM partial_segment;

SET force_mbedtls_unsafe = true;

SELECT count(*), sum(i) FROM multi_segment
WHERE split_part(comment, ' ', 3)::INTEGER % 2 = 0;

select * from compressed_data order by i;

force checkpoint;

CREATE TABLE test (a VARCHAR, b VARCHAR);

SELECT DISTINCT b FROM test ORDER BY a % 5;

INSERT INTO TEST
    SELECT '5yqde9mna8753399lj5r2u5rps5tuu0xsetmsxi80dacku7uz0q3r7h3r9gboq4c41t4h8brm6t7hcb2zg41g7elknivchc3ff409nhczhc7ciledplgcql5sfjb1x2ctuvf6cjdckfkq56ranj67qkzdnvj8guw8rxyd55298ziig0adhqsi0jdx60exhq6vv8hfqarfpvfma8qoqtv5kzte4mofm41w5uy0zdk4tjd5i7673pyigseb4mb3g6u5rwac1s8s1xcoobjoexp340hbr7vk1fwqdfisdm94967tvqxmirn6ml4ccaw3r7bh04e2p5txvea0vi965t29vbv1858ystdqpc8s9aalij445brgn55gpwtgmpbg8tkg7plw05aw8auijbkl9v4go9azrbqcb3yipi1hphmazfrzuta6qdys89usu672vs18qbricebs2rjhsqud8iemug1fr31hoaxu0lg7yfg2i8i9ufmrkgg8dtv5dw5edxptw48meec88iunibox2bc72eq5d59fmg2db7r8xtj1wptoak72on1v5jis1s024hvebx3nudmx78s32dszihs8mvkpt37fxsza9nccbo0jmyu7wzspkl1tqtbkx17lc043weyu2qavtp7vzvuyk9j7l7gha5kr6x295l9sk610ya8820atujz6dpcnkp4fuyatyefo4acc1g05ipcf2bwjgtz48ewzivm8p6kh7e1dp715x5as9bvs5i9n9pxvhp6jo7clnj987iojgztfk2fk9980gr8i69frtci4cj6rxlf9ig228tyljlqd53nwxnz7mvqjymohyqjsuunjdnioo199cl8m6fvv3hu8vh0v8otcohrskwan81p1ncqkf2svf97gyz2cu7bfrvbv03o6bflqdm60ojl0z1yta41m416mkdljpuxzk7gs9tj121jnvfe9piw1ow3ibu66eyrs2cmxopyhio4h7toekptm4xysmx96pdbjxx0kugwj4mfgjwj40ijkpwz0kjs39eumuexyooldizgzidhzk7hecfqamlnolbescpiuqrfyewm4evn2tx3cnoun9y3mciact4ont84q9z99r4wt76wusjtoz11xv5rgkz1t2dy3wtzog1ifhmprfymrzt0lzlsugjru5m6ubq87dmyzu9fwo8sivuea2zedogsm93sgwgrbomalj213ejyic4w9wgobnqjogd9j0h24u8dddr238elpqwk4sr2dznvw2fthow2l5ckua9z022nj3hktzae4jnyu7ckohdowy91lmh6ns10sialoa146x5sfje0fc4i1dt1dwbcygtmadjwjhytsvsq879y9tfud08fg2c1a01yzb5yy1z5cj99aherty940w91qjl0zl27p58enhtdvr0wzqpkgkxno93vj9qm7fiszrzcbmlowwfeusty9dkm9i4vskzovrgjpp91op2654acbblntyxra484e8ejbmehtecdh25patwrs016w7gqtvtzgufg9znmuxwcczrwgqpfkgwj27pfu56z5sd9241vjz8364zxfwfogjvhdxcxfgh6u4lbqmu1870ei2snna70atxputk4ybpj1r1e0ut4zcz8786eofale8on8uysws7mfs8o3uen21zjtqnc260s6e9tc1lpw2qk2vjsg10escmlj8hliba24sauabdc7ttj2pmv2xjh0photfpywqfbw7f9av3jxyplfap42nc9ttz1xqbrb3seieu2cnnwjc8vqxuacprwcdznwzrc99e28zf5q6y9c2exm9rbofy09w854xkplwlx2v2qjfm36r4jhwi953i993xhgu3um0qeisyfw8aicc52itcc53e98wer9iluwqrttx25vjr2ukk7m0olyzksbj9gaiu4tii3vcmk994ouvzse4khfd4ud9uxea4n8ahdshzpflx0feh0s1r9nv6e6fxipxiclaqs4hul93pbka016cq2l9cogc3tueqhwuximt11gws89uhjf81dhkowdrr0lh19yso5r2hclhblr3c0ykac7ieecfth4xbyz31hr3ug4gd8lbgkvh0hm5tgtyy84qnptuif7l6do0ksktathok43eyflzcq7z8wulniynjhqmnlrdjisosqt3mr02iuahfg7ldzvop71ezhxzgix6xzn93e2pjfo9ejjp5aqgocif4vob6t1be3hg0hn5597h5f66v2m6swkjed482ggfnw894rhxaurk67dsj2albqndwkz25rjxrahlj2eeinxqq93a30o86i865jter4g7wm0brhz5csy5kgb51sawjkc9kfcsqz92c4d7cf7f28kgtruroohlxli6bve96r2ff3eoqqupwifodag20lfp25t0fx61254kwm3s6runk0hcfn9opo2fsduoibmqdrzfnmmf431af441tkur3rhx1o08ovl9uf4xxachfj7acy58g7fnfkk4od5pfjvr20l85dfes3tq9vyom2vbx0m2r5sokx6c7chetqpphdk9etnpqxwwspcnqrq8hcrjka52lgc1y41fvnhxcdisx7w9b9l19p2rmdj4tqx4ezjghgi06b9vil6hkvllt3m2ym9e21mlqy1v0e5yoypwj32k5ri8et1bn2uqmjaw8gpcegsvv9wz45i2ggnntszj0nx05dl1u46mcb66y43xd2tyow6v6wokbeputut9ybaxz7o3hcq41s2p97mxpv34guz7xxbdhezhvja06m298nqx0qsh4tn14vcwt7kdv9rvpcwljzese17dwmnhmi38iqxf8hp5dannyffr8ijrwmxn3ezmfg6f4l8a4mwyhfcjvziu4uy9a62d8wrfskakvwh9h89rfjpa4k8edrq6jjkf9a7xu0vibp3g3escq0jjt209xxyztpy1u1yf9r2hgmw7mwa4j4565w74ib5ocn8q5wrawc9m17o1i8e3mvoc6bkj96nwm5iti5krq5xjwy8rd7j0tjkjzvupus5d64d1zt4fezbuvhieygyl0jlv8s8m24u3jj822tf1wwukafoksuigt1ttsni935ly51cqokl5k09t4y3hjszbj1cisjg18cqsqwqcrlai7exaefpknsa6euj7k0kaqbf4lya7f29zmytpzc32t3vqs2b0967a80ybxykz6fvyjdraj43831rnq19xh4m000gyi0bu5jgp8x53eibhya5xtqdglmdjrhen0md1fha4k0y95ze3v5cxssdeyqwj9y8a8eco858nf9uj6f83z3uk9yk7zi90lmcy8bm6es36hxwj8g1yygj5evne8ire0q6pa2e0jh9wmubpsv53tcof1pvhvvd7b03i2srdeykcq7sn88bv2huz39pmd4m012nx6jib7c53ape70i6gwefvatqetrvj94oq6bm50eqo4c72csqdwn55xpoq27pqot90zfzpnb690eund78eoss6ltg7zhkc4hk0qjvrl8me8cgzy0py4btyhhsks9i0veou0ia84nxbkwo758dn3m0kgp60jxcrgdjuyojbh5u67qlu69lthdzmzshij0mhlaa05rdrn9vdv1440v2rozpwdtvxzfvykb0tjx700eqdr164zy7d3ji8g82souaiui7n96my35ocgt0xmdrss'
    FROM range(0,90) tbl(i);

CREATE TABLE trigger5759 AS SELECT CASE WHEN RANDOM() > 0.95 THEN repeat('ab', 1500) ELSE 'c' END FROM range(0,1000);

SET storage_compatibility_version='latest';

SELECT COUNT(*) FROM t1 WHERE problem IS NULL;

CREATE TABLE strings AS
SELECT NULL::VARCHAR AS all_null, ''::VARCHAR AS all_empty,
       CASE WHEN i % 2 = 0 THEN '' ELSE NULL END AS mixed
FROM range(5000) t(i);

USE dictionary_corrupt_count;

SELECT compression FROM pragma_storage_info('t') WHERE column_name='s' AND segment_type='VALIDITY' LIMIT 1;

SET force_compression = 'dictionary';

SELECT a, b FROM test WHERE a IN (0, 4, 5, 6, 31, 32, 33, 2047, 2048, 2049, 10002) ORDER BY a;

USE dictionary_invalid_bitpacking_width;

INSERT INTO t SELECT 'hello' FROM range(10000);

USE fsst_corrupt_escape_symbol_index;

SET disabled_compression_methods='fsst';

SELECT count(*), count(*) FILTER (
	WHERE s = repeat('x', 510) || 'abcdefghij' || lpad(i::VARCHAR, 8, '0'))
FROM (SELECT row_number() OVER (ORDER BY s) - 1 AS i, s FROM db.t);

CREATE TEMP TABLE retained AS SELECT * FROM db.strings WHERE id%2048<70 OR id%2048>=2046;

SELECT DISTINCT compression FROM pragma_storage_info('t') WHERE segment_type ILIKE 'VARCHAR';

SELECT count(*) = 1700 AND bool_and(c = repeat('A', 1000) || rowid::VARCHAR) FROM db.t;

SELECT compression FROM pragma_storage_info('temperatures_double') WHERE compression='Patas';

INSERT INTO test select false from range(2048);

INSERT INTO test select 2 from range(2048);

INSERT INTO test select 7 from range(512);

select distinct on (types) types from (select vector_type(a) from test offset 8192) tbl(types);

SELECT compression FROM pragma_storage_info('t') WHERE compression='RLE';

SELECT * FROM tbl WHERE rle_val=100;

CREATE TABLE retained AS
SELECT i, k, n FROM rle_input WHERE k >= 3 AND k <= 7 ORDER BY i DESC;

CREATE TABLE t (id BIGINT, v TINYINT USING COMPRESSION rle, keep SMALLINT USING COMPRESSION rle);

SELECT count(*), sum(id) FROM t WHERE v<40;

INSERT INTO test SELECT * FROM repeat(1, 1000);

INSERT INTO test SELECT * FROM repeat(6, 1000);

INSERT INTO integers SELECT 2;

SELECT count(*) = 12291 AND bool_and(v = expected(id)) AND bool_and(n IS NOT DISTINCT FROM CASE WHEN id % 13 = 0 THEN NULL ELSE expected(id) END) FROM db.runs;

SELECT COUNT(*), SUM(rle_val), MIN(rle_val), MAX(rle_val), SUM(rle_val_null), COUNT(rle_val_null) FROM tbl2 WHERE id >= 1500 and id <= 2500 AND id_modulo=3;

create table tbl as SELECT * FROM (
    VALUES
        (['first name', 'last name', 'username'], 60),
        (['first name'], 0),
        (['username'], 0),
        (['first name', 'last name', 'username'], 0),
        (['first name', 'last name', 'username'], 0),
        (['username'], 0),
        (['username'], 0)
) AS t(attributes, minutes_duration);

INSERT INTO test SELECT {'a': i} s FROM repeat(2, 1000) tbl(i);

set logging_level='info';

SELECT message.split(': ')[2]::INTEGER FROM duckdb_logs
where
	message.starts_with('ColumnDataCheckpointer FinalAnalyze') and
	message.contains('test_uncompressed') and
	message.contains('VALIDITY') and
	message.contains('UNCOMPRESSED');

CREATE TABLE test_uncompressed AS SELECT
	case
		when i = 0 or (i % 512 != 0 and (i % 512) < 350 or (i % 512) > 450)
			then null
		else 1337
	end
	FROM range(getvariable('dataset_size')) tbl(i);

with intermediates as (
	select i % 2048 as i
	from range(0, 10_000) t(i)
)
insert into test select case when
	i = 0 or
	i = 6 or
	i = 1000 or
	i = 1500 or
	i = 2000
	then 1337
else null end from intermediates;

INSERT INTO test SELECT CASE WHEN i % 3 = 0 THEN 1337 ELSE NULL END FROM range(0, 10000) tbl(i);

CREATE TABLE test_uncompressed AS SELECT
	case
		when i = 0 or (i % 512 != 0 and (i % 512) < 350 or (i % 512) > 450)
			then false
		else true
	end
	FROM range(getvariable('dataset_size')) tbl(i);

with intermediates as (
	select i % 2048 as i
	from range(0, 10_000) t(i)
)
insert into test select case when
	i = 0 or
	i = 6 or
	i = 1000 or
	i = 1500 or
	i = 2000
	then true
else false end from intermediates;

INSERT INTO test SELECT CASE WHEN i % 3 = 0 THEN true ELSE false END FROM range(0, 10000) tbl(i);

INSERT INTO test SELECT case when i = 0 or (i % 512 != 0 and (i % 512) < 350 or (i % 512) > 450) then false else true end FROM range(0,10000) tbl(i);

with intermediates as (
	select i % 2048 as i
	from range(0, 10_000) t(i)
)
insert into test select case when
	i = 0 or
	i = 6 or
	i = 1000 or
	i = 1500 or
	i = 2000
	then false
else true end from intermediates;

INSERT INTO test SELECT case when i%25=0 then true else false end FROM range(0,1025) tbl(i);

USE roaring_corrupt_container_count;

USE roaring_corrupt_metadata_truncated;

INSERT INTO test SELECT case when i%3=0 then 1337 else null end FROM range(0,10000) tbl(i);

ALTER TABLE reused_roaring ADD COLUMN v BIGINT;

SELECT count(*) FROM reused_roaring
WHERE i % 2048 IN (3, 29, 1401)
  AND v IS DISTINCT FROM CASE WHEN CASE (i // 2048) % 7
      WHEN 0 THEN i % 3 = 0
      WHEN 1 THEN i % 97 = 0
      WHEN 2 THEN i % 97 <> 0
      WHEN 3 THEN i % 2048 < 1536
      WHEN 4 THEN i % 512 BETWEEN 100 AND 350
      WHEN 5 THEN i % 2048 IN (3, 29, 1401)
      ELSE i % 2048 NOT IN (3, 29, 1401) END
    THEN NULL ELSE i + 1 END;

SELECT count(DISTINCT column_name) FROM pragma_storage_info('test')
WHERE column_name IN ('single_run', 'repeated_run', 'single_null', 'repeated_null')
  AND compression = 'Roaring';

INSERT INTO db.unique_strings SELECT i, repeat(md5(i::VARCHAR),8) FROM range(6000) t(i);

SELECT count(*), bool_and(value IS NOT DISTINCT FROM CASE WHEN id%13=0 THEN NULL ELSE (id//2)%1000 END) FROM db.numbers WHERE id%2048=0;

DEALLOCATE sparse;

SELECT count(*)>0 AND bool_and(v IS NOT DISTINCT FROM expected(id)) FROM db.wide WHERE k32<4;

CREATE TABLE test(
    id BIGINT,
    n INTEGER USING COMPRESSION RLE,
    z VARCHAR USING COMPRESSION ZSTD,
    d VARCHAR USING COMPRESSION DICTIONARY);

SELECT (count(*)=4097)::INTEGER,
       (count(*) FILTER (WHERE n IS DISTINCT FROM CASE
            WHEN id=1 THEN NULL
            WHEN id=257 THEN 1
            WHEN id%257=0 THEN NULL
            ELSE (id%2)::INTEGER
        END)=0)::INTEGER,
       (count(*) FILTER (WHERE z IS DISTINCT FROM CASE
            WHEN id%997=0 THEN NULL
            WHEN id%997=1 THEN ''
            WHEN id=2048 THEN repeat('L', 300000)
            ELSE concat(repeat('value-', 8), id::VARCHAR)
        END)=0)::INTEGER,
       (count(*) FILTER (WHERE d IS DISTINCT FROM CASE
            WHEN id=32 THEN repeat('x', 300000)
            ELSE concat('value-', (id%7)::VARCHAR)
        END)=0)::INTEGER
FROM test;

INSERT INTO normal_string values (repeat('b', 3900));

SELECT list_aggr(str_split(a,''),'min'), list_aggr(str_split(a,''),'min'), strlen(a)  from big_string;

INSERT INTO blobs VALUES('\xaa\xff\xaa'), ('\xAA\xFF\xAA\xAA\xFF\xAA'), ('\xAA\xFF\xAA\xAA\xFF\xAA\xAA\xFF\xAA');

INSERT INTO blob_empty VALUES(''), (''::BLOB);

DROP TABLE blob_empty;

INSERT INTO test_empty VALUES('B');

DROP TABLE test_empty_large;

drop type if exists test_result;

SET storage_compatibility_version='v1.0.0';

INSERT INTO test SELECT CONCAT('A-',(i%5)::VARCHAR) FROM range(0,1025) tbl(i);

USE string_corrupt_dict_offset;

USE string_corrupt_overflow_continuation;

CREATE TABLE t (i INTEGER, s VARCHAR USING COMPRESSION UNCOMPRESSED);

INSERT INTO test SELECT {'a': concat('0000000000000000000', (i%250)::VARCHAR)} FROM range(0, 10000) tbl(i);

select sum(a::INT) from test;

CREATE TABLE target AS SELECT * FROM source LIMIT 0;

SET enable_block_allocator=true;

SELECT compression FROM pragma_storage_info('t') WHERE segment_type='VALIDITY' AND compression='Uncompressed';

INSERT INTO big_string values (repeat('a', 8000), 1);

INSERT INTO big_string values (repeat('f', 1), 6);

set variable my_string = (
	select concat(range(0,1000)::VARCHAR)
);

SET default_block_size = '16384';

USE zstd_corrupt_count;

USE zstd_corrupt_page_offset_boundary;

select count(*) from pragma_storage_info('zstd_data') where compression='ZSTD';

SELECT SUM(strlen(s)) FROM t;

INSERT INTO fk_integers VALUES (3);

SET memory_limit = '1792kB';

SET debug_abort_on_wal_failure=true;

SELECT count(*) AS n, sum(id) AS s FROM t;

CREATE TABLE u AS SELECT id FROM b WHERE false;

SELECT count(*) FROM small;

DELETE FROM integers WHERE i%2=0;

DELETE FROM integers WHERE i%3=0;

INSERT INTO test SELECT * FROM generate_series(1000, 1099);

INSERT INTO test SELECT 1 FROM generate_series(0, 4000);

DELETE FROM test WHERE a=12;

SELECT COUNT(*) FROM integers;

SELECT (stats(i)).approx_unique BETWEEN 32 AND 130,
       (stats(s)).approx_unique BETWEEN 32 AND 130,
       (stats(d)).approx_unique BETWEEN 32 AND 130
FROM clustered LIMIT 1;

ALTER TABLE clustered ALTER COLUMN i TYPE BIGINT;

SET debug_verify_vector='none';

SET temp_file_encryption=true;

DROP TABLE big;

SET enable_external_access=false;

DETACH enc;

SELECT COUNT(*) FROM attach_no_wal.integers;

INSERT INTO enc.test VALUES (10, 'hello');

create table test as from (values
		('hello world'),
		(NULL),
		('this is a long string')
	) t(s);

select s.total_string_length from (select stats(s) s from test limit 1);

CREATE VIEW v1 AS SELECT current_schema();

set external_file_cache_local_max_block_size=4096;

set external_file_cache_local_max_block_size=8192;

SELECT count(*) > 100 FROM duckdb_external_file_cache();

set validate_external_file_cache='VALIDATE_REMOTE';

SELECT count(*)
FROM read_parquet('https://github.com/duckdb/duckdb-data/releases/download/v1.0/city_temperature.parquet');

SET GLOBAL checkpoint_threshold = '10GB';

SELECT (SELECT count(*) FROM cdb.c WHERE id IN (5, 1100, 1500, 1900, 3148, 3548, 3948, 4101, 9000, 9001, 9002, 9003, 12293, 16389, 19999)),
       (SELECT count(*) FROM (SELECT * FROM cdb.c WHERE id IN (5, 1100, 1500, 1900, 3148, 3548, 3948, 4101, 9000, 9001, 9002, 9003, 12293, 16389, 19999)
                              EXCEPT SELECT * FROM crow(0, 20000)));

INSERT INTO cdb.c SELECT * FROM crow(0, 20000)
WHERE (o BETWEEN 15000 AND 15999 OR o BETWEEN 8000 AND 8999 OR o < 1000) AND o % 3 = 0;

UPDATE cdb.c SET id = id + 1000000;

CREATE TABLE tbl (a STRUCT("id" VARCHAR), b STRUCT("id" VARCHAR));

SET debug_skip_checkpoint_on_commit=true;

SELECT * FROM strings;

INSERT INTO t SELECT range, repeat('x', 100) FROM range(10000);

SELECT MIN(x) = '-infinity', MAX(x) = '-infinity' FROM t;

SELECT MIN(d), MAX(d), MIN(ts), MAX(ts) FROM legacy_infinity_stats.legacy_infinity_stats;

SET wal_autocheckpoint='1GB';

CREATE TABLE old.t AS SELECT range AS i FROM range(3);

DETACH upgraded;

SELECT m_sum(c) FROM t LIMIT 1;

INSERT INTO t SELECT CASE WHEN i % 10 = 0 THEN NULL ELSE range(2 + i % 4) END, [range(i % 3), range(5)] FROM range(1000) t(i);

SELECT s.min_list_length, s.max_list_length, s.total_list_length = (SELECT sum(len(l)) FROM t) FROM (SELECT stats(l) s FROM t LIMIT 1);

SELECT s.total_list_length FROM (SELECT stats(l) s FROM nulls LIMIT 1);

CREATE TABLE multi_rg(l INT[]);

INSERT INTO wal SELECT [1, 2, 3] FROM range(400000);

SET experimental_metadata_reuse=false;

CREATE TABLE segments AS SELECT CASE WHEN i % 5 = 0 THEN NULL WHEN i < 60000 THEN [1, 2, 3] ELSE range(i % 7 + 10) END AS l FROM range(120000) t(i);

CREATE TABLE map_list(l MAP(INTEGER, INTEGER[]));

INSERT INTO nested_list SELECT [[1, 2, 3]] FROM range(200000);

INSERT INTO tuple_list SELECT row([1, 2, 3]) FROM range(200000);

SELECT s.child_stats.child_stats.value.max_list_length, s.child_stats.child_stats.value.total_list_length FROM (SELECT stats(l) s FROM map_list LIMIT 1);

CREATE TABLE t(l INT[]);

SELECT * FROM test ORDER BY 1, 2, 3;

INSERT INTO bigtbl FROM range(1000000);

CREATE TABLE tbl AS SELECT
    i AS c0, i AS c1, i AS c2, i AS c3, i AS c4
FROM range(200000) t(i);

SELECT COUNT(*), SUM(x) FROM other_tbl;

INSERT INTO ducklake_column VALUES (1);

SELECT COUNT(DISTINCT column_name) FROM pragma_storage_info('wide_tbl', include_segment_info=true, loaded_segments_only=true);

ALTER TABLE wide_tbl DROP COLUMN c10;

SELECT COUNT(*), SUM(c5) FROM wide_tbl;

CREATE TABLE db1.wide_tbl AS SELECT
    i AS id,
    md5(i::VARCHAR || 'c0') AS c0,
    md5(i::VARCHAR || 'c1') AS c1,
    md5(i::VARCHAR || 'c2') AS c2,
    md5(i::VARCHAR || 'c3') AS c3,
    md5(i::VARCHAR || 'c4') AS c4,
    md5(i::VARCHAR || 'c5') AS c5
FROM range(50000) t(i);

ALTER TABLE db1.wide_tbl DROP COLUMN c3;

UPDATE wide_tbl SET c6 = c6 + 1, c7 = c7 + 1 WHERE c0 < 100;

CREATE TABLE stable(i INTEGER PRIMARY KEY, s VARCHAR, items INTEGER[]);

SET VARIABLE int_stats = (SELECT stats(i) FROM stable LIMIT 1);

SELECT i, items[1], items[2] FROM stable WHERE s = 'value-17';

INSERT INTO changed VALUES (4);

CREATE TABLE test (a INTEGER, b STRING);

UPDATE test SET b='test123' WHERE a=12;

SELECT SUM(a), COUNT(a) FROM test;

CREATE TABLE test(a INTEGER, b INTEGER);

UPDATE test SET b=4 WHERE a=1;

INSERT INTO test SELECT * FROM range(1000000);

INSERT INTO legacy_nan_stats.legacy_nan_stats VALUES ('nan'::FLOAT, 'nan'::DOUBLE);

INSERT INTO test_list_2 SELECT 1, row(['a', 'b', 'c', 'd', 'e', 'f'], ['A', 'B'], [1, 5, 9]) FROM range(10);

DROP TABLE null_byte;

INSERT INTO t SELECT range+130000, 'new_'||(range+130000), range*2 FROM range(130000);

CREATE TABLE t(i INT);

INSERT INTO t SELECT * FROM t;

INSERT INTO test VALUES (NULL);

INSERT INTO t1 SELECT *, random() FROM range(200000);

CREATE TEMPORARY TABLE test2 (a INTEGER);

INSERT INTO t SELECT i, 1 FROM range(0, 130000) r(i);

SET index_scan_percentage = 0;

UPDATE test SET a=500000 WHERE a=0;

SELECT compression FROM pragma_storage_info('db.t') WHERE segment_type = 'BLOB' AND compression != 'Uncompressed';

SET memory_limit='90MB';

SELECT val = ('row2048' || repeat('Y', 50000))::BLOB FROM db.t WHERE id = 2048;

SELECT val = ('row1023' || repeat('Y', 5000))::BLOB FROM db.t2 WHERE id = 1023;

SELECT val = ('upd1500' || repeat('Z', 5000))::BLOB FROM db.t2 WHERE id = 1500;

CREATE TABLE t AS
SELECT CASE WHEN i = 0 THEN repeat('x', 2*1024*1024) ELSE NULL END AS v
FROM range(50000) tbl(i);

CREATE TABLE a(k BIGINT PRIMARY KEY, v VARCHAR);

CREATE SEQUENCE checkpoint_marker;

SELECT count(*), sum(k) FROM a;

INSERT INTO m.a SELECT range, 'value-' || range::VARCHAR FROM range(128);

CHECKPOINT m;

INSERT INTO m.a SELECT range, 'value-' || range::VARCHAR FROM range(122880,123880);

SELECT count(DISTINCT row_group_id) FROM pragma_storage_info('m.a');

INSERT INTO integers VALUES (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100);

SELECT [*COLUMNS(*)] = range(i0, i0 + 100) FROM integers2;

CREATE TABLE strings(i0 VARCHAR, i1 VARCHAR, i2 VARCHAR, i3 VARCHAR, i4 VARCHAR, i5 VARCHAR, i6 VARCHAR, i7 VARCHAR, i8 VARCHAR, i9 VARCHAR, i10 VARCHAR, i11 VARCHAR, i12 VARCHAR, i13 VARCHAR, i14 VARCHAR, i15 VARCHAR, i16 VARCHAR, i17 VARCHAR, i18 VARCHAR, i19 VARCHAR, i20 VARCHAR, i21 VARCHAR, i22 VARCHAR, i23 VARCHAR, i24 VARCHAR, i25 VARCHAR, i26 VARCHAR, i27 VARCHAR, i28 VARCHAR, i29 VARCHAR, i30 VARCHAR, i31 VARCHAR, i32 VARCHAR, i33 VARCHAR, i34 VARCHAR, i35 VARCHAR, i36 VARCHAR, i37 VARCHAR, i38 VARCHAR, i39 VARCHAR, i40 VARCHAR, i41 VARCHAR, i42 VARCHAR, i43 VARCHAR, i44 VARCHAR, i45 VARCHAR, i46 VARCHAR, i47 VARCHAR, i48 VARCHAR, i49 VARCHAR, i50 VARCHAR, i51 VARCHAR, i52 VARCHAR, i53 VARCHAR, i54 VARCHAR, i55 VARCHAR, i56 VARCHAR, i57 VARCHAR, i58 VARCHAR, i59 VARCHAR, i60 VARCHAR, i61 VARCHAR, i62 VARCHAR, i63 VARCHAR, i64 VARCHAR, i65 VARCHAR, i66 VARCHAR, i67 VARCHAR, i68 VARCHAR, i69 VARCHAR, i70 VARCHAR, i71 VARCHAR, i72 VARCHAR, i73 VARCHAR, i74 VARCHAR, i75 VARCHAR, i76 VARCHAR, i77 VARCHAR, i78 VARCHAR, i79 VARCHAR, i80 VARCHAR, i81 VARCHAR, i82 VARCHAR, i83 VARCHAR, i84 VARCHAR, i85 VARCHAR, i86 VARCHAR, i87 VARCHAR, i88 VARCHAR, i89 VARCHAR, i90 VARCHAR, i91 VARCHAR, i92 VARCHAR, i93 VARCHAR, i94 VARCHAR, i95 VARCHAR, i96 VARCHAR, i97 VARCHAR, i98 VARCHAR, i99 VARCHAR);

INSERT INTO integers (i1) VALUES (NULL);

INSERT INTO t SELECT i, i::INTEGER FROM range(5000000) t(i);

CREATE TABLE p AS SELECT i FROM range(1228800) t(i);

DELETE FROM tbl WHERE i < 61440 AND i % 2 = 0;

INSERT INTO bp_tbl SELECT 2 FROM range(0, 10000) tbl(i);

SELECT * FROM pragma_storage_info('bp_tbl', loaded_segments_only=true);

SET storage_block_prefetch='debug_force_always';

CALL truncate_duckdb_logs();

SET threads=4;

INSERT INTO integers SELECT range FROM range(5);

CREATE TABLE integers AS SELECT range AS i FROM range(500000);

SELECT count(*) FROM integers WHERE i BETWEEN 230000000000 AND 230010999999;

SELECT count(DISTINCT block_id) FROM pragma_storage_info('gaps') WHERE segment_type IN ('BIGINT', 'VARCHAR');

SELECT sum(d) > 0 FROM cap_db.t;

SET enable_caching_operators=false;

SELECT count(*) FROM duckdb_logs_parsed('ReadAheadBudget');

DETACH read_duckdb_test2;

DETACH rd;

CREATE SCHEMA rd.s2;

CREATE TABLE rd.my_tbl AS SELECT 100 i, 84 col1;

CREATE TABLE t_to_drop (r BIGINT, s VARCHAR);

INSERT INTO test VALUES (repeat('a', 1000000));

SELECT a = repeat('a', 1000010) FROM test;

INSERT INTO v VALUES (-2, 'b'::VARIANT);

SELECT count(*), sum(i) FROM g;

SELECT count(*), count(*) FILTER (WHERE id >= 1000) FROM db.t;

DELETE FROM db.w WHERE id >= 2048;

INSERT INTO big SELECT
    range::INTEGER,
    (range * 10)::BIGINT,
    'val_' || range::VARCHAR,
    CASE WHEN range % 7 = 0 THEN NULL ELSE range::INTEGER END
FROM range(500000);

SELECT k, v, s, n FROM big WHERE k IN (3, 4, 5, 6, 7) ORDER BY k;

SELECT k, v FROM big WHERE k IN (200000, 200001, 200002, 200003) ORDER BY k;

SELECT k, v, s, n FROM big WHERE k IN (101, 103, 105) ORDER BY k;

DELETE FROM del WHERE k BETWEEN 100 AND 200099;

CHECKPOINT rowid_gap_alter;

DROP INDEX rowid_gap_alter.idx_i;

CREATE UNIQUE INDEX idx_i_after_alter ON rowid_gap_alter.t(i);

CHECKPOINT rowid_gap_append_latest;

INSERT INTO rowid_gap_append_latest.t VALUES (999999);

CHECKPOINT rowid_gap_append_old_storage;

SELECT rowid, i FROM rowid_gap_append_old_storage.t WHERE i = 999999;

DETACH rowid_gap_bulk_append;

CREATE TABLE rowid_gap_vacuum_idx.t AS SELECT i FROM range(6144) tbl(i);

SELECT min(rowid), max(rowid), count(*) FROM rowid_gap_vacuum_idx.t;

CREATE TABLE rowid_gap_dense_vacuum.t(i INTEGER);

SELECT COUNT(DISTINCT row_group_id) FROM pragma_storage_info('rowid_gap_dense_vacuum.t');

CREATE TABLE geom_legacy.t(i INTEGER, geom GEOMETRY);

CREATE INDEX t_geom_idx ON geom_legacy.t(geom);

SELECT COUNT(DISTINCT row_group_id) FROM pragma_storage_info('geom_legacy.t');

SELECT rowid, i FROM geom_legacy.t WHERE i = 2548;

CREATE UNIQUE INDEX t_i_idx ON remap_geom.t(i);

FORCE CHECKPOINT remap_geom;

INSERT INTO rowid_gap_remap.t
SELECT
	i,
	CASE WHEN i IN (1000, 1001) THEN 7 ELSE i + 10000 END,
	CASE WHEN i BETWEEN 1000 AND 1010 THEN NULL ELSE i END
FROM range(2048) tbl(i);

CREATE INDEX t_n_idx ON rowid_gap_remap.t(n);

EXPLAIN ANALYZE SELECT rowid, i FROM rowid_gap_remap.t WHERE i = 2048;

DETACH rowid_gap_remap;

INSERT INTO rowid_gap_live_vacuum.t
SELECT 408640 + range, (408640 + range) * 2, (408640 + range) * 3 FROM range(40000);

SELECT COUNT(DISTINCT row_group_id) FROM pragma_storage_info('rowid_gap_live_vacuum.t');

PRAGMA disable_profiling;

CREATE INDEX t_i_idx ON rowid_gap_old_storage_idx.t(i);

SELECT count(*) FROM rowid_gap_old_storage_idx.t WHERE rowid >= 2048 AND rowid < 4096;

CHECKPOINT rebuild_then_remap;

SELECT CASE rowid WHEN 2048 THEN 'dense-renumbered' WHEN 4096 THEN 'preserved' ELSE CAST(rowid AS VARCHAR) END
FROM rebuild_then_remap.t WHERE i = 4096;

FORCE CHECKPOINT rebuild_then_remap;

CHECKPOINT remap_tasks;

FORCE CHECKPOINT remap_tasks;

SELECT rowid, i FROM remap_tasks.t WHERE i = 8195;

INSERT INTO remap_across_gap.t SELECT i FROM range(1000, 2000) tbl(i);

SELECT rowid, i FROM remap_across_gap.t WHERE i IN (999, 2000) ORDER BY i;

CREATE TABLE remap_partial.t(i INTEGER, g INTEGER);

CREATE INDEX t_g_idx ON remap_partial.t(g);

SELECT COUNT(DISTINCT row_group_id) FROM pragma_storage_info('remap_partial.t');

CHECKPOINT remap_collision;

DELETE FROM remap_collision.t WHERE i < 4096 AND i % 3 <> 2;

EXPLAIN ANALYZE SELECT rowid, i FROM remap_collision.t WHERE g = 9;

INSERT INTO geom_no_merge.t
SELECT i, ('POINT (' || i || ' ' || i || ')')::GEOMETRY FROM range(1000, 2000) tbl(i);

DETACH geom_no_merge;

SELECT count(*) FROM geom_no_merge.t WHERE rowid >= 1000 AND rowid < 2000;

CREATE TABLE rowid_gap_lookup_db.leading AS SELECT i FROM range(245760) tbl(i);

SELECT count(*) FROM rowid_gap_lookup_db.leading WHERE rowid BETWEEN 0 AND 10;

DELETE FROM rowid_gap_lookup_db.leading WHERE rowid = 0;

SELECT count(*) FROM rowid_gap_lookup_db.middle WHERE rowid = 122880;

SELECT rowid, i FROM rowid_gap_lookup_db.middle WHERE rowid IN (42, 122880, 245760, 368640) ORDER BY rowid;

DELETE FROM rowid_gap_old_storage_dense.t WHERE i >= 2048 AND i < 4096;

SELECT count(*) FROM rowid_gap_old_storage_dense.t WHERE rowid >= 4096;

INSERT INTO t VALUES (999999);

SELECT a, b FROM test WHERE a=11 ORDER BY b;

INSERT INTO test VALUES (22, 23);

INSERT INTO test VALUES (repeat('a', 64), 1);

INSERT INTO test VALUES ('a'), ('bb'), ('ccc'), ('dddd'), ('eeeee');

DETACH direct_io;

SET force_mbedtls_unsafe = false;

SELECT MIN(i), MAX(i), COUNT(*), COUNT(i) FROM a_bool;

SELECT tags FROM duckdb_databases() WHERE database_name = 'storage_version64';

INSERT INTO integers values
	(0, 1),
	(0, 2),
	(1, 3),
	(1, NULL);

SET memory_limit='4MB';

SELECT sum(temporary_storage_bytes) > 0 FROM duckdb_memory();

set max_temp_directory_size='4MB';

CREATE OR REPLACE TABLE t2 AS SELECT random() FROM range(1000000);

set max_temp_directory_size='15gb';

SELECT current_setting('temp_directory').split('/')[-1];

set temp_directory=null;

DROP TABLE tail;

SELECT current_setting('enable_external_access');

SELECT COUNT(*) FROM t1;

SELECT LENGTH(list(i)::VARCHAR) > 0 FROM range(50000) t(i);

INSERT INTO TBL VALUES (1, 1);

CREATE UNIQUE INDEX iu ON t2(uid);

CREATE TABLE t (i BIGINT PRIMARY KEY, s VARCHAR USING COMPRESSION uncompressed);

SELECT tag, memory_usage_bytes > 0 FROM duckdb_memory() WHERE tag IN ('ART_INDEX', 'BASE_TABLE') ORDER BY tag;

CREATE INDEX idx_grp ON db.index_tbl(grp);

CREATE INDEX idx ON db.tbl(i);

CREATE TABLE db.pk_tbl(i INTEGER);

create table anno as select 42;

INSERT INTO test2 VALUES (13), (12), (11);

CREATE TABLE test AS FROM range(250000) t(i);

CREATE TABLE test(i INTEGER, j INTEGER);

CREATE TABLE multi_rg(s VARCHAR);

INSERT INTO test SELECT ['abc'], {'s': 'de'}, ['fg', 'hi', 'jk'] FROM range(10_000);

SELECT COALESCE(s.child_stats.s.total_string_length, 40000) FROM (SELECT stats(b) s FROM test LIMIT 1);

create table test(s VARCHAR);

INSERT INTO test_table (id) VALUES (42);

USE list_corrupt_offset_skip;

INSERT INTO a VALUES (3, [NULL]);

CREATE TABLE a(id INTEGER, c INT[]);

INSERT INTO a VALUES (1, [7, 8, 9, 10, 11, 12, 13, 14, 15]);

CREATE TABLE b(b INTEGER[][]);

INSERT INTO c VALUES (['hello', 'world']), (NULL), (['fejwfoaejwfoijwafew', 'b', 'c']), ([NULL, 'XXXXXXXXXXXXXXXXXXXXXXXX']);

SELECT * FROM arrays WHERE id = 4;

CREATE TABLE a(b MAP(INTEGER,INTEGER));

INSERT INTO b(i) SELECT {'b': 12};

CREATE TABLE d(
	i ROW(
		a INT,
		b INT
	) DEFAULT (
		{
			'a': 7 + 1,
			'b': 2 + 3
		}
	)
);

SELECT * FROM e;

SELECT c['r1']['a'] from a;

INSERT INTO a VALUES(NULL);

SELECT DISTINCT s.id FROM structs ORDER BY ALL;

SELECT COUNT(*) FROM a WHERE b IS NULL;

SELECT * FROM bits;

SELECT * FROM hugeints;

SELECT * FROM interval;

INSERT INTO timestamp VALUES (NULL,NULL,NULL,NULL );

SELECT * FROM timestamp WHERE micro=TIMESTAMP '2008-01-01 00:00:01.88926' ORDER BY micro;

SELECT * FROM uhugeints WHERE h = 42;

SELECT * FROM unsigned WHERE a = 42;

SELECT c FROM unsigned WHERE c < 10 ORDER BY 1;

INSERT INTO uuids VALUES ('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'), (NULL), ('47183823-2574-4bfd-b411-99ed177d3e43'), ('{10203040506070800102030405060708}');

insert into tbl SELECT NULL from range(154840);

INSERT INTO tbl select i, {'a': i, 'b': i % 5} from range(100) t(i);

CREATE TABLE variant_list(
	col STRUCT(
		f1 INTEGER,
		f2 VARIANT,
		f3 VARCHAR,
		f4 BOOL
	)
);

insert into tbl select t::VARIANT var from test_all_types() t;

create or replace table "tbl2" as select * from tbl;

insert into tbl VALUES (42);

set force_variant_shredding = 'STRUCT("Foo" INTEGER)';

SET force_variant_shredding = 'STRUCT(a INTEGER, b VARCHAR)';

SELECT v::VARCHAR FROM (VALUES
	(1, '{"a": 1, "b": "x", "c": 100}'::VARIANT),
	(2, '{"a": 2, "b": "y"}'::VARIANT),
	(3, '{"a": 3, "b": "z", "d": [1, 2, 3]}'::VARIANT),
	(4, NULL::VARIANT),
	(5, '{"a": 40, "b": "m"}'::VARIANT),
	(6, '{"a": 6, "b": "hello", "g": "extra"}'::VARIANT),
	(7, '{"a": 7, "b": "aaa"}'::VARIANT),
	(8, '{"a": 5, "b": "q", "e": {"nested": true}}'::VARIANT),
	(9, '{"a": 5, "b": "q"}'::VARIANT),
	(10, '{"a": 100, "b": "z"}'::VARIANT)
) tbl(id, v) ORDER BY v, id;

CREATE TABLE ints(col VARIANT);

SELECT count(*) FROM ints WHERE col = 1000::INTEGER::VARIANT;

SELECT count(*) FROM strs WHERE col > 'cherry'::VARIANT;

INSERT INTO nullable_ints VALUES (NULL::VARIANT);

SELECT s.min IS NULL, s.max IS NULL
FROM (SELECT stats(variant_comparator(col)) s FROM mixed LIMIT 1);

CREATE TABLE variants AS
SELECT '{"a":1,"a":2}'::JSON::VARIANT AS v;

SELECT COUNT(*) FROM variant_extract_pushdown WHERE v.x=5;

SELECT v.z FROM variant_extract_pushdown WHERE v.x=5 AND v.y=500;

SELECT v.x FROM variant_extract_pushdown WHERE v.x = 5 OR v.y = 400 ORDER BY ALL;

select s.fully_shredded.stats.min, s.fully_shredded.stats.max from (select stats(col[1]) s from tbl limit 1);

insert into tbl select
	[42, 21, 1337]
from range(5);

select s.fully_shredded.stats.min, s.fully_shredded.stats.max_string_length from (select stats(col.a) s from tbl limit 1);

insert into tbl select {'a': 'test', 'c': [42], 'b': false};

insert into tbl select {'a': {'b': 'hello', 'c': 'world'}} from range(5);

select b from tbl where col == {'b': 2, 'a': 2};

SET force_variant_shredding = 'STRUCT(id INT, s STRUCT(a INT, b INT))';

create table shredded_array (col VARIANT);

UPDATE messages SET msg = msg_json::VARIANT;

INSERT INTO t SELECT i, {'o': {'x': 42}, 'l': [42]}::VARIANT FROM range(100000, 100005) tt(i);

SELECT (SELECT v FROM t WHERE id = 1) = (SELECT v FROM t WHERE id = 100000);

select
	col.f2.a::integer
from t;

SELECT count(v[2]), count(v[2]::VARCHAR), count(v[2]::BIGINT),
       count(*) FILTER (WHERE v[2] IS NULL) FROM one_element_arrays;

SELECT count(obj.a.missing) FROM wrong_type;

SELECT count(DISTINCT j.did), count(*) FROM bluesky;

SELECT count(v::VARCHAR) FROM top_level;

CREATE TABLE deep_array AS SELECT deep_array::JSON::VARIANT AS v, i FROM src;

SELECT v::VARCHAR FROM deep_array WHERE i = 4;

SELECT v::VARCHAR FROM deep_object WHERE i = 15;

select * from fails;

SELECT DISTINCT vector_type(v) FROM case_clash;

SELECT sum((v).long_field_name_abcdefgh::INT), sum((v).other_long_field_name_xyz::INT), min(variant_keys(v)::VARCHAR) FROM distinct_keys;

insert into shredded_integer values ('hello world');

SELECT col.j::INT FROM tbl;

SELECT col FROM get_value_rows ORDER BY id;

CREATE TABLE db.lists(v VARIANT);

INSERT INTO db.objects SELECT NULL FROM range(2048);

CREATE OR REPLACE TABLE nested_variant AS
SELECT i AS id, {'tag': i + 100, 'payload': {'obj': {'a': i, 'b': 'value_' || i}}::VARIANT} AS n
FROM range(20) t(i);

SELECT id, n.payload.obj.a::BIGINT, n.payload.obj.b::VARCHAR
FROM nested_variant_view WHERE id >= 19 ORDER BY id;

SELECT s.has_no_null, s.has_null FROM (SELECT stats(mixed) s FROM v LIMIT 1);

SELECT x::VARCHAR FROM old.v ORDER BY ALL;

CHECKPOINT new;

SELECT a+2 FROM tbl;

CREATE OR REPLACE TABLE 'everflow_daily' AS SELECT case when i%10=0 THEN uuid()::VARCHAR ELSE 'N/A' END sub4 FROM range(10000) t(i);

SELECT memory_usage_bytes < 32768 FROM duckdb_memory() WHERE tag = 'ALLOCATOR';

INSERT INTO same_value VALUES (5), (1), (5);

UPDATE swapped SET i = s.v FROM (VALUES (3, 10), (0, 40)) s(id, v) WHERE swapped.rowid = s.id;

SELECT min(i), max(i), count(*) FROM stats;

INSERT INTO strings VALUES ('alpha'), (NULL), ('beta'), ('alpha');

SELECT DISTINCT compression FROM pragma_storage_info('constants') WHERE column_name = 'i' AND segment_type <> 'VALIDITY';

SET memory_limit='400KB';

CREATE TABLE t2 AS SELECT range i FROM range(2048);

INSERT INTO test SELECT r, r FROM range(2000,200000) t(r);

CREATE TEMP TABLE before AS SELECT count(DISTINCT row_group_id) AS c FROM pragma_storage_info('t');

CREATE TABLE autocheckpoint_db.delete_tbl(x INTEGER);

SELECT wal_size != '0 bytes' FROM pragma_database_size() WHERE database_name = 'autocheckpoint_db';

CREATE TABLE entry_count_db.tbl(x INTEGER);

SET tracked_metrics = ['storage.wal_replay_entry_count'];

CREATE UNIQUE INDEX i_index ON integers(i);

CREATE UNIQUE INDEX i_index ON integers USING art((i + j));

SET checkpoint_threshold='999999GB';

alter table bla rename to bla2;

SET debug_force_wal_fsync_failure=true;

INSERT INTO tbl SELECT range, 'value_' || range, range * 1.5, '2023-01-01 10:00:00'::TIMESTAMP + INTERVAL (range) DAY FROM range(10);

SELECT a, b, c, d FROM tbl WHERE (a) = 5;

CREATE INDEX idx_cd ON tbl(c,d);

INSERT INTO tbl VALUES (1, 'foo', 10.5, '2023-01-01 10:00:00');

SELECT * FROM tbl WHERE a = 0;

SELECT * FROM tbl WHERE a = 90;

EXPLAIN ANALYZE SELECT * FROM tbl WHERE a = 25010;

EXPLAIN ANALYZE SELECT * FROM tbl WHERE a = 1;

CREATE TABLE distinct_test AS SELECT 1::BIGINT AS a FROM range(2048);

SELECT count(*) FROM distinct_test WHERE CASE WHEN a IS DISTINCT FROM 1 THEN true ELSE false END;

CREATE TABLE t AS SELECT range::INT AS id FROM range(10);

select COUNT(d) != 0 from t;

select COUNT(r) != 0 from t;

SELECT typeof(i) FROM test;

DROP TABLE s;

CREATE TABLE db.other(x INT);

INSERT INTO db.other SELECT range FROM range(10000);

SET debug_skip_checkpoint_on_commit=false;

SELECT count(*) FROM t WHERE k='k7';

INSERT INTO t VALUES (4), (5);

CREATE INDEX idx ON t((tnorm(k)));

DELETE FROM t WHERE k = 'a';

CREATE TABLE t(a BIGINT, b VARCHAR);

SELECT count(*) FROM t WHERE b='one';

CREATE INDEX i ON t(b);

SELECT g, b FROM t WHERE b='y';

SELECT count(*) FROM t WHERE a='y';

SELECT count(*) FROM t WHERE a='z123';

INSERT INTO t VALUES (999999999, 'y', 999);

SELECT count(*) FROM t WHERE upper(b)='Y';

ALTER TABLE test ADD COLUMN r double DEFAULT pi();

CREATE TABLE person (
    name text,
    current_mood mood
);

CREATE TABLE test AS SELECT -i a, -i b FROM range(100000) tbl(i);

SELECT SUM(CASE WHEN b IS NULL THEN 1 ELSE 0 END) FROM test WHERE a>0 AND a%2=0;

UPDATE test SET b=NULL WHERE a>0 AND a%2=1;

SELECT a, b FROM test WHERE a>0 OR a IS NULL ORDER BY a;

UPDATE test SET b=NULL WHERE a='11';

SELECT * FROM timestamp WHERE t=TIMESTAMP '2007-01-01 00:00:01' ORDER BY t;

INSERT INTO t SELECT * FROM range(3, 130003);

CREATE VIEW test.v2 AS SELECT 42;
