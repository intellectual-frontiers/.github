SELECT ['a,b', 'x"y']::VARCHAR[2]::VARCHAR v, v::VARCHAR[2] = ['a,b', 'x"y'];

SELECT [['a b', ''], ['[x]', NULL]]::VARCHAR[2][2]::VARCHAR v, v::VARCHAR[2][2] = [['a b', ''], ['[x]', NULL]];

SELECT MAP{'\':''}::VARCHAR v, v::MAP(VARCHAR, VARCHAR) = MAP{'\':''};

SELECT {'k': 'x\'}::VARCHAR v, v::STRUCT(k VARCHAR) = {'k': 'x\'};

SELECT true=1;

SELECT false=0;

SELECT 1=true;

SELECT 0=false;

SELECT true='1';

SELECT true='0';

SELECT false='1';

SELECT true='false';

SELECT false='true';

SELECT '0'=true;

SELECT '1'=false;

CREATE TABLE bools AS SELECT CASE WHEN i % 3 = 0 THEN NULL ELSE i % 3 = 1 END AS b FROM range(5000) t(i);

SELECT count(*), sum(b::DECIMAL(4,4)) = 0 FROM bools WHERE NOT b;

CREATE TABLE dt (x DECIMAL(2,2));

SELECT x = 0 FROM dt ORDER BY x NULLS LAST;

INSERT INTO cast_table VALUES (1000, 'hello', 1000.0, [1000], {'i': 1000}, 1e308, 1000000000000000000000000000000, '\x');

CREATE TABLE str_tbl AS SELECT 'hello' my_str;

CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');

CREATE TYPE ab AS ENUM ('a', 'b');

SELECT TRY_CAST('- ' AS DECIMAL(10,2)), TRY_CAST('+ ' AS DECIMAL(18,3));

SELECT TRY_CAST('1e ' AS INTEGER), TRY_CAST('1e+ ' AS BIGINT), TRY_CAST('1e-' || chr(9) AS HUGEINT);

SELECT ' -4'::INTEGER, TRY_CAST('-' AS INTEGER);

CREATE TABLE temporal_cast_input(id INTEGER, value VARCHAR);

SELECT
	TRY_CAST(value AS TIMESTAMP_S) IS NULL,
	TRY_CAST(value AS TIMESTAMP_MS) IS NULL,
	TRY_CAST(value AS TIMESTAMPTZ_NS) IS NULL
FROM temporal_cast_input
WHERE id = 1;

SELECT id, TRY_CAST(value AS TIME_NS) IS NULL
FROM temporal_cast_input
WHERE id IN (1, 3)
ORDER BY id;

SELECT '9.90'::DECIMAL(4,3)::DECIMAL(3,2);

SELECT '9.90000000'::DECIMAL(9,8)::DECIMAL(8,7);

SELECT '9.9000000000000000000000000000000000000'::DECIMAL(38,37)::DECIMAL(37,36);

select 100000000000000000000 > 99999999999999999999.99999;

SELECT printf('%.17g', 0.41000000000000003), printf('%.17g', CAST('0.41000000000000003' AS DOUBLE));

WITH p(v) AS (VALUES (CAST('0.41000000000000003' AS DECIMAL(18,17))))
SELECT printf('%.17g', v::DOUBLE), printf('%.17g', CAST(v::VARCHAR AS DOUBLE)) FROM p;

SELECT printf('%.17g', CAST(CAST('0.000000000000000000000001' AS DECIMAL(38,38)) AS DOUBLE)),
       printf('%.17g', CAST('0.000000000000000000000001' AS DOUBLE));

SELECT printf('%.9g', CAST(CAST('0.0000000000000001' AS DECIMAL(20,20)) AS FLOAT)),
       printf('%.9g', CAST('0.0000000000000001' AS FLOAT));

SELECT count(*) FROM (SELECT (i*0)::DECIMAL(38,34)::FLOAT f FROM range(5000) t(i)) WHERE f::VARCHAR LIKE '-%';

SELECT 0::DECIMAL(38,0)::DOUBLE;

select '1e308'::float;

select '-1e308'::float;

SELECT (2::DOUBLE ^ 81)::VARCHAR, (2::DOUBLE ^ 91)::VARCHAR, (2::DOUBLE ^ 807)::VARCHAR;

SELECT k, (2::DOUBLE ^ k)::VARCHAR, nextafter(2::DOUBLE ^ k, 0)::VARCHAR, nextafter(2::DOUBLE ^ k, 'inf'::DOUBLE)::VARCHAR
FROM (VALUES (80), (81), (82), (90), (91), (92), (806), (807), (808)) t(k)
ORDER BY k;

CREATE TABLE powers AS SELECT * FROM (VALUES (1, 2::DOUBLE ^ 81), (2, 2::DOUBLE ^ 91), (3, 2::DOUBLE ^ 807), (4, NULL)) t(id, v);

SELECT format('{}', v) FROM powers WHERE v IS NOT NULL ORDER BY id;

SELECT 'POINT(2.4178516392292583e+24 8.535058474086213e+242)'::GEOMETRY::VARCHAR;

SELECT count(*), count(*) FILTER (TRY_CAST(v::VARCHAR AS FLOAT) IS DISTINCT FROM v)
FROM (SELECT (s * (2::DOUBLE ^ k))::FLOAT AS v FROM range(-149, 128) t(k), (VALUES (1), (-1)) u(s));

SELECT ['a, b']::VARCHAR, ['a, b'::UNION(s VARCHAR, i INT)]::VARCHAR, ['a, b'::VARIANT]::VARCHAR;

SELECT {'k': 'x'', ''y'::UNION(s VARCHAR, i INT)}::VARCHAR, MAP{1: 'a, b'::UNION(s VARCHAR, i INT)}::VARCHAR, MAP{'a, b'::UNION(s VARCHAR, i INT): 1}::VARCHAR;

SELECT [1::UNION(s VARCHAR, i INT), 'x'::UNION(s VARCHAR, i INT), NULL]::VARCHAR, [[1, 2]::UNION(l INT[], s VARCHAR)]::VARCHAR;

SELECT ['a, b'::UNION(s VARCHAR, i INT), 'c'::UNION(s VARCHAR, i INT)]::UNION(s VARCHAR, i INT)[2]::VARCHAR;

SELECT [union_value(s := NULL::VARCHAR)::UNION(s VARCHAR, i INT), 'NULL'::UNION(s VARCHAR, i INT)]::VARCHAR;

INSERT INTO tab2 VALUES(64,77,40);

INSERT INTO tab2 VALUES(46,51,23);

select '127.1'::TINYINT, '-128.1'::TINYINT;

select '2147483647.1'::INTEGER, '-2147483648.1'::INTEGER;

select '170141183460469231731687303715884105727.1'::HUGEINT, '-170141183460469231731687303715884105728.1'::HUGEINT;

select '65535.1'::USMALLINT;

select '18446744073709551615.1'::UBIGINT;

select '5.5e-1'::bigint;

select '3276.7e1'::SMALLINT, '-3276.8e1'::SMALLINT;

select '922337203685477580.7e1'::BIGINT, '-922337203685477580.8e1'::BIGINT;

select '25.5e1'::UTINYINT;

select '429496729.5e1'::UINTEGER;

select '34028236692093846346337460743176821145.5e1'::UHUGEINT;

select '-0.00000000000000000000000000000009223372036854775807e50'::BIGINT;

select '-0.00000000000170141183460469231731687303715884105727e50'::HUGEINT;

select '0e32767'::int;

select '0.10000000000000000000e0'::BIGINT;

select ('-0.' || repeat('0', 32768) || '5e0')::INTEGER;

select ('0.' || repeat('0', 65536) || '5')::BIGNUM;

select ('0.5' || repeat('0', 65536) || '1')::BIGNUM;

select ('-2.5' || repeat('0', 40000))::BIGNUM;

SELECT CAST('7.' || repeat('0', 70000) || '9' AS UBIGINT), CAST('7.' || repeat('0', 70000) || '9' AS UHUGEINT), CAST('-7.' || repeat('0', 131072) || '9' AS SMALLINT), CAST('7.' || repeat('9', 70000) AS INT);

SELECT CAST('0.5' || repeat('0', 70000) AS BIGINT);

SELECT '[12,13,14]'::INT[];

SELECT CAST('[Hello World!]' AS VARCHAR[]);

SELECT '[Cast like this]':: VARCHAR[];

select UNNEST('[NULL,, NULL]'::varchar[]);

SELECT UNNEST('[NULL, NULL ,]'::varchar[]);

SELECT CAST('[ [12,13,14], [8, 9], [4], [2, 1, 0] ]' AS INT[][]) a, a::VARCHAR::INT[][] b, a == b;

SELECT CAST('[ [12,13,14], [8, 9], [4], [2,  1,  0] ]' AS VARCHAR[]);

CREATE TABLE stringList (col1 VARCHAR);

SELECT col1::VARCHAR[] FROM stringList;

INSERT INTO nestedStrings VALUES ('[["hello"], ["world"],["!"]]'), ('[["Amazing"],["text"]]'), ('[[Hello World!]]');

CREATE TABLE superNestedStrings (col1 VARCHAR);

SELECT col1::VARCHAR[][][][][] FROM superNestedStrings;

INSERT INTO tbl VALUES ('[1,2,2]'), ('[345,67865,44,4]'), ('[5,6,7]');

CREATE TABLE doubleNested (col1 VARCHAR);

SELECT col1::INT[][] FROM doubleNested;

INSERT INTO tripleNested VALUES ('[[[1,2],[3]]]'), ('[[[4]]]');

CREATE TABLE crazyNested (col1 VARCHAR);

SELECT col1::INT[][][][][][] FROM crazyNested;

SELECT CAST($$[\'hello\',\'world\', \'!\']$$ AS VARCHAR[]);

SELECT CAST($$[can\'t, you\'re, i\'m]$$ AS VARCHAR[]);

SELECT CAST($$[']', "hello", "world"]$$ AS VARCHAR[]);

SELECT CAST('[          [ [12,     13,14], [8, 9         ]  ],[[ 4    ]   ],        [[    2, 1,     0 ]         ] ]  ' AS INT[][][]);

SELECT CAST('[   hello     ,   world      , !         ]' AS VARCHAR[]);

SELECT '[]'::VARCHAR[];

SELECT '[]'::INT[][][][];

SELECT '[[1, 2, 3], [], NULL, [NULL], [4, NULL]]'::INT[][];

INSERT INTO null_tbl VALUES(NULL), (NULL), ('[NULL]');

SELECT CAST(NULL AS INT[]);

SELECT CAST('[NULL]' AS INT[][]);

SELECT CAST('[[12,13,14], [8, 9], [2, NULL, 1]]' AS INT[][]);

SELECT TRY_CAST('Hello World' AS INT[]);

INSERT INTO try_cast_tbl VALUES ('[1,2,X,2]'), ('[hello DuckDB]'), ('[345,oops,44,4.0]'), ('[12345678901]'), ('[5,6,7]'), ('[3 0, 1]');

SELECT * FROM tbl WHERE cast(col1 as int[]) = [1, 2, 2];

SELECT cast(col1 as int[]) FROM tbl WHERE LEN(cast(col1 as int[])) < 4;

INSERT INTO struct_tbl1 VALUES('[{a: "hii"}, {a: "hellooo"}]');

SELECT CAST('[ [{a:[12,13,14], b:"🦆"}], [{a:[12,13,14], b:"🦆", c:100}] ]' AS STRUCT(a INT[], b VARCHAR, c FLOAT)[][]);

SELECT '[{a: hii}, {a: "{" }]'::STRUCT(a VARCHAR)[] FROM struct_tbl1;

SELECT '[{"name":"a}b"}]'::STRUCT(name VARCHAR)[];

CREATE TABLE struct_tbl2(col VARCHAR);

SELECT col::STRUCT(a INT, b VARCHAR)[] FROM struct_tbl2;

SELECT col FROM int_list;

SELECT * FROM assorted_lists;

select '[{"bar":"\\\""}]'::STRUCT(bar VARCHAR)[];

select $$[\  \\abc\\ \ , def, ghi]$$::VARCHAR[] a, a[1], len(a[1]);

SELECT $$[hello, world]$$::VARCHAR[];

SELECT $$[hello\ world, world]$$::VARCHAR[];

SELECT $$["hello\,world", test]$$::VARCHAR[];

SELECT $$[hello\,, test]$$::VARCHAR[];

SELECT $$[hello\"quoted\"text, more]$$::VARCHAR[];

SELECT $$["escaped\\backslash", test]$$::VARCHAR[];

SELECT $$[nested"["bracket, test]$$::VARCHAR[];

SELECT $$[mix\ of\ special\,chars]$$::VARCHAR[];

SELECT $$["mix\ of\ special\,"chars]$$::VARCHAR[];

SELECT $$["ends with comma,", "another,"]$$::VARCHAR[];

SELECT $$["ends with bracket]", "[bracket"]$$::VARCHAR[];

SELECT $$[" space at start", " leading space"]$$::VARCHAR[];

SELECT $$["\"quote at start", "\"leading quote"]$$::VARCHAR[];

SELECT $$["\\backslash at start", "\\leading backslash"]$$::VARCHAR[];

SELECT $$[",comma at start and end,", ",leading and trailing comma,"]$$::VARCHAR[];

SELECT $$["[bracket at start and end]", "[leading and trailing bracket]"]$$::VARCHAR[];

SELECT $$[" mix, of special\ characters " , "[various] \"combinations\" "]$$::VARCHAR[];

SELECT $$["\"quotes\" and \ spaces ", "\ leading and trailing \ "]$$::VARCHAR[];

SELECT $$["hello, world"]$$::VARCHAR[];

SELECT $$[""]$$::VARCHAR[];

SELECT $$["\\"]$$::VARCHAR[];

SELECT $$[\,]$$::VARCHAR[];

SELECT $$[","]$$::VARCHAR[];

select $$[\"abc\", def, ghi]$$::VARCHAR[] a, a::VARCHAR::VARCHAR[] b, a == b;

select $$[\  \\abc\\ \ , def, ghi]$$::VARCHAR[] a, a::VARCHAR::VARCHAR[] b, a == b;

select $$[{}]$$::VARCHAR[] a, a::VARCHAR::VARCHAR[] b, a == b;

SELECT TRY_CAST('{null=1,k=2}' AS MAP(VARCHAR, INTEGER));

SELECT TRY_CAST('{a=' AS MAP(VARCHAR, INTEGER));

SELECT TRY_CAST(s AS MAP(VARCHAR, INTEGER)) FROM (VALUES ('{a=1}'), ('{null=1,k=2}'), ('{a=1,b='), ('{x=5, y=6}')) t(s);

SELECT TRY_CAST('{1=a,01=b}' AS MAP(INTEGER, VARCHAR));

SELECT TRY_CAST('{1=2}' AS MAP("NULL", "NULL"));

SELECT TRY_CAST(x AS MAP(INT, INT)) FROM (VALUES ('{1=1}'), ('{x=1}'), ('{NULL=1}'), (NULL), ('{2=NULL}')) t(x);

SELECT '{key_A: 2, key_B: 46, key_C: -3000}'::STRUCT(key_A INT, key_B INT, key_C INT);

SELECT '{"key_A": 2, "key_B": hello world}'::STRUCT(key_A INT, key_B VARCHAR);

SELECT '{🦆: Quack, 🦤: ....}'::STRUCT(🦆 VARCHAR, 🦤 VARCHAR);

SELECT '{a:{b:DuckDB, c:12}, b:900, c:{a:"DuckParty"}}'::STRUCT(a STRUCT(b VARCHAR, c INT), b INT, c STRUCT(a VARCHAR));

SELECT CAST('{a:{b:{c:{d:{e:{f:"Hello World"}}}}}}' AS STRUCT(a STRUCT(b STRUCT(c STRUCT(d STRUCT(e STRUCT(f VARCHAR)))))));

INSERT INTO tbl1 (VALUES ('{a:1, b:3}'));

CREATE TABLE tbl2(col VARCHAR);

SELECT col::STRUCT(a INT, b VARCHAR) a, a::VARCHAR::STRUCT(a INT, b VARCHAR) b, a == b FROM tbl2;

INSERT INTO tbl3 (VALUES ('{a:DUCK, b:9.999, c:12}'), ('{a:"DB", b:1.111, c:21}'));

CREATE TABLE tbl4(col VARCHAR);

SELECT col::STRUCT(a STRUCT(b INT)) FROM tbl4;

SELECT '{key_A: [[2, 3], [4]], key_B: [Hello, World]}'::STRUCT(key_A INT[][], key_B VARCHAR[]);

SELECT '{key_B: 2, key_A: 46}'::STRUCT(key_A INT, key_B INT);

SELECT '{key_D: "World Hello", key_B: [Hello, World], key_C : 5000, key_A: [[{a: 5, b: 900}, {a:3, b:34}], [{a:2, b: 0}]]}'::STRUCT(key_A STRUCT(a INT, b INT)[][], key_B VARCHAR[], key_C INT, key_D VARCHAR);

SELECT '{  key_A:     2, key_B: hello world    }'::STRUCT(key_A INT, key_B VARCHAR);

SELECT '{key_A     : [      [{      a: 5    , b  : 900          }, { a: 3, b:    34}],      [   {a:
                2, b: 0    }    ] ],     key_B: [Hello       , World]   }'::STRUCT(key_A STRUCT(a INT, b INT)[][], key_B VARCHAR[]);

SELECT ' {      }   '::STRUCT(a INT, b DATE);

SELECT '{a: NULL}'::STRUCT(a VARCHAR);

SELECT '{a:{c: NULL}, b: NULL, c:{d: "Ducky", e: NULL}}'::STRUCT(a STRUCT(c INT), b VARCHAR, c STRUCT(d VARCHAR, e DOUBLE));

SELECT '{key_C: 8, key_A: 2}'::STRUCT(key_A INT, key_B DOUBLE, key_C FLOAT);

SELECT {'key_C': 2, 'key_A': 4}::VARCHAR::STRUCT(key_A INT, key_B VARCHAR, key_C VARCHAR);

SELECT '{key_C: {key_B: 3, key_E: 🦆}, key_A: 2}'::STRUCT(key_A INT, key_C STRUCT(key_B INT, key_D INT, key_E VARCHAR));

SELECT '{}'::STRUCT(a INT, b VARCHAR);

SELECT TRY_CAST('{key_B: "hello", key_Z: 2, key_A: 46}' AS STRUCT(key_A INT, key_B VARCHAR, key_C INT));

SELECT TRY_CAST('{a:4, b:''Ducky'', c:''🦆''}' AS STRUCT(a INT, b DOUBLE, c VARCHAR));

INSERT INTO try_cast_tbl (VALUES ('{a:{d:1}, b:100, c:"🦆"}'), ('{a:{X:1}, b:100, c:"🦆"}'), ('{a:{d:1}, b:100, X:"🦆"}'), ('{a:"oh oh", b:100, c:"🦆"}'), ('{a:{d:"oops"}, b:100, c:"🦆"}'), ('{a:{d:"oops"}, b:100, Z: "undercover", c:"🦆"}'));

CREATE TABLE tbl(col VARCHAR);

SELECT cast(col as STRUCT(a VARCHAR, b INT)).a FROM tbl WHERE cast(col as STRUCT(a VARCHAR, b INT)).b=12;

SELECT * FROM assorted_structs;

INSERT INTO json_tbl (VALUES ('{
    "id": "0001",
    "type": "donut",
    "name": "Cake",
    "ppu": 0.55,
    "batters":
        {
            "batter":
                [
                    { "id": "1001", "type": "Regular" },
                    { "id": "1002", "type": "Chocolate" },
                    { "id": "1003", "type": "Blueberry" },
                    { "id": "1004", "type": "Devil''s Food" }
                ]
        },
    "topping":
        [
            { "id": "5001", "type": "None" },
            { "id": "5002", "type": "Glazed" },
            { "id": "5005", "type": "Sugar" },
            { "id": "5007", "type": "Powdered Sugar" },
            { "id": "5006", "type": "Chocolate with Sprinkles" },
            { "id": "5003", "type": "Chocolate" },
            { "id": "5004", "type": "Maple" }
        ]
}'));

CREATE TABLE json_tbl2(col1 JSON);

SELECT col1::VARCHAR::STRUCT(A VARCHAR, B INT[], C STRUCT(A VARCHAR, B FLOAT, C DOUBLE[])) FROM json_tbl2;

SELECT '{"v":"hello"}'::STRUCT(v VARIANT);

SELECT '{"a":"x","b":"y"}'::STRUCT(a VARIANT, b VARIANT);

SELECT NULL::VARCHAR::STRUCT(v VARIANT);

CREATE TABLE s(x VARCHAR);

SELECT x::STRUCT(v VARIANT) FROM s;

select [row('a'), $$(abc)$$];

select [row('a'),$$()$$];

select [row({'amount': 21}), $$({'amount': 42})$$];

select [row(row(21), {'amount': 42}), $$((42), {amount: 21})$$];

select [row([4,5,6]), $$([1,2,3],)$$];

select [
	[
		row(
			row(
				'  test  '
			)
		),
		{'a': {
			'inner':
				'\  test  \'
			}
		}
	],
	$$[(("  test  ")), {'a': (\\  test  \\)}]$$
];

CREATE TABLE structs(s STRUCT(a INTEGER, b TINYINT));

SELECT TRY_CAST(s AS STRUCT(b BIGINT, a SMALLINT)) FROM structs;

SELECT CAST(s AS STRUCT(a BIGINT, b BIGINT, c BIGINT)) FROM structs;

SELECT CAST(s AS STRUCT(b SMALLINT)) FROM structs;

INSERT INTO struct_lists VALUES ([{'a': 100000, 'b': 1}]);

CREATE TABLE struct_maps(m MAP(INTEGER, STRUCT(a INTEGER, b TINYINT)));

SELECT CAST(m AS MAP(INTEGER, STRUCT(b SMALLINT, a BIGINT))) FROM struct_maps;

INSERT INTO merge_keys VALUES (map([{'a': 1, 'b': 10}, {'a': 1, 'b': 20}], [100, 200]));

CREATE TABLE double_keys(m MAP(BIGINT, INTEGER));

SELECT CAST(m AS MAP(HUGEINT, INTEGER)) FROM double_keys;

INSERT INTO nested VALUES ({'x': {'a': 100000, 'b': 1}, 'y': 1});

CREATE TABLE unnamed(x INTEGER, y TINYINT);

SELECT CAST(ROW(x, y) AS STRUCT(a BIGINT, b SMALLINT)) FROM unnamed;

INSERT INTO guarded VALUES ('keep', {'a': 1, 'b': 1}), ('keep', {'a': 100000, 'b': 2});

SELECT TRY_CAST('{a: 1, a: 2}' AS STRUCT(a INT));

SELECT TRY_CAST(s AS STRUCT(a INT)) FROM (VALUES ('{a: 1}'), ('{a: 1, a: 2}'), ('{a: 3}')) t(s);

SELECT {"age": 25, "score": 100}::MAP(VARCHAR, INT);

SELECT {"name": 'Alice', "age": 25, "score": 95}::MAP(VARCHAR, VARCHAR);

SELECT {"123456789": 42}::MAP(BIGINT, INT);

SELECT {"age": 25, "score": 100}::MAP(VARCHAR, VARCHAR);

SELECT {"pi": 3, "e": 2}::MAP(VARCHAR, DOUBLE);

SELECT (NULL::STRUCT(name VARCHAR, age INT))::MAP(VARCHAR, VARCHAR);

SELECT {"a": NULL, "b": NULL, "c": 'value'}::MAP(VARCHAR, VARCHAR);

SELECT {"person": {"name": 'Alice', "age": 25}}::MAP(VARCHAR, STRUCT(name VARCHAR, age INT));

SELECT {meta: MAP{'key': 'value'}}::MAP(VARCHAR, MAP(VARCHAR, VARCHAR));

SELECT {"value": 42}::MAP(VARCHAR, INT)
FROM range(1, 1001)
LIMIT 5;

SELECT TRY_CAST(col AS MAP(VARCHAR, integer))
FROM (
    SELECT CASE WHEN (i % 5 == 0) THEN NULL else {'a': i::varchar} END as col
    FROM range(1, 1001) t(i)
)
LIMIT 5;

SELECT {"single": 'value'}::MAP(VARCHAR, VARCHAR);

SELECT {"first name": 'Alice', "last name": 'Smith'}::MAP(VARCHAR, VARCHAR);

SELECT {"测试": 'test', "🦆": 'duck'}::MAP(VARCHAR, VARCHAR);

SELECT col::MAP(VARCHAR, INT)
FROM (
    SELECT {"value": i} as col 
    FROM range(1, 1001) t(i)
) 
LIMIT 5;

SELECT {
    "tinyint": 1::TINYINT,
    "smallint": 2::SMALLINT, 
    "int": 3::INT,
    "bigint": 4::BIGINT
}::MAP(VARCHAR, BIGINT);

SELECT {
    "date": '2023-01-01'::DATE,
    "time": '12:00:00'::TIME
}::MAP(VARCHAR, VARCHAR);

SELECT {"price": 19.99::DECIMAL(10,2)}::MAP(VARCHAR, VARCHAR);

SELECT COUNT(*)
FROM VALUES ({"type": 'A'}), ({"type": 'B'}), ({"type": 'A'})
AS tab(col)
WHERE (col::MAP(VARCHAR, VARCHAR))['type'] = 'A';

SELECT NULL::STRUCT(k VARCHAR, i BIGINT)::MAP(BIGINT, BIGINT);

CREATE TABLE t AS SELECT * FROM (VALUES (1::BIGINT, 'a', 10::BIGINT)) v(i, k, j);

SELECT (CASE WHEN i % 2 = 0 THEN NULL ELSE {'1': i, '2': i * 10} END)::MAP(INT, INT)
FROM range(1, 5) t(i) ORDER BY i;

CREATE TABLE bits (b bit);

SELECT b::BOOLEAN FROM bits;

SELECT '0'::BIT::BOOL;

SELECT b::SMALLINT FROM bits;

SELECT b::BIGINT FROM bits;

SELECT b::USMALLINT FROM bits;

SELECT b::UBIGINT FROM bits;

SELECT b::UHUGEINT FROM bits;

SELECT b::DOUBLE FROM bits;

SELECT 15::BOOLEAN::BIT;

SELECT 15::SMALLINT::BIT;

SELECT 15::BIGINT::BIT;

SELECT 15::UHUGEINT::BIT;

SELECT 7.4e-323::BIT;

SELECT bit_length(''::BIT);

SELECT b::BLOB FROM bits;

SELECT '1111'::BIT::BLOB;

select 'a'::BLOB::BIT::BLOB;

SELECT 'AAAA'::BLOB::BIT;

SELECT (-15)::HUGEINT::BIT;

SELECT (-128)::TINYINT::BIT;

SELECT (-32768)::SMALLINT::BIT;

SELECT (-2147483648)::INT::BIT;

SELECT (-9223372036854775808)::BIGINT::BIT;

SELECT (-170141183460469231731687303715884105728)::HUGEINT::BIT;

SELECT '10000000'::BIT::TINYINT;

SELECT '1000000000000000'::BIT::SMALLINT;

SELECT '10000000000000000000000000000000'::BIT::INT;

SELECT '1000000000000000000000000000000000000000000000000000000000000000'::BIT::BIGINT;

SELECT '10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'::BIT::HUGEINT;

SELECT (65535)::USMALLINT::BIT;

SELECT (18446744073709551615)::UBIGINT::BIT;

SELECT '11111111'::BIT::UTINYINT;

SELECT '11111111111111111111111111111111'::BIT::UINTEGER;

SELECT (3.4028235e+38)::FLOAT::BIT;

SELECT '01111111011111111111111111111111'::BIT::FLOAT;

SELECT NULL::BIT;

SELECT CAST(1=1 AS VARCHAR);

SELECT CAST(12345 AS BOOLEAN);

SELECT CAST('t' AS BOOLEAN);

SELECT CAST('y' AS BOOLEAN);

SELECT CAST('f' AS BOOLEAN);

SELECT CAST('n' AS BOOLEAN);

SELECT CAST(yes AS BOOLEAN) FROM tbl;

SELECT CAST(CAST('0' AS INTEGER) AS BOOLEAN);

SELECT CAST(CAST('0' AS tinyint) AS BOOLEAN);

SELECT CAST(CAST('0' AS smallint) AS BOOLEAN);

SELECT CAST(CAST('1' AS bigint) AS BOOLEAN);

SELECT CAST(CAST('1' AS decimal) AS BOOLEAN);

SELECT CAST(CAST('1' AS decimal(1,0)) AS BOOLEAN);

SELECT CAST(CAST('1' AS decimal(9,0)) AS BOOLEAN);

SELECT CAST(CAST('1' AS decimal(38,0)) AS BOOLEAN);

SELECT CAST(CAST('1' AS float) AS BOOLEAN);

SELECT CAST(CAST('1' AS double) AS BOOLEAN);

SELECT CAST(CAST('1' AS HUGEINT) AS BOOLEAN);

SELECT CAST(CAST('1' AS UHUGEINT) AS BOOLEAN);

SELECT count(*) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, INTEGER)[]) x FROM (SELECT list({'a': [i::INT]}) l FROM range(3000) t(i)));

SELECT bool_and(x[2999]['a'] IS NULL) FROM (SELECT TRY_CAST(l AS MAP(VARCHAR, UUID)[]) x FROM (SELECT list({'a': i::INT, 'b': i::INT}) l FROM range(3000) t(i)));

SELECT max(length(u::MAP(VARCHAR, VARCHAR)[]::VARCHAR)) FROM (SELECT TRY_CAST(l AS STRUCT(a INT, b VARCHAR)[]) u FROM (SELECT list(i) l FROM range(5000) t(i)));

SELECT x[2049]['b'] FROM (SELECT list({'a': NULL, 'b': i})::MAP(VARCHAR, INT)[] x FROM range(2049) t(i));

SELECT m['2048'] IS NULL FROM (SELECT map(list(i::VARCHAR), list(NULL))::MAP(VARCHAR, INT) m FROM range(2049) t(i));

SELECT CAST('1e1' AS INTEGER);

SELECT CAST('1e1' AS DOUBLE);

SELECT (1=1)::VARCHAR, (1=0)::VARCHAR, NULL::BOOLEAN::VARCHAR;

SELECT 1::SMALLINT::VARCHAR, 12442::SMALLINT::VARCHAR, (-32153)::SMALLINT::VARCHAR;

SELECT 1::BIGINT::VARCHAR, 1244295295289253::BIGINT::VARCHAR, (-2000000111551166)::BIGINT::VARCHAR;

SELECT 2::DOUBLE::VARCHAR, 0.5::DOUBLE::VARCHAR, (-128.5)::DOUBLE::VARCHAR;

SELECT '0x7F'::TINYINT, '0x7FFF'::SMALLINT, '0x7FFFFFFF'::INT, '0x7FFFFFFFFFFFFFFF'::BIGINT;

SELECT '0x000000000000000000000000000000000000000000000000000000000000000000'::INT;

SELECT TRY_CAST('0x8000' AS SMALLINT);

SELECT TRY_CAST('0x8000000000000000' AS BIGINT);

SELECT TRY_CAST('0x10000' AS UINT16);

SELECT TRY_CAST('0x10000000000000000' AS UINT64);

SELECT TRY_CAST(3 as BIGINT), CAST(3 AS BIGINT), TRY_CAST(2 as BIGINT), CAST(3 AS INTEGER);

INSERT INTO try_cast VALUES (3);

SELECT try_cast(try_cast as bigint) FROM try_cast;

CREATE TABLE tss AS 
	FROM VALUES ('2026-04-09 11:48:07.123456'::TIMESTAMP) tbl(t);

select t::TIMESTAMP from tss;

select t::TIMESTAMP_S from tss;

SELECT TRY_CAST(TIMESTAMP '2262-04-11 23:47:16.854776' AS TIMESTAMP_NS);

SELECT
	TRY_CAST(TIMESTAMP 'infinity' AS TIME) IS NULL,
	TRY_CAST(TIMESTAMP 'infinity' AS TIMETZ) IS NULL,
	TRY_CAST(TIMESTAMPTZ 'infinity' AS TIMETZ) IS NULL,
	TRY_CAST('infinity'::TIMESTAMP_NS AS TIME) IS NULL,
	TRY_CAST('infinity'::TIMESTAMP_NS AS TIME_NS) IS NULL,
	TRY_CAST('infinity'::TIMESTAMPTZ_NS AS TIMETZ) IS NULL,
	TRY_CAST(TIMESTAMPTZ '2262-04-11 23:47:16.854776+00' AS TIMESTAMP_NS) IS NULL,
	TRY_CAST(TIMESTAMP_MS '2262-04-11 23:47:16.855' AS TIMESTAMP_NS) IS NULL,
	TRY_CAST(TIMESTAMP_S '2262-04-12 00:00:00' AS TIMESTAMP_NS) IS NULL;

SELECT typeof(CAST(now() AS TIMESTAMPTZ_NS));

SELECT CAST(TIMESTAMPTZ '2026-01-01 12:34:56.123456+00' AS TIMESTAMPTZ_NS) =
       CAST(TIMESTAMPTZ '2026-01-01 12:34:56.123456+00'::VARCHAR AS TIMESTAMPTZ_NS);

SELECT
	TRY_CAST(TIMESTAMPTZ 'infinity' AS TIMESTAMPTZ_NS),
	TRY_CAST(TIMESTAMPTZ '-infinity' AS TIMESTAMPTZ_NS);

SELECT
	CAST(TIMESTAMPTZ '2026-04-09 11:48:07.123456+00' AS TIMESTAMP_MS),
	CAST(TIMESTAMPTZ '2026-04-09 11:48:07.123456+00' AS TIMESTAMP_S),
	CAST(TIMESTAMPTZ_NS '2026-04-09 11:48:07.123456789+00' AS TIMESTAMP_NS);

SELECT i, t::TIMESTAMPTZ_NS, t::TIMESTAMPTZ_NS::TIMESTAMPTZ = t
FROM tstz_us
ORDER BY i;

SET TimeZone = 'America/Los_Angeles';

SELECT CAST(TIMESTAMPTZ '2026-07-01 12:34:56.654321+00' AS TIMESTAMPTZ_NS) =
       CAST(TIMESTAMPTZ '2026-07-01 12:34:56.654321+00'::VARCHAR AS TIMESTAMPTZ_NS);

SELECT
	CAST(TIMESTAMPTZ 'infinity' AS TIMESTAMPTZ_NS),
	CAST(TIMESTAMPTZ '-infinity' AS TIMESTAMPTZ_NS),
	TRY_CAST(TIMESTAMPTZ 'infinity' AS TIMESTAMPTZ_NS),
	TRY_CAST(TIMESTAMPTZ '-infinity' AS TIMESTAMPTZ_NS);

select *
from test
where (t::date) = '2021-02-04'::date;

SELECT TRY_CAST(''::BLOB AS BIT);

CREATE TABLE t(b BLOB);

SELECT TRY_CAST(b AS BIT) IS NULL FROM t ORDER BY 1;

SELECT TRY_CAST(u AS UNION(b INT)) FROM (SELECT union_value(a:=1) u);

SELECT TRY(CAST(union_value(a:=1) AS UNION(b INT)));

CREATE TABLE t1 (i UNION(a INT));

SELECT i::UNION(a UNION(a INT)) FROM t1;

SELECT union_value(a := 42)::UNION(a VARIANT);

SELECT union_value(a := 42)::UNION(a VARIANT, b INTEGER);

SELECT union_value(a := NULL::INTEGER)::UNION(a VARIANT);

SELECT union_value(a := 42)::UNION(a VARIANT, b VARIANT);

SELECT u::UNION(a VARIANT) FROM union_tbl;
