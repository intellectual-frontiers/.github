SELECT count() FROM test.hits;

SELECT x FROM (SELECT arrayJoin(['Hello', 'Goodbye']) AS x);

SELECT s, nest.x, nest.y FROM nested_test ARRAY JOIN nest.x;

SELECT count() FROM merge_hits WHERE AdvEngineID = 2;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 9626742;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 30489182;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 10463153;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 27784549;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 26531140;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 84668;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 25535479;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 233447;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 1552720;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 27751340;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 6462629;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 16554922;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 24596247;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 26788657;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 27417156;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 15163979;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 8576994;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 122578;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 31467341;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 3841725;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 25726446;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 429238;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 7631750;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 4189114;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 12646802;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 28671820;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 31007051;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 30854698;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 31737265;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 54647;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 811438;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 14870120;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 18190567;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 27050219;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 187532;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 1468384;

SELECT uniq(UserID), sum(Sign) FROM test.visits WHERE CounterID = 29580949;

DROP TABLE big_array;

SELECT 0 AS x1, 1 AS x2, -1 AS x3, 128 AS x4, -127 AS x5, -128 AS x6, 0xFF AS x7, -0x80 AS x8, 0377 AS x9, -0177 AS x10, 0xFFFF AS x11, 0xFFFFFFFF AS x12, 123e2 AS x13, 0x123p4 AS x14, -0. AS x15, -.0 AS x16, 0. AS x17, 0xFFFFFFFFFFFFFFFF AS x18, 0x123456789ABCDEF01 AS x19, -0xFFFFFFFFFFFFFFFF AS x20, -0x7FFFFFFFFFFFFFFF AS x21, -0x1P1023 AS x22, -0x1p-1022 AS x23, inf AS x24, -INF AS x25, nan AS x26, 0 / 0 AS x27, 0.01e-300 AS x28, toTypeName(x1), toTypeName(x2), toTypeName(x3), toTypeName(x4), toTypeName(x5), toTypeName(x6), toTypeName(x7), toTypeName(x8), toTypeName(x9), toTypeName(x10), toTypeName(x11), toTypeName(x12), toTypeName(x13), toTypeName(x14), toTypeName(x15), toTypeName(x16), toTypeName(x17), toTypeName(x18), toTypeName(x19), toTypeName(x20), toTypeName(x21), toTypeName(x22), toTypeName(x23), toTypeName(x24), toTypeName(x25), toTypeName(x26), toTypeName(x27), toTypeName(x28);

insert into array_element_test VALUES (2), (1), (4), (3), (0);

SELECT
    StartDate,
    sumMerge(Visits)                AS Visits,
    uniqMerge(Users)                AS Users
FROM basic
GROUP BY StartDate
ORDER BY StartDate;

SELECT s FROM (SELECT materialize('abc') AS s FROM system.numbers LIMIT 100) ORDER BY s DESC;

SELECT CounterID, min(WatchID), max(WatchID) FROM test.hits GROUP BY CounterID ORDER BY count() DESC LIMIT 20 SETTINGS optimize_aggregation_in_order = 1;

SELECT count() FROM view;

INSERT INTO alter_00061 VALUES ('2015-01-01', 8, 40, [1,2,3], ['12','13','14']);

SET mutations_sync = 2;

DROP TABLE replicated_alter2;

SET optimize_skip_unused_shards = 0;

SELECT yesterday() + 1 = today();

SELECT count() FROM test.hits WHERE EventDate <= '2014-03-18';

SELECT
    -1 IN (-1),
    -1 IN (1, -1, 2),
    1.0 IN (1),
    1.1 IN (1, -1),
    1.0 IN (3, 1., -1),
    1 IN (3, 2, 1),
    toInt16(-1) IN (255),
    materialize(-1) IN (-1),
    materialize(-1) IN (1, -1, 2),
    materialize(1.0) IN (1),
    materialize(1.1) IN (1, -1),
    materialize(1.0) IN (3, 1., -1),
    materialize(1) IN (3, 2, 1),
    materialize(toInt16(-1)) IN (255);

select IPv6NumToString(toFixedString(unhex(materialize('20010DB800000003000001FF0000002E')), 16)) == materialize('2001:db8:0:3:0:1ff:0:2e');

SELECT cutIPv6(IPv6StringToNum('2001:0DB8:AC10:FE01:FEED:BABE:CAFE:F00D'), 0, 1);

SELECT cutIPv6(toFixedString(unhex('00000000000000000000FFFFC1FC110A'), 16), 11, 0);

INSERT INTO addresses(addr) VALUES ('00000000000000000000FFFFC1FC110A'), ('00000000000000000000FFFF4D583737'), ('00000000000000000000FFFF7F000001');

CHECK TABLE test.hits_tinylog;

select concat(toFixedString('a', 1), 'b') == 'ab';

select concat('a', materialize('b'), materialize('c')) == 'abc';

select concat(materialize('a'), materialize(toFixedString('b', 1)), toFixedString('c', 1)) == 'abc';

select concat(toFixedString('a', 1), toFixedString('b', 1), materialize(toFixedString('c', 1))) == 'abc';

select concat(materialize('a'), toFixedString('b', 1), 'c') == 'abc' from system.numbers limit 5;

select concat(materialize(toFixedString('a', 1)), materialize('b'), materialize(toFixedString('c', 1))) == 'abc' from system.numbers limit 5;

select col3, col4 from defaulted;

CREATE TABLE {CLICKHOUSE_DATABASE:Identifier}.A (A UInt8) ENGINE = Null;

SELECT CounterID AS k, quantileExact(0.5)(ResolutionWidth) FROM test.hits GROUP BY k ORDER BY count() DESC, CounterID LIMIT 10;

DROP TABLE IF EXISTS replicated_summing_merge_tree_with_list_of_columns_to_sum;

CREATE TABLE replicated_collapsing_merge_tree_with_sampling
	(d Date, a String, b UInt8, x String, y Int8, z UInt32) ENGINE = ReplicatedCollapsingMergeTree('/clickhouse/tables/{database}/test_00083/01/replicated_collapsing_merge_tree_with_sampling/', 'r1', d, sipHash64(a) + b, (a, sipHash64(a) + b), 111, y);

INSERT INTO replicated_summing_merge_tree_with_sampling_with_list_of_columns_to_sum VALUES ('2000-01-01', 'Hello, world!', 123, 'xxx yyy', -123, 123456789);

SET max_memory_usage = 1500000000;

select abs(1) = 1;

select abs(lgamma(3) - 0.693147181) < 1.0e-8;

select log1p(0) = 0;

select atan2(1, 1) = pi() / 4;

select atanh(0) = 0;

SELECT DISTINCT URL, URLDomain, position('http://yandex.ru/', domain(URL)) AS x FROM test.hits WHERE x > 8 ORDER BY position('http://yandex.ru/', domain(URL)) DESC, URL LIMIT 3;

DROP TABLE min_if;

SELECT DomainID FROM (SELECT DISTINCT 1 AS DomainID, 'abc' AS Domain UNION ALL SELECT 2 AS DomainID, 'def' AS Domain) ORDER BY DomainID ASC;

INSERT INTO report2(id,event_date,priority,description) VALUES (1, '2016-01-01', 6, 'bar')(2, '2016-02-01', 7, 'foo')(3, '2016-03-01', 8, 'bar')(4, '2016-04-01', 9, 'foo')(5, '2016-05-01', 10, 'bar');

DROP TABLE IF EXISTS `.inner.tmp_mv3`;

SET group_by_overflow_mode = 'any';

SELECT 'Український (default)';

DROP TABLE IF EXISTS numbers500k;

SELECT length(toString(groupArrayState(toDate(number)))) FROM (SELECT * FROM system.numbers LIMIT 10);

INSERT INTO set VALUES ('Hello'), ('World');

SELECT k, js1.s, t2.s FROM (SELECT number AS k, number AS s FROM system.numbers LIMIT 10) js1 ANY LEFT JOIN t2 ON js1.k == t2.k ORDER BY k;

SET automatic_parallel_replicas_mode = 0;

SELECT a FROM buffer_00126 ORDER BY a, b, c;

SELECT materialize(toFixedString('', 1)) AS x FROM system.one GROUP BY x;

SELECT materialize('Hello') IN (SELECT materialize('Hello'));

ALTER TABLE prewhere ADD COLUMN a1 String AFTER a;

select isFinite(1) = 1;

select isNaN(-inf) = 0;

SELECT round(corr(ResolutionWidth, ResolutionHeight), 6) FROM test.hits;

create table nested_map (d default toDate('2000-01-01'), k UInt64, payload default rand(), SomeMap Nested(ID String, Num Int64)) engine=SummingMergeTree(d, k, 8192);

-- test relies on PK index for monotonic function pruning and max_rows_to_read limits
SET max_rows_to_read = 60000;

SELECT count() FROM test.hits WHERE -CounterID > -732797 AND CounterID >= 107931;

create table summing_merge_tree_aggregate_function (
    d materialized today(),
    k UInt64,
    c UInt64,
    u AggregateFunction(uniq, UInt8),
    ue AggregateFunction(uniqExact, UInt8)
) engine=SummingMergeTree(d, k, 8192);

insert into summing_merge_tree_aggregate_function select 1, avgState(1.0);

drop table if exists nested_not_a_map;

SELECT k, s1, s2 FROM (SELECT intDiv(number, 3) AS k, sum(number) AS s1 FROM (SELECT * FROM system.numbers LIMIT 10) GROUP BY k) ANY LEFT JOIN (SELECT intDiv(number, 4) AS k, sum(number) AS s2 FROM (SELECT * FROM system.numbers LIMIT 10) GROUP BY k WITH TOTALS) USING k ORDER BY k;

SELECT * FROM (SELECT dummy, sum(dummy) GROUP BY dummy WITH TOTALS);

SELECT arrayMap(x -> 1, [2]), 123 AS y;

CREATE DATABASE IF NOT EXISTS {CLICKHOUSE_DATABASE:Identifier};

CREATE TABLE mt_00160 (d Date DEFAULT toDate('2015-05-01'), x UInt64) ENGINE = MergeTree PARTITION BY d ORDER BY x SETTINGS index_granularity = 1, min_bytes_for_wide_part = 0;

SELECT toUInt32(number) AS x, round(x, -1), roundBankers(x, -1), floor(x, -1), ceil(x, -1), trunc(x, -1) FROM system.numbers LIMIT 20;

SET min_bytes_to_use_mmap_io = 1;

SELECT 'Simple functions with non compilable function';

EXPLAIN ESTIMATE SELECT count() FROM test.hits WHERE CounterID = 29103473 UNION ALL SELECT count() FROM test.hits WHERE CounterID = 1704509;

select lowerUTF8('aaaaaaaaaaaaaaa012345789,.!aaaa' as str) = str;

-- Bug 68680
SELECT lengthUTF8(lowerUTF8('Ä\0'));

SELECT uniq(SearchPhrase) as u, max(URL) as m, count() AS c FROM test.hits_s3 WHERE URL LIKE '%metrika%' AND SearchPhrase != '' GROUP BY SearchPhrase ORDER BY u, m, c DESC LIMIT 10;

SELECT sumIf(number, x), sum(x) FROM (SELECT number, number IN (0 + 1, 2 + 3, toUInt64(concat('8', ''))) AS x FROM system.numbers LIMIT 10);

SELECT toDate('2015-02-05') > '2015-02-04';

SELECT '2015-02-03 04:05:06' = toDateTime('2015-02-03 04:05:06');

SELECT materialize(toDateTime('2015-02-03 04:05:06')) <= '2015-02-03 05:06:07';

insert into distinct_in_order select distinct CounterID, EventDate from test.hits order by CounterID, EventDate settings optimize_distinct_in_order=1;

SELECT number % 2 ? materialize([256]) : [3, 4, -5] AS res FROM system.numbers LIMIT 10 FORMAT TabSeparatedWithNamesAndTypes;

SELECT number % 2 ? materialize(['']) : materialize(['', '']) FROM system.numbers LIMIT 10;

/* varSamp */

SELECT varSamp(x_value) FROM (SELECT x_value FROM series LIMIT 0);

/* covarPop */

SELECT covarPop(x_value, y_value) FROM (SELECT x_value, y_value FROM series LIMIT 0);

/* covarSampStable */

SELECT covarSampStable(x_value, y_value) FROM (SELECT x_value, y_value FROM series LIMIT 0);

SELECT arrayCount(x -> 0, emptyArrayUInt8());

SELECT '---exists---';

SELECT arrayLast(x -> x, [1, 2, 3]);

SELECT arrayCumSum(x -> 0, range(number)) FROM system.numbers LIMIT 10;

SELECT arrayAll(x -> materialize(0), range(number)) FROM system.numbers LIMIT 10;

SELECT arrayCumSum(x -> materialize(10), emptyArrayUInt8());

SELECT arrayAll(x -> 1, emptyArrayString());

SELECT arrayMap(x -> materialize(123), emptyArrayString());

SELECT arrayExists(x -> materialize(0), emptyArrayString());

SELECT arrayCount(x -> number % 2, range(number)) FROM system.numbers LIMIT 10;

SELECT count(), uniq(dummy) FROM remote('127.0.0.{2,3,4,5}', system.one) SETTINGS distributed_group_by_no_merge=1;

SELECT 'func(aggregate function) GROUP BY';

SELECT count(), sum(1), uniq(123) FROM (SELECT * FROM system.numbers LIMIT 10);

/* toStartOfWeek (Monday) */

SELECT 'toStartOfWeek (Monday)';

SELECT toStartOfMonth(toDate(16433));

/* toMonth */

SELECT 'toMonth';

SELECT toMinute(toDateTime(1412106600), 'Europe/London');

/* toStartOfFifteenMinutes */

SELECT 'toStartOfFifteenMinutes';

SELECT toString(toStartOfInterval(toDateTime(1549483055), INTERVAL 5 day, 'Asia/Istanbul'), 'Asia/Istanbul');

SELECT toString(toStartOfInterval(toDate(17933), INTERVAL 5 day, 'Asia/Istanbul'), 'Asia/Istanbul');

SELECT toRelativeHourNum(toDateTime(1412106600), 'Europe/Paris') - toRelativeHourNum(toDateTime(0), 'Europe/Paris');

SELECT toDate(16343);

SELECT date_trunc('week', toDateTime('2020-01-01 04:11:22', 'Europe/London'), 'America/Vancouver');

SELECT date_trunc('day', toDateTime64('2020-01-01 04:11:22.123', 3, 'Europe/London'), 'America/Vancouver');

INSERT INTO aggregating_00191 (k, u) SELECT intDiv(number, 100) AS k, uniqState(toUInt64(number % 100) + 50) AS u FROM (SELECT * FROM system.numbers LIMIT 500, 1000) GROUP BY k;

SET enable_parallel_replicas=1, parallel_replicas_mode='sampling_key', max_parallel_replicas=3, parallel_replicas_for_non_replicated_merge_tree = 1;

SELECT number % 2 ? toFixedString(toString(number), 2) : toFixedString(toString(-number), 2) FROM system.numbers LIMIT 10;

select (1 ? (toUInt64(0) as i) : toUInt16(1)) = i;

--select (1 ? (toUInt64(0) as i) : toInt16(1)) = i;
select (1 ? (toInt8(0) as i) : toInt16(1)) = i;

SELECT k, x FROM (SELECT arrayJoin([1, 2, 3]) AS k, 'Hello' AS x) ANY FULL JOIN (SELECT range(k) AS y, arrayJoin([3, 4, 5]) AS k) USING k WHERE k < 10 ORDER BY k;

SELECT toUInt64((SELECT 9)) IN (SELECT number FROM system.numbers LIMIT 10);

SELECT toUInt64(1) IN (1234567890, 2345678901, 3456789012, 4567890123, 5678901234, 6789012345, 7890123456, 8901234567, 9012345678, 123456789) AS x,
    x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x,
    x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x,
    x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x,
    x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x, x
FROM remote('127.0.0.2', system, one) SETTINGS max_query_size = 10000;

SELECT Y, uniqCombined(12)(X) FROM (SELECT number AS X, (3*X*X - 7*X + 11) % 37 AS Y FROM system.numbers LIMIT 1000000) GROUP BY Y ORDER BY Y;

SELECT Y, uniqCombined(X) FROM (SELECT number AS X, round(toFloat32(1/(1 + (3*X*X - 7*X + 11) % 37)), 3) AS Y FROM system.numbers LIMIT 3000) GROUP BY Y ORDER BY Y;

SELECT Y, uniqCombined(20)(Z) FROM (SELECT number AS X, IPv4NumToString(toUInt32(X)) AS Z, (3*X*X - 7*X + 11) % 37 AS Y FROM system.numbers LIMIT 15) GROUP BY Y ORDER BY Y;

select
	bitTestAll(0, 0) = 0,
	bitTestAll(1, 0) = 1,
	bitTestAll(1, 1) = 0,
	bitTestAll(0xff, 0) = 1,
	bitTestAll(0xff, 1) = 1,
	bitTestAll(0xff, 2) = 1,
	bitTestAll(0xff, 3) = 1,
	bitTestAll(0xff, 4) = 1,
	bitTestAll(0xff, 5) = 1,
	bitTestAll(0xff, 6) = 1,
	bitTestAll(0xff, 7) = 1,
	bitTestAll(0xff, 0, 1) = 1,
	bitTestAll(0xff, 2, 3) = 1,
	bitTestAll(0xff, 4, 5) = 1,
	bitTestAll(0xff, 6, 7) = 1,
	bitTestAll(0xff, 0, 1, 2, 3) = 1,
	bitTestAll(0xff, 4, 5, 6, 7) = 1,
	bitTestAll(0xff, 0, 1, 2, 3, 4, 5, 6, 7) = 1,
	bitTestAll(0x81, 0) = 1,
	bitTestAll(0x81, 1) = 0,
	bitTestAll(0x81, 2) = 0,
	bitTestAll(0x81, 3) = 0,
	bitTestAll(0x81, 4) = 0,
	bitTestAll(0x81, 5) = 0,
	bitTestAll(0x81, 6) = 0,
	bitTestAll(0x81, 7) = 1,
	bitTestAll(0x81, 0, 1) = 0,
	bitTestAll(0x81, 2, 3) = 0,
	bitTestAll(0x81, 4, 5) = 0,
	bitTestAll(0x81, 6, 7) = 0,
	bitTestAll(0x81, 0, 1, 2, 3) = 0,
	bitTestAll(0x81, 4, 5, 6, 7) = 0,
	bitTestAll(0x81, 0, 1, 2, 3, 4, 5, 6, 7) = 0,
	bitTestAll(0x81, 0, 7) = 1;

select 1 = sequenceMatch('')(time, data = 0, data = 1, data = 2, data = 3) from sequence_test;

select 3 = sequenceCount('(?2)')(time, data = 0, data = 1, data = 2, data = 3) from sequence_test;

select [0,1,2] = sequenceMatchEvents('(?1)(?1)(?1)')(time, data = 0, data = 1, data = 2, data = 3) from sequence_test;

-- `shardNum()` is evaluated on each shard, so the two shards of one query can read different sets of keys.

SET distributed_aggregation_memory_efficient = 0;

SET distributed_aggregation_memory_efficient = 1,
    group_by_two_level_threshold = 1000,
    group_by_overflow_mode = 'any',
    max_rows_to_group_by = 1000,
    totals_mode = 'after_having_auto';

select *, length(arr) as l from prewhere_column_missing;

select 3 = countEqual([0 as x, 1, x, x], x);

select 1 = position('', '', 1);

select 1 = position('абв', 'абв');

select 3 = positionUTF8('абв', 'в');

select 2 = positionUTF8('абвабв', 'бва', 0);

select 2 = positionUTF8(materialize('абвабв'), materialize('бва'), 0) from system.numbers limit 10;

select 1 = positionCaseInsensitive('абв', '');

select 1 = positionCaseInsensitiveUTF8(materialize(''), '') from system.numbers limit 10;

select position('абв' as h, lower('' as n)) = positionCaseInsensitive(h, n);

select positionUTF8(materialize('абв') as h, lowerUTF8('В' as n)) = positionCaseInsensitiveUTF8(h, n);

select 3 = position('abcdefgh', materialize('cdefgh'));

select 1 = position('abcdefgh', materialize('abcd')) from system.numbers limit 10;

select 2 = position('abcdefgh', materialize('bcde')) from system.numbers limit 129;

select 6 = position('abcdefgh', materialize('fgh')) from system.numbers limit 129;

select 0 = position('abc', materialize('def'));

select 1 = position('abc', materialize(''));

-- Tag no-replicated-database: Old syntax is not allowed
-- no-shared-merge-tree: implemented replacement

SET replication_alter_partitions_sync = 2;

SELECT s, replaceAll(s, '_', 'o') AS a, replaceRegexpAll(s, '_', 'o') AS b, a = b FROM (SELECT arrayJoin(['._', '.']) AS s);

SELECT s, replaceAll(s, '_', 'oo') AS a, replaceRegexpAll(s, '_', 'oo') AS b, a = b FROM (SELECT arrayJoin(['_._', '_._']) AS s);

SELECT s, replaceOne(s, '_', 'o') AS a, replaceRegexpOne(s, '_', 'o') AS b, a = b FROM (SELECT arrayJoin(['_.', '_._']) AS s);

SELECT s, replaceOne(s, '_', 'o') AS a, replaceRegexpOne(s, '_', 'o') AS b, a = b FROM (SELECT arrayJoin(['.__', '__.__']) AS s);

SELECT has([1, 2.1, 3], 2);

SELECT * FROM defaults;

SELECT arrayStringConcat(arr, '; ') FROM (SELECT [toDate('2021-10-01'), toDate('2021-10-02')] AS arr);

select 11 AS z from (SELECT 1 UNION ALL SELECT 2) group by 42, 43, 44 WITH TOTALS;

SELECT '{a' AS x, x LIKE (concat(x, '%') AS pat), materialize(x) LIKE pat;

select d1, a1 from aliases_test array join d1, a1;

select array, d1, a1, a2, a3, a4, a5, a6, joined from aliases_test array join a2 as joined;

select array, struct.d1, struct.a1, struct.a2, struct.a3, struct.a4, struct.a5, struct.a6, joined from aliases_test array join struct.a5 as joined;

select class.key, class.value from aliases_test array join struct as class;

SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 WHERE 1 IN (SELECT 1 WHERE 0);

SET max_block_size = 10;

SELECT count(), min(x), max(x), sum(x), uniqExact(x) FROM sample_00276 SAMPLE 1/2 OFFSET 1/2;

SELECT quantilesExactWeighted(1, 0.001, 0.01, 0.05, 0.9, 0.2, 0.3, 0.6, 0.5, 0.4, 0.7, 0.8, 0.1, 0.95, 0.99, 0.999, 0, 0.5, 0.3, 0.4)(x, 1) FROM (SELECT number AS x FROM system.numbers LIMIT 1001);

SET max_memory_usage = 410000000;

SELECT
    arrayReduce('uniq', [1, 2, 1]) AS a,
    arrayReduce('uniq', [1, 2, 2, 1], ['hello', 'world', '', '']) AS b,
    arrayReduce('uniqUpTo(5)', [1, 2, 2, 1], materialize(['hello', 'world', '', ''])) AS c,
    arrayReduce('uniqExactIf', [1, 2, 3, 4], [1, 0, 1, 1]) AS d;

-- Comparison
select * from enums where e = e;

INSERT INTO enum (x) VALUES ('\t\\t');

SELECT 'Hello & world' AS s, 'Hello\n<World>', toDateTime('2001-02-03 04:05:06') AS time, arrayMap(x -> toString(x), range(10)) AS arr, (s, time) AS tpl SETTINGS extremes = 1, enable_named_columns_in_function_tuple = 0 FORMAT XML;

ATTACH TABLE array_pk;

SELECT abs(sum(_sample_factor) - 3000000) / 3000000 < 0.001 FROM merge(currentDatabase(), '^sample_00314_\\d$') SAMPLE 100000;

SELECT * FROM pk WHERE x = 3 ORDER BY ALL;

SELECT * FROM pk WHERE z = 1235 ORDER BY ALL;

SELECT s FROM index_for_like WHERE s LIKE '%Hello%';

SELECT multiIf(rand() % 2 = 0, emptyArrayString(), emptyArrayString());

SELECT multiIf((number % 2) = 0, toInt8(1), (number % 3) = 0, toInt32(2), toUInt16(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt8(1), (number % 3) = 0, toUInt16(2), toFloat32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt16(1), (number % 3) = 0, toInt8(2), toInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt16(1), (number % 3) = 0, toInt64(2), toInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt16(1), (number % 3) = 0, toUInt32(2), toInt32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt32(1), (number % 3) = 0, toInt8(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt32(1), (number % 3) = 0, toInt64(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt32(1), (number % 3) = 0, toUInt32(2), toUInt32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt64(1), (number % 3) = 0, toInt16(2), toInt16(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toInt64(1), (number % 3) = 0, toUInt16(2), toInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt8(1), (number % 3) = 0, toInt16(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt8(1), (number % 3) = 0, toUInt8(2), toUInt32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt8(1), (number % 3) = 0, toUInt64(2), toUInt64(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt16(1), (number % 3) = 0, toInt16(2), toInt16(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt16(1), (number % 3) = 0, toUInt8(2), toInt64(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt16(1), (number % 3) = 0, toUInt64(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt32(1), (number % 3) = 0, toInt8(2), toFloat32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt32(1), (number % 3) = 0, toUInt8(2), toInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt32(1), (number % 3) = 0, toUInt32(2), toUInt64(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toUInt64(1), (number % 3) = 0, toUInt16(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toFloat32(1), (number % 3) = 0, toInt16(2), toFloat64(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toFloat32(1), (number % 3) = 0, toUInt32(2), toInt32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toFloat64(1), (number % 3) = 0, toInt8(2), toUInt32(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toFloat64(1), (number % 3) = 0, toUInt16(2), toInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, toFloat64(1), (number % 3) = 0, toFloat64(2), toUInt8(3)) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt8(1), toInt8(2)], (number % 3) = 0, [toInt32(2), toInt32(3)], [toInt64(3), toInt64(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt8(1), toInt8(2)], (number % 3) = 0, [toUInt16(2), toUInt16(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt8(1), toInt8(2)], (number % 3) = 0, [toFloat64(2), toFloat64(3)], [toFloat32(3), toFloat32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt16(1), toInt16(2)], (number % 3) = 0, [toInt32(2), toInt32(3)], [toFloat32(3), toFloat32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt16(1), toInt16(2)], (number % 3) = 0, [toUInt32(2), toUInt32(3)], [toInt8(3), toInt8(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt32(1), toInt32(2)], (number % 3) = 0, [toInt8(2), toInt8(3)], [toInt32(3), toInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt32(1), toInt32(2)], (number % 3) = 0, [toInt64(2), toInt64(3)], [toInt32(3), toInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt32(1), toInt32(2)], (number % 3) = 0, [toUInt32(2), toUInt32(3)], [toUInt8(3), toUInt8(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt64(1), toInt64(2)], (number % 3) = 0, [toInt8(2), toInt8(3)], [toUInt32(3), toUInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toInt64(1), toInt64(2)], (number % 3) = 0, [toUInt8(2), toUInt8(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt8(1), toUInt8(2)], (number % 3) = 0, [toInt16(2), toInt16(3)], [toInt32(3), toInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt8(1), toUInt8(2)], (number % 3) = 0, [toUInt8(2), toUInt8(3)], [toUInt8(3), toUInt8(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt8(1), toUInt8(2)], (number % 3) = 0, [toUInt64(2), toUInt64(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt16(1), toUInt16(2)], (number % 3) = 0, [toInt8(2), toInt8(3)], [toFloat64(3), toFloat64(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt16(1), toUInt16(2)], (number % 3) = 0, [toUInt8(2), toUInt8(3)], [toInt16(3), toInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt16(1), toUInt16(2)], (number % 3) = 0, [toUInt32(2), toUInt32(3)], [toFloat32(3), toFloat32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt32(1), toUInt32(2)], (number % 3) = 0, [toInt8(2), toInt8(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt32(1), toUInt32(2)], (number % 3) = 0, [toInt64(2), toInt64(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt32(1), toUInt32(2)], (number % 3) = 0, [toUInt32(2), toUInt32(3)], [toUInt16(3), toUInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toUInt64(1), toUInt64(2)], (number % 3) = 0, [toUInt8(2), toUInt8(3)], [toUInt32(3), toUInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toFloat32(1), toFloat32(2)], (number % 3) = 0, [toInt16(2), toInt16(3)], [toUInt32(3), toUInt32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toFloat32(1), toFloat32(2)], (number % 3) = 0, [toUInt32(2), toUInt32(3)], [toInt8(3), toInt8(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toFloat64(1), toFloat64(2)], (number % 3) = 0, [toInt8(2), toInt8(3)], [toUInt8(3), toUInt8(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toFloat64(1), toFloat64(2)], (number % 3) = 0, [toUInt8(2), toUInt8(3)], [toFloat32(3), toFloat32(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((number % 2) = 0, [toFloat64(1), toFloat64(2)], (number % 3) = 0, [toFloat64(2), toFloat64(3)], [toInt16(3), toInt16(3)]) FROM system.numbers LIMIT 10;

SELECT multiIf((col1 % 2) = 0, col2, (col1 % 3) = 0, toFixedString(col3, 16), 'baz') FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, toFixedString(col2, 16), (col1 % 3) = 0, col3, toFixedString('baz', 16)) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, toFixedString(col2, 16), 1, 'bar', toFixedString(col4, 16)) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, toFixedString('foo', 16), 1, toFixedString('bar', 16), col4) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, 'foo', 1, col3, 'baz') FROM multi_if_check;

SELECT multiIf(1, col2, (col1 % 3) = 0, 'bar', toFixedString('baz', 16)) FROM multi_if_check;

SELECT multiIf(1, toFixedString(col2, 16), (col1 % 3) = 0, toFixedString('bar', 16), toFixedString(col4, 16)) FROM multi_if_check;

SELECT multiIf(1, toFixedString('foo', 16), (col1 % 3) = 0, toFixedString(col3, 16), col4) FROM multi_if_check;

SELECT multiIf(1, toFixedString('foo', 16), 1, 'bar', 'baz') FROM multi_if_check;

SELECT multiIf(1, 'foo', 1, toFixedString('bar', 16), toFixedString('baz', 16)) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, [col2, col3], (col1 % 3) = 0, ['foo', col5], [col6, 'bar']) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, [col2, 'bar'], (col1 % 3) = 0, [col4, 'bar'], [col6, col7]) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, [col2, 'bar'], 1, ['foo', 'bar'], ['foo', 'bar']) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, ['foo', col3], 1, ['foo', col5], ['foo', col7]) FROM multi_if_check;

SELECT multiIf((col1 % 2) = 0, ['foo', 'bar'], 1, [col4, 'bar'], [col6, 'bar']) FROM multi_if_check;

SELECT multiIf(1, [col2, col3], 1, [col4, col5], [col6, col7]) FROM multi_if_check;

SELECT multiIf(1, [col2, 'bar'], (col1 % 3) = 0, ['foo', col5], ['foo', 'bar']) FROM multi_if_check;

SELECT multiIf(1, ['foo', col3], (col1 % 3) = 0, [col4, 'bar'], ['foo', col7]) FROM multi_if_check;

SELECT multiIf(1, ['foo', 'bar'], (col1 % 3) = 0, [col4, col5], [col6, 'bar']) FROM multi_if_check;

SELECT multiIf(1, ['foo', 'bar'], 1, ['foo', 'bar'], [col6, col7]) FROM multi_if_check;

SELECT multiIf(2 > 1, 'Value', 'ElseValue') as a, isConstant(a) FROM multi_if_check;

SELECT CASE WHEN (number % 2) = 0 THEN toInt8(1) WHEN (number % 3) = 0 THEN toInt8(2) ELSE toInt64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt8(1) WHEN (number % 3) = 0 THEN toInt64(2) ELSE toInt64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt8(1) WHEN (number % 3) = 0 THEN toUInt32(2) ELSE toUInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt16(1) WHEN (number % 3) = 0 THEN toInt8(2) ELSE toFloat32(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt16(1) WHEN (number % 3) = 0 THEN toUInt8(2) ELSE toInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt16(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt32(1) WHEN (number % 3) = 0 THEN toInt16(2) ELSE toInt32(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt32(1) WHEN (number % 3) = 0 THEN toUInt8(2) ELSE toUInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt32(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toUInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt64(1) WHEN (number % 3) = 0 THEN toInt32(2) ELSE toInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toInt64(1) WHEN (number % 3) = 0 THEN toUInt32(2) ELSE toInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt8(1) WHEN (number % 3) = 0 THEN toInt32(2) ELSE toInt32(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt8(1) WHEN (number % 3) = 0 THEN toUInt16(2) ELSE toInt64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt8(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toFloat32(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt16(1) WHEN (number % 3) = 0 THEN toInt16(2) ELSE toFloat64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt16(1) WHEN (number % 3) = 0 THEN toUInt16(2) ELSE toInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt16(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toUInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt32(1) WHEN (number % 3) = 0 THEN toInt16(2) ELSE toUInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt32(1) WHEN (number % 3) = 0 THEN toUInt8(2) ELSE toUInt64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt32(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toInt8(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toUInt64(1) WHEN (number % 3) = 0 THEN toUInt32(2) ELSE toUInt64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toFloat32(1) WHEN (number % 3) = 0 THEN toInt32(2) ELSE toFloat32(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toFloat32(1) WHEN (number % 3) = 0 THEN toFloat32(2) ELSE toInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toFloat64(1) WHEN (number % 3) = 0 THEN toInt16(2) ELSE toUInt16(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN toFloat64(1) WHEN (number % 3) = 0 THEN toUInt16(2) ELSE toFloat64(3) END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt8(1), toInt8(2)] WHEN (number % 3) = 0 THEN [toInt8(2), toInt8(3)] ELSE [toInt32(3), toInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt8(1), toInt8(2)] WHEN (number % 3) = 0 THEN [toInt64(2), toInt64(3)] ELSE [toInt32(3), toInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt8(1), toInt8(2)] WHEN (number % 3) = 0 THEN [toUInt32(2), toUInt32(3)] ELSE [toUInt8(3), toUInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt16(1), toInt16(2)] WHEN (number % 3) = 0 THEN [toInt8(2), toInt8(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt16(1), toInt16(2)] WHEN (number % 3) = 0 THEN [toInt64(2), toInt64(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt16(1), toInt16(2)] WHEN (number % 3) = 0 THEN [toUInt32(2), toUInt32(3)] ELSE [toFloat64(3), toFloat64(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt32(1), toInt32(2)] WHEN (number % 3) = 0 THEN [toInt16(2), toInt16(3)] ELSE [toInt16(3), toInt16(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt32(1), toInt32(2)] WHEN (number % 3) = 0 THEN [toUInt8(2), toUInt8(3)] ELSE [toInt64(3), toInt64(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt32(1), toInt32(2)] WHEN (number % 3) = 0 THEN [toFloat32(2), toFloat32(3)] ELSE [toUInt8(3), toUInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt64(1), toInt64(2)] WHEN (number % 3) = 0 THEN [toInt32(2), toInt32(3)] ELSE [toInt8(3), toInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toInt64(1), toInt64(2)] WHEN (number % 3) = 0 THEN [toUInt16(2), toUInt16(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt8(1), toUInt8(2)] WHEN (number % 3) = 0 THEN [toInt32(2), toInt32(3)] ELSE [toInt16(3), toInt16(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt8(1), toUInt8(2)] WHEN (number % 3) = 0 THEN [toUInt16(2), toUInt16(3)] ELSE [toInt32(3), toInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt8(1), toUInt8(2)] WHEN (number % 3) = 0 THEN [toFloat32(2), toFloat32(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt16(1), toUInt16(2)] WHEN (number % 3) = 0 THEN [toInt16(2), toInt16(3)] ELSE [toFloat32(3), toFloat32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt16(1), toUInt16(2)] WHEN (number % 3) = 0 THEN [toUInt8(2), toUInt8(3)] ELSE [toFloat64(3), toFloat64(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt16(1), toUInt16(2)] WHEN (number % 3) = 0 THEN [toFloat32(2), toFloat32(3)] ELSE [toInt32(3), toInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt32(1), toUInt32(2)] WHEN (number % 3) = 0 THEN [toInt16(2), toInt16(3)] ELSE [toUInt8(3), toUInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt32(1), toUInt32(2)] WHEN (number % 3) = 0 THEN [toUInt8(2), toUInt8(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt32(1), toUInt32(2)] WHEN (number % 3) = 0 THEN [toUInt64(2), toUInt64(3)] ELSE [toUInt64(3), toUInt64(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toUInt64(1), toUInt64(2)] WHEN (number % 3) = 0 THEN [toUInt32(2), toUInt32(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toFloat32(1), toFloat32(2)] WHEN (number % 3) = 0 THEN [toInt32(2), toInt32(3)] ELSE [toUInt32(3), toUInt32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toFloat32(1), toFloat32(2)] WHEN (number % 3) = 0 THEN [toFloat32(2), toFloat32(3)] ELSE [toInt8(3), toInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toFloat64(1), toFloat64(2)] WHEN (number % 3) = 0 THEN [toInt16(2), toInt16(3)] ELSE [toUInt8(3), toUInt8(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (number % 2) = 0 THEN [toFloat64(1), toFloat64(2)] WHEN (number % 3) = 0 THEN [toUInt16(2), toUInt16(3)] ELSE [toFloat32(3), toFloat32(3)] END FROM system.numbers LIMIT 10;

SELECT CASE WHEN (col1 % 2) = 0 THEN col2 WHEN (col1 % 3) = 0 THEN col3 ELSE col4 END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN col2 WHEN 1 THEN toFixedString('bar', 16) ELSE 'baz' END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN toFixedString(col2, 16) WHEN 1 THEN toFixedString(col3, 16) ELSE toFixedString('baz', 16) END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN toFixedString('foo', 16) WHEN 1 THEN col3 ELSE toFixedString(col4, 16) END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN 'foo' WHEN (col1 % 3) = 0 THEN 'bar' ELSE col4 END FROM multi_if_check;

SELECT CASE WHEN 1 THEN col2 WHEN (col1 % 3) = 0 THEN toFixedString(col3, 16) ELSE 'baz' END FROM multi_if_check;

SELECT CASE WHEN 1 THEN toFixedString(col2, 16) WHEN (col1 % 3) = 0 THEN col3 ELSE toFixedString('baz', 16) END FROM multi_if_check;

SELECT CASE WHEN 1 THEN toFixedString(col2, 16) WHEN 1 THEN 'bar' ELSE toFixedString(col4, 16) END FROM multi_if_check;

SELECT CASE WHEN 1 THEN toFixedString('foo', 16) WHEN 1 THEN toFixedString('bar', 16) ELSE col4 END FROM multi_if_check;

SELECT CASE WHEN 1 THEN 'foo' WHEN 1 THEN col3 ELSE 'baz' END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN [col2, col3] WHEN (col1 % 3) = 0 THEN ['foo', 'bar'] ELSE [col6, 'bar'] END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN [col2, 'bar'] WHEN (col1 % 3) = 0 THEN ['foo', col5] ELSE [col6, col7] END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN ['foo', col3] WHEN (col1 % 3) = 0 THEN [col4, col5] ELSE ['foo', 'bar'] END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN ['foo', col3] WHEN 1 THEN ['foo', 'bar'] ELSE ['foo', col7] END FROM multi_if_check;

SELECT CASE WHEN (col1 % 2) = 0 THEN ['foo', 'bar'] WHEN 1 THEN ['foo', col5] ELSE [col6, 'bar'] END FROM multi_if_check;

SELECT CASE WHEN 1 THEN [col2, col3] WHEN 1 THEN [col4, 'bar'] ELSE [col6, col7] END FROM multi_if_check;

SELECT CASE WHEN 1 THEN [col2, 'bar'] WHEN (col1 % 3) = 0 THEN ['foo', 'bar'] ELSE ['foo', 'bar'] END FROM multi_if_check;

SELECT CASE WHEN 1 THEN ['foo', col3] WHEN (col1 % 3) = 0 THEN ['foo', col5] ELSE ['foo', col7] END FROM multi_if_check;

SELECT CASE WHEN 1 THEN ['foo', 'bar'] WHEN (col1 % 3) = 0 THEN [col4, 'bar'] ELSE [col6, 'bar'] END FROM multi_if_check;

/* CASE expression. Numeric clauses. */

CREATE TABLE multi_if_check(col1 UInt64) ENGINE=TinyLog;

SELECT info FROM (SELECT 1 AS info);

SET min_insert_block_size_rows = 100;

SELECT ([[['a'], ['b', 'c']], [['d', 'e', 'f'], ['g', 'h', 'i', 'j'], ['k', 'l', 'm', 'n', 'o']], [['p', 'q', 'r', 's', 't', 'u'], ['v', 'w', 'x', 'y', 'z', 'aa', 'bb'], ['cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj'], ['kk', 'll', 'mm', 'nn', 'oo', 'pp', 'qq', 'rr', 'ss']]] AS arr)[number], arr[number][number], arr[number][number][number] FROM system.numbers LIMIT 10;

SELECT has([(a, b), (c, d)], (c, d)) FROM (SELECT materialize(1) AS a, 2 AS b, 3 AS c, 4 AS d);

select arrayMap(t->tuple(t.1, t.2*2), [(materialize('1'),materialize(2))]);

SELECT toUInt32OrZero('123a'), toUInt32OrZero('456');

ALTER TABLE prewhere_defaults ADD COLUMN y UInt16 DEFAULT x;

DROP TABLE IF EXISTS group_uniq_str;

SELECT '\xED\x20\xA8' AS s FORMAT JSONCompact;

SELECT cityHash64(groupArraySorted(100)(x)) FROM enum_pk WHERE (-(x != toString(0)) = -1) > 0;

SELECT 'Hello' || ', ' || 'World';

SELECT 0 as nelems, [NULL,9,4,8,10,5,2,3,7,1,6] AS arr, arrayPartialSort(nelems, arr), arrayPartialReverseSort(nelems, arr), arrayPartialSort((x) -> -x, nelems, arr);

SELECT (1 as a) ? (number + 2 as b) : (number + 3 as c) as d, a, b, c, d FROM system.numbers LIMIT 1 FORMAT TSKV;

SELECT '----- MergeTree engine -----';

SELECT col1, col2, col1 + col2, col1 * 7 FROM test1_00395 ORDER BY col1,col2 ASC;

SELECT '----- case when -----';

SELECT '----- arrayElement -----';

SELECT '----- has -----';

SELECT has(col1, 'ghij') FROM test1_00395;

DROP TABLE test2;

SELECT arrayJoin([1, 2, 3]) AS arr, 'hello' AS s1, 'world' AS s2 FORMAT TSVRaw;

CREATE TABLE stripe2 ENGINE = StripeLog AS SELECT number AS x FROM system.numbers LIMIT 10;

SHOW SETTING output_format_pretty_color;

SELECT dummy FROM remote('127.0.0.{2,3}', system.one) LIMIT 2 BY dummy;

SELECT '0', '-4503599627370496.000000000', 0 = -4503599627370496.000000000, 0 != -4503599627370496.000000000, 0 < -4503599627370496.000000000, 0 <= -4503599627370496.000000000, 0 > -4503599627370496.000000000, 0 >= -4503599627370496.000000000,	-4503599627370496.000000000 = 0, -4503599627370496.000000000 != 0, -4503599627370496.000000000 < 0, -4503599627370496.000000000 <= 0, -4503599627370496.000000000 > 0, -4503599627370496.000000000 >= 0 , toUInt8(0) = -4503599627370496.000000000, toUInt8(0) != -4503599627370496.000000000, toUInt8(0) < -4503599627370496.000000000, toUInt8(0) <= -4503599627370496.000000000, toUInt8(0) > -4503599627370496.000000000, toUInt8(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toUInt8(0), -4503599627370496.000000000 != toUInt8(0), -4503599627370496.000000000 < toUInt8(0), -4503599627370496.000000000 <= toUInt8(0), -4503599627370496.000000000 > toUInt8(0), -4503599627370496.000000000 >= toUInt8(0) , toInt8(0) = -4503599627370496.000000000, toInt8(0) != -4503599627370496.000000000, toInt8(0) < -4503599627370496.000000000, toInt8(0) <= -4503599627370496.000000000, toInt8(0) > -4503599627370496.000000000, toInt8(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toInt8(0), -4503599627370496.000000000 != toInt8(0), -4503599627370496.000000000 < toInt8(0), -4503599627370496.000000000 <= toInt8(0), -4503599627370496.000000000 > toInt8(0), -4503599627370496.000000000 >= toInt8(0) , toUInt16(0) = -4503599627370496.000000000, toUInt16(0) != -4503599627370496.000000000, toUInt16(0) < -4503599627370496.000000000, toUInt16(0) <= -4503599627370496.000000000, toUInt16(0) > -4503599627370496.000000000, toUInt16(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toUInt16(0), -4503599627370496.000000000 != toUInt16(0), -4503599627370496.000000000 < toUInt16(0), -4503599627370496.000000000 <= toUInt16(0), -4503599627370496.000000000 > toUInt16(0), -4503599627370496.000000000 >= toUInt16(0) , toInt16(0) = -4503599627370496.000000000, toInt16(0) != -4503599627370496.000000000, toInt16(0) < -4503599627370496.000000000, toInt16(0) <= -4503599627370496.000000000, toInt16(0) > -4503599627370496.000000000, toInt16(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toInt16(0), -4503599627370496.000000000 != toInt16(0), -4503599627370496.000000000 < toInt16(0), -4503599627370496.000000000 <= toInt16(0), -4503599627370496.000000000 > toInt16(0), -4503599627370496.000000000 >= toInt16(0) , toUInt32(0) = -4503599627370496.000000000, toUInt32(0) != -4503599627370496.000000000, toUInt32(0) < -4503599627370496.000000000, toUInt32(0) <= -4503599627370496.000000000, toUInt32(0) > -4503599627370496.000000000, toUInt32(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toUInt32(0), -4503599627370496.000000000 != toUInt32(0), -4503599627370496.000000000 < toUInt32(0), -4503599627370496.000000000 <= toUInt32(0), -4503599627370496.000000000 > toUInt32(0), -4503599627370496.000000000 >= toUInt32(0) , toInt32(0) = -4503599627370496.000000000, toInt32(0) != -4503599627370496.000000000, toInt32(0) < -4503599627370496.000000000, toInt32(0) <= -4503599627370496.000000000, toInt32(0) > -4503599627370496.000000000, toInt32(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toInt32(0), -4503599627370496.000000000 != toInt32(0), -4503599627370496.000000000 < toInt32(0), -4503599627370496.000000000 <= toInt32(0), -4503599627370496.000000000 > toInt32(0), -4503599627370496.000000000 >= toInt32(0) , toUInt64(0) = -4503599627370496.000000000, toUInt64(0) != -4503599627370496.000000000, toUInt64(0) < -4503599627370496.000000000, toUInt64(0) <= -4503599627370496.000000000, toUInt64(0) > -4503599627370496.000000000, toUInt64(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toUInt64(0), -4503599627370496.000000000 != toUInt64(0), -4503599627370496.000000000 < toUInt64(0), -4503599627370496.000000000 <= toUInt64(0), -4503599627370496.000000000 > toUInt64(0), -4503599627370496.000000000 >= toUInt64(0) , toInt64(0) = -4503599627370496.000000000, toInt64(0) != -4503599627370496.000000000, toInt64(0) < -4503599627370496.000000000, toInt64(0) <= -4503599627370496.000000000, toInt64(0) > -4503599627370496.000000000, toInt64(0) >= -4503599627370496.000000000,	-4503599627370496.000000000 = toInt64(0), -4503599627370496.000000000 != toInt64(0), -4503599627370496.000000000 < toInt64(0), -4503599627370496.000000000 <= toInt64(0), -4503599627370496.000000000 > toInt64(0), -4503599627370496.000000000 >= toInt64(0);

SELECT '-1', '-0.500000000', -1 = -0.500000000, -1 != -0.500000000, -1 < -0.500000000, -1 <= -0.500000000, -1 > -0.500000000, -1 >= -0.500000000,	-0.500000000 = -1, -0.500000000 != -1, -0.500000000 < -1, -0.500000000 <= -1, -0.500000000 > -1, -0.500000000 >= -1 , toInt8(-1) = -0.500000000, toInt8(-1) != -0.500000000, toInt8(-1) < -0.500000000, toInt8(-1) <= -0.500000000, toInt8(-1) > -0.500000000, toInt8(-1) >= -0.500000000,	-0.500000000 = toInt8(-1), -0.500000000 != toInt8(-1), -0.500000000 < toInt8(-1), -0.500000000 <= toInt8(-1), -0.500000000 > toInt8(-1), -0.500000000 >= toInt8(-1) , toInt16(-1) = -0.500000000, toInt16(-1) != -0.500000000, toInt16(-1) < -0.500000000, toInt16(-1) <= -0.500000000, toInt16(-1) > -0.500000000, toInt16(-1) >= -0.500000000,	-0.500000000 = toInt16(-1), -0.500000000 != toInt16(-1), -0.500000000 < toInt16(-1), -0.500000000 <= toInt16(-1), -0.500000000 > toInt16(-1), -0.500000000 >= toInt16(-1) , toInt32(-1) = -0.500000000, toInt32(-1) != -0.500000000, toInt32(-1) < -0.500000000, toInt32(-1) <= -0.500000000, toInt32(-1) > -0.500000000, toInt32(-1) >= -0.500000000,	-0.500000000 = toInt32(-1), -0.500000000 != toInt32(-1), -0.500000000 < toInt32(-1), -0.500000000 <= toInt32(-1), -0.500000000 > toInt32(-1), -0.500000000 >= toInt32(-1) , toInt64(-1) = -0.500000000, toInt64(-1) != -0.500000000, toInt64(-1) < -0.500000000, toInt64(-1) <= -0.500000000, toInt64(-1) > -0.500000000, toInt64(-1) >= -0.500000000,	-0.500000000 = toInt64(-1), -0.500000000 != toInt64(-1), -0.500000000 < toInt64(-1), -0.500000000 <= toInt64(-1), -0.500000000 > toInt64(-1), -0.500000000 >= toInt64(-1);

SELECT '1', '0.500000000', 1 = 0.500000000, 1 != 0.500000000, 1 < 0.500000000, 1 <= 0.500000000, 1 > 0.500000000, 1 >= 0.500000000,	0.500000000 = 1, 0.500000000 != 1, 0.500000000 < 1, 0.500000000 <= 1, 0.500000000 > 1, 0.500000000 >= 1 , toUInt8(1) = 0.500000000, toUInt8(1) != 0.500000000, toUInt8(1) < 0.500000000, toUInt8(1) <= 0.500000000, toUInt8(1) > 0.500000000, toUInt8(1) >= 0.500000000,	0.500000000 = toUInt8(1), 0.500000000 != toUInt8(1), 0.500000000 < toUInt8(1), 0.500000000 <= toUInt8(1), 0.500000000 > toUInt8(1), 0.500000000 >= toUInt8(1) , toInt8(1) = 0.500000000, toInt8(1) != 0.500000000, toInt8(1) < 0.500000000, toInt8(1) <= 0.500000000, toInt8(1) > 0.500000000, toInt8(1) >= 0.500000000,	0.500000000 = toInt8(1), 0.500000000 != toInt8(1), 0.500000000 < toInt8(1), 0.500000000 <= toInt8(1), 0.500000000 > toInt8(1), 0.500000000 >= toInt8(1) , toUInt16(1) = 0.500000000, toUInt16(1) != 0.500000000, toUInt16(1) < 0.500000000, toUInt16(1) <= 0.500000000, toUInt16(1) > 0.500000000, toUInt16(1) >= 0.500000000,	0.500000000 = toUInt16(1), 0.500000000 != toUInt16(1), 0.500000000 < toUInt16(1), 0.500000000 <= toUInt16(1), 0.500000000 > toUInt16(1), 0.500000000 >= toUInt16(1) , toInt16(1) = 0.500000000, toInt16(1) != 0.500000000, toInt16(1) < 0.500000000, toInt16(1) <= 0.500000000, toInt16(1) > 0.500000000, toInt16(1) >= 0.500000000,	0.500000000 = toInt16(1), 0.500000000 != toInt16(1), 0.500000000 < toInt16(1), 0.500000000 <= toInt16(1), 0.500000000 > toInt16(1), 0.500000000 >= toInt16(1) , toUInt32(1) = 0.500000000, toUInt32(1) != 0.500000000, toUInt32(1) < 0.500000000, toUInt32(1) <= 0.500000000, toUInt32(1) > 0.500000000, toUInt32(1) >= 0.500000000,	0.500000000 = toUInt32(1), 0.500000000 != toUInt32(1), 0.500000000 < toUInt32(1), 0.500000000 <= toUInt32(1), 0.500000000 > toUInt32(1), 0.500000000 >= toUInt32(1) , toInt32(1) = 0.500000000, toInt32(1) != 0.500000000, toInt32(1) < 0.500000000, toInt32(1) <= 0.500000000, toInt32(1) > 0.500000000, toInt32(1) >= 0.500000000,	0.500000000 = toInt32(1), 0.500000000 != toInt32(1), 0.500000000 < toInt32(1), 0.500000000 <= toInt32(1), 0.500000000 > toInt32(1), 0.500000000 >= toInt32(1) , toUInt64(1) = 0.500000000, toUInt64(1) != 0.500000000, toUInt64(1) < 0.500000000, toUInt64(1) <= 0.500000000, toUInt64(1) > 0.500000000, toUInt64(1) >= 0.500000000,	0.500000000 = toUInt64(1), 0.500000000 != toUInt64(1), 0.500000000 < toUInt64(1), 0.500000000 <= toUInt64(1), 0.500000000 > toUInt64(1), 0.500000000 >= toUInt64(1) , toInt64(1) = 0.500000000, toInt64(1) != 0.500000000, toInt64(1) < 0.500000000, toInt64(1) <= 0.500000000, toInt64(1) > 0.500000000, toInt64(1) >= 0.500000000,	0.500000000 = toInt64(1), 0.500000000 != toInt64(1), 0.500000000 < toInt64(1), 0.500000000 <= toInt64(1), 0.500000000 > toInt64(1), 0.500000000 >= toInt64(1);

SELECT '18446744073709551615', '-1.500000000', 18446744073709551615 = -1.500000000, 18446744073709551615 != -1.500000000, 18446744073709551615 < -1.500000000, 18446744073709551615 <= -1.500000000, 18446744073709551615 > -1.500000000, 18446744073709551615 >= -1.500000000,	-1.500000000 = 18446744073709551615, -1.500000000 != 18446744073709551615, -1.500000000 < 18446744073709551615, -1.500000000 <= 18446744073709551615, -1.500000000 > 18446744073709551615, -1.500000000 >= 18446744073709551615 , toUInt64(18446744073709551615) = -1.500000000, toUInt64(18446744073709551615) != -1.500000000, toUInt64(18446744073709551615) < -1.500000000, toUInt64(18446744073709551615) <= -1.500000000, toUInt64(18446744073709551615) > -1.500000000, toUInt64(18446744073709551615) >= -1.500000000,	-1.500000000 = toUInt64(18446744073709551615), -1.500000000 != toUInt64(18446744073709551615), -1.500000000 < toUInt64(18446744073709551615), -1.500000000 <= toUInt64(18446744073709551615), -1.500000000 > toUInt64(18446744073709551615), -1.500000000 >= toUInt64(18446744073709551615);

INSERT INTO distinct (Num, Name) VALUES (3, 'Mary');

ATTACH TABLE log;

/* Condition could be:
 * - constant, true
 * - constant, false
 * - constant, NULL
 * - non constant, non nullable_00431
 * - non constant, nullable_00431
 *
 * Then and else could be:
 * - constant, not NULL
 * - constant, NULL
 * - non constant, non nullable_00431
 * - non constant, nullable_00431
 *
 * Thus we have 5 * 4 * 4 = 80 combinations.
 */

DROP TABLE IF EXISTS nullable_00431;

SELECT constant_false ? constant_null : else_non_constant_nullable AS res FROM nullable_00431;

SELECT cond_non_constant ? then_constant : else_constant AS res FROM nullable_00431;

SELECT cond_non_constant_nullable ? then_non_constant : else_non_constant AS res FROM nullable_00431;

SELECT ifNull(toNullable('x'), 'y') AS res, toTypeName(res);

SELECT x FROM (SELECT number % 5 = 0 ? NULL : (number % 3 = 0 ? nan : toFloat64(number)) AS x FROM system.numbers LIMIT 10) ORDER BY x DESC NULLS LAST;

SELECT (nullIf(number, 2), -number) IN ((1, -1), (2, -2), (3, -3)) FROM system.numbers LIMIT 5;

SELECT k, a, b
FROM
(
    SELECT nullIf(number, 7) AS k, toString(number) AS a FROM system.numbers LIMIT 10
) js1
ANY INNER JOIN
(
    SELECT number AS k, toString(number) AS b FROM system.numbers LIMIT 5, 10
) js2 USING (k) ORDER BY k;

SELECT 'all';

SELECT k, groupArrayForEach(arr) FROM (SELECT number % 3 AS k, range(number) AS arr FROM system.numbers LIMIT 10) GROUP BY k ORDER BY k;

CREATE TABLE cast_enums
(
    type Enum8('session' = 1, 'pageview' = 2, 'click' = 3),
    date Date,
    id UInt64
) ENGINE = MergeTree(date, (type, date, id), 8192);

SELECT ' UInt32 | UInt64 ';

CREATE TABLE u64 (x UInt64) ENGINE = Memory;

CREATE TABLE merge_one_two (x String) ENGINE = Merge(currentDatabase(), '^one_00458$|^two_00458$');

-- A declared length of zero leaves the state unbounded.
SELECT finalizeAggregation(materialize(CAST(unhex('04000000000000000000000100000000000000000200000000000000000300000000000000')
    AS AggregateFunction(groupArrayInsertAt(0, 0), UInt64, UInt64))));

SELECT t.* FROM system.one AS t;

SELECT 1 FROM nested ARRAY JOIN nest.x AS nx, nest.y AS ny WHERE notEmpty(nest.y);

SELECT toUUID('61f0c404-5cb3-11e7-907b-a6006ad3dba0') = '61f0c404-5cb3-11e7-907b-a6006ad3dba1';

SELECT '61f0c404-5cb3-11e7-907b-a6006ad3dba0'         >= toUUID('61f0c404-5cb3-11e7-907b-a6006ad3dba0');

SELECT toYYYYMMDD(toDate('2017-07-21'));

SELECT 5 FROM system.one WHERE (1, 1) IN (SELECT 1 AS x, x) OR (1, 0) IN (SELECT 1 AS x, toUInt8(x - 1));

create table tab_00484 (date Date, x UInt64, s String) engine = MergeTree PARTITION BY date ORDER BY (date, x) SETTINGS min_bytes_for_wide_part = 0, ratio_of_defaults_for_sparse_serialization = 1;

CREATE TABLE primary
(
    `primary` String
)
ENGINE = MergeTree
ORDER BY primary
settings min_bytes_for_wide_part=0,min_bytes_for_wide_part=0
 AS
SELECT *
FROM numbers(1000);

with 'string' as str select str || '_abc';

select arrayConcat([Null], emptyArrayUInt8());

select arraySlice([1, 2, 3, 4, 5, 6], 10, 1);

select arrayPopBack([1, 2, 3]);

select 'arraySlice(arr1, 2, nl)';

select arr1, arrayPushFront(arr1, nl) from array_functions;

select arr1, arrayPushFront(arr1, '1') from array_functions;

SELECT 'inner';

SELECT pointInPolygon((2.5, 2.5), [(4., 0.), (8., 4.), (4., 8.), (0., 4.)], [(3., 3.), (3., 5.), (5., 5.), (5., 3.)]);

SELECT pointInPolygon((5.5, 1.5), [[[(0., 0.), (7., 0.), (7., 3.), (0., 3.)], [(1., 1.), (2., 1.), (2., 2.), (1., 2.)], [(3., 1.), (4., 1.), (4., 2.), (3., 2.)], [(5., 1.), (6., 1.), (6., 2.), (5., 2.)]]]);

SELECT pointInPolygon((106.6671509, 10.7674952), [(106.667161868227, 10.7674952), (106.667165727127, 10.7675059912261), (106.667170817563, 10.7674904752629), (106.667229225265, 10.7672278502066), (106.667231193621, 10.7672115129572), (106.667229912029, 10.7671951075415), (106.667225430503, 10.767179274157), (106.667217923927, 10.7671646306786), (106.667207685234, 10.7671517485471), (106.667195113975, 10.7671411304688), (106.667180700725, 10.7671331907989), (106.66716500794, 10.7671282393715), (106.666628232995, 10.7670156787539), (106.666612233649, 10.7670139127584), (106.666596193354, 10.7670152569112), (106.666580711053, 10.7670196610218), (106.666566364856, 10.7670269606408), (106.666553690448, 10.7670368832008), (106.666543161092, 10.767049058194), (106.666535169952, 10.7670630310067), (106.666530015418, 10.7670782798948), (106.666482284259, 10.7672828714379), (106.666480170141, 10.7672985245675), (106.666481048788, 10.7673142953614), (106.666484888609, 10.7673296167758), (106.666491551541, 10.7673439379244), (106.666500798017, 10.7673567438858), (106.666512295576, 10.7673675742178), (106.666525630821, 10.7673760395122), (106.667032331859, 10.7676338521733), (106.6671413386, 10.7676893154858), (106.667371048786, 10.7678061934666), (106.667552760053, 10.7678987010209), (106.667801848625, 10.7680278028917), (106.667817742281, 10.7680340673957), (106.667834579682, 10.7680369577679), (106.66785165264, 10.7680363524383), (106.667868243061, 10.7680322768672), (106.667878683314, 10.7680285412847), (106.667885469819, 10.7680268413536), (106.667892390269, 10.7680258148018), (106.667899378015, 10.7680254715159), (106.667906365761, 10.7680258148018), (106.667913286211, 10.7680268413536), (106.667920072716, 10.7680285412847), (106.667926659921, 10.7680308982244), (106.667932984386, 10.7680338894736), (106.667938985204, 10.7680374862253), (106.667944604583, 10.7680416538412), (106.667949788405, 10.7680463521828), (106.667954486747, 10.7680515360051), (106.667958654362, 10.7680571553826), (106.667962251113, 10.7680631561994), (106.667965242363, 10.7680694806664), (106.667967599303, 10.7680760678724), (106.667969299234, 10.7680828543774), (106.667970926246, 10.7680938227996), (106.667974657027, 10.7681089916695), (106.667981154238, 10.7681231972879), (106.667990189396, 10.7681359400994), (106.668001444773, 10.7681467719897), (106.668014524559, 10.7681553120441), (106.668198488147, 10.7682521458591), (106.669562015793, 10.7689901124345), (106.669614757162, 10.7690820717448), (106.669623023723, 10.7690939566151), (106.669633223154, 10.7691042307472), (106.669645047385, 10.7691125838155), (106.670748051536, 10.7697559307954), (106.670751419717, 10.7697577924329), (106.671035494073, 10.7699063431327), (106.671270162713, 10.7700364834325), (106.67127192876, 10.7700374352053), (106.671437929267, 10.7701243344783), (106.671665917937, 10.7702517637461), (106.67166656035, 10.7702521191025), (106.671943689514, 10.7704038245574), (106.671943806749, 10.7704038886117), (106.6722776446, 10.7705859421916), (106.672278295949, 10.7705862936499), (106.673020324076, 10.7709824352208), (106.673433726727, 10.7712057751884), (106.673694081332, 10.7713489702214), (106.673977066657, 10.7715146655761), (106.674254247937, 10.7716778144336), (106.67440928634, 10.7717698954974), (106.674658478275, 10.7719268836667), (106.674658802254, 10.7719270867325), (106.6748919449, 10.7720724734391), (106.675071660589, 10.7721853602936), (106.675350447469, 10.7723606751059), (106.675350748696, 10.7723608636368), (106.6756252856, 10.7725318758852), (106.675888735092, 10.7726957126602), (106.676114500069, 10.7728361211927), (106.676379504941, 10.7730007692002), (106.67661713771, 10.7731502653527), (106.676617572241, 10.773150536857), (106.676852995814, 10.7732966297465), (106.677284352687, 10.7735807849214), (106.677738143311, 10.7738851794554), (106.677752655777, 10.7738929549383), (106.677768414072, 10.773897724206), (106.677784802596, 10.7738993009456), (106.677801181124, 10.7738976235612), (106.677816909825, 10.7738927575805), (106.677831374252, 10.7738848930944), (106.677844009349, 10.7738743373313), (106.677920079221, 10.7737967983562), (106.678239245717, 10.7735243703649), (106.67839926068, 10.7733892116467), (106.678400691571, 10.7733879749217), (106.678515896101, 10.7732860955802), (106.678557979259, 10.7732504310319), (106.67855930664, 10.7732492818517), (106.679033975331, 10.7728295048433), (106.679053201911, 10.772844898411), (106.679632133733, 10.7733262832973), (106.679771732358, 10.7734524450384), (106.679773325229, 10.7734538481348), (106.680011463819, 10.7736582857586), (106.680175801881, 10.7738018862846), (106.680176891116, 10.7738028216402), (106.680320149367, 10.773923712053), (106.680672123374, 10.7742204563391), (106.68094213423, 10.7744504786771), (106.68094233625, 10.7744506502241), (106.68124725775, 10.7747087432576), (106.681247329066, 10.7747088035527), (106.681470746982, 10.7748974804345), (106.681471338135, 10.7748979749973), (106.681840030697, 10.7752035373868), (106.682304929691, 10.7756040772245), (106.682308650112, 10.7756071005185), (106.682312917236, 10.7756103687835), (106.682359764439, 10.7756490693986), (106.682640114944, 10.7758996628849), (106.682644070655, 10.7759029839554), (106.682711710544, 10.7759562859055), (106.682806505954, 10.7760368956153), (106.68280745353, 10.776037689352), (106.683169164535, 10.7763361378178), (106.68363265876, 10.7767252395911), (106.683677875719, 10.7767650291442), (106.683797775698, 10.77688614766), (106.684138558845, 10.7772306328105), (106.68414063031, 10.7772326552454), (106.684827531639, 10.777880369263), (106.685228619785, 10.7782605077038), (106.685228896163, 10.7782607684525), (106.686025996525, 10.7790093622583), (106.686026813787, 10.7790101368229), (106.68658269265, 10.7795369738106), (106.687194479537, 10.7801158277128), (106.688401155505, 10.7812670656457), (106.688401571342, 10.7812674596561), (106.689622367701, 10.7824162362891), (106.690002723257, 10.7827815572149), (106.690002908997, 10.7827817350625), (106.690359062158, 10.7831217027417), (106.690359638585, 10.7831222477508), (106.690747557266, 10.7834855403784), (106.691628272565, 10.7843952548301), (106.692179613338, 10.7849709155958), (106.692179802225, 10.7849711121697), (106.692743910048, 10.7855562574979), (106.693288875836, 10.7861225208133), (106.693601234729, 10.7864484801726), (106.69220838651, 10.7875617536129), (106.692196691453, 10.787573150248), (106.692187444486, 10.7875866094924), (106.692181000965, 10.7876016141149), (106.692177608512, 10.7876175874962), (106.692177397496, 10.7876339157883), (106.692180376026, 10.7876499715041), (106.692186429639, 10.7876651376314), (106.692195325699, 10.7876788313445), (106.692206722334, 10.7876905264015), (106.692220181578, 10.7876997733682), (106.692235186201, 10.7877062168886), (106.692251159582, 10.787709609342), (106.692267487874, 10.7877098203582), (106.69228354359, 10.7877068418281), (106.692298709717, 10.7877007882148), (106.69231240343, 10.7876918921553), (106.693776442708, 10.7865217172423), (106.693788736175, 10.7865096022178), (106.693798269005, 10.7864952137411), (106.693804631934, 10.7864791695437), (106.693807551784, 10.7864621584413), (106.693806903199, 10.7864449107613), (106.693802714026, 10.7864281669878), (106.693795164114, 10.786412645971), (106.693784577601, 10.7863990140651), (106.69340910087, 10.7860071886444), (106.69340897739, 10.7860070600637), (106.692863924954, 10.7854407067139), (106.69229983717, 10.7848555821281), (106.691748435669, 10.7842798579551), (106.691748124777, 10.7842795350934), (106.690865834778, 10.7833681940925), (106.690862927107, 10.7833653342196), (106.690473809086, 10.7830009183885), (106.690118035849, 10.7826613133679), (106.689737465891, 10.7822957865149), (106.689736848623, 10.7822951996834), (106.688515950726, 10.7811463275029), (106.687309357068, 10.7799951680976), (106.687309106711, 10.779994930232), (106.686697270266, 10.7794160294802), (106.686141416688, 10.7788892164565), (106.686140461741, 10.7788883114), (106.686140185762, 10.7788880510296), (106.6853430856, 10.7781394574112), (106.684942058447, 10.7777593767781), (106.684941904463, 10.7777592312084), (106.684255979358, 10.7771124377212), (106.683916204215, 10.776768971525), (106.683794256559, 10.7766457845149), (106.68379008676, 10.7766418525893), (106.683741989497, 10.7765995284558), (106.683740519326, 10.7765982647987), (106.683276011394, 10.7762083120217), (106.683275466929, 10.7762078588774), (106.68291395946, 10.77590957835), (106.682818451152, 10.775828362424), (106.682816046951, 10.7758263940715), (106.682749215964, 10.7757737295564), (106.682469581984, 10.775523776542), (106.682467121137, 10.7755216616573), (106.682417839663, 10.775480950083), (106.68241543796, 10.7754790393628), (106.682411856108, 10.7754762959601), (106.681948170223, 10.775076801292), (106.681946953215, 10.7750757728772), (106.681577943952, 10.7747699480145), (106.681354856141, 10.7745815499075), (106.681050071432, 10.7743235726569), (106.680779998801, 10.774093497693), (106.680779672798, 10.7740932214111), (106.680427578845, 10.7737963760106), (106.680284883706, 10.7736759607876), (106.680120811518, 10.7735325925854), (106.680120259999, 10.7735321149047), (106.679882649978, 10.7733281310479), (106.679742564868, 10.7732015296478), (106.67973997054, 10.7731992804165), (106.679159125009, 10.772716304271), (106.679157929246, 10.7727153285815), (106.679083371982, 10.7726556350576), (106.679069423592, 10.7726465921904), (106.679053957365, 10.7726404990091), (106.679037589221, 10.7726375981655), (106.679020970997, 10.7726380051815), (106.679004764489, 10.7726417038483), (106.678989615098, 10.7726485468719), (106.678976126125, 10.772658261739), (106.678449597495, 10.7731239014943), (106.678407514754, 10.773159565689), (106.678406188192, 10.7731607141448), (106.678291034854, 10.7732625482153), (106.678131577851, 10.7733972356454), (106.678131249559, 10.7733975143985), (106.677809116892, 10.7736724741964), (106.677803734254, 10.7736774962862), (106.67777351642, 10.773708297704), (106.677376870851, 10.7734422350384), (106.677376291861, 10.7734418501559), (106.676943701895, 10.7731568826838), (106.676941799819, 10.7731556663352), (106.676705634648, 10.7730091132449), (106.676468020922, 10.7728596290723), (106.676467624617, 10.7728593813034), (106.676202468827, 10.7726946395397), (106.675976718772, 10.7725542402878), (106.675713344944, 10.7723904505946), (106.675438984881, 10.7722195485022), (106.675160330528, 10.7720443170291), (106.674980445983, 10.7719313240966), (106.674980215342, 10.7719311797465), (106.674747119479, 10.7717858222138), (106.674497164595, 10.7716283533947), (106.674495300219, 10.7716272127471), (106.674339180867, 10.7715344896819), (106.674338897981, 10.771534322423), (106.674061493048, 10.7713710419232), (106.674061328848, 10.7713709455279), (106.673777295695, 10.7712046366425), (106.673775349509, 10.7712035319333), (106.673513740027, 10.7710596467179), (106.673513190173, 10.7710593469847), (106.673099330442, 10.7708357600807), (106.673098966779, 10.7708355647753), (106.672357083034, 10.7704395002842), (106.672023628724, 10.7702576558632), (106.671746880137, 10.7701061587426), (106.671518215262, 10.7699783515251), (106.671516207112, 10.7699772649622), (106.671350083838, 10.7698903014222), (106.671115399209, 10.7697601522552), (106.671113600766, 10.7697591835329), (106.670830326847, 10.7696110514048), (106.66974820551, 10.7689798847013), (106.66969475177, 10.7688866833063), (106.669685913661, 10.7688741199651), (106.669674918986, 10.7688633930448), (106.669662141606, 10.7688548673033), (106.668277363011, 10.7681053993183), (106.668276514094, 10.7681049461882), (106.668126503268, 10.7680259842551), (106.668125839186, 10.7680237950692), (106.66812072496, 10.7680095017658), (106.668117596648, 10.7680019493532), (106.66811110606, 10.7679882261576), (106.668107252546, 10.7679810167398), (106.668099448104, 10.7679679958141), (106.668094906497, 10.767961198818), (106.668085863361, 10.7679490055608), (106.668080677403, 10.7679426864524), (106.668070482664, 10.7679314382913), (106.668064702296, 10.7679256579236), (106.668053454135, 10.7679154631847), (106.668047135024, 10.7679102772246), (106.668034941766, 10.7679012340887), (106.668028144776, 10.7678966924853), (106.668015123851, 10.7678888880428), (106.668007914429, 10.7678850345264), (106.667994191233, 10.7678785439383), (106.667986638821, 10.7678754156266), (106.667972345518, 10.7678703014008), (106.667964522841, 10.7678679284177), (106.667949797082, 10.7678642398071), (106.667941779481, 10.7678626450072), (106.667926763083, 10.767860417535), (106.667918627772, 10.7678596162768), (106.667903465352, 10.7678588713949), (106.667895290678, 10.7678588713949), (106.667880128258, 10.7678596162768), (106.667871992947, 10.767860417535), (106.667856976549, 10.7678626450072), (106.667848958948, 10.7678642398071), (106.667848526162, 10.7678643482145), (106.667629153721, 10.7677506481269), (106.667628614008, 10.7677503708842), (106.66744662399, 10.7676577214203), (106.667216888626, 10.7675408306262), (106.667161868227, 10.7675128359024), (106.667012119458, 10.7674366427911), (106.666659357657, 10.7672571553777), (106.666673753979, 10.7671954479766), (106.667048293768, 10.7672739882109), (106.6670141, 10.7674274)]);

SELECT pointInPolygon((1.7976931348623157e308, 1.), CAST([[[]]], 'Array(Array(Array(Tuple(Float64, Float64))))'));

INSERT INTO polygons VALUES (1, (-9, 0), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (2, (-9, 0), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (3, (0, -9), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (4, (0, -9), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (5, (-4, -4), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (6, (-4, -4), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (7, (0, 0), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (8, (0, 0), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (9, (4, 4), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (10, (4, 4), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (11, (9, 9), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (12, (9, 9), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (13, (9, 4), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (14, (9, 4), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]),
                            (15, (4, 9), [[[(0, 0), (10, 0), (10, 10), (0, 10)], [(4, 4), (6, 4), (6, 6), (4, 6)]]]),
                            (16, (4, 9), [[[(-5, -5), (5, -5), (5, 5), (-5, 5)], [(-1, -1), (1, -1), (1, 1), (-1, 1)]]]);

SELECT 'Sum before DROP PARTITION:';

DROP TABLE IF EXISTS without_fixed_size_columns;

DROP TABLE IF EXISTS partitioned_by_week_replica1 SYNC;

SELECT sum(y) FROM partitioned_by_tuple_replica2_00502;

SELECT partition, name, rows FROM system.parts WHERE database = currentDatabase() AND table = 'without_fixed_size_columns_replica2' AND active ORDER BY name;

select sumMap(val, cnt) from ( SELECT [ CAST(1, 'DateTime(\'Asia/Istanbul\')') ] as val, [1] as cnt );

select * from test_ins_null limit 10;

SELECT 'NOW okay =========================:';

INSERT INTO union2 VALUES (21,22,23,24,25);

SELECT * FROM {CLICKHOUSE_DATABASE:Identifier}.dst ORDER BY x;

DROP TABLE replicated_collapsing;

SET deduplicate_blocks_in_dependent_materialized_views = 0;

SELECT (toDateTime('2000-01-01 12:00:00') + INTERVAL 1234567 NANOSECOND) x, toTypeName(x);

SELECT toString(toDateTime('2017-11-05 08:07:47', 'Asia/Istanbul'), 'Asia/Kolkata');

select gcd(-2147483648, 1);

INSERT INTO deduplication_by_partition VALUES ('2000-02-01', 3), ('2000-02-01', 4), ('2000-02-01', 5);

CREATE TABLE date (d Date) ENGINE = Memory;

OPTIMIZE TABLE multidimensional;

SELECT toDateTime('2017-01-01 00:00:00') - INTERVAL -13 MONTH AS x;

SELECT toDate('2017-01-01') + INTERVAL -1 YEAR AS x;

SELECT CAST(materialize(1) AS Nullable(UInt8));

INSERT INTO agg_over_nullable(partition, timestamp, user_id, description) VALUES(now(), now(), 1, NULL);

SELECT (toDate('2017-01-01') AS base) + INTERVAL number MONTH AS d, toDateTime(d, 'UTC') AS t, toQuarter(d) AS qd, toQuarter(t) AS qt, toStartOfQuarter(d) AS sqd, toStartOfQuarter(t) AS sqt, toRelativeQuarterNum(d) - toRelativeQuarterNum(base) AS qdiff_d, toRelativeQuarterNum(t) - toRelativeQuarterNum(base) as qdiff_t FROM system.numbers LIMIT 24;

SELECT dateDiff('second', toDate('2017-12-31'), toDateTime('2016-01-01 00:00:00', 'UTC'), 'UTC');

SELECT dateDiff('second', toDateTime('2014-10-26 00:00:00', 'Asia/Istanbul'), toDateTime('2014-10-27 00:00:00', 'Asia/Istanbul'));

SELECT visitParamExtractUInt('{"myparam":-1}', 'myparam');

CREATE TEMPORARY TABLE readonly00542 (
    ID Int
) Engine = Memory;

SELECT sumForEachMergeArray(y) FROM (SELECT sumForEachStateForEachIfArrayMerge(x) AS y FROM (SELECT sumForEachStateForEachIfArrayState([[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [1]) AS x));

SELECT x FROM test WHERE x != 1;

select hasAll([Null], [Null]);

select hasAll(['a', 'b'], ['a', 'c']);

select arrayIntersect([], []);

select arrayResize([1, Null, 3], 10);

-- type conversion
SELECT * FROM ( SELECT toUInt32(11) AS id2 ) AS js1 SEMI LEFT JOIN joinbug_join USING (id2);

SELECT * FROM test_00563 WHERE toInt32(site_id) IN (100);

INSERT INTO test(id, track, codec, content) VALUES(2, 0, 'h264', 'CONTENT');

insert into mult_tab select '2018-01-31', number, number, 0, if(number < 64, 1, -1) from system.numbers limit 128;

ALTER TABLE nullable_00571 ADD COLUMN n Nullable(UInt64);

CREATE TEMPORARY TABLE t_00573 (x UInt8);

INSERT INTO testCleanupR1 (*) VALUES ('d1', 1, 0),('d2', 1, 0),('d3', 1, 0),('d4', 1, 0);

DROP TABLE numbers2;

SELECT * FROM unsorted_replacing FINAL;

INSERT INTO sample_00579_2 (x) SELECT number AS x FROM system.numbers LIMIT 2000;

CREATE VIEW TestView AS
    SELECT str, key, sumIf(a, 0) AS sum
    FROM Test_00584
    GROUP BY str, key

    UNION ALL

    SELECT str AS str, CAST('ALL' AS Enum8('A' = 0, 'B' = 1, 'ALL' = 2)) AS key, sumIf(a, 0) AS sum
    FROM Test_00584
    GROUP BY str;

SELECT * FROM (SELECT x, toTypeName(x) FROM (SELECT 1 AS x UNION ALL SELECT -1)) ORDER BY x DESC;

SELECT count() FROM (SELECT arrayJoin([sum(x), medianExact(x)]), arrayJoin([min(x), max(x)]) FROM (SELECT number AS x FROM numbers(10)));

SELECT field2, field3 FROM alias10 WHERE EventDate='2000-01-01';

-- RIGHT JOIN
EXPLAIN SYNTAX SELECT a, b FROM (SELECT 1 AS a, 1 as b) ANY RIGHT JOIN (SELECT 1 AS a) USING (a) WHERE b = 0;

SELECT * FROM (SELECT b.* FROM (SELECT * FROM test_00597) AS b) WHERE id = 1;

-- Explain with join subquery
EXPLAIN SYNTAX SELECT * FROM (SELECT * FROM test_00597) ANY INNER JOIN (SELECT * FROM (SELECT * FROM test_00597)) as r USING id WHERE r.id = 1;

CREATE TABLE t4(x UInt32, y UInt32 ALIAS x + 1) ENGINE TinyLog;

INSERT INTO merge_tree VALUES (0), (1);

select * from test_mv_00609;

DROP TABLE tab_00610;

SET prefer_localhost_replica=1;

select max(key) from tab_00612 left array join n as val where (key, val.x) in (1, 1);

select time FROM remote('127.0.0.{1,2}', currentDatabase(), tab)  WHERE date = '2018-01-21' limit 2;

SELECT count(*) FROM test_array_ops where arr >= CAST([10, -20] AS Array(Nullable(Int64)));

DROP TABLE union;

SELECT count() FROM regression_for_in_operator_view WHERE g IN ('5','6');

select 213 from test54378 prewhere pk_date in ('2018-04-19');

select 422 from test54378 where part_date in (toDate('2018-04-19'));

INSERT INTO truncate_test_set VALUES(0);

CREATE MATERIALIZED VIEW truncate_test_materialized_view ENGINE = MergeTree(p, k, 1) AS SELECT * FROM truncate_test_materialized_depend;

INSERT INTO tab_00625 SELECT
    today(),
    number,
    [toUInt16(number)],
    [number]
FROM system.numbers
LIMIT 8190;

select identity(tuple(1)) in (tuple(0), tuple(2));

-- The setting opt-in below preserves the legacy behavior of `REPLACE PARTITION` from an
-- empty source, silently dropping the destination partition. Issue #23727 made this a
-- per-query opt-in to prevent accidental data loss; this test continues to exercise the
-- intentional-clear use case.
ALTER TABLE dst REPLACE PARTITION 1 FROM src SETTINGS allow_replace_partition_from_empty_source = 1;

ALTER TABLE dst DETACH PARTITION 2;

insert into funnel_test2(timestamp, event) values  ('2018-01-01 01:01:01',1001),('2018-01-01 01:01:02',1002),('2018-01-01 01:01:03',1003),('2018-01-01 01:01:04',1004),('2018-01-01 01:01:05',1005),('2018-01-01 01:01:06',1006),('2018-01-01 01:01:07',1007),('2018-01-01 01:01:08',1008);

insert into funnel_test_strict_order values (1, 5, 'a') (2, 5, 'a') (3, 5, 'b') (4, 5, 'b') (5, 5, 'd') (6, 5, 'c') (7, 5, 'c');

select 5 = windowFunnel(10000)(timestamp, event = 1000, event = 1001, event = 1002, event = 1003, event = 1004) from funnel_test_strict_increase;

CREATE TABLE dict_ui64 (learnerId UInt64) ENGINE = Memory;

rename table v_test1 to v_test11, v_test2 to v_test22;

SELECT endsWith('123', '32');

INSERT INTO cast1 (x) VALUES (1);

SELECT countMerge(x) AS y FROM ( SELECT countState() * 2 AS x FROM ( SELECT 1 ));

select arrayEnumerateUniq(n.x) from tab_00650;

INSERT INTO partitioned_by_tuple VALUES ('2000-01-02', 1, 'first', 3);

SELECT has(['a', 'b'], 'a');

SELECT has(materialize(['a', NULL, 'b']), materialize('c'));

SELECT has([111, NULL, 222], materialize(222));

SELECT * FROM data;

SELECT uniqExact(x) FROM (SELECT arrayJoin([[], ['a'], ['a', 'b'], []]) AS x);

drop temporary table if exists test_00670;

DROP TABLE arrayDistinct_test;

select a1, b1 from tab1 any left join tab2 on b1 = a2;

select a1, a2, b1, b2 from tab1 first any left join tab2 second_ on tab2.a2 = first.b1;

select a1, b1, a2, b2 from tab1 any left join (select *, a2 + 1 as z from tab2) on b1 + 2 = z + 1 format TSV;

SELECT murmurHash2_32(123456);

SELECT hex(murmurHash3_128('foo'));

SET output_format_json_escape_forward_slashes = 1;

DROP TABLE retention_test;

select str, str in (select str from lc_00688) from lc_00688;

insert into lc_big_dict select toString(number) from system.numbers limit 1000000;

insert into lc_int8_0 select 1;

SELECT arrayDistinct(materialize(['', NULL, ''])) FROM numbers(2);

SELECT count() > 0 FROM (SELECT * FROM system.columns LIMIT 7);

INSERT INTO decimal (a, b, c)
SELECT toDecimal32(number - 50, 4), toDecimal64(number - 50, 8) / 3, toDecimal128(number - 50, 8) / 5
FROM system.numbers LIMIT 101;

SELECT quantileExact(a), quantileExact(b), quantileExact(c) as x, toTypeName(x) FROM decimal WHERE a < 0;

SELECT quantileExactHigh(0.8)(a), quantileExactHigh(0.8)(b), quantileExactHigh(0.8)(c) FROM decimal WHERE a >= 0;

INSERT INTO decimal (a, b, c, d, e, f, g, h, i, j, k, l, m, n, o) VALUES (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

SELECT a, -a, -b, -c, -d, -e, -f, -g, -h, -j from decimal ORDER BY a;

SELECT arrayCompact([toDecimal64(1.0,8), toDecimal64(1.0,8)]) x, toTypeName(x);

INSERT INTO decimal (a, b, d, g) VALUES (-999999999, -999999999999999999, -0.999999999, -9999.99999);

SELECT '-0.1' AS x, toDecimal32(x, 0);

SELECT toFloat32(999.9999)  as x, toDecimal32(x, 4), toDecimal32(-x, 4), toDecimal64(x, 4), toDecimal64(-x, 4);

SELECT toFloat64(99999999999999999.9)  as x, toDecimal128(x, 1), toDecimal128(-x, 1);

SELECT toInt64(999999999) as x, toDecimal32(x, 0), toDecimal32(-x, 0), toDecimal64(x, 0), toDecimal64(-x, 0);

SELECT toDecimal128('92233720368547757.99', 2) AS x, toInt64(x), toInt64(-x);

SELECT toUInt64('9223372036854775807') AS x, toDecimal64(x, 0);

SELECT (a, d, g) = (b, e, h), (a, d, g) != (b, e, h) FROM decimal ORDER BY a;

SELECT b, arrayPopBack(b), arrayPopFront(b), arrayResize(b, 1), arraySlice(b, 2, 1) FROM decimal;

SELECT has(a, toDecimal64(0.1, 3)) FROM decimal;

SELECT arrayConcat(b, c) AS x, toTypeName(x) FROM decimal;

SELECT toTypeName(x) FROM (SELECT toDecimal32('12345.00', 4) AS x UNION ALL SELECT toUInt64(0) AS x) WHERE x = 0;

SELECT number % 2 ? toDecimal128('128.1', 5) : toDecimal128('128.2', 5) FROM system.numbers LIMIT 2;

select if(0, [cast(materialize(2.0),'Decimal(38,0)')], [cast(materialize(1.0),'Decimal(38,18)')]);

SELECT toDecimal64('42.42', 4) AS x, toDecimal32(cbrt(x), 4) AS y, toDecimal64(y, 4) * y * y;

SELECT coalesce(toDecimal32(5, 0), NULL), coalesce(toDecimal64(5, 0), NULL), coalesce(toDecimal128(5, 0), NULL);

SELECT count() FROM decimal WHERE d IS NULL;

SELECT toDecimal64(12345.6789, 4) AS x, roundBankers(x), roundBankers(x, 1), roundBankers(x, 2), roundBankers(x, 3), roundBankers(x, 4), roundBankers(x, 5);

SELECT toDecimal128(-12345.6789, 4) AS x, floor(x), floor(x, 1), floor(x, 2), floor(x, 3), floor(x, 4), floor(x, 5);

select '-- Decimal128, Scale 20';

SELECT toDecimal64OrZero('-100000000000000000000000000000000000000', 0);

SELECT a, b FROM a1 LEFT JOIN (SELECT a, b FROM a2) js2 USING a ORDER BY b SETTINGS join_default_strictness='ANY';

select 'left';

select X.*, s.* from X left join (select * from X) as s on X.id = s.x_b order by X.id, X.x_a, X.x_b, s.id, s.x_a, s.x_b;

drop table if exists children;

DROP TABLE IF EXISTS where_qualified;

SELECT arraySort(groupArrayMerge(x + y)) FROM (SELECT groupArrayState(a) AS x, groupArrayState(b) as y FROM add_aggregate);

SELECT nan = toUInt8(0), nan != toUInt8(0), nan < toUInt8(0), nan > toUInt8(0), nan <= toUInt8(0), nan >= toUInt8(0);

drop table if exists prewhere_alias;

drop table if exists tab_00712_1;

INSERT INTO mergetree_00712 VALUES (2, 'Goodbye.', 3);

INSERT INTO collapsing VALUES ('k1', 'k1v1', 1);

create table rate_test (timestamp UInt32, event UInt32) engine=Memory;

SELECT a, b FROM default_join1 JOIN (SELECT a, b FROM default_join2) js2 USING a ORDER BY b SETTINGS join_default_strictness='ANY';

select b, length(b) as l from tab_00717 group by b, l, l + 1 order by b;

SELECT * FROM merge(currentDatabase(), 'test_local_1|test_local_2') ORDER BY _table;

SELECT '--------------Implicit type conversion------------';

SELECT formatDateTime(toDateTime('2018-01-02 22:33:44'), '%S'), formatDateTime(toDate32('2018-01-02'), '%S');

select formatDateTime(toDateTime64('2010-01-04 12:34:56.123', 3), '%f') SETTINGS formatdatetime_f_prints_single_zero = 1;

alter table tab_00718 modify column b UInt32;

DROP TABLE IF EXISTS byte_identical_r1;

SELECT count(t.database)
    FROM (SELECT * FROM system.tables WHERE name = 'one') AS t
    JOIN system.databases AS db ON t.database = db.name;

SELECT '< 127.0.0.1', ipv4_ FROM ipv4_test
    WHERE ipv4_ < toIPv4('127.0.0.1')
    ORDER BY ipv4_;

SELECT '127.0.0.1 is ipv6 string:                               ', isIPv6String('127.0.0.1');

select * from t_00725_2 all left join (select a s_a, b s_b from s_00725_2) on (s_a = t_00725_2.a and s_b = t_00725_2.b) ORDER BY ALL;

DROP TABLE IF EXISTS mv2_00726;

SELECT '-- Const string + non-const arbitrary type';

SELECT concat('With ', materialize(42 :: LowCardinality(UInt32)));

INSERT INTO concat_nested_test VALUES (['foo', 'bar'], ['qaz', 'qux']);

SELECT CONCAT('Testing the ', 'alias');

INSERT INTO unicode VALUES ('안녕하세요', '여기에서 코드를 수정하고 실행할 수 있습니다!');

SELECT base64Decode('Zm9v\nYmFy');

SET insert_quorum=2, insert_quorum_parallel=0;

-- everything works fine after merge
SELECT x FROM quorum1 ORDER BY x;

SELECT toInt8(0) AS x, toUInt16(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT toInt32(0) AS x, toUInt8(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT toUInt8(0) AS x, toInt64(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT toUInt32(0) AS x, toInt32(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT toDate('2000-01-01') AS x, toDateTime('2000-01-01 00:00:01', 'Asia/Istanbul') AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT materialize(toInt8(0)) AS x, toDateTime(1, 'Asia/Istanbul') AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT materialize(toInt32(0)) AS x, toFloat64(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT materialize(toUInt8(0)) AS x, toFloat32(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT materialize(toUInt32(0)) AS x, toUInt64(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

SELECT materialize(toDateTime(0, 'Asia/Istanbul')) AS x, toUInt8(1) AS y, ((x > y) ? x : y) AS z, toTypeName(x), toTypeName(y), toTypeName(z);

select s, (s=21 or s=22 or s=23) from bug;

drop temporary table if exists wups;

SELECT sum(mul)/sqrt(sum(sqr_dif_1) * sum(sqr_dif_2)) AS z_r
FROM(
SELECT
        (SELECT avg(z_1) AS z_1_avg, 
                avg(z_2) AS z_2_avg
        FROM ( 
            SELECT perf_1.site, perf_1.z AS z_1
            FROM perf AS perf_1
            WHERE user_id = 000
        ) jss1 ALL INNER JOIN (
            SELECT perf_2.site, perf_2.z AS z_2
            FROM perf AS perf_2
            WHERE user_id = 999
        ) jss2 USING site) as avg_values,
       z_1 - avg_values.1 AS dif_1, 
       z_2 - avg_values.2 AS dif_2, 
       dif_1 * dif_2 AS mul, 
       dif_1*dif_1 AS sqr_dif_1, 
       dif_2*dif_2 AS sqr_dif_2
FROM (
            SELECT perf_1.site, perf_1.z AS z_1
            FROM perf AS perf_1
            WHERE user_id = 000
) js1 ALL INNER JOIN (
            SELECT perf_2.site, perf_2.z AS z_2
            FROM perf AS perf_2
            WHERE user_id = 999
) js2 USING site);

INSERT INTO testx VALUES (100000, 0);

SELECT murmurHash3_64(1, 2, 3);

DROP TABLE IF EXISTS t_mv_00751;

SELECT farmHash64(123456);

insert into lc_00752 values ('a'), ('bbb'), ('ab'), ('accccc'), ('baasddas'), ('bcde');

ALTER TABLE alter_attach DETACH PARTITION ALL;

DROP TABLE partition_all;

SELECT * FROM dst_00753 ORDER BY x;

CREATE TABLE datetime (d DateTime('UTC')) ENGINE = Memory;

-- Random settings limits: send_table_structure_on_insert_with_inline_data=(1, 1)
-- This test asserts exact `total_bytes` values returned by `system.tables` for several
-- engines (notably `Memory`). The inline-server-parsed path
-- (`send_table_structure_on_insert_with_inline_data=0`) builds the in-memory block with a
-- different layout than the legacy client-parsed path, so the reported byte counts differ
-- (e.g. 130 -> 256 for the `Memory` engine case). Pin the legacy path here; this test is
-- about the system-table reporting, not about which side parses inline data.
SET output_format_pretty_row_numbers = 0;

SELECT 'Check lifetime_bytes/lifetime_rows for Buffer';

SELECT * FROM alter_column ORDER BY _part;

ALTER TABLE summing_r1 ADD COLUMN z UInt32 AFTER y, MODIFY ORDER BY (x, y, -z);

INSERT INTO auto_assign_enum VALUES('a'), ('b');

SELECT reverse([[[[]]]]);

SELECT 'Xx|sfF', match('', '\0'), [], ( SELECT cutURLParameter('C,Ai?X', '\0') ), '\0';

select SUBSTRING('foo', 1, 2);

SELECT number, arr1, arr2, x, y FROM (SELECT number, range(number % 2) AS arr1, range(number % 3) arr2 FROM system.numbers LIMIT 10) ARRAY JOIN arr1 AS x, arr2 AS y SETTINGS enable_unaligned_array_join = 1;

select javaHashUTF16LE(convertCharset('FJKLDSJFIOLD_389159837589429', 'utf-8', 'utf-16le'));

select * from lc_00800_1;

DROP TABLE IF EXISTS join_any_inner;

INSERT INTO join_string_key VALUES ('abc', [0], 1), ('def', [1, 2], 2);

-- min_time and max_time are now filled

SELECT partition, toTimeZone(MIN(min_time), 'UTC') as min_time, toTimeZone(MAX(max_time), 'UTC') as max_time
FROM system.parts
WHERE database = currentDatabase() and table = 'datetime_table' AND active = 1
GROUP BY partition
ORDER BY partition ASC
FORMAT CSV;

SELECT xxHash64('foo') = toUInt64(3728699739546630719);

SELECT xxHash32(x) = toUInt32(949155633) FROM (SELECT CAST(1 AS Enum8('a' = 1, 'b' = 2)) as x);

INSERT INTO alter_compression_codec VALUES('2018-01-01', 4, '4');

INSERT INTO compression_codec VALUES(1, 'hello', toDate('2018-12-14'), 1.1, 'aaa', 5);

DROP TABLE IF EXISTS compression_codec_multiple_more_types;

INSERT INTO compression_codec_log VALUES(2, 'world', toDate('2018-12-15'), 2.2, 'bbb', 6);

DETACH TABLE compression_codec_tiny_log;

SELECT
    small_hash == big_hash
FROM
    (SELECT 1 AS key, sum(cityHash64(*)) AS small_hash FROM delta_codec_synthetic)
INNER JOIN
    (SELECT 1 AS key, sum(cityHash64(*)) AS big_hash FROM default_codec_synthetic)
USING(key);

SELECT toUInt8(number) as x, roundDown(x, [-1.5, e(), pi(), 5.5]) FROM system.numbers LIMIT 10;

SELECT regexpQuoteMeta('\0\\|()^$.[?*+{');

SELECT ignore(subtractDays(toDate(0), 1));

create table t2_00816 (a Int8, val Float32) engine=Memory();

CREATE TABLE table1(a String, b Date) ENGINE MergeTree order by a;

SELECT * FROM (SELECT 1 AS a, 'x' AS b) join (SELECT 1 as a, 'y' as b) using a;

select table1.a, table2.a, table2.b, table3.b
from table1 as t1
join table2 as t2 on table1.a = table2.a
join table3 as t3 on table2.b = table3.b
ORDER BY t1.a;

SELECT filesystemCapacity() >= filesystemAvailable() AND filesystemAvailable() >= 0 AND filesystemUnreserved() >= 0;

select * from t1_00826 cross join t2_00826 where t1_00826.a = t2_00826.a and t1_00826.b = t2_00826.b and (t1_00826.a >= 1 OR t2_00826.b = 1) order by all;

DROP TABLE t1_00826;

SELECT bitmapAndCardinality(bitmapBuild([1,2,3]),bitmapBuild([3,4,5]));

INSERT INTO bitmap_column_expr_test2 VALUES ('tag3', bitmapBuild(cast([2,4,6,8,10,12] as Array(UInt32))));

select bitmapHasAny(bitmapBuild([
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,
    100,200,500]),bitmapBuild([ 99, 101, 600]));

---- Small
select bitmapToArray(bitmapSubsetInRange(bitmapBuild([1,5,7,9]), toUInt8(0), toUInt16(4)));

---- Large
select bitmapMin(bitmapBuild([
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,
    100,200,500]));

INSERT INTO file VALUES (1);

SELECT materialize(toDateTime('2000-01-01 00:00:00', 'Asia/Istanbul')) AS x, materialize(toDate('2000-01-02')) AS y, x > y ? x : y AS z;

ALTER TABLE minmax_idx2 DROP INDEX idx1, DROP INDEX idx2;

SYSTEM SYNC REPLICA minmax_idx2;

SYSTEM SYNC REPLICA minmax_idx1;

SELECT bitmaskToArray(toInt64(-1));

select t1_00844.f1,t2_00844.f3 from t1_00844 all inner join t2_00844 on t1_00844.f2 = t2_00844.f1
where t2_00844.f1 = '1';

select y.a, y.a, y.b as y_b, y.b from t
left join s on s.a = t.a
left join y on y.b = s.b
order by t.a
format PrettyCompactMonoBlock;

SELECT t3.id = 'l', t3.not_id = 'l' FROM t1_00848 t1 ANY LEFT JOIN t3_00848 t3 USING(id) ORDER BY t1.id, t3.id;

SELECT countIf(explain like '%COMMA%' OR explain like '%CROSS%'), countIf(explain like '%INNER%') FROM (
    EXPLAIN QUERY TREE SELECT t1.a FROM t1, t2, t3, t4 WHERE t3.a = t1.a AND t3.a = t2.a AND t3.a = t4.a);

SELECT t1.a, t2.b, t3.b, t4.b FROM t1, t2, t3, t4
WHERE t1.a = t2.a AND t2.a = t3.a AND t3.a = t4.a
ORDER BY t2.b, t3.b, t4.b;

CREATE TABLE table_b (
    event_id UInt64,
    something Nullable(String),
    other String
) ENGINE = MergeTree ORDER BY (event_id);

SELECT d_ids, id, name FROM f LEFT ARRAY JOIN d_ids LEFT JOIN d ON d.id = d_ids ORDER BY id;

select t2.name from remote('127.0.0.2', currentDatabase(), 'local_table') as t1
global left join other_table as t2
on t1.oth_id = t2.id
order by t2.name;

insert into fooL select number, 'L'  || toString(number) from numbers(2);

SELECT * FROM temp WHERE y IN (toDecimal32(32, 1));

drop table test2_00863;

INSERT INTO t64 SELECT (intExp2(24) - 1 + number) AS x, x, x, x, x, x, x, x FROM numbers(129);

SELECT * FROM t64 ORDER BY i64;

INSERT INTO t64 SELECT (10 - toInt64(intExp2(40)) + number) AS x, x, x, x, x, x, x, x FROM numbers(10);

DROP TABLE IF EXISTS nt;

DROP TABLE IF EXISTS ntxy;

select t.*, s.* from t left join s on (s.a=t.a and t.b=s.b) order by t.a;

select t.a, t.a as t_a, max(s.a) from t
left join s on t.a = s.a
left join y on y.b = s.b
group by t.a order by t.a;

insert into defaults values (0), (0), (1), (0), (0), (0), (1), (2), (3), (5), (3), (1), (1), (4), (5), (2);

DROP TABLE if exists lc;

EXPLAIN SYNTAX SELECT * FROM a;

-- f(1, z,2)     =[[1,2,3],[4,5,6],[1]] -- [1,2,3] [1,2,3] [1,2,3] [1,2,3] [1,2,3] [1,2,3] [1,2]
SELECT '[[1,1,1],[1,2,2],[1]] =';

-- f(2, y2,2)=[[1,1,2],[1,1,2],[1]] -- a b a, a b a, c
SELECT '[[1,1,1],[1,1,1],[1]] =';

SELECT arrayEnumerateDenseRanked(1, [[[1,2,3],[1,2,3],[1,2,3]],[[1,2,3],[1,2,3],[1,2,3]],[[1,2]]], 1);

SELECT 'a3,a4 1..n', arrayEnumerateUniqRanked(a3,a4) FROM arrays_test ORDER BY a3, a4;

SELECT a, arrayEnumerateUniqRanked(a) FROM ( SELECT * FROM ( SELECT [[], [1, 2, 3, 4]] AS a UNION ALL SELECT [[3, 4, 5]] AS a ) ORDER BY a ASC );

select '-- empty';

select round(1000 * ngramDistanceUTF8('абвгдеёжз', materialize('гдеёзд')))=round(1000 * ngramDistanceUTF8(materialize('абвгдеёжз'), 'гдеёзд')) from system.numbers limit 5;

select round(1000 * ngramDistanceCaseInsensitiveUTF8(materialize('абвгдеёжз'), 'гдеёЗД')) from system.numbers limit 5;

SELECT Title, round(1000 * distance) FROM test_distance ORDER BY ngramDistanceCaseInsensitiveUTF8(Title, 'как ПРИВЕТ дела') as distance, Title;

select round(1000 * ngramDistance('abcdefgh', materialize('aaaaaaaa')))=round(1000 * ngramDistance(materialize('abcdefgh'), 'aaaaaaaa')) from system.numbers limit 5;

select round(1000 * ngramDistanceCaseInsensitive(materialize('AAAAbcdefgh'), materialize('defgh')))=round(1000 * ngramDistanceCaseInsensitive(materialize('AAAAbcdefgh'), 'defgh')) from system.numbers limit 5;

DROP TABLE IF EXISTS buffer_table1__fuzz_28;

INSERT INTO compression_codec_replicated1 VALUES(1, 'hello', toDate('2018-12-14'), 1.1, 'aaa', 5);

SELECT floor(sum(somenum), 1) FROM compression_codec_multiple_replicated2;

SYSTEM SYNC REPLICA alter_compression_codec1;

CREATE TEMPORARY TABLE t (x UInt64);

select toTypeName(nullable_str),toTypeName(nullable_str_respect_nulls),toTypeName(low_str),toTypeName(ip),toTypeName(status), toTypeName(tup), toTypeName(tup_min), toTypeName(tup_max), toTypeName(arr), toTypeName(uniq_arr), toTypeName(map_uniq_arr) from simple limit 1;

SELECT * FROM (SELECT 1 AS x) AS t1 ANY LEFT JOIN (SELECT 1 AS x) AS t2 ON t1.x = t2.x;

SELECT hasAll([['Hello, world']], [['Hello', 'world'], ['Hello, world']]);

SELECT JSONExtractUInt('{"a": "hello", "b": [-100, 200.0, 300]}', 'b', -1);

SELECT JSONExtract('{"a": "hello", "b": [-100, 200.0, 300]}', 'b', 4, 'Nullable(Int64)');

SELECT JSONExtract('{"a":-1234567890}', 'a', 'Int32') as a, toTypeName(a);

SELECT JSONExtract('{"a":"1234567890123456789999"}', 'a', 'UInt64') as a, toTypeName(a);

SELECT JSONExtractRaw('{"a": "hello", "b": [-100, 200.0, 300], "c":{"d":[121,144]}}', 'c', 'd', 2);

SELECT '--JSONExtractKeys--';

-- this now works OK and produces timestamp with no subsecond part

CREATE TABLE A(t DateTime64(3, 'UTC')) ENGINE = MergeTree() ORDER BY t;

INSERT INTO zero_rows_per_granule (p, k, v1, v2) VALUES ('2018-05-15', 1, 1000, 2000), ('2018-05-16', 2, 3000, 4000), ('2018-05-17', 3, 5000, 6000), ('2018-05-18', 4, 7000, 8000);

SELECT COUNT(*) FROM adaptive_granularity_alter;

CREATE TABLE large_alter_table_00926 (
    somedate Date CODEC(ZSTD, ZSTD, ZSTD(12), LZ4HC(12)),
    id UInt64 CODEC(LZ4, ZSTD, NONE, LZ4HC),
    data String CODEC(ZSTD(2), LZ4HC, NONE, LZ4, LZ4)
) ENGINE = MergeTree() PARTITION BY somedate ORDER BY id SETTINGS min_index_granularity_bytes=30, write_final_mark = 0, min_bytes_for_wide_part = '10M', min_rows_for_wide_part = 0;

INSERT INTO four_rows_per_granule (p, k, v1, v2, Sign, Version) VALUES ('2018-05-15', 1, 1000, 2000, 1, 1), ('2018-05-16', 2, 3000, 4000, 1, 1), ('2018-05-17', 3, 5000, 6000, 1, 1), ('2018-05-18', 4, 7000, 8000, 1, 1);

select geoToH3(lat, lon, resolution) AS k, count(*) from table1 group by k order by k;

select 1 = multiMatchAny(materialize('iketunkleyaqaxdlocci'), ['nkleyaqaxd', 'etunkleyaq', 'yaqaxdlocci', 'tunkleyaq', 'eyaqaxdlocc', 'leyaq', 'nkleyaqaxdl', 'tunkleya', 'kleyaqa', 'etunkleya', 'leyaqa', 'dlo', 'yaqa', 'leyaqaxd', 'etunkleyaq', '']) from system.numbers limit 10;

select 1 = multiMatchAny(materialize('abc'), ['abc']) from system.numbers limit 10;

select 0 != multiMatchAnyIndex(materialize('gogleuedeuniangoogle'), ['.*goo.*', '.*yan.*']) from system.numbers limit 10;

select 1 = multiMatchAny(materialize('loqchlxspwuvvccucskuytr'), materialize(['', 'k', 'qchlxspwu', 'u', 'hlxspwuvv', 'wuvvccucsku', 'vcc', 'uyt', 'uvv', 'spwu', 'ytr', 'wuvvccucs', 'xspwuv', 'lxspwuvvccuc', 'spwuvvccu', 'oqchlxspwuvvccucskuy'])) from system.numbers limit 10;

select 0 = multiMatchAny(materialize('abc'), materialize(['abcde'])) from system.numbers limit 10;

select 1 = multiMatchAnyIndex(materialize('gogleuedeuniangoogle'), materialize(['google', 'unian1'])) from system.numbers limit 10;

SELECT 'Parts optimized';

SELECT COUNT(*) FROM adaptive_granularity_alter2;

SELECT A.k, A.t, A.a, B.b, B.t, B.k FROM A ASOF LEFT JOIN B3 B USING(k,t) ORDER BY (A.k, A.t);

CREATE TABLE tv(key UInt32, t DateTime, tv Float64) ENGINE = MergeTree() ORDER BY (key, t);

select multiFuzzyMatchAny('string', 0, ['zorro$', '^tring', 'in$', 'how.*', 'it{2}', 'works']);

create table array_intersect (date Date, arr Array(UInt8)) engine=MergeTree partition by date order by date;

create table test_in (a LowCardinality(String)) Engine = MergeTree order by a;

select geohashEncode(-5.60302734375, materialize(42.593994140625), 0);

create table ttl (d Date, a Int) engine = MergeTree order by tuple() partition by toDayOfMonth(d) settings remove_empty_parts = 0;

insert into ttl_00933_1 values (toDateTime('2100-10-10 00:00:00'), 3);

insert into ttl_00933_2 values (toDateTime('2100-10-10 00:00:00'), 4, 400);

select 1 = isValidUTF8('\xf0\x90\x8c\xbc') from system.numbers limit 10;

select 0 = isValidUTF8('\xED\x7F\x80') from system.numbers limit 10;

select 1 = isValidUTF8(toFixedString('\xF0\x90\xBF\x80', 4)) from system.numbers limit 10;

select 1 = isValidUTF8(toFixedString('\xc3\xb1', 2)) from system.numbers limit 10;

select 1 = isValidUTF8(repeat('a', 16) || '\xF0\x9F\x98\x80' || 'aa');

select str1, str2, CRC32(str1), CRC32(str2) from table1 order by CRC32(str1), CRC32(str2);

SELECT substringUTF8('hello, привет', 5) FROM numbers(3);

WITH IPv4CIDRToRange(toIPv4('192.168.0.0'), 0) as ip_range SELECT COUNT(*) FROM ipv4_range WHERE ip BETWEEN tupleElement(ip_range, 1) AND tupleElement(ip_range, 2);

WITH IPv6CIDRToRange(IPv6StringToNum('2001:0db8:0000:85a3:0000:0000:ac1f:8001'), 64) as ip_range SELECT COUNT(*) FROM ipv6_range WHERE ip BETWEEN tupleElement(ip_range, 1) AND tupleElement(ip_range, 2);

INSERT INTO nullt VALUES (1, 'abc'), (2, NULL), (NULL, NULL);

SELECT a, b, c FROM pk_order ORDER BY a DESC, b DESC, c DESC;

-- Exact match, mixed direction
select * from tab order by (a + b) * c desc, sin(a / b);

select * from (select *, a + b as x, a / b as y from tab) order by x * c, sin(y);

-- Union with limit
select * from (select * from tab union all select * from tab5) order by (a + b) * c, sin(a / b) limit 3;

-- toStartOfWeek
WITH
    toDate('2018-12-25') + number AS d,
    toDate32(d) AS d32,
    toDateTime(d) AS dt,
    toDateTime64(d, 0) AS dt64
SELECT
    dt64,
    toStartOfWeek(d) AS wd_sun,
    toStartOfWeek(d32) AS wd32_sun,
    toStartOfWeek(dt) AS wdt_sun,
    toStartOfWeek(dt64) AS wdt64_sun,
    toStartOfWeek(d, 1) AS wd_mon,
    toStartOfWeek(d32, 1) AS wd32_mon,
    toStartOfWeek(dt, 1) AS wdt_mon,
    toStartOfWeek(dt64, 1) AS wdt64_mon
FROM numbers(10);

SELECT count() FROM tab WHERE col <> nan;

DROP TABLE IF EXISTS single_column_bloom_filter;

SELECT COUNT() FROM bloom_filter_types_test WHERE i8 = 1 SETTINGS max_rows_to_read = 6;

SELECT COUNT() FROM bloom_filter_array_types_test WHERE has(u32, 1);

SELECT COUNT() FROM bloom_filter_array_types_test WHERE has(i64, 10);

SELECT COUNT() FROM bloom_filter_null_types_test WHERE date_time = toDateTime('1970-01-01 02:00:01', 'Asia/Istanbul') SETTINGS max_rows_to_read = 6;

SELECT COUNT() FROM bloom_filter_lc_null_types_test WHERE isNull(fixed_string);

SELECT COUNT() FROM bloom_filter_array_lc_null_types_test WHERE has(u8, 5);

SELECT COUNT() FROM bloom_filter_array_lc_null_types_test WHERE has(i64, NULL);

INSERT INTO bloom_filter_array_offsets_lc_str SELECT number AS i, if(i%2, ['value'], []) FROM system.numbers LIMIT 10000;

SELECT id FROM test_bf_indexOf WHERE indexOf(ary, 'value3') = 2 ORDER BY id FORMAT TSV;

SELECT id FROM test_bf_indexOf WHERE indexOf(ary, 'value1') < toDecimal128(1, 2) ORDER BY id FORMAT TSV;

DROP TABLE grouptest;

select toValidUTF8('\xf0\x28\x8c\xbc') from system.numbers limit 10;

select toValidUTF8('\xF4\x90\x88\xAA') from system.numbers limit 10;

select 1 = isValidUTF8(toValidUTF8('\xc3\xb1')) from system.numbers limit 10;

select 1 = isValidUTF8(toValidUTF8('\xE0\x9F\x80')) from system.numbers limit 10;

--(1, lower(replaceAll(_STR_1, 'o', 'a')), _NUM_1 + _NUM_2 + _NUM_3, round(_NUM_4 / _NUM_5), _NUM_6 * CAST(_STR_7, 'Int8'), _ARR_8);
-- _NUM_1: UInt64 -> Int64 -> UInt64
-- _NUM_4: Int64 -> UInt64
-- _NUM_5: Float64 -> Int64
INSERT INTO values_template VALUES ((1), lower(replaceAll('Hella', 'a', 'o')), 1 + 2 + 3, round(-4 * 5.0), nan / CAST('42', 'Int8'), reverse([1, 2, 3])), ((2), lower(replaceAll('Warld', 'a', 'o')), -4 + 5 + 6, round(18446744073709551615 * 1e-19), 1.0 / CAST('0', 'Int8'), reverse([])), ((3), lower(replaceAll('Test', 'a', 'o')), 3 + 2 + 1, round(9223372036854775807 * -1), 6.28  / CAST('2', 'Int8'), reverse([4, 5])), ((4), lower(replaceAll('Expressians', 'a', 'o')), 6 + 5 + 4, round(1 * -9223372036854775807), 127.0 / CAST('127', 'Int8'), reverse([6, 7, 8, 9, 0]));

SELECT OperatingSystem FROM test_generic_events_all WHERE APIKey = 42;

select 'dictGet', 'complex_cache_ints' as dict_name, tuple(toUInt64(1)) as k,
    dictGet(dict_name, 'i8', k),
    dictGet(dict_name, 'i16', k),
    dictGet(dict_name, 'i32', k),
    dictGet(dict_name, 'i64', k),
    dictGet(dict_name, 'u8', k),
    dictGet(dict_name, 'u16', k),
    dictGet(dict_name, 'u32', k),
    dictGet(dict_name, 'u64', k),
    dictGet(dict_name, ('i8', 'i16', 'i32'), k);

select 'dictGet', 'complex_hashed_decimals' as dict_name, tuple(toUInt64(1)) as k,
    dictGet(dict_name, 'd32', k),
    dictGet(dict_name, 'd64', k),
    dictGet(dict_name, 'd128', k),
    dictGet(dict_name, ('d32', 'd64', 'd128'), k);

SELECT
    key,
    ref_valueI8, valueI8, ref_valueI8 - valueI8 as dI8
FROM codecTest
WHERE
    dI8 != 0
LIMIT 10;

select round(1000 * ngramSearchUTF8(materialize('абвгдеёжз'), 'абвгдеёжз')) from system.numbers limit 5;

insert into test_entry_distance values ('привет как дела?... Херсон'), ('привет как дела клип - TUT.BY'), ('привет'), ('пап привет как дела - TUT.BY'), ('привет братан как дела - TUT.BY'), ('http://metric.ru/'), ('http://autometric.ru/'), ('http://top.bigmir.net/'), ('http://metris.ru/'), ('http://metrika.ru/'), ('');

select round(1000 * ngramSearchCaseInsensitiveUTF8('', materialize('абв'))) = round(1000 * ngramSearchCaseInsensitiveUTF8(materialize(''), 'абв')) from system.numbers limit 5;

select round(1000 * ngramSearch(materialize('abcdefgh'), 'abcdefg')) from system.numbers limit 5;

SELECT Title, round(1000 * distance) FROM test_entry_distance ORDER BY ngramSearch(Title, 'metrica') as distance, Title;

select round(1000 * ngramSearchCaseInsensitive('', 'abc'));

--
-- distributed_foreground_insert=1
--
SELECT 'distributed_foreground_insert=1';

DROP TABLE moving_sum_dec;

SELECT '===test alter===';

CREATE TABLE mt_with_small_granularity (
  d Date DEFAULT '2000-01-01',
  x DateTime,
  y Array(UInt64),
  z UInt64,
  n Nested (Age UInt8, Name String),
  w Int16 DEFAULT 10
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(d) ORDER BY (x, z) SETTINGS index_granularity_bytes=30, min_index_granularity_bytes=20, write_final_mark=1;

select  if(number > 1, number, null) as value, number as offset, neighbor(value, offset) as neighbor from numbers(3);

SET check_query_single_value_result = 0;

INSERT INTO t_enum16 Values('hello'),('world'),('hello');

SELECT JSONLength('{"success"test:"123"}');

DROP TABLE IF EXISTS ColumnsClauseTest;

SELECT roundDuration(1200);

SELECT arraySort(geohashesInBox(-180.0, -90.0, -179.0, -89.0, 3));

SELECT arraySort(geohashesInBox(20.0, 20.0, 20.00001, 20.00001, 10));

DROP TABLE part_a;

CREATE TABLE source_table2 (c Int64, d String) ENGINE = Memory;

insert into t3 values (3);

SELECT CAST(Null AS LowCardinality(Nullable(String)));

DROP TABLE IF EXISTS test_move_partition_dest;

SELECT * FROM VALUES('a UInt64, s String', (1, 'one'), (2, 'two'), (3, 'three'));

SELECT intDiv(toInt32(number), -1) FROM numbers(1, 10);

select t.*, s.* from t left join s on (s.a = t.a and s.b = t.b);

insert into set_index_not values ('Jon','alive'),('Ramsey','rip');

select arrayReduce('median', [toDecimal128OrNull('1', 2)]);

CREATE TABLE table_for_reset_setting (
 id UInt64,
 Data String
) ENGINE = MergeTree() ORDER BY id SETTINGS index_granularity=4096, index_granularity_bytes = '10Mi';

ALTER TABLE replicated_table_for_alter1 MODIFY SETTING use_minimalistic_part_header_in_zookeeper = 1;

ALTER TABLE replicated_table_for_reset_setting2 RESET SETTING merge_with_ttl_timeout;

CREATE TABLE test2 (c UInt8, d String) ENGINE MergeTree ORDER BY c;

SYSTEM SYNC REPLICA replicated_constraints1;

select currentUser() = user(), currentUser() = USER(), current_user() = currentUser();

-- AST fuzzer crash, issue #54541
CREATE TABLE tab (row_id UInt32, str String, INDEX idx str TYPE tokenbf_v1(256, 2, 0)) ENGINE = MergeTree ORDER BY row_id;

DROP TABLE IF EXISTS ties;

SELECT number, neighbor(toString(number), 5, 'Hello') FROM numbers(10);

DROP TABLE set_array;

SELECT bar.a FROM (SELECT 1 AS a, 2 AS b) AS foo RIGHT JOIN (SELECT 1 AS a, 2 AS b) AS bar ON (foo.b = bar.a) AND (foo.b = bar.b) ORDER BY bar.a;

DROP TABLE r;

INSERT INTO ttl_with_default VALUES (now() - 1000, 1) (now() - 1000, 2) (now() + 1000, 3)(now() + 1000, 4);

CREATE TABLE test_insert_t1 (`dt` Date, `uid` String, `name` String, `city` String) ENGINE = MergeTree PARTITION BY toYYYYMMDD(dt) ORDER BY name SETTINGS index_granularity = 8192;

SELECT * FROM t1 ANY LEFT JOIN t0 ON t1.x = t0.x ORDER BY x;

SELECT t1.*, t2.* FROM t1 LEFT JOIN t2 ON t1.x = t2.x AND toUInt64(t1.x) = intDiv(t2.y,10) ORDER BY x, t2.y;

SELECT * FROM t0 SEMI LEFT JOIN t1 USING (x);

DROP TABLE as_foo;

SELECT hex(1e+18);

CREATE TABLE new_table_test(name String) ENGINE = MergeTree ORDER BY name;

SELECT arraySplit(x -> x % 2 = 1, [1]);

-- Tag no-cpu-ppc64le: Depending on the target platform, CRC32C function returns different hash values. So, should not run on PowerPC. Whenever a new test gets added here, same has to be updated in 01016_simhash_minhash_ppc.sql
 
SELECT ngramSimHash('');

SELECT wordShingleSimHashCaseInsensitiveUTF8(s) FROM defaults;

SELECT arrayStringConcat(groupArray(s), '\n:::::::\n'), count(), wordShingleSimHashCaseInsensitiveUTF8(s, 2) as h FROM defaults GROUP BY h ORDER BY h;

SELECT bitHammingDistance(n3, n4) FROM defaults;

-- Tag no-tsan: Fine thresholds on memory usage
-- Tag no-asan: Fine thresholds on memory usage
-- Tag no-msan: Fine thresholds on memory usage

-- each uniqCombined state should not use > sizeof(HLL) in memory,
-- sizeof(HLL) is (2^K * 6 / 8)
-- hence max_memory_usage for 100 rows = (96<<10)*100 = 9830400

SET use_uncompressed_cache = 0;

DROP TABLE IF EXISTS mem3;

SELECT _shard_num, key FROM dist_2 order by _shard_num, key;

SELECT * from one A
JOIN system.one one ON A.dummy = one.dummy
JOIN system.one two ON A.dummy = two.dummy
FORMAT PrettyCompact;

SELECT database, name FROM system.dictionaries WHERE database='memory_db' AND name LIKE 'dict2';

-- NOTE: database = currentDatabase() is not mandatory
SELECT name, engine FROM system.tables WHERE database = {CLICKHOUSE_DATABASE:String} ORDER BY name;

SELECT dictGetFloat64({CLICKHOUSE_DATABASE:String} || '.dict2', 'Tax', toUInt64(1), toDateTime('2019-05-15 00:00:00'));

CREATE DICTIONARY {CLICKHOUSE_DATABASE_1:Identifier}.dict4
(
  key_column UInt64 DEFAULT 0,
  second_column UInt8 DEFAULT 1,
  third_column String DEFAULT 'qqq',
  fourth_column Float64 DEFAULT 42.0
)
PRIMARY KEY key_column
SOURCE(CLICKHOUSE(HOST 'localhost' PORT tcpPort() USER 'default' TABLE 'non_existing_table' DB currentDatabase()))
LIFETIME(0)
LAYOUT(HASHED());

SELECT arrayReduce('maxOrDefault', [1]);

SELECT arrayReduce('maxOrNull', ['hello']);

SELECT 9 == dictGetUInt32({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'asn', tuple(IPv4StringToNum('255.128.0.0')));

SELECT 1272 == dictGetUInt32({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'asn', tuple(IPv4StringToNum('127.0.0.2')));

SELECT 0 == dictGetUInt32({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'val', tuple(IPv4StringToNum('192.0.0.0')));

SELECT 24 == dictGetUInt32({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'val', tuple(IPv4StringToNum('255.255.255.248')));

SELECT '127.0.0.0/24' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'prefix', tuple(IPv4StringToNum('127.0.0.0')));

SELECT 18 == dictGetUInt32({CLICKHOUSE_DATABASE:String} || '.dict_ipv4_trie', 'val', tuple(IPv6StringToNum('::ffff:7fff:800a')));

SELECT 1 == dictHas({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', tuple(IPv6StringToNum('2001:db8:ffff:ffff::')));

SELECT '14' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('fffc::')));

SELECT '41' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ff80::')));

SELECT '68' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff:f000::')));

SELECT '95' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff:ffff:fffe::')));

SELECT '122' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffc0')));

SELECT '5' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('fc00::')));

SELECT '24' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:e000::')));

SELECT '49' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff::')));

SELECT '49' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff:ffff:ffe0::')));

SELECT '99' == dictGetString({CLICKHOUSE_DATABASE:String} || '.dict_ip_trie', 'val', tuple(IPv6StringToNum('ffff:ffff:ffff:ffff:ffff:ffff:ffff:fe00')));

SELECT _id FROM TESTTABLE4 PREWHERE l IN (select '1') ORDER BY _id DESC LIMIT 10;

INSERT INTO src_01019 VALUES (1), (2), (3);

SELECT * FROM mv_extra_columns_dst ORDER by v;

ALTER TABLE test ATTACH PARTITION tuple();

SELECT arrayCompact([1, 1, nan, nan, 2, 2, 2]);

EXPLAIN SYNTAX SELECT 1 WHERE NOT ignore();

select count() from tst final prewhere val>0;

create table test_table_url(id UInt32) ENGINE = URL('http://localhost/endpoint', 'JSONEachRow', 'gz');

SELECT t1.*, t2.* FROM t2 ANY RIGHT JOIN t1 USING(x) ORDER BY t1.x, t2.x;

CREATE TABLE sometable (
    date Date,
    time Int64,
    value UInt64
) ENGINE=MergeTree()
ORDER BY time;

SELECT substring(e8, -2, 10), substring (e16, -2, 10) FROM tab;

INSERT INTO tab VALUES ('abcdefgh', 2, -2), ('12345678', 3, -3);

SELECT substringUTF8(materialize('café au lait'), -15, 5);

/* Check input_format_null_as_default = 1 */
SET input_format_null_as_default = 1;

INSERT INTO test_table SELECT number, toString(number) FROM system.numbers LIMIT 100;

SELECT avg(i8), avg(i16), avg(i32), avg(i64), avg(i128), avg(i256),
       avg(u8), avg(u16), avg(u32), avg(u64), avg(u128), avg(u256),
       avg(f32), avg(f64),
       avg(d32), avg(d64), avg(d128), avg(d256) FROM test_01035_avg;

CREATE DATABASE `foo 123`;

SET max_memory_usage = '12M';

SELECT h3IsValid(581276613233082367);

INSERT INTO h3_indexes VALUES (604296355086598143,7);

INSERT INTO {CLICKHOUSE_DATABASE:Identifier}.dicttbl VALUES (12, 'hello', '55:66:77');

SELECT arrayZip();

SELECT count(1) FROM remote('127.0.0.{1,1,2}', currentDatabase(), test_count);

-- wait for DELETE
SELECT sleep(1);

DROP TABLE IF EXISTS Beta;

SELECT is_done FROM system.mutations where database = currentDatabase() and table = 'table_for_synchronous_mutations_no_replication';

DROP TABLE IF EXISTS tbl;

CREATE TABLE t1 (x UInt32, str String) engine = Memory;

SELECT 'full (join_use_nulls)';

SELECT * FROM t1 ANY LEFT JOIN any_left_join j USING(x) ORDER BY x, str, s;

SELECT 1
 WHERE 0=(SELECT number FROM numbers(2) ORDER BY number LIMIT 1)
   AND 1=(SELECT number FROM numbers(2) ORDER BY number DESC LIMIT 1);

insert into test_01054_overflow.ints values (14, 14, 14, 14, 14, 14, 14, 14, 14);

show create table mt_compact;

-- view
CREATE VIEW v AS SELECT * FROM t1;

INSERT INTO test VALUES (-1, -1, -1, -1);

EXPLAIN SYNTAX SELECT ts AS `--a.ts`, id AS `--a.id`, id_b AS `--a.id_b`, b.ts AS `--b.ts`, b.id AS `--b.id`, id_c AS `--b.id_c` FROM (SELECT ts, id, id_b FROM A) AS a ALL LEFT JOIN B AS b ON `--b.id` = `--a.id_b` WHERE `--a.ts` <= toDateTime('1970-01-01 03:00:00');

-- Tag no-replicated-database: Old syntax is not allowed
-- no-shared-merge-tree: old syntax not allowed

DROP TABLE IF EXISTS test_alter_on_mutation;

SET joined_block_split_single_row = 0;

select arrayROCAUC(cast([-10, -40, -35, -80] as Array(Int8)), [0, 0, 1, 1]);

select arrayROCAUC([0.1, 0.4, 0.35, 0.8], cast(['false', 'false', 'true', 'true'] as Array(Enum8('false' = -1, 'true' = 1))), false);

select arrayROCAUC([0.1, 0.35, 0.4, 0.8], [1, 0, 1, 0], true, [0, 0, 0, 0]);

select '-- merged state';

SELECT arrayZip([1, number, number * number], [[], [], []]) FROM numbers(10);

((((((((((((((SELECT((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))))));

SELECT * FROM mv ORDER BY a;

SELECT h3IndexesAreNeighbors(617420388351344639, 617420388351344639);

select '=============';

select '===================';

set force_optimize_skip_unused_shards=2;

CREATE TEMPORARY TABLE table_to_drop(x Int8);

create table dist_01072 (key Int, value Nullable(Int), str String) Engine=Distributed(test_cluster_two_shards, currentDatabase(), data_01072, key%2);

select 'Nullable(UInt64)', blockSerializedSize(toNullable(0xdeadbeafdead));

SELECT 'C';

SHOW TABLES LIKE 'tes%1';

SELECT '--grant option 1';

DROP USER test_user_01075;

create table t50 (a Int, b Int, s String) engine = MergeTree order by a settings index_granularity = 50, index_granularity_bytes=1000, min_index_granularity_bytes=500;

-- sleep a bit to wait possible merges after insert

set max_threads = 1;

SELECT IPv6NumToString(bitNot(IPv6StringToNum('2001:0db8:85a3:8d3a:b2da:8a2e:0370:7334'))) FROM system.numbers LIMIT 10;

CREATE TABLE A1( a DateTime ) ENGINE = MergeTree ORDER BY tuple();

SELECT '-- bitTest';

DROP TABLE IF EXISTS merge_tf;

SHOW CREATE dict;

SELECT 'TP4';

-- important to check without WHERE

ALTER TABLE table_with_defaults_on_aliases ADD COLUMN col4 UInt64 DEFAULT col2 * col3;

SELECT
    ui64, i64,
    ui32, i32,
    ui16, i16,
    ui8, i8
FROM generateRandom('ui64 UInt64, i64 Int64, ui32 UInt32, i32 Int32, ui16 UInt16, i16 Int16, ui8 UInt8, i8 Int8', 1, 10, 10)
LIMIT 10;

SELECT
  toTypeName(i)
FROM generateRandom('i Array(String)')
LIMIT 1;

CREATE TABLE mutations_and_quorum2 (`server_date` Date, `something` String) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/test_01090/mutations_and_quorum', '2') PARTITION BY toYYYYMM(server_date) ORDER BY (server_date, something);

SELECT count() FROM numbers_mt(1000000000);

select
    o_orderpriority,
    count(*) as order_count
from
    orders
where
    o_orderdate >= date '1993-07-01'
    and o_orderdate < date '1993-07-01' + interval '3' month
    and exists (
        select
            *
        from
            lineitem
        where
            l_orderkey = o_orderkey
            and l_commitdate < l_receiptdate
    )
group by
    o_orderpriority
order by
    o_orderpriority;

select 22;

DROP TABLE IF EXISTS table_with_cyclic_defaults;

select (toDate32('2001-09-29') + interval 12345 second) x, toTypeName(x);

CREATE TABLE distributed_01099_b AS local_01099_b ENGINE = Distributed('test_cluster_two_shards_localhost', currentDatabase(), local_01099_b, rand());

INSERT INTO TABLE FUNCTION clusterAllReplicas('test_shard_localhost', currentDatabase(), 'distributed_01099_c') (n) SELECT number FROM remote('localhost', numbers(5)) tx;

-- https://github.com/ClickHouse/ClickHouse/issues/20624
select 2 as `toString(x)`, x from (select 1 as x);

DROP TABLE IF EXISTS t2_distr;

SELECT 'local_1', toUInt8(1) AS dummy FROM system.one AS o WHERE o.dummy = 1;

SELECT arrayJoin(CAST(['hello', 'world'] AS Array(FixedString(5)))) LIKE '%w%ld%';

SELECT arrayJoin(['hello', 'world']) LIKE '%hello';

SELECT arrayJoin(['hello', 'world']) LIKE '%o%l%';

SELECT CAST('hello' AS FixedString(5)) LIKE '%w__ld%';

SELECT *
FROM (SELECT item_id FROM t) l
RIGHT JOIN (SELECT item_id FROM t GROUP BY item_id WITH TOTALS ORDER BY item_id ) r
ON l.item_id = r.item_id;

CREATE TABLE t0 ENGINE=Log() AS SELECT * FROM system.numbers limit 2;

DROP TABLE check_table_with_indices;

ALTER TABLE minmax_compact CLEAR INDEX idx IN PARTITION 2;

SELECT * FROM (SELECT number AS key FROM numbers(5)) s1 LEFT JOIN dict_hashed d ON s1.key = d.key ORDER BY s1.key;

SELECT * FROM (SELECT number AS key FROM numbers(2)) s1 ANTI RIGHT JOIN dict_flat d USING(key) ORDER BY key;

SELECT *
FROM numbers(2) AS n1, numbers(3) AS n2
RIGHT JOIN numbers(4) AS n3 ON n2.number = n3.number
ORDER BY n1.number, n2.number, n3.number;

create user 'test 01119';

INSERT INTO date_table VALUES(1, '1', toDate('2019-01-05'), toDate('2020-01-10'));

DROP TABLE IF EXISTS row_limits_test;

-- Test with max_rows_to_read_leaf - count() still bypasses via exact count optimization
SET max_rows_to_read = 0;

INSERT INTO default_table VALUES(1, 'index'), (2, 'fox');

CREATE TABLE pk_func(d DateTime, ui UInt32) ENGINE = SummingMergeTree ORDER BY toDate(d);

select * from (select 0 as k, toDecimal128(1, 0) as v) t1 asof join (select 0 as k, toDecimal128(0, 0) as v) t2 using(k, v);

SELECT x, lc, toTypeName(lc), r.lc, toTypeName(r.lc) FROM t AS l RIGHT JOIN nr AS r USING (lc) ORDER BY x;

CREATE TABLE t3 (id UInt32, value3 String) ENGINE MergeTree() ORDER BY id;

SELECT * FROM t0 FULL JOIN t1 USING (x);

SET distributed_ddl_output_mode='none';

select * from mt;

select count(), sum(n) from merge(currentDatabase(), 'src_table') where n % 2 = 0 and _table in tmp;

SELECT * FROM mv ORDER BY n;

SELECT dictGet('test_01155_ordinary.dict1', 'x', 'before moving tables');

SHOW CREATE DATABASE test_01155_atomic;

insert into buf values (3);

system flush logs aggregated_zookeeper_log;

INSERT INTO t3 SELECT quantileIfState(0.10)(number, number % 2) FROM numbers(100);

CREATE TABLE kcu1 (i UInt32, s String) ENGINE MergeTree ORDER BY i;

SELECT countSubstringsCaseInsensitiveUTF8(materialize('ссссссссссссссссссс'), 'ёёёёёёё');

create table rmt1 (d DateTime, n int) engine=ReplicatedMergeTree('/test/01165/{database}/rmt', '1') order by n partition by tuple();

insert into txn_counters(n) values (2);

insert into mt1 values (2);

drop table mt1;

SELECT count(), sum(toInt64(n)), max(n), min(n) FROM mv;

CREATE TABLE table2 AS numbers(5);

DROP DATABASE test_01191;

CREATE TABLE table_without_pk
(
  key1 UInt8,
  key2 UInt32,
  key3 DateTime64(6, 'UTC'),
  value String
)
ENGINE = MergeTree
ORDER BY tuple()
SETTINGS min_compress_block_size=65536, max_compress_block_size=65536;

SELECT arrayROCAUC([0, 1], [0, 1], true);

SELECT arrayROCAUC([0.9, 0.5, 0.1], [1, 0, 1]);

SELECT renamed_value2, renamed_value3 FROM table_for_rename WHERE key = 7;

CREATE TABLE table_for_rename_pk
(
  date Date,
  key1 UInt64,
  key2 UInt64,
  key3 UInt64,
  value1 String,
  value2 String
)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/test_01213/table_for_rename_pk1', '1')
PARTITION BY date
ORDER BY (key1, pow(key2, 2), key3);

-- check that without merge we will have two rows
SELECT 'distributed_group_by_no_merge';

SELECT pointInPolygon((39.840202, 21.451471), [(39.80999, 21.39018),(39.80983, 21.38939),(39.80816, 21.38343),(39.80609, 21.3751),(39.80867, 21.37472),(39.80969, 21.37875),(39.81147, 21.38151),(39.81202, 21.38214),(39.81339, 21.38345),(39.81628, 21.38612),(39.81677, 21.38646),(39.81575, 21.38713),(39.81478, 21.38799),(39.81395, 21.38898),(39.81265, 21.39076),(39.81228, 21.39111),(39.8121, 21.3912),(39.81181, 21.39121),(39.81033, 21.39058),(39.80999, 21.39018)]);

SELECT pointInPolygon((39.840202, 21.451471), [(39.88646, 21.39869),(39.89349, 21.39545),(39.8941, 21.39505),(39.89698, 21.39264),(39.89974, 21.3939),(39.89882, 21.39616),(39.89759, 21.39804),(39.8959, 21.40038),(39.89488, 21.40142),(39.89409, 21.40204),(39.89129, 21.40342),(39.88971, 21.40437),(39.88646, 21.39869)]);

DROP TABLE IF EXISTS tt4;

create table cdp_customers (mid String, mid_seq UInt32) engine=ReplacingMergeTree() order by (mid_seq);

select 'GROUP BY HAVING';

create table dist_layer_01223 as data_01223 Engine=Distributed(test_shard_localhost, currentDatabase(), data_01223);

-- Creation of a database with Ordinary engine emits a warning.
CREATE DATABASE dict_db_01225 ENGINE=Ordinary;

CREATE TABLE test_distributed as test_local
ENGINE = Distributed(test_shard_localhost, currentDatabase(), test_local);

INSERT INTO join_test (id, num) SELECT number, number FROM system.numbers LIMIT 1000;

set log_queries_min_type='EXCEPTION_WHILE_PROCESSING';

SELECT count() == 1 FROM null_in WHERE s global not in ('1', '3', NULL);

SELECT count() == 2 FROM null_in WHERE i global not in test_set2;

SELECT arraySort(x -> (x.1, x.2), groupArray(t)) == [(2, NULL), (NULL, '3'), (NULL, NULL)] FROM null_in_tuple WHERE t not in ((1, '1'), (NULL, NULL));

drop table if exists shard_0.num2_01232;

SELECT s FROM test2 WHERE toString(s) = '1234' SETTINGS max_rows_to_read = 2;

set enable_positional_arguments=0;

select 'LIMIT OFFSET';

select count(), * from dist_01247 group by number with totals order by number limit 1;

SELECT sum(s) FROM (SELECT sum(number) as s FROM remote('127.0.0.1', numbers(5)) with totals);

SELECT 'lots of matches';

SELECT least(1, inf, nan, NULL);

select 'Distributed(rand)-over-Distributed(number)';

SELECT dictIsIn('dictionary_with_hierarchy', toUInt64(11), materialize(toUInt64(22)));

SELECT 'Pacific/Fakaofo', rand() as r, toHour(toDateTime(r, 'Pacific/Fakaofo') AS t) AS h, t, toTypeName(t) FROM numbers(1000000) WHERE h < 0 OR h > 23 ORDER BY h LIMIT 1 BY h;

SELECT EXTRACT(TIMEZONE_HOUR FROM toDateTime('2025-06-15 12:00:00', 'Pacific/Kiritimati')), EXTRACT(TIMEZONE_MINUTE FROM toDateTime('2025-06-15 12:00:00', 'Pacific/Kiritimati'));

DROP TABLE IF EXISTS tutorial;

SELECT sumIf(DISTINCT number % 10, number % 5 = 2) FROM numbers(10000);

CREATE TABLE m
(
    `v` Enum8('a' = 1, 'b' = 2)
)
ENGINE = MergeTree()
PARTITION BY tuple()
ORDER BY v;

DROP TABLE test_alter;

WITH '2020-02-05 14:34:12.333' as S, toDateTime64(S, 3) as DT64 SELECT * WHERE S <= DT64;

CREATE TABLE database_for_dict_01268.table_for_dict2
(
  region_id UInt64,
  parent_region UInt64,
  region_name String
)
ENGINE = MergeTree()
ORDER BY region_id;

SELECT dictGetFloat32('db_01268.dict3', 'parent_region', toUInt64(3));

DROP VIEW IF EXISTS dst_mv_1;

SELECT avgWeighted(100., .1) FROM remote('127.0.0.{2,3}', currentDatabase(), dummy);

SELECT toTypeName(a), toTypeName(b), toTypeName(c), toTypeName(d), toTypeName(f) FROM set_null;

EXPLAIN SYNTAX SELECT min(n + 1), min(1 + n), min(n - 1), min(1 - n) FROM (SELECT number n FROM numbers(10));

EXPLAIN SYNTAX SELECT max(n*n * 2), max(2 * n*n), max(n*n / 2), max(1 / n*n) FROM (SELECT number n FROM numbers(10));

SELECT min(n + -1), min(-1 + n), min(n - -1), min(-1 - n) FROM (SELECT number n FROM numbers(10));

SELECT max(1 + n * 2), max(1 + 2 * n), max(1 + n / 2), max(1 + 1 / n) FROM (SELECT number n FROM numbers(10));

SELECT value FROM offset_without_limit ORDER BY value OFFSET 5;

SET allow_suspicious_codecs = 0;

ATTACH TABLE codecs5;

DROP TABLE codecs10;

CREATE TABLE visits_dist AS visits ENGINE Distributed(test_cluster_two_shards_localhost,  currentDatabase(), 'visits', rand());

INSERT INTO table_for_rename SELECT toDate('2019-10-01') + number % 3, number, toString(number), toString(number + 1), toString(number + 2) from numbers(9);

drop table mv_01277_2;

WITH
	'Asia/Makassar' as timezone,
	toDateTime64('2019-09-16 19:20:12.345678910', 3, timezone) AS dt64
SELECT
	dt64,
	fromUnixTimestamp64Milli(toUnixTimestamp64Milli(dt64), timezone),
	fromUnixTimestamp64Micro(toUnixTimestamp64Micro(dt64), timezone),
	fromUnixTimestamp64Nano(toUnixTimestamp64Nano(dt64), timezone) AS v,
	toTypeName(v);

SELECT varPop(0.1) BETWEEN 0 AND 1e-6 FROM numbers(1000000);

select minMap(val, cnt) from values ('val Array(DateTime(\'Asia/Istanbul\')), cnt Array(Int32)',  ([1], [1]), ([1], [2]));

SELECT count(nullIn(NULL, tuple(NULL)));

INSERT INTO rename_table_multiple_compact VALUES (1, 2, 3);

SELECT parseDateTime64BestEffort(materialize('2020-05-14T03:37:03.253184Z'), 3, 'UTC');

CREATE TABLE to_insert (value UInt64) ENGINE = Memory();

SELECT length(fuzzBits(randomString(100), 0.5));

SELECT groupArray(dt) from date_datetime_key_condition WHERE dt < toDate('2020-01-02');

SELECT count() FROM numbers(2000000);

SELECT '--- empty';

SELECT toString(d), avg(a) FROM pk_order GROUP BY toString(d) ORDER BY toString(d) LIMIT 5;

SHOW CREATE USER u3_01292;

SELECT '-- host';

ALTER USER u4_01292 DROP HOST NAME 'myhost.com';

CREATE USER u7_01292 SETTINGS max_memory_usage WRITABLE;

GRANT r1_01292 TO u1_01292;

SELECT name, if(storage = 'replicated', 'local_directory', storage), auth_type, auth_params, host_ip, host_names, host_names_regexp, host_names_like, default_roles_all, default_roles_list, default_roles_except FROM system.users WHERE name LIKE 'u%\_01292' ORDER BY name;

insert into data_01292 values (1);

CREATE ROLE r8_01293 SETTINGS max_memory_usage=5000000 MIN 4000000 MAX 6000000 CONST;

SELECT number FROM (SELECT number FROM system.numbers LIMIT 999990) ORDER BY number ASC LIMIT 100, 65535 SETTINGS max_bytes_before_external_sort = 1000000, max_bytes_ratio_before_external_sort = 0 format Null;

system start distributed sends dist_01293;

SHOW CREATE PROFILE s3_01294;

DROP SETTINGS PROFILE s1_01294;

-- just a smoke test

-- quirk for ON CLUSTER does not uses currentDatabase()
drop database if exists {CLICKHOUSE_DATABASE_1:Identifier};

CREATE ROW POLICY p1_01295 ON db.table USING a<b AND c>d;

SHOW CREATE POLICY p1_01295, p2_01295 ON db.table;

DROP POLICY p1_01296 ON table;

insert into data_01295 select * from data_01295;

CREATE QUOTA q1_01297;

SHOW CREATE QUOTA q8_01297;

CREATE QUOTA q2_01297 TO ALL;

DROP USER u1_01297;

DROP QUOTA IF EXISTS q5_01297;

CREATE QUOTA q8_01297 FOR INTERVAL 1 MINUTE MAX execution_time = ' 00k ';

SELECT '-- alter prefix bits on non-ip-keyed quota is rejected';

insert into merge_tree values (1, 'Hello, Alter Table!','2013-09-19', 1, 0, 2, '2013-09-19 12:43:06', 3);

SELECT readWKTPoint('POINT(0 0)');

SELECT SVG([[[(0., 0.), (10, 0), (10, 10), (0, 10)], [(4., 4.), (5, 4), (5, 5), (4, 5)]], [[(-10., -10.), (-10, -9), (-9, 10)]]], 'b');

SELECT wkt([[[(0., 0.), (10., 0.), (10., 10.), (0., 10.)], [(4., 4.), (5., 4.), (5., 5.), (4., 5.)]], [[(-10., -10.), (-10., -9.), (-9., 10.)]]]);

select polygonsWithinSpherical([[(29.453587685533865,59.779570356240356),(29.393139070478895,52.276266797422124),(40.636581470703206,59.38168915000267),(41.21084331372543,59.103467777099866),(29.786055068336193,52.146627480315004),(31.23682182965546,52.16517054781818),(41.69443223416517,58.85424941916091),(42.51048853740727,58.47703162291134),(32.59691566839227,52.22075341251539),(34.289476889931414,52.22075341251539),(43.02430176537451,58.07974369546071),(43.02430176537451,57.25537683364851),(35.468224883503325,52.2022335126388),(37.16078610504247,52.23926559241349),(43.02430176537451,56.26136189644947),(43.02430176537451,55.326904361850836),(38.33953409861437,52.16517054781818),(40.09254393520848,52.16517054781818),(44.4146199116388,55.3097062225408),(44.47506852669377,59.80998197603594),(39.72985224487867,59.931351417569715),(30.23941968124846,53.67744677450975),(30.20919537372098,54.63314259659509),(38.73245009647167,59.94649146557819),(37.2816833351524,59.97675082987618),(30.23941968124846,55.2752875586599),(30.33009260383092,56.19415599955667),(36.28428118674541,59.96162460231375),(34.863738732953635,59.97675082987618),(30.178971066193498,56.97640788219866),(30.178971066193498,57.91957806959033),(33.65476643185424,59.94649146557819),(32.32489690064491,59.94649146557819),(30.481214141468342,58.85424941916091),(30.571887064050795,59.99187015036608),(29.453587685533865,59.779570356240356)]], [[(24.367675781249993,61.45977057029751),(19.577636718749993,58.67693767258692),(19.577636718749993,57.492213666700735),(19.445800781249996,55.87531083569678),(19.445800781249996,54.085173420886775),(17.468261718749996,53.014783245859235),(20.017089843749993,51.563412328675895),(21.203613281249993,50.205033264943324),(26.125488281249993,50.40151532278236),(27.22412109374999,48.980216985374994),(32.80517578124999,49.525208341974405),(35.26611328124999,48.74894534343292),(36.93603515624999,49.66762782262194),(42.56103515625,48.77791275550183),(43.92333984374999,49.8096315635631),(47.17529296875,49.152969656170455),(49.28466796875,50.54136296522162),(48.05419921875,51.17934297928929),(51.39404296875,52.48278022207825),(50.64697265625,53.014783245859235),(52.88818359375,53.93021986394004),(51.65771484374999,54.29088164657006),(52.66845703125,55.825973254619015),(50.25146484375,56.145549500679095),(51.92138671875,57.914847767009206),(49.15283203125,58.17070248348605),(49.59228515625,60.086762746260064),(47.043457031249986,59.88893689676584),(43.57177734375,61.37567331572748),(42.64892578125,60.630101766266705),(36.89208984374999,62.000904713685856),(36.01318359374999,61.143235250840576),(31.398925781249993,62.02152819100766),(30.563964843749996,61.05828537037917),(26.872558593749993,61.71070595883174),(26.652832031249993,61.10078883158897),(24.367675781249993,61.45977057029751)], [(24.455566406249993,59.42272750081452),(21.203613281249993,58.49369382056807),(21.335449218749993,56.89700392127261),(21.599121093749993,55.92458580482949),(25.202636718749993,55.998380955359636),(28.850097656249993,57.06463027327854),(27.09228515625,57.844750992890994),(28.806152343749996,59.17592824927138),(26.257324218749993,59.17592824927138),(24.455566406249993,59.42272750081452)], [(35.13427734375,59.84481485969107),(31.970214843749993,58.97266715450152),(33.20068359374999,56.776808316568406),(36.67236328125,56.41390137600675),(39.08935546874999,57.25528054528888),(42.69287109374999,58.03137242177638),(40.89111328124999,59.26588062825809),(37.28759765625,58.722598828043374),(37.11181640624999,59.66774058164964),(35.13427734375,59.84481485969107)], [(29.157714843749993,55.75184939173528),(22.565917968749993,55.128649068488784),(22.565917968749993,53.54030739150019),(22.038574218749996,51.48138289610097),(26.257324218749993,51.42661449707484),(30.124511718749993,50.54136296522162),(32.18994140624999,51.17934297928929),(30.124511718749993,53.173119202640635),(35.09033203124999,53.173119202640635),(33.11279296875,54.085173420886775),(29.597167968749993,55.50374985927513),(29.157714843749993,55.75184939173528)], [(42.82470703125,56.58369172128337),(36.584472656249986,55.329144408405085),(37.99072265625,53.592504809039355),(34.95849609374999,51.48138289610097),(36.54052734374999,50.40151532278236),(39.66064453124999,50.289339253291786),(39.79248046875,52.13348804077148),(41.77001953125,50.68079714532166),(44.49462890624999,51.97134580885171),(47.30712890624999,52.509534770327264),(44.05517578125,53.54030739150019),(46.60400390625,53.696706475303245),(47.61474609375,55.40406982700608),(45.37353515625,55.40406982700608),(42.82470703125,56.58369172128337)]]) format TSV;

insert into t_buf values (1);

SELECT polygonAreaCartesian([]);

select match('Too late', '(?i:too late)');

SELECT toDateTimeOrNull('<Empty>');

DROP TABLE IF EXISTS add_nested;

ALTER TABLE add_nested_exact_sno0 ADD COLUMN n String, ADD COLUMN IF NOT EXISTS n Nested(a UInt32, b String);

SELECT 'aes-192-cbc' as mode, decrypt(mode, encrypt(mode, input, key24, iv), key24, iv) == input FROM encryption_test;

SELECT 'aes-256-cbc' as mode, hex(aes_encrypt_mysql(mode, input, key32, iv)) FROM encryption_test;

WITH CAST('text' as Nullable(String)) as input, 'aes-256-ofb' as mode SELECT toTypeName(input), hex(aes_encrypt_mysql(mode, input, key32, iv)) FROM encryption_test LIMIT 1;

select mapSubtract(([1, 2], [toFloat32(1.1), 1]), ([1, 2], [2.2, 1])) as res, toTypeName(res);

-- mapSubtract, same rules as mapAdd
select mapSubtract(map(toUInt8(1), 1, 2, 1), map(toUInt8(1), 1, 2, 1)) as res, toTypeName(res);

select mapPopulateSeries([toInt32(-10), 2], [toInt32(1), 1]) as res, toTypeName(res);

DROP TABLE IF EXISTS distributed_table_2;

SELECT extract(message, 'SeL.+?;') FROM system.text_log WHERE event_date >= yesterday() AND event_time >= now() - 600 AND message LIKE '%SeLeCt \'ab\n%' and logger_name = 'executeQuery' ORDER BY event_time DESC LIMIT 1 FORMAT TSVRaw;

SELECT CAST(if(1 = 0, toNullable(toInt8(3)), NULL) AS Int32) as x, toTypeName(x);

SELECT if(toUInt8(1), NULL, toNullable(toUInt8(0))) AS x, if(x = 0, 'fail', 'ok');

SELECT groupArray(x) from (SELECT number as x FROM numbers(3) ORDER BY x, exp(x));

set max_threads = 16;

SELECT CAST('1.1234511111' AS Decimal(10, 5));

select * from numbers(1) t1 any right join numbers(1) t2 using number;

SELECT toDateTime64('2011-11-11 11:11:11.11', 0);

SELECT ProfileEvents['CreatedReadBufferMMap'] AS value FROM system.query_log WHERE current_database = currentDatabase() AND event_date >= yesterday() AND event_time >= now() - 300 AND query LIKE 'SELECT * FROM test_01343%' AND type = 2 ORDER BY event_time DESC LIMIT 1;

DROP TABLE IF EXISTS test2 SYNC;

select intDiv(-9223372036854775808, -1);

select tuple(number) > tuple(toNullable(number + 1)) from numbers(1);

select '- 4';

select tuple(materialize(toUInt64OrNull('')), number) = tuple(number, toUInt64OrNull('')) from numbers(1);

DROP TABLE IF EXISTS alter_01355;

SELECT 'Ohello' ILIKE '%hell%';

SELECT uniqMerge(state) FROM (SELECT initializeAggregation('uniqState', number % 3) AS state FROM system.numbers LIMIT 10000);

insert into constrained values ('a');

INSERT INTO expected_times VALUES('main_dashboard_top_query', 500), ('main_dashboard_bottom_query', 500);

SELECT formatDateTime(toDate('2010-01-03'), '%G');

SYSTEM START MERGES tt_01373;

CREATE TABLE table_csv_01375 AS tmp_01375 ENGINE = File(CSVWithNames);

SELECT NULL AND 0;

SELECT x FROM b UNION ALL SELECT x FROM c;

SELECT DISTINCT hex(toString(uniqState(x))) FROM (SELECT materialize(1) AS k, toNullable(1) AS x FROM numbers(1)) GROUP BY k WITH TOTALS ORDER BY k;

CREATE TABLE t0
(
    `c0` Int32,
    `c1` Int32 CODEC(NONE)
)
ENGINE = MergeTree()
ORDER BY tuple()
SETTINGS index_granularity = 8192;

ALTER TABLE test DROP COLUMN x, DROP COLUMN y SETTINGS mutations_sync = 2;

INSERT INTO t VALUES (0, 0);

select (1, 2) in array((1, 3), (1, 2));

-- executeConstStep()
SELECT range(number, 1048576 + 9223372036854775807, 9223372036854775807) FROM system.numbers LIMIT 1 OFFSET 1025;

DROP TABLE IF EXISTS nullable_minmax_index;

SELECT * FROM nullable_minmax_index WHERE v > 2 ORDER BY v, k;

select * from test_23634 where (id, s, s1) = ('', '', 's2') order by id, s1, s1;

SELECT FROM_UNIXTIME(toDateTime('2000-12-31 00:33:44'), '%j'), FROM_UNIXTIME(toDate32('2000-12-31'), '%j');

SELECT groupArrayMovingAvg(256)(1) FROM remote('127.0.0.{1,2}', numbers(1000));

DROP TABLE IF EXISTS non_metadata_alters;

ALTER TABLE non_metadata_alters MATERIALIZE STATISTICS key;

SELECT * FROM truncate_test ORDER BY uint8;

SELECT count() FROM lc_nullable WHERE has(i32, 1);

SELECT count() FROM lc_nullable WHERE has(i64, 5);

SELECT count() FROM lc_nullable WHERE has(i32, NULL);

DROP TABLE IF EXISTS mutation_table;

SELECT count(distinct key1) FROM table_with_pk_clear;

CREATE TABLE index_compact(a UInt32, b UInt32, index i1 b type minmax granularity 1)
    ENGINE = MergeTree ORDER BY a
    SETTINGS min_rows_for_wide_part = 1000, index_granularity = 128, merge_max_block_size = 100;

SELECT '1E-7' AS x, toDecimal32(x, 0);

SELECT a.pk, b.pk, a.dt, b.dt, toTypeName(a.pk), toTypeName(b.pk), toTypeName(materialize(a.dt)), toTypeName(materialize(b.dt))
FROM (SELECT toUInt8(number) > 0 as pk, toNullable(toUInt8(number)) as dt FROM numbers(3)) a
ASOF LEFT JOIN (SELECT 1 as pk, 2 as dt) b
ON a.pk = b.pk AND a.dt >= b.dt
ORDER BY a.dt;

DETACH TABLE modify_sample_replicated;

SELECT ignore(lcm(-256, -9223372036854775807));

select (toInt128(-1) - toUInt64(1)) x, (toInt256(-1) - toUInt64(1)) y, toTypeName(x), toTypeName(y);

select (toInt128(-1) / toInt16(-1)) x, (toInt256(-1) / toInt16(-1)) y, toTypeName(x), toTypeName(y);

SELECT toFloat64(number * number) * -1 y, toDecimal32(y, 1), toDecimal64(y, 2), toDecimal128(y, 6), toDecimal256(y, 7) FROM numbers_mt(10) ORDER BY number;

DROP TABLE IF EXISTS tdm2;

SELECT count() FROM t_01411_num WHERE has(arr, 42);

SELECT parseDateTimeBestEffort('Dec 15, 2021') AS a, toTypeName(a);

SELECT parseDateTimeBestEffortOrZero('2020-05-14 12:37:03 PM', 3, 'UTC') AS a, toTypeName(a);

SELECT parseDateTime32BestEffortOrNull('2020-05-14 03:37:03', 'UTC') AS a, toTypeName(a);

SELECT h3kRing(581276613233082367, nan);

DROP TABLE IF EXISTS test_mtree;

SELECT normalizeQuery('SELECT 1, 1, 1, /* Hello */ \'abc\' WHERE 1');

SELECT normalizeQuery('-1, +2, 3');

SELECT COUNT() FROM replica1;

SELECT normalizedQueryHash('SELECT 1 AS `xyz`') != normalizedQueryHash('SELECT 1 AS `abc`');

-- For trivial INSERT SELECT, max_threads is lowered to max_insert_threads and max_block_size is changed to min_insert_block_size_rows.
SET optimize_trivial_insert_select = 1;

SELECT count() FROM (SELECT * FROM test_distributed) SETTINGS max_rows_to_read_leaf = 60000;

INSERT INTO tbl SELECT number, number * 2, number * 3, number * 4, number * 5 FROM system.numbers LIMIT 10;

SELECT * FROM tbl FORMAT TabSeparatedWithNamesAndTypes;

SELECT toUInt256(123) AS k GROUP BY k;

SELECT COUNT(*) from valid_min_index_granularity_bytes_setting WHERE value = 'xxxxxxxxxx1015';

SELECT
    diff,
    traf
FROM order_by_nulls_first
ORDER BY
    diff DESC NULLS LAST,
    traf ASC;

SELECT isDecimalOverflow(toDecimal64(1000000000000000000, 0), 18),
       isDecimalOverflow(toDecimal64(1000000000000000000, 0)),
       isDecimalOverflow(toDecimal64(-1000000000000000000, 0), 18),
       isDecimalOverflow(toDecimal64(-1000000000000000000, 0));

SELECT toInt32(toDecimal64(number, 2)), toInt64(toDecimal64(number, 2)), toInt128(toDecimal64(number, 2)) FROM numbers(10, 1);

DROP TABLE IF EXISTS compression_codec_on_alias;

SYSTEM STOP TTL MERGES recompression_table_compact;

EXPLAIN SYNTAX SELECT a.* APPLY(toDate) APPLY(any) from columns_transformers a;

CREATE TABLE columns_transformers (i int, j int, k int, a_bytes int, b_bytes int, c_bytes int) Engine=TinyLog;

ALTER TABLE table_for_ttl MODIFY COLUMN value String TTL d + INTERVAL 1 DAY SETTINGS materialize_ttl_after_modify = 0;

-- Tag no-llvm-coverage: `SYSTEM FLUSH LOGS` on `metric_log`, `trace_log`, `query_log`, and
-- `query_thread_log` becomes unreliable under LLVM source-based coverage instrumentation;
-- flushing `trace_log` alone can exceed the 180s server-side timeout. Same pattern as
-- other query-profiler-dependent tests (`00974_query_profiler`, `01569_query_profiler_big_query_id`).

-- This file contains tests for the event_time_microseconds field for various tables.
-- Note: Only event_time_microseconds for asynchronous_metric_log table is tested via
-- an integration test as those metrics take 60s by default to be updated.
-- Refer: tests/integration/test_asynchronous_metric_log_table.

SET log_queries = 1;

SELECT toDecimal32(1, 2) * toDecimal128(1, 3) x, toTypeName(x);

alter table mutation_table update dt = toDateOrNull('2020-08-02')
where name = 'car' SETTINGS mutations_sync = 2;

SELECT ProfileEvents['FileOpen']
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND (type = 'QueryFinish') AND (lower(query) LIKE lower('SELECT n.null FROM %t_nul%'))
    AND current_database = currentDatabase();

INSERT INTO null_subcolumns VALUES (1, 'foo') (2, NULL) (3, NULL) (4, 'abc');

SELECT t.x, l.s, r.s, toTypeName(l.s), toTypeName(r.s) FROM nr AS l RIGHT JOIN t AS r USING (x) ORDER BY t.x;

INSERT INTO binary_op_mono8 VALUES (1, 1), (10000, 2);

CREATE TABLE a (key UInt32) ENGINE = MergeTree ORDER BY key;

SELECT /*a/*b*/c*/ 1;

SYSTEM START TTL MERGES prop_table;

INSERT INTO r_prop_table1 (column_codec, column_comment, column_ttl) VALUES ('rts', now() - INTERVAL 1 YEAR, 3);

CREATE TABLE test1(i int, j int) ENGINE Log;

with
    test1 as (select n, null b, n+1 m from with_test where  n = 42 order by n limit 4),
    test2 as (select n + 1 as x, n - 1 as y from test1),
    test3 as (select x * y as z from test2)
select z + 1 as q from test3;

create table test1 (i Int64) engine MergeTree order by i;

CREATE TABLE {CLICKHOUSE_DATABASE_1:Identifier}.table_cache_dict(
KeyField UInt64,
UInt8_ UInt8,
UInt16_ UInt16,
UInt32_ UInt32,
UInt64_ UInt64,
Int8_ Int8,
Int16_ Int16,
Int32_ Int32,
Int64_ Int64,
UUID_ UUID,
Date_ Date,
DateTime_ DateTime,
String_ String,
Float32_ Float32,
Float64_ Float64,
Decimal32_ Decimal32(5),
Decimal64_ Decimal64(15),
Decimal128_ Decimal128(35),
ParentKeyField UInt64)
ENGINE = MergeTree() ORDER BY KeyField;

INSERT INTO test SELECT toString(intDiv(number, 8)) FROM numbers(100);

INSERT INTO columns_with_multiple_streams_compact VALUES(3, 3, [[3]], tuple(3, [3]));

SELECT k == 4 FROM 01504_test WHERE k = 4 OR k IN [4] OR k in (4, 10000001, 10000002) AND value > 0;

select count() FROM test1 where toDate(p) = '2020-09-01' and sipHash64(toString(toDate(p))) % 2 = 0;

DROP TABLE IF EXISTS derived_metrics_local;

SELECT (1, 2) IN ((1, NULL), (1, 2));

-- Tag no-replicated-database: Fails due to additional replicas or shards
-- no-shared-merge-tree: depend on tricks with quorum inserts for replicated mt


DROP TABLE IF EXISTS r1 SYNC;

SELECT 'insert happened';

INSERT INTO TABLE table_with_version_replicated_1 VALUES(3, '3', 65555, -1);

CREATE TABLE quorum1(x UInt32, y Date) ENGINE ReplicatedMergeTree('/clickhouse/tables/{database}/test_01513/sequence_consistency', '1') ORDER BY x PARTITION BY y;

SELECT 'hello' like 'hell%';

INSERT INTO table_with_enum_column_for_json_insert FORMAT JSONEachRow {"Id":102,"Value":2}

SELECT * FROM table_with_enum_column_for_json_insert;

DROP TABLE data_01515;

DROP TABLE primary_key_test;

-- ensure that the inner had been removed after sync drop
drop table db_01517_atomic.source sync;

SELECT database AS db FROM system.tables WHERE db LIKE '%' format Null;

select ' ---- select with states ---- ';

DROP TABLE IF EXISTS enum_test;

SELECT formatReadableTimeDelta(0x1000000000000000);

SELECT * FROM test WHERE '2020-10-15' < timestamp ORDER BY timestamp;

SELECT DATE_ADD(hour, (SELECT 1), toDateTime(1234567890, 'UTC'));

CREATE TABLE table_for_alter
(
    `d` Date,
    `a` String,
    `b` UInt8,
    `x` String,
    `y` Int8,
    `version` UInt64,
    `sign` Int8 DEFAULT 1
)
ENGINE = ReplicatedVersionedCollapsingMergeTree('/clickhouse/tables/{database}/01526_alter_add/t1', '1', sign, version)
PARTITION BY y
ORDER BY d
SETTINGS index_granularity = 8192;

drop table db_01527_ranges.data sync;

SELECT toUUIDOrZero('59f0c404-5cb3-11e7-907b-a6006ad3dba0T');

create table {CLICKHOUSE_DATABASE_1:Identifier}.data (key Int) Engine=ReplicatedMergeTree('/clickhouse/tables/{database}/db_01530_atomic/data', 'test') order by key;

SELECT * FROM test_collate_null ORDER BY x, s COLLATE 'ru';

SELECT '*** queue unfreeze';

CREATE TABLE merge_tree_pk
(
    key UInt64,
    value String
)
ENGINE = ReplacingMergeTree()
PRIMARY KEY key;

SELECT * FROM replicated_merge_tree_pk_sql ORDER BY key, value;

SELECT * FROM test_collate ORDER BY s COLLATE 'ru', x;

SELECT col2.a, col2.n, col2.n.s, col2.n.b FROM nested;

insert into T values (1), (2), (3), (4), (5);

insert into test values ('2020-01-02', 1, '');

CREATE TABLE collate_test1 (x UInt32, s Tuple(UInt32, String)) ENGINE=Memory();

SELECT toModifiedJulianDayOrNull('2020-11-01');

SELECT fromModifiedJulianDayOrNull(-678942);

--
-- This is a cleaner approach for writing a test that relies on system.query_log/query_thread_log.
--
-- It uses current database, and since clickhouse-test will generate random for
-- each run you can run the test multiple times without worrying about
-- overlaps.
--
-- There is still event_date/event_time filter for better performance
-- (even though this is not relevant for runs on CI)
--

set log_query_threads=1;

select a['name'] from table_map;

CREATE TABLE table_map (n UInt32, m Map(String, Int))
ENGINE = MergeTree ORDER BY n SETTINGS min_bytes_for_wide_part = 0, index_granularity = 8192, index_granularity_bytes = '10Mi';

-- was failing long time ago

DROP TABLE f;

set output_format_write_statistics=0;

SELECT accurateCastOrNull(5, 'UInt8');

SELECT accurateCastOrNull(nan, 'UInt64');

select accurateCastOrNull('2001:db8::1', 'IPv4');

CREATE TABLE t (x String) ENGINE = MergeTree ORDER BY cityHash64(x) SAMPLE BY cityHash64(x);

SELECT count() FROM null_in_1 WHERE (a, b) IN (1, 1);

CREATE TABLE onesample_ttest (value Float64) ENGINE = Memory;

CREATE TABLE prod_hist (categoryId UUID, productId UUID) ENGINE = MergeTree ORDER BY productId;

CREATE TABLE summing_merge_tree (key UInt32, val UInt32, date Datetime) ENGINE=SummingMergeTree(val) PARTITION BY date ORDER BY key;

SELECT source.key, max(target.key) FROM (SELECT 1 key, 'x' name) source
INNER JOIN (SELECT 2 key, 'x' name) target
ON source.name = target.name
GROUP BY source.key;

select sum(number) over w as x, max(number) over w as y from t_01568 window w as (partition by p) order by x, y;

INSERT INTO order_by_const(a, b, c, d) VALUES (1, 1, 101, 1), (1, 2, 102, 1), (1, 3, 103, 1), (1, 4, 104, 1);

SELECT 'alias2alias';

SELECT COUNT() == 1 FROM test_index WHERE toUInt32(key_string) = 1;

-- Valid cases
-- NOTE: here and below we need FINAL to force deduplication in such a small set of data in only 1 part.

SELECT 'OLD DEDUPLICATE';

OPTIMIZE TABLE partial_duplicates FINAL DEDUPLICATE BY COLUMNS('.*') EXCEPT mat;

SELECT toUInt256(nan);

create table insub (i int, j int) engine MergeTree order by i settings index_granularity = 1;

-- 2 from numbers, 2 from tables
select * from xp where i in (select * from numbers(2));

ALTER TABLE replicated_mutations_empty_partitions DROP PARTITION '4';

select countSubstrings('foobar.com', '.');

select '# countSubstringsCaseInsensitive';

select countSubstringsCaseInsensitiveUTF8('яяяя', 'ЯЯ');

select sum(any(number + 1)) over (rows unbounded preceding) from numbers(1);

-- a corner case
select count() over ();

-- nth_value without specific frame range given
select
    number,
    nth_value(number, 1) over w as firstValue,
    nth_value(number, 2) over w as secondValue,
    nth_value(number, 3) over w as thirdValue,
    nth_value(number, 4) over w as fourthValue
from numbers(10)
window w as (order by number)
order by number;

drop table if exists stack;

select '---- Q6 ----';

select countMatches('foobarfoo', 'foo');

select countMatches(materialize(toFixedString('foo bar   ', 12)), '[a-zA-Z]*');

-- 0 rows
SELECT * FROM test ORDER BY i LIMIT 50 OFFSET 185;

SELECT value FROM select_in_test WHERE value IN (-1);

SELECT accurateCast(1, 'Decimal32(9)');

-- A NULL in the result comes from the source, never from a value the conversion could not represent,
-- for each shape of the source null map: none, all, mixed.
select accurateCast(CAST(NULL, 'Nullable(String)'), 'Nullable(Int32)');

SELECT 'database atomic tests';

SELECT 'DROP database';

SELECT 'Array max :';

SELECT toTypeName(arrayMin([toFloat32(0)])), toTypeName(arrayMin([toFloat64(0)]));

SELECT * FROM remote('127.0.0.{1,2}', currentDatabase(), y) ORDER BY number;

SHOW CREATE test_1602.DATABASE;

SELECT round(sum(toDecimal64(0.3, 2) * f32), 6) FROM test01603;

SHOW CREATE TABLE table_with_column_ttl;

SET max_block_size=900;

SYSTEM STOP merges wide_to_comp;

SHOW CREATE TABLE table_with_string_key;

insert into ay values(40, 50);

--
-- byteSize
--
select '';

insert into test_byte_size_string values(1, '', 'a', '', 'abcde');

select 'constants:', [[], [''], ['','a']], byteSize([[], [''], ['','a']]);

DROP TABLE IF EXISTS zstd_1_00;

DROP TABLE IF EXISTS constraint_test_transitivity3;

INSERT INTO constraint_test_strong_connectivity (a, b, c, d) VALUES ('1', '2', '3', '4');

CREATE TABLE constraint_test_constants (a Int64, b Int64, c Int64, CONSTRAINT c1 ASSUME b > 10 AND a >= 10) ENGINE = TinyLog;

-- assumption -> 0
EXPLAIN QUERY TREE SELECT count() FROM t_constraints_where WHERE b < 2;

INSERT INTO ttl_group_by SELECT toDate('1970-10-10'), number, number FROM numbers(100);

DROP TABLE column_swap_test_test;

SELECT replaceRegexpAll(explain, '__table1\.|_UInt8', '') FROM (EXPLAIN actions=1 SELECT i FROM index_append_test_test WHERE a = 0) WHERE explain LIKE '%Prewhere%' OR explain LIKE '%Filter column%';

DROP TABLE simple_agf_summing_mt;

create table p(d Date, i int, j int) engine MergeTree partition by d order by i settings max_partitions_to_read = 1;

SELECT sumMap(['a', 'b'], [1, NULL]);

INSERT INTO distributed SELECT number FROM numbers(256) WHERE number < 128;

SELECT sumIf(n, 1) FROM remote('127.0.0.{1,2}', view(SELECT cast(* AS Nullable(UInt8)) AS n FROM system.numbers limit 10));

system sync replica rep_fsync_r2;

drop table dist_01643;

create table t( s String ) Engine=Memory as select arrayJoin (['a','b','c']);

with i as k select * from alias_key_condition where k = (select i from alias_key_condition where i = 3);

INSERT INTO xp SELECT '2020-01-01', number, '' FROM numbers(100000);

select mapContains(a, b) from table_map;

select mapFromArrays(materialize(['aa', 'bb']), materialize([4, 5])) from numbers(2);

SELECT tupleHammingDistance((1, 2, 3), (1, 257, 65537));

SELECT '-- With ties in ordering values';

SELECT keycol, enum_col FROM table_with_enum FULL JOIN table_key USING (keycol) ORDER BY keycol;

INSERT INTO test_sequenceNextNode_Nullable values ('2000-01-02 09:00:03',5,'A');

INSERT INTO test_sequenceNextNode_Nullable values ('2000-01-02 09:00:01',10,'A');

SELECT '(forward, first_match, A->B->C)', id, sequenceNextNode('forward', 'first_match')(dt, action, 1, action = 'A', action = 'B', action = 'C') AS next_node FROM test_sequenceNextNode_Nullable GROUP BY id ORDER BY id;

INSERT INTO test_sequenceNextNode values ('2000-01-02 09:00:03',5,'A');

INSERT INTO test_sequenceNextNode values ('2000-01-02 09:00:01',10,'A');

SELECT '(forward, first_match, B)', id, sequenceNextNode('forward', 'first_match')(dt, action, 1, action = 'B') AS next_node FROM test_sequenceNextNode GROUP BY id ORDER BY id;

SELECT '(forward, head, 1, A->B)', id, sequenceNextNode('forward', 'head')(dt, action, referrer = '1', action = 'A', action = 'B') AS next_node FROM test_base_condition GROUP BY id ORDER BY id;

SELECT [number][0xFFFFFFFFFFFFFFFF] FROM numbers(1);

select a2, b2, a3, b3 from tab2 all right join tab3 on a2 = a3 or b2 = b3 ORDER BY a2, b2, a3, b3;

select a1, b1, a2, b2 from tab1 any right join tab2 on b1 + 1 = a2 + 1 or a1 + 4 = b2 + 2 ORDER BY a1, b1, a2, b2;

-- Create one table and see some columns in system.parts
DROP TABLE IF EXISTS data_01660;

select * from (select 'a' as a, 'b' as b, 'c' as c, 'd' as d, 'e' as e, 'f' as f) as t1 left join (select 'a' as a, 'b' as b, 'c' as c, 'd' as d, 'e' as e, 'f' as f) as t2 on t1.d = t2.b or t1.c = t2.b or t1.d = t2.b and t1.d = t2.b or (t1.e = t2.e and t1.a=t2.a and t2.f=t1.f);

INSERT INTO `tab` VALUES (toDate('2018-01-29'), toDateTime('2018-01-29 02:09:48', 'UTC'), toDateTime64('2018-01-29 02:09:48.123456', 6, 'UTC'), '2018-01-29', '2018-01-29 02:09:48', '2018-01-29 02:09:48.123456', 'qaz');

DROP TABLE IF EXISTS data_01655;

SELECT * FROM test_r1;

DROP TABLE IF EXISTS {CLICKHOUSE_DATABASE_1:Identifier}.test_for_dictionary;

SELECT sign(n2) FROM test;

SELECT count() FROM numbers(256) WHERE toUInt8(number);

ATTACH DATABASE {CLICKHOUSE_DATABASE_1:Identifier};

SELECT CountryID, StartDate, Tax FROM range_dictionary ORDER BY CountryID, StartDate, EndDate;

SELECT reinterpret(49, 'FixedString(2)');

SELECT reinterpret(0, 'Date'), reinterpret('', 'Date');

INSERT INTO bloom_filter_nullable_index VALUES (1, 'test');

SELECT 'dictGetOrDefault existing value';

INSERT INTO {CLICKHOUSE_DATABASE_1:Identifier}.simple_key_hierarchy_table VALUES (4, 2);

CREATE DICTIONARY {CLICKHOUSE_DATABASE_1:Identifier}.cache_dictionary_complex_key_complex_attributes
(
    id UInt64,
    id_key String,

    value_first String DEFAULT 'value_first_default',
    value_second Nullable(String) DEFAULT 'value_second_default'
)
PRIMARY KEY id, id_key
SOURCE(CLICKHOUSE(HOST 'localhost' PORT tcpPort() USER 'default' TABLE 'complex_key_complex_attributes_source_table' DB currentDatabase()))
LIFETIME(MIN 1 MAX 1000)
LAYOUT(COMPLEX_KEY_CACHE(SIZE_IN_CELLS 10));

SELECT 'Dictionary flat_dictionary_simple_key_simple_attributes';

-- insert into first shard
INSERT INTO x_dist SELECT * FROM numbers(10) settings insert_shard_id = 1;

SELECT * FROM 01686_test WHERE key IN (123, 456, -123) ORDER BY key;

/* toDateTime or toString or other functions which should call the toMinute() function will all meet this bug. tests below will verify the toDateTime and toString. */
SELECT 'Check the bug causing situation: the special Australia/Lord_Howe time zone. toDateTime and toString functions are all tested at once';

SELECT toUnixTimestamp(x) as tt, (toDateTime('1981-09-30 00:00:00', 'Europe/Moscow') + INTERVAL number * 600 SECOND) AS x, timezoneOffset(x) as res,(toDateTime(toString(x), 'UTC') - x ) AS calc FROM numbers(576) where res != calc;

SELECT toInt32(-199) % toInt16(-200) as k, toTypeName(k);

-- Now, we don't load projection pp for attached part, but it is written on disk
alter table tp_1 attach partition '0';

SELECT 'value: ', avg(number / 2) FROM numbers(10);

SET log_profile_events=false;

SHOW TABLES FROM sqllt FORMAT Null;

SELECT 'ACTUAL LOG CONTENT:';

SELECT 2+1 FROM system.one X RIGHT JOIN system.one Y ON X.dummy+1 = toUInt16(Y.dummy) SETTINGS join_use_nulls = 1;

select c0 from t1 order by sin(-c0) settings optimize_read_in_order=0;

insert into has_final_mark select number, number from numbers(10000);

CREATE TABLE test (`val` LowCardinality(Nullable(String))) ENGINE = MergeTree ORDER BY tuple() SETTINGS index_granularity = 8192;

ALTER TABLE t2 ADD PROJECTION proj (SELECT id2 ORDER BY id2);

insert into atf_p select number from numbers(10);

alter table t detach partition 1;

create table test (name String, time Int64) engine MergeTree order by time;

create table z (pk Int64, d Date, id UInt64, c UInt64) Engine MergeTree partition by d order by pk settings ratio_of_defaults_for_sparse_serialization = 1.0;

DROP ROW POLICY rp ON t;

show create foo;

select toStartOfMinute(datetime) dt_m, countIf(first_time = 0) / count(), avg((kbytes * 8) / duration) from projection_test where domain = '1' group by dt_m order by dt_m;

set enable_memory_bound_merging_of_aggregation_results=0;

select t from data_proj_order_by_incomp where t > 0 order by t settings max_threads=1;

CREATE TABLE alter_drop_version
(
    `key` UInt64,
    `value` String,
    `ver` Int8
)
ENGINE = ReplacingMergeTree(ver)
ORDER BY key;

INSERT INTO test_tuple_nested_in_array VALUES ([(NULL, 2), (3, NULL), (NULL, 4)]);

DROP TABLE IF EXISTS signed_table;

DROP TABLE constraint_on_low_cardinality_nullable_type;

INSERT INTO table_map_with_key_integer VALUES ('2020-01-01', map('2020-01-01', 1, '2020-01-02', 2, '1970-01-02', 3));

DROP TABLE constraint_constant_number_expression_non_uint8;

SET engine_file_truncate_on_insert=0;

EXPLAIN SYNTAX
SELECT 1
UNION ALL
(
    SELECT 1
    UNION DISTINCT
    (
        SELECT 1
        UNION ALL
        SELECT 1
    )
    UNION ALL
    SELECT 1
);

SELECT toDateTime64(-999999999999, 9, 'UTC');

-- order key can be pushed down with final
SELECT replaceRegexpAll(explain, '__table1\.|_UInt8|_UInt16', '') FROM (EXPLAIN actions=1 SELECT * FROM prewhere_move_select_final WHERE x > 100) WHERE explain LIKE '%Prewhere%';

SELECT count() FROM XXXX WHERE indexHint(t = toDateTime(0)) SETTINGS optimize_use_implicit_projections = 1;

select toInt128OrDefault('-1', cast(-2 as Int128));

select toDateOrDefault(19507, '2000-01-01'::Date);

SELECT dictGet('executable_pool_complex', 'b', ('First_2', 'Second_2'));

SELECT extractTextFromHTML('Hello <![CDATA[Hello\tworld]]> world!');

SELECT extractTextFromHTML('<![CDATA[]]]]><![CDATA[>]]>');

CREATE TABLE `01746_merge_t`
(
    `n1` Int8,
    `n2` Int8,
    `n3` Int8
)
ENGINE = Memory;

SELECT arraySort(x -> x.2, [tuple('a', 10)]) AS X FROM ttt01746 PREWHERE d >= toDate('2021-03-03') - 2 ORDER BY n LIMIT 1;

SELECT dictGet('executable_pool_complex_implicit_key', 'a', ('First_2', 'Second_2'));

SELECT dictGet(test_dict, 'value', (toUInt32(1), toUInt32(2)));

SELECT dictGetOrDefault('direct_dictionary_simple_key_complex_attributes', 'value_first', number, toString('default')) as value_first,
    dictGetOrDefault('direct_dictionary_simple_key_complex_attributes', 'value_second', number, toString('default')) as value_second FROM system.numbers LIMIT 4;

CREATE TABLE {CLICKHOUSE_DATABASE_1:Identifier}.complex_key_simple_attributes_source_table
(
   id UInt64,
   id_key String,
   value_first String,
   value_second String
)
ENGINE = MergeTree ORDER BY tuple();

drop table if exists dist_01756_str;

--
-- others
--
select 'others';

-- or
select * from dist_01757 where dummy = 0 or dummy = 1 format Null settings optimize_skip_unused_shards_limit=2;

INSERT INTO {CLICKHOUSE_DATABASE_1:Identifier}.polygons VALUES ([[[(-1, -1), (1, -1), (1, -3), (-1, -3)]]], 'Click West', 424, NULL);

SELECT * FROM 01760_db.example_simple_key_dictionary;

select deltaSumTimestampMerge(state) from (select deltaSumTimestampState(value, timestamp) as state from (select toDate(number) as timestamp, [4, 5, 5, 5][number-4] as value from numbers(5, 4)) UNION ALL select deltaSumTimestampState(value, timestamp) as state from (select toDate(number) as timestamp, [0, 4, 8, 3][number] as value from numbers(1, 4)));

INSERT INTO test_ttl_group_by01763(key, ts, value) SELECT number%5 as key, now() - interval 10 minute + number, 0 FROM numbers(1000);

INSERT INTO collapsing_suspicious_granularity VALUES (1, 1, -1) (1, 1, 1);

SELECT dictHas('hashed_dictionary_simple_key_simple_attributes', number) FROM system.numbers LIMIT 4;

SELECT dictHas('sparse_hashed_dictionary_simple_key_complex_attributes', number) FROM system.numbers LIMIT 4;

DROP TABLE t_src;

SELECT arrayProduct([toDecimal64(1,8), toDecimal64(2,8), toDecimal64(3,8)]) as a, toTypeName(a);

-- Rounding down to hour intervals is aligned to midnight even if the interval length does not divide the whole day.
SELECT toStartOfInterval(toDateTime('2021-03-23 03:58:00'), INTERVAL 11 HOUR);

SELECT '# Invocation with non-constant prefixes';

SELECT isIPAddressInRange(CAST('128.0.0.1', 'Nullable(String)'), '127.0.0.0/8');

WITH arrayJoin([toIPv4('192.168.100.1'), toIPv4('192.168.103.255')]) as addr, arrayJoin(['192.168.100.0/22', '192.168.100.0/24']) as prefix SELECT addr, prefix, isIPAddressInRange(addr, prefix);

SELECT (NULL, NULL) IN ((NULL, 0), (3, 1), (3, 2), (8, 0), (NULL, NULL));

SELECT 'Cache dictionary';

-- https://github.com/ClickHouse/ClickHouse/issues/80862
SELECT hex(quantileDeterministicState(1,1));

SELECT * FROM t_sparse_1 ORDER BY v, id;

INSERT INTO t_sparse SELECT
    number,
    if (number % 20 = 0, number, 0),
    if (number % 50 = 0, toString(number), '')
FROM numbers(1, 100000);

SELECT table, column, serialization_kind FROM system.parts_columns
WHERE database = currentDatabase() AND table IN ('t_sparse_prewhere', 't_full_prewhere') AND active AND column != 'id'
GROUP BY ALL ORDER BY ALL;

SELECT count() FROM t_sparse_full WHERE u % 4 = 0;

SELECT dumpColumnStructure(t.a) FROM sparse_t;

SELECT t FROM sparse_tuple WHERE t.a != 0 ORDER BY id LIMIT 5;

INSERT INTO complex_key_dictionary_source_table VALUES (1, 'key', 'First', 'First');

INSERT INTO merge_tree_deduplication (key, value) VALUES (2, '2');

-- not deduplicated

SELECT part, key, value FROM merge_tree_deduplication ORDER BY key, part;

SET max_memory_usage = '200M';

SELECT name, database, element_count FROM system.dictionaries WHERE database = '01785_db' AND name = 'simple_key_hashed_dictionary';

CREATE TABLE group_by_pk (k UInt64, v UInt64)
ENGINE = MergeTree ORDER BY k PARTITION BY v % 50;

ALTER table test_wide_nested update `info2.id` = `info.id`, `info2.name` = `info.name` where 1;

DROP TABLE underlying_01796;

SELECT uniqThetaArray([0, 1, 1], [0, 1, 1], [0, 1, 1]);

-- complex
CREATE TABLE stored_aggregates
(
	d	Date,
	k1 	UInt64,
	k2 	String,
	Uniq 			AggregateFunction(uniq, UInt64),
    UniqThetaSketch	AggregateFunction(uniqTheta, UInt64)
)
ENGINE = AggregatingMergeTree(d, (d, k1, k2), 8192);

INSERT INTO TABLE test1(year, uv) select '2021',uniqThetaState(toInt64(4));

SELECT Y, uniqTheta(Z) FROM (SELECT number AS X, IPv4NumToString(toUInt32(X)) AS Z, (3*X*X - 7*X + 11) % 37 AS Y FROM system.numbers LIMIT 15) GROUP BY Y ORDER BY Y;

select * from data_01801 where key = 0 order by key desc settings max_rows_to_read=10 format Null;

-- DateTime vs DateTime64
SELECT dateDiff('second', toDateTime('2015-08-18 00:00:00', 'UTC'), toDateTime64('2015-08-18 00:00:00', 3, 'UTC'));

select * from s3('http://localhost:11111/test/{a,b,c}.tsv', NOSIGN) ORDER BY c1, c2, c3;

select * from s3Cluster('test_cluster_two_shards_localhost', 'http://localhost:11111/test/{a,b,c}.tsv', 'test', 'testtest', 'TSV', 'c1 UInt64, c2 UInt64, c3 UInt64') ORDER BY c1, c2, c3;

SELECT count() FROM t_map_null WHERE a = map('name', NULL, '', NULL);

DROP DICTIONARY IF EXISTS ip_trie_dictionary;

WITH
    toDate('2021-04-14') AS date_value,
    toDate32('2021-04-14') AS date_32_value,
    toDateTime('2021-04-14 11:22:33') AS date_time_value,
    toDateTime64('2021-04-14 11:22:33', 3) AS date_time_64_value
SELECT dateName('day', date_value), dateName('day', date_32_value), dateName('day', date_time_value), dateName('day', date_time_64_value);

create table data_01817 (key Int) Engine=Null();

DROP TABLE dictionary_primary_key_source_table;

select count() from (select if(number >= 0, number, sleep(1)) from numbers(10000000));

select if(number % 5 == 0, Null, toInt128OrZero(toString(number))) from numbers(20);

select if(number % 5 == 0, toFixedString(toString(number + 10), 2), Null) from numbers(20);

select if(number % 5 == 0, range(number), range(number + 1)) from numbers(20);

select if(toLowCardinality(number) % 2, number, number + 1) from numbers(10);

DROP TABLE IF EXISTS t_json_10;

INSERT INTO t_json format JSONEachRow {"id": 1, "obj": {"foo": 1, "k1": 2}};

SELECT DISTINCT arrayJoin(JSONAllPathsWithTypes(arrayJoin(arr))) as path FROM t_json_array order by path;

DROP TABLE type_json_src;

SELECT materialize('{"k":"v"}'::JSON) SETTINGS extremes = 1;

select * from data_01832;

insert into tt_null values('x');

explain ast select tupleElement(255, 100);

SELECT '\w' LIKE '\w%';

select count() from tbl where _partition_value.1 = '2021-04-01' settings max_rows_to_read = 4;

INSERT INTO s2_indexes VALUES (6944470717485986643, 140.428834, 28.399755);

select s2ToGeo(4573517609713934091);

SELECT (0.1::Decimal(4, 4) + 0.2::Decimal(4, 4) + 0.3::Decimal(4, 4))::Decimal(4, 4) AS c;

EXPLAIN SYNTAX SELECT [-1.1, 2, -3]::Array(Float64);

-- check that found_rate is 0, not nan
SELECT name, query_count, status, last_exception FROM system.dictionaries WHERE database = currentDatabase() AND name = 'simple_key_direct_dictionary_01862';

INSERT INTO complex_key_source_table_01862 VALUES (1, 'FirstKey', 'First');

SELECT dictGet('simple_key_range_hashed_dictionary_01862', 'value', toUInt64(2), today()) FORMAT Null;

DROP DICTIONARY IF EXISTS polygon_dictionary_01862;

SELECT minMap(statusMap) FROM map_comb;

SELECT length(mapKeys(m)), arraySort(mapValues(m)) FROM (SELECT sumMap(1, arrayJoin([nan::BFloat16, reinterpretAsBFloat16(reverse(unhex('7FC1'))), reinterpretAsBFloat16(reverse(unhex('FFC1'))), 0::BFloat16, -0::BFloat16])) AS m);

-- Tag no-fasttest: needs s2

select s2CapContains(1157339245694594829, 1.0, 1157347770437378819);

SELECT isConstant(01856_test_function_0(1, 2, 3));

INSERT INTO interval VALUES ('a', 1, 3), ('a', 1, 3), ('a', 2, 4), ('a', 1, 1), ('a', 5, 6), ('a', 5, 7), ('b', 10, 12), ('b', 13, 19), ('b', 14, 16), ('c', -1, 1), ('c', -2, -1);

SELECT 'Int32';

SELECT toUInt128(1), bitPositionsToArray(toUInt128(1));

SELECT 'dt64 != const dt' FROM dt64test WHERE dt64_column != toDateTime('2020-01-13 13:37:00');

CREATE OR REPLACE VIEW view_nulls_set AS
SELECT * FROM ( SELECT number + 1 AS a, number + 11 AS b FROM numbers(2) ) AS t1
FULL JOIN ( SELECT number + 2 AS a, number + 22 AS c FROM numbers(2) ) AS t2
USING a ORDER BY a
SETTINGS join_use_nulls = 1;

insert into replacing values (3,'1970-01-01 08:25:46.300800005','c1');

DROP TABLE IF EXISTS table2 SYNC;

DROP TABLE IF EXISTS data_01875_3;

CREATE TABLE t_tuple_null (t Tuple(n UInt32)) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE t_create_as_tuple;

OPTIMIZE TABLE limited_merge_table FINAL;

CREATE TABLE t_subcolumns_local (arr Array(UInt32), n Nullable(String), t Tuple(s1 String, s2 String))
ENGINE = MergeTree ORDER BY tuple();

SELECT count() FROM bftest WHERE hasAny(x, [1]) FORMAT Null;

SELECT JSON_VALUE('{"hello":null}', '$.hello');

SELECT JSON_QUERY( '{hello:{"world":"!"}}}', '$.hello');

-- invalid json => default value (zero integer)
SELECT JSON_EXISTS('', '$.hello');

select * from (select 1) as a, (select 2), (select 1) as b;

SELECT 'Test nullable signed integer values';

SELECT hex(toString(initializeAggregation('quantileState', 0)));

SELECT stem('суммарный', 'ru');

SELECT toTypeName(stem(toNullable('word'), 'en'));

SELECT stem(w, 'en') FROM (SELECT arrayJoin(['blessing', 'disguise', 'running']) AS w);

CREATE TABLE stem_test_arr_null (words Array(Nullable(String))) ENGINE = MergeTree ORDER BY words SETTINGS allow_nullable_key = 1;

SELECT '-- Wrong type for second argument raises ILLEGAL_TYPE_OF_ARGUMENT.';

select date, a, b from t1 where (date, a, b) NOT IN (select date,a,b from t2);

SELECT id, min(value1), min(value2), min(value3), min(value4) FROM test_table_unsigned_values GROUP BY id ORDER BY id;

INSERT INTO test_table_float_values SELECT number % 3, number, number, if(number % 2 == 0, 1, 0) FROM system.numbers LIMIT 120;

SELECT
    id,
    avgWeighted(value1, weight),
    avgWeighted(value2, weight),
    avgWeighted(value3, weight),
    avgWeighted(value4, weight)
FROM test_table_signed_values GROUP BY id ORDER BY id;

ALTER TABLE test_alter_attach_01901D ATTACH PARTITION '2020-01-01' FROM test_alter_attach_01901S;

DROP TABLE dictionary_array_source_table;

CREATE TABLE 01902_db_params.t(n Int8) ENGINE=MergeTree ORDER BY n;

SHOW CREATE  TABLE 01902_db_repr.t_merge;

DROP DATABASE 01902_db_repr2;

SELECT dictGetOrDefault('cache_dictionary', 'value', toUInt64(2), NULL);

DROP TABLE polygon_dictionary_nullable_default_source_table;

SELECT accurateCast(1e19, 'Int128');

INSERT INTO h3_geo VALUES (77.25594891852249, 47.39278564360122, 5);

WITH (d < '2018-01-01') AND (d < '2018-01-02') AS x
SELECT 1
FROM t
WHERE x;

INSERT INTO codecTest (key, name, ref_valueF64, valueF64, ref_valueF32, valueF32)
    SELECT number AS n, 'e()', e() AS v, v, v, v FROM system.numbers LIMIT 1, 100;

set exact_rows_before_limit = 1, output_format_write_statistics = 0, max_block_size = 100;

SELECT * FROM {CLICKHOUSE_DATABASE_1:Identifier}.test_dictionary;

EXCHANGE DICTIONARIES {CLICKHOUSE_DATABASE_1:Identifier}.dictionary_1 AND {CLICKHOUSE_DATABASE_1:Identifier}.dictionary_2;

SELECT toLowCardinality(toIntervalDay(1));

INSERT INTO t1 VALUES ('111', 1, 1);

select '-------toYear---------';

select '-------toStartOfWeek---------';

select toRelativeDayNum(x1, 'Asia/Istanbul') from t1;

select addQuarters(x1, 1) from t1;

SELECT 1 != NOT 1;

DROP TABLE IF EXISTS broken_partition;

SELECT count() FROM t1 JOIN t2 USING (time_alias);

select mapPopulateSeries(map(toInt32(1), toInt32(1), 2, 1)) as res, toTypeName(res);

select 'alias1';

select bin('12332424');

CREATE TABLE predicate_table (value UInt8) ENGINE=TinyLog;

-- SETUP MATERIALIZED VIEWS
CREATE MATERIALIZED VIEW matview_a_to_b TO table_b AS SELECT toFloat64(a) AS a, b + sleepEachRow(0.000001) AS count FROM table_a;

-- UInt16, UInt16
select _shard_num, * from remote('127.{1..4}', view(select toUInt16(id) id from data), toUInt16(id)) where id in (0, 1, 0x7fff, 0x8000, 0xffff) order by _shard_num, id;

DROP TABLE IF EXISTS alter_index_test;

SELECT
    uniq(user_id) AS users,
    uniqIf(order_id, notEmpty(order_id)) AS orders
FROM
(
    SELECT * FROM users
) t1 ALL LEFT JOIN (
    SELECT * FROM orders
) t2 USING (user_id);

SELECT map('2020-10-10'::Date, 'v1', '2020-10-11'::Date, 'v2') AS m, toJSONString(m) AS s, isValidJSON(s);

SELECT 'leftPadUTF8';

SELECT rightPadUTF8('абвг', 4), rightPadUTF8('абвг', 4::Int32);

CREATE TABLE IF NOT EXISTS sample_correct
(`x` String)
ENGINE = MergeTree
ORDER BY tuple(sipHash64(x))
SAMPLE BY sipHash64(x);

-- Pin the codec to `LZ4` so the compressed sizes do not depend on the server's default compression codec.
CREATE TABLE test_log (x UInt8 CODEC(LZ4), s String CODEC(LZ4), a Array(Nullable(String)) CODEC(LZ4)) ENGINE = Log;

SELECT range(number % 3) FROM numbers(12);

-- Inserting 2 numbers should require 2 calls to sleep
INSERT into src SELECT number + 200 as id, 1 FROM numbers(2);

SELECT $doc$该类型的引擎$doc$;

SHOW GRANTS FOR test_user_01999;

GRANT NONE, test_role_01999_1 TO test_user_01999 WITH REPLACE OPTION;

SELECT * FROM t1 FULL JOIN t2 ON NULL ORDER BY t1.id, t2.id;

CREATE TABLE empty_table (id Int) ENGINE = Memory;

SELECT * FROM bf_tokenbf_map_keys_test WHERE map['K2'] = 'V2' SETTINGS force_data_skipping_indices='map_keys_tokenbf';

SELECT * FROM bf_tokenbf_map_values_test WHERE mapContainsValueLike(map, 'V0') SETTINGS force_data_skipping_indices='map_values_tokenbf';

SELECT 'Map fixed full text bloom filter ngrambf mapKeys';

SELECT _shard_num FROM clusterAllReplicas("{default_cluster_macro}");

DROP TABLE IF EXISTS t_map_int_key;

SELECT 2 FROM numbers(10) EXCEPT DISTINCT SELECT 1 FROM numbers(5);

select count() from (select number from numbers(1000000) intersect select number from numbers(200000, 600000));

ALTER TABLE rep_data MATERIALIZE INDEX idx IN PARTITION ID '2';

create table test(x1 Int, x2 Int, x3 Int) engine=Memory();

explain syntax select x3, if(x3 > 10, x3, plus(x1, x2)), x1 + x2 from test order by -2;

select max from (select max(first_col) as max, second_col as total from tp2 group by 2) order by 1;

SELECT CAST('1.1.1.1' as IPv6) as v, toTypeName(v);

select sum(number) = any(number) from numbers(1) group by number;

SELECT dictGet('range_dictionary_nullable', 'Tax', (toUInt64(1), '1'), toDate('2019-05-29'));

insert into test select '4', '00000000-0000-0000-0000-000000000000';

SELECT 1.123::Decimal64(5);

INSERT INTO normalize_test (id, value) VALUES (4, '本気ですか');

SELECT scalarProduct(tuple(1), tuple(0));

SELECT LpNormalize((1, pow(31, 1 / 5)), 5.);

SELECT normL1((1, 1)), normL2((1, 1)), normLinf((1, 1)), normLp((1, 1), 1.);

SELECT '-- tupleDivide: division by zero in a later fold step yields inf';

SELECT hex(SHA512(s)) FROM defaults;

create table test_date (`data` Date) engine = MergeTree order by tuple();

SELECT JSONExtract(materialize('{"key":"value"}'), 'Tuple(key LowCardinality(Nullable(String)))');

WITH map('1', 2, '3', 4) AS m SELECT m[toString(number)] FROM numbers(5);

select sum(e) from (select * from merged order by t limit 10) SETTINGS max_threads = 3;

SELECT materialize(toDecimal32(1, 2)) / CAST(NULL, 'Nullable(UInt32)');

SELECT intDiv(1, CAST(1, 'Nullable(Float32)'));

select cnt from (select count() cnt where 0) where cnt = 0;

SELECT sparkbar(4,toDate('2020-01-01'),toDate('2020-01-08'))(event_date,cnt) FROM spark_bar_test;

SELECT 8, 'Hello',bin(bitShiftRight('Hello', 8));

SELECT 35,'Hello',bin(bitShiftRight('Hello', 35));

SELECT 19,toFixedString('Hello', 10), bin(bitShiftRight(toFixedString('Hello', 10), 19));

SELECT 80,toFixedString('Hello', 10), bin(bitShiftRight(toFixedString('Hello', 10), 80));

INSERT INTO summing_mt_aggregating_column SELECT 1, 3, [555, 999], groupArrayArrayState([toUInt64(55), toUInt64(99)]);

SELECT 23,'Hello',bin(bitShiftLeft('Hello', 23));

SELECT 8, toFixedString('Hello', 10), bin(bitShiftLeft(toFixedString('Hello', 10), 8));

SELECT 35,toFixedString('Hello', 10), bin(bitShiftLeft(toFixedString('Hello', 10), 35));

SELECT id as shift_right_bit,toFixedString('Hel', 10) as arg,bin(bitShiftLeft(toFixedString('Hel', 10), id)) as fixed_string_res FROM test_bit_shift_left_string_integer;

SELECT value, time, round(exp_smooth, 3) FROM (SELECT number AS value, number AS time, exponentialMovingAverage(1)(value, time) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS exp_smooth FROM numbers(10));

SELECT 'Check `exponentialTimeDecayed.*` supports sliding windows';

-- test H3 indexes from: https://github.com/uber/h3-java/blob/master/src/test/java/com/uber/h3core/TestInspection.java#L57

INSERT INTO h3_indexes VALUES (geoToH3(0.0, 0.0, 0));

SELECT 'MapContains with existing key';

SELECT * FROM map_test_index_map_values WHERE map['K2'] != 'V2';

insert into data_02021 values (1);

create table t1 (id LowCardinality(Nullable(Int64))) engine MergeTree order by id settings allow_nullable_key = 1, index_granularity = 1;

DROP DICTIONARY IF EXISTS 2024_dictionary_with_comment;

SELECT uniqCombinedIfMergeIf(n, last > 50) FROM (SELECT uniqCombinedIfState(number, number % 2) AS n, max(number) AS last FROM numbers(10));

SELECT accurateCastOrDefault(128, 'Int8'),  accurateCastOrDefault(128, 'Int8', toInt8(5));

select accurateCastOrDefault('test', 'IPv4');

SELECT ngrams(materialize('Test'), 1);

SELECT ngrams(materialize(toFixedString('😁😈😁😈', 16)), 3);

SELECT tokens('ё;\ ё;\ జ్ఞ‌ా;\ 本気ですか;\ ﷺ;\ ᾂ;\ ΐ;\    שּ');

SELECT mapContainsKeyLike(materialize(map('aa', 1, 'bb', 2)), 'a%');

explain syntax select null is null;

select exists(select 1 except select 1);

DROP TABLE IF EXISTS partslost_2;

SELECT lowerUTF8('КВ АМ И СЖ КВ АМ И СЖ');

select toStartOfTenMinutes(toDateTime(0, 'Asia/Istanbul'));

-- Africa/Monrovia : partial minutes timezones
select toDateTime(0, 'Africa/Monrovia');

create materialized view db_hang.test_mv(A Int64) Engine=MergeTree order by A as select * from db_hang.test;

DROP TABLE IF EXISTS polygons_test_table;

select toDate32('1990-02-01') = toDateTime('1990-02-01');

CREATE TABLE bar (ts DateTime, x UInt64)
ENGINE = Memory;

CREATE FUNCTION 02101_test_function AS x -> x + 1;

SELECT mapExtractKeyLike(materialize(map('aa', 1, 'bb', 2)), 'a%');

INSERT INTO with_fill_date VALUES (toDate('2020-06-10'), toDate32('2020-06-10'));

INSERT INTO with_fill_date VALUES (toDate('2020-02-05'), 1);

SELECT value,f FROM bool_test FORMAT JSONEachRow;

insert into t1_local values (1), (2), (3);

EXPLAIN QUERY TREE dump_tree = 0, dump_ast = 1 WITH (1, 2)::Tuple(a UInt32, b UInt32) AS t SELECT t.1, tupleElement(t, 'b');

DROP TABLE table_MySQLWire;

SELECT d2 > f1 FROM t ORDER BY f1;

CREATE TABLE insert_dedup_token (
    id Int32, val UInt32
) ENGINE=MergeTree() ORDER BY id
SETTINGS non_replicated_deduplication_window=0xFFFFFFFF;

select 'deduplicate_blocks_in_dependent_materialized_views=1, insert_deduplication_token = no, results: all tables have deduplicated data';

INSERT INTO insert_dedup_token1 VALUES(2, 1002);

select if(toUInt8(1), 42, y) from test;

CREATE FUNCTION 02125_function_2 AS x -> 02125_function_1(x);

SELECT materialize(toLowCardinality('a\0aa')), countIf(toLowCardinality('aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0aaaaaaa\0'), sym = 'Red') OVER (Range BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS res FROM (SELECT CAST(CAST(number % 5, 'Enum8(\'Red\' = 0, \'Blue\' = 1, \'Yellow\' = 2, \'Black\' = 3, \'White\' = 4)'), 'LowCardinality(String)') AS sym FROM numbers(3));

drop table ttl_test_02129;

CREATE TABLE t_materialize_column (i Int32)
ENGINE = MergeTree ORDER BY i PARTITION BY i
SETTINGS min_bytes_for_wide_part = 0, enable_block_number_column = 0, enable_block_offset_column = 0;

DROP ROW POLICY IF EXISTS 02131_filter_5 ON 02131_rptable;

DROP ROW POLICY 02131_filter_5 ON 02131_rptable;

DROP ROW POLICY 02131_filter_5 ON 02131_rqtable;

CREATE TABLE t1 (`id` Int32, `key` String) ENGINE = Memory;

CREATE TABLE dest_a (count UInt32, min Int32, max Int32, count_subquery Int32, min_subquery Int32, max_subquery Int32) ENGINE=MergeTree() ORDER BY tuple();

DROP TABLE IF EXISTS 02148_test_table;

INSERT INTO t_read_in_order SELECT '2020-10-12', number, number FROM numbers(100000);

SELECT replaceRegexpAll(materialize(',,1'), '^[,]*|[,]*$', '');

SELECT CAST('0', 'Bool');

SELECT if(1, 0, throwIf(1, 'Executing FALSE branch'));

select -9 as offset, toFixedString('Hello', 6) as s,  subString(bin(s), offset), bin(bitSlice(s, offset));

select 12 as offset, 12 as length, toFixedString('Hello', 6) as s, subString(bin(s), offset, length), bin(bitSlice(s, offset, length));

select -7 as offset, 7 as length, toFixedString('Hello', 6) as s,   subString(bin(s), offset, length), bin(bitSlice(s, offset, length));

select 36 as offset, 16 as length, toFixedString('Hello', 6) as s,  subString(bin(s), offset, length), bin(bitSlice(s, offset, length));

select 5 as offset, 'Hello' as s,  subString(bin(s), offset), bin(bitSlice(s, offset));

select -16 as offset, 'Hello' as s, subString(bin(s), offset), bin(bitSlice(s, offset));

select 8 as offset, -8 as length, 'Hello' as s,   subString(bin(s), offset, length), bin(bitSlice(s, offset, length));

select -3 as offset, -14 as length, 'Hello' as s,   subString(bin(s), offset, length), bin(bitSlice(s, offset, length));

select -36-number as offset, 8 as length, 'Hello' as s,       subString(bin(s), offset , length), bin(bitSlice(s, offset, length)) from numbers(9);

SELECT d1, f1, d1 + f1 FROM t ORDER BY f1;

SELECT d1, f1, d1 / f1 FROM t ORDER BY f1;

create table t02155_t_tz ( a DateTime('America/Chicago')) Engine = Memory;

select * from test order by number;

-- Test subtraction with materialize() on both sides
SELECT
materialize(toDateTime64('2023-10-01 12:00:00', 3)) - materialize(toDateTime('2023-10-01 11:00:00')) AS result_both_materialize_1,
materialize(toDateTime64('2023-10-01 12:00:00.123', 3)) - materialize(toDateTime('2023-10-01 11:00:00')) AS result_both_materialize_2,

materialize(toDateTime64('2023-10-01 12:00:00', 0)) - materialize(toDateTime('2023-10-01 11:00:00')) AS result_both_materialize_3,

materialize(toDateTime('2023-10-01 12:00:00')) - materialize(toDateTime64('2023-10-01 11:00:00', 3)) AS result_both_materialize_4;

DROP TABLE IF EXISTS t_02156_mt1;

SELECT round(cramersV(a, b), 2), round(cramersVBiasCorrected(a, b), 2), round(theilsU(a, b), 2), round(theilsU(b, a), 2), round(contingency(a, b), 2) FROM (SELECT number % 10 AS a, number % 10 = 0 ? number : a AS b FROM numbers(150));

SELECT LEFT('Привет', -4);

SELECT right('Hello', -5);

SELECT rightUTF8('Привет', -12);

SELECT h3HexAreaKm2(12);

SELECT LTRIM(' abcdef ');

SET log_queries = 1, max_rows_to_read = 0;

INSERT INTO 02162_test_table VALUES (0, 'Value', 1);

SELECT h3EdgeLengthKm(8);

SELECT h3NumHexagons(0);

SELECT count(), toString(number) AS k FROM remote('127.0.0.{1,2}', numbers(10)) where number > ( queryID() = initialQueryID()) GROUP BY GROUPING SETS ((k), (number + 1, k), (k, number + 2)) ORDER BY k SETTINGS group_by_two_level_threshold=9, max_bytes_before_external_group_by=10000000000, max_bytes_ratio_before_external_group_by=0;

SELECT mapSort(mapApply((k, v) -> (k, v + 1), col)) FROM table_map ORDER BY id;

SELECT mapConcat(map(0.1::Float64, 4), map(0.2::Float64, 5));

SELECT mapUpdate(materialize(map('k1', 1, 'k2', 2)), map('k3', 33, 'k4', 44));

SELECT
    '02177_MV_3',
    ProfileEvents['ScalarSubqueriesGlobalCacheHit'] as scalar_cache_global_hit,
    ProfileEvents['ScalarSubqueriesLocalCacheHit'] as scalar_cache_local_hit,
    ProfileEvents['ScalarSubqueriesCacheMiss'] as scalar_cache_miss
FROM system.query_log
WHERE
        current_database = currentDatabase()
  AND type = 'QueryFinish'
  AND query LIKE '-- THIRD INSERT ANALYZER\nINSERT INTO t1%'
  AND event_date >= yesterday() AND event_time > now() - interval 10 minute;

INSERT INTO 02176_test_complex_key_table VALUES (0, '0', 'Value');

DROP TABLE t02176;

SELECT toTypeName(not false);

SELECT toTypeName(1 or true);

INSERT INTO test_degs_to_rads VALUES (-360);

CREATE DICTIONARY {CLICKHOUSE_DATABASE_1:Identifier}.dict
(
  key UInt64 DEFAULT 0,
  val UInt64 DEFAULT 10
)
PRIMARY KEY key
SOURCE(CLICKHOUSE(HOST 'localhost' PORT tcpPort() USER 'default' TABLE 'dict_data' PASSWORD '' DB currentDatabase()))
LIFETIME(MIN 0 MAX 0)
LAYOUT(FLAT());

CREATE DICTIONARY 02179_test_dictionary
(
    id UInt64,
    value String DEFAULT 'DefaultValue',
    start Int64,
    end Int64
) PRIMARY KEY id
LAYOUT(RANGE_HASHED())
SOURCE(CLICKHOUSE(TABLE '02179_test_table'))
RANGE(MIN start MAX end)
LIFETIME(0);

insert into t settings bool_true_representation='да' values ('да');

SELECT anyIf(toNullable('Hello'), arrayJoin([0, 0]) = 0);

SELECT * FROM 02183_dictionary_source_table;

SELECT * FROM 02183_ip_trie_dictionary_source_table;

SELECT 'FlatDictionary';

INSERT INTO ip_trie_dictionary_source_table VALUES ('127.0.0.0');

CREATE TABLE test_optimize_exception (date Date) PARTITION BY toYYYYMM(date) ORDER BY date;

CREATE TEMPORARY TABLE tmp (n int);

SHOW CREATE TABLE kek;

SELECT endUserIDs._experience.aaid.id FROM t_nested_tuple FORMAT JSONEachRow;

ATTACH TABLE buffer_02184;

DETACH TABLE stripe_log_02184;

DROP TABLE IF EXISTS qv_wide_02184;

select arraySlice([1, 2, 3, 4, 5, 6, 7, 8], -2, -1);

DROP TABLE 02185_range_dictionary_source_table;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv4 TO data_b_02187 AS Select sleepEachRow(0.05) as a FROM data_a_02187;

CREATE DICTIONARY 02188_test_dictionary_complex_primary_key
(
    id UInt64,
    value String
)
PRIMARY KEY (id, value)
SOURCE(CLICKHOUSE(TABLE '02188_test_dictionary_source'))
LAYOUT(COMPLEX_KEY_DIRECT());

SELECT parseDateTimeBestEffort('20220101-010203-01', 'UTC');

SYSTEM STOP MERGES data_02201;

SELECT 'With max key';

SELECT s, replaceAll(s, '_', 'o') AS a, REGEXP_REPLACE(s, '_', 'o') AS b, a = b FROM (SELECT arrayJoin(['.', '_.']) AS s);

SELECT s, replaceAll(s, '_', 'oo') AS a, REGEXP_REPLACE(s, '_', 'oo') AS b, a = b FROM (SELECT arrayJoin(['_._', '._']) AS s);

select startsWith([1, 2, 3, 4], [1, 2, 3]);

WITH minSampleSizeContinous(baseline, sigma, 0.05, 0.8, 0.05) AS res SELECT 'continous UInt64 1', roundBankers(res.1, 2), roundBankers(res.2, 2), roundBankers(res.3, 2) FROM minimum_sample_size_continuos ORDER BY roundBankers(res.1, 2);

SELECT '- test nanoseconds';

-- Below normal range, source scale greater than result

select toStartOfInterval(toDateTime64('2220-12-12 12:12:12.123', 3), INTERVAL 1 MILLISECOND);

-- Below normal range, source scale less than result
select addMilliseconds(toDateTime64('1930-12-12 12:12:12.123456', 6), 1);

SELECT sleep(1) SETTINGS log_processors_profiles=true, log_queries=1, log_queries_min_type='QUERY_FINISH';

SELECT h3GetPentagonIndexes(resolution) AS indexes from table1 order by indexes;

DROP TABLE IF EXISTS data_02222;

SELECT round(h3ExactEdgeLengthM(arrayJoin([1298057039473278975,1370114633511206911,1442172227549134847,1514229821587062783])), 2);

SELECT s2CapUnion(3814912406305146967, toFloat64(1), 1157347770437378819, toFloat64(1));

SELECT materialize('Hello World') AS s WHERE (s LIKE 'hello%') OR match(s, 'wor.*') SETTINGS optimize_or_like_chain = 0;

SELECT materialize('bbb foo') WHERE materialize('aaa') LIKE 'hellooooo%' OR materialize('bbb foo') LIKE '%foo%' SETTINGS optimize_or_like_chain = 0, max_hyperscan_regexp_length = 4;

SELECT * FROM bf_tokenbf_lowcard_test WHERE like(lc_fixed, 'K2ZZZZZZ') SETTINGS force_data_skipping_indices='lc_fixed_bf_tokenbf';

-- to succeed this test can require too many retries due to 100 partitions, so disable fault injections

-- regression for MEMORY_LIMIT_EXCEEDED error because of deferred final part flush

-- Compact parts keep a ~1MiB compressor per delayed part, Wide parts with adaptive write buffers do not,
-- so the 30MiB assertions below require the part format to stay Compact.
drop table if exists data_02228;

INSERT INTO bloom_filter_sizing_pk
SELECT
number % 100 as key, -- 100 unique keys
number as value -- whatever
FROM numbers(100_000);

DROP DICTIONARY IF EXISTS hierarchy_flat_dictionary;

SELECT dictGetDescendants('hierarchy_flat_dictionary', 4, 1);

# Test INTERPOLATE in sub-select
SELECT n, source, inter FROM (
    SELECT n, source, inter, inter2 FROM (
        SELECT toFloat32(number % 10) AS n, 'original' AS source, number AS inter, number + 1 AS inter2 FROM numbers(10) WHERE (number % 3) = 1
    ) ORDER BY n ASC WITH FILL FROM 0 TO 11.51 STEP 0.5 INTERPOLATE ( inter AS inter + inter2 )
);

DROP TABLE IF EXISTS idx;

SELECT IPv4StringToNum('');

SELECT toFixedString('', 16) as value, cast(value, 'IPv6');

SELECT order_0, _part_offset, _part FROM t_1 ORDER BY order_0 DESC LIMIT 3;

DROP TABLE t_sparse_02235;

SELECT arrayFirstOrNull(x -> 1, [1, 2, 3]);

CREATE TABLE t1 (k UInt32) ENGINE = TinyLog;

select toTypeName(makeDate(1991, 8, 24));

select makeDate(1969,1,1);

select makeDate(1984, 3, False);

select makeDate(2149, 157);

SELECT toIPv4('255.255.255.255') IN (4294967295, 4294967296);

select makeDate32(1980, 2, 29);

select makeDate32(0x7fffffffffffffff+2010,1,3);

select makeDate32(-1980.0, 9);

DROP TABLE IF EXISTS test_table_ipv4;

SELECT * FROM lc_table INNER JOIN lc_table AS lc_table2
ON lc_table.col = lc_table2.col;

select makeDateTime(1984, 1, 1, -1, 0, 0, 'UTC');

select makeDateTime64(1991, 8, 24, 21, 4, 0, 123);

select makeDateTime64(1984, 1, 1, 25, 0, 0, 0, 9, 'UTC');

select makeDateTime64(1984, 1.5, 1, 0, 0, 0, 0, 9, 'UTC');

set s3_truncate_on_insert = 1;

insert into test_02245 select 1 settings s3_truncate_on_insert=1;

DROP TABLE IF EXISTS t_flatten_tuple;

INSERT INTO t(a, b, c, d ,e)  VALUES ('1648804224','','','',5);

SELECT number FROM numbers(10) WHERE number > 15 and test_function(number, number) == 4;

SELECT count(1) FROM numbers(2) AS n1, numbers(3) AS n2, numbers(4) AS n3;

DROP TABLE IF EXISTS 02266_auto_add_nullable;

DROP TABLE 02267_t;

-- SUBSTRING(expr, start, length)

SELECT substring('1234' AS arg_1, 2 AS arg_2, 3 AS arg_3), arg_1, arg_2, arg_3;

-- function(offset, timestamp)

SELECT dateSub(DAY, 1 AS arg_1, toDate('2019-05-05') AS arg_2), arg_1, arg_2;

select client_name from system.query_log where event_date >= yesterday() AND event_time >= now() - 600 AND current_database = currentDatabase() and query like 'select 1%' format CSV;

SHOW CREATE TEMPORARY TABLE t11_02271;

SELECT * FROM replace_partition_dest2;

INSERT INTO table_for_alter VALUES (3, '3');

SELECT cosineDistance([3, 2, 1], v) FROM vec1;

CREATE TABLE vec1d (id UInt64, v Array(Float64)) ENGINE = Memory;

SELECT bin(toUInt128(100000000000)) AS res;

SELECT quantilesTDigestArray(0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99)(arrayResize(arrayResize([0], 500000, -inf), 1000000, inf));

SELECT quantileTDigest(-inf) FROM numbers(500);

ALTER TABLE t_vertical_merges ADD COLUMN c String;

DROP TABLE IF EXISTS user_all;

SELECT cityHash64(map(1, 'a', 2, 'b'));

DESCRIBE TABLE ignore_auto_increment;

CREATE TABLE h3_indexes (id int, start String, end String) ENGINE = Memory;

INSERT INTO h3_indexes VALUES (27, '8301a5fffffffff','830b48fffffffff');

DROP DICTIONARY IF EXISTS hierarchy_flat_dictionary_index;

select toTypeName(arrayMap((x, y) -> x + y, [], CAST([], 'Array(Int32)')));

SELECT arraySort(groupArrayArrayMerge(grp_aggreg)) gra , arraySort(groupArrayArray(grp_simple)) grs FROM data_02294 group by a, b SETTINGS optimize_aggregation_in_order=1;

select 0 = multiSearchFirstIndex(materialize('Hello World'), materialize(['Hallo', 'Welt']));

SELECT number FROM numbers(10)
WHERE number IN (
    WITH (SELECT 1) AS v1, (SELECT 2) AS v2
    SELECT v1 AS v
    UNION ALL
    SELECT v2 AS v
);

select 'create table, column +type +NULL +DEFAULT';

-- Auto spilling hash join has to be disabled to test switching to merge join.
SET max_bytes_in_join = '100', join_algorithm = 'auto';

insert into test_02302 select 2 settings s3_create_new_file_on_insert = true;

SELECT accurateCastOrNull(if(number % 2, NULL, 'truex'), 'Bool') FROM numbers(4);

select joinGet(id_val, 'val', toInt32(number)) from numbers(1);

SELECT * FROM (SELECT path, name, value FROM system.zookeeper ORDER BY path, name) WHERE path LIKE '/' || currentDatabase() || '/1-insert-test%';

create table test_02312 (x Tuple(a UInt32, b UInt32)) engine=File(ORC);

SELECT sum(x) >= 10
FROM
(
    SELECT x
    FROM
    (
        SELECT zero AS x
        FROM system.zeros
        SETTINGS max_block_size = 2, max_rows_to_read = 10, read_overflow_mode = 'break'
    )
    UNION ALL
        SELECT x
    FROM
    (
        SELECT zero + 1 AS x
        FROM system.zeros
        SETTINGS max_block_size = 2, max_rows_to_read = 20, read_overflow_mode = 'break'
    )
);

CREATE TABLE ipv4_test
(
    id UInt64,
    value String
) ENGINE=MergeTree ORDER BY id;

insert into distinct_in_order select * from numbers(10);

select a, x from (select distinct a, 1 as x from distinct_in_order order by x) order by a;

select '-- distinct in order, sorting key tuple()';

INSERT INTO merge_table_standard_delete select number, toString(number) from numbers(100);

optimize table t_light final SETTINGS mutations_sync=2;

DROP ROW POLICY IF EXISTS test_filter_policy_2 ON test_table;

-- add_minmax_index_for_numeric_columns=0: Adds more output to system.data_skipping_indices

-- no-shared-merge-tree: sync replica won't wait for metadata mutations

drop table if exists t_index;

select arrayFilter(x -> toNullable(1), range(number)) from numbers(3);

CREATE TABLE segfault
(
    id          UInt32,
    uuid        UUID,
    tags_ids    Array(UInt32)
) ENGINE = MergeTree()
ORDER BY (id);

desc format(JSONEachRow, '{"x" : ["2020-01-01 00:00:00"]}\n{"x" : ["2020-01-01"]}');

desc format(TSV, '[\'2020-01-01 00:00:00\', \'2020-01-01\']\n[\'2020-01-01\']');

desc format(JSONEachRow, '{"x" : {"k1" : "123", "k2" : 123}}');

desc format(CSV, '123');

INSERT INTO t_sparse_s3 SELECT 1, number % 2, '' FROM numbers(8192);

DESCRIBE (SELECT system.one.dummy);

SELECT base58Decode(encoded) FROM (SELECT base58Encode(val) as encoded FROM (SELECT arrayJoin(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'Hello world!']) val));

DESCRIBE (SELECT 1, 'test');

SELECT 'Table qualified matchers';

SELECT 'EXCEPT transformer';

DESCRIBE (SELECT id + length(value) FROM test_table);

-- It works with analyzer; rhs is an alias itself.
with rhs as (select * from remote('127.{1,2}', view(select dummy d1, dummy d2 from system.one))) select lhs.d2 from remote('127.{1,2}', view(select dummy d1, dummy d2 from system.one)) lhs global join rhs using (d1) order by rhs.d2 settings joined_subquery_requires_alias=0;

DESCRIBE (SELECT value.value_0_level_0 AS alias_value, alias_value.* FROM test_table);

explain pipeline select * from (select * from numbers_mt(1e8) group by number) order by number settings max_rows_to_read = 0, max_threads = 36;

SELECT 'Lambda as function parameter';

SELECT arrayMap(lambda(tuple(x), x + 1), [1, 2, 3]);

SELECT number, number % 2, sum(number) AS val
FROM remote('127.0.0.{2,3}', numbers(10))
GROUP BY ROLLUP(number, number % 2)
ORDER BY (number, number % 2, val)
SETTINGS group_by_use_nulls=0;

SELECT (SELECT 1);

DROP TABLE trailing_comma_1;

SELECT 'after_implicit_txn_in_session_target', count() FROM target;

drop table if exists v_numbers;

select * from system.numbers as t limit 5 settings additional_table_filters={'t' : 'number % 2 != 0'};

select * from m_table order by x  settings additional_table_filters={'m_table' : 'x != 4'};

select * from table_1 order by x settings additional_table_filters={'table_1' : 'length(y) >= 3'};

SELECT 'Count query log entries containing index updates on INSERT';

SELECT hasPhrase('the quick brown fox', 'missing');

SELECT hasPhrase(materialize('the quick brown fox'), 'quick brown');

SELECT hasPhrase(toFixedString('quick brown', 16), 'quick brown', $$splitByRegexp('\\W+')$$);

SELECT hasPhrase('()a()bc()d()', 'a()d', 'splitByString([\'()\'])');

SELECT hasPhrase('错误503', '误503', 'asciiCJK');

-- Nanosecond
SELECT ts, metric, nonNegativeDerivative(metric, ts, INTERVAL 3 NANOSECOND) OVER (PARTITION BY id>3 ORDER BY ts, metric ASC Rows BETWEEN 2 PRECEDING AND 2 FOLLOWING) AS deriv FROM nnd ORDER BY id > 3, ts, metric, deriv DESC;

INSERT INTO tab_regex_simple VALUES (1, 'apple,banana,cherry'), (2, 'banana,date'), (3, 'cherry,elderberry'), (4, 'fig,grape');

SELECT 'negation: hasAnyTokens([bar]) -> 1';

-- 6. `hasPhrase` on a `splitByRegexp` index combined with a postprocessor. The rewrite compares the
-- postprocessed token sequences instead of rejoining them into a string, so a tokenizer that preserves
-- `#`/`+` answers the same with and without the index.

DROP TABLE IF EXISTS tab_phrase_pp;

SELECT '-- Text index';

SELECT '-- Check that the text index actually gets used (String)';

SELECT * FROM explain_index_has_any_tokens(use_idx_fixed = 0, filter = 'abc');

SELECT * FROM explain_index_has_all_tokens(use_idx_fixed = 1, filter = 'foo');

CREATE TABLE tab
(
    id Int32,
    text String,
    INDEX idx_text(text) TYPE text(tokenizer = 'splitByNonAlpha')
)
ENGINE = MergeTree()
ORDER BY (id);

SELECT '-- With preprocessor';

SELECT count() FROM tab FINAL WHERE str = 'bar';

-- 0: same via PREWHERE

DROP TABLE tab;

-- A row-level QCC entry (no skip index involved) must still be consulted when skip indexes are
-- disabled: the fix only profiles skip-index-derived entries, so the pure-QCC learned-index case
-- keeps working. Populate via the row-level WHERE path with use_skip_indexes = 0, then assert a
-- granule was pruned on reuse via EXPLAIN. max_block_size = 8 makes each non-matching granule a
-- fully filtered chunk so FilterTransform records it.
DROP TABLE IF EXISTS rl;

-- Populate under the disjunction-enabled profile.
SELECT count() FROM tab_disj WHERE hasToken(s, 'a') OR n = 999
SETTINGS use_query_condition_cache = 1, use_skip_indexes_for_disjunctions = 1, use_skip_indexes_on_data_read = 0, log_comment = '02346_qcc_disj_populate' FORMAT Null;

-- Wrapper storages over a Distributed table. StorageDistributed opts out of
-- supportsOptimizationToSubcolumns(), but a wrapper that ties the capability to
-- supportsSubcolumns() (the IStorage default) re-enables the mapValues -> subcolumn rewrite on
-- the initiator, so the shard query loses the index again. StorageMaterializedView must forward
-- the capability to its target table, and StorageMerge must fail closed if any child opts out.

-- Materialized view whose target is the Distributed table; query the view itself.
CREATE MATERIALIZED VIEW logs_mv TO logs_dist AS SELECT attributes FROM logs;

SELECT count() FROM tab WHERE a != ['x'] SETTINGS use_skip_indexes = 0;

SELECT 'pp_array_lc_nullable', count() FROM tab;

SELECT 'ILIKE uses the index (force_data_skipping_indices must not throw)';

DROP TABLE tab_lazy;

SELECT 'Index on mapValues of an alias column comparing to an empty string';

SELECT 'LIKE in WHERE, ILIKE in WHERE';

SELECT arraySort(groupArray(id)) FROM tab_in WHERE hasPhrase(message, 'see cat') SETTINGS query_plan_direct_read_from_text_index = 0;

INSERT INTO tab_partial VALUES (3, 'see the cat'), (4, 'see cat');

SELECT * FROM tab WHERE str == 'b' AND 1.0;

SELECT 'Test ngram tokenizer';

CREATE TABLE tab
(
    text String,
    INDEX idx text TYPE text(tokenizer = splitByNonAlpha)
)
ENGINE = MergeTree
ORDER BY tuple();

SELECT 'Take value from the second part';

CREATE TABLE tab
(
    str String,
    INDEX idx str TYPE text(tokenizer = array())
)
ENGINE = MergeTree
ORDER BY tuple();

SELECT '-- dictionary_block_frontcoding_compression must be an integer.';

SELECT count() FROM tab WHERE str = 'foo' SETTINGS force_data_skipping_indices='idx';

SELECT granularity FROM system.data_skipping_indices WHERE database = currentDatabase() AND table = 'tab' AND name = 'idx';

SELECT '--- cache miss after clearing cache.';

SELECT 'Test hasToken and hasToken:', count() FROM tab WHERE hasToken(text, 'Alick') and hasToken(text, 'Blick');

-- Test with not() which also returns Nullable(UInt8) when its argument is nullable
SELECT * FROM tab WHERE not(hasAnyTokens(val, toNullable('FOO')));

CREATE TABLE tab
(
    s String,
    INDEX idx(s) TYPE text(tokenizer = sparseGrams(3, 10))
)
ENGINE = MergeTree ORDER BY tuple()
-- Pin the posting list layout. Randomized `text_index_posting_list_block_size`
-- splits the posting list of the searched token into multiple blocks, in which case the skip-index
-- analysis path does not read the posting list (it relies on the rows range instead) and the postings
-- cache is never consulted, so `TextIndexPostingsCacheMisses` stays 0 and the asserted miss is lost.
SETTINGS text_index_posting_list_codec = 'none', text_index_posting_list_block_size = 1048576;

SELECT '-- Must not use the index with and without the optimization';

SELECT hasAnyTokens(materialize('a b'), 'b');

SELECT count() FROM tab WHERE hasAllTokens(col_str, []);

SELECT groupArray(id) FROM tab WHERE hasAnyTokens(message, ['fo', 'ba']);

SELECT groupArray(id) FROM tab WHERE hasAnyTokens(message, 'efg');

SELECT groupArray(id) FROM tab WHERE hasAnyTokens(message, 'a\\bc');

SELECT groupArray(id) FROM tab WHERE hasAllTokens(message, 'abc def');

SELECT groupArray(id) FROM tab WHERE hasAllTokens(message, tokens('foo bar', 'splitByNonAlpha'));

SELECT groupArray(id) FROM tab WHERE hasAnyTokens(message, tokens('def', 'array'));

SELECT trimLeft(explain) AS explain FROM (
    EXPLAIN indexes=1
    SELECT count() FROM tab WHERE hasAnyTokens(message, ['Hallo', 'World'])
)
WHERE explain LIKE '%Description:%' OR explain LIKE '%Parts:%' OR explain LIKE '%Granules:%'
LIMIT 2, 3;

SELECT trimLeft(explain) AS explain FROM (
    EXPLAIN indexes=1
    SELECT count() FROM tab WHERE hasAnyTokens(message, ['Hello', 'World'])
)
WHERE explain LIKE '%Description:%' OR explain LIKE '%Parts:%' OR explain LIKE '%Granules:%'
LIMIT 2, 3;

SELECT arraySort(groupArray(id)) FROM tab WHERE hasAllTokens(message, ['foo', 'bar']);

SELECT groupArray(id) FROM tab WHERE hasPhrase(message, 'abc bar');

SELECT groupArray(id) FROM tab WHERE hasPhrase(text, 'brown quick');

SELECT '-- an element matches as a whole token, and the index answers it';

CREATE TABLE tab
(
    id UInt32,
    message String,
    INDEX idx(`message`) TYPE text(tokenizer = splitByNonAlpha)
)
ENGINE = MergeTree
ORDER BY (id)
SETTINGS index_granularity = 1, text_index_posting_list_block_size = 10000000;

CREATE TABLE tab
(
    id UInt32,
    text FixedString(16),
    INDEX idx_text(text) TYPE text(tokenizer = splitByNonAlpha, support_phrase_search = 1)
)
ENGINE = MergeTree()
ORDER BY (id)
SETTINGS allow_experimental_text_index_phrase_search = 1;

-- Contrast: a different tokenizer does not match the index, so literal hasPhrase runs and the
-- postprocessor is not applied. Only the literal 'see cat' (3) matches.
SELECT arraySort(groupArray(id)) FROM tab WHERE hasPhrase(message, 'see cat', 'ngrams(3)');

SELECT arraySort(groupArray(id)) FROM tab WHERE hasPhrase(message, 'see the cat');

SELECT arraySort(groupArray(id)) FROM tab WHERE hasPhrase(message, 'a()d');

CREATE TABLE tab
(
    id UInt32,
    message String,
    INDEX idx(message) TYPE text(tokenizer = ngrams(3), postprocessor = lower(message))
)
ENGINE = MergeTree ORDER BY id
SETTINGS index_granularity = 1;

CREATE TABLE tab
(
    id UInt32,
    message Nullable(String),
    INDEX idx(ifNull(message, 'default')) TYPE text(tokenizer = splitByString(['()']), postprocessor = lower(ifNull(message, 'default')))
)
ENGINE = MergeTree ORDER BY id
SETTINGS index_granularity = 1;

SELECT arraySort(groupArray(id)) FROM tab WHERE hasAllTokens(message, ['a', '', 'b']) SETTINGS use_skip_indexes = 0;

CREATE TABLE tab
(
    id UInt32,
    message String,
    INDEX idx(message) TYPE text(tokenizer = splitByNonAlpha, preprocessor = lower(message))
)
ENGINE = MergeTree
ORDER BY (id);

SELECT groupArray(id) FROM tab WHERE tag NOT ILIKE '%clickhouse%';

SELECT 'Test ILIKE optimization is disabled for non-case-folding preprocessor (reverse(col))';

SELECT groupArray(id) FROM tab WHERE message LIKE '%foo%';

SELECT '-- Text index for LIKE function should choose 2 parts and 2048 granules out of 4 parts and 4096 granules';

INSERT INTO tab SELECT number, 'ClickhouseSQL' FROM numbers(1024);

SELECT groupArray(id) FROM tab WHERE data.a ILIKE '%FOOBAR%';

-- The columns are: whether the query plan contains a text index virtual column, and whether it still
-- evaluates the original search function. The latter is absent only for an exact direct read.
SELECT 'prefix', countIf(explain LIKE '%\_\_text_index\_%') > 0, countIf(explain LIKE '%FUNCTION startsWith(%') > 0
FROM (EXPLAIN actions = 1 SELECT count() FROM tab WHERE message LIKE 'foobar%');

SELECT groupArray(id) FROM tab WHERE tag ILIKE '%cloud';

SELECT count() FROM tab WHERE NOT startsWith(m['k'], 'foobar') SETTINGS use_skip_indexes = 0;

SELECT groupArray(id) FROM tab WHERE name ILIKE 'ALPHA%';

SELECT groupArray(id) FROM tab WHERE name LIKE '%' SETTINGS text_index_like_min_pattern_length = 0;

SELECT 'A NULL value is not returned by a negated pattern';

SELECT 'ilike non-ascii', countIf(explain LIKE '%\_\_text_index\_%') > 0 FROM (EXPLAIN actions = 1 SELECT count() FROM tab WHERE name ILIKE '%r\xC3\xA9sum\xC3\xA9%');

SELECT groupArray(id) FROM tab WHERE name ILIKE 'alpha%' SETTINGS use_skip_indexes = 0;

SELECT 'startsWith, _', arraySort(groupArray(id)) FROM tab WHERE startsWith(tag, 'foo_bar') SETTINGS use_skip_indexes = 0;

SELECT '-- EXPLAIN shows the tokenizer injected into SELECT-list functions';

SELECT '-- SELECT-list position: postprocessor applied';

INSERT INTO tab_array SELECT * FROM tab_split_by_string;

SELECT groupArray(id) FROM (SELECT id FROM tab_typed WHERE hasPhrase(data.key, ['quick', 'brown']) ORDER BY id) SETTINGS use_skip_indexes = 0;

SELECT 'hasAllTokens index condition';

SYSTEM CLEAR TEXT INDEX HEADER CACHE;

SET min_bytes_to_use_direct_io = 10737418240;

SET force_data_skipping_indices = 'idx_url';

-- Specifying the icu tokenizer explicitly (embedded in the tokenizer string, like ngrams/splitByString)
-- makes the brute-force scan segment Japanese correctly, giving exactly the same results as the indexed
-- column (which infers the icu tokenizer). Each pair below (explicit brute-force vs inferred index) must match.
SELECT id FROM tab_noindex WHERE hasAnyTokens(doc, '日本語', 'icu(''ja'')') ORDER BY id;

SELECT 'lowerUTF8 preprocessor, U+212A KELVIN SIGN folds to k';

SELECT countIf(explain LIKE '%Name: idx%') FROM (EXPLAIN indexes = 1 SELECT id FROM tab WHERE tag ILIKE '%zzzz%');

SELECT '-- a single value behaves like equals';

SELECT 'not scan', id FROM tab WHERE NOT (m['level'] IN ('error', 'warn')) ORDER BY id SETTINGS use_skip_indexes = 0;

SELECT 'no skip index', count() FROM (EXPLAIN indexes = 1 SELECT id FROM tab WHERE m['level'] IN live_set) WHERE explain LIKE '%Name: idx%';

-- This part predates the index, so the index is not materialized in it.
INSERT INTO tab_partial VALUES (1, {'level':'error'}), (2, {'level':'warn'});

SELECT '-- no match across pairs: the value of service is never the value of level';

SELECT 'first scan', id FROM tab_dup WHERE mapContainsKeyValue(m, 'k', 'first') ORDER BY id SETTINGS use_skip_indexes = 0;

-- One part with two granules: rows (1, 2) and rows (3, 4). Row 4 has no pairs at all.
INSERT INTO tab VALUES (1, {'level':'error','service':'api'}), (2, {'level':'warn','service':'api'}), (3, {'level':'error','service':'web'}), (4, {});

SELECT '-- a FixedString needle carries padding bytes, so it must not silently drop rows';

SELECT id FROM tab_bytes WHERE m['a'] = 'bc' ORDER BY id;

CREATE TABLE tab (
    id UInt32,
    msg String,
    INDEX idx(msg) TYPE text(tokenizer = splitByNonAlpha)
)
ENGINE = MergeTree
ORDER BY id SETTINGS index_granularity = 1;

SELECT '-- valid escape';

INSERT INTO t_str VALUES (1, map('other', 'abcdef')), (2, map('k', 'hello'));

INSERT INTO t_post VALUES (1, map('k', 'hello')), (2, map('k', '12345'));

DROP TABLE t_null;

SELECT '-- -- -- key exists only in the second granule';

SELECT * FROM explain_index_equals(use_idx_fixed = 1, filter = 'K2', value = 'V3');

SELECT count() FROM tab WHERE hasAnyTokens(mapKeys(map_fixed), 'K1 K2');

SELECT '-- -- -- keys exist in the second granule';

SELECT * FROM explain_index_has(use_idx_fixed = 1, filter = 'V2');

SELECT count() FROM tab WHERE hasAllTokens(mapValues(map_fixed), 'V3 V4');

-- 

DROP VIEW IF EXISTS explain_index_key_like;

SELECT count() FROM tab WHERE hasToken(str, 'aa');

ALTER TABLE tab CLEAR INDEX idx_text;

SELECT '-- 3. Aggregation: total cardinality per token across all parts';

SELECT token, cardinality, num_posting_blocks
FROM mergeTreeTextIndex(currentDatabase(), tab, idx_s)
WHERE token IN ('common', 'rare', 'medium')
ORDER BY token
SETTINGS max_rows_to_read = 8;

SELECT id FROM tab WHERE hasAnyTokens(str, 'world bar') ORDER BY id;

CREATE TABLE tab
(
    id  UInt32,
    str Nullable(FixedString(12)),
    INDEX idx(str) TYPE text(tokenizer = 'splitByNonAlpha')
)
ENGINE = MergeTree
ORDER BY id;

SELECT 'LowCardinality(Nullable(String))';

SELECT '-- Array postprocessor + Nullable: row 2 has "foo" (NULL element still skipped after lower)';

SELECT '-- LowCardinality(String): rows 1 and 4 have "hello"';

SELECT trim(explain) FROM
(
    EXPLAIN actions = 1, indexes = 1 SELECT count() FROM tab WHERE hasToken(lower(text), lower('Hello')) SETTINGS use_skip_indexes_on_data_read = 1, query_plan_direct_read_from_text_index = 1, query_plan_text_index_add_hint = 1
) WHERE explain LIKE '%INPUT%\_\_text_index%' OR explain LIKE '%Name: idx_text%';

SELECT '-- result matches the normal path';

SELECT count() FROM tab WHERE hasAllTokens(text, ['alpha', 'zeta']) SETTINGS query_plan_optimize_count_from_text_index = 0;

SELECT count(explain) FROM (EXPLAIN SELECT count() FROM tab_concurrent WHERE hasToken(text, 'alpha')) WHERE explain LIKE '%Trivial count from text index%';

SELECT count() FROM tab_array WHERE has(arr, 'foo');

SELECT 'Partially materialized text index';

CREATE TABLE tab_unindexed (
	id UInt64,
	text String
)
ENGINE = MergeTree
ORDER BY id
SETTINGS add_minmax_index_for_numeric_columns = 0;

SELECT 'Check tab_compact_full';

DROP TABLE IF EXISTS tab_partially;

CREATE TABLE tab_partially (
    id Int,
    text String
)
Engine = MergeTree()
ORDER BY id
SETTINGS add_minmax_index_for_numeric_columns = 0, allow_experimental_text_index_phrase_search = 1;

CREATE TABLE tab_idx (
    id UInt32,
    message String,
    INDEX idx(message) TYPE text(tokenizer = splitByNonAlpha, support_phrase_search = 1, posting_list_block_size = 256)
)
ENGINE = MergeTree
ORDER BY id
SETTINGS allow_experimental_text_index_phrase_search = 1;

DROP TABLE tab_idx;

DROP TABLE IF EXISTS tab_idx;

SELECT count(), cityHash64(arraySort(groupArray(id))) FROM tab_idx WHERE hasPhrase(message, 'needle clickhouse rare') SETTINGS log_comment = '02346_cursors';

SELECT count(), cityHash64(arraySort(groupArray(id))) FROM tab_ref WHERE hasPhrase(message, 'hello clickhouse world');

SELECT count(), sum(id) FROM (
    SELECT id FROM tab_chunks WHERE hasPhrase(message, 'beta alpha') ORDER BY id DESC LIMIT 100000
    SETTINGS use_text_index_postings_cache = 1, optimize_read_in_order = 1, max_threads = 1, max_block_size = 4096);

INSERT INTO tab_uncompressed
SELECT
    '2026-01-09 13:00:00',
    multiIf(number < 129, 'tail129',
            number = 129, 'single',
            'noise') AS str
FROM numbers(512);

OPTIMIZE TABLE tab_pfor FINAL;

-- Tests the postprocessor argument in text indexes: how each token is transformed and filtered
-- (basic expressions, stop-words, empty-token mapping) plus postprocessor validation.

DROP TABLE IF EXISTS tab;

SELECT count() FROM tab WHERE hasToken(val, 'dogs');

-- ['Foo','Bar'] -> lower -> tokens 'foo','bar' -> upper -> 'FOO','BAR'
SELECT count() FROM tab PREWHERE hasAllTokens(val, ['FOO']) WHERE hasAllTokens(val, ['FOO']);

-- hasAnyTokens(['stop', 'foo']) reduces to hasAnyTokens(['foo']).
SELECT count() FROM tab WHERE hasAnyTokens(val, ['stop', 'foo']);

SELECT 'if(token IN (array)): array right-hand side, same as tuple';

SELECT count() FROM tab WHERE hasToken(val, 'failed');

-- Old parts (no index): row-level scan uses the postprocessed (lowercased) needle.
SELECT count() FROM tab WHERE hasToken(val, 'foo');

SELECT '6. Array tokenizer + postprocessor: rewrite path matches index for mixed parts.';

-- Index stores 'foo', 'bar' for row 1 and 'baz' for row 2.
-- The postprocessor normalises needle elements for index lookup (hint mode);
-- row-level hasAll/hasAny still compares needle and haystack literally.
SELECT count() FROM tab WHERE hasAll(val, ['FOO', 'BAR']);

-- 0

-- Multi-element IN, with elements of different cases. All matching rows must survive.
SELECT count() FROM tab WHERE val IN ('FOO', 'bar');

INSERT INTO tab VALUES (1, {'a': 'FOO'}), (2, {'a': 'BAR'});

-- 1
SELECT count() FROM tab WHERE val NOT ILIKE '%running%' SETTINGS use_text_index_like_evaluation_by_dictionary_scan = 1;

CREATE TABLE tab
(
    s String,
    b String ALIAS s,
    a String ALIAS b,
    INDEX idx(s) TYPE text(tokenizer = 'splitByNonAlpha', postprocessor = lower(a))
)
ENGINE = MergeTree ORDER BY tuple();

-- stem 'studi'

-- Any morphological form of 'run' reaches all three run-stem rows; NULL rows are skipped.
SELECT count() FROM tab WHERE hasToken(val, 'running');

-- 1
-- The OR of all three literals covers every row in the stem-'run' family.
SELECT count() FROM tab WHERE val = 'running' OR val = 'runs' OR val = 'run';

-- 1
-- Different stem — granule pruned.
SELECT count() FROM tab WHERE val LIKE '%jumping%';

-- 1
SELECT count() FROM tab WHERE hasAllTokens(val, 'running cat');

SELECT '5. hasToken / hasAnyTokens / hasAllTokens results are independent of query_plan_direct_read_from_text_index.';

-- old part: no index, evaluated by the row-scan fallback

ALTER TABLE tab ADD INDEX idx(val) TYPE text(tokenizer = 'array', postprocessor = if(empty(val), 'EMPTY', val));

CREATE TABLE tab
(
    id UInt64,
    val String,
    INDEX idx(val) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = concat(val, val))
)
ENGINE = MergeTree
ORDER BY tuple();

CREATE TABLE tab
(
    id UInt64,
    val Array(FixedString(3)),
    INDEX idx(val) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = lower(val))
)
ENGINE = MergeTree ORDER BY tuple();

CREATE TABLE tab
(
    id UInt64,
    val Map(String, String),
    INDEX idx(mapValues(val)) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = lower(mapValues(val)))
)
ENGINE = MergeTree ORDER BY id;

INSERT INTO tab VALUES (1, 'the quick'), (2, 'foo');

SELECT '-- Preprocessor referencing an ALIAS whose body is captured by a lambda parameter is rejected';

SELECT 'hasToken, hasAllTokens and hasPhrase behave the same way';

SELECT id, hasAnyTokens(a, 'x'), hasAnyTokens(b, 'X'), arrayMap(x -> x, a) FROM tab ORDER BY id;

SELECT count() FROM tab_partially WHERE hasAllToken(text, 'FOo');

SELECT DISTINCT id
FROM tab
PREWHERE hasAllTokens(val, 'hello world')
WHERE hasAllTokens(val, 'hello world')
QUALIFY id
ORDER BY id;

-- check text index was created
SELECT name, type FROM system.data_skipping_indices WHERE table == 'tab' AND database = currentDatabase() LIMIT 1;

INSERT INTO tab SELECT number, 2, 'v' || toString(number) || '_updated' FROM numbers(0, 100000, 3);

-- 3. `hasPhrase` on an extracting `splitByRegexp` index: a String phrase has nothing to extract from, so it
-- tokenizes to nothing and never matches. An Array phrase carries the tokens verbatim and does match.

DROP TABLE IF EXISTS tab_extract_phrase_pp;

SELECT value FROM tab WHERE hasToken(key, 'bar');

SELECT '1. Direct call denied.';

SELECT '15. Replacing a privileged alias in the same statement is allowed.';

INSERT INTO set_source VALUES ('secret');

ALTER TABLE tab ADD INDEX idx_c1 (c1) TYPE text (tokenizer = ngrams(3));

INSERT INTO tab SELECT number, 'word' || toString(number) FROM numbers(8);

-- no-parallel: it checks the number of threads, which can be lowered in presence of other queries
-- https://github.com/ClickHouse/ClickHouse/issues/37900

drop table if exists t;

DELETE FROM lwd_test WHERE id < 30000;

DELETE FROM replicated_table_r2 WHERE name IN ('1','2','3','4');

EXPLAIN AST optimize=0 SELECT * FROM numbers(0);

SELECT translateUTF8('abc', 'efg', '');

select 1.00_00_01;

SELECT tupleElement(('hello', 'world'), 'xyz', 'default');

DROP TABLE t_04813;

SELECT assignCentroid((SELECT vec FROM centroids WHERE cid = 250), 'centroids_dict');

SELECT id FROM dbpedia
ORDER BY cosineDistance(vec, (SELECT vec FROM dbpedia WHERE id = '<dbpedia:Honda>'))
LIMIT 4;

SELECT '-- Unsigned integer reference vector: index usage expected';

-- Distance from the origin grows strictly with id, so the top-k is unique and no tie-break sort key
-- is needed. A second ORDER BY key would disable the vector search optimization.
-- 2560 rows is 21 marks at the granularity pinned above, which is enough for the read pool to
-- hand tasks to several threads: peak_threads_usage reaches 5 here, against the > 2 the assertions
-- below require. It is also the smallest round size that keeps that margin -- 1024 rows is 9 marks
-- and peaks at exactly 2 threads, which fails those assertions outright.
INSERT INTO vs_concurrent
SELECT number, number % 4,
       arrayMap(j -> if(j = 0, toFloat32(number) / 1000.0, toFloat32(0)), range(8))
FROM numbers(2560);

INSERT INTO tab SELECT number, [number/100, number/100] FROM numbers(100);

-- no-fasttest: the fast test build has no vector similarity indexes, because it is built without the `usearch` library
-- no-parallel: other tests clear the whole vector similarity index cache, which would turn the cache hits expected below into misses
-- no-parallel-replicas: the test counts the cache lookups of each search, and with parallel replicas a search can look up its
--     cache entry more than once (also when automatic parallel replicas only collect statistics: the plan built for costing
--     looks it up again)

-- Tests `SYSTEM DROP VECTOR SIMILARITY INDEX CACHE FOR TABLE <table>`: it evicts the cache entries of that table, and keeps
-- the entries of other tables. It requires the privilege on that table only.

DROP TABLE IF EXISTS tab1;

SELECT id FROM tab1 ORDER BY L2Distance(vec1, [0.0, 2.0]) LIMIT 3 FORMAT Null
    SETTINGS log_comment = 'after no table: tab1.idx1';

DROP TABLE IF EXISTS tab_02354_drop_cache_on_cluster;

-- Make sure vector index is loaded and used
WITH [0.0, 2.0] AS reference_vec
SELECT id
FROM tab
ORDER BY L2Distance(vec, reference_vec)
LIMIT 3;

SELECT id FROM t_04839 FINAL PREWHERE length(vec) > 0 ORDER BY cosineDistance(vec, [0., 1.]) LIMIT 1
    SETTINGS vector_search_with_rescoring = 0, apply_prewhere_after_final = 1;

SELECT
    (SELECT hierarchicalKMeans(8, 16, 20, 1000000, 42)(v) FROM blobs)
        = (SELECT hierarchicalKMeans(8, 16, 20, 1000000, 42)(v) FROM blobs) AS same_seed_stable;

DROP TABLE IF EXISTS tab_l2_mismatch;

SELECT id FROM t_05063 ORDER BY L2Distance(`n.values.id`, [0., 1.]) LIMIT 3;

SELECT replaceRegexpAll(trimLeft(explain), '__set_Int32_\\d+_\\d+', '__set_Int32_XXX')
FROM (
    EXPLAIN actions = 1
    SELECT key
    FROM tab
    WHERE key IN (0, 30, 60, 90)
    ORDER BY cosineDistance(vec2, arrayMap(i -> i / 32, range(32)))
    LIMIT 1
    SETTINGS vector_search_filter_strategy = 'auto'
)
WHERE trimLeft(explain) LIKE 'Prewhere filter column: %'
   OR trimLeft(explain) LIKE 'Filter column: %';

SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1
    SELECT id
    FROM tab
    WHERE attr2 >= 1006
    ORDER BY L2Distance(vec, [1.0, 1.0])
    LIMIT 2
    SETTINGS vector_search_filter_strategy = 'prefilter'
)
WHERE explain LIKE '%vector_similarity%';

-- Without `enable_quantized_codec` the codec is rejected.
SET enable_quantized_codec = 0;

SET query_plan_max_limit_for_lazy_materialization = 1000000;

-- Off-center unsigned data: all elements are in [80, 199].
INSERT INTO qc_u8 SELECT number, arrayMap(j -> toUInt8(80 + sipHash64(number, j) % 120), range(64)) FROM numbers(4000);

INSERT INTO quantize_mrl_ok SELECT 1, arrayMap(j -> toFloat32(j), range(64)), arrayMap(j -> toFloat32(j), range(64));

SELECT 'codes_int8', length(vtrunc.quantized) FROM quantize_mrl GROUP BY length(vtrunc.quantized);

-- rabitq is a cosine-only estimator (it drops the vector norm). An L2Distance query uses the codes shortlist ranked by
-- the angle, and the exact rescore ranks by L2Distance.
SELECT 'l2_on_cosine_only_uses_shortlist',
    countIf(explain ILIKE '%quantized shortlist%') > 0
FROM
(
    EXPLAIN PLAN
    SELECT id FROM quantize_auto
    ORDER BY L2Distance(vec, (SELECT vec FROM quantize_auto WHERE id = 123)) ASC
    LIMIT 5 SETTINGS vector_search_index_fetch_multiplier = 50
);

-- The full-precision vectors round-trip unchanged.
SELECT 'full_precision_rows', count() FROM quantize_pq WHERE length(vec) = 64;

-- ~10 granules in a single part.
INSERT INTO quantize_pq_mg (id, vec)
SELECT number, arrayMap(j -> toFloat32(sipHash64(number, j) % 2000 / 1000.0 - 1.0), range(64))
FROM numbers(10000);

-- A moderate shortlist still recovers most true neighbours (a broken popcount scan would collapse recall).
WITH (SELECT vec FROM quantize_rabitq_simd WHERE id = 42) AS ref,
     (SELECT groupArray(id) FROM (SELECT id FROM quantize_rabitq_simd ORDER BY cosineDistance(vec, ref), id LIMIT 10)) AS truth
SELECT 'recall_at_10_ge_8',
    length(arrayIntersect(truth,
        (SELECT groupArray(id) FROM (SELECT id FROM quantize_rabitq_simd ORDER BY cosineDistance(vec, ref) ASC LIMIT 10 SETTINGS vector_search_index_fetch_multiplier = 20)))) >= 8;

-- A moderate shortlist still recovers most true neighbours (a broken estimator would collapse recall).
WITH (SELECT vec FROM quantize_turboquant WHERE id = 42) AS ref,
     (SELECT groupArray(id) FROM (SELECT id FROM quantize_turboquant ORDER BY cosineDistance(vec, ref), id LIMIT 10)) AS truth
SELECT 'recall_at_10_ge_8',
    length(arrayIntersect(truth,
        (SELECT groupArray(id) FROM (SELECT id FROM quantize_turboquant ORDER BY cosineDistance(vec, ref) ASC LIMIT 10 SETTINGS vector_search_index_fetch_multiplier = 20)))) >= 8;

SELECT '10 rows, index_granularity = 8192, GRANULARITY = 1 million --> 1 granule, 1 indexed block';

DROP TABLE IF EXISTS tab_dot_f16;

INSERT INTO tab_cos_i8 VALUES (0, [4.6, 2.3]), (1, [2.0, 3.2]), (2, [4.2, 3.4]), (3, [5.3, 2.9]), (4, [2.4, 5.2]), (5, [5.3, 2.3]), (6, [1.0, 9.3]), (7, [5.5, 4.7]), (8, [6.4, 3.5]), (9, [5.3, 2.5]), (10, [6.4, 3.4]), (11, [6.4, 3.2]);

EXPLAIN indexes = 1
WITH [0.0, 2.0] AS reference_vec
SELECT id, vec, dotProduct(vec, reference_vec)
FROM tab_dot_f64
ORDER BY dotProduct(vec, reference_vec) DESC
LIMIT 3 SETTINGS enable_parallel_replicas = 0;

CREATE TABLE tab(id Int32, vec Array(BFloat16), INDEX idx vec TYPE vector_similarity('hnsw', 'L2Distance', 2) GRANULARITY 2) ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 3;

DROP FUNCTION IF EXISTS constBF16;

CREATE FUNCTION nonConstF32 AS (arg1) -> (SELECT [toFloat32((arg1 % 10)/10), toFloat32((arg1 % 10)/10)]);

CREATE TABLE tab_final
(
    id UInt64,
    ver UInt64,
    vec Array(Float32),
    INDEX idx vec TYPE vector_similarity('hnsw', 'L2Distance', 2) GRANULARITY 100000000
)
ENGINE = ReplacingMergeTree(ver)
ORDER BY id
SETTINGS index_granularity = 1, allow_vector_similarity_index_in_specialized_merge_tree = 1;

-- Expect 16 & 19.

SELECT id
FROM tab
WHERE attr1 > 110
ORDER BY L2Distance(vec, [0.2, 0.3])
LIMIT 4
SETTINGS vector_search_with_rescoring = 1;

WITH CAST([0.0, 2.0] AS Array(Float32)) AS reference_vec
SELECT id, L2Distance(vec, reference_vec)
FROM tab_bf16
ORDER BY L2Distance(vec, reference_vec)
LIMIT 4;

SELECT 'policy on the vector column, no rescoring: correct result';

SELECT id, vec FROM t_04926 ORDER BY cosineDistance(vec, [0., 1.]) LIMIT 1
    SETTINGS vector_search_with_rescoring = 0;

SELECT 'projection on the unrelated dotted column: correct result';

SELECT ProfileEvents['VectorSimilarityIndexCacheHits'], ProfileEvents['VectorSimilarityIndexCacheMisses']
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND current_database = currentDatabase() AND type = 'QueryFinish' AND query LIKE '%ORDER BY L2Distance%'
ORDER BY event_time_microseconds;

SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1
    SELECT id
    FROM tab
    WHERE attr1 > 100
    ORDER BY L2Distance(vec, [1.0, 1.0])
    LIMIT 2
    SETTINGS vector_search_filter_strategy = 'postfilter'
)
WHERE explain LIKE '%vector_similarity%' OR explain LIKE '%minmax%';

INSERT INTO data_horizontal VALUES (1);

select 0 = multiSearchFirstPositionCaseInsensitiveUTF8('\0', CAST([], 'Array(String)'));

select [4] = multiSearchAllPositions(materialize('abcdefgh'), ['defgh']);

select [1] = multiSearchAllPositions(materialize('abcdefgh'), ['abc']) from system.numbers limit 10;

select [2] = multiSearchAllPositions(materialize('abcdefgh'), ['bcdef']) from system.numbers limit 129;

select [6] = multiSearchAllPositions(materialize('abcdefgh'), ['fg']) from system.numbers limit 129;

select [0] = multiSearchAllPositions(materialize('abc'), ['de']);

select [1] = multiSearchAllPositions(materialize('abc'), ['']) from system.numbers limit 10;

select 1 = multiSearchAny(materialize('abcdefgh'), ['ab']);

select 1 = multiSearchAny(materialize('abcdefgh'), ['bcdef']) from system.numbers limit 10;

select 1 = multiSearchAny(materialize('abcdefgh'), ['fg']) from system.numbers limit 10;

select 1 = multiSearchAny(materialize('abcdefgh'), ['def']) from system.numbers limit 129;

select 1 = multiSearchAny(materialize('abcd'), ['cd']);

select 0 = multiSearchAny(materialize('abcd'), ['cdefg']) from system.numbers limit 10;

select 1 = multiSearchFirstPositionUTF8(materialize('абвгдежз'), ['а', 'б', 'в', 'г']) from system.numbers limit 10;

select [4, 1, 1, 2, 6, 1, 1, 0, 4, 1, 14, 0, 10, 0, 16, 6] = multiSearchAllPositions(materialize('jmdqwjbrxlbatqeixknricfk'), ['qwjbrxlba', 'jmd', '', 'mdqwjbrxlbatqe', 'jbrxlbatqeixknric', 'jmdqwjbrxlbatqeixknri', '', 'fdtmnwtts', 'qwjbrxlba', '', 'qeixknricfk', 'hzjjgrnoilfkvzxaemzhf', 'lb', 'kamz', 'ixknr', 'jbrxlbatq']) from system.numbers limit 10;

select [1, 1, 1, 15, 10, 0, 0, 0, 0, 2] = multiSearchAllPositions(materialize('nfoievsrpvheprosjdsoiz'), ['', 'nfo', '', 'osjd', 'vheprosjdsoiz', 'az', 'blhvdycvjnxaipvxybs', 'umgxmpkvuvuvdaczkz', 'gfspmnzidixcjgjw', 'f']) from system.numbers limit 10;

select [1, 18, 12, 0, 0, 1, 1, 3, 7, 0, 0, 0] = multiSearchAllPositionsUTF8(materialize('гсщнфийтфзжцйпфбйалущ'), ['', 'алущ', 'цйпфбйал', 'цвбфцйвсвлицсчнргпцнр', 'х', 'гс', '', 'щн', 'й', 'дгйрвцщтп', 'уитвквоффвцхфишрлерйцувф', 'кфтййлпнзжчижвглзкижн']) from system.numbers limit 10;

select [0, 2, 0, 20, 0, 17, 18, 0, 1, 1, 21, 1, 0, 1, 6, 26] = multiSearchAllPositionsUTF8(materialize('ачйвцштвобижнзжнчбппйеабтцнйн'), ['сзхшзпетншйисщкшрвйшжуогцвбл', 'чйвцштво', 'евз', 'пй', 'хуждапрахитйажрищуллйзвчт', 'чбппйе', 'бппйеабтцнйн', 'схш', 'а', 'ачйвцштвобижнзжнчбпп', 'йеабтцнй', '', 'ег', '', 'штвобижнзжнчбпп', 'цн']) from system.numbers limit 10;

select [6, 0, 0, 0, 10, 0, 1, 4, 0, 15, 0, 2, 2, 6] = multiSearchAllPositionsCaseInsensitive(materialize('QvlLEEsgpydemRZAZcYbqPZHx'), ['eSgpYDEMRzAzcyBQPzH', 'NUabuIKDlDxoPXoZOKbUMdioqwQjQAiArv', 'pRFrIAGTrggEOBBxFmnZKRPtsUHEMUEg', 'CDvyjef', 'YdEMrzaZc', 'BO', '', 'leEsgPyDEmRzaZCYBqPz', 'EzcTkEbqVXaVKXNuoxqNWHM', 'Z', 'cuuHNcHCcLGb', 'V', 'vllEes', 'eS']) from system.numbers limit 10;

select [8, 1, 2, 8, 1, 0, 5, 0, 0, 4, 0, 1, 14, 0, 0, 7, 0, 1] = multiSearchAllPositionsCaseInsensitive(materialize('uyWhVSwxUFitYoVQqUaCVlsZN'), ['XufitYOVqqUACVlszn', '', 'ywH', 'XUFIT', 'uywHvSWXuFIt', 'dGhpjGRnQlrZhzGeInmOj', 'vswXuFitYovqQuA', 'dHCfJRAAQJUZeMJNXLqrqYCygdozjAC', 'rojpIwYfNLECl', 'hVswxufiTYov', 'bgJdgRoye', '', 'ovQ', 'AdVrJlq', 'krJFOKilvBTGZ', 'WxuFITYOV', 'AsskQjNPViwyTF', 'u']) from system.numbers limit 10;

select [4, 1, 0, 7, 0, 7, 1, 1, 0, 3, 7, 0] = multiSearchAllPositionsCaseInsensitiveUTF8(materialize('иОцХКЙвувМИжШдУМУЕйНсБ'), ['ХкйвуВмИжШдУм', '', 'звМАОМЩщЙПшкиТчЩдгТЦмфзеИ', 'вуВМиж', 'КДщчшЙВЕ', 'в', '', 'ИоЦхКЙВувМижШ', 'ЕвТАРи', 'цхКЙвувмИЖШДумуе', 'вУвМи', 'зПШИХчУщШХУвврХйсуЙЗеВЧКНмКШ']) from system.numbers limit 10;

select [6, 1, 15, 5, 0, 0, 0, 3, 2, 4, 0, 12, 0, 2, 0, 3, 1, 6, 0, 0] = multiSearchAllPositionsCaseInsensitiveUTF8(materialize('ГЖФеачМаКчПСпкВкхсПтг'), ['чмАкЧ', '', 'ВкХс', 'ачМА', 'КлтжУлОЛршБЕблФЩ', 'тцуМфж', 'л', 'фе', 'Жф', 'ЕАЧМак', 'лЖЕРТнФбЧЙТййвзШМСплИхбЙЛЖзДпм', 'СпкВК', 'ЩзчжИш', 'жФеАчМ', 'КбЦбйЕШмКтЩЕКдуЩтмпИЕВТЖл', 'ФЕаЧмАКчПСПквкхспТ', 'гжФеАЧмаКчпСп', 'ЧмАК', 'дцкДННМБцйЕгайхшжПГх', 'ТЩбвЦЖАНшрАШФДчОщй']) from system.numbers limit 10;

select 0 = multiSearchAny(materialize('pqqnugshlczcuxhpjxjbcnro'), ['dpeedqy', 'rtsc', 'jdgla', 'qkgudqjiyzvlvsj', 'xmfxawhijgxxtydbd', 'ebgzazqthb', 'wyrjhvhwzhmpybnylirrn', 'iviqbyuclayqketooztwegtkgwnsezfl', 'bhvidy', 'hijctxxweboq', 't', 'osnzfbziidteiaifgaanm']) from system.numbers limit 10;

select 0 = multiSearchAnyUTF8(materialize('апрчвзфжмбутццрйщкар'), ['индхжз', 'жилцовщччгстби', 'ажс', 'фктйамйтаг', 'шммнзачггоннксцушпчн', 'чдлйтзтоцдгзццисц', 'пнбтувщцдсчнщмсакрлгфмгрй', 'овмсйнщзушвщгуитщрхвйодф', 'бзлштезвлаижхбмигйзалчолшеунлц', 'фкжпеввгшгащз', 'тменбщжмсхщсогттршгек', 'чап', 'х', 'шкомегурлнйпшбщглав']) from system.numbers limit 10;

select 1 = multiSearchAnyCaseInsensitiveUTF8(materialize('ШЕшхмеЦХеАСКощеКИфлсТЧИЗЛ'), ['КифЛсТ', 'ХеаСКощЕк', 'КифлсТЧ', 'шХМеЦхЕаскОЩеКИ', 'ЕшхмЕцХеаСК', 'ХЕасКоЩ', 'чИ', 'ЕцхеАсКОЩек', 'ЩЕкИфлс', 'асКощЕкифЛсТ']) from system.numbers limit 10;

select 0 = multiSearchFirstIndex(materialize('iepqqbvekaflprupsmnpoijrld'), ['kqomoeysekwcplpegdwcdoeh', 'mwdvr', 'aobviioktzwzmpilblbdwstndhimabfgct', 'vqustluciruiyfkoontehnwylnauwpol', 'utcqnitztcgr', 'ityszrqmlwzspnrwdcvdhtziob', 'hmll', 'ilfzvuxbkyppwejtp', 'euxdzqcqutnfeiivw', 'rbcjlmjniiznzaktsuawnfjzqjri', 'fzyxlzzretsshklrkwru', 'jrujmdevqqojloz']) from system.numbers limit 10;

select 11 = multiSearchFirstIndexUTF8(materialize('азтммйтшхцхлгдрнтхфжбдрлцхщ'), ['нпучщфвспндщшспзмшочгсщжчйгжбжзжжтн', 'хккдйшабисдузфртнллщпбоуооврайцз', 'йпхрфжждгпнйаспйппвхбргшйвжччт', 'ффеее', 'кежцновв', 'еххрчштарзмкпйззсйлмплхбчбулзибвчбщ', 'шфжйдотрщттфхобббг', 'ожоцжущопгоцимсфчйщцддзнфи', 'цуимеимймкфччц', 'прммщмтбт', 'хцхлгдрнтхфж', 'лгд', 'цжбдаичхпщзцасбиршшикджцунйохдлхй', 'пидхцмхйнспйокнттмййвчщпхап', 'йтйзмеаизкшйошзвфучйирг', 'хцхлгдр']) from system.numbers limit 10;

select 0 = multiSearchFirstIndexCaseInsensitiveUTF8(materialize('жггкщцзщшамдбРЗжйТзвхшАпХСбе'), ['лВТвтлРБжиЛЦвРЦкАЦаНБгуОН', 'рШаавцжзМрзВЧДРСузб', 'оемрЗМгФБНмжп', 'ЛбмХбФЧШГЛХИуТСрфхп', 'ЖшТдтЧйчМР', 'ЧнИМбфУпмЙлШЗТрТИкКИЩОЧеМщПЩлдБ', 'ГвРдПжГдБаснилз', 'уТнТчТРЗИЛ', 'ИТЕВ', 'дИСЖпПнПСНОвсЩЩшНтХЧшВ', 'штабтлМнсчРЗтфсТЩублЕЧйцеЦТтХ', 'ХбхгУШвАзкшЖ']) from system.numbers limit 10;

INSERT INTO producer_02366 (*) VALUES (19, '.1');

EXPLAIN QUERY TREE run_passes = 0 WITH x -> x + 1 AS lambda SELECT lambda(id) FROM test_table;

print real(-inf);

-- 	10 microseconds
print timespan(1tick);

-- == true
print tobool(123);

print tolong('123');

print '-- extend #4 --';

print startofday(datetime(2017-01-01 10:10:17), 1);

print '-- format_datetime';

print array_reverse(dynamic([1,2,3,4]));

print set_intersect(dynamic([4]), dynamic([1, 2, 3]));

iif_test | project name, doubled = iif(value < 20, value * 2, value);

print '-- Customers |where Education contains \'degree\'';

print '-- Customers | where Occupation hassuffix \'Ent\'';

Customers | project url_decode('https%3A%2F%2Fwww.test.com%2Fhello%20word') | take 1;

print extract('(\\b[A-Z]+\\b).+(\\b\\d+)', 1, 'The price of PINEAPPLE ice cream is 20');

print '-- indexof (https://docs.microsoft.com/en-us/azure/data-explorer/kusto/query/indexoffunction); TODO: length and occurrence not supported yet';

-- [removed in the KQL rewrite] Syntax error in KQL query at position 1: 'limit' is a pipeline operator, so it must follow a '|', found 'limit'
-- mv_expand_test_table | mv-expand xy = array_concat(c, d) limit 2| summarize count() by xy;
print '-- mv_expand_test_table | mv-expand with_itemindex=index c,d to typeof(bool) --';

-- [removed in the KQL rewrite] Syntax error in KQL query at position 32: 'make_set' takes 1 argument(s), got 2, found 'make_set'
-- Customers | summarize f_list = make_set(Education, 2) by Occupation | sort by Occupation;
print '-- make_set_if() --';

Customers | project FirstName,LastName,Occupation | take 3 | project FirstName,LastName;

Customers | project FirstName,LastName,Occupation,Education | where FirstName endswith_cs 'a';

SELECT f.* FROM format('CSV', '1,2,"[1,2,3]","[[\'abc\'], [], [\'d\', \'e\']]"') AS f;

select in(untuple(((1), (1))));

CREATE TEMPORARY TABLE test_02327 (name String) AS SELECT * FROM VALUES(('Vasya'), ('Petya'));

SELECT id AS using_id, toTypeName(using_id), t1.id AS t1_id, toTypeName(t1_id), t1.value AS t1_value, toTypeName(t1_value),
t2.id AS t2_id, toTypeName(t2_id), t2.value AS t2_value, toTypeName(t2_value)
FROM test_table_join_1 AS t1 INNER JOIN test_table_join_2 AS t2 USING (id) ORDER BY ALL;

EXPLAIN QUERY TREE select sum(multiIf(a = 1, 1, 0)) from m;

INSERT INTO test_table_for_in VALUES (0), (1);

select * from test_02377 order by n;

CREATE TABLE t_modify_from_lc_2
(
    id UInt64,
    a LowCardinality(UInt32) CODEC(NONE)
)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 8192, index_granularity_bytes = '10Mi';

-- queries with unary function in order by
SELECT a from optimize_sorting order by -a;

DROP TABLE IF EXISTS test_table_in;

DESCRIBE (SELECT cast(tuple(1, 'Value'), 'Tuple (id UInt64, value String)') AS a, a.* EXCEPT id);

DESCRIBE (SELECT cast(tuple(1, 'Value'), 'Tuple (id UInt64, value String)') AS compound_value, arrayMap(x -> compound_value.* EXCEPT value APPLY x -> x, [1,2,3]));

DESCRIBE (SELECT count() OVER (PARTITION BY id, value ORDER BY id ASC, value DESC ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM test_table);

DESCRIBE (SELECT * FROM test_table_join_1 AS t1, test_table_join_2 AS t2);

DESCRIBE (SELECT * FROM test_table_join_1 AS t1 INNER JOIN test_table_join_2 AS t2 USING (id, value) INNER JOIN test_table_join_3 AS t3 USING (id, value));

SYSTEM STOP MERGES test_table_join_2;

drop table if exists test_02381_compact;

SELECT value, changed, type FROM system.settings WHERE name = 'insert_quorum';

SELECT * FROM ( SELECT 'a' AS key ) AS t1
INNER JOIN ( SELECT 'a' AS key ) AS t2
ON t1.key = t2.key;

SELECT materialize([13, 14])[-1];

SELECT joinGet('test_table_join', 'value', toUInt64(0));

DROP TABLE userid_set2;

SELECT arrayMap(x -> x + arrayMap(y -> x + y, [1])[1], [1,2,3]);

CREATE TABLE test_table_nullable
(
    key UInt64,
    value Nullable(UInt16)
) ENGINE=Memory() AS SELECT number, number % 2 == 0 ? NULL : number FROM numbers(1e5);

CREATE DICTIONARY test_dictionary_10_shards_string
(
    key String,
    value UInt16
) PRIMARY KEY key
SOURCE(CLICKHOUSE(TABLE test_table_string))
LAYOUT(SPARSE_HASHED(SHARDS 10))
LIFETIME(0);

select *, _part from mt order by _part;

SET max_bytes_in_join = '10M';

SELECT * FROM lwd_test ORDER BY id, value;

-- beautiful case when we have different sorting key definitions in tables involved in distributed query => different plans => different sorting properties of local aggregation results --
create database if not exists shard_1;

SET join_algorithm='partial_merge';

SELECT argMax(number::String, 1) FROM (Select number as number from numbers(10, 10000)) settings max_threads=1, max_block_size=20000;

SELECT argMinIf(number, number::Float64, number > 2030) from numbers(2032);

SELECT toDecimal128OrDefault(333, 3, 123.456::Decimal128(3)) AS x, toTypeName(x);

SELECT synonyms('en', 'quiz');

desc format(JSONEachRow, '{"x" : {"key" : [42, null]}}');

INSERT INTO 02416_rocksdb VALUES (1, 'String', 10), (2, 'String', 20), (3, 'String', 30), (4, 'String', 40);

SELECT * FROM 02417_test_another ORDER BY key;

SELECT avgWeightedIf(if(number < 50, NULL, number), if(number < 10000, NULL, number), if(number < 10000, NULL, number % 10)) t, toTypeName(t) FROM numbers(100);

insert into test select uniqStateMapForEachResample(30, 75, 30)([map(1, number)], 30) from numbers(10);

-- expected output is 1 because final is turned on
select count() from replacing_mt;

-- expected output
-- 1 c a c
-- 1 c b c
select left_table.id,val_left, val_middle, val_right from left_table
                                                              inner join middle_table on left_table.id = middle_table.id
                                                              inner join right_table on middle_table.id = right_table.id
ORDER BY left_table.id, val_left, val_middle, val_right;

insert into table_to_merge_c values (3,'c');

SELECT count() > 0 FROM (EXPLAIN SELECT * FROM system.numbers ORDER BY number DESC) WHERE explain ILIKE '%Sort%';

CREATE TABLE customer_demographics
(
    `cd_demo_sk` Int64,
    `cd_gender` Nullable(String),
    `cd_marital_status` Nullable(String),
    `cd_education_status` Nullable(String),
    `cd_purchase_estimate` Nullable(Int64),
    `cd_credit_rating` Nullable(String),
    `cd_dep_count` Nullable(Int64),
    `cd_dep_employed_count` Nullable(Int64),
    `cd_dep_college_count` Nullable(Int64)
)
ENGINE = MergeTree ORDER BY cd_demo_sk;

set input_format_json_read_numbers_as_strings=1;

SELECT * FROM (SELECT * FROM (SELECT 0 AS a, toNullable(number) AS b, toString(number) AS c FROM numbers(1000000.)) ORDER BY a DESC, b DESC, c ASC LIMIT 1500) LIMIT 10;

SELECT toDecimal32(1.555,3) IN (1.5551,1.555000);

create table test_null_filter(key UInt64, value UInt32) engine MergeTree order by key SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

select arrayReduceInRanges('uniqStateForEachMapForEach', [(1, 3), (2, 3), (3, 3)], [[map(1, ['a'])], [map(1, ['b'])], [map(1, ['c'])], [map(1, ['d'])], [map(1, ['e'])]]);

set allow_nondeterministic_mutations=1;

-- Predicate works in a different way
drop table if exists rmt;

select * from mut;

SELECT * FROM dictionary('dict') ORDER BY id;

SELECT JSONExtract(data, 'Tuple(
                            a LowCardinality(Int8),
                            b LowCardinality(Int8),
                            c LowCardinality(Int8),
                            d LowCardinality(Int8)
                            )') AS json FROM test_low_cardinality_int;

drop table if exists cc sync;

desc format(CSV, '1,2,3') settings column_names_for_schema_inference='a, b, a';

-- on 21.9 that was done via mutations mechanism
ALTER TABLE column_modify_test MODIFY COLUMN val Nullable(String);

SELECT * FROM t_summing_lc ORDER BY key;

select mortonDecode(2, 4294967286);

select count() from (select number as n from numbers(100000))
where mortonDecode(7, mortonEncode(n % 512, (n*7) % 512, (n*13) % 512, (n*29) % 512, (n*31) % 512, (n*37) % 512, (n*41) % 512))
   != (n % 512, (n*7) % 512, (n*13) % 512, (n*29) % 512, (n*31) % 512, (n*37) % 512, (n*41) % 512);

create table morton_numbers_mask_02457(
    n1 UInt8,
    n2 UInt8,
    n3 UInt8,
    n4 UInt8
)
    Engine=MergeTree()
    ORDER BY n1 SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

select count() from (select number as n from numbers(50000))
where mortonDecode(tuple(7), mortonEncode(tuple(7), n % 512)) != tuple(n % 512);

desc s3Cluster('test_cluster_one_shard_three_replicas_localhost', 'http://localhost:11111/test/{a,b}.tsv', headers(MyCustomHeader = 'SomeValue'));

SELECT subtractInterval(tuple(INTERVAL 1 DAY, INTERVAL 1 SECOND), INTERVAL 1 SECOND);

SELECT dateDiff('quarter', toDate32('1927-01-01', 'UTC'), toDate32('1927-04-01', 'UTC'), 'UTC');

SELECT dateDiff('minute', toDateTime('2015-08-18 00:00:00', 'UTC'), toDate32('2015-08-19', 'UTC'), 'UTC');

SELECT dateDiff('day', toDateTime('2015-08-18 00:00:00', 'UTC'), materialize(toDate32('2015-08-19', 'UTC')), 'UTC');

-- A pattern without wildcards is equivalent to an inequality, so the primary key is used (exact point range).
SELECT count() FROM data WHERE str NOT LIKE 'a' SETTINGS force_primary_key=1;

insert into test select x, z from file(02458_data.jsonl);

DROP TABLE IF EXISTS session;

DROP ROW POLICY IF EXISTS row_level_policy_prewhere_policy0 ON row_level_policy_prewhere;

INSERT INTO t2__fuzz_47 VALUES (1);

CREATE TABLE welch_ttest__fuzz_7 (left UInt128, right UInt128) ENGINE = Memory;

select toYYYYMMDD(toDate(recordTimestamp, 'Europe/Amsterdam')), toDate(recordTimestamp, 'Europe/Amsterdam'), toUInt32(1665519765) as recordTimestamp, toTypeName(recordTimestamp);

SELECT number FROM numbers(30) LIMIT 1;

SELECT today() + INTERVAL 1::Int128 DAY - today();

WITH materialize(map(1, 2, 3, NULL)) AS m SELECT m[1], m[2], m[3];

SELECT JSONExtract('{"a": "123456"}', 'a', 'FixedString(6)');

SELECT analysisOfVariance(number :: Decimal256(5), number % 2) FROM numbers(10) FORMAT Null;

SELECT positive_modulo(1000, 32);

SELECT '-- splitByChar';

SELECT splitByString('', 'a==b=c=d', 3) SETTINGS splitby_max_substrings_includes_remaining_string = 0;

SELECT splitByString('', 'a==b=c=d', 9) SETTINGS splitby_max_substrings_includes_remaining_string = 1;

SELECT splitByRegexp('', 'a12bc23de345f') SETTINGS splitby_max_substrings_includes_remaining_string = 1;

SELECT splitByAlpha('ab.cd.ef.gh', 0) SETTINGS splitby_max_substrings_includes_remaining_string = 1;

SELECT splitByWhitespace('Nein, nein, nein! Doch!', 2);

SELECT sum(b), count(b) from (SELECT x as b FROM (SELECT sum(b) as x, count(b)  FROM fuse_tbl) );

SET param_id=42;

SELECT age('month', toDate('2017-12-31'), toDate('2017-01-01'));

SELECT age('minute', materialize(toDate('2017-12-31')), materialize(toDate('2018-01-01')), 'UTC');

SELECT age('week', toDateTime('2024-01-01 10:50:00', 'UTC'), toDateTime('2024-01-10 10:40:00', 'UTC'));

SELECT age('minute', toDateTime64('1927-01-01 00:00:00', 3, 'UTC'), toDate32('1927-01-02', 'UTC'), 'UTC');

SELECT age('week', toDate32('2015-08-18', 'UTC'), toDate('2015-08-25', 'UTC'), 'UTC');

SELECT age('day', materialize(toDate32('1927-01-01', 'UTC')), materialize(toDateTime64('1927-01-02 00:00:00', 3, 'UTC')), 'UTC');

-- With DateTime
-- DateTime64 vs DateTime
SELECT age('second', toDateTime64('2015-08-18 00:00:00', 0, 'UTC'), toDateTime('2015-08-18 00:00:00', 'UTC'));

SELECT age('second', materialize(toDateTime('2015-08-18 00:00:00', 'UTC')), materialize(toDateTime64('2015-08-18 00:00:10', 3, 'UTC')));

SELECT *, id FROM (SELECT [1] AS value) AS subquery ARRAY JOIN value AS id INNER JOIN test_table USING (id);

SELECT finalizeAggregation(CAST(unhex('1003000001000000020000000300'),
                                'AggregateFunction(uniq, UInt64)'));

SELECT count() FROM tab_bool WHERE col_bool = true AND col_bool = 'false';

-- Context: https://github.com/ClickHouse/ClickHouse/issues/42916

-- STRING WITH 10 CHARACTERS
-- SELECT version() AS v, hex(argMaxState('0123456789', number)) AS state FROM numbers(1) FORMAT CSV

CREATE TABLE argmaxstate_hex_small
(
    `v` String,
    `state` String
)
ENGINE = TinyLog;

insert into aggr select 1, maxState('');

SELECT * FROM system.mutations WHERE database = currentDatabase() AND table = 'testing' AND not is_done;

SELECT if(number % 2, toNullable(1), NULL) FROM numbers(2);

DROP TABLE IF EXISTS dm_metric_small2;

SELECT (SELECT toIntervalHour(5)) AS interval, toDateTime('2017-01-01 00:00:00') + interval AS res;

SELECT minMap([number % 3, number % 4 - 1], [number :: UInt256, NULL]) FROM numbers(3) GROUP BY number WITH ROLLUP ORDER BY number;

drop table test_02480_support_wildcard_write2;

CREATE TABLE arrays_test
(
    s String,
    arr1 Array(UInt8),
    map1 Map(UInt8, String),
    map2 Map(UInt8, String)
) ENGINE = Memory;

SELECT 'UNION: expect SHUFFLE injected into each child';

create table issue_46128 (
	id Int64,
	a LowCardinality(Nullable(String)),
	b LowCardinality(Nullable(String))
) Engine = MergeTree order by id
as  select number%100, 'xxxx', 'yyyy' from numbers(10);

-- Test that now division by zero doesn't occur without explicit condition
SELECT intDiv(b, c) FROM test_filter;

DROP TABLE tmp_02482;

DROP TABLE IF EXISTS t_result_projections;

ALTER TABLE 02483_substitute_udf ADD COLUMN new_number UInt32 DEFAULT 02483_plusthree(id);

create table rmt (n int) engine=ReplicatedMergeTree('/test/02468/{database}', '1') order by tuple() partition by n % 2 settings replicated_max_ratio_of_wrong_parts=0, max_suspicious_broken_parts=0, max_suspicious_broken_parts_bytes=0;

alter table rmt add index idx1 date(ts) TYPE MinMax GRANULARITY 1;

SELECT '== Test SELECT ... FINAL - no is_deleted ==';

------------------------------

DROP TABLE IF EXISTS testSettingsR1;

CREATE TABLE testCollapsingMT (uid String, version UInt32, is_deleted UInt8, sign Int8) ENGINE = CollapsingMergeTree(sign) Order by (uid) SETTINGS clean_deleted_rows='Always', allow_experimental_replacing_merge_with_cleanup=1;

SELECT count()
FROM tab FINAL;

CREATE TABLE table2 (column1 String, column2 String, column3 String) ENGINE=MergeTree() ORDER BY tuple();

SELECT -1_2_3_4;

SELECT -34e+2_1;

-- Negative floating point (with .) with negative scientific notation
SELECT -1.3_4e-21;

-- Hex
SELECT 0x1_234;

SELECT -0x1.2_34p+0_1;

select sumArray([NULL, NULL]);

SELECT toUInt64(42) AS x FORMAT Vertical SETTINGS use_query_cache = 1;

SYSTEM CLEAR QUERY CACHE TAG 'tag';

-- RENAME
RENAME TABLE eligible_test TO eligible_test2 SETTINGS use_query_cache = true;

CREATE TABLE db1.tab(a UInt64, PRIMARY KEY a);

-- Create an entry in the query cache
SELECT 1 SETTINGS use_query_cache = true FORMAT Null;

-- Field 'query_cache_usage' should be 'None'
SELECT type, query, query_cache_usage
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND current_database = currentDatabase()
    AND query = 'SELECT 124437993;'
    AND type = 'QueryFinish'
ORDER BY type, query_cache_usage;

-- Run query which reads multiple chunks (small max_block_size), cache result in query cache, but **disable** squashing of partial results
SELECT '-- insert with disabled squashing';

SELECT query, tag FROM system.query_cache;

SET query_cache_max_size_in_bytes = 1;

SELECT id1, val, key1, b, x FROM t1 ALL RIGHT JOIN tj ON t1.id1 == tj.key1 AND t1.id2 == tj.key2 ORDER BY key1 FORMAT TSVWithNames;

SELECT t.b, tj.b FROM t ALL RIGHT JOIN tj ON t.key1 == tj.key1 AND t.key2 == tj.key2 ORDER BY t.key1 FORMAT TSVWithNames;

SELECT concatWithSeparator('|', toFixedString('a', 1), materialize('b')) == 'a|b';

SELECT concatWithSeparator('|', 'a', materialize('foo' :: String)) == 'a|foo';

select sum(if((number % NULL) = 2, 0, 1)) FROM numbers(1024) settings optimize_rewrite_sum_if_to_count_if=1;

with '2018-01-12 22:33:44' as s, toDateTime(s) as datetime, toDateTime64(s, 6) as datetime64, toDate(s) as date, toDate32(s) as date32 SELECT formatDateTimeInJodaSyntax(datetime, 'aa'), formatDateTimeInJodaSyntax(datetime64, 'aa'), formatDateTimeInJodaSyntax(date, 'aa'), formatDateTimeInJodaSyntax(date32, 'aa');

with '2018-01-12 22:33:44.55' as s, toDateTime64(s, 6) as datetime64 SELECT formatDateTimeInJodaSyntax(datetime64, 'SSSSSSSSSS');

SELECT fromUnixTimestampInJodaSyntax(1669804872, 'MMMM', 'UTC');

INSERT INTO t_s3_events_02496 SELECT number FROM numbers(10) SETTINGS s3_truncate_on_insert=1;

SELECT transform(number, [2, 4, 6], ['google', 'censor.net', 'yahoo'], 'other') as value, value FROM system.numbers LIMIT 10;

desc format(JSONEachRow, '{"x" : [[], [null], [1, 2, 3]]}');

desc format(CSV, '"{\'a\' : null}"\n"{\'b\' : 1}"');

SELECT sum((2 * id) as func), func FROM test_table GROUP BY id;

SELECT key1, key2, key3, attr FROM t1 ALL INNER JOIN tj USING (key1, key3, key2) ORDER BY key1;

-- non-standard escape characters (i.e not \n, \r, \t and etc), back-slash should be preserved
-- expected output: {'amount\\z':'$5\\h','currency':'\\$USD'}
WITH
    extractKeyValuePairs('currency:\$USD, amount\z:$5\h') AS s_map,
    CAST(
            arrayMap(
                    (x) -> (x, s_map[x]), arraySort(mapKeys(s_map))
                ),
            'Map(String,String)'
        ) AS x
SELECT
    x;

-- Quoting character must be escaped, otherwise key will be discarded. Consider using `unexpected_quoting_character_strategy`
WITH
    extractKeyValuePairs('key:"#123"junk", second_key:0') as s_map,
    CAST(
        arrayMap(
            (x) -> (x, s_map[x]), arraySort(mapKeys(s_map))
        ),
        'Map(String,String)'
    ) AS x
SELECT
    x;

SELECT arrayReduce('quantile(0.5)', []::Array(DateTime('UTC')));

SELECT b, a, JSONLength(grp_aggreg, 100, NULL) FROM test_table SETTINGS optimize_aggregation_in_order = 1;

INSERT INTO test_02504 values (1, 1) (2, 2), (3, 3);

select dictGet(regexp_dict1, ('name', 'version'), key) from needle_table;

INSERT INTO data_table SELECT number, number, number FROM numbers(10);

SELECT count() FROM datetime_date_table WHERE col_date > '2020-03-04 10:20:45.100'::DateTime64(3);

SELECT * FROM table_02513;

EXPLAIN PLAN header = 1
SELECT a.a2, d.d2 FROM a JOIN b USING (k) JOIN c USING (k) JOIN d USING (k);

SELECT covarSampMatrix(a_value) FROM (select a_value from fh limit 1);

SET group_by_overflow_mode = 'any', max_rows_to_group_by = 1000, totals_mode = 'after_having_auto';

CREATE OR REPLACE TABLE local (x Int8) ENGINE = Memory;

EXPLAIN QUERY TREE run_passes = 1 select sum(if(number % 2, 0, number)) from numbers(100);

select groupArrayLast(100)([number+1]) state from remote('127.{1,1}', view(select * from numbers(10)));

select throwIf(count() != 4) from remote('127.0.0.{1,2}', currentDatabase(), t3) group by a format Null;

drop table t8;

select replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') from (
    explain actions=1 select a from t15 group by a
) where explain like '%Skip merging: %'
settings force_aggregate_partitions_independently = 0;

insert into t22 select number, number from numbers_mt(1e6);

with toDate('2023-01-09') as date_mon, date_mon - 1 as date_sun select toDayOfWeek(date_mon, 2), toDayOfWeek(date_sun, 2);

SELECT arrayShuffle(groupArray(toUInt64(x)),0xbad_cafe) FROM (SELECT number as x from system.numbers LIMIT 100);

SELECT arrayPartialShuffle([1,2,3,4,5,6,7,8,9,10], 2, 0xbad_cafe);

DROP TABLE data_a_02187;

DROP TEMPORARY TABLE IF EXISTS table_replicated_merge_tree_02525;

INSERT INTO foo VALUES (1, 2), (3, 4);

SELECT grouping(id) AS grouping_id, grouping(value) AS grouping_value, id, value FROM test_table
GROUP BY CUBE (id, value) ORDER BY grouping_id, grouping_value;

select hex(sipHash64Keyed((toUInt64(506097522914230528), toUInt64(1084818905618843912)),
                           char(0, 1, 2, 3, 4)));

select hex(sipHash64Keyed((toUInt64(506097522914230528), toUInt64(1084818905618843912)),
                           char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31)));

select hex(sipHash64Keyed((toUInt64(506097522914230528), toUInt64(1084818905618843912)),
                           char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58)));

select sipHash64Keyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)) == sipHash64(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22));

select sipHash64Keyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49)) == sipHash64(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49));

select sipHash128Keyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)) == sipHash128(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12));

select sipHash128Keyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39)) == sipHash128(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39));

select hex(sipHash64Keyed());

CREATE TABLE sipHashKeyed_keys (key Tuple(UInt64, UInt64), val UInt64) ENGINE=Memory;

INSERT INTO sipHashKeyed_keys FORMAT VALUES ({'a':'b', 'c':'d'}), ({'e':'f', 'g':'h'});

-- no-asan: the flaky check complains that the test sometimes runs > 60 sec on asan builds

set allow_suspicious_codecs=1;

SELECT '- const needle, non-const replacement';

DROP TABLE IF EXISTS test_tab;

SELECT * FROM wrong_metadata ORDER BY column1_renamed FORMAT JSONEachRow;

CREATE TABLE t_compact_vertical_merge (id UInt64, s LowCardinality(String), arr Array(UInt64))
ENGINE MergeTree ORDER BY id
SETTINGS
    index_granularity = 16,
    min_bytes_for_wide_part = 0,
    min_rows_for_wide_part = 100,
    vertical_merge_algorithm_min_rows_to_activate = 1,
    vertical_merge_algorithm_min_columns_to_activate = 1,
    allow_vertical_merges_from_compact_to_wide_parts = 1,
    min_bytes_for_full_part_storage = 0;

INSERT INTO 02540_date VALUES('toUInt16(65534)', toUInt16(65534));

SELECT x, txt FROM 02540_date WHERE txt == 'toUInt16(65535)';

SELECT (x == CAST(65536 as Date)), txt FROM 02540_date WHERE txt == 'toInt32(65536)';

SELECT DISTINCT *
FROM
    (
        SELECT DISTINCT *
        FROM
            (
                SELECT DISTINCT
                    0.5,
                    number % 65536 AS number
                FROM numbers(2)
                ORDER BY
                    ignore(ignore(-1, 10.0001)) DESC NULLS LAST,
                    ignore(2147483648) DESC NULLS FIRST,
                    ignore(255, 0.0001) ASC,
                    number ASC
            )
        ORDER BY number ASC NULLS FIRST
    )
WHERE ignore(2147483648)
ORDER BY number DESC;

select transform(2, [1,2], ['a','b'], materialize('c'));

SELECT transform(toString(number), ['2', '4', '6'], [29, 20, 21], 22) as x FROM numbers(10) GROUP BY x ORDER BY x;

INSERT INTO t1(c1) VALUES (1);

select hex(sipHash128ReferenceKeyed((toUInt64(506097522914230528), toUInt64(1084818905618843912)),
                           char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17)));

select hex(sipHash128ReferenceKeyed((toUInt64(506097522914230528), toUInt64(1084818905618843912)),
                           char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44)));

select sipHash128ReferenceKeyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8)) == sipHash128Reference(char(0, 1, 2, 3, 4, 5, 6, 7, 8));

select sipHash128ReferenceKeyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35)) == sipHash128Reference(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35));

select sipHash128ReferenceKeyed((toUInt64(0),toUInt64(0)),char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62)) == sipHash128Reference(char(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62));

INSERT INTO t_json_attach_partition FORMAT JSONEachRow {"b": 1, "c" : {"k1": [1, 2]}};

INSERT INTO test_2554_tinylog SELECT 1;

SET enable_multiple_prewhere_read_steps=true, move_all_conditions_to_prewhere=true;

ALTER TABLE test_02559 ADD COLUMN y UInt8 DEFAULT 0;

DROP TABLE t_02559;

SELECT countDigits(12345);

INSERT INTO t VALUES('Hallo Welt');

SELECT today() AS a
ORDER BY a ASC WITH FILL FROM now() - toIntervalMonth(1) TO now() + toIntervalDay(1) STEP 82600;

select regexpExtract('100-200', '([a-z])', materialize(1));

INSERT INTO 02563_db.test_merge_table_2 VALUES (1, 'Value_1');

CREATE TABLE t5 (a UInt64, b UInt64) ENGINE = Log;

SELECT DATE_FORMAT(toDateTime('2018-01-02 22:33:44'), '%c'), DATE_FORMAT(toDate32('2018-01-02'), '%c');

SET limit = 0;

select '#45440';

SELECT
    argMax(col1, timestamp) AS col1,
    col1 / 10 AS final_col,
    final_col + 1 AS final_col2
FROM ttttttt
GROUP BY col3;

create table log_proxy_02572 as system.query_log engine=Distributed('test_shard_localhost', currentDatabase(), 'receiver_02572');

SELECT max(cityHash64(*)) > 0 FROM (SELECT quantile(0.1)(d), quantile(0.5)(d) FROM datetime);

-- You cannot query EPHEMERAL

DROP TABLE IF EXISTS m;

CREATE TABLE ipv4_t64 (uid Int16, ip IPv4 CODEC(T64), INDEX ip_idx ip TYPE bloom_filter GRANULARITY 4) ENGINE=MergeTree ORDER BY uid;

-- this SELECT produces empty chunk in FillingTransform

SET enable_positional_arguments = 0;

-- Make multiple parts
INSERT INTO 02581_trips SELECT number, number, '' FROM numbers(10000);

-- operand can be Inf
SELECT WIDTH_BUCKET(-Inf, 0, 10, 10);

SELECT a FROM ( select * from ( select 1 AS a UNION ALL select 1 as a) ) AS t1, ( select * from (  select 2 AS b, 3 AS c UNION ALL select 2 as b, 3 as c )) AS t2;

select generateRandomStructure(5, 4);

-- this mutation cannot be started until previuos ALTER finishes (in background), and will lead to DROP COLUMN failed with BAD_ARGUMENTS
ALTER TABLE test ADD COLUMN x UInt32 default 0;

select quantilesGK(10000, 0.25, 0.5, 0.75, 0.0, 1.0, 0, 1)(number + 1) from numbers(1000);

SELECT name, type, serialization_kind FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_sparse_mutations_1' AND column = 's' AND active
ORDER BY name;

DROP TABLE IF EXISTS t_sparse_mutations_4;

INSERT INTO t VALUES (2),(3);

-- year
select parseDateTime('2020', '%Y', 'UTC') = toDateTime('2020-01-01', 'UTC');

select parseDateTime('365', '%j', 'UTC') = toDateTime('2000-12-30', 'UTC');

select parseDateTime('01', '%l', 'UTC') = toDateTime('1970-01-01 01:00:00', 'UTC');

select parseDateTimeOrNull('10:04:11 03-07-2019', '%s:%i:%H %d-%m-%Y', 'UTC') = toDateTime('2019-07-03 11:04:10', 'UTC');

-- parseDateTime64OrNull
select parseDateTime64OrNull('2021-01-04 23:12:34.118') = toDateTime64('2021-01-04 23:12:34.118000', 6);

select parseDateTimeInJodaSyntax('69', 'YY', 'UTC') = toDateTime('2069-01-01', 'UTC');

select parseDateTimeInJodaSyntax('21', 'CC', 'UTC') = toDateTime('2100-01-01', 'UTC');

select parseDateTimeInJodaSyntax('1999 /11', 'yyyy /DD', 'UTC') = toDateTime('1999-01-11', 'UTC');

select parseDateTimeInJodaSyntax('24 PM', 'k a', 'UTC') = toDateTime('1970-01-01 00:00:00', 'UTC');

select parseDateTimeInJodaSyntaxOrNull('2001 invalid 366 2000', 'yyyy D yyyy', 'UTC') IS NULL;

select parseDateTime64InJodaSyntax('2023-02-28 23:22:33America/Los_Angeles', 'yyyy-MM-dd HH:mm:ssz') = toDateTime64('2023-03-01 07:22:33', 0);

select parseDateTime64InJodaSyntax('2300-01-01 00:00:00', 'yyyy-MM-dd HH:mm:ss') = toDateTime64('2300-01-01 00:00:00', 0);

insert into table function  null() select 1, 'str';

CREATE TABLE test_table_join
(
    id UInt64,
    value String
) ENGINE = Join(All, inner, id);

-- rounding
SELECT toDecimalString(-2, 77);

SELECT n, FROM (SELECT 1 AS n);

SELECT DISTINCT decodeURLComponent(encodeURLComponent(randomString(100) AS x)) = x FROM numbers(100000);

DROP TABLE IF EXISTS 02680_datetime_monotonic_check_lc;

INSERT INTO t1 SELECT number, number * 10, number * 100, number * 1000 FROM numbers(1000000);

select table from system.dropped_tables where table = '02681_undrop_uuid_on_cluster' limit 1;

select table from system.dropped_tables where table = '02681_undrop_log' limit 1;

SELECT 1.1::Decimal(60, 30);

SELECT mapAdd(map('Hello', 1.2::Decimal128(30), 'World', 3.4::Decimal128(30)), map('World', 5.6::Decimal128(30), 'GoodBye', -111.222::Decimal128(30)));

select 1 as x from t_str where cast('1970-01-01' as date) <= cast((select max('1970-01-01') from numbers(1)) as date);

select * from (select 1 as id) t1 inner join (select 1 as id) t2 on t1.id=t2.id inner join (select 1 as id) t3 on t1.id=t3.id where t1.id in temp_table3;

DROP TABLE 25400_dropped_tables;

INSERT INTO foo SELECT number, number FROM numbers(100);

---SettingFieldURI

select changed from system.settings where name = 'format_avro_schema_registry_url';

SELECT 
roundBankers(kolmogorovSmirnovTest(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('two-sided')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('less')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('greater')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','auto')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('less','auto')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('greater','auto')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','exact')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('less','exact')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('greater','exact')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','asymp')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('less','asymp')(left, right).2, 6),
roundBankers(kolmogorovSmirnovTest('greater','asymp')(left, right).2, 6) ,
roundBankers(kolmogorovSmirnovTest(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('two-sided')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('less')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('greater')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','auto')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('less','auto')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('greater','auto')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','exact')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('less','exact')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('greater','exact')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('two-sided','asymp')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('less','asymp')(left, right).1, 6),
roundBankers(kolmogorovSmirnovTest('greater','asymp')(left, right).1, 6) 
from kstest;

SHOW COLUMNS FROM `$4@^7`;

SELECT
    range(1),
    arrayMap(x -> arrayMap(x -> x, range(x)), [1]);

SELECT [1, 2, 3]::Array(UInt64) AS x, [4, 5, 6]::Array(UInt64) AS y, dotProduct(x, y) AS res, toTypeName(res);

SELECT (1::UInt16, 2::UInt8, 3::Float32) AS x, (4::Int16, 5::Float32, 6::UInt8) AS y, dotProduct(x, y) AS res, toTypeName(res);

INSERT INTO t_memory_compressed VALUES (2, 'bar', range(5), map('k2', 'v2'));

SHOW CREATE DATABASE replicated_database_params;

SELECT soundex('M\acDonald22321');

SELECT sum(id) FROM test FORMAT Null;

SELECT arrayDifference([toInt128(1), 3]), toTypeName(arrayDifference([toInt128(1), 3]));

CREATE TABLE tab (line String, patterns Array(String)) ENGINE = MergeTree ORDER BY line;

select * from urlCluster('test_cluster_two_shards_localhost', 'http://localhost:11111/test/{a,b,c}.tsv', 'TSV') ORDER BY c1, c2, c3;

drop table if exists dummy;

SELECT a, b, and(a, b), or(a, b), xor(a, b) FROM test_table_nullable;

SHOW INDEX FROM tbl WHERE index_type LIKE '%minmax%';

-- Check that table size is less than 100K
SELECT engine_full, total_rows, total_bytes < 100_000 FROM initial_table_size;

INSERT INTO group_by_null_key VALUES (null, null), (null, null);

DROP TABLE t_async_inserts_flush;

insert into ts VALUES (3, 7, 1), (5, 1, 1), (5, 3, 1);

SELECT name, type FROM system.dictionaries WHERE database = currentDatabase() AND name = 'dict_hashed_simple_Decimal128';

SELECT '=============== analyzer: INNER QUERY (PARALLEL), QUERIES EXECUTED BY PARALLEL INNER QUERY ALONE ===============';

DROP TEMPORARY TABLE IF EXISTS src;

DELETE FROM t_sparse_mutation WHERE id % 2 = 0;

SELECT * FROM t1 ASOF LEFT JOIN t2 ON t1.a = t2.a AND t1.b > t2.b ORDER BY t1.b;

-- TODO: When cityHash64() fully supports Nullable: https://github.com/ClickHouse/ClickHouse/pull/58754
--       the next two blocks can be simplified: arrays_out_02735 intermediate table is not needed,
--       a.csv and b.csv are not needed.

drop table if exists arrays_02735;

select tupleElement(c, 'statistics') from file(statistics_02735.parquet, ParquetMetadata) array join tupleElement(row_groups[1], 'columns') as c;

desc file(date_as_uint16.parquet);

SELECT [1,2] AS arr1, [1,2,3,4] AS arr2, round(arrayJaccardIndex(arr1, arr2), 2);

SELECT timezone(), timezoneOf(now());

CREATE DICTIONARY test_dictionary_load_factor
(
    key UInt64,
    value UInt16
) PRIMARY KEY key
SOURCE(CLICKHOUSE(TABLE test_table))
LAYOUT(HASHED(MAX_LOAD_FACTOR 0.90))
LIFETIME(0);

SELECT sum(A) FROM (SELECT multiIf(1, 1, NULL) as A);

SELECT space(3::Int64), length(space(3::Int64));

SELECT space(i16), length(space(i16)) FROM defaults;

INSERT INTO parallel_replicas_plain SELECT toString(number) FROM numbers(10);

SELECT arrayPackBitsToUInt64(x -> x, [1, 0, 0, 0, 0, 1]);

SELECT arrayPackBitsToUInt64(x -> x, [toUInt128('18446744073709551616'), 0, 0, 0, 0, 0, 0, 0]);

SELECT value
FROM (SELECT (corr(value_1, value_1) OVER test_window) AS value FROM test_table WINDOW test_window AS (PARTITION BY value_2 ORDER BY id ASC)) as subquery
WHERE not (not (value <> value));

SELECT * from ( EXPLAIN indexes = 1 SELECT * FROM data_02771 WHERE x = 1 AND y = 2 SETTINGS ignore_data_skipping_indices='xy_idx' ) WHERE explain NOT LIKE '%Expression%' AND explain NOT LIKE '%Filter%';

CREATE TABLE data
(
    key  Int,
    v1   DateTime,
    INDEX v1_index v1 TYPE minmax GRANULARITY 1
) ENGINE=AggregatingMergeTree()
ORDER BY key
SETTINGS index_granularity=8192, min_bytes_for_wide_part=0, min_rows_for_wide_part=0;

INSERT INTO source values ('2024-01-01', '2024-01-01 00:00:00', '2024-01-01', '2024-01-01 00:00:00.000', 4);

SELECT count(*) FROM source WHERE toYYYYMM(dt_32) <> 202312;

SELECT 'The reference time point is 2023-06-30 23:59:30';

DROP TABLE IF EXISTS date_t;

EXPLAIN QUERY TREE run_passes=1 SELECT value1 FROM date_t WHERE toYYYYMM(date1) = 199300 AND id BETWEEN 1 AND 3;

DROP TABLE IF EXISTS date32_t;

INSERT INTO summing_merge_tree_datetime64 SELECT 1 pk, '2023-05-01 23:55:55.100' timestamp, 2 value;

-- We check only that no exception was thrown
EXPLAIN PIPELINE
SELECT
    pageId,
    [prev_active_ts, timestamp] AS inactivity_timestamps,
    timestamp - prev_active_ts AS inactive_duration,
    timestamp
FROM
(
    SELECT
        pageId,
        timestamp,
        neighbor(timestamp, -1) AS prev_active_ts
    FROM session_events
    WHERE (type IN (
        SELECT type
        FROM event_types
        WHERE active = 1
    )) AND (sessionId = '693de636-6d9b-47b7-b52a-33bd303b6255') AND (session_events.clientId = 141) AND (pageId = 1686053240314)
    ORDER BY timestamp ASC
)
WHERE runningDifference(timestamp) >= 500
ORDER BY timestamp ASC
FORMAT Null;

set secondary_indices_enable_bulk_filtering = 0;

CREATE TABLE test_block_mismatch
(
    a UInt32,
    b DateTime
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(b)
ORDER BY (toDate(b), a);

# Memory, MergeTree, and ReplicatedMergeTree

CREATE TABLE t (x UInt8) ENGINE = Memory COMMENT 'Hello';

SET calculate_text_stack_trace = 0;

SELECT transform(2, [-1, 2], ['f', 's'], 'g');

select substringIndex(materialize('www.clickhouse.com'), '.', -4);

select SUBSTRING_INDEX('www.clickhouse.com', '.', 2);

select substringIndexUTF8('富强，民主，文明', '，', materialize(4));

select transform(null, [1, 2], [toDateTime64(1, 3, 'UTC'), toDateTime64(2, 3, 'UTC')], toDateTime64(0, 3, 'UTC'));

SELECT upperUTF8(materialize('aaaaАБВГaaaaaaaaaaaaАБВГAAAAaaAA')) FROM numbers(2);

select hasSubsequence(materialize('garbage'), materialize(''));

select hasSubsequenceCaseInsensitiveUTF8('для онлайн обработки аналитических запросов (OLAP)', 'я раб');

DROP TABLE t_02809_set;

select initcap('hello world');

SELECT '-- count() ------------------------------';

CREATE TABLE pk_test1 (a String PRIMARY KEY, b String, c String);

SELECT 'non-leap year:', to_utc_timestamp(toDateTime('2023-02-29 11:22:33'), 'EST'), from_utc_timestamp(toDateTime('2023-02-29 11:22:33'), 'EST') SETTINGS session_timezone='Europe/Moscow';

INSERT INTO my_table (values) VALUES ([12, 3, 1]);

CREATE INDEX idx_tab2_0 ON tab2 (col0 DESC);

CREATE INDEX idx_tab2_0 ON tab2 (col1 DESC,col4);

CREATE INDEX idx_tab2_0 ON tab2 (col3,col0 DESC,col1);

CREATE INDEX idx_tab2_0 ON tab2 (col4,col3 DESC,col0 DESC);

CREATE INDEX idx_tab2_1 ON tab2 (col1 DESC,col4 DESC,col3,col0 DESC);

CREATE INDEX idx_tab2_1 ON tab2 (col4 DESC);

CREATE INDEX idx_tab2_2 ON tab2 (col0,col4);

CREATE INDEX idx_tab2_2 ON tab2 (col3,col0);

CREATE INDEX idx_tab2_3 ON tab2 (col0,col4 DESC,col1 DESC,col3);

CREATE INDEX idx_tab2_3 ON tab2 (col3,col1 DESC);

CREATE INDEX idx_tab2_4 ON tab2 (col0,col4 DESC);

CREATE INDEX idx_tab2_4 ON tab2 (col4,col0);

CREATE INDEX idx_tab2_5 ON tab2 (col3 DESC,col4,col1 DESC);

CREATE INDEX idx_tab3_0 ON tab3 (col0 DESC,col4,col1);

CREATE INDEX idx_tab3_0 ON tab3 (col1,col3 DESC,col4 DESC);

CREATE INDEX idx_tab3_0 ON tab3 (col4 DESC,col1);

CREATE INDEX idx_tab3_1 ON tab3 (col0,col3);

CREATE INDEX idx_tab3_1 ON tab3 (col3 DESC,col4);

CREATE INDEX idx_tab3_2 ON tab3 (col0 DESC,col1 DESC);

CREATE INDEX idx_tab3_2 ON tab3 (col3 DESC,col1 DESC);

CREATE INDEX idx_tab3_2 ON tab3 (col4,col1 DESC);

CREATE INDEX idx_tab3_3 ON tab3 (col3 DESC);

CREATE INDEX idx_tab3_4 ON tab3 (col0 DESC,col4);

CREATE INDEX idx_tab3_4 ON tab3 (col4 DESC,col0);

CREATE INDEX idx_tab3_5 ON tab3 (col3 DESC);

CREATE INDEX idx_tab4_0 ON tab4 (col0 DESC,col1,col4 DESC);

CREATE INDEX idx_tab4_0 ON tab4 (col1 DESC,col4);

CREATE INDEX idx_tab4_0 ON tab4 (col3,col1 DESC,col4);

CREATE INDEX idx_tab4_1 ON tab4 (col0 DESC,col3);

CREATE INDEX idx_tab4_1 ON tab4 (col1,col4,col3 DESC);

CREATE INDEX idx_tab4_1 ON tab4 (col4,col0 DESC,col3 DESC);

CREATE INDEX idx_tab4_2 ON tab4 (col1,col3);

CREATE INDEX idx_tab4_2 ON tab4 (col4,col3 DESC);

CREATE INDEX idx_tab4_3 ON tab4 (col3,col0 DESC);

CREATE INDEX idx_tab4_4 ON tab4 (col0,col3);

CREATE INDEX idx_tab4_4 ON tab4 (col4 DESC,col3,col0 DESC,col1 DESC);

CREATE INDEX idx_tab4_5 ON tab4 (col1,col4);

SET query_plan_max_limit_for_lazy_materialization = 10;

SELECT * FROM optimize_lazy_materialization_with_compact_mt ORDER BY c LIMIT 3;

INSERT INTO optimize_lazy_materialization_with_fixed_string_data_type
SELECT
    number,
    number % 2 ? 2000 : number,
    repeat('a', number % 10)
FROM numbers(0, 1000);

CREATE TABLE optimize_lazy_materialization_with_uuid_data_type
(
    a UInt64,
    b UInt64,
    c UUID)
ENGINE MergeTree() ORDER BY a;

INSERT INTO optimize_lazy_materialization_with_variant_data_type
SELECT
    number,
    number % 2 ? 2000 : number,
    multiIf(number % 5 = 0, 666::Variant(UInt64, String, Array(UInt64)), number % 5 = 1, number::Variant(UInt64, String, Array(UInt64)), number % 5 = 2, [4, 4, 4]::Variant(UInt64, String, Array(UInt64)), NULL)
FROM numbers(0, 1000);

INSERT INTO tb2 VALUES (3,[10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34, 10.1, 20.45, 40.34]);

SELECT seriesPeriodDetectFFT([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);

SELECT age('minute', toDateTime64('2015-01-01 20:30:36.200', 3, 'UTC'), toDateTime64('2015-01-01 20:35:36.100', 3, 'UTC'));

SELECT age('quarter', toDateTime64('2015-01-02 20:30:36.200', 3, 'UTC'), toDateTime64('2016-04-01 20:30:36.200', 3, 'UTC'));

SELECT DATEDIFF(second, '1969-12-31 23:59:59.123'::DateTime64(6, 'UTC'), '1970-01-01 00:00:09.123'::DateTime64(6, 'UTC'));

SELECT 'GROUPING SETS tests (optimization enabled)';

select firstLine('foo\r\nbar\r\nbaz');

SELECT value = 'grace_hash,hash,auto' FROM system.settings WHERE name = 'join_algorithm';

SELECT hasTokenCaseInsensitiveOrNull('', '');

create table t_delete_skip_index (x UInt32, y String, index i y type minmax granularity 3) engine = MergeTree order by tuple() SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

create table t_multi_prewhere (a UInt64, b UInt64, c UInt8)
engine = MergeTree order by tuple()
settings min_bytes_for_wide_part = 0, add_minmax_index_for_numeric_columns=0;

CREATE TABLE series(i UInt32, x Float64, y Float64) ENGINE = Memory;

SELECT subDate(1.2, INTERVAL 5 MINUTE);

select * from format(JSONCompactEachRowWithNames, 'x UInt32, z UInt32', '["x","y"]\n[1,1]\n[2]\n[]\n[3,3,3,3]') settings input_format_json_compact_allow_variable_number_of_columns=1;

SELECT timestamp('2013-12-31 12:00:00', '12:01:02.111111');

CREATE TABLE IF NOT EXISTS cool_table
(
    id UInt64,
    n Nested(n UInt64, lc1 Array(LowCardinality(String)))
)
ENGINE = MergeTree
ORDER BY id;

SELECT count(), min(id), max(id), avg(id)
FROM test2_d;

CREATE TABLE test (id UInt64, agg AggregateFunction(groupArraySorted(2), UInt64)) engine=MergeTree ORDER BY id;

select count(), sum(number) from file('02841.parquet') where indexHint(u8 in (10, 15, 250));

select count(), sum(number) from file('02841.parquet') where indexHint(u8 < 0);

select count(), sum(number) from file('02841.parquet') where indexHint(string_or_null == '');

drop table if exists largestTriangleThreeBucketsTestDecimal64Decimal64;

-- prewhere reordering uses column sizes; pin codec (randomized server-side)

INSERT INTO t_02848_mt2 SELECT number, toString(number), number, 'aaaabbbbccccddddtestxxxyyy' FROM numbers(100);

-- now()

CREATE TABLE t_mutations_nondeterministic (id UInt64, v DateTime)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/02842_mutations_replace', '1')
ORDER BY id;

INSERT INTO source_table_merge_tree SELECT * FROM system.numbers LIMIT 10;

alter table data add column `features_legacy_Map.id` Array(UInt8), add column `features_legacy_Map.count` Array(UInt32);

select '== arrayRotateLeft';

select arrayShiftRight(['a', 'b', 'c', 'd', 'e'], 3);

select arrayShiftRight(a, s, d) from t02845;

-- Does not conform to the IPv6 format.
SELECT domainRFC('[2001db81]:80') FORMAT CSV;

SELECT domainRFC('[ ]:80') FORMAT CSV;

CREATE TABLE  02845_prewhere  ( e String, c String, q String ) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE 02861_interpolate;

SELECT decodeHTMLComponent('&#32;&#33;&#34;&#35;&#36;&#37;&#38;&#39;&#40;&#41;&#42;&#43;&#44;&#45;&#46;&#47;&#48;&#49;&#50;');

create table child2 (id int, pid int, primary key(id), 
                     foreign key(pid) references parent(pid) on delete cascade) engine MergeTree;

SELECT 'Hello' AS haystack, 'l' AS needle, '\\1' AS replacement, replaceRegexpAll(materialize(haystack), needle, replacement);

-- no-fasttest: 'countmin' sketches need a 3rd party library

-- Tests that DDL statements which create / drop / materialize statistics

SET mutations_sync = 1;

CREATE TABLE tab (col String STATISTICS(uniq)) Engine = MergeTree() ORDER BY tuple();

CREATE TABLE tab (col DateTime STATISTICS(basic)) Engine = MergeTree() ORDER BY tuple();

CREATE TABLE tab (col Enum('hello', 'world') STATISTICS(uniq_v2)) Engine = MergeTree() ORDER BY tuple();

ALTER TABLE tab DROP STATISTICS s;

INSERT INTO tab VALUES (1, 1);

SELECT name, statistics FROM system.parts_columns
WHERE database = currentDatabase() AND table = 'tab_basic' AND active AND column = 'value'
ORDER BY name;

SELECT count(*) FROM tab WHERE u64 < 7;

SELECT count(*) FROM tab WHERE f64_basic = 7.7;

SELECT count(*) FROM tab WHERE f64_uniq < 7.7;

SELECT 'dt and <';

SELECT count(*) FROM tab WHERE b_tdigest = 1;

-- checks a first, then b (statistics used)
SELECT name, column, statistics from system.parts_columns where (database = currentDatabase()) AND (table = 'tab') AND active order by name, column;

SHOW CREATE USER test_user_02867;

SELECT '1. test simple distinct';

-- EXPLAIN AST SELECT 'x' IS NOT DISTINCT FROM ('x' || 'a');
EXPLAIN AST SELECT 'x' IS NOT DISTINCT FROM 'x' || 'a';

insert into t2 select number, number from numbers(4000, 1000);

SELECT formatQuery('ALTER TABLE tab MODIFY COLUMN long_string String SETTINGS (min_compress_block_size = 163840, max_compress_block_size = 163840);');

INSERT INTO table_gcd_codec_uint128 SELECT number FROM system.numbers LIMIT 50;

CREATE TABLE table_gcd_codec_decimal64 (n Decimal64(1) CODEC(GCD, LZ4)) ENGINE = Memory;

DROP TABLE IF EXISTS table_gcd_codec_one_hundred_ones;

select * from format(JSONEachRow, '{"obj" : {"nested_obj" : {"a" : 42, "b" : "Hello", "c" : [1,2,3]}}}, {"obj" : {"nested_obj" : {"a" : 43, "b" : "World", "d" : "2020-01-01"}}}, {"obj" : {"nested_obj" : {}}}');

SELECT toDaysSinceYearZero(toDateTime64('2023-09-08 11:11:11.123123123', 9));

set input_format_json_infer_incomplete_types_as_strings=1;

SELECT YYYYMMDDhhmmssToDateTime(21060207062816);

SELECT YYYYMMDDhhmmssToDateTime(False);

SELECT YYYYMMDDhhmmssToDateTime64(-20230911111111);

SELECT YYYYMMDDToDate(20200229.1);

SELECT toTypeName(YYYYMMDDToDate32(cast(19910824 AS Nullable(UInt64))));

-- invalid month
SELECT YYYYMMDDToDate32(20230940);

SELECT id, query, formatQuery(query) FROM all_valid ORDER BY id;

CREATE TABLE checksums_r2 (column1 UInt32, column2 String) Engine = ReplicatedMergeTree('/tables/{database}/checksums_table', 'r2') ORDER BY tuple();

SELECT [(NULL, 2), (2, NULL)] * 7;

SYSTEM FLUSH ASYNC INSERT QUEUE t_async_insert_skip_settings;

SET max_rows_to_read = 50000000;

SELECT 'damerauLevenshteinDistance', s1, s2, damerauLevenshteinDistance(s1, s2) FROM t ORDER BY ALL;

SELECT levenshteinDistance('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'short') AS actual, 84 AS expected;

SELECT levenshteinDistanceUTF8('안녕하세요', '안녕하세요') AS actual, 0 AS expected;

SELECT levenshteinDistance('Zwx0QyNE2AfZBlLE5oel5LvXaNryAXXqtuuBfUGbu6k5NCXMqLoUYcDHHQ5Ilg8NHbc0FAPImhB6yRIWl18ujCrVjDRqiu7OEzPla1uDkybog1NuIhpuTqTFcXzmLWCXAH2uSTwF1pkMOzeeM586H5BrmMhQsPDf', 'ficS8NMdw6ZJ1h9GgUFVFDMjicfthpOurX44ZgBvRKBlqczckOdm2qLiiSnR53I7d33i6YV4f82UkmQpkRf6tqwLneGxR71FZwx0QyNE2AfZBlLE5oel5LvXaNryAXXqtuuBfUGbu6k5NCXMqLoUYcDHHQ5Ilg8NHbc0FAPImhB6yRIWl18ujCrVjDRqiu7OEzPla1uDkybog1NuIhpuTqTFcXzmLWCX') AS actual, 128 AS expected;

SELECT stringSimilarityRatio(repeat('a', 64) || 'b', 'b' || repeat('a', 64));

DROP TABLE dist_tbl;

SELECT byteSwap(1::UInt8);

SELECT byteSwap(-9223372036854775809::Int128);

CREATE TABLE attach_partition_t4 (
	a UInt32,
	b String,
  PROJECTION differently_named_proj
   (
       SELECT
           b,
           sum(a)
       GROUP BY b
   )
)
ENGINE = MergeTree
ORDER BY a;

CREATE TABLE {CLICKHOUSE_DATABASE:Identifier}.tablefunc02 (x int) AS mysql('127.123.0.1:3306', 'mysql_db', 'mysql_table', 'mysql_user','123123');

INSERT INTO {CLICKHOUSE_DATABASE:Identifier}.mem SELECT number FROM numbers(5);

CREATE TABLE t_parts_columns_filenames (id UInt64, v UInt64, long_v_name UInt64, long_arr_name Array(UInt64), arr_col Array(UInt64))
ENGINE = MergeTree ORDER BY id
SETTINGS
    min_bytes_for_wide_part = 0,
    replace_long_file_name_to_hash = 1,
    max_file_name_length = 8,
    ratio_of_defaults_for_sparse_serialization = 0.9;

insert into x values (1, 2);

SELECT untuple(tuple(1)::Tuple(Int)), untuple(tuple('s')::Tuple(String)) FORMAT Vertical;

SET enable_nullable_tuple_type = 0;

system start merges nested_smt;

select count(1), min(date32), max(date32) from file('02892.orc') where date32 between '1992-01-01' and '2023-08-02';

select count(), sum(number) from file('02892.orc') where indexHint(s like '99%' or i64 == 2000);

select count(), sum(number) from file('02892.orc') where indexHint(never_null_lc < 150);

select count(), sum(number) from file('02892.orc', ORC, 'number UInt64, string_or_null LowCardinality(String)') where indexHint(string_or_null like 'I am%');

CREATE TABLE foo (id UInt64, seq UInt64) ENGINE = Memory;

CREATE TABLE t_leading_zeroes(id Int64, input String, val Int64, expected Int64, comment String) ENGINE=MergeTree ORDER BY id;

INSERT INTO t_leading_zeroes VALUES (1034, '-0000.008e3', -0000.008e3, -8, 'Floating point should work...');

INSERT INTO t_leading_zeroes_f VALUES (2022, '+000000000000000', +000000000000000, 0, 'Mutliple redundant zeroes positive');

INSERT INTO t_leading_zeroes VALUES (11006, '0000000000100', 0000000000100, 100, 'Octal like, interpret as decimal, multiple leading zeroes');

INSERT INTO t_leading_zeroes VALUES (11060, '0x0abcd', 0x0abcd, 43981, 'Hex should be parsed');

INSERT INTO t_leading_zeroes_f VALUES (12030, '0000.008', 0000.008, 0.008, 'Floating point should work...');

CREATE TABLE or_bug (key UInt8) ENGINE=MergeTree ORDER BY key;

ALTER TABLE test2 DROP PARTITION (2, 4);

DROP TABLE IF EXISTS 02898_parallel_replicas_final;

SET max_rows_to_read = 8192, force_primary_key = 1, analyze_index_with_space_filling_curves = 0;

SELECT subtractMonths('2023-10-22', 1), subtractMonths('2023-10-22 12:34:56.123', 1);

SELECT subtractMinutes(materialize('2023-10-22'), 1), subtractMinutes(materialize('2023-10-22 12:34:56.123'), 1);

SELECT subtractNanoseconds('2023-10-22', materialize(1)), subtractNanoseconds('2023-10-22 12:34:56.123', materialize(1));

SELECT '2023-10-23' + INTERVAL 1 MONTH,'2023-10-23 12:34:56.123' + INTERVAL 1 MONTH;

SELECT toDateTime(toDate('2149-06-06'));

-- https://github.com/ClickHouse/ClickHouse/issues/55843
-- These tests pass without the fix when either of
--   - optimize_read_in_window_order = 0 and optimize_read_in_order = 0
--   - ratio_of_defaults_for_sparse_serialization = 1
-- However it is better to leave the settings as randomized because we run
-- stateless tests quite a few times during a PR, so if a bug is introduced
-- then there is a big chance of catching it. Furthermore, randomized settings
-- might identify new bugs.

CREATE TABLE test1
(
    id String,
    time DateTime64(9),
    key Int64,
    value Bool,
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(time)
ORDER BY (key, id, time);

SELECT 'With the setting disabled the deleted rows are visible but still can be filterd out';

select hostname
from system.query_log
where
    query like 'select \'02095_system_logs_hostname%'
    and current_database = currentDatabase()
    and event_date >= yesterday() AND event_time >= now() - 600 LIMIT 1 FORMAT Null;

-- Test tuple nested in map
select map_tuple_column from file(currentDatabase() || '_02906.orc', 'ORC', 'int64_column Int64, map_tuple_column Map(String, Tuple(a Nullable(String), b Nullable(Float64), c Nullable(Int64)))') where int64_column % 15 = 0;

SELECT fromDaysSinceYearZero(NULL), fromDaysSinceYearZero32(NULL);

DROP TABLE enum_table;

SELECT ((4::UInt32)::Enum('first' = 1, 'second' = 2, 'third' = 3))::UInt64;

SELECT CAST(materialize(CAST(1, 'Nullable(Enum(\'A\' = 1, \'B\' = 2))')), 'Nullable(String)');

EXPLAIN ESTIMATE SELECT 0 = 1048577, NULL, groupBitmapOr(bitmapBuild([toInt32(65537)])) FROM cluster(test_cluster_two_shards) WHERE NULL = 1048575;

select * from (explain plan actions = 1 select * from (select * from tab union all select * from tab3) order by (a + b) * c, sin(a / b) settings enable_parallel_replicas = 0) where explain like '%sort description%' or explain like '%ReadType%';

INSERT INTO t1n VALUES (1,42), (2,2), (3,3);

create table test1
(
    c UInt32,
    a alias c + 1,
    index i (a) type minmax
)
engine = MergeTree
order by c
settings index_granularity = 8192, min_index_granularity_bytes = 1024, index_granularity_bytes = 10485760, add_minmax_index_for_numeric_columns=0;

/*

    This is a test to prevent regression introduced in https://github.com/ClickHouse/ClickHouse/pull/54184 from happening again.

    The PR was trying to fix the unexpected behavior when deduplicate_blocks_in_dependent_materialized_views = 0 AND
    max_insert_delayed_streams_for_parallel_write > 1 but it ended up adding a new regression.

*/
SET deduplicate_blocks_in_dependent_materialized_views = 0, max_insert_delayed_streams_for_parallel_write = 0;

drop table if exists shard_0.to;

DROP TABLE IF EXISTS nested_table;

select * from format(CSV, 'd Date, s String', '2020-1-2,SomeString');

SELECT toStartOfInterval(toDate('2023-10-09'), toIntervalYear(1), toDate('2022-02-01'));

SELECT toStartOfInterval(toDateTime64('2023-10-09 10:11:12.987654321', 9), toIntervalMinute(1), toDateTime64('2023-10-09 09:10:11.123456789', 9));

DROP NAMED COLLECTION IF EXISTS 02918_json_fuzzer;

CREATE TABLE mt2 (id UInt64) ENGINE = MergeTree ORDER BY id;

-- simple test
SELECT round(quantileDD(0.01, 0.5)(number), 2) FROM numbers(200);

ALTER TABLE crash_02919 UPDATE b = 1 WHERE 1=1 SETTINGS mutations_sync = 1;

-- Projection query works with mutation applied.
SELECT count(j) FROM t GROUP BY name, age;

INSERT INTO users VALUES (6666, 'Ksenia', 48);

SELECT nothingUInt64() as n, toTypeName(n);

SELECT nothingIfArray([1, NULL], [1, 0]) AS x FROM remote('127.0.0.{1,2}', numbers(3));

SELECT '-- count:';

-- Assert sanitizer: passing NULL (not Nullable() with different values is accepted and ignored)
SELECT
    anyLastIf(n, cond) RESPECT NULLS,
    anyLastIf(nullable_n, cond) RESPECT NULLS
FROM
(
    SELECT
        number AS n,
        NULL as cond,
        number::Nullable(Int64) as nullable_n
    FROM numbers(10000)
);

SELECT any(number) RESPECT NULLS from numbers(0);

-- Set to other value, but without providing value
SELECT first_value_respect_nullsMerge(CAST(unhex('03'), 'AggregateFunction(any_respect_nulls, UInt64)'));

DROP NAMED COLLECTION IF EXISTS test_max_num_to_warn_1;

CREATE VIEW IF NOT EXISTS test_max_num_to_warn_02931.test_max_num_to_warn_view_10 AS SELECT * FROM test_max_num_to_warn_02931.test_max_num_to_warn_10;

CREATE NAMED COLLECTION test_max_num_to_warn_5 AS key = 1;

-- Use Float64 numbers divisible by 1/16 (or some other small power of two), so that their sum doesn't depend on summation order.
INSERT INTO test_table VALUES (1, 1.125, 1.11);

SELECT sum(uint64 - 1 AS i) j from test_table where i > 0 having j > 0;

EXPLAIN SYNTAX (SELECT sum(2.125 + uint64) From test_table);

SELECT sum(float64) + 2 * count(float64) From test_table;

EXPLAIN SYNTAX (SELECT 2 * count(decimal32) - sum(decimal32) From test_table);

SELECT (sum(float64) + 2 * count(float64)) - (sum(float64) + 3 * count(float64)) From test_table;

EXPLAIN SYNTAX (SELECT sum(decimal32 - 2) - sum(decimal32 - 3) From test_table);

EXPLAIN QUERY TREE (SELECT sum(uint64 - 1 AS i) from test_table where i > 0);

EXPLAIN QUERY TREE (SELECT sum(2 + uint64) From test_table);

EXPLAIN QUERY TREE (SELECT sum(2 - uint64) - sum(3 - uint64) From test_table);

CREATE TABLE t_materialize_delete (id UInt64, v UInt64)
ENGINE = MergeTree ORDER BY id PARTITION BY id % 10;

SELECT 'x-.xn--zca' AS idna, idnaEncode(idna) AS ascii, tryIdnaEncode(idna) AS ascii_try, idnaDecode(ascii) AS original, idnaDecode(ascii_try) AS original_try;

SELECT 'xn--p1ai.com' AS ascii, idnaDecode(ascii) AS unicode, idnaEncode(unicode) AS original, tryIdnaEncode(unicode) AS original_try;

SELECT '---- Garbage inputs for idnaEncode';

drop table if exists from_table;

SELECT 'а' AS str, punycodeEncode(str) AS puny, punycodeDecode(puny) AS original, tryPunycodeDecode(puny) AS original_try;

CREATE TABLE tab (str String) ENGINE=MergeTree ORDER BY str;

DROP VIEW parse_mv_eph;

INSERT INTO t2 SELECT number, number FROM numbers(2, 3);

SELECT sqidEncode(materialize(1), materialize(2)) AS sqid, sqidDecode(sqid);

SELECT dateTrunc('mIllISecoNd', toDateTime64('2022-03-01 12:12:12.0123456', 6));

SELECT format('The {0} to all questions is {1}.', 'answer', materialize('bar' :: FixedString(3)));

INSERT INTO format_nested VALUES (['foo', 'bar'], ['qaz', 'qux']);

SELECT toIPv6(toUInt128(4335));

select v, variantElement(v, 'String') from format(JSONEachRow, 'v Variant(String, UInt64)', '{"v" : null}, {"v" : "string"}, {"v" : 42}') format JSONEachRow;

select 'UUID';

select v, variantElement(v, 'Int128') from format(CSV, 'v Variant(String, Int128, Int256)', '\\N\n"string"\n-1\n0\n42d42') format CSV;

select v, variantElement(v, 'UInt16') from format(TSV, 'v Variant(String, UInt16, Int64)', '\\N\nstring\n-1\n0\n10000000000\n42d42') format TSV;

select v, variantElement(v, 'FixedString(4)') from format(Values, 'v Variant(String, FixedString(4))', '(NULL), (''string''), (''abcd'')') format Values;

select v, variantElement(v, 'Array(UInt64)') from format(Values, 'v Variant(String, Array(UInt64))', '(NULL), (''string''), ([1, 2, 3]), ([null, null, null])') format Values;

select 42::UInt64::Variant(String, UInt64);

insert into test_group_by_with_rollup_order values(4,4,'b');

SELECT a, b, all FROM order_by_all ORDER BY all, a;

DROP TABLE IF EXISTS tokenbf_v1_hasany_test;

select variantElement((number % 2 ? NULL : number)::Variant(String, UInt64), 'String') from numbers(4);

select toTypeName(res), if(0, [1,2,3], materialize('str_1')::Nullable(String)) as res;

select toTypeName(res), map('a', 1, 'b', [1, 2, 3], 'c', [[4, 5, 6]]) as res;

SELECT id, mtrl FROM tab ORDER BY id;

CREATE TABLE 02947_table_1 (id Int32) Engine=MergeTree() ORDER BY id;

SET describe_compact_output = 1;

SELECT dictGetOrDefault('flat_dictionary', ('v1', 'v2'), 0, (intDiv(1, id), intDiv(1, id)))
FROM dictionary_source_table;

SELECT dictGetOrDefault('direct_dictionary', ('v1', 'v2'), 0, (intDiv(1, id), intDiv(1, id)))
FROM dictionary_source_table;

DROP DICTIONARY regexp_dict;

SELECT t.b, t.b.c FROM test ORDER BY id FORMAT Null;

SELECT toStartOfInterval(toDateTime64('2023-10-09 10:11:12.000999', 6), toIntervalMillisecond(10));

SELECT arrayMap(x -> x, [1, 2, 3]) AS x, isConstant(x);

INSERT INTO t SELECT number, toString(number) FROM numbers(5);

insert into a values (1, 2), (0, 5), (3, 4);

INSERT INTO async_insert_mt_test
    SETTINGS
        async_insert=1,
        wait_for_async_insert=1,
        async_insert_busy_timeout_min_ms=10,
        async_insert_busy_timeout_max_ms=500,
        async_insert_busy_timeout_increase_rate=1.0,
        async_insert_busy_timeout_decrease_rate=1.0
    VALUES (3, []), (1, [1, 3]), (2, [7, 8]), (4, [5, 9]), (5, [2, 6]);

INSERT INTO tp SELECT number % 3, 2, 1 FROM numbers(3);

create view h (x Int64) as select count() from s3('https://example.s3.amazonaws.com/a.csv', headers('foo' = 'bar'));

show create o;

SELECT 'CHECK WITH TOTALS';

SELECT count() FROM generate_series(5, 4);

EXPLAIN QUERY TREE dump_tree = 0, dump_ast = 1 SELECT length(m) FROM t_func_to_subcolumns_map;

CREATE MATERIALIZED VIEW mv_1_1 TO ds_1_1 as
SELECT
    timestamp t, sum(value) v
FROM landing
GROUP BY t;

DROP TABLE landing;

SET session_timezone='Europe/Amsterdam';

SELECT pe, pe.values.a FROM (SELECT * FROM t2) ARRAY JOIN pe ORDER BY 1;

select if(null, materialize(map(3,4,5,6)), materialize(map(1,2,3,4))) from numbers(2);

SELECT intDiv(4.2, toDecimal64(2.2, 2));

SELECT intDivOrZero(toDecimal128(4.4, 2), toDecimal128(2.2, 2));

desc file(currentDatabase() || '02977_1.csv');

-- out-of-bounds
SELECT changeYear(toDate32('2000-01-01'), -5000);

SELECT changeMonth(toDateTime('2000-01-01 11:22:33'), 12);

-- out-of-bounds
SELECT changeDay(toDateTime('2000-01-01 11:22:33'), -1);

SELECT changeHour(toDateTime('2000-01-01 11:22:33'), -1);

SELECT changeMinute(toDateTime64('2000-01-01 11:22:33.4444', 4), 2);

SELECT changeSecond(toDate('2000-01-01'), -1) SETTINGS session_timezone = 'Asia/Novosibirsk';

SELECT (c1, c2) as t FROM values((NULL, 0.), (0., 0.), (5., 5.)) ORDER BY t ASC LIMIT 1;

INSERT INTO t_distr VALUES (4), (5), (6), (7);

CREATE TABLE distributed_test_table
ENGINE = Distributed(test_cluster_two_shard_three_replicas_localhost, currentDatabase(), shared_test_table);

SET use_skip_indexes_if_final = 1;

INSERT INTO test_null VALUES ([NULL]);

INSERT INTO test_big_numbers SELECT range(99999);

CREATE TABLE test_date (a Array(Date)) engine=MergeTree ORDER BY a;

SELECT a + 2 AS b FROM ta JOIN tabc USING (b) ORDER BY ALL;

SELECT name, version FROM system.zookeeper
WHERE path = (SELECT zookeeper_path FROM system.replicas WHERE database = currentDatabase() AND table = 'test_table_replicated')
AND name = 'metadata' FORMAT Vertical;

insert into test values ([1,2,4], [1,2,3]);

select * from test order by v2, v1 nulls first;

SELECT arrayFold((acc, x) -> (acc + (x * 2)), [1, 2, 3, 4], NULL);

-- Variant with incompatible types now throws on comparison (strict behavior)

set allow_experimental_variant_type=1;

SELECT
    count(),
    now() AS c1
FROM remote('127.0.0.{3,2}', currentDatabase(), ttt)
GROUP BY c1 + 1 FORMAT Null;

SELECT * FROM table ORDER BY x;

detach table b;

INSERT INTO test_0 VALUES (toDateTime64('2023-01-08 08:08:08', 8));

SELECT * FROM test_2 ORDER BY a;

CREATE TABLE IF NOT EXISTS test_6 (a DateTime64(6)) engine = MergeTree order by a;

INSERT INTO test_9 VALUES (toDateTime64('2023-01-01 01:01:01', 1));

SELECT
    hits1.date,
    arrayFilter(x -> (x IN (2, 3)), data) AS filtered
FROM hits1
WHERE arrayExists(x -> (x IN (2, 3)), data);

SELECT 1_000_000 as a SETTINGS output_format_pretty_single_large_number_tip_threshold = 1000 FORMAT PrettyNoEscapesMonoBlock;

SELECT 1_000_000_000 as a FORMAT PrettyCompactMonoBlock;

SELECT 1_000_000_000 as a, '2024-02-29' as b FORMAT PrettySpaceNoEscapes;

SELECT '2024-02-29 00:00:00'::DateTime FORMAT PrettyNoEscapesMonoBlock;

ALTER TABLE visits_order_dst ATTACH PARTITION ID '2' FROM visits_order;

create table source(type String) engine=MergeTree order by type;

DROP TABLE IF EXISTS 03000_traverse_shadow_system_data_path_table;

OPTIMIZE TABLE lwd_merge;

DROP TABLE t__fuzz_0;

SELECT countIf(uid > 2000) FROM users;

select * from format(JSONEachRow, 'foo UInt32, bar LowCardinality(Nullable(UInt32))', '{\"foo\":1}');

EXPLAIN indexes = 1 SELECT count() FROM t_nullif_pruning WHERE team = 1 AND nullIf(k, toInt16(5)) = 5;

DROP TABLE t_nullif_coalesce;

EXPLAIN ESTIMATE
SELECT count()
FROM url_na_log
PREWHERE (DateVisit >= toFixedString('2022-08-10', 10)) AND (DateVisit <= '2022-08-20')
SETTINGS parallel_replicas_local_plan=0;

select 'third attempt';

INSERT INTO partitioned_table_2 SETTINGS insert_deduplication_token='token_1' VALUES (1, 'A'), (2, 'B');

DROP TABLE IF EXISTS dst_null;

SELECT count() FROM test WHERE b >= 0;

SELECT a, uniqExact(b) FROM t_uniq_exact GROUP BY a ORDER BY a
SETTINGS min_hit_rate_to_use_consecutive_keys_optimization = 1.0
EXCEPT
SELECT a, uniqExact(b) FROM t_uniq_exact GROUP BY a ORDER BY a
SETTINGS min_hit_rate_to_use_consecutive_keys_optimization = 0.5;

DROP TABLE t_nullable_keys_5;

INSERT INTO memory SELECT * FROM numbers(9000, 1000);

SELECT CAST(-1 AS UInt8);

-- conversion with overflow

-- For composite data types, if a value is a literal, it is parsed directly:

SELECT [1.1, 2.3]::Array(Decimal(30, 20));

SELECT toUInt8OrNull('123\0'::FixedString(4));

select * from test_memory;

SET wait_for_async_insert = 1;

select 0 as x
from remote('127.0.0.{1,2}', system.one)
order by x;

set group_by_use_nulls=1;

create table data (key Int, uniq_values Int) engine=TinyLog();

SET async_insert = false;

--force preliminary merge

SELECT a, b
FROM fixed_prefix
WHERE a = 1
ORDER BY b
SETTINGS max_threads = 1,
optimize_read_in_order = 1,
read_in_order_two_level_merge_threshold = 5;

SELECT * FROM fuzzQuery('SELECT 1', 500, 8956) LIMIT 0 FORMAT TSVWithNamesAndTypes;

SELECT '------zeros_1-argument-------';

SELECT * FROM test_table WHERE (((k IN toLowCardinality(toNullable(101))) = toLowCardinality(toNullable(0))) AND ((k NOT IN (toLowCardinality(100))) = toNullable(1))) = toNullable(toLowCardinality(0));

-- 1000 rows
SELECT total_rows FROM system.tables WHERE name = 'memory' and database = currentDatabase();

select CAST('42'::Nullable(String), 'Variant(String, UInt64)') as v, variantType(v);

SELECT comment FROM system.tables WHERE database = currentDatabase() AND name = 'copy_with_comment';

SELECT 'Disabled', * FROM account_test FINAL WHERE id = 11338881281426660955 SETTINGS split_parts_ranges_into_intersecting_and_non_intersecting_final = 0;

WITH RECURSIVE recursive_cte AS (SELECT toUInt16(1) AS n UNION ALL SELECT toUInt8(n + 1) FROM recursive_cte WHERE n < 10)
SELECT n FROM recursive_cte ORDER BY ALL;

SELECT tupleIntDiv((15, 10, 5), (5.5, 5.5, 5.5));

CREATE TABLE tab (m1 Map(Float32, String), m2 Map(LowCardinality(String), String)) ENGINE = MergeTree ORDER BY tuple();

select JSONExtract('{"a" : "Hello"}', 'a', 'Variant(String, UInt32)') as v, variantType(v);

INSERT INTO department__fuzz_3 VALUES (4, 2, 'D');

CREATE TABLE alias_bug_dist
AS alias_bug
ENGINE = Distributed('test_shard_localhost', currentDatabase(), 'alias_bug', rand());

select d1, d2, dynamicType(d1), isDynamicElementInSharedData(d1), dynamicType(d2), isDynamicElementInSharedData(d2) from test order by d2, d1 nulls last;

select clamp(1, 6, null);

select count() from test where not empty(d.`Tuple(a Array(Dynamic))`.a.String);

INSERT INTO test_table_2 SELECT number, number FROM numbers(10);

SELECT count() FROM s3(s3_conn, filename='03036_missing_archive.zip :: entry.csv', format='CSV', structure='id UInt64') WHERE _file GLOBAL IN (SELECT 'not_entry.csv');

select 's3Cluster: single archive';

select count(), dynamicType(d), isDynamicElementInSharedData(d) from test group by dynamicType(d), isDynamicElementInSharedData(d) order by count(), dynamicType(d);

-- just count 'em
WITH RECURSIVE t AS (
    SELECT 1 AS id, []::Array(UInt64) AS path
UNION ALL
    SELECT tree.id, arrayConcat(t.path, [tree.id])
    FROM tree JOIN t ON (tree.parent_id = t.id)
)
SELECT t1.id, count(t2.path) FROM t AS t1 JOIN t AS t2 ON
    (t1.path[1] = t2.path[1] AND
    length(t1.path) = 1 AND
    length(t2.path) > 1)
    GROUP BY t1.id
    ORDER BY t1.id;

select count(), dynamicType(d) || ':' || dynamicType(d.`Tuple(a Dynamic(max_types=2))`.a) as type, isDynamicElementInSharedData(d.`Tuple(a Dynamic(max_types=2))`.a) as flag from test group by type, flag order by count(), type;

SELECT arrayMap(x -> arrayMap(x -> (x.1), [(1, 1), (2, 2)]), [(3, 3), (4, 4)]);

create table test (x UInt64, y UInt64) engine=Memory;

WITH RECURSIVE foo AS
    (SELECT 1 AS i
    UNION ALL
       (SELECT i+1 FROM foo WHERE i < 10
          INTERSECT
       SELECT i+1 FROM foo WHERE i < 5)
) SELECT * FROM foo ORDER BY ALL;

SELECT
    subquery1.period AS period,
    if(1=1, 0, subquery1.data1) AS data,
    if(1=1, 0, subquery2.data) AS other_data
FROM
(
    SELECT date AS period, data AS data1
    FROM hits
) AS subquery1
LEFT JOIN
(
    SELECT date AS period, data AS data
    FROM hits
) AS subquery2 ON (subquery1.period = subquery2.period);

SYSTEM SYNC REPLICA t_lightweight_mut_7 PULL;

SELECT s2 FROM t_lightweight_mut_5 ORDER BY id;

ALTER TABLE t_lightweight_mut_5 UPDATE v = (SELECT groupArray(number) FROM numbers(10000)) WHERE 1;

SELECT count() FROM t_update_prewhere PREWHERE c1 != 0 WHERE c2 % 3 = 0;

SELECT id, v FROM t_lightweight_mut_3 WHERE v > 100 ORDER BY id SETTINGS apply_mutations_on_fly = 1;

SELECT *
FROM ab_12_aaa aa
LEFT JOIN ab_12_bbb bb
ON bb.id = aa.id AND bb.`_year` = aa.`_year`
WHERE bb.theyear >= 2019;

-- https://github.com/ClickHouse/ClickHouse/issues/23344
SELECT logTrace(repeat('Hello', 100)), ignore(*)
FROM (
    SELECT ignore((SELECT groupArrayState(([number], [number])) FROM numbers(19000)))
);

CREATE TABLE id_val_join0(id UInt32, val UInt8) ENGINE = Join(ANY, LEFT, id) SETTINGS join_use_nulls = 0;

SET joined_subquery_requires_alias=0;

INSERT INTO t1 SELECT number, number FROM system.numbers LIMIT 10;

CREATE TABLE two_tables
(
    id String,
    id2 String
)
ENGINE = Merge(currentDatabase(), '^(first_table)$');

CREATE TABLE {CLICKHOUSE_DATABASE:Identifier}.`1-1` (field Int8) ENGINE = Memory;

ALTER TABLE replacing MODIFY COLUMN ver Int128;

DROP TABLE IF EXISTS m4;

CREATE TABLE dist5 ENGINE=Distributed('test_shard_localhost', currentDatabase(), d4, rand());

CREATE MATERIALIZED VIEW mv2 ENGINE = SummingMergeTree ORDER BY key AS SELECT key, count(value) AS value FROM d6 GROUP BY key;

SELECT _table, * FROM m4 WHERE _table = 'd8' ORDER BY key ASC;

OPTIMIZE TABLE mt2;

SELECT count(1) as num, hostName() as hostName FROM system.query_log as a INNER JOIN system.processes as b on a.query_id = b.query_id and type = 'QueryStart' and dateDiff('second', event_time, now()) > 5 and current_database = currentDatabase() WHERE event_date >= yesterday() AND event_time >= now() - 600 FORMAT Null;

DETACH TABLE t_shared;

UPDATE t_shared SET c2 = 'aaa' WHERE id = 3;

UPDATE t_lightweight SET c1 = c1 + 1000 WHERE id % 3 = 0;

SELECT sum(v) FROM t_lightweight_8;

-- The second patch shouldn't be applied on merge until mutation is done.
UPDATE t_lwu_merges SET u = 0 WHERE id % 3 = 2;

CREATE TABLE t_lwu_sequence (a UInt64, b UInt64)
ENGINE = MergeTree ORDER BY a
SETTINGS
    enable_block_number_column = 1,
    enable_block_offset_column = 1,
    apply_patches_on_merge = 1,
    shared_merge_tree_disable_merges_and_mutations_assignment = 1,
    patch_parts_version = 'v1';

SELECT * FROM t_detach_attach_patches ORDER BY ALL;

INSERT INTO t_apply_patches_smt SELECT number, 0, 0, 0 FROM numbers(10000);

SELECT * FROM t_lwu_on_fly ORDER BY id;

SELECT * FROM lwu_on_fly ORDER BY id settings apply_mutations_on_fly = 1, apply_patch_parts = 1;

SELECT count() FROM t_lwu_lock_profile_events;

SELECT id FROM t_lwu_bytes_limits WHERE s = 'foo' ORDER BY id;

ALTER TABLE t_mutation_defaults UPDATE y = y + 10000 WHERE x > 0 SETTINGS mutations_sync = 2;

DROP TABLE IF EXISTS t_lwu_text_index;

DROP TABLE IF EXISTS t_lwu_cond_once;

UPDATE t_lwu_51_src SET c0 = c0 + 10 WHERE TRUE;

ALTER TABLE t_lwu_53_bf APPLY PATCHES SETTINGS mutations_sync = 2;

-- Merge the patch's source parts away, so the next read applies the patch in Join mode.
OPTIMIZE TABLE t_lwu_inv_dst PARTITION 1 FINAL;

-- The `ALTER` must still be unmaterialized, otherwise there is nothing to apply on the fly.
SELECT 'pending mutations', count() FROM system.mutations
WHERE database = currentDatabase() AND table = 't_lwu_const' AND NOT is_done;

DELETE FROM t_lwu_delete WHERE id % 2 = 0;

SELECT 'before merge';

OPTIMIZE TABLE t_lwu_deletes_vertical FINAL;

SELECT a FROM (SELECT a FROM test1) AS t;

-- equivalent to:
SELECT x, nest.a, nest.b FROM t;

SELECT x, y, z FROM aliased3;

INSERT INTO event VALUES ('2020-05-01 00:00:01', 'install', '1'), ('2020-05-01 00:00:02', 'install', '2'), ('2020-05-01 00:00:03', 'install', '3');

SELECT
    map('name', errors.name) AS labels,
    value,
    'ch_errors_total' AS name
FROM system.errors
LIMIT 1
FORMAT Null;

SELECT id, count()
FROM a1 a1
LEFT JOIN (SELECT id FROM b1 b1) b1 ON a1.id = b1.id
GROUP BY id
ORDER BY id;

WITH cte1 as (
    SELECT '1234' as x
 ), cte2 as (
    SELECT '1234' as x
   )
SELECT *
FROM events AS events
JOIN cte2 ON cte2.x = events.distinct_id
JOIN cte1 ON cte1.x = cte2.x
limit 1;

SELECT tumbleEnd(tumble(toDateTime('2020-01-09 12:00:01', 'US/Samoa'), INTERVAL '1' WEEK, 'US/Samoa'));

EXPLAIN QUERY TREE passes=1
WITH merged_test AS(
	SELECT * FROM  t Final
)
SELECT * FROM  merged_test;

ALTER TABLE elements
UPDATE
    `nested.value` = arrayMap(x -> concat(x, ' au chocolat'), `nested.value`)
WHERE id = 5555
SETTINGS mutations_sync = 1;

SELECT 'The first bit must be zero';

-- https://github.com/ClickHouse/ClickHouse/issues/62890

SELECT sum(if(materialize(0), toNullable(1), 0));

DROP TABLE test1_00395;

REVOKE SELECT ON team*.* FROM user_03141;

INSERT INTO tmp_b VALUES (5,6,0.4);

insert into tab select number from numbers(10);

SELECT p.begin, e.begin, e.value
FROM probe0 p
ASOF JOIN events0 e
ON p.begin <= e.begin
ORDER BY p.begin ASC;

SELECT
    key_a + key_b AS d,
    rank() OVER (PARTITION BY key_a + key_b) AS f
FROM
    (
        SELECT
            rand() % 10 AS key_a,
            rand(1) % 5 AS key_b,
            number
        FROM numbers(100)
        )
GROUP BY
    key_a,
    key_b
WITH ROLLUP
ORDER BY multiIf(d = 0, key_a, NULL) ASC
FORMAT Null;

-- Truncate the file to avoid leaving too much garbage behind.
insert into function file('03147_parquet_memory_tracking.parquet') select number from numbers(1) settings engine_file_truncate_on_insert=1;

INSERT INTO t_mut_virtuals VALUES (1, 'a');

CREATE MATERIALIZED VIEW mv to target AS
SELECT u.uid, u.name, u.gid, u.gname
FROM users u left join groups_dict g using gid, gname;

SET group_by_use_nulls = true;

INSERT INTO to_table ( n1, n2 ) VALUES (1, '2024-01-01'), (2, toDateTime64('2024-01-01', 3, 'Asia/Istanbul')), (3, toFloat32(1)), (4, toFloat64(2));

CREATE TABLE test_max_types (d Dynamic(max_types=5)) ENGINE = Memory;

INSERT INTO test (a, b, c) VALUES (4, 5, 6);

INSERT INTO Null SELECT number AS id FROM numbers(2);

TRUNCATE TABLE test_groupConcat;

SELECT count(), FROM t_map_lc WHERE NOT ignore(*,  t.m.keys);

INSERT INTO t VALUES (0::UInt8), (1::UInt8), (254::UInt8), (255::UInt8);

-- Map.
INSERT INTO t VALUES (map(11::Dynamic, 'v1'::Dynamic, '22'::Dynamic, 1::Dynamic));

CREATE TABLE 03161_reproducer (c0 UInt8, c1 UInt8, c2 UInt8, c3 UInt8, c4 UInt8, c5 UInt8, c6 UInt8, c7 UInt8, c8 UInt8, c9 UInt8) ENGINE = Memory;

SELECT 42.4242 AS x, materialize(toDecimal32('2.42', 2)) AS y, round(pow(x, y), 6);

SELECT 42.4242 AS x, toDecimal32('2.42', 2) AS y, round(min2(x, y), 6);

SELECT toDecimal32('0.4242', 4) AS x, materialize(toDecimal32('0.4242', 4)) AS y, round(hypot(x, y), 6);

ALTER TABLE users_compact MODIFY SETTING lightweight_mutation_projection_mode = 'drop';

INSERT INTO t VALUES ([(1, 'aa'), (2, 'bb')]::Nested(x UInt32, y Dynamic));

INSERT INTO src_table(sipTimestamp) VALUES (toUnixTimestamp(toDateTime('2024-05-20 09:00:00', 'UTC')));

SELECT wkt(readWKTLineString('LINESTRING (1 1, 2 2, 3 3, 1 1)'));

ALTER TABLE tab MATERIALIZE INDEX idx_b;

insert into function file(currentDatabase() || 'u16.orc') select materialize(32768)::UInt16 as x;

select x from file(currentDatabase() || 'u64.orc', ORC, 'x UInt64') where indexHint(x > 10);

-- auto_statistics_types = '': otherwise the new materialize_statistics_on_insert default writes a
-- statistics.packed object per part, which adds S3 requests this test counts exactly.
CREATE TABLE t_compact_bytes_s3(c1 UInt32, c2 UInt32, c3 UInt32, c4 UInt32, c5 UInt32)
ENGINE = MergeTree ORDER BY c1
SETTINGS index_granularity = 512, min_bytes_for_wide_part = '10G', storage_policy = 's3_no_cache', write_marks_for_substreams_in_compact_parts=1, auto_statistics_types = '';

-- Is case-insensitive
SELECT formatReadableSize(parseReadableSize('1 mIb'));

SELECT toInt8(number - 10) AS x, round(x, materialize(-1)), roundBankers(x, materialize(-1)), floor(x, materialize(-1)), ceil(x, materialize(-1)), trunc(x, materialize(-1)) FROM system.numbers LIMIT 20;

INSERT INTO tab VALUES (301, 4, 20, 20, 20, 20, 20, 20, 20, 20, 20.0, 20.0);

INSERT INTO tab VALUES (1, 6, toDecimal32('42.42', 4), toDecimal64('42.42', 4), toDecimal128('42.42', 4), toDecimal256('42.42', 4));

SELECT
    id,
    whatever
FROM ids AS l
INNER JOIN view(SELECT * FROM merge(currentDatabase(), 'data*')) AS s ON l.id = s.id
WHERE (status IN ['CREATED', 'CREATING'])
ORDER BY event_time DESC;

SELECT trim(explain)
FROM (
    EXPLAIN indexes = 1 SELECT * FROM 03165_token_bf WHERE multiSearchAny(message, [' wx ', ' yz '])
)
WHERE explain LIKE '%Parts:%';

SELECT trim(explain)
FROM (
    EXPLAIN indexes = 1 SELECT * FROM 03165_token_ft WHERE like(message, '%rvi%')
)
WHERE explain LIKE '%Parts:%';

-- Just simple check, that optimization works correctly for table with 2 columns and 2 equivalence classes.
SELECT 'Simple test';

OPTIMIZE TABLE t_ind_merge_2 FINAL;

CREATE MATERIALIZED VIEW monthly_aggregated_data_mv
    TO monthly_aggregated_data
    AS
    SELECT
        toDate(toStartOfMonth(event_time)) AS month,
        domain_name,
        sumState(count_views) AS sumCountViews
    FROM hourly_data
    GROUP BY
        domain_name,
        month;

SELECT formatQuery('SELECT NOT (tuple(1))');

SET allow_experimental_parallel_reading_from_replicas = 2, parallel_replicas_for_non_replicated_merge_tree = 1, cluster_for_parallel_replicas = 'parallel_replicas', max_parallel_replicas = 100;

SELECT countIf(explain LIKE '%BufferChunks%') > 0, countIf(explain LIKE '%MergingSortedTransform%') > 0
FROM (EXPLAIN PIPELINE SELECT count(), sum(k), sum(x) FROM
      (
          SELECT k, x FROM t_read_in_order_3 FINAL ARRAY JOIN vals AS x ORDER BY k
      )
      SETTINGS do_not_merge_across_partitions_select_final = 1, optimize_read_in_order = 1,
          read_in_order_use_buffering = 1, max_threads = 1, max_block_size = 1,
          query_plan_remove_redundant_sorting = 0);

-- Now we do mutation. It will affect one of the parts, and will update columns.txt to the latest / correct state w/o updating the column file!
alter table column_modify_test update other_col=1 where id = 1 SETTINGS mutations_sync=1;

DROP TABLE IF EXISTS t_func_to_subcolumns_use_nulls;

-- A part holding a single distinct point must not be skipped

SET max_rows_to_read = 0, force_primary_key = 0;

-- So while these forms have a slightly different meaning, they both exist:
SELECT getSetting('max_block_size') SETTINGS max_block_size = 1 FORMAT TSV;

SELECT count(*) FROM system.detached_tables WHERE database='test_no_loop';

DROP TABLE view_source;

INSERT INTO 03173_nested_function_lc SELECT number FROM numbers(100);

INSERT INTO 03173_nonsafe_cast SELECT number FROM numbers(100);

SELECT '-- LowCardinality + Nullable set';

select * from test where i < 10 group by i order by i FORMAT JSONCompact;

SELECT greatest(materialize(1.1), NULL), least(materialize(1.1), NULL);

-- And another part
INSERT INTO t_bloom_filter
SELECT
    number % 100 as key, -- 100 unique keys
    rand() % 100 as value -- 100 unique values
FROM numbers(15_000, 15_000);

SELECT bitShiftRight(toUInt32(1), 32);

INSERT INTO test_dynamic VALUES (1, 'foo'), (2, 1111), (3, [1, 2, 3]);

select JSONExtract('{"a" : "2020-01-01"}', 'a', 'Date');

SELECT COUNT(*) FROM file('data_03198_table_function_directory_path/');

select JSONExtract(materialize('{"d" : "2020-01-01"}'), 'd', 'Dynamic') as d, dynamicType(d);

WITH
tmp1 AS
(
    SELECT
        CAST(s1, 'FixedString(10)') AS fs1,
        s2 AS sector,
        s3
    FROM t1
    WHERE  (s3 != 'test')
)
    SELECT
        fs1
    FROM t2
    LEFT JOIN tmp1 USING (fs1)
    WHERE (fs1 IN ('test')) SETTINGS enable_multiple_prewhere_read_steps = 1, query_plan_merge_filters=1;

SELECT reverseBySeparator('test', NULL);

EXPLAIN QUERY TREE SELECT tuple(sumIf(toInt64(1), 1)) FROM numbers(100) settings optimize_rewrite_sum_if_to_count_if=1;

SYSTEM STOP MERGES tab_merge_wide;

DROP TABLE tab_wide;

INSERT INTO tab VALUES
(
    1,
    'alpha',
    (123.456),
    (12.34),
    (123.456),
    (12.34)
),
(
    2,
    'beta',
    (654.321),
    (43.21),
    (654.321),
    (43.21)
),
(
    3,
    'gamma',
    (111.222),
    (22.11),
    (111.222),
    (22.11)
),
(
    4,
    'delta',
    (0.001),
    (0.002),
    (0.001),
    (0.002)
),
(
    5,
    'epsilon',
    (9999.999),
    (999.99),
    (9999.999),
    (999.99)
);

SELECT 'Legacy error-bound-mode aliases (ABS_OR_REL, NORM) stay loadable for backward compatibility';

SELECT count() FROM t WHERE p = 0 AND rowNumberInAllBlocks() = 1;

INSERT INTO t_missed_subcolumns VALUES (2, ('aaa', 'bbb'));

select printf('%%.2g: %.2g', 123.456);

SELECT * FROM ( SELECT 1 AS a, toLowCardinality(1), 1) AS t1 CROSS  JOIN (SELECT toLowCardinality(1 AS a), 1 AS b) AS t2;

select materialize('{"a" : {"b" : {"c" : {"d" : 42}, "e" : 43}, "f" : 44}, "g" : 44}')::JSON(SKIP a.b.c);

create table test (json JSON(SKIP aaaa.b.cccc)) engine=Memory;

SELECT overlay(materialize('Spark SQL'), materialize('ANSI '), 7, materialize(0)), overlayUTF8(materialize('Spark SQL和CH'), materialize('ANSI '), 7, materialize(0));

insert into t values(-1893563136,true,41.55);

INSERT INTO system.webassembly_modules (name, code) SELECT 'module1', base64Decode('AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=') FROM wasm_data;

DELETE FROM system.webassembly_modules WHERE name = 'wasm_s';

insert into test select number, toJSONString(map('a.b.c', number, 'a.b.d', range(number % + 1)::Array(UInt32), 'a.b.e', 'str_' || toString(number), 'd.a', number::UInt32, 'd.c', toDate(number))) from numbers(30, 5);

select json.b.b.e, json.b.b.e.:String, json.b.b.e.:Date, json.d.a, json.d.a.:`Array(Nullable(Int64))`, json.d.a.:Date from test order by id format JSONColumns;

select json, json.^a, json.a.b.d from test order by id format JSONColumns;

select json, json.a.b.c from test format Null;

select json.b.b.e, json.d.a from test order by id format Null;

select json.d.a, json.b.b.`_1` from test order by id format Null;

select json, json.a.b, json.a.b.c, json.a.b.c.d.e, json.a.b.b.c.d_0, json.a.b.b.c.d_1, json.a.b.b.c.d_2, json.a.b.b.c.d_3, json.a.b.b.c.d_4, json.a.r, json.a.r[], json.a.r[].c.d.e, json.a.r[].b.c.d_0, json.a.r[].b.c.d_1, json.a.r[].b.c.d_2, json.a.r[].b.c.d_3, json.a.r[].b.c.d_4, json.^a, json.a.b.^b.c, json.a.r[].^b.c from test format Null;

select json.a.r, json.a.r[].^b, json.a.r[].^b.c, json.a.r[].b.c.d_0.:Int64 from test order by id format Null;

SELECT hex(groupArrayIntersectState([1]) AS a), toTypeName(a);

CREATE TABLE tab ( `k` Nullable(UInt32), `k1` Nullable(UInt32), `k2` Nullable(UInt32), `v` String ) ENGINE = MergeTree ORDER BY tuple();

SELECT * FROM t_03209 WHERE a IN toDecimal32('33.3000', 4) SETTINGS allow_experimental_parallel_reading_from_replicas=1;

-- Use fixed dates to avoid timing issues across midnight boundary
insert into date32_table_pv values(1, '2000-01-01');

-- But nested "select generateUUIDv4()"  works!
select id from uuid_pv(uuidparam=(select generateUUIDv4()));

drop table ipv4_table_pv;

select arrayStringConcat(arraySlice(splitByString(', ', trimLeft(explain)), 2), ', ') from (explain query tree select hex(countState(if(toNullable(number % 2 = 0), number, null))) from numbers(5) settings optimize_rewrite_aggregate_function_with_if=1) where explain like '%AggregateFunction%';

SELECT (abs ((- ((sign (right_0.c1)))))) AS `check`
FROM t0 AS left
LEFT ANTI JOIN t0 AS right_0 ON ((left.c0)=(right_0.c1));

INSERT INTO t (d) VALUES (1.17549435e-38::Float64), (3.40282347e+38::Float64), (-3.40282347e+38::Float64), (-1.17549435e-38::Float64), (1.4e-45::Float64), (-1.4e-45::Float64);

select distinct toUInt32OrDefault(d) as res from t order by res;

SELECT *
FROM
(
    SELECT
        product_name,
        group_name,
        price,
        rank() OVER (PARTITION BY group_name ORDER BY price ASC) AS rank,
        percentRank() OVER (PARTITION BY group_name ORDER BY price ASC) AS percent
    FROM products
    INNER JOIN product_groups USING (group_id)
) AS t
ORDER BY
    group_name ASC,
    price ASC,
    product_name ASC;

SELECT 1
FROM
(
    SELECT number IN (
            SELECT number
            FROM view(
                SELECT number
                FROM numbers(1)
            )
        )
    FROM t
)
-- Pinned to query-based: only it walks the query tree with dummy tables, which this test covers.
SETTINGS allow_experimental_parallel_reading_from_replicas = 1, cluster_for_parallel_replicas='not_exists', max_parallel_replicas = 2, parallel_replicas_for_non_replicated_merge_tree = 1, parallel_replicas_plan_based = 0;

CREATE TABLE test_parquet (col1 int, col2 String) ENGINE=File(Parquet)  SETTINGS output_format_parquet_write_page_index=false;

SELECT if(number % 2, number::Int16, number::UInt64) as res, toTypeName(res) FROM numbers(2);

-- If filtering is not done correctly on database-table column, then this query report to read 2 rows, which are the above tables
SELECT database, table, left(replica_name, 2) FROM system.replicas WHERE database = currentDatabase() AND table = 'test_03217_system_tables_replica_1' AND replica_name LIKE 'r1%';

CREATE TABLE t_merge_profile_events_1 (id UInt64, v1 UInt64, v2 UInt64)
ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 0;

insert into test VALUES ('a', {'a': Null, 'a': Null});

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "2020a01a01"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "02/01/17 010203.000 MSK"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "2017-01-02 03:04:05"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "2017-01-02 03:04:05.000 MSD Jun"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "2017 Apr 02 1:22:33"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "25 Jan 2017 1:2:3.000 PM"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "Sun, 11 Feb 2018 06:40:50 +0300"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "200001010101.1"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "Sun2020"}');

select x, toTypeName(x) from format(JSONEachRow, '{"x" : "2000-01"}');

select count(*) from {CLICKHOUSE_DATABASE_1:Identifier}.distr_03222_dt64 where dt > (select now());

-- Compound types
SELECT x FROM format(JSONEachRow, 'x Array(UUID)', '{"x":["00000000-0000-0000-0000-000000000000","b15f852c-c41a-4fd6-9247-1929c841715e",""]}');

select distinct arrayJoin(JSONSharedDataPaths(arrayJoin(json.a[]))) as path from test order by path;

SELECT INTERVAL 1 NANOSECOND < INTERVAL 2 DAY;

SELECT('Comparing milliseconds');

SELECT INTERVAL 1440 MINUTE = INTERVAL 1 DAY;

SELECT INTERVAL 36 MONTH != INTERVAL 3 YEAR;

alter table mt delete where 1;

SELECT arraySort(arrayUnion([NULL, NULL, NULL, 1], [1, NULL, NULL], [1, 2, 3, NULL]));

SELECT str, column_with_alias, valid_column_1, valid_column_2 FROM test3;

SELECT JSONExtract('{"hello":[{"world":"wtf"}]}', 'Tuple(hello Array(Tuple(world String)))') AS x,
    x.hello, x.hello[1].world;

select dynamicType(json.a2), distinctJSONPathsAndTypes(json) from test_json_dynamic_aggregate_functions group by dynamicType(json.a2) order by dynamicType(json.a2);

upper('Hello');

drop table if exists test_right;

describe p3(t = 'Int');

CREATE TABLE t_local_2 (a UInt32) ENGINE = MergeTree ORDER BY  a;

set enable_nullable_tuple_type=0;

SET optimize_move_to_prewhere = true;

SELECT '-- a join runtime filter in PREWHERE must not populate the cache';

INSERT INTO tab_topk SELECT number, number, number FROM numbers(100000);

DROP TABLE t_qcc_on_fly_update;

SELECT
    ProfileEvents['QueryConditionCacheHits'],
    ProfileEvents['QueryConditionCacheMisses'],
    toInt32(ProfileEvents['SelectedMarks']) < toInt32(ProfileEvents['SelectedMarksTotal'])
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND
    type = 'QueryFinish'
    AND current_database = currentDatabase()
    AND query = 'SELECT * FROM tab WHERE b = 10_000 FORMAT Null SETTINGS use_query_condition_cache = true, optimize_move_to_prewhere = false;'
ORDER BY
    event_time_microseconds;

-- 1 mio rows sounds like a lot but the QCC doesn't cache anything if there is less data

SELECT '--- with move to PREWHERE';

select toStartOfInterval(toDate32('2022-09-16'), INTERVAL 1 YEAR);

SHOW CREATE TABLE uk_price_paid;

SHOW CREATE VIEW uk_prices_aggs_view
SETTINGS
    show_create_query_identifier_quoting_rule='always',
    show_create_query_identifier_quoting_style='DoubleQuotes';

SHOW CREATE TABLE uk_price_paid
SETTINGS
    show_create_query_identifier_quoting_rule='when_necessary',
    show_create_query_identifier_quoting_style='BackticksMySQL';

SELECT
    database,
    table,
    name,
    type,
    total_rows,
    data_compressed_bytes > 0,
    data_uncompressed_bytes > 0,
    sorting_key,
    query,
    settings
FROM system.projections
WHERE database = currentDatabase()
ORDER BY table, name;

DROP TABLE IF EXISTS clone_as_foo_merge_tree;

SELECT 'from clone_as_foo_merge_tree_p_x';

select * from format(CSV, '"42","42.42","True"');

select map('str', d) from test group by map('str', d) order by all;

insert into test values (map('Hello', '01/01/2020'));

insert into test values ('{"c" : "Hello"}');

create or replace workload development in all settings priority = 1;

create resource 03232_sched_memory (memory reservation);

select d < x as res, toTypeName(res) from test;

select sipHash64(d) as res, toTypeName(res) from test;

select match(d, 'str') as res, toTypeName(res) from test;

select d + x + d as res, toTypeName(res), dynamicType(res) from test;

SET custom_c = null;

DROP TABLE IF EXISTS users_03236_zero;

INSERT INTO TABLE t0 (c0) VALUES (-inf),(1),(2);

SELECT arrayElementOrNull(arrayMap(x -> toString(x), range(number)), -1) FROM system.numbers LIMIT 3;

INSERT INTO t_map_03240 VALUES ('aaa', 'bbb', map('aaa', 'foo', 'bbb', 'bar'), map('aaa', 'foo', 'bbb', 'bar'));

SELECT quantileExactWeightedInterpolated(0.4)(a, 1), quantileExactWeightedInterpolated(0.4)(b, 2), quantileExactWeightedInterpolated(0.4)(c, 3) FROM decimal WHERE a >= 0;

set input_format_orc_dictionary_as_low_cardinality = 0;

SET compatibility = '25.7';

SYSTEM STOP MERGES t_final_query_tbl;

-- Testcase from https://github.com/ClickHouse/ClickHouse/pull/34243

DROP TABLE IF EXISTS data_02201;

SELECT id FROM tab1 FINAL WHERE v = 9999;

INSERT INTO tab1(valueDate, bb_ticker, ric)
    SELECT today(), number%1111, number%111111
    FROM numbers(1e4);

ALTER TABLE t0 MODIFY COLUMN c0 Dynamic;

INSERT INTO t0 (c0, c1) VALUES ('{"c3":"w=v%C"}', [-133239.0, 41893484.0]), ('{"c0":"?D.B#["}', [-660565014.0, -3.0, 1778026873.0, -12892.0, 37295.0, -8.0, -4049.0]);

WITH [map('a', 1, 'b', 2), map('a',1,'b',3)] AS t SELECT arrayMin(t), arrayMax(t);

-- Random settings limits: index_granularity=(100, None)

set allow_experimental_dynamic_type=1;

SELECT highlight('Hello World', ['hello']);

-- FixedString input
SELECT '-- FixedString';

INSERT INTO test_table VALUES (toDate('2024-10-24'), 1, '/index', 109);

-- MV for populating re-sampled table
CREATE MATERIALIZED VIEW mv_resampled_timeseries TO t_resampled_timeseries_15_sec
(
    metric_id UInt64,
    grid_timestamp DateTime('UTC') CODEC(DoubleDelta, ZSTD),
    samples AggregateFunction(timeSeriesLastTwoSamples, DateTime64(3, 'UTC'), Float64)
)
AS SELECT
    metric_id,
    ceil(toUnixTimestamp(timestamp + interval 999 millisecond) / 15, 0) * 15 AS grid_timestamp,   -- Round timestamp up to the next grid point
    initializeAggregation('timeSeriesLastTwoSamplesState', timestamp, value) AS samples
FROM t_raw_timeseries
ORDER BY metric_id, grid_timestamp;

create table Y (id Int32, y_a String, y_b Nullable(String)) engine ReplicatedMergeTree('/clickhouse/{database}/Y', '1') order by tuple();

SELECT count() FROM t_prewarm_cache_rmt_2 WHERE NOT ignore(*);

SELECT count() FROM t_prewarm_cache WHERE NOT ignore(*);

SELECT 'staleness = 60:';

SELECT timeSeriesLastToGrid(100, 120, 10, 10)([95, 110]::Array(UInt32), [95, 110]::Array(Float32));

-- Test with DateTime64

CREATE TABLE t_resampled_timeseries_64
(
    step UInt32,   -- Resampling step in seconds
    metric_id UInt64,
    grid_timestamp DateTime('UTC') CODEC(DoubleDelta, ZSTD),
    samples Tuple(Array(DateTime64(3, 'UTC')), Array(Float64)) -- Timeseries data resampled to the grid
)
ENGINE = AggregatingMergeTree()
ORDER BY (step, metric_id, grid_timestamp);

SELECT timeSeriesLastToGridMerge(100, 200, 10, 15)(agg) FROM ts_data_agg;

SELECT timeSeriesRange('2025-06-01 00:00:00'::DateTime64(3), '2025-06-01 00:00:00.000'::DateTime64(3), 30);

SELECT event_type, merge_reason, table, part_name, partition_id, partition, rows, merged_from
FROM system.part_log WHERE event_date >= yesterday() AND event_time >= now() - 600 AND database = currentDatabase() AND event_type IN ('MergePartsStart', 'MergeParts', 'MutatePartStart', 'MutatePart')
ORDER BY event_time_microseconds FORMAT Vertical;

select * from x2 where j = 1003;

SELECT count() == 0 FROM system.merge_tree_settings WHERE tier = 'PrivatePreview';

create table a (x UInt128) engine MergeTree order by x;

SELECT anyValueRespectNullsIf (number, NOT isNull(number) AND (assumeNotNull(number) > 5)) FROM numbers(10);

DROP TABLE IF EXISTS tbl4;

SELECT 'Rename column dt to dt2';

CREATE TABLE rewrite (c0 Int) ENGINE = Memory();

CREATE TABLE mv_test
(
    `id` UInt64,
    `ref_id` UInt64,
    `final_id` Nullable(UInt64),
    `display` String
)
ENGINE = Log;

SELECT * FROM x WHERE A AND ((B AND C) OR (B AND D) OR (B AND E)) ORDER BY x LIMIT 10;

SELECT * FROM x WHERE ((A AND B) OR ((B AND D) OR (E AND F))) ORDER BY x LIMIT 10;

DROP TABLE IF EXISTS t_index_granularity;

CREATE TABLE IF NOT EXISTS test (a UInt64) ENGINE=MergeTree() ORDER BY a;

select 'bf: String hit', count(), sum(s = '1230' as cond) from file(bf_03263.parquet) where indexHint(cond);

SELECT a, c, 'original' as original FROM with_fill_staleness ORDER BY a DESC WITH FILL STALENESS INTERVAL -2 SECOND INTERPOLATE (c);

SELECT count(1)
FROM ( SELECT 1 AS x, x ) AS t1
RIGHT JOIN (SELECT materialize(2) AS x) AS t2
ON t1.x = t2.x;

SELECT exp2(number), exp10(number), 'test'||number FROM numbers(64) FORMAT Vertical;

SELECT count() FROM 03269_single_monotonic WHERE id NOT IN (6, 38);

insert into test select '2149-06-06' from numbers(100);

SELECT count() FROM test WHERE identity(stamp) >= toDate('0000-01-01');

INSERT INTO FUNCTION s3(s3_conn, filename='dir1/03271_s3_table_function_asterisk_glob/file1', format=Parquet) SELECT 1 as num;

-- output value correctness test
select floor(arrayAUCPR([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1]), 10);

-- A NaN score makes the result NaN, whatever order the (score, label) pairs are given in.
select arrayAUCPR([nan, 0.5, 0.1], [1, 0, 1]);

create table test (json JSON(max_dynamic_paths=2, max_dynamic_types=2, a UInt32, b String, SKIP c)) engine=Memory;

select json::JSON(max_dynamic_paths=0) as json2, JSONAllPaths(json2), JSONSharedDataPaths(json2), json2.k1, json2.k2, json2.k3, json2.k4 from test;

select json::JSON(SKIP a, SKIP c.d, max_dynamic_paths=2) from test;

select 'skip a, skip c.d, skip d';

select 'Remove typed paths';

CREATE TABLE read_in_order_with_parallel_replicas(id UInt64) ENGINE=MergeTree ORDER BY id SETTINGS index_granularity=1;

DROP TABLE t_prewarm_add_column;

SELECT metric, value FROM system.metrics WHERE metric IN ('PrimaryIndexCacheFiles', 'PrimaryIndexCacheBytes') ORDER BY metric;

CREATE FUNCTION IF NOT EXISTS test_03274 AS ( x ) -> ((x + 1 as y, y + 2));

select arrayJoin(distinctJSONPathsAndTypes(json)) from test;

drop table test4;

EXPLAIN SELECT * FROM s3('http://localhost:11111/test/a.tsv', 'TSV') where c1 in (SELECT c1 FROM s3('http://localhost:11111/test/a.tsv', 'TSV'));

SELECT count(), sum(x) FROM t_block_number_delete;

INSERT INTO test1 FORMAT Values (tuple(true)), (tuple(false));

SELECT indexOfAssumeSorted([1, 1, 1], 10);

insert into adaptive_spill_03277_1 select cast(rand() as String) as k, cast(rand() as String) as x from numbers(1000000);

SELECT * FROM t_enum_in_unknown_value WHERE e NOT IN ('a', 'b');

INSERT INTO jsons VALUES ('a');

-- Array lengths only need to match within each row, not across rows in the same block.
SELECT tupleElement(arrayNormalizedGini(range(number + 2), range(number + 2)), 3)
FROM numbers(2)
SETTINGS max_block_size = 2;

SELECT
    if(ProfileEvents['JoinBuildTableRowCount'] BETWEEN 100 AND 2000, 'ok', format('fail({}): {}', query_id, ProfileEvents['JoinBuildTableRowCount'])),
    if(ProfileEvents['JoinProbeTableRowCount'] BETWEEN 90_000 AND 110_000, 'ok', format('fail({}): {}', query_id, ProfileEvents['JoinProbeTableRowCount'])),
    if(ProfileEvents['JoinResultRowCount'] == 1000, 'ok', format('fail({}): {}', query_id, ProfileEvents['JoinResultRowCount'])),
    Settings['query_plan_join_swap_table'],
FROM system.query_log
WHERE type = 'QueryFinish' AND event_date >= yesterday() AND event_time >= now() - 600 AND query_kind = 'Select' AND current_database = currentDatabase()
AND query like '%sales, products%'
AND log_comment = '03279_join_choose_build_table_stats'
ORDER BY event_time DESC
LIMIT 1;

select coalesce(number % 2 ? NULL : number::Dynamic, 42) as res from numbers(5);

insert into test values (1::UInt8), (2::UInt16), (3::UInt32), (4::UInt64), ('5'::String), ('2020-01-01'::Date);

drop table if exists testXA;

ALTER TABLE t_optimize_level ATTACH PARTITION tuple();

EXPLAIN QUERY TREE dump_ast = 1 SELECT count() FROM x WHERE (A and B) or (B and C) or (B and D and A) SETTINGS optimize_extract_common_expressions = 0;

select 1 from (select 2 from src) settings enable_parallel_replicas=1, max_parallel_replicas=2, cluster_for_parallel_replicas='test_shard_localhost', parallel_replicas_for_non_replicated_merge_tree=1;

INSERT INTO t0 select number, number from numbers(5);

-- Test for issue #72879

SELECT 'Default settings';

DROP TABLE IF EXISTS t_final_collapsing;

CREATE TABLE users
(
    `uid` Int16,
    `name` String,
    `age` Int16,
    PROJECTION p1
    (
        SELECT 
            name,
            uid
        ORDER BY age
    )
)
ENGINE = MergeTree
ORDER BY uid;

-- Example of a more robust query that can be used to calculate AUC for a large dataset
WITH score_with_group AS (
  SELECT
    scores[idx] AS score,
    labels[idx] AS label,
    FLOOR(score / 3) as group
  FROM 
      (SELECT 
          range(1, 11) AS idx,
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] AS scores,
          [1, 0, 1, 0, 0, 0, 1, 0, 0, 1] AS labels)
  ARRAY JOIN idx
),
grouped_scores AS (
  SELECT
    group,
    groupArrayArray(array(score)) as scores,
    groupArrayArray(array(label)) as labels,
    countIf(label > 0) as group_tp,
    countIf(label = 0) as group_fp,
    COALESCE (SUM(group_tp) OVER (ORDER BY group DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS prev_group_tp,
    COALESCE (SUM(group_fp) OVER (ORDER BY group DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS prev_group_fp
  FROM score_with_group
  GROUP BY group
),
partial_aucs AS (
  SELECT 
    arrayAUCPR(
      scores, 
      labels, 
      [
        COALESCE(prev_group_tp, 0), 
        COALESCE(prev_group_fp, 0), 
        COALESCE(SUM(group_tp) OVER(), 0)
      ]
    ) as partial_pr_auc,
    arrayROCAUC(
      scores, 
      labels,
      true,
      [
        COALESCE(prev_group_tp, 0), 
        COALESCE(prev_group_fp, 0),  
        COALESCE(SUM(group_tp) OVER (), 0),
        COALESCE(SUM(group_fp) OVER (), 0)
      ]
    ) as partial_roc_auc
  FROM grouped_scores
)
SELECT 
  floor(sum(partial_pr_auc), 10) as pr_auc,
  floor(sum(partial_roc_auc), 10) as roc_auc
FROM partial_aucs;

-- CI found a LOGICAL_ERROR during vertical merge, testing for it here
DROP TABLE IF EXISTS t_03291_collapsing_invalid_sign_vertical_merge;

select json.a from test format Null;

SELECT 1 AS "абвгдежзийклмнопрсту" FORMAT PrettyCompact;

SELECT 1 AS "@abcdefghijklmnopqr" FORMAT PrettyCompact;

SELECT number FROM numbers(10) FORMAT PrettyCompact SETTINGS max_block_size = 1, output_format_pretty_squash_consecutive_ms = 0;

-- Force the no-key path through provider construction and an actual HTTP request:
-- `localhost:1` refuses the connection, `ai_function_throw_on_error = 0` swallows it,
-- and the row is returned with an empty result. If provider construction had rejected
-- an empty `api_key`, this would throw before the swallow path is reached.
SELECT '-- Named collection without api_key reaches HTTP path';

CREATE TABLE _03300_null_result ENGINE = Memory AS
    SELECT aiGenerate(x) AS result FROM _03300_null_input;

SELECT count() FROM (SELECT aiGenerate(x, map('max_tokens', '128', 'model', 'other-model')) AS result FROM tab);

SELECT count() FROM (SELECT aiClassify(x, ['a', 'b'], map('temperature', '0.0')) AS result FROM tab);

SELECT '-- aiExtract: non-constant instruction';

SELECT '-- aiRedact: wrong type for categories (Array of non-String)';

SELECT '-- aiEmbed: empty input with dimensions';

DROP TABLE IF EXISTS _03300_ret_similarity;

SELECT id, length(summary) FROM _03300_generate_default;

DROP TABLE IF EXISTS _03300_redact_default;

-- Multiple nullable tuples in GROUP BY
SELECT count()
FROM (SELECT number % 3 AS a, number % 5 AS b FROM numbers(100))
GROUP BY
    CAST(tuple(a, b), 'Nullable(Tuple(Nullable(UInt32), Nullable(UInt32)))'),
    tuple(1, NULL)
ORDER BY 1;

select * from (explain indexes=1, actions=1, distributed=1
    select sum(y) from (select * from remote('127.0.0.{1,2}', currentDatabase(), tab0)) where x = 42
);

explain actions=1 select count() from
(SELECT key from t1 CROSS JOIN t2
  where t1.value >= toDateTime(toString(t2.value))
) where key = 162601
settings query_plan_remove_unused_columns=1, query_plan_merge_filters=1;

SELECT anyHeavy(e) FROM test_33602_t0b;

set serialize_query_plan=1;

select s, compareSubstrings('ab3', s, 0, 0, 3) from (select cast(s as FixedString(6)) as s from (select concat('ab', number % 6, 'cde') as s from numbers(8)));

select s1, s2, compareSubstrings(s1, s2, 4, 4, 4) from (select cast(s2 as FixedString(3)) as s2, cast(s1 as FixedString(3)) as s1 from (select concat('ab', number % 3) as s1, concat('ab', number % 4) as s2 from numbers(6)));

SHOW CREATE TABLE table2;

CREATE TABLE t_type_ops (a UInt64, b UInt32)
ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_type_ops', '1')
ORDER BY a
SETTINGS add_minmax_index_for_numeric_columns = 1, add_minmax_index_for_string_columns=0;

INSERT INTO TABLE src (c0, c1) VALUES (1, 1);

INSERT INTO log VALUES ('2025-01-01 04:10:11', 'eventId_005', '');

SELECT * FROM dst ORDER BY ALL;

-- HOWEVER UPON EXPLICITLY USING COLUMN NAMES RATHER THAN *,  NO RESULTS IN THE OUTPUT
WITH T1 AS (SELECT 1 A, 1 B UNION ALL SELECT 1 A, 1 B), 
T2 AS (SELECT 1 A, 1 B),
T1_WITH_ROWNUM AS (SELECT A, B, ROW_NUMBER() OVER (PARTITION BY A, B ORDER BY A, B) RNK FROM T1),
T2_WITH_ROWNUM AS (SELECT A, B, ROW_NUMBER() OVER (PARTITION BY A, B ORDER BY A, B) RNK FROM T2),
RESULT AS (SELECT * FROM T1_WITH_ROWNUM EXCEPT SELECT * FROM T2_WITH_ROWNUM)
SELECT A,B FROM RESULT;

select '{"a" : 42.42}'::JSON(a Decimal128(2)) as json, JSONAllPathsWithTypes(json) from remote('127.0.0.2', 'system.one');

SELECT 'This is the second query, and it is located on line 8';

SELECT 'alter_update_non_uk_column' AS step;

-- 2

DROP TABLE mt_plain;

CREATE TABLE t0 (c0 Int, c1 Nullable(Int) MATERIALIZED 1) ENGINE = SummingMergeTree() PRIMARY KEY (abs(c1)) SETTINGS allow_nullable_key = 1;

-- Tests the second argument (custom trim characters) for functions trim, trimLeft and trimRight.

SELECT 'Basic custom character trimming';

DROP TABLE IF EXISTS test_indexHint_prewhere;

SELECT trim(explain) FROM
(
    EXPLAIN indexes = 1
    SELECT id          -- 'm' not in projection columns
    FROM bloom_filter_test
    WHERE mapContains(m, '1')
    ORDER BY id
) WHERE explain LIKE '%Granules:%';

CREATE VIEW parameterized_view_one_param AS SELECT * FROM raw_data WHERE id = {id:UInt32};

--- value 2 should be in src, value 1 could be in src
SELECT * FROM src WHERE x = 2;

create table test (x UInt16, y UInt16, projection proj (select * order by x)) engine=MergeTree order by tuple() settings min_rows_for_wide_part=1000000000, min_bytes_for_wide_part=10000000000;

DROP VIEW IF EXISTS v0;

CREATE TABLE replicated_ttl_00933 (a Int32, d DateTime)
  ENGINE=ReplicatedMergeTree('/clickhouse/tables/{database}/test_ttl_00933', 'r1')
  ORDER BY a PARTITION BY tuple() TTL now() + INTERVAL 1 second;

insert into X (id, x_a, x_b) select number, toString(number), toString(-number) from numbers(100);

explain query tree select t.a from test array join t.b;

-- Coverage for convertJoinToIn.cpp: five guard conditions that block join-to-IN conversion
-- (lines 152-154 non-hash algo, 159-160 semi strictness, 163-164 non-inner kind,
-- 175-176 null-safe equality, 190-191 right-table output column).

-- Baseline: inner hash + equality + left-only output -> optimization fires (CreatingSets node present).
SELECT countIf(explain LIKE '%CreatingSets%') >= 1 AS baseline_converts
FROM (EXPLAIN description = 0
    SELECT t1.a FROM (SELECT 1::UInt64 AS a) t1 INNER JOIN (SELECT 1::UInt64 AS a) t2 ON t1.a = t2.a
    SETTINGS serialize_query_plan = 0, query_plan_convert_join_to_in = 1);

SYSTEM STOP PULLING REPLICATION LOG t1;

CREATE TABLE deduplicate
(
    `id` UInt64
)
ENGINE = MergeTree
ORDER BY (id);

CREATE MATERIALIZED VIEW mister_view ENGINE = MergeTree() ORDER BY tuple() AS (SELECT mister_table_2.c0.null AS c0 FROM mister_table_2);

set join_use_nulls=1;

SELECT
  c0 + -1,
  sum(intDivOrZero(intDivOrZero(NULL, NULL), '2'), intDivOrZero(10000000000., intDivOrZero(intDivOrZero(intDivOrZero(NULL, NULL), 10), NULL)))
FROM t_having
GROUP BY
  c0 = 2,
  c0 = 10,
  intDivOrZero(intDivOrZero(intDivOrZero(NULL, NULL), NULL), NULL),
  c0
HAVING c0 = 2;

SELECT
    if(ProfileEvents['JoinProbeTableRowCount'] == 50, 'ok', 'fail: ' || toString(ProfileEvents['JoinProbeTableRowCount'])),
    if(ProfileEvents['JoinBuildTableRowCount'] == 100, 'ok', 'fail: ' || toString(ProfileEvents['JoinBuildTableRowCount'])),
    if(ProfileEvents['JoinResultRowCount'] == 100, 'ok', 'fail: ' || toString(ProfileEvents['JoinResultRowCount'])),
FROM system.query_log
WHERE type = 'QueryFinish' AND event_date >= yesterday() AND event_time >= now() - 600 AND query_kind = 'Select' AND current_database = currentDatabase()
AND log_comment = '03362_join_on_filterpushdown_right'
ORDER BY event_time DESC
LIMIT 1;

SELECT hex(keccak256(toFixedString('hello', 6)));

DROP TABLE s3_table_half_schema_with_format;

INSERT INTO qbits_64 (id) VALUES (3);

CREATE TABLE array_64 (id UInt32, vec Array(Float64))  ENGINE = Memory;

CREATE TABLE 03364_gorilla (c0 String CODEC(Gorilla(1))) ENGINE = MergeTree() ORDER BY tuple();

-- Write to server-side user_files (relative path resolves there)
INSERT INTO FUNCTION file(currentDatabase() || '_table_time_bug.csv', 'CSV',
    'c3 Int, c2 Int128, c1 Time, c0 Int')
SELECT c3, c2, c1, c0 FROM t0;

SELECT toTime('9:59');

-- Time64 formats with precision 0 (SS)
SELECT toTime64('45', 0);

-- Negative Time64 with fractional part, precision 3 (S.fff)
SELECT toTime64('-5.123', 3);

SELECT toTime('45:30:15');

SELECT toTypeName(CAST(toTime64('01:02:03.123', 3) AS Time64(6)));

-- High precision operations (Time64 + DateTime64)
SELECT toDateTime64('2020-01-01 12:10:10.123', 3) + toTime64('00:02:02.456', 3) AS dt64_plus_t64;

-- Test with time zone handling
SELECT toDateTime('2020-01-01 12:10:10', 'UTC') + toTime('00:02:02') AS dt_tz_plus_t;

INSERT INTO json_time64_test VALUES ('{"time_value": "23:59:59.999", "id": "3"}');

SELECT toTime(13) > toTime(12);

SELECT toTime(13) > toTime(-12);

SELECT toTime64(-13, 2) > toTime64(12, 2);

SELECT toTime(13) > toTime64(12, 2);

SELECT toTime(13) > toTime64(-12, 2);

SELECT toTime(999999999.1);

SELECT -12::Int16::Time;

SELECT -360000::Int128::Time;

SELECT toTime64(12, 0);

SELECT -0::Int16::Time64;

SELECT -360000::Float32::Time64;

SELECT toTime64(toDateTime('1970-01-01 12:12:12'), 2);

SELECT toDate32(toTime('999:99:99'));

SELECT toTime(12) + INTERVAL 1 SECOND;

SELECT toTime64(12, 2) + INTERVAL 1 SECOND;

SELECT toTime('10:01:01');

SELECT toTime64('999:59:59', 0);

SELECT toTime64('001:01:01.1234', 3);

SELECT toTime64('-9:01:01.1234', 3);

-- Negative Time64 with one-digit hours
SELECT toTime64('-0:00:01.1234567', 6);

SELECT toTime64('-10:01:01.1234567', 7);

SELECT toTime64('-999:59:59.123456789', 9);

-- IF(Time64(3), Time64(6)) -> Time64(6)
SELECT toTypeName(if(0, toTime64('00:00:00', 3), toTime64('00:00:00', 6)));

SELECT * FROM format(Values, 'x BFloat16', '
(915309.3), (-172.4), (-1555612173), (-794649755), (9.0), (1853837358), (-752.038), (1396433067), (-807596209), (6980930564848204980), (inf), (-334802707), (-9208770324484017588), (1542974135), (8.65110), (3653113333946823132), (-0.7048), (-521.0), (8435282414075074417), (-6292128116417116397), (-1.1), (402684563), (7100378348544520322), (-1.758), (5866537631201593121), (1448199529), (-1012621), (-69567.11), (-976.8334), (-28.35), (-8547.0), (+0.0), (5106142703787698805), (8753460139368692361), (-962398.0), (-1191866042), (-3.53), (5736130821808181266), (1.5), (-2102861541), (-4318589268046737694), (+0.0), (8925059011873647780), (-156.896869), (-2882154502015236978), (-1149877585), (0.48367), (1135103111), (1842836061), (-0.02826), (-3726604190761547609), (-453901554.40), (2888527236479160511), (-7.454), (854116431), (6258347412277750223), (-1632245551464937874), (-3887.35), (8767.14), (-2026982035343500009), (10084.047), (-12.6150), (-4490844512257432684), (80.0), (4003882477879050470), (-8032628616449150130), (nan), (283.11), (-2040930083), (-1660845000), (-46.4), (2431480081340864910), (-8348560450377606243), (-8502763961981072530), (-15.67900), (230036155), (1942939659), (4794.81023), (-1639852492), (-1352376506), (-2.7), (-1.088), (-1286266918863494194), (-5474135460424898823), (-701987997), (-3677164403360004369), (7.9723935), (-6243785367315650126), (1131.4), (13.0), (88967630.99), (-4857582370574805786), (-4288683376502787204), (1299393795189677177), (827.0), (-779228479), (5278875253796893698), (-1.241), (-9.4), (8652067825981452928), (5.13222918), (-2739239481541406400), (-38.29), (-1557979152), (-457695388), (-1959634948), (-463871221), (-7491614107579678858), (7901991093387175754), (-749021875), (-563485266992292414), (7903784173186423016), (6415568457236688716), (0.0), (1041044414), (-inf), (-7.36), (1.834), (56.0), (-0.0), (nan), (1407263544961752054), (-2825675448399084472), (-704.2), (7438299440420973263), (2922890613588943306), (452195848), (-673820791), (9172.0), (-7847859370969306041), (1956615306), (144567.23), (-33.1076), (-53.91200), (-6.75), (-4448835675253045899), (2168295801156564119), (1655170692), (4316746107587705818), (-8269286236795419058), (1727302703), (-214033129), (-7.7), (nan), (-0.7), (+nan), (-4547328351920373605), (nan), (-1487104083), (1658546204), (1151636392), (416290247.08), (-4699301667687142318), (-1.7), (-6323293279463878865), (5855641835618078507), (6000839524613739767), (-1029895710511952591), (486712), (-3730616670168004577), (3010252056832300847), (-1929.84917), (-2253628015236776383), (-1355690956), (1.8), (1255622011), (-7633225657025354393), (-1809222556741732999), (8451912649540627017), (134.521), (-6312210627363870622), (-230600560), (9.45), (-0.8798), (-856.606), (nan), (1626812583630422427), (116036431), (-2896591025188201292), (2101820842), (2079731433), (-5311080917199036345), (-577360.40844459), (-58257.86), (-6364996476077464518), (9112295453040021646), (8734695561715260733), (-355588047), (1895493280), (349020560979472682), (914602758), (5192612204687053771), (-5241047726046761998), (1099543785538793655), (-311288720), (1633155009), (1613280409437033273), (+nan), (-10.4), (-68033.01), (-8728247972026697820), (7563764808015298425), (-0.860), (-2.0), (355270636), (181943082), (2077491986200197340), (-5196084623766115387), (-0.1280), (18.24323), (1439645894), (-3.0), (+nan), (-4920802313749507761), (9.581223), (-4977.639), (21.6613), (-1281671910), (-15.4), (-5066115181153139762), (1831511780), (3616962447275671394), (-5035837218861299864), (917383330), (+inf), (223894.264), (-96.275444), (nan), (-547606170), (-261714371), (1734489497), (1760637531924834025), (-2130171631), (99.40196), (3106130344652597122), (9084751387559563274), (-9.2), (772.20502704), (5987185449054785806), (+nan), (-461241595), (869648491758383603), (9.4), (7760123765394357048), (-979023095), (-682791909), (0.0), (-2.84), (-1887928434), (-8.602), (43.8), (-740133382), (-1628407200), (nan), (4048950104344667845), (7.923), (-2290446205925660340), (1817370121), (700.0), (1683434407), (8994999237835107052), (8158939128335705548), (-6779280.5), (520417636), (4856231070881691400), (+inf), (84333.5), (1814647746), (-1783864249), (2035802471), (70752.0), (1124938650), (5737532713519861979), (1196647506), (-4146469507106105938), (7869998886095964339), (312457241), (nan), (3663885939535420359), (-29385.769192130), (4217936517369282398), (67.9), (-1981743187), (489740628), (6528054616798929895), (-5516525484994056924), (3.6), (-1291051489), (791837371), (2559503485226905057)
')
ORDER BY x
SETTINGS max_threads = 1;

CREATE TABLE qbit (id UInt32, vec QBit(BFloat16, 8)) ENGINE = Memory;

-- arrayLevenshteinDistance for different types
SELECT arrayLevenshteinDistance(['1', '2'], ['1']),
  arrayLevenshteinDistance([toFixedString('1', 16), toFixedString('2', 16)], [toFixedString('1', 16)]),
  arrayLevenshteinDistance([toUInt16(1)], [toUInt16(2), 1]),
  arrayLevenshteinDistance([toFloat32(1.1), 2], [toFloat32(1.1)]),
  arrayLevenshteinDistance([toFloat64(1.1), 2], [toFloat64(1.1)]),
  arrayLevenshteinDistance([toDate('2025-01-01'), toDate('2025-01-02')], [toDate('2025-01-01')]);

SELECT 'Test L2DistanceTransposed: Float64';

set allow_experimental_parallel_reading_from_replicas = 1;

SELECT toFloat32(Inf) - toFloat32(Inf),     toBFloat16(Inf) - toBFloat16(Inf);

SELECT a, b, c, d, n.x, n.y FROM test_table ORDER BY c;

-- Add duplicates to test replacing
INSERT INTO qbits VALUES (1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -16]);

SELECT dateTrunc('Second', toDateTime64('1955-03-01 12:55:55', 2));

insert into test values (['s1']);

SELECT icebergTruncate(10, 9);

SELECT icebergTruncate(5, 'abcdefg');

select '{"a" : 1}'::JSON(a UInt32, b UInt32) as j1, '{"a" : 1}'::JSON(a UInt32, b UInt32) as j2, j1 < j2, j1 = j2, j1 > j2;

select '{"a" : 1, "b" : 1, "c" : 1, "d" : 1}'::JSON(max_dynamic_paths=2) as j1, '{"a" : 1, "b" : 1, "c" : 2}'::JSON(max_dynamic_paths=2) as j2, j1 < j2, j1 = j2, j1 > j2;

select '{"a" : 1, "b" : 1, "c" : 1, "d" : 1, "e" : 1, "f" : 1}'::JSON(a UInt32, b UInt32, max_dynamic_paths=2) as j1, '{"a" : 1, "b" : 1, "c" : 1, "d" : 2}'::JSON(a UInt32, b UInt32, max_dynamic_paths=2) as j2, j1 < j2, j1 = j2, j1 > j2;

SET param_q5 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

-- Single Tuple column on the right is valid (compared as a single value).
SELECT (1, 2) IN (SELECT CAST((1, 2), 'Tuple(UInt8, UInt8)'));

DROP TABLE s_in_one_col;

-- Test 2: CTE cache hit on second run
WITH sq AS (SELECT sum(number) AS s FROM numbers(100))
SELECT s FROM sq
SETTINGS use_query_cache = true, query_cache_for_subqueries = true;

-- Create an entry in the query result cache
SELECT t1.number, t2.avg FROM numbers(1, 100) as t1 JOIN (SELECT toUInt64(ceil(avg(number))) as avg FROM numbers(1, 100)) AS t2 ON t1.number = t2.avg SETTINGS use_query_cache = true, query_cache_for_subqueries = true;

-- One record (main query)
SELECT count(*) FROM system.query_cache WHERE is_subquery = true;

-- Test 11: Verify no caching when use_query_cache is not set at all (baseline)
SELECT number FROM (SELECT number FROM numbers(5));

select map('a', [tuple('1970-01-01 00:00:01.000')])::Map(String, Array(Tuple(d Variant(DateTime64(3))))) from remote('127.0.0.{1,2}', 'system.one');

CREATE TABLE t0 (c0 JSON(max_dynamic_types=0)) ENGINE = Memory;

CREATE TABLE IF NOT EXISTS BadTable (id_uint UInt128) ENGINE = MergeTree() ORDER BY id_uint;

-- Consistency of transform_null_in to non-const arguments
SELECT  
    NULL IN (1, number),  
    NULL IN (1, number, NULL),  
    NULL IN (1, 2),  
    NULL IN (1, NULL)  
FROM numbers(1)  
SETTINGS transform_null_in = 1;

SELECT 1 IN multiIf(1 > 2, 10, 2 > 3, 20, 1);

insert into small select number, [number] from numbers(0, 1000);

-- No materialized statistics: the asserted plans depend on the unstatted row estimates.
CREATE TABLE test(path String, lang String, hits UInt64) ENGINE MergeTree() ORDER BY tuple()
  SETTINGS auto_statistics_types = '';

INSERT INTO test SELECT 'path' || number::String, 'ua', number FROM numbers(15);

CREATE TABLE t_mt_source (k UInt64, v String) ENGINE = MergeTree() ORDER BY k SETTINGS index_granularity=10;

insert into local_table select number from numbers(100);

SELECT positiveModuloOrNull(1, 0);

SELECT positiveModuloOrNull(1, materialize(0));

SELECT intDivOrNull(materialize(NULL), materialize(0));

SELECT intDivOrNull(toInt8(-128), toUInt8(255));

INSERT INTO map_containsValueLike_test VALUES (3, {'3-K1':'3-V1','3-K2':'3-V2'}),(4, {'4-K1':'4-V1','4-K2':'4-V2'});

SELECT sparseGramsUTF8('');

SELECT '--- Maximal ngram length with cutoff';

-- Part 2: delete marker (higher version, sign = -1)
INSERT INTO t_final_minmax VALUES (2, '', -1, 2);

SELECT '-- Test default behavior (precision = 0, dragonbox algorithm)';

SELECT '-- Test large-magnitude numbers fall back to shortest representation (no exception)';

SELECT toFloat32('inf');

CREATE TABLE test
(
    `a` Int32,
    `b` Int32,
    `_part_offset` Int32,
    PROJECTION p
    (
        SELECT
            a,
            b,
            _part_offset
        ORDER BY b
    )
)
ENGINE = MergeTree
ORDER BY a;

SELECT l.id, l.value, r.description
FROM t_l_small AS l
RIGHT JOIN t_r_small AS r ON l.id = r.id
ORDER BY r.id, l.id;

SELECT 'right_all_null_keys';

SELECT 'parallel right-only', countIf(l.k IS NULL) FROM l RIGHT JOIN r ON l.k = r.k AND l.v > r.v;

select 'index is applied while using column alias';

SELECT tokens('我来自北京邮电大学。。。学号123456', 'chinese');

DROP TABLE IF EXISTS dist_test_table_1;

SELECT tokens('\\a\n\\bc\\d\n', 'splitByString', ['\n', '\\']) AS tokenized, toTypeName(tokenized), isConstant(tokenized);

SELECT tokens('', 'asciiCJK') AS tokenized, toTypeName(tokenized), isConstant(tokenized);

SELECT tokens('\\\\%test'), tokensForLikePattern('\\\\%test');

SELECT toInterval(5, 'millisecond') as interval, toDateTime64('2025-01-01 00:00:00', 9) + interval AS res;

DROP TABLE truncate_test_memory;

-- make sure the optimization is enabled
set query_plan_optimize_lazy_materialization=true, query_plan_max_limit_for_lazy_materialization=10;

select ['{}', '{"c" : [1, {"b" : []}]}']::Array(JSON) settings input_format_json_infer_incomplete_types_as_strings=0;

SELECT arrayMap(p -> (p.1, round(p.2, 4)), naiveBayesClassifierWithAllProbs('sentiment_token_1', 'The app is awful and barely works'));

CREATE DICTIONARY nb_ws2_canonical_dict (ngram String, class_id UInt32 DEFAULT 0, count UInt64 DEFAULT 0)
PRIMARY KEY ngram SOURCE(CLICKHOUSE(TABLE 'nb_ws2_canonical')) LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 2 mode 'token')) LIFETIME(0);

select parseDateTime64BestEffort('1744042005.123456', 6);

select xxHash64([null::Nullable(String)]);

select cityHash64(materialize(tuple(toLowCardinality(toNullable('hi')))));

-- Without `exact_rows_before_limit`, `rows_before_limit_at_least` reports how many rows `LIMIT BY`
-- had already emitted when `LIMIT` stopped the pipeline, so it depends on the block size of the
-- sorted stream. The queries below pin that with `max_block_size = 1`, but external sorting merges
-- its runs into blocks of at least 128 rows and would make the counter report a larger value.
SET max_bytes_before_external_sort = 0;

SELECT '-- Assert total number of groups and records in distributed';

INSERT INTO 03409_users VALUES (111, 'John', 52, null, 4);

SELECT *
FROM numbers(2)
WHERE (SELECT count() FROM system.one WHERE number = 2) is NULL
ORDER BY all;

SELECT icebergHash('\x00\x01\x02\x03' :: FixedString(4));

SELECT icebergBucket(5, 'iceberg' :: String);

SELECT icebergBucket(13, toDateTime64('2017-11-16T22:31:08.000001001', 9, 'UTC'));

CREATE TABLE t
(
    k Int64,
    dt DateTime,
    s String
)
ENGINE = ReplacingMergeTree
ORDER BY (k, dt);

SET output_format_pretty_display_footer_column_names_min_rows = 1;

SELECT has('{"hello": 123}'::JSON, 'hello');

SELECT id, has(j, 'w') FROM t_json_mt ORDER BY id;

CREATE TABLE t_json_typed_var (id UInt64, j JSON(x UInt32, y.z Nullable(UInt32)), path String) ENGINE = Memory;

INSERT INTO t_json_shared_var VALUES (4, '{"d": 4}', 'd');

-- Tag no-fasttest: Depends on AWS
-- Tag no-msan: delta-kernel is not built with msan

SET parallel_replicas_for_cluster_engines = 0;

SELECT stringBytesUniq('aaaa');

SELECT '-- With index';

DROP TABLE pr_tt;

SELECT flipCoordinates(readWkt('POINT(10 20)'));

INSERT INTO test_geom3 VALUES (1, CAST((10.0, 20.0), 'Point')), (2, CAST((30.0, 40.0), 'Point'));

select * from test where t.a < 4 settings optimize_move_to_prewhere=0;

SELECT base32Encode('This is a test string');

SELECT tryBase32Decode('MZXW6YQ=======');

SELECT '--- short array ASC NULLS LAST';

SELECT number + number / number AS a FROM numbers(256) ORDER BY a DESC NULLS FIRST, 1 ASC;

CREATE TABLE bookmarks_join
(
  product_id Int32,
  segment_id Int32,
  count_in_bookmark Int32
) ENGINE = Join(ALL, LEFT, product_id, segment_id);

CREATE TABLE local_table
(
    id Int8,
    `arr` Array(UInt8)
)
ENGINE = MergeTree
ORDER BY id;

CREATE TABLE topk_test (
    foo UInt64,
    top_items AggregateFunction(topKWeighted(100, 3, 'counts'), String, UInt64)
)
ENGINE = AggregatingMergeTree()
ORDER BY (foo);

insert into t0 values (4);

-- GROUPING with CUBE
SELECT l.number, r.number % 3 AS mod3, sum(r.number),
       grouping(l.number), grouping(mod3)
FROM numbers(1) l JOIN numbers(2) r ON l.number < r.number
GROUP BY ALL WITH CUBE;

SELECT count() FROM foo WHERE match(path, '^xxx\\(zzz') SETTINGS force_primary_key = 1;

-- A NUL byte is an ordinary literal character — prefix "xxx\0bla"
SELECT count() FROM foo WHERE match(path, '^xxx\0bla') SETTINGS force_primary_key = 1;

SELECT count() FROM foo WHERE match(path, '^xxx\\|zzz') SETTINGS force_primary_key = 1;

-- UInt128 max

-- GCD/LCM with large values (but not extreme edge cases)
SELECT gcd(toInt128(1e38), toInt128(2e38));

insert into test1 select 1, tuple(2, 3), 's1';

DROP TABLE 03457_filter;

-- 2^64 - 1 (rounds in double)

-- Test precision loss boundaries
SELECT toInt128(1.2345678901234567e20);

INSERT INTO uin_value_details (ds, uin, value) values ('2023-12-27', 10000001, 7.3), ('2023-12-27', 10000002, -8.3), ('2023-12-27', 10000003, 30.5), ('2023-12-27', 10000004, -3.384), ('2023-12-27', 20000005, 0), ('2023-12-27', 40000005, 100.66666666), ('2023-12-27', 60000005, 0);

select 'TEST numericIndexedVectorPointwise operations with zero values and Int32 value type';

INSERT INTO geo VALUES (unhex('0101000000000000000000f03f0000000000000000'), 2);

SELECT * FROM t3 ORDER BY ALL;

DROP TABLE mview;

SELECT trimLeft(explain)
FROM (EXPLAIN projections = 1 SELECT * FROM t_gran WHERE region = 'top' SETTINGS enable_parallel_replicas = 0)
WHERE explain LIKE '%ReadFromMergeTree%' OR match(explain, '^\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*:');

DROP TABLE t_repl SYNC;

INSERT INTO test_projection_granule_edge_cases VALUES (0, 'top_region', 100);

INSERT INTO tab SELECT number, number, number FROM numbers(8192 * 10);

-- Tag no-parallel: Messes with internal cache
-- Tag no-release: Checks fields in system.query_condition_cache which are not available in release builds
-- add_minmax_index_for_numeric_columns=0: Would use indices instead of the projections that we want to test

SET use_statistics_for_part_pruning = 0;

set cast_string_to_date_time_mode='best_effort';

select trimLeft(*) from (explain indexes=1 select t from test where t.a = 1 settings enable_parallel_replicas=0) where explain like '%ReadFromMergeTree%';

-- Pin settings that cause timeouts with random MergeTree settings while keeping JSON-related ones randomized.
create table test (id UInt64, json JSON(max_dynamic_paths=2, a.b.c UInt32)) engine=MergeTree order by id settings min_rows_for_wide_part=1, min_bytes_for_wide_part=1, index_granularity=8192, prewarm_primary_key_cache=0, prewarm_mark_cache=0, merge_max_block_size=8192, auto_statistics_types='';

select json, json.@b.b.e, json.b.b.e.:String, json.b.b.e.:Date from test format Null;

select count() from test where empty(json.@a) and json.a.b.c == 0;

DROP TABLE IF EXISTS t_dist_111272;

INSERT INTO t_sum_map_overflow_bool_v0 SELECT sumMapWithOverflowState([1], [true]);

SELECT 'bare column policy (was crash)';

CREATE TABLE 03500_t3 (a Int32, flag UInt8) ENGINE = MergeTree ORDER BY a;

CREATE ROW POLICY 03500_p_alias6 ON 03500_t6 USING flag AS PERMISSIVE TO ALL;

CREATE TABLE 03500_t8 (a Int32, `greater(a, 1)` String) ENGINE = MergeTree ORDER BY a;

-- empty hrp
SELECT bech32Encode('', unhex('751e76e8199196d454941c45d1b3a323f1433bd6'));

-- testing max length, this should return nothing
SELECT tup.1 AS hrp, hex(tup.2) AS data FROM (SELECT bech32Decode('b1w508dfqejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5xgqsaanm') AS tup);

drop table if exists users_items;

-- reading using projection from the table should have 2 reading steps, - one for part w/o proj and one for part with proj
select 'Reading steps: '|| count() from (EXPLAIN SELECT * FROM tt1 WHERE v = '1001' ORDER BY v ASC LIMIT 10) where trimLeft(explain) ilike 'ReadFromMergeTree%';

SELECT '--- table desc, query asc, first';

INSERT INTO simple_agf_any_aggregating_mt SELECT
    number % 51 as a,
    any_respect_nulls(toNullable(number)),
    any_respect_nullsState(toNullable(number)),
    anyLast_respect_nulls(toNullable(number)),
    anyLast_respect_nullsState(toNullable(number)),
FROM numbers(10000)
GROUP BY a;

insert into t0 values (null);

SELECT td_d FROM (SELECT t.id td_id, t.d td_d, uniqExact(tdt.id) as cnt FROM td as t LEFT JOIN tdt ON toDate(tdt.dt) = t.d GROUP BY td_id, td_d) WHERE td_d = '2025-04-01';

with sub as (select number from numbers(1)) select x from (select number as x from remote('127.0.0.{1,2}', numbers(2))) where x in sub settings allow_push_predicate_ast_for_distributed_subqueries = 1;

select 'b, c';

select b, _table from test_merge order by all;

INSERT INTO mt SELECT rand(), rand() FROM numbers(4) SETTINGS min_insert_block_size_rows=1, max_block_size=1;

DROP TABLE ttl_03519_2 SYNC;

insert into t_dio select number % number, number % 5, number % 10 from numbers(1,1000000);

create table test (s String) engine=MergeTree order by tuple() settings min_bytes_for_wide_part=0;

SELECT firstNonDefault([]::Array(Int32), [0]::Array(Int32), [1, 2, 3]::Array(Int32)) AS result, toTypeName(result);

INSERT INTO tb__fuzz_0 SELECT number FROM numbers(4);

CREATE TABLE IF NOT EXISTS {CLICKHOUSE_DATABASE:Identifier}.t0 (c0 String) ENGINE = Memory();

select '{"utc" : 1747771112}'::JSON(utc DateTime64);

ALTER TABLE test MODIFY SETTING vertical_merge_algorithm_min_rows_to_activate=1, vertical_merge_algorithm_min_columns_to_activate=1;

drop table if exists log_remote;

explain pipeline insert into t_mt select * from system.one;

-- the test just execute simple select with limit with PR 
-- to test concurrent query cancellation (1) because of limit and (2) because of reading assignment is completed by PR coordinator
DROP TABLE IF EXISTS pr_tt;

-- narrowing filter via user_id_idx
SELECT * FROM test WHERE region = 'us_west' AND user_id = 106 ORDER BY ALL SETTINGS log_comment = 'test_3';

SELECT round(financialInternalRateOfReturnExtended([100000, -110000], [toDate('2020-01-01'), toDate('2021-01-01')], 0.1, 'ACT_365F'), 6) AS xirr_365,
    round(financialInternalRateOfReturnExtended([100000, -110000], [toDate('2020-01-01'), toDate('2021-01-01')], 0.1, 'ACT_365_25'), 6) AS xirr_365_25;

SELECT tag,
    round(financialNetPresentValue(any(r), groupArray(value)), 6) AS financialNetPresentValueExtended_f64_date,
    round(financialNetPresentValue(any(r), groupArray(value)), 6) AS financialNetPresentValueExtended_f64_date32,
    round(financialNetPresentValue(any(toFloat32(r)), groupArray(toFloat32(value))), 6) AS financialNetPresentValueExtended_f32_date
FROM (
    SELECT
        tag,
        date,
        date32,
        value,
        r
    FROM 3533_xirr_test
    ORDER BY tag, date
)
GROUP BY tag
ORDER BY tag;

DROP TABLE IF EXISTS 3538_array_except2;

SELECT id, source, except, arrayExcept(source, except) AS result, expected, if(result = expected, 'OK', 'NOK') AS status FROM 3538_array_except1 ORDER BY id;

CREATE TABLE 3538_array_except6
(
    id UInt32,
    source_null Array(Nullable(FixedString(5))),
    except Array(FixedString(5)),
    expected Array(Nullable(FixedString(5))),
    except_null Array(Nullable(FixedString(5))),
    expected_null Array(Nullable(FixedString(5)))
)
ENGINE = Memory;

-- Starts with ^.*? (should NOT rewrite)
EXPLAIN QUERY TREE dump_tree = 0, dump_ast = 1 SELECT extract(identity('abc123abc456'), '^.*?(abc.*)');

-- Pinned because the test asserts on join plan/order
SET allow_correlated_subqueries = 1;

CREATE TABLE test_map_contains_values
(
    `ResourceAttributes` Map(LowCardinality(String), String),
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
)
ORDER BY tuple();

SELECT x FROM (SELECT 1 AS x, 1 AS ord UNION ALL SELECT [1,2,3] AS x, 2 AS ord) ORDER BY ord;

ALTER TABLE mv1 MODIFY COMMENT 'TEST COMMENT';

CREATE TABLE test_part_granule_offset (n UInt64) ENGINE = MergeTree ORDER BY () SETTINGS index_granularity = 2;

SELECT reinterpret(x'0101010102020202', 'Array(Int32)');

INSERT INTO t_memory SELECT 1, groupArrayLastState(1)(*) FROM values('v Nullable(String)', null);

-- 65433
SELECT conv('1012', 2, 10);

INSERT INTO geom1 VALUES((0, 0));

CREATE TABLE test
(
    `order` int,
    `indexed` int,
    PROJECTION proj
    (
        SELECT _part_offset
        ORDER BY indexed
    )
)
ENGINE = MergeTree
ORDER BY order
TTL if(order = 1, '1970-01-02T00:00:00'::DateTime, '2030-01-01T00:00:00'::DateTime);

select json.b from test_compact_advanced;

select json.b, json.c, json.arr[].arr1, json from test_compact_advanced;

select 'select json.a.a1, json.a.arr[].arr1, json.b, json.arr, json.^a, json';

select json.data, json.data.^a from test_compact_advanced_tuple;

select json, json.b, json.c, json.arr, json.arr[].arr1 from test_wide_advanced;

select 'select json.arr[].arr1, json.arr[].arr2 settings max_block_size=3';

select json.b, json.c, json.arr[].arr1, json.arr, json from test_wide_advanced settings max_block_size=3;

select 'select json.a.a1, json.a.arr[].arr1, json.b, json.arr, json.^a, json.arr[].arr1 settings max_block_size=3';

select 'select json.data.b, json.data, json.data.c limit 3';

select json.data.^a, json.data from test_wide_advanced_tuple settings max_block_size=3;

select json.arr, json.arr[].arr1 from test_wide_advanced limit 3;

select 'select json, json.a.a1, json.a.arr[].arr1, json.^a limit 3';

select json.b, json.c, json from test_compact_map;

select json.b, json.c, json from test_wide_map;

select json.data from test_wide_map_tuple;

select json.data.^a, json.data from test_wide_map_tuple settings max_block_size=3;

select json.a.a1, json.arr, json.^a from test_compact_map_with_buckets;

select json.b, json.c, json.arr, json from test_wide_map_with_buckets;

select json.a.a1, json.arr, json.^a from test_wide_map_with_buckets limit 3;

select json.data, json.data.b from test_wide_map_with_buckets_tuple;

select 'select json.data.b, json.data, json.data.c settings settings max_block_size=3';

select json.arr[].arr1, json.arr[].arr99 from test_compact_advanced format Null;

insert into test_wide_advanced select multiIf(
number < 15000,
'{"?1" : 1, "?2" : 1, "?3" : 1, "?4" : 1, "?5" : 1, "?6" : 1, "?7" : 1, "?8" : 1}',
number < 20000,
'{"a" : {"a1" : 1, "a2" : 2, "arr" : [{"arr1" : 3, "arr2" : 4, "arr3" : 5, "arr4" : 6}]}, "b" : 7, "c" : 8, "arr" : [{"arr1" : 9, "arr2" : 10, "arr3" : 11, "arr4" : 12}]}',
number < 25000,
'{}',
number < 30000,
'{"a" : {"a1" : 3, "a2" : 4, "arr" : [{"arr1" : 5, "arr2" : 6, "arr3" : 7, "arr4" : 8}]}}',
number < 35000,
'{"b" : 9, "c" : 10}',
number < 40000,
'{"arr" : [{"arr1" : 11, "arr2" : 12, "arr3" : 13, "arr4" : 14}]}',
'{"a" : {"a1" : 5, "a2" : 6}}'
) from numbers(45000);

select json.^a, json.a.a1, json.a.arr[].arr1, json.b, json.arr from test_wide_advanced format Null;

select json.data.b, json.data, json.data.c from test_compact_map_tuple format Null;

select json.data.^a, json.data from test_wide_map_tuple format Null;

select json.b from test_wide_map_with_buckets format Null;

-- Random settings limits: index_granularity=(100, None); index_granularity_bytes=(100000, None)

drop table if exists test_wide_advanced_tuple;

create table test_wide_map_with_buckets_tuple (json Tuple(data JSON(max_dynamic_paths=8))) engine=MergeTree order by tuple() settings min_bytes_for_wide_part=1, min_rows_for_wide_part=1, write_marks_for_substreams_in_compact_parts=1, object_serialization_version='v3', object_shared_data_serialization_version='map_with_buckets', object_shared_data_serialization_version_for_zero_level_parts='map_with_buckets', object_shared_data_buckets_for_wide_part=2;

SELECT DISTINCT lowCardinalityKeys(s) FROM test PREWHERE client_name = 'client1' ORDER BY ALL;

SELECT k1, k2, k3, sum(value) v FROM t_proj_external_agg GROUP BY k1, k2, k3 ORDER BY k1, k2, k3 SETTINGS optimize_aggregation_in_order = 0, max_bytes_before_external_group_by = 1, max_bytes_ratio_before_external_group_by = 0, group_by_two_level_threshold = 1;

CREATE TABLE agg
(
    `key` UInt32,
    `value` UInt32,
)
ENGINE = MergeTree
ORDER BY tuple() settings index_granularity=1;

WITH colorSRGBToOKLCH((0, 0, 255)) AS t
SELECT tuple(round(t.1, 6), round(t.2, 6), round(t.3, 6));

CREATE TABLE 03561_t0 (c0 Int) ENGINE = Memory;

SELECT count(*) FROM geom1;

SET enable_parallel_replicas = 1, parallel_replicas_for_non_replicated_merge_tree = 1, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost';

SELECT 'Test scoped lambda shadows an optimized builtin function';

SELECT 'Test late table filters in count subqueries fall back to normal analysis';

SELECT read_rows FROM system.query_log WHERE current_database = currentDatabase() AND query LIKE '%SELECT 1 where 0 AND (SELECT count(*) FROM test_03562) > 1 AS bool%' AND type = 'QueryFinish' AND is_initial_query = 1 ORDER BY event_time DESC LIMIT 1;

CREATE DATABASE db_6 ENGINE = Replicated('/test/db_6', '{shard}', '{replica}');

create table tab (x String, y UInt8) engine = MergeTree order by tuple();

INSERT INTO test_table Values(1, 1,  'x');

SELECT
    vin,
    battery_level AS batt,
    lat AS lat,
    lon AS lon,
    firmware_version AS fw,
    cabin_temperature AS temp,
    speed_kmh AS speed
FROM electric_vehicle_state FINAL
ORDER BY vin;

-- Bool as string
SELECT JSONExtractIntCaseInsensitive('{"Key": "123"}', 'key');

-- Arrays
SELECT JSONExtractIntCaseInsensitive('{"Items": [1, 2, 3]}', 'items', 1);

SELECT test_function(number, 0) FROM numbers(60) FORMAT Null SETTINGS max_threads = 1, max_block_size = 1;

-- Test 8: LIMIT BY ALL with window function - make deterministic
SELECT id, category, value, row_number() OVER (PARTITION BY category ORDER BY value) AS rn
FROM test_limit_by_all
ORDER BY id, category, value, rn 
LIMIT 1 BY ALL LIMIT 3;

DROP TABLE test_limit_by_all;

INSERT INTO t0 VALUES(0, 1);

INSERT INTO users VALUES (1, 'John', 33), (2, 'Ksenia', 48), (3, 'Alice', 50);

SELECT timeSeriesPredictLinearToGrid(10, 120, 10, 61, 60.5)(timestamps, values) FROM ts_data WHERE length(timestamps) = length(values);

INSERT INTO t_cross_scalar VALUES (NULL, 'a'), (42, 'b');

-- Case 5: NOT NULL source, cross-type (if-branch). No NULL row ever reaches ifNull, so this
-- isolates the value-conversion half (1 -> '1', 2 -> '2') that the NULL-bearing cases test jointly.
DROP TABLE IF EXISTS t_cross_notnull;

ALTER TABLE t_cross_variant MODIFY COLUMN x String DEFAULT '';

SELECT shardNum(), number
FROM remote('127.0.0.{1..3}', numbers(100))
WHERE number GLOBAL IN (
    SELECT number FROM numbers(10) WHERE number = shardNum()
)
ORDER BY 1, 2;

CREATE TEMPORARY TABLE test3 AS test;

SELECT read_rows
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND current_database = currentDatabase()
  AND type = 'QueryFinish'
  AND query LIKE '%FROM 03578_keepermap_dist%'
  AND is_initial_query
ORDER BY event_time_microseconds;

SELECT '-- RocksDB null: set with null';

DROP TABLE 03578_keepermap;

-- Test for issue #84442: ALTER MODIFY ORDER BY does not check if the new column has TTL
-- This test verifies that ALTER TABLE properly validates TTL columns in ORDER BY clauses

CREATE TABLE IF NOT EXISTS test_break_ddl
(
    id String,
    event_date Date,
    event_time DateTime,
    message String
)
ENGINE = ReplacingMergeTree()
PARTITION BY event_date
ORDER BY (id, event_date, event_time);

INSERT INTO t_coalesce (k, v1) VALUES (1, 'Hello');

CREATE TABLE nation(n_nationkey Int32, n_name String) ENGINE MergeTree ORDER BY n_nationkey SETTINGS auto_statistics_types='uniq,tdigest';

INSERT INTO t1 VALUES (2);

SELECT initCap(arrayJoin(['hello world', 'world hello'])::FixedString(11));

-- Tuple and CTE
WITH
    t as (select number, number+1 from numbers(5))
SELECT *
FROM numbers(8)
WHERE (number+1, number+2) in (t)
ORDER BY number;

DROP TABLE IF EXISTS 03591_test;

SELECT ProfileEvents['JoinBuildTableRowCount'] AS build_table_size
FROM system.query_log
WHERE log_comment = '03593_any_join_swap_tables' AND current_database = currentDatabase() AND type = 'QueryFinish' AND event_date >= yesterday() AND event_time >= NOW() - INTERVAL '10 MINUTE';

SELECT JSONExtractKeysCaseInsensitive('');

SELECT URLPathHierarchy('');

SELECT basename('');

SELECT domainWithoutWWW('');

SELECT groupArray('');

SELECT least('');

SELECT ngramSimHashUTF8('');

SELECT parseDateTimeInJodaSyntaxOrZero('');

SELECT reinterpretAsUInt32('');

SELECT toDateTime64OrNull('');

SELECT toInt32OrNull('');

SELECT toUInt256OrZero('');

SELECT ucase('');

SELECT
    arrayJoin(arrayMap(tag -> (map('a', 'value1', 'b', 'value2')[tag]), ['a', 'b'])) AS path,
    path IN ['Uncategorized'] AS in_category
FROM remote('127.0.0.{1,2}', system.one);

-- ^ certain functions are disabled in the fast test build.

SET session_timezone = 'UTC';

SELECT farmHash64() FROM system.one;

SELECT sipHash64() FROM system.one;

SELECT 0 = isASCII('\xC2\x80') FROM system.numbers LIMIT 1;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT count() FROM tab WHERE col_string LIKE 'app%';

SELECT '-- Test ILIKE with perfect suffix on String column - should NOT be rewritten';

SELECT count() FROM tab WHERE col_string LIKE '_est%';

SELECT count() from tab WHERE col_nullable_string LIKE '%a';

SELECT count() from tab WHERE col_lowcardinality_nullable_fixedstring LIKE 'a%';

DROP USER test_user_03593_1;

DESC test_alter_if_exists;

-- Disable automatic spilling for this test
SET query_plan_convert_any_join_to_semi_or_anti_join = 1;

SELECT sum(cityHash64(extractURLParameterNames(URL))) FROM test.hits;

SELECT any(0) FROM system.one;

SELECT byteSize(0) FROM system.one;

SELECT exp2(0) FROM system.one;

SELECT groupArrayMovingSum(0) FROM system.one;

SELECT isConstant(0) FROM system.one;

SELECT medianExactLow(0) FROM system.one;

SELECT range(0) FROM system.one;

SELECT sin(0) FROM system.one;

SELECT toBool(0) FROM system.one;

SELECT toInt8OrDefault(0) FROM system.one;

SELECT toUInt8(0) FROM system.one;

CREATE TABLE test_join_remote_r (c Int) ENGINE=MergeTree() ORDER BY tuple();

with queries as (
    select query_id, row_number() over(order by event_time_microseconds) as ordinal
    from system.query_log
    where event_date >= yesterday() AND event_time >= now() - 600 AND type = 'QueryFinish'
     and current_database = currentDatabase()
     and query_kind = 'Select'
     and Settings['min_bytes_to_use_direct_io'] = '1'
)
select queries.ordinal, thread_name, sum(ProfileEvents['OSReadBytes']) > 0 as disk_reading
from system.query_thread_log qtl
    join queries
        on queries.query_id = qtl.query_id
where qtl.event_date >= yesterday() AND qtl.event_time >= now() - 600 AND current_database = currentDatabase()
  and query_id in (select query_id from queries)
  and ProfileEvents['OSReadBytes'] > 0
group by 1, 2
order by 1, 2;

select t, a from test;

select d, toTypeName(d) from format(JSONEachRow, '{"d" : "1800-01-01 00:00:00", "s" : "some string"}');

DELETE FROM t_lwd_vertical WHERE 1;

select accurateCastOrNull(materialize('{"a" : 42, "a" : 43}'), 'JSON');

CREATE TABLE B ( `key` String, `flag` Bool ) ENGINE = MergeTree ORDER BY (key);

-- Have some granules where all rows pass the filter.
insert into t select intDiv(number, 100), intDiv(number, 100), 0, intDiv(number, 33) from numbers(100 + 10);

drop table test_new;

insert into t_column_names values ('foo');

-- BFloat16 can't represent 86400 exactly, but it's still the same date
SELECT from, val, val::UInt16 FROM test_date_casts ORDER BY ALL;

SET query_plan_propagate_predicate_across_join = 0;

DROP TABLE tp2;

SELECT 'Purpose:';

SELECT 'NULL-safe comparisons with type-correct literals';

SELECT id, a, b,
       (a IS DISTINCT FROM b) AS distinct_flag
FROM 03611_t_nullsafe
ORDER BY (a <=> b) DESC, distinct_flag ASC, id;

SELECT DISTINCT * WHERE 2 <=> materialize(2)
GROUP BY 1
WITH TOTALS QUALIFY ((2 <=> 2) / ((2 IS NOT NULL) IS NULL), *, *, materialize(toNullable(2)), materialize(2), materialize(materialize(2)), 2)
<=> ((2 = *) * 2, *, *, 2, toNullable(2), 2, 2);

SELECT
    c1,
    uniqExact(c2)
FROM test
GROUP BY c1
    WITH TOTALS
ORDER BY c1 DESC;

SELECT 1 FROM numbers(3) ORDER BY [1, ()]  FETCH FIRST 1 ROW ONLY SETTINGS allow_suspicious_types_in_order_by = 1, use_variant_as_common_type = 1;

-- - no-random-merge-tree-settings -- may change amount of granulas
-- add_minmax_index_for_numeric_columns=0: Changes the plan (the index on value would filter out value = 0)

drop table if exists data;

select * from mergeTreeAnalyzeIndexes(currentDatabase(), data_add_minmax_index_for_numeric_columns, key = 8193, []);

insert into test_1m select number, number*100 from numbers(1e6) settings max_block_size=10000, min_insert_block_size_rows=10000, max_insert_threads=1;

-- make sure that local replica is not included
set max_parallel_replicas=4;

select hex(maxDistinctState(tuple('str', 42.42::Float64)));

select hex(maxDistinctState(tuple('str', '2020-01-01'::DateTime64)));

SELECT makeDateTime64(1969, 6, 15, 12, 0, 0, 500000, 6);

insert into no_dist_idx_min_not_enough_parts select number, number*100 from numbers(1e6);

drop table dist_idx_skipping_idx_size;

SELECT
    name,
    c
FROM
users
RIGHT JOIN
(
    SELECT
        user_id,
        count() AS c
    FROM messages
    GROUP BY user_id
) AS messages
ON messages.user_id = users.id
ORDER BY
    user_id ASC,
    c ASC;

SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY c2,
    c4
ORDER BY
    c5 DESC,
    c3 DESC) AS row_n
FROM
    (
    SELECT
        t1.c1 as account_id,
        t1.c2 as c2,
        t1.c3 as c3,
        t1.c4 as c4,
        t1.c5 as c5,
        ROW_NUMBER () OVER (PARTITION BY t1.c2,
        t1.c3,
        t1.c4
    ORDER BY
        t1.c5 DESC) AS rn
    FROM
        table_test AS t1
    GROUP BY
        t1.c1,
        t1.c2,
        t1.c3,
        t1.c4,
        t1.c5
    ORDER BY
        t1.c2,
        t1.c4,
        t1.c5
)
WHERE
    rn = 1
ORDER BY
    c2,
    c4,
    c5,
    c3
FORMAT Null;

CREATE TABLE t_alter_auto_statistics
(
    a UInt64,
    b UInt64 STATISTICS (basic),
    c String
)
ENGINE = MergeTree ORDER BY a SETTINGS auto_statistics_types = '';

insert into tab select toDateTime(toDate('2000-01-01')) + number, if(bitAnd(number, 1) = 0, 'a', 'b') from numbers(100);

select `t.t`.a from format(JSONEachRow, '`t.t` Tuple(a UInt32)', '{"t.t" : {"a" : 42}}');

SELECT count() FROM test_mixed_duplicates WHERE id = 1;

SELECT startsWithCaseInsensitiveUTF8('Bär', 'bä'), startsWithCaseInsensitiveUTF8('Bär', 'BÄ');

SELECT COUNT() FROM tab WHERE endsWithCaseInsensitive(S1, '2');

CREATE TABLE test_03629 (a UInt64) ENGINE = S3(s3_conn, filename='test_03629_{_partition_id}', format='Native', partition_strategy='wildcard') PARTITION BY a;

insert into function file(current_database() ||'03630_parquet_bool_bug.parquet', Parquet, 'tags Array(Bool)') settings engine_file_truncate_on_insert=1 values ([false,false,false,false,false,false,false,false]), ([true,true,true,true,true,true,true,true]);

DROP TABLE test_arith;

SELECT * REPLACE(a + 100 AS b) FROM test_replace_main WHERE b + 50 > 200 ORDER BY b;

CREATE TABLE test_having_sub (category String, amount UInt32) ENGINE = Memory;

-- Different values for tests with DatabaseReplicated and without.
SELECT value == '127.0.0.1:9181' OR value == 'localhost:9181,localhost:19181,localhost:29181'
FROM system.server_settings WHERE name = 'keeper_hosts';

SELECT number FROM numbers(10) ORDER BY number OFFSET -9223372036854775808;

SELECT 'Double Column';

-- Unsupported at the moment, refer to comments in `RuntimeDataflowStatisticsCacheUpdater::recordAggregationStateSizes`
-- SELECT COUNT(DISTINCT SearchPhrase) FROM test.hits FORMAT Null SETTINGS log_comment='query_5';

-- With smaller block sizes we can get slightly lower estimations and it will send us over the threshold. Instead of relaxing the check for all queries I prefer to specify the block size here.
SELECT MobilePhoneModel, COUNT(DISTINCT UserID) AS u FROM test.hits WHERE MobilePhoneModel <> '' GROUP BY MobilePhoneModel ORDER BY u DESC LIMIT 10 FORMAT Null SETTINGS log_comment='query_10', max_block_size=65409;

SET optimize_move_to_prewhere = 1, query_plan_optimize_lazy_materialization = 1, query_plan_max_limit_for_lazy_materialization = 10000;

OPTIMIZE TABLE post_state;

SET allow_experimental_alias_table_engine = 1;

DROP TABLE alias_2;

SELECT count() FROM alias_part;

SELECT 'After EXCHANGE source tables';

-- Alias should immediately see the new column (dynamic metadata fetch)
SELECT 'After ALTER target';

DROP TABLE alias_with_missing_target;

-- Insert only c1
INSERT INTO alias_col_types (c1) VALUES (5);

DROP ROW POLICY target_policy ON test_table;

create table test (json JSON(max_dynamic_paths=4)) engine=MergeTree order by tuple() settings min_bytes_for_wide_part='100G', merge_max_dynamic_subcolumns_in_compact_part=2;

select sipHash64('{"a" : 42, "b" : "str", "c" : [{"d" : 1}, {"e" : 2}], "f" : null}'::JSON);

alter table test_materialize rewrite parts settings mutations_sync=2;

SELECT '-- Simple OR condition';

SELECT '-- Complex condition';

CREATE TABLE ttl_sparse_repro
(
    a UInt64,
    dt DateTime,
    b UInt64 TTL dt + INTERVAL 2 SECOND, c UInt64
)
ENGINE = MergeTree ORDER BY a SETTINGS ratio_of_defaults_for_sparse_serialization = 0.9;

CREATE TABLE n3 (number UInt64) ENGINE = MergeTree ORDER BY number;

INSERT INTO t1 VALUES (1, [10, 20], [30, 40]);

-- absorbing WHERE into ON clause changes join plan structure in EXPLAIN output
SET query_plan_remove_unused_columns = 1;

SELECT 1 as x
FROM t1
LEFT OUTER JOIN t2 USING (x)
LEFT OUTER JOIN t3 USING (x)
LEFT OUTER JOIN t4 USING (x);

SELECT number FROM numbers(10)  LIMIT 0.1  OFFSET 0.5;

-- Bucket boundaries are ascending.
SELECT min(arraySort(mapKeys(h.histogram)) = mapKeys(h.histogram))
FROM system.metric_log
ARRAY JOIN histograms AS h
WHERE h.metric = 'keeper_client_queue_duration_milliseconds';

-- Suppress "Server has databases (for example `X`) with Ordinary engine, which was deprecated."
set send_logs_level='error';

CREATE OR REPLACE TABLE t (x INT) ENGINE=MergeTree ORDER BY x;

INSERT INTO t2 SELECT rand(), 2, repeat('bbb', 1_000_000) from numbers(10);

ATTACH TABLE view_order_attribution;

SET enable_parallel_replicas=1, max_parallel_replicas=3, cluster_for_parallel_replicas='test_cluster_one_shard_three_replicas_localhost', parallel_replicas_for_non_replicated_merge_tree=1;

CREATE TABLE tbl
(
    `id1` LowCardinality(String),
    `id2` LowCardinality(String),
    `v` Int64
)
ENGINE = MergeTree
ORDER BY (id1, id2, v);

SYSTEM STOP MERGES const_node;

-- Test 3: ORDER BY on sorting key with PREWHERE
-- Similar to Test 2 but with PREWHERE
SELECT '=== Test 3: ORDER BY a with PREWHERE ===';

INSERT INTO pv_data VALUES (1, 'a') (2, 'b') (3, 'c') (5, 'e');

-- scalar `LowCardinality(String)` param (top-level family `LowCardinality`, not `Array`)
CREATE VIEW pv_lc AS SELECT * FROM pv_lc_data WHERE name = {nm : LowCardinality(String)};

-- Analyzer header inference (`getSampleBlock`, only-analyze mode, e.g. `CREATE TABLE ... AS
-- SELECT`) must resolve a subquery-valued parameter to its real value, not a default
-- placeholder. When the projected type depends on the parameter value the default (empty
-- array, length 0) made `toFixedString` throw `size must be positive`, so `CREATE TABLE ...
-- AS SELECT` failed while real execution produced `FixedString(3)`. See issue #68041.
SELECT 'analyzer-only header inference, value-dependent type (Array)';

DROP TABLE pv_cts_fixed;

-- Ensure that column TTL is applied

optimize table x final deduplicate by dt, i;

SELECT DISTINCT x / 2 FROM tab;

DROP TABLE IF EXISTS 03701_unsorted, 03701_sorted;

SELECT DISTINCT 'Sorted ORDER BY key LIMIT BY key, val: ' || replaceRegexpOne(trim(BOTH ' ' FROM explain), ' × \\d+$', '')
FROM (EXPLAIN PIPELINE SELECT key FROM 03701_sorted ORDER BY key LIMIT 1 BY key, val LIMIT 10)
WHERE explain LIKE '%LimitBy%Transform';

SELECT 'Equality, RHS';

SELECT 'equals()';

SELECT color_id, payload
FROM t
WHERE NOT (dictGetString('colors', 'name', color_id) = 'red')
ORDER BY color_id, payload
SETTINGS optimize_inverse_dictionary_lookup = 0;

SELECT color_id
FROM t
WHERE dictGetString('colors', 'name', color_id) = 'nonexistent_color'
ORDER BY color_id
SETTINGS optimize_inverse_dictionary_lookup = 0;

SELECT countIf(dictGetString('colors','name', color_id) = 'red') AS cnt
FROM t;

SELECT color_id,
       row_number() OVER (
           PARTITION BY (dictGetString('colors','name', color_id) = 'red')
           ORDER BY color_id
       ) AS rn
FROM t
ORDER BY color_id, rn;

CREATE TABLE dis_test_shard_scope ENGINE=Distributed(test_cluster_one_shard_three_replicas_localhost, currentDatabase(), test_shard_scope);

INSERT INTO test_alter_codec_pk (value) VALUES (1);

ALTER TABLE test_compact MODIFY SETTING alter_column_secondary_index_mode = 'drop';

SELECT 'WIDE AFTER DELETE', * from test_wide;

INSERT INTO dict_src_simple_kv VALUES
    (1, 10),
    (2, 10),
    (3, 20);

SELECT toTypeName(dictGetKeys('dict_complex_wide_kv', 'attr', 10));

SELECT dictGetKeys('dict_types', 'arr_nested', '[[1,2],[3]]');

SELECT 'LowCardinality(String) vector';

CREATE TABLE IF NOT EXISTS geo_dst (id Int32, geom Geometry) ENGINE = Memory();

DROP TABLE IF EXISTS ref_items_flat;

EXPLAIN SYNTAX run_query_tree_passes=1
SELECT k1, k2, payload
FROM f
WHERE dictGet('dict_prices_ck_sparse_hashed', 'tag', (k1, k2)) = 'pro'
ORDER BY k1, k2, payload;

SELECT 'SparseHashed, opt off';

CREATE TABLE ref_table_all
(
  id   UInt64,
  name String,
  i8   Int8,
  i16  Int16,
  i32  Int32,
  i64  Int64,
  u8   UInt8,
  u16  UInt16,
  u32  UInt32,
  u64  UInt64,
  f32  Float32,
  f64  Float64,
  d    Date,
  dt   DateTime,
  uid  UUID,
  ip4  IPv4,
  ip6  IPv6
)
ENGINE = MergeTree
ORDER BY id;

SELECT 'dictGetUInt64, opt off';

EXPLAIN SYNTAX run_query_tree_passes=1
SELECT id, payload FROM tab
WHERE dictGetIPv4('dictionary_all', 'ip4', id) = toIPv4('192.168.0.1')
ORDER BY id, payload;

SELECT '--- Test 2: Float column used as boolean condition in WHERE';

INSERT INTO test_minmax_skip VALUES (0, 'zero'), (1, 'one'), (2, 'two');

CREATE TABLE test_indexhint_no_bool_part (w UInt256, id UInt32)
ENGINE = MergeTree PARTITION BY w ORDER BY id SETTINGS index_granularity = 8;

SELECT count() FROM (SELECT number < 100 AS n FROM numbers(2000) ORDER BY n DESC LIMIT 0.03 WITH TIES);

-- countIf with asterisk and multiple columns in subquery
SELECT countIf(*, number < 20) FROM (SELECT number, 1, 2 FROM numbers(100));

INSERT INTO src_ab VALUES (2, 'v');

SELECT arrayRemove([0], 0);

SELECT arrayRemove([[1], [1,2], [2,3], [1,2]], [1,2]);

SELECT
    ProfileEvents['ParquetMetadataCacheHits'] AS hits,
    ProfileEvents['ParquetMetadataCacheMisses'] AS misses
FROM system.query_log
WHERE (log_comment = '03707-second-test-query') AND (type = 'QueryFinish') AND (current_database = currentDatabase());

-- Changes query plan
SET query_plan_convert_outer_join_to_inner_join = 1;

insert into `this.is.a.valid.databasename`.`test_table with spaces` values (1, 'a'), (2, 'b'), (3, 'c');

-- Test special columns handling in ReadFromMergeTree::removeUnusedColumns with FINAL and PREWHERE
-- Similar to https://github.com/ClickHouse/ClickHouse/issues/45804

-- Test 1: ReplacingMergeTree with version column
DROP TABLE IF EXISTS test_replacing_mt;

-- Use version column in PREWHERE and SELECT
SELECT count(ver) FROM test_versioned_collapsing_mt FINAL PREWHERE ver > 0;

CREATE TABLE local_table_l
(
    `c` Int32
)
ENGINE = MergeTree
ORDER BY tuple()
SETTINGS index_granularity = 1;

SELECT id, tup FROM tuple_test WHERE tup IS NULL ORDER BY id;

SELECT 'ORDER BY - Element u NULLS FIRST';

SELECT tup.u, count() as cnt
FROM tuple_test
GROUP BY tup.u
HAVING tup.u > 10
ORDER BY tup.u;

SELECT 'DISTINCT - Multiple elements';

SELECT
    id,
    tup.u,
    row_number() OVER (ORDER BY tup.u, id NULLS LAST) as rn
FROM tuple_test
ORDER BY rn, id;

SELECT 'CTE - Basic';

SELECT c0 + 1 as expr FROM test_limit_by_validation GROUP BY c0 + 1 ORDER BY expr LIMIT 1 BY expr;

SELECT t FROM test_empty_tuple WHERE [t] IN [tuple()];

-- single-arg Nullable return type
SELECT midpoint(toNullable(42)) AS result, toTypeName(result) AS type;

SELECT b, c, midpoint(b, c) AS result, toTypeName(result) AS type
FROM midpoint_nullable_test
ORDER BY ifNull(b, -999), c;

SELECT
    midpoint(
        toInt128('-170141183460469231731687303715884105728'),
        toInt128('170141183460469231731687303715884105727')
    ) AS result,
    toTypeName(result) AS type;

SELECT
    midpoint(
        CAST(NULL AS Nullable(Int256)),
        toNullable(toInt256('57896044618658097711785492504343953926634992332820282019728792003956564819967')),
        toNullable(toInt256('57896044618658097711785492504343953926634992332820282019728792003956564819967'))
    ) AS result,
    toTypeName(result) AS type;

CREATE MATERIALIZED VIEW mv TO n1_n2_join
AS SELECT n1.key as k, n1.value as v1, n2.value as v2 from n1 JOIN n2 ON n1.key = n2.key ORDER BY n1.key;

SELECT 'Error cases for Nullable(Tuple) element access';

SELECT 'All NULL elements in array';

INSERT INTO test_nullable_tuples VALUES
    (1, (100, 'hello')),
    (2, NULL),
    (3, (300, 'world')),
    (4, NULL),
    (5, (500, 'test'));

SELECT
    avg(tupleElement(person, 'age')) as avg_age,
    sum(tupleElement(person, 'salary')) as total_salary,
    count(tupleElement(person, 'name')) as count_people
FROM test_nullable_named_tuples;

SELECT 'ORDER BY Nullable(Tuple) elements';

SYSTEM STOP MERGES 03711_database.03711_mv_table_2;

CREATE TABLE 03711_database.03711_type_json_mdp0 (v JSON(max_dynamic_paths=0)) ENGINE = MergeTree() ORDER BY tuple()
    SETTINGS non_replicated_deduplication_window = 1000, min_bytes_for_wide_part = 10000, min_rows_for_wide_part = 10000, index_granularity = 8192, serialization_info_version = 'basic', string_serialization_version = 'with_size_stream', dynamic_serialization_version = 'v2', object_serialization_version = 'v3', object_shared_data_serialization_version = 'map', object_shared_data_serialization_version_for_zero_level_parts = 'map';

INSERT INTO 03711_database.03711_type_mixed VALUES (1, 'hello', 1.23, 3.14, 'abcdefgh', [1, 2, 3], 42, (1, 100), {'a': 1}), (2, 'world', 4.56, 2.72, '12345678', [4, 5], NULL, (2, 200), {'c': 3});

SELECT v1, v2 FROM tab2 ORDER BY v1 DESC, v2 DESC LIMIT 20 SETTINGS use_top_k_dynamic_filtering=1;

INSERT INTO tab1 SELECT rand(), toUnixTimestamp(toDateTime(number + 1) % 10), number + 1 from numbers(1000000);

SELECT toTypeName([CAST((8, 9), 'Tuple(Int32, Int32)'), CAST((2, 5), 'Nullable(Tuple(Int32, Int32))')]);

SELECT toTypeName([
    CAST(tuple(1), 'Tuple(Int32)'),
    CAST(tuple(2), 'Nullable(Tuple(Int32))')
]);

SELECT
    -- Full scan on each lookup
    if(read_rows > 2_000_000, 'OK', format('Fail: {} rows read, query_id="{}"', read_rows, query_id)),
    if(ProfileEvents['JoinBuildTableRowCount'] BETWEEN 1_100_000 AND 2_100_000, 'OK',
        format('Fail: JoinBuildTableRowCount={}, query_id="{}"', ProfileEvents['JoinBuildTableRowCount'], query_id)),
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND type = 'QueryFinish' AND current_database = currentDatabase() AND event_time >= yesterday() AND query_kind = 'Select'
    AND log_comment == '03712_nested_loop_join_merge_tree_full_scan';

CREATE TABLE tab (c0 Tuple()) ENGINE = Memory;

DETACH TABLE x2 SYNC;

SELECT count()
FROM customer
WHERE NOT EXISTS (
    SELECT *
    FROM nation
    WHERE c_nationkey = n_nationkey
)
SETTINGS correlated_subqueries_default_join_kind = 'right';

DROP TABLE IF EXISTS 03717_table;

select '03717_table', * from 03717_table order by all;

desc format(JSONEachRow, '{"d" : "5981 10:01.000"}');

SELECT number FROM numbers(5, 18446744073709551615, 1) LIMIT 10;

SELECT number FROM numbers_mt(100, 10, 1) WHERE number < 50;

INSERT INTO 03720_tuple_equality VALUES (1, 10, 'a'), (1, 20, 'b'), (2, 10, 'c'), (2, 20, 'd');

CREATE TABLE 03720_string_keys (k1 String, k2 String, val UInt32) ENGINE=EmbeddedRocksDB PRIMARY KEY (k1, k2);

DROP TABLE 03720_single_column;

INSERT INTO 03720_mutations VALUES (1, 1, 'old'), (1, 2, 'data');

-- Should be 'c'

DROP TABLE 03720_deletes_three_col;

-- UPDATE with string keys
DROP TABLE IF EXISTS 03720_updates_string;

-- JOIN with three-column primary keys
DROP TABLE IF EXISTS 03720_join_three_left;

SELECT COUNT(*) FROM 03720_join_rocks AS r
LEFT JOIN 03720_join_merge AS m ON r.k1 = m.k1 AND r.k2 = m.k2;

-- Test: Only Empty Strings and NULLs
SELECT '=== Test: Only Empty and NULLs ===';

SELECT toTypeName(arrayElementOrNull(CAST([(NULL, 'a'), (1, 'b')] AS Array(Tuple(Nullable(Int64), String))), 1));

SELECT arrayElementOrNull([CAST((1, 'a') AS Nullable(Tuple(Int64, String))), (2, 'b')], CAST(1 AS Int8));

INSERT INTO test_array_tuple_mergetree VALUES
    (1, [(1, 'a'), (2, 'b')], [(1, 'a'), NULL], 1),
    (2, [(3, 'c')],           [NULL],           2),
    (3, [],                   [],               -1),
    (4, [(4, 'd')],           [(4, 'd')],       0);

SELECT arrayElement([CAST((1, 'a') AS Nullable(Tuple(Int64, String))), (2, 'b')], 3);

WITH [(1, 'a'), (2, 'b')] AS arr
SELECT
    arrayElement(arr, CAST(idx AS Int8))  AS int8_res,
    arrayElement(arr, CAST(idx AS UInt8)) AS uint8_res
FROM
(
    SELECT 1  AS idx
    UNION ALL
    SELECT 2  AS idx
    UNION ALL
    SELECT 3  AS idx
    UNION ALL
    SELECT -1 AS idx
    UNION ALL
    SELECT -2 AS idx
    UNION ALL
    SELECT -3 AS idx
) ORDER BY tuple();

SELECT RTRIM('  x  '), trimRight('  x  ');

INSERT INTO test_min_insert_rows_bytes FORMAT CSV
10
20
30
40
50
60
70
80

-- TEST 3: min_insert_block_size_rows=4 (emit when 4 rows accumulated)

SET max_insert_block_size_bytes = 0;

-- See also 03604_key_condition_set_tuple_bug.sql‎

DROP TABLE IF EXISTS prd_bid_events_simple_no_partition;

-- toDateTimeOrNull: pre-epoch and far future datetimes
select 'toDateTimeOrNull:';

select '1960-01-01' as input, accurateCastOrNull('1960-01-01', 'DateTime64') as result settings cast_string_to_date_time_mode='best_effort';

GRANT ALTER UPDATE ON normal TO test_03727;

-- Test 1: Original fiddle query from issue #89412
DROP TABLE IF EXISTS t0;

-- MD4 produces 16 bytes
SELECT length(HMAC('md5', 'test', 'key'));

-- The function HMAC requires the openssl library, disabled in fasttest builds.
-- This test covers only FIPS-approved algorithms, so it runs in all builds including FIPS.

-- HMAC basic function with FIPS-safe algorithms, test case insensitivity and correctness with known values
SELECT
    hex(Hmac('sha1', 'The quick brown fox jumps over the lazy dog', 'secret_key'))   AS hmac_sha1,
    hex(HMac('sha224', 'The quick brown fox jumps over the lazy dog', 'secret_key')) AS hmac_sha224,
    hex(HMAc('sha256', 'The quick brown fox jumps over the lazy dog', 'secret_key')) AS hmac_sha256,
    hex(hmAc('sha384', 'The quick brown fox jumps over the lazy dog', 'secret_key')) AS hmac_sha384,
    hex(HMAC('sha512', 'The quick brown fox jumps over the lazy dog', 'secret_key')) AS hmac_sha512
FORMAT Vertical;

system flush async insert queue 03732_table_join;

-- 1 element in filter
SELECT count()
FROM
        customer
    LEFT ANTI JOIN
        (SELECT n_nationkey FROM nation WHERE n_name = 'FRANCE') as n
    ON c_nationkey = n.n_nationkey;

-- Expecting 400000

create table table_join_mv_dst
(
    id      UInt32,
    name    String,
    surname String
)
engine = ReplicatedMergeTree('/clickhouse/tables/test/{database}/table_join_mv_dst', 'replica1')
order by id;

SELECT count()
FROM test_has_idx_tuple_col
WHERE key_tuple IN ((10, 0), (50000, 0));

SELECT count()
FROM test_has_idx_nullable
WHERE key_nullable IN (11, 50000, 90000);

SET query_plan_join_swap_table='auto';

INSERT INTO t_sparse_neg_zero_bf16 VALUES (-0.0), (1.0), (2.0);

-- SEMI/ANTI join ordering constraints cause dpsize solver to fail
SET query_plan_convert_outer_join_to_inner_join = 1;

SELECT count() 
FROM test_has_skip_set 
WHERE user_id IN (10, 20, 30);

select * from dst_1_0 order by all;

optimize table empty_buffer_zero_time;

-- max_bytes_to_merge_at_max_space_in_pool = 0 makes background merges impossible for these
-- tables: it is only read when selecting a background merge, so OPTIMIZE FINAL still merges.

SET alter_sync = 2;

SELECT 'test3_before', count() FROM t_ttl_vert_3;

CREATE TABLE t_ttl_vert_6
(
    id UInt64,
    d DateTime,
    category UInt8,
    c1 UInt64,
    c2 UInt64,
    c3 UInt64
)
ENGINE = MergeTree
ORDER BY id
TTL d + INTERVAL 1 DAY DELETE WHERE category = 1
SETTINGS
    min_bytes_for_wide_part = 0,
    min_bytes_for_full_part_storage = 0,
    max_bytes_to_merge_at_max_space_in_pool = 0,
    enable_block_number_column = 0,
    enable_block_offset_column = 0,
    vertical_merge_algorithm_min_rows_to_activate = 1,
    vertical_merge_algorithm_min_columns_to_activate = 1,
    vertical_merge_optimize_ttl_delete = 1,
    merge_with_ttl_timeout = 0,
    ratio_of_defaults_for_sparse_serialization = 1.0;

CREATE VIEW test_view AS SELECT * FROM file(database() || '.test-data.json', JSON);

SELECT count() FROM 03741_data WHERE _path NOT IN (SELECT * FROM 03741_filter WHERE path LIKE '%nested%');

SELECT '--- final';

SELECT '--- with setting';

DROP ROW POLICY IF EXISTS pol_part ON tab_part;

SELECT '= row policy on toDate(time) with ORDER BY toDate(time) — prewhere should NOT be deferred =';

INSERT INTO tab_compound_pw VALUES (1, 'aaa', 1), (2, 'bbb', 1), (3, 'ccc', 1);

SELECT * FROM tab_nested_and_pw FINAL PREWHERE (y != 'eee' AND x > 1) AND x < 5 ORDER BY x;

create table test_lazy (id UInt64) engine=MergeTree order by tuple() settings min_bytes_for_wide_part=1, min_rows_for_wide_part=1;

SELECT sum(sipHash64(t0.Id, t0.Payload)) AS hash_sum, count() AS cnt
FROM events2 AS t0
ANTI LEFT JOIN attributes2 AS t1 ON t1.EventId = t0.Id;

CREATE TABLE test_nested_subcolumn_refill_wide
(
    `id` UInt64,
    `arr.id` Array(UInt64),
    `arr.nested` Array(Tuple(a String, b Float64))
)
ENGINE = MergeTree ORDER BY (id) SETTINGS min_bytes_for_wide_part = 0, share_nested_offsets = 1;

SELECT 'default subcolumn alone', arr.nested.b FROM test_nested_subcolumn_refill_default;

INSERT INTO alp64 SELECT i, f FROM base64;

SELECT '# Negative Numbers Test';

INSERT INTO base32 SELECT number, toFloat32(round(number * 0.1 + cos(number), 2)) FROM numbers(1025);

DROP TABLE IF EXISTS tab_sk_no_pw;

-- Row policy is on `deleted` (non-SK), PREWHERE is on `key` (part of SK `(key, id)`)
-- Both filters must be deferred — earlier revisions of this PR let PREWHERE
-- skip deferral here, which is the side channel `throwIf` would exploit
SELECT '--- EXPLAIN actions=1, apply_row_policy_after_final=1: deferred filter lines';

DROP TABLE test_buffer_03745;

SELECT 'BAREWORD NEG INF', -inf, toTypeName(-inf);

-- Test String length (size substream)
drop table if exists test_length_string;

select id from test_isnull where isNull(n) settings optimize_functions_to_subcolumns=0;

select distinct arrayJoin(JSONSharedDataPaths(t.json)) from test;

INSERT INTO TABLE t0 (c0) SELECT 'abc' FROM numbers(142);

SELECT 1 WHERE (y -> 1) IN (materialize(1), 1);

select materialize(['{"a" : 42}'])::Array(JSON)[1].a;

-- PostgreSQL/SQLite style (quote doubling)
select toFixedString('\'', 4) format Values;

insert into dst select * from src;

-- Both non-null
SELECT
    tupleModulo(
        CAST((15, 10, 5) AS Nullable(Tuple(Int32, Int32, Int32))),
        CAST((5, 3, 2) AS Nullable(Tuple(Int32, Int32, Int32)))
    ) AS res,
    toTypeName(res),
    isNull(res);

SELECT 'Fractional Limit, Fractional Offset - Early Pushing/Evicting';

SELECT CAST(tuple(2, 3) AS Nullable(Tuple(Int32, Int32))) * tuple(4, 5);

INSERT INTO nation VALUES (5,'ETHIOPIA'),(6,'FRANCE'),(7,'GERMANY'),(100,'UNKNOWN');

SELECT number FROM numbers(15) ORDER BY number LIMIT 0.33, 0.5  WITH TIES;

CREATE TABLE test (c String) ENGINE = Log;

INSERT INTO test_table VALUES (NULL), (tuple(1, 2)), (tuple(3, 4));

DROP TABLE IF EXISTS rings;

-- Parts metrics dictionary
CREATE DICTIONARY parts_dict
(
    `metric` String,
    `value` Int64
)
PRIMARY KEY metric
SOURCE(CLICKHOUSE(QUERY 'SELECT metric, value FROM system.metrics WHERE metric LIKE \'Parts%\''))
LIFETIME(MIN 0 MAX 1000)
LAYOUT(COMPLEX_KEY_HASHED());

INSERT INTO filesystem_metrics SELECT metric, value FROM system.metrics WHERE metric IN (SELECT metric FROM filesystem_dict);

CREATE OR REPLACE TABLE t0 (c0 Int) ENGINE = MergeTree() ORDER BY tuple() SETTINGS storage_policy = 'policy_03755';

SELECT
    (SELECT count() FROM (SELECT DISTINCT k1 FROM distinct_lc_mixed))
  - (SELECT uniqExact(k1) FROM distinct_lc_mixed);

CREATE TABLE test_pk
(
    `dt` DateTime,
    `key` String
)
ENGINE = MergeTree
ORDER BY (dt, key)
SETTINGS index_granularity = 4;

-- Test LowCardinality input for obfuscateQueryWithSeed (should remain deterministic)
SELECT uniq(obfuscateQueryWithSeed(
    materialize(CAST('select 1', 'LowCardinality(String)')),
    materialize(CAST('seed', 'LowCardinality(String)')))) AS uniq_lc_seed
FROM numbers(2);

CREATE TABLE t0 (s Tuple(a String)) ENGINE = MergeTree ORDER BY tuple() SETTINGS min_bytes_for_wide_part = 0, ratio_of_defaults_for_sparse_serialization = 0.1, serialization_info_version = 'with_types', string_serialization_version = 'single_stream';

INSERT INTO t_mem SELECT number, sipHash64(number, 1) FROM numbers(5_000);

-- This setting does not reach the backup temporary file buffer, which is sized by a NonZeroUInt64 setting.
SET max_compress_block_size = 0;

SELECT prime
FROM system.primes
WHERE prime < 20
LIMIT -3;

SELECT prime FROM primes(1, 10, 2);

create table tab (x UInt32, y UInt32, z UInt32) engine = MergeTree order by tuple();

-- upper is not an injective function, thus it cannot be converted to INNER JOIN
EXPLAIN actions = 1, keep_logical_steps = 1
SELECT *
FROM users u1 LEFT ANY JOIN
(
    SELECT sum(age)::Nullable(Int64) AS age_sum, name
    FROM users
    GROUP BY name
) u2
ON u1.name = upper(u2.name)
WHERE uid < age_sum;

SELECT arraySort(groupArray(s))
FROM table_str_chain
WHERE s IN ['Abc', 'Bar', 'XYZ', 'Hello', 'AA'];

EXPLAIN indexes = 1
SELECT arraySort(groupArray(x))
FROM table_intdiv_string
WHERE NOT has(CAST([12,95,2,33,100] AS Array(Int32)), x);

select a.size0 from test;

explain query tree select ab, bcd from test;

SELECT '-- Initial data:';

DROP TABLE test_long_index_compact;

SELECT * FROM (SELECT number AS key, number as val FROM numbers(200_000)) t1
JOIN (SELECT number AS key FROM numbers(200_000)) t2
USING key
SETTINGS log_comment='03772_temporary_files_codec/partial_merge_join', temporary_files_codec = 'LZ4'
FORMAT Null;

CREATE TABLE test_lwd (id UInt64)
ENGINE MergeTree() ORDER BY id
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1, index_granularity = 8192, index_granularity_bytes = '10Mi';

INSERT INTO tab_m SELECT number, number, number, number FROM numbers(1000000);

select groupFormat('JSONEachRow')(number) from numbers(2);

EXPLAIN indexes = 1
SELECT arraySort(groupArray(x))
FROM t_modulo_legacy_primary_key
WHERE x % 16 = 3;

DROP TABLE join_inner_table__fuzz_146_replicated;

SET query_plan_remove_unused_columns=0;

-- Check result when exact values limit is exceeded
SET join_runtime_filter_exact_values_limit = 5;

-- 0: different value
SELECT CAST(1, 'Bool') IN (10);

-- 0: not representable (UInt16)
SELECT CAST(0, 'Nullable(Bool)') IN (toNullable(0));

-- 0: 256 not representable (UInt16)

-- Nested Tuple with Bool with IN operator
SELECT CAST((1, (0, 1)), 'Tuple(Bool, Tuple(Bool, Bool))') IN ((1, (0, 1)));

-- 1: 1.0 matches true
SELECT CAST(1, 'Bool') IN (10.5);

-- 1: neither matches false (UInt16)

-- Bool-to-Bool RHS (already clamped)
SELECT CAST(1, 'Bool') IN (CAST(10, 'Bool'));

EXPLAIN indexes = 1
SELECT count()
FROM test_deterministic_injective_function_chain
WHERE p IN ('abc', 'x9999');

SELECT count()
FROM test_deterministic_injective_function_dag_complex
WHERE lower(p) = 'abc';

CREATE TABLE test (ts Date, a String, b String, c String, d String) ENGINE= MergeTree() ORDER BY a;

-- https://github.com/ClickHouse/ClickHouse/issues/92982
-- NOT_FOUND_COLUMN_IN_BLOCK exception for valid queries with constant columns
-- and DISTINCT, ORDER BY, LIMIT BY combinations.
--
-- Root cause: ActionsChainStep::finalizeInputAndOutputColumns kept COLUMN nodes
-- (constants) in DAG outputs instead of INPUT nodes, causing removeUnusedActions
-- to garbage-collect the INPUT and break column propagation across chain steps.

-- Original reproducer
SELECT DISTINCT 1, '1' ORDER BY 1 LIMIT 1 BY 2;

DROP TABLE IF EXISTS test_nan_ne_float;

CREATE MATERIALIZED VIEW mv
TO dst
AS
SELECT
    data_joined.id AS id
FROM
(
    SELECT arrayJoin(data) as data_joined
    FROM src
)
WHERE data_joined.id != 42;

SELECT 'timeSeriesReplaceTag (2):';

SELECT ((SELECT [1,2,3]) AS a1), [5] IN ((SELECT [1,2,3]) AS a1);

-- Red-ish (positive a, neutral b)
WITH colorOKLABToSRGB((0.628, 0.2246, 0.1258)) as t
SELECT tuple(round(t.1, 6), round(t.2, 6), round(t.3, 6));

WITH colorSRGBToOKLAB((0, 0, 255)) AS lab,
     colorOKLABToSRGB(lab) AS rgb_back
SELECT tuple(round(rgb_back.1, 2), round(rgb_back.2, 2), round(rgb_back.3, 2));

-- Very dark color (almost black)
WITH colorSRGBToOKLAB((1, 1, 1)) as t
SELECT tuple(round(t.1, 6), round(t.2, 6), round(t.3, 6));

-- Gray should have a and b near 0 (achromatic)
WITH colorSRGBToOKLAB((128, 128, 128)) as t
SELECT abs(t.2) < 0.001 AND abs(t.3) < 0.001;

SELECT toTypeName(toString(v)) FROM vf_one_variant_no_nulls LIMIT 1;

SELECT toTypeName(arrayElement(v, 1)) FROM vf_array_multi_variant LIMIT 1;

CREATE TABLE vf_two_variants_multiple (v1 Variant(UInt64, Decimal64(3)), v2 Variant(UInt64, Float64)) ENGINE = Memory;

-- Tests how squashing combines blocks from INSERT...SELECT based on min/max thresholds
-- Test cases for insert select 100 numbers:
--    1. max_insert_block_size_rows=23 
--    2. max_insert_block_size_bytes=164 
--    3. Data integrity verification

DROP TABLE IF EXISTS test_max_insert_rows_squashing;

SET min_insert_block_size_rows = 33;

SELECT count()
FROM customer RIGHT SEMI JOIN nation
ON c_nationkey = n_nationkey AND n_name = 'FRANCE' AND c_custkey = 1;

DROP TABLE IF EXISTS test_variant_incompatible;

WITH
    (SELECT cramersV(toUInt8(number % 10), toUInt8(number % 6)) FROM numbers(10_000)) AS direct_raw,
    (
        SELECT cramersVMerge(st)
        FROM
        (
            SELECT
                g,
                st_win AS st
            FROM
            (
                SELECT
                    number,
                    number % 1000 AS g,
                    cramersVState(toUInt8(number % 10), toUInt8(number % 6))
                        OVER (
                            PARTITION BY (number % 1000)
                            ORDER BY number
                            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                        ) AS st_win
                FROM numbers(10_000)
            )
            ORDER BY g, number
            LIMIT 1 BY g
        )
    ) AS merged_raw
SELECT
    round(direct_raw, 4) AS direct,
    round(merged_raw, 4) AS merged,
    abs(direct_raw - merged_raw) < 1e-9;

SELECT 'theilsU: window state -> normal deserialize (serialization compat)';

SELECT 1 IN arrayMap(x -> x, [1, 2, 3]);

SELECT number, number IN arrayMap(x -> x + 1, arrayFilter(y -> y < number, [0, 1, 2, 3, 4])) FROM numbers(5);

SELECT 1500 IN range(1000);

-- NOT IN with transform_null_in = 1 is not yet fully supported for array-returning functions
-- SELECT 1 NOT IN arrayMap(x -> x, [1, NULL, 3]) SETTINGS transform_null_in = 1;
-- SELECT toNullable(1) NOT IN arrayMap(x -> x, [2, 3, 4]) SETTINGS transform_null_in = 1;
-- SELECT toNullable(1) NOT IN arrayMap(x -> x, [1, 2, 3]) SETTINGS transform_null_in = 1;

-- NOT IN with column references
SELECT number, number NOT IN arrayMap(x -> x + 1, [0, 1, 2]) FROM numbers(5);

SELECT number, number IN arrayMap(x -> if(x > 1, x, 0), [0, 1, 2, 3]) FROM numbers(4);

SELECT log_comment query, ProfileEvents['RuntimeDataflowStatisticsInputBytes'] > 0 stats_collected, ProfileEvents['ParallelReplicasUsedCount'] > 0 pr_used
FROM system.query_log
WHERE (event_date >= yesterday()) AND (event_time >= (NOW() - toIntervalMinute(15))) AND (current_database = currentDatabase()) AND (log_comment LIKE '03783_autopr_dataflow_cache_reuse_query_%') AND (type = 'QueryFinish')
ORDER BY log_comment
FORMAT TSVWithNames;

select trimRight('', '01234567890123456');

INSERT INTO test SELECT number * 3 + 1, rand() FROM numbers(100000);

SELECT dictGet('inverse_dict_lookup_remote_shards_composite_key', 'f', tuple(toInt64(dummy), toUInt32(dummy))) = 12 AS limit_and_equals
FROM remote('localhost,localhost', system.one)
LIMIT 1;

-- This test validates Statistics-based part pruning functionality.
SET min_marks_per_part_to_load_statistics = 0;

SELECT explain FROM (EXPLAIN indexes = 1 SELECT count() FROM test_stats_pruning FINAL WHERE value = 1050 SETTINGS enable_parallel_replicas = 0);

-- Part 2 (OLD): id [100, 199], value [1000, 1099] - Partition 1
INSERT INTO test_stats_pruning_partial SELECT number + 100, number + 1000 FROM numbers(100);

SELECT count() FROM test_stats_exceeds WHERE dt = '2025-01-02' AND val_int64 = 9007199254740999;

SELECT '-- Case 6.3: Decimal32(9) query at max, should NOT prune';

-- `nullable_serialization_version` is pinned because with sparse serialization
-- `count() ... WHERE col IS NULL` is answered without reading the part, and EXPLAIN then has no
-- index sections at all.
CREATE TABLE t_stats_stale_null_count (bucket UInt8, value Nullable(Int64))
ENGINE = MergeTree
PARTITION BY bucket
ORDER BY tuple()
SETTINGS auto_statistics_types = 'minmax', nullable_serialization_version = 'basic';

-- Ensure plan stabiliity with parallel replicas
SET parallel_replicas_local_plan = 1;

INSERT INTO t VALUES
    ('2020-01-10 00:00:00'),
    ('2020-01-2 00:00:00');

SET optimize_functions_to_subcolumns=1;

SET async_insert_deduplicate = 0;

SELECT s.null, s.size from t0;

-- Additional test cases
SELECT sum(y) FROM (SELECT * FROM remote('127.0.0.1', currentDatabase(), tab0)) WHERE x GLOBAL IN (SELECT toNullable(number) FROM numbers(5));

INSERT INTO test_set_index_multiple_conditions VALUES (2, {'c': '3', 'd': '4'});

-- Constant floats: 0.1 is not exactly representable, but all elements are bitwise identical
SELECT arrayAutocorrelation([0.1, 0.1, 0.1]);

SELECT arrayAutocorrelation(CAST([1, 2, 3], 'Array(Decimal128(6))'));

-- LowCardinality non-const lag
SELECT arrayAutocorrelation([1, 2, 3], CAST(number, 'LowCardinality(UInt64)')) FROM numbers(3);

SELECT '-- Time64 type basic test (scale 3)';

SELECT avg(dt) FROM (SELECT toDateTime('2020-01-01 00:00:00', 'UTC') AS dt UNION ALL SELECT toDateTime('2020-01-01 00:00:01', 'UTC') AS dt);

SELECT avg(dt) FROM (SELECT toDateTime('1970-01-01 00:00:00', 'UTC') AS dt UNION ALL SELECT toDateTime('2100-01-01 00:00:00', 'UTC') AS dt);

SELECT avg(t) FROM (
    SELECT CAST(number AS Time) AS t FROM numbers(10)
);

SELECT '-- Precision edge cases';

DROP VIEW mv_view;

EXPLAIN indexes = 1
SELECT count()
FROM view_assume
WHERE ts >= toDateTime64('2025-01-01 00:00:00', 3);

EXPLAIN indexes = 1
SELECT count()
FROM test_null
WHERE coalesce(ts, toDateTime64('1970-01-01 00:00:00', 3)) <= toDateTime64('2025-01-01 00:00:00', 3);

SELECT sum(length(URL)) FROM test.hits WHERE CounterID IN (SELECT a % 100000 FROM t) OR UserID IN (SELECT a % 1000000 FROM t) FORMAT Null;

EXPLAIN SYNTAX SELECT true OR false;

EXPLAIN SYNTAX SELECT [1, 2, 3][1];

-- Extended Out of Bounds
WITH toDateTime64(7999999999.9761238, 3, 'UTC' ) as dt
SELECT
        toStartOfInterval(dt, INTERVAL 1 second) as a,
        toStartOfSecond(dt) as b;

-- DateTime
WITH toDateTime(23119945, 3, 'UTC' ) as dt
SELECT
        toStartOfInterval(dt, INTERVAL 1 month) as a,
        toStartOfMonth(dt) as b;

-- -- CURRENT_DATABASE
SELECT toTypeName(CURRENT_DATABASE);

-- Test insert select path
CREATE TABLE t_niladic_insert (ts DateTime) ENGINE = Memory;

-- Test INNER JOIN
SELECT 'INNER JOIN';

SELECT domainRFC('/');

SELECT domainRFC('http://[v');

EXPLAIN
WITH
    cte AS MATERIALIZED (
        SELECT 10 AS n
        UNION ALL
        SELECT number as n FROM numbers(5)
    )
SELECT count() FROM cte, cte;

-- Insert data for different key
INSERT INTO test_nested_tuple_agg
SELECT
    2 AS id,
    tuple(
        tuple(
            1000,
            tuple(
                500,
                tuple(
                    100,
                    uniqState('alpha'),
                    tuple(
                        'alpha_last',
                        countState()
                    )
                )
            )
        ),
        tuple(
            8,
            avgState(5.5)
        )
    ) AS nested_metrics;

OPTIMIZE TABLE test_nested_tuple_before_sort_key FINAL;

SELECT
    id,
    agg_tuple.sum_val,
    agg_tuple.min_val,
    agg_tuple.max_val,
    agg_tuple.any_val,
    agg_tuple.any_last_val,
    agg_tuple.nullable_str,
    agg_tuple.nullable_str_respect_nulls,
    agg_tuple.low_str,
    agg_tuple.ip_addr,
    agg_tuple.status,
    agg_tuple.bit_and,
    agg_tuple.bit_xor,
    agg_tuple.arr,
    arraySort(agg_tuple.uniq_arr) AS uniq_arr
FROM test_comprehensive_simple ORDER BY id;

DROP TABLE test_unnamed_tuple_agg;

DROP TABLE test_coalescing_basic;

SELECT 'Nested Tuple partition key - with FINAL:';

SELECT CAST(2.0 AS Enum16('a' = 1, 'b' = 2));

SELECT count()
FROM t0 LEFT JOIN t1 ON t1.EventId = t0.Id;

-- Test 1: SummingMergeTree - Basic Tuple with named fields
SELECT '=== Test 1: SummingMergeTree Basic Tuple ===';

SELECT id, data FROM test_summing_nested_tuple FINAL ORDER BY id;

-- Test 6: SummingMergeTree - Tuple with Nullable and LowCardinality
SELECT '=== Test 6: SummingMergeTree Complex Types ===';

SELECT 'Zero row - with FINAL:';

CREATE TABLE test_summing_explicit_col_nested (
    key UInt32,
    data Tuple(
        x UInt64,
        inner Tuple(
            y UInt64,
            z UInt64
        )
    ),
    other_tuple Tuple(m UInt64, n UInt64),
    plain_val UInt64
) ENGINE = SummingMergeTree(data) ORDER BY key
SETTINGS allow_tuple_element_aggregation = 1;

OPTIMIZE TABLE test_summing_tuple_sub_col_keys FINAL;

SELECT tuple(1, 0) = '(1, NULL)' SETTINGS input_format_null_as_default=1;

SELECT date_trunc('year', toDate32('1970-01-01'));

SELECT toTypeName(date_trunc('week', toDate32('1911-01-01')));

-- Verify return types are handled correctly
SELECT toTypeName(arrayFilter(x -> (x = 1), [1, 2, 3]));

SELECT formatQuerySingleLine(formatQuerySingleLine('CREATE TABLE t (c0 Date) ENGINE = MergeTree ORDER BY () TTL (c0 AS a) SETTINGS index_granularity = 8192'));

-- Test descending order
SELECT a, b FROM t_virtual_row_sparse_pk ORDER BY (a, b) DESC LIMIT 5 SETTINGS read_in_order_use_virtual_row = 1;

SELECT 'OrNull: window states merged in aggregate() (non-window consumes window states)';

SELECT tuple(t1.a, t0.a, a), 2 a FROM t0 JOIN t1 USING (a);

SELECT sum(b), count(b), sum(a), count(a) FROM (SELECT a, b FROM test);

SELECT * FROM (SELECT 1, 2) AS t(a, b) JOIN (SELECT 1, 3) AS u(c, d) ON a = c;

CREATE TABLE test_03814_optimize (id UInt64, ts DateTime, v UInt64, PROJECTION p (SELECT * ORDER BY ts))
ENGINE = MergeTree() PARTITION BY toYYYYMM(ts) ORDER BY (id, toStartOfHour(ts));

SYSTEM RELOAD DICTIONARY test_unload_dict;

select arrayJoin(['{"a" : 42}', '{"a" : {"b" : 42}}'])::JSON as json, dynamicType(tupleElement(json, 'a'));

SELECT l.id, l.name, r.val
FROM t_left AS l
LEFT JOIN t_right AS r ON l.id = r.id;

WITH
a AS MATERIALIZED (SELECT uid FROM users)
SELECT count() FROM a WHERE uid in (SELECT uid FROM a);

SELECT number FROM numbers(100) WHERE number % 2 = 0 AND number < 100 LIMIT 10;

SELECT * FROM primes(10, 3, 3) WHERE prime > 80 and prime < 2000;

SELECT arraySort(groupArray(number))
FROM system.numbers_mt
WHERE number % 3 = 1 AND number >= 5 AND number < 30;

SELECT count(), min(prime), max(prime), sum(prime)
FROM system.primes
WHERE prime % 2 = 1
  AND ((prime BETWEEN 2 AND 50) OR (prime BETWEEN 40 AND 60));

EXPLAIN indexes = 1 SELECT * FROM test_alias_skip_idx WHERE a > 100
SETTINGS query_plan_enable_optimizations = 0;

-- Test that largestTriangleThreeBuckets works correctly with Date32 values before Unix epoch
SELECT largestTriangleThreeBuckets(1)(0, '1900-01-01'::Date32);

SELECT
    id,
    dictGet('mixed_test_range_hashed', 'name', id, dt) AS name,
    dictGet('mixed_test_range_hashed', 'metadata', id, dt)['city'] AS map_city,
    dictGet('mixed_test_range_hashed', 'scores', id, dt)['math'] AS map_math,
    dictGet('mixed_test_range_hashed', 'profile', id, dt).city AS json_city,
    dictGet('mixed_test_range_hashed', 'settings', id, dt).theme AS json_theme,
    dictGetOrDefault(
        'mixed_test_range_hashed',
        'metadata',
        999,
        dt,
        map('city', 'Unknown', 'age', '0')
    )['city'] AS missing_map_city,
    dictGetOrDefault(
        'mixed_test_range_hashed',
        'metadata',
        999,
        dt,
        map('city', 'Unknown', 'age', '0')
    )['age'] AS missing_map_age,
    dictGetOrDefault(
        'mixed_test_range_hashed',
        'profile',
        999,
        dt,
        '{"city":"Unknown","age":0}'::JSON
    ).city AS missing_json_city,
    dictGetOrDefault(
        'mixed_test_range_hashed',
        'profile',
        999,
        dt,
        '{"city":"Unknown","age":0}'::JSON
    ).age AS missing_json_age
FROM
(
    SELECT 1 AS id, toDate('2024-01-15') AS dt
    UNION ALL SELECT 2, toDate('2024-02-15')
    UNION ALL SELECT 3, toDate('2024-03-15')
)
ORDER BY id;

-- Section I. JSON type introspection (`dynamicType`, `toTypeName`)
SELECT '=== JSON type introspection (dynamicType + toTypeName) ===' as test;

-- P5. Test deep nested JSON access
SELECT '=== Testing Deep Nested JSON ===' as test;

-- R3. Create one `IP_TRIE` dictionary with both `Map` and `JSON` attributes
CREATE DICTIONARY IF NOT EXISTS ip_trie_test_combined
(
    prefix String,
    name String,
    ip_meta Map(String, String),
    ip_stats Map(String, Float64),
    ip_profile JSON
)
PRIMARY KEY prefix
SOURCE(CLICKHOUSE(
    HOST '127.0.0.1'
    PORT tcpPort()
    USER 'default'
    PASSWORD ''
    DB currentDatabase()
    TABLE 'ip_trie_test_source'
))
LAYOUT(IP_TRIE())
LIFETIME(MIN 0 MAX 0);

-- From PR: https://github.com/ClickHouse/ClickHouse/pull/94288
-- Fix for GitHub issue https://github.com/ClickHouse/ClickHouse/issues/93913:
-- Numbers function can result in infinite loop with large offset and WHERE clause.



-- Basic query without WHERE clause (used to work correctly)
SELECT * FROM numbers(18446744073709551611, 2);

INSERT INTO t_gorilla_mismatched (c0) VALUES (1);

SELECT name, engine FROM system.tables WHERE database = currentDatabase() AND name IN ('al', 'src', 'mv') ORDER BY name;

SELECT 'data before dry run';

SELECT
    query,
    query_kind,
    ProfileEvents['Merge'],
    ProfileEvents['MergedRows'],
    ProfileEvents['MergeSourceParts'],
    ProfileEvents['MergeWrittenRows']
FROM system.query_log
WHERE event_date >= yesterday() AND event_time >= now() - 600 AND current_database = currentDatabase() AND query LIKE 'OPTIMIZE TABLE t_dry_run_cleanup DRY RUN PARTS%' AND type = 'QueryFinish'
ORDER BY event_time_microseconds;

SELECT 'projection parts after dry run';

CREATE TABLE t_dry_run (key UInt64, value String) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_dry_run', '1') ORDER BY key;

-- Tag no-parallel - uses external data source
-- Tag no-fasttest - requires SSL for https
-- Tag no-replicated-database - because of https://github.com/ClickHouse/ClickHouse/issues/97287

-- Verifiy that two tables on separate web disks with table_disk=1 do not collide in mark caches
DROP TABLE IF EXISTS call_center;

SELECT hex(xxh3_128('test'));

-- Again 1 element in filter
SELECT 'Again 1 element in filter';

DROP TABLE IF EXISTS t2_big;

-- 10 000 rows * 10 000 bytes FixedString ≈ 100 MB of column data.
-- With the bug, original_block doubles this to ~200 MB, exceeding the limit.
-- Without the bug, only the data columns are held, fitting within the limit.
SET max_memory_usage = '150M';

-- arrayJoin with product and constant in WHERE
SELECT 1 FROM numbers(1) AS l, numbers(2) AS r WHERE and(arrayJoin([l.number * r.number, 1]), 1, 1);

INSERT INTO Fact_B SELECT number, (number % 10) + 1, number / 100.0 FROM numbers(10000);

SELECT a_name, c_label, count() AS cnt
FROM Dim_A, Fact_B, Dim_C WHERE a_key = b_key AND b_key = c_key
GROUP BY a_name, c_label ORDER BY a_name, c_label LIMIT 5
SETTINGS enable_join_transitive_predicates = 0;

-- ==========================================================================
-- Case 6b: EXPLAIN for two equivalence classes -- each join step should
-- have clauses for both key columns.
-- ==========================================================================

SELECT '-- Case 6b: EXPLAIN two classes';

SELECT a.key, b.key, c.key
FROM e1 AS a, (SELECT key, val FROM e2 WHERE val < 1500) AS b, e3 AS c
WHERE a.key = b.key AND b.key = c.key
ORDER BY a.key
SETTINGS enable_join_transitive_predicates = 0;

SELECT t_str.x, t_str2.x, t_str3.x
FROM t_str, t_str2, t_str3
WHERE t_str.x = t_str2.x AND t_str2.x = t_str3.x
ORDER BY t_str.x;

SELECT '-- Case 14a: plan';

SELECT explain FROM (
    EXPLAIN actions = 1
    SELECT count() FROM lc1, lc2, lc3 WHERE lc1.x = lc2.x AND lc2.x = lc3.x
    SETTINGS query_plan_optimize_join_order_algorithm = 'dpsize',
             query_plan_join_swap_table = 'false',
             use_statistics = 1
) WHERE explain LIKE '%Clauses%';

SELECT t1.key, t2.key, t3.key
FROM t1
FULL JOIN t2 ON t1.key = t2.key
LEFT JOIN t3 ON t1.key = t3.key AND t2.key = t3.key
ORDER BY ALL
SETTINGS enable_join_transitive_predicates = 0;

SET enable_cascades_optimizer = 1;

EXPLAIN
SELECT sum(l_extendedprice * l_discount) AS revenue
FROM lineitem
WHERE l_shipdate >= '1994-01-01' AND l_shipdate < '1995-01-01'
    AND l_discount BETWEEN 0.05 AND 0.07 AND l_quantity < 24;

DROP VIEW IF EXISTS revenue0;

EXPLAIN
SELECT s_name, count() AS numwait
FROM supplier, lineitem l1, orders, nation
WHERE s_suppkey = l1.l_suppkey AND o_orderkey = l1.l_orderkey AND o_orderstatus = 'F'
    AND l1.l_receiptdate > l1.l_commitdate
    AND EXISTS (SELECT * FROM lineitem l2 WHERE l2.l_orderkey = l1.l_orderkey AND l2.l_suppkey <> l1.l_suppkey)
    AND NOT EXISTS (SELECT * FROM lineitem l3 WHERE l3.l_orderkey = l1.l_orderkey
        AND l3.l_suppkey <> l1.l_suppkey AND l3.l_receiptdate > l3.l_commitdate)
    AND s_nationkey = n_nationkey AND n_name = 'SAUDI ARABIA'
GROUP BY s_name ORDER BY numwait DESC, s_name LIMIT 100;

-- This query join order depends on whether statts for product_id (NDV=10K) and region_id (NDV=5) are properly propagated from subquery
SELECT explain FROM
(
EXPLAIN keep_logical_steps=1, actions=1
SELECT sq.region_id, rs.subsidy_type, sq.product_id, sq.total_amount, pc.catalog_info
FROM (
    SELECT s.region_id, s.product_id, sum(s.amount) AS total_amount
    FROM test_sales s
    JOIN test_partners p ON s.product_id = p.product_id
    GROUP BY s.region_id, s.product_id
) sq
JOIN test_region_subsidies rs ON sq.region_id = rs.region_id
JOIN test_product_catalog pc ON sq.product_id = pc.product_id
)
WHERE explain LIKE '% Join%' OR explain LIKE '% ResultRows:%' OR explain LIKE '% ReadFromMergeTree%' OR explain LIKE '% Aggregating%';

SELECT count() >= 0 FROM t_pip_variant WHERE pointInPolygon((x, y), if(0, NULL, [(0., 0.), (8., 4.), (5., 8.)]));

SELECT toFixedString('John', 8) AS s FORMAT Markdown;

SELECT toTime64(reinterpret(toDateTime64('1945-09-16 00:59:59.999', 3, 'UTC'), 'DateTime64(3, \'Europe/Paris\')'), 0);

SELECT replaceRegexpAll(materialize(''), ' ', '_');

SELECT toInt64(10) - toInt8(5);

EXPLAIN SELECT number FROM numbers_mt(1000) GROUP BY number FORMAT Null;

SELECT count()
FROM test
WHERE has([toDateTime('2026-01-10 00:00:00')], dt);

-- Case 2: Three renames (c0 -> c1 -> c2 -> c3)
DROP TABLE IF EXISTS test_chained_rename_2;

ALTER TABLE test_chained_rename_4 DETACH PARTITION tuple();

DROP TABLE t_skip_index_null;

SELECT uid IN (1, 3)
FROM remote('127.0.0.1', currentDatabase(), t_dist_in_select)
ORDER BY uid;

-- CounterID in [20000; 25000)
INSERT INTO t SELECT number%5000+20000, number % 1000, number % 10 FROM numbers_mt(5000);

DROP TABLE t_encrypted_s3_cache_smoke;

-- Prefix-preserving encrypt/decrypt round-trip with IPv6 (class-preserving: IPv6 -> IPv6)
SELECT 'prefix_roundtrip_ipv6';

SELECT toTypeName(ipcryptDecrypt('::1', unhex('00112233445566778899aabbccddeeff')));

INSERT INTO test
SELECT if(number % 10 = 0, toFloat64('nan'), toFloat64(number)), number
FROM numbers(1000);

SELECT 'after third insert, some statistics are partially materialized';

SELECT r.*
FROM (SELECT CAST(tuple(1), 'Tuple(b UInt8)') AS r) AS l
LEFT JOIN (SELECT 2 AS b) AS r ON true
SETTINGS analyzer_compatibility_prefer_alias_over_subcolumn = 0;

DROP TABLE semi_anti_prewhere_left;

DROP TABLE {CLICKHOUSE_DATABASE:Identifier}.{CLICKHOUSE_DATABASE:Identifier};

-- Every `USING` key of a multi-column clause is kept on the preserved side.
SELECT * FROM (SELECT toUInt8(1) AS a, toUInt8(2) AS b) AS l LEFT SEMI JOIN (SELECT toUInt16(1) AS a, toInt64(2) AS b) AS r USING (a, b) FORMAT TSVWithNamesAndTypes;

INSERT INTO tab VALUES
    (1, 'foo', ' bar', 'Hello World and more', {'Alpha': '1', 'Beta': '2'});

SELECT count() FROM tab WHERE hasAllTokens(toValidUTF8(s3), 'FOO');

SELECT toTypeName(getSubcolumn(v, 'Tuple(UInt64, String)')), getSubcolumn(v, 'Tuple(UInt64, String)') FROM test_variant ORDER BY getSubcolumn(v, 'Tuple(UInt64, String)');

SELECT hasAllTokens('abcdef', ['ab', 'cd', 'ef'], 'ngrams(2)');

SELECT hasAnyTokens(materialize('hello world'), ['missing', 'world'], 'splitByNonAlpha');

-- with materialize
SELECT hasAllTokens(materialize('abcdef'), 'abcdef', 'sparseGrams');

SELECT hasAnyTokens('foo bar baz', ['foo', 'foo', 'foo', 'bar', 'bar', 'bar']);

CREATE TABLE json_float (data JSON) ENGINE = Memory;

DROP TABLE IF EXISTS json_raw;

SELECT name, column, type, statistics, estimates.cardinality, estimates.min, estimates.max
FROM system.parts_columns
WHERE database = currentDatabase() AND table = 'test_auto_stats_replacing' AND active
ORDER BY name, column;

SET max_bytes_before_external_join = 1000000000;

SELECT count(), sum(t2.v)
FROM (SELECT number AS k FROM numbers(100)) AS t1
INNER JOIN (SELECT number AS k, number * 10 AS v FROM numbers(100)) AS t2
ON t1.k = t2.k
SETTINGS log_comment = 'query_03915_11';

SELECT toTypeName(variantElement(v, 'Tuple(UInt64, String)')), variantElement(v, 'Tuple(UInt64, String)')
FROM (SELECT CAST(tuple(toUInt64(1), 'x'), 'Variant(Tuple(UInt64, String), UInt64)') AS v);

SELECT '-- EXCEPT DISTINCT still works (removes all matching)';

-- Regression tests for type-compatibility guard. has() on a constant array compares raw
-- Field values, while in() converts the right-hand side to the left-hand side type. For
-- types whose Field representation has different semantic meaning (Date vs DateTime,
-- Enum vs String, IPv4 vs UInt32), the two diverge — the rewrite must not happen.

-- Date vs DateTime: has() returns 0 (the pair meets as DateTime, where the needle is midnight
-- and the element is 12:34:56), in() would return 1 (DateTime is converted to Date, which drops
-- the time of day). Verify has() result is preserved and that FUNCTION in() does not appear in
-- the plan.
SELECT has([toDateTime('2026-01-10 12:34:56')], toDate('2026-01-10'));

-- ifNull where the alternative type is already present in the Variant
SELECT toTypeName(ifNull(if(0, '1', 1), 'hello')) SETTINGS use_variant_as_common_type = 1;

-- Every condition is a comparison of two stored columns: compilable, but with no compilable
-- child, and a node with no compilable children is never compiled on its own. The branches
-- are constants or plain columns, so the outer if/multiIf is the only node that can raise
-- CompiledFunctionExecute in any of the four queries below.
DROP TABLE IF EXISTS t_cond;

CREATE TABLE t_union_lm_1 (a UInt64, b UInt64, c String, d String)
ENGINE = MergeTree ORDER BY (a, b);

-- Filtering by name with LIKE
SELECT count() > 0 FROM system.fail_points WHERE name LIKE '%smt_%';

INSERT INTO test
SELECT NULL
FROM numbers(4);

-- The setting `allow_nullable_tuple_in_extracted_subcolumns` can only be changed via server restart

SET allow_nullable_tuple_in_extracted_subcolumns = 1;

-- (7) Subquery (control: avoids buggy plan shape).
SELECT 'control_subquery_new=1', count() FROM (
    SELECT id, arrayJoin(tag_ids) AS tag_id
    FROM items_arrjoin WHERE filter_key = 'target') AS sub
INNER JOIN tags_arrjoin ON sub.tag_id = tags_arrjoin.id
SETTINGS query_plan_use_new_logical_join_step = 1;

-- (5) Plan assertions. Query (1) projects only columns the rewritten plan
--     still exposes (`id` is forwarded unchanged next to the computed
--     `arrayJoin(tags)` key), so the conversion must apply: no `Join` step,
--     a `CreatingSets` step instead.
SET explain_query_plan_default = 'legacy';

REPLACE TABLE target CLONE AS source ENGINE = MergeTree ORDER BY x;

alter table t_stat_nullable_1 attach partition tuple();

-- Merge tree setting 'index_granularity' is unconditionally read-only (changing it would mean rewriting all parts).
-- There was a bug that the system table wouldn't show it as read-only.
SELECT name, readonly FROM system.merge_tree_settings WHERE name = 'index_granularity';

SELECT * FROM tab_const ORDER BY v1 LIMIT 2 SETTINGS max_threads = 1, max_block_size = 100;

-- But changing settings should still work (so we can toggle readonly back).
ALTER TABLE t_readonly MODIFY SETTING table_readonly = 0;

-- Simpler cases for tuple comparison with Nothing type
SELECT (1, 2) = (NULL, 2);

-- Test for swapping the build and probe sides of a SEMI join
SET explain_query_plan_default = 'legacy';

SELECT URL FROM test.hits WHERE WatchID < 6509275139329711000 FORMAT Null SETTINGS log_comment='03927_autopr_input_bytes_estimation_prewhere_filter_2';

INSERT INTO t0 VALUES ('hello');

CREATE TABLE t_row_policy_rio
(
    key1 UInt64,
    key2 UInt64
)
ENGINE = MergeTree
ORDER BY (key1, key2);

-- Compatibility coverage check for tuple-returning aggregate functions with Nullable arguments.
-- sumCount is covered separately in 03927_sumcount_compatibility.
-- Make sure serialized states of these functions can be deserialized.

-- simpleLinearRegression non-empty state.
SELECT finalizeAggregation(CAST(unhex('01040000000000000000000000000028400000000000003C4000000000000047400000000000005A40'), 'AggregateFunction(simpleLinearRegression, Nullable(Float64), Nullable(Float64))'));

-- sumMap(old tuple signature) empty legacy state (non-nullable signature).
SELECT finalizeAggregation(CAST(unhex('00'), 'AggregateFunction(sumMap, Tuple(Array(UInt8), Array(UInt64)))'));

-- meanZTest: legacy type was Tuple(z_statistic Float64, p_value Float64, confidence_interval_low Float64, confidence_interval_high Float64).
SELECT toTypeName(meanZTest(1., 1., 0.95)(v, g))
FROM values('v Nullable(Float64), g Nullable(UInt8)', (1, 0), (3, 0), (5, 0), (2, 1), (10, 1), (NULL, 1));

SELECT '= both deferred =';

CREATE TABLE t0 (c0 Nullable(Tuple(c1 Nullable(Int32)))) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE IF EXISTS mytable__fuzz_45;

INSERT INTO t_fill_collation SELECT if(number % 2 = 0, 'a', 'A'), number + 1 FROM numbers(40000);

CREATE TABLE R3 (
    C_ID UInt32,
    R1_A_ID UInt32,
    R4_D_ID UInt32,
    C_Value Int32
) ENGINE = MergeTree()
PRIMARY KEY (C_ID)
SETTINGS auto_statistics_types = 'uniq';

DROP TABLE br_l2;

CREATE TABLE ch10_t10 (id UInt32, prev_id UInt32, val UInt32) ENGINE = MergeTree() PRIMARY KEY id SETTINGS auto_statistics_types = 'uniq';

CREATE TABLE cl_d (id UInt32) ENGINE = MergeTree() PRIMARY KEY id SETTINGS auto_statistics_types = 'uniq';

-- =====================================================================
-- Regression test for complement enumeration.
-- With CSG={A}, neighbourhood={B,D}. A buggy exclusion would prevent
-- discovering the complement {B,C,D}, so DPhyp would fail to build a plan
-- over all four relations. The EXPLAINs below confirm both algorithms
-- produce a complete 4-table plan that joins the B-C-D chain before the
-- single-row A. The B-C-D orderings have equal estimated cost, so DPhyp
-- and DPsize may pick different ones; each plan is recorded separately.
-- =====================================================================

CREATE TABLE cyc_a (id UInt32, d_id UInt32) ENGINE = MergeTree() PRIMARY KEY id SETTINGS auto_statistics_types = 'uniq';

DROP TABLE fb_b;

EXPLAIN
SELECT t1.id, t5.id
FROM he_t1 t1, he_t2 t2, he_t3 t3, he_t4 t4, he_t5 t5
WHERE t1.id = t2.t1_id
  AND t2.id = t3.t2_id
  AND t4.id = t5.t4_id
  AND t1.a + t2.b + t3.c = t4.d + t5.e
SETTINGS query_plan_optimize_join_order_algorithm = 'dphyp', enable_parallel_replicas = 0;

-- A single-table predicate merged into a join condition by
-- query_plan_merge_filter_into_join_condition is unsupported by DPhyp: it returns
-- nullptr so the next algorithm in the chain handles the query and keeps the predicate.

SET use_statistics = 1;

CREATE TABLE ns_t1 (id UInt32, val Nullable(UInt32)) ENGINE = MergeTree() PRIMARY KEY id SETTINGS auto_statistics_types = 'uniq';

INSERT INTO ol_t5  SELECT number, number FROM numbers(5);

CREATE TABLE sb_d (k UInt32) ENGINE = MergeTree() PRIMARY KEY k SETTINGS auto_statistics_types = 'uniq';

SELECT count()
FROM stp_a a, stp_b b, stp_c c
WHERE a.id = b.a_id AND b.id = c.b_id AND a.val >= 50 AND c.val < 15000
SETTINGS query_plan_optimize_join_order_algorithm = 'greedy';

DROP TABLE st5_s4;

SELECT count()
FROM tp_fact f, tp_dim_a a, tp_dim_b b, tp_dim_c c
WHERE f.key = a.key AND f.key = b.key AND f.key = c.key
SETTINGS query_plan_optimize_join_order_algorithm = 'dphyp';

DROP TABLE tree_ra;

DROP TABLE IF EXISTS mv16;

SELECT quantilesExactInclusive(0.5)(x) FROM (SELECT arrayJoin([CAST(-2147483647 AS Int64), CAST(9223372036854775807 AS Int64)]) AS x);

DROP TABLE v0;

-- Runtime: EXECUTE on MergeTree should fail with NOT_IMPLEMENTED
DROP TABLE IF EXISTS test_execute_03978;

SELECT id FROM t_dt64_upper WHERE ts >= '2149-06-07 00:00:00';

SELECT 'date32_pre_epoch';

DROP TABLE t_dt64_explain;

SET allow_experimental_lateral_join = 1;

SELECT '--- INNER JOIN ---';

SELECT count() FROM t_prewarm_idx_cache_1 WHERE b < 10000 AND NOT ignore(*) SETTINGS log_comment = 'after prewarm on restart';

SELECT concatWithSeparator(',', [(number, 2), toLowCardinality(3)], 'x', 'y') FROM numbers(3);

SELECT count(), sum(value) FROM t_lazy_final FINAL WHERE status = 'active' AND id < 100
SETTINGS query_plan_optimize_lazy_final = 0;

SELECT value FROM t_lazy_final_tiebreak FINAL WHERE value != ''
SETTINGS query_plan_optimize_lazy_final = 0;

INSERT INTO t_lazy_final_uint128 VALUES (1, 100, 'second');

CREATE TABLE t_lazy_final_dt64 (key UInt64, version DateTime64(3, 'UTC'), value String)
ENGINE = ReplacingMergeTree(version) ORDER BY key SETTINGS index_granularity = 256;

-- 1
SELECT count() FROM t_map_tokenbf WHERE has(metadata, 'hostname');

SELECT part_type FROM system.parts WHERE database = currentDatabase() AND table = 't' AND active = 1 LIMIT 1;

-- ==========================================
-- Section 5: Bucket count - strategy = 'linear'
-- Formula: max(1, min(max_buckets_in_map, round(map_buckets_coefficient * avg_size)))
-- ==========================================

CREATE TABLE t (id UInt64, m Map(UInt64, UInt64))
ENGINE = MergeTree ORDER BY id
SETTINGS
    map_serialization_version = 'with_buckets',
    map_serialization_version_for_zero_level_parts = 'with_buckets',
    max_buckets_in_map = 8,
    map_buckets_strategy = 'linear',
    map_buckets_coefficient = 1.0,
    map_buckets_min_avg_size = 0,
    index_granularity = 8192,
    min_bytes_for_wide_part = 1,
    min_rows_for_wide_part = 1,
    write_marks_for_substreams_in_compact_parts = 1,
    serialization_info_version = 'with_types';

SELECT '6: sqrt min_avg=4 avg=9 (above threshold), merged bucket_count';

CREATE TABLE t_mutations_analyzer_mem (id UInt64, value String) ENGINE = Memory;

-- Query through view should also work (this was the bug)
SELECT * FROM view_03988 WHERE key = 0 ORDER BY key;

SELECT '-- Optimization with UInt64 key type';

-- Exact reproducer from AST fuzzer CI report
DROP TABLE IF EXISTS table2__fuzz_36;

SELECT * FROM t1 WHERE (a, b) IN (SELECT a, b FROM t2);

DROP DICTIONARY {CLICKHOUSE_DATABASE:Identifier}.regionToShard;

CREATE TABLE rename_swap_compact_unmat (id UInt32, ip UInt32)
ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 1000000000
AS SELECT * FROM values((0, 3628718300), (1, 0));

CREATE TABLE local_03990_src (col String) ENGINE = MergeTree ORDER BY col;

SELECT id FROM t_map_bf_keys WHERE m['K1'] IN ('V1', 'V9') SETTINGS force_data_skipping_indices = 'idx_mk';

SELECT id FROM t_map_text_keys WHERE m['nonexistent'] = 'val0' SETTINGS force_data_skipping_indices = 'idx_tk';

SELECT id FROM t_map_bf_both WHERE m['K0'] = 'V0' SETTINGS force_data_skipping_indices = 'idx_mk';

SELECT part_type FROM system.parts WHERE database = currentDatabase() AND table = 't_json_multi_bucket' AND active = 1 LIMIT 1;

CREATE TABLE t_json_merge_multi (id UInt64, j JSON(max_dynamic_paths = 2))
ENGINE = MergeTree ORDER BY id
SETTINGS
    min_bytes_for_wide_part = 1,
    min_rows_for_wide_part = 1,
    object_serialization_version = 'v3',
    object_shared_data_serialization_version = 'advanced',
    object_shared_data_serialization_version_for_zero_level_parts = 'advanced',
    object_shared_data_buckets_for_wide_part = 4;

select 'memory: m.key_a';

select 'memory tuple: data.m';

insert into t select * from source;

select 'with_buckets compact: m.key_d';

select 'with_buckets compact tuple: data.m.values';

select 'basic wide: m, m.keys, m.values, m.size0, m.key_a max_block_size=3';

select 'basic wide tuple: data.m, data.m.keys';

select m.keys, m from t format Null;

select m_uint[1] from t order by id;

select 'basic Int32 key: m_int[1]';

select `m_ipv4.key_192.168.1.1` from t order by id;

select 'basic LowCardinality(String) key: m_lc.key_bar';

select 'with_buckets IPv4 key: m_ipv4.key_192.168.1.1';

select 'nullable string: m.key_b';

insert into t values
    (1, {1 : 'a', 2 : 'b', 3 : 'c'}),
    (2, {1 : NULL, 2 : 'x'}),
    (3, {}),
    (4, {3 : NULL, 4 : NULL}),
    (5, {1 : '', 2 : 'hello'});

INSERT INTO t_lwd_combined_mutation SELECT number, 0 FROM numbers(100);

-- Merge: with_buckets + basic parts merged together
OPTIMIZE TABLE t FINAL;

-- Merge 8-bucket + 2-bucket parts; merged should use sqrt → 2 buckets
OPTIMIZE TABLE t FINAL;

-- Merge basic zero-level + with_buckets zero-level → merged with_buckets
OPTIMIZE TABLE t FINAL;

-- ==========================================================================
-- Test 5: All rows match — empty result
-- ==========================================================================

SELECT '--- Test 5: All rows match ---';

-- (1,2) matches exactly -> filtered out
-- (NULL,2) from t1: NULL != NULL in equality, so no match -> survives
-- (1,NULL) from t1: NULL in second key, no match -> survives
-- (NULL,NULL) from t1: NULL != NULL, no match -> survives
-- (3,4) from t1: no match in t2 -> survives

SELECT t1.a, t1.b FROM t1 LEFT ANTI JOIN t2 ON t1.a = t2.aa AND t1.b = t2.bb
ORDER BY t1.a NULLS LAST, t1.b NULLS LAST
SETTINGS enable_join_runtime_filters = 0;

INSERT INTO test_75699_a VALUES (0);

SELECT id, m['a'], m['b'], v FROM t_map_prewhere PREWHERE m['a'] > 80 WHERE v < 3 ORDER BY id;

SELECT count() > 0 FROM (
    EXPLAIN actions = 1
    SELECT id, m FROM t_map_prewhere PREWHERE m[1] = '99'
) WHERE explain LIKE '%m.key_1%';

SELECT color_id, payload
FROM t
WHERE dictGetString('colors', 'name', color_id) IN ('red', '')
ORDER BY color_id, payload;

SELECT color_id, payload
FROM t
WHERE dictGetString('colors', 'name', color_id) IN ('red')
ORDER BY color_id, payload;

-- Composite key dictionary tests
DROP DICTIONARY IF EXISTS dict_prices;

SELECT 'notIn with composite key';

EXPLAIN SYNTAX run_query_tree_passes=1
SELECT color_id, payload
FROM t
WHERE dictGet('colors_nullable', 'name', color_id) IN ('red', 'blue')
ORDER BY color_id, payload;

SELECT 'IPv4 IN with default value among others - result';

EXPLAIN SYNTAX run_query_tree_passes=1
SELECT id, payload
FROM t_special
WHERE dictGetDateTime('dict_special', 'dt', id) IN (toDateTime('1970-01-01 00:00:00', 'UTC'))
ORDER BY id, payload;

-- Cleanup special types
DROP DICTIONARY dict_special;

INSERT INTO src_mt VALUES (1, 20);

CREATE TABLE dst_rmt_same (a UInt32, b UInt32) ENGINE = ReplacingMergeTree ORDER BY a;

DROP TABLE src_rmt_same;

INSERT INTO t2 VALUES (1, 10), (2, 20), (3, 30);

INSERT INTO TABLE t0 (c0) VALUES (0), (1);

CREATE TABLE test_simple_key (x Int32)
ENGINE = MergeTree ORDER BY tuple() PARTITION BY x
SETTINGS index_granularity = 1;

SELECT x FROM test_det_function WHERE cityHash64(x) % 5 != 3 ORDER BY x;

SELECT ltrim(explain)
FROM
(
    EXPLAIN actions = 1
    SELECT y FROM test_nullable_order_by ORDER BY x::Nullable(UInt64) LIMIT 1000000000
)
WHERE explain LIKE '%ReadType%';

EXPLAIN indexes = 1
SELECT p FROM test_strings WHERE length(p) != 3 ORDER BY p;

-- A numeric 'id' is accepted even when reading numbers as strings is disabled.
SELECT id
FROM format('GeoJSON', 'id String', '{
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "id": 42, "geometry": null, "properties": {}}
    ]
}')
SETTINGS input_format_json_read_numbers_as_strings = 0;

SELECT trim(explain) FROM (EXPLAIN indexes = 1 SELECT count() FROM t_search_mode WHERE s LIKE '%123%' OR s LIKE '%234%') WHERE explain like '%Condition%';

SELECT k, avgTuple(t) FROM test_tuple_combinator GROUP BY k ORDER BY k;

SELECT quantileExactTuple(0.9)(t) FROM (SELECT tuple(toFloat64(1.0), toFloat64(10.0)) AS t UNION ALL SELECT tuple(toFloat64(2.0), toFloat64(20.0)) UNION ALL SELECT tuple(toFloat64(3.0), toFloat64(30.0)));

-- Single place, no NULLs: numbers 0..3 -> first elements sum to 0+1+2+3 = 6, second to 6.0.
SELECT sumTuple(t) FROM (SELECT CAST(tuple(toInt64(number), toFloat64(number)), 'Nullable(Tuple(Int64, Float64))') AS t FROM numbers(4));

DROP TABLE alter_modify_column_ttl_without_type;

-- INSERT with sync finalization
INSERT INTO test_proj_sync SELECT number + 10000, (number + 10000) * 10, (number + 10000) * 100, (number + 10000) * 1000 FROM numbers(10000)
SETTINGS finalize_projection_parts_synchronously = 1, max_insert_threads = 1;

SELECT count() FROM test_int64 WHERE uid != 100000.5;

INSERT INTO test_uint64 SELECT number FROM numbers(200000);

DROP TABLE IF EXISTS test_int32;

SELECT count() FROM test_uint8 WHERE uid = 300.5 SETTINGS force_primary_key = 1, max_rows_to_read = 1;

SELECT count() FROM test_int64_boundary WHERE uid <= -9223372036854777856.0 SETTINGS force_primary_key = 1, max_rows_to_read = 1;

SELECT count() FROM test_nullable_int64 WHERE uid = 100000.5 SETTINGS force_primary_key = 1, max_rows_to_read = 1;

SELECT count() FROM test_int32_boundary WHERE uid = 2147483648.0 SETTINGS force_primary_key = 1, max_rows_to_read = 1;

SELECT count() FROM test_uint16_boundary WHERE uid <= 65536.0;

CREATE TABLE t_log_alias (c0 Array(String) ALIAS [toString(_table)], c1 Int64) ENGINE = Log;

INSERT INTO t_proj_repl SELECT number + 5000, toString(number + 5000) FROM numbers(5000);

SELECT (SELECT arrayMap(x -> c0 * x, [1, 2])) FROM (SELECT number AS c0 FROM numbers(3)) ORDER BY c0;

-- Test for share_nested_offsets MergeTree setting.
-- Covers: wide/compact parts, merges (horizontal + vertical), missing columns,
-- immutability, ALTER UPDATE/RENAME, flatten_nested interaction, scalar+dotted coexistence.

SET flatten_nested = 0;

CREATE TABLE t_alter
(
    id UInt64,
    `n.a` Array(UInt32)
)
ENGINE = MergeTree ORDER BY id
SETTINGS share_nested_offsets = false, min_bytes_for_wide_part = 0;

INSERT INTO t_update VALUES (1, [1, 2], ['x', 'y', 'z']);

SELECT id, n.a, n.b FROM t_vertical ORDER BY id;

DROP TABLE t_scalar_dotted_multi;

-- ORDER BY ... WITH FILL combined with LIMIT BY used to throw
-- "Filling column ... is not present in the block" because the ActionsChain
-- optimization removed ORDER BY columns from the LIMIT BY expression step.
SELECT 1 ORDER BY toDateTime(0) WITH FILL LIMIT 1 BY 1;

SELECT formatQuery('SELECT (NOT (SELECT 1)) NOT ILIKE \'x\'');

CREATE TABLE t_skip_empty_cols
(
    key UInt64,
    val1 UInt64,
    val2 String,
    val3 Float64
)
ENGINE = MergeTree
ORDER BY key
SETTINGS min_bytes_for_wide_part = 0, min_rows_for_wide_part = 0,
         ratio_of_defaults_for_sparse_serialization = 1.0,
         skip_empty_columns_on_insert = 1,
         serialization_info_version = 'with_missing_columns',
         enable_block_number_column = 0, enable_block_offset_column = 0;

-- b='' (default) → b should be skipped
INSERT INTO t_skip_empty_mutate (key, a, b) VALUES (1, 100, '');

-- Explicitly insert b=0 (type-default). b must NOT be skipped because it has
-- a DEFAULT expression — otherwise read would return a+1=6 instead of 0.
INSERT INTO t_skip_empty_default_expr (key, a, b) VALUES (1, 5, 0);

-- Merge compact parts
INSERT INTO t_skip_empty_compact (key, a, b, c) VALUES (2, 0, 'hello', 3.14);

-- Change the DEFAULT expression for b. The missing column must still read as 0.
ALTER TABLE t_skip_empty_alter_default MODIFY COLUMN b UInt64 DEFAULT 999;

SELECT tenant, key, event.event_id::UInt64, profile.name::String, metrics.cpu::UInt64
FROM t_skip_empty_partitioned_json
ORDER BY tenant, key;

SELECT count()
FROM (SELECT * FROM t1) AS t1s,
     (SELECT * FROM t2 ORDER BY c ASC LIMIT 500000) AS t2s
WHERE t1s.c = t2s.c
SETTINGS
    max_rows_in_set_to_optimize_join = 100000000,
    join_algorithm = 'full_sorting_merge',
    query_plan_join_swap_table = 0,
    max_threads = 2;

SELECT column FROM system.parts_columns
WHERE database = currentDatabase() AND table = 't_skip_empty_merge_default' AND active
ORDER BY column;

SELECT 'case21_columns_in_part';

SELECT 'case29_pre_delete';

-- ============================================================================
-- CASE 42: Type-changing ALTER MODIFY COLUMN converts the stored value.
-- A missing-column marker represents the explicitly inserted UInt64 value 0.
-- Changing the type to Nullable(UInt64) must therefore produce Nullable(0),
-- not the new type-default NULL.
-- ============================================================================
DROP TABLE IF EXISTS t_skip_empty_case42;

-- Change DEFAULT again. Since b is physical data, value stays 0.
ALTER TABLE t_skip_empty_case44 MODIFY COLUMN b UInt64 DEFAULT 777;

SELECT 'case55_pending';

SELECT 'case23_pre_detach';

INSERT INTO t_skip_empty_case26 (key, a, b) VALUES (1, 100, 0);

DROP TABLE t_skip_empty_case32_dst;

-- ============================================================================
-- CASE 36: Projections with missing columns.
-- ============================================================================
DROP TABLE IF EXISTS t_skip_empty_case36;

-- Part 2: b=100 (NOT skipped)
INSERT INTO t_skip_empty_case39 (key, a, b) VALUES (2, 20, 100);

INSERT INTO t_skip_empty_case48 (key, b) VALUES (1, 0);

ALTER TABLE t_skip_empty_case51 MODIFY COLUMN b UInt64 DEFAULT 999;

-- ============================================================================
-- CASE 54: Existing markers survive a downgraded full-rewrite mutation.
-- ============================================================================
DROP TABLE IF EXISTS t_skip_empty_case54;

CREATE TABLE t_nested_null_sub_tiny (c0 Nested(c1 LowCardinality(IPv4), c2 Nullable(Tuple())), c3 DateTime64(4) NULL) ENGINE = TinyLog;

SET param_table='';

CREATE DICTIONARY d1 (c1 Int DEFAULT 1) PRIMARY KEY (c1) SOURCE(NULL()) LAYOUT(HASHED()) LIFETIME(1);

DROP TABLE IF EXISTS t_compact_flush_false;

DROP TABLE t_compact_flush_false;

SELECT '--- Join output with left and right columns ---';

DROP TABLE IF EXISTS test_nullable_empty_tuple;

SELECT 'Native';

SELECT 'Buffers';

-- Table: EMPTY without COMMENT
SELECT formatQuery('CREATE TABLE t (c Int8) ENGINE = MergeTree ORDER BY c EMPTY AS SELECT 1');

-- ASCII-only (no-op for accent fold)
SELECT '-- ASCII only';

CREATE TABLE test_fold_text_index
(
    id UInt64,
    val String,
    INDEX idx_case(val) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = caseFoldUTF8(val))
)
ENGINE = MergeTree
ORDER BY id;

DROP TABLE IF EXISTS json_merge_m;

DROP TABLE json_typed_m;

-- Test: common SKIP REGEXP strings are kept, uncommon are removed.
DROP TABLE IF EXISTS json_regexp_t1;

-- 1a: Dynamic subcolumn equals — path a.b only in part 1, granule 1
SELECT 'bloom_filter equals';

SELECT trimLeft(explain)
FROM (EXPLAIN indexes = 1 SELECT * FROM t_json_bf WHERE json.a.b.:Int64 IS NOT NULL)
WHERE explain LIKE '%Parts:%' OR explain LIKE '%Granules:%' OR explain LIKE '%Skip%';

-- 5b: Array subcolumn = [1,2,3] — safe
SELECT 'Array subcolumn non-empty safe';

DROP TABLE t_json_dotted;

SELECT id FROM t_json_results WHERE json.a.b.:Int64 = 1 ORDER BY id;

-- IS NOT NULL correctness
SELECT 'result: IS NOT NULL';

SELECT trimLeft(explain)
FROM (EXPLAIN indexes = 1 SELECT * FROM t_json_large_bf WHERE json.a.b = 1 OR json.x.y = 10)
WHERE explain LIKE '%Parts:%' OR explain LIKE '%Granules:%' OR explain LIKE '%Skip%';

-- 3d: IS NOT NULL
SELECT 'text large: IS NOT NULL';

DROP TABLE t_json_large_res;

SELECT trimLeft(explain)
FROM (EXPLAIN indexes = 1 SELECT * FROM t_json_text WHERE json.a.b.:Int64 IS NOT NULL)
WHERE explain LIKE '%Parts:%' OR explain LIKE '%Granules:%' OR explain LIKE '%Skip%';

CREATE TABLE t_json_text_res
(
    id UInt64,
    json JSON,
    INDEX idx JSONAllPaths(json) TYPE text(tokenizer = 'splitByNonAlpha') GRANULARITY 1
)
ENGINE = MergeTree ORDER BY tuple()
SETTINGS index_granularity = 1;

-- 1b: Non-existing path
SELECT 'tokenbf non-existing';

-- 6b: Non-existing
SELECT 'ngrambf non-existing';

DROP TABLE t_json_tbf_res;

SELECT parseDateTimeBestEffort('15-September-2025');

CREATE DICTIONARY d0 (c0 Nullable(String)) PRIMARY KEY (c0) SOURCE(CLICKHOUSE(DB currentDatabase() TABLE 'v0')) LAYOUT(IP_TRIE()) LIFETIME(1);

SELECT base58Decode(base58Encode(unhex('00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001'))) = unhex('00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001');

SELECT 'size hint 32';

SELECT base58Decode(base58Encode(unhex('010203'))) = unhex('010203');

-- Test auto case ambiguity
CREATE TABLE json_test (age Int, AGE Int);

SELECT * FROM json_test ORDER BY id;

-- Indexed column inside or(..., 0): set index should still be used.
SELECT count() FROM t_set_index_or WHERE or(b = 5, 0) SETTINGS force_data_skipping_indices='idx_b';

SET cluster_for_parallel_replicas = 'test_cluster_one_shard_two_replicas';

SELECT count(*) FROM t_left JOIN t_right_i64 ON t_left.id = t_right_i64.id FORMAT NULL SETTINGS log_comment = '04029_range_hash_trigger_i64';

-- ANY INNER JOIN
SELECT '-- ANY INNER Int32';

CREATE TABLE test (id Int);

-- Empty arrays and missing paths.
CREATE TABLE test_typed_json (json JSON(a1 Array(JSON))) ENGINE = Memory;

-- Typed Array(JSON) with explicit JSON parameters
-- including SKIP with round brackets in backticks.
CREATE TABLE test_typed_json (json JSON(a1 Array(JSON(max_dynamic_paths=16, max_dynamic_types=4, SKIP `some()path`)))) ENGINE = Memory;

CREATE TABLE test_single (c0 Nullable(Tuple(Int32))) ENGINE = Memory;

SELECT 'multiple nullable tuple columns';

SELECT trim(explain) FROM (EXPLAIN indexes = 1 SELECT count() FROM t_multiply_overflow_signed WHERE key * 3 > 0) WHERE explain LIKE '%Condition%' OR explain LIKE '%Granules%';

OPTIMIZE TABLE t_multiply_i256_overflow FINAL;

-- 6148914691236517205 * 3 = 18446744073709551615 = UInt64 max (no overflow).
INSERT INTO t_multiply_boundary VALUES (6148914691236517205);

SELECT ignore(value) FROM t_vrow_reverse ORDER BY sign(toUnixTimestamp(ts)) ASC LIMIT 10;

DROP TABLE with_fill_staleness_cross_chunk;

SELECT count() FROM t_nan_pk3 WHERE isNull(nan) > col;

-- Test sign column (CollapsingMergeTree)
CREATE TABLE t_special_col (a UInt64, sign Int8) ENGINE = CollapsingMergeTree(sign) ORDER BY a;

SELECT * FROM 04032_t WHERE i = 3 AND i = toUInt8(5) SETTINGS optimize_redundant_comparisons = 0;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE i = 3 AND i > 1 SETTINGS optimize_redundant_comparisons = 0;

-- cross-type: equals Int32(3) AND less Float64(3.5) → float rewrite: i < 3.5 → i <= 3, then equals prunes it
SELECT 'eq_lt_cross_prune';

SELECT * FROM 04032_t WHERE i != 3 AND i > 3 ORDER BY i SETTINGS optimize_redundant_comparisons = 1;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE i < 5 AND i < 3 SETTINGS optimize_redundant_comparisons = 1;

SELECT * FROM 04032_t WHERE i > 3 AND i >= 3 ORDER BY i SETTINGS optimize_redundant_comparisons = 0;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE i <= 3 AND i > 3 SETTINGS optimize_redundant_comparisons = 0;

-- =====================================================================
-- Section 9: multiple expressions — independent optimization
-- =====================================================================

SELECT 'multi_expr';

SELECT * FROM 04032_t WHERE lc = 'y' AND lc = 'y' ORDER BY i SETTINGS optimize_redundant_comparisons = 1;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE i < 3 AND u > 3 AND u < 10 SETTINGS optimize_redundant_comparisons = 1;

-- =====================================================================
-- Section 15: edge cases
-- =====================================================================

-- single comparison (no optimization needed)
SELECT 'single';

SELECT count() FROM numbers(10) WHERE number != 7 AND number != 8 AND number != 2 AND number < 5 SETTINGS optimize_redundant_comparisons = 1;

SELECT count() FROM numbers(10) WHERE number < 5 AND number != 7 AND number != 2 AND number != 8 SETTINGS optimize_redundant_comparisons = 0;

SELECT count() FROM (SELECT number / 2. AS f, toInt8(number) AS i FROM numbers(3)) WHERE f AND i < 300 SETTINGS optimize_redundant_comparisons = 1;

-- =====================================================================
-- Section 22: a bound tightened by notEquals is rechecked against the other bound
-- =====================================================================

-- `<= 3` is tightened to `< 3` by `!= 3` and now contradicts `>= 3` → fold to false.
SELECT 'strengthen_then_conflict';

SELECT * FROM 04032_t WHERE i > '1' AND i < '5' ORDER BY i SETTINGS optimize_redundant_comparisons = 0;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE f = '1.5' AND f = 1.5 SETTINGS optimize_redundant_comparisons = 0;

-- DateTime string range — valid
SELECT 'dt_str_range';

SELECT * FROM 04032_t WHERE dt > 1704067200 AND dt < 1735689600 ORDER BY dt SETTINGS optimize_redundant_comparisons = 1;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE u > 256 AND i > 0 SETTINGS optimize_redundant_comparisons = 1;

SELECT * FROM 04032_t WHERE u > 255 AND i > 0 SETTINGS optimize_redundant_comparisons = 0;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE u >= 0 AND i > 0 SETTINGS optimize_redundant_comparisons = 0;

-- i <= 3.5 internally rewritten to i <= 3 for analysis, AST unchanged
SELECT 'float_rewrite_le';

SELECT * FROM 04032_t WHERE i > 1.5 AND i < 4.5 ORDER BY i SETTINGS optimize_redundant_comparisons = 1;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE u >= 0 AND u < 300 SETTINGS optimize_redundant_comparisons = 1;

SELECT * FROM 04032_t WHERE i != toUInt8(3) AND i <= 3 ORDER BY i SETTINGS optimize_redundant_comparisons = 0;

EXPLAIN SYNTAX run_query_tree_passes = 1 SELECT * FROM 04032_t WHERE f != 3.0 AND f >= 3 SETTINGS optimize_redundant_comparisons = 0;

-- 11.B  Float-rewrite + chained notEquals → cumulative strengthening (`i < 4.5 AND i != 4 AND i != 3` → `i < 4 AND i != 3`).
SELECT 'float_rewrite_lt_ne_chain';

SELECT groupArray(i) FROM 04032_t WHERE i < 3.5 AND i > 1 SETTINGS optimize_redundant_comparisons = 1;

-- all_4_4_0
optimize table mt_with_commit_order final;

DROP TABLE t_const_join_right;

SELECT text
FROM test_lc_fixedstring
WHERE lc_fs_col NOT LIKE '99%'
ORDER BY text
SETTINGS force_primary_key = 1, max_rows_to_read = 5;

-- Byte mode — all four interfaces

DROP TABLE IF EXISTS nb_byte_source;

SELECT arrayMap(p -> (p.1, round(p.2, 4)), naiveBayesClassifierWithAllProbs('nb_codepoint_model', 'это русский текст'));

SELECT naiveBayesClassifier('nb_alpha_model', 'good');

-- Duplicate ngram accumulation in source data

DROP TABLE IF EXISTS nb_dup_source;

DROP TABLE IF EXISTS nb_stored_reordered_source;

SELECT 'Zero-count rows do not change the model';

SELECT toTypeName(nested(['name'], cast([] as Array(LowCardinality(String))) as a));

EXPLAIN indexes = 1
SELECT * FROM t_empty_pk WHERE notEmpty(s);

-- Setup dictionary source table
CREATE TABLE t2_94659 (a Int64, b Int64) ENGINE = Memory();

-- Non-positive alpha

CREATE DICTIONARY nb_bad_alpha
(
    ngram String,
    class_id UInt32 DEFAULT 0,
    count UInt64 DEFAULT 0
)
PRIMARY KEY ngram
SOURCE(CLICKHOUSE(TABLE 'nb_err_source'))
LAYOUT(NAIVE_BAYES(class_attribute 'class_id' n 1 mode 'token' alpha 0))
LIFETIME(0);

CREATE DICTIONARY nb_flat_dict (id UInt64, val String DEFAULT '')
PRIMARY KEY id
SOURCE(CLICKHOUSE(TABLE 'nb_flat_source'))
LAYOUT(FLAT())
LIFETIME(0);

SELECT v1 FROM tab_nullable ORDER BY v1 ASC LIMIT 5 SETTINGS use_top_k_dynamic_filtering=1;

CREATE TABLE tab_collate
(
    id UInt32,
    v1 String
) Engine = MergeTree ORDER BY id SETTINGS index_granularity = 64, min_bytes_for_wide_part = 0, min_bytes_for_full_part_storage = 0, max_bytes_to_merge_at_max_space_in_pool = 1, use_const_adaptive_granularity = 1, index_granularity_bytes = 0;

DROP TABLE t_left_s;

SELECT h3ToParent(toUInt64(0), 1);

SYSTEM DISABLE FAILPOINT patch_parts_reverse_column_order;

-- Nullable(String) with COLLATE and minmax index: skip-index top-k should NOT activate
DROP TABLE IF EXISTS tab_nullable_string_collate_idx;

INSERT INTO base64 SELECT number, pi() FROM numbers(3000);

DROP TABLE t_04035_buf;

-- Parenthesized SELECTs with trailing SETTINGS on CREATE (this was the failing case)
CREATE TABLE t_intersect_settings ENGINE = Null() AS (SELECT 1 AS x) INTERSECT (SELECT 1 AS x) SETTINGS enable_global_with_statement = 0;

SELECT 'enable_even_for_bad_queries with empty token still deduplicates (unstable mode)';

-- Test 3: DELETE with IN condition - should prune to 2 partitions
DROP TABLE IF EXISTS t_mut_prune_3;

ALTER TABLE t_mut_prune_5 UPDATE value = 'all' WHERE key > 0;

-- ============================================================
-- Phase 2: Multi-partition IN PARTITION syntax
-- ============================================================

-- Test 8: DELETE with multi-partition IN PARTITION
DROP TABLE IF EXISTS t_mut_multi_1;

-- Empty string
SELECT '' AS value, normalizeUTF8NFKCCasefold(value) AS result, length(result);

CREATE TABLE nfkc_cf_test (id UInt32, value String) ENGINE = MergeTree ORDER BY id;

-- February (non-leap): 28
SELECT toDaysInMonth(toDate('2024-02-01'));

INSERT INTO t_dyn_repro VALUES (1::Int8), (2::Int8);

INSERT INTO t_pr_task_prop SELECT number + 1_100_000, number, randomString(100) FROM numbers_mt(1_000_000);

SELECT * FROM test_regex_prefix WHERE match(id, '^aaa\\(') ORDER BY id SETTINGS force_primary_key = 1, max_rows_to_read = 1;

SELECT trimLeft(explain) FROM (EXPLAIN PLAN indexes=1 SELECT id FROM test_regex_prefix WHERE match(id, '^aaa\\+')) WHERE explain LIKE '%Condition%' OR explain LIKE '%Granules%';

-- Metacharacter '^' mid-pattern stops prefix extraction
SELECT trimLeft(explain) FROM (EXPLAIN PLAN indexes=1 SELECT id FROM test_regex_prefix WHERE match(id, '^aaa^bbb')) WHERE explain LIKE '%Condition%' OR explain LIKE '%Granules%';

INSERT INTO test_regex_safety VALUES ('xxa-1'), ('xxa-2'), ('xxb-1'), ('yyy-1');

DROP TABLE test_regex_handler;

SELECT count() FROM test_regex_edge WHERE match(id, '^(aa|aab)') SETTINGS force_primary_key = 1, max_rows_to_read = 2;

-- Non-literal escape sequences in alternation branches: "^(\x41foo|\x41bar)"
-- \x41 is RE2 hex for 'A'. Only whitelisted literal escapes are accepted.
-- Sorted: Abar, Afoo, other (3 rows/granules)
DROP TABLE IF EXISTS test_regex_nonliteral_escape;

-- Tests that text indexes on mapKeys(m) and mapValues(m) cooperate to skip granules with IN on large data.
--
-- Data layout (200000 rows, 25 granules with index_granularity=8192):
--   rows 0-49999:       {'service': 'web-api'}
--   rows 50000-99999:   {'service': 'backend'}
--   rows 100000-149999: {'service': 'frontend', 'env': 'prod'}
--   rows 150000-199999: {'service': 'worker',   'env': 'staging'}
SET explain_query_plan_default = 'legacy';

-- Reading Map key subcolumn with Tuple value type from MergeTree compact parts
-- previously caused an exception because `SerializationMapKeyValue` wrapped the
-- Array(Tuple(K,V)) serialization, and `DataTypeTuple::createColumn` expected
-- a `SerializationTuple` after unwrapping.

DROP TABLE IF EXISTS t_map_tuple;

SELECT 'test 3: mixed partition ID';

ALTER TABLE t_parse_neg_nonexist DELETE IN PARTITION '2099-12-31' WHERE 1;

SELECT 'Time promoted to DateTime64 - epoch date prepended';

SELECT CAST('14:45:40.500', 'Time64(3)') = toDateTime64('1970-01-01 14:45:40.500', 3, 'Asia/Istanbul');

-- Unicode token with wildcards

set enable_full_text_index = 1;

CREATE TABLE test_json_arr (json JSON) ENGINE = MergeTree ORDER BY tuple();

EXPLAIN QUERY TREE run_passes = 1
SELECT json.a[1].b, json.a FROM test_json_arr
SETTINGS optimize_functions_to_subcolumns = 1;

INSERT INTO test_json_empty VALUES ('{"a": []}');

CREATE TABLE test_printf_fmt (fmt String, val UInt32) ENGINE = Memory;

CREATE TABLE tab (id UInt64, val Array(String), INDEX idx(val) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = CAST(val, 'String'))) ENGINE = MergeTree ORDER BY id;

CREATE TABLE tab (id UInt64, val LowCardinality(String), INDEX idx(val) TYPE text(tokenizer = 'splitByNonAlpha', preprocessor = CAST(val, 'Nullable(FixedString(3))'))) ENGINE = MergeTree ORDER BY id;

-- Gate test: enable_blob_storage_log_for_read_operations=1 but enable_blob_storage_log=0 must not produce any Read events,
-- because the blob storage log writer is gated by the parent setting.
INSERT INTO FUNCTION s3(s3_conn, url = 'http://localhost:11111/test/04039_data/gate_'||currentDatabase()||'.csv', structure = 'number UInt64', format = CSV)
    SETTINGS s3_truncate_on_insert = 1
    SELECT number FROM numbers(10);

SELECT count(tup.s) FROM t_nullable_tuple SETTINGS optimize_functions_to_subcolumns = 1;

INSERT INTO test_typed_json VALUES ('{"a":{"b":[{"c":10},{"c":20}]}}');

CREATE TABLE t (
    key UInt32,
    value UInt32,
    PROJECTION p (SELECT sum(value) GROUP BY key)
) ENGINE = MergeTree ORDER BY key;

-- Only n.a is used — n.b and n.c should not be read.
SELECT n.a FROM t_nested ARRAY JOIN n ORDER BY n.a;

-- Test that text index direct read works when predicate is also referenced in SELECT via alias.
-- Bug: the optimization renamed the filter column to a virtual column name, but the
-- downstream ExpressionStep still expected the original column name.

SET query_plan_direct_read_from_text_index = 1;

-- Rows matching TTL WHERE condition (a < 10) should be deleted, others should remain
SELECT count() FROM t_ttl_in_subquery WHERE a < 10;

EXPLAIN PLAN keep_logical_steps = 1
SELECT count() FROM test_orders
WHERE EXISTS (SELECT 1 FROM test_lineitem WHERE l_orderkey = o_orderkey);

ALTER TABLE test_wide CLEAR COLUMN c1;

INSERT INTO test_array FORMAT JSONEachRow
{"n": 5}
{}
{"arr": [10, 20]}

SELECT * FROM test_array ORDER BY n, arr;

SELECT 'axb' LIKE 'a|_b' ESCAPE '|';

SELECT formatQuery('SELECT x NOT ILIKE ''abc'' ESCAPE ''#''');

-- WHERE + HAVING different key
SELECT 'WHERE + HAVING different key';

-- Memory engine: confirms bug is in the analyzer, not serialization
SELECT 'Memory engine WHERE + HAVING';

-- 2. Make sure that the column names and types do not change.
SELECT name, type
FROM system.columns
WHERE database = 'system' AND table = 'connections'
ORDER BY position;

INSERT INTO test SELECT number + 120, number FROM numbers(10);

SELECT count() FROM test_lineitem RIGHT ANTI JOIN test_orders ON l_orderkey = o_orderkey
SETTINGS distributed_plan_execute_locally = 1, distributed_plan_fallback_to_local_execution = 0;

DROP TABLE IF EXISTS users_04041;

INSERT INTO test_vertical_merge_race SELECT number + 900, 'a','b','c','d','e','f','g','h','i','j','k','l' FROM numbers(100);

-- Granule spans [-inf, nan]; right bound is NaN — exercises the else-if branch
SELECT count() FROM t_04042_nan WHERE col > 0;

-- The same contract holds on the planner-built parallel-replicas path for a NON-replicated 'MergeTree' table
-- ('parallel_replicas_for_non_replicated_merge_tree = 1'). The top-level SETTINGS clause of the query is not
-- re-serialized into the query text sent to the replicas - 'buildQueryTreeForShard' clears
-- 'QueryNode::settings_changes' before the shipped AST is built - so the outer 'max_execution_time = 100' cannot
-- override the leaf value substituted into the context by 'updateContextForParallelReplicas'.
DROP TABLE IF EXISTS test_max_execution_time_leaf_plain SYNC;

CREATE TABLE t_text_index_lwd_bug
(
    id UInt64,
    body String,
    created_at DateTime,
    INDEX fts_body body TYPE text(tokenizer = 'splitByNonAlpha')
)
ENGINE = MergeTree
ORDER BY id
SETTINGS
    index_granularity = 8192,
    index_granularity_bytes = '10M';

-- Three-way: Time + Time64 + DateTime64 → DateTime64 with maximum scale
SELECT 'Three-way supertype';

DROP TABLE IF EXISTS local_04043;

SELECT * FROM t1 NATURAL JOIN t3 ORDER BY id, extra;

-- Test 1: Basic IN with mixed-case value that matches after lowering.
-- The index stores "hello" (lowered). The IN set has 'Hello World' which
-- should be lowered to 'hello world' and tokenized to ['hello', 'world'].
-- Without the fix, the raw 'Hello' token would not match 'hello' in the index,
-- causing incorrect granule skipping and returning 0 rows instead of 100.
SELECT 'Test 1 IN with preprocessor:', count()
FROM tab_in_preprocess
WHERE text IN ('Hello World row 0', 'Hello World row 1');

CREATE TABLE t_ephemeral_materialized
(
    c1 String EPHEMERAL,
    c2 String MATERIALIZED reverse(c1),
    c3 Bool
)
ENGINE = MergeTree
ORDER BY tuple();

-- Regression test: TextSearchQuery::getHash must distinguish queries whose tokens
-- have the same concatenated bytes but different boundaries.
-- E.g. tokens ['abc', 'def'] vs ['abcd', 'ef'] both concatenate to "abcdef"
-- but represent different search conditions. A collision would cause one query's
-- virtual column to be mapped to the wrong search tokens in direct-read mode.

SET use_skip_indexes = 1;

SELECT max(number) FROM numbers(0);

SELECT count() FROM numbers(1000) SETTINGS max_rows_to_read_leaf = 10;

SELECT uniq(b) FROM merge(currentDatabase(), 'r_t[12]') ORDER BY ALL;

CREATE MATERIALIZED VIEW test_view_04046 TO test_table_04046 AS SELECT c0, c1, c2 FROM test_table_04046;

-- Nested subqueries with INTERSECT inside MODIFY QUERY with trailing SETTINGS:
-- the parenthesization must not propagate into the nested subquery
SELECT formatQuery('ALTER TABLE v1 (MODIFY QUERY SELECT c0 FROM ((SELECT 1 AS c0) INTERSECT DISTINCT (SELECT 2 AS c0))) SETTINGS max_threads = 1');

DROP TABLE IF EXISTS uk_t_src;

-- An aggregating query the optimizer would route through the projection falls
-- back to the (delete-bitmap-filtered) base table and succeeds, rather than
-- failing the read.
SET optimize_use_projections = 1;

-- 21. ATTACH/REPLACE PARTITION FROM a UK source -> plain destination is blocked.
DROP TABLE IF EXISTS uk_src_for_plain;

SELECT key1, key2, sum(val) AS s, count() AS c
FROM (SELECT number % 3 AS key1, number % 5 AS key2, number AS val FROM numbers(1000))
GROUP BY GROUPING SETS ((key1), (key2))
ORDER BY key1, key2, s, c
SETTINGS max_bytes_before_external_group_by = 1, max_bytes_ratio_before_external_group_by = 0, group_by_two_level_threshold = 1;

INSERT INTO t_04048_outer VALUES (1), (2), (3);

-- Test 1: Int8 partition key → LowCardinality(Int8)
DROP TABLE IF EXISTS t_lc_agg SYNC;

SELECT
    cutURLParameter('http://bigmir.net/?ba=1&a=2', 'a'),
    cutURLParameter('http://bigmir.net/?a=2&ba=1', 'a'),
    cutURLParameter('http://bigmir.net/?ba=1&a=2', ['a']),
    cutURLParameter('http://bigmir.net/?a=2&ba=1', ['a']),
    cutURLParameter('http://bigmir.net/?ba=1&a=2', ['a', 'ba'])
    FORMAT Vertical;

SELECT 'true_is_not_unknown', 1 WHERE true IS NOT UNKNOWN;

SELECT 'Multiple ORDER BY columns, partial tie';

CREATE TABLE t_zero_bits (ds Date, uin UInt32, value Float64) ENGINE = MergeTree() ORDER BY ds;

SELECT COUNT(*) FROM tab WHERE id2 > 'k3';

INSERT INTO t_wide SELECT if((number % 2) = 0, (number, toString(number)), NULL) FROM numbers(4);

CREATE TABLE t3_compact (id UInt8, x Nullable(Tuple(a UInt32, t2 Nullable(Tuple(b UInt32, t3 Nullable(Tuple(c UInt32, leaf Nullable(Int64)))))))) ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 1000000000;

SELECT count(x.t2), count(x.t2.t3), count(x.t2.t3.t4), count(x.t2.t3.t4.leaf) FROM t4_mem;

DROP VIEW IF EXISTS test_view_nested;

CREATE TABLE t2 (b UInt32, y UInt32) ENGINE = MergeTree() ORDER BY b;

SELECT count() > 0 FROM t0;

SELECT intDiv(number, 2) AS x FROM numbers(10) ORDER BY x LIMIT 5, -1 WITH TIES;

SELECT intDiv(number, 4) AS a, number % 2 AS b FROM numbers(12) ORDER BY a, b LIMIT 4, -3 WITH TIES;

SELECT COUNT(*) FROM test WHERE v < 500 SETTINGS log_comment = 'test_data_read_1';

SELECT count()
FROM t_text_idx_extreme
WHERE hasAllTokens(text, ['dense', 'medium', 'rare', 'ultrarare'])
SETTINGS text_index_posting_list_apply_mode = 'lazy',
         query_plan_direct_read_from_text_index = 1;

SELECT CAST(90000::UInt64, 'Time64');

SELECT toDate32('2020-01-01') AS d ORDER BY d DESC WITH FILL STEP INTERVAL -9223372036854775808 SECOND;

INSERT INTO test_idx_compact SELECT number, number + 1 FROM numbers(10);

ALTER TABLE test_combined CLEAR COLUMN c1;

SELECT if(toUInt8(0), 1.5, 2.5);

CREATE DICTIONARY test_dict
(
    id UInt64,
    country String,
    city String,
    population UInt64
)
PRIMARY KEY id
SOURCE(CLICKHOUSE(TABLE 'dict_source' DB currentDatabase()))
LAYOUT(FLAT())
LIFETIME(0);

SELECT dictGetOrDefault(currentDatabase() || '.test_dict', ('country', 'city'), toUInt64(999), tuple('FuncCountry', 'FuncCity')).2;

-- Pin the settings that the assertion depends on. The test runner injects
-- random session settings; without these pins, the runner can flip
-- `optimize_move_to_prewhere` to `0` and the
-- query condition cache then writes its verdict against the WHERE-side hash
-- instead of the PREWHERE-side hash documented in the comment block at the
-- top of this file. The assertion still holds for the WHERE-side path, but
-- pinning both keeps the test exercising the same code path the regression
-- comment describes and removes a class of CI noise that is unrelated to
-- the bug under test.
set optimize_move_to_prewhere=1;

-- Returns: 0
SELECT 'test123' SIMILAR TO '[a-z]+[0-9]+';

-- Returns: 1
SELECT 'a'       SIMILAR TO '[%_]';

SELECT 'a' SIMILAR TO '[a:]';

-- Returns: 1
SELECT '5' SIMILAR TO '[[:digit:]%]';

-- Returns: 0
SELECT 'a'  SIMILAR TO '[^[]';

SELECT '.'   SIMILAR TO '\.';

SELECT '-- ESCAPE clause: the escape character makes the next character a literal';

-- Returns: 1
SELECT ('a_b' SIMILAR TO 'a\\_b' ESCAPE '\\') = ('a_b' SIMILAR TO 'a\\_b');

-- Returns: 1 (#_ is a literal _)
SELECT 'axb' SIMILAR TO SOME(['a#_b', 'z%']) ESCAPE '#';

INSERT INTO test_variant_filter SELECT number, NULL FROM numbers(50000);

-- 1
SELECT EXTRACT(DOY FROM toDate('2024-12-31'));

-- Sunday = 7
SELECT EXTRACT(ISOYEAR FROM toDate32('2024-01-01'));

ALTER TABLE t_100328_idx ADD INDEX idx2 v TYPE bloom_filter GRANULARITY 1;

SELECT number, (SELECT if(number > 2, number, 0))
FROM numbers(4)
GROUP BY number
WITH CUBE
ORDER BY number ASC NULLS FIRST;

-- Test for block structure mismatch in removeUnusedColumns when combining
-- FINAL + PREWHERE + constant WHERE expression + window function.
--
-- A WHERE expression that uses no table columns (all inputs are constants)
-- causes FilterStep to declare zero required input columns.
-- ReadFromMergeTree with FINAL must keep the sort key columns for the merge
-- ({update_ts, id}), so its output cannot be reduced to zero columns.
-- absorbExtraChildColumns() must bridge this gap; without the fix it left
-- a column-count mismatch that surfaced as a block structure error when a
-- WindowStep was downstream of the FilterStep.

DROP TABLE IF EXISTS t_final_prewhere_wnd;

ALTER TABLE t_100329 MODIFY COLUMN v2 COMMENT 'Primary key column';

DROP TABLE t_100318_rmt;

SELECT 'Negative FETCH and positive OFFSET';

-- ==========================================================================
-- 2. ASTSelectQuery
-- Fields: recursive_with, distinct, group_by_all, group_by_with_totals,
--         group_by_with_rollup, group_by_with_cube, group_by_with_constant_keys,
--         group_by_with_grouping_sets, order_by_all, limit_with_ties,
--         limit_by_all, with, select, tables, prewhere, where, group_by,
--         having, window, qualify, order_by, limit_by_offset, limit_by_length,
--         limit_by, limit_offset, limit_length, settings, interpolate
-- ==========================================================================

-- Test distinct flag
SELECT 'SelectQuery_distinct' AS t,
    JSONExtractBool(j, 'list_of_selects', 'children', 1, 'distinct') AS distinct_flag
FROM (SELECT parseQueryToJSON('SELECT DISTINCT a FROM t') AS j);

-- Identifier with alias
SELECT 'Identifier_alias' AS t,
    JSONExtractString(j, 'list_of_selects', 'children', 1, 'select', 'children', 1, 'alias') AS al
FROM (SELECT parseQueryToJSON('SELECT a AS x') AS j);

-- ==========================================================================
-- 21. ASTTablesInSelectQueryElement
-- Fields: table_join(child), table_expression(child), array_join(child)
-- ==========================================================================

SELECT 'TablesInSelectQueryElement' AS t,
    JSONExtractString(j, 'list_of_selects', 'children', 1, 'tables', 'children', 1, 'type') AS tp,
    JSONHas(j, 'list_of_selects', 'children', 1, 'tables', 'children', 1, 'table_expression') AS has_te
FROM (SELECT parseQueryToJSON('SELECT 1 FROM t') AS j);

-- ==========================================================================
-- 33. ASTExplainQuery
-- Fields: kind(string), settings(child), query(child)
-- ==========================================================================

SELECT 'ExplainQuery_AST' AS t,
    JSONExtractString(j, 'kind') AS kind,
    JSONHas(j, 'query') AS has_query
FROM (SELECT parseQueryToJSON('EXPLAIN AST SELECT 1') AS j);

-- ==========================================================================
-- 44. ASTInsertQuery
-- Fields: database_name(string), table_name(string), database(child), table(child),
--         format(string), columns(child), table_function(child), select(child)
-- ==========================================================================

SELECT 'InsertQuery_select' AS t,
    JSONExtractString(j, 'type') AS tp,
    JSONHas(j, 'table') AS has_table,
    JSONHas(j, 'select') AS has_select
FROM (SELECT parseQueryToJSON('INSERT INTO t SELECT 1, 2') AS j);

-- ==========================================================================
-- 58. ASTDictionaryRange
-- Fields: min_attr_name(string), max_attr_name(string)
-- ==========================================================================

SELECT 'DictionaryRange' AS t,
    JSONExtractString(j, 'dictionary', 'range', 'min_attr_name') AS min_attr,
    JSONExtractString(j, 'dictionary', 'range', 'max_attr_name') AS max_attr
FROM (SELECT parseQueryToJSON('CREATE DICTIONARY dict (id UInt64, start DateTime, end DateTime, name String DEFAULT \'\') PRIMARY KEY id SOURCE(CLICKHOUSE(TABLE \'t\')) LAYOUT(RANGE_HASHED()) LIFETIME(MIN 0 MAX 1000) RANGE(MIN start MAX end)') AS j);

-- Complex SELECT with all clauses
SELECT 'RT_select_full' AS t, formatQueryFromJSON(parseQueryToJSON('SELECT DISTINCT a, sum(b) AS s FROM t PREWHERE c > 0 WHERE d = 1 GROUP BY a WITH TOTALS HAVING s > 10 ORDER BY s DESC LIMIT 5 BY a LIMIT 10 OFFSET 2'));

SELECT 'RT_natural_join' AS t, formatQueryFromJSON(parseQueryToJSON('SELECT a FROM t1 NATURAL JOIN t2'));

-- CREATE TABLE with TTL
SELECT 'RT_create_ttl' AS t, formatQueryFromJSON(parseQueryToJSON('CREATE TABLE t (a UInt64, d DateTime) ENGINE = MergeTree ORDER BY a TTL d + INTERVAL 1 DAY'));

-- SHOW queries
SELECT 'RT_show_tables' AS t, formatQueryFromJSON(parseQueryToJSON('SHOW TABLES FROM db'));

SELECT 'RT_create_sql_function_ine' AS t, formatQueryFromJSON(parseQueryToJSON('CREATE FUNCTION IF NOT EXISTS myFunc AS (x) -> x + 1'));

SELECT INTERVAL '1:30:45' HOUR TO SECOND;

SELECT toDateTime('2024-01-01 00:00:00') + INTERVAL '5 12:30:45' DAY TO SECOND;

-- 2. Replace with schema change (inner table case)
CREATE OR REPLACE MATERIALIZED VIEW test_mv ENGINE = MergeTree ORDER BY x AS SELECT x, x * 2 AS y FROM src;

DROP TABLE src2;

SELECT * FROM left l INNER JOIN right r ON l.k = r.k FORMAT Null
SETTINGS query_plan_optimize_join_order_limit = 0, log_comment = 'rs_disabled_by_unknown_statistcs';

SELECT * FROM left l INNER JOIN right r ON l.k = r.k ORDER BY ALL SETTINGS join_algorithm = 'parallel_hash';

INSERT INTO test VALUES (1), (1), (2), (2), (2), (2), (3), (3);

-- Reset and test readWKB (variant-returning) with bad data
SET max_wkb_geometry_elements = 1000000;

-- sumCountForEach: deserialize old state and round-trip.
SELECT finalizeAggregation(CAST(unhex('01000000000000000A0000000000000004'), 'AggregateFunction(sumCountForEach, Array(Nullable(UInt8)))'));

-- Test with intersect_default_mode = 'ALL' and except_default_mode = 'ALL'.
-- Use data with duplicates so that ALL vs DISTINCT actually produces different results.
DROP TABLE IF EXISTS v2;

-- Distinct combinator: deserialize old states and round-trip.

-- simpleLinearRegressionDistinct
SELECT finalizeAggregation(CAST(unhex('01041000000000000010400000000000002240100000000000000040000000000000144010000000000000F03F00000000000008401000000000000014400000000000002640'), 'AggregateFunction(simpleLinearRegressionDistinct, Nullable(Float64), Nullable(Float64))'));

SELECT min(x), max(x) FROM (SELECT arrayJoin([toFloat64(1), toFloat64(nan), toFloat64(3)]) AS x);

-- 1000 rows: NaN at position 500 (middle)
INSERT INTO test_nan_batch SELECT if(number = 500, nan, toFloat64(number)) FROM numbers(1000);

-- ===========================================================================
-- Section 7: Float32 specifically (separate SIMD path)
-- ===========================================================================

SELECT 'Float32 batch';

INSERT INTO test_simd_f32 SELECT if(number = 999, toFloat32(nan), toFloat32(number)) FROM numbers(1000);

CREATE TABLE test_simd_null (x Nullable(Float64)) ENGINE = MergeTree ORDER BY tuple();

SELECT 'middle', argMinIf(id, x, cond), argMaxIf(id, x, cond) FROM test_simd_argif;

DROP TABLE IF EXISTS test_nan_order;

SELECT max(x) FROM (SELECT x FROM t ORDER BY x OFFSET -3);

-- formatQueryFromJSON should enforce max_ast_depth.
-- Use a limit high enough for the outer query (depth ~8) but low enough
-- for the reconstructed AST of 1+2+3+4+5 (depth ~12) to exceed it.
SET max_ast_depth = 10;

SELECT highlight('a', ['ab']);

SELECT nfs, x FROM t_jit_sort_str ORDER BY nfs ASC NULLS LAST, x;

ALTER TABLE test_mutation_tz_upd UPDATE val = 'new' WHERE time >= '2000-01-01 02:00:00';

-- Same for DateTime64
DROP TABLE IF EXISTS test_mutation_tz64_set SYNC;

SELECT count() FROM (SELECT 0 AS x FROM numbers_mt(100000) ORDER BY x LIMIT -1 WITH TIES);

SELECT accurateCastOrNull((1, 2)::Tuple(a Int32, b Int32), 'Tuple(a Float32, b Float64)') AS r, toTypeName(r);

-- Nullable source with Nullable target: conversion failure (new NULL) -> whole tuple NULL.
SELECT accurateCastOrNull((1.5,)::Tuple(Nullable(Float32)), 'Tuple(Nullable(Int32))') AS r, toTypeName(r);

SELECT accurateCast(()::Tuple(), 'Tuple()') AS r, toTypeName(r);

-- Decimal overflow returns default.
SELECT accurateCastOrDefault((10,)::Tuple(Int32), 'Tuple(Decimal32(9))') AS r, toTypeName(r);

SELECT CAST((128,)::Tuple(Int32), 'Tuple(Int8)') AS r, toTypeName(r);

-- Tuple with NULL element: whole tuple becomes NULL.
SELECT accurateCastOrNull(tuple(NULL, 1), 'Point') AS r, toTypeName(r);

-- FixedString path: non-ASCII in FixedString(26)
SELECT ULIDStringToDateTime(toFixedString(concat('\xFF', repeat('0', 25)), 26));

EXPLAIN PLAN actions = 1, compact = 1, pretty = 1
SELECT * FROM t1 WHERE d IS NULL;

INSERT INTO test_json_cache SELECT number, toJSONString(map('a.b.c', number)) FROM numbers(5, 5);

SELECT 'Offset crossing chunk boundaries';

SELECT intDiv(number, 3) AS x FROM numbers(12) ORDER BY x LIMIT -3, -5 WITH TIES;

-- Custom limits: lower the threshold
SET max_rand_distribution_trials = 100;

-- Without Variant: should error on incompatible tuple arities
SELECT [tuple(), (1, 2)] SETTINGS use_variant_as_common_type = 0;

CREATE TABLE t_constraint_trans
(
    a Int64,
    b Int64,
    c Int64,
    d Int32,
    CONSTRAINT c1 ASSUME (a = b) AND (c = d),
    CONSTRAINT c2 ASSUME b = c
)
ENGINE = TinyLog;

EXPLAIN PLAN actions = 1, compact = 1, pretty = 1
SELECT a, row_number() OVER (PARTITION BY b ORDER BY ((a * (2 + 1)) - 1)) AS rn FROM t1;

INSERT INTO test_json_all_values SELECT materialize('{"a": 42}')::JSON(max_dynamic_paths=1);

INSERT INTO test_json_all_values_complex
SELECT 1, materialize('{"meta":{"id":1},"a":{"b":{"c":1,"d":"alpha"}},"m":true}')::JSON(max_dynamic_paths=0);

DROP TABLE t_topk_dynamic;

CREATE TABLE t_topk_tuple_nulls (
    id Int64,
    k  Tuple(UInt64, Nullable(UInt64))
) ENGINE = MergeTree ORDER BY id
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 64;

EXPLAIN PLAN actions = 1, compact = 1, pretty = 1
SELECT * FROM t1 PREWHERE a > 5 WHERE b = 'x';

OPTIMIZE TABLE 04060_test FINAL;

-- Commit a transactional insert; its part will have creation_csn > 1
INSERT INTO t VALUES (3);

SELECT arrayDotProduct([]::Array(Float64), y) FROM VALUES('y Array(Float64)', ([]), ([]));

CREATE TABLE t_rtb_hourly_2
(
    Hour DateTime('UTC'),
    NetworkId UInt16,
    BundleDomain Int32,
    AppSiteChannelId Int32,
    DeviceTypeId UInt16,
    Impressions UInt64,
    Clicks UInt64,
)
ENGINE = MergeTree()
PARTITION BY toYearWeek(Hour)
ORDER BY (Hour, NetworkId, BundleDomain, AppSiteChannelId, DeviceTypeId)
SETTINGS index_granularity=10;

-- Test: View
SELECT 'View';

DROP TABLE IF EXISTS test_trivial_count_types;

DROP TABLE IF EXISTS nested_m_t1;

SELECT 'LEFT+LEFT no opt:';

--- Row policy on a simple view (column names match inner query).
CREATE VIEW rp_view AS SELECT x, y FROM rp_src;

SELECT id, value FROM t_cache_small_granules WHERE id = 500 SETTINGS use_columns_cache = 1;

-- DISTINCT with cache
SELECT count(DISTINCT category), count(DISTINCT value) FROM t_cache_distinct
SETTINGS use_columns_cache = 1;

SELECT sum(value) FROM t_cache_multi_query WHERE id < 3000 SETTINGS use_columns_cache = 1;

INSERT INTO t_cache_replacing SELECT number, number * 2, 1 FROM numbers(2000);

INSERT INTO t_lc_in_subquery SELECT number, (number, number % 10), number FROM numbers(1000);

-- A unit square [0,1]x[0,1]
INSERT INTO polygons VALUES ([[[(0, 0), (1, 0), (1, 1), (0, 1)]]], 'square', 10, 0, '');

DROP TABLE IF EXISTS data_b;

DROP TABLE reports_a;

SYSTEM STOP MERGES t_ttl_sparse_h;

SELECT arrayMap(toUInt64, [1.1, 2.2, 3.3]);

-- Tag no-parallel-replicas: with parallel replicas the data may be read by the queries of other replicas, so the `ColumnsCache` hit and miss events are missing from the `query_log` entry of the initiator.
-- Test cache metrics, ProfileEvents, and system commands

SET max_threads = 1;

-- Read with cache reads disabled (should not use cache but still work)
SELECT sum(id), count() FROM t_cache_metrics
SETTINGS use_columns_cache = 1, enable_reads_from_columns_cache = 0;

-- Drop table (cache entries should become stale but not cause errors)
DROP TABLE t_cache_temp;

SHOW CREATE VIEW v FORMAT Null;

SELECT * FROM generate_series(0, CAST('18446744073709551615', 'UInt64'), toUInt64(9223372036854775808)) WHERE generate_series > 0;

CREATE TABLE t2 (counter_id UInt32, utm_campaign Nullable(String), utm_source Nullable(String), utm_medium Nullable(String), sessions UInt32, pageviews UInt32) ENGINE = MergeTree ORDER BY counter_id;

-- Verify correct results with different query types
SELECT sum(id) FROM merge(currentDatabase(), '^(dist_table|memory_table)$')
    SETTINGS distributed_group_by_no_merge = 1;

DROP TABLE t_minmax_null;

-- Verify that merge()'s arguments are NOT resolved on the initiator.
-- Without the fix, the analyzer resolves merge() locally, which constant-folds
-- currentDatabase() into a CONSTANT node (with an EXPRESSION subtree preserving
-- the original function). With the fix, merge() arguments are left unresolved,
-- so no constant folding occurs and no EXPRESSION subtree appears.
SELECT count() = 0 FROM (EXPLAIN QUERY TREE SELECT sum(x) FROM remote('127.0.0.1', merge(currentDatabase(), '^test_t'))) WHERE explain LIKE '%EXPRESSION%';

SELECT c0 FROM file(currentDatabase() || '_04064.orc', 'ORC', 'c0 Nullable(Tuple(UInt32, String))');

-- ORC nullable elements
INSERT INTO TABLE FUNCTION file(currentDatabase() || '_04064_elem.orc', 'ORC') SELECT c0 FROM test_nullable_tuple_elem;

-- Named tuple
DROP TABLE IF EXISTS test_nullable_tuple_named;

-- Arrow single
INSERT INTO TABLE FUNCTION file(currentDatabase() || '_04064_single.arrow', 'Arrow', 'c0 Nullable(Tuple(UInt32))') SELECT c0 FROM test_nullable_tuple_single;

SELECT c0, c1 FROM file(currentDatabase() || '_04064_multi.orc', 'ORC', 'c0 Nullable(Tuple(UInt32, String)), c1 Nullable(Tuple(Float64))');

CREATE TABLE test_nullable_tuple_import_nested (c0 Array(Nullable(Tuple(a UInt32, b String)))) ENGINE = Memory;

INSERT INTO TABLE FUNCTION file(currentDatabase() || '_04064_lc_str.orc', 'ORC') SELECT c0 FROM test_nullable_tuple_lc_string;

-- Test 1: Array(LowCardinality(Nullable(String))) with cache
SELECT count(), sum(length(tags)) FROM t_cache_composite;

INSERT INTO t_count_exact SELECT number + 5000, toString(number) FROM numbers(5000);

DROP TABLE t_right_sparse;

-- JSON format: negative limit + negative offset
SELECT explain LIKE '%"Negative Limit": 3%' AND explain LIKE '%"Negative Offset": 2%' FROM (EXPLAIN json=1, actions=1 SELECT number FROM numbers(10) ORDER BY number LIMIT -2, -3);

INSERT INTO TABLE FUNCTION file(currentDatabase() || '_04065_elem.parquet', 'Parquet') SELECT c0 FROM test_nullable_tuple_elem;

-- Schema inference: inferred type with toTypeName
DROP TABLE IF EXISTS test_nullable_tuple_describe;

-- Create table with specific granule configuration
CREATE TABLE t_cache_ranges (
    id UInt64,
    category String,
    value UInt64,
    data String
) ENGINE = MergeTree
ORDER BY id
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 1000;

SELECT 'All partial range tests passed';

SELECT '--JSON_QUERY with Tuple--';

SELECT JSON_QUERY(json, [['$.a'], ['$.b', '$.c']])
FROM VALUES('json String',
    ('{"a":[1,2], "b":{"x":3}, "c":42}'),
    ('{"a":"hello", "b":[1,2,3]}'),
    ('{}'));

CREATE VIEW v_limit AS SELECT * FROM t_base LIMIT 100;

SELECT '-- view with UNION DISTINCT: inner query sent over t_base/t_base2';

INSERT INTO t_smallest_col_nullable VALUES ((1)), ((NULL)), (NULL);

-- Repeat to test cache
SELECT count(*) FROM t_cache_granules WHERE id < 8192;

SELECT count(*) FROM t_cache_granules WHERE id % 1000 = 0;

DROP TABLE t_cache_granules;

SELECT arrayTranspose([[1, 2], [3, 4]]);

SELECT arrayPermutations([]);

SELECT arrayPartialPermutations([1, 2, 3], 2) FROM numbers(2) SETTINGS function_range_max_elements_in_block = 36;

-- Verify entire range is now cached
SELECT count(), sum(number) FROM t_cache_ranges WHERE id >= 2000 AND id < 8000
SETTINGS log_comment = '04068_probe_superset_wider_again';

CREATE TABLE t_cache_string_subcolumns (
    id UInt64,
    s String
) ENGINE = MergeTree
ORDER BY id
SETTINGS min_bytes_for_wide_part = 0, index_granularity = 1000;

SELECT WKT(readWKTPoint('POINT (3 4)'));

ALTER TABLE test_lm_multi ADD COLUMN arr Array(UInt64), ADD COLUMN m Map(String, String) SETTINGS mutations_sync=1;

-- After merge: minmax_count_projection should be used again.
SELECT 'after_optimize';

DROP TABLE t_proj_settings;

INSERT INTO test_idx_settings_cov SELECT number, toString(number % 10) FROM numbers(100);

-- Test columns cache read/write settings validation


DROP TABLE IF EXISTS t_cache_settings;

-- Verify cached
SELECT count(), sum(number) FROM t_cache_settings WHERE id < 1000;

-- Reads disabled
SYSTEM DROP COLUMNS CACHE;

CREATE TABLE t_decimal_minmax (grp String, val Decimal(38, 26)) ENGINE = MergeTree() ORDER BY grp;

INSERT INTO t_exact_count_force_pk SELECT number + 3000, toString(number) FROM numbers(250);

-- Test 7: Extreme adaptive_write_buffer_initial_size on wide parts (STID 0883-4856 path).
-- The adaptive write buffer initial size feeds the first allocation directly; an out-of-range
-- value must be clamped to the buffer maximum (WriteBufferFromFileDescriptor).
CREATE TABLE t_extreme_compress (x UInt64, s String)
    ENGINE = MergeTree() ORDER BY x
    SETTINGS adaptive_write_buffer_initial_size = 9223372036854775807,
             min_columns_to_activate_adaptive_write_buffer = 1,
             min_bytes_for_wide_part = 0;

SELECT grp, ts, val, 'orig' AS orig
FROM t_staleness_prefix
ORDER BY grp, ts ASC WITH FILL STALENESS INTERVAL 2 SECOND INTERPOLATE (val)
SETTINGS max_block_size = 100000, max_threads = 1;

INSERT INTO tab_agg_part VALUES (1, 'x', 5);

SELECT * FROM test_proj_view WHERE name = '42';

-- Read range [2000, 4000) - marks 4-8
SELECT count(), min(CAST(data.name AS String)) FROM t_cache_json WHERE id >= 2000 AND id < 4000;

SYSTEM STOP MERGES test_dia_global_in;

CREATE TABLE t_arr_v0 (a Array(UInt32)) ENGINE = Memory;

INSERT INTO t_map_arr_v0 VALUES ('{\'key\':[1,2,3]}');

SELECT 'SQL-style doubled single quote escape (Array)';

SELECT m FROM t_map_empty_v1;

SELECT m FROM t_map_arr_v1;

DROP TABLE IF EXISTS t_tup_sql_v1;

DROP TABLE IF EXISTS test_jit_decimal128;

DROP TABLE test_jit_nullable_decimal;

SELECT 'Test abs on Decimal types';

DROP TABLE IF EXISTS t_columns_cache;

INSERT INTO t_columns_cache_multi SELECT number + 10000, (number + 10000) * 2 FROM numbers(10000);

SELECT toString(toFloat32(x)) FROM (SELECT arrayJoin([1073741824, 1073741952, 2147483520, -1073741824, -1073741952]) AS x);

DROP TABLE t_in_order_splits;

-- ============================================================================
-- Test 1: Different column types
-- ============================================================================

DROP TABLE IF EXISTS t_cache_types;

-- Read again (should hit cache)
SELECT sum(id), sum(value), count() FROM t_cache_multipart
SETTINGS use_columns_cache = 1, enable_parallel_replicas = 0, log_comment = '04074_multipart_before_merge_2';

DROP TABLE t_cache_prewhere;

-- Repeat
SELECT sum(id), count() FROM t_cache_partitioned
WHERE date >= '2024-01-01' AND date < '2024-02-01'
SETTINGS use_columns_cache = 1;

DROP TABLE t_cache_subquery;

DROP TABLE IF EXISTS t_map_dynamic_cache;

CREATE VIEW v_subcol AS SELECT arr, tup, n, m FROM t_subcol_src;

SET analyzer_inline_views = 0;

SELECT 0.000001;

-- 17 significant digits near boundary
SELECT 1.0000000000000002;

SELECT nan::Float32;

SELECT 42.0::Float64;

-- Check that the outermost view (dv_dashboard) is sent to parallel replicas,
-- not the inner v_dashboard or the base tables.
SELECT '-- plan check: outermost view sent to replicas';

DROP TABLE IF EXISTS t_stats_overflow;

SELECT * FROM tab_mode WHERE s IN ('Alick a01', 'Alick a06') ORDER BY k;

SELECT count() FROM tab_large WHERE hasAllTokens(s, ['token3', 'word3']);

DROP TABLE IF EXISTS tab_dr;

-- posting_list_block_size=128 -> aligned to 128, so each segment holds exactly 128 docs.
-- A token appearing in 50% of 2000 rows -> 1000 docs -> ~8 segments.
-- This exercises multiple Index Sections and the cross-segment iteration in PostingListCursor.

DROP TABLE IF EXISTS tab_multi_seg;

-- Off-by-one: 130 rows = first_doc_id + 129 docs = 1 full block + tail of 1 doc
DROP TABLE IF EXISTS tab_boundary4;

----------------------------------------------------
SELECT 'Test 7: Seek beyond all packed blocks (empty result)';

----------------------------------------------------
SELECT 'Test 11: Raw single-block postings in lazy mode';

-- Two tokens both spanning multiple segments, with identical posting lists.
-- Leapfrog: on every match the lead calls next() and the other cursor advance() to the lead's doc id.
-- Both must cross segment boundaries.
-- Token 'aa' and 'bb' both appear in every row -> all 400 rows match AND.

DROP TABLE IF EXISTS tab_next_leapfrog;

-- both AND partner: same set of rows -> 400 match
SELECT count() FROM tab_three_seg WHERE hasAllTokens(s, ['both', 'partner']);

----------------------------------------------------
SELECT 'Test 11: Brute-force AND (linearAnd) across multiple segments';

INSERT INTO tab_fiveway_seg SELECT number, 'fa fb fc fd fe' FROM numbers(600);

CREATE TABLE tab_stress(k UInt64, s String, INDEX idx s TYPE text(tokenizer = 'splitByNonAlpha', posting_list_block_size = 128))
    ENGINE = MergeTree() ORDER BY k
    SETTINGS index_granularity = 8192, index_granularity_bytes = '10Mi';

DROP TABLE IF EXISTS tab_embed_mix;

SELECT count() FROM (
    (SELECT k FROM tab_eq WHERE hasAllTokens(s, ['red', 'blue']) SETTINGS text_index_posting_list_apply_mode = 'lazy')
    EXCEPT
    (SELECT k FROM tab_eq WHERE hasAllTokens(s, ['red', 'blue']) SETTINGS text_index_posting_list_apply_mode = 'materialize')
);

SELECT count() FROM tab_skip2 WHERE hasAllTokens(s, ['da', 'db']);

-- 'broad' in all 4000 rows (many packed blocks).
-- 'spot' at rows 1999, 2000, 2001 (3 rows in a narrow range, likely embedded).
-- Brute-force: broad.linearOr fills bitmap, spot.linearAnd increments.
-- linearAndImpl for 'broad' processes only blocks near rows 1999-2001.

DROP TABLE IF EXISTS tab_skip7;

DROP TABLE IF EXISTS tab_skip2;

ALTER TABLE tab_codec_persist MODIFY SETTING merge_max_block_size = 17;

-- Test that materialized CTEs with dependencies are executed in correct order.
-- Scalar subqueries referencing materialized CTEs must materialize them first.
-- Before the fix, evaluateScalarSubqueryIfNeeded() executed scalar subquery
-- pipelines during the QueryAnalyzer phase without materializing CTEs,
-- causing: "Logical error: Reading from materialized CTE before materialization"

SET enable_materialized_cte = 1;

SELECT OVERLAY('Hello World' PLACING concat('S', 'QL') FROM 5 + 2 FOR 10 - 5);

INSERT INTO t_ssp_current SELECT
    toDateTime('2026-01-01 00:00:00', 'UTC') + toIntervalHour(number % 360),
    (number % 10) + 1000, number % 50, number % 30,
    number % 100, number % 20
FROM numbers(1000);

INSERT INTO t_vrow_prelim SELECT 3000 + number, randomString(8) FROM numbers(1000);

INSERT INTO t_vrow_prelim SELECT 100000 + number * 115 +  25, randomString(8) FROM numbers(1000);

INSERT INTO t_vrow_prelim SELECT 100000 + number * 115 +  52, randomString(8) FROM numbers(1000);

INSERT INTO t_vrow_prelim SELECT 100000 + number * 115 +  79, randomString(8) FROM numbers(1000);

INSERT INTO t_vrow_prelim SELECT 100000 + number * 115 + 106, randomString(8) FROM numbers(1000);

INSERT INTO t_ttl_overflow VALUES ('2024-01-01', 1), ('2024-06-15', 2), ('2025-12-31', 3);

ALTER TABLE t_ttl_datetime_fns MODIFY TTL ts + INTERVAL 100 YEAR;

DROP TABLE t_ttl_recompress_algo;

-- Case 10: a lambda parameter that shadows a table column must keep its lambda-local
-- type. The TTL expression contains `arrayFilter(day -> day != '', arr)` where the
-- lambda's `day` is a String element of `arr`, not the `Date` column `day`. Because the
-- widening happens at column-type level (not AST rewriting), the analyzer's normal name
-- resolution already binds `day` inside the lambda to the lambda parameter rather than
-- to the outer column, so this case is handled automatically.
DROP TABLE IF EXISTS t_ttl_lambda_shadow;

-- Case 14: a bare `LowCardinality(DateTime)` column as the whole TTL expression
-- (found by AST fuzzer). Analysis widens it to `DateTime64` (dropping `LowCardinality`),
-- so the `CREATE` is accepted, but the runtime block still holds the original
-- `LowCardinality` column and takes the shortcut path in `executeExpressionAndGetColumn`
-- (the result column is present in the block, so the expression does not run). Without
-- a cast to the expression's result type there, the `INSERT` threw a logical error
-- `Unexpected type (LowCardinality(UInt32)) of result TTL column` when computing the
-- part TTL info.
DROP TABLE IF EXISTS t_ttl_lc_bare;

-- 1: second exact
SELECT CAST('33.3', 'Decimal64(1)') IN (CAST('33.33', 'Decimal64(2)'), CAST('33.35', 'Decimal64(2)'));

-- 0: lossy

-- Map: Float64->Decimal
SELECT CAST(map('a', CAST('33.3', 'Decimal64(1)')), 'Map(String, Decimal64(1))') IN (map('a', 33.3));

INSERT INTO t0 SELECT number, arrayMap(x -> (x, arrayMap(y -> (toString(number), number), range(number))), range(number)) FROM numbers(10);

-- Final merge to physical cleanup
OPTIMIZE TABLE t_lwd_cycles FINAL;

SELECT count() = 88 FROM t_lwd_pred;

DROP TABLE t_lwd_rmt_flag SYNC;

CREATE TABLE test_table(repo_name String, event_type String, actor_login String) ENGINE = MergeTree() ORDER BY ();

SELECT if(explain LIKE '%v_diff_mt%', 'v_diff_mt', if(explain LIKE '%t_mt%', 't_mt', 'other'))
FROM viewExplain('EXPLAIN', '', (
    SELECT sum(value) FROM v_diff_mt
    SETTINGS parallel_replicas_local_plan = 1, parallel_replicas_allow_view_over_mergetree = 1
))
WHERE explain LIKE '%ReadFromRemoteParallelReplicas%';

CREATE DICTIONARY dict_04077_nullable
(
    id UInt64,
    start_date Date,
    end_date Nullable(Date),
    value String DEFAULT ''
)
PRIMARY KEY id
SOURCE(CLICKHOUSE(TABLE 'source_04077_nullable'))
LIFETIME(MIN 0 MAX 100)
LAYOUT(RANGE_HASHED())
RANGE(MIN start_date MAX end_date);

SELECT count(_table) FROM t_log WHERE _table = 't_log' GROUP BY _table;

SET grace_hash_join_initial_buckets = 8;

SELECT _table, key, doubled FROM t_log_alias ORDER BY key;

INSERT INTO test_theils_u SELECT theilsUState(toUInt8(number % 10), toUInt8(number % 6)) OVER () FROM numbers(100) LIMIT 1;

-- cramersVBiasCorrectedDistinctIf
DROP TABLE IF EXISTS test_cramers_v_bc_di;

CREATE TABLE test_memory_virt (x UInt64, s String) ENGINE = Memory;

-- Baseline correctness tests for sort key encoding

SELECT '-- Signed integers';

SELECT x FROM (SELECT arrayJoin([toLowCardinality(toNullable(toUInt64(0))), toLowCardinality(toNullable(toUInt64(1))), toLowCardinality(toNullable(toUInt64(18446744073709551615))), CAST(NULL AS LowCardinality(Nullable(UInt64)))]) AS x) ORDER BY x ASC;

DROP TABLE t_lc_variant_null;

DROP WORKLOAD IF EXISTS 04082_all;

-- argMinIf/argMaxIf with Decimal32 (exercises getSmallestIndexNotNullIf)
SELECT 'Decimal32 argMinIf/argMaxIf';

DROP TABLE test_index_of_assume_sorted_lc;

CREATE TABLE test_date_time64 (d Date, t Time64(3)) ENGINE = Memory;

DROP TABLE test_cv2;

-- Near DateTime max boundary
SELECT toDate('2106-02-07') + toTime('00:00:00');

SELECT toDate32('2024-01-15') + toTime64('25:70:70.123456', 6);

-- Verify underlying millisecond timestamp differs under New York timezone
SELECT toUnixTimestamp64Milli(toDate('2024-01-15') + toTime64('00:00:00.123', 3)) AS ts64_ny;

CREATE TABLE test_overflow_int64 (d Date32, t Time64(9)) ENGINE = Memory;

SELECT name, type FROM system.columns
WHERE table = 'iceberg_metadata_log' AND database = 'system' AND name = 'hostname';

DROP TABLE IF EXISTS t_geometry_cast_custom_type_name;

SELECT areaCartesian(CAST([[(0., 0.), (0., 5.), (5., 5.), (5., 0.)]], 'MultiLineString')::Geometry);

CREATE MATERIALIZED VIEW mv TO mt AS
  SELECT foo.a AS a FROM users;

print '-- Project_ColumnizesScalar --';

_dt | summarize v=countif(a);

print '-- BuiltInAggregates_make_list_if_int --';

input | distinct *;

print v=strcat('a');

print '-- BuiltIns_url_encode_component_Columnar --';

CREATE TABLE _dt (x Nullable(Float64), y Nullable(Float64)) ENGINE = Memory;

print '-- BuiltIns_StartOfYear_EndOfYear --';

print a=2*1, b=4*3.5, c=6.5*5, d=8.0*7.5;

print '-- BinOp_LogicalOr --';

_dt | summarize v=100 * count();

INSERT INTO _dt VALUES (1), (0);

DROP TABLE t_text_index_like_large;

-- Complementary halves must be disjoint.
SELECT count() FROM (
    SELECT id FROM 04092_view_sampled SAMPLE 1/2 OFFSET 0
    INTERSECT
    SELECT id FROM 04092_view_sampled SAMPLE 1/2 OFFSET 1/2
);

-- View as the right (joined) side: previously raised NOT_FOUND_COLUMN_IN_BLOCK.
SELECT 04092_join_local.id, v.id
FROM 04092_join_local LEFT JOIN 04092_view_replacing AS v ON 04092_join_local.id = v.id
ORDER BY v.id;

SYSTEM STOP MERGES t_ttl_sparse_col;

SYSTEM STOP MERGES t_ttl_sparse_expr_col;

-- Now query with join_use_nulls=0.  The inner LEFT JOIN produces
-- b as UInt32, but the propagated filter expects Nullable(UInt32).
-- Before the fix this was a SIGSEGV.
SET join_use_nulls = 0;

DROP TABLE t_case_dyn;

print '-- AdditionalFunctionTests::PowFunction_Scalar --';

print '-- AdditionalFunctionTests::IsNotEmptyFunction_Scalar --';

print result = coalesce(int(null), 42);

print '-- DateTimeTests::ToDateTime3 --';

print '-- SimpleFunctionTests::GeoPointToGeoHashScalarWithDefault --';

-- [removed in the KQL rewrite] Syntax error in KQL query at position 41: 'row_number' is not supported by the KQL dialect, found 'row_number'
-- range i from 1 to 10 step 1 | extend r =row_number();
print '-- SimpleFunctionTests::RowNumberStartingAt7 --';

print round(3.14,1);

-- [removed in the KQL rewrite] Received exception from server (version 26.8.1):
-- print make_timespan(1,15);
print '-- SimpleFunctionTests::MakeTimespan2 --';

-- FIXME: decimal multiplication overflows scale (68 > max 38)
-- print result = decimal(1.5) * decimal(2.0);
print '-- SimpleFunctionTests::DecimalDivision --';

-- Local: missing column b in t2 gets the type default (0).
SELECT a, b FROM merge(currentDatabase(), 't[12]') ORDER BY a;

SELECT dateTrunc('month', dt) FROM test_lc_interval ORDER BY dt;

-- transform: LowCardinality first argument
SELECT 'transform with LC';

SELECT count() FROM t_text_index_like_overflow WHERE message LIKE '%pa%' SETTINGS use_skip_indexes = 0;

SELECT formatQuery('SELECT `VALUES`(1, 2)');

SELECT JSONExtract('{"t": 0}', 't', 'Time');

DROP TABLE IF EXISTS StateCapitals;

StormEvents
| project Id = EventId, DamagePropertyK = DamageProperty / 1000;

print '-- pql::WhereCaseInsensitiveNE --';

-- Correctness with is_deleted.
DROP TABLE t_lazy_mat_final;

SELECT printf(materialize('%s'), 'hello');

-- Projection with `WITH` clause must not produce wrong results.
-- The implication check must be conservative when the projection has a `WITH` clause,
-- because an identifier in projection `WHERE` can reference a CTE/alias that has a
-- different meaning than a same-named table column referenced in the query's `WHERE`.
SELECT 'Projection with WITH clause';

INSERT INTO t_proj_agg_where VALUES (1, 10), (1, 20), (2, 100), (2, 200), (3, 1000);

-- https://github.com/ClickHouse/ClickHouse/issues/102051
-- sz_find_skylake OOB read when needle is all null bytes

-- n_length <= 3: tail returns OOB pointer without validation
SELECT countSubstrings(toString(number), '\0\0') FROM numbers(100) WHERE countSubstrings(toString(number), '\0\0') != 0;

DROP TABLE 04095_keys;

DROP TABLE IF EXISTS t_index_subcolumn;

CREATE TABLE dist_orders (
    order_id UInt64,
    customer String
) ENGINE = MergeTree ORDER BY order_id
  SETTINGS index_granularity = 8192, auto_statistics_types = '';

SELECT count()
FROM dist_orders FULL JOIN dist_items ON dist_orders.order_id = dist_items.order_id
SETTINGS make_distributed_plan = 0;

CREATE TABLE dist_trades (symbol String, ts DateTime, price Decimal(10, 2))
ENGINE = MergeTree ORDER BY (symbol, ts)
SETTINGS index_granularity = 8192, auto_statistics_types = '';

-- Compare SelectedMarks for PREWHERE vs WHERE directly. Both queries read the
-- same parts with the same granularity, so primary key analysis must select
-- the same granules for both. This is robust under CI randomization of
-- index_granularity / max_insert_threads / min_bytes_for_wide_part.
--
-- Without the fix, PREWHERE reads every granule (hundreds of marks) while WHERE
-- prunes down to the granules covering id=1, so prewhere_marks >> where_marks.
WITH
    (
        SELECT ProfileEvents['SelectedMarks']
        FROM system.query_log
        WHERE type = 'QueryFinish'
            AND current_database = currentDatabase()
            AND event_date >= yesterday()
            AND event_time >= (SELECT ts FROM start_ts)
            AND log_comment = '04097_where'
        ORDER BY event_time_microseconds DESC
        LIMIT 1
    ) AS where_marks,
    (
        SELECT ProfileEvents['SelectedMarks']
        FROM system.query_log
        WHERE type = 'QueryFinish'
            AND current_database = currentDatabase()
            AND event_date >= yesterday()
            AND event_time >= (SELECT ts FROM start_ts)
            AND log_comment = '04097_prewhere'
        ORDER BY event_time_microseconds DESC
        LIMIT 1
    ) AS prewhere_marks
SELECT if(prewhere_marks <= where_marks,
          'ok',
          format('error: PREWHERE selected {} marks, WHERE selected {} marks',
                 toString(prewhere_marks), toString(where_marks)));

CREATE TABLE t_nullable_tuple_desc_compact
(
    key UInt64,
    tup Nullable(Tuple(`a.b` Nullable(String), s Nullable(String), u UInt64))
)
ENGINE = MergeTree
ORDER BY key
SETTINGS min_bytes_for_wide_part = 1000000000;

DROP TABLE IF EXISTS t_row_policy_or;

-- A row policy on the view suppresses the trivial-view pushdown. Row policies must
-- be enforced in the view-output namespace, which the canonical StorageView::readImpl
-- path does correctly; the pushdown would inline the body and could bind the policy
-- to a source column instead of the view alias (e.g. `SELECT val * 2 AS v` with
-- policy on `v` under prefer_column_name_to_alias = 1), so whenever a view-level
-- policy applies we fall back to readImpl. This test asserts both that the pushdown
-- is suppressed (plan keeps the "VIEW subquery" steps) and that the result is
-- correct, identical with the setting on and off.
--
-- A row policy directly on the underlying Distributed table is a separate case,
-- unrelated to this pushdown: such a policy is now rejected outright with
-- ILLEGAL_PREWHERE (a Distributed table only ships the query text to the remote
-- servers, so the filter can never be applied there), regardless of whether the
-- read goes through a view at all.
--


-- Pin the legacy EXPLAIN plan format: the pushdown checks below grep for the
-- "Convert VIEW subquery result to VIEW table structure" step, which the default
-- 'pretty' EXPLAIN format (explain_query_plan_default) does not print.
SET explain_query_plan_default = 'legacy';

-- View in a join: the pushdown is suppressed (it only fires for a sole table
-- expression), so the view falls back to the standard path. The view policy
-- (id != 2) must still be enforced — the joined local row id=2 finds no matching
-- view row and is null-extended (val = 0). Result must not depend on the setting.
CREATE TABLE 04098_join_local (id UInt32) ENGINE = MergeTree ORDER BY id;

SELECT map() <=> NULL;

SELECT arraySort(groupArray(if(isNull(d), 'NULL', toString(d)))) FROM test WHERE d = '1970-01-01';

CREATE TABLE test_distinct_proj_partial_projection
(
    a UInt32,
    b UInt32
)
ENGINE = MergeTree ORDER BY tuple();

CREATE ROW POLICY 04099_p_true ON t_row_policy_limit USING 1 AS permissive TO ALL;

-- valid quoted Time64 CSV values work
SELECT * FROM format(CSV, 'c1 Time64(3)', '"12:30:00.123"');

SELECT count() FROM bf_lc_scalar WHERE s IN ('v1', 'v4') SETTINGS force_data_skipping_indices = 'idx_s';

SELECT count() FROM bf_lc_big_dict WHERE s = 'nope' SETTINGS force_data_skipping_indices = 'idx_s';

INSERT INTO test_cache_thread_pool SELECT number, toString(number) FROM numbers(10);

-- Test: ANY RIGHT JOIN with multiple OR conditions (disjuncts) produces wrong results
-- when query_plan_join_swap_table=0 forces the RIGHT join path.

DROP TABLE IF EXISTS t1_04101;

EXPLAIN SYNTAX run_query_tree_passes = 1
SELECT x FROM (SELECT arrayJoin([0::Int64, 1::Int64, 256::Int64, 257::Int64]) AS x) WHERE (x OR x) AND x ORDER BY x;

INSERT INTO test_typed_json VALUES ('{"a1":[{"x":42}], "a2":[{"x":42}]}');

CREATE TABLE test_variant_oom3 (v Variant(Int64, UInt64, Float64)) ENGINE = Memory;

SELECT 'plan: filter reading the argument — lengthUTF8 not pushed';

SELECT 'plan: wide FixedString lengthUTF8 — pushed';

SELECT 'plan: mixed roots keep only volume-reducing functions below sort';

SELECT *
FROM (
    SELECT length(s) FROM (SELECT DISTINCT s FROM volume_reducing_function_push_down)
    SETTINGS query_plan_push_down_volume_reducing_functions = 0, optimize_functions_to_subcolumns = 0
)
EXCEPT ALL
SELECT *
FROM (
    SELECT length(s) FROM (SELECT DISTINCT s FROM volume_reducing_function_push_down)
    SETTINGS query_plan_push_down_volume_reducing_functions = 1, optimize_functions_to_subcolumns = 0
);

DROP TABLE IF EXISTS t_left_asof;

CREATE TABLE t_right_large (id UInt64, val UInt64) ENGINE = MergeTree() ORDER BY id;

SELECT l.id, l.val, r.val FROM t_left_nullable l LEFT JOIN t_right_nullable r ON l.id = r.id ORDER BY l.id, l.val;

SELECT '--- FULL JOIN: with ON condition (join_mask AllFalse) ---';

SELECT '--- ALL RIGHT JOIN: single key with duplicates ---';

SELECT r.id, r.val FROM t_left l RIGHT SEMI JOIN t_right r ON l.id = r.id AND 1 = 0 ORDER BY r.id;

-- ============================================================
-- 10. ASOF JOIN variants
-- ============================================================

SELECT '--- ASOF LEFT JOIN: single key ---';

SELECT l.id, l.val FROM t_left_nullable l LEFT ANTI JOIN t_right_nullable r ON l.id = r.id AND r.id >= 5 ORDER BY l.id, l.val;

INSERT INTO t_left_dup VALUES (1, 'L1a'), (1, 'L1b'), (2, 'L2a'), (2, 'L2b'), (3, 'L3');

-- ============================================================
-- 16. LowCardinality keys
-- ============================================================

DROP TABLE IF EXISTS t_left_lc;

SELECT l.val, r.a, r.b, r.val FROM t_left_or l ALL RIGHT JOIN t_right_or r ON l.a = r.a OR l.b = r.b ORDER BY r.a, r.b, l.val;

DROP TABLE t_left_large;

SELECT 'v2-simple-check', count() FROM t_v2_simple WHERE payload = id AND id % 100 != 0;

CREATE TABLE dedup_alias_target (id UInt32)
ENGINE = MergeTree
ORDER BY id
SETTINGS non_replicated_deduplication_window = 1000;

SELECT groupArray(id) FROM tab_array WHERE hasAny(arr, ['foo']) ORDER BY ALL;

CREATE TABLE tab_fallback
(
    id UInt32,
    arr_array Array(Nullable(String)),
    arr_split Array(Nullable(String)),
    INDEX idx_array(arr_array) TYPE text(tokenizer = 'array'),
    INDEX idx_split(arr_split) TYPE text(tokenizer = 'splitByNonAlpha')
)
ENGINE = MergeTree
ORDER BY id
SETTINGS index_granularity = 1;

SELECT CAST('not_a_date' AS Nullable(DateTime)) SETTINGS cast_string_to_date_time_mode = 'best_effort_us';

SELECT count() FROM t_v2_parallel_sort_check;

-- Nullable(UInt16) with N = 256 — the core of the bug.
SELECT count() FROM bug_103049 WHERE (c != '') AND toNullable(256);

DROP TABLE t_left_04104;

SELECT a, b, dist FROM t_l2_distance_materialized ORDER BY dist;

INSERT INTO t_least_greatest_default (x, y) VALUES (3, 5);

INSERT INTO t_v2_eager_discard SELECT number FROM numbers(400000,   200000);

SELECT DISTINCT trim(BOTH ' ' FROM explain) FROM (EXPLAIN PIPELINE SELECT g, x FROM test ORDER BY g, x LIMIT 2 OFFSET -3 BY g) WHERE explain ILIKE '%NegativeLimitBy%' OR explain ILIKE '%LimitBy%Transform%';

-- A response without a Last-Modified header must yield NULL.
-- ClickHouse's own HTTP query endpoint does not set Last-Modified.
SELECT _time
FROM url('http://127.0.0.1:8123/?query=select+1&user=default', LineAsString, 's String');

SELECT arrayBottomK(2, ['alpha', 'beta', 'gamma', 'delta']);

SELECT toTypeName(arrayTopK(3, ['alpha', NULL, 'beta']::Array(LowCardinality(Nullable(String)))));

-- Basic parameterized view expansion.
EXPLAIN SYNTAX SELECT * FROM 04105_pv(n = 15);

EXPLAIN SYNTAX SELECT * FROM 04105_pv_security_definer(n = 1);

INSERT INTO t_lazy_log SELECT number, 1, if(number < 50, 1, 0), 'x' FROM numbers(1000);

-- A sort above `UNION ALL` can receive the per-stream `LIMIT BY` hint.
EXPLAIN PIPELINE
SELECT k, v FROM (
    SELECT number % 100 AS k, number AS v FROM numbers_mt(1000000)
    UNION ALL
    SELECT number % 100 AS k, number AS v FROM numbers_mt(1000000)
)
ORDER BY k, v LIMIT 2, 3 BY k;

DROP TABLE IF EXISTS uk_dedup_part;

-- 0 new_oldest / 4 new_4 / 9 new_9

-- 3. one INSERT, many parts: red if the probe reads the parts at the block's transaction
-- snapshot, missing the earlier blocks of its own INSERT (a debug server aborts on two live copies).
-- 2400 rows in 400-row blocks, one thread; `many_parts_made` proves several parts were made.
SET max_threads = 1;

DROP TABLE IF EXISTS test_join_a;

WITH range(8)::Array(Float64) AS a
SELECT round(pow(L2Distance(a, materialize(arrayMap(x -> x + 1, range(8))::Array(Float64))), 2));

INSERT INTO t_right_nullable
    SELECT if(number % 5 = 0, NULL, toUInt64(number)) AS k, concat('r', toString(number)) AS v
    FROM numbers(25);

SELECT log_comment, ProfileEvents['HashJoinBuiltWithSerialLayout'] AS serial, ProfileEvents['HashJoinBuiltWithParallelLayout'] AS parallel
FROM system.query_log
WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND is_initial_query
    AND log_comment IN ('04107_inner', '04107_inner_reverse', '04107_left', '04107_left_reverse',
        '04107_right', '04107_right_reverse', '04107_full', '04107_full_reverse',
        '04107_asof_left_serial', '04107_asof_left_parallel')
ORDER BY event_time_microseconds;

SELECT JSONHas('{"k":1}', 'k'), JSONHas(CAST('{"k":1}', 'JSON'), 'k');

SELECT 'nested lambdas: WHERE';

SELECT ProfileEvents['ParquetMetadataCacheHits'], ProfileEvents['ParquetMetadataCacheMisses']
    FROM system.query_log
    WHERE current_database = currentDatabase() AND type = 'QueryFinish' AND log_comment = '04108-q2';

DROP TABLE t_jsonextractbool_native;

INSERT INTO t_todate32_mono SELECT number + 2900000 FROM numbers(50000);

SELECT tupleToNameValuePairs(CAST(('a', 'b') AS Nullable(Tuple(a LowCardinality(String), b LowCardinality(String))))) AS pairs, toTypeName(pairs);

-- Non-constant lambda exercises the `column_fill` branch for completeness.
SELECT id, arrayReverseFill(x -> x != 'a', a) FROM t_array_fill_empty_strings ORDER BY id;

SELECT 'best_effort micro:', toDateTime64('1776858622333666', 6);

-- vector start, const duration (vectorConstant)
SELECT timeSlots(
    materialize(toDateTime('2020-01-01 00:00:00', 'UTC')) + number * 60,
    600::UInt32,
    300
) FROM numbers(3);

SELECT '--- three arguments (trace, size, ptr): alloc/dealloc pairing ---';

SELECT count() FROM tab_one WHERE coalesce(a, b) = 42;

-- With the rewrite disabled, there must be no skip-index pruning on coalesce.
SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1
    SELECT count() FROM tab3 WHERE coalesce(a, b, c) = 42
    SETTINGS allow_key_condition_coalesce_rewrite = 0
) WHERE explain ILIKE '%Granules:%' OR explain ILIKE '%Skip%' OR explain ILIKE '%Name:%';

SELECT count() FROM tab3 WHERE (coalesce(a, b, c) IS NULL);

-- With the rewrite: `(a = 42) OR (isNull(a) AND (42 = 42))` collapses to `a = 42 OR a IS NULL`.
-- The `b` column is unreachable and its skip index must not be consulted.
SELECT trimLeft(explain) FROM (
    EXPLAIN indexes = 1
    SELECT count() FROM tab WHERE coalesce(a, 42, b) = 42
) WHERE explain ILIKE '%Granules:%' OR explain ILIKE '%Skip%' OR explain ILIKE '%Name:%';

SELECT count() FROM tab WHERE coalesce(a, b, 0) = 0;

-- Variable-width '%W'
SELECT formatDateTime(toDateTime('2024-05-07 08:09:10', 'UTC'), '[%W]');

-- Numerical correctness: multiplying the state by N should produce N*size
-- elements; sum-aggregating them gives N * sum([0..49]) = N * 1225.
SELECT sum(arrayJoin(finalizeAggregation(state * 4)))
FROM (SELECT groupArrayState(number) AS state FROM numbers(50));

CREATE TABLE s1 (id UInt64) ENGINE = MergeTree ORDER BY id;

SELECT 'RIGHT JOIN USING, Int32 / Int64 keys widened to Int64: result';

INSERT INTO inner_d       SELECT toDate('2020-01-01')   + number FROM numbers(40000);

SELECT 'INNER JOIN ON, conjunct whose lambda body holds per-query state beside the equi-key: the conjunct is not pushed';

INSERT INTO inner_aj_narrow SELECT number FROM numbers(10);

CREATE TABLE inner_dyn     (a Dynamic) ENGINE = MergeTree ORDER BY tuple();

DROP TABLE IF EXISTS inner_str_probe;

SELECT count() FROM t_lwd_nonadaptive_partial WHERE c0 < 50;

EXPLAIN SYNTAX SYSTEM DROP DISTRIBUTED CACHE 'server_1' ON CLUSTER cluster;

EXPLAIN SYNTAX SYSTEM STOP REPLICATED DDL QUERIES;

EXPLAIN SYNTAX SYSTEM SYNC FILE CACHE;

EXPLAIN SYNTAX SYSTEM STOP LISTEN TCP;

SELECT formatQuery('SNAPSHOT TABLE db.tbl TO S3(\'s3://bucket/snap/\')');

SELECT formatQuery('SNAPSHOT TABLE TO S3(\'s3://b/\')');

SELECT '--- mysqlDayOfWeek: %w ---';

SELECT isNull(parseDateTime64OrNull('2024-11-0: 10:00:00', '%Y-%m-%d %H:%i:%s', 'UTC'));

SELECT parseDateTime64InJodaSyntax('2023-01-02 03:04:05.123456', 'yyyy-MM-dd HH:mm:ss.SSSSSS');

SELECT '--- BoolNode ---';

SELECT '--- DateNode / DateTimeNode / DateTime64Node ---';

SELECT JSONExtract('{"x": "not-a-number"}', 'x', 'Nullable(Int32)');

SELECT JSONExtract('{"x": "hi"}', 'x', 'Dynamic');

SELECT CAST('00:00:00.000' AS Time64(3));

SELECT '--- Prewritten and reparsed via formatRow round-trip ---';

print '--- !contains_cs ---';

kql_op_t | where x has_any('hello', 'foo') | project x | sort by x asc;

EXPLAIN SYNTAX SYSTEM WAIT FAILPOINT fp;

EXPLAIN SYNTAX SYSTEM START LISTEN POSTGRESQL;

SELECT arrayLevenshteinDistanceWeighted([1, 2, 3], [1, 2, 4], [1, 1, 1]::Array(UInt8), [1, 1, 1]::Array(UInt8));

SELECT '--- MODIFY COMMENT ---';

SELECT formatQuery('ALTER TABLE db.t FREEZE PARTITION 1 WITH NAME ''snap''');

SELECT '--- STATISTICS ALL: no IF EXISTS clause exists for this form ---';

SELECT bitmapToArray(bitmapBuild([1, 2, 3]::Array(Int64)));

SELECT bitmapToArray(bitmapTransform(bitmapBuild([1,2,3]::Array(UInt64)), [1,2]::Array(UInt64), [100,200]::Array(UInt64)));

SELECT sequenceNextNode('forward', 'first_match')(ts, e, true, e='A', e='B')
FROM (SELECT toDateTime('2020-01-01') AS ts, 'A' AS e WHERE 0);

SELECT distinctJSONPathsAndTypes(CAST('{}', 'JSON'));

DROP TABLE IF EXISTS variant_mt;

SELECT value FROM prometheusQuery('ts', '10 / 4', 1000);

SELECT count() FROM prometheusQuery('ts', 'rate(up[1h])', 1000);

SELECT count() FROM prometheusQuery('ts', 'up / ignoring ("cluster.name") group_right ("instance.name") target_info', 1000);

SELECT v FROM sparse_ops ORDER BY v ASC LIMIT 5;

SELECT groupArrayLast(3)(x) FROM (SELECT number AS x FROM numbers(10));

SELECT '--- merge: GROUP BY partitions ---';

SELECT p, argMin(val, key), argMax(val, key), min(val), max(val) FROM (
    SELECT 1 AS p, (1, 'a') AS val, 10 AS key
    UNION ALL SELECT 1, (2, 'b'), 5
    UNION ALL SELECT 2, (3, 'c'), 8
    UNION ALL SELECT 2, (4, 'd'), 1)
GROUP BY p ORDER BY p;

SELECT '--- row_number / rank / dense_rank / percent_rank / cume_dist ---';

SELECT '--- toDecimal32 / OrZero / OrNull ---';

SELECT toUUIDOrDefault('bad', toUUID('11111111-1111-1111-1111-111111111111'));

SELECT CAST('1.5', 'Decimal(10, 2)');

SELECT '--- arrayFirst / arrayLast / arrayFirstIndex / arrayLastIndex ---';

SELECT '--- arrayFilter in WHERE ---';

SELECT '--- argMinState / argMaxState -> -Merge ---';

-- The fold-from-constants form `divide(divide(0, c), a)` collapses to `divide(0, a)` and must
-- still be safe.
SELECT count() FROM t_divide_zero_mono WHERE (divide(divide(isNull(-2), assumeNotNull(7)), a), b)
    NOT IN ((9223372036854775806, '0.500000'), (2147483646, 'y'));

-- 2. Declaration order does not matter: float still wins for fractional values.
SELECT 'declaration_order_does_not_matter';

-- 15. Closes #103617: original reproducer from the issue.
SELECT 'closes_103617';

-- Case 3: missing table in an explicit, existing database — already worked.
SELECT 'case3';

-- Lambda argument names that require backquoting (contain whitespace, or clash
-- with SQL keywords) must produce identical column names on the AST and DAG
-- sides, so index matching keeps working.
DROP TABLE IF EXISTS t_quoted_lambda;

-- Test coverage for ExecutableSettings::loadFromQuery() and related methods.
-- CREATE TABLE with a SETTINGS clause calls loadFromQuery(), which was previously uncovered.
-- No actual script execution is needed: the file existence check is deferred to SELECT time.

DROP TABLE IF EXISTS t_exec_settings;

WITH materialize(1::Decimal(38, 7)) AS r, materialize(1) AS k SELECT sum(if(k != 1, r, 1));

SELECT '--- filter on aggregate value ---';

SELECT number FROM numbers(5) WHERE tuple(number, number) NOT IN (tuple(1, 2)) ORDER BY number;

-- Argument 2 = String (not UInt8) -> ILLEGAL_COLUMN. Reaches the second checkAndGetColumn after `convertToFullColumnIfConst`.
SELECT h3PolygonToCells([(1.0, 2.0), (3.0, 4.0), (5.0, 6.0)], 'abc');

-- 2. SELECT * over a self-join with overlapping column names.

CREATE TABLE t_74324_join (id Int8, name String, value Int64) ENGINE = MergeTree ORDER BY id;

-- ROLLUP / CUBE / WITH TOTALS share the non-GROUPING SETS branch (line 253),
-- which is already covered, but verify const-ness end-to-end for these
-- query shapes too — they did not appear with `dumpColumnStructure` in the suite.
SELECT dumpColumnStructure('x') GROUP BY ROLLUP ('x');

-- Valid ratio: small in-memory join still produces the expected count.
SELECT count() FROM numbers(100) AS t1 INNER JOIN numbers(100) AS t2 ON t1.number = t2.number SETTINGS max_bytes_ratio_before_external_join = 0.5;

-- The default must preserve insertion order, unlike an explicitly enabled setting.
SELECT 'default != explicit_on';

-- Same query inside `obfuscateQuery` (random seed) is non-deterministic but should still preserve known names.
SELECT countIf(s LIKE '%count%') = count() AS keep_count_random
FROM (SELECT obfuscateQuery('SELECT count(*) FROM t') AS s FROM numbers(5));

SELECT lower(materialize(if(number % 4 = 0, 'HELLO', NULL)::Nullable(String)))
FROM numbers(8) ORDER BY number
SETTINGS short_circuit_function_evaluation_for_nulls = 1, short_circuit_function_evaluation_for_nulls_threshold = 0.5;

SELECT count() FROM system.tables WHERE name = 'ts_attach_test' AND database = currentDatabase();

SELECT tuple('a', 42)::Tuple(String, LowCardinality(UInt64));

-- `enable_block_number_column = 1, enable_block_offset_column = 1` should be both to enable min-max
CREATE TABLE t (id UInt64) ENGINE = MergeTree ORDER BY id
SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1, part_minmax_index_columns = 'with_block_number_offset';

SELECT val FROM t_float32_key WHERE val > toFloat64(1.5) ORDER BY val;

INSERT INTO t_mt SELECT number, 0 FROM numbers(3);

CREATE TABLE t_l (id UInt32) ENGINE = MergeTree ORDER BY id;

CREATE TABLE t_gen_map (m Map(String, UInt32)) ENGINE = GenerateRandom(42, 4, 4);

CREATE TABLE dst_g4 (a UInt64) ENGINE = MergeTree ORDER BY a
SETTINGS index_granularity = 4, index_granularity_bytes = 0, enable_mixed_granularity_parts = 0;

DROP TABLE src_adaptive_g4 SYNC;

-- REMOVE TTL is allowed — a distinct AlterCommand type that only clears the expression.
ALTER TABLE uk_ttl_attach REMOVE TTL;

SELECT x, x.null FROM t_null_sub_evolved ORDER BY id;

SELECT count(x) FROM t_null_sub_mem SETTINGS optimize_functions_to_subcolumns = 1;

ALTER TABLE t_null_sub_renamed RENAME COLUMN y TO x SETTINGS mutations_sync = 0, alter_sync = 0;

-- no-fasttest: the JSON case needs the JSON type.
-- no-random-merge-tree-settings: every case pins index_granularity so the granule counts are stable.
-- no-parallel-replicas: EXPLAIN output differs for parallel replicas (an extra per-node Granules
-- block), and use_skip_indexes_on_data_read is not supported with parallel replicas.
-- Cases 11-29 of this series live in 04869_skip_index_stale_type_absent_column,
-- 04870_skip_index_stale_type_metadata_only_alter and 04871_skip_index_stale_type_subcolumns: one
-- test exceeded the flaky-check runtime limit under sanitizers, so it is split, keeping the original
-- case numbering.

SET mutations_sync = 0, alter_sync = 0;

INSERT INTO t_stale_json_killed SELECT number, toJSONString(map('a', toString(number * 3))) FROM numbers(64);

-- max_rows_to_read must be neutralized per statement wherever use_skip_indexes_on_data_read = 1
-- matters: supportsSkipIndexesOnDataRead() refuses the read-time path when read_overflow_mode is
-- 'throw' and max_rows_to_read is set, which the stateless test profile always does, so without
-- this the read-time case is vacuous.
SELECT count() FROM t_stale_minmax WHERE value = 150
SETTINGS use_skip_indexes_on_data_read = 1, max_rows_to_read = 0;

SELECT k FROM t_keep_plain ORDER BY value DESC LIMIT 1
SETTINGS use_skip_indexes_for_top_k = 1, use_top_k_dynamic_filtering = 1,
         query_plan_max_limit_for_top_k_optimization = 100000;

INSERT INTO uk_ig VALUES (1, 'a'), (2, 'b');

SET insert_deduplication_token = 'B';

SELECT toTypeName(a), a FROM t_time64_target_6 ORDER BY a;

CREATE TABLE t1_04201 (x Int32) ENGINE = MergeTree ORDER BY x;

SELECT arrayShiftLeft([1::Nullable(Int64), 2, 3], 2, NULL::Nullable(Int64));

DROP TABLE t_nullable_findkey;

SELECT 'case 1 legacy planner';

SELECT trim(explain)
FROM (
    EXPLAIN actions = 1
    SELECT * FROM (SELECT k AS key FROM t_uint32) AS t
    LEFT JOIN rdb_pk_type USING (key)
    SETTINGS query_plan_use_new_logical_join_step = 0
)
WHERE explain LIKE '%Algorithm:%';

INSERT INTO source_complex VALUES (1, 'k', 'a'), (2, 'k', 'b');

DROP TABLE IF EXISTS ref_complex_str;

CREATE TABLE data_int (id Int32) ENGINE = MergeTree ORDER BY id;

SELECT count() FROM data_str WHERE dictGet('dict_string', 'name', id) LIKE '%'
SETTINGS optimize_inverse_dictionary_lookup = 1;

CREATE TABLE data_complex_nullable_dict_key (k1 Nullable(UInt64), k2 String) ENGINE = MergeTree ORDER BY tuple();

EXPLAIN SYNTAX run_query_tree_passes=1 SELECT id FROM data_ops WHERE dictGetString('dict_ops', 'name', id) != 'zzz' ORDER BY id
SETTINGS optimize_inverse_dictionary_lookup = 1;

CREATE DICTIONARY dict_complex (k1 UInt64, k2 String, name String) PRIMARY KEY k1, k2 SOURCE(CLICKHOUSE(TABLE 'ref_layouts_complex')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);

SELECT 'rewrite: greater than non-default, opt off';

EXPLAIN SYNTAX run_query_tree_passes=1 SELECT count() FROM data_str_nullable WHERE dictGetString('dict_string', 'name', id) = 'abc'
SETTINGS optimize_inverse_dictionary_lookup = 1;

SELECT groupArray(id) FROM data_set_limit WHERE dictGetString('dict_set_limit', 'name', id) = 'hit'
SETTINGS optimize_inverse_dictionary_lookup = 1, max_rows_in_set = 1, set_overflow_mode = 'break';

DROP TABLE ref_layouts_simple;

SELECT isProbablePrime(toUInt128('340282366920938463463374607431768211297'));

CREATE TABLE large_probe (x Int32) ENGINE = MergeTree ORDER BY x;

-- Test: exercises `tryParsePartName` LEGACY_MAX_LEVEL replacement branch
-- Covers: src/Storages/MergeTree/MergeTreePartInfo.cpp:133-141 — the
--   `if (level == LEGACY_MAX_LEVEL)` branch where `use_legacy_max_level=true`
--   is set and the level is normalized to MAX_LEVEL (999999999) so `contains`
--   and comparison operators behave correctly with such virtual parts.
-- Risk if broken: parts with the legacy max level (4294967295) would no longer
--   normalize to MAX_LEVEL, breaking `contains` checks for REPLACE/MOVE PARTITION
--   virtual drop-range parts created on/before 21.6.

-- Parsed level is normalized from LEGACY_MAX_LEVEL (4294967295) to MAX_LEVEL (999999999).
SELECT mergeTreePartInfo('all_0_5_4294967295').level;

SELECT * FROM t_read_in_order_limit ORDER BY Id ASC LIMIT 101
FORMAT Null SETTINGS log_comment = 'test_04201_no_filter_vrow', read_in_order_use_virtual_row = 1;

-- Cross-check: result must equal the manual coalesce-to-OR expansion to confirm semantic equivalence.
SELECT count() FROM t_stid_3760
WHERE
       (a = 42)
    OR (a IS NULL AND b = 42)
    OR (a IS NULL AND b IS NULL AND c = 42)
    OR (a IS NULL AND b IS NULL AND c IS NULL AND
        ((a = 42)
      OR (a IS NULL AND b = 42)
      OR (a IS NULL AND b IS NULL AND c = 42)
      OR (a IS NULL AND b IS NULL AND c IS NULL AND d = 42)))
SETTINGS
    use_skip_indexes_on_data_read = 0,
    use_skip_indexes = 1,
    use_skip_indexes_for_disjunctions = 1,
    use_query_condition_cache = 0;

CREATE TABLE prometheus ENGINE = TimeSeries;

-- Filter targets a DIFFERENT table only: trivial-count must still fire.
-- Without the fix the optimization was disabled whenever any
-- additional_table_filters entry was present.
SELECT 'filter_other_table';

SELECT number, number GLOBAL IN (2, 4, 6) AS g, number IN (3) AS one, number IN [1, 3, 5] AS arr
FROM numbers(8) ORDER BY number SETTINGS enable_identifier_resolve_cache = 1;

SYSTEM STOP MERGES pruning_data;

-- Test: exercises multi-row LineString paths added by PR #62519
-- Covers ColumnToLineStringsConverter::convert offset slicing (geometryConverters.h:103-108)
-- and LineStringSerializer::add cumulative offsets (geometryConverters.h:255-261).
-- The PR's own test 03164_linestring_geometry.sql only tests single-row LineString.

-- Multi-row readWKTLineString → wkt round-trip.
-- Each row has a different number of points, so cumulative offsets must be
-- correct in BOTH the serializer (build) and converter (read) directions.
SELECT wkt(readWKTLineString(s)) AS w FROM (
    SELECT 'LINESTRING (1 1, 2 2)' AS s
    UNION ALL SELECT 'LINESTRING (10 10, 20 20, 30 30, 40 40)' AS s
    UNION ALL SELECT 'LINESTRING (0 0, 1 0, 1 1, 0 1, 0 0)' AS s
) ORDER BY w;

INSERT INTO dest_t VALUES (2);

SELECT 'negative seconds_since_epoch - parseDateTimeInJodaSyntaxOrNull';

DROP TABLE t_alias_04202;

-- `s` flag (dot matches newline) is opt-in; default `.` does not cross newlines.
SELECT regexpPosition('a\nb', 'a.b');

SELECT regexpPosition('abc', '', 1, 4);

SELECT 'after-default max_threads',         startsWith(value, 'auto(') FROM system.settings WHERE name = 'max_threads';

SELECT 'getSetting > 0 max_parsing_threads default',     getSetting('max_parsing_threads') > 0;

SELECT count() FROM test_var_basic_nulls_wide WHERE v.String IS NULL SETTINGS max_threads=1;

SELECT groupUniqArray(cve) AS vulnerabilities, asset_key
FROM test_a3
LEFT ARRAY JOIN vuln_ids AS cve, vuln_scores AS severity
GROUP BY site_id, asset_key
HAVING severity > 5.0
ORDER BY asset_key
SETTINGS analyzer_compatibility_allow_non_aggregate_in_having = 1;

SELECT category, sum(value) AS total FROM test_a1 GROUP BY category
HAVING ((service = 'svc1' AND sum(value) > 0) AND sum(value) < 100) AND category != 'zzz'
ORDER BY category
SETTINGS analyzer_compatibility_allow_non_aggregate_in_having = 1;

DROP TABLE gcd_real_u32;

-- M_89 * M_127
SELECT isProbablePrime(toUInt256('162259276829213363391578010288127') * toUInt256('170141183460469231731687303715884105727'));

WITH toUInt256('57896044618658097711785492504343953926634992332820282019728792003956564819949') AS p25519
SELECT
    p25519 * toUInt256(3) < p25519 AS overflowed,
    toString(p25519 * toUInt256(3)) AS actual_wrapped_value
FORMAT Vertical;

SELECT product_id
FROM (
    SELECT DISTINCT product_id, section_id
    FROM (
        SELECT
            concat('product_', number % 2) AS product_id,
            concat('section_', number % 3) AS section_id
        FROM numbers(10)
    )
)
ORDER BY product_id;

SELECT lowerUTF8('ПРИВЕТ МИР');

CREATE DICTIONARY polygon_dict_cell
(polygon Array(Array(Array(Tuple(Float64, Float64)))), city_id UInt32)
PRIMARY KEY polygon
SOURCE(CLICKHOUSE(TABLE 'polygon_dict_bytes_src'))
LIFETIME(0)
LAYOUT(POLYGON_INDEX_CELL());

SELECT 'uint64_to_dec38_0:jit',     toString(if(materialize(toBool(0)), 1::Decimal(38, 0), toUInt64(18446744073709551615))) SETTINGS compile_expressions = 1;

SELECT 'int8_to_dec38_37_via_dec76:no_jit',  toString(if(materialize(toBool(0)), 1::Decimal(38, 37), toInt8(7))) SETTINGS compile_expressions = 0;

-- ============================================================================
-- Materialized columns from a subquery (the original failure from #103808).
-- ============================================================================
SELECT 'materialized_dec18_7:jit',
    toString(sum(if(k != 1, r, 1)))
FROM (SELECT materialize(1::Decimal(18, 7)) AS r, materialize(1) AS k)
SETTINGS compile_expressions = 1;

CREATE TABLE t_topk_json (id Int64, j JSON) ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 64;

-- Trigger the failing path:
-- - LEFT JOIN with `direct` algorithm (DirectKeyValueJoin over MergeTree)
-- - GROUP BY a comparison that mixes a right-side column (EventId UInt64) with a
--   left-side LowCardinality(Nullable(UInt64)). This is what tripped the broken
--   column order: EventId at its right_sample_block position used to contain the
--   OtherId data (Nullable(UInt32)), so the comparison saw a Nullable column where
--   it expected plain UInt64. Several aggregates plus DISTINCT and the LIMIT mirror
--   the AST fuzzer reproducer that originally surfaced the bug.
SELECT DISTINCT
    count() IGNORE NULLS,
    countIf('' != t1.Attribute),
    minOrNullDistinct(sipHash64(t1.Attribute))
FROM events_04206 AS t0
LEFT JOIN attributes_04206 AS t1 ON t1.OtherId = t0.Idu32n
GROUP BY t1.EventId = t0.Idlcn
ORDER BY 1, 2, 3
LIMIT 713
SETTINGS join_algorithm = 'direct';

SELECT toTypeName(tuple(toNullable(1)) <= '(NULL)');

-- ==========================================
-- Section 6: Non-trivial ALIAS body (a_bad ALIAS mapApply(...)).
-- Must NOT be rewritten: the alias body produces a different Map.
-- ==========================================

SELECT '-- non-trivial alias: a_bad[key1] is NOT rewritten';

SELECT '-- LowCardinality key: chained_alias also rewrites';

SELECT count() > 0 FROM (EXPLAIN actions = 1 SELECT count(n_alias) FROM t_alias_nullable) WHERE explain LIKE '%n.null%';

DROP TABLE t_array_join;

SELECT detectLanguageMixed(materialize(CAST(unhex('C390D18C') AS String)));

-- The trigger: PREWHERE references `is_deleted` together with another column,
-- so the prewhere DAG's outputs drop `is_deleted`. Before the fix this aborts
-- the server.
SELECT count()
FROM t_lazy_final_prewhere_del FINAL
PREWHERE is_deleted = 0 AND category = 'target'
SETTINGS query_plan_optimize_lazy_final = 1,
         max_rows_for_lazy_final = 10000000,
         min_filtered_ratio_for_lazy_final = 0;

CREATE TABLE t_manual (x UInt64) ENGINE = MergeTree ORDER BY x
SETTINGS merge_selector_algorithm = 'Manual';

SELECT 'inner_join_correctness' AS label, count(*), max(lk), min(lk)
FROM (
    SELECT l.id AS lid, l.k AS lk, r.value AS rval
    FROM t_l AS l INNER JOIN t_r2 AS r ON r.id = l.id
    ORDER BY l.k DESC
    LIMIT 10
);

-- Alias shadowing: the user-visible alias `k` is a *computed* expression
-- (`l.k + r.bonus`), so `ORDER BY k` cannot be pushed onto the preserved (left) input
-- because `l.k` alone is not the sort key. The pass-through check must reject this.
DROP TABLE IF EXISTS t_lb;

DROP TABLE t_extract_null;

SELECT extractAll(nullIf(materialize('hello world'), materialize('hello world')), '(\\w+)');

SELECT RANK(a) OVER (ORDER BY a) FROM (SELECT 1 AS a);

SELECT ProfileEvents['SelectedParts']
FROM system.query_log
WHERE current_database = currentDatabase()
  AND log_comment IN ('04209_statistics_retry_load_t_full', '04209_statistics_retry_load_t_packed')
  AND type = 'QueryFinish'
ORDER BY log_comment;

OPTIMIZE TABLE t_nested_clear_89537 FINAL;

CREATE TABLE t_73633_mt (x Nullable(UInt64)) ENGINE = MergeTree ORDER BY tuple();

SELECT modulo([10, 20, 30], CAST(7, 'Nullable(UInt32)')) FORMAT Null;

-- Sanity: with `read_overflow_mode_leaf = 'break'` the fix does NOT trigger; the data-read
-- skip index path is still used, and the result is correct because the index drops 99 granules.
SELECT count() FROM t_104328 WHERE val = 50
SETTINGS use_skip_indexes_on_data_read = 1, max_rows_to_read_leaf = 5, read_overflow_mode_leaf = 'break';

SELECT toUUID('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') AS uppercase_hex;

-- Correctness: results with the comparison disabled must still match the
-- results computed with the projection.
SELECT grp,
       sumIf(val1, col IN ('a', 'b')) AS m1,
       sumIf(val2, col IN ('c', 'd')) AS m2
FROM t_sumif_proj
GROUP BY grp ORDER BY grp
SETTINGS optimize_use_projections = 1, query_plan_max_set_size_for_projection_match = 0;

SELECT toTypeName(CAST('2023-01-02 03:04:05', 'DateTime'));

SELECT groupArray(x)
FROM
(
    SELECT x
    FROM file([currentDatabase() || '_file_array_arg_1.csv', currentDatabase() || '_file_array_arg_2.csv'], 'CSV', 'x UInt64')
    ORDER BY x
);

-- New columns on system.functions: deterministic, higher_order.

SELECT '-- columns exist with the expected types';

INSERT INTO arrays_test_57243 VALUES
    ('Hello', [1, 2], map(1, '1', 2, '2'), map(1, '1')),
    ('World', [3, 4, 5], map(3, '3', 4, '4', 5, '5'), map(3, '3', 4, '4')),
    ('Goodbye', [], map(), map());

SELECT count() FROM (SELECT k FROM (SELECT number AS k FROM numbers(5)) GROUP BY GROUPING SETS ((k), ()) LIMIT 100)
SETTINGS optimize_trivial_group_by_limit_query = 0;

-- The kept keys must all have the exact count of 100. With a per-thread cutoff they
-- would get values like 25 instead, so `max(c != 100)` would be 1.
SELECT max(c != 100), count() FROM t_trivial_group_by_limit_threads;

SELECT 'u_sparse <= 0',         count() FROM t_sparsity WHERE u_sparse <= 0   SETTINGS optimize_trivial_count_with_sparsity_filter = 1;

CREATE TABLE dst
(
    `key` Int64,
    `value` String
)
ENGINE = MergeTree
ORDER BY tuple();

SELECT count()
FROM t_70058
WHERE (ts > today())
  AND (method NOT IN ['HEAD', 'OPTIONS', 'CONNECT', 'WS'])
  AND (arrayJoin(res_sens_k) != '');

SELECT n FROM tab2 WHERE v = 10000 ORDER BY n ASC NULLS FIRST LIMIT 5 FORMAT Null;

SELECT formatReadableDecimalSize(1500, 4);

SELECT formatReadableSize(1234567, 101);

INSERT INTO test_complex_expr_both_sides SELECT number FROM numbers_mt(100);

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN actions = 1 SELECT a FROM test_with_where_filter WHERE b > 0 LIMIT 2 BY a SETTINGS allow_limit_by_partitions_independently = 1) WHERE explain LIKE '%Skip stream merging%' OR explain LIKE '%Read each partition through separate port%';

SELECT (SELECT count() FROM (SELECT a FROM test_summing_merge_tree LIMIT 2 BY a SETTINGS allow_limit_by_partitions_independently = 0)) = (SELECT count() FROM (SELECT a FROM test_summing_merge_tree LIMIT 2 BY a SETTINGS allow_limit_by_partitions_independently = 1));

SELECT replaceRegexpOne(explain, '^[ ]*(.*)', '\\1') FROM (EXPLAIN actions = 1 SELECT a FROM test_key_excludes_partition_col LIMIT 2 BY a SETTINGS allow_limit_by_partitions_independently = 1) WHERE explain LIKE '%Skip stream merging%' OR explain LIKE '%Read each partition through separate port%';

DROP TABLE IF EXISTS test_stateful_key;

DROP TABLE test_projection_partitioned_reading;

DROP TABLE dst_04218_ok SYNC;

DROP TABLE dist_two_shards_table_70356;

SELECT count() FROM (SELECT id, arrayJoin(a) FROM m LEFT JOIN l ON l.id = m.id ORDER BY id LIMIT 2);

INSERT INTO tags_src_80703 VALUES ('p1', 'site_a'), ('p2', 'site_b');

CREATE TABLE partition_id_with_minmax_folding (p UInt64, a UInt64)
ENGINE = MergeTree
ORDER BY a
PARTITION BY p
SETTINGS
    index_granularity = 1,
    enable_block_number_column = 1,
    enable_block_offset_column = 1,
    part_minmax_index_columns = 'with_block_number_offset';

SELECT key, someCol FROM test_replacing_mt_91849 FINAL PREWHERE ver > '2020-01-01' ORDER BY key;

INSERT INTO users_91946 VALUES (6666, 'Ksenia', 48, 0, 1);

SELECT 'materialize subquery, analyzer=0:';

INSERT INTO t2_04227 VALUES (1, 10), (2, 20), (3, 30);

SELECT 'CHECK on TEMPORARY-only Log table returns success:';

-- Regression test for https://github.com/ClickHouse/ClickHouse/issues/104432
-- `anyHeavy` used to ignore default values that came from the sparse-column
-- code path because the `addManyDefaults` override hardcoded length=0.

DROP TABLE IF EXISTS t_anyheavy_sparse;

SELECT bitRotateLeft(toUInt8(0x12), toUInt8(8))    = toUInt8(0x12);

INSERT INTO repro_104263 SELECT generateUUIDv4(), toDateTime64('2026-03-15 00:00:00', 3, 'UTC'), 1 FROM numbers(1);

SYSTEM STOP MERGES t_imv_minmax_basic;

INSERT INTO memory_mutation_timeout_break
SELECT
    number,
    number
FROM numbers(20)
SETTINGS max_block_size = 1;

INSERT INTO t_04229 SELECT number FROM numbers(100000);

-- All NULL: result is uniformly NULL (this was already correct, kept for completeness).
SELECT n, length(x) FROM (
    SELECT number AS n, CAST(NULL AS Nullable(FixedString(10))) AS x FROM numbers(4)
) ORDER BY n;

-- Basic: GROUP BY pk ORDER BY pk LIMIT
SELECT key, count() FROM t_agg_in_order_limit GROUP BY key ORDER BY key ASC LIMIT 5
SETTINGS optimize_aggregation_in_order = 1, optimize_aggregation_in_order_limit = 1;

DROP TABLE IF EXISTS rdb_str_pk;

SELECT number, [number] IN (arrayMap(y -> [y], [number, 7])) FROM numbers(2) ORDER BY number;

DROP TABLE IF EXISTS t_l_final;

SELECT length(transform(materialize(0), [1], [CAST('x' AS String)], materialize(CAST(toFixedString('', 23) AS FixedString(23)))));

-- CREATE OR REPLACE TABLE on an existing target: the inner rename upgrades to
-- EXCHANGE. Source-view edges must stay on `src`; the displaced contents are
-- about to be dropped, and dropping them must not strip dependents from `src`.
CREATE OR REPLACE TABLE src (id Int32, key String) ENGINE = Null;

SELECT length(finalizeAggregation(state * 3))  FROM (SELECT groupArrayMovingSumState(number) AS state FROM numbers(50));

SELECT 'no_stream',
       countIf(explain LIKE '%Optimized trivial count with sparsity filter%') > 0
FROM (EXPLAIN SELECT count() FROM t_sparsity_stream WHERE b != 0
      SETTINGS optimize_trivial_count_with_sparsity_filter = 1, use_skip_indexes_on_data_read = 0);

SELECT length(ifNull(materialize(CAST(toFixedString('xkE', 8) AS Nullable(FixedString(8)))), materialize(CAST(toFixedString('alt', 16) AS FixedString(16)))));

-- Sanity: the alias reads through the target before we drop it.
SELECT * FROM alias_with_missing_target_104740;

-- Regression test: `ALTER TABLE ... RENAME COLUMN a TO b, ADD COLUMN a ...` in a single
-- statement where the freshly added `a` has the SAME type and default as the old `a`.
-- The cache must still be invalidated, because the new `a` is a different column with
-- different on-disk data, even though its `(name, type, default)` signature matches.

SET use_columns_cache = 1;

CREATE TABLE test_pk_prefix_2col (a UInt32, b UInt32, c UInt32, z UInt32) ENGINE = MergeTree ORDER BY (a, b, c);

SELECT (SELECT count() FROM (SELECT a, b, z FROM test_monotonic_function LIMIT 5 BY toStartOfHour(a) SETTINGS optimize_limit_by_in_order = 0)) = (SELECT count() FROM (SELECT a, b, z FROM test_monotonic_function LIMIT 5 BY toStartOfHour(a) SETTINGS optimize_limit_by_in_order = 1));

INSERT INTO test_skip_prefix SELECT number % 1000, number % 97, number % 7, number FROM numbers_mt(1e5);

DROP TABLE test_where_fixed_by_tail;

CREATE TABLE test_creating_sets (a UInt32, b UInt32, z UInt32) ENGINE = MergeTree ORDER BY (a, b);

DROP TABLE IF EXISTS test_merge_nonpk_part_2;

-- spills to 2 blocks
SELECT hex(MD5(repeat('x', 64)));

ALTER TABLE t_replace_empty_dst REPLACE PARTITION 202301 FROM t_replace_empty_src
    SETTINGS allow_replace_partition_from_empty_source = 1;

CREATE TABLE IF NOT EXISTS target_for_alias_with_missing_target (`key` UInt32) ENGINE = MergeTree ORDER BY key;

CREATE TABLE {CLICKHOUSE_DATABASE_1:Identifier}.merge_over_alias_chain (`a` Int32) ENGINE = Merge({CLICKHOUSE_DATABASE_1:Identifier}, '^outer_alias_to_inner_alias$');

CREATE TABLE target_for_alias_missing_target (id UInt32) ENGINE = MergeTree ORDER BY id FORMAT Null;

SYSTEM STOP MERGES t_summing_clear_partition_compact;

SELECT 'summing_add_column_parts_column_v', count()
FROM system.parts_columns
WHERE database = currentDatabase()
  AND table = 't_summing_add_required'
  AND active
  AND column = 'v';

SELECT 'aggregating_clear_state', k, finalizeAggregation(s), finalizeAggregation(keep) FROM t_aggregating_clear_required ORDER BY k;

-- Boundary: smallest legal `num_buckets`.
SELECT jumpConsistentHash(0, 1);

SELECT CAST(toIntervalMillisecond(1) AS IntervalMicrosecond);

SELECT '== UInt8 boundary 63..67 ==';

SELECT intExp2(toFloat64(number) + 63.0) FROM numbers(5) ORDER BY number SETTINGS compile_expressions = 0;

SELECT toFloat64(materialize(2::Int256)  + materialize(0::Int256));

DROP TABLE IF EXISTS test_i16;

SELECT string_agg(toString(number), '-') FROM numbers(3);

SELECT (5 < SOME([1, 2, 6])) = arrayExists(_a -> 5 < _a, [1, 2, 6]);

SELECT 3 = SOME(SELECT number FROM numbers(5));

SELECT toLastDayOfMonth(toDate32('1969-12-31'));

SELECT date_part('epoch', toDateTime('2024-03-17 00:00:00', 'UTC')) = EXTRACT(EPOCH FROM toDateTime('2024-03-17 00:00:00', 'UTC'));

SELECT toUInt64(getServerSetting('mark_cache_size'))
     = toUInt64((SELECT value FROM system.server_settings WHERE name = 'mark_cache_size'))
     AS mark_cache_size_matches;

-- INNER + dense range -> shared filter fires.
SELECT 'inner_dense', count() FROM phjf_probe p INNER JOIN phjf_build b ON p.k = b.k SETTINGS join_runtime_filter_from_fixed_hash_table = 0;

INSERT INTO phjf_build SELECT if(number % 20 = 0, NULL, toInt32(number)) FROM numbers(100);

INSERT INTO phjf_probe SELECT toInt32(number * 500000) FROM numbers(50);

INSERT INTO phjf_build SELECT toUInt64(number) FROM numbers(100);

DROP VIEW test_view_105153;

CREATE TABLE test_distributed_04241 AS test_local_04241
ENGINE = Distributed(test_cluster_two_shards_localhost, currentDatabase(), test_local_04241, id);

-- Row policy on the view: pushdown must be disabled. Row policies on the view
-- are applied as a planner `where_filters` step above the view subquery (since
-- `StorageView` does not support prewhere), so pushing `LIMIT` would truncate
-- before the policy filter runs. Same correctness check pattern as above —
-- buggy pushdown would return 0 rows instead of the correct 10.
DROP ROW POLICY IF EXISTS test_policy_04241 ON test_view_04241;

SELECT 'type mismatch disables pushdown:',
    (SELECT count() = 0 FROM (EXPLAIN SELECT x FROM test_view_strtype_04241 ORDER BY x DESC LIMIT 1)
     WHERE explain LIKE '%Merge sorted streams%') AS no_merge_sort;

DROP USER IF EXISTS definer_limit_04241;

CREATE TABLE test_distributed_sample_04241 AS test_local_sample_04241
    ENGINE = Distributed(test_cluster_two_shards_localhost, currentDatabase(), test_local_sample_04241, id);

CREATE TABLE test_proj_minmax
(
    a UInt32,
    b UInt32,
    PROJECTION p (SELECT a, b ORDER BY b) WITH SETTINGS (add_minmax_index_for_numeric_columns = 1)
)
ENGINE = MergeTree
PARTITION BY a % 3
ORDER BY a
SETTINGS index_granularity = 1, storage_policy = 'default';

SELECT mortonEncode(a, b, c) FROM (
    SELECT (toUInt64(number + 1), toUInt64(number + 1)) AS a, toUInt32(1024) AS b, toUInt32(16) AS c FROM numbers(4)
);

DETACH DICTIONARY d_104791;

SELECT c1, c2 FROM t_97771_3 WHERE c0 > 0 ORDER BY c0 LIMIT 3
SETTINGS query_plan_optimize_lazy_materialization = 1;

SELECT 'compact_count', count() FROM t_packed_compact WHERE v BETWEEN 70 AND 700;

SELECT 'merge_compact_part_type_after', part_type FROM system.parts
WHERE database = currentDatabase() AND table = 't_packed_merge_compact' AND active;

SELECT parseDateTime64BestEffortOrNull('978307200000000', 6, 'UTC');

SELECT count() FROM tab_dup WHERE hasAllTokens(s, ['missing', 'missing']) SETTINGS text_index_posting_list_apply_mode = 'lazy';

DROP TABLE IF EXISTS stid_2635_r;

INSERT INTO t_wide_on_to_off SELECT number, number * 7 FROM numbers(10000);

CHECK TABLE t_compact_off_to_on SETTINGS check_query_single_value_result = 1;

DROP TABLE IF EXISTS t_wide_flip_mutate_on2off;

CREATE TABLE t_gin_dup (x UInt32, y UInt32) ENGINE = MergeTree ORDER BY x;

-- Regression for STID 2380-3043: `ALTER TABLE <memory_table> (APPLY PATCHES)`
-- (and `APPLY DELETED MASK`) used to trigger
-- `Logical error: Mutation of \`Memory\` table produced incomplete output: block 0 has 0 rows, expected N`
-- because `MutationsInterpreter` skips these commands without producing matching output blocks,
-- and `StorageMemory::mutate` then mismatched the partial-column invariant.
-- `Memory` tables do not own patch parts or deletion masks, so both commands must be no-ops.

DROP TABLE IF EXISTS t_memory_apply_patches;

INSERT INTO t_expand_mutate SELECT number, number * 2, number * 3 FROM numbers(2000);

SELECT startsWithCaseInsensitiveUTF8('some long haystack that is much longer than sixteen bytes', unhex('61C328'));

DROP TABLE IF EXISTS right_99959_multi;

SELECT '--- RIGHT ANTI JOIN with table swap (becomes LEFT ANTI internally) ---';

CREATE TABLE t_dist (c0 Int) ENGINE = Distributed('test_shard_localhost', currentDatabase(), 't_mt');

SELECT maxMappedArrays(a, b) FROM VALUES('a Array(Char), b Array(Float64)', (['y'], [nan]), (['y'], [nan]));

-- Packed baseline: a single merged part with the index inside the archive. Phase 3 (also a
-- merged part, so the same per-column bookkeeping) is compared against this count.
INSERT INTO t_pack_trans_files SELECT 'phase2_packed', files
FROM system.parts WHERE database = currentDatabase() AND table = 't_pack_trans' AND active;

SELECT '-- mv_to_target points at the explicit destination';

SELECT 'Lazy mode still active for pure-token queries on the same table';

SELECT (SELECT count() FROM (SELECT user_id FROM test_part_unrelated LIMIT 2 BY user_id SETTINGS optimize_limit_by_in_order = 0)) = (SELECT count() FROM (SELECT user_id FROM test_part_unrelated LIMIT 2 BY user_id SETTINGS optimize_limit_by_in_order = 1));

INSERT INTO test_merge_overlap_part_1 SELECT number % 500, number       FROM numbers(50000);

SELECT 'after_merge_text_filters_granules', countIf(
    splitByChar('/', trim(replaceAll(explain, 'Granules:', '')))[1]::UInt64
    < splitByChar('/', trim(replaceAll(explain, 'Granules:', '')))[2]::UInt64)
FROM (EXPLAIN indexes = 1 SELECT * FROM t_text_no_pack WHERE s = '7919') AS s
WHERE explain LIKE '%Granules:%' AND explain NOT LIKE '%PrimaryKey%';

SELECT name, type, expression
FROM system.constraints
WHERE database = currentDatabase() AND table = 'test_constraints_secrets';

DROP TABLE IF EXISTS tab_lazy_pe;

-- Force the merge to exercise the prewarm path on the active part.
OPTIMIZE TABLE t_long_pack FINAL;

SELECT 'cardinality tkb', count() FROM tab_heap WHERE hasToken(s, 'tkb');

SELECT caseWithExpression(3, 1, 'one', 2, 'two', 'other');

SELECT '-- inline subquery aliased b, with subcolumn (compat) --';

SET query_plan_merge_filters = 0,
    query_plan_optimize_lazy_materialization = 0,
    query_plan_remove_unused_columns = 0,
    query_plan_optimize_prewhere = 0,
    optimize_move_to_prewhere = 0;

SELECT toUnixTimestamp64Nano(dt), count()
FROM
(
    SELECT arrayJoin([
        toDateTime64('2020-01-01 00:00:00.000000000', 9, 'UTC'),
        toDateTime64('2020-01-01 00:00:00.000000001', 9, 'UTC')]) AS dt
)
WHERE dt = 1577836800.0
GROUP BY ALL
ORDER BY ALL;
