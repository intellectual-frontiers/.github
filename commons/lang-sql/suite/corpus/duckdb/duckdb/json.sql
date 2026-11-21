CREATE TABLE places (id INTEGER, name VARCHAR, geom GEOMETRY);

SELECT id, name, ST_AsText(geometry) FROM places2 ORDER BY id;

CREATE TABLE ids (id VARCHAR, name VARCHAR, geom GEOMETRY);

CREATE SEQUENCE s;

SELECT __internal_json_copy_to_geojson({'id': 1}, NULL, NULL, '', '', false);

SET enable_logging=true;

SELECT json_merge_patch_diff(
  (repeat('{"a":', 200000) || '1' || repeat('}', 200000))::JSON,
  (repeat('{"a":', 200000) || '1' || repeat('}', 200000))::JSON
);

create table test as select {i: range}::JSON j from range(10);

CREATE TABLE todos (userId UBIGINT, id UBIGINT, title VARCHAR, completed BOOLEAN);

select * from json_test;

select json_type(JSON '{"a": null}', '$.a') = 'NULL';

create table tbl (test struct(one bigint, two varchar));

SELECT '{"Status / SubStatus": "test"}' -> 'Status / SubStatus';

WITH path AS (
    SELECT NULL p
)
SELECT '{"\"Status / SubStatus\"": "test"}' -> p
FROM path;

SELECT '[1, 2, 3]'->0;

WITH path AS (
    SELECT '0' p
)
SELECT '[1, 2, 3]' -> p
FROM path;

SELECT (1::HUGEINT << 100)::JSON;

SELECT to_json((1::UHUGEINT << 100)::DECIMAL(38,0));

SELECT (1::HUGEINT << 100)::BIGNUM::JSON;

with cte as (
    select '{"a":1}'::JSON as j
)
select typeof(j[2:3]), typeof(substring(j, 2, 3))
from cte;

select '1101'::BIT::JSON;

select json_structure('{"id":42}');

SELECT info->>'$.outcome.by' as outcome_by
FROM cricket_staging
WHERE info->>'$.city' = 'Colombo';

SELECT json_object('key', NULL);

CREATE TABLE base AS
SELECT range::BIGINT AS id,
       'svc-' || (range % 97)::VARCHAR AS svc,
       'host-' || (range % 29)::VARCHAR AS host,
       [{'k': 'n', 'v': (range % 500)::VARCHAR},
        {'k': 'ok', 'v': ((range % 2) = 0)::VARCHAR}] AS attrs,
       {'code': (range % 3)::INT, 'msg': 'msg-' || (range % 13)::VARCHAR} AS status
FROM range(400000);

SELECT count(*) FROM out WHERE json_valid(j);

INSERT INTO j2(id,json,src)
    VALUES(3,'[
    {
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
    },
    {
        "id": "0002",
        "type": "donut",
        "name": "Raised",
        "ppu": 0.55,
        "batters":
            {
                "batter":
                    [
                        { "id": "1001", "type": "Regular" }
                    ]
            },
        "topping":
            [
                { "id": "5001", "type": "None" },
                { "id": "5002", "type": "Glazed" },
                { "id": "5005", "type": "Sugar" },
                { "id": "5003", "type": "Chocolate" },
                { "id": "5004", "type": "Maple" }
            ]
    },
    {
        "id": "0003",
        "type": "donut",
        "name": "Old Fashioned",
        "ppu": 0.55,
        "batters":
            {
                "batter":
                    [
                        { "id": "1001", "type": "Regular" },
                        { "id": "1002", "type": "Chocolate" }
                    ]
            },
        "topping":
            [
                { "id": "5001", "type": "None" },
                { "id": "5002", "type": "Glazed" },
                { "id": "5003", "type": "Chocolate" },
                { "id": "5004", "type": "Maple" }
            ]
    }
    ]','https://adobe.github.io/Spry/samples/data_region/JSONDataSetSample.html');

SET threads = 1;

SET memory_limit='20MiB';

CREATE TEMP TABLE j1(x json);

CREATE TABLE blobs(id INTEGER, b BLOB, l BLOB[], s STRUCT(x BLOB));

SELECT count(*) FROM blobs a JOIN read_back b ON a.id = b.id
    WHERE a.b = b.b AND a.l = b.l AND a.s = b.s;

SELECT count(*) FROM blobs a JOIN via_reader b ON a.id = b.id
    WHERE a.b = b.b AND a.l = b.l AND a.s = b.s;

SELECT * FROM t2;

SELECT {'a': '[1, 2]'}::ROW(a JSON);

SELECT '{a: [1, 2]}'::ROW(a JSON);

SELECT '42'::UNION(u JSON);

SELECT '42'::UNION(u VARCHAR)::JSON;

SELECT '{"duck":42}'::JSON::STRUCT(duck INTEGER);

SELECT MAP(['duck'], [42])::JSON;

SELECT TRY_CAST('["a", "b", "c"]'::JSON AS INT[]);

CREATE TABLE structs (v STRUCT(duck INTEGER));

INSERT INTO structs VALUES ('{"duck":42}'::JSON);

SELECT * FROM structs;

CREATE TABLE jsons (j JSON);

INSERT INTO jsons SELECT * FROM maps;

select bool,
       tinyint,
       smallint,
       int,
       bigint,
       hugeint,
	   uhugeint,
       utinyint,
       usmallint,
       uint,
       ubigint,
       date,
       time,
       timestamp,
       timestamp_s,
       timestamp_ms,
       timestamp_ns,
       time_tz,
       timestamp_tz,
       float,
       double,
       dec_4_1,
       dec_9_4,
       dec_18_6::DOUBLE as dec_18_6,
       dec38_10::DOUBLE as dec38_10,
       uuid,
       interval,
       small_enum,
       int_array,
       double_array,
       date_array,
       timestamp_array,
       timestamptz_array,
       varchar_array,
       nested_int_array,
       struct,
       struct_of_arrays,
       array_of_structs,
       map,
from test_all_types();

select * from roundtrip;

with cte1 as (
    select array_agg({duck:42}::json) json_list_value
    from range(5_000)
), cte2 as (
    select '[' || string_agg('{"duck":42}', ', ') || ']' string_value
    from range(5_000)
)
select json_list_value::varchar = string_value, json_list_value = string_value::json[]
from cte1, cte2;

SELECT from_json('{"x":2}', '"MAP(INT,INT)"');

SELECT '{"a":1,"b":2}'::JSON::MAP(VARCHAR, INT);

SELECT json_transform('{"a":1,"b":"x"}', '{"a":"UBIGINT","b":"VARCHAR"}');

SELECT json_transform('{"d": "1.5"}', '{"d": "DECIMAL(50,3)"}'), json_transform('{"d": 42}', '{"d": "DECIMAL(50,3)"}');

SELECT from_json(to_json([ '1.25'::DECIMAL(45,2), NULL ]), '["DECIMAL(45,2)"]');

SELECT ST_AsText('"POINT(9 9)"'::JSON::GEOMETRY);

INSERT INTO mixed VALUES ('{"type":"Point","coordinates":[1,2]}'), ('"LINESTRING(0 0, 1 1)"'), (NULL);

SELECT 'POINT(1 2)'::GEOMETRY::JSON;

SELECT to_json(NULL::GEOMETRY);

insert into test values ('{}'), ('[]'), ('[1, 2, 3]');

SELECT json_array_length('[1,2,3,4]');

SELECT json_array_length('{"one":[1,2,3]}');

SELECT json_array_length('{"a":[1,2],"b":[],"c":42}', ['$.a', '$.b', '$.c', '$.missing']);

SELECT j->'a'->'c'->>'d' = 'y' FROM t;

SELECT j->'a'->>'b' ILIKE 'X%' FROM t;

SELECT j->'a'->>'b' NOT IN ('x', 'y') FROM t;

SELECT j->'a'->>'b' BETWEEN 'a' AND 'z' FROM t;

SELECT j->'a'->>'b' = 'zzz' OR j->>'s' = 'abc' FROM t;

SELECT j->'a'->>'b' FROM t;

SELECT j->>'s' = 'abc' FROM t;

SELECT ('{"a": [1, 2]}'::JSON->'a'->>1)::INTEGER + 1;

SELECT CASE WHEN j->'a'->>'b' = 'x' THEN 1 END FROM t WHERE j->'a'->>'b' = 'x' ORDER BY j->'a'->>'b';

SELECT sql FROM duckdb_views() WHERE view_name = 'v';

SELECT list_filter([j], lambda x: x->'a'->>'b' = 'x' AND x->'a'->>'b' <> 'z') = [j] FROM t;

SELECT list_filter([1, 2, 3], x -> x > 1 AND x < 3);

SELECT list_transform([[j]], x -> list_transform(x, y -> (y->'a'->>'b') || '!')) FROM t;

SELECT list_filter([j], lambda x: x->'a'->>'b' = 'x') IS NOT NULL FROM t;

SELECT (SELECT json_extract(example, k) AS v FROM (SELECT 'key' AS k) keys)
FROM testjson;

select json_contains('[1, 2]', '[]');

select json_contains('[1, 2, 3]', '[1, 2]');

select json_contains('{"a": {"b": [{"c": 1, "d": 2}]}}', '{"d": 2}');

select json_contains('{"a": {"b": [{"c": 1, "d": 2}]}}', '[{"d": 2, "c": 1}]');

select json_contains(json('{"key":"value"}'),json('{"blah":"value"}'));

select json_quote({n: 42});

select to_json(42::VARIANT);

select [{'a': 1, 'b': [1]}::VARIANT]::JSON;

SELECT to_json(union_value(b := 'abc')::UNION(a INTEGER, b VARCHAR, c FLOAT));

select json_object('duck', 42);

select json_object('nested', [{duck: 42}, NULL]);

select json_object('nested', map(['0', 'goose'], [42, 7]));

select json_object('nested', {nested2: [1, 2, 3]});

insert into test values
    (0,		0.5,	'short',				[0, 1, 2, 3, 4, 5, 6, 7, 9],	33),
    (42,	1,		'looooooooooooooong',	[],								42),
    (-42,	0.42,	2,						[1, 2, 3],						1111),
    (777,	19.96,	'duck',					NULL,							1),
    (-777,	4.2,	'goose',				[4, 2],							NULL);

select json_object(a::varchar, a, b::varchar, b, c, c, 'd', d, 'e', e) from test;

select json_quote(map(list(c), list(d))) from test;

select row_to_json(NULL);

select array_to_json(NULL);

SELECT json_array(1,2.5,null,'hello');

SELECT json_object('ex','[52,3.14159]');

SELECT json_object('a',2,'c',4);

SELECT json_array(1,2,'3',4);

SELECT json_array(1,null,'3','[4,5]','{"six":7.7}');

SELECT CAST((MAP([5, 3, 4], ['a', 'b', 'c']), 2) AS JSON);

SELECT row(1, 'a')::JSON::TUPLE(INTEGER, VARCHAR);

SELECT to_json('0.5'::DECIMAL(18,18)), '0.5'::DECIMAL(18,18)::JSON, to_json('-0.5'::DECIMAL(20,20));

SELECT json_valid(to_json('-0.5'::DECIMAL(18,18))::VARCHAR), json_extract(to_json(['0.5'::DECIMAL(18,18)])::VARCHAR, '$[0]');

SELECT to_json('0.5'::DECIMAL(19,18)), to_json('12.5'::DECIMAL(18,2)), to_json('0.5'::DECIMAL(3,3));

SELECT json_deep_merge('{"a": 1}', '{"b": 2}');

SELECT json_deep_merge('{"a":1,"b":2}', '{"b":null}');

SELECT json_deep_merge('{"a":null}', '{"a":null}');

SELECT json_deep_merge('42', '{"a":null}');

SELECT json_deep_merge('{"name": "x"}', '{"id": 47}');

SELECT json_deep_merge('"hello"', '"world"');

SELECT json_deep_merge('[1,2]', 'null');

SELECT json_deep_merge(NULL, '{"a":1}');

SELECT json_deep_merge('{"a":1}', '{"b":2}', '{"c":3}');

SELECT json_deep_merge('{ "a": 1, "b":2 }','{ "a": 3, "c":4 }','{ "a": 5, "d":6 }');

SELECT json_deep_merge('{"a":1}', '{"b":2}', NULL);

SELECT json_deep_merge('{"a":1}', '{}');

SELECT json_deep_merge('{"a":{"b":1},"c":{"d":2}}', '{"a":null,"c":{"d":null}}');

SELECT id, json_deep_merge(base, patch) FROM merge_data ORDER BY id;

SELECT json_deep_merge('{"a":1}', '{"a":{"b":2}}');

SELECT json_deep_merge('{"a":1}', 'null');

SELECT json_deep_merge('{"a":1}', 'null', '{"b":2}');

SELECT json_deep_merge(
    '{"columnName":"user_id","parentColumn":null}',
    '{"columnName":null,"parentColumn":"accounts.id"}'
);

select json('{"foo": null}').foo;

select json('{"foo": null}')['foo']['bar'];

select json('{"my_field": {"my_nested_field": ["goose", "duck"]}}').my_field.my_nested_field."1";

select ('{"my_field": {"my_nested_field": ["goose", "duck"]}}'::JSON).my_field.my_nested_field[1];

select json('{"my_field": {"my_nested_field": ["goose", "duckduckduckduck"]}}').my_field.my_nested_field[1];

select json('[1, 2, 42]')[2];

SELECT json('{"a":2,"c":[4,5,{"f":7}]}').c[2];

CREATE TABLE obj(x varchar);

SELECT json(x)."b" FROM obj;

SELECT json(x).settings.layer2."tris.legomenon"."summary.report" FROM t12;

SELECT json('{"foo": 1}').foo = 1;

with path AS (
    SELECT '$.duck' p
)
SELECT json_exists('{"duck": null}', p) FROM path;

SELECT json_exists('{"duck": null}', ['$.duck', '$.goose']);

select json_extract('{"foo": null}', '$.foo.bar');

select json_extract('{"my_field": {"my_nested_field": ["goose", "duck"]}}', '/my_field/my_nested_field/1');

select json_extract_string('{"my_field": {"my_nested_field": ["goose", "duck"]}}', '/my_field/my_nested_field/1');

select json_extract('{"my_field": {"my_nested_field": ["goose", "duckduckduckduck"]}}', '/my_field/my_nested_field/1');

select '{"my_field": {"my_nested_field": ["goose", "duckduckduckduck"]}}'::JSON->>'/my_field/my_nested_field/1';

select '{"my_field": {"my_nested_field": ["goose", "duck"]}}'::JSON->'my_field'->'my_nested_field'->>1;

SELECT json_extract('{"a":2,"c":[4,5,{"f":7}]}', '$.c[2]');

SELECT json_extract('{"a":2,"c":[4,5],"f":7}', ['$.c','$.a']);

SELECT json_extract(NULL, ['$.x', '$.a']);

SELECT json_extract(j, '$.b[#]') FROM t1;

SELECT json_extract(j, '$.b[#-2]') a, a = json_extract(j, '$.b[-2]') FROM t1;

SELECT json_extract(j, '$.b[#-4]'), json_extract(j, '$.b[-4]') FROM t1;

SELECT json_extract(j, ['$.b[0]', '$.b[#-1]']) a, a = json_extract(j, ['$.b[0]', '$.b[-1]']) FROM t1;

SELECT json_extract(j, '$.b[#-000001]') a, a = json_extract(j, '$.b[-000001]') FROM t1;

SELECT json_extract(x, '$."b"') FROM obj;

create table test5063 as select '{"a": 1, "b": 2}' js;

select json_extract_string(json('{"j[so]n_\"key": 67}'), '$."j[so]n_\"key"');

select '{"\"du\\ck\"": 42}'->'$."\"du\ck\""';

select '{"\"du\nck\"": 42}'->('$."\"du' || chr(10) || 'ck\""');

select json_extract('{"hello":1}', '');

SELECT count(*) FROM tricky WHERE json_extract(v, ['$.a', '$.b.c', '$[0]']) IS DISTINCT FROM json_extract(v::JSON, ['$.a', '$.b.c', '$[0]']);

SELECT ('[1,2]'::JSON)->1;

SELECT ('{"a":[10,20,30]}'::JSON)->'$.a[#-1]';

SELECT json_type('POINT(1 2)'::GEOMETRY('OGC:CRS84')::JSON);

set timezone = 'Europe/Berlin';

SELECT json_insert('{"a":1}', '$.a', '99');

SELECT json_insert('{"a":{"x":1}}', '$.a.x', '99');

SELECT json_insert('[1,2]', '/-', '3');

SELECT json_insert('[1,2]', '$[5]', '9');

SELECT json_insert('{}', '$.n', 'null');

SELECT json_insert(NULL, '$.a', '1');

SELECT json_insert('{"a":1}', 'b', '2');

SELECT json_insert('{"a":1}', '$.b', '2') FROM range(3);

SELECT id, json_insert(cfg, '$.retries', '3') FROM configs ORDER BY id;

SELECT json_insert('{"a\\":2}', '$."a\"b"', '9');

SELECT json_insert('[1,2]', '$[#-5]', '9');

SELECT json_insert('{}', '$.a[0]', '1');

select json_keys('{"duck": 42, "goose": 43}');

select json_keys('{"duck": {"key1": 42}, "goose": {"key1": 42, "key2": 43}}', ['duck', 'goose']);

select range % 2 g, sum(length(json_keys(j))) c
from t1
group by g
order by all;

SELECT length(json_merge_patch('{"a":1}', '{"a":' || repeat('[', 200000) || repeat(']', 200000) || '}'));

SELECT length(json_deep_merge('{"a":1}', '{"a":' || repeat('[', 200000) || repeat(']', 200000) || '}'));

SELECT json_merge_patch('{"a": 1}', '{"a": 2}');

SELECT json_merge_patch('{"a": {"b": 1}}', '{"a": {"b": 2}}');

SELECT JSON_MERGE_PATCH('1', 'true');

SELECT JSON_MERGE_PATCH('{ "a": 1, "b":2 }','{ "a": 3, "c":4 }','{ "a": 5, "d":6 }');

select json_merge_patch(NULL, '3');

select json_merge_patch('{"a":1}', '{"b":2}', '{"c":3}');

select json_merge_patch('{"a":1}', '{"b":2}', NULL);

SELECT json_merge_patch_diff('{"a":1,"b":2}', '{"a":1}');

SELECT json_merge_patch_diff('{"user":{"name":"Alice","age":30}}', '{"user":{"name":"Alice","age":31}}');

SELECT json_merge_patch_diff('{"a":{"b":{"c":1,"d":2}}}', '{"a":{"b":{"c":1,"d":3}}}');

SELECT json_merge_patch_diff('{"tags":[1,2]}', '{"tags":[3]}');

SELECT json_merge_patch_diff('42', '99');

SELECT json_merge_patch_diff('42', '{"a":1}');

SELECT json_merge_patch_diff('true', 'true');

SELECT json_merge_patch_diff('{"a":1}', '[1,2]');

SELECT json_merge_patch_diff(NULL, NULL);

SELECT json_merge_patch_diff('{"a":1}', '{}');

SELECT json_merge_patch_diff('{"a":null}', '{"a":null}');

SELECT json_merge_patch('{"a":1,"b":2,"c":3}', json_merge_patch_diff('{"a":1,"b":2,"c":3}', '{"a":1,"b":99,"d":4}')) = '{"a":1,"b":99,"d":4}';

SELECT json_merge_patch_diff('{"a":1}', '{"a":2}') FROM range(3);

SELECT id, json_merge_patch_diff(old_state, new_state) FROM versions ORDER BY id;

SELECT json_merge_patch_diff('{"a":{"b":{"c":{"d":1}}}}', '{"a":{"b":{"c":{"d":1}}}}');

SELECT json_merge_patch(
    '{"a":1,"b":{"x":1,"y":2},"c":3,"d":{"e":5}}',
    json_merge_patch_diff(
        '{"a":1,"b":{"x":1,"y":2},"c":3,"d":{"e":5}}',
        '{"a":1,"b":{"x":1,"z":3},"d":{"e":5,"f":6},"g":7}'
    )
) = '{"a":1,"b":{"x":1,"z":3},"d":{"e":5,"f":6},"g":7}';

SELECT json_normalize('{"a":1,"b":2,"c":3}');

SELECT json_normalize('{"c":{"b":{"z":1,"a":2},"a":3},"a":4}');

SELECT json_normalize('{"z":"hello","m":true,"a":null,"f":42,"c":[1,2]}');

SELECT json_normalize('"hello"');

SELECT json_normalize('null');

SELECT json_normalize('[1,"two",{"c":3,"a":1},null,[5,6]]');

SELECT md5(json_normalize('{"z":1,"a":2}')) = md5(json_normalize('{"a":2,"z":1}'));

SELECT json_normalize('{"b":{},"a":[]}');

SELECT json_normalize('[[{"b":2,"a":1}],[{"d":4,"c":3}]]');

INSERT INTO json_data VALUES (1, '{"z":1,"a":2}'), (2, '{"b":3,"a":4}'), (3, NULL);

INSERT INTO json_pairs VALUES (1, '{"z":1,"a":2}', '{"a":2,"z":1}'), (2, '{"b":{"z":1,"a":2},"a":3}', '{"a":3,"b":{"a":2,"z":1}}');

SELECT json_normalize('{"b":"hello world","a":"foo\"bar"}');

SELECT json_normalize('{"z":1,"a":2}') FROM range(3);

SELECT json_normalize('{"a":2,"":1}');

select json_extract('{"my_field": "duck"}', '');

select json_extract('[[1]]', '$[0][0]');

select json_extract(j, '$.my_field.my_nested_field[0]') from test;

select json_extract(j, '$.my_field.my_nested_field[#-3]') from test;

select json_extract(j, '$.my_field.my_nested_field[-2]') from test;

select json_extract('{"my_field": [{"my_nested_field": ["duck", "goose"]}]}', '$.my_field[0].my_nested_field[0]');

select json_extract('[{"duck":42},{"duck":43}]', '$[*].duck');

select json_extract('{"duck":[42,43]}', '$.*[-1]');

select json_extract('[{"duck":null},{"duck":42},{"duck":null},{}]', '$[*].*');

select json_extract('{"a":{"b":1,"c":2},"d":["g","h",[{"b":5},{"x":42}]]}', '$..b');

with tbl as (
    select '{"duck":[{"goose":42},{"goose":43}],"goose":null}' j
)
select json_extract(j, '$.duck[*]..goose') from tbl;

PREPARE extract_stmt AS SELECT json_extract('{"a":1,"b":{"c":2}}', $1);

EXECUTE extract_stmt('/b/c');

EXECUTE set_stmt('$.a');

EXECUTE remove_stmt('$.c');

SELECT json_extract('{"*":1,"b":2}', '$.*');

SELECT json_extract('{"a":{"b":3}}', '$..b');

SELECT json_pretty('null'::json);

SELECT json_remove('{"a":1}', '$.b');

SELECT json_remove('{"a":{"x":1}}', '$.a.y');

SELECT json_remove('[1,2,3]', '$[2]');

SELECT json_remove('[{"a":1},{"b":2}]', '$[0]');

SELECT json_remove('{"a.b":1,"c":2}', '$."a.b"');

SELECT json_remove(NULL, '$.a');

SELECT json_remove('{"a":1,"b":2}', '$.a') FROM range(3);

SELECT id, json_remove(profile, '$.password') FROM users ORDER BY id;

SELECT json_remove('{"a\\":1,"b":2}', '$."a\\"');

SELECT json_remove('[1,2,3]', '$[#-1]');

SELECT json_remove('[1,2]', '$[#-5]');

SELECT json_remove('[1,2,3]', '$[-1]');

SELECT json_remove('{"a~b":1,"c":2}', '/a~0b');

SELECT json_remove(d, '$.x') FROM (VALUES ('{"x":1,"y":2}'), (NULL)) t(d);

SELECT json_replace('{"a":1}', '/a', '99');

SELECT json_replace('{}', '$.a.b', '1');

SELECT json_replace('[1,2]', '/-', '3');

SELECT json_replace('{"a":{"x":1}}', '$.a', '42');

SELECT json_replace('{"a":1,"b":2,"c":3}', '$.b', '99');

SELECT json_replace(NULL, '$.a', '1');

SELECT json_replace('{"a":1}', 'a', '2');

CREATE TABLE events (id INTEGER, payload JSON);

SELECT json_normalize(json_replace('{"z":1,"a":2}', '$.z', '9'));

SELECT json_replace('{"a":[1,2,3]}', '$.a[#-2]', '9');

SELECT json_replace('{"a":1}', '', '2');

SELECT json_set('{"a":1}', '$.b', '2');

SELECT json_set('{"a":{"x":1}}', '$.a.y', '2');

SELECT json_set('[1,2,3]', '$[1]', '99');

SELECT json_set('{}', '$.s', '"hello"');

SELECT json_set('{}', '$.arr', '[1,2,3]');

SELECT json_set('{"a":{"x":1}}', '$.a', '42');

SELECT json_set(NULL, '$.a', '1');

SELECT json_set('{}', '$.a', '1');

SELECT json_set('{"a":1}', '$.b', '2'::JSON);

INSERT INTO entities VALUES
    (1, '{"a":1}', '$.b', '2'),
    (2, '{"x":{"y":1}}', '$.x.z', '3'),
    (3, '{"arr":[1,2]}', '/arr/-', '3');

SELECT json_normalize(json_set('{"z":1}', '$.a', '2'));

SELECT json_set('{"":1,"a":2}', '/', '9');

SELECT json_set('{"a":1}', '$', '{"b":2}');

SELECT json_set('[[1,2],[3,4]]', '$[#-1][#-1]', '9');

SELECT json_set('[1,2]', '$[#-5]', '9');

SELECT json_set('[1,2]', '$[-1]', '9');

SELECT json_set('{"a":1}', '$.a.b', '2');

SELECT TRY(json_set('{"a":1}', '$.a[*]', '1'));

SELECT json_set('{}', '$.a[0].b', '1');

SELECT json_set('{}', '$[0]', '1');

SELECT json_set('[]', '$[#].b', '5');

SELECT json_set('[1,2]', '$[9999999999999999999]', '9');

SELECT json_strip_nulls('{"a":1,"b":null}');

SELECT json_strip_nulls('{"a":null,"b":null}');

SELECT json_strip_nulls('{"a":{"x":null},"b":2}');

SELECT json_strip_nulls('[{"a":null,"b":1},{"c":null}]');

SELECT json_strip_nulls('true');

SELECT json_strip_nulls('{}');

SELECT json_strip_nulls('{"a":{"b":{"c":null}}}');

INSERT INTO json_data VALUES
    (1, '{"a":1,"b":null}'),
    (2, '{"x":null,"y":null}'),
    (3, NULL);

select json_structure('42');

select json_structure('true');

select json_structure('{"a": 4.2}');

select json_structure('{"a": null}');

select json_structure('{"a": [42]}');

select json_structure('[true,null,false]');

select json_structure('[true,null,false,1,-1,0.42]');

select json_structure('[{"a": 42}, {"b": 4.2}]');

select json_structure('[{"a": [{"b": 42}, {"b": null}]}, {"a": [{"c": 7}]}]');

select json_structure('[[1], {"a": 1}]');

insert into test values
    ('{"family": "anatidae", "species": ["duck", "goose", "swan", null], "coolness": 1000}'),
    ('{"family": "canidae", "species": ["labrador", null, "bulldog", "shepherd"], "hair": true, "coolness": 999}'),
    (NULL),
    ('{"family": null, "species": null, "hair": null, "coolness": null}'),
    ('{"family": "felidae", "species": ["tiger", "lion", null, "british shorthair"], "hair": true, "coolness": 999}');

select json_structure(repeat('[', 200) || repeat(']', 200)) =
       repeat('[', 200) || '"NULL"' || repeat(']', 200);

SELECT json_structure(c) = '{' || repeat('"k":{', 200) || '"v":"UBIGINT"' || repeat('}', 200) || '}' FROM j;

SELECT json_structure(j) = repeat('[', 200) || '"NULL"' || repeat(']', 200) FROM t;

SELECT json_structure(repeat('{"q":', 10000) || 'null' || repeat('}', 10000)) =
       repeat('{"q":', 10000) || '"NULL"' || repeat('}', 10000);

SELECT json_structure('[{"a":[1],"b":{"q":2}},{"a":true,"b":3,"c":null}]');

SELECT json_structure('{"x":true,"x":1,"x":{"ignored":1},"tail":"ok"}');

SELECT json_structure('[{"a":null,"b":1,"c":true},{"a":"s","b":2.5,"c":null,"tail":0}]');

select from_json_strict('42', '"UBIGINT"');

select json_transform('null', '"NULL"');

select json_transform('"duuuuuuuuuuuuuuuuck"', '"VARCHAR"');

select json_transform('{"a": null}', '{"a":"UBIGINT"}');

select json_transform('[1,2,3]', '["UBIGINT"]');

SELECT from_json(j, '"DOUBLE"')
FROM (VALUES ('1'::JSON), ('2.5'::JSON), ('"3"'::JSON), ('null'::JSON)) values_(j);

select json_transform('[{"a": 42}, {"a": null, "b": 33}, {"b": 7}]', '[{"a": "UBIGINT", "b": "UBIGINT"}]');

select json_transform('-42', '"INTEGER"');

select json_transform('42', '"JSON"');

select hex(json_transform('{"a": "x\ny"}', '"BLOB"'));

select json_transform('42.42', '"VARCHAR"');

select json_transform('{}', '"VARCHAR"');

select json_transform('42', '"DECIMAL(2)"');

select json_transform('"42"', '"DECIMAL(3,1)"');

select json_transform('42.42', '"DECIMAL(20,2)"');

select json_transform('true', '"DECIMAL(3,1)"');

select json_transform('42', '"DECIMAL(2,1)"');

select json_transform('"A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11"', '"UUID"');

select json_transform('42.42', '"UUID"');

select json_transform('null', '"UUID"');

select json_transform('42', '"DATE"');

select json_transform('"42"', '"DATE"');

select json_transform('false', '"DATE"');

select json_transform('"1996-03-27 11:59:59"', '"TIMESTAMP"');

select json_transform('"1996-03-27 11:59:59"', '"TIMESTAMP_S"');

CREATE OR REPLACE TYPE test_enum AS ENUM ('a', 'b', 'c');

select json_transform('{"test": ["a","b"]}', '{"test": "test_enum[2]"}');

select to_json(json_transform_strict('{"a\u0000b":1}', '{"a\u0000b":"INTEGER"}'));

select json_type('"other"');

select json_type('null');

select json_type('{"str": "quack"}', 'str');

select json_type(NULL, 'str');

select json_type('{"null": -Infinity}', 'null');

select json_type(json, 'str') from test;

select json_type(json, 'bool') from test;

select json_type(json, '/nested/val') from test;

SELECT json_type('{"a":[2,3.5,true,false,null,"x"]}');

SELECT json_type('{"a":[2,3.5,true,false,null,"x"]}','$.a[0]');

SELECT json_type('{"a":[2,3.5,true,false,null,"x"]}','$.a[3]');

SELECT json_type('{"a":[2,3.5,true,false,null,"x"]}','$.a[6]');

select json_type(json_extract('{"duck":[1,2,3]}', '$.duck[*]'));

CREATE TABLE j1(x varchar);

SELECT json_valid('{"a":55,"b":72,}');

SELECT json_valid('["a",55,"b",72]');

SELECT json_valid('" \" "');

SELECT json_valid('" \% "');

SELECT json_valid('" \( "');

SELECT json_valid('" \+ "');

SELECT json_valid('" \. "');

SELECT json_valid('" \1 "');

SELECT json_valid('" \4 "');

SELECT json_valid('" \7 "');

SELECT json_valid('" \: "');

SELECT json_valid('" \= "');

SELECT json_valid('" \@ "');

SELECT json_valid('" \C "');

SELECT json_valid('" \F "');

SELECT json_valid('" \I "');

SELECT json_valid('" \L "');

SELECT json_valid('" \O "');

SELECT json_valid('" \R "');

SELECT json_valid('" \U "');

SELECT json_valid('" \X "');

SELECT json_valid('" \[ "');

SELECT json_valid('" \^ "');

SELECT json_valid('" \ua "');

SELECT json_valid('" \uabcd "');

SELECT json_valid('" \{ "');

SELECT json_valid('" \~ "');

SELECT json_valid('{"x":0}');

SELECT json_valid('{"x":-0.1}');

SELECT json_valid('{"x":01.5}');

SELECT json_valid('{"x":-00}');

select json_value('null', '$');

select json_value('{"my_field": {"my_nested_field": ["goose", "duckduckduckduck"]}}', '/my_field/my_nested_field/1');

SELECT json_value('{"a":2,"c":[4,5,{"f":7}]}', '$.c');

SELECT json_value('{"a":2,"c":[4,5,{"f":7}]}', '$.x');

SELECT json_value(NULL, ['$.x', '$.a']);

SELECT json_value(j, '$.b[#-000001]') a, a = json_value(j, '$.b[-000001]') FROM t1;

SELECT json_value(x, '$.settings.layer2."tris.legomenon"."summary.report"') FROM t12;

INSERT INTO types VALUES
    ('POINT EMPTY'),
    ('POINT(0 0)'),
    ('LINESTRING EMPTY'),
    ('LINESTRING(0 0, 1 1)'),
    ('POLYGON EMPTY'),
    ('POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'),
    ('MULTIPOINT EMPTY'),
    ('MULTIPOINT(0 0, 1 1)'),
    ('MULTILINESTRING EMPTY'),
    ('MULTILINESTRING((0 0, 1 1), (2 2, 3 3))'),
    ('MULTIPOLYGON EMPTY'),
    ('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)), ((2 2, 3 2, 3 3, 2 3, 2 2)))'),
    ('GEOMETRYCOLLECTION EMPTY'),
    ('GEOMETRYCOLLECTION(POINT(0 0), LINESTRING(0 0, 1 1))');

SELECT ST_AsGeoJSON('POINT(1 2)'::GEOMETRY)->>'$.type';

SELECT ST_AsGeoJSON('POINT M(1 2 3)'::GEOMETRY);

SELECT ST_AsGeoJSON('GEOMETRYCOLLECTION(GEOMETRYCOLLECTION(POINT(1 2)))'::GEOMETRY);

SELECT ST_AsGeoJSON('POINT(-122.4194 37.7749)'::GEOMETRY);

SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[1,2]}'::JSON));

SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[1.0,2.0,3.0],[4.0,5.0,6.0]]}'));

SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[1,2,3,4]}'));

SELECT ST_AsText(ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}'));

SELECT s.v, s.ordinality
FROM summary((SELECT unnest([2, 3]) AS v)) WITH ORDINALITY s
ORDER BY ALL;

SELECT o.id, q.value::VARCHAR, q.ordinality::INTEGER
FROM docs o, LATERAL json_each(o.j::JSON) WITH ORDINALITY q
ORDER BY ALL;

SELECT o.id, count(*)
FROM docs o, LATERAL json_each(o.j::JSON) WITH ORDINALITY q
GROUP BY o.id
ORDER BY o.id;

SELECT o.id, q.fullkey, q.ordinality::INTEGER
FROM (VALUES (1, '{"a": [1, 2]}')) o(id, j),
     LATERAL json_tree(o.j::JSON) WITH ORDINALITY q
ORDER BY q.ordinality;

SELECT q.json::VARCHAR, q.value::VARCHAR, q.ordinality::INTEGER
FROM (VALUES (1)) o(k),
     LATERAL json_each(unnest(CASE WHEN typeof(o.k) = 'INTEGER' THEN ['[1,2]', '[3]'] END)::JSON)
     WITH ORDINALITY q
ORDER BY ALL;

SELECT q.value::VARCHAR
FROM (VALUES (1)) o(k),
     LATERAL json_each(unnest(CASE WHEN typeof(o.k) = 'INTEGER' THEN ['{"a":[1]}', '{"a":[2]}'] END)::JSON, '$.a') q
ORDER BY ALL;

WITH docs(id, j) AS (VALUES (1, to_json(range(4097))), (2, to_json(range(3))))
SELECT d.id, count(*), min(e.ordinality), max(e.ordinality),
       bool_and(e.ordinality = e.value::BIGINT + 1)
FROM docs d, LATERAL json_each(d.j) WITH ORDINALITY e
GROUP BY d.id ORDER BY d.id;

SELECT o.id, q.ordinality::INTEGER
FROM (VALUES (1, '[]'), (2, '[7]')) o(id, j)
LEFT JOIN LATERAL json_each(o.j::JSON) WITH ORDINALITY q ON true
ORDER BY ALL;

SELECT fullkey, value FROM json_each('{"a.b": 1}');

SELECT count(*)
FROM json_tree('{"a.b": {"c": [1, 2]}}')
WHERE json_extract('{"a.b": {"c": [1, 2]}}', fullkey) IS DISTINCT FROM value;

SELECT key, fullkey FROM json_each('{"a\"b": 1}');

SELECT key, fullkey FROM json_each('{"": 1}');

SELECT json_extract('{"nested": {"a.b": 1}}', fullkey) FROM json_each('{"nested": {"a.b": 1}}', '$.nested');

CREATE TABLE j AS SELECT json_object('a', i, 'b', [i, i + 1]) AS doc FROM range(10000) t(i);

SELECT count(*) AS probe_unnest FROM j, LATERAL unnest([j.doc]) r(x);

SELECT count(*) AS probe_end FROM range(1);

SELECT count(*), count(DISTINCT path) FROM j, LATERAL json_tree(j.doc);

SELECT count(*) FROM (
	(SELECT j.doc, t.* FROM j, LATERAL json_tree(j.doc) t EXCEPT ALL SELECT * FROM tree_one_thread)
	UNION ALL
	(SELECT * FROM tree_one_thread EXCEPT ALL SELECT j.doc, t.* FROM j, LATERAL json_tree(j.doc) t)
);

SELECT ST_AsText(geometry) FROM read_json('data/json/geojson/malformed.geojsonl', ignore_errors=true);

SELECT column_name, column_type
FROM (DESCRIBE SELECT * FROM read_json('data/json/geojson/features.geojson'));

SELECT count(*) FROM 'data/json/geojson/features.geojsonl';

SELECT column_name, column_type
FROM (DESCRIBE SELECT * FROM read_json('data/json/geojson/features.geojson', geojson=false));

SELECT column_name, column_type
FROM (DESCRIBE SELECT * FROM read_json('data/json/geojson/geometries.geojsonl'));

SELECT id, ST_AsText(loc), tag FROM read_json('data/json/geojson/nested.ndjson', geojson=false, columns={id: 'INTEGER', loc: 'GEOMETRY', tag: 'VARCHAR'});

SELECT count(*) FROM read_json('data/json/geojson/features.geojsonl');

SELECT column_name, column_type
FROM (DESCRIBE SELECT * FROM read_json('data/json/geojson/nested.ndjson'));

SELECT ST_AsText(geometry), id, bbox, id_1, name
FROM read_json('data/json/geojson/pseudo_columns.geojsonl') ORDER BY id;

SELECT id FROM read_json('data/json/geojson/pseudo_columns.geojsonl') ORDER BY id;

SELECT ST_AsText(geometry), id, id_1, id_1_1, name, geometry_1
FROM read_json('data/json/geojson/pseudo_columns_nasty.geojsonl');

SELECT ST_AsText(geometry), id, name FROM features ORDER BY id;

SELECT ST_AsText(geometry), bbox FROM boxes ORDER BY bbox;

COPY property_ids FROM 'data/json/geojson/property_id.geojsonl' (FORMAT GEOJSON);

COPY feature_ids FROM 'data/json/geojson/pseudo_columns.geojsonl' (FORMAT GEOJSON);

select count(*) from duckdb_external_file_cache() where path like '%example_rn.ndjson%';

drop table if exists date_copy_test;

drop table if exists timestamp_copy_test;

create table timestamptz_test as select '1996-03-27 07:42:33+00'::TIMESTAMPTZ t;

SELECT id, d FROM decimals WHERE id <= 2 ORDER BY id;

SELECT json_transform('{"d": 1, "n": 9007199254740993.0, "m": 9223372036854775807.0}', '{"d": "DECIMAL(2,0)", "n": "BIGINT", "m": "BIGINT"}'),
       json_transform('{"n": 9007199254740993.0, "m": 9223372036854775807.0}', '{"n": "BIGINT", "m": "BIGINT"}'),
       json_transform('{"n": 9007199254740993.0}', '{"n": "DECIMAL(20,1)"}');

SELECT * FROM read_json('data/json/ignore_errors_spanning_record.ndjson', format = 'newline_delimited', ignore_errors = true, columns = {'a': 'VARCHAR'}, maximum_object_size = 64);

SELECT name FROM read_single_json_file('data/json/example_n.ndjson') WHERE id > 3 ORDER BY id;

SELECT * FROM read_single_json_file('data/json/unterminated_quotes.ndjson', ignore_errors=true) LIMIT 3;

SELECT count(*), count(DISTINCT filename) FROM read_json('data/json/example_*.ndjson', filename=true);

SELECT count(*) FROM read_json('data/json/unterminated_quotes.ndjson', ignore_errors=true);

SELECT count(*) FROM read_json('data/json/this_file_does_not_exist.json', allow_empty=true);

SELECT * FROM copy_target ORDER BY id;

SELECT count(*) FROM copy_target;

SELECT sum(id) FROM copy_one;

SELECT count(*) FROM copy_errors;

CREATE TABLE copy_geo(geometry GEOMETRY, name VARCHAR);

CREATE TABLE copy_rt(id BIGINT, name VARCHAR);

SELECT json_deserialize_sql(json_serialize_sql('SELECT * FROM t AT (VERSION => 1)'));

SELECT json_deserialize_sql(json_serialize_sql('SELECT sum(a) OVER w, sum(a) OVER (ORDER BY b ROWS BETWEEN 2 PRECEDING AND 1 FOLLOWING) FROM t WINDOW w AS (PARTITION BY b)'));

CREATE TABLE t(i INTEGER, s VARCHAR);

BEGIN;

SELECT * FROM json_execute_serialized_sql(json_serialize_sql('SELECT * FROM json_execute_serialized_sql(json_serialize_sql(''SELECT 42 AS a''))'));

EXECUTE p;

EXPLAIN SELECT * FROM json_execute_serialized_sql(json_serialize_sql('SELECT nextval(''ro.seq'')'));

WITH RECURSIVE
c AS MATERIALIZED (
    SELECT * FROM json_execute_serialized_sql(
        json_serialize_sql('SELECT 1 UNION ALL SELECT 2')
    )
),
walk(depth) AS (
    SELECT 0
    UNION ALL
    SELECT depth + 1
    FROM walk
    WHERE depth < (SELECT count(*) FROM c)
)
SELECT depth FROM walk ORDER BY depth;

SELECT json_extract('{"key": true}', '$.key')::BOOLEAN;

SELECT 1::TINYINT::JSON::TINYINT;

SELECT 1::BIGINT::JSON::BIGINT;

SELECT date '2024-01-01'::DATE::JSON::DATE;

SELECT '2024-06-01 00:00:00'::TIMESTAMP_MS::JSON::TIMESTAMP_MS;

SELECT 1::DECIMAL(10, 2)::JSON::DECIMAL(10, 2);

SELECT '883406386745030.3'::JSON::DECIMAL(16, 1);

SELECT (-(1::HUGEINT << 100))::DECIMAL(38, 0)::JSON::DECIMAL(38, 0);

SELECT 1::DOUBLE::JSON::DOUBLE;

SELECT 'blob'::BLOB::JSON::BLOB;

SELECT 1::USMALLINT::JSON::USMALLINT;

SELECT '2024-06-01 00:00:00+00'::TIMESTAMPTZ::JSON::TIMESTAMPTZ;

SELECT 1::UHUGEINT::JSON::UHUGEINT;

SELECT 'POINT(0 1)'::GEOMETRY::JSON::GEOMETRY;

SELECT map(ARRAY[1], ARRAY['one'])::JSON::MAP(INTEGER, VARCHAR);

SELECT 'sad'::mood::JSON::mood;

SELECT 'foo'::VARIANT::JSON::VARIANT;

SELECT TRY_CAST(v AS JSON[]) FROM (VALUES ('{}')) t(v);

SET debug_verify_serializer=true;

SELECT json_deserialize_sql(json_serialize_sql('SELECT a FROM (SELECT 1 a) GROUP BY GROUPING SETS ((a), ())'));

SELECT * FROM json_execute_serialized_sql($json$
{"error":false,"statements":[{"node":{"type":"SELECT_NODE","modifiers":[],"cte_map":{"map":[]},"select_list":[{"class":"CONSTANT","type":"VALUE_CONSTANT","alias":"","query_location":7,"value":{"type":{"id":"DECIMAL","type_info":{"type":"DECIMAL_TYPE_INFO","alias":"","width":4,"scale":1}},"is_null":false,"value":15}}],"from_table":{"type":"EMPTY","alias":"","sample":null,"query_location":18446744073709551615},"where_clause":null,"group_expressions":[],"group_sets":[],"aggregate_handling":"STANDARD_HANDLING","having":null,"sample":null,"qualify":null},"named_param_map":[]}]}
$json$);

SELECT * FROM json_execute_serialized_sql('{"error":false,"statements":[{"node":{"type":"SELECT_NODE","modifiers":[],"cte_map":{"map":[]},"select_list":[{"class":"CONSTANT","type":"VALUE_CONSTANT","alias":"","query_location":0,"query_location_length":0,"value":{"type":{"id":"TIME","type_info":null},"is_null":false,"value":86400000000}}],"from_table":{"type":"EMPTY","alias":"","sample":null,"query_location":0,"query_location_length":0},"where_clause":null,"group_expressions":[],"group_sets":[],"aggregate_handling":"STANDARD_HANDLING","having":null,"sample":null,"qualify":null},"named_param_map":[]}]}');

SELECT * FROM json_execute_serialized_sql('{"error":false,"statements":[{"node":{"type":"SELECT_NODE","modifiers":[],"cte_map":{"map":[]},"select_list":[{"class":"CONSTANT","type":"VALUE_CONSTANT","alias":"","query_location":0,"query_location_length":0,"value":{"type":{"id":"MAP","type_info":{"type":"LIST_TYPE_INFO","alias":"","extension_info":null,"child_type":{"id":"STRUCT","type_info":{"type":"STRUCT_TYPE_INFO","alias":"","extension_info":null,"child_types":[{"first":"key","second":{"id":"INTEGER","type_info":null}},{"first":"value","second":{"id":"INTEGER","type_info":null}}]}}}},"is_null":false,"value":{"children":[{"is_null":false,"value":{"children":[{"is_null":false,"value":1},{"is_null":false,"value":2}]}}]}}}],"from_table":{"type":"EMPTY","alias":"","sample":null,"query_location":0,"query_location_length":0},"where_clause":null,"group_expressions":[],"group_sets":[],"aggregate_handling":"STANDARD_HANDLING","having":null,"sample":null,"qualify":null},"named_param_map":[]}]}');

CREATE MACRO pointer_sql(representation) AS
    '{"error":false,"statements":[{"node":{"type":"SELECT_NODE","cte_map":{},"select_list":[{"class":"CONSTANT","type":"VALUE_CONSTANT",' ||
    CASE representation
        WHEN 'literal' THEN '"literal":{"kind":"POINTER","text":"0x2a"}'
        ELSE '"value":{"type":{"id":"POINTER"},"is_null":false,"value":42}'
    END ||
    '}],"aggregate_handling":"STANDARD_HANDLING"}}]}';

select typeof(c1), typeof(c2) from tbl;

SELECT * FROM json_execute_serialized_sql('{"error": false, "statements": [{"node": {"type": "SELECT_NODE", "modifiers": [], "cte_map": {"map": []}, "select_list": [{"class": "STAR", "type": "STAR", "alias": "", "query_location": 7, "query_location_length": 1, "relation_name": "", "exclude_list": [], "replace_list": [], "columns": false, "expr": null, "qualified_exclude_list": [], "rename_list": []}], "from_table": {"type": "SUBQUERY", "alias": "t", "sample": null, "query_location": 14, "query_location_length": 12, "subquery": {"node": {"type": "SELECT_NODE", "modifiers": [], "cte_map": {"map": []}, "select_list": [{"class": "STAR", "type": "STAR", "alias": "", "query_location": 18446744073709551615, "query_location_length": 0, "relation_name": "", "exclude_list": [], "replace_list": [], "columns": false, "expr": null, "qualified_exclude_list": [], "rename_list": []}], "from_table": {"type": "EXPRESSION_LIST", "alias": "valueslist", "sample": null, "query_location": 18446744073709551615, "query_location_length": 0, "expected_names": [], "expected_types": [{"id": "INTEGER", "type_info": {"type": "GENERIC_TYPE_INFO", "alias": "myint"}}], "values": [[{"class": "CONSTANT", "type": "VALUE_CONSTANT", "alias": "", "query_location": 23, "query_location_length": 1, "literal": {"kind": "INTEGER", "text": "1"}}]]}, "where_clause": null, "group_expressions": [], "group_sets": [], "aggregate_handling": "STANDARD_HANDLING", "having": null, "sample": null, "qualify": null}, "named_param_map": []}, "column_name_alias": ["a"]}, "where_clause": null, "group_expressions": [], "group_sets": [], "aggregate_handling": "STANDARD_HANDLING", "having": null, "sample": null, "qualify": null}, "named_param_map": []}]}');

drop table text;

SELECT to_json('POINT(1 2)'::GEOMETRY), 'POINT(1 2)'::GEOMETRY::JSON;

SELECT json_object('g', 'LINESTRING(0 0, 1 1)'::GEOMETRY);

CREATE TABLE t(g INT, k VARCHAR, v INT);

SELECT DISTINCT json_group_array(v) OVER (PARTITION BY g) FROM t ORDER BY 1;

select json_group_object(n, v) from t1;

create table t2 (j json);

select json(' { "this" : "is", "a": [ "test" ] }');

select typeof(j), j from test;

SELECT json_serialize_plan('SELECT *, 1 + 2 FROM tbl1', skip_null := true, skip_empty := true);

CREATE TABLE top_n AS SELECT range AS a, range AS b FROM range(10);

SELECT plan::VARCHAR LIKE '%LOGICAL_CHUNK_GET%', plan::VARCHAR NOT LIKE '%"column_ids"%'
FROM (
	SELECT json_serialize_plan(
		'SELECT i FROM range(20) t(i) WHERE i IN (1, 3, 5, 7, 9, 11)',
		skip_default := true, optimize := true
	) plan
);

SELECT json_extract(
	json_serialize_plan(
		'SELECT 1::TINYINT, 2::UTINYINT, 3::SMALLINT, 4::USMALLINT, '
		'170141183460469231731687303715884105727::HUGEINT, '
		'340282366920938463463374607431768211455::UHUGEINT, '
		'1.25::FLOAT, 2.5::DOUBLE, ''NaN''::DOUBLE',
		optimize := true
	),
	'$.plans[0].expressions[*].value.type.id'
);

select json_serialize_plan('select blob ''\\x00''');

SELECT (json_serialize_sql('SELECT' || chr(160) || ')')->>'position')::INTEGER,
       (json_serialize_sql('SELECT' || chr(8195) || ')')->>'position')::INTEGER;

SELECT json_serialize_sql('SELECT *, 1 + 2 FROM tbl1', skip_null := true, skip_empty := true);

SELECT json_serialize_sql('SELECT AND LAUNCH ROCKETS WHERE 1 = 1');

SELECT json_deserialize_sql(json_serialize_sql('SELECT * FROM (SELECT 1 + 2)'));

SELECT json_deserialize_sql(json_serialize_sql('SELECT 1e10000'));

INSERT INTO tbl2 VALUES (1, 2, 3), (4, 5, 6), (7, 8, 9);

PRAGMA json_execute_serialized_sql(
	'{"error":false,"statements":[{"node":{"type":"SELECT_NODE","modifiers":[],"cte_map":{"map":[]},"select_list":[{"class":"FUNCTION","type":"FUNCTION","alias":"","function_name":"+","schema":"","children":[{"class":"FUNCTION","type":"FUNCTION","alias":"","function_name":"+","schema":"","children":[{"class":"COLUMN_REF","type":"COLUMN_REF","alias":"","column_names":["a"]},{"class":"COLUMN_REF","type":"COLUMN_REF","alias":"","column_names":["b"]}],"filter":null,"order_bys":{"type":"ORDER_MODIFIER","orders":[]},"distinct":false,"is_operator":true,"export_state":false,"catalog":""},{"class":"COLUMN_REF","type":"COLUMN_REF","alias":"","column_names":["c"]}],"filter":null,"order_bys":{"type":"ORDER_MODIFIER","orders":[]},"distinct":false,"is_operator":true,"export_state":false,"catalog":""}],"from_table":{"type":"BASE_TABLE","alias":"","sample":null,"schema_name":"","table_name":"tbl2","column_name_alias":[],"catalog_name":""},"where_clause":null,"group_expressions":[],"group_sets":[],"aggregate_handling":"STANDARD_HANDLING","having":null,"sample":null,"qualify":null}}]}'
);

SELECT * FROM json_execute_serialized_sql(json_serialize_sql('WITH a(i) as (SELECT 1) SELECT a1.i as i1, a2.i as i2 FROM a as a1, a as a2'));

SELECT count(*)
FROM json_deserialize_filter_pushdown
WHERE json_exists(j, '$.statements[0]')
  AND json_deserialize_sql(j) IS NOT NULL;

INSERT INTO ms VALUES (1, 'JAN', 10);

SELECT count(*) FROM j1 WHERE json_type(x) IN ('OBJECT','ARRAY');

INSERT INTO j2(id,json,src)
    VALUES(1,'{
    "firstName": "John",
    "lastName": "Smith",
    "isAlive": true,
    "age": 25,
    "address": {
      "streetAddress": "21 2nd Street",
      "city": "New York",
      "state": "NY",
      "postalCode": "10021-3100"
    },
    "phoneNumbers": [
      {
        "type": "home",
        "number": "212 555-1234"
      },
      {
        "type": "office",
        "number": "646 555-4567"
      }
    ],
    "children": [],
    "spouse": null
    }','https://en.wikipedia.org/wiki/JSON');

SELECT id, json_valid(json), json_type(json) FROM j2 ORDER BY id;
